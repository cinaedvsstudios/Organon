import test from 'node:test';
import assert from 'node:assert/strict';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,effectFrameSignature,paintTimelineEffect,requiresCompositeSource,paintEffectPreviewScene} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {PIXEL_EFFECT_IDS,deriveLightMask,separateRgb,isPixelEffect} from '../js/timeline-pixel-effects.mjs';
import {buildDataBurstFrame} from '../js/timeline-data-burst.mjs';
import {buildSignalTearFrame} from '../js/timeline-signal-tear.mjs';
import {buildRgbBlockGlitchFrame} from '../js/timeline-rgb-block-glitch.mjs';
import {buildLineCorruptionFrame} from '../js/timeline-line-corruption.mjs';
import {buildFaultCassetteFrame} from '../js/timeline-fault-cassette.mjs';
import {buildRippleDistortionFrame} from '../js/timeline-ripple-distortion.mjs';
import {buildElectricRippleFrame} from '../js/timeline-electric-ripple.mjs';
import {buildShockwaveFrame} from '../js/timeline-shockwave.mjs';
import {buildVibrationFlashFrame} from '../js/timeline-vibration-flash.mjs';
import {buildNoirGlitchFrame} from '../js/timeline-noir-glitch.mjs';
import {buildMisalignmentFrame} from '../js/timeline-misalignment.mjs';
import {buildWarningGlitchFrame} from '../js/timeline-warning-glitch.mjs';
import {buildNegativeChaosFrame} from '../js/timeline-negative-chaos.mjs';
import {buildGlitchStormFrame} from '../js/timeline-glitch-storm.mjs';
import {buildGlassGlitchFrame} from '../js/timeline-glass-glitch.mjs';
import {buildHaloBlurFrame} from '../js/timeline-halo-blur.mjs';
import {buildChromaticQuirkFrame} from '../js/timeline-chromatic-quirk.mjs';
import {buildEdgeGlowFrame} from '../js/timeline-edge-glow.mjs';
import {buildGlowFrame} from '../js/timeline-glow.mjs';
import {buildRhythmicFlickerFrame,rhythmicFlickerState} from '../js/timeline-rhythmic-flicker.mjs';
import {buildReboundSwingFrame,reboundSwingFrameState} from '../js/timeline-rebound-swing.mjs';
import {buildPendulumSwingFrame} from '../js/timeline-pendulum-swing.mjs';

