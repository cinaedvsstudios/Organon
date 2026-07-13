'use strict';

const VERSION = '0.03';
const SUPPORTED_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'mkv', 'avi', 'webm', 'ogv', 'ogg']);
const SAME_CONTAINER_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'mkv', 'avi', 'ogv']);
const OGV_INPUT_EXTENSIONS = new Set(['ogv', 'ogg']);
const MIN_VIDEO_BITRATE_KBPS = 120;

const elements = {
  topStickyPanel: document.getElementById('top-sticky-panel'),
  countdownCircle: document.getElementById('countdown-circle'),
  engineState: document.getElementById('engine-state'),
  openVideoButton: document.getElementById('open-video-btn'),
  clearButton: document.getElementById('clear-btn'),
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  sourceCard: document.getElementById('source-card'),
  sourcePreview: document.getElementById('source-preview'),
  sourcePlaceholder: document.getElementById('source-placeholder'),
  sourceName: document.getElementById('source-name'),
  sourceMeta: document.getElementById('source-meta'),
  accessNote: document.getElementById('access-note'),
  outputFormat: document.getElementById('output-format'),
  formatHelp: document.getElementById('format-help'),
  compressionMode: document.getElementById('compression-mode'),
  modeHelp: document.getElementById('mode-help'),
  smartPanel: document.getElementById('smart-panel'),
  smartSizeSlider: document.getElementById('smart-size-slider'),
  smartSizeValue: document.getElementById('smart-size-value'),
  targetPanel: document.getElementById('target-panel'),
  targetSizeInput: document.getElementById('target-size-input'),
  manualPanel: document.getElementById('manual-panel'),
  manualVideoSlider: document.getElementById('manual-video-slider'),
  manualVideoValue: document.getElementById('manual-video-value'),
  resolutionSelect: document.getElementById('resolution-select'),
  passesSelect: document.getElementById('passes-select'),
  videoBitrateReadout: document.getElementById('video-bitrate-readout'),
  resolutionReadout: document.getElementById('resolution-readout'),
  audioBitrateSelect: document.getElementById('audio-bitrate-select'),
  audioChannelsSelect: document.getElementById('audio-channels-select'),
  audioBitrateReadout: document.getElementById('audio-bitrate-readout'),
  estimatedSize: document.getElementById('estimated-size'),
  estimateOriginal: document.getElementById('estimate-original'),
  estimateChange: document.getElementById('estimate-change'),
  estimateVideo: document.getElementById('estimate-video'),
  estimateAudio: document.getElementById('estimate-audio'),
  estimateWarning: document.getElementById('estimate-warning'),
  progressCard: document.getElementById('progress-card'),
  progressTitle: document.getElementById('progress-title'),
  progressValue: document.getElementById('progress-value'),
  progressFill: document.getElementById('progress-fill'),
  progressNote: document.getElementById('progress-note'),
  resultCard: document.getElementById('result-card'),
  resultFileName: document.getElementById('result-file-name'),
  resultOriginalSize: document.getElementById('result-original-size'),
  resultEstimatedSize: document.getElementById('result-estimated-size'),
  resultOutputSize: document.getElementById('result-output-size'),
  resultChange: document.getElementById('result-change'),
  resultAccuracy: document.getElementById('result-accuracy'),
  resultFormat: document.getElementById('result-format'),
  resultPreview: document.getElementById('result-preview'),
  resultPreviewNote: document.getElementById('result-preview-note'),
  statusLine: document.getElementById('status-line'),
  compressButton: document.getElementById('compress-btn'),
  showSaveActionsButton: document.getElementById('show-save-actions-btn'),
  saveActions: document.getElementById('save-actions'),
  overwriteButton: document.getElementById('overwrite-btn'),
  saveCopyButton: document.getElementById('save-copy-btn')
};

