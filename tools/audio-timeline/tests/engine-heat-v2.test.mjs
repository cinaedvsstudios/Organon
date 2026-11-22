/** MotoriClip #52: true underlying source heat refraction and history acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEngineHeatFrame,sampleEngineHeatDisplacement,renderEngineHeat}
 from '../js/timeline-engine-heat.mjs';
import {normaliseTimelineEffect,paintTimelineEffect,requiresCompositeSource}
 from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
const settings=patch=>normaliseTimelineEffect({presetId:'engine-heat',
 intensity:93,speed:1.37,density:72,scale:115,distortion:82,
 direction:19,originX:20,originY:12,blur:28,glow:54,color:'#ffc082',...patch});
const W=96,H=54;
function fixture(){
 const rgba=new Uint8ClampedArray(W*H*4);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*4;
  rgba[i]=x%10<5?235:12;
  rgba[i+1]=y%9<4?238:27;
  rgba[i+2]=x%15<7?180:32;rgba[i+3]=255;
 }
 return rgba;
}
const render=(e,t)=>buildEngineHeatFrame(fixture(),W,H,e,e.speed*t);
const hash=a=>{let h=2166136261>>>0;for(const v of a)h=Math.imul(h^v,16777619)>>>0;return h;};

test('Heat haze physically bends a source grid with independently rising two-dimensional pixel refraction',()=>{
 const e=settings({}),source=fixture();
 const a=render(e,.3),b=render(e,.92),rewind=render(e,.3);
 assert.deepEqual(a,rewind,'Pixel reprojector is a pure absolute-time function');
 assert.notDeepEqual(a,b,'Subpixel refractive waves evolve at different timestamps');
 let top=0,bottom=0,changed=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const k=(y*W+x)*4;
  if(y<Math.floor(H*.2)&&a.data[k+3]!==0)top++;
  if(y>H*.66&&a.data[k+3]>100)bottom++;
  if(a.data[k]!==b.data[k])changed++;
 }
 assert.equal(top,0,'Upper picture must remain entirely transparent to overlay, not soft-focus re-encoded');
 assert.ok(bottom>W*5,'Refraction exists over the lower heat zone');
 assert.ok(changed>200,'True sampled footage pixels move, not decorative strokes');
 assert.deepEqual([...source], [...fixture()],'Original media pixels are never mutated');
 const positions=Array.from({length:12},(_,i)=>
  sampleEngineHeatDisplacement(9+i*7,H*.86,W,H,e,.9));
 assert.ok(new Set(positions.map(p=>p.dx.toFixed(3))).size>9,'Different X positions have different displacements');
 assert.ok(new Set(positions.map(p=>p.dy.toFixed(3))).size>8,'Both X and Y directions really refract');
 assert.ok(positions.some(p=>Math.abs(p.dx)>.15&&Math.abs(p.dy)>.05),'Source is warped along both dimensions');
});

test('Heat starts below source horizon and changes smoothly in time without moving rigid bands',()=>{
 const e=settings({});
 const upper=sampleEngineHeatDisplacement(W*.5,H*.08,W,H,e,.6);
 const middle=sampleEngineHeatDisplacement(W*.5,H*.56,W,H,e,.6);
 const lower=sampleEngineHeatDisplacement(W*.5,H*.96,W,H,e,.6);
 assert.equal(upper.weight,0);
 assert.ok(lower.weight>middle.weight&&middle.weight>0);
 assert.notDeepEqual(lower,sampleEngineHeatDisplacement(W*.5,H*.96,W,H,e,1.1));
 const p1=sampleEngineHeatDisplacement(W*.48,H*.88,W,H,e,.65);
 const p2=sampleEngineHeatDisplacement(W*.48,H*.88,W,H,e,.651);
 assert.ok(Math.abs(p1.dx-p2.dx)<.1,'Time interpolation must shimmer continuously, not frame-jump');
});

test('Native intensity, density, wave strength, direction, origin, blur, glow and tint respond and save',()=>{
 const e=settings({}),original=hash(render(e,.71).data);
 for(const patch of [{density:12},{scale:190},{distortion:5},
 {direction:-90},{originX:76},{originY:80},{blur:0},
 {glow:0},{color:'#6abaf5'},{speed:2.1}]){
  const modified=settings(patch);
  assert.notEqual(hash(render(modified,.71).data),original,
   'Actual heat pixels must change for '+JSON.stringify(patch));
 }
 const saved=snapshotClip({id:'heat',type:'sticker',effectOverlay:e});
 const restored={id:'heat',type:'sticker'};
 applyClipData(restored,saved);
 assert.deepEqual(restored.effectOverlay,e);
 assert.deepEqual(render(restored.effectOverlay,.8),render(e,.8));
 applyClipData(restored,{...saved,effectOverlay:null});
 assert.equal(restored.effectOverlay,null);
 assert.equal(requiresCompositeSource('engine-heat'),true);
});

test('No actual footage means clean diagnostic shimmer rather than fake vertical lines',()=>{
 const make=()=>{
  const calls=[],gradient=()=>({addColorStop:(...x)=>calls.push(['stop',...x])});
  const ctx=new Proxy({},{
   get(target,key){if(Object.hasOwn(target,key))return target[key];
    if(key==='globalAlpha')return 1;
    if(key==='createLinearGradient')return (...x)=>{calls.push(['gradient',...x]);return gradient();};
    return (...x)=>calls.push([key,...x]);
   },set(target,key,value){target[key]=value;calls.push(['set',String(key),value]);return true;}
  });
  return {ctx,calls};
 };
 const e=settings({}),a=make(),b=make();
 assert.equal(renderEngineHeat(a.ctx,null,W,H,e,.4,.82),true);
 assert.equal(renderEngineHeat(b.ctx,null,W,H,e,.4,.82),true);
 assert.equal(JSON.stringify(a.calls),JSON.stringify(b.calls));
 assert.ok(!a.calls.some(x=>x[0]==='bezierCurveTo'||x[0]==='lineTo'));
 assert.ok(a.calls.some(x=>x[0]==='save')&&a.calls.some(x=>x[0]==='restore'));
 const parent=make();
 assert.equal(paintTimelineEffect(parent.ctx,W,H,e,.45,3),true);
 assert.ok(!parent.calls.some(x=>x[0]==='bezierCurveTo'),'No fake tendrils through the normal timeline');
});
