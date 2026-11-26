import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNoirGlitchFrame} from '../js/timeline-noir-glitch.mjs';
import {buildMisalignmentFrame} from '../js/timeline-misalignment.mjs';
import {buildWarningGlitchFrame} from '../js/timeline-warning-glitch.mjs';
import {buildNegativeChaosFrame} from '../js/timeline-negative-chaos.mjs';
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
  if(id==='noir-glitch'){const a=noirFrame(.24),b=noirFrame(1.34);assert.notDeepEqual(a.data,b.data);assert.deepEqual(a.data,noirFrame(.24).data);signatures.add('source-pixel noir film');continue;}
  if(id==='misalignment'){const a=misalignFrame(.24),b=misalignFrame(1.34);assert.notDeepEqual(a.data,b.data);assert.deepEqual(a.data,misalignFrame(.24).data);signatures.add('source-pixel registration ghosts');continue;}
  if(id==='warning-glitch'){const a=warningFrame(.24),b=warningFrame(1.34);assert.notDeepEqual(a.data,b.data);assert.deepEqual(a.data,warningFrame(.24).data);signatures.add('source-pixel warning telemetry');continue;}
  if(id==='negative-chaos'){const a=negativeFrame(.24),b=negativeFrame(1.34);assert.notDeepEqual(a.data,b.data);assert.deepEqual(a.data,negativeFrame(.24).data);signatures.add('source-pixel negative regions');continue;}
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
 assert.ok(new Set(negativeFrame(.43).regions.map(r=>r.shape)).size>=2,'Negative Chaos uses independent irregular inversion regions');
 assert.ok(warningFrame(.43).state.rail>0&&warningFrame(.43).state.bands.length>2,'Warning Glitch combines hazard rails and source dropouts');
 assert.equal(misalignFrame(.43).state.ghosts.length,2,'Misalignment creates two independently registered images');
 assert.ok(noirFrame(.43).state.bands.length===3&&noirFrame(.43).state.scratches.length>2,'Noir Glitch combines shutter faults and scratches');
 assert.ok(sample['glitch-flux'].includes('"drawImage"')||sample['glitch-flux'].includes('"fillRect"'));
 assert.ok(sample['engine-heat'].includes('"fillRect"')&&!sample['engine-heat'].includes('"bezierCurveTo"'),
  'Engine Heat should not draw fake vertical heat tendrils');
 assert.ok(sample['retro-glitch'].includes('"fillRect"'),'Retro Glitch has actual CRT scan lines');
});

