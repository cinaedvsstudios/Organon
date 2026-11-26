/** MotoriClip #66: real Chrome video compositor and native Noir Glitch Inspector proof. */
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
assert.ok(chrome,'Chromium is mandatory for independent Noir Glitch visual qualification');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const proof=await page.evaluate(async()=>{
  const [{AdvancedMediaEngine},{normaliseTimelineEffect,requiresCompositeSource},{buildNoirGlitchFrame}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),import('../js/timeline-effects.mjs'),
   import('../js/timeline-noir-glitch.mjs')
  ]);
  const W=320,H=180,scene=document.createElement('canvas');scene.width=W;scene.height=H;
  const sourceCtx=scene.getContext('2d');
  sourceCtx.fillStyle='#333333';sourceCtx.fillRect(0,0,W,H);
  for(let y=0;y<H;y+=15)for(let x=0;x<W;x+=15){
   sourceCtx.fillStyle=((x+y)/15)%2?'#e2b45f':'#203f66';sourceCtx.fillRect(x,y,14,14);
  }
  sourceCtx.fillStyle='#eeeeee';sourceCtx.fillRect(18,18,283,62);sourceCtx.fillStyle='#fff';sourceCtx.beginPath();sourceCtx.arc(240,120,15,0,Math.PI*2);sourceCtx.fill();
  sourceCtx.fillStyle='#222222';sourceCtx.font='bold 29px sans-serif';
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
  const effect=normaliseTimelineEffect({presetId:'noir-glitch',intensity:97,speed:1.1,
   distortion:95,density:85,scale:100,direction:25,
   noirContrast:65,noirGrain:65,noirWeave:90,noirShutter:80,noirScratches:75,noirVignette:60,noirSeed:1946});
  overlay.effectOverlay=effect;engine.tracks=[video,overlay];
  const times=[.14,.18,.48,1.0],samples=times.map(frame);
  const exact=frame(.18).every((v,i)=>v===samples[1][i]);
  frame(.18);const png=canvas.toDataURL('image/png');
  frame(.48);const nextPng=canvas.toDataURL('image/png');
  let changed=0,alphaChanged=0,strong=0,monoPixels=0,unchanged=0,brightened=0,darkened=0,rows=new Set(),cols=new Set();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4,d=Math.abs(samples[1][i]-baseline[i])
    +Math.abs(samples[1][i+1]-baseline[i+1])+Math.abs(samples[1][i+2]-baseline[i+2]);
   if(d>35){changed++;rows.add(y);cols.add(x);}
   if(d>140)strong++;
   if(Math.abs(baseline[i]-baseline[i+2])>45&&Math.abs(samples[1][i]-samples[1][i+2])<12)monoPixels++;
   if(d===0)unchanged++;
   const sum=(a)=>a[i]+a[i+1]+a[i+2];
   if(sum(samples[1])>sum(baseline)+10)brightened++;
   if(sum(samples[2])<sum(baseline)-10)darkened++;
   if(samples[1][i+3]!==baseline[i+3])alphaChanged++;
  }
  const variants={};
  for(const [key,setting] of Object.entries({
   contrast:{noirContrast:0},grain:{noirGrain:0},weave:{noirWeave:0},shutter:{noirShutter:0},scratches:{noirScratches:0},vignette:{noirVignette:0},seed:{noirSeed:42},density:{density:12},scale:{scale:180},direction:{direction:100},distortion:{distortion:20},speed:{speed:2.8},strength:{intensity:30}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...setting});
   variants[key]=hash(frame(.18));
  }
  overlay.visible=false;const hidden=hash(frame(.18));
  const sourcePixels=sourceCtx.getImageData(0,0,W,H);
  const sameAlpha=buildNoirGlitchFrame(sourcePixels,W,H,effect,.4*effect.speed).data;
  const sourceAlpha=Array.from({length:W*H},(_,i)=>sameAlpha[i*4+3])
   .every((a,i)=>a===sourcePixels.data[i*4+3]);
  const swingAngle=0,pivotX=0,pivotY=0;
  const colourDetails=new Set();for(let i=0;i<samples[1].length;i+=4)
   colourDetails.add((samples[1][i]<<16)|(samples[1][i+1]<<8)|samples[1][i+2]);
  engine.clearAll();
  return {png,nextPng,baseline:hash(baseline),hidden,hashes:samples.map(hash),
   changed,monoPixels,unchanged,brightened,darkened,changedRows:rows.size,changedCols:cols.size,strong,alphaChanged,
   exact,sourceAware:requiresCompositeSource('noir-glitch'),sourceAlpha,swingAngle,pivotX,pivotY,sourceColours:colourDetails.size,variants,renderErrors};
 });
 console.log('[MotoriClip #66 Noir Glitch real Chrome PNG] '+proof.png);
 console.log('[MotoriClip #66 alternate time Chrome PNG] '+proof.nextPng);
 console.log('[MotoriClip #66 Noir Glitch Chrome metrics] '+JSON.stringify(
  Object.fromEntries(Object.entries(proof).filter(([k])=>!['png','nextPng'].includes(k)))));
 assert.deepEqual(pageErrors,[]);
 assert.deepEqual(proof.renderErrors,[]);
 assert.equal(proof.sourceAware,true);
 assert.ok(proof.changed>90,'Monochrome film interference must change real source RGB pixels');
 assert.ok(proof.sourceColours>50,'Monochrome film interference keeps the recognisable source image, not an opaque geometric placeholder');
 assert.ok(proof.changedRows>20&&proof.changedCols>20,'Monochrome film interference must reach multiple rows and columns');
 assert.ok(proof.monoPixels>1000,'Film response must remove source colour');
 assert.equal(proof.alphaChanged,0);
 assert.equal(proof.sourceAlpha,true);
 assert.equal(proof.exact,true);
 assert.equal(new Set(proof.hashes).size,4,'Noir Glitch must change over absolute time without frame counters');
 assert.equal(proof.hidden,proof.baseline,'Hiding Noir Glitch restores unmodified source');
 assert.ok(proof.strong>100,'Film interference must visibly affect source detail');
 for(const [key,hashValue] of Object.entries(proof.variants))
  assert.notEqual(hashValue,proof.hashes[1],key+' must change actual video pixels');
 console.log('[MotoriClip #66 Chrome compositor] PASS');
 const editor=await browser.newPage({viewport:{width:1450,height:900}}),crashes=[];
 editor.on('pageerror',e=>crashes.push(String(e)));
 await editor.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 await editor.locator('[data-library-tab="effects"]').click();
 await editor.locator('#effects-library-grid [data-preset-id="noir-glitch"]').click();
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().waitFor({timeout:12000});
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await editor.locator('#effect-noir-glitch-controls').isVisible(),true);
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
 assert.equal(await editor.locator('#effect-color-control').isVisible(),false);
 for(const name of ['glow','blur'])
  assert.equal(await editor.locator('#effect-'+name+'-control').isVisible(),false);
 for(const name of ['density','scale','direction','distortion']) assert.equal(await editor.locator('#effect-'+name+(name==='origin-controls'?'':'-control')).isVisible(),true);
 const bpm=editor.locator('#effect-noir-grain');
 await bpm.fill('75');await bpm.dispatchEvent('input');
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await bpm.inputValue(),'75');
 assert.deepEqual(crashes,[]);
 console.log('[MotoriClip #66 native Inspector] PASS');
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
