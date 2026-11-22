/**
 * MotoriClip #47 — Pixel Scan: independently regenerating digital pixels.
 *
 * Each group has its own temporal cycle, lifetime, scan drift, displacement,
 * flicker, dropout, local RGB details and pulse. Nothing translates a still
 * pixel strip; every frame is regenerated from absolute clip-relative time.
 * This pure seeded geometry is shared by live preview and offline exports.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a));
const fract=x=>x-Math.floor(x);
function hash(a,b=0){
 let n=(Math.imul((Math.trunc(a)+1)>>>0,0x9e3779b1)^Math.imul((Math.trunc(b)+7)>>>0,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;n^=n>>>15;
 n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return n/4294967296;
}
const palette=['primary','#4ae9ff','#fa68c5','#fff6c4'];
const primary=e=>/^#[a-f\d]{6}$/i.test(String(e?.color))?String(e.color).toLowerCase():'#ffd98d';
const motion=(t,i)=>t*(.12+.31*hash(i,11))+hash(i,17);
const norm01=x=>fract(fract(x)+1);

/** Pure, serializable model. A fixed time/seed always returns identical cells. */
export function buildPixelScanFrame(w,h,effect={},time=0){
 const width=Math.max(1,Number(w)||1),height=Math.max(1,Number(h)||1);
 const t=Math.max(0,Number(time)||0);
 const density=Math.round(clamp(effect.density??48,1,120));
 const scale=clamp(effect.scale??100,10,300)/100;
 const distortion=clamp(effect.distortion??55,0,100)/100;
 const glow=clamp(effect.glow??64,0,100)/100;
 const originX=clamp(effect.originX??20,0,100)/100;
 const originY=clamp(effect.originY??12,0,100)/100;
 const angle=(clamp(effect.direction??0,-180,180)+90)*Math.PI/180;
 const pixel=Math.max(1,Math.min(16,Math.min(width,height)*.014*scale));
 const elements=[],color=primary(effect);
 for(let i=0;i<density;i++){
  const age=motion(t,i),life=fract(age),generation=Math.floor(age);
  // Newly regenerated groups choose a new position every lifetime, but
  // neighboring groups never share velocity, age or random dropout frames.
  const initialX=norm01(originX*.22+hash(i*127+generation*71,5)*.78);
  const initialY=norm01(originY*.22+hash(i*71+generation*31,6)*.78);
  const travel=.09+.33*hash(i,23);
  const moveX=Math.cos(angle)*(life-.5)*travel*width;
  const moveY=Math.sin(angle)*(life-.5)*travel*height;
  const tick=Math.floor(t*(9+14*hash(i,32))+hash(i,29)*17);
  const flicker=hash(i*101+tick*17,57);
  const dropout=flicker<(.09+.19*distortion);
  const jitterX=(hash(i*77+tick*23,10)-.5)*pixel*(.8+9*distortion);
  const jitterY=(hash(i*117+tick*41,12)-.5)*pixel*(.5+6*distortion);
  const x=norm01(initialX+(moveX+jitterX)/width)*width;
  const y=norm01(initialY+(moveY+jitterY)/height)*height;
  const pulse=Math.pow(Math.max(0,Math.sin(t*(4+5*hash(i,38))+hash(i,9)*Math.PI*2)),6);
  const fade=Math.pow(1-life,1.05);
  const alpha=dropout?0:clamp(fade*(.34+.48*flicker+.66*pulse),0,1);
  const tiles=[];
  const count=3+Math.floor(hash(i,49)*6);
  for(let j=0;j<count;j++){
   const tileTick=Math.floor(t*(6+13*hash(j+i*13,37))+hash(i+j,25)*11);
   const spark=hash(i*311+j*47+tileTick*29,19);
   if(spark<(.11+.14*distortion))continue; // Independent internal dropout.
   const dx=(hash(i*71+j*23,40)-.5)*pixel*8;
   const dy=(hash(i*113+j*19,41)-.5)*pixel*5;
   const glitch=(hash(i*37+j*67+tileTick*13,51)-.5)*pixel*9*distortion;
   tiles.push({
    x:x+dx+glitch,y:y+dy,
    width:pixel*(.7+1.9*hash(i+j,52)),
    height:pixel*(.55+1.45*hash(i*17+j,53)),
    alpha:alpha*(.38+.62*spark),
    color:palette[(i+j+Math.floor(hash(i,j)*3))%palette.length]==='primary'?
      color:palette[(i+j+Math.floor(hash(i,j)*3))%palette.length]
   });
  }
  // Brief bright scan pulses happen on each group, independently.
  elements.push({id:i,x,y,life,generation,tick,dropout,alpha,pulse,
   radius:pixel*(2+glow*5+2*pulse),tiles});
 }
 return elements;
}

/** Paint the computed groups; never use wall-clock, random() or frame count. */
export function renderPixelScan(ctx,w,h,e={},clipCycle=0,strength=1){
 const groups=buildPixelScanFrame(w,h,e,clipCycle);
 const exposure=clamp(strength,0,1),glow=clamp(e.glow??64,0,100)/100;
 const opacity=Number.isFinite(ctx.globalAlpha)?ctx.globalAlpha:1;
 ctx.save();
 try{
  ctx.globalCompositeOperation='screen';
  for(const group of groups){
   if(!group.alpha)continue;
   if(glow>0){
    const radial=ctx.createRadialGradient(group.x,group.y,0,group.x,group.y,group.radius);
    radial.addColorStop(0,'rgba(101,243,255,'+(group.alpha*(.27+.5*glow)).toFixed(4)+')');
    radial.addColorStop(.4,'rgba(255,139,218,'+(group.alpha*.12*glow).toFixed(4)+')');
    radial.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha=opacity*exposure;
    ctx.fillStyle=radial;
    ctx.fillRect(group.x-group.radius,group.y-group.radius,group.radius*2,group.radius*2);
   }
   for(const tile of group.tiles){
    ctx.globalAlpha=opacity*exposure*tile.alpha;
    ctx.fillStyle=tile.color;
    ctx.fillRect(tile.x,tile.y,tile.width,tile.height);
   }
   if(group.pulse>.78){
    ctx.globalAlpha=opacity*exposure*group.alpha*.72;
    ctx.strokeStyle='#e9ffff';
    ctx.lineWidth=Math.max(1,Math.min(w,h)*.002);
    ctx.beginPath();
    ctx.moveTo(group.x-group.radius*.6,group.y);
    ctx.lineTo(group.x+group.radius*.6,group.y);
    ctx.stroke();
   }
  }
 }finally{ctx.restore();}
 return true;
}