/**
 * MotoriClip #66 audit unit — Fault Cassette (analogue tape tracking failure).
 *
 * Unlike the former equally spaced shifted strips, this painter derives uneven,
 * short-lived head-tracking tears, rolling sync instability, dropout noise and
 * chroma misregistration from ACTUAL underlying pixels. Different random seeds
 * and absolute clip-relative seconds produce independent glitches with fully
 * reversible seeks. The existing 'fault-cassette' preset ID is unchanged.
 */
const clamp=(v,lo,hi,fallback=lo)=>{
 const n=Number(v);return Math.max(lo,Math.min(hi,Number.isFinite(n)?n:fallback));
};
function hash(a,b=0){
 let x=(Math.imul((a|0)+223,0x9e3779b1)^Math.imul((b|0)+67,0x85ebca6b))>>>0;
 x^=x>>>16;x=Math.imul(x,0x7feb352d)>>>0;
 x^=x>>>15;x=Math.imul(x,0x846ca68b)>>>0;x^=x>>>16;
 return (x>>>0)/4294967296;
}
const wrap=n=>((n%1)+1)%1;
const tint=hex=>{
 const s=/^#[0-9a-f]{6}$/i.test(String(hex))?String(hex):'#ffe0aa';
 return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
};
function options(effect={}){
 return {
  density:clamp(effect.density,1,120,62),
  distortion:clamp(effect.distortion,0,100,72)/100,
  size:clamp(effect.scale,10,300,100)/100,
  direction:clamp(effect.direction,-180,180,0)*Math.PI/180,
  tracking:clamp(effect.cassetteTracking,0,100,79)/100,
  dropouts:clamp(effect.cassetteDropouts,0,100,62)/100,
  chroma:clamp(effect.cassetteChroma,0,100,64)/100,
  roll:clamp(effect.cassetteRoll,0,100,48)/100,
  seed:Math.round(clamp(effect.cassetteSeed,0,99999,6969)),
  color:tint(effect.color)
 };
}
/** Only a few asynchronously dying tape faults are present at any moment. */
export function faultCassetteFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const p=options(effect),t=Math.max(0,Number(seconds)||0);
 const rate=3.5+p.density*.16,at=Math.floor(t*rate),bands=[];
 for(let event=Math.max(0,at-7);event<=at;event++){
  const birth=(event+hash(event,p.seed+1)*.8)/rate;
  const age=t-birth,life=.12+.34*hash(event,p.seed+2);
  if(age<0||age>=life||hash(event,p.seed+3)<.13)continue;
  const alpha=Math.pow(Math.sin(Math.PI*age/life),.65);
  const parts=1+Math.floor(hash(event,p.seed+4)*(1+p.density/36));
  for(let j=0;j<parts;j++){
   const key=event*113+j*37+p.seed;
   const y=Math.round((h-1)*hash(key,p.seed+5));
   const height=Math.max(1,Math.round(h*(.01+.035*hash(key,p.seed+6))*p.size));
   const shift=(hash(key,p.seed+7)*2-1)*w*.078*p.distortion*p.size;
   const drift=(hash(key,p.seed+8)*2-1)*h*.016*p.tracking;
   bands.push({key,y,height,shift,drift,alpha,
    burst:hash(key,p.seed+9),event,life,age});
  }
 }
 const sweepPhase=wrap(t*(.08+.57*p.roll)+hash(p.seed,5));
 const trackingY=h*sweepPhase;
 return {width:w,height:h,time:t,bands,trackingY,params:p};
}
/** Pure pixel transform. Non-faulted footage and every source alpha remain intact. */
export function buildFaultCassetteFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const src=source?.data||source;
 if(!src||src.length!==w*h*4)throw Error('Fault Cassette requires matching RGBA source');
 const dst=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);
 dst.set(src);
 const state=faultCassetteFrameState(w,h,effect,seconds),p=state.params,t=state.time;
 const sample=(x,y,c)=>src[(Math.max(0,Math.min(h-1,y))*w+
  Math.max(0,Math.min(w-1,x)))*4+c];
 const period=Math.floor(t*32);
 for(let y=0;y<h;y++){
  // Rolling head-sync band affects a narrow, continuously travelling zone.
  const d=Math.abs(y-state.trackingY),sigma=h*(.012+.022*p.tracking);
  const head=p.tracking*Math.exp(-.5*(d/sigma)**2);
  let fault=null,bandPower=0;
  for(const b of state.bands){
   if(y>=b.y&&y<b.y+b.height&&b.alpha>bandPower){
    bandPower=b.alpha;fault=b;
   }
  }
  const power=Math.max(head*.78,bandPower);
  if(power<.018)continue;
  const rowPhase=hash(y+period*7,p.seed+10);
  const displacement=(fault?fault.shift:Math.sin(y*.09+t*9+p.direction)*w*.028*p.distortion*p.size)*
   power+Math.sin(t*8+y*.13+p.direction)*w*.008*p.distortion*head;
  const vertical=Math.round((fault?fault.drift:Math.cos(t*5+y*.2)*h*.012*p.tracking)*power);
  const dx=Math.round(displacement),rgbShift=Math.round((1+4*p.chroma)*power*p.chroma);
  const mixedTint=Math.min(.40,p.dropouts*.28*power);
  for(let x=0;x<w;x++){
   const k=(y*w+x)*4;
   if(src[k+3]===0)continue;
   // Dropouts appear in interrupted, nonuniform tracks, not a solid noise bar.
   const cell=Math.floor(x/(3+Math.round(6*rowPhase)));
   const segment=hash(cell+y*17+(fault?.key||0),p.seed+period*31);
   const dropout=(p.dropouts>0&&segment<(p.dropouts*.18*power))?
    .28+.63*hash(cell+y*23,p.seed+period+14):0;
   const flicker=.93+.07*Math.sin(y*.31+t*23+rowPhase*9);
   const sx=x+dx,sy=y+vertical;
   for(let c=0;c<3;c++){
    const chroma=c===0?rgbShift:c===2?-rgbShift:0;
    const shifted=sample(sx+chroma,sy,c);
    const dropoutColor=dropout>.5?p.color[c]:16;
    const target=shifted*(1-dropout)+dropoutColor*dropout;
    const tinted=target*(1-mixedTint)+p.color[c]*mixedTint;
    dst[k+c]=src[k+c]+(tinted*flicker-src[k+c])*Math.min(1,power);
   }
   dst[k+3]=src[k+3];
  }
 }
 return {width:w,height:h,data:dst,state};
}
const SCRATCH=new WeakMap();
function scratch(ctx,width,height){
 const factor=Math.min(1,512/Math.max(width,height));
 const sw=Math.max(1,Math.round(width*factor)),sh=Math.max(1,Math.round(height*factor));
 let cache=SCRATCH.get(ctx);
 if(!cache){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(sw,sh):null;
  const c=canvas?.getContext('2d',{willReadFrequently:true});
  if(!c)return null;
  cache={canvas,c,image:null};SCRATCH.set(ctx,cache);
 }
 if(cache.canvas.width!==sw||cache.canvas.height!==sh){
  cache.canvas.width=sw;cache.canvas.height=sh;cache.image=null;
 }
 return cache;
}
/** Shared preview/recorded-MP4 painter with bounded scratch and no frame counters. */
export function renderFaultCassette(ctx,source,width,height,effect={},seconds=0,amount=1){
 const a=clamp(amount,0,1,1);
 if(a<=0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const item=source&&scratch(ctx,w,h);
 if(!item)return false;
 const {canvas,c}=item,sw=canvas.width,sh=canvas.height;
 c.setTransform?.(1,0,0,1,0,0);
 c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';
 c.clearRect(0,0,sw,sh);c.drawImage(source,0,0,sw,sh);
 let original;
 try{original=c.getImageData(0,0,sw,sh);}catch{return false;}
 const output=buildFaultCassetteFrame(original,sw,sh,effect,seconds,item.image?.data);
 if(!item.image||item.image.data.length!==output.data.length)item.image=c.createImageData(sw,sh);
 const data=item.image.data;data.set(output.data);
 if(a<1)for(let k=0;k<data.length;k+=4){
  for(let ch=0;ch<3;ch++)data[k+ch]=original.data[k+ch]+
   (data[k+ch]-original.data[k+ch])*a;
  data[k+3]=original.data[k+3];
 }
 c.putImageData(item.image,0,0);
 ctx.save();
 try{
  ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;
  ctx.drawImage(canvas,0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
