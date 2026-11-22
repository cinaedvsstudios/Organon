/**
 * MotoriClip #54 — Organic photographic Light Leaks.
 *
 * Broad layered pink/magenta/violet translucent light, diagonal and vertical
 * feathered blooms, luminous overexposure and evolving internal turbulence.
 * No translated still-gradient disc and no opaque rectangular light cards.
 *
 * Same deterministic absolute clip-relative clock in preview, reverse
 * seeking and encoded export. Bounded reused RGBA scratch buffer.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a));
const smooth=v=>{const x=v<0?0:v>1?1:v;return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
const TABLES=new Map();
function hash(x,y,seed){
 let k=(Math.imul(x+1,374761393)^Math.imul(y+11,668265263)^Math.imul(seed+1,2246822519))>>>0;
 k^=k>>>13;k=Math.imul(k,1274126177)>>>0;k^=k>>>16;
 return k/4294967296;
}
function table(seed){
 let item=TABLES.get(seed);
 if(item)return item;
 item=new Float32Array(64*64);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++)item[y*64+x]=hash(x,y,seed);
 TABLES.set(seed,item);return item;
}
function noise(x,y,map){
 const ix=Math.floor(x),iy=Math.floor(y),px=x-ix,py=y-iy,
  fx=smooth(px),fy=smooth(py),x0=ix&63,x1=(ix+1)&63,
  y0=(iy&63)*64,y1=((iy+1)&63)*64;
 return mix(mix(map[y0+x0],map[y0+x1],fx),mix(map[y1+x0],map[y1+x1],fx),fy);
}
function rgb(color){
 const v=/^#[0-9a-f]{6}$/i.test(String(color))?String(color):'#ed75c8';
 return [1,3,5].map(i=>parseInt(v.slice(i,i+2),16));
}
function config(e={}){
 return {
  intensity:clamp(e.intensity??70,0,100)/100,
  density:clamp(e.density??48,1,120)/120,
  scale:clamp(e.scale??100,10,300)/100,
  direction:clamp(e.direction??0,-180,180)*Math.PI/180,
  distortion:clamp(e.distortion??55,0,100)/100,
  glow:clamp(e.glow??64,0,100)/100,
  blur:clamp(e.blur??24,0,60)/60,
  originX:clamp(e.originX??20,0,100)/100,
  originY:clamp(e.originY??12,0,100)/100,
  main:rgb(e.color),
  lean:Math.tan(clamp(e.direction??0,-180,180)*Math.PI/180*.43)*.32+.40,
  broadNoise:table(43),smallNoise:table(71)
 };
}
// Smooth finite-support bell (C1 at its edge) avoids costly per-pixel exp.
const gaussian=(v,w)=>{const q=v/(w*2.35),a=1-q*q;return a>0?a*a:0;};
const PURPLE=[129,72,225],WARM=[255,239,249];
// Cache every time-only value once PER FRAME, not for each cloud pixel.
function prepare(o,time){
 const anchorX=(o.originX-.2)*.55,anchorY=(o.originY-.12)*.45;
 o.windX=Math.sin(o.direction);o.windY=Math.cos(o.direction);
 o.anchorX=anchorX;o.anchorY=anchorY;
 o.leftX=-.07+anchorX+Math.sin(time*.19+.4)*.09;
 o.leftY=.34+anchorY+Math.sin(time*.31+1.4)*.12;
 o.rightX=1.10+anchorX*.42+Math.cos(time*.25+1.8)*.11;
 o.rightY=.63+anchorY*.7+Math.sin(time*.18+.2)*.13;
 o.diagonalOrigin=.31+anchorX*.47+Math.sin(time*.20+1.4)*.09;
 o.verticalOrigin=.05+anchorX*.42+Math.cos(time*.16)*.08;
 o.blushY=.04+anchorY*.20+Math.sin(time*.27)*.08;
 return o;
}
function lightAt(u,v,o,time,out){
 // The two advected scales distort CLOUD SHAPE and internal brightness;
 // there is no cached still source image being dragged across the canvas.
 const low=noise(u*(2.5+3*o.density)+time*.14*o.windX,
   v*(2.8+2*o.density)-time*.19,o.broadNoise);
 const fine=noise(u*(8+6*o.density)-time*.24,
   v*(7+6*o.density)+time*.17*o.windY,o.smallNoise);
 const warp=(.014+.075*o.distortion)*o.scale;
 const x=u+(low-.5)*warp+(fine-.5)*warp*.4;
 const y=v+(fine-.5)*warp*.8+(low-.5)*warp*.65;
 const breathe=.82+.18*Math.sin(time*1.14+fine*5.5+u*6.2);
 const cloudRadius=(.46+.14*o.blur)*o.scale;
 // Broad chromatic fog entering from two opposing, differently shaped edges.
 const magenta=gaussian((x-o.leftX)/cloudRadius,1)
  *gaussian((y-o.leftY)/(.61+.18*o.blur),1)
  *(.66+.49*low);
 const violet=gaussian((x-o.rightX)/(.57*o.scale+.16*o.blur),1)
  *gaussian((y-o.rightY)/(.66+.11*o.blur),1)
  *(.61+.52*fine);
 // A soft luminous diagonal column: brightness grows and fades within
 // the light itself, not by sweeping an opaque beam-shaped rectangle.
 const lean=o.lean;
 const diagonalX=o.diagonalOrigin+(y-.5)*lean;
 const diagonal=gaussian(x-diagonalX,.155+.19*o.blur+.065*o.scale)
   *(.48+.52*gaussian(y-.42,.55))
   *(.63+.5*low);
 const vertical=gaussian(x-o.verticalOrigin,
   .10+.10*o.blur+.075*o.scale)
  *gaussian(y-.50,.70)
  *(.5+.64*fine);
 // A second diffuse blush creates nonuniform internal light accumulation.
 const upperBlush=gaussian(x-(.76+o.anchorX*.3),.38*o.scale+.13)
  *gaussian(y-o.blushY,.34+.1*o.blur)
  *(.32+.68*(.6*low+.4*fine));
 const flicker=(.83+.17*Math.sin(time*1.6+fine*6+low*4))*breathe;
 const main=magenta*.68+vertical*.38;
 const purple=violet*.77+upperBlush*.52;
 const bloom=diagonal*.80+vertical*.28;
 // Narrow moving inner exposure hotspot nested inside the broad diagonal
 // cloud, like film light saturating locally rather than an opaque beam.
 const hotspot=gaussian(x-diagonalX,.052+.07*o.blur)
  *gaussian(y-(.40+o.anchorY*.18),.21+.12*o.blur)
  *(.73+.35*fine);
 const sum=main+purple+bloom+.00001;
 const strength=(.50+.54*(.52*low+.48*fine))*flicker;
 const luminance=main*.55+purple*.45+bloom*.92;
 const alpha=clamp(Math.max(0,luminance-.12)*strength*o.intensity
  *(1.00+.52*o.glow)+hotspot*.62*o.intensity*(.65+.35*o.glow),0,.94);
 // Luminous pink/violet mix; the bright diagonal hotspot saturates toward
 // pale warm white while leaving adjacent footage and shadows visible.
 const exposure=clamp(hotspot*(.75+.78*o.glow),0,.94);
 const color=out.color;
 for(let c=0;c<3;c++){
  const chroma=(main*o.main[c]+purple*PURPLE[c]+bloom*WARM[c])/sum;
  color[c]=mix(chroma,WARM[c],exposure*.88);
 }
 out.alpha=alpha;out.magenta=magenta;out.violet=violet;out.diagonal=diagonal;
 out.vertical=vertical;out.bloom=bloom;out.hotspot=hotspot;out.flicker=flicker;
 return out;
}
/** Pure sample for visual and independent-change QA. */
export function sampleLightLeak(u,v,effect={},cycle=0){
 const t=Math.max(0,Number(cycle)||0);
 return lightAt(clamp(u,0,1),clamp(v,0,1),prepare(config(effect),t),t,{color:[0,0,0]});
}
export function buildLightLeaksFrame(width,height,effect={},cycle=0,reuse){
 const w=Math.max(1,Math.round(Number(width)||1)),
  h=Math.max(1,Math.round(Number(height)||1));
 const data=reuse?.length===w*h*4?reuse:new Uint8ClampedArray(w*h*4);
 const t=Math.max(0,Number(cycle)||0),o=prepare(config(effect),t),sample={color:[0,0,0]};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  lightAt((x+.5)/w,(y+.5)/h,o,t,sample);
  const k=(y*w+x)*4;
  data[k]=sample.color[0];data[k+1]=sample.color[1];data[k+2]=sample.color[2];
  data[k+3]=Math.round(sample.alpha*255);
 }
 return {width:w,height:h,data};
}
const SCRATCH=new WeakMap();
function scratchFor(ctx,w,h){
 let item=SCRATCH.get(ctx);
 const factor=Math.min(1,120/Math.max(w,h));
 const sw=Math.max(40,Math.round(w*factor)),sh=Math.max(24,Math.round(h*factor));
 if(!item){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(sw,sh):null;
  const source=canvas?.getContext('2d');
  if(!canvas||!source)return null;
  item={canvas,source,pixels:null};SCRATCH.set(ctx,item);
 }
 if(item.canvas.width!==sw||item.canvas.height!==sh){
  item.canvas.width=sw;item.canvas.height=sh;item.pixels=null;
 }
 if(!item.pixels)item.pixels=item.source.createImageData(sw,sh);
 return item;
}
/** Graceful visual fallback for schematic/no-DOM unit-test contexts. */
function fallback(ctx,w,h,e,t,intensity){
 for(let i=0;i<4;i++){
  const x=(i%2?1.07:-.08)*w+Math.sin(t*(.16+i*.035)+i)*w*.06;
  const y=(.25+i*.18+Math.sin(t*(.28+i*.04))* .09)*h;
  const r=w*(.58+i*.11)*(e.scale??100)/100;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  const hex=i%2?'#8666eb':i===2?'#ffe0ed':e.color||'#ed75c8';
  g.addColorStop(0,'rgba(255,180,225,'+(intensity*.12).toFixed(4)+')');
  g.addColorStop(.35,'rgba(202,92,218,'+(intensity*.08).toFixed(4)+')');
  g.addColorStop(1,'rgba(184,85,224,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 }
}
/** A physically translucent screen-blended light field over current footage. */
export function renderLightLeaks(ctx,w,h,e={},cycle=0,strength=clamp(e.intensity??70,0,100)/100){
 const alpha=clamp(strength,0,1);if(alpha<=0)return true;
 const item=scratchFor(ctx,w,h);
 ctx.save();
 try{
  if(!item){
   ctx.globalCompositeOperation='screen';fallback(ctx,w,h,e,cycle,alpha);
   return true;
  }
  buildLightLeaksFrame(item.canvas.width,item.canvas.height,
   {...e,intensity:alpha*100},cycle,item.pixels.data);
  item.source.putImageData(item.pixels,0,0);
  ctx.globalCompositeOperation='screen';
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(item.canvas,0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
