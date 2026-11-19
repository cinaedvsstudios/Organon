/**
 * Phase 8A: exercise the real Chrome canvas renderer and schematic UI.
 * Videos are generated as coloured canvas media in the browser: no network,
 * user footage or codec-dependent fixture is required for this first fade QA.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve,extname } from 'node:path';

const root=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};
const server=createServer((req,res)=>{
    const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(root+'/')||!existsSync(file)){res.writeHead(404);res.end('missing');return}
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});
    res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome unavailable for Phase 8A QA');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
    const page=await browser.newPage({viewport:{width:1450,height:900}});
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    const origin='http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/';
    await page.goto(origin+'advanced.html',{waitUntil:'domcontentloaded'});
    await page.locator('#video-transition-card').waitFor({state:'attached'});
    assert.equal(await page.locator('#video-transition-enter').count(),1);
    assert.equal(await page.locator('#video-transition-exit').count(),1);
    assert.match(await page.locator('.transition-schematic').getAttribute('aria-label'),/blue Video A.*red Video B/i);
    await page.goto(origin+'tests/browser-harness.html',{waitUntil:'domcontentloaded'});
    const pixels=await page.evaluate(async()=>{
        const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
        const colour=(fill,id)=>{
            const source=document.createElement('canvas');
            source.width=20;source.height=20;source.getContext('2d').fillStyle=fill;
            source.getContext('2d').fillRect(0,0,20,20);
            source.dataset.id=id;
            return source;
        };
        const output=document.createElement('canvas');
        output.width=20;output.height=20;
        const engine=new AdvancedMediaEngine({canvas:output,mediaBin:document.createElement('div'),
            onRenderError:error=>{throw error}});
        engine.outputWidth=20;engine.outputHeight=20;
        engine.tracks=[
            {id:'A',type:'video',order:2,sourceName:'A-blue',start:0,clipDuration:4,
                media:colour('#0000ff','A'),visible:true,opacity:1,blendMode:'source-over'},
            {id:'B',type:'video',order:1,sourceName:'B-red',start:1,clipDuration:2,
                media:colour('#ff0000','B'),visible:true,opacity:1,blendMode:'source-over',
                visualTransitions:{enter:{duration:1,curve:'linear'},exit:{duration:1,curve:'linear'}}}
        ];
        const result={};
        for(const t of [0.5,1,1.5,2,2.5,3.1]){
            engine.currentTime=t;
            engine.renderFrame();
            result[t]=[...output.getContext('2d').getImageData(10,10,1,1).data].slice(0,3);
        }
        return result;
    });
    const near=(actual,expected,name)=>{
        for(let i=0;i<3;i++)assert.ok(Math.abs(actual[i]-expected[i])<=3,
            name+' expected '+expected+' got '+actual);
    };
    near(pixels['0.5'],[0,0,255],'before B');
    near(pixels['1'],[0,0,255],'start B entrance');
    near(pixels['1.5'],[128,0,128],'midpoint B entrance');
    near(pixels['2'],[255,0,0],'fully visible B');
    near(pixels['2.5'],[128,0,128],'midpoint B exit');
    near(pixels['3.1'],[0,0,255],'after B');
    assert.deepEqual(errors,[],'Transition preview has uncaught browser errors');
    console.log('[MotoriClip 8A] PASS actual Chrome composite alpha before/during/after blue-to-red overlap and A/B inspector controls '+JSON.stringify(pixels));
} finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
}
