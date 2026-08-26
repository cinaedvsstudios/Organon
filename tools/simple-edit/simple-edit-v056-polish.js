"use strict";

(function bootOrgavoxV056Polish() {
  const VERSION = "v0.56";
  const STYLE_ID = "orgavox-v056-polish-style";
  const COLORS = ["cyan", "gold", "green", "purple", "red", "white", "blue"];
  const SNAP_VALUES = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
  let tries = 0;
  let installed = false;
  let scrubPointerId = null;
  let draggingDialog = null;
  let targetObserver = null;

  function ready() {
    return typeof ui !== "undefined"
      && typeof state !== "undefined"
      && typeof renderTimeline === "function"
      && typeof syncSelectedControls === "function"
      && typeof selectClip === "function"
      && typeof selectedClip === "function"
      && typeof setPlayhead === "function";
  }

  function boot() {
    if (!ready()) {
      tries += 1;
      if (tries < 200) setTimeout(boot, 50);
      return;
    }
    install();
  }

  function install() {
    if (installed) return;
    installed = true;
    window.ORGAVOX_VERSION = VERSION;
    installStyles();
    ensureState();
    patchTimelineRender();
    patchSelection();
    patchClipClipboard();
    installKeyboardNudge();
    installTimeEdit();
    installTimelineScrub();
    installPopupPolish();
    installCustomDownload();
    refreshAll();
    [0, 160, 450, 900, 1500].forEach((delay) => setTimeout(refreshAll, delay));
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes orgavoxPlayBigPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 1px rgba(117,178,222,.34),0 0 14px rgba(75,155,255,.3)}50%{transform:scale(1.13);box-shadow:0 0 0 2px rgba(168,220,255,.78),0 0 28px rgba(75,155,255,.74),0 0 46px rgba(117,178,222,.34)}}
      body.simple-edit-phase1 #playBtn.orgavox-playing{animation:orgavoxPlayBigPulse .78s ease-in-out infinite!important;transform-origin:center!important;z-index:4!important}
      body.simple-edit-phase1 .audio-clip:not(.selected):not(.orgavox-multi-selected){outline:0!important;background:linear-gradient(180deg,rgba(75,132,191,.46),rgba(38,97,92,.4))!important;color:#fff!important;box-shadow:0 4px 12px rgba(0,0,0,.35)!important}
      body.simple-edit-phase1 .audio-clip:not(.selected):not(.orgavox-multi-selected) .clip-title,
      body.simple-edit-phase1 .audio-clip:not(.selected):not(.orgavox-multi-selected) .orgavox-clip-meta-line{color:#dff5ff!important}
      body.simple-edit-phase1 .track-lane.selected-track{box-shadow:inset 0 0 0 3px rgba(117,216,255,.9),inset 6px 0 rgba(117,216,255,1),0 0 26px rgba(117,216,255,.2)!important;background-color:rgba(75,155,255,.16)!important}
      .orgavox-track-info-btn{min-width:24px!important;width:24px!important;height:22px!important;min-height:22px!important;padding:0!important;border:1px solid rgba(74,190,117,.9)!important;border-radius:7px!important;background:linear-gradient(180deg,rgba(34,126,66,.95),rgba(12,58,31,.98))!important;color:#e4ffed!important;font:900 .58rem var(--font-mono)!important;box-shadow:0 0 10px rgba(74,190,117,.24)!important}
      .orgavox-marker-step-button{min-width:34px!important;width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;border-color:rgba(178,109,255,.9)!important;background:linear-gradient(180deg,rgba(106,60,190,.94),rgba(53,27,108,.96))!important;color:#f3e2ff!important;box-shadow:0 0 0 1px rgba(178,109,255,.24),0 0 14px rgba(130,78,220,.22)!important}
      body.simple-edit-phase1 .orgavox-snap-grid-select,#snapGridSelect{background:#050606!important;color:#dff5ff!important;border-color:rgba(117,178,222,.72)!important}
      body.simple-edit-phase1 .orgavox-control-divider{width:1px!important;align-self:center!important;min-height:34px!important;margin:0 4px!important;background:linear-gradient(180deg,transparent,rgba(224,163,96,.8),transparent)!important;display:inline-flex!important;flex:0 0 1px!important}
      body.simple-edit-phase1 .orgavox-main-controls-group{align-items:center!important;gap:8px!important}
      body.simple-edit-phase1 .time-readout{cursor:text!important;user-select:text!important}
      body.simple-edit-phase1 .time-readout[contenteditable="true"]{outline:2px solid rgba(117,178,222,.64)!important;box-shadow:0 0 18px rgba(117,178,222,.28)!important;background:rgba(0,0,0,.64)!important}
      body.simple-edit-phase1 .orgavox-popup-panel{resize:both!important;overflow:auto!important;min-width:360px!important;min-height:220px!important;max-width:calc(100vw - 32px)!important;max-height:calc(100vh - 32px)!important}
      body.simple-edit-phase1 .orgavox-popup-panel .popover-head{cursor:move!important;user-select:none!important}
      body.simple-edit-phase1 .orgavox-popup-panel .tool-button:not(.primary),
      body.simple-edit-phase1 .orgavox-popup-panel .icon-button,
      body.simple-edit-phase1 .orgavox-download-dialog .tool-button:not(.primary){border-color:rgba(220,72,64,.78)!important;background:linear-gradient(180deg,rgba(111,31,28,.92),rgba(43,13,12,.96))!important;color:#ffd8d2!important}
      body.simple-edit-phase1 .orgavox-popup-panel .tool-button.primary,
      body.simple-edit-phase1 .orgavox-popup-panel [data-gate-apply],
      body.simple-edit-phase1 .orgavox-popup-panel [data-stretch-apply],
      body.simple-edit-phase1 .orgavox-popup-panel [data-transpose-apply],
      body.simple-edit-phase1 .orgavox-popup-panel [data-project-save],
      body.simple-edit-phase1 .orgavox-download-dialog .tool-button.primary{border-color:rgba(117,178,222,.92)!important;background:linear-gradient(180deg,rgba(57,132,205,.96),rgba(31,77,133,.94))!important;color:#eef8ff!important;box-shadow:0 0 0 1px rgba(117,178,222,.24),0 0 14px rgba(75,155,255,.24)!important}
      .orgavox-effect-target-wrap{display:grid;grid-template-columns:auto minmax(180px,1fr);gap:8px;align-items:center;margin:10px 0 12px;padding:10px;border:1px solid rgba(117,178,222,.34);border-radius:12px;background:rgba(117,178,222,.08)}
      .orgavox-effect-target-wrap span{color:rgba(245,240,219,.68);font:900 .58rem var(--font-mono);letter-spacing:.06em;text-transform:uppercase}.orgavox-effect-target-wrap select{min-height:34px;border:1px solid rgba(117,178,222,.56);border-radius:10px;background:#050606;color:#f5f0db;padding:6px 9px;font:800 .72rem var(--font-body)}
      .orgavox-history-modal,.orgavox-download-modal{position:fixed;inset:0;z-index:5200;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}.orgavox-history-modal[hidden],.orgavox-download-modal[hidden]{display:none}
      .orgavox-history-dialog,.orgavox-download-dialog{width:min(720px,calc(100vw - 42px));max-height:min(720px,calc(100vh - 42px));overflow:auto;padding:20px;border:1px solid rgba(224,163,96,.72);border-radius:22px;background:#1a1c18;box-shadow:0 24px 80px rgba(0,0,0,.78);resize:both}
      .orgavox-history-list{display:grid;gap:8px;margin-top:14px}.orgavox-history-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid rgba(137,107,73,.58);border-radius:13px;background:rgba(0,0,0,.2);color:#f5f0db;text-align:left}.orgavox-history-item small{color:rgba(245,240,219,.55);font:800 .58rem var(--font-mono)}
      .orgavox-download-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.orgavox-download-field{display:grid;gap:6px}.orgavox-download-field span{color:rgba(245,240,219,.66);font:900 .58rem var(--font-mono);text-transform:uppercase;letter-spacing:.06em}.orgavox-download-field input,.orgavox-download-field select{min-height:36px;border:1px solid rgba(137,107,73,.58);border-radius:10px;background:#050606;color:#f5f0db;padding:6px 9px}.orgavox-download-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:16px}
      @media(max-width:760px){.orgavox-download-grid{grid-template-columns:1fr}.orgavox-effect-target-wrap{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureState() {
    if (!Array.isArray(state.selectedClipIds)) state.selectedClipIds = state.selectedClipId ? [state.selectedClipId] : [];
    if (!Array.isArray(state.__orgavoxV056History)) state.__orgavoxV056History = [];
  }

  function safeCss(value) {
    return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function timeLabel(value) {
    return Number(value).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function currentSnapValue() {
    const raw = Number(ui.snapGridSelect?.value || localStorage.getItem("orgavoxSnapGrid") || 0.1);
    return SNAP_VALUES.includes(raw) ? raw : Math.max(0.01, raw || 0.1);
  }

  function selectedIds() {
    const ids = Array.isArray(state.selectedClipIds) ? state.selectedClipIds : [];
    const valid = ids.filter((id) => state.clips.some((clip) => clip.id === id));
    if (!valid.length && state.selectedClipId) valid.push(state.selectedClipId);
    state.selectedClipIds = [...new Set(valid)];
    return state.selectedClipIds;
  }

  function setSelectedIds(ids) {
    state.selectedClipIds = [...new Set((ids || []).filter((id) => state.clips.some((clip) => clip.id === id)))];
    state.selectedClipId = state.selectedClipIds[state.selectedClipIds.length - 1] || null;
  }

  function clearClipSelection(render = true) {
    state.selectedClipId = null;
    state.selectedClipIds = [];
    if (typeof syncSelectedControls === "function") syncSelectedControls();
    document.querySelectorAll(".audio-clip.selected,.audio-clip.orgavox-multi-selected").forEach((node) => {
      node.classList.remove("selected", "orgavox-multi-selected", "orgavox-drag-armed");
    });
    if (render) renderTimeline();
  }

  function applySelectionClasses() {
    const ids = new Set(selectedIds());
    document.querySelectorAll(".audio-clip").forEach((node) => {
      const selected = ids.has(node.dataset.clipId) || node.dataset.clipId === state.selectedClipId;
      node.classList.toggle("selected", selected);
      node.classList.toggle("orgavox-multi-selected", selected && ids.size > 1);
      if (!selected) node.classList.remove("orgavox-drag-armed");
    });
    if (ui.selectedClipName && ids.size > 1) ui.selectedClipName.textContent = `${ids.size} clips selected`;
  }

  function patchSelection() {
    if (window.__orgavoxV056SelectionPatched) return;
    window.__orgavoxV056SelectionPatched = true;
    const previousSelectClip = selectClip;
    selectClip = function orgavoxV056SelectClip(id, rerender = true) {
      const result = previousSelectClip.apply(this, arguments);
      if (id && (!Array.isArray(state.selectedClipIds) || !state.selectedClipIds.includes(id))) state.selectedClipIds = [id];
      if (!id) state.selectedClipIds = [];
      applySelectionClasses();
      return result;
    };
    document.addEventListener("pointerdown", (event) => {
      if (event.target.closest?.(".audio-clip")) return;
      if (event.target.closest?.("button,input,select,textarea,.popover,.modal-backdrop,.orgavox-history-modal,.orgavox-download-modal,.orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu")) return;
      if (event.target.closest?.(".track-lane,.timeline-scroll,.ruler")) setTimeout(() => clearClipSelection(false), 0);
    }, true);
  }

  function cloneClip(clip) {
    return { ...clip, volumeKeyframes: Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes.map((item) => ({ ...item })) : [] };
  }

  function historySnapshot(label) {
    return {
      id: makeId("hist"),
      label,
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      clips: state.clips.map(cloneClip),
      markers: Array.isArray(state.markers) ? state.markers.map((item) => ({ ...item })) : [],
      trackSettings: Array.isArray(state.trackSettings) ? state.trackSettings.map((item) => ({ ...item })) : [],
      playhead: state.playhead,
      selectedTrack: state.selectedTrack
    };
  }

  function recordHistory(label = "Timeline change") {
    const snap = historySnapshot(label);
    const previous = state.__orgavoxV056History?.[0];
    const sig = JSON.stringify(snap.clips.map((clip) => [clip.id, clip.track, clip.start, clip.sourceStart, clip.sourceEnd, clip.volume, clip.echo]));
    if (previous?.sig === sig) return;
    snap.sig = sig;
    state.__orgavoxV056History = [snap, ...(state.__orgavoxV056History || [])].slice(0, 20);
  }

  function restoreHistory(snap) {
    stopPlayback?.();
    state.clips = snap.clips.map(cloneClip);
    state.markers = Array.isArray(snap.markers) ? snap.markers.map((item) => ({ ...item })) : [];
    state.trackSettings = Array.isArray(snap.trackSettings) ? snap.trackSettings.map((item) => ({ ...item })) : state.trackSettings;
    state.playhead = Math.max(0, Number(snap.playhead) || 0);
    state.selectedTrack = Math.max(0, Math.min(9, Number(snap.selectedTrack) || 0));
    state.selectedClipId = null;
    state.selectedClipIds = [];
    state.renderCache?.clear?.();
    renderAssets?.();
    syncSelectedControls?.();
    renderTimeline();
    setPlayhead(state.playhead, true);
    window.orgavoxRefreshTrackTools?.();
    showToast(`Restored: ${snap.label}`);
  }

  function patchTimelineRender() {
    if (window.__orgavoxV056RenderPatched) return;
    window.__orgavoxV056RenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxV056RenderTimeline() {
      const result = previousRenderTimeline.apply(this, arguments);
      applySelectionClasses();
      refreshAll(false);
      return result;
    };
    const previousSyncSelectedControls = syncSelectedControls;
    syncSelectedControls = function orgavoxV056SyncSelectedControls() {
      const result = previousSyncSelectedControls.apply(this, arguments);
      applySelectionClasses();
      return result;
    };
    recordHistory("Initial state");
  }

  function patchClipClipboard() {
    if (window.__orgavoxV056ClipboardPatched) return;
    window.__orgavoxV056ClipboardPatched = true;
    document.addEventListener("click", (event) => {
      const btn = event.target.closest?.("#orgavoxPasteClipBtn");
      if (!btn || !state.__orgavoxCutClipboard) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pasteCutClipboard();
    }, true);
  }

  function copySelectedToClipboard(remove) {
    const ids = selectedIds();
    const clips = ids.length ? state.clips.filter((clip) => ids.includes(clip.id)) : selectedClip() ? [selectedClip()] : [];
    if (!clips.length) return showToast("Select a clip first.");
    state.__orgavoxCutClipboard = clips.map(cloneClip);
    if (remove) {
      recordHistory("Before cut");
      state.clips = state.clips.filter((clip) => !clips.some((cut) => cut.id === clip.id));
      clearClipSelection(false);
      renderTimeline();
      recordHistory("Cut clip out");
      showToast(`${clips.length} clip${clips.length === 1 ? "" : "s"} cut.`);
    } else {
      showToast(`${clips.length} clip${clips.length === 1 ? "" : "s"} copied.`);
    }
  }

  function pasteCutClipboard() {
    const clips = state.__orgavoxCutClipboard;
    if (!Array.isArray(clips) || !clips.length) return;
    recordHistory("Before paste");
    const minStart = Math.min(...clips.map((clip) => Number(clip.start) || 0));
    const nextIds = [];
    clips.forEach((clip) => {
      const next = cloneClip(clip);
      next.id = makeId("clip");
      next.start = Math.max(0, Number(state.playhead) + ((Number(clip.start) || 0) - minStart));
      next.track = Math.max(0, Math.min(9, Number(state.selectedTrack) || Number(clip.track) || 0));
      next.cacheVersion = 0;
      if (Array.isArray(next.volumeKeyframes)) next.volumeKeyframes = next.volumeKeyframes.map((kf) => ({ ...kf, id: makeId("kf") }));
      state.clips.push(next);
      nextIds.push(next.id);
    });
    setSelectedIds(nextIds);
    syncSelectedControls();
    renderTimeline();
    recordHistory("Paste cut/copied clip");
    showToast(`${nextIds.length} clip${nextIds.length === 1 ? "" : "s"} pasted.`);
  }

  function parseTime(value) {
    const text = String(value || "").trim();
    if (!text) return 0;
    if (text.includes(":")) {
      const parts = text.split(":").map((part) => Number(part.replace(/[^\d.]/g, "")) || 0);
      if (parts.length >= 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      return parts[0] * 60 + parts[1];
    }
    return Number(text.replace(/[^\d.]/g, "")) || 0;
  }

  function installTimeEdit() {
    if (!ui.timeReadout || ui.timeReadout.dataset.orgavoxV056TimeEdit === "true") return;
    ui.timeReadout.dataset.orgavoxV056TimeEdit = "true";
    ui.timeReadout.tabIndex = 0;
    ui.timeReadout.title = "Click and type a time, then press Enter.";
    ui.timeReadout.addEventListener("click", () => {
      ui.timeReadout.contentEditable = "true";
      ui.timeReadout.focus();
      const range = document.createRange();
      range.selectNodeContents(ui.timeReadout);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    ui.timeReadout.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); ui.timeReadout.blur(); }
      if (event.key === "Escape") { event.preventDefault(); ui.timeReadout.contentEditable = "false"; setPlayhead(state.playhead, true); }
    });
    ui.timeReadout.addEventListener("blur", () => {
      if (ui.timeReadout.isContentEditable) {
        const next = Math.max(0, Math.min(projectDuration(), parseTime(ui.timeReadout.textContent)));
        ui.timeReadout.contentEditable = "false";
        setPlayhead(next, true);
      }
    });
  }

  function installKeyboardNudge() {
    if (window.__orgavoxV056ArrowKeys) return;
    window.__orgavoxV056ArrowKeys = true;
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable)) return;
      if (event.altKey || event.metaKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      const step = event.shiftKey ? 1 : event.ctrlKey ? 0.1 : 0.01;
      setPlayhead(Math.max(0, Math.min(projectDuration(), state.playhead + direction * step)), true);
    }, true);
  }

  function timeFromPointer(event) {
    const rect = ui.timelineScroll.getBoundingClientRect();
    const localX = Math.max(0, event.clientX - rect.left);
    return Math.max(0, (ui.timelineScroll.scrollLeft + localX) / Math.max(1, state.pixelsPerSecond));
  }

  function installTimelineScrub() {
    if (!ui.timelineScroll || ui.timelineScroll.dataset.orgavoxV056Scrub === "true") return;
    ui.timelineScroll.dataset.orgavoxV056Scrub = "true";
    ui.timelineScroll.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) return;
      if (event.target.closest?.(".audio-clip,.clip-handle,button,input,select")) return;
      scrubPointerId = event.pointerId;
      ui.timelineScroll.setPointerCapture?.(event.pointerId);
      setPlayhead(timeFromPointer(event), true);
      clearClipSelection(false);
    });
    ui.timelineScroll.addEventListener("pointermove", (event) => {
      if (scrubPointerId !== event.pointerId) return;
      event.preventDefault();
      setPlayhead(timeFromPointer(event), true);
    });
    ["pointerup", "pointercancel"].forEach((type) => ui.timelineScroll.addEventListener(type, (event) => {
      if (scrubPointerId !== event.pointerId) return;
      ui.timelineScroll.releasePointerCapture?.(event.pointerId);
      scrubPointerId = null;
    }));
  }

  function stepPlayhead(delta) {
    setPlayhead(Math.max(0, Math.min(projectDuration(), state.playhead + delta)), true);
  }

  function jumpMarker(direction) {
    const markers = (Array.isArray(state.markers) ? state.markers : []).map((m) => Math.max(0, Number(m.time) || 0)).sort((a, b) => a - b);
    if (!markers.length) return showToast("No markers yet.");
    const epsilon = 0.0001;
    const next = direction < 0
      ? [...markers].reverse().find((time) => time < state.playhead - epsilon) ?? markers[0]
      : markers.find((time) => time > state.playhead + epsilon) ?? markers[markers.length - 1];
    setPlayhead(next, true);
  }

  function ensureButton(id, text, cls, title, handler) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.addEventListener("click", handler);
    }
    button.textContent = text;
    button.className = cls;
    button.title = title;
    return button;
  }

  function refreshSnapOptions() {
    const select = ui.snapGridSelect || document.getElementById("snapGridSelect");
    if (!select) return;
    const current = currentSnapValue();
    select.innerHTML = "";
    SNAP_VALUES.forEach((value) => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = timeLabel(value);
      select.appendChild(option);
    });
    select.value = String(SNAP_VALUES.includes(current) ? current : 0.1);
    select.classList.add("orgavox-snap-grid-select");
    if (select.dataset.orgavoxV056Snap !== "true") {
      select.dataset.orgavoxV056Snap = "true";
      select.addEventListener("change", () => {
        localStorage.setItem("orgavoxSnapGrid", select.value);
        localStorage.setItem("orgavoxSnapEnabled", "true");
        showToast(`Snap and nudge distance set to ${select.value}s.`);
      }, true);
    }
  }

  function nudgeSelectedBy(direction) {
    const ids = selectedIds();
    const clips = ids.length ? state.clips.filter((clip) => ids.includes(clip.id)) : selectedClip() ? [selectedClip()] : [];
    if (!clips.length) return showToast("Select a clip to nudge.");
    recordHistory("Before nudge");
    const amount = currentSnapValue() * direction;
    clips.forEach((clip) => { clip.start = Math.max(0, Number(clip.start) + amount); });
    renderTimeline();
    recordHistory("Nudge clip");
    showToast(`Nudged ${Math.abs(amount)}s.`);
  }

  function patchNudgeButtons() {
    [ui.nudgeLeftBtn, ui.nudgeRightBtn].filter(Boolean).forEach((button) => {
      if (button.dataset.orgavoxV056Nudge === "true") return;
      button.dataset.orgavoxV056Nudge = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        nudgeSelectedBy(button === ui.nudgeLeftBtn ? -1 : 1);
      }, true);
    });
  }

  function randomizeTrackColors() {
    if (!Array.isArray(state.trackSettings)) state.trackSettings = [];
    for (let i = 0; i < 10; i += 1) {
      state.trackSettings[i] = { ...(state.trackSettings[i] || {}), color: COLORS[i % COLORS.length] };
    }
    window.orgavoxRefreshTrackTools?.();
    renderTimeline();
    recordHistory("Randomized track colors");
    showToast("Track colours randomized.");
  }

  function analyzeTrack(index) {
    const track = Math.max(0, Math.min(9, Number(index) || 0));
    const clip = state.clips.filter((item) => item.track === track).sort((a, b) => a.start - b.start)[0];
    if (!clip) return showToast(`Track ${track + 1} has no clips to analyze.`);
    selectTrack?.(track);
    selectClip(clip.id);
    const modal = document.getElementById("analysisModal");
    if (modal) {
      modal.hidden = false;
      const summary = modal.querySelector("[data-analysis-summary]");
      if (summary) summary.textContent = `Track ${track + 1} · ${clip.name}`;
      setTimeout(() => modal.querySelector("[data-analysis-scan]")?.click(), 0);
    } else if (ui.analysisBtn) ui.analysisBtn.click();
    showToast(`Analyzing Track ${track + 1}.`);
  }

  function addTrackInfoButtons() {
    document.querySelectorAll(".track-label").forEach((label) => {
      const index = Number(label.dataset.trackLabel);
      if (!Number.isFinite(index)) return;
      const mini = label.querySelector(".orgavox-track-mini") || label;
      let button = mini.querySelector(".orgavox-track-info-btn");
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "orgavox-track-info-btn";
        button.textContent = "i";
        button.title = "Analyze this track";
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          analyzeTrack(index);
        });
      }
      const solo = mini.querySelector(".solo");
      if (solo && button.previousElementSibling !== solo) solo.insertAdjacentElement("afterend", button);
      else if (!solo && button.parentElement !== mini) mini.appendChild(button);
    });
  }

  function sendSelectedToStart() {
    const ids = selectedIds();
    const clips = ids.length ? state.clips.filter((clip) => ids.includes(clip.id)) : selectedClip() ? [selectedClip()] : [];
    if (!clips.length) return showToast("Select a clip first.");
    recordHistory("Before send to start");
    const minStart = Math.min(...clips.map((clip) => Number(clip.start) || 0));
    clips.forEach((clip) => { clip.start = Math.max(0, (Number(clip.start) || 0) - minStart); });
    setPlayhead(0, true);
    renderTimeline();
    recordHistory("Send clip to start");
    showToast(`${clips.length} clip${clips.length === 1 ? "" : "s"} sent to start.`);
  }

  function ensureViewMenuButton(panel, id, text, title, handler) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "tool-button";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        panel.hidden = true;
        handler();
      });
    }
    button.textContent = text;
    button.title = title;
    if (button.parentElement !== panel) panel.appendChild(button);
    return button;
  }

  function enhanceMenus() {
    const editGroup = document.querySelector(".orgavox-edit-group");
    if (!editGroup) return;
    const edit = document.getElementById("orgavoxEditDropdown");
    const view = document.getElementById("orgavoxViewDropdown");
    const effects = editGroup.querySelector(".orgavox-effects-dropdown");
    if (edit && view && effects) {
      editGroup.insertBefore(view, effects);
      editGroup.insertBefore(edit, view);
    }
    const viewPanel = view?.querySelector(".orgavox-view-menu");
    if (viewPanel) {
      ensureViewMenuButton(viewPanel, "orgavoxSendStartBtn", "⏮ Send to Start", "Move selected clip to zero time", sendSelectedToStart);
      ensureViewMenuButton(viewPanel, "orgavoxRandomColorsBtn", "🎨 Randomize Track Colors", "Give each track a different colour", randomizeTrackColors);
      ensureViewMenuButton(viewPanel, "orgavoxBounceTrackBtn", "🧱 Bounce Track", "Render the selected track to a file", () => openDownloadModal("track"));
      if (ui.bounceBtn) ui.bounceBtn.remove();
    }
    const editPanel = edit?.querySelector(".orgavox-edit-menu");
    if (editPanel) {
      if (ui.scissorsBtn) ui.scissorsBtn.textContent = "✂️ Snip";
      const copy = document.getElementById("orgavoxCopyClipBtn");
      const paste = document.getElementById("orgavoxPasteClipBtn");
      let cut = document.getElementById("orgavoxActualCutBtn");
      if (!cut) {
        cut = document.createElement("button");
        cut.id = "orgavoxActualCutBtn";
        cut.type = "button";
        cut.className = "tool-button";
        cut.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          editPanel.hidden = true;
          copySelectedToClipboard(true);
        });
      }
      cut.textContent = "✂️ Cut";
      cut.title = "Remove selected clip and store it for Paste";
      if (copy) copy.insertAdjacentElement("afterend", cut);
      else if (cut.parentElement !== editPanel) editPanel.appendChild(cut);
      if (paste && paste.previousElementSibling !== cut) cut.insertAdjacentElement("afterend", paste);
      ensureViewMenuButton(editPanel, "orgavoxUndoHistoryBtn", "↶ Undo History", "Restore one of the last 20 timeline states", openHistoryModal);
    }
  }

  function layoutToolbar() {
    const editGroup = document.querySelector(".orgavox-edit-group");
    if (!editGroup) return;
    const effects = editGroup.querySelector(".orgavox-effects-dropdown");
    const marker = ui.markersBtn || document.getElementById("markersBtn");
    const prevMarker = ensureButton("orgavoxPrevMarkerBtn", "◀", "tool-button orgavox-marker-step-button", "Previous marker", () => jumpMarker(-1));
    const nextMarker = ensureButton("orgavoxNextMarkerBtn", "▶", "tool-button orgavox-marker-step-button", "Next marker", () => jumpMarker(1));
    if (marker) marker.textContent = "🏷 Add Marker";
    const ordered = [
      ui.undoBtn, ui.redoBtn, document.getElementById("orgavoxEditDropdown"), document.getElementById("orgavoxViewDropdown"), effects,
      prevMarker, marker, nextMarker, ui.nudgeLeftBtn, ui.nudgeRightBtn, ui.snapBtn, ui.snapGridSelect
    ].filter(Boolean);
    let anchor = editGroup.firstChild;
    ordered.forEach((node) => {
      if (node.parentElement !== editGroup || node !== anchor) editGroup.insertBefore(node, anchor);
      anchor = node.nextSibling;
    });
    patchNudgeButtons();
  }

  function layoutMainControls() {
    const main = document.querySelector(".orgavox-main-controls-group");
    if (!main) return;
    const controls = [ui.globalVolumeControl, ui.volumeSlider?.closest(".range-control"), ui.echoSlider?.closest(".range-control")].filter(Boolean);
    controls.forEach((control) => control.classList.add("orgavox-separated-control"));
    main.querySelectorAll(".orgavox-control-divider").forEach((node) => node.remove());
    controls.forEach((control) => {
      if (!control.parentElement) return;
      const before = document.createElement("span");
      before.className = "orgavox-control-divider";
      const after = document.createElement("span");
      after.className = "orgavox-control-divider";
      control.insertAdjacentElement("beforebegin", before);
      control.insertAdjacentElement("afterend", after);
    });
  }

  function playButtonPulse() {
    if (!ui.playBtn) return;
    ui.playBtn.classList.toggle("orgavox-playing", Boolean(state.playing));
  }

  function ensureTimeStepButtons() {
    if (!ui.timeReadout) return;
    const back = ensureButton("orgavoxPlayheadBackBtn", "←", "tool-button orgavox-playhead-step-button", "Move playhead back 0.1s", () => stepPlayhead(-0.1));
    const fwd = ensureButton("orgavoxPlayheadForwardBtn", "→", "tool-button orgavox-playhead-step-button", "Move playhead forward 0.1s", () => stepPlayhead(0.1));
    if (ui.timeReadout.nextElementSibling !== back) ui.timeReadout.insertAdjacentElement("afterend", back);
    if (back.nextElementSibling !== fwd) back.insertAdjacentElement("afterend", fwd);
  }

  function updateVersion() {
    document.title = `Organon — ORGAVOX ${VERSION}`;
    document.querySelectorAll(".simple-edit-version,.phase1-version,.orgavox-sidebar-version").forEach((node) => { node.textContent = VERSION; });
  }

  function openHistoryModal() {
    const modal = ensureHistoryModal();
    const list = modal.querySelector(".orgavox-history-list");
    list.innerHTML = "";
    const items = (state.__orgavoxV056History || []).slice(0, 20);
    if (!items.length) list.innerHTML = `<div class="empty-state">No undo history recorded yet.</div>`;
    items.forEach((snap, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "orgavox-history-item";
      button.innerHTML = `<span>${index + 1}. ${escapeHtml(snap.label || "Timeline change")}</span><small>${escapeHtml(snap.at || "")}</small>`;
      button.addEventListener("click", () => { modal.hidden = true; restoreHistory(snap); });
      list.appendChild(button);
    });
    modal.hidden = false;
    makeDialogInteractive(modal.querySelector(".orgavox-history-dialog"));
  }

  function ensureHistoryModal() {
    let modal = document.getElementById("orgavoxUndoHistoryModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "orgavoxUndoHistoryModal";
    modal.className = "orgavox-history-modal";
    modal.hidden = true;
    modal.innerHTML = `<section class="orgavox-history-dialog orgavox-popup-panel" role="dialog" aria-modal="true"><div class="popover-head"><div><span class="eyebrow">Edit</span><h3>Undo History</h3></div><button class="icon-button" data-history-close type="button">×</button></div><p class="export-note">Restore one of the last 20 recorded timeline states.</p><div class="orgavox-history-list"></div></section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-history-close]").forEach((btn) => btn.addEventListener("click", () => { modal.hidden = true; }));
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; });
    return modal;
  }

  function installPopupPolish() {
    if (window.__orgavoxV056PopupPolish) return;
    window.__orgavoxV056PopupPolish = true;
    targetObserver = new MutationObserver(() => refreshPopupPolish());
    targetObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "style", "class"] });
    document.addEventListener("pointermove", dragDialogMove);
    document.addEventListener("pointerup", endDialogDrag);
    refreshPopupPolish();
  }

  function refreshPopupPolish() {
    const panels = document.querySelectorAll(".popover,.export-dialog,.orgavox-stretch-dialog,.orgavox-project-dialog,.orgavox-bounce-dialog,.orgavox-analysis-dialog,.orgavox-history-dialog,.orgavox-download-dialog,[role='dialog']");
    panels.forEach((panel) => {
      panel.classList.add("orgavox-popup-panel");
      makeDialogInteractive(panel);
      addTargetPicker(panel);
    });
  }

  function makeDialogInteractive(panel) {
    if (!panel || panel.dataset.orgavoxV056Draggable === "true") return;
    panel.dataset.orgavoxV056Draggable = "true";
    const head = panel.querySelector(".popover-head") || panel.querySelector("h3")?.parentElement;
    if (!head) return;
    head.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button,input,select")) return;
      const rect = panel.getBoundingClientRect();
      panel.style.position = "fixed";
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.margin = "0";
      panel.style.transform = "none";
      draggingDialog = { panel, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top };
      panel.setPointerCapture?.(event.pointerId);
    });
  }

  function dragDialogMove(event) {
    if (!draggingDialog || draggingDialog.pointerId !== event.pointerId) return;
    const left = Math.max(8, Math.min(window.innerWidth - 80, draggingDialog.left + event.clientX - draggingDialog.startX));
    const top = Math.max(8, Math.min(window.innerHeight - 60, draggingDialog.top + event.clientY - draggingDialog.startY));
    draggingDialog.panel.style.left = `${left}px`;
    draggingDialog.panel.style.top = `${top}px`;
  }

  function endDialogDrag(event) {
    if (!draggingDialog || draggingDialog.pointerId !== event.pointerId) return;
    draggingDialog.panel.releasePointerCapture?.(event.pointerId);
    draggingDialog = null;
  }

  function addTargetPicker(panel) {
    if (!panel || panel.querySelector(".orgavox-effect-target-wrap")) return;
    if (!panel.querySelector(".popover-head")) return;
    if (panel.closest("#exportModal,#projectModal,#orgavoxUndoHistoryModal,#orgavoxDownloadModal")) return;
    const wrap = document.createElement("label");
    wrap.className = "orgavox-effect-target-wrap";
    wrap.innerHTML = `<span>Target clip</span><select></select>`;
    const select = wrap.querySelector("select");
    fillTargetSelect(select);
    select.addEventListener("change", () => {
      if (select.value) {
        selectClip(select.value);
        const clip = selectedClip();
        if (clip) selectTrack?.(clip.track);
        fillTargetSelect(select);
      }
    });
    panel.querySelector(".popover-head")?.insertAdjacentElement("afterend", wrap);
  }

  function fillTargetSelect(select) {
    if (!select) return;
    const current = state.selectedClipId;
    select.innerHTML = "";
    if (!state.clips.length) {
      select.innerHTML = `<option value="">No clips in timeline</option>`;
      return;
    }
    state.clips.slice().sort((a, b) => a.track - b.track || a.start - b.start).forEach((clip) => {
      const option = document.createElement("option");
      option.value = clip.id;
      option.textContent = `Track ${clip.track + 1} · ${formatTime(clip.start)} · ${clip.name}`;
      select.appendChild(option);
    });
    select.value = current && state.clips.some((clip) => clip.id === current) ? current : state.clips[0].id;
  }

  function installCustomDownload() {
    if (window.__orgavoxV056CustomDownload) return;
    window.__orgavoxV056CustomDownload = true;
    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("#downloadClipBtn,.orgavox-download-clip-button,[data-action='download']");
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openDownloadModal("clip");
    }, true);
  }

  function ensureDownloadModal() {
    let modal = document.getElementById("orgavoxDownloadModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "orgavoxDownloadModal";
    modal.className = "orgavox-download-modal";
    modal.hidden = true;
    modal.innerHTML = `<section class="orgavox-download-dialog orgavox-popup-panel" role="dialog" aria-modal="true"><div class="popover-head"><div><span class="eyebrow">Save audio</span><h3 data-download-title>Download</h3></div><button class="icon-button" data-download-close type="button">×</button></div><p class="export-note" data-download-summary></p><div class="orgavox-download-grid"><label class="orgavox-download-field"><span>Filename</span><input data-download-name type="text"></label><label class="orgavox-download-field"><span>Format</span><select data-download-format><option value="wav">WAV — lossless</option><option value="mp3">MP3</option></select></label><label class="orgavox-download-field"><span>MP3 compression</span><select data-download-bitrate><option value="128">128 kbps</option><option value="192" selected>192 kbps</option><option value="256">256 kbps</option><option value="320">320 kbps</option></select></label><label class="orgavox-download-field"><span>Save scope</span><select data-download-scope><option value="clip">Selected clip</option><option value="track">Selected track</option></select></label></div><div class="orgavox-download-actions"><button class="tool-button" data-download-close type="button">Cancel</button><button class="tool-button primary" data-download-save type="button">Save</button></div></section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-download-close]").forEach((btn) => btn.addEventListener("click", () => { modal.hidden = true; }));
    modal.querySelector("[data-download-save]").addEventListener("click", saveCustomDownload);
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; });
    return modal;
  }

  function openDownloadModal(scope = "clip") {
    const modal = ensureDownloadModal();
    const clip = selectedClip();
    const track = clip?.track ?? state.selectedTrack ?? 0;
    modal.querySelector("[data-download-scope]").value = scope;
    modal.querySelector("[data-download-title]").textContent = scope === "track" ? "Bounce Track" : "Download Clip";
    modal.querySelector("[data-download-summary]").textContent = scope === "track" ? `Track ${track + 1} will be rendered with its current clips and effects.` : (clip ? `${clip.name} will be rendered with its current effects.` : "Select a clip first.");
    modal.querySelector("[data-download-name]").value = safeFilename(scope === "track" ? `track-${track + 1}-bounce` : clip?.name || "orgavox-clip");
    modal.hidden = false;
    makeDialogInteractive(modal.querySelector(".orgavox-download-dialog"));
  }

  async function saveCustomDownload() {
    const modal = ensureDownloadModal();
    const scope = modal.querySelector("[data-download-scope]").value;
    const format = modal.querySelector("[data-download-format]").value;
    const bitrate = Number(modal.querySelector("[data-download-bitrate]").value) || 192;
    const filenameBase = safeFilename(modal.querySelector("[data-download-name]").value || "orgavox-audio");
    const filename = `${filenameBase}.${format}`;
    try {
      stopPlayback?.();
      setStatus?.("Rendering audio…");
      const buffer = scope === "track" ? await renderTrackBuffer(selectedClip()?.track ?? state.selectedTrack ?? 0) : await renderClipBufferForDownload();
      if (!buffer) throw new Error("Nothing could be rendered.");
      const blob = format === "mp3" ? await Promise.resolve(audioBufferToMp3(buffer, bitrate)) : audioBufferToWav(buffer);
      await saveBlob(blob, filename, format === "mp3" ? "audio/mpeg" : "audio/wav");
      modal.hidden = true;
      setStatus?.("Ready");
      showToast(`${filename} saved.`);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Download failed.");
      setStatus?.("Download failed");
    }
  }

  async function renderClipBufferForDownload() {
    const clip = selectedClip();
    if (!clip) throw new Error("Select a clip first.");
    if (typeof window.orgavoxRenderClipToBuffer === "function") return window.orgavoxRenderClipToBuffer(clip);
    if (typeof processedClipBuffer === "function") return processedClipBuffer(clip);
    throw new Error("Clip render engine is not available.");
  }

  async function renderTrackBuffer(track) {
    const trackIndex = Math.max(0, Math.min(9, Number(track) || 0));
    const clips = state.clips.filter((clip) => clip.track === trackIndex).sort((a, b) => a.start - b.start);
    if (!clips.length) throw new Error(`Track ${trackIndex + 1} has no clips.`);
    const sampleRate = clipBuffer(clips[0])?.sampleRate || audioContext?.sampleRate || 44100;
    const duration = Math.max(0.25, ...clips.map((clip) => clip.start + clipDuration(clip) + (clip.echo > 0 ? 2 : 0)));
    const context = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
    for (const clip of clips) {
      const buffer = typeof processedClipBuffer === "function" ? await processedClipBuffer(clip) : clipBuffer(clip);
      if (!buffer) continue;
      const source = context.createBufferSource();
      source.buffer = buffer;
      connectClipNodes(context, source, clip, context.destination);
      try { source.start(Math.max(0, clip.start)); } catch (error) { console.warn(error); }
    }
    return context.startRendering();
  }

  async function saveBlob(blob, filename, mime) {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: mime, accept: { [mime]: [`.${filename.split(".").pop()}`] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }
    if (typeof downloadBlob === "function") return downloadBlob(blob, filename);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function refreshAll(canRecord = false) {
    updateVersion();
    refreshSnapOptions();
    enhanceMenus();
    layoutToolbar();
    layoutMainControls();
    ensureTimeStepButtons();
    installTimeEdit();
    installTimelineScrub();
    addTrackInfoButtons();
    playButtonPulse();
    refreshPopupPolish();
    applySelectionClasses();
    if (canRecord) recordHistory("Timeline change");
  }

  boot();
})();
