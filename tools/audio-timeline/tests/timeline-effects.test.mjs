import test from 'node:test';
import assert from 'node:assert/strict';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,effectFrameSignature,paintTimelineEffect,requiresCompositeSource,paintEffectPreviewScene} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {PIXEL_EFFECT_IDS,deriveLightMask,separateRgb,isPixelEffect} from '../js/timeline-pixel-effects.mjs';

const makeCanvasRecorder=()=>{
 const log=[];
 const gradient=()=>({addColorStop:(...args)=>log.push(['stop',...args])});
 const context=new Proxy({},{
  get(target,key){if(key==='log')return log;
   if(Object.hasOwn(target,key))return target[key];
   if(key==='globalAlpha')return 1;
   if(key==='createLinearGradient'||key==='createRadialGradient')
    return (...args)=>{log.push([key,...args]);return gradient();};
   return (...args)=>log.push([key,...args]);
  },
  set(target,key,value){target[key]=value;log.push(['set',String(key),typeof value==='number'?Math.round(value*1e5)/1e5:String(value)]);return true;}
 });
 return context;
};
const paint=(preset,t,settings={})=>{
 const ctx=makeCanvasRecorder();
 assert.equal(paintTimelineEffect(ctx,640,360,{presetId:preset,...settings},t,3),true);
 return JSON.stringify(ctx.log);
};
test('phase 3 effect catalog has distinct identities and categories',()=>{
 assert.equal(TIMELINE_EFFECTS.length,36);
 assert.equal(new Set(TIMELINE_EFFECTS.map(x=>x.id)).size,TIMELINE_EFFECTS.length);
 assert.ok(TIMELINE_EFFECTS.every(x=>x.animated&&x.category&&x.group==='effect'));
 assert.deepEqual(
  new Set(TIMELINE_EFFECTS.map(x=>x.category)),
  new Set(['Motion','Light','Distortion','Glitch','Atmospheric','Scanning','Particles/Fire']),
  'the category filter must not expose empty phase-3 groups');
});
test('effect recipe clamps unsafe inputs and normalises colour',()=>{
 const e=normaliseTimelineEffect({presetId:'unknown',intensity:900,speed:0,density:1e8,scale:-3,direction:900,color:'url(javascript:1)'});
 assert.deepEqual(e,{presetId:'light-sweep',intensity:100,speed:.1,density:120,scale:10,direction:180,distortion:55,glow:64,blur:24,originX:20,originY:12,color:'#ffd98d'});
});
test('each procedural recipe is deterministic, time-varying, seek-reversible and isolated',()=>{
 for(const preset of TIMELINE_EFFECTS){
  const start=paint(preset.id,.1),later=paint(preset.id,1.19);
  assert.notEqual(start,later,preset.id+' must change with time');
  assert.equal(start,paint(preset.id,.1),preset.id+' should recreate identical frame after backward seek');
  assert.ok(start.includes('save')&&start.includes('restore'),preset.id+' must preserve canvas state');
 }
});
test('controls change rendered operations without changing old recipes',()=>{
 const orig=paint('particle-dust',.8,{intensity:75,density:18});
 assert.notEqual(orig,paint('particle-dust',.8,{intensity:75,density:90}));
 assert.notEqual(orig,paint('particle-dust',.8,{intensity:25,density:18}));
 assert.notEqual(paint('light-sweep',.8,{direction:0}),paint('light-sweep',.8,{direction:60}));
 assert.notEqual(paint('hazy-atmosphere',.8,{speed:1}),paint('hazy-atmosphere',.8,{speed:2}));
 assert.equal(paint('rhythmic-flicker',.8,{intensity:0}),'[]');
});
test('effect parameters survive snapshots and undo/redo apply',()=>{
 const settings={presetId:'particle-debris',intensity:48,speed:1.7,density:93,scale:120,direction:-35,color:'#caffee'};
 const original={id:'test',type:'sticker',effectOverlay:settings};
 const saved=snapshotClip(original);
 assert.deepEqual(saved.effectOverlay,normaliseTimelineEffect(settings));
 const target={...original,effectOverlay:null};
 applyClipData(target,saved);
 assert.deepEqual(target.effectOverlay,saved.effectOverlay);
 applyClipData(target,{...saved,effectOverlay:null});
 assert.equal(target.effectOverlay,null);
});
test('phase 3B lighting and scanning effects use distinct pixel operations and reversible time',()=>{
 const newIds=['god-rays','light-leaks','pixel-scan','sci-fi-scan'];
 for(const id of newIds){
  assert.notEqual(paint(id,.3),paint(id,1.4),id+' is time-driven');
  assert.equal(paint(id,.3),paint(id,.3),id+' restores the same pixels after seeking');
 }
 assert.notEqual(paint('god-rays',.75),paint('light-leaks',.75));
 assert.notEqual(paint('pixel-scan',.75),paint('sci-fi-scan',.75));
});
test('God Rays origin is validated, editable and serialized',()=>{
 const ray=normaliseTimelineEffect({presetId:'god-rays',originX:83,originY:16});
 assert.equal(ray.originX,83);assert.equal(ray.originY,16);
 assert.notEqual(paint('god-rays',.8,{originX:10,originY:20}),paint('god-rays',.8,{originX:60,originY:65}));
 const record=snapshotClip({id:'ray',type:'sticker',effectOverlay:ray});
 assert.equal(record.effectOverlay.originX,83);
 const target={id:'ray',type:'sticker'};applyClipData(target,record);
 assert.deepEqual(target.effectOverlay,ray);
 const bounded=normaliseTimelineEffect({presetId:'god-rays',originX:-500,originY:1e5});
 assert.equal(bounded.originX,0);assert.equal(bounded.originY,100);
});

