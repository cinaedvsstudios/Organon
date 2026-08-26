"use strict";

(function installOrgavoxSnapTools() {
  const GRID_OPTIONS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
  let snapEnabled = localStorage.getItem("orgavoxSnapEnabled") === "true";
  let snapGrid = Number(localStorage.getItem("orgavoxSnapGrid") || "0.1");
  if (!GRID_OPTIONS.includes(snapGrid)) snapGrid = 0.1;

  function markerTimes() { return Array.isArray(state.markers) ? state.markers.map((marker) => Math.max(0, Number(marker.time) || 0)) : []; }
  function clipEdgeTimes(exceptClipId) { const times = []; state.clips.forEach((clip) => { if (!clip || clip.id === exceptClipId) return; times.push(Math.max(0, Number(clip.start) || 0)); times.push(Math.max(0, (Number(clip.start) || 0) + clipDuration(clip))); }); return times; }
  function snapTolerance() { return Math.max(0.035, 14 / Math.max(25, Number(state.pixelsPerSecond) || 80)); }
  function gridSnap(time) { const grid = Math.max(0.001, Number(snapGrid) || 0.1); return Math.max(0, Math.round(time / grid) * grid); }
  function snapTime(time, exceptClipId = null) { const raw = Math.max(0, Number(time) || 0); if (!snapEnabled) return raw; const candidates = [gridSnap(raw), Math.max(0, Number(state.playhead) || 0), ...markerTimes(), ...clipEdgeTimes(exceptClipId)]; const tolerance = snapTolerance(); let best = gridSnap(raw); let bestDistance = Math.abs(best - raw); candidates.forEach((candidate) => { const distance = Math.abs(candidate - raw); if (distance <= tolerance && distance < bestDistance) { best = candidate; bestDistance = distance; } }); return Math.max(0, best); }
  function selectedClips() { const ids = Array.isArray(state.selectedClipIds) && state.selectedClipIds.length ? new Set(state.selectedClipIds) : new Set(state.selectedClipId ? [state.selectedClipId] : []); return state.clips.filter((clip) => ids.has(clip.id)); }
  function nudgeAmount() { return Math.max(0.001, Number(snapGrid) || 0.1); }
  function nudgeSelected(direction) { const clips = selectedClips(); if (!clips.length) return showToast("Select a clip to nudge."); stopPlayback(); const amount = nudgeAmount() * (direction < 0 ? -1 : 1); clips.forEach((clip) => { clip.start = Math.max(0, (Number(clip.start) || 0) + amount); }); renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); showToast(`${clips.length === 1 ? "Clip" : "Clips"} nudged ${Math.abs(amount)}s.`); }
  function alignSelectedToPlayhead() { const clip = selectedClip(); if (!clip) return showToast("Select a clip to align."); stopPlayback(); clip.start = snapTime(state.playhead, clip.id); renderTimeline(); syncSelectedControls(); window.orgavoxRecordHistory?.(); showToast("Clip aligned to playhead."); }
  function updateButtonState() { const snapBtn = document.getElementById("snapGridBtn"); const select = document.getElementById("snapGridSelect"); if (snapBtn) { snapBtn.classList.toggle("active", snapEnabled); snapBtn.textContent = snapEnabled ? "🧲 Snap on" : "🧲 Snap"; snapBtn.title = snapEnabled ? `Snap on — grid ${snapGrid}s, markers and clip edges` : "Snap off — click to enable grid snapping"; } if (select) select.value = String(snapGrid); const hasClip = Boolean(selectedClip()); ["nudgeLeftBtn", "nudgeRightBtn", "alignPlayheadBtn"].forEach((id) => { const button = document.getElementById(id); if (button) button.disabled = !hasClip; }); }
  function wireControls() { const snapBtn = document.getElementById("snapGridBtn"); const select = document.getElementById("snapGridSelect"); const left = document.getElementById("nudgeLeftBtn"); const right = document.getElementById("nudgeRightBtn"); const align = document.getElementById("alignPlayheadBtn"); if (select && !select.dataset.orgavoxSnapOptions) { select.dataset.orgavoxSnapOptions = "true"; select.innerHTML = ""; GRID_OPTIONS.forEach((value) => { const option = document.createElement("option"); option.value = String(value); option.textContent = String(value); select.appendChild(option); }); select.addEventListener("change", () => { snapGrid = Number(select.value) || 0.1; localStorage.setItem("orgavoxSnapGrid", String(snapGrid)); snapEnabled = true; localStorage.setItem("orgavoxSnapEnabled", "true"); updateButtonState(); showToast(`Snap grid set to ${snapGrid}s.`); }); } if (snapBtn && !snapBtn.dataset.orgavoxSnapWired) { snapBtn.dataset.orgavoxSnapWired = "true"; snapBtn.addEventListener("click", () => { snapEnabled = !snapEnabled; localStorage.setItem("orgavoxSnapEnabled", String(snapEnabled)); updateButtonState(); showToast(snapEnabled ? `Snap on — ${snapGrid}s grid.` : "Snap off."); }); } if (left && !left.dataset.orgavoxNudgeWired) { left.dataset.orgavoxNudgeWired = "true"; left.addEventListener("click", () => nudgeSelected(-1)); } if (right && !right.dataset.orgavoxNudgeWired) { right.dataset.orgavoxNudgeWired = "true"; right.addEventListener("click", () => nudgeSelected(1)); } if (align && !align.dataset.orgavoxAlignWired) { align.dataset.orgavoxAlignWired = "true"; align.addEventListener("click", alignSelectedToPlayhead); } ui.snapBtn = snapBtn; ui.snapGridSelect = select; ui.nudgeLeftBtn = left; ui.nudgeRightBtn = right; ui.alignPlayheadBtn = align; updateButtonState(); }

  if (!window.__orgavoxSnapDragPatched && typeof moveClipPointer === "function") {
    window.__orgavoxSnapDragPatched = true;
    const previousMove = moveClipPointer;
    moveClipPointer = function orgavoxSnapMoveClipPointer(event) { previousMove.apply(this, arguments); if (!snapEnabled) return; const drag = state.clipDrag; if (!drag || event.pointerId !== drag.pointerId) return; const clip = state.clips.find((item) => item.id === drag.clipId); if (!clip || drag.type !== "move") return; clip.start = snapTime(clip.start, clip.id); if (drag.element) drag.element.style.left = `${clip.start * state.pixelsPerSecond}px`; };
  }

  window.orgavoxSnapOptions = GRID_OPTIONS.slice();
  window.orgavoxSnapTime = snapTime;
  window.orgavoxNudgeSelected = nudgeSelected;
  window.orgavoxAlignSelectedToPlayhead = alignSelectedToPlayhead;
  window.orgavoxWireSnapControls = wireControls;
  window.orgavoxUpdateSnapControls = updateButtonState;
  setTimeout(wireControls, 0);
})();