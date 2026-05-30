(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const qsa = (selector) => [...document.querySelectorAll(selector)];
    const els = {
        topPanel: $('top-panel'), countdown: $('countdown-circle'), imagePicker: $('image-picker'), videoPicker: $('video-picker'),
        frameGrid: $('frame-grid'), queueCard: $('queue-card'), compileBtn: $('compile-btn'), zipBtn: $('zip-btn'), openEditorBtn: $('open-editor-btn'),
        reorderClipsBtn: $('reorder-clips-btn'), reorderModal: $('reorder-clips-modal'), clipOrderList: $('clip-order-list'),
        outputCard: $('output-card'), viewport: $('compiled-viewport'), downloadAnchor: $('download-anchor'),
        previewModal: $('preview-modal'), previewImg: $('modal-img'), animModal: $('anim-preview-modal'), animImg: $('anim-modal-img'), animLoading: $('anim-loading'),
        alignModal: $('align-modal'), alignCanvas: $('align-canvas'), editorModal: $('frame-editor-modal'), editorWindow: $('editor-window'), editorCanvas: $('frame-editor-canvas'), canvasViewport: $('canvas-viewport')
    };

    const state = {
        frames: [], clips: [], clipSerial: 0, reorderDraft: [],
        cutoutActions: [], cutoutInverted: false, paintActions: [], bucketActions: [], movingActions: [],
        animateAreaEnabled: false, baseFrameId: null,
        previewIndex: null, alignIndex: 0, editorIndex: 0,
        editorPlaying: false, editorTimer: null, animationPlaying: false, animationTimer: null,
        history: [], historyIndex: -1
    };
    const edit = {
        tool: 'rect', target: 'cutout', maskMode: 'remove', paintMode: 'paint', bucketMode: 'transparent', movingMode: 'add', finalView: true,
        zoom: 1, panX: 0, panY: 0, previewBackground: 'checker', drawing: false, points: [], polygonPoints: [], renderToken: 0
    };

    function setHubStatus(text) { try { window.parent.postMessage({ type: 'set-status', text }, '*'); } catch (error) {} }
    function clearHubStatus() { try { window.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {} }
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function getDim() { return parseInt($('max-dimension').value, 10) || 480; }
    function safeName() { return ($('seq-name').value || 'animation-export').trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-') || 'animation-export'; }
    function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
    function makeCanvas(width, height = width) { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; }
    function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; }); }
    function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
    function canvasToBlob(canvas) { return new Promise((resolve) => canvas.toBlob(resolve, 'image/png')); }
    function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200); }
    function hexToRgb(hex) { const number = parseInt(hex.replace('#', ''), 16); return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 }; }
    function rgba(hex, alpha) { const c = hexToRgb(hex); return `rgba(${c.r},${c.g},${c.b},${alpha})`; }

    let countdownValue = 5, countdownTimer = null, headerLocked = false, headerHovered = false;
    function showCountdown() { els.countdown.textContent = headerLocked ? '🔒' : String(countdownValue); els.countdown.style.borderColor = headerLocked ? 'var(--terracotta-peach)' : 'var(--chiseled-bronze)'; }
    function resetCountdown() { clearInterval(countdownTimer); countdownValue = 5; showCountdown(); }
    function openHeader() { els.topPanel.classList.remove('minimized'); resetCountdown(); }
    function startCountdown() { if (headerLocked || headerHovered) return; clearInterval(countdownTimer); countdownTimer = setInterval(() => { countdownValue -= 1; showCountdown(); if (countdownValue <= 0) { clearInterval(countdownTimer); els.topPanel.classList.add('minimized'); } }, 1000); }
    els.topPanel.addEventListener('mouseenter', () => { headerHovered = true; openHeader(); clearInterval(countdownTimer); });
    els.topPanel.addEventListener('mouseleave', () => { headerHovered = false; resetCountdown(); startCountdown(); });
    els.countdown.addEventListener('dblclick', (event) => { event.preventDefault(); event.stopPropagation(); headerLocked = !headerLocked; showCountdown(); if (headerLocked) { clearInterval(countdownTimer); openHeader(); } else if (!headerHovered) { startCountdown(); } });
    startCountdown();

    function createClip(name, type) { state.clipSerial += 1; const clip = { id: makeId('clip'), name: name || `${type}-${state.clipSerial}`, type }; state.clips.push(clip); return clip; }
    function clipFrames(id) { return state.frames.filter((frame) => frame.clipId === id); }
    function frameIndexById(id) { return state.frames.findIndex((frame) => frame.id === id); }
    function getBaseIndex() { const index = frameIndexById(state.baseFrameId); return index >= 0 ? index : 0; }
    function normalizeClipOrder() {
        const present = new Set(state.frames.map((frame) => frame.clipId));
        state.clips = state.clips.filter((clip) => present.has(clip.id));
        state.frames = state.clips.flatMap((clip) => clipFrames(clip.id));
        if (state.frames.length && frameIndexById(state.baseFrameId) < 0) state.baseFrameId = state.frames[0].id;
        if (!state.frames.length) state.baseFrameId = null;
    }
    function addFrame(src, image, clipId) { state.frames.push({ id: makeId('frame'), clipId, base64: src, w: image.width, h: image.height, offsetX: 0, offsetY: 0 }); }
    function clipLabel(clip, index) { return clip.type === 'video' ? `CLIP ${index + 1}` : `IMAGES ${index + 1}`; }

    els.imagePicker.addEventListener('change', async (event) => {
        const files = [...event.target.files]; if (!files.length) return;
        const empty = state.frames.length === 0, clip = createClip(files.length === 1 ? files[0].name : `Imported Images (${files.length})`, 'images');
        if (empty) $('seq-name').value = files[0].name.replace(/\.[^/.]+$/, '') || 'animation-export';
        for (const file of files) { const src = await fileToDataUrl(file); const image = await loadImage(src); addFrame(src, image, clip.id); }
        els.imagePicker.value = ''; onFramesChanged();
    });
    $('btn-convert-movie').addEventListener('click', () => els.videoPicker.click());
    els.videoPicker.addEventListener('change', async (event) => {
        const file = event.target.files[0]; if (!file) return;
        const empty = state.frames.length === 0; if (empty) $('seq-name').value = file.name.replace(/\.[^/.]+$/, '') || 'animation-export';
        const clip = createClip(file.name, 'video'), url = URL.createObjectURL(file), video = document.createElement('video');
        video.src = url; video.muted = true; video.playsInline = true;
        els.viewport.innerHTML = `<div class="loader"></div><p class="help-text">Extracting ${file.name}...</p>`; els.outputCard.hidden = false; setHubStatus(`Extracting frames from ${file.name}...`);
        try {
            await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; video.load(); });
            const fps = 12, total = Math.max(1, Math.floor(video.duration * fps)), canvas = makeCanvas(video.videoWidth, video.videoHeight), ctx = canvas.getContext('2d');
            for (let index = 0; index < total; index += 1) {
                await new Promise((resolve) => { video.onseeked = resolve; video.currentTime = Math.min(index / fps, video.duration || index / fps); });
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                state.frames.push({ id: makeId('frame'), clipId: clip.id, base64: canvas.toDataURL('image/jpeg', .85), w: canvas.width, h: canvas.height, offsetX: 0, offsetY: 0 });
                els.viewport.innerHTML = `<p class="clip-extract-progress">Extracting ${file.name} (${Math.round(((index + 1) / total) * 100)}%)...</p>`;
            }
            setHubStatus(`${file.name} added with ${total} frames.`); setTimeout(clearHubStatus, 4000);
        } catch (error) { state.clips = state.clips.filter((entry) => entry.id !== clip.id); setHubStatus('Video extraction failed.'); }
        URL.revokeObjectURL(url); els.videoPicker.value = ''; els.outputCard.hidden = true; els.viewport.innerHTML = ''; onFramesChanged();
    });
    function removeClip(id) {
        const clip = state.clips.find((entry) => entry.id === id); if (!clip) return;
        if (!window.confirm(`Remove ${clip.name} and its ${clipFrames(id).length} frames?`)) return;
        state.frames = state.frames.filter((frame) => frame.clipId !== id); state.clips = state.clips.filter((entry) => entry.id !== id); normalizeClipOrder(); checkpoint(); onFramesChanged();
    }

    let draggedFrameId = null;
    function thumbButton(className, text, title, action) { const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = text; button.title = title; button.addEventListener('click', (event) => { event.stopPropagation(); action(); }); return button; }
    function renderFrameGrid() {
        els.frameGrid.innerHTML = ''; els.queueCard.hidden = !state.frames.length; $('frame-skip-container').hidden = state.frames.length <= 15;
        if (state.frames.length <= 15) { $('adj-skip').value = '1'; $('val-skip').textContent = 'Keep All'; }
        state.clips.filter((clip) => clipFrames(clip.id).length).forEach((clip, clipIndex) => {
            const divider = document.createElement('div'); divider.className = 'clip-divider';
            divider.innerHTML = `<span class="clip-title"><span>${clipLabel(clip, clipIndex)}</span><span class="clip-title-name" title="${clip.name}">— ${clip.name}</span></span>`;
            const remove = document.createElement('button'); remove.className = 'clip-remove-btn'; remove.type = 'button'; remove.textContent = 'REMOVE'; remove.addEventListener('click', () => removeClip(clip.id)); divider.appendChild(remove); els.frameGrid.appendChild(divider);
            clipFrames(clip.id).forEach(renderThumbnail);
        });
    }
    function renderThumbnail(frame) {
        const index = frameIndexById(frame.id), item = document.createElement('div'); item.className = 'frame-thumb-wrapper'; item.draggable = true;
        item.innerHTML = `<img src="${frame.base64}" alt="Frame ${index + 1}"><span class="frame-index-badge">${index + 1}</span>`;
        if (frame.offsetX || frame.offsetY) item.insertAdjacentHTML('beforeend', `<span class="frame-badge-offset">${frame.offsetX},${frame.offsetY}</span>`);
        item.append(thumbButton('thumb-btn frame-preview-btn', '👁', 'Preview processed frame', () => openPreview(index)), thumbButton('thumb-btn frame-align-btn', '⊕', 'Align this frame', () => openAlign(index)), thumbButton('thumb-btn frame-delete-btn', '×', 'Delete frame', () => { state.frames = state.frames.filter((entry) => entry.id !== frame.id); normalizeClipOrder(); onFramesChanged(); }));
        item.addEventListener('dragstart', () => { draggedFrameId = frame.id; setTimeout(() => item.classList.add('dragging'), 0); });
        item.addEventListener('dragend', () => { draggedFrameId = null; item.classList.remove('dragging'); });
        item.addEventListener('dragover', (event) => { event.preventDefault(); const moving = state.frames.find((entry) => entry.id === draggedFrameId); if (!moving || moving.id === frame.id || moving.clipId !== frame.clipId) return; const after = event.clientX - item.getBoundingClientRect().left >= item.clientWidth / 2; item.classList.toggle('drag-over-left', !after); item.classList.toggle('drag-over-right', after); });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over-left', 'drag-over-right'));
        item.addEventListener('drop', (event) => {
            event.preventDefault(); item.classList.remove('drag-over-left', 'drag-over-right'); const moving = state.frames.find((entry) => entry.id === draggedFrameId); if (!moving || moving.id === frame.id) return;
            if (moving.clipId !== frame.clipId) { setHubStatus('Use REORDER CLIPS to move complete videos.'); setTimeout(clearHubStatus, 3000); return; }
            const from = frameIndexById(moving.id), after = event.clientX - item.getBoundingClientRect().left >= item.clientWidth / 2; let to = frameIndexById(frame.id) + (after ? 1 : 0); const removed = state.frames.splice(from, 1)[0]; if (from < to) to -= 1; state.frames.splice(to, 0, removed); renderFrameGrid();
        });
        els.frameGrid.appendChild(item);
    }
    function onFramesChanged() {
        normalizeClipOrder(); state.alignIndex = clamp(state.alignIndex, 0, Math.max(0, state.frames.length - 1)); state.editorIndex = clamp(state.editorIndex, 0, Math.max(0, state.frames.length - 1));
        updateOriginalSize(); renderFrameGrid(); updateEstimate(); updateEditorLabels();
        els.openEditorBtn.disabled = !state.frames.length; els.zipBtn.disabled = !state.frames.length; els.compileBtn.disabled = state.frames.length < 2;
        els.reorderClipsBtn.hidden = state.clips.filter((clip) => clipFrames(clip.id).length).length < 2;
    }
    function updateOriginalSize() {
        if (!state.frames.length) { $('original-size-label').textContent = ''; return; }
        const width = Math.max(...state.frames.map((frame) => frame.w)), height = Math.max(...state.frames.map((frame) => frame.h)), max = Math.max(width, height, 540);
        $('original-size-label').textContent = `Original size: ${width}×${height}`; $('max-dimension').max = String(max);
        if (parseInt($('max-dimension').value, 10) < Math.max(width, height)) { $('max-dimension').value = String(Math.max(width, height)); $('dimension-value').textContent = `${$('max-dimension').value} px`; }
    }

    let draggedClipId = null;
    els.reorderClipsBtn.addEventListener('click', () => { state.reorderDraft = state.clips.filter((clip) => clipFrames(clip.id).length).map((clip) => clip.id); renderClipOrder(); els.reorderModal.hidden = false; });
    function renderClipOrder() {
        els.clipOrderList.innerHTML = '';
        state.reorderDraft.forEach((id, index) => {
            const clip = state.clips.find((entry) => entry.id === id), pill = document.createElement('div'); if (!clip) return;
            pill.className = 'clip-order-pill'; pill.draggable = true; pill.innerHTML = `<span class="clip-grip">⋮⋮</span><span class="clip-order-text"><span class="clip-order-label">${clipLabel(clip, index)}</span><span class="clip-order-name">${clip.name}</span><span class="clip-order-count">${clipFrames(id).length} frames</span></span>`;
            const controls = document.createElement('span'); controls.className = 'clip-move-controls';
            [-1, 1].forEach((direction) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = direction < 0 ? '↑' : '↓'; button.disabled = direction < 0 ? index === 0 : index === state.reorderDraft.length - 1; button.addEventListener('click', () => { const destination = index + direction; if (destination < 0 || destination >= state.reorderDraft.length) return; [state.reorderDraft[index], state.reorderDraft[destination]] = [state.reorderDraft[destination], state.reorderDraft[index]]; renderClipOrder(); }); controls.appendChild(button); });
            pill.appendChild(controls); pill.addEventListener('dragstart', () => { draggedClipId = id; pill.classList.add('dragging'); }); pill.addEventListener('dragend', () => { draggedClipId = null; pill.classList.remove('dragging'); });
            pill.addEventListener('dragover', (event) => { event.preventDefault(); if (draggedClipId && draggedClipId !== id) pill.classList.add('drag-over'); }); pill.addEventListener('dragleave', () => pill.classList.remove('drag-over'));
            pill.addEventListener('drop', (event) => { event.preventDefault(); pill.classList.remove('drag-over'); if (!draggedClipId || draggedClipId === id) return; const from = state.reorderDraft.indexOf(draggedClipId), to = state.reorderDraft.indexOf(id), moving = state.reorderDraft.splice(from, 1)[0]; state.reorderDraft.splice(to, 0, moving); renderClipOrder(); });
            els.clipOrderList.appendChild(pill);
        });
    }
    $('apply-clip-order').addEventListener('click', () => { const map = new Map(state.clips.map((clip) => [clip.id, clip])); state.clips = state.reorderDraft.map((id) => map.get(id)).filter(Boolean); normalizeClipOrder(); els.reorderModal.hidden = true; checkpoint(); onFramesChanged(); });

    const linkedRanges = [['adj-bright','val-bright','%'],['adj-contrast','val-contrast','%'],['adj-exp','val-exp','%'],['adj-sat','val-sat','%'],['adj-tol','val-tol',''],['adj-smooth','val-smooth',''],['frame-delay','delay-value',' ms'],['max-dimension','dimension-value',' px'],['adj-webp-q','val-webp-q','%'],['adj-webp-effort','val-webp-effort',''],['shadow-opacity','shadow-opacity-value','%'],['shadow-blur','shadow-blur-value',' px'],['shadow-x','shadow-x-value',' px'],['shadow-y','shadow-y-value',' px']];
    linkedRanges.forEach(([input, output, suffix]) => { if (!$(input)) return; $(input).addEventListener('input', () => { $(output).textContent = `${$(input).value}${suffix}`; updateEstimate(); refreshPreviews(); }); });
    ['chk-transparent','adj-color','chk-webp-lossless','chk-shadow','shadow-color'].forEach((id) => { if ($(id)) $(id).addEventListener('input', () => { updateEstimate(); refreshPreviews(); }); });
    $('adj-skip').addEventListener('input', () => { const value = parseInt($('adj-skip').value, 10); $('val-skip').textContent = value === 1 ? 'Keep All' : `Keep 1 in ${value}`; updateEstimate(); });
    $('opt-format').addEventListener('change', () => { const webp = $('opt-format').value === 'webp'; $('advanced-webp-card').hidden = !webp; $('webp-overlay').hidden = !webp; $('gif-specific-settings').style.opacity = webp ? '.38' : '1'; $('gif-specific-settings').style.pointerEvents = webp ? 'none' : 'auto'; $('play-btn-text').textContent = webp ? 'PLAY WebP' : 'PLAY GIF'; updateEstimate(); });
    $('opt-format').dispatchEvent(new Event('change'));
    function updateEstimate() { if (!state.frames.length) { $('est-size').textContent = 'Est: 0.00 MB'; return; } const count = Math.ceil(state.frames.length / (parseInt($('adj-skip').value, 10) || 1)), dim = getDim(), quality = parseInt($('adj-webp-q').value, 10) / 100, bpp = $('chk-webp-lossless').checked ? 1.5 : (.2 + quality * .4); $('est-size').textContent = `Est Size: ~${((dim * dim * count * bpp / 8) / (1024 * 1024)).toFixed(2)} MB`; }

    function requiresAlpha() { return $('chk-transparent').checked || state.cutoutActions.length || state.bucketActions.some((action) => action.mode === 'transparent'); }
    async function drawAdjustedFrame(index, dim) {
        const frame = state.frames[index], output = makeCanvas(dim), ctx = output.getContext('2d', { willReadFrequently: true }); if (!frame) return output;
        if (!requiresAlpha()) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, dim, dim); }
        const image = await loadImage(frame.base64); let w = image.width, h = image.height;
        if (w > h && w > dim) { h = Math.round(h * dim / w); w = dim; } else if (h >= w && h > dim) { w = Math.round(w * dim / h); h = dim; }
        ctx.filter = `brightness(${$('adj-exp').value}%) brightness(${$('adj-bright').value}%) contrast(${$('adj-contrast').value}%) saturate(${$('adj-sat').value}%)`;
        ctx.drawImage(image, (dim - w) / 2 + frame.offsetX, (dim - h) / 2 + frame.offsetY, w, h); ctx.filter = 'none'; return output;
    }
    async function drawOriginalFrame(index, dim) { const output = makeCanvas(dim), frame = state.frames[index]; if (!frame) return output; const image = await loadImage(frame.base64), ctx = output.getContext('2d'); let w = image.width, h = image.height; if (w > h && w > dim) { h = Math.round(h * dim / w); w = dim; } else if (h >= w && h > dim) { w = Math.round(w * dim / h); h = dim; } ctx.drawImage(image, (dim - w) / 2, (dim - h) / 2, w, h); return output; }
    async function renderFrame(index, dim) {
        let output; const baseIndex = getBaseIndex();
        if (state.animateAreaEnabled && state.movingActions.length && index !== baseIndex) {
            output = await drawAdjustedFrame(baseIndex, dim); const moving = await drawAdjustedFrame(index, dim), movingCtx = moving.getContext('2d'); movingCtx.globalCompositeOperation = 'destination-in'; movingCtx.drawImage(buildMask(state.movingActions, dim, 'add', 'subtract'), 0, 0); movingCtx.globalCompositeOperation = 'source-over'; output.getContext('2d').drawImage(moving, 0, 0);
        } else output = await drawAdjustedFrame(index, dim);
        state.bucketActions.forEach((action) => applyBucketFill(output, action, dim));
        if ($('chk-transparent').checked) applyChroma(output.getContext('2d', { willReadFrequently: true }), dim);
        if (state.cutoutActions.length) { const ctx = output.getContext('2d'); ctx.globalCompositeOperation = state.cutoutInverted ? 'destination-in' : 'destination-out'; ctx.drawImage(buildMask(state.cutoutActions, dim, 'remove', 'restore'), 0, 0); ctx.globalCompositeOperation = 'source-over'; }
        applyPaint(output.getContext('2d'), dim);
        return applyShadow(output, dim);
    }
    function applyChroma(ctx, dim) {
        const target = hexToRgb($('adj-color').value), tolerance = parseInt($('adj-tol').value, 10), smooth = parseInt($('adj-smooth').value, 10), image = ctx.getImageData(0, 0, dim, dim), pixels = image.data;
        for (let i = 0; i < pixels.length; i += 4) { if (!pixels[i + 3]) continue; const distance = Math.hypot(pixels[i] - target.r, pixels[i + 1] - target.g, pixels[i + 2] - target.b); if (distance <= tolerance) pixels[i + 3] = 0; else if (smooth && distance <= tolerance + smooth) pixels[i + 3] = Math.floor(pixels[i + 3] * ((distance - tolerance) / smooth)); }
        ctx.putImageData(image, 0, 0);
    }
    function floodRegion(data, width, height, seedX, seedY, tolerance) {
        const sx = clamp(Math.round(seedX * (width - 1)), 0, width - 1), sy = clamp(Math.round(seedY * (height - 1)), 0, height - 1), start = (sy * width + sx) * 4;
        const target = [data[start], data[start + 1], data[start + 2], data[start + 3]], selected = new Uint8Array(width * height), stack = [sy * width + sx];
        while (stack.length) { const pixel = stack.pop(); if (selected[pixel]) continue; const offset = pixel * 4, distance = Math.hypot(data[offset] - target[0], data[offset + 1] - target[1], data[offset + 2] - target[2], (data[offset + 3] - target[3]) * .5); if (distance > tolerance) continue; selected[pixel] = 1; const x = pixel % width, y = Math.floor(pixel / width); if (x > 0) stack.push(pixel - 1); if (x < width - 1) stack.push(pixel + 1); if (y > 0) stack.push(pixel - width); if (y < height - 1) stack.push(pixel + width); }
        return selected;
    }
    function applyBucketFill(canvas, action, dim) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true }), image = ctx.getImageData(0, 0, dim, dim), pixels = image.data, region = floodRegion(pixels, dim, dim, action.seed.x, action.seed.y, action.tolerance), colour = hexToRgb(action.color);
        for (let pixel = 0; pixel < region.length; pixel += 1) { if (!region[pixel]) continue; const offset = pixel * 4; if (action.mode === 'transparent') pixels[offset + 3] = 0; else { pixels[offset] = colour.r; pixels[offset + 1] = colour.g; pixels[offset + 2] = colour.b; pixels[offset + 3] = 255; } }
        if (action.mode === 'transparent' && action.feather > 0) featherTransparentEdge(pixels, region, dim, Math.max(1, Math.round(action.feather * dim)));
        ctx.putImageData(image, 0, 0);
    }
    function featherTransparentEdge(pixels, region, dim, radius) {
        const boundary = [];
        for (let y = 1; y < dim - 1; y += 1) for (let x = 1; x < dim - 1; x += 1) { const at = y * dim + x; if (!region[at]) continue; if (!region[at - 1] || !region[at + 1] || !region[at - dim] || !region[at + dim]) boundary.push({ x, y }); }
        boundary.forEach((edge) => { for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) { const x = edge.x + dx, y = edge.y + dy; if (x < 0 || y < 0 || x >= dim || y >= dim) continue; const at = y * dim + x; if (region[at]) continue; const distance = Math.hypot(dx, dy); if (distance > radius) continue; const alpha = Math.round(255 * (distance / radius)); const offset = at * 4 + 3; pixels[offset] = Math.min(pixels[offset], alpha); } });
    }
    function buildMask(actions, dim, positive, negative) { const mask = makeCanvas(dim), ctx = mask.getContext('2d'); actions.forEach((action) => { ctx.save(); ctx.globalCompositeOperation = action.mode === negative ? 'destination-out' : 'source-over'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; renderActionPath(ctx, action, dim, true); ctx.restore(); }); return mask; }
    function renderActionPath(ctx, action, dim, fillShape) {
        const points = action.points.map((point) => ({ x: point.x * dim, y: point.y * dim })); if (!points.length) return;
        if (action.tool === 'brush') { ctx.lineWidth = Math.max(1, action.size * dim); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); if (points.length === 1) ctx.lineTo(points[0].x + .01, points[0].y); ctx.stroke(); return; }
        ctx.beginPath(); if (action.tool === 'rect' && points.length > 1) ctx.rect(points[0].x, points[0].y, points[1].x - points[0].x, points[1].y - points[0].y); else { ctx.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); ctx.closePath(); } if (fillShape) ctx.fill(); else ctx.stroke();
    }
    function applyPaint(ctx, dim) { state.paintActions.forEach((action) => { const layer = makeCanvas(dim), layerCtx = layer.getContext('2d'); layerCtx.strokeStyle = action.color; layerCtx.lineWidth = Math.max(1, action.size * dim); layerCtx.lineCap = 'round'; layerCtx.lineJoin = 'round'; if (action.softness > 0) layerCtx.filter = `blur(${Math.max(1, action.softness * action.size * dim * .015)}px)`; const points = action.points.map((point) => ({ x: point.x * dim, y: point.y * dim })); layerCtx.beginPath(); layerCtx.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => layerCtx.lineTo(point.x, point.y)); if (points.length === 1) layerCtx.lineTo(points[0].x + .01, points[0].y); layerCtx.stroke(); ctx.drawImage(layer, 0, 0); }); }
    function applyShadow(source, dim) {
        if (!$('chk-shadow') || !$('chk-shadow').checked) return source;
        const result = makeCanvas(dim), ctx = result.getContext('2d'), scale = dim / getDim(), opacity = parseInt($('shadow-opacity').value, 10) / 100;
        ctx.save(); ctx.globalAlpha = opacity; ctx.shadowColor = rgba($('shadow-color').value, 1); ctx.shadowBlur = parseInt($('shadow-blur').value, 10) * scale; ctx.shadowOffsetX = parseInt($('shadow-x').value, 10) * scale; ctx.shadowOffsetY = parseInt($('shadow-y').value, 10) * scale; ctx.drawImage(source, 0, 0); ctx.restore(); ctx.drawImage(source, 0, 0); return result;
    }

    async function openPreview(index) { state.previewIndex = index; els.previewModal.hidden = false; await updatePreview(); }
    async function updatePreview() { if (state.previewIndex === null || !state.frames[state.previewIndex]) return; els.previewImg.src = (await renderFrame(state.previewIndex, 280)).toDataURL('image/png'); }
    function refreshPreviews() { if (!els.previewModal.hidden) updatePreview(); if (!els.editorModal.hidden) renderEditor(); if (!els.alignModal.hidden) renderAlign(); }
    function outputIndices() { const skip = parseInt($('adj-skip').value, 10) || 1; let indices = state.frames.map((_, index) => index).filter((_, index) => index % skip === 0); if ($('chk-reverse').checked) indices.reverse(); if ($('chk-forverse').checked) indices = indices.concat([...indices].reverse()); return indices; }
    $('btn-play-preview').addEventListener('click', async () => { if (!state.frames.length) return; els.animModal.hidden = false; els.animLoading.hidden = false; els.animImg.hidden = true; state.animationPlaying = true; const rendered = []; for (const index of outputIndices()) { if (!state.animationPlaying) return; rendered.push((await renderFrame(index, 280)).toDataURL('image/png')); } els.animLoading.hidden = true; els.animImg.hidden = false; let cursor = 0; clearInterval(state.animationTimer); const tick = () => { if (!state.animationPlaying) return; els.animImg.src = rendered[cursor]; cursor = (cursor + 1) % rendered.length; }; tick(); state.animationTimer = setInterval(tick, parseInt($('frame-delay').value, 10)); });
    function closeAnimationPreview() { state.animationPlaying = false; clearInterval(state.animationTimer); els.animModal.hidden = true; els.animImg.src = ''; }
    function openAlign(index) { state.alignIndex = index; els.alignModal.hidden = false; renderAlign(); }
    async function renderAlign() { const frame = state.frames[state.alignIndex]; if (!frame) { els.alignModal.hidden = true; return; } $('align-frame-number').textContent = `FRAME ${state.alignIndex + 1} / ${state.frames.length}`; $('align-offset').textContent = `X: ${frame.offsetX}  Y: ${frame.offsetY}`; const rendered = await renderFrame(state.alignIndex, 280); els.alignCanvas.width = rendered.width; els.alignCanvas.height = rendered.height; els.alignCanvas.getContext('2d').drawImage(rendered, 0, 0); }
    $('align-prev').addEventListener('click', () => { state.alignIndex = (state.alignIndex - 1 + state.frames.length) % state.frames.length; renderAlign(); }); $('align-next').addEventListener('click', () => { state.alignIndex = (state.alignIndex + 1) % state.frames.length; renderAlign(); });
    qsa('[data-nudge]').forEach((button) => button.addEventListener('click', () => { const frame = state.frames[state.alignIndex]; if (!frame) return; if (button.dataset.nudge === 'up') frame.offsetY -= 1; if (button.dataset.nudge === 'down') frame.offsetY += 1; if (button.dataset.nudge === 'left') frame.offsetX -= 1; if (button.dataset.nudge === 'right') frame.offsetX += 1; checkpoint(); renderAlign(); renderFrameGrid(); refreshPreviews(); }));
    $('reset-align').addEventListener('click', () => { const frame = state.frames[state.alignIndex]; if (!frame) return; frame.offsetX = 0; frame.offsetY = 0; checkpoint(); renderAlign(); renderFrameGrid(); refreshPreviews(); });

    els.openEditorBtn.addEventListener('click', () => { if (!state.frames.length) return; state.editorIndex = 0; els.editorModal.hidden = false; edit.finalView = true; resetViewport(); checkpoint(true); updateEditorLabels(); setPreviewBackground(edit.previewBackground); renderEditor(); });
    function updateEditorLabels() { $('editor-frame-number').textContent = `FRAME ${state.editorIndex + 1} / ${Math.max(1, state.frames.length)}`; $('base-frame-label').textContent = `BASE: ${getBaseIndex() + 1}`; $('animate-area-enabled').checked = state.animateAreaEnabled; $('invert-cutout-mask').textContent = `INVERT MASK: ${state.cutoutInverted ? 'ON' : 'OFF'}`; $('invert-cutout-mask').classList.toggle('active-toggle', state.cutoutInverted); }
    $('editor-prev').addEventListener('click', () => switchFrame(-1)); $('editor-next').addEventListener('click', () => switchFrame(1));
    function switchFrame(step) { if (!state.frames.length) return; state.editorIndex = (state.editorIndex + step + state.frames.length) % state.frames.length; updateEditorLabels(); renderEditor(); }
    $('editor-play').addEventListener('click', () => { state.editorPlaying = !state.editorPlaying; $('editor-play').textContent = state.editorPlaying ? '❚❚ PAUSE' : '▶ PLAY'; clearInterval(state.editorTimer); if (state.editorPlaying) state.editorTimer = setInterval(() => switchFrame(1), parseInt($('frame-delay').value, 10)); });
    $('view-final').addEventListener('click', () => setFinalView(true)); $('view-original').addEventListener('click', () => setFinalView(false));
    function setFinalView(value) { edit.finalView = value; $('view-final').classList.toggle('active', value); $('view-original').classList.toggle('active', !value); renderEditor(); }
    function activateTarget(target) { edit.target = target; qsa('#target-mode button').forEach((button) => button.classList.toggle('active', button.dataset.target === target)); $('cutout-panel').hidden = target !== 'cutout'; $('paint-panel').hidden = target !== 'paint'; $('moving-panel').hidden = target !== 'moving'; }
    qsa('#target-mode [data-target]').forEach((button) => button.addEventListener('click', () => activateTarget(button.dataset.target)));
    qsa('#tool-grid [data-tool]').forEach((button) => button.addEventListener('click', () => { edit.tool = button.dataset.tool; qsa('#tool-grid [data-tool]').forEach((item) => item.classList.toggle('active', item === button)); $('finish-polygon').hidden = edit.tool !== 'polygon' || !edit.polygonPoints.length; if (edit.tool === 'bucket') activateTarget('paint'); }));
    function bindSegment(selector, property, dataName) { qsa(selector).forEach((button) => button.addEventListener('click', () => { edit[property] = button.dataset[dataName]; qsa(selector).forEach((item) => item.classList.toggle('active', item === button)); })); }
    bindSegment('#mask-mode button', 'maskMode', 'maskMode'); bindSegment('#paint-mode button', 'paintMode', 'paintMode'); bindSegment('#bucket-mode button', 'bucketMode', 'bucketMode'); bindSegment('#moving-mode button', 'movingMode', 'movingMode');
    $('invert-cutout-mask').addEventListener('click', () => { state.cutoutInverted = !state.cutoutInverted; updateEditorLabels(); checkpoint(); renderEditor(); refreshPreviews(); });
    $('brush-size').addEventListener('input', () => { $('brush-size-label').textContent = $('brush-size').value; }); $('brush-softness').addEventListener('input', () => { $('brush-soft-label').textContent = $('brush-softness').value; }); $('bucket-tolerance').addEventListener('input', () => { $('bucket-tolerance-label').textContent = $('bucket-tolerance').value; }); $('bucket-feather').addEventListener('input', () => { $('bucket-feather-label').textContent = $('bucket-feather').value; });
    qsa('#brush-samples [data-brush-size]').forEach((item) => item.addEventListener('click', () => { $('brush-size').value = item.dataset.brushSize; $('brush-size-label').textContent = item.dataset.brushSize; }));
    $('animate-area-enabled').addEventListener('change', () => { state.animateAreaEnabled = $('animate-area-enabled').checked; checkpoint(); renderEditor(); refreshPreviews(); });
    $('base-prev').addEventListener('click', () => moveBase(-1)); $('base-next').addEventListener('click', () => moveBase(1));
    function moveBase(step) { state.baseFrameId = state.frames[(getBaseIndex() + step + state.frames.length) % state.frames.length].id; checkpoint(); updateEditorLabels(); renderEditor(); }
    $('use-current-base').addEventListener('click', () => { state.baseFrameId = state.frames[state.editorIndex].id; checkpoint(); updateEditorLabels(); renderEditor(); });
    $('clear-cutout').addEventListener('click', () => { state.cutoutActions = []; state.cutoutInverted = false; checkpoint(); updateEditorLabels(); renderEditor(); refreshPreviews(); });
    $('clear-paint').addEventListener('click', () => { state.paintActions = []; checkpoint(); renderEditor(); refreshPreviews(); });
    $('clear-buckets').addEventListener('click', () => { state.bucketActions = []; checkpoint(); renderEditor(); refreshPreviews(); });
    $('clear-moving').addEventListener('click', () => { state.movingActions = []; checkpoint(); renderEditor(); refreshPreviews(); });
    $('reset-all-edits').addEventListener('click', () => { if (!window.confirm('Clear cutouts, fills, paint, animate-area regions and alignment edits?')) return; state.cutoutActions = []; state.cutoutInverted = false; state.paintActions = []; state.bucketActions = []; state.movingActions = []; state.animateAreaEnabled = false; state.baseFrameId = state.frames[0]?.id || null; state.frames.forEach((frame) => { frame.offsetX = 0; frame.offsetY = 0; }); checkpoint(); updateEditorLabels(); renderEditor(); renderFrameGrid(); refreshPreviews(); });
    $('undo-edit').addEventListener('click', undo); $('redo-edit').addEventListener('click', redo);
    function snapshot() { return JSON.stringify({ cutoutActions: state.cutoutActions, cutoutInverted: state.cutoutInverted, paintActions: state.paintActions, bucketActions: state.bucketActions, movingActions: state.movingActions, animateAreaEnabled: state.animateAreaEnabled, baseFrameId: state.baseFrameId, offsets: Object.fromEntries(state.frames.map((frame) => [frame.id, { x: frame.offsetX, y: frame.offsetY }])) }); }
    function checkpoint(reset = false) { const value = snapshot(); if (reset || !state.history.length) { state.history = [value]; state.historyIndex = 0; return; } if (state.history[state.historyIndex] === value) return; state.history = state.history.slice(0, state.historyIndex + 1); state.history.push(value); state.historyIndex = state.history.length - 1; }
    function restore(value) { const data = JSON.parse(value); state.cutoutActions = data.cutoutActions; state.cutoutInverted = data.cutoutInverted; state.paintActions = data.paintActions; state.bucketActions = data.bucketActions || []; state.movingActions = data.movingActions; state.animateAreaEnabled = data.animateAreaEnabled; state.baseFrameId = data.baseFrameId; state.frames.forEach((frame) => { if (data.offsets[frame.id]) { frame.offsetX = data.offsets[frame.id].x; frame.offsetY = data.offsets[frame.id].y; } }); updateEditorLabels(); renderEditor(); renderFrameGrid(); refreshPreviews(); }
    function undo() { if (state.historyIndex > 0) { state.historyIndex -= 1; restore(state.history[state.historyIndex]); } } function redo() { if (state.historyIndex < state.history.length - 1) { state.historyIndex += 1; restore(state.history[state.historyIndex]); } }

    async function renderEditor() { if (els.editorModal.hidden || !state.frames[state.editorIndex]) return; const token = ++edit.renderToken, dim = getDim(), image = edit.finalView ? await renderFrame(state.editorIndex, dim) : await drawOriginalFrame(state.editorIndex, dim); if (token !== edit.renderToken) return; els.editorCanvas.width = dim; els.editorCanvas.height = dim; const ctx = els.editorCanvas.getContext('2d'); ctx.clearRect(0, 0, dim, dim); ctx.drawImage(image, 0, 0); drawTransient(ctx, dim); fitCanvas(); }
    function drawTransient(ctx, dim) { const points = edit.tool === 'polygon' ? edit.polygonPoints : edit.points; if (!points.length || edit.tool === 'bucket') return; const converted = points.map((point) => ({ x: point.x * dim, y: point.y * dim })); ctx.save(); ctx.strokeStyle = '#75b2de'; ctx.fillStyle = 'rgba(117,178,222,.18)'; ctx.lineWidth = Math.max(1, dim / 300); ctx.setLineDash([7, 5]); if (edit.tool === 'brush') { ctx.setLineDash([]); ctx.lineWidth = Math.max(1, parseInt($('brush-size').value, 10)); ctx.lineCap = 'round'; } ctx.beginPath(); ctx.moveTo(converted[0].x, converted[0].y); if (edit.tool === 'rect' && converted.length > 1) ctx.rect(converted[0].x, converted[0].y, converted[1].x - converted[0].x, converted[1].y - converted[0].y); else converted.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); if (edit.tool !== 'brush' && (edit.tool !== 'lasso' || !edit.drawing)) { ctx.closePath(); ctx.fill(); } ctx.stroke(); ctx.restore(); }
    function fitCanvas() { const dim = getDim(), area = els.canvasViewport.getBoundingClientRect(), fit = Math.min((area.width - 32) / dim, (area.height - 32) / dim, 1), size = Math.max(40, dim * fit); els.editorCanvas.style.width = `${size}px`; els.editorCanvas.style.height = `${size}px`; els.editorCanvas.style.transform = `translate(${edit.panX}px,${edit.panY}px) scale(${edit.zoom})`; $('zoom-label').textContent = `${Math.round(edit.zoom * 100)}%`; }
    function resetViewport() { edit.zoom = 1; edit.panX = 0; edit.panY = 0; }
    $('zoom-in').addEventListener('click', () => { edit.zoom = clamp(edit.zoom + .25, .5, 5); fitCanvas(); }); $('zoom-out').addEventListener('click', () => { edit.zoom = clamp(edit.zoom - .25, .5, 5); fitCanvas(); }); $('zoom-fit').addEventListener('click', () => { resetViewport(); fitCanvas(); }); $('zoom-reset').addEventListener('click', () => { resetViewport(); fitCanvas(); }); window.addEventListener('resize', () => { if (!els.editorModal.hidden) fitCanvas(); });
    qsa('#preview-background button').forEach((button) => button.addEventListener('click', () => setPreviewBackground(button.dataset.previewBg)));
    function setPreviewBackground(value) { edit.previewBackground = value; els.canvasViewport.classList.remove('preview-bg-checker','preview-bg-black','preview-bg-white','preview-bg-green'); els.canvasViewport.classList.add(`preview-bg-${value}`); qsa('#preview-background button').forEach((button) => button.classList.toggle('active', button.dataset.previewBg === value)); }
    function pointFromEvent(event) { const rect = els.editorCanvas.getBoundingClientRect(); return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) }; }
    let panStart = null;
    els.editorCanvas.addEventListener('pointerdown', (event) => {
        if (edit.tool === 'pan') { panStart = { x: event.clientX - edit.panX, y: event.clientY - edit.panY }; els.editorCanvas.setPointerCapture(event.pointerId); return; }
        if (edit.tool === 'bucket') { const seed = pointFromEvent(event); state.bucketActions.push({ seed, mode: edit.bucketMode, color: $('brush-color').value, tolerance: parseInt($('bucket-tolerance').value, 10), feather: parseInt($('bucket-feather').value, 10) / getDim() }); checkpoint(); renderEditor(); refreshPreviews(); return; }
        if (edit.tool === 'polygon') { edit.polygonPoints.push(pointFromEvent(event)); $('finish-polygon').hidden = false; renderEditor(); return; }
        edit.drawing = true; edit.points = [pointFromEvent(event)]; els.editorCanvas.setPointerCapture(event.pointerId); renderEditor();
    });
    els.editorCanvas.addEventListener('pointermove', (event) => { if (panStart) { edit.panX = event.clientX - panStart.x; edit.panY = event.clientY - panStart.y; fitCanvas(); return; } if (!edit.drawing) return; const point = pointFromEvent(event); if (edit.tool === 'rect') edit.points[1] = point; else edit.points.push(point); renderEditor(); });
    els.editorCanvas.addEventListener('pointerup', (event) => { if (panStart) { panStart = null; return; } if (!edit.drawing) return; edit.drawing = false; if (edit.points.length === 1) edit.points.push(pointFromEvent(event)); commitAction(edit.points); edit.points = []; renderEditor(); });
    els.editorCanvas.addEventListener('dblclick', () => { if (edit.tool === 'polygon') commitPolygon(); }); $('finish-polygon').addEventListener('click', commitPolygon);
    function commitPolygon() { if (edit.polygonPoints.length < 3) return; commitAction(edit.polygonPoints); edit.polygonPoints = []; $('finish-polygon').hidden = true; renderEditor(); }
    function commitAction(points) { if (points.length < 2) return; const action = { tool: edit.tool, points: [...points], size: parseInt($('brush-size').value, 10) / getDim(), softness: parseInt($('brush-softness').value, 10) / 100 }; if (edit.target === 'moving') { action.mode = edit.movingMode; state.movingActions.push(action); } else if (edit.target === 'paint' && edit.paintMode === 'paint') { action.mode = 'paint'; action.color = $('brush-color').value; state.paintActions.push(action); } else { action.mode = edit.target === 'cutout' ? edit.maskMode : (edit.paintMode === 'erase' ? 'remove' : 'restore'); state.cutoutActions.push(action); } checkpoint(); refreshPreviews(); }

    qsa('[data-close]').forEach((button) => button.addEventListener('click', () => { const id = button.dataset.close; $(id).hidden = true; if (id === 'preview-modal') state.previewIndex = null; if (id === 'anim-preview-modal') closeAnimationPreview(); if (id === 'frame-editor-modal') { state.editorPlaying = false; clearInterval(state.editorTimer); $('editor-play').textContent = '▶ PLAY'; renderFrameGrid(); refreshPreviews(); } }));
    makeDraggable(els.previewModal, els.previewModal.querySelector('h3')); makeDraggable(els.animModal, els.animModal.querySelector('h3')); makeDraggable(els.alignModal, els.alignModal.querySelector('h3')); makeDraggable(els.reorderModal, $('reorder-clips-drag-handle')); makeDraggable(els.editorWindow, $('editor-drag-handle'));
    function makeDraggable(element, handle) { let active = false, dx = 0, dy = 0; if (!element || !handle) return; handle.addEventListener('pointerdown', (event) => { if (window.innerWidth <= 680 || event.target.closest('button')) return; active = true; const rect = element.getBoundingClientRect(); dx = event.clientX - rect.left; dy = event.clientY - rect.top; handle.setPointerCapture(event.pointerId); }); handle.addEventListener('pointermove', (event) => { if (!active) return; element.style.position = 'fixed'; element.style.left = `${event.clientX - dx}px`; element.style.top = `${event.clientY - dy}px`; element.style.right = 'auto'; element.style.transform = 'none'; }); handle.addEventListener('pointerup', () => { active = false; }); }

    els.zipBtn.addEventListener('click', async () => { if (!state.frames.length || typeof JSZip === 'undefined') return; els.zipBtn.disabled = true; els.zipBtn.textContent = 'PACKAGING FRAMES...'; try { const zip = new JSZip(), folder = zip.folder(`${safeName()}-frames`), digits = Math.max(3, String(state.frames.length).length); for (let index = 0; index < state.frames.length; index += 1) folder.file(`${safeName()}-frame-${String(index + 1).padStart(digits, '0')}.png`, await canvasToBlob(await renderFrame(index, getDim()))); downloadBlob(await zip.generateAsync({ type: 'blob' }), `${safeName()}-frames.zip`); setHubStatus('Processed PNG frames downloaded as ZIP.'); setTimeout(clearHubStatus, 4000); } catch (error) { setHubStatus(`Frame ZIP failed: ${error.message}`); } els.zipBtn.disabled = false; els.zipBtn.textContent = 'DOWNLOAD FRAMES ZIP'; });
    els.compileBtn.addEventListener('click', async () => { if (state.frames.length < 2) return; els.compileBtn.disabled = true; els.compileBtn.textContent = 'PROCESSING...'; els.outputCard.hidden = false; els.viewport.innerHTML = '<div class="loader"></div>'; try { const images = []; for (const index of outputIndices()) images.push((await renderFrame(index, getDim())).toDataURL('image/png')); const lossy = $('opt-lossy').value, sampleInterval = lossy === 'high' ? 30 : lossy === 'low' ? 20 : 10; gifshot.createGIF({ images, interval: parseInt($('frame-delay').value, 10) / 1000, gifWidth: getDim(), gifHeight: getDim(), sampleInterval, numWorkers: 2 }, (result) => { els.compileBtn.disabled = false; els.compileBtn.textContent = 'MAKE & SAVE ANIMATION'; if (result.error) { els.viewport.innerHTML = '<p class="help-text">ENGINE FAILURE: Unable to compile.</p>'; return; } els.viewport.innerHTML = `<img src="${result.image}" alt="Compiled animation">`; els.downloadAnchor.href = result.image; els.downloadAnchor.download = `${safeName()}.gif`; els.downloadAnchor.click(); }); } catch (error) { els.compileBtn.disabled = false; els.compileBtn.textContent = 'MAKE & SAVE ANIMATION'; els.viewport.innerHTML = `<p class="help-text">ERROR: ${error.message}</p>`; } });

    onFramesChanged();
})();
