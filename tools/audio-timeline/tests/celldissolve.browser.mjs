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
        // Independent WebGL reference: compile only the exact pinned upstream
        // GLSL, feed raw 1x1 A/B textures, and readPixels without using the
        // MotoriClip compositor, adjustment pipeline or shader renderer.
        const {CELL_DISSOLVE_SOURCE}=await import('../js/gl-transitions/CellDissolve.mjs');
        const referenceCanvas=document.createElement('canvas');
        referenceCanvas.width=w;referenceCanvas.height=h;
        const gl=referenceCanvas.getContext('webgl',{alpha:true,antialias:false,
            preserveDrawingBuffer:true,premultipliedAlpha:false});
        if(!gl)throw Error('Independent WebGL shader context unavailable');
        const makeShader=(type,code)=>{
            const sh=gl.createShader(type);
            gl.shaderSource(sh,code);gl.compileShader(sh);
            if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))
                throw Error('Reference shader compilation failed: '+gl.getShaderInfoLog(sh));
            return sh;
        };
        const vs=makeShader(gl.VERTEX_SHADER,`attribute vec2 xy; varying vec2 uv;
void main(){uv=(xy+1.0)*.5;gl_Position=vec4(xy,0.,1.);}`);
        const fs=makeShader(gl.FRAGMENT_SHADER,`precision highp float;
varying vec2 uv; uniform float progress; uniform float ratio;
uniform sampler2D incoming; uniform sampler2D outgoing;
vec4 getFromColor(vec2 p){return texture2D(outgoing,p);}
vec4 getToColor(vec2 p){return texture2D(incoming,p);}
${CELL_DISSOLVE_SOURCE}
void main(){gl_FragColor=transition(uv);}`);
        const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);
        gl.linkProgram(prog);
        if(!gl.getProgramParameter(prog,gl.LINK_STATUS))
            throw Error('Reference GL linking failed: '+gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
        const attr=gl.getAttribLocation(prog,'xy');gl.enableVertexAttribArray(attr);
        gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
        const bindTexture=(unit,name,rgba)=>{
            const tex=gl.createTexture();
            gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,
                new Uint8Array(rgba));
            gl.uniform1i(gl.getUniformLocation(prog,name),unit);
        };
        bindTexture(0,'outgoing',[0,32,255,255]);
        bindTexture(1,'incoming',[255,32,0,255]);
        const uniform=name=>gl.getUniformLocation(prog,name);
        gl.uniform1f(uniform('ratio'),w/h);
        const referenceFrame=(progress,settings)=>{
            gl.viewport(0,0,w,h);
            gl.uniform1f(uniform('progress'),progress);
            gl.uniform1f(uniform('cells'),settings.cells);
            gl.uniform1f(uniform('smoothness'),settings.smoothness);
            gl.uniform1f(uniform('border'),0);
            gl.uniform4fv(uniform('borderColor'),new Float32Array([1,.95,.8,0]));
            gl.uniform1f(uniform('seed'),settings.seed);
            gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            const raw=new Uint8Array(w*h*4);
            gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,raw);
            if(gl.getError()!==gl.NO_ERROR)throw Error('Reference shader readPixels failed');
            return raw;
        };
        const comparison=(frame,progress,settings)=>{
            const reference=referenceFrame(progress,settings);
            const points=frame.selected.map(({x,y,pixel})=>{
                const i=((h-1-y)*w+x)*4;
                const expected=Array.from(reference.slice(i,i+4));
                return {x,y,actual:pixel,expected};
            });
            return {points};
        };
        const options=[
            {cells:8,smoothness:.1,border:0,seed:0,borderAlpha:0},
            {cells:12,smoothness:.5,border:0,seed:17,borderAlpha:0},
            {cells:4,smoothness:.33,border:0,seed:-6,borderAlpha:0}
        ];
        const frames=options.flatMap(settings=>[0,.25,.5,.75,1].map(progress=>{
            const actual=frame(progress,settings);
            return {settings,progress,...actual,reference:comparison(actual,progress,settings)};
        }));
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
    assert.equal(result.shaderRan,true,'CellDissolve test must execute original WebGL shader');
    for(const frame of result.frames){
        for(const {x,y,actual,expected} of frame.reference.points){
            for(let channel=0;channel<4;channel++){
                assert.ok(Math.abs(actual[channel]-expected[channel])<=3,
                    'Isolated original GLSL reference mismatch '+JSON.stringify({
                        progress:frame.progress,settings:frame.settings,x,y,
                        actual,expected,channel
                    }));
            }
        }
        if(frame.progress===0||frame.progress===1){
            for(const {pixel} of frame.selected){
                const endColor=frame.progress===0?[0,32,255,255]:[255,32,0,255];
                for(let channel=0;channel<4;channel++)
                    assert.ok(Math.abs(pixel[channel]-endColor[channel])<=1,
                        'Incorrect untouched GLSL endpoint '+JSON.stringify({frame:frame.progress,pixel}));
            }
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
    console.log('[CellDissolve #03] PASS original Voronoi GLSL full-colour isolation oracle at 5 timestamps x 3 option sets, all native controls, alpha, GPU cleanup, stable seek');
    console.log('[CellDissolve #03 visual PNG] '+result.screenshot);
} finally {
    await browser.close();
    await new Promise(ok=>server.close(ok));
}
