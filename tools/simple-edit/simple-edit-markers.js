"use strict";

(function installOrgavoxMarkers() {
  const STYLE_ID = "orgavox-markers-style";
  const MODAL_ID = "markersModal";
  const LAYER_ID = "orgavoxMarkerLayer";
  const CONTEXT_ID = "orgavoxMarkerContextMenu";
  const COLORS = ["gold", "blue", "green", "purple", "red"];
  let activeColor = "gold";

  function markerState() {
    if (!Array.isArray(state.markers)) state.markers = [];
    state.markers = state.markers
      .map((marker, index) => ({
        id: marker.id || makeId("marker"),
        time: Math.max(0, Number(marker.time) || 0),
        label: String(marker.label || `Marker ${index + 1}`).slice(0, 80),
        color: COLORS.includes(marker.color) ? marker.color : "gold"
      }))
      .sort((a, b) => a.time - b.time);
    return state.markers;
  }

  function beatState() {
    if (!Array.isArray(state.beatMarkers)) state.beatMarkers = [];
    state.beatMarkers = state.beatMarkers
      .map((marker) => ({ id: marker.id || makeId("beat"), time: Math.max(0, Number(marker.time) || 0), track: Math.max(0, Math.min(9, Number(marker.track) || 0)) }))
      .sort((a, b) => a.time - b.time);
    return state.beatMarkers;
  }

  function parseTimeInput(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    if (text.includes(":")) {
      const parts = text.split(":").map(Number);
      if (parts.some((part) => !Number.isFinite(part))) return null;
      let seconds = 0;
      parts.forEach((part) => { seconds = seconds * 60 + part; });
      return Math.max(0, seconds);
    }
    const number = Number(text.replace(/s$/i, ""));
    return Number.isFinite(number) ? Math.max(0, number) : null;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-markers-button{border-color:rgba(248,215,146,.82)!important;background:linear-gradient(180deg,rgba(112,75,31,.88),rgba(43,26,10,.95))!important;color:#ffe4a8!important}
      .orgavox-marker-layer{position:absolute;inset:0;z-index:34;pointer-events:none;overflow:visible}
      .orgavox-marker-line{position:absolute;top:0;bottom:0;width:2px;transform:translateX(-1px);background:rgba(248,215,146,.86);box-shadow:0 0 12px rgba(248,215,146,.32);pointer-events:auto;cursor:pointer}
      .orgavox-marker-line[data-color="blue"]{background:rgba(117,178,222,.9);box-shadow:0 0 12px rgba(117,178,222,.28)}
      .orgavox-marker-line[data-color="green"]{background:rgba(74,190,117,.88);box-shadow:0 0 12px rgba(74,190,117,.26)}
      .orgavox-marker-line[data-color="purple"]{background:rgba(178,109,255,.9);box-shadow:0 0 12px rgba(178,109,255,.26)}
      .orgavox-marker-line[data-color="red"]{background:rgba(220,72,64,.88);box-shadow:0 0 12px rgba(220,72,64,.26)}
      .orgavox-beat-line{position:absolute;top:0;bottom:0;width:1px;transform:translateX(-.5px);background:rgba(255,0,255,.92);box-shadow:0 0 10px rgba(255,0,255,.35);pointer-events:none}
      .orgavox-marker-tag{position:absolute;top:4px;left:4px;max-width:160px;padding:3px 7px;border:1px solid rgba(30,18,6,.7);border-radius:9px;background:linear-gradient(180deg,#f0c36d,#c89031);color:#17100a;font:900 .6rem var(--font-mono);letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 12px rgba(0,0,0,.35)}
      .orgavox-marker-modal{position:fixed;inset:0;z-index:97;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}
      .orgavox-marker-modal[hidden]{display:none}
      .orgavox-marker-dialog{width:min(760px,calc(100vw - 42px));max-height:min(720px,calc(100vh - 42px));overflow:auto;padding:20px;border:1px solid rgba(224,163,96,.72);border-radius:22px;background:#1a1c18;box-shadow:0 24px 80px rgba(0,0,0,.78)}
      .orgavox-marker-form{display:grid;grid-template-columns:minmax(160px,1fr) auto auto;gap:10px;align-items:end;margin-top:14px}
      .orgavox-marker-list{display:grid;gap:8px;margin-top:14px}
      .orgavox-marker-row{display:grid;grid-template-columns:88px minmax(120px,1fr) auto auto;gap:8px;align-items:center;padding:9px;border:1px solid rgba(137,107,73,.5);border-radius:13px;background:rgba(0,0,0,.2)}
      .orgavox-marker-time{color:#75b2de;font:800 .68rem var(--font-mono)}
      .orgavox-marker-name{min-width:0;color:#f5f0db;font:800 .73rem var(--font-body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .orgavox-marker-colors{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
      .orgavox-marker-swatch{width:22px;height:22px;border-radius:999px;border:1px solid rgba(245,240,219,.42);background:#e5b65d;cursor:pointer}
      .orgavox-marker-swatch.active{outline:2px solid rgba(255,255,255,.72);outline-offset:2px}
      .orgavox-marker-swatch[data-color="blue"]{background:#75b2de}.orgavox-marker-swatch[data-color="green"]{background:#4abe75}.orgavox-marker-swatch[data-color="purple"]{background:#b26dff}.orgavox-marker-swatch[data-color="red"]{background:#dc4840}
      .orgavox-marker-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:16px}
      .orgavox-marker-nav{border-color:rgba(178,109,255,.88)!important;background:linear-gradient(180deg,rgba(91,47,151,.92),rgba(38,22,78,.96))!important;color:#f3e2ff!important;box-shadow:0 0 0 1px rgba(178,109,255,.22),0 0 12px rgba(178,109,255,.22)!important}
      .orgavox-marker-context{position:fixed;z-index:999998;min-width:220px;padding:9px;border:1px solid rgba(178,109,255,.72);border-radius:14px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);display:grid;gap:7px}
      .orgavox-marker-context[hidden]{display:none}
      .orgavox-marker-context .tool-button{justify-content:flex-start!important;min-height:32px!important}
      .orgavox-marker-context label{display:grid;gap:5px;color:rgba(245,240,219,.7);font:800 .56rem var(--font-mono);text-transform:uppercase;letter-spacing:.08em}
      .orgavox-marker-context input{height:32px;border:1px solid rgba(117,178,222,.58);border-radius:9px;background:#050505;color:#f5f0db;padding:0 8px;font:900 .72rem var(--font-mono);outline:none}
      @media(max-width:760px){.orgavox-marker-form,.orgavox-marker-row{grid-template-columns:1fr}.orgavox-marker-actions{justify-content:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function ensureButton() {
    if (ui.markersBtn) return ui.markersBtn;
    const button = document.createElement("button");
    button.id = "markersBtn";
    button.type = "button";
    button.className = "tool-button orgavox-markers-button";
    button.textContent = "🏷 Add Marker";
    button.title = "Add a marker at the playhead";
    button.addEventListener("click", addMarkerAtPlayhead);
    ui.markersBtn = button;
    placeButton();
    return button;
  }

  function ensureNavButton(id, text, title, handler) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "icon-button orgavox-marker-nav";
      button.addEventListener("click", handler);
    }
    button.textContent = text;
    button.title = title;
    button.setAttribute("aria-label", title);
    return button;
  }

  function placeButton() {
    const button = ensureButton();
    const editGroup = document.querySelector(".orgavox-edit-group") || button.parentElement;
    if (!editGroup) return;
    const prev = ensureNavButton("prevMarkerBtn", "◀", "Previous marker", previousMarker);
    const next = ensureNavButton("nextMarkerBtn", "▶", "Next marker", nextMarker);
    if (button.parentElement !== editGroup) editGroup.appendChild(button);
    if (button.previousElementSibling !== prev) editGroup.insertBefore(prev, button);
    if (button.nextElementSibling !== next) editGroup.insertBefore(next, button.nextSibling);
  }

  function ensureLayer() {
    const content = document.getElementById("timelineContent");
    if (!content) return null;
    let layer = document.getElementById(LAYER_ID);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = LAYER_ID;
      layer.className = "orgavox-marker-layer";
    }
    if (layer.parentElement !== content) content.appendChild(layer);
    return layer;
  }

  function renderBeatMarkers(layer, pps) {
    beatState().forEach((marker) => {
      const line = document.createElement("div");
      line.className = "orgavox-beat-line";
      line.dataset.track = String(marker.track);
      line.style.left = `${marker.time * pps}px`;
      line.title = `Beat marker · Track ${marker.track + 1} · ${formatTime(marker.time)}`;
      layer.appendChild(line);
    });
  }

  function renderMarkers() {
    const layer = ensureLayer();
    if (!layer) return;
    layer.innerHTML = "";
    const pps = Math.max(1, Number(state.pixelsPerSecond) || 80);
    renderBeatMarkers(layer, pps);
    markerState().forEach((marker) => {
      const line = document.createElement("button");
      line.type = "button";
      line.className = "orgavox-marker-line";
      line.dataset.markerId = marker.id;
      line.dataset.color = marker.color;
      line.style.left = `${marker.time * pps}px`;
      line.title = `${marker.label} — ${formatTime(marker.time)}`;
      line.innerHTML = `<span class="orgavox-marker-tag">${escapeHtml(marker.label)}</span>`;
      line.addEventListener("click", (event) => {
        event.stopPropagation();
        jumpToMarker(marker.id);
      });
      line.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        openModal();
      });
      line.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openMarkerContext(marker.id, event.clientX, event.clientY);
      });
      layer.appendChild(line);
    });
    renderList();
    placeButton();
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "orgavox-marker-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="orgavox-marker-dialog" role="dialog" aria-modal="true" aria-labelledby="markersTitle">
        <div class="popover-head"><div><span class="eyebrow">Timeline cues</span><h3 id="markersTitle">Markers</h3></div><button class="icon-button" data-markers-close type="button">×</button></div>
        <p class="export-note">Drop cue points on the timeline, jump back to them, rename them, or clear them. Markers follow the current timeline zoom.</p>
        <div class="orgavox-marker-form">
          <label class="field"><span>Marker name</span><input data-marker-name type="text" value="Marker" autocomplete="off"></label>
          <div class="orgavox-marker-colors" data-marker-colors></div>
          <button class="tool-button primary" data-marker-add type="button">Add at playhead</button>
        </div>
        <div class="orgavox-marker-list" data-marker-list></div>
        <div class="orgavox-marker-actions"><button class="tool-button" data-marker-copy type="button">Copy list</button><button class="tool-button danger" data-marker-clear type="button">Clear markers</button><button class="tool-button" data-markers-close type="button">Close</button></div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-markers-close]").forEach((button) => button.addEventListener("click", closeModal));
    modal.querySelector("[data-marker-add]")?.addEventListener("click", addMarkerAtPlayhead);
    modal.querySelector("[data-marker-copy]")?.addEventListener("click", copyMarkerList);
    modal.querySelector("[data-marker-clear]")?.addEventListener("click", clearMarkers);
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
    renderColorChoices();
    return modal;
  }

  function ensureContextMenu() {
    let menu = document.getElementById(CONTEXT_ID);
    if (menu) return menu;
    menu = document.createElement("form");
    menu.id = CONTEXT_ID;
    menu.className = "orgavox-marker-context";
    menu.hidden = true;
    menu.innerHTML = `
      <button class="tool-button" data-move-playhead type="button">↔ Move to playhead</button>
      <label>Move to time<input data-move-time type="text" autocomplete="off"></label>
      <button class="tool-button" data-move-typed type="submit">Apply typed time</button>
      <button class="tool-button danger" data-delete type="button">Delete marker</button>`;
    document.body.appendChild(menu);
    menu.addEventListener("submit", (event) => {
      event.preventDefault();
      const marker = markerState().find((item) => item.id === menu.dataset.markerId);
      const seconds = parseTimeInput(menu.querySelector("[data-move-time]")?.value);
      if (!marker || seconds == null) return showToast("Enter a valid marker time.");
      moveMarker(marker.id, seconds);
      closeContextMenu();
    });
    menu.querySelector("[data-move-playhead]")?.addEventListener("click", () => {
      const marker = markerState().find((item) => item.id === menu.dataset.markerId);
      if (!marker) return;
      moveMarker(marker.id, state.playhead);
      closeContextMenu();
    });
    menu.querySelector("[data-delete]")?.addEventListener("click", () => {
      const marker = markerState().find((item) => item.id === menu.dataset.markerId);
      if (!marker) return;
      deleteMarker(marker.id);
      closeContextMenu();
    });
    document.addEventListener("click", (event) => { if (!event.target.closest(`#${CONTEXT_ID}`)) closeContextMenu(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeContextMenu(); });
    return menu;
  }

  function openMarkerContext(id, x, y) {
    const marker = markerState().find((item) => item.id === id);
    if (!marker) return;
    const menu = ensureContextMenu();
    menu.dataset.markerId = id;
    const input = menu.querySelector("[data-move-time]");
    if (input) input.value = formatTime(marker.time);
    menu.style.left = `${Math.min(window.innerWidth - 240, Math.max(8, x))}px`;
    menu.style.top = `${Math.min(window.innerHeight - 180, Math.max(8, y))}px`;
    menu.hidden = false;
    input?.focus();
    input?.select();
  }

  function closeContextMenu() {
    const menu = document.getElementById(CONTEXT_ID);
    if (menu) menu.hidden = true;
  }

  function renderColorChoices() {
    const box = ensureModal().querySelector("[data-marker-colors]");
    if (!box) return;
    box.innerHTML = "";
    COLORS.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "orgavox-marker-swatch";
      swatch.dataset.color = color;
      swatch.classList.toggle("active", color === activeColor);
      swatch.title = color;
      swatch.addEventListener("click", () => {
        activeColor = color;
        renderColorChoices();
      });
      box.appendChild(swatch);
    });
  }

  function renderList() {
    const list = document.getElementById(MODAL_ID)?.querySelector("[data-marker-list]");
    if (!list) return;
    const markers = markerState();
    list.innerHTML = markers.length ? "" : `<div class="empty-state">No markers yet.</div>`;
    markers.forEach((marker) => {
      const row = document.createElement("div");
      row.className = "orgavox-marker-row";
      row.innerHTML = `<span class="orgavox-marker-time">${formatTime(marker.time)}</span><span class="orgavox-marker-name">${escapeHtml(marker.label)}</span><button class="tool-button" data-marker-jump type="button">Jump</button><button class="tool-button danger" data-marker-delete type="button">Delete</button>`;
      row.querySelector("[data-marker-jump]")?.addEventListener("click", () => jumpToMarker(marker.id));
      row.querySelector("[data-marker-delete]")?.addEventListener("click", () => deleteMarker(marker.id));
      row.querySelector(".orgavox-marker-name")?.addEventListener("dblclick", () => renameMarker(marker.id));
      list.appendChild(row);
    });
  }

  function openModal() {
    ensureModal().hidden = false;
    const input = ensureModal().querySelector("[data-marker-name]");
    if (input) input.value = `Marker ${markerState().length + 1}`;
    renderList();
  }

  function closeModal() { ensureModal().hidden = true; }

  function addMarkerAtPlayhead() {
    const modal = ensureModal();
    const input = modal.querySelector("[data-marker-name]");
    const label = (input?.value || `Marker ${markerState().length + 1}`).trim().slice(0, 80) || `Marker ${markerState().length + 1}`;
    markerState().push({ id: makeId("marker"), time: Math.max(0, Number(state.playhead) || 0), label, color: activeColor });
    showToast(`Marker added at ${formatTime(state.playhead || 0)}.`);
    renderTimeline();
    renderMarkers();
    if (input) input.value = `Marker ${markerState().length + 1}`;
    window.orgavoxRecordHistory?.();
  }

  function jumpToMarker(id) {
    const marker = markerState().find((item) => item.id === id);
    if (!marker) return;
    stopPlayback();
    setPlayhead(marker.time);
    renderTimeline();
    renderMarkers();
    showToast(`Jumped to ${marker.label}.`);
  }

  function markerRelative(direction) {
    const markers = markerState();
    if (!markers.length) return showToast("No markers in the timeline.");
    const current = Math.max(0, Number(state.playhead) || 0);
    const epsilon = 0.01;
    const marker = direction < 0
      ? [...markers].reverse().find((item) => item.time < current - epsilon) || markers[markers.length - 1]
      : markers.find((item) => item.time > current + epsilon) || markers[0];
    jumpToMarker(marker.id);
  }

  function previousMarker() { markerRelative(-1); }
  function nextMarker() { markerRelative(1); }

  function renameMarker(id) {
    const marker = markerState().find((item) => item.id === id);
    if (!marker) return;
    const next = prompt("Marker name", marker.label);
    if (next == null) return;
    marker.label = next.trim().slice(0, 80) || marker.label;
    renderTimeline();
    renderMarkers();
    window.orgavoxRecordHistory?.();
  }

  function moveMarker(id, time) {
    const marker = markerState().find((item) => item.id === id);
    if (!marker) return;
    marker.time = Math.max(0, Number(time) || 0);
    renderTimeline();
    renderMarkers();
    showToast(`Marker moved to ${formatTime(marker.time)}.`);
    window.orgavoxRecordHistory?.();
  }

  function deleteMarker(id) {
    state.markers = markerState().filter((marker) => marker.id !== id);
    renderTimeline();
    renderMarkers();
    showToast("Marker deleted.");
    window.orgavoxRecordHistory?.();
  }

  function clearMarkers() {
    if (!markerState().length) return;
    if (!confirm("Clear all markers?")) return;
    state.markers = [];
    renderTimeline();
    renderMarkers();
    window.orgavoxRecordHistory?.();
  }

  function beatsForClip(clip) {
    const buffer = clipBuffer(clip);
    if (!buffer) return [];
    const channel = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const startSample = Math.max(0, Math.floor((Number(clip.sourceStart) || 0) * sampleRate));
    const endSample = Math.min(channel.length, Math.floor((Number(clip.sourceEnd) || buffer.duration) * sampleRate));
    if (endSample <= startSample) return [];
    const hop = Math.max(256, Math.floor(sampleRate * 0.025));
    const win = Math.max(512, Math.floor(sampleRate * 0.05));
    const frames = [];
    for (let cursor = startSample; cursor < endSample; cursor += hop) {
      let sum = 0;
      let count = 0;
      const stop = Math.min(endSample, cursor + win);
      for (let i = cursor; i < stop; i += 1) {
        const value = channel[i] || 0;
        sum += value * value;
        count += 1;
      }
      const rms = Math.sqrt(sum / Math.max(1, count));
      frames.push({ sample: cursor, rms });
    }
    if (frames.length < 3) return [];
    const avg = frames.reduce((sum, frame) => sum + frame.rms, 0) / frames.length;
    const max = Math.max(...frames.map((frame) => frame.rms));
    const threshold = Math.max(avg * 1.55, max * 0.28, 0.025);
    const output = [];
    let lastTime = -999;
    const stretch = Math.max(0.0001, (clip.stretchDuration || bufferDuration(clip)) / Math.max(0.0001, bufferDuration(clip)));
    for (let i = 1; i < frames.length - 1; i += 1) {
      const frame = frames[i];
      if (frame.rms < threshold || frame.rms < frames[i - 1].rms || frame.rms < frames[i + 1].rms) continue;
      const sourceSeconds = frame.sample / sampleRate;
      const localSeconds = Math.max(0, sourceSeconds - (Number(clip.sourceStart) || 0)) * stretch;
      const timelineTime = Math.max(0, (Number(clip.start) || 0) + localSeconds);
      if (timelineTime - lastTime < 0.18) continue;
      output.push(timelineTime);
      lastTime = timelineTime;
      if (output.length > 240) break;
    }
    return output;
  }

  function addBeatMarkers() {
    const track = Math.max(0, Math.min(9, Number(state.selectedTrack) || 0));
    const clips = state.clips.filter((clip) => Number(clip.track) === track).sort((a, b) => a.start - b.start);
    if (!clips.length) return showToast(`Track ${track + 1} has no clips to scan.`);
    const times = [];
    clips.forEach((clip) => times.push(...beatsForClip(clip)));
    const unique = [];
    times.sort((a, b) => a - b).forEach((time) => {
      if (!unique.some((item) => Math.abs(item - time) < 0.04)) unique.push(time);
    });
    if (!unique.length) return showToast("No clear beats found on the selected track.");
    const existing = beatState().filter((marker) => marker.track !== track);
    state.beatMarkers = existing.concat(unique.map((time) => ({ id: makeId("beat"), time, track })));
    renderTimeline();
    renderMarkers();
    showToast(`${unique.length} beat markers added to Track ${track + 1}.`);
    window.orgavoxRecordHistory?.();
  }

  function clearBeatMarkers() {
    const count = beatState().length;
    state.beatMarkers = [];
    renderTimeline();
    renderMarkers();
    showToast(count ? "Beat markers cleared." : "No beat markers to clear.");
    window.orgavoxRecordHistory?.();
  }

  async function copyMarkerList() {
    const text = markerState().map((marker) => `${formatTime(marker.time)}\t${marker.label}`).join("\n") || "No markers";
    try {
      await navigator.clipboard.writeText(text);
      showToast("Marker list copied.");
    } catch (error) {
      console.warn(error);
      showToast("Could not copy marker list.");
    }
  }

  function patchRender() {
    if (window.__orgavoxMarkersRenderPatched) return;
    window.__orgavoxMarkersRenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxMarkersRenderTimeline() {
      previousRenderTimeline();
      placeButton();
      renderMarkers();
    };
    ui.zoomSlider?.addEventListener("input", () => setTimeout(renderMarkers, 0));
    document.addEventListener("keydown", (event) => {
      if (event.key?.toLowerCase() !== "m" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target && /input|textarea|select/i.test(target.tagName || "")) return;
      event.preventDefault();
      markerState().push({ id: makeId("marker"), time: Math.max(0, Number(state.playhead) || 0), label: `Marker ${markerState().length + 1}`, color: activeColor });
      renderTimeline();
      renderMarkers();
      showToast("Marker added.");
      window.orgavoxRecordHistory?.();
    });
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  window.orgavoxPlaceMarkersButton = placeButton;
  window.orgavoxRenderMarkers = renderMarkers;
  window.orgavoxAddBeatMarkers = addBeatMarkers;
  window.orgavoxClearBeatMarkers = clearBeatMarkers;
  window.orgavoxPreviousMarker = previousMarker;
  window.orgavoxNextMarker = nextMarker;
  installStyles();
  ensureButton();
  ensureModal();
  ensureContextMenu();
  patchRender();
  renderMarkers();
  [150, 450, 1200].forEach((delay) => setTimeout(() => { placeButton(); renderMarkers(); }, delay));
})();