/** Phase 8C–8O: verify actual Canvas 2D pixels for thirty-three additional selected transitions.
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
        for(const effect of ['fade','pixelize','random-squares','glitch-flicker','ripple','tv-turn-off','aperture-wipe','spiral-wipe','rings-wipe','color-panel-wipe','block-cover','cross-hatch','film-strip','card-swipe','camera-shake','vhs-tracking','spin','cube','cross-warp','paper-tear','ink-bleed','splatter-wipe','cell-dissolve','bloom-dissolve','smoke-dissolve','vortex','heat-haze','refraction','liquid-fill','disintegrate','light-rays','ascii','color-codes','prisms','spiralblockwipe','hologram','crumple','sphere','snapshot','gallery','bokeh-dissolve']){
            b.transitionEffectId=effect;
            b.media=['random-squares','ripple','tv-turn-off','aperture-wipe','spiral-wipe','rings-wipe','color-panel-wipe','block-cover','cross-hatch','film-strip','card-swipe','camera-shake','vhs-tracking','spin','cube','cross-warp','paper-tear','ink-bleed','splatter-wipe','cell-dissolve','bloom-dissolve','smoke-dissolve','liquid-fill','disintegrate','light-rays','color-codes'].includes(effect)?source('red'):source('stripes');
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
    for(const effect of ['fade','pixelize','random-squares','glitch-flicker','ripple','tv-turn-off','aperture-wipe','spiral-wipe','rings-wipe','color-panel-wipe','block-cover','cross-hatch','film-strip','card-swipe','camera-shake','vhs-tracking','spin','cube','cross-warp','paper-tear','ink-bleed','splatter-wipe','cell-dissolve','bloom-dissolve','smoke-dissolve','vortex','heat-haze','refraction','liquid-fill','disintegrate','light-rays','ascii','color-codes','prisms','spiralblockwipe','hologram','crumple','sphere','snapshot','gallery','bokeh-dissolve']){
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
    for(const [name,frame] of [['spiral-wipe',spiral],['rings-wipe',rings]]){
        assert.ok(frame.red>120&&frame.blue>120,name+' should reveal parts of B over A halfway through');
        assert.equal(frame.fingerprint,result[name].repeat.fingerprint,name+' must rewind deterministically');
        assert.notEqual(frame.fingerprint,result.fade.middle.fingerprint,
            name+' must look different from a plain fade');
    }
    // Original ColorPanelWipe covers the screen with solid colored panels
    // near the midpoint; it is intentionally NOT a simultaneous red/blue
    // mosaic. The held coverage masks the cut to incoming B.
    assert.equal(panels.fingerprint,result['color-panel-wipe'].repeat.fingerprint,
        'Original colored panels must scrub deterministically');
    assert.notEqual(panels.fingerprint,result.fade.middle.fingerprint,
        'Original colored panels must not be a disguised crossfade');
    assert.notEqual(result['color-panel-wipe'].quarter.fingerprint,
        result['color-panel-wipe'].threeQuarter.fingerprint,
        'Original color panels must sweep in and then sweep away');
    assert.notEqual(spiral.fingerprint,result['aperture-wipe'].middle.fingerprint,
        'Spiral angular sweep must differ visually from circular iris');
    assert.notEqual(rings.fingerprint,result['aperture-wipe'].middle.fingerprint,
        'Rings must produce multiple annuli, not a plain expanding iris');
    assert.notEqual(spiral.fingerprint,rings.fingerprint,'Spiral and Rings wipes should be distinct');
    assert.deepEqual(rings.center,[255,0,0],'Concentric rings must reveal the inner source at midpoint');
    assert.ok(panels.mixed>60,'Original ColorPanelWipe must display solid tinted panels mid-transition');
    assert.ok(result['color-panel-wipe'].before.blue>200
        &&result['color-panel-wipe'].finished.red>200,
        'Original panels must begin on outgoing A and end on incoming B');
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
    // The original CardSwipe throws A around an offset pivot, so the cards
    // do NOT necessarily occupy left/right halves at the midpoint. Validate
    // A departing and the incoming B growing over the course of the sweep.
    assert.ok(card.quarter.blue>100,
        'Original CardSwipe should still show the departing A card early');
    // The incoming card is shaded and depth-scaled until the endpoint;
    // counting only fully saturated red pixels is not a valid measure.
    assert.notEqual(card.quarter.fingerprint,card.threeQuarter.fingerprint,
        'Original CardSwipe must animate the pivot and incoming depth');
    assert.notEqual(card.threeQuarter.fingerprint,card.finished.fingerprint,
        'Original CardSwipe must continue bringing in B from reduced depth');
    assert.deepEqual(card.finished.center,[255,0,0],
        'Original CardSwipe must finish with the incoming B image');
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
    const paper=result['paper-tear'],ink=result['ink-bleed'],splatter=result['splatter-wipe'];
    console.log('[MotoriClip 8I] Mask midframe counts '+JSON.stringify({
        paper:paper.middle,ink:ink.middle,splatter:splatter.middle
    }));
    for(const [name,frame] of [['paper-tear',paper],['ink-bleed',ink],['splatter-wipe',splatter]]){
        assert.ok(frame.middle.red>120&&frame.middle.blue>120,
            name+' must reveal distinct regions of both A and B at midpoint');
        assert.equal(frame.middle.fingerprint,frame.repeat.fingerprint,
            name+' should reproduce exactly when seeking to the same time');
        assert.notEqual(frame.middle.fingerprint,result.fade.middle.fingerprint,
            name+' must differ from an ordinary fade');
    }
    assert.ok(paper.middle.red>350&&paper.middle.blue>350,
        'Paper tear must be visibly torn along a progressing left-to-right boundary');
    assert.ok(ink.middle.mixed>5,'Organic ink edges must be different from rectangular tiles');
    assert.notEqual(ink.middle.fingerprint,splatter.middle.fingerprint,
        'Spreading ink pools and directional splatter should look different');
    assert.notEqual(splatter.middle.fingerprint,result['random-squares'].middle.fingerprint,
        'Paint splatter must not collapse to a simple square mosaic');
    assert.ok(ink.threeQuarter.red>ink.quarter.red,'Ink must spread as time advances');
    assert.ok(splatter.threeQuarter.red>splatter.quarter.red,
        'Splatter should expand from left to right as time advances');
    assert.ok(ink.finished.red>1300&&splatter.finished.red>1300,
        'Both masks must resolve to a clean incoming B source');
    const cell=result['cell-dissolve'],bloom=result['bloom-dissolve'],smoke=result['smoke-dissolve'];
    console.log('[MotoriClip 8J] New midpoint samples '+JSON.stringify({
        cell:cell.middle,bloom:bloom.middle,smoke:smoke.middle
    }));
    assert.ok(cell.middle.red>150&&cell.middle.blue>150,
        'Cell dissolve must show open and unopened hexagonal areas');
    assert.ok(cell.middle.mixed>4,
        'Cell dissolve must use antialiased growing cell edges, not hard square tiles');
    assert.notEqual(cell.middle.fingerprint,result['random-squares'].middle.fingerprint,
        'Cell dissolve must differ from random squares');
    assert.notEqual(cell.middle.fingerprint,result['ink-bleed'].middle.fingerprint,
        'Cell dissolve must differ from ink bleed');
    assert.ok(bloom.middle.mixed>500,'Bloom dissolve must blend the two source videos');
    // The authentic shader amplifies actual source highlights, not a fixed
    // white radial flash. With red B and blue A it brightens red/blue into
    // magenta without inventing green light that the sources do not contain.
    assert.ok(bloom.middle.center[0]>result.fade.middle.center[0]+10
        &&bloom.middle.center[2]>result.fade.middle.center[2]+10,
        'Original BloomDissolve must amplify both source highlight channels above a plain fade');
    assert.notEqual(bloom.middle.fingerprint,result.fade.middle.fingerprint,
        'Bloom dissolve must visibly differ from a plain fade');
    assert.notEqual(bloom.middle.fingerprint,cell.middle.fingerprint,
        'Bloom must differ from the growing cell mask');
    assert.ok(smoke.middle.mixed>500,'Smoke dissolve must create a translucent midframe');
    assert.ok(smoke.middle.center[1]>6,
        'Smoke must introduce pale grey cloudy color over the video');
    assert.notEqual(smoke.middle.fingerprint,bloom.middle.fingerprint,
        'Smoke and Bloom must be visually distinct');
    assert.notEqual(smoke.middle.fingerprint,result.fade.middle.fingerprint,
        'Smoke dissolve must not be a disguised fade');
    assert.ok(smoke.quarter.blue>0||smoke.quarter.mixed>0,
        'Outgoing A must remain represented early in the smoke reveal');
    assert.equal(cell.middle.fingerprint,cell.repeat.fingerprint);
    assert.equal(bloom.middle.fingerprint,bloom.repeat.fingerprint);
    assert.equal(smoke.middle.fingerprint,smoke.repeat.fingerprint);
    const vortex=result.vortex,heat=result['heat-haze'],lens=result.refraction;
    console.log('[MotoriClip 8K] New distorted-frame pixel counts '+JSON.stringify({
        vortex:vortex.middle,heat:heat.middle,refraction:lens.middle
    }));
    assert.ok(vortex.middle.blue>150&&vortex.middle.red>150&&vortex.middle.black===0,
        'Original Vortex must retain visible flying A tiles while revealing B without uncovered holes');
    assert.notEqual(vortex.middle.fingerprint,result.fade.middle.fingerprint,
        'Vortex must not look like a plain fade on the same incoming stripes');
    assert.ok(heat.middle.mixed>900,
        'Heat haze should create a smoothly displaced blended B image');
    assert.notEqual(heat.middle.fingerprint,result.fade.middle.fingerprint,
        'Heat haze must visibly displace patterned B, not just crossfade');
    assert.notEqual(heat.middle.fingerprint,vortex.middle.fingerprint,
        'Heat haze and Vortex must render different distortions');
    assert.ok(lens.middle.mixed>900,
        'Refraction should bend the entire incoming striped image through triangular facets');
    assert.notEqual(lens.middle.fingerprint,result.fade.middle.fingerprint,
        'Refraction must render prismatic facet boundaries, not an ordinary fade');
    assert.notEqual(lens.middle.fingerprint,heat.middle.fingerprint,
        'Refraction lenses must differ from thermal heat waves');
    assert.notEqual(lens.middle.fingerprint,vortex.middle.fingerprint,
        'Refraction must differ from original flying-square Vortex');
    assert.equal(vortex.middle.fingerprint,vortex.repeat.fingerprint);
    assert.equal(heat.middle.fingerprint,heat.repeat.fingerprint);
    assert.equal(lens.middle.fingerprint,lens.repeat.fingerprint);
    const liquid=result['liquid-fill'],disintegrate=result.disintegrate,rays=result['light-rays'];
    console.log('[MotoriClip 8L] New effect midpoint samples '+JSON.stringify({
        liquid:liquid.middle,disintegrate:disintegrate.middle,rays:rays.middle
    }));
    for(const [name,frame] of [['liquid-fill',liquid],['disintegrate',disintegrate]]){
        assert.ok(frame.middle.red>200&&frame.middle.blue>200,
            name+' must display both Video A and Video B at midpoint');
        assert.equal(frame.middle.fingerprint,frame.repeat.fingerprint,
            name+' must produce exactly the same pixels after scrubbing');
        assert.notEqual(frame.middle.fingerprint,result.fade.middle.fingerprint,
            name+' must be distinct from the plain crossfade');
        assert.ok(frame.finished.red>1300,
            name+' must resolve cleanly to incoming B after completion');
    }
    // Real LightRays is a screened, highlight-driven light field across a short
    // A/B switch, not red/blue radial sectors with unshaded source regions.
    assert.equal(rays.middle.fingerprint,rays.repeat.fingerprint,
        'Original light shafts must be deterministic under reverse scrubbing');
    assert.notEqual(rays.middle.fingerprint,result.fade.middle.fingerprint,
        'Original LightRays must differ from a flat crossfade');
    assert.ok(rays.finished.red>1300,
        'Original LightRays must finish on incoming B video');
    assert.deepEqual(liquid.middle.top,[0,0,255],
        'Liquid fill must retain outgoing blue Video A above the liquid surface');
    assert.ok(liquid.middle.mixed>10,'Liquid fill should draw a soft cyan moving crest');
    assert.ok(liquid.threeQuarter.red>liquid.quarter.red,
        'Liquid fill must reveal more of incoming B as the water rises');
    assert.ok(disintegrate.middle.mixed>40,
        'Disintegrating fragments must move and fade across the outgoing video');
    assert.notEqual(disintegrate.middle.fingerprint,result['random-squares'].middle.fingerprint,
        'Disintegrate must not be another static random-square reveal');
    assert.notEqual(disintegrate.middle.fingerprint,result['block-cover'].middle.fingerprint,
        'Disintegrate must not just cover cells');
    assert.ok(rays.middle.mixed>25,'LightRays must produce screened transitional light, not opaque radial wedges');
    assert.notEqual(rays.middle.fingerprint,result['rings-wipe'].middle.fingerprint,
        'Light rays must not be a concentric ring wipe');
    assert.notEqual(rays.middle.fingerprint,result['spiral-wipe'].middle.fingerprint,
        'Light rays must not be a spiral');
    assert.notEqual(rays.middle.fingerprint,liquid.middle.fingerprint);
    const ascii=result.ascii,codes=result['color-codes'],prisms=result.prisms;
    console.log('[MotoriClip 8M] New-effect sampled pixels '+JSON.stringify({
        ascii:ascii.middle,colorCodes:codes.middle,prisms:prisms.middle
    }));
    for(const [name,frame] of [['ascii',ascii],['color-codes',codes],['prisms',prisms]]){
        assert.equal(frame.middle.fingerprint,frame.repeat.fingerprint,
            name+' must render identically after scrubbing to the same time');
        assert.notEqual(frame.middle.fingerprint,result.fade.middle.fingerprint,
            name+' must not be a renamed Fade');
        assert.ok(frame.middle.mixed>500,
            name+' must show real transitional graphic detail');
        assert.notDeepEqual(frame.finished.center,[0,0,255],
            name+' must resolve to the incoming video');
    }
    assert.ok(ascii.middle.center[1]>0,
        'ASCII must draw colored monospace glyphs over the source image');
    assert.notEqual(ascii.middle.fingerprint,result.pixelize.middle.fingerprint,
        'ASCII glyph sampling must be distinct from Pixelize');
    assert.notEqual(codes.middle.fingerprint,result['color-panel-wipe'].middle.fingerprint,
        'Hex color-code panels must differ from color panel wipe');
    assert.notEqual(codes.middle.fingerprint,ascii.middle.fingerprint,
        'Hex color codes must differ from ASCII art');
    assert.notEqual(prisms.middle.fingerprint,result.refraction.middle.fingerprint,
        'Prisms must use spectral radial facets rather than triangular Refraction tiles');
    assert.notEqual(prisms.middle.fingerprint,result.vortex.middle.fingerprint,
        'Prisms must differ from swirling annular Vortex');
    for(const id of ['spiralblockwipe','hologram','crumple','sphere','snapshot','gallery','bokeh-dissolve']){
        const frame=result[id];
        assert.equal(frame.middle.fingerprint,frame.repeat.fingerprint,id+' must scrub deterministically');
        assert.notEqual(frame.middle.fingerprint,result.fade.middle.fingerprint,id+' must differ from Fade');
        assert.notDeepEqual(frame.finished.center,[0,0,255],id+' must resolve to B');
    }
    assert.notEqual(result.spiralblockwipe.middle.fingerprint,result['spiral-wipe'].middle.fingerprint);
    assert.notEqual(result.hologram.middle.fingerprint,result['vhs-tracking'].middle.fingerprint);
    assert.notEqual(result.crumple.middle.fingerprint,result.refraction.middle.fingerprint);
    assert.ok(result.scratchReleased,'Engine.clearAll must release scratch canvas buffers');
    assert.deepEqual(errors,[],'No uncaught browser errors');
    console.log('[MotoriClip 8O] PASS real Chrome 41-effect pixel checks (ASCII, Color codes, Prisms), deterministic rewind and scratch release '+JSON.stringify(result));
}finally{
    await browser.close();
    await new Promise(done=>server.close(done));
}
