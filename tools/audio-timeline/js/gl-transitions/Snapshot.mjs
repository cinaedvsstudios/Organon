/**
 * #10 Snapshot — original gre/MIT camera flash/photo-card transition GLSL.
 * Pinned shader source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/Snapshot.glsl
 * Original blob 56827ba42ff3317274e7b76a125ee47c50bc2f35.
 * Preserves print flash, physical white border/card corners, perspective tilt,
 * falling photo with soft shadow, and correct transparent composite.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const SNAPSHOT_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: A camera flash freezes the outgoing image into a printed photo with a white border, which shrinks, tilts and drops out of the frame, revealing the incoming image behind it
// Tags: photo, flash, scale, rotate, fall, shadow

// @range(0, 1) How much the photo turns as it drops
uniform float tilt; // = 0.35
// @range(0, 0.15) Width of the photo's border, relative to the frame height
uniform float border; // = 0.04
// @range(0, 1) Strength of the camera flash
uniform float flash; // = 0.85
// @range(0, 1) Darkness of the soft shadow the photo casts on the incoming image
uniform float shadow; // = 0.45
// @color Color of the photo's border
uniform vec4 borderColor; // = vec4(0.96, 0.94, 0.89, 1.0)

const float SHRINK = 0.24; // how much smaller the photo gets before it drops
const float RADIUS = 0.008;
const float AA = 0.0015;

float roundedBox(vec2 q, vec2 b, float r) {
  vec2 d = abs(q) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

vec4 premultiply(vec4 c) {
  return vec4(c.rgb * c.a, c.a);
}

vec4 transition(vec2 uv) {
  float p = progress;
  vec2 asp = vec2(ratio, 1.0);
  vec2 q = (uv - 0.5) * asp;
  vec2 halfImage = 0.5 * asp;
  vec2 halfCard = halfImage + border;

  float k = smoothstep(0.05, 0.4, p);
  float t = clamp((p - 0.3) / 0.7, 0.0, 1.0);
  float fall = t * t;
  float s = 1.0 - SHRINK * k;
  float a = -tilt * (0.12 * k + 0.88 * fall);
  float bound = (abs(sin(tilt)) * halfCard.x + abs(cos(tilt)) * halfCard.y) * (1.0 - SHRINK);
  float lift = 0.035 * k * (1.0 - fall);
  vec2 center = vec2(0.08 * fall, lift - (0.5 + bound + 0.1) * fall);

  float rad = RADIUS * k;

  float ca = cos(a), sa = sin(a);
  mat2 unrotate = mat2(ca, -sa, sa, ca);

  vec4 col = getToColor(uv);
  float sh = shadow * k;
  if (sh > 0.0) {
    vec2 rs = unrotate * (q - center - vec2(0.012, -0.022) * k) / s;
    float ds = roundedBox(rs, halfCard, rad) * s;
    float blur = 0.035 * s;
    col.rgb *= 1.0 - sh * (1.0 - smoothstep(-blur, blur, ds));
  }
  col = premultiply(col);

  vec2 r = unrotate * (q - center) / s;
  float dCard = roundedBox(r, halfCard, rad) * s;
  float dImage = roundedBox(r, halfImage, 0.0) * s;
  // the edges are pushed out by one antialiasing width, so the photo covers the full frame at the start
  float cardCover = clamp(1.5 - dCard / AA, 0.0, 1.0);
  float imageCover = clamp(1.5 - dImage / AA, 0.0, 1.0);
  // the image replaces what is behind it, while the border is laid over the incoming image, which shows through a translucent border
  vec4 photo = premultiply(getFromColor(clamp(r / asp + 0.5, 0.0, 1.0)));
  vec4 paper = premultiply(borderColor);
  vec4 card = mix(paper + col * (1.0 - paper.a), photo, imageCover);
  col = mix(col, card, cardCover);
  if (col.a <= 0.0) return vec4(0.0);
  col.rgb /= col.a;

  // the flash only adds light: a quick bloom to white that fades as the photo comes out
  float f = flash * smoothstep(0.0, 0.05, p) * (1.0 - smoothstep(0.05, 0.3, p));
  col.rgb = 1.0 - (1.0 - col.rgb) * (1.0 - f);
  return col;
}
`;
export const SNAPSHOT_DEFAULTS = Object.freeze({
    tilt:.35,border:.04,flash:.85,shadow:.45,
    borderColor:'#f5f0e3',borderAlpha:1
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
export function normaliseSnapshotOptions(options={}){
    return {
        tilt:bound(options.tilt,0,1,.35),
        border:bound(options.border,0,.15,.04),
        flash:bound(options.flash,0,1,.85),
        shadow:bound(options.shadow,0,1,.45),
        borderColor:color(options.borderColor,'#f5f0e3'),
        borderAlpha:bound(options.borderAlpha,0,1,1)
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
${SNAPSHOT_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('Snapshot failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original Snapshot GLSL compilation failed: '+error);
    }
    return shader;
}
export function createSnapshotWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('Snapshot requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original Snapshot GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'tilt','border','flash','shadow','borderColor'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('Snapshot WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('Snapshot input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseSnapshotOptions(rawOptions);
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
            gl.uniform1f(uniforms.tilt,opts.tilt);
            gl.uniform1f(uniforms.border,opts.border);
            gl.uniform1f(uniforms.flash,opts.flash);
            gl.uniform1f(uniforms.shadow,opts.shadow);
            gl.uniform4fv(uniforms.borderColor,new Float32Array([...rgb(opts.borderColor),opts.borderAlpha]));
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('Snapshot original shader GPU draw error '+error);
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
export function paintSnapshot(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('Snapshot requires decoded outgoing and incoming footage');
    const sources=['snapshotFromScratch','snapshotToScratch'].map(key=>{
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
    const shader=renderer.snapshotWebGL??(renderer.snapshotWebGL=createSnapshotWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.snapshot);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
