/**
 * MotoriClip #58 — Mist / Fog Bank (independent of #49 Hazy Atmosphere).
 *
 * A physically suggestive low cloud bank with a scalloped, branching top,
 * detached wisps and three rolling depth planes. There is no checkerboard,
 * opaque backing, translating texture, frame counter or wall-clock input.
 * Every image derives solely from saved parameters and clip-relative seconds.
 */
const clamp=(v,min,max,fallback=min)=>{
 const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
};
const smooth=(a,b,v)=>{const x=clamp((v-a)/Math.max(.0001,b-a),0,1);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
const TABLES=new Map();
function lattice(seed){
 if(TABLES.has(seed))return TABLES.get(seed);
 const data=new Float32Array(64*64);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  let v=(Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(seed+1,2246822519))>>>0;
  v^=v>>>13;v=Math.imul(v,1274126177)>>>0;v^=v>>>16;
  data[y*64+x]=(v>>>0)/4294967296;
 }
 // Don't retain unlimited lookup tables after successive changes to seed.
 if(TABLES.size>=12)TABLES.delete(TABLES.keys().next().value);
 TABLES.set(seed,data);
 return data;
}
function noise(x,y,seed){
 const ix=Math.floor(x),iy=Math.floor(y),tx=smooth(0,1,x-ix),ty=smooth(0,1,y-iy);
 const table=lattice(seed),x0=ix&63,x1=(ix+1)&63,y0=(iy&63)*64,y1=((iy+1)&63)*64;
 return mix(mix(table[y0+x0],table[y0+x1],tx),
  mix(table[y1+x0],table[y1+x1],tx),ty);
}
function settings(effect={}){
 const hex=/^#[0-9a-f]{6}$/i.test(String(effect.color))?String(effect.color):'#dce5ec';
 return {
  rgb:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),
  density:clamp(effect.density??73,1,120)/120,
  opacity:clamp(effect.intensity??78,0,100)/100,
  spread:clamp(effect.scale??100,10,300)/100,
  windSpeed:clamp(effect.windSpeed??1.2,0,4),
  bankHeight:clamp(effect.bankHeight??64,15,90)/100,
  seed:Math.round(clamp(effect.seed??58,0,99999)),
  direction:clamp(effect.direction??0,-180,180)*Math.PI/180,
  turbulence:clamp(effect.distortion??65,0,100)/100,
  feather:clamp(effect.blur??34,0,60)/60
 };
}
/** One point in the volume: three separate moving noise/mist depths. */
function sampleLayers(u,v,o,t){
 const layers=[];
 for(let d=0;d<3;d++){
  const wind=t*o.windSpeed*(.038+d*.021);
  const scale=(2.1+d*.75)/o.spread;
  const px=(u+Math.cos(o.direction)*wind)*scale;
  const py=(v+Math.sin(o.direction)*wind*.55)*scale;
  // Domain warping bends the local volume: fog rolls internally as well as
  // advecting as a whole, rather than moving a frozen cloud texture.
  const warpX=Math.sin(py*1.67+t*(.24+d*.07)+d*2.13)*
              Math.cos(px*.83-t*.17+d);
  const warpY=Math.cos(px*1.41-t*.21+d*1.51)*
              Math.sin(py*1.12+t*.19);
  const wx=px+warpX*(.15+.45*o.turbulence);
  const wy=py+warpY*(.14+.38*o.turbulence);
  const broad=noise(wx*.88,wy*.91,d*107+o.seed);
  const detail=noise(wx*2.37+t*.09,wy*2.11-t*.075,d*107+o.seed+31);
  const fine=noise(wx*4.11-t*.12,wy*3.7+t*.13,d*107+o.seed+65);
  const body=.50*broad+.34*detail+.16*fine;
  // Banks sit lower than the haze (#49); lobes and branching wisps rise
  // above an irregular feathered crest. The background stays truly clear.
  // Asymmetric feathered crests and raised cloud lobes create a recognisable
  // fog BANK rather than a horizontal colour wash. The volume rises with
  // density; separate layers have visibly different irregular silhouettes.
  const lobe=Math.pow(Math.max(0,Math.sin(px*1.65+t*.23+d*1.72)),2);
  const crest=o.bankHeight-.10-d*.065
   -(.40+o.turbulence*.16)*(broad-.45)
   -.18*(detail-.49)-.09*lobe
   -.065*Math.sin(px*2.1+t*.34+d);
  const edge=.018+.10*o.feather;
  const bank=smooth(crest-edge,crest+edge,v);
  const plumeCenter=crest-.09-.075*(fine-.5);
  const plume=1-smooth(.035,.13+o.feather*.075,Math.abs(v-plumeCenter));
  const fingers=plume*smooth(.42-o.density*.16,.70-o.density*.05,body)
    *(.48+.42*d/2);
  const densityMask=smooth(.36-o.density*.11,.72-o.density*.05,body);
  const internal=.40+.75*body+.20*Math.sin(t*.41+d+px*.79);
  // Fog never paints an opaque sky/whole-frame wash: upper air remains
  // transparent even when a seeded crest briefly branches above the horizon.
  const clearSky=smooth(.30,.59,v);
  const alpha=clamp(
   ((bank*(.12+.95*densityMask)+fingers*.90)
    *(.26+.24*o.density)*internal*o.opacity*clearSky),0,.52);
  layers.push({depth:d,alpha,body,crest,bank,fingers,wind});
 }
 return layers;
}
export function sampleMistFogLayers(nx,ny,effect={},seconds=0){
 return sampleLayers(clamp(nx,0,1),clamp(ny,0,1),settings(effect),
  Math.max(0,Number(seconds)||0));
}
/** Alpha-only fog: source video is never drawn or cleared by this module. */
export function buildMistFogFrame(width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(Number(width)||1)),h=Math.max(1,Math.round(Number(height)||1));
 const data=reuse?.length===w*h*4?reuse:new Uint8ClampedArray(w*h*4);
 const o=settings(effect),t=Math.max(0,Number(seconds)||0);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const layers=sampleLayers((x+.5)/w,(y+.5)/h,o,t);
  let alpha=0,r=0,g=0,b=0;
  for(const layer of layers){
   const a=layer.alpha*(1-alpha);
   const light=clamp(.78+layer.body*.36+layer.depth*.045,0,1.1);
   r+=a*clamp(o.rgb[0]*light,0,255);
   g+=a*clamp(o.rgb[1]*light,0,255);
   b+=a*clamp(o.rgb[2]*light,0,255);
   alpha+=a;
  }
  const offset=(y*w+x)*4;
  data[offset]=alpha?r/alpha:0;
  data[offset+1]=alpha?g/alpha:0;
  data[offset+2]=alpha?b/alpha:0;
  data[offset+3]=Math.round(alpha*255);
 }
 return {width:w,height:h,data};
}
const SCRATCH=new WeakMap();
function scratchFor(ctx,w,h){
 let state=SCRATCH.get(ctx);
 const width=Math.max(72,Math.min(176,Math.round(w/2.8)));
 const height=Math.max(32,Math.round(width*h/w));
 if(!state){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):null;
  const painter=canvas?.getContext('2d');
  if(!painter)return null;
  state={canvas,painter,image:null};SCRATCH.set(ctx,state);
 }
 if(state.canvas.width!==width||state.canvas.height!==height){
  state.canvas.width=width;state.canvas.height=height;state.image=null;
 }
 if(!state.image)state.image=state.painter.createImageData(width,height);
 return state;
}
/** Transparent vector approximation only for browsers without scratch canvas. */
function fallback(ctx,w,h,e,t){
 const o=settings(e);
 for(let d=2;d>=0;d--){
  const y=h*(o.bankHeight+.08-d*.055),g=ctx.createLinearGradient(0,y-h*.23,0,h);
  const a=o.opacity*(.08+.04*o.density);
  g.addColorStop(0,'rgba(220,229,236,0)');
  g.addColorStop(.5,'rgba(220,229,236,'+a.toFixed(4)+')');
  g.addColorStop(1,'rgba(220,229,236,'+(a*1.35).toFixed(4)+')');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,h);
  for(let i=0;i<=40;i++){
   const x=w*i/40,point=sampleMistFogLayers(i/40,o.bankHeight,e,t)[d];
   ctx.lineTo(x,y+h*(point.crest-o.bankHeight)*.7);
  }
  ctx.lineTo(w,h);ctx.closePath();ctx.fill();
 }
}
/** Used identically by timeline preview, scrub and fixed-frame export. */
export function renderMistFog(ctx,w,h,effect={},seconds=0,opacity){
 const alpha=clamp(opacity===undefined?(effect.intensity??78)/100:opacity,0,1);
 if(alpha<=0)return true;
 const effective={...effect,intensity:alpha*100},scratch=scratchFor(ctx,w,h);
 ctx.save();
 try{
  if(!scratch)fallback(ctx,w,h,effective,seconds);
  else{
   buildMistFogFrame(scratch.canvas.width,scratch.canvas.height,effective,seconds,scratch.image.data);
   scratch.painter.putImageData(scratch.image,0,0);
   ctx.imageSmoothingEnabled=true;
   ctx.drawImage(scratch.canvas,0,0,w,h);
  }
 }finally{ctx.restore();}
 return true;
}
