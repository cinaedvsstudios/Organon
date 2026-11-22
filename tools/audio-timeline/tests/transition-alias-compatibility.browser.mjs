/** #43 real Chrome: old serialized transition IDs must still run their shaders. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';

const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'};
const server=createServer((req,res)=>{
  const f=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!f.startsWith(root+'/')||!existsSync(f)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[extname(f)]||'application/octet-stream'});
  res.end(readFileSync(f));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Real Chrome required for historical shader compatibility');
const browser=await chromium.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
  const cases=await page.evaluate(async()=>{
    const {AdvancedMediaEngine}=await import('../js/advanced-media-engine-v0.24.js');
    const output=document.createElement('canvas');output.width=128;output.height=72;
    const renderErrors=[],engine=new AdvancedMediaEngine({
      canvas:output,mediaBin:document.createElement('div'),
      onRenderError:e=>renderErrors.push(String(e))
    });
    engine.outputWidth=128;engine.outputHeight=72;
    const source=(color)=>{
      const c=document.createElement('canvas');c.width=128;c.height=72;
      const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,128,72);
      g.fillStyle='#ffffff';g.fillRect(24,12,21,37);
      return c;
    };
    const aSource=source('#1644d6'),bSource=source('#e7581a');
    const variations=[
      {old:'brokey-dissolve',canonical:'bokeh-dissolve',key:'bokehDissolveWebGL',
        params:{'brokey-dissolve':{radius:.11}}},
      {old:'spin',canonical:'whipspin',key:'whipSpinWebGL',
        params:{spin:{turns:1.5,blur:.7}}},
      {old:'color-codes',canonical:'colorcoords',key:'colorCoordsWebGL',
        params:{'color-codes':{strength:.65}}}
    ];
    const fingerprints=[];
    for(const record of variations){
      const a={id:'A',type:'video',file:{name:'A.mp4'},sourceName:'A.mp4',
        media:aSource,start:0,clipDuration:2,order:2,visible:true,opacity:1,blendMode:'source-over'};
      const b={id:'B',type:'video',file:{name:'B.mp4'},sourceName:'B.mp4',
        media:bSource,start:1,clipDuration:2,order:1,visible:true,opacity:1,
        blendMode:'source-over',transitionFromId:'A',transitionEffectId:record.old,
        transitionParameters:record.params,
        visualTransitions:{enter:{type:'fade',duration:1,curve:'linear'},
          exit:{type:'fade',duration:0,curve:'linear'}}};
      engine.setTracks([a,b]);engine.currentTime=1.5;engine.renderFrame();
      const data=output.getContext('2d').getImageData(0,0,128,72).data;
      let hash=2166136261>>>0;
      for(let i=0;i<data.length;i+=4){
        hash=Math.imul(hash^data[i],16777619)>>>0;
        hash=Math.imul(hash^data[i+2],16777619)>>>0;
      }
      const expectedParams=b.transitionParameters[record.canonical];
      const used=Boolean(engine[record.key]);
      const normalized=b.transitionEffectId===record.canonical;
      const aliasCleared=!Object.hasOwn(b.transitionParameters,record.old);
      engine.currentTime=1.1;engine.renderFrame();
      engine.currentTime=1.5;engine.renderFrame();
      const again=output.getContext('2d').getImageData(0,0,128,72).data;
      let hashAgain=2166136261>>>0;
      for(let i=0;i<again.length;i+=4){
        hashAgain=Math.imul(hashAgain^again[i],16777619)>>>0;
        hashAgain=Math.imul(hashAgain^again[i+2],16777619)>>>0;
      }
      fingerprints.push({old:record.old,canonical:record.canonical,
        normalized,aliasCleared,used,hash,hashAgain,
        params:expectedParams,errors:[...renderErrors]});
      engine.clearAll();
      renderErrors.length=0;
    }
    return fingerprints;
  });
  for(const c of cases){
    assert.equal(c.normalized,true,'Engine rejected old ID '+c.old);
    assert.equal(c.aliasCleared,true,'Engine failed to migrate settings for '+c.old);
    assert.equal(c.used,true,'Old project failed to execute real shader '+c.canonical);
    assert.equal(c.hash,c.hashAgain,'Backward seeking changed pixels for '+c.old);
    assert.deepEqual(c.errors,[]);
  }
  assert.equal(new Set(cases.map(c=>c.hash)).size,3,
    'Three legacy aliases should produce their three distinct original shader frames');
  assert.deepEqual(errors,[]);
  console.log('[MotoriClip #43] PASS historical aliases through engine setTracks, native WebGL, saved options, deterministic seeking: '+JSON.stringify(cases));
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
}