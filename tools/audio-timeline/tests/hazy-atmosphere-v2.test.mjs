/** MotoriClip #49: physical noise-field, persistence and parameter QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHazyAtmosphereFrame,sampleHazyAtmosphereLayers,renderHazyAtmosphere}
 from '../js/timeline-hazy-atmosphere.mjs';
import {normaliseTimelineEffect,paintTimelineEffect} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';

const base={presetId:'hazy-atmosphere',intensity:92,speed:1.3,density:79,
 scale:112,direction:25,distortion:70,glow:60,blur:32,originX:44,originY:25,color:'#cde1f2'};
const settings=changes=>normaliseTimelineEffect({...base,...changes});
const frame=(e,t)=>buildHazyAtmosphereFrame(64,36,e,t*e.speed);
const signature=data=>{
 let hash=2166136261>>>0;
 for(const val of data)hash=Math.imul(hash^val,16777619)>>>0;
 return hash;
};

test('Hazy Atmosphere has three independent, genuinely cloudy evolving depth planes',()=>{
 const e=settings({}),at=(x,y,t)=>sampleHazyAtmosphereLayers(x,y,e,t);
 const planes=at(.4,.42,.7);
 assert.equal(planes.length,3);
 assert.ok(planes.every(p=>p.billow>=0&&p.billow<=1&&p.alpha>=0&&p.alpha<1));
 assert.equal(new Set(planes.map(p=>p.driftX)).size,3,'Depth fields must advect at separate rates');
 assert.equal(new Set(planes.map(p=>p.billow.toFixed(5))).size,3,'Depth fields must contain different noise');
 const positions=Array.from({length:30},(_,i)=>at((i%10+.5)/10,(Math.floor(i/10)+.5)/3,.71));
 const independent=positions.flatMap(l=>l.map(p=>p.billow.toFixed(3)));
 assert.ok(new Set(independent).size>50,'Fog is an irregular spatial field rather than seven circles');
 const alpha=positions.flatMap(l=>l.map(p=>p.alpha));
 assert.ok(new Set(alpha.map(x=>x.toFixed(3))).size>15,'Soft fog boundaries and density must vary locally');
 assert.notDeepEqual(at(.4,.42,.4),at(.4,.42,1.2),'Actual fog density and detail must evolve');
});

test('Hazy Atmosphere raster is partially transparent, spatially distributed, time-varying and reverse-seek exact',()=>{
 const e=settings({}),a=frame(e,.15),b=frame(e,.65),c=frame(e,1.4);
 assert.deepEqual(a,frame(e,.15),'Absolute time and stored seed reproduce frame exactly');
 assert.notEqual(signature(a.data),signature(b.data));
 assert.notEqual(signature(b.data),signature(c.data));
 assert.equal(a.data.length,64*36*4);
 const alphas=[];
 for(let i=3;i<a.data.length;i+=4)alphas.push(a.data[i]);
 assert.ok(alphas.some(x=>x===0||x<4),'Some atmosphere must be almost transparent');
 assert.ok(alphas.filter(x=>x>12).length>60,'Many pixels contain genuine visible fog');
 assert.ok(new Set(alphas).size>12,'Cloud alpha cannot be a flat translated rectangle');
 assert.ok(Math.max(...alphas)<240,'Fog must never conceal source video as an opaque card');
});

test('Haze inspector controls change actual cloud pixels and survive clip history',()=>{
 const e=settings({}),original=signature(frame(e,.82).data);
 for(const delta of [{speed:2.3},{density:15},{scale:180},{direction:-90},
  {distortion:6},{glow:0},{blur:0},{originX:5},{originY:85},
  {color:'#ffaabb'},{intensity:25}]){
  const changed=settings(delta);
  assert.notEqual(signature(frame(changed,.82).data),original,
   'Native haze parameter must change real RGBA pixels: '+JSON.stringify(delta));
 }
 const clip={id:'haze',type:'sticker',effectOverlay:e};
 const saved=snapshotClip(clip),restored={id:'haze',type:'sticker'};
 applyClipData(restored,saved);
 assert.deepEqual(restored.effectOverlay,e);
 assert.deepEqual(frame(restored.effectOverlay,.8),frame(e,.8));
 applyClipData(restored,{...saved,effectOverlay:null});
 assert.equal(restored.effectOverlay,null);
 assert.equal(normaliseTimelineEffect({presetId:'hazy-atmosphere'}).color,'#d6e0e9');
});

test('Hazy painter is connected to source compositor and preserves Canvas state',()=>{
 const calls=[];
 const gradient=()=>({addColorStop:(...args)=>calls.push(['stop',...args])});
 const ctx=new Proxy({},{
  get(target,key){
   if(Object.hasOwn(target,key))return target[key];
   if(key==='globalAlpha')return 1;
   if(key==='createLinearGradient')return (...args)=>{calls.push(['gradient',...args]);return gradient();};
   return (...args)=>calls.push([key,...args]);
  },
  set(target,key,v){target[key]=v;calls.push(['set',String(key),v]);return true;}
 });
 const e=settings({});
 assert.equal(renderHazyAtmosphere(ctx,320,180,e,.9,.85),true);
 assert.ok(calls.some(x=>x[0]==='save')&&calls.some(x=>x[0]==='restore'));
 assert.ok(calls.some(x=>x[0]==='lineTo'),'No-scratch fallback uses evolving irregular cloud outlines');
 const oldCount=calls.length;
 assert.equal(paintTimelineEffect(ctx,320,180,e,.8,3),true);
 assert.ok(calls.length>oldCount,'Shared engine compositor calls the new fog renderer');
});
