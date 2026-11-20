/**
 * #03 CellDissolve: real Chrome/WebGL output against an independent
 * numerical reference for the original gre/MIT Voronoi shader.
 * Tests source texture ordering, aspect-ratio, seeded timing, alpha and controls.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';

const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'};
const server=createServer((req,res)=>{
    const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!path.startsWith(root+'/')||!existsSync(path)){res.writeHead(404);res.end('missing');return;}
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(readFileSync(path));
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome unavailable for real shader tests');
const browser=await chromium.launch({executablePath:chrome,headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
const W=192,H=120;
try{
    const page=await browser.newPage();
    const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
    await page.goto('http://127.0.0.1:'+server.address().port+
        '/tools/audio-timeline/tests/browser-harness.html');
    const result=await page.evaluate(async()=>{
        const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
        const w=192,h=120;
        const solid=(color,alpha=1)=>{
            const c=document.createElement('canvas');c.width=w;c.height=h;
            const ctx=c.getContext('2d');ctx.globalAlpha=alpha;
            ctx.fillStyle=color;ctx.fillRect(0,0,w,h);return c;
        };
        const output=document.createElement('canvas');output.width=w;output.height=h;
        const errors=[];
        const engine=new AdvancedMediaEngine({canvas:output,
            mediaBin:document.createElement('div'),onRenderError:e=>errors.push(String(e))});
        engine.outputWidth=w;engine.outputHeight=h;
        const a={id:'A',type:'video',sourceName:'blue.png',file:{name:'blue.png'},
            start:0,clipDuration:2,order:2,visible:true,opacity:1,
            blendMode:'source-over',media:solid('#0020ff')};
        const b={id:'B',type:'video',sourceName:'red.png',file:{name:'red.png'},
            start:1,clipDuration:2,order:1,visible:true,opacity:1,
            blendMode:'source-over',media:solid('#ff2000'),
            transitionFromId:'A',transitionEffectId:'cell-dissolve',
            visualTransitions:{enter:{type:'fade',curve:'linear',duration:1},
                exit:{type:'fade',curve:'linear',duration:0}}};
        engine.tracks=[a,b];
        const positions=[[8,7],[40,15],[74,11],[121,24],[180,30],
          [21,47],[55,63],[97,59],[137,62],[170,80],
          [5,102],[49,109],[92,92],[126,110],[162,115],
          [27,29],[57,39],[103,36],[149,47],[185,104]];
        const pixel=(pixels,x,y)=>{
            const i=(y*w+x)*4;return [...pixels.slice(i,i+4)];
        };
        const frame=(progress,settings,withAll=false)=>{
            b.transitionParameters={'cell-dissolve':settings};
            engine.currentTime=1+progress;engine.renderFrame();
            const canvas=output.getContext('2d');
            const data=canvas.getImageData(0,0,w,h).data;
            let hash=2166136261>>>0;
            for(let k=0;k<data.length;k+=4){
                hash=Math.imul((hash^data[k])>>>0,16777619)>>>0;
                hash=Math.imul((hash^data[k+2])>>>0,16777619)>>>0;
            }
            return {hash,selected:positions.map(([x,y])=>({x,y,pixel:pixel(data,x,y)})),
                png:withAll?canvas.canvas.toDataURL('image/png'):null};
        };
        const options=[
            {cells:8,smoothness:.1,border:0,seed:0,borderAlpha:0},
            {cells:12,smoothness:.5,border:0,seed:17,borderAlpha:0},
            {cells:4,smoothness:.33,border:0,seed:-6,borderAlpha:0}
        ];
        const frames=options.flatMap(settings=>[0,.25,.5,.75,1].map(progress=>({
            settings,progress,...frame(progress,settings)
        })));
        const baseline={cells:8,smoothness:.1,border:.006,borderColor:'#fff2cc',
            borderAlpha:1,seed:0};
        const before=frame(.5,baseline,true),same=frame(.5,baseline);
        frame(.23,baseline);
        const after=frame(.5,baseline);
        const controls={};
        for(const [name,value] of Object.entries({
            cells:20,smoothness:.9,border:.04,borderColor:'#00ff00',
            borderAlpha:0,seed:21
        }))controls[name]=frame(.5,{...baseline,[name]:value}).hash;
        const bg={id:'bg',type:'video',sourceName:'green.png',file:{name:'green.png'},
            start:0,clipDuration:4,order:3,visible:true,opacity:1,
            blendMode:'source-over',media:solid('#00ff00')};
        a.opacity=.5;b.opacity=.5;
        engine.tracks=[bg,a,b];
        const alpha=frame(.5,{cells:8,smoothness:.2,border:0,seed:0});
        a.visible=false;
        const hidden=frame(.5,{cells:8,smoothness:.2,border:0,seed:0});
        const shaderRan=Boolean(engine.cellDissolveWebGL);
        engine.clearAll();
        return {frames,baseline:before.hash,controls,screenshot:before.png,
            stable:before.hash===same.hash&&same.hash===after.hash,
            alpha:alpha.hash,hidden:hidden.hash,shaderRan,
            cleanup:engine.cellDissolveWebGL===null
                &&engine.cellDissolveFromScratch===null
                &&engine.cellDissolveToScratch===null,errors};
    });
    // Independent JS translation of shader hash22 and exact Voronoi timing.
    const fract=n=>n-Math.floor(n),smoothstep=(a,b,x)=>{
        const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
        return t*t*(3-2*t);
    };
    function hash22(x,y){
        let a=fract(x*.1031),b=fract(y*.103),c=fract(x*.0973);
        const dot=a*(b+33.33)+b*(c+33.33)+c*(a+33.33);
        a+=dot;b+=dot;c+=dot;
        return [fract((a+b)*c),fract((a+c)*b)];
    }
    function cellMask(x,y,progress,settings){
        if(progress===0)return 0;if(progress===1)return 1;
        const n=settings.cells,seed=settings.seed;
        const px=((x+.5)/W)*(W/H)*n,py=(1-(y+.5)/H)*n;
        const ix=Math.floor(px),iy=Math.floor(py),fx=fract(px),fy=fract(py);
        const ox=17.31*seed,oy=41.97*seed;
        let best=8,gx=0,gy=0;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
            const r=hash22(ix+dx+ox,iy+dy+oy);
            const sx=dx+r[0]-fx,sy=dy+r[1]-fy;
            const d=sx*sx+sy*sy;
            if(d<best){best=d;gx=dx;gy=dy;}
        }
        const h=hash22(ix+gx+ox+97.13,iy+gy+oy+97.13)[0];
        const width=Math.max(0,Math.min(1,settings.smoothness));
        const start=h*(1-width);
        return width>0?smoothstep(start,start+width,progress)
            :(progress>=start?1:0);
    }
    assert.equal(result.shaderRan,true,'CellDissolve test must execute original WebGL shader');
    for(const frame of result.frames){
        for(const {x,y,pixel} of frame.selected){
            const m=cellMask(x,y,frame.progress,frame.settings);
            const expected=[255*m,32,255*(1-m),255];
            for(let c=0;c<4;c++)
                assert.ok(Math.abs(pixel[c]-expected[c])<11,
                    'Original Voronoi timing mismatch '+JSON.stringify({
                        progress:frame.progress,settings:frame.settings,x,y,pixel,expected,channel:c
                    }));
        }
    }
    for(const [name,fingerprint] of Object.entries(result.controls))
        assert.notEqual(fingerprint,result.baseline,
            'Original uniform '+name+' must alter the real rendered pixels');
    assert.equal(result.stable,true,'Rewinding to same time must reproduce identical cells');
    assert.notEqual(result.alpha,result.hidden,
        'Hidden outgoing clip must not leak through the GLSL transition');
    assert.equal(result.cleanup,true,'Releasing project must free GPU and source textures');
    assert.deepEqual(result.errors,[],'No CellDissolve render errors');
    assert.deepEqual(pageErrors,[],'No uncaught browser errors');
    console.log('[CellDissolve #03] PASS original GLSL Voronoi mask reference at 5 timestamps x 3 independent option sets, all native controls, alpha, GPU cleanup, stable seek');
    console.log('[CellDissolve #03 visual PNG] '+result.screenshot);
} finally {
    await browser.close();
    await new Promise(ok=>server.close(ok));
}
