/**
 * MotoriClip procedural effect clips — Phase 3A–E.
 * Effects are recipes (not PNG animations). Preview and both exporters render
 * from identical clip-relative seconds, including reverse seeking.
 * Artifex FX's procedural/seeded approach informed this independent Canvas2D
 * implementation; no runtime or nonportable asset dependency is introduced.
 */
import {isPixelEffect,renderPixelEffect,PIXEL_EFFECT_IDS} from './timeline-pixel-effects.mjs';
import {renderPixelScan} from './timeline-pixel-scan.mjs';
import {renderFlamingDust} from './timeline-ember-dust.mjs';
import {renderHazyAtmosphere} from './timeline-hazy-atmosphere.mjs';
import {renderSciFiScan} from './timeline-sci-fi-scan.mjs';
import {renderFireFlames} from './timeline-fire-flames.mjs';
import {GLITCH_PRESETS,isGlitchEffect,renderGlitchEffect} from './timeline-glitch-effects.mjs';
export const TIMELINE_EFFECTS=Object.freeze([
 {id:'light-sweep',label:'Light Sweep',group:'effect',category:'Light',animated:true},
 {id:'hazy-atmosphere',label:'Hazy Atmosphere',group:'effect',category:'Atmospheric',animated:true},
 {id:'rhythmic-flicker',label:'Rhythmic Flicker',group:'effect',category:'Light',animated:true},
 {id:'particle-dust',label:'Floating Dust',group:'effect',category:'Particles/Fire',animated:true},
 {id:'particle-sparks',label:'Electric Sparks',group:'effect',category:'Particles/Fire',animated:true},
 {id:'particle-debris',label:'Flying Debris',group:'effect',category:'Particles/Fire',animated:true},
 {id:'god-rays',label:'God Rays',group:'effect',category:'Light',animated:true},
 {id:'light-leaks',label:'Organic Light Leaks',group:'effect',category:'Light',animated:true},
 {id:'pixel-scan',label:'Pixel Scan',group:'effect',category:'Scanning',animated:true},
 {id:'sci-fi-scan',label:'Sci-Fi Scan',group:'effect',category:'Scanning',animated:true},
 {id:'pendulum-swing',label:'Pendulum Swing',group:'effect',category:'Motion',animated:true},
 {id:'rebound-swing',label:'Rebound Swing',group:'effect',category:'Motion',animated:true},
 {id:'vibration-flash',label:'Vibration Flash',group:'effect',category:'Motion',animated:true},
 {id:'fault-cassette',label:'Fault Cassette',group:'effect',category:'Glitch',animated:true},
 {id:'ripple-distortion',label:'Ripple Distortion',group:'effect',category:'Distortion',animated:true},
 {id:'electric-ripple',label:'Electric Ripple',group:'effect',category:'Distortion',animated:true},
 {id:'shockwave',label:'Shockwave',group:'effect',category:'Distortion',animated:true},
 {id:'glow',label:'Glow',group:'effect',category:'Light',animated:true},
 {id:'edge-glow',label:'Edge Glow',group:'effect',category:'Light',animated:true},
 {id:'chromatic-quirk',label:'Chromatic Quirk',group:'effect',category:'Distortion',animated:true},
 {id:'halo-blur',label:'Halo Blur',group:'effect',category:'Atmospheric',animated:true},
 {id:'fire-flames',label:'Fire Flames',group:'effect',category:'Particles/Fire',animated:true},
 {id:'fire-embers',label:'Fire Embers',group:'effect',category:'Particles/Fire',animated:true},
 {id:'fire-explosion',label:'Fire Explosion',group:'effect',category:'Particles/Fire',animated:true},
 ...GLITCH_PRESETS
]);
const ids=new Set(TIMELINE_EFFECTS.map(item=>item.id));
const clamp=(value,min,max,fallback)=> {
 const n=Number(value);
 return Math.min(max,Math.max(min,Number.isFinite(n)?n:fallback));
};
const random=(seed)=>{
 let n=(Math.imul((seed+1)>>>0,0x9e3779b1)^0x85ebca6b)>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;n^=n>>>15;
 n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
};
const wrap=n=>((n%1)+1)%1;
const rgba=(hex,alpha)=>{
 const v=hex.slice(1);
 return 'rgba('+[0,2,4].map(i=>parseInt(v.slice(i,i+2),16)).join(',')+','+clamp(alpha,0,1,0)+')';
};
export function normaliseTimelineEffect(effect={}){
 const raw=effect&&typeof effect==='object'?effect:{};
 const presetId=ids.has(raw.presetId)?raw.presetId:'light-sweep';
 const swing=['pendulum-swing','rebound-swing'].includes(presetId);
 const shockwave=presetId==='shockwave';
 return {
  presetId,
  intensity:clamp(raw.intensity,0,100,70),
  speed:clamp(raw.speed,.1,8,1),
  density:clamp(raw.density,1,120,48),
  scale:clamp(raw.scale,10,300,100),
  direction:clamp(raw.direction,-180,180,0),
  distortion:clamp(raw.distortion,0,100,55),
  glow:clamp(raw.glow,0,100,64),
  blur:clamp(raw.blur,0,60,24),
  originX:clamp(raw.originX,0,100,(swing||shockwave||['halo-blur','fire-explosion'].includes(presetId))?50:20),
  originY:clamp(raw.originY,0,100,(shockwave||['halo-blur','fire-explosion'].includes(presetId))?50:swing?10:12),
  color:/^#[0-9a-f]{6}$/i.test(String(raw.color))?String(raw.color).toLowerCase():presetId==='hazy-atmosphere'?'#d6e0e9':presetId==='sci-fi-scan'?'#63ebff':'#ffd98d'
 };
}
// Keep one reusable full-frame scratch buffer per Canvas context. No per-frame
// allocations, no mutation of the user's timeline, and no stateful simulations.
const SOURCE_SCRATCH=new WeakMap();
function captureCompositeFrame(ctx,w,h){
 if(!ctx?.canvas||typeof document==='undefined')return null;
 let pair=SOURCE_SCRATCH.get(ctx);
 if(!pair){
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('2d');
  if(!context)return null;
  pair={canvas,context};SOURCE_SCRATCH.set(ctx,pair);
 }
 const {canvas,context}=pair;
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 context.setTransform(1,0,0,1,0,0);
 context.globalAlpha=1;context.globalCompositeOperation='source-over';
 context.clearRect(0,0,w,h);
 context.drawImage(ctx.canvas,0,0,w,h);
 return canvas;
}
const SOURCE_EFFECTS=new Set(['pendulum-swing','rebound-swing','vibration-flash',
 'fault-cassette','ripple-distortion','electric-ripple','shockwave',...PIXEL_EFFECT_IDS,...GLITCH_PRESETS.map(x=>x.id)]);
