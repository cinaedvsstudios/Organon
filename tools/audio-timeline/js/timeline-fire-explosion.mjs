/**
 * MotoriClip #66 visual-quality unit — Fire Explosion.
 *
 * Replaces the old symmetric radial-gradient circle plus evenly spaced lines
 * with independent rolling fireball lobes, noncircular expanding shock crown,
 * directional hot ejecta and cooler turbulent smoke. No bitmap, timer,
 * accumulated particle state or shared global RNG: absolute clip-local time,
 * seeded settings and canvas dimensions reproduce identical frames on rewind.
 */
const clamp=(v,min,max,fallback=min)=>{
 const n=Number(v);return Math.min(max,Math.max(min,Number.isFinite(n)?n:fallback));
};
const fract=n=>((n%1)+1)%1;
function rand(a,b=0){
 let n=(Math.imul((a|0)+181,0x9e3779b1)^Math.imul((b|0)+47,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
}
const hexRgb=v=>{
 const str=/^#[0-9a-f]{6}$/i.test(String(v))?String(v):'#ffd98d';
 return [1,3,5].map(i=>parseInt(str.slice(i,i+2),16));
};
const rgba=(c,alpha)=>'rgba('+c.join(',')+','+clamp(alpha,0,1,0).toFixed(4)+')';
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v*(1-t)+b[i]*t));
const smooth=x=>{const v=clamp(x,0,1,0);return v*v*(3-2*v);};
function settings(e={}){
 return {
  strength:clamp(e.intensity,0,100,77)/100,
  density:clamp(e.density,1,120,62),
  size:clamp(e.scale,10,300,100)/100,
  wind:clamp(e.direction,-180,180,0)*Math.PI/180,
  turbulence:clamp(e.distortion,0,100,68)/100,
  glow:clamp(e.glow,0,100,78)/100,
  shock:clamp(e.explosionShock,0,100,83)/100,
  smoke:clamp(e.explosionSmoke,0,100,53)/100,
  ejecta:clamp(e.explosionEjecta,0,100,84)/100,
  life:clamp(e.explosionLife,1.2,6,3.2),
  seed:Math.round(clamp(e.explosionSeed,0,99999,6868)),
  centerX:clamp(e.originX,0,100,50)/100,
  centerY:clamp(e.originY,0,100,50)/100,
  hotColor:hexRgb(e.color)
 };
}
/**
 * Image-space explosion physics. Growing hot lobes and cooling smoke carry
 * unique launch velocities/curves. The shock front varies angularly and
 * contains missing arcs rather than a solid circular gradient border.
 */
