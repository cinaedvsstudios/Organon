/**
 * #47 real Chrome: inspect actual Pixel Scan overlay in the timeline renderer.
 * Quantitative non-static spatial distribution, independent per-group motion,
 * deterministic reverse seek, color/density controls, visibility and image PNG.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';

const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'};
const server=createServer((req,res)=>{
 const f=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!f.startsWith(root+'/')||!existsSync(f)){res.writeHead(404);res.end('not found');return;}
 res.writeHead(200,{'Content-Type':mime[extname(f)]||'application/octet-stream'});
 res.end(readFileSync(f));
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const executablePath=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath,'Actual Chrome Canvas output required');
const browser=await chromium.launch({executablePath,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
  const {normaliseTimelineEffect}=await import('../js/timeline-effects.mjs');
  const {buildPixelScanFrame}=await import('../js/timeline-pixel-scan.mjs');
  const W=320,H=180;
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const make=(opaque=false)=>{
   const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
   const g=canvas.getContext('2d');
   if(opaque){
    g.fillStyle='#0b172c';g.fillRect(0,0,W,H);
    g.fillStyle='#21466d';
    for(let y=0;y<H;y+=30)for(let x=0;x<W;x+=40)
     if((x+y)%80===0)g.fillRect(x+2,y+2,37,27);
    g.font='bold 26px sans-serif';g.fillStyle='#7d9fb2';g.fillText('LIVE SOURCE',52,92);
   }
   return canvas;
  };
  const under={id:'base',type:'video',sourceName:'base.png',file:{name:'base.png'},
   order:2,media:make(true),visible:true,opacity:1,blendMode:'source-over',
   start:0,clipDuration:3};
  const settings=normaliseTimelineEffect({presetId:'pixel-scan',intensity:95,speed:1.25,
   density:86,scale:118,direction:15,distortion:70,glow:74,
   originX:51,originY:40,color:'#ffce8d'});
  const overlay={id:'overlay',type:'sticker',sourceName:'overlay.png',file:{name:'overlay.png'},
   order:0,media:make(false),start:0,clipDuration:3,visible:true,
   opacity:1,blendMode:'source-over',effectOverlay:settings};
  const renderErrors=[];
  const engine=new AdvancedMediaEngine({canvas:c,mediaBin:document.createElement('div'),
   onRenderError:error=>renderErrors.push(String(error))});
  engine.outputWidth=W;engine.outputHeight=H;
  const pixels=()=>new Uint8Array(c.getContext('2d').getImageData(0,0,W,H).data);
  const fingerprint=buffer=>{
   let h=2166136261>>>0;
   for(const v of buffer)h=Math.imul(h^v,16777619)>>>0;
   return h;
  };
  const render=t=>{
   engine.currentTime=t;engine.renderFrame();
   return pixels();
  };
  engine.tracks=[under];
  const base=render(.65);
  engine.tracks=[under,overlay];
  const frames=[.15,.65,1.35,2.4].map(t=>({t,data:render(t)}));
  const screenshot=(()=>{render(.65);return c.toDataURL('image/png');})();
  const rewind=render(.65);
  const baseline=frames[1].data;
  const distribution=[0,0,0,0],delta=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4;
   const change=Math.abs(base[i]-baseline[i])+Math.abs(base[i+1]-baseline[i+1])
    +Math.abs(base[i+2]-baseline[i+2]);
   if(change>15){distribution[(x>=W/2?1:0)+(y>=H/2?2:0)]++;delta.push(change);}
  }
  overlay.effectOverlay=normaliseTimelineEffect({...settings,density:12});
  const sparse=fingerprint(render(.65));
  overlay.effectOverlay=normaliseTimelineEffect({...settings,color:'#4df4ef'});
  const cyan=fingerprint(render(.65));
  overlay.effectOverlay=normaliseTimelineEffect({...settings,direction:-110});
  const reverseDirection=fingerprint(render(.65));
  overlay.effectOverlay=settings;
  overlay.visible=false;
  const hidden=fingerprint(render(.65));
  overlay.visible=true;
  const original=fingerprint(render(.65));
  const emitted=buildPixelScanFrame(W,H,settings,.65*settings.speed);
  engine.clearAll();
  return {frames:frames.map(({t,data})=>({t,hash:fingerprint(data)})),
   screenshot,distribution,changed:delta.length,reverseStable:
    baseline.length===rewind.length&&baseline.every((v,i)=>v===rewind[i]),
   controls:{sparse,cyan,reverseDirection,original,hidden,base:fingerprint(base)},
   pixelGroups:emitted.length,activeGroups:emitted.filter(g=>g.alpha>.1).length,
   renderErrors};
 });
 assert.equal(result.pixelGroups,86);
 assert.ok(result.activeGroups>18,'Independent Pixel Scan clusters must be simultaneously active');
 assert.ok(result.changed>1200,'Animated Pixel Scan must visibly affect source frame pixels');
 assert.ok(result.distribution.every(x=>x>100),
  'Pixel Scan groups must be dispersed in all four image quadrants, not one sliding strip: '+JSON.stringify(result.distribution));
 assert.equal(new Set(result.frames.map(x=>x.hash)).size,4,
  'Separate timestamps must show distinct regenerated frames');
 assert.equal(result.reverseStable,true,'Backward seeking must reproduce identical actual RGBA pixels');
 for(const key of ['sparse','cyan','reverseDirection'])
  assert.notEqual(result.controls[key],result.controls.original,
   'Independent Pixel Scan control '+key+' must change actual image pixels');
 assert.equal(result.controls.hidden,result.controls.base,
  'Hidden generated overlay must reveal the untouched underlying footage');
 assert.deepEqual(result.renderErrors,[]);
 assert.deepEqual(pageErrors,[]);
 console.log('[Pixel Scan #47] PASS independent distributed animated pixel groups, flicker, controls, reversible seeking and real Canvas overlay');
 console.log('[Pixel Scan #47 visual PNG] '+result.screenshot);
 console.log('[Pixel Scan #47 diagnostics] '+JSON.stringify({
  changed:result.changed,distribution:result.distribution,frames:result.frames,
  controls:result.controls,activeGroups:result.activeGroups
 }));
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}