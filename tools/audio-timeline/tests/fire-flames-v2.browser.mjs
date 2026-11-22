/**
 * #51 Chrome visual acceptance: real composited flame RGBA pixels on footage.
 * The CI log includes a captured PNG for explicit visual inspection.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'};
const server=createServer((req,res)=>{
 const f=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!f.startsWith(root+'/')||!existsSync(f)){res.writeHead(404);res.end('missing');return;}
 res.writeHead(200,{'Content-Type':mime[extname(f)]||'application/octet-stream'});
 res.end(readFileSync(f));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome required for real image acceptance');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
  const {normaliseTimelineEffect}=await import('../js/timeline-effects.mjs');
  const {buildFireFlamesFrame}=await import('../js/timeline-fire-flames.mjs');
  const W=320,H=180;
  const make=source=>{
   const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
   if(source){
    const bg=g.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#0b1830');bg.addColorStop(1,'#283448');
    g.fillStyle=bg;g.fillRect(0,0,W,H);
    g.fillStyle='#586477';
    for(let i=0;i<13;i++)g.fillRect(i*27,90+(i%4)*12,22,110);
    g.font='bold 21px sans-serif';g.fillStyle='#bac7d5';g.fillText('SOURCE IMAGE',68,69);
   }
   return c;
  };
  const video={id:'video',type:'video',sourceName:'source.png',file:{name:'source.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',
   media:make(true),order:2};
  const overlay={id:'flames',type:'sticker',sourceName:'transparent.png',file:{name:'transparent.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',
   media:make(false),order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({
   canvas,mediaBin:document.createElement('div'),onRenderError:e=>renderErrors.push(String(e))
  });
  engine.outputWidth=W;engine.outputHeight=H;
  const pixels=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=values=>{let h=2166136261>>>0;for(const v of values)h=Math.imul(h^v,16777619)>>>0;return h;};
  const render=t=>{engine.currentTime=t;engine.renderFrame();return pixels();};
  engine.tracks=[video];const originalSource=render(.65);
  const effect=normaliseTimelineEffect({presetId:'fire-flames',
   intensity:95,speed:1.35,density:83,scale:122,direction:23,
   distortion:76,glow:78,blur:25,originX:20,originY:12,color:'#ffdf8b'});
  overlay.effectOverlay=effect;engine.tracks=[video,overlay];
  const times=[.15,.65,1.34,2.36];
  const frames=times.map(t=>render(t)),at=frames[1];
  render(.65);const screenshot=canvas.toDataURL('image/png');
  const rewind=render(.65).every((v,i)=>v===at[i]);
  const zones=[0,0,0,0];let firePixels=0,topChanged=0,bottomChanged=0,warm=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4,diff=Math.abs(at[i]-originalSource[i])+
    Math.abs(at[i+1]-originalSource[i+1])+Math.abs(at[i+2]-originalSource[i+2]);
   if(diff>16){
    firePixels++;zones[(x>=W/2?1:0)+(y>=H/2?2:0)]++;
    if(y<32)topChanged++;if(y>90)bottomChanged++;
    if(at[i]>at[i+1]+18&&at[i+1]>at[i+2]+15)warm++;
   }
  }
  const visible=hash(render(.65)),variants={};
  for(const [name,delta] of Object.entries({
   sparse:{density:12},wind:{direction:-90},curl:{distortion:0},
   height:{scale:180},glow:{glow:0},color:{color:'#80eaff'},
   position:{originX:75,originY:66},softness:{blur:0}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...delta});
   variants[name]=hash(render(.65));
  }
  overlay.effectOverlay=effect;overlay.visible=false;
  const hidden=hash(render(.65));overlay.visible=true;
  const cloud=buildFireFlamesFrame(96,54,effect,.65*effect.speed);
  const alpha=[];for(let i=3;i<cloud.data.length;i+=4)alpha.push(cloud.data[i]);
  engine.clearAll();
  return {screenshot,firePixels,topChanged,bottomChanged,warm,zones,
   alphaMinimum:Math.min(...alpha),alphaMaximum:Math.max(...alpha),
   alphaUnique:new Set(alpha).size,original:visible,baseline:hash(originalSource),hidden,
   variants,rewind,hashes:frames.map(hash),renderErrors};
 });
 assert.ok(result.firePixels>2000,'Dense organic flames must be visible over actual source footage');
 assert.ok(result.bottomChanged>1500,'Fire must emerge from lower source, not float as a detached card');
 assert.ok(result.topChanged<100,'Upper air must remain mostly unaffected');
 assert.ok(result.warm>900,'Actual flames must appear visibly warm/red-orange-yellow');
 assert.ok(result.zones[2]>150&&result.zones[3]>150,'Multiple independent flames over source bottom');
 assert.ok(result.alphaMinimum===0&&result.alphaMaximum<255&&result.alphaUnique>50,
  'Flames must have transparent air and graded nonpolygonal contours');
 assert.equal(new Set(result.hashes).size,4,'Flame tongues and flicker change across timeline time');
 assert.equal(result.rewind,true,'Reverse seek must reconstruct pixel-identical RGBA');
 for(const [name,variant] of Object.entries(result.variants))
  assert.notEqual(variant,result.original,'Fire native parameter '+name+' changes real image pixels');
 assert.equal(result.hidden,result.baseline,'Hidden effect leaves source footage untouched');
 assert.deepEqual(result.renderErrors,[]);assert.deepEqual(errors,[]);
 console.log('[MotoriClip #51 Fire Flames visual PNG] '+result.screenshot);
 console.log('[MotoriClip #51 Fire Flames real Chrome] PASS '+JSON.stringify(
  Object.fromEntries(Object.entries(result).filter(([key])=>key!=='screenshot'))));
}finally{
 await browser.close();await new Promise(done=>server.close(done));
}