const state = {
  sourceFile: null,
  sourceHandle: null,
  sourceObjectUrl: null,
  sourceDuration: 0,
  sourceWidth: 0,
  sourceHeight: 0,
  outputBlob: null,
  outputObjectUrl: null,
  outputFileName: '',
  outputCanOverwriteSource: false,
  latestPlan: null,
  ffmpeg: null,
  ffmpegLoaded: false,
  isBusy: false,
  progressStage: 'encode',
  countdownValue: 5,
  countdownTimer: null,
  panelLocked: false,
  panelHovered: false
};

function setHubStatus(text) {
  if (window.parent && window.parent !== window && window.parent.postMessage) {
    window.parent.postMessage({ type: 'set-status', text }, '*');
  }
}

function clearHubStatus() {
  if (window.parent && window.parent !== window && window.parent.postMessage) {
    window.parent.postMessage({ type: 'clear-status' }, '*');
  }
}

function setStatus(text, type = '') {
  elements.statusLine.textContent = text;
  elements.statusLine.className = `status-line${type ? ` ${type}` : ''}`;
  setHubStatus(text);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function formatBitrate(kbps) {
  if (!Number.isFinite(kbps)) return '—';
  if (kbps >= 1000) {
    const mbps = kbps / 1000;
    return `${mbps.toFixed(mbps >= 10 ? 1 : 2)} Mbps`;
  }
  return `${Math.round(kbps).toLocaleString()} kbps`;
}

function getExtension(fileName) {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > -1 ? fileName.slice(dotIndex + 1).toLowerCase() : '';
}

function getBaseName(fileName) {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > -1 ? fileName.slice(0, dotIndex) : fileName;
}

function getMimeForExtension(extension) {
  if (extension === 'mov') return 'video/quicktime';
  if (extension === 'm4v') return 'video/x-m4v';
  if (extension === 'mkv') return 'video/x-matroska';
  if (extension === 'avi') return 'video/x-msvideo';
  if (extension === 'ogv') return 'video/ogg';
  return 'video/mp4';
}

function getOutputPlan(file = state.sourceFile) {
  if (!file) return null;
  const inputExtension = getExtension(file.name);
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
    name: `${getBaseName(file.name)}-compressed.${extension}`
  };
}

function getContainerOverhead(codecFamily) {
  return codecFamily === 'ogv' ? 1.025 : 1.015;
}

function getAudioBitrateKbps() {
  return Math.max(0, Number(elements.audioBitrateSelect.value) || 0);
}

function getRequestedHeight(videoBitrateKbps) {
  if (!state.sourceHeight) return 0;
  const setting = elements.resolutionSelect.value;
  if (setting === 'keep') return state.sourceHeight;
  if (setting !== 'auto') return Math.min(state.sourceHeight, Number(setting));
  if (state.sourceHeight > 1080 && videoBitrateKbps < 4500) return 1080;
  if (state.sourceHeight > 720 && videoBitrateKbps < 2200) return 720;
  if (state.sourceHeight > 480 && videoBitrateKbps < 950) return 480;
  return state.sourceHeight;
}

function getResolutionDetails(videoBitrateKbps) {
  const height = getRequestedHeight(videoBitrateKbps);
  if (!height || !state.sourceWidth || !state.sourceHeight) {
    return { width: 0, height: 0, scaleFilter: '' };
  }
  if (height >= state.sourceHeight) {
    return { width: state.sourceWidth, height: state.sourceHeight, scaleFilter: '' };
  }
  const rawWidth = state.sourceWidth * (height / state.sourceHeight);
  const width = Math.max(2, Math.round(rawWidth / 2) * 2);
  return {
    width,
    height,
    scaleFilter: `scale=-2:${height}:force_original_aspect_ratio=decrease`
  };
}

