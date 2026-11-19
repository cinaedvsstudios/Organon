/**
 * Phase 6J: bounded, isolated real WebKit fixed-frame encoder diagnostic.
 *
 * This is diagnostic, not a pass/fail release gate. Linux WebKit formerly
 * crashed during a codec probe. Report explicit outcome, and only claim
 * working WebM after an actual file passes FFprobe. Never claim it is Safari.
 */
import { webkit } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd(),timeoutMs=18000;
const temp=await mkdtemp(join(tmpdir(),'motoriclip-webkit-probe-'));
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript'};
const server=createServer((request,response)=>{
    try{
        const path=resolve(root,'.'+new URL(request.url,'http://localhost').pathname);
        if(!path.startsWith(root+'/')||!existsSync(path)){
            response.writeHead(404);response.end('Not found');return;
        }
        response.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});
        response.end(readFileSync(path));
    }catch(error){response.writeHead(500);response.end(String(error))}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser, classification={status:'NOT_STARTED'};
try{
    browser=await webkit.launch({headless:true});
    const context=await browser.newContext({acceptDownloads:true});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto('http://127.0.0.1:'+server.address().port+
        '/tools/audio-timeline/tests/browser-harness.html');
    const downloadPromise=page.waitForEvent('download',{timeout:timeoutMs}).catch(()=>null);
    const exportPromise=page.evaluate(async()=>{
        const [{AdvancedOfflineExporter},{AdvancedMediaEngine}]=await Promise.all([
            import('../js/advanced-offline-export.mjs'),
            import('../js/advanced-media-engine-v0.24.js')
        ]);
        const base=document.createElement('canvas');base.width=320;base.height=180;
        const painter=base.getContext('2d');
        painter.fillStyle='yellow';painter.fillRect(0,0,320,180);
        const blob=await new Promise(done=>base.toBlob(done,'image/png'));
        const file=new File([blob],'diagnostic.png',{type:'image/png'});
        const image=new Image(),url=URL.createObjectURL(file);
        try{
            await new Promise((done,fail)=>{image.onload=done;image.onerror=fail;image.src=url});
        }finally{URL.revokeObjectURL(url)}
        const canvas=document.createElement('canvas');
        canvas.width=320;canvas.height=180;
        const engine=new AdvancedMediaEngine({
            canvas,mediaBin:document.createElement('div'),
            onTimeChange(){},onDurationChange(){},onPlaybackChange(){},
            onRenderError(error){throw error}
        });
        engine.tracks=[{
            id:'still',type:'background',file,sourceName:file.name,media:image,
            start:0,sourceOffset:0,sourceDuration:.4,clipDuration:.4,
            visible:true,opacity:1,order:1,blendMode:'source-over'
        }];
        const statuses=[];
        const exporter=new AdvancedOfflineExporter({
            engine,onProgress(){},onState:s=>statuses.push(s.phase),
            onDownload({blob,extension}){
                const link=document.createElement('a'),u=URL.createObjectURL(blob);
                link.download='webkit-diagnostic.'+extension;
                link.href=u;document.body.appendChild(link);link.click();link.remove();
                setTimeout(()=>URL.revokeObjectURL(u),4000);
            }
        });
        try{
            const success=await exporter.start({format:'webm',fps:25,bitrateKbps:1000});
            return {success,statuses,errors:[]};
        }catch(error){
            return {success:false,statuses,error:String(error.message||error)};
        }
    });
    const outcome=await Promise.race([
        exportPromise.then(result=>({status:'RETURNED',result})).catch(error=>({
            status:'BROWSER_ERROR_OR_CLOSED',error:String(error.message||error)})),
        new Promise(resolve=>setTimeout(()=>resolve({status:'TIMED_OUT'}),timeoutMs))
    ]);
    classification=outcome;
    if(outcome.status==='RETURNED' && outcome.result?.success){
        const download=await downloadPromise;
        if(!download){
            classification={status:'INVALID_NO_DOWNLOAD',result:outcome.result};
        }else{
            const file=join(temp,'webkit-diagnostic.webm');
            await download.saveAs(file);
            const proc=spawnSync('ffprobe',['-v','error','-count_frames',
                '-show_entries','stream=codec_name,codec_type,width,height,nb_read_frames',
                '-show_entries','format=duration','-of','json',file],
                {encoding:'utf8',timeout:15000});
            if(proc.status===0){
                const parsed=JSON.parse(proc.stdout);
                const video=parsed.streams.find(x=>x.codec_type==='video');
                if(video?.nb_read_frames==='10' && video.width===320 && video.height===180){
                    classification={status:'ENCODED_VALID_WEBM',codec:video.codec_name,
                        frames:10,duration:parsed.format.duration,errors};
                }else{
                    classification={status:'INVALID_MEDIA',video,errors};
                }
            }else{
                classification={status:'FFPROBE_ERROR',error:String(proc.stderr)};
            }
        }
    }
    console.log('[MotoriClip WebKit diagnostic] '+JSON.stringify(classification));
    await context.close().catch(()=>{});
} catch(error){
    classification={status:'LAUNCH_OR_UNEXPECTED_ERROR',error:String(error.message||error)};
    console.log('[MotoriClip WebKit diagnostic] '+JSON.stringify(classification));
} finally {
    if(browser){
        await Promise.race([browser.close().catch(()=>{}),
            new Promise(resolve=>setTimeout(resolve,2500))]);
    }
    await new Promise(resolve=>server.close(resolve));
    await rm(temp,{recursive:true,force:true});
}
if(classification.status==='ENCODED_VALID_WEBM'){
    console.log('[MotoriClip 6J] WebKit fixed-frame encoding produced a verified WebM');
}else{
    console.log('[MotoriClip 6J] WebKit fixed-frame export NOT CERTIFIED: '+classification.status);
}
// Diagnostic always exits zero; its classification must be reviewed, not
// re-labelled a passing output simply because this CI step is green.
