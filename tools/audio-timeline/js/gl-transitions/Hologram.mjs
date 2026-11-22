/**
 * Pinned upstream original GLSL git blob 284e495b81dabf03070eb1c24ad41583a7ed5ee4; source commit deeebdee7581cdfe924ed9cf104ea2fd10e63155.
 * Hologram (#02 of 41) — GL Transitions original shader, Author gre, MIT.
 * Upstream https://github.com/gl-transitions/gl-transitions/blob/deeebdee7581cdfe924ed9cf104ea2fd10e63155/transitions/Hologram.glsl
 * Source below is preserved byte-for-byte; only the wrapper supplies the
 * two textures, progress and original uniform controls.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const HOLOGRAM_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The outgoing image turns into a flickering hologram (blue by default) with scanlines and jittering rows, breaks up, and the hologram resolves into the incoming image in full color
// Tags: hologram, sci-fi, scanlines, flicker, glitch

// @color Color of the hologram
uniform vec3 tint; // = vec3(0.2, 0.75, 1.0)
// @color Color behind the hologram, seen between its scanlines and where it breaks up
uniform vec4 background; // = vec4(0.0, 0.02, 0.05, 1.0)
// @range(20, 300) Number of scanlines over the frame height
uniform float scanlines; // = 150.0
// @range(0, 0.2) How far rows of the hologram jump sideways, relative to the frame width
uniform float jitter; // = 0.04
// @range(0, 1) Strength of the flicker and of the rows that drop out
uniform float flicker; // = 0.6

const float PI = 3.14159265;
const float STEPS = 32.0;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

vec4 premultiplied(vec4 c) {
  return vec4(c.rgb * c.a, c.a);
}

vec4 source(vec2 uv, float m) {
  return m > 0.5 ? getToColor(uv) : getFromColor(uv);
}

vec4 transition(vec2 uv) {
  float p = progress;
  float h = smoothstep(0.0, 0.3, p) * (1.0 - smoothstep(0.7, 1.0, p));
  float b = smoothstep(0.0, 1.0, 1.0 - abs(p - 0.5) / 0.22);
  float f = floor(p * STEPS);

  float band = floor(uv.y * 36.0);
  float jump = step(1.0 - (0.2 + 0.6 * b) * h, hash(vec2(band, f)));
  float offset = (hash(vec2(band, f + 0.37)) - 0.5) * 2.0 * jitter * jump * (0.3 + 0.7 * b);
  offset += sin(uv.y * 23.0 + f * 1.7) * 0.0015 * h;
  vec2 q = uv + vec2(offset, 0.0);

  float m = step(hash(vec2(floor(uv.y * 24.0), 7.0)), (p - 0.35) / 0.3);

  // the luma of the image in the tint, with colored fringes weighted by their texels' alpha
  vec4 c = source(clamp(q, 0.0, 1.0), m);
  vec2 dx = vec2(0.003 + 0.01 * b, 0.0);
  float l = luma(c.rgb);
  vec4 cr = source(clamp(q + dx, 0.0, 1.0), m);
  vec4 cb = source(clamp(q - dx, 0.0, 1.0), m);
  float lr = luma(cr.rgb) * cr.a;
  float lb = luma(cb.rgb) * cb.a;
  vec3 g = smoothstep(0.05, 0.9, vec3(lr, l, lb));
  vec3 holo = tint * (0.06 + 1.25 * g) + 0.45 * g * g * g;
  float roll = fract(uv.y + 2.0 * p);
  holo += tint * 0.35 * smoothstep(0.85, 1.0, roll) * (1.0 - smoothstep(0.98, 1.0, roll));
  holo = clamp(holo, 0.0, 1.0);
  float inside = step(0.0, q.x) * step(q.x, 1.0);

  float lines = 0.5 + 0.5 * sin((uv.y * scanlines - p * 6.0) * 2.0 * PI);
  float vis = mix(1.0, 0.15 + 0.85 * lines, h);
  vis *= 1.0 - flicker * (0.25 + 0.75 * b) * hash(vec2(f, 3.1)) * h;
  float gap = step(hash(vec2(floor(uv.y * 90.0), f + 0.71)), flicker * 0.45 * b);
  vis *= 1.0 - gap;
  vec4 layer = vec4(holo, c.a * vis * inside);
  vec4 plain = premultiplied(source(uv, m));
  vec4 back = premultiplied(vec4(background.rgb, background.a * max(plain.a, layer.a)));
  vec4 holoColor = premultiplied(layer) + back * (1.0 - layer.a);

  vec4 o = mix(plain, holoColor, h);
  return o.a > 0.0 ? vec4(o.rgb / o.a, o.a) : vec4(0.0);
}
`;
export const HOLOGRAM_DEFAULTS=Object.freeze({
    tint:'#33bfff',background:'#00050d',backgroundAlpha:1,
    scanlines:150,jitter:0.04,flicker:0.6
});
const bounded=(n,min,max,otherwise)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):otherwise;
const hexColor=(candidate,fallback)=>{
    const value=String(candidate||'').trim();
    return /^#[a-f\d]{6}$/i.test(value)?value.toLowerCase():fallback;
};
const channels=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function normaliseHologramOptions(options={}) {
    return {
        tint:hexColor(options.tint,HOLOGRAM_DEFAULTS.tint),
        background:hexColor(options.background,HOLOGRAM_DEFAULTS.background),
        backgroundAlpha:bounded(options.backgroundAlpha,0,1,1),
        scanlines:Math.round(bounded(options.scanlines,20,300,150)),
        jitter:bounded(options.jitter,0,0.2,0.04),
        flicker:bounded(options.flicker,0,1,0.6)
    };
}
const vertexSource=`attribute vec2 position; varying vec2 uv;
void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}`;
const fragmentSource=`precision highp float;
varying vec2 uv;
uniform sampler2D fromTexture;
uniform sampler2D toTexture;
uniform float progress;
vec4 getFromColor(vec2 p){return texture2D(fromTexture,p);}
vec4 getToColor(vec2 p){return texture2D(toTexture,p);}
${HOLOGRAM_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('Could not create Hologram shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'unknown compiler error';
        gl.deleteShader(shader);throw Error('Hologram original GLSL compilation failed: '+error);
    }
    return shader;
}
export function createHologramWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,
        preserveDrawingBuffer:true,premultipliedAlpha:false});
    if(!gl)throw Error('Hologram requires WebGL for the original shader');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Hologram original GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const pos=gl.getAttribLocation(program,'position');
    const loc={
        from:gl.getUniformLocation(program,'fromTexture'),
        to:gl.getUniformLocation(program,'toTexture'),
        progress:gl.getUniformLocation(program,'progress'),
        tint:gl.getUniformLocation(program,'tint'),
        background:gl.getUniformLocation(program,'background'),
        scanlines:gl.getUniformLocation(program,'scanlines'),
        jitter:gl.getUniformLocation(program,'jitter'),
        flicker:gl.getUniformLocation(program,'flicker')
    };
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,position,rawOptions={}){
            if(gl.isContextLost())throw Error('Hologram WebGL context was lost');
            const options=normaliseHologramOptions(rawOptions);
            const {width,height}=from;
            if(to.width!==width||to.height!==height)
                throw Error('Hologram source dimensions do not match');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            gl.viewport(0,0,width,height);
            gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
            gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
            for(const [index,source] of [from,to].entries()){
                gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,textures[index]);
                gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
                gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
            }
            gl.uniform1i(loc.from,0);gl.uniform1i(loc.to,1);
            gl.uniform1f(loc.progress,Math.min(1,Math.max(0,Number(position)||0)));
            gl.uniform3fv(loc.tint,new Float32Array(channels(options.tint)));
            gl.uniform4fv(loc.background,new Float32Array([...channels(options.background),options.backgroundAlpha]));
            gl.uniform1f(loc.scanlines,options.scanlines);
            gl.uniform1f(loc.jitter,options.jitter);
            gl.uniform1f(loc.flicker,options.flicker);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('Hologram original GLSL render error '+error);
            return canvas;
        },
        dispose(){
            for(const texture of textures)gl.deleteTexture(texture);
            gl.deleteBuffer(buffer);gl.deleteProgram(program);
            canvas.width=0;canvas.height=0;
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
    };
}
/**
 * Combine correctly processed A + B through the genuine shader.
 * Called only during overlap, before the clip's normal blend pipeline.
 */
