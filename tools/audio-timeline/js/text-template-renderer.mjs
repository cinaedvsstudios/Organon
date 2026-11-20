/**
 * MotoriClip dynamic, editable title compositions.
 * Designs have different layouts and type treatments; colours and outline
 * strength are Inspector parameters, not duplicate library templates.
 * Every animation uses clip-relative time (no wall clocks or random state).
 */
export const TEXT_DESIGNS=Object.freeze([
 {id:'neon-cyan',label:'Neon Sign',layout:'neon',animation:'neon-flicker',fill:'#64eeff',stroke:'#216aca',font:'sans'},
 {id:'chrome-title',label:'Chrome Title',layout:'chrome',animation:'fade',fill:'#eaf0f8',stroke:'#527494',font:'sans'},
 {id:'handwritten-script',label:'Handwritten',layout:'handwriting',animation:'handwriting-reveal',fill:'#fff5d4',stroke:'#815d8c',font:'script'},
 {id:'cinematic-title',label:'Cinematic',layout:'cinematic',animation:'fade',fill:'#fff8ec',stroke:'#d2ad63',font:'serif'},
 {id:'news-lower-third',label:'News Lower Third',layout:'news',animation:'box-reveal',fill:'#ffffff',stroke:'#e0a360',font:'sans'},
 {id:'location-card',label:'Location Card',layout:'location',animation:'location-drop',fill:'#ffffff',stroke:'#54d5ff',font:'sans'},
 {id:'editorial-quote',label:'Editorial Quote',layout:'quote',animation:'fade',fill:'#f6ecdc',stroke:'#d3b47c',font:'serif'},
 {id:'comic-sticker',label:'Comic Sticker',layout:'comic',animation:'letter-pop',fill:'#fff968',stroke:'#191429',font:'sans'},
 {id:'social-callout',label:'Social Callout',layout:'social',animation:'social-pulse',fill:'#ffffff',stroke:'#ff447b',font:'sans'},
 {id:'chapter-ending',label:'Chapter / Ending',layout:'chapter',animation:'fade',fill:'#f5e6c8',stroke:'#ab8652',font:'serif'},
 {id:'tech-hud',label:'Technology HUD',layout:'hud',animation:'typewriter',fill:'#8cffee',stroke:'#168882',font:'mono'},
 {id:'event-announcement',label:'Event Announcement',layout:'event',animation:'slide',fill:'#ffffff',stroke:'#ff8651',font:'sans'},
 {id:'speech-bubble',label:'Speech Bubble',layout:'speech',animation:'letter-pop',fill:'#18232b',stroke:'#faf5e9',font:'sans'},
 {id:'typewriter-document',label:'Typewriter',layout:'typewriter',animation:'typewriter',fill:'#f7efdb',stroke:'#c3a888',font:'mono'},
 {id:'retro-stamp',label:'Retro Stamp',layout:'stamp',animation:'shake',fill:'#f1dbac',stroke:'#b84936',font:'sans'},
 {id:'stacked-headline',label:'Stacked Headline',layout:'stacked',animation:'box-reveal',fill:'#fff7ec',stroke:'#e08343',font:'sans'},
 {id:'countdown-title',label:'Countdown / Number Roll',layout:'countdown',animation:'countdown-roll',fill:'#effaf8',stroke:'#55a9cd',font:'mono'},
 {id:'split-title',label:'Split Title',layout:'split',animation:'split-enter',fill:'#fff1dc',stroke:'#c98b55',font:'sans'}
].map(item=>Object.freeze({...item,group:'text'})));
export const TEXT_ANIMATIONS=Object.freeze([
 ['none','Static'],['typewriter','Typewriter'],['letter-pop','Letter Pop'],
 ['shake','Shaking Letters'],['box-reveal','Broadcast Box Reveal'],
 ['neon-flicker','Neon Flicker'],['ticker','Scrolling Ticker'],
 ['slide','Slide In'],['fade','Fade In'],
 ['wave','Floating / Waving Letters'],['kinetic-stagger','Kinetic Stagger'],
 ['bounce','Rubber Bounce'],['outline-fill','Outline to Solid'],
 ['glitch-text','Glitch Letters'],['title-wipe','Title Wipe'],
 ['dissolve-out','Dissolve Out'],['handwriting-reveal','Handwriting Reveal'],
 ['social-pulse','Social Button Pulse'],['location-drop','Location Pin Drop'],
 ['countdown-roll','Rolling Countdown'],['split-enter','Split Title Entrance']
]);
const animationNames=new Set(TEXT_ANIMATIONS.map(pair=>pair[0]));
const defaultPalette={fill:'#ffffff',stroke:'#333333',shadow:'#000000'};
const colour=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():fallback;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const safeNumber=(v,fallback,min,max)=>{
 const n=Number(v);return Number.isFinite(n)?clamp(n,min,max):fallback;
};
export function getTextDesign(id){
 return TEXT_DESIGNS.find(item=>item.id===id)||null;
}
export function normaliseTextOverlay(input={}) {
 const design=getTextDesign(input.presetId)||TEXT_DESIGNS[0];
 return {
  presetId:design.id,
  value:String(input.value??'MotoriClip').slice(0,100),
  fill:colour(input.fill,design.fill||defaultPalette.fill),
  outline:colour(input.outline,design.stroke||defaultPalette.stroke),
  shadow:colour(input.shadow,defaultPalette.shadow),
  fontSize:safeNumber(input.fontSize,100,30,250),
  outlineWidth:safeNumber(input.outlineWidth,3,0,18),
  shadowBlur:safeNumber(input.shadowBlur,8,0,40),
  animation:animationNames.has(input.animation)?input.animation:design.animation,
  animationDuration:safeNumber(input.animationDuration,1.2,.1,10),
  animationDelay:safeNumber(input.animationDelay,0,0,10),
  animationSpeed:safeNumber(input.animationSpeed,1,.25,4),
  animationDirection:['left','right','up','down'].includes(input.animationDirection)
    ?input.animationDirection:'left',
  animationEasing:['linear','ease-in','ease-out','ease-in-out'].includes(input.animationEasing)
    ?input.animationEasing:'ease-out',
  animationIntensity:safeNumber(input.animationIntensity,100,0,200),
  animationLoop:input.animationLoop===true,
  subtitle:String(input.subtitle??'LIVE UPDATE').slice(0,100)
 };
}
function easeProgress(value,easing){
 const p=clamp(value,0,1);
 if(easing==='ease-in')return p*p;
 if(easing==='ease-out')return 1-(1-p)*(1-p);
 if(easing==='ease-in-out')return p*p*(3-2*p);
 return p;
}
export function textAnimationState(config={},localTime=0,clipDuration=3) {
 const opts=normaliseTextOverlay(config);
 const time=Math.max(0,Number(localTime)||0);
 const clip=Math.max(.1,Number(clipDuration)||3);
 const duration=Math.min(opts.animationDuration,clip);
 const elapsed=Math.max(0,time-opts.animationDelay)*opts.animationSpeed;
 const running=opts.animationLoop&&elapsed>=duration?elapsed%duration:elapsed;
 const raw=clamp(running/duration,0,1);
 const progress=easeProgress(raw,opts.animationEasing);
 const started=time>=opts.animationDelay;
 const text=opts.value||'YOUR TEXT';
 const intensity=opts.animationIntensity/100;
 const direction=opts.animationDirection;
 const horizontal=direction==='left'||direction==='right';
 const sign=direction==='right'||direction==='down'?1:-1;
 const distance=(1-progress)**2*220*intensity;
 const slideX=opts.animation==='slide'&&horizontal?(progress>=1?0:Math.round(distance*sign)):0;
 const slideY=opts.animation==='slide'&&!horizontal?(progress>=1?0:Math.round(distance*sign)):0;
 const fadeOut=opts.animation==='dissolve-out'
    ?clamp((clip-time)/Math.min(1.2,clip*.35),0,1):1;
 return {
  progress,raw,time,elapsed:running,started,intensity,
  boxReveal:opts.animation==='box-reveal',
  visibleCharacters:opts.animation==='typewriter'
    ?Math.min(text.length,Math.floor(progress*text.length)):text.length,
  alpha:!started?0:(opts.animation==='fade'?progress:1)*fadeOut,
  slideX,slideY,
  boxWidth:opts.animation==='box-reveal'||opts.animation==='title-wipe'
    ?Math.round(640*progress):640,
  textAlpha:opts.animation==='box-reveal'?clamp((raw-.52)/.48,0,1):1,
  headlineAlpha:opts.animation==='box-reveal'?clamp((raw-.44)/.35,0,1):1,
  subtitleAlpha:opts.animation==='box-reveal'?clamp((raw-.73)/.27,0,1):1,
  tickerX:opts.animation==='ticker'
    ?(direction==='right'?-640+time/clip*1280:640-time/clip*1280):0,
  jitter:opts.animation==='shake'?Math.sin(time*46)*4*intensity:0,
  flicker:opts.animation==='neon-flicker'
    ?(raw<.85 ? (.46+.44*Math.abs(Math.sin(time*36))) :1) :1,
  socialScale:opts.animation==='social-pulse'
    ?(.45+.55*(1-Math.pow(1-progress,3))+Math.sin(time*11)*.035*intensity*clamp((raw-.6)/.4,0,1)):1,
  pinProgress:opts.animation==='location-drop'?clamp(raw/.45,0,1):1,
  locationLabelProgress:opts.animation==='location-drop'?easeProgress(clamp((raw-.3)/.7,0,1),'ease-out'):1,
  countdownDigit:opts.animation==='countdown-roll'
    ?Math.max(0,Math.ceil((1-progress)*( /^\d+$/.test(text.trim())?clamp(Number(text.trim()),1,99):3))):null,
  countdownPhase:opts.animation==='countdown-roll'
    ?(1-progress)*( /^\d+$/.test(text.trim())?clamp(Number(text.trim()),1,99):3):0,
  splitProgress:opts.animation==='split-enter'?progress:1
 };
}
function roundRect(ctx,x,y,w,h,r) {
 const radius=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);
 ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);
 ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);
 ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();
}
const fonts={sans:'system-ui,Arial,sans-serif',
 script:'"Brush Script MT","Segoe Script",cursive',
 serif:'Georgia,"Times New Roman",serif',
 mono:'"Geist Mono","Courier New",monospace'};
