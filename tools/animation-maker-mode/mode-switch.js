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

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.append(script);
  });

  const loadStylesheet = (src) => {
    if (document.querySelector(`link[href="${src}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = src;
    document.head.append(link);
  };

  if (!isAdvanced) {
    loadScript('../animation-maker-mode/webp-export.js');
    return;
  }

  loadStylesheet('../animation-maker-mode/advanced-engine.css');
  const modules = [
    'advanced-engine-core.js',
    'advanced-engine-render.js',
    'advanced-engine-groups.js',
    'advanced-engine-effects.js',
    'advanced-engine-selection.js',
    'advanced-engine-editor-clipboard.js',
    'advanced-engine-transform.js',
    'advanced-engine-navigation.js',
    'advanced-engine-animation.js',
    'advanced-engine-output.js',
    'advanced-engine-strobe.js',
    'advanced-engine-global-visuals.js',
    'advanced-engine-export-gifzip.js',
    'advanced-engine-export-webp.js',
    'advanced-engine-bootstrap.js'
  ];

  modules.reduce(
    (chain, file) => chain.then(() => loadScript(`../animation-maker-mode/${file}`)),
    Promise.resolve()
  ).catch(() => {
    const host = document.querySelector('.app-wrapper') || document.body;
    host.insertAdjacentHTML('afterbegin', '<p style="padding:12px;color:#ffb2a6">Advanced Mode could not load completely. Refresh the page.</p>');
  });
})();