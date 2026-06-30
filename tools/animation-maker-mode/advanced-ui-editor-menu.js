(() => {
  'use strict';
  const api=window.AdvancedAnimationMaker;
  if(!api)return;
  const $=(id)=>document.getElementById(id),header=api.ui.editorWindow.querySelector('.editor-header');
  if($('ag-editor-menu'))return;
  const menu=document.createElement('div');
  menu.id='ag-editor-menu';
  menu.className='advanced-editor-menu';
  menu.innerHTML='<button type="button" class="active" data-ag-mode="edit">EDIT</button><button type="button" data-ag-mode="paint">PAINT</button><button type="button" data-ag-mode="select">SELECT</button><button type="button" data-ag-mode="effects">EFFECTS</button><button type="button" data-ag-mode="animations">ANIMATIONS</button>';
  header.querySelector('h2')?.insertAdjacentElement('afterend',menu);
  menu.addEventListener('click',(event)=>{const mode=event.target.closest('[data-ag-mode]')?.dataset.agMode;if(mode)api.setEditorMode(mode);});
})();