"use strict";

(async () => {
  const VERSION = "v1.03";
  const REMOTE_SOUND_FX = "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/";
  const LOCAL_SOUND_FX = "./soundeffects/";
  window.ORGAVOX_VERSION = VERSION;
  document.documentElement.classList.add("orgavox-loading");

  function setFinalVersion() {
    document.title = `Organon — ORGAVOX ${VERSION}`;
    const brand = document.querySelector(".brand");
    const mark = brand?.querySelector(".brand-mark");
    if (mark) mark.textContent = "Φ";
    const title = brand?.querySelector("h1");
    if (title) {
      title.textContent = "ORGAVOX";
      const badge = document.createElement("span");
      badge.className = "phase1-version simple-edit-version";
      badge.textContent = VERSION;
      title.appendChild(badge);
    }
    const subtitle = brand?.querySelector("p");
    if (subtitle) { subtitle.textContent = "Browser audio workstation"; subtitle.hidden = false; }
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

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${source}`));
      document.head.appendChild(script);
    });
  }

  function installMainUi() {
    if (window.__orgavoxMainUiV103) return;
    window.__orgavoxMainUiV103 = true;

    const STYLE_ID = "orgavox-main-ui-v103-style";
    const EDIT_ID = "orgavoxEditDropdown";
    const VIEW_ID = "orgavoxViewDropdown";
    const SNAP_VALUES = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
    let numberPopover = null;
    let closingMenus = false;

    function installStyles() {
      document.getElementById("orgavox-main-ui-v101-style")?.remove();
      document.getElementById("orgavox-main-ui-v102-style")?.remove();
      document.getElementById("orgavox-final-cleanup-v102c-style")?.remove();
      document.getElementById("orgavox-track-mix-color-lock")?.remove();
      document.getElementById(STYLE_ID)?.remove();
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        @keyframes orgavoxPlayPulse{from{transform:scale(1);filter:brightness(1);box-shadow:0 0 0 1px rgba(117,178,222,.42),0 0 12px rgba(75,155,255,.28)}to{transform:scale(1.14);filter:brightness(1.3);box-shadow:0 0 0 1px rgba(168,220,255,.82),0 0 28px rgba(75,155,255,.72)}}
        body.simple-edit-phase1 .orgavox-edit-dropdown,body.simple-edit-phase1 .orgavox-view-dropdown{position:relative!important;display:inline-flex!important;align-items:center!important;flex:0 0 auto!important;visibility:visible!important;opacity:1!important}
        body.simple-edit-phase1 .orgavox-edit-button{border-color:rgba(224,163,96,.82)!important;background:linear-gradient(180deg,rgba(93,67,35,.88),rgba(34,23,13,.95))!important;color:#ffe4a8!important}
        body.simple-edit-phase1 .orgavox-view-button{border-color:rgba(117,178,222,.86)!important;background:linear-gradient(180deg,rgba(35,80,124,.95),rgba(14,38,72,.98))!important;color:#e1f7ff!important}
        body.simple-edit-phase1 .orgavox-edit-menu,body.simple-edit-phase1 .orgavox-view-menu{position:absolute!important;top:calc(100% + 8px)!important;left:0!important;z-index:4300!important;min-width:215px!important;display:grid!important;gap:6px!important;padding:8px!important;border:1px solid rgba(224,163,96,.65)!important;border-radius:14px!important;background:rgba(10,11,10,.98)!important;box-shadow:0 18px 44px rgba(0,0,0,.72)!important}
        body.simple-edit-phase1 .orgavox-view-menu{border-color:rgba(117,178,222,.68)!important}
        body.simple-edit-phase1 .orgavox-edit-menu[hidden],body.simple-edit-phase1 .orgavox-view-menu[hidden]{display:none!important}
        body.simple-edit-phase1 .orgavox-edit-menu .tool-button,body.simple-edit-phase1 .orgavox-view-menu .tool-button{width:100%!important;justify-content:flex-start!important;min-height:32px!important}
        body.simple-edit-phase1 #importBtn.orgavox-open-button{border-color:rgba(117,178,222,.92)!important;background:linear-gradient(180deg,rgba(57,132,205,.96),rgba(31,77,133,.94))!important;color:#eef8ff!important}
        body.simple-edit-phase1 #exportBtn.orgavox-save-button{border-color:rgba(74,190,117,.86)!important;background:linear-gradient(180deg,rgba(35,118,66,.92),rgba(14,62,35,.94))!important;color:#e2ffe9!important}
        body.simple-edit-phase1 #stopBtn.orgavox-stop-danger,body.simple-edit-phase1 #deleteBtn.orgavox-danger-tool,body.simple-edit-phase1 .orgavox-cut-clip-btn{border-color:rgba(220,72,64,.78)!important;background:linear-gradient(180deg,rgba(92,28,23,.88),rgba(39,13,10,.96))!important;color:#ffd8d2!important}
        body.simple-edit-phase1 #scissorsBtn.orgavox-snip-tool{border-color:rgba(220,72,64,.76)!important;background:linear-gradient(180deg,rgba(89,29,26,.84),rgba(35,13,12,.94))!important;color:#ffd8d2!important}
        body.simple-edit-phase1 #playBtn.orgavox-playing{animation:orgavoxPlayPulse .72s ease-in-out infinite alternate!important;transform-origin:center!important}
        body.simple-edit-phase1 #snapGridSelect{background:#050505!important;color:#f5f0db!important;border-color:rgba(117,178,222,.72)!important}
        body.simple-edit-phase1 #snapGridSelect option{background:#050505!important;color:#f5f0db!important}
        body.simple-edit-phase1 output{cursor:pointer!important}
        .orgavox-number-pop{position:fixed;z-index:999999;min-width:128px;padding:8px;border:1px solid rgba(224,163,96,.72);border-radius:12px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);display:grid;gap:6px}
        .orgavox-number-pop label{color:rgba(245,240,219,.72);font:800 .56rem var(--font-mono);text-transform:uppercase;letter-spacing:.08em}
        .orgavox-number-pop input{height:34px;border:1px solid rgba(117,178,222,.64);border-radius:9px;background:#050505;color:#f5f0db;padding:0 9px;font:900 .78rem var(--font-mono);outline:none}
        .orgavox-number-pop small{color:rgba(245,240,219,.5);font:700 .55rem var(--font-mono)}
      `;
      document.head.appendChild(style);
    }

    function tip(button, text) { if (!button) return; button.title = text; button.setAttribute("aria-label", text); }
    function show(message) { if (typeof showToast === "function") showToast(message); }
    function selectedIds() {
      if (!Array.isArray(state.selectedClipIds)) state.selectedClipIds = state.selectedClipId ? [state.selectedClipId] : [];
      state.selectedClipIds = state.selectedClipIds.filter((id) => state.clips.some((clip) => clip.id === id));
      if (!state.selectedClipIds.length && state.selectedClipId) state.selectedClipIds = [state.selectedClipId];
      return state.selectedClipIds;
    }
    function selectedClips() { const ids = new Set(selectedIds()); return state.clips.filter((clip) => ids.has(clip.id)); }
    function formatSeconds(value) { const seconds = Math.max(0, Number(value) || 0); const mins = Math.floor(seconds / 60); const rest = seconds - mins * 60; return `${String(mins).padStart(2, "0")}:${rest.toFixed(3).padStart(6, "0")}`; }
    function parseTime(value) {
      const text = String(value || "").trim();
      if (!text) return null;
      if (text.includes(":")) {
        const parts = text.split(":").map(Number);
        if (parts.some((part) => !Number.isFinite(part))) return null;
        return Math.max(0, parts.reduce((sum, part) => sum * 60 + part, 0));
      }
      const number = Number(text.replace(/s$/i, ""));
      return Number.isFinite(number) ? Math.max(0, number) : null;
    }

    function closeMenus() {
      if (closingMenus) return;
      closingMenus = true;
      document.querySelectorAll(".orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu").forEach((panel) => { panel.hidden = true; });
      document.querySelectorAll(".orgavox-edit-button,.orgavox-view-button,.orgavox-effects-dropdown-button").forEach((button) => button.setAttribute("aria-expanded", "false"));
      closingMenus = false;
    }

    function menu(id, wrapCls, buttonCls, panelCls, label, title) {
      let wrap = document.getElementById(id);
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.id = id;
      }
      wrap.className = wrapCls;
      let button = wrap.querySelector(`.${buttonCls}`);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        wrap.prepend(button);
      }
      button.className = `tool-button ${buttonCls}`;
      button.textContent = label;
      tip(button, title);
      let panel = wrap.querySelector(`.${panelCls}`);
      if (!panel) {
        panel = document.createElement("div");
        panel.className = panelCls;
        panel.hidden = true;
        wrap.appendChild(panel);
      }
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = panel.hidden;
        closeMenus();
        panel.hidden = !willOpen;
        button.setAttribute("aria-expanded", String(willOpen));
      };
      return { wrap, button, panel };
    }

    function customButton(id, label, title, handler, className = "tool-button") {
      let button = document.getElementById(id);
      if (!button) { button = document.createElement("button"); button.id = id; button.type = "button"; }
      button.textContent = label;
      button.className = className;
      tip(button, title);
      button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); closeMenus(); handler(); };
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
      window.orgavoxRecordHistory?.();
      show(clips.length === 1 ? "Clip cut." : `${clips.length} clips cut.`);
    }
    function pasteClip() {
      const stored = Array.isArray(state.__orgavoxClipClipboard) ? state.__orgavoxClipClipboard : [];
      if (!stored.length) return show("No copied clip to paste.");
      const base = Math.max(0, Number(state.playhead) || 0);
      const pasted = stored.map((clip) => ({ ...clip, id: makeId("clip"), start: base + Math.max(0, Number(clip.__relativeStart) || 0), cacheVersion: 0, volumeKeyframes: Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes.map((item) => ({ ...item, id: makeId("kf") })) : [] }));
      pasted.forEach((clip) => { delete clip.__relativeStart; });
      state.clips.push(...pasted);
      state.selectedClipId = pasted[pasted.length - 1]?.id || null;
      state.selectedClipIds = pasted.map((clip) => clip.id);
      renderTimeline();
      syncSelectedControls();
      window.orgavoxRecordHistory?.();
      show(pasted.length === 1 ? "Clip pasted at the playhead." : `${pasted.length} clips pasted at the playhead.`);
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
      window.orgavoxRecordHistory?.();
      show("All timeline clips cleared.");
    }
    function sendToStart() {
      const clips = selectedClips();
      if (!clips.length) return show("Select a clip to send to start.");
      const earliest = Math.min(...clips.map((clip) => Math.max(0, Number(clip.start) || 0)));
      clips.forEach((clip) => { clip.start = clips.length === 1 ? 0 : Math.max(0, (Number(clip.start) || 0) - earliest); });
      renderTimeline();
      syncSelectedControls();
      window.orgavoxRecordHistory?.();
      show(clips.length === 1 ? "Clip sent to start." : `${clips.length} clips sent to start.`);
    }
    function autoAnalyze() {
      const clip = state.clips.find((item) => item.id === state.selectedClipId) || state.clips.find((item) => Number(item.track) === Number(state.selectedTrack)) || state.clips[0];
      if (!clip) return show("Select a clip or track to analyze.");
      selectClip(clip.id);
      selectTrack(clip.track);
      const modal = document.getElementById("analysisModal");
      if (!modal) return show("Analyze panel is still loading.");
      modal.hidden = false;
      setTimeout(() => modal.querySelector("[data-analysis-scan]")?.click(), 0);
    }

    function ensureEditMenu() {
      const made = menu(EDIT_ID, "orgavox-edit-dropdown", "orgavox-edit-button", "orgavox-edit-menu", "✎ Edit ▾", "Edit selected clips");
      const buttons = [
        customButton("orgavoxCopyClipBtn", "⧉ Copy", "Copy selected clip", copyClip),
        customButton("orgavoxCutClipBtn", "✂ Cut", "Remove selected clip and store it for Paste", cutClip, "tool-button orgavox-cut-clip-btn"),
        customButton("orgavoxPasteClipBtn", "⧉ Paste", "Paste copied clip at playhead", pasteClip),
        customButton("orgavoxClearTimelineBtn", "🧹 Clear All", "Clear all clips", clearAll)
      ];
      if (ui.undoHistoryBtn) { ui.undoHistoryBtn.textContent = "↶ Undo History"; buttons.unshift(ui.undoHistoryBtn); }
      buttons.filter(Boolean).forEach((button) => { if (button.parentElement !== made.panel) made.panel.appendChild(button); });
      return made.wrap;
    }

    function ensureViewMenu() {
      const made = menu(VIEW_ID, "orgavox-view-dropdown", "orgavox-view-button", "orgavox-view-menu", "👁 View ▾", "View and timeline tools");
      const base = [
        customButton("orgavoxMarkerPanelBtn", "🏷 Markers Panel", "Open marker list", () => { const modal = document.getElementById("markersModal"); if (modal) { modal.hidden = false; window.orgavoxRenderMarkers?.(); } else show("Markers panel is still loading."); }),
        customButton("orgavoxSendToStartBtn", "↤ Send to Start", "Move selected clip to 0:00", sendToStart),
        customButton("orgavoxAnalyzeBtn", "📈 Analyze", "Analyze selected clip", autoAnalyze),
        customButton("orgavoxAddBeatMarkersBtn", "▏ Add Beat Markers", "Add beat markers from selected track", () => window.orgavoxAddBeatMarkers?.()),
        customButton("orgavoxClearBeatMarkersBtn", "▏ Clear Beat Markers", "Clear beat markers", () => window.orgavoxClearBeatMarkers?.()),
        customButton("orgavoxRandomizeTrackColorsBtn", "🎨 Randomize Track Colors", "Assign different track colors", () => window.orgavoxRandomizeTrackColors?.()),
        customButton("orgavoxExpandTrackBtn", "▣ Expand Track", "Make selected track taller", () => window.orgavoxExpandSelectedTrack?.()),
        customButton("orgavoxResetTrackViewBtn", "▢ Reset Track View", "Restore normal track heights", () => window.orgavoxResetTrackView?.())
      ];
      if (ui.alignPlayheadBtn) base.splice(2, 0, ui.alignPlayheadBtn);
      if (ui.bounceBtn) { ui.bounceBtn.textContent = "🧱 Bounce Track"; base.push(ui.bounceBtn); }
      base.filter(Boolean).forEach((button) => { if (button.parentElement !== made.panel) made.panel.appendChild(button); });
      return made.wrap;
    }

    function removeWrongArrows() {
      document.getElementById("playheadBackStepBtn")?.remove();
      document.getElementById("playheadForwardStepBtn")?.remove();
      document.querySelectorAll(".orgavox-marker-nav").forEach((button) => {
        if (button.id !== "prevMarkerBtn" && button.id !== "nextMarkerBtn") button.remove();
      });
    }

    function orderToolbar() {
      removeWrongArrows();
      const edit = ensureEditMenu();
      const view = ensureViewMenu();
      const group = document.querySelector(".orgavox-edit-group") || document.querySelector(".toolbar-actions") || ui.scissorsBtn?.parentElement;
      if (!group) return;
      const effects = group.querySelector(".orgavox-effects-dropdown") || document.querySelector(".orgavox-effects-dropdown");
      const prev = document.getElementById("prevMarkerBtn");
      const marker = ui.markersBtn || document.getElementById("markersBtn");
      const next = document.getElementById("nextMarkerBtn");
      const nudgeLeft = ui.nudgeLeftBtn || document.getElementById("nudgeLeftBtn");
      const nudgeRight = ui.nudgeRightBtn || document.getElementById("nudgeRightBtn");
      const snap = ui.snapBtn || document.getElementById("snapGridBtn");
      const snapGrid = ui.snapGridSelect || document.getElementById("snapGridSelect");
      const undo = ui.undoBtn || document.getElementById("undoBtn");
      const redo = ui.redoBtn || document.getElementById("redoBtn");
      const snip = ui.scissorsBtn || document.getElementById("scissorsBtn");
      const fullscreen = ui.fullscreenBtn || document.getElementById("fullscreenBtn");
      const ordered = [edit, view, effects, prev, marker, next, nudgeLeft, nudgeRight, snap, snapGrid, undo, redo, snip, fullscreen].filter(Boolean);
      ordered.forEach((node) => { if (node.parentElement !== group) group.appendChild(node); });
      ordered.forEach((node) => group.appendChild(node));
      if (marker) { marker.textContent = "🏷 Add Marker"; tip(marker, "Add a marker at the playhead"); }
      if (prev && marker && prev.nextElementSibling !== marker) group.insertBefore(prev, marker);
      if (next && marker && marker.nextElementSibling !== next) group.insertBefore(next, marker.nextSibling);
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
      select.onchange = () => { state.snapGrid = Number(select.value) || 0.1; show(`Snap ${state.snapGrid}s.`); };
    }
    function currentSnap() { const value = Number((ui.snapGridSelect || document.getElementById("snapGridSelect"))?.value || state.snapGrid || 0.1); return Number.isFinite(value) && value > 0 ? value : 0.1; }
    function nudgeSelected(direction) {
      const clips = selectedClips();
      if (!clips.length) return show("Select a clip to nudge.");
      const amount = currentSnap() * (direction < 0 ? -1 : 1);
      clips.forEach((clip) => { clip.start = Math.max(0, (Number(clip.start) || 0) + amount); });
      renderTimeline();
      syncSelectedControls();
      window.orgavoxRecordHistory?.();
      show(`${clips.length === 1 ? "Clip" : "Clips"} nudged ${Math.abs(amount)}s.`);
    }
    function installNudgeHandlers() {
      const left = ui.nudgeLeftBtn || document.getElementById("nudgeLeftBtn");
      const right = ui.nudgeRightBtn || document.getElementById("nudgeRightBtn");
      if (left) left.onclick = (event) => { event.preventDefault(); nudgeSelected(-1); };
      if (right) right.onclick = (event) => { event.preventDefault(); nudgeSelected(1); };
    }

    function applySelectionClasses() {
      const ids = new Set(selectedIds());
      document.querySelectorAll(".audio-clip").forEach((element) => {
        const active = ids.has(element.dataset.clipId) || element.dataset.clipId === state.selectedClipId;
        element.classList.toggle("selected", active);
        element.classList.toggle("orgavox-multi-selected", active && ids.size > 1);
      });
      if (ids.size > 1 && ui.selectedClipName) ui.selectedClipName.textContent = `${ids.size} clips selected`;
    }
    function deselectClips() {
      state.selectedClipId = null;
      state.selectedClipIds = [];
      syncSelectedControls();
      applySelectionClasses();
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
      numberPopover.onsubmit = (event) => { event.preventDefault(); const ok = apply(input.value.trim()); if (ok !== false) numberPopover?.remove(); };
      input.onkeydown = (event) => { if (event.key === "Escape") { event.preventDefault(); numberPopover?.remove(); } };
      document.body.appendChild(numberPopover);
      input.select();
      input.focus();
    }
    function applyOutputValue(output, value) {
      const n = Number(String(value).replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(n)) return false;
      const id = output.id || "";
      const label = (output.closest(".range-control")?.querySelector("span")?.textContent || "").toLowerCase();
      if (id === "volumeOut" || label === "volume") { const clips = selectedClips(); if (!clips.length) return false; const next = Math.max(0, Math.min(200, n)); clips.forEach((clip) => { clip.volume = next; }); if (ui.volumeSlider) ui.volumeSlider.value = next; output.textContent = `${Math.round(next)}%`; renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); return true; }
      if (id === "echoOut" || label.includes("echo")) { const clips = selectedClips(); if (!clips.length) return false; const next = Math.max(0, Math.min(100, n)); clips.forEach((clip) => { clip.echo = next; }); if (ui.echoSlider) ui.echoSlider.value = next; output.textContent = `${Math.round(next)}%`; syncSelectedControls(); window.orgavoxRecordHistory?.(); return true; }
      if (id === "zoomOut" || label.includes("zoom")) { const percent = Math.max(25, Math.min(500, n)); state.pixelsPerSecond = Math.max(25, Math.min(500, Math.round(80 * percent / 100))); if (ui.zoomSlider) ui.zoomSlider.value = state.pixelsPerSecond; output.textContent = `${Math.round(percent)}%`; renderTimeline(); return true; }
      if (label.includes("master")) { const next = Math.max(0, Math.min(200, n)); output.textContent = `${Math.round(next)}%`; const input = output.closest(".range-control")?.querySelector("input[type='range']"); if (input) { input.value = next; input.dispatchEvent(new Event("input", { bubbles: true })); } window.orgavoxRecordHistory?.(); return true; }
      return false;
    }

    function installGlobalHandlers() {
      if (!window.__orgavoxV103GlobalHandlers) {
        window.__orgavoxV103GlobalHandlers = true;
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
          if (target.closest?.(".audio-clip,.clip-handle,button,input,select,textarea,label,.popover,.modal-backdrop,.orgavox-edit-dropdown,.orgavox-view-dropdown,.orgavox-effects-dropdown,.asset-list,.library-panel")) return;
          if (target.closest?.(".track-lane,.tracks,.timeline-scroll,.timeline-content,#rulerCanvas")) deselectClips();
        }, true);
        document.addEventListener("click", (event) => {
          const target = event.target;
          if (!target) return;
          if (!target.closest?.(`#${EDIT_ID},#${VIEW_ID},.orgavox-effects-dropdown`)) closeMenus();
          if (target === ui.timeReadout || target.id === "timeReadout") {
            event.preventDefault();
            openNumberPopover(target, "Playhead time", target.textContent || formatSeconds(state.playhead), (value) => { const seconds = parseTime(value); if (seconds == null) return false; setPlayhead(seconds, true); return true; });
          } else if (target.matches?.("output")) {
            const output = target;
            const label = output.closest(".range-control")?.querySelector("span")?.textContent || "Value";
            openNumberPopover(output, label, output.textContent || "", (value) => applyOutputValue(output, value));
          }
        }, true);
        if (typeof selectClip === "function") {
          const oldSelect = selectClip;
          selectClip = function orgavoxSelectClipV103(id) { const result = oldSelect.apply(this, arguments); state.selectedClipIds = id ? [id] : []; applySelectionClasses(); return result; };
        }
        if (typeof renderTimeline === "function") {
          const oldRender = renderTimeline;
          renderTimeline = function orgavoxRenderTimelineV103() { const result = oldRender.apply(this, arguments); refreshUi(); return result; };
        }
        if (typeof startPlayback === "function") { const oldStart = startPlayback; startPlayback = function orgavoxStartPlaybackV103() { const result = oldStart.apply(this, arguments); setTimeout(syncPlayButton, 0); return result; }; }
        if (typeof stopPlayback === "function") { const oldStop = stopPlayback; stopPlayback = function orgavoxStopPlaybackV103() { const result = oldStop.apply(this, arguments); setTimeout(syncPlayButton, 0); return result; }; }
      }
    }

    function syncPlayButton() {
      const active = Boolean(state.isPlaying || state.playing || state.playbackActive || ui.playBtn?.textContent?.includes("❚") || ui.playBtn?.textContent?.includes("Ⅱ"));
      ui.playBtn?.classList.toggle("orgavox-playing", active);
    }
    function finalButtonStyling() {
      if (ui.importBtn) { ui.importBtn.textContent = "📥 Open"; ui.importBtn.classList.remove("primary"); ui.importBtn.classList.add("orgavox-open-button"); }
      if (ui.exportBtn) { ui.exportBtn.textContent = "💾 Save"; ui.exportBtn.classList.add("orgavox-save-button"); }
      if (ui.stopBtn) ui.stopBtn.classList.add("orgavox-stop-danger");
      if (ui.scissorsBtn) { ui.scissorsBtn.textContent = "✂️ Snip"; ui.scissorsBtn.classList.remove("orgavox-danger-tool"); ui.scissorsBtn.classList.add("orgavox-snip-tool"); tip(ui.scissorsBtn, "Snip/split the selected clip at the playhead"); }
      if (ui.deleteBtn) { ui.deleteBtn.textContent = "🗑 DEL"; ui.deleteBtn.classList.add("orgavox-danger-tool"); }
    }

    function refreshUi() {
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
      ensureEditMenu();
      ensureViewMenu();
      setSnapOptions();
      installNudgeHandlers();
      orderToolbar();
      finalButtonStyling();
      applySelectionClasses();
      syncPlayButton();
    }

    window.orgavoxRefreshV103 = refreshUi;
    installGlobalHandlers();
    refreshUi();
    setTimeout(refreshUi, 150);
    setTimeout(refreshUi, 600);
    window.addEventListener("resize", () => setTimeout(refreshUi, 0));
  }

  installLocalSoundFxRouting();
  const files = [
    "./simple-edit-core.js?v=0.01", "./simple-edit-timeline.js?v=0.01", "./simple-edit-audio.js?v=0.26", "./simple-edit-export.js?v=0.02", "./simple-edit-phase1.js?v=0.33",
    "./simple-edit-keyframes.js?v=0.10", "./simple-edit-keyframes-fix.js?v=0.11", "./simple-edit-phase3.js?v=0.13", "./simple-edit-effects-library.js?v=0.15", "./simple-edit-echo-settings.js?v=1.03",
    "./simple-edit-stretch-audiotsm.js?v=0.19", "./simple-edit-fade-handles.js?v=0.20", "./simple-edit-normalize.js?v=0.21", "./simple-edit-transpose-engine.js?v=0.26", "./simple-edit-transpose.js?v=0.26",
    "./simple-edit-eq-engine.js?v=0.28", "./simple-edit-eq.js?v=0.28", "./simple-edit-drive-engine.js?v=0.29", "./simple-edit-drive.js?v=0.29", "./simple-edit-dynamics-engine.js?v=0.30", "./simple-edit-dynamics.js?v=0.30",
    "./simple-edit-stereo-engine.js?v=0.35", "./simple-edit-stereo.js?v=0.35", "./simple-edit-lofi-engine.js?v=0.37", "./simple-edit-lofi.js?v=0.37", "./simple-edit-render-tools-engine.js?v=0.38", "./simple-edit-render-tools.js?v=1.03",
    "./simple-edit-analysis.js?v=0.40", "./simple-edit-project.js?v=0.49", "./simple-edit-markers.js?v=1.03", "./simple-edit-build1.js?v=1.03", "./simple-edit-track-tools.js?v=1.03", "./simple-edit-clip-menu.js?v=0.46", "./simple-edit-snap-tools.js?v=0.47", "./simple-edit-library-tools.js?v=0.48", "./simple-edit-build6.js?v=0.49"
  ];

  window.ORGAVOX_ACTIVE_SCRIPTS = files.slice();
  for (const source of files) await loadScript(source);
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
