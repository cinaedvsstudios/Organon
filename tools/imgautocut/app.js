(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const refs = {
    topPanel: $('#top-sticky-panel'), countdown: $('#countdown-circle'), headerStatus: $('#header-status'),
    sourceFile: $('#source-file'), browseSource: $('#browse-source'), emptyBrowse: $('#empty-browse'), sourceFileName: $('#source-file-name'),
    filePrefix: $('#file-prefix'), alphaThreshold: $('#alpha-threshold'), thresholdValue: $('#threshold-value'),
    rowTolerance: $('#row-tolerance'), rowToleranceValue: $('#row-tolerance-value'), dropZone: $('#drop-zone'), canvas: $('#workspace-canvas'),
    emptyState: $('#empty-state'), workspaceSummary: $('#workspace-summary'), sliceStat: $('#slice-stat'), selectionInfo: $('#selection-info'),
    selectAll: $('#select-all'), clearSelection: $('#clear-selection'), invertSelection: $('#invert-selection'), toggleMulti: $('#toggle-multi'),
    uniformSize: $('#uniform-size'), smartFilter: $('#smart-filter'), resetScan: $('#reset-scan'), manageSelections: $('#manage-selections'), selectionManager: $('#selection-manager'),
    addSelection: $('#add-selection'), managerSort: $('#manager-sort'), selectionManagerList: $('#selection-manager-list'), toggleLedger: $('#toggle-ledger'), ledgerShell: $('#ledger-shell'),
    ledgerBody: $('#ledger-body'), detectedMeta: $('#detected-meta'), exportFormat: $('#export-format'), exportAssets: $('#export-assets'),
    ledgerPropagateName: $('#ledger-propagate-name'), ledgerStartNumber: $('#ledger-start-number'), ledgerPropagate: $('#ledger-propagate'),
    zoomOpen: $('#zoom-open'), zoomModal: $('#zoom-modal'), zoomClose: $('#zoom-close'), zoomFit: $('#zoom-fit'), zoom100: $('#zoom-100'),
    zoomRange: $('#zoom-range'), zoomValue: $('#zoom-value'), zoomScroll: $('#zoom-scroll'), zoomCanvas: $('#zoom-canvas'),
    zoomSelectBox: $('#zoom-select-box'), zoomSelectAll: $('#zoom-select-all'), zoomInvert: $('#zoom-invert'), zoomDuplicate: $('#zoom-duplicate'), zoomDelete: $('#zoom-delete'), toast: $('#toast')
  };

  const ctx = refs.canvas.getContext('2d', { alpha: true });
  const zoomCtx = refs.zoomCanvas.getContext('2d', { alpha: true });
  const sourceCanvas = document.createElement('canvas');
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const state = {
    image: null, sourceName: '', sourceWidth: 0, sourceHeight: 0, sourceImageData: null,
    slices: [], originalSlices: [], multiSelect: false, pointer: null,
    view: { x: 0, y: 0, scale: 1, width: 0, height: 0, dpr: 1 }, toastTimer: null, resizeObserver: null,
    managerSort: 'order', zoom: { open: false, scale: 1, pointer: null, selectBoxMode: false, marquee: null },
    header: { value: 5, interval: null, locked: false, hovering: false }
  };

  function setHubStatus(text) { if (window.parent && window.parent.postMessage) window.parent.postMessage({ type: 'set-status', text }, '*'); }
  function clearHubStatus() { if (window.parent && window.parent.postMessage) window.parent.postMessage({ type: 'clear-status' }, '*'); }
  function setHeaderStatus(text) { refs.headerStatus.textContent = text; }
  function toast(message) {
    clearTimeout(state.toastTimer); refs.toast.textContent = message; refs.toast.classList.add('show');
    state.toastTimer = setTimeout(() => refs.toast.classList.remove('show'), 3200);
  }
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const alphaThreshold = () => Number(refs.alphaThreshold.value);
  const rowTolerance = () => Number(refs.rowTolerance.value);

  function updateCountdownDisplay() { refs.countdown.textContent = state.header.locked ? '🔒' : String(state.header.value); }
  function resetHeaderCountdown() { clearInterval(state.header.interval); state.header.value = 5; updateCountdownDisplay(); }
  function maximizeHeader() { refs.topPanel.classList.remove('minimized'); resetHeaderCountdown(); }
  function startHeaderCountdown() {
    if (state.header.locked || state.header.hovering) return;
    clearInterval(state.header.interval);
    state.header.interval = setInterval(() => {
      state.header.value -= 1; updateCountdownDisplay();
      if (state.header.value <= 0) { clearInterval(state.header.interval); refs.topPanel.classList.add('minimized'); }
    }, 1000);
  }
  function initHeader() {
    refs.topPanel.addEventListener('mouseenter', () => { state.header.hovering = true; maximizeHeader(); clearInterval(state.header.interval); });
    refs.topPanel.addEventListener('mouseleave', () => { state.header.hovering = false; resetHeaderCountdown(); startHeaderCountdown(); });
    refs.topPanel.addEventListener('click', () => { if (refs.topPanel.classList.contains('minimized')) maximizeHeader(); });
    refs.countdown.addEventListener('dblclick', (event) => {
      event.preventDefault(); event.stopPropagation(); state.header.locked = !state.header.locked; updateCountdownDisplay();
      if (state.header.locked) { clearInterval(state.header.interval); maximizeHeader(); toast('Top controls locked open.'); }
      else { toast('Top controls unlocked.'); if (!state.header.hovering) startHeaderCountdown(); }
    });
    startHeaderCountdown();
  }

  function updateControlLabels() {
    refs.thresholdValue.textContent = String(alphaThreshold()); refs.rowToleranceValue.textContent = `${rowTolerance()} px`;
    const labels = refs.detectedMeta.querySelectorAll('strong');
    if (labels[0]) labels[0].textContent = alphaThreshold();
    if (labels[1]) labels[1].textContent = `${rowTolerance()} PX`;
  }
  function escapedText(text) { return String(text || '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch])); }
  function sanitizeFilename(name, index, extension) {
    const fallback = `${refs.filePrefix.value.trim() || 'asset'}_${String(index + 1).padStart(2, '0')}`;
    const raw = (name || fallback).trim().replace(/\.(png|webp)$/i, '');
    const safe = raw.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').trim();
    return `${safe || fallback}.${extension}`;
  }
  function makeSlice(bounds, index) {
    return {
      id: `slice-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h,
      ox: bounds.x, oy: bounds.y, ow: bounds.w, oh: bounds.h,
      pixelCount: bounds.pixelCount || 0, selected: false, manual: false, manualAdded: false, name: ''
    };
  }
  function cloneForReset(slice) {
    return { ...slice, x: slice.ox, y: slice.oy, w: slice.ow, h: slice.oh, selected: false, manual: false, manualAdded: false };
  }

  function detectAlphaIslands(imageData, width, height, threshold) {
    const data = imageData.data, parent = [], rank = [], x1 = [], y1 = [], x2 = [], y2 = [], pixels = [];
    let componentCount = 0, previousRuns = [];
    const find = (id) => {
      let root = id; while (parent[root] !== root) root = parent[root];
      while (parent[id] !== id) { const next = parent[id]; parent[id] = root; id = next; } return root;
    };
    const createComponent = (start, end, y) => {
      const id = componentCount++; parent[id] = id; rank[id] = 0; x1[id] = start; y1[id] = y; x2[id] = end; y2[id] = y; pixels[id] = 0; return id;
    };
    const merge = (a, b) => {
      let rootA = find(a), rootB = find(b); if (rootA === rootB) return rootA;
      if (rank[rootA] < rank[rootB]) [rootA, rootB] = [rootB, rootA];
      parent[rootB] = rootA; if (rank[rootA] === rank[rootB]) rank[rootA] += 1;
      x1[rootA] = Math.min(x1[rootA], x1[rootB]); y1[rootA] = Math.min(y1[rootA], y1[rootB]);
      x2[rootA] = Math.max(x2[rootA], x2[rootB]); y2[rootA] = Math.max(y2[rootA], y2[rootB]); pixels[rootA] += pixels[rootB]; return rootA;
    };
    for (let y = 0; y < height; y += 1) {
      const currentRuns = []; let x = 0, previousCursor = 0; const rowOffset = y * width * 4;
      while (x < width) {
        while (x < width && data[rowOffset + (x * 4) + 3] <= threshold) x += 1;
        if (x >= width) break;
        const start = x; while (x < width && data[rowOffset + (x * 4) + 3] > threshold) x += 1;
        const end = x - 1;
        while (previousCursor < previousRuns.length && previousRuns[previousCursor].end < start - 1) previousCursor += 1;
        const overlaps = [];
        for (let j = previousCursor; j < previousRuns.length && previousRuns[j].start <= end + 1; j += 1) overlaps.push(find(previousRuns[j].id));
        let id = overlaps.length ? overlaps[0] : createComponent(start, end, y);
        for (let j = 1; j < overlaps.length; j += 1) id = merge(id, overlaps[j]);
        id = find(id); x1[id] = Math.min(x1[id], start); x2[id] = Math.max(x2[id], end); y1[id] = Math.min(y1[id], y); y2[id] = Math.max(y2[id], y); pixels[id] += end - start + 1;
        currentRuns.push({ start, end, id });
      }
      previousRuns = currentRuns;
    }
    const islands = [];
    for (let id = 0; id < componentCount; id += 1) {
      if (find(id) !== id) continue;
      islands.push({ x: x1[id], y: y1[id], w: (x2[id] - x1[id]) + 1, h: (y2[id] - y1[id]) + 1, pixelCount: pixels[id] });
    }
    return islands;
  }

  function sortIslandsByRows(islands, tolerance) {
    const pending = [...islands].sort((a, b) => (a.y - b.y) || (a.x - b.x)); const rows = [];
    pending.forEach((island) => {
      let row = rows.find((candidate) => Math.abs(island.y - candidate.anchorY) <= tolerance);
      if (!row) { row = { anchorY: island.y, items: [] }; rows.push(row); }
      row.items.push(island);
    });
    return rows.sort((a, b) => a.anchorY - b.anchorY).flatMap((row) => row.items.sort((a, b) => (a.x - b.x) || (a.y - b.y)));
  }

  async function scanSourceImage({ preserveNames = false } = {}) {
    if (!state.sourceImageData) return;
    setHeaderStatus('SCANNING'); setHubStatus('ImgAutoCut: scanning the source alpha channel.');
    refs.workspaceSummary.textContent = 'Reading alpha data and grouping independent visual islands…'; await nextFrame();
    const islands = detectAlphaIslands(state.sourceImageData, state.sourceWidth, state.sourceHeight, alphaThreshold());
    const ordered = sortIslandsByRows(islands, rowTolerance()), priorNames = preserveNames ? state.slices.filter((slice) => !slice.manualAdded).map((slice) => slice.name) : [];
    state.slices = ordered.map((bounds, index) => { const slice = makeSlice(bounds, index); slice.name = priorNames[index] || ''; return slice; });
    state.originalSlices = state.slices.map((slice) => ({ ...slice })); refreshAll(); setHeaderStatus(state.slices.length ? 'READY' : 'NO ISLANDS');
    const details = state.slices.length === 1 ? '1 independent asset detected.' : `${state.slices.length} independent assets detected.`;
    refs.workspaceSummary.textContent = `${details} Click a box to select it; drag inside a box to reposition it, or drag a handle to resize it.`;
    setHubStatus(`ImgAutoCut: ${details}`); setTimeout(clearHubStatus, 1500);
  }

  function selectedSlices() { return state.slices.filter((slice) => slice.selected); }
  function updateSliceStats() {
    const count = state.slices.length;
    refs.sliceStat.textContent = `${count} ${count === 1 ? 'ASSET' : 'ASSETS'}`;
    refs.toggleLedger.textContent = refs.ledgerShell.hidden ? 'OPEN LEDGER' : 'CLOSE LEDGER';
    refs.zoomOpen.disabled = !state.image;
    refs.smartFilter.disabled = !state.image || state.slices.filter((slice) => !slice.manualAdded && !slice.manual).length < 2;
  }
  function updateSelectionInfo() {
    const selected = selectedSlices();
    const manualAdded = state.slices.filter((slice) => slice.manualAdded).length;
    const macroLocked = state.slices.filter((slice) => slice.manual && !slice.manualAdded).length;
    const detected = state.slices.length - manualAdded;
    const summary = [`${selected.length} selected`, `${detected} detected`];
    if (manualAdded) summary.push(`${manualAdded} added manually`);
    if (macroLocked) summary.push(`${macroLocked} manual / macro-locked`);
    refs.selectionInfo.textContent = state.slices.length ? summary.join(' · ') : 'No slices are selected.';
    refs.toggleMulti.textContent = `MULTI: ${state.multiSelect ? 'ON' : 'OFF'}`;
    refs.toggleMulti.classList.toggle('active', state.multiSelect);
    refs.manageSelections.classList.toggle('active', !refs.selectionManager.hidden);
  }
  function selectionChanged() { renderCanvas(); renderSelectionManager(); updateSelectionInfo(); if (state.zoom.open) renderZoomCanvas(); }
  function refreshAll() { renderCanvas(); renderLedger(); renderSelectionManager(); updateSliceStats(); updateSelectionInfo(); if (state.zoom.open) renderZoomCanvas(); }

  function checkerboard(width, height) {
    const cell = 12;
    for (let y = 0; y < height; y += cell) for (let x = 0; x < width; x += cell) { ctx.fillStyle = ((x / cell) + (y / cell)) % 2 === 0 ? '#252727' : '#171919'; ctx.fillRect(x, y, cell, cell); }
  }
  function resizeDisplayCanvas() {
    if (!state.image) return;
    const rect = refs.dropZone.getBoundingClientRect(), maxWidth = Math.max(260, rect.width - 2), maxHeight = 560;
    const displayScale = Math.min(maxWidth / state.sourceWidth, maxHeight / state.sourceHeight, 1), cssWidth = Math.max(1, Math.round(state.sourceWidth * displayScale)), cssHeight = Math.max(1, Math.round(state.sourceHeight * displayScale));
    refs.canvas.style.width = `${cssWidth}px`; refs.canvas.style.height = `${cssHeight}px`; refs.dropZone.style.minHeight = `${Math.max(250, Math.min(maxHeight, cssHeight + 24))}px`;
    const dpr = Math.max(1, window.devicePixelRatio || 1); refs.canvas.width = Math.round(cssWidth * dpr); refs.canvas.height = Math.round(cssHeight * dpr);
    state.view = { x: 0, y: 0, scale: displayScale, width: cssWidth, height: cssHeight, dpr };
  }
  function renderCanvas() {
    if (!state.image) return;
    resizeDisplayCanvas(); const { width, height, dpr, scale } = state.view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height); checkerboard(width, height); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(state.image, 0, 0, state.sourceWidth * scale, state.sourceHeight * scale);
    state.slices.forEach((slice, index) => {
      const x = slice.x * scale, y = slice.y * scale, w = slice.w * scale, h = slice.h * scale, accent = slice.manual ? '#449e92' : '#75b2de';
      ctx.save(); ctx.lineWidth = slice.selected ? 2.5 : 1.25; ctx.strokeStyle = accent; ctx.fillStyle = slice.selected ? 'rgba(117,178,222,.14)' : 'rgba(0,0,0,.04)'; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
      ctx.font = '600 10px Geist Mono, monospace'; const label = slice.manualAdded ? 'M' : String(index + 1), tagW = Math.max(18, ctx.measureText(label).width + 8);
      ctx.fillStyle = accent; ctx.fillRect(x, Math.max(0, y - 14), tagW, 14); ctx.fillStyle = '#101211'; ctx.fillText(label, x + 4, Math.max(10, y - 4));
      if (slice.selected) {
        ctx.fillStyle = '#f5f0db'; ctx.strokeStyle = accent; ctx.lineWidth = 1;
        [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      }
      ctx.restore();
    });
  }
  function renderLedger() {
    refs.ledgerBody.innerHTML = state.slices.map((slice, index) => {
      const generated = sanitizeFilename(slice.name, index, refs.exportFormat.value).replace(/\.(png|webp)$/i, '');
      const stateText = slice.manualAdded ? 'MANUAL BOX' : (slice.manual ? 'MANUAL' : 'AUTO');
      return `<tr data-slice-id="${escapedText(slice.id)}"><td>${index + 1}</td><td><input type="text" class="ledger-name" data-index="${index}" value="${escapedText(slice.name || generated)}" aria-label="File name for asset ${index + 1}" spellcheck="false" autocomplete="off"></td><td>${Math.round(slice.w)} × ${Math.round(slice.h)}</td><td><span class="ledger-state-cell"><span class="${slice.manual ? 'state-manual' : 'state-auto'}">${stateText}</span><button type="button" class="ledger-delete" data-ledger-delete="${escapedText(slice.id)}" title="Delete this asset" aria-label="Delete asset ${index + 1}">×</button></span></td></tr>`;
    }).join('') || '<tr><td colspan="4">No image islands are available yet.</td></tr>';
  }
  function renderSelectionManager() {
    if (!refs.selectionManagerList) return;
    if (!state.image) {
      refs.selectionManagerList.innerHTML = '<div class="selection-manager-empty">Load an image sheet before adding or removing selections.</div>';
      return;
    }
    const managerEntries = state.slices.map((slice, index) => ({ slice, index }));
    if (state.managerSort === 'largest') managerEntries.sort((a, b) => (b.slice.w * b.slice.h) - (a.slice.w * a.slice.h) || a.index - b.index);
    else if (state.managerSort === 'smallest') managerEntries.sort((a, b) => (a.slice.w * a.slice.h) - (b.slice.w * b.slice.h) || a.index - b.index);
    refs.selectionManagerList.innerHTML = managerEntries.map(({ slice, index }) => {
      const kind = slice.manualAdded ? 'MANUAL BOX' : (slice.manual ? 'ADJUSTED' : 'AUTO');
      const kindClass = slice.manual ? 'manual' : 'auto';
      const generatedName = sanitizeFilename(slice.name, index, refs.exportFormat.value).replace(/\.(png|webp)$/i, '');
      const displayName = slice.name || generatedName;
      return `<div class="selection-manager-row${slice.selected ? ' is-selected' : ''}" data-slice-id="${escapedText(slice.id)}">
        <span class="selection-manager-number">${slice.manualAdded ? 'M' : index + 1}</span>
        <button type="button" class="selection-manager-focus" data-focus-slice="${escapedText(slice.id)}" title="Select this box in the workspace"><span class="selection-manager-name">${escapedText(displayName)}</span></button>
        <span class="selection-manager-dimensions">${Math.round(slice.w)} × ${Math.round(slice.h)}</span>
        <span class="selection-manager-state ${kindClass}">${kind}</span>
        <button type="button" class="selection-delete" data-remove-slice="${escapedText(slice.id)}" title="Delete this selection" aria-label="Delete selection ${index + 1}">🗑</button>
      </div>`;
    }).join('') || '<div class="selection-manager-empty">There are no selections left. Use + ADD BOX to create one.</div>';
  }
  function distributeNames(startIndex, text) {
    const names = text.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean); if (!names.length) return;
    names.forEach((name, offset) => { const target = state.slices[startIndex + offset]; if (target) target.name = name; }); renderLedger(); renderSelectionManager();
    toast(`${Math.min(names.length, Math.max(0, state.slices.length - startIndex))} ledger names applied.`); setHubStatus('ImgAutoCut: distributed pasted names through the ledger.'); setTimeout(clearHubStatus, 1200);
  }

  function propagateLedgerNames() {
    if (!state.slices.length) { toast('There are no assets to name.'); return; }
    const rawBase = refs.ledgerPropagateName.value.trim().replace(/\.(png|webp)$/i, '');
    const base = rawBase.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').trim();
    if (!base) { toast('Enter a name before pressing Propagate.'); refs.ledgerPropagateName.focus(); return; }
    const start = Math.max(0, Math.trunc(Number(refs.ledgerStartNumber.value) || 0));
    refs.ledgerStartNumber.value = String(start);
    const last = start + Math.max(0, state.slices.length - 1);
    const digits = Math.max(2, String(last).length);
    state.slices.forEach((slice, index) => { slice.name = `${base}${String(start + index).padStart(digits, '0')}`; });
    renderLedger(); renderSelectionManager();
    toast(`${state.slices.length} names propagated from ${base}${String(start).padStart(digits, '0')}.`);
  }

  function imagePointFromEvent(event) { const rect = refs.canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) / state.view.scale, y: (event.clientY - rect.top) / state.view.scale }; }
  function sliceAtPoint(point) {
    for (let i = state.slices.length - 1; i >= 0; i -= 1) { const slice = state.slices[i]; if (point.x >= slice.x && point.x <= slice.x + slice.w && point.y >= slice.y && point.y <= slice.y + slice.h) return { slice, index: i }; }
    return null;
  }
  function handleAtPoint(slice, point) {
    const threshold = 8 / state.view.scale, candidates = [{ mode: 'nw', x: slice.x, y: slice.y }, { mode: 'ne', x: slice.x + slice.w, y: slice.y }, { mode: 'sw', x: slice.x, y: slice.y + slice.h }, { mode: 'se', x: slice.x + slice.w, y: slice.y + slice.h }];
    return candidates.find((candidate) => Math.abs(point.x - candidate.x) <= threshold && Math.abs(point.y - candidate.y) <= threshold) || null;
  }
  function selectSlice(slice, additive) { if (!additive) state.slices.forEach((item) => { item.selected = false; }); slice.selected = additive ? !slice.selected : true; selectionChanged(); }
  function pointerDown(event) {
    if (!state.image) return; event.preventDefault(); const point = imagePointFromEvent(event), hit = sliceAtPoint(point);
    if (!hit) { if (!event.shiftKey && !state.multiSelect) { state.slices.forEach((slice) => { slice.selected = false; }); selectionChanged(); } return; }
    const additive = state.multiSelect || event.shiftKey;
    if (!additive) selectSlice(hit.slice, false); else if (!hit.slice.selected) { hit.slice.selected = true; selectionChanged(); }
    const handle = hit.slice.selected ? handleAtPoint(hit.slice, point) : null;
    state.pointer = { slice: hit.slice, mode: handle ? handle.mode : 'move', startPoint: point, startBox: { x: hit.slice.x, y: hit.slice.y, w: hit.slice.w, h: hit.slice.h } };
    refs.canvas.setPointerCapture?.(event.pointerId);
  }
  function clampManualBox(slice) {
    if (!slice.manualAdded) return;
    slice.w = Math.min(Math.max(1, slice.w), state.sourceWidth);
    slice.h = Math.min(Math.max(1, slice.h), state.sourceHeight);
    slice.x = Math.min(Math.max(0, slice.x), Math.max(0, state.sourceWidth - slice.w));
    slice.y = Math.min(Math.max(0, slice.y), Math.max(0, state.sourceHeight - slice.h));
  }
  function pointerMove(event) {
    if (!state.pointer) return; event.preventDefault(); const point = imagePointFromEvent(event), { slice, mode, startPoint, startBox } = state.pointer, dx = point.x - startPoint.x, dy = point.y - startPoint.y, minimum = 1;
    if (mode === 'move') { slice.x = startBox.x + dx; slice.y = startBox.y + dy; }
    else {
      let { x, y, w, h } = startBox;
      if (mode.includes('e')) w = Math.max(minimum, startBox.w + dx); if (mode.includes('s')) h = Math.max(minimum, startBox.h + dy);
      if (mode.includes('w')) { x = startBox.x + dx; w = Math.max(minimum, startBox.w - dx); if (w === minimum) x = startBox.x + startBox.w - minimum; }
      if (mode.includes('n')) { y = startBox.y + dy; h = Math.max(minimum, startBox.h - dy); if (h === minimum) y = startBox.y + startBox.h - minimum; }
      slice.x = x; slice.y = y; slice.w = w; slice.h = h;
    }
    slice.manual = true; clampManualBox(slice); renderCanvas(); renderLedger(); renderSelectionManager(); updateSelectionInfo();
  }
  function pointerUp(event) { if (!state.pointer) return; refs.canvas.releasePointerCapture?.(event.pointerId); state.pointer = null; }
  function setCursor(event) { if (!state.image || state.pointer) return; const point = imagePointFromEvent(event), hit = sliceAtPoint(point); refs.canvas.style.cursor = !hit ? 'crosshair' : (handleAtPoint(hit.slice, point) ? `${handleAtPoint(hit.slice, point).mode}-resize` : 'move'); }

  function setAllSelected(selected) { state.slices.forEach((slice) => { slice.selected = selected; }); selectionChanged(); }
  function makeUniformSize() {
    const targets = selectedSlices().filter((slice) => !slice.manual);
    if (!targets.length) { toast('Select at least one automatic box. Manually adjusted boxes stay macro-locked.'); return; }
    const maxW = Math.max(...targets.map((slice) => slice.w)), maxH = Math.max(...targets.map((slice) => slice.h));
    targets.forEach((slice) => { const centreX = slice.x + (slice.w / 2), centreY = slice.y + (slice.h / 2); slice.x = centreX - (maxW / 2); slice.y = centreY - (maxH / 2); slice.w = maxW; slice.h = maxH; });
    refreshAll(); toast(`${targets.length} boxes padded and centred to ${Math.round(maxW)} × ${Math.round(maxH)}.`); setHubStatus('ImgAutoCut: selected automatic boxes now share a uniform transparent canvas.'); setTimeout(clearHubStatus, 1600);
  }
  function smartFilterTinyIslands() {
    const automatic = state.slices.filter((slice) => !slice.manualAdded && !slice.manual);
    if (automatic.length < 2) { toast('Smart Filter needs at least two untouched automatic detections.'); return; }

    const areas = automatic.map((slice) => Math.max(1, slice.w * slice.h)).sort((a, b) => a - b);
    const pixelCounts = automatic.map((slice) => Math.max(1, slice.pixelCount || 1)).sort((a, b) => a - b);
    const referenceCount = Math.max(1, Math.ceil(automatic.length * .25));
    const median = (values) => {
      const middle = Math.floor(values.length / 2);
      return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    };
    const referenceArea = median(areas.slice(-referenceCount));
    const referencePixels = median(pixelCounts.slice(-referenceCount));
    const minimumArea = Math.max(4, referenceArea * .08);
    const minimumPixels = Math.max(2, referencePixels * .05);
    const before = state.slices.length;

    state.slices = state.slices.filter((slice) => {
      if (slice.manualAdded || slice.manual) return true;
      const area = Math.max(1, slice.w * slice.h);
      const pixels = Math.max(1, slice.pixelCount || 1);
      return !(area < minimumArea && pixels < minimumPixels);
    });

    const removed = before - state.slices.length;
    refreshAll();
    if (!removed) {
      toast('Smart Filter found no obvious tiny artefacts to remove.');
      return;
    }
    refs.workspaceSummary.textContent = `Smart Filter removed ${removed} tiny alpha island${removed === 1 ? '' : 's'}. ${state.slices.length} assets remain. Reset Scan restores the full detection.`;
    toast(`Smart Filter removed ${removed} tiny detection${removed === 1 ? '' : 's'}. Reset Scan restores them.`);
    setHubStatus(`ImgAutoCut: Smart Filter removed ${removed} tiny alpha islands.`); setTimeout(clearHubStatus, 1600);
  }

  function resetScan() {
    if (!state.sourceImageData) return;
    state.slices = state.originalSlices.map(cloneForReset);
    refreshAll(); toast('Manual boxes, moves, resizes, and selections were reset to the last alpha scan.'); setHubStatus('ImgAutoCut: reset to the pure alpha-detected slice layout.'); setTimeout(clearHubStatus, 1400);
  }
  function addManualSelection() {
    if (!state.image) { toast('Load an image sheet before adding a manual box.'); return; }
    const width = Math.max(16, Math.min(Math.round(state.sourceWidth * .22), 240));
    const height = Math.max(16, Math.min(Math.round(state.sourceHeight * .22), 240));
    const gap = Math.max(8, Math.round(Math.min(state.sourceWidth, state.sourceHeight) * .02));
    const lowestBox = state.slices.reduce((lowest, slice) => Math.max(lowest, slice.y + slice.h), 0);
    const x = Math.max(0, Math.min(Math.round((state.sourceWidth - width) / 2), state.sourceWidth - width));
    const y = Math.max(0, Math.min(Math.round(lowestBox + gap), state.sourceHeight - height));
    const slice = makeSlice({ x, y, w: width, h: height, pixelCount: 0 }, state.slices.length);
    slice.manual = true; slice.manualAdded = true; slice.selected = true;
    state.slices.forEach((item) => { item.selected = false; });
    state.slices.push(slice);
    refreshAll();
    toast('Manual box added. Drag it over the missing asset, then resize its corner handles.');
    setHubStatus('ImgAutoCut: added a manual selection box.'); setTimeout(clearHubStatus, 1500);
  }
  function removeSlice(id) {
    const index = state.slices.findIndex((slice) => slice.id === id);
    if (index < 0) return;
    const [removed] = state.slices.splice(index, 1);
    refreshAll();
    toast(`${removed.manualAdded ? 'Manual box' : 'Detected selection'} removed. Reset Scan restores the original alpha scan.`);
    setHubStatus('ImgAutoCut: selection removed from this working sheet.'); setTimeout(clearHubStatus, 1500);
  }
  function focusSlice(id) {
    const slice = state.slices.find((item) => item.id === id);
    if (!slice) return;
    state.slices.forEach((item) => { item.selected = item === slice; });
    selectionChanged();
    refs.dropZone.focus({ preventScroll: true });
  }

  function zoomScaleFromInput() { return Math.max(.1, Math.min(5, Number(refs.zoomRange.value || 100) / 100)); }
  function applyZoomScale(scale) {
    const bounded = Math.max(.1, Math.min(5, scale));
    state.zoom.scale = bounded;
    refs.zoomRange.value = String(Math.round(bounded * 100 / 5) * 5);
    refs.zoomValue.textContent = `${Math.round(bounded * 100)}%`;
    renderZoomCanvas();
  }
  function fitZoomToWindow() {
    if (!state.image || !state.zoom.open) return;
    const width = Math.max(120, refs.zoomScroll.clientWidth - 32);
    const height = Math.max(120, refs.zoomScroll.clientHeight - 32);
    applyZoomScale(Math.min(width / state.sourceWidth, height / state.sourceHeight, 5));
    refs.zoomScroll.scrollLeft = 0; refs.zoomScroll.scrollTop = 0;
  }
  function updateZoomToolbarState() {
    if (!refs.zoomDuplicate) return;
    const count = selectedSlices().length;
    refs.zoomDuplicate.disabled = count === 0;
    refs.zoomDelete.disabled = count === 0;
    refs.zoomSelectBox.classList.toggle('active', state.zoom.selectBoxMode);
    refs.zoomSelectBox.setAttribute('aria-pressed', state.zoom.selectBoxMode ? 'true' : 'false');
  }
  function normalizedMarquee() {
    if (!state.zoom.marquee) return null;
    const { start, current } = state.zoom.marquee;
    return {
      x: Math.min(start.x, current.x), y: Math.min(start.y, current.y),
      w: Math.abs(current.x - start.x), h: Math.abs(current.y - start.y)
    };
  }
  function renderZoomCanvas() {
    if (!state.zoom.open || !state.image) return;
    const scale = state.zoom.scale;
    refs.zoomCanvas.width = state.sourceWidth; refs.zoomCanvas.height = state.sourceHeight;
    refs.zoomCanvas.style.width = `${Math.max(1, Math.round(state.sourceWidth * scale))}px`;
    refs.zoomCanvas.style.height = `${Math.max(1, Math.round(state.sourceHeight * scale))}px`;
    zoomCtx.clearRect(0, 0, state.sourceWidth, state.sourceHeight);
    const cell = Math.max(2, 12 / scale);
    for (let y = 0; y < state.sourceHeight; y += cell) for (let x = 0; x < state.sourceWidth; x += cell) {
      zoomCtx.fillStyle = ((Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0) ? '#252727' : '#171919';
      zoomCtx.fillRect(x, y, cell, cell);
    }
    zoomCtx.drawImage(state.image, 0, 0, state.sourceWidth, state.sourceHeight);
    state.slices.forEach((slice, index) => {
      const normalAccent = slice.manual ? '#449e92' : '#75b2de';
      const accent = slice.selected ? '#ff4d7a' : normalAccent;
      const line = (slice.selected ? 4 : 1.25) / scale;
      const radius = (slice.selected ? 7 : 6) / scale;
      zoomCtx.save();
      zoomCtx.lineWidth = line; zoomCtx.strokeStyle = accent;
      zoomCtx.fillStyle = slice.selected ? 'rgba(255,77,122,.22)' : 'rgba(0,0,0,.025)';
      zoomCtx.fillRect(slice.x, slice.y, slice.w, slice.h); zoomCtx.strokeRect(slice.x, slice.y, slice.w, slice.h);
      zoomCtx.font = `700 ${slice.selected ? 12 / scale : 10 / scale}px Geist Mono, monospace`;
      const label = slice.manualAdded && !slice.duplicateOf ? 'M' : String(index + 1);
      const tagH = (slice.selected ? 18 : 14) / scale; const tagW = Math.max((slice.selected ? 24 : 18) / scale, zoomCtx.measureText(label).width + (10 / scale));
      zoomCtx.fillStyle = accent; zoomCtx.fillRect(slice.x, Math.max(0, slice.y - tagH), tagW, tagH);
      zoomCtx.fillStyle = slice.selected ? '#ffffff' : '#101211';
      zoomCtx.fillText(label, slice.x + (5 / scale), Math.max((slice.selected ? 13 : 10) / scale, slice.y - (4 / scale)));
      zoomCtx.fillStyle = slice.selected ? '#fff7d6' : '#f5f0db'; zoomCtx.strokeStyle = accent; zoomCtx.lineWidth = (slice.selected ? 1.5 : 1) / scale;
      [[slice.x, slice.y], [slice.x + slice.w, slice.y], [slice.x, slice.y + slice.h], [slice.x + slice.w, slice.y + slice.h]].forEach(([x, y]) => {
        zoomCtx.beginPath(); zoomCtx.arc(x, y, radius, 0, Math.PI * 2); zoomCtx.fill(); zoomCtx.stroke();
      });
      zoomCtx.restore();
    });
    const marquee = normalizedMarquee();
    if (marquee) {
      zoomCtx.save();
      zoomCtx.setLineDash([8 / scale, 5 / scale]);
      zoomCtx.lineWidth = 2 / scale;
      zoomCtx.strokeStyle = '#ffd36a';
      zoomCtx.fillStyle = 'rgba(255,211,106,.12)';
      zoomCtx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
      zoomCtx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h);
      zoomCtx.restore();
    }
    updateZoomToolbarState();
  }
  function openZoomInspector() {
    if (!state.image) { toast('Load an image sheet before opening Zoom.'); return; }
    refs.zoomModal.hidden = false; state.zoom.open = true; state.zoom.pointer = null; state.zoom.marquee = null;
    updateZoomToolbarState(); requestAnimationFrame(() => fitZoomToWindow());
  }
  function closeZoomInspector() {
    state.zoom.open = false; state.zoom.pointer = null; state.zoom.marquee = null; refs.zoomModal.hidden = true; renderCanvas();
  }
  function zoomImagePoint(event) {
    const rect = refs.zoomCanvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * state.sourceWidth / Math.max(1, rect.width), y: (event.clientY - rect.top) * state.sourceHeight / Math.max(1, rect.height) };
  }
  function zoomHandleAtPoint(slice, point) {
    const threshold = 10 / state.zoom.scale;
    const handles = [{ mode: 'nw', x: slice.x, y: slice.y }, { mode: 'ne', x: slice.x + slice.w, y: slice.y }, { mode: 'sw', x: slice.x, y: slice.y + slice.h }, { mode: 'se', x: slice.x + slice.w, y: slice.y + slice.h }];
    return handles.find((handle) => Math.hypot(point.x - handle.x, point.y - handle.y) <= threshold) || null;
  }
  function zoomHitAtPoint(point) {
    for (let i = state.slices.length - 1; i >= 0; i -= 1) {
      const handle = zoomHandleAtPoint(state.slices[i], point); if (handle) return { slice: state.slices[i], mode: handle.mode };
    }
    const hit = sliceAtPoint(point); return hit ? { slice: hit.slice, mode: 'move' } : null;
  }
  function marqueeTouchesSlice(rect, slice) {
    return rect.x <= slice.x + slice.w && rect.x + rect.w >= slice.x && rect.y <= slice.y + slice.h && rect.y + rect.h >= slice.y;
  }
  function zoomPointerDown(event) {
    if (!state.image) return;
    const point = zoomImagePoint(event), hit = zoomHitAtPoint(point);
    if (!hit) {
      if (!state.zoom.selectBoxMode) return;
      event.preventDefault();
      state.zoom.marquee = { start: point, current: point };
      refs.zoomCanvas.setPointerCapture?.(event.pointerId);
      renderZoomCanvas();
      return;
    }
    event.preventDefault();
    const wasSelected = hit.slice.selected;
    if (hit.mode !== 'move' && !wasSelected) { hit.slice.selected = true; selectionChanged(); }
    state.zoom.pointer = {
      slice: hit.slice, mode: hit.mode, startPoint: point,
      startBox: { x: hit.slice.x, y: hit.slice.y, w: hit.slice.w, h: hit.slice.h },
      wasSelected, moved: false
    };
    refs.zoomCanvas.setPointerCapture?.(event.pointerId);
  }
  function zoomPointerMove(event) {
    const point = zoomImagePoint(event);
    if (state.zoom.marquee) {
      event.preventDefault(); state.zoom.marquee.current = point; renderZoomCanvas(); return;
    }
    if (!state.zoom.pointer) {
      const hit = zoomHitAtPoint(point);
      refs.zoomCanvas.style.cursor = !hit ? (state.zoom.selectBoxMode ? 'crosshair' : 'default') : (hit.mode === 'move' ? 'move' : `${hit.mode}-resize`);
      return;
    }
    event.preventDefault();
    const pointer = state.zoom.pointer;
    const { slice, mode, startPoint, startBox } = pointer;
    const dx = point.x - startPoint.x, dy = point.y - startPoint.y, minimum = 1;
    if (!pointer.moved && Math.hypot(dx, dy) * state.zoom.scale < 3) return;
    if (!pointer.moved) {
      pointer.moved = true;
      if (!slice.selected) { slice.selected = true; selectionChanged(); }
    }
    if (mode === 'move') { slice.x = startBox.x + dx; slice.y = startBox.y + dy; }
    else {
      let { x, y, w, h } = startBox;
      if (mode.includes('e')) w = Math.max(minimum, startBox.w + dx); if (mode.includes('s')) h = Math.max(minimum, startBox.h + dy);
      if (mode.includes('w')) { x = startBox.x + dx; w = Math.max(minimum, startBox.w - dx); if (w === minimum) x = startBox.x + startBox.w - minimum; }
      if (mode.includes('n')) { y = startBox.y + dy; h = Math.max(minimum, startBox.h - dy); if (h === minimum) y = startBox.y + startBox.h - minimum; }
      slice.x = x; slice.y = y; slice.w = w; slice.h = h;
    }
    slice.manual = true; clampManualBox(slice); renderZoomCanvas(); renderCanvas(); renderLedger(); renderSelectionManager(); updateSelectionInfo();
  }
  function zoomPointerUp(event) {
    if (state.zoom.marquee) {
      const rect = normalizedMarquee();
      refs.zoomCanvas.releasePointerCapture?.(event.pointerId);
      state.zoom.marquee = null;
      if (rect && (rect.w > 1 / state.zoom.scale || rect.h > 1 / state.zoom.scale)) {
        state.slices.forEach((slice) => { if (marqueeTouchesSlice(rect, slice)) slice.selected = true; });
      }
      selectionChanged();
      return;
    }
    if (!state.zoom.pointer) return;
    refs.zoomCanvas.releasePointerCapture?.(event.pointerId);
    const pointer = state.zoom.pointer; state.zoom.pointer = null;
    if (!pointer.moved) {
      if (pointer.mode === 'move') pointer.slice.selected = !pointer.wasSelected;
      else pointer.slice.selected = true;
      selectionChanged();
    } else renderZoomCanvas();
  }
  function toggleZoomBoxSelect() {
    state.zoom.selectBoxMode = !state.zoom.selectBoxMode;
    state.zoom.marquee = null; updateZoomToolbarState(); renderZoomCanvas();
    toast(state.zoom.selectBoxMode ? 'Box selection is on. Drag an empty area around the boxes you want.' : 'Box selection is off.');
  }
  function invertZoomSelection() {
    state.slices.forEach((slice) => { slice.selected = !slice.selected; }); selectionChanged();
  }
  function deleteZoomSelection() {
    const chosen = selectedSlices();
    if (!chosen.length) return;
    const chosenIds = new Set(chosen.map((slice) => slice.id));
    state.slices = state.slices.filter((slice) => !chosenIds.has(slice.id));
    refreshAll();
    toast(`${chosen.length} selected box${chosen.length === 1 ? '' : 'es'} deleted. Reset Scan restores original automatic detections.`);
  }
  function duplicateZoomSelection() {
    const chosen = selectedSlices();
    if (!chosen.length) return;
    const offset = Math.max(4, Math.round(Math.min(state.sourceWidth, state.sourceHeight) * .015));
    state.slices.forEach((slice) => { slice.selected = false; });
    const copies = chosen.map((original, index) => {
      const x = Math.min(Math.max(0, original.x + offset), Math.max(0, state.sourceWidth - original.w));
      const y = Math.min(Math.max(0, original.y + offset), Math.max(0, state.sourceHeight - original.h));
      const copy = makeSlice({ x, y, w: original.w, h: original.h, pixelCount: 0 }, state.slices.length + index);
      copy.manual = true; copy.manualAdded = true; copy.duplicateOf = original.id; copy.selected = true; copy.name = '';
      return copy;
    });
    state.slices.push(...copies); refreshAll();
    toast(`${copies.length} box${copies.length === 1 ? '' : 'es'} duplicated and selected.`);
  }

  function blobFromCanvas(canvas, type, quality) { return new Promise((resolve) => canvas.toBlob(resolve, type, quality)); }
  async function renderSliceBlob(slice, type) {
    const width = Math.max(1, Math.ceil(slice.w)), height = Math.max(1, Math.ceil(slice.h)), canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height; const exportCtx = canvas.getContext('2d'); exportCtx.clearRect(0, 0, width, height);
    if (slice.manualAdded) {
      exportCtx.drawImage(sourceCanvas, Math.round(slice.x), Math.round(slice.y), Math.ceil(slice.w), Math.ceil(slice.h), 0, 0, width, height);
    } else {
      exportCtx.drawImage(sourceCanvas, slice.ox, slice.oy, slice.ow, slice.oh, slice.ox - slice.x, slice.oy - slice.y, slice.ow, slice.oh);
    }
    return blobFromCanvas(canvas, type, .92);
  }
  function exportTargets() { const chosen = selectedSlices(); return chosen.length ? chosen : state.slices; }
  function safeErrorMessage(error) { if (!error) return 'Unknown export error.'; if (error.name === 'AbortError') return 'Folder selection was cancelled.'; return error.message || String(error); }
  async function exportAssets() {
    const targets = exportTargets();
    if (!state.image || !targets.length) { toast('Load a sheet and detect at least one asset before exporting.'); return; }
    const extension = refs.exportFormat.value, type = extension === 'webp' ? 'image/webp' : 'image/png', total = targets.length;
    refs.exportAssets.disabled = true; setHeaderStatus('EXPORTING'); setHubStatus(`ImgAutoCut: preparing ${total} ${extension.toUpperCase()} asset${total === 1 ? '' : 's'}.`);
    try {
      const files = [];
      for (let index = 0; index < targets.length; index += 1) {
        refs.exportAssets.textContent = `PREPARING ${index + 1} / ${total}`; const slice = targets[index], blob = await renderSliceBlob(slice, type); if (!blob) throw new Error(`Could not render asset ${index + 1}.`);
        files.push({ name: sanitizeFilename(slice.name, state.slices.indexOf(slice), extension), blob });
      }
      if (typeof window.showDirectoryPicker === 'function') {
        try {
          refs.exportAssets.textContent = 'CHOOSE FOLDER'; const directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
          for (let index = 0; index < files.length; index += 1) {
            refs.exportAssets.textContent = `SAVING ${index + 1} / ${total}`; const fileHandle = await directoryHandle.getFileHandle(files[index].name, { create: true }); const writer = await fileHandle.createWritable(); await writer.write(files[index].blob); await writer.close();
          }
          toast(`${total} asset${total === 1 ? '' : 's'} saved to the chosen folder.`); setHubStatus(`ImgAutoCut: saved ${total} files to the selected folder.`); return;
        } catch (error) {
          if (error?.name === 'AbortError') { toast('Folder selection cancelled. Nothing was exported.'); setHubStatus('ImgAutoCut: export cancelled before files were written.'); return; }
          console.warn('Folder export unavailable; using browser downloads.', error); toast('Folder saving was unavailable, so browser downloads are starting.');
        }
      }
      for (let index = 0; index < files.length; index += 1) {
        refs.exportAssets.textContent = `DOWNLOADING ${index + 1} / ${total}`; const url = URL.createObjectURL(files[index].blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = files[index].name; anchor.style.display = 'none'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 4500); await new Promise((resolve) => setTimeout(resolve, 110));
      }
      toast(`${total} asset${total === 1 ? '' : 's'} sent to browser downloads.`); setHubStatus(`ImgAutoCut: ${total} files exported through browser downloads.`);
    } catch (error) { console.error(error); toast(`Export failed: ${safeErrorMessage(error)}`); setHubStatus(`ImgAutoCut export error: ${safeErrorMessage(error)}`); }
    finally { refs.exportAssets.disabled = false; refs.exportAssets.textContent = 'EXPORT DETECTED ASSETS'; setHeaderStatus(state.slices.length ? 'READY' : 'NO SHEET'); setTimeout(clearHubStatus, 1800); }
  }

  async function loadSourceImage(blob, displayName = 'Clipboard image') {
    if (!blob || !blob.type?.startsWith('image/')) { toast('That item is not an image file.'); return; }
    setHeaderStatus('LOADING'); setHubStatus('ImgAutoCut: loading source image into local memory.'); const objectUrl = URL.createObjectURL(blob), image = new Image(); image.decoding = 'async';
    try {
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('The image could not be decoded by this browser.')); image.src = objectUrl; });
      state.image = image; state.sourceName = displayName; state.sourceWidth = image.naturalWidth || image.width; state.sourceHeight = image.naturalHeight || image.height;
      sourceCanvas.width = state.sourceWidth; sourceCanvas.height = state.sourceHeight; sourceCtx.clearRect(0, 0, state.sourceWidth, state.sourceHeight); sourceCtx.drawImage(image, 0, 0); state.sourceImageData = sourceCtx.getImageData(0, 0, state.sourceWidth, state.sourceHeight);
      refs.sourceFileName.textContent = displayName; refs.emptyState.hidden = true; refs.canvas.style.display = 'block'; refs.dropZone.classList.remove('dragover'); await scanSourceImage();
    } catch (error) { console.error(error); toast(`Could not load image: ${safeErrorMessage(error)}`); setHeaderStatus('LOAD ERROR'); setHubStatus(`ImgAutoCut load error: ${safeErrorMessage(error)}`); }
    finally { URL.revokeObjectURL(objectUrl); }
  }

  function reorderByTolerance() {
    if (!state.sourceImageData) return;
    const manualBoxes = state.slices.filter((slice) => slice.manualAdded);
    const autoSlices = state.slices.filter((slice) => !slice.manualAdded);
    const ordered = sortIslandsByRows(autoSlices.map((slice) => ({ x: slice.ox, y: slice.oy, w: slice.ow, h: slice.oh, pixelCount: slice.pixelCount })), rowTolerance());
    const nameMap = new Map(autoSlices.map((slice) => [`${slice.ox},${slice.oy},${slice.ow},${slice.oh}`, slice.name]));
    const currentByOrigin = new Map(autoSlices.map((slice) => [`${slice.ox},${slice.oy},${slice.ow},${slice.oh}`, slice]));
    const reordered = ordered.map((bounds, index) => {
      const key = `${bounds.x},${bounds.y},${bounds.w},${bounds.h}`;
      const existing = currentByOrigin.get(key);
      const slice = existing ? { ...existing } : makeSlice(bounds, index);
      slice.name = nameMap.get(key) || slice.name || '';
      return slice;
    });
    state.slices = [...reordered, ...manualBoxes];
    state.originalSlices = reordered.map((slice) => ({ ...slice, selected: false }));
    refreshAll();
  }

  function bindInputs() {
    refs.browseSource.addEventListener('click', (event) => { event.preventDefault(); refs.sourceFile.click(); });
    refs.emptyBrowse.addEventListener('click', () => refs.sourceFile.click());
    refs.sourceFile.addEventListener('change', () => { const [file] = refs.sourceFile.files; if (file) loadSourceImage(file, file.name); });
    refs.alphaThreshold.addEventListener('input', updateControlLabels);
    refs.alphaThreshold.addEventListener('change', () => { if (state.sourceImageData) scanSourceImage({ preserveNames: true }); });
    refs.rowTolerance.addEventListener('input', () => { updateControlLabels(); reorderByTolerance(); });
    refs.selectAll.addEventListener('click', () => setAllSelected(true));
    refs.clearSelection.addEventListener('click', () => setAllSelected(false));
    refs.invertSelection.addEventListener('click', () => { state.slices.forEach((slice) => { slice.selected = !slice.selected; }); selectionChanged(); });
    refs.toggleMulti.addEventListener('click', () => { state.multiSelect = !state.multiSelect; updateSelectionInfo(); toast(state.multiSelect ? 'Multi-select is on. Click boxes to add or remove them.' : 'Multi-select is off.'); });
    refs.uniformSize.addEventListener('click', makeUniformSize);
    refs.smartFilter.addEventListener('click', smartFilterTinyIslands);
    refs.resetScan.addEventListener('click', resetScan);
    refs.manageSelections.addEventListener('click', () => { refs.selectionManager.hidden = !refs.selectionManager.hidden; updateSelectionInfo(); });
    refs.addSelection.addEventListener('click', addManualSelection);
    refs.managerSort.addEventListener('change', () => { state.managerSort = refs.managerSort.value; renderSelectionManager(); });
    refs.selectionManagerList.addEventListener('click', (event) => {
      const deleteButton = event.target.closest('[data-remove-slice]');
      if (deleteButton) { removeSlice(deleteButton.dataset.removeSlice); return; }
      const focusButton = event.target.closest('[data-focus-slice]');
      if (focusButton) focusSlice(focusButton.dataset.focusSlice);
    });
    refs.zoomOpen.addEventListener('click', openZoomInspector);
    refs.zoomClose.addEventListener('click', closeZoomInspector);
    refs.zoomFit.addEventListener('click', fitZoomToWindow);
    refs.zoom100.addEventListener('click', () => applyZoomScale(1));
    refs.zoomRange.addEventListener('input', () => applyZoomScale(zoomScaleFromInput()));
    refs.zoomSelectBox.addEventListener('click', toggleZoomBoxSelect);
    refs.zoomSelectAll.addEventListener('click', () => setAllSelected(true));
    refs.zoomInvert.addEventListener('click', invertZoomSelection);
    refs.zoomDuplicate.addEventListener('click', duplicateZoomSelection);
    refs.zoomDelete.addEventListener('click', deleteZoomSelection);
    refs.zoomModal.addEventListener('pointerdown', (event) => { if (event.target === refs.zoomModal) closeZoomInspector(); });
    refs.zoomCanvas.addEventListener('pointerdown', zoomPointerDown);
    refs.zoomCanvas.addEventListener('pointermove', zoomPointerMove);
    refs.zoomCanvas.addEventListener('pointerup', zoomPointerUp);
    refs.zoomCanvas.addEventListener('pointercancel', zoomPointerUp);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.zoom.open) closeZoomInspector(); });
    refs.toggleLedger.addEventListener('click', () => { refs.ledgerShell.hidden = !refs.ledgerShell.hidden; updateSliceStats(); });
    refs.ledgerPropagate.addEventListener('click', propagateLedgerNames);
    refs.ledgerPropagateName.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); propagateLedgerNames(); } });
    refs.exportFormat.addEventListener('change', () => { renderLedger(); renderSelectionManager(); });
    refs.exportAssets.addEventListener('click', exportAssets);
    refs.ledgerBody.addEventListener('click', (event) => {
      const deleteButton = event.target.closest('[data-ledger-delete]');
      if (deleteButton) removeSlice(deleteButton.dataset.ledgerDelete);
    });
    refs.ledgerBody.addEventListener('input', (event) => {
      const input = event.target.closest('.ledger-name');
      if (input && state.slices[Number(input.dataset.index)]) {
        state.slices[Number(input.dataset.index)].name = input.value;
        renderSelectionManager();
      }
    });
    refs.ledgerBody.addEventListener('paste', (event) => {
      const input = event.target.closest('.ledger-name'); if (!input) return;
      const pasted = event.clipboardData?.getData('text/plain') || ''; if (!pasted.includes('\n')) return;
      event.preventDefault(); distributeNames(Number(input.dataset.index), pasted);
    });
    refs.dropZone.addEventListener('dragover', (event) => { event.preventDefault(); refs.dropZone.classList.add('dragover'); });
    refs.dropZone.addEventListener('dragleave', () => refs.dropZone.classList.remove('dragover'));
    refs.dropZone.addEventListener('drop', (event) => { event.preventDefault(); refs.dropZone.classList.remove('dragover'); const [file] = event.dataTransfer?.files || []; if (file) loadSourceImage(file, file.name); });
    document.addEventListener('paste', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const imageItem = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith('image/'));
      if (imageItem) { event.preventDefault(); loadSourceImage(imageItem.getAsFile(), 'Clipboard image'); }
    });
    refs.canvas.addEventListener('pointerdown', pointerDown);
    refs.canvas.addEventListener('pointermove', pointerMove);
    refs.canvas.addEventListener('pointerup', pointerUp);
    refs.canvas.addEventListener('pointercancel', pointerUp);
    refs.canvas.addEventListener('pointerleave', () => { if (!state.pointer) refs.canvas.style.cursor = 'crosshair'; });
    refs.canvas.addEventListener('pointermove', setCursor);
    window.addEventListener('resize', () => { renderCanvas(); if (state.zoom.open) fitZoomToWindow(); });
    if ('ResizeObserver' in window) { state.resizeObserver = new ResizeObserver(renderCanvas); state.resizeObserver.observe(refs.dropZone); }
  }
  function init() {
    initHeader(); updateControlLabels(); bindInputs(); renderSelectionManager();
    setHubStatus('ImgAutoCut Wizard ready: load a transparent source sheet.'); setTimeout(clearHubStatus, 900);
  }
  init();
})();
