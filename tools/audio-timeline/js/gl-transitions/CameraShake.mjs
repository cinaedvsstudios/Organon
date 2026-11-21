/**
 * #15 CameraShake — gre/MIT original violent camera-jolt GLSL.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/CameraShake.glsl
 * Source blob b6fd15dc9c8af8ccd360200870a2575fc160887d.
 * Keeps original random keyed jolts, 10-tap temporal shutter blur,
 * color fringe lag, roll and exactly timed peak A/B exposure switch.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const CAMERA_SHAKE_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The camera jolts violently in random directions, with motion blur and color fringes along each jolt; the cut happens at the peak of the shake, which then settles on the incoming image
// Tags: shake, camera, motion-blur, chromatic, impact

// @range(0, 1) How far the camera jolts (and rolls) at the peak of the shake
uniform float strength; // = 0.5
// @range(4, 32) Number of jolts over the transition
uniform float jolts; // = 12.0
// @range(0, 1) Length of the motion blur along each jolt
uniform float blur; // = 0.5
// @range(0, 1) How far the color channels split apart along each jolt
uniform float split; // = 0.5

const int TAPS = 10;

float hash12(vec2 v) {
  vec3 v3 = fract(vec3(v.xyx) * 0.1031);
  v3 += dot(v3, v3.yzx + 33.33);
  return fract((v3.x + v3.y) * v3.z);
}

vec2 mirror(vec2 v) {
  return 1.0 - abs(1.0 - mod(v, 2.0));
}

// the camera position at jolt key k: offset (x, y) and roll, each in -1..1
vec3 jolt(float k) {
  float a = 2.4 * k + 1.2 * hash12(vec2(k, 11.0));
  float m = 0.55 + 0.45 * hash12(vec2(k, 23.0));
  return vec3(m * cos(a), m * sin(a), 2.0 * hash12(vec2(k, 37.0)) - 1.0);
}

float envelope(float t) {
  float h = clamp(1.6 * (1.0 - abs(2.0 * t - 1.0)), 0.0, 1.0);
  return h * h * (3.0 - 2.0 * h);
}

// the image seen by the camera at time t (in progress units), premultiplied
vec4 shot(vec2 uv, float t, bool incoming) {
  float env = envelope(t);
  // a key every 1/jolts, one of them exactly at the cut
  float s = (t - 0.5) * jolts;
  float k = floor(s);
  float g = 1.0 - (s - k);
  float e = 1.0 - g * g * g;
  vec3 j = mix(jolt(k), jolt(k + 1.0), e) * env;
  float omax = 0.14 * strength * env;
  float rmax = 0.07 * strength * env;
  vec2 off = j.xy * omax;
  float roll = j.z * rmax;
  // zoom in just enough that the frame edges never show, for any offset and roll up to these
  float zoom = (cos(rmax) + sin(rmax) * max(ratio, 1.0 / ratio)) / (1.0 - 2.0 * omax);
  vec2 q = (uv - 0.5) * vec2(ratio, 1.0);
  q = mat2(cos(roll), sin(roll), -sin(roll), cos(roll)) * q / zoom;
  vec2 p = mirror(q / vec2(ratio, 1.0) + 0.5 + off);
  vec4 c = incoming ? getToColor(p) : getFromColor(p);
  return vec4(c.rgb * c.a, c.a);
}

vec4 transition(vec2 uv) {
  float open = envelope(progress);
  float shutter = 0.8 * blur / jolts * open;
  float lag = 0.2 * split / jolts * open;
  vec2 sumR = vec2(0.0);
  vec2 sumG = vec2(0.0);
  vec2 sumB = vec2(0.0);
  float wsum = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float u = (float(i) + 0.5) / float(TAPS) - 0.5;
    float t = progress + u * shutter;
    float w = 1.0 - 1.4 * abs(u);
    // the cut happens during the exposure: the channels of a tap show the same image
    bool incoming = t >= 0.5;
    vec4 r = shot(uv, t + lag, incoming);
    vec4 c = shot(uv, t, incoming);
    vec4 b = shot(uv, t - lag, incoming);
    sumR += w * r.ra;
    sumG += w * c.ga;
    sumB += w * b.ba;
    wsum += w;
  }
  float alpha = (sumR.y + sumG.y + sumB.y) / (3.0 * wsum);
  if (alpha <= 0.0) return vec4(0.0);
  vec3 color = vec3(
    sumR.x / max(sumR.y, 1e-5),
    sumG.x / max(sumG.y, 1e-5),
    sumB.x / max(sumB.y, 1e-5)
  );
  return vec4(color, alpha);
}
`;
export const CAMERA_SHAKE_DEFAULTS = Object.freeze({
    strength:.5,jolts:12,blur:.5,split:.5
});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
export function normaliseCameraShakeOptions(options={}){
    return {
        strength:bound(options.strength,0,1,.5),
        jolts:bound(options.jolts,4,32,12),
        blur:bound(options.blur,0,1,.5),
        split:bound(options.split,0,1,.5)
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
${CAMERA_SHAKE_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('CameraShake failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original CameraShake GLSL compilation failed: '+error);
    }
    return shader;
}
export function createCameraShakeWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('CameraShake requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original CameraShake GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'strength','jolts','blur','split'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('CameraShake WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('CameraShake input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseCameraShakeOptions(rawOptions);
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
            gl.uniform1f(uniforms.jolts,opts.jolts);
            gl.uniform1f(uniforms.blur,opts.blur);
            gl.uniform1f(uniforms.split,opts.split);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('CameraShake original shader GPU draw error '+error);
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
export function paintCameraShake(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('CameraShake requires decoded outgoing and incoming footage');
    const sources=['cameraShakeFromScratch','cameraShakeToScratch'].map(key=>{
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
    const shader=renderer.cameraShakeWebGL??(renderer.cameraShakeWebGL=createCameraShakeWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['camera-shake']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
