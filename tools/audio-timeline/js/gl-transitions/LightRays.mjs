import { uploadTransitionTexture } from './texture-upload.mjs';
/**
 * #20 LightRays — original gre/MIT highlight-derived light shaft GLSL.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/LightRays.glsl
 * Original blob 1df4de6da52cf8305563bee10d7df32f7124c852.
 * 20-sample outward highlight rays, moving origin, shaft noise, screen
 * blending and A-to-B change beneath peak illumination.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const LIGHT_RAYS_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: Shafts of light burst from the highlights of the outgoing image and stream outward from a slowly drifting center; at their peak the incoming image takes over and its own rays shrink back into its highlights
// Tags: light, glow, rays, radial

// @param Point the rays stream away from, at the middle of the transition
uniform vec2 center; // = vec2(0.5, 0.6)
// @range(0, 0.5) How far the center drifts during the transition, from left to right
uniform float drift; // = 0.15
// @range(0, 1) Length of the rays at the peak, as a fraction of their distance to the center
uniform float reach; // = 0.6
// @range(0, 0.8) Brightness above which the image casts rays
uniform float threshold; // = 0.65
// @range(0, 4) Brightness of the rays
uniform float intensity; // = 1.5
// @color Tint of the rays, toward their ends
uniform vec3 tint; // = vec3(1.0, 0.82, 0.55)

const int TAPS = 20;
const float SHAFTS = 23.0;
const float PI = 3.141592653589793;

float hash12(vec2 v) {
  vec3 v3 = fract(vec3(v.xyx) * 0.1031);
  v3 += dot(v3, v3.yzx + 33.33);
  return fract((v3.x + v3.y) * v3.z);
}

// smooth noise around the center, wrapping over a full turn (t in 0..1)
float shaftNoise(float t, float n, float seed) {
  float x = t * n;
  float i = floor(x);
  float f = x - i;
  float a = hash12(vec2(mod(i, n), seed));
  float b = hash12(vec2(mod(i + 1.0, n), seed));
  return mix(a, b, f * f * (3.0 - 2.0 * f));
}

vec2 mirror(vec2 v) {
  return 1.0 - abs(1.0 - mod(v, 2.0));
}

vec3 glow(vec4 c, float knee) {
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  return c.rgb * c.a * smoothstep(knee, knee + 0.2, lum);
}

vec3 light(vec2 st, float knee, float m) {
  if (m <= 0.0) return glow(getFromColor(st), knee);
  if (m >= 1.0) return glow(getToColor(st), knee);
  return mix(glow(getFromColor(st), knee), glow(getToColor(st), knee), m);
}

vec4 transition(vec2 uv) {
  float p = progress;
  float amount = p < 0.5 ? smoothstep(0.0, 0.5, p) : 1.0 - smoothstep(0.5, 1.0, p);
  float peak = amount * amount * amount;
  float m = smoothstep(0.46, 0.54, p);
  vec4 fromColor = getFromColor(uv);
  vec4 toColor = getToColor(uv);
  if (amount <= 0.0) return m < 0.5 ? fromColor : toColor;

  vec2 origin = center + vec2(drift * (p - 0.5), 0.0);
  float len = reach * amount;
  float knee = mix(threshold, 0.75 * threshold, peak);
  // a small shift of the taps, under their spacing, blends them into smooth shafts;
  // hashed by integer cell so that every GPU computes the same shift
  float jitter = hash12(floor(uv * vec2(ratio, 1.0) * 997.0));

  vec3 rays = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float s = (float(i) + jitter) / float(TAPS);
    float w = exp(-2.0 * s);
    vec3 hue = mix(vec3(1.0), tint, smoothstep(0.0, 0.6, s));
    rays += w * hue * light(mirror(mix(uv, origin, s * len)), knee, m);
    total += w;
  }
  vec2 d = (uv - origin) * vec2(ratio, 1.0);
  // atan is undefined at the center itself
  float turn = length(d) > 1e-6 ? atan(d.y, d.x) / (2.0 * PI) + 0.5 : 0.0;
  float shafts = 0.6 * shaftNoise(fract(turn + 0.03 * p), SHAFTS, 1.0) + 0.4 * shaftNoise(fract(turn - 0.05 * p), 2.0 * SHAFTS + 1.0, 7.0);
  // merged back into a soft glow close to the center, where the shafts would meet in a point
  rays *= mix(1.0, mix(0.2, 1.6, smoothstep(0.15, 0.85, shafts)), smoothstep(0.0, 0.3, length(d)));
  rays *= intensity * amount * (1.0 + 3.0 * peak) / total;
  // compressed, so that bright areas never flatten into white
  rays = 0.9 * (1.0 - exp(-rays));

  // the image stays sharp, with a slight lift at the peak; the rays are screened on top and add nothing to its alpha
  vec4 c = mix(vec4(fromColor.rgb * fromColor.a, fromColor.a), vec4(toColor.rgb * toColor.a, toColor.a), m);
  if (c.a <= 0.0) return vec4(0.0);
  vec3 base = min(c.rgb / c.a * (1.0 + 0.2 * peak), 1.0);
  return vec4(base + rays - base * rays, c.a);
}
`;
export const LIGHT_RAYS_DEFAULTS = Object.freeze({
    centerX:.5,centerY:.6,drift:.15,reach:.6,threshold:.65,intensity:1.5,tint:'#ffd18c'
});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
const color=(value,fallback)=>{
    const s=String(value||'').trim();
    return /^#[0-9a-f]{6}$/i.test(s)?s.toLowerCase():fallback;
};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function normaliseLightRaysOptions(options={}){
    return {
        centerX:bound(options.centerX,0,1,.5),
        centerY:bound(options.centerY,0,1,.6),
        drift:bound(options.drift,0,.5,.15),
        reach:bound(options.reach,0,1,.6),
        threshold:bound(options.threshold,0,.8,.65),
        intensity:bound(options.intensity,0,4,1.5),
        tint:color(options.tint,'#ffd18c')
    };
}
const vertexSource=`attribute vec2 position; varying vec2 uv;
void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}`;
const fragmentSource=`precision highp float;
varying vec2 uv;
uniform sampler2D fromTexture;
uniform sampler2D toTexture;
uniform float progress;
uniform float ratio;
vec4 getFromColor(vec2 p){return texture2D(fromTexture,p);}
vec4 getToColor(vec2 p){return texture2D(toTexture,p);}
${LIGHT_RAYS_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('LightRays failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original LightRays GLSL compilation failed: '+error);
    }
    return shader;
}
export function createLightRaysWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('LightRays requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original LightRays GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'center','drift','reach','threshold','intensity','tint'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('LightRays WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('LightRays input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseLightRaysOptions(rawOptions);
            gl.viewport(0,0,width,height);gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
            for(const [index,source] of [from,to].entries()){
                gl.activeTexture(gl.TEXTURE0+index);
                gl.bindTexture(gl.TEXTURE_2D,textures[index]);
                gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
                uploadTransitionTexture(gl,textures[index],source);
            }
            gl.uniform1i(uniforms.fromTexture,0);
            gl.uniform1i(uniforms.toTexture,1);
            gl.uniform1f(uniforms.progress,Math.max(0,Math.min(1,Number(progress)||0)));
            gl.uniform1f(uniforms.ratio,width/height);
            gl.uniform2f(uniforms.center,opts.centerX,opts.centerY);
            gl.uniform1f(uniforms.drift,opts.drift);
            gl.uniform1f(uniforms.reach,opts.reach);
            gl.uniform1f(uniforms.threshold,opts.threshold);
            gl.uniform1f(uniforms.intensity,opts.intensity);
            gl.uniform3fv(uniforms.tint,new Float32Array(rgb(opts.tint)));
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('LightRays original shader GPU draw error '+error);
            return canvas;
        },
        dispose(){
            textures.forEach(texture=>gl.deleteTexture(texture));
            gl.deleteBuffer(buffer);gl.deleteProgram(program);
            canvas.width=0;canvas.height=0;
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
    };
}
/** Compose both original source images into a single GPU shader frame. */
export function paintLightRays(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('LightRays requires decoded outgoing and incoming footage');
    const sources=['lightRaysFromScratch','lightRaysToScratch'].map(key=>{
        const canvas=renderer[key]??(renderer[key]=document.createElement('canvas'));
        if(canvas.width!==width)canvas.width=width;
        if(canvas.height!==height)canvas.height=height;
        return canvas;
    });
    for(const [index,track] of [fromTrack,toTrack].entries()){
        const ctx=sources[index].getContext('2d');
        ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.filter='none';
        ctx.clearRect(0,0,width,height);
        ctx.globalAlpha=(track.visible===false?0:Math.max(0,Math.min(1,Number(track.opacity??1))))
            *visualFadeOpacity(track,time,{ignoreEnter:index===1});
        applyVisualContext(ctx,track,time,width,height);
        if(track.type==='background'){
            const media=track.media,mw=media.videoWidth||media.naturalWidth||media.width,
                mh=media.videoHeight||media.naturalHeight||media.height;
            if(mw&&mh){
                const scale=Math.max(width/mw,height/mh),w=mw*scale,h=mh*scale;
                ctx.drawImage(media,(width-w)/2,(height-h)/2,w,h);
            }
        }else drawContained(ctx,track.media,width,height);
        if(track.type!=='sticker')drawVisualVignette(ctx,track,time,width,height);
        ctx.restore();
    }
    const shader=renderer.lightRaysWebGL??(renderer.lightRaysWebGL=createLightRaysWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['light-rays']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
