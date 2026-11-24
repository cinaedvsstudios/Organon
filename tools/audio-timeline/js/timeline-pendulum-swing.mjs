/**
 * MotoriClip #66: Pendulum Swing.
 *
 * A physically paced, pivot-anchored image swing rather than one uniform
 * arbitrary rotation. The camera/projected source moves about an editable
 * suspension point with natural slow turnarounds, fast mid-arc travel,
 * damping, subtle flexible lag and an actual multi-time shutter exposure.
 *
 * All animation derives from absolute clip-relative seconds. This pure
 * RGBA renderer is shared by Chrome preview and encoded fixed-frame export.
 */
const clamp=(value,min,max,fallback=min)=>{
 const n=Number(value);
 return Math.min(max,Math.max(min,Number.isFinite(n)?n:fallback));
};
const options=(e={})=>({
 period:clamp(e.pendulumPeriod,.6,6,2.6),
 damping:clamp(e.pendulumDamping,0,100,18)/100,
 shutter:clamp(e.pendulumShutter,0,100,45)/100,
 flex:clamp(e.pendulumFlex,0,100,14)/100,
 phase:clamp(e.direction,-180,180,0)*Math.PI/180,
 amplitude:Math.min(.85,.48*clamp(e.distortion,0,100,55)/100*
             clamp(e.scale,10,300,100)/100),
 pivotX:clamp(e.originX,0,100,50)/100,
 pivotY:clamp(e.originY,0,100,10)/100
});
const energy=(t,p)=>Math.exp(-p.damping*.92*Math.max(0,t));
function angleAt(t,p){
 const phase=t*Math.PI*2/p.period+p.phase;
 // Constant-period pendulum: velocity is naturally maximal at vertical and
 // zero at the turning points, while amplitude decays smoothly over time.
 return p.amplitude*Math.cos(phase)*energy(t,p);
}
function elasticAt(t,p){
 const phase=t*Math.PI*2/p.period+p.phase;
 return p.amplitude*.10*p.flex*Math.sin(2*phase-.65)*energy(t,p);
}
/** Pure snapshot describing the swing's suspension point, angle and speed. */
export function pendulumSwingFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const t=Math.max(0,Number(seconds)||0),p=options(effect);
 const dt=.001,angle=angleAt(t,p);
 const velocity=(angleAt(t+dt,p)-angleAt(Math.max(0,t-dt),p))/
  (t<dt?dt:dt*2);
 return {width:w,height:h,time:t,pivotX:w*p.pivotX,pivotY:h*p.pivotY,
  angle,angularVelocity:velocity,energy:energy(t,p),
  flexibleLag:elasticAt(t,p),params:p};
}
function sample(src,w,h,x,y,c){
 const xx=clamp(x,0,w-1,0),yy=clamp(y,0,h-1,0);
 const x0=Math.floor(xx),y0=Math.floor(yy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1);
 const fx=xx-x0,fy=yy-y0;
 const i=(y0*w+x0)*4+c,j=(y0*w+x1)*4+c;
 const k=(y1*w+x0)*4+c,l=(y1*w+x1)*4+c;
 return (src[i]*(1-fx)+src[j]*fx)*(1-fy)+(src[k]*(1-fx)+src[l]*fx)*fy;
}
/**
 * Pixel-space inverse rotation around a fixed suspension anchor.
 * Shutter samples at multiple nearby absolute times: movement looks like
 * actual captured motion rather than a static double-image over the frame.
 * Every destination alpha comes from the original source, and no opaque
 * shapes are invented in transparent regions.
 */
export function buildPendulumSwingFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height)),src=source?.data||source;
 if(!src||src.length!==w*h*4)throw Error('Pendulum Swing requires a matching RGBA source');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);
 data.set(src);
 const state=pendulumSwingFrameState(w,h,effect,seconds),p=state.params;
 const hasBlur=p.shutter>.001,dt=p.shutter*.09;
 const times=hasBlur?[Math.max(0,state.time-dt),state.time, state.time+dt]:[state.time];
 const weights=hasBlur?[.25,.5,.25]:[1];
 const pose=times.map(t=>({angle:angleAt(t,p),lag:elasticAt(t,p)}));
 const pivotX=state.pivotX,pivotY=state.pivotY,radius=Math.hypot(w,h)||1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(src[i+3]===0)continue;
  const rx=x-pivotX,ry=y-pivotY;
  const radial=Math.min(1,Math.hypot(rx,ry)/radius);
  const out=[0,0,0];
  for(let j=0;j<pose.length;j++){
   const p0=pose[j],a=p0.angle+p0.lag*radial;
   const c=Math.cos(a),s=Math.sin(a);
   // Inverse mapping from output to source, anchored at precisely the pivot.
   const sx=pivotX+rx*c+ry*s,sy=pivotY-rx*s+ry*c;
   const weight=weights[j];
   for(let channel=0;channel<3;channel++)
    out[channel]+=sample(src,w,h,sx,sy,channel)*weight;
  }
  data[i]=out[0];data[i+1]=out[1];data[i+2]=out[2];
  data[i+3]=src[i+3];
 }
 return {width:w,height:h,data,state};
}
const CACHE=new WeakMap();
function canvasCache(ctx,width,height){
 const scale=Math.min(1,512/Math.max(width,height));
 const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
 let cache=CACHE.get(ctx);
 if(!cache){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
  const c=canvas?.getContext('2d',{willReadFrequently:true});
  if(!c)return null;
  cache={canvas,c,image:null};CACHE.set(ctx,cache);
 }
 if(cache.canvas.width!==w||cache.canvas.height!==h){
  cache.canvas.width=w;cache.canvas.height=h;cache.image=null;
 }
 return cache;
}
/** Bounded scratch renderer shared by preview, seeking and encoded export. */
export function renderPendulumSwing(ctx,source,width,height,effect={},seconds=0,amount=1){
 const alpha=clamp(amount,0,1,1);
 if(alpha<=0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const cache=source&&canvasCache(ctx,w,h);
 if(!cache)return false;
 const {canvas,c}=cache,sw=canvas.width,sh=canvas.height;
 c.setTransform?.(1,0,0,1,0,0);
 c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';
 c.clearRect(0,0,sw,sh);c.drawImage(source,0,0,sw,sh);
 let original;try{original=c.getImageData(0,0,sw,sh);}catch{return false;}
 const output=buildPendulumSwingFrame(original,sw,sh,effect,seconds,cache.image?.data);
 if(!cache.image||cache.image.data.length!==output.data.length)cache.image=c.createImageData(sw,sh);
 const result=cache.image.data;result.set(output.data);
 if(alpha<1)for(let i=0;i<result.length;i+=4){
  for(let c=0;c<3;c++)
   result[i+c]=original.data[i+c]+(result[i+c]-original.data[i+c])*alpha;
  result[i+3]=original.data[i+3];
 }
 c.putImageData(cache.image,0,0);
 ctx.save();
 try{
  ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(canvas,0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
