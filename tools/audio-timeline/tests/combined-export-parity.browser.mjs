/** #78: actual multi-layer MP4/WebM decoded pixel parity, landscape and portrait. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,extname} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),fixtures=join(root,'tools/audio-timeline/tests/fixtures');
mkdirSync(fixtures,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'motoriclip-effect-pixels-'));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.mp4':'video/mp4','.png':'image/png'};
const FPS=25,DURATION=2;
function run(bin,args,opts={}){
 const result=spawnSync(bin,args,{timeout:120000,maxBuffer:32*1024*1024,...opts});
 if(result.error||result.signal||result.status!==0)
  throw Error(bin+' failed: '+String(result.stderr||result.error||result.signal).slice(-1600));
 return result.stdout;
}
const fixture=join(fixtures,'effect-parity-pattern.mp4');
run('ffmpeg',['-hide_banner','-loglevel','error','-y',
 '-f','lavfi','-i','color=c=black:s=320x180:r=25:d=2',
 '-f','lavfi','-i','sine=f=440:sample_rate=48000:d=2',
 '-vf','drawbox=x=0:y=0:w=160:h=180:color=red:t=fill,drawbox=x=160:y=0:w=160:h=180:color=blue:t=fill,drawbox=x=60:y=45:w=200:h=90:color=white:t=fill',
 '-threads','1','-filter_threads','1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',
 '-c:a','aac','-b:a','96k','-shortest',fixture]);

const server=createServer((req,res)=>{
 try{
  const file=resolve(root,'.'+decodeURIComponent((req.url||'/').split('?')[0]));
  if(!file.startsWith(root+'/')&&!file.startsWith(root+'\\')){res.writeHead(403);res.end();return;}
  const bytes=readFileSync(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream',
   'Cache-Control':'no-store'});
  res.end(bytes);
 }catch(error){res.writeHead(404);res.end(String(error.message||error));}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const port=server.address().port;
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
assert.ok(existsSync(chrome),'Chrome must be installed for real pixel comparison');
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});
function decodeRgb(file,index,W,H){
 const raw=run('ffmpeg',['-hide_banner','-loglevel','error','-i',file,
  '-vf','select=eq(n\\,'+index+'),format=rgb24',
  '-fps_mode','vfr','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);
 assert.equal(raw.length,W*H*3,'Extracted raw frame '+index+' has incorrect dimensions');
 return raw;
}
function meanAbs(a,b){
 assert.equal(a.length,b.length);
 let sum=0;
 for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);
 return sum/a.length;
}
try {
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1100,height:850}});
 const pageErrors=[];
 page.on('pageerror',err=>pageErrors.push(String(err)));
 await page.goto('http://127.0.0.1:'+port+'/tools/audio-timeline/tests/browser-harness.html');
 // Identical stack in both aspect ratios and codecs; all output is decoded externally.
 for(const [W,H] of [[320,180],[180,320]]) for(const format of ['mp4','webm']){
  const downloadPromise=page.waitForEvent('download',{timeout:180000});
  const preview=await page.evaluate(async({W,H,format})=>{
   const [{AdvancedMediaEngine},{AdvancedOfflineExporter}]=await Promise.all([
     import('../js/advanced-media-engine-v0.24.js'),
     import('../js/advanced-offline-export.mjs')
   ]);
   const response=await fetch('./fixtures/effect-parity-pattern.mp4');
   if(!response.ok)throw Error('Patterned MP4 input unavailable');
   const input=new File([await response.blob()],'effect-parity-pattern.mp4',{type:'video/mp4'});
   const pngCanvas=document.createElement('canvas');pngCanvas.width=320;pngCanvas.height=180;
   const pngCtx=pngCanvas.getContext('2d');
   pngCtx.fillStyle='rgba(30,240,90,0.65)';pngCtx.fillRect(105,25,90,125);
   pngCtx.fillStyle='rgba(255,210,30,0.9)';pngCtx.fillRect(145,65,70,45);
   const imageBlob=await new Promise(done=>pngCanvas.toBlob(done,'image/png'));
   const imageFile=new File([imageBlob],'alpha-layer.png',{type:'image/png'});
   pngCtx.clearRect(0,0,320,180);
   const emptyBlob=await new Promise(done=>pngCanvas.toBlob(done,'image/png'));
   const overlayFile=new File([emptyBlob],'procedural-effect.png',{type:'image/png'});
   const base={start:0,sourceOffset:0,sourceDuration:2,clipDuration:2,visible:true,opacity:1,blendMode:'source-over'};
   const video={...base,id:'pattern',type:'video',sourceName:input.name,order:1,speed:1,
     audio:{volume:1,gain:0,muted:false,fadeIn:0,fadeOut:0}};
   const alpha={...base,id:'alpha',type:'sticker',sourceName:imageFile.name,order:1,opacity:.83,
     transparency:{mode:'native'}};
   const effect=(presetId,order)=>({...base,id:presetId,type:'sticker',sourceName:overlayFile.name,order,
     transparency:{mode:'native'},effectOverlay:{presetId,intensity:65,distortion:55,scale:110,glow:45,blur:15,
       color:'#ffe09c',speed:1.1,density:56,seed:129}});
   const first=effect('light-sweep',2),second=effect('rgb-block-glitch',3);
   const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
   document.body.appendChild(canvas);
   const mediaBin=document.createElement('div');document.body.appendChild(mediaBin);
   const engine=new AdvancedMediaEngine({canvas,mediaBin,onTimeChange(){},onDurationChange(){},
     onPlaybackChange(){},onRenderError(error){throw error;}});
   const tracks=[video,alpha,first,second];
   try{
    for(const [track,file] of [[video,input],[alpha,imageFile],[first,overlayFile],[second,overlayFile]]){
      await engine.loadTrack(track,file);track.clipDuration=2;
    }
    engine.setTracks(tracks);
    const copyRgb=()=>{
      const rgba=canvas.getContext('2d').getImageData(0,0,W,H).data;
      const bytes=new Uint8Array(W*H*3);
      for(let i=0;i<W*H;i++){bytes[i*3]=rgba[i*4];bytes[i*3+1]=rgba[i*4+1];bytes[i*3+2]=rgba[i*4+2];}
      const parts=[];for(let i=0;i<bytes.length;i+=16384)parts.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
      return btoa(parts.join(''));
    };
    const seek=async time=>{
      if(await engine.seek(time,{resume:false})===false)throw Error('Seek failed at '+time);
      engine.renderFrame();return copyRgb();
    };
    const frames={};
    for(const time of [.4,.92,1.4])frames[String(time)]=await seek(time);
    frames.rewind=await seek(.4);
    // Prove the alpha image and BOTH effects contribute to the tested composite,
    // rather than accidentally comparing a video-only or single-layer export.
    const contributions={};
    for(const track of [alpha,first,second]){
      track.visible=false;engine.setTracks([...tracks]);contributions[track.id]=await seek(.4);
      track.visible=true;engine.setTracks([...tracks]);
    }
    frames.restored=await seek(.4);
    let downloaded=false;
    const exporter=new AdvancedOfflineExporter({engine,onProgress(){},onState(){},
      onDownload({blob,extension}){
        if(extension!==format)throw Error('Expected '+format+' output, received '+extension);
        downloaded=true;
        const link=document.createElement('a'),url=URL.createObjectURL(blob);
        link.href=url;link.download='combined-'+W+'x'+H+'.'+format;
        document.body.appendChild(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),20000);
      }});
    const ok=await exporter.start({format,fps:25,bitrateKbps:5000});
    return {frames,contributions,downloaded,ok,trackCount:engine.tracks.length,
      timelineDuration:engine.getTimelineDuration(),restoredTime:engine.currentTime,busy:exporter.busy};
   }finally{canvas.remove();mediaBin.remove();}
  },{W,H,format});
  const label=W+'x'+H+' '+format;
  assert.equal(preview.ok,true,label+' export failed');
  assert.equal(preview.downloaded,true,label+' did not emit an encoded file');
  assert.equal(preview.busy,false);assert.equal(preview.trackCount,4);
  assert.ok(Math.abs(preview.timelineDuration-DURATION)<.001);
  const original=Buffer.from(preview.frames['0.4'],'base64');
  assert.deepEqual(original,Buffer.from(preview.frames.rewind,'base64'),label+' reverse seeking');
  assert.deepEqual(original,Buffer.from(preview.frames.restored,'base64'),label+' restoring all layers');
  for(const [id,frame] of Object.entries(preview.contributions)){
    const difference=meanAbs(original,Buffer.from(frame,'base64'));
    assert.ok(difference>.05,label+' layer '+id+' has no visible contribution: '+difference);
    console.log('[combined parity contribution]',label,id,difference.toFixed(3));
  }
  const motion=Math.max(...['0.92','1.4'].map(t=>meanAbs(original,Buffer.from(preview.frames[t],'base64'))));
  assert.ok(motion>.25,label+' stack did not animate');
  const download=await downloadPromise;
  const output=join(temp,'combined-'+W+'x'+H+'.'+format);
  await download.saveAs(output);
  const info=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_entries',
    'stream=codec_type,codec_name,width,height,nb_read_frames','-show_entries','format=duration','-of','json',output]).toString());
  const stream=info.streams.find(x=>x.codec_type==='video');
  assert.equal(Number(stream?.width),W);assert.equal(Number(stream?.height),H);
  assert.equal(Number(stream?.nb_read_frames),FPS*DURATION);
  assert.equal(stream.codec_name,format==='mp4'?'h264':'vp9');
  assert.ok(info.streams.some(x=>x.codec_type==='audio'),label+' missing audio');
  assert.ok(Math.abs(Number(info.format.duration)-DURATION)<.16,label+' duration mismatch');
  for(const [time,index] of [[.4,10],[.92,23],[1.4,35]]){
    const error=meanAbs(Buffer.from(preview.frames[String(time)],'base64'),decodeRgb(output,index,W,H));
    assert.ok(error<31,label+' frame '+index+' RGB MAE '+error);
    console.log('[combined parity]',label,'frame',index,'RGB MAE',error.toFixed(3));
  }
  assert.deepEqual(pageErrors,[],label+' browser errors');
  console.log('[combined parity] PASS',label);
 }
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
 await rm(temp,{recursive:true,force:true});
}
