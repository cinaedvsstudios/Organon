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
function makeVideo(label, colour, tone) {
    run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',`color=c=${colour}:s=320x180:r=25:d=2`,
        '-f','lavfi','-i',`sine=f=${tone}:sample_rate=48000:d=2`,
        '-threads','1','-filter_threads','1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','128k','-t','2',join(fixtures,label+'.mp4')]);
}
makeVideo('red-440','red',440);
makeVideo('blue-660','blue',660);
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

    for (const format of ['webm','mp4']) {
        console.log('[MotoriClip E2E] Encoding',format,'at 25 fps, 320x180...');
        const downloadPromise=page.waitForEvent('download',{timeout:180000});
        const exportPromise=page.evaluate(async fmt=>{
            const [{AdvancedOfflineExporter},{AdvancedMediaEngine}]=await Promise.all([
                import('../js/advanced-offline-export.mjs'),
                import('../js/advanced-media-engine-v0.24.js'),
            ]);
            const fetchFile=async(name,type)=>{
                const response=await fetch('./fixtures/'+name);
                if(!response.ok)throw Error('Fixture fetch failed: '+name);
                return new File([await response.blob()],name,{type});
            };
            const [red,blue,background]=await Promise.all([
                fetchFile('red-440.mp4','video/mp4'),fetchFile('blue-660.mp4','video/mp4'),
                fetchFile('background.jpg','image/jpeg'),
            ]);
            const loadImage=async(blob)=>{
                const image=new Image();
                const url=URL.createObjectURL(blob);
                try {
                    await new Promise((resolve,reject)=>{
                        image.onload=resolve;image.onerror=reject;image.src=url;
                    });
                    return image;
                } finally { URL.revokeObjectURL(url); }
            };
            const bg=await loadImage(background);
            const overlayCanvas=document.createElement('canvas');
            overlayCanvas.width=320;overlayCanvas.height=180;
            overlayCanvas.getContext('2d').fillStyle='#00ff00';
            overlayCanvas.getContext('2d').fillRect(0,0,28,28);
            const overlayFile=await new Promise(resolve=>overlayCanvas.toBlob(blob=>resolve(new File([blob],'sticker.png',{type:'image/png'})),'image/png'));
            const sticker=await loadImage(overlayFile);
            const audio={volume:1,muted:false,fadeIn:0,fadeOut:0};
            const tracks=[
                {id:'background',type:'background',sourceName:'background.jpg',file:background,
                 media:bg,start:0,clipDuration:4,sourceOffset:0,sourceDuration:4,visible:true,opacity:1,order:1,blendMode:'source-over'},
                {id:'red',type:'video',sourceName:'red-440.mp4',file:red,
                 media:null,start:.5,clipDuration:1,sourceOffset:.5,sourceDuration:2,visible:true,opacity:1,order:1,blendMode:'source-over',audio:{...audio}},
                {id:'blue',type:'video',sourceName:'blue-660.mp4',file:blue,
                 media:null,start:2.5,clipDuration:1,sourceOffset:.5,sourceDuration:2,visible:true,opacity:1,order:2,blendMode:'source-over',audio:{...audio}},
                {id:'overlay',type:'sticker',sourceName:'sticker.png',file:overlayFile,
                 media:sticker,start:0,clipDuration:4,sourceOffset:0,sourceDuration:4,visible:true,opacity:1,order:1,blendMode:'source-over',transparency:{mode:'native'}}
            ];
            const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
            document.body.appendChild(canvas);
            const engine=new AdvancedMediaEngine({canvas,mediaBin:document.createElement('div'),
                onTimeChange(){},onDurationChange(){},onPlaybackChange(){},onRenderError(error){throw error}});
            engine.tracks=tracks;
            const messages=[];
            const exporter=new AdvancedOfflineExporter({
                engine,onState:state=>messages.push(state),onProgress:()=>{},
                onDownload({blob,extension}){
                    const link=document.createElement('a');const url=URL.createObjectURL(blob);
                    link.href=url;link.download='motoriclip-e2e.'+extension;
                    document.body.appendChild(link);link.click();link.remove();
                    setTimeout(()=>URL.revokeObjectURL(url),15000);
                }
            });
            await exporter.start({format:fmt,fps:25,bitrateKbps:3000});
            return {messages,previewTime:engine.currentTime,trackCount:engine.tracks.length};
        },format);
        const download=await downloadPromise;
        const outcome=await exportPromise;
        assert.equal(outcome.trackCount,4);
        assert.equal(download.suggestedFilename(),`motoriclip-e2e.${format}`);
        const file=join(temp,`motori-${format}.${format}`);
        await download.saveAs(file);
        const info=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_type,codec_name,width,height,nb_read_frames,duration','-show_entries','format=duration',
            '-of','json',file]));
        const vid=info.streams.find(s=>s.codec_type==='video');
        const aud=info.streams.find(s=>s.codec_type==='audio');
        assert.ok(vid,`${format}: missing video stream`);
        assert.ok(aud,`${format}: missing audio stream`);
        assert.equal(Number(vid.width),320);assert.equal(Number(vid.height),180);
        assert.ok(Math.abs(Number(info.format.duration)-4)<.15,`${format} output duration ${info.format.duration}`);
        const count=Number(vid.nb_read_frames);
        assert.ok(count>=99&&count<=101,`${format}: output frame count ${count} expected 100`);
        function pixel(t) {
            const data=run('ffmpeg',['-v','error','-ss',String(t),'-i',file,'-frames:v','1',
                '-vf','crop=1:1:160:90,format=rgb24','-f','rawvideo','pipe:1'],{binary:true});
            assert.ok(data.length>=3,'Could not sample frame');
            return [data[0],data[1],data[2]];
        }
        const [yellow,redPixel,gap,bluePixel]=[.2,1,2,3].map(pixel);
        assert.ok(yellow[0]>100&&yellow[1]>100&&yellow[2]<150,`${format}: expected background yellow at .2s, got ${yellow}`);
        assert.ok(redPixel[0]>redPixel[1]*1.5&&redPixel[0]>redPixel[2]*1.5,`${format}: expected red at 1s, got ${redPixel}`);
        assert.ok(gap[0]>100&&gap[1]>100&&gap[2]<150,`${format}: expected background gap at 2s, got ${gap}`);
        assert.ok(bluePixel[2]>bluePixel[0]*1.5&&bluePixel[2]>bluePixel[1]*1.5,`${format}: expected blue at 3s, got ${bluePixel}`);
        function rms(t) {
            const raw=run('ffmpeg',['-v','error','-ss',String(t),'-t','.15','-i',file,
                '-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],{binary:true});
            let squares=0;const count=Math.floor(raw.length/4);
            for(let i=0;i<count;i++){const value=raw.readFloatLE(i*4);squares+=value*value}
            return Math.sqrt(squares/Math.max(1,count));
        }
        const rmsValues=[.1,.9,2,2.9,3.8].map(rms);
        assert.ok(rmsValues[0]<.006&&rmsValues[2]<.006&&rmsValues[4]<.006,`${format}: expected silence in gaps, got ${rmsValues}`);
        assert.ok(rmsValues[1]>.015&&rmsValues[3]>.015,`${format}: expected audio in both clips, got ${rmsValues}`);
        console.log('[MotoriClip E2E] PASS',format,{duration:info.format.duration,frames:count,codecs:[vid.codec_name,aud.codec_name],colors:{yellow,redPixel,gap,bluePixel},rms:rmsValues,states:outcome.messages.map(x=>x.phase)});
    }
    assert.deepEqual(errors,[],'Browser reported script errors');
    console.log('[MotoriClip E2E] Both MP4 and WebM real-media export checks passed.');
} finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
    if(!process.env.KEEP_MOTORICLIP_OUTPUT)await rm(temp,{recursive:true,force:true});
}
