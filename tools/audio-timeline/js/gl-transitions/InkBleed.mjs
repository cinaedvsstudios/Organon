import { uploadTransitionTexture } from './texture-upload.mjs';
/**
 * #25 InkBleed — byte-for-byte original gre/MIT water-ink shader.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/InkBleed.glsl
 * Upstream blob 380831ada1f601cca55db3f5e8b23801fbae088e.
 * Blooming drops, noise-warped curling tendrils, soft haze and dark ink rim.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const INK_BLEED_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The incoming image spreads over the outgoing one like drops of ink in water, blooming from a few points with curling, wispy edges and a darker rim, until it fills the frame
// Tags: ink, organic, fluid, noise

// @range(1, 8, 1) Number of ink drops
uniform float drops; // = 4.0
// @range(0, 1) How far the curling tendrils reach out of the blooms
uniform float tendrils; // = 0.7
// @range(0, 1) How dark the rim of ink at the front of the blooms is
uniform float rim; // = 0.5
// @param Random seed for the drop positions and the swirls
uniform float seed; // = 3.0

float hash (vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise (vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm (vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3;
    a *= 0.5;
  }
  return v / 0.9375;
}

vec2 fold (vec2 p) {
  return 1.0 - abs(1.0 - mod(p, 2.0));
}

vec4 transition (vec2 uv) {
  float p = progress;
  vec2 q = vec2(uv.x * ratio, uv.y);
  vec2 o = vec2(seed * 3.1, seed * 1.7);
  vec2 sq = q * 2.2 + o;
  vec2 w1 = vec2(fbm(sq + vec2(0.0, 0.6 * p)), fbm(sq + vec2(5.2, 1.3) - vec2(0.5 * p, 0.0)));
  vec2 w2 = vec2(fbm(sq + 3.0 * w1 + vec2(1.7, 9.2)), fbm(sq + 3.0 * w1 + vec2(8.3, 2.8)));
  float swirl = fbm(sq * 0.8 + 2.5 * w2) - 0.5;
  vec2 flow = w2 - 0.5;
  float amp = 0.05 + 0.35 * tendrils;
  float n = clamp(floor(drops + 0.5), 1.0, 8.0);
  float rimW = 0.1;
  float feather = 0.05;
  float margin = 1.2 * amp + rimW + 0.08; // how far the swirls can pull the front back
  float f = -1e3; // > 0 inside the ink
  float fs = -1e3; // the same, only for the drops already fallen, which fades their haze in
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi < n) {
      vec2 hs = vec2(fi * 7.13 + seed, fi * 3.71 - seed);
      vec2 c = vec2(mix(0.15, 0.85, hash(hs)) * ratio, mix(0.15, 0.85, hash(hs + 19.7)));
      float start = 0.2 * fi / n;
      float s = clamp((p - start) / (1.0 - start), 0.0, 1.0);
      // distance to the farthest corner: each bloom alone covers the frame in the end
      vec2 m = max(c, vec2(ratio, 1.0) - c);
      float far = length(m) + margin;
      float s3 = s * s * s;
      float r = (far + 0.02) * s * (0.35 + 0.65 * s3 * s3) - 0.02;
      float reach = amp * min(1.0, max(r, 0.0) * 5.0);
      float g = r - length(q - c + 1.3 * reach * flow) + reach * 0.9 * swirl;
      f = max(f, g);
      fs = max(fs, g - 0.15 * (1.0 - min(1.0, s * 12.0)));
    }
  }
  float aa = 0.003;
  float inside = smoothstep(-aa, aa, f);
  float wisp = 1.0 - smoothstep(0.0, 0.08, abs(fbm(sq * 2.0 + 5.0 * w2) - 0.5));
  float soft = smoothstep(-feather, 0.0, fs) * (0.35 + 0.4 * wisp);
  float haze = 0.35 * wisp * (1.0 - smoothstep(0.0, 0.1, -fs));
  float cover = max(inside, max(soft, haze));
  float edge = 1.0 - smoothstep(0.0, rimW, f);
  vec4 to = getToColor(fold(uv - 0.015 * edge * flow / vec2(ratio, 1.0)));
  to.rgb = mix(to.rgb, to.rgb * to.rgb * 0.7, rim * edge);
  return mix(getFromColor(uv), to, cover);
}
`;
export const INK_BLEED_DEFAULTS = Object.freeze({drops:4,tendrils:.7,rim:.5,seed:3});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
export function normaliseInkBleedOptions(options={}){
    return {
        drops:Math.round(bound(options.drops,1,8,4)),
        tendrils:bound(options.tendrils,0,1,.7),
        rim:bound(options.rim,0,1,.5),
        seed:bound(options.seed,-100,100,3)
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
${INK_BLEED_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('InkBleed failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original InkBleed GLSL compilation failed: '+error);
    }
    return shader;
}
export function createInkBleedWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('InkBleed requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original InkBleed GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'drops','tendrils','rim','seed'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('InkBleed WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('InkBleed input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseInkBleedOptions(rawOptions);
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
            gl.uniform1f(uniforms.drops,opts.drops);
            gl.uniform1f(uniforms.tendrils,opts.tendrils);
            gl.uniform1f(uniforms.rim,opts.rim);
            gl.uniform1f(uniforms.seed,opts.seed);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('InkBleed original shader GPU draw error '+error);
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
export function paintInkBleed(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('InkBleed requires decoded outgoing and incoming footage');
    const sources=['inkBleedFromScratch','inkBleedToScratch'].map(key=>{
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
    const shader=renderer.inkBleedWebGL??(renderer.inkBleedWebGL=createInkBleedWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['ink-bleed']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
