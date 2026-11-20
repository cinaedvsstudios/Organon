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
    const layout=await page.evaluate(()=>{
        const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width};};
        const tops=selector=>[...document.querySelectorAll(selector)].map(el=>Math.round(el.getBoundingClientRect().top));
        const widths=selector=>[...document.querySelectorAll(selector)].map(el=>Math.round(el.getBoundingClientRect().width));
        return {preview:box('.master-column'),inspector:box('.right-column'),timeline:box('#timeline-panel'),
            primaryTops:tops('.timeline-primary-row > .timeline-tool'),
            editTops:tops('.timeline-edit-row > .timeline-tool'),
            primaryWidths:widths('.timeline-primary-row > .timeline-tool'),
            editWidths:widths('.timeline-edit-row > .timeline-tool:not(.snap-options-toggle)'),
            parent:document.querySelector('#timeline-panel')?.parentElement?.className,
            inspectorOverflow:getComputedStyle(document.querySelector('.inspector-scroll')).overflowY,
            timelineViewport:document.querySelector('.timeline-scroll').clientWidth,
            timelineInner:document.querySelector('.timeline-inner').getBoundingClientRect().width,
            allControls:[...document.querySelectorAll('button:not([hidden]), input:not([type="hidden"]), select, summary')]
                .filter(control=>control.getClientRects().length && !control.title).map(control=>control.id||control.outerHTML.slice(0,50))
        };
    });
    assert.equal(layout.parent,'advanced-grid','Timeline must be outside the boxed preview area');
    assert.ok(Math.abs(layout.timeline.left-layout.preview.left)<=2,'Timeline should start under the preview');
    assert.ok(Math.abs(layout.timeline.right-layout.inspector.right)<=2,'Timeline should reach the inspector right edge');
    assert.ok(layout.timeline.top>=layout.preview.bottom-2,'The preview card must end before the timeline');
    assert.equal(new Set(layout.primaryTops).size,1,'Undo, Redo, Zoom-adjacent controls, Track and Group should share one row');
    assert.equal(new Set(layout.editTops).size,1,'Secondary editing controls should share one row');
    assert.equal(new Set(layout.primaryWidths).size,1,'All primary toolbar action buttons should have the same width');
    assert.equal(new Set(layout.editWidths).size,1,'All secondary action buttons should have the same width');
    assert.ok(layout.timelineInner>=layout.timelineViewport-2,'Ruler and lanes should span the full timeline viewport');
    assert.equal(layout.inspectorOverflow,'auto','Inspector must scroll vertically instead of expanding the editor');
    assert.deepEqual(layout.allControls,[],'Interactive editor controls should have native mouseover titles');
    assert.equal(await page.locator('#btn-duplicate-selection').count(),0);
    assert.equal(await page.locator('#btn-delete-selection').count(),0);

    // Keep the shared timeline usable at compact desktop and single-column
    // widths. Only the timeline's own scroll area may overflow horizontally;
    // the page and toolbar must not force a horizontal browser scrollbar.
    for(const width of [900,700]){
        await page.setViewportSize({width,height:850});
        const responsive=await page.evaluate(()=>{
            const bounds=selector=>{
                const rect=document.querySelector(selector).getBoundingClientRect();
                return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width};
            };
            return {
                viewport:window.innerWidth,
                pageWidth:document.documentElement.scrollWidth,
                timeline:bounds('#timeline-panel'),
                inspector:bounds('.right-column'),
                primary:[...document.querySelectorAll('.timeline-primary-row > .timeline-tool')]
                    .map(el=>Math.round(el.getBoundingClientRect().top)),
                secondary:[...document.querySelectorAll('.timeline-edit-row > .timeline-tool')]
                    .map(el=>Math.round(el.getBoundingClientRect().top))
            };
        });
        assert.ok(responsive.pageWidth<=responsive.viewport+2,
            'No horizontal page overflow at '+width+'px: '+JSON.stringify(responsive));
        assert.ok(responsive.timeline.right<=responsive.viewport+2
            && responsive.timeline.left>=-1,
            'Timeline panel must fit within viewport at '+width+'px');
        assert.ok(Math.abs(responsive.timeline.right-responsive.inspector.right)<=2,
            'Timeline should reach the inspector right edge at '+width+'px');
        if(width===900){
            assert.equal(new Set(responsive.primary).size,1,
                'Primary toolbar should stay on one line at compact desktop widths');
            assert.equal(new Set(responsive.secondary).size,1,
                'Secondary toolbar should stay on one line at compact desktop widths');
        }
    }
    await page.setViewportSize({width:1450,height:900});
    assert.equal((await page.locator('#btn-project-settings').innerText()).trim(),'⚙');
    assert.equal(await page.locator('.project-controls-title').innerText().then(v=>/project controls/i.test(v)),false);
    assert.match(await page.locator('#btn-reset-timeline').getAttribute('title'),/timeline/i);
    assert.equal(await page.locator('#btn-reset-export').count(),0,
        'Reset must not modify export preferences');
    assert.deepEqual(await page.evaluate(()=>['.file-list','.asset-library-panel','.inspector-scroll']
        .map(selector=>getComputedStyle(document.querySelector(selector)).scrollbarWidth)),
        ['thin','thin','thin']);
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
    await page.locator('#btn-clear').click();
    await page.locator('#timeline-action-modal').waitFor({state:'visible'});
    await page.locator('#timeline-action-apply').click();
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
    // A real FileSystemFileHandle (not File bytes) can be structured-cloned
    // into IndexedDB. OPFS supplies a permission-granted handle on CI Chrome.
    // This verifies automatic restore without a new file dialog or copied
    // video data, while the earlier test covers unsupported-handle fallback.
    const fileBytesBase64=readFileSync(file).toString('base64');
    const handleStatus=await page.evaluate(async base64=>{
        if(!navigator.storage?.getDirectory)return {supported:false};
        const directory=await navigator.storage.getDirectory();
        const handle=await directory.getFileHandle('ui-test.jpg',{create:true});
        const writer=await handle.createWritable();
        await writer.write(Uint8Array.from(atob(base64),char=>char.charCodeAt(0)));
        await writer.close();
        const {saveMediaHandle,getMediaHandle}=await import('./js/media-handle-store.mjs');
        const id=document.querySelector('.file-row')?.dataset.fileId;
        const saved=await saveMediaHandle(id,handle);
        const restored=await getMediaHandle(id);
        return {supported:true,saved,restored:restored?.name==='ui-test.jpg'};
    },fileBytesBase64);
    if(handleStatus.supported){
        assert.equal(handleStatus.saved,true,'A real file handle must persist via IndexedDB');
        assert.equal(handleStatus.restored,true,'IndexedDB must restore a usable file handle');
        await page.reload({waitUntil:'domcontentloaded'});
        await page.locator('.file-row:not(.is-unlinked)').waitFor({timeout:15000});
        assert.match(await page.locator('#media-remember-note').innerText(),/1 local file handle/i);
        console.log('[MotoriClip file handles] PASS persistent IndexedDB handle and silent permission-granted reattachment');
    }
    await page.evaluate(()=>{
        const row=document.querySelector('.file-row'),dt=new DataTransfer();
        dt.setData('application/x-organon-project-file',row.dataset.fileId);
        document.querySelector('#timeline-empty').dispatchEvent(
            new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:215,clientY:450}));
    });
    await page.locator('.timeline-clip.background:not(.placeholder)').waitFor({timeout:15000});
    // Both still-frame formats must encode the latest composited canvas,
    // not merely download a renamed PNG or a stale decoded video frame.
    for(const format of [
        {id:'#btn-snapshot',name:'motoriclip-frame.png',magic:'89504e470d0a1a0a',codec:'png'},
        {id:'#btn-snapshot-jpeg',name:'motoriclip-frame.jpg',magic:'ffd8ff',codec:'mjpeg'}
    ]){
        assert.match(await page.locator(format.id).getAttribute('title'),/frame/i);
        const downloadEvent=page.waitForEvent('download',{timeout:15000});
        await page.locator(format.id).click();
        const fileDownload=await downloadEvent;
        assert.equal(fileDownload.suggestedFilename(),format.name);
        const framePath=await fileDownload.path();
        assert.ok(framePath,'Downloaded frame should have a temporary file');
        const bytes=readFileSync(framePath);
        assert.ok(bytes.length>250,'Snapshot image must contain encoded pixels');
        assert.equal(bytes.subarray(0,format.magic.length/2).toString('hex'),format.magic,
            'Snapshot file signature must match requested format');
        const inspection=spawnSync('ffprobe',['-v','error','-select_streams','v:0',
            '-show_entries','stream=codec_name,width,height','-of','json',framePath],
            {encoding:'utf8',timeout:15000});
        assert.equal(inspection.status,0,inspection.stderr||'ffprobe rejected frame');
        const decoded=JSON.parse(inspection.stdout).streams?.[0];
        assert.equal(decoded?.codec_name,format.codec,
            'Image is not truly encoded in its requested format');
        assert.equal(decoded?.width,640,'Snapshot should use the actual project canvas width');
        assert.equal(decoded?.height,360,'Snapshot should use the actual project canvas height');
    }
    console.log('[MotoriClip UI] PASS genuine PNG and JPEG frame downloads at applied canvas dimensions');
    // Stage 1: new lane menu, distinct type/track/clip colours and Undo.
    const lane=()=>page.locator('.timeline-lane.background .lane-name').first();
    await lane().click({button:'right'});
    await page.locator('#lane-rename').click();
    await page.locator('#timeline-action-modal').waitFor({state:'visible'});
    await page.locator('#timeline-action-input').fill('My Backgrounds');
    await page.locator('#timeline-action-apply').click();
    assert.match(await lane().innerText(),/My Backgrounds/);
    await lane().click({button:'right'});
    await page.locator('#lane-change-colour').click();
    await page.locator('#timeline-action-input').fill('#22aa77');
    await page.locator('#timeline-action-apply').click();
    const clipColour=()=>page.locator('.timeline-clip.background').first().evaluate(
        el=>el.style.getPropertyValue('--clip-colour'));
    assert.equal(await clipColour(),'#22aa77');
    await page.locator('.timeline-clip.background').first().click({button:'right'});
    await page.locator('#context-change-colour').click();
    await page.locator('#timeline-action-input').fill('#9933ee');
    await page.locator('#timeline-action-apply').click();
    assert.equal(await clipColour(),'#9933ee');
    await page.locator('.timeline-clip.background').first().click({button:'right'});
    await page.locator('#context-reset-colour').click();
    assert.equal(await clipColour(),'#22aa77');
    await lane().click({button:'right'});
    await page.locator('#lane-reset-colour').click();
    assert.equal(await clipColour(),'#e0a360');
    await lane().click({button:'right'});
    await page.locator('#lane-delete').click();
    assert.match(await page.locator('#timeline-action-title').innerText(),/delete entire track/i);
    await page.locator('#timeline-action-cancel').click();
    assert.equal(await page.locator('.timeline-clip.background').count(),1);
    await lane().click({button:'right'});
    await page.locator('#lane-delete').click();
    await page.locator('#timeline-action-apply').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-lane.background').length===0);
    assert.match(await page.locator('#file-count').innerText(),/1 media/i);
    await page.locator('#btn-undo').click();
    await page.locator('.timeline-clip.background:not(.placeholder)').waitFor({timeout:15000});
    assert.match(await lane().innerText(),/My Backgrounds/);
    console.log('[Stage1] PASS lane rename/recolour/reset/delete and Undo; clip overrides');
    // Reset must empty the whole timeline (all clips/lanes), not export options.
    // Clearing the source media belongs to a *different* Clear All button.
    const oldCount=await page.locator('.timeline-clip:not(.placeholder)').count();
    await page.locator('#btn-reset-timeline').click();
    assert.match(await page.locator('#timeline-action-title').innerText(),/reset timeline/i);
    assert.match(await page.locator('#timeline-action-description').innerText(),/Imported media stays/i);
    await page.locator('#timeline-action-cancel').click();
    assert.equal(await page.locator('.timeline-clip:not(.placeholder)').count(),oldCount,
        'Cancelled Reset must not alter the timeline');
    await page.locator('#btn-reset-timeline').click();
    await page.locator('#timeline-action-apply').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip:not(.placeholder)').length===0);
    assert.equal(await page.locator('.timeline-lane').count(),0,
        'Reset removes the entire lane structure, not only the selected clip');
    assert.match(await page.locator('#file-count').innerText(),/1 media/i,
        'Reset must preserve media bin imports and saved handles');
    assert.equal(await page.locator('#canvas-width').inputValue(),'640',
        'Reset must not change the project resolution');
    await page.locator('#btn-undo').click();
    await page.locator('.timeline-clip.background:not(.placeholder)').waitFor({timeout:15000});
    assert.equal(await page.locator('.timeline-clip:not(.placeholder)').count(),oldCount,
        'Undo must fully restore the previous timeline');
    assert.match(await page.locator('#file-count').innerText(),/1 media/i);
    console.log('[Stage2 reset] PASS confirmation/cancel, full timeline deletion, media preservation and Undo');
    await page.locator('.timeline-clip.background').first().click({button:'right'});
    assert.equal(await page.locator('#context-duplicate').isVisible(),true,
        'Duplicate should be available from a clip right-click, not the toolbar');
    await page.locator('#context-duplicate').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.background:not(.placeholder)').length===2,
        null,{timeout:15000});
    await page.locator('.timeline-clip.background').last().click({button:'right'});
    await page.locator('#context-remove-layer').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.background:not(.placeholder)').length===1,
        null,{timeout:15000});
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
    // A multi-lane project with a cue marker must reset to an *empty*
    // timeline, retaining sources in the bin and restoring all edits via Undo.
    await page.locator('[data-library-tab="effects"]').click();
    await page.locator('#effects-library-grid [data-preset-id="vignette"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.sticker:not(.placeholder)').length===1,
        null,{timeout:15000});
    const beforeReset=await page.locator('.timeline-clip:not(.placeholder)').count();
    assert.ok(beforeReset>=4,'Fixture should contain multiple clips across two media-type lanes');
    const sourceCountBefore=await page.locator('#file-count').innerText();
    await page.locator('#btn-reset-timeline').click();
    assert.match(await page.locator('#timeline-action-description').innerText(),/Undo restores/i);
    await page.locator('#timeline-action-apply').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip:not(.placeholder)').length===0);
    assert.equal(await page.locator('.timeline-lane').count(),0,'Reset must remove all lane types');
    assert.equal(await page.locator('.timeline-cue-marker').count(),0,'Reset clears timeline markers');
    assert.equal(await page.locator('#file-count').innerText(),sourceCountBefore,
        'Reset does not clear imported videos, images, effects or their source handles');
    await page.locator('#btn-undo').click();
    await page.waitForFunction(expected=>
        document.querySelectorAll('.timeline-clip:not(.placeholder)').length===expected,
        beforeReset,{timeout:15000});
    assert.equal(await page.locator('.timeline-cue-marker').count(),1,
        'Undo Reset restores the exact timeline marker');
    assert.equal(await page.locator('#file-count').innerText(),sourceCountBefore);
    console.log('[Stage2 reset] PASS multi-lane Reset, markers, preserved bin and exact Undo');
    await page.locator('[data-library-tab="media"]').click();
    await page.locator('#btn-clear').click();
    await page.locator('#timeline-action-modal').waitFor({state:'visible'});
    await page.locator('#timeline-action-apply').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip').length===0);
    // Functional overlay asset library: template click makes an actual PNG clip.
    await page.locator('[data-library-tab="effects"]').click();
    assert.equal(await page.locator('#effects-library-grid .asset-preset-card').count(),12);
    assert.ok(await page.locator('#effects-library-panel').isVisible());
    await page.locator('#effects-library-grid [data-preset-id="vignette"]').click();
    await page.locator('.timeline-clip.sticker:not(.placeholder)').first().waitFor({timeout:15000});
    await page.locator('[data-library-tab="text"]').click();
    await page.locator('#text-overlay-value').fill('NEW TITLE');
    assert.equal(await page.locator('#text-library-grid .asset-preset-card').count(),18,
        'The gallery should contain eighteen visually different typography/layout designs');
    // Distinct designs should differ in geometry even if rendered in grayscale.
    const titleRender=await page.evaluate(async()=>{
        const {TEXT_DESIGNS,paintTimelineText}=await import('./js/text-template-renderer.mjs');
        const output=[];
        for(const preset of TEXT_DESIGNS){
            const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
            const ctx=canvas.getContext('2d',{willReadFrequently:true});
            paintTimelineText(ctx,640,360,{presetId:preset.id,value:'MotoriClip',
                fill:'#ffffff',outline:'#ffffff',shadow:'#ffffff',animation:'none'},2,3);
            const pixels=ctx.getImageData(0,0,640,360).data;
            let hash=2166136261;
            for(let i=3;i<pixels.length;i+=32){
                hash=Math.imul((hash^pixels[i])>>>0,16777619)>>>0;
            }
            output.push([preset.id,hash,ctx.getImageData(0,0,640,360).data.some((v,i)=>i%4===3&&v>0)]);
        }
        return output;
    });
    assert.equal(new Set(titleRender.map(r=>r[1])).size,18,
        'Eighteen text templates must differ in shapes/layout, not merely colour');
    assert.ok(titleRender.every(r=>r[2]),'All text templates should have visible strokes');
    // New title animations must alter actual pixels, including animated
    // handwriting, location pin first/label second, social pulse, numeric
    // rolling countdown and the two halves of a split title.
    const storyFrames=await page.evaluate(async()=>{
        const {paintTimelineText}=await import('./js/text-template-renderer.mjs');
        function capture(presetId,value,t){
            const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
            const ctx=canvas.getContext('2d',{willReadFrequently:true});
            paintTimelineText(ctx,640,360,{presetId,value,animationDuration:1.2,
                animationEasing:'linear'},t,3);
            const rgba=ctx.getImageData(0,0,640,360).data;
            let hash=2166136261,coverage=0;
            for(let i=0;i<rgba.length;i+=4){
                if(rgba[i+3])coverage++;
                if(i%68===0)hash=Math.imul((hash^rgba[i]^rgba[i+1]^rgba[i+2]^rgba[i+3])>>>0,16777619)>>>0;
            }
            return {hash,coverage};
        }
        return [
            ['handwritten-script','MotoriClip'],
            ['social-callout','Follow'],
            ['location-card','Berlin'],
            ['countdown-title','5'],
            ['split-title','THE NEXT CHAPTER']
        ].map(([id,value])=>({id,early:capture(id,value,.15),
            midway:capture(id,value,.62),done:capture(id,value,1.4),
            repeat:capture(id,value,.15)}));
    });
    for(const frame of storyFrames){
        assert.notEqual(frame.early.hash,frame.done.hash,
            frame.id+' must actually animate on the shared export renderer');
        assert.deepEqual(frame.early,frame.repeat,
            frame.id+' must render exactly the same pixels after a backwards seek');
        assert.ok(frame.done.coverage>0,frame.id+' must become visible');
    }
    assert.ok(storyFrames.find(x=>x.id==='handwritten-script').early.coverage<
        storyFrames.find(x=>x.id==='handwritten-script').done.coverage,
        'Handwriting should reveal characters in sequence');
    console.log('[Stage2 storytelling] PASS five real timeline animations, distinct layouts and reverse seeking');
    // Inspector customisations must change pixels, not only UI settings.
    // Hold every preset colour constant: these changes are distinct type,
    // light and shape behaviours, never more colour-only templates.
    const customTitlePixels=await page.evaluate(async()=>{
        const {paintTimelineText}=await import('./js/text-template-renderer.mjs');
        const base={presetId:'news-lower-third',value:'Mixed Case\\nSecond Line',
            subtitle:'Live report',animation:'none'};
        const render=overrides=>{
            const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
            const ctx=canvas.getContext('2d',{willReadFrequently:true});
            paintTimelineText(ctx,640,360,{...base,...overrides},2,3);
            const arr=ctx.getImageData(0,0,640,360).data;
            let hash=2166136261,shown=0;
            for(let i=0;i<arr.length;i+=4){
                if(arr[i+3]>0)shown++;
                if(i%56===0)hash=Math.imul((hash^arr[i]^arr[i+1]^arr[i+2]^arr[i+3])>>>0,16777619)>>>0;
            }
            return {hash,shown};
        };
        const options=[
            ['font family',{fontFamily:'mono'}],['weight',{fontWeight:300}],
            ['italic',{fontStyle:'italic'}],['alignment',{textAlign:'right'}],
            ['letter case',{textCase:'lowercase'}],['letter spacing',{letterSpacing:14}],
            ['line spacing',{lineSpacing:170}],['glow',{glowStrength:22,glowColor:'#ff8844'}],
            ['shadow direction',{shadowOffsetX:14,shadowOffsetY:12}],
            ['opacity',{textOpacity:48}],['backdrop',{backdropEnabled:true,backdropColor:'#3174a8'}],
            ['shape border',{shapeBorderWidth:5,shapeBorderColor:'#eebbee'}],
            ['banner width',{bannerWidth:54}],['banner height',{bannerHeight:155}],
            ['shape padding',{shapePadding:35}],['corner radius',{shapeRadius:44}]
        ];
        return {baseline:render({}),changed:options.map(([label,config])=>
            ({label,result:render(config)})),again:render({})};
    });
    assert.deepEqual(customTitlePixels.baseline,customTitlePixels.again,
        'Typography and shape rendering must be deterministic when seeking backwards');
    for(const item of customTitlePixels.changed)
        assert.notEqual(item.result.hash,customTitlePixels.baseline.hash,
            item.label+' should visibly change live/encoded title pixels');
    console.log('[MotoriClip typography] PASS font, spacing, casing, glow, opacity and banner shape alter real composited frames');
    // Distinct motion must change the actual composited pixels at precise
    // timestamps; seeking back to an earlier time reproduces identical pixels.
    const motionPixels=await page.evaluate(async()=>{
        const {paintTimelineText}=await import('./js/text-template-renderer.mjs');
        function render(animation,time){
            const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
            const context=canvas.getContext('2d',{willReadFrequently:true});
            paintTimelineText(context,640,360,{presetId:'news-lower-third',value:'LIVE MOTION',
                subtitle:'TEST SUBTITLE',animation,animationEasing:'linear',
                animationDuration:1.2},time,3);
            const pixels=context.getImageData(0,0,640,360).data;
            let hash=2166136261,visible=0;
            for(let i=0;i<pixels.length;i+=4){
                if(pixels[i+3]>0)visible++;
                if(i%92===0)hash=Math.imul((hash^pixels[i]^pixels[i+1]^pixels[i+3])>>>0,16777619)>>>0;
            }
            return {hash,visible};
        }
        const options=['shake','wave','kinetic-stagger','glitch-text','bounce',
            'outline-fill','title-wipe','dissolve-out','neon-flicker','box-reveal'];
        return {options:options.map(id=>({id,early:render(id,.18),
            later:render(id,id==='dissolve-out'?2.85:1.35)})),
            first:render('shake',.37),second:render('shake',.92),
            repeat:render('shake',.37),
            stableEarly:render('none',.2),stableLater:render('none',1.2),
            newsZero:render('box-reveal',0),newsMid:render('box-reveal',.35),
            newsEnd:render('box-reveal',1.3)};
    });
    for(const entry of motionPixels.options)
        assert.notEqual(entry.early.hash,entry.later.hash,
            entry.id+' must render different pixels as timeline time moves');
    assert.deepEqual(motionPixels.first,motionPixels.repeat,
        'Returning to an earlier timestamp must reproduce the same pixels');
    assert.deepEqual(motionPixels.stableEarly,motionPixels.stableLater,
        'Static text should not accidentally animate');
    assert.ok(motionPixels.newsZero.visible<motionPixels.newsMid.visible
        &&motionPixels.newsMid.visible<motionPixels.newsEnd.visible,
        'News broadcast banner should draw first, then the headline/subtitle');
    console.log('[Stage2 motion] PASS timed title pixels, independent motion, broadcast stages and seek repeatability');
    await page.locator('#text-library-grid [data-preset-id="news-lower-third"]').click({button:'right'});
    await page.locator('#text-preview-modal').waitFor({state:'visible'});
    assert.match(await page.locator('#text-preview-title').innerText(),/news lower third/i);
    assert.equal(await page.locator('#text-preview-progress').inputValue(),'0');
    await page.locator('#text-preview-play').click();
    await page.waitForFunction(()=>Number(document.querySelector('#text-preview-progress').value)>=20,
        null,{timeout:5000});
    await page.locator('#text-preview-play').click();
    const pausedAt=Number(await page.locator('#text-preview-progress').inputValue());
    assert.ok(pausedAt>=20,'The popup should play actual time-based frames');
    await page.locator('#text-preview-progress').fill('0');
    assert.equal(await page.locator('#text-preview-progress').inputValue(),'0',
        'Preview progress can be scrubbed backwards');
    await page.locator('#text-preview-close').click();
    await page.locator('#text-library-grid [data-preset-id="neon-cyan"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.sticker:not(.placeholder)').length===2,null,{timeout:15000});
    assert.ok(await page.locator('.timeline-clip.sticker .clip-label').allTextContents()
        .then(names=>names.some(name=>/text-neon-cyan-NEW-TITLE/i.test(name))),
        'Text preset should create a named backing PNG plus a live editable title clip');
    await page.locator('#inspector-text-template').waitFor({state:'visible'});
    assert.equal(await page.locator('#text-inspector-value').inputValue(),'NEW TITLE');
    await page.locator('#text-inspector-value').fill('LIVE EDITED TITLE');
    await page.locator('#text-font-family').selectOption('serif');
    await page.locator('#text-font-weight').selectOption('600');
    await page.locator('#text-font-style').selectOption('italic');
    await page.locator('#text-text-align').selectOption('right');
    await page.locator('#text-text-case').selectOption('lowercase');
    await page.locator('#text-letter-spacing').fill('9');
    await page.locator('#text-line-spacing').fill('145');
    await page.locator('#text-text-opacity').fill('80');
    await page.locator('#text-glow-color').fill('#ff9944');
    await page.locator('#text-glow-strength').fill('14');
    await page.locator('#text-shadow-offset-x').fill('7');
    await page.locator('#text-shadow-offset-y').fill('-5');
    await page.locator('#text-shape-details summary').click();
    await page.locator('#text-backdrop-enabled').check();
    await page.locator('#text-backdrop-color').fill('#123456');
    await page.locator('#text-shape-border-color').fill('#ccddee');
    await page.locator('#text-shape-border-width').fill('4');
    await page.locator('#text-shape-radius').fill('23');
    await page.locator('#text-shape-padding').fill('17');
    await page.locator('#text-banner-width').fill('77');
    await page.locator('#text-banner-height').fill('135');
    assert.equal(await page.locator('#text-letter-spacing-value').innerText(),'9px');
    assert.equal(await page.locator('#text-banner-width-value').innerText(),'77%');
    await page.locator('#text-animation').selectOption('typewriter');
    await page.locator('#text-animation-duration').fill('2');
    await page.locator('#text-animation-delay').fill('0.3');
    await page.locator('#text-animation-speed').fill('1.5');
    await page.locator('#text-animation-direction').selectOption('right');
    await page.locator('#text-animation-easing').selectOption('ease-in-out');
    await page.locator('#text-animation-intensity').fill('140');
    await page.locator('#text-animation-loop').check();
    assert.equal(await page.locator('#text-inspector-value').inputValue(),'LIVE EDITED TITLE');
    const savedTitle=await page.evaluate(()=>{
        const item=JSON.parse(localStorage.getItem('motori-advanced-project-recovery-v1')||'null');
        return item?.tracks?.find(t=>t.textOverlay);
    });
    // Autosave is change-detected and may run after an interval.
    await page.waitForFunction(()=>{
        const item=JSON.parse(localStorage.getItem('motori-advanced-project-recovery-v1')||'null');
        return item?.tracks?.some(t=>t.textOverlay?.value==='LIVE EDITED TITLE'&&
            t.textOverlay.animation==='typewriter'&&
            t.textOverlay.animationDelay===.3&&t.textOverlay.animationSpeed===1.5&&
            t.textOverlay.animationLoop===true&&t.textOverlay.animationIntensity===140&&
            t.textOverlay.fontFamily==='serif'&&t.textOverlay.fontWeight===600&&
            t.textOverlay.fontStyle==='italic'&&t.textOverlay.textAlign==='right'&&
            t.textOverlay.textCase==='lowercase'&&t.textOverlay.letterSpacing===9&&
            t.textOverlay.lineSpacing===145&&t.textOverlay.textOpacity===80&&
            t.textOverlay.glowStrength===14&&t.textOverlay.shadowOffsetX===7&&
            t.textOverlay.shadowOffsetY===-5&&t.textOverlay.backdropEnabled===true&&
            t.textOverlay.backdropColor==='#123456'&&
            t.textOverlay.shapeBorderWidth===4&&t.textOverlay.bannerWidth===77&&
            t.textOverlay.bannerHeight===135);
    },null,{timeout:12000});
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
    await page.locator('#btn-clear').click();
    await page.locator('#timeline-action-modal').waitFor({state:'visible'});
    await page.locator('#timeline-action-apply').click();
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
