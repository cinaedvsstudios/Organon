/**
 * MotoriClip #56 Chrome: original procedural spinning yellow/white Starburst
 * over real lower-layer footage, evidence PNG, controls and seek reversibility.
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
assert.ok(chrome,'Chrome required for rendered Starburst screenshots');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
  const {normaliseTimelineEffect}=await import('../js/timeline-effects.mjs');
  const {starburstGeometry}=await import('../js/timeline-starburst.mjs');
  const W=320,H=180,make=()=>{
   const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');
   const g=ctx.createLinearGradient(0,0,0,H);
   g.addColorStop(0,'#101d3c');g.addColorStop(1,'#334f77');
   ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
   ctx.fillStyle='#a7bfd4';ctx.font='bold 19px sans-serif';
   ctx.fillText('SOURCE IMAGE',82,61);
   for(let i=0;i<10;i++){
    ctx.fillStyle=i%2?'#34425a':'#465776';
    ctx.fillRect(i*34,113+(i%3)*8,27,67);
   }
   return c;
  };
  const video={id:'video',type:'video',file:{name:'scene.png'},
   sourceName:'scene.png',start:0,clipDuration:3,visible:true,
   opacity:1,blendMode:'source-over',media:make(),order:2};
  const overlay={id:'burst',type:'sticker',file:{name:'clear.png'},sourceName:'clear.png',
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',
   media:make(),order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({
   canvas,mediaBin:document.createElement('div'),onRenderError:e=>renderErrors.push(String(e))
  });
  engine.outputWidth=W;engine.outputHeight=H;
  const pixels=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=a=>{let h=2166136261>>>0;for(const v of a)h=Math.imul(h^v,16777619)>>>0;return h;};
  const render=t=>{engine.currentTime=t;engine.renderFrame();return pixels();};
  engine.tracks=[video];const baseline=render(.61);
  const effect=normaliseTimelineEffect({
   presetId:'starburst',intensity:86,speed:1.3,glow:68,
   rayCount:18,rayThickness:50,spinDirection:1,direction:20,
   originX:48,originY:47,color:'#ffe100',secondaryColor:'#ffffff'
  });
  overlay.effectOverlay=effect;engine.tracks=[video,overlay];
  const times=[.1,.35,.61,1.3],frames=times.map(t=>render(t)),current=frames[2];
  render(.61);const screenshot=canvas.toDataURL('image/png');
  const rewind=render(.61).every((v,i)=>v===current[i]);
  const zones=[0,0,0,0];let changed=0,yellow=0,white=0,sourceAlphaChanged=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4,delta=Math.abs(current[i]-baseline[i])+
    Math.abs(current[i+1]-baseline[i+1])+Math.abs(current[i+2]-baseline[i+2]);
   if(delta>20){changed++;zones[(x>=W/2?1:0)+(y>=H/2?2:0)]++;}
   if(current[i]>160&&current[i+1]>145&&current[i+2]<105)yellow++;
   if(current[i]>160&&current[i+1]>160&&current[i+2]>160)white++;
   if(current[i+3]!==baseline[i+3])sourceAlphaChanged++;
  }
  const original=hash(render(.61)),variants={};
  for(const [name,delta] of Object.entries({
   primary:{color:'#ff7abc'},secondary:{secondaryColor:'#5edfff'},
   count:{rayCount:32},thickness:{rayThickness:20},
   direction:{spinDirection:-1},speed:{speed:2.6},
   startingAngle:{direction:105},center:{originX:19,originY:78},
   glow:{glow:0},opacity:{intensity:26}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...delta});
   variants[name]=hash(render(.61));
  }
  overlay.effectOverlay=effect;overlay.visible=false;
  const hidden=hash(render(.61));
  const g=starburstGeometry(W,H,effect,.61*effect.speed);
  const reverse=starburstGeometry(W,H,{...effect,spinDirection:-1},.61*effect.speed);
  engine.clearAll();
  return {screenshot,changed,yellow,white,zones,sourceAlphaChanged,
   baseline:hash(baseline),hidden,original,hashes:frames.map(hash),
   variants,rewind,rayCount:g.rayCount,raySectors:g.rays.length,
   clockwisePhase:g.rotation,reversePhase:reverse.rotation,renderErrors};
 });
 assert.ok(result.changed>40000,'Sunburst must fill most of the frame with real coloured rays');
 assert.ok(result.zones.every(x=>x>8000),'Alternate rays must cover all image quadrants');
 assert.ok(result.yellow>2000,'Vivid yellow radial spokes must be visible');
 assert.ok(result.white>2000,'Separately white spokes must visibly alternate with yellow');
 assert.equal(result.sourceAlphaChanged,0,'Animated overlay must preserve opaque source alpha');
 assert.equal(new Set(result.hashes).size,4,'Sunburst rotates coherently at distinct clip-relative times');
 assert.equal(result.rewind,true,'Backward seek must reconstruct exactly identical pixels');
 for(const [name,value] of Object.entries(result.variants))
  assert.notEqual(value,result.original,'New Starburst '+name+' control alters real output pixels');
 assert.equal(result.hidden,result.baseline,'Hiding Starburst restores untouched underlying video');
 assert.equal(result.rayCount,18);assert.equal(result.raySectors,36);
 assert.notEqual(result.clockwisePhase,result.reversePhase,'Two spin directions must differ');
 assert.deepEqual(result.renderErrors,[]);assert.deepEqual(errors,[]);
 console.log('[MotoriClip #56 Starburst visual PNG] '+result.screenshot);
 console.log('[MotoriClip #56 Starburst real Chrome] PASS '+JSON.stringify(
  Object.fromEntries(Object.entries(result).filter(([key])=>key!=='screenshot'))));
}finally{await browser.close();await new Promise(done=>server.close(done));}
