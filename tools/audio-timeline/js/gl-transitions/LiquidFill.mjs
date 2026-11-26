import { uploadTransitionTexture } from './texture-upload.mjs';
/**
 * #06 LiquidFill — original gre/MIT GL Transitions sloshing liquid shader.
 * Original upstream: https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/LiquidFill.glsl
 * Original source blob SHA: 19dcbc41dae67269936a85a3920243242daf7030
 * The authored rising surface, directional waves, lighted meniscus,
 * refraction, moving bubbles and premultiplied alpha are preserved verbatim.
 * Wrapper only provides original uniforms and GPU A/B textures.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const LIQUID_FILL_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The incoming image rises over the outgoing one like liquid filling a glass, its surface sloshing in waves, lit by a bright meniscus line, bending the image just below it, with a few bubbles rising through it
// Tags: liquid, water, wave, directional, reveal

// @param Direction the liquid rises toward
uniform vec2 direction; // = vec2(0.0, 1.0)
// @range(0, 0.3) Height of the waves on the surface, in frame heights
uniform float amplitude; // = 0.06
// @range(0.5, 6) Number of waves across the frame
uniform float waves; // = 1.5
// @color Color of the bright line along the surface and the rims of the bubbles (its alpha is its strength)
uniform vec4 highlight; // = vec4(1.0, 1.0, 1.0, 0.8)
// @range(0, 0.1) How much the incoming image is bent just below the surface
uniform float refraction; // = 0.03
// @range(0, 1) How many bubbles rise through the liquid
uniform float bubbles; // = 0.5

const float PI = 3.141592653589793;
const float AA = 0.0015;
const float LINE = 0.006;
const float CELL = 0.08;

float hash (vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// height of the surface above its mean level at x (across the frame, from -1 to 1), between -1 and 1:
// a slosh from side to side and a smaller wave running along it
float surface (float x, float t) {
  float k = PI * max(waves, 0.01);
  return 0.6 * sin(k * x + 0.5 * PI) * cos(2.0 * PI * 1.3 * t)
       + 0.4 * sin(1.7 * k * x - 9.0 * t + 1.3);
}

vec4 transition (vec2 uv) {
  vec4 a = getFromColor(uv);

  vec2 dir = length(direction) > 0.0 ? normalize(direction) : vec2(0.0, 1.0);
  vec2 across = vec2(-dir.y, dir.x);
  // measured in square pixels, so the waves and bubbles are not stretched
  vec2 p = (uv - 0.5) * vec2(ratio, 1.0);
  float e = 0.5 * (abs(dir.x) * ratio + abs(dir.y));
  float w = 0.5 * (abs(dir.y) * ratio + abs(dir.x));
  float d = dot(p, dir);
  float x = dot(p, across);
  float t = progress;
  float stir = sin(PI * t);
  float amp = max(amplitude, 0.0) * (0.35 + 0.65 * stir);
  // the surface starts fully below the frame and ends fully above it, waves and meniscus included
  float margin = max(amplitude, 0.0) + 2.0 * LINE + AA;
  float mean = mix(-e - margin, e + margin, mix(t, t * t * (3.0 - 2.0 * t), 0.5));
  float level = mean + amp * surface(x / w, t);
  // > 0 below the surface, in the liquid
  float depth = level - d;
  float m = smoothstep(-AA, AA, depth);

  float bend = refraction * stir * exp(-max(depth, 0.0) / 0.06);
  vec2 offset = bend * (dir * sin(18.0 * x - 7.0 * t) + across * cos(13.0 * x + 5.0 * t));
  vec4 b = getToColor(clamp(uv + offset / vec2(ratio, 1.0), 0.0, 1.0));

  float glow = 0.0;
  float rise = mean + 0.5 * t;
  vec2 bq = vec2(x, d - rise) / CELL;
  vec2 cell = floor(bq);
  float hs = hash(cell + 7.1);
  float r = (0.12 + 0.18 * hash(cell + 3.7)) * stir;
  float px = AA / CELL;
  if (hs < bubbles * 0.6 && r > px) {
    // placed so that it stays inside its cell, wobble and soft edge included
    vec2 c = cell + 0.5 + (0.42 - r - px) * (vec2(hash(cell + 1.3), hash(cell + 9.4)) * 2.0 - 1.0);
    c.x += 0.08 * sin(6.0 * t + 6.28 * hs);
    float dist = length(bq - c);
    float rim = smoothstep(0.7 * r - px, 0.7 * r + px, dist) * (1.0 - smoothstep(r - px, r + px, dist));
    float glint = 1.0 - smoothstep(0.25 * r - px, 0.25 * r + px, length(bq - c - 0.45 * r * vec2(-0.7, 0.7)));
    glow = max(rim * 0.6, glint) * smoothstep(0.0, 0.05, depth) * stir;
  }
  float line = 1.0 - smoothstep(LINE - AA, LINE + AA, abs(depth - LINE));
  line += 0.35 * stir * exp(-max(depth, 0.0) / 0.03) * m;
  float light = highlight.a * clamp(max(line, glow), 0.0, 1.0) * (0.4 + 0.6 * stir);
  b.rgb = mix(b.rgb, highlight.rgb, light);

  // mixed premultiplied, so transparent images do not bleed their color
  vec4 c = mix(vec4(a.rgb * a.a, a.a), vec4(b.rgb * b.a, b.a), m);
  return c.a > 0.0 ? vec4(c.rgb / c.a, c.a) : vec4(0.0);
}
`;
export const LIQUID_FILL_DEFAULTS = Object.freeze({
    directionX:0,directionY:1,amplitude:0.06,waves:1.5,
    highlightColor:'#ffffff',highlightAlpha:0.8,refraction:0.03,bubbles:0.5
});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
const normalColor=(value,fallback)=>{
    const input=String(value||'').trim();
    return /^#[0-9a-f]{6}$/i.test(input)?input.toLowerCase():fallback;
};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function normaliseLiquidFillOptions(options={}){
    return {
        directionX: bound(options.directionX,-2,2,0),
        directionY: bound(options.directionY,-2,2,1),
        amplitude: bound(options.amplitude,0,.3,.06),
        waves: bound(options.waves,.5,6,1.5),
        highlightColor: normalColor(options.highlightColor,'#ffffff'),
        highlightAlpha: bound(options.highlightAlpha,0,1,.8),
        refraction: bound(options.refraction,0,.1,.03),
        bubbles: bound(options.bubbles,0,1,.5)
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
${LIQUID_FILL_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('LiquidFill failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original LiquidFill GLSL compilation failed: '+error);
    }
    return shader;
}
export function createLiquidFillWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('LiquidFill requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original LiquidFill GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'direction','amplitude','waves','highlight','refraction','bubbles'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('LiquidFill WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('LiquidFill input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseLiquidFillOptions(rawOptions);
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
            gl.uniform2f(uniforms.direction,opts.directionX,opts.directionY);
            gl.uniform1f(uniforms.amplitude,opts.amplitude);
            gl.uniform1f(uniforms.waves,opts.waves);
            gl.uniform4fv(uniforms.highlight,new Float32Array([...rgb(opts.highlightColor),opts.highlightAlpha]));
            gl.uniform1f(uniforms.refraction,opts.refraction);
            gl.uniform1f(uniforms.bubbles,opts.bubbles);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('LiquidFill original shader GPU draw error '+error);
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
export function paintLiquidFill(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('LiquidFill requires decoded outgoing and incoming footage');
    const sources=['liquidFillFromScratch','liquidFillToScratch'].map(key=>{
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
    const shader=renderer.liquidFillWebGL??(renderer.liquidFillWebGL=createLiquidFillWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['liquid-fill']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
