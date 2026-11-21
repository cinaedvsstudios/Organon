/**
 * WhipSpin #27: independent WebGL oracle comparing exact original shader against
 * MotoriClip frames, 5 timestamps, 2 uniform sets, all controls, alpha,
 * deterministic seeking, GPU cleanup and old saved ID compatibility.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';

const root=process.cwd(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'};
const server=createServer((req,res)=>{
 const pathname=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!pathname.startsWith(root+'/')||!existsSync(pathname)){res.writeHead(404);res.end('not found');return;}
 res.writeHead(200,{'Content-Type':mime[extname(pathname)]||'application/octet-stream'});
 res.end(readFileSync(pathname));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome is needed for real GPU shader tests');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const result=await page.evaluate(async()=>{
  const [{AdvancedMediaEngine},{WHIP_SPIN_SOURCE}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),
   import('../js/gl-transitions/WhipSpin.mjs')
  ]);
  const w=160,h=100;
  const makeSource=(kind,opacity=1)=>{
   const c=document.createElement('canvas');c.width=w;c.height=h;
   const ctx=c.getContext('2d');ctx.globalAlpha=opacity;
   ctx.fillStyle=kind==='A'?'#0b61d9':kind==='B'?'#ef641d':'#27b35c';
   ctx.fillRect(0,0,w,h);
   for(let y=0;y<h;y+=10)for(let x=0;x<w;x+=10){
    ctx.fillStyle=(Math.floor(x/10)+Math.floor(y/10))%2
      ?(kind==='A'?'#def9ff':kind==='B'?'#742020':'#eeff33')
      :(kind==='A'?'#0e173a':kind==='B'?'#ffff99':'#273627');
    ctx.fillRect(x+1,y+1,8,8);
   }
   return c;
  };
  const output=document.createElement('canvas');output.width=w;output.height=h;
  const renderErrors=[];
  const engine=new AdvancedMediaEngine({canvas:output,mediaBin:document.createElement('div'),
   onRenderError:error=>renderErrors.push(String(error))});
  engine.outputWidth=w;engine.outputHeight=h;
  const a={id:'A',type:'video',sourceName:'a.png',file:{name:'a.png'},
   start:0,clipDuration:2,order:2,visible:true,opacity:1,blendMode:'source-over',media:makeSource('A')};
  const b={id:'B',type:'video',sourceName:'b.png',file:{name:'b.png'},
   start:1,clipDuration:2,order:1,visible:true,opacity:1,blendMode:'source-over',media:makeSource('B'),
   transitionFromId:'A',transitionEffectId:'whipspin',
   visualTransitions:{enter:{type:'fade',curve:'linear',duration:1},
    exit:{type:'fade',curve:'linear',duration:0}}};
  engine.tracks=[a,b];
  const asImage=(progress,options)=>{
   b.transitionParameters={'whipspin':options};
   engine.currentTime=1+progress;
   engine.renderFrame();
   const data=new Uint8Array(output.getContext('2d').getImageData(0,0,w,h).data);
   let hash=2166136261>>>0;
   for(let i=0;i<data.length;i++)hash=Math.imul(hash^data[i],16777619)>>>0;
   return {data,hash,frame:output.toDataURL('image/png')};
  };
  // Reference is separately compiled, with an independent geometry buffer
  // and texture setup; it shares only the authentic byte-pinned shader source.
  const refCanvas=document.createElement('canvas');
  refCanvas.width=w;refCanvas.height=h;
  const gl=refCanvas.getContext('webgl',{alpha:true,antialias:false,depth:false,
   preserveDrawingBuffer:true,premultipliedAlpha:false});
  if(!gl)throw Error('Independent WhipSpin shader context unavailable');
  const compile=(type,code)=>{
   const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))
    throw Error('Reference original WhipSpin shader failed: '+gl.getShaderInfoLog(shader));
   return shader;
  };
  const vs=compile(gl.VERTEX_SHADER,`attribute vec2 xy;varying vec2 uv;
void main(){uv=(xy+1.)*.5;gl_Position=vec4(xy,0.,1.);}`);
  const fs=compile(gl.FRAGMENT_SHADER,`precision highp float;
varying vec2 uv;uniform float progress;uniform float ratio;
uniform sampler2D sourceA;uniform sampler2D sourceB;
vec4 getFromColor(vec2 p){return texture2D(sourceA,p);}
vec4 getToColor(vec2 p){return texture2D(sourceB,p);}
${WHIP_SPIN_SOURCE}
void main(){gl_FragColor=transition(uv);}`);
  const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS))
   throw Error('Reference WhipSpin link error: '+gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const location=gl.getAttribLocation(prog,'xy');gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  const loc=name=>gl.getUniformLocation(prog,name);
  for(const [index,source,name] of [[0,a.media,'sourceA'],[1,b.media,'sourceB']]){
   const texture=gl.createTexture();
   gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
   gl.uniform1i(loc(name),index);
  }
  const reference=(progress,options)=>{
   gl.viewport(0,0,w,h);
   gl.uniform1f(loc('progress'),progress);
   gl.uniform1f(loc('ratio'),w/h);
   gl.uniform1f(loc('turns'),options.turns);
   gl.uniform1f(loc('blur'),options.blur);
   gl.uniform1f(loc('chroma'),options.chroma);
   gl.uniform1f(loc('zoom'),options.zoom);
   gl.disable(gl.BLEND);
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   if(gl.getError()!==gl.NO_ERROR)throw Error('Original reference WhipSpin GPU failure');
   const raw=new Uint8Array(w*h*4);
   gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,raw);
   return raw;
  };
  const opts=[
   {turns:1,blur:.5,chroma:.6,zoom:.25},
   {turns:-2,blur:.9,chroma:.9,zoom:.75}
  ];
  const samples=[];
  let representative='';
  for(const settings of opts)for(const progress of [0,.25,.5,.75,1]){
   const actual=asImage(progress,settings);
   const original=reference(progress,settings);
   let max=0,sum=0;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const idx=(y*w+x)*4,ref=((h-1-y)*w+x)*4;
    for(let k=0;k<4;k++){
     // GPU reference is a straight-alpha framebuffer. AdvancedMediaEngine
     // presents it over opaque black; compare that composite at each pixel.
     const expected=k===3?255:Math.round(original[ref+k]*(original[ref+3]/255));
     const delta=Math.abs(actual.data[idx+k]-expected);
     max=Math.max(max,delta);sum+=delta;
    }
   }
   if(settings===opts[0]&&progress===.5)representative=actual.frame;
   samples.push({settings,progress,mean:sum/(w*h*4),max,hash:actual.hash});
  }
  const baseline=asImage(.5,opts[0]);
  asImage(.2,opts[0]);
  const rewound=asImage(.5,opts[0]);
  const variation={};
  const variations={turns:-1.5,blur:1,chroma:1,zoom:1};
  // Verify the original accelerating/decelerating camera roll and RGB shutter.
  const fingerprint=options=>[.14,.24,.34,.43,.49,.56,.64,.76,.88].map(p=>asImage(p,options).hash).join(':');
  for(const [key,value] of Object.entries(variations))
   variation[key]={hash:fingerprint({...opts[0],[key]:value}),
     baseline:fingerprint(opts[0])};
  // A project persisted before the name correction still stores spin.
  // It must produce identical pixels and migrate its saved options on setTracks.
  const canonicalHash=asImage(.42,opts[0]).hash;
  b.transitionEffectId='spin';b.transitionParameters={spin:opts[0]};
  engine.currentTime=1.42;engine.renderFrame();
  const rawAlias=output.getContext('2d').getImageData(0,0,w,h).data;
  let aliasHash=2166136261>>>0;
  for(const n of rawAlias)aliasHash=Math.imul(aliasHash^n,16777619)>>>0;
  const aliasMatches=canonicalHash===aliasHash;
  engine.setTracks([a,b]);
  const savedMigration=b.transitionEffectId==='whipspin'
    &&!Object.hasOwn(b.transitionParameters,'spin')
    &&b.transitionParameters.whipspin?.turns===opts[0].turns;
  const chosen=asImage(.55,opts[0]).hash;
  const bg={id:'BG',type:'video',sourceName:'green.png',file:{name:'green.png'},
   start:0,clipDuration:4,order:3,visible:true,opacity:1,blendMode:'source-over',
   media:makeSource('BG')};
  a.opacity=.5;b.opacity=.5;engine.tracks=[bg,a,b];
  // Test during initial ink expansion so outgoing visibility affects output.
  const alpha=asImage(.18,opts[0]).hash;
  a.visible=false;
  const hidden=asImage(.18,opts[0]).hash;
  const used=Boolean(engine.whipspinWebGL);
  engine.clearAll();
  return {samples,representative,used,
   stable:baseline.hash===rewound.hash,variation,chosen,alpha,hidden,aliasMatches,savedMigration,
   cleanup:engine.whipspinWebGL===null
    &&engine.whipspinFromScratch===null&&engine.whipspinToScratch===null,
   renderErrors};
 });
 assert.equal(result.used,true,'Test MUST run real WhipSpin WebGL shader, not Canvas fallback');
 assert.equal(result.aliasMatches,true,'Legacy spin ID must render the exact original shader');
 assert.equal(result.savedMigration,true,'Legacy spin settings must migrate without losing parameters');
 for(const sample of result.samples){
  assert.ok(sample.mean<=2.2&&sample.max<=14,
   'MotoriClip WhipSpin pixels must match separately compiled original GLSL: '
    +JSON.stringify({progress:sample.progress,settings:sample.settings,
      mean:sample.mean,max:sample.max}));
 }
 for(const [name,hash] of Object.entries(result.variation))
  assert.notEqual(hash.hash,hash.baseline,'Original WhipSpin option '+name+' did not change animation');
 assert.equal(result.stable,true,'Reverse timeline seeking must reproduce exact same WhipSpin pixels');
 assert.notEqual(result.alpha,result.hidden,'Hidden outgoing track must not reappear inside WhipSpin');
 assert.equal(result.cleanup,true,'Project clear must release WhipSpin GPU and scratch textures');
 assert.deepEqual(result.renderErrors,[]);
 assert.deepEqual(errors,[]);
 console.log('[WhipSpin #27] PASS original 24-tap spin blur, chromatic trails and camera zoom GLSL, two independent option sets,'
   +' 5 timeline timestamps, standalone pixel reference, all four native controls,'
   +' alpha/visibility, seeking and GPU cleanup');
 console.log('[WhipSpin #27 visual PNG] '+result.representative);
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
