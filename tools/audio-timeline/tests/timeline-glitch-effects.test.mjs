import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGlitchStormFrame,stormPackets} from '../js/timeline-glitch-storm.mjs';
import {buildGlassGlitchFrame,glassFractureSites} from '../js/timeline-glass-glitch.mjs';
import {GLITCH_PRESETS,isGlitchEffect,renderGlitchEffect} from '../js/timeline-glitch-effects.mjs';
import {TIMELINE_EFFECTS,paintTimelineEffect,normaliseTimelineEffect,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';

const ctxRecorder=()=>{
 const calls=[];
 const ctx=new Proxy({canvas:null},{
  get(target,key){
   if(key==='calls')return calls;
   if(key in target)return target[key];
   if(key==='globalAlpha')return 1;
   if(key==='createLinearGradient'||key==='createRadialGradient')
    return (...args)=>{calls.push([key,...args]);return {addColorStop:(...params)=>calls.push(['stop',...params])};};
   return (...args)=>calls.push([key,...args]);
  },
  set(target,key,value){target[key]=value;calls.push(['set',key,String(value)]);return true;}
 });
 return ctx;
};
const paint=(id,time,parameters={})=>{
 const ctx=ctxRecorder();
 assert.equal(paintTimelineEffect(ctx,640,360,{presetId:id,...parameters},time,3),true);
 return JSON.stringify(ctx.calls);
};

test('nine genuinely different source-aware glitch IDs populate the existing Glitch category',()=>{
 assert.equal(GLITCH_PRESETS.length,9);
 assert.equal(new Set(GLITCH_PRESETS.map(x=>x.id)).size,9);
 const full=new Set(TIMELINE_EFFECTS.map(x=>x.id));
 assert.equal(TIMELINE_EFFECTS.length,43);
 for(const entry of GLITCH_PRESETS){
  assert.equal(entry.category,'Glitch');
  assert.equal(entry.group,'effect');
  assert.equal(entry.animated,true);
  assert.ok(full.has(entry.id));
  assert.equal(isGlitchEffect(entry.id),true);
  assert.equal(requiresCompositeSource(entry.id),true);
 }
 assert.equal(TIMELINE_EFFECTS.filter(x=>x.category==='Glitch').length,17);
 assert.equal(isGlitchEffect('fault-cassette'),false);
});

test('nine glitches render distinct structures and reproducible frames under backwards seeking',()=>{
 const signatures=new Set();
 for(const {id} of GLITCH_PRESETS){
  if(id==='glitch-storm'){const a=stormFrame(.24),b=stormFrame(1.34);assert.notDeepEqual(a.data,b.data);assert.deepEqual(a.data,stormFrame(.24).data);signatures.add('source-pixel signal storm');continue;}
  if(id==='glass-glitch'){const a=glassFrame(.24),b=glassFrame(1.34);assert.notDeepEqual(a.data,b.data);assert.deepEqual(a.data,glassFrame(.24).data);signatures.add('source-pixel glass fracture');continue;}
  const start=paint(id,.24);
  const later=paint(id,1.34);
  assert.notEqual(start,later,id+' needs actual time-based animation');
  assert.equal(start,paint(id,.24),id+' must exactly reproduce same frame after backwards seek');
  assert.ok(start.includes('"save"')&&start.includes('"restore"'),id+' must preserve Canvas state');
  signatures.add(start);
 }
 assert.equal(signatures.size,9,'nine effects must not share the same drawing instructions');
});

test('effect algorithms use different geometry, filters and colour operations',()=>{
 const sample=Object.fromEntries(GLITCH_PRESETS.map(x=>[x.id,paint(x.id,.43)]));
 assert.ok(new Set(glassFrame(.43).ids).size>8,'Glass Glitch creates irregular contiguous source-sampling facets');
 assert.ok(new Set(stormFrame(.43).packets.map(p=>p.kind)).size>=3,'storm combines distinct packet failures');
 assert.ok(sample['negative-chaos'].includes('invert(1)'),'Negative Chaos inverts pixel regions');
 assert.ok(sample['warning-glitch'].includes('"strokeRect"'),'Warning Glitch draws visual hazard frame');
 assert.ok(sample.misalignment.includes('hue-rotate'),'Misalignment separates tinted ghost images');
 assert.ok(sample['noir-glitch'].includes('grayscale'),'Noir Glitch uses monochrome contrast');
 assert.ok(sample['glitch-flux'].includes('"drawImage"')||sample['glitch-flux'].includes('"fillRect"'));
 assert.ok(sample['engine-heat'].includes('"fillRect"')&&!sample['engine-heat'].includes('"bezierCurveTo"'),
  'Engine Heat should not draw fake vertical heat tendrils');
 assert.ok(sample['retro-glitch'].includes('"fillRect"'),'Retro Glitch has actual CRT scan lines');
});

test('source-aware effects reproject underlying frame pixels, not a static preset PNG',()=>{
 const frame={width:640,height:360};
 for(const {id} of GLITCH_PRESETS){
  if(id==='glitch-storm'){assert.notDeepEqual(stormFrame(.55).data,glassSource());continue;}
  if(id==='glass-glitch'){assert.notDeepEqual(glassFrame(.55).data,glassSource());continue;}
  const ctx=ctxRecorder();
  assert.equal(renderGlitchEffect(ctx,frame,640,360,normaliseTimelineEffect({presetId:id}),.55,.8),true);
  const operations=ctx.calls.filter(c=>c[0]==='drawImage');
  if(id!=='retro-glitch')assert.ok(operations.some(c=>c[1]===frame),id+' must read source pixels');
  assert.ok(ctx.calls.some(c=>c[0]==='save'),id+' uses isolated canvas state');
  assert.ok(ctx.calls.some(c=>c[0]==='restore'),id+' restores prior canvas state');
 }
});

test('strength, direction, speed, and density influence the intended glitches',()=>{
 assert.notDeepEqual(stormFrame(.42,{density:10}).data,stormFrame(.42,{density:50}).data);
 assert.notDeepEqual(glassFrame(.42,{distortion:15}).data,glassFrame(.42,{distortion:85}).data);
 assert.notEqual(paint('engine-heat',.42,{speed:.5}),paint('engine-heat',.42,{speed:3}));
 assert.notEqual(paint('misalignment',.42,{direction:-90}),paint('misalignment',.42,{direction:90}));
 const overlay=normaliseTimelineEffect({presetId:'negative-chaos',distortion:76,color:'#c0fefe',density:66});
 const saved=snapshotClip({id:'clip',type:'sticker',effectOverlay:overlay});
 const target={id:'clip',type:'sticker'};
 applyClipData(target,saved);
 assert.deepEqual(target.effectOverlay,overlay,'portable project and Undo must retain glitch settings');
});

test('Retro Glitch reuses a resolution-bounded, low-resolution CRT sample canvas',()=>{
 const previous=globalThis.document;
 let created=0;
 const samples=[];
 globalThis.document={createElement(name){
  assert.equal(name,'canvas');created++;
  const canvas={width:0,height:0,getContext(){return ctxRecorder();}};
  samples.push(canvas);
  return canvas;
 }};
 try{
  const ctx=ctxRecorder();
  const frame={width:3840,height:2160};
  const settings=normaliseTimelineEffect({presetId:'retro-glitch',scale:200});
  assert.ok(renderGlitchEffect(ctx,frame,3840,2160,settings,.28,.8));
  assert.ok(renderGlitchEffect(ctx,frame,3840,2160,settings,.8,.8));
  assert.equal(created,1,'CRT scratch buffer should be reused');
  assert.ok(Math.max(samples[0].width,samples[0].height)<=640,'CRT sampling must remain bounded at 4K');
  assert.ok(ctx.calls.some(c=>c[0]==='drawImage'&&c[1]===samples[0]));
 }finally{
  if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
 }
});

const GW=160,GH=90;
function glassSource(){
 const p=new Uint8ClampedArray(GW*GH*4);
 for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){const i=(y*GW+x)*4,v=(Math.floor(x/8)+Math.floor(y/8))%2?230:20;p.set([v,v,v,x<4?0:x<8?128:255],i);}
 return p;
}
function glassFrame(t,opts={},src=glassSource(),workspace={}){
 const e=normaliseTimelineEffect({presetId:'glass-glitch',intensity:95,distortion:85,density:48,glassMotion:70,glassPrism:65,glassSeams:70,...opts});
 return buildGlassGlitchFrame(src,GW,GH,e,t,undefined,1,workspace);
}
test('Glass Glitch has seeded irregular facets, real refraction and stable source alpha',()=>{
 const src=glassSource(),workspace={},a=glassFrame(.24,{},src,workspace),b=glassFrame(1.1,{},src,workspace);
 assert.deepEqual(glassFrame(.24,{distortion:0}).data,src);
 assert.notDeepEqual(a.data,src);assert.notDeepEqual(a.data,b.data);
 assert.deepEqual(a.data,glassFrame(.24,{},src,workspace).data);
 assert.equal(a.ids,b.ids,'static fracture geometry is reused over time');
 assert.ok(new Set(a.ids).size>8);
 assert.ok(a.edges.some(d=>d<.5)&&a.edges.some(d=>d>4));
 let coloured=0;for(let i=0;i<src.length;i+=4){assert.equal(a.data[i+3],src[i+3]);if(src[i+3]&&Math.abs(a.data[i]-a.data[i+2])>12)coloured++;}
 assert.ok(coloured>100,'prismatic fringes and seam reflections derive from actual facets');
 for(const [k,v] of Object.entries({glassMotion:0,glassPrism:0,glassSeams:0,glassSeed:42,density:12,scale:180,direction:90,distortion:20,color:'#3366ff'}))assert.notDeepEqual(a.data,glassFrame(.24,{[k]:v}).data,k);
 const e=normaliseTimelineEffect({presetId:'glass-glitch',glassSeed:42,glassMotion:13,glassPrism:90,glassSeams:12});
 assert.deepEqual(snapshotClip({id:'glass',type:'sticker',effectOverlay:e}).effectOverlay,e);
 const contaminated=src.slice();for(let i=0;i<src.length;i+=4)if(!src[i+3])contaminated.set([255,0,255,0],i);
 const clean=glassFrame(.24,{},contaminated).data;
 for(let i=0;i<src.length;i+=4)if(src[i+3])assert.deepEqual(a.data.slice(i,i+4),clean.slice(i,i+4));
});

