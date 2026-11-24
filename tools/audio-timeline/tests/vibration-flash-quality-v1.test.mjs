/** MotoriClip #66 Vibration Flash — source-aware camera shake acceptance tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {vibrationFlashFrameState,buildVibrationFlashFrame,renderVibrationFlash} from '../js/timeline-vibration-flash.mjs';
import {normaliseTimelineEffect,TIMELINE_EFFECTS,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';
const W=240,H=135,source=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const k=(y*W+x)*4;
 source[k]=(x*7+y*2)%252;source[k+1]=(x*3+y*11)%253;
 source[k+2]=(x*9+y*5)%251;source[k+3]=x<23?55+y%145:255;
}
const effect=(p={})=>normaliseTimelineEffect({
 presetId:'vibration-flash',intensity:96,speed:1.1,density:94,
 scale:125,direction:27,distortion:89,color:'#ffdfac',
 vibrationFrequency:18,vibrationDecay:30,vibrationEcho:75,
 vibrationFlash:86,vibrationSeed:8181,...p
});
const frame=(patch={},time=.31)=>{const e=effect(patch);return buildVibrationFlashFrame(source,W,H,e,time*e.speed);};
const hash=x=>{let n=2166136261>>>0;for(const v of x)n=Math.imul(n^v,16777619)>>>0;return n;};
const different=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>22)n++;return n;};
test('one unchanged Vibration Flash preset and clamped optical controls',()=>{
 assert.equal(TIMELINE_EFFECTS.filter(x=>x.id==='vibration-flash').length,1);
 assert.equal(requiresCompositeSource('vibration-flash'),true);
 const e=normaliseTimelineEffect({presetId:'vibration-flash'});
 assert.deepEqual([e.density,e.distortion,e.vibrationFrequency,e.vibrationDecay,e.vibrationEcho,e.vibrationFlash,e.vibrationSeed],
  [66,72,18,28,42,65,8181]);
 const limit=effect({vibrationFrequency:900,vibrationDecay:-10,vibrationEcho:125,vibrationFlash:-8,vibrationSeed:999999});
 assert.deepEqual([limit.vibrationFrequency,limit.vibrationDecay,limit.vibrationEcho,limit.vibrationFlash,limit.vibrationSeed],[40,0,100,0,99999]);
 assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:'shockwave'}),'vibrationFrequency'),false);
});
test('independent directional micro-shakes, decaying motion, and genuine timed exposure pulses',()=>{
 const e=effect(),st=vibrationFlashFrameState(W,H,e,.31*e.speed);
 assert.ok(Math.abs(st.dx)+Math.abs(st.dy)>.1,'Source camera displacement is nonzero');
 assert.ok(st.flash>0,'A recorded shutter pulse occurs at this seeded timestamp');
 const later=vibrationFlashFrameState(W,H,e,1.8);
 assert.ok(later.envelope<st.envelope,'After-impact shake decays over time');
 assert.notDeepEqual([st.dx,st.dy],[later.dx,later.dy]);
 assert.notDeepEqual(vibrationFlashFrameState(W,H,e,.15),vibrationFlashFrameState(W,H,e,.9));
});
test('real source image is sampled, flat flash never replaces the footage and original alpha is untouched',()=>{
 const out=frame().data,n=different(out,source);
 assert.ok(n>120,'Optical camera shake and shutter must visibly change source detail');
 const detail=new Set();
 for(let i=0;i<out.length;i+=4)detail.add((out[i]<<16)|(out[i+1]<<8)|out[i+2]);
 assert.ok(detail.size>500,'Actual image colour/detail survives; a flat exposure rectangle would collapse source variation');
 for(let i=3;i<source.length;i+=4)assert.equal(out[i],source[i],'Every original source alpha remains identical');
 const second=new Uint8ClampedArray(source.length);
 for(let i=0;i<second.length;i+=4){second[i]=44;second[i+1]=151;second[i+2]=199;second[i+3]=source[i+3];}
 assert.notDeepEqual(buildVibrationFlashFrame(second,W,H,effect(),.31*1.1).data,out);
 const transparent=new Uint8ClampedArray(source.length);
 assert.deepEqual(buildVibrationFlashFrame(transparent,W,H,effect(),.31).data,transparent);
});
test('shutter exposure flashes depend on underlying luminance rather than a solid overlay',()=>{
 const e=effect({vibrationFlash:100,vibrationEcho:0,distortion:0});
 const pixelData=new Uint8ClampedArray([6,6,6,255,120,120,120,255,220,220,220,255,0,0,0,0]);
 const out=buildVibrationFlashFrame(pixelData,4,1,e,.31*e.speed).data;
 const base=buildVibrationFlashFrame(pixelData,4,1,effect({vibrationFlash:0,vibrationEcho:0,distortion:0}),.31*e.speed).data;
 assert.ok(out[0]>base[0]&&out[4]>base[4],'Exposure brightens the actual source');
 assert.ok(out[8]>=base[8],'Bright source highlights remain bright, not covered with an opaque colour');
 assert.equal(out[15],0,'Transparent source stays transparent');
});
test('absolute time is deterministic even after seeking backwards',()=>{
 const times=[.14,.31,.65,.88,1.25,1.4],signatures=times.map(t=>hash(frame({},t).data));
 assert.ok(new Set(signatures).size>=5,'Different shake/flash states are visible');
 assert.equal(hash(frame({},.31).data),signatures[1],'Seek-backwards restores exactly the same pixels');
});
test('every displayed native control affects real image data',()=>{
 const base=hash(frame().data);
 for(const change of [{density:4},{scale:22},{direction:-102},{distortion:2},
  {color:'#72cfff'},{speed:2.6},{vibrationFrequency:5},
  {vibrationDecay:100},{vibrationEcho:0},{vibrationFlash:0},{vibrationSeed:221}]){
  assert.notEqual(hash(frame(change).data),base,'Inactive Inspector control: '+JSON.stringify(change));
 }
 assert.equal(renderVibrationFlash(new Proxy({}, {get:()=>{throw Error('Touched Canvas');}}),null,W,H,effect(),.31,0),true);
});
test('history, Undo and portable project Save/Open retain the extended vibration recipe',()=>{
 const e=effect({vibrationFrequency:31,vibrationEcho:60,vibrationFlash:95,vibrationSeed:1981});
 const clip={id:'shake',type:'sticker',start:0,clipDuration:3,sourceFileId:'source-1',sourceName:'scene.png',effectOverlay:e};
 const snap=snapshotClip(clip),other={id:'shake',type:'sticker'};
 applyClipData(other,snap);assert.deepEqual(other.effectOverlay,e);
 const saved=createRecoveryRecord({files:[{id:'source-1',kind:'sticker',name:'scene.png',size:80}],
  tracks:[snap],selectedTrackId:'shake',selectedTrackIds:['shake'],history:{undo:[],redo:[]}});
 assert.deepEqual(parseRecoveryRecord(serializeRecoveryRecord(saved)).tracks[0].effectOverlay,e);
});
