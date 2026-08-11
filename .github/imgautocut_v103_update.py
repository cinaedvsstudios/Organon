from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# ---- index.html ----
path = Path('tools/imgautocut/index.html')
text = path.read_text(encoding='utf-8')
text = text.replace('ImgAutoCut v1.02', 'ImgAutoCut v1.03')
text = text.replace('IMGAUTOCUT WIZARD · V1.02', 'IMGAUTOCUT WIZARD · V1.03')
text = text.replace('styles.css?v=1.02', 'styles.css?v=1.03')
text = text.replace('app.js?v=1.02', 'app.js?v=1.03')

ledger_needle = '''        <div class="ledger-shell" id="ledger-shell" hidden>\n          <div class="ledger-note">The compact preview is shown above. Manual boxes are teal and excluded from global uniform-sizing changes.</div>'''
ledger_replacement = '''        <div class="ledger-shell" id="ledger-shell" hidden>\n          <div class="ledger-propagate-bar">\n            <label class="ledger-propagate-name">\n              <span>NAME</span>\n              <input id="ledger-propagate-name" type="text" placeholder="door" maxlength="80" spellcheck="false" autocomplete="off">\n            </label>\n            <label class="ledger-start-number">\n              <span>STARTING NUMBER</span>\n              <input id="ledger-start-number" type="number" min="0" step="1" value="1">\n            </label>\n            <button type="button" class="action-button ledger-propagate-button" id="ledger-propagate">PROPAGATE</button>\n          </div>\n          <div class="ledger-note">The compact preview is shown above. Manual boxes are teal and excluded from global uniform-sizing changes.</div>'''
text = replace_once(text, ledger_needle, ledger_replacement, 'ledger propagate controls')

zoom_needle = '''      <div class="zoom-toolbar">\n        <button type="button" class="action-button" id="zoom-fit">FIT</button>\n        <button type="button" class="action-button" id="zoom-100">100%</button>\n        <label class="zoom-range-wrap">\n          <span>ZOOM</span>\n          <input id="zoom-range" type="range" min="10" max="500" step="5" value="100">\n          <output id="zoom-value">100%</output>\n        </label>\n      </div>'''
zoom_replacement = '''      <div class="zoom-toolbar">\n        <button type="button" class="action-button" id="zoom-fit">FIT</button>\n        <button type="button" class="action-button" id="zoom-100">100%</button>\n        <label class="zoom-range-wrap">\n          <span>ZOOM</span>\n          <input id="zoom-range" type="range" min="10" max="500" step="5" value="100">\n          <output id="zoom-value">100%</output>\n        </label>\n        <button type="button" class="action-button" id="zoom-select-box" aria-pressed="false">SELECT □</button>\n        <button type="button" class="action-button" id="zoom-select-all">SELECT ALL</button>\n        <button type="button" class="action-button" id="zoom-invert">INVERT</button>\n        <button type="button" class="action-button" id="zoom-duplicate" disabled>DUPLICATE</button>\n        <button type="button" class="action-button danger-outline" id="zoom-delete" disabled>DELETE</button>\n      </div>'''
text = replace_once(text, zoom_needle, zoom_replacement, 'zoom toolbar')
path.write_text(text, encoding='utf-8')

# ---- app.js ----
path = Path('tools/imgautocut/app.js')
text = path.read_text(encoding='utf-8')

text = replace_once(
    text,
    "    ledgerBody: $('#ledger-body'), detectedMeta: $('#detected-meta'), exportFormat: $('#export-format'), exportAssets: $('#export-assets'),\n    zoomOpen: $('#zoom-open'), zoomModal: $('#zoom-modal'), zoomClose: $('#zoom-close'), zoomFit: $('#zoom-fit'), zoom100: $('#zoom-100'),\n    zoomRange: $('#zoom-range'), zoomValue: $('#zoom-value'), zoomScroll: $('#zoom-scroll'), zoomCanvas: $('#zoom-canvas'), toast: $('#toast')",
    "    ledgerBody: $('#ledger-body'), detectedMeta: $('#detected-meta'), exportFormat: $('#export-format'), exportAssets: $('#export-assets'),\n    ledgerPropagateName: $('#ledger-propagate-name'), ledgerStartNumber: $('#ledger-start-number'), ledgerPropagate: $('#ledger-propagate'),\n    zoomOpen: $('#zoom-open'), zoomModal: $('#zoom-modal'), zoomClose: $('#zoom-close'), zoomFit: $('#zoom-fit'), zoom100: $('#zoom-100'),\n    zoomRange: $('#zoom-range'), zoomValue: $('#zoom-value'), zoomScroll: $('#zoom-scroll'), zoomCanvas: $('#zoom-canvas'),\n    zoomSelectBox: $('#zoom-select-box'), zoomSelectAll: $('#zoom-select-all'), zoomInvert: $('#zoom-invert'), zoomDuplicate: $('#zoom-duplicate'), zoomDelete: $('#zoom-delete'), toast: $('#toast')",
    'refs additions'
)
text = replace_once(
    text,
    "    managerSort: 'order', zoom: { open: false, scale: 1, pointer: null },",
    "    managerSort: 'order', zoom: { open: false, scale: 1, pointer: null, selectBoxMode: false, marquee: null },",
    'zoom state'
)

