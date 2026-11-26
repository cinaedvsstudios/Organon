import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
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
 // Exercise the real editor controller, not just synthetic clip metadata.
 const ui=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:900}});
 const uiErrors=[];ui.on('pageerror',e=>uiErrors.push(String(e)));
 await ui.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 await ui.locator('[data-library-tab="effects"]').click();
 await ui.locator('#effect-category').selectOption('Light');
 await ui.locator('#effects-library-grid [data-preset-id="starburst"]').click();
 await ui.locator('.timeline-clip.sticker:not(.placeholder)').waitFor({timeout:20000});
 await ui.locator('#effect-speed').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 const seek=async time=>ui.evaluate(async t=>{
  const input=document.getElementById('preview-seek');
  if(Number(input.max)<t)throw Error('Fixture shorter than requested seek: '+input.max);
  input.value=String(t);input.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
  return document.getElementById('advanced-canvas').toDataURL();
 },time);
 const originalRight=await seek(1.75),originalLeft=await seek(.5);
 assert.notEqual(originalRight,originalLeft,'Fixture must animate before split');
 await seek(1);
 await ui.locator('#btn-split-all').click();
 await ui.waitForFunction(()=>document.querySelectorAll('.timeline-clip.sticker:not(.placeholder)').length===2);
 assert.equal(await seek(.5),originalLeft,'Actual UI split preserves left-hand phase');
 assert.equal(await seek(1.75),originalRight,'Actual UI split preserves right-hand phase');
 await ui.locator('#btn-undo').click();
 await ui.waitForFunction(()=>document.querySelectorAll('.timeline-clip.sticker:not(.placeholder)').length===1);
 assert.equal(await seek(1.75),originalRight,'Undo restores original pixels');
 await ui.locator('#btn-redo').click();
 await ui.waitForFunction(()=>document.querySelectorAll('.timeline-clip.sticker:not(.placeholder)').length===2);
 assert.equal(await seek(1.75),originalRight,'Redo restores split pixels');
 const download=ui.waitForEvent('download',{timeout:20000});
 await ui.locator('#btn-save-project').click();
 const backup=await download,bytes=readFileSync(await backup.path()),saved=JSON.parse(bytes.toString());
 const clips=saved.tracks.filter(t=>t.effectOverlay?.presetId==='starburst').sort((a,b)=>a.start-b.start);
 assert.equal(clips.length,2);assert.equal(clips[1].sourceOffset,1);assert.equal(clips[1].effectOverlay.speed,2);
 assert.deepEqual(clips[0].effectOverlay,clips[1].effectOverlay);
 await ui.locator('#project-open-input').setInputFiles({name:backup.suggestedFilename(),mimeType:'application/json',buffer:bytes});
 await ui.locator('#timeline-action-modal').waitFor({state:'visible'});
 await ui.locator('#timeline-action-apply').click();
 await ui.locator('#timeline-action-modal').waitFor({state:'hidden'});
 await ui.waitForFunction(()=>document.querySelectorAll('.timeline-clip.sticker:not(.placeholder)').length===2);
 assert.equal(await seek(1.75),originalRight,'Portable Open restores exact split pixels');

 // Compare actual decoded exports, not just a second render invocation.
 await ui.locator('#btn-project-settings').click();
 await ui.locator('#canvas-width').fill('320');await ui.locator('#canvas-height').fill('180');
 await ui.locator('#btn-apply-canvas').click();
 await ui.locator('#project-fps').selectOption('25');
 await ui.locator('#project-settings-modal [data-close-modal]').click();
 const frames=[10,25,35],expected=[];
 function rgb(args,input){
  const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error',...args,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-threads','1','pipe:1'],{input,maxBuffer:2*1024*1024,timeout:30000});
  assert.equal(r.status,0,String(r.stderr||r.error));assert.equal(r.stdout.length,320*180*3);
  return r.stdout;
 }
 function mae(a,b){assert.equal(a.length,b.length);let s=0;for(let i=0;i<a.length;i++)s+=Math.abs(a[i]-b[i]);return s/a.length;}
 for(const frame of frames){
  const png=Buffer.from((await seek(frame/25)).split(',')[1],'base64');
  expected.push(rgb(['-f','image2pipe','-i','pipe:0'],png));
 }
 assert.ok(mae(expected[0],expected[2])>.05,'Export sample must contain changing effect pixels');
 await ui.locator('#btn-project-export').click();
 await ui.locator('#export-offline-format').selectOption('mp4');
 const decoded=[];
 for(let repeat=0;repeat<2;repeat++){
  await ui.waitForFunction(()=>!document.getElementById('btn-export-offline').disabled);
  const pending=ui.waitForEvent('download',{timeout:180000});
  await ui.locator('#btn-export-offline').click();
  const file=await pending;assert.match(file.suggestedFilename(),/\.mp4$/);
  await ui.locator('#export-overlay').waitFor({state:'hidden'});
  const output=await file.path();assert.ok(output);
  const result=frames.map(frame=>rgb(['-i',output,'-vf','select=eq(n\\,'+frame+')']));
  const differences=result.map((pixels,i)=>mae(pixels,expected[i]));
  assert.ok(differences.every(v=>v<31),'Preview/export RGB MAE exceeds codec tolerance: '+differences);
  decoded.push(result);
  console.log('[MotoriClip #76 decoded export] run '+(repeat+1)+' preview RGB MAE '+JSON.stringify(differences));
 }
 const repeatDifferences=decoded[0].map((pixels,i)=>mae(pixels,decoded[1][i]));
 assert.ok(repeatDifferences.every(v=>v<2),'Repeated decoded export changed pixels: '+repeatDifferences);
 console.log('[MotoriClip #76 repeated export] PASS '+JSON.stringify(repeatDifferences));
 assert.deepEqual(uiErrors,[]);
 await ui.close();
 console.log('[MotoriClip #76 UI] PASS split, undo, redo, portable Save/Open, recipe speed and exact pixels');
}finally{await browser.close();await new Promise(done=>server.close(done));}
