/**
 * #45: close the legacy #01/#02 numerical GPU oracle gap.
 * Compare an independently compiled source shader (different GL program,
 * buffer, textures, uniforms) to the production AdvancedMediaEngine output.
 * Both render identical A/B image fixtures at 0/25/50/75/100%, plus a
 * second native option set, rewind, visibility and GPU resource disposal.
 */
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
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chrome,'Chrome must be installed to run the real original GLSL oracles');
const browser=await chromium.launch({executablePath:chrome,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/audio-timeline/tests/browser-harness.html');
 const cases=await page.evaluate(async()=>{
  const [{AdvancedMediaEngine},{SPIRAL_BLOCK_SOURCE},{HOLOGRAM_SOURCE}]=await Promise.all([
   import('../js/advanced-media-engine-v0.24.js'),
   import('../js/gl-transitions/SpiralBlockWipe.mjs'),
   import('../js/gl-transitions/Hologram.mjs')
  ]);
  const W=160,H=100;
  const createSource=kind=>{
   const c=document.createElement('canvas');c.width=W;c.height=H;
   const ctx=c.getContext('2d');
   const grad=ctx.createLinearGradient(0,0,kind==='A'?W:0,kind==='B'?H:0);
   grad.addColorStop(0,kind==='A'?'#1048da':'#e8782a');
   grad.addColorStop(1,kind==='A'?'#46e6e9':'#e8d254');
   ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
   for(let y=0;y<H;y+=10)for(let x=0;x<W;x+=10){
    ctx.fillStyle=(Math.floor(x/10)+Math.floor(y/10))%2
     ?(kind==='A'?'#0c142c':'#60152c')
     :(kind==='A'?'#b8f7ff':'#f8ff92');
    ctx.fillRect(x+1,y+1,8,8);
   }
   ctx.fillStyle=kind==='A'?'#ffffff':'#1a0817';
   ctx.font='bold 20px sans-serif';ctx.fillText(kind==='A'?'FROM A':'TO B',27,52);
   return c;
  };
  const from=createSource('A'),to=createSource('B');
  const setups=[
   {id:'spiralblockwipe',source:SPIRAL_BLOCK_SOURCE,property:'spiralBlockWebGL',
    a:{columns:8,rows:6,inward:true,clockwise:true,smoothness:.05},
    b:{columns:4,rows:7,inward:false,clockwise:false,smoothness:.16}},
   {id:'hologram',source:HOLOGRAM_SOURCE,property:'hologramWebGL',
    a:{tint:'#33bfff',background:'#00050d',backgroundAlpha:1,scanlines:150,jitter:.04,flicker:.6},
    b:{tint:'#e837a1',background:'#16061a',backgroundAlpha:.7,scanlines:55,jitter:.15,flicker:.9}}
  ];
  const compile=(gl,type,source)=>{
   const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))
    throw Error('Reference source GLSL failed to compile: '+gl.getShaderInfoLog(shader));
   return shader;
  };
  const referenceFor=spec=>{
   const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
   const gl=canvas.getContext('webgl',{
    alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,premultipliedAlpha:false
   });
   if(!gl)throw Error('Independent WebGL context unavailable for '+spec.id);
   const vs=compile(gl,gl.VERTEX_SHADER,[
    'attribute vec2 xy;varying vec2 uv;',
    'void main(){uv=(xy+1.0)*0.5;gl_Position=vec4(xy,0.,1.);}'
   ].join('\n'));
   const fs=compile(gl,gl.FRAGMENT_SHADER,[
    'precision highp float;varying vec2 uv;',
    'uniform sampler2D sourceA;uniform sampler2D sourceB;uniform float progress;',
    'vec4 getFromColor(vec2 p){return texture2D(sourceA,p);}',
    'vec4 getToColor(vec2 p){return texture2D(sourceB,p);}',
    spec.source,'void main(){gl_FragColor=transition(uv);}'
   ].join('\n'));
   const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);
   gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
   if(!gl.getProgramParameter(p,gl.LINK_STATUS))
    throw Error('Independent reference link error '+spec.id+': '+gl.getProgramInfoLog(p));
   gl.useProgram(p);
   const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
   const xy=gl.getAttribLocation(p,'xy');gl.enableVertexAttribArray(xy);
   gl.vertexAttribPointer(xy,2,gl.FLOAT,false,0,0);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
   gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
   const loc=name=>gl.getUniformLocation(p,name);
   const textures=[from,to].map((source,index)=>{
    const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0+index);
    gl.bindTexture(gl.TEXTURE_2D,tex);
    for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])
     gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
    for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])
     gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    return tex;
   });
   gl.uniform1i(loc('sourceA'),0);gl.uniform1i(loc('sourceB'),1);
   const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
   const render=(progress,options)=>{
    gl.viewport(0,0,W,H);gl.useProgram(p);gl.uniform1f(loc('progress'),progress);
    if(spec.id==='spiralblockwipe'){
     gl.uniform2i(loc('grid'),options.columns,options.rows);
     gl.uniform1i(loc('inward'),options.inward?1:0);
     gl.uniform1i(loc('clockwise'),options.clockwise?1:0);
     gl.uniform1f(loc('smoothness'),options.smoothness);
    }else{
     gl.uniform3fv(loc('tint'),new Float32Array(rgb(options.tint)));
     gl.uniform4fv(loc('background'),new Float32Array([...rgb(options.background),options.backgroundAlpha]));
     gl.uniform1f(loc('scanlines'),options.scanlines);
     gl.uniform1f(loc('jitter'),options.jitter);
     gl.uniform1f(loc('flicker'),options.flicker);
    }
    gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    const error=gl.getError();if(error!==gl.NO_ERROR)
     throw Error('Independent reference GL draw error '+spec.id+': '+error);
    const bytes=new Uint8Array(W*H*4);
    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
    return bytes;
   };
   return {render,dispose(){
    for(const texture of textures)gl.deleteTexture(texture);
    gl.deleteBuffer(buf);gl.deleteProgram(p);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
   }};
  };
  const hash=bytes=>{
   let h=2166136261>>>0;
   for(const v of bytes)h=Math.imul(h^v,16777619)>>>0;
   return h;
  };
  const out=[];
  for(const spec of setups){
   const output=document.createElement('canvas');output.width=W;output.height=H;
   const renderErrors=[];
   const engine=new AdvancedMediaEngine({canvas:output,mediaBin:document.createElement('div'),
    onRenderError:error=>renderErrors.push(String(error))});
   engine.outputWidth=W;engine.outputHeight=H;
   const a={id:'A',type:'video',sourceName:'a.png',file:{name:'a.png'},start:0,clipDuration:2,
    order:2,visible:true,opacity:1,blendMode:'source-over',media:from};
   const b={id:'B',type:'video',sourceName:'b.png',file:{name:'b.png'},start:1,clipDuration:2,
    order:1,visible:true,opacity:1,blendMode:'source-over',media:to,
    transitionFromId:'A',transitionEffectId:spec.id,
    visualTransitions:{enter:{type:'fade',duration:1,curve:'linear'},
     exit:{type:'fade',duration:0,curve:'linear'}}};
   engine.setTracks([a,b]);
   const snapshot=(progress,options)=>{
    b.transitionParameters={[spec.id]:options};engine.currentTime=1+progress;engine.renderFrame();
    return new Uint8Array(output.getContext('2d').getImageData(0,0,W,H).data);
   };
   const reference=referenceFor(spec),samples=[];
   for(const options of [spec.a,spec.b])for(const progress of [0,.25,.5,.75,1]){
    const actual=snapshot(progress,options),expected=reference.render(progress,options);
    let total=0,max=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
     const offset=(y*W+x)*4,up=((H-y-1)*W+x)*4;
     for(let c=0;c<4;c++){
      const wanted=c===3?255:Math.round(expected[up+c]*(expected[up+3]/255));
      const delta=Math.abs(actual[offset+c]-wanted);
      total+=delta;max=Math.max(max,delta);
     }
    }
    samples.push({options,progress,mean:total/(W*H*4),max,hash:hash(actual)});
   }
   const before=hash(snapshot(.5,spec.a));
   snapshot(.14,spec.a);
   const after=hash(snapshot(.5,spec.a));
   const baseline=hash(snapshot(.5,spec.a));
   const customized=hash(snapshot(.5,spec.b));
   const screenshot=(()=>{
    snapshot(.5,spec.a);
    return output.toDataURL('image/png');
   })();
   // Alpha and hidden outgoing-source check use the same original shader,
   // with a lower green layer. They must produce different frame pixels.
   const bg=document.createElement('canvas');bg.width=W;bg.height=H;
   bg.getContext('2d').fillStyle='#2da55b';
   bg.getContext('2d').fillRect(0,0,W,H);
   const under={id:'BG',type:'video',sourceName:'bg.png',file:{name:'bg.png'},
    start:0,clipDuration:3,order:3,media:bg,visible:true,opacity:1,blendMode:'source-over'};
   a.opacity=.5;b.opacity=.5;engine.setTracks([under,a,b]);
   const alpha=hash(snapshot(.43,spec.a));
   a.visible=false;
   const hidden=hash(snapshot(.43,spec.a));
   const gpu=Boolean(engine[spec.property]);
   engine.clearAll();reference.dispose();
   out.push({name:spec.id,samples,stable:before===after,
    optionDifference:baseline!==customized,alphaDifference:alpha!==hidden,
    screenshot,gpu,cleanup:engine[spec.property]===null,
    errors:renderErrors});
  }
  return out;
 });
 for(const test of cases){
  for(const sample of test.samples){
   assert.ok(sample.mean<=2.2&&sample.max<=14,
    'Original independently compiled shader must match MotoriClip: '+JSON.stringify({
      effect:test.name,progress:sample.progress,options:sample.options,
      mean:sample.mean,max:sample.max
    }));
  }
  assert.equal(test.samples.length,10,'Five timeline points times two native settings');
  assert.equal(test.stable,true,'Reverse seek must be pixel-identical for '+test.name);
  assert.equal(test.optionDifference,true,'Options must alter original shader frames: '+test.name);
  assert.equal(test.alphaDifference,true,'Outgoing visibility must change result: '+test.name);
  assert.equal(test.gpu,true,'Actual source GLSL GPU renderer was not used: '+test.name);
  assert.equal(test.cleanup,true,'Original shader resources must release: '+test.name);
  assert.deepEqual(test.errors,[]);
  console.log('[MotoriClip #45] PASS exact original GLSL separately compiled for '+test.name+
    ', 0/25/50/75/100% x 2 option sets, alpha, seeking and GPU cleanup');
  console.log('[MotoriClip #45 '+test.name+' visual PNG] '+test.screenshot);
 }
 assert.deepEqual(errors,[]);
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}