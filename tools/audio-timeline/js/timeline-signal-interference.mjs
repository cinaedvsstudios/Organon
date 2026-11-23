/**
 * MotoriClip #60 — Signal Interference / analogue sync failure.
 *
 * Distinct from #53 Retro Glitch (fine CRT snow, flutter and many tears)
 * and #59 TV Static (fresh random per-pixel noise). This resamples actual
 * lower-track pixels through slowly travelling horizontal sync bands, uneven
 * image displacement, RGB bleed and rare brief partial/full signal outages.
 *
 * Pure function of clip-relative time, seed and saved settings. Preview and
 * fixed-frame exports use this identical painter. No wall clock or mutable
 * animation counters; per-canvas scratch storage is bounded.
 */
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number.isFinite(+n)?+n:min));
const wrap=n=>((n%1)+1)%1;
const tri=n=>Math.max(0,1-Math.abs(n*2-1));
function hash(a,b=0,c=0){
 let n=(Math.imul((a|0)+1,0x9e3779b1)
  ^Math.imul((b|0)+31,0x85ebca6b)
  ^Math.imul((c|0)+117,0xc2b2ae35))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;
 n^=n>>>16;
 return (n>>>0)/4294967296;
}
function params(e={}){
 return {
  strength:clamp(e.intensity??76,0,100)/100,
  distortion:clamp(e.distortion??70,0,100)/100,
  density:clamp(e.density??68,1,120)/120,
  signalLoss:clamp(e.signalLoss??56,0,100)/100,
  colorBleed:clamp(e.colorBleed??64,0,100)/100,
  rollRate:clamp(e.rollRate??1.1,.1,5),
  seed:Math.round(clamp(e.signalSeed??6060,0,99999))
 };
}
/** Independent moving bands with stochastic amplitude and event lifetimes. */
export function signalInterferenceFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const o=params(effect),t=Math.max(0,Number(seconds)||0),seed=o.seed;
 const burstIndex=Math.floor(t*3.1),burstProgress=wrap(t*3.1);
 const burst=hash(seed,burstIndex,29)>.37;
 const burstEnvelope=burst?Math.min(1,burstProgress*10,(1-burstProgress)*8):.10;
 const lost=hash(seed,burstIndex,39)>.81&&burstProgress<.20
  ? o.signalLoss*(.48+.52*(1-burstProgress/.20)):0;
 const bands=[];
 for(let i=0;i<7;i++){
  const rate=(.09+.24*hash(seed,i,8))*o.rollRate;
  const center=wrap(hash(seed,i,13)+t*rate)*h;
  const radius=h*(.026+.055*hash(seed,i,19))*(.65+o.density*.9);
  const segment=Math.floor(t*(3.7+hash(seed,i,23)*3.4));
  const active=hash(seed^i,segment,31)<(.40+.52*o.density);
  const shift=(hash(seed^i,segment,44)-.5)*w*(.045+.20*o.distortion)*o.strength;
  const darkness=(.12+.68*hash(seed^i,segment,49))*o.signalLoss*o.strength;
  const bleed=(hash(seed^i,segment,52)-.5)*w*.032*o.colorBleed*o.strength;
  bands.push({center,radius,rate,active,shift,darkness,bleed});
 }
 const roll=wrap(hash(seed,2,7)+t*.21*o.rollRate)*h;
 return {w,h,time:t,burstIndex,burstEnvelope,lost,roll,bands,params:o};
}
/**
 * Source-aware RGBA signal reconstruction. Alpha is preserved at the original
 * output coordinate, so semitransparent source layers remain semitransparent.
 */
