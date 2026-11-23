/** MotoriClip #62 — independent RGB data packets over real source pixels. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDataBurstFrame,dataBurstFrameState,renderDataBurst} from '../js/timeline-data-burst.mjs';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';
const W=240,H=135,source=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;source[i]=55+x%180;source[i+1]=35+y%170;
 source[i+2]=(x*7+y*3)%255;source[i+3]=x<20?100:255;
}
const setting=(extra={})=>normaliseTimelineEffect({presetId:'data-burst',
 intensity:90,speed:1.1,density:62,burstSize:55,burstLife:.31,burstCluster:78,
 burstChroma:82,burstSeed:6262,...extra});
const draw=(extra={},time=.65)=>{const e=setting(extra);return buildDataBurstFrame(source,W,H,e,time*e.speed);};
const signature=data=>{let n=2166136261>>>0;for(const b of data)n=Math.imul(n^b,16777619)>>>0;return n;};
const changed=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4){
 if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)n++;
}return n;};

test('Data Burst is a new source-aware glitch, with its own bounded native controls',()=>{
 assert.equal(TIMELINE_EFFECTS.find(e=>e.id==='data-burst')?.label,'Data Burst');
 assert.ok(requiresCompositeSource('data-burst'));
 assert.deepEqual(TIMELINE_EFFECTS.filter(e=>['tv-static','retro-glitch','signal-interference','crt-scanlines'].includes(e.id)).length,4);
 const defaults=normaliseTimelineEffect({presetId:'data-burst'});
 assert.deepEqual([defaults.density,defaults.burstSize,defaults.burstLife,defaults.burstCluster,defaults.burstChroma,defaults.burstSeed],
  [46,48,.23,67,72,6262]);
 const bounded=setting({burstSize:200,burstLife:2,burstCluster:-10,burstChroma:300,burstSeed:-3});
 assert.deepEqual([bounded.burstSize,bounded.burstLife,bounded.burstCluster,bounded.burstChroma,bounded.burstSeed],
  [100,.6,0,100,0]);
 assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:'signal-interference'}),'burstSize'),false);
});
test('Independent spatial packet corruption leaves clean areas, RGB glitch and original alpha',()=>{
 const result=draw(),altered=changed(result.data,source);
 assert.ok(altered>60,'RGB packets should be visible on real source footage');
 assert.ok(altered<W*H*.40,'Data Burst should not become full-frame TV static or a sync blackout');
 assert.ok(result.state.blocks.length>=3,'At least three spatially distributed corrupt blocks should be active');
 for(let i=0;i<source.length;i+=4)assert.equal(result.data[i+3],source[i+3],'Video alpha is untouched');
 assert.deepEqual(draw({intensity:0}).data,source);
 assert.deepEqual(draw({burstChroma:0}).data,source);
});
test('Temporal packet arrivals, individual fade and reverse seeking are deterministic',()=>{
 const states=[.12,.37,.65,1.15,1.68].map(t=>draw({},t));
 assert.ok(new Set(states.map(s=>signature(s.data))).size>=4);
 assert.deepEqual(draw({},.65).data,draw({},.65).data);
 const a=dataBurstFrameState(W,H,setting(),.12);
 const b=dataBurstFrameState(W,H,setting(),1.15);
 assert.notDeepEqual(a.blocks,b.blocks);
 assert.ok(a.blocks.every(x=>x.w>=2&&x.h>=2&&x.alpha>=0&&x.alpha<=1));
});
test('Native size, life, clustering, chroma, density, intensity, speed and seed change real pixels',()=>{
 const base=signature(draw().data);
 for(const value of [
  {burstSize:10},{burstLife:.55},{burstCluster:0},{burstChroma:20},
  {density:5},{intensity:20},{speed:3.1},{burstSeed:453}
 ])assert.notEqual(signature(draw(value).data),base,JSON.stringify(value));
});
test('Undo/Redo, recovered session and portable project retain the same burst recipe',()=>{
 const recipe=setting({burstSize:24,burstCluster:90,burstSeed:4786});
 const clip={id:'burst',type:'sticker',start:0,clipDuration:3,sourceFileId:'source-1',sourceName:'burst.png',
  effectOverlay:recipe};
 const record=snapshotClip(clip),undo={id:'burst',type:'sticker'};applyClipData(undo,record);
 assert.deepEqual(undo.effectOverlay,recipe);
 const portable=createRecoveryRecord({files:[{id:'source-1',kind:'sticker',name:'burst.png',size:1000}],
  tracks:[record],selectedTrackId:'burst',selectedTrackIds:['burst'],history:{undo:[],redo:[]}});
 const reloaded=parseRecoveryRecord(serializeRecoveryRecord(portable));
 assert.deepEqual(reloaded.tracks[0].effectOverlay,recipe);
});
test('Zero opacity is a strict no-op without touching the source or Canvas',()=>{
 let touched=false;
 const context=new Proxy({}, {get:(o,k)=>k in o?o[k]:(...args)=>{touched=true;}});
 assert.equal(renderDataBurst(context,null,W,H,setting(),.6,0),true);
 assert.equal(touched,false);
});
