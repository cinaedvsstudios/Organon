(() => {
  'use strict';
  if (!document.body.classList.contains('is-advanced-mode')) return;

  const $ = (id) => document.getElementById(id);
  const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const queueCard = $('queue-card');
  const imagePicker = $('image-picker');
  const editorButton = $('open-editor-btn');
  const frameGrid = $('frame-grid');
  const editorModal = $('frame-editor-modal');
  const editorWindow = $('editor-window');
  const canvas = $('frame-editor-canvas');
  const canvasViewport = $('canvas-viewport');

  if (!queueCard || !imagePicker || !editorButton || !frameGrid || !editorModal || !editorWindow || !canvas || !canvasViewport) return;

  const selection = { active: false, x: 0, y: 0, w: 0, h: 0, dragging: false, mode: 'create', pointX: 0, pointY: 0 };
  const grid = { shown: false, scale: 1 };
  let workMode = 'edit';
  let moveSelection = false;

  const frameImages = () => [...document.querySelectorAll('#frame-grid .frame-thumb-wrapper img')];
  const clipRemoveButtons = () => [...document.querySelectorAll('#frame-grid .clip-remove-btn')];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function status(text) {
    try { window.parent.postMessage({ type: 'set-status', text }, '*'); } catch (error) {}
    window.setTimeout(() => { try { window.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {} }, 3600);
  }

  function unhide(card) {
    if (!card) return;
    card.hidden = false;
    card.removeAttribute('hidden');
    if (card.dataset.advancedVisible) return;
    new MutationObserver(() => { card.hidden = false; card.removeAttribute('hidden'); }).observe(card, { attributes: true, attributeFilter: ['hidden'] });
    card.dataset.advancedVisible = 'true';
  }

  function clipboardFiles() {
    return navigator.clipboard?.read?.().then(async (items) => {
      const files = [];
      for (const item of items) {
        const type = item.types.find((entry) => entry.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        files.push(new File([blob], `clipboard-frame-${Date.now()}-${files.length + 1}.${type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1]}`, { type }));
      }
      return files;
    });
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
      const files = await clipboardFiles();
      if (!files.length) return status('No image was found in the clipboard.');
      importFiles(files);
      status(`${files.length} clipboard frame${files.length === 1 ? '' : 's'} added.`);
    } catch (error) {
      status('Clipboard permission was blocked. Copy an image, then press Ctrl+V in this workspace.');
    }
  }

  function addQueueHeading() {
    const heading = queueCard.querySelector('h3');
    if (!heading || $('paste-clipboard-frames')) return;
    heading.textContent = '1. Frames & Sequence';
    const row = document.createElement('div');
    row.className = 'advanced-card-heading';
    heading.parentNode.insertBefore(row, heading);
    row.appendChild(heading);
    const paste = document.createElement('button');
    paste.type = 'button';
    paste.id = 'paste-clipboard-frames';
    paste.className = 'mini-action advanced-paste-btn';
    paste.textContent = 'PASTE FROM CLIPBOARD';
    paste.addEventListener('click', pasteFrames);
    row.appendChild(paste);
  }

  function embedEditor() {
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
    editorModal.classList.add('advanced-inline-editor-host-modal');
    editorWindow.querySelector('.editor-close')?.setAttribute('hidden', '');
    editorWindow.querySelector('.editor-footer [data-close="frame-editor-modal"]')?.setAttribute('hidden', '');
    new MutationObserver(() => { if (editorModal.hidden) editorModal.hidden = false; }).observe(editorModal, { attributes: true, attributeFilter: ['hidden'] });

    const sync = () => {
      const ready = !editorButton.disabled && Boolean(frameGrid.querySelector('.frame-thumb-wrapper'));
      editorCard.classList.toggle('has-frames', ready);
      editorCard.dataset.editorState = ready ? 'ready' : 'empty';
      if (ready && !editorCard.dataset.opened) {
        editorCard.dataset.opened = 'true';
        window.requestAnimationFrame(() => editorButton.click());
      }
      updateOverlays();
    };
    new MutationObserver(sync).observe(frameGrid, { childList: true, subtree: true });
    new MutationObserver(sync).observe(editorButton, { attributes: true, attributeFilter: ['disabled'] });
    sync();
    return editorCard;
  }

  function frameIndex() {
    const count = frameImages().length;
    const match = ($('editor-frame-number')?.textContent || '').match(/FRAME\s+(\d+)/i);
    return Math.max(0, Math.min(Math.max(0, count - 1), match ? parseInt(match[1], 10) - 1 : 0));
  }

  function hasSelection() {
    return selection.active && selection.w > .004 && selection.h > .004;
  }

  function selectionRect(width, height) {
    const x = clamp(Math.round(selection.x * width), 0, width);
    const y = clamp(Math.round(selection.y * height), 0, height);
    return { x, y, w: clamp(Math.round(selection.w * width), 1, width - x), h: clamp(Math.round(selection.h * height), 1, height - y) };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function toCanvas(image) {
    const output = document.createElement('canvas');
    output.width = image.naturalWidth || image.width;
    output.height = image.naturalHeight || image.height;
    output.getContext('2d').drawImage(image, 0, 0, output.width, output.height);
    return output;
  }

  async function clipboardDataUrl() {
    const files = await clipboardFiles();
    if (!files.length) throw new Error('No image');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(files[0]);
    });
  }

  async function waitFor(test, timeout = 16000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (test()) return true;
      await delay(60);
    }
    return false;
  }

  async function makeFile(source, index) {
    const blob = await (await fetch(source)).blob();
    return new File([blob], `edited-frame-${String(index + 1).padStart(3, '0')}.png`, { type: 'image/png' });
  }

  async function rebuild(sources, focus) {
    const oldFrameCount = frameImages().length;
    const oldClipCount = clipRemoveButtons().length;
    if (!oldFrameCount || !sources.length) return;

    status('Applying frame edit…');
    const files = await Promise.all(sources.map(makeFile));
    importFiles(files);
    if (!await waitFor(() => frameImages().length >= oldFrameCount + sources.length)) return status('The edited frame import did not finish.');

    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      for (let index = 0; index < oldClipCount; index += 1) {
        const remove = clipRemoveButtons()[0];
        if (!remove) break;
        remove.click();
        await delay(90);
      }
    } finally {
      window.confirm = originalConfirm;
    }

    editorButton.click();
    for (let index = 0; index < focus; index += 1) $('editor-next')?.click();
    updateOverlays();
    status('Frame edit applied.');
  }

  async function mutateCurrent(mutator) {
    const sources = frameImages().map((image) => image.src);
    const index = frameIndex();
    if (!sources[index]) return status('Load a frame before editing.');
    const image = await loadImage(sources[index]);
    const result = await mutator(toCanvas(image));
    sources[index] = result.toDataURL('image/png');
    await rebuild(sources, index);
  }

  async function copyCurrent() {
    const source = frameImages()[frameIndex()]?.src;
    if (!source) return status('Load a frame before copying.');
    try {
      const full = toCanvas(await loadImage(source));
      let copy = full;
      if (hasSelection()) {
        const rect = selectionRect(full.width, full.height);
        copy = document.createElement('canvas');
        copy.width = rect.w;
        copy.height = rect.h;
        copy.getContext('2d').drawImage(full, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      }
      const blob = await new Promise((resolve) => copy.toBlob(resolve, 'image/png'));
      if (!blob || !navigator.clipboard || !window.ClipboardItem) throw new Error('Blocked');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      status(hasSelection() ? 'Selection copied.' : 'Current frame copied.');
    } catch (error) {
      status('Browser clipboard write was blocked.');
    }
  }

  async function pasteIntoCurrent() {
    try {
      const pasted = await loadImage(await clipboardDataUrl());
      await mutateCurrent(async (working) => {
        const ctx = working.getContext('2d');
        const rect = hasSelection() ? selectionRect(working.width, working.height) : { x: 0, y: 0, w: working.width, h: working.height };
        ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
        const factor = Math.min(rect.w / pasted.naturalWidth, rect.h / pasted.naturalHeight);
        const width = pasted.naturalWidth * factor;
        const height = pasted.naturalHeight * factor;
        ctx.drawImage(pasted, rect.x + (rect.w - width) / 2, rect.y + (rect.h - height) / 2, width, height);
        return working;
      });
    } catch (error) {
      status('Copy an image first, then use Paste Into Frame.');
    }
  }

  async function pasteNewFrame() {
    try {
      const newFrame = await clipboardDataUrl();
      const sources = frameImages().map((image) => image.src);
      const index = frameIndex();
      sources.splice(index + 1, 0, newFrame);
      await rebuild(sources, index + 1);
    } catch (error) {
      status('Copy an image first, then use Paste As New Frame.');
    }
  }

  async function clearCurrent() {
    await mutateCurrent(async (working) => {
      const ctx = working.getContext('2d');
      if (hasSelection()) {
        const rect = selectionRect(working.width, working.height);
        ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
      } else {
        ctx.clearRect(0, 0, working.width, working.height);
      }
      return working;
    });
  }

  async function scaleCurrent(percent) {
    await mutateCurrent(async (working) => {
      const result = document.createElement('canvas');
      result.width = working.width;
      result.height = working.height;
      const ctx = result.getContext('2d');
      const factor = percent / 100;
      if (hasSelection()) {
        const rect = selectionRect(working.width, working.height);
        ctx.drawImage(working, 0, 0);
        const crop = document.createElement('canvas');
        crop.width = rect.w; crop.height = rect.h;
        crop.getContext('2d').drawImage(working, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
        ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
        ctx.drawImage(crop, rect.x + (rect.w - rect.w * factor) / 2, rect.y + (rect.h - rect.h * factor) / 2, rect.w * factor, rect.h * factor);
      } else {
        ctx.drawImage(working, (working.width - working.width * factor) / 2, (working.height - working.height * factor) / 2, working.width * factor, working.height * factor);
      }
      return result;
    });
  }

  async function rotateCurrent(degrees) {
    await mutateCurrent(async (working) => {
      const result = document.createElement('canvas');
      result.width = working.width;
      result.height = working.height;
      const ctx = result.getContext('2d');
      const radians = degrees * Math.PI / 180;
      if (hasSelection()) {
        const rect = selectionRect(working.width, working.height);
        ctx.drawImage(working, 0, 0);
        const crop = document.createElement('canvas');
        crop.width = rect.w; crop.height = rect.h;
        crop.getContext('2d').drawImage(working, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
        ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
        ctx.save();
        ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
        ctx.rotate(radians);
        ctx.drawImage(crop, -rect.w / 2, -rect.h / 2);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(working.width / 2, working.height / 2);
        ctx.rotate(radians);
        ctx.drawImage(working, -working.width / 2, -working.height / 2);
        ctx.restore();
      }
      return result;
    });
  }

  function realignCurrent() {
    const button = [...document.querySelectorAll('.frame-align-btn')][frameIndex()];
    if (button) button.click();
    else status('Load a frame before realigning.');
  }

  function ensureOverlay(id, markup) {
    let node = $(id);
    if (!node) {
      node = document.createElement('div');
      node.id = id;
      node.innerHTML = markup;
      canvasViewport.appendChild(node);
    }
    return node;
  }

  function updateOverlays() {
    const gridOverlay = ensureOverlay('advanced-grid-overlay', '<span class="advanced-grid-diagonal advanced-grid-diagonal-a"></span><span class="advanced-grid-diagonal advanced-grid-diagonal-b"></span><span class="advanced-grid-centre"></span>');
    const selectionOverlay = ensureOverlay('advanced-selection-box', '<span>SELECTION</span>');
    const canvasRect = canvas.getBoundingClientRect();
    const viewportRect = canvasViewport.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height || !canvas.width || !canvas.height) return;

    const baseLeft = canvasRect.left - viewportRect.left;
    const baseTop = canvasRect.top - viewportRect.top;
    const cellX = Math.max(2, (canvasRect.width / canvas.width) * 10 * grid.scale);
    const cellY = Math.max(2, (canvasRect.height / canvas.height) * 10 * grid.scale);
    gridOverlay.style.left = `${baseLeft}px`;
    gridOverlay.style.top = `${baseTop}px`;
    gridOverlay.style.width = `${canvasRect.width}px`;
    gridOverlay.style.height = `${canvasRect.height}px`;
    gridOverlay.style.backgroundSize = `${cellX}px ${cellY}px`;
    gridOverlay.hidden = !grid.shown;

    if (!hasSelection()) return (selectionOverlay.hidden = true);
    selectionOverlay.hidden = false;
    selectionOverlay.style.left = `${baseLeft + selection.x * canvasRect.width}px`;
    selectionOverlay.style.top = `${baseTop + selection.y * canvasRect.height}px`;
    selectionOverlay.style.width = `${selection.w * canvasRect.width}px`;
    selectionOverlay.style.height = `${selection.h * canvasRect.height}px`;
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
  }

  function selectionContains(point) {
    return hasSelection() && point.x >= selection.x && point.x <= selection.x + selection.w && point.y >= selection.y && point.y <= selection.y + selection.h;
  }

  function bindSelection() {
    canvas.addEventListener('pointerdown', (event) => {
      if (workMode !== 'select' || !moveSelection) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const point = canvasPoint(event);
      selection.dragging = true;
      canvas.setPointerCapture?.(event.pointerId);
      if (selectionContains(point)) {
        selection.mode = 'move'; selection.pointX = point.x; selection.pointY = point.y;
      } else {
        selection.mode = 'create'; selection.active = true; selection.x = point.x; selection.y = point.y; selection.w = 0; selection.h = 0;
      }
      updateOverlays();
    }, true);

    canvas.addEventListener('pointermove', (event) => {
      if (!selection.dragging || workMode !== 'select' || !moveSelection) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const point = canvasPoint(event);
      if (selection.mode === 'move') {
        selection.x = clamp(selection.x + point.x - selection.pointX, 0, 1 - selection.w);
        selection.y = clamp(selection.y + point.y - selection.pointY, 0, 1 - selection.h);
        selection.pointX = point.x; selection.pointY = point.y;
      } else {
        const startX = selection.x, startY = selection.y;
        selection.x = Math.min(startX, point.x);
        selection.y = Math.min(startY, point.y);
        selection.w = Math.abs(point.x - startX);
        selection.h = Math.abs(point.y - startY);
      }
      updateOverlays();
    }, true);

    const end = (event) => {
      if (!selection.dragging) return;
      selection.dragging = false;
      canvas.releasePointerCapture?.(event.pointerId);
      if (!hasSelection()) selection.active = false;
      updateOverlays();
    };
    canvas.addEventListener('pointerup', end, true);
    canvas.addEventListener('pointercancel', end, true);
  }

  function buildToolbar() {
    const header = editorWindow.querySelector('.editor-header');
    const nav = editorWindow.querySelector('.editor-nav');
    const tools = editorWindow.querySelector('.editor-tools');
    const title = header?.querySelector('h2');
    const viewControls = nav?.querySelector('.segmented');
    const toolGrid = $('tool-grid');
    const targetMode = $('target-mode');
    const modeGroup = targetMode?.closest('.tool-group');
    const cutoutPanel = $('cutout-panel');
    const paintPanel = $('paint-panel');
    const movingPanel = $('moving-panel');
    if (!header || !nav || !tools || !title || !viewControls || !toolGrid || !targetMode || !modeGroup || !cutoutPanel || !paintPanel || !movingPanel) return;

    header.querySelector('.advanced-editor-menu')?.remove();
    nav.querySelector('.advanced-editor-actions')?.remove();
    nav.querySelector('.advanced-tool-strip')?.remove();
    nav.querySelector('.advanced-transform-panel')?.remove();
    nav.querySelector('.advanced-grid-controls')?.remove();

    const menu = document.createElement('div');
    menu.className = 'advanced-editor-menu';
    menu.innerHTML = '<span class="advanced-editor-menu-divider"></span><button type="button" class="active" data-mode="edit">EDIT</button><button type="button" data-mode="paint">PAINT</button><button type="button" data-mode="select">SELECT</button>';
    title.insertAdjacentElement('afterend', menu);

    const actions = document.createElement('div');
    actions.className = 'advanced-editor-actions';
    actions.innerHTML = '<button type="button" data-action="paste">PASTE INTO FRAME</button><button type="button" data-action="new">PASTE AS NEW FRAME</button><button type="button" data-action="copy">COPY</button><button type="button" data-action="clear">CLEAR</button><button type="button" data-action="scale">SCALE</button><button type="button" data-action="rotate">ROTATE</button><button type="button" data-action="align">REALIGN</button>';
    nav.insertBefore(actions, viewControls);

    const toolStrip = document.createElement('div');
    toolStrip.className = 'advanced-tool-strip';
    toolStrip.appendChild(toolGrid);
    nav.insertBefore(toolStrip, viewControls);

    const transform = document.createElement('div');
    transform.className = 'advanced-transform-panel';
    transform.hidden = true;
    transform.innerHTML = '<span id="advanced-transform-title">SCALE</span><input id="advanced-transform-slider" type="range" min="25" max="200" value="100"><b id="advanced-transform-value">100%</b><button type="button" id="advanced-transform-apply">APPLY</button><button type="button" id="advanced-transform-close">×</button>';
    nav.insertBefore(transform, viewControls);

    const gridControls = document.createElement('div');
    gridControls.className = 'advanced-grid-controls';
    gridControls.innerHTML = '<button type="button" id="advanced-grid-toggle">GRID</button><button type="button" id="advanced-grid-size">GRID SIZE</button><div id="advanced-grid-size-popover" hidden><span>GRID SIZE <b id="advanced-grid-size-value">1×</b></span><input id="advanced-grid-size-slider" type="range" min="1" max="10" value="1"></div>';
    nav.insertBefore(gridControls, viewControls);

    if (resetAll) {
      resetAll.classList.add('advanced-clear-all');
      viewControls.appendChild(resetAll);
    }

    modeGroup.querySelector('h4').textContent = 'Move Selection';
    targetMode.hidden = true;
    let selectionControls = $('advanced-selection-controls');
    if (!selectionControls) {
      selectionControls = document.createElement('div');
      selectionControls.id = 'advanced-selection-controls';
      selectionControls.innerHTML = '<button type="button" id="advanced-move-selection">MOVE SELECTION</button><button type="button" id="advanced-clear-selection">CLEAR SELECTION</button><p class="tool-tip-text">Turn this on, then drag in the canvas to create or reposition one persistent selection across every frame.</p>';
      modeGroup.appendChild(selectionControls);
    }

    $('advanced-move-selection').addEventListener('click', () => {
      moveSelection = !moveSelection;
      const button = $('advanced-move-selection');
      button.classList.toggle('active', moveSelection);
      button.textContent = moveSelection ? 'MOVE SELECTION: ON' : 'MOVE SELECTION';
      status(moveSelection ? 'Drag in the canvas to create or move the persistent selection.' : 'Move Selection turned off.');
    });
    $('advanced-clear-selection').addEventListener('click', () => {
      selection.active = false; moveSelection = false;
      $('advanced-move-selection').classList.remove('active');
      $('advanced-move-selection').textContent = 'MOVE SELECTION';
      updateOverlays();
    });

    const nativeTools = [...toolGrid.querySelectorAll('[data-tool]')];
    const showTools = (allowed) => nativeTools.forEach((button) => { button.hidden = !allowed.includes(button.dataset.tool); });
    const target = (name) => targetMode.querySelector(`[data-target="${name}"]`)?.click();
    const tool = (name) => toolGrid.querySelector(`[data-tool="${name}"]`)?.click();

    let transformType = 'scale';
    const slider = $('advanced-transform-slider');
    const updateTransformValue = () => { $('advanced-transform-value').textContent = transformType === 'rotate' ? `${slider.value}°` : `${slider.value}%`; };
    const openTransform = (type) => {
      transformType = type;
      transform.hidden = false;
      $('advanced-transform-title').textContent = type === 'rotate' ? 'ROTATE CURRENT FRAME / SELECTION' : 'SCALE CURRENT FRAME / SELECTION';
      slider.min = type === 'rotate' ? '-180' : '25';
      slider.max = type === 'rotate' ? '180' : '200';
      slider.value = type === 'rotate' ? '0' : '100';
      updateTransformValue();
    };
    slider.addEventListener('input', updateTransformValue);
    $('advanced-transform-close').addEventListener('click', () => { transform.hidden = true; });
    $('advanced-transform-apply').addEventListener('click', async () => {
      transform.hidden = true;
      if (transformType === 'rotate') await rotateCurrent(parseInt(slider.value, 10));
      else await scaleCurrent(parseInt(slider.value, 10));
    });

    actions.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'paste') await pasteIntoCurrent();
      if (action === 'new') await pasteNewFrame();
      if (action === 'copy') await copyCurrent();
      if (action === 'clear') await clearCurrent();
      if (action === 'scale') openTransform('scale');
      if (action === 'rotate') openTransform('rotate');
      if (action === 'align') realignCurrent();
    });

    $('advanced-grid-toggle').addEventListener('click', () => {
      grid.shown = !grid.shown;
      $('advanced-grid-toggle').classList.toggle('active', grid.shown);
      updateOverlays();
    });
    $('advanced-grid-size').addEventListener('click', () => {
      const popover = $('advanced-grid-size-popover');
      popover.hidden = !popover.hidden;
    });
    $('advanced-grid-size-slider').addEventListener('input', (event) => {
      grid.scale = parseInt(event.target.value, 10);
      $('advanced-grid-size-value').textContent = `${grid.scale}×`;
      updateOverlays();
    });

    const setMode = (mode) => {
      workMode = mode;
      menu.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
      actions.hidden = mode !== 'edit';
      toolStrip.hidden = mode === 'edit';
      transform.hidden = true;
      tools.hidden = mode === 'edit';
      modeGroup.hidden = mode !== 'select';
      cutoutPanel.hidden = mode !== 'select';
      paintPanel.hidden = mode !== 'paint';
      movingPanel.hidden = true;
      if (mode === 'paint') { showTools(['brush', 'bucket']); target('paint'); tool('brush'); }
      if (mode === 'select') { showTools(['pan', 'rect', 'lasso', 'polygon']); target('cutout'); tool('rect'); }
      updateOverlays();
    };

    menu.addEventListener('click', (event) => {
      const mode = event.target.closest('[data-mode]')?.dataset.mode;
      if (mode) setMode(mode);
    });
    setMode('edit');
  }

  function addBottomAutoHideAndLock() {
    const bottom = document.querySelector('.bottom-sticky-panel');
    const top = $('top-panel');
    const title = document.querySelector('.title-left span');
    if (!bottom || !top || !title) return;

    bottom.classList.add('advanced-auto-panel');
    let timer;
    const locked = () => document.body.classList.contains('advanced-workspace-locked');
    const show = () => { if (!locked()) { window.clearTimeout(timer); bottom.classList.remove('is-auto-hidden'); } };
    const hide = () => { window.clearTimeout(timer); if (locked()) bottom.classList.add('is-auto-hidden'); else timer = window.setTimeout(() => bottom.classList.add('is-auto-hidden'), 2200); };
    bottom.addEventListener('mouseenter', show);
    bottom.addEventListener('mouseleave', hide);
    document.addEventListener('pointermove', (event) => { if (!locked() && event.clientY >= window.innerHeight - 40) show(); }, { passive: true });
    hide();

    if (!$('advanced-workspace-lock')) {
      const lock = document.createElement('button');
      lock.type = 'button'; lock.id = 'advanced-workspace-lock'; lock.className = 'advanced-workspace-lock'; lock.textContent = '🔓';
      lock.title = 'Lock the top and bottom panels out of the workspace';
      title.insertAdjacentElement('afterend', lock);
      lock.addEventListener('click', (event) => {
        event.stopPropagation();
        const next = !locked();
        document.body.classList.toggle('advanced-workspace-locked', next);
        lock.textContent = next ? '🔒' : '🔓';
        lock.title = next ? 'Unlock top and bottom panels' : 'Lock the top and bottom panels out of the workspace';
        if (next) { top.classList.add('minimized'); bottom.classList.add('is-auto-hidden'); }
        else hide();
      });
      ['mouseenter', 'mouseleave'].forEach((eventName) => top.addEventListener(eventName, (event) => { if (locked()) event.stopImmediatePropagation(); }, true));
    }
  }

  document.addEventListener('paste', (event) => {
    const target = event.target;
    if (target && (target.matches('input, textarea, select') || target.isContentEditable)) return;
    const files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault(); importFiles(files); status(`${files.length} pasted frame${files.length === 1 ? '' : 's'} added.`);
  });

  ['queue-card', 'advanced-webp-card', 'output-card'].forEach((id) => unhide($(id)));
  addQueueHeading();
  embedEditor();
  buildToolbar();
  bindSelection();
  addBottomAutoHideAndLock();

  new ResizeObserver(updateOverlays).observe(canvasViewport);
  new MutationObserver(updateOverlays).observe(canvas, { attributes: true, attributeFilter: ['style', 'width', 'height'] });
  ['editor-next', 'editor-prev', 'zoom-in', 'zoom-out', 'zoom-fit', 'zoom-reset', 'view-final', 'view-original'].forEach((id) => $(id)?.addEventListener('click', () => window.setTimeout(updateOverlays, 40)));
  window.addEventListener('resize', updateOverlays);

  const adjustHeading = $('adjust-card')?.querySelector('h3');
  const settingsHeading = $('settings-card')?.querySelector('h3');
  const webpHeading = $('advanced-webp-card')?.querySelector('h3');
  const outputHeading = $('output-card')?.querySelector('h3');
  if (adjustHeading) adjustHeading.textContent = '3. Visual Adjustments';
  if (settingsHeading) settingsHeading.textContent = '4. Animation Settings';
  if (webpHeading) webpHeading.textContent = '5. WebP Advanced Settings';
  if (outputHeading) outputHeading.textContent = '6. Synthesized Core Output';
  updateOverlays();
})();
