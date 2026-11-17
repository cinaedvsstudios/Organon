/**
 * MotoriClip 6H: repeat real fixed-frame exports on ONE Chrome tab, then
 * measure proportional browser-process memory after GC, idle and teardown.
 * Exports must remain playable; memory readings are observational, not
 * ungrounded pass/fail thresholds.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const fixtures=join(root,'tools/audio-timeline/tests/fixtures');
mkdirSync(fixtures,{recursive:true});
const temporary=await mkdtemp(join(tmpdir(),'motori-recovery-'));
function run(binary,args,{raw=false,timeout=120000}={}){
    const result=spawnSync(binary,args,{encoding:raw?undefined:'utf8',
        maxBuffer:64000000,timeout});
    if(result.error||result.signal||result.status!==0){
        throw new Error(binary+' failed '+JSON.stringify({
            args,status:result.status,signal:result.signal,
            stderr:String(result.stderr||result.error||'').slice(-3000)
        }));
    }
    return result.stdout;
}
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
    'testsrc2=size=640x360:rate=30:duration=8','-f','lavfi','-i',
    'sine=frequency=440:sample_rate=48000:duration=8',
    '-threads','1','-filter_threads','1','-c:v','libx264',
    '-preset','ultrafast','-crf','27','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','96k','-t','8',join(fixtures,'recovery-moving.mp4')]);
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
    'color=c=yellow:s=640x360:d=1','-frames:v','1','-update','1',
    join(fixtures,'recovery-background.jpg')]);

function processMemory(nodePid){
    const list=run('ps',['-eo','pid=,ppid=,comm='])
        .split('\n').map(line=>line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/))
        .filter(Boolean).map(m=>({pid:Number(m[1]),parent:Number(m[2])}));
    const descendants=new Set([nodePid]);
    let expanded=true;
    while(expanded){
        expanded=false;
        for(const item of list){
            if(descendants.has(item.parent)&&!descendants.has(item.pid)){
                descendants.add(item.pid);expanded=true;
            }
        }
    }
    let pss=0,count=0;
    for(const pid of descendants){
        if(pid===nodePid)continue;
        try{
            const contents=readFileSync('/proc/'+pid+'/smaps_rollup','utf8');
            const match=contents.match(/^Pss:\s+(\d+)\s+kB/m);
            if(match){pss+=Number(match[1]);count++}
        }catch{/* Exited or inaccessible Chrome process */}
    }
    return {pssMiB:count?Number((pss/1024).toFixed(1)):null,
        sampledChromeProcesses:count,descendantCount:descendants.size-1};
}
const contentType={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
    '.mp4':'video/mp4','.jpg':'image/jpeg','.png':'image/png'};
