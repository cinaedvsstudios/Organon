/** MotoriClip #61 — source-safe CRT raster, no snow, tearing or RGB blocks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCRTScanlinesFrame,crtScanlineFrameState,renderCRTScanlines} from '../js/timeline-crt-scanlines.mjs';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';
const W=144,H=90,source=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;
 source[i]=48+Math.round(165*x/(W-1));
 source[i+1]=40+Math.round(170*y/(H-1));
 source[i+2]=(x*9+y*3)%256;
 source[i+3]=x<22?Math.round(80+140*y/(H-1)):255;
}
const effect=(extra={})=>normaliseTimelineEffect({presetId:'crt-scanlines',
 intensity:90,linePitch:3,lineOpacity:68,gridStrength:45,flickerStrength:50,
 crtRollRate:1.1,scanSeed:6161,...extra});
const render=(settings={},time=.65)=>buildCRTScanlinesFrame(source,W,H,effect(settings),time*effect(settings).speed);
const hash=a=>{let x=2166136261>>>0;for(const b of a)x=Math.imul(x^b,16777619)>>>0;return x;};
const changed=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4){
 if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)n++;
}return n;};

test('CRT Scanlines has independent identity, source capture and valid Inspector settings',()=>{
 assert.equal(TIMELINE_EFFECTS.find(x=>x.id==='crt-scanlines')?.label,'CRT Scanlines');
 assert.ok(requiresCompositeSource('crt-scanlines'));
 assert.equal(requiresCompositeSource('tv-static'),false);
 const d=normaliseTimelineEffect({presetId:'crt-scanlines'});
 assert.deepEqual([d.linePitch,d.lineOpacity,d.gridStrength,d.flickerStrength,d.crtRollRate,d.scanSeed],
  [3,61,38,35,.75,6161]);
 const b=effect({linePitch:100,lineOpacity:-3,gridStrength:300,flickerStrength:200,crtRollRate:99,scanSeed:200000});
 assert.deepEqual([b.linePitch,b.lineOpacity,b.gridStrength,b.flickerStrength,b.crtRollRate,b.scanSeed],[12,0,100,100,4,99999]);
 assert.ok(!Object.hasOwn(normaliseTimelineEffect({presetId:'signal-interference'}),'linePitch'));
 assert.ok(!Object.hasOwn(normaliseTimelineEffect({presetId:'retro-glitch'}),'gridStrength'));
});
test('Fine raster and phosphor grid alter source luminance without moving any image geometry',()=>{
 const r=render(),clean=render({lineOpacity:0,gridStrength:0,flickerStrength:0});
 assert.deepEqual(clean.data,source,'Disabled CRT raster must exactly reproduce original source');
 assert.ok(changed(r.data,source)>W*H*.15,'Visible CRT structure needs many raster pixels');
 for(let i=0;i<source.length;i+=4){
  assert.equal(r.data[i+3],source[i+3],'Original transparent source alpha must remain intact');
  assert.ok(r.data[i]<=source[i]&&r.data[i+1]<=source[i+1]&&r.data[i+2]<=source[i+2],
   'CRT is a luminance grille, not a displaced/glitched RGB source');
 }
 // Equal source intensity across a narrow horizontal row changes by line phase.
 const row=(y)=>r.data[(y*W+65)*4+1];
 assert.ok(new Set(Array.from({length:12},(_,y)=>row(y))).size>4,'Raster gaps must be fine and repeated');
});
test('Flicker, scanline drift and rolling luminance are time-dependent but seek-reversible',()=>{
 const samples=[.11,.25,.65,1.35,2.25].map(t=>hash(render({},t).data));
 assert.ok(new Set(samples).size>=4,'Independent frames need different dynamic beam phases');
 assert.deepEqual(render({},.65).data,render({},.65).data);
 const a=crtScanlineFrameState(W,H,effect(),.1);
 const b=crtScanlineFrameState(W,H,effect(),1.4);
 assert.notEqual(a.rollY,b.rollY);
 assert.notEqual(a.frame,b.frame);
});
test('Scanline pitch, opacity, phosphors, flicker, speed, drift and seed affect actual pixels',()=>{
 const expected=hash(render().data);
 for(const variation of [
  {linePitch:7},{lineOpacity:15},{gridStrength:0},{flickerStrength:100},
  {crtRollRate:3.4},{scanSeed:27},{intensity:30},{speed:3.1}
 ]){
  assert.notEqual(hash(render(variation).data),expected,JSON.stringify(variation));
 }
});
test('Snapshot, Undo/Redo and portable Save/Open preserve independent CRT native settings',()=>{
 const settings=effect({linePitch:4.5,lineOpacity:44,gridStrength:76,scanSeed:274});
 const clip={id:'crt-1',type:'sticker',start:0,clipDuration:3,sourceFileId:'file-1',sourceName:'crt.png',
  effectOverlay:settings};
 const record=snapshotClip(clip),restored={id:'crt-1',type:'sticker'};
 applyClipData(restored,record);
 assert.deepEqual(restored.effectOverlay,settings);
 const portable=createRecoveryRecord({files:[{id:'file-1',kind:'sticker',name:'crt.png',size:2024}],
  tracks:[record],selectedTrackId:'crt-1',selectedTrackIds:['crt-1'],history:{undo:[],redo:[]}});
 const reopened=parseRecoveryRecord(serializeRecoveryRecord(portable));
 assert.deepEqual(reopened.tracks[0].effectOverlay,settings);
 assert.equal(reopened.tracks[0].sourceFileId,'file-1');
});
test('Zero opacity is a strict no-op with no Canvas source mutation',()=>{
 let touched=false;
 const ctx=new Proxy({globalAlpha:1},{get(o,k){return k in o?o[k]:(...args)=>{touched=true;};}});
 assert.equal(renderCRTScanlines(ctx,null,W,H,effect(),.65,0),true);
 assert.equal(touched,false);
});
