/**
 * MotoriClip procedural effect clips — Phase 3A–B.
 * Effects are recipes (not PNG animations). Preview and both exporters render
 * from identical clip-relative seconds, including reverse seeking.
 * Artifex FX's procedural/seeded approach informed this independent Canvas2D
 * implementation; no runtime or nonportable asset dependency is introduced.
 */
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
 {id:'sci-fi-scan',label:'Sci-Fi Scan',group:'effect',category:'Scanning',animated:true}
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
 return {
  presetId:ids.has(raw.presetId)?raw.presetId:'light-sweep',
  intensity:clamp(raw.intensity,0,100,70),
  speed:clamp(raw.speed,.1,8,1),
  density:clamp(raw.density,1,120,48),
  scale:clamp(raw.scale,10,300,100),
  direction:clamp(raw.direction,-180,180,0),
  originX:clamp(raw.originX,0,100,20),
  originY:clamp(raw.originY,0,100,12),
  color:/^#[0-9a-f]{6}$/i.test(String(raw.color))?String(raw.color).toLowerCase():'#ffd98d'
 };
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
 ctx.save();
 try{
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
   for(let i=0;i<7;i++){
    const drift=t*(.11+random(i+3)*.09);
    const x=wrap(random(i+21)+drift)*w;
    const y=(.16+random(i+41)*.68)*h+Math.sin(t*.6+i)*h*.08;
    const radius=Math.max(w,h)*(.16+random(i+51)*.22)*size;
    const g=ctx.createRadialGradient(x,y,0,x,y,radius);
    g.addColorStop(0,rgba(e.color,.125*strength));
    g.addColorStop(.6,rgba(e.color,.05*strength));
    g.addColorStop(1,rgba(e.color,0));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
   }
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
   const phase=wrap(t*.28),y=phase*h,band=Math.max(6,18*size);
   const grad=ctx.createLinearGradient(0,y-band*3,0,y+band*3);
   grad.addColorStop(0,rgba(e.color,0));grad.addColorStop(.5,rgba(e.color,.50*strength));grad.addColorStop(1,rgba(e.color,0));
   ctx.fillStyle=grad;ctx.fillRect(0,y-band*3,w,band*6);
   const grid=Math.max(5,Math.round(13*size));
   const n=Math.round(e.density);
   for(let i=0;i<n;i++){
    const x=Math.floor(random(i+98)*w/grid)*grid;
    const offset=Math.floor((random(i+201)-.5)*5)*grid;
    ctx.fillStyle=rgba(e.color,(.13+.34*random(i+331))*strength);
    ctx.fillRect(x,y+offset,grid*(1+Math.floor(random(i+411)*3)),grid);
   }
  }else if(e.presetId==='sci-fi-scan'){
   const phase=wrap(t*.23),x=(rad>=0?phase:1-phase)*w;
   const beam=Math.max(3,9*size);
   const g=ctx.createLinearGradient(x-beam*7,0,x+beam,0);
   g.addColorStop(0,rgba(e.color,0));g.addColorStop(.8,rgba(e.color,.21*strength));
   g.addColorStop(1,rgba(e.color,.85*strength));
   ctx.fillStyle=g;ctx.fillRect(x-beam*7,0,beam*8,h);
   ctx.strokeStyle=rgba(e.color,.86*strength);ctx.lineWidth=Math.max(1,1.5*size);
   ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
   // HUD tick marks, crosshair and bracket corners, rather than pixel blocks.
   const unit=Math.max(16,Math.round(30*size));
   for(let y=0;y<h;y+=unit){
    ctx.beginPath();ctx.moveTo(x-8*size,y);ctx.lineTo(x+(y/unit%5===0?29:12)*size,y);ctx.stroke();
   }
   const cy=h*(.52+.22*Math.sin(t*.4));
   ctx.beginPath();ctx.arc(x,cy,Math.max(12,28*size),0,Math.PI*2);ctx.stroke();
   ctx.beginPath();ctx.moveTo(x-42*size,cy);ctx.lineTo(x-11*size,cy);
   ctx.moveTo(x+11*size,cy);ctx.lineTo(x+42*size,cy);
   ctx.moveTo(x,cy-42*size);ctx.lineTo(x,cy-11*size);ctx.stroke();
  }else if(e.presetId==='rhythmic-flicker'){
   // Rhythm and seeded discontinuities are absolute-time calculations.
   const beat=Math.max(0,Math.sin(t*Math.PI*5));
   const jitter=random(Math.floor(t*23)+907);
   const flash=beat*.6+jitter*.4;
   const dark=flash>.53;
   ctx.fillStyle=dark?'rgba(0,0,0,'+(.42*strength*(flash-.2))+')'
                     :rgba(e.color,.13*strength*(1-flash));
   ctx.fillRect(0,0,w,h);
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
