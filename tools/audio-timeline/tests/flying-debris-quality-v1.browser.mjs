/** MotoriClip #66 quality audit: irregular faceted ballistic shards in Chrome + native Inspector. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'};
const server=createServer((req,res)=>{
 const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!p.startsWith(root+'/')||!existsSync(p)){res.writeHead(404);res.end('missing');return;}
 res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream','Cache-Control':'no-store'});
 res.end(readFileSync(p));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Installed real Chromium is required');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const proof=await page.evaluate(async()=>{
  const [{AdvancedMediaEngine},{normaliseTimelineEffect,requiresCompositeSource},{buildFlyingDebrisFrame}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),import('../js/timeline-effects.mjs'),
   import('../js/timeline-flying-debris.mjs')
  ]);
  const W=320,H=180,scene=document.createElement('canvas');scene.width=W;scene.height=H;
  const sourceCtx=scene.getContext('2d');
  sourceCtx.fillStyle='#0a1b32';sourceCtx.fillRect(0,0,W,H);
  for(let y=0;y<H;y+=18)for(let x=0;x<W;x+=18){
   sourceCtx.fillStyle=((x+y)/18)%2?'#203e61':'#153357';
   sourceCtx.fillRect(x,y,17,17);
  }
  sourceCtx.fillStyle='#39516f';sourceCtx.fillRect(12,12,296,62);
  sourceCtx.fillStyle='#d5e5ef';sourceCtx.font='bold 26px sans-serif';
  sourceCtx.fillText('DEBRIS SOURCE',28,52);
  const video={id:'source',type:'video',sourceName:'scene.mp4',file:{name:'scene.mp4'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:scene,order:2};
  const overlay={id:'debris',type:'sticker',sourceName:'generated.png',file:{name:'generated.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:scene,order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({canvas,mediaBin:document.createElement('div'),
   onRenderError:e=>renderErrors.push(String(e))});
  engine.outputWidth=W;engine.outputHeight=H;
  const pixels=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=arr=>{let n=2166136261>>>0;for(const b of arr)n=Math.imul(n^b,16777619)>>>0;return n;};
  const frame=t=>{engine.currentTime=t;engine.renderFrame();return pixels();};
  engine.tracks=[video];const baseline=frame(.72);
  const effect=normaliseTimelineEffect({presetId:'particle-debris',intensity:98,speed:1.15,
   density:94,scale:175,distortion:88,direction:24,color:'#b4bec9',
   originX:58,originY:48,debrisGravity:73,debrisTumble:90,debrisSpread:78,
   debrisLife:2.1,debrisSeed:6767});
  overlay.effectOverlay=effect;engine.tracks=[video,overlay];
  const times=[.18,.72,1.25,1.76],samples=times.map(frame);
  const exact=frame(.72).every((v,i)=>v===samples[1][i]);
  frame(.72);const png=canvas.toDataURL('image/png');
  frame(1.25);const nextPng=canvas.toDataURL('image/png');
  let changed=0,alphaChanged=0,strong=0,rows=new Set(),cols=new Set();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4,d=Math.abs(samples[1][i]-baseline[i])+
    Math.abs(samples[1][i+1]-baseline[i+1])+Math.abs(samples[1][i+2]-baseline[i+2]);
   if(d>35){changed++;rows.add(y);cols.add(x);}
   if(d>125)strong++;
   if(samples[1][i+3]!==baseline[i+3])alphaChanged++;
  }
  const variants={};
  for(const [key,setting] of Object.entries({
   density:{density:12},size:{scale:45},turbulence:{distortion:1},
   gravity:{debrisGravity:0},tumble:{debrisTumble:0},spread:{debrisSpread:0},
   lifetime:{debrisLife:3.8},seed:{debrisSeed:123},
   material:{color:'#f0aa69'},wind:{direction:-105},
   emitter:{originX:5,originY:7},speed:{speed:2.8},strength:{intensity:26}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...setting});
   variants[key]=hash(frame(.72));
  }
  overlay.visible=false;const hidden=hash(frame(.72));
  const state=buildFlyingDebrisFrame(W,H,effect,.72*effect.speed);
  engine.clearAll();
  return {png,nextPng,baseline:hash(baseline),hidden,hashes:samples.map(hash),
   changed,changedRows:rows.size,changedCols:cols.size,strong,alphaChanged,exact,
   sourceAware:requiresCompositeSource('particle-debris'),
   flying:state.pieces.length,faceted:state.pieces.filter(s=>s.facets>=2).length,
   irregular:state.pieces.filter(s=>s.polygon.length>=5).length,
   visible:state.pieces.filter(s=>s.x>=-s.radius&&s.x<W+s.radius&&s.y>=-s.radius&&s.y<H+s.radius).length,
   variants,renderErrors};
 });
 console.log('[MotoriClip #66 Flying Debris real Chrome PNG] '+proof.png);
 console.log('[MotoriClip #66 Flying Debris alternate time Chrome PNG] '+proof.nextPng);
 console.log('[MotoriClip #66 Flying Debris Chrome metrics] '+JSON.stringify(
  Object.fromEntries(Object.entries(proof).filter(([k])=>!['png','nextPng'].includes(k)))));
 assert.deepEqual(pageErrors,[]);assert.deepEqual(proof.renderErrors,[]);
 assert.equal(proof.sourceAware,false,'Debris is physical occlusion drawn over footage, not source-warp');
 assert.ok(proof.changed>100,'Faceted shards must visibly alter the source scene');
 assert.ok(proof.changed<320*180*.55,'Do not cover most of the frame with debris');
 assert.ok(proof.changedRows>12&&proof.changedCols>15,'Fragments must spread in two dimensions');
 assert.ok(proof.strong>12,'Opaque faceted fragments must have visible material contrast');
 assert.equal(proof.alphaChanged,0,'Solid source stays fully opaque with physical fragments');
 assert.equal(proof.exact,true);
 assert.equal(new Set(proof.hashes).size,4,'Different timestamps must show changed real image pixels');
 assert.equal(proof.hidden,proof.baseline,'Hiding debris restores the actual scene');
 assert.ok(proof.flying>25&&proof.visible>12&&proof.faceted>25&&proof.irregular>25,'Diverse faceted shards appear over footage');
 for(const [key,value] of Object.entries(proof.variants))
  assert.notEqual(value,proof.hashes[1],key+' must change rendered pixels');
 console.log('[MotoriClip #66 Flying Debris real Chrome] PASS');
 const editor=await browser.newPage({viewport:{width:1450,height:900}}),errors=[];
 editor.on('pageerror',e=>errors.push(String(e)));
 await editor.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 await editor.locator('[data-library-tab="effects"]').click();
 await editor.locator('#effects-library-grid [data-preset-id="particle-debris"]').click();
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().waitFor({timeout:12000});
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await editor.locator('#effect-flying-debris-controls').isVisible(),true);
 assert.equal(await editor.locator('#effect-electric-sparks-controls').isVisible(),false);
 for(const name of ['distortion','origin','scale','direction','density','color']){
  assert.equal(await editor.locator('#effect-'+name+'-control'+(name==='origin'?'s':'')).isVisible(),true,
   name+' must be a live relevant Inspector control');
 }
 const gravity=editor.locator('#effect-debris-gravity');
 await gravity.fill('44');await gravity.dispatchEvent('input');
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await gravity.inputValue(),'44','Gravity must persist on selection');
 assert.deepEqual(errors,[]);
 console.log('[MotoriClip #66 Flying Debris native Inspector] PASS');
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
