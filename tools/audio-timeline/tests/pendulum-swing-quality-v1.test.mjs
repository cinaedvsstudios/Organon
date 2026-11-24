/** MotoriClip #66: source-derived Pendulum Swing independently verified quality. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {pendulumSwingFrameState,buildPendulumSwingFrame,renderPendulumSwing} from '../js/timeline-pendulum-swing.mjs';
import {normaliseTimelineEffect,TIMELINE_EFFECTS,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';
const W=240,H=135,source=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;
 source[i]=(x*5+y*3)%251;source[i+1]=(x*2+y*7)%253;
 source[i+2]=(x*7+y*2)%249;source[i+3]=x<21?60+y%150:255;
}
const recipe=(patch={})=>normaliseTimelineEffect({presetId:'pendulum-swing',intensity:95,
 speed:1.12,scale:127,direction:9,distortion:88,originX:50,originY:10,
 pendulumPeriod:2.6,pendulumDamping:20,pendulumShutter:73,pendulumFlex:50,...patch});
const render=(patch={},time=.8)=>{const e=recipe(patch);
 return buildPendulumSwingFrame(source,W,H,e,time*e.speed);};
const fingerprint=bytes=>{let n=2166136261>>>0;for(const v of bytes)n=Math.imul(n^v,16777619)>>>0;return n;};
const affected=(a,b)=>{let count=0;for(let i=0;i<a.length;i+=4)
 if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>25)count++;
 return count;};
test('single original Pendulum Swing preset with bounded separate physical Inspector settings',()=>{
 assert.equal(TIMELINE_EFFECTS.filter(x=>x.id==='pendulum-swing').length,1);
 assert.equal(requiresCompositeSource('pendulum-swing'),true);
 const e=normaliseTimelineEffect({presetId:'pendulum-swing'});
 assert.deepEqual([e.originX,e.originY,e.pendulumPeriod,e.pendulumDamping,e.pendulumShutter,e.pendulumFlex],
  [50,10,2.6,18,45,14]);
 const invalid=recipe({pendulumPeriod:99,pendulumDamping:-8,pendulumShutter:181,pendulumFlex:-1});
 assert.deepEqual([invalid.pendulumPeriod,invalid.pendulumDamping,invalid.pendulumShutter,invalid.pendulumFlex],
  [6,0,100,0]);
 assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:'rebound-swing'}),'pendulumPeriod'),false);
});
test('gravity-shaped motion decelerates at turning points and speeds through the centre',()=>{
 const e=recipe({direction:0,pendulumDamping:0,pendulumFlex:0});
 const top=pendulumSwingFrameState(W,H,e,0);
 const bottom=pendulumSwingFrameState(W,H,e,e.pendulumPeriod/4);
 assert.ok(Math.abs(top.angle)>.2,'Initial release has visible displacement');
 assert.ok(Math.abs(bottom.angle)<.002,'Center of swing passes zero angle');
 assert.ok(Math.abs(bottom.angularVelocity)>Math.abs(top.angularVelocity)*20,
  'Angular velocity near the middle must greatly exceed velocity at the turning point');
 assert.deepEqual([top.pivotX,top.pivotY],[W*.5,H*.1]);
});
test('pendulum air resistance reduces amplitude after complete cycles',()=>{
 const e=recipe({pendulumDamping:80,direction:0,pendulumFlex:0});
 const top=pendulumSwingFrameState(W,H,e,0),cycle=pendulumSwingFrameState(W,H,e,e.pendulumPeriod);
 assert.ok(Math.abs(cycle.angle)<Math.abs(top.angle)*.25,'Energy must be lost with each cycle');
 assert.ok(cycle.energy<top.energy);
 assert.ok(Math.abs(pendulumSwingFrameState(W,H,e,.4).angle)>0);
});
test('actual source pixels are motion-sampled around the anchor with original alpha intact',()=>{
 const out=render().data;
 assert.ok(affected(out,source)>160,'Source image must swing perceptibly');
 const colors=new Set();
 for(let i=0;i<out.length;i+=4){
  colors.add((out[i]<<16)|(out[i+1]<<8)|out[i+2]);
  assert.equal(out[i+3],source[i+3],'Original pixel alpha must remain unchanged');
 }
 assert.ok(colors.size>1000,'Source texture survives, not replaced by a flat overlay');
 const alternate=new Uint8ClampedArray(source.length);
 for(let i=0;i<alternate.length;i+=4){
  alternate[i]=51;alternate[i+1]=121;alternate[i+2]=205;alternate[i+3]=source[i+3];
 }
 assert.notDeepEqual(buildPendulumSwingFrame(alternate,W,H,recipe(),.8).data,out);
 const transparent=new Uint8ClampedArray(source.length);
 assert.deepEqual(buildPendulumSwingFrame(transparent,W,H,recipe(),.8).data,transparent);
 const stationary=render({distortion:0,pendulumFlex:0}).data;
 assert.deepEqual(stationary,source,'Zero amplitude is actually motionless');
});
test('multi-time shutter trails and all spatial Inspector controls affect actual pixels',()=>{
 const baseline=fingerprint(render().data);
 for(const patch of [{pendulumPeriod:.8},{pendulumDamping:96},{pendulumShutter:0},{pendulumFlex:0},
  {originX:14},{originY:74},{direction:-108},{scale:31},{distortion:2},{speed:2.8}]){
  assert.notEqual(fingerprint(render(patch).data),baseline,'Dormant Inspector control: '+JSON.stringify(patch));
 }
});
test('pendulum motion is exactly reversible by absolute time and zero opacity is no-op',()=>{
 const times=[.16,.45,.8,1.25,1.5,2.08],hashes=times.map(t=>fingerprint(render({},t).data));
 assert.ok(new Set(hashes).size>=5);
 assert.equal(fingerprint(render({},.8).data),hashes[2]);
 let touched=false;
 const ctx=new Proxy({}, {get:()=>()=>{touched=true;}});
 assert.equal(renderPendulumSwing(ctx,null,W,H,recipe(),.8,0),true);
 assert.equal(touched,false);
});
test('Undo/Redo and portable Save/Open preserve pendulum physics and pivot',()=>{
 const fx=recipe({pendulumPeriod:3.4,pendulumDamping:60,pendulumShutter:22,pendulumFlex:34,originX:41});
 const clip={id:'swing',type:'sticker',start:0,clipDuration:3,sourceFileId:'source-1',
  sourceName:'video.png',effectOverlay:fx};
 const snap=snapshotClip(clip),restored={id:'swing',type:'sticker'};
 applyClipData(restored,snap);assert.deepEqual(restored.effectOverlay,fx);
 const project=createRecoveryRecord({files:[{id:'source-1',kind:'sticker',name:'video.png',size:75}],
  tracks:[snap],selectedTrackId:'swing',selectedTrackIds:['swing'],history:{undo:[],redo:[]}});
 assert.deepEqual(parseRecoveryRecord(serializeRecoveryRecord(project)).tracks[0].effectOverlay,fx);
});
