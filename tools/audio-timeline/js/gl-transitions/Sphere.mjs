import { uploadTransitionTexture } from './texture-upload.mjs';
/**
 * #08 Sphere — gre/MIT original rolling-shaded textured globe shader.
 * Original source: https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/Sphere.glsl
 * Source blob SHA 99e56512c557ef66ae5f9a9fbf30e5344bd40fbb.
 * Native spherical wrap, light/specular, moving shadow, shrink and roll,
 * original premultiplied alpha preserved byte-for-byte within source.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const SPHERE_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: The outgoing image wraps itself onto a shaded ball that shrinks and rolls away, revealing the incoming image under its shadow
// Tags: 3d, sphere, roll, wrap, shape

// @param Direction the ball rolls away toward
uniform vec2 direction; // = vec2(1.0, 0.0)
// @range(0.1, 0.5) Radius of the ball once wrapped, relative to the shorter side of the frame
uniform float size; // = 0.3
// @range(0, 1) Strength of the light and shading on the ball
uniform float shading; // = 0.6
// @range(0, 1) Darkness of the soft shadow the ball casts on the incoming image
uniform float shadow; // = 0.5

const float PI = 3.14159265;
const float AA = 0.0015;
const vec3 LIGHT = vec3(-0.5, 0.6, 1.0) / 1.2689;

vec4 transition(vec2 uv) {
  vec4 b = getToColor(uv);

  vec2 dir = length(direction) > 0.0 ? normalize(direction) : vec2(1.0, 0.0);
  vec2 side = vec2(-dir.y, dir.x);
  vec2 p = (uv - 0.5) * vec2(ratio, 1.0);
  float shorter = min(ratio, 1.0);
  float r0 = clamp(size, 0.1, 0.5) * shorter;

  // the image curves into a ball (infinite radius: exactly flat at the start), then the
  // ball shrinks while rolling away until it and its shadow have left the frame
  float w = clamp(progress / 0.45, 0.0, 1.0);
  w = 1.0 - (1.0 - w) * (1.0 - w);
  float away = smoothstep(0.3, 1.0, progress);
  away *= away;
  float wrapped = r0 / max(w, 1e-4);
  float radius = wrapped * mix(1.0, 0.5, away);
  // the image is pulled tighter as it wraps, so that it ends up covering the whole ball
  // (its shortest half extent reaches around to the back)
  float tight = mix(1.0, min(1.0, 0.48 * shorter / (PI * r0)), w * w);
  float paper = radius * tight;
  float e = 0.5 * (abs(dir.x) * ratio + abs(dir.y));
  // far enough that the ball (0.5 * r0 by then) and its shadow (within 0.9 * r0 of it) have left
  float full = e + 1.1 * r0 + 2.0 * AA;
  float travel = away * full;
  vec2 center = dir * travel;
  // rolling without slipping: the integral of dtravel / radius while the radius shrinks
  float angle = -2.0 * full * log(1.0 - 0.5 * away) / wrapped;

  vec2 d = p - center;
  float r = length(d);

  vec2 sd = d - vec2(0.25, -0.3) * radius * w;
  float sh = shadow * w * (1.0 - smoothstep(0.6 * radius, 1.4 * radius, length(sd)));
  vec4 bg = vec4(b.rgb * b.a * (1.0 - sh), b.a);

  vec4 ball = vec4(0.0);
  float cover = 1.0 - smoothstep(radius - AA, radius + AA, r);
  if (cover > 0.0) {
    // normal of the visible point of the ball (no squared radius, which overflows when it is huge)
    vec2 nd = d / radius;
    vec3 n = vec3(nd, sqrt(max(1.0 - dot(nd, nd), 0.0)));
    float u = dot(n.xy, dir);
    float s = dot(n.xy, side);
    float cu = cos(angle), su = sin(angle);
    vec3 q = vec3(u * cu - n.z * su, s, u * su + n.z * cu);
    // the image is wrapped around the ball from its front point, distances kept along the surface
    float lq = length(q.xy);
    float arc = atan(lq, q.z) * paper;
    vec2 img = lq > 0.0 ? (q.x * dir + q.y * side) / lq * arc : vec2(0.0);
    vec2 iuv = img / vec2(ratio, 1.0) + 0.5;
    vec2 edge = min(iuv, 1.0 - iuv) * vec2(ratio, 1.0);
    float inside = cover * smoothstep(-AA, AA, min(edge.x, edge.y));
    if (inside > 0.0) {
      vec4 c = getFromColor(clamp(iuv, 0.0, 1.0));
      float diff = max(dot(n, LIGHT), 0.0);
      float spec = pow(max(reflect(-LIGHT, n).z, 0.0), 24.0);
      float k = shading * w;
      vec3 lit = c.rgb * mix(1.0, 0.25 + 0.85 * diff, k) + 0.35 * k * spec;
      ball = vec4(clamp(lit, 0.0, 1.0) * c.a, c.a) * inside;
    }
  }

  // the ball over the incoming image, premultiplied so transparent images do not bleed their color
  vec4 c = ball + bg * (1.0 - ball.a);
  return c.a > 0.0 ? vec4(c.rgb / c.a, c.a) : vec4(0.0);
}
`;
export const SPHERE_DEFAULTS = Object.freeze({
    directionX:1,directionY:0,size:.3,shading:.6,shadow:.5
});
const bound=(value,min,max,fallback)=>{
    if(value===undefined||value===null||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
export function normaliseSphereOptions(options={}){
    return {
        directionX:bound(options.directionX,-2,2,1),
        directionY:bound(options.directionY,-2,2,0),
        size:bound(options.size,.1,.5,.3),
        shading:bound(options.shading,0,1,.6),
        shadow:bound(options.shadow,0,1,.5)
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
${SPHERE_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('Sphere failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original Sphere GLSL compilation failed: '+error);
    }
    return shader;
}
export function createSphereWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('Sphere requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original Sphere GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'direction','size','shading','shadow'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('Sphere WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('Sphere input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseSphereOptions(rawOptions);
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
            gl.uniform1f(uniforms.size,opts.size);
            gl.uniform1f(uniforms.shading,opts.shading);
            gl.uniform1f(uniforms.shadow,opts.shadow);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('Sphere original shader GPU draw error '+error);
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
export function paintSphere(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('Sphere requires decoded outgoing and incoming footage');
    const sources=['sphereFromScratch','sphereToScratch'].map(key=>{
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
    const shader=renderer.sphereWebGL??(renderer.sphereWebGL=createSphereWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.sphere);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
