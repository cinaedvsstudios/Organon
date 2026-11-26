/** Independent still-overlay qualification: Vignette. Actual PNG, native clip controls, regeneration and decoded MP4. */
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
 const presets=['vignette','cinema-bars','sunset-leak','blue-leak','film-grain','scanlines','edge-neon','rainbow-halo','particle-stars','letterbox-gold','cyan-gradient','ruby-gradient'];
 const selectedPreset=process.env.MOTORICLIP_STILL_PRESET||'vignette';
 assert.ok(presets.includes(selectedPreset),'Unknown independently qualified still preset');
 for(const preset of [selectedPreset]){
  const downloadPromise=page.waitForEvent('download',{timeout:180000});
  const preview=await page.evaluate(async({preset,W,H})=>{
   const [{AdvancedMediaEngine},{AdvancedOfflineExporter},{EFFECT_OVERLAYS,renderOverlayPreset,createOverlayFile}]=await Promise.all([
     import('../js/advanced-media-engine-v0.24.js'),
     import('../js/advanced-offline-export.mjs'),import('../js/overlay-preset-library.mjs')
   ]);
   const response=await fetch('./fixtures/effect-parity-pattern.mp4');
   if(!response.ok)throw Error('Patterned MP4 input unavailable');
   const input=new File([await response.blob()],'effect-parity-pattern.mp4',{type:'video/mp4'});
   const recipe=EFFECT_OVERLAYS.find(p=>p.id===preset);
   if(!recipe||recipe.animated||!recipe.label.includes('(still)'))throw Error('Expected an explicitly labelled still overlay');
   const metrics=[];
   for(const [width,height] of [[320,180],[640,360],[180,320]]){
    const art=document.createElement('canvas');art.width=width;art.height=height;renderOverlayPreset(art,recipe);
    const data=art.getContext('2d').getImageData(0,0,width,height).data;
    const alpha=(x,y)=>data[(Math.floor(y*height)*width+Math.floor(x*width))*4+3];
    const pixel=(x,y)=>Array.from(data.subarray((Math.floor(y*height)*width+Math.floor(x*width))*4,(Math.floor(y*height)*width+Math.floor(x*width))*4+4));
    let topRows=0,bottomRows=0;
    const centerAlpha=y=>data[(y*width+Math.floor(width/2))*4+3];
    while(topRows<height&&centerAlpha(topRows)===255)topRows++;
    while(bottomRows<height&&centerAlpha(height-1-bottomRows)===255)bottomRows++;
    let transparent=0,significant=0,bright=0,darkGrains=0,lightGrains=0,maxAlpha=0,alphaSum=0,colourful=0;
    const dominant=new Set(),rowAlphas=[];let rowUniform=true;
    for(let y=0;y<height;y++){
     const rowAlpha=centerAlpha(y);rowAlphas.push(rowAlpha);
     for(let x=0;x<width;x++){
      const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
      alphaSum+=a;maxAlpha=Math.max(maxAlpha,a);
      if(a===0)transparent++;if(a>15)significant++;if(a>150)bright++;
      if(a>0&&r===0&&g===0&&b===0)darkGrains++;
      if(a>0&&r===255&&g===255&&b===255)lightGrains++;
      if(a>30&&Math.max(r,g,b)-Math.min(r,g,b)>45){colourful++;dominant.add(r>=g&&r>=b?'red':g>=b?'green':'blue');}
      if(a!==rowAlpha)rowUniform=false;
     }
    }
    const transitions=rowAlphas.slice(1).filter((v,i)=>Math.abs(v-rowAlphas[i])>15).length;
    const n=width*height,neonY=Math.min(width,height)*.055/height,trimY=Math.max(0,(topRows-.5)/height);
    metrics.push({width,height,transparent:transparent/n,significant:significant/n,bright,darkGrains:darkGrains/n,lightGrains:lightGrains/n,maxAlpha,meanAlpha:alphaSum/n,colourful,dominant:[...dominant],rowUniform,rowRange:Math.max(...rowAlphas)-Math.min(...rowAlphas),transitions,
      neonEdge:pixel(.5,neonY),trim:pixel(.34,trimY),trimMirror:pixel(.34,1-trimY),gradientCyan:pixel(.02,.98),gradientRuby:pixel(.98,.02),centre:alpha(.5,.5),inner:alpha(.65,.5),mid:alpha(.85,.5),edge:alpha(.98,.5),corner:alpha(.98,.98),
      opposite:alpha(.02,.02),vertical:alpha(.5,.98),topRows,bottomRows,topPixel:pixel(.5,.02),
      warmEntry:pixel(.02,.08),coolEntry:pixel(.98,.90),warmFar:pixel(.98,.90),coolFar:pixel(.02,.08)});
   }
   const overlayFile=createOverlayFile(recipe),regenerated=createOverlayFile(recipe);
   const first=new Uint8Array(await overlayFile.arrayBuffer()),second=new Uint8Array(await regenerated.arrayBuffer());
   const exactFile=first.length===second.length&&first.every((v,i)=>v===second[i]);
   const video={id:'pattern',type:'video',sourceName:input.name,
     start:0,sourceOffset:0,sourceDuration:2,clipDuration:2,order:1,
     visible:true,opacity:1,blendMode:'source-over',speed:1,
     audio:{volume:1,gain:0,muted:false,fadeIn:0,fadeOut:0}};
   const overlay={id:'effect',type:'sticker',sourceName:overlayFile.name,
     start:0,sourceOffset:0,sourceDuration:2,clipDuration:2,order:1,
     visible:true,opacity:1,blendMode:'source-over',transparency:{mode:'native'}};
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
   await engine.seek(.4,{resume:false});overlay.visible=false;engine.renderFrame();const baseline=copyRgb();
   overlay.visible=true;overlay.opacity=.45;engine.renderFrame();const reduced=copyRgb();
   overlay.opacity=1;engine.renderFrame();const png=canvas.toDataURL('image/png');
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
   return {frames,baseline,reduced,png,metrics,exactFile,downloaded,trackCount:engine.tracks.length,
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
  assert.ok(previewMotion<1,preset+': a deliberately still overlay must stay static over constant source footage');
  assert.ok(preview.exactFile,'Recipe regeneration must reproduce exactly the same PNG bytes');
  for(const m of preview.metrics){
   if(preset==='vignette'){
    assert.equal(m.centre,0);assert.ok(m.inner<m.mid&&m.mid<m.edge&&m.edge<m.corner,'Optical falloff must increase smoothly outward');
    assert.ok(Math.abs(m.corner-m.opposite)<5&&Math.abs(m.edge-m.vertical)<4,'Normalized vignette must remain symmetric at every aspect ratio');
    assert.ok(m.corner>175&&m.corner<230,'Corners must be dark but not opaque');
   }else if(preset==='cinema-bars'||preset==='letterbox-gold'){
    const expected=Math.max(0,Math.round((m.height-m.width/2.39)/2));
    assert.equal(m.topRows,expected);assert.equal(m.bottomRows,expected);
    assert.equal(m.centre,0);
    if(preset==='cinema-bars')assert.deepEqual(m.topPixel,[0,0,0,255]);
    else{assert.ok(m.trim[0]>190&&m.trim[0]>m.trim[2]+55&&m.trim[0]>m.topPixel[0]+100,'Gold trim must be brighter than satin matte');assert.deepEqual(m.trim,m.trimMirror,'Gold aperture trim must mirror');}
    assert.ok(Math.abs(m.width/(m.height-2*expected)-2.39)<.08,'Scope aperture should match 2.39:1 to nearest pixel');
   }else if(preset==='sunset-leak'||preset==='blue-leak'){
    const warm=preset==='sunset-leak',entry=warm?m.warmEntry:m.coolEntry,far=warm?m.warmFar:m.coolFar;
    assert.ok(entry[3]>150&&entry[3]>m.centre+60&&far[3]<12,'Leak must enter from its own film edge and taper toward the opposite corner');
    assert.ok(warm?entry[0]>entry[2]+65:entry[2]>entry[0]+65,'Leak must express its named optical palette');
    assert.ok(m.centre<140,'Source centre must remain legible');
   }else if(preset==='film-grain'){
    assert.equal(m.transparent,0);assert.ok(m.darkGrains>.45&&m.lightGrains>.45,'Fine signed grain requires both dark and light cells');
    assert.ok(m.meanAlpha>8&&m.meanAlpha<30&&m.maxAlpha<=55,'Grain must stay translucent');
   }else if(preset==='scanlines'){
    assert.equal(m.rowUniform,true);assert.ok(m.rowRange>=80&&m.transitions>=80,'Distinct horizontal raster rows must survive all artwork dimensions');
    assert.ok(m.darkGrains>.4&&m.lightGrains===0&&m.meanAlpha<50,'Scanlines must be transparent black raster gaps');
   }else if(preset==='edge-neon'){
    assert.equal(m.centre,0);assert.ok(m.neonEdge[3]>180&&m.neonEdge[2]>m.neonEdge[0],'Neon border must have a luminous cyan-white core');
    assert.ok(m.significant<.4&&m.colourful>100,'Neon light must remain localized to the frame');
   }else if(preset==='rainbow-halo'){
    assert.equal(m.centre,0);assert.ok(m.corner<10&&m.significant<.4,'Halo must be an open ring, not a filled disc');
    assert.ok(m.dominant.length===3&&m.colourful>100,'Prismatic ring must contain distinct spectral hues');
   }else if(preset==='particle-stars'){
    assert.ok(m.transparent>.9&&m.significant<.06&&m.bright>5,'Sparse distinct luminous stars must leave the source open');
   }else if(preset==='cyan-gradient'||preset==='ruby-gradient'){
    const cyan=preset==='cyan-gradient',entry=cyan?m.gradientCyan:m.gradientRuby,far=cyan?m.gradientRuby:m.gradientCyan;
    assert.ok(entry[3]>120&&entry[3]>m.centre+45&&far[3]<20,'Decorative diagonal wash must taper to the opposite corner');
    assert.ok(cyan?entry[1]>entry[0]+60&&entry[2]>entry[0]+60:entry[0]>entry[1]+75&&entry[0]>entry[2]+40,'Gradient must match its named hue');
   }
  }
  const baseline=Buffer.from(preview.baseline,'base64'),reduced=Buffer.from(preview.reduced,'base64');
  const fullDelta=meanAbs(original,baseline),reducedDelta=meanAbs(reduced,baseline);
  const minDelta=({'particle-stars':.08,'edge-neon':.8,'rainbow-halo':.8,'film-grain':2,'scanlines':3})[preset]??5;
  assert.ok(fullDelta>minDelta&&reducedDelta>minDelta*.25&&reducedDelta<fullDelta,'Native clip opacity must adjust the visible overlay');
  console.log('[MotoriClip #66 still '+preset+' Chrome PNG] '+preview.png);
  console.log('[MotoriClip #66 still '+preset+' metrics] '+JSON.stringify({alpha:preview.metrics,exactFile:preview.exactFile,fullDelta,reducedDelta,previewMotion}));
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
   'encoded MP4 frames 10 and 35 match decoded still preview within codec tolerance');
 }
 const editor=await browser.newPage({viewport:{width:1450,height:900}}),crashes=[];
 editor.on('pageerror',e=>crashes.push(String(e)));
 await editor.goto('http://127.0.0.1:'+port+'/tools/audio-timeline/advanced.html',{waitUntil:'domcontentloaded'});
 await editor.locator('[data-library-tab="effects"]').click();
 const card=editor.locator('#effects-library-grid [data-preset-id="'+selectedPreset+'"]');
 assert.match(await card.innerText(),/\(still\)/);
 assert.equal(await card.evaluate(e=>e.classList.contains('is-animated')),false);
 await card.click();
 const clip=editor.locator('.timeline-clip.sticker:not(.placeholder)').first();
 await clip.waitFor({timeout:12000});await clip.click();
 assert.equal(await editor.locator('#inspector-timeline-effect').isVisible(),false);
 const opacity=editor.locator('#sticker-opacity');
 assert.equal(await opacity.isVisible(),true);await opacity.fill('45');await opacity.dispatchEvent('input');await clip.click();
 assert.equal(await opacity.inputValue(),'45');
 assert.deepEqual(crashes,[]);
 console.log('[MotoriClip #66 still native Inspector] PASS');
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
 await rm(temp,{recursive:true,force:true});
}
