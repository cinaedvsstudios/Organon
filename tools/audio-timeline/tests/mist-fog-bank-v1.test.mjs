/** MotoriClip #58 — independent low fog bank, native options and deterministic QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,paintTimelineEffect}
 from '../js/timeline-effects.mjs';
import {buildMistFogFrame,sampleMistFogLayers,renderMistFog}
 from '../js/timeline-mist-fog.mjs';
import {buildHazyAtmosphereFrame} from '../js/timeline-hazy-atmosphere.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';

const preset=changes=>normaliseTimelineEffect({presetId:'mist-fog-bank',
 intensity:90,speed:1.25,density:85,scale:110,direction:15,distortion:70,
 blur:38,color:'#dfebee',windSpeed:1.7,bankHeight:61,seed:902,...changes});
const frame=(e,t)=>buildMistFogFrame(72,40,e,t*e.speed);
function hash(data){
 let h=2166136261>>>0;
 for(const b of data)h=Math.imul(h^b,16777619)>>>0;
 return h;
}
test('Fog Bank is a distinct Atmospheric effect, with its own persisted fields',()=>{
 assert.equal(TIMELINE_EFFECTS.find(x=>x.id==='mist-fog-bank')?.label,'Mist / Fog Bank');
 const a=preset({}),historic=normaliseTimelineEffect({presetId:'hazy-atmosphere'});
 for(const key of ['windSpeed','bankHeight','seed']){
  assert.equal(Object.hasOwn(a,key),true);
  assert.equal(Object.hasOwn(historic,key),false,'Do not add fog options to legacy effects');
 }
 assert.equal(normaliseTimelineEffect({presetId:'mist-fog-bank'}).color,'#dce5ec');
 const clipped=preset({windSpeed:99,bankHeight:-30,seed:999999});
 assert.equal(clipped.windSpeed,4);assert.equal(clipped.bankHeight,15);
 assert.equal(clipped.seed,99999);
});
test('Three independent billowing low banks rise into wisps without a checkerboard',()=>{
 const e=preset({}),at=(x,y,t)=>sampleMistFogLayers(x,y,e,t*e.speed);
 const layers=at(.42,.89,.6);
 assert.equal(layers.length,3);
 assert.ok(layers.every(p=>p.alpha>=0&&p.alpha<=.46));
 assert.ok(new Set(layers.map(p=>p.body.toFixed(4))).size===3);
 assert.ok(new Set(layers.map(p=>p.wind)).size===3);
 const branches=Array.from({length:80},(_,i)=>at((i%20+.5)/20,(Math.floor(i/20)+.5)/4,.8));
 assert.ok(new Set(branches.flatMap(ps=>ps.map(p=>p.crest.toFixed(3)))).size>45);
 assert.ok(new Set(branches.flatMap(ps=>ps.map(p=>p.body.toFixed(3)))).size>60);
 assert.notDeepEqual(at(.48,.84,.4),at(.48,.84,1.1));
});
test('Fog is partially transparent, concentrated in a low bank, animated and rewind-exact',()=>{
 const e=preset({}),a=frame(e,.4),b=frame(e,.9),c=frame(e,1.6);
 assert.deepEqual(a,frame(e,.4),'Backwards seeking yields byte-identical fog pixels');
 assert.notEqual(hash(a.data),hash(b.data));
 assert.notEqual(hash(b.data),hash(c.data));
 const row=y=>Array.from({length:a.width},(_,x)=>a.data[(y*a.width+x)*4+3]);
 const top=row(0),low=row(a.height-8);
 assert.ok(top.filter(a=>a<6).length>a.width*.9,'Fog bank must have a transparent sky');
 assert.ok(low.filter(a=>a>20).length>a.width*.45,'Bank must have physically visible lower mist');
 assert.ok(new Set([...low,...row(24)]).size>20,'Fog silhouette cannot be a flat rectangle');
 assert.ok(low.every(a=>a<245),'Footage beneath the fog must remain visible');
 assert.notEqual(hash(a.data),hash(buildHazyAtmosphereFrame(72,40,e,.4).data),
  'Mist Bank must NOT reuse Hazy Atmosphere pixels');
});
test('Every native fog setting visibly changes RGBA and survives project snapshot',()=>{
 const e=preset({}),reference=hash(frame(e,.8).data);
 for(const delta of [{intensity:25},{speed:2.2},{density:18},{scale:180},
  {direction:-102},{distortion:5},{blur:0},{color:'#ffa0bb'},
  {windSpeed:.2},{bankHeight:37},{seed:13}]){
  assert.notEqual(hash(frame(preset(delta),.8).data),reference,
   'Option must alter fog pixels: '+JSON.stringify(delta));
 }
 const snap=snapshotClip({id:'fogbank',type:'sticker',effectOverlay:e});
 const track={id:'fogbank',type:'sticker'};applyClipData(track,snap);
 assert.deepEqual(track.effectOverlay,e);
 assert.deepEqual(frame(track.effectOverlay,.8),frame(e,.8));
});
test('Painter is reachable from shared timeline compositor; zero opacity is no-op',()=>{
 const calls=[],gradient=()=>({addColorStop:(...a)=>calls.push(['stop',...a])});
 const ctx=new Proxy({globalAlpha:1},{
  get(o,key){
   if(Object.hasOwn(o,key))return o[key];
   if(key==='createLinearGradient')return (...a)=>{calls.push(['gradient',...a]);return gradient();};
   return (...a)=>calls.push([String(key),...a]);
  },
  set(o,k,v){o[k]=v;calls.push(['set',String(k),v]);return true;}
 });
 const e=preset({});
 renderMistFog(ctx,320,180,e,.8,0);assert.equal(calls.length,0);
 assert.equal(paintTimelineEffect(ctx,320,180,e,.8,3),true);
 assert.ok(calls.some(c=>c[0]==='lineTo'),'No-scratch bank fallback has an irregular crest');
 assert.ok(!calls.some(c=>c[0]==='clearRect'),'Fog cannot clear its source video');
});