export function requiresCompositeSource(presetId){return SOURCE_EFFECTS.has(presetId);}
/** A neutral illustrated scene supplies geometry for moving/distorting previews.
 * Live clips operate on their real previously composited media instead.
 */
export function paintEffectPreviewScene(ctx,w,h){
 const sky=ctx.createLinearGradient(0,0,0,h);
 sky.addColorStop(0,'#1b3b60');sky.addColorStop(1,'#0d182b');
 ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#adbed0';
 ctx.fillRect(w*.1,h*.25,w*.26,h*.45);
 ctx.fillStyle='#f4bd70';
 ctx.fillRect(w*.14,h*.32,w*.07,h*.1);
 ctx.fillRect(w*.26,h*.32,w*.07,h*.1);
 ctx.fillStyle='#4ea7cf';
 ctx.beginPath();ctx.arc(w*.72,h*.36,h*.12,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#c9e1e9';
 ctx.fillRect(w*.58,h*.68,w*.29,h*.035);
 ctx.fillRect(w*.58,h*.75,w*.22,h*.018);
 ctx.strokeStyle='#95e1ec';ctx.lineWidth=Math.max(1,w*.005);
 ctx.beginPath();ctx.moveTo(w*.08,h*.84);ctx.lineTo(w*.93,h*.84);ctx.stroke();
}

export function effectFrameSignature(effect,seconds,duration=3){
 const e=normaliseTimelineEffect(effect);
 const local=clamp(seconds,0,Math.max(0,Number(duration)||3),0);
 return Object.freeze({...e,seconds:local,cycle:local*e.speed});
}
/** Draw additive/transparent overlays *on the current composited frame*. */
export function paintTimelineEffect(ctx,width,height,effect,seconds,duration=3){
 const e=normaliseTimelineEffect(effect);
 if(!ids.has(e.presetId))return false;
 const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
 const t=effectFrameSignature(e,seconds,duration).cycle;
 const strength=e.intensity/100;
 if(strength<=0)return true;
 const size=e.scale/100,rad=e.direction*Math.PI/180;
 // Source-dependent effects copy the *already composed* lower layers, so
 // their motion and distortion alter pixels instead of imitating a warp
 // with a still or purely decorative overlay.
 const source=requiresCompositeSource(e.presetId)?captureCompositeFrame(ctx,w,h):null;
 ctx.save();
 try{
  if(requiresCompositeSource(e.presetId)){
   // Ignore a selected effect clip's local transform when replacing a full
   // frame. Restore the existing transform, alpha and blend mode afterwards.
   if(typeof ctx.setTransform==='function')ctx.setTransform(1,0,0,1,0,0);
   ctx.globalCompositeOperation='source-over';
   const opacity=clamp(ctx.globalAlpha,0,1,1);
   const amount=clamp(strength*opacity,0,1,1);
   if(source){
    ctx.globalAlpha=1;
    ctx.clearRect(0,0,w,h);
    ctx.globalAlpha=isPixelEffect(e.presetId)&&e.presetId!=='chromatic-quirk'?1:1-amount;
    ctx.drawImage(source,0,0,w,h);
    ctx.globalAlpha=amount;
   }
   if(isPixelEffect(e.presetId)){
    renderPixelEffect(ctx,source,w,h,e,t,amount);
   }else if(isGlitchEffect(e.presetId)){
    renderGlitchEffect(ctx,source,w,h,e,t,amount);
   }else if(e.presetId==='pendulum-swing'||e.presetId==='rebound-swing'){
    const angle=e.presetId==='pendulum-swing'
     ? Math.sin(t*4+rad)*(.03+e.distortion*.0038)*size
     : Math.sin(t*13+rad)*Math.exp(-t*1.7)*(.12+e.distortion*.0047)*size;
    const px=w*e.originX/100,py=h*e.originY/100;
    ctx.translate(px,py);ctx.rotate(angle);
    if(source)ctx.drawImage(source,-px,-py,w,h);
    else{
     ctx.fillStyle=rgba(e.color,.38);
     ctx.fillRect(-w*.17,-h*.2,w*.35,h*.4);
    }
   }else if(e.presetId==='vibration-flash'){
    const tick=Math.floor(t*26),amplitude=(1+e.distortion*.2)*size;
    const dx=(random(tick*2+70)*2-1)*amplitude;
    const dy=(random(tick*2+71)*2-1)*amplitude;
    if(source)ctx.drawImage(source,dx,dy,w,h);
    else{ctx.fillStyle=rgba(e.color,.25);ctx.fillRect(dx,dy,w*.6,h*.6);}
    ctx.globalAlpha=amount;
    if(random(tick+37)>.73){
     ctx.fillStyle=rgba(e.color,.14+.30*random(tick+73));
     ctx.fillRect(0,0,w,h);
    }
   }else if(e.presetId==='fault-cassette'){
    const bands=Math.max(6,Math.min(25,Math.round(e.density*.19)));
    const tick=Math.floor(t*17);
    for(let i=0;i<bands;i++){
     const y=i*h/bands,bandH=Math.ceil(h/bands)+1;
     const jitter=(random(tick*31+i*7)-.5)*(5+e.distortion*.43)*size;
     if(source)ctx.drawImage(source,0,y,w,bandH,jitter,y,w,bandH);
     else{ctx.fillStyle=rgba(e.color,.22);ctx.fillRect(jitter,y,w*.65,bandH);}
    }
    ctx.globalAlpha=amount;
    ctx.fillStyle=rgba(e.color,.08);
    for(let i=0;i<13;i++){
     const y=wrap(random(i+51)+t*.19)*h;
     ctx.fillRect(0,y,w,Math.max(1,h*.002));
    }
   }else if(e.presetId==='ripple-distortion'||e.presetId==='electric-ripple'){
    const electric=e.presetId==='electric-ripple';
    const rows=36;
    for(let i=0;i<rows;i++){
     const y=i*h/rows,bh=Math.ceil(h/rows)+1;
     const offset=Math.sin(y/h*(7+e.density*.23)-t*(electric?12:6))
         *(.8+e.distortion*.23)*size;
     if(source)ctx.drawImage(source,0,y,w,bh,offset,y,w,bh);
     else{ctx.fillStyle=rgba(e.color,.2);ctx.fillRect(offset,y,w*.6,bh*.48);}
    }
    if(electric){
     ctx.globalAlpha=amount;
     ctx.strokeStyle=rgba(e.color,.83);ctx.lineWidth=Math.max(1,size*2);
     for(let j=0;j<4;j++){
      const y=h*(.1+j*.25)+Math.sin(t*3+j)*h*.045;
      ctx.beginPath();
      for(let i=0;i<=18;i++){
       const x=i*w/18;
       const jitter=(random(j*101+i*13+Math.floor(t*30))-.5)*h*.07;
       if(i===0)ctx.moveTo(x,y+jitter);else ctx.lineTo(x,y+jitter);
      }
      ctx.stroke();
     }
    }
   }else if(e.presetId==='shockwave'){
    // Only the annulus is refracted; the rest of the composed frame remains intact.
    if(source){ctx.globalAlpha=1;ctx.drawImage(source,0,0,w,h);ctx.globalAlpha=amount;}
    const cx=w*e.originX/100,cy=h*e.originY/100;
    const radius=wrap(t*.35)*Math.hypot(w,h)*.95;
    const thickness=Math.max(6,Math.min(w,h)*(.035+e.distortion*.0005)*size);
    if(source){
     ctx.save();
     ctx.beginPath();
     ctx.arc(cx,cy,radius+thickness,0,Math.PI*2);
     ctx.arc(cx,cy,Math.max(0,radius-thickness),0,Math.PI*2,true);
     ctx.clip('evenodd');
     const dilation=1+.04*e.distortion/100;
     ctx.translate(cx,cy);ctx.scale(dilation,dilation);
     ctx.drawImage(source,-cx,-cy,w,h);
     ctx.restore();
    }
    ctx.globalAlpha=amount;
    ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);
    ctx.strokeStyle=rgba(e.color,.75);ctx.lineWidth=Math.max(1,thickness*.14);
    ctx.stroke();
   }
   return true;
  }
  
  if(e.presetId==='light-sweep'){
   const phase=wrap(t*.26),pos=(-.35+phase*1.7)*w;
   const beam=Math.max(12,w*.18*size);
   ctx.translate(pos,h*.5);
   ctx.rotate(rad+.26);
   const g=ctx.createLinearGradient(-beam,0,beam,0);
   g.addColorStop(0,'rgba(255,255,255,0)');
   g.addColorStop(.35,rgba(e.color,.06*strength));
   g.addColorStop(.5,rgba(e.color,.64*strength));
   g.addColorStop(.65,rgba(e.color,.08*strength));
   g.addColorStop(1,'rgba(255,255,255,0)');
   ctx.fillStyle=g;ctx.fillRect(-beam,-h*1.6,beam*2,h*3.2);
  }else if(e.presetId==='hazy-atmosphere'){
   renderHazyAtmosphere(ctx,w,h,e,t,strength);
  }else if(e.presetId==='god-rays'){
   const ox=w*e.originX/100,oy=h*e.originY/100;
   const length=Math.hypot(w,h)*1.25*size;
   const gradient=ctx.createRadialGradient(ox,oy,0,ox,oy,length);
   gradient.addColorStop(0,rgba(e.color,.22*strength));
   gradient.addColorStop(.45,rgba(e.color,.12*strength));
   gradient.addColorStop(1,rgba(e.color,0));
   ctx.fillStyle=gradient;
   for(let i=0;i<9;i++){
    const angle=rad+(i-4)*.165+Math.sin(t*.7+i*1.6)*.055;
    const spread=.045+random(i+150)*.06;
    ctx.beginPath();ctx.moveTo(ox,oy);
    ctx.lineTo(ox+Math.cos(angle-spread)*length,oy+Math.sin(angle-spread)*length);
    ctx.lineTo(ox+Math.cos(angle+spread)*length,oy+Math.sin(angle+spread)*length);
    ctx.closePath();ctx.fill();
   }
  }else if(e.presetId==='light-leaks'){
   for(let i=0;i<3;i++){
    const isRight=i===1;
    const x=isRight?w*1.12:-w*.12;
    const y=h*(.18+.23*i+.18*Math.sin(t*(.65+i*.24)+i));
    const radius=w*(.65+i*.08)*size;
    const gradient=ctx.createRadialGradient(x,y,0,x,y,radius);
    const color=i===1?'#ff7b78':e.color;
    gradient.addColorStop(0,rgba(color,.56*strength));
    gradient.addColorStop(.34,rgba(color,.24*strength));
    gradient.addColorStop(1,rgba(color,0));
    ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
   }
  }else if(e.presetId==='pixel-scan'){
   // Dynamic digital population: independent regeneration, not a translated still strip.
   renderPixelScan(ctx,w,h,e,t,strength);
  }else if(e.presetId==='sci-fi-scan'){
   renderSciFiScan(ctx,w,h,e,t,strength);
  }else if(e.presetId==='fire-flames'){
   renderFireFlames(ctx,w,h,e,t,strength);
  }else if(e.presetId==='fire-embers'){
   renderFlamingDust(ctx,w,h,e,t,strength);
  }else if(e.presetId==='fire-explosion'){
   // Radial burst with a decaying shock crown and distributed fiery projectiles.
   const p=wrap(t*.33),cx=w*e.originX/100,cy=h*e.originY/100;
   const radius=Math.min(w,h)*(.06+p*.57)*size;
   const count=Math.min(120,Math.max(14,Math.round(e.density)));
   const clip=ctx.globalAlpha;
   const pulse=Math.pow(1-p,1.7)*strength;
   const g=ctx.createRadialGradient(cx,cy,0,cx,cy,radius);
   g.addColorStop(0,'rgba(255,248,180,'+(.8*pulse)+')');
   g.addColorStop(.3,'rgba(255,112,27,'+(.6*pulse)+')');
   g.addColorStop(1,'rgba(170,20,9,0)');
   ctx.fillStyle=g;ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);
   for(let i=0;i<count;i++){
    const angle=i*Math.PI*2/count+random(i+34)*.25+rad;
    const distance=radius*(.36+.7*random(i+60));
    const x=cx+Math.cos(angle)*distance;
    const y=cy+Math.sin(angle)*distance;
    const span=Math.max(1,(1-p)*Math.min(w,h)*.065*size);
    ctx.globalAlpha=clip*pulse*(.35+.65*random(i+91));
    ctx.strokeStyle=i%3===0?e.color:i%2===0?'#ff581e':'#ffd477';
    ctx.lineWidth=Math.max(1,2.6*size);
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.lineTo(x-Math.cos(angle)*span,y-Math.sin(angle)*span);ctx.stroke();
   }
   ctx.globalAlpha=clip;
  }else if(e.presetId==='rhythmic-flicker'){
   // Rhythm and seeded discontinuities are absolute-time calculations.
   const beat=Math.max(0,Math.sin(t*Math.PI*5));
   const jitter=random(Math.floor(t*23)+907);
   const flash=beat*.6+jitter*.4;
   const dark=flash>.53;
   ctx.fillStyle=dark?'rgba(0,0,0,'+(.42*strength*(flash-.2))+')'
                     :rgba(e.color,.13*strength*(1-flash));
   ctx.fillRect(0,0,w,h);
  }else if(e.presetId==='particle-dust'){
   renderFlamingDust(ctx,w,h,e,t,strength);
  }else if(e.presetId.startsWith('particle-')){
   const sparks=e.presetId==='particle-sparks',debris=e.presetId==='particle-debris';
   const count=Math.min(120,Math.max(1,Math.round(e.density)));
   const clipAlpha=ctx.globalAlpha;
   const dx=Math.cos(rad),dy=Math.sin(rad);
   for(let i=0;i<count;i++){
    const life=wrap(random(i*13+2)+t/(sparks?1.4:debris?3.1:7.5));
    const baseX=random(i*13+3)*w,baseY=random(i*13+5)*h;
    const travel=(sparks?Math.min(w,h)*.7:debris?Math.min(w,h)*.28:h*.15)*size;
    const x=wrap((baseX+dx*travel*life+Math.sin(i*2.6+t)*w*.012)/w)*w;
    const y=wrap((baseY+dy*travel*life-(sparks?0:life*h*.15))/h)*h;
    const fade=Math.min(1,life*6,(1-life)*6)*strength;
    const r=(sparks?1.4:debris?3.2:1.7)*size*(.6+random(i*13+8));
    ctx.globalAlpha=clipAlpha*fade;
    ctx.fillStyle=sparks?'#ffffff':e.color;
    ctx.strokeStyle=sparks?e.color:ctx.fillStyle;
    if(sparks){
     ctx.lineWidth=Math.max(1,r*.8);ctx.beginPath();ctx.moveTo(x,y);
     ctx.lineTo(x-dx*r*5,y-dy*r*5);ctx.stroke();
    }else if(debris){
     ctx.save();ctx.translate(x,y);ctx.rotate(rad+life*4+random(i+91));
     ctx.fillRect(-r/2,-r/2,r*2,r);ctx.restore();
    }else{
     ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
   }
   ctx.globalAlpha=clipAlpha;
  }
 }finally{ctx.restore();}
 return true;
}
