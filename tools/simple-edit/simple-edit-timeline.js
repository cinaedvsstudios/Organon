function timelineWidth() {
  const visible = Math.max(900, ui.timelineScroll.clientWidth || 900);
  return Math.max(visible, projectDuration() * state.pixelsPerSecond + 240);
}

function drawRuler(width) {
  const canvas = ui.rulerCanvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const height = 38;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(117,178,222,.38)";
  ctx.fillStyle = "rgba(245,240,219,.64)";
  ctx.font = '10px "Geist Mono", monospace';
  const major = state.pixelsPerSecond >= 100 ? 1 : state.pixelsPerSecond >= 50 ? 2 : 5;
  const minor = major / 4;
  for (let second = 0; second <= projectDuration() + major; second += minor) {
    const x = second * state.pixelsPerSecond + .5;
    const isMajor = Math.abs(second / major - Math.round(second / major)) < .001;
    ctx.beginPath();
    ctx.moveTo(x, isMajor ? 13 : 24);
    ctx.lineTo(x, 38);
    ctx.stroke();
    if (isMajor) ctx.fillText(formatRulerLabel(second), x + 4, 11);
  }
}

function formatRulerLabel(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remain = Math.floor(seconds % 60);
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

function renderTimeline() {
  const width = timelineWidth();
  ui.timelineContent.style.width = `${width}px`;
  ui.tracks.style.width = `${width}px`;
  drawRuler(width);
  ui.lanes.forEach((lane) => {
    lane.innerHTML = "";
    lane.style.backgroundSize = `${state.pixelsPerSecond}px 100%`;
  });
  state.clips.forEach((clip) => renderClipElement(clip));
  updatePlayheadVisual();
}

function renderClipElement(clip) {
  const lane = ui.lanes[clip.track];
  if (!lane) return;
  const element = document.createElement("div");
  const stretched = Math.abs(stretchedAudioDuration(clip) - bufferDuration(clip)) > .005;
  element.className = `audio-clip${clip.id === state.selectedClipId ? " selected" : ""}${clip.gate?.enabled ? " gated" : ""}${stretched ? " stretched" : ""}`;
  element.dataset.clipId = clip.id;
  element.style.left = `${clip.start * state.pixelsPerSecond}px`;
  element.style.width = `${Math.max(12, clipDuration(clip) * state.pixelsPerSecond)}px`;
  const title = document.createElement("div");
  title.className = "clip-title";
  title.textContent = clip.name;
  const canvas = document.createElement("canvas");
  canvas.className = "clip-wave";
  const left = document.createElement("div");
  left.className = "clip-handle left";
  left.dataset.edge = "left";
  const right = document.createElement("div");
  right.className = "clip-handle right";
  right.dataset.edge = "right";
  const badges = document.createElement("div");
  badges.className = "clip-effect-badges";
  if (clip.volume !== 100) badges.innerHTML += `<span>VOL ${clip.volume}%</span>`;
  if (clip.echo > 0) badges.innerHTML += `<span>ECHO ${clip.echo}%</span>`;
  if (clip.gate?.enabled) badges.innerHTML += `<span>GATE ${clip.gate.speed}/s</span>`;
  element.append(canvas, title, badges, left, right);
  element.addEventListener("pointerdown", (event) => beginClipPointer(event, clip, element));
  element.addEventListener("click", (event) => { event.stopPropagation(); selectClip(clip.id); });
  lane.appendChild(element);
  requestAnimationFrame(() => drawClipWaveform(canvas, clip));
}

function outputToAudioTime(clip, outputTime) {
  const layout = gateLayout(clip);
  const bounded = Math.max(0, Math.min(layout.outputDuration, outputTime));
  if (!clip.gate?.enabled || layout.pause <= 0) return Math.min(layout.audioDuration, bounded);
  const cycle = layout.chunkDuration + layout.pause;
  const index = Math.floor(bounded / cycle);
  const within = bounded - index * cycle;
  const completedAudio = index * layout.chunkDuration;
  return Math.min(layout.audioDuration, completedAudio + Math.min(layout.chunkDuration, within));
}

function drawClipWaveform(canvas, clip) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const buffer = clipBuffer(clip);
  if (!buffer) return;
  const channel = buffer.getChannelData(0);
  const mid = canvas.height / 2;
  ctx.strokeStyle = clip.id === state.selectedClipId ? "rgba(255,235,194,.95)" : "rgba(205,239,255,.85)";
  ctx.lineWidth = Math.max(1, dpr);
  ctx.beginPath();
  const layout = gateLayout(clip);
  for (let x = 0; x < canvas.width; x += 1) {
    const outputTime = x / canvas.width * layout.outputDuration;
    if (clip.gate?.enabled && layout.pause > 0) {
      const cycle = layout.chunkDuration + layout.pause;
      const within = outputTime % cycle;
      const audioAtCycle = Math.floor(outputTime / cycle) * layout.chunkDuration;
      if (within > layout.chunkDuration && audioAtCycle < layout.audioDuration) continue;
    }
    const stretchedTime = outputToAudioTime(clip, outputTime);
    const sourceFraction = stretchedTime / layout.audioDuration;
    const sourceTime = clip.sourceStart + sourceFraction * bufferDuration(clip);
    const center = Math.min(channel.length - 1, Math.max(0, Math.floor(sourceTime * buffer.sampleRate)));
    const radius = Math.max(1, Math.floor(bufferDuration(clip) * buffer.sampleRate / canvas.width / 2));
    let peak = 0;
    for (let sample = Math.max(0, center - radius); sample <= Math.min(channel.length - 1, center + radius); sample += Math.max(1, Math.floor(radius / 8))) {
      peak = Math.max(peak, Math.abs(channel[sample]));
    }
    const h = peak * canvas.height * .41;
    ctx.moveTo(x + .5, mid - h);
    ctx.lineTo(x + .5, mid + h);
  }
  ctx.stroke();
}

