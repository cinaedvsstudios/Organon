/**
 * MotoriClip #53 real Chrome acceptance: preview pixels from a true
 * source-composited analog TV/Retro Glitch, plus a captured PNG.
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
assert.ok(chrome,'Real Chrome required for visual acceptance');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
  const {normaliseTimelineEffect}=await import('../js/timeline-effects.mjs');
  const {retroGlitchFrameState}=await import('../js/timeline-retro-glitch.mjs');
  const W=320,H=180,make=scene=>{
   const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');
   if(scene){
    const sky=ctx.createLinearGradient(0,0,W,H);
    sky.addColorStop(0,'#132a43');sky.addColorStop(1,'#516a83');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    for(let i=0;i<12;i++){
     ctx.fillStyle=i%2?'#9facbe':'#d9e3f0';
     ctx.fillRect(i*29,80+(i%3)*8,17,100);
     ctx.fillStyle='#1b263a';ctx.fillRect(i*29+3,102,4,65);
    }
    ctx.fillStyle='#ffd38e';ctx.fillRect(0,156,W,4);
    ctx.fillStyle='#fff5eb';ctx.font='bold 24px sans-serif';
    ctx.fillText('SOURCE IMAGE',65,50);
   }
   return c;
  };
  const video={id:'video',type:'video',file:{name:'city.png'},sourceName:'city.png',
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:make(true),order:2};
  const overlay={id:'retro',type:'sticker',file:{name:'transparent.png'},
   sourceName:'transparent.png',start:0,clipDuration:3,visible:true,
   opacity:1,blendMode:'source-over',media:make(false),order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({
   canvas,mediaBin:document.createElement('div'),
   onRenderError:e=>renderErrors.push(String(e))
  });
  engine.outputWidth=W;engine.outputHeight=H;
  const pixels=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=values=>{let h=2166136261>>>0;for(const v of values)h=Math.imul(h^v,16777619)>>>0;return h;};
  const render=t=>{engine.currentTime=t;engine.renderFrame();return pixels();};
  engine.tracks=[video];const baseline=render(.65);
  const effect=normaliseTimelineEffect({presetId:'retro-glitch',
   intensity:94,speed:1.4,density:91,distortion:82,scale:108,
   direction:24,glow:65,originX:20,originY:12,color:'#b8d5ea'});
  overlay.effectOverlay=effect;engine.tracks=[video,overlay];
  const times=[.12,.36,.65,1.31],samples=times.map(t=>render(t));
  render(.65);const screenshot=canvas.toDataURL('image/png');
  const rewind=render(.65).every((x,i)=>x===samples[2][i]);
  const zones=[0,0,0,0];let changed=0,snowPixels=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4;
   const d=Math.abs(samples[2][i]-baseline[i])+
    Math.abs(samples[2][i+1]-baseline[i+1])+
    Math.abs(samples[2][i+2]-baseline[i+2]);
   if(d>22){zones[(x>=W/2?1:0)+(y>=H/2?2:0)]++;changed++;}
   if(d>65)snowPixels++;
  }
  // Pixel diversity on a nearly uniform sky row shows new independent
  // snow pixels (not only a translated card/whole-row brightness change).
  const row=new Set();
  for(let x=15;x<300;x++)row.add(samples[2][(19*W+x)*4]);
  const original=hash(render(.65)),variants={};
  for(const [name,part] of Object.entries({
   snow:{density:10},analog:{distortion:6},speed:{speed:2.5},
   scan:{scale:210},direction:{direction:-89},
   tint:{color:'#fa90cf'},bleed:{glow:0},
   vertical:{originY:85},horizontal:{originX:77}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...part});
   variants[name]=hash(render(.65));
  }
  overlay.effectOverlay=effect;overlay.visible=false;
  const hidden=hash(render(.65));
  const states=times.map(t=>retroGlitchFrameState(W,H,effect,t*effect.speed));
  engine.clearAll();
  return {screenshot,changed,snowPixels,zones,pixelDiversity:row.size,
   hashes:samples.map(hash),original,baseline:hash(baseline),variants,hidden,
   rewind,activeTears:states.map(s=>s.bands.filter(b=>b.active).length),
   bandXPaths:states.map(s=>s.bands.map(b=>Math.round(b.y))),
   channelOffsets:states.map(s=>[s.redOffset,s.blueOffset]),
   renderErrors};
 });
 assert.ok(result.changed>12500,'CRT interference must distort thousands of real footage pixels');
 assert.ok(result.zones.every(v=>v>1000),'Source noise must spread through all four frame quadrants');
 assert.ok(result.pixelDiversity>70,'Independent snow pixels needed within the same uniform source row');
 assert.ok(result.snowPixels>5000,'Noise levels must create visible old-TV snow and not just thin scanlines');
 assert.equal(new Set(result.hashes).size,4,'Each absolute time must produce genuinely changed CRT interference');
 assert.ok(result.activeTears.every(n=>n>=2),'Several independently alive tear bands required');
 assert.notDeepEqual(result.bandXPaths[0],result.bandXPaths[3],'Tear windows must move in time');
 assert.ok(result.channelOffsets.some(([r,b])=>Math.abs(r-b)>.5),'R and B channels must separate');
 assert.equal(result.rewind,true,'Rewind must regenerate exactly the same frame pixels');
 for(const [name,val] of Object.entries(result.variants))
  assert.notEqual(val,result.original,'Inspector '+name+' must change actual output pixel values');
 assert.equal(result.hidden,result.baseline,'Hiding effect returns untouched underlying source');
 assert.deepEqual(result.renderErrors,[]);
 assert.deepEqual(errors,[]);
 console.log('[MotoriClip #53 Retro Glitch visual PNG] '+result.screenshot);
 console.log('[MotoriClip #53 Retro Glitch real Chrome] PASS '+JSON.stringify(
  Object.fromEntries(Object.entries(result).filter(([key])=>key!=='screenshot'))));
}finally{await browser.close();await new Promise(done=>server.close(done));}
