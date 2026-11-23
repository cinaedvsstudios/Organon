/**
 * MotoriClip #58 — real Chrome source-pixel compositing, translucent bank
 * silhouettes, native controls and frame-exact reverse seek. Prints actual PNG.
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
assert.ok(chrome,'Real Chromium required to qualify #58');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const [{AdvancedMediaEngine},{normaliseTimelineEffect},{buildMistFogFrame}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),
   import('../js/timeline-effects.mjs'),
   import('../js/timeline-mist-fog.mjs')
  ]);
  const W=320,H=180,scene=document.createElement('canvas');
  scene.width=W;scene.height=H;const sc=scene.getContext('2d');
  sc.fillStyle='#0a2041';sc.fillRect(0,0,W,H);
  for(let x=0;x<W;x+=20){
   sc.fillStyle=x%40?'#166485':'#376b83';sc.fillRect(x,60+(x%60),16,H);
  }
  sc.fillStyle='#ffdc84';sc.font='bold 25px sans-serif';sc.fillText('BEHIND MIST',70,42);
  sc.fillStyle='#e16b42';sc.fillRect(32,134,78,30);
  const source={id:'source',type:'video',sourceName:'scene.png',file:{name:'scene.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:scene,order:2};
  const overlay={id:'fog',type:'sticker',sourceName:'empty.png',file:{name:'empty.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:scene,order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({
   canvas,mediaBin:document.createElement('div'),onRenderError:e=>renderErrors.push(String(e))
  });
  engine.outputWidth=W;engine.outputHeight=H;
  const pixels=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=a=>{let h=2166136261>>>0;for(const v of a)h=Math.imul(h^v,16777619)>>>0;return h;};
  const render=t=>{engine.currentTime=t;engine.renderFrame();return pixels();};
  engine.tracks=[source];const underlying=render(.65);
  const e=normaliseTimelineEffect({presetId:'mist-fog-bank',
   intensity:94,speed:1.3,density:86,scale:109,direction:32,distortion:80,
   blur:35,windSpeed:1.7,bankHeight:61,seed:902,color:'#d7e4ed'});
  overlay.effectOverlay=e;engine.tracks=[source,overlay];
  const snapshots=[.14,.65,1.36,2.5].map(t=>({time:t,pixels:render(t)}));
  render(.65);const png=canvas.toDataURL('image/png'),original=hash(pixels());
  const rewind=render(.65).every((v,i)=>v===snapshots[1].pixels[i]);
  let changed=0,topChanged=0,bottomChanged=0,underlayAlphaChanges=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4;
   const diff=Math.abs(snapshots[1].pixels[i]-underlying[i])+
    Math.abs(snapshots[1].pixels[i+1]-underlying[i+1])+
    Math.abs(snapshots[1].pixels[i+2]-underlying[i+2]);
   if(diff>12){changed++;if(y<H*.3)topChanged++;if(y>H*.67)bottomChanged++;}
   if(snapshots[1].pixels[i+3]!==underlying[i+3])underlayAlphaChanges++;
  }
  const variants={};
  for(const [key,change] of Object.entries({
   color:{color:'#f4a6c4'},density:{density:15},height:{bankHeight:35},
   wind:{windSpeed:.1},direction:{direction:-95},seed:{seed:13},
   softness:{blur:0},turbulence:{distortion:0},spread:{scale:175},opacity:{intensity:25}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...e,...change});
   variants[key]=hash(render(.65));
  }
  overlay.effectOverlay=e;overlay.visible=false;const hidden=hash(render(.65));
  const field=buildMistFogFrame(96,54,e,.65*e.speed);
  const alpha=Array.from({length:field.width*field.height},(_,i)=>field.data[i*4+3]);
  engine.clearAll();
  return {png,hashes:snapshots.map(s=>hash(s.pixels)),original,
   baseline:hash(underlying),hidden,changed,topChanged,bottomChanged,
   underlayAlphaChanges,rewind,variants,
   clear:alpha.filter(v=>v<6).length,visible:alpha.filter(v=>v>18).length,
   alphaVariants:new Set(alpha).size,peakAlpha:Math.max(...alpha),renderErrors};
 });
 assert.ok(result.changed>750,'Mist Bank needs many real source pixels');
 assert.ok(result.bottomChanged>800,'Fog should accumulate along lower bank');
 assert.ok(result.topChanged<result.bottomChanged*.4,'Bank must leave much of top video unobscured');
 assert.ok(result.clear>1000,'Mist edges need transparent/clear background');
 assert.ok(result.visible>300,'Billows need visible translucency');
 assert.ok(result.alphaVariants>20,'Bank alpha cannot be a simple translated gradient');
 assert.ok(result.peakAlpha<246,'Source must remain visible through mist');
 assert.equal(result.underlayAlphaChanges,0,'Fog must preserve source video alpha');
 assert.equal(result.hidden,result.baseline,'Hidden overlay restores video exactly');
 assert.equal(result.rewind,true,'Reverse seek must recover exact pixel buffer');
 assert.equal(new Set(result.hashes).size,4,'Multiple clip-relative times must differ');
 for(const [name,hash] of Object.entries(result.variants))
  assert.notEqual(hash,result.original,'Inspector control '+name+' must change actual pixels');
 assert.deepEqual(result.renderErrors,[]);assert.deepEqual(errors,[]);
 console.log('[MotoriClip #58 real Chrome Mist-Fog Bank PNG] '+result.png);
 console.log('[MotoriClip #58 real Chrome] PASS '+JSON.stringify(
  Object.fromEntries(Object.entries(result).filter(([key])=>key!=='png'))));
}finally{await browser.close();await new Promise(done=>server.close(done));}
