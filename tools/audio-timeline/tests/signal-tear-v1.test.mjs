/** MotoriClip #63: discontinuous source-image tears, not analog band interference. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSignalTearFrame,signalTearFrameState,renderSignalTear} from '../js/timeline-signal-tear.mjs';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';
const W=240,H=135,pixels=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;
 pixels[i]=Math.round(255*(x%45)/45);
 pixels[i+1]=Math.round(230*(y%23)/23);
 pixels[i+2]=((x*4+y*3)%251);
 pixels[i+3]=x<22?100+y%80:255;
}
const config=(updates={})=>normaliseTimelineEffect({presetId:'signal-tear',intensity:94,
 speed:1.1,density:90,distortion:90,tearHeight:15,tearFragment:88,
 tearLife:.27,tearSeed:6363,...updates});
const draw=(updates={},time=.65)=>{const e=config(updates);return buildSignalTearFrame(pixels,W,H,e,time*e.speed);};
const hash=a=>{let n=2166136261>>>0;for(const b of a)n=Math.imul(n^b,16777619)>>>0;return n;};
const altered=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4){
 if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>15)n++;
}return n;};

test('Signal Tear is independently named and clamps its specific native controls',()=>{
 assert.equal(TIMELINE_EFFECTS.find(e=>e.id==='signal-tear')?.label,'Signal Tear');
 assert.equal(requiresCompositeSource('signal-tear'),true);
 const e=normaliseTimelineEffect({presetId:'signal-tear'});
 assert.deepEqual([e.density,e.distortion,e.tearHeight,e.tearFragment,e.tearLife,e.tearSeed],
  [72,72,9,68,.17,6363]);
 const limited=config({tearHeight:99,tearFragment:-100,tearLife:1.9,tearSeed:100000});
 assert.deepEqual([limited.tearHeight,limited.tearFragment,limited.tearLife,limited.tearSeed],
  [30,0,.6,99999]);
 for(const id of ['signal-interference','data-burst','crt-scanlines'])
  assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:id}),'tearHeight'),false);
});
test('Hard horizontal video fragment shifts alter real source geometry, not full-frame static',()=>{
 const result=draw(),count=altered(result.data,pixels);
 assert.ok(result.state.tears.length>1,'Multiple independent hard image fragments must appear');
 assert.ok(count>90,'Real source-pixel tears must visibly displace image content');
 assert.ok(count<W*H*.30,'Most of the source remains intact between sharp local tears');
 for(let i=0;i<pixels.length;i+=4)assert.equal(result.data[i+3],pixels[i+3],'Preserve exact alpha');
 assert.deepEqual(draw({intensity:0}).data,pixels);
 assert.deepEqual(draw({distortion:0}).data,pixels);
});
test('Short-lived fragment events recover and reproduce exact images after backward seeking',()=>{
 const times=[.16,.29,.53,.71,1.1,1.45,1.89],all=times.map(t=>draw({},t));
 assert.ok(new Set(all.map(a=>hash(a.data))).size>=4,'Discontinuous content should not be frozen');
 assert.deepEqual(draw({},.71).data,draw({},.71).data);
 const first=signalTearFrameState(W,H,config(),.16);
 const second=signalTearFrameState(W,H,config(),1.45);
 assert.notDeepEqual(first.tears,second.tears);
 assert.ok([...first.tears,...second.tears].every(t=>t.top>=0&&t.bottom<=H&&t.startX>=0&&t.endX<=W));
});
test('Height, fragments, recovery, displacement, frequency, intensity, speed and seed affect pixels',()=>{
 const base=hash(draw().data);
 for(const variant of [
  {tearHeight:3},{tearFragment:0},{tearLife:.5},{distortion:15},
  {density:12},{intensity:20},{speed:2.7},{tearSeed:53}
 ])assert.notEqual(hash(draw(variant).data),base,JSON.stringify(variant));
});
test('Saved fragment recipe survives Undo/Redo and recovery/portable project save',()=>{
 const effect=config({tearHeight:18,tearFragment:55,tearLife:.4,tearSeed:994});
 const clip={id:'tear',type:'sticker',start:0,clipDuration:3,sourceFileId:'source-1',
  sourceName:'tear.png',effectOverlay:effect};
 const record=snapshotClip(clip),undo={id:'tear',type:'sticker'};
 applyClipData(undo,record);assert.deepEqual(undo.effectOverlay,effect);
 const state=createRecoveryRecord({files:[{id:'source-1',kind:'sticker',name:'tear.png',size:888}],
  tracks:[record],selectedTrackId:'tear',selectedTrackIds:['tear'],history:{undo:[],redo:[]}});
 const restored=parseRecoveryRecord(serializeRecoveryRecord(state));
 assert.deepEqual(restored.tracks[0].effectOverlay,effect);
});
test('Zero strength does not touch source or require Canvas',()=>{
 let touched=false;
 const ctx=new Proxy({}, {get:(o,k)=>k in o?o[k]:(...args)=>{touched=true;}});
 assert.equal(renderSignalTear(ctx,null,W,H,config(),.65,0),true);
 assert.equal(touched,false);
});
