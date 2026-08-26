"use strict";

(function bootOrgavoxV059Group1Active() {
  const LABEL = "v0.59 G1 Active";
  const STYLE_ID = "orgavox-v059-g1-active-style";
  const SNAP_SECONDS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
  let tries = 0;
  let installed = false;

  function ready() {
    return typeof ui !== "undefined"
      && typeof state !== "undefined"
      && typeof renderTimeline === "function"
      && typeof syncSelectedControls === "function"
      && typeof setPlayhead === "function";
  }

  function boot() {
    if (!ready()) {
      tries += 1;
      if (tries < 300) setTimeout(boot, 50);
      return;
    }
    try { install(); }
    catch (error) { console.error("ORGAVOX v0.59 Group 1 failed", error); }
  }

  function install() {
    if (installed) return;
    installed = true;
    window.ORGAVOX_VERSION = LABEL;
    installStyles();
    patchPlayState();
    patchRender();
    installArrowKeys();
    installEditableTime();
    installTimelineDeselect();
    refresh();
    [150, 450, 900, 1600, 2600].forEach((delay) => setTimeout(refresh, delay));
  }

  function safe(fn) {
    try { fn(); }
    catch (error) { console.warn("ORGAVOX v0.59 skipped one safe step", error); }
  }

  function refresh() {
    safe(markVersion);
    safe(relabelSnip);
    safe(rewriteSnapDropdown);
    safe(addMarkerButtons);
    safe(addTrackInfoButtons);
    safe(orderToolbar);
    safe(addControlDividers);
    safe(addRandomizeTrackColors);
    safe(addRealCutCommand);
    safe(moveBounceToView);
    safe(patchNudgeButtons);
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes orgavoxV059PlayPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 1px rgba(117,178,222,.35),0 0 14px rgba(75,155,255,.28)}50%{transform:scale(1.14);box-shadow:0 0 0 2px rgba(168,220,255,.8),0 0 32px rgba(75,155,255,.76),0 0 48px rgba(117,178,222,.35)}}
      body.simple-edit-phase1 #playBtn.orgavox-playing,body.simple-edit-phase1 #playBtn.orgavox-v059-playing{animation:orgavoxV059PlayPulse .78s ease-in-out infinite!important;transform-origin:center!important;z-index:5!important}
      body.simple-edit-phase1 .track-lane.selected-track{box-shadow:inset 0 0 0 3px rgba(117,216,255,.96),inset 6px 0 rgba(117,216,255,1),0 0 28px rgba(117,216,255,.24)!important;background-color:rgba(75,155,255,.17)!important}
      body.simple-edit-phase1 .audio-clip:not(.selected):not(.orgavox-multi-selected){outline:0!important;box-shadow:0 4px 12px rgba(0,0,0,.35)!important;background:linear-gradient(180deg,rgba(75,132,191,.45),rgba(38,97,92,.4))!important;color:#fff!important}
      .orgavox-v059-marker-step{min-width:34px!important;width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;border-color:rgba(178,109,255,.9)!important;background:linear-gradient(180deg,rgba(106,60,190,.94),rgba(53,27,108,.96))!important;color:#f3e2ff!important;box-shadow:0 0 0 1px rgba(178,109,255,.24),0 0 14px rgba(130,78,220,.22)!important}
      .orgavox-v059-info{min-width:24px!important;width:24px!important;height:22px!important;min-height:22px!important;padding:0!important;border:1px solid rgba(74,190,117,.9)!important;border-radius:7px!important;background:linear-gradient(180deg,rgba(34,126,66,.95),rgba(12,58,31,.98))!important;color:#e4ffed!important;font:900 .58rem var(--font-mono)!important;box-shadow:0 0 10px rgba(74,190,117,.24)!important}
      #snapGridSelect,.orgavox-snap-grid-select{background:#050606!important;color:#dff5ff!important;border-color:rgba(117,178,222,.75)!important}
      .orgavox-v059-divider{width:1px!important;align-self:center!important;min-height:34px!important;margin:0 4px!important;background:linear-gradient(180deg,transparent,rgba(224,163,96,.78),transparent)!important;display:inline-flex!important;flex:0 0 1px!important}
      body.simple-edit-phase1 .time-readout{cursor:text!important;user-select:text!important}
      body.simple-edit-phase1 .time-readout[contenteditable="true"]{outline:2px solid rgba(117,178,222,.65)!important;background:rgba(0,0,0,.58)!important;box-shadow:0 0 18px rgba(117,178,222,.28)!important}
      body.simple-edit-phase1 .simple-edit-version{color:#8cffd5!important}
      .orgavox-v059-live-tag{position:fixed;right:12px;bottom:12px;z-index:99998;padding:7px 10px;border:1px solid rgba(140,255,213,.55);border-radius:999px;background:rgba(0,0,0,.72);color:#8cffd5;font:900 11px var(--font-mono);letter-spacing:.08em;pointer-events:none;box-shadow:0 0 18px rgba(140,255,213,.18)}
    `;
    document.head.appendChild(style);
  }

  function markVersion() {
    document.title = "Organon — ORGAVOX " + LABEL;
    let badge = document.querySelector(".simple-edit-version,.phase1-version");
    const title = document.querySelector(".brand h1");
    if (title && !badge) {
      badge = document.createElement("span");
      badge.className = "simple-edit-version phase1-version";
      title.appendChild(badge);
    }
    if (badge) badge.textContent = LABEL;
    let tag = document.getElementById("orgavoxV059LiveTag");
    if (!tag) {
      tag = document.createElement("div");
      tag.id = "orgavoxV059LiveTag";
      tag.className = "orgavox-v059-live-tag";
      document.body.appendChild(tag);
    }
    tag.textContent = LABEL + " loaded";
    if (ui.statusPill && /ready/i.test(ui.statusPill.textContent || "")) ui.statusPill.textContent = "Ready — " + LABEL;
  }

  function relabelSnip() {
    if (!ui.scissorsBtn) return;
    ui.scissorsBtn.textContent = "✂️ Snip";
    ui.scissorsBtn.title = "Snip/split selected clip at the playhead";
  }

  function patchPlayState() {
    if (window.__orgavoxV059PlayPatch) return;
    window.__orgavoxV059PlayPatch = true;
    const oldStart = startPlayback;
    startPlayback = async function orgavoxV059StartPlayback() {
      const result = await oldStart.apply(this, arguments);
      ui.playBtn?.classList.add("orgavox-v059-playing");
      return result;
    };
    const oldStop = stopPlayback;
    stopPlayback = function orgavoxV059StopPlayback() {
      const result = oldStop.apply(this, arguments);
      ui.playBtn?.classList.remove("orgavox-v059-playing");
      return result;
    };
  }

  function currentSnap() {
    const select = ui.snapGridSelect || document.getElementById("snapGridSelect");
    const value = Number(select?.value);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function rewriteSnapDropdown() {
    const select = ui.snapGridSelect || document.getElementById("snapGridSelect");
    if (!select) return;
    if (select.dataset.orgavoxV059Snap !== "true") {
      select.innerHTML = "";
      SNAP_SECONDS.forEach((seconds) => {
        const option = document.createElement("option");
        option.value = String(seconds);
        option.textContent = String(seconds);
        if (seconds === 1) option.selected = true;
        select.appendChild(option);
      });
      select.dataset.orgavoxV059Snap = "true";
    }
    select.classList.add("orgavox-snap-grid-select");
  }

  function selectedClips() {
    const ids = Array.isArray(state.selectedClipIds) && state.selectedClipIds.length ? state.selectedClipIds : [state.selectedClipId].filter(Boolean);
    return ids.map((id) => state.clips.find((clip) => clip.id === id)).filter(Boolean);
  }

  function moveSelectedClips(delta) {
    const clips = selectedClips();
    if (!clips.length) return false;
    stopPlayback();
    clips.forEach((clip) => { clip.start = Math.max(0, (Number(clip.start) || 0) + delta); invalidateClip?.(clip); });
    renderTimeline();
    syncSelectedControls();
    window.orgavoxRecordHistory?.();
    return true;
  }

  function patchNudgeButtons() {
    [[ui.nudgeLeftBtn, -1], [ui.nudgeRightBtn, 1]].forEach(([button, direction]) => {
      if (!button || button.dataset.orgavoxV059Nudge === "true") return;
      button.dataset.orgavoxV059Nudge = "true";
      button.addEventListener("click", (event) => {
        if (!moveSelectedClips(direction * currentSnap())) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
    });
  }

  function installArrowKeys() {
    if (window.__orgavoxV059ArrowKeys) return;
    window.__orgavoxV059ArrowKeys = true;
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable);
      if (typing || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const amount = event.shiftKey ? 1 : (event.ctrlKey || event.metaKey ? 0.1 : 0.01);
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      setPlayhead(Math.max(0, (Number(state.playhead) || 0) + direction * amount), true);
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
    const readout = ui.timeReadout || document.getElementById("timeReadout");
    if (!readout || readout.dataset.orgavoxV059Time === "true") return;
    readout.dataset.orgavoxV059Time = "true";
    readout.addEventListener("click", () => { readout.contentEditable = "true"; readout.focus(); document.execCommand?.("selectAll", false, null); });
    readout.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); readout.blur(); }
      if (event.key === "Escape") { event.preventDefault(); readout.contentEditable = "false"; setPlayhead(state.playhead, false); }
    });
    readout.addEventListener("blur", () => {
      if (readout.contentEditable !== "true") return;
      const seconds = parseTime(readout.textContent);
      readout.contentEditable = "false";
      setPlayhead(seconds !== null ? Math.max(0, seconds) : state.playhead, true);
    });
  }

  function markerTimes() {
    return (Array.isArray(state.markers) ? state.markers : []).map((marker) => Number(marker.time)).filter(Number.isFinite).sort((a, b) => a - b);
  }

  function jumpMarker(direction) {
    const times = markerTimes();
    if (!times.length) return showToast?.("No markers yet.");
    const now = Number(state.playhead) || 0;
    const target = direction < 0 ? [...times].reverse().find((time) => time < now - 0.001) ?? times[times.length - 1] : times.find((time) => time > now + 0.001) ?? times[0];
    setPlayhead(target, true);
  }

  function makeMarkerButton(id, label, direction) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "tool-button orgavox-v059-marker-step";
      button.addEventListener("click", () => jumpMarker(direction));
    }
    button.textContent = label;
    button.title = direction < 0 ? "Previous marker" : "Next marker";
    return button;
  }

  function addMarkerButtons() {
    const marker = ui.markersBtn || document.getElementById("markersBtn");
    if (!marker || !marker.parentElement) return;
    const prev = makeMarkerButton("orgavoxPrevMarkerBtn", "◀", -1);
    const next = makeMarkerButton("orgavoxNextMarkerBtn", "▶", 1);
    if (marker.previousElementSibling !== prev) marker.parentElement.insertBefore(prev, marker);
    if (marker.nextElementSibling !== next) marker.insertAdjacentElement("afterend", next);
  }

  function addTrackInfoButtons() {
    document.querySelectorAll(".track-label").forEach((label) => {
      const track = Number(label.dataset.trackLabel);
      if (!Number.isFinite(track) || label.querySelector(".orgavox-v059-info")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "orgavox-v059-info";
      button.textContent = "i";
      button.title = `Analyze Track ${track + 1}`;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectTrack?.(track);
        const clip = state.clips.find((item) => item.track === track);
        if (clip) selectClip?.(clip.id);
        const modal = document.getElementById("analysisModal");
        if (modal) {
          modal.hidden = false;
          showToast?.(`Analyzing Track ${track + 1}.`);
          setTimeout(() => modal.querySelector("[data-analysis-scan]")?.click(), 0);
        } else showToast?.("Analyze screen is still loading.");
      });
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
    const nudgeRight = ui.nudgeRightBtn || document.getElementById("nudgeRightBtn");
    const snap = ui.snapBtn || document.getElementById("snapBtn");
    const snapSelect = ui.snapGridSelect || document.getElementById("snapGridSelect");
    if (nudgeRight && snap) nudgeRight.insertAdjacentElement("afterend", snap);
    if (snap && snapSelect) snap.insertAdjacentElement("afterend", snapSelect);
  }

  function addControlDividers() {
    const main = document.querySelector(".orgavox-main-controls-group");
    if (!main || main.dataset.orgavoxV059Dividers === "true") return;
    main.dataset.orgavoxV059Dividers = "true";
    Array.from(main.children).forEach((child) => {
      if (child.matches?.(".range-control,.orgavox-global-volume-control")) {
        const before = document.createElement("span");
        before.className = "orgavox-v059-divider";
        const after = document.createElement("span");
        after.className = "orgavox-v059-divider";
        child.insertAdjacentElement("beforebegin", before);
        child.insertAdjacentElement("afterend", after);
      }
    });
  }

  function addRandomizeTrackColors() {
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
      showToast?.("Track colors randomized.");
    });
    panel.appendChild(button);
  }

  function moveBounceToView() {
    const panel = document.querySelector("#orgavoxViewDropdown .orgavox-view-menu");
    const bounce = ui.bounceBtn || document.getElementById("bounceBtn");
    if (!panel || !bounce) return;
    bounce.textContent = "🧱 Bounce Track";
    bounce.title = "Bounce/render selected track or clip";
    if (bounce.parentElement !== panel) panel.appendChild(bounce);
  }

  function addRealCutCommand() {
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
      if (!clips.length) return showToast?.("Select a clip to cut.");
      stopPlayback();
      state.__orgavoxClipClipboard = clips.length === 1 ? { ...clips[0], id: clips[0].id } : clips.map((clip) => ({ ...clip, id: clip.id }));
      state.clips = state.clips.filter((clip) => !clips.includes(clip));
      state.selectedClipId = null;
      state.selectedClipIds = [];
      syncSelectedControls();
      renderTimeline();
      window.orgavoxRecordHistory?.();
      showToast?.(clips.length === 1 ? "Clip cut." : `${clips.length} clips cut.`);
    });
    const copy = document.getElementById("orgavoxCopyClipBtn");
    if (copy && copy.parentElement === panel) copy.insertAdjacentElement("afterend", button);
    else panel.appendChild(button);
  }

  function installTimelineDeselect() {
    if (window.__orgavoxV059Deselect) return;
    window.__orgavoxV059Deselect = true;
    document.addEventListener("click", (event) => {
      if (event.target.closest(".audio-clip")) return;
      if (!event.target.closest(".timeline-scroll,.track-lane,.tracks")) return;
      state.selectedClipId = null;
      state.selectedClipIds = [];
      document.querySelectorAll(".audio-clip.selected,.audio-clip.orgavox-multi-selected").forEach((node) => node.classList.remove("selected", "orgavox-multi-selected"));
      syncSelectedControls();
    }, true);
  }

  function patchRender() {
    if (window.__orgavoxV059Render) return;
    window.__orgavoxV059Render = true;
    const oldRender = renderTimeline;
    renderTimeline = function orgavoxV059RenderTimeline() {
      const result = oldRender.apply(this, arguments);
      setTimeout(refresh, 0);
      return result;
    };
  }

  boot();
})();
