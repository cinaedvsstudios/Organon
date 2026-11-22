/** MotoriClip #53 acceptance — actual source-aware analogue CRT/Retro Glitch. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRetroGlitchFrame,retroGlitchFrameState,renderRetroGlitch}
 from '../js/timeline-retro-glitch.mjs';
import {normaliseTimelineEffect,requiresCompositeSource,paintTimelineEffect}
 from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
const W=128,H=72;
const fx=delta=>normaliseTimelineEffect({presetId:'retro-glitch',intensity:94,
 speed:1.4,density:87,distortion:84,scale:110,direction:30,glow:75,
 originX:20,originY:12,color:'#adcde2',...delta});
const media=shift=>{
 const a=new Uint8ClampedArray(W*H*4);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*4;
  a[i]=((x+shift)%18)<9?226:35;
  a[i+1]=y%15<8?211:42;
  a[i+2]=x%21<11?194:27;
  a[i+3]=x<5?112:255;
 }
 return a;
};
const frame=(e,t,source=media(0))=>buildRetroGlitchFrame(source,W,H,e,t*e.speed);
const hash=a=>{let v=2166136261>>>0;for(const x of a)v=Math.imul(v^x,16777619)>>>0;return v;};
test('Retro Glitch is continuously refreshed source-based pixel snow with RGB misregistration',()=>{
 const e=fx({}),source=media(0);
 const a=frame(e,.14,source),b=frame(e,.37,source),c=frame(e,1.19,source);
 assert.deepEqual(a,frame(e,.14,source),'Backwards seeking must restore exact sample pixels');
 assert.equal(new Set([hash(a.data),hash(b.data),hash(c.data)]).size,3,
  'Independently evolving noise and interference must change every time interval');
 let differences=0,noiseByRow=new Set(),sourceDifferences=0,alphaMatch=0;
 for(let i=0;i<source.length;i+=4){
  if(a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1])differences++;
  if(i<W*4)noiseByRow.add(a.data[i]);
  if(a.data[i+3]===source[i+3])alphaMatch++;
 }
 assert.ok(differences>W*H*.6,'Per-pixel grain, scanline rolling and tear content really evolve');
 assert.ok(noiseByRow.size>30,'Pixel snow varies independently within a row, not a static graphic');
 assert.equal(alphaMatch,W*H,'Original source alpha survives CRT reconstruction');
 const other=frame(e,.14,media(7));
 for(let i=0;i<a.data.length;i+=4)if(a.data[i]!==other.data[i])sourceDifferences++;
 assert.ok(sourceDifferences>500,'CRT must actually reconstruct the current input image');
 assert.deepEqual(source,media(0),'No mutation of imported media');
});
test('At least seven separately regenerated rolling tears, noisy scanlines and independent RGB offsets',()=>{
 const e=fx({});
 const a=retroGlitchFrameState(320,180,e,.35),b=retroGlitchFrameState(320,180,e,1.21);
 assert.equal(a.bands.length,7);
 assert.ok(a.bands.filter(x=>x.active).length>=3);
 assert.ok(new Set(a.bands.map(x=>x.rate.toFixed(4))).size===7,
  'Tear bands must follow different vertical travel rates');
 assert.ok(new Set(a.bands.map(x=>x.y.toFixed(2))).size===7,
  'Multiple tear bands must occur at different heights');
 assert.ok(a.bands.some((x,i)=>Math.abs(x.y-b.bands[i].y)>20),
  'Tear bands must roll independently, not remain fixed');
 assert.notEqual(a.redOffset,a.blueOffset,'R/B channels need distinct displacements');
 assert.notEqual(a.redOffset,b.redOffset,'RGB misregistration must evolve in time');
 assert.notEqual(a.brightness,b.brightness,'Actual signal brightness fluctuates');
 assert.notEqual(a.frame,b.frame,'Granular CRT snow must have separate absolute-time seeds');
});
test('Every relevant Retro Glitch control changes source pixels and preserves saved settings/Undo',()=>{
 const e=fx({}),original=hash(frame(e,.72).data);
 for(const patch of [{speed:2.35},{density:18},{distortion:4},{scale:200},
  {direction:-115},{glow:0},{color:'#ee92cc'},{originX:72},
  {originY:78},{intensity:27}]){
  assert.notEqual(hash(frame(fx(patch),.72).data),original,
   'Native control must affect actual CRT RGB pixels: '+JSON.stringify(patch));
 }
 const saved=snapshotClip({id:'retro',type:'sticker',effectOverlay:e});
 const restored={id:'retro',type:'sticker'};
 applyClipData(restored,saved);
 assert.deepEqual(restored.effectOverlay,e);
 assert.deepEqual(frame(restored.effectOverlay,.83),frame(e,.83));
 applyClipData(restored,{...saved,effectOverlay:null});
 assert.equal(restored.effectOverlay,null);
 assert.equal(requiresCompositeSource('retro-glitch'),true);
 assert.equal(normaliseTimelineEffect({presetId:'retro-glitch'}).color,'#b8c5d0');
});
test('Existing effect ID paints deterministic, changing fallback without a source',()=>{
 const make=()=>{
  const calls=[];
  const ctx=new Proxy({},{
   get(target,k){if(Object.hasOwn(target,k))return target[k];if(k==='globalAlpha')return 1;
    if(k==='createLinearGradient')return ()=>({addColorStop(){}});
    return (...args)=>calls.push([k,...args]);
   },set(target,k,value){target[k]=value;calls.push(['set',String(k),value]);return true;}
  });
  return {ctx,calls};
 };
 const e=fx({}),a=make(),b=make(),c=make();
 assert.equal(renderRetroGlitch(a.ctx,null,320,180,e,.61,.9),true);
 renderRetroGlitch(b.ctx,null,320,180,e,.61,.9);
 renderRetroGlitch(c.ctx,null,320,180,e,1.1,.9);
 assert.equal(JSON.stringify(a.calls),JSON.stringify(b.calls));
 assert.notEqual(JSON.stringify(a.calls),JSON.stringify(c.calls));
 assert.ok(a.calls.filter(x=>x[0]==='fillRect').length>30,
  'No-source visual still contains independently evolving noise and moving bands');
 const parent=make();
 assert.equal(paintTimelineEffect(parent.ctx,320,180,e,.61/e.speed,3),true);
 assert.ok(parent.calls.some(x=>x[0]==='fillRect'),
  'Original timeline preset must route through active Retro Glitch renderer');
});
