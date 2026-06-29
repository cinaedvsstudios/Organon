(() => {
  'use strict';

  const root = document.getElementById('advanced-root');
  const $ = (selector, host = document) => host.querySelector(selector);
  const $$ = (selector, host = document) => [...host.querySelectorAll(selector)];
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const copy = (value) => JSON.parse(JSON.stringify(value));

  const blendModes = [
    ['source-over', 'Normal'], ['darken', 'Darken'], ['multiply', 'Multiply'], ['color-burn', 'Color Burn'],
    ['lighten', 'Lighten'], ['screen', 'Screen'], ['color-dodge', 'Color Dodge'], ['overlay', 'Overlay'],
    ['soft-light', 'Soft Light'], ['hard-light', 'Hard Light'], ['difference', 'Difference'], ['exclusion', 'Exclusion'],
    ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity']
  ];

  const animationLabels = {
    'pulse-brightness': 'Pulse Brightness', 'pulse-size': 'Pulse Size', rotate: 'Rotate', 'hue-shift': 'Hue Shift',
    'opacity-pulse': 'Opacity Pulse', float: 'Float Bob', shake: 'Shake Jitter', breathing: 'Breathing', 'motion-trail': 'Motion Trail'
  };

  const defaultEffects = () => ({ brightness: 100, contrast: 100, exposure: 0, hue: 0, saturation: 100, temperature: 0, tint: 0, opacity: 100, blur: 0, sharpen: 0 });

  const state = {
    groups: [], activeGroupId: null, activeFrameByGroup: {}, mode: 'edit', selectionEnabled: true,
    selection: { active: false, x: 0, y: 0, w: 0, h: 0, dragging: false, mode: 'create', startX: 0, startY: 0, lastX: 0, lastY: 0 },
    effectsDraft: defaultEffects(), effectTargets: new Set(), animationTargets: new Set(), grid: false, gridSize: 1,
    painting: false, paintLast: null, transform: null, previewTimer: null, previewToken: 0, imageCache: new Map()
  };

  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="title-wrap"><h1>Animation Maker — Advanced</h1><span class="subtitle" id="active-group-readout">NO GROUP SELECTED</span></div>
        <div class="header-actions"><button type="button" class="btn compact" id="new-group-header">CREATE NEW GROUP</button><button type="button" class="btn compact" id="standard-mode">STANDARD MODE</button></div>
      </header>
      <main class="page-grid">
        <section class="card"><div class="top-upload">
          <label class="dropzone" id="top-dropzone"><strong>DROP IMAGE FILES HERE</strong><span>or click to choose files</span><small>Files are added to the currently selected group.</small><input type="file" id="top-file-input" multiple accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"></label>
          <div class="upload-controls"><label>Import Into Group<select id="upload-group-select"></select></label><button type="button" class="btn primary" id="create-group-upload">CREATE NEW GROUP</button><p class="card-note">If no group exists, importing creates Group 1 automatically. Dragging a file over this top area never opens the file in the browser.</p></div>
        </div></section>
        <section class="card"><div class="groups-toolbar"><div><h2>1. Frames &amp; Groups</h2><p class="card-note">Select a group to make it the target for editing, effects, animation generation and top-window imports.</p></div><div class="input-row"><label>Export Name<input class="text-input" id="export-name" value="animation-export"></label><button type="button" class="btn primary" id="create-group-main">CREATE NEW GROUP</button></div></div><div class="groups-list" id="groups-list"></div></section>
        <section class="card"><div class="groups-toolbar"><div><h2>2. Edit All Frames</h2><p class="card-note" id="editor-group-note">Select a group and frame above to edit it.</p></div><div class="current-frame-label" id="active-frame-readout">NO FRAME SELECTED</div></div>
          <div class="editor-grid"><aside class="editor-sidebar">
            <div class="mode-tabs" id="editor-mode-tabs"><button type="button" class="mode-tab active" data-mode="edit">EDIT</button><button type="button" class="mode-tab" data-mode="paint">PAINT</button><button type="button" class="mode-tab" data-mode="select">SELECT</button><button type="button" class="mode-tab" data-mode="effects">EFFECTS</button><button type="button" class="mode-tab" data-mode="animations">ANIMATIONS</button></div>
            <div class="control-panel" id="edit-panel"><div class="panel-title"><h3>Frame Editing</h3></div><p class="selector-note">Edit works on the selected frame. An active selection limits Clear, Paste, Scale and Rotate to that area.</p><button type="button" class="btn" id="edit-copy">COPY FRAME / SELECTION</button><button type="button" class="btn" id="edit-paste">PASTE INTO FRAME</button><button type="button" class="btn" id="edit-paste-new">PASTE AS NEW FRAME</button><button type="button" class="btn danger" id="edit-clear">CLEAR FRAME / SELECTION</button><button type="button" class="btn" id="edit-scale">SCALE</button><button type="button" class="btn" id="edit-rotate">ROTATE</button></div>
            <div class="control-panel" id="paint-panel" hidden><div class="panel-title"><h3>Paint</h3></div><label class="field-label">Brush Colour<input id="paint-colour" type="color" value="#ffffff"></label><div class="control-row"><label>Brush Size <output id="paint-size-output">14 px</output></label><input id="paint-size" type="range" min="1" max="100" value="14"></div><p class="selector-note">Draw directly onto the selected frame. The edit is saved when the pointer is released.</p></div>
            <div class="control-panel" id="select-panel" hidden><div class="panel-title"><h3>Selection</h3></div><button type="button" class="btn active" id="selection-toggle">DRAW / MOVE SELECTION</button><button type="button" class="btn" id="selection-clear">CLEAR SELECTION</button><p class="selector-note">Selection stays in the same relative location when you move between frames.</p></div>
            <div class="control-panel" id="effects-panel" hidden><div class="panel-title"><h3>Group Effects</h3><button type="button" class="btn compact" id="effects-reset">RESET</button></div>${effectControls()}<div class="group-checklist" id="effects-group-checklist"></div><button type="button" class="btn primary" id="apply-effects">APPLY EFFECT TO SELECTED GROUPS</button></div>
            <div class="control-panel" id="animations-panel" hidden><div class="panel-title"><h3>Generate Animation</h3></div><label class="field-label">Animation Type<select id="animation-type"><option value="pulse-brightness">Pulse Brightness</option><option value="pulse-size">Pulse Size</option><option value="rotate">Rotate</option><option value="hue-shift">Hue Shift</option><option value="opacity-pulse">Opacity Pulse</option><option value="float">Float / Bob</option><option value="shake">Shake / Jitter</option><option value="breathing">Breathing</option><option value="motion-trail">Motion Trail</option><option value="overlay-layer" disabled>Overlay Layer — Coming Next</option></select></label><div class="control-row"><label>Strength <output id="animation-strength-output">5</output></label><input id="animation-strength" type="range" min="1" max="10" value="5"></div><div class="control-row"><label>Duration <output id="animation-duration-output">8 frames</output></label><input id="animation-duration" type="range" min="1" max="20" value="8"></div><div class="placeholder-box">Overlay Layer is reserved for a later compositing pass. It will eventually animate a separate image or group above the source frames.</div><div class="group-checklist" id="animations-group-checklist"></div><button type="button" class="btn primary" id="generate-animation">GENERATE NEW FRAMES</button><p class="selector-note">The selected source frame moves with its generated frames into a new group unless it is the only image in the whole workspace.</p></div>
          </aside>
          <section class="editor-stage"><div class="editor-actions"><button type="button" class="btn compact" id="toggle-grid">GRID</button><button type="button" class="btn compact" id="grid-size">GRID SIZE 1×</button><button type="button" class="btn compact" id="editor-prev">◀ PREV</button><button type="button" class="btn compact" id="editor-next">NEXT ▶</button></div><div class="canvas-wrap" id="canvas-wrap"><canvas class="editor-canvas" id="editor-canvas" width="640" height="420"></canvas><div class="selection-box" id="selection-box" hidden></div></div><div class="editor-footer"><span class="current-frame-label" id="editor-status">SELECT A FRAME TO BEGIN</span><div class="transform-control" id="transform-control" hidden><span id="transform-title">TRANSFORM</span><input id="transform-slider" type="range"><b id="transform-value">0</b><button type="button" class="btn compact primary" id="transform-apply">APPLY</button><button type="button" class="btn compact" id="transform-cancel">CANCEL</button></div></div></section></div>
        </section>
        <section class="settings-grid"><section class="card"><h2>3. Animation Settings</h2><div class="control-row"><label>Frame Duration <output id="frame-delay-output">200 ms</output></label><input id="frame-delay" type="range" min="40" max="1000" step="10" value="200"></div><div class="control-row"><label>Maximum Output Size <output id="output-size-output">720 px</output></label><input id="output-size" type="range" min="160" max="1280" step="10" value="720"></div><label class="check-row"><input id="reverse-output" type="checkbox"> Reverse final sequence</label><label class="check-row"><input id="forverse-output" type="checkbox"> Forverse final sequence</label></section><section class="card"><h2>4. Final Animation Effects</h2><label class="field-label">In-Between Frames<select id="final-inbetweens"><option value="0">Off</option><option value="1">1 Blend</option><option value="2">2 Blends</option><option value="3">3 Blends</option></select></label><label class="check-row"><input id="final-fade-in" type="checkbox"> Fade in</label><label class="check-row"><input id="final-fade-out" type="checkbox"> Fade out</label><div class="control-row"><label>Fade Level <output id="final-fade-level-output">3</output></label><input id="final-fade-level" type="range" min="1" max="10" value="3"></div></section><section class="card"><h2>5. Export</h2><label class="field-label">Output Format<select id="output-format"><option value="webp">Animated WebP</option><option value="gif">GIF</option><option value="zip">PNG Frames ZIP</option></select></label><label class="field-label">WebP Quality<input id="webp-quality" type="range" min="0" max="100" value="80"></label><p class="card-note">Groups are composited by Layer, with Layer 1 drawn on top. Each group uses its selected blend mode.</p></section></section>
        <section class="card preview-card"><div class="groups-toolbar"><div><h2>6. Composite Preview &amp; Output</h2><p class="card-note">Preview and export use group layers, blend modes, group effects and generated animation frames.</p></div><div class="status" id="status">READY</div></div><div class="preview-canvas-wrap"><img id="preview-image" alt="Final animation preview" hidden><span id="preview-empty" class="card-note">Load image frames to build a composite preview.</span></div><div class="preview-actions"><button type="button" class="btn" id="preview-output">PLAY PREVIEW</button><button type="button" class="btn primary" id="export-output">MAKE &amp; SAVE ANIMATION</button></div></section>
      </main>
    </div>
    <footer class="bottom-actions"><button type="button" class="btn" id="bottom-preview">PLAY PREVIEW</button><button type="button" class="btn primary" id="bottom-export">MAKE &amp; SAVE ANIMATION</button></footer>`;

  function effectControls() {
    const fields = [['brightness','Brightness','0','200','100','%'],['contrast','Contrast','0','200','100','%'],['exposure','Exposure','-100','100','0',''],['hue','Hue','-180','180','0','°'],['saturation','Saturation','0','200','100','%'],['temperature','Temperature','-100','100','0',''],['tint','Tint','-100','100','0',''],['opacity','Opacity','0','100','100','%'],['blur','Blur','0','20','0',' px'],['sharpen','Sharpen','0','10','0','']];
    return fields.map(([id,label,min,max,value,suffix]) => `<div class="control-row"><label>${label} <output id="effect-${id}-output">${value}${suffix}</output></label><input id="effect-${id}" type="range" min="${min}" max="${max}" value="${value}"></div>`).join('');
  }

  function status(message) { $('#status').textContent = message; }
  function activeGroup() { return state.groups.find((group) => group.id === state.activeGroupId) || null; }
  function activeFrame(group = activeGroup()) { return group?.frames.find((frame) => frame.id === state.activeFrameByGroup[group.id]) || group?.frames[0] || null; }
  function totalFrames() { return state.groups.reduce((count, group) => count + group.frames.length, 0); }

  function createGroup(name, options = {}) {
    const group = { id: uid('group'), name: name || `Group ${state.groups.length + 1}`, blend: options.blend || 'source-over', layer: options.layer || state.groups.length + 1, effects: copy(options.effects || defaultEffects()), frames: options.frames || [] };
    state.groups.push(group);
    state.activeGroupId = group.id;
    state.activeFrameByGroup[group.id] = group.frames[0]?.id || null;
    normaliseLayers();
    return group;
  }

  function normaliseLayers() {
    const ordered = [...state.groups].sort((a,b) => a.layer - b.layer || a.name.localeCompare(b.name));
    ordered.forEach((group, index) => { group.layer = index + 1; });
  }

  function setLayer(groupId, nextLayer) {
    const group = state.groups.find((entry) => entry.id === groupId);
    const other = state.groups.find((entry) => entry.layer === Number(nextLayer));
    if (!group || !other || group === other) return;
    const originalLayer = group.layer;
    group.layer = other.layer;
    other.layer = originalLayer;
    renderAll();
  }

  function setActiveGroup(id) {
    state.activeGroupId = id;
    const group = activeGroup();
    if (group && !activeFrame(group)) state.activeFrameByGroup[group.id] = group.frames[0]?.id || null;
    state.effectTargets.add(id);
    state.animationTargets.add(id);
    state.effectsDraft = copy(group?.effects || defaultEffects());
    renderAll();
  }

  function setActiveFrame(groupId, frameId) {
    state.activeGroupId = groupId;
    state.activeFrameByGroup[groupId] = frameId;
    renderAll();
  }

  function frameName(file, index) { return file.name || `Frame ${index + 1}`; }

  function fileToFrame(file, index) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error(`${file.name} is not an image.`));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
      reader.onload = async () => {
        try {
          const image = await loadImage(reader.result);
          resolve({ id: uid('frame'), name: frameName(file, index), src: reader.result, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
        } catch (error) { reject(error); }
      };
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(files, targetId = state.activeGroupId) {
    const selected = [...files].filter((file) => file.type.startsWith('image/'));
    if (!selected.length) { status('NO IMAGE FILES FOUND'); return; }
    let group = state.groups.find((entry) => entry.id === targetId);
    if (!group) group = createGroup('Group 1');
    status(`IMPORTING ${selected.length} FILE${selected.length === 1 ? '' : 'S'}...`);
    const frames = await Promise.all(selected.map(fileToFrame));
    group.frames.push(...frames);
    state.activeGroupId = group.id;
    state.activeFrameByGroup[group.id] = frames[0]?.id || activeFrame(group)?.id || null;
    state.effectTargets.add(group.id);
    state.animationTargets.add(group.id);
    status(`${frames.length} FRAME${frames.length === 1 ? '' : 'S'} ADDED TO ${group.name.toUpperCase()}`);
    renderAll();
  }

  function removeFrame(groupId, frameId) {
    const group = state.groups.find((entry) => entry.id === groupId);
    if (!group) return;
    group.frames = group.frames.filter((frame) => frame.id !== frameId);
    if (state.activeFrameByGroup[groupId] === frameId) state.activeFrameByGroup[groupId] = group.frames[0]?.id || null;
    renderAll();
  }

  function removeGroup(groupId) {
    if (state.groups.length === 1) {
      state.groups[0].frames = [];
      state.activeFrameByGroup[state.groups[0].id] = null;
      renderAll();
      return;
    }
    state.groups = state.groups.filter((group) => group.id !== groupId);
    delete state.activeFrameByGroup[groupId];
    state.effectTargets.delete(groupId);
    state.animationTargets.delete(groupId);
    normaliseLayers();
    state.activeGroupId = state.groups[0]?.id || null;
    renderAll();
  }

  function groupOptions(current) {
    return blendModes.map(([value, label]) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`).join('');
  }

  function renderGroups() {
    const host = $('#groups-list');
    host.innerHTML = state.groups.map((group) => {
      const isActive = group.id === state.activeGroupId;
      const layerOptions = Array.from({ length: state.groups.length }, (_, index) => `<option value="${index + 1}" ${group.layer === index + 1 ? 'selected' : ''}>LAYER ${index + 1}${index === 0 ? ' — TOP' : ''}</option>`).join('');
      const frames = group.frames.length ? group.frames.map((frame, index) => `<article class="frame-tile ${activeFrame(group)?.id === frame.id ? 'active' : ''}" data-frame="${frame.id}" data-group="${group.id}"><img src="${frame.src}" alt="${escapeHtml(frame.name)}"><span class="frame-number">${index + 1}</span><button type="button" class="frame-remove" data-remove-frame="${frame.id}" data-group="${group.id}" title="Remove frame">×</button><span class="frame-title">${escapeHtml(frame.name)}</span></article>`).join('') : '<div class="empty-group">DROP OR IMPORT IMAGE FILES INTO THIS GROUP</div>';
      return `<article class="group-card ${isActive ? 'active' : ''}" data-group-card="${group.id}"><header class="group-header"><button type="button" class="group-select" data-select-group="${group.id}" title="Select group">${isActive ? '●' : '○'}</button><input class="group-name" data-group-name="${group.id}" value="${escapeAttr(group.name)}" aria-label="Group name"><span class="group-meta">${group.frames.length} FRAME${group.frames.length === 1 ? '' : 'S'}</span><select class="group-pill-select" data-group-blend="${group.id}" title="Blend Mode">${groupOptions(group.blend)}</select><select class="group-pill-select" data-group-layer="${group.id}" title="Layer">${layerOptions}</select><button type="button" class="btn compact danger" data-remove-group="${group.id}">REMOVE</button></header><div class="group-frames">${frames}</div></article>`;
    }).join('');

    $$('[data-select-group]').forEach((button) => button.addEventListener('click', () => setActiveGroup(button.dataset.selectGroup)));
    $$('[data-group-name]').forEach((input) => input.addEventListener('change', () => { const group = state.groups.find((entry) => entry.id === input.dataset.groupName); if (group) { group.name = input.value.trim() || group.name; renderAll(); } }));
    $$('[data-group-blend]').forEach((select) => select.addEventListener('change', () => { const group = state.groups.find((entry) => entry.id === select.dataset.groupBlend); if (group) { group.blend = select.value; status(`${group.name.toUpperCase()} BLEND MODE UPDATED`); renderAll(); } }));
    $$('[data-group-layer]').forEach((select) => select.addEventListener('change', () => setLayer(select.dataset.groupLayer, select.value)));
    $$('[data-remove-group]').forEach((button) => button.addEventListener('click', () => removeGroup(button.dataset.removeGroup)));
    $$('[data-frame]').forEach((tile) => tile.addEventListener('click', (event) => { if (event.target.closest('[data-remove-frame]')) return; setActiveFrame(tile.dataset.group, tile.dataset.frame); }));
    $$('[data-remove-frame]').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); removeFrame(button.dataset.group, button.dataset.removeFrame); }));
  }

  function renderUploadSelector() {
    const select = $('#upload-group-select');
    select.innerHTML = state.groups.map((group) => `<option value="${group.id}" ${group.id === state.activeGroupId ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('');
  }

  function renderChecklist(hostId, targetSet) {
    const host = $(`#${hostId}`);
    const currentId = state.activeGroupId;
    targetSet.add(currentId);
    host.innerHTML = state.groups.map((group) => `<label class="group-check"><input type="checkbox" value="${group.id}" ${targetSet.has(group.id) ? 'checked' : ''} ${group.id === currentId ? 'data-current-group' : ''}><span>${escapeHtml(group.name)}${group.id === currentId ? ' — Current Group' : ''}</span></label>`).join('');
    $$('input[type="checkbox"]', host).forEach((checkbox) => checkbox.addEventListener('change', () => {
      const groupId = checkbox.value;
      if (checkbox.checked) targetSet.add(groupId); else if (groupId !== currentId) targetSet.delete(groupId); else checkbox.checked = true;
    }));
  }

  function renderEffectControls() {
    const values = state.effectsDraft;
    Object.entries(values).forEach(([key, value]) => {
      const input = $(`#effect-${key}`);
      const output = $(`#effect-${key}-output`);
      if (!input || !output) return;
      input.value = value;
      output.textContent = effectOutput(key, value);
    });
    renderChecklist('effects-group-checklist', state.effectTargets);
  }

  function effectOutput(key, value) {
    if (['brightness','contrast','saturation','opacity'].includes(key)) return `${value}%`;
    if (key === 'hue') return `${value}°`;
    if (key === 'blur') return `${value} px`;
    return value;
  }

  function updateEditorReadout() {
    const group = activeGroup();
    const frame = activeFrame(group);
    $('#active-group-readout').textContent = group ? `${group.name.toUpperCase()} · LAYER ${group.layer}` : 'NO GROUP SELECTED';
    $('#editor-group-note').textContent = group ? `Working group: ${group.name}. Effects and animation generation target this group by default.` : 'Select a group and frame above to edit it.';
    $('#active-frame-readout').textContent = frame ? `${group.name.toUpperCase()} · ${frame.name}` : 'NO FRAME SELECTED';
    $('#editor-status').textContent = frame ? `${group.name.toUpperCase()} · ${frame.name}` : 'SELECT A FRAME TO BEGIN';
  }

  function renderMode() {
    $$('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === state.mode));
    ['edit','paint','select','effects','animations'].forEach((mode) => $(`#${mode}-panel`).hidden = state.mode !== mode);
    if (state.mode === 'effects') {
      state.effectsDraft = copy(activeGroup()?.effects || defaultEffects());
      renderEffectControls();
    }
    if (state.mode === 'animations') renderChecklist('animations-group-checklist', state.animationTargets);
  }

  async function loadImage(src) {
    if (state.imageCache.has(src)) return state.imageCache.get(src);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to load image frame.'));
      image.src = src;
    });
    state.imageCache.set(src, promise);
    return promise;
  }

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }

  async function rawFrameCanvas(frame) {
    const image = await loadImage(frame.src);
    const output = makeCanvas(frame.width || image.naturalWidth || image.width, frame.height || image.naturalHeight || image.height);
    output.getContext('2d').drawImage(image, 0, 0, output.width, output.height);
    return output;
  }

  function sourceRegion(canvas) {
    if (!state.selection.active || state.selection.w < .004 || state.selection.h < .004) return { x: 0, y: 0, w: canvas.width, h: canvas.height, full: true };
    return { x: Math.round(state.selection.x * canvas.width), y: Math.round(state.selection.y * canvas.height), w: Math.max(1, Math.round(state.selection.w * canvas.width)), h: Math.max(1, Math.round(state.selection.h * canvas.height)), full: false };
  }

  function drawWithEffects(target, source, effects, dx = 0, dy = 0, width = target.width, height = target.height) {
    const context = target.getContext('2d');
    const brightness = clamp((effects.brightness / 100) * Math.pow(2, effects.exposure / 100), .05, 4);
    context.save();
    context.filter = `brightness(${brightness}) contrast(${effects.contrast / 100}) saturate(${effects.saturation / 100}) hue-rotate(${effects.hue}deg) blur(${effects.blur}px)`;
    context.globalAlpha = effects.opacity / 100;
    context.drawImage(source, dx, dy, width, height);
    context.restore();
    if (effects.temperature || effects.tint) {
      context.save();
      context.globalCompositeOperation = 'source-atop';
      if (effects.temperature > 0) context.fillStyle = `rgba(255,120,35,${effects.temperature / 420})`;
      else if (effects.temperature < 0) context.fillStyle = `rgba(35,150,255,${Math.abs(effects.temperature) / 420})`;
      else context.fillStyle = 'rgba(0,0,0,0)';
      context.fillRect(dx, dy, width, height);
      if (effects.tint) {
        context.fillStyle = effects.tint > 0 ? `rgba(255,35,170,${effects.tint / 500})` : `rgba(35,255,135,${Math.abs(effects.tint) / 500})`;
        context.fillRect(dx, dy, width, height);
      }
      context.restore();
    }
    if (effects.sharpen > 0) sharpenCanvas(target, effects.sharpen);
  }

  function sharpenCanvas(canvas, amount) {
    const context = canvas.getContext('2d');
    if (canvas.width * canvas.height > 1000000) return;
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const source = new Uint8ClampedArray(image.data);
    const factor = amount / 10;
    for (let y = 1; y < canvas.height - 1; y += 1) {
      for (let x = 1; x < canvas.width - 1; x += 1) {
        const index = (y * canvas.width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          const value = source[index + channel] * (1 + 4 * factor) - factor * (source[index - 4 + channel] + source[index + 4 + channel] + source[index - canvas.width * 4 + channel] + source[index + canvas.width * 4 + channel]);
          image.data[index + channel] = clamp(value, 0, 255);
        }
      }
    }
    context.putImageData(image, 0, 0);
  }

  async function editorCanvasContent() {
    const group = activeGroup();
    const frame = activeFrame(group);
    if (!group || !frame) return null;
    const raw = await rawFrameCanvas(frame);
    if (state.mode === 'effects') {
      const preview = makeCanvas(raw.width, raw.height);
      drawWithEffects(preview, raw, state.effectsDraft);
      return preview;
    }
    return raw;
  }

  async function renderEditor() {
    const editor = $('#editor-canvas');
    const frame = activeFrame();
    if (!frame) {
      editor.width = 640; editor.height = 420;
      const context = editor.getContext('2d');
      context.clearRect(0, 0, editor.width, editor.height);
      context.fillStyle = '#75b2de'; context.font = '16px Geist Mono, monospace'; context.textAlign = 'center'; context.fillText('SELECT A FRAME TO BEGIN', editor.width / 2, editor.height / 2);
      updateSelectionBox();
      return;
    }
    const content = await editorCanvasContent();
    if (!content || frame !== activeFrame()) return;
    editor.width = content.width; editor.height = content.height;
    editor.getContext('2d').drawImage(content, 0, 0);
    applyGridBackground();
    updateSelectionBox();
  }

  function applyGridBackground() {
    const wrap = $('#canvas-wrap');
    if (!state.grid) { wrap.style.backgroundImage = ''; return; }
    const cells = Math.max(2, 10 * state.gridSize);
    wrap.style.backgroundImage = `linear-gradient(rgba(117,178,222,.32) 1px, transparent 1px),linear-gradient(90deg,rgba(117,178,222,.32) 1px,transparent 1px),repeating-conic-gradient(#151613 0 25%,#0e0f0d 0 50%)`;
    wrap.style.backgroundSize = `${cells}px ${cells}px,${cells}px ${cells}px,22px 22px`;
  }

  function updateSelectionBox() {
    const box = $('#selection-box');
    const canvas = $('#editor-canvas');
    const wrap = $('#canvas-wrap');
    const selection = state.selection;
    const rect = canvas.getBoundingClientRect();
    const container = wrap.getBoundingClientRect();
    const selected = selection.active && selection.w > .004 && selection.h > .004;
    box.hidden = !selected;
    if (!selected) return;
    box.style.left = `${rect.left - container.left + rect.width * selection.x}px`;
    box.style.top = `${rect.top - container.top + rect.height * selection.y}px`;
    box.style.width = `${rect.width * selection.w}px`;
    box.style.height = `${rect.height * selection.h}px`;
  }

  async function saveEditorCanvas() {
    const group = activeGroup(); const frame = activeFrame(group); const editor = $('#editor-canvas');
    if (!group || !frame) return;
    frame.src = editor.toDataURL('image/png'); frame.width = editor.width; frame.height = editor.height;
    state.imageCache.delete(frame.src);
    renderAll();
  }

  function pointerPosition(event) {
    const rect = $('#editor-canvas').getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
  }

  function paintPosition(event) {
    const rect = $('#editor-canvas').getBoundingClientRect();
    const canvas = $('#editor-canvas');
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }

  function bindCanvas() {
    const canvas = $('#editor-canvas');
    canvas.addEventListener('pointerdown', (event) => {
      if (!activeFrame()) return;
      if (state.mode === 'select' && state.selectionEnabled) {
        event.preventDefault();
        const point = pointerPosition(event); const selection = state.selection;
        selection.dragging = true; canvas.setPointerCapture(event.pointerId);
        const inside = selection.active && point.x >= selection.x && point.x <= selection.x + selection.w && point.y >= selection.y && point.y <= selection.y + selection.h;
        if (inside) { selection.mode = 'move'; selection.lastX = point.x; selection.lastY = point.y; }
        else { selection.mode = 'create'; selection.active = true; selection.startX = point.x; selection.startY = point.y; selection.x = point.x; selection.y = point.y; selection.w = 0; selection.h = 0; }
        updateSelectionBox();
      }
      if (state.mode === 'paint') {
        event.preventDefault(); state.painting = true; canvas.setPointerCapture(event.pointerId); state.paintLast = paintPosition(event);
        const context = canvas.getContext('2d'); context.strokeStyle = $('#paint-colour').value; context.lineWidth = Number($('#paint-size').value); context.lineCap = 'round'; context.lineJoin = 'round'; context.beginPath(); context.moveTo(state.paintLast.x, state.paintLast.y);
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      if (state.selection.dragging && state.mode === 'select') {
        const point = pointerPosition(event); const selection = state.selection;
        if (selection.mode === 'move') { selection.x = clamp(selection.x + point.x - selection.lastX, 0, 1 - selection.w); selection.y = clamp(selection.y + point.y - selection.lastY, 0, 1 - selection.h); selection.lastX = point.x; selection.lastY = point.y; }
        else { selection.x = Math.min(selection.startX, point.x); selection.y = Math.min(selection.startY, point.y); selection.w = Math.abs(point.x - selection.startX); selection.h = Math.abs(point.y - selection.startY); }
        updateSelectionBox();
      }
      if (state.painting && state.mode === 'paint') {
        const point = paintPosition(event); const context = canvas.getContext('2d'); context.lineTo(point.x, point.y); context.stroke(); state.paintLast = point;
      }
    });
    const finish = async (event) => {
      if (state.selection.dragging) { state.selection.dragging = false; canvas.releasePointerCapture?.(event.pointerId); if (state.selection.w < .004 || state.selection.h < .004) state.selection.active = false; updateSelectionBox(); }
      if (state.painting) { state.painting = false; canvas.releasePointerCapture?.(event.pointerId); await saveEditorCanvas(); }
    };
    canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish);
  }

  async function clipboardImage() {
    if (!navigator.clipboard?.read) throw new Error('Clipboard image access is unavailable in this browser.');
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((entry) => entry.startsWith('image/'));
      if (type) return { blob: await item.getType(type), type };
    }
    throw new Error('No image was found in the clipboard.');
  }

  async function copyFrame() {
    const frame = activeFrame(); if (!frame) return;
    const source = await rawFrameCanvas(frame); const region = sourceRegion(source); const output = makeCanvas(region.w, region.h); output.getContext('2d').drawImage(source, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
    output.toBlob(async (blob) => {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); status('FRAME COPIED TO CLIPBOARD'); } catch { status('BROWSER BLOCKED CLIPBOARD WRITE'); }
    }, 'image/png');
  }

  async function pasteIntoFrame() {
    try {
      const { blob } = await clipboardImage(); const url = URL.createObjectURL(blob); const image = await loadImage(url); URL.revokeObjectURL(url);
      const frame = activeFrame(); if (!frame) return; const source = await rawFrameCanvas(frame); const region = sourceRegion(source); const context = source.getContext('2d'); context.clearRect(region.x, region.y, region.w, region.h); context.drawImage(image, region.x, region.y, region.w, region.h); frame.src = source.toDataURL('image/png'); frame.width = source.width; frame.height = source.height; status(region.full ? 'CLIPBOARD IMAGE PASTED INTO FRAME' : 'CLIPBOARD IMAGE PASTED INTO SELECTION'); renderAll();
    } catch (error) { status(error.message.toUpperCase()); }
  }

  async function pasteAsNewFrame() {
    try {
      const { blob, type } = await clipboardImage(); const file = new File([blob], `pasted-frame-${Date.now()}.${type.split('/')[1]}`, { type }); const frame = await fileToFrame(file, 0); const group = activeGroup(); if (!group) return; const current = activeFrame(group); const index = Math.max(0, group.frames.findIndex((entry) => entry.id === current?.id)); group.frames.splice(index + 1, 0, frame); state.activeFrameByGroup[group.id] = frame.id; status('CLIPBOARD IMAGE INSERTED AS NEW FRAME'); renderAll();
    } catch (error) { status(error.message.toUpperCase()); }
  }

  async function clearFrame() {
    const frame = activeFrame(); if (!frame) return; const source = await rawFrameCanvas(frame); const region = sourceRegion(source); source.getContext('2d').clearRect(region.x, region.y, region.w, region.h); frame.src = source.toDataURL('image/png'); frame.width = source.width; frame.height = source.height; status(region.full ? 'CURRENT FRAME CLEARED' : 'SELECTION CLEARED'); renderAll();
  }

  function transformCanvas(base, type, value) {
    const output = makeCanvas(base.width, base.height); output.getContext('2d').drawImage(base, 0, 0); const region = sourceRegion(output); const crop = makeCanvas(region.w, region.h); crop.getContext('2d').drawImage(base, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
    const context = output.getContext('2d'); context.save(); context.beginPath(); context.rect(region.x, region.y, region.w, region.h); context.clip(); context.clearRect(region.x, region.y, region.w, region.h); context.translate(region.x + region.w / 2, region.y + region.h / 2); if (type === 'scale') context.scale(value / 100, value / 100); else context.rotate(value * Math.PI / 180); context.drawImage(crop, -region.w / 2, -region.h / 2); context.restore(); return output;
  }

  async function openTransform(type) {
    const frame = activeFrame(); if (!frame) return; const base = await rawFrameCanvas(frame); state.transform = { type, base, groupId: activeGroup().id, frameId: frame.id }; const slider = $('#transform-slider'); $('#transform-control').hidden = false;
    if (type === 'scale') { $('#transform-title').textContent = state.selection.active ? 'SCALE SELECTION' : 'SCALE FRAME'; slider.min = '10'; slider.max = '300'; slider.value = '100'; $('#transform-value').textContent = '100%'; }
    else { $('#transform-title').textContent = state.selection.active ? 'ROTATE SELECTION' : 'ROTATE FRAME'; slider.min = '-180'; slider.max = '180'; slider.value = '0'; $('#transform-value').textContent = '0°'; }
    previewTransform();
  }

  function previewTransform() {
    if (!state.transform) return; const value = Number($('#transform-slider').value); $('#transform-value').textContent = state.transform.type === 'scale' ? `${value}%` : `${value}°`; const preview = transformCanvas(state.transform.base, state.transform.type, value); const editor = $('#editor-canvas'); editor.width = preview.width; editor.height = preview.height; editor.getContext('2d').drawImage(preview, 0, 0); updateSelectionBox();
  }

  function closeTransform(apply) {
    if (!state.transform) return; const transform = state.transform; if (apply) { const frame = state.groups.find((group) => group.id === transform.groupId)?.frames.find((entry) => entry.id === transform.frameId); if (frame) { const output = transformCanvas(transform.base, transform.type, Number($('#transform-slider').value)); frame.src = output.toDataURL('image/png'); frame.width = output.width; frame.height = output.height; status(transform.type === 'scale' ? 'SCALE APPLIED' : 'ROTATION APPLIED'); } }
    state.transform = null; $('#transform-control').hidden = true; renderAll();
  }

  function setMode(mode) { if (state.transform) closeTransform(false); state.mode = mode; if (mode === 'effects') state.effectsDraft = copy(activeGroup()?.effects || defaultEffects()); renderAll(); }

  function applyEffects() {
    const targets = [...state.effectTargets]; if (!targets.length) return; targets.forEach((groupId) => { const group = state.groups.find((entry) => entry.id === groupId); if (group) group.effects = copy(state.effectsDraft); }); status(`EFFECTS APPLIED TO ${targets.length} GROUP${targets.length === 1 ? '' : 'S'}`); renderAll();
  }

  function resetEffects() { state.effectsDraft = defaultEffects(); renderEffectControls(); renderEditor(); }

  function deterministicNoise(index) { return Math.sin(index * 12.9898) * 43758.5453 % 1; }

  async function generateAnimationFrames(sourceFrame, type, strength, duration) {
    const source = await rawFrameCanvas(sourceFrame); const results = [];
    for (let index = 1; index <= duration; index += 1) {
      const t = index / duration; const wave = Math.sin(t * Math.PI * 2); const output = makeCanvas(source.width, source.height); const context = output.getContext('2d'); context.save(); context.translate(output.width / 2, output.height / 2);
      let scale = 1; let rotation = 0; let alpha = 1; let x = 0; let y = 0; let filter = 'none';
      if (type === 'pulse-brightness') filter = `brightness(${1 + wave * strength / 10})`;
      if (type === 'pulse-size') scale = 1 + wave * strength / 25;
      if (type === 'rotate') rotation = t * Math.PI * 2 * strength / 10;
      if (type === 'hue-shift') filter = `hue-rotate(${t * strength * 36}deg)`;
      if (type === 'opacity-pulse') alpha = clamp(1 - strength / 16 + wave * strength / 16, .1, 1);
      if (type === 'float') y = wave * strength * 2;
      if (type === 'shake') { x = (deterministicNoise(index * 4) - .5) * strength * 3; y = (deterministicNoise(index * 7) - .5) * strength * 3; }
      if (type === 'breathing') { scale = 1 + wave * strength / 36; alpha = clamp(1 - strength / 28 + wave * strength / 28, .25, 1); }
      if (type === 'motion-trail' && index > 1) { context.globalAlpha = strength / 24; context.drawImage(source, -source.width / 2 - strength * 2, -source.height / 2); }
      context.filter = filter; context.globalAlpha = alpha; context.rotate(rotation); context.scale(scale, scale); context.drawImage(source, -source.width / 2 + x, -source.height / 2 + y); context.restore();
      results.push({ id: uid('frame'), name: `${animationLabels[type]} ${index}/${duration}`, src: output.toDataURL('image/png'), width: output.width, height: output.height });
    }
    return results;
  }

  function insertGroupAtLayer(group) {
    state.groups.forEach((entry) => { if (entry.layer >= group.layer) entry.layer += 1; }); state.groups.push(group); normaliseLayers();
  }

  async function generateAnimation() {
    const type = $('#animation-type').value; if (type === 'overlay-layer') return; const strength = Number($('#animation-strength').value); const duration = Number($('#animation-duration').value); const targetIds = [...state.animationTargets]; if (!targetIds.length) return;
    const framesBefore = totalFrames(); status('GENERATING NEW FRAMES...');
    for (const groupId of targetIds) {
      const group = state.groups.find((entry) => entry.id === groupId); if (!group || !group.frames.length) continue;
      const source = activeFrame(group) || group.frames[0]; const generated = await generateAnimationFrames(source, type, strength, duration);
      if (framesBefore === 1 && targetIds.length === 1) {
        group.frames = [source, ...generated]; state.activeGroupId = group.id; state.activeFrameByGroup[group.id] = source.id;
      } else {
        group.frames = group.frames.filter((frame) => frame.id !== source.id);
        const newGroup = { id: uid('group'), name: `${group.name} — ${animationLabels[type]}`, blend: group.blend, layer: group.layer, effects: copy(group.effects), frames: [source, ...generated] };
        insertGroupAtLayer(newGroup); state.activeGroupId = newGroup.id; state.activeFrameByGroup[newGroup.id] = source.id;
      }
    }
    state.animationTargets = new Set([state.activeGroupId]); status('ANIMATION FRAMES GENERATED'); renderAll();
  }

  async function groupFrameCanvas(group, index) {
    const frame = group.frames[index % group.frames.length]; const source = await rawFrameCanvas(frame); const output = makeCanvas(source.width, source.height); drawWithEffects(output, source, group.effects); return output;
  }

  async function compositeFrame(index) {
    const validGroups = state.groups.filter((group) => group.frames.length); if (!validGroups.length) return null;
    const sourceFrames = await Promise.all(validGroups.map((group) => rawFrameCanvas(group.frames[index % group.frames.length])));
    const width = Math.max(...sourceFrames.map((canvas) => canvas.width)); const height = Math.max(...sourceFrames.map((canvas) => canvas.height)); const output = makeCanvas(width, height); const ordered = [...validGroups].sort((a,b) => b.layer - a.layer);
    for (const group of ordered) {
      const frameCanvas = await groupFrameCanvas(group, index); const context = output.getContext('2d'); context.save(); context.globalCompositeOperation = group.blend; context.drawImage(frameCanvas, (width - frameCanvas.width) / 2, (height - frameCanvas.height) / 2); context.restore();
    }
    const max = Number($('#output-size').value); if (Math.max(width, height) > max) { const scale = max / Math.max(width, height); const resized = makeCanvas(width * scale, height * scale); resized.getContext('2d').drawImage(output, 0, 0, resized.width, resized.height); return resized; }
    return output;
  }

  function blendCanvases(first, second, amount) { const output = makeCanvas(Math.max(first.width, second.width), Math.max(first.height, second.height)); const context = output.getContext('2d'); context.globalAlpha = 1 - amount; context.drawImage(first, 0, 0, output.width, output.height); context.globalAlpha = amount; context.drawImage(second, 0, 0, output.width, output.height); return output; }
  function alphaCanvas(source, alpha) { const output = makeCanvas(source.width, source.height); const context = output.getContext('2d'); context.globalAlpha = alpha; context.drawImage(source, 0, 0); return output; }

  function applyFinalEffects(frames) {
    let output = [...frames]; const between = Number($('#final-inbetweens').value);
    if (between && output.length > 1) { const smooth = []; for (let index = 0; index < output.length - 1; index += 1) { smooth.push(output[index]); for (let step = 1; step <= between; step += 1) smooth.push(blendCanvases(output[index], output[index + 1], step / (between + 1))); } smooth.push(output[output.length - 1]); output = smooth; }
    const level = Number($('#final-fade-level').value);
    if ($('#final-fade-in').checked && output.length) output = [...Array.from({length:level}, (_, index) => alphaCanvas(output[0], (index + 1) / level)), ...output.slice(1)];
    if ($('#final-fade-out').checked && output.length) output = [...output.slice(0,-1), ...Array.from({length:level}, (_, index) => alphaCanvas(output[output.length - 1], 1 - index / Math.max(1, level - 1)))];
    return output;
  }

  async function outputFrames() {
    const count = Math.max(0, ...state.groups.map((group) => group.frames.length)); if (!count) return [];
    let indices = Array.from({length:count}, (_, index) => index); if ($('#reverse-output').checked) indices = indices.reverse(); if ($('#forverse-output').checked) indices = [...indices, ...[...indices].reverse()]; const frames = [];
    for (const index of indices) { const frame = await compositeFrame(index); if (frame) frames.push(frame); }
    return applyFinalEffects(frames);
  }

  function stopPreview() { state.previewToken += 1; if (state.previewTimer) clearTimeout(state.previewTimer); state.previewTimer = null; }

  async function previewOutput() {
    stopPreview(); const token = ++state.previewToken; status('BUILDING PREVIEW...'); const frames = await outputFrames(); if (!frames.length) { status('LOAD FRAMES FIRST'); return; } const image = $('#preview-image'); const empty = $('#preview-empty'); image.hidden = false; empty.hidden = true; const delay = Math.max(20, Number($('#frame-delay').value) * Math.max(1, Math.max(0, ...state.groups.map((g) => g.frames.length))) / frames.length); let cursor = 0;
    const tick = () => { if (token !== state.previewToken) return; image.src = frames[cursor].toDataURL('image/png'); cursor = (cursor + 1) % frames.length; state.previewTimer = setTimeout(tick, delay); };
    tick(); status(`${frames.length} COMPOSITE FRAMES PREVIEWING`);
  }

  function loadScript(url) { return new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = url; script.onload = resolve; script.onerror = reject; document.head.append(script); }); }
  let libsReady = null;
  function ensureLibs() { if (!libsReady) libsReady = Promise.all([window.gifshot ? Promise.resolve() : loadScript('https://cdnjs.cloudflare.com/ajax/libs/gifshot/0.4.5/gifshot.min.js'), window.JSZip ? Promise.resolve() : loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')]); return libsReady; }

  const encoder = new TextEncoder();
  const fourCC = (name) => encoder.encode(name);
  const u16 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255]);
  const u24 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255]);
  const u32 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
  const concat = (parts) => { const length = parts.reduce((sum, part) => sum + part.length, 0); const output = new Uint8Array(length); let offset = 0; parts.forEach((part) => { output.set(part, offset); offset += part.length; }); return output; };
  const riffChunk = (name, payload) => concat([fourCC(name), u32(payload.length), payload, payload.length % 2 ? new Uint8Array([0]) : new Uint8Array()]);
  const textAt = (bytes, offset) => String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  const readU32 = (bytes, offset) => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;

  async function canvasWebPPayload(canvas, quality) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality)); if (!blob || blob.type !== 'image/webp') throw new Error('Browser WebP encoding is unavailable.'); const bytes = new Uint8Array(await blob.arrayBuffer()); if (textAt(bytes, 0) !== 'RIFF' || textAt(bytes, 8) !== 'WEBP') throw new Error('Browser returned invalid WebP data.');
    const chunks = []; let offset = 12; while (offset + 8 <= bytes.length) { const name = textAt(bytes, offset); const size = readU32(bytes, offset + 4); const end = offset + 8 + size; chunks.push({name, raw: bytes.slice(offset, end + size % 2)}); offset = end + size % 2; }
    const imageChunks = chunks.filter((chunk) => ['ALPH','VP8 ','VP8L'].includes(chunk.name)); return { payload: concat(imageChunks.map((chunk) => chunk.raw)), alpha: imageChunks.some((chunk) => chunk.name === 'ALPH' || chunk.name === 'VP8L') };
  }

  async function animatedWebP(frames, duration, quality) {
    const width = frames[0].width; const height = frames[0].height; const encoded = []; let alpha = false;
    for (const frame of frames) { const item = await canvasWebPPayload(frame, quality); encoded.push(item); alpha ||= item.alpha; }
    const vp8x = new Uint8Array(10); vp8x[0] = 0x02 | (alpha ? 0x10 : 0); vp8x.set(u24(width - 1),4); vp8x.set(u24(height - 1),7);
    const anim = concat([new Uint8Array([0,0,0,0]),u16(0)]); const chunks = encoded.map((item) => { const header = concat([u24(0),u24(0),u24(width - 1),u24(height - 1),u24(duration),new Uint8Array([0x02])]); return riffChunk('ANMF',concat([header,item.payload])); });
    const payload = concat([fourCC('WEBP'),riffChunk('VP8X',vp8x),riffChunk('ANIM',anim),...chunks]); return new Blob([concat([fourCC('RIFF'),u32(payload.length),payload])],{type:'image/webp'});
  }

  function safeFileName() { return ($('#export-name').value.trim() || 'animation-export').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-'); }
  function saveBlob(blob, name) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }

  async function exportOutput() {
    stopPreview(); status('PREPARING EXPORT...'); const frames = await outputFrames(); if (frames.length < 1) { status('LOAD FRAMES FIRST'); return; } const format = $('#output-format').value; const baseDelay = Number($('#frame-delay').value); const duration = Math.max(11, Math.round(baseDelay * Math.max(1, Math.max(0, ...state.groups.map((group) => group.frames.length))) / frames.length));
    try {
      if (format === 'zip') { await ensureLibs(); const zip = new JSZip(); const folder = zip.folder(`${safeFileName()}-frames`); const digits = Math.max(3,String(frames.length).length); for (let index = 0; index < frames.length; index += 1) { const blob = await new Promise((resolve) => frames[index].toBlob(resolve,'image/png')); folder.file(`frame-${String(index + 1).padStart(digits,'0')}.png`,blob); } saveBlob(await zip.generateAsync({type:'blob'}),`${safeFileName()}-frames.zip`); status('PNG FRAME ZIP SAVED'); return; }
      if (format === 'webp') { const blob = await animatedWebP(frames,duration,Number($('#webp-quality').value)/100); saveBlob(blob,`${safeFileName()}.webp`); status('ANIMATED WEBP SAVED'); return; }
      await ensureLibs(); const images = frames.map((frame) => frame.toDataURL('image/png')); gifshot.createGIF({ images, interval: duration / 1000, gifWidth: frames[0].width, gifHeight: frames[0].height, sampleInterval: 10, numWorkers: 2 }, (result) => { if (result.error) { status('GIF EXPORT FAILED'); return; } const binary = atob(result.image.split(',')[1]); const bytes = new Uint8Array(binary.length); for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index); saveBlob(new Blob([bytes],{type:'image/gif'}),`${safeFileName()}.gif`); status('GIF SAVED'); });
    } catch (error) { status(`EXPORT ERROR: ${error.message.toUpperCase()}`); }
  }

  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
  function escapeAttr(value) { return escapeHtml(value); }

  function renderAll() {
    normaliseLayers(); renderGroups(); renderUploadSelector(); updateEditorReadout(); renderMode(); renderEditor();
  }

  function bind() {
    $('#standard-mode').addEventListener('click', () => { location.href = '../animation-maker-standard/index.html'; });
    ['new-group-header','create-group-upload','create-group-main'].forEach((id) => $("#" + id).addEventListener('click', () => { const group = createGroup(); state.effectTargets = new Set([group.id]); state.animationTargets = new Set([group.id]); status(`${group.name.toUpperCase()} CREATED`); renderAll(); }));
    $('#top-file-input').addEventListener('change', (event) => addFiles(event.target.files, $('#upload-group-select').value));
    $('#upload-group-select').addEventListener('change', () => setActiveGroup($('#upload-group-select').value));
    const dropzone = $('#top-dropzone'); ['dragenter','dragover'].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); event.stopPropagation(); dropzone.classList.add('dragover'); })); ['dragleave','drop'].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); event.stopPropagation(); dropzone.classList.remove('dragover'); })); dropzone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files, $('#upload-group-select').value));
    $('#editor-mode-tabs').addEventListener('click', (event) => { const button = event.target.closest('[data-mode]'); if (button) setMode(button.dataset.mode); });
    ['brightness','contrast','exposure','hue','saturation','temperature','tint','opacity','blur','sharpen'].forEach((key) => $(`#effect-${key}`).addEventListener('input', (event) => { state.effectsDraft[key] = Number(event.target.value); $(`#effect-${key}-output`).textContent = effectOutput(key,state.effectsDraft[key]); renderEditor(); }));
    $('#effects-reset').addEventListener('click', resetEffects); $('#apply-effects').addEventListener('click', applyEffects);
    $('#animation-strength').addEventListener('input', (event) => $('#animation-strength-output').textContent = event.target.value); $('#animation-duration').addEventListener('input', (event) => $('#animation-duration-output').textContent = `${event.target.value} frames`); $('#generate-animation').addEventListener('click', generateAnimation);
    $('#paint-size').addEventListener('input', (event) => $('#paint-size-output').textContent = `${event.target.value} px`);
    $('#selection-toggle').addEventListener('click', () => { state.selectionEnabled = !state.selectionEnabled; $('#selection-toggle').classList.toggle('active', state.selectionEnabled); $('#selection-toggle').textContent = state.selectionEnabled ? 'DRAW / MOVE SELECTION' : 'SELECTION OFF'; }); $('#selection-clear').addEventListener('click', () => { state.selection.active = false; updateSelectionBox(); });
    $('#edit-copy').addEventListener('click', copyFrame); $('#edit-paste').addEventListener('click', pasteIntoFrame); $('#edit-paste-new').addEventListener('click', pasteAsNewFrame); $('#edit-clear').addEventListener('click', clearFrame); $('#edit-scale').addEventListener('click', () => openTransform('scale')); $('#edit-rotate').addEventListener('click', () => openTransform('rotate'));
    $('#transform-slider').addEventListener('input', previewTransform); $('#transform-apply').addEventListener('click', () => closeTransform(true)); $('#transform-cancel').addEventListener('click', () => closeTransform(false));
    $('#toggle-grid').addEventListener('click', () => { state.grid = !state.grid; $('#toggle-grid').classList.toggle('active', state.grid); applyGridBackground(); }); $('#grid-size').addEventListener('click', () => { state.gridSize = state.gridSize === 10 ? 1 : state.gridSize + 1; $('#grid-size').textContent = `GRID SIZE ${state.gridSize}×`; applyGridBackground(); });
    $('#editor-prev').addEventListener('click', () => moveFrame(-1)); $('#editor-next').addEventListener('click', () => moveFrame(1));
    $('#frame-delay').addEventListener('input', (event) => $('#frame-delay-output').textContent = `${event.target.value} ms`); $('#output-size').addEventListener('input', (event) => $('#output-size-output').textContent = `${event.target.value} px`); $('#final-fade-level').addEventListener('input', (event) => $('#final-fade-level-output').textContent = event.target.value);
    ['preview-output','bottom-preview'].forEach((id) => $("#" + id).addEventListener('click', previewOutput)); ['export-output','bottom-export'].forEach((id) => $("#" + id).addEventListener('click', exportOutput));
    bindCanvas(); window.addEventListener('resize', updateSelectionBox);
  }

  function moveFrame(delta) { const group = activeGroup(); if (!group?.frames.length) return; const index = Math.max(0, group.frames.findIndex((frame) => frame.id === activeFrame(group)?.id)); const next = (index + delta + group.frames.length) % group.frames.length; state.activeFrameByGroup[group.id] = group.frames[next].id; renderAll(); }

  createGroup('Group 1');
  state.effectTargets.add(state.activeGroupId); state.animationTargets.add(state.activeGroupId);
  bind(); renderAll();
})();
