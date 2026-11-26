/** Representative effect thumbnails: genuine recipe painter, one bounded hover loop.
 * No remote media, timers per card, or animation when the tab/panel is hidden.
 */
import {paintTimelineEffect,paintEffectPreviewScene} from './timeline-effects.mjs';
const POSTER_TIME=Object.freeze({'light-sweep':1.3,'data-burst':.48,'signal-tear':.65,'rgb-block-glitch':.65,'line-corruption':.65,'fire-explosion':.65,'shockwave':.55,'vibration-flash':.4,'pixel-scan':.85});
export function effectPosterTime(id){return POSTER_TIME[id]??1.1;}
export function paintEffectThumbnail(canvas,id,seconds=effectPosterTime(id)){
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height;
 ctx.save();try{
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.shadowBlur=0;
  ctx.clearRect(0,0,w,h);
  paintEffectPreviewScene(ctx,w,h);
  // Extra registration detail: fine alternating grid and bright/dark edges
  // provide recognizable source geometry for tears, blur, refraction and RGB breakup.
  const tile=Math.max(2,Math.round(h/20));
  for(let y=0;y<4;y++)for(let x=0;x<8;x++){
   ctx.fillStyle=(x+y)%2?'#172339':'#e5e7eb';
   ctx.fillRect(w*.46+x*tile,h*.46+y*tile,tile,tile);
  }
  ctx.fillStyle='#e5e7eb';ctx.font='bold '+Math.round(h*.12)+'px monospace';ctx.textAlign='left';
  ctx.fillText('FX',w*.10,h*.82);
  paintTimelineEffect(ctx,w,h,{presetId:id},seconds,3);
 }finally{ctx.restore();}
 canvas.dataset.effectPreviewSeconds=String(seconds);
}
export function createEffectThumbnailHover({fps=10,document:doc=globalThis.document,window:win=globalThis.window}={}){
 let active=null,frame=0,last=0,start=0;
 const interval=1000/fps,reduce=win.matchMedia('(prefers-reduced-motion: reduce)'),fine=win.matchMedia('(hover: hover) and (pointer: fine)');
 function stop({restore=true}={}){
  if(frame)win.cancelAnimationFrame(frame);frame=0;
  const old=active;active=null;
  if(old){delete old.card.dataset.effectHoverActive;if(restore&&old.card.isConnected)paintEffectThumbnail(old.canvas,old.id);}
 }
 function tick(now){
  if(!active)return;
  const {card,canvas,id}=active;
  if(doc.hidden||!card.isConnected||card.hidden||!card.getClientRects().length||reduce.matches||!fine.matches){stop({restore:false});return;}
  if(!start)start=now;
  if(!last||now-last>=interval){last=now;paintEffectThumbnail(canvas,id,((now-start)/1000)%3);}
  frame=win.requestAnimationFrame(tick);
 }
 function bind(card,canvas,id){
  card.addEventListener('pointerenter',event=>{
   if(event.pointerType!=='mouse'||reduce.matches||!fine.matches||doc.hidden)return;
   stop();active={card,canvas,id};start=0;last=0;card.dataset.effectHoverActive='true';frame=win.requestAnimationFrame(tick);
  });
  for(const event of ['pointerleave','pointerdown','dragstart','blur'])card.addEventListener(event,()=>{if(active?.card===card)stop();});
 }
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden)stop({restore:false});});
 win.addEventListener('blur',()=>stop({restore:false}));
 return {bind,stop};
}
