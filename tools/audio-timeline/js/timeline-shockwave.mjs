/**
 * MotoriClip #66 — Shockwave visual-quality rebuild.
 * A compressive pressure shell expands through actual lower-layer source pixels,
 * followed by a weaker inward suction wake and increasingly dissipated aftershocks.
 * Unlike water ripples, pressure is asymmetrical with a single steep leading
 * front and an uneven, decaying rarefaction tail. No synthetic opaque disc.
 * Frame state is seeded and depends ONLY on absolute clip-relative time.
 */
const clamp=(v,min,max,fallback=min)=>{
 const n=Number(v);return Math.min(max,Math.max(min,Number.isFinite(n)?n:fallback));
};
const fract=n=>((n%1)+1)%1;
const smooth=t=>{const v=clamp(t,0,1,0);return v*v*(3-2*v);};
function rand(a,b=0){
 let n=(Math.imul((a|0)+197,0x9e3779b1)^Math.imul((b|0)+41,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
}
const color=v=>{
 const h=/^#[0-9a-f]{6}$/i.test(String(v))?String(v):'#ffd98d';
 return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
};
function parameters(e={}){
 return {
  density:clamp(e.density,1,120,48),
  scale:clamp(e.scale,10,300,100)/100,
  distortion:clamp(e.distortion,0,100,65)/100,
  direction:clamp(e.direction,-180,180,0)*Math.PI/180,
  originX:clamp(e.originX,0,100,50)/100,
  originY:clamp(e.originY,0,100,50)/100,
  width:clamp(e.shockWidth,1,16,6)/100,
  compression:clamp(e.shockCompression,0,100,78)/100,
  turbulence:clamp(e.shockTurbulence,0,100,38)/100,
  decay:clamp(e.shockDecay,0,100,55)/100,
  seed:Math.round(clamp(e.shockSeed,0,99999,7474)),
  tint:color(e.color)
 };
}
const noise=(theta,wave)=>{
 const segments=48,slot=((theta/(Math.PI*2))%1+1)%1*segments;
 const ix=Math.floor(slot),f=smooth(slot-ix);
 const a=rand(ix+wave.generation*241+wave.index*91,wave.seed+7);
 const b=rand((ix+1)%segments+wave.generation*241+wave.index*91,wave.seed+7);
 return (a*(1-f)+b*f)*2-1;
};
export function shockwaveFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const p=parameters(effect),t=Math.max(0,Number(seconds)||0);
 const D=Math.min(w,h),count=Math.max(1,Math.min(4,Math.ceil(p.density/35)));
 const waves=[];
 for(let i=0;i<count;i++){
  const life=3.2,stage=t/life+i*.13;
  const generation=Math.floor(stage),phase=fract(stage);
  const key=p.seed+i*127+generation*419;
  const radius=D*p.scale*(.045+phase*1.22);
  const energy=Math.pow(1-phase,.7+2.3*p.decay)*(1-i*.16)*
   (.84+.16*rand(key,p.seed+1));
  const drift=D*(.02+.07*phase);
  const cx=w*p.originX+Math.cos(p.direction)*drift+
   (i===0?0:(rand(key,p.seed+2)-.5)*w*.13);
  const cy=h*p.originY+Math.sin(p.direction)*drift+
   (i===0?0:(rand(key,p.seed+3)-.5)*h*.13);
  waves.push({index:i,generation,phase,cx,cy,radius,energy,
   thickness:Math.max(.7,D*(.008+.6*p.width)*p.scale),
   asymmetry:.008+.14*p.turbulence,seed:p.seed});
 }
 return {width:w,height:h,time:t,params:p,waves};
}
function bilinear(src,w,h,x,y,channel){
 const xx=clamp(x,0,w-1,0),yy=clamp(y,0,h-1,0);
 const x0=Math.floor(xx),y0=Math.floor(yy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1);
 const fx=xx-x0,fy=yy-y0;
 const a=(y0*w+x0)*4+channel,b=(y0*w+x1)*4+channel;
 const c=(y1*w+x0)*4+channel,d=(y1*w+x1)*4+channel;
 return (src[a]*(1-fx)+src[b]*fx)*(1-fy)+(src[c]*(1-fx)+src[d]*fx)*fy;
}
/** Pure source RGB refraction with original per-pixel transparency retained. */
export function buildShockwaveFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const src=source?.data||source;
 if(!src||src.length!==w*h*4)throw Error('Shockwave requires a matching RGBA source');
 const output=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);
 output.set(src);
 const state=shockwaveFrameState(w,h,effect,seconds),p=state.params,D=Math.min(w,h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=(y*w+x)*4;
  if(src[k+3]===0)continue;
  let dx=0,dy=0,bright=0,dark=0,affected=false;
  for(const wave of state.waves){
   const rx=x-wave.cx,ry=y-wave.cy,dist=Math.hypot(rx,ry);
   if(dist<.0001)continue;
   const theta=Math.atan2(ry,rx);
   const perturbedRadius=wave.radius*(1+noise(theta,wave)*wave.asymmetry);
   const d=dist-perturbedRadius,thick=wave.thickness;
   if(d>thick*3||d<-thick*4)continue;
   // Positive front: fast outward pressure. Delayed inward compression
   // release: lower-amplitude, wider wake, unlike a symmetric water sine.
   const front=Math.exp(-.5*(d/(thick*.66))**2);
   const suction=Math.exp(-.5*((d+thick*1.7)/(thick*1.45))**2);
   const pressure=(front-suction*.54)*wave.energy;
   const displacement=pressure*D*(.018+.075*p.compression)*p.distortion;
   dx+=(rx/dist)*displacement;
   dy+=(ry/dist)*displacement;
   bright+=front*wave.energy*(.22+.42*p.compression);
   dark+=suction*wave.energy*.16;
   affected=true;
  }
  if(!affected)continue;
  dx=clamp(dx,-D*.13,D*.13,0);
  dy=clamp(dy,-D*.13,D*.13,0);
  const highlight=clamp(bright,0,.74,0),shadow=clamp(dark,0,.27,0);
  for(let c=0;c<3;c++){
   const sampled=p.distortion?bilinear(src,w,h,x+dx,y+dy,c):src[k+c];
   const lit=sampled+(p.tint[c]-sampled)*highlight;
   output[k+c]=lit*(1-shadow);
  }
  output[k+3]=src[k+3];
 }
 return {width:w,height:h,data:output,state};
}
const SCRATCH=new WeakMap();
function getScratch(ctx,width,height){
 const factor=Math.min(1,512/Math.max(width,height));
 const w=Math.max(1,Math.round(width*factor)),h=Math.max(1,Math.round(height*factor));
 let item=SCRATCH.get(ctx);
 if(!item){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
  const c=canvas?.getContext('2d',{willReadFrequently:true});
  if(!c)return null;
  item={canvas,c,image:null};SCRATCH.set(ctx,item);
 }
 if(item.canvas.width!==w||item.canvas.height!==h){
  item.canvas.width=w;item.canvas.height=h;item.image=null;
 }
 return item;
}
/** Same renderer for Chrome preview and fixed-frame H.264 export. */
export function renderShockwave(ctx,source,width,height,effect={},seconds=0,amount=1){
 const a=clamp(amount,0,1,1);if(a===0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const cache=source&&getScratch(ctx,w,h);if(!cache)return false;
 const {canvas,c}=cache,sw=canvas.width,sh=canvas.height;
 c.setTransform?.(1,0,0,1,0,0);
 c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';
 c.clearRect(0,0,sw,sh);c.drawImage(source,0,0,sw,sh);
 let original;try{original=c.getImageData(0,0,sw,sh);}catch{return false;}
 const frame=buildShockwaveFrame(original,sw,sh,effect,seconds,cache.image?.data);
 if(!cache.image||cache.image.data.length!==frame.data.length)cache.image=c.createImageData(sw,sh);
 const out=cache.image.data;out.set(frame.data);
 if(a<1)for(let k=0;k<out.length;k+=4){
  for(let ch=0;ch<3;ch++)out[k+ch]=original.data[k+ch]+(out[k+ch]-original.data[k+ch])*a;
  out[k+3]=original.data[k+3];
 }
 c.putImageData(cache.image,0,0);
 ctx.save();
 try{
  ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;
  ctx.drawImage(canvas,0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
