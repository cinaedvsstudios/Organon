/**
 * MotoriClip Phase 3E — nine substantively different source-frame glitches.
 * All geometry is a pure function of clip-relative seconds, effect parameters
 * and stable integer seeds. The browser/export renderer supplies a snapshot
 * of the already-composited lower layers; this module never edits the media.
 */
export const GLITCH_PRESETS=Object.freeze([
 {id:'glass-glitch',label:'Glass Glitch',group:'effect',category:'Glitch',animated:true},
 {id:'glitch-storm',label:'Glitch Storm',group:'effect',category:'Glitch',animated:true},
 {id:'negative-chaos',label:'Negative Chaos',group:'effect',category:'Glitch',animated:true},
 {id:'warning-glitch',label:'Warning Glitch',group:'effect',category:'Glitch',animated:true},
 {id:'misalignment',label:'Misalignment',group:'effect',category:'Glitch',animated:true},
 {id:'noir-glitch',label:'Noir Glitch',group:'effect',category:'Glitch',animated:true},
 {id:'glitch-flux',label:'Glitch Flux',group:'effect',category:'Glitch',animated:true},
 {id:'engine-heat',label:'Engine Heat',group:'effect',category:'Glitch',animated:true},
 {id:'retro-glitch',label:'Retro Glitch',group:'effect',category:'Glitch',animated:true}
]);
const ids=new Set(GLITCH_PRESETS.map(x=>x.id));
const cache=new WeakMap();
const limit=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
const wrap=n=>((n%1)+1)%1;
const seeded=n=>{
 let k=(Math.imul((Math.floor(n)+1)>>>0,0x9e3779b1)^0x85ebca6b)>>>0;
 k^=k>>>16;k=Math.imul(k,0x7feb352d)>>>0;k^=k>>>15;
 return (k>>>0)/4294967296;
};
const rgba=(hex,a)=>'rgba('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')+','+limit(a,0,1)+')';
export function isGlitchEffect(id){return ids.has(id);}
const draw=(ctx,source,sx,sy,sw,sh,dx,dy,dw,dh)=>{
 if(source)ctx.drawImage(source,sx,sy,sw,sh,dx,dy,dw,dh);
 else{ctx.fillStyle='rgba(79,193,232,.42)';ctx.fillRect(dx,dy,dw,dh);}
};
export function renderGlitchEffect(ctx,source,w,h,e,time,amount){
 if(!ids.has(e.presetId))return false;
 const t=Math.max(0,Number(time)||0);
 const tick=Math.floor(t*17),size=limit(e.scale??100,10,300)/100;
 const strength=limit(e.distortion??55,0,100)/100*limit(e.intensity??70,0,100)/100;
 const count=Math.max(7,Math.min(60,Math.round(e.density??48)));
 const amp=(3+32*strength)*size,rad=(Number(e.direction)||0)*Math.PI/180;
 const color=e.color||'#ffd98d';
 ctx.save();
 try{
  ctx.globalAlpha=limit(amount,0,1);
  if(e.presetId==='glass-glitch'){
   // Irregular shattered polygons, each revealing a differently displaced
   // slice of the underlying image; shard seams are separately highlighted.
   for(let i=0;i<15;i++){
    const col=i%5,row=Math.floor(i/5);
    const x=col*w/5,y=row*h/3,bw=w/5,bh=h/3;
    const j=seeded(i*17+9)-.5,k=seeded(i*17+12)-.5;
    const dx=j*amp*2,dy=k*amp*1.4;
    ctx.save();ctx.beginPath();
    ctx.moveTo(x,y+k*bh*.22);
    ctx.lineTo(x+bw,y+j*bh*.18);
    ctx.lineTo(x+bw*(.9+j*.15),y+bh);
    ctx.lineTo(x+bw*j*.17,y+bh);
    ctx.closePath();ctx.clip();
    draw(ctx,source,0,0,w,h,dx+Math.sin(t*8+i)*amp*.18,dy,w,h);
    ctx.restore();
    ctx.strokeStyle=rgba(color,.26+.25*seeded(i+201));
    ctx.lineWidth=Math.max(1,size);
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+bw,y+bh*.8);
    ctx.stroke();
   }
  }else if(e.presetId==='glitch-storm'){
   // High-frequency discontinuous horizontal tearing plus digital block snow.
   const bands=Math.min(38,count);
   for(let i=0;i<bands;i++){
    const y=i*h/bands,bh=Math.ceil(h/bands)+1;
    const jump=(seeded(tick*109+i*17)-.5)*amp*3;
    draw(ctx,source,0,y,w,bh,jump,y,w,bh);
    if(seeded(tick+i*23)>.73){
     ctx.fillStyle=i%2?'rgba(255,40,109,.44)':'rgba(29,232,239,.35)';
     ctx.fillRect(seeded(i*7+tick)*w,y,w*(.04+seeded(i*19)*.25),bh);
    }
   }
  }else if(e.presetId==='negative-chaos'){
   // Invert only changing window-shaped pieces; leave unaffected pixels normal.
   for(let i=0;i<Math.max(6,Math.round(count*.36));i++){
    const x=seeded(tick*19+i*31)*w,y=seeded(tick*37+i*13)*h;
    const bw=w*(.05+seeded(i+23)*.35),bh=h*(.04+seeded(i+91)*.22);
    ctx.save();ctx.beginPath();ctx.rect(x,y,bw,bh);ctx.clip();
    ctx.filter='invert(1) contrast(1.35)';
    draw(ctx,source,0,0,w,h,0,0,w,h);
    ctx.filter='none';ctx.restore();
   }
  }else if(e.presetId==='warning-glitch'){
   // Alert-color hazard rails + angled stripes + jumping source tears.
   ctx.strokeStyle='#ff4b32';ctx.lineWidth=Math.max(3,w*.012*size);
   ctx.strokeRect(w*.015,h*.025,w*.97,h*.95);
   const moving=wrap(t*.45)*w;
   ctx.save();ctx.beginPath();ctx.rect(0,h*.83,w,h*.13);ctx.clip();
   const rail=Math.max(8,w*.036*size);
   for(let x=-w;x<w*2;x+=rail*2){
    ctx.fillStyle=(Math.floor(x/rail)%4===0)?'#f4ce3c':'#192128';
    ctx.beginPath();ctx.moveTo(x+moving,h*.82);ctx.lineTo(x+moving+rail,h*.82);
    ctx.lineTo(x+moving+rail*2,h*.97);ctx.lineTo(x+moving+rail,h*.97);
    ctx.closePath();ctx.fill();
   }
   ctx.restore();
   const jitter=(seeded(tick*37)-.5)*amp*3;
   draw(ctx,source,0,h*.36,w,h*.08,jitter,h*.36,w,h*.08);
  }else if(e.presetId==='misalignment'){
   // Offset semitransparent source ghosts; not horizontal strip tearing.
   const dx=(4+amp*2)*Math.sin(t*4+rad);
   const dy=(3+amp)*Math.cos(t*3+rad);
   ctx.save();ctx.globalCompositeOperation='screen';
   ctx.globalAlpha=amount*.3;
   ctx.filter='sepia(1) hue-rotate(155deg) saturate(4)';
   draw(ctx,source,0,0,w,h,dx,dy,w,h);
   ctx.filter='sepia(1) hue-rotate(305deg) saturate(4)';
   draw(ctx,source,0,0,w,h,-dx,-dy,w,h);
   ctx.restore();
  }else if(e.presetId==='noir-glitch'){
   // High-contrast black-and-white vision interrupted by noir shutters.
   ctx.filter='grayscale(1) contrast(2.1)';
   draw(ctx,source,0,0,w,h,0,0,w,h);
   ctx.filter='none';
   for(let i=0;i<10;i++){
    const y=wrap(seeded(i*19+3)+t*(.11+.015*i))*h;
    ctx.fillStyle='rgba(0,0,0,'+(.25+.4*seeded(i+tick*7))+')';
    ctx.fillRect(0,y,w,Math.max(2,h*.014*size));
   }
   ctx.strokeStyle='rgba(242,242,230,.45)';
   ctx.lineWidth=Math.max(1,size);
   ctx.beginPath();ctx.moveTo(w*.05,0);ctx.lineTo(w*.05,h);ctx.stroke();
  }else if(e.presetId==='glitch-flux'){
   // Sinusoidally warp *vertical columns* (orthogonal to tape/ripple bands).
   const strips=22;
   for(let i=0;i<strips;i++){
    const x=i*w/strips,bw=Math.ceil(w/strips)+1;
    const dy=Math.sin(t*6+i*.83)*amp*2;
    draw(ctx,source,x,0,bw,h,x,dy,bw,h);
   }
   ctx.globalAlpha=amount*.24;ctx.globalCompositeOperation='screen';
   ctx.fillStyle=rgba(color,.5);
   ctx.fillRect(w*wrap(t*.24),0,Math.max(5,w*.055*size),h);
  }else if(e.presetId==='engine-heat'){
   // Upward heat haze strengthens near the bottom; incandescent bloom follows.
   const bands=26;
   for(let i=0;i<bands;i++){
    const y=i*h/bands,bh=Math.ceil(h/bands)+1,nearFire=(i/bands)**2;
    const dx=Math.sin(t*8+i*.79+rad)*amp*2*nearFire;
    draw(ctx,source,0,y,w,bh,dx,y,w,bh);
   }
   const gradient=ctx.createLinearGradient(0,h*.45,0,h);
   gradient.addColorStop(0,'rgba(245,126,38,0)');
   gradient.addColorStop(1,'rgba(255,92,23,'+(.22+.22*strength)+')');
   ctx.fillStyle=gradient;ctx.fillRect(0,h*.45,w,h*.55);
   for(let i=0;i<4;i++){
    const x=wrap(seeded(i+11)+Math.sin(t*.7+i)*.09)*w;
    ctx.strokeStyle=rgba(color,.16);ctx.lineWidth=Math.max(2,w*.012*size);
    ctx.beginPath();ctx.moveTo(x,h);
    ctx.bezierCurveTo(x+w*.06*Math.sin(t+i),h*.7,x-w*.04,h*.55,x+w*.02,h*.36);
    ctx.stroke();
   }
  }else if(e.presetId==='retro-glitch'){
   // Actual low-resolution re-sample, nearest-neighbour upscale, CRT
   // scanlines and a rolling displaced horizontal dropout strip.
   if(source&&typeof document!=='undefined'){
    let pair=cache.get(ctx);
    if(!pair){
     const canvas=document.createElement('canvas');
     const context=canvas.getContext('2d');
     if(context){pair={canvas,context};cache.set(ctx,pair);}
    }
    if(pair){
     const downscale=Math.min(1/Math.max(3,4*size),640/Math.max(w,h));
     const sw=Math.max(1,Math.round(w*downscale));
     const sh=Math.max(1,Math.round(h*downscale));
     if(pair.canvas.width!==sw||pair.canvas.height!==sh){pair.canvas.width=sw;pair.canvas.height=sh;}
     pair.context.setTransform(1,0,0,1,0,0);
     pair.context.globalAlpha=1;pair.context.globalCompositeOperation='source-over';
     pair.context.clearRect(0,0,sw,sh);
     pair.context.drawImage(source,0,0,sw,sh);
     ctx.imageSmoothingEnabled=false;
     ctx.drawImage(pair.canvas,0,0,w,h);
    }
   }else{
    for(let y=0;y<h;y+=Math.max(4,8*size)){
     ctx.fillStyle=y%3?'#203948':'#b5d7e3';
     ctx.fillRect(0,y,w*.8,Math.max(2,4*size));
    }
   }
   const step=Math.max(3,Math.round(5*size));
   ctx.fillStyle='rgba(0,0,0,.32)';
   for(let y=0;y<h;y+=step)ctx.fillRect(0,y,w,Math.max(1,step*.35));
   const tear=wrap(t*.39)*h;
   draw(ctx,source,0,Math.max(0,tear-h*.03),w,h*.03,Math.sin(t*8)*amp,tear,w,h*.03);
  }
 }finally{ctx.restore();}
 return true;
}
