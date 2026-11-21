/**
 * #26 Refraction — original gre/MIT flowing glass and spectral GLSL.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/Refraction.glsl
 * Upstream blob 506391a9f5568868bd405a707e6c591c1f2b48bd.
 * Multi-wavelength liquid refraction; four native parameter uniforms.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const REFRACTION_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The frame is seen through flowing liquid glass that bends the outgoing image more and more, with rainbow fringes, flares up as the incoming image takes over, then calms down and clears
// Tags: distortion, refraction, chromatic-aberration, glow

// @range(0, 0.3) How far the glass bends the image at the peak
uniform float strength; // = 0.15
// @range(0.5, 8) Size of the flowing waves: higher makes smaller waves
uniform float scale; // = 2.5
// @range(0, 1) Spread of the rainbow fringes
uniform float dispersion; // = 0.5
// @range(0, 3) Brightness of the flare at the peak
uniform float brightness; // = 1.0

// the wavelengths sampled from red to violet
const int TAPS = 7;

float surface(vec2 q, float t) {
  q += 0.45 * vec2(sin(1.3 * q.y + 0.9 * t), sin(1.1 * q.x - 1.2 * t));
  float h = sin(q.x + 0.6 * t) * sin(1.2 * q.y - 0.8 * t);
  h += 0.5 * sin(dot(q, vec2(1.6, -1.2)) + 1.4 * t);
  h += 0.3 * sin(dot(q, vec2(-1.1, 2.9)) - 1.9 * t + 1.7 * sin(0.9 * q.x));
  h += 0.15 * sin(dot(q, vec2(4.3, 3.1)) + 2.6 * t);
  return h;
}

// a hash without sin, to jitter the wavelengths from pixel to pixel
float hash12(vec2 v) {
  vec3 v3 = fract(vec3(v.xyx) * 0.1031);
  v3 += dot(v3, v3.yzx + 33.33);
  return fract((v3.x + v3.y) * v3.z);
}

vec2 mirror(vec2 v) {
  return 1.0 - abs(1.0 - mod(v, 2.0));
}

// rough spectral response of a wavelength w (0 = red, 1 = violet), in RGB
vec3 spectrum(float w) {
  vec3 c = vec3(
    1.0 - smoothstep(0.0, 0.55, w) + 0.35 * smoothstep(0.75, 1.0, w),
    1.0 - abs(2.0 * w - 1.0) * 1.2,
    smoothstep(0.45, 1.0, w)
  );
  return clamp(c, 0.0, 1.0);
}

vec4 transition(vec2 uv) {
  float p = progress;
  float h = 1.0 - abs(2.0 * p - 1.0);
  float amount = h * h * (2.0 - h);

  vec2 q = (uv - 0.5) * vec2(ratio, 1.0) * scale;
  float t = 3.0 * p;
  float e = 0.01;
  vec2 slope = vec2(
    surface(q + vec2(e, 0.0), t) - surface(q - vec2(e, 0.0), t),
    surface(q + vec2(0.0, e), t) - surface(q - vec2(0.0, e), t)
  ) / (2.0 * e);
  vec2 offset = slope * strength * amount / scale;
  float wave = clamp(0.5 * surface(q, t), -1.0, 1.0);
  float m = smoothstep(-0.015, 0.015, p - 0.5 + 0.1 * wave);

  vec3 color = vec3(0.0);
  vec3 weights = vec3(0.0);
  float alpha = 0.0;
  // jittered wavelengths blend the fringes into a continuous rainbow
  float jitter = hash12(uv * vec2(ratio, 1.0) * 1000.0) - 0.5;
  for (int i = 0; i < TAPS; i++) {
    float w = float(i) / float(TAPS - 1);
    float wj = (float(i) + jitter) / float(TAPS - 1);
    vec2 st = mirror(uv + offset * (1.0 + dispersion * (wj - 0.5) * 1.6));
    vec4 c = mix(getFromColor(st), getToColor(st), m);
    vec3 s = spectrum(w);
    color += s * c.rgb * c.a;
    weights += s;
    alpha += c.a;
  }
  alpha /= float(TAPS);
  color = color / weights / max(alpha, 1e-5);

  float flare = 2.0 * brightness * pow(h, 8.0);
  color = color * (1.0 + flare) / (1.0 + flare * color);
  color += 0.1 * flare * dot(color, vec3(0.3333));
  return vec4(clamp(color, 0.0, 1.0), alpha);
}
`;
export const REFRACTION_DEFAULTS = Object.freeze({strength:.15,scale:2.5,dispersion:.5,brightness:1});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
export function normaliseRefractionOptions(options={}){
    return {
        strength:bound(options.strength,0,.3,.15),
        scale:bound(options.scale,.5,8,2.5),
        dispersion:bound(options.dispersion,0,1,.5),
        brightness:bound(options.brightness,0,3,1)
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
${REFRACTION_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('Refraction failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original Refraction GLSL compilation failed: '+error);
    }
    return shader;
}
export function createRefractionWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('Refraction requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original Refraction GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'strength','scale','dispersion','brightness'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('Refraction WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('Refraction input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseRefractionOptions(rawOptions);
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
                gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
            }
            gl.uniform1i(uniforms.fromTexture,0);
            gl.uniform1i(uniforms.toTexture,1);
            gl.uniform1f(uniforms.progress,Math.max(0,Math.min(1,Number(progress)||0)));
            gl.uniform1f(uniforms.ratio,width/height);
            gl.uniform1f(uniforms.strength,opts.strength);
            gl.uniform1f(uniforms.scale,opts.scale);
            gl.uniform1f(uniforms.dispersion,opts.dispersion);
            gl.uniform1f(uniforms.brightness,opts.brightness);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('Refraction original shader GPU draw error '+error);
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
export function paintRefraction(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('Refraction requires decoded outgoing and incoming footage');
    const sources=['refractionFromScratch','refractionToScratch'].map(key=>{
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
    const shader=renderer.refractionWebGL??(renderer.refractionWebGL=createRefractionWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['refraction']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
