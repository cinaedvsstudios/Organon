"use strict";

(function installOrgavoxCleanupV050() {
  const STYLE_ID = "orgavox-cleanup-v050-style";
  const EDIT_MENU_ID = "orgavoxEditDropdown";
  const TRACK_COUNT = 10;
  let armedClipId = null;
  let freshlyArmedClipId = null;
  let suppressNextClipClickUntil = 0;

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 #jumpStartBtn.orgavox-back-purple{
        border-color:rgba(178,109,255,.9)!important;
        background:linear-gradient(180deg,rgba(106,60,190,.94),rgba(53,27,108,.96))!important;
        color:#f3e2ff!important;
        box-shadow:0 0 0 1px rgba(178,109,255,.22),0 0 13px rgba(130,78,220,.22)!important;
      }
      body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control.orgavox-zoom-with-fullscreen{
        grid-template-columns:1fr auto auto!important;
      }
      body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control.orgavox-zoom-with-fullscreen #fullscreenBtn{
        grid-column:3!important;
        grid-row:1!important;
        width:34px!important;
        min-width:34px!important;
        height:30px!important;
        min-height:30px!important;
        padding:0!important;
        border-color:rgba(178,109,255,.74)!important;
        background:linear-gradient(180deg,rgba(75,44,136,.9),rgba(32,20,70,.96))!important;
        color:#f3e2ff!important;
      }
      .orgavox-edit-dropdown{position:relative;display:inline-flex;align-items:center}
      .orgavox-edit-button{
        border-color:rgba(224,163,96,.82)!important;
        background:linear-gradient(180deg,rgba(93,67,35,.88),rgba(34,23,13,.95))!important;
        color:#ffe4a8!important;
      }
      .orgavox-edit-menu{
        position:absolute;top:calc(100% + 8px);left:0;z-index:3800;min-width:174px;
        display:grid;gap:6px;padding:8px;border:1px solid rgba(224,163,96,.65);border-radius:14px;
        background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);
      }
      .orgavox-edit-menu[hidden]{display:none}
      .orgavox-edit-menu .tool-button{width:100%;justify-content:flex-start!important;min-height:32px!important}
      body.simple-edit-phase1 .track-label{
        grid-template-columns:auto minmax(0,1fr) auto!important;
        grid-template-rows:auto auto!important;
        align-items:center!important;
      }
      body.simple-edit-phase1 .track-label .orgavox-track-index,
      body.simple-edit-phase1 .track-label .orgavox-track-name,
      body.simple-edit-phase1 .track-label .orgavox-track-menu-btn{grid-row:1!important}
      body.simple-edit-phase1 .track-label .orgavox-track-index{grid-column:1!important}
      body.simple-edit-phase1 .track-label .orgavox-track-name{grid-column:2!important}
      body.simple-edit-phase1 .track-label .orgavox-track-menu-btn{grid-column:3!important}
      body.simple-edit-phase1 .orgavox-track-mini{grid-column:1 / -1!important;grid-row:2!important}
      body.simple-edit-phase1 .orgavox-track-mini > span[style]:not(.orgavox-track-meta-line){display:none!important}
      body.simple-edit-phase1 .track-lane{position:relative!important}
      .orgavox-track-volume-overlay{
        position:absolute;left:8px;top:8px;z-index:2;pointer-events:none;
        max-width:260px;padding:3px 7px;border-radius:8px;background:rgba(0,0,0,.42);
        color:#f8d792;font:900 .56rem var(--font-mono);letter-spacing:.04em;text-transform:uppercase;
      }
      .audio-clip.selected{
        outline:3px solid rgba(255,255,255,.92)!important;
        background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(225,228,226,.9))!important;
        color:#15120c!important;
        box-shadow:0 0 0 1px rgba(255,255,255,.55),0 0 22px rgba(255,255,255,.34)!important;
      }
      .audio-clip.selected .clip-title,
      .audio-clip.selected .orgavox-clip-meta-line{color:#15120c!important}
      .audio-clip.orgavox-drag-armed{
        cursor:grab!important;
      }
      .audio-clip.orgavox-dragging{
        cursor:grabbing!important;
        opacity:.9!important;
        z-index:24!important;
      }
    `;
    document.head.appendChild(style);
  }

  function clampTrack(track) {
    return Math.max(0, Math.min(TRACK_COUNT - 1, Number(track) || 0));
  }

  function trackSettings() {
    if (typeof window.orgavoxTrackSettings === "function") return window.orgavoxTrackSettings();
    if (!Array.isArray(state.trackSettings)) state.trackSettings = [];
    return state.trackSettings;
  }

  function moveFullscreenToZoom() {
    if (!ui.fullscreenBtn || !ui.zoomOut) return;
    const zoom = ui.zoomOut.closest(".range-control") || ui.zoomSlider?.closest(".range-control");
    if (!zoom) return;
    zoom.classList.add("orgavox-zoom-with-fullscreen");
    if (ui.fullscreenBtn.parentElement !== zoom || ui.fullscreenBtn.previousElementSibling !== ui.zoomOut) {
      ui.zoomOut.insertAdjacentElement("afterend", ui.fullscreenBtn);
    }
    ui.fullscreenBtn.title = "Toggle fullscreen";
  }

  function makeBackButtonPurple() {
    ui.jumpStartBtn?.classList.add("orgavox-back-purple");
  }

  function ensureEditDropdown() {
    const editGroup = document.querySelector(".orgavox-edit-group");
    if (!editGroup) return null;

    let wrapper = document.getElementById(EDIT_MENU_ID);
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = EDIT_MENU_ID;
      wrapper.className = "orgavox-edit-dropdown";
      wrapper.innerHTML = `<button class="tool-button orgavox-edit-button" type="button" aria-expanded="false">✎ Edit ▾</button><div class="orgavox-edit-menu" hidden></div>`;
      const button = wrapper.querySelector(".orgavox-edit-button");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const menu = wrapper.querySelector(".orgavox-edit-menu");
        menu.hidden = !menu.hidden;
        button.setAttribute("aria-expanded", String(!menu.hidden));
      });
      document.addEventListener("click", (event) => {
        if (!event.target.closest(`#${EDIT_MENU_ID}`)) {
          const menu = wrapper.querySelector(".orgavox-edit-menu");
          if (menu) menu.hidden = true;
          button.setAttribute("aria-expanded", "false");
        }
      });
    }

    const effectsDrop = editGroup.querySelector(".orgavox-effects-dropdown");
    if (effectsDrop && wrapper.parentElement !== editGroup) editGroup.insertBefore(wrapper, effectsDrop);
    else if (!effectsDrop && wrapper.parentElement !== editGroup) editGroup.appendChild(wrapper);

    const menu = wrapper.querySelector(".orgavox-edit-menu");
    const items = [
      [ui.scissorsBtn, "✂️ Cut"],
      [ui.deleteBtn, "🗑 DEL"],
      [ui.downloadClipBtn, "⬇ Download Clip"],
      [ui.bounceBtn, "🧱 Bounce"]
    ];
    items.forEach(([button, label]) => {
      if (!button) return;
      button.textContent = label;
      if (button.parentElement !== menu) menu.appendChild(button);
    });
    return wrapper;
  }

  function installTrackClampFixes() {
    if (window.__orgavoxV050TrackClampFixed) return;
    window.__orgavoxV050TrackClampFixed = true;

    addClipFromAsset = function orgavoxV050AddClipFromAsset(assetId, track, start) {
      const asset = state.assets.find((item) => item.id === assetId);
      if (!asset) return;
      const clip = {
        id: makeId("clip"),
        assetId,
        name: asset.name,
        track: clampTrack(track),
        start: Math.max(0, Number(start) || 0),
        sourceStart: 0,
        sourceEnd: asset.duration,
        stretchDuration: null,
        volume: 100,
        echo: 0,
        gate: null,
        bufferOverride: null,
        cacheVersion: 0
      };
      state.clips.push(clip);
      selectClip(clip.id);
      renderTimeline();
      showToast(`${asset.name} added to Track ${clip.track + 1}.`);
      window.orgavoxRecordHistory?.();
    };

    selectTrack = function orgavoxV050SelectTrack(track) {
      state.selectedTrack = clampTrack(track);
      ui.lanes = [...document.querySelectorAll(".track-lane")];
      ui.trackLabels = [...document.querySelectorAll(".track-label")];
      ui.lanes.forEach((lane) => lane.classList.toggle("selected-track", Number(lane.dataset.track) === state.selectedTrack));
      ui.trackLabels.forEach((label) => label.classList.toggle("active", Number(label.dataset.trackLabel) === state.selectedTrack));
      renderAssets();
      window.orgavoxRefreshTrackTools?.();
    };
  }

  function localSnapTime(time, exceptClipId) {
    const raw = Math.max(0, Number(time) || 0);
    if (localStorage.getItem("orgavoxSnapEnabled") !== "true") return raw;
    const grid = Math.max(0.001, Number(localStorage.getItem("orgavoxSnapGrid") || "1") || 1);
    const tolerance = Math.max(0.035, 14 / Math.max(25, Number(state.pixelsPerSecond) || 80));
    const candidates = [
      Math.round(raw / grid) * grid,
      Math.max(0, Number(state.playhead) || 0),
      ...(Array.isArray(state.markers) ? state.markers.map((marker) => Math.max(0, Number(marker.time) || 0)) : [])
    ];
    state.clips.forEach((clip) => {
      if (!clip || clip.id === exceptClipId) return;
      candidates.push(Math.max(0, Number(clip.start) || 0));
      candidates.push(Math.max(0, (Number(clip.start) || 0) + clipDuration(clip)));
    });
    let best = candidates[0];
    let bestDistance = Math.abs(best - raw);
    candidates.forEach((candidate) => {
      const distance = Math.abs(candidate - raw);
      if (distance <= tolerance && distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    });
    return Math.max(0, best);
  }

  function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd - 0.015 && aEnd > bStart + 0.015;
  }

  function resolveOverlap(clip) {
    const duration = clipDuration(clip);
    let start = Math.max(0, clip.start);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const conflict = state.clips
        .filter((other) => other.id !== clip.id && other.track === clip.track)
        .sort((a, b) => a.start - b.start)
        .find((other) => intervalsOverlap(start, start + duration, other.start, other.start + clipDuration(other)));
      if (!conflict) break;
      start = Math.max(0, conflict.start + clipDuration(conflict) + 0.04);
    }
    clip.start = localSnapTime(start, clip.id);
  }

  function installClipDragFixes() {
    if (window.__orgavoxV050ClipDragFixed) return;
    window.__orgavoxV050ClipDragFixed = true;

    beginClipPointer = function orgavoxV050BeginClipPointer(event, clip, element) {
      if (event.button != null && event.button !== 0) return;
      event.stopPropagation();
      const edge = event.target.closest(".clip-handle")?.dataset.edge || null;

      if (!edge && (state.selectedClipId !== clip.id || armedClipId !== clip.id)) {
        stopPlayback();
        selectClip(clip.id, false);
        armedClipId = clip.id;
        freshlyArmedClipId = clip.id;
        element.classList.add("orgavox-drag-armed");
        showToast("Clip selected. Drag it now, or click it again to unselect.");
        return;
      }

      stopPlayback();
      selectClip(clip.id, false);
      const original = {
        start: clip.start,
        track: clip.track,
        sourceStart: clip.sourceStart,
        sourceEnd: clip.sourceEnd,
        stretchDuration: clip.stretchDuration
      };
      state.clipDrag = {
        clipId: clip.id,
        type: edge ? "edge" : "move",
        edge,
        element,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        original
      };
      element.classList.add("orgavox-dragging");
      element.setPointerCapture?.(event.pointerId);
      element.addEventListener("pointermove", moveClipPointer);
      element.addEventListener("pointerup", endClipPointer, { once: true });
      element.addEventListener("pointercancel", endClipPointer, { once: true });
    };

    moveClipPointer = function orgavoxV050MoveClipPointer(event) {
      const drag = state.clipDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const clip = state.clips.find((item) => item.id === drag.clipId);
      if (!clip) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      const deltaSeconds = dx / Math.max(1, state.pixelsPerSecond);

      if (drag.type === "move") {
        clip.start = localSnapTime(Math.max(0, drag.original.start + deltaSeconds), clip.id);
        const lanes = ui.lanes && ui.lanes.length ? ui.lanes : [...document.querySelectorAll(".track-lane")];
        const tracksRect = ui.tracks.getBoundingClientRect();
        const laneHeight = tracksRect.height / Math.max(1, lanes.length || TRACK_COUNT);
        const nextTrack = clampTrack(Math.floor((event.clientY - tracksRect.top) / laneHeight));
        if (clip.track !== nextTrack && lanes[nextTrack]) {
          clip.track = nextTrack;
          state.selectedTrack = nextTrack;
          lanes[nextTrack].appendChild(drag.element);
          ui.trackLabels?.forEach((label) => label.classList.toggle("active", Number(label.dataset.trackLabel) === nextTrack));
          lanes.forEach((lane) => lane.classList.toggle("selected-track", Number(lane.dataset.track) === nextTrack));
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
    };

    endClipPointer = function orgavoxV050EndClipPointer(event) {
      const drag = state.clipDrag;
      const element = drag?.element || event.currentTarget;
      if (element?.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
      element?.removeEventListener("pointermove", moveClipPointer);
      element?.classList.remove("orgavox-dragging");

      if (drag) {
        const clip = state.clips.find((item) => item.id === drag.clipId);
        if (clip && drag.type === "move") {
          if (!drag.moved) {
            state.selectedClipId = null;
            armedClipId = null;
            freshlyArmedClipId = null;
            state.clipDrag = null;
            syncSelectedControls();
            renderTimeline();
            suppressNextClipClickUntil = Date.now() + 250;
            showToast("Clip unselected.");
            return;
          }
          resolveOverlap(clip);
          armedClipId = clip.id;
        }
      }

      state.clipDrag = null;
      suppressNextClipClickUntil = Date.now() + 180;
      renderTimeline();
      window.orgavoxRecordHistory?.();
    };

    document.addEventListener("click", (event) => {
      const clipNode = event.target.closest?.(".audio-clip");
      if (!clipNode) return;
      const id = clipNode.dataset.clipId;
      if (Date.now() < suppressNextClipClickUntil || freshlyArmedClipId === id) {
        freshlyArmedClipId = null;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function trackVolumeLabel(index) {
    const setting = trackSettings()[index] || {};
    const volume = Number.isFinite(Number(setting.volume)) ? Math.round(Number(setting.volume)) : 100;
    const pan = Number(setting.pan) || 0;
    const bits = [`VOL ${volume}%`];
    if (pan) bits.push(`PAN ${pan > 0 ? "+" : ""}${pan}`);
    if (setting.muted) bits.push("MUTED");
    if (setting.solo) bits.push("SOLO");
    return bits.join(" · ");
  }

  function addTrackVolumeOverlays() {
    ui.lanes = [...document.querySelectorAll(".track-lane")];
    ui.lanes.forEach((lane) => {
      const index = clampTrack(lane.dataset.track);
      let overlay = lane.querySelector(".orgavox-track-volume-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "orgavox-track-volume-overlay";
        lane.appendChild(overlay);
      }
      overlay.textContent = trackVolumeLabel(index);
    });
  }

  function applySelectedClipClasses() {
    document.querySelectorAll(".audio-clip").forEach((clip) => {
      const selected = clip.dataset.clipId === state.selectedClipId;
      clip.classList.toggle("orgavox-drag-armed", selected && armedClipId === clip.dataset.clipId);
    });
  }

  function patchRender() {
    if (window.__orgavoxV050RenderPatched) return;
    window.__orgavoxV050RenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxV050RenderTimeline() {
      const result = previousRenderTimeline.apply(this, arguments);
      addTrackVolumeOverlays();
      applySelectedClipClasses();
      applyCleanup();
      return result;
    };

    const previousRenderAssets = renderAssets;
    renderAssets = function orgavoxV050RenderAssets() {
      const result = previousRenderAssets.apply(this, arguments);
      applyCleanup();
      return result;
    };
  }

  function applyCleanup() {
    makeBackButtonPurple();
    moveFullscreenToZoom();
    ensureEditDropdown();
    addTrackVolumeOverlays();
    applySelectedClipClasses();
    window.orgavoxRefreshTrackTools?.();
  }

  function init() {
    installStyles();
    installTrackClampFixes();
    installClipDragFixes();
    patchRender();
    applyCleanup();
    setTimeout(applyCleanup, 0);
    setTimeout(applyCleanup, 200);
    setTimeout(applyCleanup, 600);
  }

  window.orgavoxApplyFinalCleanup = applyCleanup;
  init();
})();
