/**
 * MotoriClip #62 — Data Burst.
 * Glitching source-video *blocks*, not full-frame static, scanlines or global
 * horizontal-sync loss. Independent, short-lived seeded pixel corruption
 * clusters use absolute clip time so reverse seeking and MP4 agree with preview.
 */
const clamp=(v,lo,hi,d=lo)=>Math.max(lo,Math.min(hi,Number.isFinite(Number(v))?Number(v):d));
function hash(a,b=0){
 let n=(Math.imul((a|0)+31,0x9e3779b1)^Math.imul((b|0)+211,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;
 n^=n>>>16;return (n>>>0)/4294967296;
}
const options=(e={})=>({
 strength:clamp(e.intensity,0,100,84)/100,
 density:clamp(e.density,1,120,46),
 size:clamp(e.burstSize,5,100,48)/100,
 life:clamp(e.burstLife,.06,.6,.23),
 cluster:clamp(e.burstCluster,0,100,67)/100,
 chroma:clamp(e.burstChroma,0,100,72)/100,
 seed:Math.round(clamp(e.burstSeed,0,99999,6262))
});
/**
 * Generate spatially distinct blocks. One event may create a small cluster;
 * unrelated events spawn independently across the entire video, not in rows.
 * An event's visibility is controlled by its own lifetime and per-slot blink.
 */
export function dataBurstFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const p=options(effect),t=Math.max(0,Number(seconds)||0);
 const rate=7+p.density*.63,at=Math.floor(t*rate);
 const lookback=Math.ceil(rate*p.life)+2,blocks=[];
 for(let event=Math.max(0,at-lookback);event<=at;event++){
  const birth=(event+.2*hash(event,p.seed+1))/rate;
  const life=p.life*(.55+.9*hash(event,p.seed+2));
  const age=t-birth;if(age<0||age>=life)continue;
  const fade=Math.pow(Math.sin(Math.PI*age/life),.7);
  // Each active event blinks independently; the short fade is never a
  // stationary, screen-wide flashing layer.
  const blink=.55+.45*hash(event,p.seed+Math.floor(t*37)+9);
  const cx=hash(event,p.seed+3)*w,cy=hash(event,p.seed+4)*h;
  const companions=Math.round(3*p.cluster*hash(event,p.seed+5));
  for(let part=0;part<=companions;part++){
   const key=event*7+part, satellite=part>0;
   const spread=(1-p.cluster*.78);
   const offX=satellite?(hash(key,p.seed+12)-.5)*w*.55*spread:0;
   const offY=satellite?(hash(key,p.seed+13)-.5)*h*.65*spread:0;
   const bw=Math.max(2,Math.round(w*(.012+.075*p.size)*(.35+.9*hash(key,p.seed+14))*(satellite?.66:1)));
   const bh=Math.max(2,Math.round(h*(.018+.075*p.size)*(.35+.9*hash(key,p.seed+15))*(satellite?.66:1)));
   const x=Math.round(Math.max(0,Math.min(w-bw,cx+offX)));
   const y=Math.round(Math.max(0,Math.min(h-bh,cy+offY)));
   blocks.push({x,y,w:bw,h:bh,alpha:fade*blink*(satellite?.8:1),key,
    type:Math.floor(hash(key,p.seed+16)*3),
    jitter:Math.round((hash(key,p.seed+17)-.5)*(2+w*.1*p.chroma))});
  }
 }
 return {width:w,height:h,time:t,rate,params:p,blocks};
}
export function buildDataBurstFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const rgba=source?.data||source;
 if(!rgba||rgba.length!==w*h*4)throw Error('Data Burst requires source RGBA matching its dimensions');
 const dst=reuse?.length===rgba.length&&reuse!==rgba?reuse:new Uint8ClampedArray(rgba.length);
 dst.set(rgba);
 const state=dataBurstFrameState(w,h,effect,seconds),p=state.params;
 if(p.strength<=0||p.chroma<=0)return {width:w,height:h,data:dst,state};
 const offset=Math.max(1,Math.round(p.chroma*(1+w*.028)));
 const pick=(x,y,c)=>rgba[(Math.max(0,Math.min(h-1,y))*w+
   Math.max(0,Math.min(w-1,x)))*4+c];
 for(const block of state.blocks){
  const strength=Math.min(1,block.alpha*p.strength);
  for(let y=block.y;y<Math.min(h,block.y+block.h);y++){
   for(let x=block.x;x<Math.min(w,block.x+block.w);x++){
    const i=(y*w+x)*4;
    // Corrupted digital packets include independently shifted RGB information,
    // hard stepped edges, bright electronic overdrive and dark holes.
    const packet=hash(Math.floor((x-block.x)/Math.max(1,block.w/4))+block.key,
      Math.floor((y-block.y)/Math.max(1,block.h/3))+p.seed);
    const shiftedX=x+block.jitter;
    const rr=pick(shiftedX+offset,y,0);
    const gg=pick(shiftedX-offset,y+Math.round(offset*.25),1);
    const bb=pick(shiftedX,y-Math.round(offset*.33),2);
    const gain=packet>.7?1.45:packet<.2?.28:1.12;
    const tint=(block.type===0?[105,0,90]:block.type===1?[0,110,85]:[90,60,0]);
    const v0=clamp(rr*gain+tint[0]*p.chroma,0,255);
    const v1=clamp(gg*gain+tint[1]*p.chroma,0,255);
    const v2=clamp(bb*gain+tint[2]*p.chroma,0,255);
    dst[i]=rgba[i]+(v0-rgba[i])*strength;
    dst[i+1]=rgba[i+1]+(v1-rgba[i+1])*strength;
    dst[i+2]=rgba[i+2]+(v2-rgba[i+2])*strength;
    dst[i+3]=rgba[i+3]; // never introduce, erase or change transparency
   }
  }
 }
 return {width:w,height:h,data:dst,state};
}
const SCRATCH=new WeakMap();
function scratch(ctx,w,h){
 let item=SCRATCH.get(ctx);
 const scale=Math.min(1,512/Math.max(w,h)),sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));
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
/** Same painter is used by live compositor and deterministic fixed-frame export. */
export function renderDataBurst(ctx,source,width,height,effect={},seconds=0,amount=1){
 const a=clamp(amount,0,1,1);if(a<=0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const item=source&&scratch(ctx,w,h);if(!item)return false;
 const {canvas,c}=item,sw=canvas.width,sh=canvas.height;
 c.setTransform?.(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';
 c.clearRect(0,0,sw,sh);c.drawImage(source,0,0,sw,sh);
 let original;
 try{original=c.getImageData(0,0,sw,sh);}catch{return false;}
 // The timeline compositor already contributes effect intensity to 'amount'.
 const frame=buildDataBurstFrame(original,sw,sh,{...effect,intensity:100},seconds,item.image?.data);
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
