'use strict';

async function chooseVideoWithHandle() {
  if (state.isBusy) return;
  const isBulk = state.mode === 'bulk';
  try {
    if (!window.showOpenFilePicker) {
      elements.fileInput.click();
      return;
    }
    const handles = await window.showOpenFilePicker({
      multiple: isBulk,
      types: [{
        description: 'Video files',
        accept: { 'video/*': ['.mp4', '.m4v', '.mov', '.mkv', '.avi', '.webm', '.ogv', '.ogg'] }
      }]
    });
    if (!isBulk) resetWorkspace();
    const fileEntries = [];
    for (const handle of handles) {
      const file = await handle.getFile();
      fileEntries.push({ file, handle });
    }
    await addFilesToQueue(fileEntries);
  } catch (error) {
    if (error && error.name !== 'AbortError') {
      console.error(error);
      elements.fileInput.click();
      setStatus(isBulk
        ? 'The browser file picker could not provide folder-style access. You can still select videos and use Save Options later.'
        : 'The browser file picker could not provide overwrite access. A new copy can still be saved after compression.');
    }
  }
}

function toggleMode() {
  if (state.isBusy) return;
  const nextMode = state.mode === 'single' ? 'bulk' : 'single';
  state.mode = nextMode;
  resetWorkspace();
  syncModeUi();
  setStatus(nextMode === 'bulk' ? 'Bulk mode ready. Add videos to build a queue.' : 'Single-video mode ready. Choose a video to start.');
}

function handleOutputFormatChange() {
  if (state.isBusy) return;
  resetResult();
  updateAccessNote();
  updateEstimate();
  if (state.queue.length) {
    const plan = getOutputPlan(getPrimaryItem());
    setStatus(`Output set to ${plan.extension.toUpperCase()}. ${state.mode === 'bulk' ? 'The whole queue will use this format.' : 'Press Compress Video to create a new result.'}`);
  }
}

function handleInputFiles(files) {
  if (!files || !files.length) return;
  if (state.mode === 'single') resetWorkspace();
  const entries = Array.from(files).map((file) => ({ file, handle: null }));
  addFilesToQueue(entries).catch((error) => {
    console.error(error);
    setStatus('Those files could not be read.', 'error');
  });
}

function handleSaveOptionsClick() {
  if (state.mode === 'bulk') {
    requestOutputFolder().catch((error) => {
      if (error && error.name === 'AbortError') {
        setStatus('Folder selection cancelled.');
      } else {
        console.error(error);
        setStatus(error && error.message ? error.message : 'Could not authorise the output folder.', 'error');
      }
    });
  } else {
    elements.saveActions.classList.toggle('visible');
  }
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

function bindEvents() {
  elements.openVideoButton.addEventListener('click', chooseVideoWithHandle);
  elements.bulkModeButton.addEventListener('click', toggleMode);
  elements.clearButton.addEventListener('click', resetWorkspace);
  elements.compressButton.addEventListener('click', () => { compressVideo(); });
  elements.showSaveActionsButton.addEventListener('click', handleSaveOptionsClick);
  elements.overwriteButton.addEventListener('click', saveOverOriginal);
  elements.saveCopyButton.addEventListener('click', saveNewCopy);
  [elements.smartSizeSlider, elements.manualVideoSlider].forEach((input) => input.addEventListener('input', updateEstimate));
  [elements.outputFormat, elements.compressionMode, elements.resolutionSelect, elements.passesSelect, elements.audioBitrateSelect, elements.audioChannelsSelect].forEach((input) => input.addEventListener('change', handleOutputFormatChange));
  elements.targetSizeInput.addEventListener('input', updateEstimate);
  elements.fileInput.addEventListener('change', () => {
    handleInputFiles(elements.fileInput.files);
    elements.fileInput.value = '';
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
    const files = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files : null;
    handleInputFiles(files);
  });
  [elements.openVideoButton, elements.compressButton, elements.showSaveActionsButton, elements.bulkModeButton].forEach((button) => {
    button.addEventListener('mouseenter', () => setHubStatus(button.textContent.trim()));
    button.addEventListener('mouseleave', clearHubStatus);
  });
  window.addEventListener('beforeunload', () => {
    revokeSourceObjectUrl();
    revokeOutputObjectUrl();
  });
}

updateEstimate();
syncModeUi();
bindHeaderCollapse();
bindEvents();
setBusy(false);
setStatus('Choose a video to start.');
console.info(`Organon VidCompressor v${VERSION} ready.`);
