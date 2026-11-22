/**
 * MotoriClip #52 — Engine Heat: true two-axis pixel refraction.
 * Reprojects actual previously-composited media with a rising coherent
 * turbulence field. Does not draw faux vertical heat tendrils or shifted
 * horizontal scanline slices. Preview and export share clip-relative time.
 */
const limit=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a));
const smooth=(a,b,v)=>{const z=(v-a)/(b-a),p=z<0?0:z>1?1:z;return p*p*(3-2*p);};
const mix=(a,b,t)=>a+(b-a)*t;
const GRID=new Map();
function lattice(seed){
 let tab=GRID.get(seed);if(tab)return tab;
 tab=new Float32Array(64*64);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  let n=(Math.imul(x+1,374761393)^Math.imul(y+7,668265263)^Math.imul(seed+1,2246822519))>>>0;
  n^=n>>>13;n=Math.imul(n,1274126177)>>>0;n^=n>>>16;
  tab[y*64+x]=n/4294967296;
 }
 GRID.set(seed,tab);return tab;
}
function noise(x,y,map){
 const ix=Math.floor(x),iy=Math.floor(y),dx=x-ix,dy=y-iy,
  ux=dx*dx*(3-2*dx),uy=dy*dy*(3-2*dy);
 const x0=ix&63,x1=(ix+1)&63,y0=(iy&63)*64,y1=((iy+1)&63)*64;
 return mix(mix(map[y0+x0],map[y0+x1],ux),
  mix(map[y1+x0],map[y1+x1],ux),uy);
}
function config(e={}){
 const color=/^#[a-f\d]{6}$/i.test(String(e.color))?String(e.color):'#ffd98d';
 return {
  fieldA:lattice(211),fieldB:lattice(239),
  distortion:limit(e.distortion??55,0,100)/100,
  density:limit(e.density??48,1,120)/120,
  scale:limit(e.scale??100,10,300)/100,
  blur:limit(e.blur??24,0,60)/60,
  glow:limit(e.glow??64,0,100)/100,
  angle:limit(e.direction??0,-180,180)*Math.PI/180,
  originX:limit(e.originX??20,0,100)/100,
  originY:limit(e.originY??12,0,100)/100,
  rgb:[1,3,5].map(i=>parseInt(color.slice(i,i+2),16))
 };
}
function displacement(x,y,w,h,o,t,out){
 const u=(x+.5)/w,v=(y+.5)/h,center=.5+(o.originX-.20)*.62;
 const sourceStart=.29+(o.originY-.12)*.37;
 const vertical=Math.pow(smooth(sourceStart,.99,v),1.55);
 const lateral=1-smooth(.36,.80,Math.abs(u-center));
 const weight=vertical*lateral;
 if(weight<.0001){out.dx=0;out.dy=0;out.weight=0;return out;}
 const scale=(.95+.9*o.density)/o.scale;
 const wind=Math.sin(o.angle),rise=t*(.76+o.distortion*.38);
 const px=u*scale*8 + wind*t*.59;
 const py=v*scale*8-rise;
 const a=noise(px+Math.sin(py*1.8+t*.8)*.3,py,o.fieldA);
 const b=noise(px*2.11-t*.54,py*1.63+t*.22,o.fieldB);
 const fold=Math.sin(py*2.43+px*.77+t*.94+a*4.5);
 const amp=(.6+6.5*o.distortion)*Math.min(w,h)/140*o.scale;
 out.dx=weight*amp*((a-.5)*1.75+(b-.5)*.95+.24*fold);
 out.dy=weight*amp*.44*((b-.5)*1.35+(a-.5)*.48);
 out.weight=weight;
 return out;
}
/** Pure geometric probe for deterministic rising refractive waves. */
export function sampleEngineHeatDisplacement(x,y,w,h,e={},cycle=0){
 return displacement(x,y,Math.max(1,w),Math.max(1,h),config(e),
  Math.max(0,Number(cycle)||0),{dx:0,dy:0,weight:0});
}
function channel(bytes,w,h,x,y,c){
 const sx=x<0?0:x>w-1?w-1:x,sy=y<0?0:y>h-1?h-1:y;
 const x0=Math.floor(sx),x1=Math.min(w-1,x0+1),y0=Math.floor(sy),y1=Math.min(h-1,y0+1);
 const fx=sx-x0,fy=sy-y0,k0=(y0*w+x0)*4+c,k1=(y1*w+x0)*4+c;
 return mix(mix(bytes[k0],bytes[k0+4*(x1-x0)],fx),
  mix(bytes[k1],bytes[k1+4*(x1-x0)],fx),fy);
}
/**
 * Refract real source pixels with varying two-axis displacement and subtle
 * local focus loss. Output alpha is a physically localized heat envelope:
 * unchanged upper picture stays sharp when composited over full source.
 */
