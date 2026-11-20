/**
 * Verified source for GL Transitions SpiralBlockWipe.
 * Upstream https://github.com/gl-transitions/gl-transitions/blob/deeebdee7581cdfe924ed9cf104ea2fd10e63155/transitions/SpiralBlockWipe.glsl
 * Original author: gre; license: MIT. Shader below is verbatim; wrapper only
 * supplies transition inputs/textures and the conventional fragment entry point.
 * This is the first fidelity replacement of 41 selected transitions.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const SPIRAL_BLOCK_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: Square blocks switch to the incoming image one after another along a rectangular spiral, from the border inward or from the center outward
// Tags: wipe, grid, blocks, spiral

// @param Number of blocks (columns, rows)
uniform ivec2 grid; // = ivec2(8, 6)
// @param Spiral from the top left corner inward; false spirals from the center outward, ending at the top left corner
uniform bool inward; // = true
// @param Turn clockwise; false turns counterclockwise
uniform bool clockwise; // = true
// @range(0, 0.5) Duration of each block's fade, as a fraction of the transition
uniform float smoothness; // = 0.05

// Position of the cell c (from the top left corner) along the spiral that runs clockwise
// from the top left corner of a n.x by n.y grid inward, from 0 to n.x * n.y - 1
float spiralIndex(vec2 c, vec2 n) {
  // ring: distance to the border, in cells
  float k = min(min(c.x, c.y), min(n.x - 1.0 - c.x, n.y - 1.0 - c.y));
  vec2 s = n - 2.0 * k;
  vec2 l = c - k;
  float before = n.x * n.y - s.x * s.y;
  float along;
  if (l.y == 0.0) along = l.x; // top side, to the right
  else if (l.x == s.x - 1.0) along = s.x - 1.0 + l.y; // right side, down
  else if (l.y == s.y - 1.0) along = 2.0 * s.x + s.y - 3.0 - l.x; // bottom side, to the left
  else along = 2.0 * (s.x - 1.0) + 2.0 * (s.y - 1.0) - l.y; // left side, up
  return before + along;
}

vec4 transition(vec2 uv) {
  vec2 n = max(vec2(grid), vec2(1.0));
  vec2 c = min(floor(vec2(uv.x, 1.0 - uv.y) * n), n - 1.0);
  // the transposed spiral turns the other way from the same corner; walking the spiral
  // outward reverses it too
  if (clockwise != inward) {
    c = c.yx;
    n = n.yx;
  }
  float count = n.x * n.y;
  float i = spiralIndex(c, n);
  if (!inward) i = count - 1.0 - i;

  // the blocks switch one after another, each one fading in over w blocks of time, the first
  // fade starting at 0 and the last ending at 1; without fade, block i switches at (i + 0.5) / count
  float w = max(smoothness, 0.0) * count;
  float o = max(0.5 * (1.0 - w), 0.0);
  float x = progress * (count - 1.0 + 2.0 * o + w) - i - o;
  float m = w > 0.0 ? smoothstep(0.0, w, x) : step(0.0, x);

  if (m <= 0.0) return getFromColor(uv);
  if (m >= 1.0) return getToColor(uv);
  vec4 a = getFromColor(uv);
  vec4 b = getToColor(uv);
  // mixed premultiplied, so transparent images do not bleed their color
  vec4 col = mix(vec4(a.rgb * a.a, a.a), vec4(b.rgb * b.a, b.a), m);
  return col.a > 0.0 ? vec4(col.rgb / col.a, col.a) : vec4(0.0);
}
`;
export const SPIRAL_BLOCK_DEFAULTS=Object.freeze({columns:8,rows:6,inward:true,clockwise:true,smoothness:0.05});
const bounded=(n,min,max,otherwise)=>Number.isFinite(Number(n))?Math.min(max,Math.max(min,Number(n))):otherwise;
export function normaliseSpiralBlockOptions(options={}) {
    return {
        columns:Math.round(bounded(options.columns,1,64,8)),
        rows:Math.round(bounded(options.rows,1,64,6)),
        inward:options.inward!==false,
        clockwise:options.clockwise!==false,
        smoothness:bounded(options.smoothness,0,0.5,0.05)
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
${SPIRAL_BLOCK_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source) {
    const shader=gl.createShader(type);
    if(!shader)throw Error('Could not create GL transition shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'unknown GLSL compiler error';
        gl.deleteShader(shader);throw Error('SpiralBlockWipe GLSL compile failed: '+error);
    }
    return shader;
}
export function createSpiralBlockWebGLRenderer() {
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,
        preserveDrawingBuffer:true,premultipliedAlpha:false});
    if(!gl)throw Error('SpiralBlockWipe requires WebGL: the actual GL shader cannot run in this browser');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('SpiralBlockWipe GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(), textures=[gl.createTexture(),gl.createTexture()];
    const pos=gl.getAttribLocation(program,'position');
    const locations={
        from:gl.getUniformLocation(program,'fromTexture'),
        to:gl.getUniformLocation(program,'toTexture'),
        progress:gl.getUniformLocation(program,'progress'),
        grid:gl.getUniformLocation(program,'grid'),
        inward:gl.getUniformLocation(program,'inward'),
        clockwise:gl.getUniformLocation(program,'clockwise'),
        smoothness:gl.getUniformLocation(program,'smoothness')
    };
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,position,rawOptions={}) {
            if(gl.isContextLost())throw Error('SpiralBlockWipe WebGL context was lost');
            const {columns,rows,inward,clockwise,smoothness}=normaliseSpiralBlockOptions(rawOptions);
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)throw Error('GL transition source sizes do not match');
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
            gl.uniform1i(locations.from,0);gl.uniform1i(locations.to,1);
            gl.uniform1f(locations.progress,Math.min(1,Math.max(0,Number(position)||0)));
            gl.uniform2i(locations.grid,columns,rows);
            gl.uniform1i(locations.inward,inward?1:0);
            gl.uniform1i(locations.clockwise,clockwise?1:0);
            gl.uniform1f(locations.smoothness,smoothness);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('SpiralBlockWipe WebGL rendering error '+error);
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

/** Render both actual sources through original shader and composite the result
 * in one operation. Engine excludes the outgoing track only while the shader
 * transition is active, avoiding double alpha on transparent source footage.
 */
