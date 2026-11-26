/**
 * Phase 6G: longer, moving-image fixtures and Linux Chrome-process PSS profiling.
 * Real exports use Chrome WebCodecs/Mediabunny. Output is verified by FFprobe.
 * This is NOT a general-purpose memory benchmark or a mobile device test.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root=process.cwd(), fixtures=join(root,'tools/audio-timeline/tests/fixtures');
mkdirSync(fixtures,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'motoriclip-long-'));
function command(bin,args,{binary=false,timeout=120000}={}){
    const run=spawnSync(bin,args,{encoding:binary?undefined:'utf8',maxBuffer:64000000,timeout});
    if(run.error||run.signal||run.status!==0){
        throw Error(bin+' failed '+JSON.stringify({
            status:run.status,signal:run.signal,error:run.error?.message,
            stderr:String(run.stderr||'').slice(-3200),args
        }));
    }
    return run.stdout;
}
function makeSource(name,filter,freq){
    const output=join(fixtures,name);
    const args=['-hide_banner','-loglevel','error','-y',
        '-f','lavfi','-i','testsrc2=size=640x360:rate=30:duration=10',
        '-f','lavfi','-i','sine=frequency='+freq+':sample_rate=48000:duration=10'];
    if(filter)args.push('-vf',filter);
    args.push('-threads','1','-filter_threads','1',
        '-c:v','libx264','-preset','ultrafast','-crf','28','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','96k','-t','10',output);
    command('ffmpeg',args);
}
makeSource('moving-a.mp4','',440);
makeSource('moving-b.mp4','hue=h=90',660);
command('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','lavfi','-i','color=c=yellow:s=640x360:d=1',
    '-frames:v','1','-update','1',join(fixtures,'moving-background.jpg')]);

// Sum proportional set size (PSS) for Chrome's process tree, including GPU and
// renderer subprocesses, to avoid counting shared memory fully for each process.
// RSS is also recorded as a coarse secondary metric, NOT used as total memory.
function chromeMemory(nodePid){
    const processes=command('ps',['-eo','pid=,ppid=,comm=']);
    const rows=processes.split('\n').map(x=>x.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean)
        .map(x=>({pid:Number(x[1]),ppid:Number(x[2]),name:x[3]}));
    const descendants=new Set([nodePid]);
    let changed=true;
    while(changed){
        changed=false;
        for(const row of rows){
            if(descendants.has(row.ppid)&&!descendants.has(row.pid)){
                descendants.add(row.pid);changed=true;
            }
        }
    }
    let pss=0,rss=0,pssProcesses=0,rssProcesses=0;
    for(const pid of descendants){
        if(pid === nodePid) continue; // Do not count the Node test runner itself.
        try{
            const report=readFileSync('/proc/'+pid+'/smaps_rollup','utf8');
            const p=report.match(/^Pss:\s+(\d+)\s+kB/m);
            const r=report.match(/^Rss:\s+(\d+)\s+kB/m);
            if(p){pss+=Number(p[1]);pssProcesses++}
            if(r){rss+=Number(r[1]);rssProcesses++}
        }catch{/* Process exited or smaps_rollup is not accessible */}
    }
    return {pssKiB:pssProcesses?pss:null,rssKiB:rssProcesses?rss:null,
        processCount:Math.max(0,descendants.size-1),pssProcesses,rssProcesses};
}

const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript',
    '.mp4':'video/mp4','.jpg':'image/jpeg','.png':'image/png'};
const server=createServer((request,response)=>{
    try{
        const file=resolve(root,'.'+new URL(request.url,'http://localhost').pathname);
        if(!file.startsWith(root+'/')||!existsSync(file)){
            response.writeHead(404);response.end('Not found');return;
        }
        const buffer=readFileSync(file);
        response.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream',
            'Cache-Control':'no-store'});
        response.end(buffer);
    }catch(error){response.writeHead(500);response.end(String(error))}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome unavailable');
const browser=await chromium.launch({executablePath:chrome,headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-features=WebCodecs',
        ...((process.env.MOTORICLIP_LONGFORM==='1'||process.env.MOTORICLIP_FULLHD120==='1'||process.env.MOTORICLIP_STACKED_ENDURANCE)?['--js-flags=--expose-gc']:[])]});
