function updateAccessNote() {
  const item = getPrimaryItem();
  if (!item) {
    elements.accessNote.textContent = state.mode === 'bulk'
      ? 'Save Options will ask for an output folder, then Convert Queue writes every file there.'
      : 'Save a new copy will be available after compression.';
    elements.accessNote.className = 'access-note copy-only';
    return;
  }
  const plan = getOutputPlan(item);
  if (state.mode === 'bulk') {
    if (state.outputFolderHandle) {
      elements.accessNote.textContent = `Output folder authorised. Every converted ${plan.extension.toUpperCase()} file will be written there automatically.`;
      elements.accessNote.className = 'access-note overwrite-ready';
    } else {
      elements.accessNote.textContent = 'Bulk mode requires Save Options first so the browser can authorise an output folder.';
      elements.accessNote.className = 'access-note copy-only';
    }
    return;
  }
  if (item.handle && plan.canOverwrite) {
    elements.accessNote.textContent = `${plan.extension.toUpperCase()} output matches the source extension. Save Over Original will be available after compression.`;
    elements.accessNote.className = 'access-note overwrite-ready';
  } else if (item.handle && !plan.canOverwrite) {
    elements.accessNote.textContent = `Converting ${plan.inputExtension.toUpperCase()} to ${plan.extension.toUpperCase()} changes the file format, so this must be saved as a new copy.`;
    elements.accessNote.className = 'access-note copy-only';
  } else {
    elements.accessNote.textContent = `Dropped or standard-picked file: the compressed ${plan.extension.toUpperCase()} will be saved as a new copy.`;
    elements.accessNote.className = 'access-note copy-only';
  }
}

function getOutputPlan(item) {
  const inputExtension = getExtension(item.file.name);
  const requestedFormat = elements.outputFormat.value;
  let extension = 'mp4';
  if (requestedFormat === 'ogv') {
    extension = 'ogv';
  } else if (requestedFormat === 'mp4') {
    extension = 'mp4';
  } else if (OGV_INPUT_EXTENSIONS.has(inputExtension)) {
    extension = 'ogv';
  } else if (SAME_CONTAINER_EXTENSIONS.has(inputExtension)) {
    extension = inputExtension;
  }
  return {
    inputExtension,
    requestedFormat,
    extension,
    mime: getMimeForExtension(extension),
    codecFamily: extension === 'ogv' ? 'ogv' : 'h264',
    canOverwrite: inputExtension === extension,
    name: `${getBaseName(item.file.name)}-compressed.${extension}`
  };
}

function getAudioBitrateKbps() {
  return Math.max(0, Number(elements.audioBitrateSelect.value) || 0);
}

function getContainerOverhead(codecFamily) {
  return codecFamily === 'ogv' ? 1.08 : 1.04;
}

function getRequestedHeight(item, videoBitrateKbps) {
  if (!item.height) return 0;
  const setting = elements.resolutionSelect.value;
  if (setting === 'keep') return item.height;
  if (setting !== 'auto') return Math.min(item.height, Number(setting));
  if (item.height > 1080 && videoBitrateKbps < 4500) return 1080;
  if (item.height > 720 && videoBitrateKbps < 2200) return 720;
  if (item.height > 480 && videoBitrateKbps < 950) return 480;
  return item.height;
}

function getResolutionDetails(item, videoBitrateKbps) {
  const height = getRequestedHeight(item, videoBitrateKbps);
  if (!height || !item.width || !item.height) return { width: 0, height: 0, scaleFilter: '' };
  if (height >= item.height) return { width: item.width, height: item.height, scaleFilter: '' };
  const rawWidth = item.width * (height / item.height);
  const width = Math.max(2, Math.round(rawWidth / 2) * 2);
  return { width, height, scaleFilter: `scale=-2:${height}:force_original_aspect_ratio=decrease` };
}

