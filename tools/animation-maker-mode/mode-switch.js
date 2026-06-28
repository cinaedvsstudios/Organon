(() => {
  'use strict';

  const isAdvanced = new URLSearchParams(location.search).get('mode') === 'advanced';
  const title = document.querySelector('.title-left span');
  const modeButton = document.getElementById('btn-animation-mode');

  document.body.classList.toggle('is-advanced-mode', isAdvanced);
  document.body.dataset.animationMakerMode = isAdvanced ? 'advanced' : 'standard';
  document.title = isAdvanced ? 'Organon - Animation Maker Advanced' : 'Organon - Animation Maker';

  if (title) title.textContent = isAdvanced ? 'ANIMATION MAKER — ADVANCED' : 'ANIMATION MAKER';

  if (modeButton) {
    modeButton.textContent = isAdvanced ? 'STANDARD MODE' : 'ADVANCED MODE';
    modeButton.addEventListener('click', () => {
      location.href = isAdvanced ? './index.html' : '../animation-maker-advanced/index.html';
    });
  }

  const loadScript = (src, onload) => {
    const script = document.createElement('script');
    script.src = src;
    script.addEventListener('load', onload, { once: true });
    document.head.append(script);
  };

  loadScript('../animation-maker-mode/webp-export.js', () => {
    if (!isAdvanced) return;

    loadScript('../animation-maker-mode/advanced-workspace.js', () => {
      loadScript('../animation-maker-mode/advanced-effects.js', () => {
        loadScript('../animation-maker-mode/advanced-effects-layout.js', () => {});
      });
    });
  });
})();
