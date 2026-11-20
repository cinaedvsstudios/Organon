import test from 'node:test';
import assert from 'node:assert/strict';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,effectFrameSignature,paintTimelineEffect} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';

const makeCanvasRecorder=()=>{
 const log=[];
 const gradient=()=>({addColorStop:(...args)=>log.push(['stop',...args])});
 const context=new Proxy({},{
  get(target,key){if(key==='log')return log;
   if(key==='createLinearGradient'||key==='createRadialGradient')
    return (...args)=>{log.push([key,...args]);return gradient();};
   return (...args)=>log.push([key,...args]);
  },
  set(target,key,value){log.push(['set',String(key),typeof value==='number'?Math.round(value*1e5)/1e5:String(value)]);return true;}
 });
 return context;
};
const paint=(preset,t,settings={})=>{
 const ctx=makeCanvasRecorder();
 assert.equal(paintTimelineEffect(ctx,640,360,{presetId:preset,...settings},t,3),true);
 return JSON.stringify(ctx.log);
};
test('phase 3 effect catalog has distinct identities and categories',()=>{
 assert.equal(TIMELINE_EFFECTS.length,6);
 assert.equal(new Set(TIMELINE_EFFECTS.map(x=>x.id)).size,6);
 assert.ok(TIMELINE_EFFECTS.every(x=>x.animated&&x.category&&x.group==='effect'));
});
test('effect recipe clamps unsafe inputs and normalises colour',()=>{
 const e=normaliseTimelineEffect({presetId:'unknown',intensity:900,speed:0,density:1e8,scale:-3,direction:900,color:'url(javascript:1)'});
 assert.deepEqual(e,{presetId:'light-sweep',intensity:100,speed:.1,density:120,scale:10,direction:180,color:'#ffd98d'});
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
test('fixed frame-local time does not rely on wall clock or frame iteration order',()=>{
 const settings={presetId:'light-sweep',speed:1.25};
 const a=effectFrameSignature(settings,1.25,3);
 assert.equal(a.cycle,1.5625);
 assert.deepEqual(a,effectFrameSignature(settings,1.25,3));
 assert.equal(effectFrameSignature(settings,100,3).seconds,3);
});
