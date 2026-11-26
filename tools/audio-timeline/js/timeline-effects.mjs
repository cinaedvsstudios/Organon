/**
 * MotoriClip procedural effect clips — Phase 3A–E.
 * Effects are recipes (not PNG animations). Preview and both exporters render
 * from identical clip-relative seconds, including reverse seeking.
 * Artifex FX's procedural/seeded approach informed this independent Canvas2D
 * implementation; no runtime or nonportable asset dependency is introduced.
 */
import {isPixelEffect,renderPixelEffect,PIXEL_EFFECT_IDS} from './timeline-pixel-effects.mjs';
import {renderPixelScan} from './timeline-pixel-scan.mjs';
import {renderFlamingDust} from './timeline-ember-dust.mjs';
import {renderHazyAtmosphere} from './timeline-hazy-atmosphere.mjs';
import {renderMistFog} from './timeline-mist-fog.mjs';
import {renderTVStatic} from './timeline-tv-static.mjs';
import {renderSignalInterference} from './timeline-signal-interference.mjs';
import {renderCRTScanlines} from './timeline-crt-scanlines.mjs';
import {renderDataBurst} from './timeline-data-burst.mjs';
import {renderSignalTear} from './timeline-signal-tear.mjs';
import {renderRgbBlockGlitch} from './timeline-rgb-block-glitch.mjs';
import {renderLineCorruption} from './timeline-line-corruption.mjs';
import {renderFaultCassette} from './timeline-fault-cassette.mjs';
import {renderRippleDistortion} from './timeline-ripple-distortion.mjs';
import {renderElectricRipple} from './timeline-electric-ripple.mjs';
import {renderShockwave} from './timeline-shockwave.mjs';
import {renderVibrationFlash} from './timeline-vibration-flash.mjs';
import {renderHaloBlur} from './timeline-halo-blur.mjs';
import {renderChromaticQuirk} from './timeline-chromatic-quirk.mjs';
import {renderEdgeGlow} from './timeline-edge-glow.mjs';
import {renderGlow} from './timeline-glow.mjs';
import {renderRhythmicFlicker} from './timeline-rhythmic-flicker.mjs';
import {renderReboundSwing} from './timeline-rebound-swing.mjs';
import {renderPendulumSwing} from './timeline-pendulum-swing.mjs';
import {renderLightSweep} from './timeline-light-sweep.mjs';
import {renderElectricSparks} from './timeline-electric-sparks.mjs';
import {renderFlyingDebris} from './timeline-flying-debris.mjs';
import {renderSciFiScan} from './timeline-sci-fi-scan.mjs';
import {renderFireFlames} from './timeline-fire-flames.mjs';
import {renderFireExplosion} from './timeline-fire-explosion.mjs';
import {renderLightLeaks} from './timeline-light-leaks.mjs';
import {renderGodRays} from './timeline-god-rays.mjs';
import {renderStarburst} from './timeline-starburst.mjs';
import {renderCameraFrame} from './timeline-camera-frame.mjs';
import {GLITCH_PRESETS,isGlitchEffect,renderGlitchEffect} from './timeline-glitch-effects.mjs';
export const TIMELINE_EFFECTS=Object.freeze([
 {id:'light-sweep',label:'Light Sweep',group:'effect',category:'Light',animated:true},
 {id:'hazy-atmosphere',label:'Hazy Atmosphere',group:'effect',category:'Atmospheric',animated:true},
 {id:'mist-fog-bank',label:'Mist / Fog Bank',group:'effect',category:'Atmospheric',animated:true},
 {id:'tv-static',label:'TV Static / Snow',group:'effect',category:'Glitch',animated:true},
 {id:'signal-interference',label:'Signal Interference',group:'effect',category:'Glitch',animated:true},
 {id:'crt-scanlines',label:'CRT Scanlines',group:'effect',category:'Glitch',animated:true},
  {id:'data-burst',label:'Data Burst',group:'effect',category:'Glitch',animated:true},
  {id:'signal-tear',label:'Signal Tear',group:'effect',category:'Glitch',animated:true},
  {id:'rgb-block-glitch',label:'RGB Block Glitch',group:'effect',category:'Glitch',animated:true},
  {id:'line-corruption',label:'Line Corruption',group:'effect',category:'Glitch',animated:true},
 {id:'rhythmic-flicker',label:'Rhythmic Flicker',group:'effect',category:'Light',animated:true},
 {id:'particle-dust',label:'Floating Dust',group:'effect',category:'Particles/Fire',animated:true},
 {id:'particle-sparks',label:'Electric Sparks',group:'effect',category:'Particles/Fire',animated:true},
 {id:'particle-debris',label:'Flying Debris',group:'effect',category:'Particles/Fire',animated:true},
 {id:'god-rays',label:'God Rays',group:'effect',category:'Light',animated:true},
 {id:'starburst',label:'Rotating Starburst',group:'effect',category:'Light',animated:true},
 {id:'camera-frame',label:'Camcorder Frame / REC HUD',group:'effect',category:'Scanning',animated:true},
 {id:'light-leaks',label:'Organic Light Leaks',group:'effect',category:'Light',animated:true},
 {id:'pixel-scan',label:'Pixel Scan',group:'effect',category:'Scanning',animated:true},
 {id:'sci-fi-scan',label:'Sci-Fi Scan',group:'effect',category:'Scanning',animated:true},
 {id:'pendulum-swing',label:'Pendulum Swing',group:'effect',category:'Motion',animated:true},
 {id:'rebound-swing',label:'Rebound Swing',group:'effect',category:'Motion',animated:true},
 {id:'vibration-flash',label:'Vibration Flash',group:'effect',category:'Motion',animated:true},
 {id:'fault-cassette',label:'Fault Cassette',group:'effect',category:'Glitch',animated:true},
 {id:'ripple-distortion',label:'Ripple Distortion',group:'effect',category:'Distortion',animated:true},
 {id:'electric-ripple',label:'Electric Ripple',group:'effect',category:'Distortion',animated:true},
 {id:'shockwave',label:'Shockwave',group:'effect',category:'Distortion',animated:true},
 {id:'glow',label:'Glow',group:'effect',category:'Light',animated:true},
 {id:'edge-glow',label:'Edge Glow',group:'effect',category:'Light',animated:true},
 {id:'chromatic-quirk',label:'Chromatic Quirk',group:'effect',category:'Distortion',animated:true},
 {id:'halo-blur',label:'Halo Blur',group:'effect',category:'Atmospheric',animated:true},
 {id:'fire-flames',label:'Fire Flames',group:'effect',category:'Particles/Fire',animated:true},
 {id:'fire-embers',label:'Fire Embers',group:'effect',category:'Particles/Fire',animated:true},
 {id:'fire-explosion',label:'Fire Explosion',group:'effect',category:'Particles/Fire',animated:true},
 ...GLITCH_PRESETS
]);
const ids=new Set(TIMELINE_EFFECTS.map(item=>item.id));
const clamp=(value,min,max,fallback)=> {
 const n=Number(value);
 return Math.min(max,Math.max(min,Number.isFinite(n)?n:fallback));
};
const random=(seed)=>{
 let n=(Math.imul((seed+1)>>>0,0x9e3779b1)^0x85ebca6b)>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;n^=n>>>15;
 n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
};
const wrap=n=>((n%1)+1)%1;
const rgba=(hex,alpha)=>{
 const v=hex.slice(1);
 return 'rgba('+[0,2,4].map(i=>parseInt(v.slice(i,i+2),16)).join(',')+','+clamp(alpha,0,1,0)+')';
};
export function normaliseTimelineEffect(effect={}){
 const raw=effect&&typeof effect==='object'?effect:{};
 const presetId=ids.has(raw.presetId)?raw.presetId:'light-sweep';
 const swing=['pendulum-swing','rebound-swing'].includes(presetId);
 const pendulumSwing=presetId==='pendulum-swing';
 const shockwave=presetId==='shockwave';
 const vibrationFlash=presetId==='vibration-flash';
 const mistFog=presetId==='mist-fog-bank';
 const tvStatic=presetId==='tv-static';
 const signalInterference=presetId==='signal-interference';
 const crtScanlines=presetId==='crt-scanlines';
  const dataBurst=presetId==='data-burst';
  const signalTear=presetId==='signal-tear';
  const rgbBlockGlitch=presetId==='rgb-block-glitch';
  const lineCorruption=presetId==='line-corruption';
 const starburst=presetId==='starburst';
 const cameraFrame=presetId==='camera-frame';
 const electricSparks=presetId==='particle-sparks';
 const flyingDebris=presetId==='particle-debris';
 const fireExplosion=presetId==='fire-explosion';
 const faultCassette=presetId==='fault-cassette';
 const rippleDistortion=presetId==='ripple-distortion';
 const electricRipple=presetId==='electric-ripple';
 const base={
  presetId,
  intensity:clamp(raw.intensity,0,100,lineCorruption?86:rgbBlockGlitch?91:signalTear?88:dataBurst?84:crtScanlines?85:signalInterference?76:tvStatic?72:70),
  speed:clamp(raw.speed,.1,8,1),
  density:clamp(raw.density,1,120,fireExplosion?62:lineCorruption?81:rgbBlockGlitch?63:signalTear?72:dataBurst?46:signalInterference?68:tvStatic?88:mistFog?73:48),
  scale:clamp(raw.scale,10,300,100),
  direction:clamp(raw.direction,-180,180,0),
  distortion:clamp(raw.distortion,0,100,fireExplosion?68:lineCorruption?71:rgbBlockGlitch?76:signalTear?72:signalInterference?70:mistFog?65:55),
  glow:clamp(raw.glow,0,100,64),
  blur:clamp(raw.blur,0,60,mistFog?34:24),
  originX:clamp(raw.originX,0,100,(starburst||swing||shockwave||electricSparks||flyingDebris||['halo-blur','fire-explosion'].includes(presetId))?50:20),
  originY:clamp(raw.originY,0,100,(starburst||shockwave||['halo-blur','fire-explosion'].includes(presetId))?50:electricSparks?62:flyingDebris?42:swing?10:12),
  color:/^#[0-9a-f]{6}$/i.test(String(raw.color))?String(raw.color).toLowerCase():mistFog?'#dce5ec':presetId==='hazy-atmosphere'?'#d6e0e9':presetId==='sci-fi-scan'?'#63ebff':presetId==='retro-glitch'?'#b8c5d0':presetId==='light-leaks'?'#ed75c8':starburst?'#ffdf00':cameraFrame?'#f0f6ff':lineCorruption?'#5feeff':electricSparks?'#63dcff':flyingDebris?'#aab1bc':rippleDistortion?'#a5dfff':electricRipple?'#83dcff':'#ffd98d'
 };
 if(presetId==='glass-glitch')return {...base,glassMotion:clamp(raw.glassMotion,0,100,65),glassPrism:clamp(raw.glassPrism,0,100,35),glassSeams:clamp(raw.glassSeams,0,100,45),glassSeed:Math.round(clamp(raw.glassSeed,0,99999,1984))};
 if(presetId==='halo-blur')return {...base,haloFocus:clamp(raw.haloFocus,5,90,30),haloFeather:clamp(raw.haloFeather,5,100,45),haloAspect:clamp(raw.haloAspect,50,200,100),haloBreath:clamp(raw.haloBreath,0,100,30)};
 if(presetId==='chromatic-quirk')return {...base,originX:clamp(raw.originX,0,100,50),originY:clamp(raw.originY,0,100,50),chromaRadial:clamp(raw.chromaRadial,0,100,65),chromaDrift:clamp(raw.chromaDrift,0,100,45),chromaBalance:clamp(raw.chromaBalance,-100,100,0),chromaGreen:clamp(raw.chromaGreen,-100,100,0)};
 if(presetId==='edge-glow')return {...base,edgeThreshold:clamp(raw.edgeThreshold,0,100,15),edgeWidth:clamp(raw.edgeWidth,1,12,3),edgeChroma:clamp(raw.edgeChroma,0,100,50),edgePulse:clamp(raw.edgePulse,0,100,30)};
 if(presetId==='glow')return {...base,glowThreshold:clamp(raw.glowThreshold,0,100,55),glowKnee:clamp(raw.glowKnee,0,100,35),glowBreath:clamp(raw.glowBreath,0,100,25)};
 if(presetId==='rhythmic-flicker')return {...base,
  flickerBpm:clamp(raw.flickerBpm,30,180,96),flickerDuty:clamp(raw.flickerDuty,15,85,42),
  flickerExposure:clamp(raw.flickerExposure,0,100,60),flickerWarmth:clamp(raw.flickerWarmth,0,100,25),
  flickerVariation:clamp(raw.flickerVariation,0,100,20),flickerSeed:Math.round(clamp(raw.flickerSeed,0,99999,907))
 };
 if(presetId==='rebound-swing')return {...base,
  reboundPeriod:clamp(raw.reboundPeriod,.2,2,.65),
  reboundDamping:clamp(raw.reboundDamping,0,100,55),
  reboundShutter:clamp(raw.reboundShutter,0,100,45),
  reboundFlex:clamp(raw.reboundFlex,0,100,35)
 };
 if(pendulumSwing)return {...base,
  pendulumPeriod:clamp(raw.pendulumPeriod,.6,6,2.6),
  pendulumDamping:clamp(raw.pendulumDamping,0,100,18),
  pendulumShutter:clamp(raw.pendulumShutter,0,100,45),
  pendulumFlex:clamp(raw.pendulumFlex,0,100,14)
 };
 if(vibrationFlash)return {...base,
  density:clamp(raw.density,1,120,66),
  distortion:clamp(raw.distortion,0,100,72),
  vibrationFrequency:clamp(raw.vibrationFrequency,2,40,18),
  vibrationDecay:clamp(raw.vibrationDecay,0,100,28),
  vibrationEcho:clamp(raw.vibrationEcho,0,100,42),
  vibrationFlash:clamp(raw.vibrationFlash,0,100,65),
  vibrationSeed:Math.round(clamp(raw.vibrationSeed,0,99999,8181))
 };
 if(shockwave)return {...base,
  distortion:clamp(raw.distortion,0,100,65),
  density:clamp(raw.density,1,120,48),
  shockWidth:clamp(raw.shockWidth,1,16,6),
  shockCompression:clamp(raw.shockCompression,0,100,78),
  shockTurbulence:clamp(raw.shockTurbulence,0,100,38),
  shockDecay:clamp(raw.shockDecay,0,100,55),
  shockSeed:Math.round(clamp(raw.shockSeed,0,99999,7474))
 };
 if(electricRipple)return {...base,
  density:clamp(raw.density,1,120,52),
  distortion:clamp(raw.distortion,0,100,76),
  glow:clamp(raw.glow,0,100,75),
  originX:clamp(raw.originX,0,100,50),
  originY:clamp(raw.originY,0,100,50),
  electricBranches:Math.round(clamp(raw.electricBranches,0,4,2)),
  electricWidth:clamp(raw.electricWidth,1,20,6),
  electricChroma:clamp(raw.electricChroma,0,100,67),
  electricFlicker:clamp(raw.electricFlicker,0,100,70),
  electricSeed:Math.round(clamp(raw.electricSeed,0,99999,7272))
 };
 if(rippleDistortion)return {...base,
  density:clamp(raw.density,1,120,48),
  originX:clamp(raw.originX,0,100,50),
  originY:clamp(raw.originY,0,100,50),
  rippleRings:Math.round(clamp(raw.rippleRings,1,6,3)),
  rippleWidth:clamp(raw.rippleWidth,2,24,8),
  rippleFalloff:clamp(raw.rippleFalloff,0,100,58),
  rippleHighlights:clamp(raw.rippleHighlights,0,100,42),
  rippleSeed:Math.round(clamp(raw.rippleSeed,0,99999,6262))
 };
 if(faultCassette)return {...base,
  density:clamp(raw.density,1,120,62),
  distortion:clamp(raw.distortion,0,100,72),
  color:/^#[0-9a-f]{6}$/i.test(String(raw.color))?String(raw.color).toLowerCase():'#ffe0aa',
  cassetteTracking:clamp(raw.cassetteTracking,0,100,79),
  cassetteDropouts:clamp(raw.cassetteDropouts,0,100,62),
  cassetteChroma:clamp(raw.cassetteChroma,0,100,64),
  cassetteRoll:clamp(raw.cassetteRoll,0,100,48),
  cassetteSeed:Math.round(clamp(raw.cassetteSeed,0,99999,6969))
 };
 if(fireExplosion)return {...base,
  glow:clamp(raw.glow,0,100,78),
  explosionShock:clamp(raw.explosionShock,0,100,83),
  explosionSmoke:clamp(raw.explosionSmoke,0,100,53),
  explosionEjecta:clamp(raw.explosionEjecta,0,100,84),
  explosionLife:clamp(raw.explosionLife,1.2,6,3.2),
  explosionSeed:Math.round(clamp(raw.explosionSeed,0,99999,6868))
 };
 if(flyingDebris)return {...base,
  debrisGravity:clamp(raw.debrisGravity,0,100,72),
  debrisTumble:clamp(raw.debrisTumble,0,100,68),
  debrisSpread:clamp(raw.debrisSpread,0,100,67),
  debrisLife:clamp(raw.debrisLife,.35,4,2.15),
  debrisSeed:Math.round(clamp(raw.debrisSeed,0,99999,6767))
 };
 if(electricSparks)return {...base,
  sparkForks:Math.round(clamp(raw.sparkForks,0,4,2)),
  sparkLife:clamp(raw.sparkLife,.12,.9,.38),
  sparkSeed:Math.round(clamp(raw.sparkSeed,0,99999,6666))
 };
 if(cameraFrame)return {...base,
  hudScale:clamp(raw.hudScale,60,150,100),
  frameRate:[24,25,30,60].includes(Number(raw.frameRate))?Number(raw.frameRate):30,
  timecodeOffset:clamp(raw.timecodeOffset,0,3600,0),
  batteryLevel:Math.round(clamp(raw.batteryLevel,0,100,78)),
  jitter:clamp(raw.jitter,0,100,0),
  recColor:/^#[0-9a-f]{6}$/i.test(String(raw.recColor))?String(raw.recColor).toLowerCase():'#ff364c',
  showRec:![false,'false',0,'0'].includes(raw.showRec),
  showTimecode:![false,'false',0,'0'].includes(raw.showTimecode),
  showBattery:![false,'false',0,'0'].includes(raw.showBattery),
  showCorners:![false,'false',0,'0'].includes(raw.showCorners),
  showReticle:![false,'false',0,'0'].includes(raw.showReticle)
 };
 if(mistFog)return {...base,
  windSpeed:clamp(raw.windSpeed,0,4,1.2),
  bankHeight:clamp(raw.bankHeight,15,90,64),
  seed:Math.round(clamp(raw.seed,0,99999,58))
 };
 if(tvStatic)return {...base,
  staticMode:raw.staticMode==='color'?'color':'mono',
  staticBrightness:clamp(raw.staticBrightness,0,100,52),
  staticVariance:clamp(raw.staticVariance,0,100,88),
  staticSeed:Math.round(clamp(raw.staticSeed,0,99999,59))
 };
 if(signalInterference)return {...base,
  signalLoss:clamp(raw.signalLoss,0,100,56),
  colorBleed:clamp(raw.colorBleed,0,100,64),
  rollRate:clamp(raw.rollRate,.1,5,1.1),
  signalSeed:Math.round(clamp(raw.signalSeed,0,99999,6060))
 };
 if(crtScanlines)return {...base,
  linePitch:clamp(raw.linePitch,1.5,12,3),
  lineOpacity:clamp(raw.lineOpacity,0,100,61),
  gridStrength:clamp(raw.gridStrength,0,100,38),
  flickerStrength:clamp(raw.flickerStrength,0,100,35),
  crtRollRate:clamp(raw.crtRollRate,0,4,.75),
  scanSeed:Math.round(clamp(raw.scanSeed,0,99999,6161))
 };
 if(lineCorruption)return {...base,
   lineLength:clamp(raw.lineLength,5,100,57),
   lineThickness:clamp(raw.lineThickness,1,12,4),
   lineFragments:clamp(raw.lineFragments,0,100,73),
   lineStatic:clamp(raw.lineStatic,0,100,67),
   lineLife:clamp(raw.lineLife,.04,.4,.14),
   lineSeed:Math.round(clamp(raw.lineSeed,0,99999,6565)),
   lineAccent:/^#[0-9a-f]{6}$/i.test(String(raw.lineAccent))?String(raw.lineAccent).toLowerCase():'#ff53ba'
  };
 if(rgbBlockGlitch)return {...base,
   rgbBlockWidth:clamp(raw.rgbBlockWidth,2,45,21),
   rgbBlockHeight:clamp(raw.rgbBlockHeight,2,45,15),
   rgbSeparation:clamp(raw.rgbSeparation,0,100,78),
   rgbBlockLife:clamp(raw.rgbBlockLife,.06,.6,.23),
   rgbBlockSeed:Math.round(clamp(raw.rgbBlockSeed,0,99999,6464))
  };
 if(signalTear)return {...base,
   tearHeight:clamp(raw.tearHeight,1,30,9),
   tearFragment:clamp(raw.tearFragment,0,100,68),
   tearLife:clamp(raw.tearLife,.06,.6,.17),
   tearSeed:Math.round(clamp(raw.tearSeed,0,99999,6363))
  };
  if(dataBurst)return {...base,
   burstSize:clamp(raw.burstSize,5,100,48),
   burstLife:clamp(raw.burstLife,.06,.6,.23),
   burstCluster:clamp(raw.burstCluster,0,100,67),
   burstChroma:clamp(raw.burstChroma,0,100,72),
   burstSeed:Math.round(clamp(raw.burstSeed,0,99999,6262))
  };
  if(!starburst)return base;
 return {...base,
  secondaryColor:/^#[0-9a-f]{6}$/i.test(String(raw.secondaryColor))?String(raw.secondaryColor).toLowerCase():'#ffffff',
  rayCount:Math.round(clamp(raw.rayCount,4,64,18)),
  rayThickness:clamp(raw.rayThickness,10,90,54),
  spinDirection:Number(raw.spinDirection)===-1?-1:1
 };
}
// Keep one reusable full-frame scratch buffer per Canvas context. No per-frame
// allocations, no mutation of the user's timeline, and no stateful simulations.
const SOURCE_SCRATCH=new WeakMap();
function captureCompositeFrame(ctx,w,h){
 if(!ctx?.canvas||typeof document==='undefined')return null;
 let pair=SOURCE_SCRATCH.get(ctx);
 if(!pair){
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('2d');
  if(!context)return null;
  pair={canvas,context};SOURCE_SCRATCH.set(ctx,pair);
 }
 const {canvas,context}=pair;
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 context.setTransform(1,0,0,1,0,0);
 context.globalAlpha=1;context.globalCompositeOperation='source-over';
 context.clearRect(0,0,w,h);
 context.drawImage(ctx.canvas,0,0,w,h);
 return canvas;
}
const SOURCE_EFFECTS=new Set(['rhythmic-flicker','god-rays','pendulum-swing','rebound-swing','vibration-flash',
 'fault-cassette','ripple-distortion','electric-ripple','shockwave','light-sweep','signal-interference','crt-scanlines','data-burst','signal-tear','rgb-block-glitch','line-corruption',...PIXEL_EFFECT_IDS,...GLITCH_PRESETS.map(x=>x.id)]);
