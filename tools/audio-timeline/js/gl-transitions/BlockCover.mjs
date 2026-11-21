/**
 * #21 BlockCover — original gre/MIT solid tile pop-cover GLSL.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/BlockCover.glsl
 * Original blob 610d197c1846ffd7721757b7e0d12cc764e5b867.
 * Staggered random cell pop-in, slight overshoot, full coverage hold,
 * independent pop-out and opacity/softened solid tile colour.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const BLOCK_COVER_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: Blocks of a solid color pop in at random over the outgoing image until they cover the frame, then pop out in another random order to show the incoming image
// Tags: blocks, grid, squares, color, cover

// @range(1, 40, 1) Number of blocks along the longer side of the frame (the blocks stay about square)
uniform int blocks; // = 16
// @color Color of the blocks
uniform vec4 color; // = vec4(0.95, 0.32, 0.26, 1.0)
// @range(0, 1) How much a block overshoots its cell as it pops in
uniform float pop; // = 0.5
// @range(0, 0.5) Softness of the blocks' edges, in blocks
uniform float smoothness; // = 0.03

const float duration = 0.14; // of one block's pop, in progress
const float cut = 0.45; // the frame is fully covered from cut - hold to cut + hold
const float hold = 0.02;

float hash (vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// eases from 0 to 1, a little past 1 (more with a larger c) and back
float backOut (float t, float c) {
  float u = t - 1.0;
  return 1.0 + (c + 1.0) * u * u * u + c * u * u;
}

// when a cell's block starts to pop in (.x) and to pop out (.y)
vec2 timing (vec2 cell) {
  return vec2(
    (cut - hold - duration) * hash(cell + 0.5),
    cut + hold + (1.0 - cut - hold - duration) * hash(cell + 71.7));
}

float blockScale (vec2 cell, float c) {
  vec2 t = timing(cell);
  float a = clamp((progress - t.x) / duration, 0.0, 1.0);
  float b = clamp((progress - t.y) / duration, 0.0, 1.0);
  return b > 0.0 ? (1.0 - b) * (1.0 - b) : backOut(a, c);
}

float coverage (vec2 q, vec2 cell, float s, float sm) {
  // at scale 1, its solid part fills the whole cell, so that a covered frame shows no seams
  float h = s * (0.5 + sm);
  vec2 d = abs(q - cell - 0.5);
  return s > 0.0 ? 1.0 - smoothstep(h - sm, h, max(d.x, d.y)) : 0.0;
}

vec4 transition (vec2 uv) {
  float nLong = max(float(blocks), 1.0);
  vec2 n = ratio >= 1.0
    ? vec2(nLong, max(1.0, floor(nLong / ratio + 0.5)))
    : vec2(max(1.0, floor(nLong * ratio + 0.5)), nLong);
  vec2 q = uv * n;
  vec2 cell = floor(q);
  float sm = max(smoothness, 0.001);
  float c = 2.0 * clamp(pop, 0.0, 1.0);
  float s = blockScale(cell, c);
  if (s >= 1.0) return color;
  float cover = coverage(q, cell, s, sm);
  // a neighbour's block can overshoot onto this cell, near its border only
  float u = -2.0 * c / (3.0 * (c + 1.0));
  float reach = backOut(1.0 + u, c) * (0.5 + sm);
  vec2 o = abs(q - cell - 0.5);
  if (max(o.x, o.y) > 1.0 - reach) {
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 nb = cell + vec2(float(i), float(j));
        vec2 inside = step(vec2(0.0), nb) * step(nb, n - 1.0);
        if (inside.x * inside.y > 0.0 && (i != 0 || j != 0)) {
          cover = max(cover, coverage(q, nb, blockScale(nb, c), sm));
        }
      }
    }
  }
  vec2 t = timing(cell);
  vec4 under = progress < 0.5 * (t.x + duration + t.y) ? getFromColor(uv) : getToColor(uv);
  return mix(under, color, cover);
}
`;
export const BLOCK_COVER_DEFAULTS = Object.freeze({
    blocks:16,color:'#f25242',colorAlpha:1,pop:.5,smoothness:.03
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
export function normaliseBlockCoverOptions(options={}){
    return {
        blocks:Math.round(bound(options.blocks,1,40,16)),
        color:color(options.color,'#f25242'),
        colorAlpha:bound(options.colorAlpha,0,1,1),
        pop:bound(options.pop,0,1,.5),
        smoothness:bound(options.smoothness,0,.5,.03)
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
${BLOCK_COVER_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('BlockCover failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original BlockCover GLSL compilation failed: '+error);
    }
    return shader;
}
export function createBlockCoverWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('BlockCover requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original BlockCover GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'blocks','color','pop','smoothness'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('BlockCover WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('BlockCover input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseBlockCoverOptions(rawOptions);
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
            gl.uniform1i(uniforms.blocks,opts.blocks);
            gl.uniform4fv(uniforms.color,new Float32Array([...rgb(opts.color),opts.colorAlpha]));
            gl.uniform1f(uniforms.pop,opts.pop);
            gl.uniform1f(uniforms.smoothness,opts.smoothness);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('BlockCover original shader GPU draw error '+error);
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
export function paintBlockCover(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('BlockCover requires decoded outgoing and incoming footage');
    const sources=['blockCoverFromScratch','blockCoverToScratch'].map(key=>{
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
    const shader=renderer.blockCoverWebGL??(renderer.blockCoverWebGL=createBlockCoverWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['block-cover']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
