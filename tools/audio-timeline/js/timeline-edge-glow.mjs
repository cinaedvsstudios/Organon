/** Edge Glow: contour-derived emission, independent of absolute brightness. */
const clamp=(v,a,b,d)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):d));
const lin=Float32Array.from({length:256},(_,i)=>(i/255)**2.2);
function box(src,dst,w,h,r,vertical){
 const lines=vertical?w:h,len=vertical?h:w,step=vertical?w:1;
 for(let l=0;l<lines;l++){const base=vertical?l:l*w;let sum=0;
  for(let k=-r;k<=r;k++)sum+=src[base+Math.max(0,Math.min(len-1,k))*step];
  for(let k=0;k<len;k++){dst[base+k*step]=sum/(2*r+1);sum+=src[base+Math.min(len-1,k+r+1)*step]-src[base+Math.max(0,k-r)*step];}
 }
}
export function buildEdgeGlowFrame(source,w,h,e={},seconds=0,reuse,amount=1){
 const src=source?.data||source;if(!src||src.length!==w*h*4)throw Error('Edge Glow requires matching RGBA source');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);data.set(src);
 const strength=clamp(amount,0,1,1)*clamp(e.glow,0,100,64)/100;
 if(!strength)return {data,width:w,height:h};
 const n=w*h,mask=new Float32Array(n),tmp=new Float32Array(n),core=new Float32Array(n),halo=new Float32Array(n);
 const threshold=clamp(e.edgeThreshold,0,100,15)/100, chroma=clamp(e.edgeChroma,0,100,50)/100;
 const pulse=1-clamp(e.edgePulse,0,100,30)/100*(.5-.5*Math.cos(Math.max(0,seconds)*Math.PI*2/2));
 const tint=/^#[0-9a-f]{6}$/i.test(e.color||'')?e.color:'#ffd98d',rgb=[1,3,5].map(i=>lin[parseInt(tint.slice(i,i+2),16)]);
 // Sobel gradients of alpha-weighted RGB and luminance. Flat luminous areas have no contour emission.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=y*w+x,i=p*4;if(!src[i+3])continue;
  let gx=[0,0,0],gy=[0,0,0];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy)continue;
   const q=(Math.max(0,Math.min(h-1,y+dy))*w+Math.max(0,Math.min(w-1,x+dx)))*4;
   const a=src[q+3]/255;
   for(let c=0;c<3;c++){const v=src[q+c]/255*a;gx[c]+=v*dx*(dy===0?2:1);gy[c]+=v*dy*(dx===0?2:1);}
  }
  const lum=Math.hypot(.2126*gx[0]+.7152*gx[1]+.0722*gx[2],.2126*gy[0]+.7152*gy[1]+.0722*gy[2])/4;
  const col=Math.max(...gx.map((v,c)=>Math.hypot(v,gy[c])/4));
  mask[p]=Math.min(1,Math.max(0,(lum*(1-chroma)+col*chroma-threshold)/Math.max(.01,1-threshold)));
 }
 const width=Math.max(0,Math.round(clamp(e.edgeWidth,1,12,3)*Math.max(w,h)/640));
 if(width){box(mask,tmp,w,h,width,false);box(tmp,core,w,h,width,true);}else core.set(mask);
 const r=Math.round(clamp(e.blur,0,60,24)*Math.max(w,h)/640);
 if(r){box(core,tmp,w,h,r,false);box(tmp,halo,w,h,r,true);}else halo.set(core);
 for(let p=0;p<n;p++){const i=p*4;if(!src[i+3])continue;
  const energy=(mask[p]*.65+core[p]*1.1+halo[p]*2)*strength*pulse;
  for(let c=0;c<3;c++){const v=lin[src[i+c]];data[i+c]=255*Math.min(1,v+energy*(.12+.88*rgb[c])*(1-v*.65))**(1/2.2);}
 }
 return {data,width:w,height:h};
}
const CACHE=new WeakMap();
export function renderEdgeGlow(ctx,source,w,h,e,t,amount){
 if(!source)return false;
 let cache=CACHE.get(ctx);
 if(!cache){const canvas=typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
 const c=canvas?.getContext('2d',{willReadFrequently:true});if(!c)return false;cache={canvas,c};CACHE.set(ctx,cache);}
 const {canvas,c}=cache;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='copy';c.drawImage(source,0,0,w,h);
 let input;try{input=c.getImageData(0,0,w,h);}catch{return false;}
 const out=buildEdgeGlowFrame(input,w,h,e,t,undefined,amount);input.data.set(out.data);c.putImageData(input,0,0);
 ctx.save();try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,w,h);}finally{ctx.restore();}return true;
}
