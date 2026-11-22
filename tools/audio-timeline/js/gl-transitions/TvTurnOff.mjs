/**
 * #32 TvTurnOff — original gre/MIT two-way CRT power collapse GLSL.
 * https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/TvTurnOff.glsl
 * Pinned git blob 4a4aeed6f039ac528aa48e9dd818c1592e2d8b07; line collapse, dot, glow, incoming switch-on.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const TV_TURN_OFF_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The outgoing image collapses into a glowing line and a dot, like an old TV turned off, then the incoming image powers on from the dot
// Tags: retro, vertical, flash

// @color Color of the switched-off screen
uniform vec4 color; // = vec4(0.0, 0.0, 0.0, 1.0)
// @range(0, 2) Strength of the glow around the line and the dot
uniform float glow; // = 1.0

vec4 getColor(vec2 uv, bool isFrom) {
  return isFrom ? getFromColor(uv) : getToColor(uv);
}

// The screen at a time t of its power-off: 0 is the full image, 1 is off
vec4 screen(vec2 uv, float t, bool isFrom) {
  float collapse = smoothstep(0.0, 0.4, t); // the image squeezes into a line
  float shrink = smoothstep(0.3, 0.65, t); // the line shrinks into a dot
  float fade = 0.4 * smoothstep(0.75, 1.0, t); // the dot dims
  float radius = 0.01 * (1.0 - fade);
  // half size of the picture, in height units (x is scaled by ratio)
  vec2 size = vec2(mix(0.5 * ratio, radius, shrink), mix(0.5, radius, collapse));
  vec2 p = (uv - 0.5) * vec2(ratio, 1.0);
  vec2 q = clamp(0.5 + 0.5 * p / size, 0.0, 1.0);
  vec4 c = getColor(q, isFrom);
  float white = smoothstep(0.4, 1.0, collapse);
  vec4 light = vec4(mix(min(c.rgb * (1.0 + 2.0 * collapse), 1.0), vec3(1.0), white), c.a);
  // soft edges, outside the picture so that t = 0 is the exact image
  vec2 d = abs(p) - size;
  float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  float inside = clamp(1.0 - dist / 0.004, 0.0, 1.0);
  vec4 mid = getColor(vec2(0.5), isFrom);
  vec4 halo = vec4(mix(mix(mid.rgb, vec3(1.0), 0.7), vec3(1.0, 0.92, 0.8), shrink), mid.a);
  float h = 1.0 - exp(-2.0 * glow * white * exp(-max(dist, 0.0) / (0.02 + 0.04 * shrink)));
  vec4 col = mix(color, halo, h * (1.0 - fade));
  return mix(col, light, inside * (1.0 - fade));
}

vec4 transition(vec2 uv) {
  if (progress < 0.5) {
    return screen(uv, 2.0 * progress, true);
  }
  return screen(uv, 2.0 - 2.0 * progress, false);
}
`;
export const TV_TURN_OFF_DEFAULTS = Object.freeze({color:'#000000',colorAlpha:1,glow:1});
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
export function normaliseTvTurnOffOptions(options={}) {
    return {
        color:hexColor(options.color,'#000000'),
        colorAlpha:bound(options.colorAlpha,0,1,1),
        glow:bound(options.glow,0,2,1)
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
${TV_TURN_OFF_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('TvTurnOff failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original TvTurnOff GLSL compilation failed: '+error);
    }
    return shader;
}
export function createTvTurnOffWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('TvTurnOff requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original TvTurnOff GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'color','glow'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('TvTurnOff WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('TvTurnOff input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseTvTurnOffOptions(rawOptions);
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
            gl.uniform4fv(uniforms.color,new Float32Array([...rgb(opts.color),opts.colorAlpha]));
            gl.uniform1f(uniforms.glow,opts.glow);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('TvTurnOff original shader GPU draw error '+error);
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
export function paintTvTurnOff(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('TvTurnOff requires decoded outgoing and incoming footage');
    const sources=['tvTurnOffFromScratch','tvTurnOffToScratch'].map(key=>{
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
    const shader=renderer.tvTurnOffWebGL??(renderer.tvTurnOffWebGL=createTvTurnOffWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['tv-turn-off']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
