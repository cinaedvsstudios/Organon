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
 const ids=await page.evaluate(async()=>(await import('./js/timeline-effects.mjs')).TIMELINE_EFFECTS.map(p=>p.id));
 assert.equal(ids.length,43);
 const card=id=>page.locator('#effects-library-grid [data-preset-id="'+id+'"]');
 const read=id=>card(id).locator('canvas').evaluate(c=>({seconds:Number(c.dataset.effectPreviewSeconds),png:c.toDataURL(),w:c.width,h:c.height}));
 for(const id of ids){
  const actual=await read(id);
  assert.equal(actual.w,288);assert.equal(actual.h,162);
  const expected=await page.evaluate(async id=>{const {paintEffectThumbnail}=await import('./js/effect-library-preview.mjs');const c=document.createElement('canvas');c.width=288;c.height=162;paintEffectThumbnail(c,id);return c.toDataURL();},id);
  assert.equal(actual.png,expected,id+' actual thumbnail uses its real procedural recipe');
  if(['glass-glitch','glitch-flux','mist-fog-bank','fire-explosion','camera-frame','pixel-scan'].includes(id))console.log('[MotoriClip #69 artwork '+id+'] '+actual.png);
 }
 await card('glitch-flux').hover();
 await page.waitForFunction(()=>document.querySelector('[data-preset-id="glitch-flux"]').dataset.effectHoverActive==='true');
 await page.waitForTimeout(350);
 const first=await read('glitch-flux');await page.waitForTimeout(250);const second=await read('glitch-flux');
 assert.notEqual(first.png,second.png,'hover must show actual animation');
 assert.ok(second.seconds>first.seconds);
 await card('glass-glitch').hover();
 assert.equal(await page.locator('[data-effect-hover-active="true"]').count(),1);
 await page.locator('[data-library-tab="media"]').click();
 assert.equal(await page.locator('[data-effect-hover-active="true"]').count(),0);
 const stopped=await read('glass-glitch');await page.waitForTimeout(250);assert.deepEqual(await read('glass-glitch'),stopped);
 await page.locator('[data-library-tab="effects"]').click();
 await page.emulateMedia({reducedMotion:'reduce'});await card('glitch-flux').hover();await page.waitForTimeout(200);
 assert.equal(await page.locator('[data-effect-hover-active="true"]').count(),0);
 assert.deepEqual(errors,[]);
 console.log('[MotoriClip #69 all 43 real recipe posters, single hover, hidden panel stop, reduced motion] PASS');
}finally{await browser.close();await new Promise(done=>server.close(done));}
