(() => {
  'use strict';
  if (!document.body.classList.contains('is-advanced-mode')) return;

  const $ = (id) => document.getElementById(id);
  const editorWindow = $('editor-window');
  const editorNav = editorWindow?.querySelector('.editor-nav');
  const editorHeader = editorWindow?.querySelector('.editor-header');
  const editorTools = editorWindow?.querySelector('.editor-tools');
  const canvas = $('frame-editor-canvas');
  const canvasViewport = $('canvas-viewport');
  const bottom = document.querySelector('.bottom-sticky-panel');
  const top = $('top-panel');
  const title = document.querySelector('.title-left span');

  if (!editorWindow || !editorNav || !editorHeader || !editorTools || !canvas || !canvasViewport || !bottom || !top || !title) return;

  const toolStrip = editorNav.querySelector('.advanced-tool-strip');
  const actionStrip = editorNav.querySelector('.advanced-editor-actions');
  const gridControls = editorNav.querySelector('.advanced-grid-controls');
  const transformPanel = editorNav.querySelector('.advanced-transform-panel');
  const menu = editorHeader.querySelector('.advanced-editor-menu');
  const toolGrid = $('tool-grid');
  const targetMode = $('target-mode');
  const modeGroup = targetMode?.closest('.tool-group');
  const cutoutPanel = $('cutout-panel');
  const paintPanel = $('paint-panel');
  const movingPanel = $('moving-panel');
  const clearAll = $('reset-all-edits');

  if (!toolStrip || !actionStrip || !gridControls || !transformPanel || !menu || !toolGrid || !targetMode || !modeGroup || !cutoutPanel || !paintPanel || !movingPanel) return;

  const nativeTools = [...toolGrid.querySelectorAll('[data-tool]')];
  const activate = (selector) => document.querySelector(selector)?.click();
  const showTools = (allowed) => nativeTools.forEach((button) => { button.hidden = !allowed.includes(button.dataset.tool); });

  function setMode(mode) {
    menu.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
    actionStrip.hidden = mode !== 'edit';
    toolStrip.hidden = mode === 'edit';
    transformPanel.hidden = true;
    editorTools.hidden = mode === 'edit';

    targetMode.hidden = true;
    modeGroup.hidden = mode !== 'select';
    cutoutPanel.hidden = mode !== 'select';
    paintPanel.hidden = mode !== 'paint';
    movingPanel.hidden = true;

    if (mode === 'paint') {
      showTools(['brush', 'bucket']);
      activate('#target-mode [data-target="paint"]');
      activate('#tool-grid [data-tool="brush"]');
    }

    if (mode === 'select') {
      showTools(['pan', 'rect', 'lasso', 'polygon']);
      activate('#target-mode [data-target="cutout"]');
      activate('#tool-grid [data-tool="rect"]');
    }
  }

  menu.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });

  modeGroup.querySelector('h4').textContent = 'Move Selection';
  if (!modeGroup.querySelector('#advanced-selection-controls')) {
    const controls = document.createElement('div');
    controls.id = 'advanced-selection-controls';
    controls.innerHTML = '<button type="button" id="advanced-move-selection">MOVE SELECTION</button><button type="button" id="advanced-clear-selection">CLEAR SELECTION</button><p class="tool-tip-text">Selection movement will be completed in the editor-function pass.</p>';
    modeGroup.appendChild(controls);
  }

  if (clearAll && !clearAll.classList.contains('advanced-clear-all')) {
    clearAll.classList.add('advanced-clear-all');
    editorNav.querySelector('.segmented')?.appendChild(clearAll);
  }

  const gridOverlay = (() => {
    let overlay = $('advanced-grid-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'advanced-grid-overlay';
      overlay.innerHTML = '<span class="advanced-grid-diagonal advanced-grid-diagonal-a"></span><span class="advanced-grid-diagonal advanced-grid-diagonal-b"></span><span class="advanced-grid-centre"></span>';
      canvasViewport.appendChild(overlay);
    }
    return overlay;
  })();

  let gridVisible = false;
  let gridScale = 1;

  function updateGrid() {
    const canvasRect = canvas.getBoundingClientRect();
    const viewportRect = canvasViewport.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height || !canvas.width || !canvas.height) return;
    gridOverlay.style.left = `${canvasRect.left - viewportRect.left}px`;
    gridOverlay.style.top = `${canvasRect.top - viewportRect.top}px`;
    gridOverlay.style.width = `${canvasRect.width}px`;
    gridOverlay.style.height = `${canvasRect.height}px`;
    gridOverlay.style.backgroundSize = `${Math.max(2, canvasRect.width / canvas.width * 10 * gridScale)}px ${Math.max(2, canvasRect.height / canvas.height * 10 * gridScale)}px`;
    gridOverlay.hidden = !gridVisible;
  }

  $('advanced-grid-toggle')?.addEventListener('click', () => {
    gridVisible = !gridVisible;
    $('advanced-grid-toggle').classList.toggle('active', gridVisible);
    updateGrid();
  });

  $('advanced-grid-size')?.addEventListener('click', () => {
    const popover = $('advanced-grid-size-popover');
    if (popover) popover.hidden = !popover.hidden;
  });

  $('advanced-grid-size-slider')?.addEventListener('input', (event) => {
    gridScale = Number(event.target.value) || 1;
    const value = $('advanced-grid-size-value');
    if (value) value.textContent = `${gridScale}×`;
    updateGrid();
  });

  if (!$('advanced-workspace-lock')) {
    const lock = document.createElement('button');
    lock.type = 'button';
    lock.id = 'advanced-workspace-lock';
    lock.className = 'advanced-workspace-lock';
    lock.textContent = '🔓';
    lock.title = 'Lock the top and bottom panels out of the workspace';
    title.insertAdjacentElement('afterend', lock);

    lock.addEventListener('click', (event) => {
      event.stopPropagation();
      const locked = !document.body.classList.contains('advanced-workspace-locked');
      document.body.classList.toggle('advanced-workspace-locked', locked);
      lock.textContent = locked ? '🔒' : '🔓';
      lock.title = locked ? 'Unlock top and bottom panels' : 'Lock the top and bottom panels out of the workspace';
      if (locked) {
        top.classList.add('minimized');
        bottom.classList.add('is-auto-hidden');
      }
    });
  }

  bottom.classList.add('advanced-auto-panel');
  let hideTimer = null;
  const locked = () => document.body.classList.contains('advanced-workspace-locked');
  const showBottom = () => {
    if (locked()) return;
    window.clearTimeout(hideTimer);
    bottom.classList.remove('is-auto-hidden');
  };
  const hideBottom = () => {
    window.clearTimeout(hideTimer);
    if (locked()) {
      bottom.classList.add('is-auto-hidden');
      return;
    }
    hideTimer = window.setTimeout(() => bottom.classList.add('is-auto-hidden'), 2200);
  };
  bottom.addEventListener('mouseenter', showBottom);
  bottom.addEventListener('mouseleave', hideBottom);
  bottom.addEventListener('focusin', showBottom);
  bottom.addEventListener('focusout', hideBottom);
  document.addEventListener('pointermove', (event) => {
    if (!locked() && event.clientY >= window.innerHeight - 36) showBottom();
  }, { passive: true });
  hideBottom();

  ['editor-next', 'editor-prev', 'zoom-in', 'zoom-out', 'zoom-fit', 'zoom-reset', 'view-final', 'view-original'].forEach((id) => {
    $(id)?.addEventListener('click', () => window.setTimeout(updateGrid, 40));
  });
  window.addEventListener('resize', updateGrid);
  new ResizeObserver(updateGrid).observe(canvasViewport);

  setMode('edit');
  updateGrid();
})();
