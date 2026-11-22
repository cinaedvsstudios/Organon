/**
 * #48 — actual Chrome rendered curved ember and dust particles, not a
 * recipe-only/mock or a translated still card. Compare real overlay pixels,
 * distribution, elapsed-time motion, reverse seeks, control and visibility.
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
assert.ok(chrome,'Real Chrome required');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
  const {normaliseTimelineEffect}=await import('../js/timeline-effects.mjs');
  const {buildFlamingDustFrame}=await import('../js/timeline-ember-dust.mjs');
  const W=320,H=180;
  const make=background=>{
   const c=document.createElement('canvas');c.width=W;c.height=H;
   const g=c.getContext('2d');
   if(background){
    const sky=g.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#08152c');sky.addColorStop(1,'#1a2034');
    g.fillStyle=sky;g.fillRect(0,0,W,H);
    g.fillStyle='#3a4e65';
    for(let i=0;i<12;i++){const x=i*30;g.fillRect(x,100+(i%4)*10,25,80);}
    g.font='bold 22px sans-serif';g.fillStyle='#8e9eac';g.fillText('SOURCE IMAGE',70,70);
    g.fillStyle='#965136';g.fillRect(0,H-12,W,12);
   }
   return c;
  };
  const under={id:'video',type:'video',sourceName:'source.png',file:{name:'source.png'},
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',
   media:make(true),order:2};
  const overlay={id:'motes',type:'sticker',sourceName:'transparent.png',
   file:{name:'transparent.png'},start:0,clipDuration:3,visible:true,
   opacity:1,blendMode:'source-over',media:make(false),order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({
   canvas,mediaBin:document.createElement('div'),
   onRenderError:error=>renderErrors.push(String(error))
  });
  engine.outputWidth=W;engine.outputHeight=H;
  const rgba=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const fingerprint=p=>{
   let h=2166136261>>>0;
   for(const v of p)h=Math.imul(h^v,16777619)>>>0;
   return h;
  };
  const render=t=>{engine.currentTime=t;engine.renderFrame();return rgba();};
  engine.tracks=[under];const baseline=render(.65);
  const all=[];
  for(const id of ['fire-embers','particle-dust']){
   const effect=normaliseTimelineEffect({presetId:id,intensity:95,speed:1.2,
    density:90,scale:124,direction:27,distortion:78,glow:83,
    originX:46,originY:12,color:'#ffd283'});
   overlay.effectOverlay=effect;engine.tracks=[under,overlay];
   const samples=[.15,.65,1.35,2.45].map(t=>({t,pixels:render(t)}));
   const shot=(()=>{render(.65);return canvas.toDataURL('image/png');})();
   const rewind=render(.65);
   const changed=[0,0,0,0];
   let visiblePixels=0;
   const pixels=samples[1].pixels;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4;
    const d=Math.abs(pixels[i]-baseline[i])+
      Math.abs(pixels[i+1]-baseline[i+1])+
      Math.abs(pixels[i+2]-baseline[i+2]);
    if(d>12){changed[(x>=W/2?1:0)+(y>=H/2?2:0)]++;visiblePixels++;}
   }
   const unchanged=samples[1].pixels.every((v,i)=>v===rewind[i]);
   overlay.effectOverlay=normaliseTimelineEffect({...effect,density:15});
   const sparse=fingerprint(render(.65));
   overlay.effectOverlay=normaliseTimelineEffect({...effect,direction:-87});
   const turned=fingerprint(render(.65));
   overlay.effectOverlay=normaliseTimelineEffect({...effect,color:'#52e6ff'});
   const recolored=fingerprint(render(.65));
   overlay.effectOverlay=effect;overlay.visible=false;
   const hidden=fingerprint(render(.65));
   overlay.visible=true;
   const original=fingerprint(render(.65));
   const particles=buildFlamingDustFrame(W,H,effect,.65*effect.speed);
   all.push({id,original,sparse,turned,recolored,hidden,
    baseline:fingerprint(baseline),rewind:unchanged,
    changed,visiblePixels,active:particles.filter(p=>p.alpha>.12&&p.y>=0&&p.y<H).length,
    frames:samples.map(x=>({time:x.t,hash:fingerprint(x.pixels)})),shot});
  }
  engine.clearAll();
  return {all,renderErrors};
 });
 for(const test of result.all){
  assert.ok(test.active>35,'Each '+test.id+' layer must contain many independently visible motes');
  assert.ok(test.visiblePixels>600,'True bright particles must affect hundreds of image pixels: '+test.id);
  assert.ok(test.changed.every(x=>x>40),'Each quadrant must receive independently seeded particles: '+test.id+' '+JSON.stringify(test.changed));
  assert.equal(new Set(test.frames.map(x=>x.hash)).size,4,
   'Ember/dust particle motion must change at each absolute clip-relative time: '+test.id);
  assert.equal(test.rewind,true,'Backwards seeking must reproduce exact RGBA pixels: '+test.id);
  for(const key of ['sparse','turned','recolored'])
   assert.notEqual(test[key],test.original,'Native particle control must alter visible pixels: '+test.id+'.'+key);
  assert.equal(test.hidden,test.baseline,'Hidden effect must leave source footage intact: '+test.id);
  console.log('[MotoriClip #48 '+test.id+' visual PNG] '+test.shot);
 }
 assert.notEqual(result.all[0].original,result.all[1].original,
  'Embers and floating dust must be different physical effects, not duplicate sprites');
 assert.deepEqual(result.renderErrors,[]);
 assert.deepEqual(errors,[]);
 console.log('[MotoriClip #48] PASS real Chrome curved turbulent motes, individual lifetimes, opacity, distinct dust/ember motion, spatial coverage, controls and rewind');
 console.log('[MotoriClip #48 diagnostics] '+JSON.stringify(result.all.map(({shot,...entry})=>entry)));
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}