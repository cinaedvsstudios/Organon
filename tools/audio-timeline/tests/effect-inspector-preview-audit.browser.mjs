import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=createServer((req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent((req.url||'/').split('?')[0]));
 if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}
 const bytes=readFileSync(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch(e){res.writeHead(404);res.end(String(e.message));}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';assert.ok(existsSync(chrome));
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1450,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 await page.locator('[data-library-tab="effects"]').click();
 const catalog=await page.evaluate(async()=>{
  const {TIMELINE_EFFECTS}=await import('./js/timeline-effects.mjs');
  const {commonEffectControls}=await import('./js/effect-inspector-controls.mjs');
  return TIMELINE_EFFECTS.map(p=>({id:p.id,groups:commonEffectControls(p.id)}));
 });
 assert.equal(catalog.length,43);assert.equal(new Set(catalog.map(x=>x.id)).size,43);
 const modal=page.locator('#text-preview-modal'),progress=page.locator('#text-preview-progress');
 const capture=()=>page.evaluate(()=>{const c=document.getElementById('text-preview-canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let hash=2166136261;for(const v of d)hash=Math.imul(hash^v,16777619)>>>0;
  return {hash,time:Number(c.dataset.previewSeconds),slider:document.getElementById('text-preview-progress').value};});
 const independent=id=>page.evaluate(async id=>{
  const {paintTimelineEffect,requiresCompositeSource,paintEffectPreviewScene}=await import('./js/timeline-effects.mjs');
  const c=document.createElement('canvas');c.width=640;c.height=360;c.style.cssText='position:fixed;left:-10000px;top:0';document.body.append(c);const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#0c1722';ctx.fillRect(0,0,640,360);ctx.strokeStyle='rgba(117,178,222,.08)';
  for(let x=0;x<640;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,360);ctx.stroke();}
  if(requiresCompositeSource(id))paintEffectPreviewScene(ctx,640,360);
  paintTimelineEffect(ctx,640,360,{presetId:id},0,3);
  let hash=2166136261;for(const v of ctx.getImageData(0,0,640,360).data)hash=Math.imul(hash^v,16777619)>>>0;const png=id==='camera-frame'?c.toDataURL():null;c.remove();return {hash,png};
 },id);
 for(const {id} of catalog){
  const card=page.locator('#effects-library-grid [data-preset-id="'+id+'"]');
  await card.dispatchEvent('contextmenu');await modal.waitFor({state:'visible'});
  const zero=await capture();assert.equal(zero.time,0,id+' opens at exact time zero');assert.equal(zero.slider,'0');const reference=await independent(id);if(zero.hash!==reference.hash&&id==='camera-frame'){console.log('[camera modal PNG] '+await page.locator('#text-preview-canvas').evaluate(c=>c.toDataURL()));console.log('[camera reference PNG] '+reference.png);}assert.equal(zero.hash,reference.hash,id+' first pixels equal independently rendered t=0');
  await progress.fill('137');await progress.dispatchEvent('input');assert.equal((await capture()).time,1.37);
  await progress.fill('0');await progress.dispatchEvent('input');assert.deepEqual(await capture(),zero,id+' reverse seek matches initial pixels');
  await page.locator('#text-preview-close').click();
  await card.dispatchEvent('contextmenu');assert.deepEqual(await capture(),zero,id+' reopen must never reuse old time');
  await page.locator('#text-preview-close').click();
  console.log('[MotoriClip #68 preview zero/reverse/reopen] PASS',id,zero.hash);
 }
 const card=page.locator('#effects-library-grid [data-preset-id="glitch-flux"]');
 await card.dispatchEvent('contextmenu');const zero=await capture();
 await page.locator('#text-preview-loop').uncheck();await progress.fill('298');await page.locator('#text-preview-play').click();
 await page.waitForFunction(()=>document.getElementById('text-preview-progress').value==='300');
 assert.match(await page.locator('#text-preview-play').innerText(),/play/i);
 await page.locator('#text-preview-restart').click();assert.deepEqual(await capture(),zero);
 await page.locator('#text-preview-loop').check();await progress.fill('298');await page.locator('#text-preview-play').click();
 await page.waitForFunction(()=>Number(document.getElementById('text-preview-progress').value)<50);
 await page.locator('#text-preview-play').click();const stopped=await capture();await page.waitForTimeout(120);assert.deepEqual(await capture(),stopped);
 await page.keyboard.press('Escape');assert.equal(await modal.isHidden(),true);
 console.log('[MotoriClip #68 play pause loop restart stop] PASS');
 for(const {id} of catalog){
  const entry=catalog.find(p=>p.id===id);await page.locator('#effects-library-grid [data-preset-id="'+id+'"]').click();
  // Generated file insertion is asynchronous; wait for the new selection.
  await page.locator('#inspector-timeline-effect[data-selected-preset-id="'+id+'"]').waitFor({state:'visible'});
  for(const name of ['density','scale','direction','distortion','glow','blur','origin','color']){
   const selector='#effect-'+name+(name==='origin'?'-controls':'-control');
   assert.equal(await page.locator(selector).isVisible(),entry.groups.includes(name),id+' '+name+' visibility');
  }
  if(id==='camera-frame'){
   const rec=page.locator('#effect-show-rec');await rec.selectOption('false');
   const oldClip=await page.locator('#inspector-timeline-effect').getAttribute('data-clip-id');
   await page.locator('#effects-library-grid [data-preset-id="camera-frame"]').click();
   await page.waitForFunction(previous=>{const panel=document.getElementById('inspector-timeline-effect');return panel.dataset.selectedPresetId==='camera-frame'&&panel.dataset.clipId!==previous;},oldClip);
   assert.equal(await rec.inputValue(),'true','New camera HUD must not inherit previous clip REC setting');
  }
  console.log('[MotoriClip #67 native common groups] PASS',id,entry.groups.join(','));
 }
 assert.deepEqual(errors,[]);
 // Independent native editor: modify a visible recipe, verify history and portable project persistence.
 const ui=await browser.newPage({acceptDownloads:true,viewport:{width:1450,height:900}}),uiErrors=[];
 ui.on('pageerror',e=>uiErrors.push(String(e)));
 await ui.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 await ui.locator('[data-library-tab="effects"]').click();
 await ui.locator('#effects-library-grid [data-preset-id="starburst"]').click();
 await ui.locator('#inspector-timeline-effect[data-selected-preset-id="starburst"]').waitFor({state:'visible'});
 const set=async(id,value)=>ui.locator('#'+id).evaluate((el,v)=>{el.focus();el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.blur();},value);
 const seek=async t=>ui.evaluate(async t=>{const el=document.getElementById('preview-seek');el.value=String(t);el.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));return document.getElementById('advanced-canvas').toDataURL();},t);
 const original=await seek(.7);
 for(const [id,value] of Object.entries({'effect-speed':2.3,'effect-glow':38,'effect-origin-x':66,'effect-origin-y':24,'effect-color':'#36c9fa','effect-ray-count':27}))await set(id,value);
 const changed=await seek(.7);assert.notEqual(changed,original,'Recipe edits visibly affect preview');
 const beforeDuration=await ui.locator('#effect-duration').inputValue();
 await set('effect-duration',4.5);assert.equal(await ui.locator('#effect-duration').inputValue(),'4.5');
 await ui.locator('#btn-undo').click();assert.equal(await ui.locator('#effect-duration').inputValue(),beforeDuration);
 assert.equal(await seek(.7),changed,'Duration undo preserves changed recipe pixels');
 await ui.locator('#btn-redo').click();assert.equal(await ui.locator('#effect-duration').inputValue(),'4.5');
 await seek(.7);
 // Clip visual keyframes must coexist with the effect recipe and survive serialization.
 const diamond=ui.locator('[data-keyframe="transform.opacity"]');
 await diamond.evaluate(b=>b.click());
 await set('visual-transform-opacity',61);
 const savedPixels=await seek(.7);
 const pending=ui.waitForEvent('download',{timeout:20000});
 await ui.locator('#btn-save-project').click();
 const download=await pending,bytes=readFileSync(await download.path()),saved=JSON.parse(bytes.toString());
 const clip=saved.tracks.find(t=>t.effectOverlay?.presetId==='starburst');assert.ok(clip);
 assert.equal(clip.clipDuration,4.5);assert.equal(clip.effectOverlay.speed,2.3);
 assert.equal(clip.effectOverlay.glow,38);assert.equal(clip.effectOverlay.originX,66);assert.equal(clip.effectOverlay.originY,24);
 assert.equal(clip.effectOverlay.color,'#36c9fa');assert.equal(clip.effectOverlay.rayCount,27);
 assert.ok(clip.keyframes?.['transform.opacity']?.length,'Visual keyframe must persist alongside recipe');
 await ui.locator('#project-open-input').setInputFiles({name:download.suggestedFilename(),mimeType:'application/json',buffer:bytes});
 await ui.locator('#timeline-action-modal').waitFor({state:'visible'});await ui.locator('#timeline-action-apply').click();
 await ui.locator('#timeline-action-modal').waitFor({state:'hidden'});
 await ui.locator('.timeline-clip.sticker:not(.placeholder)').waitFor({state:'visible'});
 assert.equal(await seek(.7),savedPixels,'Portable Open restores recipe and keyframe preview');
 assert.deepEqual(uiErrors,[]);await ui.close();
 console.log('[MotoriClip #67] PASS native recipe edit, duration undo/redo, visual keyframe and portable Save/Open');
}finally{await browser.close();await new Promise(done=>server.close(done));}
