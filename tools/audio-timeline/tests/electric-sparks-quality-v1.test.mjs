/** MotoriClip #66 quality gate unit: real branching electric sparks, not straight ticks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildElectricSparksFrame,renderElectricSparks} from '../js/timeline-electric-sparks.mjs';
import {normaliseTimelineEffect,TIMELINE_EFFECTS} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';
const W=320,H=180;
const settings=(overrides={})=>normaliseTimelineEffect({
 presetId:'particle-sparks',density:72,scale:140,distortion:84,direction:30,
 color:'#65e8ff',glow:88,originX:62,originY:48,
 sparkForks:3,sparkLife:.46,sparkSeed:6666,intensity:95,speed:1.2,...overrides
});
const frame=(overrides={},time=.72)=>{const fx=settings(overrides);
 return buildElectricSparksFrame(W,H,fx,time*fx.speed);};
const metrics=state=>state.sparks.map(s=>[Math.round(s.tip.x*10)/10,Math.round(s.tip.y*10)/10,
 s.branches.length,Math.round(s.alpha*100)/100]);
test('keeps the same Electric Sparks preset identity, not a second fake effect',()=>{
 assert.equal(TIMELINE_EFFECTS.filter(x=>x.id==='particle-sparks').length,1);
 const preset=normaliseTimelineEffect({presetId:'particle-sparks'});
 assert.equal(preset.color,'#63dcff');
 assert.deepEqual([preset.sparkForks,preset.sparkLife,preset.sparkSeed,preset.originX,preset.originY],
  [2,.38,6666,50,62]);
 const limits=settings({sparkForks:10,sparkLife:4,sparkSeed:999999});
 assert.deepEqual([limits.sparkForks,limits.sparkLife,limits.sparkSeed],[4,.9,99999]);
 for(const p of ['particle-debris','particle-dust','fire-embers'])
  assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:p}),'sparkForks'),false);
});
test('draws independent multi-vertex kinked arcs with real forked offshoots',()=>{
 const state=frame();
 assert.ok(state.sparks.length>=12,'Many independently timed sparks visible');
 assert.ok(state.sparks.some(s=>s.branches.length>=2),'Independently forked arcs must exist');
 assert.ok(state.sparks.every(s=>s.path.length>=5),'Every spark consists of a multi-node arc');
 assert.ok(state.sparks.every(s=>s.branches.every(b=>b.length>=4)),'Forks are actual drawn paths');
 const jagged=state.sparks.filter(s=>{
  const a=s.path[0],b=s.path[s.path.length-1],dx=b.x-a.x,dy=b.y-a.y,mag=Math.hypot(dx,dy);
  if(mag<2)return false;
  return s.path.slice(1,-1).some(p=>Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)/mag>1);
 });
 assert.ok(jagged.length>=5,'Not simply straight white motion-tick strokes');
 assert.ok(state.sparks.some(s=>s.alpha>.2),'Discharges must glow visibly');
 assert.ok(state.sparks.every(s=>s.age>=0&&s.age<1),'Birth/recovery phase is bounded');
});
test('all particle states are absolute-time deterministic, including backward seeks',()=>{
 const times=[.12,.34,.72,.96,1.46,1.95];
 const states=times.map(t=>frame({},t));
 assert.ok(new Set(states.map(x=>JSON.stringify(metrics(x)))).size>=5,'Discharges evolve');
 assert.deepEqual(states[2],frame({},.72),'Rewinding reproduces exact geometry and birth phases');
 assert.deepEqual(frame({},0),frame({},0),'First frame deterministic');
});
test('each native spatial/electrical control changes actual generated paths',()=>{
 const base=frame();
 for(const change of [
  {density:10},{scale:45},{direction:-85},{distortion:1},{color:'#ffb057'},
  {glow:0},{sparkForks:0},{sparkLife:.84},{sparkSeed:1122},
  {originX:10},{originY:90},{speed:3}
 ]){
  assert.notDeepEqual(frame(change),base,JSON.stringify(change));
 }
 assert.equal(frame({sparkForks:0}).sparks.every(s=>s.branches.length===0),true);
});
test('real painter draws thick blue halos, pale cores and multiple fork paths',()=>{
 const log=[],gradient={addColorStop(...args){log.push(['stop',...args]);}};
 const ctx=new Proxy({globalAlpha:1,globalCompositeOperation:'source-over'},{
  get(target,key){
   if(key in target)return target[key];
   if(key==='createRadialGradient')return(...args)=>{log.push(['radial',...args]);return gradient;};
   return(...args)=>log.push([String(key),...args]);
  },
  set(target,key,value){target[key]=value;log.push(['set',String(key),value]);return true;}
 });
 assert.equal(renderElectricSparks(ctx,W,H,settings(),.72,.92),true);
 assert.ok(log.filter(x=>x[0]==='lineTo').length>120,'Forked paths drawn, not one line per particle');
 assert.ok(log.some(x=>x[0]==='set'&&x[1]==='globalCompositeOperation'&&x[2]==='screen'));
 assert.ok(log.some(x=>x[0]==='set'&&x[1]==='strokeStyle'&&x[2]==='#f5fcff'));
 assert.ok(log.some(x=>x[0]==='radial'),'Glowing electric discharge heads exist');
 assert.ok(log.some(x=>x[0]==='restore'),'The painter must restore the caller\'s Canvas state');
 const before=log.length;renderElectricSparks(ctx,W,H,settings(),.72,0);
 assert.equal(log.length,before,'Zero strength touches nothing');
});
test('Undo/Redo and portable recovery preserve forks, lifetime, seed and legacy fields',()=>{
 const recipe=settings({sparkForks:4,sparkLife:.59,sparkSeed:1998});
 const clip={id:'electric',type:'sticker',start:0,clipDuration:3,
  sourceFileId:'source-1',sourceName:'white.png',effectOverlay:recipe};
 const snap=snapshotClip(clip),restored={id:'electric',type:'sticker'};
 applyClipData(restored,snap);assert.deepEqual(restored.effectOverlay,recipe);
 const project=createRecoveryRecord({files:[{id:'source-1',kind:'sticker',name:'white.png',size:99}],
  tracks:[snap],selectedTrackId:'electric',selectedTrackIds:['electric'],history:{undo:[],redo:[]}});
 assert.deepEqual(parseRecoveryRecord(serializeRecoveryRecord(project)).tracks[0].effectOverlay,recipe);
});
