(() => {
  'use strict';

  const STORAGE_KEY = 'organon.animation-maker.settings.v1';
  const CONTROL_IDS = new Set([
    'adj-bright', 'adj-contrast', 'adj-exp', 'adj-sat',
    'chk-transparent', 'adj-color', 'adj-tol', 'adj-smooth',
    'chk-shadow', 'shadow-color', 'shadow-opacity', 'shadow-blur', 'shadow-x', 'shadow-y',
    'opt-format', 'video-capture-fps', 'frame-format', 'frame-name',
    'adj-skip', 'frame-delay', 'max-dimension', 'chk-reverse', 'chk-forverse',
    'chk-dithering', 'play-count', 'opt-size', 'opt-lossy',
    'chk-webp-lossless', 'adj-webp-q', 'adj-webp-effort',
    'brush-color', 'brush-size', 'brush-softness', 'bucket-tolerance', 'bucket-feather',
    'advanced-bg-color', 'advanced-bg-tolerance', 'advanced-bg-softness',
    'advanced-bg-outside-only', 'advanced-bg-protect-holes',
    'advanced-bg-remove-black-matte', 'advanced-bg-matte-width', 'advanced-bg-matte-strength',
    'advanced-bg-despeckle', 'advanced-bg-alpha-adjust', 'advanced-bg-feather'
  ]);

  let saveTimer = 0;

  function readControl(control) {
    if (control.type === 'checkbox') return Boolean(control.checked);
    return control.value;
  }

  function applyControl(control, value) {
    if (control.type === 'checkbox') control.checked = Boolean(value);
    else if (value !== undefined && value !== null) control.value = String(value);
  }

  function collectSettings() {
    const settings = {};
    CONTROL_IDS.forEach((id) => {
      const control = document.getElementById(id);
      if (control) settings[id] = readControl(control);
    });
    return settings;
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectSettings()));
    } catch (error) {
      console.warn('Animation Maker settings could not be saved.', error);
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveSettings, 120);
  }

  function restoreSettings() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
      console.warn('Animation Maker saved settings were invalid.', error);
      saved = {};
    }

    Object.entries(saved).forEach(([id, value]) => {
      if (!CONTROL_IDS.has(id)) return;
      const control = document.getElementById(id);
      if (!control) return;
      applyControl(control, value);
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  document.addEventListener('input', (event) => {
    if (CONTROL_IDS.has(event.target?.id)) scheduleSave();
  }, true);
  document.addEventListener('change', (event) => {
    if (CONTROL_IDS.has(event.target?.id)) scheduleSave();
  }, true);
  window.addEventListener('beforeunload', saveSettings);

  restoreSettings();
})();
