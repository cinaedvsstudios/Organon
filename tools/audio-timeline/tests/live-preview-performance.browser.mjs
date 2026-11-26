/** #79: measure actual requestAnimationFrame-driven preview playback, not offline encoder throughput. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,extname} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),temp=await mkdtemp(join(tmpdir(),'motoriclip-preview-'));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.mp4':'video/mp4'};
const server=createServer((req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 const file=url.pathname.startsWith('/fixture/')?join(temp,url.pathname.split('/').at(-1)):resolve(root,'.'+url.pathname);
 if(!file.startsWith(root+'/')&&!file.startsWith(temp+'/'))throw Error('Invalid path');
 const bytes=readFileSync(file);
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch(e){res.writeHead(404);res.end(String(e));}});
let browser;
try{
 for(const [name,hue,tone] of [['a.mp4',0,440],['b.mp4',95,660]]){
  const f=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=640x360:rate=30:duration=10','-f','lavfi','-i','sine=frequency='+tone+':sample_rate=48000:duration=10','-vf','hue=h='+hue,'-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-threads','1','-c:a','aac','-t','10',join(temp,name)],{encoding:'utf8',timeout:60000});
  assert.equal(f.status,0,String(f.stderr||f.error));
 }
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';assert.ok(existsSync(chrome));
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
 for(const cfg of [{name:'720p',width:1280,height:720},{name:'1080p',width:1920,height:1080},{name:'4K',width:3840,height:2160}]){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
   const result=await page.evaluate(async cfg=>{
    const [{AdvancedMediaEngine},{planPairedTransition},{normaliseTimelineEffect}]=await Promise.all([import('../js/advanced-media-engine-v0.24.js'),import('../js/clip-pair-transitions.mjs'),import('../js/timeline-effects.mjs')]);
    const canvas=document.createElement('canvas');canvas.width=cfg.width;canvas.height=cfg.height;
    canvas.style.cssText='width:960px;height:540px;display:block';document.body.append(canvas);
    const bin=document.createElement('div');bin.style.display='none';document.body.append(bin);
    const renderErrors=[];
    const engine=new AdvancedMediaEngine({canvas,mediaBin:bin,onRenderError:e=>renderErrors.push(String(e))});
    const file=async name=>{const res=await fetch('/fixture/'+name);if(!res.ok)throw Error('Missing '+name);return new File([await res.blob()],name,{type:'video/mp4'});};
    const tracks=[];
    const track=(id,type,order,extras={})=>({id,type,order,laneId:id,visible:true,opacity:1,start:0,sourceOffset:0,clipDuration:8,blendMode:'source-over',audio:{volume:.15,muted:false,fadeIn:0,fadeOut:0},...extras});
    try{
     const a=track('a','video',2,{clipDuration:7}),b=track('b','video',1,{start:1,clipDuration:8});
     await engine.loadTrack(a,await file('a.mp4'));await engine.loadTrack(b,await file('b.mp4'));
     const plan=planPairedTransition([a,b],['a','b'],6,'ripple');
     Object.assign(a,{visualTransitions:plan.outgoingTransitions});
     Object.assign(b,{start:plan.start,order:plan.incomingOrder,transitionFromId:a.id,transitionEffectId:plan.effectId,visualTransitions:plan.incomingTransitions});
     tracks.push(a,b);
     const layer=document.createElement('canvas');layer.width=640;layer.height=360;
     const ctx=layer.getContext('2d');ctx.fillStyle='rgba(255,0,120,.5)';ctx.fillRect(25,25,150,90);
     const png=new File([await new Promise(done=>layer.toBlob(done,'image/png'))],'alpha.png',{type:'image/png'});
     const alpha=track('alpha','sticker',3,{transparency:{mode:'native'}});
     await engine.loadTrack(alpha,png);tracks.push(alpha);
     layer.getContext('2d').clearRect(0,0,640,360);
     const blank=new File([await new Promise(done=>layer.toBlob(done,'image/png'))],'procedural.png',{type:'image/png'});
     for(const [i,presetId] of ['starburst','camera-frame'].entries()){
      const t=track(presetId,'sticker',i,{opacity:.8,effectOverlay:normaliseTimelineEffect({presetId,speed:1,color:'#ffe09c',glow:45,density:50})});
      await engine.loadTrack(t,blank);tracks.push(t);
     }
     engine.setTracks(tracks);engine.setProjectFrameRate(30);
     await engine.seek(2,{resume:false});
     const sample=document.createElement('canvas');sample.width=96;sample.height=54;const sc=sample.getContext('2d',{willReadFrequently:true});
     const capture=()=>{sc.drawImage(canvas,0,0,96,54);return new Uint8Array(sc.getImageData(0,0,96,54).data)};
     const difference=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=Math.abs(a[i]-b[i]);return s/a.length};
     const composed=capture(),contributions={};
     for(const t of tracks.filter(t=>t.type==='sticker')){
      t.visible=false;engine.renderFrame();contributions[t.id]=difference(composed,capture());t.visible=true;engine.renderFrame();
     }
     const playback=[];
     // Keep the project resolution fixed if the new preview-quality API is present.
     const modes=typeof engine.setPreviewQuality==='function'?['normal','fast','low']:['native'];
     for(const mode of modes){
      if(mode!=='native')engine.setPreviewQuality(mode);
      await engine.seek(1.25,{resume:false});
      const startPixels=capture(),frames=[],times=[];
      const render=engine.renderFrame.bind(engine);
      let last=0;
      engine.renderFrame=()=>{const start=performance.now();render();if(engine.isPlaying){
       const end=performance.now();frames.push(end-start);if(last)times.push(end-last);last=end;
      }};
      await engine.play();const start=performance.now(),timelineStart=engine.currentTime;
      await new Promise(done=>setTimeout(done,4000));
      const elapsed=performance.now()-start;engine.pause();
      const timelineEnd=engine.currentTime;engine.renderFrame=render;
      const endPixels=capture();
      const sorted=[...times].sort((a,b)=>a-b);
      const quantile=(q)=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(q*sorted.length))]:null;
      playback.push({mode,canvas:[canvas.width,canvas.height],wallSeconds:elapsed/1000,timelineSeconds:timelineEnd-timelineStart,renderCalls:frames.length,renderFps:frames.length*1000/elapsed,p50IntervalMs:quantile(.5),p95IntervalMs:quantile(.95),maxIntervalMs:sorted.at(-1)??null,meanRenderMs:frames.reduce((x,y)=>x+y,0)/Math.max(1,frames.length),pixelChange:difference(startPixels,endPixels),decodedFrames:[a,b].map(t=>t.media.getVideoPlaybackQuality?.().totalVideoFrames??null),droppedFrames:[a,b].map(t=>t.media.getVideoPlaybackQuality?.().droppedVideoFrames??null)});
     }
     const gpuCanvas=document.createElement('canvas'),gl=gpuCanvas.getContext('webgl'),debug=gl?.getExtension('WEBGL_debug_renderer_info');
     const gpu=gl?{renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)}:null;
     gl?.getExtension('WEBGL_lose_context')?.loseContext();
     return {cfg,contributions,playback,gpu,renderErrors};
    }finally{engine.clearAll();if(engine.audioContext?.state!=='closed')await engine.audioContext?.close();canvas.remove();bin.remove();}
   },cfg);
   assert.deepEqual(errors,[]);assert.deepEqual(result.renderErrors,[]);
   for(const [id,value] of Object.entries(result.contributions))assert.ok(value>.005,id+' must visibly contribute to stacked composition: '+value);
   for(const m of result.playback){
    assert.ok(m.renderCalls>=2,m.mode+' playback did not render repeatedly');
    assert.ok(m.timelineSeconds>1,m.mode+' playback clock did not advance');
    assert.ok(m.pixelChange>.01,m.mode+' actual pixels did not change');
    assert.ok(m.decodedFrames.every(n=>n===null||n>0),'Real video decoder did not produce frames');
    assert.ok(Number.isFinite(m.renderFps)&&m.renderFps>0);
   }
   console.log('[MotoriClip #79 live-preview] PASS '+JSON.stringify(result));
  }finally{await page.close();}
 }
}finally{if(browser)await browser.close();if(server.listening)await new Promise(done=>server.close(done));await rm(temp,{recursive:true,force:true});}
