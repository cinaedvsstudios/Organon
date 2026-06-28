(() => {
  'use strict';

  if (!document.body.classList.contains('is-advanced-mode')) return;

  const $ = (id) => document.getElementById(id);
  const queueCard = $('queue-card');
  const editorButton = $('open-editor-btn');
  const imagePicker = $('image-picker');

  if (!queueCard || !editorButton || !imagePicker) return;

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
    if ($('advanced-editor-card')) return;

    const editorCard = document.createElement('section');
    editorCard.id = 'advanced-editor-card';
    editorCard.className = 'config-card advanced-editor-card';
    editorCard.innerHTML = `
      <div class="advanced-card-heading">
        <h3>2. Frame Editor</h3>
        <button type="button" class="mini-action" id="advanced-open-editor">OPEN FRAME EDITOR</button>
      </div>
      <div class="advanced-editor-placeholder">
        <div class="advanced-editor-placeholder-icon">✦</div>
        <div>
          <strong>EDITOR WORKSPACE</strong>
          <p>Load frames above, then open the editor to cut out, paint, align and refine the sequence.</p>
        </div>
      </div>
    `;

    queueCard.insertAdjacentElement('afterend', editorCard);

    const launchButton = $('advanced-open-editor');
    const syncEditorButton = () => {
      launchButton.disabled = editorButton.disabled;
      editorCard.classList.toggle('is-ready', !editorButton.disabled);
    };

    launchButton.addEventListener('click', () => editorButton.click());
    new MutationObserver(syncEditorButton).observe(editorButton, { attributes: true, attributeFilter: ['disabled'] });
    syncEditorButton();
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
  createEditorCard();
  renumberVisibleCards();
})();
