import test from 'node:test';
import assert from 'node:assert/strict';
import {GLITCH_PRESETS,isGlitchEffect,renderGlitchEffect} from '../js/timeline-glitch-effects.mjs';
import {TIMELINE_EFFECTS,paintTimelineEffect,normaliseTimelineEffect,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';

const ctxRecorder=()=>{
 const calls=[];
 const ctx=new Proxy({canvas:null},{
  get(target,key){
   if(key==='calls')return calls;
   if(key in target)return target[key];
   if(key==='globalAlpha')return 1;
   if(key==='createLinearGradient'||key==='createRadialGradient')
    return (...args)=>{calls.push([key,...args]);return {addColorStop:(...params)=>calls.push(['stop',...params])};};
   return (...args)=>calls.push([key,...args]);
  },
  set(target,key,value){target[key]=value;calls.push(['set',key,String(value)]);return true;}
 });
 return ctx;
};
const paint=(id,time,parameters={})=>{
 const ctx=ctxRecorder();
 assert.equal(paintTimelineEffect(ctx,640,360,{presetId:id,...parameters},time,3),true);
 return JSON.stringify(ctx.calls);
};

test('nine genuinely different source-aware glitch IDs populate the existing Glitch category',()=>{
 assert.equal(GLITCH_PRESETS.length,9);
 assert.equal(new Set(GLITCH_PRESETS.map(x=>x.id)).size,9);
 const full=new Set(TIMELINE_EFFECTS.map(x=>x.id));
 assert.equal(TIMELINE_EFFECTS.length,43);
 for(const entry of GLITCH_PRESETS){
  assert.equal(entry.category,'Glitch');
  assert.equal(entry.group,'effect');
  assert.equal(entry.animated,true);
  assert.ok(full.has(entry.id));
  assert.equal(isGlitchEffect(entry.id),true);
  assert.equal(requiresCompositeSource(entry.id),true);
 }
 assert.equal(TIMELINE_EFFECTS.filter(x=>x.category==='Glitch').length,17);
 assert.equal(isGlitchEffect('fault-cassette'),false);
});

test('nine glitches render distinct structures and reproducible frames under backwards seeking',()=>{
 const signatures=new Set();
 for(const {id} of GLITCH_PRESETS){
  const start=paint(id,.24);
  const later=paint(id,1.34);
  assert.notEqual(start,later,id+' needs actual time-based animation');
  assert.equal(start,paint(id,.24),id+' must exactly reproduce same frame after backwards seek');
  assert.ok(start.includes('"save"')&&start.includes('"restore"'),id+' must preserve Canvas state');
  signatures.add(start);
 }
 assert.equal(signatures.size,9,'nine effects must not share the same drawing instructions');
});

test('effect algorithms use different geometry, filters and colour operations',()=>{
 const sample=Object.fromEntries(GLITCH_PRESETS.map(x=>[x.id,paint(x.id,.43)]));
 assert.ok(sample['glass-glitch'].includes('"clip"'),'Glass Glitch creates independent clipped shards');
 assert.ok(sample['glitch-storm'].includes('"drawImage"')||sample['glitch-storm'].includes('"fillRect"'));
 assert.ok(sample['negative-chaos'].includes('invert(1)'),'Negative Chaos inverts pixel regions');
 assert.ok(sample['warning-glitch'].includes('"strokeRect"'),'Warning Glitch draws visual hazard frame');
 assert.ok(sample.misalignment.includes('hue-rotate'),'Misalignment separates tinted ghost images');
 assert.ok(sample['noir-glitch'].includes('grayscale'),'Noir Glitch uses monochrome contrast');
 assert.ok(sample['glitch-flux'].includes('"drawImage"')||sample['glitch-flux'].includes('"fillRect"'));
 assert.ok(sample['engine-heat'].includes('"fillRect"')&&!sample['engine-heat'].includes('"bezierCurveTo"'),
  'Engine Heat should not draw fake vertical heat tendrils');
 assert.ok(sample['retro-glitch'].includes('"fillRect"'),'Retro Glitch has actual CRT scan lines');
});

test('source-aware effects reproject underlying frame pixels, not a static preset PNG',()=>{
 const frame={width:640,height:360};
 for(const {id} of GLITCH_PRESETS){
  const ctx=ctxRecorder();
  assert.equal(renderGlitchEffect(ctx,frame,640,360,normaliseTimelineEffect({presetId:id}),.55,.8),true);
  const operations=ctx.calls.filter(c=>c[0]==='drawImage');
  if(id!=='retro-glitch')assert.ok(operations.some(c=>c[1]===frame),id+' must read source pixels');
  assert.ok(ctx.calls.some(c=>c[0]==='save'),id+' uses isolated canvas state');
  assert.ok(ctx.calls.some(c=>c[0]==='restore'),id+' restores prior canvas state');
 }
});

test('strength, direction, speed, and density influence the intended glitches',()=>{
 assert.notEqual(paint('glitch-storm',.42,{density:10}),paint('glitch-storm',.42,{density:50}));
 assert.notEqual(paint('glass-glitch',.42,{distortion:15}),paint('glass-glitch',.42,{distortion:85}));
 assert.notEqual(paint('engine-heat',.42,{speed:.5}),paint('engine-heat',.42,{speed:3}));
 assert.notEqual(paint('misalignment',.42,{direction:-90}),paint('misalignment',.42,{direction:90}));
 const overlay=normaliseTimelineEffect({presetId:'negative-chaos',distortion:76,color:'#c0fefe',density:66});
 const saved=snapshotClip({id:'clip',type:'sticker',effectOverlay:overlay});
 const target={id:'clip',type:'sticker'};
 applyClipData(target,saved);
 assert.deepEqual(target.effectOverlay,overlay,'portable project and Undo must retain glitch settings');
});

test('Retro Glitch reuses a resolution-bounded, low-resolution CRT sample canvas',()=>{
 const previous=globalThis.document;
 let created=0;
 const samples=[];
 globalThis.document={createElement(name){
  assert.equal(name,'canvas');created++;
  const canvas={width:0,height:0,getContext(){return ctxRecorder();}};
  samples.push(canvas);
  return canvas;
 }};
 try{
  const ctx=ctxRecorder();
  const frame={width:3840,height:2160};
  const settings=normaliseTimelineEffect({presetId:'retro-glitch',scale:200});
  assert.ok(renderGlitchEffect(ctx,frame,3840,2160,settings,.28,.8));
  assert.ok(renderGlitchEffect(ctx,frame,3840,2160,settings,.8,.8));
  assert.equal(created,1,'CRT scratch buffer should be reused');
  assert.ok(Math.max(samples[0].width,samples[0].height)<=640,'CRT sampling must remain bounded at 4K');
  assert.ok(ctx.calls.some(c=>c[0]==='drawImage'&&c[1]===samples[0]));
 }finally{
  if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
 }
});
