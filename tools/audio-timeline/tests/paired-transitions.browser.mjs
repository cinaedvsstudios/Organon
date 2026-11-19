/** Phase 8B: actual Chrome editor interaction and A/B fade pairing.
 * Uses two locally generated source videos; tests the complete UI and undo.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd(),dir=mkdtempSync(join(tmpdir(),'motori-pair-'));
const files=['pair-a.mp4','pair-b.mp4'].map((name,index)=>{
    const file=join(dir,name);
    const run=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',
        '-f','lavfi','-i',index?'testsrc2=size=128x72:rate=24:duration=3':'color=c=blue:s=128x72:r=24:d=3',
        '-f','lavfi','-i','sine=frequency='+[440,660][index]+':duration=3',
        '-threads','1','-filter_threads','1','-c:v','libx264','-preset','ultrafast',
        '-pix_fmt','yuv420p','-c:a','aac','-t','3',file],{encoding:'utf8',timeout:60000});
    assert.equal(run.status,0,run.stderr||'FFmpeg fixture generation failed');
    return file;
});
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};
const server=createServer((request,response)=>{
    const file=resolve(root,'.'+new URL(request.url,'http://localhost').pathname);
    if(!file.startsWith(root+'/')||!existsSync(file)){response.writeHead(404);response.end('missing');return}
    response.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});
    response.end(readFileSync(file));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome unavailable');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
    const page=await browser.newPage({viewport:{width:1450,height:900}});
    const errors=[];
    page.on('pageerror',err=>errors.push(String(err)));
    await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/advanced.html');
    await page.locator('#transition-library-details summary').click();
    await page.locator('#transition-library-grid .transition-library-item').first().waitFor({state:'visible'});
    assert.equal(await page.locator('#transition-library-grid .transition-library-item').count(),41);
    assert.equal(await page.locator('#pair-transition-effect option').count(),41);
    assert.equal(await page.locator('#pair-transition-effect option:not([disabled])').count(),41);
    assert.match(await page.locator('#transition-library-status').innerText(),/Available now \\(41\\):/);


    await page.locator('#file-input').setInputFiles(files);
    await page.waitForFunction(()=>document.querySelectorAll('.file-row').length===2,{timeout:10000});
    // Native drag/drop event targets call the same real placement handler that
    // the pointer-drag project-files UI uses, with sourceFileId from the bin.
    await page.evaluate(()=>{
        const row=document.querySelectorAll('.file-row')[0];
        const dt=new DataTransfer();
        dt.setData('application/x-organon-project-file',row.dataset.fileId);
        document.querySelector('#timeline-empty').dispatchEvent(
            new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:230,clientY:450}));
    });
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.video:not(.placeholder)').length===1,null,{timeout:20000});
    await page.evaluate(()=>{
        const row=document.querySelectorAll('.file-row')[1];
        const dt=new DataTransfer();
        dt.setData('application/x-organon-project-file',row.dataset.fileId);
        document.querySelector('.timeline-zoom-bar').dispatchEvent(
            new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:230,clientY:450}));
    });
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.video:not(.placeholder)').length===2,null,{timeout:20000});
    await page.locator('#btn-selection-mode').click();
    await page.locator('.timeline-clip.video:not(.selected)').first().click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.video.selected').length===2);
    assert.equal(await page.locator('#pair-transition-panel').isVisible(),true);
    await page.locator('#pair-transition-duration').fill('1');
    await page.locator('#btn-apply-pair-transition').click();
    await page.locator('#video-transition-pair-note').waitFor({state:'visible',timeout:15000});
    assert.match(await page.locator('#video-transition-pair-note').innerText(),/Paired Fade/);
    const positions=await page.locator('.timeline-clip.video').evaluateAll(nodes=>nodes.map(node=>({
        startPx:parseFloat(node.style.left),gold:node.querySelectorAll('.visual-transition-marker.enter').length,
        title:node.querySelector('.clip-label')?.textContent||'' })));
    assert.equal(positions.length,2);
    assert.ok(positions.some(x=>x.gold===1),'Incoming B must show its gold transition extent');
    assert.ok(positions.some(x=>x.startPx>0),'Incoming B must have been moved into overlap');
    await page.locator('#btn-undo').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.video:not(.placeholder)').length===2);
    await page.locator('#btn-redo').click();
    await page.locator('#video-transition-pair-note').waitFor({state:'visible',timeout:15000});
    for(const [id,label] of [['pixelize','Pixelize'],['random-squares','Random squares'],['glitch-flicker','Glitch flicker'],['ripple','Ripple'],['tv-turn-off','TV turn off'],['aperture-wipe','Aperture wipe'],['spiral-wipe','Spiral wipe'],['rings-wipe','Rings wipe'],['color-panel-wipe','Color panel wipe'],['block-cover','Block cover'],['cross-hatch','Cross hatch'],['film-strip','Film strip'],['card-swipe','Card swipe'],['camera-shake','Camera shake'],['vhs-tracking','VHS tracking'],['spin','Spin'],['cube','Cube'],['cross-warp','Cross warp'],['paper-tear','Paper tear'],['ink-bleed','Ink bleed'],['splatter-wipe','Splatter wipe'],['cell-dissolve','Cell dissolve'],['bloom-dissolve','Bloom dissolve'],['smoke-dissolve','Smoke dissolve'],['vortex','Vortex'],['heat-haze','Heat haze'],['refraction','Refraction'],['liquid-fill','Liquid fill'],['disintegrate','Disintegrate'],['light-rays','Light rays'],['ascii','ASCII'],['color-codes','Color codes'],['prisms','Prisms'],['spiralblockwipe','SpiralBlockWipe'],['hologram','Hologram'],['crumple','Crumple'],['sphere','Sphere'],['snapshot','Snapshot'],['gallery','Gallery'],['brokey-dissolve','Brokey dissolve']]){
        await page.locator('.timeline-clip.video:not(.selected)').first().click();
        await page.locator('#pair-transition-panel').waitFor({state:'visible'});
        await page.locator('#pair-transition-effect').selectOption(id);
        await page.locator('#btn-apply-pair-transition').click();
        await page.locator('#video-transition-pair-note').waitFor({state:'visible'});
        assert.match(await page.locator('#video-transition-pair-note').innerText(),new RegExp('Paired '+label,'i'));
        assert.ok(await page.locator('.timeline-clip.video .visual-transition-marker.enter').count()>=1);
    }
    await page.locator('#btn-undo').click();
    await page.locator('#btn-redo').click();
    await page.locator('#video-transition-pair-note').waitFor({state:'visible'});
    assert.match(await page.locator('#video-transition-pair-note').innerText(),/Brokey dissolve/);
    assert.deepEqual(errors,[],'Chrome editor raised uncaught errors while creating/replaying a pair');
    console.log('[MotoriClip 8O] PASS 41-candidate library, 2 video imports, forty-one paired effects, gold marker, undo/redo '+JSON.stringify(positions));
}finally{
    await browser.close();
    await new Promise(done=>server.close(done));
    rmSync(dir,{force:true,recursive:true});
}
