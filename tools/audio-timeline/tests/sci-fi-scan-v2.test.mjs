/** MotoriClip #50: independent sci-fi telemetry and detection animation QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSciFiScanFrame,renderSciFiScan} from '../js/timeline-sci-fi-scan.mjs';
import {normaliseTimelineEffect,paintTimelineEffect} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
const base={presetId:'sci-fi-scan',intensity:90,speed:1.3,density:92,scale:116,
 direction:22,distortion:77,glow:79,originX:41,originY:18,color:'#54d9ff'};
const e=normaliseTimelineEffect(base);
const at=(t,settings=e)=>buildSciFiScanFrame(320,180,settings,t*settings.speed);

test('Sci-Fi Scan has autonomous fast vertical target and independently racing left/right bars',()=>{
 const first=at(.12),later=at(.34),again=at(.12);
 assert.deepEqual(first,again,'Repeat/reverse seeks must produce identical geometry');
 assert.notDeepEqual(first,later,'Scanner must have actual temporal motion');
 assert.ok(Math.abs(first.targetY-later.targetY)>20,'Detection target must shuttle rapidly up/down the beam');
 assert.notEqual(first.beamX,later.beamX,'Scanner beam itself still sweeps independently');
 assert.ok(first.segments.length>15,'Many independent horizontal bars must exist');
 assert.ok(first.segments.some(x=>x.direction<0)&&first.segments.some(x=>x.direction>0),
  'Bar traffic must race in both horizontal directions');
 assert.ok(new Set(first.segments.map(x=>x.speed.toFixed(3))).size>15,
  'Bars must not share one motion clock');
 assert.ok(first.segments.filter((bar,i)=>Math.abs(bar.x-later.segments[i].x)>5).length>10,
  'More than ten bars must actually move, not just translate a still pattern');
 assert.ok(new Set(first.segments.map(x=>x.y.toFixed(1))).size>15,'Bars must occupy distinct scanlines');
});

test('Detection blips appear and fade with independent generations, positions and pulses',()=>{
 const samples=[.12,.3,.62,1.1].map(t=>at(t));
 const all=samples.flatMap(f=>f.blips);
 assert.ok(all.some(x=>x.alpha>.2)&&all.some(x=>x.alpha===0),'Short-lived detections must appear and expire');
 assert.ok(new Set(all.map(x=>x.rate.toFixed(3))).size>12,'Detections require independent clocks');
 assert.ok(new Set(all.map(x=>x.generation)).size>1,'The detector must regenerate temporal blips');
 assert.ok(new Set(all.map(x=>x.x.toFixed(1))).size>15,'Detections must not be all in one static location');
 assert.ok(samples.some(f=>f.blips.some(p=>p.ring)),'Some blips must expand rings during their lifetime');
 assert.notDeepEqual(samples[0].blips,samples[3].blips);
});

test('Scan parameters change geometry and survive portable history',()=>{
 const first=at(.8);
 for(const delta of [{speed:2.3},{density:22},{scale:200},{direction:-91},
  {distortion:0},{glow:0},{originX:4},{originY:92},{color:'#fca8db'}]){
  const changed=normaliseTimelineEffect({...e,...delta});
  assert.notDeepEqual(at(.8,changed),first,'Native scanner parameter affects geometry: '+JSON.stringify(delta));
 }
 const saved=snapshotClip({id:'scanner',type:'sticker',effectOverlay:e});
 const restored={id:'scanner',type:'sticker'};
 applyClipData(restored,saved);
 assert.deepEqual(restored.effectOverlay,e);
 assert.deepEqual(at(.8,restored.effectOverlay),first);
 applyClipData(restored,{...saved,effectOverlay:null});
 assert.equal(restored.effectOverlay,null);
 assert.equal(normaliseTimelineEffect({presetId:'sci-fi-scan'}).color,'#63ebff');
});

test('Real timeline painter draws distinct detection circles, horizontal segment strips and beam',()=>{
 const make=()=>{
  const log=[];
  const gradient=()=>({addColorStop:(...row)=>log.push(['stop',...row])});
  const ctx=new Proxy({},{
   get(target,k){
    if(Object.hasOwn(target,k))return target[k];
    if(k==='globalAlpha')return 1;
    if(k==='createLinearGradient'||k==='createRadialGradient')
     return (...args)=>{log.push([k,...args]);return gradient();};
    return (...args)=>log.push([k,...args]);
   },
   set(target,k,v){target[k]=v;log.push(['set',String(k),v]);return true;}
  });
  return {ctx,log};
 };
 const first=make();
 assert.equal(renderSciFiScan(first.ctx,320,180,e,.7,.9),true);
 assert.ok(first.log.some(x=>x[0]==='set'&&x[1]==='strokeStyle'&&
  String(x[2]).startsWith('rgba(84,217,255,')),
  'Selected #54d9ff cyan must decode to RGB 84,217,255 (not amber)');
 assert.ok(first.log.some(x=>x[0]==='arc'),'Scanner must draw detection rings and shuttle reticle');
 assert.ok(first.log.filter(x=>x[0]==='fillRect').length>15,'Individual bars and blips must paint');
 assert.ok(first.log.filter(x=>x[0]==='createLinearGradient').length>10,
  'Telemetry bars must have separate transparent tails');
 assert.ok(first.log.some(x=>x[0]==='save')&&first.log.some(x=>x[0]==='restore'));
 const repeated=make();renderSciFiScan(repeated.ctx,320,180,e,.7,.9);
 assert.equal(JSON.stringify(first.log),JSON.stringify(repeated.log),
  'At a given clip time all numeric Canvas drawing commands are deterministic');
 const later=make();renderSciFiScan(later.ctx,320,180,e,1.2,.9);
 assert.notDeepEqual(first.log,later.log);
 const parent=make();
 assert.equal(paintTimelineEffect(parent.ctx,320,180,e,.7/e.speed,3),true);
 assert.ok(parent.log.some(x=>x[0]==='arc'),'The original timeline ID must route through active scanner');
});