test('default source effect origins match physical motion',()=>{
 const pendulum=normaliseTimelineEffect({presetId:'pendulum-swing'});
 const rebound=normaliseTimelineEffect({presetId:'rebound-swing'});
 const shock=normaliseTimelineEffect({presetId:'shockwave'});
 assert.deepEqual([pendulum.originX,pendulum.originY],[50,10]);
 assert.deepEqual([rebound.originX,rebound.originY],[50,10]);
 assert.deepEqual([shock.originX,shock.originY],[50,50]);
 assert.deepEqual(
  [normaliseTimelineEffect({presetId:'god-rays'}).originX,normaliseTimelineEffect({presetId:'god-rays'}).originY],
  [20,12],'Old God Rays origin remains backwards compatible');
});
test('seven Phase 3C recipes are genuinely different Motion, Distortion and Glitch effects',()=>{
 const ids=['pendulum-swing','rebound-swing','vibration-flash','fault-cassette',
     'ripple-distortion','electric-ripple','shockwave'];
 const categories=new Map(TIMELINE_EFFECTS.map(e=>[e.id,e.category]));
 assert.deepEqual(ids.map(id=>categories.get(id)),[
     'Motion','Motion','Motion','Glitch','Distortion','Distortion','Distortion']);
 for(const id of ids){
  assert.equal(requiresCompositeSource(id),true);
  const atStart=paint(id,.24),later=paint(id,1.4);
  assert.notEqual(atStart,later,id+' must vary as seconds change');
  assert.equal(atStart,paint(id,.24),id+' must reproduce pixels after reverse seek');
 }
 assert.equal(requiresCompositeSource('light-sweep'),false);
 assert.notEqual(paint('pendulum-swing',.6),paint('rebound-swing',.6));
 assert.notEqual(paint('ripple-distortion',.6),paint('electric-ripple',.6));
 assert.notEqual(paint('electric-ripple',.6),paint('shockwave',.6));
 assert.notEqual(paint('fault-cassette',.6),paint('vibration-flash',.6));
});
test('source-based warp samples real composited canvas and reuses bounded scratch',()=>{
 const prior=globalThis.document;
 const scratch=makeCanvasRecorder();
 const mockCanvas={width:640,height:360,getContext:()=>scratch};
 let allocated=0;
 globalThis.document={createElement(type){
  assert.equal(type,'canvas');allocated++;
  return mockCanvas;
 }};
 try{
  const ctx=makeCanvasRecorder();
  ctx.canvas={width:640,height:360};
  const effect={presetId:'ripple-distortion',intensity:100};
  assert.equal(paintTimelineEffect(ctx,640,360,effect,.4,3),true);
  assert.equal(paintTimelineEffect(ctx,640,360,effect,1.4,3),true);
  assert.equal(allocated,1,'reuse one scratch canvas per output context');
  assert.ok(scratch.log.some(event=>event[0]==='drawImage'&&event[1]===ctx.canvas),
   'copy the actual composed video frame before warp');
  assert.ok(ctx.log.filter(event=>event[0]==='drawImage').length>=36,
   'reproject sampled video pixels in multiple wave bands');
  const before=ctx.log.length;
  paintTimelineEffect(ctx,640,360,{presetId:'shockwave',originX:60,originY:35},1.2,3);
  assert.ok(ctx.log.slice(before).some(event=>event[0]==='clip'),
   'shockwave must refract a clipped annulus instead of only drawing a circle');
 }finally{
  if(prior===undefined)delete globalThis.document;else globalThis.document=prior;
 }
});
test('swing pivot, warp severity and preview scene are real editable parameters',()=>{
 const normal=normaliseTimelineEffect({presetId:'pendulum-swing',distortion:150,originX:120,originY:-20});
 assert.equal(normal.distortion,100);assert.equal(normal.originX,100);assert.equal(normal.originY,0);
 assert.notEqual(paint('pendulum-swing',.8,{originX:20,originY:10}),
   paint('pendulum-swing',.8,{originX:80,originY:80}));
 assert.notEqual(paint('ripple-distortion',.8,{distortion:10}),
   paint('ripple-distortion',.8,{distortion:90}));
 const clip={id:'source-warp',type:'sticker',effectOverlay:{
  presetId:'shockwave',intensity:85,distortion:70,originX:33,originY:25}};
 const save=snapshotClip(clip),restored={id:clip.id,type:'sticker'};
 applyClipData(restored,save);
 assert.deepEqual(restored.effectOverlay,normaliseTimelineEffect(clip.effectOverlay));
 const preview=makeCanvasRecorder();
 paintEffectPreviewScene(preview,640,360);
 assert.ok(preview.log.some(row=>row[0]==='fillRect'));
 assert.ok(preview.log.some(row=>row[0]==='arc'));
});
test('phase 3D source pixel effects include independent RGB and bright/edge algorithms',()=>{
 assert.deepEqual(PIXEL_EFFECT_IDS,['glow','edge-glow','chromatic-quirk','halo-blur']);
 for(const id of PIXEL_EFFECT_IDS){
  assert.equal(requiresCompositeSource(id),true);
  assert.equal(isPixelEffect(id),true);
  assert.notEqual(paint(id,.25),paint(id,1.44),id+' changes over local time');
  assert.equal(paint(id,.25),paint(id,.25),id+' works with reverse scrubbing');
 }
 assert.equal(isPixelEffect('fire-embers'),false);
 const w=5,h=5,data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++){
  const k=i*4;
  data[k]=15;data[k+1]=15;data[k+2]=15;data[k+3]=255;
 }
 const center=(2*w+2)*4;data[center]=255;data[center+1]=254;data[center+2]=253;
 const bright=deriveLightMask(data,w,h,'glow','#ffdb99',.75);
 const edges=deriveLightMask(data,w,h,'edge-glow','#ffdb99',.75);
 assert.ok(bright[center+3]>100,'bright regions have strong glow');
 assert.equal(bright[0+3],0,'dark regions do not glow');
 assert.equal(edges[center+3],0,'flat central area has no edge response');
 assert.ok(edges[((2*w+1)*4)+3]>0,'edge detects image boundary, not brightness');
 assert.notDeepEqual(bright,edges);
 const channels=separateRgb(new Uint8ClampedArray([21,94,182,255]));
 assert.deepEqual([...channels[0]],[21,0,0,255]);
 assert.deepEqual([...channels[1]],[0,94,0,255]);
 assert.deepEqual([...channels[2]],[0,0,182,255]);
});
test('Phase 3D fire types render as different procedures at each timestamp',()=>{
 const flames=paint('fire-flames',.68);
 const embers=paint('fire-embers',.68);
 const burst=paint('fire-explosion',.68);
 assert.notEqual(flames,embers);assert.notEqual(embers,burst);
 assert.ok(flames.includes('quadraticCurveTo'),'flames use curved flame tongues');
 assert.ok(embers.includes('arc'),'embers are independent particles');
 assert.ok(burst.includes('stroke'),'explosion throws radial streaks');
 for(const id of ['fire-flames','fire-embers','fire-explosion']){
  assert.notEqual(paint(id,.21),paint(id,1.12));
  assert.equal(paint(id,.21),paint(id,.21));
 }
});
test('Glow and blur settings survive clip snapshots with safe bounds',()=>{
 const effect=normaliseTimelineEffect({presetId:'halo-blur',glow:30,blur:18,originX:62,originY:35});
 assert.equal(effect.glow,30);assert.equal(effect.blur,18);
 assert.deepEqual([effect.originX,effect.originY],[62,35]);
 assert.deepEqual([normaliseTimelineEffect({presetId:'halo-blur'}).originX,normaliseTimelineEffect({presetId:'halo-blur'}).originY],[50,50]);
 assert.equal(normaliseTimelineEffect({blur:-44,glow:200}).blur,0);
 assert.equal(normaliseTimelineEffect({blur:-44,glow:200}).glow,100);
 const saved=snapshotClip({id:'soft',type:'sticker',effectOverlay:effect});
 const target={id:'soft',type:'sticker'};
 applyClipData(target,saved);assert.deepEqual(target.effectOverlay,effect);
});
test('fixed frame-local time does not rely on wall clock or frame iteration order',()=>{
 const settings={presetId:'light-sweep',speed:1.25};
 const a=effectFrameSignature(settings,1.25,3);
 assert.equal(a.cycle,1.5625);
 assert.deepEqual(a,effectFrameSignature(settings,1.25,3));
 assert.equal(effectFrameSignature(settings,100,3).seconds,3);
});
