"use strict";

(async () => {
  const VERSION = "v1.05";
  const REMOTE_SOUND_FX = "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/";
  const LOCAL_SOUND_FX = "./soundeffects/";
  window.ORGAVOX_VERSION = VERSION;
  document.documentElement.classList.add("orgavox-loading");

  function setVersion() {
    document.title = `Organon — ORGAVOX ${VERSION}`;
    const title = document.querySelector(".brand h1");
    if (title) {
      let badge = title.querySelector(".simple-edit-version");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "simple-edit-version phase1-version";
        title.appendChild(document.createTextNode(" "));
        title.appendChild(badge);
      }
      if (title.firstChild?.nodeType === Node.TEXT_NODE) title.firstChild.textContent = "ORGAVOX ";
      badge.textContent = VERSION;
    }
    document.querySelectorAll(".simple-edit-version,.phase1-version,.orgavox-sidebar-version").forEach((node) => { node.textContent = VERSION; });
  }

  function localizeSoundFxUrl(value) {
    const text = String(value || "");
    return text.startsWith(REMOTE_SOUND_FX) ? `${LOCAL_SOUND_FX}${text.slice(REMOTE_SOUND_FX.length)}` : value;
  }

  function installLocalSoundFxRouting() {
    if (!window.__orgavoxLocalSoundFxFetchPatched) {
      window.__orgavoxLocalSoundFxFetchPatched = true;
      const originalFetch = window.fetch?.bind(window);
      if (originalFetch) {
        window.fetch = function orgavoxSoundFxFetch(resource, init) {
          if (typeof resource === "string") return originalFetch(localizeSoundFxUrl(resource), init);
          if (resource && typeof resource.url === "string") {
            const localized = localizeSoundFxUrl(resource.url);
            if (localized !== resource.url) return originalFetch(localized, init);
          }
          return originalFetch(resource, init);
        };
      }
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.appendChild(script);
    });
  }

  installLocalSoundFxRouting();
  const files = [
    "./simple-edit-core.js?v=1.05", "./simple-edit-timeline.js?v=1.05", "./simple-edit-audio.js?v=0.26", "./simple-edit-export.js?v=0.02", "./simple-edit-phase1.js?v=0.33",
    "./simple-edit-keyframes.js?v=0.10", "./simple-edit-keyframes-fix.js?v=0.11", "./simple-edit-phase3.js?v=0.13", "./simple-edit-effects-library.js?v=0.15", "./simple-edit-echo-settings.js?v=1.04",
    "./simple-edit-stretch-audiotsm.js?v=0.19", "./simple-edit-fade-handles.js?v=0.20", "./simple-edit-normalize.js?v=0.21", "./simple-edit-transpose-engine.js?v=0.26", "./simple-edit-transpose.js?v=0.26",
    "./simple-edit-eq-engine.js?v=0.28", "./simple-edit-eq.js?v=0.28", "./simple-edit-drive-engine.js?v=0.29", "./simple-edit-drive.js?v=0.29", "./simple-edit-dynamics-engine.js?v=0.30", "./simple-edit-dynamics.js?v=0.30",
    "./simple-edit-stereo-engine.js?v=0.35", "./simple-edit-stereo.js?v=0.35", "./simple-edit-lofi-engine.js?v=0.37", "./simple-edit-lofi.js?v=0.37", "./simple-edit-render-tools-engine.js?v=0.38", "./simple-edit-render-tools.js?v=1.04",
    "./simple-edit-analysis.js?v=0.40", "./simple-edit-project.js?v=0.49", "./simple-edit-markers.js?v=1.04", "./simple-edit-undo-redo.js?v=1.04", "./simple-edit-track-tools.js?v=1.04", "./simple-edit-clip-menu.js?v=0.46", "./simple-edit-snap-tools.js?v=1.04", "./simple-edit-library-tools.js?v=0.48", "./simple-edit-build6.js?v=0.49"
  ];

  for (const source of files) await loadScript(source);

  function installVisibleUiOwner() {
    const STYLE_ID = "orgavox-visible-ui-owner-v105";
    const SNAP_VALUES = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
    let clipboard = [];
    let numberPop = null;

    function installStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const node = document.createElement("style");
      node.id = STYLE_ID;
      node.textContent = `
        @keyframes orgavoxPlayPulse{from{transform:scale(1);filter:brightness(1);box-shadow:0 0 0 1px rgba(117,178,222,.35),0 0 12px rgba(75,155,255,.28)}to{transform:scale(1.13);filter:brightness(1.25);box-shadow:0 0 0 1px rgba(168,220,255,.8),0 0 26px rgba(75,155,255,.68)}}
        .topbar{align-items:center!important;gap:14px!important;flex-wrap:wrap!important}.orgavox-main-controls-group,.orgavox-transport-group,.orgavox-edit-group{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important}.orgavox-edit-group{flex:1 1 100%;border-top:1px solid rgba(137,107,73,.32);padding-top:8px}.orgavox-edit-dropdown,.orgavox-view-dropdown,.orgavox-effects-dropdown{position:relative;display:inline-flex}.orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu{position:absolute;top:calc(100% + 8px);left:0;z-index:4300;min-width:225px;display:grid;gap:6px;padding:8px;border:1px solid rgba(224,163,96,.65);border-radius:14px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72)}.orgavox-edit-menu[hidden],.orgavox-view-menu[hidden],.orgavox-effects-menu[hidden]{display:none!important}.orgavox-edit-menu .tool-button,.orgavox-view-menu .tool-button,.orgavox-effects-menu .tool-button{width:100%;justify-content:flex-start;min-height:32px}.orgavox-edit-button{border-color:rgba(224,163,96,.82)!important;background:linear-gradient(180deg,rgba(93,67,35,.88),rgba(34,23,13,.95))!important;color:#ffe4a8!important}.orgavox-view-button{border-color:rgba(117,178,222,.86)!important;background:linear-gradient(180deg,rgba(35,80,124,.95),rgba(14,38,72,.98))!important;color:#e1f7ff!important}.orgavox-effects-dropdown-button,.orgavox-marker-nav,#markersBtn{border-color:rgba(178,109,255,.84)!important;background:linear-gradient(180deg,rgba(87,45,155,.92),rgba(40,21,82,.96))!important;color:#f4e2ff!important}.orgavox-nudge-button,.orgavox-snap-button,.orgavox-align-button{border-color:rgba(117,178,222,.76)!important;background:linear-gradient(180deg,rgba(33,80,122,.86),rgba(13,35,61,.95))!important;color:#dff5ff!important}.orgavox-snap-button.active{border-color:rgba(248,215,146,.92)!important;background:linear-gradient(180deg,rgba(129,85,31,.92),rgba(55,34,13,.96))!important;color:#fff0bd!important}#snapGridSelect{height:34px;border:1px solid rgba(117,178,222,.72);border-radius:10px;background:#050505;color:#f5f0db;font:900 .62rem var(--font-mono)}#snapGridSelect option{background:#050505;color:#f5f0db}.orgavox-open-button{border-color:rgba(117,178,222,.92)!important;background:linear-gradient(180deg,rgba(57,132,205,.96),rgba(31,77,133,.94))!important;color:#eef8ff!important}.orgavox-save-button{border-color:rgba(74,190,117,.86)!important;background:linear-gradient(180deg,rgba(35,118,66,.92),rgba(14,62,35,.94))!important;color:#e2ffe9!important}.orgavox-snip-tool,.orgavox-danger-tool,.orgavox-cut-clip-btn{border-color:rgba(220,72,64,.78)!important;background:linear-gradient(180deg,rgba(92,28,23,.88),rgba(39,13,10,.96))!important;color:#ffd8d2!important}.orgavox-global-volume-control,.orgavox-echo-control,.zoom-control{display:grid!important;grid-template-columns:auto minmax(82px,1fr) 48px 34px!important;align-items:center!important;gap:7px!important;min-width:230px!important}.orgavox-global-volume-control{grid-template-columns:auto minmax(82px,1fr) 48px!important}.echo-settings-btn,#fullscreenBtn{width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;padding:0!important}.echo-settings-btn{border-color:rgba(117,178,222,.86)!important;background:linear-gradient(180deg,rgba(32,82,125,.94),rgba(13,38,66,.96))!important;color:#e1f7ff!important}output,.time-readout{cursor:pointer}#playBtn.orgavox-playing{animation:orgavoxPlayPulse .72s ease-in-out infinite alternate!important;transform-origin:center!important}.orgavox-number-pop,.orgavox-track-number-pop{position:fixed;z-index:999999;min-width:138px;padding:8px;border:1px solid rgba(224,163,96,.72);border-radius:12px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);display:grid;gap:6px}.orgavox-number-pop label,.orgavox-track-number-pop label{color:rgba(245,240,219,.72);font:800 .56rem var(--font-mono);text-transform:uppercase;letter-spacing:.08em}.orgavox-number-pop input,.orgavox-track-number-pop input{height:34px;border:1px solid rgba(117,178,222,.64);border-radius:9px;background:#050505;color:#f5f0db;padding:0 9px;font:900 .78rem var(--font-mono)}.track-label{display:grid!important;grid-template-columns:26px minmax(84px,1fr) 26px!important;grid-template-rows:auto auto!important;gap:4px 7px!important;align-items:center!important;padding:8px!important;min-height:64px!important;box-shadow:inset 4px 0 var(--orgavox-track-color,#75b2de)!important}.orgavox-track-index{grid-column:1;grid-row:1/span 2;display:grid;place-items:center;width:24px;height:24px;border:1px solid rgba(224,163,96,.72);border-radius:999px;color:#f8d792}.orgavox-track-name{grid-column:2;grid-row:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f5f0db;font:900 .72rem var(--font-body)}.orgavox-track-menu-btn{grid-column:3;grid-row:1;width:25px;height:25px;padding:0}.orgavox-track-mini{grid-column:2/span 2;grid-row:2;display:flex;align-items:center;gap:5px}.orgavox-track-mix-btn,.orgavox-track-info-btn,.orgavox-track-volume-pill{height:22px;min-height:22px;border-radius:7px;font:900 .54rem var(--font-mono);cursor:pointer}.orgavox-track-mix-btn.mute{border-color:rgba(220,72,64,.5);color:#ffd8d2}.orgavox-track-mix-btn.solo{border-color:rgba(224,163,96,.56);color:#ffe4a8}.orgavox-track-mix-btn.mute.active{background:linear-gradient(180deg,rgba(105,38,35,.92),rgba(42,15,14,.96));border-color:rgba(220,72,64,.95);color:#ffd8d2}.orgavox-track-mix-btn.solo.active{background:linear-gradient(180deg,rgba(122,83,32,.94),rgba(48,29,11,.98));border-color:rgba(224,163,96,.95);color:#ffe4a8}.orgavox-track-info-btn{border-color:rgba(74,190,117,.9);background:linear-gradient(180deg,rgba(34,126,66,.95),rgba(12,58,31,.98));color:#e4ffed}.orgavox-track-volume-pill{border:1px solid rgba(224,163,96,.42);background:rgba(0,0,0,.36);color:#f8d792}.track-label.active{background:rgba(75,132,191,.16)!important;box-shadow:inset 4px 0 var(--orgavox-track-color,#75b2de),inset 0 0 0 2px rgba(117,178,222,.48)!important}.orgavox-track-volume-overlay{position:absolute;left:8px;top:8px;z-index:3;max-width:220px;padding:3px 8px;border:1px solid rgba(224,163,96,.42);border-radius:9px;background:rgba(0,0,0,.78);color:#f8d792;font:900 .58rem var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.orgavox-track-menu,.orgavox-marker-context{position:fixed;z-index:4300;min-width:210px;padding:8px;border:1px solid rgba(224,163,96,.62);border-radius:14px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);display:grid;gap:6px}.orgavox-track-menu[hidden],.orgavox-marker-context[hidden]{display:none!important}.orgavox-marker-layer{position:absolute;inset:0;pointer-events:none;z-index:7}.orgavox-marker-line,.orgavox-beat-line{position:absolute;top:0;bottom:0;width:2px;border:0;padding:0;background:#e0a360;pointer-events:auto}.orgavox-beat-line{width:1px;background:#ff4dff;opacity:.82;pointer-events:none}.orgavox-marker-tag{position:absolute;top:2px;left:4px;white-space:nowrap;background:rgba(0,0,0,.75);color:#f5f0db;border:1px solid rgba(224,163,96,.4);border-radius:8px;padding:2px 5px;font:800 .55rem var(--font-mono)}
      `;
      document.head.appendChild(node);
    }

    function button(id, text, cls = "tool-button") {
      let node = document.getElementById(id);
      if (!node) { node = document.createElement("button"); node.id = id; node.type = "button"; }
      node.className = cls;
      node.textContent = text;
      return node;
    }

    function menuButton(id, text, handler, cls = "tool-button") {
      const node = button(id, text, cls);
      if (!node.dataset.orgavoxActionWired) {
        node.dataset.orgavoxActionWired = "true";
        node.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); closeMenus(); handler?.(); });
      }
      return node;
    }

    function closeMenus() { document.querySelectorAll(".orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu").forEach((panel) => { panel.hidden = true; }); }

    function dropdown(id, wrapClass, buttonClass, menuClass, text) {
      let wrap = document.getElementById(id);
      if (!wrap) { wrap = document.createElement("div"); wrap.id = id; }
      wrap.className = wrapClass;
      let trigger = wrap.querySelector(`.${buttonClass}`);
      if (!trigger) { trigger = document.createElement("button"); trigger.type = "button"; wrap.appendChild(trigger); }
      trigger.className = `tool-button ${buttonClass}`;
      trigger.textContent = text;
      let menu = wrap.querySelector(`.${menuClass}`);
      if (!menu) { menu = document.createElement("div"); menu.className = menuClass; menu.hidden = true; wrap.appendChild(menu); }
      if (!trigger.dataset.orgavoxMenuWired) {
        trigger.dataset.orgavoxMenuWired = "true";
        trigger.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); const open = menu.hidden; closeMenus(); menu.hidden = !open; });
      }
      return { wrap, menu };
    }

    function appendOrdered(parent, nodes) {
      nodes.filter(Boolean).forEach((node) => parent.appendChild(node));
    }

    function selectedIds() {
      if (!Array.isArray(state.selectedClipIds)) state.selectedClipIds = state.selectedClipId ? [state.selectedClipId] : [];
      state.selectedClipIds = state.selectedClipIds.filter((id) => state.clips.some((clip) => clip.id === id));
      if (!state.selectedClipIds.length && state.selectedClipId) state.selectedClipIds = [state.selectedClipId];
      return state.selectedClipIds;
    }
    function selectedClips() { const ids = new Set(selectedIds()); return state.clips.filter((clip) => ids.has(clip.id)); }
    function copyClip() { const clips = selectedClips(); if (!clips.length) return showToast("Select a clip to copy."); const earliest = Math.min(...clips.map((clip) => Number(clip.start) || 0)); clipboard = clips.map((clip) => ({ ...clip, __relativeStart: (Number(clip.start) || 0) - earliest })); showToast(clips.length === 1 ? "Clip copied." : `${clips.length} clips copied.`); }
    function cutClip() { const clips = selectedClips(); if (!clips.length) return showToast("Select a clip to cut."); copyClip(); const ids = new Set(clips.map((clip) => clip.id)); state.clips = state.clips.filter((clip) => !ids.has(clip.id)); state.selectedClipId = null; state.selectedClipIds = []; syncSelectedControls(); renderTimeline(); window.orgavoxRecordHistory?.(); showToast("Clip cut."); }
    function pasteClip() { if (!clipboard.length) return showToast("No copied clip to paste."); const base = Math.max(0, Number(state.playhead) || 0); const pasted = clipboard.map((clip) => ({ ...clip, id: makeId("clip"), start: base + Math.max(0, Number(clip.__relativeStart) || 0), cacheVersion: 0 })); pasted.forEach((clip) => delete clip.__relativeStart); state.clips.push(...pasted); state.selectedClipId = pasted[pasted.length - 1]?.id || null; state.selectedClipIds = pasted.map((clip) => clip.id); renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); showToast("Clip pasted at the playhead."); }
    function clearAll() { if (!state.clips.length) return showToast("Timeline is already clear."); if (window.confirm && !confirm("Clear all clips from the timeline?")) return; state.clips = []; state.selectedClipId = null; state.selectedClipIds = []; syncSelectedControls(); renderTimeline(); window.orgavoxRecordHistory?.(); showToast("Timeline cleared."); }
    function deleteClips() { const clips = selectedClips(); if (!clips.length) return deleteSelectedClip?.(); const ids = new Set(clips.map((clip) => clip.id)); state.clips = state.clips.filter((clip) => !ids.has(clip.id)); state.selectedClipId = null; state.selectedClipIds = []; syncSelectedControls(); renderTimeline(); window.orgavoxRecordHistory?.(); showToast("Selected clip deleted."); }
    function sendToStart() { const clips = selectedClips(); if (!clips.length) return showToast("Select a clip to send to start."); const earliest = Math.min(...clips.map((clip) => Math.max(0, Number(clip.start) || 0))); clips.forEach((clip) => { clip.start = clips.length === 1 ? 0 : Math.max(0, (Number(clip.start) || 0) - earliest); }); renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); showToast("Sent to start."); }
    function analyze() { const clip = selectedClip() || state.clips.find((item) => Number(item.track) === Number(state.selectedTrack)) || state.clips[0]; if (!clip) return showToast("Select a clip or track to analyze."); selectClip(clip.id); const modal = document.getElementById("analysisModal"); if (!modal) return showToast("Analyze panel is still loading."); modal.hidden = false; setTimeout(() => modal.querySelector("[data-analysis-scan]")?.click(), 0); }

    function parseTime(text) {
      const value = String(text || "").trim();
      if (!value) return null;
      if (value.includes(":")) {
        const parts = value.split(":").map(Number);
        if (parts.some((part) => !Number.isFinite(part))) return null;
        return Math.max(0, parts.reduce((sum, part) => sum * 60 + part, 0));
      }
      const number = Number(value.replace(/s$/i, ""));
      return Number.isFinite(number) ? Math.max(0, number) : null;
    }

    function openNumberPopover(anchor, label, value, apply) {
      numberPop?.remove();
      const rect = anchor.getBoundingClientRect();
      const form = document.createElement("form");
      form.className = "orgavox-number-pop";
      const title = document.createElement("label");
      title.textContent = label;
      const input = document.createElement("input");
      input.type = "text";
      input.value = String(value ?? "");
      const hint = document.createElement("small");
      hint.textContent = "Enter to apply · Esc to cancel";
      form.append(title, input, hint);
      form.style.left = `${Math.min(window.innerWidth - 170, Math.max(8, rect.left))}px`;
      form.style.top = `${Math.min(window.innerHeight - 110, Math.max(8, rect.bottom + 8))}px`;
      form.addEventListener("submit", (event) => { event.preventDefault(); const ok = apply(input.value.trim()); if (ok !== false) form.remove(); });
      input.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); form.remove(); } });
      document.body.appendChild(form);
      numberPop = form;
      input.focus();
      input.select();
    }

    function setupValueEditors() {
      const bind = (node, key, label, value, apply) => {
        if (!node || node.dataset[key]) return;
        node.dataset[key] = "true";
        node.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); openNumberPopover(node, label, value(), apply); });
      };
      bind(ui.timeReadout, "orgavoxTimeEdit", "Playhead time", () => ui.timeReadout?.textContent || formatTime(state.playhead), (text) => { const seconds = parseTime(text); if (seconds == null) return false; setPlayhead(seconds, true); return true; });
      bind(ui.globalVolumeOut, "orgavoxMasterEdit", "Master volume", () => ui.globalVolumeOut?.textContent || `${Math.round(state.globalVolume || 100)}%`, (text) => { const n = Number(String(text).replace(/[^0-9.-]/g, "")); if (!Number.isFinite(n)) return false; state.globalVolume = Math.max(0, Math.min(200, n)); if (ui.globalVolumeSlider) ui.globalVolumeSlider.value = state.globalVolume; if (ui.globalVolumeOut) ui.globalVolumeOut.textContent = `${Math.round(state.globalVolume)}%`; localStorage.setItem("orgavoxGlobalVolume", String(state.globalVolume)); window.orgavoxRecordHistory?.(); return true; });
      bind(ui.volumeOut, "orgavoxVolumeEdit", "Clip volume", () => ui.volumeOut?.textContent || "100%", (text) => { const n = Number(String(text).replace(/[^0-9.-]/g, "")); if (!Number.isFinite(n)) return false; const next = Math.max(0, Math.min(200, n)); const clips = selectedClips(); if (!clips.length) return false; clips.forEach((clip) => { clip.volume = next; invalidateClip?.(clip); }); if (ui.volumeSlider) ui.volumeSlider.value = next; if (ui.volumeOut) ui.volumeOut.textContent = `${Math.round(next)}%`; renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); return true; });
      bind(ui.echoOut, "orgavoxEchoEdit", "Echo amount", () => ui.echoOut?.textContent || "0%", (text) => { const n = Number(String(text).replace(/[^0-9.-]/g, "")); if (!Number.isFinite(n)) return false; const next = Math.max(0, Math.min(100, n)); const clips = selectedClips(); if (!clips.length) return false; clips.forEach((clip) => { clip.echo = next; invalidateClip?.(clip); }); if (ui.echoSlider) ui.echoSlider.value = next; if (ui.echoOut) ui.echoOut.textContent = `${Math.round(next)}%`; renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); return true; });
      bind(ui.zoomOut, "orgavoxZoomEdit", "Timeline zoom", () => ui.zoomOut?.textContent || "100%", (text) => { const n = Number(String(text).replace(/[^0-9.-]/g, "")); if (!Number.isFinite(n)) return false; const percent = Math.max(25, Math.min(625, n)); state.pixelsPerSecond = Math.max(25, Math.min(500, Math.round(80 * percent / 100))); if (ui.zoomSlider) ui.zoomSlider.value = state.pixelsPerSecond; if (ui.zoomOut) ui.zoomOut.textContent = `${Math.round(state.pixelsPerSecond / 80 * 100)}%`; renderTimeline(); window.orgavoxRecordHistory?.(); return true; });
    }

    function ensureGlobalMaster() {
      if (ui.globalVolumeControl) return ui.globalVolumeControl;
      const control = document.createElement("label");
      control.className = "range-control orgavox-global-volume-control";
      const label = document.createElement("span");
      label.textContent = "🌐 Master";
      const input = document.createElement("input");
      input.id = "globalVolumeSlider";
      input.type = "range";
      input.min = "0";
      input.max = "200";
      const out = document.createElement("output");
      out.id = "globalVolumeOut";
      state.globalVolume = Math.max(0, Math.min(200, Number(state.globalVolume ?? localStorage.getItem("orgavoxGlobalVolume") ?? 100)));
      input.value = String(state.globalVolume);
      out.textContent = `${Math.round(state.globalVolume)}%`;
      control.append(label, input, out);
      input.addEventListener("input", () => { state.globalVolume = Math.max(0, Math.min(200, Number(input.value) || 0)); out.textContent = `${Math.round(state.globalVolume)}%`; localStorage.setItem("orgavoxGlobalVolume", String(state.globalVolume)); });
      input.addEventListener("change", () => window.orgavoxRecordHistory?.());
      ui.globalVolumeControl = control;
      ui.globalVolumeSlider = input;
      ui.globalVolumeOut = out;
      return control;
    }

    function patchMasterAudio() {
      if (window.__orgavoxMasterAudioPatched105 || typeof connectClipNodes !== "function") return;
      window.__orgavoxMasterAudioPatched105 = true;
      const oldConnect = connectClipNodes;
      connectClipNodes = function orgavoxMasterConnectClipNodes(context, source, clip, destination) {
        const master = context.createGain();
        master.gain.value = Math.max(0, Math.min(2, Number(state.globalVolume ?? 100) / 100));
        master.connect(destination);
        return oldConnect(context, source, clip, master);
      };
    }

    function ensureMenus() {
      const edit = dropdown("orgavoxEditDropdown", "orgavox-edit-dropdown", "orgavox-edit-button", "orgavox-edit-menu", "✎ Edit ▾");
      const view = dropdown("orgavoxViewDropdown", "orgavox-view-dropdown", "orgavox-view-button", "orgavox-view-menu", "👁 View ▾");
      let effects = document.querySelector(".orgavox-effects-dropdown");
      if (!effects) effects = dropdown("orgavoxEffectsDropdown", "orgavox-effects-dropdown", "orgavox-effects-dropdown-button", "orgavox-effects-menu", "✨ Effects ▾").wrap;

      ui.undoBtn = button("undoBtn", "↶ Undo", "tool-button orgavox-history-button");
      ui.redoBtn = button("redoBtn", "↷ Redo", "tool-button orgavox-history-button");
      ui.undoHistoryBtn = button("undoHistoryBtn", "↶ Undo History", "tool-button orgavox-history-button");
      ui.downloadClipBtn = button("downloadClipBtn", "⬇ Download Clip", "tool-button orgavox-download-clip-button");
      ui.reverseClipBtn = button("reverseClipBtn", "↩ Reverse", "tool-button orgavox-clip-tool-button orgavox-reverse-button");
      ui.bounceBtn = button("bounceBtn", "🧱 Bounce Track", "tool-button orgavox-clip-tool-button orgavox-bounce-button");
      if (ui.scissorsBtn) { ui.scissorsBtn.textContent = "✂️ Snip"; ui.scissorsBtn.classList.add("orgavox-snip-tool"); }
      if (ui.deleteBtn) { ui.deleteBtn.textContent = "🗑 Delete"; ui.deleteBtn.classList.add("orgavox-danger-tool"); if (!ui.deleteBtn.dataset.orgavoxDeleteWired) { ui.deleteBtn.dataset.orgavoxDeleteWired = "true"; ui.deleteBtn.addEventListener("click", deleteClips); } }

      appendOrdered(edit.menu, [ui.undoHistoryBtn, menuButton("orgavoxCopyClipBtn", "⧉ Copy", copyClip), menuButton("orgavoxCutClipBtn", "✂ Cut", cutClip, "tool-button orgavox-cut-clip-btn"), menuButton("orgavoxPasteClipBtn", "⧉ Paste", pasteClip), menuButton("orgavoxClearTimelineBtn", "🧹 Clear All", clearAll), ui.deleteBtn, ui.downloadClipBtn, ui.scissorsBtn, ui.undoBtn, ui.redoBtn]);
      appendOrdered(view.menu, [button("orgavoxMarkerPanelBtn", "🏷 Markers Panel"), menuButton("orgavoxSendToStartBtn", "↤ Send to Start", sendToStart), button("alignPlayheadBtn", "⤓ Align", "tool-button orgavox-align-button"), menuButton("orgavoxAnalyzeBtn", "📈 Analyze", analyze), button("orgavoxAddBeatMarkersBtn", "▏ Add Beat Markers"), button("orgavoxClearBeatMarkersBtn", "▏ Clear Beat Markers"), button("orgavoxRandomizeTrackColorsBtn", "🎨 Randomize Track Colors"), button("orgavoxExpandTrackBtn", "▣ Expand Track"), button("orgavoxResetTrackViewBtn", "▢ Reset Track View"), ui.bounceBtn]);
      const effectsMenu = effects.querySelector(".orgavox-effects-menu") || dropdown("orgavoxEffectsDropdown", "orgavox-effects-dropdown", "orgavox-effects-dropdown-button", "orgavox-effects-menu", "✨ Effects ▾").menu;
      appendOrdered(effectsMenu, [ui.reverseClipBtn]);
      return { edit, view, effects };
    }

    function ensureTrackSkeleton() {
      ui.trackLabels = [...document.querySelectorAll(".track-label")];
      ui.lanes = [...document.querySelectorAll(".track-lane")];
      ui.trackLabels.forEach((label, index) => {
        label.dataset.trackLabel = String(index);
        if (!label.querySelector(".orgavox-track-index")) {
          label.textContent = "";
          const ix = document.createElement("span"), name = document.createElement("strong"), menu = document.createElement("button"), mini = document.createElement("span"), mute = document.createElement("button"), solo = document.createElement("button"), info = document.createElement("button"), vol = document.createElement("button");
          ix.className = "orgavox-track-index"; ix.textContent = String(index + 1); name.className = "orgavox-track-name"; name.textContent = `Track ${index + 1}`; menu.type = "button"; menu.className = "orgavox-track-menu-btn"; menu.textContent = "⋯"; mini.className = "orgavox-track-mini";
          mute.type = solo.type = info.type = vol.type = "button"; mute.className = "orgavox-track-mix-btn mute"; solo.className = "orgavox-track-mix-btn solo"; info.className = "orgavox-track-info-btn"; vol.className = "orgavox-track-volume-pill"; mute.textContent = "M"; solo.textContent = "S"; info.textContent = "i"; vol.textContent = "100%"; mini.append(mute, solo, info, vol); label.append(ix, name, menu, mini);
        }
      });
      ui.lanes.forEach((lane, index) => { lane.dataset.track = String(index); if (!lane.querySelector(".orgavox-track-volume-overlay")) { const overlay = document.createElement("button"); overlay.type = "button"; overlay.className = "orgavox-track-volume-overlay"; overlay.textContent = `Track ${index + 1} · VOL 100%`; lane.appendChild(overlay); } });
    }

    function wireMenuModuleButtons() {
      const once = (id, fn) => { const node = document.getElementById(id); if (node && !node.dataset.orgavoxUiMenuAction) { node.dataset.orgavoxUiMenuAction = "true"; node.addEventListener("click", () => { closeMenus(); fn?.(); }); } };
      once("orgavoxMarkerPanelBtn", () => window.orgavoxOpenMarkersPanel?.());
      once("orgavoxAddBeatMarkersBtn", () => window.orgavoxAddBeatMarkers?.());
      once("orgavoxClearBeatMarkersBtn", () => window.orgavoxClearBeatMarkers?.());
      once("orgavoxRandomizeTrackColorsBtn", () => window.orgavoxRandomizeTrackColors?.());
      once("orgavoxExpandTrackBtn", () => window.orgavoxExpandSelectedTrack?.());
      once("orgavoxResetTrackViewBtn", () => window.orgavoxResetTrackView?.());
    }

    function build() {
      setVersion();
      installStyles();
      const main = document.querySelector(".orgavox-main-controls-group");
      const transport = document.querySelector(".orgavox-transport-group");
      const group = document.querySelector(".orgavox-edit-group") || document.querySelector(".toolbar-actions");
      if (!main || !transport || !group) return;
      const master = ensureGlobalMaster();
      if (ui.importBtn) { ui.importBtn.textContent = "📥 Open"; ui.importBtn.classList.add("orgavox-open-button"); main.insertBefore(ui.importBtn, transport); }
      if (ui.exportBtn) { ui.exportBtn.textContent = "💾 Save"; ui.exportBtn.classList.add("orgavox-save-button"); main.insertBefore(ui.exportBtn, transport); }
      main.insertBefore(master, transport);
      appendOrdered(transport, [ui.jumpStartBtn, ui.playBtn, ui.stopBtn, ui.timeReadout]);
      const menus = ensureMenus();
      const prev = button("prevMarkerBtn", "◀", "icon-button orgavox-marker-nav");
      const marker = button("markersBtn", "🏷 Add Marker", "tool-button orgavox-markers-button");
      const next = button("nextMarkerBtn", "▶", "icon-button orgavox-marker-nav");
      const nudgeLeft = button("nudgeLeftBtn", "◀ Nudge", "tool-button orgavox-nudge-button");
      const nudgeRight = button("nudgeRightBtn", "Nudge ▶", "tool-button orgavox-nudge-button");
      const snap = button("snapGridBtn", "🧲 Snap", "tool-button orgavox-snap-button");
      let snapSelect = document.getElementById("snapGridSelect");
      if (!snapSelect) { snapSelect = document.createElement("select"); snapSelect.id = "snapGridSelect"; }
      SNAP_VALUES.forEach((value) => { if (![...snapSelect.options].some((option) => option.value === String(value))) { const option = document.createElement("option"); option.value = String(value); option.textContent = String(value); snapSelect.appendChild(option); } });
      appendOrdered(group, [menus.edit.wrap, menus.view.wrap, menus.effects, prev, marker, next, nudgeLeft, nudgeRight, snap, snapSelect]);
      Object.assign(ui, { snapBtn: snap, snapGridSelect: snapSelect, nudgeLeftBtn: nudgeLeft, nudgeRightBtn: nudgeRight, markersBtn: marker, alignPlayheadBtn: document.getElementById("alignPlayheadBtn") });
      const echo = ui.echoSlider?.closest(".range-control");
      if (echo) { echo.classList.add("orgavox-echo-control"); let gear = document.getElementById("echoSettingsBtn"); if (!gear) { gear = document.createElement("button"); gear.id = "echoSettingsBtn"; gear.type = "button"; gear.textContent = "⚙"; } gear.className = "icon-button echo-settings-btn"; gear.textContent = "⚙"; echo.appendChild(gear); }
      const zoom = ui.zoomSlider?.closest(".range-control");
      if (zoom && ui.fullscreenBtn) { zoom.classList.add("zoom-control"); zoom.appendChild(ui.fullscreenBtn); }
      ensureTrackSkeleton();
      setupValueEditors();
      wireMenuModuleButtons();
      window.orgavoxWireUndoRedoControls?.(); window.orgavoxWireSnapControls?.(); window.orgavoxWireMarkerControls?.(); window.orgavoxWireEchoSettingsButton?.(); window.orgavoxWireRenderToolControls?.(); window.orgavoxRefreshTrackTools?.(); window.orgavoxRenderMarkers?.();
    }

    function deselectClips() {
      if (!state.selectedClipId && (!Array.isArray(state.selectedClipIds) || !state.selectedClipIds.length)) return;
      state.selectedClipId = null;
      state.selectedClipIds = [];
      syncSelectedControls();
      document.querySelectorAll(".audio-clip.selected,.audio-clip.orgavox-multi-selected").forEach((element) => { element.classList.remove("selected", "orgavox-multi-selected"); });
    }

    function installGlobalHandlers() {
      if (window.__orgavoxUiOwnerHandlers105) return;
      window.__orgavoxUiOwnerHandlers105 = true;
      document.addEventListener("keydown", (event) => {
        const target = event.target;
        const typing = target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable);
        if (typing || event.defaultPrevented || event.altKey) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const amount = event.shiftKey ? 1 : (event.ctrlKey || event.metaKey ? 0.1 : 0.01);
        setPlayhead(Math.max(0, (Number(state.playhead) || 0) + (event.key === "ArrowLeft" ? -amount : amount)), true);
      }, true);
      document.addEventListener("pointerdown", (event) => {
        const target = event.target;
        if (!target) return;
        if (target.closest?.(".audio-clip,.clip-handle,button,input,select,textarea,label,.popover,.modal-backdrop,.orgavox-edit-dropdown,.orgavox-view-dropdown,.orgavox-effects-dropdown,.asset-list,.library-panel,.echo-settings-backdrop,.orgavox-history-modal,.orgavox-markers-modal,.orgavox-bounce-modal")) return;
        if (target.closest?.(".track-lane,.tracks,.timeline-scroll,.timeline-content,#rulerCanvas")) deselectClips();
      }, true);
      document.addEventListener("click", (event) => { const target = event.target; if (!target?.closest?.("#orgavoxEditDropdown,#orgavoxViewDropdown,#orgavoxEffectsDropdown")) closeMenus(); }, true);
    }

    function patchRefreshHooks() {
      if (window.__orgavoxUiOwnerPatch105) return;
      window.__orgavoxUiOwnerPatch105 = true;
      if (typeof renderTimeline === "function") { const old = renderTimeline; renderTimeline = function orgavoxUiOwnerRenderTimeline() { const result = old.apply(this, arguments); setTimeout(refresh, 0); return result; }; }
      if (typeof syncSelectedControls === "function") { const old = syncSelectedControls; syncSelectedControls = function orgavoxUiOwnerSyncSelectedControls() { const result = old.apply(this, arguments); const hasClip = Boolean(selectedClip()); [ui.deleteBtn, ui.downloadClipBtn, ui.reverseClipBtn, ui.bounceBtn, ui.scissorsBtn, ui.nudgeLeftBtn, ui.nudgeRightBtn, ui.alignPlayheadBtn].filter(Boolean).forEach((btn) => { btn.disabled = !hasClip; }); return result; }; }
      if (typeof startPlayback === "function") { const old = startPlayback; startPlayback = async function orgavoxUiOwnerStartPlayback() { const result = await old.apply(this, arguments); syncPlayButton(); return result; }; }
      if (typeof stopPlayback === "function") { const old = stopPlayback; stopPlayback = function orgavoxUiOwnerStopPlayback() { const result = old.apply(this, arguments); syncPlayButton(); return result; }; }
    }

    function syncPlayButton() { ui.playBtn?.classList.toggle("orgavox-playing", Boolean(state.playing)); }
    function refresh() { setVersion(); build(); syncPlayButton(); }

    window.orgavoxRefreshVisibleUi = refresh;
    patchMasterAudio();
    patchRefreshHooks();
    installGlobalHandlers();
    refresh();
    setTimeout(refresh, 150);
    setTimeout(refresh, 600);
  }

  installVisibleUiOwner();
  setVersion();
  document.documentElement.classList.remove("orgavox-loading");
  document.getElementById("orgavox-boot-style")?.remove();
  if (typeof setStatus === "function") setStatus("Ready — ORGAVOX loaded");
})().catch((error) => {
  console.error(error);
  document.documentElement.classList.remove("orgavox-loading");
  const status = document.getElementById("statusPill");
  if (status) status.textContent = "ORGAVOX failed to load";
});