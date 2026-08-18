'use strict';

const VERSION = '0.04';
const SUPPORTED_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'mkv', 'avi', 'webm', 'ogv', 'ogg']);
const SAME_CONTAINER_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'mkv', 'avi', 'ogv']);
const OGV_INPUT_EXTENSIONS = new Set(['ogv', 'ogg']);
const MIN_VIDEO_BITRATE_KBPS = 120;

const elements = {
  topStickyPanel: document.getElementById('top-sticky-panel'),
  countdownCircle: document.getElementById('countdown-circle'),
  engineState: document.getElementById('engine-state'),
  openVideoButton: document.getElementById('open-video-btn'),
  bulkModeButton: document.getElementById('bulk-mode-btn'),
  clearButton: document.getElementById('clear-btn'),
  dropZone: document.getElementById('drop-zone'),
  dropZoneTitle: document.getElementById('drop-zone-title'),
  dropZoneCopy: document.getElementById('drop-zone-copy'),
  importCopy: document.getElementById('import-copy'),
  fileInput: document.getElementById('file-input'),
  sourceCard: document.getElementById('source-card'),
  sourceCardTitle: document.getElementById('source-card-title'),
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
  estimateCopy: document.getElementById('estimate-copy'),
  estimatedSize: document.getElementById('estimated-size'),
  estimateOriginal: document.getElementById('estimate-original'),
  estimateChange: document.getElementById('estimate-change'),
  estimateVideo: document.getElementById('estimate-video'),
  estimateAudio: document.getElementById('estimate-audio'),
  estimateWarning: document.getElementById('estimate-warning'),
  batchCard: document.getElementById('batch-card'),
  batchQueue: document.getElementById('batch-queue'),
  batchSummary: document.getElementById('batch-summary'),
  progressCard: document.getElementById('progress-card'),
  progressTitle: document.getElementById('progress-title'),
  progressValue: document.getElementById('progress-value'),
  progressFill: document.getElementById('progress-fill'),
  progressNote: document.getElementById('progress-note'),
  resultCard: document.getElementById('result-card'),
  resultTitle: document.getElementById('result-title'),
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
  mode: 'single',
  queue: [],
  selectedQueueId: null,
  sourceObjectUrl: null,
  outputBlob: null,
  outputObjectUrl: null,
  outputFileName: '',
  outputCanOverwriteSource: false,
  outputFolderHandle: null,
  latestPlan: null,
  ffmpeg: null,
  ffmpegLoaded: false,
  isBusy: false,
  progressStage: 'encode',
  countdownValue: 5,
  countdownTimer: null,
  panelLocked: false,
  panelHovered: false,
  lastCompletedItemId: null
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
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatKbps(kbps) {
  if (!Number.isFinite(kbps) || kbps <= 0) return 'Removed';
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

function getSelectedItem() {
  return state.queue.find((item) => item.id === state.selectedQueueId) || null;
}

function getPrimaryItem() {
  return getSelectedItem() || state.queue[0] || null;
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

function setEngineState(text) {
  elements.engineState.textContent = text;
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

function updateCountdownDisplay() {
  elements.countdownCircle.textContent = state.panelLocked ? '🔒' : String(state.countdownValue);
}

function resetCountdown() {
  window.clearInterval(state.countdownTimer);
  state.countdownValue = 5;
  updateCountdownDisplay();
}

function startCountdown() {
  if (state.panelLocked || state.panelHovered) return;
  window.clearInterval(state.countdownTimer);
  state.countdownTimer = window.setInterval(() => {
    state.countdownValue -= 1;
    updateCountdownDisplay();
    if (state.countdownValue <= 0) {
      window.clearInterval(state.countdownTimer);
      elements.topStickyPanel.classList.add('minimized');
    }
  }, 1000);
}

function expandHeader() {
  elements.topStickyPanel.classList.remove('minimized');
  resetCountdown();
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
}

function resetEstimateView() {
  elements.estimatedSize.textContent = state.mode === 'bulk' ? 'Choose a file' : 'Choose a video';
  elements.estimateOriginal.textContent = '—';
  elements.estimateChange.textContent = '—';
  elements.estimateVideo.textContent = '—';
  elements.estimateAudio.textContent = '—';
  elements.videoBitrateReadout.textContent = '—';
  elements.resolutionReadout.textContent = '—';
  elements.estimateWarning.hidden = true;
}

function resetWorkspace() {
  if (state.isBusy) return;
  revokeSourceObjectUrl();
  resetResult();
  state.queue = [];
  state.selectedQueueId = null;
  state.outputFolderHandle = null;
  state.latestPlan = null;
  state.lastCompletedItemId = null;
  elements.sourceCard.hidden = true;
  elements.sourcePreview.onerror = null;
  elements.sourcePreview.removeAttribute('src');
  elements.sourcePreview.load();
  elements.sourcePlaceholder.hidden = false;
  elements.batchCard.hidden = true;
  elements.batchQueue.innerHTML = '';
  elements.batchSummary.textContent = '0 files';
  elements.fileInput.value = '';
  hideProgress();
  resetEstimateView();
  setEngineState(state.ffmpegLoaded ? 'ENGINE READY' : 'ENGINE IDLE');
  syncModeUi();
  setStatus(state.mode === 'bulk' ? 'Add videos to the queue.' : 'Choose a video to start.');
  setBusy(false);
}

function setBusy(nextBusy) {
  state.isBusy = nextBusy;
  const hasQueue = state.queue.length > 0;
  const hasSingle = state.queue.length === 1 && state.mode === 'single';
  const hasBulk = state.mode === 'bulk' && hasQueue;
  const bulkReady = Boolean(state.outputFolderHandle && hasBulk);
  elements.openVideoButton.disabled = nextBusy;
  elements.bulkModeButton.disabled = nextBusy;
  elements.clearButton.disabled = nextBusy || !hasQueue;
  elements.outputFormat.disabled = nextBusy;
  elements.compressionMode.disabled = nextBusy;
  elements.smartSizeSlider.disabled = nextBusy;
  elements.targetSizeInput.disabled = nextBusy;
  elements.manualVideoSlider.disabled = nextBusy;
  elements.resolutionSelect.disabled = nextBusy;
  elements.passesSelect.disabled = nextBusy;
  elements.audioBitrateSelect.disabled = nextBusy;
  elements.audioChannelsSelect.disabled = nextBusy;
  elements.compressButton.disabled = nextBusy || (!hasSingle && !bulkReady) || (state.mode === 'bulk' && !bulkReady);
  elements.showSaveActionsButton.disabled = nextBusy || !hasQueue;
  elements.overwriteButton.disabled = nextBusy || !state.outputBlob || !hasSingle || !state.outputCanOverwriteSource || state.mode !== 'single';
  elements.saveCopyButton.disabled = nextBusy || !state.outputBlob || state.mode !== 'single';
}

function syncModeUi() {
  const isBulk = state.mode === 'bulk';
  elements.bulkModeButton.classList.toggle('active', isBulk);
  elements.bulkModeButton.textContent = isBulk ? 'Single Mode' : 'Bulk Convert';
  elements.openVideoButton.textContent = isBulk ? 'Add Videos' : 'Open Video';
  elements.compressButton.textContent = isBulk ? 'Convert Queue' : 'Compress Video';
  elements.importCopy.textContent = isBulk
    ? 'Add multiple videos. The current settings will be applied to every file in the batch.'
    : 'Open a video to retain direct overwrite permission. Dropped videos can still be compressed and saved as a new copy.';
  elements.dropZoneTitle.textContent = isBulk ? 'Drop one or more videos here' : 'Drop a video here';
  elements.dropZoneCopy.innerHTML = isBulk
    ? 'MP4, M4V, MOV, MKV, AVI, WebM, OGV, or OGG.<br>Queue multiple files. Processing stays in this browser.'
    : 'MP4, M4V, MOV, MKV, AVI, WebM, OGV, or OGG.<br>Nothing is uploaded; processing stays in this browser.';
  elements.fileInput.multiple = isBulk;
  elements.sourceCardTitle.textContent = isBulk ? 'Selected queue item' : 'Selected file';
  elements.estimateCopy.textContent = isBulk
    ? 'Updates from the currently selected queue item plus the shared compression settings.'
    : 'Updates from the selected duration, bitrates, format, and encoding mode.';
  elements.batchCard.hidden = !isBulk || state.queue.length === 0;
  elements.accessNote.className = 'access-note copy-only';
  elements.saveActions.classList.remove('visible');
  if (isBulk) {
    elements.showSaveActionsButton.textContent = state.outputFolderHandle ? 'Folder Ready' : 'Save Options';
  } else {
    elements.showSaveActionsButton.textContent = 'Save Options';
  }
  updateAccessNote();
  updateQueueUi();
}
