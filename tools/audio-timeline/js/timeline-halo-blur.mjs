/** Halo Blur: a protected focal region surrounded by optical diffusion.
 * All samples are premultiplied; original coverage is retained.
 * Separable sliding windows make blur work linear in pixel count.
 */
const clamp=(v,a,b,d)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):d));
const linear=Float32Array.from({length:256},(_,i)=>(i/255)**2.2);
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function box(src,dst,w,h,r,vertical){
 const lines=vertical?w:h,len=vertical?h:w,step=(vertical?w:1)*4;
 for(let l=0;l<lines;l++){const base=(vertical?l:l*w)*4;
  for(let c=0;c<4;c++){let sum=0;for(let k=-r;k<=r;k++)sum+=src[base+Math.max(0,Math.min(len-1,k))*step+c];
   for(let k=0;k<len;k++){dst[base+k*step+c]=sum/(2*r+1);sum+=src[base+Math.min(len-1,k+r+1)*step+c]-src[base+Math.max(0,k-r)*step+c];}
  }
 }
}
export function haloBlurState(w,h,e={},seconds=0){
 const breath=clamp(e.haloBreath,0,100,30)/100;
 const phase=Math.max(0,seconds)*Math.PI*2/2.7;
 return {cx:w*clamp(e.originX,0,100,50)/100,cy:h*clamp(e.originY,0,100,50)/100,
  focus:clamp(e.haloFocus,5,90,30)/100*(1+.35*breath*Math.sin(phase)),
  feather:clamp(e.haloFeather,5,100,45)/100,aspect:clamp(e.haloAspect,50,200,100)/100,
  radius:clamp(e.blur,0,60,24)*Math.max(w,h)/640};
}
export function buildHaloBlurFrame(source,w,h,e={},seconds=0,reuse,amount=1,workspace={}){
 const src=source?.data||source;if(!src||src.length!==w*h*4)throw Error('Halo Blur requires matching RGBA source');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);data.set(src);
 const p=haloBlurState(w,h,e,seconds),mix=clamp(amount,0,1,1),glow=clamp(e.glow,0,100,64)/100;
 if(!mix||!p.radius)return {data,width:w,height:h,state:p};
 const arr=k=>workspace[k]?.length===src.length?workspace[k]:(workspace[k]=new Float32Array(src.length));
 const work=arr('work'),temp=arr('temp'),diffuse=arr('diffuse');
 for(let i=0;i<src.length;i+=4){const a=src[i+3]/255;work[i+3]=a;for(let c=0;c<3;c++)work[i+c]=linear[src[i+c]]*a;}
 const r=Math.max(1,Math.round(p.radius*.65));
 box(work,temp,w,h,r,false);box(temp,diffuse,w,h,r,true);
 box(diffuse,temp,w,h,r,false);box(temp,diffuse,w,h,r,true);
 const unit=Math.max(1,Math.min(w,h)*.5);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(!src[i+3]||diffuse[i+3]<1e-6)continue;
  const dist=Math.hypot((x-p.cx)/(unit*p.aspect),(y-p.cy)/unit);
  const m=smooth((dist-p.focus)/p.feather)*mix*Math.min(1,p.radius);
  if(!m)continue;
  const rr=diffuse[i]/diffuse[i+3],gg=diffuse[i+1]/diffuse[i+3],bb=diffuse[i+2]/diffuse[i+3];
  const lift=Math.max(0,.2126*rr+.7152*gg+.0722*bb-.45)*glow*.35;
  for(let c=0;c<3;c++){const v=linear[src[i+c]],blurred=diffuse[i+c]/diffuse[i+3];data[i+c]=255*Math.min(1,v+(blurred-v)*m+lift*m*(1-v))**(1/2.2);}
 }
 return {data,width:w,height:h,state:p};
}
const CACHE=new WeakMap();
export function renderHaloBlur(ctx,source,w,h,e,t,amount){
 if(!source)return false;
 let cache=CACHE.get(ctx);
 if(!cache){const canvas=typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
 const c=canvas?.getContext('2d',{willReadFrequently:true});if(!c)return false;cache={canvas,c,buffer:null,workspace:{}};CACHE.set(ctx,cache);}
 const {canvas,c}=cache;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;cache.buffer=null;cache.workspace={};}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='copy';c.drawImage(source,0,0,w,h);
 let input;try{input=c.getImageData(0,0,w,h);}catch{return false;}
 const out=buildHaloBlurFrame(input,w,h,e,t,cache.buffer,amount,cache.workspace);cache.buffer=out.data;input.data.set(out.data);c.putImageData(input,0,0);
 ctx.save();try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,w,h);}finally{ctx.restore();}return true;
}
