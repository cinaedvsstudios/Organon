(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const bridge = window.__organonAnimationMakerExport;
  const frameGrid = $('frame-grid');
  const delaySlider = $('frame-delay');
  const playButton = $('btn-play-preview');
  const previewModal = $('anim-preview-modal');
  const previewImage = $('anim-modal-img');
  const previewLoading = $('anim-loading');
  const previewTitle = $('anim-modal-title');

  if (!bridge || !frameGrid || !delaySlider || !playButton || !previewModal || !previewImage || !previewLoading) {
    console.error('Animation Maker timing and preview repair could not initialise.');
    return;
  }

  let previewToken = 0;
  let previewRaf = 0;

  function setStatus(text, clearAfter = 0) {
    bridge.setStatus(text);
    if (clearAfter > 0) window.setTimeout(bridge.clearStatus, clearAfter);
  }

  function setDelay(value) {
    if (typeof bridge.setFrameDelay === 'function') return bridge.setFrameDelay(value);
    const minimum = parseInt(delaySlider.min, 10) || 1;
    const maximum = parseInt(delaySlider.max, 10) || 10000;
    const next = Math.max(minimum, Math.min(maximum, Math.round(Number(value) || minimum)));
    delaySlider.value = String(next);
    delaySlider.dispatchEvent(new Event('input', { bubbles: true }));
    return next;
  }

  function outputTimeline() {
    if (typeof bridge.getOutputTimeline === 'function') return bridge.getOutputTimeline();
    const count = typeof bridge.getOutputFrameCount === 'function' ? bridge.getOutputFrameCount() : bridge.getFrameCount();
    const durationMs = Math.max(1, Number(bridge.getFrameDelay?.()) || Number(delaySlider.value) || 200);
    return Array.from({ length: count }, (_, outputIndex) => ({ outputIndex, sourceIndex: outputIndex, durationMs }));
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('#delete-skipped-frames-btn, #restore-skipped-frames-btn, .frame-delete-btn, .clip-remove-btn');
    if (!target || target.disabled) return;

    const previousDuration = Math.max(1, Number(bridge.getOutputDurationMs?.()) || 0);
    const previousDelay = Math.max(1, Number(bridge.getFrameDelay?.()) || Number(delaySlider.value) || 200);

    window.setTimeout(() => {
      const nextDuration = Math.max(1, Number(bridge.getOutputDurationMs?.()) || 0);
      if (previousDuration > 0 && nextDuration > 0) setDelay(previousDelay * previousDuration / nextDuration);
    }, 100);
  }, true);

  function closeModal(id) {
    const modal = $(id);
    if (!modal || modal.hidden) return;
    const closeButton = modal.querySelector(`[data-close="${id}"]`);
    if (closeButton) closeButton.click();
    else modal.hidden = true;
  }

  function stopPreview(clearImage = false) {
    previewToken += 1;
    if (previewRaf) cancelAnimationFrame(previewRaf);
    previewRaf = 0;
    if (clearImage) previewImage.src = '';
  }

  function frameAtElapsed(cumulativeEnds, elapsedMs) {
    let low = 0;
    let high = cumulativeEnds.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (elapsedMs < cumulativeEnds[middle]) high = middle;
      else low = middle + 1;
    }
    return low;
  }

  async function playSequence(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    closeModal('frame-editor-modal');
    closeModal('preview-modal');
    closeModal('align-modal');
    stopPreview(true);

    const token = previewToken;
    const timeline = outputTimeline();
    const count = timeline.length;
    if (!count) return;

    previewModal.hidden = false;
    previewLoading.hidden = false;
    previewLoading.textContent = `Rendering 0 / ${count}`;
    previewImage.hidden = true;
    if (previewTitle) previewTitle.textContent = 'SEQUENCE PREVIEW';

    const rendered = [];
    try {
      for (let position = 0; position < count; position += 1) {
        if (token !== previewToken) return;
        previewLoading.textContent = `Rendering ${position + 1} / ${count}`;
        const canvas = typeof bridge.renderOutputFrameCanvas === 'function'
          ? await bridge.renderOutputFrameCanvas(position)
          : await bridge.renderFrameCanvas(timeline[position].sourceIndex);
        rendered.push(canvas.toDataURL('image/png'));
      }
    } catch (error) {
      previewLoading.textContent = `Preview failed: ${error.message}`;
      setStatus(`Preview failed: ${error.message}`, 6000);
      return;
    }

    if (token !== previewToken || !rendered.length) return;
    previewLoading.hidden = true;
    previewImage.hidden = false;

    const cumulativeEnds = [];
    let totalDuration = 0;
    timeline.forEach((entry) => {
      totalDuration += Math.max(1, Number(entry.durationMs) || 1);
      cumulativeEnds.push(totalDuration);
    });

    const startedAt = performance.now();
    let lastFrame = -1;
    const tick = (now) => {
      if (token !== previewToken || previewModal.hidden) return;
      const elapsed = (now - startedAt) % totalDuration;
      const frame = frameAtElapsed(cumulativeEnds, elapsed);
      if (frame !== lastFrame) {
        previewImage.src = rendered[frame];
        lastFrame = frame;
      }
      previewRaf = requestAnimationFrame(tick);
    };
    previewRaf = requestAnimationFrame(tick);
  }

  playButton.addEventListener('click', playSequence, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-close="anim-preview-modal"]')) stopPreview(true);
  }, true);

  window.addEventListener('beforeunload', () => stopPreview(true));
})();
