/** MotoriClip #66 quality audit: independently rendered electrical arcs in Chrome + native Inspector. */
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
  const [{AdvancedMediaEngine},{normaliseTimelineEffect,requiresCompositeSource},{buildElectricSparksFrame}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),import('../js/timeline-effects.mjs'),
   import('../js/timeline-electric-sparks.mjs')
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
  sourceCtx.fillText('ELECTRIC SOURCE',28,52);
  const video={id:'source',type:'video',sourceName:'scene.mp4',file:{name:'scene.mp4'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:scene,order:2};
  const overlay={id:'electric',type:'sticker',sourceName:'generated.png',file:{name:'generated.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:scene,order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({canvas,mediaBin:document.createElement('div'),
   onRenderError:e=>renderErrors.push(String(e))});
  engine.outputWidth=W;engine.outputHeight=H;
  const pixels=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=arr=>{let n=2166136261>>>0;for(const b of arr)n=Math.imul(n^b,16777619)>>>0;return n;};
  const frame=t=>{engine.currentTime=t;engine.renderFrame();return pixels();};
  engine.tracks=[video];const baseline=frame(.72);
  const effect=normaliseTimelineEffect({presetId:'particle-sparks',intensity:98,speed:1.15,
   density:86,scale:165,distortion:91,direction:24,color:'#65e8ff',glow:94,
   originX:62,originY:52,sparkForks:3,sparkLife:.45,sparkSeed:6666});
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
   density:{density:10},reach:{scale:45},jagged:{distortion:1},
   forks:{sparkForks:0},lifetime:{sparkLife:.85},seed:{sparkSeed:123},
   colour:{color:'#ffb659'},glow:{glow:0},direction:{direction:-105},
   emitter:{originX:5,originY:7},speed:{speed:2.8},strength:{intensity:26}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...setting});
   variants[key]=hash(frame(.72));
  }
  overlay.visible=false;const hidden=hash(frame(.72));
  const state=buildElectricSparksFrame(W,H,effect,.72*effect.speed);
  engine.clearAll();
  return {png,nextPng,baseline:hash(baseline),hidden,hashes:samples.map(hash),
   changed,changedRows:rows.size,changedCols:cols.size,strong,alphaChanged,exact,
   sourceAware:requiresCompositeSource('particle-sparks'),
   sparking:state.sparks.length,forked:state.sparks.filter(s=>s.branches.length>0).length,
   multiNode:state.sparks.filter(s=>s.path.length>=5).length,
   variants,renderErrors};
 });
 console.log('[MotoriClip #66 Electric Sparks real Chrome PNG] '+proof.png);
 console.log('[MotoriClip #66 Electric Sparks alternate time Chrome PNG] '+proof.nextPng);
 console.log('[MotoriClip #66 Electric Sparks Chrome metrics] '+JSON.stringify(
  Object.fromEntries(Object.entries(proof).filter(([k])=>!['png','nextPng'].includes(k)))));
 assert.deepEqual(pageErrors,[]);assert.deepEqual(proof.renderErrors,[]);
 assert.equal(proof.sourceAware,false,'Sparks are independent transparent light, not source-warp');
 assert.ok(proof.changed>130,'Visible forked arcs and luminous tips must alter the image');
 assert.ok(proof.changed<320*180*.57,'Do not cover most of image with opaque bands');
 assert.ok(proof.changedRows>18&&proof.changedCols>20,'Arcs should spread in two dimensions');
 assert.ok(proof.strong>30,'Bright cores must exist, not only a tinted haze');
 assert.equal(proof.alphaChanged,0,'Solid source stays solid after sparks');
 assert.equal(proof.exact,true);
 assert.equal(new Set(proof.hashes).size,4,'Different timestamps must show changed real image pixels');
 assert.equal(proof.hidden,proof.baseline,'Hiding sparks restores the actual scene');
 assert.ok(proof.sparking>12&&proof.forked>8&&proof.multiNode>12,'Forked multi-vertex discharges are visible');
 for(const [key,value] of Object.entries(proof.variants))
  assert.notEqual(value,proof.hashes[1],key+' must change rendered pixels');
 console.log('[MotoriClip #66 Electric Sparks real Chrome] PASS');
 const editor=await browser.newPage({viewport:{width:1450,height:900}}),errors=[];
 editor.on('pageerror',e=>errors.push(String(e)));
 await editor.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 await editor.locator('[data-library-tab="effects"]').click();
 await editor.locator('#effects-library-grid [data-preset-id="particle-sparks"]').click();
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().waitFor({timeout:12000});
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await editor.locator('#effect-electric-sparks-controls').isVisible(),true);
 assert.equal(await editor.locator('#effect-line-corruption-controls').isVisible(),false);
 for(const name of ['glow','distortion','origin','scale','direction','density','color']){
  assert.equal(await editor.locator('#effect-'+name+'-control'+(name==='origin'?'s':'')).isVisible(),true,
   name+' must be a live relevant Inspector control');
 }
 const forks=editor.locator('#effect-spark-forks');
 await forks.fill('4');await forks.dispatchEvent('input');
 await editor.locator('.timeline-clip.sticker:not(.placeholder)').first().click();
 assert.equal(await forks.inputValue(),'4','Fork count must persist on selection');
 assert.deepEqual(errors,[]);
 console.log('[MotoriClip #66 Electric Sparks native Inspector] PASS');
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
