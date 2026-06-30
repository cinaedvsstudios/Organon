(() => {
  'use strict';

  if (!document.body.classList.contains('is-advanced-mode')) return;

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, host = document) => [...host.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const makeCanvas = (width, height = width) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  };

  const elements = {
    top: $('top-panel'),
    queue: $('queue-card'),
    grid: $('frame-grid'),
    imagePicker: $('image-picker'),
    videoPicker: $('video-picker'),
    name: $('seq-name'),
    editorModal: $('frame-editor-modal'),
    editorWindow: $('editor-window'),
    editorCanvas: $('frame-editor-canvas'),
    viewport: $('canvas-viewport'),
    output: $('output-card'),
    outputViewport: $('compiled-viewport'),
    previewModal: $('preview-modal'),
    previewImage: $('modal-img'),
    animationModal: $('anim-preview-modal'),
    animationImage: $('anim-modal-img'),
    animationLoading: $('anim-loading'),
    alignModal: $('align-modal'),
    alignCanvas: $('align-canvas')
  };

  if (Object.values(elements).some((value) => !value)) return;

  const blendModes = [
    ['source-over', 'Normal'], ['darken', 'Darken'], ['multiply', 'Multiply'], ['color-burn', 'Color Burn'],
    ['lighten', 'Lighten'], ['screen', 'Screen'], ['color-dodge', 'Color Dodge'], ['overlay', 'Overlay'],
    ['soft-light', 'Soft Light'], ['hard-light', 'Hard Light'], ['difference', 'Difference'], ['exclusion', 'Exclusion'],
    ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity']
  ];

  const animationNames = {
    'pulse-brightness': 'Pulse Brightness',
    'pulse-size': 'Pulse Size',
    rotate: 'Rotate',
    'hue-shift': 'Hue Shift',
    'opacity-pulse': 'Opacity Pulse',
    float: 'Float Bob',
    shake: 'Shake Jitter',
    breathing: 'Breathing',
    'motion-trail': 'Motion Trail'
  };

  const effectFields = [
    ['brightness', 'Brightness', 0, 200, 100],
    ['contrast', 'Contrast', 0, 200, 100],
    ['exposure', 'Exposure', -100, 100, 0],
    ['hue', 'Hue', -180, 180, 0],
    ['saturation', 'Saturation', 0, 200, 100],
    ['temperature', 'Temperature', -100, 100, 0],
    ['tint', 'Tint', -100, 100, 0],
    ['opacity', 'Opacity', 0, 100, 100],
    ['blur', 'Blur', 0, 20, 0],
    ['sharpen', 'Sharpen', 0, 10, 0],
    ['grayscale', 'Grayscale', 0, 100, 0],
    ['sepia', 'Sepia', 0, 100, 0],
    ['invert', 'Invert', 0, 100, 0]
  ];

  const defaultEffects = () => ({
    brightness: 100, contrast: 100, exposure: 0, hue: 0, saturation: 100,
    temperature: 0, tint: 0, opacity: 100, blur: 0, sharpen: 0,
    grayscale: 0, sepia: 0, invert: 0
  });

  const state = {
    groups: [],
    activeGroupId: null,
    activeFrameId: null,
    editorMode: 'edit',
    editorView: 'final',
    editorIndex: 0,
    displayToken: 0,
    effectsDraft: defaultEffects(),
    effectTargets: new Set(),
    animationTargets: new Set(),
    editBuffer: null,
    selection: { active: false, enabled: true, dragging: false, mode: 'create', x: 0, y: 0, w: 0, h: 0, startX: 0, startY: 0, lastX: 0, lastY: 0 },
    brush: { painting: false, erasing: false, color: '#00ff00', size: 18 },
    transform: null,
    playbackTimer: null,
    previewTimer: null,
    previewToken: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    align: null,
    cache: new Map(),
    history: [],
    historyCursor: -1
  };

  const notify = (message) => {
    try { window.parent.postMessage({ type: 'set-status', text: message }, '*'); } catch (error) {}
    window.setTimeout(() => { try { window.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {} }, 3500);
  };

  const getDimension = () => Number($('max-dimension')?.value || 480);
  const safeName = () => ((elements.name?.value || 'animation-export').trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-') || 'animation-export');
  const activeGroup = () => state.groups.find((group) => group.id === state.activeGroupId) || state.groups[0] || null;
  const activeFrame = (group = activeGroup()) => group?.frames.find((frame) => frame.id === state.activeFrameId) || group?.frames[0] || null;
  const groupById = (id) => state.groups.find((group) => group.id === id) || null;
  const totalFrames = () => state.groups.reduce((total, group) => total + group.frames.length, 0);

  function createGroup(name, config = {}) {
    const group = {
      id: uid('group'),
      name: name || `Group ${state.groups.length + 1}`,
      layer: config.layer || state.groups.length + 1,
      blend: config.blend || 'source-over',
      effects: copy(config.effects || defaultEffects()),
      frames: config.frames || []
    };
    state.groups.push(group);
    state.activeGroupId = group.id;
    state.activeFrameId = group.frames[0]?.id || null;
    normalizeLayers();
    return group;
  }

  function normalizeLayers() {
    state.groups.sort((first, second) => first.layer - second.layer || first.name.localeCompare(second.name));
    state.groups.forEach((group, index) => { group.layer = index + 1; });
  }

  function setActive(groupId, frameId) {
    const group = groupById(groupId);
    if (!group) return;
    state.activeGroupId = group.id;
    state.activeFrameId = frameId || group.frames.find((frame) => frame.id === state.activeFrameId)?.id || group.frames[0]?.id || null;
    state.editorIndex = Math.max(0, group.frames.findIndex((frame) => frame.id === state.activeFrameId));
    state.effectsDraft = copy(group.effects);
    state.effectTargets.add(group.id);
    state.animationTargets.add(group.id);
    state.editBuffer = null;
    renderAll();
  }

  function moveLayer(groupId, wantedLayer) {
    const group = groupById(groupId);
    if (!group) return;
    const ordered = [...state.groups].sort((first, second) => first.layer - second.layer);
    const from = ordered.indexOf(group);
    const to = clamp(Number(wantedLayer) - 1, 0, ordered.length - 1);
    ordered.splice(from, 1);
    ordered.splice(to, 0, group);
    ordered.forEach((entry, index) => { entry.layer = index + 1; });
    renderAll();
  }

  function imagePromise(source) {
    if (state.cache.has(source)) return state.cache.get(source);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to load image data.'));
      image.src = source;
    });
    state.cache.set(source, promise);
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

  async function makeFrames(files) {
    const frames = [];
    for (const file of [...files].filter((entry) => entry.type.startsWith('image/'))) {
      const source = await readFile(file);
      const image = await imagePromise(source);
      frames.push({ id: uid('frame'), name: file.name, source, originalSource: source, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, x: 0, y: 0 });
    }
    return frames;
  }

  async function importImages(files, targetId = state.activeGroupId) {
    const sourceFiles = [...files].filter((file) => file.type.startsWith('image/'));
    if (!sourceFiles.length) { notify('No image files were found.'); return; }
    let group = groupById(targetId);
    if (!group) group = createGroup('Group 1');
    notify(`Importing ${sourceFiles.length} image${sourceFiles.length === 1 ? '' : 's'} into ${group.name}...`);
    const frames = await makeFrames(sourceFiles);
    group.frames.push(...frames);
    state.activeGroupId = group.id;
    state.activeFrameId = frames[0]?.id || state.activeFrameId;
    state.editBuffer = null;
    state.effectTargets.add(group.id);
    state.animationTargets.add(group.id);
    if (totalFrames() === frames.length && elements.name) elements.name.value = sourceFiles[0].name.replace(/\.[^.]+$/, '') || 'animation-export';
    notify(`${frames.length} frame${frames.length === 1 ? '' : 's'} added to ${group.name}.`);
    renderAll();
  }

  async function importVideo(file) {
    if (!file) return;
    const group = activeGroup() || createGroup('Group 1');
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;
    try {
      await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; video.load(); });
      const fps = 12;
      const count = Math.max(1, Math.min(240, Math.floor(video.duration * fps)));
      const capture = makeCanvas(video.videoWidth, video.videoHeight);
      const context = capture.getContext('2d');
      const frames = [];
      notify(`Extracting ${count} video frames into ${group.name}...`);
      for (let index = 0; index < count; index += 1) {
        await new Promise((resolve) => { video.onseeked = resolve; video.currentTime = Math.min(index / fps, Math.max(0, video.duration - .01)); });
        context.clearRect(0, 0, capture.width, capture.height);
        context.drawImage(video, 0, 0);
        const source = capture.toDataURL('image/png');
        frames.push({ id: uid('frame'), name: `${file.name} ${index + 1}`, source, originalSource: source, width: capture.width, height: capture.height, x: 0, y: 0 });
      }
      group.frames.push(...frames);
      state.activeGroupId = group.id;
      state.activeFrameId = frames[0]?.id || state.activeFrameId;
      state.editBuffer = null;
      renderAll();
      notify(`${frames.length} video frames added to ${group.name}.`);
    } catch (error) {
      notify('Video extraction failed.');
    } finally {
      URL.revokeObjectURL(videoUrl);
      video.remove();
    }
  }

  function globalAdjustments() {
    return {
      brightness: Number($('adj-bright')?.value || 100),
      contrast: Number($('adj-contrast')?.value || 100),
      exposure: Number($('adj-exp')?.value || 100),
      saturation: Number($('adj-sat')?.value || 100),
      chroma: Boolean($('chk-transparent')?.checked),
      chromaColor: $('adj-color')?.value || '#ffffff',
      tolerance: Number($('adj-tol')?.value || 20),
      smoothing: Number($('adj-smooth')?.value || 15),
      shadow: Boolean($('chk-shadow')?.checked),
      shadowColor: $('shadow-color')?.value || '#000000',
      shadowOpacity: Number($('shadow-opacity')?.value || 35),
      shadowBlur: Number($('shadow-blur')?.value || 10),
      shadowX: Number($('shadow-x')?.value || 0),
      shadowY: Number($('shadow-y')?.value || 5)
    };
  }

  function hexToRgb(value) {
    const number = parseInt(String(value || '#000000').replace('#', ''), 16);
    return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
  }

  function chromaKey(canvas, color, tolerance, smoothing) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    const target = hexToRgb(color);
    for (let index = 0; index < data.data.length; index += 4) {
      if (!data.data[index + 3]) continue;
      const distance = Math.hypot(data.data[index] - target.r, data.data[index + 1] - target.g, data.data[index + 2] - target.b);
      if (distance <= tolerance) data.data[index + 3] = 0;
      else if (smoothing && distance < tolerance + smoothing) data.data[index + 3] = Math.round(data.data[index + 3] * (distance - tolerance) / smoothing);
    }
    context.putImageData(data, 0, 0);
  }

  function colourOverlay(canvas, effects) {
    if (!effects.temperature && !effects.tint) return;
    const context = canvas.getContext('2d');
    context.save();
    context.globalCompositeOperation = 'source-atop';
    if (effects.temperature) {
      context.fillStyle = effects.temperature > 0 ? `rgba(255,120,35,${Math.abs(effects.temperature) / 420})` : `rgba(35,150,255,${Math.abs(effects.temperature) / 420})`;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (effects.tint) {
      context.fillStyle = effects.tint > 0 ? `rgba(255,35,175,${Math.abs(effects.tint) / 500})` : `rgba(35,255,145,${Math.abs(effects.tint) / 500})`;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.restore();
  }

  function sharpen(canvas, amount) {
    if (!amount || canvas.width * canvas.height > 1250000) return;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const original = new Uint8ClampedArray(pixels.data);
    const factor = amount / 10;
    for (let y = 1; y < canvas.height - 1; y += 1) {
      for (let x = 1; x < canvas.width - 1; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          pixels.data[offset + channel] = clamp(original[offset + channel] * (1 + 4 * factor) - factor * (original[offset - 4 + channel] + original[offset + 4 + channel] + original[offset - canvas.width * 4 + channel] + original[offset + canvas.width * 4 + channel]), 0, 255);
        }
      }
    }
    context.putImageData(pixels, 0, 0);
  }

  async function canvasForFrame(frame, group, options = {}) {
    const size = options.size || getDimension();
    const effects = options.effects || group.effects;
    const includeEffects = options.includeEffects !== false;
    const includeGlobal = options.includeGlobal !== false;
    const output = makeCanvas(size, size);
    const context = output.getContext('2d');
    const image = await imagePromise(frame.source);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const scale = Math.min(size / sourceWidth, size / sourceHeight, 1);
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    const global = globalAdjustments();
    const brightness = includeEffects ? effects.brightness / 100 * Math.pow(2, effects.exposure / 100) : 1;
    const contrast = includeEffects ? effects.contrast / 100 : 1;
    const saturation = includeEffects ? effects.saturation / 100 : 1;
    context.save();
    context.filter = `brightness(${includeGlobal ? global.brightness / 100 : 1}) brightness(${includeGlobal ? global.exposure / 100 : 1}) brightness(${brightness}) contrast(${includeGlobal ? global.contrast / 100 : 1}) contrast(${contrast}) saturate(${includeGlobal ? global.saturation / 100 : 1}) saturate(${saturation}) hue-rotate(${includeEffects ? effects.hue : 0}deg) blur(${includeEffects ? effects.blur : 0}px) grayscale(${includeEffects ? effects.grayscale / 100 : 0}) sepia(${includeEffects ? effects.sepia / 100 : 0}) invert(${includeEffects ? effects.invert / 100 : 0})`;
    context.globalAlpha = includeEffects ? effects.opacity / 100 : 1;
    context.drawImage(image, (size - drawWidth) / 2 + (frame.x || 0), (size - drawHeight) / 2 + (frame.y || 0), drawWidth, drawHeight);
    context.restore();
    if (includeEffects) {
      colourOverlay(output, effects);
      sharpen(output, effects.sharpen);
    }
    if (includeGlobal && global.chroma) chromaKey(output, global.chromaColor, global.tolerance, global.smoothing);
    if (includeGlobal && global.shadow) {
      const shadowed = makeCanvas(size, size);
      const shadowContext = shadowed.getContext('2d');
      shadowContext.save();
      shadowContext.globalAlpha = global.shadowOpacity / 100;
      shadowContext.shadowColor = global.shadowColor;
      shadowContext.shadowBlur = global.shadowBlur;
      shadowContext.shadowOffsetX = global.shadowX;
      shadowContext.shadowOffsetY = global.shadowY;
      shadowContext.drawImage(output, 0, 0);
      shadowContext.restore();
      shadowContext.drawImage(output, 0, 0);
      return shadowed;
    }
    return output;
  }

  async function composite(index, size = getDimension()) {
    const layers = [...state.groups].filter((group) => group.frames.length).sort((first, second) => second.layer - first.layer);
    if (!layers.length) return null;
    const output = makeCanvas(size, size);
    const context = output.getContext('2d');
    for (const group of layers) {
      const frame = group.frames[index % group.frames.length];
      const layer = await canvasForFrame(frame, group, { size });
      context.save();
      context.globalCompositeOperation = group.blend;
      context.drawImage(layer, 0, 0);
      context.restore();
    }
    return output;
  }

  function currentSelection(canvas) {
    const selection = state.selection;
    if (!selection.active || selection.w < .003 || selection.h < .003) return { x: 0, y: 0, w: canvas.width, h: canvas.height, full: true };
    return {
      x: Math.round(selection.x * canvas.width),
      y: Math.round(selection.y * canvas.height),
      w: Math.max(1, Math.round(selection.w * canvas.width)),
      h: Math.max(1, Math.round(selection.h * canvas.height)),
      full: false
    };
  }

  async function editableBuffer() {
    const group = activeGroup();
    const frame = activeFrame(group);
    if (!group || !frame) return null;
    if (state.editBuffer?.groupId === group.id && state.editBuffer?.frameId === frame.id) return state.editBuffer.canvas;
    const canvas = await canvasForFrame(frame, group, { includeEffects: false, includeGlobal: false });
    state.editBuffer = { groupId: group.id, frameId: frame.id, canvas };
    return canvas;
  }

  function saveEdit(canvas, label) {
    const group = activeGroup();
    const frame = activeFrame(group);
    if (!frame) return;
    rememberHistory();
    const prior = frame.source;
    frame.source = canvas.toDataURL('image/png');
    frame.width = canvas.width;
    frame.height = canvas.height;
    frame.x = 0;
    frame.y = 0;
    state.cache.delete(prior);
    state.editBuffer = { groupId: group.id, frameId: frame.id, canvas };
    if (label) notify(label);
    renderAll();
  }

  function rememberHistory() {
    const group = activeGroup();
    const frame = activeFrame(group);
    if (!group || !frame) return;
    state.history = state.history.slice(0, state.historyCursor + 1);
    state.history.push({ groupId: group.id, frameId: frame.id, source: frame.source, x: frame.x || 0, y: frame.y || 0 });
    if (state.history.length > 20) state.history.shift();
    state.historyCursor = state.history.length - 1;
  }

  function undoEdit() {
    if (state.historyCursor < 0) return notify('Nothing to undo.');
    const item = state.history[state.historyCursor--];
    const group = groupById(item.groupId);
    const frame = group?.frames.find((entry) => entry.id === item.frameId);
    if (!frame) return;
    frame.source = item.source;
    frame.x = item.x;
    frame.y = item.y;
    state.activeGroupId = group.id;
    state.activeFrameId = frame.id;
    state.editBuffer = null;
    renderAll();
    notify('Undo applied.');
  }

  function selectionOverlay() {
    let overlay = $('ag-v2-selection');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ag-v2-selection';
      overlay.hidden = true;
      elements.viewport.appendChild(overlay);
    }
    return overlay;
  }

  function updateSelectionOverlay() {
    const overlay = selectionOverlay();
    const selection = state.selection;
    const canvasRect = elements.editorCanvas.getBoundingClientRect();
    const viewportRect = elements.viewport.getBoundingClientRect();
    const visible = selection.active && selection.w > .003 && selection.h > .003;
    overlay.hidden = !visible;
    if (!visible) return;
    overlay.style.left = `${canvasRect.left - viewportRect.left + canvasRect.width * selection.x}px`;
    overlay.style.top = `${canvasRect.top - viewportRect.top + canvasRect.height * selection.y}px`;
    overlay.style.width = `${canvasRect.width * selection.w}px`;
    overlay.style.height = `${canvasRect.height * selection.h}px`;
  }

  function fitCanvas() {
    const bounds = elements.viewport.getBoundingClientRect();
    const edge = Math.max(elements.editorCanvas.width, elements.editorCanvas.height, 1);
    const base = Math.max(.1, Math.min((bounds.width - 32) / edge, (bounds.height - 32) / edge, 1));
    const visual = Math.max(36, edge * base);
    elements.editorCanvas.style.width = `${visual}px`;
    elements.editorCanvas.style.height = `${visual}px`;
    elements.editorCanvas.style.transform = `translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;
    if ($('zoom-label')) $('zoom-label').textContent = `${Math.round(state.zoom * 100)}%`;
    updateSelectionOverlay();
  }

  async function renderEditor() {
    const token = ++state.displayToken;
    const group = activeGroup();
    const frame = activeFrame(group);
    if (!group || !frame) {
      elements.editorCanvas.width = 480;
      elements.editorCanvas.height = 480;
      const context = elements.editorCanvas.getContext('2d');
      context.clearRect(0, 0, 480, 480);
      context.fillStyle = '#75b2de';
      context.font = '15px Geist Mono, monospace';
      context.textAlign = 'center';
      context.fillText('SELECT A FRAME TO BEGIN', 240, 240);
      fitCanvas();
      return;
    }
    let source;
    if (state.transform) source = transformCanvas(state.transform.base, state.transform.type, Number($('ag-v2-transform-slider').value));
    else if (state.editorMode === 'effects') source = await canvasForFrame(frame, group, { effects: state.effectsDraft });
    else if (state.editorView === 'final') source = await composite(state.editorIndex);
    else source = await editableBuffer();
    if (token !== state.displayToken || !source) return;
    elements.editorCanvas.width = source.width;
    elements.editorCanvas.height = source.height;
    const context = elements.editorCanvas.getContext('2d');
    context.clearRect(0, 0, source.width, source.height);
    context.drawImage(source, 0, 0);
    const frameIndex = Math.max(0, group.frames.findIndex((entry) => entry.id === frame.id));
    if ($('editor-frame-number')) $('editor-frame-number').textContent = `${group.name.toUpperCase()} · FRAME ${frameIndex + 1} / ${group.frames.length}`;
    $('view-final')?.classList.toggle('active', state.editorView === 'final');
    $('view-original')?.classList.toggle('active', state.editorView === 'original');
    fitCanvas();
  }

  function effectValue(key, value) {
    if (['brightness', 'contrast', 'saturation', 'opacity', 'grayscale', 'sepia', 'invert'].includes(key)) return `${value}%`;
    if (key === 'hue') return `${value}°`;
    if (key === 'blur') return `${value} px`;
    return String(value);
  }

  function toolbarHtml() {
    return '<button type="button" class="mini-action ag-create-group" id="ag-v2-create-group">CREATE NEW GROUP</button><label>IMPORT INTO <select id="ag-v2-import-group"></select></label><button type="button" class="mini-action" id="ag-v2-paste-group">PASTE FROM CLIPBOARD</button><span class="ag-group-status" id="ag-v2-status">GROUP 1 READY</span>';
  }

  function effectsHtml() {
    const controls = effectFields.map(([key, label, min, max, value]) => `<div class="ag-control-row"><label>${label}<output id="ag-v2-effect-${key}-value">${effectValue(key, value)}</output></label><input type="range" id="ag-v2-effect-${key}" min="${min}" max="${max}" value="${value}"></div>`).join('');
    return `<div class="tool-group ag-mode-panel" id="ag-v2-effects-panel" hidden><h4>Group Effects</h4>${controls}<div class="ag-target-list" id="ag-v2-effects-targets"></div><button type="button" class="ag-apply-btn" id="ag-v2-apply-effects">APPLY EFFECT TO SELECTED GROUPS</button><button type="button" id="ag-v2-reset-effects">RESET DRAFT</button></div>`;
  }

  function animationHtml() {
    return `<div class="tool-group ag-mode-panel" id="ag-v2-animations-panel" hidden><h4>Generate Animation</h4><label class="compact-control"><span>Animation Type</span><select id="ag-v2-animation-type"><option value="pulse-brightness">Pulse Brightness</option><option value="pulse-size">Pulse Size</option><option value="rotate">Rotate</option><option value="hue-shift">Hue Shift</option><option value="opacity-pulse">Opacity Pulse</option><option value="float">Float / Bob</option><option value="shake">Shake / Jitter</option><option value="breathing">Breathing</option><option value="motion-trail">Motion Trail</option><option value="overlay-layer" disabled>Overlay Layer — Coming Next</option></select></label><label class="compact-control"><span>Strength <b id="ag-v2-animation-strength-value">5</b></span><input type="range" id="ag-v2-animation-strength" min="1" max="10" value="5"></label><label class="compact-control"><span>Direction</span><select id="ag-v2-animation-direction"><option value="forward">Forward</option><option value="reverse">Reverse</option><option value="clockwise">Clockwise</option><option value="counterclockwise">Counter-clockwise</option></select></label><label class="compact-control"><span>Duration <b id="ag-v2-animation-duration-value">8 frames</b></span><input type="range" id="ag-v2-animation-duration" min="1" max="20" value="8"></label><div class="ag-placeholder">OVERLAY LAYER is a visible placeholder only. It will animate a separate image or group in a later layer pass.</div><div class="ag-target-list" id="ag-v2-animation-targets"></div><button type="button" class="ag-apply-btn" id="ag-v2-generate-animation">GENERATE NEW FRAMES</button></div>`;
  }

  function paintHtml() {
    return '<div class="tool-group ag-mode-panel" id="ag-v2-paint-panel" hidden><h4>Paint</h4><label class="compact-control"><span>Brush Colour</span><input type="color" id="ag-v2-brush-colour" value="#00ff00"></label><label class="compact-control"><span>Brush Size <b id="ag-v2-brush-size-value">18 px</b></span><input type="range" id="ag-v2-brush-size" min="1" max="100" value="18"></label><label class="checkbox-container"><input type="checkbox" id="ag-v2-eraser"><span class="checkmark"></span><span>Erase Instead Of Paint</span></label><p class="tool-tip-text">Draw directly onto the selected original frame.</p></div>';
  }

  function selectHtml() {
    return '<div class="tool-group ag-mode-panel" id="ag-v2-select-panel" hidden><h4>Selection</h4><button type="button" id="ag-v2-selection-toggle">DRAW / MOVE SELECTION</button><button type="button" id="ag-v2-selection-clear">CLEAR SELECTION</button><p class="tool-tip-text">The active selection limits copy, paste, clear, scale and rotate.</p></div>';
  }

  function installUi() {
    elements.queue.hidden = false;
    elements.queue.removeAttribute('hidden');
    elements.output.hidden = false;
    elements.output.removeAttribute('hidden');
    const queueHeading = elements.queue.querySelector('h3');
    if (queueHeading) queueHeading.textContent = '1. Frames & Groups';

    if (!$('ag-v2-toolbar')) {
      const toolbar = document.createElement('div');
      toolbar.id = 'ag-v2-toolbar';
      toolbar.className = 'ag-group-toolbar';
      toolbar.innerHTML = toolbarHtml();
      elements.queue.querySelector('.input-group.inline-input')?.insertAdjacentElement('afterend', toolbar);
      $('ag-v2-create-group').addEventListener('click', () => { const group = createGroup(); state.effectTargets = new Set([group.id]); state.animationTargets = new Set([group.id]); notify(`${group.name} created.`); renderAll(); });
      $('ag-v2-import-group').addEventListener('change', (event) => setActive(event.target.value));
      $('ag-v2-paste-group').addEventListener('click', pasteGroupFromClipboard);
    }
    elements.grid.classList.add('ag-groups-grid');

    let editorCard = $('advanced-editor-card');
    if (!editorCard) {
      editorCard = document.createElement('section');
      editorCard.id = 'advanced-editor-card';
      editorCard.className = 'config-card advanced-editor-card';
      editorCard.innerHTML = '<div class="advanced-card-heading"><h3>2. Frame Editor</h3></div><div class="advanced-inline-editor-host"></div>';
      elements.queue.insertAdjacentElement('afterend', editorCard);
    }
    const host = editorCard.querySelector('.advanced-inline-editor-host');
    if (host && !host.contains(elements.editorWindow)) host.appendChild(elements.editorWindow);
    elements.editorModal.hidden = false;
    elements.editorModal.classList.add('advanced-inline-editor');
    elements.editorWindow.querySelector('.editor-close')?.setAttribute('hidden', '');
    elements.editorWindow.querySelector('.editor-footer [data-close="frame-editor-modal"]')?.setAttribute('hidden', '');

    const header = elements.editorWindow.querySelector('.editor-header');
    const nav = elements.editorWindow.querySelector('.editor-nav');
    const tools = elements.editorWindow.querySelector('.editor-tools');

    if (!$('ag-v2-editor-menu')) {
      const menu = document.createElement('div');
      menu.id = 'ag-v2-editor-menu';
      menu.className = 'advanced-editor-menu';
      menu.innerHTML = '<button type="button" class="active" data-ag-v2-mode="edit">EDIT</button><button type="button" data-ag-v2-mode="paint">PAINT</button><button type="button" data-ag-v2-mode="select">SELECT</button><button type="button" data-ag-v2-mode="effects">EFFECTS</button><button type="button" data-ag-v2-mode="animations">ANIMATIONS</button>';
      header.querySelector('h2')?.insertAdjacentElement('afterend', menu);
      menu.addEventListener('click', (event) => { const mode = event.target.closest('[data-ag-v2-mode]')?.dataset.agV2Mode; if (mode) setMode(mode); });
    }

    if (!$('ag-v2-actions')) {
      const actions = document.createElement('div');
      actions.id = 'ag-v2-actions';
      actions.className = 'ag-editor-actions';
      actions.innerHTML = '<button type="button" id="ag-v2-copy">COPY</button><button type="button" id="ag-v2-paste">PASTE INTO FRAME</button><button type="button" id="ag-v2-paste-new">PASTE AS NEW FRAME</button><button type="button" id="ag-v2-clear">CLEAR</button><button type="button" id="ag-v2-scale">SCALE</button><button type="button" id="ag-v2-rotate">ROTATE</button><button type="button" id="ag-v2-undo">UNDO</button><button type="button" id="ag-v2-realign">REALIGN</button>';
      nav.appendChild(actions);
      $('ag-v2-copy').addEventListener('click', copyFrame);
      $('ag-v2-paste').addEventListener('click', pasteIntoFrame);
      $('ag-v2-paste-new').addEventListener('click', pasteAsNewFrame);
      $('ag-v2-clear').addEventListener('click', clearFrame);
      $('ag-v2-scale').addEventListener('click', () => openTransform('scale'));
      $('ag-v2-rotate').addEventListener('click', () => openTransform('rotate'));
      $('ag-v2-undo').addEventListener('click', undoEdit);
      $('ag-v2-realign').addEventListener('click', () => { const frame = activeFrame(); if (!frame) return; frame.x = 0; frame.y = 0; state.editBuffer = null; renderAll(); notify('Current frame realigned.'); });
    }

    if (!$('ag-v2-transform')) {
      const transform = document.createElement('div');
      transform.id = 'ag-v2-transform';
      transform.className = 'ag-transform-panel';
      transform.hidden = true;
      transform.innerHTML = '<span id="ag-v2-transform-title">TRANSFORM</span><input type="range" id="ag-v2-transform-slider"><b id="ag-v2-transform-value">0</b><button type="button" id="ag-v2-transform-apply">APPLY</button><button type="button" id="ag-v2-transform-cancel">CANCEL</button>';
      nav.insertAdjacentElement('afterend', transform);
      $('ag-v2-transform-slider').addEventListener('input', renderEditor);
      $('ag-v2-transform-apply').addEventListener('click', () => closeTransform(true));
      $('ag-v2-transform-cancel').addEventListener('click', () => closeTransform(false));
    }

    if (!$('ag-v2-paint-panel')) {
      tools.insertAdjacentHTML('beforeend', paintHtml() + selectHtml() + effectsHtml() + animationHtml());
      $('ag-v2-brush-colour').addEventListener('input', (event) => { state.brush.color = event.target.value; });
      $('ag-v2-brush-size').addEventListener('input', (event) => { state.brush.size = Number(event.target.value); $('ag-v2-brush-size-value').textContent = `${event.target.value} px`; });
      $('ag-v2-selection-toggle').addEventListener('click', () => { state.selection.enabled = !state.selection.enabled; updateSelectionToggle(); });
      $('ag-v2-selection-clear').addEventListener('click', () => { state.selection.active = false; updateSelectionOverlay(); });
      effectFields.forEach(([key]) => $(`ag-v2-effect-${key}`).addEventListener('input', (event) => { state.effectsDraft[key] = Number(event.target.value); $(`ag-v2-effect-${key}-value`).textContent = effectValue(key, state.effectsDraft[key]); renderEditor(); }));
      $('ag-v2-apply-effects').addEventListener('click', applyEffects);
      $('ag-v2-reset-effects').addEventListener('click', () => { state.effectsDraft = defaultEffects(); renderEffectPanel(); renderEditor(); });
      $('ag-v2-animation-strength').addEventListener('input', (event) => { $('ag-v2-animation-strength-value').textContent = event.target.value; });
      $('ag-v2-animation-duration').addEventListener('input', (event) => { $('ag-v2-animation-duration-value').textContent = `${event.target.value} frames`; });
      $('ag-v2-generate-animation').addEventListener('click', generateAnimation);
    }

    installOutputEffects();
  }

  function installOutputEffects() {
    let card = $('animation-effects-card');
    if (!card) {
      card = document.createElement('section');
      card.id = 'animation-effects-card';
      card.className = 'config-card';
      card.innerHTML = '<h3>4. Animation Effects</h3><div class="ag-output-effects"><div class="ag-effects-grid"><label class="compact-control"><span>In-Between Frames</span><select id="ag-v2-between"><option value="0">Off</option><option value="1">1 Blend</option><option value="2">2 Blends</option><option value="3">3 Blends</option></select></label><label class="compact-control"><span>Loop Blend <b id="ag-v2-loop-value">0</b></span><input id="ag-v2-loop" type="range" min="0" max="10" value="0"></label><label class="compact-control"><span>Hold First <b id="ag-v2-first-value">0</b></span><input id="ag-v2-first" type="range" min="0" max="20" value="0"></label><label class="compact-control"><span>Hold Last <b id="ag-v2-last-value">0</b></span><input id="ag-v2-last" type="range" min="0" max="20" value="0"></label><label class="compact-control"><span>Speed Curve</span><select id="ag-v2-speed"><option value="linear">Linear</option><option value="ease-in">Ease In</option><option value="ease-out">Ease Out</option><option value="ease-in-out">Ease In / Out</option></select></label><label class="compact-control"><span>Opacity Pulse <b id="ag-v2-pulse-value">0</b></span><input id="ag-v2-pulse" type="range" min="0" max="10" value="0"></label><label class="compact-control"><span>Shake / Jitter <b id="ag-v2-shake-value">0</b></span><input id="ag-v2-shake" type="range" min="0" max="10" value="0"></label><label class="compact-control"><span>Float / Bob <b id="ag-v2-bob-value">0</b></span><input id="ag-v2-bob" type="range" min="0" max="20" value="0"></label><label class="compact-control"><span>Motion Trail <b id="ag-v2-trail-value">0</b></span><input id="ag-v2-trail" type="range" min="0" max="10" value="0"></label><label class="compact-control"><span>Strobe <b id="ag-v2-strobe-value">0</b></span><input id="ag-v2-strobe" type="range" min="0" max="10" value="0"></label></div><label class="checkbox-container"><input type="checkbox" id="ag-v2-fade-in"><span class="checkmark"></span><span>Fade In</span></label><label class="checkbox-container"><input type="checkbox" id="ag-v2-fade-out"><span class="checkmark"></span><span>Fade Out</span></label><label class="compact-control"><span>Fade Level <b id="ag-v2-fade-value">3</b></span><input id="ag-v2-fade" type="range" min="1" max="20" value="3"></label></div>';
      $('adjust-card')?.insertAdjacentElement('afterend', card);
      ['loop', 'first', 'last', 'pulse', 'shake', 'bob', 'trail', 'strobe', 'fade'].forEach((key) => $(`ag-v2-${key}`).addEventListener('input', (event) => { $(`ag-v2-${key}-value`).textContent = event.target.value; }));
    }
    const titles = { 'queue-card': '1. Frames & Groups', 'adjust-card': '3. Visual Adjustments', 'animation-effects-card': '4. Animation Effects', 'settings-card': '5. Animation Settings', 'advanced-webp-card': '6. WebP Advanced Settings', 'output-card': '7. Synthesized Core Output' };
    Object.entries(titles).forEach(([id, title]) => { const heading = $(id)?.querySelector('h3'); if (heading) heading.textContent = title; });
  }

  function setMode(mode) {
    state.editorMode = mode;
    if (mode === 'edit' || mode === 'paint' || mode === 'select') state.editorView = 'original';
    if (mode === 'effects') state.effectsDraft = copy(activeGroup()?.effects || defaultEffects());
    $$('[data-ag-v2-mode]').forEach((button) => button.classList.toggle('active', button.dataset.agV2Mode === mode));
    const nativeGroups = [...elements.editorWindow.querySelectorAll('.editor-tools > .tool-group')].filter((group) => !group.id.startsWith('ag-v2-'));
    nativeGroups.forEach((group) => { group.hidden = true; });
    $('ag-v2-paint-panel').hidden = mode !== 'paint';
    $('ag-v2-select-panel').hidden = mode !== 'select';
    $('ag-v2-effects-panel').hidden = mode !== 'effects';
    $('ag-v2-animations-panel').hidden = mode !== 'animations';
    $('ag-v2-actions').hidden = mode !== 'edit';
    $('ag-v2-transform').hidden = true;
    state.transform = null;
    if (mode === 'effects') renderEffectPanel();
    if (mode === 'animations') renderTargetList('ag-v2-animation-targets', state.animationTargets);
    updateSelectionToggle();
    renderEditor();
  }

  function updateSelectionToggle() {
    const button = $('ag-v2-selection-toggle');
    if (!button) return;
    button.classList.toggle('active', state.selection.enabled);
    button.textContent = state.selection.enabled ? 'DRAW / MOVE SELECTION' : 'SELECTION OFF';
  }

  function renderEffectPanel() {
    effectFields.forEach(([key]) => {
      const input = $(`ag-v2-effect-${key}`);
      const output = $(`ag-v2-effect-${key}-value`);
      if (!input || !output) return;
      input.value = state.effectsDraft[key];
      output.textContent = effectValue(key, state.effectsDraft[key]);
    });
    renderTargetList('ag-v2-effects-targets', state.effectTargets);
  }

  function renderTargetList(id, selected) {
    const host = $(id);
    if (!host) return;
    selected.add(state.activeGroupId);
    host.innerHTML = state.groups.map((group) => `<label><input type="checkbox" value="${group.id}" ${selected.has(group.id) ? 'checked' : ''}><span>${escapeHtml(group.name)}${group.id === state.activeGroupId ? ' — Current Group' : ''}</span></label>`).join('');
    $$('input[type="checkbox"]', host).forEach((checkbox) => checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(checkbox.value);
      else if (checkbox.value !== state.activeGroupId) selected.delete(checkbox.value);
      else checkbox.checked = true;
    }));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function renderGroupControl() {
    const select = $('ag-v2-import-group');
    const group = activeGroup();
    select.innerHTML = state.groups.map((entry) => `<option value="${entry.id}" ${entry.id === state.activeGroupId ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('');
    $('ag-v2-status').textContent = group ? `ACTIVE: ${group.name.toUpperCase()} · LAYER ${group.layer}` : 'NO GROUP SELECTED';
  }

  function renderGroups() {
    normalizeLayers();
    elements.grid.innerHTML = '';
    state.groups.forEach((group) => {
      const card = document.createElement('section');
      card.className = `ag-group ${group.id === state.activeGroupId ? 'ag-active' : ''}`;
      const blends = blendModes.map(([value, label]) => `<option value="${value}" ${group.blend === value ? 'selected' : ''}>${label}</option>`).join('');
      const layers = Array.from({ length: state.groups.length }, (_, index) => `<option value="${index + 1}" ${group.layer === index + 1 ? 'selected' : ''}>LAYER ${index + 1}${index === 0 ? ' — TOP' : ''}</option>`).join('');
      card.innerHTML = `<header class="ag-group-header"><button type="button" class="ag-group-select" data-v2-select-group="${group.id}">${group.id === state.activeGroupId ? '●' : '○'}</button><input class="ag-group-name" data-v2-group-name="${group.id}" value="${escapeHtml(group.name)}"><span class="ag-group-count">${group.frames.length} FRAME${group.frames.length === 1 ? '' : 'S'}</span><select class="ag-group-pill" data-v2-blend="${group.id}">${blends}</select><select class="ag-group-pill" data-v2-layer="${group.id}">${layers}</select><button type="button" class="mini-action danger-mini" data-v2-remove-group="${group.id}">REMOVE</button></header><div class="ag-group-frames" data-v2-row="${group.id}"></div>`;
      const row = card.querySelector('[data-v2-row]');
      if (!group.frames.length) row.innerHTML = '<div class="ag-empty-group">DROP OR IMPORT IMAGE FILES INTO THIS GROUP</div>';
      group.frames.forEach((frame, index) => {
        const tile = document.createElement('div');
        tile.className = `frame-thumb-wrapper ${group.id === state.activeGroupId && frame.id === state.activeFrameId ? 'ag-frame-selected' : ''}`;
        tile.dataset.groupId = group.id;
        tile.dataset.frameId = frame.id;
        tile.innerHTML = `<img src="${frame.source}" alt="${escapeHtml(frame.name)}"><span class="frame-index-badge">${index + 1}</span>`;
        const button = (className, text, handler, title) => { const element = document.createElement('button'); element.type = 'button'; element.className = className; element.textContent = text; element.title = title; element.addEventListener('click', (event) => { event.stopPropagation(); handler(); }); return element; };
        tile.append(button('thumb-btn frame-preview-btn', '👁', () => previewFrame(group.id, frame.id), 'Preview frame'), button('thumb-btn frame-align-btn', '⊕', () => openAlign(group.id, frame.id), 'Align frame'), button('thumb-btn frame-delete-btn', '×', () => removeFrame(group.id, frame.id), 'Delete frame'));
        tile.addEventListener('click', () => setActive(group.id, frame.id));
        row.appendChild(tile);
      });
      elements.grid.appendChild(card);
    });
    $$('[data-v2-select-group]').forEach((button) => button.addEventListener('click', () => setActive(button.dataset.v2SelectGroup)));
    $$('[data-v2-group-name]').forEach((input) => input.addEventListener('change', () => { const group = groupById(input.dataset.v2GroupName); if (group) { group.name = input.value.trim() || group.name; renderAll(); } }));
    $$('[data-v2-blend]').forEach((select) => select.addEventListener('change', () => { const group = groupById(select.dataset.v2Blend); if (group) { group.blend = select.value; renderEditor(); } }));
    $$('[data-v2-layer]').forEach((select) => select.addEventListener('change', () => moveLayer(select.dataset.v2Layer, select.value)));
    $$('[data-v2-remove-group]').forEach((button) => button.addEventListener('click', () => removeGroup(button.dataset.v2RemoveGroup)));
  }

  function removeFrame(groupId, frameId) {
    const group = groupById(groupId);
    if (!group) return;
    group.frames = group.frames.filter((frame) => frame.id !== frameId);
    if (state.activeGroupId === groupId && state.activeFrameId === frameId) state.activeFrameId = group.frames[0]?.id || null;
    state.editBuffer = null;
    renderAll();
  }

  function removeGroup(groupId) {
    const group = groupById(groupId);
    if (!group) return;
    if (state.groups.length === 1) {
      group.frames = [];
      state.activeFrameId = null;
    } else {
      state.groups = state.groups.filter((entry) => entry.id !== groupId);
      state.effectTargets.delete(groupId);
      state.animationTargets.delete(groupId);
      normalizeLayers();
      state.activeGroupId = state.groups[0].id;
      state.activeFrameId = state.groups[0].frames[0]?.id || null;
    }
    state.editBuffer = null;
    renderAll();
  }

  function applyEffects() {
    const targets = [...state.effectTargets];
    targets.forEach((id) => { const group = groupById(id); if (group) group.effects = copy(state.effectsDraft); });
    notify(`Effects applied to ${targets.length} group${targets.length === 1 ? '' : 's'}.`);
    renderAll();
  }

  function transformCanvas(source, type, value) {
    const output = makeCanvas(source.width, source.height);
    output.getContext('2d').drawImage(source, 0, 0);
    const region = currentSelection(output);
    const crop = makeCanvas(region.w, region.h);
    crop.getContext('2d').drawImage(source, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
    const context = output.getContext('2d');
    context.save();
    context.beginPath();
    context.rect(region.x, region.y, region.w, region.h);
    context.clip();
    context.clearRect(region.x, region.y, region.w, region.h);
    context.translate(region.x + region.w / 2, region.y + region.h / 2);
    if (type === 'scale') context.scale(value / 100, value / 100);
    else context.rotate(value * Math.PI / 180);
    context.drawImage(crop, -region.w / 2, -region.h / 2);
    context.restore();
    return output;
  }

  async function openTransform(type) {
    const base = await editableBuffer();
    if (!base) return;
    state.transform = { type, base: cloneCanvas(base) };
    const slider = $('ag-v2-transform-slider');
    $('ag-v2-transform').hidden = false;
    if (type === 'scale') {
      $('ag-v2-transform-title').textContent = state.selection.active ? 'SCALE SELECTION' : 'SCALE FRAME';
      slider.min = '10'; slider.max = '300'; slider.step = '1'; slider.value = '100';
      $('ag-v2-transform-value').textContent = '100%';
    } else {
      $('ag-v2-transform-title').textContent = state.selection.active ? 'ROTATE SELECTION' : 'ROTATE FRAME';
      slider.min = '-180'; slider.max = '180'; slider.step = '1'; slider.value = '0';
      $('ag-v2-transform-value').textContent = '0°';
    }
    renderEditor();
  }

  function closeTransform(apply) {
    if (!state.transform) return;
    if (apply) {
      const output = transformCanvas(state.transform.base, state.transform.type, Number($('ag-v2-transform-slider').value));
      saveEdit(output, state.transform.type === 'scale' ? 'Scale applied.' : 'Rotation applied.');
    }
    state.transform = null;
    $('ag-v2-transform').hidden = true;
    renderEditor();
  }

  function cloneCanvas(source) {
    const output = makeCanvas(source.width, source.height);
    output.getContext('2d').drawImage(source, 0, 0);
    return output;
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

  async function pasteGroupFromClipboard() {
    try {
      const { blob, type } = await clipboardImage();
      const extension = type.split('/')[1] || 'png';
      await importImages([new File([blob], `clipboard-frame-${Date.now()}.${extension}`, { type })]);
    } catch (error) { notify(error.message); }
  }

  async function copyFrame() {
    const source = await editableBuffer();
    if (!source) return;
    const region = currentSelection(source);
    const output = makeCanvas(region.w, region.h);
    output.getContext('2d').drawImage(source, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
    output.toBlob(async (blob) => {
      try {
        if (!blob || !window.ClipboardItem) throw new Error();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        notify(region.full ? 'Current frame copied.' : 'Selection copied.');
      } catch (error) { notify('Browser clipboard write was blocked.'); }
    }, 'image/png');
  }

  async function pasteIntoFrame() {
    try {
      const { blob } = await clipboardImage();
      const url = URL.createObjectURL(blob);
      const image = await imagePromise(url);
      URL.revokeObjectURL(url);
      const source = await editableBuffer();
      if (!source) return;
      const region = currentSelection(source);
      const context = source.getContext('2d');
      rememberHistory();
      context.clearRect(region.x, region.y, region.w, region.h);
      context.drawImage(image, region.x, region.y, region.w, region.h);
      saveEdit(source, region.full ? 'Clipboard image pasted into frame.' : 'Clipboard image pasted into selection.');
    } catch (error) { notify(error.message); }
  }

  async function pasteAsNewFrame() {
    try {
      const { blob, type } = await clipboardImage();
      const extension = type.split('/')[1] || 'png';
      const frames = await makeFrames([new File([blob], `pasted-frame-${Date.now()}.${extension}`, { type })]);
      const group = activeGroup();
      if (!group || !frames.length) return;
      const index = Math.max(0, group.frames.findIndex((frame) => frame.id === state.activeFrameId));
      group.frames.splice(index + 1, 0, frames[0]);
      state.activeFrameId = frames[0].id;
      state.editBuffer = null;
      renderAll();
      notify('Clipboard image inserted as a new frame.');
    } catch (error) { notify(error.message); }
  }

  async function clearFrame() {
    const source = await editableBuffer();
    if (!source) return;
    const region = currentSelection(source);
    rememberHistory();
    source.getContext('2d').clearRect(region.x, region.y, region.w, region.h);
    saveEdit(source, region.full ? 'Current frame cleared.' : 'Selection cleared.');
  }

  function point(event) {
    const rect = elements.editorCanvas.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
  }

  async function startPaint(event) {
    const buffer = await editableBuffer();
    if (!buffer || state.editorMode !== 'paint') return;
    const position = point(event);
    state.brush.painting = true;
    elements.editorCanvas.setPointerCapture?.(event.pointerId);
    const context = buffer.getContext('2d');
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = state.brush.size;
    context.strokeStyle = state.brush.color;
    context.globalCompositeOperation = $('ag-v2-eraser').checked ? 'destination-out' : 'source-over';
    context.beginPath();
    context.moveTo(position.x * buffer.width, position.y * buffer.height);
    context.restore();
    state.editBuffer = { groupId: state.activeGroupId, frameId: state.activeFrameId, canvas: buffer, previous: position };
  }

  function movePaint(event) {
    const session = state.editBuffer;
    if (!state.brush.painting || !session?.canvas) return;
    const position = point(event);
    const context = session.canvas.getContext('2d');
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = state.brush.size;
    context.strokeStyle = state.brush.color;
    context.globalCompositeOperation = $('ag-v2-eraser').checked ? 'destination-out' : 'source-over';
    context.beginPath();
    context.moveTo(session.previous.x * session.canvas.width, session.previous.y * session.canvas.height);
    context.lineTo(position.x * session.canvas.width, position.y * session.canvas.height);
    context.stroke();
    context.restore();
    session.previous = position;
    elements.editorCanvas.width = session.canvas.width;
    elements.editorCanvas.height = session.canvas.height;
    elements.editorCanvas.getContext('2d').drawImage(session.canvas, 0, 0);
    fitCanvas();
  }

  function endPaint(event) {
    if (!state.brush.painting) return;
    state.brush.painting = false;
    elements.editorCanvas.releasePointerCapture?.(event.pointerId);
    if (state.editBuffer?.canvas) saveEdit(state.editBuffer.canvas, 'Paint applied.');
  }

  function pointerDown(event) {
    if (!activeFrame()) return;
    if (state.editorMode === 'paint') { event.preventDefault(); startPaint(event); return; }
    if (state.editorMode !== 'select' || !state.selection.enabled) return;
    event.preventDefault();
    const position = point(event);
    const selection = state.selection;
    selection.dragging = true;
    elements.editorCanvas.setPointerCapture?.(event.pointerId);
    const inside = selection.active && position.x >= selection.x && position.x <= selection.x + selection.w && position.y >= selection.y && position.y <= selection.y + selection.h;
    if (inside) {
      selection.mode = 'move';
      selection.lastX = position.x;
      selection.lastY = position.y;
    } else {
      selection.mode = 'create';
      selection.active = true;
      selection.startX = position.x;
      selection.startY = position.y;
      selection.x = position.x;
      selection.y = position.y;
      selection.w = 0;
      selection.h = 0;
    }
    updateSelectionOverlay();
  }

  function pointerMove(event) {
    if (state.editorMode === 'paint') { movePaint(event); return; }
    const selection = state.selection;
    if (state.editorMode !== 'select' || !selection.dragging) return;
    event.preventDefault();
    const position = point(event);
    if (selection.mode === 'move') {
      selection.x = clamp(selection.x + position.x - selection.lastX, 0, 1 - selection.w);
      selection.y = clamp(selection.y + position.y - selection.lastY, 0, 1 - selection.h);
      selection.lastX = position.x;
      selection.lastY = position.y;
    } else {
      selection.x = Math.min(selection.startX, position.x);
      selection.y = Math.min(selection.startY, position.y);
      selection.w = Math.abs(position.x - selection.startX);
      selection.h = Math.abs(position.y - selection.startY);
    }
    updateSelectionOverlay();
  }

  function pointerUp(event) {
    if (state.editorMode === 'paint') { endPaint(event); return; }
    if (!state.selection.dragging) return;
    state.selection.dragging = false;
    elements.editorCanvas.releasePointerCapture?.(event.pointerId);
    if (state.selection.w < .003 || state.selection.h < .003) state.selection.active = false;
    updateSelectionOverlay();
  }

  async function makeAnimationFrames(frame, type, strength, duration, direction) {
    const image = await imagePromise(frame.source);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const frames = [];
    const sign = direction === 'reverse' || direction === 'counterclockwise' ? -1 : 1;
    for (let index = 1; index <= duration; index += 1) {
      const progress = index / duration;
      const wave = Math.sin(progress * Math.PI * 2 * sign);
      const canvas = makeCanvas(width, height);
      const context = canvas.getContext('2d');
      context.translate(width / 2, height / 2);
      let scale = 1;
      let angle = 0;
      let alpha = 1;
      let moveX = 0;
      let moveY = 0;
      let filter = 'none';
      if (type === 'pulse-brightness') filter = `brightness(${1 + wave * strength / 10})`;
      if (type === 'pulse-size') scale = 1 + wave * strength / 25;
      if (type === 'rotate') angle = progress * Math.PI * 2 * strength / 10 * sign;
      if (type === 'hue-shift') filter = `hue-rotate(${progress * strength * 36 * sign}deg)`;
      if (type === 'opacity-pulse') alpha = clamp(1 - strength / 16 + wave * strength / 16, .1, 1);
      if (type === 'float') moveY = wave * strength * 2;
      if (type === 'shake') { moveX = Math.sin(index * 17.19) * strength * 2; moveY = Math.cos(index * 31.77) * strength * 2; }
      if (type === 'breathing') { scale = 1 + wave * strength / 36; alpha = clamp(1 - strength / 25 + wave * strength / 25, .2, 1); }
      if (type === 'motion-trail' && index > 1) { context.globalAlpha = strength / 24; context.drawImage(image, -width / 2 - strength * 2 * sign, -height / 2); }
      context.filter = filter;
      context.globalAlpha = alpha;
      context.rotate(angle);
      context.scale(scale, scale);
      context.drawImage(image, -width / 2 + moveX, -height / 2 + moveY);
      const source = canvas.toDataURL('image/png');
      frames.push({ id: uid('frame'), name: `${animationNames[type]} ${index}/${duration}`, source, originalSource: source, width, height, x: 0, y: 0 });
    }
    return frames;
  }

  async function generateAnimation() {
    const type = $('ag-v2-animation-type').value;
    if (type === 'overlay-layer') return;
    const duration = Number($('ag-v2-animation-duration').value);
    const strength = Number($('ag-v2-animation-strength').value);
    const direction = $('ag-v2-animation-direction').value;
    const targets = [...state.animationTargets];
    if (!targets.length) return;
    const workspaceCount = totalFrames();
    notify('Generating new frames...');
    for (const groupId of targets) {
      const group = groupById(groupId);
      if (!group?.frames.length) continue;
      const source = group.id === state.activeGroupId ? activeFrame(group) : group.frames[0];
      if (!source) continue;
      const generated = await makeAnimationFrames(source, type, strength, duration, direction);
      if (workspaceCount === 1 && targets.length === 1) {
        group.frames = [source, ...generated];
        state.activeGroupId = group.id;
        state.activeFrameId = source.id;
      } else {
        group.frames = group.frames.filter((frame) => frame.id !== source.id);
        const newGroup = {
          id: uid('group'),
          name: `${group.name} — ${animationNames[type]}`,
          layer: group.layer,
          blend: group.blend,
          effects: copy(group.effects),
          frames: [source, ...generated]
        };
        state.groups.forEach((entry) => { if (entry !== group && entry.layer >= newGroup.layer) entry.layer += 1; });
        state.groups.push(newGroup);
        if (!group.frames.length) state.groups = state.groups.filter((entry) => entry !== group);
        normalizeLayers();
        state.activeGroupId = newGroup.id;
        state.activeFrameId = source.id;
      }
    }
    state.editBuffer = null;
    state.animationTargets = new Set([state.activeGroupId]);
    notify('Animation frames generated.');
    renderAll();
  }

  function outputSettings() {
    return {
      between: Number($('ag-v2-between')?.value || 0),
      loop: Number($('ag-v2-loop')?.value || 0),
      first: Number($('ag-v2-first')?.value || 0),
      last: Number($('ag-v2-last')?.value || 0),
      speed: $('ag-v2-speed')?.value || 'linear',
      fadeIn: Boolean($('ag-v2-fade-in')?.checked),
      fadeOut: Boolean($('ag-v2-fade-out')?.checked),
      fade: Number($('ag-v2-fade')?.value || 3),
      pulse: Number($('ag-v2-pulse')?.value || 0),
      shake: Number($('ag-v2-shake')?.value || 0),
      bob: Number($('ag-v2-bob')?.value || 0),
      trail: Number($('ag-v2-trail')?.value || 0),
      strobe: Number($('ag-v2-strobe')?.value || 0)
    };
  }

  function alphaCanvas(source, alpha) {
    const output = makeCanvas(source.width, source.height);
    const context = output.getContext('2d');
    context.globalAlpha = alpha;
    context.drawImage(source, 0, 0);
    return output;
  }

  function blendCanvas(first, second, amount) {
    const output = makeCanvas(Math.max(first.width, second.width), Math.max(first.height, second.height));
    const context = output.getContext('2d');
    context.globalAlpha = 1 - amount;
    context.drawImage(first, 0, 0, output.width, output.height);
    context.globalAlpha = amount;
    context.drawImage(second, 0, 0, output.width, output.height);
    return output;
  }

  function applyOutputEffects(input) {
    const settings = outputSettings();
    let frames = input.map((frame, index) => {
      const output = makeCanvas(frame.width, frame.height);
      const context = output.getContext('2d');
      const phase = input.length > 1 ? index / (input.length - 1) : 0;
      const pulse = settings.pulse ? 1 - settings.pulse / 22 + Math.sin(phase * Math.PI * 2) * settings.pulse / 22 : 1;
      const bob = settings.bob ? Math.sin(phase * Math.PI * 2) * settings.bob : 0;
      const x = settings.shake ? Math.sin((index + 1) * 17.11) * settings.shake : 0;
      const y = settings.shake ? Math.cos((index + 1) * 31.91) * settings.shake + bob : bob;
      const strobe = settings.strobe && index % Math.max(2, 12 - settings.strobe) === 0 ? .4 + settings.strobe / 20 : 1;
      if (settings.trail && index > 0) { context.globalAlpha = settings.trail / 28; context.drawImage(input[index - 1], 0, 0); }
      context.globalAlpha = clamp(pulse * strobe, 0, 1);
      context.drawImage(frame, x, y);
      return output;
    });
    if (settings.between && frames.length > 1) {
      const output = [];
      for (let index = 0; index < frames.length - 1; index += 1) {
        output.push(frames[index]);
        for (let step = 1; step <= settings.between; step += 1) output.push(blendCanvas(frames[index], frames[index + 1], step / (settings.between + 1)));
      }
      output.push(frames[frames.length - 1]);
      frames = output;
    }
    if (settings.loop && frames.length > 1) for (let step = 1; step <= settings.loop; step += 1) frames.push(blendCanvas(frames[frames.length - 1], frames[0], step / (settings.loop + 1)));
    if (settings.first && frames.length) frames = [...Array(settings.first).fill(frames[0]), ...frames];
    if (settings.last && frames.length) frames = [...frames, ...Array(settings.last).fill(frames[frames.length - 1])];
    if (settings.fadeIn && frames.length) frames = [...Array.from({ length: settings.fade }, (_, index) => alphaCanvas(frames[0], (index + 1) / settings.fade)), ...frames.slice(1)];
    if (settings.fadeOut && frames.length) { const last = frames[frames.length - 1]; const divisor = Math.max(1, settings.fade - 1); frames = [...frames.slice(0, -1), ...Array.from({ length: settings.fade }, (_, index) => alphaCanvas(last, 1 - index / divisor))]; }
    if (settings.speed !== 'linear' && frames.length > 2) {
      const output = [];
      frames.forEach((frame, index) => {
        const position = index / (frames.length - 1);
        const repeat = settings.speed === 'ease-in' ? (position < .42 ? 2 : 1) : settings.speed === 'ease-out' ? (position > .58 ? 2 : 1) : (position < .25 || position > .75 ? 2 : 1);
        for (let count = 0; count < repeat; count += 1) output.push(frame);
      });
      frames = output;
    }
    return frames;
  }

  async function outputFrames() {
    const count = Math.max(0, ...state.groups.map((group) => group.frames.length));
    if (!count) return [];
    const skip = Number($('adj-skip')?.value || 1);
    let indices = Array.from({ length: count }, (_, index) => index).filter((_, index) => index % skip === 0);
    if ($('chk-reverse')?.checked) indices = indices.reverse();
    if ($('chk-forverse')?.checked) indices = indices.concat([...indices].reverse());
    const output = [];
    for (const index of indices) {
      const frame = await composite(index);
      if (frame) output.push(frame);
    }
    return applyOutputEffects(output);
  }

  function outputDelay(frameCount) {
    const original = Math.max(1, ...state.groups.map((group) => group.frames.length));
    return Math.max(11, Math.round(Number($('frame-delay')?.value || 200) * original / Math.max(1, frameCount)));
  }

  function showOutput(canvas) {
    elements.output.hidden = false;
    elements.output.removeAttribute('hidden');
    elements.outputViewport.innerHTML = '';
    elements.outputViewport.appendChild(cloneCanvas(canvas));
  }

  function stopPreview() {
    state.previewToken += 1;
    if (state.previewTimer) window.clearTimeout(state.previewTimer);
    state.previewTimer = null;
  }

  async function previewAnimation() {
    stopPreview();
    const token = ++state.previewToken;
    const frames = await outputFrames();
    if (!frames.length) return notify('Load image frames first.');
    elements.animationModal.hidden = false;
    elements.animationLoading.hidden = true;
    elements.animationImage.hidden = false;
    let index = 0;
    const duration = outputDelay(frames.length);
    const tick = () => {
      if (token !== state.previewToken) return;
      elements.animationImage.src = frames[index].toDataURL('image/png');
      index = (index + 1) % frames.length;
      state.previewTimer = window.setTimeout(tick, duration);
    };
    tick();
    showOutput(frames[0]);
  }

  const encoder = new TextEncoder();
  const fourCC = (text) => encoder.encode(text);
  const u16 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255]);
  const u24 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255]);
  const u32 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
  const concat = (items) => { const length = items.reduce((sum, item) => sum + item.length, 0); const output = new Uint8Array(length); let offset = 0; items.forEach((item) => { output.set(item, offset); offset += item.length; }); return output; };
  const chunk = (name, payload) => concat([fourCC(name), u32(payload.length), payload, payload.length % 2 ? new Uint8Array([0]) : new Uint8Array()]);
  const fourAt = (bytes, offset) => String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  const uintAt = (bytes, offset) => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;

  async function webpImagePayload(canvas, quality) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp') throw new Error('This browser cannot encode WebP.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (fourAt(bytes, 0) !== 'RIFF' || fourAt(bytes, 8) !== 'WEBP') throw new Error('Invalid WebP frame data.');
    const chunks = [];
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const name = fourAt(bytes, offset);
      const size = uintAt(bytes, offset + 4);
      const end = offset + 8 + size;
      chunks.push({ name, raw: bytes.slice(offset, end + size % 2) });
      offset = end + size % 2;
    }
    const imageChunks = chunks.filter((entry) => ['ALPH', 'VP8 ', 'VP8L'].includes(entry.name));
    return { payload: concat(imageChunks.map((entry) => entry.raw)), alpha: imageChunks.some((entry) => entry.name === 'ALPH' || entry.name === 'VP8L') };
  }

  async function animatedWebP(frames, duration) {
    const width = frames[0].width;
    const height = frames[0].height;
    const quality = $('chk-webp-lossless')?.checked ? 1 : Number($('adj-webp-q')?.value || 80) / 100;
    const encoded = [];
    let alpha = false;
    for (const frame of frames) { const current = await webpImagePayload(frame, quality); encoded.push(current); alpha ||= current.alpha; }
    const header = new Uint8Array(10);
    header[0] = 0x02 | (alpha ? 0x10 : 0);
    header.set(u24(width - 1), 4);
    header.set(u24(height - 1), 7);
    const animation = concat([new Uint8Array([0, 0, 0, 0]), u16(clamp(Number($('play-count')?.value || 0), 0, 65535))]);
    const framesPayload = encoded.map((frame) => chunk('ANMF', concat([u24(0), u24(0), u24(width - 1), u24(height - 1), u24(clamp(duration, 11, 0xFFFFFF)), new Uint8Array([0x02]), frame.payload])));
    const payload = concat([fourCC('WEBP'), chunk('VP8X', header), chunk('ANIM', animation), ...framesPayload]);
    return new Blob([concat([fourCC('RIFF'), u32(payload.length), payload])], { type: 'image/webp' });
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function exportOutput(forceZip = false) {
    stopPreview();
    const frames = await outputFrames();
    if (!frames.length) return notify('Load image frames first.');
    showOutput(frames[0]);
    const format = forceZip ? 'zip' : ($('opt-format')?.value || 'gif');
    const delay = outputDelay(frames.length);
    try {
      if (format === 'zip') {
        if (!window.JSZip) throw new Error('ZIP support is unavailable.');
        const zip = new JSZip();
        const folder = zip.folder(`${safeName()}-frames`);
        const digits = Math.max(3, String(frames.length).length);
        for (let index = 0; index < frames.length; index += 1) {
          const blob = await new Promise((resolve) => frames[index].toBlob(resolve, 'image/png'));
          folder.file(`frame-${String(index + 1).padStart(digits, '0')}.png`, blob);
        }
        saveBlob(await zip.generateAsync({ type: 'blob' }), `${safeName()}-frames.zip`);
        notify('PNG frame ZIP saved.');
        return;
      }
      if (format === 'webp') {
        saveBlob(await animatedWebP(frames, delay), `${safeName()}.webp`);
        notify('Animated WebP saved.');
        return;
      }
      if (!window.gifshot) throw new Error('GIF support is unavailable.');
      window.gifshot.createGIF({ images: frames.map((frame) => frame.toDataURL('image/png')), interval: delay / 1000, gifWidth: frames[0].width, gifHeight: frames[0].height, numWorkers: 2, sampleInterval: 10 }, (result) => {
        if (result.error) { notify('GIF export failed.'); return; }
        const binary = atob(result.image.split(',')[1]);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        saveBlob(new Blob([bytes], { type: 'image/gif' }), `${safeName()}.gif`);
        notify('GIF saved.');
      });
    } catch (error) { notify(`Export error: ${error.message}`); }
  }

  async function previewFrame(groupId, frameId) {
    setActive(groupId, frameId);
    const group = activeGroup();
    const frame = activeFrame(group);
    const canvas = await canvasForFrame(frame, group, { size: 320 });
    elements.previewModal.hidden = false;
    elements.previewImage.src = canvas.toDataURL('image/png');
  }

  async function openAlign(groupId, frameId) {
    state.align = { groupId, frameId };
    setActive(groupId, frameId);
    elements.alignModal.hidden = false;
    renderAlign();
  }

  async function renderAlign() {
    const group = groupById(state.align?.groupId);
    const frame = group?.frames.find((entry) => entry.id === state.align?.frameId);
    if (!group || !frame) return;
    const canvas = await canvasForFrame(frame, group, { size: 300, includeEffects: false, includeGlobal: false });
    elements.alignCanvas.width = canvas.width;
    elements.alignCanvas.height = canvas.height;
    elements.alignCanvas.getContext('2d').drawImage(canvas, 0, 0);
    if ($('align-frame-number')) $('align-frame-number').textContent = `${group.name.toUpperCase()} · FRAME ${group.frames.indexOf(frame) + 1} / ${group.frames.length}`;
    if ($('align-offset')) $('align-offset').textContent = `X: ${frame.x || 0}  Y: ${frame.y || 0}`;
  }

  function nudge(direction) {
    const group = groupById(state.align?.groupId);
    const frame = group?.frames.find((entry) => entry.id === state.align?.frameId);
    if (!frame) return;
    if (direction === 'up') frame.y = (frame.y || 0) - 1;
    if (direction === 'down') frame.y = (frame.y || 0) + 1;
    if (direction === 'left') frame.x = (frame.x || 0) - 1;
    if (direction === 'right') frame.x = (frame.x || 0) + 1;
    state.editBuffer = null;
    renderAlign();
    renderAll();
  }

  function switchFrame(step) {
    const group = activeGroup();
    if (!group?.frames.length) return;
    const current = Math.max(0, group.frames.findIndex((frame) => frame.id === state.activeFrameId));
    const next = (current + step + group.frames.length) % group.frames.length;
    state.activeFrameId = group.frames[next].id;
    state.editorIndex = next;
    state.editBuffer = null;
    renderAll();
  }

  function playEditor() {
    const button = $('editor-play');
    const group = activeGroup();
    if (!group?.frames.length) return;
    if (state.playbackTimer) {
      window.clearInterval(state.playbackTimer);
      state.playbackTimer = null;
      button.textContent = '▶ PLAY';
      return;
    }
    button.textContent = '❚❚ PAUSE';
    state.playbackTimer = window.setInterval(() => switchFrame(1), Number($('frame-delay')?.value || 200));
  }

  function updateActions() {
    const ready = totalFrames() > 0;
    ['open-editor-btn', 'compile-btn', 'zip-btn', 'btn-play-preview'].forEach((id) => { const button = $(id); if (button) button.disabled = !ready; });
    const longest = Math.max(0, ...state.groups.map((group) => group.frames.length));
    if ($('frame-skip-container')) $('frame-skip-container').hidden = longest <= 15;
  }

  function renderAll() {
    installUi();
    normalizeLayers();
    renderGroupControl();
    renderGroups();
    updateActions();
    if (state.editorMode === 'effects') renderEffectPanel();
    renderEditor();
  }

  function intercept() {
    document.addEventListener('change', (event) => {
      if (event.target === elements.imagePicker) {
        event.preventDefault();
        event.stopImmediatePropagation();
        importImages(elements.imagePicker.files, $('ag-v2-import-group')?.value || state.activeGroupId).finally(() => { elements.imagePicker.value = ''; });
      }
      if (event.target === elements.videoPicker) {
        event.preventDefault();
        event.stopImmediatePropagation();
        importVideo(elements.videoPicker.files[0]).finally(() => { elements.videoPicker.value = ''; });
      }
    }, true);

    document.addEventListener('dragover', (event) => {
      const files = [...(event.dataTransfer?.files || [])];
      if (!elements.top.contains(event.target) || !files.some((file) => file.type.startsWith('image/'))) return;
      event.preventDefault();
      elements.top.classList.add('ag-drop-active');
    }, true);
    document.addEventListener('dragleave', (event) => { if (elements.top.contains(event.target)) elements.top.classList.remove('ag-drop-active'); }, true);
    document.addEventListener('drop', (event) => {
      const files = [...(event.dataTransfer?.files || [])];
      if (!elements.top.contains(event.target) || !files.some((file) => file.type.startsWith('image/'))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      elements.top.classList.remove('ag-drop-active');
      importImages(files, $('ag-v2-import-group')?.value || state.activeGroupId);
    }, true);

    document.addEventListener('paste', (event) => {
      const files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
      if (!files.length || document.activeElement?.matches('input,textarea,select')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      importImages(files, state.activeGroupId);
    }, true);

    document.addEventListener('click', (event) => {
      const button = event.target.closest('button, [data-close]');
      if (!button) return;
      const id = button.id;
      const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
      if (id === 'open-editor-btn') { stop(); setMode('edit'); return; }
      if (id === 'compile-btn') { stop(); exportOutput(false); return; }
      if (id === 'zip-btn') { stop(); exportOutput(true); return; }
      if (id === 'btn-play-preview') { stop(); previewAnimation(); return; }
      if (id === 'editor-prev') { stop(); switchFrame(-1); return; }
      if (id === 'editor-next') { stop(); switchFrame(1); return; }
      if (id === 'editor-play') { stop(); playEditor(); return; }
      if (id === 'view-final') { stop(); state.editorView = 'final'; renderEditor(); return; }
      if (id === 'view-original') { stop(); state.editorView = 'original'; renderEditor(); return; }
      if (id === 'zoom-in' || id === 'zoom-out' || id === 'zoom-fit' || id === 'zoom-reset') {
        stop();
        if (id === 'zoom-in') state.zoom = clamp(state.zoom + .25, .5, 5);
        if (id === 'zoom-out') state.zoom = clamp(state.zoom - .25, .5, 5);
        if (id === 'zoom-fit' || id === 'zoom-reset') { state.zoom = 1; state.panX = 0; state.panY = 0; }
        fitCanvas();
        return;
      }
      if (button.dataset.nudge) { stop(); nudge(button.dataset.nudge); return; }
      if (id === 'reset-align') { stop(); const group = groupById(state.align?.groupId); const frame = group?.frames.find((entry) => entry.id === state.align?.frameId); if (frame) { frame.x = 0; frame.y = 0; state.editBuffer = null; renderAlign(); renderAll(); } return; }
      if (id === 'align-prev' || id === 'align-next') { stop(); const group = groupById(state.align?.groupId); if (!group?.frames.length) return; const current = Math.max(0, group.frames.findIndex((frame) => frame.id === state.align.frameId)); const next = (current + (id === 'align-prev' ? -1 : 1) + group.frames.length) % group.frames.length; state.align.frameId = group.frames[next].id; renderAlign(); return; }
      if (button.dataset.close === 'anim-preview-modal') stopPreview();
    }, true);

    elements.editorCanvas.addEventListener('pointerdown', (event) => { event.stopImmediatePropagation(); pointerDown(event); }, true);
    elements.editorCanvas.addEventListener('pointermove', (event) => { event.stopImmediatePropagation(); pointerMove(event); }, true);
    elements.editorCanvas.addEventListener('pointerup', (event) => { event.stopImmediatePropagation(); pointerUp(event); }, true);
    elements.editorCanvas.addEventListener('pointercancel', (event) => { event.stopImmediatePropagation(); pointerUp(event); }, true);

    ['adj-bright', 'adj-contrast', 'adj-exp', 'adj-sat', 'chk-transparent', 'adj-color', 'adj-tol', 'adj-smooth', 'chk-shadow', 'shadow-color', 'shadow-opacity', 'shadow-blur', 'shadow-x', 'shadow-y', 'max-dimension'].forEach((id) => $(id)?.addEventListener('input', renderEditor, true));
    window.addEventListener('resize', fitCanvas);
  }

  createGroup('Group 1');
  installUi();
  intercept();
  renderAll();
})();