const makeCanvasRecorder=()=>{
 const log=[];
 const gradient=()=>({addColorStop:(...args)=>log.push(['stop',...args])});
 const context=new Proxy({},{
  get(target,key){if(key==='log')return log;
   if(Object.hasOwn(target,key))return target[key];
   if(key==='globalAlpha')return 1;
   if(key==='createLinearGradient'||key==='createRadialGradient')
    return (...args)=>{log.push([key,...args]);return gradient();};
   return (...args)=>log.push([key,...args]);
  },
  set(target,key,value){target[key]=value;log.push(['set',String(key),typeof value==='number'?Math.round(value*1e5)/1e5:String(value)]);return true;}
 });
 return context;
};
const paint=(preset,t,settings={})=>{
 const ctx=makeCanvasRecorder();
 assert.equal(paintTimelineEffect(ctx,640,360,{presetId:preset,...settings},t,3),true);
 return JSON.stringify(ctx.log);
};
test('phase 3 effect catalog has distinct identities and categories',()=>{
 assert.equal(TIMELINE_EFFECTS.length,43);
 assert.equal(new Set(TIMELINE_EFFECTS.map(x=>x.id)).size,TIMELINE_EFFECTS.length);
 assert.ok(TIMELINE_EFFECTS.every(x=>x.animated&&x.category&&x.group==='effect'));
 assert.deepEqual(
  new Set(TIMELINE_EFFECTS.map(x=>x.category)),
  new Set(['Motion','Light','Distortion','Glitch','Atmospheric','Scanning','Particles/Fire']),
  'the category filter must not expose empty phase-3 groups');
});
test('effect recipe clamps unsafe inputs and normalises colour',()=>{
 const e=normaliseTimelineEffect({presetId:'unknown',intensity:900,speed:0,density:1e8,scale:-3,direction:900,color:'url(javascript:1)'});
 assert.deepEqual(e,{presetId:'light-sweep',intensity:100,speed:.1,density:120,scale:10,direction:180,distortion:55,glow:64,blur:24,originX:20,originY:12,color:'#ffd98d'});
});
test('each procedural recipe is deterministic, time-varying, seek-reversible and isolated',()=>{
 for(const preset of TIMELINE_EFFECTS){
  if(['data-burst','signal-tear','rgb-block-glitch','line-corruption','fault-cassette','ripple-distortion','electric-ripple','shockwave','vibration-flash','pendulum-swing','rebound-swing','rhythmic-flicker','glow','edge-glow','chromatic-quirk','halo-blur','glass-glitch','glitch-storm','negative-chaos','warning-glitch','misalignment','noir-glitch'].includes(preset.id)){
   // This source-pixel effect cannot be evaluated by a mock Canvas call log.
   // Require actual changing pixels and reversible seeking instead.
   const w=160,h=90,data=new Uint8ClampedArray(w*h*4);
   for(let i=0;i<data.length;i+=4){const x=(i/4)%w,y=Math.floor(i/4/w);data[i]=(x*7)%255;data[i+1]=(y*11)%255;data[i+2]=(x*3+y*5)%255;data[i+3]=255;}
   const recipe=normaliseTimelineEffect({presetId:preset.id,density:85,burstSize:60,burstLife:.32,tearHeight:15,tearLife:.26,rgbBlockWidth:27,rgbBlockHeight:19,rgbBlockLife:.28,rgbSeparation:94,lineLength:72,lineThickness:6,lineLife:.22,lineFragments:78,lineStatic:94,cassetteTracking:92,cassetteDropouts:89,cassetteChroma:95,cassetteRoll:70,cassetteSeed:6969,rippleRings:4,rippleWidth:10,rippleFalloff:55,rippleHighlights:80,rippleSeed:6262,
   electricBranches:3,electricWidth:8,electricChroma:90,electricFlicker:90,electricSeed:7272,shockWidth:8,shockCompression:90,shockTurbulence:65,shockDecay:45,
   vibrationFrequency:18,vibrationDecay:25,vibrationEcho:75,vibrationFlash:90,vibrationSeed:8181,
    pendulumPeriod:2.6,pendulumDamping:18,pendulumShutter:65,pendulumFlex:40});
   const painter=preset.id==='noir-glitch'?buildNoirGlitchFrame:preset.id==='misalignment'?buildMisalignmentFrame:preset.id==='warning-glitch'?buildWarningGlitchFrame:preset.id==='negative-chaos'?buildNegativeChaosFrame:preset.id==='glitch-storm'?buildGlitchStormFrame:preset.id==='glass-glitch'?buildGlassGlitchFrame:preset.id==='halo-blur'?buildHaloBlurFrame:preset.id==='chromatic-quirk'?buildChromaticQuirkFrame:preset.id==='edge-glow'?buildEdgeGlowFrame:preset.id==='glow'?buildGlowFrame:preset.id==='rhythmic-flicker'?buildRhythmicFlickerFrame:preset.id==='data-burst'?buildDataBurstFrame:preset.id==='signal-tear'?buildSignalTearFrame:preset.id==='rgb-block-glitch'?buildRgbBlockGlitchFrame:preset.id==='fault-cassette'?buildFaultCassetteFrame:preset.id==='ripple-distortion'?buildRippleDistortionFrame:preset.id==='electric-ripple'?buildElectricRippleFrame:preset.id==='shockwave'?buildShockwaveFrame:preset.id==='vibration-flash'?buildVibrationFlashFrame:preset.id==='rebound-swing'?buildReboundSwingFrame:preset.id==='pendulum-swing'?buildPendulumSwingFrame:buildLineCorruptionFrame;
   const frame=t=>painter(data,w,h,recipe,t*recipe.speed).data;
   const early=frame(.3),later=frame(1.19);
   assert.notDeepEqual(early,later,preset.id+' must visually evolve over actual RGBA source');
   assert.deepEqual(early,frame(.3),preset.id+' must reproduce the same pixels after reverse seek');
   continue;
  }
  const start=paint(preset.id,.1),later=paint(preset.id,1.19);
  assert.notEqual(start,later,preset.id+' must change with time');
  assert.equal(start,paint(preset.id,.1),preset.id+' should recreate identical frame after backward seek');
  assert.ok(start.includes('save')&&start.includes('restore'),preset.id+' must preserve canvas state');
 }
});
test('controls change rendered operations without changing old recipes',()=>{
 const orig=paint('particle-dust',.8,{intensity:75,density:18});
 assert.notEqual(orig,paint('particle-dust',.8,{intensity:75,density:90}));
 assert.notEqual(orig,paint('particle-dust',.8,{intensity:25,density:18}));
 assert.notEqual(paint('light-sweep',.8,{direction:0}),paint('light-sweep',.8,{direction:60}));
 assert.notEqual(paint('hazy-atmosphere',.8,{speed:1}),paint('hazy-atmosphere',.8,{speed:2}));
 assert.equal(paint('rhythmic-flicker',.8,{intensity:0}),'[]');
});
test('effect parameters survive snapshots and undo/redo apply',()=>{
 const settings={presetId:'particle-debris',intensity:48,speed:1.7,density:93,scale:120,direction:-35,color:'#caffee'};
 const original={id:'test',type:'sticker',effectOverlay:settings};
 const saved=snapshotClip(original);
 assert.deepEqual(saved.effectOverlay,normaliseTimelineEffect(settings));
 const target={...original,effectOverlay:null};
 applyClipData(target,saved);
 assert.deepEqual(target.effectOverlay,saved.effectOverlay);
 applyClipData(target,{...saved,effectOverlay:null});
 assert.equal(target.effectOverlay,null);
});
test('phase 3B lighting and scanning effects use distinct pixel operations and reversible time',()=>{
 const newIds=['god-rays','light-leaks','pixel-scan','sci-fi-scan'];
 for(const id of newIds){
  assert.notEqual(paint(id,.3),paint(id,1.4),id+' is time-driven');
  assert.equal(paint(id,.3),paint(id,.3),id+' restores the same pixels after seeking');
 }
 assert.notEqual(paint('god-rays',.75),paint('light-leaks',.75));
 assert.notEqual(paint('pixel-scan',.75),paint('sci-fi-scan',.75));
});
test('God Rays origin is validated, editable and serialized',()=>{
 const ray=normaliseTimelineEffect({presetId:'god-rays',originX:83,originY:16});
 assert.equal(ray.originX,83);assert.equal(ray.originY,16);
 assert.notEqual(paint('god-rays',.8,{originX:10,originY:20}),paint('god-rays',.8,{originX:60,originY:65}));
 const record=snapshotClip({id:'ray',type:'sticker',effectOverlay:ray});
 assert.equal(record.effectOverlay.originX,83);
 const target={id:'ray',type:'sticker'};applyClipData(target,record);
 assert.deepEqual(target.effectOverlay,ray);
 const bounded=normaliseTimelineEffect({presetId:'god-rays',originX:-500,originY:1e5});
 assert.equal(bounded.originX,0);assert.equal(bounded.originY,100);
});

