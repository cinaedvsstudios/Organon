/**
 * #13 VhsTracking — gre/MIT original rolling tape-tracking/snow GLSL.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/VhsTracking.glsl
 * Original upstream blob 5093133dec4654f72ec692a8fd7905c957ad20dd.
 * Preserves rolling ragged bands, temporal white snow, line jitter and tear,
 * chroma bleed, dropout flash and mid-band source cut.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const VHS_TRACKING_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: Tape-tracking bands of white snow roll down the frame, tearing the lines around them, with smeared color, wobbling lines, a jittering strip at the bottom and a dropout flash, as the incoming image is recorded over the outgoing one under the densest band
// Tags: retro, glitch, noise, tape, scanlines

// @range(1, 4, 1) Number of noise bands rolling down (the first one carries the cut)
uniform int bands; // = 3
// @range(0, 1) Amount of snow and tearing in the bands
uniform float noise; // = 0.6
// @range(0, 1) How far the color smears to the right of the picture
uniform float bleed; // = 0.5
// @range(0, 1) How much the lines wobble sideways
uniform float wobble; // = 0.5

const float LINES = 220.0; // tape lines over the frame height
const float FRAMES = 40.0; // the noise changes this many times over the transition
const float BAND = 0.11;
const float STRIP = 0.06;
const int TAPS = 6;

float hash12(vec2 v) {
  vec3 v3 = fract(vec3(v.xyx) * 0.1031);
  v3 += dot(v3, v3.yzx + 33.33);
  return fract((v3.x + v3.y) * v3.z);
}

vec2 mirror(vec2 v) {
  return 1.0 - abs(1.0 - mod(v, 2.0));
}

// the tape image on the outgoing (or, once re-recorded, incoming) side, premultiplied
vec4 tape(vec2 p, bool fresh) {
  p = mirror(p);
  vec4 c = fresh ? getToColor(p) : getFromColor(p);
  return vec4(c.rgb * c.a, c.a);
}

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

// how dense a band centered at y = c of half height w is on line y, with ragged edges
float bandDensity(float y, float c, float w, float jitter) {
  float d = abs(y - c) / w + 0.35 * jitter;
  return 1.0 - smoothstep(0.0, 1.0, d);
}

vec4 transition(vec2 uv) {
  // the effects build up quickly and settle at the end: exactly 0 at both ends
  float h = clamp(2.5 * (1.0 - abs(2.0 * progress - 1.0)), 0.0, 1.0);
  float env = h * h * (3.0 - 2.0 * h);
  float f = clamp(1.0 - abs(progress - 0.5) / 0.04, 0.0, 1.0);
  float flash = f * f * (3.0 - 2.0 * f);

  float frame = floor(progress * FRAMES);
  float line = floor(uv.y * LINES);
  float jitter = hash12(vec2(line, frame + 7.0)) - 0.5;

  // the main band rolls from above the frame to below it; the incoming image is above it
  float c0 = mix(1.0 + 1.2 * BAND, -1.2 * BAND, progress);
  bool fresh = uv.y > c0 + 0.8 * BAND * jitter;
  float dens = bandDensity(uv.y, c0, BAND, jitter);
  float tear = 1.0 - smoothstep(0.0, 1.0, abs(uv.y - c0) / (2.5 * BAND));
  for (int i = 1; i < 4; i++) {
    if (i < bands) {
      float k = float(i);
      float w = BAND * (0.35 + 0.2 * hash12(vec2(k, 3.0)));
      float speed = 1.3 + 0.9 * k;
      float cy = -w + (1.0 + 2.0 * w) * fract(hash12(vec2(k, 5.0)) - speed * progress);
      dens = max(dens, 0.6 * bandDensity(uv.y, cy, w, jitter));
      tear = max(tear, 0.5 * (1.0 - smoothstep(0.0, 1.0, abs(uv.y - cy) / (2.5 * w))));
    }
  }
  dens *= env;
  tear *= env;

  float rowTear = hash12(vec2(floor(uv.y * LINES * 0.5), frame + 31.0)) - 0.5;
  float dx = wobble * env * (0.006 * sin(uv.y * 7.0 + progress * 23.0) + 0.004 * jitter);
  dx += (0.3 + 0.7 * noise) * tear * 0.18 * rowTear;
  float strip = env * (1.0 - smoothstep(0.0, STRIP, uv.y));
  dx += strip * (0.03 + 0.06 * (1.0 - uv.y / STRIP)) * (0.6 + 0.8 * hash12(vec2(frame, 41.0)));
  vec2 q = vec2(uv.x + dx, uv.y);

  vec4 c = tape(q, fresh);
  if (c.a <= 0.0) return vec4(0.0);
  float len = bleed * (0.02 + 0.05 * dens) * env;
  vec4 avg = c;
  if (len > 0.0) {
    avg = vec4(0.0);
    for (int i = 0; i < TAPS; i++) {
      float u = (float(i) + 0.5) / float(TAPS);
      avg += tape(q - vec2(len * (0.4 + u), 0.0), fresh);
    }
    avg /= float(TAPS);
  }
  vec3 chroma = (avg.rgb - luma(avg.rgb)) / max(avg.a, 1e-5);
  vec3 rgb = luma(c.rgb) + chroma * c.a; // premultiplied by c.a
  rgb = mix(rgb, vec3(luma(rgb)), 0.6 * dens);

  // snow: short white streaks on the tape lines, starting at a random offset on each line so they never line up
  vec2 cell = vec2(floor(uv.x * LINES * 0.3 * ratio + 40.0 * jitter), line);
  float n = hash12(cell + frame * vec2(37.0, 17.0));
  float amount = clamp(noise * max(1.3 * dens, 0.8 * strip) + 0.35 * flash, 0.0, 1.0);
  float snow = amount > 0.0 ? smoothstep(1.0 - amount, 1.0 - 0.6 * amount, n) : 0.0;
  snow *= 0.55 + 0.45 * hash12(cell.yx + frame);
  float g = hash12(vec2(floor(uv.x * LINES * ratio), line) + frame * vec2(13.0, 29.0));
  snow = max(snow, amount > 0.0 ? 0.7 * smoothstep(1.0 - 0.4 * amount, 1.0, g) : 0.0);
  float dark = g < 0.1 * amount ? min(10.0 * amount, 1.0) : 0.0;
  float group = floor(uv.y * LINES / 3.0);
  float drop = step(1.0 - 0.15 * flash, hash12(vec2(group, floor(uv.x * 6.0 + 5.0 * hash12(vec2(group, frame))) + frame * 7.0)));
  rgb *= 1.0 - 0.5 * dark;
  snow *= min(10.0 * amount, 1.0);
  rgb += (clamp(snow + drop + 0.12 * flash, 0.0, 1.0)) * (c.a - rgb);

  return vec4(clamp(rgb / c.a, 0.0, 1.0), c.a);
}
`;
export const VHS_TRACKING_DEFAULTS = Object.freeze({
    bands:3,noise:.6,bleed:.5,wobble:.5
});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
export function normaliseVhsTrackingOptions(options={}){
    return {
        bands:Math.round(bound(options.bands,1,4,3)),
        noise:bound(options.noise,0,1,.6),
        bleed:bound(options.bleed,0,1,.5),
        wobble:bound(options.wobble,0,1,.5)
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
${VHS_TRACKING_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('VhsTracking failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original VhsTracking GLSL compilation failed: '+error);
    }
    return shader;
}
export function createVhsTrackingWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('VhsTracking requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original VhsTracking GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'bands','noise','bleed','wobble'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('VhsTracking WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('VhsTracking input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseVhsTrackingOptions(rawOptions);
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
            gl.uniform1i(uniforms.bands,opts.bands);
            gl.uniform1f(uniforms.noise,opts.noise);
            gl.uniform1f(uniforms.bleed,opts.bleed);
            gl.uniform1f(uniforms.wobble,opts.wobble);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('VhsTracking original shader GPU draw error '+error);
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
export function paintVhsTracking(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('VhsTracking requires decoded outgoing and incoming footage');
    const sources=['vhsTrackingFromScratch','vhsTrackingToScratch'].map(key=>{
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
    const shader=renderer.vhsTrackingWebGL??(renderer.vhsTrackingWebGL=createVhsTrackingWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['vhs-tracking']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
