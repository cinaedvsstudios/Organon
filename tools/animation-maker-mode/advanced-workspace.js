(() => {
  'use strict';

  if (!document.body.classList.contains('is-advanced-mode')) return;

  const $ = (id) => document.getElementById(id);
  const queueCard = $('queue-card');
  const editorButton = $('open-editor-btn');
  const imagePicker = $('image-picker');
  const frameGrid = $('frame-grid');

  if (!queueCard || !editorButton || !imagePicker || !frameGrid) return;

  function setHubStatus(text) {
    try {
      window.parent.postMessage({ type: 'set-status', text }, '*');
    } catch (error) {}
  }

  function clearHubStatusSoon() {
    window.setTimeout(() => {
      try {
        window.parent.postMessage({ type: 'clear-status' }, '*');
      } catch (error) {}
    }, 3600);
  }

  function keepCardVisible(card) {
    if (!card) return;
    card.hidden = false;
    card.removeAttribute('hidden');
  }

  function keepAdvancedCardsVisible() {
    ['queue-card', 'advanced-webp-card', 'output-card'].forEach((id) => {
      const card = $(id);
      keepCardVisible(card);

      if (!card || card.dataset.visibilityLocked === 'true') return;
      const observer = new MutationObserver(() => keepCardVisible(card));
      observer.observe(card, { attributes: true, attributeFilter: ['hidden'] });
      card.dataset.visibilityLocked = 'true';
    });
  }

  function fileExtension(type) {
    const subtype = (type || 'image/png').split('/')[1] || 'png';
    return subtype === 'jpeg' ? 'jpg' : subtype;
  }

  function dispatchClipboardFiles(files) {
    if (!files.length) return;
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    imagePicker.files = transfer.files;
    imagePicker.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function clipboardImageFiles() {
    if (!navigator.clipboard || !navigator.clipboard.read) throw new Error('Clipboard image access is unavailable.');

    const clipboardItems = await navigator.clipboard.read();
    const files = [];

    for (const item of clipboardItems) {
      const imageType = item.types.find((type) => type.startsWith('image/'));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      const name = `clipboard-frame-${Date.now()}-${files.length + 1}.${fileExtension(imageType)}`;
      files.push(new File([blob], name, { type: imageType }));
    }

    return files;
  }

  async function pasteClipboardFrames() {
    try {
      const files = await clipboardImageFiles();
      if (!files.length) {
        setHubStatus('No image was found in the clipboard.');
        clearHubStatusSoon();
        return;
      }

      dispatchClipboardFiles(files);
      setHubStatus(`${files.length} clipboard frame${files.length === 1 ? '' : 's'} added.`);
      clearHubStatusSoon();
    } catch (error) {
      setHubStatus('Clipboard permission was blocked. Copy an image, then press Ctrl+V in this workspace.');
      clearHubStatusSoon();
    }
  }

  function addQueueHeaderControls() {
    const heading = queueCard.querySelector('h3');
    if (!heading || $('paste-clipboard-frames')) return;

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
    pasteButton.title = 'Import copied image frames from the clipboard';
    pasteButton.addEventListener('click', pasteClipboardFrames);
    row.appendChild(pasteButton);
  }

  function createEditorCard() {
    if ($('advanced-editor-card')) return $('advanced-editor-card');

    const editorCard = document.createElement('section');
    editorCard.id = 'advanced-editor-card';
    editorCard.className = 'config-card advanced-editor-card';
    editorCard.innerHTML = '<div class="advanced-card-heading"><h3>2. Frame Editor</h3></div><div class="advanced-inline-editor-host"></div>';
    queueCard.insertAdjacentElement('afterend', editorCard);
    return editorCard;
  }

  function currentFrameIndex() {
    const text = $('editor-frame-number')?.textContent || '';
    const match = text.match(/FRAME\s+(\d+)/i);
    return match ? Math.max(0, parseInt(match[1], 10) - 1) : 0;
  }

  async function copyCurrentFrame() {
    const canvas = $('frame-editor-canvas');
    if (!canvas || !canvas.width || !canvas.height) {
      setHubStatus('Load a frame before copying.');
      clearHubStatusSoon();
      return;
    }

    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob || !navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard write unavailable.');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setHubStatus('Current frame copied to the clipboard.');
    } catch (error) {
      setHubStatus('Browser clipboard write was blocked.');
    }
    clearHubStatusSoon();
  }

  function openCurrentFrameAlign() {
    const alignButtons = [...document.querySelectorAll('.frame-align-btn')];
    const alignButton = alignButtons[currentFrameIndex()];
    if (!alignButton) {
      setHubStatus('Load a frame before realigning.');
      clearHubStatusSoon();
      return;
    }
    alignButton.click();
  }

  function createEditPanel(editorTools) {
    let panel = $('advanced-edit-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'advanced-edit-panel';
    panel.className = 'tool-group advanced-edit-panel';
    panel.innerHTML = '<h4>Frame Edit</h4><p class="tool-tip-text">Use the top strip for clipboard, copy, clear, scale and frame alignment actions.</p><div class="advanced-edit-side-actions"><button type="button" data-advanced-edit-action="paste-new">PASTE AS NEW FRAME</button><button type="button" data-advanced-edit-action="copy">COPY CURRENT FRAME</button><button type="button" data-advanced-edit-action="realign">REALIGN CURRENT FRAME</button></div><label class="compact-control"><span>View Scale</span><input id="advanced-view-scale" type="range" min="50" max="200" value="100"></label><button type="button" class="small-reset" data-advanced-edit-action="reset-view">RESET VIEW SCALE</button>';
    editorTools.prepend(panel);

    const scale = panel.querySelector('#advanced-view-scale');
    scale.addEventListener('input', () => {
      const target = parseInt(scale.value, 10);
      const label = $('zoom-label');
      let current = parseInt(label?.textContent || '100', 10) || 100;
      const zoomIn = $('zoom-in');
      const zoomOut = $('zoom-out');
      let guard = 0;
      while (current < target - 12 && guard < 8) { zoomIn.click(); current += 25; guard += 1; }
      while (current > target + 12 && guard < 16) { zoomOut.click(); current -= 25; guard += 1; }
    });

    return panel;
  }

  function addEditorModeMenus() {
    const editorWindow = $('editor-window');
    const editorHeader = editorWindow?.querySelector('.editor-header');
    const editorNav = editorWindow?.querySelector('.editor-nav');
    const editorTools = editorWindow?.querySelector('.editor-tools');
    const toolGrid = $('tool-grid');
    const targetMode = $('target-mode');
    const cutoutPanel = $('cutout-panel');
    const paintPanel = $('paint-panel');
    const movingPanel = $('moving-panel');

    if (!editorWindow || !editorHeader || !editorNav || !editorTools || !toolGrid || editorWindow.dataset.advancedMenusReady === 'true') return;
    editorWindow.dataset.advancedMenusReady = 'true';

    const editorTitle = editorHeader.querySelector('h2');
    const menu = document.createElement('div');
    menu.className = 'advanced-editor-menu';
    menu.innerHTML = '<span class="advanced-editor-menu-divider" aria-hidden="true"></span><button type="button" class="active" data-editor-menu="edit">EDIT</button><button type="button" data-editor-menu="paint">PAINT</button><button type="button" data-editor-menu="select">SELECT</button>';
    editorTitle.insertAdjacentElement('afterend', menu);

    const operationStrip = document.createElement('div');
    operationStrip.className = 'advanced-editor-operation-strip';
    editorNav.insertBefore(operationStrip, editorNav.querySelector('.segmented'));
    operationStrip.appendChild(toolGrid);

    const editActions = document.createElement('div');
    editActions.className = 'advanced-editor-edit-actions';
    editActions.innerHTML = '<button type="button" data-advanced-edit-action="paste-into">PASTE INTO FRAME</button><button type="button" data-advanced-edit-action="paste-new">PASTE AS NEW FRAME</button><button type="button" data-advanced-edit-action="copy">COPY</button><button type="button" data-advanced-edit-action="clear">CLEAR</button><button type="button" data-advanced-edit-action="scale">SCALE</button><button type="button" data-advanced-edit-action="realign">REALIGN</button>';
    operationStrip.appendChild(editActions);

    const editPanel = createEditPanel(editorTools);
    const nativeTools = [...toolGrid.querySelectorAll('[data-tool]')];
    const nativeTool = (name) => nativeTools.find((button) => button.dataset.tool === name);
    const sideAction = (action) => [...document.querySelectorAll('[data-advanced-edit-action]')].filter((button) => button.dataset.advancedEditAction === action);

    async function handleEditAction(action) {
      if (action === 'paste-new') return pasteClipboardFrames();
      if (action === 'copy') return copyCurrentFrame();
      if (action === 'clear') return $('reset-all-edits')?.click();
      if (action === 'scale') return $('advanced-view-scale')?.focus();
      if (action === 'realign') return openCurrentFrameAlign();
      if (action === 'reset-view') {
        $('zoom-reset')?.click();
        const scale = $('advanced-view-scale');
        if (scale) scale.value = '100';
        return;
      }
      if (action === 'paste-into') {
        setHubStatus('Paste into the current frame will be added with the per-frame compositing pass. Use PASTE AS NEW FRAME for now.');
        clearHubStatusSoon();
      }
    }

    [...document.querySelectorAll('[data-advanced-edit-action]')].forEach((button) => {
      button.addEventListener('click', () => handleEditAction(button.dataset.advancedEditAction));
    });

    function setMode(mode) {
      editorWindow.dataset.advancedEditorMenu = mode;
      menu.querySelectorAll('[data-editor-menu]').forEach((button) => button.classList.toggle('active', button.dataset.editorMenu === mode));

      editActions.hidden = mode !== 'edit';
      toolGrid.hidden = mode === 'edit';
      editPanel.hidden = mode !== 'edit';
      targetMode.hidden = true;
      cutoutPanel.hidden = mode !== 'select';
      paintPanel.hidden = mode !== 'paint';
      movingPanel.hidden = true;

      nativeTools.forEach((button) => {
        const allowed = mode === 'paint'
          ? ['brush', 'bucket'].includes(button.dataset.tool)
          : mode === 'select'
            ? ['pan', 'rect', 'lasso', 'polygon'].includes(button.dataset.tool)
            : false;
        button.hidden = !allowed;
      });

      if (mode === 'paint') {
        nativeTool('brush')?.click();
        document.querySelector('#target-mode [data-target="paint"]')?.click();
      }

      if (mode === 'select') {
        nativeTool('rect')?.click();
        document.querySelector('#target-mode [data-target="cutout"]')?.click();
      }
    }

    menu.querySelectorAll('[data-editor-menu]').forEach((button) => {
      button.addEventListener('click', () => setMode(button.dataset.editorMenu));
    });

    setMode('edit');
  }

  function embedFullEditor() {
    const editorCard = createEditorCard();
    const editorModal = $('frame-editor-modal');
    const editorWindow = $('editor-window');
    const inlineHost = editorCard.querySelector('.advanced-inline-editor-host');

    if (!editorModal || !editorWindow || !inlineHost || editorCard.dataset.editorEmbedded === 'true') return editorCard;

    editorModal.hidden = false;
    editorModal.classList.add('advanced-inline-editor-host-modal');
    inlineHost.appendChild(editorWindow);
    editorCard.dataset.editorEmbedded = 'true';

    const headerClose = editorWindow.querySelector('.editor-close');
    const applyClose = editorWindow.querySelector('.editor-footer [data-close="frame-editor-modal"]');
    if (headerClose) headerClose.hidden = true;
    if (applyClose) applyClose.hidden = true;

    const keepEditorMounted = () => {
      if (editorModal.hidden) editorModal.hidden = false;
    };
    new MutationObserver(keepEditorMounted).observe(editorModal, { attributes: true, attributeFilter: ['hidden'] });

    let initialised = false;
    const syncEditor = () => {
      const ready = !editorButton.disabled && Boolean(frameGrid.querySelector('.frame-thumb-wrapper'));
      editorCard.classList.toggle('has-frames', ready);
      editorCard.dataset.editorState = ready ? 'ready' : 'empty';

      if (ready && !initialised) {
        initialised = true;
        window.requestAnimationFrame(() => editorButton.click());
      }
    };

    new MutationObserver(syncEditor).observe(editorButton, { attributes: true, attributeFilter: ['disabled'] });
    new MutationObserver(syncEditor).observe(frameGrid, { childList: true, subtree: true });
    syncEditor();
    addEditorModeMenus();
    return editorCard;
  }

  function addBottomPanelAutoHide() {
    const panel = document.querySelector('.bottom-sticky-panel');
    if (!panel || panel.dataset.autoHideBound === 'true') return;

    panel.dataset.autoHideBound = 'true';
    panel.classList.add('advanced-auto-panel');
    let timer = null;
    const isLocked = () => document.body.classList.contains('advanced-workspace-locked');

    const show = () => {
      if (isLocked()) return;
      window.clearTimeout(timer);
      panel.classList.remove('is-auto-hidden');
    };

    const hideLater = () => {
      window.clearTimeout(timer);
      if (isLocked()) {
        panel.classList.add('is-auto-hidden');
        return;
      }
      timer = window.setTimeout(() => panel.classList.add('is-auto-hidden'), 2200);
    };

    panel.addEventListener('mouseenter', show);
    panel.addEventListener('mouseleave', hideLater);
    panel.addEventListener('focusin', show);
    panel.addEventListener('focusout', hideLater);
    document.addEventListener('pointermove', (event) => {
      if (!isLocked() && event.clientY >= window.innerHeight - 40) show();
    }, { passive: true });
    document.addEventListener('advanced-workspace-lock-change', hideLater);

    hideLater();
  }

  function addWorkspaceLock() {
    const title = document.querySelector('.title-left span');
    const topPanel = $('top-panel');
    const bottomPanel = document.querySelector('.bottom-sticky-panel');
    if (!title || !topPanel || $('advanced-workspace-lock')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'advanced-workspace-lock';
    button.className = 'advanced-workspace-lock';
    button.textContent = '🔓';
    button.title = 'Lock the top and bottom panels out of the workspace';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', 'false');
    title.insertAdjacentElement('afterend', button);

    const locked = () => document.body.classList.contains('advanced-workspace-locked');
    const update = (value) => {
      document.body.classList.toggle('advanced-workspace-locked', value);
      button.textContent = value ? '🔒' : '🔓';
      button.title = value ? 'Unlock top and bottom panels' : 'Lock the top and bottom panels out of the workspace';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(value));
      if (value) {
        topPanel.classList.add('minimized');
        bottomPanel?.classList.add('is-auto-hidden');
      }
      document.dispatchEvent(new CustomEvent('advanced-workspace-lock-change'));
    };

    ['mouseenter', 'mouseleave'].forEach((eventName) => {
      topPanel.addEventListener(eventName, (event) => {
        if (!locked()) return;
        event.stopImmediatePropagation();
      }, true);
    });

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      update(!locked());
    });
  }

  function renumberVisibleCards() {
    const adjustHeading = $('adjust-card')?.querySelector('h3');
    const settingsHeading = $('settings-card')?.querySelector('h3');
    const webpHeading = $('advanced-webp-card')?.querySelector('h3');
    const outputHeading = $('output-card')?.querySelector('h3');

    if (adjustHeading) adjustHeading.textContent = '3. Visual Adjustments';
    if (settingsHeading) settingsHeading.textContent = '4. Animation Settings';
    if (webpHeading) webpHeading.textContent = '5. WebP Advanced Settings';
    if (outputHeading) outputHeading.textContent = '6. Synthesized Core Output';
  }

  document.addEventListener('paste', (event) => {
    const target = event.target;
    if (target && (target.matches('input, textarea, select') || target.isContentEditable)) return;

    const files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;

    event.preventDefault();
    dispatchClipboardFiles(files);
    setHubStatus(`${files.length} pasted frame${files.length === 1 ? '' : 's'} added.`);
    clearHubStatusSoon();
  });

  keepAdvancedCardsVisible();
  addQueueHeaderControls();
  embedFullEditor();
  addBottomPanelAutoHide();
  addWorkspaceLock();
  renumberVisibleCards();
})();
