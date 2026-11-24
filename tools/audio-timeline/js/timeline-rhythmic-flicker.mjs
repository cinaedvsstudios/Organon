/** Absolute-time rhythmic exposure pulses; no opaque full-frame tint. */
const clamp=(v,min,max,fallback)=>Math.min(max,Math.max(min,Number.isFinite(Number(v))?Number(v):fallback));
const hash=n=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967295;};
export function rhythmicFlickerState(e={},seconds=0){
 const t=Math.max(0,Number(seconds)||0),bpm=clamp(e.flickerBpm,30,180,96);
 const cycle=t*bpm/60,index=Math.floor(cycle),phase=cycle-index;
 const width=clamp(e.flickerDuty,15,85,42)/100,variation=clamp(e.flickerVariation,0,100,20)/100;
 const seed=Math.round(clamp(e.flickerSeed,0,99999,907));
 const accent=1-variation*hash(index+seed)*.55;
 const pulse=phase<width?Math.pow(Math.sin(Math.PI*phase/width),2)*accent:0;
 const trough=phase>=width?Math.pow(Math.sin(Math.PI*(phase-width)/(1-width)),2):0;
 return {phase,index,pulse,trough,stops:clamp(e.flickerExposure,0,100,60)/100*(pulse*.85-trough*.55)};
}
export function buildRhythmicFlickerFrame(source,w,h,e={},seconds=0,reuse,amount=1){
 const src=source?.data||source;if(!src||src.length!==w*h*4)throw Error('Matching RGBA source required');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);
 data.set(src);const state=rhythmicFlickerState(e,seconds),gain=2**state.stops,alpha=clamp(amount,0,1,1);
 const tint=/^#[0-9a-f]{6}$/i.test(e.color||'')?e.color:'#ffd98d';
 const rgb=[1,3,5].map(i=>parseInt(tint.slice(i,i+2),16)/255);
 const warmth=clamp(e.flickerWarmth,0,100,25)/100*state.pulse;
 for(let i=0;i<src.length;i+=4){if(!src[i+3])continue;
  for(let c=0;c<3;c++){
   const v=src[i+c]/255,linear=v**2.2;
   const lit=Math.min(1,linear*gain*(1+warmth*(rgb[c]-.5)*.55));
   data[i+c]=src[i+c]+(255*lit**(1/2.2)-src[i+c])*alpha;
  }
 }
 return {data,state,width:w,height:h};
}
const CACHE=new WeakMap();
export function renderRhythmicFlicker(ctx,source,w,h,e,t,amount){
 if(!source)return false;
 // Exposure is a point operation: process at native resolution, no spatial resampling.
 let cache=CACHE.get(ctx);
 if(!cache){const canvas=typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
 const c=canvas?.getContext('2d',{willReadFrequently:true});if(!c)return false;cache={canvas,c};CACHE.set(ctx,cache);}
 const {canvas,c}=cache;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='copy';c.drawImage(source,0,0,w,h);
 let img;try{img=c.getImageData(0,0,w,h);}catch{return false;}
 const output=buildRhythmicFlickerFrame(img,w,h,e,t,undefined,amount);img.data.set(output.data);c.putImageData(img,0,0);
 ctx.save();try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,w,h);}finally{ctx.restore();}return true;
}
