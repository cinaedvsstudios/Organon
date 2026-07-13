'use strict';
const VERSION = '0.02';
const SUPPORTED_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'mkv', 'avi', 'webm', 'ogv', 'ogg']);
const SAME_CONTAINER_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'mkv', 'avi', 'ogv']);
const OGV_INPUT_EXTENSIONS = new Set(['ogv', 'ogg']);
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
qualitySlider: document.getElementById('quality-slider'),
qualityValue: document.getElementById('quality-value'),
compressionSummary: document.getElementById('compression-summary'),
progressCard: document.getElementById('progress-card'),
progressTitle: document.getElementById('progress-title'),
progressValue: document.getElementById('progress-value'),
progressFill: document.getElementById('progress-fill'),
resultCard: document.getElementById('result-card'),
resultFileName: document.getElementById('result-file-name'),
resultOriginalSize: document.getElementById('result-original-size'),
resultOutputSize: document.getElementById('result-output-size'),
resultChange: document.getElementById('result-change'),
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
let sourceFile = null;
let sourceHandle = null;
let sourceObjectUrl = null;
let outputBlob = null;
let outputObjectUrl = null;
let outputFileName = '';
let outputCanOverwriteSource = false;
let ffmpeg = null;
let ffmpegLoaded = false;
let isBusy = false;
let countdownValue = 5;
let countdownTimer = null;
let panelLocked = false;
let panelHovered = false;
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
function updateCountdownDisplay() {
elements.countdownCircle.textContent = panelLocked ? '🔒' : String(countdownValue);
}
function resetCountdown() {
window.clearInterval(countdownTimer);
countdownValue = 5;
updateCountdownDisplay();
}
function startCountdown() {
if (panelLocked || panelHovered) return;
window.clearInterval(countdownTimer);
countdownTimer = window.setInterval(() => {
countdownValue -= 1;
updateCountdownDisplay();
if (countdownValue <= 0) {
window.clearInterval(countdownTimer);
elements.topStickyPanel.classList.add('minimized');
}
}, 1000);
}
function expandHeader() {
elements.topStickyPanel.classList.remove('minimized');
resetCountdown();
}
function formatBytes(bytes) {
if (!Number.isFinite(bytes) || bytes < 0) return '—';
if (bytes < 1024) return `${bytes} B`;
const units = ['KB', 'MB', 'GB'];
let value = bytes / 1024;
let unitIndex = 0;
while (value >= 1024 && unitIndex < units.length - 1) {
value /= 1024;
unitIndex += 1;
}
return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
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
function getOutputPlan(file) {
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
function getActiveCodecFamily() {
if (elements.outputFormat.value === 'ogv') return 'ogv';
if (elements.outputFormat.value === 'auto' && sourceFile && OGV_INPUT_EXTENSIONS.has(getExtension(sourceFile.name))) return 'ogv';
return 'h264';
}
function getQualityLabel(quality) {
if (quality <= 20) return 'SMALLEST FILE';
if (quality <= 45) return 'SMALL FILE';
if (quality <= 69) return 'BALANCED';
if (quality <= 84) return 'GOOD QUALITY';
return 'HIGH QUALITY';
}
function getQualitySettings(value, codecFamily = getActiveCodecFamily()) {
const quality = Number(value);
const label = getQualityLabel(quality);
if (codecFamily === 'ogv') {
const theoraQuality = Math.max(0, Math.min(10, Math.round(quality / 10)));
const vorbisQuality = Math.max(0, Math.min(8, Math.round(quality / 12.5)));
let description = 'Balanced OGV compression with Theora video and Vorbis audio. The original dimensions are kept.';
if (quality <= 20) {
description = 'Strong Theora/Vorbis compression for the smallest OGV file. Fine detail and fast movement may soften.';
} else if (quality <= 45) {
description = 'Smaller OGV output with moderate Theora compression and reduced audio quality.';
} else if (quality <= 69) {
description = 'Balanced OGV compression with Theora video and Vorbis audio. The original dimensions are kept.';
} else if (quality <= 84) {
description = 'Gentler Theora compression that retains more detail while still reducing the OGV file size.';
} else {
description = 'High-quality Theora and Vorbis encoding. The OGV output may be substantially larger.';
}
return { quality, label, description, codecFamily, theoraQuality, vorbisQuality };
}
const crf = Math.max(18, Math.min(35, Math.round(35 - (quality * 0.17))));
let description = 'Balanced H.264 compression with AAC audio. The original dimensions are kept.';
let audioBitrate = '160k';
if (quality <= 20) {
description = 'Strong H.264 compression for a much smaller file. Fine texture and fast movement may soften.';
audioBitrate = '96k';
} else if (quality <= 45) {
description = 'Noticeably smaller file with moderate visual compression.';
audioBitrate = '128k';
} else if (quality <= 69) {
description = 'Balanced H.264 compression with AAC audio. The original dimensions are kept.';
audioBitrate = '160k';
} else if (quality <= 84) {
description = 'Gentler compression to retain more detail while still reducing the file size.';
audioBitrate = '160k';
} else {
description = 'Light compression for maximum detail retention. The output may not shrink much if the original is already compressed.';
audioBitrate = '192k';
}
return { quality, label, description, codecFamily, crf, audioBitrate };
}
