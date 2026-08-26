"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ui = {
  app: $("#app"), importBtn: $("#importBtn"), fileInput: $("#fileInput"), dropzone: $("#dropzone"),
  jumpStartBtn: $("#jumpStartBtn"), playBtn: $("#playBtn"), stopBtn: $("#stopBtn"), timeReadout: $("#timeReadout"),
  scissorsBtn: $("#scissorsBtn"), stretchBtn: $("#stretchBtn"), gateBtn: $("#gateBtn"), deleteBtn: $("#deleteBtn"), fullscreenBtn: $("#fullscreenBtn"),
  selectedClipName: $("#selectedClipName"), volumeSlider: $("#volumeSlider"), volumeOut: $("#volumeOut"), echoSlider: $("#echoSlider"), echoOut: $("#echoOut"),
  zoomSlider: $("#zoomSlider"), zoomOut: $("#zoomOut"), exportBtn: $("#exportBtn"), assetCount: $("#assetCount"), assetList: $("#assetList"),
  statusPill: $("#statusPill"), timelineShell: $("#timelineShell"), timelineScroll: $("#timelineScroll"), timelineContent: $("#timelineContent"),
  rulerCanvas: $("#rulerCanvas"), tracks: $("#tracks"), lanes: $$(".track-lane"), trackLabels: $$(".track-label"), playhead: $("#playhead"),
  gatePopover: $("#gatePopover"), gateCloseBtn: $("#gateCloseBtn"), gateSpeed: $("#gateSpeed"), gateSpeedOut: $("#gateSpeedOut"),
  gatePause: $("#gatePause"), gatePauseOut: $("#gatePauseOut"), gateFade: $("#gateFade"), gateFadeOut: $("#gateFadeOut"),
  gateResetBtn: $("#gateResetBtn"), gateApplyBtn: $("#gateApplyBtn"), exportModal: $("#exportModal"), exportCloseBtn: $("#exportCloseBtn"),
  exportCancelBtn: $("#exportCancelBtn"), exportConfirmBtn: $("#exportConfirmBtn"), exportName: $("#exportName"), exportFormat: $("#exportFormat"),
  bitrateField: $("#bitrateField"), mp3Bitrate: $("#mp3Bitrate"), exportNote: $("#exportNote"), exportProgress: $("#exportProgress"), toast: $("#toast")
};

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioContext = AudioContextClass ? new AudioContextClass() : null;

const state = {
  assets: [],
  clips: [],
  selectedAssetId: null,
  selectedClipId: null,
  selectedClipIds: [],
  selectedTrack: 0,
  pixelsPerSecond: 80,
  playhead: 0,
  stretchMode: false,
  dragAssetId: null,
  clipDrag: null,
  playing: false,
  playOriginContextTime: 0,
  playOriginTimelineTime: 0,
  activeSources: [],
  raf: 0,
  toastTimer: 0,
  renderCache: new Map(),
  processingToken: 0
};

function trackCount() { return Math.max(1, ui.lanes?.length || document.querySelectorAll(".track-lane").length || 10); }
function clampTrack(track) { return Math.max(0, Math.min(trackCount() - 1, Number(track) || 0)); }

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function setHubStatus(text) {
  try { window.parent?.postMessage?.({ type: "set-status", text }, "*"); } catch {}
}

function clearHubStatus() {
  try { window.parent?.postMessage?.({ type: "clear-status" }, "*"); } catch {}
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 3200);
}

function setStatus(message) {
  ui.statusPill.textContent = message;
  setHubStatus(message);
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 1000);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function safeFilename(value) {
  return String(value || "simple-edit-mix")
    .replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim() || "simple-edit-mix";
}

function fileKind(file) {
  if ((file.type || "").startsWith("video/")) return "video audio";
  const extension = (file.name.split(".").pop() || "audio").toUpperCase();
  return extension;
}

function bufferDuration(clip) {
  return Math.max(.01, clip.sourceEnd - clip.sourceStart);
}