export function paintSpiralBlockWipe(renderer,context,toTrack,width,height,time,drawContained,progress) {
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)throw Error('SpiralBlockWipe requires both decoded clip sources');
    const sourceCanvases=['spiralBlockFromScratch','spiralBlockToScratch'].map(key=>{
        const canvas=renderer[key]??(renderer[key]=document.createElement('canvas'));
        if(canvas.width!==width)canvas.width=width;
        if(canvas.height!==height)canvas.height=height;
        return canvas;
    });
    for(const [i,track] of [fromTrack,toTrack].entries()){
        const c=sourceCanvases[i].getContext('2d');
        c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.filter='none';
        c.clearRect(0,0,width,height);
        c.globalAlpha=(track.visible===false?0:Math.min(1,Math.max(0,Number(track.opacity??1))))
            *visualFadeOpacity(track,time,{ignoreEnter:i===1});
        applyVisualContext(c,track,time,width,height);
        if(track.type==='background'){
            const media=track.media,mw=media.videoWidth||media.naturalWidth||media.width,
                mh=media.videoHeight||media.naturalHeight||media.height;
            if(mw&&mh){const scale=Math.max(width/mw,height/mh),w=mw*scale,h=mh*scale;
                c.drawImage(media,(width-w)/2,(height-h)/2,w,h);}
        }else drawContained(c,track.media,width,height);
        if(track.type!=='sticker')drawVisualVignette(c,track,time,width,height);
        c.restore();
    }
    const gpu=renderer.spiralBlockWebGL??(renderer.spiralBlockWebGL=createSpiralBlockWebGLRenderer());
    const frame=gpu.render(sourceCanvases[0],sourceCanvases[1],progress,toTrack.transitionParameters?.spiralblockwipe);
    context.save();
    context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