export function requiresCompositeSource(presetId){return SOURCE_EFFECTS.has(presetId);}
/** A neutral illustrated scene supplies geometry for moving/distorting previews.
 * Live clips operate on their real previously composited media instead.
 */
export function paintEffectPreviewScene(ctx,w,h){
 const sky=ctx.createLinearGradient(0,0,0,h);
 sky.addColorStop(0,'#1b3b60');sky.addColorStop(1,'#0d182b');
 ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#adbed0';
 ctx.fillRect(w*.1,h*.25,w*.26,h*.45);
 ctx.fillStyle='#f4bd70';
 ctx.fillRect(w*.14,h*.32,w*.07,h*.1);
 ctx.fillRect(w*.26,h*.32,w*.07,h*.1);
 ctx.fillStyle='#4ea7cf';
 ctx.beginPath();ctx.arc(w*.72,h*.36,h*.12,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#c9e1e9';
 ctx.fillRect(w*.58,h*.68,w*.29,h*.035);
 ctx.fillRect(w*.58,h*.75,w*.22,h*.018);
 ctx.strokeStyle='#95e1ec';ctx.lineWidth=Math.max(1,w*.005);
 ctx.beginPath();ctx.moveTo(w*.08,h*.84);ctx.lineTo(w*.93,h*.84);ctx.stroke();
}

export function effectFrameSignature(effect,seconds,duration=3){
 const e=normaliseTimelineEffect(effect);
 const local=clamp(seconds,0,Math.max(0,Number(duration)||3),0);
 return Object.freeze({...e,seconds:local,cycle:local*e.speed});
}
/** Draw additive/transparent overlays *on the current composited frame*. */
export function paintTimelineEffect(ctx,width,height,effect,seconds,duration=3){
 const e=normaliseTimelineEffect(effect);
 if(!ids.has(e.presetId))return false;
 const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
 const t=effectFrameSignature(e,seconds,duration).cycle;
 const strength=e.intensity/100;
 if(strength<=0)return true;
 const size=e.scale/100,rad=e.direction*Math.PI/180;
 // Source-dependent effects copy the *already composed* lower layers, so
 // their motion and distortion alter pixels instead of imitating a warp
 // with a still or purely decorative overlay.
 const source=requiresCompositeSource(e.presetId)?captureCompositeFrame(ctx,w,h):null;
 ctx.save();
 try{
  if(requiresCompositeSource(e.presetId)){
   // Ignore a selected effect clip's local transform when replacing a full
   // frame. Restore the existing transform, alpha and blend mode afterwards.
   if(typeof ctx.setTransform==='function')ctx.setTransform(1,0,0,1,0,0);
   ctx.globalCompositeOperation='source-over';
   const opacity=clamp(ctx.globalAlpha,0,1,1);
   const amount=clamp(strength*opacity,0,1,1);
   if(source){
    ctx.globalAlpha=1;
    ctx.clearRect(0,0,w,h);
    ctx.globalAlpha=isPixelEffect(e.presetId)&&e.presetId!=='chromatic-quirk'?1:1-amount;
    ctx.drawImage(source,0,0,w,h);
    ctx.globalAlpha=amount;
   }
   if(e.presetId==='rhythmic-flicker'){
    renderRhythmicFlicker(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='light-sweep'){
    renderLightSweep(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='halo-blur'){
    renderHaloBlur(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='chromatic-quirk'){
    renderChromaticQuirk(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='edge-glow'){
    renderEdgeGlow(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='glow'){
    renderGlow(ctx,source,w,h,e,t,amount);
   }else if(isPixelEffect(e.presetId)){
    renderPixelEffect(ctx,source,w,h,e,t,amount);
   }else if(isGlitchEffect(e.presetId)){
    renderGlitchEffect(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='signal-interference'){
    renderSignalInterference(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='crt-scanlines'){
    renderCRTScanlines(ctx,source,w,h,e,t,amount);
    }else if(e.presetId==='data-burst'){
     renderDataBurst(ctx,source,w,h,e,t,amount);
    }else if(e.presetId==='signal-tear'){
     renderSignalTear(ctx,source,w,h,e,t,amount);
    }else if(e.presetId==='rgb-block-glitch'){
     renderRgbBlockGlitch(ctx,source,w,h,e,t,amount);
    }else if(e.presetId==='line-corruption'){
     renderLineCorruption(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='god-rays'){
    renderGodRays(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='pendulum-swing'){
    renderPendulumSwing(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='rebound-swing'){
    renderReboundSwing(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='vibration-flash'){
    renderVibrationFlash(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='fault-cassette'){
    renderFaultCassette(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='ripple-distortion'){
    renderRippleDistortion(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='electric-ripple'){
    renderElectricRipple(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='shockwave'){
    renderShockwave(ctx,source,w,h,e,t,amount);
   }
   return true;
  }
  
  if(e.presetId==='hazy-atmosphere'){
   renderHazyAtmosphere(ctx,w,h,e,t,strength);
  }else if(e.presetId==='mist-fog-bank'){
   renderMistFog(ctx,w,h,e,t,strength);
  }else if(e.presetId==='tv-static'){
   renderTVStatic(ctx,w,h,e,t,strength);
  }else if(e.presetId==='starburst'){
   renderStarburst(ctx,w,h,e,t,strength);
  }else if(e.presetId==='camera-frame'){
   renderCameraFrame(ctx,w,h,e,clamp(seconds,0,Math.max(0,Number(duration)||3),0),strength);
  }else if(e.presetId==='light-leaks'){
    renderLightLeaks(ctx,w,h,e,t,strength);
   }else if(e.presetId==='pixel-scan'){
   // Dynamic digital population: independent regeneration, not a translated still strip.
   renderPixelScan(ctx,w,h,e,t,strength);
  }else if(e.presetId==='sci-fi-scan'){
   renderSciFiScan(ctx,w,h,e,t,strength);
  }else if(e.presetId==='fire-flames'){
   renderFireFlames(ctx,w,h,e,t,strength);
  }else if(e.presetId==='fire-embers'){
   renderFlamingDust(ctx,w,h,e,t,strength);
  }else if(e.presetId==='fire-explosion'){
   renderFireExplosion(ctx,w,h,e,t,strength);
  }else if(e.presetId==='particle-dust'){
   renderFlamingDust(ctx,w,h,e,t,strength);
  }else if(e.presetId==='particle-sparks'){
   renderElectricSparks(ctx,w,h,e,t,strength);
  }else if(e.presetId==='particle-debris'){
   renderFlyingDebris(ctx,w,h,e,t,strength);
  }
 }finally{ctx.restore();}
 return true;
}