try{
    const context=await browser.newContext({acceptDownloads:true});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('crash',()=>console.error('[MotoriClip browser] renderer crashed'));
    browser.on('disconnected',()=>console.log('[MotoriClip browser] disconnected'));
    page.on('console',message=>{
        const value=message.text();
        if(value.startsWith('[MotoriClip 6L progress]')||value.startsWith('[MotoriClip 79 progress]'))console.log(value);
    });
    await page.goto('http://127.0.0.1:'+server.address().port+
        '/tools/audio-timeline/tests/browser-harness.html');
    const stacked=process.env.MOTORICLIP_STACKED_ENDURANCE||'';
    const fullHd120=process.env.MOTORICLIP_FULLHD120==='1';
    const longform=process.env.MOTORICLIP_LONGFORM==='1'||fullHd120||Boolean(stacked);
    const phase=stacked?'79':fullHd120?'6L':longform?'6K':'6G';
    const scenarios=stacked ? [stacked==='4k' ? {
        name:'4k-60s-stacked-8clips',format:'mp4',width:3840,height:2160,
        duration:60,fps:24,bitrateKbps:18000,clipCount:8,clipStep:7.3,clipDuration:8.4,stacked:true
    } : {
        name:'1080p-120s-stacked-16clips',format:'mp4',width:1920,height:1080,
        duration:120,fps:30,bitrateKbps:6000,clipCount:16,clipStep:7.35,clipDuration:8.4,stacked:true
    }] : fullHd120 ? [
        {
            // 16 staggered 8.4s clips from two 10s H.264/AAC camera-like sources;
            // last clip ends at 118.65s, leaving a testable silent tail.
            name:'1080p-120s-motion-16clips',format:'mp4',width:1920,height:1080,
            duration:120,fps:30,bitrateKbps:5000,clipCount:16,
            clipStep:7.35,clipDuration:8.4
        }
    ] : longform ? [
        {
            name:'1080p-60s-motion-8clips',format:'mp4',width:1920,height:1080,
            duration:60,fps:30,bitrateKbps:5000,clipCount:8,
            clipStep:7,clipDuration:8.5
        },
        {
            name:'720p-120s-motion-25clips',format:'webm',width:1280,height:720,
            duration:120,fps:25,bitrateKbps:3500,clipCount:25,
            clipStep:4.7,clipDuration:5.7
        }
    ] : [
        {
            name:'1080p-18s-motion-8clips',format:'mp4',width:1920,height:1080,
            duration:18,fps:30,bitrateKbps:5000,clipCount:8,
            clipStep:2.1,clipDuration:3.1
        },
        {
            name:'720p-30s-motion-25clips',format:'webm',width:1280,height:720,
            duration:30,fps:25,bitrateKbps:3500,clipCount:25,
            clipStep:1.12,clipDuration:1.8
        }
    ];
    const records=[];
    for(const cfg of scenarios){
        console.log('[MotoriClip '+phase+'] START',cfg.name);
        const base=chromeMemory(process.pid);
        const samples=[base];
        let lastReport=Date.now();
        const timer=setInterval(()=>{
            try{
                const sample=chromeMemory(process.pid);samples.push(sample);
                if(stacked&&Date.now()-lastReport>=60000){
                    lastReport=Date.now();
                    console.log('[MotoriClip 79 memory] '+cfg.name+' '+JSON.stringify(sample));
                }
            }catch(error){console.warn('Memory sample failed: '+String(error));}
        },stacked?2000:400);
        const started=Date.now();
        try{
            // A 60s 1080p WebCodecs render takes ~5 minutes in hosted CI.
            // Twice as many 1080p frames can exceed the old 7-minute
            // download timeout without a decoder crash or memory exhaustion.
            // Allow up to 17 minutes for the 120s stress scenario only.
            const downloadPromise=page.waitForEvent('download',{
                // Software-rendered stacked exports measured ~11/18 min per 10%.
                // Preserve every frame and effect; allow realistic CI time, not a shorter test.
                timeout:stacked ? (stacked==='4k'?240:180)*60000 : fullHd120 ? 1020000 : 420000
            });
            const renderPromise=page.evaluate(async scenario=>{
                const [{AdvancedOfflineExporter},{AdvancedMediaEngine}]=await Promise.all([
                    import('../js/advanced-offline-export.mjs'),
                    import('../js/advanced-media-engine-v0.24.js')
                ]);
                const readFixture=async(name,type)=>{
                    const response=await fetch('./fixtures/'+name);
                    if(!response.ok)throw Error('Fixture missing '+name);
                    return new File([await response.blob()],name,{type});
                };
                const [first,second,backgroundFile]=await Promise.all([
                    readFixture('moving-a.mp4','video/mp4'),
                    readFixture('moving-b.mp4','video/mp4'),
                    readFixture('moving-background.jpg','image/jpeg')
                ]);
                const readImage=async(file)=>{
                    const image=new Image(),url=URL.createObjectURL(file);
                    try{
                        await new Promise((done,fail)=>{
                            image.onload=done;image.onerror=fail;image.src=url;
                        });
                        return image;
                    }finally{URL.revokeObjectURL(url)}
                };
                const background=await readImage(backgroundFile);
                const overlayCanvas=document.createElement('canvas');
                overlayCanvas.width=640;overlayCanvas.height=360;
                const layer=overlayCanvas.getContext('2d');
                layer.fillStyle='rgba(0,255,0,0.9)';
                layer.fillRect(12,12,48,48);
                const overlayBlob=await new Promise(resolve=>overlayCanvas.toBlob(resolve,'image/png'));
                const overlayFile=new File([overlayBlob],'long-overlay.png',{type:'image/png'});
                const overlay=await readImage(overlayFile);
                const defaultAudio={volume:.35,muted:false,fadeIn:.1,fadeOut:.12};
                const tracks=[
                    {
                        id:'background',type:'background',file:backgroundFile,
                        sourceName:backgroundFile.name,media:background,
                        start:0,sourceOffset:0,sourceDuration:scenario.duration,
                        clipDuration:scenario.duration,visible:true,opacity:1,
                        order:1,blendMode:'source-over'
                    }
                ];
                for(let index=0;index<scenario.clipCount;index++){
                    const file=index%2?second:first;
                    const start=Number((index*scenario.clipStep).toFixed(5));
                    const duration=Math.min(scenario.clipDuration,scenario.duration-start);
                    tracks.push({
                        id:'motion-'+index,type:'video',file,sourceName:file.name,
                        sourceDuration:10,sourceOffset:index%2?1.4:.8,
                        start,clipDuration:duration,visible:true,opacity:1,
                        blendMode:'source-over',order:index+1,
                        audio:{...defaultAudio}
                    });
                }
                tracks.push({
                    id:'overlay',type:'sticker',file:overlayFile,
                    sourceName:overlayFile.name,media:overlay,
                    sourceDuration:scenario.duration,sourceOffset:0,start:0,
                    clipDuration:scenario.duration,visible:true,opacity:1,
                    blendMode:'source-over',order:1,
                    transparency:{mode:'native'}
                });
                if(scenario.stacked){
                    // Transparent placeholder only supplies native file/decoder metadata.
                    // The procedural painters are executed by the production compositor.
                    const blank=document.createElement('canvas');blank.width=4;blank.height=4;
                    const blob=await new Promise(done=>blank.toBlob(done,'image/png'));
                    const file=new File([blob],'endurance-procedural.png',{type:'image/png'});
                    const media=await readImage(file);
                    for(const [index,presetId] of ['starburst','camera-frame'].entries()){
                        tracks.push({id:'effect-'+presetId,type:'sticker',file,media,sourceName:file.name,
                            start:0,sourceOffset:0,sourceDuration:scenario.duration,clipDuration:scenario.duration,
                            visible:true,opacity:.8,order:scenario.clipCount+index+2,blendMode:'source-over',
                            transparency:{mode:'native'},effectOverlay:{presetId,intensity:65,glow:45,
                                scale:100,color:'#ffe09c',speed:1,density:50,seed:79}});
                    }
                }
                const canvas=document.createElement('canvas');
                canvas.width=scenario.width;canvas.height=scenario.height;
                document.body.appendChild(canvas);
                const engine=new AdvancedMediaEngine({
                    canvas,mediaBin:document.createElement('div'),
                    onTimeChange(){},onDurationChange(){},
                    onPlaybackChange(){},onRenderError(error){throw error}
                });
                engine.tracks=tracks;
                const phases=[],percentages=[];
                let milestone=-1;
                let downloaded=0;
                const exporter=new AdvancedOfflineExporter({
                    engine,onState:s=>phases.push(s.phase),
                    onProgress:s=>{
                        percentages.push(s.percent);
                        if(scenario.stacked||(scenario.duration===120&&scenario.width===1920)){
                            const next=Math.floor(s.percent/10);
                            if(next>milestone){
                                milestone=next;
                                console.info('[MotoriClip '+(scenario.stacked?'79':'6L')+' progress] '
                                    +scenario.name+' '+Math.round(s.percent)+'%');
                            }
                        }
                    },
                    onDownload({blob,extension}){
                        downloaded++;
                        const link=document.createElement('a'),url=URL.createObjectURL(blob);
                        link.href=url;link.download='motoriclip-'+scenario.name+'.'+extension;
                        document.body.appendChild(link);link.click();link.remove();
                        setTimeout(()=>URL.revokeObjectURL(url),12000);
                    }
                });
                const began=performance.now();
                try{
                    const ok=await exporter.start({
                        format:scenario.format,fps:scenario.fps,
                        bitrateKbps:scenario.bitrateKbps
                    });
                    return {
                        ok,busy:exporter.busy,retainedInputs:exporter.inputs.size,
                        downloadCount:downloaded,phases,
                        progressLast:percentages.at(-1),clipCount:tracks.length,
                        renderMs:Math.round(performance.now()-began),
                        unchangedPlayhead:engine.currentTime===0
                    };
                }finally{
                    canvas.remove();
                }
            },cfg);
            // Observe both promises immediately so a download timeout cannot hide
            // the original error behind a secondary page-close rejection.
            const [download,result]=await Promise.all([downloadPromise,renderPromise]);
            assert.equal(result.ok,true);
            assert.equal(result.busy,false);
            assert.equal(result.retainedInputs,0);
            assert.equal(result.unchangedPlayhead,true);
            assert.equal(result.downloadCount,1);
            assert.equal(result.clipCount,cfg.clipCount+2+(cfg.stacked?2:0));
            assert.equal(result.progressLast,100);
            assert.ok(result.phases.includes('complete'));
            const file=join(temp,cfg.name+'.'+cfg.format);
            await download.saveAs(file);
            const metadata=JSON.parse(command('ffprobe',['-v','error','-count_frames',
                '-show_entries','stream=codec_type,codec_name,width,height,nb_read_frames',
                '-show_entries','format=duration,size','-of','json',file],{timeout:stacked?600000:120000}));
            const video=metadata.streams.find(x=>x.codec_type==='video');
            const audio=metadata.streams.find(x=>x.codec_type==='audio');
            assert.ok(video&&audio,'Output must contain both video and audio');
            assert.equal(Number(video.width),cfg.width);
            assert.equal(Number(video.height),cfg.height);
            assert.equal(Number(video.nb_read_frames),cfg.duration*cfg.fps);
            assert.ok(Math.abs(Number(metadata.format.duration)-cfg.duration)<.16,
                'Output duration mismatch '+metadata.format.duration);
            const sampleFrame=time=>command('ffmpeg',['-v','error',
                '-ss',String(time),'-i',file,'-frames:v','1',
                '-vf','scale=20:12,format=rgb24','-f','rawvideo','pipe:1'],{binary:true});
            const beginning=sampleFrame(1),middle=sampleFrame(cfg.duration/2),ending=sampleFrame(cfg.duration-1);
            assert.ok(beginning.length>0&&middle.length>0&&ending.length>0);
            assert.notDeepEqual(beginning,middle,'Rendered moving source is unexpectedly frozen');
            assert.notDeepEqual(middle,ending,'Rendered frames should vary over the longer timeline');
            const motion=command('ffmpeg',['-v','error','-ss','1','-t','0.15',
                '-i',file,'-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],{binary:true});
            let squares=0;
            for(let i=0;i+3<motion.length;i+=4){
                const sample=motion.readFloatLE(i);squares+=sample*sample;
            }
            const audioRms=Math.sqrt(squares/Math.max(1,motion.length/4));
            assert.ok(audioRms>.005,'Missing audio in a moving clip: RMS '+audioRms);
            let lateAudioRms=null,tailAudioRms=null,afterIdleGc=null;
            if(longform){
                const rmsAt=time=>{
                    const pcm=command('ffmpeg',['-v','error','-ss',String(time),'-t','0.15',
                        '-i',file,'-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],{binary:true});
                    let sum=0;
                    for(let i=0;i+3<pcm.length;i+=4)sum+=pcm.readFloatLE(i)**2;
                    return Math.sqrt(sum/Math.max(1,pcm.length/4));
                };
                lateAudioRms=rmsAt(cfg.duration===120?108:54);
                tailAudioRms=rmsAt(cfg.duration-0.3);
                assert.ok(lateAudioRms>.005,'Late-timeline audio missing: RMS '+lateAudioRms);
                assert.ok(tailAudioRms<.002,'Unexpected sound in final background-only gap: RMS '+tailAudioRms);
                await page.evaluate(()=>globalThis.gc?.());
                await new Promise(resolve=>setTimeout(resolve,1200));
                afterIdleGc=chromeMemory(process.pid);
                assert.ok(afterIdleGc.pssKiB!==null,'Post-GC native PSS metrics unavailable');
            }
            const measurements=samples.filter(x=>x.pssKiB!==null);
            assert.ok(measurements.length>1,'Native PSS metrics unavailable on test runner');
            const peakPssMiB=Number((Math.max(...measurements.map(x=>x.pssKiB))/1024).toFixed(1));
            const baselinePssMiB=Number((base.pssKiB/1024).toFixed(1));
            const endPssMiB=Number((measurements.at(-1).pssKiB/1024).toFixed(1));
            const record={
                name:cfg.name,codec:video.codec_name,container:cfg.format,
                clips:cfg.clipCount,frames:Number(video.nb_read_frames),
                width:cfg.width,height:cfg.height,duration:Number(metadata.format.duration),
                sizeMB:Number((Number(metadata.format.size)/1048576).toFixed(2)),
                wallMs:Date.now()-started,browserRenderMs:result.renderMs,
                encodedFramesPerSecond:Number((Number(video.nb_read_frames)*1000/result.renderMs).toFixed(2)),
                proceduralEffects:cfg.stacked?2:0,
                chromePssBaselineMiB:baselinePssMiB,chromePssPeakMiB:peakPssMiB,
                chromePssLastMiB:endPssMiB,chromeProcessCountPeak:Math.max(...samples.map(x=>x.processCount)),
                memorySamples:measurements.length,audioRms:Number(audioRms.toFixed(4)),
                ...(longform?{
                    lateAudioRms:Number(lateAudioRms.toFixed(4)),
                    tailAudioRms:Number(tailAudioRms.toFixed(4)),
                    chromePssAfterIdleGcMiB:Number((afterIdleGc.pssKiB/1024).toFixed(1))
                }:{})
            };
            records.push(record);
            console.log('[MotoriClip '+phase+'] PASS '+cfg.name+' '+JSON.stringify(record));
        }catch(error){
            if(stacked){
                const valid=samples.filter(s=>s.pssKiB!==null);
                console.error('[MotoriClip 79 FAIL] '+cfg.name+' '+JSON.stringify({message:String(error),elapsedMs:Date.now()-started,baseline:base,last:valid.at(-1),peakPssKiB:Math.max(0,...valid.map(s=>s.pssKiB)),samples:valid.length}));
            }
            throw error;
        }finally{
            clearInterval(timer);
        }
    }
    assert.deepEqual(errors,[],'Browser uncaught errors');
    if(fullHd120||stacked){
        // A second observation after closing the Playwright context, because
        // GC within a still-open tab does not necessarily reclaim native media.
        const beforeContextClose=chromeMemory(process.pid);
        await context.close();
        await new Promise(resolve=>setTimeout(resolve,1500));
        const afterContextClose=chromeMemory(process.pid);
        assert.ok(beforeContextClose.pssKiB!==null&&afterContextClose.pssKiB!==null,
            'Native PSS sampling unavailable during context-close recovery');
        console.log('[MotoriClip 6L] CONTEXT CLOSE '+JSON.stringify({
            chromePssBeforeCloseMiB:Number((beforeContextClose.pssKiB/1024).toFixed(1)),
            chromePssAfterCloseMiB:Number((afterContextClose.pssKiB/1024).toFixed(1))
        }));
    }
    console.log('[MotoriClip '+phase+'] PASS completed long moving-video exports and native PSS samples '+JSON.stringify(records));
}finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
    if(!process.env.KEEP_MOTORICLIP_OUTPUT)await rm(temp,{recursive:true,force:true});
}