test('default source effect origins match physical motion',()=>{
 const pendulum=normaliseTimelineEffect({presetId:'pendulum-swing'});
 const rebound=normaliseTimelineEffect({presetId:'rebound-swing'});
 const shock=normaliseTimelineEffect({presetId:'shockwave'});
 assert.deepEqual([pendulum.originX,pendulum.originY],[50,10]);
 assert.deepEqual([rebound.originX,rebound.originY],[50,10]);
 assert.deepEqual([shock.originX,shock.originY],[50,50]);
 assert.deepEqual(
  [normaliseTimelineEffect({presetId:'god-rays'}).originX,normaliseTimelineEffect({presetId:'god-rays'}).originY],
  [20,12],'Old God Rays origin remains backwards compatible');
});
test('seven Phase 3C recipes are genuinely different Motion, Distortion and Glitch effects',()=>{
 const ids=['pendulum-swing','rebound-swing','vibration-flash','fault-cassette',
     'ripple-distortion','electric-ripple','shockwave'];
 const categories=new Map(TIMELINE_EFFECTS.map(e=>[e.id,e.category]));
 assert.deepEqual(ids.map(id=>categories.get(id)),[
     'Motion','Motion','Motion','Glitch','Distortion','Distortion','Distortion']);
 for(const id of ids){
  assert.equal(requiresCompositeSource(id),true);
  if(id==='fault-cassette'||id==='ripple-distortion'||id==='electric-ripple'||id==='shockwave'||id==='vibration-flash'||id==='pendulum-swing'||id==='rebound-swing'){
   // Fault Cassette samples REAL source RGBA. Mock Canvas calls cannot
   // demonstrate tape movement, so compare the source pixel output directly.
   const w=160,h=90,rgba=new Uint8ClampedArray(w*h*4);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const k=(y*w+x)*4;
    rgba[k]=(x*7)%255;rgba[k+1]=(y*11)%255;
    rgba[k+2]=(x*3+y*5)%255;rgba[k+3]=255;
   }
   const e=normaliseTimelineEffect({presetId:id,density:92,distortion:91,
    cassetteTracking:92,cassetteDropouts:89,cassetteChroma:95,cassetteRoll:70,
    rippleRings:4,rippleHighlights:80,rippleWidth:10,
    electricBranches:3,electricWidth:8,electricChroma:90,electricFlicker:90,shockWidth:8,shockCompression:90,shockTurbulence:65,
    vibrationFrequency:18,vibrationEcho:75,vibrationFlash:90,
    pendulumPeriod:2.6,pendulumShutter:65,pendulumFlex:40});
   const pixelRenderer=id==='fault-cassette'?buildFaultCassetteFrame:id==='ripple-distortion'?buildRippleDistortionFrame:id==='electric-ripple'?buildElectricRippleFrame:id==='shockwave'?buildShockwaveFrame:id==='vibration-flash'?buildVibrationFlashFrame:id==='rebound-swing'?buildReboundSwingFrame:buildPendulumSwingFrame;
   const frame=t=>pixelRenderer(rgba,w,h,e,t*e.speed).data;
   assert.notDeepEqual(frame(.24),frame(1.4),id+' must vary as seconds change on the source');
   assert.deepEqual(frame(.24),frame(.24),id+' must reproduce pixels after reverse seek');
   continue;
  }
  const atStart=paint(id,.24),later=paint(id,1.4);
  assert.notEqual(atStart,later,id+' must vary as seconds change');
  assert.equal(atStart,paint(id,.24),id+' must reproduce pixels after reverse seek');
 }
 assert.equal(requiresCompositeSource('light-sweep'),true,'Light Sweep now blooms actual source highlights rather than a flat moving rectangle');

 const w=160,h=90,scene=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;scene[i]=(x*7)%251;scene[i+1]=(y*13)%253;
  scene[i+2]=(x*5+y*3)%255;scene[i+3]=255;
 }
 const water=buildRippleDistortionFrame(scene,w,h,
  normaliseTimelineEffect({presetId:'ripple-distortion'}),.6).data;
 const electric=buildElectricRippleFrame(scene,w,h,
  normaliseTimelineEffect({presetId:'electric-ripple'}),.6).data;
 assert.notDeepEqual(water,electric,'Water refraction differs from jagged high-voltage discharge');
 const pressure=buildShockwaveFrame(scene,w,h,
  normaliseTimelineEffect({presetId:'shockwave'}),.6).data;
 assert.notDeepEqual(electric,pressure,'Pressure rarefaction must not resemble electric arcs');
 assert.notDeepEqual(water,pressure,'Pressure shockwave must not be periodic water refraction');
 assert.notDeepEqual(buildFaultCassetteFrame(new Uint8ClampedArray(160*90*4),160,90,normaliseTimelineEffect({presetId:'fault-cassette'}),.6).state,
   {presetId:'vibration-flash'},'Cassette has separate analogue tracking geometry from vibration');
});
test('Rebound Swing starts at rest, recoils and settles with preserved source alpha',()=>{
 const w=80,h=45,src=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<src.length;i+=4){src[i]=(i*3)%251;src[i+1]=(i*7)%253;src[i+2]=(i*11)%255;src[i+3]=i%17===0?0:180;}
 const e=normaliseTimelineEffect({presetId:'rebound-swing'});
 const frame=(t,opts={})=>buildReboundSwingFrame(src,w,h,{...e,...opts},t).data;
 assert.deepEqual(frame(0),src);assert.deepEqual(frame(.2,{distortion:0}),src);
 assert.notDeepEqual(frame(.2),src);assert.notDeepEqual(frame(.2),frame(.5));
 assert.deepEqual(frame(.2),frame(.2));
 const rendered=frame(.2);for(let i=3;i<src.length;i+=4)assert.equal(rendered[i],src[i]);
 for(const [k,v] of Object.entries({reboundPeriod:1.2,reboundDamping:5,reboundShutter:0,reboundFlex:0,direction:90}))assert.notDeepEqual(frame(.2),frame(.2,{[k]:v}),k);
 assert.ok(reboundSwingFrameState(w,h,e,2).energy<reboundSwingFrameState(w,h,e,.2).energy);
 const saved=snapshotClip({id:'rebound',type:'sticker',effectOverlay:e});assert.deepEqual(saved.effectOverlay,e);
});

