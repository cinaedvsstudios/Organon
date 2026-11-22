/**
 * #54 real Chrome visual acceptance: broad organic pink/violet transparent
 * light blooms over real source media, not three moving generic discs.
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
assert.ok(chrome,'A real Chrome browser is needed for screenshot acceptance');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
  const {normaliseTimelineEffect}=await import('../js/timeline-effects.mjs');
  const {buildLightLeaksFrame,sampleLightLeak}=await import('../js/timeline-light-leaks.mjs');
  const W=320,H=180;
  const make=scene=>{
   const c=document.createElement('canvas');c.width=W;c.height=H;
   const ctx=c.getContext('2d');
   if(scene){
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#122947');sky.addColorStop(1,'#2c3c5a');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    for(let i=0;i<14;i++){
     ctx.fillStyle=i%2?'#62738a':'#8c95a5';
     ctx.fillRect(i*25,86+(i%3)*12,22,97);
     ctx.fillStyle='#bed5ea';
     ctx.fillRect(i*25+6,100+(i%3)*12,5,9);
    }
    ctx.fillStyle='#d6e3f3';ctx.font='bold 20px sans-serif';
    ctx.fillText('SOURCE IMAGE',70,66);
    ctx.fillStyle='#eadabb';ctx.fillRect(0,172,W,8);
   }
   return c;
  };
  const video={id:'video',type:'video',file:{name:'city.png'},sourceName:'city.png',
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',
   media:make(true),order:2};
  const overlay={id:'light',type:'sticker',file:{name:'clear.png'},sourceName:'clear.png',
   start:0,clipDuration:3,visible:true,opacity:1,blendMode:'source-over',
   media:make(false),order:0};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const renderErrors=[],engine=new AdvancedMediaEngine({
   canvas,mediaBin:document.createElement('div'),onRenderError:e=>renderErrors.push(String(e))
  });
  engine.outputWidth=W;engine.outputHeight=H;
  const pixel=()=>new Uint8Array(canvas.getContext('2d').getImageData(0,0,W,H).data);
  const hash=a=>{let h=2166136261>>>0;for(const v of a)h=Math.imul(h^v,16777619)>>>0;return h;};
  const render=t=>{engine.currentTime=t;engine.renderFrame();return pixel();};
  engine.tracks=[video];const source=render(.68);
  const effect=normaliseTimelineEffect({presetId:'light-leaks',
   intensity:96,speed:1.3,density:88,scale:116,direction:30,
   distortion:82,glow:95,blur:40,originX:20,originY:12,color:'#ed72cc'});
  overlay.effectOverlay=effect;engine.tracks=[video,overlay];
  const times=[.13,.39,.68,1.42],frames=times.map(t=>render(t));
  render(.68);const screenshot=canvas.toDataURL('image/png');
  const rewind=render(.68).every((v,i)=>v===frames[2][i]);
  let changed=0,rose=0,violet=0,hot=0;
  const zones=[0,0,0,0],alpha=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const k=(y*W+x)*4,out=frames[2],d=Math.abs(out[k]-source[k])+
    Math.abs(out[k+1]-source[k+1])+Math.abs(out[k+2]-source[k+2]);
   if(d>16){changed++;zones[(x>=W/2?1:0)+(y>=H/2?2:0)]++;}
   if(out[k]>out[k+1]+20&&out[k+2]>out[k+1]+16)rose++;
   if(out[k+2]>out[k]+25&&out[k+2]>out[k+1]+33)violet++;
   if(out[k]>229&&out[k+1]>186&&out[k+2]>221)hot++;
  }
  const f=buildLightLeaksFrame(96,54,effect,.68*effect.speed);
  for(let i=3;i<f.data.length;i+=4)alpha.push(f.data[i]);
  const original=hash(render(.68)),variants={};
  for(const [name,delta] of Object.entries({
   color:{color:'#82d7ff'},density:{density:10},direction:{direction:-93},
   bloom:{glow:0},softness:{blur:0},turbulence:{distortion:0},
   scale:{scale:196},origin:{originX:72,originY:83},intensity:{intensity:27}
  })){
   overlay.effectOverlay=normaliseTimelineEffect({...effect,...delta});
   variants[name]=hash(render(.68));
  }
  overlay.effectOverlay=effect;overlay.visible=false;
  const hidden=hash(render(.68));
  const left=sampleLightLeak(.04,.45,effect,.68*effect.speed);
  const right=sampleLightLeak(.95,.55,effect,.68*effect.speed);
  engine.clearAll();
  return {screenshot,changed,rose,violet,hot,zones,
   alphaMin:Math.min(...alpha),alphaMax:Math.max(...alpha),
   transparent:alpha.filter(x=>x<14).length,alphaUnique:new Set(alpha).size,
   hashes:frames.map(hash),original,baseline:hash(source),
   variants,hidden,rewind,leftMain:left.magenta,leftViolet:left.violet,
   rightMain:right.magenta,rightViolet:right.violet,renderErrors};
 });
 assert.ok(result.changed>8000,'Broad soft light must visibly accumulate over real source footage');
 assert.ok(result.zones.filter(n=>n>500).length>=3,'Colour clouds must occupy broad scene areas, not one moving box');
 assert.ok(result.rose>1500,'Pink/magenta bloom must be visibly present');
 assert.ok(result.violet>300,'Purple/violet bloom must be visible across scene');
 assert.ok(result.hot>200,'A soft localized overexposed cream/pink bloom must be visible');
 assert.ok(result.alphaMax<255&&result.alphaMax>175&&result.alphaUnique>100,
  'Light must have broad fractional alpha, a bright core and soft irregular boundaries');
 assert.ok(result.transparent>5,'Some weakly affected transparent areas must remain');
 assert.ok(result.leftMain>result.leftViolet&&result.rightViolet>result.rightMain,
  'Opposing cloud edges must include distinct pink and violet areas');
 assert.equal(new Set(result.hashes).size,4,'Internal cloud structure changes across four independent times');
 assert.equal(result.rewind,true,'Backwards seeking recreates exact light RGBA pixels');
 for(const [name,variant] of Object.entries(result.variants))
  assert.notEqual(variant,result.original,'Inspector '+name+' alters real footage pixels');
 assert.equal(result.hidden,result.baseline,'Hidden leak leaves original media untouched');
 assert.deepEqual(result.renderErrors,[]);assert.deepEqual(errors,[]);
 console.log('[MotoriClip #54 Light Leaks visual PNG] '+result.screenshot);
 console.log('[MotoriClip #54 Light Leaks real Chrome] PASS '+JSON.stringify(
  Object.fromEntries(Object.entries(result).filter(([key])=>key!=='screenshot'))));
}finally{await browser.close();await new Promise(done=>server.close(done));}
