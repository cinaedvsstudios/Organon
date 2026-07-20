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

  if (!frameGrid || !skipSlider || !delaySlider || !totalInput || !skipInput || !lengthInput || !durationInput) return;

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

  function syncFromSliders() {
    if (syncing) return;
    syncing = true;

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
    totalInput.value = String(total);
    skipInput.min = skipSlider.min || '1';
    skipInput.max = skipSlider.max || '10';
    skipInput.value = String(skip);
    durationInput.min = delaySlider.min || '40';
    durationInput.max = delaySlider.max || '1000';
    durationInput.step = delaySlider.step || '10';
    durationInput.value = String(duration);
    lengthInput.value = total ? (total * duration / 1000).toFixed(2) : '0.00';

    syncing = false;
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncFromSliders, 0);
  }

  totalInput.addEventListener('change', () => {
    if (syncing) return;
    const sourceCount = currentFrameCount();
    if (!sourceCount) {
      syncFromSliders();
      return;
    }
    const skip = closestSkipForTarget(sourceCount, totalInput.value);
    dispatchSlider(skipSlider, skip);
    scheduleSync();
  });

  skipInput.addEventListener('change', () => {
    if (syncing) return;
    const skip = clamp(
      Math.round(Number(skipInput.value) || 1),
      rangeMinimum(skipSlider, 1),
      rangeMaximum(skipSlider, 10)
    );
    dispatchSlider(skipSlider, skip);
    scheduleSync();
  });

  lengthInput.addEventListener('change', () => {
    if (syncing) return;
    const sourceCount = currentFrameCount();
    const skip = parseInt(skipSlider.value, 10) || 1;
    const total = finalFrameCount(sourceCount, skip);
    if (!total) {
      syncFromSliders();
      return;
    }
    const seconds = Math.max(0.01, Number(lengthInput.value) || 0.01);
    const step = Math.max(1, parseInt(delaySlider.step, 10) || 10);
    const rawDuration = seconds * 1000 / total;
    const duration = clamp(
      Math.round(rawDuration / step) * step,
      rangeMinimum(delaySlider, 40),
      rangeMaximum(delaySlider, 1000)
    );
    dispatchSlider(delaySlider, duration);
    scheduleSync();
  });

  durationInput.addEventListener('change', () => {
    if (syncing) return;
    const step = Math.max(1, parseInt(delaySlider.step, 10) || 10);
    const duration = clamp(
      Math.round((Number(durationInput.value) || 200) / step) * step,
      rangeMinimum(delaySlider, 40),
      rangeMaximum(delaySlider, 1000)
    );
    dispatchSlider(delaySlider, duration);
    scheduleSync();
  });

  skipSlider.addEventListener('input', scheduleSync);
  delaySlider.addEventListener('input', scheduleSync);
  $('delete-skipped-frames-btn')?.addEventListener('click', scheduleSync);
  $('restore-skipped-frames-btn')?.addEventListener('click', scheduleSync);

  const observer = new MutationObserver(scheduleSync);
  observer.observe(frameGrid, { childList: true, subtree: true });

  syncFromSliders();
})();