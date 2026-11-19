/** Phase 8C–8H: verify actual Canvas 2D pixels for eighteen additional selected transitions.
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
            let red=0,blue=0,black=0,dark=0,white=0,mixed=0;
            for(let y=0;y<h;y+=4)for(let x=0;x<w;x+=4){
                const [r,g,v]=p(x,y);
                if(r>250&&g<4&&v<4)red++;
                else if(v>250&&r<4&&g<4)blue++;
                else if(r<4&&g<4&&v<4)black++;
                else if(r<36&&g<36&&v<36)dark++;
                else if(r>240&&g>240&&v>240)white++;
                else mixed++;
            }
            // Fast stable fingerprint useful for comparing successive renders.
            let fingerprint=2166136261>>>0;
            for(let k=0;k<bytes.length;k+=4){
                fingerprint=Math.imul((fingerprint^bytes[k])>>>0,16777619)>>>0;
                fingerprint=Math.imul((fingerprint^bytes[k+2])>>>0,16777619)>>>0;
            }
            return {fingerprint,red,blue,black,dark,white,mixed,top:p(6,6),center:p(98,60)};
        };
        const results={};
        for(const effect of ['fade','pixelize','random-squares','glitch-flicker','ripple','tv-turn-off','aperture-wipe','spiral-wipe','rings-wipe','color-panel-wipe','block-cover','cross-hatch','film-strip','card-swipe','camera-shake','vhs-tracking','spin','cube','cross-warp']){
            b.transitionEffectId=effect;
            b.media=['random-squares','ripple','tv-turn-off','aperture-wipe','spiral-wipe','rings-wipe','color-panel-wipe','block-cover','cross-hatch','film-strip','card-swipe','camera-shake','vhs-tracking','spin','cube','cross-warp'].includes(effect)?source('red'):source('stripes');
            results[effect]={
                before:sample(.8),
                start:sample(1),
                quarter:sample(1.25),
                middle:sample(1.5),
                threeQuarter:sample(1.75),
                repeat:sample(1.5),
                finished:sample(2.05)
            };
        }
        engine.clearAll();
        results.scratchReleased=engine.transitionFullScratch===null
            &&engine.transitionPixelScratch===null;
        return results;
    });
    for(const effect of ['fade','pixelize','random-squares','glitch-flicker','ripple','tv-turn-off','aperture-wipe','spiral-wipe','rings-wipe','color-panel-wipe','block-cover','cross-hatch','film-strip','card-swipe','camera-shake','vhs-tracking','spin','cube','cross-warp']){
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
    for(const effect of ['ripple','aperture-wipe']){
        const middle=result[effect].middle;
        assert.ok(middle.red>150&&middle.blue>150,effect+' should reveal B inside a circular mask while retaining A outside');
        assert.deepEqual(middle.center,[255,0,0],effect+' must reveal red B at the center');
        assert.deepEqual(middle.top,[0,0,255],effect+' must preserve blue A outside the wavefront');
    }
    assert.notEqual(result.ripple.middle.fingerprint,result['aperture-wipe'].middle.fingerprint,
        'Ripple wavefronts must visibly differ from a clean circular aperture');
    const tv=result['tv-turn-off'];
    assert.ok(tv.middle.black>1200,'TV shutdown midpoint should be almost entirely black');
    assert.ok(tv.middle.white>0,'TV shutdown midpoint should show a brief white scanline');
    assert.deepEqual(tv.quarter.center,[0,0,255],'First half of shutdown should still display collapsing A');
    assert.deepEqual(tv.quarter.top,[0,0,0],'Outside the shrinking A image should be black');
    assert.deepEqual(tv.threeQuarter.center,[255,0,0],'Second half should expand incoming B');
    assert.deepEqual(tv.threeQuarter.top,[0,0,0],'Outside the expanding B image should be black');
    const spiral=result['spiral-wipe'].middle;
    const rings=result['rings-wipe'].middle;
    const panels=result['color-panel-wipe'].middle;
    for(const [name,frame] of [['spiral-wipe',spiral],['rings-wipe',rings],['color-panel-wipe',panels]]){
        assert.ok(frame.red>120&&frame.blue>120,name+' should reveal parts of B over A halfway through');
        assert.equal(frame.fingerprint,result[name].repeat.fingerprint,name+' must rewind deterministically');
        assert.notEqual(frame.fingerprint,result.fade.middle.fingerprint,
            name+' must look different from a plain fade');
    }
    assert.notEqual(spiral.fingerprint,result['aperture-wipe'].middle.fingerprint,
        'Spiral angular sweep must differ visually from circular iris');
    assert.notEqual(rings.fingerprint,result['aperture-wipe'].middle.fingerprint,
        'Rings must produce multiple annuli, not a plain expanding iris');
    assert.notEqual(spiral.fingerprint,rings.fingerprint,'Spiral and Rings wipes should be distinct');
    assert.deepEqual(rings.center,[255,0,0],'Concentric rings must reveal the inner source at midpoint');
    assert.ok(panels.mixed>60,'Color-panel wipe should display tinted panels during transition');
    assert.ok(panels.red>200&&panels.blue>200,'Panel wipe must preserve clear old/new video colors');
    const block=result['block-cover'].middle;
    const hatch=result['cross-hatch'].middle;
    const film=result['film-strip'].middle;
    console.log('[MotoriClip 8F] New-effect middle-frame counts '+JSON.stringify({block,hatch,film}));
    for(const [name,frame] of [['block-cover',block],['cross-hatch',hatch],['film-strip',film]]){
        assert.ok(frame.red>100&&frame.blue>100,name+' must visibly retain A and reveal B at its midpoint');
        assert.equal(frame.fingerprint,result[name].repeat.fingerprint,
            name+' must return identical pixels after scrubbing');
        assert.notEqual(frame.fingerprint,result.fade.middle.fingerprint,
            name+' must not be a disguised plain fade');
    }
    assert.ok(block.mixed>80,'Block cover must show distinct tinted cover tiles, not only red and blue squares');
    assert.ok(film.dark>12,'Film strip must have visible dark-gray frame bars');
    assert.notEqual(block.fingerprint,result['random-squares'].middle.fingerprint,
        'Block cover must differ from the existing Random squares effect');
    assert.notEqual(hatch.fingerprint,result['spiral-wipe'].middle.fingerprint,
        'Cross hatch must show diagonal band geometry, not a spiral');
    assert.notEqual(film.fingerprint,block.fingerprint,'Film strip must differ from block cover');
    const card=result['card-swipe'],camera=result['camera-shake'],vhs=result['vhs-tracking'];
    assert.ok(card.middle.red>400&&card.middle.blue>400,
        'Card swipe should leave A on the left and slide an intact B card over the right');
    assert.notEqual(card.middle.fingerprint,result.fade.middle.fingerprint,
        'Card swipe must not look like a simple fade');
    assert.ok(camera.quarter.blue>900,
        'Camera shake should still show outgoing A during the first half');
    assert.ok(camera.threeQuarter.red>900,
        'Camera shake should show incoming B during the second half');
    assert.notEqual(camera.middle.fingerprint,card.middle.fingerprint,
        'Camera shake must not look like a card swipe');
    assert.ok(vhs.middle.mixed>400,'VHS tracking must show analog scanline and tracking distortion');
    assert.notEqual(vhs.middle.fingerprint,result['glitch-flicker'].middle.fingerprint,
        'VHS tracking must have distinct frame pixels from Glitch flicker');
    const spin=result.spin.middle,cube=result.cube.middle,crossWarp=result['cross-warp'].middle;
    console.log('[MotoriClip 8H] New-effect middle frame counts '+JSON.stringify({spin,cube,crossWarp}));
    for(const [name,frame] of [['spin',spin],['cube',cube],['cross-warp',crossWarp]]){
        assert.ok(frame.red>100&&frame.blue>100,name+' must show A and B simultaneously at the midpoint');
        assert.notEqual(frame.fingerprint,result.fade.middle.fingerprint,
            name+' must not look like an ordinary alpha fade');
        assert.equal(frame.fingerprint,result[name].repeat.fingerprint,
            name+' must be repeatable after timeline seeking');
    }
    assert.deepEqual(spin.center,[255,0,0],'Spin must place the rotated incoming frame at the center');
    assert.deepEqual(crossWarp.center,[255,0,0],'Cross warp must reveal the incoming frame at the cross center');
    assert.deepEqual(crossWarp.top,[0,0,255],'Cross warp must leave the outside corners showing A');
    assert.notEqual(spin.fingerprint,result['card-swipe'].middle.fingerprint,
        'Spin must rotate and scale the picture, not simply swipe it');
    assert.notEqual(cube.fingerprint,result['card-swipe'].middle.fingerprint,
        'Cube must project two surfaces, not slide a flat card');
    assert.notEqual(cube.fingerprint,spin.fingerprint,'Cube and Spin must be different effects');
    assert.notEqual(crossWarp.fingerprint,result['cross-hatch'].middle.fingerprint,
        'Cross warp must differ from diagonal cross hatch');
    assert.ok(result.scratchReleased,'Engine.clearAll must release scratch canvas buffers');
    assert.deepEqual(errors,[],'No uncaught browser errors');
    console.log('[MotoriClip 8H] PASS real Chrome 19-effect pixel checks (Spin, Cube, Cross warp), deterministic rewind and scratch release '+JSON.stringify(result));
}finally{
    await browser.close();
    await new Promise(done=>server.close(done));
}
