"use strict";

(function bootOrgavoxV055ToolbarInput() {
  const VERSION = "v0.55";
  const STYLE_ID = "orgavox-v055-toolbar-input-style";
  let tries = 0;
  let installed = false;
  let scrubPointer = null;
  let suppressClickUntil = 0;
  let recentClipPointerAt = 0;
  let lastAdd = null;

  function ready() {
    return typeof ui !== "undefined"
      && typeof state !== "undefined"
      && typeof setPlayhead === "function"
      && typeof renderTimeline === "function"
      && typeof addClipFromAsset === "function";
  }

  function boot() {
    if (!ready()) {
      tries += 1;
      if (tries < 160) setTimeout(boot, 50);
      return;
    }
    install();
  }

  function css() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .orgavox-edit-group{align-items:center!important}
      body.simple-edit-phase1 .orgavox-main-controls-group{display:inline-flex!important;align-items:center!important;flex-wrap:nowrap!important;gap:8px!important;min-width:0!important}
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v055{display:grid!important;grid-template-columns:auto minmax(60px,96px) 42px 34px!important;grid-template-rows:36px!important;align-items:center!important;gap:7px!important;min-width:206px!important;margin:0!important}
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v055 span,
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v055 input,
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v055 output{grid-row:1!important}
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v055 #echoSettingsBtn{grid-column:4!important;grid-row:1!important;align-self:center!important;justify-self:center!important;margin:0!important;width:32px!important;min-width:32px!important;height:32px!important;min-height:32px!important;padding:0!important}
      body.simple-edit-phase1 .orgavox-playhead-step-button{min-width:34px!important;width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;border-color:rgba(117,178,222,.68)!important;background:linear-gradient(180deg,rgba(25,67,106,.88),rgba(8,27,51,.96))!important;color:#dff5ff!important;font:900 .72rem var(--font-mono)!important}
      body.simple-edit-phase1 #orgavoxSendToStartBtn{border-color:rgba(224,163,96,.72)!important;color:#ffe4a8!important}
      body.simple-edit-phase1 .timeline-scroll.orgavox-scrubbing,body.simple-edit-phase1 .timeline-scroll.orgavox-scrubbing *{cursor:crosshair!important}
      body.simple-edit-phase1 .audio-clip{-webkit-user-drag:none!important}
    `;
    document.head.appendChild(style);
  }

  function tip(button, text) {
    if (!button || !text) return;
    button.title = text;
    button.setAttribute("aria-label", text);
  }

  function setVersion() {
    window.ORGAVOX_VERSION = VERSION;
    document.title = `Organon — ORGAVOX ${VERSION}`;
    document.querySelectorAll(".simple-edit-version,.phase1-version,.orgavox-sidebar-version").forEach((node) => { node.textContent = VERSION; });
  }

  function clampTrack(value) {
    return Math.max(0, Math.min(9, Number(value) || 0));
  }

  function clipSelectionIds() {
    if (Array.isArray(state.selectedClipIds) && state.selectedClipIds.length) {
      return state.selectedClipIds.filter((id) => state.clips.some((clip) => clip.id === id));
    }
    return state.selectedClipId ? [state.selectedClipId] : [];
  }

  function nudgePlayhead(direction, amount) {
    setPlayhead(Math.max(0, (Number(state.playhead) || 0) + (direction < 0 ? -amount : amount)), true);
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
      tip(button, "Move playhead back 0.1 seconds");
      button.addEventListener("click", () => nudgePlayhead(-1, 0.1));
      ui.playheadBackStepBtn = button;
    }
    if (!ui.playheadForwardStepBtn) {
      const button = document.createElement("button");
      button.id = "playheadForwardStepBtn";
      button.type = "button";
      button.className = "icon-button orgavox-playhead-step-button";
      button.textContent = "→";
      tip(button, "Move playhead forward 0.1 seconds");
      button.addEventListener("click", () => nudgePlayhead(1, 0.1));
      ui.playheadForwardStepBtn = button;
    }
    if (ui.playheadBackStepBtn.previousElementSibling !== ui.timeReadout) group.insertBefore(ui.playheadBackStepBtn, ui.timeReadout.nextSibling);
    if (ui.playheadForwardStepBtn.previousElementSibling !== ui.playheadBackStepBtn) group.insertBefore(ui.playheadForwardStepBtn, ui.playheadBackStepBtn.nextSibling);
  }

  function echoInline() {
    const control = ui.echoSlider?.closest(".range-control");
    const button = document.getElementById("echoSettingsBtn") || ui.echoSettingsBtn;
    if (!control || !button || !ui.echoOut) return;
    control.classList.remove("orgavox-echo-inline-v054");
    control.classList.add("orgavox-echo-inline-v055");
    if (button.parentElement !== control || button.previousElementSibling !== ui.echoOut) ui.echoOut.insertAdjacentElement("afterend", button);
    ui.echoSettingsBtn = button;
  }

  function insertAfter(anchor, node) {
    if (!anchor?.parentElement || !node) return node;
    if (anchor.nextSibling !== node) anchor.parentElement.insertBefore(node, anchor.nextSibling);
    return node;
  }

  function orderToolbar() {
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

    let anchor = redo?.parentElement === group ? redo : null;
    [edit, view, effects, marker, nudgeLeft, nudgeRight, snap, snapGrid].filter(Boolean).forEach((node) => {
      if (anchor) insertAfter(anchor, node);
      else group.insertBefore(node, group.firstChild);
      anchor = node;
    });
  }

  function sendToStart() {
    const ids = clipSelectionIds();
    const clips = state.clips.filter((clip) => ids.includes(clip.id));
    if (!clips.length) return showToast("Select a clip to send to start.");
    stopPlayback();
    if (clips.length === 1) clips[0].start = 0;
    else {
      const earliest = Math.min(...clips.map((clip) => Math.max(0, Number(clip.start) || 0)));
      clips.forEach((clip) => { clip.start = Math.max(0, (Number(clip.start) || 0) - earliest); });
    }
    renderTimeline();
    syncSelectedControls();
    showToast(clips.length === 1 ? "Clip sent to start." : `${clips.length} clips sent to start.`);
    window.orgavoxRecordHistory?.();
  }

  function addSendToStart() {
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
        sendToStart();
      });
    }
    button.textContent = "↤ Send to Start";
    tip(button, "Move the selected clip to 0:00");
    const markerPanel = document.getElementById("orgavoxMarkerPanelBtn");
    if (markerPanel?.parentElement === panel) insertAfter(markerPanel, button);
    else if (button.parentElement !== panel) panel.prepend(button);
  }

  function keyboard() {
    if (window.__orgavoxV055KeyboardPlayhead) return;
    window.__orgavoxV055KeyboardPlayhead = true;
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable);
      if (typing || event.defaultPrevented || event.altKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const amount = event.shiftKey ? 10 : (event.ctrlKey || event.metaKey ? 1 : 0.1);
      nudgePlayhead(event.key === "ArrowLeft" ? -1 : 1, amount);
    }, true);
  }

  function timeFromEvent(event) {
    const rect = ui.timelineScroll.getBoundingClientRect();
    return Math.max(0, ((event.clientX - rect.left) + ui.timelineScroll.scrollLeft) / Math.max(1, Number(state.pixelsPerSecond) || 80));
  }

  function scrubHit(event) {
    const target = event.target;
    if (!target || !ui.timelineScroll?.contains(target)) return null;
    if (target.closest?.(".audio-clip,.clip-handle,button,input,select,textarea,label,.track-label-column,.asset-list,.library-panel,.popover,.modal-backdrop")) return null;
    const lane = target.closest?.(".track-lane");
    if (target === ui.rulerCanvas || lane || target.closest?.("#tracks,.tracks,.timeline-content")) return { lane };
    return null;
  }

  function scrub() {
    if (!ui.timelineScroll || ui.timelineScroll.dataset.orgavoxV055Scrub === "true") return;
    ui.timelineScroll.dataset.orgavoxV055Scrub = "true";
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
    ui.timelineScroll.addEventListener("pointermove", (event) => {
      if (scrubPointer == null || event.pointerId !== scrubPointer) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setPlayhead(timeFromEvent(event), false);
    }, true);
    function done(event) {
      if (scrubPointer == null || event.pointerId !== scrubPointer) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      ui.timelineScroll.releasePointerCapture?.(event.pointerId);
      ui.timelineScroll.classList.remove("orgavox-scrubbing");
      scrubPointer = null;
      suppressClickUntil = Date.now() + 220;
    }
    ui.timelineScroll.addEventListener("pointerup", done, true);
    ui.timelineScroll.addEventListener("pointercancel", done, true);
    ui.timelineScroll.addEventListener("click", (event) => {
      if (Date.now() > suppressClickUntil || !scrubHit(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function dragCopyGuard() {
    if (window.__orgavoxV055DragCopyGuard) return;
    window.__orgavoxV055DragCopyGuard = true;
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest?.(".audio-clip")) return;
      recentClipPointerAt = Date.now();
      state.dragAssetId = null;
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

    const oldAdd = addClipFromAsset;
    addClipFromAsset = function orgavoxV055AddClipFromAsset(assetId, track, start) {
      const now = Date.now();
      const t = clampTrack(track);
      const s = Math.max(0, Number(start) || 0);
      const repeat = lastAdd && now - lastAdd.time < 900 && String(assetId || "") === lastAdd.assetId && t === lastAdd.track && Math.abs(s - lastAdd.start) < 0.3;
      const suspicious = now - recentClipPointerAt < 700 && !state.dragAssetId;
      if (repeat || suspicious) {
        showToast("Duplicate clip add ignored.");
        return null;
      }
      const before = state.clips.length;
      const result = oldAdd.apply(this, arguments);
      if (state.clips.length > before) lastAdd = { time: now, assetId: String(assetId || ""), track: t, start: s };
      return result;
    };
  }

  function disableClipDrag() {
    document.querySelectorAll(".audio-clip").forEach((clip) => {
      clip.draggable = false;
      clip.setAttribute("draggable", "false");
    });
  }

  function refresh() {
    setVersion();
    css();
    ensureStepButtons();
    echoInline();
    orderToolbar();
    addSendToStart();
    scrub();
    disableClipDrag();
  }

  function patchRender() {
    if (window.__orgavoxV055RenderPatch) return;
    window.__orgavoxV055RenderPatch = true;
    const oldRender = renderTimeline;
    renderTimeline = function orgavoxV055RenderTimeline() {
      const result = oldRender.apply(this, arguments);
      refresh();
      return result;
    };
  }

  function install() {
    if (installed) return;
    installed = true;
    css();
    keyboard();
    scrub();
    dragCopyGuard();
    patchRender();
    refresh();
    setTimeout(refresh, 0);
    setTimeout(refresh, 180);
    setTimeout(refresh, 500);
    setTimeout(refresh, 1200);
  }

  boot();
})();
