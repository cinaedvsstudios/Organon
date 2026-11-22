/**
 * MotoriClip #51 — Fire Flames, an evolving procedural fluid-shaped flame bank.
 * Compact alpha/RGB raster: warped noise advection, ragged nonpolygonal
 * tongues, layered hot inner folds and cooler edges, breathing light and glow.
 * Every frame is a pure function of the clip's local time and saved settings.
 * No bitmap playback, random clocks, triangular spikes or audio dependency.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,Number.isFinite(Number(x))?Number(x):a));
const ease=(a,b,v)=>{const x=clamp((v-a)/(b-a),0,1);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
const HASH=new Map();
function noiseSeed(seed){
 let map=HASH.get(seed);if(map)return map;
 map=new Float32Array(64*64);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  let n=(Math.imul(x+1,374761393)^Math.imul(y+7,668265263)^Math.imul(seed+1,2246822519))>>>0;
  n^=n>>>13;n=Math.imul(n,1274126177)>>>0;n^=n>>>16;
  map[y*64+x]=(n>>>0)/4294967296;
 }
 HASH.set(seed,map);return map;
}
function noise(x,y,seed){
 const ix=Math.floor(x),iy=Math.floor(y),dx=x-ix,dy=y-iy,
  fx=dx*dx*(3-2*dx),fy=dy*dy*(3-2*dy);
 const tab=noiseSeed(seed),x0=ix&63,x1=(ix+1)&63,y0=(iy&63)*64,y1=((iy+1)&63)*64;
 return mix(mix(tab[y0+x0],tab[y0+x1],fx),mix(tab[y1+x0],tab[y1+x1],fx),fy);
}
function config(e={}){
 const color=/^#[a-f\d]{6}$/i.test(String(e.color))?String(e.color):'#ffd98d';
 return {
  rgb:[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),
  density:clamp(e.density??48,1,120)/120,
  scale:clamp(e.scale??100,10,300)/100,
  direction:clamp(e.direction??0,-180,180)*Math.PI/180,
  distortion:clamp(e.distortion??55,0,100)/100,
  glow:clamp(e.glow??64,0,100)/100,
  blur:clamp(e.blur??24,0,60)/60,
  originX:clamp(e.originX??20,0,100)/100,
  originY:clamp(e.originY??12,0,100)/100,
  strength:clamp(e.intensity??70,0,100)/100
 };
}
/**
 * One pixel's physical flame and luminous halo; all underlying media is
 * unaffected, with strictly local alpha, soft smoke-free transparent edges.
 */
