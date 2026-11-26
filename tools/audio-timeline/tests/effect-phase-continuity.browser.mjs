import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'};
const server=createServer((req,res)=>{
 const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+'/')||!existsSync(file)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome required');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const [{AdvancedMediaEngine},{TIMELINE_EFFECTS,normaliseTimelineEffect,paintEffectPreviewScene},{snapshotClip,applyClipData}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),import('../js/timeline-effects.mjs'),import('../js/project-history.mjs')]);
  const W=160,H=90,make=()=>Object.assign(document.createElement('canvas'),{width:W,height:H});
  const bg=make(),output=make(),media=make();
  paintEffectPreviewScene(bg.getContext('2d'),W,H);
  const failures=[],renderErrors=[];
  const engine=new AdvancedMediaEngine({canvas:output,mediaBin:document.createElement('div'),onRenderError:e=>renderErrors.push(String(e))});
  engine.outputWidth=W;engine.outputHeight=H;
  const under={id:'base',type:'background',media:bg,sourceName:'base.png',start:0,clipDuration:20,order:10,visible:true,opacity:1};
  const original={id:'overlay',type:'sticker',media,sourceName:'effect.png',start:2,sourceOffset:0,sourceDuration:300,clipDuration:4,order:0,visible:true,opacity:1};
  const pixels=(track,time)=>{engine.tracks=[under,track];engine.visualStackCache=null;engine.visualStackCacheKey='';engine.currentTime=time;engine.renderFrame();return new Uint8Array(output.getContext('2d').getImageData(0,0,W,H).data);};
  const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  let cases=0;
  for(const preset of TIMELINE_EFFECTS)for(const speed of [.5,2]){
   const defaults=normaliseTimelineEffect({presetId:preset.id,speed});
   // Use nondefault seeds wherever a recipe exposes one.
   const seedValues=Object.fromEntries(Object.keys(defaults).filter(k=>/seed$/i.test(k)).map(k=>[k,31415]));
   const full={...original,effectOverlay:normaliseTimelineEffect({...defaults,...seedValues})};
   const expected=pixels(full,3.75);
   pixels(full,5.25);pixels(full,2.125);
   if(!equal(expected,pixels(full,3.75)))failures.push([preset.id,speed,'reverse-seek']);
   const split={...full,id:'right',start:3,sourceOffset:1,clipDuration:3};
   if(!equal(expected,pixels(split,3.75)))failures.push([preset.id,speed,'split/left-trim']);
   const moved={...split,start:8};
   if(!equal(expected,pixels(moved,8.75)))failures.push([preset.id,speed,'move']);
   const restored=applyClipData({media},JSON.parse(JSON.stringify(snapshotClip(moved))));
   if(!equal(expected,pixels(restored,8.75)))failures.push([preset.id,speed,'persisted-recipe']);
   cases++;
  }
  engine.clearAll();
  return {cases,presets:TIMELINE_EFFECTS.length,failures,renderErrors};
 });
 assert.equal(result.presets,43);assert.equal(result.cases,86);
 assert.deepEqual(result.renderErrors,[]);assert.deepEqual(errors,[]);assert.deepEqual(result.failures,[]);
 console.log('[MotoriClip #76 phase proof] PASS '+JSON.stringify(result));
}finally{await browser.close();await new Promise(done=>server.close(done));}
