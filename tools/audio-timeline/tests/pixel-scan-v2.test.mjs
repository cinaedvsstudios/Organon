/** #47 deterministic, independently regenerating Pixel Scan acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPixelScanFrame,renderPixelScan} from '../js/timeline-pixel-scan.mjs';
import {normaliseTimelineEffect,paintTimelineEffect} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';

const settings=normaliseTimelineEffect({presetId:'pixel-scan',speed:1.5,
 intensity:82,density:64,scale:125,direction:24,distortion:78,glow:73,
 originX:64,originY:44,color:'#f8be75'});

test('independent clusters are seeded by absolute time, regenerate at different rates and do not form a translated strip',()=>{
 const frame=buildPixelScanFrame(640,360,settings,.25);
 const later=buildPixelScanFrame(640,360,settings,3.13);
 assert.deepEqual(frame,buildPixelScanFrame(640,360,settings,.25),
  'Same time must reconstruct same pixels regardless of prior seek order');
 assert.notDeepEqual(frame,later,'Pixel Scan must be fully regenerated');
 assert.equal(frame.length,64);
 assert.equal(new Set(frame.map(x=>x.id)).size,64);
 assert.ok(new Set(frame.map(x=>x.tick)).size>12,
  'Pixel groups must have different per-particle flicker clocks');
 assert.ok(new Set(frame.map(x=>x.life.toFixed(4))).size>55,
  'Pixel groups cannot share one moving band phase');
 assert.ok(new Set(frame.map(x=>x.generation)).size>1,
  'Individual groups must regenerate at different times');
 assert.ok(frame.some(x=>x.dropout),'Some groups should flicker completely off');
 assert.ok(frame.some(x=>!x.dropout&&x.tiles.length>2),'Some groups must have multiple internal pixels');
 const groups=frame.filter(x=>x.alpha>.1);
 assert.ok(groups.length>15,'Visible pixels should be distributed around the frame');
 const quadrants=new Set(groups.map(x=>(x.x>=320?'R':'L')+(x.y>=180?'B':'T')));
 assert.equal(quadrants.size,4,'Must not move just one bright horizontal pixel strip');
 assert.ok(new Set(frame.flatMap(x=>x.tiles.map(y=>y.color))).size>=3,
  'Pixel details must vary independently in color');
 assert.ok(new Set(frame.flatMap(x=>x.tiles.map(y=>y.width.toFixed(2)))).size>12,
  'Pixel rectangles must vary in dimensions, not a static repeated PNG');
 assert.ok(new Set(frame.map(x=>x.alpha.toFixed(3))).size>20,
  'Particles must fade and pulse at different amplitudes');
 const gone=frame.filter(x=>x.dropout).length;
 const goneLater=later.filter(x=>x.dropout).length;
 assert.ok(gone>0&&goneLater>0);
 const movement=frame.filter((x,i)=>Math.hypot(x.x-later[i].x,x.y-later[i].y)>25);
 assert.ok(movement.length>30,'Independent groups should travel and reappear elsewhere');
});

test('existing timeline controls change generated image clusters, and saved settings survive Undo/Redo',()=>{
 const frame=e=>buildPixelScanFrame(640,360,e,1.12);
 const baseline=frame(settings);
 const differences=[
  {density:23},{scale:200},{direction:-87},{distortion:5},{glow:0},
  {originX:5},{originY:90},{color:'#3ae4ff'}
 ];
 for(const update of differences){
  const changed=frame(normaliseTimelineEffect({...settings,...update}));
  assert.notDeepEqual(baseline,changed,
   'Pixel Scan control must actually change pixels: '+JSON.stringify(update));
 }
 const clip={id:'pixel',type:'sticker',effectOverlay:settings};
 const saved=snapshotClip(clip);
 const restored={id:'pixel',type:'sticker'};
 applyClipData(restored,saved);
 assert.deepEqual(restored.effectOverlay,settings);
 assert.deepEqual(frame(restored.effectOverlay),baseline);
 applyClipData(restored,{...saved,effectOverlay:null});
 assert.equal(restored.effectOverlay,null);
});

test('Canvas implementation emits distributed asynchronous geometry with no wall-clock dependency',()=>{
 const log=[];
 const gradient=()=>({addColorStop:(...args)=>log.push(['stop',...args])});
 const ctx=new Proxy({},{
  get(target,name){
   if(Object.hasOwn(target,name))return target[name];
   if(name==='globalAlpha')return 1;
   if(name==='createRadialGradient')return (...args)=>{log.push(['gradient',...args]);return gradient();};
   return (...args)=>log.push([name,...args]);
  },
  set(target,name,value){target[name]=value;log.push(['set',String(name),value]);return true;}
 });
 assert.equal(renderPixelScan(ctx,640,360,settings,1.13,.82),true);
 const first=JSON.stringify(log);
 const rects=log.filter(x=>x[0]==='fillRect');
 assert.ok(rects.length>120,'Pixel Scan must draw many distinct changing pixels, not one slide');
 assert.ok(log.some(x=>x[0]==='gradient'),'Pixel groups need local independent bloom');
 const spans=new Set(rects.map(x=>Math.round(x[1]/16)+','+Math.round(x[2]/16)));
 assert.ok(spans.size>35,'Pixel scan rectangles must appear across multiple separated regions');
 ctx.globalAlpha=1;log.length=0;renderPixelScan(ctx,640,360,settings,1.13,.82);
 assert.equal(JSON.stringify(log),first,'Same time must reproduce exactly the same drawing operations');
 ctx.globalAlpha=1;log.length=0;renderPixelScan(ctx,640,360,settings,1.7,.82);
 assert.notEqual(JSON.stringify(log),first,'Changing time must redraw independent pixel details');
 log.length=0;
 assert.equal(paintTimelineEffect(ctx,640,360,settings,1.13/settings.speed,3),true);
 assert.ok(log.length>100,'Live timeline painter must use new procedural pixel scan renderer');
});