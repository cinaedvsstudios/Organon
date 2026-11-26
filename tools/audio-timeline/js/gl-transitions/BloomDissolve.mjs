import { uploadTransitionTexture } from './texture-upload.mjs';
/**
 * #18 BloomDissolve — original gre/MIT highlight-based glow GLSL.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/BloomDissolve.glsl
 * Original blob 7964bebdd9bcdb6a1a1106bea2f6f7d41bb3f92c.
 * Keeps original 20 spiral highlight taps, bright knee, soft flood,
 * screened tinted bloom and A/B switch under peak illumination.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const BLOOM_DISSOLVE_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The highlights of the outgoing image blow out into a soft, wide glow that floods the frame; under it the incoming image takes over, then the glow subsides back into its highlights while the image stays sharp
// Tags: light, glow, bloom, dissolve

// @range(0, 0.6) Reach of the glow at the peak, in frame heights
uniform float spread; // = 0.25
// @range(0, 1) Brightness above which the image glows (the whole frame does at the peak)
uniform float threshold; // = 0.6
// @range(0, 4) Brightness of the glow
uniform float intensity; // = 1.5
// @color Tint of the glow, toward its edges
uniform vec3 tint; // = vec3(1.0, 0.9, 0.75)

// pairs of opposite taps: 20 reads per pixel
const int PAIRS = 10;
const float GOLDEN_ANGLE = 2.399963;

float hash12(vec2 v) {
  vec3 v3 = fract(vec3(v.xyx) * 0.1031);
  v3 += dot(v3, v3.yzx + 33.33);
  return fract((v3.x + v3.y) * v3.z);
}

vec2 mirror(vec2 v) {
  return 1.0 - abs(1.0 - mod(v, 2.0));
}

// the image on screen at a point, premultiplied: one image, or both during the short switch
vec4 image(vec2 st, float m) {
  if (m <= 0.0) {
    vec4 c = getFromColor(st);
    return vec4(c.rgb * c.a, c.a);
  }
  if (m >= 1.0) {
    vec4 c = getToColor(st);
    return vec4(c.rgb * c.a, c.a);
  }
  vec4 a = getFromColor(st);
  vec4 b = getToColor(st);
  return mix(vec4(a.rgb * a.a, a.a), vec4(b.rgb * b.a, b.a), m);
}

vec3 glow(vec4 c, float knee) {
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  return c.rgb * smoothstep(knee, knee + max(0.3 * (1.0 - knee), 1e-3), lum);
}

vec4 transition(vec2 uv) {
  float p = progress;
  float amount = 4.0 * p * (1.0 - p);
  float peak = amount * amount;
  float flood = peak * peak * peak;
  float m = smoothstep(0.44, 0.56, p);
  if (amount <= 0.0) return m < 0.5 ? getFromColor(uv) : getToColor(uv);

  vec4 c = image(uv, m);
  if (c.a <= 0.0) return vec4(0.0);
  c.rgb /= c.a;

  float knee = threshold * (1.0 - 0.3 * peak) * (1.0 - flood);
  float radius = spread * amount;
  // a rotation and a radial shift of the spiral for each pixel blend the taps into a smooth glow;
  // hashed by integer cell so that every GPU computes the same values
  vec2 cell = floor(uv * vec2(ratio, 1.0) * 997.0);
  float spin = 6.2831853 * hash12(cell);
  float shift = hash12(cell + 71.0);

  // a golden-angle spiral, denser toward the center so the glow is bright at its core with a wide soft tail;
  // each tap is read with its opposite, which cancels most of the noise across smooth gradients
  vec3 bloom = vec3(0.0);
  vec4 soft = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < PAIRS; i++) {
    float s = (float(i) + shift) / float(PAIRS);
    float r = s * s;
    float a = float(i) * GOLDEN_ANGLE + spin;
    vec2 offset = radius * r * vec2(cos(a) / ratio, sin(a));
    vec4 i0 = image(mirror(uv + offset), m);
    vec4 i1 = image(mirror(uv - offset), m);
    vec3 l = glow(i0, knee) + glow(i1, knee);
    // the sparse outer taps weigh less, so the tail of the glow stays smooth
    float w = 1.0 - 0.75 * s;
    bloom += w * mix(vec3(1.0), tint, smoothstep(0.0, 0.5, r)) * l;
    total += w;
    float sw = (1.0 - s) * (1.0 - s);
    soft += sw * (i0 + i1);
  }
  bloom /= 2.0 * total;
  // at the peak the light softens the image itself, which hides the switch
  vec3 blurred = soft.a > 0.0 ? soft.rgb / soft.a : c.rgb;
  vec3 base = mix(c.rgb, blurred, 0.7 * flood);
  bloom *= intensity * peak * (1.0 + 2.0 * flood);
  // compressed, so that the glow floods the frame without flattening into white
  bloom = 0.92 * (1.0 - exp(-bloom));

  // the glow is a light screened over the image: it adds nothing to its alpha
  base = min(base * (1.0 + 0.25 * peak), 1.0);
  return vec4(base + bloom - base * bloom, c.a);
}
`;
export const BLOOM_DISSOLVE_DEFAULTS = Object.freeze({
    spread:.25,threshold:.6,intensity:1.5,tint:'#ffe6bf'
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
export function normaliseBloomDissolveOptions(options={}){
    return {
        spread:bound(options.spread,0,.6,.25),
        threshold:bound(options.threshold,0,1,.6),
        intensity:bound(options.intensity,0,4,1.5),
        tint:color(options.tint,'#ffe6bf')
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
${BLOOM_DISSOLVE_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('BloomDissolve failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original BloomDissolve GLSL compilation failed: '+error);
    }
    return shader;
}
export function createBloomDissolveWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('BloomDissolve requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original BloomDissolve GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'spread','threshold','intensity','tint'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('BloomDissolve WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('BloomDissolve input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseBloomDissolveOptions(rawOptions);
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
            gl.uniform1f(uniforms.spread,opts.spread);
            gl.uniform1f(uniforms.threshold,opts.threshold);
            gl.uniform1f(uniforms.intensity,opts.intensity);
            gl.uniform3fv(uniforms.tint,new Float32Array(rgb(opts.tint)));
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('BloomDissolve original shader GPU draw error '+error);
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
export function paintBloomDissolve(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('BloomDissolve requires decoded outgoing and incoming footage');
    const sources=['bloomDissolveFromScratch','bloomDissolveToScratch'].map(key=>{
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
    const shader=renderer.bloomDissolveWebGL??(renderer.bloomDissolveWebGL=createBloomDissolveWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['bloom-dissolve']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
