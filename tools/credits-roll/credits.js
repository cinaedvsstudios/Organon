/* ORGANON · CREDITS ROLL · v0.01
   One 1920x1080 reference-space renderer drives both preview and file export.
   No credits text is used as HTML. Video processing remains in the browser.
*/
const $ = (id) => document.getElementById(id);
const W = 1920, H = 1080;
const STORE = 'organon.credits-roll.v001';
const SAMPLE = '# VENIVIDIVICI\n## Episode One — Domitian\n\n## Historical Sources\nSuetonius — The Twelve Caesars, Domitian\nCassius Dio — Roman History, Book 67\nQuintilian — Institutio Oratoria\n\n## Modern Scholarship\nHistorical research and interpretation\nArchaeological and epigraphic evidence\n\n## Acknowledgements\nWith thanks to our viewers and contributors\n\nVENIVIDIVICI — Voices History Left Behind';
const PRESET = {
  text:'',font:'Georgia',align:'center',fontSize:44,headingSize:66,
  textColor:'#ffffff',headingColor:'#ffffff',boldHeadings:true,
  lineHeight:1.32,paragraphSpacing:28,headingSpacing:45,
  maxWidth:76,horizontalPosition:50,backgroundColor:'#000000',
  overlay:35,backgroundSrc:'',scrollDuration:40,scrollSpeed:75,
  openingDelay:0,endingDelay:1,fadeIn:0,fadeOut:0,
  format:'mp4',resolution:'1920x1080',fps:30,filename:'credits-roll'
};
const IDS = {
  font:'font',align:'align',fontSize:'font-size',headingSize:'heading-size',
  textColor:'text-color',headingColor:'heading-color',boldHeadings:'bold-headings',
  lineHeight:'line-height',paragraphSpacing:'paragraph-spacing',headingSpacing:'heading-spacing',
  maxWidth:'max-width',horizontalPosition:'horizontal-position',backgroundColor:'background-color',
  overlay:'overlay',scrollDuration:'scroll-duration',scrollSpeed:'scroll-speed',
  openingDelay:'opening-delay',endingDelay:'ending-delay',fadeIn:'fade-in',fadeOut:'fade-out',
  format:'format',resolution:'resolution',fps:'fps',filename:'filename'
};
const NUMBERS = new Set(['fontSize','headingSize','lineHeight','paragraphSpacing','headingSpacing','maxWidth','horizontalPosition','overlay','scrollDuration','scrollSpeed','openingDelay','endingDelay','fadeIn','fadeOut','fps']);
let state = {...PRESET};
let background = null;
let currentTime = 0, isPlaying = false, raf = 0, playbackStart = 0;
let exporting = false, exportCanceled = false, exportOutput = null;
let layout = null;
let enginePromise = null;
const measureCanvas = document.createElement('canvas');
measureCanvas.width = W; measureCanvas.height = H;
const measureCtx = measureCanvas.getContext('2d');
const canvas = $('preview'), ctx = canvas.getContext('2d', {alpha:false});

