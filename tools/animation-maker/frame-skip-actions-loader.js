(() => {
  'use strict';

  const scriptUrl = document.currentScript?.src || location.href;
  const sourceUrl = new URL('./app-v3.js?build=20260720-frame-actions-1', scriptUrl).href;

  function updateBulkFrameButtons() {
    const skip = parseInt($('adj-skip').value, 10) || 1;
    if (els.deleteSkippedBtn) els.deleteSkippedBtn.disabled = skip <= 1 || state.frames.length < 2;
    if (els.restoreSkippedBtn) {
      const count = state.bulkRemovedFrames.size;
      els.restoreSkippedBtn.hidden = count === 0;
      els.restoreSkippedBtn.disabled = count === 0;
      els.restoreSkippedBtn.textContent = count ? `RESTORE ALL FRAMES (${count})` : 'RESTORE ALL FRAMES';
    }
  }

  function deleteFramesUsingSkip() {
    const skip = parseInt($('adj-skip').value, 10) || 1;
    if (skip <= 1 || state.frames.length < 2) return;

    const before = [...state.frames];
    const removed = before.filter((frame, index) => index % skip !== 0);
    if (!removed.length) return;

    const removedIds = new Set(removed.map((frame) => frame.id));
    if (removedIds.has(state.baseFrameId) && !state.bulkRestoreBaseFrameId) state.bulkRestoreBaseFrameId = state.baseFrameId;

    const affectedClipIds = new Set(removed.map((frame) => frame.clipId));
    affectedClipIds.forEach((clipId) => {
      const currentOrder = before.filter((frame) => frame.clipId === clipId).map((frame) => frame.id);
      if (!state.bulkRestoreOrder.has(clipId)) {
        state.bulkRestoreOrder.set(clipId, currentOrder);
        return;
      }
      const savedOrder = state.bulkRestoreOrder.get(clipId);
      currentOrder.forEach((frameId) => {
        if (!savedOrder.includes(frameId)) savedOrder.push(frameId);
      });
    });

    removed.forEach((frame) => state.bulkRemovedFrames.set(frame.id, frame));
    state.frames = before.filter((frame) => !removedIds.has(frame.id));
    $('adj-skip').value = '1';
    $('val-skip').textContent = 'Keep All';
    onFramesChanged();
    updateBulkFrameButtons();
    setHubStatus(`${removed.length} frame${removed.length === 1 ? '' : 's'} removed. Use RESTORE ALL FRAMES to bring them back.`);
    setTimeout(clearHubStatus, 4500);
  }

  function restoreBulkRemovedFrames() {
    if (!state.bulkRemovedFrames.size) return;

    const restoredCount = state.bulkRemovedFrames.size;
    const rebuilt = [];

    state.clips.forEach((clip) => {
      const visible = state.frames.filter((frame) => frame.clipId === clip.id);
      const removed = [...state.bulkRemovedFrames.values()].filter((frame) => frame.clipId === clip.id);
      const available = new Map([...visible, ...removed].map((frame) => [frame.id, frame]));
      const savedOrder = state.bulkRestoreOrder.get(clip.id) || [];

      savedOrder.forEach((frameId) => {
        const frame = available.get(frameId);
        if (!frame) return;
        rebuilt.push(frame);
        available.delete(frameId);
      });

      visible.forEach((frame) => {
        if (!available.has(frame.id)) return;
        rebuilt.push(frame);
        available.delete(frame.id);
      });

      removed.forEach((frame) => {
        if (!available.has(frame.id)) return;
        rebuilt.push(frame);
        available.delete(frame.id);
      });
    });

    state.frames = rebuilt;
    if (state.bulkRestoreBaseFrameId && state.frames.some((frame) => frame.id === state.bulkRestoreBaseFrameId)) {
      state.baseFrameId = state.bulkRestoreBaseFrameId;
    }
    state.bulkRemovedFrames.clear();
    state.bulkRestoreOrder.clear();
    state.bulkRestoreBaseFrameId = null;
    $('adj-skip').value = '1';
    $('val-skip').textContent = 'Keep All';
    onFramesChanged();
    updateBulkFrameButtons();
    setHubStatus(`${restoredCount} frame${restoredCount === 1 ? '' : 's'} restored to the sequence.`);
    setTimeout(clearHubStatus, 4000);
  }

  function replaceOnce(source, needle, replacement, label) {
    if (!source.includes(needle)) throw new Error(`Animation Maker patch point missing: ${label}`);
    return source.replace(needle, replacement);
  }

  function loadSource() {
    const request = new XMLHttpRequest();
    request.open('GET', sourceUrl, false);
    request.send(null);
    if ((request.status < 200 || request.status >= 300) && request.status !== 0) {
      throw new Error(`Could not load Animation Maker engine (${request.status}).`);
    }
    return request.responseText;
  }

  const originalSource = loadSource();
  let source = originalSource;

  try {
    source = replaceOnce(
      source,
      "reorderClipsBtn: $('reorder-clips-btn'), reorderModal: $('reorder-clips-modal'), clipOrderList: $('clip-order-list'),",
      "reorderClipsBtn: $('reorder-clips-btn'), reorderModal: $('reorder-clips-modal'), clipOrderList: $('clip-order-list'),\n        deleteSkippedBtn: $('delete-skipped-frames-btn'), restoreSkippedBtn: $('restore-skipped-frames-btn'),",
      'button references'
    );

    source = replaceOnce(
      source,
      "frames: [], clips: [], clipSerial: 0, reorderDraft: [],",
      "frames: [], clips: [], clipSerial: 0, reorderDraft: [],\n        bulkRemovedFrames: new Map(), bulkRestoreOrder: new Map(), bulkRestoreBaseFrameId: null,",
      'restore state'
    );

    source = replaceOnce(
      source,
      `    function normalizeClipOrder() {
        const present = new Set(state.frames.map((frame) => frame.clipId));
        state.clips = state.clips.filter((clip) => present.has(clip.id));
        state.frames = state.clips.flatMap((clip) => clipFrames(clip.id));
        if (state.frames.length && frameIndexById(state.baseFrameId) < 0) state.baseFrameId = state.frames[0].id;
        if (!state.frames.length) state.baseFrameId = null;
    }`,
      `    function normalizeClipOrder() {
        const present = new Set(state.frames.map((frame) => frame.clipId));
        state.bulkRemovedFrames.forEach((frame) => present.add(frame.clipId));
        state.clips = state.clips.filter((clip) => present.has(clip.id));
        state.frames = state.clips.flatMap((clip) => clipFrames(clip.id));
        if (state.frames.length && frameIndexById(state.baseFrameId) < 0) state.baseFrameId = state.frames[0].id;
        if (!state.frames.length) state.baseFrameId = null;
    }`,
      'clip normalization'
    );

    source = replaceOnce(
      source,
      "state.frames = state.frames.filter((frame) => frame.clipId !== id); state.clips = state.clips.filter((entry) => entry.id !== id); normalizeClipOrder(); checkpoint(); onFramesChanged();",
      "state.frames = state.frames.filter((frame) => frame.clipId !== id); for (const [frameId, frame] of state.bulkRemovedFrames.entries()) { if (frame.clipId === id) state.bulkRemovedFrames.delete(frameId); } state.bulkRestoreOrder.delete(id); if (!state.bulkRemovedFrames.size) state.bulkRestoreBaseFrameId = null; state.clips = state.clips.filter((entry) => entry.id !== id); normalizeClipOrder(); checkpoint(); onFramesChanged();",
      'clip removal cleanup'
    );

    source = replaceOnce(
      source,
      "    let draggedFrameId = null;",
      `    ${updateBulkFrameButtons.toString()}\n\n    ${deleteFramesUsingSkip.toString()}\n\n    ${restoreBulkRemovedFrames.toString()}\n\n    let draggedFrameId = null;`,
      'bulk frame functions'
    );

    source = replaceOnce(
      source,
      `    function renderFrameGrid() {
        els.frameGrid.innerHTML = ''; els.queueCard.hidden = !state.frames.length; $('frame-skip-container').hidden = state.frames.length <= 15;
        if (state.frames.length <= 15) { $('adj-skip').value = '1'; $('val-skip').textContent = 'Keep All'; }`,
      `    function renderFrameGrid() {
        els.frameGrid.innerHTML = ''; els.queueCard.hidden = !state.frames.length; $('frame-skip-container').hidden = state.frames.length <= 15;
        if (state.frames.length <= 15) { $('adj-skip').value = '1'; $('val-skip').textContent = 'Keep All'; }
        updateBulkFrameButtons();`,
      'frame grid refresh'
    );

    source = replaceOnce(
      source,
      "$('adj-skip').addEventListener('input', () => { const value = parseInt($('adj-skip').value, 10); $('val-skip').textContent = value === 1 ? 'Keep All' : `Keep 1 in ${value}`; updateEstimate(); });",
      "$('adj-skip').addEventListener('input', () => { const value = parseInt($('adj-skip').value, 10); $('val-skip').textContent = value === 1 ? 'Keep All' : `Keep 1 in ${value}`; updateEstimate(); updateBulkFrameButtons(); });\n    if (els.deleteSkippedBtn) els.deleteSkippedBtn.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); deleteFramesUsingSkip(); });\n    if (els.restoreSkippedBtn) els.restoreSkippedBtn.addEventListener('click', restoreBulkRemovedFrames);",
      'frame skip controls'
    );
  } catch (error) {
    console.error(error);
    source = originalSource;
  }

  const script = document.createElement('script');
  script.textContent = `${source}\n//# sourceURL=${sourceUrl}`;
  document.head.appendChild(script);
  script.remove();
})();
