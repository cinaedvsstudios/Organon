(() => {
  'use strict';
  if (!document.body.classList.contains('is-advanced-mode')) return;

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, host = document) => [...host.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const deepCopy = (value) => JSON.parse(JSON.stringify(value));
  const makeCanvas = (width, height = width) => { const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width)); canvas.height = Math.max(1, Math.round(height)); return canvas; };
  const text = new TextEncoder();

  const queueCard = $('queue-card');
  const frameGrid = $('frame-grid');
  const imagePicker = $('image-picker');
  const videoPicker = $('video-picker');
  const editorModal = $('frame-editor-modal');
  const editorWindow = $('editor-window');
  const editorHeader = editorWindow?.querySelector('.editor-header');
  const editorNav = editorWindow?.querySelector('.editor-nav');
  const editorTools = editorWindow?.querySelector('.editor-tools');
  const editorCanvas = $('frame-editor-canvas');
  const canvasViewport = $('canvas-viewport');
  const outputCard = $('output-card');
  const outputViewport = $('compiled-viewport');
  const openEditor = $('open-editor-btn');
  const compileBtn = $('compile-btn');
  const zipBtn = $('zip-btn');
  const previewBtn = $('btn-play-preview');
  const animationModal = $('anim-preview-modal');
  const animationImage = $('anim-modal-img');
  const animationLoading = $('anim-loading');
  const previewModal = $('preview-modal');
  const previewImage = $('modal-img');
  const alignModal = $('align-modal');
  const alignCanvas = $('align-canvas');
  const topPanel = $('top-panel');

  if (!queueCard || !frameGrid || !imagePicker || !editorModal || !editorWindow || !editorHeader || !editorNav || !editorTools || !editorCanvas || !canvasViewport || !outputCard || !outputViewport || !openEditor || !compileBtn || !zipBtn || !previewBtn || !animationModal || !animationImage || !animationLoading || !previewModal || !previewImage || !alignModal || !alignCanvas || !topPanel) return;

  const blendModes = [
    ['source-over', 'Normal'], ['darken', 'Darken'], ['multiply', 'Multiply'], ['color-burn', 'Color Burn'],
    ['lighten', 'Lighten'], ['screen', 'Screen'], ['color-dodge', 'Color Dodge'], ['overlay', 'Overlay'],
    ['soft-light', 'Soft Light'], ['hard-light', 'Hard Light'], ['difference', 'Difference'], ['exclusion', 'Exclusion'],
    ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity']
  ];
  const animationNames = {
    'pulse-brightness': 'Pulse Brightness', 'pulse-size': 'Pulse Size', rotate: 'Rotate', 'hue-shift': 'Hue Shift',
    'opacity-pulse': 'Opacity Pulse', float: 'Float Bob', shake: 'Shake Jitter', breathing: 'Breathing', 'motion-trail': 'Motion Trail'
  };
  const fxKeys = ['brightness', 'contrast', 'exposure', 'hue', 'saturation', 'temperature', 'tint', 'opacity', 'blur', 'sharpen', 'grayscale', 'sepia', 'invert'];
  const defaultEffects = () => ({ brightness: 100, contrast: 100, exposure: 0, hue: 0, saturation: 100, temperature: 0, tint: 0, opacity: 100, blur: 0, sharpen: 0, grayscale: 0, sepia: 0, invert: 0 });

  const state = {
    groups: [], activeGroupId: null, activeFrameId: null, editorMode: 'edit', editorView: 'final', editorIndex: 0,
    effectsDraft: defaultEffects(), effectTargets: new Set(), animationTargets: new Set(), selectionEnabled: true,
    selection: { active: false, x: 0, y: 0, w: 0, h: 0, drawing: false, mode: 'create', startX: 0, startY: 0, lastX: 0, lastY: 0 },
    paint: { tool: 'brush', drawing: false, buffer: null, last: null }, transform: null, zoom: 1, panX: 0, panY: 0,
    grid: false, gridScale: 1, previewTimer: null, previewToken: 0, align: null, imageCache: new Map(), renderToken: 0
  };

  const notify = (message) => {
    try { window.parent.postMessage({ type: 'set-status', text: message }, '*'); } catch (error) {}
    window.setTimeout(() => { try { window.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {} }, 3600);
  };

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const getDimension = () => Number($('max-dimension')?.value || 480);
  const safeName = () => (($('seq-name')?.value || 'animation-export').trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-') || 'animation-export');

  function activeGroup() { return state.groups.find((group) => group.id === state.activeGroupId) || state.groups[0] || null; }
  function activeFrame(group = activeGroup()) { return group?.frames.find((frame) => frame.id === state.activeFrameId) || group?.frames[0] || null; }
  function totalFrames() { return state.groups.reduce((count, group) => count + group.frames.length, 0); }
  function getGroup(id) { return state.groups.find((group) => group.id === id) || null; }

  function keepVisible(element) {
    if (!element) return;
    element.hidden = false;
    element.removeAttribute('hidden');
    if (element.dataset.groupVisible) return;
    new MutationObserver(() => { element.hidden = false; element.removeAttribute('hidden'); }).observe(element, { attributes: true, attributeFilter: ['hidden'] });
    element.dataset.groupVisible = 'true';
  }

  function createGroup(name, options = {}) {
    const group = {
      id: uid('group'), name: name || `Group ${state.groups.length + 1}`, layer: options.layer || state.groups.length + 1,
      blend: options.blend || 'source-over', effects: deepCopy(options.effects || defaultEffects()), frames: options.frames || []
    };
    state.groups.push(group);
    state.activeGroupId = group.id;
    state.activeFrameId = group.frames[0]?.id || null;
    normalizeLayers();
    return group;
  }

  function normalizeLayers() {
    state.groups.sort((a, b) => a.layer - b.layer || a.name.localeCompare(b.name));
    state.groups.forEach((group, index) => { group.layer = index + 1; });
  }

  function setActive(groupId, frameId = null) {
    const group = getGroup(groupId);
    if (!group) return;
    state.activeGroupId = group.id;
    state.activeFrameId = frameId || group.frames.find((frame) => frame.id === state.activeFrameId)?.id || group.frames[0]?.id || null;
    state.editorIndex = Math.max(0, group.frames.findIndex((frame) => frame.id === state.activeFrameId));
    state.effectTargets.add(group.id);
    state.animationTargets.add(group.id);
    state.effectsDraft = deepCopy(group.effects);
    renderAll();
  }

  function setLayer(groupId, wanted) {
    const group = getGroup(groupId);
    if (!group) return;
    const ordered = [...state.groups].sort((a, b) => a.layer - b.layer);
    const from = ordered.indexOf(group);
    const to = clamp(Number(wanted) - 1, 0, ordered.length - 1);
    ordered.splice(from, 1);
    ordered.splice(to, 0, group);
    ordered.forEach((entry, index) => { entry.layer = index + 1; });
    renderAll();
  }

  function removeGroup(groupId) {
    const group = getGroup(groupId);
    if (!group) return;
    if (state.groups.length === 1) {
      group.frames = [];
      state.activeFrameId = null;
      renderAll();
      return;
    }
    state.groups = state.groups.filter((entry) => entry.id !== groupId);
    state.effectTargets.delete(groupId);
    state.animationTargets.delete(groupId);
    normalizeLayers();
    state.activeGroupId = state.groups[0]?.id || null;
    state.activeFrameId = activeGroup()?.frames[0]?.id || null;
    renderAll();
  }

  function removeFrame(groupId, frameId) {
    const group = getGroup(groupId);
    if (!group) return;
    group.frames = group.frames.filter((frame) => frame.id !== frameId);
    if (state.activeFrameId === frameId) state.activeFrameId = group.frames[0]?.id || null;
    renderAll();
  }

  function createFrame(name, src, image) {
    return { id: uid('frame'), name, base64: src, w: image.naturalWidth || image.width, h: image.naturalHeight || image.height, offsetX: 0, offsetY: 0 };
  }

  function loadImage(src) {
    if (state.imageCache.has(src)) return state.imageCache.get(src);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to load the image frame.'));
      image.src = src;
    });
    state.imageCache.set(src, promise);
    return promise;
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  async function filesToFrames(files) {
    const usable = [...files].filter((file) => file.type.startsWith('image/'));
    const output = [];
    for (const file of usable) {
      const src = await readFile(file);
      const image = await loadImage(src);
      output.push(createFrame(file.name, src, image));
    }
    return output;
  }

  async function importImages(files, targetId = state.activeGroupId) {
    const valid = [...files].filter((file) => file.type.startsWith('image/'));
    if (!valid.length) return notify('No image files were found.');
    let group = getGroup(targetId);
    if (!group) group = createGroup('Group 1');
    notify(`Importing ${valid.length} image${valid.length === 1 ? '' : 's'} into ${group.name}...`);
    const frames = await filesToFrames(valid);
    group.frames.push(...frames);
    state.activeGroupId = group.id;
    state.activeFrameId = frames[0]?.id || state.activeFrameId;
    state.editorIndex = Math.max(0, group.frames.findIndex((frame) => frame.id === state.activeFrameId));
    if (totalFrames() === frames.length && $('seq-name')) $('seq-name').value = valid[0].name.replace(/\.[^/.]+$/, '') || 'animation-export';
    state.effectTargets.add(group.id);
    state.animationTargets.add(group.id);
    notify(`${frames.length} frame${frames.length === 1 ? '' : 's'} added to ${group.name}.`);
    renderAll();
  }

  async function importVideo(file) {
    if (!file) return;
    let group = activeGroup();
    if (!group) group = createGroup('Group 1');
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    try {
      await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; video.load(); });
      const fps = 12;
      const count = Math.max(1, Math.floor(video.duration * fps));
      const canvas = makeCanvas(video.videoWidth, video.videoHeight);
      const context = canvas.getContext('2d');
      notify(`Extracting ${count} frames into ${group.name}...`);
      const frames = [];
      for (let index = 0; index < count; index += 1) {
        await new Promise((resolve) => { video.onseeked = resolve; video.currentTime = Math.min(index / fps, video.duration || index / fps); });
        context.drawImage(video, 0, 0);
        const src = canvas.toDataURL('image/jpeg', .9);
        frames.push({ id: uid('frame'), name: `${file.name} ${index + 1}`, base64: src, w: canvas.width, h: canvas.height, offsetX: 0, offsetY: 0 });
      }
      group.frames.push(...frames);
      state.activeFrameId = frames[0]?.id || state.activeFrameId;
      renderAll();
      notify(`${frames.length} video frames added to ${group.name}.`);
    } catch (error) {
      notify('Video extraction failed.');
    } finally {
      URL.revokeObjectURL(url);
      video.remove();
    }
  }

  function ensureQueueUi() {
    keepVisible(queueCard);
    const heading = queueCard.querySelector('h3');
    if (heading) heading.textContent = '1. Frames & Groups';
    if (!$('ag-group-toolbar')) {
      const toolbar = document.createElement('div');
      toolbar.id = 'ag-group-toolbar';
      toolbar.className = 'ag-group-toolbar';
      toolbar.innerHTML = '<button type="button" class="mini-action ag-create-group" id="ag-create-group">CREATE NEW GROUP</button><label>IMPORT INTO <select id="ag-import-group"></select></label><button type="button" class="mini-action" id="ag-paste-group">PASTE FROM CLIPBOARD</button><span class="ag-group-status" id="ag-group-status">GROUP 1 READY</span>';
      queueCard.querySelector('.input-group.inline-input')?.insertAdjacentElement('afterend', toolbar);
      $('ag-create-group').addEventListener('click', () => { const group = createGroup(); state.effectTargets = new Set([group.id]); state.animationTargets = new Set([group.id]); notify(`${group.name} created.`); renderAll(); });
      $('ag-import-group').addEventListener('change', (event) => setActive(event.target.value));
      $('ag-paste-group').addEventListener('click', pasteFromClipboard);
    }
    frameGrid.classList.add('ag-groups-grid');
  }

  function ensureEditorUi() {
    let card = $('advanced-editor-card');
    if (!card) {
      card = document.createElement('section');
      card.id = 'advanced-editor-card';
      card.className = 'config-card advanced-editor-card';
      card.innerHTML = '<div class="advanced-card-heading"><h3>2. Frame Editor</h3></div><div class="advanced-inline-editor-host"></div>';
      queueCard.insertAdjacentElement('afterend', card);
    }
    const host = card.querySelector('.advanced-inline-editor-host');
    if (host && !host.contains(editorWindow)) host.appendChild(editorWindow);
    editorModal.hidden = false;
    editorModal.classList.add('advanced-inline-editor');
    editorWindow.querySelector('.editor-close')?.setAttribute('hidden', '');
    editorWindow.querySelector('.editor-footer [data-close="frame-editor-modal"]')?.setAttribute('hidden', '');

    if (!$('ag-editor-menu')) {
      const menu = document.createElement('div');
      menu.id = 'ag-editor-menu';
      menu.className = 'advanced-editor-menu';
      menu.innerHTML = '<button type="button" class="active" data-ag-mode="edit">EDIT</button><button type="button" data-ag-mode="paint">PAINT</button><button type="button" data-ag-mode="select">SELECT</button><button type="button" data-ag-mode="effects">EFFECTS</button><button type="button" data-ag-mode="animations">ANIMATIONS</button>';
      editorHeader.querySelector('h2')?.insertAdjacentElement('afterend', menu);
      menu.addEventListener('click', (event) => { const mode = event.target.closest('[data-ag-mode]')?.dataset.agMode; if (mode) setEditorMode(mode); });
    }

    if (!$('ag-editor-actions')) {
      const actions = document.createElement('div');
      actions.id = 'ag-editor-actions';
      actions.className = 'ag-editor-actions';
      actions.innerHTML = '<button type="button" id="ag-paste-into">PASTE INTO FRAME</button><button type="button" id="ag-paste-new">PASTE AS NEW FRAME</button><button type="button" id="ag-copy">COPY</button><button type="button" id="ag-clear">CLEAR</button><button type="button" id="ag-scale">SCALE</button><button type="button" id="ag-rotate">ROTATE</button><button type="button" id="ag-realign">REALIGN</button>';
      editorNav.appendChild(actions);
      $('ag-paste-into').addEventListener('click', pasteIntoFrame);
      $('ag-paste-new').addEventListener('click', pasteAsNewFrame);
      $('ag-copy').addEventListener('click', copyCurrentFrame);
      $('ag-clear').addEventListener('click', clearCurrentFrame);
      $('ag-scale').addEventListener('click', () => openTransform('scale'));
      $('ag-rotate').addEventListener('click', () => openTransform('rotate'));
      $('ag-realign').addEventListener('click', () => { const frame = activeFrame(); if (!frame) return; frame.offsetX = 0; frame.offsetY = 0; renderAll(); notify('Current frame realigned.'); });
    }

    if (!$('ag-transform-panel')) {
      const panel = document.createElement('div');
      panel.id = 'ag-transform-panel';
      panel.className = 'ag-transform-panel';
      panel.hidden = true;
      panel.innerHTML = '<span id="ag-transform-title">TRANSFORM</span><input type="range" id="ag-transform-slider"><b id="ag-transform-value">0</b><button type="button" id="ag-transform-apply">APPLY</button><button type="button" id="ag-transform-cancel">CANCEL</button>';
      editorNav.insertAdjacentElement('afterend', panel);
      $('ag-transform-slider').addEventListener('input', previewTransform);
      $('ag-transform-apply').addEventListener('click', () => closeTransform(true));
      $('ag-transform-cancel').addEventListener('click', () => closeTransform(false));
    }

    if (!$('ag-select-panel')) {
      const panel = document.createElement('div');
      panel.id = 'ag-select-panel';
      panel.className = 'tool-group ag-mode-panel ag-select-panel';
      panel.hidden = true;
      panel.innerHTML = '<h4>Selection</h4><button type="button" id="ag-selection-toggle">DRAW / MOVE SELECTION</button><button type="button" id="ag-selection-clear">CLEAR SELECTION</button><p class="tool-tip-text">Selection remains active for copy, paste, clear, scale and rotate.</p>';
      editorTools.appendChild(panel);
      $('ag-selection-toggle').addEventListener('click', () => { state.selectionEnabled = !state.selectionEnabled; updateSelectionControls(); });
      $('ag-selection-clear').addEventListener('click', () => { state.selection.active = false; updateSelectionOverlay(); });
    }

    if (!$('ag-effects-panel')) {
      const panel = document.createElement('div');
      panel.id = 'ag-effects-panel';
      panel.className = 'tool-group ag-mode-panel';
      panel.hidden = true;
      panel.innerHTML = '<h4>Group Effects</h4>' + effectControlsMarkup() + '<div class="ag-target-list" id="ag-effects-targets"></div><button type="button" class="ag-apply-btn" id="ag-apply-effects">APPLY EFFECT TO SELECTED GROUPS</button><button type="button" id="ag-reset-effects">RESET DRAFT</button>';
      editorTools.appendChild(panel);
      fxKeys.forEach((key) => { $(`ag-fx-${key}`).addEventListener('input', (event) => { state.effectsDraft[key] = Number(event.target.value); $(`ag-fx-${key}-value`).textContent = fxValue(key, state.effectsDraft[key]); renderEditor(); }); });
      $('ag-apply-effects').addEventListener('click', applyGroupEffects);
      $('ag-reset-effects').addEventListener('click', () => { state.effectsDraft = defaultEffects(); renderEffectsControls(); renderEditor(); });
    }

    if (!$('ag-animation-panel')) {
      const panel = document.createElement('div');
      panel.id = 'ag-animation-panel';
      panel.className = 'tool-group ag-mode-panel';
      panel.hidden = true;
      panel.innerHTML = '<h4>Generate Animation</h4><label class="compact-control"><span>Animation Type</span><select id="ag-animation-type"><option value="pulse-brightness">Pulse Brightness</option><option value="pulse-size">Pulse Size</option><option value="rotate">Rotate</option><option value="hue-shift">Hue Shift</option><option value="opacity-pulse">Opacity Pulse</option><option value="float">Float / Bob</option><option value="shake">Shake / Jitter</option><option value="breathing">Breathing</option><option value="motion-trail">Motion Trail</option><option value="overlay-layer" disabled>Overlay Layer — Coming Next</option></select></label><label class="compact-control"><span>Strength <b id="ag-animation-strength-value">5</b></span><input type="range" id="ag-animation-strength" min="1" max="10" value="5"></label><label class="compact-control"><span>Direction</span><select id="ag-animation-direction"><option value="forward">Forward</option><option value="reverse">Reverse</option><option value="clockwise">Clockwise</option><option value="counterclockwise">Counter-clockwise</option></select></label><label class="compact-control"><span>Duration <b id="ag-animation-duration-value">8 frames</b></span><input type="range" id="ag-animation-duration" min="1" max="20" value="8"></label><div class="ag-placeholder">OVERLAY LAYER is shown here as the reserved group-to-group animation pass. It is intentionally disabled until that dedicated layer workflow is built.</div><div class="ag-target-list" id="ag-animation-targets"></div><button type="button" class="ag-apply-btn" id="ag-generate-animation">GENERATE NEW FRAMES</button><p class="tool-tip-text">The source frame moves with its generated frames into a new group unless it is the only image in the workspace.</p>';
      editorTools.appendChild(panel);
      $('ag-animation-strength').addEventListener('input', (event) => { $('ag-animation-strength-value').textContent = event.target.value; });
      $('ag-animation-duration').addEventListener('input', (event) => { $('ag-animation-duration-value').textContent = `${event.target.value} frames`; });
      $('ag-generate-animation').addEventListener('click', generateAnimation);
    }

    if (!$('ag-selection-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'ag-selection-overlay';
      overlay.hidden = true;
      canvasViewport.appendChild(overlay);
    }
  }

  function effectControlsMarkup() {
    const fields = [
      ['brightness', 'Brightness', 0, 200, 100], ['contrast', 'Contrast', 0, 200, 100], ['exposure', 'Exposure', -100, 100, 0], ['hue', 'Hue', -180, 180, 0],
      ['saturation', 'Saturation', 0, 200, 100], ['temperature', 'Temperature', -100, 100, 0], ['tint', 'Tint', -100, 100, 0], ['opacity', 'Opacity', 0, 100, 100],
      ['blur', 'Blur', 0, 20, 0], ['sharpen', 'Sharpen', 0, 10, 0], ['grayscale', 'Grayscale', 0, 100, 0], ['sepia', 'Sepia', 0, 100, 0], ['invert', 'Invert', 0, 100, 0]
    ];
    return fields.map(([key, label, min, max, value]) => `<div class="ag-control-row"><label>${label}<output id="ag-fx-${key}-value">${fxValue(key, value)}</output></label><input id="ag-fx-${key}" type="range" min="${min}" max="${max}" value="${value}"></div>`).join('');
  }

  function fxValue(key, value) {
    if (['brightness', 'contrast', 'saturation', 'opacity', 'grayscale', 'sepia', 'invert'].includes(key)) return `${value}%`;
    if (key === 'hue') return `${value}°`;
    if (key === 'blur') return `${value} px`;
    return String(value);
  }

  function setupOutputEffects() {
    let card = $('animation-effects-card');
    if (!card) {
      card = document.createElement('section');
      card.id = 'animation-effects-card';
      card.className = 'config-card';
      card.innerHTML = '<h3>4. Animation Effects</h3><div class="ag-output-effects"><div class="ag-effects-grid"><label class="compact-control"><span>In-Between Frames</span><select id="ag-final-inbetweens"><option value="0">Off</option><option value="1">1 Blend</option><option value="2">2 Blends</option><option value="3">3 Blends</option></select></label><label class="compact-control"><span>Loop Blend <b id="ag-final-loop-value">0</b></span><input id="ag-final-loop" type="range" min="0" max="10" value="0"></label><label class="compact-control"><span>Hold First <b id="ag-final-first-value">0</b></span><input id="ag-final-first" type="range" min="0" max="20" value="0"></label><label class="compact-control"><span>Hold Last <b id="ag-final-last-value">0</b></span><input id="ag-final-last" type="range" min="0" max="20" value="0"></label><label class="compact-control"><span>Speed Curve</span><select id="ag-final-speed"><option value="linear">Linear</option><option value="ease-in">Ease In</option><option value="ease-out">Ease Out</option><option value="ease-in-out">Ease In / Out</option></select></label><label class="compact-control"><span>Opacity Pulse <b id="ag-final-pulse-value">0</b></span><input id="ag-final-pulse" type="range" min="0" max="10" value="0"></label><label class="compact-control"><span>Shake / Jitter <b id="ag-final-shake-value">0</b></span><input id="ag-final-shake" type="range" min="0" max="10" value="0"></label><label class="compact-control"><span>Float / Bob <b id="ag-final-bob-value">0</b></span><input id="ag-final-bob" type="range" min="0" max="20" value="0"></label><label class="compact-control"><span>Motion Trail <b id="ag-final-trail-value">0</b></span><input id="ag-final-trail" type="range" min="0" max="10" value="0"></label><label class="compact-control"><span>Strobe <b id="ag-final-strobe-value">0</b></span><input id="ag-final-strobe" type="range" min="0" max="10" value="0"></label></div><label class="checkbox-container"><input type="checkbox" id="ag-final-fade-in"><span class="checkmark"></span><span>Fade In</span></label><label class="checkbox-container"><input type="checkbox" id="ag-final-fade-out"><span class="checkmark"></span><span>Fade Out</span></label><label class="compact-control"><span>Fade Level <b id="ag-final-fade-value">3</b></span><input id="ag-final-fade" type="range" min="1" max="20" value="3"></label></div>';
      $('adjust-card')?.insertAdjacentElement('afterend', card);
    }
    const headings = { 'queue-card': '1. Frames & Groups', 'adjust-card': '3. Visual Adjustments', 'animation-effects-card': '4. Animation Effects', 'settings-card': '5. Animation Settings', 'advanced-webp-card': '6. WebP Advanced Settings', 'output-card': '7. Synthesized Core Output' };
    Object.entries(headings).forEach(([id, title]) => { const heading = $(id)?.querySelector('h3'); if (heading) heading.textContent = title; });
    ['loop', 'first', 'last', 'pulse', 'shake', 'bob', 'trail', 'strobe', 'fade'].forEach((key) => { $(`ag-final-${key}`)?.addEventListener('input', () => { const target = $(`ag-final-${key}-value`); if (target) target.textContent = $(`ag-final-${key}`).value; }); });
  }

  function renderGroupSelect() {
    const select = $('ag-import-group');
    if (!select) return;
    select.innerHTML = state.groups.map((group) => `<option value="${group.id}" ${group.id === state.activeGroupId ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('');
    const status = $('ag-group-status');
    const group = activeGroup();
    if (status) status.textContent = group ? `ACTIVE: ${group.name.toUpperCase()} · LAYER ${group.layer}` : 'NO GROUP SELECTED';
  }

  function renderGroupFrames() {
    frameGrid.innerHTML = '';
    normalizeLayers();
    state.groups.forEach((group) => {
      const section = document.createElement('section');
      section.className = `ag-group ${group.id === state.activeGroupId ? 'ag-active' : ''}`;
      section.dataset.groupId = group.id;
      const layers = Array.from({ length: state.groups.length }, (_, index) => `<option value="${index + 1}" ${group.layer === index + 1 ? 'selected' : ''}>LAYER ${index + 1}${index === 0 ? ' — TOP' : ''}</option>`).join('');
      const blends = blendModes.map(([value, label]) => `<option value="${value}" ${group.blend === value ? 'selected' : ''}>${label}</option>`).join('');
      section.innerHTML = `<header class="ag-group-header"><button type="button" class="ag-group-select" data-ag-select="${group.id}">${group.id === state.activeGroupId ? '●' : '○'}</button><input class="ag-group-name" data-ag-name="${group.id}" value="${escapeHtml(group.name)}" aria-label="Group name"><span class="ag-group-count">${group.frames.length} FRAME${group.frames.length === 1 ? '' : 'S'}</span><select class="ag-group-pill" data-ag-blend="${group.id}" title="Blend Mode">${blends}</select><select class="ag-group-pill" data-ag-layer="${group.id}" title="Layer">${layers}</select><button type="button" class="mini-action danger-mini" data-ag-remove-group="${group.id}">REMOVE</button></header><div class="ag-group-frames"></div>`;
      const row = section.querySelector('.ag-group-frames');
      if (!group.frames.length) row.innerHTML = '<div class="ag-empty-group">DROP OR IMPORT IMAGE FILES INTO THIS GROUP</div>';
      group.frames.forEach((frame, index) => {
        const item = document.createElement('div');
        item.className = `frame-thumb-wrapper ${frame.id === state.activeFrameId && group.id === state.activeGroupId ? 'ag-frame-selected' : ''}`;
        item.draggable = true;
        item.dataset.groupId = group.id;
        item.dataset.frameId = frame.id;
        item.innerHTML = `<img src="${frame.base64}" alt="${escapeHtml(frame.name)}"><span class="frame-index-badge">${index + 1}</span>${frame.offsetX || frame.offsetY ? `<span class="frame-badge-offset">${frame.offsetX},${frame.offsetY}</span>` : ''}`;
        const makeButton = (className, label, title, callback) => { const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = label; button.title = title; button.addEventListener('click', (event) => { event.stopPropagation(); callback(); }); return button; };
        item.append(makeButton('thumb-btn frame-preview-btn', '👁', 'Preview group frame', () => openFramePreview(group.id, frame.id)), makeButton('thumb-btn frame-align-btn', '⊕', 'Align this frame', () => openAlignment(group.id, frame.id)), makeButton('thumb-btn frame-delete-btn', '×', 'Delete frame', () => removeFrame(group.id, frame.id)));
        item.addEventListener('click', () => setActive(group.id, frame.id));
        item.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/plain', JSON.stringify({ groupId: group.id, frameId: frame.id })); item.classList.add('dragging'); });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));
        item.addEventListener('dragover', (event) => { event.preventDefault(); item.classList.add('drag-over-right'); });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over-right'));
        item.addEventListener('drop', (event) => { event.preventDefault(); item.classList.remove('drag-over-right'); try { const data = JSON.parse(event.dataTransfer.getData('text/plain')); if (data.groupId !== group.id || data.frameId === frame.id) return; const moving = group.frames.find((entry) => entry.id === data.frameId); const from = group.frames.indexOf(moving); const to = group.frames.indexOf(frame); group.frames.splice(from, 1); group.frames.splice(from < to ? to : to + 1, 0, moving); renderAll(); } catch (error) {} });
        row.appendChild(item);
      });
      frameGrid.appendChild(section);
    });
    $$('[data-ag-select]').forEach((button) => button.addEventListener('click', () => setActive(button.dataset.agSelect)));
    $$('[data-ag-name]').forEach((input) => input.addEventListener('change', () => { const group = getGroup(input.dataset.agName); if (group) { group.name = input.value.trim() || group.name; renderAll(); } }));
    $$('[data-ag-blend]').forEach((select) => select.addEventListener('change', () => { const group = getGroup(select.dataset.agBlend); if (group) { group.blend = select.value; renderEditor(); notify(`${group.name} blend mode updated.`); } }));
    $$('[data-ag-layer]').forEach((select) => select.addEventListener('change', () => setLayer(select.dataset.agLayer, select.value)));
    $$('[data-ag-remove-group]').forEach((button) => button.addEventListener('click', () => removeGroup(button.dataset.agRemoveGroup)));
  }

  function renderEffectsControls() {
    const group = activeGroup();
    if (!group) return;
    fxKeys.forEach((key) => { const input = $(`ag-fx-${key}`); const output = $(`ag-fx-${key}-value`); if (input && output) { input.value = state.effectsDraft[key]; output.textContent = fxValue(key, state.effectsDraft[key]); } });
    renderTargetList('ag-effects-targets', state.effectTargets);
  }

  function renderTargetList(id, targetSet) {
    const host = $(id);
    if (!host) return;
    targetSet.add(state.activeGroupId);
    host.innerHTML = state.groups.map((group) => `<label><input type="checkbox" value="${group.id}" ${targetSet.has(group.id) ? 'checked' : ''}><span>${escapeHtml(group.name)}${group.id === state.activeGroupId ? ' — Current Group' : ''}</span></label>`).join('');
    $$('input', host).forEach((input) => input.addEventListener('change', () => { if (input.checked) targetSet.add(input.value); else if (input.value !== state.activeGroupId) targetSet.delete(input.value); else input.checked = true; }));
  }

  function updateSelectionControls() {
    const button = $('ag-selection-toggle');
    if (!button) return;
    button.classList.toggle('active-toggle', state.selectionEnabled);
    button.textContent = state.selectionEnabled ? 'DRAW / MOVE SELECTION' : 'SELECTION OFF';
  }

  function setEditorMode(mode) {
    state.editorMode = mode;
    if (mode === 'paint' || mode === 'select' || mode === 'edit') state.editorView = 'original';
    if (mode === 'effects') { state.effectsDraft = deepCopy(activeGroup()?.effects || defaultEffects()); renderEffectsControls(); }
    if (mode === 'animations') renderTargetList('ag-animation-targets', state.animationTargets);
    $$('[data-ag-mode]').forEach((button) => button.classList.toggle('active', button.dataset.agMode === mode));
    const nativeGroups = [...editorTools.querySelectorAll(':scope > .tool-group')].filter((entry) => !entry.classList.contains('ag-mode-panel'));
    nativeGroups.forEach((entry) => { entry.hidden = true; });
    $('ag-select-panel').hidden = mode !== 'select';
    $('ag-effects-panel').hidden = mode !== 'effects';
    $('ag-animation-panel').hidden = mode !== 'animations';
    $('ag-editor-actions').hidden = mode !== 'edit';
    if (mode === 'paint') {
      const paintGroup = $('paint-panel');
      if (paintGroup) paintGroup.hidden = false;
      const toolGroup = $('tool-grid')?.closest('.tool-group');
      if (toolGroup) toolGroup.hidden = false;
      $$('#tool-grid [data-tool]').forEach((button) => { button.hidden = !['brush', 'bucket'].includes(button.dataset.tool); button.classList.toggle('active', button.dataset.tool === state.paint.tool); });
    }
    if (mode === 'select') updateSelectionControls();
    renderEditor();
  }

  function activeFramePosition(group = activeGroup()) { return Math.max(0, group?.frames.findIndex((frame) => frame.id === state.activeFrameId) ?? 0); }
  function switchEditorFrame(step) { const group = activeGroup(); if (!group?.frames.length) return; const next = (activeFramePosition(group) + step + group.frames.length) % group.frames.length; state.activeFrameId = group.frames[next].id; state.editorIndex = next; renderAll(); }

  async function frameCanvas(frame, group, dim, effects = group.effects, includeGlobal = true) {
    const output = makeCanvas(dim);
    const context = output.getContext('2d', { willReadFrequently: true });
    const image = await loadImage(frame.base64);
    let width = image.naturalWidth || image.width;
    let height = image.naturalHeight || image.height;
    const scale = Math.min(dim / width, dim / height, 1);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    const global = includeGlobal ? readGlobalAdjustments() : { brightness: 100, contrast: 100, exposure: 100, saturation: 100, transparent: false, shadow: false };
    const exposure = Math.pow(2, Number(effects.exposure || 0) / 100);
    context.save();
    context.filter = `brightness(${global.brightness / 100}) brightness(${global.exposure / 100}) brightness(${effects.brightness / 100 * exposure}) contrast(${global.contrast / 100}) contrast(${effects.contrast / 100}) saturate(${global.saturation / 100}) saturate(${effects.saturation / 100}) hue-rotate(${effects.hue}deg) blur(${effects.blur}px) grayscale(${effects.grayscale / 100}) sepia(${effects.sepia / 100}) invert(${effects.invert / 100})`;
    context.globalAlpha = effects.opacity / 100;
    context.drawImage(image, (dim - width) / 2 + (frame.offsetX || 0), (dim - height) / 2 + (frame.offsetY || 0), width, height);
    context.restore();
    applyToneOverlay(output, effects);
    if (global.transparent) applyChroma(output, $('adj-color')?.value || '#ffffff', Number($('adj-tol')?.value || 20), Number($('adj-smooth')?.value || 15));
    if (effects.sharpen > 0) applySharpen(output, effects.sharpen);
    return global.shadow ? applyShadow(output, global) : output;
  }

  function readGlobalAdjustments() {
    return {
      brightness: Number($('adj-bright')?.value || 100), contrast: Number($('adj-contrast')?.value || 100), exposure: Number($('adj-exp')?.value || 100), saturation: Number($('adj-sat')?.value || 100),
      transparent: Boolean($('chk-transparent')?.checked), shadow: Boolean($('chk-shadow')?.checked), shadowColor: $('shadow-color')?.value || '#000000', shadowOpacity: Number($('shadow-opacity')?.value || 35), shadowBlur: Number($('shadow-blur')?.value || 10), shadowX: Number($('shadow-x')?.value || 0), shadowY: Number($('shadow-y')?.value || 5)
    };
  }

  function hexRgb(hex) { const number = parseInt(String(hex).replace('#', ''), 16); return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 }; }
  function applyToneOverlay(canvas, effects) {
    if (!effects.temperature && !effects.tint) return;
    const context = canvas.getContext('2d');
    context.save();
    context.globalCompositeOperation = 'source-atop';
    if (effects.temperature) { context.fillStyle = effects.temperature > 0 ? `rgba(255,120,35,${Math.abs(effects.temperature) / 420})` : `rgba(35,150,255,${Math.abs(effects.temperature) / 420})`; context.fillRect(0, 0, canvas.width, canvas.height); }
    if (effects.tint) { context.fillStyle = effects.tint > 0 ? `rgba(255,35,175,${Math.abs(effects.tint) / 500})` : `rgba(35,255,145,${Math.abs(effects.tint) / 500})`; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.restore();
  }

  function applyChroma(canvas, hex, tolerance, smooth) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const target = hexRgb(hex);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < image.data.length; index += 4) {
      if (!image.data[index + 3]) continue;
      const distance = Math.hypot(image.data[index] - target.r, image.data[index + 1] - target.g, image.data[index + 2] - target.b);
      if (distance <= tolerance) image.data[index + 3] = 0;
      else if (smooth && distance <= tolerance + smooth) image.data[index + 3] = Math.round(image.data[index + 3] * (distance - tolerance) / smooth);
    }
    context.putImageData(image, 0, 0);
  }

  function applySharpen(canvas, amount) {
    if (canvas.width * canvas.height > 1200000) return;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const source = new Uint8ClampedArray(image.data);
    const factor = amount / 10;
    for (let y = 1; y < canvas.height - 1; y += 1) for (let x = 1; x < canvas.width - 1; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) image.data[offset + channel] = clamp(source[offset + channel] * (1 + 4 * factor) - factor * (source[offset - 4 + channel] + source[offset + 4 + channel] + source[offset - canvas.width * 4 + channel] + source[offset + canvas.width * 4 + channel]), 0, 255);
    }
    context.putImageData(image, 0, 0);
  }

  function applyShadow(source, global) {
    const output = makeCanvas(source.width, source.height);
    const context = output.getContext('2d');
    context.save();
    context.globalAlpha = global.shadowOpacity / 100;
    context.shadowColor = global.shadowColor;
    context.shadowBlur = global.shadowBlur;
    context.shadowOffsetX = global.shadowX;
    context.shadowOffsetY = global.shadowY;
    context.drawImage(source, 0, 0);
    context.restore();
    context.drawImage(source, 0, 0);
    return output;
  }

  async function compositeFrame(index, dim = getDimension()) {
    const groups = [...state.groups].filter((group) => group.frames.length).sort((a, b) => b.layer - a.layer);
    if (!groups.length) return null;
    const output = makeCanvas(dim);
    const context = output.getContext('2d');
    for (const group of groups) {
      const frame = group.frames[index % group.frames.length];
      const layer = await frameCanvas(frame, group, dim);
      context.save();
      context.globalCompositeOperation = group.blend;
      context.drawImage(layer, 0, 0);
      context.restore();
    }
    return output;
  }

  function finalEffects() {
    return {
      inbetweens: Number($('ag-final-inbetweens')?.value || 0), loopBlend: Number($('ag-final-loop')?.value || 0), holdFirst: Number($('ag-final-first')?.value || 0), holdLast: Number($('ag-final-last')?.value || 0),
      speed: $('ag-final-speed')?.value || 'linear', fadeIn: Boolean($('ag-final-fade-in')?.checked), fadeOut: Boolean($('ag-final-fade-out')?.checked), fadeLevel: Number($('ag-final-fade')?.value || 3), pulse: Number($('ag-final-pulse')?.value || 0), shake: Number($('ag-final-shake')?.value || 0), bob: Number($('ag-final-bob')?.value || 0), trail: Number($('ag-final-trail')?.value || 0), strobe: Number($('ag-final-strobe')?.value || 0)
    };
  }

  function cloneCanvas(source) { const canvas = makeCanvas(source.width, source.height); canvas.getContext('2d').drawImage(source, 0, 0); return canvas; }
  function alphaCanvas(source, alpha) { const canvas = makeCanvas(source.width, source.height); const context = canvas.getContext('2d'); context.globalAlpha = alpha; context.drawImage(source, 0, 0); return canvas; }
  function blendCanvas(first, second, amount) { const canvas = makeCanvas(Math.max(first.width, second.width), Math.max(first.height, second.height)); const context = canvas.getContext('2d'); context.globalAlpha = 1 - amount; context.drawImage(first, 0, 0, canvas.width, canvas.height); context.globalAlpha = amount; context.drawImage(second, 0, 0, canvas.width, canvas.height); return canvas; }

  function applyFinalEffects(baseFrames) {
    const settings = finalEffects();
    let frames = baseFrames.map((frame, index) => {
      const canvas = makeCanvas(frame.width, frame.height);
      const context = canvas.getContext('2d');
      const phase = baseFrames.length < 2 ? 0 : index / (baseFrames.length - 1);
      const pulse = settings.pulse ? 1 - settings.pulse / 22 + Math.sin(phase * Math.PI * 2) * settings.pulse / 22 : 1;
      const bob = settings.bob ? Math.sin(phase * Math.PI * 2) * settings.bob : 0;
      const shakeX = settings.shake ? Math.sin((index + 1) * 12.9898) * settings.shake : 0;
      const shakeY = settings.shake ? Math.cos((index + 1) * 78.233) * settings.shake : 0;
      const strobe = settings.strobe && index % Math.max(2, 12 - settings.strobe) === 0 ? .4 + settings.strobe / 20 : 1;
      if (settings.trail && index > 0) { context.globalAlpha = settings.trail / 28; context.drawImage(baseFrames[index - 1], 0, 0); }
      context.globalAlpha = clamp(pulse * strobe, 0, 1); context.drawImage(frame, shakeX, shakeY + bob); return canvas;
    });
    if (settings.inbetweens && frames.length > 1) { const output = []; for (let index = 0; index < frames.length - 1; index += 1) { output.push(frames[index]); for (let step = 1; step <= settings.inbetweens; step += 1) output.push(blendCanvas(frames[index], frames[index + 1], step / (settings.inbetweens + 1))); } output.push(frames[frames.length - 1]); frames = output; }
    if (settings.loopBlend && frames.length > 1) for (let step = 1; step <= settings.loopBlend; step += 1) frames.push(blendCanvas(frames[frames.length - 1], frames[0], step / (settings.loopBlend + 1)));
    if (settings.holdFirst && frames.length) frames = [...Array(settings.holdFirst).fill(frames[0]), ...frames];
    if (settings.holdLast && frames.length) frames = [...frames, ...Array(settings.holdLast).fill(frames[frames.length - 1])];
    if (settings.fadeIn && frames.length) frames = [...Array.from({ length: settings.fadeLevel }, (_, index) => alphaCanvas(frames[0], (index + 1) / settings.fadeLevel)), ...frames.slice(1)];
    if (settings.fadeOut && frames.length) { const last = frames[frames.length - 1]; const denominator = Math.max(1, settings.fadeLevel - 1); frames = [...frames.slice(0, -1), ...Array.from({ length: settings.fadeLevel }, (_, index) => alphaCanvas(last, 1 - index / denominator))]; }
    if (settings.speed !== 'linear' && frames.length > 2) { const output = []; frames.forEach((frame, index) => { const t = index / (frames.length - 1); const count = settings.speed === 'ease-in' ? (t < .42 ? 2 : 1) : settings.speed === 'ease-out' ? (t > .58 ? 2 : 1) : (t < .25 || t > .75 ? 2 : 1); for (let copy = 0; copy < count; copy += 1) output.push(frame); }); frames = output; }
    return frames;
  }

  async function outputFrames() {
    const longest = Math.max(0, ...state.groups.map((group) => group.frames.length));
    if (!longest) return [];
    const skip = Number($('adj-skip')?.value || 1);
    let indices = Array.from({ length: longest }, (_, index) => index).filter((_, index) => index % skip === 0);
    if ($('chk-reverse')?.checked) indices = indices.reverse();
    if ($('chk-forverse')?.checked) indices = indices.concat([...indices].reverse());
    const frames = [];
    for (const index of indices) { const canvas = await compositeFrame(index); if (canvas) frames.push(canvas); }
    return applyFinalEffects(frames);
  }

  function outputDelay(frameCount) {
    const base = Number($('frame-delay')?.value || 200);
    const sourceCount = Math.max(1, ...state.groups.map((group) => group.frames.length));
    return Math.max(11, Math.round(base * sourceCount / Math.max(1, frameCount)));
  }

  async function renderEditor() {
    const token = ++state.renderToken;
    const group = activeGroup();
    const frame = activeFrame(group);
    if (!group || !frame) {
      editorCanvas.width = 480; editorCanvas.height = 480; const context = editorCanvas.getContext('2d'); context.clearRect(0, 0, 480, 480); context.fillStyle = '#75b2de'; context.font = '15px Geist Mono,monospace'; context.textAlign = 'center'; context.fillText('SELECT A GROUP FRAME TO BEGIN', 240, 240); fitEditorCanvas(); updateSelectionOverlay(); return;
    }
    const dim = getDimension();
    let rendered;
    if (state.editorMode === 'effects') rendered = await frameCanvas(frame, group, dim, state.effectsDraft);
    else if (state.editorView === 'final') rendered = await compositeFrame(state.editorIndex, dim);
    else rendered = await frameCanvas(frame, group, dim, defaultEffects(), false);
    if (token !== state.renderToken || !rendered) return;
    editorCanvas.width = rendered.width; editorCanvas.height = rendered.height;
    const context = editorCanvas.getContext('2d'); context.clearRect(0, 0, editorCanvas.width, editorCanvas.height); context.drawImage(rendered, 0, 0);
    fitEditorCanvas(); updateSelectionOverlay(); updateEditorLabels();
  }

  function updateEditorLabels() {
    const group = activeGroup(); const frame = activeFrame(group);
    $('editor-frame-number').textContent = frame ? `${group.name.toUpperCase()} · FRAME ${activeFramePosition(group) + 1} / ${group.frames.length}` : 'NO FRAME SELECTED';
    $('editor-play').textContent = '▶ PLAY';
    $('view-final').classList.toggle('active', state.editorView === 'final');
    $('view-original').classList.toggle('active', state.editorView === 'original');
  }

  function fitEditorCanvas() {
    const area = canvasViewport.getBoundingClientRect();
    const dim = Math.max(editorCanvas.width, editorCanvas.height, 1);
    const fit = Math.min((area.width - 32) / dim, (area.height - 32) / dim, 1);
    const size = Math.max(40, dim * fit);
    editorCanvas.style.width = `${size}px`; editorCanvas.style.height = `${size}px`;
    editorCanvas.style.transform = `translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;
    $('zoom-label').textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function updateSelectionOverlay() {
    const overlay = $('ag-selection-overlay');
    const selection = state.selection;
    const canvasRect = editorCanvas.getBoundingClientRect();
    const viewportRect = canvasViewport.getBoundingClientRect();
    const visible = selection.active && selection.w > .004 && selection.h > .004;
    overlay.hidden = !visible;
    if (!visible) return;
    overlay.style.left = `${canvasRect.left - viewportRect.left + canvasRect.width * selection.x}px`;
    overlay.style.top = `${canvasRect.top - viewportRect.top + canvasRect.height * selection.y}px`;
    overlay.style.width = `${canvasRect.width * selection.w}px`;
    overlay.style.height = `${canvasRect.height * selection.h}px`;
  }

  function selectionRegion(canvas) {
    const selection = state.selection;
    if (!selection.active || selection.w <= .004 || selection.h <= .004) return { x: 0, y: 0, w: canvas.width, h: canvas.height, full: true };
    return { x: Math.round(selection.x * canvas.width), y: Math.round(selection.y * canvas.height), w: Math.max(1, Math.round(selection.w * canvas.width)), h: Math.max(1, Math.round(selection.h * canvas.height)), full: false };
  }

  async function editableCanvas() {
    const frame = activeFrame(); const group = activeGroup();
    if (!frame || !group) return null;
    return frameCanvas(frame, group, getDimension(), defaultEffects(), false);
  }

  function saveEditableCanvas(canvas) {
    const frame = activeFrame();
    if (!frame) return;
    const old = frame.base64;
    frame.base64 = canvas.toDataURL('image/png');
    frame.w = canvas.width; frame.h = canvas.height;
    state.imageCache.delete(old);
    renderAll();
  }

  function pointFromEvent(event) {
    const rect = editorCanvas.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
  }

  async function pasteFromClipboard() {
    try {
      const { blob, type } = await clipboardImage();
      const extension = type.split('/')[1] || 'png';
      await importImages([new File([blob], `clipboard-frame-${Date.now()}.${extension}`, { type })]);
    } catch (error) { notify(error.message); }
  }

  async function clipboardImage() {
    if (!navigator.clipboard?.read) throw new Error('Clipboard image access is unavailable in this browser.');
    const items = await navigator.clipboard.read();
    for (const item of items) { const type = item.types.find((entry) => entry.startsWith('image/')); if (type) return { blob: await item.getType(type), type }; }
    throw new Error('No image was found in the clipboard.');
  }

  async function copyCurrentFrame() {
    const source = await editableCanvas(); if (!source) return;
    const region = selectionRegion(source); const output = makeCanvas(region.w, region.h); output.getContext('2d').drawImage(source, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
    output.toBlob(async (blob) => { try { if (!blob || !window.ClipboardItem) throw new Error(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); notify(region.full ? 'Current frame copied.' : 'Selection copied.'); } catch (error) { notify('Browser clipboard write was blocked.'); } }, 'image/png');
  }

  async function pasteIntoFrame() {
    try {
      const { blob } = await clipboardImage(); const url = URL.createObjectURL(blob); const image = await loadImage(url); URL.revokeObjectURL(url);
      const source = await editableCanvas(); if (!source) return; const region = selectionRegion(source); const context = source.getContext('2d'); context.clearRect(region.x, region.y, region.w, region.h); context.drawImage(image, region.x, region.y, region.w, region.h); saveEditableCanvas(source); notify(region.full ? 'Clipboard image pasted into current frame.' : 'Clipboard image pasted into selection.');
    } catch (error) { notify(error.message); }
  }

  async function pasteAsNewFrame() {
    try {
      const { blob, type } = await clipboardImage(); const extension = type.split('/')[1] || 'png'; const frames = await filesToFrames([new File([blob], `pasted-frame-${Date.now()}.${extension}`, { type })]); const group = activeGroup(); if (!group || !frames.length) return; const index = activeFramePosition(group); group.frames.splice(index + 1, 0, frames[0]); state.activeFrameId = frames[0].id; renderAll(); notify('Clipboard image inserted as a new frame.');
    } catch (error) { notify(error.message); }
  }

  async function clearCurrentFrame() {
    const source = await editableCanvas(); if (!source) return; const region = selectionRegion(source); source.getContext('2d').clearRect(region.x, region.y, region.w, region.h); saveEditableCanvas(source); notify(region.full ? 'Current frame cleared.' : 'Selection cleared.');
  }

  function transformCanvas(source, type, value) {
    const output = makeCanvas(source.width, source.height); output.getContext('2d').drawImage(source, 0, 0); const region = selectionRegion(output); const crop = makeCanvas(region.w, region.h); crop.getContext('2d').drawImage(source, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
    const context = output.getContext('2d'); context.save(); context.beginPath(); context.rect(region.x, region.y, region.w, region.h); context.clip(); context.clearRect(region.x, region.y, region.w, region.h); context.translate(region.x + region.w / 2, region.y + region.h / 2); if (type === 'scale') context.scale(value / 100, value / 100); else context.rotate(value * Math.PI / 180); context.drawImage(crop, -region.w / 2, -region.h / 2); context.restore(); return output;
  }

  async function openTransform(type) {
    const base = await editableCanvas(); if (!base) return;
    state.transform = { type, base, groupId: state.activeGroupId, frameId: state.activeFrameId };
    const slider = $('ag-transform-slider'); $('ag-transform-panel').hidden = false;
    if (type === 'scale') { $('ag-transform-title').textContent = state.selection.active ? 'SCALE SELECTION' : 'SCALE FRAME'; slider.min = '10'; slider.max = '300'; slider.value = '100'; $('ag-transform-value').textContent = '100%'; }
    else { $('ag-transform-title').textContent = state.selection.active ? 'ROTATE SELECTION' : 'ROTATE FRAME'; slider.min = '-180'; slider.max = '180'; slider.value = '0'; $('ag-transform-value').textContent = '0°'; }
    previewTransform();
  }

  function previewTransform() {
    if (!state.transform) return;
    const value = Number($('ag-transform-slider').value); $('ag-transform-value').textContent = state.transform.type === 'scale' ? `${value}%` : `${value}°`;
    const preview = transformCanvas(state.transform.base, state.transform.type, value); editorCanvas.width = preview.width; editorCanvas.height = preview.height; editorCanvas.getContext('2d').drawImage(preview, 0, 0); fitEditorCanvas(); updateSelectionOverlay();
  }

  function closeTransform(commit) {
    if (!state.transform) return;
    if (commit) {
      const group = getGroup(state.transform.groupId); const frame = group?.frames.find((entry) => entry.id === state.transform.frameId);
      if (frame) { const output = transformCanvas(state.transform.base, state.transform.type, Number($('ag-transform-slider').value)); const old = frame.base64; frame.base64 = output.toDataURL('image/png'); frame.w = output.width; frame.h = output.height; state.imageCache.delete(old); notify(state.transform.type === 'scale' ? 'Scale applied.' : 'Rotation applied.'); }
    }
    state.transform = null; $('ag-transform-panel').hidden = true; renderAll();
  }

  function floodFill(canvas, point, mode, colour, tolerance) {
    const context = canvas.getContext('2d', { willReadFrequently: true }); const image = context.getImageData(0, 0, canvas.width, canvas.height); const data = image.data;
    const sx = clamp(Math.round(point.x * (canvas.width - 1)), 0, canvas.width - 1); const sy = clamp(Math.round(point.y * (canvas.height - 1)), 0, canvas.height - 1); const start = (sy * canvas.width + sx) * 4; const base = [data[start], data[start + 1], data[start + 2], data[start + 3]]; const seen = new Uint8Array(canvas.width * canvas.height); const stack = [sy * canvas.width + sx]; const rgb = hexRgb(colour);
    while (stack.length) { const current = stack.pop(); if (seen[current]) continue; const offset = current * 4; const distance = Math.hypot(data[offset] - base[0], data[offset + 1] - base[1], data[offset + 2] - base[2], (data[offset + 3] - base[3]) * .5); if (distance > tolerance) continue; seen[current] = 1; if (mode === 'transparent') data[offset + 3] = 0; else { data[offset] = rgb.r; data[offset + 1] = rgb.g; data[offset + 2] = rgb.b; data[offset + 3] = 255; } const x = current % canvas.width; const y = Math.floor(current / canvas.width); if (x) stack.push(current - 1); if (x < canvas.width - 1) stack.push(current + 1); if (y) stack.push(current - canvas.width); if (y < canvas.height - 1) stack.push(current + canvas.width); }
    context.putImageData(image, 0, 0);
  }

  async function paintStart(event) {
    const source = await editableCanvas(); if (!source) return; const point = pointFromEvent(event); state.paint.buffer = source;
    if (state.paint.tool === 'bucket') { floodFill(source, point, $('bucket-mode [data-bucket-mode].active')?.dataset.bucketMode || 'transparent', $('brush-color')?.value || '#00ff00', Number($('bucket-tolerance')?.value || 18)); saveEditableCanvas(source); return; }
    state.paint.drawing = true; state.paint.last = point; editorCanvas.setPointerCapture?.(event.pointerId);
    const context = source.getContext('2d'); context.strokeStyle = $('brush-color')?.value || '#00ff00'; context.lineWidth = Number($('brush-size')?.value || 30); context.lineCap = 'round'; context.lineJoin = 'round'; if (Number($('brush-softness')?.value || 0)) context.filter = `blur(${Math.max(1, Number($('brush-softness').value) / 15)}px)`; context.beginPath(); context.moveTo(point.x * source.width, point.y * source.height);
  }

  function paintMove(event) {
    if (!state.paint.drawing || !state.paint.buffer) return; const point = pointFromEvent(event); const context = state.paint.buffer.getContext('2d'); context.lineTo(point.x * state.paint.buffer.width, point.y * state.paint.buffer.height); context.stroke(); editorCanvas.width = state.paint.buffer.width; editorCanvas.height = state.paint.buffer.height; editorCanvas.getContext('2d').drawImage(state.paint.buffer, 0, 0); fitEditorCanvas(); state.paint.last = point;
  }

  function paintFinish(event) {
    if (!state.paint.drawing) return; state.paint.drawing = false; editorCanvas.releasePointerCapture?.(event.pointerId); saveEditableCanvas(state.paint.buffer); state.paint.buffer = null;
  }

  function canvasPointerDown(event) {
    if (!activeFrame()) return;
    if (state.editorMode === 'select' && state.selectionEnabled) {
      event.preventDefault(); const point = pointFromEvent(event); const selection = state.selection; selection.drawing = true; editorCanvas.setPointerCapture?.(event.pointerId); const inside = selection.active && point.x >= selection.x && point.x <= selection.x + selection.w && point.y >= selection.y && point.y <= selection.y + selection.h;
      if (inside) { selection.mode = 'move'; selection.lastX = point.x; selection.lastY = point.y; } else { selection.mode = 'create'; selection.active = true; selection.startX = point.x; selection.startY = point.y; selection.x = point.x; selection.y = point.y; selection.w = 0; selection.h = 0; }
      updateSelectionOverlay(); return;
    }
    if (state.editorMode === 'paint') { event.preventDefault(); paintStart(event); }
  }

  function canvasPointerMove(event) {
    if (state.editorMode === 'paint') { paintMove(event); return; }
    const selection = state.selection; if (!selection.drawing || state.editorMode !== 'select') return; event.preventDefault(); const point = pointFromEvent(event);
    if (selection.mode === 'move') { selection.x = clamp(selection.x + point.x - selection.lastX, 0, 1 - selection.w); selection.y = clamp(selection.y + point.y - selection.lastY, 0, 1 - selection.h); selection.lastX = point.x; selection.lastY = point.y; }
    else { selection.x = Math.min(selection.startX, point.x); selection.y = Math.min(selection.startY, point.y); selection.w = Math.abs(point.x - selection.startX); selection.h = Math.abs(point.y - selection.startY); }
    updateSelectionOverlay();
  }

  function canvasPointerUp(event) {
    if (state.editorMode === 'paint') { paintFinish(event); return; }
    if (!state.selection.drawing) return; state.selection.drawing = false; editorCanvas.releasePointerCapture?.(event.pointerId); if (state.selection.w < .004 || state.selection.h < .004) state.selection.active = false; updateSelectionOverlay();
  }

  function applyGroupEffects() {
    const targets = [...state.effectTargets];
    targets.forEach((id) => { const group = getGroup(id); if (group) group.effects = deepCopy(state.effectsDraft); });
    notify(`Effects applied to ${targets.length} group${targets.length === 1 ? '' : 's'}.`); renderAll();
  }

  function noise(seed) { return (Math.sin(seed * 12.9898) * 43758.5453) % 1; }

  async function generateFrames(sourceFrame, type, strength, duration, direction) {
    const image = await loadImage(sourceFrame.base64); const width = image.naturalWidth || image.width; const height = image.naturalHeight || image.height; const frames = [];
    const directionSign = direction === 'reverse' || direction === 'counterclockwise' ? -1 : 1;
    for (let index = 1; index <= duration; index += 1) {
      const phase = index / duration; const wave = Math.sin(phase * Math.PI * 2 * directionSign); const canvas = makeCanvas(width, height); const context = canvas.getContext('2d'); context.translate(width / 2, height / 2);
      let scale = 1; let angle = 0; let alpha = 1; let x = 0; let y = 0; let filter = 'none';
      if (type === 'pulse-brightness') filter = `brightness(${1 + wave * strength / 10})`;
      if (type === 'pulse-size') scale = 1 + wave * strength / 25;
      if (type === 'rotate') angle = phase * Math.PI * 2 * strength / 10 * directionSign;
      if (type === 'hue-shift') filter = `hue-rotate(${phase * strength * 36 * directionSign}deg)`;
      if (type === 'opacity-pulse') alpha = clamp(1 - strength / 16 + wave * strength / 16, .1, 1);
      if (type === 'float') y = wave * strength * 2;
      if (type === 'shake') { x = (noise(index * 3) - .5) * strength * 4; y = (noise(index * 7) - .5) * strength * 4; }
      if (type === 'breathing') { scale = 1 + wave * strength / 36; alpha = clamp(1 - strength / 25 + wave * strength / 25, .2, 1); }
      if (type === 'motion-trail' && index > 1) { context.globalAlpha = strength / 24; context.drawImage(image, -width / 2 - strength * 2 * directionSign, -height / 2); }
      context.filter = filter; context.globalAlpha = alpha; context.rotate(angle); context.scale(scale, scale); context.drawImage(image, -width / 2 + x, -height / 2 + y);
      frames.push({ id: uid('frame'), name: `${animationNames[type]} ${index}/${duration}`, base64: canvas.toDataURL('image/png'), w: width, h: height, offsetX: 0, offsetY: 0 });
    }
    return frames;
  }

  async function generateAnimation() {
    const type = $('ag-animation-type').value;
    if (type === 'overlay-layer') return;
    const strength = Number($('ag-animation-strength').value); const duration = Number($('ag-animation-duration').value); const direction = $('ag-animation-direction').value; const targetIds = [...state.animationTargets];
    if (!targetIds.length) return;
    const before = totalFrames();
    notify('Generating animation frames...');
    for (const groupId of targetIds) {
      const group = getGroup(groupId); if (!group?.frames.length) continue;
      const frame = group.id === state.activeGroupId ? activeFrame(group) : group.frames[0]; if (!frame) continue;
      const generated = await generateFrames(frame, type, strength, duration, direction);
      if (before === 1 && targetIds.length === 1) {
        group.frames = [frame, ...generated]; state.activeGroupId = group.id; state.activeFrameId = frame.id;
      } else {
        group.frames = group.frames.filter((entry) => entry.id !== frame.id);
        const layer = group.layer; state.groups.forEach((entry) => { if (entry !== group && entry.layer >= layer) entry.layer += 1; });
        const created = { id: uid('group'), name: `${group.name} — ${animationNames[type]}`, layer, blend: group.blend, effects: deepCopy(group.effects), frames: [frame, ...generated] };
        state.groups.push(created); if (!group.frames.length) state.groups = state.groups.filter((entry) => entry !== group); normalizeLayers(); state.activeGroupId = created.id; state.activeFrameId = frame.id;
      }
    }
    state.animationTargets = new Set([state.activeGroupId]);
    notify('Animation frames generated.'); renderAll();
  }

  async function openFramePreview(groupId, frameId) {
    setActive(groupId, frameId); previewModal.hidden = false; const canvas = await frameCanvas(activeFrame(), activeGroup(), 280); previewImage.src = canvas.toDataURL('image/png');
  }

  function openAlignment(groupId, frameId) { state.align = { groupId, frameId }; setActive(groupId, frameId); alignModal.hidden = false; renderAlignment(); }
  async function renderAlignment() { const group = getGroup(state.align?.groupId); const frame = group?.frames.find((entry) => entry.id === state.align?.frameId); if (!group || !frame) return; const canvas = await frameCanvas(frame, group, 280, defaultEffects(), false); alignCanvas.width = canvas.width; alignCanvas.height = canvas.height; alignCanvas.getContext('2d').drawImage(canvas, 0, 0); $('align-frame-number').textContent = `${group.name.toUpperCase()} · FRAME ${group.frames.indexOf(frame) + 1} / ${group.frames.length}`; $('align-offset').textContent = `X: ${frame.offsetX}  Y: ${frame.offsetY}`; }
  function nudgeAlign(direction) { const group = getGroup(state.align?.groupId); const frame = group?.frames.find((entry) => entry.id === state.align?.frameId); if (!frame) return; if (direction === 'up') frame.offsetY -= 1; if (direction === 'down') frame.offsetY += 1; if (direction === 'left') frame.offsetX -= 1; if (direction === 'right') frame.offsetX += 1; renderAlignment(); renderAll(); }

  function stopPreview() { state.previewToken += 1; if (state.previewTimer) clearTimeout(state.previewTimer); state.previewTimer = null; }
  async function playPreview() {
    stopPreview(); const token = ++state.previewToken; animationModal.hidden = false; animationLoading.hidden = false; animationImage.hidden = true; const frames = await outputFrames(); if (token !== state.previewToken) return; if (!frames.length) { animationModal.hidden = true; notify('Load image frames first.'); return; }
    animationLoading.hidden = true; animationImage.hidden = false; const delay = outputDelay(frames.length); let index = 0; const tick = () => { if (token !== state.previewToken) return; animationImage.src = frames[index].toDataURL('image/png'); index = (index + 1) % frames.length; state.previewTimer = setTimeout(tick, delay); }; tick(); showOutputFrame(frames[0]); notify(`${frames.length} composite frame${frames.length === 1 ? '' : 's'} previewing.`);
  }

  function showOutputFrame(canvas) { outputCard.hidden = false; outputViewport.innerHTML = ''; const preview = makeCanvas(canvas.width, canvas.height); preview.getContext('2d').drawImage(canvas, 0, 0); outputViewport.appendChild(preview); }

  const fourCC = (name) => text.encode(name);
  const concat = (parts) => { const length = parts.reduce((sum, part) => sum + part.length, 0); const output = new Uint8Array(length); let offset = 0; parts.forEach((part) => { output.set(part, offset); offset += part.length; }); return output; };
  const u16 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255]);
  const u24 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255]);
  const u32 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
  const chunk = (name, payload) => concat([fourCC(name), u32(payload.length), payload, payload.length % 2 ? new Uint8Array([0]) : new Uint8Array()]);
  const readFour = (bytes, offset) => String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  const readU32 = (bytes, offset) => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;

  async function webpPayload(canvas, quality) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp') throw new Error('This browser cannot encode WebP.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (readFour(bytes, 0) !== 'RIFF' || readFour(bytes, 8) !== 'WEBP') throw new Error('The browser returned invalid WebP data.');
    const pieces = []; let offset = 12;
    while (offset + 8 <= bytes.length) { const name = readFour(bytes, offset); const size = readU32(bytes, offset + 4); const end = offset + 8 + size; pieces.push({ name, raw: bytes.slice(offset, end + size % 2) }); offset = end + size % 2; }
    const imagePieces = pieces.filter((piece) => ['ALPH', 'VP8 ', 'VP8L'].includes(piece.name));
    return { data: concat(imagePieces.map((piece) => piece.raw)), alpha: imagePieces.some((piece) => piece.name === 'ALPH' || piece.name === 'VP8L') };
  }

  async function animatedWebP(frames, duration) {
    const width = frames[0].width; const height = frames[0].height; const quality = Number($('adj-webp-q')?.value || 80) / 100; const loop = Number($('play-count')?.value || 0); const encoded = []; let alpha = false;
    for (const frame of frames) { const payload = await webpPayload(frame, $('chk-webp-lossless')?.checked ? 1 : quality); encoded.push(payload); alpha ||= payload.alpha; }
    const vp8x = new Uint8Array(10); vp8x[0] = 0x02 | (alpha ? 0x10 : 0); vp8x.set(u24(width - 1), 4); vp8x.set(u24(height - 1), 7);
    const anim = concat([new Uint8Array([0, 0, 0, 0]), u16(clamp(loop, 0, 65535))]);
    const chunks = encoded.map((frame) => chunk('ANMF', concat([u24(0), u24(0), u24(width - 1), u24(height - 1), u24(clamp(duration, 11, 0xFFFFFF)), new Uint8Array([0x02]), frame.data])));
    const payload = concat([fourCC('WEBP'), chunk('VP8X', vp8x), chunk('ANIM', anim), ...chunks]);
    return new Blob([concat([fourCC('RIFF'), u32(payload.length), payload])], { type: 'image/webp' });
  }

  function saveBlob(blob, filename) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }

  async function exportFrames() {
    stopPreview(); const frames = await outputFrames(); if (!frames.length) return notify('Load image frames first.'); showOutputFrame(frames[0]); const format = $('opt-format')?.value || 'gif'; const delay = outputDelay(frames.length);
    try {
      if (format === 'zip') {
        if (!window.JSZip) throw new Error('ZIP support is unavailable.'); const zip = new JSZip(); const folder = zip.folder(`${safeName()}-frames`); const digits = Math.max(3, String(frames.length).length);
        for (let index = 0; index < frames.length; index += 1) { const blob = await new Promise((resolve) => frames[index].toBlob(resolve, 'image/png')); folder.file(`frame-${String(index + 1).padStart(digits, '0')}.png`, blob); }
        saveBlob(await zip.generateAsync({ type: 'blob' }), `${safeName()}-frames.zip`); notify('PNG frame ZIP saved.'); return;
      }
      if (format === 'webp') { const blob = await animatedWebP(frames, delay); saveBlob(blob, `${safeName()}.webp`); notify('Animated WebP saved.'); return; }
      if (!window.gifshot) throw new Error('GIF support is unavailable.');
      window.gifshot.createGIF({ images: frames.map((frame) => frame.toDataURL('image/png')), interval: delay / 1000, gifWidth: frames[0].width, gifHeight: frames[0].height, numWorkers: 2, sampleInterval: 10 }, (result) => {
        if (result.error) { notify('GIF export failed.'); return; }
        const binary = atob(result.image.split(',')[1]); const bytes = new Uint8Array(binary.length); for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index); saveBlob(new Blob([bytes], { type: 'image/gif' }), `${safeName()}.gif`); notify('GIF saved.');
      });
    } catch (error) { notify(`Export error: ${error.message}`); }
  }

  async function downloadPngZip() { const previous = $('opt-format').value; $('opt-format').value = 'zip'; await exportFrames(); $('opt-format').value = previous; $('opt-format').dispatchEvent(new Event('change')); }

  function updateActionAvailability() {
    const hasFrames = totalFrames() > 0; openEditor.disabled = !hasFrames; zipBtn.disabled = !hasFrames; compileBtn.disabled = !hasFrames; previewBtn.disabled = !hasFrames;
    const max = Math.max(0, ...state.groups.map((group) => group.frames.length));
    $('frame-skip-container').hidden = max <= 15;
  }

  function renderAll() {
    ensureQueueUi(); ensureEditorUi(); setupOutputEffects(); renderGroupSelect(); renderGroupFrames(); updateActionAvailability(); renderEffectsControls(); renderEditor();
  }

  function interceptEvents() {
    document.addEventListener('change', (event) => {
      if (event.target === imagePicker) { event.preventDefault(); event.stopImmediatePropagation(); importImages(event.target.files, $('ag-import-group')?.value || state.activeGroupId).finally(() => { imagePicker.value = ''; }); }
      if (event.target === videoPicker) { event.preventDefault(); event.stopImmediatePropagation(); importVideo(event.target.files[0]).finally(() => { videoPicker.value = ''; }); }
    }, true);

    document.addEventListener('dragover', (event) => {
      const files = [...(event.dataTransfer?.files || [])];
      if (!files.some((file) => file.type.startsWith('image/'))) return;
      if (!topPanel.contains(event.target)) return;
      event.preventDefault(); topPanel.classList.add('ag-drop-active');
    }, true);
    document.addEventListener('dragleave', (event) => { if (topPanel.contains(event.target)) topPanel.classList.remove('ag-drop-active'); }, true);
    document.addEventListener('drop', (event) => {
      const files = [...(event.dataTransfer?.files || [])];
      if (!files.some((file) => file.type.startsWith('image/'))) return;
      if (!topPanel.contains(event.target)) return;
      event.preventDefault(); event.stopImmediatePropagation(); topPanel.classList.remove('ag-drop-active'); importImages(files, $('ag-import-group')?.value || state.activeGroupId);
    }, true);

    document.addEventListener('paste', (event) => {
      const files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
      const activeElement = document.activeElement;
      if (!files.length || activeElement === imagePicker || activeElement === videoPicker) return;
      event.preventDefault(); event.stopImmediatePropagation(); importImages(files, state.activeGroupId);
    }, true);

    document.addEventListener('click', (event) => {
      const target = event.target.closest('button, [data-close]');
      if (!target) return;
      const id = target.id;
      if (id === 'open-editor-btn') { event.preventDefault(); event.stopImmediatePropagation(); state.editorView = 'final'; state.editorMode = 'edit'; setEditorMode('edit'); return; }
      if (id === 'compile-btn') { event.preventDefault(); event.stopImmediatePropagation(); exportFrames(); return; }
      if (id === 'zip-btn') { event.preventDefault(); event.stopImmediatePropagation(); downloadPngZip(); return; }
      if (id === 'btn-play-preview') { event.preventDefault(); event.stopImmediatePropagation(); playPreview(); return; }
      if (id === 'editor-prev') { event.preventDefault(); event.stopImmediatePropagation(); switchEditorFrame(-1); return; }
      if (id === 'editor-next') { event.preventDefault(); event.stopImmediatePropagation(); switchEditorFrame(1); return; }
      if (id === 'editor-play') { event.preventDefault(); event.stopImmediatePropagation(); playEditorSequence(); return; }
      if (id === 'view-final') { event.preventDefault(); event.stopImmediatePropagation(); state.editorView = 'final'; renderEditor(); return; }
      if (id === 'view-original') { event.preventDefault(); event.stopImmediatePropagation(); state.editorView = 'original'; renderEditor(); return; }
      if (id === 'zoom-in' || id === 'zoom-out' || id === 'zoom-fit' || id === 'zoom-reset') { event.preventDefault(); event.stopImmediatePropagation(); if (id === 'zoom-in') state.zoom = clamp(state.zoom + .25, .5, 5); if (id === 'zoom-out') state.zoom = clamp(state.zoom - .25, .5, 5); if (id === 'zoom-fit' || id === 'zoom-reset') { state.zoom = 1; state.panX = 0; state.panY = 0; } fitEditorCanvas(); updateSelectionOverlay(); return; }
      if (id === 'align-prev' || id === 'align-next') { event.preventDefault(); event.stopImmediatePropagation(); const group = getGroup(state.align?.groupId); if (!group?.frames.length) return; const current = group.frames.findIndex((frame) => frame.id === state.align.frameId); const next = (current + (id === 'align-prev' ? -1 : 1) + group.frames.length) % group.frames.length; state.align.frameId = group.frames[next].id; renderAlignment(); return; }
      if (target.dataset.nudge) { event.preventDefault(); event.stopImmediatePropagation(); nudgeAlign(target.dataset.nudge); return; }
      if (id === 'reset-align') { event.preventDefault(); event.stopImmediatePropagation(); const frame = getGroup(state.align?.groupId)?.frames.find((entry) => entry.id === state.align?.frameId); if (frame) { frame.offsetX = 0; frame.offsetY = 0; renderAlignment(); renderAll(); } return; }
      if (target.dataset.close === 'anim-preview-modal') stopPreview();
    }, true);

    editorCanvas.addEventListener('pointerdown', (event) => { if (!editorModal.hidden) { event.stopImmediatePropagation(); canvasPointerDown(event); } }, true);
    editorCanvas.addEventListener('pointermove', (event) => { if (!editorModal.hidden) { event.stopImmediatePropagation(); canvasPointerMove(event); } }, true);
    editorCanvas.addEventListener('pointerup', (event) => { if (!editorModal.hidden) { event.stopImmediatePropagation(); canvasPointerUp(event); } }, true);
    editorCanvas.addEventListener('pointercancel', (event) => { if (!editorModal.hidden) { event.stopImmediatePropagation(); canvasPointerUp(event); } }, true);

    document.addEventListener('click', (event) => {
      const tool = event.target.closest('#tool-grid [data-tool]');
      if (!tool || state.editorMode !== 'paint') return;
      event.preventDefault(); event.stopImmediatePropagation(); state.paint.tool = tool.dataset.tool; $$('#tool-grid [data-tool]').forEach((button) => button.classList.toggle('active', button === tool));
    }, true);

    ['adj-bright', 'adj-contrast', 'adj-exp', 'adj-sat', 'chk-transparent', 'adj-color', 'adj-tol', 'adj-smooth', 'chk-shadow', 'shadow-color', 'shadow-opacity', 'shadow-blur', 'shadow-x', 'shadow-y', 'max-dimension'].forEach((id) => $(id)?.addEventListener('input', () => { renderEditor(); }, true));
    window.addEventListener('resize', () => { fitEditorCanvas(); updateSelectionOverlay(); });
  }

  function playEditorSequence() {
    const group = activeGroup(); if (!group?.frames.length) return; let index = activeFramePosition(group); const button = $('editor-play'); if (button.dataset.playing === 'true') { clearInterval(Number(button.dataset.timer)); button.dataset.playing = 'false'; button.textContent = '▶ PLAY'; return; }
    button.dataset.playing = 'true'; button.textContent = '❚❚ PAUSE'; const timer = window.setInterval(() => { if (button.dataset.playing !== 'true') return; index = (index + 1) % group.frames.length; state.activeFrameId = group.frames[index].id; state.editorIndex = index; renderAll(); }, Number($('frame-delay')?.value || 200)); button.dataset.timer = String(timer);
  }

  ['queue-card', 'advanced-webp-card', 'output-card'].forEach((id) => keepVisible($(id)));
  createGroup('Group 1');
  setupOutputEffects();
  ensureQueueUi();
  ensureEditorUi();
  interceptEvents();
  renderAll();
})();