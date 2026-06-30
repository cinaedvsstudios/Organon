(() => {
  'use strict';
  const api=window.AdvancedAnimationMaker;
  if(!api)return;
  const $=(id)=>document.getElementById(id),{ui}=api;
  api.installEditorMount=()=>{let card=$('advanced-editor-card');if(!card){card=document.createElement('section');card.id='advanced-editor-card';card.className='config-card advanced-editor-card';card.innerHTML='<div class="advanced-card-heading"><h3>2. Frame Editor</h3></div><div class="advanced-inline-editor-host"></div>';ui.queue.insertAdjacentElement('afterend',card);}const host=card.querySelector('.advanced-inline-editor-host');if(!host.contains(ui.editorWindow))host.appendChild(ui.editorWindow);ui.editorModal.hidden=false;ui.editorModal.classList.add('advanced-inline-editor');ui.editorWindow.querySelector('.editor-close')?.setAttribute('hidden','');ui.editorWindow.querySelector('.editor-footer')?.setAttribute('hidden','');};
})();