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

  if (!isAdvanced) return;

  const workspaceScript = document.createElement('script');
  workspaceScript.src = '../animation-maker-mode/advanced-workspace.js';
  workspaceScript.addEventListener('load', () => {
    const effectsScript = document.createElement('script');
    effectsScript.src = '../animation-maker-mode/advanced-effects.js';
    effectsScript.addEventListener('load', () => {
      const orderingScript = document.createElement('script');
      orderingScript.src = '../animation-maker-mode/advanced-effects-layout.js';
      document.head.append(orderingScript);
    });
    document.head.append(effectsScript);
  });
  document.head.append(workspaceScript);
})();
