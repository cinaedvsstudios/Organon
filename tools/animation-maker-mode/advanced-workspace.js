(() => {
  'use strict';

  if (!document.body.classList.contains('is-advanced-mode')) return;

  const $ = (id) => document.getElementById(id);
  const state = {
    editorMode: 'edit',
    selectionEnabled: false,
    selection: { active: false, x: 0, y: 0, w: 0, h: 0, dragging: false, dragMode: 'create', startX: 0, startY: 0, lastX: 0, lastY: 0 },
    grid: { visible: false, scale: 1 },
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

  const notify = (text) => {
    try { window.parent.postMessage({ type: 'set-status', text }, '*'); } catch (error) {}
    window.setTimeout(() => { try { window.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {} }, 3600);
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
    if (!navigator.clipboard?.read) {
      notify('Clipboard image access is unavailable in this browser.');
      return;
    }

    try {
      const items = await navigator.clipboard.read();
      const files = [];
      for (const item of items) {
        const type = item.types.find((entry) => entry.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        const suffix = type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1];
        files.push(new File([blob], `clipboard-frame-${Date.now()}-${files.length + 1}.${suffix}`, { type }));
      }
      if (!files.length) return notify('No image was found in the clipboard.');
      importFiles(files);
      notify(`${files.length} clipboard frame${files.length === 1 ? '' : 's'} added.`);
    } catch (error) {
      notify('Clipboard permission was blocked. Copy an image, then press Ctrl+V in this workspace.');
    }
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

    new MutationObserver(() => {
      if (editorModal.hidden) editorModal.hidden = false;
    }).observe(editorModal, { attributes: true, attributeFilter: ['hidden'] });

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
    if (settingsHeading) settingsHeading.textContent = '4. Animation Settings';
    if (webpHeading) webpHeading.textContent = '5. WebP Advanced Settings';
    if (outputHeading) outputHeading.textContent = '6. Synthesized Core Output';
  }

  function currentFrameIndex() {
    const match = ($('editor-frame-number')?.textContent || '').match(/FRAME\s+(\d+)/i);
    return match ? Math.max(0, parseInt(match[1], 10) - 1) : 0;
  }

  function copyVisibleFrame() {
    if (!canvas.width || !canvas.height) return notify('Load a frame before copying.');
    const source = document.createElement('canvas');
    source.width = canvas.width;
    source.height = canvas.height;
    source.getContext('2d').drawImage(canvas, 0, 0);

    const selection = state.selection;
    let result = source;
    if (selection.active && selection.w > .004 && selection.h > .004) {
      const x = Math.round(selection.x * source.width);
      const y = Math.round(selection.y * source.height);
      const width = Math.max(1, Math.round(selection.w * source.width));
      const height = Math.max(1, Math.round(selection.h * source.height));
      result = document.createElement('canvas');
      result.width = width;
      result.height = height;
      result.getContext('2d').drawImage(source, x, y, width, height, 0, 0, width, height);
    }

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

  function realignCurrentFrame() {
    const alignButton = [...document.querySelectorAll('.frame-align-btn')][currentFrameIndex()];
    if (alignButton) alignButton.click();
    else notify('Load a frame before realigning.');
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

    const menu = document.createElement('div');
    menu.className = 'advanced-editor-menu';
    menu.innerHTML = '<button type="button" class="active" data-editor-mode="edit">EDIT</button><button type="button" data-editor-mode="paint">PAINT</button><button type="button" data-editor-mode="select">SELECT</button>';
    titleNode.insertAdjacentElement('afterend', menu);

    const actions = document.createElement('div');
    actions.className = 'advanced-editor-actions';
    actions.innerHTML = '<button type="button" disabled title="Part of the next editor engine pass">PASTE INTO FRAME</button><button type="button" disabled title="Part of the next editor engine pass">PASTE AS NEW FRAME</button><button type="button" id="advanced-copy-frame">COPY</button><button type="button" disabled title="Part of the next editor engine pass">CLEAR</button><button type="button" disabled title="Part of the next editor engine pass">SCALE</button><button type="button" disabled title="Part of the next editor engine pass">ROTATE</button><button type="button" id="advanced-realign-frame">REALIGN</button>';
    editorNav.insertBefore(actions, viewControls);
    $('advanced-copy-frame')?.addEventListener('click', copyVisibleFrame);
    $('advanced-realign-frame')?.addEventListener('click', realignCurrentFrame);

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

  initCards();
  initEditorToolbar();
  initSelection();
  initBottomPanel();
  initLock();

  ['editor-next', 'editor-prev', 'zoom-in', 'zoom-out', 'zoom-fit', 'zoom-reset', 'view-final', 'view-original'].forEach((id) => {
    $(id)?.addEventListener('click', () => window.setTimeout(updateOverlays, 40));
  });
  new ResizeObserver(updateOverlays).observe(canvasViewport);
  window.addEventListener('resize', updateOverlays);
  updateOverlays();
})();
