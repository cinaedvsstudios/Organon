(() => {
  'use strict';
  if (!document.body.classList.contains('is-advanced-mode')) return;

  const replace = (id) => {
    const original = document.getElementById(id);
    if (!original || original.dataset.advancedIsolated === 'true') return original;
    const copy = original.cloneNode(true);
    copy.dataset.advancedIsolated = 'true';
    original.replaceWith(copy);
    return copy;
  };

  ['image-picker', 'video-picker', 'queue-card', 'adjust-card', 'settings-card', 'advanced-webp-card', 'output-card', 'preview-modal', 'anim-preview-modal', 'align-modal', 'frame-editor-modal'].forEach(replace);

  const topPanel = document.getElementById('top-panel');
  if (topPanel) {
    const label = topPanel.querySelector('#upload-label');
    const imagePicker = document.getElementById('image-picker');
    if (label && imagePicker) label.htmlFor = imagePicker.id;
  }

  document.querySelectorAll('.bottom-sticky-panel button').forEach((button) => {
    if (!button.dataset.advancedIsolated) {
      const copy = button.cloneNode(true);
      copy.dataset.advancedIsolated = 'true';
      button.replaceWith(copy);
    }
  });
})();