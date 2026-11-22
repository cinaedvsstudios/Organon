/**
 * MotoriClip #53 — Retro Glitch: independently changing analogue CRT signal.
 *
 * Real lower-track source pixels are resampled with multiple asynchronous
 * rolling tears, independently seeded pixel snow, imperfect moving scanlines,
 * three-channel misregistration, brightness flutter, and brief dropouts.
 * This is not a still texture translated behind one moving band.
 *
 * The output is a pure function of absolute clip-relative time and normalized
 * effect settings. A single bounded scratch canvas is reused per compositor.
 */
const clip=(x,a,b)=>x<a?a:x>b?b:x;
const wrap=x=>((x%1)+1)%1;
function hash(a,b=0,c=0){
 let n=(Math.imul((a|0)+1,0x9e3779b1)
       ^Math.imul((b|0)+19,0x85ebca6b)
       ^Math.imul((c|0)+71,0xc2b2ae35))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;
 n^=n>>>16;
 return (n>>>0)/4294967296;
}
const phase=(v)=>.5+.5*Math.sin(v);
const rgbFromHex=s=>{
 const h=/^#[\da-f]{6}$/i.test(String(s))?String(s).slice(1):'89d6eb';
 return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
};
function settings(e={}){
 return {
  strength:clip(Number(e.intensity??70)/100,0,1),
  distortion:clip(Number(e.distortion??55)/100,0,1),
  density:clip(Number(e.density??48)/120,.0083,1),
  scale:clip(Number(e.scale??100)/100,.1,3),
  direction:clip(Number(e.direction??0)/180,-1,1),
  originX:clip(Number(e.originX??20)/100,0,1),
  originY:clip(Number(e.originY??12)/100,0,1),
  glow:clip(Number(e.glow??64)/100,0,1),
  color:rgbFromHex(e.color)
 };
}
/** Independent scan-band histories; no band shares the same periodic clock. */
export function retroGlitchFrameState(width,height,effect={},time=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const o=settings(effect),t=Math.max(0,Number(time)||0);
 const frame=Math.floor(t*(26+10*o.density)),q=Math.floor(t*(2.8+o.distortion));
 const bands=[];
 for(let i=0;i<7;i++){
  const rate=.16+hash(i,28)*.7+o.direction*.075;
  const y=wrap(hash(i,36)+t*rate)*h;
  const size=h*(.018+.042*hash(i,39))*(.72+.55*o.scale);
  const local=Math.floor(t*(5.5+hash(i,70)*4));
  const active=hash(i,local,57)>.21;
  const drift=(hash(i,local,65)-.5)*w*(.055+.19*o.distortion)*o.strength;
  const channel=(hash(i,local,71)-.5)*w*.015*(.4+o.distortion);
  bands.push({id:i,y,size,rate,active,drift,channel,phase:hash(i,local,79)});
 }
 const brightness=1+o.strength*(.11*Math.sin(t*13+o.originY*7)
  +.07*(hash(q,21,8)-.5));
 return {w,h,frame,brightness,bands,
  redOffset:(.5+o.distortion*3.6)*Math.sin(t*6.9+o.originX*8),
  blueOffset:(.7+o.distortion*4.5)*Math.sin(t*5.3+2.1-o.originX*6),
  frameDrop:hash(q,8,64)>.955,
  settings:o};
}
/**
 * One pure low-resolution RGBA signal-reconstruction frame. Keeps the source
 * alpha, but independently shifts its red and blue components and introduces
 * locally seeded CRT snow/tear/darkening/rolling scanline variation.
 */
