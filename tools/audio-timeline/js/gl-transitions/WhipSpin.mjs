/**
 * #27 WhipSpin — exact original gre/MIT spin-blur GLSL.
 * Source: https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/WhipSpin.glsl
 * Upstream blob ca5e1cf7c21090fd2b034c661d298d5f028bd8b1.
 * 24-sample angular shutter, chromatic trails and peak zoom.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const WHIP_SPIN_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The camera rolls faster and faster around the center of the frame, streaking the outgoing image in a spin blur, then the incoming one takes over mid-spin and slows to a stop
// Tags: rotate, motion-blur, spin

// @range(-3, 3) Total rotation, in turns, split between the two images (negative turns clockwise)
uniform float turns; // = 1.0
// @range(0, 1) Length of the motion blur along the spin
uniform float blur; // = 0.5
// @range(0, 1) How much the color channels split apart as the spin speeds up
uniform float chroma; // = 0.6
// @range(0, 1) How much the camera zooms in at the fastest point
uniform float zoom; // = 0.25

const float PI = 3.141592653589793;
const int SAMPLES = 24;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 mirror(vec2 v) {
  vec2 m = mod(v, 2.0);
  return mix(m, 2.0 - m, step(1.0, m));
}

// the camera's roll angle at time t: the outgoing image speeds up until the middle,
// then the incoming one, already turning, slows down to rest
float rollAngle(float t) {
  float halfTurn = PI * turns;
  if (t < 0.5) {
    float x = 2.0 * t;
    return halfTurn * x * x * x;
  }
  float x = 2.0 - 2.0 * t;
  return -halfTurn * x * x * x;
}

vec4 transition(vec2 uv) {
  float p = progress;
  float h = 1.0 - abs(2.0 * p - 1.0); // 0 at both ends, 1 at the cut
  float shutter = blur * 0.1 * h;
  float scale = 1.0 + zoom * h * h * h;
  vec2 q = (uv - 0.5) * vec2(ratio, 1.0);
  float jitter = hash(uv * vec2(ratio, 1.0) * 731.0);
  vec3 color = vec3(0.0);
  vec3 weight = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float s = (float(i) + jitter) / float(SAMPLES) - 0.5;
    float t = clamp(p + s * shutter, 0.0, 1.0);
    float a = rollAngle(t);
    float c = cos(a), sn = sin(a);
    vec2 r = vec2(c * q.x + sn * q.y, -sn * q.x + c * q.y) / scale;
    vec2 suv = mirror(r / vec2(ratio, 1.0) + 0.5);
    vec4 col = t < 0.5 ? getFromColor(suv) : getToColor(suv);
    // red trails behind and blue leads along the arc: the channels split with the speed
    vec3 w = max(vec3(1.0 - 4.0 * chroma * s, 1.0, 1.0 + 4.0 * chroma * s), 0.0);
    color += col.rgb * col.a * w;
    weight += col.a * w;
    alpha += col.a;
  }
  return vec4(color / max(weight, vec3(1e-5)), alpha / float(SAMPLES));
}
`;
export const WHIP_SPIN_DEFAULTS = Object.freeze({turns:1,blur:.5,chroma:.6,zoom:.25});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
export function normaliseWhipSpinOptions(options={}) {
    return {
        turns:bound(options.turns,-3,3,1),
        blur:bound(options.blur,0,1,.5),
        chroma:bound(options.chroma,0,1,.6),
        zoom:bound(options.zoom,0,1,.25)
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
${WHIP_SPIN_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('WhipSpin failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original WhipSpin GLSL compilation failed: '+error);
    }
    return shader;
}
export function createWhipSpinWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('WhipSpin requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original WhipSpin GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'turns','blur','chroma','zoom'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('WhipSpin WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('WhipSpin input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseWhipSpinOptions(rawOptions);
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
            gl.uniform1f(uniforms.turns,opts.turns);
            gl.uniform1f(uniforms.blur,opts.blur);
            gl.uniform1f(uniforms.chroma,opts.chroma);
            gl.uniform1f(uniforms.zoom,opts.zoom);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('WhipSpin original shader GPU draw error '+error);
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
export function paintWhipSpin(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('WhipSpin requires decoded outgoing and incoming footage');
    const sources=['whipSpinFromScratch','whipSpinToScratch'].map(key=>{
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
    const shader=renderer.whipSpinWebGL??(renderer.whipSpinWebGL=createWhipSpinWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.whipspin ?? toTrack.transitionParameters?.spin);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
