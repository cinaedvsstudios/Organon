from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# --- index.html ---
path = Path('tools/imgautocut/index.html')
text = path.read_text(encoding='utf-8')
text = replace_once(text, '<title>Organon ImgAutoCut v1.01</title>', '<title>Organon ImgAutoCut v1.02</title>', 'title version')
text = replace_once(text, '<link rel="stylesheet" href="styles.css">', '<link rel="stylesheet" href="styles.css?v=1.02">', 'css cache')
text = replace_once(text, '<span>IMGAUTOCUT WIZARD · V1.01</span>', '<span>IMGAUTOCUT WIZARD · V1.02</span>', 'header version')
text = replace_once(
    text,
    '          <div class="slice-stat" id="slice-stat">0 ASSETS</div>',
    '''          <div class="workspace-stat-actions">\n            <div class="slice-stat" id="slice-stat">0 ASSETS</div>\n            <button type="button" class="action-button zoom-open-button" id="zoom-open" disabled>ZOOM</button>\n          </div>''',
    'zoom button'
)
text = replace_once(
    text,
    '          <button type="button" class="action-button" id="uniform-size">MAKE SAME SIZE</button>\n          <button type="button" class="action-button danger-outline" id="reset-scan">RESET SCAN</button>',
    '          <button type="button" class="action-button" id="uniform-size">MAKE SAME SIZE</button>\n          <button type="button" class="action-button smart-filter-button" id="smart-filter" disabled>SMART FILTER</button>\n          <button type="button" class="action-button danger-outline" id="reset-scan">RESET SCAN</button>',
    'smart filter button'
)
text = replace_once(
    text,
    '            <button type="button" class="action-button manager-add-button" id="add-selection">+ ADD BOX</button>',
    '''            <div class="selection-manager-heading-controls">\n              <label class="manager-sort-wrap">\n                <span>SORT</span>\n                <select id="manager-sort" aria-label="Sort Add / Remove list">\n                  <option value="order">Detection order</option>\n                  <option value="largest">Largest first</option>\n                  <option value="smallest">Smallest first</option>\n                </select>\n              </label>\n              <button type="button" class="action-button manager-add-button" id="add-selection">+ ADD BOX</button>\n            </div>''',
    'manager sort'
)
zoom_modal = '''\n  <div class="zoom-modal" id="zoom-modal" hidden>\n    <section class="zoom-dialog" role="dialog" aria-modal="true" aria-labelledby="zoom-dialog-title">\n      <div class="zoom-dialog-head">\n        <div>\n          <h2 id="zoom-dialog-title">Outline Inspector</h2>\n          <p>Zoom into the source sheet, drag any box to reposition it, or resize it from the circular corner handles.</p>\n        </div>\n        <button type="button" class="zoom-close" id="zoom-close" aria-label="Close outline inspector">×</button>\n      </div>\n      <div class="zoom-toolbar">\n        <button type="button" class="action-button" id="zoom-fit">FIT</button>\n        <button type="button" class="action-button" id="zoom-100">100%</button>\n        <label class="zoom-range-wrap">\n          <span>ZOOM</span>\n          <input id="zoom-range" type="range" min="10" max="500" step="5" value="100">\n          <output id="zoom-value">100%</output>\n        </label>\n      </div>\n      <div class="zoom-scroll" id="zoom-scroll">\n        <canvas id="zoom-canvas" aria-label="Zoomed image sheet outline editor"></canvas>\n      </div>\n      <div class="zoom-help">All boxes share the live sheet data. Changes here immediately update the main workspace, ledger and export boundaries.</div>\n    </section>\n  </div>\n'''
text = replace_once(text, '\n  <div id="toast" class="toast" role="status" aria-live="polite"></div>', zoom_modal + '\n  <div id="toast" class="toast" role="status" aria-live="polite"></div>', 'zoom modal')
text = replace_once(text, '<script src="app.js"></script>', '<script src="app.js?v=1.02"></script>', 'js cache')
path.write_text(text, encoding='utf-8')


