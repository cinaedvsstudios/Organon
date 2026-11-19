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
    assert.equal(await page.locator('#motori-header').getAttribute('class'),'top-panel is-collapsed');
    assert.equal(await page.locator('#project-export-modal').isVisible(),false);
    await page.locator('#btn-project-settings').click();
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
    await page.locator('#project-settings-modal [data-close-modal]').click();
    await page.locator('#btn-project-export').click();
    assert.ok(await page.locator('#btn-export-video').isVisible());
    assert.ok(await page.locator('#btn-export-offline').isVisible());
    await page.locator('#project-export-modal [data-close-modal]').click();
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
    // Reimported local media should survive as metadata and can be relinked.
    await page.locator('#file-input').setInputFiles(file);
    await page.locator('.file-row:not(.is-unlinked)').waitFor();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.file-row.is-unlinked').waitFor();
    await page.locator('#file-input').setInputFiles(file);
    await page.locator('.file-row:not(.is-unlinked)').waitFor();
    await page.evaluate(()=>{
        const row=document.querySelector('.file-row'),dt=new DataTransfer();
        dt.setData('application/x-organon-project-file',row.dataset.fileId);
        document.querySelector('#timeline-empty').dispatchEvent(
            new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:215,clientY:450}));
    });
    await page.locator('.timeline-clip.background:not(.placeholder)').waitFor({timeout:15000});
    await page.locator('.timeline-clip.background').first().click({button:'right'});
    assert.ok(await page.locator('#context-toggle-visible').isVisible());
    await page.locator('#context-toggle-visible').click();
    await page.locator('.timeline-clip.background.is-hidden').waitFor();
    await page.locator('.timeline-clip.background').first().click({button:'right'});
    await page.locator('#context-toggle-visible').click();
    assert.equal(await page.locator('.timeline-clip.background.is-hidden').count(),0);
    await page.locator('.timeline-clip.background').first().click({button:'right'});
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#context-download-source').click();
    const download=await downloadPromise;
    assert.equal(download.suggestedFilename(),'ui-test.jpg');
    await page.locator('.timeline-clip.background').first().click({button:'right'});
    await page.locator('#context-copy').click();
    await page.locator('.timeline-clip.background').first().click({button:'right'});
    await page.locator('#context-paste').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.background:not(.placeholder)').length===2);
    const beforeNudge=await page.locator('.timeline-clip.background.selected').evaluate(el=>parseFloat(el.style.left));
    await page.locator('#btn-nudge-right').click();
    const afterNudge=await page.locator('.timeline-clip.background.selected').evaluate(el=>parseFloat(el.style.left));
    assert.ok(afterNudge>beforeNudge,'Nudge must move selected clip by one frame');
    await page.locator('#btn-undo').click();
    await page.locator('#btn-redo').click();
    await page.locator('.timeline-clip.background.selected').click({button:'right',position:{x:16,y:16}});
    await page.locator('#context-slice-click').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.background:not(.placeholder)').length===3);
    await page.locator('#timeline-ruler').click({position:{x:167,y:12}});
    await page.locator('#btn-add-marker').click();
    assert.equal(await page.locator('.timeline-cue-marker').count(),1);
    await page.locator('#btn-next-marker').click();
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#btn-clear').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip').length===0);
    // Functional overlay asset library: template click makes an actual PNG clip.
    await page.locator('[data-library-tab="effects"]').click();
    assert.equal(await page.locator('#effects-library-grid .asset-preset-card').count(),12);
    assert.ok(await page.locator('#effects-library-panel').isVisible());
    await page.locator('#effects-library-grid [data-preset-id="vignette"]').click();
    await page.locator('.timeline-clip.sticker:not(.placeholder)').first().waitFor({timeout:15000});
    await page.locator('[data-library-tab="text"]').click();
    await page.locator('#text-overlay-value').fill('NEW TITLE');
    assert.equal(await page.locator('#text-library-grid .asset-preset-card').count(),12);
    await page.locator('#text-library-grid [data-preset-id="neon-cyan"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.sticker:not(.placeholder)').length===2,null,{timeout:15000});
    assert.ok(await page.locator('.timeline-clip.sticker .clip-label').allTextContents()
        .then(names=>names.some(name=>/text-neon-cyan-NEW-TITLE/i.test(name))),
        'Text preset should create a real named PNG sticker clip');
    await page.locator('#visual-transform-scale').fill('140');
    await page.locator('#visual-transform-scale').dispatchEvent('input');
    assert.equal(await page.locator('[data-visual-output="transform.scale"]').innerText(),'140%');
    await page.locator('[data-keyframe="transform.scale"]').click();
    assert.equal(await page.locator('[data-keyframe="transform.scale"]').innerText(),'◆');
    await page.locator('#visual-adjustments-contrast').fill('35');
    await page.locator('#visual-adjustments-contrast').dispatchEvent('input');
    assert.equal(await page.locator('[data-visual-output="adjustments.contrast"]').innerText(),'35');
    assert.equal(await page.locator('#visual-speed-panel').isVisible(),false,'Still images have no playback speed');

    await page.locator('[data-library-tab="media"]').click();
    assert.ok(await page.locator('#project-drop-zone').isVisible());
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#btn-clear').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip').length===0);
    assert.equal(await page.locator('#timeline-ruler').isVisible(),true,
        'Timeline second labels must be visible without extra clicks');
    assert.ok(await page.locator('#timeline-ruler span:not(.ruler-spacer)').count() > 0,
        'Timeline ruler should expose clickable second markers');
    assert.equal(await page.locator('#btn-toggle-ruler').count(),0,'Ruler toggle should not waste toolbar space');
    assert.equal(await page.locator('#timeline-ruler').evaluate(el=>el.nextElementSibling?.id),'timeline-lanes',
        'Timeline ruler must sit above the tracks');
    assert.equal(await page.locator('#timeline-ruler').evaluate(el=>getComputedStyle(el).userSelect),'none',
        'Timeline ruler must never select highlighted text');
    await page.locator('#btn-add-track').click();
    assert.equal(await page.locator('#track-type-menu').isVisible(),true);
    const menuGeometry=await page.evaluate(()=>{
        const menu=document.getElementById('track-type-menu');
        const box=menu.getBoundingClientRect();
        return {parent:menu.parentElement?.tagName,top:box.top,bottom:box.bottom,
            left:box.left,right:box.right,viewportHeight:window.innerHeight,
            viewportWidth:window.innerWidth};
    });
    assert.equal(menuGeometry.parent,'BODY','Popup must escape the editor panel overflow');
    assert.ok(menuGeometry.top>=0&&menuGeometry.bottom<=menuGeometry.viewportHeight,
        'Add Track popup must fit vertically within viewport: '+JSON.stringify(menuGeometry));
    assert.ok(menuGeometry.left>=0&&menuGeometry.right<=menuGeometry.viewportWidth,
        'Add Track popup must fit horizontally within viewport: '+JSON.stringify(menuGeometry));
    await page.locator('[data-add-track-type="video"]').click();
    assert.match(await page.locator('.lane-name').first().innerText(),/Video 1/i);
    await page.locator('#btn-open-transitions').click();
    assert.ok(await page.locator('#transition-modal').isVisible());
    assert.match(await page.locator('#transition-modal-status').innerText(),/at least two visual clips/i);
    await page.locator('#transition-modal [data-close-modal]').click();
    await page.locator('#btn-toggle-header').click();
    await page.locator('#btn-basic-mode').click();
    await page.waitForURL(/index\.html\?mode=basic/,{timeout:15000});
    assert.ok(await page.locator('#btn-advanced-mode').isVisible());
    await page.locator('#btn-advanced-mode').click();
    await page.waitForURL(/advanced\.html/,{timeout:15000});
    assert.deepEqual(crashes,[],'Desktop editor raised uncaught script errors');
    console.log('[MotoriClip UI] PASS compact header, dialogs, track/ruler/transition actions, FPS/canvas/zoom, history and mode switching');

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
    await phone.locator('#btn-toggle-header').click();
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
