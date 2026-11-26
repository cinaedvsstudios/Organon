/** Misalignment: independently displaced full-image registration ghosts.
 * Unlike chromatic aberration, each ghost samples every colour channel together.
 * Alpha-weighted sampling and bounded blending preserve source coverage.
 */
const clamp=(v,a,b,d)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):d));
export function misalignmentState(w,h,e={},seconds=0){
 const t=Math.max(0,Number(seconds)||0),amp=clamp(e.distortion,0,100,55)/100*Math.min(w,h)*.12*clamp(e.scale,10,300,100)/100;
 const axis=clamp(e.direction,-180,180,0)*Math.PI/180,ca=Math.cos(axis),sa=Math.sin(axis);
 const drift=clamp(e.misalignDrift,0,100,65)/100,rotation=clamp(e.misalignRotation,0,100,25)/100*amp/Math.max(w,h);
 const skew=clamp(e.misalignSkew,0,100,25)/100;
 return {amp,ghosts:[0,1].map(i=>{
  const sign=i?1:-1,phase=t*(i?3.7:4.3)+i*1.4;
  const u=sign*amp*(.65+drift*.35*Math.sin(phase)),v=amp*drift*.38*Math.cos(phase*.83+i);
  return {dx:u*ca-v*sa,dy:u*sa+v*ca,angle:sign*rotation*(.6+.4*Math.cos(phase)),shear:sign*skew*amp/h};
 })};
}
function sample(src,w,h,x,y,out){
 if(x<0||y<0||x>w-1||y>h-1){out[3]=0;return;}
 const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0;
 const a=(y0*w+x0)*4,b=(y0*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4;
 const wa=(1-fx)*(1-fy)*src[a+3],wb=fx*(1-fy)*src[b+3],wc=(1-fx)*fy*src[c+3],wd=fx*fy*src[d+3],sum=wa+wb+wc+wd;
 out[3]=sum/255;
 if(sum>0)for(let k=0;k<3;k++)out[k]=(wa*src[a+k]+wb*src[b+k]+wc*src[c+k]+wd*src[d+k])/sum;
}
export function buildMisalignmentFrame(source,w,h,e={},seconds=0,reuse,amount=1){
 const src=source?.data||source;if(!src||src.length!==w*h*4)throw Error('Misalignment requires matching RGBA source');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);data.set(src);
 const p=misalignmentState(w,h,e,seconds),mix=clamp(amount,0,1,1)*clamp(e.misalignOpacity,0,100,65)/100;
 if(!p.amp||!mix)return {data,width:w,height:h,state:p};
 const tint=clamp(e.misalignTint,0,100,45)/100,balance=clamp(e.misalignBalance,-100,100,0)/100;
 const hex=/^#[0-9a-f]{6}$/i.test(e.color||'')?e.color:'#35c8ef',rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),colours=[rgb,rgb.map(v=>255-v)];
 const poses=p.ghosts.map(g=>({...g,cos:Math.cos(g.angle),sin:Math.sin(g.angle)})),weights=[mix*(1-balance)*.5,mix*(1+balance)*.5];
 const a=[0,0,0,0],b=[0,0,0,0],samples=[a,b];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(!src[i+3])continue;
  for(let j=0;j<2;j++){const g=poses[j],xx=x-w/2-g.dx,yy=y-h/2-g.dy;
   sample(src,w,h,xx*g.cos+yy*g.sin+yy*g.shear+w/2,-xx*g.sin+yy*g.cos+h/2,samples[j]);}
  const wa=weights[0]*a[3],wb=weights[1]*b[3];
  for(let c=0;c<3;c++){
   const av=a[c]*(1-tint*.65)+a[c]*colours[0][c]/255*tint*.65;
   const bv=b[c]*(1-tint*.65)+b[c]*colours[1][c]/255*tint*.65;
   data[i+c]=src[i+c]*(1-wa-wb)+av*wa+bv*wb;
  }
 }
 return {data,width:w,height:h,state:p};
}
const CACHE=new WeakMap();
export function renderMisalignment(ctx,source,w,h,e,t,amount){
 if(!source)return false;
 let cache=CACHE.get(ctx);
 if(!cache){const canvas=typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
 const c=canvas?.getContext('2d',{willReadFrequently:true});if(!c)return false;cache={canvas,c,buffer:null};CACHE.set(ctx,cache);}
 const {canvas,c}=cache;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;cache.buffer=null;}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='copy';c.drawImage(source,0,0,w,h);
 let input;try{input=c.getImageData(0,0,w,h);}catch{return false;}
 const out=buildMisalignmentFrame(input,w,h,e,t,cache.buffer,amount);cache.buffer=out.data;input.data.set(out.data);c.putImageData(input,0,0);
 ctx.save();try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,w,h);}finally{ctx.restore();}return true;
}