# --- app.js ---
path = Path('tools/imgautocut/app.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    "    uniformSize: $('#uniform-size'), resetScan: $('#reset-scan'), manageSelections: $('#manage-selections'), selectionManager: $('#selection-manager'),\n    addSelection: $('#add-selection'), selectionManagerList: $('#selection-manager-list'), toggleLedger: $('#toggle-ledger'), ledgerShell: $('#ledger-shell'),\n    ledgerBody: $('#ledger-body'), detectedMeta: $('#detected-meta'), exportFormat: $('#export-format'), exportAssets: $('#export-assets'), toast: $('#toast')",
    "    uniformSize: $('#uniform-size'), smartFilter: $('#smart-filter'), resetScan: $('#reset-scan'), manageSelections: $('#manage-selections'), selectionManager: $('#selection-manager'),\n    addSelection: $('#add-selection'), managerSort: $('#manager-sort'), selectionManagerList: $('#selection-manager-list'), toggleLedger: $('#toggle-ledger'), ledgerShell: $('#ledger-shell'),\n    ledgerBody: $('#ledger-body'), detectedMeta: $('#detected-meta'), exportFormat: $('#export-format'), exportAssets: $('#export-assets'),\n    zoomOpen: $('#zoom-open'), zoomModal: $('#zoom-modal'), zoomClose: $('#zoom-close'), zoomFit: $('#zoom-fit'), zoom100: $('#zoom-100'),\n    zoomRange: $('#zoom-range'), zoomValue: $('#zoom-value'), zoomScroll: $('#zoom-scroll'), zoomCanvas: $('#zoom-canvas'), toast: $('#toast')",
    'refs'
)
text = replace_once(
    text,
    "  const ctx = refs.canvas.getContext('2d', { alpha: true });\n  const sourceCanvas = document.createElement('canvas');",
    "  const ctx = refs.canvas.getContext('2d', { alpha: true });\n  const zoomCtx = refs.zoomCanvas.getContext('2d', { alpha: true });\n  const sourceCanvas = document.createElement('canvas');",
    'zoom context'
)
text = replace_once(
    text,
    "    view: { x: 0, y: 0, scale: 1, width: 0, height: 0, dpr: 1 }, toastTimer: null, resizeObserver: null,\n    header: { value: 5, interval: null, locked: false, hovering: false }",
    "    view: { x: 0, y: 0, scale: 1, width: 0, height: 0, dpr: 1 }, toastTimer: null, resizeObserver: null,\n    managerSort: 'order', zoom: { open: false, scale: 1, pointer: null },\n    header: { value: 5, interval: null, locked: false, hovering: false }",
    'state additions'
)
text = replace_once(
    text,
    "    refs.sliceStat.textContent = `${count} ${count === 1 ? 'ASSET' : 'ASSETS'}`;\n    refs.toggleLedger.textContent = refs.ledgerShell.hidden ? 'OPEN LEDGER' : 'CLOSE LEDGER';",
    "    refs.sliceStat.textContent = `${count} ${count === 1 ? 'ASSET' : 'ASSETS'}`;\n    refs.toggleLedger.textContent = refs.ledgerShell.hidden ? 'OPEN LEDGER' : 'CLOSE LEDGER';\n    refs.zoomOpen.disabled = !state.image;\n    refs.smartFilter.disabled = !state.image || state.slices.filter((slice) => !slice.manualAdded && !slice.manual).length < 2;",
    'button enabled state'
)
text = replace_once(
    text,
    "  function selectionChanged() { renderCanvas(); renderSelectionManager(); updateSelectionInfo(); }\n  function refreshAll() { renderCanvas(); renderLedger(); renderSelectionManager(); updateSliceStats(); updateSelectionInfo(); }",
    "  function selectionChanged() { renderCanvas(); renderSelectionManager(); updateSelectionInfo(); if (state.zoom.open) renderZoomCanvas(); }\n  function refreshAll() { renderCanvas(); renderLedger(); renderSelectionManager(); updateSliceStats(); updateSelectionInfo(); if (state.zoom.open) renderZoomCanvas(); }",
    'zoom sync refresh'
)
old_manager = '''    refs.selectionManagerList.innerHTML = state.slices.map((slice, index) => {\n      const kind = slice.manualAdded ? 'MANUAL BOX' : (slice.manual ? 'ADJUSTED' : 'AUTO');\n      const kindClass = slice.manual ? 'manual' : 'auto';\n      const generatedName = sanitizeFilename(slice.name, index, refs.exportFormat.value).replace(/\\.(png|webp)$/i, '');\n      const displayName = slice.name || generatedName;\n      return `<div class="selection-manager-row${slice.selected ? ' is-selected' : ''}" data-slice-id="${escapedText(slice.id)}">\n        <span class="selection-manager-number">${slice.manualAdded ? 'M' : index + 1}</span>\n        <button type="button" class="selection-manager-focus" data-focus-slice="${escapedText(slice.id)}" title="Select this box in the workspace"><span class="selection-manager-name">${escapedText(displayName)}</span></button>\n        <span class="selection-manager-dimensions">${Math.round(slice.w)} × ${Math.round(slice.h)}</span>\n        <span class="selection-manager-state ${kindClass}">${kind}</span>\n        <button type="button" class="selection-delete" data-remove-slice="${escapedText(slice.id)}" title="Delete this selection" aria-label="Delete selection ${index + 1}">🗑</button>\n      </div>`;\n    }).join('') || '<div class="selection-manager-empty">There are no selections left. Use + ADD BOX to create one.</div>';'''
new_manager = '''    const managerEntries = state.slices.map((slice, index) => ({ slice, index }));\n    if (state.managerSort === 'largest') managerEntries.sort((a, b) => (b.slice.w * b.slice.h) - (a.slice.w * a.slice.h) || a.index - b.index);\n    else if (state.managerSort === 'smallest') managerEntries.sort((a, b) => (a.slice.w * a.slice.h) - (b.slice.w * b.slice.h) || a.index - b.index);\n    refs.selectionManagerList.innerHTML = managerEntries.map(({ slice, index }) => {\n      const kind = slice.manualAdded ? 'MANUAL BOX' : (slice.manual ? 'ADJUSTED' : 'AUTO');\n      const kindClass = slice.manual ? 'manual' : 'auto';\n      const generatedName = sanitizeFilename(slice.name, index, refs.exportFormat.value).replace(/\\.(png|webp)$/i, '');\n      const displayName = slice.name || generatedName;\n      return `<div class="selection-manager-row${slice.selected ? ' is-selected' : ''}" data-slice-id="${escapedText(slice.id)}">\n        <span class="selection-manager-number">${slice.manualAdded ? 'M' : index + 1}</span>\n        <button type="button" class="selection-manager-focus" data-focus-slice="${escapedText(slice.id)}" title="Select this box in the workspace"><span class="selection-manager-name">${escapedText(displayName)}</span></button>\n        <span class="selection-manager-dimensions">${Math.round(slice.w)} × ${Math.round(slice.h)}</span>\n        <span class="selection-manager-state ${kindClass}">${kind}</span>\n        <button type="button" class="selection-delete" data-remove-slice="${escapedText(slice.id)}" title="Delete this selection" aria-label="Delete selection ${index + 1}">🗑</button>\n      </div>`;\n    }).join('') || '<div class="selection-manager-empty">There are no selections left. Use + ADD BOX to create one.</div>';'''
text = replace_once(text, old_manager, new_manager, 'manager sorting')