function getCompressionPlan(item) {
  if (!item || !item.file || !item.duration || !Number.isFinite(item.duration)) return null;
  const outputPlan = getOutputPlan(item);
  const mode = elements.compressionMode.value;
  const audioBitrateKbps = getAudioBitrateKbps();
  const overhead = getContainerOverhead(outputPlan.codecFamily);
  const passes = Number(elements.passesSelect.value) === 2 ? 2 : 1;
  let desiredBytes = 0;
  let videoBitrateKbps = 0;

  if (mode === 'smart') {
    desiredBytes = item.file.size * (Number(elements.smartSizeSlider.value) / 100);
  } else if (mode === 'target') {
    desiredBytes = Math.max(1, Number(elements.targetSizeInput.value) || 1) * 1024 * 1024;
  } else {
    videoBitrateKbps = Math.max(MIN_VIDEO_BITRATE_KBPS, Number(elements.manualVideoSlider.value) || MIN_VIDEO_BITRATE_KBPS);
  }

  if (mode !== 'manual') {
    const totalBitrateKbps = (desiredBytes * 8) / item.duration / 1000 / overhead;
    videoBitrateKbps = Math.max(MIN_VIDEO_BITRATE_KBPS, Math.floor(totalBitrateKbps - audioBitrateKbps));
  }

  const estimatedBytes = ((videoBitrateKbps + audioBitrateKbps) * 1000 * item.duration / 8) * overhead;
  const tolerance = outputPlan.codecFamily === 'ogv' ? (passes === 2 ? 0.18 : 0.25) : (passes === 2 ? 0.08 : 0.16);
  const lowerBytes = Math.max(0, estimatedBytes * (1 - tolerance));
  const upperBytes = estimatedBytes * (1 + tolerance);
  const resolution = getResolutionDetails(item, videoBitrateKbps);
  const changePercent = item.file.size > 0 ? ((estimatedBytes - item.file.size) / item.file.size) * 100 : 0;

  let warning = '';
  if (estimatedBytes > item.file.size * 1.01) {
    warning = 'These settings are likely to create a file larger than the original. Reduce the target size, video bitrate, audio bitrate, or resolution.';
  } else if (videoBitrateKbps <= MIN_VIDEO_BITRATE_KBPS) {
    warning = 'The requested size leaves almost no bitrate for video. Increase the target size or reduce/remove the audio track.';
  } else if (videoBitrateKbps < 350 && resolution.height > 480) {
    warning = 'The video bitrate is very low for this resolution. Auto or 480p resolution should preserve more usable detail.';
  } else if (videoBitrateKbps < 900 && resolution.height > 720) {
    warning = 'The video bitrate is low for this resolution. Auto or 720p resolution may look better at the same file size.';
  }

  return {
    item,
    mode,
    outputPlan,
    passes,
    desiredBytes,
    videoBitrateKbps,
    audioBitrateKbps,
    estimatedBytes,
    lowerBytes,
    upperBytes,
    changePercent,
    resolution,
    warning
  };
}

function paintRange(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const value = Number(input.value) || min;
  const percentage = ((value - min) / Math.max(1, max - min)) * 100;
  input.style.background = `linear-gradient(to right, var(--brand-red) 0%, var(--brand-red) ${percentage}%, var(--slider-track) ${percentage}%, var(--slider-track) 100%)`;
}

function updateFormatHelp() {
  const format = elements.outputFormat.value;
  if (format === 'ogv') {
    elements.formatHelp.textContent = 'Creates an .ogv file using Theora video and Vorbis audio. In bulk mode each file is written into the authorised folder.';
  } else if (format === 'mp4') {
    elements.formatHelp.textContent = 'Creates an .mp4 file using H.264 video and AAC audio. In bulk mode each file is written into the authorised folder.';
  } else {
    elements.formatHelp.textContent = 'Keeps MP4, M4V, MOV, MKV, AVI, and OGV containers. WebM is converted to MP4.';
  }
}

function updateModePanels() {
  const mode = elements.compressionMode.value;
  elements.smartPanel.hidden = mode !== 'smart';
  elements.targetPanel.hidden = mode !== 'target';
  elements.manualPanel.hidden = mode !== 'manual';
  if (mode === 'smart') {
    elements.modeHelp.textContent = 'Targets a percentage of the original file while allocating separate video and audio bitrates.';
  } else if (mode === 'target') {
    elements.modeHelp.textContent = 'Calculates the bitrates needed to approach the file size you enter.';
  } else {
    elements.modeHelp.textContent = 'Uses the exact video and audio bitrates selected below. Final size is estimated from duration.';
  }
}

function updateQueueUi() {
  const isBulk = state.mode === 'bulk';
  elements.batchCard.hidden = !isBulk || state.queue.length === 0;
  elements.batchSummary.textContent = `${state.queue.length} ${state.queue.length === 1 ? 'file' : 'files'}`;
  if (!isBulk) return;
  elements.batchQueue.innerHTML = '';
  state.queue.forEach((item) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `batch-item${item.id === state.selectedQueueId ? ' selected' : ''}`;
    row.dataset.id = item.id;
    row.innerHTML = `
      <span class="batch-dot" aria-hidden="true"></span>
      <span>
        <span class="batch-name">${escapeHtml(item.file.name)}</span>
        <span class="batch-meta">${formatBytes(item.file.size)}${item.duration ? ` · ${Math.round(item.duration)} sec` : ' · reading metadata…'}</span>
      </span>
      <span class="batch-status ${item.status}">${escapeHtml(item.statusLabel || getStatusLabel(item.status))}</span>
    `;
    row.addEventListener('click', () => {
      state.selectedQueueId = item.id;
      loadSelectedItemIntoPreview();
      updateEstimate();
      updateQueueUi();
    });
    elements.batchQueue.appendChild(row);
  });
}

