(() => {
  'use strict';

  const advanced = new URLSearchParams(window.location.search).get('mode') === 'advanced';
  const title = document.querySelector('.title-left span');
  const button = document.getElementById('btn-animation-mode');

  document.body.classList.toggle('is-advanced-mode', advanced);
  document.body.dataset.animationMakerMode = advanced ? 'advanced' : 'standard';
  document.title = advanced ? 'Organon - Animation Maker Advanced' : 'Organon - Animation Maker';

  if (title) {
    title.textContent = advanced ? 'ANIMATION MAKER — ADVANCED' : 'ANIMATION MAKER';
  }

  if (!button) return;

  button.textContent = advanced ? 'STANDARD MODE' : 'ADVANCED MODE';
  button.title = advanced
    ? 'Return to the compact Animation Maker workspace'
    : 'Open the wide desktop Animation Maker workspace';

  button.addEventListener('click', () => {
    window.location.assign(advanced
      ? './index.html'
      : '../animation-maker-advanced/index.html');
  });
})();
