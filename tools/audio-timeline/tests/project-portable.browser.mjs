/**
 * Real Chrome acceptance: Save Project as portable JSON, Clear All, Open
 * Project, regenerate overlays, restore edits, and relink external media.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync,readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve,extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd(),temp=mkdtempSync(join(tmpdir(),'motori-portable-project-'));
const original=join(temp,'portable-source.jpg');
const ffmpeg=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','lavfi','-i','color=c=purple:s=320x180:d=1',
    '-frames:v','1','-update','1',original],{encoding:'utf8',timeout:30000});
assert.equal(ffmpeg.status,0,ffmpeg.stderr||'Could not create fixture');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
    '.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{
    const pathname=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!pathname.startsWith(root+'/')||!existsSync(pathname)){
        res.writeHead(404);res.end('not found');return;
    }
    res.writeHead(200,{'Content-Type':types[extname(pathname)]||'application/octet-stream',
        'Cache-Control':'no-store'});
    res.end(readFileSync(pathname));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome is required');
const browser=await chromium.launch({executablePath:chrome,headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage']});
try {
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html',
        {waitUntil:'domcontentloaded'});
    await page.locator('#file-input').setInputFiles(original);
    await page.locator('.file-row:not(.is-unlinked)').waitFor({timeout:15000});
    const fileId=await page.locator('.file-row').first().getAttribute('data-file-id');
    assert.ok(fileId);
    await page.evaluate(fileId=>{
        const dt=new DataTransfer();
        dt.setData('application/x-organon-project-file',fileId);
        document.querySelector('#timeline-empty').dispatchEvent(new DragEvent('drop',{
            bubbles:true,cancelable:true,dataTransfer:dt,clientX:200,clientY:420
        }));
    },fileId);
    await page.locator('.timeline-clip.background:not(.placeholder)').waitFor({timeout:20000});
    const backgroundId=await page.locator('.timeline-clip.background').first().getAttribute('data-track-id');
    await page.locator('#visual-transform-scale').fill('135');
    await page.locator('#visual-transform-scale').dispatchEvent('input');
    await page.locator('[data-keyframe="transform.scale"]').click();
    await page.locator('#btn-add-marker').click();
    await page.locator('#btn-project-settings').click();
    await page.locator('#canvas-width').fill('640');
    await page.locator('#canvas-height').fill('360');
    await page.locator('#btn-apply-canvas').click();
    await page.locator('#project-fps').selectOption('25');
    await page.locator('#project-settings-modal [data-close-modal]').click();

    await page.locator('[data-library-tab="text"]').click();
    await page.locator('#text-overlay-value').fill('PORTABLE PROJECT');
    await page.locator('#text-library-grid [data-preset-id="neon-cyan"]').click();
    await page.locator('.timeline-clip.sticker:not(.placeholder)').first().waitFor({timeout:15000});
    await page.locator('[data-library-tab="effects"]').click();
    await page.locator('#effects-library-grid [data-preset-id="film-grain"]').click();
    await page.waitForFunction(()=>
        document.querySelectorAll('.timeline-clip.sticker:not(.placeholder)').length===2,
        null,{timeout:15000});
    const clipIds=await page.locator('.timeline-clip').evaluateAll(nodes=>nodes
        .map(node=>node.dataset.trackId).filter(Boolean).sort());
    assert.equal(clipIds.length,3);
    const downloaded=page.waitForEvent('download',{timeout:20000});
    await page.locator('#btn-save-project').click();
    const backup=await downloaded;
    assert.match(backup.suggestedFilename(),/^motoriclip-project-\d{8}-\d{4}\.motoriclip\.json$/);
    const savedPath=await backup.path();
    assert.ok(savedPath);
    const json=readFileSync(savedPath,'utf8');
    const record=JSON.parse(json);
    assert.equal(record.version,1);
    assert.equal(record.tracks.length,3);
    assert.equal(record.files.length,3);
    assert.equal(record.settings.canvasWidth,640);
    assert.equal(record.settings.canvasHeight,360);
    assert.equal(record.settings.fps,25);
    assert.equal(record.markers.length,1);
    assert.ok(record.history.undo.length>=3,'Portable backup preserves editing history');
    assert.deepEqual(record.history.redo,[]);
    assert.ok(record.files.some(file=>file.generated?.group==='text'
        &&file.generated?.value==='PORTABLE PROJECT'));
    assert.ok(record.files.some(file=>file.generated?.group==='effect'
        &&file.generated?.presetId==='film-grain'));
    assert.ok(!json.includes('data:image'),'Portable JSON cannot embed base64 pictures');
    assert.ok(!json.includes('blob:http'),'Portable JSON cannot embed object URLs');
    assert.ok(json.length<250000,'Portable backup must stay compact even with history snapshots');
    console.log('[MotoriClip portable] PASS Save Project downloads compact JSON with all three clips and generated recipes');

    page.once('dialog',dialog=>dialog.accept());
    await page.locator('[data-library-tab="media"]').click();
    await page.locator('#btn-clear').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip').length===0);
    // Opening a project requires a confirmation before replacing the timeline.
    let confirmed=0;
    page.once('dialog',async dialog=>{confirmed++;await dialog.accept();});
    await page.locator('#project-open-input').setInputFiles({
        name:backup.suggestedFilename(),mimeType:'application/json',
        buffer:Buffer.from(json)
    });
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip').length===3,
        null,{timeout:20000});
    assert.equal(confirmed,1);
    await page.locator('.timeline-clip.background.needs-relink').waitFor({timeout:15000});
    await page.waitForFunction(()=>
        document.querySelectorAll('.timeline-clip.sticker:not(.needs-relink)').length===2,
        null,{timeout:15000});
    const restoredIds=await page.locator('.timeline-clip').evaluateAll(nodes=>nodes
        .map(node=>node.dataset.trackId).filter(Boolean).sort());
    assert.deepEqual(restoredIds,clipIds,'Portable backup must retain original clip IDs');
    assert.equal(await page.locator('.timeline-clip.background').first().getAttribute('data-track-id'),backgroundId);
    assert.equal(await page.locator('#btn-export-offline').isDisabled(),true,
        'Missing media must disable exporting rather than render blank');
    assert.equal(await page.locator('#canvas-width').inputValue(),'640');
    assert.equal(await page.locator('#canvas-height').inputValue(),'360');
    await page.locator('#btn-project-settings').click();
    assert.equal(await page.locator('#project-fps').inputValue(),'25');
    await page.locator('#project-settings-modal [data-close-modal]').click();
    assert.equal(await page.locator('.timeline-cue-marker').count(),1);
    assert.equal(await page.locator('#btn-undo').isDisabled(),false,
        'Portable project import must restore Undo history');
    await page.locator('#btn-undo').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip').length===2,
        null,{timeout:20000});
    assert.equal(await page.locator('#btn-redo').isDisabled(),false);
    await page.locator('#btn-redo').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip').length===3,
        null,{timeout:20000});
    await page.locator('.timeline-clip.background.needs-relink').waitFor({timeout:15000});
    assert.equal(await page.locator('#btn-export-offline').isDisabled(),true,
        'Undo/Redo with offline media must still prohibit export');
    console.log('[MotoriClip portable] PASS reopened project restores Undo/Redo with offline media, generated overlays, markers, dimensions and FPS');

    const beforeFailure=await page.locator('.timeline-clip').count();
    await page.locator('#project-open-input').setInputFiles({
        name:'invalid.motoriclip.json',mimeType:'application/json',
        buffer:Buffer.from('{"version": 999, "tracks": []}')
    });
    await page.waitForFunction(()=>document.querySelector('#app-toast')?.textContent?.includes('Cannot open project'),
        null,{timeout:5000});
    assert.equal(await page.locator('.timeline-clip').count(),beforeFailure,
        'An invalid backup must not delete or replace current timeline');

    await page.locator('#file-input').setInputFiles(original);
    await page.locator('.timeline-clip.background:not(.needs-relink)').waitFor({timeout:20000});
    assert.equal(await page.locator('.timeline-clip').count(),3);
    assert.deepEqual(errors,[],'No uncaught Chrome errors during portable project round trip');
    console.log('[MotoriClip portable] PASS rejected invalid backup and manually relinked media without losing imported edits');
    await context.close();
} finally {
    await browser.close();
    server.close();
    rmSync(temp,{recursive:true,force:true});
}
