(() => {
  'use strict';

  window.__organonFrameExportControls = true;

  const $ = (id) => document.getElementById(id);
  const bridge = window.__organonAnimationMakerExport;
  const zipButton = $('zip-btn');
  const filesButton = $('download-files-btn');
  const formatSelect = $('frame-format');
  const nameInput = $('frame-name');
  const sequenceNameInput = $('seq-name');
  const frameGrid = $('frame-grid');

  if (!bridge || !zipButton || !filesButton || !formatSelect || !nameInput || !frameGrid) {
    console.error('Animation Maker frame export controls could not initialise.');
    return;
  }

  const FORMATS = {
    png: { mime: 'image/png', extension: 'png', label: 'PNG', quality: undefined },
    jpeg: { mime: 'image/jpeg', extension: 'jpg', label: 'JPEG', quality: 0.92 },
    webp: { mime: 'image/webp', extension: 'webp', label: 'WebP', quality: 0.92 },
    gif: { mime: 'image/gif', extension: 'gif', label: 'GIF', quality: undefined }
  };

  function setStatus(text, clearAfter = 0) {
    bridge.setStatus(text);
    if (clearAfter > 0) window.setTimeout(bridge.clearStatus, clearAfter);
  }

  function cleanBaseName(value) {
    const fallback = bridge.getSequenceName() || 'frame';
    const cleaned = String(value || fallback)
      .trim()
      .replace(/\.(png|jpe?g|webp|gif)$/i, '')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .replace(/[. ]+$/g, '')
      .replace(/-+/g, '-');
    return cleaned || 'frame';
  }

  function selectedFormatKey() {
    const selected = formatSelect.value;
    if (selected !== 'same') return FORMATS[selected] ? selected : 'png';
    const output = String(bridge.getOutputFormat() || '').toLowerCase();
    if (output === 'webp') return 'webp';
    if (output === 'png') return 'png';
    if (output === 'jpeg' || output === 'jpg') return 'jpeg';
    return 'gif';
  }

  function frameFileName(index, count, extension) {
    const digits = Math.max(2, String(count).length);
    return `${cleanBaseName(nameInput.value)}${String(index + 1).padStart(digits, '0')}.${extension}`;
  }

  async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error('Could not convert the rendered frame into a file.');
    return response.blob();
  }

  async function encodeStaticGif(canvas) {
    if (!window.gifshot || typeof window.gifshot.createGIF !== 'function') {
      throw new Error('The GIF encoder is not available.');
    }
    const image = canvas.toDataURL('image/png');
    const result = await new Promise((resolve, reject) => {
      window.gifshot.createGIF({
        images: [image],
        gifWidth: canvas.width,
        gifHeight: canvas.height,
        interval: 0.1,
        sampleInterval: 10,
        numWorkers: 2
      }, (output) => {
        if (!output || output.error || !output.image) {
          reject(new Error('The GIF encoder could not create this frame.'));
          return;
        }
        resolve(output.image);
      });
    });
    return dataUrlToBlob(result);
  }

  async function encodeCanvas(canvas, formatKey) {
    const format = FORMATS[formatKey] || FORMATS.png;
    if (formatKey === 'gif') return encodeStaticGif(canvas);

    const dataUrl = canvas.toDataURL(format.mime, format.quality);
    if (!dataUrl.startsWith(`data:${format.mime}`)) {
      throw new Error(`${format.label} frame export is not supported by this browser.`);
    }
    return dataUrlToBlob(dataUrl);
  }

  async function renderEncodedFrame(index, formatKey) {
    const canvas = await bridge.renderFrameCanvas(index);
    return encodeCanvas(canvas, formatKey);
  }

  function updateButtons() {
    const hasFrames = bridge.getFrameCount() > 0;
    filesButton.disabled = !hasFrames;
  }

  async function exportZip() {
    const count = bridge.getFrameCount();
    if (!count || typeof window.JSZip !== 'function') return;

    const formatKey = selectedFormatKey();
    const format = FORMATS[formatKey];
    const baseName = cleanBaseName(nameInput.value);
    const originalText = zipButton.textContent;

    zipButton.disabled = true;
    filesButton.disabled = true;
    try {
      const zip = new window.JSZip();
      const folder = zip.folder(`${baseName}-frames`);
      for (let index = 0; index < count; index += 1) {
        zipButton.textContent = `PACKING ${index + 1}/${count}`;
        setStatus(`Encoding ${format.label} frame ${index + 1} of ${count}...`);
        const blob = await renderEncodedFrame(index, formatKey);
        folder.file(frameFileName(index, count, format.extension), blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      bridge.downloadBlob(zipBlob, `${baseName}-frames.zip`);
      setStatus(`${count} ${format.label} frames downloaded as a ZIP.`, 4200);
    } catch (error) {
      setStatus(`Frame ZIP failed: ${error.message}`, 6000);
    } finally {
      zipButton.textContent = originalText;
      zipButton.disabled = bridge.getFrameCount() === 0;
      updateButtons();
    }
  }

  async function exportToFolder() {
    const count = bridge.getFrameCount();
    if (!count) return;
    if (typeof window.showDirectoryPicker !== 'function') {
      setStatus('Direct folder saving is not supported by this browser. Use Download Frames ZIP instead.', 6500);
      return;
    }

    const formatKey = selectedFormatKey();
    const format = FORMATS[formatKey];
    const originalText = filesButton.textContent;
    let directory;

    try {
      directory = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (error) {
      if (error && error.name === 'AbortError') {
        setStatus('Folder selection cancelled.', 2500);
        return;
      }
      setStatus(`Could not open the folder picker: ${error.message}`, 6000);
      return;
    }

    zipButton.disabled = true;
    filesButton.disabled = true;
    try {
      for (let index = 0; index < count; index += 1) {
        const filename = frameFileName(index, count, format.extension);
        filesButton.textContent = `SAVING ${index + 1}/${count}`;
        setStatus(`Saving ${filename}...`);
        const blob = await renderEncodedFrame(index, formatKey);
        const fileHandle = await directory.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        try {
          await writable.write(blob);
        } finally {
          await writable.close();
        }
      }
      setStatus(`${count} ${format.label} frames saved directly into the selected folder.`, 4500);
    } catch (error) {
      setStatus(`Direct frame save failed: ${error.message}`, 6500);
    } finally {
      filesButton.textContent = originalText;
      zipButton.disabled = bridge.getFrameCount() === 0;
      updateButtons();
    }
  }

  let nameWasEdited = false;
  nameInput.addEventListener('input', () => { nameWasEdited = true; });
  sequenceNameInput?.addEventListener('input', () => {
    if (!nameWasEdited) nameInput.value = sequenceNameInput.value;
  });

  zipButton.addEventListener('click', (event) => {
    if (zipButton.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    exportZip();
  }, true);

  filesButton.addEventListener('click', exportToFolder);

  new MutationObserver(updateButtons).observe(frameGrid, { childList: true, subtree: true });
  if (!nameInput.value.trim()) nameInput.value = sequenceNameInput?.value || bridge.getSequenceName() || 'frame';
  updateButtons();
})();