/** MotoriClip #56 — real procedural Starburst geometry, controls, timing and history. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderStarburst,starburstGeometry} from '../js/timeline-starburst.mjs';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,paintTimelineEffect}
 from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
const preset=patch=>normaliseTimelineEffect({presetId:'starburst',
 color:'#ffe100',secondaryColor:'#ffffff',rayCount:18,rayThickness:54,
 direction:25,spinDirection:1,originX:50,originY:50,glow:76,
 intensity:83,speed:1.5,...patch});
const geometry=(e,seconds)=>starburstGeometry(320,180,e,seconds*e.speed);
test('Starburst is its own animated Light effect with two alternating colours and covered frame',()=>{
 const meta=TIMELINE_EFFECTS.find(x=>x.id==='starburst');
 assert.equal(meta?.category,'Light');
 assert.equal(meta?.animated,true);
 const e=preset({}),g=geometry(e,.4);
 assert.equal(g.rays.length,36);
 assert.equal(g.rayCount,18);
 assert.equal(g.primary,'#ffe100');assert.equal(g.secondary,'#ffffff');
 assert.equal(g.cx,160);assert.equal(g.cy,90);
 assert.ok(g.radius>Math.hypot(320,180),'Radial rays must cover corners');
 for(let i=0;i<g.rays.length;i++){
  const ray=g.rays[i],next=g.rays[(i+1)%g.rays.length];
  assert.equal(ray.color,i%2===0?g.primary:g.secondary);
  assert.ok(ray.end>ray.start,'No degenerate starburst spokes');
  if(i<g.rays.length-1)
   assert.ok(Math.abs(ray.end-next.start)<1e-8,'No missing angular wedges');
 }
 assert.ok(Math.abs(g.rays[0].end-g.rays[0].start-(Math.PI*2/18)*.54)<1e-8);
 assert.ok(Math.abs(g.rays[1].end-g.rays[1].start-(Math.PI*2/18)*.46)<1e-8);
});
test('Coherent clockwise/anticlockwise rotation, centre, ray count and thickness genuinely respond',()=>{
 const e=preset({}),t=.8,forward=geometry(e,t),reverse=geometry(preset({spinDirection:-1}),t),
  zero=geometry(e,0),back=geometry(e,t);
 assert.deepEqual(forward,back,'Reverse seek must recalculate the exact same geometric phase');
 assert.ok(forward.rotation>zero.rotation&&reverse.rotation<geometry(preset({spinDirection:-1}),0).rotation);
 assert.equal(forward.rays.length,36);
 assert.equal(geometry(preset({rayCount:30}),t).rays.length,60);
 assert.notEqual(geometry(preset({rayThickness:22}),t).rays[0].end,forward.rays[0].end);
 assert.notEqual(geometry(preset({originX:15}),t).cx,forward.cx);
 assert.notEqual(geometry(preset({originY:76}),t).cy,forward.cy);
 assert.notEqual(geometry(preset({direction:-90}),t).rotation,forward.rotation);
 assert.notEqual(geometry(preset({speed:3}),t).rotation,forward.rotation);
 assert.notEqual(geometry(preset({color:'#a4deff'}),t).primary,forward.primary);
 assert.notEqual(geometry(preset({secondaryColor:'#ef88ce'}),t).secondary,forward.secondary);
 assert.notEqual(geometry(preset({intensity:22}),t).alpha,forward.alpha);
 assert.notEqual(geometry(preset({glow:0}),t).glow,forward.glow);
});
test('Starburst normalizes new fields without contaminating legacy recipes; portable Undo roundtrip',()=>{
 const e=preset({rayCount:400,rayThickness:-30,secondaryColor:'bad',spinDirection:-1});
 assert.equal(e.rayCount,64);assert.equal(e.rayThickness,10);
 assert.equal(e.secondaryColor,'#ffffff');assert.equal(e.spinDirection,-1);
 const orig=normaliseTimelineEffect({presetId:'light-sweep'});
 assert.ok(!('rayCount' in orig)&&!('secondaryColor' in orig)&&!('spinDirection' in orig));
 const defaults=normaliseTimelineEffect({presetId:'starburst'});
 assert.deepEqual([defaults.originX,defaults.originY],[50,50]);
 assert.deepEqual([defaults.color,defaults.secondaryColor],['#ffdf00','#ffffff']);
 const stored=preset({rayCount:28,rayThickness:68,secondaryColor:'#e3c5ff',spinDirection:-1});
 const saved=snapshotClip({id:'rays',type:'sticker',effectOverlay:stored});
 const target={id:'rays',type:'sticker'};
 applyClipData(target,saved);
 assert.deepEqual(target.effectOverlay,stored);
 assert.deepEqual(geometry(target.effectOverlay,1.15),geometry(stored,1.15));
 applyClipData(target,{...saved,effectOverlay:null});assert.equal(target.effectOverlay,null);
});
test('Canvas2D draws new antialiased coloured sectors in deterministic shared preview/export painter',()=>{
 const make=()=>{
  const ops=[],gradient=()=>({addColorStop:(...v)=>ops.push(['stop',...v])});
  const ctx=new Proxy({},{
   get(obj,key){
    if(Object.hasOwn(obj,key))return obj[key];
    if(key==='globalAlpha')return 1;
    if(key==='createRadialGradient')return (...v)=>{ops.push(['gradient',...v]);return gradient();};
    return (...v)=>ops.push([key,...v]);
   },
   set(obj,key,value){obj[key]=value;ops.push(['set',String(key),value]);return true;}
  });
  return {ctx,ops};
 };
 const e=preset({}),a=make(),b=make(),c=make();
 assert.equal(renderStarburst(a.ctx,320,180,e,.5*e.speed,e.intensity/100),true);
 renderStarburst(b.ctx,320,180,e,.5*e.speed,e.intensity/100);
 renderStarburst(c.ctx,320,180,e,1.35*e.speed,e.intensity/100);
 assert.deepEqual(a.ops,b.ops);
 assert.notDeepEqual(a.ops,c.ops);
 assert.equal(a.ops.filter(x=>x[0]==='arc').length,e.rayCount*2+1);
 assert.ok(a.ops.some(x=>x[0]==='set'&&x[1]==='fillStyle'&&x[2]===e.color));
 assert.ok(a.ops.some(x=>x[0]==='set'&&x[1]==='fillStyle'&&x[2]===e.secondaryColor));
 assert.ok(a.ops.some(x=>x[0]==='gradient'),'Glowing radial centre must be real');
 assert.ok(a.ops.some(x=>x[0]==='save')&&a.ops.some(x=>x[0]==='restore'));
 const parent=make();
 assert.equal(paintTimelineEffect(parent.ctx,320,180,e,.5,3),true);
 assert.ok(parent.ops.some(x=>x[0]==='arc'),'Normal preview/export compositor invokes new Starburst');
 const off=make();
 renderStarburst(off.ctx,320,180,preset({glow:0}),.4,.5);
 assert.ok(!off.ops.some(x=>x[0]==='gradient'),'Glow=0 removes actual luminous centre');
});
