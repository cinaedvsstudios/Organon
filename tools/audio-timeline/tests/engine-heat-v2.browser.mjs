/**
 * #52 real Chrome two-axis refractive heat shimmer acceptance.
 * Uses a rectilinear source scene: displacement must bend video geometry,
 * not add obvious bars/tendrils. Emits PNG for human visual inspection.
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
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
  const {normaliseTimelineEffect}=await import('../js/timeline-effects.mjs');
  const {sampleEngineHeatDisplacement}=await import('../js/timeline-engine-heat.mjs');
  const W=320,H=180,make=scene=>{
   const c=document.createElement('canvas');c.width=W;c.height=H;
   const g=c.getContext('2d');
   if(scene){
    const bg=g.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,'#122942');bg.addColorStop(1,'#091827');
    g.fillStyle=bg;g.fillRect(0,0,W,H);
    for(let x=18;x<W;x+=32){
     g.fillStyle=(x/32)%2?'#9eb5c6':'#758da4';
     g.fillRect(x,52,13,H-52);
     g.fillStyle='#dceeff';g.fillRect(x+5,52,2,H-52);
    }
    g.strokeStyle='#ffd799';g.lineWidth=3;
    g.beginPath();g.moveTo(0,145);g.lineTo(W,145);g.stroke();
    g.fillStyle='#f3f5f8';g.font='bold 18px sans-serif';
    g.fillText('STRAIGHT SOURCE',66,32);
   }
   return c;
  };
  const video={id:'video',type:'video',file:{name:'source.png'},sourceName:'source.png',
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',
   media:make(true),order:2};
  const overlay={id:'engine',type:'sticker',file:{name:'clear.png'},sourceName:'clear.png',
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',
   media:make(false),order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({
   canvas,mediaBin:document.createElement('div'),onRenderError:e=>renderErrors.push(String(e))
  });
  engine.outputWidth=W;engine.outputHeight=H;
  const bytes=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=a=>{let h=2166136261>>>0;for(const v of a)h=Math.imul(h^v,16777619)>>>0;return h;};
  const render=t=>{engine.currentTime=t;engine.renderFrame();return bytes();};
  engine.tracks=[video];const baseline=render(.65);
  const effect=normaliseTimelineEffect({presetId:'engine-heat',intensity:94,
   speed:1.26,density:88,scale:128,direction:27,distortion:94,blur:35,
   glow:42,originX:20,originY:12,color:'#ffc280'});
  overlay.effectOverlay=effect;engine.tracks=[video,overlay];
  const times=[.15,.65,1.38,2.36];
  const frames=times.map(t=>render(t)),current=frames[1];
  render(.65);const screenshot=canvas.toDataURL('image/png');
  const rewind=render(.65).every((x,i)=>x===current[i]);
  const zones=[0,0,0,0];let topChanged=0,bottomChanged=0,intermediate=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const k=(y*W+x)*4,delta=Math.abs(current[k]-baseline[k])+
    Math.abs(current[k+1]-baseline[k+1])+Math.abs(current[k+2]-baseline[k+2]);
   if(delta>8){
    if(y<42)topChanged++;
    if(y>110)bottomChanged++;
    else intermediate++;
    zones[(x>=W/2?1:0)+(y>=H/2?2:0)]++;
   }
  }
  const initial=hash(render(.65)),variants={};
  for(const [name,part] of Object.entries({
   density:{density:12},direction:{direction:-86},strength:{distortion:5},
   blur:{blur:0},glow:{glow:0},origin:{originX:78,originY:66},
   size:{scale:185},tint:{color:'#78d9fa'}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...part});
   variants[name]=hash(render(.65));
  }
  overlay.effectOverlay=effect;overlay.visible=false;
  const hidden=hash(render(.65));
  const upper=sampleEngineHeatDisplacement(160,9,W,H,effect,.65*effect.speed);
  const lower=sampleEngineHeatDisplacement(160,164,W,H,effect,.65*effect.speed);
  engine.clearAll();
  return {screenshot,zones,topChanged,bottomChanged,intermediate,
   hashes:frames.map(hash),original:initial,baseline:hash(baseline),
   variants,hidden,rewind,upper,lower,renderErrors};
 });
 assert.equal(result.topChanged,0,'Entire upper source picture must remain byte-identical without fake heat lines');
 assert.ok(result.bottomChanged>900,'Actual video geometry must refract across lower heat source');
 assert.ok(result.zones[2]>120&&result.zones[3]>120,'Shimmer must not be a single moving strip');
 assert.equal(result.upper.weight,0);
 assert.ok(result.lower.weight>.65&&Math.abs(result.lower.dx)>.3);
 assert.equal(new Set(result.hashes).size,4,'Heat turbulence must evolve every timestamp');
 assert.equal(result.rewind,true,'Backwards seeking must recreate byte-exact pixels');
 for(const [name,val] of Object.entries(result.variants))
  assert.notEqual(val,result.original,'Native '+name+' control must alter real source pixels');
 assert.equal(result.hidden,result.baseline,'Hidden heat leaves source video intact');
 assert.deepEqual(result.renderErrors,[]);
 assert.deepEqual(errors,[]);
 console.log('[MotoriClip #52 Engine Heat visual PNG] '+result.screenshot);
 console.log('[MotoriClip #52 Engine Heat real Chrome] PASS '+JSON.stringify(
  Object.fromEntries(Object.entries(result).filter(([key])=>key!=='screenshot'))));
}finally{await browser.close();await new Promise(done=>server.close(done));}
