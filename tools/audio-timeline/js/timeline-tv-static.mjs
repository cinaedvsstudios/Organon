/**
 * MotoriClip #59 — TV Static: seeded, independently changing per-pixel snow.
 *
 * Intentionally different from #53 Retro Glitch (which distorts the source
 * image and has CRT/tracking structure). No scrolling sheet, reused PNG or
 * frame counter: any absolute clip-relative time yields reproducible snow.
 * The standalone RGBA buffer stays partly transparent over real footage.
 */
const clamp=(value,min,max,fallback=min)=>{
 const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
};
const hash=(x,y,frame,seed,salt=0)=>{
 let v=(Math.imul(x+1,0x9e3779b1)^Math.imul(y+1,0x85ebca6b)
  ^Math.imul(frame+1,0xc2b2ae35)^Math.imul(seed+salt+1,0x27d4eb2f))>>>0;
 v^=v>>>16;v=Math.imul(v,0x7feb352d)>>>0;
 v^=v>>>15;v=Math.imul(v,0x846ca68b)>>>0;v^=v>>>16;
 return (v>>>0)/4294967296;
};
const sampleSettings=effect=>({
 opacity:clamp(effect.intensity??72,0,100)/100,
 density:clamp(effect.density??88,1,120)/120,
 brightness:clamp(effect.staticBrightness??52,0,100)*2.55,
 variance:clamp(effect.staticVariance??88,0,100)*2.55,
 color:effect.staticMode==='color',
 seed:Math.round(clamp(effect.staticSeed??59,0,99999))
});
/** 60 distinct snow updates/second, with stable rounding around frame edges. */
export function tvStaticFrameIndex(seconds=0){
 return Math.floor(Math.max(0,Number(seconds)||0)*60+1e-3);
}
/** Build real independent monochrome/colour snow pixels; optional reusable data. */
export function buildTVStaticFrame(width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(Number(width)||1)),h=Math.max(1,Math.round(Number(height)||1));
 const data=reuse?.length===w*h*4?reuse:new Uint8ClampedArray(w*h*4);
 const o=sampleSettings(effect),frame=tvStaticFrameIndex(seconds);
 const threshold=Math.pow(o.density,.9);
 for(let y=0;y<h;y++){
  const rowFlicker=.77+.23*hash(0,y,frame,o.seed,101);
  for(let x=0;x<w;x++){
   const n=(y*w+x)*4,gate=hash(x,y,frame,o.seed,0);
   if(gate>=threshold||o.opacity===0){
    data[n]=0;data[n+1]=0;data[n+2]=0;data[n+3]=0;continue;
   }
   const v1=hash(x,y,frame,o.seed,1),v2=hash(x,y,frame,o.seed,2);
   const v3=hash(x,y,frame,o.seed,3),alphaNoise=hash(x,y,frame,o.seed,4);
   const amplitude=o.variance*rowFlicker;
   const r=Math.round(clamp(o.brightness+(v1-.5)*2*amplitude,0,255));
   const g=o.color?Math.round(clamp(o.brightness+(v2-.5)*2*amplitude,0,255)):r;
   const b=o.color?Math.round(clamp(o.brightness+(v3-.5)*2*amplitude,0,255)):r;
   data[n]=r;data[n+1]=g;data[n+2]=b;
   // Real snow is never a single opaque frame-sized rectangle. Granular
   // alpha leaves varying amounts of existing video visible.
   data[n+3]=Math.round(255*o.opacity*(.24+.52*alphaNoise));
  }
 }
 return {width:w,height:h,data,frame};
}
const BUFFERS=new WeakMap();
function scratch(ctx,w,h){
 let item=BUFFERS.get(ctx);
 const ratio=Math.min(1,480/w,270/h),sw=Math.max(1,Math.round(w*ratio)),sh=Math.max(1,Math.round(h*ratio));
 if(!item){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas==='function'?new OffscreenCanvas(sw,sh):null;
  const painter=canvas?.getContext('2d');
  if(!painter)return null;
  item={canvas,painter,image:null};BUFFERS.set(ctx,item);
 }
 if(item.canvas.width!==sw||item.canvas.height!==sh){
  item.canvas.width=sw;item.canvas.height=sh;item.image=null;
 }
 if(!item.image)item.image=item.painter.createImageData(sw,sh);
 return item;
}
/** Fallback for canvas-less unit recorders; browser uses real pixel buffer. */
function fallback(ctx,w,h,e,t,opacity){
 const o=sampleSettings({...e,intensity:opacity*100});
 const frame=tvStaticFrameIndex(t),step=Math.max(2,Math.round(w/100));
 for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
  if(hash(x,y,frame,o.seed)>o.density)continue;
  const v=Math.round(clamp(o.brightness+(hash(x,y,frame,o.seed,1)-.5)*o.variance*2,0,255));
  ctx.fillStyle='rgba('+v+','+v+','+v+','+(.2+.5*o.opacity).toFixed(3)+')';
  ctx.fillRect(x,y,step,step);
 }
}
/** Identical compositor invocation for timeline scrub, preview and MP4. */
export function renderTVStatic(ctx,w,h,effect={},seconds=0,opacity){
 const strength=clamp(opacity===undefined?(effect.intensity??72)/100:opacity,0,1);
 if(strength===0)return true;
 const effective={...effect,intensity:strength*100};
 ctx.save();
 try{
  const item=scratch(ctx,w,h);
  if(!item)fallback(ctx,w,h,effective,seconds,strength);
  else{
   buildTVStaticFrame(item.canvas.width,item.canvas.height,effective,seconds,item.image.data);
   item.painter.putImageData(item.image,0,0);
   ctx.imageSmoothingEnabled=false;
   ctx.drawImage(item.canvas,0,0,w,h);
  }
 }finally{ctx.restore();}
 return true;
}
