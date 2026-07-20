(() => {
  'use strict';
  const button = document.getElementById('ag-mode-switch');
  if (!button) return;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    location.href = '../animation-maker-standard/index.html?v=0.05';
  }, true);
})();