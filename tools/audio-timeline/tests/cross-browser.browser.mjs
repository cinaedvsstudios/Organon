/**
 * Phase 6I: browser-engine UI and export-capability matrix.
 * Linux Playwright Firefox/WebKit are not identical to real Firefox Android or
 * Safari on iPhone; only claim features confirmed on this runner.
 */
import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const root=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
    '.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer((request,response)=>{
    try{
        const target=resolve(root,'.'+new URL(request.url,'http://localhost').pathname);
        if(!target.startsWith(root+'/')||!existsSync(target)){
            response.writeHead(404);response.end('Not found');return;
        }
        const data=readFileSync(target);
        response.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream'});
        response.end(data);
    }catch(error){response.writeHead(500);response.end(String(error))}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/';
const browserTypes=[
    ['firefox',firefox],
    ['webkit',webkit]
];
if(process.env.INCLUDE_PLAYWRIGHT_CHROMIUM==='1')browserTypes.unshift(['chromium',chromium]);
try{
    for(const [name,engine] of browserTypes){
        console.log('[MotoriClip 6I] START '+name);
        const browser=await engine.launch({headless:true});
        try{
            const desktop=await browser.newContext({viewport:{width:1365,height:900}});
            const page=await desktop.newPage(),errors=[];
            page.on('pageerror',error=>errors.push(error.message));
            await page.goto(url+'index.html',{waitUntil:'domcontentloaded'});
            await page.waitForURL(/advanced\.html/,{timeout:25000});
            await page.locator('#project-fps').waitFor({state:'visible',timeout:20000});
            assert.match(await page.title(),/MotoriClip.+Advanced/i);
            await page.locator('#project-fps').selectOption('25');
            assert.equal(await page.locator('#project-fps').inputValue(),'25');
            await page.locator('#canvas-width').fill('640');
            await page.locator('#canvas-height').fill('360');
            await page.locator('#btn-apply-canvas').click();
            assert.equal(await page.locator('#advanced-canvas').getAttribute('width'),'640');
            assert.equal(await page.locator('#advanced-canvas').getAttribute('height'),'360');
            assert.ok(await page.locator('#btn-export-video').isVisible());
            assert.ok(await page.locator('#btn-export-offline').isVisible());
            const caps=await page.evaluate(async({probeCodec})=>{
                const hasType=(type)=>typeof window[type]!=='undefined';
                const available=hasType('VideoEncoder')&&hasType('VideoDecoder')&&hasType('OfflineAudioContext');
                const report={
                    videoEncoder:hasType('VideoEncoder'),videoDecoder:hasType('VideoDecoder'),
                    audioEncoder:hasType('AudioEncoder'),
                    offlineAudio:hasType('OfflineAudioContext'),
                    mediaRecorder:hasType('MediaRecorder'),
                    canvasCapture:typeof HTMLCanvasElement.prototype.captureStream==='function',
                    fixedFrameApisAvailable:available
                };
                report.webmVp9EncodeSupported=false;
                if(probeCodec&&report.videoEncoder&&typeof VideoEncoder.isConfigSupported==='function'){
                    try{
                        const codec=await VideoEncoder.isConfigSupported({
                            codec:'vp09.00.10.08',width:320,height:180,
                            bitrate:500000,framerate:25
                        });
                        report.webmVp9EncodeSupported=Boolean(codec?.supported);
                    }catch(error){report.webmVp9Error=String(error.message||error)}
                }
                if(probeCodec&&!available){
                    const {AdvancedOfflineExporter}=await import('./js/advanced-offline-export.mjs');
                    const exp=new AdvancedOfflineExporter({engine:{
                        isPlaying:false,getTimelineDuration(){return 1},tracks:[]
                    }});
                    try{await exp.start({format:'webm',fps:25})}
                    catch(error){report.unsupportedMessage=String(error.message||error)}
                }
                if(!probeCodec)report.codecProbe='not run on Linux WebKit after prior browser process crash';
                return report;
            },{probeCodec:name!=='webkit'});
            assert.equal(caps.fixedFrameApisAvailable,
                caps.videoEncoder&&caps.videoDecoder&&caps.offlineAudio,
                'Exporter availability differs from its required browser APIs');
            if(!caps.fixedFrameApisAvailable&&name!=='webkit'){
                assert.match(caps.unsupportedMessage||'',/WebCodecs\/OfflineAudioContext/,
                    'Unsupported browser must receive a clear error');
            }
            await page.locator('#btn-basic-mode').click();
            await page.waitForURL(/mode=basic/,{timeout:20000});
            await page.locator('#btn-advanced-mode').click();
            await page.waitForURL(/advanced\.html/,{timeout:20000});
            assert.deepEqual(errors,[],name+' desktop threw uncaught exceptions');
            await desktop.close();

            // UA-based phone route can be tested in Firefox without claiming
            // true mobile emulation (Playwright isMobile is unsupported there).
            const phoneContext=await browser.newContext({
                viewport:{width:393,height:851},hasTouch:true,
                userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
            });
            const phone=await phoneContext.newPage(),phoneErrors=[];
            phone.on('pageerror',error=>phoneErrors.push(error.message));
            await phone.goto(url+'index.html',{waitUntil:'domcontentloaded'});
            assert.match(phone.url(),/index\.html/);
            assert.doesNotMatch(phone.url(),/advanced\.html/);
            assert.match(await phone.title(),/MotoriClip.+Basic/i);
            await phone.locator('#btn-advanced-mode').click();
            await phone.waitForURL(/advanced\.html/,{timeout:20000});
            await phone.locator('#btn-basic-mode').click();
            await phone.waitForURL(/mode=basic/,{timeout:20000});
            assert.deepEqual(phoneErrors,[],name+' phone-style UA threw uncaught exceptions');
            await phoneContext.close();
            console.log('[MotoriClip 6I] PASS '+name+' desktop/mobile-ua UI '+JSON.stringify(caps));
        }finally{await browser.close()}
    }
}finally{await new Promise(resolve=>server.close(resolve))}
