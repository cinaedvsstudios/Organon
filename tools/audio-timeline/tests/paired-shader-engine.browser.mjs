/**
 * #42: independently verify the whole WebGL+Canvas compositor, not just GLSL.
 * Checks source A/B suppression, transparency, portrait contain/landscape
 * cover, orientation, resizing, non-shader layers and Canvas blend modes.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';

const root=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'};
const server=createServer((req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+'/')||!existsSync(file)){
    res.writeHead(404);res.end('not found');return;
  }
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});
  res.end(readFileSync(file));
});
await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'A real Chrome WebGL implementation is required');
const browser=await chromium.launch({executablePath:chrome,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
  const result=await page.evaluate(async()=>{
    const [{AdvancedMediaEngine},{isAvailablePairEffect,ACTIVE_PAIR_EFFECTS}]=await Promise.all([
      import('../js/advanced-media-engine-v0.24.js'),
      import('../js/paired-visual-effects.mjs')
    ]);
    const W=160,H=96;
    const make=(w,h,draw)=>{
      const c=document.createElement('canvas');c.width=w;c.height=h;
      draw(c.getContext('2d'),w,h);return c;
    };
    const bg=make(W,H,(g,w,h)=>{g.fillStyle='#2c7653';g.fillRect(0,0,w,h);});
    const portrait=make(56,112,(g,w,h)=>{
      g.fillStyle='rgba(236,48,37,.8)';g.fillRect(0,0,w,h/2);
      g.fillStyle='rgba(20,59,229,.65)';g.fillRect(0,h/2,w,h/2);
      g.clearRect(w/3,h/3,w/3,h/3); // Real transparent pixels.
    });
    const landscape=make(240,60,(g,w,h)=>{
      g.fillStyle='rgba(38,220,238,.75)';g.fillRect(0,0,w,h/2);
      g.fillStyle='rgba(242,189,24,.9)';g.fillRect(0,h/2,w,h/2);
      g.clearRect(w/3,0,w/4,h); // Orientation-sensitive alpha cutout.
    });
    const hud=make(W,H,(g,w,h)=>{
      g.fillStyle='#fff900';g.fillRect(w/2-3,0,6,h);
    });
    const output=make(W,H,()=>{});
    const problems=[];
    const engine=new AdvancedMediaEngine({canvas:output,mediaBin:document.createElement('div'),
      onRenderError:e=>problems.push(String(e))});
    engine.outputWidth=W;engine.outputHeight=H;
    const track=(id,type,media,order,start=0,length=4)=>({
      id,type,media,order,start,clipDuration:length,sourceName:id+'.png',file:{name:id+'.png'},
      visible:true,opacity:1,blendMode:'source-over'
    });
    const under=track('under','background',bg,30);
    const a=track('A','video',portrait,3,0,2);
    const b=track('B','video',landscape,2,1,2);
    b.transitionFromId='A';b.transitionEffectId='fade';
    b.visualTransitions={enter:{type:'fade',curve:'linear',duration:1},
      exit:{type:'fade',curve:'linear',duration:0}};
    const overlay=track('overlay','sticker',hud,0);
    overlay.opacity=.42;
    const contain=(g,media,w,h,cover=false)=>{
      const scale=cover?Math.max(w/media.width,h/media.height):
        Math.min(w/media.width,h/media.height);
      const dw=media.width*scale,dh=media.height*scale;
      g.drawImage(media,(w-dw)/2,(h-dh)/2,dw,dh);
    };
    const renderSources=(w,h)=>{
      return [a,b].map(t=>{
        const c=make(w,h,()=>{}),g=c.getContext('2d');
        g.globalAlpha=t.opacity;
        contain(g,t.media,w,h,t.type==='background');
        return c;
      });
    };
    const rgb=(bytes,index)=>Array.from(bytes.slice(index,index+4));
    const expected=(p,w,h,{mode='source-over',withOverlay=false}={})=>{
      const sources=renderSources(w,h);
      const images=sources.map(c=>c.getContext('2d').getImageData(0,0,w,h).data);
      const mix=new Uint8ClampedArray(w*h*4);
      for(let i=0;i<mix.length;i++){
        mix[i]=Math.round(images[0][i]*(1-p)+images[1][i]*p);
      }
      const shader=make(w,h,()=>{});
      shader.getContext('2d').putImageData(new ImageData(mix,w,h),0,0);
      const composite=make(w,h,(g)=>{
        g.fillStyle='#000';g.fillRect(0,0,w,h);
        contain(g,bg,w,h,true);
        g.globalCompositeOperation=mode;
        g.drawImage(shader,0,0);
        g.globalCompositeOperation='source-over';
        if(withOverlay){g.globalAlpha=overlay.opacity;contain(g,hud,w,h);}
      });
      return composite.getContext('2d').getImageData(0,0,w,h).data;
    };
    const snapshot=(p)=>{
      engine.currentTime=1+p;engine.renderFrame();
      return new Uint8Array(output.getContext('2d').getImageData(0,0,output.width,output.height).data);
    };
    const compare=(actual,p,w,h,opts={})=>{
      const reference=expected(p,w,h,opts);
      let sum=0,count=0,max=0;
      // Avoid bilinear-sampler boundary pixels: sample interiors too.
      const probes=[[5,5],[20,47],[80,10],[80,32],[80,66],[80,84],
        [110,28],[110,75],[153,47],[45,48],[100,48]];
      const selected=[];
      for(const [x,y] of probes){
        if(x>=w||y>=h)continue;
        const i=(y*w+x)*4;
        let delta=0;
        for(let k=0;k<4;k++)delta=Math.max(delta,Math.abs(actual[i+k]-reference[i+k]));
        selected.push({point:[x,y],actual:rgb(actual,i),expected:rgb(reference,i),delta});
        max=Math.max(max,delta);sum+=delta;count++;
      }
      return {max,mean:sum/count,selected};
    };
    a.opacity=.6;b.opacity=.55;
    engine.tracks=[under,a,b];
    const fade={};
    for(const p of [.25,.5,.75]){
      fade[p]=compare(snapshot(p),p,W,H);
    }
    const stableA=snapshot(.5);
    snapshot(.1);
    const stableB=snapshot(.5);
    let reverseStable=stableA.length===stableB.length;
    for(let i=0;i<stableA.length;i++)if(stableA[i]!==stableB[i]){reverseStable=false;break;}
    // Both image inputs are asymmetric and have different aspect ratios.
    const letterbox=compare(snapshot(.5),.5,W,H);
    const gpuUsed=Boolean(engine.fadeWebGL);
    // Sticker must stay a normal Canvas layer above the shader.
    engine.tracks=[under,a,b,overlay];
    const sticker=compare(snapshot(.5),.5,W,H,{withOverlay:true});
    // Inherited non-default blend mode must apply only to the combined
    // shader output, not to the independently painted source frames.
    engine.tracks=[under,a,b];
    b.blendMode='multiply';
    const multiply=compare(snapshot(.5),.5,W,H,{mode:'multiply'});
    b.blendMode='source-over';
    // A background incoming track must cover/crop rather than contain.
    const bType=b.type;
    b.type='background';
    engine.tracks=[under,a,b];
    const cover=compare(snapshot(.5),.5,W,H);
    b.type=bType;
    // The engine's 41-effect catalog includes #38-41 in A/B source
    // suppression as well as in dispatch. Transparent B must never leave
    // an extra raw red A behind the returned shader RGBA.
    const clear=make(W,H,()=>{}),red=make(W,H,(g,w,h)=>{
      g.fillStyle='#f01436';g.fillRect(0,0,w,h);
    });
    a.media=red;a.opacity=1;b.media=clear;b.opacity=1;
    engine.tracks=[under,a,b];
    const isolated={};
    for(const effect of ['fade','pixelize','ripple']){
      b.transitionEffectId=effect;
      const pix=snapshot(.75);
      const i=(48*W+80)*4;
      isolated[effect]=rgb(pix,i);
    }
    const backgroundOnly=under.media.getContext('2d').getImageData(80,48,1,1).data;
    // All 41 GPU effects must be selected through the same source-of-truth
    // catalog, including the four recently ported effects.
    const catalog={count:ACTIVE_PAIR_EFFECTS.length,
      lastFour:['glitch-flicker','pixelize','random-squares','ripple']
        .every(id=>isAvailablePairEffect(id))};
    // A resize must resize the GPU textures and preserve its crop logic.
    a.media=portrait;b.media=landscape;a.opacity=.6;b.opacity=.55;b.transitionEffectId='fade';
    engine.tracks=[under,a,b];
    engine.outputWidth=192;engine.outputHeight=108;
    const resized=compare(snapshot(.5),.5,192,108);
    const dimensions={main:[output.width,output.height],gpu:[engine.fadeWebGL.canvas.width,
      engine.fadeWebGL.canvas.height]};
    // Exercise all 41 effects on one long-lived engine, not a fresh
    // context per effect. Returning to Fade must reproduce identical pixels.
    const beforeCache=snapshot(.5);
    const countGpu=()=>Object.keys(engine).filter(key=>key.endsWith('WebGL')&&engine[key]).length;
    const countScratch=()=>Object.keys(engine).filter(key=>/(From|To)Scratch$/.test(key)&&engine[key]).length;
    let maxContexts=0,maxSourceCanvases=0;
    for(const effect of ACTIVE_PAIR_EFFECTS){
      b.transitionEffectId=effect;
      snapshot(.5);
      maxContexts=Math.max(maxContexts,countGpu());
      maxSourceCanvases=Math.max(maxSourceCanvases,countScratch());
    }
    const fadeEvicted=engine.fadeWebGL===null&&engine.fadeFromScratch===null&&engine.fadeToScratch===null;
    b.transitionEffectId='fade';
    const afterCache=snapshot(.5);
    const cacheStable=beforeCache.length===afterCache.length&&beforeCache.every((v,i)=>v===afterCache[i]);
    const retained=engine.fadeWebGL;
    snapshot(.6);
    const cacheReused=engine.fadeWebGL===retained;
    engine.clearAll();
    const cache={maxContexts,maxSourceCanvases,fadeEvicted,cacheStable,cacheReused,cleared:countGpu()===0&&countScratch()===0};
    return {cache,fade,letterbox,sticker,multiply,cover,resized,dimensions,gpuUsed,
      reverseStable,isolated,backgroundOnly:Array.from(backgroundOnly),
      catalog,cleanup:engine.fadeWebGL===null&&engine.pairedBlendScratch===null
        &&engine.fadeFromScratch===null&&engine.fadeToScratch===null,
      problems};
  });
  for(const [p,measure] of Object.entries(result.fade)){
    assert.ok(measure.mean<=2&&measure.max<=4,
      'Fade source/crop/alpha/colour-space must match independent Canvas oracle at '+p+': '+JSON.stringify(measure));
  }
  for(const key of ['letterbox','sticker','multiply','cover','resized']){
    const value=result[key];
    assert.ok(value.mean<=2&&value.max<=4,
      'Shader Canvas integration mismatch in '+key+': '+JSON.stringify(value));
  }
  assert.equal(result.reverseStable,true);
  assert.deepEqual(result.dimensions,{main:[192,108],gpu:[192,108]});
  assert.equal(result.catalog.count,41);
  assert.equal(result.catalog.lastFour,true);
  assert.equal(result.gpuUsed,true);
  assert.equal(result.cleanup,true);
  assert.ok(result.cache.maxContexts<=4,JSON.stringify(result.cache));
  assert.ok(result.cache.maxSourceCanvases<=8,JSON.stringify(result.cache));
  for(const key of ['fadeEvicted','cacheStable','cacheReused','cleared'])assert.equal(result.cache[key],true,key);
  console.log('[MotoriClip #75 cache proof] '+JSON.stringify(result.cache));
  assert.deepEqual(result.problems,[]);
  assert.deepEqual(errors,[]);
  // Pixelize retains precisely a fraction of A when B is transparent, so
  // it must be substantially nearer to green than an extra opaque red A.
  assert.ok(result.isolated.pixelize[0]<115,
    'Hidden outgoing layer leaked under transparent Pixelize GPU output: '+JSON.stringify(result.isolated));
  assert.ok(result.isolated.ripple[0]<115,
    'Hidden outgoing layer leaked under transparent Ripple GPU output');
  console.log('[MotoriClip #42] PASS A/B WebGL source replacement, alpha, crop/contain, blending, nonshader sticker, orientation, resize, colour-space, deterministic seek, all 41 IDs and teardown');
  console.log('[MotoriClip #42 diagnostics] '+JSON.stringify({
    fade:result.fade,letterbox:result.letterbox,sticker:result.sticker,
    multiply:result.multiply,cover:result.cover,resized:result.resized,
    isolated:result.isolated,dimensions:result.dimensions
  }));
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
}