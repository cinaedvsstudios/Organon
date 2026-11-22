/**
 * MotoriClip #48 — independently seeded turbulent dust and genuine rising embers.
 *
 * Each mote is a pure function of absolute clip-relative seconds + stable
 * particle ID + its current generation. Rise is accelerated, paths are curved
 * by independently phased multi-frequency turbulence, colour/size/lifetime
 * vary, and alpha fades across each life. No frame counters or wall clock.
 */
const clamp=(x,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(x))?Number(x):min));
const wrap=x=>((x%1)+1)%1;
function random(i,seed=0){
 let n=(Math.imul((Math.trunc(i)+1)>>>0,0x9e3779b1)^Math.imul((Math.trunc(seed)+13)>>>0,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;n^=n>>>15;
 n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
}
const smooth=x=>{const v=clamp(x,0,1);return v*v*(3-2*v);};
const colors={
 ember:['#fff7ce','#ffe38d','#ffc263','#ff8e3e','#ef4c24','#ffffff'],
 dust:['#fff8e6','#f1d5a0','#e5b874','#d8ab75','#ffffff']
};
const hexColor=x=>/^#[0-9a-f]{6}$/i.test(String(x))?String(x).toLowerCase():'#ffd98d';
function positionAt({ember,w,h,life,birthX,birthY,initial,acceleration,wind,amplitude,frequency,phase,phase2,side},l){
 const age=clamp(l,0,1);
 const rise=(initial*age+.5*acceleration*age*age)*(ember?1:.32);
 const turbulence=amplitude*(.6*Math.sin(phase+age*frequency*6.28318)
   +.28*Math.sin(phase2+age*frequency*14.137)
   +.12*Math.sin(phase2*.7+age*29.37));
 const bending=wind*(age*age*.75+age*.25)+turbulence*(.24+.76*age);
 const sideways=side*(.16+age*.5)*h*(ember?.008:.01);
 return {x:birthX+bending+sideways,y:birthY-rise+
   Math.sin(phase+age*9.11)*amplitude*(ember?.12:.35)};
}

/** Quantized, reproducible per-particle physics for both supported effects. */
export function buildFlamingDustFrame(w,h,effect={},clipCycle=0){
 const W=Math.max(1,Number(w)||1),H=Math.max(1,Number(h)||1);
 const ember=effect.presetId==='fire-embers';
 const t=Math.max(0,Number(clipCycle)||0);
 const count=Math.round(clamp(effect.density??48,1,120));
 const size=clamp(effect.scale??100,10,300)/100;
 const turbulence=clamp(effect.distortion??55,0,100)/100;
 const glow=clamp(effect.glow??64,0,100)/100;
 const direction=clamp(effect.direction??0,-180,180)*Math.PI/180;
 const originX=clamp(effect.originX??20,0,100)/100;
 const originY=clamp(effect.originY??12,0,100)/100;
 const color=hexColor(effect.color);
 const particles=[];
 for(let id=0;id<count;id++){
  const rate=(ember?.27:.13)+(ember?.48:.24)*random(id,15);
  const phaseAge=t*rate+random(id,2);
  const life=wrap(phaseAge),generation=Math.floor(phaseAge);
  // Birth state is refreshed for each motes' personal lifetime.
  const seed=id*131+generation*73;
  const phase=random(seed,3)*6.28318,phase2=random(seed,4)*6.28318;
  const birthX=W*(.14*originX+.86*random(seed,5));
  const birthY=ember
    ?H*(.93-(originY-.12)*.55+random(seed,6)*.24)
    :H*wrap(.18*originY+.82*random(seed,6));
  const initial=H*((ember?.45:.11)+random(seed,7)*(ember?.5:.16));
  const acceleration=H*((ember?.35:.05)+random(seed,8)*(ember?.9:.14));
  const wind=(Math.sin(direction)*(ember?.49:.29)+Math.cos(phase)*.07)*W
    *((.35+.65*random(seed,9)));
  const amplitude=H*((ember?.045:.036)+turbulence*(ember?.22:.18))
    *(.3+.7*random(seed,10));
  const frequency=1.1+random(seed,11)*3.8;
  const side=random(seed,12)*2-1;
  const phys={ember,w:W,h:H,life,birthX,birthY,initial,acceleration,wind,amplitude,
   frequency,phase,phase2,side};
  const here=positionAt(phys,life);
  const before=positionAt(phys,Math.max(0,life-.025));
  const tick=Math.floor(t*(ember?19:7)+random(seed,25)*29);
  const sparkle=.62+.38*random(seed+tick*19,26);
  const pulse=.72+.28*Math.pow(.5+.5*Math.sin(t*(6+4*random(seed,13))+phase),5);
  const fade=smooth(life/.12)*Math.pow(Math.max(0,1-life),ember?.9:1.35);
  const alpha=clamp(fade*sparkle*pulse,0,1);
  const radius=Math.max(.5,Math.min(10,(ember?1.7:2.25)*size
    *(.35+1.4*random(seed,14))*(1-.38*life)));
  const palette=colors[ember?'ember':'dust'];
  const actualColor=id%6===0?color:palette[Math.floor(random(seed,17)*palette.length)];
  particles.push({
   id,mode:ember?'ember':'dust',life,generation,rate,tick,
   x:here.x,y:here.y,dx:here.x-before.x,dy:here.y-before.y,
   birthX,birthY,initial,acceleration,wind,amplitude,frequency,
   radius,color:actualColor,alpha,
   glowRadius:radius*(2+glow*(ember?5:3)),
   flare:ember&&random(seed+tick*11,32)>.87
  });
 }
 return particles;
}

/** Draw independently evolving motes without touching the footage below. */
export function renderFlamingDust(ctx,w,h,e={},clipCycle=0,strength=1){
 const particles=buildFlamingDustFrame(w,h,e,clipCycle);
 const ember=e.presetId==='fire-embers';
 const intensity=clamp(strength,0,1);
 const glow=clamp(e.glow??64,0,100)/100;
 const baseAlpha=Number.isFinite(ctx.globalAlpha)?ctx.globalAlpha:1;
 ctx.save();
 try{
  ctx.globalCompositeOperation='screen';
  for(const p of particles){
   if(p.alpha<.012||p.x<-40||p.x>w+40||p.y<-40||p.y>h+40)continue;
   const a=baseAlpha*intensity*p.alpha;
   if(glow>0){
    const radial=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.glowRadius);
    radial.addColorStop(0,'rgba(255,244,192,'+(a*glow*(ember?.58:.26)).toFixed(4)+')');
    radial.addColorStop(.44,'rgba(255,150,62,'+(a*glow*(ember?.13:.06)).toFixed(4)+')');
    radial.addColorStop(1,'rgba(255,82,13,0)');
    ctx.globalAlpha=1;
    ctx.fillStyle=radial;
    ctx.fillRect(p.x-p.glowRadius,p.y-p.glowRadius,p.glowRadius*2,p.glowRadius*2);
   }
   ctx.globalAlpha=a;
   if(ember){
    // Short-lived wispy streaks point along each particle's own curve.
    ctx.strokeStyle=p.color;
    ctx.lineWidth=Math.max(.4,p.radius*.38);
    ctx.beginPath();ctx.moveTo(p.x-p.dx*.8,p.y-p.dy*.8);ctx.lineTo(p.x,p.y);ctx.stroke();
   }
   ctx.fillStyle=p.color;
   ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();
   if(p.flare){
    ctx.globalAlpha=a*.42;
    ctx.strokeStyle='#fffde8';ctx.lineWidth=Math.max(.5,p.radius*.3);
    ctx.beginPath();ctx.moveTo(p.x-p.radius*2,p.y);ctx.lineTo(p.x+p.radius*2,p.y);
    ctx.moveTo(p.x,p.y-p.radius*2);ctx.lineTo(p.x,p.y+p.radius*2);ctx.stroke();
   }
  }
 }finally{ctx.restore();}
 return true;
}