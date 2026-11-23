/** MotoriClip #66: real Chrome video compositor and native Fault Cassette Inspector proof. */
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
assert.ok(chrome,'Chromium is mandatory for independent Fault Cassette visual qualification');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const proof=await page.evaluate(async()=>{
  const [{AdvancedMediaEngine},{normaliseTimelineEffect,requiresCompositeSource},{buildFaultCassetteFrame,faultCassetteFrameState}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),import('../js/timeline-effects.mjs'),
   import('../js/timeline-fault-cassette.mjs')
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
  engine.tracks=[video];const baseline=frame(.65);
  const effect=normaliseTimelineEffect({presetId:'fault-cassette',intensity:97,speed:1.1,
   density:94,distortion:94,scale:125,direction:13,cassetteTracking:92,cassetteDropouts:90,cassetteChroma:95,cassetteRoll:72,cassetteSeed:6969,color:'#e3b593'});
  overlay.effectOverlay=effect;engine.tracks=[video,overlay];
  const times=[.18,.65,1.25,1.74],samples=times.map(frame);
  const exact=frame(.65).every((v,i)=>v===samples[1][i]);
  frame(.65);const png=canvas.toDataURL('image/png');
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
   tracking:{cassetteTracking:0},dropouts:{cassetteDropouts:0},chroma:{cassetteChroma:0},roll:{cassetteRoll:0},
   displacement:{distortion:25},frequency:{density:10},seed:{cassetteSeed:42},
   tapeSize:{scale:40},direction:{direction:-103},colour:{color:'#8dbdee'},
   speed:{speed:2.8},strength:{intensity:30}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...setting});
   variants[key]=hash(frame(.65));
  }
  overlay.visible=false;const hidden=hash(frame(.65));
  const sourcePixels=sourceCtx.getImageData(0,0,W,H);
  const sameAlpha=buildFaultCassetteFrame(sourcePixels,W,H,effect,.65).data;
  const sourceAlpha=Array.from({length:W*H},(_,i)=>sameAlpha[i*4+3])
   .every((a,i)=>a===sourcePixels.data[i*4+3]);
  const faultState=faultCassetteFrameState(W,H,effect,.65*effect.speed);
  const bandCount=faultState.bands.length,trackingY=faultState.trackingY;
  engine.clearAll();
  return {png,nextPng,baseline:hash(baseline),hidden,hashes:samples.map(hash),
   changed,changedRows:rows.size,changedCols:cols.size,strong,alphaChanged,
   exact,sourceAware:requiresCompositeSource('fault-cassette'),sourceAlpha,bandCount,trackingY,variants,renderErrors};
 });
 console.log('[MotoriClip #66 Fault Cassette real Chrome PNG] '+proof.png);
 console.log('[MotoriClip #66 alternate time Chrome PNG] '+proof.nextPng);
 console.log('[MotoriClip #66 Fault Cassette Chrome metrics] '+JSON.stringify(
  Object.fromEntries(Object.entries(proof).filter(([k])=>!['png','nextPng'].includes(k)))));
 assert.deepEqual(pageErrors,[]);
 assert.deepEqual(proof.renderErrors,[]);
 assert.equal(proof.sourceAware,true);
 assert.ok(proof.changed>100,'Tape tracking must change real underlying RGB source footage');
 assert.ok(proof.changed<320*180*.68,'Tape faults should preserve most of the underlying scene');
 assert.ok(proof.changedRows>12&&proof.changedCols>35,'Faults must change rows across the source image');
 assert.ok(proof.strong>40,'Tracking displacement must be more than invisible colour tint');
 assert.equal(proof.alphaChanged,0);
 assert.equal(proof.sourceAlpha,true);
 assert.equal(proof.exact,true);
 assert.equal(new Set(proof.hashes).size,4,'Time-dependent fragments must evolve without frame counters');
 assert.equal(proof.hidden,proof.baseline,'Hiding Fault Cassette restores unmodified source');
 assert.ok(proof.bandCount>=2&&proof.trackingY>0,'Independent tape breaks and rolling head-sync position must exist');
 for(const [key,hashValue] of Object.entries(proof.variants))
  assert.notEqual(hashValue,proof.hashes[1],key+' must change actual video pixels');
 console.log('[MotoriClip #66 Chrome compositor] PASS');
 const editor=await browser.newPage({viewport:{width:1450,height:900}}),crashes=[];
 editor.on('pageerror',e=>crashes.push(String(e)));
 await editor.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 await editor.locator('[data-library-tab="effects"]').click();
 await editor.locator('#effects-library-grid [data-preset-id="fault-cassette"]').click();
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().waitFor({timeout:12000});
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await editor.locator('#effect-fault-cassette-controls').isVisible(),true);
 assert.equal(await editor.locator('#effect-data-burst-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-line-corruption-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-signal-tear-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-rgb-block-glitch-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-signal-interference-controls').isVisible(),false);
 assert.equal(await editor.locator('#effect-color-control').isVisible(),true,'Primary static colour should be editable');
 for(const name of ['scale','direction'])
  assert.equal(await editor.locator('#effect-'+name+'-control').isVisible(),true,name+' should work for analogue tape distortion');
 assert.equal(await editor.locator('#effect-distortion-control').isVisible(),true);
 assert.equal(await editor.locator('#effect-density-control').isVisible(),true);
 const tape=editor.locator('#effect-cassette-tracking');
 await tape.fill('22');await tape.dispatchEvent('input');
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await tape.inputValue(),'22','Native head tracking value must persist across selection');
 assert.deepEqual(crashes,[]);
 console.log('[MotoriClip #66 native Inspector] PASS');
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
