import { uploadTransitionTexture } from './texture-upload.mjs';
/**
 * #19 BokehDissolve — original gre/MIT camera-defocus GLSL.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/BokehDissolve.glsl
 * Source blob 0c1956382c6939b91ed61c223f21efa9f95a7c57.
 * Original highlight-weighted 16-sample aperture blur, circular/polygonal
 * lens blades, enlarged glowing highlight discs and refocus on image B.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const BOKEH_DISSOLVE_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The image falls out of focus like a camera lens, its highlights swelling into large bright bokeh discs, and the incoming image sharpens back out of its own bokeh
// Tags: blur, bokeh, lens, dissolve, light

// @range(0.01, 0.15) Radius of the bokeh discs at the peak, in frame heights
uniform float radius; // = 0.05
// @range(0, 9) Number of aperture blades, which shape the discs into polygons (below 3: round)
uniform int blades; // = 0
// @range(0, 1) Brightness above which a pixel is a highlight that swells into a disc
uniform float threshold; // = 0.7
// @range(0, 3) Brightness of the bokeh discs
uniform float intensity; // = 1.0

#define PI 3.141592653589793
const int TAPS = 16;

vec2 mirror(vec2 v) {
  return 1.0 - abs(1.0 - mod(v, 2.0));
}

// a hash of an integer cell, stable across precisions
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float highlight(vec4 c, float t) {
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  // nothing is brighter than white, so a threshold of 1 makes no highlights
  if (t >= 1.0) return 0.0;
  float h = smoothstep(t, 1.0, lum);
  return h * h * c.a;
}

vec4 transition(vec2 uv) {
  float t = 1.0 - abs(2.0 * progress - 1.0);
  float k = t * t * (3.0 - 2.0 * t);
  float w = smoothstep(0.35, 0.65, progress);
  float r = radius * k;
  float boost = 12.0 * intensity * k;

  // fewer than 3 blades: a round aperture
  float n = blades >= 3 ? float(blades) : 0.0;
  float sector = n > 0.0 ? 2.0 * PI / n : 1.0;
  float apothem = cos(0.5 * sector);

  // per-pixel stratification of the taps over the disc, so its edge stays crisp
  vec2 cell = floor(uv * vec2(ratio, 1.0) * 997.0);
  float spin = 2.0 * PI * hash12(cell);
  float jitter = hash12(cell + 17.0);

  // each image is only read while it shows
  bool useFrom = w < 1.0;
  bool useTo = w > 0.0;
  vec4 s0 = vec4(0.0);
  vec4 s1 = vec4(0.0);
  float t0 = 0.0;
  float t1 = 0.0;
  vec3 l0 = vec3(0.0);
  vec3 l1 = vec3(0.0);
  if (useFrom) {
    vec4 c = getFromColor(uv);
    float h = highlight(c, threshold);
    float wt = 1.0 + boost * h;
    s0 = wt * vec4(c.rgb * c.a, c.a);
    t0 = wt;
    l0 = h * c.rgb;
  }
  if (useTo) {
    vec4 c = getToColor(uv);
    float h = highlight(c, threshold);
    float wt = 1.0 + boost * h;
    s1 = wt * vec4(c.rgb * c.a, c.a);
    t1 = wt;
    l1 = h * c.rgb;
  }
  for (int i = 0; i < TAPS; i++) {
    float fi = float(i);
    float a = fi * 2.39996323 + spin;
    float d = sqrt((fi + jitter) / float(TAPS));
    if (n > 0.0) {
      float s = mod(a, sector) - 0.5 * sector;
      d *= apothem / cos(s);
    }
    vec2 st = mirror(uv + r * d * vec2(cos(a) / ratio, sin(a)));
    if (useFrom) {
      vec4 c = getFromColor(st);
      float h = highlight(c, threshold);
      float wt = 1.0 + boost * h;
      s0 += wt * vec4(c.rgb * c.a, c.a);
      t0 += wt;
      l0 += h * c.rgb;
    }
    if (useTo) {
      vec4 c = getToColor(st);
      float h = highlight(c, threshold);
      float wt = 1.0 + boost * h;
      s1 += wt * vec4(c.rgb * c.a, c.a);
      t1 += wt;
      l1 += h * c.rgb;
    }
  }
  vec4 b = mix(useFrom ? s0 / t0 : vec4(0.0), useTo ? s1 / t1 : vec4(0.0), w);
  if (b.a <= 0.0) {
    return vec4(0.0);
  }
  vec3 rgb = b.rgb / b.a;
  // the discs glow: light lifts the color, never the alpha
  vec3 light = mix(l0, l1, w) * (intensity * k * 4.0 / float(TAPS + 1));
  rgb = 1.0 - (1.0 - clamp(rgb, 0.0, 1.0)) * exp(-light);
  return vec4(rgb, b.a);
}
`;
export const BOKEH_DISSOLVE_DEFAULTS = Object.freeze({
    radius:.05,blades:0,threshold:.7,intensity:1
});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
export function normaliseBokehDissolveOptions(options={}){
    return {
        radius:bound(options.radius,.01,.15,.05),
        blades:Math.round(bound(options.blades,0,9,0)),
        threshold:bound(options.threshold,0,1,.7),
        intensity:bound(options.intensity,0,3,1)
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
${BOKEH_DISSOLVE_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('BokehDissolve failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original BokehDissolve GLSL compilation failed: '+error);
    }
    return shader;
}
export function createBokehDissolveWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('BokehDissolve requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original BokehDissolve GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'radius','blades','threshold','intensity'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('BokehDissolve WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('BokehDissolve input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseBokehDissolveOptions(rawOptions);
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
            gl.uniform1f(uniforms.radius,opts.radius);
            gl.uniform1i(uniforms.blades,opts.blades);
            gl.uniform1f(uniforms.threshold,opts.threshold);
            gl.uniform1f(uniforms.intensity,opts.intensity);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('BokehDissolve original shader GPU draw error '+error);
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
export function paintBokehDissolve(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('BokehDissolve requires decoded outgoing and incoming footage');
    const sources=['bokehDissolveFromScratch','bokehDissolveToScratch'].map(key=>{
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
    const shader=renderer.bokehDissolveWebGL??(renderer.bokehDissolveWebGL=createBokehDissolveWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['bokeh-dissolve']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
