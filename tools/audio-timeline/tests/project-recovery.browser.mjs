/**
 * Chrome acceptance for project autosave + open-file permission recovery.
 * Verifies metadata-only storage, keyframes/effects, in-memory media unload,
 * silent handle rehydration, offline placeholders and manual relink.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync,readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve,extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd(),temp=mkdtempSync(join(tmpdir(),'motori-project-'));
const fixture=join(temp,'remembered-photo.jpg');
const ff=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi',
    '-i','color=c=cyan:s=320x180:d=1','-frames:v','1','-update','1',fixture],
    {encoding:'utf8',timeout:30000});
assert.equal(ff.status,0,ff.stderr||'Unable to create still image fixture');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
    '.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{
    const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!path.startsWith(root+'/')||!existsSync(path)){res.writeHead(404);res.end('missing');return;}
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(readFileSync(path));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome required');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',
        {waitUntil:'domcontentloaded'});
    await page.locator('#file-input').setInputFiles(fixture);
    const first=page.locator('.file-row:not(.is-unlinked)').first();
    await first.waitFor({timeout:15000});
    const id=await first.getAttribute('data-file-id');
    assert.ok(id);
    const originalBytes=readFileSync(fixture).toString('base64');
    const handle=await page.evaluate(async({id,base64})=>{
        if(!navigator.storage?.getDirectory) return {supported:false};
        const dir=await navigator.storage.getDirectory();
        const h=await dir.getFileHandle('remembered-photo.jpg',{create:true});
        const writer=await h.createWritable();
        await writer.write(Uint8Array.from(atob(base64),char=>char.charCodeAt(0)));
        await writer.close();
        const {saveMediaHandle,getMediaHandle}=await import('./js/media-handle-store.mjs');
        const saved=await saveMediaHandle(id,h);
        const reloaded=await getMediaHandle(id);
        return {supported:true,saved,reloaded:reloaded?.name===h.name};
    },{id,base64:originalBytes});
    assert.equal(handle.supported,true,'Chrome OPFS file handles expected');
    assert.equal(handle.saved,true);
    assert.equal(handle.reloaded,true);
    await page.evaluate(id=>{
        const dt=new DataTransfer();
        dt.setData('application/x-organon-project-file',id);
        document.querySelector('#timeline-empty').dispatchEvent(new DragEvent('drop',{
            bubbles:true,cancelable:true,dataTransfer:dt,clientX:200,clientY:420
        }));
    },id);
    await page.locator('.timeline-clip.background:not(.placeholder)').waitFor({timeout:20000});
    const clipId=await page.locator('.timeline-clip.background:not(.placeholder)').first().getAttribute('data-track-id');
    assert.ok(clipId);
    await page.locator('#visual-transform-scale').fill('140');
    await page.locator('#visual-transform-scale').dispatchEvent('input');
    await page.locator('#visual-adjustments-contrast').fill('35');
    await page.locator('#visual-adjustments-contrast').dispatchEvent('input');
    await page.locator('[data-keyframe="transform.scale"]').click();
    await page.locator('#btn-add-marker').click();
    assert.equal(await page.locator('.timeline-cue-marker').count(),1);
    await page.locator('#btn-project-settings').click();
    await page.locator('#project-fps').selectOption('25');
    await page.locator('#canvas-width').fill('640');
    await page.locator('#canvas-height').fill('360');
    await page.locator('#btn-apply-canvas').click();
    await page.locator('#project-settings-modal [data-close-modal]').click();
    const storageKey='motori-advanced-project-recovery-v1';
    await page.waitForFunction(key=>{
        const saved=JSON.parse(localStorage.getItem(key)||'{}');
        return saved.tracks?.length===1&&saved.settings?.fps===25
            &&saved.tracks[0]?.keyframes?.['transform.scale']?.length===1
            &&saved.tracks[0]?.adjustments?.contrast===35;
    },storageKey,{timeout:10000});
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
    assert.equal(saved.tracks[0].id,clipId);
    assert.equal(saved.tracks[0].transform.scale,1.4);
    assert.equal(saved.tracks[0].adjustments.contrast,35);
    assert.deepEqual(saved.markers,[0]);
    assert.equal(saved.settings.canvasWidth,640);
    assert.equal(saved.settings.canvasHeight,360);
    assert.equal(saved.settings.fps,25);
    const serialized=JSON.stringify(saved);
    assert.ok(!serialized.includes('data:image'),'Do not store base64 pictures');
    assert.ok(!serialized.includes('blob:http'),'Never serialize media object URLs');

    // The separate legacy filename index can be stale after a storage write
    // failure or opening another project. A valid project recovery must take
    // precedence; otherwise old media-bin entries are silently resurrected.
    await page.evaluate(()=>{
        const key='motori-advanced-media-index-v1';
        const indexed=JSON.parse(localStorage.getItem(key)||'[]');
        indexed.push({id:'stale-other-project',name:'unrelated-old-source.jpg',
            kind:'background',size:8123,lastModified:1,relativePath:'old/'});
        localStorage.setItem(key,JSON.stringify(indexed));
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.timeline-clip.background:not(.needs-relink)').waitFor({timeout:20000});
    assert.equal(await page.locator('.file-row').count(),1,
        'Valid recovery must replace stale media index entries, not merge them');
    assert.equal(await page.locator('[data-file-id="stale-other-project"]').count(),0);
    assert.equal((await page.evaluate(()=>JSON.parse(
        localStorage.getItem('motori-advanced-media-index-v1')||'[]'))).length,1,
        'The corrected media index should not re-persist unrelated old project files');
    assert.equal(await page.locator('.timeline-clip.background').first().getAttribute('data-track-id'),clipId);
    assert.equal(await page.locator('#canvas-width').inputValue(),'640');
    assert.equal(await page.locator('#canvas-height').inputValue(),'360');
    await page.locator('#btn-project-settings').click();
    assert.equal(await page.locator('#project-fps').inputValue(),'25');
    await page.locator('#project-settings-modal [data-close-modal]').click();
    assert.equal(await page.locator('[data-keyframe="transform.scale"]').innerText(),'◆');
    assert.equal(await page.locator('[data-visual-output="transform.scale"]').innerText(),'140%');
    assert.equal(await page.locator('[data-visual-output="adjustments.contrast"]').innerText(),'35');
    assert.equal(await page.locator('.timeline-cue-marker').count(),1);
    console.log('[MotoriClip project recovery] PASS keyframes, edits, settings and media restored from IndexedDB handle');

    // Draft project dimensions may be visible in the dialog before the
    // user commits them. Closing/reloading must preserve the actual rendered
    // canvas size rather than mistakenly turning these draft values into
    // project settings during beforeunload autosave.
    await page.evaluate(()=>{
        const width=document.querySelector('#canvas-width');
        const height=document.querySelector('#canvas-height');
        width.value='1920';
        height.value='1080';
        // No change event: these values have NOT been applied to the canvas.
    });
    assert.equal(await page.locator('#advanced-canvas').evaluate(canvas=>canvas.width),640);
    assert.equal(await page.locator('#advanced-canvas').evaluate(canvas=>canvas.height),360);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.timeline-clip.background:not(.needs-relink)').waitFor({timeout:20000});
    assert.equal(await page.locator('#canvas-width').inputValue(),'640',
        'Browser recovery must discard uncommitted canvas-width draft');
    assert.equal(await page.locator('#canvas-height').inputValue(),'360',
        'Browser recovery must discard uncommitted canvas-height draft');
    const recoveredDraft=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
    assert.equal(recoveredDraft.settings.canvasWidth,640);
    assert.equal(recoveredDraft.settings.canvasHeight,360);
    assert.equal(recoveredDraft.settings.fps,25);
    assert.equal(await page.locator('.timeline-clip.background').first().getAttribute('data-track-id'),clipId);
    console.log('[MotoriClip project recovery] PASS refresh discards uncommitted canvas changes and keeps saved edits');


    // A remembered handle may still point to the same filename after the
    // underlying file is overwritten. Never attach changed-size content to
    // the saved edits as though it were the original source.
    const overwrittenSize=await page.evaluate(async()=>{
        const dir=await navigator.storage.getDirectory();
        const handle=await dir.getFileHandle('remembered-photo.jpg');
        const writer=await handle.createWritable();
        await writer.write(Uint8Array.of(1,2,3,4,5,6,7));
        await writer.close();
        return (await handle.getFile()).size;
    });
    assert.equal(overwrittenSize,7);
    assert.notEqual(overwrittenSize,saved.files[0].size);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.timeline-clip.background.needs-relink').waitFor({timeout:15000});
    assert.equal(await page.locator('#btn-export-offline').isDisabled(),true,
        'Changed remembered source must remain offline instead of exporting wrong media');
    assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey)).files[0].size,
        saved.files[0].size,'The original source-size metadata must not be overwritten');
    await page.locator('#file-input').setInputFiles(fixture);
    await page.locator('.timeline-clip.background:not(.needs-relink)').waitFor({timeout:20000});
    assert.equal(await page.locator('.timeline-clip.background').first().getAttribute('data-track-id'),clipId);
    console.log('[MotoriClip project recovery] PASS changed-size remembered handles remain offline until reimport');

    // Simulate revoked/missing handle on a subsequent launch; the layout must
    // remain recoverable instead of deleting its original clip.
    await page.evaluate(async()=>{
        const {clearMediaHandles}=await import('./js/media-handle-store.mjs');
        await clearMediaHandles();
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#file-count').waitFor();
    await page.locator('.timeline-clip.background.needs-relink').waitFor({timeout:15000});
    assert.equal(await page.locator('.timeline-clip.background').first().getAttribute('data-track-id'),clipId);
    assert.equal(await page.locator('#btn-export-offline').isDisabled(),true,
        'Incomplete projects must not export without required media');
    await page.locator('#file-input').setInputFiles(fixture);
    await page.locator('.timeline-clip.background:not(.needs-relink)').waitFor({timeout:20000});
    assert.equal(await page.locator('.timeline-clip.background').count(),1);
    console.log('[MotoriClip project recovery] PASS offline placeholder and manual same-source reimport');

    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#btn-clear').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.background').length===0);
    await page.reload({waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('.timeline-clip.background').count(),0);
    assert.match(await page.locator('#file-count').innerText(),/0 media/i);
    assert.deepEqual(errors,[],'Chrome script errors during project recovery');
    console.log('[MotoriClip project recovery] PASS Clear All remains cleared after reload');

    // Text and effects are generated PNGs, not original disk files. Their
    // small saved preset/text recipes must reproduce them after reopening.
    await page.locator('[data-library-tab="text"]').click();
    await page.locator('#text-overlay-value').fill('RECOVER THIS TITLE');
    await page.locator('#text-library-grid [data-preset-id="neon-cyan"]').click();
    await page.locator('.timeline-clip.sticker:not(.placeholder)').first().waitFor({timeout:15000});
    await page.locator('[data-library-tab="effects"]').click();
    await page.locator('#effects-library-grid [data-preset-id="film-grain"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.sticker:not(.placeholder)').length===2,
        null,{timeout:15000});
    const overlayNames=await page.locator('.timeline-clip.sticker .clip-label').allTextContents();
    await page.waitForFunction(key=>{
        const saved=JSON.parse(localStorage.getItem(key)||'{}');
        return saved.files?.some(f=>f.generated?.group==='text'&&f.generated?.value==='RECOVER THIS TITLE')
            &&saved.files?.some(f=>f.generated?.group==='effect'&&f.generated?.presetId==='film-grain')
            &&saved.tracks?.length===2;
    },storageKey,{timeout:10000});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.sticker:not(.needs-relink)').length===2,
        null,{timeout:20000});
    assert.deepEqual((await page.locator('.timeline-clip.sticker .clip-label').allTextContents()).sort(),
        overlayNames.sort(),'Generated overlays must retain their original clip sources and names');
    assert.equal(await page.locator('.file-row.is-unlinked').count(),0,
        'Generated overlays should re-create on reopen without a filesystem picker');
    console.log('[MotoriClip project recovery] PASS generated title and film-grain PNG regeneration from small saved recipes');
    assert.deepEqual(errors,[],'Chrome script errors during recovery');
    await context.close();
} finally{
    await browser.close();
    server.close();
    rmSync(temp,{recursive:true,force:true});
}
