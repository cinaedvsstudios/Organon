(() => {
  'use strict';
  if (!document.body.classList.contains('is-advanced-mode')) return;

  const start = () => {
    const edit = document.querySelector('#ag-v2-editor-menu [data-ag-v2-mode="edit"]');
    if (!edit) return false;
    edit.click();
    return true;
  };

  if (start()) return;
  const timer = window.setInterval(() => {
    if (start()) window.clearInterval(timer);
  }, 25);
})();
