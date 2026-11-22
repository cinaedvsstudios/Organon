/**
 * MotoriClip #49 — Hazy Atmosphere.
 *
 * Real procedural translucent fog, not a translated bitmap or seven radial
 * gradient discs. Three independently advected depth fields use spatially
 * warped fractal value noise, irregular soft margins and slow density breathing.
 * The entire image is a pure function of stored settings and clip-relative time.
 * Render the small alpha field to a bounded, reused Canvas2D scratch surface
 * and bilinearly upscale it; preview and fixed-frame export share this painter.
 */
const limit=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a));
const smooth=(a,b,x)=>{const v=limit((x-a)/(b-a),0,1);return v*v*(3-2*v);};
const lerp=(a,b,t)=>a+(b-a)*t;
function hash(x,y,seed){
 let n=(Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(seed+1,2246822519))>>>0;
 n^=n>>>13;n=Math.imul(n,1274126177)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
}
// Seeded lattice values are immutable and built once per seed. Inner-pixel
// sampling uses four bounded table lookups instead of four integer hashes.
const NOISE_LATTICES=new Map();
function lattice(seed){
 let table=NOISE_LATTICES.get(seed);
 if(table)return table;
 table=new Float32Array(64*64);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++)table[y*64+x]=hash(x,y,seed);
 NOISE_LATTICES.set(seed,table);
 return table;
}
function noise(x,y,seed){
 const ix=Math.floor(x),iy=Math.floor(y),u=smooth(0,1,x-ix),v=smooth(0,1,y-iy);
 const table=lattice(seed),x0=ix&63,x1=(ix+1)&63,y0=(iy&63)*64,y1=((iy+1)&63)*64;
 return lerp(lerp(table[y0+x0],table[y0+x1],u),
             lerp(table[y1+x0],table[y1+x1],u),v);
}
const DEFAULT_COLOR='#d6e0e9';
function options(effect={}){
 const hex=/^#[a-f\d]{6}$/i.test(String(effect.color))?String(effect.color):DEFAULT_COLOR;
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 return {
  rgb,
  density:limit(effect.density??48,1,120)/120,
  scale:limit(effect.scale??100,10,300)/100,
  blur:limit(effect.blur??24,0,60)/60,
  distortion:limit(effect.distortion??55,0,100)/100,
  glow:limit(effect.glow??64,0,100)/100,
  angle:limit(effect.direction??0,-180,180)*Math.PI/180,
  originX:limit(effect.originX??20,0,100)/100,
  originY:limit(effect.originY??12,0,100)/100,
  strength:limit(effect.intensity??70,0,100)/100
 };
}
/** Exposed for tests: independent translucent depth planes at one coordinate. */
function sampleLayers(nx,ny,o,t){
 const u=limit(nx,0,1),v=limit(ny,0,1),fields=[];
 for(let depth=0;depth<3;depth++){
  // Near and far clouds move at different speeds and spatial scales.
  const parallax=.11+.09*depth,scale=(2.35+depth*.92)/o.scale;
  const driftX=Math.cos(o.angle)*t*parallax;
  const driftY=Math.sin(o.angle)*t*parallax-t*(.025+.012*depth);
  const px=(u+o.originX*.19+driftX)*scale;
  const py=(v+o.originY*.14+driftY)*scale;
  // Two different seeded octaves per plane, continuously phase-advected,
  // with cross-axis time-varying domain warp. Fine folds and the upper/lower
  // cloud boundary also deform over time; no translated still noise bitmap.
  const warpA=Math.sin(py*1.31-t*.24+depth*1.9)
    *Math.cos(px*.83+t*.14+depth*.57);
  const warpB=Math.cos(px*1.17+t*.19+depth*2.13)
    *Math.sin(py*.91-t*.16);
  const wx=px+warpA*(.18+o.distortion*.63);
  const wy=py+warpB*(.15+o.distortion*.6);
  const low=noise(wx,wy,depth*101+29);
  const fine=noise(wx*2.08+t*.021,wy*1.93-t*.018,depth*101+61);
  const billow=.69*low+.31*fine;
  const folds=.5+.21*Math.sin(wx*1.33+wy*.64+t*.22+depth)
    +.19*Math.cos(wy*1.87-wx*.4-t*.31+depth*2);
  const center=.23+depth*.245+(o.originY-.12)*.25
    +.044*Math.sin(u*8.2+t*.22+depth*1.87);
  const edgeWarp=(folds-.5)*(.16+.12*o.distortion);
  const vertical=1-smooth(.19+.055*depth,.54+.065*depth,
   Math.abs(v-center+edgeWarp));
  const threshold=.43-o.density*.115;
  const fullness=smooth(threshold,threshold+.21+o.blur*.12,
   billow*.82+folds*.18);
  const breathing=.79+.21*Math.sin(t*(.35+depth*.19)+depth*1.71+folds*2);
  const alpha=limit((.23+.055*depth)*(.6+o.density*.82)
     *fullness*vertical*breathing*o.strength,0,.42);
  fields.push({depth,alpha,billow,folds,driftX,driftY});
 }
 return fields;
}
export function sampleHazyAtmosphereLayers(nx,ny,effect={},seconds=0){
 return sampleLayers(nx,ny,options(effect),Math.max(0,Number(seconds)||0));
}
/** Produce transparent RGBA cloud pixels; optionally reuse the same typed array. */
export function buildHazyAtmosphereFrame(width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(Number(width)||1));
 const h=Math.max(1,Math.round(Number(height)||1));
 const data=reuse?.length===w*h*4?reuse:new Uint8ClampedArray(w*h*4);
 const o=options(effect),t=Math.max(0,Number(seconds)||0);
 for(let y=0;y<h;y++){
  const v=(y+.5)/h;
  for(let x=0;x<w;x++){
   const u=(x+.5)/w,fields=sampleLayers(u,v,o,t);
   let alpha=0,r=0,g=0,b=0;
   for(const f of fields){
    const layerAlpha=f.alpha*(1-alpha);
    const white=.12+f.depth*.16+o.glow*.17+f.folds*.09;
    const light=.86+.14*f.billow;
    r+=layerAlpha*(o.rgb[0]*(1-white)+255*white)*light;
    g+=layerAlpha*(o.rgb[1]*(1-white)+255*white)*light;
    b+=layerAlpha*(o.rgb[2]*(1-white)+255*white)*light;
    alpha+=layerAlpha;
   }
   const k=(y*w+x)*4;
   data[k]=alpha?r/alpha:0;
   data[k+1]=alpha?g/alpha:0;
   data[k+2]=alpha?b/alpha:0;
   data[k+3]=Math.round(alpha*255);
  }
 }
 return {width:w,height:h,data};
}
const SCRATCH=new WeakMap();
function getScratch(ctx,w,h){
 if(!ctx||typeof ctx!=='object')return null;
 const width=Math.max(56,Math.min(176,Math.round(w/2.6)));
 const height=Math.max(32,Math.min(110,Math.round(width*h/w)));
 let cache=SCRATCH.get(ctx);
 if(!cache){
  const canvas=typeof document!=='undefined'?document.createElement('canvas')
    :typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):null;
  const painter=canvas?.getContext('2d',{willReadFrequently:false});
  if(!painter)return null;
  cache={canvas,painter,image:null};
  SCRATCH.set(ctx,cache);
 }
 if(cache.canvas.width!==width||cache.canvas.height!==height){
  cache.canvas.width=width;cache.canvas.height=height;cache.image=null;
 }
 if(!cache.image)cache.image=cache.painter.createImageData(width,height);
 return cache;
}
/* A live vector fallback for environments without scratch Canvas support;
 * never slides a static texture, and is not used in ordinary browsers. */
