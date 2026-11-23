/**
 * MotoriClip #64 — RGB Block Glitch.
 *
 * Rectangular islands of the REAL composited image briefly separate into
 * independently offset red, green and blue samples. Unlike Data Burst this
 * effect does not tint digital packets or manufacture corrupted pixel blocks;
 * unlike Signal Tear its isolated regions are rectangular, not torn rows.
 * Time and seed are the only motion inputs: backward seeks reproduce pixels.
 */
const clamp=(value,lo,hi,fallback=lo)=>{
 const n=Number(value);return Math.max(lo,Math.min(hi,Number.isFinite(n)?n:fallback));
};
function hash(a,b=0){
 let n=(Math.imul((a|0)+157,0x9e3779b1)^Math.imul((b|0)+113,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return n/4294967296;
}
function options(effect={}){
 return {
  strength:clamp(effect.intensity,0,100,91)/100,
  frequency:clamp(effect.density,1,120,63),
  displacement:clamp(effect.distortion,0,100,76)/100,
  width:clamp(effect.rgbBlockWidth,2,45,21)/100,
  height:clamp(effect.rgbBlockHeight,2,45,15)/100,
  separation:clamp(effect.rgbSeparation,0,100,78)/100,
  life:clamp(effect.rgbBlockLife,.06,.6,.23),
  seed:Math.round(clamp(effect.rgbBlockSeed,0,99999,6464))
 };
}
/** Independent seeded rectangular bursts with continuously changing chroma alignment. */
export function rgbBlockGlitchFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const p=options(effect),t=Math.max(0,Number(seconds)||0);
 const rate=3+p.frequency*.31,latest=Math.floor(t*rate);
 const lookback=Math.ceil(rate*p.life*1.8)+2,blocks=[];
 for(let event=Math.max(0,latest-lookback);event<=latest;event++){
  if(hash(event,p.seed+1)<.16)continue;
  const birth=(event+.36*hash(event,p.seed+2))/rate;
  const life=p.life*(.65+.7*hash(event,p.seed+3));
  const age=t-birth;if(age<0||age>=life)continue;
  const progress=age/life;
  const envelope=Math.pow(Math.sin(Math.PI*progress),.55);
  const companions=1+Math.floor(hash(event,p.seed+4)*3);
  for(let part=0;part<companions;part++){
   const key=event*7+part;
   const bw=Math.max(2,Math.min(w,Math.round(w*p.width*(.35+.8*hash(key,p.seed+5)))));
   const bh=Math.max(2,Math.min(h,Math.round(h*p.height*(.4+1.1*hash(key,p.seed+6)))));
   const x=Math.round((w-bw)*hash(key,p.seed+7));
   const y=Math.round((h-bh)*hash(key,p.seed+8));
   const phase=Math.floor(age*35);
   const pulse=.65+.35*hash(key,p.seed+phase+9);
   const direction=hash(key,p.seed+10)>.5?1:-1;
   const dx=Math.round((hash(key,p.seed+phase+11)-.5)*w*.24*p.displacement);
   const dy=Math.round((hash(key,p.seed+phase+12)-.5)*h*.13*p.displacement);
   const spread=Math.max(1,Math.round((1+w*.09)*p.separation));
   const redX=direction*spread*(.7+.6*hash(key,p.seed+13));
   const blueX=-direction*spread*(.7+.6*hash(key,p.seed+14));
   const redY=Math.round(spread*.40*(hash(key,p.seed+15)-.3));
   const blueY=Math.round(spread*.48*(hash(key,p.seed+16)-.6));
   blocks.push({x,y,w:bw,h:bh,dx,dy,redX:Math.round(redX),blueX:Math.round(blueX),
    redY,blueY,strength:envelope*pulse,key});
  }
 }
 return {width:w,height:h,time:t,params:p,blocks};
}
/** RGBA source transform: RGB comes solely from image pixels; alpha is untouched. */
export function buildRgbBlockGlitchFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const rgba=source?.data||source;
 if(!rgba||rgba.length!==w*h*4)throw Error('RGB Block Glitch requires matching RGBA source');
 const dst=reuse?.length===rgba.length&&reuse!==rgba?reuse:new Uint8ClampedArray(rgba.length);
 dst.set(rgba);
 const state=rgbBlockGlitchFrameState(w,h,effect,seconds),p=state.params;
 if(!p.strength||(!p.displacement&&!p.separation))return {width:w,height:h,data:dst,state};
 const sample=(x,y,c)=>rgba[(Math.max(0,Math.min(h-1,y))*w+
  Math.max(0,Math.min(w-1,x)))*4+c];
 for(const b of state.blocks){
  const amount=clamp(b.strength*p.strength,0,1);
  if(amount<.005)continue;
  for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++){
   const i=(y*w+x)*4;
   // Different source coordinates for each colour make real cyan/magenta/red
   // misregistration around objects without synthetic solid-colour packets.
   const red=sample(x+b.dx+b.redX,y+b.dy+b.redY,0);
   const green=sample(x+b.dx,y+b.dy,1);
   const blue=sample(x+b.dx+b.blueX,y+b.dy+b.blueY,2);
   dst[i]=rgba[i]+(red-rgba[i])*amount;
   dst[i+1]=rgba[i+1]+(green-rgba[i+1])*amount;
   dst[i+2]=rgba[i+2]+(blue-rgba[i+2])*amount;
   dst[i+3]=rgba[i+3];
  }
 }
 return {width:w,height:h,data:dst,state};
}
const SCRATCH=new WeakMap();
function scratch(ctx,w,h){
 let item=SCRATCH.get(ctx);
 const scale=Math.min(1,512/Math.max(w,h));
 const sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));
 if(!item){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(sw,sh):null;
  const c=canvas?.getContext('2d',{willReadFrequently:true});
  if(!canvas||!c)return null;
  item={canvas,c,image:null};SCRATCH.set(ctx,item);
 }
 if(item.canvas.width!==sw||item.canvas.height!==sh){
  item.canvas.width=sw;item.canvas.height=sh;item.image=null;
 }
 return item;
}
/** Shared live-preview/fixed-frame/real MP4 painter with bounded scratch. */
export function renderRgbBlockGlitch(ctx,source,width,height,effect={},seconds=0,amount=1){
 const a=clamp(amount,0,1,1);if(a<=0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const item=source&&scratch(ctx,w,h);if(!item)return false;
 const {canvas,c}=item,sw=canvas.width,sh=canvas.height;
 c.setTransform?.(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';
 c.clearRect(0,0,sw,sh);c.drawImage(source,0,0,sw,sh);
 let original;try{original=c.getImageData(0,0,sw,sh);}catch{return false;}
 const frame=buildRgbBlockGlitchFrame(original,sw,sh,{...effect,intensity:100},seconds,item.image?.data);
 if(!item.image||item.image.data?.length!==frame.data.length)item.image=c.createImageData(sw,sh);
 const dst=item.image.data;dst.set(frame.data);
 if(a<1)for(let i=0;i<dst.length;i+=4){
  dst[i]=original.data[i]+(dst[i]-original.data[i])*a;
  dst[i+1]=original.data[i+1]+(dst[i+1]-original.data[i+1])*a;
  dst[i+2]=original.data[i+2]+(dst[i+2]-original.data[i+2])*a;
  dst[i+3]=original.data[i+3];
 }
 c.putImageData(item.image,0,0);
 ctx.save();try{
  ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;
  ctx.drawImage(canvas,0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
