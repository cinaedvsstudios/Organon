(() => {
  'use strict';

  const isAdvancedQuery = new URLSearchParams(location.search).get('mode') === 'advanced';
  if (isAdvancedQuery) {
    location.replace('../animation-maker-advanced/index.html');
    return;
  }

  const modeButton = document.getElementById('btn-animation-mode');
  if (modeButton) {
    modeButton.textContent = 'ADVANCED MODE';
    modeButton.addEventListener('click', () => {
      location.href = '../animation-maker-advanced/index.html';
    });
  }

  const script = document.createElement('script');
  script.src = '../animation-maker-mode/webp-export.js';
  document.head.append(script);
})();