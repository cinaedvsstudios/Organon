(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const {state,$}=E;
  const open=async(type)=>{const base=await E.editable();if(!base)return;state.transform={type,base:E.copyCanvas(base)};const slider=$('ag-transform-slider');$('ag-transform').hidden=false;if(type==='scale'){$('ag-transform-title').textContent=state.selection.active?'SCALE SELECTION':'SCALE FRAME';slider.min='10';slider.max='300';slider.value='100';$('ag-transform-output').textContent='100%';}else{$('ag-transform-title').textContent=state.selection.active?'ROTATE SELECTION':'ROTATE FRAME';slider.min='-180';slider.max='180';slider.value='0';$('ag-transform-output').textContent='0°';}E.renderCanvas();};
  const close=(apply)=>{if(!state.transform)return;if(apply){E.snapshot();E.commit(E.transformCanvas(state.transform.base,state.transform.type,Number($('ag-transform-slider').value)),state.transform.type==='scale'?'Scale applied.':'Rotation applied.');}state.transform=null;$('ag-transform').hidden=true;E.renderCanvas();};
  $('ag-scale').addEventListener('click',()=>open('scale'));
  $('ag-rotate').addEventListener('click',()=>open('rotate'));
  $('ag-undo').addEventListener('click',E.undo);
  $('ag-realign').addEventListener('click',()=>{const f=E.frame();if(!f)return;f.offsetX=0;f.offsetY=0;state.editCache=null;E.status('Current frame realigned.');E.renderAll();});
  $('ag-transform-slider').addEventListener('input',(event)=>{$('ag-transform-output').textContent=state.transform?.type==='scale'?`${event.target.value}%`:`${event.target.value}°`;E.renderCanvas();});
  $('ag-transform-apply').addEventListener('click',()=>close(true));
  $('ag-transform-cancel').addEventListener('click',()=>close(false));
})();