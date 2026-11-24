/** Highlight-derived multiscale optical bloom. Source alpha is preserved. */
const clamp=(v,a,b,d)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):d));
const linear=Float32Array.from({length:256},(_,i)=>(i/255)**2.2);
function blurPass(src,dst,w,h,r,vertical){
 const lines=vertical?w:h,len=vertical?h:w,step=vertical?w:1;
 for(let line=0;line<lines;line++){
  const base=vertical?line:line*w;
  let sum=0;for(let k=-r;k<=r;k++)sum+=src[base+Math.max(0,Math.min(len-1,k))*step];
  for(let k=0;k<len;k++){
   dst[base+k*step]=sum/(2*r+1);
   sum+=src[base+Math.min(len-1,k+r+1)*step]-src[base+Math.max(0,k-r)*step];
  }
 }
}
export function buildGlowFrame(source,w,h,e={},seconds=0,reuse,amount=1){
 const src=source?.data||source;if(!src||src.length!==w*h*4)throw Error('Glow requires matching RGBA source');
 const out=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);
 out.set(src);
 const strength=clamp(amount,0,1,1)*clamp(e.glow,0,100,64)/100;
 if(strength===0)return {data:out,width:w,height:h};
 const threshold=clamp(e.glowThreshold,0,100,55)/100,knee=clamp(e.glowKnee,0,100,35)/100*.25;
 const breath=1-clamp(e.glowBreath,0,100,25)/100*(.5-.5*Math.cos(Math.max(0,seconds)*Math.PI*2/2.4));
 const tint=/^#[0-9a-f]{6}$/i.test(e.color||'')?e.color:'#ffd98d';
 const rgb=[1,3,5].map(i=>linear[parseInt(tint.slice(i,i+2),16)]);
 const n=w*h,mask=new Float32Array(n),tmp=new Float32Array(n),near=new Float32Array(n),far=new Float32Array(n);
 for(let p=0;p<n;p++){const i=p*4,y=.2126*linear[src[i]]+.7152*linear[src[i+1]]+.0722*linear[src[i+2]];
  const d=y-threshold,soft=knee?Math.max(0,Math.min(2*knee,d+knee))**2/(4*knee):0;
  mask[p]=Math.max(d,soft,0)*src[i+3]/255;
 }
 const radius=Math.round(clamp(e.blur,0,60,24)*Math.max(w,h)/640);
 if(radius>0){
  blurPass(mask,tmp,w,h,Math.max(1,Math.round(radius*.35)),false);blurPass(tmp,near,w,h,Math.max(1,Math.round(radius*.35)),true);
  blurPass(near,tmp,w,h,radius,false);blurPass(tmp,far,w,h,radius,true);
 }else{near.set(mask);far.set(mask);}
 for(let p=0;p<n;p++){
  const i=p*4;if(!src[i+3])continue;
  const energy=(mask[p]*.30+near[p]*.65+far[p]*1.5)*strength*breath;
  for(let c=0;c<3;c++){
   const x=linear[src[i+c]],added=energy*(.22+.78*rgb[c]);
   out[i+c]=255*Math.min(1,x+added*(1-x*.7))**(1/2.2);
  }
 }
 return {data:out,width:w,height:h};
}
const CACHE=new WeakMap();
export function renderGlow(ctx,source,w,h,e,t,amount){
 if(!source)return false;
 let cache=CACHE.get(ctx);
 if(!cache){const canvas=typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
 const c=canvas?.getContext('2d',{willReadFrequently:true});if(!c)return false;cache={canvas,c};CACHE.set(ctx,cache);}
 const {canvas,c}=cache;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='copy';c.drawImage(source,0,0,w,h);
 let input;try{input=c.getImageData(0,0,w,h);}catch{return false;}
 const out=buildGlowFrame(input,w,h,e,t,undefined,amount);input.data.set(out.data);c.putImageData(input,0,0);
 ctx.save();try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,w,h);}finally{ctx.restore();}return true;
}