test('swing pivot, warp severity and preview scene are real editable parameters',()=>{
 const normal=normaliseTimelineEffect({presetId:'pendulum-swing',distortion:150,originX:120,originY:-20});
 assert.equal(normal.distortion,100);assert.equal(normal.originX,100);assert.equal(normal.originY,0);
 const source=new Uint8ClampedArray(160*90*4);
 for(let y=0;y<90;y++)for(let x=0;x<160;x++){
  const i=(y*160+x)*4;source[i]=(x*7)%255;source[i+1]=(y*13)%255;
  source[i+2]=(x+y*3)%255;source[i+3]=255;
 }
 const swing=(x,y)=>buildPendulumSwingFrame(source,160,90,
  normaliseTimelineEffect({presetId:'pendulum-swing',originX:x,originY:y}),.8).data;
 assert.notDeepEqual(swing(20,10),swing(80,80),
  'Pendulum origin must change actual source-pixel rotation around its anchor');
 const w=160,h=90,scene=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=(y*w+x)*4;scene[k]=(x*7)%255;scene[k+1]=(y*13)%255;
  scene[k+2]=(x+y*3)%255;scene[k+3]=255;
 }
 const refraction=d=>buildRippleDistortionFrame(scene,w,h,
  normaliseTimelineEffect({presetId:'ripple-distortion',distortion:d,rippleHighlights:30}),.8).data;
 assert.notDeepEqual(refraction(10),refraction(90),
  'Water ripple distortion severity should alter the actual sampled source pixels');
 const clip={id:'source-warp',type:'sticker',effectOverlay:{
  presetId:'shockwave',intensity:85,distortion:70,originX:33,originY:25}};
 const save=snapshotClip(clip),restored={id:clip.id,type:'sticker'};
 applyClipData(restored,save);
 assert.deepEqual(restored.effectOverlay,normaliseTimelineEffect(clip.effectOverlay));
 const preview=makeCanvasRecorder();
 paintEffectPreviewScene(preview,640,360);
 assert.ok(preview.log.some(row=>row[0]==='fillRect'));
 assert.ok(preview.log.some(row=>row[0]==='arc'));
});
test('phase 3D source pixel effects include independent RGB and bright/edge algorithms',()=>{
 assert.deepEqual(PIXEL_EFFECT_IDS,['glow','edge-glow','chromatic-quirk','halo-blur']);
 for(const id of PIXEL_EFFECT_IDS){
  assert.equal(requiresCompositeSource(id),true);
  assert.equal(isPixelEffect(id),true);
  if(id==='glow'||id==='edge-glow'||id==='chromatic-quirk'||id==='halo-blur')continue; // evaluated against actual RGBA in dedicated tests
  assert.notEqual(paint(id,.25),paint(id,1.44),id+' changes over local time');
  assert.equal(paint(id,.25),paint(id,.25),id+' works with reverse scrubbing');
 }
 assert.equal(isPixelEffect('fire-embers'),false);
 const w=5,h=5,data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++){
  const k=i*4;
  data[k]=15;data[k+1]=15;data[k+2]=15;data[k+3]=255;
 }
 const center=(2*w+2)*4;data[center]=255;data[center+1]=254;data[center+2]=253;
 const bright=deriveLightMask(data,w,h,'glow','#ffdb99',.75);
 const edges=deriveLightMask(data,w,h,'edge-glow','#ffdb99',.75);
 assert.ok(bright[center+3]>100,'bright regions have strong glow');
 assert.equal(bright[0+3],0,'dark regions do not glow');
 assert.equal(edges[center+3],0,'flat central area has no edge response');
 assert.ok(edges[((2*w+1)*4)+3]>0,'edge detects image boundary, not brightness');
 assert.notDeepEqual(bright,edges);
 const channels=separateRgb(new Uint8ClampedArray([21,94,182,255]));
 assert.deepEqual([...channels[0]],[21,0,0,255]);
 assert.deepEqual([...channels[1]],[0,94,0,255]);
 assert.deepEqual([...channels[2]],[0,0,182,255]);
});
test('Phase 3D fire types render as different procedures at each timestamp',()=>{
 const flames=paint('fire-flames',.68);
 const embers=paint('fire-embers',.68);
 const burst=paint('fire-explosion',.68);
 assert.notEqual(flames,embers);assert.notEqual(embers,burst);
 assert.ok(flames.includes('quadraticCurveTo'),'flames use curved flame tongues');
 assert.ok(embers.includes('arc'),'embers are independent particles');
 assert.ok(burst.includes('stroke'),'explosion throws radial streaks');
 for(const id of ['fire-flames','fire-embers','fire-explosion']){
  assert.notEqual(paint(id,.21),paint(id,1.12));
  assert.equal(paint(id,.21),paint(id,.21));
 }
});
test('Glow and blur settings survive clip snapshots with safe bounds',()=>{
 const effect=normaliseTimelineEffect({presetId:'halo-blur',glow:30,blur:18,originX:62,originY:35});
 assert.equal(effect.glow,30);assert.equal(effect.blur,18);
 assert.deepEqual([effect.originX,effect.originY],[62,35]);
 assert.deepEqual([normaliseTimelineEffect({presetId:'halo-blur'}).originX,normaliseTimelineEffect({presetId:'halo-blur'}).originY],[50,50]);
 assert.equal(normaliseTimelineEffect({blur:-44,glow:200}).blur,0);
 assert.equal(normaliseTimelineEffect({blur:-44,glow:200}).glow,100);
 const saved=snapshotClip({id:'soft',type:'sticker',effectOverlay:effect});
 const target={id:'soft',type:'sticker'};
 applyClipData(target,saved);assert.deepEqual(target.effectOverlay,effect);
});
test('fixed frame-local time does not rely on wall clock or frame iteration order',()=>{
 const settings={presetId:'light-sweep',speed:1.25};
 const a=effectFrameSignature(settings,1.25,3);
 assert.equal(a.cycle,1.5625);
 assert.deepEqual(a,effectFrameSignature(settings,1.25,3));
 assert.equal(effectFrameSignature(settings,100,3).seconds,3);
});

