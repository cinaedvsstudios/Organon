import {renderGlitchFlux} from './timeline-glitch-flux.mjs';
import {renderNoirGlitch} from './timeline-noir-glitch.mjs';
import {renderMisalignment} from './timeline-misalignment.mjs';
import {renderWarningGlitch} from './timeline-warning-glitch.mjs';
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
   return renderWarningGlitch(ctx,source,w,h,e,t,amount);
  }else if(e.presetId==='misalignment'){
   return renderMisalignment(ctx,source,w,h,e,t,amount);
  }else if(e.presetId==='noir-glitch'){
   return renderNoirGlitch(ctx,source,w,h,e,t,amount);
  }else if(e.presetId==='glitch-flux'){
   return renderGlitchFlux(ctx,source,w,h,e,t,amount);
  }else if(e.presetId==='engine-heat'){
   renderEngineHeat(ctx,source,w,h,e,t,amount);
  }else if(e.presetId==='retro-glitch'){
   renderRetroGlitch(ctx,source,w,h,e,t,amount);
  }
 }finally{ctx.restore();}
 return true;
}