export function paintHologram(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('Hologram requires both decoded clip sources');
    const sources=['hologramFromScratch','hologramToScratch'].map(key=>{
        const canvas=renderer[key]??(renderer[key]=document.createElement('canvas'));
        if(canvas.width!==width)canvas.width=width;
        if(canvas.height!==height)canvas.height=height;
        return canvas;
    });
    for(const [index,track] of [fromTrack,toTrack].entries()){
        const ctx=sources[index].getContext('2d');
        ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.filter='none';
        ctx.clearRect(0,0,width,height);
        ctx.globalAlpha=(track.visible===false?0:Math.min(1,Math.max(0,Number(track.opacity??1))))
            *visualFadeOpacity(track,time,{ignoreEnter:index===1});
        applyVisualContext(ctx,track,time,width,height);
        if(track.type==='background'){
            const media=track.media,mw=media.videoWidth||media.naturalWidth||media.width,
                mh=media.videoHeight||media.naturalHeight||media.height;
            if(mw&&mh){const scale=Math.max(width/mw,height/mh),w=mw*scale,h=mh*scale;
                ctx.drawImage(media,(width-w)/2,(height-h)/2,w,h);}
        }else drawContained(ctx,track.media,width,height);
        if(track.type!=='sticker')drawVisualVignette(ctx,track,time,width,height);
        ctx.restore();
    }
    const shader=renderer.hologramWebGL??(renderer.hologramWebGL=createHologramWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.hologram);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
