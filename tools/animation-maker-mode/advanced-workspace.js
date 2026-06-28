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

  async function pasteClipboardFrames() {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      setHubStatus('Clipboard image access is unavailable here. Use Ctrl+V after copying an image.');
      clearHubStatusSoon();
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      const files = [];

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const name = `clipboard-frame-${Date.now()}-${files.length + 1}.${fileExtension(imageType)}`;
        files.push(new File([blob], name, { type: imageType }));
      }

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
    return editorCard;
  }

  function addBottomPanelAutoHide() {
    const panel = document.querySelector('.bottom-sticky-panel');
    if (!panel || panel.dataset.autoHideBound === 'true') return;

    panel.dataset.autoHideBound = 'true';
    panel.classList.add('advanced-auto-panel');
    let timer = null;

    const show = () => {
      window.clearTimeout(timer);
      panel.classList.remove('is-auto-hidden');
    };

    const hideLater = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => panel.classList.add('is-auto-hidden'), 2200);
    };

    panel.addEventListener('mouseenter', show);
    panel.addEventListener('mouseleave', hideLater);
    panel.addEventListener('focusin', show);
    panel.addEventListener('focusout', hideLater);
    document.addEventListener('pointermove', (event) => {
      if (event.clientY >= window.innerHeight - 40) show();
    }, { passive: true });

    hideLater();
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
  renumberVisibleCards();
})();
