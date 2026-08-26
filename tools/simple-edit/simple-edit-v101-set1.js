"use strict";

(function installOrgavoxV101Set1() {
  const VERSION = "v1.01 set 1";
  const TITLE = `Organon — ORGAVOX ${VERSION}`;
  const STYLE_ID = "orgavox-v101-set1-style";
  let tries = 0;
  let lastArrowAt = 0;
  let lastArrowKey = "";

  function ready() {
    return typeof ui !== "undefined"
      && typeof state !== "undefined"
      && typeof renderTimeline === "function"
      && typeof syncSelectedControls === "function"
      && typeof setPlayhead === "function";
  }

  function boot() {
    forceVersion();
    installStyles();
    if (!ready()) {
      tries += 1;
      if (tries < 220) setTimeout(boot, 50);
      return;
    }
    install();
  }

  function forceVersion() {
    try { document.title = TITLE; } catch {}
    window.ORGAVOX_VERSION = VERSION;
    document.querySelectorAll(".simple-edit-version,.phase1-version,.orgavox-sidebar-version").forEach((node) => { node.textContent = VERSION; });
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 #scissorsBtn{border-color:rgba(220,72,64,.76)!important;color:#ffd8d2!important}
      body.simple-edit-phase1 .audio-clip:not(.selected):not(.orgavox-multi-selected){outline:none!important;box-shadow:0 5px 16px rgba(0,0,0,.42)!important}
      body.simple-edit-phase1 .audio-clip.orgavox-v101-cleared{outline:none!important;box-shadow:0 5px 16px rgba(0,0,0,.42)!important;background-image:none!important;filter:none!important}
      body.simple-edit-phase1 .track-lane.selected-track{background:linear-gradient(90deg,rgba(80,172,255,.24),rgba(117,178,222,.12))!important;box-shadow:inset 0 0 0 2px rgba(117,178,222,.72),inset 0 0 28px rgba(75,155,255,.28)!important}
      body.simple-edit-phase1 #playBtn.orgavox-playing{animation:orgavoxV101PlayPulse .72s ease-in-out infinite alternate!important;box-shadow:0 0 0 1px rgba(117,178,222,.7),0 0 28px rgba(75,155,255,.72)!important}
      @keyframes orgavoxV101PlayPulse{from{transform:scale(1);filter:brightness(1)}to{transform:scale(1.16);filter:brightness(1.35)}}
      body.simple-edit-phase1 #snapGridSelect{background:#050505!important;color:#f5f0db!important;border-color:rgba(117,178,222,.72)!important;box-shadow:0 0 0 1px rgba(117,178,222,.16)!important}
      body.simple-edit-phase1 #snapGridSelect option{background:#050505!important;color:#f5f0db!important}
      body.simple-edit-phase1 .orgavox-v101-divider{display:inline-flex!important;width:1px!important;min-width:1px!important;align-self:stretch!important;min-height:34px!important;margin:0 6px!important;background:linear-gradient(180deg,transparent,rgba(224,163,96,.58),transparent)!important;pointer-events:none!important}
      .orgavox-v101-number-pop{position:fixed;z-index:999999;min-width:118px;padding:8px;border:1px solid rgba(224,163,96,.72);border-radius:12px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);display:grid;gap:6px}
      .orgavox-v101-number-pop label{color:rgba(245,240,219,.72);font:800 .56rem var(--font-mono);text-transform:uppercase;letter-spacing:.08em}
      .orgavox-v101-number-pop input{height:34px;border:1px solid rgba(117,178,222,.64);border-radius:9px;background:#050505;color:#f5f0db;padding:0 9px;font:900 .78rem var(--font-mono);outline:none}
      .orgavox-v101-number-pop small{color:rgba(245,240,219,.5);font:700 .55rem var(--font-mono)}
      body.simple-edit-phase1 .time-readout,body.simple-edit-phase1 output,body.simple-edit-phase1 .orgavox-track-volume-overlay{cursor:pointer!important}
      body.simple-edit-phase1 .orgavox-cut-clip-btn{border-color:rgba(220,72,64,.78)!important;background:linear-gradient(180deg,rgba(92,28,23,.88),rgba(39,13,10,.96))!important;color:#ffd8d2!important}
    `;
    document.head.appendChild(style);
  }

  function tip(button, text) {
    if (!button || !text) return;
    button.title = text;
    button.setAttribute("aria-label", text);
  }

  function insertAfter(anchor, node) {
    if (!anchor || !anchor.parentElement || !node) return;
    if (anchor.nextSibling !== node) anchor.parentElement.insertBefore(node, anchor.nextSibling);
  }

  function secondsFromTimeText(value) {
    const text = String(value || "").trim().replace(",", ".");
    if (!text) return null;
    if (/^\d+(\.\d+)?$/.test(text)) return Math.max(0, Number(text));
    const parts = text.split(":").map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
    if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
    return null;
  }

  function currentSnap() {
    const select = ui.snapGridSelect || document.getElementById("snapGridSelect");
    const value = Number(select?.value);
    return Number.isFinite(value) && value > 0 ? value : 0.01;
  }

  function selectedClipIds() {
    const ids = Array.isArray(state.selectedClipIds) && state.selectedClipIds.length ? state.selectedClipIds.slice() : (state.selectedClipId ? [state.selectedClipId] : []);
    return ids.filter((id) => state.clips?.some((clip) => clip.id === id));
  }

  function deepClip(clip) {
    return {
      ...clip,
      volumeKeyframes: Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes.map((item) => ({ ...item })) : []
    };
  }

  function relabelSnip() {
    const button = ui.scissorsBtn || document.getElementById("scissorsBtn");
    if (!button) return;
    button.textContent = "✂️ Snip";
    tip(button, "Snip/split the selected clip at the playhead");
  }

  function ensureTrueCut() {
    const panel = document.querySelector("#orgavoxEditDropdown .orgavox-edit-menu");
    if (!panel) return;
    const copy = document.getElementById("orgavoxCopyClipBtn");
    let cut = document.getElementById("orgavoxTrueCutClipBtn");
    if (!cut) {
      cut = document.createElement("button");
      cut.id = "orgavoxTrueCutClipBtn";
      cut.type = "button";
      cut.className = "tool-button orgavox-cut-clip-btn";
      cut.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        trueCut();
        const menu = cut.closest(".orgavox-edit-menu");
        if (menu) menu.hidden = true;
      });
    }
    cut.textContent = "✂ Cut";
    tip(cut, "Remove selected clip(s) and store them for Paste");
    if (copy?.parentElement === panel) insertAfter(copy, cut);
    else if (cut.parentElement !== panel) panel.appendChild(cut);

    const paste = document.getElementById("orgavoxPasteClipBtn");
    if (paste && paste.dataset.orgavoxV101Paste !== "true") {
      paste.dataset.orgavoxV101Paste = "true";
      paste.addEventListener("click", (event) => {
        const board = state.__orgavoxClipClipboard;
        if (!board || board.kind !== "multi") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        pasteClipboard();
        const menu = paste.closest(".orgavox-edit-menu");
        if (menu) menu.hidden = true;
      }, true);
    }
  }

  function trueCut() {
    const ids = selectedClipIds();
    if (!ids.length) return showToast("Select a clip to cut.");
    const clips = state.clips.filter((clip) => ids.includes(clip.id)).sort((a, b) => a.track - b.track || a.start - b.start).map(deepClip);
    const minStart = Math.min(...clips.map((clip) => Number(clip.start) || 0));
    const minTrack = Math.min(...clips.map((clip) => Number(clip.track) || 0));
    state.__orgavoxClipClipboard = { kind: "multi", clips, minStart, minTrack };
    state.clips = state.clips.filter((clip) => !ids.includes(clip.id));
    state.selectedClipId = null;
    state.selectedClipIds = [];
    syncSelectedControls();
    renderTimeline();
    window.orgavoxRecordHistory?.();
    showToast(ids.length === 1 ? "Clip cut." : `${ids.length} clips cut.`);
  }

  function pasteClipboard() {
    const board = state.__orgavoxClipClipboard;
    if (!board || board.kind !== "multi" || !Array.isArray(board.clips)) return showToast("No cut clips to paste.");
    const start = Math.max(0, Number(state.playhead) || 0);
    const trackBase = Math.max(0, Math.min(9, Number(state.selectedTrack) || 0));
    const newIds = [];
    board.clips.forEach((clip) => {
      const next = deepClip(clip);
      next.id = typeof makeId === "function" ? makeId("clip") : `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      next.start = Math.max(0, start + ((Number(clip.start) || 0) - board.minStart));
      next.track = Math.max(0, Math.min(9, trackBase + ((Number(clip.track) || 0) - board.minTrack)));
      next.cacheVersion = 0;
      if (Array.isArray(next.volumeKeyframes)) next.volumeKeyframes = next.volumeKeyframes.map((kf) => ({ ...kf, id: typeof makeId === "function" ? makeId("kf") : `kf-${Date.now()}-${Math.random().toString(36).slice(2)}` }));
      state.clips.push(next);
      newIds.push(next.id);
    });
    state.selectedClipIds = newIds;
    state.selectedClipId = newIds[newIds.length - 1] || null;
    renderTimeline();
    syncSelectedControls();
    window.orgavoxRecordHistory?.();
    showToast(newIds.length === 1 ? "Cut clip pasted." : `${newIds.length} cut clips pasted.`);
  }

  function ensureMenuOrder() {
    const group = document.querySelector(".orgavox-edit-group");
    if (!group) return;
    const edit = document.getElementById("orgavoxEditDropdown");
    const view = document.getElementById("orgavoxViewDropdown");
    const effects = group.querySelector(".orgavox-effects-dropdown") || document.querySelector(".orgavox-effects-dropdown");
    const marker = ui.markersBtn || document.getElementById("markersBtn");
    const nudgeLeft = ui.nudgeLeftBtn || document.getElementById("nudgeLeftBtn");
    const nudgeRight = ui.nudgeRightBtn || document.getElementById("nudgeRightBtn");
    const snap = ui.snapBtn || document.getElementById("snapGridBtn");
    const snapGrid = ui.snapGridSelect || document.getElementById("snapGridSelect");
    const redo = ui.redoBtn || document.getElementById("redoBtn");
    let anchor = redo?.parentElement === group ? redo : null;
    [edit, view, effects, marker, nudgeLeft, nudgeRight, snap, snapGrid].filter(Boolean).forEach((node) => {
      if (anchor) insertAfter(anchor, node);
      else if (node.parentElement !== group) group.insertBefore(node, group.firstChild);
      anchor = node;
    });
  }

  function ensureSnapOptions() {
    const select = ui.snapGridSelect || document.getElementById("snapGridSelect");
    if (!select) return;
    const values = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
    const current = Number(select.value) || 0.1;
    if (select.dataset.orgavoxV101Options !== "true") {
      select.innerHTML = "";
      values.forEach((value) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        select.appendChild(option);
      });
      select.value = String(values.includes(current) ? current : 0.1);
      select.dataset.orgavoxV101Options = "true";
    }
  }

  function installNudgeOverride() {
    const left = ui.nudgeLeftBtn || document.getElementById("nudgeLeftBtn");
    const right = ui.nudgeRightBtn || document.getElementById("nudgeRightBtn");
    [[left, -1], [right, 1]].forEach(([button, direction]) => {
      if (!button || button.dataset.orgavoxV101Nudge === "true") return;
      button.dataset.orgavoxV101Nudge = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        nudgeSelection(direction * currentSnap());
      }, true);
    });
  }

  function nudgeSelection(amount) {
    const ids = selectedClipIds();
    if (!ids.length) {
      setPlayhead(Math.max(0, (Number(state.playhead) || 0) + amount), true);
      return;
    }
    state.clips.forEach((clip) => {
      if (ids.includes(clip.id)) clip.start = Math.max(0, (Number(clip.start) || 0) + amount);
    });
    renderTimeline();
    syncSelectedControls();
    window.orgavoxRecordHistory?.();
    showToast(`${ids.length} clip${ids.length === 1 ? "" : "s"} nudged ${Math.abs(amount)}s.`);
  }

  function installArrowCorrection() {
    if (window.__orgavoxV101ArrowCorrection) return;
    window.__orgavoxV101ArrowCorrection = true;
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable);
      if (typing || event.defaultPrevented || event.altKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      setTimeout(() => {
        const now = Date.now();
        const oldStep = event.shiftKey ? 10 : (event.ctrlKey || event.metaKey ? 1 : 0.1);
        const newStep = event.shiftKey ? 1 : (event.ctrlKey || event.metaKey ? 0.1 : 0.01);
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        if (lastArrowKey === event.key && now - lastArrowAt < 10) return;
        lastArrowAt = now;
        lastArrowKey = event.key;
        setPlayhead(Math.max(0, (Number(state.playhead) || 0) + direction * (newStep - oldStep)), true);
      }, 0);
    }, true);
  }

  function clearSelectionVisuals() {
    document.querySelectorAll(".audio-clip").forEach((element) => {
      const selected = element.dataset.clipId && (element.dataset.clipId === state.selectedClipId || selectedClipIds().includes(element.dataset.clipId));
      element.classList.toggle("orgavox-v101-cleared", !selected);
      if (!selected) {
        element.classList.remove("selected", "orgavox-multi-selected");
      }
    });
  }

  function installDeselect() {
    if (window.__orgavoxV101Deselect) return;
    window.__orgavoxV101Deselect = true;
    document.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (!target) return;
      if (target.closest?.(".audio-clip,.clip-handle,.orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu,.popover,.modal-backdrop,button,input,select,textarea")) return;
      if (!target.closest?.(".timeline-scroll,.timeline-panel,.workspace,.app")) return;
      if (!state.selectedClipId && !(Array.isArray(state.selectedClipIds) && state.selectedClipIds.length)) return;
      state.selectedClipId = null;
      state.selectedClipIds = [];
      syncSelectedControls();
      clearSelectionVisuals();
    }, true);
  }

  function showNumberPopup(anchor, label, value, onApply, note = "Enter to apply") {
    document.querySelectorAll(".orgavox-v101-number-pop").forEach((node) => node.remove());
    const rect = anchor.getBoundingClientRect();
    const pop = document.createElement("div");
    pop.className = "orgavox-v101-number-pop";
    pop.innerHTML = `<label></label><input type="text" inputmode="decimal"><small></small>`;
    pop.querySelector("label").textContent = label;
    const input = pop.querySelector("input");
    const small = pop.querySelector("small");
    input.value = String(value ?? "");
    small.textContent = note;
    document.body.appendChild(pop);
    const left = Math.min(window.innerWidth - 140, Math.max(8, rect.left));
    const top = Math.min(window.innerHeight - 90, Math.max(8, rect.bottom + 8));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    input.focus();
    input.select();
    function close() { pop.remove(); document.removeEventListener("pointerdown", outside, true); }
    function apply() {
      const raw = input.value.trim();
      const value = Number(raw.replace(",", "."));
      if (!Number.isFinite(value)) return;
      onApply(value, raw);
      close();
    }
    function outside(event) { if (!pop.contains(event.target) && event.target !== anchor) close(); }
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); apply(); }
      if (event.key === "Escape") { event.preventDefault(); close(); }
    });
    setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
  }

  function installEditableTime() {
    const readout = ui.timeReadout || document.getElementById("timeReadout");
    if (!readout || readout.dataset.orgavoxV101Time === "true") return;
    readout.dataset.orgavoxV101Time = "true";
    tip(readout, "Click to type a time, such as 12.5 or 1:23.400");
    readout.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showNumberPopup(readout, "Go to time", readout.textContent || "0", (_num, raw) => {
        const seconds = secondsFromTimeText(raw);
        if (seconds == null) return;
        setPlayhead(seconds, true);
      }, "Use seconds or mm:ss");
    });
  }

  function installValuePopups() {
    document.querySelectorAll(".topbar output,.clip-controls output").forEach((output) => {
      if (output.dataset.orgavoxV101Value === "true") return;
      const control = output.closest(".range-control");
      const input = control?.querySelector("input[type='range']");
      if (!input) return;
      output.dataset.orgavoxV101Value = "true";
      output.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const label = control.querySelector("span")?.textContent || "Value";
        const current = output.textContent?.replace(/[^0-9.,-]/g, "") || input.value;
        showNumberPopup(output, label, current, (value) => {
          input.value = String(Math.max(Number(input.min || value), Math.min(Number(input.max || value), value)));
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });
    });

    document.querySelectorAll(".orgavox-track-volume-overlay").forEach((overlay) => {
      if (overlay.dataset.orgavoxV101TrackVol === "true") return;
      overlay.dataset.orgavoxV101TrackVol = "true";
      overlay.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const lane = overlay.closest(".track-lane");
        const track = Math.max(0, Math.min(9, Number(lane?.dataset.track) || 0));
        if (!Array.isArray(state.trackSettings)) state.trackSettings = [];
        if (!state.trackSettings[track]) state.trackSettings[track] = {};
        const current = Number.isFinite(Number(state.trackSettings[track].volume)) ? Number(state.trackSettings[track].volume) : 100;
        showNumberPopup(overlay, `Track ${track + 1} volume`, current, (value) => {
          state.trackSettings[track].volume = Math.max(0, Math.min(200, Math.round(value)));
          renderTimeline();
          window.orgavoxRefreshTrackTools?.();
        }, "0–200");
      });
    });
  }

  function ensureSingleDividers() {
    document.querySelectorAll(".orgavox-v101-divider").forEach((node) => node.remove());
    const controls = [...document.querySelectorAll(".topbar .range-control,.clip-controls .range-control")].filter((control) => {
      const text = control.querySelector("span")?.textContent?.toLowerCase() || "";
      return /master|volume|echo/.test(text);
    });
    controls.forEach((control) => {
      const before = document.createElement("span");
      before.className = "orgavox-v101-divider";
      const after = document.createElement("span");
      after.className = "orgavox-v101-divider";
      control.insertAdjacentElement("beforebegin", before);
      control.insertAdjacentElement("afterend", after);
    });
  }

  function updatePlayState() {
    const playing = !!(state.isPlaying || state.playing || window.__orgavoxIsPlaying);
    const button = ui.playBtn || document.getElementById("playBtn");
    if (button) button.classList.toggle("orgavox-playing", playing || button.textContent.includes("⏸"));
  }

  function patchRenderRefresh() {
    if (window.__orgavoxV101RenderRefresh) return;
    window.__orgavoxV101RenderRefresh = true;
    const previousRender = renderTimeline;
    renderTimeline = function orgavoxV101RenderTimeline() {
      const result = previousRender.apply(this, arguments);
      setTimeout(refresh, 0);
      return result;
    };
    if (typeof syncSelectedControls === "function") {
      const previousSync = syncSelectedControls;
      syncSelectedControls = function orgavoxV101SyncSelectedControls() {
        const result = previousSync.apply(this, arguments);
        setTimeout(refresh, 0);
        return result;
      };
    }
  }

  function refresh() {
    forceVersion();
    relabelSnip();
    ensureTrueCut();
    ensureMenuOrder();
    ensureSnapOptions();
    installNudgeOverride();
    installEditableTime();
    installValuePopups();
    ensureSingleDividers();
    clearSelectionVisuals();
    updatePlayState();
  }

  function install() {
    installStyles();
    patchRenderRefresh();
    installDeselect();
    installArrowCorrection();
    refresh();
    [0, 150, 500, 1200, 2500].forEach((delay) => setTimeout(refresh, delay));
    setInterval(() => { forceVersion(); updatePlayState(); }, 350);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
