/**
 * MotoriClip #66 quality audit — Ripple Distortion.
 *
 * Source-aware refractive, concentric travelling waves instead of horizontally
 * shifted image strips. Independent impact points, multiple ringlets, local
 * refraction and understated coloured caustic crests operate on the actual
 * lower-layer RGBA source. Absolute clip-local time and a persisted seed make
 * playback, seek-backwards and encoded frame exports exactly reproducible.
 */
const clamp=(v,min,max,fallback=min)=>{
 const n=Number(v);return Math.max(min,Math.min(max,Number.isFinite(n)?n:fallback));
};
const frac=n=>((n%1)+1)%1;
function hash(a,b=0){
 let n=(Math.imul((a|0)+127,0x9e3779b1)^Math.imul((b|0)+71,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
}
function rgb(hex){
 const value=/^#[0-9a-f]{6}$/i.test(String(hex))?String(hex):'#a5dfff';
 return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
}
const settings=(e={})=>({
 density:clamp(e.density,1,120,48),
 scale:clamp(e.scale,10,300,100)/100,
 distortion:clamp(e.distortion,0,100,55)/100,
 direction:clamp(e.direction,-180,180,0)*Math.PI/180,
 originX:clamp(e.originX,0,100,50)/100,
 originY:clamp(e.originY,0,100,50)/100,
 rings:Math.round(clamp(e.rippleRings,1,6,3)),
 width:clamp(e.rippleWidth,2,24,8)/100,
 falloff:clamp(e.rippleFalloff,0,100,58)/100,
 highlights:clamp(e.rippleHighlights,0,100,42)/100,
 seed:Math.round(clamp(e.rippleSeed,0,99999,6262)),
 color:rgb(e.color)
});
/** The resolved physical wavefronts, with no mutable or frame-count state. */
export function rippleDistortionFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const p=settings(effect),t=Math.max(0,Number(seconds)||0),m=Math.min(w,h);
 const impacts=Math.max(1,Math.min(5,Math.round(1+p.density/37)));
 const waves=[],duration=2.3,driftSpeed=m*.012;
 for(let impact=0;impact<impacts;impact++){
  const phase=impact===0?0:hash(impact,p.seed+10);
  const cycle=(t/duration+phase);
  const generation=Math.floor(cycle);
  const life=frac(cycle);
  const key=p.seed+impact*809+generation*137;
  const positionX=impact===0?p.originX:
   clamp(p.originX+(hash(key,11)-.5)*.59,0,1,.5);
  const positionY=impact===0?p.originY:
   clamp(p.originY+(hash(key,12)-.5)*.59,0,1,.5);
  const drift=t*driftSpeed*(.40+.60*hash(key,13));
  const cx=w*positionX+Math.cos(p.direction)*drift;
  const cy=h*positionY+Math.sin(p.direction)*drift;
  for(let j=0;j<p.rings;j++){
   const progress=life-j*(.085+.027*hash(key,14));
   if(progress<=0||progress>=1)continue;
   const radius=m*(.04+progress*.94)*p.scale;
   const energy=Math.pow(1-progress,.67+1.9*p.falloff)
     *(.78+.22*hash(key,15))*(1-j*.075);
   const thickness=m*(.013+p.width*.43)*(.8+.20*hash(key,j+16));
   if(energy<.012||thickness<.4)continue;
   waves.push({impact,generation,j,cx,cy,radius,thickness,energy,
    velocity:m*.94*p.scale/duration,angle:p.direction});
  }
 }
 return {width:w,height:h,time:t,params:p,waves};
}
function bilinear(src,w,h,x,y,c){
 const xx=clamp(x,0,w-1,0),yy=clamp(y,0,h-1,0);
 const x0=Math.floor(xx),y0=Math.floor(yy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1);
 const fx=xx-x0,fy=yy-y0;
 const i=(y0*w+x0)*4+c,j=(y0*w+x1)*4+c,k=(y1*w+x0)*4+c,l=(y1*w+x1)*4+c;
 return ((src[i]*(1-fx)+src[j]*fx)*(1-fy)+(src[k]*(1-fx)+src[l]*fx)*fy);
}
/**
 * Pure source-sampling frame. Only wavefronts touch pixels; the rest of the
 * supplied image and every original alpha byte remain unchanged.
 */
export function buildRippleDistortionFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const src=source?.data||source;
 if(!src||src.length!==w*h*4)throw Error('Ripple Distortion requires matching RGBA source');
 const output=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);
 output.set(src);
 const state=rippleDistortionFrameState(w,h,effect,seconds),p=state.params;
 if(!state.waves.length||(!p.distortion&&!p.highlights))return {width:w,height:h,data:output,state};
 // Image-space sampling is bounded to the actual refracting wavefront strips.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const index=(y*w+x)*4;
  if(src[index+3]===0)continue;
  let radialX=0,radialY=0,crestLight=0,hasWave=false;
  for(const wave of state.waves){
   const dx=x-wave.cx,dy=y-wave.cy,dist=Math.hypot(dx,dy);
   const delta=dist-wave.radius,outer=wave.thickness*2.7;
   if(Math.abs(delta)>outer||dist<.001)continue;
   const u=delta/wave.thickness;
   const envelope=Math.exp(-.5*u*u);
   const carrier=Math.cos(u*1.8);
   const strength=wave.energy*envelope*carrier;
   const px=dx/dist,py=dy/dist;
   const magnitude=Math.min(w,h)*.040*p.distortion*strength;
   radialX+=px*magnitude;radialY+=py*magnitude;
   crestLight+=Math.max(0,strength)*wave.energy*.23;
   hasWave=true;
  }
  if(!hasWave)continue;
  radialX=clamp(radialX,-w*.07,w*.07,0);
  radialY=clamp(radialY,-h*.07,h*.07,0);
  const glow=clamp(crestLight*p.highlights,0,.3,0);
  for(let c=0;c<3;c++){
   const refracted=p.distortion?bilinear(src,w,h,x+radialX,y+radialY,c):src[index+c];
   output[index+c]=refracted+(p.color[c]-refracted)*glow;
  }
  output[index+3]=src[index+3];
 }
 return {width:w,height:h,data:output,state};
}
const SCRATCH=new WeakMap();
function scratch(ctx,width,height){
 const factor=Math.min(1,512/Math.max(width,height));
 const w=Math.max(1,Math.round(width*factor)),h=Math.max(1,Math.round(height*factor));
 let cache=SCRATCH.get(ctx);
 if(!cache){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
    typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
  const c=canvas?.getContext('2d',{willReadFrequently:true});
  if(!canvas||!c)return null;
  cache={canvas,c,image:null};SCRATCH.set(ctx,cache);
 }
 if(cache.canvas.width!==w||cache.canvas.height!==h){
  cache.canvas.width=w;cache.canvas.height=h;cache.image=null;
 }
 return cache;
}
/** Same clipped source-pixel path in live preview, seeking and fixed H.264. */
export function renderRippleDistortion(ctx,source,width,height,effect={},seconds=0,amount=1){
 const strength=clamp(amount,0,1,1);
 if(strength<=0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const cache=source&&scratch(ctx,w,h);
 if(!cache)return false;
 const {canvas,c}=cache,sw=canvas.width,sh=canvas.height;
 c.setTransform?.(1,0,0,1,0,0);
 c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';
 c.clearRect(0,0,sw,sh);c.drawImage(source,0,0,sw,sh);
 let sourceImage;
 try{sourceImage=c.getImageData(0,0,sw,sh);}catch{return false;}
 const output=buildRippleDistortionFrame(sourceImage,sw,sh,effect,seconds,cache.image?.data);
 if(!cache.image||cache.image.data.length!==output.data.length)cache.image=c.createImageData(sw,sh);
 const rgba=cache.image.data;rgba.set(output.data);
 if(strength<1)for(let i=0;i<rgba.length;i+=4){
  for(let channel=0;channel<3;channel++)
   rgba[i+channel]=sourceImage.data[i+channel]+(rgba[i+channel]-sourceImage.data[i+channel])*strength;
  rgba[i+3]=sourceImage.data[i+3];
 }
 c.putImageData(cache.image,0,0);
 ctx.save();
 try{
  ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;
  ctx.drawImage(canvas,0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
