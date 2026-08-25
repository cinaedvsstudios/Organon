"use strict";

(function installOrgavoxSnapTools() {
  const STYLE_ID = "orgavox-snap-tools-style";
  const GRID_OPTIONS = [0.125, 0.25, 0.5, 1, 2, 5, 10];
  let snapEnabled = localStorage.getItem("orgavoxSnapEnabled") === "true";
  let snapGrid = Number(localStorage.getItem("orgavoxSnapGrid") || "1");
  if (!GRID_OPTIONS.includes(snapGrid)) snapGrid = 1;

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-snap-button,
      .orgavox-nudge-button,
      .orgavox-align-button{
        border-color:rgba(117,178,222,.76)!important;
        background:linear-gradient(180deg,rgba(33,80,122,.86),rgba(13,35,61,.95))!important;
        color:#dff5ff!important;
      }
      .orgavox-snap-button.active{
        border-color:rgba(248,215,146,.92)!important;
        background:linear-gradient(180deg,rgba(129,85,31,.92),rgba(55,34,13,.96))!important;
        color:#fff0bd!important;
        box-shadow:0 0 0 1px rgba(248,215,146,.24),0 0 16px rgba(248,215,146,.22)!important;
      }
      .orgavox-snap-grid-select{
        min-height:36px!important;
        height:36px!important;
        padding:0 8px!important;
        border:1px solid rgba(117,178,222,.44)!important;
        border-radius:10px!important;
        background:rgba(0,0,0,.24)!important;
        color:#dff5ff!important;
        font:900 .62rem var(--font-mono)!important;
        letter-spacing:.035em!important;
      }
      .orgavox-markers-button{
        border-color:rgba(178,109,255,.9)!important;
        background:linear-gradient(180deg,rgba(106,60,190,.94),rgba(53,27,108,.96))!important;
        color:#f3e2ff!important;
        box-shadow:0 0 0 1px rgba(178,109,255,.24),0 0 14px rgba(130,78,220,.22)!important;
      }
      .timeline-scroll{
        scrollbar-color:#75b2de rgba(0,0,0,.32)!important;
        scrollbar-width:thin!important;
      }
      .timeline-scroll::-webkit-scrollbar,
      .library-panel::-webkit-scrollbar,
      .asset-list::-webkit-scrollbar{
        width:13px;height:13px;
      }
      .timeline-scroll::-webkit-scrollbar-track,
      .library-panel::-webkit-scrollbar-track,
      .asset-list::-webkit-scrollbar-track{
        background:rgba(0,0,0,.28);
        border-radius:999px;
      }
      .timeline-scroll::-webkit-scrollbar-thumb,
      .library-panel::-webkit-scrollbar-thumb,
      .asset-list::-webkit-scrollbar-thumb{
        background:linear-gradient(180deg,#75b2de,#2f7dae);
        border:3px solid rgba(0,0,0,.28);
        border-radius:999px;
        box-shadow:0 0 10px rgba(117,178,222,.24);
      }
      .timeline-scroll::-webkit-scrollbar-thumb:active,
      .library-panel::-webkit-scrollbar-thumb:active,
      .asset-list::-webkit-scrollbar-thumb:active{
        background:#ffffff;
        box-shadow:0 0 16px rgba(255,255,255,.72),0 0 26px rgba(117,178,222,.45);
      }
      .audio-clip.orgavox-snap-preview{
        outline:2px solid rgba(248,215,146,.82)!important;
        box-shadow:0 0 18px rgba(248,215,146,.28)!important;
      }
    `;
    document.head.appendChild(style);
  }

  function clampPps(value) {
    return Math.max(25, Math.min(500, Math.round(Number(value) || 80)));
  }

  function snapTolerance() {
    return Math.max(0.035, 14 / Math.max(25, Number(state.pixelsPerSecond) || 80));
  }

  function markerTimes() {
    return Array.isArray(state.markers)
      ? state.markers.map((marker) => Math.max(0, Number(marker.time) || 0))
      : [];
  }

  function clipEdgeTimes(exceptClipId) {
    const times = [];
    state.clips.forEach((clip) => {
      if (!clip || clip.id === exceptClipId) return;
      times.push(Math.max(0, Number(clip.start) || 0));
      times.push(Math.max(0, (Number(clip.start) || 0) + clipDuration(clip)));
    });
    return times;
  }

  function gridSnap(time) {
    const grid = Math.max(0.001, Number(snapGrid) || 1);
    return Math.max(0, Math.round(time / grid) * grid);
  }

  function snapTime(time, exceptClipId = null) {
    const raw = Math.max(0, Number(time) || 0);
    if (!snapEnabled) return raw;

    const candidates = [gridSnap(raw), Math.max(0, Number(state.playhead) || 0), ...markerTimes(), ...clipEdgeTimes(exceptClipId)];
    const tolerance = snapTolerance();
    let best = gridSnap(raw);
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

  function updateButtonState() {
    if (ui.snapBtn) {
      ui.snapBtn.classList.toggle("active", snapEnabled);
      ui.snapBtn.textContent = snapEnabled ? "🧲 Snap on" : "🧲 Snap";
      ui.snapBtn.title = snapEnabled
        ? `Snap on — grid ${snapGrid}s, markers and clip edges`
        : "Snap off — click to enable grid snapping";
    }
    if (ui.snapGridSelect) ui.snapGridSelect.value = String(snapGrid);
  }

  function ensureControls() {
    if (!ui.snapBtn) {
      const button = document.createElement("button");
      button.id = "snapGridBtn";
      button.type = "button";
      button.className = "tool-button orgavox-snap-button";
      button.addEventListener("click", () => {
        snapEnabled = !snapEnabled;
        localStorage.setItem("orgavoxSnapEnabled", String(snapEnabled));
        updateButtonState();
        showToast(snapEnabled ? `Snap on — ${snapGrid}s grid.` : "Snap off.");
      });
      ui.snapBtn = button;
    }

    if (!ui.snapGridSelect) {
      const select = document.createElement("select");
      select.id = "snapGridSelect";
      select.className = "orgavox-snap-grid-select";
      select.title = "Snap grid size";
      GRID_OPTIONS.forEach((value) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = value < 1 ? `${Math.round(value * 1000)}ms` : `${value}s`;
        select.appendChild(option);
      });
      select.addEventListener("change", () => {
        snapGrid = Number(select.value) || 1;
        localStorage.setItem("orgavoxSnapGrid", String(snapGrid));
        snapEnabled = true;
        localStorage.setItem("orgavoxSnapEnabled", "true");
        updateButtonState();
        showToast(`Snap grid set to ${select.selectedOptions[0]?.textContent || `${snapGrid}s`}.`);
      });
      ui.snapGridSelect = select;
    }

    if (!ui.nudgeLeftBtn) {
      const button = document.createElement("button");
      button.id = "nudgeLeftBtn";
      button.type = "button";
      button.className = "tool-button orgavox-nudge-button";
      button.textContent = "◀ Nudge";
      button.title = "Move selected clip left by the snap grid";
      button.addEventListener("click", () => nudgeSelected(-1));
      ui.nudgeLeftBtn = button;
    }

    if (!ui.nudgeRightBtn) {
      const button = document.createElement("button");
      button.id = "nudgeRightBtn";
      button.type = "button";
      button.className = "tool-button orgavox-nudge-button";
      button.textContent = "Nudge ▶";
      button.title = "Move selected clip right by the snap grid";
      button.addEventListener("click", () => nudgeSelected(1));
      ui.nudgeRightBtn = button;
    }

    if (!ui.alignPlayheadBtn) {
      const button = document.createElement("button");
      button.id = "alignPlayheadBtn";
      button.type = "button";
      button.className = "tool-button orgavox-align-button";
      button.textContent = "⤓ Align";
      button.title = "Align selected clip start to playhead";
      button.addEventListener("click", alignSelectedToPlayhead);
      ui.alignPlayheadBtn = button;
    }

    updateButtonState();
    return [ui.snapBtn, ui.snapGridSelect, ui.nudgeLeftBtn, ui.nudgeRightBtn, ui.alignPlayheadBtn];
  }

  function placeControls() {
    ensureControls();
    const editGroup = document.querySelector(".orgavox-edit-group");
    const effectsDrop = editGroup?.querySelector(".orgavox-effects-dropdown");
    if (!editGroup) return;
    [ui.snapBtn, ui.snapGridSelect, ui.nudgeLeftBtn, ui.nudgeRightBtn, ui.alignPlayheadBtn]
      .filter(Boolean)
      .forEach((control) => {
        if (effectsDrop) editGroup.insertBefore(control, effectsDrop);
        else if (control.parentElement !== editGroup) editGroup.appendChild(control);
      });
    if (ui.markersBtn) ui.markersBtn.classList.add("orgavox-markers-button");
    updateButtonState();
  }

  function updateSelectedButtons() {
    const hasClip = Boolean(selectedClip());
    [ui.nudgeLeftBtn, ui.nudgeRightBtn, ui.alignPlayheadBtn].filter(Boolean).forEach((button) => {
      button.disabled = !hasClip;
    });
  }

  function nudgeAmount() {
    return snapEnabled ? Math.max(0.001, snapGrid) : 0.1;
  }

  function nudgeSelected(direction) {
    const clip = selectedClip();
    if (!clip) return showToast("Select a clip to nudge.");
    stopPlayback();
    const amount = nudgeAmount() * (direction < 0 ? -1 : 1);
    clip.start = Math.max(0, clip.start + amount);
    renderTimeline();
    syncSelectedControls();
    showToast(`${direction < 0 ? "Nudged left" : "Nudged right"} by ${snapEnabled ? `${snapGrid}s` : "0.1s"}.`);
    window.orgavoxRecordHistory?.();
  }

  function alignSelectedToPlayhead() {
    const clip = selectedClip();
    if (!clip) return showToast("Select a clip to align.");
    stopPlayback();
    clip.start = snapTime(state.playhead, clip.id);
    renderTimeline();
    syncSelectedControls();
    showToast("Clip aligned to playhead.");
    window.orgavoxRecordHistory?.();
  }

  function applySnapToDragElement() {
    const drag = state.clipDrag;
    if (!drag || drag.type !== "move" || !snapEnabled) return;
    const clip = state.clips.find((item) => item.id === drag.clipId);
    if (!clip) return;
    const snapped = snapTime(clip.start, clip.id);
    if (Math.abs(snapped - clip.start) < 0.0001) return;
    clip.start = snapped;
    const element = drag.element || document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
    if (element) {
      element.style.left = `${clip.start * state.pixelsPerSecond}px`;
      element.classList.add("orgavox-snap-preview");
    }
  }

  function patchDragging() {
    if (window.__orgavoxSnapDragPatched) return;
    window.__orgavoxSnapDragPatched = true;

    const previousAddClipFromAsset = addClipFromAsset;
    addClipFromAsset = function orgavoxSnapAddClipFromAsset(assetId, track, start) {
      return previousAddClipFromAsset(assetId, track, snapTime(start));
    };

    const previousMoveClipPointer = moveClipPointer;
    moveClipPointer = function orgavoxSnapMoveClipPointer(event) {
      const result = previousMoveClipPointer.apply(this, arguments);
      applySnapToDragElement();
      return result;
    };

    const previousEndClipPointer = endClipPointer;
    endClipPointer = function orgavoxSnapEndClipPointer(event) {
      const drag = state.clipDrag;
      if (drag?.type === "move" && snapEnabled) {
        const clip = state.clips.find((item) => item.id === drag.clipId);
        if (clip) clip.start = snapTime(clip.start, clip.id);
      }
      return previousEndClipPointer.apply(this, arguments);
    };
  }

  function patchRender() {
    if (window.__orgavoxSnapRenderPatched) return;
    window.__orgavoxSnapRenderPatched = true;

    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxSnapRenderTimeline() {
      const result = previousRenderTimeline.apply(this, arguments);
      placeControls();
      updateSelectedButtons();
      return result;
    };

    const previousSyncSelectedControls = syncSelectedControls;
    syncSelectedControls = function orgavoxSnapSyncSelectedControls() {
      const result = previousSyncSelectedControls.apply(this, arguments);
      updateSelectedButtons();
      return result;
    };
  }

  function installWheelZoom() {
    if (!ui.timelineScroll || ui.timelineScroll.dataset.orgavoxWheelZoom === "true") return;
    ui.timelineScroll.dataset.orgavoxWheelZoom = "true";
    ui.timelineScroll.addEventListener("wheel", (event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();

      const rect = ui.timelineScroll.getBoundingClientRect();
      const localX = Math.max(0, event.clientX - rect.left);
      const timeAtPointer = (ui.timelineScroll.scrollLeft + localX) / Math.max(1, state.pixelsPerSecond);
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      state.pixelsPerSecond = clampPps(state.pixelsPerSecond * factor);

      if (ui.zoomSlider) ui.zoomSlider.value = state.pixelsPerSecond;
      if (ui.zoomOut) ui.zoomOut.textContent = `${Math.round(state.pixelsPerSecond / 80 * 100)}%`;

      renderTimeline();
      ui.timelineScroll.scrollLeft = Math.max(0, timeAtPointer * state.pixelsPerSecond - localX);
      window.orgavoxRenderMarkers?.();
      window.orgavoxRecordHistory?.();
    }, { passive: false });
  }

  function installKeyNudge() {
    if (window.__orgavoxSnapKeyNudge) return;
    window.__orgavoxSnapKeyNudge = true;
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable)) return;
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      nudgeSelected(event.key === "ArrowLeft" ? -1 : 1);
    });
  }

  function init() {
    installStyles();
    patchDragging();
    patchRender();
    installWheelZoom();
    installKeyNudge();
    placeControls();
    updateSelectedButtons();
    setTimeout(() => { placeControls(); installWheelZoom(); }, 150);
  }

  window.orgavoxPlaceSnapTools = placeControls;
  window.orgavoxSnapTime = snapTime;
  window.orgavoxSnapEnabled = () => snapEnabled;
  init();
})();