function drawNoScratch(ctx,w,h,e,t){
 for(let d=0;d<3;d++){
  const center=h*(.24+d*.22);
  const gradient=ctx.createLinearGradient(0,center-h*.28,0,center+h*.32);
  const alpha=(.08+.035*d)*limit(e.intensity??70,0,100)/100;
  gradient.addColorStop(0,'rgba(214,224,233,0)');
  gradient.addColorStop(.52,'rgba(214,224,233,'+alpha.toFixed(4)+')');
  gradient.addColorStop(1,'rgba(214,224,233,0)');
  ctx.fillStyle=gradient;ctx.beginPath();
  for(let i=0;i<=24;i++){
   const x=w*i/24;
   const sample=sampleHazyAtmosphereLayers(i/24,.3+d*.2,e,t)[d];
   const y=center-h*.30+(sample.billow-.5)*h*.22;
   if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  for(let i=24;i>=0;i--){
   const x=w*i/24;
   const sample=sampleHazyAtmosphereLayers(i/24,.3+d*.2,e,t)[d];
   ctx.lineTo(x,center+h*.31+(sample.folds-.5)*h*.25);
  }
  ctx.closePath();ctx.fill();
 }
}
/** Use the same alpha-noise field in engine preview, scrub and final export. */
export function renderHazyAtmosphere(ctx,w,h,e={},cycle=0,strength=limit(e.intensity??70,0,100)/100){
 const opacity=limit(strength,0,1);
 if(opacity<=0)return true;
 const settings={...e,intensity:100*opacity};
 const scratch=getScratch(ctx,w,h);
 ctx.save();
 try{
  if(!scratch){
   drawNoScratch(ctx,w,h,settings,cycle);
  }else{
   buildHazyAtmosphereFrame(scratch.canvas.width,scratch.canvas.height,
    settings,cycle,scratch.image.data);
   scratch.painter.putImageData(scratch.image,0,0);
   ctx.imageSmoothingEnabled=true;
   ctx.drawImage(scratch.canvas,0,0,w,h);
  }
 }finally{ctx.restore();}
 return true;
}
