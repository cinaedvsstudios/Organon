(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const ui = {
    status: byId('app-status'),
    fileInput: byId('file-input'),
    dropZone: byId('drop-zone'),
    clearSources: byId('clear-sources-btn'),
    sourceList: byId('source-list'),
    width: byId('canvas-width'),
    height: byId('canvas-height'),
    gridSize: byId('grid-size'),
    gridSizeValue: byId('grid-size-value'),
    gridColours: byId('grid-colours'),
    zoom: byId('zoom-range'),
    zoomValue: byId('zoom-value'),
    recenter: byId('recenter-btn'),
    resetAlpha: byId('reset-transparency-btn'),
    eraser: byId('eraser-toggle'),
    eraserSize: byId('eraser-size'),
    eraserSizeValue: byId('eraser-size-value'),
    autoNext: byId('auto-next-btn'),
    setSprite: byId('set-sprite-btn'),
    stage: byId('canvas-stage'),
    frame: byId('canvas-frame'),
    canvas: byId('sprite-canvas'),
    grid: byId('grid-canvas'),
    empty: byId('canvas-empty-state'),
    instruction: byId('canvas-instruction'),
    spriteList: byId('sprite-list'),
    spriteCount: byId('sprite-count'),
    clearSprites: byId('clear-sprites-btn'),
    prefix: byId('file-prefix'),
    example: byId('filename-example'),
    folderNote: byId('folder-note'),
    download: byId('download-set-btn')
  };

  const paint = ui.canvas.getContext('2d');
  const gridPaint = ui.grid.getContext('2d');
  const mask = document.createElement('canvas');
  const maskPaint = mask.getContext('2d');
  const state = {
    sources: [], activeId: null, image: null,
    baseScale: 1, zoom: 1, panX: 0, panY: 0,
    gridSize: 32, gridColour: '#ffffff', erasing: false, eraserSize: 24,
    sprites: [], pointer: null
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const pad = (number) => String(number).padStart(2, '0');
  const activeSource = () => state.sources.find((source) => source.id === state.activeId) || null;
  const currentScale = () => state.baseScale * state.zoom;
  const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const filenamePrefix = () => (ui.prefix.value.trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]+/g, '').replace(/^\.+/, '') || 'sprite');

  function setStatus(text, tone = '') {
    ui.status.textContent = text;
    ui.status.className = `app-status${tone ? ` is-${tone}` : ''}`;
    if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'set-status', text }, '*');
  }

  function imageRect() {
    if (!state.image) return null;
    const scale = currentScale();
    const width = state.image.naturalWidth * scale;
    const height = state.image.naturalHeight * scale;
    return {
      x: (ui.canvas.width - width) / 2 + state.panX,
      y: (ui.canvas.height - height) / 2 + state.panY,
      width,
      height
    };
  }

  function drawSource() {
    paint.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
    if (!state.image) return;
    const rect = imageRect();
    paint.save();
    paint.imageSmoothingEnabled = true;
    paint.imageSmoothingQuality = 'high';
    paint.drawImage(state.image, rect.x, rect.y, rect.width, rect.height);
    paint.globalCompositeOperation = 'destination-out';
    paint.drawImage(mask, rect.x, rect.y, rect.width, rect.height);
    paint.restore();
  }

  function drawGrid() {
    const width = ui.grid.width;
    const height = ui.grid.height;
    const size = Math.max(1, state.gridSize);
    gridPaint.clearRect(0, 0, width, height);
    gridPaint.save();
    gridPaint.strokeStyle = state.gridColour;
    gridPaint.globalAlpha = state.gridColour === '#000000' ? 0.63 : 0.58;
    gridPaint.lineWidth = Math.max(1, Math.min(2, Math.min(width, height) / 700));
    gridPaint.beginPath();
    for (let x = 0; x <= width; x += size) { gridPaint.moveTo(x + .5, 0); gridPaint.lineTo(x + .5, height); }
    for (let y = 0; y <= height; y += size) { gridPaint.moveTo(0, y + .5); gridPaint.lineTo(width, y + .5); }
    gridPaint.stroke();

    gridPaint.globalAlpha = state.gridColour === '#000000' ? 0.82 : 0.72;
    gridPaint.lineWidth = Math.max(1.25, Math.min(2.5, Math.min(width, height) / 220));
    gridPaint.beginPath();
    gridPaint.moveTo(.5, .5); gridPaint.lineTo(width - .5, height - .5);
    gridPaint.moveTo(width - .5, .5); gridPaint.lineTo(.5, height - .5);
    const cx = width / 2;
    const cy = height / 2;
    const arm = Math.max(4, Math.min(11, Math.min(width, height) / 18));
    gridPaint.moveTo(cx - arm, cy + .5); gridPaint.lineTo(cx + arm, cy + .5);
    gridPaint.moveTo(cx + .5, cy - arm); gridPaint.lineTo(cx + .5, cy + arm);
    gridPaint.stroke();
    gridPaint.restore();
  }

  function render() {
    drawSource();
    drawGrid();
    ui.empty.classList.toggle('is-hidden', Boolean(state.image));
    ui.frame.classList.toggle('is-eraser', state.erasing && Boolean(state.image));
    ui.instruction.textContent = !state.image
      ? 'Choose a source thumbnail, then drag the image to position it.'
      : state.erasing
        ? 'Eraser mode: drag across areas that should become transparent. Reset restores the original source.'
        : 'Drag the source image to position it. Use Auto next sprite for transparent-separated sprites.';
  }

  function fitCanvas() {
    const stageWidth = Math.max(1, ui.stage.clientWidth - 36);
    const stageHeight = Math.max(1, ui.stage.clientHeight - 36);
    const factor = Math.max(.02, Math.min(stageWidth / ui.canvas.width, stageHeight / ui.canvas.height));
    ui.frame.style.width = `${Math.floor(ui.canvas.width * factor)}px`;
    ui.frame.style.height = `${Math.floor(ui.canvas.height * factor)}px`;
  }

  function updateControls() {
    ui.gridSizeValue.textContent = `${state.gridSize} px`;
    ui.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
    ui.eraserSizeValue.textContent = `${state.eraserSize} px`;
    ui.eraser.textContent = state.erasing ? 'Eraser on' : 'Eraser off';
    ui.eraser.classList.toggle('is-active', state.erasing);
    ui.eraser.setAttribute('aria-pressed', String(state.erasing));
    ui.example.textContent = `${filenamePrefix()}_01.png`;
  }

  function setCanvasSize() {
    const width = clamp(Math.round(Number(ui.width.value) || 256), 1, 8192);
    const height = clamp(Math.round(Number(ui.height.value) || 256), 1, 8192);
    ui.width.value = width;
    ui.height.value = height;
    ui.canvas.width = width;
    ui.canvas.height = height;
    ui.grid.width = width;
    ui.grid.height = height;
    if (state.image) {
      state.baseScale = Math.max(1, width / state.image.naturalWidth, height / state.image.naturalHeight);
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      ui.zoom.value = 100;
    }
    updateControls();
    render();
    fitCanvas();
  }

  function resetTransparency(announce = true) {
    maskPaint.clearRect(0, 0, mask.width, mask.height);
    drawSource();
    if (announce && state.image) setStatus('Temporary transparency reset. The imported original was not changed.');
  }

  function renderSources() {
    ui.sourceList.replaceChildren();
    if (!state.sources.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-copy';
      empty.textContent = 'Imported images will appear here as draggable thumbnails.';
      ui.sourceList.append(empty);
      return;
    }
    for (const source of state.sources) {
      const button = document.createElement('button');
      button.type = 'button';
      button.draggable = true;
      button.className = `source-item${source.id === state.activeId ? ' is-selected' : ''}`;
      const preview = document.createElement('img');
      preview.className = 'source-thumb';
      preview.src = source.url;
      preview.alt = '';
      const copy = document.createElement('span');
      copy.className = 'source-copy';
      const name = document.createElement('span');
      name.className = 'source-name';
      name.textContent = source.file.name;
      const meta = document.createElement('span');
      meta.className = 'source-meta';
      meta.textContent = `${source.width} × ${source.height}`;
      copy.append(name, meta);
      const mark = document.createElement('span');
      mark.className = 'source-drag';
      mark.textContent = '⋮⋮';
      button.append(preview, copy, mark);
      button.addEventListener('click', () => loadSource(source.id));
      button.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/plain', source.id));
      ui.sourceList.append(button);
    }
  }

  function renderSprites() {
    ui.spriteList.replaceChildren();
    ui.spriteCount.textContent = state.sprites.length;
    ui.download.disabled = !state.sprites.length;
    ui.clearSprites.disabled = !state.sprites.length;
    if (!state.sprites.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-copy';
      empty.textContent = 'Each crop you set will appear in a numbered box here.';
      ui.spriteList.append(empty);
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
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(sprite.url);
        state.sprites = state.sprites.filter((item) => item.id !== sprite.id);
        renderSprites();
      });
      row.append(preview, copy, remove);
      ui.spriteList.append(row);
    });
  }

  function sortedRegions(regions) {
    const rows = [];
    const candidates = regions.slice().sort((a, b) => a.top - b.top || a.left - b.left);
    for (const region of candidates) {
      const centerY = region.top + region.height / 2;
      let row = rows.find((item) => Math.abs(item.centerY - centerY) <= Math.max(10, item.height * .45, region.height * .45));
      if (!row) { row = { centerY, height: region.height, items: [] }; rows.push(row); }
      row.items.push(region);
      row.centerY = row.items.reduce((total, item) => total + item.top + item.height / 2, 0) / row.items.length;
      row.height = row.items.reduce((total, item) => total + item.height, 0) / row.items.length;
    }
    return rows.sort((a, b) => a.centerY - b.centerY).flatMap((row) => row.items.sort((a, b) => a.left - b.left));
  }

  function scanOpaqueRegions(image) {
    const scan = document.createElement('canvas');
    scan.width = image.naturalWidth;
    scan.height = image.naturalHeight;
    const scanPaint = scan.getContext('2d', { willReadFrequently: true });
    scanPaint.drawImage(image, 0, 0);
    const pixels = scanPaint.getImageData(0, 0, scan.width, scan.height).data;
    const width = scan.width;
    const height = scan.height;
    const total = width * height;
    const seen = new Uint8Array(total);
    const queue = new Int32Array(total);
    const regions = [];
    const opaque = (index) => pixels[index * 4 + 3] > 8;

    for (let start = 0; start < total; start += 1) {
      if (seen[start]) continue;
      seen[start] = 1;
      if (!opaque(start)) continue;
      let head = 0;
      let tail = 1;
      queue[0] = start;
      let minX = start % width;
      let maxX = minX;
      let minY = Math.floor(start / width);
      let maxY = minY;
      let count = 0;
      while (head < tail) {
        const index = queue[head++];
        const x = index % width;
        const y = Math.floor(index / width);
        count += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const neighbours = [index - 1, index + 1, index - width, index + width];
        for (const next of neighbours) {
          const nextX = next % width;
          if (next < 0 || next >= total || (next === index - 1 && nextX === width - 1) || (next === index + 1 && nextX === 0) || seen[next]) continue;
          seen[next] = 1;
          if (opaque(next)) queue[tail++] = next;
        }
      }
      const regionWidth = maxX - minX + 1;
      const regionHeight = maxY - minY + 1;
      if (count >= 8 && regionWidth >= 2 && regionHeight >= 2) regions.push({ left: minX, top: minY, width: regionWidth, height: regionHeight });
    }
    return sortedRegions(regions);
  }

  function scanCurrentSource(source) {
    source.regions = scanOpaqueRegions(state.image);
    source.nextRegion = 0;
    source.didScan = true;
  }

  function frameRegion(region) {
    const width = ui.canvas.width;
    const height = ui.canvas.height;
    const targetScale = Math.min((width * .92) / region.width, (height * .92) / region.height);
    state.zoom = clamp(targetScale / state.baseScale, .25, 4);
    ui.zoom.value = Math.round(state.zoom * 100);
    const rect = imageRect();
    const regionX = rect.x + (region.left + region.width / 2) * currentScale();
    const regionY = rect.y + (region.top + region.height / 2) * currentScale();
    state.panX += width / 2 - regionX;
    state.panY += height / 2 - regionY;
    updateControls();
    drawSource();
  }

  function autoNextSprite() {
    const source = activeSource();
    if (!source || !state.image) { setStatus('Choose a source image first.', 'error'); return; }
    if (!source.didScan) {
      setStatus('Scanning transparent-separated sprite areas…');
      window.setTimeout(() => {
        scanCurrentSource(source);
        autoNextSprite();
      }, 0);
      return;
    }
    if (!source.regions.length) { setStatus('No separate opaque sprite areas were found in this image.', 'error'); return; }
    if (source.nextRegion >= source.regions.length) { setStatus('No more sprite areas were found in this image.', 'error'); return; }
    const region = source.regions[source.nextRegion];
    frameRegion(region);
    source.nextRegion += 1;
    setStatus(`Auto framed sprite area ${pad(source.nextRegion)} of ${pad(source.regions.length)}.`, 'success');
  }

  function loadSource(id) {
    const source = state.sources.find((item) => item.id === id);
    if (!source) return;
    const image = new Image();
    image.onload = () => {
      state.activeId = id;
      state.image = image;
      state.baseScale = Math.max(1, ui.canvas.width / image.naturalWidth, ui.canvas.height / image.naturalHeight);
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      mask.width = image.naturalWidth;
      mask.height = image.naturalHeight;
      maskPaint.clearRect(0, 0, mask.width, mask.height);
      source.didScan = false;
      source.regions = [];
      source.nextRegion = 0;
      ui.zoom.value = 100;
      updateControls();
      renderSources();
      render();
      setStatus(`Loaded ${source.file.name}. Press Auto next sprite to scan it.`, 'success');
    };
    image.onerror = () => setStatus(`Could not load ${source.file.name}.`, 'error');
    image.src = source.url;
  }

  async function addFiles(fileList) {
    const files = [...fileList].filter((file) => file.type.startsWith('image/'));
    if (!files.length) { setStatus('Please choose image files only.', 'error'); return; }
    const additions = [];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const image = new Image();
      try {
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
        additions.push({ id: createId('source'), file, url, width: image.naturalWidth, height: image.naturalHeight, didScan: false, regions: [], nextRegion: 0 });
      } catch { URL.revokeObjectURL(url); }
    }
    if (!additions.length) { setStatus('Those files could not be opened as images.', 'error'); return; }
    state.sources.push(...additions);
    renderSources();
    setStatus(`${additions.length} image${additions.length === 1 ? '' : 's'} added to the source tray.`, 'success');
    if (!state.activeId) loadSource(additions[0].id);
  }

  function pointFromEvent(event) {
    const rect = ui.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * ui.canvas.width / rect.width, y: (event.clientY - rect.top) * ui.canvas.height / rect.height };
  }

  function erase(from, to) {
    const rect = imageRect();
    const scale = currentScale();
    const x1 = (from.x - rect.x) / scale;
    const y1 = (from.y - rect.y) / scale;
    const x2 = (to.x - rect.x) / scale;
    const y2 = (to.y - rect.y) / scale;
    const brush = state.eraserSize / scale;
    maskPaint.save();
    maskPaint.strokeStyle = '#fff';
    maskPaint.fillStyle = '#fff';
    maskPaint.lineCap = 'round';
    maskPaint.lineWidth = brush;
    maskPaint.beginPath();
    maskPaint.moveTo(x1, y1);
    maskPaint.lineTo(x2, y2);
    maskPaint.stroke();
    maskPaint.beginPath();
    maskPaint.arc(x2, y2, brush / 2, 0, Math.PI * 2);
    maskPaint.fill();
    maskPaint.restore();
  }

  function pointerDown(event) {
    if (!state.image || event.button !== 0) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    state.pointer = { id: event.pointerId, point, mode: state.erasing ? 'erase' : 'pan' };
    ui.canvas.setPointerCapture(event.pointerId);
    if (state.pointer.mode === 'erase') { erase(point, point); drawSource(); }
  }

  function pointerMove(event) {
    if (!state.pointer || event.pointerId !== state.pointer.id) return;
    const point = pointFromEvent(event);
    if (state.pointer.mode === 'erase') erase(state.pointer.point, point);
    else { state.panX += point.x - state.pointer.point.x; state.panY += point.y - state.pointer.point.y; }
    state.pointer.point = point;
    drawSource();
  }

  function pointerEnd(event) {
    if (!state.pointer || event.pointerId !== state.pointer.id) return;
    try { ui.canvas.releasePointerCapture(event.pointerId); } catch {}
    state.pointer = null;
  }

  function zoomAt(event) {
    if (!state.image) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    const before = imageRect();
    const naturalX = (point.x - before.x) / currentScale();
    const naturalY = (point.y - before.y) / currentScale();
    state.zoom = clamp(state.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08), .25, 4);
    const after = imageRect();
    state.panX += point.x - (after.x + naturalX * currentScale());
    state.panY += point.y - (after.y + naturalY * currentScale());
    ui.zoom.value = Math.round(state.zoom * 100);
    updateControls();
    drawSource();
  }

  async function setSprite() {
    if (!state.image) { setStatus('Choose and position a source image before setting a sprite.', 'error'); return; }
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = ui.canvas.width;
    exportCanvas.height = ui.canvas.height;
    exportCanvas.getContext('2d').drawImage(ui.canvas, 0, 0);
    const blob = await new Promise((resolve, reject) => exportCanvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG conversion failed')), 'image/png'));
    state.sprites.push({ id: createId('sprite'), blob, url: URL.createObjectURL(blob), width: exportCanvas.width, height: exportCanvas.height });
    renderSprites();
    setStatus(`Sprite ${pad(state.sprites.length)} added to the set.`, 'success');
  }

  function clearSources() {
    state.sources.forEach((source) => URL.revokeObjectURL(source.url));
    state.sources = [];
    state.activeId = null;
    state.image = null;
    state.erasing = false;
    renderSources();
    render();
    updateControls();
    setStatus('Source tray cleared. Ready sprites were kept.');
  }

  function clearSprites() {
    state.sprites.forEach((sprite) => URL.revokeObjectURL(sprite.url));
    state.sprites = [];
    renderSprites();
    setStatus('The sprite set was cleared.');
  }

  async function downloadSet() {
    if (!state.sprites.length) { setStatus('Set at least one sprite before downloading.', 'error'); return; }
    const prefix = filenamePrefix();
    ui.prefix.value = prefix;
    updateControls();
    try {
      if ('showDirectoryPicker' in window) {
        const folder = await window.showDirectoryPicker({ mode: 'readwrite' });
        for (let index = 0; index < state.sprites.length; index += 1) {
          const handle = await folder.getFileHandle(`${prefix}_${pad(index + 1)}.png`, { create: true });
          const writer = await handle.createWritable();
          await writer.write(state.sprites[index].blob);
          await writer.close();
        }
        ui.folderNote.textContent = `${state.sprites.length} numbered PNG file${state.sprites.length === 1 ? '' : 's'} saved to “${folder.name}”.`;
        setStatus(`Saved ${state.sprites.length} numbered PNG file${state.sprites.length === 1 ? '' : 's'} to ${folder.name}.`, 'success');
        return;
      }
      state.sprites.forEach((sprite, index) => {
        const link = document.createElement('a');
        link.href = sprite.url;
        link.download = `${prefix}_${pad(index + 1)}.png`;
        document.body.append(link);
        link.click();
        link.remove();
      });
      ui.folderNote.textContent = 'This browser cannot choose a folder here, so the numbered PNG files used its normal download location.';
      setStatus(`Started ${state.sprites.length} numbered PNG download${state.sprites.length === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      if (error && error.name === 'AbortError') { setStatus('Folder selection cancelled.'); return; }
      console.error(error);
      setStatus('The PNG set could not be saved. Check browser folder permissions.', 'error');
    }
  }

  function bind() {
    ui.fileInput.addEventListener('change', (event) => { addFiles(event.target.files); event.target.value = ''; });
    for (const name of ['dragenter', 'dragover']) ui.dropZone.addEventListener(name, (event) => { event.preventDefault(); ui.dropZone.classList.add('is-dragover'); });
    for (const name of ['dragleave', 'drop']) ui.dropZone.addEventListener(name, (event) => { event.preventDefault(); ui.dropZone.classList.remove('is-dragover'); });
    ui.dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
    for (const name of ['dragenter', 'dragover']) ui.frame.addEventListener(name, (event) => { event.preventDefault(); });
    ui.frame.addEventListener('drop', (event) => {
      event.preventDefault();
      const id = event.dataTransfer.getData('text/plain');
      if (state.sources.some((source) => source.id === id)) loadSource(id);
      else if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
    });
    ui.clearSources.addEventListener('click', clearSources);
    ui.width.addEventListener('change', setCanvasSize);
    ui.height.addEventListener('change', setCanvasSize);
    ui.gridSize.addEventListener('input', () => { state.gridSize = Number(ui.gridSize.value); updateControls(); drawGrid(); });
    ui.gridColours.addEventListener('click', (event) => {
      const button = event.target.closest('[data-colour]');
      if (!button) return;
      state.gridColour = button.dataset.colour;
      ui.gridColours.querySelectorAll('.colour-button').forEach((item) => item.classList.toggle('is-active', item === button));
      drawGrid();
    });
    ui.zoom.addEventListener('input', () => { if (!state.image) return; state.zoom = Number(ui.zoom.value) / 100; updateControls(); drawSource(); });
    ui.recenter.addEventListener('click', () => { if (!state.image) { setStatus('Choose a source image first.', 'error'); return; } state.panX = 0; state.panY = 0; drawSource(); });
    ui.resetAlpha.addEventListener('click', () => resetTransparency(true));
    ui.eraser.addEventListener('click', () => { if (!state.image) { setStatus('Choose a source image before using the eraser.', 'error'); return; } state.erasing = !state.erasing; updateControls(); render(); });
    ui.eraserSize.addEventListener('input', () => { state.eraserSize = Number(ui.eraserSize.value); updateControls(); });
    ui.autoNext.addEventListener('click', autoNextSprite);
    ui.setSprite.addEventListener('click', setSprite);
    ui.clearSprites.addEventListener('click', clearSprites);
    ui.prefix.addEventListener('input', updateControls);
    ui.download.addEventListener('click', downloadSet);
    ui.canvas.addEventListener('pointerdown', pointerDown);
    ui.canvas.addEventListener('pointermove', pointerMove);
    ui.canvas.addEventListener('pointerup', pointerEnd);
    ui.canvas.addEventListener('pointercancel', pointerEnd);
    ui.canvas.addEventListener('wheel', zoomAt, { passive: false });
    new ResizeObserver(fitCanvas).observe(ui.stage);
  }

  setCanvasSize();
  state.gridSize = Number(ui.gridSize.value);
  state.eraserSize = Number(ui.eraserSize.value);
  updateControls();
  renderSources();
  renderSprites();
  render();
  bind();
  requestAnimationFrame(fitCanvas);
})();
