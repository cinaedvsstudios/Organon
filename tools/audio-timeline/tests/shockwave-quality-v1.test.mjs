/** MotoriClip #66 Shockwave quality: source-dependent pressure front acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {shockwaveFrameState,buildShockwaveFrame,renderShockwave} from '../js/timeline-shockwave.mjs';
import {normaliseTimelineEffect,TIMELINE_EFFECTS,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';
const W=240,H=135,source=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const k=(y*W+x)*4;
 source[k]=(x*5+y*2)%247;source[k+1]=(x*3+y*9)%251;
 source[k+2]=(x*7+y*4)%253;source[k+3]=x<25?40+y%180:255;
}
const recipe=(change={})=>normaliseTimelineEffect({
 presetId:'shockwave',intensity:96,speed:1.2,density:81,scale:135,
 direction:24,distortion:87,color:'#ffd98d',originX:53,originY:47,
 shockWidth:7,shockCompression:90,shockTurbulence:75,shockDecay:48,
 shockSeed:7474,...change});
const frame=(change={},time=.72)=>{const e=recipe(change);
 return buildShockwaveFrame(source,W,H,e,time*e.speed);};
const fingerprint=x=>{let v=2166136261>>>0;for(const b of x)v=Math.imul(v^b,16777619)>>>0;return v;};
const pixelDiff=(a,b,threshold=26)=>{let n=0;for(let i=0;i<a.length;i+=4){
 if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>threshold)n++;
 }return n;};
test('existing Shockwave preset ID and its new clamped pressure controls',()=>{
 assert.equal(TIMELINE_EFFECTS.filter(x=>x.id==='shockwave').length,1);
 assert.equal(requiresCompositeSource('shockwave'),true);
 const e=normaliseTimelineEffect({presetId:'shockwave'});
 assert.deepEqual([e.shockWidth,e.shockCompression,e.shockTurbulence,e.shockDecay,e.shockSeed,e.originX,e.originY],
  [6,78,38,55,7474,50,50]);
 const bad=recipe({shockWidth:999,shockCompression:-20,shockTurbulence:110,
  shockDecay:-4,shockSeed:999999});
 assert.deepEqual([bad.shockWidth,bad.shockCompression,bad.shockTurbulence,bad.shockDecay,bad.shockSeed],
  [16,0,100,0,99999]);
 assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:'ripple-distortion'}),'shockCompression'),false);
});
test('pressure shells are independently expanding and uneven rather than static perfect circles',()=>{
 const state=frame().state,p=state.params;
 assert.ok(state.waves.length>=2,'Density generates separate fading aftershocks');
 assert.ok(state.waves.every(w=>w.radius>0&&w.thickness>0&&w.energy>0));
 assert.ok(state.waves.every(w=>w.asymmetry>0),'Fronts have irregular shape');
 assert.ok(new Set(state.waves.map(w=>w.radius.toFixed(2))).size>1);
 const later=frame({},1.17).state;
 assert.ok(later.waves[0].radius>state.waves[0].radius,'Front expands outward');
 assert.ok(later.waves[0].energy<state.waves[0].energy,'Shock energy dissipates');
 assert.ok(p.distortion>0&&p.compression>0);
});
test('source pixels physically refract, surrounding image survives, and alpha is unchanged',()=>{
 const out=frame().data;
 const count=pixelDiff(out,source);
 assert.ok(count>90,'Pressure front must visibly warp real source geometry');
 assert.ok(count<W*H*.78,'Do not obscure most of the image with a flat disc');
 for(let i=3;i<source.length;i+=4)assert.equal(out[i],source[i],'Preserve exact source alpha');
 const swapped=new Uint8ClampedArray(source.length);
 for(let i=0;i<swapped.length;i+=4){
  swapped[i]=31;swapped[i+1]=158;swapped[i+2]=213;swapped[i+3]=source[i+3];
 }
 assert.notDeepEqual(buildShockwaveFrame(swapped,W,H,recipe(),.72).data,out);
 const transparent=new Uint8ClampedArray(source.length);
 assert.deepEqual(buildShockwaveFrame(transparent,W,H,recipe(),.72).data,transparent);
});
test('absolute-time shockwaves evolve and reverse seek restores identical pixels',()=>{
 const times=[.14,.31,.72,1.08,1.42,1.88];
 const observed=times.map(t=>fingerprint(frame({},t).data));
 assert.ok(new Set(observed).size>=5);
 assert.equal(fingerprint(frame({},.72).data),observed[2]);
 assert.notDeepEqual(frame({},.3).state.waves,frame({},1.4).state.waves);
});
test('every visible geometry and force control changes actual source RGB',()=>{
 const base=fingerprint(frame().data);
 for(const variation of [{density:7},{scale:32},{distortion:3},{direction:-110},
  {originX:9},{originY:92},{color:'#77dfff'},{speed:2.8},
  {shockWidth:1},{shockCompression:0},{shockTurbulence:0},
  {shockDecay:100},{shockSeed:19}]){
  assert.notEqual(fingerprint(frame(variation).data),base,'Dormant Inspector control '+JSON.stringify(variation));
 }
 assert.equal(frame({density:4}).state.waves.length,1);
});
test('zero-opacity source painter does not touch output Canvas',()=>{
 let touched=false;const ctx=new Proxy({}, {get:()=>()=>{touched=true;}});
 assert.equal(renderShockwave(ctx,null,W,H,recipe(),.72,0),true);
 assert.equal(touched,false);
});
test('Undo/Redo and portable recovery retain the full shockwave recipe',()=>{
 const e=recipe({shockCompression:57,shockWidth:9,shockSeed:1981,shockDecay:78});
 const clip={id:'shock',type:'sticker',start:0,clipDuration:3,sourceFileId:'file-1',
  sourceName:'source.png',effectOverlay:e};
 const saved=snapshotClip(clip),other={id:'shock',type:'sticker'};
 applyClipData(other,saved);assert.deepEqual(other.effectOverlay,e);
 const project=createRecoveryRecord({files:[{id:'file-1',kind:'sticker',name:'source.png',size:85}],
  tracks:[saved],selectedTrackId:'shock',selectedTrackIds:['shock'],history:{undo:[],redo:[]}});
 assert.deepEqual(parseRecoveryRecord(serializeRecoveryRecord(project)).tracks[0].effectOverlay,e);
});
