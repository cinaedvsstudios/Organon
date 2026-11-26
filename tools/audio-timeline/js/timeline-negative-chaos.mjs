/** Negative Chaos: independent travelling patches of photographic negative.
 * Deterministic clip-relative clocks and a max-coverage mask avoid double inversion.
 * Source alpha is unchanged; no synthetic replacement image is used.
 */
const clamp=(v,a,b,d)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):d));
const rand=n=>{n=Math.imul(n^0x85ebca6b,0x9e3779b1);n=Math.imul(n^(n>>>16),0x7feb352d);return ((n^(n>>>15))>>>0)/4294967296;};
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function negativeRegions(w,h,e={},seconds=0){
 const t=Math.max(0,Number(seconds)||0),seed=Math.round(clamp(e.negativeSeed,0,99999,1987));
 const count=Math.round(3+clamp(e.density,1,120,48)*.23);
 const scale=clamp(e.scale,10,300,100)/100,rate=clamp(e.negativeRate,1,12,5),life=clamp(e.negativeLife,.12,1.5,.55);
 const angle=clamp(e.direction,-180,180,0)*Math.PI/180,regions=[];
 for(let i=0;i<count;i++){
  const k=seed+i*101,period=life+(1+rand(k+1)*2)/rate,clock=t+rand(k+2)*period;
  const cycle=Math.floor(clock/period),age=clock-cycle*period,key=k+cycle*733;
  const duration=life*(.65+.35*rand(key+3));if(age>=duration)continue;
  const envelope=smooth(age/.065)*smooth((duration-age)/.09);
  const rx=Math.max(2,Math.min(w*.55,w*scale*(.05+rand(key+4)*.16))),ry=Math.max(2,Math.min(h*.5,h*scale*(.06+rand(key+5)*.22)));
  const drift=(age/duration-.5)*Math.min(w,h)*.18*(.3+rand(key+6));
  const cx=rand(key+7)*w+Math.cos(angle)*drift,cy=rand(key+8)*h+Math.sin(angle)*drift;
  const tilt=(rand(key+9)-.5)*1.5+angle;
  regions.push({cx,cy,rx,ry,cos:Math.cos(tilt),sin:Math.sin(tilt),shape:i%3,slant:(rand(key+10)-.5)*.6,envelope,age});
 }
 return regions;
}
export function buildNegativeChaosFrame(source,w,h,e={},seconds=0,reuse,amount=1,workspace={}){
 const src=source?.data||source;if(!src||src.length!==w*h*4)throw Error('Negative Chaos requires matching RGBA source');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);data.set(src);
 const strength=clamp(e.distortion,0,100,55)/100*clamp(amount,0,1,1);
 const regions=negativeRegions(w,h,e,seconds);if(!strength)return {data,width:w,height:h,regions};
 const n=w*h,mask=workspace.mask?.length===n?workspace.mask:(workspace.mask=new Float32Array(n));mask.fill(0);
 const feather=clamp(e.negativeFeather,0,100,20)/100*.6;
 for(const r of regions){
  const extent=Math.hypot(r.rx,r.ry)*1.4;
  for(let y=Math.max(0,Math.floor(r.cy-extent));y<Math.min(h,Math.ceil(r.cy+extent));y++)
   for(let x=Math.max(0,Math.floor(r.cx-extent));x<Math.min(w,Math.ceil(r.cx+extent));x++){
    const u=((x-r.cx)*r.cos+(y-r.cy)*r.sin)/r.rx,v=(-(x-r.cx)*r.sin+(y-r.cy)*r.cos)/r.ry;
    const d=r.shape===0?Math.max(Math.abs(u+v*r.slant),Math.abs(v)):r.shape===1?Math.abs(u)*.65+Math.abs(v):Math.hypot(u+v*r.slant,v);
    if(d>=1)continue;const a=r.envelope*(feather?smooth((1-d)/feather):1),p=y*w+x;if(a>mask[p])mask[p]=a;
   }
 }
 const chroma=clamp(e.negativeChroma,0,100,100)/100,contrast=clamp(e.negativeContrast,0,100,35)/100;
 for(let p=0;p<n;p++){
  const i=p*4,m=mask[p]*strength;if(!m||!src[i+3])continue;
  const luma=.2126*src[i]+.7152*src[i+1]+.0722*src[i+2];
  for(let c=0;c<3;c++){
   const inverted=255-(luma+(src[i+c]-luma)*chroma);
   const v=Math.max(0,Math.min(255,127.5+(inverted-127.5)*(1+contrast*.85)));
   data[i+c]=src[i+c]+(v-src[i+c])*m;
  }
 }
 return {data,width:w,height:h,regions};
}
const CACHE=new WeakMap();
export function renderNegativeChaos(ctx,source,w,h,e,t,amount){
 if(!source)return false;
 let cache=CACHE.get(ctx);
 if(!cache){const canvas=typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
 const c=canvas?.getContext('2d',{willReadFrequently:true});if(!c)return false;cache={canvas,c,buffer:null,workspace:{}};CACHE.set(ctx,cache);}
 const {canvas,c}=cache;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;cache.buffer=null;cache.workspace={};}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='copy';c.drawImage(source,0,0,w,h);
 let input;try{input=c.getImageData(0,0,w,h);}catch{return false;}
 const out=buildNegativeChaosFrame(input,w,h,e,t,cache.buffer,amount,cache.workspace);cache.buffer=out.data;input.data.set(out.data);c.putImageData(input,0,0);
 ctx.save();try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,w,h);}finally{ctx.restore();}return true;
}
