/**
 * MotoriClip #65 — Line Corruption / fragmented video data-lines.
 *
 * Many separate short-lived horizontal damage segments interrupt REAL source
 * pixels with displaced rows, broken gaps and coloured micro-static. Unlike
 * #63 Signal Tear these are thin, numerous, non-contiguous data fragments;
 * unlike #64 RGB Block Glitch there are no displaced rectangular image islands.
 * All randomness is indexed by absolute clip-relative time and saved seed.
 */
const clamp=(v,lo,hi,fallback=lo)=>{
 const n=Number(v);return Math.max(lo,Math.min(hi,Number.isFinite(n)?n:fallback));
};
function hash(a,b=0){
 let n=(Math.imul((a|0)+229,0x9e3779b1)^Math.imul((b|0)+71,0x85ebca6b))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;
 n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return (n>>>0)/4294967296;
}
const parseHex=(hex,otherwise)=>{
 const s=/^#[0-9a-f]{6}$/i.test(String(hex))?String(hex):otherwise;
 return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
};
function options(effect={}){
 return {
  strength:clamp(effect.intensity,0,100,86)/100,
  frequency:clamp(effect.density,1,120,81),
  displacement:clamp(effect.distortion,0,100,71)/100,
  length:clamp(effect.lineLength,5,100,57)/100,
  thickness:clamp(effect.lineThickness,1,12,4),
  fragments:clamp(effect.lineFragments,0,100,73)/100,
  static:clamp(effect.lineStatic,0,100,67)/100,
  life:clamp(effect.lineLife,.04,.4,.14),
  seed:Math.round(clamp(effect.lineSeed,0,99999,6565)),
  primary:parseHex(effect.color,'#5feeff'),
  accent:parseHex(effect.lineAccent,'#ff53ba')
 };
}
export function lineCorruptionFrameState(width,height,effect={},seconds=0){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const p=options(effect),t=Math.max(0,Number(seconds)||0);
 const rate=7+p.frequency*.53,latest=Math.floor(t*rate);
 const lookback=Math.ceil(rate*p.life*1.8)+2,lines=[];
 for(let event=Math.max(0,latest-lookback);event<=latest;event++){
  if(hash(event,p.seed+1)<.17)continue;
  const birth=(event+.5*hash(event,p.seed+2))/rate;
  const life=p.life*(.55+.85*hash(event,p.seed+3));
  const age=t-birth;if(age<0||age>=life)continue;
  const envelope=Math.pow(Math.sin(Math.PI*age/life),.52);
  const count=1+Math.floor(hash(event,p.seed+4)*(2+3*p.fragments));
  for(let part=0;part<count;part++){
   const key=event*11+part,phase=Math.floor(age*47);
   const bh=Math.max(1,Math.min(h,Math.round(p.thickness*(.4+1.25*hash(key,p.seed+5)))));
   const length=Math.max(2,Math.min(w,Math.round(w*p.length*(.24+.82*hash(key,p.seed+6)))));
   const x=Math.floor((w-length)*hash(key,p.seed+7));
   const y=Math.floor((h-bh)*hash(key,p.seed+8));
   const dx=Math.round((hash(key,p.seed+phase+9)-.5)*w*.20*p.displacement);
   const dy=Math.round((hash(key,p.seed+phase+10)-.5)*h*.06*p.displacement);
   const pulse=.55+.45*hash(key,p.seed+phase+11);
   lines.push({x,y,w:length,h:bh,dx,dy,key,strength:envelope*pulse,
    tint:hash(key,p.seed+12)>.5?0:1,phase});
  }
 }
 return {width:w,height:h,time:t,params:p,lines};
}
/** Apply thin, fragmented displacement and glitch snow to actual source RGBA. */
export function buildLineCorruptionFrame(source,width,height,effect={},seconds=0,reuse){
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const rgba=source?.data||source;
 if(!rgba||rgba.length!==w*h*4)throw Error('Line Corruption requires matching RGBA source');
 const dst=reuse?.length===rgba.length&&reuse!==rgba?reuse:new Uint8ClampedArray(rgba.length);
 dst.set(rgba);
 const state=lineCorruptionFrameState(w,h,effect,seconds),p=state.params;
 if(!p.strength)return {width:w,height:h,data:dst,state};
 const sample=(x,y,c)=>rgba[(Math.max(0,Math.min(h-1,y))*w+
  Math.max(0,Math.min(w-1,x)))*4+c];
 for(const line of state.lines){
  const amp=clamp(line.strength*p.strength,0,1);
  if(amp<.005)continue;
  const color=line.tint?p.accent:p.primary;
  for(let y=line.y;y<line.y+line.h;y++){
   for(let x=line.x;x<line.x+line.w;x++){
    // Corrupt separated fragments, never paint a continuous sweeping bar.
    const segment=Math.floor((x-line.x)/Math.max(2,Math.round(line.w/(7+16*p.fragments))));
    const gap=hash(segment+line.key,p.seed+line.phase+13);
    if(gap<p.fragments*.57)continue;
    const staticNoise=hash(x+line.key*47,(y+line.phase)*83+p.seed);
    const shift=Math.round((hash(segment+line.key,p.seed+line.phase+15)-.5)*w*.028*p.displacement);
    const sx=x+line.dx+shift,sy=y+line.dy;
    const i=(y*w+x)*4;
    const tint=staticNoise>.51?(staticNoise-.51)*p.static*1.7:0;
    const dark=staticNoise<.13*p.static?.43:1;
    for(let c=0;c<3;c++){
     const real=sample(sx,sy,c)*dark;
     const target=real*(1-tint)+color[c]*tint;
     dst[i+c]=rgba[i+c]+(target-rgba[i+c])*amp;
    }
    dst[i+3]=rgba[i+3];
   }
  }
 }
 return {width:w,height:h,data:dst,state};
}
const SCRATCH=new WeakMap();
function scratch(ctx,w,h){
 let item=SCRATCH.get(ctx);
 const scale=Math.min(1,512/Math.max(w,h));
 const sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));
 if(!item){
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):
   typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(sw,sh):null;
  const c=canvas?.getContext('2d',{willReadFrequently:true});
  if(!canvas||!c)return null;
  item={canvas,c,image:null};SCRATCH.set(ctx,item);
 }
 if(item.canvas.width!==sw||item.canvas.height!==sh){
  item.canvas.width=sw;item.canvas.height=sh;item.image=null;
 }
 return item;
}
/** Single bounded painter for editor preview and actual encoded exports. */
export function renderLineCorruption(ctx,source,width,height,effect={},seconds=0,amount=1){
 const a=clamp(amount,0,1,1);if(a<=0)return true;
 const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
 const item=source&&scratch(ctx,w,h);if(!item)return false;
 const {canvas,c}=item,sw=canvas.width,sh=canvas.height;
 c.setTransform?.(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';
 c.clearRect(0,0,sw,sh);c.drawImage(source,0,0,sw,sh);
 let original;try{original=c.getImageData(0,0,sw,sh);}catch{return false;}
 const frame=buildLineCorruptionFrame(original,sw,sh,{...effect,intensity:100},seconds,item.image?.data);
 if(!item.image||item.image.data?.length!==frame.data.length)item.image=c.createImageData(sw,sh);
 const dst=item.image.data;dst.set(frame.data);
 if(a<1)for(let i=0;i<dst.length;i+=4){
  dst[i]=original.data[i]+(dst[i]-original.data[i])*a;
  dst[i+1]=original.data[i+1]+(dst[i+1]-original.data[i+1])*a;
  dst[i+2]=original.data[i+2]+(dst[i+2]-original.data[i+2])*a;
  dst[i+3]=original.data[i+3];
 }
 c.putImageData(item.image,0,0);
 ctx.save();try{
  ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;
  ctx.drawImage(canvas,0,0,w,h);
 }finally{ctx.restore();}
 return true;
}
