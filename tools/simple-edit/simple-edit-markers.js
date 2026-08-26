"use strict";

(function installOrgavoxMarkers() {
  const LAYER_ID = "orgavoxMarkerLayer";
  const STYLE_ID = "orgavoxMarkerStyles";
  const MODAL_ID = "markersModal";
  const CONTEXT_ID = "markerContextMenu";
  const COLORS = ["gold", "cyan", "green", "purple", "red"];
  let lastRenderSig = "";
  let renderQueued = false;

  function markers() { if (!Array.isArray(state.markers)) state.markers = []; return state.markers; }
  function beats() { if (!Array.isArray(state.beatMarkers)) state.beatMarkers = []; return state.beatMarkers; }
  function esc(value) { return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
  function parseTimeValue(value, fallback = state.playhead) { const text = String(value || "").trim(); if (!text) return Math.max(0, Number(fallback) || 0); if (text.includes(":")) { const parts = text.split(":").map(Number); return parts.some((part) => !Number.isFinite(part)) ? Math.max(0, Number(fallback) || 0) : Math.max(0, parts.reduce((sum, part) => sum * 60 + part, 0)); } const number = Number(text.replace(/s$/i, "")); return Number.isFinite(number) ? Math.max(0, number) : Math.max(0, Number(fallback) || 0); }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #timelineContent{position:relative!important}
      .orgavox-marker-layer{position:absolute!important;inset:0 auto 0 0!important;width:max(100%,var(--orgavox-timeline-width,100%))!important;min-height:100%!important;pointer-events:none!important;z-index:60!important}
      .orgavox-marker-line{position:absolute!important;top:0!important;bottom:0!important;width:0!important;min-width:0!important;padding:0!important;border:0!important;border-left:2px solid rgba(224,163,96,.96)!important;background:transparent!important;cursor:pointer!important;pointer-events:auto!important;overflow:visible!important;z-index:3!important}
      .orgavox-marker-line[data-color="cyan"]{border-left-color:rgba(117,178,222,.96)!important}.orgavox-marker-line[data-color="green"]{border-left-color:rgba(74,190,117,.96)!important}.orgavox-marker-line[data-color="purple"]{border-left-color:rgba(178,109,255,.96)!important}.orgavox-marker-line[data-color="red"]{border-left-color:rgba(220,72,64,.96)!important}
      .orgavox-marker-line::before{content:"";position:absolute;left:-5px;top:0;width:9px;height:100%;background:linear-gradient(90deg,transparent,rgba(224,163,96,.16),transparent)}
      .orgavox-marker-tag{position:absolute!important;top:4px!important;left:5px!important;max-width:150px!important;padding:3px 7px!important;border:1px solid rgba(224,163,96,.72)!important;border-radius:999px!important;background:rgba(10,11,10,.92)!important;color:#f8d792!important;font:900 .56rem var(--font-mono,monospace)!important;letter-spacing:.04em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;box-shadow:0 4px 12px rgba(0,0,0,.42)!important}
      .orgavox-beat-line{position:absolute!important;top:38px!important;bottom:0!important;width:0!important;border-left:1px solid rgba(117,178,222,.55)!important;background:transparent!important;pointer-events:none!important;z-index:2!important}
      .orgavox-beat-line.strong{border-left-width:2px!important;border-left-color:rgba(117,178,222,.78)!important}
      .orgavox-beat-line::before{content:"";position:absolute;left:-2px;top:0;width:4px;height:100%;background:linear-gradient(90deg,transparent,rgba(117,178,222,.14),transparent)}
      .orgavox-marker-context{position:fixed;z-index:999999;display:grid;gap:6px;padding:8px;border:1px solid rgba(224,163,96,.72);border-radius:12px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72)}
      .orgavox-marker-context[hidden]{display:none!important}
      .orgavox-markers-modal{position:fixed!important;inset:0!important;z-index:999998!important;display:grid!important;place-items:center!important;padding:24px!important;background:rgba(0,0,0,.58)!important}
      .orgavox-markers-modal[hidden]{display:none!important}
      .orgavox-markers-dialog{width:min(560px,calc(100vw - 40px))!important;max-height:min(620px,calc(100vh - 40px))!important;display:flex!important;flex-direction:column!important;gap:12px!important;padding:16px!important;border:1px solid rgba(224,163,96,.72)!important;border-radius:18px!important;background:linear-gradient(180deg,rgba(24,25,24,.98),rgba(10,11,10,.99))!important;box-shadow:0 22px 64px rgba(0,0,0,.76)!important;color:#f5f0db!important}
      .orgavox-markers-list{display:grid!important;gap:8px!important;overflow:auto!important;padding-right:4px!important;min-height:96px!important}
      .orgavox-marker-list-row{display:grid!important;grid-template-columns:1fr auto auto!important;align-items:center!important;gap:10px!important;width:100%!important;padding:8px 10px!important;border:1px solid rgba(224,163,96,.34)!important;border-radius:12px!important;background:rgba(0,0,0,.28)!important;color:#f5f0db!important;text-align:left!important}
      .orgavox-marker-list-row strong{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .orgavox-marker-list-row span{color:#75b2de!important;font:900 .64rem var(--font-mono,monospace)!important}
      .orgavox-marker-list-row .danger{border-color:rgba(220,72,64,.72)!important;color:#ffd8d2!important}
    `;
    document.head.appendChild(style);
  }

  function ensureLayer() {
    const content = document.getElementById("timelineContent");
    if (!content) return null;
    let layer = document.getElementById(LAYER_ID);
    if (!layer) { layer = document.createElement("div"); layer.id = LAYER_ID; layer.className = "orgavox-marker-layer"; }
    if (layer.parentElement !== content) content.appendChild(layer);
    const width = Math.max(content.scrollWidth || 0, content.clientWidth || 0);
    if (width) layer.style.setProperty("--orgavox-timeline-width", `${width}px`);
    return layer;
  }

  function addMarkerAtPlayhead() {
    const list = markers();
    list.push({ id: makeId("marker"), time: Math.max(0, Number(state.playhead) || 0), label: `Marker ${list.length + 1}`, color: COLORS[list.length % COLORS.length] });
    forceRenderMarkers();
    window.orgavoxRecordHistory?.();
    showToast("Marker added.");
  }
  function previousMarker() { const now = Math.max(0, Number(state.playhead) || 0); const target = markers().map((marker) => marker.time).filter((time) => time < now - 0.001).sort((a, b) => b - a)[0]; if (target == null) return showToast("No previous marker."); setPlayhead(target, true); }
  function nextMarker() { const now = Math.max(0, Number(state.playhead) || 0); const target = markers().map((marker) => marker.time).filter((time) => time > now + 0.001).sort((a, b) => a - b)[0]; if (target == null) return showToast("No next marker."); setPlayhead(target, true); }
  function jumpToMarker(id) { const marker = markers().find((item) => item.id === id); if (marker) setPlayhead(marker.time, true); }
  function closeContext() { const menu = document.getElementById(CONTEXT_ID); if (menu) menu.hidden = true; }
  function ensureContext() { let menu = document.getElementById(CONTEXT_ID); if (!menu) { menu = document.createElement("div"); menu.id = CONTEXT_ID; menu.className = "orgavox-marker-context"; menu.hidden = true; document.body.appendChild(menu); } return menu; }
  function deleteMarker(id) { state.markers = markers().filter((marker) => marker.id !== id); closeContext(); forceRenderMarkers(); window.orgavoxRecordHistory?.(); showToast("Marker deleted."); }
  function moveMarker(id, time) { const marker = markers().find((item) => item.id === id); if (!marker) return; marker.time = Math.max(0, Number(time) || 0); closeContext(); forceRenderMarkers(); window.orgavoxRecordHistory?.(); showToast("Marker moved."); }
  function openMarkerContext(id, x, y) { const marker = markers().find((item) => item.id === id); if (!marker) return; const menu = ensureContext(); menu.innerHTML = `<button class="tool-button" data-action="jump" type="button">Jump to Marker</button><button class="tool-button" data-action="move-playhead" type="button">Move Marker to Playhead</button><button class="tool-button" data-action="move-time" type="button">Move Marker…</button><button class="tool-button danger" data-action="delete" type="button">Delete Marker</button>`; menu.querySelector("[data-action='jump']")?.addEventListener("click", () => { closeContext(); jumpToMarker(id); }); menu.querySelector("[data-action='move-playhead']")?.addEventListener("click", () => moveMarker(id, state.playhead)); menu.querySelector("[data-action='move-time']")?.addEventListener("click", () => { const next = prompt("Move marker to time", formatTime(marker.time)); if (next != null) moveMarker(id, parseTimeValue(next, marker.time)); }); menu.querySelector("[data-action='delete']")?.addEventListener("click", () => deleteMarker(id)); menu.style.left = `${Math.min(window.innerWidth - 230, Math.max(8, x))}px`; menu.style.top = `${Math.min(window.innerHeight - 190, Math.max(8, y))}px`; menu.hidden = false; }
  function ensureModal() { let modal = document.getElementById(MODAL_ID); if (modal) return modal; modal = document.createElement("div"); modal.id = MODAL_ID; modal.className = "orgavox-markers-modal"; modal.hidden = true; modal.innerHTML = `<section class="orgavox-markers-dialog" role="dialog" aria-modal="true" aria-labelledby="markersTitle"><div class="popover-head"><div><span class="eyebrow">Timeline map</span><h3 id="markersTitle">Markers</h3></div><button class="icon-button" data-marker-close type="button">×</button></div><div class="orgavox-markers-list" data-markers-list></div><div class="button-row end"><button class="tool-button" data-marker-close type="button">Close</button><button class="tool-button primary" data-marker-add type="button">Add Marker</button></div></section>`; document.body.appendChild(modal); modal.querySelectorAll("[data-marker-close]").forEach((button) => button.addEventListener("click", () => { modal.hidden = true; })); modal.querySelector("[data-marker-add]")?.addEventListener("click", addMarkerAtPlayhead); modal.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; }); return modal; }
  function openModal() { const modal = ensureModal(); renderList(); modal.hidden = false; }

  function renderList() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    const list = modal.querySelector("[data-markers-list]");
    if (!list) return;
    const sorted = markers().slice().sort((a, b) => a.time - b.time);
    list.innerHTML = sorted.length ? "" : `<div class="empty-state">No markers yet.</div>`;
    sorted.forEach((marker) => {
      const row = document.createElement("div");
      row.className = "orgavox-marker-list-row";
      row.innerHTML = `<strong>${esc(marker.label)}</strong><span>${formatTime(marker.time)}</span><button class="tool-button danger" type="button">Delete</button>`;
      row.addEventListener("click", () => jumpToMarker(marker.id));
      row.querySelector("button")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); deleteMarker(marker.id); });
      list.appendChild(row);
    });
  }

  function renderSignature() {
    const layer = document.getElementById(LAYER_ID);
    const width = layer?.style?.getPropertyValue("--orgavox-timeline-width") || "";
    return JSON.stringify({
      pps: Math.round(Number(state.pixelsPerSecond) || 80),
      width,
      m: markers().map((marker) => [marker.id, Math.round(marker.time * 1000), marker.label, marker.color]),
      b: beats().map((marker) => [Math.round(marker.time * 1000), marker.track, Math.round(marker.bpm || 0), Math.round((marker.score || 0) * 100)])
    });
  }

  function forceRenderMarkers() {
    lastRenderSig = "";
    renderMarkers();
  }

  function renderMarkers() {
    const layer = ensureLayer();
    if (!layer) return;
    const sig = renderSignature();
    if (sig === lastRenderSig && layer.childElementCount) { renderList(); return; }
    lastRenderSig = sig;
    layer.innerHTML = "";
    const pps = Math.max(1, Number(state.pixelsPerSecond) || 80);
    const fragment = document.createDocumentFragment();
    beats().forEach((marker, index) => {
      const line = document.createElement("div");
      line.className = `orgavox-beat-line${index % 4 === 0 ? " strong" : ""}`;
      line.style.left = `${Math.round(marker.time * pps)}px`;
      line.title = marker.bpm ? `Beat marker ${Math.round(marker.bpm)} BPM` : "Beat marker";
      fragment.appendChild(line);
    });
    markers().forEach((marker) => {
      const line = document.createElement("button");
      line.type = "button";
      line.className = "orgavox-marker-line";
      line.dataset.markerId = marker.id;
      line.dataset.color = marker.color;
      line.style.left = `${Math.round(marker.time * pps)}px`;
      line.title = `${marker.label} — ${formatTime(marker.time)}. Right-click for options.`;
      line.innerHTML = `<span class="orgavox-marker-tag">${esc(marker.label)}</span>`;
      line.addEventListener("click", (event) => { event.stopPropagation(); jumpToMarker(marker.id); });
      line.addEventListener("dblclick", (event) => { event.stopPropagation(); openModal(); });
      line.addEventListener("contextmenu", (event) => { event.preventDefault(); event.stopPropagation(); openMarkerContext(marker.id, event.clientX, event.clientY); });
      fragment.appendChild(line);
    });
    layer.appendChild(fragment);
    renderList();
  }

  function queueRenderMarkers() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; renderMarkers(); });
  }

  function analysisFrames(clip, maxSeconds = 30) {
    const buffer = clipBuffer(clip);
    if (!buffer) return [];
    const channel = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const sourceStart = Math.max(0, Math.min(buffer.duration, Number(clip.sourceStart) || 0));
    const sourceEnd = Math.max(sourceStart + 0.05, Math.min(buffer.duration, Number(clip.sourceEnd) || buffer.duration));
    const duration = Math.min(maxSeconds, sourceEnd - sourceStart);
    const frameSeconds = 0.04;
    const frameSamples = Math.max(256, Math.floor(sampleRate * frameSeconds));
    const startSample = Math.floor(sourceStart * sampleRate);
    const endSample = Math.min(channel.length, startSample + Math.floor(duration * sampleRate));
    const frames = [];
    for (let start = startSample; start < endSample; start += frameSamples) {
      const end = Math.min(endSample, start + frameSamples);
      let sum = 0;
      let peak = 0;
      for (let i = start; i < end; i += 1) {
        const value = channel[i] || 0;
        sum += value * value;
        peak = Math.max(peak, Math.abs(value));
      }
      frames.push({ time: (start - startSample) / sampleRate, energy: sum / Math.max(1, end - start), peak, onset: 0 });
    }
    let previous = frames[0]?.energy || 0;
    frames.forEach((frame) => {
      frame.onset = Math.max(0, frame.energy - previous);
      previous = frame.energy * 0.65 + previous * 0.35;
    });
    const sorted = frames.map((frame) => frame.onset).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const upper = sorted[Math.floor(sorted.length * 0.9)] || 0;
    const scale = Math.max(0.000001, upper - median);
    frames.forEach((frame) => { frame.onset = Math.max(0, Math.min(1, (frame.onset - median) / scale)); });
    return frames;
  }

  function onsetPeaks(frames) {
    const peaks = [];
    for (let i = 1; i < frames.length - 1; i += 1) {
      const frame = frames[i];
      if (frame.onset < 0.42) continue;
      if (frame.onset < frames[i - 1].onset || frame.onset < frames[i + 1].onset) continue;
      const previous = peaks[peaks.length - 1];
      if (previous && frame.time - previous.time < 0.22) {
        if (frame.onset > previous.onset) peaks[peaks.length - 1] = frame;
      } else {
        peaks.push(frame);
      }
    }
    return peaks;
  }

  function localPeakNear(peaks, time, tolerance) {
    let best = null;
    peaks.forEach((peak) => {
      const distance = Math.abs(peak.time - time);
      if (distance > tolerance) return;
      const score = peak.onset * (1 - distance / Math.max(tolerance, 0.001));
      if (!best || score > best.score) best = { time: peak.time, onset: peak.onset, score };
    });
    return best;
  }

  function estimateBeatGrid(frames, peaks) {
    if (frames.length < 40 || peaks.length < 6) return null;
    const analysisDuration = frames[frames.length - 1].time;
    let best = null;
    for (let bpm = 70; bpm <= 180; bpm += 1) {
      const interval = 60 / bpm;
      const tolerance = Math.min(0.075, interval * 0.18);
      const offsets = peaks.slice(0, 18).map((peak) => peak.time % interval);
      offsets.forEach((offset) => {
        let hits = 0;
        let misses = 0;
        let score = 0;
        for (let time = offset; time <= analysisDuration; time += interval) {
          const peak = localPeakNear(peaks, time, tolerance);
          if (peak) { hits += 1; score += peak.score; }
          else misses += 1;
        }
        const expected = Math.max(1, hits + misses);
        const coverage = hits / expected;
        const normalized = score / expected;
        const confidence = coverage * 0.65 + normalized * 0.35;
        if (!best || confidence > best.confidence) best = { bpm, interval, offset, confidence, hits, expected };
      });
    }
    if (!best || best.hits < 6 || best.confidence < 0.38 || best.hits / best.expected < 0.38) return null;
    return best;
  }

  function detectBeatsForClip(clip) {
    const buffer = clipBuffer(clip);
    const frames = analysisFrames(clip, 30);
    const peaks = onsetPeaks(frames);
    const grid = estimateBeatGrid(frames, peaks);
    if (!buffer || !grid) return { beats: [], bpm: 0, confidence: 0 };
    const sourceStart = Math.max(0, Math.min(buffer.duration, Number(clip.sourceStart) || 0));
    const sourceEnd = Math.max(sourceStart + 0.05, Math.min(buffer.duration, Number(clip.sourceEnd) || buffer.duration));
    const duration = Math.max(0.05, sourceEnd - sourceStart);
    const beatsOut = [];
    const tolerance = Math.min(0.075, grid.interval * 0.18);
    for (let time = grid.offset; time <= duration; time += grid.interval) {
      const peak = time <= 30 ? localPeakNear(peaks, time, tolerance) : null;
      if (time <= 30 && !peak) continue;
      const refined = peak ? peak.time : time;
      if (refined >= 0 && refined <= duration) beatsOut.push({ time: Math.max(0, (clip.start || 0) + refined), score: peak?.onset || grid.confidence });
      if (beatsOut.length >= 240) break;
    }
    if (beatsOut.length < 6) return { beats: [], bpm: 0, confidence: 0 };
    return { beats: beatsOut, bpm: grid.bpm, confidence: grid.confidence };
  }

  function addBeatMarkers() {
    const clip = selectedClip() || state.clips.find((item) => Number(item.track) === Number(state.selectedTrack));
    if (!clip) return showToast("Select a clip or track first.");
    const detected = detectBeatsForClip(clip);
    state.beatMarkers = beats().filter((marker) => marker.track !== clip.track);
    detected.beats.forEach((beat) => state.beatMarkers.push({ id: makeId("beat"), time: beat.time, track: clip.track, bpm: detected.bpm, score: beat.score }));
    forceRenderMarkers();
    window.orgavoxRecordHistory?.();
    showToast(detected.beats.length ? `${detected.beats.length} real beat peaks added at about ${Math.round(detected.bpm)} BPM.` : "No steady beat grid found. This sounds irregular or spoken, so no fake beat lines were added.");
  }

  function clearBeatMarkers() { state.beatMarkers = []; forceRenderMarkers(); window.orgavoxRecordHistory?.(); showToast("Beat markers cleared."); }
  function patchTimelineRender() { if (window.__orgavoxMarkerRenderPatched || typeof renderTimeline !== "function") return; window.__orgavoxMarkerRenderPatched = true; const previousRenderTimeline = renderTimeline; renderTimeline = function orgavoxMarkersRenderTimeline() { const result = previousRenderTimeline.apply(this, arguments); queueRenderMarkers(); return result; }; }

  window.orgavoxRenderMarkers = forceRenderMarkers;
  window.orgavoxAddMarkerAtPlayhead = addMarkerAtPlayhead;
  window.orgavoxPreviousMarker = previousMarker;
  window.orgavoxNextMarker = nextMarker;
  window.orgavoxOpenMarkersPanel = openModal;
  window.orgavoxAddBeatMarkers = addBeatMarkers;
  window.orgavoxClearBeatMarkers = clearBeatMarkers;
  installStyles();
  markers();
  beats();
  patchTimelineRender();
  setTimeout(forceRenderMarkers, 0);
  window.addEventListener("resize", forceRenderMarkers);
  document.addEventListener("click", (event) => { if (!event.target.closest(`#${CONTEXT_ID}`)) closeContext(); });
})();