# Dramatically selected tags/boxes and marquee drawing.
render_pattern = re.compile(r"  function renderZoomCanvas\(\) \{.*?\n  \}\n  function openZoomInspector", re.S)
render_replacement = '''  function updateZoomToolbarState() {
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
  function openZoomInspector'''
text, count = render_pattern.subn(render_replacement, text, count=1)
if count != 1:
    raise SystemExit('renderZoomCanvas replacement failed')

text = replace_once(
    text,
    "    refs.zoomModal.hidden = false; state.zoom.open = true; state.zoom.pointer = null;\n    requestAnimationFrame(() => fitZoomToWindow());",
    "    refs.zoomModal.hidden = false; state.zoom.open = true; state.zoom.pointer = null; state.zoom.marquee = null;\n    updateZoomToolbarState(); requestAnimationFrame(() => fitZoomToWindow());",
    'zoom open'
)
text = replace_once(
    text,
    "    state.zoom.open = false; state.zoom.pointer = null; refs.zoomModal.hidden = true; renderCanvas();",
    "    state.zoom.open = false; state.zoom.pointer = null; state.zoom.marquee = null; refs.zoomModal.hidden = true; renderCanvas();",
    'zoom close'
)

pointer_pattern = re.compile(r"  function zoomPointerDown\(event\) \{.*?\n  \}\n\n  function blobFromCanvas", re.S)
pointer_replacement = '''  function marqueeTouchesSlice(rect, slice) {
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

  function blobFromCanvas'''
text, count = pointer_pattern.subn(pointer_replacement, text, count=1)
if count != 1:
    raise SystemExit('zoom pointer block replacement failed')

# Ledger row delete button beside state.
old_row = '''      return `<tr data-slice-id="${escapedText(slice.id)}"><td>${index + 1}</td><td><input type="text" class="ledger-name" data-index="${index}" value="${escapedText(slice.name || generated)}" aria-label="File name for asset ${index + 1}" spellcheck="false" autocomplete="off"></td><td>${Math.round(slice.w)} × ${Math.round(slice.h)}</td><td><span class="${slice.manual ? 'state-manual' : 'state-auto'}">${stateText}</span></td></tr>`;'''
new_row = '''      return `<tr data-slice-id="${escapedText(slice.id)}"><td>${index + 1}</td><td><input type="text" class="ledger-name" data-index="${index}" value="${escapedText(slice.name || generated)}" aria-label="File name for asset ${index + 1}" spellcheck="false" autocomplete="off"></td><td>${Math.round(slice.w)} × ${Math.round(slice.h)}</td><td><span class="ledger-state-cell"><span class="${slice.manual ? 'state-manual' : 'state-auto'}">${stateText}</span><button type="button" class="ledger-delete" data-ledger-delete="${escapedText(slice.id)}" title="Delete this asset" aria-label="Delete asset ${index + 1}">×</button></span></td></tr>`;'''
text = replace_once(text, old_row, new_row, 'ledger row delete')

propagate_anchor = '''  function imagePointFromEvent(event) { const rect = refs.canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) / state.view.scale, y: (event.clientY - rect.top) / state.view.scale }; }'''
propagate_code = '''  function propagateLedgerNames() {
    if (!state.slices.length) { toast('There are no assets to name.'); return; }
    const rawBase = refs.ledgerPropagateName.value.trim().replace(/\\.(png|webp)$/i, '');
    const base = rawBase.replace(/[\\\\/:*?"<>|\\u0000-\\u001F]/g, '_').trim();
    if (!base) { toast('Enter a name before pressing Propagate.'); refs.ledgerPropagateName.focus(); return; }
    const start = Math.max(0, Math.trunc(Number(refs.ledgerStartNumber.value) || 0));
    refs.ledgerStartNumber.value = String(start);
    const last = start + Math.max(0, state.slices.length - 1);
    const digits = Math.max(2, String(last).length);
    state.slices.forEach((slice, index) => { slice.name = `${base}${String(start + index).padStart(digits, '0')}`; });
    renderLedger(); renderSelectionManager();
    toast(`${state.slices.length} names propagated from ${base}${String(start).padStart(digits, '0')}.`);
  }

  function imagePointFromEvent(event) { const rect = refs.canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) / state.view.scale, y: (event.clientY - rect.top) / state.view.scale }; }'''
text = replace_once(text, propagate_anchor, propagate_code, 'propagate function')

