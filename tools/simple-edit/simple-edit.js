"use strict";

(async () => {
  const VERSION = "v1.06";
  const REMOTE_SOUND_FX = "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/";
  const LOCAL_SOUND_FX = "./soundeffects/";
  window.ORGAVOX_VERSION = VERSION;
  document.documentElement.classList.add("orgavox-loading");

  function setVersion() {
    document.title = `Organon — ORGAVOX ${VERSION}`;
    document.querySelectorAll(".simple-edit-version,.phase1-version,.orgavox-sidebar-version").forEach((node) => { node.textContent = VERSION; });
    const title = document.querySelector(".brand h1");
    if (title && !title.querySelector(".simple-edit-version")) {
      title.textContent = "ORGAVOX ";
      const badge = document.createElement("span");
      badge.className = "simple-edit-version phase1-version";
      badge.textContent = VERSION;
      title.appendChild(badge);
    }
  }

  function localizeSoundFxUrl(value) {
    const text = String(value || "");
    return text.startsWith(REMOTE_SOUND_FX) ? `${LOCAL_SOUND_FX}${text.slice(REMOTE_SOUND_FX.length)}` : value;
  }

  function installLocalSoundFxRouting() {
    if (window.__orgavoxLocalSoundFxFetchPatched) return;
    window.__orgavoxLocalSoundFxFetchPatched = true;
    const originalFetch = window.fetch?.bind(window);
    if (!originalFetch) return;
    window.fetch = function orgavoxSoundFxFetch(resource, init) {
      if (typeof resource === "string") return originalFetch(localizeSoundFxUrl(resource), init);
      if (resource && typeof resource.url === "string") {
        const localized = localizeSoundFxUrl(resource.url);
        if (localized !== resource.url) return originalFetch(localized, init);
      }
      return originalFetch(resource, init);
    };
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
    "./simple-edit-analysis.js?v=0.40", "./simple-edit-project.js?v=1.06", "./simple-edit-markers.js?v=1.04", "./simple-edit-undo-redo.js?v=1.04", "./simple-edit-track-tools.js?v=1.04", "./simple-edit-clip-menu.js?v=0.46", "./simple-edit-snap-tools.js?v=1.04", "./simple-edit-library-tools.js?v=0.48", "./simple-edit-build6.js?v=0.49"
  ];

  for (const source of files) await loadScript(source);

  function installVisibleUiOwner() {
    const STYLE_ID = "orgavox-visible-ui-owner-v106";
    const SNAP_VALUES = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
    let clipboard = [];
    let numberPop = null;

    function installStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const node = document.createElement("style");
      node.id = STYLE_ID;
      node.textContent = `
        :root{--topbar-h:auto!important;--controls-h:auto!important;--lane-h:112px!important}
        .app{height:100%!important;display:grid!important;grid-template-rows:auto auto minmax(0,1fr)!important;overflow:hidden!important}
        .topbar{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;grid-template-areas:"brand main" "tools tools"!important;align-items:center!important;gap:10px 16px!important;padding:10px 16px!important;min-height:0!important;overflow:visible!important}
        body.simple-edit-phase1 .topbar .brand,.topbar .brand{grid-area:brand!important;display:flex!important;visibility:visible!important;align-items:center!important;min-width:230px!important}
        .orgavox-main-controls-group{grid-area:main!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;flex-wrap:wrap!important;min-width:0!important}
        .orgavox-transport-group{display:flex!important;align-items:center!important;gap:8px!important;flex:0 0 auto!important}
        .orgavox-edit-group{grid-area:tools!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;flex-wrap:wrap!important;min-height:44px!important;padding-top:8px!important;border-top:1px solid rgba(137,107,73,.32)!important;overflow:visible!important}
        .orgavox-brand-actions{display:none!important}.orgavox-open-save-row{display:contents!important}
        .clip-controls{display:grid!important;grid-template-columns:minmax(170px,240px) minmax(220px,1fr) minmax(220px,1fr) minmax(235px,1fr)!important;align-items:center!important;gap:12px!important;padding:8px 16px!important;min-height:64px!important;position:relative!important;z-index:12!important;overflow:visible!important}
        .clip-controls .selected-summary{min-width:0!important;max-width:none!important}.range-control{min-width:0!important}.orgavox-global-volume-control,.orgavox-echo-control,.zoom-control{display:grid!important;grid-template-columns:auto minmax(92px,1fr) 48px 34px!important;align-items:center!important;gap:7px!important}.orgavox-global-volume-control{grid-template-columns:auto minmax(92px,150px) 48px!important;min-width:230px!important}.zoom-control{margin-left:0!important}
        .workspace{min-height:0!important;display:grid!important;grid-template-columns:290px minmax(0,1fr)!important;overflow:hidden!important}.timeline-panel{min-height:0!important;overflow:hidden!important}.timeline-shell{grid-template-columns:172px minmax(0,1fr)!important;min-height:0!important;height:100%!important}.track-label-column{width:172px!important;min-width:172px!important}.ruler-label{height:38px!important}.track-label{height:var(--lane-h)!important;min-height:var(--lane-h)!important;display:grid!important;grid-template-columns:28px minmax(0,1fr) 26px!important;grid-template-rows:1fr 28px!important;gap:4px 7px!important;align-items:center!important;padding:8px 10px!important;box-shadow:inset 4px 0 var(--orgavox-track-color,#75b2de)!important;overflow:hidden!important}.track-lane{height:var(--lane-h)!important}.orgavox-track-index{grid-column:1;grid-row:1/span 2;display:grid!important;place-items:center;width:24px!important;height:24px!important;border:1px solid rgba(224,163,96,.72)!important;border-radius:999px!important;color:#f8d792!important}.orgavox-track-name{grid-column:2;grid-row:1;align-self:end;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f5f0db!important;font:900 .72rem var(--font-body)!important}.orgavox-track-menu-btn{grid-column:3;grid-row:1;width:25px!important;height:25px!important;padding:0!important;align-self:end}.orgavox-track-mini{grid-column:2/span 2;grid-row:2;display:flex!important;align-items:center!important;gap:5px!important;flex-wrap:nowrap!important;overflow:visible!important}.orgavox-track-volume-pill{display:none!important}.orgavox-track-mix-btn,.orgavox-track-info-btn{width:24px!important;height:22px!important;min-height:22px!important;padding:0!important;border-radius:7px!important;font:900 .54rem var(--font-mono)!important;display:grid!important;place-items:center!important}.orgavox-track-mix-btn.mute{border-color:rgba(220,72,64,.5)!important;color:#ffd8d2!important}.orgavox-track-mix-btn.solo{border-color:rgba(224,163,96,.56)!important;color:#ffe4a8!important}.orgavox-track-mix-btn.mute.active{background:linear-gradient(180deg,rgba(105,38,35,.92),rgba(42,15,14,.96))!important;border-color:rgba(220,72,64,.95)!important}.orgavox-track-mix-btn.solo.active{background:linear-gradient(180deg,rgba(122,83,32,.94),rgba(48,29,11,.98))!important;border-color:rgba(224,163,96,.95)!important}.orgavox-track-info-btn{border-color:rgba(74,190,117,.9)!important;background:linear-gradient(180deg,rgba(34,126,66,.95),rgba(12,58,31,.98))!important;color:#e4ffed!important}.track-label.active{background:rgba(75,132,191,.16)!important;box-shadow:inset 4px 0 var(--orgavox-track-color,#75b2de),inset 0 0 0 2px rgba(117,178,222,.48)!important}
        .orgavox-project-info-bar{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;flex:0 0 auto!important;margin:0 0 8px 0!important;padding:8px 14px!important;border:1px solid rgba(96,58,22,.78)!important;border-radius:10px!important;background:linear-gradient(180deg,#e5b65d,#c99134)!important}.orgavox-project-info-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#17100a!important;font:900 .82rem var(--font-body)!important}.orgavox-project-info-meta{flex:0 0 auto;color:#5a341d!important;font:900 .7rem var(--font-mono)!important;white-space:nowrap!important}
        .orgavox-edit-dropdown,.orgavox-view-dropdown,.orgavox-effects-dropdown{position:relative!important;display:inline-flex!important}.orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu{position:absolute!important;top:calc(100% + 8px)!important;left:0!important;z-index:4300!important;min-width:235px!important;display:grid!important;gap:6px!important;padding:8px!important;border:1px solid rgba(224,163,96,.65)!important;border-radius:14px!important;background:rgba(10,11,10,.98)!important;box-shadow:0 18px 44px rgba(0,0,0,.72)!important}.orgavox-edit-menu[hidden],.orgavox-view-menu[hidden],.orgavox-effects-menu[hidden]{display:none!important}.orgavox-edit-menu .tool-button,.orgavox-view-menu .tool-button,.orgavox-effects-menu .tool-button{width:100%!important;justify-content:flex-start!important;min-height:32px!important}
        .tool-button,.icon-button{white-space:nowrap!important}.orgavox-open-button{border-color:rgba(117,178,222,.92)!important;background:linear-gradient(180deg,rgba(57,132,205,.96),rgba(31,77,133,.94))!important;color:#eef8ff!important}.orgavox-save-button{border-color:rgba(74,190,117,.86)!important;background:linear-gradient(180deg,rgba(35,118,66,.92),rgba(14,62,35,.94))!important;color:#e2ffe9!important}.orgavox-project-button{border-color:rgba(178,109,255,.86)!important;background:linear-gradient(180deg,rgba(106,60,190,.94),rgba(53,27,108,.96))!important;color:#f3e2ff!important}.orgavox-edit-button{border-color:rgba(224,163,96,.82)!important;background:linear-gradient(180deg,rgba(93,67,35,.88),rgba(34,23,13,.95))!important;color:#ffe4a8!important}.orgavox-view-button,.orgavox-analysis-button{border-color:rgba(117,178,222,.86)!important;background:linear-gradient(180deg,rgba(35,80,124,.95),rgba(14,38,72,.98))!important;color:#e1f7ff!important}.orgavox-effects-dropdown-button,.orgavox-marker-nav,#markersBtn{border-color:rgba(178,109,255,.84)!important;background:linear-gradient(180deg,rgba(87,45,155,.92),rgba(40,21,82,.96))!important;color:#f4e2ff!important}.orgavox-nudge-button,.orgavox-snap-button,.orgavox-align-button{border-color:rgba(117,178,222,.76)!important;background:linear-gradient(180deg,rgba(33,80,122,.86),rgba(13,35,61,.95))!important;color:#dff5ff!important}.orgavox-snap-button.active{border-color:rgba(248,215,146,.92)!important;background:linear-gradient(180deg,rgba(129,85,31,.92),rgba(55,34,13,.96))!important;color:#fff0bd!important}.orgavox-snip-tool,.orgavox-danger-tool,.orgavox-cut-clip-btn{border-color:rgba(220,72,64,.78)!important;background:linear-gradient(180deg,rgba(92,28,23,.88),rgba(39,13,10,.96))!important;color:#ffd8d2!important}#snapGridSelect{height:34px!important;border:1px solid rgba(117,178,222,.72)!important;border-radius:10px!important;background:#050505!important;color:#f5f0db!important;font:900 .62rem var(--font-mono)!important}#snapGridSelect option{background:#050505!important;color:#f5f0db!important}.echo-settings-btn,#fullscreenBtn{width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;padding:0!important}.echo-settings-btn{border-color:rgba(117,178,222,.86)!important;background:linear-gradient(180deg,rgba(32,82,125,.94),rgba(13,38,66,.96))!important;color:#e1f7ff!important}output,.time-readout{cursor:pointer!important}@keyframes orgavoxPlayPulse{from{transform:scale(1);filter:brightness(1);box-shadow:0 0 0 1px rgba(117,178,222,.35),0 0 12px rgba(75,155,255,.28)}to{transform:scale(1.13);filter:brightness(1.25);box-shadow:0 0 0 1px rgba(168,220,255,.8),0 0 26px rgba(75,155,255,.68)}}#playBtn.orgavox-playing{animation:orgavoxPlayPulse .72s ease-in-out infinite alternate!important;transform-origin:center!important}.orgavox-number-pop,.orgavox-track-number-pop{position:fixed;z-index:999999;min-width:138px;padding:8px;border:1px solid rgba(224,163,96,.72);border-radius:12px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);display:grid;gap:6px}.orgavox-number-pop label,.orgavox-track-number-pop label{color:rgba(245,240,219,.72);font:800 .56rem var(--font-mono);text-transform:uppercase;letter-spacing:.08em}.orgavox-number-pop input,.orgavox-track-number-pop input{height:34px;border:1px solid rgba(117,178,222,.64);border-radius:9px;background:#050505;color:#f5f0db;padding:0 9px;font:900 .78rem var(--font-mono)}.orgavox-track-volume-overlay{position:absolute;left:8px;top:8px;z-index:3;max-width:220px;padding:3px 8px;border:1px solid rgba(224,163,96,.42);border-radius:9px;background:rgba(0,0,0,.78);color:#f8d792;font:900 .58rem var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.orgavox-marker-layer{position:absolute;inset:0;pointer-events:none;z-index:7}.orgavox-marker-line,.orgavox-beat-line{position:absolute;top:0;bottom:0;width:2px;border:0;padding:0;background:#e0a360;pointer-events:auto}.orgavox-beat-line{width:1px;background:#ff4dff;opacity:.82;pointer-events:none}
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
      if (!trigger) { trigger = document.createElement("button"); trigger.type = "button"; wrap.prepend(trigger); }
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

    function selectedIds() { if (!Array.isArray(state.selectedClipIds)) state.selectedClipIds = state.selectedClipId ? [state.selectedClipId] : []; return state.selectedClipIds.filter((id) => state.clips.some((clip) => clip.id === id)); }
    function selectedClips() { const ids = new Set(selectedIds().length ? selectedIds() : (state.selectedClipId ? [state.selectedClipId] : [])); return state.clips.filter((clip) => ids.has(clip.id)); }
    function copyClip() { const clips = selectedClips(); if (!clips.length) return showToast("Select a clip to copy."); const earliest = Math.min(...clips.map((clip) => Number(clip.start) || 0)); clipboard = clips.map((clip) => ({ ...clip, __relativeStart: (Number(clip.start) || 0) - earliest })); showToast("Clip copied."); }
    function cutClip() { const clips = selectedClips(); if (!clips.length) return showToast("Select a clip to cut."); copyClip(); const ids = new Set(clips.map((clip) => clip.id)); state.clips = state.clips.filter((clip) => !ids.has(clip.id)); state.selectedClipId = null; state.selectedClipIds = []; syncSelectedControls(); renderTimeline(); window.orgavoxRecordHistory?.(); showToast("Clip cut."); }
    function pasteClip() { if (!clipboard.length) return showToast("No copied clip to paste."); const base = Math.max(0, Number(state.playhead) || 0); const pasted = clipboard.map((clip) => ({ ...clip, id: makeId("clip"), start: base + Math.max(0, Number(clip.__relativeStart) || 0), cacheVersion: 0 })); pasted.forEach((clip) => delete clip.__relativeStart); state.clips.push(...pasted); state.selectedClipId = pasted[pasted.length - 1]?.id || null; state.selectedClipIds = pasted.map((clip) => clip.id); renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); showToast("Clip pasted at the playhead."); }
    function clearAll() { if (!state.clips.length) return showToast("Timeline is already clear."); if (confirm && !confirm("Clear all clips from the timeline?")) return; state.clips = []; state.selectedClipId = null; state.selectedClipIds = []; syncSelectedControls(); renderTimeline(); window.orgavoxRecordHistory?.(); }
    function deleteClips() { const clips = selectedClips(); if (!clips.length) return deleteSelectedClip?.(); const ids = new Set(clips.map((clip) => clip.id)); state.clips = state.clips.filter((clip) => !ids.has(clip.id)); state.selectedClipId = null; state.selectedClipIds = []; syncSelectedControls(); renderTimeline(); window.orgavoxRecordHistory?.(); showToast("Selected clip deleted."); }
    function sendToStart() { const clips = selectedClips(); if (!clips.length) return showToast("Select a clip to send to start."); const earliest = Math.min(...clips.map((clip) => Math.max(0, Number(clip.start) || 0))); clips.forEach((clip) => { clip.start = clips.length === 1 ? 0 : Math.max(0, (Number(clip.start) || 0) - earliest); }); renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); }
    function openAnalyze() { const existing = document.getElementById("analysisBtn"); if (existing) return existing.click(); const clip = selectedClip() || state.clips.find((item) => Number(item.track) === Number(state.selectedTrack)) || state.clips[0]; if (!clip) return showToast("Select a clip or track to analyze."); selectClip(clip.id); const modal = document.getElementById("analysisModal"); if (!modal) return showToast("Analyze panel is still loading."); modal.hidden = false; setTimeout(() => modal.querySelector("[data-analysis-scan]")?.click(), 0); }

    function ensureMasterControl() {
      state.globalVolume = Math.max(0, Math.min(200, Number(state.globalVolume ?? localStorage.getItem("orgavoxGlobalVolume") ?? 100)));
      let control = document.getElementById("globalVolumeControl");
      if (!control) {
        control = document.createElement("label");
        control.id = "globalVolumeControl";
        control.className = "range-control orgavox-global-volume-control";
        control.innerHTML = `<span>🌐 Master</span><input id="globalVolumeSlider" type="range" min="0" max="200" value="${state.globalVolume}"><output id="globalVolumeOut">${Math.round(state.globalVolume)}%</output>`;
      }
      ui.globalVolumeControl = control;
      ui.globalVolumeSlider = control.querySelector("#globalVolumeSlider");
      ui.globalVolumeOut = control.querySelector("#globalVolumeOut");
      if (ui.globalVolumeSlider && !ui.globalVolumeSlider.dataset.orgavoxMasterWired) {
        ui.globalVolumeSlider.dataset.orgavoxMasterWired = "true";
        ui.globalVolumeSlider.addEventListener("input", () => { state.globalVolume = Math.max(0, Math.min(200, Number(ui.globalVolumeSlider.value) || 0)); localStorage.setItem("orgavoxGlobalVolume", String(state.globalVolume)); if (ui.globalVolumeOut) ui.globalVolumeOut.textContent = `${Math.round(state.globalVolume)}%`; });
      }
      return control;
    }

    function appendAll(parent, nodes) { nodes.filter(Boolean).forEach((node) => { if (node.parentElement !== parent || parent.lastElementChild !== node) parent.appendChild(node); }); }

    function ensureProjectInfoBar() {
      const panel = document.querySelector(".timeline-panel");
      const shell = document.querySelector(".timeline-shell");
      if (!panel || !shell) return null;
      let bar = document.getElementById("orgavoxProjectInfoBar");
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "orgavoxProjectInfoBar";
        bar.className = "orgavox-project-info-bar";
        bar.innerHTML = `<span class="orgavox-project-info-name" id="orgavoxProjectInfoName">Untitled Project</span><span class="orgavox-project-info-meta" id="orgavoxProjectInfoMeta">Not saved yet</span>`;
      }
      if (bar.parentElement !== panel || bar.nextElementSibling !== shell) panel.insertBefore(bar, shell);
      return bar;
    }

    function ensureTrackSkeleton() {
      ui.trackLabels = [...document.querySelectorAll(".track-label")];
      ui.lanes = [...document.querySelectorAll(".track-lane")];
      ui.trackLabels.forEach((label, index) => {
        label.dataset.trackLabel = String(index);
        if (!label.querySelector(".orgavox-track-index")) {
          label.textContent = "";
          const ix = document.createElement("span"); ix.className = "orgavox-track-index"; ix.textContent = String(index + 1);
          const name = document.createElement("strong"); name.className = "orgavox-track-name"; name.textContent = `Track ${index + 1}`;
          const menu = document.createElement("button"); menu.type = "button"; menu.className = "orgavox-track-menu-btn"; menu.textContent = "⋯";
          const mini = document.createElement("span"); mini.className = "orgavox-track-mini";
          const mute = document.createElement("button"); mute.type = "button"; mute.className = "orgavox-track-mix-btn mute"; mute.textContent = "M";
          const solo = document.createElement("button"); solo.type = "button"; solo.className = "orgavox-track-mix-btn solo"; solo.textContent = "S";
          const info = document.createElement("button"); info.type = "button"; info.className = "orgavox-track-info-btn"; info.textContent = "i";
          mini.append(mute, solo, info);
          label.append(ix, name, menu, mini);
        }
      });
      ui.lanes.forEach((lane, index) => { lane.dataset.track = String(index); if (!lane.querySelector(".orgavox-track-volume-overlay")) { const overlay = document.createElement("button"); overlay.type = "button"; overlay.className = "orgavox-track-volume-overlay"; overlay.textContent = `Track ${index + 1} · VOL 100%`; lane.appendChild(overlay); } });
    }

    function build() {
      setVersion(); installStyles(); ensureProjectInfoBar(); ensureTrackSkeleton();
      const main = document.querySelector(".orgavox-main-controls-group");
      const transport = document.querySelector(".orgavox-transport-group");
      const tools = document.querySelector(".orgavox-edit-group") || document.querySelector(".toolbar-actions");
      if (!main || !transport || !tools) return;

      const projectBtn = button("projectBtn", "📁 Project", "tool-button orgavox-project-button");
      ui.projectBtn = projectBtn;
      if (ui.importBtn) { ui.importBtn.textContent = "📥 Open"; ui.importBtn.classList.add("orgavox-open-button"); }
      if (ui.exportBtn) { ui.exportBtn.textContent = "💾 Save"; ui.exportBtn.classList.add("orgavox-save-button"); }
      appendAll(main, [ui.importBtn, ui.exportBtn, projectBtn, ensureMasterControl(), transport]);
      appendAll(transport, [ui.jumpStartBtn, ui.playBtn, ui.stopBtn, ui.timeReadout]);
      document.querySelectorAll(".orgavox-brand-actions").forEach((node) => { if (!node.children.length) node.remove(); });

      const edit = dropdown("orgavoxEditDropdown", "orgavox-edit-dropdown", "orgavox-edit-button", "orgavox-edit-menu", "✎ Edit ▾");
      const view = dropdown("orgavoxViewDropdown", "orgavox-view-dropdown", "orgavox-view-button", "orgavox-view-menu", "👁 View ▾");
      let effectsWrap = document.querySelector(".orgavox-effects-dropdown");
      if (!effectsWrap) effectsWrap = dropdown("orgavoxEffectsDropdown", "orgavox-effects-dropdown", "orgavox-effects-dropdown-button", "orgavox-effects-menu", "✨ Effects ▾").wrap;
      const effectsMenu = effectsWrap.querySelector(".orgavox-effects-menu") || dropdown("orgavoxEffectsDropdown", "orgavox-effects-dropdown", "orgavox-effects-dropdown-button", "orgavox-effects-menu", "✨ Effects ▾").menu;

      const prev = button("prevMarkerBtn", "◀", "icon-button orgavox-marker-nav");
      const marker = button("markersBtn", "🏷 Add Marker", "tool-button orgavox-markers-button");
      const next = button("nextMarkerBtn", "▶", "icon-button orgavox-marker-nav");
      const nudgeLeft = button("nudgeLeftBtn", "◀ Nudge", "tool-button orgavox-nudge-button");
      const nudgeRight = button("nudgeRightBtn", "Nudge ▶", "tool-button orgavox-nudge-button");
      const snap = button("snapGridBtn", "🧲 Snap", "tool-button orgavox-snap-button");
      let snapSelect = document.getElementById("snapGridSelect");
      if (!snapSelect) { snapSelect = document.createElement("select"); snapSelect.id = "snapGridSelect"; }
      if (!snapSelect.dataset.orgavoxUiOptions) { snapSelect.innerHTML = ""; SNAP_VALUES.forEach((value) => { const option = document.createElement("option"); option.value = String(value); option.textContent = String(value); snapSelect.appendChild(option); }); snapSelect.dataset.orgavoxUiOptions = "true"; }
      appendAll(tools, [edit.wrap, view.wrap, effectsWrap, prev, marker, next, nudgeLeft, nudgeRight, snap, snapSelect]);
      ui.snapBtn = snap; ui.snapGridSelect = snapSelect; ui.nudgeLeftBtn = nudgeLeft; ui.nudgeRightBtn = nudgeRight; ui.markersBtn = marker;

      ui.undoBtn = button("undoBtn", "↶ Undo", "tool-button orgavox-history-button");
      ui.redoBtn = button("redoBtn", "↷ Redo", "tool-button orgavox-history-button");
      ui.undoHistoryBtn = button("undoHistoryBtn", "↶ Undo History", "tool-button orgavox-history-button");
      ui.downloadClipBtn = button("downloadClipBtn", "⬇ Download Clip", "tool-button orgavox-download-clip-button");
      ui.reverseClipBtn = button("reverseClipBtn", "↩ Reverse", "tool-button orgavox-clip-tool-button orgavox-reverse-button");
      ui.bounceBtn = button("bounceBtn", "🧱 Bounce Track", "tool-button orgavox-clip-tool-button orgavox-bounce-button");
      ui.alignPlayheadBtn = button("alignPlayheadBtn", "⤓ Align", "tool-button orgavox-align-button");
      if (ui.scissorsBtn) { ui.scissorsBtn.textContent = "✂️ Snip"; ui.scissorsBtn.classList.add("orgavox-snip-tool"); }
      if (ui.deleteBtn) { ui.deleteBtn.textContent = "🗑 Delete"; ui.deleteBtn.classList.add("orgavox-danger-tool"); if (!ui.deleteBtn.dataset.orgavoxDeleteWired) { ui.deleteBtn.dataset.orgavoxDeleteWired = "true"; ui.deleteBtn.addEventListener("click", deleteClips); } }

      appendAll(edit.menu, [ui.undoHistoryBtn, menuButton("orgavoxCopyClipBtn", "⧉ Copy", copyClip), menuButton("orgavoxCutClipBtn", "✂ Cut", cutClip, "tool-button orgavox-cut-clip-btn"), menuButton("orgavoxPasteClipBtn", "⧉ Paste", pasteClip), menuButton("orgavoxClearTimelineBtn", "🧹 Clear All", clearAll), ui.deleteBtn, ui.downloadClipBtn, ui.scissorsBtn, ui.undoBtn, ui.redoBtn]);
      const analysisBtn = document.getElementById("analysisBtn") || menuButton("analysisBtn", "📈 Analyze", openAnalyze, "tool-button orgavox-analysis-button");
      appendAll(view.menu, [button("orgavoxMarkerPanelBtn", "🏷 Markers Panel"), menuButton("orgavoxSendToStartBtn", "↤ Send to Start", sendToStart), ui.alignPlayheadBtn, analysisBtn, button("orgavoxAddBeatMarkersBtn", "▏ Add Beat Markers"), button("orgavoxClearBeatMarkersBtn", "▏ Clear Beat Markers"), button("orgavoxRandomizeTrackColorsBtn", "🎨 Randomize Track Colors"), button("orgavoxExpandTrackBtn", "▣ Expand Track"), button("orgavoxResetTrackViewBtn", "▢ Reset Track View"), ui.bounceBtn]);
      const effectsLibraryBtn = document.getElementById("effectsLibraryBtn");
      if (effectsLibraryBtn) appendAll(effectsMenu, [effectsLibraryBtn, ui.reverseClipBtn]); else appendAll(effectsMenu, [ui.reverseClipBtn]);

      const echo = ui.echoSlider?.closest(".range-control");
      if (echo) { echo.classList.add("orgavox-echo-control"); let gear = document.getElementById("echoSettingsBtn"); if (!gear) { gear = document.createElement("button"); gear.id = "echoSettingsBtn"; gear.type = "button"; } gear.className = "icon-button echo-settings-btn"; gear.textContent = "⚙"; echo.appendChild(gear); }
      const zoom = ui.zoomSlider?.closest(".range-control");
      if (zoom && ui.fullscreenBtn) { zoom.classList.add("zoom-control"); zoom.appendChild(ui.fullscreenBtn); }
      wireModuleButtons(); wireValuePopups();
    }

    function wireModuleButtons() {
      window.orgavoxWireUndoRedoControls?.(); window.orgavoxWireSnapControls?.(); window.orgavoxWireMarkerControls?.(); window.orgavoxWireEchoSettingsButton?.(); window.orgavoxWireRenderToolControls?.(); window.orgavoxWireProjectButton?.(); window.orgavoxRefreshTrackTools?.(); window.orgavoxRenderMarkers?.();
      const once = (id, fn) => { const node = document.getElementById(id); if (node && !node.dataset.orgavoxUiMenuAction) { node.dataset.orgavoxUiMenuAction = "true"; node.addEventListener("click", () => { closeMenus(); fn?.(); }); } };
      once("orgavoxMarkerPanelBtn", () => window.orgavoxOpenMarkersPanel?.()); once("orgavoxAddBeatMarkersBtn", () => window.orgavoxAddBeatMarkers?.()); once("orgavoxClearBeatMarkersBtn", () => window.orgavoxClearBeatMarkers?.()); once("orgavoxRandomizeTrackColorsBtn", () => window.orgavoxRandomizeTrackColors?.()); once("orgavoxExpandTrackBtn", () => window.orgavoxExpandSelectedTrack?.()); once("orgavoxResetTrackViewBtn", () => window.orgavoxResetTrackView?.());
    }

    function parseTime(text) {
      const raw = String(text || "").trim();
      if (!raw) return 0;
      if (raw.includes(":")) { const parts = raw.split(":").map(Number); if (parts.some((part) => !Number.isFinite(part))) return state.playhead || 0; return Math.max(0, parts.reduce((sum, part) => sum * 60 + part, 0)); }
      const n = Number(raw.replace(/s$/i, "")); return Number.isFinite(n) ? Math.max(0, n) : (state.playhead || 0);
    }
    function showNumber(anchor, label, value, apply) {
      numberPop?.remove?.();
      const rect = anchor.getBoundingClientRect();
      const form = document.createElement("form"); form.className = "orgavox-number-pop";
      form.innerHTML = `<label>${label}<input type="text" value="${String(value).replace(/"/g, "&quot;")}"></label><button class="tool-button primary" type="submit">Apply</button>`;
      form.style.left = `${Math.min(window.innerWidth - 190, Math.max(8, rect.left))}px`; form.style.top = `${Math.min(window.innerHeight - 110, Math.max(8, rect.bottom + 8))}px`;
      const input = form.querySelector("input");
      form.addEventListener("submit", (event) => { event.preventDefault(); if (apply(input.value) !== false) { form.remove(); numberPop = null; } });
      document.body.appendChild(form); numberPop = form; input.focus(); input.select();
    }
    function wireValuePopups() {
      const bind = (node, key, fn) => { if (node && !node.dataset[key]) { node.dataset[key] = "true"; node.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); fn(node); }); } };
      bind(ui.timeReadout, "orgavoxTimePopup", (node) => showNumber(node, "Time", formatTime(state.playhead || 0), (value) => { setPlayhead(parseTime(value), true); return true; }));
      bind(ui.globalVolumeOut, "orgavoxMasterPopup", (node) => showNumber(node, "Master volume", Math.round(state.globalVolume || 100), (value) => { const n = Math.max(0, Math.min(200, Number(String(value).replace(/[^0-9.]/g, "")) || 0)); state.globalVolume = n; localStorage.setItem("orgavoxGlobalVolume", String(n)); if (ui.globalVolumeSlider) ui.globalVolumeSlider.value = n; node.textContent = `${Math.round(n)}%`; return true; }));
      bind(ui.volumeOut, "orgavoxVolumePopup", (node) => showNumber(node, "Clip volume", parseInt(node.textContent, 10) || 100, (value) => { const clip = selectedClip(); if (!clip) return false; const n = Math.max(0, Math.min(200, Number(String(value).replace(/[^0-9.]/g, "")) || 0)); clip.volume = n; if (ui.volumeSlider) ui.volumeSlider.value = n; syncSelectedControls(); renderTimeline(); window.orgavoxRecordHistory?.(); return true; }));
      bind(ui.echoOut, "orgavoxEchoPopup", (node) => showNumber(node, "Echo", parseInt(node.textContent, 10) || 0, (value) => { const clip = selectedClip(); if (!clip) return false; const n = Math.max(0, Math.min(100, Number(String(value).replace(/[^0-9.]/g, "")) || 0)); clip.echo = n; if (ui.echoSlider) ui.echoSlider.value = n; syncSelectedControls(); renderTimeline(); window.orgavoxRecordHistory?.(); return true; }));
      bind(ui.zoomOut, "orgavoxZoomPopup", (node) => showNumber(node, "Timeline zoom %", parseInt(node.textContent, 10) || 100, (value) => { const pct = Math.max(31, Math.min(625, Number(String(value).replace(/[^0-9.]/g, "")) || 100)); state.pixelsPerSecond = Math.max(25, Math.min(500, Math.round(pct / 100 * 80))); if (ui.zoomSlider) ui.zoomSlider.value = state.pixelsPerSecond; if (ui.zoomOut) ui.zoomOut.textContent = `${Math.round(state.pixelsPerSecond / 80 * 100)}%`; renderTimeline(); return true; }));
    }

    function patchRuntime() {
      if (window.__orgavoxVisibleUiOwnerRuntime106) return; window.__orgavoxVisibleUiOwnerRuntime106 = true;
      if (typeof renderTimeline === "function") { const old = renderTimeline; renderTimeline = function orgavoxUiOwnerRenderTimeline() { const result = old.apply(this, arguments); setTimeout(refresh, 0); return result; }; }
      if (typeof syncSelectedControls === "function") { const old = syncSelectedControls; syncSelectedControls = function orgavoxUiOwnerSyncSelectedControls() { const result = old.apply(this, arguments); const hasClip = Boolean(selectedClip()); [ui.deleteBtn, ui.downloadClipBtn, ui.reverseClipBtn, ui.bounceBtn, ui.scissorsBtn, ui.nudgeLeftBtn, ui.nudgeRightBtn, ui.alignPlayheadBtn, document.getElementById("analysisBtn")].filter(Boolean).forEach((btn) => { btn.disabled = !hasClip; }); return result; }; }
      document.addEventListener("click", (event) => { const target = event.target; if (!target.closest?.("#orgavoxEditDropdown,#orgavoxViewDropdown,#orgavoxEffectsDropdown,.orgavox-number-pop")) closeMenus(); if (target.closest?.(".audio-clip,.track-label,.asset-item,button,input,select,label,.popover,.modal-backdrop,.orgavox-analysis-modal,.orgavox-project-modal,.echo-settings-backdrop")) return; if (state.selectedClipId) { state.selectedClipId = null; state.selectedClipIds = []; syncSelectedControls(); document.querySelectorAll(".audio-clip.selected").forEach((clip) => clip.classList.remove("selected")); } }, true);
      document.addEventListener("keydown", (event) => { const target = event.target; const typing = target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable); if (typing || event.altKey || event.metaKey) return; if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); const step = event.shiftKey ? 1 : event.ctrlKey ? 0.1 : 0.01; setPlayhead((state.playhead || 0) + (event.key === "ArrowRight" ? step : -step), true); });
    }
    function refresh() { setVersion(); build(); ui.playBtn?.classList.toggle("orgavox-playing", Boolean(state.playing)); }
    window.orgavoxRefreshVisibleUi = refresh;
    patchRuntime(); refresh(); [50, 160, 400, 1000].forEach((delay) => setTimeout(refresh, delay));
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