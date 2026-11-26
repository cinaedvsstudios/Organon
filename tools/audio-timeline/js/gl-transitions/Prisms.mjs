import { uploadTransitionTexture } from './texture-upload.mjs';
/**
 * #31 Prisms — exact original gre/MIT perspective rotating billboard slats.
 * Pinned source https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/Prisms.glsl
 * Upstream git blob ccb2ac8c854b172566170adb74bbb12bd0eafe64; six native uniforms, including RGBA.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const PRISMS_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The frame is cut into 3D prisms that turn in a cascade, like a rotating billboard, from the outgoing image on one face to the incoming one on the next
// Tags: 3d, rotate, stripes

// @range(2, 40, 1) Number of prisms
uniform int slats; // = 8
// @range(0, 0.9) Delay of the last prism's turn, as a part of the transition
uniform float stagger; // = 0.45
// @range(0, 4) Amount of perspective
uniform float perspective; // = 1.0
// @range(0, 1) How much the faces darken as they turn away
uniform float shading; // = 0.6
// @param Cut the frame into horizontal prisms instead
uniform bool horizontal; // = false
// @color Color seen where the turning prisms leave the frame uncovered
uniform vec4 backColor; // = vec4(0.0, 0.0, 0.0, 1.0)

const float PI = 3.141592653589793;
const float EDGE = 0.002;

vec4 transition (vec2 uv) {
  float n = float(slats);
  // a: the axis across the prisms, b: the axis they turn around
  float a = horizontal ? uv.y : uv.x;
  float b = horizontal ? uv.x : uv.y;
  // the prisms' half width in frame heights, and the perspective from their depth
  float hw = 0.5 / n * (horizontal ? 1.0 : ratio);
  float k = min(perspective * hw, 0.5);
  float bScale = horizontal ? ratio : 1.0;
  // a turning prism is wider than its strip: keep the two nearest faces
  vec4 near1 = vec4(0.0), near2 = vec4(0.0);
  float cover1 = 0.0, cover2 = 0.0;
  float z1 = -2.0, z2 = -2.0;
  for (int d = -1; d <= 1; d++) {
    float i = floor(a * n) + float(d);
    if (i < 0.0 || i > n - 1.0) continue;
    float order = (horizontal ? n - 1.0 - i : i) / (n - 1.0);
    float t = clamp((progress - stagger * order) / (1.0 - stagger), 0.0, 1.0);
    t = mix(t, t * t * (3.0 - 2.0 * t), 0.7);
    float c = cos(0.5 * PI * t);
    float s = sin(0.5 * PI * t);
    // soft edges while turning (sharp at rest, to keep the first and last frames exact)
    float edge = EDGE * min(1.0, 20.0 * s * c) + 1e-6;
    // x: position across the strip, -1 to 1; the prism's square section has its faces at distance 1
    float x = 2.0 * (a * n - i) - 1.0;
    for (int f = 0; f < 2; f++) {
      // f = 0: the outgoing face turning away, f = 1: the incoming face turning in
      float cf = f == 0 ? c : s;
      if (cf < 1e-4) continue;
      // u: position on the face, z: depth (1 for a face at rest)
      float u = f == 0 ? (x + s) / c : (x - c) / s;
      float z = f == 0 ? u * s + c : s - u * c;
      if (abs(u) > 1.0 || z <= z2) continue;
      float scale = 1.0 - k * (z - 1.0);
      float y = (b - 0.5) * scale + 0.5;
      if (y < 0.0 || y > 1.0) continue;
      // soften the outer edges only: the faces meet at the prism's corner
      float outer = f == 0 ? 1.0 + u : 1.0 - u;
      float cover = clamp(outer * hw * cf / edge, 0.0, 1.0)
        * clamp(min(y, 1.0 - y) * bScale / scale / edge, 0.0, 1.0);
      float sa = (i + 0.5 + 0.5 * u) / n;
      vec2 p = horizontal ? vec2(y, sa) : vec2(sa, y);
      vec4 img = f == 0 ? getFromColor(p) : getToColor(p);
      float lambert = clamp(f == 0 ? c - 0.6 * s : s + 0.6 * c, 0.0, 1.0);
      vec4 color = vec4(img.rgb * mix(1.0 - shading, 1.0, lambert), img.a);
      if (z > z1) {
        near2 = near1; cover2 = cover1; z2 = z1;
        near1 = color; cover1 = cover; z1 = z;
      } else {
        near2 = color; cover2 = cover; z2 = z;
      }
    }
  }
  return mix(mix(backColor, near2, cover2), near1, cover1);
}
`;
export const PRISMS_DEFAULTS = Object.freeze({slats:8,stagger:.45,perspective:1,shading:.6,horizontal:false,backColor:'#000000',backAlpha:1});
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
export function normalisePrismsOptions(options={}) {
    const value=options.horizontal;
    return {
        slats:Math.round(bound(options.slats,2,40,8)),
        stagger:bound(options.stagger,0,.9,.45),
        perspective:bound(options.perspective,0,4,1),
        shading:bound(options.shading,0,1,.6),
        horizontal:value===undefined||value===null?false
            :!(value===false||value===0||value==='false'||value==='0'||value===''),
        backColor:hexColor(options.backColor,'#000000'),
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
${PRISMS_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('Prisms failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original Prisms GLSL compilation failed: '+error);
    }
    return shader;
}
export function createPrismsWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('Prisms requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original Prisms GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'slats','stagger','perspective','shading','horizontal','backColor'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('Prisms WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('Prisms input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normalisePrismsOptions(rawOptions);
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
            gl.uniform1i(uniforms.slats,opts.slats);
            gl.uniform1f(uniforms.stagger,opts.stagger);
            gl.uniform1f(uniforms.perspective,opts.perspective);
            gl.uniform1f(uniforms.shading,opts.shading);
            gl.uniform1i(uniforms.horizontal,opts.horizontal?1:0);
            gl.uniform4fv(uniforms.backColor,new Float32Array([...rgb(opts.backColor),opts.backAlpha]));
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('Prisms original shader GPU draw error '+error);
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
export function paintPrisms(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('Prisms requires decoded outgoing and incoming footage');
    const sources=['prismsFromScratch','prismsToScratch'].map(key=>{
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
    const shader=renderer.prismsWebGL??(renderer.prismsWebGL=createPrismsWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['prisms']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
