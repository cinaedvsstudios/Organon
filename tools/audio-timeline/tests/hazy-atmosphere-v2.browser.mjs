/**
 * #49 Real Chrome visual acceptance: actual video-composited atmospheric fog
 * must be spatially irregular, translucent, evolving and deterministic.
 * Reports captured source PNG for direct human visual review.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';

const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'};
const server=createServer((req,res)=>{
 const f=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!f.startsWith(root+'/')||!existsSync(f)){res.writeHead(404);res.end('missing');return;}
 res.writeHead(200,{'Content-Type':mime[extname(f)]||'application/octet-stream'});
 res.end(readFileSync(f));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Real Chrome required');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
  const {normaliseTimelineEffect}=await import('../js/timeline-effects.mjs');
  const {buildHazyAtmosphereFrame}=await import('../js/timeline-hazy-atmosphere.mjs');
  const W=320,H=180;
  const make=scene=>{
   const c=document.createElement('canvas');c.width=W;c.height=H;
   const ctx=c.getContext('2d');
   if(scene){
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#06142a');sky.addColorStop(1,'#151d31');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#53647a';
    for(let i=0;i<14;i++)ctx.fillRect(i*25,89+(i%4)*10,22,91);
    ctx.fillStyle='#eed09e';ctx.font='bold 21px sans-serif';
    ctx.fillText('SOURCE IMAGE',70,68);
    ctx.fillStyle='#bd7856';ctx.fillRect(0,H-10,W,10);
   }
   return c;
  };
  const base={id:'video',type:'video',sourceName:'source.png',file:{name:'source.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',
   media:make(true),order:2};
  const overlay={id:'haze',type:'sticker',sourceName:'empty.png',file:{name:'empty.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',
   media:make(false),order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({
   canvas,mediaBin:document.createElement('div'),
   onRenderError:error=>renderErrors.push(String(error))
  });
  engine.outputWidth=W;engine.outputHeight=H;
  const pixels=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=data=>{
   let h=2166136261>>>0;
   for(const v of data)h=Math.imul(h^v,16777619)>>>0;
   return h;
  };
  const render=t=>{engine.currentTime=t;engine.renderFrame();return pixels();};
  engine.tracks=[base];const underlying=render(.65);
  const effect=normaliseTimelineEffect({presetId:'hazy-atmosphere',
   intensity:94,speed:1.2,density:93,scale:117,direction:26,distortion:83,
   blur:36,glow:72,originX:42,originY:22,color:'#d5e2f3'});
  overlay.effectOverlay=effect;engine.tracks=[base,overlay];
  const samples=[.12,.65,1.38,2.42].map(t=>({t,rgba:render(t)}));
  render(.65);
  const screenshot=canvas.toDataURL('image/png');
  const rewind=render(.65).every((v,i)=>v===samples[1].rgba[i]);
  const changed=[0,0,0,0],differences=[];
  let changedCount=0,maxDifference=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4;
   const diff=Math.abs(samples[1].rgba[i]-underlying[i])
     +Math.abs(samples[1].rgba[i+1]-underlying[i+1])
     +Math.abs(samples[1].rgba[i+2]-underlying[i+2]);
   if(diff>12){changed[(x>=W/2?1:0)+(y>=H/2?2:0)]++;changedCount++;}
   if(diff>maxDifference)maxDifference=diff;
   differences.push(diff);
  }
  const original=hash(render(.65)),variants={};
  for(const [name,delta] of Object.entries({
   sparse:{density:10},wind:{direction:-95},turbulence:{distortion:0},
   color:{color:'#eec0ac'},blur:{blur:0},origin:{originY:75}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...delta});
   variants[name]=hash(render(.65));
  }
  overlay.effectOverlay=effect;overlay.visible=false;
  const hidden=hash(render(.65));overlay.visible=true;
  const clouds=buildHazyAtmosphereFrame(96,54,effect,.65*effect.speed);
  const transparency=[...clouds.data].filter((_,i)=>i%4===3);
  engine.clearAll();
  return {changed,changedCount,maxDifference,
   baseline:hash(underlying),original,hidden,variants,rewind,
   hashes:samples.map(sample=>hash(sample.rgba)),
   transparentPixels:transparency.filter(a=>a<30).length,
   visibleFogPixels:transparency.filter(a=>a>30).length,
   peakAlpha:Math.max(...transparency),
   screenshot,renderErrors};
 });
 assert.ok(result.changedCount>500,
  'Real fog must change hundreds of the source image pixels: '+result.changedCount);
 assert.ok(result.changed.filter(n=>n>20).length>=3,
  'Fog must billow across multiple independent regions rather than a single moving strip: '+result.changed);
 assert.ok(result.transparentPixels>100,'Fog includes near-clear air and irregular edges');
 assert.ok(result.visibleFogPixels>200,'Fog has many opaque-enough soft billows');
 assert.ok(result.peakAlpha<240,'Fog is transparent rather than an opaque haze card');
 assert.equal(new Set(result.hashes).size,4,'Cloud detail/density must evolve at four independent times');
 assert.equal(result.rewind,true,'Backwards seeking must reproduce byte-exact pixels');
 for(const [name,hash] of Object.entries(result.variants))
  assert.notEqual(hash,result.original,'Inspector '+name+' must change actual browser pixels');
 assert.equal(result.hidden,result.baseline,'Hidden fog must not affect source media');
 assert.deepEqual(result.renderErrors,[]);
 assert.deepEqual(errors,[]);
 console.log('[MotoriClip #49 Hazy Atmosphere visual PNG] '+result.screenshot);
 console.log('[MotoriClip #49 Hazy Atmosphere real Chrome] PASS '+JSON.stringify(
  Object.fromEntries(Object.entries(result).filter(([key])=>key!=='screenshot'))));
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
