/** Phase 8C: verify actual Canvas 2D pixels for three selected transitions.
 * No mocked pixels: the real AdvancedMediaEngine composites source canvases.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname,resolve } from 'node:path';

const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'};
const server=createServer((request,response)=>{
    const path=resolve(root,'.'+new URL(request.url,'http://localhost').pathname);
    if(!path.startsWith(root+'/')||!existsSync(path)){response.writeHead(404);response.end('missing');return;}
    response.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});
    response.end(readFileSync(path));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const executablePath=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Chrome unavailable');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    const url='http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/';
    await page.goto(url+'tests/browser-harness.html',{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async()=>{
        const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
        const w=196,h=112;
        const source=pattern=>{
            const canvas=document.createElement('canvas');
            canvas.width=w;canvas.height=h;
            const ctx=canvas.getContext('2d');
            if(pattern==='blue'||pattern==='red'){
                ctx.fillStyle=pattern;ctx.fillRect(0,0,w,h);
            }else{
                for(let x=0;x<w;x++){
                    ctx.fillStyle=x%4<2?'#ff0000':'#00ff00';
                    ctx.fillRect(x,0,1,h);
                }
            }
            return canvas;
        };
        const output=document.createElement('canvas');
        output.width=w;output.height=h;
        const engine=new AdvancedMediaEngine({canvas:output,mediaBin:document.createElement('div'),
            onRenderError:e=>{throw e;}});
        engine.outputWidth=w;engine.outputHeight=h;
        const a={id:'A',type:'video',sourceName:'A.mp4',file:{name:'A.mp4'},
            order:2,start:0,clipDuration:2,media:source('blue'),
            opacity:1,visible:true,blendMode:'source-over'};
        const b={id:'B',type:'video',sourceName:'B.mp4',file:{name:'B.mp4'},
            order:1,start:1,clipDuration:3,media:source('red'),
            transitionFromId:'A',transitionEffectId:'fade',
            visualTransitions:{enter:{duration:1,curve:'linear'},exit:{duration:0,curve:'linear'}},
            opacity:1,visible:true,blendMode:'source-over'};
        engine.tracks=[a,b];
        const sample=(time)=>{
            engine.currentTime=time;
            engine.renderFrame();
            const bytes=output.getContext('2d').getImageData(0,0,w,h).data;
            const p=(x,y)=>{
                const i=(y*w+x)*4;
                return [...bytes.slice(i,i+3)];
            };
            let red=0,blue=0,mixed=0;
            for(let y=0;y<h;y+=4)for(let x=0;x<w;x+=4){
                const [r,g,v]=p(x,y);
                if(r>250&&g<4&&v<4)red++;
                else if(v>250&&r<4&&g<4)blue++;
                else mixed++;
            }
            // Fast stable fingerprint useful for comparing successive renders.
            let fingerprint=2166136261>>>0;
            for(let k=0;k<bytes.length;k+=4){
                fingerprint=Math.imul((fingerprint^bytes[k])>>>0,16777619)>>>0;
                fingerprint=Math.imul((fingerprint^bytes[k+2])>>>0,16777619)>>>0;
            }
            return {fingerprint,red,blue,mixed,top:p(6,6),center:p(98,60)};
        };
        const results={};
        for(const effect of ['fade','pixelize','random-squares','glitch-flicker']){
            b.transitionEffectId=effect;
            b.media=effect==='random-squares'?source('red'):source('stripes');
            results[effect]={
                before:sample(.8),
                start:sample(1),
                middle:sample(1.5),
                repeat:sample(1.5),
                finished:sample(2.05)
            };
        }
        engine.clearAll();
        results.scratchReleased=engine.transitionFullScratch===null
            &&engine.transitionPixelScratch===null;
        return results;
    });
    for(const effect of ['fade','pixelize','random-squares','glitch-flicker']){
        const r=result[effect];
        assert.deepEqual(r.before.center,[0,0,255],effect+' should show A before B');
        assert.deepEqual(r.start.center,[0,0,255],effect+' should start with only A');
        assert.equal(r.middle.fingerprint,r.repeat.fingerprint,effect+' must be frame deterministic');
        assert.notDeepEqual(r.finished.center,[0,0,255],effect+' must reveal B after transition');
    }
    const squares=result['random-squares'].middle;
    assert.ok(squares.red>100&&squares.blue>100,'Random squares must reveal fully opaque B tiles over A');
    assert.ok(squares.mixed<5,'Random squares should not darken cells with a global crossfade');
    assert.notEqual(result.pixelize.middle.fingerprint,result.fade.middle.fingerprint,
        'Pixelize must visibly differ from an ordinary fade');
    assert.notEqual(result['glitch-flicker'].middle.fingerprint,result.fade.middle.fingerprint,
        'Glitch flicker must visibly differ from a simple fade');
    assert.ok(result.scratchReleased,'Engine.clearAll must release scratch canvas buffers');
    assert.deepEqual(errors,[],'No uncaught browser errors');
    console.log('[MotoriClip 8C] PASS live Chrome Pixelize, Random squares and Glitch flicker pixel tests, deterministic rewind and scratch release '+JSON.stringify(result));
}finally{
    await browser.close();
    await new Promise(done=>server.close(done));
}
