/** Glitch Flux: travelling, continuous directional signal warps.
 * Alpha-weighted bilinear sampling preserves source coverage.
 * A seeded spatial field travels in clip-local time, without frame state.
 */
const clamp=(v,a,b,d)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):d));
const random=n=>{n=Math.imul(n^0x85ebca6b,0x9e3779b1);n=Math.imul(n^(n>>>16),0x7feb352d);return ((n^(n>>>15))>>>0)/4294967296;};
const TAU=Math.PI*2;
export function fluxState(w,h,e={},seconds=0){
 const t=Math.max(0,Number(seconds)||0),seed=Math.round(clamp(e.fluxSeed,0,99999,2031));
 const axis=clamp(e.direction,-180,180,0)*Math.PI/180;
 const ca=Math.cos(axis),sa=Math.sin(axis),scale=clamp(e.scale,10,300,100)/100;
 const wavelength=Math.max(3,Math.min(w,h)*scale/(2+clamp(e.density,1,120,48)/12));
 return {ca,sa,wavelength,amp:Math.min(w,h)*.095*clamp(e.distortion,0,100,55)/100,
 phase:t*TAU*clamp(e.fluxRate,.1,5,1.2),seedPhase:TAU*random(seed),
 turbulence:clamp(e.fluxTurbulence,0,100,55)/100,shear:clamp(e.fluxShear,0,100,25)/100,
 highlight:clamp(e.fluxHighlight,0,100,30)/100,spread:clamp(e.fluxSpread,0,100,45)/100};
}
export function fluxVector(p,x,y){
 const u=x*p.ca+y*p.sa,v=-x*p.sa+y*p.ca;
 const q=u/p.wavelength*TAU-p.phase+p.seedPhase;
 const ripple=Math.sin(q+.8*p.turbulence*Math.sin(v/p.wavelength*.5+p.phase*.37));
 const secondary=Math.sin(q*.47+v/p.wavelength*.43+p.phase*.61)*p.turbulence*.55;
 const flow=(ripple+secondary)/(1+p.turbulence*.55);
 const cross=p.shear*Math.sin(q*.73+v/p.wavelength*.27+p.phase*.4);
 const dx=p.amp*(cross*p.ca-flow*p.sa),dy=p.amp*(cross*p.sa+flow*p.ca);
 return {dx,dy,crest:Math.abs(ripple)};
}
function sample(src,w,h,x,y,out){
 x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));
 const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0;
 const a=(y0*w+x0)*4,b=(y0*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4;
 const wa=(1-fx)*(1-fy)*src[a+3],wb=fx*(1-fy)*src[b+3],wc=(1-fx)*fy*src[c+3],wd=fx*fy*src[d+3],sum=wa+wb+wc+wd;
 out[3]=sum/255;if(sum>0)for(let k=0;k<3;k++)out[k]=(wa*src[a+k]+wb*src[b+k]+wc*src[c+k]+wd*src[d+k])/sum;
}
export function buildGlitchFluxFrame(source,w,h,e={},seconds=0,reuse,amount=1){
 const src=source?.data||source;if(!src||src.length!==w*h*4)throw Error('Glitch Flux requires matching RGBA source');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);data.set(src);
 const mix=clamp(amount,0,1,1),p=fluxState(w,h,e,seconds);
 if(!mix||!p.amp)return {data,width:w,height:h,state:p};
 const hex=/^#[0-9a-f]{6}$/i.test(e.color||'')?e.color:'#79d6ff',rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),out=[0,0,0,0];
 const threshold=.98-.65*p.spread;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(!src[i+3])continue;
  const f=fluxVector(p,x,y);sample(src,w,h,x+f.dx,y+f.dy,out);
  const weight=mix*out[3],light=Math.max(0,(f.crest-threshold)/(1-threshold))*p.highlight*.45*mix*Math.min(1,p.amp/4);
  for(let c=0;c<3;c++){const warped=src[i+c]+(out[c]-src[i+c])*weight;
   data[i+c]=warped+(255-warped)*rgb[c]/255*light;}
 }
 return {data,width:w,height:h,state:p};
}
const CACHE=new WeakMap();
export function renderGlitchFlux(ctx,source,w,h,e,t,amount){
 if(!source)return false;
 let cache=CACHE.get(ctx);
 if(!cache){const canvas=typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
 const c=canvas?.getContext('2d',{willReadFrequently:true});if(!c)return false;cache={canvas,c,buffer:null};CACHE.set(ctx,cache);}
 const {canvas,c}=cache;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;cache.buffer=null;}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='copy';c.drawImage(source,0,0,w,h);
 let input;try{input=c.getImageData(0,0,w,h);}catch{return false;}
 const out=buildGlitchFluxFrame(input,w,h,e,t,cache.buffer,amount);cache.buffer=out.data;input.data.set(out.data);c.putImageData(input,0,0);
 ctx.save();try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,w,h);}finally{ctx.restore();}return true;
}
