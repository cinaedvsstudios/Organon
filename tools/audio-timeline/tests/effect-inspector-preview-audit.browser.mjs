import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {spawnSync} from 'node:child_process';
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
  // Inspect each selected recipe in isolation: stacking all 43 effects here
  // would turn a native control visibility audit into a rendering stress test.
  // Delete through the real editor keyboard handler, never internal state.
  await page.evaluate(()=>document.activeElement?.blur());
  await page.keyboard.press('Delete');
  await page.locator('#inspector-timeline-effect').waitFor({state:'hidden'});
  if(id==='camera-frame'){
   await page.locator('.timeline-clip.sticker:not(.placeholder)').click();
   await page.evaluate(()=>document.activeElement?.blur());
   await page.keyboard.press('Delete');
  }
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.sticker:not(.placeholder)').length===0);
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
 // The confirm modal closes before asynchronous decoder restoration completes.
 // Undo stays disabled until recoveryLoading is cleared in the finally block.
 await ui.waitForFunction(()=>!document.getElementById('btn-undo').disabled,{},{timeout:30000});
 await ui.locator('.timeline-clip.sticker:not(.placeholder)').waitFor({state:'visible'});
 const roundTrip=ui.waitForEvent('download',{timeout:20000});
 await ui.locator('#btn-save-project').click();
 const reopened=JSON.parse(readFileSync(await (await roundTrip).path()).toString()).tracks.find(t=>t.effectOverlay?.presetId==='starburst');
 assert.ok(reopened);assert.deepEqual(reopened.effectOverlay,clip.effectOverlay,'Restored recipe metadata');
 assert.deepEqual(reopened.keyframes,clip.keyframes,'Restored keyframe metadata');
 assert.equal(reopened.clipDuration,clip.clipDuration,'Restored duration');
 assert.equal(await seek(.7),savedPixels,'Portable Open restores recipe and keyframe preview');
 // Compare externally decoded H.264 from the edited, reopened recipe and
 // keyframe state with the same actual preview times.
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
 for(const frame of frames)expected.push(rgb(['-f','image2pipe','-i','pipe:0'],Buffer.from((await seek(frame/25)).split(',')[1],'base64')));
 assert.ok(mae(expected[0],expected[2])>.05,'Edited recipe must animate');
 await ui.locator('#btn-project-export').click();
 await ui.locator('#export-offline-format').selectOption('mp4');
 await ui.waitForFunction(()=>!document.getElementById('btn-export-offline').disabled);
 const exportPending=ui.waitForEvent('download',{timeout:180000});
 await ui.locator('#btn-export-offline').click();
 const exported=await exportPending;assert.match(exported.suggestedFilename(),/\.mp4$/);
 await ui.locator('#export-overlay').waitFor({state:'hidden'});
 const path=await exported.path();assert.ok(path);
 const differences=frames.map((frame,i)=>mae(rgb(['-i',path,'-vf','select=eq(n\\,'+frame+')']),expected[i]));
 assert.ok(differences.every(v=>v<31),'Edited recipe/keyframe export differs from preview: '+differences);
 console.log('[MotoriClip #67 decoded edited recipe] PASS RGB MAE '+JSON.stringify(differences));
 assert.deepEqual(uiErrors,[]);await ui.close();
 console.log('[MotoriClip #67] PASS native recipe edit, duration undo/redo, visual keyframe and portable Save/Open');
}finally{await browser.close();await new Promise(done=>server.close(done));}
