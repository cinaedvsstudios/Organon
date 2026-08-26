"use strict";

(function bootOrgavoxV056Group1() {
  const VERSION = "v0.56";
  const STYLE_ID = "orgavox-v056-group1-style";
  const SNAP_VALUES = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
  const TRACK_COLORS = ["cyan", "gold", "green", "purple", "red", "white", "blue"];
  let tries = 0;
  let installed = false;
  let scrubPointerId = null;

  function ready() {
    return typeof ui !== "undefined"
      && typeof state !== "undefined"
      && typeof renderTimeline === "function"
      && typeof syncSelectedControls === "function"
      && typeof setPlayhead === "function"
      && typeof selectClip === "function"
      && typeof selectedClip === "function";
  }

  function boot() {
    if (!ready()) {
      tries += 1;
      if (tries < 180) setTimeout(boot, 50);
      return;
    }
    install();
  }

  function install() {
    if (installed) return;
    installed = true;
    window.ORGAVOX_VERSION = VERSION;
    installStyles();
    patchRenderAndSelection();
    patchClipboardCut();
    patchNudgeAmount();
    installArrowPlayheadKeys();
    installEditableTime();
    installTimelineScrub();
    refreshGroup1();
    [0, 150, 400, 900, 1400].forEach((delay) => setTimeout(refreshGroup1, delay));
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes orgavoxGroup1PlayPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 1px rgba(117,178,222,.34),0 0 14px rgba(75,155,255,.3)}50%{transform:scale(1.13);box-shadow:0 0 0 2px rgba(168,220,255,.78),0 0 30px rgba(75,155,255,.75),0 0 46px rgba(117,178,222,.34)}}
      body.simple-edit-phase1 #playBtn.orgavox-playing{animation:orgavoxGroup1PlayPulse .78s ease-in-out infinite!important;transform-origin:center!important;z-index:4!important}
      body.simple-edit-phase1 .audio-clip:not(.selected):not(.orgavox-multi-selected){outline:0!important;background:linear-gradient(180deg,rgba(75,132,191,.46),rgba(38,97,92,.4))!important;box-shadow:0 4px 12px rgba(0,0,0,.35)!important;color:#fff!important}
      body.simple-edit-phase1 .audio-clip:not(.selected):not(.orgavox-multi-selected) .clip-title{color:#fff!important;text-shadow:0 1px 3px #000!important}
      body.simple-edit-phase1 .track-lane.selected-track{box-shadow:inset 0 0 0 3px rgba(117,216,255,.9),inset 6px 0 rgba(117,216,255,1),0 0 26px rgba(117,216,255,.2)!important;background-color:rgba(75,155,255,.16)!important}
      .orgavox-marker-step-button{min-width:34px!important;width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;border-color:rgba(178,109,255,.9)!important;background:linear-gradient(180deg,rgba(106,60,190,.94),rgba(53,27,108,.96))!important;color:#f3e2ff!important;box-shadow:0 0 0 1px rgba(178,109,255,.24),0 0 14px rgba(130,78,220,.22)!important}
      .orgavox-track-info-btn{min-width:24px!important;width:24px!important;height:22px!important;min-height:22px!important;padding:0!important;border:1px solid rgba(74,190,117,.9)!important;border-radius:7px!important;background:linear-gradient(180deg,rgba(34,126,66,.95),rgba(12,58,31,.98))!important;color:#e4ffed!important;font:900 .58rem var(--font-mono)!important;box-shadow:0 0 10px rgba(74,190,117,.24)!important}
      body.simple-edit-phase1 .orgavox-snap-grid-select,#snapGridSelect{background:#050606!important;color:#dff5ff!important;border-color:rgba(117,178,222,.72)!important}
      body.simple-edit-phase1 .orgavox-control-divider{width:1px!important;align-self:center!important;min-height:34px!important;margin:0 4px!important;background:linear-gradient(180deg,transparent,rgba(224,163,96,.8),transparent)!important;display:inline-flex!important;flex:0 0 1px!important}
      body.simple-edit-phase1 .time-readout{cursor:text!important;user-select:text!important}
      body.simple-edit-phase1 .time-readout[contenteditable="true"]{outline:2px solid rgba(117,178,222,.64)!important;box-shadow:0 0 18px rgba(117,178,222,.28)!important;background:rgba(0,0,0,.64)!important}
    `;
    document.head.appendChild(style);
  }

  function showSafeToast(message) {
    try { showToast(message); } catch {}
  }

  function trackSettings() {
    if (!Array.isArray(state.trackSettings)) state.trackSettings = [];
    for (let i = 0; i < 10; i += 1) {
      state.trackSettings[i] = { name: `Track ${i + 1}`, color: TRACK_COLORS[i % TRACK_COLORS.length], muted: false, solo: false, volume: 100, pan: 0, ...(state.trackSettings[i] || {}) };
    }
    return state.trackSettings;
  }

  function parseTime(text) {
    const raw = String(text || "").trim();
    if (!raw) return 0;
    const bits = raw.split(":").map((part) => Number(part.replace(/[^0-9.]/g, "")) || 0);
    if (bits.length >= 2) return Math.max(0, bits[0] * 60 + bits[1]);
    return Math.max(0, Number(raw.replace(/[^0-9.]/g, "")) || 0);
  }

  function selectedIds() {
    if (Array.isArray(state.selectedClipIds) && state.selectedClipIds.length) return state.selectedClipIds.filter((id) => state.clips.some((clip) => clip.id === id));
    return state.selectedClipId ? [state.selectedClipId] : [];
  }

  function clearSelectionVisuals() {
    const ids = new Set(selectedIds());
    document.querySelectorAll(".audio-clip").forEach((node) => {
      const selected = ids.has(node.dataset.clipId) || node.dataset.clipId === state.selectedClipId;
      node.classList.toggle("selected", selected);
      if (!selected) node.classList.remove("orgavox-multi-selected", "orgavox-drag-armed");
    });
  }

  function deselectAll() {
    state.selectedClipId = null;
    state.selectedClipIds = [];
    try { syncSelectedControls(); } catch {}
    clearSelectionVisuals();
  }

  function patchRenderAndSelection() {
    if (!window.__orgavoxV056Group1RenderPatch) {
      window.__orgavoxV056Group1RenderPatch = true;
      const oldRender = renderTimeline;
      renderTimeline = function orgavoxV056Group1RenderTimeline() {
        const result = oldRender.apply(this, arguments);
        setTimeout(refreshGroup1, 0);
        return result;
      };
      const oldSync = syncSelectedControls;
      syncSelectedControls = function orgavoxV056Group1SyncSelectedControls() {
        const result = oldSync.apply(this, arguments);
        setTimeout(refreshGroup1, 0);
        return result;
      };
    }

    if (!window.__orgavoxV056Group1Deselect) {
      window.__orgavoxV056Group1Deselect = true;
      document.addEventListener("pointerdown", (event) => {
        if (event.target.closest?.(".audio-clip")) return;
        if (event.target.closest?.("button,input,select,textarea,.orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu,.popover,.modal-backdrop")) return;
        if (ui.tracks?.contains(event.target) || ui.timelineContent?.contains(event.target)) deselectAll();
      }, true);
    }
  }

  function patchClipboardCut() {
    if (window.__orgavoxV056Group1Clipboard) return;
    window.__orgavoxV056Group1Clipboard = true;

    window.orgavoxCutSelectionToClipboard = function orgavoxCutSelectionToClipboard() {
      const ids = selectedIds();
      if (!ids.length) return showSafeToast("Select a clip to cut.");
      try { stopPlayback(); } catch {}
      state.__orgavoxClipClipboard = state.clips.filter((clip) => ids.includes(clip.id)).map((clip) => ({ ...clip, id: clip.id, volumeKeyframes: Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes.map((item) => ({ ...item })) : [] }));
      state.clips = state.clips.filter((clip) => !ids.includes(clip.id));
      deselectAll();
      renderTimeline();
      showSafeToast(`${ids.length} clip${ids.length === 1 ? "" : "s"} cut to clipboard.`);
      try { window.orgavoxRecordHistory?.(); } catch {}
    };

    const oldPaste = window.orgavoxPasteGroup1Patched ? null : null;
    window.orgavoxPasteGroup1Patched = true;
  }

  function snapValue() {
    const select = ui.snapGridSelect || document.getElementById("snapGridSelect");
    const value = Number(select?.value || localStorage.getItem("orgavoxSnapGrid") || 0.1);
    return Number.isFinite(value) && value > 0 ? value : 0.1;
  }

  function patchNudgeAmount() {
    if (window.__orgavoxV056Group1NudgePatch) return;
    window.__orgavoxV056Group1NudgePatch = true;
    window.orgavoxGroup1NudgeSelected = function orgavoxGroup1NudgeSelected(direction) {
      const clip = selectedClip();
      if (!clip) return showSafeToast("Select a clip to nudge.");
      try { stopPlayback(); } catch {}
      const amount = snapValue() * (direction < 0 ? -1 : 1);
      clip.start = Math.max(0, Number(clip.start || 0) + amount);
      renderTimeline();
      try { syncSelectedControls(); } catch {}
      showSafeToast(`${direction < 0 ? "Nudged left" : "Nudged right"} by ${snapValue()}s.`);
      try { window.orgavoxRecordHistory?.(); } catch {}
    };
  }

  function movePlayheadBy(delta) {
    try { setPlayhead(Math.max(0, Number(state.playhead || 0) + delta), true); } catch {}
  }

  function installArrowPlayheadKeys() {
    if (window.__orgavoxV056Group1ArrowKeys) return;
    window.__orgavoxV056Group1ArrowKeys = true;
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable)) return;
      if (event.altKey || event.metaKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const base = event.shiftKey ? 1 : event.ctrlKey ? 0.1 : 0.01;
      movePlayheadBy(event.key === "ArrowLeft" ? -base : base);
    }, true);
  }

  function installEditableTime() {
    const readout = ui.timeReadout;
    if (!readout || readout.dataset.orgavoxGroup1Editable === "true") return;
    readout.dataset.orgavoxGroup1Editable = "true";
    readout.tabIndex = 0;
    readout.title = "Click and type a time, then press Enter.";
    readout.addEventListener("click", () => {
      readout.contentEditable = "true";
      readout.focus();
      document.execCommand?.("selectAll", false, null);
    });
    readout.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); readout.blur(); }
      if (event.key === "Escape") { event.preventDefault(); readout.contentEditable = "false"; setPlayhead(state.playhead, true); }
    });
    readout.addEventListener("blur", () => {
      if (readout.isContentEditable) setPlayhead(parseTime(readout.textContent), true);
      readout.contentEditable = "false";
    });
  }

  function pointerTime(event) {
    const rect = ui.timelineScroll.getBoundingClientRect();
    return Math.max(0, (ui.timelineScroll.scrollLeft + event.clientX - rect.left) / Math.max(1, Number(state.pixelsPerSecond) || 80));
  }

  function installTimelineScrub() {
    if (!ui.timelineScroll || ui.timelineScroll.dataset.orgavoxGroup1Scrub === "true") return;
    ui.timelineScroll.dataset.orgavoxGroup1Scrub = "true";
    ui.timelineScroll.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest?.(".audio-clip")) return;
      scrubPointerId = event.pointerId;
      try { ui.timelineScroll.setPointerCapture(event.pointerId); } catch {}
      setPlayhead(pointerTime(event), false);
      event.preventDefault();
    });
    ui.timelineScroll.addEventListener("pointermove", (event) => {
      if (scrubPointerId !== event.pointerId) return;
      setPlayhead(pointerTime(event), false);
    });
    ["pointerup", "pointercancel"].forEach((type) => ui.timelineScroll.addEventListener(type, (event) => {
      if (scrubPointerId !== event.pointerId) return;
      scrubPointerId = null;
      try { ui.timelineScroll.releasePointerCapture(event.pointerId); } catch {}
    }));
  }

  function ensureButton(id, label, className, handler, title) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.addEventListener("click", handler);
    }
    button.className = className;
    button.textContent = label;
    button.title = title || label;
    return button;
  }

  function markerTimes() {
    return Array.isArray(state.markers) ? state.markers.map((m) => Math.max(0, Number(m.time) || 0)).sort((a, b) => a - b) : [];
  }

  function markerStep(direction) {
    const times = markerTimes();
    if (!times.length) return showSafeToast("No markers in timeline.");
    const now = Number(state.playhead) || 0;
    const next = direction > 0 ? times.find((time) => time > now + 0.001) ?? times[0] : [...times].reverse().find((time) => time < now - 0.001) ?? times[times.length - 1];
    setPlayhead(next, true);
  }

  function buildSnapOptions() {
    const select = ui.snapGridSelect || document.getElementById("snapGridSelect");
    if (!select || select.dataset.orgavoxGroup1Decimals === "true") return;
    const current = String(select.value || localStorage.getItem("orgavoxSnapGrid") || "0.1");
    select.innerHTML = "";
    SNAP_VALUES.forEach((value) => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = String(value);
      select.appendChild(option);
    });
    select.value = SNAP_VALUES.map(String).includes(current) ? current : "0.1";
    localStorage.setItem("orgavoxSnapGrid", select.value);
    select.dataset.orgavoxGroup1Decimals = "true";
    select.addEventListener("change", () => localStorage.setItem("orgavoxSnapGrid", select.value));
  }

  function placeToolbar() {
    const editGroup = document.querySelector(".orgavox-edit-group");
    if (!editGroup) return;
    const edit = document.getElementById("orgavoxEditDropdown");
    const view = document.getElementById("orgavoxViewDropdown");
    const effects = editGroup.querySelector(".orgavox-effects-dropdown");
    if (edit && view && effects) {
      editGroup.insertBefore(view, effects);
      editGroup.insertBefore(edit, view);
    }
    if (ui.bounceBtn && view) addToView(ui.bounceBtn, "🧱 Bounce Track");
    if (ui.markersBtn && effects) {
      const prev = ensureButton("orgavoxPrevMarkerBtn", "◀", "tool-button orgavox-marker-step-button", () => markerStep(-1), "Previous marker");
      const next = ensureButton("orgavoxNextMarkerBtn", "▶", "tool-button orgavox-marker-step-button", () => markerStep(1), "Next marker");
      if (ui.markersBtn.parentElement !== editGroup) editGroup.insertBefore(ui.markersBtn, effects.nextSibling);
      editGroup.insertBefore(prev, ui.markersBtn);
      if (ui.markersBtn.nextSibling !== next) editGroup.insertBefore(next, ui.markersBtn.nextSibling);
      ui.markersBtn.textContent = "🏷 Add Marker";
    }
    const nudgeLeft = ui.nudgeLeftBtn || document.getElementById("nudgeLeftBtn");
    const nudgeRight = ui.nudgeRightBtn || document.getElementById("nudgeRightBtn");
    const snap = ui.snapBtn || document.getElementById("snapGridBtn");
    const snapSelect = ui.snapGridSelect || document.getElementById("snapGridSelect");
    if (nudgeLeft && nudgeRight && snap && snapSelect) {
      editGroup.appendChild(nudgeLeft);
      editGroup.appendChild(nudgeRight);
      editGroup.appendChild(snap);
      editGroup.appendChild(snapSelect);
      nudgeLeft.onclick = (event) => { event.preventDefault(); window.orgavoxGroup1NudgeSelected(-1); };
      nudgeRight.onclick = (event) => { event.preventDefault(); window.orgavoxGroup1NudgeSelected(1); };
    }
  }

  function addToEdit(button, label, afterId) {
    const panel = document.querySelector(".orgavox-edit-menu");
    if (!panel || !button) return;
    button.textContent = label;
    const after = afterId ? document.getElementById(afterId) : null;
    if (after?.parentElement === panel) after.insertAdjacentElement("afterend", button);
    else if (button.parentElement !== panel) panel.appendChild(button);
  }

  function addToView(button, label) {
    const panel = document.querySelector(".orgavox-view-menu");
    if (!panel || !button) return;
    button.textContent = label;
    if (button.parentElement !== panel) panel.appendChild(button);
  }

  function editMenu() {
    if (ui.scissorsBtn) ui.scissorsBtn.textContent = "✂️ Snip";
    const cut = ensureButton("orgavoxCutClipboardBtn", "✂️ Cut", "tool-button orgavox-danger-tool", () => window.orgavoxCutSelectionToClipboard?.(), "Cut selected clip to clipboard");
    addToEdit(cut, "✂️ Cut", "orgavoxCopyClipBtn");
  }

  function randomizeTrackColors() {
    const settings = trackSettings();
    settings.forEach((track, index) => { track.color = TRACK_COLORS[(index + Math.floor(Math.random() * TRACK_COLORS.length)) % TRACK_COLORS.length]; });
    try { window.orgavoxRefreshTrackTools?.(); } catch {}
    renderTimeline();
    showSafeToast("Track colors randomized.");
    try { window.orgavoxRecordHistory?.(); } catch {}
  }

  function viewMenu() {
    const random = ensureButton("orgavoxRandomTrackColorsBtn", "🎨 Randomize Track Colors", "tool-button", randomizeTrackColors, "Randomize track colors");
    addToView(random, "🎨 Randomize Track Colors");
  }

  function addTrackInfoButtons() {
    document.querySelectorAll(".track-label").forEach((label) => {
      const index = Number(label.dataset.trackLabel);
      if (!Number.isFinite(index)) return;
      let btn = label.querySelector(".orgavox-track-info-btn");
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "orgavox-track-info-btn";
        btn.textContent = "i";
        btn.title = "Analyze this track";
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          analyzeTrack(index);
        });
      }
      const mini = label.querySelector(".orgavox-track-mini") || label;
      const solo = mini.querySelector(".solo");
      if (solo && solo.nextSibling !== btn) solo.insertAdjacentElement("afterend", btn);
      else if (!solo && btn.parentElement !== mini) mini.appendChild(btn);
    });
  }

  function analyzeTrack(index) {
    const clip = state.clips.filter((item) => item.track === index).sort((a, b) => a.start - b.start)[0];
    if (!clip) return showSafeToast(`Track ${index + 1} has no clips to analyze.`);
    try { selectClip(clip.id); selectTrack(index); syncSelectedControls(); } catch {}
    const modal = document.getElementById("analysisModal");
    if (modal) modal.hidden = false;
    setTimeout(() => modal?.querySelector?.("[data-analysis-scan]")?.click?.(), 0);
    showSafeToast(`Analyzing Track ${index + 1}.`);
  }

  function div(id) {
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement("span");
      node.id = id;
      node.className = "orgavox-control-divider";
      node.setAttribute("aria-hidden", "true");
    }
    return node;
  }

  function placeControlDividers() {
    const main = document.querySelector(".orgavox-main-controls-group");
    if (!main) return;
    const groups = [ui.globalVolumeControl, ui.volumeSlider?.closest(".range-control"), ui.echoSlider?.closest(".range-control")].filter(Boolean);
    groups.forEach((group, index) => {
      if (group.parentElement !== main) return;
      const before = div(`orgavoxControlBefore${index}`);
      const after = div(`orgavoxControlAfter${index}`);
      if (group.previousSibling !== before) main.insertBefore(before, group);
      if (group.nextSibling !== after) main.insertBefore(after, group.nextSibling);
    });
  }

  function refreshPlayState() {
    ui.playBtn?.classList.toggle("orgavox-playing", Boolean(state.playing));
  }

  function refreshGroup1() {
    try {
      installStyles();
      document.title = `Organon — ORGAVOX ${VERSION}`;
      document.querySelectorAll(".simple-edit-version,.phase1-version").forEach((badge) => { badge.textContent = VERSION; });
      buildSnapOptions();
      placeToolbar();
      editMenu();
      viewMenu();
      addTrackInfoButtons();
      placeControlDividers();
      clearSelectionVisuals();
      refreshPlayState();
      installEditableTime();
      installTimelineScrub();
    } catch (error) {
      console.warn("ORGAVOX v0.56 group 1 refresh failed", error);
    }
  }

  boot();
})();
