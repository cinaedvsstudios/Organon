async function renderMix() {
  const prepared = [];
  for (const clip of state.clips) {
    const buffer = await processedClipBuffer(clip);
    if (buffer) prepared.push({ clip, buffer });
  }
  const sampleRate = 44100;
  const duration = Math.max(.1, projectDuration());
  const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineAudioContextClass) throw new Error("Offline audio rendering is unavailable in this browser.");
  const offline = new OfflineAudioContextClass(2, Math.ceil(duration * sampleRate), sampleRate);
  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = -2;
  compressor.knee.value = 8;
  compressor.ratio.value = 4;
  compressor.attack.value = .003;
  compressor.release.value = .2;
  compressor.connect(offline.destination);
  for (const { clip, buffer } of prepared) {
    const source = offline.createBufferSource();
    source.buffer = buffer;
    connectClipNodes(offline, source, clip, compressor);
    source.start(clip.start);
  }
  return offline.startRendering();
}

function audioBufferToWav(buffer) {
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(arrayBuffer);
  const writeText = (offset, text) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + length * blockAlign, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, length * blockAlign, true);
  const data = [];
  for (let channel = 0; channel < channels; channel += 1) data.push(buffer.getChannelData(channel));
  let offset = 44;
  for (let sample = 0; sample < length; sample += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const value = Math.max(-1, Math.min(1, data[channel][sample] || 0));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function floatToInt16(input, start, count) {
  const output = new Int16Array(count);
  for (let index = 0; index < count; index += 1) {
    const value = Math.max(-1, Math.min(1, input[start + index] || 0));
    output[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  return output;
}

function audioBufferToMp3(buffer, bitrate) {
  if (!window.lamejs?.Mp3Encoder) throw new Error("The MP3 encoder did not load. WAV export remains available.");
  const sampleRate = buffer.sampleRate;
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const encoder = new lamejs.Mp3Encoder(2, sampleRate, bitrate);
  const chunks = [];
  const block = 1152;
  for (let start = 0; start < buffer.length; start += block) {
    const count = Math.min(block, buffer.length - start);
    const encoded = encoder.encodeBuffer(floatToInt16(left, start, count), floatToInt16(right, start, count));
    if (encoded.length) chunks.push(new Int8Array(encoded));
  }
  const end = encoder.flush();
  if (end.length) chunks.push(new Int8Array(end));
  return new Blob(chunks, { type: "audio/mpeg" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function exportFilePickerOptions(filename, format) {
  const mp3 = format === "mp3";
  const mime = mp3 ? "audio/mpeg" : "audio/wav";
  const extension = mp3 ? ".mp3" : ".wav";
  return {
    suggestedName: filename,
    types: [{
      description: mp3 ? "MP3 audio" : "WAV audio",
      accept: { [mime]: [extension] }
    }]
  };
}

async function chooseExportFile(filename, format) {
  if (!("showSaveFilePicker" in window)) return null;
  return window.showSaveFilePicker(exportFilePickerOptions(filename, format));
}

async function writeExportFile(handle, blob) {
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    try { await writable.abort(); } catch {}
    throw error;
  }
}

async function confirmExport() {
  if (!state.clips.length) {
    showToast("Add at least one clip before exporting.");
    return;
  }

  const format = ui.exportFormat.value;
  const extension = format === "mp3" ? "mp3" : "wav";
  const name = `${safeFilename(ui.exportName.value)}.${extension}`;
  let fileHandle = null;

  if ("showSaveFilePicker" in window) {
    try {
      fileHandle = await chooseExportFile(name, format);
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error(error);
      showToast("The save location could not be opened.");
      return;
    }
  }

  stopPlayback();
  ui.exportConfirmBtn.disabled = true;
  ui.exportCancelBtn.disabled = true;
  ui.exportCloseBtn.disabled = true;
  ui.exportProgress.hidden = false;

  try {
    setStatus("Rendering five-track mix…");
    const rendered = await renderMix();
    setStatus(format === "mp3" ? "Encoding MP3…" : "Encoding WAV…");
    const blob = format === "mp3"
      ? audioBufferToMp3(rendered, Number(ui.mp3Bitrate.value))
      : audioBufferToWav(rendered);

    if (fileHandle) {
      setStatus(`Saving ${name}…`);
      await writeExportFile(fileHandle, blob);
    } else {
      downloadBlob(blob, name);
    }

    ui.exportModal.hidden = true;
    showToast(fileHandle ? `${name} saved.` : `${name} downloaded.`);
    setStatus("Ready");
  } catch (error) {
    console.error(error);
    showToast(error.message || "The mix could not be exported.");
    setStatus("Export failed");
  } finally {
    ui.exportConfirmBtn.disabled = false;
    ui.exportCancelBtn.disabled = false;
    ui.exportCloseBtn.disabled = false;
    ui.exportProgress.hidden = true;
  }
}

function updateExportFormat() {
  const mp3 = ui.exportFormat.value === "mp3";
  ui.bitrateField.hidden = !mp3;
  ui.exportConfirmBtn.textContent = mp3 ? "Render MP3" : "Render WAV";
  ui.exportNote.textContent = mp3
    ? "MP3 creates a smaller compressed file using the selected bitrate."
    : "WAV keeps the rendered mix uncompressed.";
}

function suggestedExportName() {
  return safeFilename(state.clips[0]?.name || "simple-edit-mix");
}

function openExport() {
  if (!state.clips.length) {
    showToast("Add at least one clip before exporting.");
    return;
  }
  ui.exportName.value = suggestedExportName();
  ui.exportModal.hidden = false;
  updateExportFormat();
  requestAnimationFrame(() => {
    ui.exportName.focus();
    ui.exportName.select();
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function pointerTime(event) {
  const rect = ui.timelineContent.getBoundingClientRect();
  return Math.max(0, (event.clientX - rect.left) / state.pixelsPerSecond);
}

function installEvents() {
  ui.importBtn.addEventListener("click", () => ui.fileInput.click());
  ui.dropzone.addEventListener("click", () => ui.fileInput.click());
  ui.fileInput.addEventListener("change", (event) => { importFiles(event.target.files); event.target.value = ""; });
  [ui.dropzone, ui.timelineShell].forEach((target) => {
    target.addEventListener("dragover", (event) => { event.preventDefault(); if (target === ui.dropzone) target.classList.add("dragover"); });
    target.addEventListener("dragleave", () => target.classList.remove?.("dragover"));
  });
  ui.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    ui.dropzone.classList.remove("dragover");
    importFiles(event.dataTransfer.files);
  });

  ui.lanes.forEach((lane) => {
    lane.addEventListener("click", (event) => {
      if (event.target.closest(".audio-clip")) return;
      selectTrack(Number(lane.dataset.track));
      setPlayhead(pointerTime(event));
      state.selectedClipId = null;
      syncSelectedControls();
      renderTimeline();
    });
    lane.addEventListener("dragover", (event) => { event.preventDefault(); lane.classList.add("drag-target"); });
    lane.addEventListener("dragleave", () => lane.classList.remove("drag-target"));
    lane.addEventListener("drop", (event) => {
      event.preventDefault();
      lane.classList.remove("drag-target");
      const assetId = state.dragAssetId || event.dataTransfer.getData("text/plain");
      addClipFromAsset(assetId, Number(lane.dataset.track), pointerTime(event));
    });
  });
  ui.rulerCanvas.addEventListener("pointerdown", (event) => { stopPlayback(); setPlayhead(pointerTime(event)); });
  ui.trackLabels.forEach((label) => label.addEventListener("click", () => selectTrack(label.dataset.trackLabel)));

  ui.playBtn.addEventListener("click", togglePlayback);
  ui.stopBtn.addEventListener("click", () => stopPlayback());
  ui.jumpStartBtn.addEventListener("click", () => { stopPlayback(); setPlayhead(0, true); });
  ui.stretchBtn.addEventListener("click", () => {
    state.stretchMode = !state.stretchMode;
    ui.stretchBtn.setAttribute("aria-pressed", String(state.stretchMode));
    ui.stretchBtn.textContent = state.stretchMode ? "↔ Stretch on" : "↔ Stretch off";
    showToast(state.stretchMode ? "Clip edges now change length without changing pitch." : "Clip edges now crop or restore source audio.");
  });
  ui.fullscreenBtn.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { showToast("Fullscreen was blocked by the browser."); }
  });

  ui.volumeSlider.addEventListener("input", () => {
    const clip = selectedClip(); if (!clip) return;
    clip.volume = Number(ui.volumeSlider.value);
    ui.volumeOut.textContent = `${clip.volume}%`;
    renderTimeline();
  });
  ui.echoSlider.addEventListener("input", () => {
    const clip = selectedClip(); if (!clip) return;
    clip.echo = Number(ui.echoSlider.value);
    ui.echoOut.textContent = `${clip.echo}%`;
    renderTimeline();
  });
  ui.zoomSlider.addEventListener("input", () => {
    state.pixelsPerSecond = Number(ui.zoomSlider.value);
    ui.zoomOut.textContent = `${state.pixelsPerSecond} px/s`;
    renderTimeline();
  });

  ui.gateBtn.addEventListener("click", openGate);
  ui.gateCloseBtn.addEventListener("click", () => { ui.gatePopover.hidden = true; });
  [ui.gateSpeed, ui.gatePause, ui.gateFade].forEach((input) => input.addEventListener("input", updateGateReadouts));
  ui.gateApplyBtn.addEventListener("click", applyGate);
  ui.gateResetBtn.addEventListener("click", resetGate);

  ui.exportBtn.addEventListener("click", openExport);
  ui.exportCloseBtn.addEventListener("click", () => { ui.exportModal.hidden = true; });
  ui.exportCancelBtn.addEventListener("click", () => { ui.exportModal.hidden = true; });

  let exportBackdropPointerDown = false;
  ui.exportModal.addEventListener("pointerdown", (event) => {
    exportBackdropPointerDown = event.target === ui.exportModal;
  });
  ui.exportModal.addEventListener("pointerup", (event) => {
    if (exportBackdropPointerDown && event.target === ui.exportModal) ui.exportModal.hidden = true;
    exportBackdropPointerDown = false;
  });
  ui.exportModal.addEventListener("pointercancel", () => { exportBackdropPointerDown = false; });

  ui.exportFormat.addEventListener("change", updateExportFormat);
  ui.exportConfirmBtn.addEventListener("click", confirmExport);

  document.addEventListener("keydown", (event) => {
    const typing = event.target.matches("input,select,textarea");
    if (event.code === "Space" && !typing) { event.preventDefault(); togglePlayback(); }
    if ((event.key === "Delete" || event.key === "Backspace") && !typing) deleteSelectedClip();
    if (event.key.toLowerCase() === "s" && !typing) splitSelectedClip();
    if (event.key === "Escape") { ui.gatePopover.hidden = true; ui.exportModal.hidden = true; }
  });
  window.addEventListener("resize", renderTimeline);
  window.addEventListener("beforeunload", stopPlayback);
}

installEvents();
syncSelectedControls();
selectTrack(0);
renderTimeline();
setStatus("Ready");
