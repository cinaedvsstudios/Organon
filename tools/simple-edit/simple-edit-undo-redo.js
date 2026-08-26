"use strict";

(function installOrgavoxUndoRedo() {
  const HISTORY_MODAL_ID = "orgavoxUndoHistoryModal";
  const LIMIT = 80;
  let undoStack = [];
  let redoStack = [];
  let last = null;
  let lastSig = "";
  let restoring = false;

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
    return JSON.stringify(saved, (key, value) => ["buffer", "bufferOverride", "file", "peaks", "renderCache", "activeSources", "raf", "toastTimer", "clipDrag", "__historyTime"].includes(key) ? undefined : value);
  }

  function updateButtons() {
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");
    const historyBtn = document.getElementById("undoHistoryBtn");
    if (undoBtn) undoBtn.disabled = !undoStack.length;
    if (redoBtn) redoBtn.disabled = !redoStack.length;
    if (historyBtn) historyBtn.disabled = !undoStack.length;
  }

  function baseline() { last = snap(); lastSig = signature(last); updateButtons(); }

  function recordHistory() {
    if (restoring || !last) return;
    const now = snap();
    const sig = signature(now);
    if (sig === lastSig) return;
    last.__historyTime = Date.now();
    undoStack.push(last);
    if (undoStack.length > LIMIT) undoStack.shift();
    redoStack = [];
    last = now;
    lastSig = sig;
    updateButtons();
  }

  function apply(saved) {
    if (!saved) return;
    restoring = true;
    try {
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
      if (ui.zoomOut) ui.zoomOut.textContent = `${Math.round(state.pixelsPerSecond / 80 * 100)}%`;
      renderAssets();
      syncSelectedControls();
      renderTimeline();
      setPlayhead(state.playhead, true);
      window.orgavoxRefreshVisibleUi?.();
    } finally {
      restoring = false;
      last = snap();
      lastSig = signature(last);
      updateButtons();
    }
  }

  function undo() { if (!undoStack.length) return; const saved = undoStack.pop(); redoStack.push(snap()); apply(saved); showToast("Undo."); }
  function redo() { if (!redoStack.length) return; const saved = redoStack.pop(); undoStack.push(snap()); apply(saved); showToast("Redo."); }

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
    const modal = ensureHistoryModal();
    const list = modal.querySelector("[data-history-list]");
    const items = undoStack.slice(-20).reverse();
    list.innerHTML = items.length ? "" : `<div class="empty-state">No undo history yet.</div>`;
    items.forEach((saved, reverseIndex) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "orgavox-history-row";
      const time = saved.__historyTime ? new Date(saved.__historyTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "saved state";
      row.innerHTML = `<strong>Change ${reverseIndex + 1}</strong><span>${saved.clips?.length || 0} clips</span><small>${time}</small>`;
      row.addEventListener("click", () => {
        const originalIndex = undoStack.length - 1 - reverseIndex;
        if (originalIndex < 0) return;
        redoStack = [snap()];
        const target = undoStack[originalIndex];
        undoStack = undoStack.slice(0, originalIndex);
        apply(target);
        modal.hidden = true;
        showToast("History state restored.");
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
    renderTimeline = function orgavoxUndoRedoRenderTimeline() { const result = oldRenderTimeline.apply(this, arguments); setTimeout(recordHistory, 0); return result; };
    const oldImportFiles = importFiles;
    importFiles = async function orgavoxUndoRedoImportFiles() { const result = await oldImportFiles.apply(this, arguments); setTimeout(recordHistory, 0); return result; };
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
  window.orgavoxWireUndoRedoControls = wireControls;

  ensureHistoryModal();
  patchHistory();
  keys();
  wireControls();
  baseline();
})();