/**
 * MotoriClip Phase 6I: encoded phone-like H.264/AAC QuickTime MOV + rotated
 * MP4 video, from synthetically generated sources (NOT actual phone files).
 * Validates portrait canvas geometry, decoded source orientation, frame count
 * and audible audio in real Chrome outputs.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root=process.cwd(),fixtures=join(root,'tools/audio-timeline/tests/fixtures');
mkdirSync(fixtures,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'motori-phone-style-'));
function run(bin,args,{raw=false}={}){
    const p=spawnSync(bin,args,{encoding:raw?undefined:'utf8',maxBuffer:32000000,timeout:120000});
    if(p.status!==0||p.error||p.signal){
        throw Error(bin+' failed '+JSON.stringify({
            args,status:p.status,signal:p.signal,stderr:String(p.stderr||p.error||'').slice(-3000)
        }));
    }
    return p.stdout;
}
function createVideo(file,size,draw){
    run('ffmpeg',['-hide_banner','-loglevel','error','-y',
        '-f','lavfi','-i','testsrc2=size='+size+':rate=30:duration=4',
        '-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=4',
        '-vf',draw,'-threads','1','-filter_threads','1',
        '-c:v','libx264','-preset','ultrafast','-crf','20','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','128k','-t','4',file]);
}
const portrait=join(fixtures,'synthetic-portrait.mov');
const landscape=join(fixtures,'synthetic-landscape.mp4');
const rotated=join(fixtures,'synthetic-rotate90.mp4');
createVideo(portrait,'360x640',
    'drawbox=x=0:y=0:w=120:h=120:color=red:t=fill,'+
    'drawbox=x=240:y=520:w=120:h=120:color=blue:t=fill');
createVideo(landscape,'640x360',
    'drawbox=x=0:y=0:w=110:h=110:color=red:t=fill,'+
    'drawbox=x=530:y=250:w=110:h=110:color=blue:t=fill');
run('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-i',landscape,'-c','copy','-metadata:s:v:0','rotate=90',rotated]);
const orientation=JSON.parse(run('ffprobe',['-v','error','-show_entries',
    'stream=width,height,side_data_list','-of','json',rotated]));
const sourceVideo=orientation.streams.find(s=>s.width===640);
assert.ok(sourceVideo,'Rotation source dimension missing');
const metadata=JSON.stringify(sourceVideo.side_data_list||[]);
assert.match(metadata,/"rotation":\s*(90|-90|270)/,'Fixture needs true rotation metadata');
console.log('[MotoriClip 6I] Rotation metadata confirmed:',metadata);
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript',
    '.mov':'video/quicktime','.mp4':'video/mp4'};
const server=createServer((request,response)=>{
    try{
        const filename=resolve(root,'.'+new URL(request.url,'http://localhost').pathname);
        if(!filename.startsWith(root+'/')||!existsSync(filename)){
            response.writeHead(404);response.end('missing');return;
        }
        response.writeHead(200,{'Content-Type':mime[extname(filename)]||'application/octet-stream',
            'Cache-Control':'no-store'});
        response.end(readFileSync(filename));
    }catch(error){response.writeHead(500);response.end(String(error))}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({
    executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-features=WebCodecs']
});
try{
    const context=await browser.newContext({acceptDownloads:true});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto('http://127.0.0.1:'+server.address().port+
        '/tools/audio-timeline/tests/browser-harness.html');
    const scenarios=[
        {name:'portrait-mov',source:'synthetic-portrait.mov',type:'video/quicktime'},
        {name:'rotated-mp4',source:'synthetic-rotate90.mp4',type:'video/mp4'}
    ];
    for(const cfg of scenarios){
        const downloadPromise=page.waitForEvent('download',{timeout:180000});
        const task=page.evaluate(async opts=>{
            const [{AdvancedOfflineExporter},{AdvancedMediaEngine}]=await Promise.all([
                import('../js/advanced-offline-export.mjs'),
                import('../js/advanced-media-engine-v0.24.js')
            ]);
            const res=await fetch('./fixtures/'+opts.source);
            if(!res.ok)throw Error('Failed to load '+opts.source);
            const file=new File([await res.blob()],opts.source,{type:opts.type});
            const canvas=document.createElement('canvas');
            canvas.width=720;canvas.height=1280;
            document.body.appendChild(canvas);
            const engine=new AdvancedMediaEngine({
                canvas,mediaBin:document.createElement('div'),
                onTimeChange(){},onDurationChange(){},onPlaybackChange(){},
                onRenderError(error){throw error}
            });
            engine.tracks=[{
                id:opts.name,type:'video',sourceName:file.name,file,media:null,
                start:0,sourceOffset:.25,clipDuration:3,sourceDuration:4,
                visible:true,opacity:1,order:1,blendMode:'source-over',
                audio:{volume:1,muted:false,fadeIn:0,fadeOut:0}
            }];
            const statuses=[];
            const exporter=new AdvancedOfflineExporter({
                engine,onState:s=>statuses.push(s.phase),onProgress(){},
                onDownload({blob,extension}){
                    const url=URL.createObjectURL(blob);
                    const link=document.createElement('a');
                    link.href=url;link.download='phone-style-'+opts.name+'.'+extension;
                    document.body.appendChild(link);link.click();link.remove();
                    setTimeout(()=>URL.revokeObjectURL(url),10000);
                }
            });
            try{
                const success=await exporter.start({format:'mp4',fps:25,bitrateKbps:2500});
                return {success,statuses,busy:exporter.busy,inputs:exporter.inputs.size};
            }finally{canvas.remove()}
        },cfg);
        const download=await downloadPromise, result=await task;
        assert.equal(result.success,true);
        assert.equal(result.busy,false);
        assert.equal(result.inputs,0);
        assert.ok(result.statuses.includes('complete'));
        const file=join(temp,cfg.name+'.mp4');
        await download.saveAs(file);
        const decoded=JSON.parse(run('ffprobe',['-v','error','-count_frames',
            '-show_entries','stream=codec_type,codec_name,width,height,nb_read_frames',
            '-show_entries','format=duration','-of','json',file]));
        const video=decoded.streams.find(s=>s.codec_type==='video');
        const audio=decoded.streams.find(s=>s.codec_type==='audio');
        assert.ok(video&&audio,cfg.name+' must include H.264 and AAC');
        assert.equal(video.codec_name,'h264');
        assert.equal(audio.codec_name,'aac');
        assert.equal(video.width,720);
        assert.equal(video.height,1280);
        assert.equal(Number(video.nb_read_frames),75);
        assert.ok(Math.abs(Number(decoded.format.duration)-3)<.12);
        function pixel(x,y){
            const bytes=run('ffmpeg',['-v','error','-ss','1','-i',file,
                '-frames:v','1','-vf','crop=1:1:'+x+':'+y+',format=rgb24',
                '-f','rawvideo','pipe:1'],{raw:true});
            assert.ok(bytes.length>=3);
            return [bytes[0],bytes[1],bytes[2]];
        }
        const corners=[[80,80],[640,80],[80,1200],[640,1200]].map(([x,y])=>pixel(x,y));
        const reds=corners.filter(p=>p[0]>160&&p[0]>p[1]*1.7&&p[0]>p[2]*1.7);
        const blues=corners.filter(p=>p[2]>110&&p[2]>p[0]*1.5&&p[2]>p[1]*1.5);
        assert.ok(reds.length>=1,cfg.name+' red corner missing: '+JSON.stringify(corners));
        assert.ok(blues.length>=1,cfg.name+' blue corner missing: '+JSON.stringify(corners));
        // Rotation metadata should be rendered into frames: no landscape
        // letterboxing for the source that is stored landscape but displayed portrait.
        const beginning=run('ffmpeg',['-v','error','-ss','0.5','-i',file,
            '-frames:v','1','-vf','scale=18:32,format=rgb24','-f','rawvideo','pipe:1'],{raw:true});
        const ending=run('ffmpeg',['-v','error','-ss','2.4','-i',file,
            '-frames:v','1','-vf','scale=18:32,format=rgb24','-f','rawvideo','pipe:1'],{raw:true});
        assert.notDeepEqual(beginning,ending,cfg.name+' produced a frozen video');
        const pcm=run('ffmpeg',['-v','error','-ss','1','-t','0.2','-i',file,
            '-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],{raw:true});
        let sq=0;
        for(let i=0;i+3<pcm.length;i+=4){const val=pcm.readFloatLE(i);sq+=val*val}
        const rms=Math.sqrt(sq/Math.max(1,pcm.length/4));
        assert.ok(rms>.015,'Missing decoded audio in '+cfg.name);
        console.log('[MotoriClip 6I] PASS '+cfg.name,JSON.stringify({
            frames:Number(video.nb_read_frames),
            dimensions:video.width+'x'+video.height,
            duration:Number(decoded.format.duration),cornerSamples:corners,
            rms:Number(rms.toFixed(4))
        }));
    }
    assert.deepEqual(errors,[],'Browser reported script exceptions');
}finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
    if(!process.env.KEEP_MOTORICLIP_OUTPUT)await rm(temp,{recursive:true,force:true});
}
