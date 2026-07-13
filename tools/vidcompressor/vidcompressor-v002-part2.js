function updateFormatHelp() {
const format = elements.outputFormat.value;
if (format === 'ogv') {
elements.formatHelp.textContent = 'Creates an .ogv file using Theora video and Vorbis audio. Conversion always saves a new copy unless the source is already .ogv.';
} else if (format === 'mp4') {
elements.formatHelp.textContent = 'Creates an .mp4 file using H.264 video and AAC audio. Conversion saves a new copy unless the source is already .mp4.';
} else {
elements.formatHelp.textContent = 'Keeps MP4, M4V, MOV, MKV, AVI, and OGV containers. WebM is converted to MP4.';
}
}
function paintQualityControl() {
const value = Number(elements.qualitySlider.value);
elements.qualitySlider.style.background = `linear-gradient(to right, var(--brand-red) 0%, var(--brand-red) ${value}%, var(--slider-track) ${value}%, var(--slider-track) 100%)`;
const settings = getQualitySettings(value);
elements.qualityValue.textContent = `${value} · ${settings.label}`;
elements.compressionSummary.textContent = settings.description;
updateFormatHelp();
}
function setProgress(title, percentage) {
const safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0));
elements.progressCard.classList.add('visible');
elements.progressTitle.textContent = title;
elements.progressValue.textContent = `${Math.round(safePercentage)}%`;
elements.progressFill.style.width = `${safePercentage}%`;
}
function hideProgress() {
elements.progressCard.classList.remove('visible');
elements.progressFill.style.width = '0%';
}
function setEngineState(text) {
elements.engineState.textContent = text;
}
function setBusy(nextBusy) {
isBusy = nextBusy;
elements.openVideoButton.disabled = nextBusy;
elements.clearButton.disabled = nextBusy || !sourceFile;
elements.outputFormat.disabled = nextBusy;
elements.qualitySlider.disabled = nextBusy;
elements.compressButton.disabled = nextBusy || !sourceFile;
elements.showSaveActionsButton.disabled = nextBusy || !outputBlob;
elements.overwriteButton.disabled = nextBusy || !outputBlob || !sourceHandle || !outputCanOverwriteSource;
elements.saveCopyButton.disabled = nextBusy || !outputBlob;
}
function revokeSourceObjectUrl() {
if (sourceObjectUrl) {
URL.revokeObjectURL(sourceObjectUrl);
sourceObjectUrl = null;
}
}
function revokeOutputObjectUrl() {
if (outputObjectUrl) {
URL.revokeObjectURL(outputObjectUrl);
outputObjectUrl = null;
}
}
function resetResult() {
revokeOutputObjectUrl();
outputBlob = null;
outputFileName = '';
outputCanOverwriteSource = false;
elements.resultCard.classList.remove('visible');
elements.resultPreview.hidden = false;
elements.resultPreview.onerror = null;
elements.resultPreview.removeAttribute('src');
elements.resultPreview.load();
elements.resultPreviewNote.hidden = true;
elements.saveActions.classList.remove('visible');
}
function resetWorkspace() {
if (isBusy) return;
revokeSourceObjectUrl();
resetResult();
sourceFile = null;
sourceHandle = null;
elements.sourceCard.hidden = true;
elements.sourcePreview.onerror = null;
elements.sourcePreview.removeAttribute('src');
elements.sourcePreview.load();
elements.sourcePlaceholder.hidden = false;
elements.fileInput.value = '';
hideProgress();
paintQualityControl();
setEngineState(ffmpegLoaded ? 'ENGINE READY' : 'ENGINE IDLE');
setStatus('Choose a video to start.');
setBusy(false);
}
function updateAccessNote() {
if (!sourceFile) return;
const plan = getOutputPlan(sourceFile);
const sourceFormat = plan.inputExtension ? plan.inputExtension.toUpperCase() : 'source';
const outputFormat = plan.extension.toUpperCase();
if (sourceHandle && plan.canOverwrite) {
elements.accessNote.textContent = `${outputFormat} output matches the source extension. Save Over Original will be available after compression.`;
elements.accessNote.className = 'access-note overwrite-ready';
} else if (sourceHandle && !plan.canOverwrite) {
elements.accessNote.textContent = `Converting ${sourceFormat} to ${outputFormat} changes the file format, so this must be saved as a new copy.`;
elements.accessNote.className = 'access-note copy-only';
} else {
elements.accessNote.textContent = `Dropped or standard-picked file: the compressed ${outputFormat} will be saved as a new copy.`;
elements.accessNote.className = 'access-note copy-only';
}
}
function loadSourceFile(file, handle = null) {
const extension = getExtension(file.name);
if (!SUPPORTED_EXTENSIONS.has(extension) && !file.type.startsWith('video/')) {
setStatus('That file does not look like a supported video.', 'error');
return;
}
revokeSourceObjectUrl();
resetResult();
sourceFile = file;
sourceHandle = handle;
sourceObjectUrl = URL.createObjectURL(file);
elements.sourcePreview.onerror = () => {
elements.sourceMeta.textContent = `${formatBytes(file.size)} · browser preview unavailable`;
elements.sourcePlaceholder.hidden = false;
};
elements.sourcePreview.src = sourceObjectUrl;
elements.sourcePreview.onloadedmetadata = () => {
const duration = Number.isFinite(elements.sourcePreview.duration) ? `${Math.round(elements.sourcePreview.duration)} sec` : 'duration unavailable';
const dimensions = elements.sourcePreview.videoWidth && elements.sourcePreview.videoHeight ? `${elements.sourcePreview.videoWidth}×${elements.sourcePreview.videoHeight}` : 'dimensions unavailable';
elements.sourceMeta.textContent = `${formatBytes(file.size)} · ${dimensions} · ${duration}`;
};
elements.sourcePlaceholder.hidden = true;
elements.sourceName.textContent = file.name;
elements.sourceMeta.textContent = `${formatBytes(file.size)} · reading metadata…`;
elements.sourceCard.hidden = false;
paintQualityControl();
updateAccessNote();
hideProgress();
setEngineState(ffmpegLoaded ? 'ENGINE READY' : 'ENGINE IDLE');
setStatus('Video ready. Choose the output format and compression level, then press Compress Video.');
setBusy(false);
}
function loadScript(sourceUrl) {
return new Promise((resolve, reject) => {
if (window.FFmpegWASM && window.FFmpegWASM.FFmpeg) {
resolve();
return;
}
const script = document.createElement('script');
script.src = sourceUrl;
script.async = true;
script.onload = () => resolve();
script.onerror = () => reject(new Error('The local FFmpeg helper could not be loaded.'));
document.head.appendChild(script);
});
}
async function ensureFfmpeg() {
if (ffmpegLoaded && ffmpeg) return;
setEngineState('LOADING ENGINE');
setProgress('Loading local FFmpeg engine…', 7);
const ffmpegScriptUrl = new URL('./vendor/ffmpeg/ffmpeg.js', window.location.href).href;
const coreUrl = new URL('./vendor/ffmpeg-core/ffmpeg-core.js', window.location.href).href;
const wasmUrl = new URL('./vendor/ffmpeg-core/ffmpeg-core.wasm', window.location.href).href;
await loadScript(ffmpegScriptUrl);
if (!window.FFmpegWASM || !window.FFmpegWASM.FFmpeg) {
throw new Error('The FFmpeg engine was unavailable after loading.');
}
ffmpeg = new window.FFmpegWASM.FFmpeg();
ffmpeg.on('progress', ({ progress }) => {
const progressPercent = Math.round(Math.max(0, Math.min(1, Number(progress) || 0)) * 88) + 10;
setProgress('Compressing video…', progressPercent);
});
await ffmpeg.load({ coreURL: coreUrl, wasmURL: wasmUrl });
ffmpegLoaded = true;
setEngineState('ENGINE READY');
setProgress('Engine ready.', 10);
}
function getFfmpegNames(file) {
const inputExtension = getExtension(file.name) || 'mp4';
const safeInputName = `input.${inputExtension}`;
const outputPlan = getOutputPlan(file);
const safeOutputName = `output.${outputPlan.extension}`;
return { safeInputName, safeOutputName, outputPlan };
}
function buildFfmpegCommand(inputName, outputName, outputPlan, settings) {
const command = [
'-i', inputName,
'-map', '0:v:0',
'-map', '0:a?',
'-map_metadata', '0'
];
if (outputPlan.codecFamily === 'ogv') {
command.push(
'-c:v', 'libtheora',
'-q:v', String(settings.theoraQuality),
'-pix_fmt', 'yuv420p',
'-c:a', 'libvorbis',
'-q:a', String(settings.vorbisQuality),
'-f', 'ogg'
);
} else {
command.push(
'-c:v', 'libx264',
'-preset', 'veryfast',
'-crf', String(settings.crf),
'-pix_fmt', 'yuv420p',
'-c:a', 'aac',
'-b:a', settings.audioBitrate
);
if (['mp4', 'm4v', 'mov'].includes(outputPlan.extension)) {
command.push('-movflags', '+faststart');
}
}
command.push(outputName);
return command;
}
function browserCanPreviewOgv() {
const testVideo = document.createElement('video');
return Boolean(testVideo.canPlayType('video/ogg; codecs="theora, vorbis"'));
}
function showResultPreview(outputPlan) {
elements.resultPreview.hidden = false;
elements.resultPreviewNote.hidden = true;
elements.resultPreview.onerror = null;
if (outputPlan.extension === 'ogv' && !browserCanPreviewOgv()) {
elements.resultPreview.hidden = true;
elements.resultPreview.removeAttribute('src');
elements.resultPreviewNote.hidden = false;
return;
}
elements.resultPreview.onerror = () => {
if (outputPlan.extension === 'ogv') {
elements.resultPreview.hidden = true;
elements.resultPreview.removeAttribute('src');
elements.resultPreviewNote.hidden = false;
}
};
elements.resultPreview.src = outputObjectUrl;
}
