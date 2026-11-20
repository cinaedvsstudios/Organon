/**
 * SpiralBlockWipe #01 fidelity acceptance.
 * Exercises real Chrome WebGL rendering through AdvancedMediaEngine and checks
 * per-cell output against an independent translation of upstream spiralIndex
 * and transition() equations for all four direction combinations.
 *
 * Source: https://github.com/gl-transitions/gl-transitions/blob/deeebdee7581cdfe924ed9cf104ea2fd10e63155/transitions/SpiralBlockWipe.glsl
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';

const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'};
const server=createServer((request,response)=>{
    const path=resolve(root,'.'+new URL(request.url,'http://localhost').pathname);
    if(!path.startsWith(root+'/')||!existsSync(path)){response.writeHead(404);response.end('missing');return;}
    response.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
    response.end(readFileSync(path));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const executablePath=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Chrome unavailable');
const browser=await chromium.launch({executablePath,headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try {
    const page=await browser.newPage({viewport:{width:1000,height:700}});
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    const url='http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/';
    await page.goto(url+'tests/browser-harness.html',{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async()=>{
        const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
        const width=192,height=144;
        const source=(color,alpha=1)=>{
            const canvas=document.createElement('canvas');
            canvas.width=width;canvas.height=height;
            const ctx=canvas.getContext('2d');
            ctx.fillStyle=color;ctx.globalAlpha=alpha;
            ctx.fillRect(0,0,width,height);
            return canvas;
        };
        const output=document.createElement('canvas');
        output.width=width;output.height=height;
        const errors=[];
        const engine=new AdvancedMediaEngine({canvas:output,mediaBin:document.createElement('div'),
            onRenderError:error=>errors.push(error.message)});
        engine.outputWidth=width;engine.outputHeight=height;
        const a={id:'source-a',type:'video',sourceName:'a.png',file:{name:'a.png'},
            order:2,start:0,clipDuration:2,media:source('blue'),
            opacity:1,visible:true,blendMode:'source-over'};
        const b={id:'source-b',type:'video',sourceName:'b.png',file:{name:'b.png'},
            order:1,start:1,clipDuration:2,media:source('red'),
            transitionFromId:a.id,transitionEffectId:'spiralblockwipe',
            visualTransitions:{enter:{duration:1,curve:'linear'},exit:{duration:0,curve:'linear'}},
            opacity:1,visible:true,blendMode:'source-over'};
        engine.tracks=[a,b];
        const read=(time,options={})=>{
            b.transitionParameters={spiralblockwipe:options};
            engine.currentTime=time;
            engine.renderFrame();
            const data=output.getContext('2d').getImageData(0,0,width,height).data;
            const get=(px,py)=>{
                const index=(py*width+px)*4;
                return [...data.slice(index,index+4)];
            };
            const cells=[];
            const columns=options.columns||8,rows=options.rows||6;
            for(let row=0;row<rows;row++)
                for(let column=0;column<columns;column++)
                    cells.push({column,row,pixel:get(Math.floor((column+.5)*width/columns),
                        Math.floor((row+.5)*height/rows))});
            return {cells,raw:[...data],head:get(10,10),middle:get(width/2,height/2)};
        };
        const variants=[
            {columns:8,rows:6,inward:true,clockwise:true,smoothness:.05},
            {columns:8,rows:6,inward:true,clockwise:false,smoothness:0},
            {columns:8,rows:6,inward:false,clockwise:true,smoothness:.12},
            {columns:8,rows:6,inward:false,clockwise:false,smoothness:.05},
            {columns:4,rows:3,inward:true,clockwise:true,smoothness:.08}
        ];
        const opaque=variants.flatMap(options=>[0,.25,.5,.75,1].map(progress=>{
            const frame=read(1+progress,options);
            // Store representative cell-centre samples, not the entire framebuffer.
            return {options,progress,cells:frame.cells};
        }));
        const first=read(1.5,variants[0]),second=read(1.5,variants[0]);
        const deterministic=first.raw.every((value,i)=>value===second.raw[i]);
        const green={id:'background',type:'video',sourceName:'green.png',file:{name:'green.png'},
            order:3,start:0,clipDuration:3,media:source('lime'),
            opacity:1,visible:true,blendMode:'source-over'};
        a.media=source('blue',.5);b.media=source('red',.5);
        engine.tracks=[green,a,b];
        const alpha=read(1.5,variants[0]);
        engine.clearAll();
        return {opaque,deterministic,alpha:alpha.cells,
            cleanup:engine.spiralBlockWebGL===null
                &&engine.spiralBlockFromScratch===null
                &&engine.spiralBlockToScratch===null,
            errors};
    });
    const clamp=(v)=>Math.min(1,Math.max(0,v));
    function spiralIndex(x,y,nx,ny) {
        const k=Math.min(x,y,nx-1-x,ny-1-y);
        const sx=nx-2*k,sy=ny-2*k,lx=x-k,ly=y-k;
        const before=nx*ny-sx*sy;
        let along;
        if(ly===0)along=lx;
        else if(lx===sx-1)along=sx-1+ly;
        else if(ly===sy-1)along=2*sx+sy-3-lx;
        else along=2*(sx-1)+2*(sy-1)-ly;
        return before+along;
    }
    function originalMask(progress,x,y,{columns,rows,inward,clockwise,smoothness}){
        let nx=columns,ny=rows,cx=x,cy=y;
        if(clockwise!==inward){[cx,cy]=[cy,cx];[nx,ny]=[ny,nx];}
        const count=nx*ny;
        let i=spiralIndex(cx,cy,nx,ny);
        if(!inward)i=count-1-i;
        const w=Math.max(smoothness,0)*count;
        const offset=Math.max(.5*(1-w),0);
        const value=progress*(count-1+2*offset+w)-i-offset;
        if(!w)return value>=0?1:0;
        const t=clamp(value/w);
        return t*t*(3-2*t);
    }
    for(const frame of result.opaque){
        for(const {column,row,pixel} of frame.cells) {
            const m=frame.progress===0?0:frame.progress===1?1
                :originalMask(frame.progress,column,row,frame.options);
            const expected=[255*m,0,255*(1-m),255];
            for(let i=0;i<4;i++)
                assert.ok(Math.abs(pixel[i]-expected[i])<=8,
                    'GLSL mismatch '+JSON.stringify({options:frame.options,progress:frame.progress,
                        column,row,pixel,expected,channel:i}));
        }
    }
    assert.equal(result.deterministic,true,'Reverse seeking to the same timestamp must reproduce pixel-identical output');
    assert.equal(result.cleanup,true,'Clear All must release GPU, its textures, and both source scratch buffers');
    // At 50% progress, a half-opaque blue/red pair over a lime background
    // must not double-draw A. Compare original shader straight-alpha mix.
    const opts={columns:8,rows:6,inward:true,clockwise:true,smoothness:.05};
    for(const {column,row,pixel} of result.alpha) {
        const m=originalMask(.5,column,row,opts);
        const expected=[127.5*m,127.5,127.5*(1-m),255];
        for(let i=0;i<4;i++)
            assert.ok(Math.abs(pixel[i]-expected[i])<=9,
                'Premultiplied alpha compositing mismatch '+JSON.stringify({column,row,pixel,expected}));
    }
    assert.deepEqual(result.errors,[],'No GL source or render errors');
    assert.deepEqual(errors,[],'No uncaught browser errors');
    console.log('[SpiralBlockWipe #01] PASS original GLSL: 5 progress checkpoints × 5 option sets,'
        +' original spiralIndex/step/smoothstep, four turn modes, transparency, reverse seek, GPU cleanup');
} finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
}