smart_filter = '''  function smartFilterTinyIslands() {\n    const automatic = state.slices.filter((slice) => !slice.manualAdded && !slice.manual);\n    if (automatic.length < 2) { toast('Smart Filter needs at least two untouched automatic detections.'); return; }\n\n    const areas = automatic.map((slice) => Math.max(1, slice.w * slice.h)).sort((a, b) => a - b);\n    const pixelCounts = automatic.map((slice) => Math.max(1, slice.pixelCount || 1)).sort((a, b) => a - b);\n    const referenceCount = Math.max(1, Math.ceil(automatic.length * .25));\n    const median = (values) => {\n      const middle = Math.floor(values.length / 2);\n      return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;\n    };\n    const referenceArea = median(areas.slice(-referenceCount));\n    const referencePixels = median(pixelCounts.slice(-referenceCount));\n    const minimumArea = Math.max(4, referenceArea * .08);\n    const minimumPixels = Math.max(2, referencePixels * .05);\n    const before = state.slices.length;\n\n    state.slices = state.slices.filter((slice) => {\n      if (slice.manualAdded || slice.manual) return true;\n      const area = Math.max(1, slice.w * slice.h);\n      const pixels = Math.max(1, slice.pixelCount || 1);\n      return !(area < minimumArea && pixels < minimumPixels);\n    });\n\n    const removed = before - state.slices.length;\n    refreshAll();\n    if (!removed) {\n      toast('Smart Filter found no obvious tiny artefacts to remove.');\n      return;\n    }\n    refs.workspaceSummary.textContent = `Smart Filter removed ${removed} tiny alpha island${removed === 1 ? '' : 's'}. ${state.slices.length} assets remain. Reset Scan restores the full detection.`;\n    toast(`Smart Filter removed ${removed} tiny detection${removed === 1 ? '' : 's'}. Reset Scan restores them.`);\n    setHubStatus(`ImgAutoCut: Smart Filter removed ${removed} tiny alpha islands.`); setTimeout(clearHubStatus, 1600);\n  }\n\n'''
text = replace_once(text, '  function resetScan() {', smart_filter + '  function resetScan() {', 'smart filter function')

