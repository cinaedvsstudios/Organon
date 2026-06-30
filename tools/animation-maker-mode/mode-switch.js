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
      location.href = isAdvanced ? './index.html' : './index.html?mode=advanced';
    });
  }

  const addScript = (src, callback) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => { if (callback) callback(); };
    document.head.appendChild(script);
  };

  if (isAdvanced) {
    addScript('../animation-maker-mode/advanced-groups-v2.js', () => {
      addScript('../animation-maker-mode/advanced-groups-format.js', () => {
        addScript('../animation-maker-mode/advanced-bottom-bar.js');
      });
    });
  } else {
    addScript('../animation-maker-mode/webp-export.js');
  }
})();
