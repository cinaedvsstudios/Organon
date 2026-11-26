import { uploadTransitionTexture } from './texture-upload.mjs';
/**
 * #09 RingsWipe — original gre/MIT independently staggered annular-ring GLSL.
 * Pinned original: https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/RingsWipe.glsl
 * Source blob SHA 7dd2bf87b2c932a9ae6a2fdc47ce25c02c303f55.
 * Alternating clockwise/counterclockwise ring masks, radial mode, center,
 * stagger, smoothing and illuminated optional ring boundaries stay native.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const RINGS_WIPE_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: Concentric rings ripple out from the center and, one after another, each sweeps around like a clock hand in the opposite direction of its neighbors to reveal the incoming image, or fills across its width, with optional colored borders between the rings
// Tags: wipe, circle, radial, rings, clock

// @range(1, 20, 1) Number of rings, from the center to the farthest corner
uniform int count; // = 6
// @param Center of the rings, in texture coordinates
uniform vec2 center; // = vec2(0.5, 0.5)
// @range(0, 1) Delay between the starts of two rings: 0 moves them all together, 1 starts each one when the previous one is done
uniform float stagger; // = 0.5
// @param Each ring fills across its width, outward and inward in turn, instead of sweeping around
uniform bool radial; // = false
// @range(0, 0.05) Width of the borders between the rings while they move, in frame heights (0 disables them)
uniform float borderWidth; // = 0.008
// @color Color of the borders between the rings
uniform vec4 borderColor; // = vec4(1.0, 1.0, 1.0, 1.0)
// @range(0, 0.1) Softness of the edges
uniform float smoothness; // = 0.004

const float PI = 3.141592653589793;
const float AA = 0.0015;

// progress of ring i, from 0 (not started) to 1 (done), each ring lasting d and starting
// k * d after the previous one
float ringProgress(float i, float k, float d, float t) {
  return clamp((t - i * k * d) / d, 0.0, 1.0);
}

// how much ring i, of width w and progress lp, shows the incoming image at radius rad and
// turn a (0 to 1)
float ringMask(float i, float lp, float w, float rad, float a, float s) {
  bool odd = mod(i, 2.0) > 0.5;
  if (radial) {
    // the filled part grows across the ring, from its inner edge or from its outer one,
    // starting and ending a soft edge past the ring; measured within the ring, so a ring
    // that has not started does not leak into its neighbor's antialiased boundary
    float e = s / w;
    float f = mix(-e, 1.0 + e, lp);
    float x = clamp((rad - i * w) / w, 0.0, 1.0);
    float dist = (odd ? f - (1.0 - x) : f - x) * w;
    return smoothstep(-s, s, dist);
  }
  // the filled part is a growing arc from the top, clockwise on even rings and
  // counterclockwise on odd ones; both of its ends are soft, and it starts empty and
  // ends full, wrapping around, by a soft edge measured along the circle (no shorter than
  // the softness itself near the center, so the center is not left half blended)
  float aa = odd ? 1.0 - a : a;
  float arc = 2.0 * PI * max(rad, s);
  float e = s / arc;
  float lo = mix(e, -e, lp);
  float hi = mix(-e, 1.0 + e, lp);
  float dist = max(min(aa - lo, hi - aa), min(aa - 1.0 - lo, hi - aa + 1.0));
  return smoothstep(-s, s, dist * arc);
}

vec4 transition(vec2 uv) {
  vec4 a = getFromColor(uv);
  vec4 b = getToColor(uv);

  float n = float(count < 1 ? 1 : count);
  // measured in square pixels, so the rings are round
  vec2 p = (uv - center) * vec2(ratio, 1.0);
  vec2 far = max(center, 1.0 - center) * vec2(ratio, 1.0);
  float R = length(far) + AA;
  float w = R / n;
  float rad = length(p);
  float turn = rad > 0.0 ? fract(atan(p.x, p.y) / (2.0 * PI)) : 0.0;
  float s = max(min(smoothness, 0.25 * w), AA);
  float t = mix(progress, progress * progress * (3.0 - 2.0 * progress), 0.35);
  float k = clamp(stagger, 0.0, 1.0);
  float d = 1.0 / (1.0 + k * (n - 1.0));

  // blend the two rings on either side of the nearest boundary, so it is antialiased
  float j = floor(rad / w + 0.5);
  float inner = clamp(j - 1.0, 0.0, n - 1.0);
  float outer = clamp(j, 0.0, n - 1.0);
  float li = ringProgress(inner, k, d, t);
  float lo = ringProgress(outer, k, d, t);
  float m = mix(
    ringMask(inner, li, w, rad, turn, s),
    ringMask(outer, lo, w, rad, turn, s),
    smoothstep(-AA, AA, rad - j * w)
  );

  // mixed premultiplied, so transparent images do not bleed their color
  vec4 c = mix(vec4(a.rgb * a.a, a.a), vec4(b.rgb * b.a, b.a), m);

  // the border between two rings shows from when the inner one starts until the outer one
  // is done, without dimming when one hands over to the other
  if (borderWidth > 0.0 && j >= 1.0 && j <= n - 1.0) {
    float on = min(1.0, 4.0 * li * (1.0 - lo));
    // never wider than the ring, and thinner than the antialiasing only by fading out
    float hw = min(0.5 * borderWidth, 0.5 * w - AA);
    float line = (1.0 - smoothstep(hw - AA, hw + AA, abs(rad - j * w)))
      * min(1.0, borderWidth / (2.0 * AA));
    float o = borderColor.a * line * on;
    c = vec4(borderColor.rgb * o, o) + c * (1.0 - o);
  }
  return c.a > 0.0 ? vec4(c.rgb / c.a, c.a) : vec4(0.0);
}
`;
export const RINGS_WIPE_DEFAULTS = Object.freeze({
    count:6,centerX:.5,centerY:.5,stagger:.5,radial:false,
    borderWidth:.008,borderColor:'#ffffff',borderAlpha:1,smoothness:.004
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
export function normaliseRingsWipeOptions(options={}){
    return {
        count:Math.round(bound(options.count,1,20,6)),
        centerX:bound(options.centerX,0,1,.5),
        centerY:bound(options.centerY,0,1,.5),
        stagger:bound(options.stagger,0,1,.5),
        radial:options.radial===true||options.radial==='true',
        borderWidth:bound(options.borderWidth,0,.05,.008),
        borderColor:color(options.borderColor,'#ffffff'),
        borderAlpha:bound(options.borderAlpha,0,1,1),
        smoothness:bound(options.smoothness,0,.1,.004)
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
${RINGS_WIPE_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('RingsWipe failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original RingsWipe GLSL compilation failed: '+error);
    }
    return shader;
}
export function createRingsWipeWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('RingsWipe requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original RingsWipe GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'count','center','stagger','radial','borderWidth','borderColor','smoothness'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('RingsWipe WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('RingsWipe input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseRingsWipeOptions(rawOptions);
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
            gl.uniform1i(uniforms.count,opts.count);
            gl.uniform2f(uniforms.center,opts.centerX,opts.centerY);
            gl.uniform1f(uniforms.stagger,opts.stagger);
            gl.uniform1i(uniforms.radial,opts.radial?1:0);
            gl.uniform1f(uniforms.borderWidth,opts.borderWidth);
            gl.uniform4fv(uniforms.borderColor,new Float32Array([...rgb(opts.borderColor),opts.borderAlpha]));
            gl.uniform1f(uniforms.smoothness,opts.smoothness);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('RingsWipe original shader GPU draw error '+error);
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
export function paintRingsWipe(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('RingsWipe requires decoded outgoing and incoming footage');
    const sources=['ringsWipeFromScratch','ringsWipeToScratch'].map(key=>{
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
    const shader=renderer.ringsWipeWebGL??(renderer.ringsWipeWebGL=createRingsWipeWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['rings-wipe']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
