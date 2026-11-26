import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=createServer((req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent((req.url||'/').split('?')[0]));if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}const bytes=readFileSync(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch(e){res.writeHead(404);res.end(String(e.message));}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';assert.ok(existsSync(chrome));
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox']});
const url='http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html';
try{
 const page=await browser.newPage({viewport:{width:1450,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const geometry=page=>page.evaluate(()=>{
  const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,width:r.width};};
  const inspector=document.querySelector('.inspector-scroll'),timeline=document.querySelector('.timeline-scroll'),bin=document.querySelector('#file-list');
  return {viewer:box('.master-column'),stage:box('#preview-stage'),project:box('.project-column'),inspector:box('.right-column'),header:box('.right-column .column-heading'),timeline:box('#timeline-panel'),pageWidth:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,inspectorScroll:inspector.scrollHeight,inspectorClient:inspector.clientHeight,inspectorOverflow:getComputedStyle(inspector).overflowY,timelineOverflow:getComputedStyle(timeline).overflowX,bin:{height:bin.clientHeight,scroll:bin.scrollHeight,rows:[...bin.querySelectorAll('.file-row')].map(r=>r.getBoundingClientRect().height)},gap:parseFloat(getComputedStyle(document.querySelector('.advanced-grid')).rowGap)};
 });
 const waitLock=()=>page.waitForFunction(()=>Math.abs(document.querySelector('.master-column').getBoundingClientRect().height-document.querySelector('.right-column').getBoundingClientRect().height)<3);
 const assertDesktop=g=>{assert.ok(Math.abs(g.viewer.height-g.inspector.height)<3,JSON.stringify(g));assert.ok(Math.abs(g.timeline.top-g.viewer.bottom-g.gap)<3,'timeline gap '+JSON.stringify(g));assert.ok(Math.abs(g.timeline.left-g.viewer.left)<3);assert.ok(Math.abs(g.timeline.right-g.inspector.right)<3);};
 await waitLock();assertDesktop(await geometry(page));
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;c.getContext('2d').fillRect(0,0,64,64);return c.toDataURL().split(',')[1];});
 await page.locator('#file-input').setInputFiles(Array.from({length:12},(_,i)=>({name:'layout-'+i+'.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})));
 await page.waitForFunction(()=>document.querySelectorAll('.file-row').length===12);
 await waitLock();let g=await geometry(page);assertDesktop(g);assert.equal(g.bin.rows.length,12);assert.ok(g.bin.rows.every(h=>Math.abs(h-62)<1));assert.ok(g.bin.scroll>g.bin.height);assert.ok(g.bin.height<=8*62+7*7+18+2);
 await page.locator('#file-list').evaluate(e=>e.scrollTop=e.scrollHeight);await page.locator('.file-row').last().focus();assert.equal(await page.locator('.file-row').last().evaluate(e=>e===document.activeElement),true);
 console.log('[MotoriClip #84] PASS twelve equal media rows, eight-row cap, native scrolling and focus');
 await page.locator('[data-library-tab="text"]').click();await page.locator('#text-library-grid [data-preset-id="neon-cyan"]').click();
 await page.locator('#text-motion-details').waitFor({state:'visible'});await waitLock();g=await geometry(page);assertDesktop(g);
 assert.equal(g.inspectorOverflow,'auto');assert.ok(g.inspectorScroll>g.inspectorClient,'title controls must be internally scrollable');
 const titleTop=g.header.top;await page.locator('.inspector-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);g=await geometry(page);assert.equal(g.header.top,titleTop);assertDesktop(g);
 const handle=await page.locator('#preview-resize-handle').boundingBox();assert.ok(handle);
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x-100,handle.y,{steps:8});await page.mouse.up();
 await page.waitForFunction(initial=>document.querySelector('#preview-stage').getBoundingClientRect().width<initial-30,g.stage.width);
 await waitLock();assertDesktop(await geometry(page));
 console.log('[MotoriClip #73/#86/#87] PASS viewer-adjacent timeline with tall bin and title Inspector, fixed header, independent scroll and live viewer resize');
 for(const width of [1120,900,700,393]){
  await page.setViewportSize({width,height:850});
  await page.waitForFunction(()=>document.querySelector('.right-column').style.height==='');
  g=await geometry(page);assert.ok(g.pageWidth<=g.viewport+2,JSON.stringify(g));assert.ok(g.timeline.right<=g.viewport+2);
  assert.ok(g.timeline.bottom<=g.inspector.top+2,'stacked Inspector must not delay timeline');
  assert.ok(g.inspector.height<=Math.min(850*.55,480)+2);
  assert.equal(g.timelineOverflow,'auto');assert.equal(g.inspectorOverflow,'auto');
  if(width<=760)assert.ok(Math.abs(g.timeline.top-g.viewer.bottom-g.gap)<3,JSON.stringify(g));
 }
 const phone=await browser.newPage({viewport:{width:393,height:851},isMobile:true,hasTouch:true});
 await phone.goto(url,{waitUntil:'domcontentloaded'});g=await geometry(phone);
 assert.ok(g.pageWidth<=g.viewport+2,JSON.stringify(g));
 assert.ok(await phone.locator('#preview-resize-handle').evaluate(e=>e.getBoundingClientRect().height>=36));
 assert.ok(await phone.locator('#btn-play').evaluate(e=>e.getBoundingClientRect().height>=36));
 assert.deepEqual(errors,[]);
 console.log('[MotoriClip #74] PASS 1120/900/700/393 viewport bounds, internal timeline scroll and coarse-pointer targets');
}finally{await browser.close();await new Promise(done=>server.close(done));}
