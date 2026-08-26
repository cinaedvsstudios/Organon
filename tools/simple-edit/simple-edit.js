"use strict";

(async () => {
  const VERSION = "v1.02 set 2";
  const REMOTE_SOUND_FX = "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/";
  const LOCAL_SOUND_FX = "./soundeffects/";
  window.ORGAVOX_VERSION = VERSION;
  document.documentElement.classList.add("orgavox-loading");

  function setFinalVersion() {
    document.title = `Organon — ORGAVOX ${VERSION}`;
    const mark = document.querySelector(".brand-mark");
    if (mark) mark.textContent = "Φ";
    const brand = document.querySelector(".brand");
    const title = brand?.querySelector("h1");
    if (title) {
      let badge = title.querySelector(".phase1-version, .simple-edit-version");
      title.textContent = "ORGAVOX";
      if (!badge) badge = document.createElement("span");
      badge.className = "phase1-version simple-edit-version";
      badge.textContent = VERSION;
      title.appendChild(badge);
    }
    const subtitle = brand?.querySelector("p");
    if (subtitle) { subtitle.textContent = ""; subtitle.hidden = true; }
    document.querySelectorAll(".simple-edit-version,.phase1-version,.orgavox-sidebar-version").forEach((node) => { node.textContent = VERSION; });
    window.ORGAVOX_VERSION = VERSION;
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
    if (!window.__orgavoxLocalSoundFxAudioPatched && window.Audio) {
      window.__orgavoxLocalSoundFxAudioPatched = true;
      const NativeAudio = window.Audio;
      function OrgavoxAudio(src) { return src === undefined ? new NativeAudio() : new NativeAudio(localizeSoundFxUrl(src)); }
      OrgavoxAudio.prototype = NativeAudio.prototype;
      Object.setPrototypeOf(OrgavoxAudio, NativeAudio);
      window.Audio = OrgavoxAudio;
    }
  }

  function installMainUi() {
    if (window.__orgavoxMainUiV101) return;
    window.__orgavoxMainUiV101 = true;

    const STYLE_ID = "orgavox-main-ui-v101-style";
    const EDIT_ID = "orgavoxEditDropdown";
    const VIEW_ID = "orgavoxViewDropdown";
    const TRACK_COUNT = 10;
    const SNAP_VALUES = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
    let applying = false;
    let numberPopover = null;
    let scrubPointer = null;
    let suppressClickUntil = 0;
    let multiSelectLock = false;
    let blockShiftClickUntil = 0;
    let recentClipPointerAt = 0;
    let lastAssetAdd = null;

    function installStyles() {
      document.getElementById(STYLE_ID)?.remove();
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        @keyframes orgavoxPlayPulse{from{transform:scale(1);filter:brightness(1);box-shadow:0 0 0 1px rgba(117,178,222,.42),0 0 12px rgba(75,155,255,.28)}to{transform:scale(1.16);filter:brightness(1.35);box-shadow:0 0 0 1px rgba(168,220,255,.8),0 0 28px rgba(75,155,255,.74)}}
        body.simple-edit-phase1{--topbar-h:112px!important}
        body.simple-edit-phase1 .topbar{height:var(--topbar-h)!important;min-height:var(--topbar-h)!important;padding-top:12px!important;padding-bottom:8px!important}
        body.simple-edit-phase1 .brand p{display:none!important}
        body.simple-edit-phase1 .workspace{height:calc(100vh - var(--topbar-h))!important}
        body.simple-edit-phase1 .phase1-top-effects{padding-top:10px!important}
        body.simple-edit-phase1 .orgavox-edit-group{display:inline-flex!important;align-items:center!important;flex-wrap:nowrap!important;gap:8px!important;min-width:0!important}
        body.simple-edit-phase1 .orgavox-main-controls-group{display:inline-flex!important;align-items:center!important;flex-wrap:nowrap!important;gap:8px!important;min-width:0!important}
        body.simple-edit-phase1 .topbar .tool-button,body.simple-edit-phase1 .topbar .icon-button{min-height:36px!important;height:36px!important;align-items:center!important}
        body.simple-edit-phase1 .topbar .tool-button,body.simple-edit-phase1 .topbar .icon-button,body.simple-edit-phase1 .topbar .range-control span,body.simple-edit-phase1 .topbar .range-control output{font-size:.62rem!important;line-height:1!important;font-weight:800!important}
        body.simple-edit-phase1 .orgavox-edit-dropdown,body.simple-edit-phase1 .orgavox-view-dropdown{position:relative!important;display:inline-flex!important;align-items:center!important;flex:0 0 auto!important;visibility:visible!important;opacity:1!important;order:initial!important}
        body.simple-edit-phase1 .orgavox-edit-button{border-color:rgba(224,163,96,.82)!important;background:linear-gradient(180deg,rgba(93,67,35,.88),rgba(34,23,13,.95))!important;color:#ffe4a8!important}
        body.simple-edit-phase1 .orgavox-view-button{border-color:rgba(117,178,222,.86)!important;background:linear-gradient(180deg,rgba(35,80,124,.95),rgba(14,38,72,.98))!important;color:#e1f7ff!important;box-shadow:0 0 0 1px rgba(117,178,222,.2),0 0 14px rgba(75,155,255,.18)!important}
        body.simple-edit-phase1 .orgavox-edit-menu,body.simple-edit-phase1 .orgavox-view-menu{position:absolute!important;top:calc(100% + 8px)!important;left:0!important;z-index:4300!important;min-width:205px!important;display:grid!important;gap:6px!important;padding:8px!important;border:1px solid rgba(224,163,96,.65)!important;border-radius:14px!important;background:rgba(10,11,10,.98)!important;box-shadow:0 18px 44px rgba(0,0,0,.72)!important}
        body.simple-edit-phase1 .orgavox-view-menu{border-color:rgba(117,178,222,.68)!important}
        body.simple-edit-phase1 .orgavox-edit-menu[hidden],body.simple-edit-phase1 .orgavox-view-menu[hidden]{display:none!important}
        body.simple-edit-phase1 .orgavox-edit-menu .tool-button,body.simple-edit-phase1 .orgavox-view-menu .tool-button{width:100%!important;justify-content:flex-start!important;min-height:32px!important}
        body.simple-edit-phase1 #importBtn.orgavox-open-button{border-color:rgba(117,178,222,.92)!important;background:linear-gradient(180deg,rgba(57,132,205,.96),rgba(31,77,133,.94))!important;color:#eef8ff!important;box-shadow:0 0 0 1px rgba(117,178,222,.24),0 0 14px rgba(75,155,255,.24)!important}
        body.simple-edit-phase1 #exportBtn.orgavox-save-button{border-color:rgba(74,190,117,.86)!important;background:linear-gradient(180deg,rgba(35,118,66,.92),rgba(14,62,35,.94))!important;color:#e2ffe9!important;box-shadow:0 0 0 1px rgba(74,190,117,.22),0 0 14px rgba(74,190,117,.22)!important}
        body.simple-edit-phase1 #stopBtn.orgavox-stop-danger,body.simple-edit-phase1 #deleteBtn.orgavox-danger-tool,body.simple-edit-phase1 .orgavox-cut-clip-btn{border-color:rgba(220,72,64,.78)!important;background:linear-gradient(180deg,rgba(92,28,23,.88),rgba(39,13,10,.96))!important;color:#ffd8d2!important;box-shadow:0 0 0 1px rgba(220,72,64,.2),0 0 14px rgba(220,72,64,.2)!important}
        body.simple-edit-phase1 #scissorsBtn.orgavox-snip-tool{border-color:rgba(220,72,64,.76)!important;background:linear-gradient(180deg,rgba(89,29,26,.84),rgba(35,13,12,.94))!important;color:#ffd8d2!important;box-shadow:0 0 0 1px rgba(220,72,64,.2),0 0 14px rgba(220,72,64,.2)!important}
        body.simple-edit-phase1 .orgavox-fade-tool{border-color:rgba(74,190,117,.76)!important;background:linear-gradient(180deg,rgba(28,89,52,.74),rgba(12,42,25,.9))!important;color:#d6ffe4!important}
        body.simple-edit-phase1 .orgavox-effects-library-button{border-color:rgba(178,109,255,.86)!important;background:linear-gradient(180deg,rgba(87,46,148,.88),rgba(37,22,74,.96))!important;color:#f1ddff!important}
        body.simple-edit-phase1 .time-readout{font-size:.94rem!important;min-height:36px!important;padding:9px 14px!important;letter-spacing:.08em!important;cursor:pointer!important}
        body.simple-edit-phase1 #playBtn.orgavox-playing{animation:orgavoxPlayPulse .72s ease-in-out infinite alternate!important;transform-origin:center!important}
        body.simple-edit-phase1 #snapGridSelect{background:#050505!important;color:#f5f0db!important;border-color:rgba(117,178,222,.72)!important;box-shadow:0 0 0 1px rgba(117,178,222,.16)!important}
        body.simple-edit-phase1 #snapGridSelect option{background:#050505!important;color:#f5f0db!important}
        body.simple-edit-phase1 .track-lane.selected-track{background:linear-gradient(90deg,rgba(80,172,255,.24),rgba(117,178,222,.12))!important;box-shadow:inset 0 0 0 2px rgba(117,178,222,.72),inset 0 0 28px rgba(75,155,255,.28)!important}
        body.simple-edit-phase1 .audio-clip:not(.selected):not(.orgavox-multi-selected){outline:none!important;box-shadow:0 5px 16px rgba(0,0,0,.42)!important}
        body.simple-edit-phase1 .audio-clip.orgavox-cleared-selection{outline:none!important;box-shadow:0 5px 16px rgba(0,0,0,.42)!important;background-image:none!important;filter:none!important}
        body.simple-edit-phase1 .audio-clip.orgavox-multi-selected{outline:3px solid rgba(248,215,146,.92)!important;box-shadow:0 0 0 1px rgba(248,215,146,.45),0 0 24px rgba(248,215,146,.34),0 5px 16px rgba(0,0,0,.5)!important}
        body.simple-edit-phase1 .orgavox-track-volume-overlay{background:rgba(0,0,0,.78)!important;border:1px solid rgba(224,163,96,.32)!important;color:#f8d792!important;box-shadow:0 2px 8px rgba(0,0,0,.48)!important;cursor:pointer!important}
        body.simple-edit-phase1 .orgavox-track-info-btn{min-width:24px!important;width:24px!important;height:22px!important;min-height:22px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border:1px solid rgba(74,190,117,.9)!important;border-radius:7px!important;background:linear-gradient(180deg,rgba(34,126,66,.95),rgba(12,58,31,.98))!important;color:#e4ffed!important;font:900 .58rem var(--font-mono)!important;box-shadow:0 0 10px rgba(74,190,117,.24)!important;cursor:pointer!important}
        body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline{display:grid!important;grid-template-columns:auto minmax(60px,96px) 42px 34px!important;grid-template-rows:36px!important;align-items:center!important;gap:7px!important;min-width:206px!important;margin:0!important}
        body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline span,body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline input,body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline output{grid-row:1!important}
        body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline #echoSettingsBtn{grid-column:4!important;grid-row:1!important;align-self:center!important;justify-self:center!important;margin:0!important;width:32px!important;min-width:32px!important;height:32px!important;min-height:32px!important;padding:0!important}
        body.simple-edit-phase1 output{cursor:pointer!important}
        body.simple-edit-phase1 .orgavox-v101-divider{display:inline-flex!important;width:1px!important;min-width:1px!important;flex:0 0 1px!important;align-self:stretch!important;min-height:34px!important;margin:0 6px!important;background:linear-gradient(180deg,transparent,rgba(224,163,96,.58),transparent)!important;pointer-events:none!important}
        body.simple-edit-phase1 .orgavox-leading-divider{display:inline-flex!important;flex:0 0 1px!important;min-height:36px!important;margin-left:0!important}
        .orgavox-number-pop{position:fixed;z-index:999999;min-width:128px;padding:8px;border:1px solid rgba(224,163,96,.72);border-radius:12px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);display:grid;gap:6px}
        .orgavox-number-pop label{color:rgba(245,240,219,.72);font:800 .56rem var(--font-mono);text-transform:uppercase;letter-spacing:.08em}
        .orgavox-number-pop input{height:34px;border:1px solid rgba(117,178,222,.64);border-radius:9px;background:#050505;color:#f5f0db;padding:0 9px;font:900 .78rem var(--font-mono);outline:none}
        .orgavox-number-pop small{color:rgba(245,240,219,.5);font:700 .55rem var(--font-mono)}
        @media (max-width:1380px){body.simple-edit-phase1{--topbar-h:158px!important}}
      `;
      document.head.appendChild(style);
    }

    function tip(button, text) { if (!button || !text) return; button.title = text; button.setAttribute("aria-label", text); }
    function show(message) { if (typeof showToast === "function") showToast(message); }
    function clampTrack(track) { return Math.max(0, Math.min(TRACK_COUNT - 1, Number(track) || 0)); }
    function trackSettingsList() { if (!Array.isArray(state.trackSettings)) state.trackSettings = []; return state.trackSettings; }
    function selectedIds() {
      if (!Array.isArray(state.selectedClipIds)) state.selectedClipIds = state.selectedClipId ? [state.selectedClipId] : [];
      state.selectedClipIds = state.selectedClipIds.filter((id) => state.clips.some((clip) => clip.id === id));
      if (!state.selectedClipIds.length && state.selectedClipId) state.selectedClipIds = [state.selectedClipId];
      return state.selectedClipIds;
    }
    function selectedClips() { const ids = new Set(selectedIds()); return state.clips.filter((clip) => ids.has(clip.id)); }
    function formatSeconds(value) { const seconds = Math.max(0, Number(value) || 0); const mins = Math.floor(seconds / 60); const rest = seconds - mins * 60; return `${String(mins).padStart(2, "0")}:${rest.toFixed(3).padStart(6, "0")}`; }
    function parseTime(value) { const text = String(value || "").trim(); if (!text) return null; if (text.includes(":")) { const parts = text.split(":").map(Number); if (parts.some((part) => !Number.isFinite(part))) return null; return Math.max(0, parts.reduce((sum, part) => sum * 60 + part, 0)); } const number = Number(text.replace(/s$/i, "")); return Number.isFinite(number) ? Math.max(0, number) : null; }

    function closeMenus() {
      document.querySelectorAll(".orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu").forEach((panel) => { panel.hidden = true; });
      document.querySelectorAll(".orgavox-edit-button,.orgavox-view-button,.orgavox-effects-dropdown-button").forEach((button) => button.setAttribute("aria-expanded", "false"));
    }

    function menu(id, cls, buttonCls, label, title) {
      let wrap = document.getElementById(id);
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.id = id;
        wrap.className = cls;
        wrap.innerHTML = `<button class="tool-button ${buttonCls}" type="button" aria-expanded="false">${label}</button><div class="${buttonCls.replace("-button", "-menu")}" hidden></div>`;
      }
      wrap.className = cls;
      let button = wrap.querySelector(`.${buttonCls}`);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = `tool-button ${buttonCls}`;
        wrap.prepend(button);
      }
      let panel = wrap.querySelector(`.${buttonCls.replace("-button", "-menu")}`);
      if (!panel) {
        panel = document.createElement("div");
        panel.className = buttonCls.replace("-button", "-menu");
        panel.hidden = true;
        wrap.appendChild(panel);
      }
      button.textContent = label;
      tip(button, title);
      if (button.dataset.orgavoxMenuReady !== "true") {
        button.dataset.orgavoxMenuReady = "true";
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const open = panel.hidden;
          closeMenus();
          panel.hidden = !open;
          button.setAttribute("aria-expanded", String(open));
        });
      }
      return { wrap, button, panel };
    }

    function customButton(id, label, title, handler, className = "tool-button") {
      let button = document.getElementById(id);
      if (!button) {
        button = document.createElement("button");
        button.id = id;
        button.type = "button";
        button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); closeMenus(); handler(); });
      }
      button.textContent = label;
      button.className = className;
      tip(button, title);
      return button;
    }

    function copyClip() {
      const clips = selectedClips();
      if (!clips.length) return show("Select a clip to copy.");
      const earliest = Math.min(...clips.map((clip) => Number(clip.start) || 0));
      state.__orgavoxClipClipboard = clips.map((clip) => ({ ...clip, __relativeStart: (Number(clip.start) || 0) - earliest, volumeKeyframes: Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes.map((item) => ({ ...item })) : [] }));
      show(clips.length === 1 ? "Clip copied." : `${clips.length} clips copied.`);
    }
    function cutClip() {
      const clips = selectedClips();
      if (!clips.length) return show("Select a clip to cut.");
      copyClip();
      const ids = new Set(clips.map((clip) => clip.id));
      stopPlayback?.();
      state.clips = state.clips.filter((clip) => !ids.has(clip.id));
      state.selectedClipId = null;
      state.selectedClipIds = [];
      syncSelectedControls();
      renderTimeline();
      show(clips.length === 1 ? "Clip cut." : `${clips.length} clips cut.`);
      window.orgavoxRecordHistory?.();
    }
    function pasteClip() {
      const stored = Array.isArray(state.__orgavoxClipClipboard) ? state.__orgavoxClipClipboard : (state.__orgavoxClipClipboard ? [state.__orgavoxClipClipboard] : []);
      if (!stored.length) return show("No copied clip to paste.");
      const base = Math.max(0, Number(state.playhead) || 0);
      const pasted = stored.map((clip) => ({ ...clip, id: makeId("clip"), start: base + Math.max(0, Number(clip.__relativeStart) || 0), track: clampTrack(Number(state.selectedTrack) || Number(clip.track) || 0), cacheVersion: 0, volumeKeyframes: Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes.map((item) => ({ ...item, id: makeId("kf") })) : [] }));
      pasted.forEach((clip) => { delete clip.__relativeStart; });
      state.clips.push(...pasted);
      state.selectedClipId = pasted[pasted.length - 1]?.id || null;
      state.selectedClipIds = pasted.map((clip) => clip.id);
      renderTimeline();
      syncSelectedControls();
      show(pasted.length === 1 ? "Clip pasted at the playhead." : `${pasted.length} clips pasted at the playhead.`);
      window.orgavoxRecordHistory?.();
    }
    function clearAll() {
      if (!state.clips.length) return show("Timeline is already clear.");
      if (window.confirm && !confirm("Clear all clips from the timeline? Source files stay in the library.")) return;
      stopPlayback?.();
      state.clips = [];
      state.selectedClipId = null;
      state.selectedClipIds = [];
      syncSelectedControls();
      renderTimeline();
      show("All timeline clips cleared.");
      window.orgavoxRecordHistory?.();
    }

    function openMarkersPanel() {
      const modal = document.getElementById("markersModal");
      if (!modal) return show("Markers panel is still loading.");
      modal.hidden = false;
      const input = modal.querySelector("[data-marker-name]");
      if (input && !input.value.trim()) input.value = `Marker ${(state.markers?.length || 0) + 1}`;
      window.orgavoxRenderMarkers?.();
      show("Markers panel opened.");
    }
    function sendToStart() {
      const clips = selectedClips();
      if (!clips.length) return show("Select a clip to send to start.");
      stopPlayback?.();
      if (clips.length === 1) clips[0].start = 0;
      else {
        const earliest = Math.min(...clips.map((clip) => Math.max(0, Number(clip.start) || 0)));
        clips.forEach((clip) => { clip.start = Math.max(0, (Number(clip.start) || 0) - earliest); });
      }
      renderTimeline();
      syncSelectedControls();
      show(clips.length === 1 ? "Clip sent to start." : `${clips.length} clips sent to start.`);
      window.orgavoxRecordHistory?.();
    }
    function autoAnalyze() {
      const clip = state.clips.find((item) => item.id === state.selectedClipId) || state.clips.find((item) => Number(item.track) === Number(state.selectedTrack)) || state.clips[0];
      if (!clip) return show("Select a clip or track to analyze.");
      selectClip(clip.id);
      selectTrack(clip.track);
      const modal = document.getElementById("analysisModal");
      if (!modal) return show("Analyze panel is still loading.");
      modal.hidden = false;
      const summary = modal.querySelector("[data-analysis-summary]");
      if (summary) summary.textContent = `${clip.name} · scanning selected clip…`;
      setTimeout(() => modal.querySelector("[data-analysis-scan]")?.click(), 0);
      show(`Analyzing ${clip.name}.`);
    }
    function analyzeTrack(track) {
      const index = clampTrack(track);
      selectTrack(index);
      const clip = state.clips.find((item) => Number(item.track) === index);
      if (clip) selectClip(clip.id);
      autoAnalyze();
    }

    function ensureAnalysisPicker() {
      const modal = document.getElementById("analysisModal");
      const dialog = modal?.querySelector(".orgavox-analysis-dialog") || modal?.querySelector("section,.export-dialog,.popover");
      if (!dialog) return null;
      let wrap = dialog.querySelector(".orgavox-analysis-picker-wrap");
      if (!wrap) {
        wrap = document.createElement("label");
        wrap.className = "orgavox-analysis-picker-wrap";
        wrap.innerHTML = `<span>Clip / track to analyze</span><select class="orgavox-analysis-picker"></select>`;
        dialog.prepend(wrap);
      }
      const select = wrap.querySelector("select");
      select.innerHTML = "";
      state.clips.slice().sort((a, b) => a.track - b.track || a.start - b.start).forEach((clip) => {
        const option = document.createElement("option");
        option.value = clip.id;
        option.textContent = `Track ${clip.track + 1} · ${formatSeconds(clip.start)} · ${clip.name}`;
        select.appendChild(option);
      });
      if (!state.clips.length) select.innerHTML = `<option value="">No clips in timeline</option>`;
      else select.value = state.selectedClipId && state.clips.some((clip) => clip.id === state.selectedClipId) ? state.selectedClipId : state.clips[0].id;
      if (select.dataset.orgavoxReady !== "true") {
        select.dataset.orgavoxReady = "true";
        select.addEventListener("change", () => {
          const clip = state.clips.find((item) => item.id === select.value);
          if (!clip) return;
          selectClip(clip.id);
          selectTrack(clip.track);
          syncSelectedControls();
          show(`Selected ${clip.name} for analysis.`);
        });
      }
      return select;
    }

    function ensureEditMenu() {
      const made = menu(EDIT_ID, "orgavox-edit-dropdown", "orgavox-edit-button", "✎ Edit ▾", "Edit selected clips");
      const copy = customButton("orgavoxCopyClipBtn", "⧉ Copy", "Copy the selected clip", copyClip);
      const cut = customButton("orgavoxCutClipBtn", "✂ Cut", "Remove selected clip and store it for Paste", cutClip, "tool-button orgavox-cut-clip-btn");
      const paste = customButton("orgavoxPasteClipBtn", "⧉ Paste", "Paste copied clip at the playhead", pasteClip);
      const clear = customButton("orgavoxClearTimelineBtn", "🧹 Clear All", "Clear all clips from the timeline", clearAll);
      [copy, cut, paste, clear, ui.deleteBtn, ui.downloadClipBtn].filter(Boolean).forEach((button) => {
        if (button === ui.deleteBtn) { button.textContent = "🗑 DEL"; tip(button, "Delete the selected clip"); }
        if (button === ui.downloadClipBtn) { button.textContent = "⬇ Download Clip"; tip(button, "Download the selected clip"); }
        if (button.parentElement !== made.panel) made.panel.appendChild(button);
      });
      return made.wrap;
    }

    function ensureViewMenu() {
      const made = menu(VIEW_ID, "orgavox-view-dropdown", "orgavox-view-button", "👁 View ▾", "Open marker, alignment and analysis tools");
      const markerPanel = customButton("orgavoxMarkerPanelBtn", "🏷 Markers Panel", "Open marker names, colors and cue list", openMarkersPanel);
      const sendStart = customButton("orgavoxSendToStartBtn", "↤ Send to Start", "Move the selected clip to 0:00", sendToStart);
      [markerPanel, sendStart].forEach((button) => { if (button.parentElement !== made.panel) made.panel.appendChild(button); });
      if (ui.alignPlayheadBtn) {
        ui.alignPlayheadBtn.textContent = "⤓ Align to Playhead";
        tip(ui.alignPlayheadBtn, "Align selected clip start to the playhead");
        if (ui.alignPlayheadBtn.parentElement !== made.panel) made.panel.appendChild(ui.alignPlayheadBtn);
      }
      if (ui.analysisBtn) {
        ui.analysisBtn.textContent = "📈 Analyze";
        tip(ui.analysisBtn, "Analyze the selected clip immediately");
        if (ui.analysisBtn.parentElement !== made.panel) made.panel.appendChild(ui.analysisBtn);
        if (ui.analysisBtn.dataset.orgavoxAnalyzeDirect !== "true") {
          ui.analysisBtn.dataset.orgavoxAnalyzeDirect = "true";
          ui.analysisBtn.addEventListener("click", (event) => { event.preventDefault(); event.stopImmediatePropagation(); closeMenus(); autoAnalyze(); }, true);
        }
      }
      made.wrap.hidden = false;
      made.wrap.style.display = "inline-flex";
      return made.wrap;
    }

    function insertAfter(anchor, node) {
      if (!anchor?.parentElement || !node) return node;
      if (anchor.nextSibling !== node) anchor.parentElement.insertBefore(node, anchor.nextSibling);
      return node;
    }

    function orderToolbar() {
      const edit = ensureEditMenu();
      const view = ensureViewMenu();
      const group = document.querySelector(".orgavox-edit-group") || document.querySelector(".toolbar-actions") || ui.scissorsBtn?.parentElement;
      if (!group) return;
      const effects = group.querySelector(".orgavox-effects-dropdown") || document.querySelector(".orgavox-effects-dropdown");
      const marker = ui.markersBtn || document.getElementById("markersBtn");
      const nudgeLeft = ui.nudgeLeftBtn || document.getElementById("nudgeLeftBtn");
      const nudgeRight = ui.nudgeRightBtn || document.getElementById("nudgeRightBtn");
      const snap = ui.snapBtn || document.getElementById("snapGridBtn");
      const snapGrid = ui.snapGridSelect || document.getElementById("snapGridSelect");
      const redo = ui.redoBtn || document.getElementById("redoBtn");
      if (marker) { marker.textContent = "🏷 Add Marker"; tip(marker, "Add a marker at the playhead"); }
      let anchor = redo?.parentElement === group ? redo : group.firstElementChild;
      if (anchor === edit || anchor === view) anchor = null;
      [edit, view, effects, marker, nudgeLeft, nudgeRight, snap, snapGrid].filter(Boolean).forEach((node) => {
        if (anchor) insertAfter(anchor, node);
        else if (node.parentElement !== group || group.firstChild !== node) group.insertBefore(node, group.firstChild);
        anchor = node;
      });
      if (edit.parentElement && view.previousElementSibling !== edit) edit.parentElement.insertBefore(view, edit.nextSibling);
      edit.style.display = "inline-flex";
      view.style.display = "inline-flex";
      view.hidden = false;
    }

    function restoreEchoSettings() {
      const button = document.getElementById("echoSettingsBtn") || ui.echoSettingsBtn;
      const control = ui.echoSlider?.closest(".range-control");
      if (!button || !control || !ui.echoOut) return;
      control.classList.remove("orgavox-echo-inline-v054", "orgavox-echo-inline-v055");
      control.classList.add("orgavox-echo-inline");
      if (button.parentElement !== control || button.previousElementSibling !== ui.echoOut) ui.echoOut.insertAdjacentElement("afterend", button);
      ui.echoSettingsBtn = button;
    }

    function addControlDividers() {
      Array.from(document.querySelectorAll(".topbar .range-control,.clip-controls .range-control")).forEach((control) => {
        const label = (control.querySelector("span")?.textContent || control.textContent || "").toLowerCase();
        const key = label.includes("master") ? "master" : (label.includes("volume") && !label.includes("zoom") ? "volume" : (label.includes("echo") ? "echo" : ""));
        if (!key || control.dataset.orgavoxDividerKey === key) return;
        const before = document.createElement("span");
        before.className = `orgavox-v101-divider orgavox-before-${key}`;
        before.setAttribute("aria-hidden", "true");
        const after = document.createElement("span");
        after.className = `orgavox-v101-divider orgavox-after-${key}`;
        after.setAttribute("aria-hidden", "true");
        control.parentElement?.insertBefore(before, control);
        control.parentElement?.insertBefore(after, control.nextSibling);
        control.dataset.orgavoxDividerKey = key;
      });
    }

    function ensureLeadingTransportDivider() {
      const row = document.querySelector(".orgavox-toolbar-row");
      const transport = row?.querySelector(".orgavox-transport-group");
      if (!row || !transport) return;
      let divider = row.querySelector(".orgavox-leading-divider");
      if (!divider) {
        divider = document.createElement("span");
        divider.className = "orgavox-v101-divider orgavox-leading-divider";
        divider.setAttribute("aria-hidden", "true");
      }
      if (transport.previousElementSibling !== divider) row.insertBefore(divider, transport);
    }

    function setSnapOptions() {
      const select = ui.snapGridSelect || document.getElementById("snapGridSelect");
      if (!select) return;
      const current = Number(select.value) || Number(state.snapGrid) || 0.1;
      select.innerHTML = "";
      SNAP_VALUES.forEach((value) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        select.appendChild(option);
      });
      const next = SNAP_VALUES.includes(current) ? current : 0.1;
      select.value = String(next);
      state.snapGrid = next;
      if (select.dataset.orgavoxV101Snap !== "true") {
        select.dataset.orgavoxV101Snap = "true";
        select.addEventListener("change", () => { state.snapGrid = Number(select.value) || 0.1; show(`Snap ${state.snapGrid}s.`); });
      }
    }
    function currentSnap() { const value = Number((ui.snapGridSelect || document.getElementById("snapGridSelect"))?.value || state.snapGrid || 0.1); return Number.isFinite(value) && value > 0 ? value : 0.1; }
    function nudgeSelected(direction) {
      const clips = selectedClips();
      if (!clips.length) return show("Select a clip to nudge.");
      const amount = currentSnap() * (direction < 0 ? -1 : 1);
      clips.forEach((clip) => { clip.start = Math.max(0, (Number(clip.start) || 0) + amount); });
      renderTimeline();
      syncSelectedControls();
      show(`${clips.length === 1 ? "Clip" : "Clips"} nudged ${Math.abs(amount)}s.`);
      window.orgavoxRecordHistory?.();
    }
    function installNudgeHandlers() {
      const left = ui.nudgeLeftBtn || document.getElementById("nudgeLeftBtn");
      const right = ui.nudgeRightBtn || document.getElementById("nudgeRightBtn");
      if (left && left.dataset.orgavoxV101Nudge !== "true") { left.dataset.orgavoxV101Nudge = "true"; left.addEventListener("click", (event) => { event.preventDefault(); event.stopImmediatePropagation(); nudgeSelected(-1); }, true); }
      if (right && right.dataset.orgavoxV101Nudge !== "true") { right.dataset.orgavoxV101Nudge = "true"; right.addEventListener("click", (event) => { event.preventDefault(); event.stopImmediatePropagation(); nudgeSelected(1); }, true); }
    }

    function ensureStepButtons() {
      const group = document.querySelector(".orgavox-transport-group") || ui.timeReadout?.parentElement;
      if (!group || !ui.timeReadout) return;
      if (!ui.playheadBackStepBtn) {
        const button = document.createElement("button");
        button.id = "playheadBackStepBtn";
        button.type = "button";
        button.className = "icon-button orgavox-playhead-step-button";
        button.textContent = "←";
        tip(button, "Move playhead back 0.01 seconds");
        button.addEventListener("click", () => setPlayhead(Math.max(0, (Number(state.playhead) || 0) - 0.01), true));
        ui.playheadBackStepBtn = button;
      }
      if (!ui.playheadForwardStepBtn) {
        const button = document.createElement("button");
        button.id = "playheadForwardStepBtn";
        button.type = "button";
        button.className = "icon-button orgavox-playhead-step-button";
        button.textContent = "→";
        tip(button, "Move playhead forward 0.01 seconds");
        button.addEventListener("click", () => setPlayhead(Math.max(0, (Number(state.playhead) || 0) + 0.01), true));
        ui.playheadForwardStepBtn = button;
      }
      if (ui.playheadBackStepBtn.previousElementSibling !== ui.timeReadout) group.insertBefore(ui.playheadBackStepBtn, ui.timeReadout.nextSibling);
      if (ui.playheadForwardStepBtn.previousElementSibling !== ui.playheadBackStepBtn) group.insertBefore(ui.playheadForwardStepBtn, ui.playheadBackStepBtn.nextSibling);
    }

    function updateSelectedSummary() { const ids = selectedIds(); if (ids.length > 1 && ui.selectedClipName) ui.selectedClipName.textContent = `${ids.length} clips selected`; }
    function applySelectionClasses() {
      const ids = new Set(selectedIds());
      document.querySelectorAll(".audio-clip").forEach((element) => {
        const active = ids.has(element.dataset.clipId) || element.dataset.clipId === state.selectedClipId;
        element.classList.toggle("selected", active);
        element.classList.toggle("orgavox-multi-selected", active && ids.size > 1);
        element.classList.toggle("orgavox-cleared-selection", !active);
      });
      updateSelectedSummary();
    }
    function deselectClips() {
      if (!state.selectedClipId && !(Array.isArray(state.selectedClipIds) && state.selectedClipIds.length)) return;
      state.selectedClipId = null;
      state.selectedClipIds = [];
      syncSelectedControls();
      applySelectionClasses();
    }
    function installDeselect() {
      if (window.__orgavoxV101Deselect) return;
      window.__orgavoxV101Deselect = true;
      document.addEventListener("pointerdown", (event) => {
        const target = event.target;
        if (!target) return;
        if (target.closest?.(".audio-clip,.clip-handle,button,input,select,textarea,label,.popover,.modal-backdrop,.orgavox-edit-dropdown,.orgavox-view-dropdown,.orgavox-effects-dropdown,.asset-list,.library-panel")) return;
        if (target.closest?.(".track-lane,.tracks,.timeline-scroll,.timeline-content,#rulerCanvas")) deselectClips();
      }, true);
    }

    function decorateTrackVolumeOverlays() {
      document.querySelectorAll(".track-lane").forEach((lane) => {
        const index = clampTrack(lane.dataset.track);
        const setting = trackSettingsList()[index] || {};
        const volume = Number.isFinite(Number(setting.volume)) ? Math.round(Number(setting.volume)) : 100;
        const bits = [`Track ${index + 1}`, `VOL ${volume}%`];
        if (setting.muted) bits.push("MUTED");
        if (setting.solo) bits.push("SOLO");
        let overlay = lane.querySelector(".orgavox-track-volume-overlay");
        if (!overlay) {
          overlay = document.createElement("div");
          overlay.className = "orgavox-track-volume-overlay";
          lane.appendChild(overlay);
        }
        overlay.textContent = bits.join(" · ");
        overlay.dataset.track = String(index);
      });
    }
    function ensureTrackInfoButtons() {
      document.querySelectorAll(".track-label").forEach((label) => {
        const index = Number.isFinite(Number(label.dataset.trackLabel)) ? Number(label.dataset.trackLabel) : Math.max(0, Number(label.querySelector("span")?.textContent || 1) - 1);
        let button = label.querySelector(".orgavox-track-info-btn");
        if (!button) {
          button = document.createElement("button");
          button.type = "button";
          button.className = "orgavox-track-info-btn";
          button.textContent = "i";
          button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); analyzeTrack(index); });
        }
        button.title = `Analyze Track ${index + 1}`;
        button.setAttribute("aria-label", button.title);
        const solo = label.querySelector(".orgavox-track-mix-btn.solo");
        if (solo && button.previousElementSibling !== solo) solo.insertAdjacentElement("afterend", button);
        else if (!solo && button.parentElement !== label) label.appendChild(button);
      });
    }
    function decorateTracks() { decorateTrackVolumeOverlays(); applySelectionClasses(); ensureTrackInfoButtons(); }

    function installFunctionWrappers() {
      if (window.__orgavoxFunctionWrappersV101) return;
      window.__orgavoxFunctionWrappersV101 = true;
      if (typeof selectClip === "function") {
        const oldSelect = selectClip;
        selectClip = function orgavoxSelectClipV101(id) { const result = oldSelect.apply(this, arguments); if (!multiSelectLock) state.selectedClipIds = id ? [id] : []; decorateTracks(); return result; };
      }
      if (typeof syncSelectedControls === "function") {
        const oldSync = syncSelectedControls;
        syncSelectedControls = function orgavoxSyncSelectedControlsV101() { const result = oldSync.apply(this, arguments); updateSelectedSummary(); ensureAnalysisPicker(); return result; };
      }
      if (typeof renderTimeline === "function") {
        const oldRender = renderTimeline;
        renderTimeline = function orgavoxRenderTimelineV101() { const result = oldRender.apply(this, arguments); refreshUi(); return result; };
      }
      if (typeof deleteSelectedClip === "function") {
        const oldDelete = deleteSelectedClip;
        deleteSelectedClip = function orgavoxDeleteSelectedClipV101() {
          const ids = selectedIds();
          if (ids.length <= 1) return oldDelete.apply(this, arguments);
          stopPlayback?.();
          state.clips = state.clips.filter((clip) => !ids.includes(clip.id));
          state.selectedClipIds = [];
          state.selectedClipId = null;
          syncSelectedControls();
          renderTimeline();
          show(`${ids.length} selected clips deleted.`);
          window.orgavoxRecordHistory?.();
        };
      }
    }

    function installShiftMultiSelect() {
      if (window.__orgavoxShiftMultiSelect) return;
      window.__orgavoxShiftMultiSelect = true;
      document.addEventListener("pointerdown", (event) => {
        const element = event.target.closest?.(".audio-clip");
        if (!element || !event.shiftKey || !ui.tracks?.contains(element)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        blockShiftClickUntil = Date.now() + 450;
        const id = element.dataset.clipId;
        let ids = selectedIds().slice();
        if (ids.includes(id)) ids = ids.length > 1 ? ids.filter((item) => item !== id) : ids;
        else ids.push(id);
        state.selectedClipIds = ids;
        state.selectedClipId = id;
        multiSelectLock = true;
        try { selectClip(id, true); } finally { multiSelectLock = false; }
        state.selectedClipIds = ids;
        applySelectionClasses();
        syncSelectedControls();
      }, true);
      document.addEventListener("click", (event) => {
        if (!event.target.closest?.(".audio-clip") || !event.shiftKey) return;
        if (Date.now() < blockShiftClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
      }, true);
    }

    function installKeyboard() {
      if (window.__orgavoxKeyboardV101) return;
      window.__orgavoxKeyboardV101 = true;
      document.addEventListener("keydown", (event) => {
        const target = event.target;
        const typing = target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable);
        if (typing || event.defaultPrevented || event.altKey) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const amount = event.shiftKey ? 1 : (event.ctrlKey || event.metaKey ? 0.1 : 0.01);
        setPlayhead(Math.max(0, (Number(state.playhead) || 0) + (event.key === "ArrowLeft" ? -amount : amount)), true);
      }, true);
    }

    function timeFromEvent(event) { const rect = ui.timelineScroll.getBoundingClientRect(); return Math.max(0, ((event.clientX - rect.left) + ui.timelineScroll.scrollLeft) / Math.max(1, Number(state.pixelsPerSecond) || 80)); }
    function scrubHit(event) {
      const target = event.target;
      if (!target || !ui.timelineScroll?.contains(target)) return null;
      if (target.closest?.(".audio-clip,.clip-handle,button,input,select,textarea,label,.track-label-column,.asset-list,.library-panel,.popover,.modal-backdrop")) return null;
      const lane = target.closest?.(".track-lane");
      if (target === ui.rulerCanvas || lane || target.closest?.("#tracks,.tracks,.timeline-content")) return { lane };
      return null;
    }
    function installScrub() {
      if (!ui.timelineScroll || ui.timelineScroll.dataset.orgavoxScrub === "true") return;
      ui.timelineScroll.dataset.orgavoxScrub = "true";
      ui.timelineScroll.addEventListener("pointerdown", (event) => {
        if (event.button != null && event.button !== 0) return;
        const hit = scrubHit(event);
        if (!hit) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (hit.lane) selectTrack(hit.lane.dataset.track);
        scrubPointer = event.pointerId;
        ui.timelineScroll.classList.add("orgavox-scrubbing");
        ui.timelineScroll.setPointerCapture?.(event.pointerId);
        setPlayhead(timeFromEvent(event), false);
      }, true);
      ui.timelineScroll.addEventListener("pointermove", (event) => { if (scrubPointer == null || event.pointerId !== scrubPointer) return; event.preventDefault(); event.stopImmediatePropagation(); setPlayhead(timeFromEvent(event), false); }, true);
      function done(event) { if (scrubPointer == null || event.pointerId !== scrubPointer) return; event.preventDefault(); event.stopImmediatePropagation(); ui.timelineScroll.releasePointerCapture?.(event.pointerId); ui.timelineScroll.classList.remove("orgavox-scrubbing"); scrubPointer = null; suppressClickUntil = Date.now() + 220; }
      ui.timelineScroll.addEventListener("pointerup", done, true);
      ui.timelineScroll.addEventListener("pointercancel", done, true);
      ui.timelineScroll.addEventListener("click", (event) => { if (Date.now() > suppressClickUntil || !scrubHit(event)) return; event.preventDefault(); event.stopImmediatePropagation(); }, true);
    }

    function installDragCopyGuard() {
      if (window.__orgavoxDragCopyGuard) return;
      window.__orgavoxDragCopyGuard = true;
      document.addEventListener("pointerdown", (event) => { if (!event.target.closest?.(".audio-clip")) return; recentClipPointerAt = Date.now(); state.dragAssetId = null; }, true);
      document.addEventListener("dragstart", (event) => { if (!event.target.closest?.(".audio-clip")) return; event.preventDefault(); event.stopImmediatePropagation(); recentClipPointerAt = Date.now(); state.dragAssetId = null; }, true);
      document.addEventListener("drop", (event) => { if (!ui.timelineScroll?.contains(event.target)) return; if (Date.now() - recentClipPointerAt < 1400 && !state.dragAssetId) { event.preventDefault(); event.stopImmediatePropagation(); return; } setTimeout(() => { state.dragAssetId = null; }, 0); }, true);
      if (typeof addClipFromAsset === "function" && !window.__orgavoxAddClipGuarded) {
        window.__orgavoxAddClipGuarded = true;
        const oldAdd = addClipFromAsset;
        addClipFromAsset = function orgavoxGuardedAddClipFromAsset(assetId, track, start) {
          const now = Date.now();
          const t = clampTrack(track);
          const s = Math.max(0, Number(start) || 0);
          const repeat = lastAssetAdd && now - lastAssetAdd.time < 900 && String(assetId || "") === lastAssetAdd.assetId && t === lastAssetAdd.track && Math.abs(s - lastAssetAdd.start) < 0.3;
          const suspicious = now - recentClipPointerAt < 700 && !state.dragAssetId;
          if (repeat || suspicious) { show("Duplicate clip add ignored."); return null; }
          const before = state.clips.length;
          const result = oldAdd.apply(this, arguments);
          if (state.clips.length > before) lastAssetAdd = { time: now, assetId: String(assetId || ""), track: t, start: s };
          return result;
        };
      }
    }

    function syncPlayButton() {
      const active = Boolean(state.isPlaying || state.playing || state.playbackActive || ui.playBtn?.textContent?.includes("❚") || ui.playBtn?.textContent?.includes("Ⅱ"));
      ui.playBtn?.classList.toggle("orgavox-playing", active);
    }
    function installPlaybackState() {
      if (window.__orgavoxPlaybackStateV101) return;
      window.__orgavoxPlaybackStateV101 = true;
      if (typeof startPlayback === "function") { const oldStart = startPlayback; startPlayback = function orgavoxStartPlaybackV101() { const result = oldStart.apply(this, arguments); setTimeout(syncPlayButton, 0); return result; }; }
      if (typeof stopPlayback === "function") { const oldStop = stopPlayback; stopPlayback = function orgavoxStopPlaybackV101() { const result = oldStop.apply(this, arguments); setTimeout(syncPlayButton, 0); return result; }; }
      ui.playBtn?.addEventListener("click", () => setTimeout(syncPlayButton, 60), true);
      setInterval(syncPlayButton, 200);
    }

    function openNumberPopover(anchor, label, value, apply) {
      numberPopover?.remove();
      const rect = anchor.getBoundingClientRect();
      numberPopover = document.createElement("form");
      numberPopover.className = "orgavox-number-pop";
      numberPopover.innerHTML = `<label>${label}</label><input type="text"><small>Enter to apply · Esc to cancel</small>`;
      const input = numberPopover.querySelector("input");
      input.value = String(value ?? "");
      numberPopover.style.left = `${Math.min(window.innerWidth - 150, Math.max(8, rect.left))}px`;
      numberPopover.style.top = `${Math.min(window.innerHeight - 96, rect.bottom + 8)}px`;
      numberPopover.addEventListener("submit", (event) => { event.preventDefault(); const ok = apply(input.value.trim()); if (ok !== false) numberPopover?.remove(); });
      input.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); numberPopover?.remove(); } });
      document.body.appendChild(numberPopover);
      input.select();
      input.focus();
    }
    function applyOutputValue(output, value) {
      const n = Number(String(value).replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(n)) { show("Enter a number."); return false; }
      const id = output.id || "";
      const label = (output.closest(".range-control")?.querySelector("span")?.textContent || "").toLowerCase();
      if (id === "volumeOut" || label === "volume") { const clips = selectedClips(); if (!clips.length) return false; const next = Math.max(0, Math.min(200, n)); clips.forEach((clip) => { clip.volume = next; }); if (ui.volumeSlider) ui.volumeSlider.value = next; output.textContent = `${Math.round(next)}%`; renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); return true; }
      if (id === "echoOut" || label.includes("echo")) { const clips = selectedClips(); if (!clips.length) return false; const next = Math.max(0, Math.min(100, n)); clips.forEach((clip) => { clip.echo = next; }); if (ui.echoSlider) ui.echoSlider.value = next; output.textContent = `${Math.round(next)}%`; syncSelectedControls(); window.orgavoxRecordHistory?.(); return true; }
      if (id === "zoomOut" || label.includes("zoom")) { const percent = Math.max(25, Math.min(500, n)); state.pixelsPerSecond = Math.max(25, Math.min(500, Math.round(80 * percent / 100))); if (ui.zoomSlider) ui.zoomSlider.value = state.pixelsPerSecond; output.textContent = `${Math.round(percent)}%`; renderTimeline(); return true; }
      if (label.includes("master")) { const next = Math.max(0, Math.min(200, n)); state.masterVolume = next; output.textContent = `${Math.round(next)}%`; const input = output.closest(".range-control")?.querySelector("input[type='range']"); if (input) input.value = next; window.orgavoxRecordHistory?.(); return true; }
      return false;
    }
    function installEditableValues() {
      if (window.__orgavoxEditableValuesV101) return;
      window.__orgavoxEditableValuesV101 = true;
      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!target) return;
        if (target === ui.timeReadout || target.id === "timeReadout") {
          event.preventDefault();
          openNumberPopover(target, "Playhead time", target.textContent || formatSeconds(state.playhead), (value) => { const seconds = parseTime(value); if (seconds == null) { show("Use seconds or mm:ss.xxx."); return false; } setPlayhead(seconds, true); return true; });
          return;
        }
        if (target.matches?.("output")) {
          const output = target;
          const label = output.closest(".range-control")?.querySelector("span")?.textContent || "Value";
          openNumberPopover(output, label, output.textContent || "", (value) => applyOutputValue(output, value));
          return;
        }
        const overlay = target.closest?.(".orgavox-track-volume-overlay");
        if (overlay) {
          const track = clampTrack(overlay.dataset.track || overlay.closest(".track-lane")?.dataset.track || 0);
          const setting = trackSettingsList()[track] || (trackSettingsList()[track] = {});
          const volume = Number.isFinite(Number(setting.volume)) ? Math.round(Number(setting.volume)) : 100;
          openNumberPopover(overlay, `Track ${track + 1} volume`, volume, (value) => { const next = Math.max(0, Math.min(200, Number(value))); if (!Number.isFinite(next)) { show("Enter a number."); return false; } setting.volume = next; decorateTrackVolumeOverlays(); renderTimeline(); window.orgavoxRecordHistory?.(); return true; });
        }
      }, true);
    }

    function finalButtonStyling() {
      if (ui.importBtn) { ui.importBtn.textContent = "📥 Open"; ui.importBtn.classList.remove("primary"); ui.importBtn.classList.add("orgavox-open-button"); }
      if (ui.exportBtn) { ui.exportBtn.textContent = "💾 Save"; ui.exportBtn.classList.add("orgavox-save-button"); }
      if (ui.stopBtn) ui.stopBtn.classList.add("orgavox-stop-danger");
      if (ui.scissorsBtn) { ui.scissorsBtn.textContent = "✂️ Snip"; ui.scissorsBtn.classList.remove("orgavox-danger-tool"); ui.scissorsBtn.classList.add("orgavox-snip-tool"); tip(ui.scissorsBtn, "Snip/split the selected clip at the playhead"); }
      if (ui.deleteBtn) { ui.deleteBtn.textContent = "🗑 DEL"; ui.deleteBtn.classList.add("orgavox-danger-tool"); }
      [ui.fadeInBtn, ui.fadeOutBtn, ui.resetFadesBtn].filter(Boolean).forEach((button) => button.classList.add("orgavox-fade-tool"));
      const effectsLibrary = document.querySelector(".effects-library-button") || [...document.querySelectorAll("button")].find((button) => /effects library/i.test(button.textContent || ""));
      if (effectsLibrary) effectsLibrary.classList.add("orgavox-effects-library-button");
    }
    function placeFeatureButtons() { const menu = document.querySelector(".orgavox-effects-menu"); if (menu) [ui.gateBtn, ui.stretchBtn, ui.normalizeBtn, ui.transposeBtn, ui.eqBtn, ui.driveBtn, ui.dynamicsBtn, ui.stereoBtn, ui.lofiBtn, ui.reverseClipBtn].filter(Boolean).forEach((button) => { if (button.parentElement !== menu) menu.appendChild(button); }); }
    function tooltips() { [[ui.importBtn, "Open/import audio or video files"], [ui.exportBtn, "Save/export the full mix"], [ui.projectBtn, "Save or load an ORGAVOX project"], [ui.undoBtn, "Undo the last edit"], [ui.redoBtn, "Redo the last undone edit"], [ui.playBtn, "Play or pause"], [ui.stopBtn, "Stop playback"], [ui.jumpStartBtn, "Jump back to the start"], [ui.scissorsBtn, "Snip/split the selected clip at the playhead"], [ui.deleteBtn, "Delete the selected clip"], [ui.downloadClipBtn, "Download the selected clip"], [ui.markersBtn, "Add a marker at the playhead"], [ui.snapBtn, "Toggle snap-to-grid"], [ui.snapGridSelect, "Choose snap grid size"], [ui.nudgeLeftBtn, "Nudge selected clip left by Snap"], [ui.nudgeRightBtn, "Nudge selected clip right by Snap"], [ui.alignPlayheadBtn, "Align selected clip to the playhead"], [ui.analysisBtn, "Analyze the selected clip"], [document.querySelector(".orgavox-effects-dropdown-button"), "Open audio effects"], [document.querySelector(".orgavox-edit-button"), "Open editing commands"], [document.querySelector(".orgavox-view-button"), "Open marker, alignment and analysis tools"]].forEach(([button, title]) => tip(button, title)); }

    function refreshUi() {
      if (applying) return;
      applying = true;
      try {
        setFinalVersion();
        installStyles();
        window.orgavoxRefreshLayout?.();
        window.orgavoxPlaceProjectButton?.();
        window.orgavoxUpdateProjectInfoBar?.();
        window.orgavoxPlaceMarkersButton?.();
        window.orgavoxRenderMarkers?.();
        window.orgavoxPlaceBuild1Controls?.();
        window.orgavoxSyncPlaybackPolish?.();
        window.orgavoxRefreshTrackTools?.();
        window.orgavoxPlaceClipRenderButtons?.();
        window.orgavoxPlaceSnapTools?.();
        window.orgavoxRefreshLibraryTools?.();
        window.orgavoxRefreshBuild6?.();
        window.orgavoxApplyFinalCleanup?.();
        restoreEchoSettings();
        ensureEditMenu();
        ensureViewMenu();
        placeFeatureButtons();
        ensureStepButtons();
        setSnapOptions();
        installNudgeHandlers();
        orderToolbar();
        addControlDividers();
        ensureLeadingTransportDivider();
        finalButtonStyling();
        ensureAnalysisPicker();
        decorateTracks();
        syncPlayButton();
        tooltips();
      } finally { applying = false; }
    }

    window.orgavoxRefreshV101 = refreshUi;
    installStyles();
    installFunctionWrappers();
    installShiftMultiSelect();
    installKeyboard();
    installDeselect();
    installScrub();
    installDragCopyGuard();
    installPlaybackState();
    installEditableValues();
    refreshUi();
    [0, 100, 250, 500, 1200, 2200].forEach((delay) => setTimeout(refreshUi, delay));
    window.addEventListener("resize", () => setTimeout(refreshUi, 0));
    document.addEventListener("click", (event) => { if (!event.target.closest?.(`#${EDIT_ID},#${VIEW_ID},.orgavox-effects-dropdown`)) closeMenus(); });
  }

  installLocalSoundFxRouting();
  const files = [
    "./simple-edit-core.js?v=0.01", "./simple-edit-timeline.js?v=0.01", "./simple-edit-audio.js?v=0.26", "./simple-edit-export.js?v=0.02", "./simple-edit-phase1.js?v=0.33",
    "./simple-edit-keyframes.js?v=0.10", "./simple-edit-keyframes-fix.js?v=0.11", "./simple-edit-phase3.js?v=0.13", "./simple-edit-effects-library.js?v=0.15", "./simple-edit-echo-settings.js?v=0.51",
    "./simple-edit-stretch-audiotsm.js?v=0.19", "./simple-edit-fade-handles.js?v=0.20", "./simple-edit-normalize.js?v=0.21", "./simple-edit-transpose-engine.js?v=0.26", "./simple-edit-transpose.js?v=0.26",
    "./simple-edit-eq-engine.js?v=0.28", "./simple-edit-eq.js?v=0.28", "./simple-edit-drive-engine.js?v=0.29", "./simple-edit-drive.js?v=0.29", "./simple-edit-dynamics-engine.js?v=0.30", "./simple-edit-dynamics.js?v=0.30",
    "./simple-edit-stereo-engine.js?v=0.35", "./simple-edit-stereo.js?v=0.35", "./simple-edit-lofi-engine.js?v=0.37", "./simple-edit-lofi.js?v=0.37", "./simple-edit-render-tools-engine.js?v=0.38", "./simple-edit-render-tools.js?v=0.46",
    "./simple-edit-analysis.js?v=0.40", "./simple-edit-project.js?v=0.49", "./simple-edit-markers.js?v=0.43", "./simple-edit-build1.js?v=0.44", "./simple-edit-track-tools.js?v=0.45", "./simple-edit-clip-menu.js?v=0.46", "./simple-edit-snap-tools.js?v=0.47", "./simple-edit-library-tools.js?v=0.48", "./simple-edit-build6.js?v=0.49", "./simple-edit-cleanup.js?v=0.50"
  ];

  window.ORGAVOX_ACTIVE_SCRIPTS = files.slice();

  for (const source of files) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${source}`));
      document.head.appendChild(script);
    });
  }

  installMainUi();
  setFinalVersion();
  document.documentElement.classList.remove("orgavox-loading");
  document.getElementById("orgavox-boot-style")?.remove();
  if (typeof setStatus === "function") setStatus("Ready — ORGAVOX loaded");
})().catch((error) => {
  console.error(error);
  document.documentElement.classList.remove("orgavox-loading");
  const status = document.getElementById("statusPill");
  if (status) status.textContent = "ORGAVOX failed to load";
});
