/**
 * MotoriClip #61 — fine CRT raster / phosphor structure.
 *
 * A source-aware postprocess, NOT white noise (#59), source tearing (#60)
 * or the heavy glitch compositor (#53). Preserves source pixels' alpha,
 * applies fine horizontal beam-blanking, RGB phosphor grille, subtle rolling
 * luminance interference and deterministic temporal flicker. No frame counters.
 */
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):min));
const wrap=v=>((v%1)+1)%1;
function hash(a,b=0){
 let x=(Math.imul((a|0)+1,0x9e3779b1)^Math.imul((b|0)+97,0x85ebca6b))>>>0;
 x^=x>>>16;x=Math.imul(x,0x7feb352d)>>>0;
 x^=x>>>15;x=Math.imul(x,0x846ca68b)>>>0;
 x^=x>>>16;return x/4294967296;
}
function cfg(e={}){
 return {
  strength:clamp(e.intensity??85,0,100)/100,
  pitch:clamp(e.linePitch??3,1.5,12),
  opacity:clamp(e.lineOpacity??61,0,100)/100,
  grid:clamp(e.gridStrength??38,0,100)/100,
  flicker:clamp(e.flickerStrength??35,0,100)/100,
  roll:clamp(e.crtRollRate??.75,0,4),
  seed:Math.round(clamp(e.scanSeed??6161,0,99999))
 };
}
/** Separate continuous beam motion, 60Hz jitter, rolling intensity envelope. */
export function crtScanlineFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const o=cfg(effect),time=Math.max(0,Number(seconds)||0),frame=Math.floor(time*60);
 const wobble=hash(o.seed,frame)-.5;
 const beamPhase=time*.17*o.roll+hash(o.seed,11);
 const rollY=wrap(hash(o.seed,22)+time*.13*o.roll)*h;
 const pulse=1-o.flicker*o.strength*(.025+.045*(.5+.5*Math.sin(time*12.7+o.seed*.01))+.018*wobble);
 return {w,h,time,frame,rollY,beamPhase,pulse,params:o};
}
/** Pure source RGBA raster. Preserves each source alpha byte exactly. */
export function buildCRTScanlinesFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height)),pixels=source?.data||source;
 if(!pixels||pixels.length!==w*h*4)throw Error('CRT Scanlines needs matching source RGBA');
 const output=reuse?.length===pixels.length&&reuse!==pixels?reuse:new Uint8ClampedArray(pixels.length);
 const state=crtScanlineFrameState(w,h,effect,seconds),o=state.params;
 // R/G/B phosphor grille is deliberately stationary relative to source;
 // only the beam phase, global flicker and very faint rolling interference evolve.
 const gridScale=.14*o.grid*o.strength;
 const yFactor=new Float32Array(h);
 for(let y=0;y<h;y++){
  const band=.5+.5*Math.cos(2*Math.PI*(y/o.pitch+state.beamPhase));
  const gap=Math.pow(band,5);
  const d=Math.min(Math.abs(y-state.rollY),h-Math.abs(y-state.rollY));
  const drift=Math.max(0,1-d/Math.max(2,h*.045));
  const roll=1-.13*drift*o.flicker*o.strength;
  yFactor[y]=clamp((1-(.08+.64*gap)*o.opacity*o.strength)*state.pulse*roll,0,1.08);
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,lum=yFactor[y];
  // Tiny RGB phosphor subpixels: each stripe favours its own channel,
  // without an RGB digital block glitch or horizontal source displacement.
  const stripe=x%3;
  const maskR=1-(stripe===0?0:gridScale);
  const maskG=1-(stripe===1?0:gridScale);
  const maskB=1-(stripe===2?0:gridScale);
  output[i]=clamp(pixels[i]*lum*maskR,0,255);
  output[i+1]=clamp(pixels[i+1]*lum*maskG,0,255);
  output[i+2]=clamp(pixels[i+2]*lum*maskB,0,255);
  output[i+3]=pixels[i+3];
 }
 return {width:w,height:h,data:output,state};
}
const SCRATCH=new WeakMap();
function scratch(ctx,w,h){
 let item=SCRATCH.get(ctx);
 const f=Math.min(1,512/Math.max(w,h)),sw=Math.max(1,Math.round(w*f)),sh=Math.max(1,Math.round(h*f));
 if(!item){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(sw,sh):null;
  const c=canvas?.getContext('2d',{willReadFrequently:true});
  if(!canvas||!c)return null;
  item={canvas,context:c,image:null};SCRATCH.set(ctx,item);
 }
 if(item.canvas.width!==sw||item.canvas.height!==sh){
  item.canvas.width=sw;item.canvas.height=sh;item.image=null;
 }
 return item;
}
function diagnostic(ctx,source,w,h,e,time,amount){
 const s=crtScanlineFrameState(w,h,e,time),o=s.params;
 ctx.save();
 try{
  ctx.globalAlpha=amount;
  if(source)ctx.drawImage(source,0,0,w,h);
  const alpha=.08+.36*o.opacity*o.strength;
  const pitch=Math.max(2,Math.round(o.pitch));
  ctx.fillStyle='rgba(0,0,0,'+alpha.toFixed(3)+')';
  for(let y=(s.beamPhase*pitch)%pitch;y<h;y+=pitch)ctx.fillRect(0,y,w,Math.max(1,pitch*.28));
  ctx.fillStyle='rgba(160,202,224,'+Math.min(.1,.04*o.flicker*o.strength).toFixed(3)+')';
  ctx.fillRect(0,s.rollY,w,Math.max(1,h*.025));
 }finally{ctx.restore();}
 return true;
}
/** Single painter for live editor and fixed-frame MP4 export. */
export function renderCRTScanlines(ctx,source,width,height,effect={},seconds=0,amount=1){
 const a=clamp(amount,0,1);
 if(a<=0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const item=scratch(ctx,w,h);
 if(!source||!item)return diagnostic(ctx,source,w,h,effect,seconds,a);
 const {canvas,context}=item,sw=canvas.width,sh=canvas.height;
 context.setTransform?.(1,0,0,1,0,0);
 context.globalAlpha=1;context.globalCompositeOperation='source-over';context.filter='none';
 context.clearRect(0,0,sw,sh);context.drawImage(source,0,0,sw,sh);
 let sourceImage;
 try{sourceImage=context.getImageData(0,0,sw,sh);}catch{
  return diagnostic(ctx,source,w,h,effect,seconds,a);
 }
 const result=buildCRTScanlinesFrame(sourceImage,sw,sh,effect,seconds,item.image?.data);
 if(!item.image||item.image.data?.length!==result.data.length)
  item.image=context.createImageData(sw,sh);
 const dst=item.image.data;dst.set(result.data);
 if(a<1)for(let i=0;i<dst.length;i+=4){
  dst[i]=sourceImage.data[i]+(dst[i]-sourceImage.data[i])*a;
  dst[i+1]=sourceImage.data[i+1]+(dst[i+1]-sourceImage.data[i+1])*a;
  dst[i+2]=sourceImage.data[i+2]+(dst[i+2]-sourceImage.data[i+2])*a;
  dst[i+3]=sourceImage.data[i+3];
 }
 context.putImageData(item.image,0,0);
 ctx.save();
 try{
  // Copy rather than layering fractional-alpha sources: preserve alpha.
  ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(canvas,0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
