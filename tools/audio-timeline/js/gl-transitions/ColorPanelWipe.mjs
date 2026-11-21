/**
 * #11 ColorPanelWipe: original gre/MIT multi-colour sliding panels GLSL.
 * Pinned shader: https://github.com/gl-transitions/gl-transitions/blob/7f48be1e2c09a54f74cfdd927bb0f512a652c051/transitions/ColorPanelWipe.glsl
 * Upstream blob SHA ce1d502ca70684e13baa3b910ce93506ee133347.
 * Original shader body is byte-identical. Preserve colored front/back
 * sweeps, stagger, angled edges, cut/hold and transparent panel alpha.
 */
import { applyVisualContext, drawVisualVignette } from '../visual-clip-adjustments.mjs';
import { visualFadeOpacity } from '../visual-transitions.mjs';

export const COLOR_PANEL_WIPE_SOURCE = String.raw`// Author: gre
// License: MIT
// Description: Solid color panels, slightly staggered, sweep across and cover the frame, then sweep off the far side and reveal the incoming image
// Tags: wipe, panels, color, slanted, motion-graphics

// @param Direction the panels sweep toward
uniform vec2 direction; // = vec2(1.0, 0.0)
// @range(1, 3, 1) Number of panels
uniform int panels; // = 3
// @color Color of the first panel
uniform vec4 color1; // = vec4(0.98, 0.76, 0.22, 1.0)
// @color Color of the second panel
uniform vec4 color2; // = vec4(0.93, 0.33, 0.36, 1.0)
// @color Color of the third panel
uniform vec4 color3; // = vec4(0.16, 0.2, 0.42, 1.0)
// @range(0, 1) Delay between the panels, relative to the sweep of one panel (at 0, they move as one and only the last shows)
uniform float stagger; // = 0.35
// @range(-1, 1) Slant of the panels' edges
uniform float skew; // = 0.25

// the frame is fully covered from cut - hold to cut + hold, where the image switches
const float cut = 0.46;
const float hold = 0.01;
const float aa = 0.0015;

float ease(float t) {
  float s = clamp(t, 0.0, 1.0);
  float u = 1.0 - s * s * (3.0 - 2.0 * s);
  return 1.0 - u * u * u;
}

float cover(float x, float back, float front) {
  return smoothstep(back - aa, back + aa, x) * (1.0 - smoothstep(front - aa, front + aa, x));
}

vec4 transition(vec2 uv) {
  vec2 dir = length(direction) > 0.0 ? normalize(direction) : vec2(1.0, 0.0);
  vec2 p = (uv - 0.5) * vec2(ratio, 1.0);
  float k = clamp(skew, -1.0, 1.0);
  vec2 a = (dir + k * vec2(-dir.y, dir.x)) / sqrt(1.0 + k * k);
  float x = dot(p, a);
  float e = 0.5 * (abs(a.x) * ratio + abs(a.y));
  float start = -e - 2.0 * aa;
  float span = 2.0 * (e + 2.0 * aa);

  int n = panels < 1 ? 1 : panels > 3 ? 3 : panels;
  float m = float(n - 1);
  float st = clamp(stagger, 0.0, 1.0);
  vec2 d = vec2(cut - hold, 1.0 - cut - hold) / (1.0 + m * st);

  // the first panel enters first and leaves last; both images are sampled so no texture read sits in a divergent branch
  float front0 = start + span * ease(progress / d.x);
  float back0 = start + span * ease((progress - 1.0 + d.y) / d.y);
  vec4 c = mix(getToColor(uv), getFromColor(uv), step(0.5 * (front0 + back0), x));
  c = mix(c, color1, cover(x, back0, front0));

  for (int i = 1; i < 3; i++) {
    if (i < n) {
      vec2 t = float(i) * st * d;
      float front = start + span * ease((progress - t.x) / d.x);
      float back = start + span * ease((progress - 1.0 + d.y + t.y) / d.y);
      c = mix(c, i == 1 ? color2 : color3, cover(x, back, front));
    }
  }
  return c.a > 0.0 ? c : vec4(0.0);
}
`;
export const COLOR_PANEL_WIPE_DEFAULTS = Object.freeze({
    directionX:1,directionY:0,panels:3,stagger:.35,skew:.25,
    color1:'#fac238',alpha1:1,color2:'#ed545c',alpha2:1,color3:'#29336b',alpha3:1
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
export function normaliseColorPanelWipeOptions(options={}){
    return {
        directionX:bound(options.directionX,-2,2,1),
        directionY:bound(options.directionY,-2,2,0),
        panels:Math.round(bound(options.panels,1,3,3)),
        stagger:bound(options.stagger,0,1,.35),
        skew:bound(options.skew,-1,1,.25),
        color1:color(options.color1,'#fac238'),
        alpha1:bound(options.alpha1,0,1,1),
        color2:color(options.color2,'#ed545c'),
        alpha2:bound(options.alpha2,0,1,1),
        color3:color(options.color3,'#29336b'),
        alpha3:bound(options.alpha3,0,1,1)
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
${COLOR_PANEL_WIPE_SOURCE}
void main(){gl_FragColor=transition(uv);}`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    if(!shader)throw Error('ColorPanelWipe failed to allocate WebGL shader');
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader)||'Unknown GLSL compilation error';
        gl.deleteShader(shader);
        throw Error('Original ColorPanelWipe GLSL compilation failed: '+error);
    }
    return shader;
}
export function createColorPanelWipeWebGLRenderer(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{
        alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,
        premultipliedAlpha:false
    });
    if(!gl)throw Error('ColorPanelWipe requires WebGL to reproduce the original GLSL');
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
        throw Error('Original ColorPanelWipe GLSL link failed: '+gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=[gl.createTexture(),gl.createTexture()];
    const position=gl.getAttribLocation(program,'position');
    const uniforms=Object.fromEntries([
        'fromTexture','toTexture','progress','ratio',
        'direction','panels','color1','color2','color3','stagger','skew'
    ].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.disable(gl.BLEND);
    return {
        canvas,
        render(from,to,progress,rawOptions={}){
            if(gl.isContextLost())throw Error('ColorPanelWipe WebGL context lost');
            const width=from.width,height=from.height;
            if(to.width!==width||to.height!==height)
                throw Error('ColorPanelWipe input frames must have matching dimensions');
            if(canvas.width!==width)canvas.width=width;
            if(canvas.height!==height)canvas.height=height;
            const opts=normaliseColorPanelWipeOptions(rawOptions);
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
            gl.uniform2f(uniforms.direction,opts.directionX,opts.directionY);
            gl.uniform1i(uniforms.panels,opts.panels);
            gl.uniform4fv(uniforms.color1,new Float32Array([...rgb(opts.color1),opts.alpha1]));
            gl.uniform4fv(uniforms.color2,new Float32Array([...rgb(opts.color2),opts.alpha2]));
            gl.uniform4fv(uniforms.color3,new Float32Array([...rgb(opts.color3),opts.alpha3]));
            gl.uniform1f(uniforms.stagger,opts.stagger);
            gl.uniform1f(uniforms.skew,opts.skew);
            gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const error=gl.getError();
            if(error!==gl.NO_ERROR)throw Error('ColorPanelWipe original shader GPU draw error '+error);
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
export function paintColorPanelWipe(renderer,context,toTrack,width,height,time,drawContained,progress){
    const fromTrack=renderer.tracks?.find(t=>t.id===toTrack.transitionFromId);
    if(!fromTrack?.media||!toTrack?.media)
        throw Error('ColorPanelWipe requires decoded outgoing and incoming footage');
    const sources=['colorPanelWipeFromScratch','colorPanelWipeToScratch'].map(key=>{
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
    const shader=renderer.colorPanelWipeWebGL??(renderer.colorPanelWipeWebGL=createColorPanelWipeWebGLRenderer());
    const frame=shader.render(sources[0],sources[1],progress,toTrack.transitionParameters?.['color-panel-wipe']);
    context.save();context.setTransform(1,0,0,1,0,0);context.filter='none';
    context.globalCompositeOperation='source-over';context.globalAlpha=1;
    context.drawImage(frame,0,0,width,height);
    context.restore();
    return true;
}
