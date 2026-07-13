function bindHeaderCollapse() {
elements.topStickyPanel.addEventListener('mouseenter', () => {
panelHovered = true;
expandHeader();
window.clearInterval(countdownTimer);
});
elements.topStickyPanel.addEventListener('mouseleave', () => {
panelHovered = false;
resetCountdown();
startCountdown();
});
elements.topStickyPanel.addEventListener('click', () => {
if (elements.topStickyPanel.classList.contains('minimized')) {
expandHeader();
}
});
elements.countdownCircle.addEventListener('dblclick', (event) => {
event.preventDefault();
event.stopPropagation();
panelLocked = !panelLocked;
updateCountdownDisplay();
if (panelLocked) {
window.clearInterval(countdownTimer);
expandHeader();
} else if (!panelHovered) {
startCountdown();
}
});
startCountdown();
}
function bindEvents() {
elements.openVideoButton.addEventListener('click', chooseVideoWithHandle);
elements.clearButton.addEventListener('click', resetWorkspace);
elements.compressButton.addEventListener('click', compressVideo);
elements.showSaveActionsButton.addEventListener('click', () => {
elements.saveActions.classList.toggle('visible');
});
elements.overwriteButton.addEventListener('click', saveOverOriginal);
elements.saveCopyButton.addEventListener('click', saveNewCopy);
elements.qualitySlider.addEventListener('input', paintQualityControl);
elements.outputFormat.addEventListener('change', handleOutputFormatChange);
elements.fileInput.addEventListener('change', () => {
const [file] = elements.fileInput.files;
if (file) loadSourceFile(file, null);
});
elements.dropZone.addEventListener('click', () => elements.fileInput.click());
elements.dropZone.addEventListener('keydown', (event) => {
if (event.key === 'Enter' || event.key === ' ') {
event.preventDefault();
elements.fileInput.click();
}
});
['dragenter', 'dragover'].forEach((eventName) => {
elements.dropZone.addEventListener(eventName, (event) => {
event.preventDefault();
event.stopPropagation();
elements.dropZone.classList.add('drag-active');
});
});
['dragleave', 'drop'].forEach((eventName) => {
elements.dropZone.addEventListener(eventName, (event) => {
event.preventDefault();
event.stopPropagation();
elements.dropZone.classList.remove('drag-active');
});
});
elements.dropZone.addEventListener('drop', (event) => {
const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
if (file) loadSourceFile(file, null);
});
[elements.openVideoButton, elements.compressButton, elements.overwriteButton, elements.saveCopyButton].forEach((button) => {
button.addEventListener('mouseenter', () => setHubStatus(button.textContent.trim()));
button.addEventListener('mouseleave', clearHubStatus);
});
window.addEventListener('beforeunload', () => {
revokeSourceObjectUrl();
revokeOutputObjectUrl();
});
}
paintQualityControl();
bindHeaderCollapse();
bindEvents();
setBusy(false);
setStatus('Choose a video to start.');
console.info(`Organon VidCompressor v${VERSION} ready.`);
