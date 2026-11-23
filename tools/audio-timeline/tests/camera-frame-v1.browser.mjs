/**
 * MotoriClip #57 — actual Chrome HUD pixels, alpha-safe underlay,
 * real animated REC/timecode, native options and reverse seeking.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'};
const server=createServer((req,res)=>{
 const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+'/')||!existsSync(file)){res.writeHead(404);res.end('missing');return;}
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});
 res.end(readFileSync(file));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'A real Chromium browser is required');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const [{AdvancedMediaEngine},{normaliseTimelineEffect}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),
   import('../js/timeline-effects.mjs')
  ]);
  const W=320,H=180,source=document.createElement('canvas');
  source.width=W;source.height=H;const sc=source.getContext('2d');
  sc.fillStyle='#263956';sc.fillRect(0,0,W,H);
  for(let y=0;y<H;y+=15)for(let x=0;x<W;x+=15){
   sc.fillStyle=(x+y)/15%2===0?'#376280':'#44536d';
   sc.fillRect(x,y,15,15);
  }
  sc.fillStyle='#ffe69d';sc.font='bold 28px sans-serif';sc.fillText('CAMERA SCENE',50,88);
  const video={id:'video',type:'video',sourceName:'scene.png',file:{name:'scene.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:source,order:2};
  const overlay={id:'camhud',type:'sticker',sourceName:'clear.png',file:{name:'clear.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',media:source,order:1};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({
   canvas,mediaBin:document.createElement('div'),onRenderError:e=>renderErrors.push(String(e))
  });
  engine.outputWidth=W;engine.outputHeight=H;
  const pixels=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=a=>{let h=2166136261>>>0;for(const v of a)h=Math.imul(h^v,16777619)>>>0;return h;};
  const render=time=>{engine.currentTime=time;engine.renderFrame();return pixels();};
  engine.tracks=[video];const baseline=render(.37);
  const config=normaliseTimelineEffect({presetId:'camera-frame',intensity:93,
   color:'#f0f6ff',recColor:'#ff364c',batteryLevel:78,hudScale:100,frameRate:30,
   timecodeOffset:0,jitter:0,speed:1.3});
  overlay.effectOverlay=config;engine.tracks=[video,overlay];
  const first=render(.37);const screenshot=canvas.toDataURL('image/png');
  const still=render(.37).every((value,i)=>value===first[i]);
  const later=render(.78),laterHash=hash(later);
  render(.09);const earlyHash=hash(pixels());
  const rewind=render(.37).every((value,i)=>value===first[i]);
  let changed=0,unchanged=0,alphaDifference=0;
  const zones={rec:0,battery:0,centre:0,timecode:0,corners:0};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4;
   const delta=Math.abs(first[i]-baseline[i])+Math.abs(first[i+1]-baseline[i+1])+
    Math.abs(first[i+2]-baseline[i+2]);
   if(delta>12){
    changed++;
    if(x<115&&y<62)zones.rec++;
    if(x>205&&y<68)zones.battery++;
    if(x>118&&x<202&&y>62&&y<118)zones.centre++;
    if(x<215&&y>125)zones.timecode++;
    if((x<50||x>270)&&(y<50||y>130))zones.corners++;
   }else unchanged++;
   if(first[i+3]!==baseline[i+3])alphaDifference++;
  }
  const original=hash(first),variants={};
  for(const [name,delta] of Object.entries({
   lineColour:{color:'#45fff1'},recColour:{recColor:'#fa68db'},
   opacity:{intensity:35},size:{hudScale:135},battery:{batteryLevel:15},
   fps:{frameRate:24},offset:{timecodeOffset:112},jitter:{jitter:100},
   speed:{speed:8},record:{showRec:false},timecode:{showTimecode:false},
   batteryToggle:{showBattery:false},corners:{showCorners:false},
   reticle:{showReticle:false}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...config,...delta});
   variants[name]=hash(render(.37));
  }
  overlay.effectOverlay=config;overlay.visible=false;
  const hidden=hash(render(.37));
  engine.clearAll();
  return {screenshot,baseline:hash(baseline),original,earlyHash,laterHash,
   hidden,changed,unchanged,zones,alphaDifference,still,rewind,
   variants,renderErrors};
 });
 assert.ok(result.changed>350,'Transparent HUD must paint real text and geometry');
 assert.ok(result.unchanged>45000,'Background pixels must remain original, not a solid overlay');
 for(const [region,n] of Object.entries(result.zones))
  assert.ok(n>8,'HUD missing pixel details in '+region+': '+n);
 assert.equal(result.alphaDifference,0,'HUD cannot change opaque underlying alpha');
 assert.equal(result.hidden,result.baseline,'Hiding HUD restores source exactly');
 assert.equal(result.still,true);assert.equal(result.rewind,true);
 assert.notEqual(result.original,result.laterHash,'Timecode and REC change at later time');
 assert.notEqual(result.original,result.earlyHash,'REC blink or timecode changes with elapsed time');
 for(const [key,hash] of Object.entries(result.variants))
  assert.notEqual(hash,result.original,key+' control must alter real pixels');
 assert.deepEqual(result.renderErrors,[]);assert.deepEqual(errors,[]);
 console.log('[MotoriClip #57 Camera Frame actual Chrome PNG] '+result.screenshot);
 console.log('[MotoriClip #57 Camera Frame actual Chrome] PASS '+JSON.stringify(
  Object.fromEntries(Object.entries(result).filter(([key])=>key!=='screenshot'))));
}finally{await browser.close();await new Promise(done=>server.close(done));}