function clamp(n,low,high) { return Math.min(high,Math.max(low,n)); }
function fmt(seconds) {
  const s = Math.max(0,Math.floor(seconds));
  const str = String(Math.floor(s/3600)).padStart(2,'0') + ':' + String(Math.floor(s/60)%60).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
  return s>=3600 ? str : str.slice(3);
}
function message(str,kind='') {
  const el = $('status');
  el.textContent=str; el.className=kind;
  if(window.parent!==window) window.parent.postMessage({type:'set-status',text:str},location.origin);
}
function persist() {
  try { localStorage.setItem(STORE,JSON.stringify(state)); }
  catch(err) { message('Browser storage is full or unavailable. Export the project as JSON to preserve it.','error'); }
}
function safeProject(input) {
  const result={...PRESET};
  if (!input || typeof input !== 'object') throw new Error('Invalid project format.');
  for (const key of Object.keys(PRESET)) {
    if (!Object.prototype.hasOwnProperty.call(input,key)) continue;
    const val=input[key];
    if(NUMBERS.has(key)) {
      if(Number.isFinite(Number(val))) result[key]=Number(val);
    } else if(typeof PRESET[key]==='boolean') result[key]=Boolean(val);
    else if(typeof val==='string') result[key]=val;
  }
  if(!/^data:image\/(png|jpeg|webp|gif|bmp);base64,/i.test(result.backgroundSrc)) result.backgroundSrc='';
  result.scrollDuration=clamp(result.scrollDuration,.1,7200);
  result.fontSize=clamp(result.fontSize,12,150);
  result.headingSize=clamp(result.headingSize,14,180);
  result.lineHeight=clamp(result.lineHeight,1,3);
  result.paragraphSpacing=clamp(result.paragraphSpacing,0,200);
  result.headingSpacing=clamp(result.headingSpacing,0,240);
  result.maxWidth=clamp(result.maxWidth,25,90);
  result.horizontalPosition=clamp(result.horizontalPosition,5,95);
  result.overlay=clamp(result.overlay,0,100);
  result.openingDelay=clamp(result.openingDelay,0,300);
  result.endingDelay=clamp(result.endingDelay,0,300);
  result.fadeIn=clamp(result.fadeIn,0,120);
  result.fadeOut=clamp(result.fadeOut,0,120);
  result.fps=[24,30,60].includes(result.fps)?result.fps:30;
  if(!['mp4','webm'].includes(result.format)) result.format='mp4';
  if(!['1920x1080','1280x720'].includes(result.resolution)) result.resolution='1920x1080';
  if(!['Georgia','Arial','Times New Roman','Verdana','Courier New','Cinzel','Inter'].includes(result.font)) result.font='Georgia';
  if(!['left','center','right'].includes(result.align)) result.align='center';
  if(!/^#[0-9a-f]{6}$/i.test(result.textColor)) result.textColor='#ffffff';
  if(!/^#[0-9a-f]{6}$/i.test(result.headingColor)) result.headingColor='#ffffff';
  if(!/^#[0-9a-f]{6}$/i.test(result.backgroundColor)) result.backgroundColor='#000000';
  result.text=result.text.slice(0,250000);
  return result;
}
function syncControls() {
  $('credits-text').value=state.text;
  for (const [key,id] of Object.entries(IDS)) {
    const el=$(id);
    if(el.type==='checkbox')el.checked=state[key];
    else el.value=String(state[key]);
  }
  ['max-width','horizontal-position','overlay'].forEach(id => {
    $(id+'-value').textContent=$(id).value+'%';
  });
  $('render-info').textContent=state.resolution.replace('x',' × ')+' · '+state.fps+' FPS';
  $('background-note').textContent=background?'Background image selected (local).':'No background image selected. Images stay on this device.';
}
function fontSpec(s,size,heading) {
  return (heading && s.boldHeadings?'700':'400')+' '+size+'px "'+s.font+'", Georgia, serif';
}
function wrapLine(context,text,maxWidth) {
  if(!text)return [''];
  const parts=text.match(/\S+|\s+/gu)||[''];
  const rows=[];
  let current='';
  const splitLong=(word) => {
    let segment='';
    for(const ch of Array.from(word)) {
      if(segment && context.measureText(segment+ch).width>maxWidth) {
        rows.push(segment);segment=ch;
      } else segment+=ch;
    }
    return segment;
  };
  for (const part of parts) {
    if(/^\s+$/u.test(part)) {
      if(current && context.measureText(current+part).width<=maxWidth) current+=part;
      continue;
    }
    const candidate=current+part;
    if(context.measureText(candidate).width<=maxWidth) {
      current=candidate;
    } else {
      if(current) rows.push(current.replace(/\s+$/u,''));
      current=context.measureText(part).width>maxWidth?splitLong(part):part;
    }
  }
  if(current)rows.push(current.replace(/\s+$/u,''));
  return rows.length?rows:[''];
}
function makeLayout(s) {
  const context=measureCtx;
  const width=W*s.maxWidth/100;
  const minX=W*.05, left=clamp(W*s.horizontalPosition/100-width/2,minX,W-minX-width);
  const textX=s.align==='left'?left:s.align==='right'?left+width:left+width/2;
  const lines=s.text.replace(/\r\n?/g,'\n').split('\n');
  const entries=[];
  let y=0;
  lines.forEach((original,index)=>{
    let text=original, heading=0;
    if(/^##\s+/u.test(text)){heading=2;text=text.replace(/^##\s+/u,'');}
    else if(/^#\s+/u.test(text)){heading=1;text=text.replace(/^#\s+/u,'');}
    const fontSize=heading?s.headingSize*(heading===1?1.14:1):s.fontSize;
    if(heading && entries.length)y+=s.headingSpacing;
    if(text==='') {
      y+=s.fontSize*s.lineHeight+s.paragraphSpacing;
      return;
    }
    context.font=fontSpec(s,fontSize,heading>0);
    for(const row of wrapLine(context,text,width)){
      entries.push({text:row,y:y+fontSize,fontSize,heading:heading>0,x:textX});
      y+=fontSize*s.lineHeight;
    }
    if(heading)y+=s.headingSpacing*.25;
  });
  return {entries,height:Math.max(y,0),width,travel:H+Math.max(y,0)};
}
function getTotal(s) {return s.openingDelay+s.scrollDuration+s.endingDelay;}
function renderAt(targetCtx,s,l,t,img) {
  const dest=targetCtx.canvas;
  targetCtx.save();
  targetCtx.setTransform(dest.width/W,0,0,dest.height/H,0,0);
  targetCtx.fillStyle=s.backgroundColor;
  targetCtx.fillRect(0,0,W,H);
  if(img && img.complete && img.naturalWidth) {
    const scale=Math.max(W/img.naturalWidth,H/img.naturalHeight);
    const iw=img.naturalWidth*scale, ih=img.naturalHeight*scale;
    targetCtx.drawImage(img,(W-iw)/2,(H-ih)/2,iw,ih);
    if(s.overlay>0) {
      targetCtx.fillStyle='rgba(0,0,0,'+(s.overlay/100)+')';
      targetCtx.fillRect(0,0,W,H);
    }
  }
  const p=clamp((t-s.openingDelay)/s.scrollDuration,0,1);
  const top=H-l.travel*p;
  const total=getTotal(s);
  let opacity=1;
  if(s.fadeIn>0)opacity=Math.min(opacity,clamp(t/s.fadeIn,0,1));
  if(s.fadeOut>0)opacity=Math.min(opacity,clamp((total-t)/s.fadeOut,0,1));
  targetCtx.globalAlpha=clamp(opacity,0,1);
  targetCtx.textAlign=s.align;
  targetCtx.textBaseline='alphabetic';
  for(const row of l.entries){
    const base=top+row.y;
    if(base < -row.fontSize || base>H+row.fontSize)continue;
    targetCtx.font=fontSpec(s,row.fontSize,row.heading);
    targetCtx.fillStyle=row.heading?s.headingColor:s.textColor;
    targetCtx.fillText(row.text,row.x,base);
  }
  targetCtx.restore();
}
function frame() {
  if(!layout)layout=makeLayout(state);
  renderAt(ctx,state,layout,currentTime,background);
  const total=getTotal(state);
  $('seek').value=Math.round(clamp(currentTime/Math.max(total,.1),0,1)*1000);
  $('timecode').textContent=fmt(currentTime)+' / '+fmt(total);
}
function setTime(t) {
  currentTime=clamp(t,0,getTotal(state));
  frame();
}
function stopPlayback() {
  isPlaying=false;
  if(raf)cancelAnimationFrame(raf);
  raf=0;
  $('play').textContent='▶ Play';
}
function tick() {
  if(!isPlaying)return;
  const t=(performance.now()-playbackStart)/1000;
  setTime(t);
  if(t>=getTotal(state)){stopPlayback();return;}
  raf=requestAnimationFrame(tick);
}
function updateDerived() {
  layout=makeLayout(state);
  const distance=layout.travel;
  state.scrollDuration=clamp(state.scrollDuration,.1,7200);
  state.scrollSpeed=distance/state.scrollDuration;
  $('scroll-duration').value=Number(state.scrollDuration.toFixed(2));
  $('scroll-speed').value=Number(state.scrollSpeed.toFixed(2));
  $('duration-info').textContent='Total duration: '+fmt(getTotal(state));
  $('travel-info').textContent=Math.ceil(distance)+' px · '+layout.entries.length+' rendered lines';
  const length=state.text?state.text.replace(/\r\n?/g,'\n').split('\n').length:0;
  $('text-stats').textContent=length+' lines · '+state.text.length+' characters';
  const [w,h]=state.resolution.split('x').map(Number);
  $('render-info').textContent=w+' × '+h+' · '+state.fps+' FPS';
  $('size-estimate').textContent='Estimated size: ≈ '+(getTotal(state)*bitrate(state)/8/1048576).toFixed(1)+' MiB (approx.)';
  if(currentTime>getTotal(state))currentTime=getTotal(state);
  frame();
}
function bitrate(s) {return s.resolution==='1920x1080'?6000000:3500000;}
function loadImage(src) {
  return new Promise((resolve,reject)=>{
    if(!src){resolve(null);return;}
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error('Background image could not be decoded.'));
    img.src=src;
  });
}
async function restore(next) {
  stopPlayback();
  state=safeProject(next);
  try { background=await loadImage(state.backgroundSrc); }
  catch(err){background=null;state.backgroundSrc='';message(err.message,'error');}
  syncControls();currentTime=0;updateDerived();persist();
}
function blobDownload(blob,filename) {
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function importText(file) {
  if(!file)return;
  if(file.size>3000000){message('Text file exceeds 3 MB.','error');return;}
  state.text=await file.text();
  $('credits-text').value=state.text;stopPlayback();currentTime=0;updateDerived();persist();
  message('Imported '+file.name+'.');
}
function sanitizedName(name){
  return String(name||'credits-roll').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/^\.+/,'').trim().slice(0,100)||'credits-roll';
}
function getEngine(){
  if(!enginePromise)enginePromise=import('https://esm.sh/mediabunny@1.62.1?bundle').catch(err=>{enginePromise=null;throw err;});
  return enginePromise;
}
async function encoderProfile(lib,s) {
  const [width,height]=s.resolution.split('x').map(Number);
  const quality=new lib.Quality({bitrate:bitrate(s)});
  if(s.format==='mp4'){
    if(!(await lib.canEncodeVideo('avc',{width,height,frameRate:s.fps,quality}))) {
      throw new Error('H.264 MP4 encoding is unavailable for '+width+'×'+height+' at '+s.fps+' FPS in this browser. Select WebM or try a different resolution/frame rate.');
    }
    return {codec:'avc',quality};
  }
  for(const codec of ['vp9','vp8']){
    if(await lib.canEncodeVideo(codec,{width,height,frameRate:s.fps,quality})) return {codec,quality};
  }
  throw new Error('Neither VP9 nor VP8 video encoding is supported for these settings in this browser.');
}
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
function progress(i,total,s) {
  $('export-progress').value=i/total*100;
  $('frame-progress').textContent='Frame '+i.toLocaleString()+' / '+total.toLocaleString();
  if(i>0)message('Rendering '+s.format.toUpperCase()+' · '+Math.round(i/total*100)+'%');
}
async function exportVideo(){
  if(exporting)return;
  if(!state.text.trim()){message('Paste or import your credits before exporting.','error');return;}
  const snapshot=safeProject(state);
  const frozenLayout=makeLayout(snapshot), frozenImage=background;
  const [width,height]=snapshot.resolution.split('x').map(Number);
  const totalTime=getTotal(snapshot), frames=Math.max(1,Math.ceil(totalTime*snapshot.fps));
  const filename=sanitizedName(snapshot.filename)+'.'+snapshot.format;
  const direct=$('direct-save').checked && typeof window.showSaveFilePicker==='function';
  let writable=null, output=null;
  exporting=true;exportCanceled=false;
  $('export').disabled=true;$('cancel-export').hidden=false;
  $('export-progress').hidden=false;$('export-progress').value=0;
  progress(0,frames,snapshot);
  try{
    // File picker must happen directly within the export click gesture.
    if(direct){
      let handle;
      try {
        handle=await window.showSaveFilePicker({
          suggestedName:filename,
          types:[{description:snapshot.format.toUpperCase()+' video',accept:{[snapshot.format==='mp4'?'video/mp4':'video/webm']:['.'+snapshot.format]}}]
        });
      }catch(err){
        if(err.name==='AbortError'){message('Export cancelled before rendering.');return;}
        throw err;
      }
      writable=await handle.createWritable();
    }
    message('Checking codec and preparing video encoder…');
    const lib=await getEngine();
    const profile=await encoderProfile(lib,snapshot);
    if(exportCanceled)throw new Error('Export cancelled.');
    const target=writable?new lib.StreamTarget(writable,{chunked:true}):new lib.BufferTarget();
    output=new lib.Output({
      format:snapshot.format==='mp4'?new lib.Mp4OutputFormat():new lib.WebMOutputFormat(),
      target
    });
    exportOutput=output;
    const exportCanvas=document.createElement('canvas');
    exportCanvas.width=width;exportCanvas.height=height;
    const exportCtx=exportCanvas.getContext('2d',{alpha:false});
    if(!exportCtx)throw new Error('Could not create the export canvas.');
    const src=new lib.CanvasSource(exportCanvas,{codec:profile.codec,quality:profile.quality});
    output.addVideoTrack(src,{frameRate:snapshot.fps});
    await output.start();
    for(let i=0;i<frames;i++){
      if(exportCanceled)throw new Error('Export cancelled.');
      const t=i/snapshot.fps;
      renderAt(exportCtx,snapshot,frozenLayout,t,frozenImage);
      await src.add(t,1/snapshot.fps);
      if(i%12===0 || i===frames-1){
        progress(i+1,frames,snapshot);
        await yieldUI();
      }
    }
    src.close();
    message('Finishing '+snapshot.format.toUpperCase()+' video file…');
    await output.finalize();
    if(writable){
      writable=null; // StreamTarget closes the writable when finalized.
      message('Video successfully encoded and saved: '+filename,'success');
    }else{
      const buffer=output.target.buffer;
      if(!buffer || !buffer.byteLength)throw new Error('Encoder returned an empty video.');
      const blob=new Blob([buffer],{type:snapshot.format==='mp4'?'video/mp4':'video/webm'});
      blobDownload(blob,filename);
      message('Video successfully encoded ('+(blob.size/1048576).toFixed(1)+' MiB). Download started: '+filename,'success');
    }
    $('export-progress').value=100;
  }catch(err){
    if(output && output.state!=='finalized' && output.state!=='canceled'){
      try{await output.cancel();}catch(ignore){console.warn('Could not cancel output cleanly:',ignore);}
    }
    if(writable){try{await writable.abort();}catch(ignore){/* Already closed */}}
    if(exportCanceled || err.message==='Export cancelled.')message('Video export cancelled. No completed file was produced.');
    else {console.error(err);message('Export failed: '+(err.message||String(err)),'error');}
  }finally{
    exportOutput=null;exporting=false;exportCanceled=false;
    $('export').disabled=false;$('cancel-export').hidden=true;
  }
}
function wire() {
  $('credits-text').addEventListener('input',()=>{
    state.text=$('credits-text').value;
    stopPlayback();currentTime=0;updateDerived();persist();
  });
  for(const [key,id] of Object.entries(IDS)){
    const el=$(id);
    el.addEventListener('input',()=>{
      const val=el.type==='checkbox'?el.checked:NUMBERS.has(key)?Number(el.value):el.value;
      if(NUMBERS.has(key) && !Number.isFinite(val))return;
      if(key==='scrollSpeed'){
        const speed=Math.max(1,Number(val));
        state.scrollDuration=clamp((layout||makeLayout(state)).travel/speed,.1,7200);
      }else state[key]=val;
      if(key==='maxWidth'||key==='horizontalPosition'||key==='overlay') $(id+'-value').textContent=String(val)+'%';
      if(key==='resolution'){} // Reference-space layout remains resolution-independent.
      stopPlayback();currentTime=0;updateDerived();persist();
    });
  }
  $('import-text').addEventListener('click',()=>$('text-file').click());
  $('text-file').addEventListener('change',async e=>{
    try{await importText(e.target.files[0]);}catch(err){message('Text import failed: '+err.message,'error');}
    e.target.value='';
  });
  $('load-sample').addEventListener('click',()=>{
    if(state.text.trim()&&!confirm('Replace your current credits with the example?'))return;
    state.text=SAMPLE;$('credits-text').value=SAMPLE;
    stopPlayback();currentTime=0;updateDerived();persist();message('Sample historical credits loaded. Replace with your own references before publishing.');
  });
  $('clear-text').addEventListener('click',()=>{
    if(state.text && !confirm('Clear the credits text?'))return;
    state.text='';$('credits-text').value='';stopPlayback();currentTime=0;updateDerived();persist();
  });
  $('upload-background').addEventListener('click',()=>$('background-file').click());
  $('background-file').addEventListener('change',e=>{
    const file=e.target.files[0];if(!file)return;
    if(!file.type.startsWith('image/')){message('Choose an image file.','error');return;}
    if(file.size>5*1048576){message('Choose an image smaller than 5 MiB for reliable browser storage.','error');return;}
    const reader=new FileReader();
    reader.onload=async()=>{
      try{
        const src=String(reader.result);
        const img=await loadImage(src);
        background=img;state.backgroundSrc=src;
        syncControls();updateDerived();persist();message('Background image loaded.');
      }catch(err){message(err.message,'error');}
    };
    reader.readAsDataURL(file);e.target.value='';
  });
  $('remove-background').addEventListener('click',()=>{
    background=null;state.backgroundSrc='';syncControls();updateDerived();persist();
  });
  $('play').addEventListener('click',()=>{
    if(isPlaying){stopPlayback();return;}
    if(currentTime>=getTotal(state))currentTime=0;
    isPlaying=true;playbackStart=performance.now()-currentTime*1000;
    $('play').textContent='❚❚ Pause';raf=requestAnimationFrame(tick);
  });
  $('restart').addEventListener('click',()=>{
    stopPlayback();setTime(0);
  });
  $('seek').addEventListener('input',()=>{
    setTime(Number($('seek').value)/1000*getTotal(state));
    if(isPlaying)playbackStart=performance.now()-currentTime*1000;
  });
  $('fullscreen').addEventListener('click',()=>{
    if(document.fullscreenElement)document.exitFullscreen();
    else $('preview').requestFullscreen?.().catch(err=>message('Fullscreen unavailable: '+err.message,'error'));
  });
  $('restore-preset').addEventListener('click',async()=>{
    const text=state.text;await restore({...PRESET,text});
    message('Classic Credits preset restored. Your credits text was preserved.');
  });
  $('reset-all').addEventListener('click',async()=>{
    if(!confirm('Reset all credits text, background and settings?'))return;
    await restore(PRESET);message('Credits Roll reset.');
  });
  $('download-project').addEventListener('click',()=>{
    blobDownload(new Blob([JSON.stringify({app:'organon-credits-roll',version:1,settings:state},null,2)],{type:'application/json'}),sanitizedName(state.filename)+'.json');
    message('Project JSON download started.');
  });
  $('import-project').addEventListener('click',()=>$('project-file').click());
  $('project-file').addEventListener('change',async e=>{
    try{
      const file=e.target.files[0];if(!file)return;
      if(file.size>10*1048576)throw new Error('Project file is larger than 10 MiB.');
      const parsed=JSON.parse(await file.text());
      if(parsed.app!=='organon-credits-roll'||!parsed.settings)throw new Error('File is not a Credits Roll project.');
      if(state.text.trim()&&!confirm('Replace the current credits and settings with this project?'))return;
      await restore(parsed.settings);message('Project imported: '+file.name);
    }catch(err){message('Project import failed: '+err.message,'error');}
    finally{e.target.value='';}
  });
  $('export').addEventListener('click',exportVideo);
  $('cancel-export').addEventListener('click',()=>{
    exportCanceled=true;
    message('Cancelling after the current frame…');
  });
  if(typeof window.showSaveFilePicker!=='function'){
    $('direct-save').disabled=true;
    $('direct-save').parentElement.title='Direct-to-file saving requires the File System Access API in a supported browser.';
  }
  window.addEventListener('beforeunload',()=>{
    stopPlayback();
    if(exporting)exportCanceled=true;
  });
}
async function init(){
  try{
    const saved=localStorage.getItem(STORE);
    if(saved)state=safeProject(JSON.parse(saved));
  }catch(e){console.warn('Could not restore local project:',e);}
  try {background=await loadImage(state.backgroundSrc);}
  catch(e){background=null;state.backgroundSrc='';}
  wire();syncControls();
  try {await document.fonts.ready;}catch(e){/* Font fallback remains valid */ }
  updateDerived();message('Ready. Paste credits or select Sample. MP4 export uses browser H.264 support.');
}
init();
