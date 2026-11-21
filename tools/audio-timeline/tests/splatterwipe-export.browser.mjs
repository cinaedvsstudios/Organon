/**
 * SplatterWipe #17: real encoded MP4 must match preview at exact frames.
 * Uses two genuinely decoded MP4 sources, original GL shader and the actual
 * AdvancedOfflineExporter. No fake/offline frame data or mocked encoder.
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
const temp=await mkdtemp(join(tmpdir(),'motoriclip-splatterWipe-mp4-'));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.mp4':'video/mp4'};
const W=96,H=64,FPS=25,DURATION=2;
function run(bin,args){
 const p=spawnSync(bin,args,{timeout:120000,maxBuffer:16*1024*1024});
 if(p.error||p.signal||p.status!==0)throw Error(bin+' failed: '+String(p.stderr||p.error||p.signal).slice(-1200));
 return p.stdout;
}
for(const color of ['blue','red']){
 run('ffmpeg',['-hide_banner','-loglevel','error','-y',
  '-f','lavfi','-i',`color=c=${color}:s=${W}x${H}:r=${FPS}:d=2`,
  '-f','lavfi','-i','sine=frequency=550:sample_rate=48000:duration=2',
  '-threads','1','-filter_threads','1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',
  '-c:a','aac','-b:a','64k','-shortest',join(fixtures,'splatterWipe-'+color+'.mp4')]);
}
const server=createServer((req,res)=>{
 try{
  const file=resolve(root,'.'+decodeURIComponent((req.url||'/').split('?')[0]));
  if(!file.startsWith(root+'/')){res.writeHead(403);res.end();return}
  const bytes=readFileSync(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(bytes);
 }catch(e){res.writeHead(404);res.end(String(e.message||e));}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
assert.ok(existsSync(chrome));
const browser=await chromium.launch({headless:true,executablePath:chrome,
 args:['--no-sandbox','--enable-unsafe-swiftshader']});
const decode=(file,index)=>run('ffmpeg',['-hide_banner','-loglevel','error','-i',file,
 '-vf','select=eq(n\\,'+index+'),format=rgb24','-fps_mode','vfr','-frames:v','1',
 '-f','rawvideo','-pix_fmt','rgb24','pipe:1']);
function meanAbs(a,b){
 assert.equal(a.length,b.length);let sum=0;
 for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);
 return sum/a.length;
}
try{
 const page=await browser.newPage({acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const downloadPromise=page.waitForEvent('download',{timeout:180000});
 const preview=await page.evaluate(async({W,H})=>{
  const [{AdvancedMediaEngine},{AdvancedOfflineExporter}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),
   import('../js/advanced-offline-export.mjs')
  ]);
  const files=[];
  for(const color of ['blue','red']){
   const response=await fetch('./fixtures/splatterWipe-'+color+'.mp4');
   if(!response.ok)throw Error('Missing source '+color);
   files.push(new File([await response.blob()],color+'.mp4',{type:'video/mp4'}));
  }
  const output=document.createElement('canvas');output.width=W;output.height=H;
  document.body.appendChild(output);
  const engine=new AdvancedMediaEngine({canvas:output,mediaBin:document.createElement('div'),
    onTimeChange(){},onDurationChange(){},onPlaybackChange(){},onRenderError(e){throw e;}});
  const a={id:'a',type:'video',sourceName:'blue.mp4',start:0,sourceOffset:0,clipDuration:1.5,
    order:2,visible:true,opacity:1,blendMode:'source-over',audio:{volume:1,gain:0,muted:false,fadeIn:0,fadeOut:0}};
  const b={id:'b',type:'video',sourceName:'red.mp4',start:.5,sourceOffset:0,clipDuration:1.5,
    order:1,visible:true,opacity:1,blendMode:'source-over',transitionFromId:'a',
    transitionEffectId:'splatter-wipe',
    transitionParameters:{'splatter-wipe':{splats:4,spikiness:.6,droplets:.6,drips:.5,rim:.5,seed:3}},
    visualTransitions:{enter:{type:'fade',duration:1,curve:'linear'},exit:{type:'fade',duration:0,curve:'linear'}},
    audio:{volume:1,gain:0,muted:false,fadeIn:0,fadeOut:0}};
  await engine.loadTrack(a,files[0]);
  await engine.loadTrack(b,files[1]);
  a.start=0;a.clipDuration=1.5;a.order=2;
  b.start=.5;b.clipDuration=1.5;b.order=1;
  engine.setTracks([a,b]);engine.setCanvasResolution(W,H);
  const splatterWipe=()=>{
   const raw=output.getContext('2d').getImageData(0,0,W,H).data;
   const bytes=new Uint8Array(W*H*3);
   for(let i=0;i<W*H;i++){
    bytes[i*3]=raw[i*4];bytes[i*3+1]=raw[i*4+1];bytes[i*3+2]=raw[i*4+2];
   }
   const parts=[];for(let i=0;i<bytes.length;i+=16384)
    parts.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
   return btoa(parts.join(''));
  };
  const frames={},screenshots={};
  for(const time of [.8,1.2,.8]){
   await engine.seek(time,{resume:false});engine.renderFrame();
   const key=time===.8&&frames['0.8']?'rewind':String(time);
   frames[key]=splatterWipe();
   if(key==='0.8')screenshots[key]=output.toDataURL('image/png');
  }
  const usingShader=Boolean(engine.splatterWipeWebGL);
  let downloaded=false;
  const exporter=new AdvancedOfflineExporter({engine,onProgress(){},onState(){},
   onDownload({blob,extension}){
    if(extension!=='mp4')throw Error('MP4 export required');
    downloaded=true;
    const href=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=href;link.download='splatterWipe-parity.mp4';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(href),15000);
   }});
  await exporter.start({format:'mp4',fps:25,bitrateKbps:3500});
  return {frames,screenshots,usingShader,downloaded,duration:engine.getTimelineDuration()};
 },{W,H});
 assert.equal(preview.usingShader,true,'Real GL path must execute');
 assert.equal(preview.downloaded,true,'MP4 must download');
 assert.ok(Math.abs(preview.duration-DURATION)<.02);
 assert.deepEqual(Buffer.from(preview.frames['0.8'],'base64'),Buffer.from(preview.frames.rewind,'base64'),
  'Reverse seeking must restore identical GL pixels');
 const download=await downloadPromise,encoded=join(temp,'splatterWipe-parity.mp4');
 await download.saveAs(encoded);
 const info=JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration',
  '-show_entries','stream=codec_type,width,height','-of','json',encoded]).toString());
 assert.ok(Math.abs(Number(info.format.duration)-DURATION)<.16,'Wrong output duration');
 const stream=info.streams.find(x=>x.codec_type==='video');
 assert.equal(Number(stream.width),W);assert.equal(Number(stream.height),H);
 for(const [time,index] of [[.8,20],[1.2,30]]){
  const expected=Buffer.from(preview.frames[String(time)],'base64');
  const actual=decode(encoded,index);
  assert.equal(actual.length,W*H*3);
  const error=meanAbs(expected,actual);
  assert.ok(error<31,'MP4 pixel mismatch at '+time+'s; RGB error '+error.toFixed(3));
  console.log('[SplatterWipe MP4]',time+'s, mean RGB error',error.toFixed(3));
 }
 assert.deepEqual(errors,[]);
 console.log('[SplatterWipe #17] PASS decoded H.264 frames match live original-GLSL output, seek stability and duration');
 // Retain compact visual evidence in CI logs, taken from the real preview canvas.
 console.log('[SplatterWipe #01 visual PNG]',preview.screenshots['0.8']);
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
 await rm(temp,{recursive:true,force:true});
}
