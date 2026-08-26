"use strict";

(function bootOrgavoxV058Group1Safe() {
  const LABEL = "v0.58 G1 Safe";
  const STYLE_ID = "orgavox-v058-g1-safe-style";
  const SNAP_SECONDS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
  let tries = 0;

  function isReady() {
    return typeof window.ui !== "undefined" && typeof window.state !== "undefined" && typeof window.renderTimeline === "function";
  }

  function boot() {
    if (!isReady()) {
      tries += 1;
      if (tries < 240) window.setTimeout(boot, 50);
      return;
    }
    safeRun(install);
  }

  function safeRun(fn) {
    try { return fn(); }
    catch (error) { console.warn("ORGAVOX v0.58 Group 1 Safe skipped one step:", error); return null; }
  }

  function install() {
    window.ORGAVOX_VERSION = LABEL;
    installStyles();
    markVersion();
    relabelSnip();
    addEditCut();
    addMarkerButtons();
    rewriteSnapDropdown();
    patchNudgeButtons();
    installArrowKeys();
    installEditableTime();
    addTrackInfoButtons();
    orderToolbar();
    addControlDividers();
    addRandomizeColors();
    moveBounceToView();
    patchTimelineClickDeselect();
    [150, 500, 1000, 1800].forEach((delay) => window.setTimeout(refresh, delay));
  }

  function refresh() {
    safeRun(markVersion);
    safeRun(relabelSnip);
    safeRun(addMarkerButtons);
    safeRun(rewriteSnapDropdown);
    safeRun(addTrackInfoButtons);
    safeRun(orderToolbar);
    safeRun(addControlDividers);
    safeRun(addRandomizeColors);
    safeRun(moveBounceToView);
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes orgavoxV058PlayPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 1px rgba(117,178,222,.35),0 0 14px rgba(75,155,255,.28)}50%{transform:scale(1.12);box-shadow:0 0 0 2px rgba(168,220,255,.78),0 0 30px rgba(75,155,255,.72)}}
      body.simple-edit-phase1 #playBtn.orgavox-playing{animation:orgavoxV058PlayPulse .78s ease-in-out infinite!important;transform-origin:center!important;z-index:5!important}
      body.simple-edit-phase1 .track-lane.selected-track{box-shadow:inset 0 0 0 3px rgba(117,216,255,.96),inset 6px 0 rgba(117,216,255,1),0 0 28px rgba(117,216,255,.24)!important;background-color:rgba(75,155,255,.17)!important}
      body.simple-edit-phase1 .audio-clip:not(.selected):not(.orgavox-multi-selected){outline:0!important;box-shadow:0 4px 12px rgba(0,0,0,.35)!important;background:linear-gradient(180deg,rgba(75,132,191,.45),rgba(38,97,92,.4))!important;color:#fff!important}
      .orgavox-v058-marker-step{min-width:34px!important;width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;border-color:rgba(178,109,255,.9)!important;background:linear-gradient(180deg,rgba(106,60,190,.94),rgba(53,27,108,.96))!important;color:#f3e2ff!important;box-shadow:0 0 0 1px rgba(178,109,255,.24),0 0 14px rgba(130,78,220,.22)!important}
      .orgavox-v058-info{min-width:24px!important;width:24px!important;height:22px!important;min-height:22px!important;padding:0!important;border:1px solid rgba(74,190,117,.9)!important;border-radius:7px!important;background:linear-gradient(180deg,rgba(34,126,66,.95),rgba(12,58,31,.98))!important;color:#e4ffed!important;font:900 .58rem var(--font-mono)!important;box-shadow:0 0 10px rgba(74,190,117,.24)!important}
      #snapGridSelect,.orgavox-snap-grid-select{background:#050606!important;color:#dff5ff!important;border-color:rgba(117,178,222,.75)!important}
      .orgavox-v058-divider{width:1px!important;align-self:center!important;min-height:34px!important;margin:0 4px!important;background:linear-gradient(180deg,transparent,rgba(224,163,96,.78),transparent)!important;display:inline-flex!important;flex:0 0 1px!important}
      body.simple-edit-phase1 .time-readout{cursor:text!important;user-select:text!important}
      body.simple-edit-phase1 .time-readout[contenteditable="true"]{outline:2px solid rgba(117,178,222,.65)!important;background:rgba(0,0,0,.58)!important;box-shadow:0 0 18px rgba(117,178,222,.28)!important}
      body.simple-edit-phase1 .simple-edit-version{color:#8cffd5!important}
    `;
    document.head.appendChild(style);
  }

  function markVersion() {
    document.title = "Organon — ORGAVOX " + LABEL;
    const badge = document.querySelector(".simple-edit-version,.phase1-version");
    if (badge) badge.textContent = LABEL;
    const status = document.getElementById("statusPill");
    if (status && /ready/i.test(status.textContent || "")) status.textContent = "Ready — " + LABEL;
  }

  function relabelSnip() {
    if (window.ui?.scissorsBtn) {
      window.ui.scissorsBtn.textContent = "✂️ Snip";
      window.ui.scissorsBtn.title = "Snip/split selected clip at the playhead";
    }
  }

  function currentSnap() {
    const select = window.ui?.snapGridSelect || document.getElementById("snapGridSelect");
    const value = Number(select?.value);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function rewriteSnapDropdown() {
    const select = window.ui?.snapGridSelect || document.getElementById("snapGridSelect");
    if (!select || select.dataset.orgavoxV058Snap === "true") return;
    select.dataset.orgavoxV058Snap = "true";
    select.innerHTML = "";
    SNAP_SECONDS.forEach((seconds) => {
      const option = document.createElement("option");
      option.value = String(seconds);
      option.textContent = String(seconds);
      if (seconds === 1) option.selected = true;
      select.appendChild(option);
    });
    select.classList.add("orgavox-snap-grid-select");
  }

  function selectedClips() {
    const ids = Array.isArray(window.state?.selectedClipIds) && window.state.selectedClipIds.length ? window.state.selectedClipIds : [window.state?.selectedClipId].filter(Boolean);
    return ids.map((id) => window.state.clips.find((clip) => clip.id === id)).filter(Boolean);
  }

  function moveSelectedClips(delta) {
    const clips = selectedClips();
    if (!clips.length) return false;
    window.stopPlayback?.();
    clips.forEach((clip) => { clip.start = Math.max(0, (Number(clip.start) || 0) + delta); window.invalidateClip?.(clip); });
    window.renderTimeline?.();
    window.syncSelectedControls?.();
    window.orgavoxRecordHistory?.();
    return true;
  }

  function patchNudgeButtons() {
    [[window.ui?.nudgeLeftBtn, -1], [window.ui?.nudgeRightBtn, 1]].forEach(([button, direction]) => {
      if (!button || button.dataset.orgavoxV058Nudge === "true") return;
      button.dataset.orgavoxV058Nudge = "true";
      button.addEventListener("click", (event) => {
        if (!moveSelectedClips(direction * currentSnap())) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
    });
  }

  function installArrowKeys() {
    if (window.__orgavoxV058ArrowKeys) return;
    window.__orgavoxV058ArrowKeys = true;
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable);
      if (typing || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const amount = event.shiftKey ? 1 : (event.ctrlKey || event.metaKey ? 0.1 : 0.01);
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      window.setPlayhead?.(Math.max(0, (Number(window.state.playhead) || 0) + direction * amount), true);
    }, true);
  }

  function parseTime(text) {
    const value = String(text || "").trim();
    if (!value) return null;
    if (value.includes(":")) {
      const parts = value.split(":").map(Number);
      if (parts.some((part) => !Number.isFinite(part))) return null;
      return parts.reduce((total, part) => total * 60 + part, 0);
    }
    const seconds = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(seconds) ? seconds : null;
  }

  function installEditableTime() {
    const readout = window.ui?.timeReadout || document.getElementById("timeReadout");
    if (!readout || readout.dataset.orgavoxV058Time === "true") return;
    readout.dataset.orgavoxV058Time = "true";
    readout.addEventListener("click", () => { readout.contentEditable = "true"; readout.focus(); document.execCommand?.("selectAll", false, null); });
    readout.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); readout.blur(); }
      if (event.key === "Escape") { event.preventDefault(); readout.contentEditable = "false"; window.setPlayhead?.(window.state.playhead, false); }
    });
    readout.addEventListener("blur", () => {
      if (readout.contentEditable !== "true") return;
      const seconds = parseTime(readout.textContent);
      readout.contentEditable = "false";
      if (seconds !== null) window.setPlayhead?.(Math.max(0, seconds), true);
      else window.setPlayhead?.(window.state.playhead, false);
    });
  }

  function markerTimes() {
    return (Array.isArray(window.state?.markers) ? window.state.markers : []).map((marker) => Number(marker.time)).filter(Number.isFinite).sort((a, b) => a - b);
  }

  function jumpMarker(direction) {
    const times = markerTimes();
    if (!times.length) return window.showToast?.("No markers yet.");
    const now = Number(window.state.playhead) || 0;
    const target = direction < 0 ? [...times].reverse().find((time) => time < now - 0.001) ?? times[times.length - 1] : times.find((time) => time > now + 0.001) ?? times[0];
    window.setPlayhead?.(target, true);
  }

  function makeMarkerButton(id, label, direction) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "tool-button orgavox-v058-marker-step";
      button.addEventListener("click", () => jumpMarker(direction));
    }
    button.textContent = label;
    button.title = direction < 0 ? "Previous marker" : "Next marker";
    return button;
  }

  function addMarkerButtons() {
    const marker = window.ui?.markersBtn || document.getElementById("markersBtn");
    if (!marker || !marker.parentElement) return;
    const prev = makeMarkerButton("orgavoxPrevMarkerBtn", "◀", -1);
    const next = makeMarkerButton("orgavoxNextMarkerBtn", "▶", 1);
    if (marker.previousElementSibling !== prev) marker.parentElement.insertBefore(prev, marker);
    if (marker.nextElementSibling !== next) marker.insertAdjacentElement("afterend", next);
  }

  function openAnalysisForTrack(track) {
    window.selectTrack?.(track);
    const clip = window.state.clips.find((item) => item.track === track);
    if (clip && typeof window.selectClip === "function") window.selectClip(clip.id);
    const modal = document.getElementById("analysisModal");
    if (modal) {
      modal.hidden = false;
      window.showToast?.(`Analyzing Track ${track + 1}.`);
      setTimeout(() => modal.querySelector("[data-analysis-scan]")?.click(), 0);
    } else window.showToast?.("Analyze screen is still loading.");
  }

  function addTrackInfoButtons() {
    document.querySelectorAll(".track-label").forEach((label) => {
      const track = Number(label.dataset.trackLabel);
      if (!Number.isFinite(track) || label.querySelector(".orgavox-v058-info")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "orgavox-v058-info";
      button.textContent = "i";
      button.title = `Analyze Track ${track + 1}`;
      button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); openAnalysisForTrack(track); });
      label.appendChild(button);
    });
  }

  function orderToolbar() {
    const editGroup = document.querySelector(".orgavox-edit-group");
    if (!editGroup) return;
    const edit = document.getElementById("orgavoxEditDropdown");
    const view = document.getElementById("orgavoxViewDropdown");
    const effects = editGroup.querySelector(".orgavox-effects-dropdown");
    if (edit && view) edit.insertAdjacentElement("afterend", view);
    if (view && effects) view.insertAdjacentElement("afterend", effects);
    const nudgeRight = window.ui?.nudgeRightBtn || document.getElementById("nudgeRightBtn");
    const snap = window.ui?.snapBtn || document.getElementById("snapBtn");
    const snapSelect = window.ui?.snapGridSelect || document.getElementById("snapGridSelect");
    if (nudgeRight && snap) nudgeRight.insertAdjacentElement("afterend", snap);
    if (snap && snapSelect) snap.insertAdjacentElement("afterend", snapSelect);
  }

  function addControlDividers() {
    const main = document.querySelector(".orgavox-main-controls-group");
    if (!main || main.dataset.orgavoxV058Dividers === "true") return;
    main.dataset.orgavoxV058Dividers = "true";
    Array.from(main.children).forEach((child) => {
      if (child.matches?.(".range-control,.orgavox-global-volume-control")) {
        const before = document.createElement("span");
        before.className = "orgavox-v058-divider";
        const after = document.createElement("span");
        after.className = "orgavox-v058-divider";
        child.insertAdjacentElement("beforebegin", before);
        child.insertAdjacentElement("afterend", after);
      }
    });
  }

  function addRandomizeColors() {
    const panel = document.querySelector("#orgavoxViewDropdown .orgavox-view-menu");
    if (!panel || document.getElementById("orgavoxRandomizeTrackColorsBtn")) return;
    const button = document.createElement("button");
    button.id = "orgavoxRandomizeTrackColorsBtn";
    button.type = "button";
    button.className = "tool-button";
    button.textContent = "🎲 Randomize Track Colors";
    button.addEventListener("click", () => {
      document.querySelectorAll(".track-lane").forEach((lane, index) => {
        const hue = Math.round((index * 37 + Math.random() * 80) % 360);
        lane.style.backgroundColor = `hsla(${hue}, 54%, 18%, .42)`;
      });
      window.showToast?.("Track colors randomized.");
    });
    panel.appendChild(button);
  }

  function moveBounceToView() {
    const panel = document.querySelector("#orgavoxViewDropdown .orgavox-view-menu");
    const bounce = window.ui?.bounceBtn || document.getElementById("bounceBtn");
    if (!panel || !bounce) return;
    bounce.textContent = "🧱 Bounce Track";
    bounce.title = "Bounce/render the selected track or clip";
    if (bounce.parentElement !== panel) panel.appendChild(bounce);
  }

  function addEditCut() {
    const panel = document.querySelector("#orgavoxEditDropdown .orgavox-edit-menu");
    if (!panel || document.getElementById("orgavoxRealCutClipBtn")) return;
    const button = document.createElement("button");
    button.id = "orgavoxRealCutClipBtn";
    button.type = "button";
    button.className = "tool-button";
    button.textContent = "✂ Cut";
    button.title = "Remove selected clip and store it for Paste";
    button.addEventListener("click", () => {
      const clips = selectedClips();
      if (!clips.length) return window.showToast?.("Select a clip to cut.");
      window.stopPlayback?.();
      window.state.__orgavoxClipClipboard = clips.length === 1 ? { ...clips[0], id: clips[0].id } : clips.map((clip) => ({ ...clip, id: clip.id }));
      window.state.clips = window.state.clips.filter((clip) => !clips.includes(clip));
      window.state.selectedClipId = null;
      window.state.selectedClipIds = [];
      window.syncSelectedControls?.();
      window.renderTimeline?.();
      window.orgavoxRecordHistory?.();
      window.showToast?.(clips.length === 1 ? "Clip cut." : `${clips.length} clips cut.`);
    });
    const copy = document.getElementById("orgavoxCopyClipBtn");
    if (copy && copy.parentElement === panel) copy.insertAdjacentElement("afterend", button);
    else panel.appendChild(button);
  }

  function patchTimelineClickDeselect() {
    if (window.__orgavoxV058DeselectPatch) return;
    window.__orgavoxV058DeselectPatch = true;
    document.addEventListener("click", (event) => {
      if (event.target.closest(".audio-clip")) return;
      if (!event.target.closest(".timeline-scroll,.track-lane,.tracks")) return;
      window.state.selectedClipId = null;
      window.state.selectedClipIds = [];
      document.querySelectorAll(".audio-clip.selected,.audio-clip.orgavox-multi-selected").forEach((node) => node.classList.remove("selected", "orgavox-multi-selected"));
      window.syncSelectedControls?.();
    }, true);
  }

  boot();
})();
