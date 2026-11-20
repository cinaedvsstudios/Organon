/**
 * MotoriClip dynamic, editable title compositions.
 * Designs have different layouts and type treatments; colours and outline
 * strength are Inspector parameters, not duplicate library templates.
 * Every animation uses clip-relative time (no wall clocks or random state).
 */
export const TEXT_DESIGNS=Object.freeze([
 {id:'neon-cyan',label:'Neon Sign',layout:'neon',animation:'neon-flicker',fill:'#64eeff',stroke:'#216aca',font:'sans'},
 {id:'chrome-title',label:'Chrome Title',layout:'chrome',animation:'fade',fill:'#eaf0f8',stroke:'#527494',font:'sans'},
 {id:'handwritten-script',label:'Handwritten',layout:'handwriting',animation:'letter-pop',fill:'#fff5d4',stroke:'#815d8c',font:'script'},
 {id:'cinematic-title',label:'Cinematic',layout:'cinematic',animation:'fade',fill:'#fff8ec',stroke:'#d2ad63',font:'serif'},
 {id:'news-lower-third',label:'News Lower Third',layout:'news',animation:'box-reveal',fill:'#ffffff',stroke:'#e0a360',font:'sans'},
 {id:'location-card',label:'Location Card',layout:'location',animation:'slide',fill:'#ffffff',stroke:'#54d5ff',font:'sans'},
 {id:'editorial-quote',label:'Editorial Quote',layout:'quote',animation:'fade',fill:'#f6ecdc',stroke:'#d3b47c',font:'serif'},
 {id:'comic-sticker',label:'Comic Sticker',layout:'comic',animation:'letter-pop',fill:'#fff968',stroke:'#191429',font:'sans'},
 {id:'social-callout',label:'Social Callout',layout:'social',animation:'letter-pop',fill:'#ffffff',stroke:'#ff447b',font:'sans'},
 {id:'chapter-ending',label:'Chapter / Ending',layout:'chapter',animation:'fade',fill:'#f5e6c8',stroke:'#ab8652',font:'serif'},
 {id:'tech-hud',label:'Technology HUD',layout:'hud',animation:'typewriter',fill:'#8cffee',stroke:'#168882',font:'mono'},
 {id:'event-announcement',label:'Event Announcement',layout:'event',animation:'slide',fill:'#ffffff',stroke:'#ff8651',font:'sans'},
 {id:'speech-bubble',label:'Speech Bubble',layout:'speech',animation:'letter-pop',fill:'#18232b',stroke:'#faf5e9',font:'sans'},
 {id:'typewriter-document',label:'Typewriter',layout:'typewriter',animation:'typewriter',fill:'#f7efdb',stroke:'#c3a888',font:'mono'},
 {id:'retro-stamp',label:'Retro Stamp',layout:'stamp',animation:'shake',fill:'#f1dbac',stroke:'#b84936',font:'sans'},
 {id:'stacked-headline',label:'Stacked Headline',layout:'stacked',animation:'box-reveal',fill:'#fff7ec',stroke:'#e08343',font:'sans'}
].map(item=>Object.freeze({...item,group:'text'})));
export const TEXT_ANIMATIONS=Object.freeze([
 ['none','Static'],['typewriter','Typewriter'],['letter-pop','Letter Pop'],
 ['shake','Shaking Letters'],['box-reveal','Broadcast Box Reveal'],
 ['neon-flicker','Neon Flicker'],['ticker','Scrolling Ticker'],
 ['slide','Slide In'],['fade','Fade In']
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
  animationDuration:safeNumber(input.animationDuration,1.2,.1,10)
 };
}
export function textAnimationState(config={},localTime=0,clipDuration=3) {
 const opts=normaliseTextOverlay(config);
 const time=Math.max(0,Number(localTime)||0);
 const clip=Math.max(.1,Number(clipDuration)||3);
 const duration=Math.min(opts.animationDuration,clip);
 const progress=clamp(time/duration,0,1);
 const text=opts.value||'MotoriClip';
 return {
  progress,
  visibleCharacters:opts.animation==='typewriter'
    ?Math.min(text.length,Math.floor(progress*text.length)+Number(progress===1)) :text.length,
  alpha:opts.animation==='fade'?progress:1,
  slideX:opts.animation==='slide'?Math.round((1-progress)**2*-220):0,
  boxWidth:opts.animation==='box-reveal'?Math.round(640*progress):640,
  tickerX:opts.animation==='ticker'?640-(time/clip)*1280:0,
  jitter:opts.animation==='shake'?Math.sin(time*46)*4:0,
  flicker:opts.animation==='neon-flicker'
    ?(progress<.85 ? (.46+.44*Math.abs(Math.sin(time*36))) :1) :1
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
 maxWidth=580,italic=false,letterSpacing=0}={}) {
 let px=size;
 ctx.textAlign=align;ctx.textBaseline='middle';ctx.lineJoin='round';
 const family=fonts[font]||fonts.sans;
 const setFont=()=>{ctx.font=(italic?'italic ':'')+weight+' '+px+'px '+family;};
 setFont();
 // Word-wrap with a shared safe width; template composition controls layout.
 while(px>14 && ctx.measureText(text).width>maxWidth){px-=2;setFont();}
 ctx.shadowColor=shadow;ctx.shadowBlur=shadowBlur;
 ctx.strokeStyle=outline;ctx.lineWidth=outlineWidth;ctx.fillStyle=fill;
 if(outlineWidth>0)ctx.strokeText(text,x,y,maxWidth);
 ctx.fillText(text,x,y,maxWidth);
 ctx.shadowBlur=0;
}
function drawGlyphs(ctx,text,x,y,options,frame) {
 const letters=Array.from(text);
 const size=options.size||54;
 ctx.font='800 '+size+'px '+fonts.sans;
 const fullWidth=ctx.measureText(text).width;
 let cursor=x-fullWidth/2;
 for(let i=0;i<letters.length;i++){
  const char=letters[i],width=ctx.measureText(char).width;
  const p=clamp((frame.progress-i/Math.max(letters.length,1)*.55)/.45,0,1);
  const movement=(1-p)*38,scale=.65+p*.35;
  ctx.save();ctx.translate(cursor+width/2,y-movement);ctx.scale(scale,scale);
  drawTitle(ctx,char,0,0,{...options,size,align:'center',maxWidth:width+16});
  ctx.restore();cursor+=width;
 }
}
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
   ctx.fillStyle='#17283e';roundRect(ctx,26,245,588,100,7);ctx.fill();
   ctx.fillStyle=outline;ctx.fillRect(26,245,Math.max(0,frame.boxWidth*.92),11);
   ctx.fillStyle='#f0eee7';ctx.font='700 18px '+fonts.mono;ctx.textAlign='left';
   ctx.fillText('MOTORICLIP  •  LATEST',55,275);break;
  }
  case 'location':{
   ctx.fillStyle='rgba(9,25,30,.88)';roundRect(ctx,55,223,530,104,18);ctx.fill();
   ctx.fillStyle=outline;ctx.beginPath();ctx.arc(109,273,26,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#0a2029';ctx.font='700 24px '+fonts.sans;ctx.textAlign='center';
   ctx.fillText('⌖',109,274);break;
  }
  case 'quote':{
   ctx.fillStyle=outline;ctx.font='italic 150px '+fonts.serif;ctx.textAlign='left';
   ctx.globalAlpha*=.72;ctx.fillText('“',48,132);ctx.globalAlpha=1;
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
  ctx.globalAlpha*=frame.alpha*frame.flicker;
  if(config.animation==='box-reveal'){
    ctx.beginPath();ctx.rect(0,0,frame.boxWidth,360);ctx.clip();
  }
  if(config.animation==='slide')ctx.translate(frame.slideX,0);
  if(config.animation==='shake')ctx.translate(frame.jitter,Math.cos(localTime*51)*3);
  if(config.animation==='ticker'){
    ctx.beginPath();ctx.rect(0,0,640,360);ctx.clip();
    ctx.translate(frame.tickerX,0);
  }
  decorate(ctx,layout,config.fill,config.outline,frame);
  const factor=config.fontSize/100;
  const base={fill:config.fill,outline:config.outline,outlineWidth:config.outlineWidth,
    shadow:config.shadow,shadowBlur:config.shadowBlur};
  const write=(text,x,y,details={})=>{
   const opts={...base,...details};
   if(config.animation==='letter-pop' && text.length<55)drawGlyphs(ctx,text,x,y,opts,frame);
   else drawTitle(ctx,text,x,y,opts);
  };
  switch(layout){
   case 'neon':
    write(value,320,182,{size:70*factor,outlineWidth:Math.max(2,config.outlineWidth),
     shadow:config.fill,shadowBlur:Math.max(18,config.shadowBlur),font:'sans',weight:600});break;
   case 'chrome':{
    ctx.save();ctx.translate(320,180);ctx.transform(1,0,-.13,1,0,0);
    write(value,0,0,{size:83*factor,shadowBlur:22,outlineWidth:7});
    ctx.restore();ctx.fillStyle='rgba(255,255,255,.38)';ctx.fillRect(63,231,510,2);break;
   }
   case 'handwriting':
    write(value,320,175,{font:'script',weight:500,italic:true,size:92*factor,outlineWidth:1});
    ctx.strokeStyle=config.outline;ctx.lineWidth=3;ctx.beginPath();
    ctx.moveTo(128,241);ctx.quadraticCurveTo(302,262,518,228);ctx.stroke();break;
   case 'cinematic':
    write(value.toUpperCase(),320,183,{font:'serif',weight:500,size:59*factor,outlineWidth:0});
    break;
   case 'news':
    write(value.toUpperCase(),324,318,{size:41*factor,align:'left',maxWidth:530,
      outlineWidth:0});break;
   case 'location':
    write(value,176,277,{size:38*factor,align:'left',maxWidth:385,outlineWidth:0});break;
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
