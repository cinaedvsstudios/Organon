/** Glitch Storm: independent overlapping signal corruption packets.
 * Each packet has its own clock, footprint, lifetime, drift and failure mode.
 * No opaque placeholder rectangles, no mutable random state.
 */
const clamp=(v,a,b,d)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):d));
const rand=n=>{n=Math.imul(n^0x85ebca6b,0x9e3779b1);n=Math.imul(n^(n>>>16),0x7feb352d);return ((n^(n>>>15))>>>0)/4294967296;};
export function stormPackets(w,h,e={},seconds=0){
 const seed=Math.round(clamp(e.stormSeed,0,99999,1977)),t=Math.max(0,Number(seconds)||0);
 const count=Math.round(4+clamp(e.density,1,120,48)*.38),scale=clamp(e.scale,10,300,100)/100;
 const rate=clamp(e.stormRate,2,24,12),life=clamp(e.stormLife,.05,.8,.24),cluster=clamp(e.stormCluster,0,100,55)/100;
 const storm=.5+.5*Math.sin(t*4.3+seed*.01),packets=[];
 for(let i=0;i<count;i++){
  const k=seed+i*139,period=1/rate*(1+rand(k+1)*2)+life,clock=t+rand(k+2)*period;
  const cycle=Math.floor(clock/period),age=clock-cycle*period,pk=k+cycle*7919;
  if(age>=life*(.6+.4*rand(pk+3)))continue;
  const envelope=Math.min(1,age/.018)*Math.min(1,(life*(.6+.4*rand(pk+3))-age)/.04);
  if(rand(pk+4)>1-cluster*.6*(1-storm))continue;
  const kind=i%4,bw=Math.max(2,Math.min(w,Math.round(w*scale*(kind===0?.4+.6*rand(pk+5):.045+.28*rand(pk+5)))));
  const bh=Math.max(1,Math.min(h,Math.round(h*scale*(kind===0?.012+.06*rand(pk+6):.035+.18*rand(pk+6)))));
  const x=Math.floor(rand(pk+7)*(w-bw+1)),y=Math.floor(rand(pk+8)*(h-bh+1));
  packets.push({kind,x,y,bw,bh,envelope,dx:rand(pk+9)*2-1,dy:rand(pk+10)*2-1,seed:pk,age});
 }
 return packets;
}
export function buildGlitchStormFrame(source,w,h,e={},seconds=0,reuse,amount=1){
 const src=source?.data||source;if(!src||src.length!==w*h*4)throw Error('Glitch Storm requires matching RGBA source');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);data.set(src);
 const strength=clamp(e.distortion,0,100,55)/100,mix=clamp(amount,0,1,1),packets=stormPackets(w,h,e,seconds);
 if(!strength||!mix)return {data,width:w,height:h,packets};
 const chroma=clamp(e.stormChroma,0,100,65)/100,noise=clamp(e.stormNoise,0,100,45)/100;
 const axis=clamp(e.direction,-180,180,0)*Math.PI/180,ca=Math.cos(axis),sa=Math.sin(axis);
 const amp=Math.min(w,h)*.19*strength;
 const tint=/^#[0-9a-f]{6}$/i.test(e.color||'')?e.color:'#ffd98d',rgb=[1,3,5].map(i=>parseInt(tint.slice(i,i+2),16));
 const idx=(x,y)=>(Math.max(0,Math.min(h-1,Math.round(y)))*w+Math.max(0,Math.min(w-1,Math.round(x))))*4;
 for(const p of packets){
  const dx=amp*(p.dx*ca-p.dy*sa*.4),dy=amp*(p.dx*sa+p.dy*ca*.4),weight=mix*p.envelope*strength;
  const step=Math.max(2,Math.round(Math.min(w,h)*.025*strength));
  for(let y=p.y;y<p.y+p.bh;y++)for(let x=p.x;x<p.x+p.bw;x++){
   const i=(y*w+x)*4;if(!src[i+3])continue;
   const qx=p.kind===2?p.x+Math.floor((x-p.x)/step)*step:x,qy=p.kind===2?p.y+Math.floor((y-p.y)/step)*step:y;
   const shift=p.kind===3?0:1,split=p.kind===1?amp*.28*chroma:0;
   const snow=p.kind===3?noise*rand(p.seed+Math.floor(x/3)*13+y*71):0;
   for(let c=0;c<3;c++){
    const d=(c-1)*split,j=idx(qx+dx*shift+d*ca,qy+dy*shift+d*sa);
    let v=src[j+3]?src[j+c]:src[i+c];
    if(p.kind===2){const levels=Math.max(3,Math.round(20-15*strength));v=Math.round(v/255*levels)/levels*255;}
    if(p.kind===3)v=v+(rgb[c]-v)*snow;
    data[i+c]=data[i+c]+(v-data[i+c])*weight;
   }
  }
 }
 return {data,width:w,height:h,packets};
}
const CACHE=new WeakMap();
export function renderGlitchStorm(ctx,source,w,h,e,t,amount){
 if(!source)return false;
 let cache=CACHE.get(ctx);
 if(!cache){const canvas=typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
 const c=canvas?.getContext('2d',{willReadFrequently:true});if(!c)return false;cache={canvas,c,buffer:null};CACHE.set(ctx,cache);}
 const {canvas,c}=cache;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;cache.buffer=null;}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='copy';c.drawImage(source,0,0,w,h);
 let input;try{input=c.getImageData(0,0,w,h);}catch{return false;}
 const out=buildGlitchStormFrame(input,w,h,e,t,cache.buffer,amount);cache.buffer=out.data;input.data.set(out.data);c.putImageData(input,0,0);
 ctx.save();try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,w,h);}finally{ctx.restore();}return true;
}
