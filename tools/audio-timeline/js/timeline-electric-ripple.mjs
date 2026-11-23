/**
 * MotoriClip #66 quality audit — Electric Ripple.
 *
 * The legacy effect shifted 36 equal video strips and overlaid four jagged
 * strokes. This independent painter generates irregular, outward-travelling
 * electrical wavefronts with forks, luminous cores, local source refraction
 * and red/cyan chromatic separation. The wave motion is NOT water refraction:
 * pulse gaps, branching discharges and high-frequency electric flicker are
 * specific to this preset. All state is a pure function of absolute
 * clip-relative seconds and the stored seed, including backwards seeking.
 */
const clamp=(v,min,max,fallback=min)=>{
 const n=Number(v);return Math.max(min,Math.min(max,Number.isFinite(n)?n:fallback));
};
const fract=n=>((n%1)+1)%1;
const ease=n=>{const t=clamp(n,0,1,0);return t*t*(3-2*t);};
function noise(a,b=0){
 let n=(Math.imul((a|0)+139,0x9e3779b1)^Math.imul((b|0)+83,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
}
function parseColor(v){
 const hex=/^#[0-9a-f]{6}$/i.test(String(v))?String(v):'#83dcff';
 return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
}
const params=e=>({
 density:clamp(e.density,1,120,52),
 scale:clamp(e.scale,10,300,100)/100,
 distortion:clamp(e.distortion,0,100,76)/100,
 direction:clamp(e.direction,-180,180,0)*Math.PI/180,
 originX:clamp(e.originX,0,100,50)/100,
 originY:clamp(e.originY,0,100,50)/100,
 branches:Math.round(clamp(e.electricBranches,0,4,2)),
 width:clamp(e.electricWidth,1,20,6),
 chroma:clamp(e.electricChroma,0,100,67)/100,
 flicker:clamp(e.electricFlicker,0,100,70)/100,
 glow:clamp(e.glow,0,100,75)/100,
 seed:Math.round(clamp(e.electricSeed,0,99999,7272)),
 color:parseColor(e.color)
});
function angularNoise(angle,wave){
 const sections=64;
 const pos=fract(angle/(Math.PI*2))*sections;
 const i=Math.floor(pos),t=ease(pos-i);
 return (noise(i+wave.generation*79+wave.index*121,wave.seed)*(1-t)+
  noise((i+1)%sections+wave.generation*79+wave.index*121,wave.seed)*t)*2-1;
}
function tangentBranch(wave,id,size,parameter){
 const key=wave.seed+wave.generation*113+wave.index*101+id*419;
 const angle=Math.PI*2*noise(key,45);
 const radius=wave.radius*(1+angularNoise(angle,wave)*wave.jagged);
 const x0=wave.cx+Math.cos(angle)*radius,y0=wave.cy+Math.sin(angle)*radius;
 const turn=(noise(key,46)>.5?1:-1)*(0.35+.8*noise(key,47));
 const distance=size*(.035+.13*noise(key,48))*parameter.scale;
 const nodes=[];
 for(let step=0;step<=5;step++){
  const t=step/5,theta=angle+turn*t;
  const offset=Math.sin(step*9+noise(key,49)*7)*size*.013*parameter.distortion*Math.sin(Math.PI*t);
  nodes.push({x:x0+Math.cos(theta)*distance*t-Math.sin(theta)*offset,
   y:y0+Math.sin(theta)*distance*t+Math.cos(theta)*offset});
 }
 return {nodes,key,energy:wave.energy*(.58+.42*noise(key,50))};
}
/** Inspectable, time-seeded wavefront and fork geometry. */
export function electricRippleFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const p=params(effect),time=Math.max(0,Number(seconds)||0);
 const D=Math.min(w,h),waves=[],branches=[];
 const count=Math.min(5,1+Math.ceil(p.density/29));
 const rate=.36+p.density*.0015;
 for(let index=0;index<count;index++){
  const timeline=time*rate+index/count*.86;
  const generation=Math.floor(timeline),phase=fract(timeline);
  // Expands from the saved emitter; later waves occupy staggered phases.
  const offsetX=index===0?0:(noise(index+generation*137,p.seed+1)-.5)*w*.24;
  const offsetY=index===0?0:(noise(index+generation*137,p.seed+2)-.5)*h*.24;
  const cx=w*p.originX+offsetX+Math.cos(p.direction)*D*.08*phase;
  const cy=h*p.originY+offsetY+Math.sin(p.direction)*D*.08*phase;
  const radius=D*p.scale*(.035+1.03*phase);
  const energy=Math.pow(1-phase,.86)*(.78+.22*noise(index+generation*137,p.seed+3));
  const wave={index,generation,phase,cx,cy,radius,
   energy,seed:p.seed,jagged:(.018+.135*p.distortion)*p.scale,
   thickness:Math.max(.7,D*(.003+.0018*p.width)),
   flicker:.72+.28*Math.sin(time*(12+14*p.flicker)+index*8.3),
   gapSeed:p.seed+index*113+generation*719};
  waves.push(wave);
  for(let id=0;id<p.branches;id++)branches.push(tangentBranch(wave,id,D,p));
 }
 return {width:w,height:h,time,params:p,waves,branches};
}
function bilinear(src,w,h,x,y,channel){
 const xx=clamp(x,0,w-1,0),yy=clamp(y,0,h-1,0);
 const x0=Math.floor(xx),y0=Math.floor(yy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1);
 const dx=xx-x0,dy=yy-y0;
 const a=(y0*w+x0)*4+channel,b=(y0*w+x1)*4+channel;
 const c=(y1*w+x0)*4+channel,d=(y1*w+x1)*4+channel;
 return (src[a]*(1-dx)+src[b]*dx)*(1-dy)+(src[c]*(1-dx)+src[d]*dx)*dy;
}
function segmentDistance(x,y,a,b){
 const vx=b.x-a.x,vy=b.y-a.y;
 const u=clamp(((x-a.x)*vx+(y-a.y)*vy)/(vx*vx+vy*vy||1),0,1,0);
 return Math.hypot(x-(a.x+vx*u),y-(a.y+vy*u));
}
/**
 * Direct RGBA source transform. Pixel alpha is always taken from the original
 * source; transparent source regions never receive fabricated coloured arcs.
 */
export function buildElectricRippleFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const src=source?.data||source;
 if(!src||src.length!==w*h*4)throw Error('Electric Ripple requires matching RGBA source');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);
 data.set(src);
 const state=electricRippleFrameState(w,h,effect,seconds),p=state.params,D=Math.min(w,h);
 const maximumGlow=p.glow*(.14+.38*p.flicker);
 const doublePi=Math.PI*2;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=(y*w+x)*4;
  if(src[k+3]===0)continue;
  let total=0,core=0,rX=0,rY=0,tX=0,tY=0;
  for(const wave of state.waves){
   const vx=x-wave.cx,vy=y-wave.cy,dist=Math.hypot(vx,vy);
   if(dist<.01)continue;
   const angle=Math.atan2(vy,vx)+Math.PI;
   const aNoise=angularNoise(angle,wave);
   const irregularRadius=wave.radius*(1+aNoise*wave.jagged);
   const delta=dist-irregularRadius,spread=wave.thickness*(1.4+2.4*p.glow);
   if(Math.abs(delta)>spread*2.7)continue;
   const gap=noise(Math.floor(angle/doublePi*40)+wave.gapSeed,p.seed+7);
   if(gap<.10+.17*p.flicker)continue;
   const envelope=Math.exp(-.5*(delta/spread)**2);
   const localCore=Math.exp(-.5*(delta/Math.max(.55,wave.thickness))**2);
   const strength=envelope*wave.energy*wave.flicker;
   total+=strength;core+=localCore*wave.energy*wave.flicker;
   const radialMagnitude=D*(.006+.025*p.distortion)*strength;
   rX+=(vx/dist)*radialMagnitude;
   rY+=(vy/dist)*radialMagnitude;
   tX+=(-vy/dist)*strength;tY+=(vx/dist)*strength;
  }
  // Short branching tendrils fork off the expanding high-voltage front.
  for(const branch of state.branches){
   if(x<branch.nodes[0].x-D*.2||x>branch.nodes[0].x+D*.2||
      y<branch.nodes[0].y-D*.2||y>branch.nodes[0].y+D*.2)continue;
   let closest=1e10;
   for(let i=1;i<branch.nodes.length;i++)
    closest=Math.min(closest,segmentDistance(x,y,branch.nodes[i-1],branch.nodes[i]));
   const kWidth=Math.max(.6,D*.006*p.scale);
   if(closest>kWidth*5)continue;
   const energy=branch.energy;
   total+=Math.exp(-.5*(closest/(kWidth*2.3))**2)*energy*.5;
   core+=Math.exp(-.5*(closest/kWidth)**2)*energy*.52;
  }
  if(total<.004&&core<.004)continue;
  const tangent=Math.hypot(tX,tY)||1;
  const shift=clamp(p.chroma*(1+2.4*total),0,5,0);
  const gain=clamp(total*maximumGlow+core*.55,0,.94,0);
  const white=clamp(core*.70,0,.9,0);
  for(let c=0;c<3;c++){
   const fringing=(c===0?shift:c===2?-shift:0);
   const sample=p.distortion||p.chroma
    ?bilinear(src,w,h,x+rX+fringing*tX/tangent,y+rY+fringing*tY/tangent,c)
    :src[k+c];
   const lit=sample+(p.color[c]-sample)*gain;
   data[k+c]=lit+(255-lit)*white;
  }
  data[k+3]=src[k+3];
 }
 return {width:w,height:h,data,state};
}
const SCRATCH=new WeakMap();
function scratch(ctx,width,height){
 const factor=Math.min(1,512/Math.max(width,height));
 const w=Math.max(1,Math.round(width*factor)),h=Math.max(1,Math.round(height*factor));
 let c=SCRATCH.get(ctx);
 if(!c){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
  const context=canvas?.getContext('2d',{willReadFrequently:true});
  if(!context)return null;
  c={canvas,context,image:null};SCRATCH.set(ctx,c);
 }
 if(c.canvas.width!==w||c.canvas.height!==h){
  c.canvas.width=w;c.canvas.height=h;c.image=null;
 }
 return c;
}
/** Shared preview and fixed-frame MP4 painter. No frame counters, no timers. */
export function renderElectricRipple(ctx,source,width,height,effect={},seconds=0,amount=1){
 const alpha=clamp(amount,0,1,1);if(alpha<=0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const cache=source&&scratch(ctx,w,h);
 if(!cache)return false;
 const {canvas,context}=cache,sw=canvas.width,sh=canvas.height;
 context.setTransform?.(1,0,0,1,0,0);
 context.globalAlpha=1;context.globalCompositeOperation='source-over';context.filter='none';
 context.clearRect(0,0,sw,sh);context.drawImage(source,0,0,sw,sh);
 let original;try{original=context.getImageData(0,0,sw,sh);}catch{return false;}
 const frame=buildElectricRippleFrame(original,sw,sh,effect,seconds,cache.image?.data);
 if(!cache.image||cache.image.data.length!==frame.data.length)
  cache.image=context.createImageData(sw,sh);
 const out=cache.image.data;out.set(frame.data);
 if(alpha<1)for(let i=0;i<out.length;i+=4){
  for(let c=0;c<3;c++)out[i+c]=original.data[i+c]+(out[i+c]-original.data[i+c])*alpha;
  out[i+3]=original.data[i+3];
 }
 context.putImageData(cache.image,0,0);
 ctx.save();
 try{
  ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;
  ctx.imageSmoothingEnabled=true;ctx.drawImage(canvas,0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
