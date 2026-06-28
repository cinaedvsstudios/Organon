(() => {
  'use strict';
  if (!document.body.classList.contains('is-advanced-mode')) return;

  const canvas = document.getElementById('frame-editor-canvas');
  if (!canvas) return;

  /* The main advanced workspace owns the selection implementation. This listener is intentionally
     kept empty until the next editor pass so no duplicate pointer handler alters selections. */
})();
