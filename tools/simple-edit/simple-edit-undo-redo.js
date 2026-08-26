"use strict";

(function installOrgavoxUndoRedo() {
  const HISTORY_MODAL_ID = "orgavoxUndoHistoryModal";
  const STYLE_ID = "orgavoxUndoRedoStyles";
  const LIMIT = 80;
  let undoStack = [];
  let redoStack = [];
  let last = null;
  let lastSig = "";
  let restoring = false;
  let recordTimer = 0;
  let pendingLabel = "";

  function clone(value) {
    if (value == null || typeof value !== "object") return value;
    if (typeof AudioBuffer !== "undefined" && value instanceof AudioBuffer) return value;
    if (value.getChannelData && value.sampleRate && value.numberOfChannels) return value;
    if (value instanceof Float32Array || value instanceof File || value instanceof Blob) return value;
    if (Array.isArray(value)) return value.map(clone);
    const output = {};
    Object.entries(value).forEach(([key, next]) => { if (key !== "renderCache") output[key] = clone(next); });
    return output;
  }

  function cleanLabel(value) {
    return String(value || "")
      .replace(/[▥↔↗↘✕⚖🎼🎚🔥📊🧊🎧↩✂️🗑📥💾📁⏮▶■⛶↶↷✎👁🏷◀→←🧲⧉🧹📈▏🎨▣▢⬇🧱🔊]/gu, "")
      .replace(/\s+/g, " ")
      .replace(/\s*▾\s*$/g, "")
      .trim();
  }

  function setPendingLabel(label) {
    const cleaned = cleanLabel(label);
    if (cleaned) pendingLabel = cleaned.slice(0, 80);
  }

  function consumePendingLabel() {
    const label = pendingLabel;
    pendingLabel = "";
    return label;
  }

  function buttonLabel(button) {
    if (!button) return "";
    return button.getAttribute("title") || button.getAttribute("aria-label") || button.dataset.historyLabel || button.textContent || "";
  }

  function installActionLabelCapture() {
    if (window.__orgavoxUndoActionLabelCapture) return;
    window.__orgavoxUndoActionLabelCapture = true;
    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("button");
      if (!button) return;
      if (button.matches("[data-history-close],[data-echo-close],[data-bounce-close],[data-download-close]")) return;
      const label = buttonLabel(button);
      if (label) setPendingLabel(label);
    }, true);
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-history-modal{position:fixed!important;inset:0!important;z-index:999998!important;display:grid!important;place-items:center!important;padding:24px!important;background:rgba(0,0,0,.58)!important}
      .orgavox-history-modal[hidden]{display:none!important}
      .orgavox-history-dialog{width:min(620px,calc(100vw - 40px))!important;max-height:min(620px,calc(100vh - 40px))!important;display:flex!important;flex-direction:column!important;gap:12px!important;padding:16px!important;border:1px solid rgba(224,163,96,.72)!important;border-radius:18px!important;background:linear-gradient(180deg,rgba(24,25,24,.98),rgba(10,11,10,.99))!important;box-shadow:0 22px 64px rgba(0,0,0,.76)!important;color:#f5f0db!important}
      .orgavox-history-list{display:grid!important;gap:8px!important;overflow:auto!important;min-height:96px!important;padding-right:4px!important}
      .orgavox-history-row{display:grid!important;grid-template-columns:1fr auto auto!important;align-items:center!important;gap:10px!important;width:100%!important;padding:8px 10px!important;border:1px solid rgba(224,163,96,.34)!important;border-radius:12px!important;background:rgba(0,0,0,.28)!important;color:#f5f0db!important;text-align:left!important;cursor:pointer!important}
      .orgavox-history-row:hover{border-color:rgba(117,178,222,.76)!important;background:rgba(117,178,222,.1)!important}
      .orgavox-history-row strong{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .orgavox-history-row span{color:#75b2de!important;font:900 .64rem var(--font-mono,monospace)!important}
      .orgavox-history-row small{color:rgba(245,240,219,.58)!important;font:800 .58rem var(--font-mono,monospace)!important}
    `;
    document.head.appendChild(style);
  }

  function snap() {
    return {
      assets: state.assets.map(clone),
      clips: state.clips.map(clone),
      markers: Array.isArray(state.markers) ? state.markers.map(clone) : [],
      beatMarkers: Array.isArray(state.beatMarkers) ? state.beatMarkers.map(clone) : [],
      trackSettings: Array.isArray(state.trackSettings) ? state.trackSettings.map(clone) : [],
      selectedAssetId: state.selectedAssetId,
      selectedClipId: state.selectedClipId,
      selectedClipIds: Array.isArray(state.selectedClipIds) ? state.selectedClipIds.slice() : [],
      selectedTrack: state.selectedTrack,
      pixelsPerSecond: state.pixelsPerSecond,
      playhead: state.playhead,
      stretchMode: Boolean(state.stretchMode),
      globalVolume: Number(state.globalVolume ?? 100),
      expandedTrack: typeof state.expandedTrack === "number" ? state.expandedTrack : null
    };
  }

  function signature(saved) {
    return JSON.stringify(saved, (key, value) => ["buffer", "bufferOverride", "file", "peaks", "renderCache", "activeSources", "raf", "toastTimer", "clipDrag", "__historyTime", "__historyLabel"].includes(key) ? undefined : value);
  }

  function changedTrackCount(before, after) {
    const a = before.trackSettings || [];
    const b = after.trackSettings || [];
    let count = 0;
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      if (JSON.stringify(a[index] || null) !== JSON.stringify(b[index] || null)) count += 1;
    }
    return count;
  }

  function describeChange(before, after) {
    const assetDelta = (after.assets?.length || 0) - (before.assets?.length || 0);
    const clipDelta = (after.clips?.length || 0) - (before.clips?.length || 0);
    const markerDelta = (after.markers?.length || 0) - (before.markers?.length || 0);
    const beatDelta = (after.beatMarkers?.length || 0) - (before.beatMarkers?.length || 0);
    const trackDelta = changedTrackCount(before, after);
    if (assetDelta > 0 && clipDelta === 0) return assetDelta === 1 ? "Added sound to library" : `Added ${assetDelta} sounds to library`;
    if (assetDelta > 0 && clipDelta > 0) return "Imported audio";
    if (clipDelta > 0) return clipDelta === 1 ? "Added or pasted clip" : `Added or pasted ${clipDelta} clips`;
    if (clipDelta < 0) return clipDelta === -1 ? "Removed clip" : `Removed ${Math.abs(clipDelta)} clips`;
    if (markerDelta > 0) return markerDelta === 1 ? "Added marker" : `Added ${markerDelta} markers`;
    if (markerDelta < 0) return markerDelta === -1 ? "Deleted marker" : `Deleted ${Math.abs(markerDelta)} markers`;
    if (beatDelta > 0) return "Added beat markers";
    if (beatDelta < 0) return "Cleared beat markers";
    if (trackDelta > 0) return trackDelta === 1 ? "Changed track settings" : `Changed ${trackDelta} track settings`;
    if (before.expandedTrack !== after.expandedTrack) return "Changed track view";
    if (before.globalVolume !== after.globalVolume) return "Changed master volume";
    return "Timeline edit";
  }

  function updateButtons() {
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");
    const historyBtn = document.getElementById("undoHistoryBtn");
    if (undoBtn) undoBtn.disabled = !undoStack.length;
    if (redoBtn) redoBtn.disabled = !redoStack.length;
    if (historyBtn) historyBtn.disabled = false;
  }

  function baseline() { last = snap(); lastSig = signature(last); updateButtons(); }

  function recordHistory() {
    clearTimeout(recordTimer);
    recordTimer = 0;
    if (restoring || !last) return;
    const now = snap();
    const sig = signature(now);
    if (sig === lastSig) return;
    last.__historyTime = Date.now();
    last.__historyLabel = consumePendingLabel() || describeChange(last, now);
    undoStack.push(last);
    if (undoStack.length > LIMIT) undoStack.shift();
    redoStack = [];
    last = now;
    lastSig = sig;
    updateButtons();
  }

  function scheduleRecordHistory(delay = 450) {
    if (restoring || !last) return;
    clearTimeout(recordTimer);
    recordTimer = setTimeout(recordHistory, delay);
  }

  function apply(saved) {
    if (!saved) return;
    restoring = true;
    try {
      clearTimeout(recordTimer);
      stopPlayback(false);
      state.assets = saved.assets.map(clone);
      state.clips = saved.clips.map(clone);
      state.markers = Array.isArray(saved.markers) ? saved.markers.map(clone) : [];
      state.beatMarkers = Array.isArray(saved.beatMarkers) ? saved.beatMarkers.map(clone) : [];
      state.trackSettings = Array.isArray(saved.trackSettings) ? saved.trackSettings.map(clone) : state.trackSettings;
      state.selectedAssetId = saved.selectedAssetId || state.assets[0]?.id || null;
      state.selectedClipId = saved.selectedClipId || null;
      state.selectedClipIds = Array.isArray(saved.selectedClipIds) ? saved.selectedClipIds.slice() : (state.selectedClipId ? [state.selectedClipId] : []);
      state.selectedTrack = Math.max(0, Math.min((document.querySelectorAll(".track-lane").length || 10) - 1, Number(saved.selectedTrack) || 0));
      state.pixelsPerSecond = Math.max(25, Math.min(500, Number(saved.pixelsPerSecond) || 80));
      state.playhead = Math.max(0, Number(saved.playhead) || 0);
      state.stretchMode = Boolean(saved.stretchMode);
      state.globalVolume = Math.max(0, Math.min(200, Number(saved.globalVolume ?? 100)));
      state.expandedTrack = typeof saved.expandedTrack === "number" ? saved.expandedTrack : null;
      state.renderCache?.clear?.();
      if (ui.zoomSlider) ui.zoomSlider.value = state.pixelsPerSecond;
      if (ui.zoomOut) ui.zoomOut.textContent = `${state.pixelsPerSecond} px/s`;
      renderAssets();
      syncSelectedControls();
      renderTimeline();
      setPlayhead(state.playhead, true);
      window.orgavoxRefreshVisibleUi?.();
      window.orgavoxRenderMarkers?.();
    } finally {
      restoring = false;
      last = snap();
      lastSig = signature(last);
      updateButtons();
    }
  }

  function undo() { if (!undoStack.length) { showToast("No undo history yet."); return; } const saved = undoStack.pop(); redoStack.push(snap()); apply(saved); showToast(`Undo: ${saved.__historyLabel || "Timeline edit"}.`); }
  function redo() { if (!redoStack.length) { showToast("Nothing to redo."); return; } const saved = redoStack.pop(); undoStack.push(snap()); apply(saved); showToast("Redo."); }

  function ensureHistoryModal() {
    let modal = document.getElementById(HISTORY_MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = HISTORY_MODAL_ID;
    modal.className = "orgavox-history-modal";
    modal.hidden = true;
    modal.innerHTML = `<section class="orgavox-history-dialog" role="dialog" aria-modal="true" aria-labelledby="undoHistoryTitle"><div class="popover-head"><div><span class="eyebrow">Edit history</span><h3 id="undoHistoryTitle">Undo History</h3></div><button class="icon-button" data-history-close type="button">×</button></div><p class="export-note">Choose one of the last 20 saved timeline states to restore.</p><div class="orgavox-history-list" data-history-list></div><div class="button-row end"><button class="tool-button" data-history-close type="button">Close</button></div></section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-history-close]").forEach((button) => button.addEventListener("click", () => { modal.hidden = true; }));
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; });
    return modal;
  }

  function openHistory() {
    recordHistory();
    const modal = ensureHistoryModal();
    const list = modal.querySelector("[data-history-list]");
    const items = undoStack.slice(-20).reverse();
    list.innerHTML = items.length ? "" : `<div class="empty-state">No undo history yet.</div>`;
    items.forEach((saved, reverseIndex) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "orgavox-history-row";
      const time = saved.__historyTime ? new Date(saved.__historyTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "saved state";
      const label = saved.__historyLabel || `Change ${reverseIndex + 1}`;
      row.innerHTML = `<strong>${label}</strong><span>${saved.clips?.length || 0} clips</span><small>${time}</small>`;
      row.addEventListener("click", () => {
        const originalIndex = undoStack.length - 1 - reverseIndex;
        if (originalIndex < 0) return;
        redoStack = [snap()];
        const target = undoStack[originalIndex];
        undoStack = undoStack.slice(0, originalIndex);
        apply(target);
        modal.hidden = true;
        showToast(`History restored: ${label}.`);
      });
      list.appendChild(row);
    });
    modal.hidden = false;
    updateButtons();
  }

  function wireControls() {
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");
    const historyBtn = document.getElementById("undoHistoryBtn");
    if (undoBtn && !undoBtn.dataset.orgavoxUndoWired) { undoBtn.dataset.orgavoxUndoWired = "true"; undoBtn.addEventListener("click", undo); }
    if (redoBtn && !redoBtn.dataset.orgavoxRedoWired) { redoBtn.dataset.orgavoxRedoWired = "true"; redoBtn.addEventListener("click", redo); }
    if (historyBtn && !historyBtn.dataset.orgavoxHistoryWired) { historyBtn.dataset.orgavoxHistoryWired = "true"; historyBtn.addEventListener("click", openHistory); }
    updateButtons();
  }

  function patchHistory() {
    if (window.__orgavoxUndoRedoHistoryPatched) return;
    window.__orgavoxUndoRedoHistoryPatched = true;
    const oldRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxUndoRedoRenderTimeline() { const result = oldRenderTimeline.apply(this, arguments); scheduleRecordHistory(700); return result; };
    const oldImportFiles = importFiles;
    importFiles = async function orgavoxUndoRedoImportFiles() { setPendingLabel("Import audio"); const result = await oldImportFiles.apply(this, arguments); scheduleRecordHistory(0); return result; };
  }

  function keys() {
    if (window.__orgavoxUndoRedoKeysBound) return;
    window.__orgavoxUndoRedoKeysBound = true;
    document.addEventListener("keydown", (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if (key === "y") { event.preventDefault(); redo(); }
    });
  }

  window.orgavoxUndo = undo;
  window.orgavoxRedo = redo;
  window.orgavoxOpenUndoHistory = openHistory;
  window.orgavoxRecordHistory = recordHistory;
  window.orgavoxScheduleHistory = scheduleRecordHistory;
  window.orgavoxWireUndoRedoControls = wireControls;
  window.orgavoxSetHistoryLabel = setPendingLabel;

  installStyles();
  ensureHistoryModal();
  installActionLabelCapture();
  patchHistory();
  keys();
  wireControls();
  baseline();
})();
