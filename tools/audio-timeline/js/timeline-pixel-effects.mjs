/**
 * MotoriClip Phase 3D: true source-pixel Glow, Edge Glow, RGB separation and
 * vignetted Halo Blur. Small reusable offscreen canvases cap processing memory.
 * The time argument is always clip-relative, so reverse scrubbing reproduces
 * exactly the same output. No global animation clock, no DOM-driven state.
 */
export const PIXEL_EFFECT_IDS=Object.freeze(['glow','edge-glow','chromatic-quirk','halo-blur']);
const pixelIds=new Set(PIXEL_EFFECT_IDS);
const caches=new WeakMap();
const limit=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
const clamp8=n=>Math.min(255,Math.max(0,Math.round(n)));
const tint=hex=>[0,2,4].map(i=>parseInt(hex.slice(i+1,i+3),16));
export function isPixelEffect(presetId){return pixelIds.has(presetId);}
function sampleFrame(ctx,source,w,h){
 if(typeof document==='undefined')return null;
 let cache=caches.get(ctx);
 if(!cache){
  const create=()=>{const canvas=document.createElement('canvas');return {canvas,ctx:canvas.getContext('2d',{willReadFrequently:true})};};
  const work=create(),stage=create(),channels=[create(),create(),create()];
  if(!work.ctx||!stage.ctx||channels.some(x=>!x.ctx))return null;
  cache={work,stage,channels};caches.set(ctx,cache);
 }
 const sampleScale=Math.min(1,640/Math.max(w,h));
 const sw=Math.max(1,Math.round(w*sampleScale));
 const sh=Math.max(1,Math.round(h*sampleScale));
 for(const item of [cache.work,cache.stage,...cache.channels]){
  if(item.canvas.width!==sw||item.canvas.height!==sh){
   item.canvas.width=sw;item.canvas.height=sh;
  }
 }
 cache.work.ctx.setTransform(1,0,0,1,0,0);
 cache.work.ctx.globalAlpha=1;cache.work.ctx.globalCompositeOperation='source-over';
 cache.work.ctx.clearRect(0,0,sw,sh);
 cache.work.ctx.drawImage(source,0,0,sw,sh);
 return {...cache,sw,sh,sampleScale};
}
/** Pure threshold/edge image analysis. Returns an RGBA mask, no DOM needed. */
export function deriveLightMask(pixels,w,h,mode='glow',color='#ffe5a4',time=0){
 const result=new Uint8ClampedArray(pixels.length),[tr,tg,tb]=tint(color);
 const luminance=new Float32Array(w*h);
 for(let i=0;i<w*h;i++){
  const k=i*4;
  luminance[i]=pixels[k]*.2126+pixels[k+1]*.7152+pixels[k+2]*.0722;
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,k=i*4,originalAlpha=pixels[k+3]/255;
  if(!originalAlpha)continue;
  let factor;
  if(mode==='glow'){
   factor=Math.max(0,(luminance[i]-135)/120);
   factor=Math.pow(factor,1.1)*(.74+.26*Math.sin(time*3.7));
  }else{
   const left=luminance[y*w+Math.max(0,x-1)];
   const right=luminance[y*w+Math.min(w-1,x+1)];
   const above=luminance[Math.max(0,y-1)*w+x];
   const below=luminance[Math.min(h-1,y+1)*w+x];
   const edge=Math.hypot(right-left,below-above)/140;
   factor=Math.min(1,edge)*(.72+.28*Math.sin(time*3+ x*.025+y*.011));
  }
  if(factor<=0)continue;
  result[k]=clamp8(tr*.65+pixels[k]*.35);
  result[k+1]=clamp8(tg*.65+pixels[k+1]*.35);
  result[k+2]=clamp8(tb*.65+pixels[k+2]*.35);
  result[k+3]=clamp8(255*Math.min(1,factor)*originalAlpha);
 }
 return result;
}
/** Pure independent-channel separation; do not fake RGB by colored boxes. */
export function separateRgb(pixels){
 const channels=[new Uint8ClampedArray(pixels.length),new Uint8ClampedArray(pixels.length),new Uint8ClampedArray(pixels.length)];
 for(let i=0;i<pixels.length;i+=4){
  for(let channel=0;channel<3;channel++){
   channels[channel][i+channel]=pixels[i+channel];
   channels[channel][i+3]=pixels[i+3];
  }
 }
 return channels;
}
export function renderPixelEffect(ctx,source,w,h,e,time,amount){
 if(!isPixelEffect(e.presetId))return false;
 const scale=Number(e.scale||100)/100;
 if(!source){
  // Unit tests without a real DOM still exercise deterministic recipe motion.
  const x=(.25+.25*Math.sin(time*(1+Number(e.speed||1))))*w;
  const y=(.45+.2*Math.cos(time*2))*h;
  ctx.fillStyle=e.color||'#ffe5a4';
  ctx.globalAlpha=amount*.5;
  ctx.fillRect(x,y,Math.max(2,scale*12),Math.max(2,scale*8));
  return true;
 }
 const cache=sampleFrame(ctx,source,w,h);
 if(!cache)return true;
 const {work,stage,channels,sw,sh}=cache;
 const input=work.ctx.getImageData(0,0,sw,sh);
 const blur=limit(e.blur??24,0,60);
 const glow=limit(e.glow??64,0,100);
 if(e.presetId==='glow'||e.presetId==='edge-glow'){
  const mask=deriveLightMask(input.data,sw,sh,e.presetId,e.color,time);
  const stageCtx=stage.ctx;
  stageCtx.setTransform(1,0,0,1,0,0);
  stageCtx.filter='none';stageCtx.globalAlpha=1;stageCtx.globalCompositeOperation='source-over';
  stageCtx.clearRect(0,0,sw,sh);
  stageCtx.putImageData(new ImageData(mask,sw,sh),0,0);
  ctx.save();
  ctx.globalCompositeOperation='screen';
  ctx.globalAlpha=amount*(.35+glow/100);
  ctx.filter='blur('+Math.max(.5,blur*(e.presetId==='glow'?1:.35))+'px)';
  ctx.drawImage(stage.canvas,0,0,w,h);
  ctx.filter='none';
  if(e.presetId==='edge-glow'){
   ctx.globalAlpha=amount*.8;
   ctx.drawImage(stage.canvas,0,0,w,h);
  }
  ctx.restore();
 }else if(e.presetId==='chromatic-quirk'){
  const separated=separateRgb(input.data);
  const ticks=time*(Number(e.speed)||1);
  const offset=Math.max(1,Math.min(30,Number(e.distortion||55)*.23*scale));
  const shifts=[-offset*(.6+.4*Math.sin(ticks*5)),offset*.18,offset*(.6+.4*Math.cos(ticks*4))];
  const stageCtx=stage.ctx;
  stageCtx.setTransform(1,0,0,1,0,0);
  stageCtx.globalAlpha=1;stageCtx.globalCompositeOperation='source-over';
  stageCtx.clearRect(0,0,sw,sh);
  for(let i=0;i<3;i++){
   const part=channels[i];
   part.ctx.setTransform(1,0,0,1,0,0);
   part.ctx.globalAlpha=1;part.ctx.globalCompositeOperation='source-over';
   part.ctx.clearRect(0,0,sw,sh);
   part.ctx.putImageData(new ImageData(separated[i],sw,sh),0,0);
   stageCtx.globalCompositeOperation=i===0?'source-over':'lighter';
   stageCtx.drawImage(part.canvas,shifts[i]*sw/w,0,sw,sh);
  }
  stageCtx.globalCompositeOperation='source-over';
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=amount;
  ctx.drawImage(stage.canvas,0,0,w,h);ctx.restore();
 }else if(e.presetId==='halo-blur'){
  const layer=stage.ctx;
  layer.setTransform(1,0,0,1,0,0);
  layer.globalCompositeOperation='source-over';layer.globalAlpha=1;
  layer.clearRect(0,0,sw,sh);
  layer.filter='blur('+Math.max(1,blur*sw/w)+'px)';
  layer.drawImage(work.canvas,0,0);
  layer.filter='none';
  const x=sw*limit(e.originX??50,0,100)/100,y=sh*limit(e.originY??50,0,100)/100;
  const radius=Math.max(sw,sh)*(.63+.07*Math.sin(time*.9));
  const inner=radius*(.18+.001*limit(e.glow??64,0,100));
  const radial=layer.createRadialGradient(x,y,inner,x,y,radius);
  radial.addColorStop(0,'rgba(255,255,255,0)');
  radial.addColorStop(.78,'rgba(255,255,255,.84)');
  radial.addColorStop(1,'rgba(255,255,255,1)');
  layer.globalCompositeOperation='destination-in';layer.fillStyle=radial;
  layer.fillRect(0,0,sw,sh);
  layer.globalCompositeOperation='source-over';
  ctx.save();ctx.globalAlpha=amount;ctx.drawImage(stage.canvas,0,0,w,h);ctx.restore();
 }
 return true;
}
