/** MotoriClip #62 — real-Chrome Data Burst source-aware visual and native Inspector QA. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'};
const server=createServer((request,response)=>{
 const file=resolve(root,'.'+new URL(request.url,'http://localhost').pathname);
 if(!file.startsWith(root+'/')||!existsSync(file)){response.writeHead(404);response.end('missing');return;}
 response.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
 response.end(readFileSync(file));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Real Chromium required for Data Burst visual qualification');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const proof=await page.evaluate(async()=>{
  const [{AdvancedMediaEngine},{normaliseTimelineEffect,requiresCompositeSource},{buildDataBurstFrame}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),import('../js/timeline-effects.mjs'),
   import('../js/timeline-data-burst.mjs')
  ]);
  const W=320,H=180,scene=document.createElement('canvas');scene.width=W;scene.height=H;
  const c=scene.getContext('2d');c.fillStyle='#16304d';c.fillRect(0,0,W,H);
  for(let y=0;y<H;y+=18)for(let x=0;x<W;x+=18){
   c.fillStyle=((x+y)/18)%2?'#d39369':'#39b9bf';c.fillRect(x,y,17,17);
  }
  c.fillStyle='#fff3d0';c.fillRect(15,15,290,57);
  c.fillStyle='#182b4d';c.font='bold 30px sans-serif';c.fillText('SOURCE VIDEO',24,53);
  const video={id:'video',type:'video',sourceName:'source.mp4',file:{name:'source.mp4'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:scene,order:2};
  const overlay={id:'burst',type:'sticker',sourceName:'generated.png',file:{name:'generated.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:scene,order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({canvas,mediaBin:document.createElement('div'),
   onRenderError:e=>renderErrors.push(String(e))});
  engine.outputWidth=W;engine.outputHeight=H;
  const read=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=arr=>{let n=2166136261>>>0;for(const b of arr)n=Math.imul(n^b,16777619)>>>0;return n;};
  const frame=t=>{engine.currentTime=t;engine.renderFrame();return read();};
  engine.tracks=[video];const baseline=frame(.65);
  const effect=normaliseTimelineEffect({presetId:'data-burst',intensity:95,speed:1.2,
   density:80,burstSize:65,burstLife:.34,burstCluster:85,burstChroma:98,burstSeed:6262});
  overlay.effectOverlay=effect;engine.tracks=[video,overlay];
  const times=[.23,.65,1.14,1.55],frames=times.map(frame);
  const exact=frame(.65).every((v,i)=>v===frames[1][i]);
  frame(.65);const png=canvas.toDataURL('image/png');
  frame(1.14);const secondPng=canvas.toDataURL('image/png');
  let altered=0,alphaChanged=0,extreme=0;
  const rows=new Set(),cols=new Set();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4,delta=Math.abs(frames[1][i]-baseline[i])
    +Math.abs(frames[1][i+1]-baseline[i+1])+Math.abs(frames[1][i+2]-baseline[i+2]);
   if(delta>30){altered++;rows.add(y);cols.add(x);}
   if(delta>140)extreme++;
   if(frames[1][i+3]!==baseline[i+3])alphaChanged++;
  }
  const variations={};
  for(const [key,value] of Object.entries({
   size:{burstSize:10},life:{burstLife:.5},cluster:{burstCluster:0},
   chroma:{burstChroma:20},density:{density:12},seed:{burstSeed:9876},
   speed:{speed:2.5},intensity:{intensity:25}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...value});
   variations[key]=hash(frame(.65));
  }
  overlay.visible=false;const hidden=hash(frame(.65));
  overlay.visible=true;overlay.effectOverlay=effect;
  const sample=buildDataBurstFrame(c.getImageData(0,0,W,H),W,H,effect,.65);
  const original=c.getImageData(0,0,W,H).data;
  const sampleAlpha=Array.from({length:W*H},(_,i)=>sample.data[i*4+3]).every((a,i)=>a===original[i*4+3]);
  engine.clearAll();
  return {png,secondPng,hashes:frames.map(hash),baseline:hash(baseline),hidden,altered,
   alteredRows:rows.size,alteredCols:cols.size,extreme,alphaChanged,exact,
   sourceAware:requiresCompositeSource('data-burst'),variations,sampleAlpha,
   blocks:sample.state.blocks.length,renderErrors};
 });
 console.log('[MotoriClip #62 Data Burst real Chrome PNG] '+proof.png);
 console.log('[MotoriClip #62 alternate packet state PNG] '+proof.secondPng);
 console.log('[MotoriClip #62 Data Burst Chrome metrics] '+JSON.stringify(
  Object.fromEntries(Object.entries(proof).filter(([k])=>!['png','secondPng'].includes(k)))));
 assert.deepEqual(errors,[]);
 assert.deepEqual(proof.renderErrors,[]);
 assert.equal(proof.sourceAware,true);
 assert.ok(proof.altered>80,'Real source RGB must show visible corruption');
 assert.ok(proof.altered<320*180*.5,'Localised digital bursts must leave a readable source scene');
 assert.ok(proof.alteredRows>15&&proof.alteredCols>25,'Independent packets should occupy varied image positions');
 assert.ok(proof.extreme>10,'Strong corrupt RGB packets must be visible, not cosmetic overlays');
 assert.equal(proof.alphaChanged,0,'Real video alpha stays intact');
 assert.equal(proof.sampleAlpha,true,'Pure pixel renderer retains source alpha');
 assert.equal(proof.exact,true,'Backwards seeking must reproduce exact pixels');
 assert.equal(new Set(proof.hashes).size,4,'Independent short pulses must evolve at each timestamp');
 assert.equal(proof.hidden,proof.baseline,'Hidden overlay yields clean video');
 for(const [k,v] of Object.entries(proof.variations))assert.notEqual(v,proof.hashes[1],k+' Inspector control must change rendered output');
 console.log('[MotoriClip #62 Chrome compositor] PASS');
 const editor=await browser.newPage({viewport:{width:1450,height:900}}),crashes=[];
 editor.on('pageerror',e=>crashes.push(String(e)));
 await editor.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 await editor.locator('[data-library-tab="effects"]').click();
 await editor.locator('#effects-library-grid [data-preset-id="data-burst"]').click();
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().waitFor({timeout:12000});
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await editor.locator('#effect-data-burst-controls').isVisible(),true);
 assert.equal(await editor.locator('#effect-crt-scanlines-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-signal-interference-controls').isVisible(),false);
 for(const name of ['color','scale','direction','distortion'])
  assert.equal(await editor.locator('#effect-'+name+'-control').isVisible(),false,name+' is irrelevant to Data Burst');
 assert.equal(await editor.locator('#effect-density-control').isVisible(),true);
 const control=editor.locator('#effect-burst-life');
 await control.fill('0.4');await control.dispatchEvent('input');
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await control.inputValue(),'0.4','Native packet life must survive Inspector reselect');
 assert.deepEqual(crashes,[]);
 console.log('[MotoriClip #62 native Inspector] PASS');
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
