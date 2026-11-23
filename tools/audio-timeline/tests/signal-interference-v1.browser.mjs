/** Actual Chrome acceptance: #60 source-aware analogue horizontal sync failure. */
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
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Real Chromium required for Signal Interference visual qualification');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),pageErrors=[];
 page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const proof=await page.evaluate(async()=>{
  const [{AdvancedMediaEngine},{normaliseTimelineEffect,requiresCompositeSource},{buildSignalInterferenceFrame}]=await Promise.all([
    import('../js/advanced-media-engine-v0.24.js'),import('../js/timeline-effects.mjs'),
    import('../js/timeline-signal-interference.mjs')
  ]);
  const W=320,H=180;
  const scene=document.createElement('canvas');scene.width=W;scene.height=H;
  const c=scene.getContext('2d');
  c.fillStyle='#11324d';c.fillRect(0,0,W,H);
  c.fillStyle='#f0d489';c.font='bold 27px sans-serif';c.fillText('SOURCE VIDEO',45,45);
  for(let x=0;x<W;x+=16){c.fillStyle=x%32?'#b3659d':'#37add1';c.fillRect(x,85,15,88);}
  c.fillStyle='#fafafa';c.fillRect(26,113,104,26);
  const source={id:'source',type:'video',sourceName:'example.png',file:{name:'example.png'},
    start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:scene,order:2};
  const overlay={id:'signal',type:'sticker',sourceName:'generated.png',
    file:{name:'generated.png'},start:0,clipDuration:3,visible:true,
    opacity:1,blendMode:'source-over',media:scene,order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const errors=[],engine=new AdvancedMediaEngine({canvas,mediaBin:document.createElement('div'),onRenderError:e=>errors.push(String(e))});
  engine.outputWidth=W;engine.outputHeight=H;
  const rgba=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=bytes=>{let n=2166136261>>>0;for(const b of bytes)n=Math.imul(n^b,16777619)>>>0;return n;};
  const frame=t=>{engine.currentTime=t;engine.renderFrame();return rgba();};
  engine.tracks=[source];const baseline=frame(.65);
  const effect=normaliseTimelineEffect({presetId:'signal-interference',intensity:95,
    density:94,distortion:86,signalLoss:90,colorBleed:96,rollRate:1.1,signalSeed:6060});
  overlay.effectOverlay=effect;engine.tracks=[source,overlay];
  const times=[.14,.65,1.36,2.15],frames=times.map(frame);
  const exact=frame(.65).every((v,i)=>v===frames[1][i]);
  frame(.65);const png=canvas.toDataURL('image/png');
  frame(1.36);const recoveryPng=canvas.toDataURL('image/png');
  let changed=0,rowsChanged=new Set(),alphaChanges=0,highDeviation=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4,d=Math.abs(frames[1][i]-baseline[i])
      +Math.abs(frames[1][i+1]-baseline[i+1])+Math.abs(frames[1][i+2]-baseline[i+2]);
   if(d>30){changed++;rowsChanged.add(y);}
   if(d>125)highDeviation++;
   if(frames[1][i+3]!==baseline[i+3])alphaChanges++;
  }
  const variants={};
  for(const [key,settings] of Object.entries({
   displacement:{distortion:5},density:{density:8},loss:{signalLoss:0},
   bleed:{colorBleed:0},rate:{rollRate:3},seed:{signalSeed:1234},
   strength:{intensity:25},speed:{speed:2}
  })){
    overlay.effectOverlay=normaliseTimelineEffect({...effect,...settings});
    variants[key]=hash(frame(.65));
  }
  overlay.visible=false;const hidden=hash(frame(.65));
  overlay.visible=true;overlay.effectOverlay=effect;
  const sourcePixels=c.getImageData(0,0,W,H),signal=buildSignalInterferenceFrame(sourcePixels,W,H,effect,.65);
  const resampleSource=requiresCompositeSource(effect.presetId);
  engine.clearAll();
  return {png,recoveryPng,sourceAware:resampleSource,hashes:frames.map(hash),baseline:hash(baseline),hidden,
    changed,highDeviation,changedRows:rowsChanged.size,alphaChanges,exact,variants,
    sampledAlpha:Array.from({length:W*H},(_,i)=>signal.data[i*4+3]).every((v,i)=>v===sourcePixels.data[i*4+3]),
    bandCount:signal.state.bands.filter(b=>b.active).length,errors};
 });
 console.log('[MotoriClip #60 Signal Interference real Chrome PNG] '+proof.png);
 console.log('[MotoriClip #60 recovered video Chrome PNG] '+proof.recoveryPng);
 console.log('[MotoriClip #60 Signal Interference Chrome metrics] '+JSON.stringify(
    Object.fromEntries(Object.entries(proof).filter(([name])=>!['png','recoveryPng'].includes(name)))));
 assert.deepEqual(pageErrors,[]);
 assert.deepEqual(proof.errors,[]);
 assert.equal(proof.sourceAware,true,'Must deform actual lower-layer video source');
 assert.ok(proof.changed>1000,'Real image video must display substantial rolling disruption');
 assert.ok(proof.highDeviation>100,'Interference must produce high-contrast dropout/displacement');
 assert.ok(proof.changedRows>20,'Multiple rows must be genuinely deformed');
 assert.equal(proof.alphaChanges,0,'Source-video alpha must remain intact in compositor');
 assert.equal(proof.sampledAlpha,true,'Sampler must not erase transparent source pixels');
 assert.equal(proof.exact,true,'Reverse seek must be exactly deterministic');
 assert.equal(new Set(proof.hashes).size,4,'Frames must visibly evolve independently over time');
 assert.equal(proof.hidden,proof.baseline,'Hiding the effect must restore clean video');
 assert.ok(proof.bandCount>=1,'At least one horizontal interference band must appear');
 for(const [name,v] of Object.entries(proof.variants))assert.notEqual(v,proof.hashes[1],name+' setting has no effect on real Chrome pixels');
 console.log('[MotoriClip #60 Chrome compositor] PASS');
 const editor=await browser.newPage({viewport:{width:1450,height:900}});
 const crashes=[];editor.on('pageerror',e=>crashes.push(String(e)));
 await editor.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 await editor.locator('[data-library-tab="effects"]').click();
 await editor.locator('#effects-library-grid [data-preset-id="signal-interference"]').click();
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().waitFor({timeout:12000});
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await editor.locator('#effect-signal-interference-controls').isVisible(),true);
 assert.equal(await editor.locator('#effect-tv-static-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-color-control').isVisible(),false);
 assert.equal(await editor.locator('#effect-scale-control').isVisible(),false);
 assert.equal(await editor.locator('#effect-distortion-control').isVisible(),true);
 const slider=editor.locator('#effect-signal-loss');
 await slider.fill('41');await slider.dispatchEvent('input');
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await slider.inputValue(),'41','Native Inspector must retain edited dropout settings');
 assert.deepEqual(crashes,[],'No uncaught errors wiring effect controls into the editor');
 console.log('[MotoriClip #60 native Inspector] PASS');
}finally{await browser.close();await new Promise(done=>server.close(done));}