export function buildEngineHeatFrame(source,w,h,effect={},cycle=0,reuse){
 const width=Math.max(1,Math.round(w)),height=Math.max(1,Math.round(h));
 const input=source?.data||source;
 if(!input||input.length!==width*height*4)
  throw Error('Engine Heat requires correctly sized RGBA source pixels');
 const out=reuse?.length===input.length?reuse:new Uint8ClampedArray(input.length);
 const o=config(effect),t=Math.max(0,Number(cycle)||0),pos={dx:0,dy:0,weight:0};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const k=(y*width+x)*4;
  displacement(x,y,width,height,o,t,pos);
  if(pos.weight<.0001){out[k]=out[k+1]=out[k+2]=out[k+3]=0;continue;}
  const sx=x+pos.dx,sy=y+pos.dy;
  const focus=pos.weight*o.blur*.31;
  for(let c=0;c<3;c++){
   const v=channel(input,width,height,sx,sy,c);
   const blurred=focus>0?
    (channel(input,width,height,sx+1.2,sy+.4,c)+
     channel(input,width,height,sx-1.2,sy-.4,c))*.5:v;
   const base=mix(v,blurred,focus);
   const warmth=pos.weight*o.glow*.045;
   out[k+c]=mix(base,o.rgb[c],warmth);
  }
  out[k+3]=Math.round(channel(input,width,height,sx,sy,3)*pos.weight);
 }
 return {width,height,data:out};
}
const BUFFERS=new WeakMap();
function scratch(ctx,w,h){
 const scale=Math.min(1,256/Math.max(w,h));
 const width=Math.max(48,Math.round(w*scale)),height=Math.max(32,Math.round(h*scale));
 let cache=BUFFERS.get(ctx);
 if(!cache){
  const sourceCanvas=typeof document!=='undefined'?document.createElement('canvas'):
    typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):null;
  const outputCanvas=typeof document!=='undefined'?document.createElement('canvas'):
    typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):null;
  const sourceCtx=sourceCanvas?.getContext('2d',{willReadFrequently:true});
  const outputCtx=outputCanvas?.getContext('2d');
  if(!sourceCtx||!outputCtx)return null;
  cache={sourceCanvas,outputCanvas,sourceCtx,outputCtx,out:null};
  BUFFERS.set(ctx,cache);
 }
 if(cache.sourceCanvas.width!==width||cache.sourceCanvas.height!==height){
  cache.sourceCanvas.width=cache.outputCanvas.width=width;
  cache.sourceCanvas.height=cache.outputCanvas.height=height;
  cache.out=null;
 }
 if(!cache.out)cache.out=cache.outputCtx.createImageData(width,height);
 return cache;
}
/** Real media reprojector, called after timeline has captured lower tracks. */
export function renderEngineHeat(ctx,source,w,h,e={},cycle=0,amount=1){
 const alpha=limit(amount,0,1);
 if(alpha<=0)return true;
 ctx.save();
 try{
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=alpha;
  if(!source){
   // A neutral diagnostic shimmer when no media exists; no fake vertical lines.
   const y=h*(.70+.05*Math.sin(cycle*1.3)),g=ctx.createLinearGradient(0,y,0,h);
   g.addColorStop(0,'rgba(255,170,99,0)');
   g.addColorStop(1,'rgba(255,170,99,'+(.045+.025*Math.sin(cycle*2.1))+')');
   ctx.fillStyle=g;ctx.fillRect(0,y,w,h-y);
   return true;
  }
  // Restore the exact full-resolution source first. The parent's generic
  // glitch path previously painted it at (1-alpha); simply layering alpha
  // again would darken the unheated upper image. Replace that translucent
  // placeholder without touching the media, then blend refraction locally.
  ctx.globalAlpha=1;
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(source,0,0,w,h);
  ctx.globalAlpha=alpha;
  const cache=scratch(ctx,w,h);
  if(!cache)return true;
  cache.sourceCtx.globalCompositeOperation='source-over';
  cache.sourceCtx.globalAlpha=1;
  cache.sourceCtx.clearRect(0,0,cache.sourceCanvas.width,cache.sourceCanvas.height);
  cache.sourceCtx.drawImage(source,0,0,cache.sourceCanvas.width,cache.sourceCanvas.height);
  let sourcePixels;
  try{sourcePixels=cache.sourceCtx.getImageData(0,0,cache.sourceCanvas.width,cache.sourceCanvas.height);}
  catch{return true;} // blocked/tainted source: keep original footage unharmed
  buildEngineHeatFrame(sourcePixels,cache.sourceCanvas.width,cache.sourceCanvas.height,e,cycle,cache.out.data);
  cache.outputCtx.putImageData(cache.out,0,0);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(cache.outputCanvas,0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
