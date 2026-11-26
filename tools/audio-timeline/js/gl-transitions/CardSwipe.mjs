import { uploadTransitionTexture } from './texture-upload.mjs';
/**
 * #14 CardSwipe — gre/MIT original pivoting outgoing card shader.
 * Source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/CardSwipe.glsl
 * Source blob aa6edf3ecd6e0d629f2bf39655b1d984f3305c2c.
 * Keeps original below-card pivot, directional flick and falling shadow,
 * depth-scaled incoming card with rounded edges and transparent backdrop.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const CARD_SWIPE_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The outgoing image is flicked off like the top card of a stack, swinging around a point below it as it flies out, while the incoming card behind it grows to fill the frame
// Tags: card, swipe, stack, rotate, slide, directional

// @param Direction in which the outgoing card is flicked
uniform vec2 direction; // = vec2(1.0, 0.25)
// @range(0, 1) How much the outgoing card swings as it flies out
uniform float rotation; // = 0.5
// @range(0, 0.5) How much smaller the incoming card starts
uniform float depth; // = 0.15
// @color Color seen around the incoming card while it is smaller than the frame
uniform vec4 backColor; // = vec4(0.06, 0.06, 0.07, 1.0)

const float RADIUS = 0.045;
const float AA = 0.002;

float roundedBox(vec2 q, vec2 b, float r) {
  vec2 d = abs(q) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

vec4 premultiply(vec4 c) {
  return vec4(c.rgb * c.a, c.a);
}

vec4 transition(vec2 uv) {
  float dl = length(direction);
  vec2 d = dl > 1e-6 ? direction / dl : vec2(0.970143, 0.242536);
  vec2 q = (uv - 0.5) * vec2(ratio, 1.0);
  vec2 b = vec2(0.5 * ratio, 0.5);
  float p = progress;

  float h = clamp((p - 0.2) / 0.8, 0.0, 1.0);
  float g = h * h * (3.0 - 2.0 * h);
  float k = 1.0 - g;
  float sc = 1.0 - depth * k;
  float rb = RADIUS * min(1.0, 12.0 * k);
  float db = roundedBox(q, b * sc, rb);
  float cb = clamp(0.5 - db / max(AA * min(1.0, 40.0 * k), 1e-6), 0.0, 1.0);
  vec4 tc = getToColor(clamp(0.5 + (uv - 0.5) / sc, 0.0, 1.0));
  tc.rgb *= 1.0 - 0.35 * k * k;
  // the cards are opaque: each one replaces what is behind it, keeping its image's alpha
  vec4 col = mix(premultiply(backColor), premultiply(tc), cb);

  float t = clamp(p / 0.75, 0.0, 1.0);
  float lift = smoothstep(0.0, 0.15, p);
  float u = min(t / 0.7, 1.0);
  float swing = u * u * (3.0 - 2.0 * u);
  float a = (d.x < 0.0 ? 1.3 : -1.3) * rotation * swing;
  vec2 pivot = vec2(0.0, -1.1);
  // where the swing alone takes the center of the card, to throw it far enough
  float ca = cos(a), sa = sin(a);
  vec2 swung = pivot + mat2(ca, sa, -sa, ca) * -pivot;
  float far = 2.0 * length(b) + length(swung) + 0.3;
  vec2 shift = d * far * t * t * (0.4 + 0.6 * t);
  mat2 unrotate = mat2(ca, -sa, sa, ca);
  vec2 r = unrotate * (q - shift - pivot) + pivot;
  float rf = RADIUS * lift;

  float sh = 0.6 * lift * (1.0 - t);
  if (sh > 0.0) {
    vec2 rs = unrotate * (q - (0.03 * d + vec2(0.0, -0.03)) * lift - shift - pivot) + pivot;
    float ds = roundedBox(rs, b, rf);
    col.rgb *= 1.0 - sh * (1.0 - smoothstep(-0.05, 0.08, ds));
  }

  float df = roundedBox(r, b, rf);
  float cf = clamp(0.5 - df / max(AA * min(1.0, 40.0 * lift), 1e-6), 0.0, 1.0);
  vec4 fc = getFromColor(clamp(r / vec2(ratio, 1.0) + 0.5, 0.0, 1.0));
  col = mix(col, premultiply(fc), cf);
  return col.a > 0.0 ? vec4(col.rgb / col.a, col.a) : vec4(0.0);
}
`;
export const CARD_SWIPE_DEFAULTS = Object.freeze({
    directionX:1,directionY:.25,rotation:.5,depth:.15,
    backColor:'#0f0f12',backAlpha:1
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
export function normaliseCardSwipeOptions(options={}){
    return {
        directionX:bound(options.directionX,-2,2,1),
        directionY:bound(options.directionY,-2,2,.25),
        rotation:bound(options.rotation,0,1,.5),
        depth:bound(options.depth,0,.5,.15),
        backColor:color(options.backColor,'#0f0f12'),
        backAlpha:bound(options.backAlpha,0,1,1)
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
${CARD_SWIPE_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('CardSwipe failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original CardSwipe GLSL compilation failed: '+error);
    }
    return shader;
}
export function createCardSwipeWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('CardSwipe requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original CardSwipe GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'direction','rotation','depth','backColor'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('CardSwipe WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('CardSwipe input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseCardSwipeOptions(rawOptions);
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
            gl.uniform1f(uniforms.rotation,opts.rotation);
            gl.uniform1f(uniforms.depth,opts.depth);
            gl.uniform4fv(uniforms.backColor,new Float32Array([...rgb(opts.backColor),opts.backAlpha]));
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('CardSwipe original shader GPU draw error '+error);
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
export function paintCardSwipe(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('CardSwipe requires decoded outgoing and incoming footage');
    const sources=['cardSwipeFromScratch','cardSwipeToScratch'].map(key=>{
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
    const shader=renderer.cardSwipeWebGL??(renderer.cardSwipeWebGL=createCardSwipeWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['card-swipe']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
