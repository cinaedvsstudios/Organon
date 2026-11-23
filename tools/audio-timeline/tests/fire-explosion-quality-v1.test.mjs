/** MotoriClip #66 quality-audit unit: rolling irregular Fire Explosion. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFireExplosionFrame,renderFireExplosion} from '../js/timeline-fire-explosion.mjs';
import {TIMELINE_EFFECTS,normaliseTimelineEffect} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';
const W=320,H=180;
const recipe=(other={})=>normaliseTimelineEffect({
 presetId:'fire-explosion',density:82,scale:142,distortion:88,direction:21,
 originX:52,originY:47,color:'#ffdb7a',glow:84,intensity:96,speed:1.17,
 explosionShock:93,explosionSmoke:77,explosionEjecta:91,explosionLife:3.2,
 explosionSeed:6868,...other
});
const frame=(other={},time=.72)=>{const fx=recipe(other);return buildFireExplosionFrame(W,H,fx,time*fx.speed);};
const signature=s=>JSON.stringify([s.generation,s.age,s.coreIntensity,s.radius,s.lobes,s.smoke,s.ejecta,s.shock,s.shockAlpha,s.params.hotColor,s.params.glow]);
test('same preset ID and independent bounded blast controls, without affecting Fire Flames/Embers',()=>{
 assert.equal(TIMELINE_EFFECTS.filter(e=>e.id==='fire-explosion').length,1);
 const d=normaliseTimelineEffect({presetId:'fire-explosion'});
 assert.deepEqual([d.density,d.distortion,d.glow,d.explosionShock,d.explosionSmoke,d.explosionEjecta,d.explosionLife,d.explosionSeed],
  [62,68,78,83,53,84,3.2,6868]);
 const over=recipe({explosionShock:800,explosionSmoke:-12,explosionEjecta:300,explosionLife:99,explosionSeed:999999});
 assert.deepEqual([over.explosionShock,over.explosionSmoke,over.explosionEjecta,over.explosionLife,over.explosionSeed],
  [100,0,100,6,99999]);
 for(const name of ['fire-flames','fire-embers','particle-debris'])
  assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:name}),'explosionShock'),false);
});
test('explosion consists of spatially varied rolling lobes, smoke, noncircular shock and ballistic ejecta',()=>{
 const s=frame({},1.1);
 assert.ok(s.lobes.length>=20&&s.smoke.length===s.lobes.length);
 assert.ok(s.lobes.some(x=>x.hot>.03),'Multiple incandescent lobes must be active');
 assert.ok(s.smoke.some(x=>x.alpha>.005),'Cooling smoke should begin after ignition');
 assert.ok(s.ejecta.length>15,'Visible individual projectiles must exist');
 assert.equal(s.shock.length,95);
 assert.ok(s.shock.some(x=>!x.visible)&&s.shock.some(x=>x.visible),'Shock ring must be fractured into unequal segments');
 const radii=s.shock.map(x=>Math.hypot(x.x-s.center.x,x.y-s.center.y));
 assert.ok(Math.max(...radii)-Math.min(...radii)>s.radius*.04,'Shock edge must be irregular, not a perfect circle');
 assert.ok(new Set(s.lobes.map(x=>x.r.toFixed(2))).size>12,'Lobe radii must differ');
 assert.ok(new Set(s.ejecta.map(x=>x.x.toFixed(1)+':'+x.y.toFixed(1))).size>15,'Particles spread with independent velocities');
});
test('absolute-time ignition, cooling and seeking are deterministic',()=>{
 const times=[.09,.35,.72,1.15,1.49,2.1];
 const states=times.map(t=>signature(frame({},t)));
 assert.equal(new Set(states).size,times.length,'Explosion develops through distinct physical phases');
 assert.equal(signature(frame({},.72)),states[2],'Backward seeking must reproduce all positions and opacity');
 const early=frame({},.20),late=frame({},1.55);
 assert.ok(late.radius>early.radius*2,'Blast front expands');
 assert.ok(early.coreIntensity>late.coreIntensity,'Core flash fades while the explosion cools');
 const restart=frame({},5.2);
 assert.ok(restart.generation>=1,'Blast cycles re-seed after a full lifetime');
});
test('meaningful physical parameters modify independently generated geometry',()=>{
 const s=frame({},1.15),baseline=signature(s);
 for(const change of [{density:10},{scale:22},{distortion:0},{direction:-90},
  {originX:4},{originY:89},{explosionShock:2},{explosionSmoke:0},
  {explosionEjecta:0},{explosionLife:5.7},{explosionSeed:808},{speed:2.8},
  {intensity:27},{color:'#65befe'},{glow:0}]){
  assert.notEqual(signature(frame(change,1.15)),baseline,'Unresponsive control: '+JSON.stringify(change));
 }
 assert.equal(frame({explosionEjecta:0},1.1).ejecta.length,0);
 assert.equal(frame({explosionSmoke:0},1.1).smoke.every(x=>x.alpha===0),true);
 assert.equal(frame({explosionShock:0},1.1).shockAlpha,0);
});
test('Canvas painter uses multiple gradients and irregular shock paths, no full-frame flat circle',()=>{
 const log=[],gradient={addColorStop(...args){log.push(['stop',...args]);}};
 const ctx=new Proxy({globalAlpha:1,globalCompositeOperation:'source-over'},{
  get(target,key){
   if(key in target)return target[key];
   if(key==='createRadialGradient')return (...args)=>{log.push(['radial',...args]);return gradient;};
   return (...args)=>log.push([String(key),...args]);
  },
  set(target,key,value){target[key]=value;log.push(['set',String(key),value]);return true;}
 });
 assert.equal(renderFireExplosion(ctx,W,H,recipe(),1.1,.96),true);
 assert.ok(log.filter(x=>x[0]==='radial').length>15,'Distinct rolling fire and cooling smoke forms');
 assert.ok(log.filter(x=>x[0]==='lineTo').length>50,'Fractured shock and differently aimed ejecta');
 assert.ok(log.some(x=>x[0]==='set'&&x[1]==='globalCompositeOperation'&&x[2]==='screen'),'Additive incandescent flame');
 assert.ok(log.some(x=>x[0]==='set'&&x[1]==='globalCompositeOperation'&&x[2]==='source-over'),'Cool smoke composites normally');
 assert.ok(log.some(x=>x[0]==='restore'),'Painter restores Canvas state');
 const count=log.length;assert.equal(renderFireExplosion(ctx,W,H,recipe(),.8,0),true);
 assert.equal(log.length,count,'No drawing at zero strength');
});
test('existing project history and portable Save/Open preserve the new native controls',()=>{
 const fx=recipe({explosionShock:48,explosionSmoke:91,explosionLife:4.1,explosionSeed:2015});
 const clip={id:'blast',type:'sticker',start:0,clipDuration:3,sourceFileId:'file-1',sourceName:'empty.png',effectOverlay:fx};
 const snap=snapshotClip(clip),restored={id:'blast',type:'sticker'};
 applyClipData(restored,snap);assert.deepEqual(restored.effectOverlay,fx);
 const record=createRecoveryRecord({files:[{id:'file-1',kind:'sticker',name:'empty.png',size:85}],
 tracks:[snap],selectedTrackId:'blast',selectedTrackIds:['blast'],history:{undo:[],redo:[]}});
 assert.deepEqual(parseRecoveryRecord(serializeRecoveryRecord(record)).tracks[0].effectOverlay,fx);
});
