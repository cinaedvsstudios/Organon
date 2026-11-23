/** MotoriClip #65: fragmented source-displaced data-lines and colourful micro-static. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLineCorruptionFrame,lineCorruptionFrameState,renderLineCorruption} from '../js/timeline-line-corruption.mjs';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';

const W=240,H=135,source=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;
 source[i]=(x*7)%251;
 source[i+1]=(y*11)%247;
 source[i+2]=(x*4+y*3)%249;
 source[i+3]=x<24?70+y%90:255;
}
const recipe=(settings={})=>normaliseTimelineEffect({presetId:'line-corruption',
 intensity:98,speed:1.1,density:97,distortion:88,lineLength:72,lineThickness:6,
 lineFragments:78,lineStatic:94,lineLife:.22,lineSeed:6565,
 color:'#51eeff',lineAccent:'#ff51bb',...settings});
const paint=(settings={},time=.65)=>{
 const fx=recipe(settings);
 return buildLineCorruptionFrame(source,W,H,fx,time*fx.speed);
};
const digest=bytes=>{let n=2166136261>>>0;for(const b of bytes)n=Math.imul(n^b,16777619)>>>0;return n;};
const altered=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)
 if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>30)n++;
 return n;};
test('Line Corruption is its own source-aware preset with validated native controls',()=>{
 assert.equal(TIMELINE_EFFECTS.find(f=>f.id==='line-corruption')?.label,'Line Corruption');
 assert.equal(requiresCompositeSource('line-corruption'),true);
 const e=normaliseTimelineEffect({presetId:'line-corruption'});
 assert.deepEqual([e.intensity,e.density,e.distortion,e.lineLength,e.lineThickness,
  e.lineFragments,e.lineStatic,e.lineLife,e.lineSeed,e.color,e.lineAccent],
  [86,81,71,57,4,73,67,.14,6565,'#5feeff','#ff53ba']);
 const limited=recipe({lineLength:900,lineThickness:99,lineFragments:-1,lineStatic:110,
  lineLife:5,lineSeed:999999,lineAccent:'invalid'});
 assert.deepEqual([limited.lineLength,limited.lineThickness,limited.lineFragments,
  limited.lineStatic,limited.lineLife,limited.lineSeed,limited.lineAccent],
  [100,12,0,100,.4,99999,'#ff53ba']);
 for(const id of ['rgb-block-glitch','signal-tear','data-burst'])
  assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:id}),'lineLength'),false);
});
test('many independent thin fragments alter source video without covering entire image',()=>{
 const {data,state}=paint();
 assert.ok(state.lines.length>3,'Several distinct fast data-lines are active');
 assert.ok(state.lines.some(x=>x.x>0)&&state.lines.some(x=>x.w<W),'Line positions and lengths differ');
 assert.ok(state.lines.every(x=>x.x>=0&&x.y>=0&&x.x+x.w<=W&&x.y+x.h<=H));
 assert.ok(state.lines.every(x=>x.h<=12),'Line corruption must remain thin rather than block-shaped');
 const changed=altered(data,source);
 assert.ok(changed>45,'Broken lines should visibly corrupt actual RGB source');
 assert.ok(changed<W*H*.38,'Most frame pixels outside fragments must remain untouched');
 for(let i=3;i<data.length;i+=4)assert.equal(data[i],source[i],'Alpha must remain byte-identical');
 assert.deepEqual(paint({intensity:0}).data,source);
});
test('damaged lines are source-aware, not a static PNG overlay',()=>{
 const swapped=new Uint8ClampedArray(source.length);
 for(let i=0;i<swapped.length;i+=4){swapped[i]=30;swapped[i+1]=180;swapped[i+2]=60;swapped[i+3]=source[i+3];}
 const a=paint().data,b=buildLineCorruptionFrame(swapped,W,H,recipe(),.65*1.1).data;
 assert.notDeepEqual(a,b);
 let unchanged=0;for(let i=0;i<source.length;i+=4)if(a[i]===source[i]&&a[i+1]===source[i+1]&&a[i+2]===source[i+2])unchanged++;
 assert.ok(unchanged>W*H*.62,'No global-color wash; local source must survive');
});
test('absolute time and seed produce evolving and identical reverse-seek frames',()=>{
 const times=[.2,.4,.65,.92,1.15,1.74];
 const frames=times.map(t=>paint({},t));
 assert.ok(new Set(frames.map(f=>digest(f.data))).size>=4);
 assert.deepEqual(frames[2].data,paint({},.65).data);
 assert.notDeepEqual(lineCorruptionFrameState(W,H,recipe(),.3).lines,
  lineCorruptionFrameState(W,H,recipe(),1.6).lines);
});
test('all native segment settings independently affect image pixels',()=>{
 const original=digest(paint().data);
 for(const change of [{lineLength:12},{lineThickness:1},{lineFragments:4},
  {lineStatic:0},{lineLife:.35},{lineSeed:45},{color:'#ffda34'},
  {lineAccent:'#3bff64'},{density:12},{distortion:2},{intensity:26},{speed:2.8}
 ])assert.notEqual(digest(paint(change).data),original,JSON.stringify(change));
});
test('Undo/history and portable project recovery preserve full line recipe',()=>{
 const effect=recipe({lineLength:31,lineThickness:3,lineAccent:'#4488ee',lineSeed:77});
 const clip={id:'line',type:'sticker',start:0,clipDuration:3,sourceFileId:'source-1',
  sourceName:'image.png',effectOverlay:effect};
 const state=snapshotClip(clip),restored={id:'line',type:'sticker'};
 applyClipData(restored,state);assert.deepEqual(restored.effectOverlay,effect);
 const project=createRecoveryRecord({files:[{id:'source-1',kind:'sticker',name:'image.png',size:99}],
  tracks:[state],selectedTrackId:'line',selectedTrackIds:['line'],history:{undo:[],redo:[]}});
 assert.deepEqual(parseRecoveryRecord(serializeRecoveryRecord(project)).tracks[0].effectOverlay,effect);
});
test('zero-opacity compositor is a no-op',()=>{
 let touched=false;const ctx=new Proxy({}, {get:()=>()=>{touched=true;}});
 assert.equal(renderLineCorruption(ctx,null,W,H,recipe(),.65,0),true);
 assert.equal(touched,false);
});
