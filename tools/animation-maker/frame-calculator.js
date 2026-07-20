(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const frameGrid = $('frame-grid');
  const skipSlider = $('adj-skip');
  const delaySlider = $('frame-delay');
  const totalInput = $('calc-total-frames');
  const skipInput = $('calc-frame-skip');
  const lengthInput = $('calc-animation-length');
  const durationInput = $('calc-frame-duration');
  const fpsInput = $('calc-fps');

  if (!frameGrid || !skipSlider || !delaySlider || !totalInput || !skipInput || !lengthInput || !durationInput || !fpsInput) return;

  let syncing = false;
  let syncTimer = 0;

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const currentFrameCount = () => frameGrid.querySelectorAll('.frame-thumb-wrapper').length;
  const finalFrameCount = (sourceCount, skip) => sourceCount > 0 ? Math.ceil(sourceCount / Math.max(1, skip)) : 0;
  const rangeMinimum = (input, fallback) => Number.isFinite(Number(input.min)) ? Number(input.min) : fallback;
  const rangeMaximum = (input, fallback) => Number.isFinite(Number(input.max)) ? Number(input.max) : fallback;

  function dispatchSlider(input, value) {
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function closestSkipForTarget(sourceCount, requestedFrames) {
    if (sourceCount <= 1) return 1;
    const minimum = Math.max(1, parseInt(skipSlider.min, 10) || 1);
    const maximum = Math.max(minimum, parseInt(skipSlider.max, 10) || 10);
    const target = clamp(Math.round(Number(requestedFrames) || sourceCount), 1, sourceCount);
    let bestSkip = minimum;
    let bestDifference = Infinity;

    for (let skip = minimum; skip <= maximum; skip += 1) {
      const difference = Math.abs(finalFrameCount(sourceCount, skip) - target);
      if (difference < bestDifference) {
        bestDifference = difference;
        bestSkip = skip;
      }
    }
    return bestSkip;
  }

  function syncFromSliders(force = false) {
    if (syncing) return;
    syncing = true;

    const active = force ? null : document.activeElement;
    const sourceCount = currentFrameCount();
    const skip = clamp(parseInt(skipSlider.value, 10) || 1, 1, parseInt(skipSlider.max, 10) || 10);
    const total = finalFrameCount(sourceCount, skip);
    const duration = clamp(
      parseInt(delaySlider.value, 10) || 200,
      rangeMinimum(delaySlider, 40),
      rangeMaximum(delaySlider, 1000)
    );

    totalInput.min = sourceCount ? '1' : '0';
    totalInput.max = String(Math.max(0, sourceCount));
    if (active !== totalInput) totalInput.value = String(total);

    skipInput.min = skipSlider.min || '1';
    skipInput.max = skipSlider.max || '10';
    if (active !== skipInput) skipInput.value = String(skip);

    durationInput.min = delaySlider.min || '40';
    durationInput.max = delaySlider.max || '1000';
    durationInput.step = delaySlider.step || '10';
    if (active !== durationInput) durationInput.value = String(duration);

    if (active !== lengthInput) lengthInput.value = total ? (total * duration / 1000).toFixed(2) : '0.00';
    fpsInput.value = duration > 0 ? (1000 / duration).toFixed(2) : '0.00';

    syncing = false;
  }

  function scheduleSync(force = false) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncFromSliders(force), 0);
  }

  function commitTotalFrames() {
    if (syncing) return;
    const sourceCount = currentFrameCount();
    if (!sourceCount || totalInput.value === '') {
      scheduleSync(true);
      return;
    }
    dispatchSlider(skipSlider, closestSkipForTarget(sourceCount, totalInput.value));
    scheduleSync();
  }

  function commitFrameSkip() {
    if (syncing || skipInput.value === '') return;
    const skip = clamp(
      Math.round(Number(skipInput.value) || 1),
      rangeMinimum(skipSlider, 1),
      rangeMaximum(skipSlider, 10)
    );
    dispatchSlider(skipSlider, skip);
    scheduleSync();
  }

  function commitAnimationLength() {
    if (syncing || lengthInput.value === '') return;
    const sourceCount = currentFrameCount();
    const skip = parseInt(skipSlider.value, 10) || 1;
    const total = finalFrameCount(sourceCount, skip);
    if (!total) {
      scheduleSync(true);
      return;
    }

    const seconds = Number(lengthInput.value);
    if (!Number.isFinite(seconds) || seconds <= 0) return;

    const step = Math.max(1, parseInt(delaySlider.step, 10) || 10);
    const rawDuration = seconds * 1000 / total;
    const duration = clamp(
      Math.round(rawDuration / step) * step,
      rangeMinimum(delaySlider, 40),
      rangeMaximum(delaySlider, 1000)
    );
    dispatchSlider(delaySlider, duration);
    fpsInput.value = duration > 0 ? (1000 / duration).toFixed(2) : '0.00';
    scheduleSync();
  }

  function commitFrameDuration() {
    if (syncing || durationInput.value === '') return;
    const typed = Number(durationInput.value);
    if (!Number.isFinite(typed) || typed <= 0) return;

    const step = Math.max(1, parseInt(delaySlider.step, 10) || 10);
    const duration = clamp(
      Math.round(typed / step) * step,
      rangeMinimum(delaySlider, 40),
      rangeMaximum(delaySlider, 1000)
    );
    dispatchSlider(delaySlider, duration);
    fpsInput.value = duration > 0 ? (1000 / duration).toFixed(2) : '0.00';
    scheduleSync();
  }

  totalInput.addEventListener('input', commitTotalFrames);
  totalInput.addEventListener('change', () => scheduleSync(true));

  skipInput.addEventListener('input', commitFrameSkip);
  skipInput.addEventListener('change', () => scheduleSync(true));

  lengthInput.addEventListener('input', commitAnimationLength);
  lengthInput.addEventListener('change', () => scheduleSync(true));

  durationInput.addEventListener('input', commitFrameDuration);
  durationInput.addEventListener('change', () => scheduleSync(true));

  [totalInput, skipInput, lengthInput, durationInput].forEach((input) => {
    input.addEventListener('blur', () => scheduleSync(true));
  });

  skipSlider.addEventListener('input', scheduleSync);
  delaySlider.addEventListener('input', scheduleSync);
  $('delete-skipped-frames-btn')?.addEventListener('click', scheduleSync);
  $('restore-skipped-frames-btn')?.addEventListener('click', scheduleSync);

  const observer = new MutationObserver(scheduleSync);
  observer.observe(frameGrid, { childList: true, subtree: true });

  syncFromSliders(true);
})();