function drawTitle(ctx,text,x,y,{size=54,weight=800,font='sans',align='center',
 fill='#fff',outline='#333',outlineWidth=3,shadow='#000',shadowBlur=8,
 maxWidth=580,italic=false,letterSpacing=0,metallic=false,fillAlpha=1}={}) {
 let px=size;
 ctx.textAlign=align;ctx.textBaseline='middle';ctx.lineJoin='round';
 const family=fonts[font]||fonts.sans;
 const setFont=()=>{ctx.font=(italic?'italic ':'')+weight+' '+px+'px '+family;};
 setFont();
 // Word-wrap with a shared safe width; template composition controls layout.
 while(px>14 && ctx.measureText(text).width>maxWidth){px-=2;setFont();}
 ctx.shadowColor=shadow;ctx.shadowBlur=shadowBlur;
 ctx.strokeStyle=outline;ctx.lineWidth=outlineWidth;ctx.fillStyle=fill;
 if(metallic){
  // Contrasting dark and bright bands create a real reflective title,
  // not just a silver palette swap. Fill remains user-configurable.
  const gradient=ctx.createLinearGradient(0,y-px*.6,0,y+px*.6);
  gradient.addColorStop(0,'#ffffff');
  gradient.addColorStop(.27,fill);
  gradient.addColorStop(.48,'#324658');
  gradient.addColorStop(.58,'#ffffff');
  gradient.addColorStop(1,fill);
  ctx.fillStyle=gradient;
 }
 if(outlineWidth>0)ctx.strokeText(text,x,y,maxWidth);
 ctx.save();
 ctx.globalAlpha*=clamp(fillAlpha,0,1);
 ctx.fillText(text,x,y,maxWidth);
 ctx.restore();
 ctx.shadowBlur=0;
}
/**
 * Individual character motion with measured glyph widths. The output is a
 * pure function of the clip timestamp and character index; seeking backwards
 * and fixed-frame exports reproduce the same pixels.
 */
