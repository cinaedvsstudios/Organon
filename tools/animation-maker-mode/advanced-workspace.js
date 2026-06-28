(() => {
  'use strict';

  if (!document.body.classList.contains('is-advanced-mode')) return;

  const $ = (id) => document.getElementById(id);
  const state = {
    editorMode: 'edit',
    selectionEnabled: false,
    selection: { active: false, x: 0, y: 0, w: 0, h: 0, dragging: false, dragMode: 'create', startX: 0, startY: 0, lastX: 0, lastY: 0 },
    grid: { visible: false, scale: 1 },
    frameOverrides: new Map(),
    transform: { type: null, index: null, base: null, open: false },
    bottomTimer: null,
    editorOpened: false
  };

  const queueCard = $('queue-card');
  const frameGrid = $('frame-grid');
  const imagePicker = $('image-picker');
  const editorModal = $('frame-editor-modal');
  const editorWindow = $('editor-window');
  const editorButton = $('open-editor-btn');
  const editorNav = editorWindow?.querySelector('.editor-nav');
  const editorHeader = editorWindow?.querySelector('.editor-header');
  const editorTools = editorWindow?.querySelector('.editor-tools');
  const canvas = $('frame-editor-canvas');
  const canvasViewport = $('canvas-viewport');
  const topPanel = $('top-panel');
  const bottomPanel = document.querySelector('.bottom-sticky-panel');
  const title = document.querySelector('.title-left span');

  if (!queueCard || !frameGrid || !imagePicker || !editorModal || !editorWindow || !editorButton || !editorNav || !editorHeader || !editorTools || !canvas || !canvasViewport || !topPanel || !bottomPanel || !title) return;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const notify = (text) => {
    try { window.parent.postMessage({ type: 'set-status', text }, '*'); } catch (error) {}
    window.setTimeout(() => { try { window.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {} }, 3600);
  };

  function copyCanvas(source, width = source.width, height = source.height) {
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    output.getContext('2d').drawImage(source, 0, 0, width, height);
    return output;
  }

  function currentFrameIndex() {
    const match = ($('editor-frame-number')?.textContent || '').match(/FRAME\s+(\d+)/i);
    return match ? Math.max(0, parseInt(match[1], 10) - 1) : 0;
  }

  function currentOverride(index = currentFrameIndex(), fallback = canvas) {
    const override = state.frameOverrides.get(index);
    return override ? copyCanvas(override, fallback.width, fallback.height) : copyCanvas(fallback);
  }

  function drawOverride(index = currentFrameIndex()) {
    const override = state.frameOverrides.get(index);
    if (!override || !canvas.width || !canvas.height) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(override, 0, 0, canvas.width, canvas.height);
    updateOverlays();
  }

  function scheduleOverride(index = currentFrameIndex()) {
    [20, 85, 180].forEach((delayMs) => {
      window.setTimeout(() => {
        if (index === currentFrameIndex() && !state.transform.open) drawOverride(index);
      }, delayMs);
    });
  }

  function saveOverride(index, source) {
    state.frameOverrides.set(index, copyCanvas(source));
    drawOverride(index);
    scheduleOverride(index);
  }

  function regionFor(source) {
    const selection = state.selection;
    if (!selection.active || selection.w <= .004 || selection.h <= .004) {
      return { x: 0, y: 0, w: source.width, h: source.height, full: true };
    }
    const x = Math.round(selection.x * source.width);
    const y = Math.round(selection.y * source.height);
    const w = Math.max(1, Math.round(selection.w * source.width));
    const h = Math.max(1, Math.round(selection.h * source.height));
    return { x, y, w, h, full: false };
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The clipboard image could not be read.'));
      image.src = source;
    });
  }

  async function clipboardImage() {
    if (!navigator.clipboard?.read) throw new Error('Clipboard image access is unavailable in this browser.');
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((entry) => entry.startsWith('image/'));
      if (!type) continue;
      return { blob: await item.getType(type), type };
    }
    throw new Error('No image was found in the clipboard.');
  }

  function keepVisible(element) {
    if (!element) return;
    element.hidden = false;
    element.removeAttribute('hidden');
    if (element.dataset.advancedVisible === 'true') return;
    new MutationObserver(() => {
      element.hidden = false;
      element.removeAttribute('hidden');
    }).observe(element, { attributes: true, attributeFilter: ['hidden'] });
    element.dataset.advancedVisible = 'true';
  }

  function importFiles(files) {
    if (!files.length) return;
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    imagePicker.files = transfer.files;
    imagePicker.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function pasteFrames() {
    try {
      const { blob, type } = await clipboardImage();
      const suffix = type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1];
      importFiles([new File([blob], `clipboard-frame-${Date.now()}.${suffix}`, { type })]);
      notify('Clipboard frame added to the sequence.');
    } catch (error) {
      notify(error.message);
    }
  }

  async function pasteIntoFrame() {
    try {
      const { blob } = await clipboardImage();
      const url = URL.createObjectURL(blob);
      const image = await loadImage(url);
      URL.revokeObjectURL(url);
      const index = currentFrameIndex();
      const output = currentOverride(index);
      const region = regionFor(output);
      const context = output.getContext('2d');
      context.clearRect(region.x, region.y, region.w, region.h);
      context.drawImage(image, region.x, region.y, region.w, region.h);
      saveOverride(index, output);
      notify(region.full ? 'Clipboard image pasted into the current frame.' : 'Clipboard image pasted into the selection.');
    } catch (error) {
      notify(error.message);
    }
  }

  async function pasteAsNewFrame() {
    try {
      const { blob, type } = await clipboardImage();
      const suffix = type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1];
      importFiles([new File([blob], `pasted-frame-${Date.now()}.${suffix}`, { type })]);
      notify('Clipboard image added as a new frame at the end of the sequence.');
    } catch (error) {
      notify(error.message);
    }
  }

  function copyVisibleFrame() {
    if (!canvas.width || !canvas.height) return notify('Load a frame before copying.');
    const source = currentOverride();
    const region = regionFor(source);
    const result = document.createElement('canvas');
    result.width = region.w;
    result.height = region.h;
    result.getContext('2d').drawImage(source, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
    result.toBlob(async (blob) => {
      try {
        if (!blob || !navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard write unavailable');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        notify(state.selection.active ? 'Selection copied.' : 'Current frame copied.');
      } catch (error) {
        notify('Browser clipboard write was blocked.');
      }
    }, 'image/png');
  }

  function clearCurrentFrame() {
    if (!canvas.width || !canvas.height) return notify('Load a frame before clearing.');
    const index = currentFrameIndex();
    const output = currentOverride(index);
    const region = regionFor(output);
    output.getContext('2d').clearRect(region.x, region.y, region.w, region.h);
    saveOverride(index, output);
    notify(region.full ? 'Current frame cleared.' : 'Selection cleared in the current frame.');
  }

  function applyTransform(source, type, value) {
    const output = copyCanvas(source);
    const region = regionFor(output);
    const crop = document.createElement('canvas');
    crop.width = region.w;
    crop.height = region.h;
    crop.getContext('2d').drawImage(source, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
    const context = output.getContext('2d');
    context.save();
    context.beginPath();
    context.rect(region.x, region.y, region.w, region.h);
    context.clip();
    context.clearRect(region.x, region.y, region.w, region.h);
    context.translate(region.x + region.w / 2, region.y + region.h / 2);
    if (type === 'scale') context.scale(value / 100, value / 100);
    if (type === 'rotate') context.rotate(value * Math.PI / 180);
    context.drawImage(crop, -region.w / 2, -region.h / 2);
    context.restore();
    return output;
  }

  function transformControls() {
    return $('advanced-transform-panel');
  }

  function closeTransform(commit) {
    const panel = transformControls();
    if (!state.transform.open) return;
    const index = state.transform.index;
    const type = state.transform.type;
    const slider = $('advanced-transform-slider');
    const value = Number(slider?.value || 0);
    if (commit) {
      saveOverride(index, applyTransform(state.transform.base, type, value));
      notify(type === 'scale' ? `Scaled ${state.selection.active ? 'selection' : 'current frame'} to ${value}%.` : `Rotated ${state.selection.active ? 'selection' : 'current frame'} by ${value}°.`);
    } else if (index === currentFrameIndex()) {
      const existing = state.frameOverrides.get(index);
      if (existing) drawOverride(index);
      else {
        const original = copyCanvas(state.transform.base);
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(original, 0, 0, canvas.width, canvas.height);
        updateOverlays();
      }
    }
    state.transform = { type: null, index: null, base: null, open: false };
    if (panel) panel.hidden = true;
  }

  function previewTransform() {
    if (!state.transform.open || state.transform.index !== currentFrameIndex()) return;
    const slider = $('advanced-transform-slider');
    const value = Number(slider?.value || 0);
    const readout = $('advanced-transform-value');
    if (readout) readout.textContent = state.transform.type === 'scale' ? `${value}%` : `${value}°`;
    const preview = applyTransform(state.transform.base, state.transform.type, value);
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(preview, 0, 0, canvas.width, canvas.height);
    updateOverlays();
  }

  function openTransform(type) {
    if (!canvas.width || !canvas.height) return notify('Load a frame before transforming.');
    const panel = transformControls();
    if (!panel) return;
    if (state.transform.open) closeTransform(false);
    state.transform = {
      type,
      index: currentFrameIndex(),
      base: currentOverride(),
      open: true
    };
    const slider = $('advanced-transform-slider');
    const title = $('advanced-transform-title');
    const readout = $('advanced-transform-value');
    if (type === 'scale') {
      title.textContent = state.selection.active ? 'SCALE SELECTION' : 'SCALE FRAME';
      slider.min = '10';
      slider.max = '300';
      slider.step = '1';
      slider.value = '100';
      readout.textContent = '100%';
    } else {
      title.textContent = state.selection.active ? 'ROTATE SELECTION' : 'ROTATE FRAME';
      slider.min = '-180';
      slider.max = '180';
      slider.step = '1';
      slider.value = '0';
      readout.textContent = '0°';
    }
    panel.hidden = false;
    previewTransform();
  }

  function realignCurrentFrame() {
    const alignButton = [...document.querySelectorAll('.frame-align-btn')][currentFrameIndex()];
    if (alignButton) alignButton.click();
    else notify('Load a frame before realigning.');
  }

  function initCards() {
    ['queue-card', 'advanced-webp-card', 'output-card'].forEach((id) => keepVisible($(id)));
    const heading = queueCard.querySelector('h3');
    if (heading && !$('paste-clipboard-frames')) {
      heading.textContent = '1. Frames & Sequence';
      const row = document.createElement('div');
      row.className = 'advanced-card-heading';
      heading.parentNode.insertBefore(row, heading);
      row.appendChild(heading);
      const pasteButton = document.createElement('button');
      pasteButton.type = 'button';
      pasteButton.id = 'paste-clipboard-frames';
      pasteButton.className = 'mini-action advanced-paste-btn';
      pasteButton.textContent = 'PASTE FROM CLIPBOARD';
      pasteButton.addEventListener('click', pasteFrames);
      row.appendChild(pasteButton);
    }

    let editorCard = $('advanced-editor-card');
    if (!editorCard) {
      editorCard = document.createElement('section');
      editorCard.id = 'advanced-editor-card';
      editorCard.className = 'config-card advanced-editor-card';
      editorCard.innerHTML = '<div class="advanced-card-heading"><h3>2. Frame Editor</h3></div><div class="advanced-inline-editor-host"></div>';
      queueCard.insertAdjacentElement('afterend', editorCard);
    }
    const host = editorCard.querySelector('.advanced-inline-editor-host');
    if (!host.contains(editorWindow)) host.appendChild(editorWindow);
    editorModal.hidden = false;
    editorModal.classList.add('advanced-inline-editor');
    editorWindow.querySelector('.editor-close')?.setAttribute('hidden', '');
    editorWindow.querySelector('.editor-footer [data-close="frame-editor-modal"]')?.setAttribute('hidden', '');
    new MutationObserver(() => { if (editorModal.hidden) editorModal.hidden = false; }).observe(editorModal, { attributes: true, attributeFilter: ['hidden'] });

    const updateReadyState = () => {
      const ready = !editorButton.disabled && Boolean(frameGrid.querySelector('.frame-thumb-wrapper'));
      editorCard.classList.toggle('has-frames', ready);
      editorCard.dataset.editorState = ready ? 'ready' : 'empty';
      if (ready && !state.editorOpened) {
        state.editorOpened = true;
        window.requestAnimationFrame(() => editorButton.click());
      }
      updateOverlays();
    };
    new MutationObserver(updateReadyState).observe(frameGrid, { childList: true, subtree: true });
    new MutationObserver(updateReadyState).observe(editorButton, { attributes: true, attributeFilter: ['disabled'] });
    updateReadyState();

    const adjustHeading = $('adjust-card')?.querySelector('h3');
    const settingsHeading = $('settings-card')?.querySelector('h3');
    const webpHeading = $('advanced-webp-card')?.querySelector('h3');
    const outputHeading = $('output-card')?.querySelector('h3');
    if (adjustHeading) adjustHeading.textContent = '3. Visual Adjustments';
    if (settingsHeading) settingsHeading.textContent = '5. Animation Settings';
    if (webpHeading) webpHeading.textContent = '6. WebP Advanced Settings';
    if (outputHeading) outputHeading.textContent = '7. Synthesized Core Output';
  }

  function initEditorToolbar() {
    const titleNode = editorHeader.querySelector('h2');
    const viewControls = editorNav.querySelector('.segmented');
    const toolGrid = $('tool-grid');
    const targetMode = $('target-mode');
    const modeGroup = targetMode?.closest('.tool-group');
    const cutoutPanel = $('cutout-panel');
    const paintPanel = $('paint-panel');
    const movingPanel = $('moving-panel');
    if (!titleNode || !viewControls || !toolGrid || !targetMode || !modeGroup || !cutoutPanel || !paintPanel || !movingPanel) return;

    editorHeader.querySelector('.advanced-editor-menu')?.remove();
    editorNav.querySelector('.advanced-editor-actions')?.remove();
    editorNav.querySelector('.advanced-tool-strip')?.remove();
    editorNav.querySelector('.advanced-grid-controls')?.remove();
    editorNav.querySelector('.advanced-transform-panel')?.remove();

    const menu = document.createElement('div');
    menu.className = 'advanced-editor-menu';
    menu.innerHTML = '<button type="button" class="active" data-editor-mode="edit">EDIT</button><button type="button" data-editor-mode="paint">PAINT</button><button type="button" data-editor-mode="select">SELECT</button>';
    titleNode.insertAdjacentElement('afterend', menu);

    const actions = document.createElement('div');
    actions.className = 'advanced-editor-actions';
    actions.innerHTML = '<button type="button" id="advanced-paste-into">PASTE INTO FRAME</button><button type="button" id="advanced-paste-new">PASTE AS NEW FRAME</button><button type="button" id="advanced-copy-frame">COPY</button><button type="button" id="advanced-clear-frame">CLEAR</button><button type="button" id="advanced-scale-frame">SCALE</button><button type="button" id="advanced-rotate-frame">ROTATE</button><button type="button" id="advanced-realign-frame">REALIGN</button>';
    editorNav.insertBefore(actions, viewControls);
    $('advanced-paste-into')?.addEventListener('click', pasteIntoFrame);
    $('advanced-paste-new')?.addEventListener('click', pasteAsNewFrame);
    $('advanced-copy-frame')?.addEventListener('click', copyVisibleFrame);
    $('advanced-clear-frame')?.addEventListener('click', clearCurrentFrame);
    $('advanced-scale-frame')?.addEventListener('click', () => openTransform('scale'));
    $('advanced-rotate-frame')?.addEventListener('click', () => openTransform('rotate'));
    $('advanced-realign-frame')?.addEventListener('click', realignCurrentFrame);

    const transformPanel = document.createElement('div');
    transformPanel.className = 'advanced-transform-panel';
    transformPanel.id = 'advanced-transform-panel';
    transformPanel.hidden = true;
    transformPanel.innerHTML = '<span id="advanced-transform-title">TRANSFORM</span><input type="range" id="advanced-transform-slider"><b id="advanced-transform-value">0</b><button type="button" id="advanced-transform-apply">APPLY</button><button type="button" id="advanced-transform-cancel">CANCEL</button>';
    editorNav.insertBefore(transformPanel, viewControls);
    $('advanced-transform-slider')?.addEventListener('input', previewTransform);
    $('advanced-transform-apply')?.addEventListener('click', () => closeTransform(true));
    $('advanced-transform-cancel')?.addEventListener('click', () => closeTransform(false));

    const toolStrip = document.createElement('div');
    toolStrip.className = 'advanced-tool-strip';
    toolStrip.appendChild(toolGrid);
    editorNav.insertBefore(toolStrip, viewControls);

    const gridControls = document.createElement('div');
    gridControls.className = 'advanced-grid-controls';
    gridControls.innerHTML = '<button type="button" id="advanced-grid-toggle">GRID</button><button type="button" id="advanced-grid-size">GRID SIZE</button><div id="advanced-grid-size-popover" hidden><span>GRID SIZE <b id="advanced-grid-size-value">1×</b></span><input id="advanced-grid-size-slider" type="range" min="1" max="10" value="1"></div>';
    editorNav.insertBefore(gridControls, viewControls);

    const clearAll = $('reset-all-edits');
    if (clearAll) {
      clearAll.classList.add('advanced-clear-all');
      viewControls.appendChild(clearAll);
      clearAll.addEventListener('click', () => {
        state.frameOverrides.clear();
        closeTransform(false);
        window.setTimeout(() => scheduleOverride(), 30);
      });
    }

    modeGroup.querySelector('h4').textContent = 'Move Selection';
    targetMode.hidden = true;
    let selectionControls = $('advanced-selection-controls');
    if (!selectionControls) {
      selectionControls = document.createElement('div');
      selectionControls.id = 'advanced-selection-controls';
      selectionControls.innerHTML = '<button type="button" id="advanced-move-selection">MOVE SELECTION</button><button type="button" id="advanced-clear-selection">CLEAR SELECTION</button><p class="tool-tip-text">Turn this on, then drag in the canvas to create or reposition one persistent selection.</p>';
      modeGroup.appendChild(selectionControls);
    }
    $('advanced-move-selection')?.addEventListener('click', () => {
      state.selectionEnabled = !state.selectionEnabled;
      const button = $('advanced-move-selection');
      button.classList.toggle('active', state.selectionEnabled);
      button.textContent = state.selectionEnabled ? 'MOVE SELECTION: ON' : 'MOVE SELECTION';
    });
    $('advanced-clear-selection')?.addEventListener('click', () => {
      state.selection.active = false;
      state.selectionEnabled = false;
      const button = $('advanced-move-selection');
      if (button) {
        button.classList.remove('active');
        button.textContent = 'MOVE SELECTION';
      }
      updateOverlays();
    });

    const nativeTools = [...toolGrid.querySelectorAll('[data-tool]')];
    const showTools = (allowed) => nativeTools.forEach((tool) => { tool.hidden = !allowed.includes(tool.dataset.tool); });
    const click = (selector) => document.querySelector(selector)?.click();
    function setEditorMode(mode) {
      if (state.transform.open) closeTransform(false);
      state.editorMode = mode;
      menu.querySelectorAll('[data-editor-mode]').forEach((button) => button.classList.toggle('active', button.dataset.editorMode === mode));
      actions.hidden = mode !== 'edit';
      toolStrip.hidden = mode === 'edit';
      editorTools.hidden = mode === 'edit';
      modeGroup.hidden = mode !== 'select';
      cutoutPanel.hidden = mode !== 'select';
      paintPanel.hidden = mode !== 'paint';
      movingPanel.hidden = true;
      targetMode.hidden = true;
      if (mode === 'paint') {
        showTools(['brush', 'bucket']);
        click('#target-mode [data-target="paint"]');
        click('#tool-grid [data-tool="brush"]');
      }
      if (mode === 'select') {
        showTools(['pan', 'rect', 'lasso', 'polygon']);
        click('#target-mode [data-target="cutout"]');
        click('#tool-grid [data-tool="rect"]');
      }
      updateOverlays();
    }
    menu.addEventListener('click', (event) => {
      const mode = event.target.closest('[data-editor-mode]')?.dataset.editorMode;
      if (mode) setEditorMode(mode);
    });
    $('advanced-grid-toggle')?.addEventListener('click', () => {
      state.grid.visible = !state.grid.visible;
      $('advanced-grid-toggle').classList.toggle('active', state.grid.visible);
      updateOverlays();
    });
    $('advanced-grid-size')?.addEventListener('click', () => {
      const popover = $('advanced-grid-size-popover');
      if (popover) popover.hidden = !popover.hidden;
    });
    $('advanced-grid-size-slider')?.addEventListener('input', (event) => {
      state.grid.scale = Number(event.target.value) || 1;
      const value = $('advanced-grid-size-value');
      if (value) value.textContent = `${state.grid.scale}×`;
      updateOverlays();
    });
    setEditorMode('edit');
  }

  function ensureOverlay(id, markup) {
    let element = $(id);
    if (!element) {
      element = document.createElement('div');
      element.id = id;
      element.innerHTML = markup;
      canvasViewport.appendChild(element);
    }
    return element;
  }

  function updateOverlays() {
    const gridOverlay = ensureOverlay('advanced-grid-overlay', '<span id="advanced-grid-centre"></span>');
    const selectionOverlay = ensureOverlay('advanced-selection-box', '<span>SELECTION</span>');
    const canvasRect = canvas.getBoundingClientRect();
    const viewportRect = canvasViewport.getBoundingClientRect();
    if (!canvas.width || !canvas.height || !canvasRect.width || !canvasRect.height) return;
    const left = canvasRect.left - viewportRect.left;
    const top = canvasRect.top - viewportRect.top;
    gridOverlay.style.left = `${left}px`;
    gridOverlay.style.top = `${top}px`;
    gridOverlay.style.width = `${canvasRect.width}px`;
    gridOverlay.style.height = `${canvasRect.height}px`;
    gridOverlay.style.backgroundSize = `${Math.max(2, canvasRect.width / canvas.width * 10 * state.grid.scale)}px ${Math.max(2, canvasRect.height / canvas.height * 10 * state.grid.scale)}px`;
    gridOverlay.hidden = !state.grid.visible;
    const selection = state.selection;
    const selected = selection.active && selection.w > .004 && selection.h > .004;
    selectionOverlay.hidden = !selected;
    if (!selected) return;
    selectionOverlay.style.left = `${left + selection.x * canvasRect.width}px`;
    selectionOverlay.style.top = `${top + selection.y * canvasRect.height}px`;
    selectionOverlay.style.width = `${selection.w * canvasRect.width}px`;
    selectionOverlay.style.height = `${selection.h * canvasRect.height}px`;
  }

  function initSelection() {
    const pointFor = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
    };
    const selectionContains = (point) => {
      const selection = state.selection;
      return selection.active && point.x >= selection.x && point.x <= selection.x + selection.w && point.y >= selection.y && point.y <= selection.y + selection.h;
    };
    canvas.addEventListener('pointerdown', (event) => {
      if (state.editorMode !== 'select' || !state.selectionEnabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const point = pointFor(event);
      const selection = state.selection;
      selection.dragging = true;
      canvas.setPointerCapture?.(event.pointerId);
      if (selectionContains(point)) {
        selection.dragMode = 'move';
        selection.lastX = point.x;
        selection.lastY = point.y;
      } else {
        selection.dragMode = 'create';
        selection.active = true;
        selection.startX = point.x;
        selection.startY = point.y;
        selection.x = point.x;
        selection.y = point.y;
        selection.w = 0;
        selection.h = 0;
      }
      updateOverlays();
    }, true);
    canvas.addEventListener('pointermove', (event) => {
      const selection = state.selection;
      if (!selection.dragging || state.editorMode !== 'select' || !state.selectionEnabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const point = pointFor(event);
      if (selection.dragMode === 'move') {
        selection.x = clamp(selection.x + point.x - selection.lastX, 0, 1 - selection.w);
        selection.y = clamp(selection.y + point.y - selection.lastY, 0, 1 - selection.h);
        selection.lastX = point.x;
        selection.lastY = point.y;
      } else {
        selection.x = Math.min(selection.startX, point.x);
        selection.y = Math.min(selection.startY, point.y);
        selection.w = Math.abs(point.x - selection.startX);
        selection.h = Math.abs(point.y - selection.startY);
      }
      updateOverlays();
    }, true);
    const finish = (event) => {
      const selection = state.selection;
      if (!selection.dragging) return;
      selection.dragging = false;
      canvas.releasePointerCapture?.(event.pointerId);
      if (selection.w <= .004 || selection.h <= .004) selection.active = false;
      updateOverlays();
    };
    canvas.addEventListener('pointerup', finish, true);
    canvas.addEventListener('pointercancel', finish, true);
  }

  function initBottomPanel() {
    bottomPanel.classList.add('advanced-auto-panel');
    const locked = () => document.body.classList.contains('advanced-workspace-locked');
    const show = () => {
      if (locked()) return;
      window.clearTimeout(state.bottomTimer);
      bottomPanel.classList.remove('is-auto-hidden');
    };
    const hideLater = () => {
      window.clearTimeout(state.bottomTimer);
      if (locked()) {
        bottomPanel.classList.add('is-auto-hidden');
        return;
      }
      state.bottomTimer = window.setTimeout(() => bottomPanel.classList.add('is-auto-hidden'), 2200);
    };
    bottomPanel.addEventListener('mouseenter', show);
    bottomPanel.addEventListener('mouseleave', hideLater);
    bottomPanel.addEventListener('focusin', show);
    bottomPanel.addEventListener('focusout', hideLater);
    document.addEventListener('pointermove', (event) => {
      if (!locked() && event.clientY >= window.innerHeight - 36) show();
    }, { passive: true });
    hideLater();
  }

  function initLock() {
    if ($('advanced-workspace-lock')) return;
    const lock = document.createElement('button');
    lock.type = 'button';
    lock.id = 'advanced-workspace-lock';
    lock.className = 'advanced-workspace-lock';
    lock.textContent = '🔓';
    lock.title = 'Lock the top and bottom panels out of the workspace';
    lock.setAttribute('aria-pressed', 'false');
    title.insertAdjacentElement('afterend', lock);
    lock.addEventListener('click', (event) => {
      event.stopPropagation();
      const next = !document.body.classList.contains('advanced-workspace-locked');
      document.body.classList.toggle('advanced-workspace-locked', next);
      lock.textContent = next ? '🔒' : '🔓';
      lock.title = next ? 'Unlock top and bottom panels' : 'Lock the top and bottom panels out of the workspace';
      lock.setAttribute('aria-pressed', String(next));
      if (next) {
        topPanel.classList.add('minimized');
        bottomPanel.classList.add('is-auto-hidden');
      }
    });
  }

  document.addEventListener('paste', (event) => {
    const target = event.target;
    if (target && (target.matches('input, textarea, select') || target.isContentEditable)) return;
    const files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault();
    importFiles(files);
    notify(`${files.length} pasted frame${files.length === 1 ? '' : 's'} added.`);
  });

  window.AnimationMakerAdvanced = {
    hasFrameEdits: () => state.frameOverrides.size > 0,
    getFrameCanvas: (index, fallback) => state.frameOverrides.has(index) ? copyCanvas(state.frameOverrides.get(index), fallback.width, fallback.height) : copyCanvas(fallback),
    redrawCurrent: () => scheduleOverride()
  };

  initCards();
  initEditorToolbar();
  initSelection();
  initBottomPanel();
  initLock();
  ['editor-next', 'editor-prev', 'zoom-in', 'zoom-out', 'zoom-fit', 'zoom-reset', 'view-final', 'view-original'].forEach((id) => {
    $(id)?.addEventListener('click', () => {
      if (state.transform.open) closeTransform(false);
      window.setTimeout(updateOverlays, 40);
      scheduleOverride();
    });
  });
  canvas.addEventListener('pointerup', () => scheduleOverride());
  new ResizeObserver(updateOverlays).observe(canvasViewport);
  window.addEventListener('resize', updateOverlays);
  updateOverlays();
})();
