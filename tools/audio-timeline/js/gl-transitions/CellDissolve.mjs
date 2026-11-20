/**
 * CellDissolve (#03): original GL Transitions Voronoi shader by gre, MIT.
 * Upstream: https://github.com/gl-transitions/gl-transitions/blob/deeebdee7581cdfe924ed9cf104ea2fd10e63155/transitions/CellDissolve.glsl
 * Original shader body preserved exactly, including 3x3 sites, 5x5 border
 * search, aspect-ratio corrected cells, independent timings and premultiplied
 * alpha. Only source-texture and engine uniform glue added here.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const CELL_DISSOLVE_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: Irregular cells, like cracked mud or soap foam, switch to the incoming image one by one, with an optional bright border glowing along the cracks between them
// Tags: dissolve, cells, voronoi, random

// @range(1, 40) Number of cells across the height of the frame
uniform float cells; // = 8.0
// @range(0, 1) Duration of each cell's switch, as a fraction of the transition (0: each cell switches at once)
uniform float smoothness; // = 0.1
// @range(0, 0.05) Width of the border along the cell edges, in frame heights (0: no border)
uniform float border; // = 0.006
// @color Color of the border
uniform vec4 borderColor; // = vec4(1.0, 0.95, 0.8, 1.0)
// @param Random seed: another value gives other cells, switching in another order
uniform float seed; // = 0.0

const float AA = 0.0015;

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec4 transition(vec2 uv) {
  vec4 a = getFromColor(uv);
  vec4 b = getToColor(uv);

  float n = max(cells, 1.0);
  // measured in square pixels, so the cells are not stretched
  vec2 p = uv * vec2(ratio, 1.0) * n;
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 offset = vec2(17.31, 41.97) * seed;

  vec2 mg = vec2(0.0);
  vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + hash22(i + g + offset) - f;
      float d = dot(r, r);
      if (d < md) {
        md = d;
        mr = r;
        mg = g;
      }
    }
  }

  // distance to the nearest cell edge: the bisector with the closest neighbor point,
  // searched over 5x5 cells around the nearest one so that no edge is missed
  float edge = 8.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 g = mg + vec2(float(x), float(y));
      vec2 r = g + hash22(i + g + offset) - f;
      vec2 dr = r - mr;
      if (dot(dr, dr) > 0.00001) {
        edge = min(edge, dot(0.5 * (mr + r), normalize(dr)));
      }
    }
  }
  edge /= n;

  float h = hash22(i + mg + offset + 97.13).x;
  float w = clamp(smoothness, 0.0, 1.0);
  float start = h * (1.0 - w);
  float m = w > 0.0 ? smoothstep(start, start + w, progress) : step(start, progress);

  // mixed premultiplied, so transparent images do not bleed their color
  vec4 c = mix(vec4(a.rgb * a.a, a.a), vec4(b.rgb * b.a, b.a), m);

  float open = smoothstep(0.0, 0.2, progress) * (1.0 - smoothstep(0.8, 1.0, progress));
  float bw = max(border, 0.0) * open;
  if (bw > 0.0) {
    float l = 1.0 - smoothstep(0.5 * bw - AA, 0.5 * bw + AA, edge);
    float ba = borderColor.a * l * min(1.0, bw / (2.0 * AA));
    c = vec4(borderColor.rgb * ba, ba) + c * (1.0 - ba);
  }
  return c.a > 0.0 ? vec4(c.rgb / c.a, c.a) : vec4(0.0);
}
`;
export const CELL_DISSOLVE_DEFAULTS=Object.freeze({
    cells:8,smoothness:0.1,border:0.006,borderColor:'#fff2cc',
    borderAlpha:1,seed:0
});
const bounded=(n,min,max,defaultValue)=>Number.isFinite(Number(n))
    ?Math.max(min,Math.min(max,Number(n))):defaultValue;
const hexColor=(candidate,fallback)=>{
    const value=String(candidate||'').trim();
    return /^#[a-f\d]{6}$/i.test(value)?value.toLowerCase():fallback;
};
const channels=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function normaliseCellDissolveOptions(options={}){
    return {
        cells:bounded(options.cells,1,40,8),
        smoothness:bounded(options.smoothness,0,1,.1),
        border:bounded(options.border,0,.05,.006),
        borderColor:hexColor(options.borderColor,'#fff2cc'),
        borderAlpha:bounded(options.borderAlpha,0,1,1),
        seed:bounded(options.seed,-10000,10000,0)
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
${CELL_DISSOLVE_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('Could not create CellDissolve shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('CellDissolve original GLSL compilation failed: '+error);
    }
    return shader;
}
export function createCellDissolveWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,
        preserveDrawingBuffer:true,premultipliedAlpha:false});
    if(!gl)throw Error('CellDissolve requires WebGL to reproduce the original shader');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('CellDissolve shader linking failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const loc=Object.fromEntries(['fromTexture','toTexture','progress','ratio',
        'cells','smoothness','border','borderColor','seed'].map(name=>[
        name,gl.getUniformLocation(program,name)
    ]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('CellDissolve WebGL context was lost');
            const options=normaliseCellDissolveOptions(rawOptions);
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('CellDissolve sources have different resolutions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            gl.viewport(0,0,width,height);
            gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
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
            gl.uniform1i(loc.fromTexture,0);gl.uniform1i(loc.toTexture,1);
            gl.uniform1f(loc.progress,Math.max(0,Math.min(1,Number(progress)||0)));
            gl.uniform1f(loc.ratio,width/height);
            gl.uniform1f(loc.cells,options.cells);
            gl.uniform1f(loc.smoothness,options.smoothness);
            gl.uniform1f(loc.border,options.border);
            gl.uniform4fv(loc.borderColor,new Float32Array([
                ...channels(options.borderColor),options.borderAlpha
            ]));
            gl.uniform1f(loc.seed,options.seed);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('CellDissolve WebGL draw error '+error);
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
/** Render the real A/B sources through the original shader, once per overlap. */
export function paintCellDissolve(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('CellDissolve requires both decoded source clips');
    const sources=['cellDissolveFromScratch','cellDissolveToScratch'].map(name=>{
        const canvas=renderer[name]??(renderer[name]=document.createElement('canvas'));
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
            if(mw&&mh){
                const scale=Math.max(width/mw,height/mh),w=mw*scale,h=mh*scale;
                ctx.drawImage(media,(width-w)/2,(height-h)/2,w,h);
            }
        }else drawContained(ctx,track.media,width,height);
        if(track.type!=='sticker')drawVisualVignette(ctx,track,time,width,height);
        ctx.restore();
    }
    const gpu=renderer.cellDissolveWebGL??(renderer.cellDissolveWebGL=createCellDissolveWebGLRenderer());
    const frame=gpu.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['cell-dissolve']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
