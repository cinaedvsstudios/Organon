import {renderNegativeChaos} from './timeline-negative-chaos.mjs';
import {renderGlitchStorm} from './timeline-glitch-storm.mjs';
import {renderGlassGlitch} from './timeline-glass-glitch.mjs';
import {renderRetroGlitch} from './timeline-retro-glitch.mjs';
import {renderEngineHeat} from './timeline-engine-heat.mjs';
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
   return renderGlassGlitch(ctx,source,w,h,e,t,amount);
  }else if(e.presetId==='glitch-storm'){
   return renderGlitchStorm(ctx,source,w,h,e,t,amount);
  }else if(e.presetId==='negative-chaos'){
   return renderNegativeChaos(ctx,source,w,h,e,t,amount);
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
   renderEngineHeat(ctx,source,w,h,e,t,amount);
  }else if(e.presetId==='retro-glitch'){
   renderRetroGlitch(ctx,source,w,h,e,t,amount);
  }
 }finally{ctx.restore();}
 return true;
}
