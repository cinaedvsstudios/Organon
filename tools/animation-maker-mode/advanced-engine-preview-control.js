(() => {
  'use strict';
  const E=window.OrganonAnimationAdvanced;
  if(!E)return;
  const {state}=E;
  const previewButton=document.getElementById('ag-preview');
  const outputHost=document.getElementById('ag-output-preview');
  const reset=()=>{outputHost.innerHTML='<span>OUTPUT PREVIEW</span>';previewButton.textContent='PLAY PREVIEW';};
  E.stopPreview=()=>{state.previewToken=(state.previewToken||0)+1;if(state.previewTimer)window.clearTimeout(state.previewTimer);state.previewTimer=null;state.previewBuilding=false;reset();};
  E.preview=async()=>{if(state.previewBuilding||state.previewTimer){E.stopPreview();E.status('Preview stopped.');return;}const token=(state.previewToken||0)+1;state.previewToken=token;state.previewBuilding=true;previewButton.textContent='STOP PREVIEW';try{const frames=await E.outputFrames();if(state.previewToken!==token)return;if(!frames.length){reset();return E.status('Import frames before previewing.');}outputHost.innerHTML='';const image=document.createElement('img');outputHost.appendChild(image);let index=0;const delay=E.frameDelay(frames.length);const tick=()=>{if(state.previewToken!==token||!outputHost.isConnected)return;image.src=frames[index].toDataURL('image/png');index=(index+1)%frames.length;state.previewTimer=window.setTimeout(tick,delay);};state.previewBuilding=false;state.previewTimer=-1;tick();E.status(`Previewing ${frames.length} composited frames.`);}catch(error){if(state.previewToken===token){state.previewBuilding=false;state.previewTimer=null;reset();E.status(`Preview failed: ${error.message}`);}}};
})();