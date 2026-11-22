/**
 * #38 GlitchFlicker — byte-for-byte original bread/MIT shader from GL Transitions.
 * https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/GlitchFlicker.glsl
 * Pinned upstream blob c0f0e1b5c4ad907c0440a9e28281a6f900353a1e.
 * Non-monotonic frameReveal is intentional (source A flashes back between B hits).
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const GLITCH_FLICKER_SOURCE = String.raw`// Author: bread
// License: MIT
// Description: A flickering glitch with RGB offset, ghosting and scanlines that flashes back to the outgoing image
// Tags: glitch, flicker, chromatic, scanlines
// Drop_Zone_Flicker.glsl
uniform float frameRate;    // = 24.0
uniform float rgbOffset;    // = 0.014
uniform float blockAmount;  // = 0.72
uniform float ghostAmount;  // = 0.62
uniform float redCyan;      // = 0.58
uniform float scanline;     // = 0.075

float sat(float x) {
  return clamp(x, 0.0, 1.0);
}

float hash12(vec2 p) {
  p = fract(p * vec2(443.8975, 397.2973));
  p += dot(p, p.yx + 19.19);
  return fract(p.x * p.y);
}

vec2 safeUv(vec2 uv) {
  return clamp(uv, vec2(0.001), vec2(0.999));
}

// 24fps reference-matched reveal curve.
// Non-monotonic on purpose: the reference flashes back to the old clip.
float frameReveal(float f) {
  if (f < 0.5) return 0.00;
  if (f < 1.5) return 0.28;
  if (f < 2.5) return 0.43;
  if (f < 3.5) return 0.46;
  if (f < 4.5) return 0.38;
  if (f < 5.5) return 0.48;
  if (f < 6.5) return 0.26;
  if (f < 7.5) return 0.10;
  if (f < 8.5) return 0.00;
  if (f < 9.5) return 0.00;
  if (f < 10.5) return 0.30;
  if (f < 11.5) return 0.58;
  if (f < 12.5) return 1.00;
  if (f < 13.5) return 0.70;
  if (f < 14.5) return 0.42;
  if (f < 15.5) return 0.55;
  if (f < 16.5) return 0.72;
  if (f < 17.5) return 0.88;
  if (f < 18.5) return 0.34;
  if (f < 19.5) return 0.48;
  if (f < 20.5) return 0.56;
  if (f < 21.5) return 0.76;
  if (f < 22.5) return 0.93;
  return 1.00;
}

float frameGlitch(float f) {
  if (f < 0.5) return 0.00;
  if (f < 6.5) return 0.92;
  if (f < 10.5) return 0.38;
  if (f < 11.5) return 0.78;
  if (f < 12.5) return 0.12;
  if (f < 17.5) return 0.74;
  if (f < 22.5) return 0.88;
  if (f < 23.5) return 0.28;
  return 0.00;
}

vec4 chromaFrom(vec2 uv, float amt) {
  vec2 o = vec2(amt, 0.0);
  vec4 center = getFromColor(safeUv(uv));
  return vec4(
    getFromColor(safeUv(uv + o)).r,
    center.g,
    getFromColor(safeUv(uv - o)).b,
    center.a
  );
}

vec4 chromaTo(vec2 uv, float amt) {
  vec2 o = vec2(amt, 0.0);
  vec4 center = getToColor(safeUv(uv));
  return vec4(
    getToColor(safeUv(uv - o)).r,
    center.g,
    getToColor(safeUv(uv + o)).b,
    center.a
  );
}

float blockMask(vec2 uv, float f) {
  vec2 big = floor(uv * vec2(4.0, 2.0));
  vec2 small = floor(uv * vec2(8.0, 4.0));

  float wide = step(0.48, hash12(vec2(big.x, f * 1.37)));
  float chunks = step(0.56, hash12(small + vec2(f * 2.11, f * 0.73)));

  float verticalCut = smoothstep(
    -0.035,
    0.035,
    uv.x - mix(0.18, 0.78, hash12(vec2(f, 4.7)))
  );

  return sat(mix(wide, chunks, 0.38) * 0.72 + verticalCut * 0.28);
}

vec4 transition(vec2 uv) {
  float f = floor(progress * frameRate);
  // the 24-step tables are read in step with the frames, whatever frameRate is
  float step24 = f * 24.0 / max(frameRate, 1.0);
  float reveal = frameReveal(step24);
  float glitch = frameGlitch(step24) * (1.0 - smoothstep(0.96, 1.0, progress));

  float rnd = hash12(vec2(f, 9.13));
  vec2 jitter = vec2(
    (rnd - 0.5) * 0.042,
    (hash12(vec2(f, 2.71)) - 0.5) * 0.010
  ) * glitch;

  vec2 fromUv = safeUv(uv + jitter);
  vec2 toUv = safeUv(uv - jitter * 0.55);

  float block = blockMask(uv, f);
  float localReveal = sat(
    reveal +
    (block - 0.5) * blockAmount * glitch +
    (hash12(vec2(f, floor(uv.y * 9.0))) - 0.5) * 0.18 * glitch
  );

  localReveal = smoothstep(0.22, 0.78, localReveal);

  vec4 oldClip = chromaFrom(fromUv, rgbOffset * glitch);
  vec4 newClip = chromaTo(toUv, rgbOffset * glitch);

  vec4 color = mix(oldClip, newClip, localReveal);

  float leftWash = (1.0 - smoothstep(0.10, 0.78, uv.x)) * glitch;
  float cyanWash = smoothstep(0.08, 0.62, uv.x) * (1.0 - smoothstep(0.86, 1.0, uv.x)) * glitch;

  vec3 redGhost = oldClip.rgb * vec3(1.34, 0.42, 0.38);
  vec3 cyanGhost = newClip.rgb * vec3(0.48, 1.12, 1.24);

  color.rgb = mix(color.rgb, redGhost, leftWash * redCyan * 0.42);
  color.rgb = mix(color.rgb, cyanGhost, cyanWash * redCyan * 0.30);

  // Keeps the old circular "drop zone" visible as a translucent flash,
  // especially after the first full new-frame hit.
  float oldReturn = glitch * (1.0 - smoothstep(0.94, 1.0, reveal));
  oldReturn *= 0.18 + 0.52 * (1.0 - abs(localReveal - 0.5) * 2.0);
  color.rgb = mix(color.rgb, oldClip.rgb, oldReturn * ghostAmount);

  float lines = sin((uv.y + f * 0.017) * 1080.0);
  color.rgb += lines * scanline * glitch;

  float exposurePulse = (hash12(vec2(f, 12.4)) - 0.35) * 0.10 * glitch;
  color.rgb += exposurePulse;

  return vec4(sat(color.r), sat(color.g), sat(color.b), color.a);
}
`;
export const GLITCH_FLICKER_DEFAULTS=Object.freeze({
    frameRate:24,rgbOffset:.014,blockAmount:.72,ghostAmount:.62,redCyan:.58,scanline:.075
});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
export const normaliseGlitchFlickerOptions=(options={})=>({
    frameRate:bound(options.frameRate,1,120,24),
    rgbOffset:bound(options.rgbOffset,0,.08,.014),
    blockAmount:bound(options.blockAmount,0,2,.72),
    ghostAmount:bound(options.ghostAmount,0,1,.62),
    redCyan:bound(options.redCyan,0,1,.58),
    scanline:bound(options.scanline,0,.3,.075)
});
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
${GLITCH_FLICKER_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('GlitchFlicker failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original GlitchFlicker GLSL compilation failed: '+error);
    }
    return shader;
}
export function createGlitchFlickerWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('GlitchFlicker requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original GlitchFlicker GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio','frameRate','rgbOffset','blockAmount','ghostAmount','redCyan','scanline'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('GlitchFlicker WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('GlitchFlicker input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
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
            const opts=normaliseGlitchFlickerOptions(rawOptions);
            for(const name of ['frameRate','rgbOffset','blockAmount','ghostAmount','redCyan','scanline'])
                gl.uniform1f(uniforms[name],opts[name]);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('GlitchFlicker original shader GPU draw error '+error);
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
export function paintGlitchFlicker(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('GlitchFlicker requires decoded outgoing and incoming footage');
    const sources=['glitchFlickerFromScratch','glitchFlickerToScratch'].map(key=>{
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
    const shader=renderer.glitchFlickerWebGL??(renderer.glitchFlickerWebGL=createGlitchFlickerWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['glitch-flicker']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