function getCompressionPlan() {
  if (!state.sourceFile || !state.sourceDuration || !Number.isFinite(state.sourceDuration)) return null;
  const outputPlan = getOutputPlan();
  const mode = elements.compressionMode.value;
  const audioBitrateKbps = getAudioBitrateKbps();
  const overhead = getContainerOverhead(outputPlan.codecFamily);
  const passes = Number(elements.passesSelect.value) === 2 ? 2 : 1;
  let desiredBytes = 0;
  let videoBitrateKbps = 0;

  if (mode === 'smart') {
    desiredBytes = state.sourceFile.size * (Number(elements.smartSizeSlider.value) / 100);
  } else if (mode === 'target') {
    desiredBytes = Math.max(1, Number(elements.targetSizeInput.value) || 1) * 1024 * 1024;
  } else {
    videoBitrateKbps = Math.max(MIN_VIDEO_BITRATE_KBPS, Number(elements.manualVideoSlider.value) || MIN_VIDEO_BITRATE_KBPS);
  }

  if (mode !== 'manual') {
    const totalBitrateKbps = (desiredBytes * 8) / state.sourceDuration / 1000 / overhead;
    videoBitrateKbps = Math.max(MIN_VIDEO_BITRATE_KBPS, Math.floor(totalBitrateKbps - audioBitrateKbps));
  }

  const estimatedBytes = ((videoBitrateKbps + audioBitrateKbps) * 1000 * state.sourceDuration / 8) * overhead;
  const tolerance = outputPlan.codecFamily === 'ogv'
    ? (passes === 2 ? 0.18 : 0.25)
    : (passes === 2 ? 0.08 : 0.16);
  const lowerBytes = Math.max(0, estimatedBytes * (1 - tolerance));
  const upperBytes = estimatedBytes * (1 + tolerance);
  const resolution = getResolutionDetails(videoBitrateKbps);
  const changePercent = state.sourceFile.size > 0 ? ((estimatedBytes - state.sourceFile.size) / state.sourceFile.size) * 100 : 0;

  let warning = '';
  if (estimatedBytes > state.sourceFile.size * 1.01) {
    warning = 'These settings are likely to create a file larger than the original. Reduce the target size, video bitrate, audio bitrate, or resolution.';
  } else if (videoBitrateKbps <= MIN_VIDEO_BITRATE_KBPS) {
    warning = 'The requested size leaves almost no bitrate for video. Increase the target size or remove/reduce the audio track.';
  } else if (videoBitrateKbps < 350 && resolution.height > 480) {
    warning = 'The video bitrate is very low for this resolution. Auto or 480p resolution should preserve more usable detail.';
  } else if (videoBitrateKbps < 900 && resolution.height > 720) {
    warning = 'The video bitrate is low for this resolution. Auto or 720p resolution may look better at the same file size.';
  }

  return {
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
    elements.formatHelp.textContent = 'Creates an .ogv file using Theora video and Vorbis audio. Conversion saves a new copy unless the source is already .ogv.';
  } else if (format === 'mp4') {
    elements.formatHelp.textContent = 'Creates an .mp4 file using H.264 video and AAC audio. Conversion saves a new copy unless the source is already .mp4.';
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

function updateEstimate() {
  paintRange(elements.smartSizeSlider);
  paintRange(elements.manualVideoSlider);
  elements.smartSizeValue.textContent = `${elements.smartSizeSlider.value}% of original`;
  elements.manualVideoValue.textContent = `${Number(elements.manualVideoSlider.value).toLocaleString()} kbps`;
  elements.audioBitrateReadout.textContent = getAudioBitrateKbps() ? `${getAudioBitrateKbps()} kbps` : 'Removed';
  updateFormatHelp();
  updateModePanels();

  const plan = getCompressionPlan();
  state.latestPlan = plan;
  if (!plan) {
    elements.estimatedSize.textContent = state.sourceFile ? 'Reading duration…' : 'Choose a video';
    elements.estimateOriginal.textContent = state.sourceFile ? formatBytes(state.sourceFile.size) : '—';
    elements.estimateChange.textContent = '—';
    elements.estimateVideo.textContent = '—';
    elements.estimateAudio.textContent = '—';
    elements.videoBitrateReadout.textContent = '—';
    elements.resolutionReadout.textContent = '—';
    elements.estimateWarning.hidden = true;
    setBusy(state.isBusy);
    return;
  }

  elements.estimatedSize.textContent = `${formatBytes(plan.lowerBytes)}–${formatBytes(plan.upperBytes)}`;
  elements.estimateOriginal.textContent = formatBytes(state.sourceFile.size);
  const direction = plan.changePercent > 0 ? '+' : '';
  elements.estimateChange.textContent = `${direction}${Math.round(plan.changePercent)}%`;
  elements.estimateVideo.textContent = formatBitrate(plan.videoBitrateKbps);
  elements.estimateAudio.textContent = plan.audioBitrateKbps ? formatBitrate(plan.audioBitrateKbps) : 'Removed';
  elements.videoBitrateReadout.textContent = formatBitrate(plan.videoBitrateKbps);
  elements.resolutionReadout.textContent = plan.resolution.width && plan.resolution.height ? `${plan.resolution.width}×${plan.resolution.height}` : 'Keep source';
  elements.estimateWarning.textContent = plan.warning;
  elements.estimateWarning.hidden = !plan.warning;
  setBusy(state.isBusy);
}

function updateAccessNote() {
  if (!state.sourceFile) return;
  const plan = getOutputPlan();
  const sourceFormat = plan.inputExtension ? plan.inputExtension.toUpperCase() : 'source';
  const outputFormat = plan.extension.toUpperCase();
  if (state.sourceHandle && plan.canOverwrite) {
    elements.accessNote.textContent = `${outputFormat} output matches the source extension. Save Over Original will be available after compression.`;
    elements.accessNote.className = 'access-note overwrite-ready';
  } else if (state.sourceHandle) {
    elements.accessNote.textContent = `Converting ${sourceFormat} to ${outputFormat} changes the file format, so this must be saved as a new copy.`;
    elements.accessNote.className = 'access-note copy-only';
  } else {
    elements.accessNote.textContent = `Dropped or standard-picked file: the compressed ${outputFormat} will be saved as a new copy.`;
    elements.accessNote.className = 'access-note copy-only';
  }
}

function setProgress(title, percentage, note = '') {
  const safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0));
  elements.progressCard.classList.add('visible');
  elements.progressTitle.textContent = title;
  elements.progressValue.textContent = `${Math.round(safePercentage)}%`;
  elements.progressFill.style.width = `${safePercentage}%`;
  if (note) elements.progressNote.textContent = note;
}

