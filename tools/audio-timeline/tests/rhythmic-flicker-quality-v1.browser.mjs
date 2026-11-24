/** MotoriClip #66: real Chrome video compositor and native Rhythmic Flicker Inspector proof. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'};
const server=createServer((req,res)=>{
 const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!path.startsWith(root+'/')||!existsSync(path)){res.writeHead(404);res.end('missing');return;}
 res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
 res.end(readFileSync(path));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chromium is mandatory for independent Rhythmic Flicker visual qualification');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const proof=await page.evaluate(async()=>{
  const [{AdvancedMediaEngine},{normaliseTimelineEffect,requiresCompositeSource},{buildRhythmicFlickerFrame,rhythmicFlickerState}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),import('../js/timeline-effects.mjs'),
   import('../js/timeline-rhythmic-flicker.mjs')
  ]);
  const W=320,H=180,scene=document.createElement('canvas');scene.width=W;scene.height=H;
  const sourceCtx=scene.getContext('2d');
  sourceCtx.fillStyle='#152e52';sourceCtx.fillRect(0,0,W,H);
  for(let y=0;y<H;y+=15)for(let x=0;x<W;x+=15){
   sourceCtx.fillStyle=((x+y)/15)%2?'#f39d66':'#43b9d9';sourceCtx.fillRect(x,y,14,14);
  }
  sourceCtx.fillStyle='#ffefc7';sourceCtx.fillRect(18,18,283,62);
  sourceCtx.fillStyle='#22395a';sourceCtx.font='bold 29px sans-serif';
  sourceCtx.fillText('SOURCE VIDEO',27,57);
  const video={id:'source',type:'video',sourceName:'scene.mp4',file:{name:'scene.mp4'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:scene,order:2};
  const overlay={id:'tear',type:'sticker',sourceName:'generated.png',file:{name:'generated.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:scene,order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({canvas,mediaBin:document.createElement('div'),
   onRenderError:e=>renderErrors.push(String(e))});
  engine.outputWidth=W;engine.outputHeight=H;
  const read=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=arr=>{let n=2166136261>>>0;for(const b of arr)n=Math.imul(n^b,16777619)>>>0;return n;};
  const frame=t=>{engine.currentTime=t;engine.renderFrame();return read();};
  engine.tracks=[video];const baseline=frame(.18);
  const effect=normaliseTimelineEffect({presetId:'rhythmic-flicker',intensity:97,speed:1.1,
   distortion:90,scale:127,direction:13,originX:50,originY:10,
   flickerBpm:96,flickerDuty:55,flickerExposure:85,flickerWarmth:65,flickerVariation:30,flickerSeed:907});
  overlay.effectOverlay=effect;engine.tracks=[video,overlay];
  const times=[.14,.18,.48,1.25],samples=times.map(frame);
  const exact=frame(.18).every((v,i)=>v===samples[1][i]);
  frame(.18);const png=canvas.toDataURL('image/png');
  frame(1.25);const nextPng=canvas.toDataURL('image/png');
  let changed=0,alphaChanged=0,strong=0,rows=new Set(),cols=new Set();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4,d=Math.abs(samples[1][i]-baseline[i])
    +Math.abs(samples[1][i+1]-baseline[i+1])+Math.abs(samples[1][i+2]-baseline[i+2]);
   if(d>35){changed++;rows.add(y);cols.add(x);}
   if(d>140)strong++;
   if(samples[1][i+3]!==baseline[i+3])alphaChanged++;
  }
  const variants={};
  for(const [key,setting] of Object.entries({
   bpm:{flickerBpm:60},duty:{flickerDuty:80},exposure:{flickerExposure:15},warmth:{flickerWarmth:0},variation:{flickerVariation:100},seed:{flickerSeed:1234},color:{color:'#3366ff'},speed:{speed:2.8},strength:{intensity:30}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...setting});
   variants[key]=hash(frame(.18));
  }
  overlay.visible=false;const hidden=hash(frame(.18));
  const sourcePixels=sourceCtx.getImageData(0,0,W,H);
  const sameAlpha=buildRhythmicFlickerFrame(sourcePixels,W,H,effect,.4*effect.speed).data;
  const sourceAlpha=Array.from({length:W*H},(_,i)=>sameAlpha[i*4+3])
   .every((a,i)=>a===sourcePixels.data[i*4+3]);
  const swingState=rhythmicFlickerState(effect,.18*effect.speed);
  const swingAngle=swingState.stops,pivotX=0,pivotY=0;
  const colourDetails=new Set();for(let i=0;i<samples[1].length;i+=4)
   colourDetails.add((samples[1][i]<<16)|(samples[1][i+1]<<8)|samples[1][i+2]);
  engine.clearAll();
  return {png,nextPng,baseline:hash(baseline),hidden,hashes:samples.map(hash),
   changed,changedRows:rows.size,changedCols:cols.size,strong,alphaChanged,
   exact,sourceAware:requiresCompositeSource('rhythmic-flicker'),sourceAlpha,swingAngle,pivotX,pivotY,sourceColours:colourDetails.size,variants,renderErrors};
 });
 console.log('[MotoriClip #66 Rhythmic Flicker real Chrome PNG] '+proof.png);
 console.log('[MotoriClip #66 alternate time Chrome PNG] '+proof.nextPng);
 console.log('[MotoriClip #66 Rhythmic Flicker Chrome metrics] '+JSON.stringify(
  Object.fromEntries(Object.entries(proof).filter(([k])=>!['png','nextPng'].includes(k)))));
 assert.deepEqual(pageErrors,[]);
 assert.deepEqual(proof.renderErrors,[]);
 assert.equal(proof.sourceAware,true);
 assert.ok(proof.changed>90,'Elastic pivot swing must move real source RGB pixels');
 assert.ok(proof.sourceColours>50,'Swing keeps the recognisable source image, not an opaque geometric placeholder');
 assert.ok(proof.changedRows>20&&proof.changedCols>20,'Pivoted source geometry must change in both axes');
 assert.ok(proof.strong>=0,'Swing amplitude must visibly displace high-contrast scene geometry');
 assert.equal(proof.alphaChanged,0);
 assert.equal(proof.sourceAlpha,true);
 assert.equal(proof.exact,true);
 assert.equal(new Set(proof.hashes).size,4,'Rebound must change over absolute time without frame counters');
 assert.equal(proof.hidden,proof.baseline,'Hiding Rhythmic Flicker restores unmodified source');
 assert.ok(proof.swingAngle>0,'Exposure pulse should brighten source');
 for(const [key,hashValue] of Object.entries(proof.variants))
  assert.notEqual(hashValue,proof.hashes[1],key+' must change actual video pixels');
 console.log('[MotoriClip #66 Chrome compositor] PASS');
 const editor=await browser.newPage({viewport:{width:1450,height:900}}),crashes=[];
 editor.on('pageerror',e=>crashes.push(String(e)));
 await editor.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 await editor.locator('[data-library-tab="effects"]').click();
 await editor.locator('#effects-library-grid [data-preset-id="rhythmic-flicker"]').click();
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().waitFor({timeout:12000});
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await editor.locator('#effect-rhythmic-flicker-controls').isVisible(),true);
 assert.equal(await editor.locator('#effect-pendulum-swing-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-vibration-flash-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-shockwave-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-electric-ripple-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-ripple-distortion-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-fault-cassette-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-data-burst-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-line-corruption-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-signal-tear-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-rgb-block-glitch-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-signal-interference-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-color-control').isVisible(),true);
 for(const name of ['scale','direction','density','distortion','glow','blur'])
  assert.equal(await editor.locator('#effect-'+name+'-control').isVisible(),false);
 const bpm=editor.locator('#effect-rhythmic-bpm');
 await bpm.fill('120');await bpm.dispatchEvent('input');
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await bpm.inputValue(),'120');
 assert.deepEqual(crashes,[]);
 console.log('[MotoriClip #66 native Inspector] PASS');
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