function drawGlyphs(ctx,text,x,y,options,frame,mode) {
 const letters=Array.from(text);
 if(!letters.length)return;
 const size=options.size||54;
 const weight=options.weight??800;
 const family=fonts[options.font]||fonts.sans;
 const font=(options.italic?'italic ':'')+weight+' '+size+'px '+family;
 ctx.save();ctx.font=font;
 const metrics=letters.map(char=>ctx.measureText(char).width);
 const total=metrics.reduce((a,b)=>a+b,0);
 const fit=Math.min(1,(options.maxWidth??580)/Math.max(1,total));
 const align=options.align||'center';
 ctx.translate(x,y);ctx.scale(fit,fit);
 let cursor=align==='left'?0:align==='right'?-total:-total/2;
 const intensity=frame.intensity;
 for(let i=0;i<letters.length;i++){
  const char=letters[i],width=metrics[i];
  const stagger=clamp((frame.progress-i/Math.max(letters.length,1)*.62)/.38,0,1);
  let dx=0,dy=0,glyphScale=1,alpha=1;
  if(mode==='letter-pop'){
   dy=-Math.pow(1-stagger,2)*45*intensity;
   glyphScale=.65+.35*stagger;
  }else if(mode==='kinetic-stagger'){
   dx=(i%2===0?-1:1)*Math.pow(1-stagger,2)*106*intensity;
   dy=(1-stagger)*18*intensity;
   alpha=stagger;
  }else if(mode==='shake'){
   dx=Math.sin(frame.elapsed*46+i*2.31)*6*intensity;
   dy=Math.cos(frame.elapsed*38+i*1.77)*5*intensity;
  }else if(mode==='wave'){
   dy=Math.sin(frame.elapsed*5.4+i*.93)*17*intensity;
   dx=Math.sin(frame.elapsed*2.1+i*.77)*3*intensity;
  }else if(mode==='neon-flicker'&&frame.raw<.94){
   alpha=.2+.8*Math.abs(Math.sin(frame.elapsed*(23+i*.61)+i*2.4));
  }else if(mode==='glitch-text'){
   dx=Math.sin(frame.elapsed*19.1+i*5.2)*4*intensity;
   dy=Math.cos(frame.elapsed*28.8+i*1.7)*3*intensity;
  }
  ctx.save();
  ctx.translate(cursor+width/2+dx,dy);
  ctx.scale(glyphScale,glyphScale);
  ctx.globalAlpha*=alpha;
  if(mode==='glitch-text' && intensity>0){
   const skew=Math.sin(frame.elapsed*31+i*3.7)*5*intensity;
   drawTitle(ctx,char,-skew,0,{...options,size,align:'center',outlineWidth:0,
       shadowBlur:0,fill:'#ff4269',maxWidth:width+12});
   drawTitle(ctx,char,skew,0,{...options,size,align:'center',outlineWidth:0,
       shadowBlur:0,fill:'#2be8ff',maxWidth:width+12});
  }
  drawTitle(ctx,char,0,0,{...options,size,align:'center',maxWidth:width+12});
  ctx.restore();
  cursor+=width;
 }
 ctx.restore();
}
/**
 * Reveal a scripted title character by character, with a pen tip travelling
 * along the revealed writing. Progress is derived only from timeline time.
 */