function hideProgress() {
  elements.progressCard.classList.remove('visible');
  elements.progressFill.style.width = '0%';
}

function setEngineState(text) {
  elements.engineState.textContent = text;
}

function setBusy(nextBusy) {
  state.isBusy = Boolean(nextBusy);
  const settingsControls = [
    elements.outputFormat,
    elements.compressionMode,
    elements.smartSizeSlider,
    elements.targetSizeInput,
    elements.manualVideoSlider,
    elements.resolutionSelect,
    elements.passesSelect,
    elements.audioBitrateSelect,
    elements.audioChannelsSelect
  ];
  elements.openVideoButton.disabled = state.isBusy;
  elements.clearButton.disabled = state.isBusy || !state.sourceFile;
  settingsControls.forEach((control) => { control.disabled = state.isBusy; });
  elements.compressButton.disabled = state.isBusy || !state.sourceFile || !state.sourceDuration || !state.latestPlan;
  elements.showSaveActionsButton.disabled = state.isBusy || !state.outputBlob;
  elements.overwriteButton.disabled = state.isBusy || !state.outputBlob || !state.sourceHandle || !state.outputCanOverwriteSource;
  elements.saveCopyButton.disabled = state.isBusy || !state.outputBlob;
}

function revokeSourceObjectUrl() {
  if (state.sourceObjectUrl) {
    URL.revokeObjectURL(state.sourceObjectUrl);
    state.sourceObjectUrl = null;
  }
}