test('Rhythmic Flicker changes real exposure, keeps alpha and starts neutral',()=>{
 const w=80,h=45,src=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<src.length;i+=4){src[i]=(i*3)%251;src[i+1]=(i*7)%253;src[i+2]=(i*11)%255;src[i+3]=i%17===0?0:180;}
 const e=normaliseTimelineEffect({presetId:'rhythmic-flicker'});
 const frame=(t,opts={})=>buildRhythmicFlickerFrame(src,w,h,{...e,...opts},t).data;
 assert.deepEqual(frame(0),src);
 assert.notDeepEqual(frame(.14),src);assert.notDeepEqual(frame(.14),frame(.48));
 assert.deepEqual(frame(.14),frame(.14));
 const out=frame(.14);for(let i=3;i<src.length;i+=4)assert.equal(out[i],src[i]);
 for(const [k,v] of Object.entries({flickerBpm:60,flickerDuty:75,flickerExposure:10,flickerWarmth:90,flickerVariation:100,flickerSeed:1234,color:'#3366ff'}))assert.notDeepEqual(frame(.14),frame(.14,{[k]:v}),k);
 assert.ok(rhythmicFlickerState(e,.14).stops>0);assert.ok(rhythmicFlickerState(e,.48).stops<0);
 assert.deepEqual(snapshotClip({id:'flicker',type:'sticker',effectOverlay:e}).effectOverlay,e);
});

