(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const bridge = window.__organonAdvancedBackgroundBridge;
  if (!bridge) {
    console.error('Animation Maker Advanced Background Removal bridge was not available.');
    return;
  }

  let picking = false;
  const valueBindings = [
    ['advanced-bg-tolerance', 'advanced-bg-tolerance-label'],
    ['advanced-bg-softness', 'advanced-bg-softness-label'],
    ['advanced-bg-matte-width', 'advanced-bg-matte-width-label'],
    ['advanced-bg-matte-strength', 'advanced-bg-matte-strength-label', '%'],
    ['advanced-bg-despeckle', 'advanced-bg-despeckle-label'],
    ['advanced-bg-alpha-adjust', 'advanced-bg-alpha-adjust-label'],
    ['advanced-bg-feather', 'advanced-bg-feather-label']
  ];

  function rgbToHex(red, green, blue) {
    return `#${[red, green, blue].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
  }

  function readConfig() {
    return {
      color: $('advanced-bg-color')?.value || '#00ff00',
      tolerance: Math.max(0, Number($('advanced-bg-tolerance')?.value) || 0),
      softness: Math.max(0, Number($('advanced-bg-softness')?.value) || 0),
      outsideOnly: $('advanced-bg-outside-only')?.checked !== false,
      protectHoles: $('advanced-bg-protect-holes')?.checked !== false,
      removeBlackMatte: $('advanced-bg-remove-black-matte')?.checked !== false,
      matteWidth: Math.max(0, Math.round(Number($('advanced-bg-matte-width')?.value) || 0)),
      matteStrength: Math.max(0, Math.min(100, Number($('advanced-bg-matte-strength')?.value) || 0)),
      despeckle: Math.max(0, Math.round(Number($('advanced-bg-despeckle')?.value) || 0)),
      alphaAdjust: Math.max(-4, Math.min(4, Math.round(Number($('advanced-bg-alpha-adjust')?.value) || 0))),
      feather: Math.max(0, Math.min(6, Math.round(Number($('advanced-bg-feather')?.value) || 0)))
    };
  }

  function setStatus(message) {
    if ($('advanced-bg-status')) $('advanced-bg-status').textContent = message;
    bridge.setStatus(message);
    window.setTimeout(bridge.clearStatus, 4200);
  }

  function updateLabels() {
    valueBindings.forEach(([inputId, labelId, suffix = '']) => {
      const input = $(inputId);
      const label = $(labelId);
      if (input && label) label.textContent = `${input.value}${suffix}`;
    });
  }

  function processCurrent() {
    const frameId = bridge.getCurrentFrameId();
    if (!frameId) return;
    bridge.setActions([frameId], readConfig());
    setStatus(`Frame ${bridge.getCurrentFrameNumber()} processed. Press PLAY to inspect it or UNDO to reverse it.`);
  }

  function processAll() {
    const frameIds = bridge.getFrameIds();
    if (!frameIds.length) return;
    bridge.setActions(frameIds, readConfig());
    setStatus(`${frameIds.length} frames processed as one reversible editor step.`);
  }

  function clearCurrent() {
    const frameId = bridge.getCurrentFrameId();
    if (!frameId) return;
    bridge.clearActions([frameId]);
    setStatus(`Advanced Background Removal cleared from frame ${bridge.getCurrentFrameNumber()}.`);
  }

  function clearAll() {
    const frameIds = bridge.getFrameIds();
    if (!frameIds.length) return;
    bridge.clearActions(frameIds);
    setStatus('Advanced Background Removal cleared from every frame.');
  }

  function togglePicker() {
    picking = !picking;
    const button = $('advanced-bg-pick');
    if (!button) return;
    button.classList.toggle('active-toggle', picking);
    button.textContent = picking ? 'CLICK THE BACKGROUND' : 'PICK FROM IMAGE';
  }

  function sampleColour(event) {
    if (!picking) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const canvas = bridge.getCanvas();
    if (!canvas?.width || !canvas?.height) return;
    const point = bridge.pointFromEvent(event);
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y * canvas.height)));
    const pixel = canvas.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
    const color = rgbToHex(pixel[0], pixel[1], pixel[2]);
    $('advanced-bg-color').value = color;
    $('advanced-bg-color').dispatchEvent(new Event('input', { bubbles: true }));
    picking = false;
    const button = $('advanced-bg-pick');
    button.classList.remove('active-toggle');
    button.textContent = 'PICK FROM IMAGE';
    setStatus(`Key colour sampled as ${color}.`);
  }

  valueBindings.forEach(([inputId]) => $(inputId)?.addEventListener('input', updateLabels));
  $('advanced-bg-pick')?.addEventListener('click', togglePicker);
  $('advanced-bg-process-current')?.addEventListener('click', processCurrent);
  $('advanced-bg-process-all')?.addEventListener('click', processAll);
  $('advanced-bg-clear-current')?.addEventListener('click', clearCurrent);
  $('advanced-bg-clear-all')?.addEventListener('click', clearAll);
  bridge.getCanvas()?.addEventListener('pointerdown', sampleColour, true);
  updateLabels();
})();