function stretchedAudioDuration(clip) {
  return Math.max(.01, clip.stretchDuration || bufferDuration(clip));
}\n
function gateLayout(clip) {
  const audioDuration = stretchedAudioDuration(clip);
  if (!clip.gate?.enabled) return { audioDuration, outputDuration: audioDuration, chunkDuration: audioDuration, pause: 0, count: 1 };
  const speed = Math.max(.5, Number(clip.gate.speed) || 4);
  const pause = Math.max(0, Number(clip.gate.pause) || 0);
  const chunkDuration = 1 / speed;
  const count = Math.max(1, Math.ceil(audioDuration / chunkDuration));
  const outputDuration = audioDuration + Math.max(0, count - 1) * pause;
  return { audioDuration, outputDuration, chunkDuration, pause, count };
}

function clipDuration(clip) {
  return gateLayout(clip).outputDuration;
}

function projectDuration() {
  return Math.max(5, ...state.clips.map((clip) => clip.start + clipDuration(clip) + (clip.echo > 0 ? 1.5 : 0)));
}

function selectedClip() {
  return state.clips.find((clip) => clip.id === state.selectedClipId) || null;
}

function selectedAsset() {
  return state.assets.find((asset) => asset.id === state.selectedAssetId) || null;
}

function getAssetForClip(clip) {
  return state.assets.find((asset) => asset.id === clip.assetId) || null;
}

function clipBuffer(clip) {
  return clip.bufferOverride || getAssetForClip(clip)?.buffer || null;
}

function makePeaks(buffer, count = 240) {
  const channel = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(channel.length / count));
  const peaks = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    let peak = 0;
    const start = index * step;
    const end = Math.min(channel.length, start + step);
    for (let sample = start; sample < end; sample += 1) peak = Math.max(peak, Math.abs(channel[sample]));
    peaks[index] = peak;
  }
  return peaks;
}

function drawMiniWave(canvas, peaks) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#75b2de";
  ctx.lineWidth = dpr;
  const mid = canvas.height / 2;
  ctx.beginPath();
  for (let x = 0; x < canvas.width; x += 1) {
    const peak = peaks[Math.min(peaks.length - 1, Math.floor(x / canvas.width * peaks.length))] || 0;
    const h = peak * canvas.height * .42;
    ctx.moveTo(x + .5, mid - h);
    ctx.lineTo(x + .5, mid + h);
  }
  ctx.stroke();
}

async function importFiles(fileList) {
  if (!audioContext) {
    showToast("This browser does not provide the Web Audio engine required by Simple Edit.");
    return;
  }
  const files = [...(fileList || [])];
  if (!files.length) return;
  setStatus(`Importing ${files.length} file${files.length === 1 ? "" : "s"}…`);
  let added = 0;
  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const asset = {
        id: makeId("asset"), file, name: file.name, kind: fileKind(file), buffer,
        duration: buffer.duration, peaks: makePeaks(buffer)
      };
      state.assets.push(asset);
      state.selectedAssetId = asset.id;
      added += 1;
    } catch (error) {
      console.error(error);
      showToast(`${file.name} could not be decoded. The browser may not support that media codec.`);
    }
  }
  renderAssets();
  setStatus(added ? `${added} source file${added === 1 ? "" : "s"} ready` : "No files imported");
  setTimeout(clearHubStatus, 3200);
}

