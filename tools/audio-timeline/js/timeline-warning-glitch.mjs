/** Warning Glitch: animated hazard telemetry and local signal displacement.
 * Warning graphics and corrupted source pixels use independent controls.
 * The source alpha remains unchanged, and all timing is clip-relative.
 */
const clamp=(v,a,b,d)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):d));
const rand=n=>{n=Math.imul(n^0x85ebca6b,0x9e3779b1);n=Math.imul(n^(n>>>16),0x7feb352d);return ((n^(n>>>15))>>>0)/4294967296;};
const wrap=(x,n)=>((x%n)+n)%n;
export function warningGlitchState(w,h,e={},seconds=0){
 const t=Math.max(0,Number(seconds)||0),seed=Math.round(clamp(e.warningSeed,0,99999,1986));
 const pulse=.78+.22*Math.sin(t*Math.PI*2*.8),scale=clamp(e.scale,10,300,100)/100;
 const rail=Math.max(1,Math.round(Math.min(w,h)*clamp(e.warningRail,1,12,5)/100));
 const bands=[],count=Math.max(2,Math.round(clamp(e.density,1,120,48)*.09));
 for(let i=0;i<count;i++){
  const k=seed+i*131,clock=t*(2+rand(k+1)*2)+rand(k+2),tick=Math.floor(clock),age=clock-tick,id=k+tick*8191;
  const height=Math.max(1,Math.round(h*(.012+.05*rand(id+3))*scale));
  bands.push({y:Math.round(h*(.12+.66*rand(id+4))),height,shift:rand(id+5)*2-1,weight:Math.sin(Math.PI*age)**2});
 }
 return {rail,bands,pulse,stripe:Math.max(3,w*.035*scale),travel:t*w*clamp(e.warningTravel,0,100,45)/100*.55};
}
export function buildWarningGlitchFrame(source,w,h,e={},seconds=0,reuse,amount=1){
 const src=source?.data||source;if(!src||src.length!==w*h*4)throw Error('Warning Glitch requires matching RGBA source');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);data.set(src);
 const mix=clamp(amount,0,1,1),strength=clamp(e.distortion,0,100,55)/100;
 const p=warningGlitchState(w,h,e,seconds),hud=clamp(e.warningOpacity,0,100,75)/100*mix;
 if(!mix)return {data,width:w,height:h,state:p};
 const angle=clamp(e.direction,-180,180,0)*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle),amp=Math.min(w,h)*.15*strength;
 const tint=/^#[0-9a-f]{6}$/i.test(e.color||'')?e.color:'#ff4b32',rgb=[1,3,5].map(i=>parseInt(tint.slice(i,i+2),16));
 const alarm=clamp(e.warningPulse,0,100,50)/100,railMix=hud*(1-alarm+alarm*p.pulse);
 const idx=(x,y)=>(Math.max(0,Math.min(h-1,Math.round(y)))*w+Math.max(0,Math.min(w-1,Math.round(x))))*4;
 // Independent short source dropouts; the edges and warning rails are composed afterwards.
 for(const b of p.bands){
  const dx=amp*b.shift*ca,dy=amp*b.shift*sa,a=mix*strength*b.weight;
  for(let y=Math.max(0,b.y);y<Math.min(h,b.y+b.height);y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4,j=idx(x+dx,y+dy);if(!src[i+3]||!src[j+3])continue;
   for(let c=0;c<3;c++)data[i+c]=data[i+c]+(src[j+c]-data[i+c])*a;
  }
 }
 if(hud){
  const inset=Math.max(1,Math.round(p.rail*.5)),bottom=Math.max(inset,Math.round(h*.86));
  const blend=(i,c,a)=>{if(!src[i+3])return;for(let k=0;k<3;k++)data[i+k]=data[i+k]+(c[k]-data[i+k])*a;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4;if(!src[i+3])continue;
   const edge=Math.min(x-inset,w-1-inset-x,y-inset,h-1-inset-y);
   if(edge>=0&&edge<p.rail*.28)blend(i,rgb,railMix);
   if(y>=bottom&&y<h-inset&&x>=inset&&x<w-inset){
    const stripe=wrap(x+(y-bottom)*1.3-p.travel,p.stripe*2)<p.stripe;
    blend(i,stripe?[244,190,45]:[25,30,36],railMix*.85);
   }
   const top=y>=inset&&y<inset+p.rail*1.5;
   if(top&&x>=inset+p.rail&&x<w-inset-p.rail&&wrap(x-inset,p.stripe*1.6)<p.stripe*.18)blend(i,rgb,railMix*.7);
  }
 }
 return {data,width:w,height:h,state:p};
}
const CACHE=new WeakMap();
export function renderWarningGlitch(ctx,source,w,h,e,t,amount){
 if(!source)return false;
 let cache=CACHE.get(ctx);
 if(!cache){const canvas=typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
 const c=canvas?.getContext('2d',{willReadFrequently:true});if(!c)return false;cache={canvas,c,buffer:null};CACHE.set(ctx,cache);}
 const {canvas,c}=cache;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;cache.buffer=null;}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='copy';c.drawImage(source,0,0,w,h);
 let input;try{input=c.getImageData(0,0,w,h);}catch{return false;}
 const out=buildWarningGlitchFrame(input,w,h,e,t,cache.buffer,amount);cache.buffer=out.data;input.data.set(out.data);c.putImageData(input,0,0);
 ctx.save();try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,w,h);}finally{ctx.restore();}return true;
}
