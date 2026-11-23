/**
 * MotoriClip #66 quality audit — Flying Debris.
 *
 * Independently emitted stone/metal fragments are irregular polygonal shards,
 * not uniformly rotating rectangles. Each one has its own birth/expiry,
 * ballistic trajectory, gravitational acceleration, curved turbulence, 3-D-ish
 * tumble, faceted shading and occasional changing edge reflection. No mutable
 * simulation state, wall-clock timers or fixed frame-rate assumptions.
 *
 * Reuse the existing particle-debris preset ID and transparent compositing;
 * timeline playback, reverse seeking and H.264 export use the same painter.
 */
const clamp=(v,min,max,fallback=min)=>{
 const n=Number(v);return Math.max(min,Math.min(max,Number.isFinite(n)?n:fallback));
};
const fract=v=>((v%1)+1)%1;
function random(a,b=0){
 let n=(Math.imul((a|0)+173,0x9e3779b1)^Math.imul((b|0)+53,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
}
function colour(hex){
 const normalized=/^#[0-9a-f]{6}$/i.test(String(hex))?String(hex).toLowerCase():'#aab1bc';
 return [1,3,5].map(i=>parseInt(normalized.slice(i,i+2),16));
}
const rgb=(base,gain)=>'rgb('+base.map(c=>Math.round(clamp(c*gain,0,255,0))).join(',')+')';
function options(e={}){
 return {
  count:Math.round(clamp(e.density,1,120,48)),
  scale:clamp(e.scale,10,300,100)/100,
  wind:clamp(e.direction,-180,180,0)*Math.PI/180,
  turbulence:clamp(e.distortion,0,100,55)/100,
  gravity:clamp(e.debrisGravity,0,100,72)/100,
  tumble:clamp(e.debrisTumble,0,100,68)/100,
  spread:clamp(e.debrisSpread,0,100,67)/100,
  lifetime:clamp(e.debrisLife,.35,4,2.15),
  seed:Math.round(clamp(e.debrisSeed,0,99999,6767)),
  originX:clamp(e.originX,0,100,50)/100,
  originY:clamp(e.originY,0,100,42)/100,
  color:colour(e.color)
 };
}
/** Fraction of a lifetime spent at birth and death, no sudden wrapped edges. */
function envelope(u){
 const rise=Math.min(1,u/.13),fall=Math.min(1,(1-u)/.20);
 return Math.pow(Math.max(0,Math.min(rise,fall)),.78);
}
function polygon(key,p){
 const count=5+Math.floor(random(key,p.seed+11)*5);
 const phase=random(key,p.seed+12)*Math.PI*2;
 const vertices=[];
 for(let j=0;j<count;j++){
  const rad=phase+Math.PI*2*j/count;
  const radius=.53+.52*random(key+j*71,p.seed+13);
  vertices.push({x:Math.cos(rad)*radius,y:Math.sin(rad)*radius});
 }
 return vertices;
}
/** Pure absolute-time state of the on-screen shards, for testing and rendering. */
export function buildFlyingDebrisFrame(width,height,effect={},seconds=0){
 const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
 const p=options(effect),t=Math.max(0,Number(seconds)||0);
 const pieces=[];
 const dimension=Math.min(w,h);
 for(let id=0;id<p.count;id++){
  // Individual generation boundaries: each piece fades before respawning
  // at an unrelated seeded location and velocity.
  const speedFactor=.75+.65*random(id,p.seed+1);
  const lifetime=p.lifetime*speedFactor;
  const stage=t/lifetime+random(id,p.seed+2);
  const generation=Math.floor(stage),u=fract(stage);
  const opacity=envelope(u);
  if(opacity<.02)continue;
  const key=id*127+generation*433+p.seed*7;
  const angle=2*Math.PI*random(key,p.seed+3);
  const ejection=.14+.69*random(key,p.seed+4);
  const startX=w*(p.originX+(random(key,p.seed+5)-.5)*p.spread*.68);
  const startY=h*(p.originY+(random(key,p.seed+6)-.5)*p.spread*.64);
  const radialSpeed=dimension*(.28+.82*ejection);
  const vx=Math.cos(angle)*radialSpeed+
    Math.cos(p.wind)*dimension*(.07+.22*p.spread);
  const vy=Math.sin(angle)*radialSpeed+
    Math.sin(p.wind)*dimension*(.07+.22*p.spread)-dimension*.24;
  const gravity=dimension*(.36+2.5*p.gravity);
  const phase=random(key,p.seed+7)*Math.PI*2;
  const curl=dimension*.065*p.turbulence*(.35+random(key,p.seed+8));
  const localSeconds=u*lifetime;
  const x=startX+vx*localSeconds+curl*Math.sin(phase+u*8.3)*u;
  const y=startY+vy*localSeconds+.5*gravity*localSeconds*localSeconds+
    curl*.57*Math.sin(phase*1.7+u*12.6)*u;
  // No off-screen wrap, intentionally allows fragments to fall out of frame.
  const radius=Math.max(.6,Math.min(25,dimension*.027*p.scale*
   (.33+1.22*random(key,p.seed+9))));
  const rotation=angle+random(key,p.seed+10)*Math.PI*2+
   localSeconds*(.5+6.5*p.tumble)*(random(key,p.seed+14)>.5?1:-1);
  const flip=phase+localSeconds*(.7+9*p.tumble)*(.45+random(key,p.seed+15));
  const foreshortening=.13+.87*Math.abs(Math.cos(flip));
  const depth=.6+.4*Math.cos(phase*.4+u*1.6);
  const weight=.65+.35*random(key,p.seed+16);
  const glint=Math.max(0,Math.sin(flip*1.7+phase))*
    (.15+.45*random(key,p.seed+17));
  const polygonPoints=polygon(key,p);
  pieces.push({
   id,generation,u,x,y,startX,startY,vx,vy,gravity,
   rotation,foreshortening,radius:radius*depth,
   opacity:opacity*weight,polygon:polygonPoints,
   tint:.60+.53*random(key,p.seed+18),glint,
   facets:2+Math.floor(random(key,p.seed+19)*3)
  });
 }
 return {width:w,height:h,seconds:t,params:p,pieces};
}
function trace(ctx,vertices,radius){
 ctx.beginPath();
 ctx.moveTo(vertices[0].x*radius,vertices[0].y*radius);
 for(let j=1;j<vertices.length;j++)ctx.lineTo(vertices[j].x*radius,vertices[j].y*radius);
 ctx.closePath();
}
/** Draw physically varied faceted fragments with source footage still visible. */
export function renderFlyingDebris(ctx,width,height,effect={},seconds=0,strength=1){
 const a=clamp(strength,0,1,1);if(a<=0)return true;
 const state=buildFlyingDebrisFrame(width,height,effect,seconds),baseAlpha=Number.isFinite(ctx.globalAlpha)?ctx.globalAlpha:1;
 const base=state.params.color;
 ctx.save();
 try{
  ctx.globalCompositeOperation='source-over';
  for(const piece of state.pieces){
   if(piece.x<-30||piece.x>width+30||piece.y<-30||piece.y>height+30)continue;
   const alpha=clamp(baseAlpha*a*piece.opacity,0,1);
   if(alpha<.015)continue;
   ctx.save();
   try{
    ctx.translate(piece.x,piece.y);
    ctx.rotate(piece.rotation);
    ctx.scale(1,piece.foreshortening);
    ctx.globalAlpha=alpha;
    ctx.fillStyle=rgb(base,piece.tint*.77);
    trace(ctx,piece.polygon,piece.radius);ctx.fill();
    // Inner shard planes share real polygon vertices, never rectangular quads.
    const p=piece.polygon;
    for(let facet=0;facet<piece.facets;facet++){
     const i=(facet*2)%p.length,j=(i+1)%p.length;
     ctx.beginPath();ctx.moveTo(0,0);
     ctx.lineTo(p[i].x*piece.radius,p[i].y*piece.radius);
     ctx.lineTo(p[j].x*piece.radius,p[j].y*piece.radius);
     ctx.closePath();
     const shade=facet%2===0?piece.tint*1.16:piece.tint*.63;
     ctx.fillStyle=rgb(base,shade);ctx.fill();
    }
    ctx.strokeStyle=rgb(base,piece.tint*(1.15+piece.glint));
    ctx.lineWidth=Math.max(.32,piece.radius*.085);
    trace(ctx,p,piece.radius);ctx.stroke();
    if(piece.glint>.25){
     ctx.globalAlpha=alpha*piece.glint;
     ctx.strokeStyle='#eef5f8';
     ctx.lineWidth=Math.max(.35,piece.radius*.13);
     ctx.beginPath();
     ctx.moveTo(p[0].x*piece.radius,p[0].y*piece.radius);
     ctx.lineTo(p[1].x*piece.radius,p[1].y*piece.radius);
     ctx.stroke();
    }
   }finally{ctx.restore();}
  }
 }finally{ctx.restore();}
 return true;
}