zoom_functions = '''  function zoomScaleFromInput() { return Math.max(.1, Math.min(5, Number(refs.zoomRange.value || 100) / 100)); }\n  function applyZoomScale(scale) {\n    const bounded = Math.max(.1, Math.min(5, scale));\n    state.zoom.scale = bounded;\n    refs.zoomRange.value = String(Math.round(bounded * 100 / 5) * 5);\n    refs.zoomValue.textContent = `${Math.round(bounded * 100)}%`;\n    renderZoomCanvas();\n  }\n  function fitZoomToWindow() {\n    if (!state.image || !state.zoom.open) return;\n    const width = Math.max(120, refs.zoomScroll.clientWidth - 32);\n    const height = Math.max(120, refs.zoomScroll.clientHeight - 32);\n    applyZoomScale(Math.min(width / state.sourceWidth, height / state.sourceHeight, 5));\n    refs.zoomScroll.scrollLeft = 0; refs.zoomScroll.scrollTop = 0;\n  }\n  function renderZoomCanvas() {\n    if (!state.zoom.open || !state.image) return;\n    const scale = state.zoom.scale;\n    refs.zoomCanvas.width = state.sourceWidth; refs.zoomCanvas.height = state.sourceHeight;\n    refs.zoomCanvas.style.width = `${Math.max(1, Math.round(state.sourceWidth * scale))}px`;\n    refs.zoomCanvas.style.height = `${Math.max(1, Math.round(state.sourceHeight * scale))}px`;\n    zoomCtx.clearRect(0, 0, state.sourceWidth, state.sourceHeight);\n    const cell = Math.max(2, 12 / scale);\n    for (let y = 0; y < state.sourceHeight; y += cell) for (let x = 0; x < state.sourceWidth; x += cell) {\n      zoomCtx.fillStyle = ((Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0) ? '#252727' : '#171919';\n      zoomCtx.fillRect(x, y, cell, cell);\n    }\n    zoomCtx.drawImage(state.image, 0, 0, state.sourceWidth, state.sourceHeight);\n    state.slices.forEach((slice, index) => {\n      const accent = slice.manual ? '#449e92' : '#75b2de';\n      const line = (slice.selected ? 2.5 : 1.25) / scale;\n      const radius = 6 / scale;\n      zoomCtx.save();\n      zoomCtx.lineWidth = line; zoomCtx.strokeStyle = accent;\n      zoomCtx.fillStyle = slice.selected ? 'rgba(117,178,222,.14)' : 'rgba(0,0,0,.025)';\n      zoomCtx.fillRect(slice.x, slice.y, slice.w, slice.h); zoomCtx.strokeRect(slice.x, slice.y, slice.w, slice.h);\n      zoomCtx.font = `600 ${10 / scale}px Geist Mono, monospace`;\n      const label = slice.manualAdded ? 'M' : String(index + 1);\n      const tagH = 14 / scale; const tagW = Math.max(18 / scale, zoomCtx.measureText(label).width + (8 / scale));\n      zoomCtx.fillStyle = accent; zoomCtx.fillRect(slice.x, Math.max(0, slice.y - tagH), tagW, tagH);\n      zoomCtx.fillStyle = '#101211'; zoomCtx.fillText(label, slice.x + (4 / scale), Math.max(10 / scale, slice.y - (4 / scale)));\n      zoomCtx.fillStyle = '#f5f0db'; zoomCtx.strokeStyle = accent; zoomCtx.lineWidth = 1 / scale;\n      [[slice.x, slice.y], [slice.x + slice.w, slice.y], [slice.x, slice.y + slice.h], [slice.x + slice.w, slice.y + slice.h]].forEach(([x, y]) => {\n        zoomCtx.beginPath(); zoomCtx.arc(x, y, radius, 0, Math.PI * 2); zoomCtx.fill(); zoomCtx.stroke();\n      });\n      zoomCtx.restore();\n    });\n  }\n  function openZoomInspector() {\n    if (!state.image) { toast('Load an image sheet before opening Zoom.'); return; }\n    refs.zoomModal.hidden = false; state.zoom.open = true; state.zoom.pointer = null;\n    requestAnimationFrame(() => fitZoomToWindow());\n  }\n  function closeZoomInspector() {\n    state.zoom.open = false; state.zoom.pointer = null; refs.zoomModal.hidden = true; renderCanvas();\n  }\n  function zoomImagePoint(event) {\n    const rect = refs.zoomCanvas.getBoundingClientRect();\n    return { x: (event.clientX - rect.left) * state.sourceWidth / Math.max(1, rect.width), y: (event.clientY - rect.top) * state.sourceHeight / Math.max(1, rect.height) };\n  }\n  function zoomHandleAtPoint(slice, point) {\n    const threshold = 10 / state.zoom.scale;\n    const handles = [{ mode: 'nw', x: slice.x, y: slice.y }, { mode: 'ne', x: slice.x + slice.w, y: slice.y }, { mode: 'sw', x: slice.x, y: slice.y + slice.h }, { mode: 'se', x: slice.x + slice.w, y: slice.y + slice.h }];\n    return handles.find((handle) => Math.hypot(point.x - handle.x, point.y - handle.y) <= threshold) || null;\n  }\n  function zoomHitAtPoint(point) {\n    for (let i = state.slices.length - 1; i >= 0; i -= 1) {\n      const handle = zoomHandleAtPoint(state.slices[i], point); if (handle) return { slice: state.slices[i], mode: handle.mode };\n    }\n    const hit = sliceAtPoint(point); return hit ? { slice: hit.slice, mode: 'move' } : null;\n  }\n  function zoomPointerDown(event) {\n    if (!state.image) return; const point = zoomImagePoint(event), hit = zoomHitAtPoint(point);\n    if (!hit) return; event.preventDefault();\n    state.slices.forEach((slice) => { slice.selected = slice === hit.slice; });\n    state.zoom.pointer = { slice: hit.slice, mode: hit.mode, startPoint: point, startBox: { x: hit.slice.x, y: hit.slice.y, w: hit.slice.w, h: hit.slice.h } };\n    refs.zoomCanvas.setPointerCapture?.(event.pointerId); selectionChanged();\n  }\n  function zoomPointerMove(event) {\n    const point = zoomImagePoint(event);\n    if (!state.zoom.pointer) {\n      const hit = zoomHitAtPoint(point); refs.zoomCanvas.style.cursor = !hit ? 'crosshair' : (hit.mode === 'move' ? 'move' : `${hit.mode}-resize`); return;\n    }\n    event.preventDefault();\n    const { slice, mode, startPoint, startBox } = state.zoom.pointer; const dx = point.x - startPoint.x, dy = point.y - startPoint.y, minimum = 1;\n    if (mode === 'move') { slice.x = startBox.x + dx; slice.y = startBox.y + dy; }\n    else {\n      let { x, y, w, h } = startBox;\n      if (mode.includes('e')) w = Math.max(minimum, startBox.w + dx); if (mode.includes('s')) h = Math.max(minimum, startBox.h + dy);\n      if (mode.includes('w')) { x = startBox.x + dx; w = Math.max(minimum, startBox.w - dx); if (w === minimum) x = startBox.x + startBox.w - minimum; }\n      if (mode.includes('n')) { y = startBox.y + dy; h = Math.max(minimum, startBox.h - dy); if (h === minimum) y = startBox.y + startBox.h - minimum; }\n      slice.x = x; slice.y = y; slice.w = w; slice.h = h;\n    }\n    slice.manual = true; clampManualBox(slice); renderZoomCanvas(); renderCanvas(); renderLedger(); renderSelectionManager(); updateSelectionInfo();\n  }\n  function zoomPointerUp(event) {\n    if (!state.zoom.pointer) return; refs.zoomCanvas.releasePointerCapture?.(event.pointerId); state.zoom.pointer = null; renderZoomCanvas();\n  }\n\n'''
text = replace_once(text, '  function blobFromCanvas(canvas, type, quality) {', zoom_functions + '  function blobFromCanvas(canvas, type, quality) {', 'zoom functions')

