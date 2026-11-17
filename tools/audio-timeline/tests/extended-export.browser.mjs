/**
 * End-to-end fixed-frame exporter smoke test using ACTUAL media codecs.
 * Run from repository root with playwright-core and ffmpeg/ffprobe installed.
 * Synthetic fixtures are created in a local ignored tests/fixtures folder.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const fixtures = join(root, 'tools/audio-timeline/tests/fixtures');
mkdirSync(fixtures, { recursive:true });
const temp = await mkdtemp(join(tmpdir(), 'motoriclip-qa-'));
const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.mp4':'video/mp4','.jpg':'image/jpeg'};
function run(bin, args, options={}) {
    const child = spawnSync(bin, args, {
        encoding:options.binary?undefined:'utf8', maxBuffer:32*1024*1024,
        timeout:90000, ...options
    });
    if (child.error || child.signal || child.status !== 0) {
        throw new Error(bin+' failed ('+JSON.stringify({
            status:child.status, signal:child.signal, error:child.error?.message,
            stderr:String(child.stderr||'').slice(-3000), args
        })+')');
    }
    return child.stdout;
}
function makeVideo(label, colour, tone, rate=25) {
    run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',`color=c=${colour}:s=320x180:r=${rate}:d=2`,
        '-f','lavfi','-i',`sine=f=${tone}:sample_rate=48000:d=2`,
        '-threads','1','-filter_threads','1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','128k','-t','2',join(fixtures,label+'.mp4')]);
}
makeVideo('red-440','red',440,24);
makeVideo('blue-660','blue',660,60);
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=yellow:s=320x180:d=1',
    '-frames:v','1','-update','1',join(fixtures,'background.jpg')]);

const server = createServer((request,response)=>{
    try {
        const resource = new URL(request.url,'http://localhost').pathname;
        const absolute = resolve(root,'.'+resource);
        if (!absolute.startsWith(root+'/') || !existsSync(absolute)) {response.writeHead(404);response.end('Not found');return}
        const body = readFileSync(absolute);
        response.writeHead(200,{'Content-Type':mime[extname(absolute)]||'application/octet-stream',
            'Cache-Control':'no-store','Content-Length':body.length});
        response.end(body);
    } catch (error) {response.writeHead(500);response.end(String(error))}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const chromePaths=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'];
const executablePath=process.env.CHROME_BIN||chromePaths.find(existsSync);
if(!executablePath)throw Error('No Chrome/Chromium browser installed');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-features=WebCodecs']});
const errors=[];
try {
    const context=await browser.newContext({acceptDownloads:true});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('console',message=>{if(message.type()==='error')errors.push('browser console: '+message.text());});
    await page.goto(`http://127.0.0.1:${port}/tools/audio-timeline/tests/browser-harness.html`);
    const available=await page.evaluate(()=>({
        video:typeof VideoEncoder,decoder:typeof VideoDecoder,audio:typeof OfflineAudioContext,
    }));
    assert.deepEqual(available,{video:'function',decoder:'function',audio:'function'});


    const twoClips=[
        {id:'red',colour:'red',start:.25,clipDuration:.6,sourceOffset:.35},
        {id:'blue',colour:'blue',start:1.1,clipDuration:.65,sourceOffset:.25}
    ];
    const stressSegments=(count,step,duration)=>Array.from({length:count},(_,index)=>({
        id:'stress-'+index,colour:index%2?'blue':'red',
        start:Number((index*step).toFixed(5)),clipDuration:duration,
        sourceOffset:index%2?.25:.35
    }));
    const cases=[
        {name:'720p-24-MP4',format:'mp4',width:1280,height:720,fps:24,duration:2,
            segments:twoClips,checkAudioSync:true},
        {name:'1080p-30-MP4',format:'mp4',width:1920,height:1080,fps:30,duration:1.8,
            segments:twoClips,checkAudioSync:true},
        {name:'720p-60-WebM',format:'webm',width:1280,height:720,fps:60,duration:1.8,
            segments:twoClips,checkAudioSync:false},
        {name:'10-clip-WebM',format:'webm',width:640,height:360,fps:25,duration:4.4,
            segments:stressSegments(10,.42,.32),checkAudioSync:false},
        {name:'25-clip-MP4',format:'mp4',width:640,height:360,fps:24,duration:6.25,
            segments:stressSegments(25,.25,.19),checkAudioSync:false},
    ];
    const measurements=[];
    for(const scenario of cases){
        console.log('[MotoriClip 6E] Starting '+scenario.name+' ('+scenario.segments.length+' video clips)...');
        const started=Date.now();
        const downloadPromise=page.waitForEvent('download',{timeout:240000});
        const exportPromise=page.evaluate(async cfg=>{
            const [{AdvancedOfflineExporter},{AdvancedMediaEngine}]=await Promise.all([
                import('../js/advanced-offline-export.mjs'),
                import('../js/advanced-media-engine-v0.24.js')
            ]);
            const getFile=async(name,type)=>{
                const response=await fetch('./fixtures/'+name);
                if(!response.ok)throw Error('Fixture missing '+name);
                return new File([await response.blob()],name,{type});
            };
            const [red,blue,bgFile]=await Promise.all([
                getFile('red-440.mp4','video/mp4'),
                getFile('blue-660.mp4','video/mp4'),
                getFile('background.jpg','image/jpeg')
            ]);
            const makeImage=async(file)=>{
                const image=new Image(),url=URL.createObjectURL(file);
                try {
                    await new Promise((resolve,reject)=>{
                        image.onload=resolve;image.onerror=reject;image.src=url;
                    });
                    return image;
                }finally{URL.revokeObjectURL(url)}
            };
            const background=await makeImage(bgFile);
            const overlayCanvas=document.createElement('canvas');
            overlayCanvas.width=320;overlayCanvas.height=180;
            const draw=overlayCanvas.getContext('2d');
            draw.fillStyle='#00ff00';draw.fillRect(0,0,28,28);
            const overlayBlob=await new Promise(resolve=>overlayCanvas.toBlob(resolve,'image/png'));
            const stickerFile=new File([overlayBlob],'sticker.png',{type:'image/png'});
            const sticker=await makeImage(stickerFile);
            const base={visible:true,opacity:1,blendMode:'source-over'};
            const audio={volume:1,muted:false,fadeIn:0,fadeOut:0};
            const tracks=[
                {...base,id:'background',type:'background',file:bgFile,media:background,sourceName:bgFile.name,
                    start:0,clipDuration:cfg.duration,sourceOffset:0,sourceDuration:cfg.duration,order:1},
                ...cfg.segments.map((segment,index)=>({
                    ...base,id:segment.id,type:'video',
                    file:segment.colour==='red'?red:blue,
                    sourceName:segment.colour==='red'?red.name:blue.name,
                    start:segment.start,clipDuration:segment.clipDuration,sourceOffset:segment.sourceOffset,
                    sourceDuration:2,order:index+1,media:null,audio:{...audio}
                })),
                {...base,id:'overlay',type:'sticker',file:stickerFile,media:sticker,sourceName:stickerFile.name,
                    start:0,clipDuration:cfg.duration,sourceOffset:0,sourceDuration:cfg.duration,
                    order:1,transparency:{mode:'native'}}
            ];
            const canvas=document.createElement('canvas');
            canvas.width=cfg.width;canvas.height=cfg.height;
            document.body.appendChild(canvas);
            const engine=new AdvancedMediaEngine({canvas,mediaBin:document.createElement('div'),
                onTimeChange(){},onDurationChange(){},onPlaybackChange(){},
                onRenderError(error){throw error}
            });
            engine.tracks=tracks;
            const status=[];
            const beforeHeap=performance.memory?.usedJSHeapSize||null;
            const exporter=new AdvancedOfflineExporter({
                engine,
                onState:s=>status.push(s.phase),
                onProgress(){},
                onDownload({blob,extension}){
                    const link=document.createElement('a'),url=URL.createObjectURL(blob);
                    link.href=url;link.download='motori-extended-'+cfg.name+'.'+extension;
                    document.body.appendChild(link);link.click();link.remove();
                    setTimeout(()=>URL.revokeObjectURL(url),10000);
                }
            });
            const begin=performance.now();
            const ok=await exporter.start({format:cfg.format,fps:cfg.fps,bitrateKbps:2500});
            const elapsedMs=Math.round(performance.now()-begin);
            canvas.remove();
            if(!ok||engine.currentTime!==0||exporter.busy)throw Error('Export lifecycle failed');
            return {elapsedMs,beforeHeap,afterHeap:performance.memory?.usedJSHeapSize||null,
                completed:status.includes('complete'),clips:tracks.length};
        },scenario);
        const download=await downloadPromise;
        const outcome=await exportPromise;
        assert.equal(outcome.clips,scenario.segments.length+2);
        assert.equal(outcome.completed,true);
        const file=join(temp,scenario.name+'.'+scenario.format);
        await download.saveAs(file);
        const info=JSON.parse(run('ffprobe',['-v','error','-count_frames',
            '-show_entries','stream=codec_type,codec_name,width,height,nb_read_frames',
            '-show_entries','format=duration,size','-of','json',file]));
        const video=info.streams.find(s=>s.codec_type==='video');
        const audio=info.streams.find(s=>s.codec_type==='audio');
        assert.ok(video&&audio,scenario.name+' should contain video and audio');
        assert.equal(Number(video.width),scenario.width);
        assert.equal(Number(video.height),scenario.height);
        assert.ok(Math.abs(Number(info.format.duration)-scenario.duration)<.13,
            scenario.name+' duration '+info.format.duration);
        const expectedFrames=Math.ceil(scenario.duration*scenario.fps-1e-8);
        assert.equal(Number(video.nb_read_frames),expectedFrames,
            scenario.name+' frame count mismatch');
        function samplePixel(time){
            const filter='crop=1:1:'+(scenario.width/2)+':'+(scenario.height/2)+',format=rgb24';
            const rgb=run('ffmpeg',['-v','error','-ss',String(time),'-i',file,
                '-frames:v','1','-vf',filter,'-f','rawvideo','pipe:1'],{binary:true});
            assert.ok(rgb.length>=3,scenario.name+' pixel read failed at '+time);
            return [rgb[0],rgb[1],rgb[2]];
        }
        const pick=[scenario.segments[0],scenario.segments[Math.floor(scenario.segments.length/2)],scenario.segments.at(-1)];
        for(const segment of pick){
            const rgb=samplePixel(segment.start+segment.clipDuration/2);
            if(segment.colour==='red')
                assert.ok(rgb[0]>rgb[1]*1.5&&rgb[0]>rgb[2]*1.5,
                    scenario.name+' expected red at '+segment.start+' got '+rgb);
            else
                assert.ok(rgb[2]>rgb[0]*1.5&&rgb[2]>rgb[1]*1.5,
                    scenario.name+' expected blue at '+segment.start+' got '+rgb);
        }
        if(scenario.checkAudioSync){
            const raw=run('ffmpeg',['-v','error','-i',file,'-vn','-ac','1','-ar','16000','-f','f32le',
                'pipe:1'],{binary:true});
            const rate=16000;
            const energy=(t,window=.02)=>{
                const start=Math.max(0,Math.floor(t*rate));
                const end=Math.min(Math.floor(raw.length/4),Math.floor((t+window)*rate));
                let sum=0;
                for(let i=start;i<end;i++){const v=raw.readFloatLE(i*4);sum+=v*v}
                return Math.sqrt(sum/Math.max(1,end-start));
            };
            const findOnset=(start)=>{
                for(let t=Math.max(0,start-.1);t<start+.18;t+=.01){
                    if(energy(t)>.022)return t;
                }
                return null;
            };
            const findEnd=(end)=>{
                for(let t=end+.15;t>end-.15;t-=.01){
                    if(energy(t)>.022)return t+.02;
                }
                return null;
            };
            for(const segment of scenario.segments){
                const onset=findOnset(segment.start);
                const offset=findEnd(segment.start+segment.clipDuration);
                assert.ok(onset!==null&&Math.abs(onset-segment.start)<.09,
                    scenario.name+' audio/video onset drift '+(onset===null?'missing':onset-segment.start));
                assert.ok(offset!==null&&Math.abs(offset-(segment.start+segment.clipDuration))<.11,
                    scenario.name+' audio/video end drift '+(offset===null?'missing':offset-(segment.start+segment.clipDuration)));
                const mid=segment.start+segment.clipDuration/2;
                assert.ok(energy(mid)>.02,scenario.name+' missing audio at '+mid);
            }
        }
        const elapsed=Date.now()-started;
        const m={name:scenario.name,format:scenario.format,dimensions:scenario.width+'x'+scenario.height,
            fps:scenario.fps,clips:scenario.segments.length,frames:expectedFrames,
            duration:Number(info.format.duration),elapsedMs:elapsed,
            browserExportMs:outcome.elapsedMs,bytes:Number(info.format.size),
            jsHeapDelta:outcome.beforeHeap&&outcome.afterHeap?outcome.afterHeap-outcome.beforeHeap:null};
        measurements.push(m);
        console.log('[MotoriClip 6E] PASS '+scenario.name,JSON.stringify(m));
    }
    assert.deepEqual(errors,[],'Browser errors detected');
    console.log('[MotoriClip 6E] All extended real-media cases passed.',JSON.stringify(measurements));
} finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
    if(!process.env.KEEP_MOTORICLIP_OUTPUT)await rm(temp,{recursive:true,force:true});
}
