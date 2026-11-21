/**
 * #22 Disintegrate — original gre/MIT directional source-dust GLSL.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/Disintegrate.glsl
 * Source blob a669fffd951dd576a619be088d66dde9eae94e65.
 * Reconstructs 35 candidate granular dust particles per pixel on moving
 * release wave, gust turbulence and fading in their individual trajectories.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const DISINTEGRATE_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The outgoing image crumbles into fine dust from one side, its grains blown away by the wind and fading out, revealing the incoming image underneath
// Tags: particles, dust, wind, directional

// @range(0.0075, 0.03) Size of the dust grains, in frame heights
uniform float particleSize; // = 0.008
// @param Direction in which the wind blows the dust
uniform vec2 direction; // = vec2(1.0, -0.15)
// @range(0, 1) How far the dust flies and scatters before it fades out
uniform float spread; // = 0.75

// the grains a pixel looks back to, along the wind: every grain up to 16 cells away,
// one in 2 up to 32 cells, one in 4 up to 64 cells (only those stay visible that far,
// so the dust thins out as it flies): 35 candidates, without unrolling a long loop
const int NEAR = 17;
const int CANDIDATES = 35;
const float LIFE = 0.45;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return 2.0 * mix(mix(a, b, f.x), mix(c, d, f.x), f.y) - 1.0;
}

// the grains' sideways drift, in gusts along the wind, between -1 and 1: it depends only
// on where a grain comes from along the wind, so that a pixel knows which row to look in
float gust(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return 2.0 * mix(hash12(vec2(i, 7.0)), hash12(vec2(i + 1.0, 7.0)), f) - 1.0;
}

// when the grain at center (in cells) is released: downwind side first, along a ragged front
float release(vec2 center, float h, float halfLength, float s) {
  float front = 1.0 - (center.x + halfLength) / (2.0 * halfLength) + 0.14 * noise(center * s * 6.0) + 0.08 * (h - 0.5);
  return clamp((front + 0.12) / 1.24, 0.0, 1.0) * (1.0 - LIFE);
}

vec4 transition(vec2 uv) {
  vec2 d = length(direction) > 0.0 ? normalize(direction) : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  vec2 fp = (uv - 0.5) * vec2(ratio, 1.0);
  float s = particleSize;
  vec2 g = vec2(dot(fp, d), dot(fp, n)) / s;
  float halfLength = 0.5 * (ratio * abs(d.x) + abs(d.y)) / s;
  // the longest flight, in cells (at most 60, within the 64 cells looked back to)
  float reach = min(spread * 0.45 / s, 60.0);
  float px = floor(g.x);

  vec2 own = floor(g);
  vec4 under = progress > release(own + 0.5, hash12(own), halfLength, s) ? getToColor(uv) : getFromColor(uv);
  vec2 grainUV = vec2(0.5);
  float cover = 0.0;
  for (int i = 0; i < CANDIDATES; i++) {
    float fi = float(i);
    float cx = px - fi;
    if (i >= NEAR + 9) {
      cx = floor(px / 4.0) * 4.0 - 4.0 * (fi - float(NEAR + 9) + 8.0);
    } else if (i >= NEAR) {
      cx = floor(px / 2.0) * 2.0 - 2.0 * (fi - float(NEAR) + 8.0);
    }
    // how far the grain stays visible (in cells): further when its column is a multiple
    // of 2, and of 4, as far as the pixels look back to
    float visible = mod(cx, 4.0) < 0.5 ? 63.0 : mod(cx, 2.0) < 0.5 ? 31.0 : 15.0;
    float drift = 0.3 * gust(cx * s * 4.0);
    // the row the grain comes from: its sideways drift is known from its column and how
    // far it has flown to get here
    vec2 cell = vec2(cx, floor(g.y - drift * (g.x - cx - 0.5)));
    vec2 center = cell + 0.5;
    vec2 cuv = (center.x * d + center.y * n) * s / vec2(ratio, 1.0) + 0.5;
    if (cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0) continue;
    float h = hash12(cell);
    float t = (progress - release(center, h, halfLength, s)) / LIFE;
    if (t <= 0.0 || t >= 1.0) continue;
    float r2 = fract(h * 13.7);
    float travel = reach * (0.4 + 0.6 * r2) * t * (0.2 + 0.8 * t);
    float crumble = smoothstep(0.0, 0.25, t);
    vec2 pos = center + vec2(travel + (fract(h * 71.1) - 0.5) * 0.3 * crumble, drift * travel);
    vec2 local = abs(g - pos);
    float size = mix(0.5, 0.3 * (1.0 - 0.5 * t) * (0.6 + 0.4 * h), crumble);
    float feather = 0.001 + 0.12 * crumble;
    float a = (1.0 - smoothstep(size - feather, size, max(local.x, local.y))) * (1.0 - smoothstep(0.15, 1.0, t))
      * (1.0 - smoothstep(0.6 * visible, visible, travel));
    if (a > cover) {
      cover = a;
      grainUV = cuv;
    }
  }
  return mix(under, getFromColor(grainUV), cover);
}
`;
export const DISINTEGRATE_DEFAULTS = Object.freeze({
    particleSize:.008,directionX:1,directionY:-.15,spread:.75
});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
export function normaliseDisintegrateOptions(options={}){
    return {
        particleSize:bound(options.particleSize,.0075,.03,.008),
        directionX:bound(options.directionX,-2,2,1),
        directionY:bound(options.directionY,-2,2,-.15),
        spread:bound(options.spread,0,1,.75)
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
${DISINTEGRATE_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('Disintegrate failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original Disintegrate GLSL compilation failed: '+error);
    }
    return shader;
}
export function createDisintegrateWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('Disintegrate requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original Disintegrate GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'particleSize','direction','spread'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('Disintegrate WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('Disintegrate input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseDisintegrateOptions(rawOptions);
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
            gl.uniform1f(uniforms.particleSize,opts.particleSize);
            gl.uniform2f(uniforms.direction,opts.directionX,opts.directionY);
            gl.uniform1f(uniforms.spread,opts.spread);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('Disintegrate original shader GPU draw error '+error);
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
export function paintDisintegrate(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('Disintegrate requires decoded outgoing and incoming footage');
    const sources=['disintegrateFromScratch','disintegrateToScratch'].map(key=>{
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
    const shader=renderer.disintegrateWebGL??(renderer.disintegrateWebGL=createDisintegrateWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.disintegrate);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
