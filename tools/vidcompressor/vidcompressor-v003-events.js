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

function bindHeaderCollapse() {
  elements.topStickyPanel.addEventListener('mouseenter', () => {
    state.panelHovered = true;
    expandHeader();
    window.clearInterval(state.countdownTimer);
  });
  elements.topStickyPanel.addEventListener('mouseleave', () => {
    state.panelHovered = false;
    resetCountdown();
    startCountdown();
  });
  elements.topStickyPanel.addEventListener('click', () => {
    if (elements.topStickyPanel.classList.contains('minimized')) expandHeader();
  });
  elements.countdownCircle.addEventListener('dblclick', (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.panelLocked = !state.panelLocked;
    updateCountdownDisplay();
    if (state.panelLocked) {
      window.clearInterval(state.countdownTimer);
      expandHeader();
    } else if (!state.panelHovered) {
      startCountdown();
    }
  });
  startCountdown();
}

function settingsChanged(message = '') {
  if (state.isBusy) return;
  resetResult();
  updateEstimate();
  updateAccessNote();
  if (state.sourceFile && message) setStatus(message);
}

function bindEvents() {
  elements.openVideoButton.addEventListener('click', chooseVideoWithHandle);
  elements.clearButton.addEventListener('click', resetWorkspace);
  elements.compressButton.addEventListener('click', compressVideo);
  elements.showSaveActionsButton.addEventListener('click', () => elements.saveActions.classList.toggle('visible'));
  elements.overwriteButton.addEventListener('click', saveOverOriginal);
  elements.saveCopyButton.addEventListener('click', saveNewCopy);

  elements.outputFormat.addEventListener('change', () => {
    const outputPlan = getOutputPlan();
    settingsChanged(outputPlan ? `Output set to ${outputPlan.extension.toUpperCase()}. The estimate has been recalculated.` : 'Output format changed.');
  });
  elements.compressionMode.addEventListener('change', () => settingsChanged('Compression mode changed. The estimate has been recalculated.'));
  elements.smartSizeSlider.addEventListener('input', () => settingsChanged());
  elements.targetSizeInput.addEventListener('input', () => settingsChanged());
  elements.manualVideoSlider.addEventListener('input', () => settingsChanged());
  elements.resolutionSelect.addEventListener('change', () => settingsChanged('Resolution setting changed.'));
  elements.passesSelect.addEventListener('change', () => settingsChanged('Encoding pass setting changed.'));
  elements.audioBitrateSelect.addEventListener('change', () => settingsChanged('Audio bitrate changed. The video allocation has been recalculated.'));
  elements.audioChannelsSelect.addEventListener('change', () => settingsChanged('Audio channel setting changed.'));

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

updateEstimate();
bindHeaderCollapse();
bindEvents();
setBusy(false);
setStatus('Choose a video to start.');
console.info(`Organon VidCompressor v${VERSION} ready.`);
