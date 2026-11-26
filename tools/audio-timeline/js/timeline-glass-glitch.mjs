/** Glass Glitch: seeded irregular glass facets with independent refractive motion.
 * Nearest/second-nearest sites define a contiguous Voronoi fracture, not a rectangular grid.
 * RGB samples are alpha weighted; the source coverage is unchanged.
 */
const clamp=(v,a,b,d)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):d));
const rand=n=>{n=Math.imul(n^0x85ebca6b,0x9e3779b1);n=Math.imul(n^(n>>>16),0x7feb352d);return ((n^(n>>>15))>>>0)/4294967296;};
export function glassFractureSites(w,h,e={}){
 const density=clamp(e.density,1,120,48),scale=clamp(e.scale,10,300,100)/100;
 const count=Math.max(5,Math.min(72,Math.round((5+density*.48)/scale)));
 const cols=Math.max(2,Math.round(Math.sqrt(count*w/h))),rows=Math.max(2,Math.round(count/cols));
 const seed=Math.round(clamp(e.glassSeed,0,99999,1984));
 const sites=[];
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const id=y*cols+x,k=seed+id*47;
  sites.push({id,x:(x+.12+.76*rand(k+1))*w/cols,y:(y+.12+.76*rand(k+2))*h/rows,
   nx:rand(k+3)*2-1,ny:rand(k+4)*2-1,phase:rand(k+5)*Math.PI*2,rate:.8+rand(k+6)*1.8});
 }
 return {sites,cols,rows};
}
function sample(src,w,h,x,y,c,fallback){
 x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));
 const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0;
 const i=(y0*w+x0)*4,j=(y0*w+x1)*4,k=(y1*w+x0)*4,l=(y1*w+x1)*4;
 const a=src[i+3]*(1-fx)*(1-fy),b=src[j+3]*fx*(1-fy),d=src[k+3]*(1-fx)*fy,f=src[l+3]*fx*fy;
 const weight=a+b+d+f;return weight>0?(src[i+c]*a+src[j+c]*b+src[k+c]*d+src[l+c]*f)/weight:fallback;
}
function geometry(w,h,e,workspace){
 const key=[w,h,e.density,e.scale,e.glassSeed].join(':');
 if(workspace.key===key)return workspace.geometry;
 const {sites,cols,rows}=glassFractureSites(w,h,e),ids=new Uint16Array(w*h),edges=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const gx=Math.floor(x/w*cols),gy=Math.floor(y/h*rows);
  let first=Infinity,second=Infinity,a=0,b=0;
  // A two-cell neighborhood covers even extreme jittered site placements.
  for(let yy=Math.max(0,gy-2);yy<=Math.min(rows-1,gy+2);yy++)
   for(let xx=Math.max(0,gx-2);xx<=Math.min(cols-1,gx+2);xx++){
    const s=sites[yy*cols+xx],d=(x-s.x)**2+(y-s.y)**2;
    if(d<first){second=first;b=a;first=d;a=s.id;}else if(d<second){second=d;b=s.id;}
   }
  const p=y*w+x;ids[p]=a;
  edges[p]=(second-first)/(2*Math.max(1,Math.hypot(sites[a].x-sites[b].x,sites[a].y-sites[b].y)));
 }
 return workspace.geometry={sites,ids,edges},workspace.key=key,workspace.geometry;
}
export function buildGlassGlitchFrame(source,w,h,e={},seconds=0,reuse,amount=1,workspace={}){
 const src=source?.data||source;if(!src||src.length!==w*h*4)throw Error('Glass Glitch requires matching RGBA source');
 const data=reuse&&reuse!==src&&reuse.length===src.length?reuse:new Uint8ClampedArray(src.length);data.set(src);
 const mix=clamp(amount,0,1,1),amp=clamp(e.distortion,0,100,55)/100*Math.min(w,h)*.095;
 const {sites,ids,edges}=geometry(w,h,e,workspace);
 if(!mix||!amp)return {data,width:w,height:h,sites,ids,edges};
 const t=Math.max(0,Number(seconds)||0),motion=clamp(e.glassMotion,0,100,65)/100;
 const prism=clamp(e.glassPrism,0,100,35)/100,seams=clamp(e.glassSeams,0,100,45)/100;
 const axis=clamp(e.direction,-180,180,0)*Math.PI/180,ca=Math.cos(axis),sa=Math.sin(axis);
 const tint=/^#[0-9a-f]{6}$/i.test(e.color||'')?e.color:'#ffd98d',rgb=[1,3,5].map(i=>parseInt(tint.slice(i,i+2),16));
 const width=Math.max(.7,Math.min(w,h)*.006);
 const poses=sites.map(s=>{const oscillation=Math.sin(t*s.rate*4+s.phase),u=s.nx*(.45+motion*.75*oscillation),v=s.ny*(.55+motion*.65*Math.cos(t*s.rate*3+s.phase));return {dx:amp*(u*ca-v*sa),dy:amp*(u*sa+v*ca),tilt:amp/Math.min(w,h)*s.nx*.7};});
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=y*w+x,i=p*4;if(!src[i+3])continue;
  const s=sites[ids[p]],pose=poses[s.id],edge=edges[p];
  const sx=x+pose.dx+(x-s.x)*pose.tilt,sy=y+pose.dy+(y-s.y)*pose.tilt;
  const fringe=prism*amp*.24*Math.exp(-edge/(width*3));
  const reflection=seams*Math.exp(-edge/width)*(.35+.65*Math.abs(s.nx))*.6;
  for(let c=0;c<3;c++){const d=(c-1)*fringe,v=sample(src,w,h,sx+d*ca,sy+d*sa,c,src[i+c]);
   data[i+c]=src[i+c]+(v+(rgb[c]-v)*reflection-src[i+c])*mix;}
 }
 return {data,width:w,height:h,sites,ids,edges};
}
const CACHE=new WeakMap();
export function renderGlassGlitch(ctx,source,w,h,e,t,amount){
 if(!source)return false;
 let cache=CACHE.get(ctx);
 if(!cache){const canvas=typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
 const c=canvas?.getContext('2d',{willReadFrequently:true});if(!c)return false;cache={canvas,c,buffer:null,workspace:{}};CACHE.set(ctx,cache);}
 const {canvas,c}=cache;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;cache.buffer=null;cache.workspace={};}
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='copy';c.drawImage(source,0,0,w,h);
 let input;try{input=c.getImageData(0,0,w,h);}catch{return false;}
 const out=buildGlassGlitchFrame(input,w,h,e,t,cache.buffer,amount,cache.workspace);cache.buffer=out.data;input.data.set(out.data);c.putImageData(input,0,0);
 ctx.save();try{ctx.globalCompositeOperation='copy';ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,w,h);}finally{ctx.restore();}return true;
}
