/**
 * MotoriClip #66 audit unit — source-aware cinematic Light Sweep.
 *
 * Previously this preset was a translucent rotated rectangle with a moving
 * linear gradient. It now builds its bloom from REAL source luminance and
 * local highlight/edge geometry, with a soft travelling specular sheet and
 * smaller irregular glittering glints inside it. It never paints a flat white
 * bar over dark footage or creates highlights disconnected from the image.
 *
 * Every pixel is derived solely from source, absolute clip time and settings:
 * reverse seeks, fixed-frame export and live playback are reproducible.
 */
const clamp=(v,lo,hi,fallback=lo)=>{
 const n=Number(v);return Math.max(lo,Math.min(hi,Number.isFinite(n)?n:fallback));
};
const wrap=value=>((value%1)+1)%1;
function hash(a,b=0){
 let n=(Math.imul((a|0)+49,0x9e3779b1)^Math.imul((b|0)+83,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
}
function rgb(hex){
 const value=/^#[0-9a-f]{6}$/i.test(String(hex))?String(hex):'#ffd98d';
 return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
}
function options(e={}){
 return {
  strength:clamp(e.intensity,0,100,70)/100,
  width:clamp(e.scale,10,300,100)/100,
  direction:clamp(e.direction,-180,180,0)*Math.PI/180,
  detail:clamp(e.density,1,120,48)/120,
  glow:clamp(e.glow,0,100,64)/100,
  softness:clamp(e.blur,0,60,24)/60,
  color:rgb(e.color)
 };
}
/** Pure sweep geometry in normalized image coordinates. */
export function lightSweepFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const p=options(effect),t=Math.max(0,Number(seconds)||0);
 const phase=wrap(t*.38),centre=-.8+1.6*phase;
 const beamWidth=(.022+.045*p.width)*(1+.7*p.softness);
 return {width:w,height:h,time:t,centre,phase,beamWidth,
  axisX:Math.cos(p.direction),axisY:Math.sin(p.direction),params:p};
}
export function buildLightSweepFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const rgba=source?.data||source;
 if(!rgba||rgba.length!==w*h*4)throw Error('Light Sweep requires RGBA source matching dimensions');
 const dst=reuse?.length===rgba.length&&reuse!==rgba?reuse:new Uint8ClampedArray(rgba.length);
 dst.set(rgba);
 const state=lightSweepFrameState(w,h,effect,seconds),p=state.params;
 if(!p.strength)return {width:w,height:h,data:dst,state};
 const luminance=(x,y)=>{
  const xx=Math.max(0,Math.min(w-1,x)),yy=Math.max(0,Math.min(h-1,y));
  const i=(yy*w+xx)*4;
  return (rgba[i]*.2126+rgba[i+1]*.7152+rgba[i+2]*.0722)/255;
 };
 // Brightness follows image contours. The narrow travelling core acquires
 // irregular edge glints; the broad falloff is subtle and scene-dependent.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;
  if(rgba[i+3]===0)continue;
  const xx=x/w-.5,yy=y/h-.5;
  const bend=Math.sin(yy*14+xx*6+state.time*2.1)*.005*p.softness;
  const distance=xx*state.axisX+yy*state.axisY-state.centre+bend;
  if(Math.abs(distance)>state.beamWidth*4.2)continue;
  const norm=distance/state.beamWidth;
  const core=Math.exp(-.5*norm*norm);
  const halo=Math.exp(-.5*(norm/2.8)*(norm/2.8));
  if(core<.002&&halo<.002)continue;
  const lum=luminance(x,y);
  const edge=Math.min(1,
   (Math.abs(lum-luminance(x+2,y))+
    Math.abs(lum-luminance(x,y+2)))*3.5);
  const cell=Math.max(5,Math.round(22-15*p.detail));
  const cellX=Math.floor(x/cell),cellY=Math.floor(y/cell);
  const irregular=hash(cellX*59+cellY,19);
  const pulse=.55+.45*Math.sin(state.time*(9+irregular*7)+irregular*11);
  const sparkle=Math.max(0,irregular-(.90-.25*p.detail))*2.2*pulse;
  const content=.04+.57*Math.pow(lum,1.25)+.62*edge;
  const light=core*(.62+.38*p.glow)+halo*.16*p.glow;
  const glint=core*edge*sparkle*.85;
  const boost=clamp(p.strength*(light*content+glint),0,.95);
  for(let c=0;c<3;c++){
   const tint=.45+.55*p.color[c]/255;
   dst[i+c]=rgba[i+c]+(255-rgba[i+c])*boost*tint;
  }
  dst[i+3]=rgba[i+3]; // transparencies never changed, including partial alpha
 }
 return {width:w,height:h,data:dst,state};
}
const SCRATCH=new WeakMap();
function scratch(ctx,w,h){
 let item=SCRATCH.get(ctx);
 const scale=Math.min(1,512/Math.max(w,h));
 const sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));
 if(!item){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(sw,sh):null;
  const c=canvas?.getContext('2d',{willReadFrequently:true});
  if(!canvas||!c)return null;
  item={canvas,c,image:null};SCRATCH.set(ctx,item);
 }
 if(item.canvas.width!==sw||item.canvas.height!==sh){
  item.canvas.width=sw;item.canvas.height=sh;item.image=null;
 }
 return item;
}
function fallback(ctx,w,h,e,time,amount){
 // For preview-only canvases without a captured video source, draw a subdued
 // transparent sheen. Actual editor/export applies the source-aware painter.
 const state=lightSweepFrameState(w,h,e,time),p=state.params;
 const px=w*(.5+state.centre*state.axisX),py=h*(.5+state.centre*state.axisY);
 const span=Math.max(w,h)*(.09+.10*p.width);
 ctx.save();
 try{
  ctx.translate(px,py);ctx.rotate(p.direction);
  const g=ctx.createLinearGradient(-span,0,span,0);
  const color=p.color;
  g.addColorStop(0,'rgba(255,255,255,0)');
  g.addColorStop(.47,'rgba('+color.join(',')+','+(p.strength*.08*amount)+')');
  g.addColorStop(.5,'rgba('+color.join(',')+','+(p.strength*.2*amount)+')');
  g.addColorStop(.53,'rgba('+color.join(',')+','+(p.strength*.08*amount)+')');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.fillRect(-span,-h*1.7,span*2,h*3.4);
 }finally{ctx.restore();}
 return true;
}
/** Identical live and exported pixel path with reusable, 512px-bounded scratch. */
export function renderLightSweep(ctx,source,width,height,effect={},seconds=0,amount=1){
 const a=clamp(amount,0,1,1);
 if(a<=0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const item=source&&scratch(ctx,w,h);
 if(!item)return fallback(ctx,w,h,effect,seconds,a);
 const {canvas,c}=item,sw=canvas.width,sh=canvas.height;
 c.setTransform?.(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';
 c.clearRect(0,0,sw,sh);c.drawImage(source,0,0,sw,sh);
 let original;
 try{original=c.getImageData(0,0,sw,sh);}catch{return false;}
 const frame=buildLightSweepFrame(original,sw,sh,{...effect,intensity:100},seconds,item.image?.data);
 if(!item.image||item.image.data?.length!==frame.data.length)item.image=c.createImageData(sw,sh);
 const dst=item.image.data;dst.set(frame.data);
 if(a<1)for(let i=0;i<dst.length;i+=4){
  dst[i]=original.data[i]+(dst[i]-original.data[i])*a;
  dst[i+1]=original.data[i+1]+(dst[i+1]-original.data[i+1])*a;
  dst[i+2]=original.data[i+2]+(dst[i+2]-original.data[i+2])*a;
  dst[i+3]=original.data[i+3];
 }
 c.putImageData(item.image,0,0);
 ctx.save();
 try{
  ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;
  ctx.drawImage(canvas,0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
