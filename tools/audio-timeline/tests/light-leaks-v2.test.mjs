/** #54 Organic photographic Light Leaks: alpha/cloud bloom/history acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLightLeaksFrame,sampleLightLeak,renderLightLeaks}
 from '../js/timeline-light-leaks.mjs';
import {normaliseTimelineEffect,paintTimelineEffect}
 from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
const fx=delta=>normaliseTimelineEffect({presetId:'light-leaks',
 intensity:94,speed:1.3,density:84,scale:115,direction:29,
 distortion:74,glow:87,blur:38,originX:20,originY:12,color:'#ec78cc',...delta});
const frame=(e,t)=>buildLightLeaksFrame(96,54,e,t*e.speed);
const hash=bytes=>{let h=2166136261>>>0;for(const byte of bytes)h=Math.imul(h^byte,16777619)>>>0;return h;};
test('Light leak creates broad soft pink/violet fog and locally overexposed pale film bloom',()=>{
 const e=fx({}),f=frame(e,.67),alpha=[],warm=0,violet=0,exposed=0;
 for(let i=0;i<f.data.length;i+=4){
  const r=f.data[i],g=f.data[i+1],b=f.data[i+2],a=f.data[i+3];
  alpha.push(a);
  if(r>g*1.2&&r>140)warm++;
  if(b>g*1.25&&b>145)violet++;
  if(a>200&&r>220&&g>175&&b>210)exposed++;
 }
 assert.ok(alpha.some(a=>a<18),'Some air must remain nearly transparent');
 assert.ok(alpha.filter(a=>a>45).length>1500,'Soft light covers a broad portion of image');
 assert.ok(alpha.filter(a=>a>170).length>250,'Locally overexposed edge blooms must exist');
 assert.ok(Math.max(...alpha)<255,'Light leaks remain translucent, not solid rectangles');
 assert.ok(new Set(alpha).size>110,'Irregularly graded organic borders, not a simple opaque card');
 assert.ok(warm>1500&&violet>1500,'Pink AND purple tones exist simultaneously');
 assert.ok(exposed>100,'A smaller pale pink-white hotspot accumulates within diffuse colour');
 const left=sampleLightLeak(.04,.45,e,.67*e.speed);
 const right=sampleLightLeak(.94,.55,e,.67*e.speed);
 assert.ok(left.magenta>right.magenta,'Left light is broad pink/magenta');
 assert.ok(right.violet>left.violet,'Opposite edge is violet');
});
test('Cloud boundaries, colour, diagonal bloom and internal noise evolve rather than a static translated card',()=>{
 const e=fx({}),times=[.13,.53,1.29,2.21],samples=times.map(t=>frame(e,t));
 assert.equal(new Set(samples.map(f=>hash(f.data))).size,4,'Every timeline time generates fresh diffusion');
 assert.deepEqual(samples[1],frame(e,times[1]),'Backwards seek returns byte-identical fields');
 const positions=Array.from({length:8},(_,i)=>[.07+i*.12,.13+(i%4)*.22]);
 const before=positions.map(([x,y])=>sampleLightLeak(x,y,e,.1).alpha);
 const later=positions.map(([x,y])=>sampleLightLeak(x,y,e,1.8).alpha);
 assert.ok(before.filter((v,i)=>Math.abs(v-later[i])>.012).length>=5,
  'Multiple regions of the cloud must deform independently in time');
 const a=sampleLightLeak(.41,.39,e,.4),b=sampleLightLeak(.41,.39,e,1.8);
 assert.ok(Math.abs(a.hotspot-b.hotspot)>.015||Math.abs(a.flicker-b.flicker)>.04,
  'Diagonal luminous core must breathe rather than translate one still sprite');
});
test('Actual rendered pixels respond to each Inspector parameter and retain Undo/portable state',()=>{
 const e=fx({}),baseline=hash(frame(e,.77).data);
 for(const delta of [{intensity:25},{speed:2.8},{density:12},{scale:190},
  {direction:-103},{distortion:2},{glow:0},{blur:0},{originX:75},
  {originY:80},{color:'#6ad5f5'}]){
  assert.notEqual(hash(frame(fx(delta),.77).data),baseline,
   'Native light setting changes actual RGBA: '+JSON.stringify(delta));
 }
 const saved=snapshotClip({id:'light',type:'sticker',effectOverlay:e});
 const target={id:'light',type:'sticker'};
 applyClipData(target,saved);
 assert.deepEqual(target.effectOverlay,e);
 assert.deepEqual(frame(target.effectOverlay,.76),frame(e,.76));
 applyClipData(target,{...saved,effectOverlay:null});
 assert.equal(target.effectOverlay,null);
 assert.equal(normaliseTimelineEffect({presetId:'light-leaks'}).color,'#ed75c8');
});
test('Existing light-leaks preset calls time-dependent transparent screen rendering',()=>{
 const make=()=>{
  const log=[];
  const ctx=new Proxy({},{
   get(obj,k){if(Object.hasOwn(obj,k))return obj[k];
    if(k==='globalAlpha')return 1;
    if(k==='createRadialGradient')return (...args)=>{
     log.push(['radial',...args]);return {addColorStop:(...v)=>log.push(['stop',...v])};
    };
    return (...args)=>log.push([k,...args]);
   },set(obj,k,v){obj[k]=v;log.push(['set',String(k),v]);return true;}
  });
  return {ctx,log};
 };
 const e=fx({}),a=make(),b=make(),c=make();
 assert.equal(renderLightLeaks(a.ctx,320,180,e,.61,.9),true);
 renderLightLeaks(b.ctx,320,180,e,.61,.9);
 renderLightLeaks(c.ctx,320,180,e,1.21,.9);
 assert.equal(JSON.stringify(a.log),JSON.stringify(b.log));
 assert.notEqual(JSON.stringify(a.log),JSON.stringify(c.log));
 assert.ok(a.log.filter(x=>x[0]==='radial').length>=3,'Fallback remains diffuse, not opaque');
 assert.ok(a.log.some(x=>x[0]==='set'&&x[1]==='globalCompositeOperation'&&x[2]==='screen'));
 assert.ok(a.log.some(x=>x[0]==='save')&&a.log.some(x=>x[0]==='restore'));
 const parent=make();
 assert.equal(paintTimelineEffect(parent.ctx,320,180,e,.61/e.speed,3),true);
 assert.ok(parent.log.some(x=>x[0]==='radial'),'Legacy timeline ID routed through new organic painter');
});
