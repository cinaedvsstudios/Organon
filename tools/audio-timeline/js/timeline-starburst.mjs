/**
 * MotoriClip #56 — procedural rotating SUNBURST / Starburst.
 *
 * Full-frame yellow/white alternating radial spokes rendered as vector sectors
 * on EVERY clip-relative timeline frame. Never a pre-rotated bitmap.
 * Preserves two independently editable colours, ray count/thickness, centre,
 * angle, clockwise/counterclockwise spin, speed, opacity and radial glow.
 */
const TAU=Math.PI*2;
const limit=(v,a,b,fallback=a)=>{
 const n=Number(v);return Number.isFinite(n)?Math.max(a,Math.min(b,n)):fallback;
};
const hex=(value,otherwise)=>/^#[0-9a-f]{6}$/i.test(String(value))?String(value).toLowerCase():otherwise;
export function starburstGeometry(width,height,effect={},cycle=0){
 const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
 const count=Math.round(limit(effect.rayCount??18,4,64,18));
 const thickness=limit(effect.rayThickness??54,10,90,54)/100;
 const spinDirection=Number(effect.spinDirection)===-1?-1:1;
 const angleOffset=limit(effect.direction??0,-180,180,0)*Math.PI/180;
 const phase=Math.max(0,Number(cycle)||0);
 const rotation=angleOffset+spinDirection*phase*.62;
 const cx=w*limit(effect.originX??50,0,100,50)/100;
 const cy=h*limit(effect.originY??50,0,100,50)/100;
 const radius=Math.hypot(w,h)*2.05;
 const period=TAU/count;
 const primary=hex(effect.color,'#ffdf00'),secondary=hex(effect.secondaryColor,'#ffffff');
 const rays=[];
 for(let i=0;i<count;i++){
  const begin=rotation-TAU*.25+i*period,end=begin+period*thickness,finish=begin+period;
  rays.push({index:i*2,start:begin,end,color:primary,kind:'primary'});
  rays.push({index:i*2+1,start:end,end:finish,color:secondary,kind:'secondary'});
 }
 return {width:w,height:h,cx,cy,radius,rotation,rayCount:count,
  rayThickness:thickness,spinDirection,primary,secondary,
  alpha:limit(effect.intensity??70,0,100,70)/100,
  glow:limit(effect.glow??64,0,100,64)/100,rays};
}
/**
 * Deterministic native Canvas2D painter. Browser Canvas anti-aliases the
 * sector edges, preserves underlying footage through explicit alpha and
 * creates a small controllable overexposed centre.
 */
export function renderStarburst(ctx,width,height,effect={},cycle=0,amount){
 const o=starburstGeometry(width,height,effect,cycle);
 const opacity=limit(amount===undefined?o.alpha:amount,0,1,0);
 if(opacity<=0)return true;
 ctx.save();
 try{
  const base=Number(ctx.globalAlpha);
  ctx.globalAlpha=(Number.isFinite(base)?base:1)*opacity;
  ctx.globalCompositeOperation='source-over';
  // Consecutive sectors cover the entire canvas, including corners when
  // the centre is dragged to any of the four extreme edges.
  const seam=Math.PI*.00012;
  for(const ray of o.rays){
   ctx.beginPath();
   ctx.moveTo(o.cx,o.cy);
   ctx.arc(o.cx,o.cy,o.radius,ray.start-seam,ray.end+seam);
   ctx.closePath();
   ctx.fillStyle=ray.color;
   ctx.fill();
  }
  if(o.glow>.001){
   ctx.globalCompositeOperation='screen';
   ctx.globalAlpha=(Number.isFinite(base)?base:1)*opacity;
   const radius=Math.min(width,height)*(.13+.25*o.glow);
   const grad=ctx.createRadialGradient(o.cx,o.cy,0,o.cx,o.cy,radius);
   grad.addColorStop(0,'rgba(255,255,245,'+(o.glow*.68).toFixed(4)+')');
   grad.addColorStop(.24,'rgba(255,250,203,'+(o.glow*.29).toFixed(4)+')');
   grad.addColorStop(1,'rgba(255,255,245,0)');
   ctx.fillStyle=grad;ctx.beginPath();ctx.arc(o.cx,o.cy,radius,0,TAU);ctx.fill();
  }
 }finally{ctx.restore();}
 return true;
}
