(() => {
  'use strict';

  const advanced = new URLSearchParams(location.search).get('mode') === 'advanced';
  const title = document.querySelector('.title-left span');
  const button = document.getElementById('btn-animation-mode');

  document.body.classList.toggle('is-advanced-mode', advanced);
  document.body.dataset.animationMakerMode = advanced ? 'advanced' : 'standard';
  document.title = advanced ? 'Organon - Animation Maker Advanced' : 'Organon - Animation Maker';
  if (title) title.textContent = advanced ? 'ANIMATION MAKER — ADVANCED' : 'ANIMATION MAKER';

  if (button) {
    button.textContent = advanced ? 'STANDARD MODE' : 'ADVANCED MODE';
    button.addEventListener('click', () => {
      location.href = advanced ? './index.html' : '../animation-maker-advanced/index.html';
    });
  }

  const load = (src, done) => {
    const script = document.createElement('script');
    script.src = src;
    script.addEventListener('load', done, { once: true });
    document.head.append(script);
  };

  load('../animation-maker-mode/webp-export.js', () => {
    if (!advanced) return;
    load('../animation-maker-mode/advanced-workspace.js', () => {});
  });
})();
