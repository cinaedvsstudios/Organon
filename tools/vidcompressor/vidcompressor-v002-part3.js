async function compressVideo() {
if (!sourceFile || isBusy) return;
setBusy(true);
resetResult();
setEngineState(ffmpegLoaded ? 'ENGINE READY' : 'LOADING ENGINE');
setStatus('Preparing the video compressor…');
let inputName = '';
let outputName = '';
try {
await ensureFfmpeg();
const names = getFfmpegNames(sourceFile);
const settings = getQualitySettings(elements.qualitySlider.value, names.outputPlan.codecFamily);
inputName = names.safeInputName;
outputName = names.safeOutputName;
setProgress('Loading video into browser memory…', 12);
const sourceData = new Uint8Array(await sourceFile.arrayBuffer());
await ffmpeg.writeFile(inputName, sourceData);
const command = buildFfmpegCommand(inputName, outputName, names.outputPlan, settings);
setProgress('Compressing video…', 14);
setStatus(`Compressing to ${names.outputPlan.extension.toUpperCase()} with ${settings.label.toLowerCase()} settings…`);
await ffmpeg.exec(command);
setProgress('Reading compressed video…', 95);
const outputData = await ffmpeg.readFile(outputName);
outputBlob = new Blob([outputData], { type: names.outputPlan.mime });
outputFileName = names.outputPlan.name;
outputCanOverwriteSource = Boolean(sourceHandle && names.outputPlan.canOverwrite);
outputObjectUrl = URL.createObjectURL(outputBlob);
elements.resultFileName.textContent = outputFileName;
elements.resultOriginalSize.textContent = formatBytes(sourceFile.size);
elements.resultOutputSize.textContent = formatBytes(outputBlob.size);
const difference = outputBlob.size - sourceFile.size;
const differenceSign = difference > 0 ? '+' : difference < 0 ? '-' : '';
const percentage = sourceFile.size > 0 ? Math.round((difference / sourceFile.size) * 100) : 0;
const percentageSign = percentage > 0 ? '+' : '';
elements.resultChange.textContent = `${differenceSign}${formatBytes(Math.abs(difference))} · ${percentageSign}${percentage}%`;
elements.resultFormat.textContent = names.outputPlan.extension.toUpperCase();
showResultPreview(names.outputPlan);
elements.resultCard.classList.add('visible');
elements.saveActions.classList.add('visible');
setProgress('Compression complete.', 100);
hideProgress();
const saveInstruction = outputCanOverwriteSource ? 'Choose Save Over Original or Save New Copy.' : 'Choose Save New Copy.';
setStatus(`Compressed ${names.outputPlan.extension.toUpperCase()} video is ready. ${saveInstruction}`, 'success');
setEngineState('ENGINE READY');
try {
await ffmpeg.deleteFile(inputName);
await ffmpeg.deleteFile(outputName);
} catch (_) {
}
} catch (error) {
console.error(error);
hideProgress();
setEngineState(ffmpegLoaded ? 'ENGINE READY' : 'ENGINE ERROR');
const message = error && error.message ? error.message : 'Compression failed.';
const codecHint = getActiveCodecFamily() === 'ogv' ? ' The bundled engine may not include the OGV codecs if its vendor files were replaced.' : '';
setStatus(`${message}${codecHint} Try a shorter video or a lower-resolution source if browser memory is tight.`, 'error');
try {
if (ffmpeg && inputName) await ffmpeg.deleteFile(inputName);
if (ffmpeg && outputName) await ffmpeg.deleteFile(outputName);
} catch (_) {
}
} finally {
setBusy(false);
}
}
async function writeBlobToHandle(handle) {
const writable = await handle.createWritable();
await writable.write(outputBlob);
await writable.close();
}
function triggerDownload() {
const link = document.createElement('a');
link.href = outputObjectUrl;
link.download = outputFileName;
document.body.appendChild(link);
link.click();
link.remove();
}
async function saveOverOriginal() {
if (!outputBlob || !sourceHandle || !outputCanOverwriteSource || isBusy) return;
const proceed = window.confirm(`Replace “${sourceFile.name}” with the compressed version?\n\nThe original file will be overwritten.`);
if (!proceed) return;
try {
setBusy(true);
setStatus('Requesting permission to overwrite the original…');
const permission = await sourceHandle.requestPermission({ mode: 'readwrite' });
if (permission !== 'granted') {
throw new Error('Permission to overwrite the original file was not granted.');
}
await writeBlobToHandle(sourceHandle);
setStatus(`Saved compressed video over “${sourceFile.name}”.`, 'success');
} catch (error) {
console.error(error);
const message = error && error.message ? error.message : 'Could not overwrite the original file.';
setStatus(`${message} Use Save New Copy instead.`, 'error');
} finally {
setBusy(false);
}
}
async function saveNewCopy() {
if (!outputBlob || isBusy) return;
try {
setBusy(true);
setStatus('Saving a new compressed copy…');
if (window.showSaveFilePicker) {
const extension = `.${getExtension(outputFileName) || 'mp4'}`;
const handle = await window.showSaveFilePicker({
suggestedName: outputFileName,
types: [{
description: 'Compressed video',
accept: { [outputBlob.type || 'video/mp4']: [extension] }
}]
});
await writeBlobToHandle(handle);
setStatus(`Saved “${outputFileName}”.`, 'success');
} else {
triggerDownload();
setStatus(`Your browser downloaded “${outputFileName}”.`, 'success');
}
} catch (error) {
if (error && error.name === 'AbortError') {
setStatus('Save cancelled.');
} else {
console.error(error);
const message = error && error.message ? error.message : 'Could not save the compressed copy.';
setStatus(message, 'error');
}
} finally {
setBusy(false);
}
}
async function chooseVideoWithHandle() {
if (isBusy) return;
try {
if (!window.showOpenFilePicker) {
elements.fileInput.click();
return;
}
const [handle] = await window.showOpenFilePicker({
multiple: false,
types: [{
description: 'Video files',
accept: {
'video/*': ['.mp4', '.m4v', '.mov', '.mkv', '.avi', '.webm', '.ogv', '.ogg']
}
}]
});
const file = await handle.getFile();
loadSourceFile(file, handle);
} catch (error) {
if (error && error.name !== 'AbortError') {
console.error(error);
elements.fileInput.click();
setStatus('The browser file picker could not provide overwrite access. A new copy can still be saved after compression.');
}
}
}
function handleOutputFormatChange() {
if (isBusy) return;
resetResult();
paintQualityControl();
updateAccessNote();
if (sourceFile) {
const plan = getOutputPlan(sourceFile);
setStatus(`Output set to ${plan.extension.toUpperCase()}. Press Compress Video to create a new result.`);
}
setBusy(false);
}
