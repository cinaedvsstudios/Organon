(() => {
  'use strict';
  if (!document.body.classList.contains('is-advanced-mode')) return;

  const settings = document.querySelector('#settings-card h3');
  const webp = document.querySelector('#advanced-webp-card h3');
  const output = document.querySelector('#output-card h3');

  if (settings) settings.textContent = '5. Animation Settings';
  if (webp) webp.textContent = '6. WebP Advanced Settings';
  if (output) output.textContent = '7. Synthesized Core Output';
})();
