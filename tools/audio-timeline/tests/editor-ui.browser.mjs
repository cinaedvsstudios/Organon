/**
 * Actual Chrome UI acceptance for MotoriClip's Basic/Advanced launch policy,
 * controls, project-bin import, and undo/redo.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd(), temp=mkdtempSync(join(tmpdir(),'motori-ui-'));
const file=join(temp,'ui-test.jpg');
const ff=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','lavfi','-i','color=c=yellow:s=320x180:d=1',
    '-frames:v','1','-update','1',file],{encoding:'utf8'});
if(ff.status!==0)throw Error('Fixture generation failed: '+ff.stderr);
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
    '.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer((request,response)=>{
    const path=resolve(root,'.'+new URL(request.url,'http://localhost').pathname);
    if(!path.startsWith(root+'/')||!existsSync(path)){response.writeHead(404);response.end('missing');return}
    const body=readFileSync(path);
    response.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
    response.end(body);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/';
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome unavailable');
const browser=await chromium.launch({executablePath:chrome,headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage']});
try{
    const context=await browser.newContext({viewport:{width:1450,height:900},acceptDownloads:true});
    const page=await context.newPage();
    const crashes=[];
    page.on('pageerror',error=>crashes.push(String(error)));
    await page.goto(url+'index.html',{waitUntil:'domcontentloaded'});
    await page.waitForURL(/advanced\.html/,{timeout:20000});
    await page.locator('#project-fps').waitFor({state:'visible'});
    assert.match(await page.title(),/MotoriClip.+Advanced/i);
    assert.equal(await page.locator('#project-fps').inputValue(),'30');
    await page.locator('#project-fps').selectOption('24');
    assert.equal(await page.locator('#project-fps').inputValue(),'24');
    await page.locator('#canvas-width').fill('640');
    await page.locator('#canvas-height').fill('360');
    await page.locator('#btn-apply-canvas').click();
    assert.equal(await page.locator('#advanced-canvas').getAttribute('width'),'640');
    assert.equal(await page.locator('#advanced-canvas').getAttribute('height'),'360');
    await page.locator('#preview-zoom').fill('135');
    await page.locator('#preview-zoom').dispatchEvent('input');
    assert.match(await page.locator('#preview-zoom-value').innerText(),/135%/);
    await page.locator('#btn-reset-preview-zoom').click();
    assert.match(await page.locator('#preview-zoom-value').innerText(),/100%/);
    await page.locator('#file-input').setInputFiles(file);
    await page.locator('.file-row').waitFor({state:'visible',timeout:10000});
    assert.match(await page.locator('#file-count').innerText(),/1 media/i);
    assert.ok(!(await page.locator('#btn-undo').isDisabled()),'Import should create undo history');
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#btn-clear').click();
    assert.match(await page.locator('#file-count').innerText(),/0 media/i);
    await page.locator('#btn-undo').click();
    await page.locator('.file-row').waitFor({state:'visible',timeout:10000});
    assert.match(await page.locator('#file-count').innerText(),/1 media/i);
    await page.locator('#btn-redo').click();
    await page.waitForFunction(()=>document.querySelector('#file-count')?.textContent?.includes('0 media'));
    await page.locator('#btn-basic-mode').click();
    await page.waitForURL(/index\.html\?mode=basic/,{timeout:15000});
    assert.ok(await page.locator('#btn-advanced-mode').isVisible());
    await page.locator('#btn-advanced-mode').click();
    await page.waitForURL(/advanced\.html/,{timeout:15000});
    assert.deepEqual(crashes,[],'Desktop editor raised uncaught script errors');
    console.log('[MotoriClip UI] PASS desktop routing, FPS/canvas/zoom, import-clear-undo-redo, Basic/Advanced switches');

    const mobile=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true,
        userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36'});
    const phone=await mobile.newPage(),phoneErrors=[];
    phone.on('pageerror',error=>phoneErrors.push(String(error)));
    await phone.goto(url+'index.html',{waitUntil:'domcontentloaded'});
    assert.match(phone.url(),/index\.html/);
    assert.doesNotMatch(phone.url(),/advanced\.html/);
    assert.match(await phone.title(),/MotoriClip.+Basic/i);
    await phone.locator('#btn-advanced-mode').click();
    await phone.waitForURL(/advanced\.html/,{timeout:15000});
    assert.ok(await phone.locator('#btn-basic-mode').isVisible());
    await phone.locator('#btn-basic-mode').click();
    await phone.waitForURL(/mode=basic/,{timeout:15000});
    assert.deepEqual(phoneErrors,[],'Mobile editor raised uncaught script errors');
    console.log('[MotoriClip UI] PASS mobile Basic default and manual mode switching');
}finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
    rmSync(temp,{recursive:true,force:true});
}
