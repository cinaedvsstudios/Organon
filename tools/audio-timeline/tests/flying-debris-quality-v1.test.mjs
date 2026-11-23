/** MotoriClip #66 quality gate unit: true faceted ballistic Flying Debris. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFlyingDebrisFrame,renderFlyingDebris} from '../js/timeline-flying-debris.mjs';
import {normaliseTimelineEffect,TIMELINE_EFFECTS} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';

const W=320,H=180;
const settings=(extra={})=>normaliseTimelineEffect({
 presetId:'particle-debris',density:78,scale:135,distortion:84,direction:25,
 color:'#9ba9b9',originX:55,originY:48,debrisGravity:79,debrisTumble:81,
 debrisSpread:73,debrisLife:2.1,debrisSeed:6767,intensity:93,speed:1.2,...extra
});
const frame=(extra={},t=.67)=>{const e=settings(extra);
 return buildFlyingDebrisFrame(W,H,e,t*e.speed);};
const visible=state=>state.pieces.filter(p=>p.x>=-p.radius&&p.x<W+p.radius&&p.y>=-p.radius&&p.y<H+p.radius);
const fingerprint=state=>state.pieces.map(p=>[
 p.id,p.generation,+p.x.toFixed(3),+p.y.toFixed(3),
 +p.rotation.toFixed(3),+p.foreshortening.toFixed(3),+p.radius.toFixed(3),
 +p.opacity.toFixed(3),p.polygon.map(v=>[+v.x.toFixed(3),+v.y.toFixed(3)])
]);
test('retains existing Flying Debris preset ID, default material and bounded persistent controls',()=>{
 assert.equal(TIMELINE_EFFECTS.filter(x=>x.id==='particle-debris').length,1);
 const d=normaliseTimelineEffect({presetId:'particle-debris'});
 assert.equal(d.color,'#aab1bc');
 assert.deepEqual([d.originX,d.originY,d.debrisGravity,d.debrisTumble,d.debrisSpread,d.debrisLife,d.debrisSeed],
  [50,42,72,68,67,2.15,6767]);
 const limit=settings({debrisGravity:900,debrisTumble:-50,debrisSpread:999,debrisLife:20,debrisSeed:999999});
 assert.deepEqual([limit.debrisGravity,limit.debrisTumble,limit.debrisSpread,limit.debrisLife,limit.debrisSeed],
  [100,0,100,4,99999]);
 for(const id of ['particle-sparks','particle-dust','fire-embers'])
  assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:id}),'debrisGravity'),false);
});
test('independent debris includes nonrectangular many-vertex shards with varied facets and projected tumble',()=>{
 const state=frame(),pieces=state.pieces;
 assert.ok(pieces.length>45,'Dozens of independent visible-lifetime fragments');
 assert.ok(visible(state).length>18,'Airborne fragments actually inhabit the image');
 assert.ok(pieces.every(p=>p.polygon.length>=5&&p.polygon.length<=9),'Irregular polygon shards, not four-corner boxes');
 assert.ok(pieces.every(p=>p.facets>=2),'All shards have additional material facets');
 const geometry=new Set(pieces.map(p=>p.polygon.map(v=>v.x.toFixed(2)+':'+v.y.toFixed(2)).join('|')));
 assert.ok(geometry.size>15,'Different shapes instead of replicated sprites');
 assert.ok(new Set(pieces.map(p=>Math.round(p.foreshortening*100))).size>9,'Different independent 3-D tumbling angles');
 assert.ok(new Set(pieces.map(p=>p.generation)).size>1,'Independent lifetime generations');
 assert.ok(pieces.some(p=>p.glint>.25),'Some shards catch a changing edge reflection');
});
test('deterministic absolute time reproduces geometry after reverse seeking',()=>{
 const times=[.14,.34,.67,1.05,1.38,1.87];
 const all=times.map(t=>fingerprint(frame({},t)));
 assert.ok(new Set(all.map(JSON.stringify)).size>=5,'Ballistic motions evolve continuously over time');
 assert.deepEqual(all[2],fingerprint(frame({},.67)),'Reverse seeking restores identical trajectories, rotations and polygons');
});
test('gravity, velocity and turbulence create unique ballistic flight without wrapping',()=>{
 const s=frame(),pieces=s.pieces;
 assert.ok(pieces.every(p=>p.gravity>0));
 const speeds=new Set(pieces.map(p=>Math.round(p.vx)+':'+Math.round(p.vy)));
 assert.ok(speeds.size>30,'Individuals launch at different angles/speeds');
 const gravityLow=fingerprint(frame({debrisGravity:0})),gravityHigh=fingerprint(frame({debrisGravity:100}));
 assert.notDeepEqual(gravityLow,gravityHigh,'Gravity changes actual trajectories');
 assert.ok(pieces.some(p=>p.y<0||p.y>H),'Off-screen trajectories are allowed, never wrapped to the opposite side');
});
test('every visible Inspector motion control changes relevant shard state',()=>{
 const original=frame(),signature=fingerprint(original);
 for(const adjustment of [
  {density:12},{scale:30},{direction:-85},{distortion:1},{originX:12},{originY:90},
  {debrisGravity:5},{debrisTumble:4},{debrisSpread:0},{debrisLife:3.6},
  {debrisSeed:83},{speed:2.5}
 ])assert.notDeepEqual(fingerprint(frame(adjustment)),signature,'Inactive motion control: '+JSON.stringify(adjustment));
 assert.notDeepEqual(frame({color:'#f4bd55'}).params.color,original.params.color,'Material tint changes');
});
test('paint actually creates faceted polygons and restores canvas after each shard',()=>{
 const events=[];
 const gradient={addColorStop(){}};
 const ctx=new Proxy({globalAlpha:1,globalCompositeOperation:'source-over'},{
  get(target,key){
   if(key in target)return target[key];
   if(key==='createRadialGradient')return()=>gradient;
   return (...args)=>events.push([String(key),...args]);
  },
  set(target,key,value){target[key]=value;events.push(['set',String(key),value]);return true;}
 });
 assert.equal(renderFlyingDebris(ctx,W,H,settings(),.67,1),true);
 assert.ok(events.filter(x=>x[0]==='closePath').length>80,'Filled irregular silhouettes/facets must be drawn');
 assert.ok(events.filter(x=>x[0]==='lineTo').length>250,'Real polygon vertices, not a repeated fillRect square');
 assert.ok(events.some(x=>x[0]==='scale'),'3-D foreshortening in each shard');
 assert.ok(events.some(x=>x[0]==='rotate'),'Independent tumble rotation');
 assert.ok(events.some(x=>x[0]==='set'&&x[1]==='globalCompositeOperation'&&x[2]==='source-over'));
 assert.ok(events.some(x=>x[0]==='set'&&x[1]==='fillStyle'&&String(x[2]).startsWith('rgb(')),'Shaded material facets');
 assert.ok(events.some(x=>x[0]==='restore'),'Canvas state restored');
 const old=events.length;assert.equal(renderFlyingDebris(ctx,W,H,settings(),.67,0),true);
 assert.equal(events.length,old,'Zero strength is a no-op');
});
test('Undo/Redo and portable recovery persist the complete Flying Debris recipe',()=>{
 const effect=settings({debrisGravity:49,debrisTumble:14,debrisLife:2.75,debrisSeed:2001});
 const clip={id:'debris',type:'sticker',start:0,clipDuration:3,sourceFileId:'source-1',
  sourceName:'empty.png',effectOverlay:effect};
 const saved=snapshotClip(clip),target={id:clip.id,type:'sticker'};
 applyClipData(target,saved);assert.deepEqual(target.effectOverlay,effect);
 const record=createRecoveryRecord({files:[{id:'source-1',kind:'sticker',name:'empty.png',size:85}],
  tracks:[saved],selectedTrackId:'debris',selectedTrackIds:['debris'],history:{undo:[],redo:[]}});
 assert.deepEqual(parseRecoveryRecord(serializeRecoveryRecord(record)).tracks[0].effectOverlay,effect);
});
