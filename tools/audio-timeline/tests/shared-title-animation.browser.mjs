import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=createServer((req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent((req.url||'/').split('?')[0]));if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(path));}catch(e){res.writeHead(404);res.end(String(e.message));}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';assert.ok(existsSync(chrome));
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1450,height:900},acceptDownloads:true}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 await page.locator('[data-library-tab="text"]').click();
 await page.locator('#text-library-grid [data-preset-id="neon-cyan"]').click();
 const out=page.locator('#text-out-animation'),entrance=page.locator('#text-in-animation');
 await out.waitFor({state:'visible'});
 assert.equal(await out.inputValue(),'reverse-in');
 assert.deepEqual(await out.locator('option').evaluateAll(a=>a.slice(1).map(x=>x.value)),await entrance.locator('option').evaluateAll(a=>a.map(x=>x.value)));
 await entrance.selectOption('slide');assert.equal(await out.inputValue(),'reverse-in');
 await out.selectOption('wave');assert.equal(await out.inputValue(),'wave');
 await out.selectOption('reverse-in');
 const d=page.waitForEvent('download');await page.locator('#btn-save-project').click();const dl=await d;
 const record=JSON.parse(readFileSync(await dl.path(),'utf8'));
 assert.ok(record.tracks.some(t=>t.textOverlay?.inAnimation==='slide'&&t.textOverlay?.outAnimation==='reverse-in'));
 const results=await page.evaluate(async()=>{
  const {TEXT_ANIMATIONS,paintTimelineText}=await import('./js/text-template-renderer.mjs');
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const results=[];
  for(const [animation] of TEXT_ANIMATIONS.filter(([id])=>id!=='none')){
   const design={'handwriting-reveal':'handwritten-script','location-drop':'location-card','countdown-roll':'countdown-title','split-enter':'split-title'}[animation]||'neon-cyan';
   const cfg={presetId:design,value:'TITLE',phasedAnimation:true,inAnimation:animation,inDuration:1,outDuration:2,animationEasing:'ease-in-out'};
   const render=t=>{ctx.clearRect(0,0,320,180);paintTimelineText(ctx,320,180,cfg,t,4);return canvas.toDataURL();};
   for(const t of [.125,.25,.5,.75,.875]){
    const a=render(t),b=render(4-2*t);
    results.push({animation,t,equal:a===b});
   }
   if(animation==='slide'||animation==='typewriter')results.push({animation,t:'motion',equal:render(.25)!==render(.75)});
  }return results;
 });
 for(const v of results)assert.ok(v.equal,JSON.stringify(v));
 assert.deepEqual(errors,[]);
 console.log('[MotoriClip #70] PASS shared catalog, native defaults, portable save and '+results.length+' reverse pixel/motion comparisons');
}finally{await browser.close();await new Promise(done=>server.close(done));}
