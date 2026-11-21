/**
 * #24 FilmStrip — original gre/MIT projector-gate film slip GLSL.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/FilmStrip.glsl
 * Original upstream blob 9e99bdb013184758a51bbfdb0d7acaf0dd87a046.
 * Authentic vertical strip feed, sprocket perforations, shrink-to-gate,
 * 16-tap speed blur and projector weave before B settles into the gate.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const FILM_STRIP_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The picture slips like film in a projector gate: it shrinks to show the sprocket holes, the strip runs down with motion blur and a slight weave, then the incoming frame lands in place
// Tags: retro, vertical, motion-blur, film

// @range(1, 6, 1) Number of frames that slip by
uniform int frames; // = 2
// @range(0, 0.4) How much the picture shrinks during the slip, showing the film's edges
uniform float shrink; // = 0.2
// @range(0, 1) Length of the motion blur at full speed
uniform float blur; // = 0.5
// @range(0, 1) Amount of horizontal weave and vertical jitter
uniform float weave; // = 0.5
// @color Color of the film around the pictures and of the line between frames
uniform vec4 filmColor; // = vec4(0.06, 0.05, 0.05, 1.0)
// @color Color of the light through the sprocket holes
uniform vec4 holeColor; // = vec4(0.96, 0.93, 0.85, 1.0)

const float FRAME_LINE = 0.08;
const float HOLES = 4.0;
const int SAMPLES = 16;

float dither(vec2 cell) {
  return fract(52.9829189 * fract(dot(cell, vec2(0.06711056, 0.00583715))));
}

// the film at (x, y): x across it (0 to 1 over the picture), y along it from the start of frame
// number base, in frame heights; holes fades the sprocket holes in
vec4 film(float x, float y, float base, float n, float aa, float holeX, vec2 holeSize, float holes) {
  float pitch = 1.0 + FRAME_LINE;
  float jy = floor(y / pitch);
  float j = base + jy;
  float fy = y - jy * pitch;
  vec4 c = filmColor;
  if (x >= 0.0 && x <= 1.0 && fy <= 1.0) {
    vec2 q = vec2(x, fy);
    c = j < n ? getFromColor(q) : getToColor(q);
  }
  // soft edges for the picture during the slip (none at rest, where it fills the frame)
  float inside = min(min(x, 1.0 - x) * ratio, min(fy, 1.0 - fy));
  c = mix(filmColor, c, clamp(inside / aa + 0.5, 0.0, 1.0));
  float hy = mod(y, pitch / HOLES) - 0.5 * pitch / HOLES;
  float hx = (abs(x - 0.5) - holeX) * ratio;
  vec2 dd = abs(vec2(hx, hy)) - holeSize + 0.3 * holeSize.x;
  float sd = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0) - 0.3 * holeSize.x;
  return mix(c, holeColor, clamp(0.5 - sd / aa, 0.0, 1.0) * holes);
}

vec4 transition(vec2 uv) {
  float n = max(float(frames), 1.0);
  float pitch = 1.0 + FRAME_LINE;
  float p = progress;
  float env = smoothstep(0.0, 0.3, p) * (1.0 - smoothstep(0.7, 1.0, p));
  float k = 1.0 - shrink * env;
  float x0 = clamp((p - 0.15) / 0.7, 0.0, 1.0);
  float slip = x0 * x0 * x0 * (x0 * (x0 * 6.0 - 15.0) + 10.0);
  float speed = 30.0 * x0 * x0 * (1.0 - x0) * (1.0 - x0) / 0.7; // d(slip)/d(progress), up to ~2.7
  float wob = weave * env;
  // (the weave stays within the film's margin)
  float dx = wob * smoothstep(0.0, 0.1, shrink) * (0.006 * sin(p * 47.0) + 0.004 * sin(p * 113.0 + 1.3));
  float dy = wob * 0.012 * sin(p * 71.0 + 0.4) * (1.0 - speed / 2.7);

  float frameSlip = slip * n;
  float base = floor(frameSlip);
  float x = (uv.x - 0.5) / k + 0.5 + dx;
  float y = (uv.y - 0.5) / k + 0.5 + dy + (frameSlip - base) * pitch;
  // anti-aliasing width, in frame heights: none at rest or without margin
  float aa = 0.002 * min(1.0, 10.0 * env) * min(1.0, 20.0 * shrink) + 1e-4;
  float margin = 0.5 * shrink / max(1.0 - shrink, 0.01);
  float holeX = 0.5 + 0.5 * margin;
  vec2 holeSize = vec2(0.28 * margin * ratio, 0.11 * pitch / HOLES);
  float holes = smoothstep(0.0, 0.02, margin);

  // motion blur along the strip, dithered to hide the steps
  float len = blur * 0.06 * speed * n;
  vec4 color = vec4(0.0);
  if (len < 1e-5) {
    color = film(x, y, base, n, aa, holeX, holeSize, holes);
  } else {
    // averaged with premultiplied colors, so transparent parts don't darken the others
    float jitter = dither(floor(uv * vec2(ratio, 1.0) * 540.0));
    for (int i = 0; i < SAMPLES; i++) {
      float t = (float(i) + jitter) / float(SAMPLES) - 0.5;
      vec4 c = film(x, y + t * len, base, n, aa, holeX, holeSize, holes);
      color += vec4(c.rgb * c.a, c.a);
    }
    color /= float(SAMPLES);
    color.rgb = color.a > 0.0 ? color.rgb / color.a : vec3(0.0);
  }
  color.rgb *= 1.0 - 0.08 * wob * (0.5 + 0.5 * sin(p * 157.0));
  return color;
}
`;
export const FILM_STRIP_DEFAULTS = Object.freeze({
    frames:2,shrink:.2,blur:.5,weave:.5,
    filmColor:'#0f0d0d',filmAlpha:1,holeColor:'#f5edda',holeAlpha:1
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
export function normaliseFilmStripOptions(options={}){
    return {
        frames:Math.round(bound(options.frames,1,6,2)),
        shrink:bound(options.shrink,0,.4,.2),
        blur:bound(options.blur,0,1,.5),
        weave:bound(options.weave,0,1,.5),
        filmColor:color(options.filmColor,'#0f0d0d'),
        filmAlpha:bound(options.filmAlpha,0,1,1),
        holeColor:color(options.holeColor,'#f5edda'),
        holeAlpha:bound(options.holeAlpha,0,1,1)
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
${FILM_STRIP_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('FilmStrip failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original FilmStrip GLSL compilation failed: '+error);
    }
    return shader;
}
export function createFilmStripWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('FilmStrip requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original FilmStrip GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'frames','shrink','blur','weave','filmColor','holeColor'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('FilmStrip WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('FilmStrip input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseFilmStripOptions(rawOptions);
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
            gl.uniform1i(uniforms.frames,opts.frames);
            gl.uniform1f(uniforms.shrink,opts.shrink);
            gl.uniform1f(uniforms.blur,opts.blur);
            gl.uniform1f(uniforms.weave,opts.weave);
            gl.uniform4fv(uniforms.filmColor,new Float32Array([...rgb(opts.filmColor),opts.filmAlpha]));
            gl.uniform4fv(uniforms.holeColor,new Float32Array([...rgb(opts.holeColor),opts.holeAlpha]));
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('FilmStrip original shader GPU draw error '+error);
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
export function paintFilmStrip(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('FilmStrip requires decoded outgoing and incoming footage');
    const sources=['filmStripFromScratch','filmStripToScratch'].map(key=>{
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
    const shader=renderer.filmStripWebGL??(renderer.filmStripWebGL=createFilmStripWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['film-strip']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
