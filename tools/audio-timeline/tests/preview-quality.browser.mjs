import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=createServer((req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent((req.url||'/').split('?')[0]));if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}const bytes=readFileSync(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch(e){res.writeHead(404);res.end(String(e.message));}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';assert.ok(existsSync(chrome));
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1450,height:900},acceptDownloads:true}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',msg=>{if(['error','warning'].includes(msg.type()))console.log('[preview browser]',msg.text().slice(0,500));});
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 const quality=page.locator('#preview-quality');
 const size=()=>page.locator('#advanced-canvas').evaluate(c=>[c.width,c.height]);
 const geometry=()=>page.locator('#preview-stage').evaluate(c=>{const r=c.getBoundingClientRect();return [r.width,r.height]});
 assert.equal(await quality.inputValue(),'normal');
 const orig=await geometry();
 assert.equal(await quality.evaluate(el=>el.closest('#preview-stage')===null),true);
 for(const [q,d] of [['low',[320,180]],['fast',[640,360]],['normal',[1280,720]]]){
  await quality.selectOption(q);assert.deepEqual(await size(),d);assert.deepEqual(await geometry(),orig);
 }
 await quality.selectOption('low');await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#advanced-canvas').width===320);
 assert.equal(await quality.inputValue(),'low');
 await page.locator('[data-library-tab="text"]').click();
 await page.locator('#text-library-grid [data-preset-id="neon-cyan"]').click();
 await page.locator('.timeline-clip.sticker:not(.placeholder)').waitFor({state:'visible'});
 const slider=page.locator('#preview-seek');
 await slider.fill('1');await slider.dispatchEvent('input');await slider.dispatchEvent('change');
 const probe=async id=>{
  const pending=page.waitForEvent('download');await page.locator(id).click();
  const dl=await pending;const path=await dl.path();
  const ff=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,codec_name','-of','json',path],{encoding:'utf8'});
  assert.equal(ff.status,0,ff.stderr);const info=JSON.parse(ff.stdout).streams[0];
  assert.deepEqual([info.width,info.height],[1280,720]);return {path,info};
 };
 const lowPng=await probe('#btn-snapshot');
 await probe('#btn-snapshot-jpeg');assert.deepEqual(await size(),[320,180]);
 await quality.selectOption('normal');const normalPng=await probe('#btn-snapshot');
 assert.deepEqual(readFileSync(lowPng.path),readFileSync(normalPng.path),'Low and Normal full-size PNG must be identical at same paused time');
 await quality.selectOption('low');
 const pending=page.waitForEvent('download');await page.locator('#btn-save-project').click();const backup=await pending;
 const record=JSON.parse(readFileSync(await backup.path(),'utf8'));
 assert.deepEqual([record.settings.canvasWidth,record.settings.canvasHeight],[1280,720]);
 // Actual live recorder with a short generated title, then a cancellation and retry.
 await page.locator('#btn-project-export').click();
 const live=page.locator('#btn-export-video');
 await live.waitFor({state:'visible'});
 const fmt=page.locator('#export-format');const supported=await fmt.locator('option').evaluateAll(o=>o.filter(x=>!x.disabled&&x.value).map(x=>x.value));
 assert.ok(supported.length);
 await fmt.selectOption(supported[0]);
 console.log('[preview quality before live]',await page.locator('#export-status').innerText(),await live.isEnabled(),await page.locator('#time-readout').innerText(),supported);
 await live.click();
 try{await page.waitForFunction(()=>document.querySelector('#advanced-canvas').width===1280, null,{timeout:10000});}catch(error){console.log('[preview quality live diagnostics]',await page.evaluate(()=>({status:document.getElementById('export-status').textContent,overlay:document.getElementById('export-overlay-status').textContent,preview:document.getElementById('preview-state').textContent,hidden:document.hidden,canvas:document.getElementById('advanced-canvas').width,disabled:document.getElementById('btn-export-video').disabled})),errors);throw error;}
 await page.locator('#btn-export-cancel').click();
 await page.waitForFunction(()=>document.querySelector('#advanced-canvas').width===320);
 const video=page.waitForEvent('download',{timeout:60000});await live.click();
 const dl=await video;const ff=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,codec_name','-of','json',await dl.path()],{encoding:'utf8'});
 assert.equal(ff.status,0,ff.stderr);const info=JSON.parse(ff.stdout).streams[0];
 assert.deepEqual([info.width,info.height],[1280,720]);
 await page.waitForFunction(()=>document.querySelector('#advanced-canvas').width===320);
 assert.equal(await quality.inputValue(),'low');assert.deepEqual(errors,[]);
 console.log('[MotoriClip #71–72] PASS physical preview sizes, unchanged geometry, reload, full project metadata, PNG/JPEG, byte-identical snapshots, real live video, cancel/retry and restore',info);
}finally{await browser.close();await new Promise(done=>server.close(done));}