function beginClipPointer(event, clip, element) {
  event.stopPropagation();
  stopPlayback();
  selectClip(clip.id, false);
  const edge = event.target.closest(".clip-handle")?.dataset.edge || null;
  state.clipDrag = {
    clipId: clip.id, type: edge ? "edge" : "move", edge, element,
    pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
    original: {
      start: clip.start, track: clip.track, sourceStart: clip.sourceStart, sourceEnd: clip.sourceEnd,
      stretchDuration: clip.stretchDuration
    }
  };
  element.setPointerCapture(event.pointerId);
  element.addEventListener("pointermove", moveClipPointer);
  element.addEventListener("pointerup", endClipPointer, { once: true });
  element.addEventListener("pointercancel", endClipPointer, { once: true });
}

function moveClipPointer(event) {
  const drag = state.clipDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  const clip = state.clips.find((item) => item.id === drag.clipId);
  if (!clip) return;
  const deltaSeconds = (event.clientX - drag.startX) / state.pixelsPerSecond;
  if (drag.type === "move") {
    clip.start = Math.max(0, drag.original.start + deltaSeconds);
    const laneRect = ui.tracks.getBoundingClientRect();
    const count = Math.max(1, ui.lanes?.length || document.querySelectorAll(".track-lane").length || 10);
    const laneHeight = laneRect.height / count;
    const nextTrack = Math.max(0, Math.min(count - 1, Math.floor((event.clientY - laneRect.top) / laneHeight)));
    if (clip.track !== nextTrack) {
      clip.track = nextTrack;
      selectTrack(clip.track);
      ui.lanes[clip.track]?.appendChild(drag.element);
    }
  } else if (state.stretchMode) {
    const originalDuration = drag.original.stretchDuration || Math.max(.01, drag.original.sourceEnd - drag.original.sourceStart);
    if (drag.edge === "right") {
      clip.stretchDuration = Math.max(.05, originalDuration + deltaSeconds);
    } else {
      const originalGateExtra = gateExtraDuration(clip, originalDuration);
      const rightEdge = drag.original.start + originalDuration + originalGateExtra;
      const newStart = Math.max(0, drag.original.start + deltaSeconds);
      clip.start = newStart;
      clip.stretchDuration = Math.max(.05, rightEdge - newStart - originalGateExtra);
    }
    invalidateClip(clip);
  } else {
    const buffer = clipBuffer(clip);
    if (!buffer) return;
    if (drag.edge === "right") {
      clip.sourceEnd = Math.max(drag.original.sourceStart + .05, Math.min(buffer.duration, drag.original.sourceEnd + deltaSeconds));
    } else {
      const maxSource = drag.original.sourceEnd - .05;
      const nextSourceStart = Math.max(0, Math.min(maxSource, drag.original.sourceStart + deltaSeconds));
      const sourceDelta = nextSourceStart - drag.original.sourceStart;
      clip.sourceStart = nextSourceStart;
      clip.start = Math.max(0, drag.original.start + sourceDelta);
    }
    clip.stretchDuration = null;
    invalidateClip(clip);
  }
  drag.element.style.left = `${clip.start * state.pixelsPerSecond}px`;
  drag.element.style.width = `${Math.max(12, clipDuration(clip) * state.pixelsPerSecond)}px`;
  const canvas = drag.element.querySelector(".clip-wave");
  if (canvas) drawClipWaveform(canvas, clip);
  syncSelectedControls();
  updatePlayheadVisual();
}

function gateExtraDuration(clip, audioDuration) {
  if (!clip.gate?.enabled) return 0;
  const chunk = 1 / Math.max(.5, clip.gate.speed || 4);
  const count = Math.max(1, Math.ceil(audioDuration / chunk));
  return Math.max(0, count - 1) * Math.max(0, clip.gate.pause || 0);
}

function endClipPointer(event) {
  const element = state.clipDrag?.element || event.currentTarget;
  if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
  element.removeEventListener("pointermove", moveClipPointer);
  state.clipDrag = null;
  renderTimeline();
}

function setPlayhead(seconds, scrollIntoView = false) {
  state.playhead = Math.max(0, Math.min(projectDuration(), Number(seconds) || 0));
  ui.timeReadout.textContent = formatTime(state.playhead);
  updatePlayheadVisual();
  if (scrollIntoView) {
    const x = state.playhead * state.pixelsPerSecond;
    if (x < ui.timelineScroll.scrollLeft || x > ui.timelineScroll.scrollLeft + ui.timelineScroll.clientWidth - 80) {
      ui.timelineScroll.scrollLeft = Math.max(0, x - 80);
    }
  }
}

function updatePlayheadVisual() {
  ui.playhead.style.left = `${state.playhead * state.pixelsPerSecond}px`;
  ui.timeReadout.textContent = formatTime(state.playhead);
}