export function buildSignalInterferenceFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const input=source?.data||source;
 if(!input||input.length!==w*h*4)throw Error('Signal Interference needs source RGBA');
 const out=reuse?.length===input.length&&reuse!==input?reuse:new Uint8ClampedArray(input.length);
 const s=signalInterferenceFrameState(w,h,effect,seconds),o=s.params,t=s.time;
 const rollingWidth=h*(.035+.08*o.density);
 const blackout=Math.min(.96,s.lost*o.strength);
 for(let y=0;y<h;y++){
  const droll=Math.min(Math.abs(y-s.roll),h-Math.abs(y-s.roll));
  const rolling=Math.max(0,1-droll/rollingWidth);
  const rowY=y/h;
  let shift=w*.003*o.strength*o.distortion*Math.sin(rowY*31+t*4.3+o.seed*.001);
  let bleed=w*.003*o.colorBleed*Math.sin(t*3.3+y*.11);
  let dropout=rolling*.34*o.signalLoss*o.strength;
  let displaced=rolling*.12*o.distortion*o.strength;
  for(const b of s.bands){
   if(!b.active)continue;
   const delta=Math.min(Math.abs(y-b.center),h-Math.abs(y-b.center));
   if(delta>=b.radius)continue;
   const envelope=1-delta/b.radius;
   const pulse=envelope*envelope*(.35+.65*s.burstEnvelope);
   shift+=b.shift*pulse;
   bleed+=b.bleed*pulse;
   dropout+=b.darkness*pulse;
   displaced+=pulse;
  }
  const tear=Math.round(shift);
  const chroma=Math.round(bleed);
  // Broad rolling interference darkens the video, not a thin scanline filter.
  const flicker=1+.035*o.strength*Math.sin(t*17+rowY*3.1+o.seed);
  const signal=Math.max(.02,Math.min(1.13,flicker*(1-blackout)*(1-Math.min(.92,dropout))));
  const blurMix=clamp(o.colorBleed*(.14+.26*Math.min(1,displaced)),0,.6);
  for(let x=0;x<w;x++){
   const dest=(y*w+x)*4,xx=Math.round(clamp(x+tear,0,w-1));
   const redX=Math.round(clamp(xx+chroma,0,w-1));
   const blueX=Math.round(clamp(xx-chroma,0,w-1));
   const base=(y*w+xx)*4,r=(y*w+redX)*4,b=(y*w+blueX)*4;
   // Chromatic bleed is a smeared, offset copy of actual video pixels.
   const ghostR=input[(y*w+Math.round(clamp(redX+Math.max(1,w*.012),0,w-1)))*4];
   const ghostB=input[(y*w+Math.round(clamp(blueX-Math.max(1,w*.012),0,w-1)))*4+2];
   out[dest]=clamp((input[r]*(1-blurMix)+ghostR*blurMix)*signal,0,255);
   out[dest+1]=clamp(input[base+1]*signal,0,255);
   out[dest+2]=clamp((input[b+2]*(1-blurMix)+ghostB*blurMix)*signal,0,255);
   out[dest+3]=input[dest+3];
  }
 }
 return {width:w,height:h,data:out,state:s};
}
const SCRATCH=new WeakMap();
function scratchFor(ctx,width,height){
 let pair=SCRATCH.get(ctx);
 const factor=Math.min(1,384/Math.max(width,height));
 const w=Math.max(1,Math.round(width*factor)),h=Math.max(1,Math.round(height*factor));
 if(!pair){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
  const context=canvas?.getContext('2d',{willReadFrequently:true});
  if(!canvas||!context)return null;
  pair={canvas,context,data:null};
  SCRATCH.set(ctx,pair);
 }
 if(pair.canvas.width!==w||pair.canvas.height!==h){
  pair.canvas.width=w;pair.canvas.height=h;pair.data=null;
 }
 return pair;
}
function drawFallback(ctx,source,w,h,s,alpha){
 // Source-aware Canvas fallback, not a fabricated full-frame random texture.
 if(!source)return false;
 ctx.save();
 try{
  ctx.globalAlpha=alpha;
  ctx.drawImage(source,0,0,w,h);
  for(const band of s.bands){
   if(!band.active)continue;
   const srcY=Math.max(0,band.center-band.radius);
   const bh=Math.min(h-srcY,band.radius*2);
   if(bh<1)continue;
   ctx.drawImage(source,0,srcY,w,bh,band.shift,srcY,w,bh);
   ctx.fillStyle='rgba(3,7,14,'+(band.darkness*.58).toFixed(4)+')';
   ctx.fillRect(0,srcY,w,bh);
  }
  ctx.fillStyle='rgba(0,0,0,'+(Math.min(.85,s.lost*s.params.strength)).toFixed(4)+')';
  ctx.fillRect(0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
export function renderSignalInterference(ctx,source,width,height,effect={},seconds=0,amount=1){
 const a=clamp(amount,0,1);
 if(a<=0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const scratch=scratchFor(ctx,w,h);
 if(source&&scratch){
  const c=scratch.context,sw=scratch.canvas.width,sh=scratch.canvas.height;
  c.setTransform?.(1,0,0,1,0,0);
  c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';
  c.clearRect(0,0,sw,sh);c.drawImage(source,0,0,sw,sh);
  let sourceImage=null;
  try{sourceImage=c.getImageData(0,0,sw,sh);}catch(error){
   console.warn('Signal Interference source pixels inaccessible; using source-band fallback:',error);
  }
  if(sourceImage){
   const result=buildSignalInterferenceFrame(sourceImage,sw,sh,effect,seconds,scratch.data?.data);
   if(!scratch.data||scratch.data.data.length!==result.data.length)
    scratch.data=c.createImageData(sw,sh);
   scratch.data.data.set(result.data);
   c.putImageData(scratch.data,0,0);
   ctx.imageSmoothingEnabled=true;
   ctx.drawImage(scratch.canvas,0,0,w,h);
   return true;
  }
 }
 const state=signalInterferenceFrameState(w,h,effect,seconds);
 return drawFallback(ctx,source,w,h,state,a);
}
