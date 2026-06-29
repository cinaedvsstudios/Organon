(() => {
  'use strict';

  const advancedRequested = new URLSearchParams(location.search).get('mode') === 'advanced';
  if (advancedRequested) {
    location.replace('../animation-maker-advanced/advanced.html');
    return;
  }

  const title = document.querySelector('.title-left span');
  const modeButton = document.getElementById('btn-animation-mode');
  document.body.dataset.animationMakerMode = 'standard';
  document.title = 'Organon - Animation Maker';
  if (title) title.textContent = 'ANIMATION MAKER';

  if (modeButton) {
    modeButton.textContent = 'ADVANCED MODE';
    modeButton.addEventListener('click', () => {
      location.href = '../animation-maker-advanced/advanced.html';
    });
  }

  const webpScript = document.createElement('script');
  webpScript.src = '../animation-maker-mode/webp-export.js';
  document.head.append(webpScript);
})();
