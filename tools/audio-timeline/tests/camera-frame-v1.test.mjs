/** MotoriClip #57 — deterministic transparent camera HUD geometry, controls and history. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraFrameGeometry,renderCameraFrame} from '../js/timeline-camera-frame.mjs';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,paintTimelineEffect}
 from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
const settings=patch=>normaliseTimelineEffect({
 presetId:'camera-frame',intensity:86,speed:1.3,color:'#f0f6ff',
 recColor:'#ff364c',hudScale:100,batteryLevel:78,frameRate:30,
 timecodeOffset:0,jitter:0,...patch
});
const geometry=(s,t=0)=>cameraFrameGeometry(320,180,s,t);
function mockContext(){
 const ops=[],ctx=new Proxy({globalAlpha:1}, {
  get(obj,key){
   if(Object.hasOwn(obj,key))return obj[key];
   return (...args)=>ops.push([String(key),...args]);
  },
  set(obj,key,value){obj[key]=value;ops.push(['set',String(key),value]);return true;}
 });
 return {ctx,ops};
}
test('Camera HUD is a separate animated Scanning preset and keeps only its own fields',()=>{
 const preset=TIMELINE_EFFECTS.find(x=>x.id==='camera-frame');
 assert.equal(preset?.label,'Camcorder Frame / REC HUD');
 assert.equal(preset?.animated,true);
 const e=settings({}),g=geometry(e,0);
 assert.equal(g.timecode,'00:00:00:00');
 assert.equal(g.batteryLevel,78);assert.equal(g.blinkOn,true);
 assert.ok(g.showRec&&g.showBattery&&g.showReticle&&g.showTimecode&&g.showCorners);
 const legacy=normaliseTimelineEffect({presetId:'light-sweep'});
 for(const key of ['recColor','hudScale','batteryLevel','showRec','showReticle','frameRate'])
  assert.equal(Object.hasOwn(legacy,key),false,'No camera setting in legacy '+key);
});
test('Timecode is clip-relative, respects FPS/offset, and is independent of blink speed',()=>{
 assert.equal(geometry(settings({}),1.5).timecode,'00:00:01:15');
 assert.equal(geometry(settings({frameRate:25}),1.5).timecode,'00:00:01:12');
 assert.equal(geometry(settings({frameRate:24,timecodeOffset:60}),1).timecode,'00:01:01:00');
 assert.equal(geometry(settings({frameRate:60}),.95).timecode,'00:00:00:57');
 assert.equal(geometry(settings({speed:4}),1.5).timecode,'00:00:01:15');
 assert.equal(geometry(settings({}),0).blinkOn,true);
 assert.equal(geometry(settings({}),.4).blinkOn,false);
 assert.deepEqual(geometry(settings({jitter:43}),.7),geometry(settings({jitter:43}),.7));
 assert.notEqual(geometry(settings({jitter:43}),.7).dx,geometry(settings({jitter:43}),1.1).dx);
 assert.equal(geometry(settings({jitter:0}),.7).dx,0);
});
test('Every HUD control is normalized and survives portable history/Undo/Redo',()=>{
 const e=settings({color:'#02abcd',recColor:'#de77fa',hudScale:130,
  frameRate:25,timecodeOffset:125,batteryLevel:37,jitter:65,
  showRec:false,showTimecode:false,showBattery:true,showCorners:false,showReticle:false});
 assert.equal(geometry(e,.5).timecode,'00:02:05:12');
 assert.ok(!e.showRec&&!e.showTimecode&&e.showBattery&&!e.showCorners&&!e.showReticle);
 const saved=snapshotClip({id:'camera',type:'sticker',effectOverlay:e});
 const track={id:'camera',type:'sticker'};
 applyClipData(track,saved);
 assert.deepEqual(track.effectOverlay,e);
 assert.deepEqual(geometry(track.effectOverlay,.7),geometry(e,.7));
 const clamped=settings({hudScale:10000,batteryLevel:-9,frameRate:66,jitter:999,
  timecodeOffset:-5,recColor:'garbage',showRec:'false'});
 assert.equal(clamped.hudScale,150);assert.equal(clamped.batteryLevel,0);
 assert.equal(clamped.frameRate,30);assert.equal(clamped.jitter,100);
 assert.equal(clamped.timecodeOffset,0);assert.equal(clamped.recColor,'#ff364c');
 assert.equal(clamped.showRec,false);
});
test('Canvas painter draws only transparent HUD elements, blinks and seeks exactly',()=>{
 const e=settings({});
 const a=mockContext(),b=mockContext(),c=mockContext();
 renderCameraFrame(a.ctx,320,180,e,.2,.8);
 renderCameraFrame(b.ctx,320,180,e,.2,.8);
 renderCameraFrame(c.ctx,320,180,e,.6,.8);
 assert.deepEqual(a.ops,b.ops,'Reverse seeking at the same time yields identical Canvas commands');
 assert.notDeepEqual(a.ops,c.ops,'REC blink or timecode must change between times');
 assert.ok(a.ops.some(x=>x[0]==='fillText'&&x[1]==='REC'));
 assert.ok(a.ops.some(x=>x[0]==='fillText'&&x[1].startsWith('TC ')));
 assert.ok(a.ops.some(x=>x[0]==='arc'),'REC dot/target reticle are real geometry');
 assert.equal(a.ops.filter(x=>x[0]==='clearRect').length,0,'Camera cannot erase video pixels');
 assert.equal(a.ops.filter(x=>x[0]==='drawImage').length,0,'Camera cannot alter source footage');
 assert.equal(a.ops.filter(x=>x[0]==='fillRect'&&x[3]>=300).length,0,
  'Camera has no opaque full-frame rectangle');
 const empty=mockContext();
 renderCameraFrame(empty.ctx,320,180,settings({
  showRec:false,showTimecode:false,showBattery:false,
  showCorners:false,showReticle:false
 }),0,.8);
 assert.equal(empty.ops.filter(x=>['stroke','strokeRect','fill','fillRect','fillText'].includes(x[0])).length,0);
 const composited=mockContext();
 assert.equal(paintTimelineEffect(composited.ctx,320,180,e,.2,3),true);
 assert.ok(composited.ops.some(x=>x[0]==='fillText'&&x[1]==='REC'),
  'Actual effect engine calls the HUD painter');
 const off=mockContext();renderCameraFrame(off.ctx,320,180,e,.2,0);
 assert.equal(off.ops.length,0,'0% overlay opacity draws nothing');
});
