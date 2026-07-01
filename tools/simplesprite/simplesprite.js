(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ui = {
    status: $('app-status'), dropZone: $('drop-zone'), fileInput: $('file-input'),
    clearSources: $('clear-sources-btn'), sourceList: $('source-list'),
    width: $('canvas-width'), height: $('canvas-height'), gridSize: $('grid-size'),
    gridSizeValue: $('grid-size-value'), gridColours: $('grid-colours'),
    zoom: $('zoom-range'), zoomValue: $('zoom-value'), recenter: $('recenter-btn'),
    resetAlpha: $('reset-transparency-btn'), eraser: $('eraser-toggle'),
    eraserSize: $('eraser-size'), eraserSizeValue: $('eraser-size-value'),
    setSprite: $('set-sprite-btn'), frame: $('canvas-frame'), stage: $('canvas-stage'),
    canvas: $('sprite-canvas'), grid: $('grid-canvas'), empty: $('canvas-empty-state'),
    instruction: $('canvas-instruction'), spriteList: $('sprite-list'),
    spriteCount: $('sprite-count'), clearSprites: $('clear-sprites-btn'),
    prefix: $('file-prefix'), example: $('filename-example'), folderNote: $('folder-note'),
    download: $('download-set-btn')
  };

  const ctx = ui.canvas.getContext('2d');
  const gridCtx = ui.grid.getContext('2d');
  const state = {
    sources: [], activeId: null, image: null, mask: document.createElement('canvas'),
    zoom: 1, baseScale: 1, panX: 0, panY: 0, gridSize: 32, gridColour: '#ffffff',
    erasing: false, eraserSize: 24, sprites: [], pointer: null
  };
  const maskCtx = state.mask.getContext('2d');
  const observer = new ResizeObserver(fitPreview);

  const post = (type, text) => {
    if (window.parent && window.parent !== window) window.parent.postMessage({ type, text }, '*');
  };
  const status = (text, tone = '') => {
    ui.status.textContent = text;
    ui.status.className = `app-status${tone ? ` is-${tone}` : ''}`;
    post('set-status', text);
  };
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const pad = (n) => String(n).padStart(2, '0');
  const activeSource = () => state.sources.find((source) => source.id === state.activeId) || null;
  const scale = () => state.baseScale * state.zoom;
  const safePrefix = () => (ui.prefix.value.trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]+/g, '').replace(/^\.+/, '') || 'sprite');
  const sizeText = (bytes) => bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

  function imageRect() {
    if (!state.image) return null;
    const s = scale();
    const width = state.image.naturalWidth * s;
    const height = state.image.naturalHeight * s;
    return { x: (ui.canvas.width - width) / 2 + state.panX, y: (ui.canvas.height - height) / 2 + state.panY, width, height };
  }

  function setDimensions(width, height) {
    const w = clamp(Math.round(Number(width) || 256), 1, 8192);
    const h = clamp(Math.round(Number(height) || 256), 1, 8192);
    ui.width.value = w;
    ui.height.value = h;
    ui.canvas.width = w;
    ui.canvas.height = h;
    ui.grid.width = w;
    ui.grid.height = h;
    render();
    fitPreview();
  }

  function fitPreview() {
    const w = ui.canvas.width || 256;
    const h = ui.canvas.height || 256;
    const availableW = Math.max(1, ui.stage.clientWidth - 44);
    const availableH = Math.max(1, ui.stage.clientHeight - 44);
    const s = Math.max(0.02, Math.min(availableW / w, availableH / h));
    ui.frame.style.width = `${Math.max(1, Math.floor(w * s))}px`;
    ui.frame.style.height = `${Math.max(1, Math.floor(h * s))}px`;
  }

  function drawImage() {
    ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
    if (!state.image) return;
    const rect = imageRect();
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.image, rect.x, rect.y, rect.width, rect.height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(state.mask, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  }

  function drawGrid() {
    gridCtx.clearRect(0, 0, ui.grid.width, ui.grid.height);
    const step = Math.max(1, state.gridSize);
    gridCtx.save();
    gridCtx.strokeStyle = state.gridColour;
    gridCtx.globalAlpha = state.gridColour === '#000000' ? 0.63 : 0.58;
    gridCtx.lineWidth = Math.max(1, Math.min(2, Math.round(Math.min(ui.grid.width, ui.grid.height) / 700)));
    gridCtx.beginPath();
    for (let x = 0; x <= ui.grid.width; x += step) { gridCtx.moveTo(x + .5, 0); gridCtx.lineTo(x + .5, ui.grid.height); }
    for (let y = 0; y <= ui.grid.height; y += step) { gridCtx.moveTo(0, y + .5); gridCtx.lineTo(ui.grid.width, y + .5); }
    gridCtx.stroke();
    gridCtx.restore();
  }

  function render() {
    drawImage();
    drawGrid();
    ui.empty.classList.toggle('is-hidden', Boolean(state.image));
    ui.frame.classList.toggle('is-eraser', state.erasing && Boolean(state.image));
    ui.instruction.textContent = !state.image
      ? 'Choose a source thumbnail, then drag the image to position it.'
      : state.erasing
        ? 'Eraser mode: drag across parts that should become transparent. Reset restores the original source.'
        : 'Drag the source image to position it. Use the scale slider or mouse wheel to zoom.';
  }

  function updateControls() {
    ui.gridSizeValue.textContent = `${state.gridSize} px`;
    ui.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
    ui.eraserSizeValue.textContent = `${state.eraserSize} px`;
    ui.eraser.textContent = state.erasing ? 'Eraser on' : 'Eraser off';
    ui.eraser.classList.toggle('is-active', state.erasing);
    ui.eraser.setAttribute('aria-pressed', String(state.erasing));
    ui.example.textContent = `${safePrefix()}_01.png`;
  }

  function renderSources() {
    ui.sourceList.replaceChildren();
    if (!state.sources.length) {
      const p = document.createElement('p');
      p.className = 'empty-copy';
      p.textContent = 'Imported images will appear here as draggable thumbnails.';
      ui.sourceList.append(p);
      return;
    }
    state.sources.forEach((source) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.draggable = true;
      item.className = `source-item${source.id === state.activeId ? ' is-selected' : ''}`;
      item.title = 'Click to select. Drag this thumbnail into the crop canvas to load it.';
      item.innerHTML = `<img class="source-thumb" src="${source.url}" alt=""><span class="source-copy"><span class="source-name"></span><span class="source-meta"></span></span><span class="source-drag">⋮⋮</span>`;
      item.querySelector('.source-name').textContent = source.file.name;
      item.querySelector('.source-meta').textContent = `${source.width} × ${source.height} · ${sizeText(source.file.size)}`;
      item.addEventListener('click', () => loadSource(source.id));
      item.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/plain', source.id));
      ui.sourceList.append(item);
    });
  }

  function renderSprites() {
    ui.spriteList.replaceChildren();
    ui.spriteCount.textContent = state.sprites.length;
    ui.download.disabled = !state.sprites.length;
    ui.clearSprites.disabled = !state.sprites.length;
    if (!state.sprites.length) {
      const p = document.createElement('p');
      p.className = 'empty-copy';
      p.textContent = 'Each crop you set will appear in a numbered box here.';
      ui.spriteList.append(p);
      return;
    }
    state.sprites.forEach((sprite, index) => {
      const row = document.createElement('div');
      row.className = 'sprite-item';
      const preview = document.createElement('img');
      preview.className = 'sprite-preview';
      preview.src = sprite.url;
      preview.alt = `Sprite ${pad(index + 1)}`;
      const copy = document.createElement('div');
      copy.innerHTML = `<div class="sprite-number">SPRITE ${pad(index + 1)}</div><div class="sprite-dimensions">${sprite.width} × ${sprite.height} PNG</div>`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-sprite';
      remove.textContent = '×';
      remove.title = 'Remove this sprite';
      remove.addEventListener('click', () => removeSprite(sprite.id));
      row.append(preview, copy, remove);
      ui.spriteList.append(row);
    });
  }

  function resetTransparency(announce = true) {
    if (state.mask.width) maskCtx.clearRect(0, 0, state.mask.width, state.mask.height);
    render();
    if (announce && state.image) status('Temporary transparency reset. The original imported image is unchanged.');
  }

  function loadSource(id) {
    const source = state.sources.find((item) => item.id === id);
    if (!source) return;
    state.activeId = id;
    const image = new Image();
    image.onload = () => {
      state.image = image;
      state.mask.width = image.naturalWidth;
      state.mask.height = image.naturalHeight;
      state.baseScale = Math.max(ui.canvas.width / image.naturalWidth, ui.canvas.height / image.naturalHeight);
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      state.erasing = false;
      ui.zoom.value = 100;
      resetTransparency(false);
      updateControls();
      renderSources();
      render();
      status(`Loaded ${source.file.name}. Drag it into position or use the scale slider.`, 'success');
    };
    image.onerror = () => status(`Could not load ${source.file.name}.`, 'error');
    image.src = source.url;
  }

  async function addFiles(files) {
    const imageFiles = [...files].filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) { status('Please choose image files only.', 'error'); return; }
    const pending = [];
    for (const file of imageFiles) {
      const url = URL.createObjectURL(file);
      const image = new Image();
      try {
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
        pending.push({ id: `source-${Date.now()}-${Math.random().toString(16).slice(2)}`, file, url, width: image.naturalWidth, height: image.naturalHeight });
      } catch { URL.revokeObjectURL(url); }
    }
    if (!pending.length) { status('None of those files could be opened as images.', 'error'); return; }
    state.sources.push(...pending);
    renderSources();
    status(`${pending.length} image${pending.length === 1 ? '' : 's'} added to the source tray.`, 'success');
    if (!state.activeId) loadSource(pending[0].id);
  }

  function pointerPoint(event) {
    const bounds = ui.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (ui.canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (ui.canvas.height / bounds.height)
    };
  }

  function eraseAt(point) {
    if (!state.image) return;
    const rect = imageRect();
    const sourceX = (point.x - rect.x) / rect.width * state.image.naturalWidth;
    const sourceY = (point.y - rect.y) / rect.height * state.image.naturalHeight;
    const sourceRadius = state.eraserSize / scale();
    maskCtx.save();
    maskCtx.fillStyle = '#000';
    maskCtx.beginPath();
    maskCtx.arc(sourceX, sourceY, sourceRadius / 2, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.restore();
    drawImage();
  }

  function pointerDown(event) {
    if (!state.image) return;
    event.preventDefault();
    const point = pointerPoint(event);
    state.pointer = { id: event.pointerId, x: point.x, y: point.y, mode: state.erasing ? 'erase' : 'pan' };
    ui.canvas.setPointerCapture(event.pointerId);
    if (state.pointer.mode === 'erase') eraseAt(point);
  }

  function pointerMove(event) {
    if (!state.pointer || event.pointerId !== state.pointer.id) return;
    const point = pointerPoint(event);
    if (state.pointer.mode === 'erase') eraseAt(point);
    else {
      state.panX += point.x - state.pointer.x;
      state.panY += point.y - state.pointer.y;
      drawImage();
    }
    state.pointer.x = point.x;
    state.pointer.y = point.y;
  }

  function pointerEnd(event) {
    if (!state.pointer || event.pointerId !== state.pointer.id) return;
    try { ui.canvas.releasePointerCapture(event.pointerId); } catch {}
    state.pointer = null;
  }

  function zoomAt(point, nextZoom) {
    if (!state.image) return;
    const before = imageRect();
    const naturalX = (point.x - before.x) / before.width * state.image.naturalWidth;
    const naturalY = (point.y - before.y) / before.height * state.image.naturalHeight;
    state.zoom = clamp(nextZoom, .25, 4);
    const after = imageRect();
    state.panX += point.x - (after.x + naturalX / state.image.naturalWidth * after.width);
    state.panY += point.y - (after.y + naturalY / state.image.naturalHeight * after.height);
    ui.zoom.value = Math.round(state.zoom * 100);
    updateControls();
    drawImage();
  }

  function wheel(event) {
    if (!state.image) return;
    event.preventDefault();
    zoomAt(pointerPoint(event), state.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08));
  }

  function updateCanvasSize() {
    const oldW = ui.canvas.width, oldH = ui.canvas.height;
    setDimensions(ui.width.value, ui.height.value);
    if (state.image && (oldW !== ui.canvas.width || oldH !== ui.canvas.height)) {
      state.baseScale = Math.max(ui.canvas.width / state.image.naturalWidth, ui.canvas.height / state.image.naturalHeight);
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      ui.zoom.value = 100;
      updateControls();
      render();
      status('Canvas size updated. Temporary transparency stayed attached to this source image.');
    }
  }

  function recenter() {
    if (!state.image) { status('Choose a source image first.', 'error'); return; }
    state.panX = 0; state.panY = 0; drawImage(); status('Image recentered.');
  }

  async function makeSprite() {
    if (!state.image) { status('Choose and position a source image before setting a sprite.', 'error'); return; }
    const copy = document.createElement('canvas');
    copy.width = ui.canvas.width; copy.height = ui.canvas.height;
    copy.getContext('2d').drawImage(ui.canvas, 0, 0);
    const blob = await new Promise((resolve, reject) => copy.toBlob((value) => value ? resolve(value) : reject(new Error('PNG conversion failed.')), 'image/png'));
    state.sprites.push({ id: `sprite-${Date.now()}-${Math.random().toString(16).slice(2)}`, blob, url: URL.createObjectURL(blob), width: copy.width, height: copy.height });
    renderSprites();
    status(`Sprite ${pad(state.sprites.length)} added to the set.`, 'success');
  }

  function removeSprite(id) {
    const index = state.sprites.findIndex((sprite) => sprite.id === id);
    if (index < 0) return;
    URL.revokeObjectURL(state.sprites[index].url);
    state.sprites.splice(index, 1);
    renderSprites();
    status('Sprite removed from the set.');
  }

  function clearSpriteSet() {
    state.sprites.forEach((sprite) => URL.revokeObjectURL(sprite.url));
    state.sprites = [];
    renderSprites();
    status('The current sprite set was cleared.');
  }

  function clearSourceTray() {
    state.sources.forEach((source) => URL.revokeObjectURL(source.url));
    state.sources = []; state.activeId = null; state.image = null; state.erasing = false;
    resetTransparency(false); updateControls(); renderSources(); render();
    status('Source tray cleared. Your ready sprite set was kept.');
  }

  async function downloadSet() {
    if (!state.sprites.length) { status('Set at least one sprite before downloading.', 'error'); return; }
    const prefix = safePrefix();
    ui.prefix.value = prefix;
    updateControls();
    try {
      if ('showDirectoryPicker' in window) {
        status('Choose the destination folder for your PNG set.');
        const directory = await window.showDirectoryPicker({ mode: 'readwrite' });
        for (let i = 0; i < state.sprites.length; i += 1) {
          const handle = await directory.getFileHandle(`${prefix}_${pad(i + 1)}.png`, { create: true });
          const writer = await handle.createWritable();
          await writer.write(state.sprites[i].blob);
          await writer.close();
        }
        ui.folderNote.textContent = `${state.sprites.length} transparent PNG file${state.sprites.length === 1 ? '' : 's'} saved to “${directory.name}”. Existing same-named files were replaced.`;
        status(`Saved ${state.sprites.length} numbered PNG file${state.sprites.length === 1 ? '' : 's'} to ${directory.name}.`, 'success');
      } else {
        state.sprites.forEach((sprite, i) => {
          const link = document.createElement('a');
          link.href = sprite.url; link.download = `${prefix}_${pad(i + 1)}.png`;
          document.body.append(link); link.click(); link.remove();
        });
        ui.folderNote.textContent = 'This browser cannot choose a target folder here, so it sent the numbered PNG files to its normal download location.';
        status(`Started ${state.sprites.length} numbered PNG download${state.sprites.length === 1 ? '' : 's'}.`, 'success');
      }
    } catch (error) {
      if (error?.name === 'AbortError') { status('Folder selection cancelled. Nothing was saved.'); return; }
      console.error(error);
      status('The PNG set could not be saved. Check browser folder permissions and try again.', 'error');
    }
  }

  function bind() {
    ui.fileInput.addEventListener('change', (event) => { addFiles(event.target.files); event.target.value = ''; });
    ['dragenter', 'dragover'].forEach((type) => ui.dropZone.addEventListener(type, (event) => { event.preventDefault(); ui.dropZone.classList.add('is-dragover'); }));
    ['dragleave', 'drop'].forEach((type) => ui.dropZone.addEventListener(type, (event) => { event.preventDefault(); ui.dropZone.classList.remove('is-dragover'); }));
    ui.dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
    ['dragenter', 'dragover'].forEach((type) => ui.frame.addEventListener(type, (event) => { event.preventDefault(); ui.frame.classList.add('is-drop-target'); }));
    ['dragleave', 'drop'].forEach((type) => ui.frame.addEventListener(type, (event) => { event.preventDefault(); ui.frame.classList.remove('is-drop-target'); }));
    ui.frame.addEventListener('drop', (event) => {
      const id = event.dataTransfer.getData('text/plain');
      if (state.sources.some((source) => source.id === id)) loadSource(id);
      else if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
    });
    ui.clearSources.addEventListener('click', clearSourceTray);
    ui.width.addEventListener('change', updateCanvasSize);
    ui.height.addEventListener('change', updateCanvasSize);
    ui.gridSize.addEventListener('input', () => { state.gridSize = Number(ui.gridSize.value); updateControls(); drawGrid(); });
    ui.gridColours.addEventListener('click', (event) => {
      const button = event.target.closest('[data-colour]'); if (!button) return;
      state.gridColour = button.dataset.colour;
      ui.gridColours.querySelectorAll('.colour-button').forEach((item) => item.classList.toggle('is-active', item === button));
      drawGrid();
    });
    ui.zoom.addEventListener('input', () => { if (!state.image) return; state.zoom = Number(ui.zoom.value) / 100; updateControls(); drawImage(); });
    ui.recenter.addEventListener('click', recenter);
    ui.resetAlpha.addEventListener('click', () => resetTransparency(true));
    ui.eraser.addEventListener('click', () => {
      if (!state.image) { status('Choose a source image before using the eraser.', 'error'); return; }
      state.erasing = !state.erasing; updateControls(); render();
      status(state.erasing ? 'Temporary transparency eraser enabled.' : 'Image positioning mode enabled.');
    });
    ui.eraserSize.addEventListener('input', () => { state.eraserSize = Number(ui.eraserSize.value); updateControls(); });
    ui.setSprite.addEventListener('click', makeSprite);
    ui.clearSprites.addEventListener('click', clearSpriteSet);
    ui.prefix.addEventListener('input', updateControls);
    ui.download.addEventListener('click', downloadSet);
    ui.canvas.addEventListener('pointerdown', pointerDown);
    ui.canvas.addEventListener('pointermove', pointerMove);
    ui.canvas.addEventListener('pointerup', pointerEnd);
    ui.canvas.addEventListener('pointercancel', pointerEnd);
    ui.canvas.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('beforeunload', () => { state.sources.forEach((source) => URL.revokeObjectURL(source.url)); state.sprites.forEach((sprite) => URL.revokeObjectURL(sprite.url)); });
  }

  setDimensions(256, 256);
  state.gridSize = Number(ui.gridSize.value);
  state.eraserSize = Number(ui.eraserSize.value);
  updateControls(); renderSources(); renderSprites(); render(); bind();
  observer.observe(ui.stage);
  requestAnimationFrame(fitPreview);
})();
