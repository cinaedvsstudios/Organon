"use strict";

(function bootOrgavoxV054ToolbarInput() {
  const VERSION = "v0.54";
  const STYLE_ID = "orgavox-v054-toolbar-input-style";
  const TRACK_COUNT = 10;
  let installAttempts = 0;
  let installed = false;
  let scrubPointerId = null;
  let suppressTimelineClickUntil = 0;
  let recentClipPointerAt = 0;
  let lastAssetAdd = null;

  function ready() {
    return typeof ui !== "undefined"
      && typeof state !== "undefined"
      && typeof setPlayhead === "function"
      && typeof renderTimeline === "function"
      && typeof selectedClip === "function"
      && typeof addClipFromAsset === "function";
  }

  function boot() {
    if (!ready()) {
      installAttempts += 1;
      if (installAttempts < 160) setTimeout(boot, 50);
      return;
    }
    install();
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .orgavox-edit-group{
        align-items:center!important;
      }
      body.simple-edit-phase1 .orgavox-main-controls-group{
        display:inline-flex!important;
        align-items:center!important;
        flex-wrap:nowrap!important;
        gap:8px!important;
        min-width:0!important;
      }
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v054{
        display:grid!important;
        grid-template-columns:auto minmax(60px,96px) 42px 34px!important;
        grid-template-rows:36px!important;
        align-items:center!important;
        gap:7px!important;
        min-width:206px!important;
        margin:0!important;
      }
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v054 span,
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v054 input,
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v054 output{
        grid-row:1!important;
      }
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v054 #echoSettingsBtn{
        grid-column:4!important;
        grid-row:1!important;
        align-self:center!important;
        justify-self:center!important;
        margin:0!important;
        width:32px!important;
        min-width:32px!important;
        height:32px!important;
        min-height:32px!important;
        padding:0!important;
      }
      body.simple-edit-phase1 .orgavox-playhead-step-button{
        min-width:34px!important;
        width:34px!important;
        height:34px!important;
        min-height:34px!important;
        padding:0!important;
        border-color:rgba(117,178,222,.68)!important;
        background:linear-gradient(180deg,rgba(25,67,106,.88),rgba(8,27,51,.96))!important;
        color:#dff5ff!important;
        font:900 .72rem var(--font-mono)!important;
      }
      body.simple-edit-phase1 .orgavox-playhead-step-button:hover:not(:disabled){
        box-shadow:0 0 0 1px rgba(117,178,222,.24),0 0 14px rgba(75,155,255,.28)!important;
      }
      body.simple-edit-phase1 #orgavoxSendToStartBtn{
        border-color:rgba(224,163,96,.72)!important;
        color:#ffe4a8!important;
      }
      body.simple-edit-phase1 .timeline-scroll.orgavox-scrubbing,
      body.simple-edit-phase1 .timeline-scroll.orgavox-scrubbing *{
        cursor:crosshair!important;
      }
      body.simple-edit-phase1 .audio-clip{
        -webkit-user-drag:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function setVersion() {
    window.ORGAVOX_VERSION = VERSION;
    document.title = `Organon — ORGAVOX ${VERSION}`;
    document.querySelectorAll(".simple-edit-version,.phase1-version,.orgavox-sidebar-version").forEach((node) => {
      node.textContent = VERSION;
    });
  }

  function tip(button, text) {
    if (!button || !text) return;
    button.title = text;
    button.setAttribute("aria-label", text);
  }

  function clampTrack(value) {
    return Math.max(0, Math.min(TRACK_COUNT - 1, Number(value) || 0));
  }

  function selectedIds() {
    if (Array.isArray(state.selectedClipIds) && state.selectedClipIds.length) {
      return state.selectedClipIds.filter((id) => state.clips.some((clip) => clip.id === id));
    }
    return state.selectedClipId ? [state.selectedClipId] : [];
  }

  function nudgePlayhead(direction, amount = 0.1, scroll = true) {
    const delta = (direction < 0 ? -1 : 1) * amount;
    setPlayhead(Math.max(0, (Number(state.playhead) || 0) + delta), scroll);
  }

  function ensurePlayheadStepButtons() {
    const group = document.querySelector(".orgavox-transport-group") || ui.timeReadout?.parentElement;
    if (!group || !ui.timeReadout) return;

    if (!ui.playheadBackStepBtn) {
      const button = document.createElement("button");
      button.id = "playheadBackStepBtn";
      button.type = "button";
      button.className = "icon-button orgavox-playhead-step-button";
      button.textContent = "←";
      tip(button, "Move playhead back 0.1 seconds");
      button.addEventListener("click", () => nudgePlayhead(-1, 0.1, true));
      ui.playheadBackStepBtn = button;
    }

    if (!ui.playheadForwardStepBtn) {
      const button = document.createElement("button");
      button.id = "playheadForwardStepBtn";
      button.type = "button";
      button.className = "icon-button orgavox-playhead-step-button";
      button.textContent = "→";
      tip(button, "Move playhead forward 0.1 seconds");
      button.addEventListener("click", () => nudgePlayhead(1, 0.1, true));
      ui.playheadForwardStepBtn = button;
    }

    if (ui.playheadBackStepBtn.parentElement !== group || ui.playheadBackStepBtn.previousElementSibling !== ui.timeReadout) {
      group.insertBefore(ui.playheadBackStepBtn, ui.timeReadout.nextSibling);
    }
    if (ui.playheadForwardStepBtn.parentElement !== group || ui.playheadForwardStepBtn.previousElementSibling !== ui.playheadBackStepBtn) {
      group.insertBefore(ui.playheadForwardStepBtn, ui.playheadBackStepBtn.nextSibling);
    }
  }

  function fixEchoSettingsLine() {
    const control = ui.echoSlider?.closest(".range-control");
    const button = document.getElementById("echoSettingsBtn") || ui.echoSettingsBtn;
    if (!control || !button || !ui.echoOut) return;
    control.classList.add("orgavox-echo-inline-v054");
    if (button.parentElement !== control || button.previousElementSibling !== ui.echoOut) {
      ui.echoOut.insertAdjacentElement("afterend", button);
    }
    ui.echoSettingsBtn = button;
    tip(button, "Open detailed echo settings for the selected clip");
  }

  function insertAfter(anchor, node) {
    if (!anchor || !anchor.parentElement || !node) return node;
    if (anchor.nextSibling !== node) anchor.parentElement.insertBefore(node, anchor.nextSibling);
    return node;
  }

  function placeToolbarOrder() {
    const group = document.querySelector(".orgavox-edit-group");
    if (!group) return;

    window.orgavoxRestoreViewMenu?.();

    const edit = document.getElementById("orgavoxEditDropdown");
    const view = document.getElementById("orgavoxViewDropdown");
    const effects = group.querySelector(".orgavox-effects-dropdown") || document.querySelector(".orgavox-effects-dropdown");
    const marker = ui.markersBtn || document.getElementById("markersBtn");
    const nudgeLeft = ui.nudgeLeftBtn || document.getElementById("nudgeLeftBtn");
    const nudgeRight = ui.nudgeRightBtn || document.getElementById("nudgeRightBtn");
    const snap = ui.snapBtn || document.getElementById("snapGridBtn");
    const snapGrid = ui.snapGridSelect || document.getElementById("snapGridSelect");
    const redo = ui.redoBtn || document.getElementById("redoBtn");

    if (marker) {
      marker.textContent = "🏷 Add Marker";
      marker.classList.add("orgavox-markers-button");
      tip(marker, "Add a marker at the playhead");
    }

    const desired = [edit, view, effects, marker, nudgeLeft, nudgeRight, snap, snapGrid].filter(Boolean);
    let anchor = redo && redo.parentElement === group ? redo : null;

    desired.forEach((node) => {
      if (!node || node === anchor) return;
      if (anchor) {
        insertAfter(anchor, node);
      } else {
        group.insertBefore(node, group.firstChild);
      }
      anchor = node;
    });
  }

  function sendSelectedToStart() {
    const ids = selectedIds();
    const clips = state.clips.filter((clip) => ids.includes(clip.id));
    if (!clips.length) return showToast("Select a clip to send to start.");
    stopPlayback();
    if (clips.length === 1) {
      clips[0].start = 0;
    } else {
      const earliest = Math.min(...clips.map((clip) => Math.max(0, Number(clip.start) || 0)));
      clips.forEach((clip) => { clip.start = Math.max(0, (Number(clip.start) || 0) - earliest); });
    }
    renderTimeline();
    syncSelectedControls();
    showToast(clips.length === 1 ? "Clip sent to start." : `${clips.length} clips sent to start.`);
    window.orgavoxRecordHistory?.();
  }

  function ensureSendToStartMenuItem() {
    const panel = document.querySelector("#orgavoxViewDropdown .orgavox-view-menu");
    if (!panel) return;
    let button = document.getElementById("orgavoxSendToStartBtn");
    if (!button) {
      button = document.createElement("button");
      button.id = "orgavoxSendToStartBtn";
      button.type = "button";
      button.className = "tool-button";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        panel.hidden = true;
        sendSelectedToStart();
      });
    }
    button.textContent = "↤ Send to Start";
    tip(button, "Move the selected clip to 0:00");
    const markerPanel = document.getElementById("orgavoxMarkerPanelBtn");
    if (markerPanel?.parentElement === panel) {
      insertAfter(markerPanel, button);
    } else if (button.parentElement !== panel) {
      panel.prepend(button);
    }
  }

  function installKeyboardPlayheadNudge() {
    if (window.__orgavoxV054KeyboardPlayhead) return;
    window.__orgavoxV054KeyboardPlayhead = true;
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable);
      if (typing || event.defaultPrevented || event.altKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      const amount = event.shiftKey ? 10 : (event.ctrlKey || event.metaKey ? 1 : 0.1);
      nudgePlayhead(direction, amount, true);
    }, true);
  }

  function timeFromPointer(event) {
    const rect = ui.timelineScroll.getBoundingClientRect();
    const x = Math.max(0, (event.clientX - rect.left) + ui.timelineScroll.scrollLeft);
    return x / Math.max(1, Number(state.pixelsPerSecond) || 80);
  }

  function scrubTarget(event) {
    const target = event.target;
    if (!target || !ui.timelineScroll?.contains(target)) return null;
    if (target.closest?.(".audio-clip,.clip-handle,button,input,select,textarea,label,.track-label-column,.asset-list,.library-panel,.popover,.modal-backdrop")) return null;
    const lane = target.closest?.(".track-lane");
    if (target === ui.rulerCanvas || lane || target.closest?.("#tracks,.tracks,.timeline-content")) return { lane };
    return null;
  }

  function updateScrub(event, scroll = false) {
    setPlayhead(timeFromPointer(event), scroll);
  }

  function installTimelineScrub() {
    if (!ui.timelineScroll || ui.timelineScroll.dataset.orgavoxV054Scrub === "true") return;
    ui.timelineScroll.dataset.orgavoxV054Scrub = "true";

    ui.timelineScroll.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) return;
      const hit = scrubTarget(event);
      if (!hit) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (hit.lane) selectTrack(hit.lane.dataset.track);
      scrubPointerId = event.pointerId;
      ui.timelineScroll.classList.add("orgavox-scrubbing");
      ui.timelineScroll.setPointerCapture?.(event.pointerId);
      updateScrub(event, false);
    }, true);

    ui.timelineScroll.addEventListener("pointermove", (event) => {
      if (scrubPointerId == null || event.pointerId !== scrubPointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      updateScrub(event, false);
    }, true);

    function finish(event) {
      if (scrubPointerId == null || event.pointerId !== scrubPointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      ui.timelineScroll.releasePointerCapture?.(event.pointerId);
      ui.timelineScroll.classList.remove("orgavox-scrubbing");
      scrubPointerId = null;
      suppressTimelineClickUntil = Date.now() + 220;
    }

    ui.timelineScroll.addEventListener("pointerup", finish, true);
    ui.timelineScroll.addEventListener("pointercancel", finish, true);
    ui.timelineScroll.addEventListener("click", (event) => {
      if (Date.now() > suppressTimelineClickUntil) return;
      const hit = scrubTarget(event);
      if (!hit) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function installDragCopyGuard() {
    if (window.__orgavoxV054DragCopyGuard) return;
    window.__orgavoxV054DragCopyGuard = true;

    document.addEventListener("pointerdown", (event) => {
      if (event.target.closest?.(".audio-clip")) {
        recentClipPointerAt = Date.now();
        state.dragAssetId = null;
      }
    }, true);

    document.addEventListener("dragstart", (event) => {
      if (!event.target.closest?.(".audio-clip")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      recentClipPointerAt = Date.now();
      state.dragAssetId = null;
    }, true);

    document.addEventListener("drop", (event) => {
      if (!ui.timelineScroll?.contains(event.target)) return;
      if (Date.now() - recentClipPointerAt < 1400 && !state.dragAssetId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      setTimeout(() => { state.dragAssetId = null; }, 0);
    }, true);

    const previousAddClipFromAsset = addClipFromAsset;
    addClipFromAsset = function orgavoxV054AddClipFromAsset(assetId, track, start) {
      const now = Date.now();
      const safeTrack = clampTrack(track);
      const safeStart = Math.max(0, Number(start) || 0);
      const duplicate = lastAssetAdd
        && now - lastAssetAdd.time < 900
        && String(assetId || "") === lastAssetAdd.assetId
        && safeTrack === lastAssetAdd.track
        && Math.abs(safeStart - lastAssetAdd.start) < 0.3;
      const suspiciousClipMoveAdd = now - recentClipPointerAt < 700 && !state.dragAssetId;

      if (duplicate || suspiciousClipMoveAdd) {
        showToast("Duplicate clip add ignored.");
        return null;
      }

      const before = state.clips.length;
      const result = previousAddClipFromAsset.apply(this, arguments);
      if (state.clips.length > before) {
        lastAssetAdd = { time: now, assetId: String(assetId || ""), track: safeTrack, start: safeStart };
      }
      return result;
    };
  }

  function disableClipHtmlDrag() {
    document.querySelectorAll(".audio-clip").forEach((clip) => {
      clip.draggable = false;
      clip.setAttribute("draggable", "false");
    });
  }

  function refresh() {
    setVersion();
    installStyles();
    ensurePlayheadStepButtons();
    fixEchoSettingsLine();
    placeToolbarOrder();
    ensureSendToStartMenuItem();
    installTimelineScrub();
    disableClipHtmlDrag();
  }

  function patchRender() {
    if (window.__orgavoxV054RenderPatch) return;
    window.__orgavoxV054RenderPatch = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxV054RenderTimeline() {
      const result = previousRenderTimeline.apply(this, arguments);
      refresh();
      return result;
    };
  }

  function wrapExistingPlacers() {
    if (!window.__orgavoxV054WrappedPlacers) {
      window.__orgavoxV054WrappedPlacers = true;
      ["orgavoxPlaceSnapTools", "orgavoxRestoreViewMenu", "orgavoxApplyMenuCleanup", "orgavoxPlaceMarkersButton"].forEach((name) => {
        const original = window[name];
        if (typeof original !== "function") return;
        window[name] = function orgavoxV054WrappedPlacer() {
          const result = original.apply(this, arguments);
          setTimeout(refresh, 0);
          return result;
        };
      });
    }
  }

  function install() {
    if (installed) return;
    installed = true;
    installStyles();
    installKeyboardPlayheadNudge();
    installTimelineScrub();
    installDragCopyGuard();
    patchRender();
    wrapExistingPlacers();
    refresh();
    setTimeout(refresh, 0);
    setTimeout(refresh, 180);
    setTimeout(refresh, 500);
    setTimeout(refresh, 1200);
  }

  boot();
})();
