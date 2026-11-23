/** MotoriClip #55 — native God Rays source scattering/Undo and visual QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGodRaysFrame,sampleGodRay,renderGodRays}
 from '../js/timeline-god-rays.mjs';
import {normaliseTimelineEffect,paintTimelineEffect,requiresCompositeSource}
 from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
const W=96,H=54;
const fx=patch=>normaliseTimelineEffect({presetId:'god-rays',
 intensity:95,speed:1.4,density:80,scale:125,direction:0,
 originX:20,originY:12,distortion:80,glow:90,blur:30,color:'#ffe2b0',...patch});
function scene(shift=0,dark=false){
 const data=new Uint8ClampedArray(W*H*4);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const k=(y*W+x)*4;
  const v=dark?23:(x>8+shift&&x<40+shift&&y>4&&y<25&&
   !(x>24+shift&&x<28+shift)?235:20);
  data[k]=v;data[k+1]=v;data[k+2]=v;data[k+3]=255;
 }
 return data;
}
const image=(e,t,source=scene())=>buildGodRaysFrame(source,W,H,e,e.speed*t);
const fingerprint=data=>{let h=2166136261>>>0;for(const v of data)h=Math.imul(h^v,16777619)>>>0;return h;};
test('Volumetric rays respond to real footage highlights and occlusions, not painted polygons',()=>{
 const e=fx({}),source=scene(),bright=image(e,.54,source),
  dark=image(e,.54,scene(0,true)),moved=image(e,.54,scene(15));
 const alpha=[],darkAlpha=[];
 for(let k=3;k<bright.data.length;k+=4){alpha.push(bright.data[k]);darkAlpha.push(dark.data[k]);}
 assert.equal(Math.max(...darkAlpha),0,'Dark underlying footage cannot manufacture false light shafts');
 assert.ok(Math.max(...alpha)>125,'A bright source emits visibly luminous shafts');
 assert.ok(alpha.filter(v=>v>15).length>250,'Light extends beyond the actual bright source');
 assert.ok(alpha.filter(v=>v>40).length>150,'Source light creates distinct projected beams');
 assert.ok(new Set(alpha).size>90,'Soft attenuated edges, not nine hard generic triangles');
 assert.ok(Math.max(...alpha)<255,'Video footage must remain visible through transparent shafts');
 assert.notEqual(fingerprint(bright.data),fingerprint(moved.data),
  'Moving actual source highlights changes projected source-aware shafts');
 assert.deepEqual(source,scene(),'Shader must not mutate source image');
 const sample=sampleGodRay(source,W,H,e,.54*e.speed,24,35);
 assert.ok(sample.emitterLight>.6,'Nearby source highlight is detected');
 assert.ok(sample.emitterX>=0&&sample.emitterY>=0,'Emitter stays within source image');
 assert.ok(bright.emitter.brightness>.6);
});
test('Organic scattering rays have independently changing reach, direction and local turbulence',()=>{
 const e=fx({}),times=[.10,.54,1.01,1.74],
  frames=times.map(t=>image(e,t));
 assert.equal(new Set(frames.map(f=>fingerprint(f.data))).size,4);
 assert.deepEqual(frames[1],image(e,times[1]),'Reverse seeks are byte-identical');
 const input=scene();
 let lit=0,changed=0;
 for(let y=8;y<H;y+=4)for(let x=10;x<W;x+=6){
  const a=sampleGodRay(input,W,H,e,.2*e.speed,x,y);
  const b=sampleGodRay(input,W,H,e,1.2*e.speed,x,y);
  if(a.alpha>.001||b.alpha>.001){
   lit++;
   if(Math.abs(a.shaft-b.shaft)>.01||Math.abs(a.alpha-b.alpha)>.002)changed++;
  }
 }
 assert.ok(lit>25&&changed>20,
  'Separate luminous shaft regions must deform independently, not move as a rigid card');
 const alpha0=Array.from({length:W*H},(_,i)=>frames[0].data[4*i+3]);
 const alpha1=Array.from({length:W*H},(_,i)=>frames[3].data[4*i+3]);
 assert.ok(alpha0.filter((v,i)=>Math.abs(v-alpha1[i])>=6).length>100,
  'Visible light scattering changes at many independent source pixels');
});
test('Every native Inspector parameter changes actual light pixels and preserves portable Undo',()=>{
 const e=fx({}),baseline=fingerprint(image(e,.54).data);
 for(const change of [{intensity:20},{speed:2.6},{density:12},
  {scale:190},{direction:-92},{originX:78},{originY:78},
  {distortion:0},{glow:0},{blur:0},{color:'#86cfff'}]){
  assert.notEqual(fingerprint(image(fx(change),.54).data),baseline,
   'God Rays native control changes real light pixels '+JSON.stringify(change));
 }
 const snapshot=snapshotClip({id:'rays',type:'sticker',effectOverlay:e});
 const restored={id:'rays',type:'sticker'};
 applyClipData(restored,snapshot);
 assert.deepEqual(restored.effectOverlay,e);
 assert.deepEqual(image(restored.effectOverlay,.72),image(e,.72));
 applyClipData(restored,{...snapshot,effectOverlay:null});
 assert.equal(restored.effectOverlay,null);
 assert.equal(requiresCompositeSource('god-rays'),true,
  'God Rays must capture the actual previously composited source footage');
});
test('No-source schematic is soft, time dependent and does not draw sharp triangles',()=>{
 const make=()=>{
  const log=[],grad=()=>({addColorStop:(...v)=>log.push(['stop',...v])});
  const ctx=new Proxy({},{
   get(o,k){if(Object.hasOwn(o,k))return o[k];
    if(k==='globalAlpha')return 1;
    if(k==='createRadialGradient')return (...v)=>{log.push(['radial',...v]);return grad();};
    return (...v)=>log.push([k,...v]);},
   set(o,k,v){o[k]=v;log.push(['set',String(k),v]);return true;}
  });return {ctx,log};
 };
 const e=fx({}),a=make(),b=make(),c=make();
 assert.equal(renderGodRays(a.ctx,null,320,180,e,.5,.9),true);
 renderGodRays(b.ctx,null,320,180,e,.5,.9);
 renderGodRays(c.ctx,null,320,180,e,1.7,.9);
 assert.equal(JSON.stringify(a.log),JSON.stringify(b.log));
 assert.notEqual(JSON.stringify(a.log),JSON.stringify(c.log));
 assert.ok(a.log.filter(x=>x[0]==='radial').length>=5);
 assert.ok(!a.log.some(x=>['lineTo','closePath','bezierCurveTo'].includes(x[0])),
  'Source-less schematic never displays hard-edged triangular wedge geometry');
 const parent=make();
 assert.equal(paintTimelineEffect(parent.ctx,320,180,e,.5/e.speed,3),true);
 assert.ok(parent.log.some(x=>x[0]==='radial'),'Existing timeline ID invokes organic renderer');
});
