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
  const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#0c1722';ctx.fillRect(0,0,640,360);ctx.strokeStyle='rgba(117,178,222,.08)';
  for(let x=0;x<640;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,360);ctx.stroke();}
  if(requiresCompositeSource(id))paintEffectPreviewScene(ctx,640,360);
  paintTimelineEffect(ctx,640,360,{presetId:id},0,3);
  let hash=2166136261;for(const v of ctx.getImageData(0,0,640,360).data)hash=Math.imul(hash^v,16777619)>>>0;return hash;
 },id);
 for(const {id} of catalog){
  const card=page.locator('#effects-library-grid [data-preset-id="'+id+'"]');
  await card.dispatchEvent('contextmenu');await modal.waitFor({state:'visible'});
  const zero=await capture();assert.equal(zero.time,0,id+' opens at exact time zero');assert.equal(zero.slider,'0');assert.equal(zero.hash,await independent(id),id+' first pixels equal independently rendered t=0');
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
 for(const id of ['pixel-scan','particle-dust','fire-embers','god-rays','halo-blur','rhythmic-flicker','camera-frame']){
  const entry=catalog.find(p=>p.id===id);await page.locator('#effects-library-grid [data-preset-id="'+id+'"]').click();
  await page.locator('#inspector-timeline-effect').waitFor({state:'visible'});
  for(const name of ['density','scale','direction','distortion','glow','blur','origin','color']){
   const selector='#effect-'+name+(name==='origin'?'-controls':'-control');
   assert.equal(await page.locator(selector).isVisible(),entry.groups.includes(name),id+' '+name+' visibility');
  }
  if(id==='camera-frame'){
   const rec=page.locator('#effect-show-rec');await rec.selectOption('false');
   await page.locator('#effects-library-grid [data-preset-id="camera-frame"]').click();
   assert.equal(await rec.inputValue(),'true','New camera HUD must not inherit previous clip REC setting');
  }
  console.log('[MotoriClip #67 native common groups] PASS',id,entry.groups.join(','));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(done=>server.close(done));}
