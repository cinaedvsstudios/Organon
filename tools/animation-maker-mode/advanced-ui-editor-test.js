(() => {
  'use strict';
  const api = window.AdvancedAnimationMaker;
  if (!api) return;
  const nav = api.ui.editorWindow.querySelector('.editor-nav');
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'ag-test-clear';
  button.textContent = 'CLEAR';
  button.addEventListener('click', api.clearFrame);
  nav.appendChild(button);
})();