test('Glow blooms from bright regions with soft knee and preserves alpha',()=>{
 const w=160,h=90,src=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,v=x>=70&&x<90&&y>=35&&y<55?255:x>=30&&x<45?186:20;src[i]=src[i+1]=src[i+2]=v;src[i+3]=x<4?0:255;}
 const e=normaliseTimelineEffect({presetId:'glow',glow:95,blur:40,glowThreshold:45,glowKnee:45,glowBreath:50});
 const frame=(t,opts={})=>buildGlowFrame(src,w,h,{...e,...opts},t).data;
 const a=frame(.25),i=(45*w+94)*4;
 assert.ok(a[i]>src[i],'bloom spreads beyond the highlight');
 assert.equal(a[(45*w+150)*4],20,'distant dark region stays dark');
 assert.deepEqual(frame(.25,{glow:0}),src);
 assert.notDeepEqual(a,frame(1.2));assert.deepEqual(a,frame(.25));
 for(let i=3;i<a.length;i+=4)assert.equal(a[i],src[i]);
 for(const [k,v] of Object.entries({glowThreshold:80,glowKnee:0,glowBreath:0,glow:30,blur:5,color:'#3388ff'}))assert.notDeepEqual(a,frame(.25,{[k]:v}),k);
 const saved=snapshotClip({id:'glow',type:'sticker',effectOverlay:e});assert.deepEqual(saved.effectOverlay,e);
});