export function buildFireExplosionFrame(width,height,effect={},seconds=0){
 const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
 const p=settings(effect),t=Math.max(0,Number(seconds)||0);
 const generation=Math.floor(t/p.life),age=fract(t/p.life);
 const D=Math.min(w,h),cx=w*p.centerX,cy=h*p.centerY;
 const windX=Math.cos(p.wind)*D*.12,windY=Math.sin(p.wind)*D*.10;
 const size=D*p.size;
 const radius=size*(.055+.60*smooth(Math.min(1,age*1.25)));
 const pulse=Math.pow(1-age,1.05)*smooth(age/.035);
 const coreIntensity=(1-smooth((age-.10)/.35))*p.strength;
 const count=10+Math.round(p.density*.24);
 const lobes=[],smoke=[],ejecta=[];
 for(let i=0;i<count;i++){
  const k=(generation*4099+i*113+p.seed*7)|0;
  const theta=rand(k,p.seed+1)*Math.PI*2;
  const toward=.32+.69*rand(k,p.seed+2);
  const drift=age*(.25+.75*rand(k,p.seed+3));
  const curl=Math.sin(age*(4+3*rand(k,p.seed+4))+theta*2.7)*p.turbulence*.14*radius;
  const x=cx+Math.cos(theta)*radius*toward+windX*age+curl;
  const y=cy+Math.sin(theta)*radius*toward+windY*age-age*age*size*.19+
   Math.sin(theta+age*9)*p.turbulence*.035*size;
  const r=Math.max(2,size*(.04+.16*rand(k,p.seed+5))*(.52+.67*age));
  const phase=rand(k,p.seed+6);
  const heat=Math.max(0,1-smooth((age-.14-.12*phase)/(.40+.16*phase)));
  const weight=.45+.55*rand(k,p.seed+7);
  const hot=heat*weight*pulse;
  lobes.push({x,y,r,hot,seed:k,angle:theta,phase,
   highlight:rand(k,p.seed+8),alpha:hot});
  const smokeDelay=.12+.14*rand(k,p.seed+9);
  const smokeAge=Math.max(0,age-smokeDelay);
  const smokeAlpha=p.smoke*smooth(smokeAge/.14)*Math.pow(1-age,.57)*
   (.25+.55*rand(k,p.seed+10));
  const smokeX=cx+Math.cos(theta)*radius*(.45+.54*toward)+windX*age*1.6+
   curl*2+Math.sin(phase*9+age*4)*p.turbulence*size*.06;
  const smokeY=cy+Math.sin(theta)*radius*(.45+.54*toward)+windY*age-
   age*age*size*(.18+.12*phase);
  smoke.push({x:smokeX,y:smokeY,r:r*(1.35+age*1.4),alpha:smokeAlpha,
   shade:Math.round(24+rand(k,p.seed+11)*33)});
 }
 const sparks=Math.round((18+p.density*.65)*p.ejecta);
 for(let i=0;i<sparks;i++){
  const k=(i*157+generation*5099+p.seed*13)|0;
  const theta=rand(k,p.seed+20)*Math.PI*2;
  const speed=size*(.36+1.1*rand(k,p.seed+21));
  const lifetime=.38+.50*rand(k,p.seed+22);
  const travel=clamp(age/lifetime,0,1,0);
  if(age>=lifetime)continue;
  const vx=Math.cos(theta)*speed,vy=Math.sin(theta)*speed;
  const jitter=.035*p.turbulence*size*Math.sin(age*16+theta*5);
  const x=cx+vx*age+windX*age*.85+jitter;
  const y=cy+vy*age+.5*size*.62*age*age-size*.10*age+jitter*.5;
  const dx=vx*size*.00033,dy=vy*size*.00033+size*.014*age;
  const alpha=Math.pow(1-travel,.78)*p.ejecta*(.5+.5*rand(k,p.seed+23));
  ejecta.push({x,y,dx,dy,alpha,
   r:Math.max(.55,(.4+2.3*rand(k,p.seed+24))*p.size),
   heat:1-smooth((travel-.25)/.6),seed:k});
 }
 const shock=[];
 const sections=94;
 for(let i=0;i<=sections;i++){
  const angle=Math.PI*2*i/sections;
  const warp=Math.sin(angle*5.7+generation)*.16+
   Math.sin(angle*11.3+generation*2)*.08+
   (rand(i+generation*301,p.seed+50)-.5)*.22*p.turbulence;
  const bump=1+warp*p.turbulence;
  const rr=radius*(.92+.14*p.shock)*bump;
  shock.push({x:cx+Math.cos(angle)*rr+windX*age*.5,
   y:cy+Math.sin(angle)*rr+windY*age*.5,
   visible:rand(Math.floor(i/3)+generation*307,p.seed+51)>.22});
 }
 return {width:w,height:h,time:t,age,generation,params:p,center:{x:cx,y:cy},
  radius,pulse,coreIntensity,lobes,smoke,ejecta,shock,
  shockAlpha:p.shock*pulse*smooth(age/.12)*(1-smooth((age-.30)/.46))};
}
function glow(ctx,x,y,r,colours,alpha){
 if(alpha<=.001||r<=0)return;
 const g=ctx.createRadialGradient(x,y,0,x,y,r);
 for(const [stop,color,a] of colours)g.addColorStop(stop,rgba(color,alpha*a));
 ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
}
/** One transparent paint path used identically in playback and fixed MP4 export. */
export function renderFireExplosion(ctx,width,height,effect={},seconds=0,strength=1){
 const amount=clamp(strength,0,1,1);if(amount===0)return true;
 const st=buildFireExplosionFrame(width,height,effect,seconds),p=st.params;
 if(!st.pulse&&!st.smoke.some(x=>x.alpha>.001))return true;
 const baseAlpha=Number.isFinite(ctx.globalAlpha)?ctx.globalAlpha:1;
 const alpha=amount*baseAlpha;
 const warm=p.hotColor,orange=[255,102,26],red=[162,31,16],gold=[255,212,104];
 ctx.save();
 try{
  // Cool airborne smoke sits behind the incandescent expanding fireball.
  ctx.globalCompositeOperation='source-over';
  for(const m of st.smoke){
   if(m.alpha<.004)continue;
   const gray=[m.shade,m.shade+4,m.shade+9];
   glow(ctx,m.x,m.y,m.r*1.52,
    [[0,gray,.40],[.45,gray,.19],[1,gray,0]],m.alpha*alpha*.78);
  }
  ctx.globalCompositeOperation='screen';
  for(const l of st.lobes){
   if(l.hot<.002)continue;
   const flicker=.72+.28*Math.sin(st.time*11+l.phase*20);
   glow(ctx,l.x,l.y,l.r*(1.45+p.glow*.85),
    [[0,mix(gold,warm,.30),.72],[.17,orange,.57],
     [.46,red,.21],[1,red,0]],alpha*l.hot*flicker);
   glow(ctx,l.x,l.y,l.r*(.62+p.glow*.22),
    [[0,mix([255,254,228],warm,.12),.86],
     [.43,gold,.62],[1,orange,0]],alpha*l.hot*(.3+.7*l.highlight));
  }
  // A core flash only at ignition, never an opaque static radial disk.
  if(st.coreIntensity>.001){
   const coreR=Math.max(2,st.radius*.42);
   glow(ctx,st.center.x,st.center.y,coreR*(1.4+p.glow*.5),
    [[0,[255,255,246],.92],[.15,warm,.83],
     [.43,orange,.32],[1,red,0]],st.coreIntensity*alpha);
  }
  // Shock crown irregularly breaks into segments and loses energy with time.
  if(st.shockAlpha>.001){
   ctx.save();
   ctx.strokeStyle=rgba(mix(gold,warm,.32),st.shockAlpha*.55*alpha);
   ctx.lineWidth=Math.max(.7,st.radius*(.012+.013*p.shock));
   ctx.lineCap='round';ctx.lineJoin='round';
   ctx.beginPath();
   let drawing=false;
   for(const node of st.shock){
    if(!node.visible){drawing=false;continue;}
    if(!drawing){ctx.moveTo(node.x,node.y);drawing=true;}
    else ctx.lineTo(node.x,node.y);
   }
   ctx.stroke();ctx.restore();
  }
  for(const e of st.ejecta){
   if(e.alpha<.01)continue;
   ctx.save();
   ctx.lineCap='round';ctx.strokeStyle=e.heat>.4?rgba(warm,e.alpha*alpha):rgba(red,e.alpha*alpha*.76);
   ctx.lineWidth=Math.max(.45,e.r*.82);
   ctx.beginPath();
   ctx.moveTo(e.x-e.dx*3,e.y-e.dy*3);ctx.lineTo(e.x,e.y);ctx.stroke();
   if(e.heat>.24&&p.glow>0){
    glow(ctx,e.x,e.y,e.r*(2+3*p.glow),
     [[0,gold,.43],[.45,orange,.23],[1,red,0]],e.alpha*alpha*p.glow);
   }
   ctx.restore();
  }
 }finally{ctx.restore();}
 return true;
}
