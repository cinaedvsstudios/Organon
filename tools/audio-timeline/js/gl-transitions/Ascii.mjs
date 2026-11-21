/**
 * #23 Ascii — original gre/MIT luminance-derived text glyph GLSL.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/Ascii.glsl
 * Original blob 9364500f073cae85702f0963165132eb67dfb328.
 * Full GPU text-mode raster with 10 glyph luminance density levels, per-cell
 * scrambling, source tint/ink/background and fading back into image B.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const ASCII_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The image turns into text-mode characters, denser where it is brighter, the characters scramble into those of the incoming image, then resolve back into it
// Tags: text, pattern, retro, digital

// @range(0.01, 0.1) Height of a character, in frame heights
uniform float cellSize; // = 0.04
// @param Color the characters with the image (otherwise, with the ink color)
uniform bool colored; // = true
// @color Color of the characters when they are not colored with the image
uniform vec4 ink; // = vec4(0.3, 1.0, 0.45, 1.0)
// @color Color behind the characters
uniform vec4 background; // = vec4(0.0, 0.0, 0.0, 1.0)

// width of a character cell, in cell heights
const float ASPECT = 0.6;
const float STROKE = 0.05;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float segment(vec2 q, vec2 a, vec2 b) {
  vec2 pa = q - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// distance to the strokes of the character of density g, 0 (" ") to 9 ("@"), q in cell heights from its center
float glyph(float g, vec2 q) {
  if (g < 0.5) return 1.0; // " "
  if (g < 1.5) return length(q - vec2(0.0, -0.27)) - 0.035; // "."
  if (g < 2.5) return min(length(q - vec2(0.0, -0.25)), length(q - vec2(0.0, 0.1))) - 0.035; // ":"
  if (g < 3.5) return segment(q, vec2(-0.17, 0.0), vec2(0.17, 0.0)) - STROKE; // "-"
  if (g < 4.5) { // "="
    return min(segment(q, vec2(-0.18, 0.1), vec2(0.18, 0.1)), segment(q, vec2(-0.18, -0.1), vec2(0.18, -0.1))) - STROKE;
  }
  if (g < 5.5) { // "+"
    return min(segment(q, vec2(-0.19, 0.0), vec2(0.19, 0.0)), segment(q, vec2(0.0, -0.19), vec2(0.0, 0.19))) - STROKE;
  }
  if (g < 6.5) { // "*"
    float d = segment(q, vec2(0.0, -0.2), vec2(0.0, 0.2));
    d = min(d, segment(q, vec2(-0.18, -0.11), vec2(0.18, 0.11)));
    d = min(d, segment(q, vec2(-0.18, 0.11), vec2(0.18, -0.11)));
    return d - STROKE;
  }
  if (g < 7.5) { // "#"
    float d = min(segment(q, vec2(-0.06, -0.3), vec2(-0.1, 0.3)), segment(q, vec2(0.12, -0.3), vec2(0.08, 0.3)));
    d = min(d, min(segment(q, vec2(-0.24, 0.11), vec2(0.24, 0.11)), segment(q, vec2(-0.24, -0.11), vec2(0.24, -0.11))));
    return d - STROKE;
  }
  if (g < 8.5) { // "%"
    float d = segment(q, vec2(-0.2, -0.3), vec2(0.2, 0.3));
    d = min(d, abs(length(q - vec2(-0.13, 0.19)) - 0.08));
    d = min(d, abs(length(q - vec2(0.13, -0.19)) - 0.08));
    return d - STROKE;
  }
  // "@": a ring around a small "a"
  float d = abs(length(q) - 0.25);
  d = min(d, abs(length(q - vec2(-0.02, 0.0)) - 0.1));
  d = min(d, segment(q, vec2(0.08, 0.1), vec2(0.08, -0.12)));
  return d - 0.8 * STROKE;
}

float density(vec4 c) {
  return floor(pow(clamp(dot(c.rgb, vec3(0.299, 0.587, 0.114)) * c.a, 0.0, 1.0), 0.75) * 9.99);
}

vec4 cellColor(vec2 center, vec2 dims, bool incoming) {
  vec4 c = vec4(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 o = (vec2(mod(float(i), 2.0), floor(float(i) / 2.0)) - 0.5) * 0.5 * dims;
    vec2 st = clamp((center + o) / vec2(ratio, 1.0) + 0.5, 0.0, 1.0);
    c += incoming ? getToColor(st) : getFromColor(st);
  }
  return c * 0.25;
}

vec4 transition(vec2 uv) {
  float p = progress;
  float h = cellSize;
  vec2 fp = (uv - 0.5) * vec2(ratio, 1.0);
  vec2 dims = vec2(ASPECT * h, h);
  vec2 cell = floor(fp / dims);
  vec2 center = (cell + 0.5) * dims;
  vec2 q = (fp - center) / h;

  float r = hash12(cell + 100.0);
  float at = 0.4 + 0.2 * r;
  bool incoming = p > at;
  vec4 c = cellColor(center, dims, incoming);
  float g = density(c);
  float scramble = 1.0 - smoothstep(0.02, 0.045, abs(p - at));
  if (hash12(cell + floor(p * 40.0) * vec2(17.0, 31.0)) < scramble) {
    g = 1.0 + floor(9.0 * hash12(cell * 1.7 + floor(p * 40.0) * vec2(5.0, 11.0)));
  }

  float cover = 1.0 - smoothstep(-0.02, 0.02, glyph(g, q));
  vec3 tint = colored ? mix(c.rgb, c.rgb / max(max(c.r, max(c.g, c.b)), 0.05), 0.7) : ink.rgb;
  float alpha = colored ? c.a : ink.a * c.a;
  vec3 behind = colored ? mix(background.rgb, c.rgb, 0.3) : background.rgb;
  vec4 back = vec4(behind, background.a * c.a);
  vec4 text = mix(back, vec4(clamp(tint, 0.0, 1.0), alpha), cover);

  float into = 0.05 + 0.22 * hash12(cell + 200.0);
  float outof = 0.95 - 0.22 * hash12(cell + 300.0);
  float show = smoothstep(into, into + 0.08, p) * (1.0 - smoothstep(outof - 0.08, outof, p));
  vec4 image = p < 0.5 ? getFromColor(uv) : getToColor(uv);
  return mix(image, text, show);
}
`;
export const ASCII_DEFAULTS = Object.freeze({
    cellSize:.04,colored:true,ink:'#4dff73',inkAlpha:1,
    background:'#000000',backgroundAlpha:1
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
export function normaliseAsciiOptions(options={}){
    return {
        cellSize:bound(options.cellSize,.01,.1,.04),
        colored:options.colored===undefined?true:
            options.colored===true||options.colored===1||options.colored==='true'||options.colored==='1',
        ink:color(options.ink,'#4dff73'),
        inkAlpha:bound(options.inkAlpha,0,1,1),
        background:color(options.background,'#000000'),
        backgroundAlpha:bound(options.backgroundAlpha,0,1,1)
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
${ASCII_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('Ascii failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original Ascii GLSL compilation failed: '+error);
    }
    return shader;
}
export function createAsciiWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('Ascii requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original Ascii GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'cellSize','colored','ink','background'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('Ascii WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('Ascii input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseAsciiOptions(rawOptions);
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
            gl.uniform1f(uniforms.cellSize,opts.cellSize);
            gl.uniform1i(uniforms.colored,opts.colored?1:0);
            gl.uniform4fv(uniforms.ink,new Float32Array([...rgb(opts.ink),opts.inkAlpha]));
            gl.uniform4fv(uniforms.background,new Float32Array([...rgb(opts.background),opts.backgroundAlpha]));
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('Ascii original shader GPU draw error '+error);
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
export function paintAscii(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('Ascii requires decoded outgoing and incoming footage');
    const sources=['asciiFromScratch','asciiToScratch'].map(key=>{
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
    const shader=renderer.asciiWebGL??(renderer.asciiWebGL=createAsciiWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.ascii);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
