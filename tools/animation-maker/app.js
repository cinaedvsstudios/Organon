(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const els = {
        topPanel: $('top-panel'), countdown: $('countdown-circle'), imagePicker: $('image-picker'), videoPicker: $('video-picker'),
        frameGrid: $('frame-grid'), queueCard: $('queue-card'), compileBtn: $('compile-btn'), zipBtn: $('zip-btn'), openEditorBtn: $('open-editor-btn'),
        reorderClipsBtn: $('reorder-clips-btn'), reorderModal: $('reorder-clips-modal'), clipOrderList: $('clip-order-list'),
        outputCard: $('output-card'), viewport: $('compiled-viewport'), downloadAnchor: $('download-anchor'),
        previewModal: $('preview-modal'), previewImg: $('modal-img'), animModal: $('anim-preview-modal'), animImg: $('anim-modal-img'), animLoading: $('anim-loading'),
        alignModal: $('align-modal'), alignCanvas: $('align-canvas'), editorModal: $('frame-editor-modal'), editorWindow: $('editor-window'), editorCanvas: $('frame-editor-canvas'), canvasViewport: $('canvas-viewport')
    };

    const state = {
        frames: [], clips: [], cutoutActions: [], cutoutInverted: false, paintActions: [], movingActions: [], fixedBaseEnabled: false, baseFrameId: null,
        currentPreviewIndex: null, alignIndex: 0, editorIndex: 0, editorPlaying: false, editorTimer: null,
        animationTimer: null, animationPlaying: false, history: [], historyIndex: -1, reorderDraft: [], clipSerial: 0
    };
    const edit = {
        tool: 'rect', target: 'cutout', maskMode: 'remove', paintMode: 'paint', movingMode: 'add', finalView: true,
        zoom: 1, panX: 0, panY: 0, drawing: false, points: [], polygonPoints: [], renderToken: 0
    };
    function setHubStatus(text) { try { window.parent.postMessage({ type: 'set-status', text }, '*'); } catch (error) {} }
    function clearHubStatus() { try { window.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {} }
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function getDim() { return parseInt($('max-dimension').value, 10) || 480; }
    function safeName() { return ($('seq-name').value || 'animation-export').trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-') || 'animation-export'; }
    function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
    function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; }); }
    function makeCanvas(dim) { const canvas = document.createElement('canvas'); canvas.width = dim; canvas.height = dim; return canvas; }
    function canvasToBlob(canvas) { return new Promise((resolve) => canvas.toBlob(resolve, 'image/png')); }
    function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    function hexToRgb(hex) { const parsed = parseInt(hex.replace('#', ''), 16); return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 }; }
    function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }

    let countdownVal = 5, countdownTimer = null, headerLocked = false, headerHovered = false;
    function showCountdown() { els.countdown.textContent = headerLocked ? '🔒' : String(countdownVal); els.countdown.style.borderColor = headerLocked ? 'var(--terracotta-peach)' : 'var(--chiseled-bronze)'; }
    function resetCountdown() { clearInterval(countdownTimer); countdownVal = 5; showCountdown(); }
    function maximizeHeader() { els.topPanel.classList.remove('minimized'); resetCountdown(); }
    function startCountdown() { if (headerLocked || headerHovered) return; clearInterval(countdownTimer); countdownTimer = setInterval(() => { countdownVal -= 1; showCountdown(); if (countdownVal <= 0) { clearInterval(countdownTimer); els.topPanel.classList.add('minimized'); } }, 1000); }
    els.topPanel.addEventListener('mouseenter', () => { headerHovered = true; maximizeHeader(); clearInterval(countdownTimer); });
    els.topPanel.addEventListener('mouseleave', () => { headerHovered = false; resetCountdown(); startCountdown(); });
    els.countdown.addEventListener('dblclick', (event) => { event.preventDefault(); event.stopPropagation(); headerLocked = !headerLocked; showCountdown(); if (headerLocked) { clearInterval(countdownTimer); maximizeHeader(); } else if (!headerHovered) { startCountdown(); } });
    startCountdown();

    function createClip(name, type) {
        state.clipSerial += 1;
        const clip = { id: makeId('clip'), sourceOrder: state.clipSerial, name: name || (type === 'video' ? `video-${state.clipSerial}` : 'Imported Images'), type };
        state.clips.push(clip);
        return clip;
    }
    function clipFrames(clipId) { return state.frames.filter((frame) => frame.clipId === clipId); }
    function frameIndexById(id) { return state.frames.findIndex((frame) => frame.id === id); }
    function baseFrameIndex() { const index = frameIndexById(state.baseFrameId); return index >= 0 ? index : 0; }
    function normalizeClipOrder() {
        const present = new Set(state.frames.map((frame) => frame.clipId));
        state.clips = state.clips.filter((clip) => present.has(clip.id));
        const grouped = [];
        state.clips.forEach((clip) => grouped.push(...clipFrames(clip.id)));
        state.frames = grouped;
        if (state.frames.length && frameIndexById(state.baseFrameId) < 0) state.baseFrameId = state.frames[0].id;
        if (!state.frames.length) state.baseFrameId = null;
    }
    function clipDisplayLabel(clip, index) { return clip.type === 'video' ? `CLIP ${index + 1}` : `IMAGES ${index + 1}`; }
    function addFrame(source, image, clipId) { state.frames.push({ id: makeId('frame'), clipId, base64: source, w: image.width, h: image.height, offsetX: 0, offsetY: 0 }); }

    els.imagePicker.addEventListener('change', async (event) => {
        const files = [...event.target.files]; if (!files.length) return;
        const wasEmpty = state.frames.length === 0;
        const clip = createClip(files.length === 1 ? files[0].name : `Imported Images (${files.length})`, 'images');
        if (wasEmpty) $('seq-name').value = files[0].name.replace(/\.[^/.]+$/, '') || 'animation-export';
        for (const file of files) { const source = await fileToDataUrl(file); const image = await loadImage(source); addFrame(source, image, clip.id); }
        els.imagePicker.value = ''; onFramesChanged();
    });
    $('btn-convert-movie').addEventListener('click', () => els.videoPicker.click());
    els.videoPicker.addEventListener('change', async (event) => {
        const file = event.target.files[0]; if (!file) return;
        const wasEmpty = state.frames.length === 0;
        if (wasEmpty) $('seq-name').value = file.name.replace(/\.[^/.]+$/, '') || 'organon-movie-convert';
        const clip = createClip(file.name, 'video');
        const url = URL.createObjectURL(file), video = document.createElement('video');
        video.src = url; video.muted = true; video.playsInline = true;
        els.viewport.innerHTML = `<div class="loader"></div><p class="help-text">Extracting ${file.name}...</p>`;
        els.outputCard.hidden = false; setHubStatus(`Extracting frames from ${file.name}...`);
        try {
            await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; video.load(); });
            const fps = 12, total = Math.max(1, Math.floor(video.duration * fps));
            const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; const ctx = canvas.getContext('2d');
            for (let i = 0; i < total; i += 1) {
                await seekVideo(video, i / fps); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                state.frames.push({ id: makeId('frame'), clipId: clip.id, base64: canvas.toDataURL('image/jpeg', .85), w: canvas.width, h: canvas.height, offsetX: 0, offsetY: 0 });
                els.viewport.innerHTML = `<p class="clip-extract-progress">Extracting ${file.name} (${Math.round(((i + 1) / total) * 100)}%)...</p>`;
            }
            setHubStatus(`${file.name} added with ${total} frames.`); setTimeout(clearHubStatus, 4500);
        } catch (error) { state.clips = state.clips.filter((item) => item.id !== clip.id); setHubStatus('Video extraction failed.'); }
        URL.revokeObjectURL(url); els.videoPicker.value = ''; els.outputCard.hidden = true; els.viewport.innerHTML = ''; onFramesChanged();
    });
    function seekVideo(video, seconds) { return new Promise((resolve) => { video.onseeked = () => resolve(); video.currentTime = Math.min(seconds, video.duration || seconds); }); }
    function removeClip(clipId) {
        const clip = state.clips.find((item) => item.id === clipId); if (!clip) return;
        const count = clipFrames(clipId).length;
        if (!window.confirm(`Remove ${clip.name} and its ${count} frames from this animation?`)) return;
        state.frames = state.frames.filter((frame) => frame.clipId !== clipId); state.clips = state.clips.filter((item) => item.id !== clipId); normalizeClipOrder(); checkpoint(); onFramesChanged();
    }

    let draggedFrameId = null;
    function renderFrameGrid() {
        els.frameGrid.innerHTML = ''; els.queueCard.hidden = !state.frames.length; $('frame-skip-container').hidden = state.frames.length <= 15;
        if (state.frames.length <= 15) { $('adj-skip').value = '1'; $('val-skip').textContent = 'Keep All'; }
        const activeClips = state.clips.filter((clip) => clipFrames(clip.id).length);
        activeClips.forEach((clip, clipIndex) => {
            const divider = document.createElement('div'); divider.className = 'clip-divider';
            const title = document.createElement('span'); title.className = 'clip-title'; title.innerHTML = `<span>${clipDisplayLabel(clip, clipIndex)}</span><span class="clip-title-name" title="${clip.name}">— ${clip.name}</span>`;
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'clip-remove-btn'; remove.textContent = 'REMOVE'; remove.title = 'Remove this whole clip'; remove.addEventListener('click', () => removeClip(clip.id));
            divider.append(title, remove); els.frameGrid.appendChild(divider); clipFrames(clip.id).forEach((frame) => renderFrameThumbnail(frame));
        });
    }
    function renderFrameThumbnail(frame) {
        const index = frameIndexById(frame.id), item = document.createElement('div'); item.className = 'frame-thumb-wrapper'; item.draggable = true;
        item.innerHTML = `<img src="${frame.base64}" alt="Frame ${index + 1}"><span class="frame-index-badge">${index + 1}</span>`;
        if (frame.offsetX || frame.offsetY) item.insertAdjacentHTML('beforeend', `<span class="frame-badge-offset">${frame.offsetX},${frame.offsetY}</span>`);
        item.append(thumbnailButton('thumb-btn frame-preview-btn', '👁', 'Preview processed frame', () => openPreview(index)), thumbnailButton('thumb-btn frame-align-btn', '⊕', 'Align this frame', () => openAlign(index)), thumbnailButton('thumb-btn frame-delete-btn', '×', 'Delete frame', () => { state.frames = state.frames.filter((entry) => entry.id !== frame.id); normalizeClipOrder(); onFramesChanged(); }));
        item.addEventListener('dragstart', () => { draggedFrameId = frame.id; setTimeout(() => item.classList.add('dragging'), 0); });
        item.addEventListener('dragend', () => { item.classList.remove('dragging'); draggedFrameId = null; });
        item.addEventListener('dragover', (event) => { event.preventDefault(); const dragged = state.frames.find((entry) => entry.id === draggedFrameId); if (!dragged || dragged.id === frame.id || dragged.clipId !== frame.clipId) return; const after = event.clientX - item.getBoundingClientRect().left >= item.clientWidth / 2; item.classList.toggle('drag-over-left', !after); item.classList.toggle('drag-over-right', after); });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over-left', 'drag-over-right'));
        item.addEventListener('drop', (event) => {
            event.preventDefault(); item.classList.remove('drag-over-left', 'drag-over-right'); const dragged = state.frames.find((entry) => entry.id === draggedFrameId); if (!dragged || dragged.id === frame.id) return;
            if (dragged.clipId !== frame.clipId) { setHubStatus('Frames stay inside their clip. Use REORDER CLIPS to move complete videos.'); setTimeout(clearHubStatus, 3500); return; }
            const fromIndex = frameIndexById(dragged.id); let toIndex = frameIndexById(frame.id); const after = event.clientX - item.getBoundingClientRect().left >= item.clientWidth / 2; if (after) toIndex += 1;
            const moving = state.frames.splice(fromIndex, 1)[0]; if (fromIndex < toIndex) toIndex -= 1; state.frames.splice(toIndex, 0, moving); renderFrameGrid();
        });
        els.frameGrid.appendChild(item);
    }
    function thumbnailButton(className, text, title, action) { const element = document.createElement('button'); element.type = 'button'; element.className = className; element.textContent = text; element.title = title; element.addEventListener('click', (event) => { event.stopPropagation(); action(); }); return element; }
    function onFramesChanged() {
        normalizeClipOrder(); state.alignIndex = clamp(state.alignIndex, 0, Math.max(0, state.frames.length - 1)); state.editorIndex = clamp(state.editorIndex, 0, Math.max(0, state.frames.length - 1)); updateOriginalSize(); renderFrameGrid(); updateEstimate(); updateEditorLabels();
        els.openEditorBtn.disabled = state.frames.length === 0; els.zipBtn.disabled = state.frames.length === 0; els.compileBtn.disabled = state.frames.length < 2; els.reorderClipsBtn.hidden = state.clips.filter((clip) => clipFrames(clip.id).length).length < 2;
        if (!els.alignModal.hidden) renderAlign(); if (!els.editorModal.hidden) renderEditor();
    }
    function updateOriginalSize() {
        if (!state.frames.length) { $('original-size-label').textContent = ''; return; }
        const maxW = Math.max(...state.frames.map((frame) => frame.w)), maxH = Math.max(...state.frames.map((frame) => frame.h)); $('original-size-label').textContent = `Original size: ${maxW}×${maxH}`;
        const max = Math.max(maxW, maxH, 540); $('max-dimension').max = String(max);
        if (state.frames.length === 1 || parseInt($('max-dimension').value, 10) < Math.max(maxW, maxH)) { $('max-dimension').value = String(Math.max(maxW, maxH)); $('dimension-value').textContent = `${$('max-dimension').value} px`; }
    }

    els.reorderClipsBtn.addEventListener('click', openReorderClips);
    function openReorderClips() { state.reorderDraft = state.clips.filter((clip) => clipFrames(clip.id).length).map((clip) => clip.id); renderReorderPills(); els.reorderModal.hidden = false; }
    let draggedClipId = null;
    function renderReorderPills() {
        els.clipOrderList.innerHTML = '';
        state.reorderDraft.forEach((clipId, index) => {
            const clip = state.clips.find((item) => item.id === clipId); if (!clip) return; const frames = clipFrames(clip.id), pill = document.createElement('div'); pill.className = 'clip-order-pill'; pill.draggable = true; pill.dataset.clipId = clip.id;
            pill.innerHTML = `<span class="clip-grip">⋮⋮</span><span class="clip-order-text"><span class="clip-order-label">${clipDisplayLabel(clip, index)}</span><span class="clip-order-name">${clip.name}</span><span class="clip-order-count">${frames.length} frames</span></span>`;
            const controls = document.createElement('span'); controls.className = 'clip-move-controls'; const up = document.createElement('button'), down = document.createElement('button'); up.type = down.type = 'button'; up.textContent = '↑'; down.textContent = '↓'; up.disabled = index === 0; down.disabled = index === state.reorderDraft.length - 1; up.addEventListener('click', () => moveDraftClip(index, -1)); down.addEventListener('click', () => moveDraftClip(index, 1)); controls.append(up, down); pill.appendChild(controls);
            pill.addEventListener('dragstart', () => { draggedClipId = clip.id; setTimeout(() => pill.classList.add('dragging'), 0); }); pill.addEventListener('dragend', () => { draggedClipId = null; pill.classList.remove('dragging'); });
            pill.addEventListener('dragover', (event) => { event.preventDefault(); if (draggedClipId && draggedClipId !== clip.id) pill.classList.add('drag-over'); }); pill.addEventListener('dragleave', () => pill.classList.remove('drag-over'));
            pill.addEventListener('drop', (event) => { event.preventDefault(); pill.classList.remove('drag-over'); if (!draggedClipId || draggedClipId === clip.id) return; const from = state.reorderDraft.indexOf(draggedClipId), to = state.reorderDraft.indexOf(clip.id), moving = state.reorderDraft.splice(from, 1)[0]; state.reorderDraft.splice(to, 0, moving); renderReorderPills(); });
            els.clipOrderList.appendChild(pill);
        });
    }
    function moveDraftClip(index, direction) { const target = index + direction; if (target < 0 || target >= state.reorderDraft.length) return; const item = state.reorderDraft[index]; state.reorderDraft[index] = state.reorderDraft[target]; state.reorderDraft[target] = item; renderReorderPills(); }
    $('apply-clip-order').addEventListener('click', () => { const byId = new Map(state.clips.map((clip) => [clip.id, clip])); state.clips = state.reorderDraft.map((clipId) => byId.get(clipId)).filter(Boolean); normalizeClipOrder(); els.reorderModal.hidden = true; checkpoint(); onFramesChanged(); setHubStatus('Clip playback order updated.'); setTimeout(clearHubStatus, 3000); });

    const linkedRanges = [['adj-bright','val-bright','%'],['adj-contrast','val-contrast','%'],['adj-exp','val-exp','%'],['adj-sat','val-sat','%'],['adj-tol','val-tol',''],['adj-smooth','val-smooth',''],['frame-delay','delay-value',' ms'],['max-dimension','dimension-value',' px'],['adj-webp-q','val-webp-q','%'],['adj-webp-effort','val-webp-effort','']];
    linkedRanges.forEach(([input, output, suffix]) => $(input).addEventListener('input', () => { $(output).textContent = `${$(input).value}${suffix}`; updateEstimate(); refreshOpenPreviews(); }));
    ['chk-transparent','adj-color','chk-webp-lossless'].forEach((id) => $(id).addEventListener('input', () => { updateEstimate(); refreshOpenPreviews(); }));
    $('adj-skip').addEventListener('input', () => { const value = parseInt($('adj-skip').value, 10); $('val-skip').textContent = value === 1 ? 'Keep All' : `Keep 1 in ${value}`; updateEstimate(); });
    $('opt-format').addEventListener('change', updateFormatPanels);
    function updateFormatPanels() { const webp = $('opt-format').value === 'webp'; $('advanced-webp-card').hidden = !webp; $('webp-overlay').hidden = !webp; $('gif-specific-settings').style.opacity = webp ? '.38' : '1'; $('gif-specific-settings').style.pointerEvents = webp ? 'none' : 'auto'; $('play-btn-text').textContent = webp ? 'PLAY WebP' : 'PLAY GIF'; updateEstimate(); }
    function updateEstimate() { if (!state.frames.length) { $('est-size').textContent = 'Est: 0.00 MB'; return; } const count = Math.ceil(state.frames.length / (parseInt($('adj-skip').value, 10) || 1)), dim = getDim(), quality = parseInt($('adj-webp-q').value, 10) / 100, bpp = $('chk-webp-lossless').checked ? 1.5 : (.2 + quality * .4), bytes = dim * dim * count * bpp / 8; $('est-size').textContent = `Est Size: ~${(bytes / (1024 * 1024)).toFixed(2)} MB`; }
    updateFormatPanels();

    async function drawPreparedFrame(index, dim) {
        const frame = state.frames[index], output = makeCanvas(dim), ctx = output.getContext('2d', { willReadFrequently: true }); if (!frame) return output;
        const useTrans = $('chk-transparent').checked; if (!useTrans) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, dim, dim); }
        const image = await loadImage(frame.base64); let w = image.width, h = image.height; if (w > h && w > dim) { h = Math.round(h * dim / w); w = dim; } else if (h >= w && h > dim) { w = Math.round(w * dim / h); h = dim; }
        const x = (dim - w) / 2 + frame.offsetX, y = (dim - h) / 2 + frame.offsetY; ctx.filter = `brightness(${$('adj-exp').value}%) brightness(${$('adj-bright').value}%) contrast(${$('adj-contrast').value}%) saturate(${$('adj-sat').value}%)`; ctx.drawImage(image, x, y, w, h); ctx.filter = 'none'; if (useTrans) applyChroma(ctx, dim); return output;
    }
    function applyChroma(ctx, dim) { const rgb = hexToRgb($('adj-color').value), tol = parseInt($('adj-tol').value, 10), smooth = parseInt($('adj-smooth').value, 10), imageData = ctx.getImageData(0, 0, dim, dim), pixels = imageData.data; for (let i = 0; i < pixels.length; i += 4) { if (!pixels[i + 3]) continue; const distance = Math.hypot(pixels[i] - rgb.r, pixels[i + 1] - rgb.g, pixels[i + 2] - rgb.b); if (distance <= tol) pixels[i + 3] = 0; else if (smooth && distance <= tol + smooth) pixels[i + 3] = Math.floor(pixels[i + 3] * ((distance - tol) / smooth)); } ctx.putImageData(imageData, 0, 0); }
    async function drawOriginalFrame(index, dim) { const output = makeCanvas(dim), frame = state.frames[index]; if (!frame) return output; const image = await loadImage(frame.base64), ctx = output.getContext('2d'); let w = image.width, h = image.height; if (w > h && w > dim) { h = Math.round(h * dim / w); w = dim; } else if (h >= w && h > dim) { w = Math.round(w * dim / h); h = dim; } ctx.drawImage(image, (dim - w) / 2, (dim - h) / 2, w, h); return output; }
    async function renderFrame(index, dim) {
        let output; const baseIndex = baseFrameIndex();
        if (state.fixedBaseEnabled && state.movingActions.length && index !== baseIndex) { output = await drawPreparedFrame(baseIndex, dim); const moving = await drawPreparedFrame(index, dim), mask = buildMask(state.movingActions, dim, 'add', 'subtract'), movingCtx = moving.getContext('2d'); movingCtx.globalCompositeOperation = 'destination-in'; movingCtx.drawImage(mask, 0, 0); output.getContext('2d').drawImage(moving, 0, 0); } else output = await drawPreparedFrame(index, dim);
        if (state.cutoutActions.length) { const mask = buildMask(state.cutoutActions, dim, 'remove', 'restore'), ctx = output.getContext('2d'); ctx.globalCompositeOperation = state.cutoutInverted ? 'destination-in' : 'destination-out'; ctx.drawImage(mask, 0, 0); ctx.globalCompositeOperation = 'source-over'; }
        applyPaint(output.getContext('2d'), dim); return output;
    }
    function buildMask(actions, dim, positive, negative) { const mask = makeCanvas(dim), ctx = mask.getContext('2d'); actions.forEach((action) => { ctx.save(); ctx.globalCompositeOperation = action.mode === negative ? 'destination-out' : 'source-over'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; renderActionPath(ctx, action, dim, true); ctx.restore(); }); return mask; }
    function renderActionPath(ctx, action, dim, fillShape) { const points = action.points.map((point) => ({ x: point.x * dim, y: point.y * dim })); if (!points.length) return; if (action.tool === 'brush') { ctx.lineWidth = Math.max(1, action.size * dim); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); if (points.length === 1) ctx.lineTo(points[0].x + .01, points[0].y); ctx.stroke(); return; } ctx.beginPath(); if (action.tool === 'rect' && points.length > 1) ctx.rect(points[0].x, points[0].y, points[1].x - points[0].x, points[1].y - points[0].y); else { ctx.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); ctx.closePath(); } if (fillShape) ctx.fill(); else ctx.stroke(); }
    function applyPaint(ctx, dim) { state.paintActions.forEach((action) => { const layer = makeCanvas(dim), layerCtx = layer.getContext('2d'); layerCtx.strokeStyle = action.color; layerCtx.fillStyle = action.color; layerCtx.lineWidth = Math.max(1, action.size * dim); layerCtx.lineCap = 'round'; layerCtx.lineJoin = 'round'; if (action.softness > 0) layerCtx.filter = `blur(${Math.max(1, action.softness * action.size * dim * .015)}px)`; const points = action.points.map((point) => ({ x: point.x * dim, y: point.y * dim })); if (!points.length) return; layerCtx.beginPath(); layerCtx.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => layerCtx.lineTo(point.x, point.y)); if (points.length === 1) layerCtx.lineTo(points[0].x + .01, points[0].y); layerCtx.stroke(); ctx.drawImage(layer, 0, 0); }); }

    async function openPreview(index) { state.currentPreviewIndex = index; els.previewModal.hidden = false; await updateLivePreview(); }
    async function updateLivePreview() { if (state.currentPreviewIndex === null || !state.frames[state.currentPreviewIndex]) return; const result = await renderFrame(state.currentPreviewIndex, 280); els.previewImg.src = result.toDataURL('image/png'); }
    function refreshOpenPreviews() { if (!els.previewModal.hidden) updateLivePreview(); if (!els.editorModal.hidden) renderEditor(); if (!els.alignModal.hidden) renderAlign(); }
    $('btn-play-preview').addEventListener('click', openAnimationPreview);
    async function openAnimationPreview() { if (!state.frames.length) return; els.animModal.hidden = false; els.animLoading.hidden = false; els.animImg.hidden = true; state.animationPlaying = true; const indices = outputIndices(), processed = []; for (const index of indices) { if (!state.animationPlaying) return; processed.push((await renderFrame(index, 280)).toDataURL('image/png')); } els.animLoading.hidden = true; els.animImg.hidden = false; let cursor = 0; clearInterval(state.animationTimer); const tick = () => { if (!state.animationPlaying) return; els.animImg.src = processed[cursor]; cursor = (cursor + 1) % processed.length; }; tick(); state.animationTimer = setInterval(tick, parseInt($('frame-delay').value, 10)); }
    function closeAnimationPreview() { state.animationPlaying = false; clearInterval(state.animationTimer); els.animModal.hidden = true; els.animImg.src = ''; }
    function openAlign(index) { state.alignIndex = index; els.alignModal.hidden = false; renderAlign(); }
    async function renderAlign() { if (!state.frames[state.alignIndex]) { els.alignModal.hidden = true; return; } const frame = state.frames[state.alignIndex]; $('align-frame-number').textContent = `FRAME ${state.alignIndex + 1} / ${state.frames.length}`; $('align-offset').textContent = `X: ${frame.offsetX}  Y: ${frame.offsetY}`; const image = await renderFrame(state.alignIndex, 280); els.alignCanvas.width = image.width; els.alignCanvas.height = image.height; els.alignCanvas.getContext('2d').drawImage(image, 0, 0); }
    $('align-prev').addEventListener('click', () => { state.alignIndex = (state.alignIndex - 1 + state.frames.length) % state.frames.length; renderAlign(); }); $('align-next').addEventListener('click', () => { state.alignIndex = (state.alignIndex + 1) % state.frames.length; renderAlign(); });
    document.querySelectorAll('[data-nudge]').forEach((control) => control.addEventListener('click', () => { const frame = state.frames[state.alignIndex]; if (!frame) return; const direction = control.dataset.nudge; if (direction === 'up') frame.offsetY -= 1; if (direction === 'down') frame.offsetY += 1; if (direction === 'left') frame.offsetX -= 1; if (direction === 'right') frame.offsetX += 1; checkpoint(); renderAlign(); renderFrameGrid(); refreshOpenPreviews(); }));
    $('reset-align').addEventListener('click', () => { const frame = state.frames[state.alignIndex]; if (!frame) return; frame.offsetX = 0; frame.offsetY = 0; checkpoint(); renderAlign(); renderFrameGrid(); refreshOpenPreviews(); });

    function installInvertMaskButton() {
        const clearButton = $('clear-cutout');
        if (!clearButton || $('invert-cutout-mask')) return;
        const button = document.createElement('button');
        button.type = 'button'; button.id = 'invert-cutout-mask'; button.className = 'small-reset'; button.style.background = 'var(--forest-teal)'; button.style.marginTop = '10px';
        clearButton.parentNode.insertBefore(button, clearButton);
        button.addEventListener('click', () => { state.cutoutInverted = !state.cutoutInverted; updateInvertMaskButton(); checkpoint(); renderEditor(); refreshOpenPreviews(); });
        updateInvertMaskButton();
    }
    function updateInvertMaskButton() {
        const button = $('invert-cutout-mask'); if (!button) return;
        button.textContent = `INVERT MASK: ${state.cutoutInverted ? 'ON' : 'OFF'}`;
        button.style.background = state.cutoutInverted ? 'var(--water-blue)' : 'var(--forest-teal)';
        button.style.borderColor = state.cutoutInverted ? 'var(--water-spray)' : 'var(--chiseled-bronze)';
    }
    installInvertMaskButton();
    els.openEditorBtn.addEventListener('click', () => { if (!state.frames.length) return; state.editorIndex = 0; els.editorModal.hidden = false; edit.finalView = true; resetViewport(); checkpoint(true); updateEditorLabels(); renderEditor(); });
    function updateEditorLabels() { $('editor-frame-number').textContent = `FRAME ${state.editorIndex + 1} / ${Math.max(1, state.frames.length)}`; $('base-frame-label').textContent = `BASE: ${baseFrameIndex() + 1}`; $('fixed-base-enabled').checked = state.fixedBaseEnabled; updateInvertMaskButton(); }
    $('editor-prev').addEventListener('click', () => switchEditorFrame(-1)); $('editor-next').addEventListener('click', () => switchEditorFrame(1));
    function switchEditorFrame(step) { if (!state.frames.length) return; state.editorIndex = (state.editorIndex + step + state.frames.length) % state.frames.length; updateEditorLabels(); renderEditor(); }
    $('editor-play').addEventListener('click', () => { state.editorPlaying = !state.editorPlaying; $('editor-play').textContent = state.editorPlaying ? '❚❚ PAUSE' : '▶ PLAY'; clearInterval(state.editorTimer); if (state.editorPlaying) state.editorTimer = setInterval(() => switchEditorFrame(1), parseInt($('frame-delay').value, 10)); });
    $('view-final').addEventListener('click', () => setFinalView(true)); $('view-original').addEventListener('click', () => setFinalView(false));
    function setFinalView(finalView) { edit.finalView = finalView; $('view-final').classList.toggle('active', finalView); $('view-original').classList.toggle('active', !finalView); renderEditor(); }
    document.querySelectorAll('#tool-grid [data-tool]').forEach((button) => button.addEventListener('click', () => { edit.tool = button.dataset.tool; document.querySelectorAll('#tool-grid [data-tool]').forEach((item) => item.classList.toggle('active', item === button)); $('finish-polygon').hidden = edit.tool !== 'polygon' || !edit.polygonPoints.length; }));
    document.querySelectorAll('#target-mode [data-target]').forEach((button) => button.addEventListener('click', () => { edit.target = button.dataset.target; document.querySelectorAll('#target-mode button').forEach((item) => item.classList.toggle('active', item === button)); $('cutout-panel').hidden = edit.target !== 'cutout'; $('paint-panel').hidden = edit.target !== 'paint'; $('moving-panel').hidden = edit.target !== 'moving'; }));
    bindSegment('#mask-mode button', 'maskMode'); bindSegment('#paint-mode button', 'paintMode'); bindSegment('#moving-mode button', 'movingMode');
    function bindSegment(selector, property) { document.querySelectorAll(selector).forEach((button) => button.addEventListener('click', () => { edit[property] = button.dataset.maskMode || button.dataset.paintMode || button.dataset.movingMode; document.querySelectorAll(selector).forEach((item) => item.classList.toggle('active', item === button)); })); }
    $('brush-size').addEventListener('input', () => { $('brush-size-label').textContent = $('brush-size').value; }); $('brush-softness').addEventListener('input', () => { $('brush-soft-label').textContent = $('brush-softness').value; });
    document.querySelectorAll('#brush-samples [data-brush-size]').forEach((item) => item.addEventListener('click', () => { $('brush-size').value = item.dataset.brushSize; $('brush-size-label').textContent = item.dataset.brushSize; }));
    $('fixed-base-enabled').addEventListener('change', () => { state.fixedBaseEnabled = $('fixed-base-enabled').checked; checkpoint(); renderEditor(); refreshOpenPreviews(); });
    $('base-prev').addEventListener('click', () => moveBase(-1)); $('base-next').addEventListener('click', () => moveBase(1));
    function moveBase(step) { const nextIndex = (baseFrameIndex() + step + state.frames.length) % state.frames.length; state.baseFrameId = state.frames[nextIndex].id; checkpoint(); updateEditorLabels(); renderEditor(); }
    $('use-current-base').addEventListener('click', () => { state.baseFrameId = state.frames[state.editorIndex].id; checkpoint(); updateEditorLabels(); renderEditor(); });
    $('clear-cutout').addEventListener('click', () => { state.cutoutActions = []; state.cutoutInverted = false; updateInvertMaskButton(); checkpoint(); renderEditor(); refreshOpenPreviews(); }); $('clear-paint').addEventListener('click', () => { state.paintActions = []; checkpoint(); renderEditor(); refreshOpenPreviews(); }); $('clear-moving').addEventListener('click', () => { state.movingActions = []; checkpoint(); renderEditor(); refreshOpenPreviews(); });
    $('reset-all-edits').addEventListener('click', () => { if (!window.confirm('Clear all cutouts, paint, fixed-base regions and individual alignment changes?')) return; state.cutoutActions = []; state.cutoutInverted = false; state.paintActions = []; state.movingActions = []; state.fixedBaseEnabled = false; state.baseFrameId = state.frames.length ? state.frames[0].id : null; state.frames.forEach((frame) => { frame.offsetX = 0; frame.offsetY = 0; }); updateInvertMaskButton(); checkpoint(); updateEditorLabels(); renderEditor(); renderFrameGrid(); refreshOpenPreviews(); });
    $('undo-edit').addEventListener('click', undo); $('redo-edit').addEventListener('click', redo);
    function snapshot() { return JSON.stringify({ cutout: state.cutoutActions, cutoutInverted: state.cutoutInverted, paint: state.paintActions, moving: state.movingActions, fixed: state.fixedBaseEnabled, baseFrameId: state.baseFrameId, offsets: Object.fromEntries(state.frames.map((frame) => [frame.id, { offsetX: frame.offsetX, offsetY: frame.offsetY }])) }); }
    function checkpoint(reset = false) { const value = snapshot(); if (reset || !state.history.length) { state.history = [value]; state.historyIndex = 0; return; } if (state.history[state.historyIndex] === value) return; state.history = state.history.slice(0, state.historyIndex + 1); state.history.push(value); state.historyIndex = state.history.length - 1; }
    function restoreSnapshot(value) { const saved = JSON.parse(value); state.cutoutActions = saved.cutout; state.cutoutInverted = Boolean(saved.cutoutInverted); state.paintActions = saved.paint; state.movingActions = saved.moving; state.fixedBaseEnabled = saved.fixed; state.baseFrameId = saved.baseFrameId; state.frames.forEach((frame) => { if (saved.offsets[frame.id]) { frame.offsetX = saved.offsets[frame.id].offsetX; frame.offsetY = saved.offsets[frame.id].offsetY; } }); updateInvertMaskButton(); updateEditorLabels(); renderEditor(); renderFrameGrid(); refreshOpenPreviews(); }
    function undo() { if (state.historyIndex > 0) { state.historyIndex -= 1; restoreSnapshot(state.history[state.historyIndex]); } } function redo() { if (state.historyIndex < state.history.length - 1) { state.historyIndex += 1; restoreSnapshot(state.history[state.historyIndex]); } }

    async function renderEditor() { if (els.editorModal.hidden || !state.frames[state.editorIndex]) return; const token = ++edit.renderToken, dim = getDim(), result = edit.finalView ? await renderFrame(state.editorIndex, dim) : await drawOriginalFrame(state.editorIndex, dim); if (token !== edit.renderToken) return; els.editorCanvas.width = dim; els.editorCanvas.height = dim; const ctx = els.editorCanvas.getContext('2d'); ctx.clearRect(0, 0, dim, dim); ctx.drawImage(result, 0, 0); drawTransient(ctx, dim); fitCanvas(); }
    function drawTransient(ctx, dim) { const points = edit.tool === 'polygon' ? edit.polygonPoints : edit.points; if (!points.length) return; ctx.save(); ctx.strokeStyle = '#75b2de'; ctx.fillStyle = 'rgba(117,178,222,.18)'; ctx.lineWidth = Math.max(1, dim / 300); ctx.setLineDash([7, 5]); const positions = points.map((point) => ({ x: point.x * dim, y: point.y * dim })); if (edit.tool === 'brush') { ctx.lineWidth = Math.max(1, parseInt($('brush-size').value, 10)); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(positions[0].x, positions[0].y); positions.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); ctx.stroke(); ctx.restore(); return; } ctx.beginPath(); if (edit.tool === 'rect' && positions.length > 1) ctx.rect(positions[0].x, positions[0].y, positions[1].x - positions[0].x, positions[1].y - positions[0].y); else { ctx.moveTo(positions[0].x, positions[0].y); positions.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); if (edit.tool !== 'lasso' || !edit.drawing) ctx.closePath(); } ctx.fill(); ctx.stroke(); ctx.restore(); }
    function fitCanvas() { const dim = getDim(), area = els.canvasViewport.getBoundingClientRect(), fit = Math.min((area.width - 32) / dim, (area.height - 32) / dim, 1), size = Math.max(40, dim * fit); els.editorCanvas.style.width = `${size}px`; els.editorCanvas.style.height = `${size}px`; els.editorCanvas.style.transform = `translate(${edit.panX}px, ${edit.panY}px) scale(${edit.zoom})`; $('zoom-label').textContent = `${Math.round(edit.zoom * 100)}%`; }
    function resetViewport() { edit.zoom = 1; edit.panX = 0; edit.panY = 0; }
    $('zoom-in').addEventListener('click', () => { edit.zoom = clamp(edit.zoom + .25, .5, 5); fitCanvas(); }); $('zoom-out').addEventListener('click', () => { edit.zoom = clamp(edit.zoom - .25, .5, 5); fitCanvas(); }); $('zoom-fit').addEventListener('click', () => { resetViewport(); fitCanvas(); }); $('zoom-reset').addEventListener('click', () => { resetViewport(); fitCanvas(); }); window.addEventListener('resize', () => { if (!els.editorModal.hidden) fitCanvas(); });
    function pointFromEvent(event) { const rect = els.editorCanvas.getBoundingClientRect(); return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) }; }
    let panStart = null;
    els.editorCanvas.addEventListener('pointerdown', (event) => { if (edit.tool === 'pan') { panStart = { x: event.clientX - edit.panX, y: event.clientY - edit.panY }; els.editorCanvas.setPointerCapture(event.pointerId); return; } if (edit.tool === 'polygon') { edit.polygonPoints.push(pointFromEvent(event)); $('finish-polygon').hidden = false; renderEditor(); return; } edit.drawing = true; edit.points = [pointFromEvent(event)]; els.editorCanvas.setPointerCapture(event.pointerId); renderEditor(); });
    els.editorCanvas.addEventListener('pointermove', (event) => { if (panStart) { edit.panX = event.clientX - panStart.x; edit.panY = event.clientY - panStart.y; fitCanvas(); return; } if (!edit.drawing) return; const point = pointFromEvent(event); if (edit.tool === 'rect') edit.points[1] = point; else edit.points.push(point); renderEditor(); });
    els.editorCanvas.addEventListener('pointerup', (event) => { if (panStart) { panStart = null; return; } if (!edit.drawing) return; edit.drawing = false; if (edit.points.length === 1) edit.points.push(pointFromEvent(event)); commitAction(edit.points); edit.points = []; renderEditor(); });
    els.editorCanvas.addEventListener('dblclick', () => { if (edit.tool === 'polygon') commitPolygon(); }); $('finish-polygon').addEventListener('click', commitPolygon);
    function commitPolygon() { if (edit.polygonPoints.length < 3) return; commitAction(edit.polygonPoints); edit.polygonPoints = []; $('finish-polygon').hidden = true; renderEditor(); }
    function commitAction(points) { if (points.length < 2) return; const action = { tool: edit.tool, points: [...points], size: parseInt($('brush-size').value, 10) / Math.max(1, getDim()), softness: parseInt($('brush-softness').value, 10) / 100 }; if (edit.target === 'moving') { action.mode = edit.movingMode; state.movingActions.push(action); } else if (edit.target === 'paint' && edit.paintMode === 'paint') { action.mode = 'paint'; action.color = $('brush-color').value; state.paintActions.push(action); } else { action.mode = edit.target === 'cutout' ? edit.maskMode : (edit.paintMode === 'erase' ? 'remove' : 'restore'); state.cutoutActions.push(action); } checkpoint(); refreshOpenPreviews(); }

    document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => { const id = button.dataset.close; $(id).hidden = true; if (id === 'preview-modal') state.currentPreviewIndex = null; if (id === 'anim-preview-modal') closeAnimationPreview(); if (id === 'frame-editor-modal') { state.editorPlaying = false; clearInterval(state.editorTimer); $('editor-play').textContent = '▶ PLAY'; renderFrameGrid(); refreshOpenPreviews(); } }));
    makeDraggable(els.previewModal, els.previewModal.querySelector('h3')); makeDraggable(els.animModal, els.animModal.querySelector('h3')); makeDraggable(els.alignModal, els.alignModal.querySelector('h3')); makeDraggable(els.reorderModal, $('reorder-clips-drag-handle')); makeDraggable(els.editorWindow, $('editor-drag-handle'));
    function makeDraggable(element, handle) { let dragging = false, offsetX = 0, offsetY = 0; handle.addEventListener('pointerdown', (event) => { if (window.innerWidth <= 680 || event.target.closest('button')) return; dragging = true; const rect = element.getBoundingClientRect(); offsetX = event.clientX - rect.left; offsetY = event.clientY - rect.top; handle.setPointerCapture(event.pointerId); }); handle.addEventListener('pointermove', (event) => { if (!dragging) return; element.style.position = 'fixed'; element.style.left = `${event.clientX - offsetX}px`; element.style.top = `${event.clientY - offsetY}px`; element.style.right = 'auto'; element.style.transform = 'none'; }); handle.addEventListener('pointerup', () => { dragging = false; }); }
    function outputIndices() { const skip = parseInt($('adj-skip').value, 10) || 1; let indices = state.frames.map((_, index) => index).filter((_, index) => index % skip === 0); if ($('chk-reverse').checked) indices.reverse(); if ($('chk-forverse').checked) indices = indices.concat([...indices].reverse()); return indices; }
    els.zipBtn.addEventListener('click', async () => { if (!state.frames.length || typeof JSZip === 'undefined') return; els.zipBtn.disabled = true; els.zipBtn.textContent = 'PACKAGING FRAMES...'; setHubStatus('Rendering processed PNG frames into ZIP package...'); try { const zip = new JSZip(), folder = zip.folder(`${safeName()}-frames`), digits = Math.max(3, String(state.frames.length).length); for (let index = 0; index < state.frames.length; index += 1) { const rendered = await renderFrame(index, getDim()), blob = await canvasToBlob(rendered); folder.file(`${safeName()}-frame-${String(index + 1).padStart(digits, '0')}.png`, blob); } const archive = await zip.generateAsync({ type: 'blob' }); downloadBlob(archive, `${safeName()}-frames.zip`); setHubStatus('Processed PNG frames downloaded as ZIP.'); setTimeout(clearHubStatus, 4000); } catch (error) { setHubStatus(`Frame ZIP failed: ${error.message}`); } els.zipBtn.disabled = false; els.zipBtn.textContent = 'DOWNLOAD FRAMES ZIP'; });
    els.compileBtn.addEventListener('click', async () => { if (state.frames.length < 2) return; els.compileBtn.disabled = true; els.compileBtn.textContent = 'PROCESSING...'; els.outputCard.hidden = false; els.viewport.innerHTML = '<div class="loader"></div>'; const indices = outputIndices(), images = []; setHubStatus('Synthesizing processed frame array...'); try { for (const index of indices) images.push((await renderFrame(index, getDim())).toDataURL('image/png')); if ($('opt-format').value === 'webp') setHubStatus('Animated WebP muxing is unavailable in this browser build. Exporting GIF instead.'); const lossy = $('opt-lossy').value, sampleInterval = lossy === 'high' ? 30 : lossy === 'low' ? 20 : 10; gifshot.createGIF({ images, interval: parseInt($('frame-delay').value, 10) / 1000, gifWidth: getDim(), gifHeight: getDim(), sampleInterval, numWorkers: 2 }, (result) => { els.compileBtn.disabled = false; els.compileBtn.textContent = 'MAKE & SAVE ANIMATION'; if (result.error) { els.viewport.innerHTML = '<p class="help-text">ENGINE FAILURE: Unable to compile.</p>'; setHubStatus('Compilation engine failure.'); return; } els.viewport.innerHTML = `<img src="${result.image}" alt="Compiled animation">`; els.downloadAnchor.href = result.image; els.downloadAnchor.download = `${safeName()}.gif`; els.downloadAnchor.click(); setHubStatus('Animation generated and downloaded.'); setTimeout(clearHubStatus, 4000); }); } catch (error) { els.compileBtn.disabled = false; els.compileBtn.textContent = 'MAKE & SAVE ANIMATION'; els.viewport.innerHTML = `<p class="help-text">ERROR: ${error.message}</p>`; setHubStatus('Compilation engine failure.'); } });
    onFramesChanged();
})();
