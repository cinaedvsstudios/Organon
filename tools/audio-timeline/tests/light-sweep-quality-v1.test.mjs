/** MotoriClip #66 audit: replacing the former flat gradient Light Sweep. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLightSweepFrame,lightSweepFrameState,renderLightSweep} from '../js/timeline-light-sweep.mjs';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';
const W=240,H=135,source=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;
 const base=y<H/2?24:146;
 source[i]=Math.min(255,base+(x%29)*2);
 source[i+1]=Math.min(255,base+(x%17)*3);
 source[i+2]=Math.min(255,base+(y%15)*2);
 if(x%43===0){source[i]=220;source[i+1]=230;source[i+2]=235;}
 source[i+3]=x<14?70+y%110:255;
}
const recipe=(extra={})=>normaliseTimelineEffect({presetId:'light-sweep',intensity:95,
 speed:1.15,density:74,direction:5,scale:105,glow:82,blur:27,color:'#ffe1a1',
 ...extra});
const paint=(extra={},seconds=1.3)=>{const e=recipe(extra);return buildLightSweepFrame(source,W,H,e,seconds*e.speed);};
const digest=bytes=>{let h=2166136261>>>0;for(const b of bytes)h=Math.imul(h^b,16777619)>>>0;return h;};
const countChanged=(a,b)=>{let total=0;for(let i=0;i<a.length;i+=4){
 const diff=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);
 if(diff>12)total++;
}return total;};
test('existing Light Sweep ID is preserved and now samples the true lower source',()=>{
 assert.equal(TIMELINE_EFFECTS.filter(x=>x.id==='light-sweep').length,1);
 assert.equal(requiresCompositeSource('light-sweep'),true);
 assert.equal(normaliseTimelineEffect({presetId:'light-sweep'}).color,'#ffd98d');
 const state=lightSweepFrameState(W,H,recipe(),1.3);
 assert.ok(state.beamWidth>0&&state.centre<.8&&state.centre>-.8);
});
test('source-aware highlights and contours, not constant-brightness sliding rectangle',()=>{
 const result=paint(),modified=countChanged(source,result.data);
 assert.ok(modified>40,'Illuminated source geometry must change visible RGB pixels');
 assert.ok(modified<W*H*.65,'The sweeping highlight must not cover the whole frame');
 for(let i=3;i<source.length;i+=4)assert.equal(result.data[i],source[i],'Preserve each source alpha byte');
 const flatBlack=new Uint8ClampedArray(W*H*4);
 const light=buildLightSweepFrame(flatBlack,W,H,recipe(),1.3);
 assert.deepEqual(light.data,flatBlack,'Fully transparent background remains invisible');
 assert.deepEqual(paint({intensity:0}).data,source,'Zero intensity leaves source unmodified');
});
test('luminosity catches the bright image rather than drawing a flat opaque slab',()=>{
 const original=paint({direction:0},1.3).data;
 const changed=(x,y)=>{const i=(y*W+x)*4;return original[i]-source[i]+
  original[i+1]-source[i+1]+original[i+2]-source[i+2];};
 // Near the beam centre: the bright lower band must catch more reflected
 // light than a uniform dark region in the upper band.
 assert.ok(changed(140,100)>changed(140,25),'Bright uniform content must catch more bloom than a uniformly dark region');
});
test('absolute-time motion, backward seeks and colour geometry are deterministic',()=>{
 const times=[.28,.65,1.3,1.75,2.18];
 const signatures=times.map(t=>digest(paint({},t).data));
 assert.ok(new Set(signatures).size>=4,'Source highlights must actually travel');
 assert.equal(digest(paint({},1.3).data),signatures[2],'No hidden frame counter');
 const early=lightSweepFrameState(W,H,recipe(),.3),later=lightSweepFrameState(W,H,recipe(),1.8);
 assert.notEqual(early.centre,later.centre);
});
test('every relevant Inspector control affects image pixels',()=>{
 const base=digest(paint().data);
 for(const change of [{intensity:24},{speed:2.6},{density:3},{direction:85},
  {scale:24},{glow:0},{blur:0},{color:'#53cfff'}]){
  const hash=digest(paint(change).data);
  assert.notEqual(hash,base,'Inactive control: '+JSON.stringify(change));
 }
});
test('existing clip settings survive Undo/Redo and portable project recovery',()=>{
 const fx=recipe({glow:43,blur:51,scale:170,color:'#ffb1cc'});
 const clip={id:'glint',type:'sticker',start:0,clipDuration:3,
  sourceFileId:'media-1',sourceName:'scene.png',effectOverlay:fx};
 const snap=snapshotClip(clip),restore={id:'glint',type:'sticker'};
 applyClipData(restore,snap);assert.deepEqual(restore.effectOverlay,fx);
 const project=createRecoveryRecord({files:[{id:'media-1',kind:'sticker',name:'scene.png',size:110}],
  tracks:[snap],selectedTrackId:'glint',selectedTrackIds:['glint'],history:{undo:[],redo:[]}});
 assert.deepEqual(parseRecoveryRecord(serializeRecoveryRecord(project)).tracks[0].effectOverlay,fx);
});
test('zero amount does not access Canvas or source',()=>{
 let touched=false;const ctx=new Proxy({}, {get:()=>()=>{touched=true;}});
 assert.equal(renderLightSweep(ctx,null,W,H,recipe(),1.3,0),true);
 assert.equal(touched,false);
});
