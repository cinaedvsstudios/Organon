/** MotoriClip #59 — true fresh per-pixel TV static, not Retro Glitch. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTVStaticFrame,tvStaticFrameIndex,renderTVStatic} from '../js/timeline-tv-static.mjs';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,paintTimelineEffect} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';

const e=(overrides={})=>normaliseTimelineEffect({
 presetId:'tv-static',intensity:84,speed:1,density:87,
 staticBrightness:52,staticVariance:96,staticMode:'mono',staticSeed:5926,...overrides
});
const sample=(effect,t)=>buildTVStaticFrame(128,72,e(effect),t);
const pixels=f=>f.data;
const hash=arr=>{let n=2166136261>>>0;for(const b of arr)n=Math.imul(n^b,16777619)>>>0;return n;};
const count=f=>Array.from({length:f.width*f.height},(_,i)=>f.data[i*4+3]).filter(x=>x>0).length;

test('TV Static is its own procedural Glitch overlay with portable controls',()=>{
 assert.equal(TIMELINE_EFFECTS.find(x=>x.id==='tv-static')?.label,'TV Static / Snow');
 const defaults=normaliseTimelineEffect({presetId:'tv-static'});
 assert.deepEqual([defaults.staticMode,defaults.staticBrightness,defaults.staticVariance,defaults.staticSeed],
  ['mono',52,88,59]);
 assert.equal(normaliseTimelineEffect({presetId:'tv-static',staticMode:'rainbow'}).staticMode,'mono');
 const bounded=normaliseTimelineEffect({presetId:'tv-static',density:999,staticBrightness:-4,staticVariance:300,staticSeed:200000});
 assert.deepEqual([bounded.density,bounded.staticBrightness,bounded.staticVariance,bounded.staticSeed],[120,0,100,99999]);
 const legacy=normaliseTimelineEffect({presetId:'retro-glitch'});
 assert.equal(Object.hasOwn(legacy,'staticMode'),false,'Retro Glitch settings remain independent');
});
test('True 60Hz fresh noise uses absolute time with exact reversible pixel results',()=>{
 const a=sample({},.20),b=sample({},.22),c=sample({},.28);
 assert.equal(tvStaticFrameIndex(.20),12);
 assert.notEqual(hash(pixels(a)),hash(pixels(b)));
 assert.notEqual(hash(pixels(b)),hash(pixels(c)));
 assert.deepEqual(sample({},.20),a,'Rewinding must regenerate exact same TV snow');
 const aMonos=Array.from({length:100},(_,i)=>{
  const p=(i*4)%a.data.length;return a.data[p]===a.data[p+1]&&a.data[p+1]===a.data[p+2];
 });
 assert.ok(aMonos.every(Boolean),'Black & white mode must be strictly grayscale');
 assert.ok(new Set(Array.from({length:a.width*a.height},(_,i)=>a.data[i*4])).size>90,
  'Individual pixels must contain varied brightness, not translated rectangles');
});
test('Colour snow uses independent RGB channels, without changing a stored GIF or shader',()=>{
 const mono=sample({},.35),color=sample({staticMode:'color'},.35);
 const visible=Array.from({length:color.width*color.height},(_,i)=>i*4)
  .filter(i=>color.data[i+3]>0);
 assert.ok(visible.length>4000);
 assert.ok(visible.filter(i=>color.data[i]!==color.data[i+1]||
  color.data[i+1]!==color.data[i+2]).length>visible.length*.8);
 assert.notEqual(hash(mono.data),hash(color.data));
 assert.deepEqual(color,sample({staticMode:'color'},.35));
});
test('Coverage, brightness, variance, seed and strength control actual RGBA pixels',()=>{
 const original=sample({},.63),reference=hash(original.data);
 assert.ok(count(sample({density:12},.63))<count(original)*.35);
 assert.ok(count(sample({density:120},.63))>count(original));
 for(const override of [
  {density:12},{staticBrightness:8},{staticVariance:12},{staticSeed:7},
  {intensity:20},{speed:3},{staticMode:'color'}
 ]){
  const changed=sample(override,.63);
  if(override.speed!==undefined){
   const withSpeed=buildTVStaticFrame(128,72,e(override),.63*e(override).speed);
   assert.notEqual(hash(withSpeed.data),reference);
  }else assert.notEqual(hash(changed.data),reference,JSON.stringify(override));
 }
 const alphas=Array.from({length:original.width*original.height},(_,i)=>original.data[i*4+3]);
 assert.ok(alphas.some(x=>x===0)&&alphas.some(x=>x>50));
 assert.ok(alphas.every(x=>x<255),'Snow overlay must not replace the source with a fully opaque rectangle');
});
test('Static settings survive Undo/Redo/project snapshot and never mutate Retro Glitch',()=>{
 const effect=e({staticMode:'color',staticSeed:321,density:114});
 const s=snapshotClip({id:'tv',type:'sticker',effectOverlay:effect});
 const restored={id:'tv',type:'sticker'};applyClipData(restored,s);
 assert.deepEqual(restored.effectOverlay,effect);
 assert.deepEqual(sample(restored.effectOverlay,.8),sample(effect,.8));
 const unchanged=normaliseTimelineEffect({presetId:'retro-glitch'});
 assert.equal(Object.hasOwn(unchanged,'staticSeed'),false);
});
test('TV Static painter uses source-safe transparent drawing and zero-opacity no-op',()=>{
 const log=[],ctx=new Proxy({globalAlpha:1},{get(o,k){
  if(k in o)return o[k];return (...args)=>log.push([k,...args]);
 },set(o,k,v){o[k]=v;log.push([k,v]);return true;}});
 renderTVStatic(ctx,160,90,e(),.4,0);
 assert.equal(log.length,0);
 assert.equal(paintTimelineEffect(ctx,160,90,e(),.4,3),true);
 assert.ok(log.some(entry=>entry[0]==='fillRect'),'No-canvas fallback still draws changing snow');
 assert.ok(!log.some(entry=>entry[0]==='clearRect'),'Snow overlay must never erase video');
});
