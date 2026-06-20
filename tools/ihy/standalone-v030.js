(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const modal = $('#quickPlaceholderModal');
  const title = $('#quickPlaceholderTitle');
  const body = $('#quickPlaceholderBody');
  const close = $('#quickPlaceholderClose');

  if (!modal || !title || !body || !close) return;

  const show = (heading, copy) => {
    title.textContent = heading;
    body.textContent = copy;
    modal.hidden = false;
    close.focus();
  };

  const hide = () => {
    modal.hidden = true;
  };

  const bind = (id, heading, copy) => {
    const button = $(id);
    if (!button) return;

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      show(heading, copy);
    }, true);
  };

  bind(
    '#quickBass',
    '＋ Bass',
    'Bass quick-add is a placeholder for now. It will generate a bass pattern on the armed bass track using the selected key, tempo and section length.'
  );

  bind(
    '#quickMotif',
    '＋ Motif',
    'Motif quick-add is a placeholder for now. It will generate a short melodic phrase on the armed track using the selected key, tempo and section length.'
  );

  close.addEventListener('click', hide);

  modal.addEventListener('click', event => {
    if (event.target === modal) hide();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) hide();
  });
})();