(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const bridge = window.__organonAnimationMakerExport;
  const frameGrid = $('frame-grid');
  const skipSlider = $('adj-skip');
  const delaySlider = $('frame-delay');
  const playButton = $('btn-play-preview');
  const previewModal = $('anim-preview-modal');
  const previewImage = $('anim-modal-img');
  const previewLoading = $('anim-loading');
  const previewTitle = $('anim-modal-title');

  if (!bridge || !frameGrid || !skipSlider || !delaySlider || !playButton || !previewModal || !previewImage || !previewLoading) {
    console.error('Animation Maker timing and preview repair could not initialise.');
    return;
  }

  const frameCountForSkip = (count, skip) => count > 0 ? Math.ceil(count / Math.max(1, skip)) : 0;
  let lastSkip = Math.max(1, parseInt(skipSlider.value, 10) || 1);
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

  function outputCount() {
    return typeof bridge.getOutputFrameCount === 'function'
      ? bridge.getOutputFrameCount()
      : frameCountForSkip(bridge.getFrameCount(), parseInt(skipSlider.value, 10) || 1);
  }

  skipSlider.addEventListener('input', () => {
    const nextSkip = Math.max(1, parseInt(skipSlider.value, 10) || 1);
    if (nextSkip === lastSkip) return;

    const sourceCount = bridge.getFrameCount();
    const oldCount = frameCountForSkip(sourceCount, lastSkip);
    const nextCount = frameCountForSkip(sourceCount, nextSkip);
    const oldDelay = Math.max(1, Number(bridge.getFrameDelay?.()) || Number(delaySlider.value) || 200);
    if (oldCount > 0 && nextCount > 0) setDelay((oldDelay * oldCount) / nextCount);
    lastSkip = nextSkip;
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('#delete-skipped-frames-btn, #restore-skipped-frames-btn, .frame-delete-btn, .clip-remove-btn');
    if (!target || target.disabled) return;
    const durationMs = outputCount() * Math.max(1, Number(bridge.getFrameDelay?.()) || Number(delaySlider.value) || 200);
    window.setTimeout(() => {
      const count = outputCount();
      if (count > 0 && durationMs > 0) setDelay(durationMs / count);
      lastSkip = Math.max(1, parseInt(skipSlider.value, 10) || 1);
    }, 90);
  }, true);

  new MutationObserver(() => {
    window.setTimeout(() => {
      lastSkip = Math.max(1, parseInt(skipSlider.value, 10) || 1);
    }, 0);
  }).observe(frameGrid, { childList: true, subtree: true });

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

  async function playSequence(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    closeModal('frame-editor-modal');
    closeModal('preview-modal');
    closeModal('align-modal');
    stopPreview(true);

    const token = previewToken;
    const count = outputCount();
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
          : await bridge.renderFrameCanvas(position);
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

    const startedAt = performance.now();
    let lastFrame = -1;
    const tick = (now) => {
      if (token !== previewToken || previewModal.hidden) return;
      const delay = Math.max(1, Number(bridge.getFrameDelay?.()) || Number(delaySlider.value) || 200);
      const frame = Math.floor((now - startedAt) / delay) % rendered.length;
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