function revokeOutputObjectUrl() {
  if (state.outputObjectUrl) {
    URL.revokeObjectURL(state.outputObjectUrl);
    state.outputObjectUrl = null;
  }
}

function resetResult() {
  revokeOutputObjectUrl();
  state.outputBlob = null;
  state.outputFileName = '';
  state.outputCanOverwriteSource = false;
  elements.resultCard.classList.remove('visible');
  elements.resultPreview.hidden = false;
  elements.resultPreview.onerror = null;
  elements.resultPreview.removeAttribute('src');
  elements.resultPreview.load();
  elements.resultPreviewNote.hidden = true;
  elements.saveActions.classList.remove('visible');
  setBusy(state.isBusy);
}

function resetWorkspace() {
  if (state.isBusy) return;
  revokeSourceObjectUrl();
  resetResult();
  state.sourceFile = null;
  state.sourceHandle = null;
  state.sourceDuration = 0;
  state.sourceWidth = 0;
  state.sourceHeight = 0;
  state.latestPlan = null;
  elements.sourceCard.hidden = true;
  elements.sourcePreview.onerror = null;
  elements.sourcePreview.removeAttribute('src');
  elements.sourcePreview.load();
  elements.sourcePlaceholder.hidden = false;
  elements.fileInput.value = '';
  hideProgress();
  updateEstimate();
  setEngineState(state.ffmpegLoaded ? 'ENGINE READY' : 'ENGINE IDLE');
  setStatus('Choose a video to start.');
  setBusy(false);
}

function loadSourceFile(file, handle = null) {
  const extension = getExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.has(extension) && !file.type.startsWith('video/')) {
    setStatus('That file does not look like a supported video.', 'error');
    return;
  }

  revokeSourceObjectUrl();
  resetResult();
  state.sourceFile = file;
  state.sourceHandle = handle;
  state.sourceDuration = 0;
  state.sourceWidth = 0;
  state.sourceHeight = 0;
  state.sourceObjectUrl = URL.createObjectURL(file);

  elements.sourcePreview.onerror = () => {
    elements.sourceMeta.textContent = `${formatBytes(file.size)} · browser metadata unavailable`;
    elements.sourcePlaceholder.hidden = false;
    updateEstimate();
    setStatus('This browser could not read the video duration, so size-targeted compression is unavailable for this source.', 'error');
  };

  elements.sourcePreview.onloadedmetadata = () => {
    state.sourceDuration = Number.isFinite(elements.sourcePreview.duration) ? elements.sourcePreview.duration : 0;
    state.sourceWidth = elements.sourcePreview.videoWidth || 0;
    state.sourceHeight = elements.sourcePreview.videoHeight || 0;
    const durationText = state.sourceDuration ? `${Math.round(state.sourceDuration)} sec` : 'duration unavailable';
    const dimensionsText = state.sourceWidth && state.sourceHeight ? `${state.sourceWidth}×${state.sourceHeight}` : 'dimensions unavailable';
    elements.sourceMeta.textContent = `${formatBytes(file.size)} · ${dimensionsText} · ${durationText}`;
    if (state.sourceDuration) {
      const suggestedMb = Math.max(1, Math.round((file.size * 0.7) / (1024 * 1024)));
      elements.targetSizeInput.value = String(suggestedMb);
      updateEstimate();
      setStatus('Video ready. Choose the size, video, and audio settings, then press Compress Video.');
    }
  };

  elements.sourcePreview.src = state.sourceObjectUrl;
  elements.sourcePlaceholder.hidden = true;
  elements.sourceName.textContent = file.name;
  elements.sourceMeta.textContent = `${formatBytes(file.size)} · reading metadata…`;
  elements.sourceCard.hidden = false;
  updateAccessNote();
  updateEstimate();
  hideProgress();
  setEngineState(state.ffmpegLoaded ? 'ENGINE READY' : 'ENGINE IDLE');
  setStatus('Reading video duration and dimensions…');
  setBusy(false);
}
