/** MotoriClip #59 — inspect real Chrome RGB/monochrome TV snow over source video. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'};
const server=createServer((req,res)=>{
 const f=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!f.startsWith(root+'/')||!existsSync(f)){res.writeHead(404);res.end('missing');return;}
 res.writeHead(200,{'Content-Type':mime[extname(f)]||'application/octet-stream'});res.end(readFileSync(f));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Real Chromium required for TV Static visual qualification');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),pageErrors=[];
 page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const proof=await page.evaluate(async()=>{
  const [{AdvancedMediaEngine},{normaliseTimelineEffect},{buildTVStaticFrame}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),import('../js/timeline-effects.mjs'),
   import('../js/timeline-tv-static.mjs')
  ]);
  const W=320,H=180;
  const scene=document.createElement('canvas');scene.width=W;scene.height=H;
  const c=scene.getContext('2d');
  c.fillStyle='#15314b';c.fillRect(0,0,W,H);
  c.fillStyle='#f0d187';c.font='bold 28px sans-serif';c.fillText('SOURCE VIDEO',44,45);
  for(let x=0;x<W;x+=32){c.fillStyle=x%64?'#165f79':'#326d97';c.fillRect(x,85,25,80);}
  c.fillStyle='#bd6389';c.fillRect(37,128,105,33);
  const source={id:'source',type:'video',sourceName:'test.png',file:{name:'test.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:scene,order:2};
  const overlay={id:'static',type:'sticker',sourceName:'generated.png',
   file:{name:'generated.png'},start:0,clipDuration:3,visible:true,
   opacity:1,blendMode:'source-over',media:scene,order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const errors=[],engine=new AdvancedMediaEngine({
   canvas,mediaBin:document.createElement('div'),onRenderError:e=>errors.push(String(e))
  });
  engine.outputWidth=W;engine.outputHeight=H;
  const get=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=data=>{let n=2166136261>>>0;for(const b of data)n=Math.imul(n^b,16777619)>>>0;return n;};
  const render=t=>{engine.currentTime=t;engine.renderFrame();return get();};
  engine.tracks=[source];const baseline=render(.65);
  const e=normaliseTimelineEffect({presetId:'tv-static',intensity:92,speed:1,
   density:90,staticMode:'mono',staticBrightness:53,staticVariance:94,staticSeed:782});
  overlay.effectOverlay=e;engine.tracks=[source,overlay];
  const snapshots=[.14,.65,1.36,2.5].map(t=>render(t));
  const monochrome=snapshots[1],monoHash=hash(monochrome);
  render(.65);const png=canvas.toDataURL('image/png');
  const rewind=hash(render(.65))===monoHash&&render(.65).every((v,i)=>v===monochrome[i]);
  let changed=0,topChanged=0,lowerChanged=0,alphaDiff=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const k=(y*W+x)*4,d=Math.abs(monochrome[k]-baseline[k])
    +Math.abs(monochrome[k+1]-baseline[k+1])+Math.abs(monochrome[k+2]-baseline[k+2]);
   if(d>18){changed++;if(y<H*.3)topChanged++;if(y>=H*.7)lowerChanged++;}
   if(monochrome[k+3]!==baseline[k+3])alphaDiff++;
  }
  const variations={};
  for(const [name,settings] of Object.entries({
   density:{density:16},brightness:{staticBrightness:8},variance:{staticVariance:5},
   seed:{staticSeed:54321},mode:{staticMode:'color'},intensity:{intensity:20},
   speed:{speed:2}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...e,...settings});
   variations[name]=hash(render(.65));
  }
  overlay.effectOverlay=e;overlay.visible=false;
  const hidden=hash(render(.65));
  overlay.visible=true;overlay.effectOverlay=e;
  const field=buildTVStaticFrame(128,72,e,.65);
  const rgb=Array.from({length:field.width*field.height},(_,i)=>i*4);
  const visible=rgb.filter(i=>field.data[i+3]>0);
  const color=buildTVStaticFrame(128,72,{...e,staticMode:'color'},.65);
  const colorDistinct=visible.filter(i=>color.data[i]!==color.data[i+1]||color.data[i+1]!==color.data[i+2]).length;
  engine.clearAll();
  return {png,hashes:snapshots.map(hash),baseline:hash(baseline),hidden,
   changed,topChanged,lowerChanged,alphaDiff,rewind,variations,
   pixelsVisible:visible.length,monochromeCorrect:visible.every(i=>field.data[i]===field.data[i+1]&&field.data[i+1]===field.data[i+2]),
   coloredPixels:colorDistinct,transparentPixels:rgb.filter(i=>field.data[i+3]===0).length,
   maximumAlpha:Math.max(...rgb.map(i=>field.data[i+3])),errors};
 });
 console.log('[MotoriClip #59 Chrome TV Static PNG] '+proof.png);
 console.log('[MotoriClip #59 Chrome metrics] '+JSON.stringify(
  Object.fromEntries(Object.entries(proof).filter(([k])=>k!=='png'))));
 assert.equal(proof.errors.length,0);assert.deepEqual(pageErrors,[]);
 assert.ok(proof.changed>6000,'TV snow must visibly alter independent real video pixels');
 assert.ok(proof.topChanged>800&&proof.lowerChanged>800,'Snow must evolve across the whole frame');
 assert.equal(proof.alphaDiff,0,'Compositor must leave underlying source alpha intact');
 assert.equal(proof.rewind,true,'Backward seek must restore exact snow pixels');
 assert.equal(new Set(proof.hashes).size,4,'Fresh snow each timestamp');
 assert.equal(proof.hidden,proof.baseline,'Hidden snow must restore source frame exactly');
 assert.ok(proof.monochromeCorrect,'Monochrome mode must use equal RGB channels');
 assert.ok(proof.coloredPixels>proof.pixelsVisible*.8,'Colour mode must have independent RGB noise');
 assert.ok(proof.transparentPixels>1000&&proof.pixelsVisible>3500,'Snow should be granular and transparent');
 assert.ok(proof.maximumAlpha<255,'TV snow must retain underlying source video');
 for(const [key,value] of Object.entries(proof.variations))
  assert.notEqual(value,proof.hashes[1],key+' Inspector setting must affect rendered snow');
 console.log('[MotoriClip #59 Chrome] PASS');
}finally{await browser.close();await new Promise(done=>server.close(done));}
