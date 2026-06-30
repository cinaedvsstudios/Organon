(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const {state,$,makeCanvas,uid}=E;
  E.exportName=()=>`animation-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}`;
  E.renderAll=()=>{E.renderGroups();if(state.mode==='effects')E.renderEffects();if(state.mode==='animations')E.renderAnimationTargets?.();E.renderCanvas();};
  E.importVideo=async(file)=>{if(!file)return;const group=E.group()||E.addGroup('Group 1'),url=URL.createObjectURL(file),video=document.createElement('video');video.muted=true;video.playsInline=true;video.src=url;try{await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=reject;video.load();});const fps=12,count=Math.max(1,Math.min(240,Math.floor(video.duration*fps))),canvas=makeCanvas(video.videoWidth,video.videoHeight),c=canvas.getContext('2d'),frames=[];E.status(`Extracting ${count} video frames...`);for(let index=0;index<count;index+=1){await new Promise((resolve)=>{video.onseeked=resolve;video.currentTime=Math.min(index/fps,Math.max(0,video.duration-.01));});c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(video,0,0);const working=canvas.toDataURL('image/png');frames.push({id:uid('frame'),name:`${file.name} ${index+1}`,source:working,working,width:canvas.width,height:canvas.height,offsetX:0,offsetY:0});}group.frames.push(...frames);state.activeGroupId=group.id;state.activeFrameId=frames[0]?.id||state.activeFrameId;E.status(`${frames.length} video frames added to ${group.name}.`);E.renderAll();}catch(error){E.status('Video extraction failed.');}finally{URL.revokeObjectURL(url);video.remove();}};
  $('ag-video').addEventListener('change',(event)=>{E.importVideo(event.target.files[0]).finally(()=>{event.target.value='';});});
  document.addEventListener('dragover',(event)=>{const files=[...(event.dataTransfer?.files||[])];if(!files.some((file)=>file.type.startsWith('image/')))return;event.preventDefault();document.querySelector('.ag-app').classList.add('ag-drop-active');});
  document.addEventListener('dragleave',()=>document.querySelector('.ag-app')?.classList.remove('ag-drop-active'));
  document.addEventListener('drop',(event)=>{const files=[...(event.dataTransfer?.files||[])];if(!files.some((file)=>file.type.startsWith('image/')))return;event.preventDefault();document.querySelector('.ag-app')?.classList.remove('ag-drop-active');E.importImages(files,state.activeGroupId);});
  document.addEventListener('paste',(event)=>{if(document.activeElement?.matches('input,textarea,select'))return;const files=[...(event.clipboardData?.files||[])].filter((file)=>file.type.startsWith('image/'));if(!files.length)return;event.preventDefault();E.importImages(files,state.activeGroupId);});
  E.renderAll();
})();