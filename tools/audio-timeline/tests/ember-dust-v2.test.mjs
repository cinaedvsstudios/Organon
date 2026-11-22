/** #48 Fire Embers / Flaming Dust: seeded curved turbulent real particle acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFlamingDustFrame,renderFlamingDust} from '../js/timeline-ember-dust.mjs';
import {normaliseTimelineEffect,paintTimelineEffect} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';

const base={intensity:90,speed:1.3,density:80,scale:120,direction:25,distortion:70,
 glow:74,originX:50,originY:12,color:'#ffca8f'};
const settings=id=>normaliseTimelineEffect({...base,presetId:id});

test('Embers and floating/flaming dust have independent generation, accelerated lift and nonstraight turbulent paths',()=>{
 for(const id of ['fire-embers','particle-dust']){
  const effect=settings(id),at=t=>buildFlamingDustFrame(320,180,effect,t);
  const first=at(.2),repeat=at(.2),middle=at(.7),later=at(1.4);
  assert.deepEqual(first,repeat,id+' must reproduce exact seeds after backward seek');
  assert.notDeepEqual(first,middle,id+' must change every timestamp');
  assert.equal(first.length,80);
  assert.ok(new Set(first.map(p=>p.life.toFixed(3))).size>60,'Motes must not share one lifetime');
  assert.ok(new Set(first.map(p=>p.acceleration.toFixed(1))).size>50,'Motes must accelerate at different rates');
  assert.ok(new Set(first.map(p=>p.color)).size>=4,'Motes need varied temperatures/colours');
  assert.ok(new Set(first.map(p=>p.radius.toFixed(2))).size>55,'Motes must have varying sizes');
  assert.ok(new Set(first.map(p=>p.rate.toFixed(3))).size>50,'Motes must have independent rise speeds');
  const visible=first.filter(p=>p.alpha>.12&&p.x>0&&p.x<320&&p.y>0&&p.y<180);
  assert.ok(visible.length>40,'There must be many overlapping independently visible motes');
  const zones=new Set(visible.map(p=>(p.x>=160?'R':'L')+(p.y>=90?'B':'T')));
  assert.equal(zones.size,4,'Particles cannot all travel in one synchronized band');
  const states=[at(.1),at(.35),at(.6)];
  let curves=0,acceleration=0;
  for(let i=0;i<80;i++){
   const [a,b,c]=states.map(f=>f[i]);
   if(a.generation!==b.generation||b.generation!==c.generation)continue;
   const u=[b.x-a.x,b.y-a.y],v=[c.x-b.x,c.y-b.y];
   const turn=Math.abs(u[0]*v[1]-u[1]*v[0]);
   if(turn>2)curves++;
   if(Math.abs(v[1]-u[1])>.3)acceleration++;
  }
  assert.ok(curves>18,id+' must follow unique visibly curved trajectories, not straight paths');
  assert.ok(acceleration>18,id+' must evolve vertical velocity/acceleration and turbulence');
  assert.notDeepEqual(first,later,'Later generations must have different locations and lifetimes');
 }
 assert.notDeepEqual(buildFlamingDustFrame(320,180,settings('fire-embers'),.7),
  buildFlamingDustFrame(320,180,settings('particle-dust'),.7),
  'Flaming ember lift must remain distinct from floating dust');
});

test('Existing emitter controls alter physical motion and retain parameters through project history',()=>{
 for(const id of ['fire-embers','particle-dust']){
  const e=settings(id),frame=effect=>buildFlamingDustFrame(640,360,effect,1.31);
  const baseline=frame(e);
  for(const delta of [{density:21},{scale:175},{direction:-95},{distortion:5},
   {glow:0},{originX:5},{originY:83},{color:'#51e9ff'}]){
   const modified=frame(normaliseTimelineEffect({...e,...delta}));
   assert.notDeepEqual(modified,baseline,
    id+' setting must alter physical particle output: '+JSON.stringify(delta));
  }
  const clip={id:'effect-'+id,type:'sticker',effectOverlay:e};
  const saved=snapshotClip(clip),restored={id:clip.id,type:'sticker'};
  applyClipData(restored,saved);
  assert.deepEqual(restored.effectOverlay,e);
  assert.deepEqual(frame(restored.effectOverlay),baseline);
  applyClipData(restored,{...saved,effectOverlay:null});
  assert.equal(restored.effectOverlay,null);
 }
});

test('Canvas painting uses distinct glowing motes, curved streaks and absolute-time rendering, not a translated still texture',()=>{
 const make=()=>{
  const log=[];
  const radial=()=>({addColorStop:(...args)=>log.push(['colorStop',...args])});
  const ctx=new Proxy({},{
   get(target,key){
    if(Object.hasOwn(target,key))return target[key];
    if(key==='globalAlpha')return 1;
    if(key==='createRadialGradient')return (...args)=>{log.push(['radial',...args]);return radial();};
    return (...args)=>log.push([key,...args]);
   },
   set(target,key,value){target[key]=value;log.push(['set',String(key),value]);return true;}
  });
  return {ctx,log};
 };
 for(const id of ['fire-embers','particle-dust']){
  const e=settings(id),{ctx,log}=make();
  assert.equal(renderFlamingDust(ctx,640,360,e,.7,.9),true);
  assert.ok(log.filter(x=>x[0]==='arc').length>30,'Each mote must be a separate animated source');
  assert.ok(log.filter(x=>x[0]==='radial').length>30,'Every particle should have local luminous atmosphere');
  if(id==='fire-embers')assert.ok(log.some(x=>x[0]==='stroke'),
   'Embers must expose individual curved-path velocity streaks');
  const visible=JSON.stringify(log);
  const second=make();renderFlamingDust(second.ctx,640,360,e,.7,.9);
  assert.equal(JSON.stringify(second.log),visible,'Redrawing after reverse seek must match');
  const changed=make();renderFlamingDust(changed.ctx,640,360,e,1.6,.9);
  assert.notEqual(JSON.stringify(changed.log),visible,'Particle paths must move independently');
  const parent=make();
  assert.equal(paintTimelineEffect(parent.ctx,640,360,e,.7/e.speed,3),true);
  assert.ok(parent.log.some(x=>x[0]==='radial'),
   'Real preview/export timeline must call the procedural motes painter');
 }
});