/**
 * MotoriClip Hologram #02 acceptance: actual original GLSL in a browser,
 * real A/B footage, parameter influence, scrubbing, alpha + GPU cleanup.
 * Upstream shader gre/MIT, pinned to deeebdee7581cdfe924ed9cf104ea2fd10e63155.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';

const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'};
const server=createServer((request,response)=>{
 const path=resolve(root,'.'+new URL(request.url,'http://localhost').pathname);
 if(!path.startsWith(root+'/')||!existsSync(path)){response.writeHead(404);response.end('missing');return}
 response.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});
 response.end(readFileSync(path));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome unavailable');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
  const w=240,h=144;
  const image=(kind,opacity=1)=>{
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d');ctx.globalAlpha=opacity;
   if(kind==='background') {ctx.fillStyle='#1ebd40';ctx.fillRect(0,0,w,h);return canvas;}
   const gradient=kind==='A'?ctx.createLinearGradient(0,0,w,0):ctx.createLinearGradient(0,0,0,h);
   gradient.addColorStop(0,kind==='A'?'#ddd7f4':'#fb7f31');
   gradient.addColorStop(.5,kind==='A'?'#8f2c89':'#f2edca');
   gradient.addColorStop(1,kind==='A'?'#2fd8ff':'#a61928');
   ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
   ctx.fillStyle=kind==='A'?'#17142c':'#132434';
   for(let x=0;x<w;x+=25){ctx.fillRect(x,0,8,h);}
   ctx.fillStyle=kind==='A'?'#fff':'#ffed80';ctx.font='bold 32px sans-serif';
   ctx.fillText(kind==='A'?'FROM':'TO',40,h/2);
   ctx.strokeStyle='#fff';ctx.lineWidth=3;
   ctx.beginPath();ctx.arc(186,72,28,0,Math.PI*2);ctx.stroke();
   return canvas;
  };
  const output=document.createElement('canvas');output.width=w;output.height=h;
  const renderErrors=[];
  const engine=new AdvancedMediaEngine({canvas:output,mediaBin:document.createElement('div'),
    onRenderError:e=>renderErrors.push(String(e))});
  engine.outputWidth=w;engine.outputHeight=h;
  const a={id:'a',type:'video',sourceName:'from',start:0,clipDuration:2,order:2,
    visible:true,opacity:1,blendMode:'source-over',media:image('A')};
  const b={id:'b',type:'video',sourceName:'to',start:1,clipDuration:2,order:1,
    visible:true,opacity:1,blendMode:'source-over',media:image('B'),
    transitionFromId:'a',transitionEffectId:'hologram',
    visualTransitions:{enter:{duration:1,curve:'linear'},exit:{duration:0,curve:'linear'}}};
  engine.tracks=[a,b];
  const render=(progress,settings={})=>{
   b.transitionParameters={hologram:settings};
   engine.currentTime=1+progress;engine.renderFrame();
   const pixels=new Uint8ClampedArray(output.getContext('2d').getImageData(0,0,w,h).data);
   let hash=2166136261>>>0,red=0,green=0,blue=0;
   for(let i=0;i<pixels.length;i+=4){
    hash=Math.imul(hash^pixels[i],16777619)>>>0;
    hash=Math.imul(hash^pixels[i+1],16777619)>>>0;
    hash=Math.imul(hash^pixels[i+2],16777619)>>>0;
    red+=pixels[i];green+=pixels[i+1];blue+=pixels[i+2];
   }
   return {hash,red:red/(w*h),green:green/(w*h),blue:blue/(w*h),
    middle:Array.from(pixels.slice(((h/2|0)*w+(w/2|0))*4,((h/2|0)*w+(w/2|0))*4+4))};
  };
  const samples=[0,.25,.45,.5,.55,.75,1].map(p=>({progress:p,...render(p)}));
  const exact=render(.5),repeat=render(.5),earlier=render(.2),again=render(.5);
  const controls={};
  const options=[
   ['tint',{tint:'#ff3131'}],['background',{background:'#40e900'}],
   ['backgroundAlpha',{backgroundAlpha:0}],['scanlines',{scanlines:25}],
   ['jitter',{jitter:.2}],['flicker',{flicker:0}]
  ];
  for(const [key,value] of options)controls[key]=render(.5,value);
  const screenshot=(()=>{
    render(.5);
    return output.toDataURL('image/png');
  })();
  const baseline=render(.5);
  const background={id:'bg',type:'video',sourceName:'bg',start:0,clipDuration:4,
    order:3,visible:true,opacity:1,blendMode:'source-over',media:image('background')};
  a.opacity=.5;b.opacity=.5;
  engine.tracks=[background,a,b];
  const alpha=render(.5);
  a.visible=false;
  const hidden=render(.5);
  engine.clearAll();
  return {samples,controls,baseline,screenshot,deterministic:exact.hash===repeat.hash
    &&repeat.hash===again.hash,
    earlyHash:earlier.hash,alpha,hidden,
    released:engine.hologramWebGL===null&&engine.hologramFromScratch===null
       &&engine.hologramToScratch===null,errors:renderErrors};
 });
 const values=result.samples,mid=values.find(x=>x.progress===.5);
 console.log('[Hologram #02 QA diagnostic]',JSON.stringify({
   samples:values.map(v=>({progress:v.progress,red:v.red,green:v.green,blue:v.blue,hash:v.hash})),
   controls:Object.fromEntries(Object.entries(result.controls)
     .map(([key,frame])=>[key,{hash:frame.hash,red:frame.red,green:frame.green,blue:frame.blue}])),
   errors:result.errors,released:result.released,
   alpha:result.alpha.hash,hidden:result.hidden.hash
 }));
 console.log('[Hologram #02 visual PNG] '+result.screenshot);
 assert.notEqual(values[0].hash,values.at(-1).hash,'A/B endpoints should have distinct images');
 assert.notEqual(mid.hash,values[0].hash,'Midtransition must not be static outgoing footage');
 assert.notEqual(mid.hash,values.at(-1).hash,'Midtransition must not be static incoming footage');
 assert.ok(mid.blue>mid.red*1.05,
    'Original blue hologram tint must dominate mid-transition, not a generic slide');
 assert.notEqual(values.find(x=>x.progress===.45).hash,
   values.find(x=>x.progress===.55).hash,
   'Original shader must have temporal source breakup and moving scanlines');
 for(const [name,frame] of Object.entries(result.controls)){
  assert.notEqual(frame.hash,result.baseline.hash,
   'Original Hologram uniform '+name+' must change the real pixels');
 }
 assert.equal(result.deterministic,true,'Reverse scrubbing must reproduce identical shader pixels');
 assert.notEqual(result.alpha.hash,result.hidden.hash,
   'Invisible outgoing source must not reappear during GL rendering');
 assert.equal(result.released,true,'Project reset must release WebGL and scratch surfaces');
 assert.deepEqual(result.errors,[],'Hologram browser rendering must report no errors');
 assert.deepEqual(errors,[],'No uncaught Chrome errors');
 console.log('[Hologram #02] PASS original GLSL: distinct endpoints, animated scanline/row breakup,'
   +' blue luminance tint, all native uniform controls, deterministic scrubbing, alpha/visibility and GPU cleanup');
 console.log('[Hologram #02 visual PNG] '+result.screenshot);
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
