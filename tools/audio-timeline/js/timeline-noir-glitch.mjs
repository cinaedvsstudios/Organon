/** Noir Glitch: monochrome film response, gate weave, shutter faults and grain.
 * All motion and noise derive from clip-local time and a stable seed.
 * Original alpha is preserved, with no replacement graphics when source is absent.
 */
const clamp=(v,a,b,d)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):d));
const rand=n=>{n=Math.imul(n^0x85ebca6b,0x9e3779b1);n=Math.imul(n^(n>>>16),0x7feb352d);return ((n^(n>>>15))>>>0)/4294967296;};
export function noirState(w,h,e={},seconds=0){
 const t=Math.max(0,Number(seconds)||0),seed=Math.round(clamp(e.noirSeed,0,99999,1946)),frame=Math.floor(t*24);
 const amp=clamp(e.distortion,0,100,55)/100*Math.min(w,h)*.045;
 const gate=clamp(e.noirWeave,0,100,45)/100,axis=clamp(e.direction,-180,180,0)*Math.PI/180;
 const u=amp*gate*(.65*Math.sin(t*5.7)+.35*(rand(seed+frame*17)*2-1)),v=amp*gate*.55*Math.cos(t*8.1);
 const dx=u*Math.cos(axis)-v*Math.sin(axis),dy=u*Math.sin(axis)+v*Math.cos(axis);
 const shutter=clamp(e.noirShutter,0,100,45)/100;
 const bands=Array.from({length:3},(_,i)=>{const key=seed+i*211+Math.floor(t*(2.3+i*.43))*7919;
 return {y:rand(key+1)*h,height:Math.max(1,h*(.025+.09*rand(key+2))),depth:shutter*(.25+.65*rand(key+3)),jump:(rand(key+4)*2-1)*amp};});
 const scratches=Array.from({length:Math.max(1,Math.round(clamp(e.density,1,120,48)/12))},(_,i)=>{
 const k=seed+i*173+Math.floor(t*(1.4+i*.17))*313;
 return {x:rand(k+1)*w,top:rand(k+2)*h*.6,bottom:h*(.65+.35*rand(k+3)),slope:(rand(k+4)-.5)*.035,level:rand(k+5)>.4?1:-1};
 });
 return {dx,dy,frame,seed,bands,scratches};
}
export function buildNoirGlitchFrame(source,w,h,e={},seconds=0,reuse,amount=1){
 const src=source?.data||source;if(!src||src.length!==w*h*4)throw Error('Noir Glitch requires matching RGBA source');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);data.set(src);
 const mix=clamp(amount,0,1,1),p=noirState(w,h,e,seconds);
 if(!mix)return {data,width:w,height:h,state:p};
 const contrast=clamp(e.noirContrast,0,100,65)/100,grain=clamp(e.noirGrain,0,100,35)/100;
 const scratch=clamp(e.noirScratches,0,100,30)/100,vignette=clamp(e.noirVignette,0,100,45)/100;
 const cell=Math.max(1,Math.min(w,h)/90*clamp(e.scale,10,300,100)/100);
 const index=(x,y)=>(Math.max(0,Math.min(h-1,Math.round(y)))*w+Math.max(0,Math.min(w-1,Math.round(x))))*4;
 const lum=i=>.2126*src[i]+.7152*src[i+1]+.0722*src[i+2];
 const rows=Array.from({length:h},(_,y)=>{let dim=1,jump=0;for(const b of p.bands){const d=Math.abs(y-b.y)/b.height;if(d<1){const k=(1-d)**2*b.depth;dim*=1-k;jump+=b.jump*k;}}return {dim,jump};});
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(!src[i+3])continue;
  const {dim,jump}=rows[y],j=index(x+p.dx+jump,y+p.dy);
  const l=lum(src[j+3]?j:i)/255;
  const film=Math.max(0,Math.min(1,.5+(l-.5)*(1+contrast*1.65)));
  const radius=Math.min(1,((x-w/2)/(w*.7))**2+((y-h/2)/(h*.7))**2);
  const n=(rand(p.seed+p.frame*104729+Math.floor(x/cell)*131+Math.floor(y/cell)*8191)*2-1)*grain*.16;
  let val=film*dim*(1-vignette*radius*.65)+n;
  if(scratch)for(const s of p.scratches){if(y<s.top||y>s.bottom)continue;
   const d=Math.abs(x-s.x-(y-h/2)*s.slope)/Math.max(.65,cell*.65);
   if(d<1)val+=s.level*scratch*(1-d)*.5;
  }
  val=255*Math.max(0,Math.min(1,val));
  for(let c=0;c<3;c++)data[i+c]=src[i+c]+(val-src[i+c])*mix;
 }
 return {data,width:w,height:h,state:p};
}
const CACHE=new WeakMap();
export function renderNoirGlitch(ctx,source,w,h,e,t,amount){
 if(!source)return false;
 let cache=CACHE.get(ctx);
 if(!cache){const canvas=typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
 const c=canvas?.getContext('2d',{willReadFrequently:true});if(!c)return false;cache={canvas,c,buffer:null};CACHE.set(ctx,cache);}
 const {canvas,c}=cache;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;cache.buffer=null;}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='copy';c.drawImage(source,0,0,w,h);
 let input;try{input=c.getImageData(0,0,w,h);}catch{return false;}
 const out=buildNoirGlitchFrame(input,w,h,e,t,cache.buffer,amount);cache.buffer=out.data;input.data.set(out.data);c.putImageData(input,0,0);
 ctx.save();try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,w,h);}finally{ctx.restore();}return true;
}