function renderAssets() {
  ui.assetCount.textContent = String(state.assets.length);
  ui.assetList.innerHTML = "";
  if (!state.assets.length) {
    ui.assetList.innerHTML = '<div class="empty-state">No sound files loaded.</div>';
    return;
  }
  state.assets.forEach((asset) => {
    const item = document.createElement("div");
    item.className = `asset-item${asset.id === state.selectedAssetId ? " selected" : ""}`;
    item.draggable = true;
    item.dataset.assetId = asset.id;
    const canvas = document.createElement("canvas");
    canvas.className = "asset-wave";
    const info = document.createElement("div");
    info.className = "asset-info";
    info.innerHTML = `<div class="asset-name" title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</div><div class="asset-meta">${formatTime(asset.duration)} · ${escapeHtml(asset.kind)}</div>`;
    const add = document.createElement("button");
    add.type = "button";
    add.className = "asset-add";
    add.textContent = "+";
    add.title = `Add to Track ${state.selectedTrack + 1} at the playhead`;
    add.addEventListener("click", (event) => {
      event.stopPropagation();
      addClipFromAsset(asset.id, state.selectedTrack, state.playhead);
    });
    item.append(canvas, info, add);
    item.addEventListener("click", () => { state.selectedAssetId = asset.id; renderAssets(); });
    item.addEventListener("dragstart", (event) => {
      state.dragAssetId = asset.id;
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/plain", asset.id);
    });
    item.addEventListener("dragend", () => { state.dragAssetId = null; });
    ui.assetList.appendChild(item);
    requestAnimationFrame(() => drawMiniWave(canvas, asset.peaks));
  });
}

function addClipFromAsset(assetId, track, start) {
  const asset = state.assets.find((item) => item.id === assetId);
  if (!asset) return;
  const clip = {
    id: makeId("clip"), assetId, name: asset.name, track: clampTrack(track),
    start: Math.max(0, start), sourceStart: 0, sourceEnd: asset.duration,
    stretchDuration: null, volume: 100, echo: 0, gate: null, bufferOverride: null, cacheVersion: 0
  };
  state.clips.push(clip);
  selectClip(clip.id);
  renderTimeline();
  showToast(`${asset.name} added to Track ${clip.track + 1}.`);
}

function selectTrack(track) {
  state.selectedTrack = clampTrack(track);
  ui.lanes.forEach((lane) => lane.classList.toggle("selected-track", Number(lane.dataset.track) === state.selectedTrack));
  ui.trackLabels.forEach((label) => label.classList.toggle("active", Number(label.dataset.trackLabel) === state.selectedTrack));
  renderAssets();
}

function selectClip(id, rerender = true) {
  state.selectedClipId = id;
  const clip = selectedClip();
  if (clip && clip.track !== state.selectedTrack) selectTrack(clip.track);
  syncSelectedControls();
  if (rerender) renderTimeline();
  else {
    $$(".audio-clip").forEach((element) => element.classList.toggle("selected", element.dataset.clipId === id));
  }
}

function syncSelectedControls() {
  const clip = selectedClip();
  const disabled = !clip;
  ui.scissorsBtn.disabled = disabled;
  ui.gateBtn.disabled = disabled;
  ui.deleteBtn.disabled = disabled;
  ui.volumeSlider.disabled = disabled;
  ui.echoSlider.disabled = disabled;
  ui.selectedClipName.textContent = clip ? clip.name : "None";
  ui.volumeSlider.value = clip ? clip.volume : 100;
  ui.volumeOut.textContent = `${clip ? clip.volume : 100}%`;
  ui.echoSlider.value = clip ? clip.echo : 0;
  ui.echoOut.textContent = `${clip ? clip.echo : 0}%`;
  if (clip?.gate?.enabled) {
    ui.gateSpeed.value = clip.gate.speed;
    ui.gatePause.value = clip.gate.pause;
    ui.gateFade.value = clip.gate.fade;
  }
  updateGateReadouts();
}

function invalidateClip(clip) {
  clip.cacheVersion = (clip.cacheVersion || 0) + 1;
  for (const key of state.renderCache.keys()) if (key.startsWith(`${clip.id}:`)) state.renderCache.delete(key);
}

function deleteSelectedClip() {
  const clip = selectedClip();
  if (!clip) return;
  stopPlayback();
  state.clips = state.clips.filter((item) => item.id !== clip.id);
  state.selectedClipId = null;
  state.selectedClipIds = [];
  syncSelectedControls();
  renderTimeline();
  showToast("Selected clip deleted.");
}