/**
 * MotoriClip #66 — Vibration Flash quality rebuild.
 * Camera-mount vibration over the actual previously composited RGBA source:
 * seeded directional micro-shakes, rapidly decaying residual oscillation,
 * shutter/ghost trails and luminance-weighted exposure flashes.
 * No flat colour rectangle, mutable frame counters, assets or timers.
 */
const clamp=(value,min,max,fallback=min)=>{const n=Number(value);return Math.min(max,Math.max(min,Number.isFinite(n)?n:fallback));};
function hash(a,b=0){
 let n=(Math.imul((a|0)+193,0x9e3779b1)^Math.imul((b|0)+43,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
}
const smooth=v=>v*v*(3-2*v);
const tint=hex=>{const h=/^#[0-9a-f]{6}$/i.test(String(hex))?String(hex):'#ffd98d';return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));};
const params=e=>({
 density:clamp(e.density,1,120,66)/120,
 scale:clamp(e.scale,10,300,100)/100,
 distortion:clamp(e.distortion,0,100,72)/100,
 direction:clamp(e.direction,-180,180,0)*Math.PI/180,
 frequency:clamp(e.vibrationFrequency,2,40,18),
 decay:clamp(e.vibrationDecay,0,100,28)/100,
 echo:clamp(e.vibrationEcho,0,100,42)/100,
 flash:clamp(e.vibrationFlash,0,100,65)/100,
 seed:Math.round(clamp(e.vibrationSeed,0,99999,8181)),
 tint:tint(e.color)
});
function interpolatedNoise(position,seed){
 const i=Math.floor(position),u=smooth(position-i);
 return ((1-u)*hash(i,seed)+u*hash(i+1,seed))*2-1;
}
/** Pure, replayable mechanical camera-motion and exposure state. */
export function vibrationFlashFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const p=params(effect),t=Math.max(0,Number(seconds)||0),D=Math.min(w,h);
 const phase=t*p.frequency;
 const envelope=Math.exp(-t*p.decay*1.4);
 const low=interpolatedNoise(phase*.47,p.seed+11);
 const high=interpolatedNoise(phase*1.23,p.seed+19);
 const cross=interpolatedNoise(phase*.63+4,p.seed+31);
 const complexity=.27+.73*p.density;
 const amount=D*(.003+.061*p.distortion)*p.scale*envelope;
 const lateral=amount*(low*.76+high*.24*complexity);
 const transverse=amount*(cross*.44+Math.sin(phase*2.38+p.seed)*.22*complexity);
 const cos=Math.cos(p.direction),sin=Math.sin(p.direction);
 const dx=lateral*cos-transverse*sin,dy=lateral*sin+transverse*cos;
 const index=Math.floor(phase),pulse=hash(index,p.seed+43);
 const subpulse=hash(index*7+3,p.seed+53);
 const gate=pulse>.70-.10*p.density?1:0;
 const flash=gate*p.flash*envelope*(.25+.75*subpulse);
 return {width:w,height:h,time:t,dx,dy,flash,
  blurDx:dx*.69,blurDy:dy*.69,params:p,envelope,tick:index};
}
function pixel(src,w,h,x,y,ch){
 const sx=clamp(x,0,w-1,0),sy=clamp(y,0,h-1,0);
 const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1);
 const fx=sx-x0,fy=sy-y0;
 const i=(y0*w+x0)*4+ch,j=(y0*w+x1)*4+ch,k=(y1*w+x0)*4+ch,l=(y1*w+x1)*4+ch;
 return (src[i]*(1-fx)+src[j]*fx)*(1-fy)+(src[k]*(1-fx)+src[l]*fx)*fy;
}
/** Image-space shutter echo and source luminance brightening; original alpha retained. */
export function buildVibrationFlashFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const src=source?.data||source;
 if(!src||src.length!==w*h*4)throw Error('Vibration Flash requires a matching RGBA source');
 const dst=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);
 dst.set(src);
 const state=vibrationFlashFrameState(w,h,effect,seconds),p=state.params;
 const {dx,dy,flash}=state,ghost=p.echo*.54*state.envelope;
 if(Math.abs(dx)+Math.abs(dy)<1e-8&&ghost===0&&flash===0)return {width:w,height:h,data:dst,state};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;
  if(src[i+3]===0)continue;
  const values=[0,0,0];
  for(let c=0;c<3;c++){
   const shaken=pixel(src,w,h,x+dx,y+dy,c);
   const echo=pixel(src,w,h,x-dx*.7,y-dy*.7,c);
   values[c]=shaken*(1-ghost)+echo*ghost;
  }
  const luminance=(values[0]*.2126+values[1]*.7152+values[2]*.0722)/255;
  // Camera sensor overexposure lifts photographed highlights, not the empty canvas.
  const gain=flash*(.08+.50*Math.sqrt(luminance));
  for(let c=0;c<3;c++){
   const captured=values[c];
   const hot=captured+(255-captured)*gain;
   dst[i+c]=hot+(p.tint[c]-hot)*gain*.16;
  }
  dst[i+3]=src[i+3];
 }
 return {width:w,height:h,data:dst,state};
}
const CACHE=new WeakMap();
function scratch(ctx,w,h){
 const factor=Math.min(1,512/Math.max(w,h)),sw=Math.max(1,Math.round(w*factor)),sh=Math.max(1,Math.round(h*factor));
 let item=CACHE.get(ctx);
 if(!item){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(sw,sh):null;
  const c=canvas?.getContext('2d',{willReadFrequently:true});
  if(!c)return null;item={canvas,c,image:null};CACHE.set(ctx,item);
 }
 if(item.canvas.width!==sw||item.canvas.height!==sh){item.canvas.width=sw;item.canvas.height=sh;item.image=null;}
 return item;
}
/** Single absolute-time preview/export painter with one <=512px scratch canvas per output. */
export function renderVibrationFlash(ctx,source,width,height,effect={},seconds=0,amount=1){
 const alpha=clamp(amount,0,1,1);if(alpha<=0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const cache=source&&scratch(ctx,w,h);if(!cache)return false;
 const {canvas,c}=cache,sw=canvas.width,sh=canvas.height;
 c.setTransform?.(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';
 c.clearRect(0,0,sw,sh);c.drawImage(source,0,0,sw,sh);
 let original;try{original=c.getImageData(0,0,sw,sh);}catch{return false;}
 const frame=buildVibrationFlashFrame(original,sw,sh,effect,seconds,cache.image?.data);
 if(!cache.image||cache.image.data.length!==frame.data.length)cache.image=c.createImageData(sw,sh);
 const out=cache.image.data;out.set(frame.data);
 if(alpha<1)for(let k=0;k<out.length;k+=4){
  for(let ch=0;ch<3;ch++)out[k+ch]=original.data[k+ch]+(out[k+ch]-original.data[k+ch])*alpha;
  out[k+3]=original.data[k+3];
 }
 c.putImageData(cache.image,0,0);
 ctx.save();
 try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;ctx.drawImage(canvas,0,0,w,h);}
 finally{ctx.restore();}
 return true;
}