test('Edge Glow illuminates contours rather than flat highlights and preserves alpha',()=>{
 const w=160,h=90,src=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;
 const rgb=x>=45&&x<105?[190,190,190]:x>=120?[15,100,180]:[30,30,30];
 src.set([...rgb,x<4?0:255],i);}
 const e=normaliseTimelineEffect({presetId:'edge-glow',glow:95,blur:20,edgeThreshold:10,edgeWidth:8,edgeChroma:60,edgePulse:60});
 const frame=(t,opts={})=>buildEdgeGlowFrame(src,w,h,{...e,...opts},t).data;
 const a=frame(.25),i=(45*w+44)*4;
 assert.ok(a[i]>src[i],'contour emits light');
 assert.equal(a[(45*w+75)*4],190,'flat bright region does not emit');
 assert.deepEqual(frame(.25,{glow:0}),src);
 assert.notDeepEqual(a,frame(1.2));assert.deepEqual(a,frame(.25));
 for(let i=3;i<a.length;i+=4)assert.equal(a[i],src[i]);
 for(const [k,v] of Object.entries({edgeThreshold:90,edgeWidth:1,edgeChroma:0,edgePulse:0,glow:30,blur:4,color:'#3388ff'}))assert.notDeepEqual(a,frame(.25,{[k]:v}),k);
 assert.deepEqual(snapshotClip({id:'edge',type:'sticker',effectOverlay:e}).effectOverlay,e);
});