function getStatusLabel(status) {
  if (status === 'saved') return 'Saved';
  if (status === 'failed') return 'Failed';
  if (status === 'converting') return 'Converting';
  return 'Ready';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadSelectedItemIntoPreview() {
  const item = getPrimaryItem();
  if (!item) {
    elements.sourceCard.hidden = true;
    revokeSourceObjectUrl();
    return;
  }
  revokeSourceObjectUrl();
  state.sourceObjectUrl = URL.createObjectURL(item.file);
  elements.sourcePreview.onerror = () => {
    elements.sourceMeta.textContent = `${formatBytes(item.file.size)} · browser preview unavailable`;
    elements.sourcePlaceholder.hidden = false;
  };
  elements.sourcePreview.src = state.sourceObjectUrl;
  elements.sourcePreview.onloadedmetadata = () => {
    if (!item.duration && Number.isFinite(elements.sourcePreview.duration)) item.duration = elements.sourcePreview.duration;
    if (!item.width && elements.sourcePreview.videoWidth) item.width = elements.sourcePreview.videoWidth;
    if (!item.height && elements.sourcePreview.videoHeight) item.height = elements.sourcePreview.videoHeight;
    elements.sourceMeta.textContent = buildItemMeta(item);
    updateEstimate();
    updateQueueUi();
  };
  elements.sourcePlaceholder.hidden = true;
  elements.sourceName.textContent = item.file.name;
  elements.sourceMeta.textContent = buildItemMeta(item);
  elements.sourceCard.hidden = false;
  updateAccessNote();
}

function buildItemMeta(item) {
  const dimensions = item.width && item.height ? `${item.width}×${item.height}` : 'dimensions unavailable';
  const duration = item.duration ? `${Math.round(item.duration)} sec` : 'reading duration…';
  return `${formatBytes(item.file.size)} · ${dimensions} · ${duration}`;
}

function updateEstimate() {
  paintRange(elements.smartSizeSlider);
  paintRange(elements.manualVideoSlider);
  elements.smartSizeValue.textContent = `${elements.smartSizeSlider.value}% of original`;
  elements.manualVideoValue.textContent = `${Number(elements.manualVideoSlider.value).toLocaleString()} kbps`;
  elements.audioBitrateReadout.textContent = getAudioBitrateKbps() ? `${getAudioBitrateKbps()} kbps` : 'Removed';
  updateFormatHelp();
  updateModePanels();
  const item = getPrimaryItem();
  const plan = getCompressionPlan(item);
  state.latestPlan = plan;
  if (!plan) {
    resetEstimateView();
    setBusy(state.isBusy);
    return;
  }
  elements.estimatedSize.textContent = `${formatBytes(plan.lowerBytes)}–${formatBytes(plan.upperBytes)}`;
  elements.estimateOriginal.textContent = formatBytes(item.file.size);
  const sign = plan.changePercent > 0 ? '+' : '';
  elements.estimateChange.textContent = `${sign}${Math.round(plan.changePercent)}%`;
  elements.estimateVideo.textContent = formatKbps(plan.videoBitrateKbps);
  elements.estimateAudio.textContent = plan.audioBitrateKbps ? formatKbps(plan.audioBitrateKbps) : 'Removed';
  elements.videoBitrateReadout.textContent = formatKbps(plan.videoBitrateKbps);
  elements.resolutionReadout.textContent = plan.resolution.width && plan.resolution.height ? `${plan.resolution.width}×${plan.resolution.height}` : 'Keep original';
  if (plan.warning) {
    elements.estimateWarning.hidden = false;
    elements.estimateWarning.textContent = plan.warning;
  } else {
    elements.estimateWarning.hidden = true;
  }
  setBusy(state.isBusy);
}

async function readMetadataFromFile(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    const finalize = (details) => {
      URL.revokeObjectURL(objectUrl);
      resolve(details);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => finalize({ duration: Number(video.duration) || 0, width: video.videoWidth || 0, height: video.videoHeight || 0 });
    video.onerror = () => finalize({ duration: 0, width: 0, height: 0 });
    video.src = objectUrl;
  });
}

async function addFilesToQueue(fileEntries) {
  const validEntries = fileEntries.filter((entry) => {
    const extension = getExtension(entry.file.name);
    return SUPPORTED_EXTENSIONS.has(extension) || String(entry.file.type || '').startsWith('video/');
  });
  if (!validEntries.length) {
    setStatus('That selection did not contain supported video files.', 'error');
    return;
  }
  for (const entry of validEntries) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const metadata = await readMetadataFromFile(entry.file);
    state.queue.push({
      id,
      file: entry.file,
      handle: entry.handle || null,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      status: 'ready',
      statusLabel: 'Ready',
      lastResult: null
    });
  }
  if (!state.selectedQueueId && state.queue[0]) state.selectedQueueId = state.queue[0].id;
  loadSelectedItemIntoPreview();
  updateQueueUi();
  updateEstimate();
  updateAccessNote();
  const fileWord = validEntries.length === 1 ? 'video' : 'videos';
  setStatus(state.mode === 'bulk' ? `Added ${validEntries.length} ${fileWord} to the queue.` : 'Video ready. Choose the output format and compression settings, then press Compress Video.', 'success');
  setBusy(false);
}
