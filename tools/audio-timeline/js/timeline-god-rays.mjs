/**
 * MotoriClip #55 — God Rays. Genuine image-dependent soft volumetric beams.
 *
 * The ray field takes *actual composited source pixels*, finds luminous regions
 * close to the user-selected emitter, samples angular highlight/occlusion
 * structure, and projects diffused stochastic shafts into the image. Both
 * shafts and internal dust drift continuously with clip-relative time.
 *
 * No fixed polygons/gradient triangles, no static sprites, no wall-clock
 * randomness. The raster is bounded/reused and preview/export share this code.
 */
const limit=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,v)=>{const x=limit((v-a)/(b-a),0,1);return x*x*(3-2*x);};
const MAPS=new Map();
function hash(x,y,seed){
 let n=(Math.imul(x+13,374761393)^Math.imul(y+23,668265263)^Math.imul(seed+1,2246822519))>>>0;
 n^=n>>>13;n=Math.imul(n,1274126177)>>>0;n^=n>>>16;
 return n/4294967296;
}
function lattice(seed){
 let map=MAPS.get(seed);if(map)return map;
 map=new Float32Array(64*64);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++)map[y*64+x]=hash(x,y,seed);
 MAPS.set(seed,map);return map;
}
function noise(x,y,map){
 const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(0,1,x-ix),fy=smooth(0,1,y-iy);
 const x0=ix&63,x1=(ix+1)&63,y0=(iy&63)*64,y1=((iy+1)&63)*64;
 return mix(mix(map[y0+x0],map[y0+x1],fx),mix(map[y1+x0],map[y1+x1],fx),fy);
}
function options(e={}){
 const color=/^#[0-9a-f]{6}$/i.test(String(e.color))?String(e.color):'#ffdfab';
 return {
  tint:[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),
  originX:limit(e.originX??20,0,100)/100,
  originY:limit(e.originY??12,0,100)/100,
  intensity:limit(e.intensity??70,0,100)/100,
  density:limit(e.density??48,1,120)/120,
  scale:limit(e.scale??100,10,300)/100,
  direction:limit(e.direction??0,-180,180)*Math.PI/180,
  distortion:limit(e.distortion??55,0,100)/100,
  blur:limit(e.blur??24,0,60)/60,
  glow:limit(e.glow??64,0,100)/100,
  broad:lattice(19),fine:lattice(61)
 };
}
function luminance(bytes,w,h,x,y){
 const px=Math.max(0,Math.min(w-1,Math.round(x)));
 const py=Math.max(0,Math.min(h-1,Math.round(y)));
 const k=(py*w+px)*4;
 return (bytes[k]*.2126+bytes[k+1]*.7152+bytes[k+2]*.0722)/255*
  (bytes[k+3]/255);
}
function chooseEmitter(bytes,w,h,o){
 // The user chooses the region, while local bright pixels guide the exact
 // scattering focus. A nearby window/sun should move the emitter subtly.
 const ox=o.originX*w,oy=o.originY*h;
 let best=-1,bx=ox,by=oy;
 const radius=Math.max(4,Math.round(Math.min(w,h)*.17));
 const step=Math.max(1,Math.floor(radius/7));
 for(let dy=-radius;dy<=radius;dy+=step)for(let dx=-radius;dx<=radius;dx+=step){
  const px=ox+dx,py=oy+dy;
  const light=luminance(bytes,w,h,px,py);
  const range=Math.hypot(dx,dy)/radius;
  const value=light-(range*.13);
  if(value>best){best=value;bx=px;by=py;}
 }
 const attract=smooth(.27,.8,best)*.42;
 return {x:mix(ox,bx,attract),y:mix(oy,by,attract),
  luminosity:Math.max(0,best)};
}
function config(e,source,w,h,cycle){
 const o=options(e),t=Math.max(0,Number(cycle)||0);
 const f=chooseEmitter(source,w,h,o);
 o.x=f.x;o.y=f.y;o.luminosity=f.luminosity;
 o.maxReach=Math.hypot(w,h)*(.54+o.scale*.72);
 o.fanAngle=Math.PI*.5+o.direction;
 o.time=t;
 o.drift=Math.sin(t*.57)*(.05+.19*o.distortion);
 o.freq=7+o.density*33;
 return o;
}
function shaftSample(source,w,h,o,x,y,out){
 const dx=x-o.x,dy=y-o.y,dist=Math.hypot(dx,dy)+.0001,
  angle=Math.atan2(dy,dx);
 // A soft, direction-adjustable emitting cone; no hard triangle vertices.
 const delta=Math.atan2(Math.sin(angle-o.fanAngle),Math.cos(angle-o.fanAngle));
 const cone=1-smooth(.52+o.blur*.19,1.95+o.blur*.48,Math.abs(delta));
 const reach=1-smooth(o.maxReach*.06,o.maxReach,dist);
 if(cone<.001||reach<.001||o.luminosity<.16){
  out.alpha=0;out.shaft=0;out.illumination=0;return out;
 }
 const nx=dx/dist,ny=dy/dist,t=o.time;
 // Three source-radiance probes along each radial path. Bright/occluded
 // geometry near the source changes the strength of each projected shaft.
 const r1=Math.min(dist*.65,Math.min(w,h)*.075+o.glow*4);
 const r2=Math.min(dist*.70,Math.min(w,h)*.14+o.glow*6);
 const r3=Math.min(dist*.78,Math.min(w,h)*.24+o.glow*7);
 const l1=luminance(source,w,h,o.x+nx*r1,o.y+ny*r1);
 const l2=luminance(source,w,h,o.x+nx*r2,o.y+ny*r2);
 const l3=luminance(source,w,h,o.x+nx*r3,o.y+ny*r3);
 const sourceEnergy=Math.max(0, .42*l1+.36*l2+.22*l3-.10);
 // Multiscale curved turbulent modulation. Diffuse filaments are not
 // rigid wedges; different rays and depth regions fade/drift separately.
 const phase=angle*o.freq+o.drift+noise(x*.025+t*.16,y*.024-t*.12,o.broad)*o.distortion*2.3;
 const broad=noise(phase*.30+t*.25,dist*.014-t*.38,o.broad);
 const finer=noise(phase*.82-t*.50,dist*.028+t*.29,o.fine);
 const filament=smooth(.18,.82,broad*.60+finer*.40);
 const wave=.64+.36*Math.sin(t*1.45+angle*3.1+dist*.018+finer*5.2);
 const attenuation=Math.pow(Math.max(0,reach),.78+.57*o.blur);
 const sourceGate=smooth(.15,.65,o.luminosity)*(.55+.45*smooth(.02,.44,sourceEnergy));
 const strength=sourceGate*cone*attenuation*filament*wave;
 const alpha=limit(strength*(.56+.95*o.glow)*o.intensity*2.55,0,.67);
 out.alpha=alpha;out.shaft=filament;out.illumination=sourceGate;
 return out;
}
/** Source-only diagnostics: emits zero rays when the underlying image is dark. */
export function sampleGodRay(source,width,height,effect={},cycle=0,x=0,y=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const data=source?.data||source;
 if(!data||data.length!==w*h*4)throw Error('God Rays needs source frame RGBA');
 const o=config(effect,data,w,h,cycle);
 return {...shaftSample(data,w,h,o,x,y,{alpha:0,shaft:0,illumination:0}),
  emitterX:o.x,emitterY:o.y,emitterLight:o.luminosity};
}
export function buildGodRaysFrame(source,width,height,effect={},cycle=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height)),
  data=source?.data||source;
 if(!data||data.length!==w*h*4)throw Error('God Rays source RGBA buffer mismatch');
 const rgba=reuse?.length===data.length&&reuse!==data?reuse:new Uint8ClampedArray(data.length);
 const o=config(effect,data,w,h,cycle),sample={alpha:0,shaft:0,illumination:0};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  shaftSample(data,w,h,o,x+.5,y+.5,sample);
  const k=(y*w+x)*4,core=smooth(0,.45,1-Math.hypot(x-o.x,y-o.y)/(Math.min(w,h)*.4));
  const tintShift=core*.30*o.glow;
  rgba[k]=mix(o.tint[0],255,tintShift);
  rgba[k+1]=mix(o.tint[1],249,tintShift);
  rgba[k+2]=mix(o.tint[2],230,tintShift);
  rgba[k+3]=Math.round(sample.alpha*255);
 }
 return {width:w,height:h,data:rgba,emitter:{x:o.x,y:o.y,brightness:o.luminosity}};
}
const SCRATCH=new WeakMap();
function buffers(ctx,w,h){
 const factor=Math.min(1,144/Math.max(w,h));
 const sw=Math.max(48,Math.round(w*factor)),sh=Math.max(28,Math.round(h*factor));
 let pair=SCRATCH.get(ctx);
 if(!pair){
  const create=()=>{
   if(typeof document!=='undefined')return document.createElement('canvas');
   if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(sw,sh);
   return null;
  };
  const sourceCanvas=create(),rayCanvas=create();
  const sourceCtx=sourceCanvas?.getContext('2d',{willReadFrequently:true});
  const rayCtx=rayCanvas?.getContext('2d');
  if(!sourceCtx||!rayCtx)return null;
  pair={sourceCanvas,rayCanvas,sourceCtx,rayCtx,out:null};
  SCRATCH.set(ctx,pair);
 }
 if(pair.sourceCanvas.width!==sw||pair.sourceCanvas.height!==sh){
  pair.sourceCanvas.width=pair.rayCanvas.width=sw;
  pair.sourceCanvas.height=pair.rayCanvas.height=sh;pair.out=null;
 }
 if(!pair.out)pair.out=pair.rayCtx.createImageData(sw,sh);
 return pair;
}
function fallback(ctx,w,h,e,cycle,strength){
 // With no composited source (e.g. minimal headless preview), render diffuse
 // moving pools of light instead of opaque triangle-shaped placeholders.
 const t=Number(cycle)||0,ox=w*(e.originX??20)/100,oy=h*(e.originY??12)/100;
 for(let i=0;i<7;i++){
  const offset=i*.45+(e.direction??0)*Math.PI/180;
  const radius=Math.hypot(w,h)*(.38+.12*Math.sin(t*.14+i*1.7));
  const x=ox+Math.cos(offset+t*.043)*radius*.45;
  const y=oy+Math.sin(offset+t*.043)*radius*.45;
  const gradient=ctx.createRadialGradient(x,y,0,x,y,radius);
  const tint=e.color||'#ffdfab';
  const c=[1,3,5].map(k=>parseInt(tint.slice(k,k+2),16)).join(',');
  gradient.addColorStop(0,'rgba('+c+','+(strength*.11).toFixed(4)+')');
  gradient.addColorStop(.48,'rgba('+c+','+(strength*.042).toFixed(4)+')');
  gradient.addColorStop(1,'rgba('+c+',0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
 }
}
export function renderGodRays(ctx,source,w,h,e={},cycle=0,amount=1){
 ctx.save();
 try{
  if(!source){
   ctx.globalCompositeOperation='screen';
   fallback(ctx,w,h,e,cycle,limit(amount,0,1));return true;
  }
  // The outer generic source-effect handler draws (1-alpha) of the source.
  // Restore it intact before adding physically translucent scattering.
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=1;
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(source,0,0,w,h);
  const pair=buffers(ctx,w,h);
  if(!pair)return true;
  const sw=pair.sourceCanvas.width,sh=pair.sourceCanvas.height;
  const s=pair.sourceCtx;
  s.setTransform(1,0,0,1,0,0);s.globalAlpha=1;
  s.globalCompositeOperation='source-over';s.clearRect(0,0,sw,sh);
  s.drawImage(source,0,0,sw,sh);
  let pixels;
  try{pixels=s.getImageData(0,0,sw,sh);}catch{return true;}
  buildGodRaysFrame(pixels,sw,sh,e,cycle,pair.out.data);
  pair.rayCtx.putImageData(pair.out,0,0);
  ctx.globalCompositeOperation='screen';ctx.globalAlpha=1;
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(pair.rayCanvas,0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