export function buildRetroGlitchFrame(source,width,height,effect={},time=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const input=source?.data||source;
 if(!input||input.length!==w*h*4)throw Error('Retro Glitch needs a matching source RGBA buffer');
 const output=reuse?.length===input.length&&reuse!==input?
  reuse:new Uint8ClampedArray(input.length);
 const state=retroGlitchFrameState(w,h,effect,time),o=state.settings,t=Math.max(0,Number(time)||0);
 const amplitude=o.strength*(.35+.65*o.distortion);
 const snowLevel=(.11+.38*o.density)*amplitude;
 const darkLine=.09+.34*amplitude;
 const tint=o.color;
 for(let y=0;y<h;y++){
  const sy=y/h,scanLine=Math.sin(y*(2.9/o.scale)+t*19+sy*13);
  const scanWave=.5+.5*Math.sin(y*.61-t*13+hash(y,13)*5.4);
  const flicker=state.brightness*(1-darkLine*scanWave*(.62+.38*scanLine));
  const rowGhost=Math.sin(y*.17+t*(2.4+o.direction*.7))*w*.004*amplitude;
  let tearShift=0,redShift=state.redOffset,blueShift=state.blueOffset;
  let dropout=0;
  for(const band of state.bands){
   if(!band.active)continue;
   const distance=Math.abs(y-band.y);
   if(distance<band.size){
    const strength=1-distance/band.size;
    tearShift+=band.drift*strength;
    redShift+=band.channel*strength;
    blueShift-=band.channel*strength;
    dropout+=strength*band.phase*.33*amplitude;
   }
  }
  const rowOffset=Math.round(tearShift+rowGhost);
  const red=Math.round(redShift),blue=Math.round(blueShift);
  const frameLoss=state.frameDrop?(.09+.14*phase(y*.22+t*18)):0;
  for(let x=0;x<w;x++){
   const dest=(y*w+x)*4;
   const sx=clip(x+rowOffset,0,w-1),
    rX=clip(sx+red,0,w-1),bX=clip(sx+blue,0,w-1);
   const base=(y*w+sx)*4;
   // Separate temporal hash for EACH individual source pixel. The grain is
   // not one bitmap translated across the screen or a repeated horizontal bar.
   const n=hash(x,y,state.frame);
   const n2=hash(x+53,y+17,state.frame+37);
   const snow=(n-.5)*255*snowLevel*1.7;
   const burst=n2<o.density*.095*amplitude;
   const burstValue=burst?(n>.5?92:-78)*amplitude:0;
   const brightness=flicker*(1-dropout-frameLoss);
   const tintAmount=o.glow*.045*amplitude;
   output[dest]=clip(
    input[(y*w+rX)*4]*brightness+snow+burstValue+ tint[0]*tintAmount,0,255);
   output[dest+1]=clip(
    input[base+1]*brightness+snow*.91+burstValue*.55+tint[1]*tintAmount,0,255);
   output[dest+2]=clip(
    input[(y*w+bX)*4+2]*brightness+snow*1.04-burstValue*.38+tint[2]*tintAmount,0,255);
   output[dest+3]=input[dest+3]; // Preserve each source pixel's transparency
  }
 }
 return {width:w,height:h,data:output,state};
}
const SCRATCH=new WeakMap();
function getScratch(ctx,w,h,e){
 let item=SCRATCH.get(ctx);
 const sw=Math.max(1,Math.round(Math.max(1,w)*Math.min(1,384/Math.max(w,h)))),
  sh=Math.max(1,Math.round(Math.max(1,h)*Math.min(1,384/Math.max(w,h))));
 if(!item){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(sw,sh):null;
  const context=canvas?.getContext('2d',{willReadFrequently:true});
  if(!canvas||!context)return null;
  item={canvas,context,data:null};SCRATCH.set(ctx,item);
 }
 if(item.canvas.width!==sw||item.canvas.height!==sh){
  item.canvas.width=sw;item.canvas.height=sh;item.data=null;
 }
 if(!item.data)item.data=item.context.createImageData?.(sw,sh)||null;
 return item;
}
/** Schematic only if source pixels cannot be read, never used as real video. */
function diagnostic(ctx,w,h,e,t,amount){
 const o=settings(e),state=retroGlitchFrameState(w,h,e,t);
 for(let i=0;i<28;i++){
  const y=wrap(hash(i,32)+t*(.07+hash(i,34)*.14))*h;
  const x=hash(i,45)*w;
  ctx.fillStyle=i%3===0?'rgba(114,218,240,.23)':'rgba(235,235,234,.26)';
  ctx.fillRect(x,y,Math.max(2,w*(.025+.09*hash(i,48))),Math.max(1,h*.004));
 }
 for(const band of state.bands){
  if(!band.active)continue;
  ctx.fillStyle='rgba(201,225,239,'+(amount*.10).toFixed(3)+')';
  ctx.fillRect(0,band.y,w,Math.max(1,band.size*.25));
 }
 const line=Math.max(1,h*.012);
 ctx.fillStyle='rgba(2,8,13,'+(amount*.19).toFixed(3)+')';
 for(let y=0;y<h;y+=line*2.7)ctx.fillRect(0,y,w,line*.54);
}
/** One shared preview/export painter; no still texture, no frame counters. */
export function renderRetroGlitch(ctx,source,w,h,e={},time=0,amount=1){
 const opacity=clip(Number(amount),0,1);
 if(opacity<=0)return true;
 const t=Math.max(0,Number(time)||0);
 const item=getScratch(ctx,w,h,e);
 if(source&&item&&typeof item.context.drawImage==='function'){
  const c=item.context,sw=item.canvas.width,sh=item.canvas.height;
  c.setTransform?.(1,0,0,1,0,0);
  c.globalCompositeOperation='source-over';c.globalAlpha=1;
  c.imageSmoothingEnabled=false;c.filter='none';
  c.clearRect(0,0,sw,sh);c.drawImage(source,0,0,sw,sh);
  let pixels=null;
  try{pixels=c.getImageData?.(0,0,sw,sh);}catch{/* tainted media: fallback */}
  if(pixels?.data?.length===sw*sh*4&&typeof c.putImageData==='function'){
   const result=buildRetroGlitchFrame(pixels,sw,sh,e,t,item.data?.data);
   if(!item.data||item.data.data?.length!==result.data.length){
    item.data=c.createImageData(sw,sh);
   }
   item.data.data.set(result.data);
   c.putImageData(item.data,0,0);
  }
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(item.canvas,0,0,w,h);
  return true;
 }
 // Headless/no-source preview remains moving; actual footage always uses RGBA.
 diagnostic(ctx,w,h,e,t,opacity);
 return true;
}
