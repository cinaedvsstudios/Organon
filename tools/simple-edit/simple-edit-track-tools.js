"use strict";

(function installOrgavoxTrackTools() {
  const STYLE_ID = "orgavox-track-tools-style";
  const MENU_ID = "orgavoxTrackMenu";
  const TRACK_COUNT = 10;
  const COLOR_KEYS = ["cyan", "gold", "green", "purple", "red", "blue", "white"];
  const COLOR_MAP = {
    cyan: "#75b2de",
    gold: "#e0a360",
    green: "#4abe75",
    purple: "#b26dff",
    red: "#dc4840",
    white: "#f5f0db",
    blue: "#63b8ff"
  };

  function defaultTrack(index) {
    return { name: `Track ${index + 1}`, color: "cyan", muted: false, solo: false, volume: 100, pan: 0 };
  }

  function tracks() {
    if (!Array.isArray(state.trackSettings)) state.trackSettings = [];
    for (let index = 0; index < TRACK_COUNT; index += 1) {
      state.trackSettings[index] = { ...defaultTrack(index), ...(state.trackSettings[index] || {}) };
      state.trackSettings[index].name = String(state.trackSettings[index].name || `Track ${index + 1}`).slice(0, 48);
      state.trackSettings[index].color = COLOR_MAP[state.trackSettings[index].color] ? state.trackSettings[index].color : "cyan";
      state.trackSettings[index].muted = Boolean(state.trackSettings[index].muted);
      state.trackSettings[index].solo = Boolean(state.trackSettings[index].solo);
      state.trackSettings[index].volume = Math.max(0, Math.min(200, Number(state.trackSettings[index].volume) || 100));
      state.trackSettings[index].pan = Math.max(-100, Math.min(100, Number(state.trackSettings[index].pan) || 0));
    }
    state.trackSettings.length = TRACK_COUNT;
    return state.trackSettings;
  }

  function cssColor(index) {
    const setting = tracks()[index] || defaultTrack(index);
    return COLOR_MAP[setting.color] || COLOR_MAP.cyan;
  }

  function soloActive() { return tracks().some((track) => track.solo); }

  function isTrackAudible(index) {
    const setting = tracks()[index] || defaultTrack(index);
    if (typeof state.__orgavoxRenderTrackOnly === "number") return index === state.__orgavoxRenderTrackOnly;
    if (setting.muted) return false;
    return !soloActive() || setting.solo;
  }

  function trackGainValue(index) {
    const setting = tracks()[index] || defaultTrack(index);
    const audible = isTrackAudible(index) ? 1 : 0;
    return audible * Math.max(0, Math.min(2, setting.volume / 100));
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .track-label{position:relative;display:grid!important;grid-template-columns:auto 1fr auto!important;grid-template-rows:1fr auto!important;gap:4px 7px!important;align-items:center!important;padding:9px 8px!important;overflow:visible!important;transition:min-height .18s ease,height .18s ease!important}
      body.simple-edit-phase1 .track-label .orgavox-track-index{grid-column:1;grid-row:1 / span 2;display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:rgba(0,0,0,.25);color:#f8d792;font:900 .68rem var(--font-mono)}
      body.simple-edit-phase1 .track-label .orgavox-track-name{grid-column:2;grid-row:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f5f0db;font:900 .68rem var(--font-body)!important;letter-spacing:.035em}
      body.simple-edit-phase1 .orgavox-track-mini{grid-column:2 / span 2;grid-row:2;display:flex;align-items:center;gap:5px;min-width:0}
      body.simple-edit-phase1 .orgavox-track-mix-btn,body.simple-edit-phase1 .orgavox-track-info-btn{min-width:26px!important;height:22px!important;min-height:22px!important;padding:0 6px!important;border:1px solid rgba(137,107,73,.58);border-radius:7px;background:rgba(0,0,0,.28);color:#d7c5a1;font:900 .54rem var(--font-mono);letter-spacing:.04em;cursor:pointer}
      body.simple-edit-phase1 .orgavox-track-info-btn{min-width:24px!important;width:24px!important;padding:0!important;border-color:rgba(74,190,117,.9)!important;background:linear-gradient(180deg,rgba(34,126,66,.95),rgba(12,58,31,.98))!important;color:#e4ffed!important;box-shadow:0 0 10px rgba(74,190,117,.24)!important}
      body.simple-edit-phase1 .orgavox-track-mix-btn.active{border-color:rgba(117,178,222,.88);background:linear-gradient(180deg,rgba(41,111,166,.88),rgba(14,49,91,.94));color:#eaf7ff;box-shadow:0 0 10px rgba(117,178,222,.18)}
      body.simple-edit-phase1 .orgavox-track-mix-btn.mute.active{border-color:rgba(220,72,64,.86);background:linear-gradient(180deg,rgba(105,38,35,.88),rgba(42,15,14,.95));color:#ffd8d2}
      body.simple-edit-phase1 .orgavox-track-menu-btn{grid-column:3;grid-row:1;min-width:25px!important;width:25px!important;height:25px!important;min-height:25px!important;padding:0!important;border:1px solid rgba(224,163,96,.55);border-radius:8px;background:rgba(0,0,0,.24);color:#ffe4a8;font:900 .76rem var(--font-mono);cursor:pointer}
      body.simple-edit-phase1 .track-label[data-track-color="gold"]{box-shadow:inset 4px 0 #e0a360}
      body.simple-edit-phase1 .track-label[data-track-color="cyan"]{box-shadow:inset 4px 0 #75b2de}
      body.simple-edit-phase1 .track-label[data-track-color="green"]{box-shadow:inset 4px 0 #4abe75}
      body.simple-edit-phase1 .track-label[data-track-color="purple"]{box-shadow:inset 4px 0 #b26dff}
      body.simple-edit-phase1 .track-label[data-track-color="red"]{box-shadow:inset 4px 0 #dc4840}
      body.simple-edit-phase1 .track-label[data-track-color="white"]{box-shadow:inset 4px 0 #f5f0db}
      body.simple-edit-phase1 .track-label.orgavox-track-muted,body.simple-edit-phase1 .track-label.orgavox-track-excluded,body.simple-edit-phase1 .track-lane.orgavox-track-muted,body.simple-edit-phase1 .track-lane.orgavox-track-excluded{filter:grayscale(1);opacity:.48}
      body.simple-edit-phase1 .track-lane{position:relative;transition:min-height .18s ease,height .18s ease!important}
      body.simple-edit-phase1 .track-lane::after{content:"";position:absolute;inset:0 0 auto 0;height:2px;background:var(--orgavox-track-color, rgba(117,178,222,.2));opacity:.55;pointer-events:none}
      body.simple-edit-phase1 .track-lane.orgavox-expanded-track{min-height:186px!important;height:186px!important;background:linear-gradient(90deg,rgba(80,172,255,.22),rgba(117,178,222,.1))!important;box-shadow:inset 0 0 0 2px rgba(117,178,222,.82),inset 0 0 30px rgba(75,155,255,.3)!important}
      body.simple-edit-phase1 .track-label.orgavox-expanded-track-label{min-height:186px!important;height:186px!important;background:rgba(117,178,222,.12)!important}
      .orgavox-track-menu{position:fixed;z-index:3600;min-width:210px;padding:8px;border:1px solid rgba(224,163,96,.62);border-radius:14px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);display:grid;gap:6px}
      .orgavox-track-menu[hidden]{display:none}
      .orgavox-track-menu button{width:100%;justify-content:flex-start!important;min-height:32px!important}
      .orgavox-track-menu .danger{border-color:rgba(220,72,64,.72)!important;color:#ffd8d2!important}
      .orgavox-track-color-row{display:flex;gap:6px;padding:5px 3px 3px;flex-wrap:wrap}
      .orgavox-track-color-dot{width:22px!important;height:22px!important;min-height:22px!important;min-width:22px!important;border-radius:999px!important;padding:0!important;border:1px solid rgba(245,240,219,.38)!important;background:#75b2de}
      .orgavox-track-color-dot[data-color="gold"]{background:#e0a360}.orgavox-track-color-dot[data-color="green"]{background:#4abe75}.orgavox-track-color-dot[data-color="purple"]{background:#b26dff}.orgavox-track-color-dot[data-color="red"]{background:#dc4840}.orgavox-track-color-dot[data-color="white"]{background:#f5f0db}.orgavox-track-color-dot[data-color="blue"]{background:#63b8ff}
    `;
    document.head.appendChild(style);
  }

  function ensureMenu() {
    let menu = document.getElementById(MENU_ID);
    if (menu) return menu;
    menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.className = "orgavox-track-menu";
    menu.hidden = true;
    document.body.appendChild(menu);
    document.addEventListener("click", (event) => { if (!event.target.closest(`#${MENU_ID}`) && !event.target.closest(".orgavox-track-menu-btn")) closeMenu(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
    return menu;
  }

  function closeMenu() { const menu = document.getElementById(MENU_ID); if (menu) menu.hidden = true; }

  function showMenu(index, anchor) {
    const menu = ensureMenu();
    const setting = tracks()[index];
    menu.dataset.track = String(index);
    menu.innerHTML = `
      <button class="tool-button" data-action="move" type="button">↕ Move to number…</button>
      <button class="tool-button" data-action="rename" type="button">✎ Rename track</button>
      <button class="tool-button" data-action="volume" type="button">🔊 Track volume / pan…</button>
      <button class="tool-button" data-action="clear" type="button">🧹 Clear track</button>
      <button class="tool-button" data-action="download" type="button">⬇ Download single track</button>
      <button class="tool-button" data-action="duplicate" type="button">⧉ Duplicate track…</button>
      <button class="tool-button" data-action="reverse" type="button">↩ Reverse track</button>
      <button class="tool-button" data-action="stretch" type="button">↔ Stretch track…</button>
      <button class="tool-button" data-action="expand" type="button">▣ Expand track</button>
      <div class="orgavox-track-color-row" aria-label="Waveform colour">${Object.keys(COLOR_MAP).map((color) => `<button class="orgavox-track-color-dot${setting.color === color ? " active" : ""}" data-color="${color}" type="button" title="${color}"></button>`).join("")}</div>
    `;
    menu.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => runMenuAction(index, button.dataset.action)));
    menu.querySelectorAll("[data-color]").forEach((button) => button.addEventListener("click", () => { setting.color = button.dataset.color; closeMenu(); touch(); }));
    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.min(window.innerWidth - 225, Math.max(8, rect.right + 7))}px`;
    menu.style.top = `${Math.min(window.innerHeight - 360, Math.max(8, rect.top))}px`;
    menu.hidden = false;
  }

  function runMenuAction(index, action) {
    closeMenu();
    if (action === "move") moveTrackPrompt(index);
    if (action === "rename") renameTrack(index);
    if (action === "volume") volumePanPrompt(index);
    if (action === "clear") clearTrack(index);
    if (action === "download") downloadSingleTrack(index);
    if (action === "duplicate") duplicateTrackPrompt(index);
    if (action === "reverse") reverseTrack(index);
    if (action === "stretch") stretchTrackPrompt(index);
    if (action === "expand") expandTrack(index);
  }

  function analyzeTrack(index) {
    state.selectedTrack = Math.max(0, Math.min(TRACK_COUNT - 1, Number(index) || 0));
    const clip = state.clips.find((item) => Number(item.track) === state.selectedTrack);
    if (clip && typeof selectClip === "function") selectClip(clip.id);
    if (typeof selectTrack === "function") selectTrack(state.selectedTrack);
    const modal = document.getElementById("analysisModal");
    if (!modal) return showToast("Analyze panel is still loading.");
    modal.hidden = false;
    setTimeout(() => modal.querySelector("[data-analysis-scan]")?.click(), 0);
    showToast(`Analyzing Track ${state.selectedTrack + 1}.`);
  }

  function refreshTrackLabels() {
    const settings = tracks();
    const anySolo = soloActive();
    ui.trackLabels = [...document.querySelectorAll(".track-label")];
    ui.lanes = [...document.querySelectorAll(".track-lane")];

    ui.trackLabels.forEach((label) => {
      const index = Number(label.dataset.trackLabel);
      if (!Number.isFinite(index) || index < 0 || index >= TRACK_COUNT) return;
      const setting = settings[index];
      label.dataset.trackColor = setting.color;
      label.classList.toggle("orgavox-track-muted", setting.muted);
      label.classList.toggle("orgavox-track-excluded", anySolo && !setting.solo);
      label.classList.toggle("orgavox-expanded-track-label", state.expandedTrack === index);

      label.innerHTML = `
        <span class="orgavox-track-index">${index + 1}</span>
        <strong class="orgavox-track-name" title="${escapeHtml(setting.name)}">${escapeHtml(setting.name)}</strong>
        <button class="orgavox-track-menu-btn" type="button" title="Track menu">⋯</button>
        <span class="orgavox-track-mini">
          <button class="orgavox-track-mix-btn mute${setting.muted ? " active" : ""}" type="button" title="Mute track">M</button>
          <button class="orgavox-track-mix-btn solo${setting.solo ? " active" : ""}" type="button" title="Solo track">S</button>
          <button class="orgavox-track-info-btn" type="button" title="Analyze Track ${index + 1}">i</button>
          <span style="color:${cssColor(index)};font:800 .54rem var(--font-mono);">${setting.volume}% ${setting.pan ? `PAN ${setting.pan}` : ""}</span>
        </span>
      `;
      label.querySelector(".orgavox-track-menu-btn")?.addEventListener("click", (event) => { event.stopPropagation(); showMenu(index, event.currentTarget); });
      label.querySelector(".mute")?.addEventListener("click", (event) => { event.stopPropagation(); setting.muted = !setting.muted; stopPlayback(); touch(); });
      label.querySelector(".solo")?.addEventListener("click", (event) => { event.stopPropagation(); setting.solo = !setting.solo; stopPlayback(); touch(); });
      label.querySelector(".orgavox-track-info-btn")?.addEventListener("click", (event) => { event.stopPropagation(); analyzeTrack(index); });
    });

    ui.lanes.forEach((lane) => {
      const index = Number(lane.dataset.track);
      const setting = settings[index] || defaultTrack(index);
      lane.style.setProperty("--orgavox-track-color", cssColor(index));
      lane.classList.toggle("orgavox-track-muted", setting.muted);
      lane.classList.toggle("orgavox-track-excluded", anySolo && !setting.solo);
      lane.classList.toggle("orgavox-expanded-track", state.expandedTrack === index);
    });
    placeViewMenuTools();
  }

  function touch(message) {
    state.renderCache?.clear?.();
    refreshTrackLabels();
    renderTimeline();
    applyTrackView();
    if (message) showToast(message);
    window.orgavoxRecordHistory?.();
  }

  function moveTrackPrompt(index) {
    const raw = prompt("Move this track to number", String(index + 1));
    if (raw == null) return;
    const target = Math.max(0, Math.min(TRACK_COUNT - 1, Math.round(Number(raw) || index + 1) - 1));
    if (target === index) return;
    moveTrack(index, target);
  }

  function moveTrack(from, to) {
    const settings = tracks();
    const mapping = new Map();
    for (let i = 0; i < TRACK_COUNT; i += 1) mapping.set(i, i);
    if (from < to) for (let i = from + 1; i <= to; i += 1) mapping.set(i, i - 1);
    else for (let i = to; i < from; i += 1) mapping.set(i, i + 1);
    mapping.set(from, to);
    const moving = settings.splice(from, 1)[0];
    settings.splice(to, 0, moving);
    state.clips.forEach((clip) => { if (mapping.has(clip.track)) clip.track = mapping.get(clip.track); });
    state.selectedTrack = mapping.get(state.selectedTrack) ?? state.selectedTrack;
    if (typeof state.expandedTrack === "number") state.expandedTrack = mapping.get(state.expandedTrack) ?? state.expandedTrack;
    touch(`Track ${from + 1} moved to ${to + 1}.`);
  }

  function renameTrack(index) {
    const setting = tracks()[index];
    const next = prompt("Track name", setting.name);
    if (next == null) return;
    setting.name = next.trim().slice(0, 48) || setting.name;
    touch("Track renamed.");
  }

  function volumePanPrompt(index) {
    const setting = tracks()[index];
    const nextVolume = prompt("Track volume 0–200", String(setting.volume));
    if (nextVolume == null) return;
    const nextPan = prompt("Track pan -100 left to 100 right", String(setting.pan));
    if (nextPan == null) return;
    setting.volume = Math.max(0, Math.min(200, Number(nextVolume) || 0));
    setting.pan = Math.max(-100, Math.min(100, Number(nextPan) || 0));
    stopPlayback();
    touch("Track volume / pan updated.");
  }

  function clearTrack(index) {
    if (!state.clips.some((clip) => clip.track === index)) return showToast("That track is already empty.");
    if (!confirm(`Clear ${tracks()[index].name}?`)) return;
    stopPlayback();
    state.clips = state.clips.filter((clip) => clip.track !== index);
    if (selectedClip()?.track === index) state.selectedClipId = null;
    syncSelectedControls();
    touch("Track cleared.");
  }

  function duplicateTrackPrompt(index) {
    const raw = prompt("Duplicate to track number", String(Math.min(TRACK_COUNT, index + 2)));
    if (raw == null) return;
    const target = Math.max(0, Math.min(TRACK_COUNT - 1, Math.round(Number(raw) || index + 2) - 1));
    if (target === index) return showToast("Pick a different track.");
    if (state.clips.some((clip) => clip.track === target) && !confirm(`Track ${target + 1} already has clips. Add duplicates there anyway?`)) return;
    const sourceSetting = tracks()[index];
    state.trackSettings[target] = { ...sourceSetting, name: `${sourceSetting.name} copy` };
    const copies = state.clips.filter((clip) => clip.track === index).map((clip) => ({ ...clip, id: makeId("clip"), track: target, cacheVersion: 0, volumeKeyframes: Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes.map((keyframe) => ({ ...keyframe, id: makeId("kf") })) : [] }));
    state.clips.push(...copies);
    touch(`Track duplicated to ${target + 1}.`);
  }

  function reverseTrack(index) {
    const clips = state.clips.filter((clip) => clip.track === index);
    if (!clips.length) return showToast("That track has no clips.");
    const next = !clips.every((clip) => clip.reverseAudio);
    clips.forEach((clip) => { clip.reverseAudio = next; invalidateClip(clip); });
    touch(next ? "Track reversed." : "Track un-reversed.");
  }

  function stretchTrackPrompt(index) {
    const raw = prompt("Stretch track clips by percent", "100");
    if (raw == null) return;
    const factor = Math.max(5, Math.min(800, Number(raw) || 100)) / 100;
    const clips = state.clips.filter((clip) => clip.track === index);
    if (!clips.length) return showToast("That track has no clips.");
    clips.forEach((clip) => { const base = Math.max(.01, clip.stretchDuration || bufferDuration(clip)); clip.stretchDuration = Math.max(.05, base * factor); invalidateClip(clip); });
    touch(`Track stretched to ${Math.round(factor * 100)}%.`);
  }

  function randomizeTrackColors() {
    const palette = COLOR_KEYS.filter((color) => color !== "white");
    tracks().forEach((track, index) => { track.color = palette[(index + Math.floor(Math.random() * palette.length)) % palette.length]; });
    touch("Track colors randomized.");
  }

  function expandTrack(index = state.selectedTrack) {
    state.expandedTrack = Math.max(0, Math.min(TRACK_COUNT - 1, Number(index) || 0));
    applyTrackView();
    touch(`Track ${state.expandedTrack + 1} expanded.`);
  }

  function resetTrackView() {
    state.expandedTrack = null;
    applyTrackView();
    touch("Track view reset.");
  }

  function applyTrackView() {
    document.querySelectorAll(".track-lane").forEach((lane) => lane.classList.toggle("orgavox-expanded-track", Number(lane.dataset.track) === state.expandedTrack));
    document.querySelectorAll(".track-label").forEach((label) => label.classList.toggle("orgavox-expanded-track-label", Number(label.dataset.trackLabel) === state.expandedTrack));
  }

  async function renderSingleTrack(index) {
    const clips = state.clips.filter((clip) => clip.track === index);
    if (!clips.length) throw new Error("That track has no clips to render.");
    const sampleRate = 44100;
    const duration = Math.max(.1, ...clips.map((clip) => clip.start + clipDuration(clip) + (clip.echo > 0 ? 1.5 : 0)));
    const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineAudioContextClass) throw new Error("Offline audio rendering is unavailable in this browser.");
    const offline = new OfflineAudioContextClass(2, Math.ceil(duration * sampleRate), sampleRate);
    const compressor = offline.createDynamicsCompressor();
    compressor.threshold.value = -2; compressor.knee.value = 8; compressor.ratio.value = 4; compressor.attack.value = .003; compressor.release.value = .2; compressor.connect(offline.destination);
    state.__orgavoxRenderTrackOnly = index;
    try {
      for (const clip of clips) {
        const buffer = await processedClipBuffer(clip);
        if (!buffer) continue;
        const source = offline.createBufferSource();
        source.buffer = buffer;
        connectClipNodes(offline, source, clip, compressor);
        source.start(clip.start);
      }
      return await offline.startRendering();
    } finally { delete state.__orgavoxRenderTrackOnly; }
  }

  async function downloadSingleTrack(index) {
    try {
      stopPlayback();
      setStatus(`Rendering ${tracks()[index].name}…`);
      const formatRaw = prompt("Download format: wav or mp3", "wav");
      if (formatRaw == null) return;
      const format = /^mp3$/i.test(formatRaw.trim()) ? "mp3" : "wav";
      const rendered = await renderSingleTrack(index);
      const filename = `${safeFilename(tracks()[index].name || `track-${index + 1}`)}.${format}`;
      const blob = format === "mp3" ? audioBufferToMp3(rendered, 192) : audioBufferToWav(rendered);
      downloadBlob(blob, filename);
      setStatus("Ready");
      showToast(`${filename} downloaded.`);
    } catch (error) {
      console.error(error);
      setStatus("Track download failed");
      showToast(error.message || "Track could not be downloaded.");
    }
  }

  function viewButton(id, label, title, handler) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "tool-button";
      button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); document.querySelectorAll(".orgavox-view-menu").forEach((menu) => { menu.hidden = true; }); handler(); });
    }
    button.textContent = label;
    button.title = title;
    return button;
  }

  function placeViewMenuTools() {
    const panel = document.querySelector("#orgavoxViewDropdown .orgavox-view-menu");
    if (!panel) return;
    const addBeat = viewButton("orgavoxAddBeatMarkersBtn", "▏ Add Beat Markers", "Add magenta beat markers from the selected track", () => window.orgavoxAddBeatMarkers?.());
    const clearBeat = viewButton("orgavoxClearBeatMarkersBtn", "▏ Clear Beat Markers", "Clear magenta beat markers", () => window.orgavoxClearBeatMarkers?.());
    const colors = viewButton("orgavoxRandomizeTrackColorsBtn", "🎨 Randomize Track Colors", "Assign different colors across tracks", randomizeTrackColors);
    const expand = viewButton("orgavoxExpandTrackBtn", "▣ Expand Track", "Make selected track three rows tall", () => expandTrack(state.selectedTrack));
    const reset = viewButton("orgavoxResetTrackViewBtn", "▢ Reset Track View", "Restore normal track heights", resetTrackView);
    [addBeat, clearBeat, colors, expand, reset].forEach((button) => { if (button.parentElement !== panel) panel.appendChild(button); });
  }

  function patchAudioRouting() {
    if (window.__orgavoxTrackAudioPatched || typeof connectClipNodes !== "function") return;
    window.__orgavoxTrackAudioPatched = true;
    const previousConnectClipNodes = connectClipNodes;
    connectClipNodes = function orgavoxTrackConnectClipNodes(context, source, clip, destination) {
      const index = Math.max(0, Math.min(TRACK_COUNT - 1, Number(clip.track) || 0));
      const gain = context.createGain();
      gain.gain.value = trackGainValue(index);
      let input = gain;
      if (context.createStereoPanner) {
        const pan = context.createStereoPanner();
        pan.pan.value = Math.max(-1, Math.min(1, (tracks()[index].pan || 0) / 100));
        pan.connect(gain);
        input = pan;
      }
      gain.connect(destination);
      return previousConnectClipNodes(context, source, clip, input);
    };
  }

  function patchWaveformColor() {
    if (window.__orgavoxTrackWaveformPatched || typeof drawClipWaveform !== "function") return;
    window.__orgavoxTrackWaveformPatched = true;
    const previousDrawClipWaveform = drawClipWaveform;
    drawClipWaveform = function orgavoxTrackDrawClipWaveform(canvas, clip) {
      const result = previousDrawClipWaveform(canvas, clip);
      try {
        const ctx = canvas.getContext("2d");
        ctx.save();
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = clip.id === state.selectedClipId ? "#ffe4a8" : cssColor(clip.track);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      } catch (error) { console.warn("Could not recolour clip waveform.", error); }
      return result;
    };
  }

  function patchRender() {
    if (window.__orgavoxTrackRenderPatched) return;
    window.__orgavoxTrackRenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxTrackRenderTimeline() {
      const result = previousRenderTimeline.apply(this, arguments);
      refreshTrackLabels();
      applyTrackView();
      return result;
    };
  }

  function init() {
    installStyles();
    tracks();
    patchAudioRouting();
    patchWaveformColor();
    patchRender();
    refreshTrackLabels();
    setTimeout(refreshTrackLabels, 0);
    [200, 600, 1200, 2200].forEach((delay) => setTimeout(() => { refreshTrackLabels(); placeViewMenuTools(); applyTrackView(); }, delay));
  }

  window.orgavoxRefreshTrackTools = refreshTrackLabels;
  window.orgavoxTrackSettings = tracks;
  window.orgavoxRandomizeTrackColors = randomizeTrackColors;
  window.orgavoxExpandSelectedTrack = () => expandTrack(state.selectedTrack);
  window.orgavoxResetTrackView = resetTrackView;
  window.orgavoxApplyTrackView = applyTrackView;
  window.orgavoxPlaceViewMenuTrackTools = placeViewMenuTools;
  init();
})();