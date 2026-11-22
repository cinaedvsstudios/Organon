/**
 * #36 Cube — exact upstream gre MIT ray-traced textured 3D cube and floor.
 * https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/Cube.glsl
 * Pinned original git blob 5e456ee806ed761d5a9d670af88daee6d91872d5; native perspective, zoom, reflection, float, shading.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const CUBE_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The two images are faces of a box that turns a quarter turn in perspective, the outgoing face darkening as it turns away, above a reflective floor
// Tags: 3d, cube, rotate, reflection
// @range(0, 1) Amount of perspective
uniform float persp; // = 0.7
// @range(0, 1) How far the camera pulls back mid-turn, as a part of the frame
uniform float unzoom; // = 0.3
// @range(0, 1) Strength of the reflection
uniform float reflection; // = 0.4
// @range(0, 20) Gap between the box and its reflection, as a percentage of the frame height
uniform float floating; // = 3.0
// @range(0, 1) How much the faces darken as they turn away, and the shadow on the floor
uniform float shading; // = 0.5

const float PI = 3.141592653589793;
const float EDGE = 0.002;

// the ray (eye, dir) in the box's frame, the box turned by (c, s) around its vertical axis:
// returns (distance along the ray, horizontal position on the face, height, face) with face 0 for
// the outgoing image's face, 1 for the incoming one's, and a negative distance where it misses
vec4 hitBox(vec3 eye, vec3 dir, float w, float c, float s) {
  vec2 pivot = vec2(0.5 * w);
  vec2 e = eye.xz - pivot;
  vec2 o = vec2(e.x * c + e.y * s, -e.x * s + e.y * c) + pivot;
  vec2 d = vec2(dir.x * c + dir.z * s, -dir.x * s + dir.z * c);
  vec2 inv = 1.0 / vec2(d.x < 0.0 ? min(d.x, -1e-6) : max(d.x, 1e-6), d.y < 0.0 ? min(d.y, -1e-6) : max(d.y, 1e-6));
  vec2 t0 = (vec2(0.0) - o) * inv;
  vec2 t1 = (vec2(w) - o) * inv;
  vec2 tn = min(t0, t1);
  vec2 tf = max(t0, t1);
  float tin = max(tn.x, tn.y);
  if (tin <= 0.0 || tin > min(tf.x, tf.y)) return vec4(-1.0);
  vec2 hit = o + tin * d;
  float y = eye.y + tin * dir.y;
  if (y < 0.0 || y > 1.0) return vec4(-1.0);
  // the face first entered: z = 0 is the outgoing face, x = 0 the incoming one, the others are hidden
  if (tn.y >= tn.x) {
    if (d.y <= 0.0) return vec4(-1.0);
    return vec4(tin, hit.x / w, y, 0.0);
  }
  if (d.x <= 0.0) return vec4(-1.0);
  return vec4(tin, 1.0 - hit.y / w, y, 1.0);
}

vec4 transition(vec2 uv) {
  float w = ratio;
  float turn = progress * progress * (3.0 - 2.0 * progress);
  float a = 0.5 * PI * turn;
  float c = cos(a), s = sin(a);
  if (progress >= 1.0) { c = 0.0; s = 1.0; }
  // 0 at both ends, for exact images and hard edges there
  float motion = sin(PI * clamp(progress, 0.0, 1.0));
  float zoom = 1.0 + max(unzoom, 0.0) * motion;

  // the front of the box is the screen: the camera keeps it framed, pulling back mid-turn
  float dist = 0.8 * max(w, 1.0) / clamp(persp, 0.01, 1.0);
  vec3 eye = vec3(0.5 * w, 0.5, -dist);
  vec2 sp = (uv - 0.5) * zoom + 0.5;
  vec3 dir = vec3(sp.x * w, sp.y, 0.0) - eye;

  float px = EDGE * zoom * min(10.0 * motion, 1.0);
  float shade0 = 1.0 - shading * (1.0 - c);
  float shade1 = 1.0 - shading * (1.0 - s);

  vec4 front = vec4(0.0);
  vec4 b = hitBox(eye, dir, w, c, s);
  if (b.x > 0.0) {
    vec4 img = b.w < 0.5 ? getFromColor(vec2(b.y, b.z)) : getToColor(vec2(b.y, b.z));
    float m = 1.0;
    if (px > 0.0) {
      float e = px * b.x;
      vec3 n = b.w < 0.5 ? vec3(s, 0.0, -c) : vec3(-c, 0.0, -s);
      float fore = max(abs(dot(n, normalize(dir))), 0.05);
      float edge = b.w < 0.5 ? 1.0 - b.y : b.y;
      m = clamp(min(b.z, 1.0 - b.z) / e, 0.0, 1.0)
        * clamp(edge * w * fore / e, 0.0, 1.0);
    }
    // where the box covers the pixel, nothing behind it shows: the exact image at both ends
    if (m >= 1.0 && img.a >= 1.0) {
      return vec4(img.rgb * (b.w < 0.5 ? shade0 : shade1), img.a);
    }
    front = vec4(img.rgb * (b.w < 0.5 ? shade0 : shade1) * img.a, img.a) * m;
  }

  vec4 ground = vec4(0.0);
  float h = 0.005 * max(floating, 0.0);
  if (dir.y < 0.0 && motion > 0.0) {
    float tf = -(eye.y + h) / dir.y;
    vec3 f = eye + tf * dir;
    vec3 meye = vec3(eye.x, -2.0 * h - eye.y, eye.z);
    vec3 mdir = vec3(dir.x, -dir.y, dir.z);
    vec4 r = hitBox(meye, mdir, w, c, s);
    if (r.x > 0.0) {
      vec4 img = r.w < 0.5 ? getFromColor(vec2(r.y, r.z)) : getToColor(vec2(r.y, r.z));
      float k = clamp(reflection, 0.0, 1.0) * (1.0 - r.z) * (1.0 - r.z);
      ground = vec4(img.rgb * (r.w < 0.5 ? shade0 : shade1) * img.a, img.a) * k;
    }
    vec2 q = f.xz - vec2(0.5 * w);
    vec2 l = vec2(q.x * c + q.y * s, -q.x * s + q.y * c);
    float soft = 0.03 + 1.5 * h;
    float sh = shading * 0.7 * exp(-length(max(abs(l) - vec2(0.5 * w), 0.0)) / soft);
    // only as opaque as the bottom of the nearest face
    vec2 bl = l + vec2(0.5 * w);
    sh *= l.y < l.x
      ? getFromColor(vec2(clamp(bl.x / w, 0.0, 1.0), 0.0)).a
      : getToColor(vec2(clamp(1.0 - bl.y / w, 0.0, 1.0), 0.0)).a;
    ground = ground * (1.0 - sh) + vec4(0.0, 0.0, 0.0, sh);
    ground *= min(6.0 * motion, 1.0);
  }

  vec4 color = front + ground * (1.0 - front.a);
  return color.a > 0.0 ? vec4(color.rgb / color.a, color.a) : vec4(0.0);
}
`;
export const CUBE_DEFAULTS = Object.freeze({persp:.7,unzoom:.3,reflection:.4,floating:3,shading:.5});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
export function normaliseCubeOptions(options={}) {
    return {
        persp:bound(options.persp,0,1,.7),
        unzoom:bound(options.unzoom,0,1,.3),
        reflection:bound(options.reflection,0,1,.4),
        floating:bound(options.floating,0,20,3),
        shading:bound(options.shading,0,1,.5)
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
${CUBE_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('Cube failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original Cube GLSL compilation failed: '+error);
    }
    return shader;
}
export function createCubeWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('Cube requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original Cube GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'persp','unzoom','reflection','floating','shading'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('Cube WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('Cube input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseCubeOptions(rawOptions);
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
            gl.uniform1f(uniforms.persp,opts.persp);
            gl.uniform1f(uniforms.unzoom,opts.unzoom);
            gl.uniform1f(uniforms.reflection,opts.reflection);
            gl.uniform1f(uniforms.floating,opts.floating);
            gl.uniform1f(uniforms.shading,opts.shading);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('Cube original shader GPU draw error '+error);
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
export function paintCube(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('Cube requires decoded outgoing and incoming footage');
    const sources=['cubeFromScratch','cubeToScratch'].map(key=>{
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
    const shader=renderer.cubeWebGL??(renderer.cubeWebGL=createCubeWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['cube']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
