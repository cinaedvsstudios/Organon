/**
 * MotoriClip #63 — Signal Tear / discontinuous displaced video fragments.
 *
 * This is NOT #60 analogue rolling-sync interference (no rolling bands,
 * blackouts or RGB smear) and NOT #62 RGB packet corruption. A few discrete,
 * time-limited horizontal slices of the REAL source frame jump sideways or
 * borrow rows from elsewhere, breaking the image at sharp partial-frame seams.
 * Every fragment is generated from clip-relative time and a saved seed.
 */
const clamp=(v,lo,hi,fallback=lo)=>Math.max(lo,Math.min(hi,Number.isFinite(Number(v))?Number(v):fallback));
function hash(a,b=0){
 let n=(Math.imul((a|0)+67,0x9e3779b1)^Math.imul((b|0)+29,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;
 n^=n>>>16;return (n>>>0)/4294967296;
}
function params(e={}){
 return {
  strength:clamp(e.intensity,0,100,88)/100,
  density:clamp(e.density,1,120,72),
  horizontal:clamp(e.distortion,0,100,72)/100,
  height:clamp(e.tearHeight,1,30,9)/100,
  fragments:clamp(e.tearFragment,0,100,68)/100,
  life:clamp(e.tearLife,.06,.6,.17),
  seed:Math.round(clamp(e.tearSeed,0,99999,6363))
 };
}
/**
 * Spatially and temporally independent tear events. The event schedule is
 * deterministic yet not visually periodic due to per-event birth/lifetime,
 * active probability, y position and independent fragment subdivisions.
 */
export function signalTearFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const p=params(effect),t=Math.max(0,Number(seconds)||0);
 const rate=2.5+p.density*.17,latest=Math.floor(t*rate);
 const history=Math.ceil(rate*p.life*1.6)+2,tears=[];
 for(let event=Math.max(0,latest-history);event<=latest;event++){
  if(hash(event,p.seed+1)<.21)continue; // gaps between discrete sync failures
  const birth=(event+.18*hash(event,p.seed+2))/rate;
  const life=p.life*(.6+.8*hash(event,p.seed+3));
  const age=t-birth;if(age<0||age>=life)continue;
  const fade=Math.pow(Math.sin(Math.PI*age/life),.58);
  const count=1+Math.floor((1+3*p.fragments)*hash(event,p.seed+4));
  const center=Math.round((.08+.84*hash(event,p.seed+5))*h);
  for(let part=0;part<count;part++){
   const key=event*13+part;
   const thick=Math.max(2,Math.round(h*p.height*(.13+.34*hash(key,p.seed+7))));
   const across=Math.round((hash(key,p.seed+8)-.5)*h*p.height*(1+3*p.fragments));
   const top=Math.max(0,Math.min(h-thick,center+across));
   const startX=Math.round(hash(key,p.seed+9)*w*.38);
   const length=Math.max(3,Math.round(w*(.30+.60*hash(key,p.seed+10))));
   const endX=Math.min(w,startX+length);
   const horizontal=Math.round((hash(key,p.seed+11)-.5)*w*(.08+.44*p.horizontal));
   const vertical=Math.round((hash(key,p.seed+12)-.5)*h*.18*p.fragments);
   const microSteps=2+Math.floor(hash(key,p.seed+13)*4);
   const blink=.45+.55*hash(key,Math.floor(t*29)+p.seed+14);
   tears.push({top,bottom:Math.min(h,top+thick),startX,endX,horizontal,vertical,
    microSteps,amount:fade*blink,key});
  }
 }
 return {width:w,height:h,time:t,rate,params:p,tears};
}
/** Frame-local deterministic RGBA transform. Never changes source alpha. */
export function buildSignalTearFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const pixels=source?.data||source;
 if(!pixels||pixels.length!==w*h*4)throw Error('Signal Tear requires matching source RGBA');
 const dst=reuse?.length===pixels.length&&reuse!==pixels?reuse:new Uint8ClampedArray(pixels.length);
 dst.set(pixels);
 const state=signalTearFrameState(w,h,effect,seconds),p=state.params;
 if(!p.strength||!p.horizontal)return {width:w,height:h,data:dst,state};
 const pos=(x,y,c)=>(Math.max(0,Math.min(h-1,y))*w+Math.max(0,Math.min(w-1,x)))*4+c;
 for(const tear of state.tears){
  const alpha=clamp(tear.amount*p.strength,0,1);
  if(alpha<.005)continue;
  const span=Math.max(1,tear.bottom-tear.top);
  for(let y=tear.top;y<tear.bottom;y++){
   // Every short row fragment has a slightly different horizontal offset:
   // hard video discontinuities, not a globally travelling sine-wave warp.
   const step=Math.floor((y-tear.top)*tear.microSteps/span);
   const jog=Math.round((hash(tear.key,step+p.seed+18)-.5)*w*.055*p.horizontal);
   const offset=tear.horizontal+jog;
   const borrowedRow=Math.max(0,Math.min(h-1,y+tear.vertical+(step%2===0?0:Math.round(span*.3))));
   const edge=(y===tear.top||y===tear.bottom-1);
   for(let x=tear.startX;x<tear.endX;x++){
    const i=(y*w+x)*4,s=pos(x+offset,borrowedRow,0);
    // A dark/bright discontinuity line follows the edges of a real displaced
    // source slice; it is not random snow or a coloured digital packet.
    const seam=edge?(step%2===0?.42:1.17):1;
    for(let c=0;c<3;c++){
     const rgb=clamp(pixels[s+c]*seam,0,255);
     dst[i+c]=pixels[i+c]+(rgb-pixels[i+c])*alpha;
    }
    dst[i+3]=pixels[i+3];
   }
  }
 }
 return {width:w,height:h,data:dst,state};
}
const SCRATCH=new WeakMap();
function scratch(ctx,w,h){
 let item=SCRATCH.get(ctx);
 const factor=Math.min(1,512/Math.max(w,h));
 const sw=Math.max(1,Math.round(w*factor)),sh=Math.max(1,Math.round(h*factor));
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
/** The same render function handles editor playback and exported frames. */
export function renderSignalTear(ctx,source,width,height,effect={},seconds=0,amount=1){
 const a=clamp(amount,0,1,1);
 if(a<=0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const item=source&&scratch(ctx,w,h);if(!item)return false;
 const {canvas,c}=item,sw=canvas.width,sh=canvas.height;
 c.setTransform?.(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';
 c.clearRect(0,0,sw,sh);c.drawImage(source,0,0,sw,sh);
 let original;try{original=c.getImageData(0,0,sw,sh);}catch{return false;}
 // Effect intensity is already folded into compositor's 'amount' argument.
 const frame=buildSignalTearFrame(original,sw,sh,{...effect,intensity:100},seconds,item.image?.data);
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
