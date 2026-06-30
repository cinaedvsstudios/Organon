(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const {$}=E;
  const save=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000);};
  E.saveBlob=save;
  E.exportZip=async()=>{const frames=await E.outputFrames();if(!frames.length)return E.status('Import frames before exporting.');if(!window.JSZip)return E.status('ZIP support is unavailable.');const zip=new JSZip(),folder=zip.folder(`${E.exportName()}-frames`),digits=Math.max(3,String(frames.length).length);for(let index=0;index<frames.length;index+=1){const blob=await new Promise((resolve)=>frames[index].toBlob(resolve,'image/png'));folder.file(`frame-${String(index+1).padStart(digits,'0')}.png`,blob);}save(await zip.generateAsync({type:'blob'}),`${E.exportName()}-frames.zip`);E.status('PNG frame ZIP saved.');};
  E.exportGif=async()=>{const frames=await E.outputFrames();if(!frames.length)return E.status('Import frames before exporting.');if(!window.gifshot)return E.status('GIF support is unavailable.');E.status('Building GIF...');window.gifshot.createGIF({images:frames.map((frame)=>frame.toDataURL('image/png')),interval:E.frameDelay(frames.length)/1000,gifWidth:frames[0].width,gifHeight:frames[0].height,numWorkers:2,sampleInterval:10},(result)=>{if(result.error){E.status('GIF export failed.');return;}const binary=atob(result.image.split(',')[1]),bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index+=1)bytes[index]=binary.charCodeAt(index);save(new Blob([bytes],{type:'image/gif'}),`${E.exportName()}.gif`);E.status('GIF saved.');});};
  $('ag-zip').addEventListener('click',E.exportZip);
  $('ag-preview').addEventListener('click',E.preview);
})();