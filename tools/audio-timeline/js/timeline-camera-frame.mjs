/**
 * MotoriClip #57: transparent camcorder frame HUD.
 *
 * Only draws the readout lines, text and indicators. No source capture, fills,
 * frame clearing, wall-clock time or counter-based animation. All animations
 * are derived from the absolute clip-relative seconds passed by the engine.
 */
const clamp=(value,min,max,fallback)=>{
 const n=Number(value);
 return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
const colour=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value))?String(value).toLowerCase():fallback;
const enabled=(value)=>value!==false&&value!=='false'&&value!==0&&value!=='0';
const pad=(number,width=2)=>String(Math.floor(number)).padStart(width,'0');

export function cameraFrameGeometry(width,height,effect={},seconds=0){
 const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
 const elapsed=Math.max(0,Number(seconds)||0);
 const size=clamp(effect.hudScale??100,60,150,100)/100;
 const fps=Math.round(clamp(effect.frameRate??30,24,60,30));
 const timecodeSeconds=elapsed+clamp(effect.timecodeOffset??0,0,3600,0);
 const wholeFrames=Math.floor(timecodeSeconds*fps+1e-7);
 const frame=wholeFrames%fps;
 const fullSeconds=Math.floor(wholeFrames/fps);
 const timecode=[pad(Math.floor(fullSeconds/3600)),pad(Math.floor(fullSeconds/60)%60),
  pad(fullSeconds%60),pad(frame)].join(':');
 const blinkTick=Math.floor(elapsed*clamp(effect.speed??1,.1,8,1)*2);
 const jitter=clamp(effect.jitter??0,0,100,0)/100;
 const dx=Math.sin(elapsed*17.13)*Math.cos(elapsed*4.71)*w*.009*jitter;
 const dy=Math.sin(elapsed*14.63+.6)*Math.cos(elapsed*5.23)*h*.009*jitter;
 const margin=Math.max(5,Math.min(w,h)*.075);
 const unit=Math.max(.5,Math.min(w,h)/180)*size;
 return {w,h,elapsed,size,unit,margin,dx,dy,
  colour:colour(effect.color,'#f0f6ff'),
  recColour:colour(effect.recColor,'#ff364c'),
  opacity:clamp(effect.intensity??85,0,100,85)/100,
  batteryLevel:Math.round(clamp(effect.batteryLevel??78,0,100,78)),
  timecode,blinkOn:blinkTick%2===0,
  showRec:enabled(effect.showRec),showTimecode:enabled(effect.showTimecode),
  showBattery:enabled(effect.showBattery),showCorners:enabled(effect.showCorners),
  showReticle:enabled(effect.showReticle)};
}

export function renderCameraFrame(ctx,width,height,effect={},seconds=0,amount){
 const g=cameraFrameGeometry(width,height,effect,seconds);
 const opacity=clamp(amount===undefined?g.opacity:amount,0,1,0);
 if(opacity<=0)return true;
 const {w,h,unit,margin}=g;
 const x=margin,y=margin,x2=w-margin,y2=h-margin;
 const stroke=(points)=>{
  ctx.beginPath();ctx.moveTo(points[0],points[1]);
  for(let i=2;i<points.length;i+=2)ctx.lineTo(points[i],points[i+1]);
  ctx.stroke();
 };
 ctx.save();
 try{
  const base=Number(ctx.globalAlpha);
  ctx.globalAlpha=(Number.isFinite(base)?base:1)*opacity;
  ctx.globalCompositeOperation='source-over';
  ctx.translate(g.dx,g.dy);
  ctx.strokeStyle=g.colour;ctx.fillStyle=g.colour;
  ctx.lineWidth=Math.max(1,1.65*unit);
  ctx.lineCap='square';ctx.lineJoin='miter';
  ctx.shadowColor='rgba(0,0,0,0.78)';
  ctx.shadowBlur=2.5*unit;
  const corner=Math.min(w,h)*.105*g.size;
  if(g.showCorners){
   stroke([x,y+corner,x,y,x+corner,y]);
   stroke([x2-corner,y,x2,y,x2,y+corner]);
   stroke([x,y2-corner,x,y2,x+corner,y2]);
   stroke([x2-corner,y2,x2,y2,x2,y2-corner]);
  }
  const fontSize=Math.max(8,Math.min(w,h)*.069*g.size);
  ctx.font='600 '+fontSize.toFixed(2)+'px "Geist Mono", monospace';
  ctx.textBaseline='middle';
  if(g.showRec){
   const top=y+fontSize*.65,circleX=x+fontSize*.55;
   if(g.blinkOn){
    ctx.save();ctx.shadowColor=g.recColour;ctx.shadowBlur=5*unit;
    ctx.fillStyle=g.recColour;ctx.beginPath();
    ctx.arc(circleX,top,fontSize*.32,0,Math.PI*2);ctx.fill();
    ctx.restore();
   }
   ctx.fillStyle=g.colour;ctx.fillText('REC',x+fontSize*1.2,top);
  }
  if(g.showBattery){
   const bw=fontSize*2.65,bh=fontSize*1.07,rx=x2-bw-fontSize*.25,ry=y+fontSize*.23;
   ctx.strokeRect(rx,ry,bw,bh);
   ctx.fillRect(rx+bw,ry+bh*.34,fontSize*.22,bh*.32);
   const gap=Math.max(.8,unit*.65),padding=bh*.16;
   const active=Math.ceil(g.batteryLevel/25);
   const segment=(bw-padding*2-gap*3)/4;
   for(let i=0;i<active;i++){
    ctx.fillRect(rx+padding+i*(segment+gap),ry+padding,segment,bh-2*padding);
   }
   ctx.font='500 '+(fontSize*.63).toFixed(2)+'px "Geist Mono", monospace';
   ctx.textAlign='right';ctx.fillText(g.batteryLevel+'%',x2,ry+bh+fontSize*.52);
   ctx.textAlign='left';
  }
  if(g.showReticle){
   const cx=w*.5,cy=h*.5,r=Math.min(w,h)*.055*g.size;
   ctx.lineWidth=Math.max(1,1.18*unit);
   ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
   const gap=r*1.35,outer=r*2.18;
   stroke([cx-outer,cy,cx-gap,cy]);
   stroke([cx+gap,cy,cx+outer,cy]);
   stroke([cx,cy-outer,cx,cy-gap]);
   stroke([cx,cy+gap,cx,cy+outer]);
   ctx.fillRect(cx-unit*.75,cy-unit*.75,unit*1.5,unit*1.5);
  }
  if(g.showTimecode){
   ctx.font='600 '+(fontSize*.83).toFixed(2)+'px "Geist Mono", monospace';
   ctx.textBaseline='alphabetic';
   ctx.fillText('TC '+g.timecode,x+fontSize*.45,y2-fontSize*.45);
  }
 }finally{ctx.restore();}
 return true;
}
