/**
 * MotoriClip #66 quality-audit unit: Electric Sparks.
 *
 * The old version repeated short straight white strokes. This procedural
 * painter now emits independently seeded, short-lived electrical discharges
 * with jagged multi-point arcs, optional forks, pale cores, coloured bloom,
 * moving heads and individual extinguish/re-ignite timing. Everything is
 * derived from absolute clip-relative time and saved parameters; no counters,
 * timers, source-frame substitutions or stored particle simulations.
 */
const clamp=(v,min,max,fallback=min)=>{
 const n=Number(v);return Math.min(max,Math.max(min,Number.isFinite(n)?n:fallback));
};
function seeded(a,b=0){
 let x=(Math.imul((a|0)+177,0x9e3779b1)^Math.imul((b|0)+23,0x85ebca6b))>>>0;
 x^=x>>>16;x=Math.imul(x,0x7feb352d)>>>0;
 x^=x>>>15;x=Math.imul(x,0x846ca68b)>>>0;x^=x>>>16;
 return (x>>>0)/4294967296;
}
const wrap=n=>((n%1)+1)%1;
function settings(effect={}){
 return {
  density:Math.round(clamp(effect.density,1,120,48)),
  length:clamp(effect.scale,10,300,100)/100,
  direction:clamp(effect.direction,-180,180,0)*Math.PI/180,
  jaggedness:clamp(effect.distortion,0,100,62)/100,
  glow:clamp(effect.glow,0,100,76)/100,
  forks:Math.round(clamp(effect.sparkForks,0,4,2)),
  lifetime:clamp(effect.sparkLife,.12,.9,.38),
  seed:Math.round(clamp(effect.sparkSeed,0,99999,6666)),
  originX:clamp(effect.originX,0,100,50)/100,
  originY:clamp(effect.originY,0,100,62)/100,
  color:/^#[0-9a-f]{6}$/i.test(String(effect.color))?String(effect.color).toLowerCase():'#63dcff'
 };
}
function coords(x0,y0,x1,y1,count,amplitude,seed,cycle,phase=0){
 const nodes=[];
 const dx=x1-x0,dy=y1-y0,mag=Math.hypot(dx,dy)||1;
 for(let i=0;i<=count;i++){
  const u=i/count;
  const offset=i===0||i===count?0:
   (seeded(i+seed*17,cycle+94)-.5)*amplitude*Math.sin(Math.PI*u)+
   Math.sin(phase+u*19.7)*amplitude*.15*Math.sin(Math.PI*u);
  nodes.push({
   x:x0+dx*u-dy/mag*offset,
   y:y0+dy*u+dx/mag*offset
  });
 }
 return nodes;
}
/** Returns independent active sparks for *any* time, even when seeking backwards. */
export function buildElectricSparksFrame(width,height,effect={},seconds=0){
 const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
 const p=settings(effect),time=Math.max(0,Number(seconds)||0);
 const count=Math.max(1,Math.min(75,Math.ceil(p.density*.62)));
 const sparks=[];
 for(let id=0;id<count;id++){
  const rate=(.65+seeded(id,p.seed+1)*1.45)/p.lifetime;
  const ageTime=time*rate+seeded(id,p.seed+2);
  const generation=Math.floor(ageTime),age=wrap(ageTime);
  // Short, independently decaying pulses keep the composition irregular.
  const envelope=Math.pow(Math.max(0,Math.sin(Math.PI*age)),.6);
  if(envelope<.13)continue;
  const key=id*71+generation*113+p.seed*3;
  const spread=.28+.72*seeded(key,p.seed+3);
  const cx=w*p.originX,cy=h*p.originY;
  const x0=seeded(key,p.seed+4)<.73
   ?cx+(seeded(key,p.seed+5)-.5)*w*.65
   :w*seeded(key,p.seed+6);
  const y0=seeded(key,p.seed+7)<.73
   ?cy+(seeded(key,p.seed+8)-.5)*h*.72
   :h*seeded(key,p.seed+9);
  const baseAngle=p.direction+(seeded(key,p.seed+10)-.5)*1.9;
  const travel=Math.min(w,h)*p.length*(.12+.24*spread);
  const extent=travel*(.18+.82*age);
  const tipX=x0+Math.cos(baseAngle)*extent,tipY=y0+Math.sin(baseAngle)*extent;
  const amp=extent*(.025+.20*p.jaggedness);
  const segments=4+Math.floor(seeded(key,p.seed+11)*5);
  const path=coords(x0,y0,tipX,tipY,segments,amp,key,generation,age*3.1);
  const branches=[];
  const branchLimit=p.forks===0?0:Math.min(p.forks,1+Math.floor(seeded(key,p.seed+12)*p.forks));
  for(let branch=0;branch<branchLimit;branch++){
   const pin=2+Math.floor(seeded(key+branch,p.seed+13)*Math.max(1,segments-2));
   const attach=path[Math.min(path.length-2,pin)];
   const side=seeded(key+branch,p.seed+14)<.5?-1:1;
   const theta=baseAngle+side*(.43+.9*seeded(key+branch,p.seed+15));
   const distance=extent*(.18+.34*seeded(key+branch,p.seed+16));
   const bx=attach.x+Math.cos(theta)*distance;
   const by=attach.y+Math.sin(theta)*distance;
   branches.push(coords(attach.x,attach.y,bx,by,3+branch%2,amp*.85,key+branch*37,generation,age*4));
  }
  const sparkWidth=Math.max(.5,Math.min(3.5,p.length*(.48+1.2*seeded(key,p.seed+17))));
  const pulse=.72+.28*Math.sin(17*time+seeded(key,p.seed+18)*Math.PI*2);
  sparks.push({id,generation,age,alpha:envelope*pulse,
   path,branches,width:sparkWidth,
   tip: path[path.length-1],color:p.color,
   glow:p.glow});
 }
 return {width:w,height:h,time,params:p,sparks};
}
function stroke(ctx,nodes){
 if(!nodes?.length)return;
 ctx.beginPath();
 ctx.moveTo(nodes[0].x,nodes[0].y);
 for(let i=1;i<nodes.length;i++)ctx.lineTo(nodes[i].x,nodes[i].y);
 ctx.stroke();
}
/** Additive transparent overlay, shared by preview, scrubbing and exporters. */
export function renderElectricSparks(ctx,width,height,effect={},seconds=0,strength=1){
 const intensity=clamp(strength,0,1,1);
 if(!intensity)return true;
 const state=buildElectricSparksFrame(width,height,effect,seconds);
 const base=Number.isFinite(ctx.globalAlpha)?ctx.globalAlpha:1;
 ctx.save();
 try{
  ctx.globalCompositeOperation='screen';
  for(const spark of state.sparks){
   const a=clamp(spark.alpha*intensity*base,0,1);
   if(a<.015)continue;
   if(spark.glow>0){
    ctx.strokeStyle=spark.color;
    ctx.lineWidth=spark.width*(3+6*spark.glow);
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.globalAlpha=a*spark.glow*.11;
    stroke(ctx,spark.path);
    for(const branch of spark.branches)stroke(ctx,branch);
   }
   ctx.strokeStyle=spark.color;
   ctx.lineWidth=spark.width*1.8;
   ctx.lineCap='round';ctx.lineJoin='round';
   ctx.globalAlpha=a*.72;
   stroke(ctx,spark.path);
   ctx.lineWidth=Math.max(.45,spark.width*.5);
   ctx.strokeStyle='#f5fcff';
   ctx.globalAlpha=a*.88;
   stroke(ctx,spark.path);
   for(const branch of spark.branches){
    ctx.strokeStyle=spark.color;ctx.lineWidth=Math.max(.35,spark.width*.83);
    ctx.globalAlpha=a*.63;stroke(ctx,branch);
    ctx.strokeStyle='#f7fdff';ctx.lineWidth=Math.max(.3,spark.width*.32);
    ctx.globalAlpha=a*.67;stroke(ctx,branch);
   }
   // Compact tip bloom: translucent discs instead of opaque rectangular flares.
   if(spark.glow>0){
    const r=Math.max(2,spark.width*(4+spark.glow*7));
    const grad=ctx.createRadialGradient(spark.tip.x,spark.tip.y,0,spark.tip.x,spark.tip.y,r);
    grad.addColorStop(0,'rgba(244,252,255,'+(a*.52*spark.glow).toFixed(4)+')');
    grad.addColorStop(.23,'rgba(107,224,255,'+(a*.21*spark.glow).toFixed(4)+')');
    grad.addColorStop(1,'rgba(56,146,255,0)');
    ctx.globalAlpha=1;ctx.fillStyle=grad;
    ctx.fillRect(spark.tip.x-r,spark.tip.y-r,r*2,r*2);
   }
  }
 }finally{ctx.restore();}
 return true;
}
