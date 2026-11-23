/**
 * MotoriClip #55 — actual Chrome God Rays source/highlight scattering review.
 * Screenshots are emitted for human visual inspection before checklist #55.
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
assert.ok(chrome,'Real Chrome required for God Rays visual QA');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
  const {normaliseTimelineEffect}=await import('../js/timeline-effects.mjs');
  const {sampleGodRay,buildGodRaysFrame}=await import('../js/timeline-god-rays.mjs');
  const W=320,H=180;
  const make=(bright=true)=>{
   const c=document.createElement('canvas');c.width=W;c.height=H;
   const g=c.getContext('2d');
   g.fillStyle='#08172b';g.fillRect(0,0,W,H);
   if(bright){
    // Bright upper-left window/sun is the real scattering emitter.
    const glow=g.createRadialGradient(65,27,4,65,27,42);
    glow.addColorStop(0,'#fffde5');glow.addColorStop(.46,'#f8efd0');
    glow.addColorStop(.58,'#e9e6c5');glow.addColorStop(1,'rgba(30,47,68,0)');
    g.fillStyle=glow;g.fillRect(15,0,110,86);
    g.fillStyle='#fbf8ed';g.beginPath();g.arc(65,27,13,0,2*Math.PI);g.fill();
    // Shadowing structure interrupts some projected angles.
    g.fillStyle='#07182b';g.fillRect(87,42,7,46);
    g.fillRect(33,56,8,49);
    g.fillStyle='#466075';g.fillRect(19,101,22,79);
    for(let i=0;i<12;i++){
     g.fillStyle=i%2?'#26394c':'#33475d';
     g.fillRect(i*29,112+(i%3)*10,20,75);
    }
    g.fillStyle='#e2dfd0';g.font='bold 17px sans-serif';
    g.fillText('SOURCE SCENE',174,38);
   }else{
    g.fillStyle='#142439';g.fillRect(0,110,W,70);
   }
   return c;
  };
  const brightCanvas=make(true),darkCanvas=make(false);
  const video={id:'video',type:'video',file:{name:'window.png'},
   sourceName:'window.png',start:0,clipDuration:3,visible:true,
   opacity:1,blendMode:'source-over',media:brightCanvas,order:2};
  const overlay={id:'rays',type:'sticker',file:{name:'clear.png'},
   sourceName:'clear.png',start:0,clipDuration:3,visible:true,
   opacity:1,blendMode:'source-over',media:make(false),order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({
   canvas,mediaBin:document.createElement('div'),
   onRenderError:e=>renderErrors.push(String(e))
  });
  engine.outputWidth=W;engine.outputHeight=H;
  const pixel=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=bytes=>{let h=2166136261>>>0;for(const v of bytes)h=Math.imul(h^v,16777619)>>>0;return h;};
  const render=t=>{engine.currentTime=t;engine.renderFrame();return pixel();};
  engine.tracks=[video];const source=render(.71);
  const e=normaliseTimelineEffect({presetId:'god-rays',intensity:100,speed:1.45,
   density:85,scale:160,direction:-2,distortion:85,glow:96,blur:46,
   originX:20,originY:15,color:'#ffe4b6'});
  overlay.effectOverlay=e;engine.tracks=[video,overlay];
  const times=[.13,.41,.71,1.62],frames=times.map(t=>render(t));
  render(.71);const screenshot=canvas.toDataURL('image/png');
  const rewind=render(.71).every((v,i)=>v===frames[2][i]);
  let changed=0,strong=0,brightRays=0,sourceAlphaChanged=0;
  const zones=[0,0,0,0];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const k=(y*W+x)*4;
   const diff=Math.abs(frames[2][k]-source[k])+
    Math.abs(frames[2][k+1]-source[k+1])+
    Math.abs(frames[2][k+2]-source[k+2]);
   if(diff>8){changed++;zones[(x>=W/2?1:0)+(y>=H/2?2:0)]++;}
   if(diff>24)strong++;
   if(y>70&&diff>15)brightRays++;
   if(frames[2][k+3]!==source[k+3])sourceAlphaChanged++;
  }
  const effectHash=hash(render(.71)),variants={};
  for(const [name,delta] of Object.entries({
   intensity:{intensity:30},density:{density:10},scale:{scale:210},
   direction:{direction:75},turbulence:{distortion:10},glow:{glow:0},
   softness:{blur:0},origin:{originX:76,originY:70},
   tint:{color:'#65aaff'},speed:{speed:2.7}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...e,...delta});
   variants[name]=hash(render(.71));
  }
  overlay.effectOverlay=e;overlay.visible=false;
  const hidden=hash(render(.71));overlay.visible=true;
  video.media=darkCanvas;
  const darkBase=render(.71);
  overlay.visible=false;const actualDarkBase=render(.71);overlay.visible=true;
  const darkChange=darkBase.reduce((n,v,i)=>n+(v!==actualDarkBase[i]),0);
  const testFrame=buildGodRaysFrame(brightCanvas.getContext('2d').getImageData(0,0,W,H),W,H,e,.71*e.speed);
  const alphas=[];for(let k=3;k<testFrame.data.length;k+=4)alphas.push(testFrame.data[k]);
  const local=sampleGodRay(brightCanvas.getContext('2d').getImageData(0,0,W,H),W,H,e,.71*e.speed,90,112);
  engine.clearAll();
  return {screenshot,changed,strong,brightRays,sourceAlphaChanged,zones,
   alphaUnique:new Set(alphas).size,alphaMax:Math.max(...alphas),
   effectHash,baseline:hash(source),hidden,darkChange,
   hashes:frames.map(hash),rewind,variants,
   emitter:local.emitterLight,renderErrors};
 });
 assert.ok(result.changed>1500,'Real video highlights must create visible volumetric shafts');
 assert.ok(result.strong>300,'Scattered shafts must produce noticeable diffuse light');
 assert.ok(result.brightRays>100,'Beams must extend into shadowed media beyond source highlights');
 assert.ok(result.zones.filter(v=>v>50).length>=2,'Volumetric shafts must occupy multiple regions');
 assert.ok(result.alphaMax>65&&result.alphaMax<255&&result.alphaUnique>45,
  'Source-responsive rays need graded transparent soft boundaries, not opaque wedges');
 assert.equal(result.sourceAlphaChanged,0,'Ray overlay preserves actual footage alpha');
 assert.equal(new Set(result.hashes).size,4,'Ray internal turbulence evolves with timeline time');
 assert.equal(result.rewind,true,'Rewinding reproduces identical compositor RGBA');
 for(const [name,hashValue] of Object.entries(result.variants))
  assert.notEqual(hashValue,result.effectHash,'Native '+name+' changes real God Rays pixels');
 assert.equal(result.hidden,result.baseline,'Hidden rays preserve original source exactly');
 assert.equal(result.darkChange,0,'Dark source must not generate synthetic shafts');
 assert.ok(result.emitter>.45,'Actual bright source highlight is detected near the user origin');
 assert.deepEqual(result.renderErrors,[]);assert.deepEqual(errors,[]);
 console.log('[MotoriClip #55 God Rays visual PNG] '+result.screenshot);
 console.log('[MotoriClip #55 God Rays real Chrome] PASS '+JSON.stringify(
  Object.fromEntries(Object.entries(result).filter(([key])=>key!=='screenshot'))));
}finally{await browser.close();await new Promise(done=>server.close(done));}
