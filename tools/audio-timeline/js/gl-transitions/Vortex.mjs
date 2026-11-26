import { uploadTransitionTexture } from './texture-upload.mjs';
/**
 * Pinned upstream original GLSL git blob dd0b3f76a8ec3e941e9db79d4f6282a75c3282bd; source commit deeebdee7581cdfe924ed9cf104ea2fd10e63155.
 * #04 Vortex: unmodified original gre/MIT GL Transitions shader.
 * https://github.com/gl-transitions/gl-transitions/blob/deeebdee7581cdfe924ed9cf104ea2fd10e63155/transitions/Vortex.glsl
 * The original 24 waves, per-square 3x3 inverse search, displacement,
 * tumble, anti-aliasing and premultiplied blending are kept intact.
 * Wrapper only provides original GLSL uniforms and two input textures.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const VORTEX_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The outgoing image breaks into hundreds of small squares that a tornado carries away along a spiral around the center, from the eye outward, uncovering the incoming image
// Tags: tiles, spiral, rotation, shatter

// @range(4, 40, 1) Number of rows of squares
uniform int grid; // = 24
// Center of the tornado
uniform vec2 center; // = vec2(0.5, 0.5)
// @range(-4, 4) Turns each square makes around the center as it flies away (negative turns clockwise)
uniform float spin; // = 1.0
// @range(0, 1) How randomly the squares leave: 0 from the center outward, 1 in any order
uniform float randomness; // = 0.2

// the squares leave in GROUPS waves, each one flying for DURATION of the transition
const int GROUPS = 24;
const float DURATION = 0.25;
const float AA = 0.0015;
const float TAU = 6.2831853;

float hash(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 78.233))) * 43758.5453);
}

int groupOf(vec2 n, float h, vec2 c, float maxR) {
  float r = min(length((n + 0.5) * h - c) / (0.85 * maxR), 1.0);
  float key = clamp(mix(r * sqrt(r), hash(n), clamp(randomness, 0.0, 1.0)), 0.0, 0.9999);
  return int(floor(key * float(GROUPS)));
}

// local time of a wave's flight, 0 before it leaves, 1 once it has vanished
float flight(int g) {
  float delay = float(g) / float(GROUPS) * (1.0 - DURATION);
  return clamp((progress - delay) / DURATION, 0.0, 1.0);
}

vec4 premultiplied(vec4 c) {
  return vec4(c.rgb * c.a, c.a);
}

vec4 transition(vec2 uv) {
  vec2 aspect = vec2(ratio, 1.0);
  vec2 p = uv * aspect;
  vec2 c = center * aspect;
  float maxR = max(max(length(c), length(c - vec2(ratio, 0.0))), max(length(c - vec2(0.0, 1.0)), length(c - aspect)));
  float h = 1.0 / float(grid < 1 ? 1 : grid);
  float reach = 0.7 * maxR;

  vec2 n0 = floor(p / h);
  // (it shows once the square above it has started to move away, so their edges never let it through at rest)
  float k = smoothstep(0.0, 0.05, flight(groupOf(n0, h, c, maxR)));
  vec4 col = k <= 0.0 ? premultiplied(getFromColor(uv)) : k >= 1.0 ? premultiplied(getToColor(uv)) : mix(premultiplied(getFromColor(uv)), premultiplied(getToColor(uv)), k);

  // the flying squares, painted from the last wave to leave (lowest) to the first (highest)
  for (int k = 0; k < GROUPS; k++) {
    int g = GROUPS - 1 - k;
    float s = flight(g);
    if (s <= 0.0 || s >= 1.0) continue;
    float e = s * s;
    // like in a tornado, the squares near the eye (the first to leave) spin much faster than
    // the outer ones; all of them orbit before they are flung out
    float angle = spin * TAU * e * 2.0 / (1.0 + 6.0 * float(g) / float(GROUPS));
    float push = reach * e * s;
    float size = (1.0 + 0.35 * sin(3.1415927 * s)) * (1.0 - s * s * s);
    float ca = cos(angle);
    float sa = sin(angle);
    mat2 rot = mat2(ca, sa, -sa, ca);
    // undo the wave's spiral to guess which square lands here, then test its neighbors exactly
    vec2 u = (p - c) * rot;
    float ru = length(u);
    vec2 guess = c + (ru > 0.0 ? u / ru : vec2(0.0)) * max(ru - push, 0.0);
    vec2 ng = floor(guess / h);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 n = ng + vec2(float(i), float(j));
        if (groupOf(n, h, c, maxR) != g) continue;
        vec2 home = (n + 0.5) * h;
        vec2 rel = home - c;
        float rr = length(rel);
        vec2 dir = rr > 0.0 ? rel / rr : vec2(0.0);
        vec2 pos = c + rot * (dir * (rr + push));
        float tumble = angle + (hash(n + 17.0) - 0.5) * 3.0 * e * sign(spin);
        float ct = cos(tumble);
        float st = sin(tumble);
        vec2 d = ((p - pos) * mat2(ct, st, -st, ct)) / max(size, 1e-4);
        float edge = 0.5 * h - max(abs(d.x), abs(d.y));
        float cov = clamp(edge * size / (2.0 * AA) + 0.5, 0.0, 1.0);
        vec2 src = home + d;
        if (cov <= 0.0 || src.x < 0.0 || src.y < 0.0 || src.x > ratio || src.y > 1.0) continue;
        vec4 piece = premultiplied(getFromColor(src / aspect)) * cov;
        col = piece + col * (1.0 - piece.a);
      }
    }
  }
  return col.a > 0.0 ? vec4(col.rgb / col.a, col.a) : vec4(0.0);
}
`;
export const VORTEX_DEFAULTS=Object.freeze({
    grid:24,centerX:0.5,centerY:0.5,spin:1,randomness:0.2
});
const bound=(candidate,min,max,fallback)=>{
    if(candidate===null||candidate===undefined||candidate==='')return fallback;
    const x=Number(candidate);
    return Number.isFinite(x)?Math.max(min,Math.min(max,x)):fallback;
};
export function normaliseVortexOptions(options={}){
    return {
        grid:Math.round(bound(options.grid,4,40,24)),
        centerX:bound(options.centerX,0,1,0.5),
        centerY:bound(options.centerY,0,1,0.5),
        spin:bound(options.spin,-4,4,1),
        randomness:bound(options.randomness,0,1,0.2)
    };
}
const vertexSource=`attribute vec2 position; varying vec2 uv;
void main(){uv=(position+1.0)*.5;gl_Position=vec4(position,0.0,1.0);}`;
const fragmentSource=`precision highp float;
varying vec2 uv;
uniform sampler2D fromTexture;
uniform sampler2D toTexture;
uniform float progress;
uniform float ratio;
vec4 getFromColor(vec2 p){return texture2D(fromTexture,p);}
vec4 getToColor(vec2 p){return texture2D(toTexture,p);}
${VORTEX_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const sh=gl.createShader(type);
    if(!sh)throw Error('Vortex could not allocate shader');
    gl.shaderSource(sh,source);
    gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(sh)||'Unknown GLSL error';
        gl.deleteShader(sh);
        throw Error('Original Vortex GLSL failed compilation: '+error);
    }
    return sh;
}
export function createVortexWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('Vortex requires WebGL to run the original GLSL shader');
    const vs=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fs=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vs);gl.attachShader(program,fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original Vortex GLSL program linking failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const locations=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio','grid','center','spin','randomness'
    ].map(key=>[key,gl.getUniformLocation(program,key)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('Vortex WebGL context lost');
            const {width,height}=from;
            if(to.width!==width||to.height!==height)
                throw Error('Vortex two source frames must have identical dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseVortexOptions(rawOptions);
            gl.viewport(0,0,width,height);
            gl.useProgram(program);
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
            gl.uniform1i(locations.fromTexture,0);
            gl.uniform1i(locations.toTexture,1);
            gl.uniform1f(locations.progress,Math.max(0,Math.min(1,Number(progress)||0)));
            gl.uniform1f(locations.ratio,width/height);
            gl.uniform1i(locations.grid,opts.grid);
            gl.uniform2f(locations.center,opts.centerX,opts.centerY);
            gl.uniform1f(locations.spin,opts.spin);
            gl.uniform1f(locations.randomness,opts.randomness);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)
                throw Error('Original Vortex shader GPU draw failed: '+error);
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
/** Compose the original outgoing and incoming clips into a shader frame once. */
export function paintVortex(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('Vortex requires both decoded visual sources');
    const sources=['vortexFromScratch','vortexToScratch'].map(name=>{
        const canvas=renderer[name]??(renderer[name]=document.createElement('canvas'));
        if(canvas.width!==width)canvas.width=width;
        if(canvas.height!==height)canvas.height=height;
        return canvas;
    });
    for(const [index,track] of [fromTrack,toTrack].entries()){
        const c=sources[index].getContext('2d');
        c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.filter='none';
        c.clearRect(0,0,width,height);
        c.globalAlpha=(track.visible===false?0:Math.max(0,Math.min(1,Number(track.opacity??1))))
            *visualFadeOpacity(track,time,{ignoreEnter:index===1});
        applyVisualContext(c,track,time,width,height);
        if(track.type==='background'){
            const media=track.media,mw=media.videoWidth||media.naturalWidth||media.width,
                mh=media.videoHeight||media.naturalHeight||media.height;
            if(mw&&mh){
                const scale=Math.max(width/mw,height/mh),w=mw*scale,h=mh*scale;
                c.drawImage(media,(width-w)/2,(height-h)/2,w,h);
            }
        }else drawContained(c,track.media,width,height);
        if(track.type!=='sticker')drawVisualVignette(c,track,time,width,height);
        c.restore();
    }
    const gpu=renderer.vortexWebGL??(renderer.vortexWebGL=createVortexWebGLRenderer());
    const frame=gpu.render(sources[0],sources[1],progress,toTrack.transitionParameters?.vortex);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
