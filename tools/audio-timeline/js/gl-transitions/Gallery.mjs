/**
 * #12 Gallery — original gre/MIT ray-projected perspective slide transition.
 * Source: https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/Gallery.glsl
 * Upstream blob SHA dcdca306666c1cddc6f391b135a367be931db4ac.
 * Original slide ray-intersections, camera pullback/track-in, rotations,
 * neighbor depth and floor reflections are kept verbatim below.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const GALLERY_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The camera pulls back from the outgoing image to show it as a slide hanging in a row on a wall in perspective, the row glides along as each slide turns away from the center, and the camera moves back in on the incoming slide until it fills the frame
// Tags: 3d, perspective, gallery, slide, reflection, directional

// @param Way the row moves: 1 brings the incoming slide in from the right, -1 from the left
uniform float direction; // = 1.0
// @range(0, 1) How much the slides turn as they leave the center
uniform float tilt; // = 0.6
// @range(0, 1) Space between two slides, in slide widths
uniform float gap; // = 0.15
// @range(0.2, 3) How far the camera pulls back
uniform float zoom; // = 2.0
// @range(0, 1) Strength of the reflection of the slides on the floor
uniform float reflection; // = 0.3
// @color Color of the wall and the floor around the slides
uniform vec4 background; // = vec4(0.07, 0.07, 0.08, 1.0)

const float FOCAL = 1.6; // distance from the camera to a slide when it fills the frame
const float MAX_ANGLE = 1.4; // turn of a side slide at tilt = 1, in radians
const float NEIGHBOUR = 0.3;
const float AA = 0.002;

vec4 premultiply(vec4 c) {
  return vec4(c.rgb * c.a, c.a);
}

// how far slide k sits from the center of the view, in slides, clamped to one slide on each side
float offset(float k, float camQ, float spacing) {
  return clamp((k * spacing - camQ) / spacing, -1.0, 1.0);
}

// the ray o + t d against slide k of the row (a plane turned around its vertical axis):
// returns (u, v, t, coverage), coverage antialiased over aa frame heights at the slide's edges
vec4 slideHit(vec3 o, vec3 d, float k, float s, float camQ, float spacing, float aa) {
  float a = -s * MAX_ANGLE * tilt * offset(k, camQ, spacing);
  vec3 c = vec3(s * k * spacing, 0.0, 0.0);
  vec3 tg = vec3(cos(a), 0.0, sin(a));
  vec3 n = vec3(-tg.z, 0.0, tg.x);
  float dn = dot(d, n);
  if (abs(dn) < 1e-5) return vec4(0.0, 0.0, -1.0, 0.0);
  float t = dot(c - o, n) / dn;
  vec3 q = o + d * t - c;
  float lx = dot(q, tg) + 0.5 * ratio;
  float ly = q.y + 0.5;
  // distances to the edges on screen: along the slide, how fast its local x moves with the screen x
  float jx = abs(t * (tg.x - dot(d, tg) * n.x / dn));
  float ex = min(lx, ratio - lx) / max(jx, 1e-6);
  float ey = min(ly, 1.0 - ly) / max(t, 1e-6);
  float cov = t > 0.0 ? clamp(0.5 + min(ex, ey) / aa, 0.0, 1.0) : 0.0;
  return vec4(lx / ratio, ly, t, cov);
}

// the premultiplied color of slide k where the ray hit it; the row is from (k = 0), to (k = 1),
// and faint repeats beyond them on their own side; refl > 0 is the strength of its reflection
vec4 slideColor(vec4 h, float k, float camQ, float spacing, float refl, vec4 bg) {
  if (h.w <= 0.0) return vec4(0.0);
  vec2 st = clamp(h.xy, 0.0, 1.0);
  vec4 c = premultiply(k < 0.5 ? getFromColor(st) : getToColor(st));
  c.rgb *= 1.0 - 0.3 * tilt * abs(offset(k, camQ, spacing));
  if (k < -0.5 || k > 1.5) c = mix(bg, c, NEIGHBOUR);
  float f = refl > 0.0 ? refl * (1.0 - smoothstep(0.0, 0.6, st.y)) : 1.0;
  return c * (h.w * f);
}

// how much the slides cover along the ray, whatever their images' alpha
float sceneCover(vec3 o, vec3 d, float s, float camQ, float spacing, float aa) {
  float kc = floor(s * (o.x + d.x * o.z / -d.z) / spacing + 0.5);
  float w0 = slideHit(o, d, kc - 1.0, s, camQ, spacing, aa).w;
  float w1 = slideHit(o, d, kc, s, camQ, spacing, aa).w;
  float w2 = slideHit(o, d, kc + 1.0, s, camQ, spacing, aa).w;
  return 1.0 - (1.0 - w0) * (1.0 - w1) * (1.0 - w2);
}

// the slides seen along the ray, composited back to front (premultiplied)
vec4 scene(vec3 o, vec3 d, float s, float camQ, float spacing, float aa, float refl, vec4 bg) {
  float wallQ = s * (o.x + d.x * o.z / -d.z);
  float kc = floor(wallQ / spacing + 0.5);
  vec4 h0 = slideHit(o, d, kc - 1.0, s, camQ, spacing, aa);
  vec4 h1 = slideHit(o, d, kc, s, camQ, spacing, aa);
  vec4 h2 = slideHit(o, d, kc + 1.0, s, camQ, spacing, aa);
  vec4 c0 = slideColor(h0, kc - 1.0, camQ, spacing, refl, bg);
  vec4 c1 = slideColor(h1, kc, camQ, spacing, refl, bg);
  vec4 c2 = slideColor(h2, kc + 1.0, camQ, spacing, refl, bg);
  float t0 = h0.w > 0.0 ? h0.z : 1e6;
  float t1 = h1.w > 0.0 ? h1.z : 1e6;
  float t2 = h2.w > 0.0 ? h2.z : 1e6;
  // sort far to near: t0 >= t1 >= t2
  vec4 tc;
  float tt;
  if (t0 < t1) { tc = c0; c0 = c1; c1 = tc; tt = t0; t0 = t1; t1 = tt; }
  if (t1 < t2) { tc = c1; c1 = c2; c2 = tc; tt = t1; t1 = t2; t2 = tt; }
  if (t0 < t1) { tc = c0; c0 = c1; c1 = tc; }
  vec4 col = c0;
  col = c1 + col * (1.0 - c1.a);
  col = c2 + col * (1.0 - c2.a);
  return col;
}

vec4 transition(vec2 uv) {
  float p = progress;
  float s = direction < 0.0 ? -1.0 : 1.0;
  float spacing = ratio * (1.0 + gap);
  float back = smoothstep(0.0, 0.42, p) * (1.0 - smoothstep(0.58, 1.0, p));
  float m = clamp((p - 0.18) / 0.64, 0.0, 1.0);
  float glide = m * m * m * (m * (m * 6.0 - 15.0) + 10.0);
  float camQ = spacing * glide;
  vec3 o = vec3(s * camQ, 0.0, FOCAL * (1.0 + zoom * back));
  vec3 d = vec3((uv - 0.5) * vec2(ratio, 1.0), -FOCAL);
  float amount = min(1.0, 40.0 * back);
  float aa = max(AA * amount, 1e-6);
  vec4 bg = premultiply(background);

  vec4 col = scene(o, d, s, camQ, spacing, aa, 0.0, bg);
  if (col.a < 1.0) {
    vec4 under = bg;
    if (d.y < 0.0 && reflection > 0.0) {
      vec4 r = scene(vec3(o.x, -1.0 - o.y, o.z), vec3(d.x, -d.y, d.z), s, camQ, spacing, aa, reflection, bg);
      under = r + bg * (1.0 - r.a);
    }
    // the wall shows around the slides, and only fades in behind their transparent parts,
    // so that the images keep their own alpha at the start and the end
    col += under * (mix(1.0, amount, sceneCover(o, d, s, camQ, spacing, aa)) * (1.0 - col.a));
  }
  return col.a > 0.0 ? vec4(col.rgb / col.a, col.a) : vec4(0.0);
}
`;
export const GALLERY_DEFAULTS = Object.freeze({
    direction:1,tilt:.6,gap:.15,zoom:2,reflection:.3,
    backgroundColor:'#121214',backgroundAlpha:1
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
export function normaliseGalleryOptions(options={}){
    return {
        direction:bound(options.direction,-1,1,1)<0?-1:1,
        tilt:bound(options.tilt,0,1,.6),
        gap:bound(options.gap,0,1,.15),
        zoom:bound(options.zoom,.2,3,2),
        reflection:bound(options.reflection,0,1,.3),
        backgroundColor:color(options.backgroundColor,'#121214'),
        backgroundAlpha:bound(options.backgroundAlpha,0,1,1)
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
${GALLERY_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('Gallery failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original Gallery GLSL compilation failed: '+error);
    }
    return shader;
}
export function createGalleryWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('Gallery requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original Gallery GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'direction','tilt','gap','zoom','reflection','background'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('Gallery WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('Gallery input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseGalleryOptions(rawOptions);
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
            gl.uniform1f(uniforms.direction,opts.direction);
            gl.uniform1f(uniforms.tilt,opts.tilt);
            gl.uniform1f(uniforms.gap,opts.gap);
            gl.uniform1f(uniforms.zoom,opts.zoom);
            gl.uniform1f(uniforms.reflection,opts.reflection);
            gl.uniform4fv(uniforms.background,new Float32Array([...rgb(opts.backgroundColor),opts.backgroundAlpha]));
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('Gallery original shader GPU draw error '+error);
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
export function paintGallery(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('Gallery requires decoded outgoing and incoming footage');
    const sources=['galleryFromScratch','galleryToScratch'].map(key=>{
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
    const shader=renderer.galleryWebGL??(renderer.galleryWebGL=createGalleryWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.gallery);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
