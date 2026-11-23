/** MotoriClip #66: independently verify source-refracting Ripple Distortion. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {rippleDistortionFrameState,buildRippleDistortionFrame,renderRippleDistortion} from '../js/timeline-ripple-distortion.mjs';
import {normaliseTimelineEffect,TIMELINE_EFFECTS,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';
const W=240,H=135,source=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const k=(y*W+x)*4;
 source[k]=(x*3+y*2)%248;
 source[k+1]=(x*5+y*7)%251;
 source[k+2]=(x*9+y*3)%249;
 source[k+3]=x<17?50+y%190:255;
}
const effect=(patch={})=>normaliseTimelineEffect({
 presetId:'ripple-distortion',intensity:95,speed:1.18,
 density:88,scale:126,distortion:88,direction:21,
 originX:51,originY:48,color:'#a5dfff',
 rippleRings:4,rippleWidth:10,rippleFalloff:55,
 rippleHighlights:76,rippleSeed:6262,...patch
});
const render=(patch={},seconds=.72)=>{const e=effect(patch);
 return buildRippleDistortionFrame(source,W,H,e,seconds*e.speed);};
const hash=bytes=>{let n=2166136261>>>0;for(const v of bytes)n=Math.imul(n^v,16777619)>>>0;return n;};
const changed=(bytes,ref)=>{let count=0;for(let i=0;i<bytes.length;i+=4)
 if(Math.abs(bytes[i]-ref[i])+Math.abs(bytes[i+1]-ref[i+1])+Math.abs(bytes[i+2]-ref[i+2])>24)count++;return count;};
test('original Ripple Distortion ID, real image dependence and bounded ripple settings',()=>{
 assert.equal(TIMELINE_EFFECTS.filter(x=>x.id==='ripple-distortion').length,1);
 assert.equal(requiresCompositeSource('ripple-distortion'),true);
 const d=normaliseTimelineEffect({presetId:'ripple-distortion'});
 assert.deepEqual([d.color,d.originX,d.originY,d.rippleRings,d.rippleWidth,
 d.rippleFalloff,d.rippleHighlights,d.rippleSeed],['#a5dfff',50,50,3,8,58,42,6262]);
 const bad=effect({rippleRings:44,rippleWidth:-10,rippleFalloff:125,rippleHighlights:-2,rippleSeed:1000000});
 assert.deepEqual([bad.rippleRings,bad.rippleWidth,bad.rippleFalloff,bad.rippleHighlights,bad.rippleSeed],
 [6,2,100,0,99999]);
 assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:'electric-ripple'}),'rippleRings'),false);
});
test('circular wavefronts vary in radius and impact location, not regular horizontal strips',()=>{
 const f=render(),waves=f.state.waves;
 assert.ok(waves.length>=4,'Several independent concentric ripple fronts are active');
 assert.ok(waves.every(w=>w.radius>0&&w.thickness>0&&w.energy>0));
 assert.ok(waves.some(w=>w.j>=1),'Each impact can produce delayed concentric ringlets');
 assert.ok(new Set(waves.map(w=>w.radius.toFixed(2))).size>3,'Physically different outward rings');
 assert.ok(new Set(waves.map(w=>w.cx.toFixed(2)+','+w.cy.toFixed(2))).size>=2,'Different independent impact centres');
 const diff=changed(f.data,source);
 assert.ok(diff>75,'Real source pixels must be refracted');
 assert.ok(diff<W*H*.78,'Unrefracted source should remain recognizable');
 for(let i=3;i<source.length;i+=4)assert.equal(f.data[i],source[i],'Preserve every partial and opaque alpha value');
});
test('source changes are reflected in warped pixels, with zero-background transparency',()=>{
 const modified=new Uint8ClampedArray(source.length);
 for(let i=0;i<modified.length;i+=4){modified[i]=30;modified[i+1]=170;modified[i+2]=208;modified[i+3]=source[i+3];}
 assert.notDeepEqual(buildRippleDistortionFrame(modified,W,H,effect(),.72).data,render().data);
 const transparent=new Uint8ClampedArray(source.length);
 assert.deepEqual(buildRippleDistortionFrame(transparent,W,H,effect(),.72).data,transparent);
});
test('absolute time determines independent outward propagation and exact backward seeks',()=>{
 const times=[.1,.35,.72,1.11,1.53,1.96],signatures=times.map(t=>hash(render({},t).data));
 assert.ok(new Set(signatures).size>=5,'The refracted source must evolve with each elapsed time');
 assert.equal(hash(render({},.72).data),signatures[2],'Rewind yields the same exact output bytes');
 assert.notDeepEqual(rippleDistortionFrameState(W,H,effect(),.2).waves,
  rippleDistortionFrameState(W,H,effect(),1.4).waves);
});
test('each relevant native spatial/ripple control changes actual RGBA output',()=>{
 const orig=hash(render().data);
 for(const option of [
  {density:5},{scale:30},{distortion:2},{direction:-100},
  {originX:9},{originY:90},{color:'#ffbc5c'},{speed:2.9},
  {rippleRings:1},{rippleWidth:2},{rippleFalloff:100},
  {rippleHighlights:0},{rippleSeed:19}
 ]){
  assert.notEqual(hash(render(option).data),orig,'Inactive control: '+JSON.stringify(option));
 }
});
test('source-pixel painter does not affect host Canvas for zero amount',()=>{
 let touched=false;const ctx=new Proxy({}, {get:()=>()=>{touched=true;}});
 assert.equal(renderRippleDistortion(ctx,null,W,H,effect(),.72,0),true);
 assert.equal(touched,false);
});
test('project history and portable Save/Open persist all ripple geometry settings',()=>{
 const fx=effect({originX:25,originY:81,rippleRings:6,rippleWidth:14,rippleFalloff:83,rippleSeed:1938});
 const clip={id:'water',type:'sticker',start:0,clipDuration:3,sourceFileId:'media-1',sourceName:'water.png',effectOverlay:fx};
 const snap=snapshotClip(clip),restored={id:'water',type:'sticker'};
 applyClipData(restored,snap);assert.deepEqual(restored.effectOverlay,fx);
 const record=createRecoveryRecord({files:[{id:'media-1',kind:'sticker',name:'water.png',size:90}],
  tracks:[snap],selectedTrackId:'water',selectedTrackIds:['water'],history:{undo:[],redo:[]}});
 assert.deepEqual(parseRecoveryRecord(serializeRecoveryRecord(record)).tracks[0].effectOverlay,fx);
});