function drawWritingTitle(ctx,text,x,y,opts,frame){
 const letters=Array.from(text);
 if(!letters.length)return;
 const size=opts.size||84;
 ctx.save();
 ctx.font='italic 500 '+size+'px '+fonts.script;
 const widths=letters.map(letter=>ctx.measureText(letter).width);
 const total=widths.reduce((sum,w)=>sum+w,0);
 const fit=Math.min(1,(opts.maxWidth||550)/Math.max(total,1));
 ctx.translate(x,y);ctx.scale(fit,fit);
 let cursor=-total/2,penX=cursor;
 const overall=frame.progress*letters.length;
 for(let i=0;i<letters.length;i++){
  const w=widths[i],fraction=clamp(overall-i,0,1);
  if(fraction>0){
   ctx.save();ctx.beginPath();ctx.rect(cursor-2,-size,Math.max(1,w*fraction+4),size*2.1);ctx.clip();
   drawTitle(ctx,letters[i],cursor+w/2,0,{...opts,size,font:'script',
     italic:true,weight:500,maxWidth:w+15,align:'center'});
   ctx.restore();
  }
  if(fraction>0)penX=cursor+w*fraction;
  cursor+=w;
 }
 if(frame.progress>0&&frame.progress<1){
  ctx.fillStyle=opts.outline;ctx.beginPath();ctx.arc(penX+2,12,4,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=opts.fill;ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(penX+4,7);ctx.lineTo(penX+16,-18);ctx.stroke();
 }
 ctx.restore();
}
const GLYPH_ANIMATIONS=new Set(['letter-pop','shake','wave','kinetic-stagger','glitch-text','neon-flicker']);
function textValue(config,frame) {
 const value=config.value||'MotoriClip';
 return config.animation==='typewriter'
   ?Array.from(value).slice(0,frame.visibleCharacters).join(''):value;
}
function decorate(ctx,layout,fill,outline,frame) {
 switch(layout){
  case 'neon':{
   ctx.strokeStyle=outline;ctx.lineWidth=3;ctx.shadowColor=fill;ctx.shadowBlur=18;
   roundRect(ctx,82,105,476,148,23);ctx.stroke();ctx.shadowBlur=0;break;
  }
  case 'cinematic':{
   ctx.strokeStyle=outline;ctx.lineWidth=1.5;
   ctx.beginPath();ctx.moveTo(86,118);ctx.lineTo(554,118);ctx.moveTo(86,244);ctx.lineTo(554,244);ctx.stroke();break;
  }
  case 'news':{
   const bannerWidth=frame.boxReveal?Math.round(588*clamp(frame.raw/.46,0,1)):588;
   if(bannerWidth>0){
    ctx.fillStyle='#17283e';roundRect(ctx,26,245,bannerWidth,100,7);ctx.fill();
    ctx.fillStyle=outline;ctx.fillRect(26,245,bannerWidth,8);
   }
   ctx.save();
   ctx.globalAlpha*=frame.boxReveal?clamp((frame.raw-.23)/.22,0,1):1;
   ctx.fillStyle='#f0eee7';ctx.font='700 18px '+fonts.mono;ctx.textAlign='left';
   ctx.fillText('BREAKING NEWS',55,274);
   ctx.restore();break;
  }
  case 'location':{
   ctx.save();
   if(frame.locationLabelProgress<1){
    ctx.beginPath();ctx.rect(50,222,535*frame.locationLabelProgress,107);ctx.clip();
   }
   ctx.fillStyle='rgba(9,25,30,.88)';roundRect(ctx,55,223,530,104,18);ctx.fill();
   ctx.restore();
   const p=frame.pinProgress;
   const drop=-142*Math.pow(1-p,2)+Math.sin(p*Math.PI*3)*(1-p)*15;
   ctx.save();ctx.globalAlpha*=clamp(p*3,0,1);
   ctx.translate(0,drop);
   ctx.fillStyle=outline;ctx.beginPath();ctx.arc(109,273,26,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#0a2029';ctx.font='700 24px '+fonts.sans;ctx.textAlign='center';
   ctx.fillText('⌖',109,274);
   ctx.restore();break;
  }
  case 'quote':{
   ctx.save();ctx.fillStyle=outline;ctx.font='italic 150px '+fonts.serif;ctx.textAlign='left';
   ctx.globalAlpha*=.72;ctx.fillText('“',48,132);ctx.restore();
   ctx.fillStyle=outline;ctx.fillRect(118,253,403,2);break;
  }
  case 'comic':{
   ctx.save();ctx.translate(320,170);ctx.rotate(-.045);
   ctx.fillStyle=outline;ctx.lineWidth=10;ctx.strokeStyle='#181324';
   roundRect(ctx,-260,-70,520,139,33);ctx.fill();ctx.stroke();ctx.restore();break;
  }
  case 'social':{
   ctx.fillStyle=outline;roundRect(ctx,158,113,324,132,38);ctx.fill();
   ctx.strokeStyle='#ffffff';ctx.lineWidth=3;roundRect(ctx,166,121,308,116,33);ctx.stroke();break;
  }
  case 'chapter':{
   ctx.fillStyle=outline;ctx.fillRect(267,127,106,2);
   ctx.font='700 18px '+fonts.mono;ctx.textAlign='center';ctx.fillStyle=fill;
   ctx.fillText('CHAPTER',320,109);
   ctx.fillRect(267,243,106,2);break;
  }
  case 'hud':{
   ctx.strokeStyle=outline;ctx.lineWidth=2;ctx.beginPath();
   ctx.moveTo(39,112);ctx.lineTo(39,83);ctx.lineTo(96,83);
   ctx.moveTo(544,83);ctx.lineTo(601,83);ctx.lineTo(601,112);
   ctx.moveTo(39,248);ctx.lineTo(39,277);ctx.lineTo(96,277);
   ctx.moveTo(544,277);ctx.lineTo(601,277);ctx.lineTo(601,248);ctx.stroke();
   ctx.fillStyle=fill;ctx.font='16px '+fonts.mono;ctx.textAlign='left';ctx.fillText('SYS // 01',54,104);break;
  }
  case 'event':{
   ctx.fillStyle=outline;ctx.beginPath();ctx.moveTo(32,98);ctx.lineTo(590,98);
   ctx.lineTo(548,254);ctx.lineTo(0,254);ctx.closePath();ctx.fill();
   ctx.fillStyle='#18212a';ctx.fillRect(30,265,190,29);
   ctx.fillStyle=fill;ctx.font='700 17px '+fonts.mono;ctx.textAlign='left';ctx.fillText('LIVE EVENT',45,280);break;
  }
  case 'speech':{
   ctx.fillStyle=outline;roundRect(ctx,58,82,522,197,39);ctx.fill();
   ctx.beginPath();ctx.moveTo(130,270);ctx.lineTo(132,319);ctx.lineTo(194,270);ctx.closePath();ctx.fill();break;
  }
  case 'typewriter':{
   ctx.fillStyle='rgba(58,45,32,.75)';roundRect(ctx,35,120,570,125,8);ctx.fill();
   ctx.fillStyle=outline;ctx.fillRect(65,150,4,67);break;
  }
  case 'stamp':{
   ctx.save();ctx.translate(320,182);ctx.rotate(-.08);
   ctx.strokeStyle=outline;ctx.lineWidth=8;ctx.strokeRect(-240,-83,480,166);
   ctx.lineWidth=2;ctx.strokeRect(-226,-69,452,138);ctx.restore();break;
  }
  case 'stacked':{
   ctx.fillStyle=outline;ctx.fillRect(38,72,26,220);
   ctx.fillStyle=outline;ctx.fillRect(68,293,515,5);break;
  }
  case 'countdown':{
   ctx.save();ctx.fillStyle='rgba(8,27,40,.86)';
   ctx.beginPath();ctx.arc(320,171,120,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle=outline;ctx.lineWidth=7;ctx.beginPath();
   ctx.arc(320,171,115,0,Math.PI*2);ctx.stroke();
   ctx.strokeStyle=fill;ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();
   ctx.arc(320,171,115,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(.0001,1-frame.progress));
   ctx.stroke();
   for(let i=0;i<12;i++){
    const angle=i*Math.PI/6-Math.PI/2;
    ctx.strokeStyle='rgba(248,242,220,.45)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(320+Math.cos(angle)*92,171+Math.sin(angle)*92);
    ctx.lineTo(320+Math.cos(angle)*102,171+Math.sin(angle)*102);ctx.stroke();
   }
   ctx.restore();break;
  }
  case 'split':{
   ctx.strokeStyle=outline;ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(96,177);ctx.lineTo(544,177);ctx.stroke();
   ctx.fillStyle=outline;ctx.fillRect(295,167,50,20);
   break;
  }
 }
}
export function paintTimelineText(ctx,width,height,input={},localTime=0,clipDuration=3) {
 const config=normaliseTextOverlay(input);
 const design=getTextDesign(config.presetId)||TEXT_DESIGNS[0];
 const frame=textAnimationState(config,localTime,clipDuration);
 const layout=design.layout;
 const value=textValue(config,frame);
 const scaleX=width/640,scaleY=height/360;
 ctx.save();
 try {
  ctx.scale(scaleX,scaleY);
   ctx.globalAlpha*=frame.alpha;
   if(config.animation==='title-wipe'){
    const across=['left','right'].includes(config.animationDirection);
    const length=across?640:360;
    const visible=length*frame.progress;
    const reverse=['right','down'].includes(config.animationDirection);
    ctx.beginPath();
    if(across)ctx.rect(reverse?length-visible:0,0,visible,360);
    else ctx.rect(0,reverse?length-visible:0,640,visible);
    ctx.clip();
   }
   if(config.animation==='slide')ctx.translate(frame.slideX,frame.slideY);
   if(config.animation==='social-pulse'){
    const pulse=Math.max(.01,frame.socialScale);
    ctx.translate(320,180);ctx.scale(pulse,pulse);ctx.translate(-320,-180);
   }
   if(config.animation==='bounce'){
    const p=frame.progress,drop=(1-p)*(1-p)*105*frame.intensity;
    const rebound=Math.sin(p*Math.PI*3.2)*(1-p)*30*frame.intensity;
    ctx.translate(0,drop+rebound);
   }
   if(config.animation==='ticker'){
    ctx.beginPath();ctx.rect(0,0,640,360);ctx.clip();
    ctx.translate(frame.tickerX,0);
   }
   decorate(ctx,layout,config.fill,config.outline,frame);
   const factor=config.fontSize/100;
   const base={fill:config.fill,outline:config.outline,outlineWidth:config.outlineWidth,
     shadow:config.shadow,shadowBlur:config.shadowBlur};

   const write=(text,x,y,details={})=>{
    const {revealAlpha,...style}=details;
    const opts={...base,...style};
    if(config.animation==='outline-fill')opts.fillAlpha=frame.progress;
    ctx.save();
    ctx.globalAlpha*=Number.isFinite(revealAlpha)?revealAlpha:frame.textAlpha;
    if(GLYPH_ANIMATIONS.has(config.animation)&&text.length<80)
      drawGlyphs(ctx,text,x,y,opts,frame,config.animation);
    else drawTitle(ctx,text,x,y,opts);
    ctx.restore();
   };
  switch(layout){
   case 'neon':
    write(value,320,182,{size:70*factor,outlineWidth:Math.max(2,config.outlineWidth),
     shadow:config.fill,shadowBlur:Math.max(18,config.shadowBlur),font:'sans',weight:600});break;
   case 'chrome':{
    ctx.save();ctx.translate(320,180);ctx.transform(1,0,-.13,1,0,0);
    write(value,0,0,{size:83*factor,shadowBlur:22,outlineWidth:7,metallic:true});
    ctx.restore();ctx.fillStyle='rgba(255,255,255,.38)';ctx.fillRect(63,231,510,2);break;
   }
   case 'handwriting':
    if(config.animation==='handwriting-reveal')
      drawWritingTitle(ctx,value,320,175,{...base,font:'script',weight:500,italic:true,
        size:92*factor,outlineWidth:1,maxWidth:520},frame);
    else write(value,320,175,{font:'script',weight:500,italic:true,size:92*factor,outlineWidth:1});
    ctx.strokeStyle=config.outline;ctx.lineWidth=3;ctx.beginPath();
    ctx.moveTo(128,241);
    ctx.quadraticCurveTo(128+174*(config.animation==='handwriting-reveal'?frame.progress:1),
      241+28*(config.animation==='handwriting-reveal'?frame.progress:1),
      128+390*(config.animation==='handwriting-reveal'?frame.progress:1),
      241-13*(config.animation==='handwriting-reveal'?frame.progress:1));
    ctx.stroke();break;
   case 'cinematic':
    write(value.toUpperCase(),320,183,{font:'serif',weight:500,size:59*factor,outlineWidth:0});
    break;
   case 'news':
    write(value.toUpperCase(),55,305,{size:38*factor,align:'left',maxWidth:522,
      outlineWidth:0,revealAlpha:frame.headlineAlpha});
    if(config.subtitle.trim())write(config.subtitle,55,333,{size:17*factor,align:'left',
      maxWidth:530,outlineWidth:0,weight:500,font:'mono',revealAlpha:frame.subtitleAlpha});
    break;
   case 'location':
    ctx.save();ctx.beginPath();ctx.rect(176,238,395*frame.locationLabelProgress,78);ctx.clip();
    write(value,176,277,{size:38*factor,align:'left',maxWidth:385,outlineWidth:0});
    ctx.restore();break;
   case 'quote':
    write(value,319,181,{font:'serif',weight:500,italic:true,size:51*factor,outlineWidth:0,maxWidth:410});break;
   case 'comic':
    ctx.save();ctx.translate(320,173);ctx.rotate(-.045);
    write(value.toUpperCase(),0,0,{size:70*factor,outlineWidth:6,shadowBlur:1,maxWidth:458});ctx.restore();break;
   case 'social':
    write(value.toUpperCase(),320,179,{size:52*factor,outlineWidth:0,maxWidth:284});break;
   case 'chapter':
    write(value.toUpperCase(),320,188,{font:'serif',size:53*factor,weight:600,outlineWidth:0});break;
   case 'hud':
    write(value.toUpperCase(),320,184,{font:'mono',size:52*factor,weight:600,maxWidth:500});break;
   case 'event':
    write(value.toUpperCase(),300,181,{size:66*factor,weight:900,outlineWidth:2,maxWidth:495});break;
   case 'speech':
    write(value,320,178,{size:51*factor,weight:700,outlineWidth:0,maxWidth:452});break;
   case 'typewriter':
    write(value,332,186,{font:'mono',size:48*factor,weight:500,align:'center',outlineWidth:0,maxWidth:500});
    if(config.animation==='typewriter' && frame.progress<1){
      ctx.fillStyle=config.fill;ctx.fillRect(558,157,3,53);
    }break;
   case 'stamp':
    ctx.save();ctx.translate(320,182);ctx.rotate(-.08);
    write(value.toUpperCase(),0,0,{size:66*factor,weight:900,outlineWidth:0,maxWidth:436});ctx.restore();break;
   case 'countdown':{
    const isNumber=/^\d+$/.test(value.trim());
    const initial=isNumber?Math.min(99,Math.max(1,Number(value.trim()))):3;
    const number=frame.countdownDigit===null?initial:frame.countdownDigit;
    ctx.save();ctx.beginPath();ctx.rect(240,113,160,116);ctx.clip();
    write(String(number),320,166,{font:'mono',size:109*factor,weight:800,
      outlineWidth:1,maxWidth:158});
    ctx.restore();
    if(!isNumber)write(value.toUpperCase(),320,313,{font:'mono',size:21*factor,weight:700,
      outlineWidth:0,maxWidth:520});
    break;
   }
   case 'split':{
    const words=value.trim().split(/\s+/).filter(Boolean);
    const first=words.length>=2?words.slice(0,Math.ceil(words.length/2)).join(' '):
      value.slice(0,Math.ceil(value.length/2));
    const second=words.length>=2?words.slice(Math.ceil(words.length/2)).join(' '):
      value.slice(Math.ceil(value.length/2));
    const offset=300*Math.pow(1-frame.splitProgress,2)*frame.intensity;
    ctx.save();ctx.translate(-offset,0);
    write(first.toUpperCase(),320,132,{size:62*factor,weight:900,maxWidth:460});
    ctx.restore();
    ctx.save();ctx.translate(offset,0);
    write((second||'TITLE').toUpperCase(),320,224,{size:66*factor,weight:900,maxWidth:470});
    ctx.restore();break;
   }
   case 'stacked':{
    const words=value.split(/\s+/).filter(Boolean);
    const midpoint=Math.ceil(words.length/2);
    const top=words.slice(0,midpoint).join(' ').toUpperCase();
    const bottom=(words.slice(midpoint).join(' ')||'TITLE').toUpperCase();
    write(top,326,138,{size:56*factor,weight:900,maxWidth:482,outlineWidth:0});
    write(bottom,326,213,{size:73*factor,weight:900,maxWidth:480,outlineWidth:0});break;
   }
  }
 }finally{ctx.restore();}
}
