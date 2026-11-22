/**
 * MotoriClip #50 — Sci-Fi Scan procedural scanning HUD.
 *
 * Real fast target shuttle up/down the active scanner beam, independent
 * bidirectional horizontal telemetry streaks, seeded detections and pulses.
 * Pure absolute clip-relative time; no scrolling bitmap or frame counters.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a));
const wrap=x=>((x%1)+1)%1;
const triangle=x=>1-Math.abs(2*wrap(x)-1);
function hash(a,b=0){
 let n=(Math.imul((Math.trunc(a)+1)>>>0,0x9e3779b1)
       ^Math.imul((Math.trunc(b)+7)>>>0,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;n^=n>>>15;
 n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
}
const COLOR='#63ebff';
function config(effect={}){
 return {
  density:Math.round(clamp(effect.density??48,1,120)),
  distortion:clamp(effect.distortion??55,0,100)/100,
  glow:clamp(effect.glow??64,0,100)/100,
  scale:clamp(effect.scale??100,10,300)/100,
  direction:clamp(effect.direction??0,-180,180),
  originX:clamp(effect.originX??20,0,100)/100,
  originY:clamp(effect.originY??12,0,100)/100,
  color:/^#[a-f\d]{6}$/i.test(String(effect.color))?String(effect.color):COLOR
 };
}
/** All objects are time-sampled, serializable geometry, independent of paint order. */
export function buildSciFiScanFrame(width,height,effect={},seconds=0){
 const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1),o=config(effect);
 const t=Math.max(0,Number(seconds)||0);
 // Main vertical scanner searches left-to-right and bounces. A fast shuttle
 // target travels up/down *along that line*, independent of the sweep clock.
 const sweep=triangle(t*(.23+.12*o.distortion)+o.originX*.37+o.direction/360+.07);
 const beamX=w*(.07+.86*sweep);
 const targetPhase=t*(.88+1.8*o.distortion)+o.originY*.42
    +.047*Math.sin(t*.62+o.direction*Math.PI/180);
 const targetY=h*(.08+.84*triangle(targetPhase));
 const targetPulse=Math.pow(.5+.5*Math.sin(t*17+o.originX*7),3);
 const targetRadius=Math.max(6,Math.min(w,h)*(.048+.022*o.glow)*o.scale);
 const segmentCount=Math.max(8,Math.min(40,Math.round(o.density*.31)));
 const segments=[];
 for(let i=0;i<segmentCount;i++){
  const direction=i%2===0?1:-1;
  const speed=.54+1.8*hash(i,14);
  const travel=wrap(hash(i,17)+t*speed);
  // Each bar runs on its own clock in an opposite horizontal direction.
  // Signed clocks wrap telemetry through the full scene, while the beam
  // remains their moving search origin; never confine bars to one side.
  const offset=direction*(travel-.5)*1.12;
  const x=wrap(beamX/w+offset)*w;
  const y=h*(.07+.86*hash(i,33))
   +Math.sin(t*(1+hash(i,40)*2)+i)*h*.016;
  const alpha=(.22+.68*hash(i,29))*(.40+.60*Math.pow(Math.sin(t*(7+hash(i,5)*9)+i),2));
  const length=Math.max(4,w*(.015+.09*hash(i,61))*o.scale);
  segments.push({id:i,x,y,length,height:Math.max(.7,h*(.002+.007*hash(i,66))*o.scale),
   direction,speed,travel,alpha});
 }
 const count=Math.max(10,Math.min(42,Math.round(o.density*.27)));
 const blips=[];
 for(let i=0;i<count;i++){
  const rate=.58+1.5*hash(i,97);
  const clock=t*rate+hash(i,99),generation=Math.floor(clock),age=wrap(clock);
  const born=hash(i*19+generation*103,22);
  const y=h*(.07+.86*hash(i*29+generation*43,31));
  const x=beamX+(born-.5)*w*(.13+.22*o.distortion);
  const alpha=(1-Math.min(1,age*3.7))*(.35+.65*hash(i,105))
     *(age<.42?1:0);
  const radius=Math.max(3,targetRadius*(.23+1.3*age)
      *(1+.9*hash(i,71)));
  blips.push({id:i,x,y,rate,age,generation,alpha,radius,ring:age>.09&&age<.33});
 }
 return {beamX,targetY,targetPulse,targetRadius,sweep,segments,blips,
  color:o.color,glow:o.glow,scale:o.scale,direction:o.direction};
}
function rgba(hex,a){
 const h=hex.slice(1),rgb=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
 return 'rgba('+rgb.join(',')+','+clamp(a,0,1).toFixed(4)+')';
}
/** Paint scanner on top of already composed video; restore every Canvas state. */
export function renderSciFiScan(ctx,w,h,e={},cycle=0,strength=clamp(e.intensity??70,0,100)/100){
 const opacity=clamp(strength,0,1);
 if(opacity<=0)return true;
 const f=buildSciFiScanFrame(w,h,e,cycle),c=f.color;
 const baseAlpha=Number.isFinite(ctx.globalAlpha)?ctx.globalAlpha:1;
 ctx.save();
 try{
  ctx.globalCompositeOperation='screen';
  const glowWidth=Math.max(4,Math.min(w,h)*(.025+f.glow*.055)*f.scale);
  const strip=ctx.createLinearGradient(f.beamX-glowWidth*3,0,f.beamX+glowWidth*3,0);
  strip.addColorStop(0,rgba(c,0));
  strip.addColorStop(.43,rgba(c,.075*opacity));
  strip.addColorStop(.5,rgba(c,.29*opacity));
  strip.addColorStop(.57,rgba(c,.075*opacity));
  strip.addColorStop(1,rgba(c,0));
  ctx.globalAlpha=baseAlpha;
  ctx.fillStyle=strip;
  ctx.fillRect(f.beamX-glowWidth*3,0,glowWidth*6,h);
  ctx.strokeStyle=rgba(c,.75*opacity);
  ctx.lineWidth=Math.max(.8,1.2*f.scale);
  ctx.beginPath();ctx.moveTo(f.beamX,0);ctx.lineTo(f.beamX,h);ctx.stroke();

  // Individual telemetry segments race both left and right independently.
  for(const bar of f.segments){
   const head=bar.direction>0?bar.x:bar.x-bar.length;
   const trail=ctx.createLinearGradient(
    bar.direction>0?head-bar.length:head,bar.y,
    bar.direction>0?head+bar.length:head+bar.length*2,bar.y);
   trail.addColorStop(0,rgba(c,0));
   trail.addColorStop(.5,rgba(c,bar.alpha*.47*opacity));
   trail.addColorStop(1,rgba(c,0));
   ctx.fillStyle=trail;
   ctx.fillRect(head-bar.length,bar.y-bar.height*.7,bar.length*2.6,bar.height*2.2);
   ctx.fillStyle=rgba(c,bar.alpha*.8*opacity);
   ctx.fillRect(head,bar.y,Math.max(2,bar.length*.25),Math.max(.9,bar.height));
  }

  // Independent, short-lived detection returns; each has its own lifetime,
  // generation, origin and expanding ring rather than a looped still HUD.
  for(const hit of f.blips){
   if(hit.alpha<.02)continue;
   const a=hit.alpha*opacity;
   const halo=ctx.createRadialGradient(hit.x,hit.y,0,hit.x,hit.y,hit.radius*2.8);
   halo.addColorStop(0,rgba(c,.32*a));
   halo.addColorStop(.4,rgba(c,.12*a));
   halo.addColorStop(1,rgba(c,0));
   ctx.fillStyle=halo;
   ctx.fillRect(hit.x-hit.radius*2.8,hit.y-hit.radius*2.8,hit.radius*5.6,hit.radius*5.6);
   ctx.strokeStyle=rgba(c,.85*a);ctx.lineWidth=Math.max(.6,f.scale);
   ctx.beginPath();ctx.arc(hit.x,hit.y,hit.radius,0,Math.PI*2);ctx.stroke();
   if(hit.ring){
    ctx.beginPath();ctx.arc(hit.x,hit.y,hit.radius*1.8,0,Math.PI*2);ctx.stroke();
   }
  }

  // The reticle is a fast autonomous up/down detection shuttle on the beam.
  const r=f.targetRadius,pulse=.72+.28*f.targetPulse;
  ctx.strokeStyle=rgba(c,pulse*opacity);
  ctx.lineWidth=Math.max(1,1.5*f.scale);
  ctx.beginPath();ctx.arc(f.beamX,f.targetY,r,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(f.beamX-r*1.9,f.targetY);ctx.lineTo(f.beamX-r*.65,f.targetY);
  ctx.moveTo(f.beamX+r*.65,f.targetY);ctx.lineTo(f.beamX+r*1.9,f.targetY);
  ctx.moveTo(f.beamX,f.targetY-r*1.9);ctx.lineTo(f.beamX,f.targetY-r*.65);
  ctx.moveTo(f.beamX,f.targetY+r*.65);ctx.lineTo(f.beamX,f.targetY+r*1.9);
  ctx.stroke();
  const center=ctx.createRadialGradient(f.beamX,f.targetY,0,
    f.beamX,f.targetY,r*(1.3+f.glow));
  center.addColorStop(0,rgba('#ffffff',.63*pulse*opacity));
  center.addColorStop(.25,rgba(c,.32*pulse*opacity));
  center.addColorStop(1,rgba(c,0));
  ctx.fillStyle=center;
  ctx.fillRect(f.beamX-r*2,f.targetY-r*2,r*4,r*4);
 }finally{ctx.restore();}
 return true;
}
