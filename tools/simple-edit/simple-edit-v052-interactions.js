"use strict";

(function installOrgavoxV052Interactions() {
  const STYLE_ID = "orgavox-v052-interactions-style";
  const TRACK_COUNT = 10;
  let multiSelectLock = false;
  let blockShiftClickUntil = 0;

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes orgavoxMutePulse {
        0%, 100% { box-shadow:0 0 0 1px rgba(220,72,64,.28),0 0 9px rgba(220,72,64,.2); }
        50% { box-shadow:0 0 0 1px rgba(255,120,104,.52),0 0 18px rgba(255,90,72,.58); }
      }
      @keyframes orgavoxSoloPulse {
        0%, 100% { box-shadow:0 0 0 1px rgba(248,215,146,.28),0 0 9px rgba(248,215,146,.2); }
        50% { box-shadow:0 0 0 1px rgba(255,236,164,.6),0 0 19px rgba(255,207,72,.62); }
      }
      body.simple-edit-phase1 .orgavox-track-mix-btn.mute{
        border-color:rgba(220,72,64,.72)!important;
        color:#ffc5bc!important;
        background:rgba(62,16,14,.46)!important;
      }
      body.simple-edit-phase1 .orgavox-track-mix-btn.solo{
        border-color:rgba(248,215,146,.72)!important;
        color:#ffeeb8!important;
        background:rgba(78,50,8,.46)!important;
      }
      body.simple-edit-phase1 .orgavox-track-mix-btn.mute.active{
        border-color:rgba(255,96,76,.96)!important;
        background:linear-gradient(180deg,rgba(178,42,34,.95),rgba(74,14,12,.98))!important;
        color:#fff3ef!important;
        animation:orgavoxMutePulse 1.15s ease-in-out infinite!important;
      }
      body.simple-edit-phase1 .orgavox-track-mix-btn.solo.active{
        border-color:rgba(255,224,92,.98)!important;
        background:linear-gradient(180deg,rgba(217,158,35,.96),rgba(104,66,7,.98))!important;
        color:#171008!important;
        animation:orgavoxSoloPulse 1.15s ease-in-out infinite!important;
      }
      body.simple-edit-phase1 .orgavox-clip-meta-line{
        left:6px!important;
        right:auto!important;
        bottom:4px!important;
        max-width:calc(100% - 12px)!important;
        padding:3px 7px!important;
        border:1px solid rgba(117,178,222,.32)!important;
        border-radius:8px!important;
        background:rgba(0,0,0,.78)!important;
        color:#dff5ff!important;
        box-shadow:0 2px 8px rgba(0,0,0,.48)!important;
      }
      body.simple-edit-phase1 .orgavox-track-volume-overlay{
        background:rgba(0,0,0,.78)!important;
        border:1px solid rgba(224,163,96,.32)!important;
        color:#f8d792!important;
        box-shadow:0 2px 8px rgba(0,0,0,.48)!important;
      }
      body.simple-edit-phase1 .audio-clip.orgavox-multi-selected{
        outline:3px solid rgba(248,215,146,.92)!important;
        box-shadow:0 0 0 1px rgba(248,215,146,.45),0 0 24px rgba(248,215,146,.34),0 5px 16px rgba(0,0,0,.5)!important;
      }
      body.simple-edit-phase1 .audio-clip.orgavox-multi-selected:not(.selected){
        border-color:rgba(248,215,146,.92)!important;
      }
      body.simple-edit-phase1 .track-label-column{
        overflow:hidden!important;
      }
      body.simple-edit-phase1 .track-label-column .track-label{
        will-change:transform;
      }
    `;
    document.head.appendChild(style);
  }

  function esc(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function selectedIds() {
    if (!Array.isArray(state.selectedClipIds)) state.selectedClipIds = state.selectedClipId ? [state.selectedClipId] : [];
    state.selectedClipIds = state.selectedClipIds.filter((id) => state.clips.some((clip) => clip.id === id));
    if (!state.selectedClipIds.length && state.selectedClipId) state.selectedClipIds = [state.selectedClipId];
    return state.selectedClipIds;
  }

  function trackSettingsList() {
    if (!Array.isArray(state.trackSettings)) state.trackSettings = [];
    return state.trackSettings;
  }

  function trackName(index) {
    return String(trackSettingsList()[index]?.name || `Track ${index + 1}`);
  }

  function clipTrackName(clip) {
    const index = Math.max(0, Math.min(TRACK_COUNT - 1, Number(clip?.track) || 0));
    return trackName(index);
  }

  function updateSelectedSummary() {
    const ids = selectedIds();
    if (ids.length > 1 && ui.selectedClipName) ui.selectedClipName.textContent = `${ids.length} clips selected`;
  }

  function applyMultiSelectionClasses() {
    const ids = new Set(selectedIds());
    document.querySelectorAll(".audio-clip").forEach((element) => {
      const active = ids.has(element.dataset.clipId);
      element.classList.toggle("selected", active || element.dataset.clipId === state.selectedClipId);
      element.classList.toggle("orgavox-multi-selected", active && ids.size > 1);
    });
    updateSelectedSummary();
  }

  function decorateClipMetaLines() {
    state.clips.forEach((clip) => {
      const element = document.querySelector(`.audio-clip[data-clip-id="${esc(clip.id)}"]`);
      if (!element) return;
      let line = element.querySelector(".orgavox-clip-meta-line");
      if (!line) {
        line = document.createElement("div");
        line.className = "orgavox-clip-meta-line";
        element.appendChild(line);
      }
      const existing = line.textContent || "";
      const keyIndex = existing.indexOf("KEY ");
      const tail = keyIndex >= 0 ? existing.slice(keyIndex) : "KEY -- · BPM -- · FX NONE";
      const volume = Math.round(Number(clip.volume) || 100);
      line.textContent = `VOL ${volume}% · ${clipTrackName(clip)} · ${tail}`;
      line.title = line.textContent;
    });
  }

  function decorateTrackVolumeOverlays() {
    document.querySelectorAll(".track-lane").forEach((lane) => {
      const index = Math.max(0, Math.min(TRACK_COUNT - 1, Number(lane.dataset.track) || 0));
      const setting = trackSettingsList()[index] || {};
      const volume = Number.isFinite(Number(setting.volume)) ? Math.round(Number(setting.volume)) : 100;
      const pan = Number(setting.pan) || 0;
      const bits = [trackName(index), `VOL ${volume}%`];
      if (pan) bits.push(`PAN ${pan > 0 ? "+" : ""}${pan}`);
      if (setting.muted) bits.push("MUTED");
      if (setting.solo) bits.push("SOLO");
      let overlay = lane.querySelector(".orgavox-track-volume-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "orgavox-track-volume-overlay";
        lane.appendChild(overlay);
      }
      overlay.textContent = bits.join(" · ");
    });
  }

  function decorate() {
    decorateClipMetaLines();
    decorateTrackVolumeOverlays();
    applyMultiSelectionClasses();
    syncTrackLabelScroll();
  }

  function toggleShiftSelection(clipId) {
    const clip = state.clips.find((item) => item.id === clipId);
    if (!clip) return;
    let ids = selectedIds().slice();
    if (state.selectedClipId && !ids.includes(state.selectedClipId)) ids.push(state.selectedClipId);
    if (ids.includes(clipId)) {
      if (ids.length > 1) ids = ids.filter((id) => id !== clipId);
    } else {
      ids.push(clipId);
    }
    state.selectedClipIds = ids;
    state.selectedClipId = clipId;
    multiSelectLock = true;
    try { selectClip(clipId, true); }
    finally { multiSelectLock = false; }
    state.selectedClipIds = ids;
    applyMultiSelectionClasses();
    syncSelectedControls();
    showToast(`${ids.length} clip${ids.length === 1 ? "" : "s"} selected.`);
  }

  function installShiftMultiSelect() {
    if (window.__orgavoxV052ShiftMultiSelect) return;
    window.__orgavoxV052ShiftMultiSelect = true;

    document.addEventListener("pointerdown", (event) => {
      const element = event.target.closest?.(".audio-clip");
      if (!element || !event.shiftKey || !ui.tracks?.contains(element)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      blockShiftClickUntil = Date.now() + 450;
      toggleShiftSelection(element.dataset.clipId);
    }, true);

    document.addEventListener("click", (event) => {
      const element = event.target.closest?.(".audio-clip");
      if (!element || !event.shiftKey || !ui.tracks?.contains(element)) return;
      if (Date.now() < blockShiftClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function patchSelectionFunctions() {
    if (window.__orgavoxV052SelectionPatched) return;
    window.__orgavoxV052SelectionPatched = true;

    const previousSelectClip = selectClip;
    selectClip = function orgavoxV052SelectClip(id, rerender = true) {
      const result = previousSelectClip.apply(this, arguments);
      if (!multiSelectLock) state.selectedClipIds = id ? [id] : [];
      decorate();
      return result;
    };

    const previousSyncSelectedControls = syncSelectedControls;
    syncSelectedControls = function orgavoxV052SyncSelectedControls() {
      const result = previousSyncSelectedControls.apply(this, arguments);
      updateSelectedSummary();
      return result;
    };

    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxV052RenderTimeline() {
      const result = previousRenderTimeline.apply(this, arguments);
      decorate();
      return result;
    };

    const previousDeleteSelectedClip = deleteSelectedClip;
    deleteSelectedClip = function orgavoxV052DeleteSelectedClip() {
      const ids = selectedIds();
      if (ids.length <= 1) return previousDeleteSelectedClip.apply(this, arguments);
      stopPlayback();
      state.clips = state.clips.filter((clip) => !ids.includes(clip.id));
      state.selectedClipIds = [];
      state.selectedClipId = null;
      syncSelectedControls();
      renderTimeline();
      showToast(`${ids.length} selected clips deleted.`);
      window.orgavoxRecordHistory?.();
    };
  }

  function clampPps(value) {
    return Math.max(25, Math.min(500, Math.round(Number(value) || 80)));
  }

  function zoomAtPointer(event) {
    const rect = ui.timelineScroll.getBoundingClientRect();
    const localX = Math.max(0, event.clientX - rect.left);
    const timeAtPointer = (ui.timelineScroll.scrollLeft + localX) / Math.max(1, state.pixelsPerSecond);
    const delta = event.deltaY || event.deltaX || 0;
    const factor = delta < 0 ? 1.12 : 1 / 1.12;
    state.pixelsPerSecond = clampPps(state.pixelsPerSecond * factor);
    if (ui.zoomSlider) ui.zoomSlider.value = state.pixelsPerSecond;
    if (ui.zoomOut) ui.zoomOut.textContent = `${Math.round(state.pixelsPerSecond / 80 * 100)}%`;
    renderTimeline();
    ui.timelineScroll.scrollLeft = Math.max(0, timeAtPointer * state.pixelsPerSecond - localX);
    window.orgavoxRenderMarkers?.();
  }

  function syncTrackLabelScroll() {
    const offset = ui.timelineScroll ? Math.max(0, ui.timelineScroll.scrollTop || 0) : 0;
    document.querySelectorAll(".track-label-column .track-label").forEach((label) => {
      label.style.transform = `translateY(${-offset}px)`;
    });
  }

  function installWheelModes() {
    if (!ui.timelineScroll || ui.timelineScroll.dataset.orgavoxV052WheelModes === "true") return;
    ui.timelineScroll.dataset.orgavoxV052WheelModes = "true";
    ui.timelineScroll.addEventListener("scroll", syncTrackLabelScroll, { passive: true });
    ui.timelineScroll.addEventListener("wheel", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.ctrlKey || event.metaKey) {
        zoomAtPointer(event);
        return;
      }
      if (event.shiftKey) {
        const amount = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        ui.timelineScroll.scrollLeft += amount;
        window.orgavoxRenderMarkers?.();
        return;
      }
      ui.timelineScroll.scrollTop += event.deltaY;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.4) ui.timelineScroll.scrollTop += event.deltaX;
      syncTrackLabelScroll();
    }, { passive: false, capture: true });
  }

  function refresh() {
    installStyles();
    installWheelModes();
    decorate();
  }

  window.orgavoxRefreshV052Interactions = refresh;
  installStyles();
  patchSelectionFunctions();
  installShiftMultiSelect();
  installWheelModes();
  decorate();
  setTimeout(refresh, 0);
  setTimeout(refresh, 250);
})();
