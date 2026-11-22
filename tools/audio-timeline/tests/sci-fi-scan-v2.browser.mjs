/**
 * MotoriClip #50 — real Chrome screenshot and image-pixel acceptance for a
 * rapid scanning target, independent telemetry traffic and detection blips.
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
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
  const {normaliseTimelineEffect}=await import('../js/timeline-effects.mjs');
  const {buildSciFiScanFrame}=await import('../js/timeline-sci-fi-scan.mjs');
  const W=320,H=180;
  const make=background=>{
   const c=document.createElement('canvas');c.width=W;c.height=H;
   const g=c.getContext('2d');
   if(background){
    const grad=g.createLinearGradient(0,0,W,H);
    grad.addColorStop(0,'#06162a');grad.addColorStop(1,'#1d2542');
    g.fillStyle=grad;g.fillRect(0,0,W,H);
    g.fillStyle='#647b8a';
    for(let i=0;i<13;i++)g.fillRect(i*28,100+(i%3)*9,22,80);
    g.font='bold 21px sans-serif';g.fillStyle='#a3b7c5';g.fillText('SOURCE IMAGE',70,65);
   }
   return c;
  };
  const under={id:'video',type:'video',sourceName:'source.png',file:{name:'source.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:make(true),order:2};
  const overlay={id:'scan',type:'sticker',sourceName:'clear.png',file:{name:'clear.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:make(false),order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({
   canvas,mediaBin:document.createElement('div'),
   onRenderError:e=>renderErrors.push(String(e))
  });
  engine.outputWidth=W;engine.outputHeight=H;
  const bytes=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=data=>{
   let h=2166136261>>>0;
   for(const byte of data)h=Math.imul(h^byte,16777619)>>>0;
   return h;
  };
  const render=t=>{engine.currentTime=t;engine.renderFrame();return bytes();};
  engine.tracks=[under];const baseline=render(.65);
  const effect=normaliseTimelineEffect({presetId:'sci-fi-scan',
   intensity:96,speed:1.4,density:97,scale:112,direction:28,
   distortion:85,glow:82,originX:46,originY:19,color:'#67f3ff'});
  overlay.effectOverlay=effect;engine.tracks=[under,overlay];
  const samples=[.12,.3,.65,1.25].map(t=>({time:t,pixels:render(t)}));
  render(.65);const screenshot=canvas.toDataURL('image/png');
  const rewind=render(.65).every((v,i)=>v===samples[2].pixels[i]);
  const changed=[0,0,0,0];let changedCount=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4,delta=Math.abs(samples[2].pixels[i]-baseline[i])+
    Math.abs(samples[2].pixels[i+1]-baseline[i+1])+
    Math.abs(samples[2].pixels[i+2]-baseline[i+2]);
   if(delta>12){changed[(x>=W/2?1:0)+(y>=H/2?2:0)]++;changedCount++;}
  }
  const states=samples.map(s=>buildSciFiScanFrame(W,H,effect,s.time*effect.speed));
  const original=hash(render(.65)),variants={};
  for(const [name,delta] of Object.entries({
   sparse:{density:12},direction:{direction:-117},origin:{originX:8,originY:78},
   glow:{glow:0},distortion:{distortion:4},color:{color:'#ff7ca3'}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...delta});
   variants[name]=hash(render(.65));
  }
  overlay.effectOverlay=effect;overlay.visible=false;
  const hidden=hash(render(.65));
  engine.clearAll();
  return {changed,changedCount,original,baseline:hash(baseline),hidden,
   variants,rewind,hashes:samples.map(s=>hash(s.pixels)),
   targetYs:states.map(s=>s.targetY),
   segmentDirections:[...new Set(states[2].segments.map(s=>s.direction))],
   independentBars:states[1].segments.filter((s,i)=>
     Math.abs(s.x-states[2].segments[i].x)>3).length,
   activeBlips:states.map(f=>f.blips.filter(b=>b.alpha>.12).length),
   screenshot,renderErrors};
 });
 assert.ok(result.changedCount>400,'Real scanner must visibly change the source frame');
 assert.ok(result.changed.filter(v=>v>20).length>=3,
  'Fast scanner/telemetry should affect at least three separate scene quadrants');
 assert.equal(new Set(result.hashes).size,4,'Scanner image pixels must evolve at all four absolute times');
 assert.ok(Math.abs(result.targetYs[0]-result.targetYs[1])>18,
  'Actual target must travel rapidly vertically along beam');
 assert.deepEqual(result.segmentDirections.slice().sort((a,b)=>a-b),[-1,1]);
 assert.ok(result.independentBars>12,'Horizontal telemetry bars must race independently');
 assert.ok(result.activeBlips.some(n=>n>2),'Detection pulses must visibly appear');
 assert.equal(result.rewind,true,'Reverse seeking must restore byte-exact pixels');
 for(const [name,variant] of Object.entries(result.variants))
  assert.notEqual(variant,result.original,'Native '+name+' control must alter real pixels');
 assert.equal(result.hidden,result.baseline,'Hidden scanner must leave source image alone');
 assert.deepEqual(result.renderErrors,[]);
 assert.deepEqual(errors,[]);
 console.log('[MotoriClip #50 Sci-Fi Scan visual PNG] '+result.screenshot);
 console.log('[MotoriClip #50 Sci-Fi Scan real Chrome] PASS '+JSON.stringify(
  Object.fromEntries(Object.entries(result).filter(([key])=>key!=='screenshot'))));
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