test('source-aware effects reproject underlying frame pixels, not a static preset PNG',()=>{
 const frame={width:640,height:360};
 for(const {id} of GLITCH_PRESETS){
  if(id==='noir-glitch'){assert.notDeepEqual(noirFrame(.55).data,negativeSource());continue;}
  if(id==='misalignment'){assert.notDeepEqual(misalignFrame(.55).data,glassSource());continue;}
  if(id==='warning-glitch'){assert.notDeepEqual(warningFrame(.55,{warningOpacity:0}).data,glassSource());continue;}
  if(id==='negative-chaos'){assert.notDeepEqual(negativeFrame(.55).data,negativeSource());continue;}
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
 assert.notDeepEqual(misalignFrame(.42,{direction:0}).data,misalignFrame(.42,{direction:90}).data);
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

function negativeSource(){
 const p=glassSource();for(let i=0;i<p.length;i+=4){p[i+1]=Math.round(p[i]*.65);p[i+2]=Math.round(p[i]*.35);}
 return p;
}
function negativeFrame(t,opts={},src=negativeSource(),workspace={}){
 const e=normaliseTimelineEffect({presetId:'negative-chaos',intensity:95,distortion:95,density:85,negativeRate:5,negativeLife:.75,negativeFeather:20,negativeChroma:85,negativeContrast:35,...opts});
 return buildNegativeChaosFrame(src,GW,GH,e,t,undefined,1,workspace);
}
test('Negative Chaos independently inverts real image regions with exact alpha and deterministic timing',()=>{
 const src=negativeSource(),a=negativeFrame(.24),b=negativeFrame(1.34);
 assert.deepEqual(negativeFrame(.24,{distortion:0}).data,src);
 assert.notDeepEqual(a.data,src);assert.notDeepEqual(a.data,b.data);assert.deepEqual(a.data,negativeFrame(.24).data);
 assert.ok(new Set(a.regions.map(r=>r.age)).size>3);
 let inverted=0,unchanged=0;
 for(let i=0;i<src.length;i+=4){assert.equal(a.data[i+3],src[i+3]);if(!src[i+3])continue;
 if(Math.abs(a.data[i]-src[i])>80)inverted++;
 if(a.data[i]===src[i]&&a.data[i+1]===src[i+1]&&a.data[i+2]===src[i+2])unchanged++;}
 assert.ok(inverted>100);assert.ok(unchanged>100);
 for(const [k,v] of Object.entries({negativeRate:1,negativeLife:.15,negativeFeather:90,negativeChroma:0,negativeContrast:0,negativeSeed:42,density:12,scale:180,direction:90,distortion:20}))
 assert.notDeepEqual(a.data,negativeFrame(.24,{[k]:v}).data,k);
 const e=normaliseTimelineEffect({presetId:'negative-chaos',negativeSeed:42,negativeLife:.33,negativeChroma:12});
 assert.deepEqual(snapshotClip({id:'negative',type:'sticker',effectOverlay:e}).effectOverlay,e);
});

function warningFrame(t,opts={},src=glassSource(),amount=1){
 const e=normaliseTimelineEffect({presetId:'warning-glitch',intensity:95,distortion:95,density:85,warningRail:7,warningOpacity:85,warningTravel:60,warningPulse:75,...opts});
 return buildWarningGlitchFrame(src,GW,GH,e,t,undefined,amount);
}
test('Warning Glitch separates moving warning telemetry from genuine source displacement',()=>{
 const src=glassSource(),a=warningFrame(.24),b=warningFrame(1.34);
 assert.deepEqual(warningFrame(.24,{distortion:0,warningOpacity:0}).data,src);
 assert.deepEqual(warningFrame(.24,{},src,0).data,src);
 assert.notDeepEqual(a.data,src);assert.notDeepEqual(a.data,b.data);assert.deepEqual(a.data,warningFrame(.24).data);
 assert.notDeepEqual(warningFrame(.24,{warningOpacity:0}).data,src);
 assert.notDeepEqual(warningFrame(.24,{distortion:0}).data,src);
 for(let i=3;i<src.length;i+=4)assert.equal(a.data[i],src[i]);
 for(const [k,v] of Object.entries({warningRail:2,warningOpacity:15,warningTravel:0,warningPulse:0,warningSeed:42,density:12,scale:180,direction:90,distortion:20,color:'#3366ff'}))
 assert.notDeepEqual(a.data,warningFrame(.24,{[k]:v}).data,k);
 const e=normaliseTimelineEffect({presetId:'warning-glitch',warningSeed:42,warningRail:3,warningTravel:12});
 assert.deepEqual(snapshotClip({id:'warning',type:'sticker',effectOverlay:e}).effectOverlay,e);
 const contaminated=src.slice();for(let i=0;i<src.length;i+=4)if(!src[i+3])contaminated.set([255,0,255,0],i);
 const clean=warningFrame(.24,{},contaminated).data;
 for(let i=0;i<src.length;i+=4)if(src[i+3])assert.deepEqual(a.data.slice(i,i+4),clean.slice(i,i+4));
});

function misalignFrame(t,opts={},src=glassSource(),amount=1){
 const e=normaliseTimelineEffect({presetId:'misalignment',intensity:95,distortion:95,scale:120,direction:25,misalignDrift:85,misalignRotation:65,misalignSkew:55,misalignOpacity:85,misalignTint:60,...opts});
 return buildMisalignmentFrame(src,GW,GH,e,t,undefined,amount);
}
test('Misalignment independently registers two complete source-image ghosts',()=>{
 const src=glassSource(),a=misalignFrame(.24),b=misalignFrame(1.34);
 assert.deepEqual(misalignFrame(.24,{distortion:0}).data,src);
 assert.deepEqual(misalignFrame(.24,{misalignOpacity:0}).data,src);
 assert.deepEqual(misalignFrame(.24,{},src,0).data,src);
 assert.notDeepEqual(a.data,src);assert.notDeepEqual(a.data,b.data);assert.deepEqual(a.data,misalignFrame(.24).data);
 assert.notEqual(a.state.ghosts[0].dx,a.state.ghosts[1].dx);
 const neutral=misalignFrame(.24,{misalignTint:0}).data;
 let changed=0;
 for(let i=0;i<src.length;i+=4){assert.equal(a.data[i+3],src[i+3]);assert.equal(neutral[i],neutral[i+1]);assert.equal(neutral[i],neutral[i+2]);if(neutral[i]!==src[i])changed++;}
 assert.ok(changed>100,'untinted ghosts still displace full source detail without splitting channels');
 for(const [k,v] of Object.entries({misalignDrift:0,misalignRotation:0,misalignSkew:0,misalignOpacity:15,misalignTint:0,misalignBalance:80,scale:180,direction:100,distortion:20,color:'#3388ff'}))
 assert.notDeepEqual(a.data,misalignFrame(.24,{[k]:v}).data,k);
 const e=normaliseTimelineEffect({presetId:'misalignment',misalignBalance:-42,misalignRotation:80,misalignTint:12});
 assert.deepEqual(snapshotClip({id:'misalign',type:'sticker',effectOverlay:e}).effectOverlay,e);
 const contaminated=src.slice();for(let i=0;i<src.length;i+=4)if(!src[i+3])contaminated.set([255,0,255,0],i);
 const clean=misalignFrame(.24,{},contaminated).data;
 for(let i=0;i<src.length;i+=4)if(src[i+3])assert.deepEqual(a.data.slice(i,i+4),clean.slice(i,i+4));
});

function noirFrame(t,opts={},src=negativeSource(),amount=1){
 const e=normaliseTimelineEffect({presetId:'noir-glitch',distortion:90,density:85,scale:100,direction:25,noirContrast:65,noirGrain:65,noirWeave:90,noirShutter:80,noirScratches:75,noirVignette:60,noirSeed:1946,...opts});
 return buildNoirGlitchFrame(src,GW,GH,e,t,undefined,amount);
}
test('Noir Glitch renders monochrome film response and independent deterministic interference',()=>{
 const src=negativeSource(),a=noirFrame(.24),b=noirFrame(1.34);
 assert.deepEqual(noirFrame(.24,{},src,0).data,src);
 assert.notDeepEqual(a.data,src);assert.notDeepEqual(a.data,b.data);assert.deepEqual(a.data,noirFrame(.24).data);
 let changed=0;for(let i=0;i<src.length;i+=4){assert.equal(a.data[i+3],src[i+3]);if(src[i+3]){assert.equal(a.data[i],a.data[i+1]);assert.equal(a.data[i],a.data[i+2]);if(a.data[i]!==src[i])changed++;}}
 assert.ok(changed>100);
 for(const [k,v] of Object.entries({noirContrast:0,noirGrain:0,noirWeave:0,noirShutter:0,noirScratches:0,noirVignette:0,noirSeed:42,density:12,scale:180,direction:100,distortion:20}))
 assert.notDeepEqual(a.data,noirFrame(.24,{[k]:v}).data,k);
 const e=normaliseTimelineEffect({presetId:'noir-glitch',noirSeed:42,noirShutter:13,noirGrain:80});
 assert.deepEqual(snapshotClip({id:'noir',type:'sticker',effectOverlay:e}).effectOverlay,e);
 const contaminated=src.slice();for(let i=0;i<src.length;i+=4)if(!src[i+3])contaminated.set([255,0,255,0],i);
 const clean=noirFrame(.24,{},contaminated).data;
 for(let i=0;i<src.length;i+=4)if(src[i+3])assert.deepEqual(a.data.slice(i,i+4),clean.slice(i,i+4));
});
