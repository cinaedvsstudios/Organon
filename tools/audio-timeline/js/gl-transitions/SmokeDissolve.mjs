import { uploadTransitionTexture } from './texture-upload.mjs';
/**
 * #16 SmokeDissolve — original gre/MIT billowing 4-octave fog GLSL.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/SmokeDissolve.glsl
 * Original upstream blob 70e4c6f68d4404dac370d619a5ff4d6998b39c25.
 * Preserves animated fbm billows, light/shadow folds, wispy feathering,
 * directional smoke drift, cover/uncover phases and tint+alpha.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const SMOKE_DISSOLVE_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: Billowing smoke drifts in across the outgoing image, with lit tops, darker folds and wispy edges, and thickens until it covers the frame; as it thins out and drifts away, the incoming image shows through
// Tags: smoke, fog, organic, noise, cover

// @param Direction the smoke drifts toward (it comes in from the opposite side); its length is how far it drifts, in frame heights
uniform vec2 direction; // = vec2(0.5, 0.1)
// @range(1, 8) Size of the billows: more, smaller ones with a larger value
uniform float scale; // = 2.5
// @range(0, 1) How much the smoke rolls in from one side rather than everywhere at once
uniform float spread; // = 0.4
// @range(0.05, 1) Softness of the smoke: wispier, more see-through edges with a larger value
uniform float softness; // = 0.5
// @color Color of the smoke, lit from above
uniform vec4 color; // = vec4(0.86, 0.86, 0.88, 1.0)

float hash12(vec2 v) {
  vec3 v3 = fract(vec3(v.xyx) * 0.1031);
  v3 += dot(v3, v3.yzx + 33.33);
  return fract((v3.x + v3.y) * v3.z);
}

float vnoise(vec2 v) {
  vec2 i = floor(v);
  vec2 f = fract(v);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 v) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(v);
    v = mat2(1.6, 1.2, -1.2, 1.6) * v + 5.3;
    amp *= 0.5;
  }
  return sum / 0.9375;
}

vec4 transition(vec2 uv) {
  float p = progress;
  vec2 pos = (uv - 0.5) * vec2(ratio, 1.0);

  // where along the drift the pixel is: 0 on the side the smoke comes from, 1 on the other
  float len = length(direction);
  vec2 dir = len > 1e-4 ? direction / len : vec2(0.0);
  float ext = 0.5 * (abs(dir.x) * ratio + abs(dir.y)) + 1e-4;
  float along = len > 1e-4 ? 0.5 + 0.5 * dot(pos, dir) / ext : 0.5;

  // the smoke rolls in (until 0.45), covers the whole frame, then thins out (from 0.55),
  // each side of the frame in turn
  float arrive = (p / 0.45) * (1.0 + spread) - spread * along;
  float leave = ((p - 0.55) / 0.45) * (1.0 + spread) - spread * along;
  float body = smoothstep(0.0, 1.0, arrive) * (1.0 - smoothstep(0.0, 1.0, leave));
  // the images switch while the smoke is fully dense everywhere
  float m = smoothstep(0.48, 0.52, p);
  if (body <= 0.0) return m < 0.5 ? getFromColor(uv) : getToColor(uv);

  vec2 q = (pos - direction * (p - 0.5)) * scale;
  vec2 churn = vec2(0.5 * p, -0.35 * p);
  vec2 warp = vec2(fbm(q + vec2(3.1, 1.7) + churn), fbm(q + vec2(8.3, 2.8) - churn));
  vec2 w = q + 1.1 * (warp - 0.5);
  float n = fbm(w);
  // the billows catch the light from above: brighter where the smoke rises toward it
  // (on the coarse octave only, which shapes them)
  float lit = 0.53 * (vnoise(w) - vnoise(w + vec2(0.0, 0.2)));
  float wisp = vnoise(w * 3.3 - 2.0 * churn) - 0.5;

  float edge = 2.0 * body - (1.0 - smoothstep(0.1, 0.6, n)) + 1.6 * body * (1.0 - body) * wisp;
  float d = smoothstep(0.0, softness, edge) * mix(0.5, 1.0, smoothstep(0.2, 0.9, body));

  vec4 base;
  if (m <= 0.0) base = getFromColor(uv);
  else if (m >= 1.0) base = getToColor(uv);
  else {
    vec4 a = getFromColor(uv);
    vec4 b = getToColor(uv);
    base = mix(vec4(a.rgb * a.a, a.a), vec4(b.rgb * b.a, b.a), m);
    base = base.a > 0.0 ? vec4(base.rgb / base.a, base.a) : vec4(0.0);
  }
  if (d <= 0.0) return base;

  float shade = 0.92 + 1.3 * lit;
  shade *= mix(0.76, 1.04, smoothstep(0.25, 0.75, n));
  shade = mix(1.0, shade, 0.3 + 0.7 * d);
  vec3 smoke = clamp(color.rgb * shade, 0.0, 1.0);

  // the smoke color mixes as straight RGBA, like every fill color
  return mix(base, vec4(smoke, color.a), d);
}
`;
export const SMOKE_DISSOLVE_DEFAULTS = Object.freeze({
    directionX:.5,directionY:.1,scale:2.5,spread:.4,softness:.5,
    color:'#dbdbe0',colorAlpha:1
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
export function normaliseSmokeDissolveOptions(options={}){
    return {
        directionX:bound(options.directionX,-2,2,.5),
        directionY:bound(options.directionY,-2,2,.1),
        scale:bound(options.scale,1,8,2.5),
        spread:bound(options.spread,0,1,.4),
        softness:bound(options.softness,.05,1,.5),
        color:color(options.color,'#dbdbe0'),
        colorAlpha:bound(options.colorAlpha,0,1,1)
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
${SMOKE_DISSOLVE_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('SmokeDissolve failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original SmokeDissolve GLSL compilation failed: '+error);
    }
    return shader;
}
export function createSmokeDissolveWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('SmokeDissolve requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original SmokeDissolve GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'direction','scale','spread','softness','color'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('SmokeDissolve WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('SmokeDissolve input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseSmokeDissolveOptions(rawOptions);
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
            gl.uniform1f(uniforms.scale,opts.scale);
            gl.uniform1f(uniforms.spread,opts.spread);
            gl.uniform1f(uniforms.softness,opts.softness);
            gl.uniform4fv(uniforms.color,new Float32Array([...rgb(opts.color),opts.colorAlpha]));
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('SmokeDissolve original shader GPU draw error '+error);
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
export function paintSmokeDissolve(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('SmokeDissolve requires decoded outgoing and incoming footage');
    const sources=['smokeDissolveFromScratch','smokeDissolveToScratch'].map(key=>{
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
    const shader=renderer.smokeDissolveWebGL??(renderer.smokeDissolveWebGL=createSmokeDissolveWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['smoke-dissolve']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