function stormFrame(t,opts={},src=glassSource()){
 const e=normaliseTimelineEffect({presetId:'glitch-storm',intensity:95,distortion:90,density:100,stormRate:12,stormLife:.4,stormCluster:30,stormChroma:85,stormNoise:80,...opts});
 return buildGlitchStormFrame(src,GW,GH,e,t);
}
test('Glitch Storm combines independent source failures and preserves alpha',()=>{
 const src=glassSource(),a=stormFrame(.24),b=stormFrame(1.34);
 assert.deepEqual(stormFrame(.24,{distortion:0}).data,src);
 assert.notDeepEqual(a.data,src);assert.notDeepEqual(a.data,b.data);assert.deepEqual(a.data,stormFrame(.24).data);
 assert.ok(new Set(a.packets.map(p=>p.kind)).size>=3);
 assert.ok(new Set(a.packets.map(p=>p.age)).size>3,'packets have independent clocks');
 assert.ok(new Set(a.packets.map(p=>p.bw)).size>3,'packets have varied footprints');
 for(let i=3;i<src.length;i+=4)assert.equal(a.data[i],src[i]);
 for(const [k,v] of Object.entries({stormRate:3,stormLife:.06,stormCluster:100,stormChroma:0,stormNoise:0,stormSeed:42,density:12,scale:180,direction:90,distortion:20,color:'#3366ff'}))
 assert.notDeepEqual(a.data,stormFrame(.24,{[k]:v}).data,k);
 const e=normaliseTimelineEffect({presetId:'glitch-storm',stormSeed:42,stormLife:.33,stormNoise:12});
 assert.deepEqual(snapshotClip({id:'storm',type:'sticker',effectOverlay:e}).effectOverlay,e);
 const contaminated=src.slice();for(let i=0;i<src.length;i+=4)if(!src[i+3])contaminated.set([255,0,255,0],i);
 const clean=stormFrame(.24,{},contaminated).data;
 for(let i=0;i<src.length;i+=4)if(src[i+3])assert.deepEqual(a.data.slice(i,i+4),clean.slice(i,i+4));
});
