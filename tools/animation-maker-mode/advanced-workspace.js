(() => {
  if (!document.body.classList.contains('is-advanced-mode')) return;
  const byId = (id) => document.getElementById(id);
  const queue = byId('queue-card');
  const modal = byId('frame-editor-modal');
  const windowEl = byId('editor-window');
  if (!queue || !modal || !windowEl) return;

  ['queue-card','advanced-webp-card','output-card'].forEach((id) => {
    const element = byId(id);
    if (element) element.hidden = false;
  });

  const names = {
    'queue-card':'1. Frames & Sequence',
    'adjust-card':'3. Visual Adjustments',
    'settings-card':'5. Animation Settings',
    'advanced-webp-card':'6. WebP Advanced Settings',
    'output-card':'7. Synthesized Core Output'
  };
  Object.entries(names).forEach(([id,name]) => {
    const heading = byId(id)?.querySelector('h3');
    if (heading) heading.textContent = name;
  });

  let card = byId('advanced-editor-card');
  if (!card) {
    card = document.createElement('section');
    card.id = 'advanced-editor-card';
    card.className = 'config-card advanced-editor-card';
    card.innerHTML = '<div class="advanced-card-heading"><h3>2. Frame Editor</h3></div><div class="advanced-inline-editor-host"></div>';
    queue.insertAdjacentElement('afterend', card);
  }
  const host = card.querySelector('.advanced-inline-editor-host');
  if (host && !host.contains(windowEl)) host.appendChild(windowEl);
  modal.hidden = false;
  modal.classList.add('advanced-inline-editor');
  windowEl.querySelector('.editor-close')?.setAttribute('hidden','');
  windowEl.querySelector('.editor-footer [data-close="frame-editor-modal"]')?.setAttribute('hidden','');
  byId('open-editor-btn')?.click();
})();