text = replace_once(
    text,
    "    refs.uniformSize.addEventListener('click', makeUniformSize);\n    refs.resetScan.addEventListener('click', resetScan);",
    "    refs.uniformSize.addEventListener('click', makeUniformSize);\n    refs.smartFilter.addEventListener('click', smartFilterTinyIslands);\n    refs.resetScan.addEventListener('click', resetScan);",
    'smart filter binding'
)
text = replace_once(
    text,
    "    refs.addSelection.addEventListener('click', addManualSelection);\n    refs.selectionManagerList.addEventListener('click', (event) => {",
    "    refs.addSelection.addEventListener('click', addManualSelection);\n    refs.managerSort.addEventListener('change', () => { state.managerSort = refs.managerSort.value; renderSelectionManager(); });\n    refs.selectionManagerList.addEventListener('click', (event) => {",
    'manager sort binding'
)
zoom_bindings = '''    refs.zoomOpen.addEventListener('click', openZoomInspector);\n    refs.zoomClose.addEventListener('click', closeZoomInspector);\n    refs.zoomFit.addEventListener('click', fitZoomToWindow);\n    refs.zoom100.addEventListener('click', () => applyZoomScale(1));\n    refs.zoomRange.addEventListener('input', () => applyZoomScale(zoomScaleFromInput()));\n    refs.zoomModal.addEventListener('pointerdown', (event) => { if (event.target === refs.zoomModal) closeZoomInspector(); });\n    refs.zoomCanvas.addEventListener('pointerdown', zoomPointerDown);\n    refs.zoomCanvas.addEventListener('pointermove', zoomPointerMove);\n    refs.zoomCanvas.addEventListener('pointerup', zoomPointerUp);\n    refs.zoomCanvas.addEventListener('pointercancel', zoomPointerUp);\n    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.zoom.open) closeZoomInspector(); });\n'''
text = replace_once(text, "    refs.toggleLedger.addEventListener('click', () => { refs.ledgerShell.hidden = !refs.ledgerShell.hidden; updateSliceStats(); });", zoom_bindings + "    refs.toggleLedger.addEventListener('click', () => { refs.ledgerShell.hidden = !refs.ledgerShell.hidden; updateSliceStats(); });", 'zoom bindings')
text = replace_once(text, "    window.addEventListener('resize', renderCanvas);", "    window.addEventListener('resize', () => { renderCanvas(); if (state.zoom.open) fitZoomToWindow(); });", 'resize zoom')
path.write_text(text, encoding='utf-8')