const server=createServer((request,response)=>{
    try{
        const pathname=new URL(request.url,'http://localhost').pathname;
        const absolute=resolve(root,'.'+pathname);
        if(!absolute.startsWith(root+'/')||!existsSync(absolute)){
            response.writeHead(404);response.end('Not found');return;
        }
        const bytes=readFileSync(absolute);
        response.writeHead(200,{'Content-Type':contentType[extname(absolute)]||'application/octet-stream',
            'Cache-Control':'no-store','Content-Length':bytes.length});
        response.end(bytes);
    }catch(error){response.writeHead(500);response.end(String(error))}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome unavailable');
const browser=await chromium.launch({executablePath:chrome,headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-features=WebCodecs']});
try{
    const context=await browser.newContext({acceptDownloads:true});
    const page=await context.newPage(),uncaught=[];
    page.on('pageerror',error=>uncaught.push(String(error)));
    await page.goto('http://127.0.0.1:'+server.address().port+
        '/tools/audio-timeline/tests/browser-harness.html');
    const cdp=await context.newCDPSession(page);
    await page.evaluate(async()=>{
        const [{AdvancedOfflineExporter},{AdvancedMediaEngine}]=await Promise.all([
            import('../js/advanced-offline-export.mjs'),
            import('../js/advanced-media-engine-v0.24.js')
        ]);
        const getFile=async(name,type)=>{
            const response=await fetch('./fixtures/'+name);
            if(!response.ok)throw Error('Missing fixture '+name);
            return new File([await response.blob()],name,{type});
        };
        const [source,jpeg]=await Promise.all([
            getFile('recovery-moving.mp4','video/mp4'),
            getFile('recovery-background.jpg','image/jpeg')
        ]);
        const image=new Image(),url=URL.createObjectURL(jpeg);
        try{
            await new Promise((done,fail)=>{image.onload=done;image.onerror=fail;image.src=url});
        }finally{URL.revokeObjectURL(url)}
        const canvas=document.createElement('canvas');
        canvas.width=1280;canvas.height=720;
        document.body.appendChild(canvas);
        const media={
            volume:.7,muted:false,fadeIn:.1,fadeOut:.1
        };
        const background={
            id:'background',type:'background',file:jpeg,media:image,sourceName:jpeg.name,
            start:0,sourceOffset:0,sourceDuration:8,clipDuration:8,order:1,
            visible:true,opacity:1,blendMode:'source-over'
        };
        const clips=[0,4].map((start,index)=>({
            id:'moving-'+index,type:'video',file:source,sourceName:source.name,
            start,sourceOffset:index?2:.5,sourceDuration:8,clipDuration:4,order:index+1,
            visible:true,opacity:1,blendMode:'source-over',audio:{...media}
        }));
        const engine=new AdvancedMediaEngine({canvas,mediaBin:document.createElement('div'),
            onTimeChange(){},onDurationChange(){},onPlaybackChange(){},
            onRenderError(error){throw error}
        });
        engine.tracks=[background,...clips];
        const state={engine,canvas,run:0,downloads:0,progress:[],phases:[]};
        state.exporter=new AdvancedOfflineExporter({
            engine,
            onProgress:({percent})=>state.progress.push(percent),
            onState:({phase})=>state.phases.push(phase),
            onDownload:({blob,extension})=>{
                state.downloads++;
                const u=URL.createObjectURL(blob),link=document.createElement('a');
                link.href=u;link.download='motori-recovery-'+state.run+'.'+extension;
                document.body.appendChild(link);link.click();link.remove();
                // Allow a realistic short download grace period, then revoke
                // before measuring post-idle recovery.
                setTimeout(()=>URL.revokeObjectURL(u),1200);
            }
        });
        window.__motoriRecovery=state;
    });
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(900);
    const initial=processMemory(process.pid);
    assert.ok(initial.pssMiB!==null,'PSS unavailable for baseline Chrome processes');
    const records=[];
    const count=4;
    for(let cycle=1;cycle<=count;cycle++){
        const before=processMemory(process.pid),readings=[before];
        const ticker=setInterval(()=>{
            const next=processMemory(process.pid);
            if(next.pssMiB!==null)readings.push(next);
        },300);
        const started=Date.now();
        try{
            const downloaded=page.waitForEvent('download',{timeout:240000});
            const exported=page.evaluate(async run=>{
                const state=window.__motoriRecovery;
                state.run=run;
                state.progress=[];
                state.phases=[];
                const start=performance.now();
                const result=await state.exporter.start({format:'webm',fps:25,bitrateKbps:3000});
                return {
                    result,elapsedMs:Math.round(performance.now()-start),
                    downloads:state.downloads,busy:state.exporter.busy,
                    remainingInputs:state.exporter.inputs.size,
                    pendingOutput:state.exporter.output,
                    playhead:state.engine.currentTime,
                    clipCount:state.engine.tracks.length,
                    phases:[...state.phases],
                    progress:state.progress.at(-1)
                };
            },cycle);
            const download=await downloaded;
            const result=await exported;
            assert.equal(result.result,true);
            assert.equal(result.busy,false);
            assert.equal(result.remainingInputs,0);
            assert.equal(result.pendingOutput,null);
            assert.equal(result.playhead,0);
            assert.equal(result.clipCount,3);
            assert.equal(result.downloads,cycle);
            assert.equal(result.progress,100);
            assert.ok(result.phases.includes('complete'));
            const saved=join(temporary,'repeat-'+cycle+'.webm');
            await download.saveAs(saved);
            const media=JSON.parse(run('ffprobe',['-v','error','-count_frames',
                '-show_entries','stream=codec_type,width,height,nb_read_frames,codec_name',
                '-show_entries','format=duration','-of','json',saved]));
            const video=media.streams.find(x=>x.codec_type==='video');
            const audio=media.streams.find(x=>x.codec_type==='audio');
            assert.ok(video&&audio,'Both streams required in repeat '+cycle);
            assert.equal(video.width,1280);
            assert.equal(video.height,720);
            assert.equal(Number(video.nb_read_frames),200);
            assert.ok(Math.abs(Number(media.format.duration)-8)<.14);
            const peak=Math.max(...readings.map(x=>x.pssMiB));
            await page.waitForTimeout(1550);
            await cdp.send('HeapProfiler.collectGarbage');
            await page.waitForTimeout(2500);
            const after=processMemory(process.pid);
            assert.ok(after.pssMiB!==null,'PSS unavailable after repeat '+cycle);
            const summary={
                cycle,renderMs:result.elapsedMs,wallMs:Date.now()-started,
                frames:200,container:'webm',duration:Number(media.format.duration),
                chromeBaselineMiB:before.pssMiB,
                chromePeakMiB:peak,
                chromeAfterIdleGcMiB:after.pssMiB,
                chromeProcessCount:after.sampledChromeProcesses,
                memorySamples:readings.length
            };
            records.push(summary);
            console.log('[MotoriClip 6H] PASS cycle '+cycle+' '+JSON.stringify(summary));
        }finally{clearInterval(ticker)}
    }
    // Record a longer idle recovery reading after the last download URL has
    // been revoked. Do not treat this as a hard memory upper bound.
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(3500);
    const afterSession=processMemory(process.pid);
    await page.evaluate(()=>{
        const state=window.__motoriRecovery;
        state.engine.tracks=[];
        state.canvas.remove();
        delete window.__motoriRecovery;
    });
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(3000);
    const afterTeardown=processMemory(process.pid);
    assert.ok(afterTeardown.pssMiB!==null);
    assert.deepEqual(uncaught,[],'Unexpected uncaught browser errors');
    const summary={initial,records,afterSession,afterTeardown};
    console.log('[MotoriClip 6H] COMPLETE '+JSON.stringify(summary));
    await context.close();
    await page.waitForTimeout?.(0).catch(()=>{}); // No-op after context close; compatibility.
}finally{
    await browser.close();
    await new Promise(done=>server.close(done));
    if(!process.env.KEEP_MOTORICLIP_OUTPUT)await rm(temporary,{recursive:true,force:true});
}
