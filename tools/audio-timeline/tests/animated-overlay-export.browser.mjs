/**
 * Phase 3G: fixed-frame MP4 must contain the same animated effect pixels that
 * live preview displays at matching project timestamps. This test decodes the
 * actual exported video using ffmpeg: it does not inspect internal frame
 * objects or assume that the exported file is visually correct.
 *
 * CI: CHROME_BIN=/usr/bin/google-chrome node tools/audio-timeline/tests/animated-overlay-export.browser.mjs
 * Requires playwright-core, ffmpeg and ffprobe on PATH.
 */
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
const W=320,H=180,FPS=25,DURATION=2;
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
function decodeRgb(file,index){
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
try{
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1100,height:850}});
 const pageErrors=[];
 page.on('pageerror',err=>pageErrors.push(String(err)));
 await page.goto('http://127.0.0.1:'+port+'/tools/audio-timeline/tests/browser-harness.html');
 const presets=['light-sweep','glitch-flux','pixel-scan','fire-embers','fire-explosion','particle-dust','particle-debris','particle-sparks','hazy-atmosphere','sci-fi-scan','fire-flames','engine-heat','retro-glitch','light-leaks','god-rays','starburst','camera-frame','mist-fog-bank','tv-static','signal-interference','crt-scanlines','data-burst','signal-tear','rgb-block-glitch','line-corruption','fault-cassette','ripple-distortion','electric-ripple','shockwave','vibration-flash'];
 const selectedPreset=process.env.MOTORICLIP_EFFECT_PRESET;
 if(selectedPreset)assert.ok(presets.includes(selectedPreset),'Requested acceptance preset is not in the effect list');
 for(const preset of selectedPreset?[selectedPreset]:presets){
  const downloadPromise=page.waitForEvent('download',{timeout:180000});
  const preview=await page.evaluate(async({preset,W,H})=>{
   const [{AdvancedMediaEngine},{AdvancedOfflineExporter}]=await Promise.all([
     import('../js/advanced-media-engine-v0.24.js'),
     import('../js/advanced-offline-export.mjs')
   ]);
   const response=await fetch('./fixtures/effect-parity-pattern.mp4');
   if(!response.ok)throw Error('Patterned MP4 input unavailable');
   const input=new File([await response.blob()],'effect-parity-pattern.mp4',{type:'video/mp4'});
   const pngCanvas=document.createElement('canvas');pngCanvas.width=4;pngCanvas.height=4;
   const transparent=await new Promise(done=>pngCanvas.toBlob(done,'image/png'));
   const overlayFile=new File([transparent],'procedural-effect.png',{type:'image/png'});
   const video={id:'pattern',type:'video',sourceName:input.name,
     start:0,sourceOffset:0,sourceDuration:2,clipDuration:2,order:1,
     visible:true,opacity:1,blendMode:'source-over',speed:1,
     audio:{volume:1,gain:0,muted:false,fadeIn:0,fadeOut:0}};
   const overlay={id:'effect',type:'sticker',sourceName:overlayFile.name,
     start:0,sourceOffset:0,sourceDuration:2,clipDuration:2,order:1,
     visible:true,opacity:1,blendMode:'source-over',transparency:{mode:'native'},
     effectOverlay:{presetId:preset,intensity:90,distortion:79,scale:110,glow:65,blur:20,
       color:'#ffe09c',speed:1.1,density:56}};
   const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
   document.body.appendChild(canvas);
   const mediaBin=document.createElement('div');document.body.appendChild(mediaBin);
   const engine=new AdvancedMediaEngine({
      canvas,mediaBin,onTimeChange(){},onDurationChange(){},onPlaybackChange(){},
      onRenderError(error){throw error;}
   });
   await engine.loadTrack(video,input);
   await engine.loadTrack(overlay,overlayFile);
   // loadTrack resets clipDuration while reloading its backing media; apply
   // the user's timeline duration AFTER the media-ready handshake.
   video.clipDuration=2;
   overlay.clipDuration=2;
   engine.setTracks([video,overlay]);
   const copyRgb=()=>{
    const rgba=canvas.getContext('2d').getImageData(0,0,W,H).data;
    const bytes=new Uint8Array(W*H*3);
    for(let i=0;i<W*H;i++){
      bytes[i*3]=rgba[i*4];bytes[i*3+1]=rgba[i*4+1];bytes[i*3+2]=rgba[i*4+2];
    }
    const parts=[];
    for(let i=0;i<bytes.length;i+=16384)
      parts.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
    return btoa(parts.join(''));
   };
   const frames={};
   for(const time of [.4,1.4,.4]){
     const seekOK=await engine.seek(time,{resume:false});
     if(seekOK===false)throw Error('Could not seek video preview to '+time);
     engine.renderFrame();
     const key=time===.4&&frames['0.4']?'rewind':String(time);
     frames[key]=copyRgb();
   }
   let downloaded=false;
   const exporter=new AdvancedOfflineExporter({
     engine,onProgress(){},onState(){},
     onDownload({blob,extension}){
       if(extension!=='mp4')throw Error('Expected MP4 encoded output');
       downloaded=true;
       const link=document.createElement('a'),url=URL.createObjectURL(blob);
       link.href=url;link.download='effect-parity-'+preset+'.mp4';
       document.body.appendChild(link);link.click();link.remove();
       setTimeout(()=>URL.revokeObjectURL(url),20000);
     }
   });
   await exporter.start({format:'mp4',fps:25,bitrateKbps:5000});
   return {frames,downloaded,trackCount:engine.tracks.length,
    restoredTime:engine.currentTime,timelineDuration:engine.getTimelineDuration(),
    clipLengths:engine.tracks.map(track=>({id:track.id,start:track.start,duration:track.clipDuration}))};
  },{preset,W,H});
  assert.equal(preview.downloaded,true,preset+' did not emit an encoded MP4 download');
  assert.equal(preview.trackCount,2);
  const original=Buffer.from(preview.frames['0.4'],'base64');
  const different=Buffer.from(preview.frames['1.4'],'base64');
  const rewind=Buffer.from(preview.frames.rewind,'base64');
  assert.deepEqual(original,rewind,preset+': reverse seeking must restore exact preview pixels');
  const previewMotion=meanAbs(original,different);
  // A transparent recording HUD deliberately updates only tiny text/REC pixels.
  // Compare actual decoded MP4 frames as strictly as for full-frame overlays,
  // but use a sparse-geometry motion floor instead of the global 0.25 mean.
  const motionFloor=preset==='camera-frame'?0.05:0.25;
  assert.ok(previewMotion>motionFloor,preset+': preview effect pixels did not animate ('+previewMotion+')');
  const download=await downloadPromise;
  const output=join(temp,'effect-'+preset+'.mp4');
  await download.saveAs(output);
  const info=JSON.parse(run('ffprobe',['-v','error','-show_entries',
    'stream=codec_type,width,height','-show_entries','format=duration',
    '-of','json',output]).toString());
  const stream=info.streams.find(x=>x.codec_type==='video');
  assert.equal(Number(stream?.width),W);
  assert.equal(Number(stream?.height),H);
  console.log('[MotoriClip parity duration]',preset,JSON.stringify({encoded:info.format.duration,expected:DURATION,previewTimeline:preview.timelineDuration,clips:preview.clipLengths}));
  assert.ok(Math.abs(Number(info.format.duration)-DURATION)<.16,preset+' encoded duration '+info.format.duration+' differs from '+DURATION+'s timeline');
  for(const [time,index] of [[.4,10],[1.4,35]]){
   const expected=Buffer.from(preview.frames[String(time)],'base64');
   const actual=decodeRgb(output,index);
   const error=meanAbs(expected,actual);
   assert.ok(error<31,preset+' encoded frame '+index+
    ' differs excessively from preview at '+time+'s: RGB mean absolute error='+error.toFixed(3));
   console.log('[MotoriClip overlay parity]',preset,time+'s','RGB mean absolute error',error.toFixed(3));
  }
  assert.equal(pageErrors.length,0,preset+' browser errors: '+pageErrors.join('; '));
  console.log('[MotoriClip overlay parity] PASS',preset,'preview motion',previewMotion.toFixed(3),
   'encoded MP4 frames 10 and 35 match decoded preview within codec tolerance');
 }
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
 await rm(temp,{recursive:true,force:true});
}