# --- styles.css ---
path = Path('tools/imgautocut/styles.css')
text = path.read_text(encoding='utf-8')
extra_css = r'''

/* v1.02 smart filtering, manager sorting and outline inspector */
.workspace-stat-actions { display: flex; flex-direction: column; align-items: stretch; gap: 6px; flex: 0 0 auto; }
.zoom-open-button { min-height: 25px; padding: 4px 8px; border-color: var(--water-blue); color: var(--water-spray); }
.zoom-open-button:disabled, .smart-filter-button:disabled { opacity: .42; cursor: not-allowed; }
.smart-filter-button { border-color: var(--water-blue); color: var(--water-spray); }
.selection-manager-heading-controls { display: flex; align-items: flex-end; gap: 8px; flex: 0 0 auto; }
.manager-sort-wrap { display: flex; flex-direction: column; gap: 3px; color: rgba(245,240,219,.62); font-size: .52rem; font-weight: 800; letter-spacing: .05em; }
.manager-sort-wrap select { width: auto; min-width: 126px; min-height: 29px; padding: 5px 27px 5px 9px; font-size: .6rem; }

.zoom-modal { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: 16px; background: rgba(5,6,6,.88); backdrop-filter: blur(5px); }
.zoom-modal[hidden] { display: none; }
.zoom-dialog { width: min(1180px, 96vw); height: min(900px, 94vh); min-height: 420px; display: grid; grid-template-rows: auto auto minmax(0,1fr) auto; overflow: hidden; border: 1px solid var(--chiseled-bronze); border-radius: 18px; background: #181919; box-shadow: 0 24px 90px rgba(0,0,0,.72); }
.zoom-dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 14px 16px 12px; border-bottom: 1px solid rgba(137,107,73,.5); background: #292a24; }
.zoom-dialog-head h2 { margin-bottom: 4px; }
.zoom-dialog-head p { max-width: 760px; }
.zoom-close { width: 34px; height: 34px; flex: 0 0 auto; border: 1px solid var(--brand-red); border-radius: 50%; background: rgba(74,21,37,.6); color: #ffd5de; cursor: pointer; font-size: 1.15rem; line-height: 1; }
.zoom-toolbar { display: grid; grid-template-columns: auto auto minmax(240px, 1fr); gap: 8px; align-items: center; padding: 9px 12px; border-bottom: 1px solid rgba(137,107,73,.42); background: #101212; }
.zoom-range-wrap { display: grid; grid-template-columns: auto minmax(120px, 1fr) 58px; align-items: center; gap: 9px; color: var(--stone-ochre); font-family: var(--font-mono); font-size: .61rem; }
.zoom-range-wrap output { color: var(--water-spray); text-align: right; }
.zoom-scroll { min-width: 0; min-height: 0; overflow: auto; padding: 18px; background: #090a0a; scrollbar-color: var(--chiseled-bronze) #111; }
#zoom-canvas { display: block; max-width: none; max-height: none; margin: 0; touch-action: none; cursor: crosshair; box-shadow: 0 0 0 1px rgba(137,107,73,.6), 0 12px 28px rgba(0,0,0,.55); }
.zoom-help { padding: 8px 14px 10px; border-top: 1px solid rgba(137,107,73,.42); color: rgba(245,240,219,.6); background: #101212; font-size: .62rem; }

@media (max-width: 700px) {
  .selection-manager-heading { flex-direction: column; }
  .selection-manager-heading-controls { width: 100%; justify-content: space-between; }
  .manager-sort-wrap { flex: 1; }
  .manager-sort-wrap select { width: 100%; }
  .zoom-modal { padding: 5px; }
  .zoom-dialog { width: 100%; height: 96vh; border-radius: 12px; }
  .zoom-toolbar { grid-template-columns: auto auto 1fr; }
  .zoom-range-wrap { grid-column: 1 / -1; }
}
'''
if 'v1.02 smart filtering, manager sorting and outline inspector' in text:
    raise SystemExit('styles already patched')
path.write_text(text.rstrip() + extra_css + '\n', encoding='utf-8')


# --- tools.json cache/version ---
path = Path('tools.json')
text = path.read_text(encoding='utf-8')
text = replace_once(text, '"version": "v1.51-alpha"', '"version": "v1.52-alpha"', 'tools version')
text = replace_once(text, '"path": "tools/imgautocut/index.html"', '"path": "tools/imgautocut/index.html?v=0.02"', 'imgautocut cache')
text = replace_once(
    text,
    '"description": "Detect transparency islands, sort them into rows, name them in bulk, and export isolated PNG or WebP assets."',
    '"description": "Detect transparency islands, smart-filter tiny artefacts, sort and manage detections, inspect and resize outlines in a zoom editor, name them in bulk, and export isolated PNG or WebP assets."',
    'imgautocut description'
)
path.write_text(text, encoding='utf-8')

print('ImgAutoCut v1.02 source update applied.')
