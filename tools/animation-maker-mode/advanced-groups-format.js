(() => {
  'use strict';
  if (!document.body.classList.contains('is-advanced-mode')) return;

  const initialise = () => {
    const format = document.getElementById('opt-format');
    if (!format) return false;
    if (!format.querySelector('option[value="webp"]')) format.insertAdjacentHTML('beforeend', '<option value="webp">WebP (Animated)</option>');
    if (!format.querySelector('option[value="zip"]')) format.insertAdjacentHTML('beforeend', '<option value="zip">PNG Frames ZIP</option>');

    const update = () => {
      const webp = format.value === 'webp';
      const zip = format.value === 'zip';
      const card = document.getElementById('advanced-webp-card');
      const gifSettings = document.getElementById('gif-specific-settings');
      const overlay = document.getElementById('webp-overlay');
      const playText = document.getElementById('play-btn-text');
      if (card) card.hidden = !webp;
      if (overlay) overlay.hidden = !webp;
      if (gifSettings) { gifSettings.style.opacity = webp || zip ? '.38' : '1'; gifSettings.style.pointerEvents = webp || zip ? 'none' : 'auto'; }
      if (playText) playText.textContent = webp ? 'PLAY WebP' : zip ? 'PLAY FRAMES' : 'PLAY GIF';
    };

    format.addEventListener('change', update);
    update();
    return true;
  };

  if (initialise()) return;
  const timer = window.setInterval(() => { if (initialise()) window.clearInterval(timer); }, 25);
})();