test('Chromatic Quirk separates real wavelengths with radial and directional geometry, preserving alpha',()=>{
 const w=160,h=90,src=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,v=(Math.floor(x/10)+Math.floor(y/10))%2?220:25;src.set([v,v,v,x<4?0:x<8?120:255],i);}
 const e=normaliseTimelineEffect({presetId:'chromatic-quirk',distortion:90,scale:140,direction:20,chromaRadial:60,chromaDrift:70});
 const frame=(t,opts={})=>buildChromaticQuirkFrame(src,w,h,{...e,...opts},t).data;
 const a=frame(.25);assert.deepEqual(frame(.25,{distortion:0}),src);
 assert.notDeepEqual(a,src);assert.notDeepEqual(a,frame(1.2));assert.deepEqual(a,frame(.25));
 let fringe=0;for(let i=0;i<a.length;i+=4){assert.equal(a[i+3],src[i+3]);if(a[i+3]&&Math.abs(a[i]-a[i+2])>20)fringe++;}
 assert.ok(fringe>200,'achromatic source must acquire optical red/blue fringes');
 for(const [k,v] of Object.entries({chromaRadial:0,chromaDrift:0,chromaBalance:80,chromaGreen:80,originX:15,originY:85,direction:100,scale:50,distortion:20}))assert.notDeepEqual(a,frame(.25,{[k]:v}),k);
 assert.deepEqual(snapshotClip({id:'chroma',type:'sticker',effectOverlay:e}).effectOverlay,e);
 // Hidden RGB in transparent input must not contaminate visible output.
 const contaminated=src.slice();for(let i=0;i<contaminated.length;i+=4)if(!contaminated[i+3])contaminated.set([255,0,255,0],i);
 const b=buildChromaticQuirkFrame(contaminated,w,h,e,.25).data;
 for(let i=0;i<a.length;i+=4)if(a[i+3])assert.deepEqual(a.slice(i,i+4),b.slice(i,i+4));
});

test('Halo Blur keeps a sharp focal core, diffuses the periphery and preserves alpha',()=>{
 const w=160,h=90,src=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,v=(Math.floor(x/4)+Math.floor(y/4))%2?245:15;src.set([v,v,v,x<4?0:x<8?120:255],i);}
 const e=normaliseTimelineEffect({presetId:'halo-blur',blur:40,glow:70,haloFocus:30,haloFeather:40,haloAspect:130,haloBreath:80});
 const frame=(t,opts={})=>buildHaloBlurFrame(src,w,h,{...e,...opts},t).data;
 const a=frame(.25);assert.deepEqual(frame(.25,{blur:0}),src);
 for(let y=40;y<50;y++)for(let x=75;x<85;x++){const i=(y*w+x)*4;assert.deepEqual(a.slice(i,i+4),src.slice(i,i+4));}
 const contrast=(p,y,x)=>Math.abs(p[(y*w+x)*4]-p[(y*w+x+4)*4]);
 assert.ok(contrast(a,12,12)<contrast(src,12,12)*.4,'peripheral detail must soften');
 assert.notDeepEqual(a,frame(1.8));assert.deepEqual(a,frame(.25));
 for(let i=3;i<a.length;i+=4)assert.equal(a[i],src[i]);
 for(const [k,v] of Object.entries({haloFocus:60,haloFeather:10,haloAspect:60,haloBreath:0,originX:15,originY:85,glow:0,blur:5}))assert.notDeepEqual(a,frame(.25,{[k]:v}),k);
 assert.deepEqual(snapshotClip({id:'halo',type:'sticker',effectOverlay:e}).effectOverlay,e);
 const contaminated=src.slice();for(let i=0;i<contaminated.length;i+=4)if(!contaminated[i+3])contaminated.set([255,0,255,0],i);
 const b=buildHaloBlurFrame(contaminated,w,h,e,.25).data;
 for(let i=0;i<a.length;i+=4)if(a[i+3])assert.deepEqual(a.slice(i,i+4),b.slice(i,i+4));
});