# Bind new toolbar and ledger actions.
text = replace_once(
    text,
    "    refs.zoomRange.addEventListener('input', () => applyZoomScale(zoomScaleFromInput()));\n    refs.zoomModal.addEventListener('pointerdown', (event) => { if (event.target === refs.zoomModal) closeZoomInspector(); });",
    "    refs.zoomRange.addEventListener('input', () => applyZoomScale(zoomScaleFromInput()));\n    refs.zoomSelectBox.addEventListener('click', toggleZoomBoxSelect);\n    refs.zoomSelectAll.addEventListener('click', () => setAllSelected(true));\n    refs.zoomInvert.addEventListener('click', invertZoomSelection);\n    refs.zoomDuplicate.addEventListener('click', duplicateZoomSelection);\n    refs.zoomDelete.addEventListener('click', deleteZoomSelection);\n    refs.zoomModal.addEventListener('pointerdown', (event) => { if (event.target === refs.zoomModal) closeZoomInspector(); });",
    'zoom button listeners'
)
text = replace_once(
    text,
    "    refs.toggleLedger.addEventListener('click', () => { refs.ledgerShell.hidden = !refs.ledgerShell.hidden; updateSliceStats(); });\n    refs.exportFormat.addEventListener('change', () => { renderLedger(); renderSelectionManager(); });",
    "    refs.toggleLedger.addEventListener('click', () => { refs.ledgerShell.hidden = !refs.ledgerShell.hidden; updateSliceStats(); });\n    refs.ledgerPropagate.addEventListener('click', propagateLedgerNames);\n    refs.ledgerPropagateName.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); propagateLedgerNames(); } });\n    refs.exportFormat.addEventListener('change', () => { renderLedger(); renderSelectionManager(); });",
    'ledger propagate listeners'
)
text = replace_once(
    text,
    "    refs.ledgerBody.addEventListener('input', (event) => {\n      const input = event.target.closest('.ledger-name');",
    "    refs.ledgerBody.addEventListener('click', (event) => {\n      const deleteButton = event.target.closest('[data-ledger-delete]');\n      if (deleteButton) removeSlice(deleteButton.dataset.ledgerDelete);\n    });\n    refs.ledgerBody.addEventListener('input', (event) => {\n      const input = event.target.closest('.ledger-name');",
    'ledger delete listener'
)

path.write_text(text, encoding='utf-8')

# ---- styles.css ----
path = Path('tools/imgautocut/styles.css')
text = path.read_text(encoding='utf-8')
text += '''\n\n/* v1.03 zoom multi-selection and ledger naming */\n.ledger-propagate-bar { display: grid; grid-template-columns: minmax(130px, 1fr) 118px auto; gap: 8px; align-items: end; margin: 0 0 10px; padding: 9px; border: 1px solid rgba(137,107,73,.52); border-radius: 12px; background: rgba(0,0,0,.22); }\n.ledger-propagate-name, .ledger-start-number { display: flex; flex-direction: column; gap: 4px; color: rgba(245,240,219,.62); font-size: .53rem; font-weight: 800; letter-spacing: .05em; }\n.ledger-propagate-name input, .ledger-start-number input { min-height: 30px; padding: 5px 9px; border: 1px solid var(--chiseled-bronze); border-radius: 999px; background: var(--bg-input); color: #f0ebcb; font-size: .67rem; }\n.ledger-propagate-button { min-height: 30px; border-color: var(--water-blue); color: var(--water-spray); }\n.ledger-state-cell { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }\n.ledger-delete { display: inline-grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 1px solid var(--brand-red); border-radius: 50%; background: rgba(74,21,37,.65); color: #ffb0c1; cursor: pointer; font-size: .9rem; font-weight: 800; line-height: 1; }\n.ledger-delete:hover { background: var(--brand-red); color: #fff; }\n\n.zoom-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }\n.zoom-range-wrap { flex: 0 1 260px; min-width: 180px; max-width: 280px; }\n#zoom-select-box.active { border-color: #ffd36a; background: #76551d; color: #fff7d6; }\n#zoom-duplicate:disabled, #zoom-delete:disabled { opacity: .4; cursor: not-allowed; }\n\n@media (max-width: 700px) {\n  .ledger-propagate-bar { grid-template-columns: 1fr 105px; }\n  .ledger-propagate-button { grid-column: 1 / -1; }\n  .zoom-range-wrap { order: 10; flex-basis: 100%; max-width: none; width: 100%; }\n}\n'''
path.write_text(text, encoding='utf-8')

# ---- tools.json ----
path = Path('tools.json')
text = path.read_text(encoding='utf-8')
text = replace_once(text, '"path": "tools/imgautocut/index.html?v=0.02"', '"path": "tools/imgautocut/index.html?v=0.03"', 'tools route version')
text = text.replace('inspect and resize outlines in a zoom editor, name them in bulk,', 'inspect, multi-select, duplicate and delete outlines in a zoom editor, propagate numbered names in bulk,')
path.write_text(text, encoding='utf-8')
