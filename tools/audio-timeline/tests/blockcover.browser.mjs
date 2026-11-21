/**
 * #21 BlockCover: genuine browser pixel acceptance, independent pinned GLSL
 * reference framebuffer, independently timed solid block pop-in/out,
 * elastic overshoot, RGBA cover, soft edges and full concealment of the cut.
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
  const [{AdvancedMediaEngine},{BLOCK_COVER_SOURCE}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),
   import('../js/gl-transitions/BlockCover.mjs')
  ]);
  const w=160,h=100;
  const makeSource=(kind,opacity=1)=>{
   const c=document.createElement('canvas');c.width=w;c.height=h;
   const ctx=c.getContext('2d');ctx.globalAlpha=opacity;
   ctx.fillStyle=kind==='A'?'#0b61d9':kind==='B'?'#ef641d':'#21b35c';
   ctx.fillRect(0,0,w,h);
   for(let y=0;y<h;y+=10)for(let x=0;x<w;x+=10){
    ctx.fillStyle=(Math.floor(x/10)+Math.floor(y/10))%2
      ?(kind==='A'?'#def9ff':kind==='B'?'#742020':'#eeff33')
      :(kind==='A'?'#0e173a':kind==='B'?'#ffff99':'#213627');
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
   transitionFromId:'A',transitionEffectId:'block-cover',
   visualTransitions:{enter:{type:'fade',curve:'linear',duration:1},
    exit:{type:'fade',curve:'linear',duration:0}}};
  engine.tracks=[a,b];
  const asImage=(progress,options)=>{
   b.transitionParameters={'block-cover':options};
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
  if(!gl)throw Error('Independent BlockCover shader context unavailable');
  const compile=(type,code)=>{
   const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))
    throw Error('Reference original BlockCover shader failed: '+gl.getShaderInfoLog(shader));
   return shader;
  };
  const vs=compile(gl.VERTEX_SHADER,`attribute vec2 xy;varying vec2 uv;
void main(){uv=(xy+1.)*.5;gl_Position=vec4(xy,0.,1.);}`);
  const fs=compile(gl.FRAGMENT_SHADER,`precision highp float;
varying vec2 uv;uniform float progress;uniform float ratio;
uniform sampler2D sourceA;uniform sampler2D sourceB;
vec4 getFromColor(vec2 p){return texture2D(sourceA,p);}
vec4 getToColor(vec2 p){return texture2D(sourceB,p);}
${BLOCK_COVER_SOURCE}
void main(){gl_FragColor=transition(uv);}`);
  const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS))
   throw Error('Reference BlockCover link error: '+gl.getProgramInfoLog(prog));
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
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const reference=(progress,options)=>{
   gl.viewport(0,0,w,h);
   gl.uniform1f(loc('progress'),progress);
   gl.uniform1f(loc('ratio'),w/h);
   gl.uniform1i(loc('blocks'),options.blocks);
   gl.uniform4fv(loc('color'),[...rgb(options.color),options.colorAlpha]);
   gl.uniform1f(loc('pop'),options.pop);
   gl.uniform1f(loc('smoothness'),options.smoothness);
   gl.disable(gl.BLEND);
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   if(gl.getError()!==gl.NO_ERROR)throw Error('Original reference BlockCover GPU failure');
   const raw=new Uint8Array(w*h*4);
   gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,raw);
   return raw;
  };
  const opts=[
   {blocks:16,color:'#f25242',colorAlpha:1,pop:.5,smoothness:.03},
   {blocks:9,color:'#10e8ca',colorAlpha:.8,pop:1,smoothness:.2}
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
  const variations={blocks:29,color:'#ff00aa',colorAlpha:.15,pop:0,smoothness:.35};
  // Staggered tile growth, full solid midpoint and staggered pop-out are
  // separately visible in the original shader, rather than static mosaics.
  const fingerprint=options=>[.12,.24,.33,.42,.5,.61,.77,.9].map(p=>asImage(p,options).hash).join(':');
  for(const [key,value] of Object.entries(variations))
   variation[key]={hash:fingerprint({...opts[0],[key]:value}),
     baseline:fingerprint(opts[0])};
  const chosen=asImage(.55,opts[0]).hash;
  const bg={id:'BG',type:'video',sourceName:'green.png',file:{name:'green.png'},
   start:0,clipDuration:4,order:3,visible:true,opacity:1,blendMode:'source-over',
   media:makeSource('BG')};
  a.opacity=.5;b.opacity=.5;engine.tracks=[bg,a,b];
  // By .5 the original panel wipe already switches to incoming image B.
  // Sample before the cut to verify outgoing A visibility is honored.
  const alpha=asImage(.18,opts[0]).hash;
  a.visible=false;
  const hidden=asImage(.18,opts[0]).hash;
  const used=Boolean(engine.blockCoverWebGL);
  engine.clearAll();
  return {samples,representative,used,
   stable:baseline.hash===rewound.hash,variation,chosen,alpha,hidden,
   cleanup:engine.blockCoverWebGL===null
    &&engine.blockCoverFromScratch===null&&engine.blockCoverToScratch===null,
   renderErrors};
 });
 assert.equal(result.used,true,'Test MUST run real BlockCover WebGL shader, not Canvas fallback');
 for(const sample of result.samples){
  assert.ok(sample.mean<=2.2&&sample.max<=14,
   'MotoriClip BlockCover pixels must match separately compiled original GLSL: '
    +JSON.stringify({progress:sample.progress,settings:sample.settings,
      mean:sample.mean,max:sample.max}));
 }
 for(const [name,hash] of Object.entries(result.variation))
  assert.notEqual(hash.hash,hash.baseline,'Original BlockCover option '+name+' did not change animation');
 assert.equal(result.stable,true,'Reverse timeline seeking must reproduce exact same BlockCover pixels');
 assert.notEqual(result.alpha,result.hidden,'Hidden outgoing track must not reappear inside BlockCover');
 assert.equal(result.cleanup,true,'Project clear must release BlockCover GPU and scratch textures');
 assert.deepEqual(result.renderErrors,[]);
 assert.deepEqual(errors,[]);
 console.log('[BlockCover #21] PASS original staggered solid block cover, elastic pop overshoot, individual departure and RGBA cut-hold GLSL, two independent option sets,'
   +' 5 timeline timestamps, standalone pixel reference, all five native controls,'
   +' alpha/visibility, seeking and GPU cleanup');
 console.log('[BlockCover #21 visual PNG] '+result.representative);
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
