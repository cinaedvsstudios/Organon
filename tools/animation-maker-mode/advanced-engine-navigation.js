(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const {state,$}=E;
  const step=(amount)=>{const g=E.group();if(!g?.frames.length)return;const index=Math.max(0,g.frames.findIndex((f)=>f.id===state.activeFrameId));const next=(index+amount+g.frames.length)%g.frames.length;state.activeFrameId=g.frames[next].id;state.timelineIndex=next;state.editCache=null;E.renderAll();};
  $('ag-prev').addEventListener('click',()=>step(-1));
  $('ag-next').addEventListener('click',()=>step(1));
  document.querySelectorAll('[data-view]').forEach((button)=>button.addEventListener('click',()=>{state.view=button.dataset.view;document.querySelectorAll('[data-view]').forEach((item)=>item.classList.toggle('active',item===button));E.renderCanvas();}));
  $('ag-play').addEventListener('click',()=>{if(state.playTimer){window.clearInterval(state.playTimer);state.playTimer=null;$('ag-play').textContent='▶ PLAY';return;}$('ag-play').textContent='❚❚ PAUSE';state.playTimer=window.setInterval(()=>step(1),Number($('ag-delay').value));});
  $('ag-paste-group').addEventListener('click',async()=>{try{const result=await E.clipboardImage();const ext=result.type.split('/')[1]||'png';E.importImages([new File([result.blob],`clipboard-frame-${Date.now()}.${ext}`,{type:result.type})],state.activeGroupId);}catch(error){E.status(error.message);}});
})();