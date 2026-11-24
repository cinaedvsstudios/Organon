/** Chromatic Quirk: wavelength-dependent optical registration, not additive RGB layers. */
const clamp=(v,a,b,d)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):d));
export function chromaticQuirkState(w,h,e={},seconds=0){
 const t=Math.max(0,Number(seconds)||0),phase=t*2*Math.PI/1.7;
 const amplitude=clamp(e.distortion,0,100,55)/100*clamp(e.scale,10,300,100)/100*Math.min(w,h)*.045;
 const drift=clamp(e.chromaDrift,0,100,45)/100,radial=clamp(e.chromaRadial,0,100,65)/100;
 const axis=clamp(e.direction,-180,180,0)*Math.PI/180+drift*.45*Math.sin(phase*.7);
 return {amplitude:amplitude*(1+drift*.65*Math.sin(phase)),dx:Math.cos(axis),dy:Math.sin(axis),radial,
  cx:w*clamp(e.originX,0,100,50)/100,cy:h*clamp(e.originY,0,100,50)/100,
  balance:clamp(e.chromaBalance,-100,100,0)/100,green:clamp(e.chromaGreen,-100,100,0)/100};
}
// Bilinear sampling in premultiplied colour, avoiding invisible RGB bleeding into visible pixels.
function sample(src,w,h,x,y,c,fallback){
 x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));
 const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1);
 const fx=x-x0,fy=y-y0,i=(y0*w+x0)*4,j=(y0*w+x1)*4,k=(y1*w+x0)*4,l=(y1*w+x1)*4;
 const a=src[i+3]*(1-fx)*(1-fy),b=src[j+3]*fx*(1-fy),d=src[k+3]*(1-fx)*fy,f=src[l+3]*fx*fy;
 const weight=a+b+d+f;
 return weight>0?(src[i+c]*a+src[j+c]*b+src[k+c]*d+src[l+c]*f)/weight:fallback;
}
export function buildChromaticQuirkFrame(source,w,h,e={},seconds=0,reuse,amount=1){
 const src=source?.data||source;if(!src||src.length!==w*h*4)throw Error('Chromatic Quirk requires matching RGBA source');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);data.set(src);
 const p=chromaticQuirkState(w,h,e,seconds),mix=clamp(amount,0,1,1);
 if(!p.amplitude||!mix)return {data,width:w,height:h,state:p};
 const r=Math.max(1,Math.hypot(w,h)/2),red=-(1+p.balance*.75),blue=1-p.balance*.75;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(!src[i+3])continue;
  const rx=(x-p.cx)/r,ry=(y-p.cy)/r,dist=Math.min(2,rx*rx+ry*ry);
  const dx=p.amplitude*(p.dx*(1-p.radial)+rx*dist*p.radial*2);
  const dy=p.amplitude*(p.dy*(1-p.radial)+ry*dist*p.radial*2);
  const rr=sample(src,w,h,x+dx*red,y+dy*red,0,src[i]);
  const gg=sample(src,w,h,x+dx*p.green*.5,y+dy*p.green*.5,1,src[i+1]);
  const bb=sample(src,w,h,x+dx*blue,y+dy*blue,2,src[i+2]);
  data[i]=src[i]+(rr-src[i])*mix;data[i+1]=src[i+1]+(gg-src[i+1])*mix;data[i+2]=src[i+2]+(bb-src[i+2])*mix;
 }
 return {data,width:w,height:h,state:p};
}
const CACHE=new WeakMap();
export function renderChromaticQuirk(ctx,source,w,h,e,t,amount){
 if(!source)return false;
 let cache=CACHE.get(ctx);
 if(!cache){const canvas=typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
 const c=canvas?.getContext('2d',{willReadFrequently:true});if(!c)return false;cache={canvas,c,buffer:null};CACHE.set(ctx,cache);}
 const {canvas,c}=cache;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;cache.buffer=null;}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='copy';c.drawImage(source,0,0,w,h);
 let input;try{input=c.getImageData(0,0,w,h);}catch{return false;}
 const out=buildChromaticQuirkFrame(input,w,h,e,t,cache.buffer,amount);cache.buffer=out.data;input.data.set(out.data);c.putImageData(input,0,0);
 ctx.save();try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,w,h);}finally{ctx.restore();}return true;
}
