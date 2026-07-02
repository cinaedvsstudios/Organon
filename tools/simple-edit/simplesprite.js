(() => {
  'use strict';

  const state = {
    sources: [],
    activeSourceId: null,
    image: null,
    baseScale: 1,
    zoom: 1,
    panX: 0,
    panY: 0,
    gridSize: 32,
    gridColour: '#ffffff',
    eraserEnabled: false,
    eraserSize: 24,
    maskCanvas: document.createElement('canvas'),
    sprites: [],
    spriteRegions: [],
    nextSpriteRegionIndex: 0,
    pointer: {
      active: false,
      id: null,
      mode: null,
      lastX: 0,
      lastY: 0
    }
  };

  const elements = {
    status: document.getElementById('app-status'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    clearSourcesButton: document.getElementById('clear-sources-btn'),
    sourceList: document.getElementById('source-list'),
    canvasWidth: document.getElementById('canvas-width'),
    canvasHeight: document.getElementById('canvas-height'),
    gridSize: document.getElementById('grid-size'),
    gridSizeValue: document.getElementById('grid-size-value'),
    gridColours: document.getElementById('grid-colours'),
    zoomRange: document.getElementById('zoom-range'),
    zoomValue: document.getElementById('zoom-value'),
    recenterButton: document.getElementById('recenter-btn'),
    resetTransparencyButton: document.getElementById('reset-transparency-btn'),
    eraserToggle: document.getElementById('eraser-toggle'),
    eraserSize: document.getElementById('eraser-size'),
    eraserSizeValue: document.getElementById('eraser-size-value'),
    autoNextButton: document.getElementById('auto-next-btn'),
    setSpriteButton: document.getElementById('set-sprite-btn'),
    canvasStage: document.getElementById('canvas-stage'),
    canvasFrame: document.getElementById('canvas-frame'),
    spriteCanvas: document.getElementById('sprite-canvas'),
    gridCanvas: document.getElementById('grid-canvas'),
    canvasEmptyState: document.getElementById('canvas-empty-state'),
    canvasInstruction: document.getElementById('canvas-instruction'),
    spriteList: document.getElementById('sprite-list'),
    spriteCount: document.getElementById('sprite-count'),
    clearSpritesButton: document.getElementById('clear-sprites-btn'),
    filePrefix: document.getElementById('file-prefix'),
    filenameExample: document.getElementById('filename-example'),
    folderNote: document.getElementById('folder-note'),
    downloadSetButton: document.getElementById('download-set-btn')
  };

  const workContext = elements.spriteCanvas.getContext('2d', { willReadFrequently: true });
  const gridContext = elements.gridCanvas.getContext('2d');
  const maskContext = state.maskCanvas.getContext('2d');
  const resizeObserver = new ResizeObserver(() => fitCanvasPreview());

  function setHubStatus(text) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'set-status', text }, '*');
    }
  }

  function clearHubStatus() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'clear-status' }, '*');
    }
  }

  function setStatus(message, tone = 'normal') {
    elements.status.textContent = message;
    elements.status.classList.remove('is-error', 'is-success');
    if (tone === 'error') elements.status.classList.add('is-error');
    if (tone === 'success') elements.status.classList.add('is-success');
    setHubStatus(message);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function padNumber(number) {
    return String(number).padStart(2, '0');
  }

  function createId(prefix) {
    const uuid = window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${uuid}`;
  }

  function sanitizeFilePrefix(value) {
    const trimmed = value.trim().replace(/\s+/g, '_');
    const safe = trimmed.replace(/[\\/:*?"<>|]+/g, '').replace(/^\.+/, '');
    return safe || 'sprite';
  }

  function sourceById(sourceId) {
    return state.sources.find((source) => source.id === sourceId) || null;
  }

  function activeSource() {
    return sourceById(state.activeSourceId);
  }

  function sourceFileSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function currentScale() {
    return state.baseScale * state.zoom;
  }

  function imageRect() {
    if (!state.image) return null;
    const scale = currentScale();
    const width = state.image.naturalWidth * scale;
    const height = state.image.naturalHeight * scale;
    return {
      x: (elements.spriteCanvas.width - width) / 2 + state.panX,
      y: (elements.spriteCanvas.height - height) / 2 + state.panY,
      width,
      height
    };
  }

  function setCanvasDimensions(width, height, { resetMask = true } = {}) {
    const safeWidth = clamp(Math.round(Number(width) || 256), 1, 8192);
    const safeHeight = clamp(Math.round(Number(height) || 256), 1, 8192);
    elements.canvasWidth.value = safeWidth;
    elements.canvasHeight.value = safeHeight;
    elements.spriteCanvas.width = safeWidth;
    elements.spriteCanvas.height = safeHeight;
    elements.gridCanvas.width = safeWidth;
    elements.gridCanvas.height = safeHeight;
    if (resetMask) resetTransparency(false);
    renderAll();
    fitCanvasPreview();
  }

  function resetTransparency(report = true) {
    maskContext.clearRect(0, 0, state.maskCanvas.width, state.maskCanvas.height);
    renderWorkCanvas();
    if (report && state.image) setStatus('Temporary transparency reset. The original imported image is unchanged.');
  }

  function renderWorkCanvas() {
    workContext.clearRect(0, 0, elements.spriteCanvas.width, elements.spriteCanvas.height);
    if (!state.image) return;
    const rect = imageRect();
    workContext.save();
    workContext.imageSmoothingEnabled = true;
    workContext.imageSmoothingQuality = 'high';
    workContext.drawImage(state.image, rect.x, rect.y, rect.width, rect.height);
    workContext.globalCompositeOperation = 'destination-out';
    workContext.drawImage(state.maskCanvas, rect.x, rect.y, rect.width, rect.height);
    workContext.restore();
  }

  function renderGrid() {
    const width = elements.gridCanvas.width;
    const height = elements.gridCanvas.height;
    gridContext.clearRect(0, 0, width, height);
    const size = Math.max(1, state.gridSize);
    gridContext.save();
    gridContext.strokeStyle = state.gridColour;
    gridContext.globalAlpha = state.gridColour === '#000000' ? 0.63 : 0.58;
    gridContext.lineWidth = Math.max(1, Math.min(2, Math.round(Math.min(width, height) / 700)));
    gridContext.beginPath();
    for (let x = 0; x <= width; x += size) {
      gridContext.moveTo(x + 0.5, 0);
      gridContext.lineTo(x + 0.5, height);
    }
    for (let y = 0; y <= height; y += size) {
      gridContext.moveTo(0, y + 0.5);
      gridContext.lineTo(width, y + 0.5);
    }
    gridContext.stroke();

    const centerAlpha = state.gridColour === '#000000' ? 0.82 : 0.7;
    gridContext.globalAlpha = centerAlpha;
    gridContext.lineWidth = Math.max(1.2, Math.min(2.4, Math.min(width, height) / 220));
    gridContext.beginPath();
    gridContext.moveTo(0.5, 0.5);
    gridContext.lineTo(width - 0.5, height - 0.5);
    gridContext.moveTo(width - 0.5, 0.5);
    gridContext.lineTo(0.5, height - 0.5);
    gridContext.stroke();

    const centerX = width / 2;
    const centerY = height / 2;
    const marker = Math.max(4, Math.min(10, Math.min(width, height) / 18));
    gridContext.beginPath();
    gridContext.moveTo(centerX - marker, centerY + 0.5);
    gridContext.lineTo(centerX + marker, centerY + 0.5);
    gridContext.moveTo(centerX + 0.5, centerY - marker);
    gridContext.lineTo(centerX + 0.5, centerY + marker);
    gridContext.stroke();
    gridContext.restore();
  }


  function sortRegionsRowMajor(regions) {
    if (regions.length <= 1) return regions.slice();
    const sortedByTop = regions.slice().sort((a, b) => a.top - b.top || a.left - b.left);
    const rows = [];
    sortedByTop.forEach((region) => {
      const centerY = region.top + region.height / 2;
      let row = rows.find((entry) => Math.abs(entry.centerY - centerY) <= Math.max(12, entry.avgHeight * 0.45, region.height * 0.45));
      if (!row) {
        row = { items: [], centerY, avgHeight: region.height };
        rows.push(row);
      }
      row.items.push(region);
      row.centerY = row.items.reduce((sum, item) => sum + item.top + item.height / 2, 0) / row.items.length;
      row.avgHeight = row.items.reduce((sum, item) => sum + item.height, 0) / row.items.length;
    });
    rows.sort((a, b) => a.centerY - b.centerY);
    rows.forEach((row) => row.items.sort((a, b) => a.left - b.left));
    return rows.flatMap((row) => row.items);
  }

  function scanSpriteRegions(image) {
    const offscreen = document.createElement('canvas');
    offscreen.width = image.naturalWidth;
    offscreen.height = image.naturalHeight;
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
    offCtx.drawImage(image, 0, 0);
    const { data, width, height } = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const visited = new Uint8Array(width * height);
    const alphaThreshold = 8;
    const stackX = [];
    const stackY = [];
    const regions = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (visited[index]) continue;
        visited[index] = 1;
        if (data[index * 4 + 3] <= alphaThreshold) continue;

        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let pixelCount = 0;
        stackX.push(x);
        stackY.push(y);

        while (stackX.length) {
          const currentX = stackX.pop();
          const currentY = stackY.pop();
          const currentIndex = currentY * width + currentX;
          if (data[currentIndex * 4 + 3] <= alphaThreshold) continue;
          pixelCount += 1;
          if (currentX < minX) minX = currentX;
          if (currentX > maxX) maxX = currentX;
          if (currentY < minY) minY = currentY;
          if (currentY > maxY) maxY = currentY;

          const neighbours = [
            [currentX - 1, currentY], [currentX + 1, currentY],
            [currentX, currentY - 1], [currentX, currentY + 1]
          ];
          for (const [nextX, nextY] of neighbours) {
            if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
            const nextIndex = nextY * width + nextX;
            if (visited[nextIndex]) continue;
            visited[nextIndex] = 1;
            if (data[nextIndex * 4 + 3] > alphaThreshold) {
              stackX.push(nextX);
              stackY.push(nextY);
            }
          }
        }

        const regionWidth = maxX - minX + 1;
        const regionHeight = maxY - minY + 1;
        if (pixelCount < 8 || regionWidth < 2 || regionHeight < 2) continue;
        regions.push({ left: minX, top: minY, right: maxX, bottom: maxY, width: regionWidth, height: regionHeight, pixelCount });
      }
    }
    return sortRegionsRowMajor(regions);
  }

  function analyseActiveSource() {
    const source = activeSource();
    if (!source || !state.image) return;
    source.spriteRegions = scanSpriteRegions(state.image);
    source.nextSpriteRegionIndex = 0;
    state.spriteRegions = source.spriteRegions.slice();
    state.nextSpriteRegionIndex = 0;
    const count = state.spriteRegions.length;
    if (count) setStatus(`Loaded ${source.file.name}. Found ${count} transparent-separated sprite area${count === 1 ? '' : 's'}.`, 'success');
    else setStatus(`Loaded ${source.file.name}. No separate opaque sprite areas were found.`, 'success');
  }

  function frameRegion(region) {
    if (!state.image || !region) return;
    const canvasWidth = elements.spriteCanvas.width;
    const canvasHeight = elements.spriteCanvas.height;
    const margin = 0.92;
    const targetScale = Math.min((canvasWidth * margin) / region.width, (canvasHeight * margin) / region.height);
    state.zoom = clamp(targetScale / state.baseScale, 0.25, 4);
    elements.zoomRange.value = Math.round(state.zoom * 100);
    const rect = imageRect();
    const regionCenterX = rect.x + ((region.left + region.width / 2) * currentScale());
    const regionCenterY = rect.y + ((region.top + region.height / 2) * currentScale());
    state.panX += canvasWidth / 2 - regionCenterX;
    state.panY += canvasHeight / 2 - regionCenterY;
    updateRangeLabels();
    renderWorkCanvas();
  }

  function autoNextSprite() {
    if (!state.image) {
      setStatus('Choose a source image first.', 'error');
      return;
    }
    const source = activeSource();
    if (!source) {
      setStatus('Choose a source image first.', 'error');
      return;
    }
    if (!source.spriteRegions || !source.spriteRegions.length) {
      analyseActiveSource();
    }
    if (!source.spriteRegions || !source.spriteRegions.length) {
      setStatus('No separate opaque sprite areas were found in this image.', 'error');
      return;
    }
    const index = source.nextSpriteRegionIndex || 0;
    if (index >= source.spriteRegions.length) {
      setStatus('No more sprite areas were found in this image.', 'error');
      return;
    }
    const region = source.spriteRegions[index];
    frameRegion(region);
    source.nextSpriteRegionIndex = index + 1;
    state.nextSpriteRegionIndex = source.nextSpriteRegionIndex;
    setStatus(`Auto framed sprite area ${padNumber(index + 1)} of ${padNumber(source.spriteRegions.length)}.`, 'success');
  }

  function renderAll() {
    renderWorkCanvas();
    renderGrid();
    elements.canvasEmptyState.classList.toggle('is-hidden', Boolean(state.image));
    elements.canvasFrame.classList.toggle('is-eraser', state.eraserEnabled && Boolean(state.image));
    elements.canvasInstruction.textContent = state.image
      ? (state.eraserEnabled ? 'Eraser mode: drag over areas that should become transparent. Reset returns to the original.' : 'Drag the source image to position it. Use the scale slider or mouse wheel to zoom.')
      : 'Choose a source thumbnail, then drag the image to position it.';
  }

  function fitCanvasPreview() {
    const canvasWidth = elements.spriteCanvas.width || 256;
    const canvasHeight = elements.spriteCanvas.height || 256;
    const stageWidth = Math.max(1, elements.canvasStage.clientWidth - 44);
    const stageHeight = Math.max(1, elements.canvasStage.clientHeight - 44);
    const scale = Math.max(0.02, Math.min(stageWidth / canvasWidth, stageHeight / canvasHeight));
    elements.canvasFrame.style.width = `${Math.max(1, Math.floor(canvasWidth * scale))}px`;
    elements.canvasFrame.style.height = `${Math.max(1, Math.floor(canvasHeight * scale))}px`;
  }

  function updateRangeLabels() {
    elements.gridSizeValue.textContent = `${state.gridSize} px`;
    elements.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
    elements.eraserSizeValue.textContent = `${state.eraserSize} px`;
  }

  function updateFilenameExample() {
    const prefix = sanitizeFilePrefix(elements.filePrefix.value);
    elements.filenameExample.textContent = `${prefix}_01.png`;
  }

  function updateEraserToggle() {
    elements.eraserToggle.classList.toggle('is-active', state.eraserEnabled);
    elements.eraserToggle.setAttribute('aria-pressed', String(state.eraserEnabled));
    elements.eraserToggle.textContent = state.eraserEnabled ? 'Eraser on' : 'Eraser off';
    renderAll();
  }

  function renderSources() {
    elements.sourceList.innerHTML = '';
    if (state.sources.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-copy';
      empty.textContent = 'Imported images will appear here as draggable thumbnails.';
      elements.sourceList.appendChild(empty);
      return;
    }

    state.sources.forEach((source) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `source-item${source.id === state.activeSourceId ? ' is-selected' : ''}`;
      item.draggable = true;
      item.dataset.sourceId = source.id;
      item.title = 'Click to select. Drag this thumbnail into the crop canvas to load it.';

      const thumb = document.createElement('img');
      thumb.className = 'source-thumb';
      thumb.src = source.url;
      thumb.alt = '';

      const copy = document.createElement('span');
      copy.className = 'source-copy';
      const name = document.createElement('span');
      name.className = 'source-name';
      name.textContent = source.file.name;
      const meta = document.createElement('span');
      meta.className = 'source-meta';
      meta.textContent = source.dimensions ? `${source.dimensions.width}×${source.dimensions.height} · ${sourceFileSize(source.file.size)}` : sourceFileSize(source.file.size);
      copy.append(name, meta);

      const drag = document.createElement('span');
      drag.className = 'source-drag';
      drag.textContent = '↗';
      drag.setAttribute('aria-hidden', 'true');
      item.append(thumb, copy, drag);

      item.addEventListener('click', () => loadSource(source.id));
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', source.id);
      });
      elements.sourceList.appendChild(item);
    });
  }

  function renderSprites() {
    elements.spriteList.innerHTML = '';
    elements.spriteCount.textContent = state.sprites.length;
    elements.clearSpritesButton.disabled = state.sprites.length === 0;
    elements.downloadSetButton.disabled = state.sprites.length === 0;

    if (state.sprites.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-copy';
      empty.textContent = 'Each crop you set will appear in a numbered box here.';
      elements.spriteList.appendChild(empty);
      return;
    }

    state.sprites.forEach((sprite, index) => {
      const item = document.createElement('div');
      item.className = 'sprite-item';
      const preview = document.createElement('img');
      preview.className = 'sprite-preview';
      preview.src = sprite.url;
      preview.alt = `Sprite ${padNumber(index + 1)} preview`;
      const copy = document.createElement('div');
      const number = document.createElement('div');
      number.className = 'sprite-number';
      number.textContent = `SPRITE ${padNumber(index + 1)}`;
      const dimensions = document.createElement('div');
      dimensions.className = 'sprite-dimensions';
      dimensions.textContent = `${sprite.width} × ${sprite.height} PNG`;
      copy.append(number, dimensions);
      const remove = document.createElement('button');
      remove.className = 'remove-sprite';
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = `Remove sprite ${padNumber(index + 1)}`;
      remove.setAttribute('aria-label', `Remove sprite ${padNumber(index + 1)}`);
      remove.addEventListener('click', () => removeSprite(sprite.id));
      item.append(preview, copy, remove);
      elements.spriteList.appendChild(item);
    });
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) {
      setStatus('Please choose image files only.', 'error');
      return;
    }

    const newSources = files.map((file) => ({
      id: createId('source'),
      file,
      url: URL.createObjectURL(file),
      dimensions: null
    }));
    state.sources.push(...newSources);
    renderSources();
    setStatus(`${newSources.length} image${newSources.length === 1 ? '' : 's'} added to the source tray.`, 'success');

    newSources.forEach((source) => {
      const image = new Image();
      image.onload = () => {
        source.dimensions = { width: image.naturalWidth, height: image.naturalHeight };
        renderSources();
      };
      image.src = source.url;
    });

    if (!state.activeSourceId) loadSource(newSources[0].id);
  }

  function loadSource(sourceId) {
    const source = sourceById(sourceId);
    if (!source) return;
    const image = new Image();
    image.onload = () => {
      state.activeSourceId = source.id;
      state.image = image;
      state.maskCanvas.width = image.naturalWidth;
      state.maskCanvas.height = image.naturalHeight;
      state.baseScale = Math.max(1, elements.spriteCanvas.width / image.naturalWidth, elements.spriteCanvas.height / image.naturalHeight);
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      state.spriteRegions = [];
      state.nextSpriteRegionIndex = 0;
      source.nextSpriteRegionIndex = 0;
      elements.zoomRange.value = 100;
      resetTransparency(false);
      updateRangeLabels();
      renderSources();
      renderAll();
      analyseActiveSource();
    };
    image.onerror = () => setStatus(`Could not load ${source.file.name}.`, 'error');
    image.src = source.url;
  }

  function getCanvasPoint(event) {
    const rect = elements.spriteCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (elements.spriteCanvas.width / rect.width),
      y: (event.clientY - rect.top) * (elements.spriteCanvas.height / rect.height)
    };
  }

  function eraseAt(fromX, fromY, toX, toY) {
    if (!state.image) return;
    const rect = imageRect();
    const scale = currentScale();
    const sourceFromX = (fromX - rect.x) / scale;
    const sourceFromY = (fromY - rect.y) / scale;
    const sourceToX = (toX - rect.x) / scale;
    const sourceToY = (toY - rect.y) / scale;
    const sourceBrushSize = state.eraserSize / scale;
    maskContext.save();
    maskContext.globalCompositeOperation = 'source-over';
    maskContext.fillStyle = '#ffffff';
    maskContext.strokeStyle = '#ffffff';
    maskContext.lineCap = 'round';
    maskContext.lineJoin = 'round';
    maskContext.lineWidth = sourceBrushSize;
    maskContext.beginPath();
    maskContext.moveTo(sourceFromX, sourceFromY);
    maskContext.lineTo(sourceToX, sourceToY);
    maskContext.stroke();
    maskContext.beginPath();
    maskContext.arc(sourceToX, sourceToY, sourceBrushSize / 2, 0, Math.PI * 2);
    maskContext.fill();
    maskContext.restore();
  }

  function handlePointerDown(event) {
    if (!state.image || event.button !== 0) return;
    const point = getCanvasPoint(event);
    state.pointer.active = true;
    state.pointer.id = event.pointerId;
    state.pointer.mode = state.eraserEnabled ? 'erase' : 'pan';
    state.pointer.lastX = point.x;
    state.pointer.lastY = point.y;
    elements.spriteCanvas.setPointerCapture(event.pointerId);
    if (state.pointer.mode === 'erase') {
      eraseAt(point.x, point.y, point.x, point.y);
      renderWorkCanvas();
    }
  }

  function handlePointerMove(event) {
    if (!state.pointer.active || event.pointerId !== state.pointer.id || !state.image) return;
    const point = getCanvasPoint(event);
    if (state.pointer.mode === 'erase') {
      eraseAt(state.pointer.lastX, state.pointer.lastY, point.x, point.y);
      renderWorkCanvas();
    } else {
      state.panX += point.x - state.pointer.lastX;
      state.panY += point.y - state.pointer.lastY;
      renderWorkCanvas();
    }
    state.pointer.lastX = point.x;
    state.pointer.lastY = point.y;
  }

  function endPointer(event) {
    if (event.pointerId !== state.pointer.id) return;
    state.pointer.active = false;
    state.pointer.id = null;
    state.pointer.mode = null;
  }

  function zoomAtPoint(point, nextZoom) {
    if (!state.image) return;
    const previousScale = currentScale();
    state.zoom = clamp(nextZoom, 0.25, 4);
    const nextScale = currentScale();
    const centerX = elements.spriteCanvas.width / 2;
    const centerY = elements.spriteCanvas.height / 2;
    state.panX = point.x - centerX - ((point.x - centerX - state.panX) * nextScale / previousScale);
    state.panY = point.y - centerY - ((point.y - centerY - state.panY) * nextScale / previousScale);
    elements.zoomRange.value = Math.round(state.zoom * 100);
    updateRangeLabels();
    renderWorkCanvas();
  }

  function handleWheel(event) {
    if (!state.image) return;
    event.preventDefault();
    const point = getCanvasPoint(event);
    const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    zoomAtPoint(point, state.zoom * factor);
  }

  function recenterImage() {
    if (!state.image) {
      setStatus('Choose a source image first.', 'error');
      return;
    }
    state.panX = 0;
    state.panY = 0;
    renderWorkCanvas();
    setStatus('Image recentered.');
  }

  function blobFromCanvas(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The canvas could not be converted to PNG.'));
      }, 'image/png');
    });
  }

  async function setSprite() {
    if (!state.image) {
      setStatus('Choose and position a source image before setting a sprite.', 'error');
      return;
    }
    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = elements.spriteCanvas.width;
      exportCanvas.height = elements.spriteCanvas.height;
      exportCanvas.getContext('2d').drawImage(elements.spriteCanvas, 0, 0);
      const blob = await blobFromCanvas(exportCanvas);
      const url = URL.createObjectURL(blob);
      state.sprites.push({
        id: createId('sprite'),
        blob,
        url,
        width: exportCanvas.width,
        height: exportCanvas.height
      });
      renderSprites();
      setStatus(`Sprite ${padNumber(state.sprites.length)} added to the set.`, 'success');
    } catch (error) {
      console.error(error);
      setStatus('Could not create this PNG sprite.', 'error');
    }
  }

  function removeSprite(spriteId) {
    const index = state.sprites.findIndex((sprite) => sprite.id === spriteId);
    if (index === -1) return;
    URL.revokeObjectURL(state.sprites[index].url);
    state.sprites.splice(index, 1);
    renderSprites();
    setStatus('Sprite removed from the set.');
  }

  function clearSprites() {
    if (state.sprites.length === 0) return;
    state.sprites.forEach((sprite) => URL.revokeObjectURL(sprite.url));
    state.sprites = [];
    renderSprites();
    setStatus('The current sprite set was cleared.');
  }

  function clearSources() {
    state.sources.forEach((source) => URL.revokeObjectURL(source.url));
    state.sources = [];
    state.activeSourceId = null;
    state.image = null;
    resetTransparency(false);
    renderSources();
    renderAll();
    setStatus('Source tray cleared. Your ready sprite set was kept.');
  }

  async function downloadSet() {
    if (state.sprites.length === 0) {
      setStatus('Set at least one sprite before downloading.', 'error');
      return;
    }

    const prefix = sanitizeFilePrefix(elements.filePrefix.value);
    elements.filePrefix.value = prefix;
    updateFilenameExample();

    try {
      if ('showDirectoryPicker' in window) {
        setStatus('Choose the destination folder for your PNG set.');
        const directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        for (let index = 0; index < state.sprites.length; index += 1) {
          const filename = `${prefix}_${padNumber(index + 1)}.png`;
          const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(state.sprites[index].blob);
          await writable.close();
        }
        elements.folderNote.textContent = `${state.sprites.length} PNG file${state.sprites.length === 1 ? '' : 's'} saved to “${directoryHandle.name}”. Existing same-named files were replaced.`;
        setStatus(`Saved ${state.sprites.length} numbered PNG file${state.sprites.length === 1 ? '' : 's'} to ${directoryHandle.name}.`, 'success');
        return;
      }

      state.sprites.forEach((sprite, index) => {
        const filename = `${prefix}_${padNumber(index + 1)}.png`;
        const anchor = document.createElement('a');
        anchor.href = sprite.url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      });
      elements.folderNote.textContent = 'This browser cannot choose a target folder here, so it sent the numbered PNG files to its normal download location.';
      setStatus(`Started ${state.sprites.length} numbered PNG download${state.sprites.length === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      if (error && error.name === 'AbortError') {
        setStatus('Folder selection cancelled. Nothing was saved.');
        return;
      }
      console.error(error);
      setStatus('The PNG set could not be saved. Check browser folder permissions and try again.', 'error');
    }
  }

  function applyCanvasDimensions() {
    const priorWidth = elements.spriteCanvas.width;
    const priorHeight = elements.spriteCanvas.height;
    const width = clamp(Math.round(Number(elements.canvasWidth.value) || priorWidth), 1, 8192);
    const height = clamp(Math.round(Number(elements.canvasHeight.value) || priorHeight), 1, 8192);
    if (width === priorWidth && height === priorHeight) return;
    setCanvasDimensions(width, height, { resetMask: false });
    if (state.image) {
      state.baseScale = Math.max(1, width / state.image.naturalWidth, height / state.image.naturalHeight);
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      elements.zoomRange.value = 100;
      updateRangeLabels();
    }
    renderAll();
    fitCanvasPreview();
    setStatus('Canvas size updated. Your temporary transparency was kept with the source image.');
  }

  function bindEvents() {
    elements.fileInput.addEventListener('change', (event) => {
      addFiles(event.target.files);
      event.target.value = '';
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        elements.dropZone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        elements.dropZone.classList.remove('is-dragover');
      });
    });
    elements.dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));

    ['dragenter', 'dragover'].forEach((eventName) => {
      elements.canvasFrame.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.canvasFrame.classList.add('is-drop-target');
      });
    });
    ['dragleave', 'drop'].forEach((eventName) => {
      elements.canvasFrame.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.canvasFrame.classList.remove('is-drop-target');
      });
    });
    elements.canvasFrame.addEventListener('drop', (event) => {
      const sourceId = event.dataTransfer.getData('text/plain');
      if (sourceById(sourceId)) loadSource(sourceId);
      else if (event.dataTransfer.files && event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
    });

    elements.clearSourcesButton.addEventListener('click', clearSources);
    elements.canvasWidth.addEventListener('change', applyCanvasDimensions);
    elements.canvasHeight.addEventListener('change', applyCanvasDimensions);
    elements.gridSize.addEventListener('input', () => {
      state.gridSize = Number(elements.gridSize.value);
      updateRangeLabels();
      renderGrid();
    });
    elements.gridColours.addEventListener('click', (event) => {
      const button = event.target.closest('[data-colour]');
      if (!button) return;
      state.gridColour = button.dataset.colour;
      elements.gridColours.querySelectorAll('.colour-button').forEach((item) => item.classList.toggle('is-active', item === button));
      renderGrid();
    });
    elements.zoomRange.addEventListener('input', () => {
      if (!state.image) return;
      state.zoom = Number(elements.zoomRange.value) / 100;
      updateRangeLabels();
      renderWorkCanvas();
    });
    elements.recenterButton.addEventListener('click', recenterImage);
    elements.resetTransparencyButton.addEventListener('click', () => resetTransparency(true));
    elements.eraserToggle.addEventListener('click', () => {
      if (!state.image) {
        setStatus('Choose a source image before using the eraser.', 'error');
        return;
      }
      state.eraserEnabled = !state.eraserEnabled;
      updateEraserToggle();
      setStatus(state.eraserEnabled ? 'Temporary transparency eraser enabled.' : 'Image positioning mode enabled.');
    });
    elements.eraserSize.addEventListener('input', () => {
      state.eraserSize = Number(elements.eraserSize.value);
      updateRangeLabels();
    });
    elements.autoNextButton.addEventListener('click', autoNextSprite);
    elements.setSpriteButton.addEventListener('click', setSprite);
    elements.clearSpritesButton.addEventListener('click', clearSprites);
    elements.filePrefix.addEventListener('input', updateFilenameExample);
    elements.downloadSetButton.addEventListener('click', downloadSet);

    elements.spriteCanvas.addEventListener('pointerdown', handlePointerDown);
    elements.spriteCanvas.addEventListener('pointermove', handlePointerMove);
    elements.spriteCanvas.addEventListener('pointerup', endPointer);
    elements.spriteCanvas.addEventListener('pointercancel', endPointer);
    elements.spriteCanvas.addEventListener('wheel', handleWheel, { passive: false });

    window.addEventListener('beforeunload', () => {
      state.sources.forEach((source) => URL.revokeObjectURL(source.url));
      state.sprites.forEach((sprite) => URL.revokeObjectURL(sprite.url));
    });
  }

  function init() {
    setCanvasDimensions(256, 256, { resetMask: false });
    state.gridSize = Number(elements.gridSize.value);
    state.eraserSize = Number(elements.eraserSize.value);
    updateRangeLabels();
    updateFilenameExample();
    renderSources();
    renderSprites();
    renderAll();
    bindEvents();
    resizeObserver.observe(elements.canvasStage);
    requestAnimationFrame(fitCanvasPreview);
  }

  init();
})();
