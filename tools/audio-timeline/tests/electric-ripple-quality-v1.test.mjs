/** MotoriClip #66 — independent Electric Ripple geometry and source-pixel QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {electricRippleFrameState,buildElectricRippleFrame,renderElectricRipple} from '../js/timeline-electric-ripple.mjs';
import {normaliseTimelineEffect,TIMELINE_EFFECTS,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';
const W=240,H=135,source=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;
 source[i]=(x*5+y*2)%252;
 source[i+1]=(y*9+x*3)%251;
 source[i+2]=(x*7+y*4)%253;
 source[i+3]=x<22?45+y%175:255;
}
const effect=(patch={})=>normaliseTimelineEffect({
 presetId:'electric-ripple',intensity:95,speed:1.18,density:90,
 scale:125,direction:34,distortion:92,glow:86,color:'#83dcff',
 originX:52,originY:48,electricBranches:3,electricWidth:7,
 electricChroma:88,electricFlicker:90,electricSeed:7272,...patch
});
const frame=(patch={},time=.72)=>{const fx=effect(patch);
 return buildElectricRippleFrame(source,W,H,fx,time*fx.speed);};
const hash=bytes=>{let n=2166136261>>>0;for(const v of bytes)n=Math.imul(n^v,16777619)>>>0;return n;};
const changed=(bytes,original,cutoff=25)=>{let count=0;for(let i=0;i<bytes.length;i+=4){
 if(Math.abs(bytes[i]-original[i])+Math.abs(bytes[i+1]-original[i+1])+Math.abs(bytes[i+2]-original[i+2])>cutoff)count++;
 }return count;};
test('one unchanged Electric Ripple ID, source dependence, bounded native Inspector controls',()=>{
 assert.equal(TIMELINE_EFFECTS.filter(x=>x.id==='electric-ripple').length,1);
 assert.equal(requiresCompositeSource('electric-ripple'),true);
 const d=normaliseTimelineEffect({presetId:'electric-ripple'});
 assert.deepEqual([d.color,d.originX,d.originY,d.distortion,d.glow,d.electricBranches,
  d.electricWidth,d.electricChroma,d.electricFlicker,d.electricSeed],
  ['#83dcff',50,50,76,75,2,6,67,70,7272]);
 const limit=effect({electricBranches:10,electricWidth:-3,electricChroma:330,
  electricFlicker:-10,electricSeed:999999});
 assert.deepEqual([limit.electricBranches,limit.electricWidth,limit.electricChroma,
  limit.electricFlicker,limit.electricSeed],[4,1,100,0,99999]);
 for(const id of ['ripple-distortion','particle-sparks','shockwave'])
  assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:id}),'electricBranches'),false);
});
test('individual jagged electric fronts and actual branched tendrils',()=>{
 const state=electricRippleFrameState(W,H,effect(),.72*1.18);
 assert.ok(state.waves.length>=3);
 assert.equal(state.branches.length,state.waves.length*3);
 assert.ok(state.branches.every(b=>b.nodes.length===6),'Forks have several connected vertices');
 assert.ok(new Set(state.waves.map(w=>w.radius.toFixed(2))).size>=3,'Fronts must move independently');
 assert.ok(new Set(state.waves.map(w=>w.cx.toFixed(2)+','+w.cy.toFixed(2))).size>=2);
 const diverse=new Set(state.branches.map(b=>b.nodes.map(p=>p.x.toFixed(2)+':'+p.y.toFixed(2)).join('|')));
 assert.ok(diverse.size>=5,'Not copied straight-line ticks');
 assert.ok(state.waves.every(w=>w.energy>0&&w.jagged>0),'Electrical arcs are modulated');
 assert.equal(electricRippleFrameState(W,H,effect({electricBranches:0}),.72).branches.length,0);
});
test('source-derived real RGB pixels, localized electrical glow and preserved original alpha',()=>{
 const output=frame();
 const pixels=changed(output.data,source);
 assert.ok(pixels>95,'Source distortion should be clearly visible');
 assert.ok(pixels<W*H*.82,'Surrounding scene must remain recognizable');
 for(let i=3;i<source.length;i+=4)
  assert.equal(output.data[i],source[i],'No change to underlying source alpha');
 const secondSource=new Uint8ClampedArray(source.length);
 for(let i=0;i<secondSource.length;i+=4){
  secondSource[i]=45;secondSource[i+1]=180;secondSource[i+2]=195;secondSource[i+3]=source[i+3];
 }
 assert.notDeepEqual(buildElectricRippleFrame(secondSource,W,H,effect(),.72).data,output.data);
 const empty=new Uint8ClampedArray(source.length);
 assert.deepEqual(buildElectricRippleFrame(empty,W,H,effect(),.72).data,empty,
  'Electrical light never fabricates pixels in fully transparent areas');
});
test('absolute-time change and exact restoration after rewinding',()=>{
 const times=[.12,.31,.72,1.06,1.5,1.84];
 const output=times.map(t=>hash(frame({},t).data));
 assert.ok(new Set(output).size>=5,'Expanding fronts evolve at every sampled timestamp');
 assert.equal(hash(frame({},.72).data),output[2],'Backwards seek restores exactly the same image');
 assert.notDeepEqual(electricRippleFrameState(W,H,effect(),.3).branches,
  electricRippleFrameState(W,H,effect(),1.4).branches);
});
test('every visible control changes the electric image, unlike passive Inspector sliders',()=>{
 const original=hash(frame().data);
 for(const value of [{density:10},{scale:43},{direction:-110},{distortion:0},
  {glow:0},{color:'#ff9867'},{originX:8},{originY:91},
  {electricBranches:0},{electricWidth:2},{electricChroma:0},
  {electricFlicker:0},{electricSeed:212},{speed:2.9}]){
  assert.notEqual(hash(frame(value).data),original,'No actual pixel change for '+JSON.stringify(value));
 }
 assert.notDeepEqual(frame().state.waves,frame({density:10}).state.waves);
});
test('zero intensity does not touch host Canvas',()=>{
 let touched=false;const ctx=new Proxy({}, {get:()=>()=>{touched=true;}});
 assert.equal(renderElectricRipple(ctx,null,W,H,effect(),.72,0),true);
 assert.equal(touched,false);
});
test('Undo/Redo and portable project Save/Open preserve electrical recipe',()=>{
 const fx=effect({electricBranches:4,electricWidth:17,electricChroma:42,electricSeed:1981});
 const clip={id:'electric-ripple',type:'sticker',start:0,clipDuration:3,
  sourceFileId:'source-1',sourceName:'effect.png',effectOverlay:fx};
 const saved=snapshotClip(clip),restored={id:clip.id,type:'sticker'};
 applyClipData(restored,saved);assert.deepEqual(restored.effectOverlay,fx);
 const record=createRecoveryRecord({files:[{id:'source-1',kind:'sticker',name:'effect.png',size:90}],
  tracks:[saved],selectedTrackId:clip.id,selectedTrackIds:[clip.id],history:{undo:[],redo:[]}});
 assert.deepEqual(parseRecoveryRecord(serializeRecoveryRecord(record)).tracks[0].effectOverlay,fx);
});
