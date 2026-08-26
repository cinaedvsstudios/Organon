"use strict";

(function installOrgavoxProjectTools() {
  const MODAL_ID = "projectModal";
  const INPUT_ID = "projectFileInput";
  let busy = false;
  const projectMeta = { name: "Untitled Project", savedAt: null };

  function formatSavedAt(value) {
    if (!value) return "Not saved yet";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not saved yet";
    const day = date.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `Saved ${day} · ${time}`;
  }

  function updateProjectInfoBar() {
    const name = document.getElementById("orgavoxProjectInfoName");
    const meta = document.getElementById("orgavoxProjectInfoMeta");
    if (name) name.textContent = projectMeta.name || "Untitled Project";
    if (meta) meta.textContent = formatSavedAt(projectMeta.savedAt);
  }

  function setProjectInfo(name, savedAt) {
    projectMeta.name = name || "Untitled Project";
    projectMeta.savedAt = savedAt || null;
    updateProjectInfoBar();
  }

  function ensureLoadInput() {
    let input = document.getElementById(INPUT_ID);
    if (input) return input;
    input = document.createElement("input");
    input.id = INPUT_ID;
    input.type = "file";
    input.hidden = true;
    input.accept = ".orgavox,.orgavox.json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (file) await loadProjectFile(file);
    });
    document.body.appendChild(input);
    return input;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "orgavox-project-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="orgavox-project-dialog" role="dialog" aria-modal="true" aria-labelledby="projectTitle">
        <div class="popover-head"><div><span class="eyebrow">Project file</span><h3 id="projectTitle">Save / Load Project</h3></div><button class="icon-button" data-project-close type="button">×</button></div>
        <p class="export-note">Project files save the timeline, clip edits and embedded decoded audio so the session can be opened again later.</p>
        <label class="field"><span>Project name</span><input data-project-name type="text" value="orgavox-project" autocomplete="off"></label>
        <div class="orgavox-project-summary" data-project-summary></div>
        <div class="orgavox-project-grid">
          <div class="orgavox-project-card"><h4>Save project</h4><p>Creates an .orgavox.json file with source audio embedded as WAV data plus all clip positions and effects.</p><button class="tool-button primary" data-project-save type="button">Save Project</button></div>
          <div class="orgavox-project-card"><h4>Load project</h4><p>Opens an .orgavox.json file and replaces the current ORGAVOX session with the saved arrangement.</p><button class="tool-button" data-project-load type="button">Load Project</button></div>
        </div>
        <div class="orgavox-project-actions"><button class="tool-button" data-project-close type="button">Close</button></div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-project-close]").forEach((button) => button.addEventListener("click", closeModal));
    modal.querySelector("[data-project-save]")?.addEventListener("click", saveProjectFile);
    modal.querySelector("[data-project-load]")?.addEventListener("click", () => ensureLoadInput().click());
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
    return modal;
  }

  function projectNameInput() { return ensureModal().querySelector("[data-project-name]"); }

  function updateSummary() {
    const summary = ensureModal().querySelector("[data-project-summary]");
    if (!summary) return;
    const duration = typeof projectDuration === "function" ? formatTime(projectDuration()) : "00:00.000";
    summary.textContent = `${state.assets.length} source file${state.assets.length === 1 ? "" : "s"} · ${state.clips.length} clip${state.clips.length === 1 ? "" : "s"} · ${duration} timeline length`;
  }

  function openModal() {
    const modal = ensureModal();
    modal.hidden = false;
    const input = projectNameInput();
    if (input && (!input.value.trim() || input.value === "orgavox-project")) input.value = projectMeta.name !== "Untitled Project" ? projectMeta.name : suggestedProjectName();
    updateSummary();
  }

  function closeModal() { ensureModal().hidden = true; }

  function setBusy(nextBusy, message) {
    busy = Boolean(nextBusy);
    const button = document.getElementById("projectBtn");
    if (button) button.disabled = busy;
    ensureModal().querySelectorAll("button, input").forEach((element) => { element.disabled = busy; });
    if (message) setStatus(message);
  }

  function suggestedProjectName() {
    const first = state.clips[0]?.name || state.assets[0]?.name || "orgavox-project";
    return safeFilename(first).replace(/-clip$|-mix$/i, "") || "orgavox-project";
  }

  async function arrayBufferToBase64(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(String(base64 || ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }

  function bufferToWavBlob(buffer) {
    if (typeof audioBufferToWav === "function") return audioBufferToWav(buffer);
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const frames = buffer.length;
    const blockAlign = channels * 2;
    const dataSize = frames * blockAlign;
    const view = new DataView(new ArrayBuffer(44 + dataSize));
    const write = (offset, text) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
    write(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, dataSize, true);
    const channelData = [];
    for (let channel = 0; channel < channels; channel += 1) channelData.push(buffer.getChannelData(channel));
    let offset = 44;
    for (let frame = 0; frame < frames; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][frame] || 0));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([view], { type: "audio/wav" });
  }

  async function serialiseAsset(asset) {
    if (!asset?.buffer) return null;
    const wavBlob = bufferToWavBlob(asset.buffer);
    const wavBase64 = await arrayBufferToBase64(await wavBlob.arrayBuffer());
    return { id: asset.id, name: asset.name, kind: asset.kind || "WAV", duration: asset.buffer.duration, wavBase64 };
  }

  function serialiseClip(clip) {
    const keys = ["id", "assetId", "name", "track", "start", "sourceStart", "sourceEnd", "stretchDuration", "volume", "echo", "gate", "fadeIn", "fadeOut", "volumeKeyframes", "reverseAudio", "transposeSemitones", "eqSettings", "driveSettings", "dynamicsSettings", "stereoSettings", "lofiSettings"];
    const output = {};
    keys.forEach((key) => { if (clip[key] !== undefined) output[key] = clip[key]; });
    return output;
  }

  async function buildProjectData() {
    const assets = [];
    for (const asset of state.assets) {
      const packed = await serialiseAsset(asset);
      if (packed) assets.push(packed);
    }
    const savedAt = new Date().toISOString();
    return { format: "ORGAVOX_PROJECT", version: window.ORGAVOX_VERSION || "v1.06", savedAt, name: projectNameInput()?.value?.trim() || suggestedProjectName(), pixelsPerSecond: state.pixelsPerSecond, playhead: state.playhead, selectedTrack: state.selectedTrack, assets, clips: state.clips.map(serialiseClip) };
  }

  async function saveProjectFile() {
    if (busy) return;
    stopPlayback();
    setBusy(true, "Saving ORGAVOX project…");
    try {
      const project = await buildProjectData();
      const filename = `${safeFilename(project.name || "orgavox-project")}.orgavox.json`;
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
      downloadBlob(blob, filename);
      setProjectInfo(project.name, project.savedAt);
      showToast(`${filename} saved.`);
      setStatus("Ready");
      closeModal();
    } catch (error) {
      console.error(error);
      showToast(error.message || "The project could not be saved.");
      setStatus("Project save failed");
    } finally { setBusy(false); }
  }

  function safeClipFromProject(raw, assetIds) {
    const assetId = String(raw.assetId || "");
    if (!assetIds.has(assetId)) return null;
    return { id: raw.id || makeId("clip"), assetId, name: raw.name || "Project clip", track: Math.max(0, Math.min(9, Number(raw.track) || 0)), start: Math.max(0, Number(raw.start) || 0), sourceStart: Math.max(0, Number(raw.sourceStart) || 0), sourceEnd: Math.max(0.01, Number(raw.sourceEnd) || 0.01), stretchDuration: raw.stretchDuration == null ? null : Math.max(0.01, Number(raw.stretchDuration) || 0.01), volume: Number.isFinite(Number(raw.volume)) ? Number(raw.volume) : 100, echo: Number.isFinite(Number(raw.echo)) ? Number(raw.echo) : 0, gate: raw.gate || null, fadeIn: Number(raw.fadeIn) || 0, fadeOut: Number(raw.fadeOut) || 0, volumeKeyframes: Array.isArray(raw.volumeKeyframes) ? raw.volumeKeyframes : [], reverseAudio: Boolean(raw.reverseAudio), transposeSemitones: Number(raw.transposeSemitones) || 0, eqSettings: raw.eqSettings || null, driveSettings: raw.driveSettings || null, dynamicsSettings: raw.dynamicsSettings || null, stereoSettings: raw.stereoSettings || null, lofiSettings: raw.lofiSettings || null, bufferOverride: null, cacheVersion: 0 };
  }

  async function loadProjectFile(file) {
    if (busy) return;
    if (!audioContext) return showToast("This browser does not provide the Web Audio engine required by ORGAVOX.");
    stopPlayback();
    setBusy(true, "Loading ORGAVOX project…");
    try {
      const project = JSON.parse(await file.text());
      if (project?.format !== "ORGAVOX_PROJECT" || !Array.isArray(project.assets)) throw new Error("This is not an ORGAVOX project file.");
      const assets = [];
      for (const saved of project.assets) {
        if (!saved?.wavBase64) continue;
        const buffer = await audioContext.decodeAudioData(base64ToArrayBuffer(saved.wavBase64).slice(0));
        assets.push({ id: saved.id || makeId("asset"), file: null, name: saved.name || "project-audio.wav", kind: saved.kind || "PROJECT WAV", buffer, duration: buffer.duration, peaks: makePeaks(buffer) });
      }
      const assetIds = new Set(assets.map((asset) => asset.id));
      const clips = (Array.isArray(project.clips) ? project.clips : []).map((clip) => safeClipFromProject(clip, assetIds)).filter(Boolean);
      state.assets = assets;
      state.clips = clips;
      state.selectedAssetId = assets[0]?.id || null;
      state.selectedClipId = clips[0]?.id || null;
      state.selectedTrack = Math.max(0, Math.min(9, Number(project.selectedTrack) || clips[0]?.track || 0));
      state.playhead = Math.max(0, Number(project.playhead) || 0);
      state.pixelsPerSecond = Math.max(25, Math.min(500, Number(project.pixelsPerSecond) || state.pixelsPerSecond || 80));
      state.renderCache?.clear?.();
      if (ui.zoomSlider) ui.zoomSlider.value = state.pixelsPerSecond;
      if (ui.zoomOut) ui.zoomOut.textContent = `${Math.round(state.pixelsPerSecond / 80 * 100)}%`;
      renderAssets();
      syncSelectedControls();
      renderTimeline();
      setProjectInfo(project.name || file.name.replace(/\.[^.]+$/, ""), project.savedAt || null);
      const input = projectNameInput();
      if (input) input.value = project.name || suggestedProjectName();
      updateSummary();
      showToast(`${project.name || file.name} loaded.`);
      setStatus("Ready");
      closeModal();
    } catch (error) {
      console.error(error);
      showToast(error.message || "The project could not be loaded.");
      setStatus("Project load failed");
    } finally { setBusy(false); }
  }

  function wireButton() {
    const button = document.getElementById("projectBtn");
    if (button && !button.dataset.orgavoxProjectWired) {
      button.dataset.orgavoxProjectWired = "true";
      button.title = "Save or load an ORGAVOX project";
      button.addEventListener("click", openModal);
    }
    if (button) button.disabled = busy;
  }

  window.orgavoxWireProjectButton = wireButton;
  window.orgavoxOpenProjectModal = openModal;
  window.orgavoxUpdateProjectInfoBar = updateProjectInfoBar;
  ensureModal();
  ensureLoadInput();
  wireButton();
  setTimeout(wireButton, 0);
})();