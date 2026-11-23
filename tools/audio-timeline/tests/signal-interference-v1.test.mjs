/** MotoriClip #60: source-image analogue signal loss, deterministic band disruption. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSignalInterferenceFrame,signalInterferenceFrameState,renderSignalInterference} from '../js/timeline-signal-interference.mjs';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';

const W=160,H=90;
const raw=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;
 raw[i]=(x*7+y*3)%256;
 raw[i+1]=Math.round(255*y/(H-1));
 raw[i+2]=Math.round(255*x/(W-1));
 raw[i+3]=x<20?180:255;
}
const fx=(overrides={})=>normaliseTimelineEffect({presetId:'signal-interference',intensity:92,
 distortion:83,density:90,signalLoss:78,colorBleed:88,rollRate:1.1,signalSeed:6060,...overrides});
const render=(effect={},seconds=.65)=>buildSignalInterferenceFrame(raw,W,H,fx(effect),seconds*fx(effect).speed);
const hash=a=>{let h=2166136261;for(const b of a)h=Math.imul(h^b,16777619)>>>0;return h;};
const differences=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4){
 if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>32)n++;
}return n;};

test('Signal Interference is distinct, source-aware and exposes bounded native parameters',()=>{
 const entry=TIMELINE_EFFECTS.find(x=>x.id==='signal-interference');
 assert.equal(entry?.label,'Signal Interference');
 assert.equal(entry.category,'Glitch');
 assert.ok(requiresCompositeSource('signal-interference'));
 assert.equal(requiresCompositeSource('tv-static'),false,'Static snow is source-independent');
 const d=normaliseTimelineEffect({presetId:'signal-interference'});
 assert.deepEqual([d.signalLoss,d.colorBleed,d.rollRate,d.signalSeed],[56,64,1.1,6060]);
 const bounded=fx({signalLoss:-4,colorBleed:987,rollRate:900,signalSeed:200000});
 assert.deepEqual([bounded.signalLoss,bounded.colorBleed,bounded.rollRate,bounded.signalSeed],[0,100,5,99999]);
 assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:'tv-static'}),'signalLoss'),false);
});
test('Moving bands reshape actual source pixels and preserve every source alpha',()=>{
 const frame=render({},.65);
 assert.equal(frame.data.length,raw.length);
 assert.ok(differences(frame.data,raw)>W*H*.12,'Signal interference must visibly distort video, not merely draw a decorative stripe');
 for(let i=3;i<raw.length;i+=4)assert.equal(frame.data[i],raw[i],'Source alpha must be untouched');
 assert.ok(frame.state.bands.some(b=>b.active),'Active bands must have independent phases');
 assert.ok(Math.abs(frame.state.roll-render({},1.65).state.roll)>1,'Rolling band position must change over time');
});
test('Absolute time, backward seek and independent events produce deterministic loss',()=>{
 const times=[.11,.65,.97,1.42,2.18,3.27,4.91];
 const hashes=times.map(time=>hash(render({},time).data));
 assert.ok(new Set(hashes).size>=5,'Video corruption must evolve over clip duration');
 assert.deepEqual(render({},.65).data,render({},.65).data,'Backward seeking must recreate exact original pixels');
 assert.deepEqual(render({},2.18).data,render({},2.18).data);
 const events=Array.from({length:140},(_,i)=>signalInterferenceFrameState(W,H,fx(),i/35));
 assert.ok(events.some(s=>s.lost>0),'Intermittent full-video signal dropouts must occur');
 assert.ok(events.some(s=>s.lost===0),'Signal must recover between blackouts');
 assert.ok(events.some(s=>s.bands.filter(b=>b.active).length>2),'Multiple independently active rolling bands required');
});
test('Intensity, displacement, dropout, colour bleed, density, speed, roll and seed change real pixels',()=>{
 const base=hash(render().data);
 for(const variation of [
  {intensity:20},{distortion:12},{signalLoss:0},{colorBleed:0},
  {density:8},{speed:2},{rollRate:3.2},{signalSeed:4321}
 ]){
  assert.notEqual(hash(render(variation).data),base,JSON.stringify(variation));
 }
});
test('Signal parameters survive timeline history and portable recovery without source bytes',()=>{
 const settings=fx({signalLoss:41,colorBleed:23,signalSeed:777,rollRate:2.7});
 const clip={id:'signal-clip',type:'sticker',sourceFileId:'source-1',sourceName:'source.png',effectOverlay:settings,
  start:0,clipDuration:3,sourceOffset:0,order:0};
 const snap=snapshotClip(clip),replayed={id:clip.id,type:'sticker'};
 applyClipData(replayed,snap);
 assert.deepEqual(replayed.effectOverlay,settings);
 const project=createRecoveryRecord({
  files:[{id:'source-1',name:'source.png',kind:'sticker',size:100}],
  tracks:[snap],selectedTrackId:clip.id,selectedTrackIds:[clip.id],
  history:{undo:[],redo:[]}
 });
 const loaded=parseRecoveryRecord(serializeRecoveryRecord(project));
 assert.deepEqual(loaded.tracks[0].effectOverlay,settings);
 assert.equal(loaded.tracks[0].sourceFileId,'source-1');
});
test('Zero-opacity painter is a no-op and does not disturb Canvas source',()=>{
 let touched=false;
 const ctx=new Proxy({globalAlpha:1},{get(o,k){return k in o?o[k]:(...args)=>{touched=true;};}});
 assert.equal(renderSignalInterference(ctx,null,W,H,fx(),.65,0),true);
 assert.equal(touched,false);
});
