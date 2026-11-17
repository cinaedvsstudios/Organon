/**
 * Browser acceptance for genuine VFR video source and overlapping video/PNG layers.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root=process.cwd(),dir=join(root,'tools/audio-timeline/tests/fixtures');
mkdirSync(dir,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'motoriclip-vfr-'));
const exec=(name,args,opts={})=>{
    const x=spawnSync(name,args,{encoding:opts.binary?undefined:'utf8',timeout:90000,maxBuffer:16000000});
    if(x.status!==0||x.error)throw Error(name+' failed '+String(x.stderr||x.error));
    return x.stdout;
};
const vfrFile=join(dir,'vfr-pattern.mp4');
exec('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','lavfi','-i','testsrc2=size=320x180:rate=30:duration=2',
    '-f','lavfi','-i','sine=f=440:sample_rate=48000:duration=2',
    '-vf','select=not(mod(n\\,2))+not(mod(n\\,3))','-fps_mode','vfr',
    '-threads','1','-filter_threads','1','-c:v','libx264','-preset','ultrafast',
    '-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-t','2',vfrFile]);
for(const colour of ['red','blue']){
    exec('ffmpeg',['-hide_banner','-loglevel','error','-y',
        '-f','lavfi','-i','color=c='+colour+':s=320x180:r=30:d=2',
        '-f','lavfi','-i','sine=f=440:sample_rate=48000:duration=2',
        '-threads','1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','96k','-t','2',join(dir,colour+'-vfr-layer.mp4')]);
}
exec('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
    'color=c=yellow:s=320x180:d=1','-frames:v','1','-update','1',
    join(dir,'vfr-background.jpg')]);
const times=exec('ffprobe',['-v','error','-select_streams','v:0','-show_entries',
    'packet=pts_time','-of','csv=p=0',vfrFile]).trim().split(/\s+/).map(Number);
const deltas=new Set(times.slice(1).map((t,i)=>(t-times[i]).toFixed(3)));
assert.ok(deltas.size>1,'Generated test clip must have variable frame durations');
console.log('[MotoriClip VFR] input frame intervals:',[...deltas].join(','));
const server=createServer((req,res)=>{
    const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(root+'/')||!existsSync(file)){res.writeHead(404);res.end('Not found');return}
    const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
        '.mp4':'video/mp4','.jpg':'image/jpeg'};
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(readFileSync(file));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({
    executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage']
});
try{
    const context=await browser.newContext({acceptDownloads:true});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto('http://127.0.0.1:'+server.address().port+
        '/tools/audio-timeline/tests/browser-harness.html');
    const scenarios=[
        {name:'vfr-input',format:'mp4',duration:1.5,vfr:true},
        {name:'transparent-overlap',format:'webm',duration:1.4,vfr:false}
    ];
    const sample=(file,time,x=160,y=90)=>{
        const out=exec('ffmpeg',['-v','error','-ss',String(time),'-i',file,
            '-frames:v','1','-vf','crop=1:1:'+x+':'+y+',format=rgb24',
            '-f','rawvideo','pipe:1'],{binary:true});
        assert.ok(out.length>=3,'Missing frame at '+time);
        return [out[0],out[1],out[2]];
    };
    for(const cfg of scenarios){
        const downloadPromise=page.waitForEvent('download',{timeout:180000});
        const resultPromise=page.evaluate(async input=>{
            const [{AdvancedOfflineExporter},{AdvancedMediaEngine}]=await Promise.all([
                import('../js/advanced-offline-export.mjs'),
                import('../js/advanced-media-engine-v0.24.js')
            ]);
            const getFile=async(name,type)=>{
                const response=await fetch('./fixtures/'+name);
                if(!response.ok)throw Error('Fixture unavailable '+name);
                return new File([await response.blob()],name,{type});
            };
            const [vfr,red,blue,jpg]=await Promise.all([
                getFile('vfr-pattern.mp4','video/mp4'),
                getFile('red-vfr-layer.mp4','video/mp4'),
                getFile('blue-vfr-layer.mp4','video/mp4'),
                getFile('vfr-background.jpg','image/jpeg')
            ]);
            const getImage=async(file)=>{
                const image=new Image(),url=URL.createObjectURL(file);
                try{
                    await new Promise((done,fail)=>{
                        image.onload=done;image.onerror=fail;image.src=url;
                    });
                    return image;
                }finally{URL.revokeObjectURL(url)}
            };
            const background=await getImage(jpg);
            const stickerCanvas=document.createElement('canvas');
            stickerCanvas.width=320;stickerCanvas.height=180;
            const stickerContext=stickerCanvas.getContext('2d');
            stickerContext.fillStyle='#00ff00';
            stickerContext.fillRect(8,8,28,28);
            const stickerBlob=await new Promise(resolve=>stickerCanvas.toBlob(resolve,'image/png'));
            const stickerFile=new File([stickerBlob],'transparent.png',{type:'image/png'});
            const sticker=await getImage(stickerFile);
            const defaults={visible:true,opacity:1,blendMode:'source-over',
                audio:{volume:0,muted:true,fadeIn:0,fadeOut:0}};
            const track=(id,type,file,props)=>({
                ...defaults,id,type,file,sourceName:file.name,start:0,sourceOffset:0,
                clipDuration:input.duration,sourceDuration:2,order:1,...props
            });
            const tracks=[track('bg','background',jpg,{media:background})];
            if(input.vfr){
                tracks.push(track('vfr','video',vfr,{sourceOffset:.25}));
            }else{
                tracks.push(track('red','video',red,{start:.15,clipDuration:.8,order:2}));
                tracks.push(track('blue','video',blue,{start:.4,clipDuration:.55,order:1,opacity:.5}));
                tracks.push(track('sticker','sticker',stickerFile,{media:sticker,
                    transparency:{mode:'native'}}));
            }
            const canvas=document.createElement('canvas');
            canvas.width=320;canvas.height=180;
            const engine=new AdvancedMediaEngine({canvas,mediaBin:document.createElement('div'),
                onTimeChange(){},onDurationChange(){},onPlaybackChange(){},
                onRenderError(err){throw err}
            });
            engine.tracks=tracks;
            const phases=[];
            const exporter=new AdvancedOfflineExporter({
                engine,onState:s=>phases.push(s.phase),onProgress(){},
                onDownload({blob,extension}){
                    const url=URL.createObjectURL(blob),link=document.createElement('a');
                    link.href=url;link.download='vfr-'+input.name+'.'+extension;
                    document.body.appendChild(link);link.click();link.remove();
                    setTimeout(()=>URL.revokeObjectURL(url),12000);
                }
            });
            const success=await exporter.start({format:input.format,fps:30,bitrateKbps:3000});
            return {success,phases,tracks:tracks.length};
        },cfg);
        const download=await downloadPromise;
        const result=await resultPromise;
        assert.equal(result.success,true);
        assert.ok(result.phases.includes('complete'));
        const output=join(temp,cfg.name+'.'+cfg.format);
        await download.saveAs(output);
        const raw=exec('ffprobe',['-v','error','-count_frames',
            '-show_entries','stream=codec_type,width,height,nb_read_frames',
            '-show_entries','format=duration','-of','json',output]);
        const info=JSON.parse(raw),video=info.streams.find(x=>x.codec_type==='video');
        assert.equal(video.width,320);assert.equal(video.height,180);
        assert.equal(Number(video.nb_read_frames),Math.round(cfg.duration*30));
        assert.ok(Math.abs(Number(info.format.duration)-cfg.duration)<.14);
        if(cfg.vfr){
            for(const t of [.2,.5,.85]){
                const expected=sample(vfrFile,t+.25),actual=sample(output,t);
                const delta=expected.reduce((sum,x,i)=>sum+Math.abs(x-actual[i]),0)/3;
                assert.ok(delta<60,'VFR source mismatch '+t+': expected '+expected+' got '+actual);
            }
            console.log('[MotoriClip VFR] PASS genuine nonuniform PTS source -> fixed 30 fps',result);
        }else{
            const red=sample(output,.25),purple=sample(output,.65);
            const bg=sample(output,1.2),sticker=sample(output,.65,20,20);
            assert.ok(red[0]>150&&red[2]<85,'Expected red base: '+red);
            assert.ok(purple[0]>80&&purple[2]>80,'Expected purple overlap: '+purple);
            assert.ok(bg[0]>140&&bg[1]>140&&bg[2]<85,'Expected yellow background: '+bg);
            assert.ok(sticker[1]>145&&sticker[0]<85&&sticker[2]<85,'Expected green transparent overlay: '+sticker);
            console.log('[MotoriClip layers] PASS red, purple overlap, transparent PNG, yellow gap',{red,purple,bg,sticker});
        }
    }
    assert.deepEqual(errors,[]);
}finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
    if(!process.env.KEEP_MOTORICLIP_OUTPUT)await rm(temp,{recursive:true,force:true});
}
