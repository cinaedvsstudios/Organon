/** #51 Fire Flames: organic procedural fluid flame and saved project QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFireFlamesFrame,sampleFireFlame,renderFireFlames} from '../js/timeline-fire-flames.mjs';
import {normaliseTimelineEffect,paintTimelineEffect} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
const setting=delta=>normaliseTimelineEffect({presetId:'fire-flames',
 intensity:92,speed:1.4,density:80,scale:115,direction:26,
 distortion:73,glow:80,blur:32,originX:20,originY:12,color:'#ffdf7d',...delta});
const flame=(e,time)=>buildFireFlamesFrame(96,54,e,e.speed*time);
const fingerprint=data=>{let h=2166136261>>>0;for(const v of data)h=Math.imul(h^v,16777619)>>>0;return h;};
test('Fire flame bank contains irregular organic bright cores, darker boundaries and transparent air',()=>{
 const e=setting({}),a=flame(e,.65),alpha=[],warm=0;
 for(let i=0;i<a.data.length;i+=4){
  alpha.push(a.data[i+3]);
  if(a.data[i+3]>60&&a.data[i]>a.data[i+1]&&a.data[i+1]>a.data[i+2])warm++;
 }
 assert.ok(alpha.filter(v=>v===0).length>700,'Air above flames must remain transparent');
 assert.ok(alpha.filter(v=>v>100).length>400,'Continuous flame bank must occupy substantial area');
 assert.ok(new Set(alpha).size>50,'Soft irregular alpha, not opaque polygon triangles');
 assert.ok(warm>300,'Real hot fire RGB must be orange/yellow with warm outer edges');
 const bottom=sampleFireFlame(.52,.94,e,.65*e.speed);
 const top=sampleFireFlame(.52,.10,e,.65*e.speed);
 assert.ok(bottom.alpha>.4&&top.alpha<.01,'Fire ignites at the lower emitter, not the top');
 assert.ok(bottom.color[1]>top.color[1],'Hot lower core is yellow-orange while cool tips are red');
 assert.ok(bottom.light>top.light,'Fire is brighter near its hottest lower core');
 assert.ok(Math.max(...alpha)<255,'Fire retains transparency and never obscures all footage');
});

test('Each contour evolves in local time, nonrigid spatial folds and reversible seeded motion',()=>{
 const e=setting({}),a=flame(e,.18),b=flame(e,.64),c=flame(e,1.21);
 assert.deepEqual(a,flame(e,.18),'Reverse seeks reconstruct byte-exact RGBA frame');
 assert.notEqual(fingerprint(a.data),fingerprint(b.data));
 assert.notEqual(fingerprint(b.data),fingerprint(c.data));
 const ys=[.35,.48,.61,.75],xs=[.12,.27,.39,.5,.63,.78,.89];
 const before=ys.flatMap(y=>xs.map(x=>sampleFireFlame(x,y,e,.2*e.speed).front));
 const after=ys.flatMap(y=>xs.map(x=>sampleFireFlame(x,y,e,1.2*e.speed).front));
 assert.ok(new Set(before.map(v=>v.toFixed(3))).size>20,'Flame tops have varied heights across image');
 assert.ok(before.filter((v,i)=>Math.abs(v-after[i])>.025).length>12,
  'Different flames must lick and deform, not move as one still card');
});

test('All native fire parameters alter real pixel output and survive snapshots/Undo',()=>{
 const e=setting({}),orig=fingerprint(flame(e,.82).data);
 for(const delta of [{speed:2.4},{density:20},{scale:165},{direction:-98},
 {distortion:5},{glow:0},{blur:0},{originX:75},{originY:68},
 {intensity:24},{color:'#a4eeff'}]){
  const next=setting(delta);
  assert.notEqual(fingerprint(flame(next,.82).data),orig,
   'Fire native setting changes RGBA pixels: '+JSON.stringify(delta));
 }
 const original={id:'flames',type:'sticker',effectOverlay:e};
 const saved=snapshotClip(original),restored={id:'flames',type:'sticker'};
 applyClipData(restored,saved);
 assert.deepEqual(restored.effectOverlay,e);
 assert.deepEqual(flame(e,.53),flame(restored.effectOverlay,.53));
 applyClipData(restored,{...saved,effectOverlay:null});
 assert.equal(restored.effectOverlay,null);
});

test('Live compositor uses deterministic curved contours and preserves source Canvas state',()=>{
 const create=()=>{
  const calls=[],gradient=()=>({addColorStop:(...args)=>calls.push(['stop',...args])});
  const ctx=new Proxy({},{
   get(o,k){if(Object.hasOwn(o,k))return o[k];if(k==='globalAlpha')return 1;
    if(k==='createLinearGradient')return (...args)=>{calls.push(['gradient',...args]);return gradient();};
    return (...args)=>calls.push([k,...args]);
   },set(o,k,v){o[k]=v;calls.push(['set',String(k),v]);return true;}
  });
  return {ctx,calls};
 };
 const e=setting({}),a=create();
 assert.equal(renderFireFlames(a.ctx,320,180,e,1.1,.9),true);
 assert.ok(a.calls.some(x=>x[0]==='quadraticCurveTo'),
  'Organic lips/tongues must curl through real curves (not pointed triangles)');
 assert.ok(a.calls.some(x=>x[0]==='save')&&a.calls.some(x=>x[0]==='restore'));
 const b=create();renderFireFlames(b.ctx,320,180,e,1.1,.9);
 assert.equal(JSON.stringify(a.calls),JSON.stringify(b.calls));
 const c=create();renderFireFlames(c.ctx,320,180,e,1.9,.9);
 assert.notEqual(JSON.stringify(a.calls),JSON.stringify(c.calls));
 const engine=create();
 assert.equal(paintTimelineEffect(engine.ctx,320,180,e,.82,3),true);
 assert.ok(engine.calls.some(x=>x[0]==='quadraticCurveTo'),
  'Shared actual preview/export compositor invokes the new fire renderer');
});
