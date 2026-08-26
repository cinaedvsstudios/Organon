"use strict";

(function installOrgavoxMarkers() {
  const LAYER_ID = "orgavoxMarkerLayer";
  const STYLE_ID = "orgavoxMarkerStyles";
  const MODAL_ID = "markersModal";
  const CONTEXT_ID = "markerContextMenu";
  const COLORS = ["gold", "cyan", "green", "purple", "red"];

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
      .orgavox-beat-line{position:absolute!important;top:38px!important;bottom:0!important;width:0!important;border-left:1px solid rgba(117,178,222,.58)!important;background:transparent!important;pointer-events:none!important;z-index:2!important}
      .orgavox-beat-line::before{content:"";position:absolute;left:-2px;top:0;width:4px;height:100%;background:linear-gradient(90deg,transparent,rgba(117,178,222,.16),transparent)}
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

  function addMarkerAtPlayhead() { const list = markers(); list.push({ id: makeId("marker"), time: Math.max(0, Number(state.playhead) || 0), label: `Marker ${list.length + 1}`, color: COLORS[list.length % COLORS.length] }); renderMarkers(); window.orgavoxRecordHistory?.(); showToast("Marker added."); }
  function previousMarker() { const now = Math.max(0, Number(state.playhead) || 0); const target = markers().map((marker) => marker.time).filter((time) => time < now - 0.001).sort((a, b) => b - a)[0]; if (target == null) return showToast("No previous marker."); setPlayhead(target, true); }
  function nextMarker() { const now = Math.max(0, Number(state.playhead) || 0); const target = markers().map((marker) => marker.time).filter((time) => time > now + 0.001).sort((a, b) => a - b)[0]; if (target == null) return showToast("No next marker."); setPlayhead(target, true); }
  function jumpToMarker(id) { const marker = markers().find((item) => item.id === id); if (marker) setPlayhead(marker.time, true); }
  function closeContext() { const menu = document.getElementById(CONTEXT_ID); if (menu) menu.hidden = true; }
  function ensureContext() { let menu = document.getElementById(CONTEXT_ID); if (!menu) { menu = document.createElement("div"); menu.id = CONTEXT_ID; menu.className = "orgavox-marker-context"; menu.hidden = true; document.body.appendChild(menu); } return menu; }
  function deleteMarker(id) { state.markers = markers().filter((marker) => marker.id !== id); closeContext(); renderMarkers(); window.orgavoxRecordHistory?.(); showToast("Marker deleted."); }
  function moveMarker(id, time) { const marker = markers().find((item) => item.id === id); if (!marker) return; marker.time = Math.max(0, Number(time) || 0); closeContext(); renderMarkers(); window.orgavoxRecordHistory?.(); showToast("Marker moved."); }
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
  function renderMarkers() { const layer = ensureLayer(); if (!layer) return; layer.innerHTML = ""; const pps = Math.max(1, Number(state.pixelsPerSecond) || 80); beats().forEach((marker) => { const line = document.createElement("div"); line.className = "orgavox-beat-line"; line.style.left = `${Math.round(marker.time * pps)}px`; line.title = marker.bpm ? `Beat grid ${Math.round(marker.bpm)} BPM` : "Beat marker"; layer.appendChild(line); }); markers().forEach((marker) => { const line = document.createElement("button"); line.type = "button"; line.className = "orgavox-marker-line"; line.dataset.markerId = marker.id; line.dataset.color = marker.color; line.style.left = `${Math.round(marker.time * pps)}px`; line.title = `${marker.label} — ${formatTime(marker.time)}. Right-click for options.`; line.innerHTML = `<span class="orgavox-marker-tag">${esc(marker.label)}</span>`; line.addEventListener("click", (event) => { event.stopPropagation(); jumpToMarker(marker.id); }); line.addEventListener("dblclick", (event) => { event.stopPropagation(); openModal(); }); line.addEventListener("contextmenu", (event) => { event.preventDefault(); event.stopPropagation(); openMarkerContext(marker.id, event.clientX, event.clientY); }); layer.appendChild(line); }); renderList(); }

  function analysisFrames(clip, maxSeconds = 30) {
    const buffer = clipBuffer(clip);
    if (!buffer) return [];
    const channel = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const sourceStart = Math.max(0, Math.min(buffer.duration, Number(clip.sourceStart) || 0));
    const sourceEnd = Math.max(sourceStart + 0.05, Math.min(buffer.duration, Number(clip.sourceEnd) || buffer.duration));
    const duration = Math.min(maxSeconds, sourceEnd - sourceStart);
    const frameSeconds = 0.05;
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
      previous = frame.energy * 0.72 + previous * 0.28;
    });
    const maxOnset = Math.max(0.000001, ...frames.map((frame) => frame.onset));
    frames.forEach((frame) => { frame.onset /= maxOnset; });
    return frames;
  }

  function localOnsetScore(frames, time, radius = 0.08) {
    let best = 0;
    frames.forEach((frame) => {
      const distance = Math.abs(frame.time - time);
      if (distance <= radius) best = Math.max(best, frame.onset * (1 - distance / Math.max(radius, 0.001)));
    });
    return best;
  }

  function estimateBeatGrid(frames) {
    if (frames.length < 12) return null;
    const analysisDuration = frames[frames.length - 1].time;
    let best = null;
    for (let bpm = 70; bpm <= 180; bpm += 1) {
      const interval = 60 / bpm;
      const offsetStep = Math.max(0.025, interval / 24);
      for (let offset = 0; offset < interval; offset += offsetStep) {
        let score = 0;
        let count = 0;
        for (let time = offset; time <= analysisDuration; time += interval) {
          score += localOnsetScore(frames, time, Math.min(0.09, interval * 0.24));
          count += 1;
        }
        const normalized = score / Math.max(1, count);
        if (!best || normalized > best.score) best = { bpm, interval, offset, score: normalized };
      }
    }
    return best;
  }

  function refineBeatTime(frames, time, interval) {
    const radius = Math.min(0.09, interval * 0.22);
    let bestTime = time;
    let bestScore = -1;
    frames.forEach((frame) => {
      const distance = Math.abs(frame.time - time);
      if (distance > radius) return;
      const score = frame.onset * (1 - distance / Math.max(radius, 0.001));
      if (score > bestScore) { bestScore = score; bestTime = frame.time; }
    });
    return bestTime;
  }

  function detectBeatsForClip(clip) {
    const buffer = clipBuffer(clip);
    const frames = analysisFrames(clip, 30);
    const grid = estimateBeatGrid(frames);
    if (!buffer || !grid) return { beats: [], bpm: 0 };
    const sourceStart = Math.max(0, Math.min(buffer.duration, Number(clip.sourceStart) || 0));
    const sourceEnd = Math.max(sourceStart + 0.05, Math.min(buffer.duration, Number(clip.sourceEnd) || buffer.duration));
    const duration = Math.max(0.05, sourceEnd - sourceStart);
    const beatsOut = [];
    for (let time = grid.offset; time <= duration; time += grid.interval) {
      const refined = time <= 30 ? refineBeatTime(frames, time, grid.interval) : time;
      if (refined >= 0 && refined <= duration) beatsOut.push(Math.max(0, (clip.start || 0) + refined));
      if (beatsOut.length >= 600) break;
    }
    return { beats: beatsOut, bpm: grid.bpm };
  }

  function addBeatMarkers() {
    const clip = selectedClip() || state.clips.find((item) => Number(item.track) === Number(state.selectedTrack));
    if (!clip) return showToast("Select a clip or track first.");
    const detected = detectBeatsForClip(clip);
    state.beatMarkers = beats().filter((marker) => marker.track !== clip.track);
    detected.beats.forEach((time) => state.beatMarkers.push({ id: makeId("beat"), time, track: clip.track, bpm: detected.bpm }));
    renderMarkers();
    window.orgavoxRecordHistory?.();
    showToast(detected.beats.length ? `${detected.beats.length} beat markers added at about ${Math.round(detected.bpm)} BPM.` : "No steady beat grid found.");
  }
  function clearBeatMarkers() { state.beatMarkers = []; renderMarkers(); window.orgavoxRecordHistory?.(); showToast("Beat markers cleared."); }
  function patchTimelineRender() { if (window.__orgavoxMarkerRenderPatched || typeof renderTimeline !== "function") return; window.__orgavoxMarkerRenderPatched = true; const previousRenderTimeline = renderTimeline; renderTimeline = function orgavoxMarkersRenderTimeline() { const result = previousRenderTimeline.apply(this, arguments); requestAnimationFrame(renderMarkers); return result; }; }

  window.orgavoxRenderMarkers = renderMarkers; window.orgavoxAddMarkerAtPlayhead = addMarkerAtPlayhead; window.orgavoxPreviousMarker = previousMarker; window.orgavoxNextMarker = nextMarker; window.orgavoxOpenMarkersPanel = openModal; window.orgavoxAddBeatMarkers = addBeatMarkers; window.orgavoxClearBeatMarkers = clearBeatMarkers;
  installStyles(); markers(); beats(); patchTimelineRender(); setTimeout(renderMarkers, 0); window.addEventListener("resize", renderMarkers); document.addEventListener("click", (event) => { if (!event.target.closest(`#${CONTEXT_ID}`)) closeContext(); });
})();
