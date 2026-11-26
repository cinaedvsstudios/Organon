import { uploadTransitionTexture } from './texture-upload.mjs';
/**
 * #28 PaperTear — byte-for-byte original gre/MIT paper split GLSL.
 * Source: https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/PaperTear.glsl
 * Pinned upstream blob 6794a18eed1e282982af9bbb86e7f869a38f2b7b.
 * Independent paper halves with jagged/fibrous edges, lean and cast shadows.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const PAPER_TEAR_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The outgoing image tears in two along a ragged line, and the halves are pulled apart to reveal the incoming one
// Tags: split, horizontal, shadow

// @range(0, 0.3) How far the tear wanders from the middle, relative to the image height
uniform float roughness; // = 0.12
// @range(0, 0.5) How much the top of each half leans away first, so that the tear opens from the top
uniform float tilt; // = 0.1
// @range(0, 0.05) Width of the white torn edge, relative to the image height
uniform float rim; // = 0.012
// @color Color of the paper fibers on the torn edges
uniform vec4 paper; // = vec4(1.0, 0.98, 0.94, 1.0)
// @color Color of the shadow cast on the incoming image
uniform vec4 shadow; // = vec4(0.0, 0.0, 0.0, 0.35)

float tri (float x) {
  return abs(fract(x) - 0.5) - 0.25;
}

// horizontal position of the tear at height y: smooth meanders...
float meander (float y) {
  return 0.5 * ratio + roughness * (0.5 * sin(y * 4.7 + 1.3) + 0.25 * sin(y * 11.3 + 4.1));
}

// ...and sharp jags
float tear (float y) {
  return meander(y) + roughness * (0.1 * sin(y * 29.0 + 0.7) + 0.35 * tri(y * 19.0 + sin(y * 7.0)) + 0.12 * tri(y * 47.0 + 0.6 * sin(y * 13.0)));
}

float fibers (float y, float seed) {
  return rim * (0.7 + 0.3 * sin(y * 37.0 + seed) + 0.4 * tri(y * 83.0 + seed));
}

// the left half (or the mirrored right half) slides out, its top leaning away first:
// from a point on screen to the point of the paper (the frame edges stay covered)
vec2 unfold (vec2 q, float away, float lean) {
  return vec2(q.x + away + lean * q.y, q.y);
}

// a torn half over bg; e: distance past the torn edge, limit: how far the fibers reach, aa: edge softness
vec4 torn (vec4 bg, vec4 col, float e, float limit, float aa) {
  vec4 c = vec4(mix(col.rgb, paper.rgb, clamp(0.5 + e / aa, 0.0, 1.0) * paper.a), col.a);
  return mix(bg, c, clamp(0.5 - (e - limit) / aa, 0.0, 1.0));
}

vec4 transition (vec2 uv) {
  float p = progress;
  float away = p * p * (0.5 * ratio + 0.1 + roughness + 2.0 * rim); // far enough to leave the frame
  float lean = tilt * p * (2.0 - p);
  float fiber = smoothstep(0.0, 0.15, p); // no torn edge on the intact image
  float aa = 0.002 * fiber + 1e-6;
  vec2 q = vec2(uv.x * ratio, uv.y);
  vec2 l = unfold(q, away, lean);
  vec2 r = unfold(vec2(ratio - q.x, q.y), away, lean);
  float el = l.x - tear(l.y); // > 0 right of the left half's torn edge
  float er = r.x - (ratio - tear(r.y)); // > 0 left of the right half's torn edge
  vec2 sq = q - vec2(0.01, 0.0);
  float dl = unfold(sq, away, lean).x - meander(sq.y);
  float dr = unfold(vec2(ratio - sq.x, sq.y), away, lean).x - (ratio - meander(sq.y));
  vec4 to = getToColor(uv);
  float sh = shadow.a * (1.0 - smoothstep(-0.02, 0.08, min(dl, dr)));
  vec4 c = vec4(mix(to.rgb, shadow.rgb, sh), to.a);
  if (r.x >= 0.0) {
    c = torn(c, getFromColor(vec2(1.0 - r.x / ratio, r.y)), er, fibers(r.y, 2.0) * 1.5 * fiber, aa);
  }
  if (l.x >= 0.0) {
    c = torn(c, getFromColor(vec2(l.x / ratio, l.y)), el, fibers(l.y, 0.0) * fiber, aa);
  }
  return c;
}
`;
export const PAPER_TEAR_DEFAULTS = Object.freeze({
    roughness:.12,tilt:.1,rim:.012,
    paperColor:'#fffaf0',paperAlpha:1,shadowColor:'#000000',shadowAlpha:.35
});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
const hexColor=(value,fallback)=>{
    const color=String(value||'').trim();
    return /^#[0-9a-f]{6}$/i.test(color)?color.toLowerCase():fallback;
};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function normalisePaperTearOptions(options={}) {
    return {
        roughness:bound(options.roughness,0,.3,.12),
        tilt:bound(options.tilt,0,.5,.1),
        rim:bound(options.rim,0,.05,.012),
        paperColor:hexColor(options.paperColor,'#fffaf0'),
        paperAlpha:bound(options.paperAlpha,0,1,1),
        shadowColor:hexColor(options.shadowColor,'#000000'),
        shadowAlpha:bound(options.shadowAlpha,0,1,.35)
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
${PAPER_TEAR_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('PaperTear failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original PaperTear GLSL compilation failed: '+error);
    }
    return shader;
}
export function createPaperTearWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('PaperTear requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original PaperTear GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'roughness','tilt','rim','paper','shadow'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('PaperTear WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('PaperTear input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normalisePaperTearOptions(rawOptions);
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
            gl.uniform1f(uniforms.roughness,opts.roughness);
            gl.uniform1f(uniforms.tilt,opts.tilt);
            gl.uniform1f(uniforms.rim,opts.rim);
            gl.uniform4fv(uniforms.paper,new Float32Array([...rgb(opts.paperColor),opts.paperAlpha]));
            gl.uniform4fv(uniforms.shadow,new Float32Array([...rgb(opts.shadowColor),opts.shadowAlpha]));
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('PaperTear original shader GPU draw error '+error);
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
export function paintPaperTear(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('PaperTear requires decoded outgoing and incoming footage');
    const sources=['paperTearFromScratch','paperTearToScratch'].map(key=>{
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
    const shader=renderer.paperTearWebGL??(renderer.paperTearWebGL=createPaperTearWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['paper-tear']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
