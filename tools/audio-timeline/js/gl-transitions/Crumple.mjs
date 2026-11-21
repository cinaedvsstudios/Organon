/**
 * #05 Crumple — gre's original MIT GL Transitions paper folding shader.
 * Upstream: https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/Crumple.glsl
 * Source blob SHA: 6883cc11cb42c79e49570623d381b51b3da38317
 * The original crease geometry, ridge/valley lighting, paper-ball outline,
 * tossed shadow and premultiplied alpha are preserved verbatim below.
 * Only two-texture WebGL plumbing and native uniform controls are added.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const CRUMPLE_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The outgoing image crumples into a creased paper ball, shaded along its folds, which is then tossed away to reveal the incoming image
// Tags: paper, 3d, shrink, shadow

// @range(1, 32, 1) Number of folds creasing the paper
uniform int creases; // = 16
// @range(0.05, 0.4) Radius of the paper ball, relative to the image height
uniform float size; // = 0.2
// @param Direction the ball is tossed toward
uniform vec2 direction; // = vec2(1.0, 0.4)
// @color Color of the bare paper showing through the ink along the sharpest creases
uniform vec4 paper; // = vec4(0.96, 0.95, 0.91, 1.0)
// @color Color of the shadow cast on the incoming image
uniform vec4 shadow; // = vec4(0.0, 0.0, 0.0, 0.45)

const float PI = 3.14159265;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float frame(vec2 a) {
  return min(0.5 * ratio / max(abs(a.x), 1e-4), 0.5 / max(abs(a.y), 1e-4));
}

// distance from the center to the edge of the paper in the direction a (unit vector):
// the frame shrinking and buckling while it crumples (c), turning into a lumpy ball (k)
float outline(vec2 a, float c, float k, float radius) {
  float rect = frame(a);
  float th = atan(a.y, a.x);
  float buckle = 0.03 + 0.05 * abs(sin(4.0 * th + 0.7)) + 0.03 * abs(sin(9.0 * th + 2.0)) + 0.015 * abs(sin(23.0 * th + 1.3));
  float i = floor((th / (2.0 * PI) + 0.5) * 9.0);
  float a0 = i * 2.0 * PI / 9.0 - PI;
  float a1 = a0 + 2.0 * PI / 9.0;
  vec2 v0 = vec2(cos(a0), sin(a0)) * (0.78 + 0.27 * hash2(vec2(mod(i, 9.0), 3.0)).x);
  vec2 v1 = vec2(cos(a1), sin(a1)) * (0.78 + 0.27 * hash2(vec2(mod(i + 1.0, 9.0), 3.0)).x);
  vec2 e = v1 - v0;
  float ball = radius * (v0.x * e.y - v0.y * e.x) / (a.x * e.y - a.y * e.x);
  return mix(rect * mix(1.0, 0.75, c) * (1.0 - c * buckle), ball, k);
}

// n straight creases of random position, orientation and length, in a space where the
// paper spans about [-span, span]; each one tilts the paper on its two sides (a sharp ridge
// or valley between flat facets) and swallows a strip of the image. They come one after
// another as c grows; px is the half width of a crease line, in the units of x.
void fold(vec2 x, float seed, int n, vec2 span, float len, float c, float px, float weight,
          inout vec2 grad, inout vec2 shift, inout float valley, inout float ridge) {
  float tilt = 2.0 / sqrt(float(n));
  for (int i = 0; i < 32; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 h = hash2(vec2(fi, seed));
    vec2 g = hash2(vec2(fi, seed + 11.8));
    vec2 o = (h - 0.5) * 2.0 * span;
    vec2 nrm = vec2(cos(2.0 * PI * g.x), sin(2.0 * PI * g.x));
    float d = dot(x - o, nrm);
    float along = dot(x - o, vec2(-nrm.y, nrm.x));
    float l = len * (0.5 + g.y);
    float start = 0.4 * fi / float(n);
    float act = weight * smoothstep(start, start + 0.3, c) * (1.0 - smoothstep(0.5 * l, l, abs(along)));
    float amp = (h.x > 0.5 ? 1.0 : -1.0) * (0.5 + 0.5 * h.y);
    float side = d / (abs(d) + px);
    grad += act * amp * side * nrm * tilt;
    shift += act * 0.03 * side * nrm;
    float line = 1.0 - smoothstep(0.0, 2.0 * px, abs(d));
    if (amp < 0.0) valley += act * line;
    else ridge += act * line * amp;
  }
}

vec4 transition(vec2 uv) {
  vec4 b = getToColor(uv);

  // crumpling (c), balling up (k), then tossing (t)
  float c = smoothstep(0.0, 0.6, progress);
  float k = smoothstep(0.1, 0.62, progress);
  float t = smoothstep(0.58, 1.0, progress);
  t *= t;

  vec2 dir = length(direction) > 0.0 ? normalize(direction) : vec2(1.0, 0.0);
  float radius = max(size, 0.01) * mix(1.0, 0.6, t);
  // far enough along the direction for the ball and its shadow (offset and blurred by up
  // to about 0.09 each) to leave the frame
  float reach = 0.5 * (abs(dir.x) * ratio + abs(dir.y)) + 1.2 * radius + 0.3;
  float bend = dir.x < 0.0 ? -1.0 : 1.0;
  vec2 center = dir * reach * t + vec2(-dir.y, dir.x) * 0.15 * bend * sin(PI * t);
  float angle = 0.6 * c - 5.0 * bend * t;
  float lift = 0.012 * c + 0.06 * t;

  vec2 p = (uv - 0.5) * vec2(ratio, 1.0);

  vec2 sp = rot(angle) * (p - center - vec2(0.6, -1.0) * lift);
  float sl = length(sp);
  float sd = sl - outline(sl > 1e-5 ? sp / sl : vec2(1.0, 0.0), c, k, radius);
  float blur = 0.005 + 1.2 * lift;
  vec4 col = vec4(mix(b.rgb, shadow.rgb, shadow.a * c * (1.0 - smoothstep(-blur, blur, sd))), b.a);

  vec2 q = rot(angle) * (p - center);
  float l = length(q);
  vec2 dq = l > 1e-5 ? q / l : vec2(1.0, 0.0);
  float edge = outline(dq, c, k, radius);
  // the edge (about a pixel at 300 px high) is antialiased only once the sheet has left the
  // borders of the frame
  float aa = 0.003 * smoothstep(0.0, 0.1, progress) + 1e-5;
  float inside = 1.0 - smoothstep(-aa, aa, l - edge);
  if (inside <= 0.0) return col;

  // back onto the flat sheet: the outline is mapped onto the frame, the middle of the ball
  // holds more of it, as if the edges were tucked under
  float r = l / edge;
  float rect = frame(dq);
  vec2 s = dq * rect * mix(r, r * (0.6 + 0.4 * r), k);

  int count = creases < 1 ? 1 : creases;
  vec2 grad = vec2(0.0);
  vec2 shift = vec2(0.0);
  float valley = 0.0;
  float ridge = 0.0;
  fold(s, 7.3, count, 0.45 * vec2(ratio, 1.0), 0.6, c, 0.003 * rect / edge, 1.0 - 0.8 * k, grad, shift, valley, ridge);
  vec2 g2 = vec2(0.0);
  vec2 s2 = vec2(0.0);
  float v2 = 0.0;
  float r2 = 0.0;
  fold(q / radius, 2.9, count, vec2(0.7), 8.0, k, 0.003 / radius, k, g2, s2, v2, r2);
  grad += g2 * 0.8;
  vec2 piece = s + shift + s2 * 3.0;

  // facets over the ball's volume, lit from the top left (the light does not turn with the ball)
  float rr = clamp(l / (radius * 1.1), 0.0, 1.0);
  vec3 sphere = vec3(q / (radius * 1.1) * k * 0.8, sqrt(1.0 - 0.64 * rr * rr * k));
  vec3 n = normalize(sphere + vec3(grad, 0.0));
  n.xy = rot(-angle) * n.xy;
  vec3 light = normalize(vec3(-0.5, 0.6, 0.8));
  float diffuse = max(dot(n, light), 0.0);
  vec3 hv = normalize(light + vec3(0.0, 0.0, 1.0));
  // only what facets add over the flat sheet
  float spec = max(pow(max(dot(n, hv), 0.0), 20.0) - pow(hv.z, 20.0), 0.0);
  float level = light.z;
  float relief = min(2.0 * c, 1.0);
  float shade = 1.0 + relief * ((0.12 + diffuse) / (0.12 + level) - 1.0) + 0.7 * spec * relief;
  shade -= 0.2 * relief * min(valley, 1.0);
  shade *= 1.0 - 0.3 * k * smoothstep(0.6, 1.0, r);

  // the edges of the sheet that the folds pull in are mirrored, as if folded back
  vec2 f = piece / vec2(ratio, 1.0) + 0.5;
  vec4 img = getFromColor(1.0 - abs(1.0 - mod(f, 2.0)));
  img.rgb = mix(img.rgb, paper.rgb, 0.6 * min(ridge, 1.0) * paper.a * c);
  vec4 ball = vec4(img.rgb * shade, img.a);

  // mixed premultiplied, so transparent images do not bleed their color
  float m = inside * ball.a;
  vec4 o = vec4(mix(col.rgb * col.a, ball.rgb, m), mix(col.a, 1.0, m));
  return o.a > 0.0 ? vec4(o.rgb / o.a, o.a) : vec4(0.0);
}
`;
export const CRUMPLE_DEFAULTS = Object.freeze({
    creases: 16, size: 0.2, directionX: 1, directionY: 0.4,
    paperColor: '#f5f2e8', paperAlpha: 1,
    shadowColor: '#000000', shadowAlpha: 0.45
});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
const normalColor=(value,fallback)=>{
    const input=String(value||'').trim();
    return /^#[0-9a-f]{6}$/i.test(input)?input.toLowerCase():fallback;
};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function normaliseCrumpleOptions(options={}){
    return {
        creases: Math.round(bound(options.creases,1,32,16)),
        size: bound(options.size,.05,.4,.2),
        directionX: bound(options.directionX,-2,2,1),
        directionY: bound(options.directionY,-2,2,.4),
        paperColor: normalColor(options.paperColor,'#f5f2e8'),
        paperAlpha: bound(options.paperAlpha,0,1,1),
        shadowColor: normalColor(options.shadowColor,'#000000'),
        shadowAlpha: bound(options.shadowAlpha,0,1,.45)
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
${CRUMPLE_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('Crumple failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original Crumple GLSL compilation failed: '+error);
    }
    return shader;
}
export function createCrumpleWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('Crumple requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original Crumple GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'creases','size','direction','paper','shadow'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('Crumple WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('Crumple input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseCrumpleOptions(rawOptions);
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
            gl.uniform1i(uniforms.creases,opts.creases);
            gl.uniform1f(uniforms.size,opts.size);
            gl.uniform2f(uniforms.direction,opts.directionX,opts.directionY);
            gl.uniform4fv(uniforms.paper,new Float32Array([...rgb(opts.paperColor),opts.paperAlpha]));
            gl.uniform4fv(uniforms.shadow,new Float32Array([...rgb(opts.shadowColor),opts.shadowAlpha]));
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('Crumple original shader GPU draw error '+error);
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
export function paintCrumple(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('Crumple requires decoded outgoing and incoming footage');
    const sources=['crumpleFromScratch','crumpleToScratch'].map(key=>{
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
    const shader=renderer.crumpleWebGL??(renderer.crumpleWebGL=createCrumpleWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.crumple);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