function sample(u,v,o,time){
 const rise=Math.max(0,(.97+(o.originY-.12)*.18-v)/Math.max(.12,.57*o.scale));
 const shifted=u-(o.originX-.20)*.30;
 const centerFade=1-ease(.34,.58,Math.abs(shifted-.5));
 const wind=Math.sin(o.direction)*rise*(.08+.20*o.distortion);
 const x=shifted-wind
   +Math.sin(rise*8.2-time*2.1+shifted*13)*(.009+.038*o.distortion)*rise;
 const field=noise(x*(6+o.density*5)-time*.38,rise*2.1-time*.33,101);
 const tongues=noise(x*(17+o.density*11)+time*.37,rise*3.7-time*.91,117);
 const curls=noise(x*26-time*.91,rise*9.4-time*1.14,129);
 const front=(.46+.27*(field-.5)*2+.22*(tongues-.5)*2
  +.065*Math.sin(x*27+time*1.1+field*5))*(.78+.22*centerFade);
 const fold=(.10+.90*(.55*field+.45*tongues))*(.76+.24*Math.sin(time*3.5+x*19+curls*4));
 const small=clamp(.57+.50*curls+.28*tongues,0,1);
 const diff=front-rise;
 // Soft fog-like edge halo and separately tighter body contour.
 const body=ease(-.08-o.blur*.03,.065+o.blur*.065,diff);
 const glow=ease(-.27-o.glow*.19,.11,diff);
 const span=centerFade*(.72+.28*small);
 const flicker=.8+.20*Math.sin(time*5.2+field*8+curls*3);
 const hot=clamp((1-rise*.89)*(.74+.36*small)+.20*Math.sin(x*41+rise*15-time*7),0,1);
 const alpha=clamp((body*(.53+.42*fold)+glow*(.08+.13*o.glow))*span*flicker*o.strength,0,.94);
 const light=clamp(hot*.88+.13*curls,0,1);
 const outer=[123,19,4],middle=[249,81,10],core=[255,217,89];
 const between=clamp((light-.13)*1.45,0,1),inner=clamp((light-.61)*2.4,0,1);
 const base=outer.map((c,i)=>mix(mix(c,middle[i],between),core[i],inner));
 const tint=clamp((light-.53)*.34,0,.2);
 return {alpha,light,body,front,fold,rise,color:base.map((c,i)=>clamp(mix(c,o.rgb[i],tint),0,255))};
}
/** Pure sample model exposed for geometry, flow and border tests. */
export function sampleFireFlame(u,v,effect={},cycle=0){
 return sample(clamp(u,0,1),clamp(v,0,1),config(effect),Math.max(0,Number(cycle)||0));
}
export function buildFireFlamesFrame(width,height,effect={},cycle=0,reuse){
 const w=Math.max(1,Math.round(Number(width)||1)),h=Math.max(1,Math.round(Number(height)||1));
 const rgba=reuse?.length===w*h*4?reuse:new Uint8ClampedArray(w*h*4);
 const settings=config(effect),time=Math.max(0,Number(cycle)||0);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const {alpha,color}=sample((x+.5)/w,(y+.5)/h,settings,time);
  const k=(y*w+x)*4;
  rgba[k]=color[0];rgba[k+1]=color[1];rgba[k+2]=color[2];rgba[k+3]=Math.round(alpha*255);
 }
 return {width:w,height:h,data:rgba};
}
const SCRATCH=new WeakMap();
function scratchFor(ctx,w,h){
 let entry=SCRATCH.get(ctx);
 const ratio=Math.min(1,144/Math.max(w,h)),width=Math.max(48,Math.round(w*ratio)),
  height=Math.max(32,Math.round(h*ratio));
 if(!entry){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):null;
  const context=canvas?.getContext('2d');
  if(!context)return null;
  entry={canvas,context,pixels:null};SCRATCH.set(ctx,entry);
 }
 if(entry.canvas.width!==width||entry.canvas.height!==height){
  entry.canvas.width=width;entry.canvas.height=height;entry.pixels=null;
 }
 if(!entry.pixels)entry.pixels=entry.context.createImageData(width,height);
 return entry;
}
/** Graceful Canvas fallback for a non-browser test or inaccessible scratch. */
function contourFallback(ctx,w,h,e,cycle,strength){
 const o=config(e);
 ctx.globalAlpha*=strength;
 for(let i=0;i<12;i++){
  const phase=cycle*(1.7+i*.03)+i*1.8,at=w*(i+.5)/12,
   tipY=h*(.37+.20*Math.sin(phase*.35)),wide=w*.065*o.scale;
  const g=ctx.createLinearGradient(at,h,at,tipY);
  g.addColorStop(0,'#ff7412');g.addColorStop(.45,'rgba(255,149,24,.57)');
  g.addColorStop(1,'rgba(255,188,63,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(at-wide,h);
  ctx.quadraticCurveTo(at-wide+Math.sin(phase)*wide,tipY+h*.16,at+Math.sin(phase)*wide*.5,tipY);
  ctx.quadraticCurveTo(at+wide*.5,tipY+h*.18,at+wide,h);
  ctx.closePath();ctx.fill();
 }
}
/** Live compositor and export use exactly the same deterministic RGBA pixels. */
export function renderFireFlames(ctx,w,h,e={},cycle=0,strength=clamp(e.intensity??70,0,100)/100){
 const opacity=clamp(strength,0,1);if(opacity<=0)return true;
 const entry=scratchFor(ctx,w,h);
 ctx.save();
 try{
  if(!entry){contourFallback(ctx,w,h,e,cycle,opacity);return true;}
  buildFireFlamesFrame(entry.canvas.width,entry.canvas.height,
   {...e,intensity:opacity*100},cycle,entry.pixels.data);
  entry.context.putImageData(entry.pixels,0,0);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(entry.canvas,0,0,w,h);
  // Tiny irregular luminous wisps soften the raster's outline. These are
  // translucent curved strokes, NOT filled triangles or a translated sprite.
  const quantity=Math.max(4,Math.min(12,Math.round((e.density??48)/10)));
  for(let i=0;i<quantity;i++){
   const x=w*(i+.5)/quantity,phase=cycle*(1.5+i*.071)+i*2.7;
   const y=h*(.69+.12*Math.sin(phase*.44)),drift=Math.sin(phase*1.13)*w*.024;
   ctx.strokeStyle='rgba(255,197,76,'+(opacity*.10).toFixed(4)+')';
   ctx.lineWidth=Math.max(.4,Math.min(w,h)*.004);
   ctx.beginPath();ctx.moveTo(x,h*.97);
   ctx.quadraticCurveTo(x+drift,y+h*.09,x+drift*.65,y);ctx.stroke();
  }
 }finally{ctx.restore();}
 return true;
}
