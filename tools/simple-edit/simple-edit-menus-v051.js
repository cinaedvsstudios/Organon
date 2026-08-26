"use strict";

(function installOrgavoxMenusV051() {
  const STYLE_ID = "orgavox-menus-v051-style";
  const EDIT_ID = "orgavoxEditDropdown";
  const VIEW_ID = "orgavoxViewDropdown";
  let applying = false;

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-edit-dropdown,.orgavox-view-dropdown{position:relative;display:inline-flex;align-items:center}
      .orgavox-edit-button,.orgavox-view-button{
        border-color:rgba(224,163,96,.82)!important;
        background:linear-gradient(180deg,rgba(93,67,35,.88),rgba(34,23,13,.95))!important;
        color:#ffe4a8!important;
      }
      .orgavox-view-button{
        border-color:rgba(117,178,222,.82)!important;
        background:linear-gradient(180deg,rgba(35,80,124,.9),rgba(14,38,72,.96))!important;
        color:#e1f7ff!important;
      }
      .orgavox-edit-menu,.orgavox-view-menu{
        position:absolute;top:calc(100% + 8px);left:0;z-index:4100;min-width:190px;
        display:grid;gap:6px;padding:8px;border:1px solid rgba(224,163,96,.65);border-radius:14px;
        background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);
      }
      .orgavox-view-menu{border-color:rgba(117,178,222,.62)}
      .orgavox-edit-menu[hidden],.orgavox-view-menu[hidden]{display:none}
      .orgavox-edit-menu .tool-button,.orgavox-view-menu .tool-button{width:100%;justify-content:flex-start!important;min-height:32px!important}
      .orgavox-analysis-picker-wrap{
        display:grid;gap:6px;margin:12px 0 0;padding:10px;border:1px solid rgba(117,178,222,.32);
        border-radius:12px;background:rgba(117,178,222,.08);
      }
      .orgavox-analysis-picker-wrap span{
        color:rgba(245,240,219,.64);font:800 .58rem var(--font-mono);text-transform:uppercase;letter-spacing:.06em;
      }
      .orgavox-analysis-picker{
        min-height:36px;border:1px solid rgba(117,178,222,.56);border-radius:10px;background:rgba(0,0,0,.34);
        color:#f5f0db;padding:6px 9px;font:800 .72rem var(--font-body);
      }
      body.simple-edit-phase1 #echoSettingsBtn.orgavox-echo-restored{
        margin-left:7px!important;width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;
        border-color:rgba(117,178,222,.72)!important;background:linear-gradient(180deg,rgba(31,82,128,.86),rgba(11,38,68,.96))!important;color:#dff5ff!important;
      }
    `;
    document.head.appendChild(style);
  }

  function tip(button, text) {
    if (!button || !text) return;
    button.title = text;
    button.setAttribute("aria-label", text);
  }

  function menu(id, cls, label, title) {
    let wrap = document.getElementById(id);
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = id;
      wrap.className = cls;
      wrap.innerHTML = `<button class="tool-button ${cls.replace("-dropdown", "-button")}" type="button" aria-expanded="false">${label}</button><div class="${cls.replace("-dropdown", "-menu")}" hidden></div>`;
      const btn = wrap.querySelector("button");
      tip(btn, title);
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const panel = wrap.querySelector(`.${cls.replace("-dropdown", "-menu")}`);
        const open = panel.hidden;
        document.querySelectorAll(".orgavox-edit-menu,.orgavox-view-menu").forEach((other) => { if (other !== panel) other.hidden = true; });
        panel.hidden = !open;
        btn.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("click", (event) => {
        if (!event.target.closest(`#${id}`)) {
          const panel = wrap.querySelector(`.${cls.replace("-dropdown", "-menu")}`);
          if (panel) panel.hidden = true;
          btn.setAttribute("aria-expanded", "false");
        }
      });
    }
    return wrap;
  }

  function closeMenus() {
    document.querySelectorAll(".orgavox-edit-menu,.orgavox-view-menu").forEach((panel) => { panel.hidden = true; });
    document.querySelectorAll(".orgavox-edit-button,.orgavox-view-button").forEach((button) => button.setAttribute("aria-expanded", "false"));
  }

  function copyClip() {
    const clip = selectedClip();
    if (!clip) return showToast("Select a clip to copy.");
    state.__orgavoxClipClipboard = {
      ...clip,
      id: clip.id,
      volumeKeyframes: Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes.map((item) => ({ ...item })) : []
    };
    showToast("Clip copied.");
  }

  function pasteClip() {
    const clip = state.__orgavoxClipClipboard;
    if (!clip) return showToast("No copied clip to paste.");
    const next = {
      ...clip,
      id: makeId("clip"),
      start: Math.max(0, Number(state.playhead) || 0),
      track: Math.max(0, Math.min(9, Number(state.selectedTrack) || 0)),
      cacheVersion: 0,
      volumeKeyframes: Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes.map((item) => ({ ...item, id: makeId("kf") })) : []
    };
    state.clips.push(next);
    selectClip(next.id);
    renderTimeline();
    showToast("Clip pasted at the playhead.");
    window.orgavoxRecordHistory?.();
  }

  function clearAll() {
    if (!state.clips.length) return showToast("Timeline is already clear.");
    if (!confirm("Clear all clips from the timeline? Source files stay in the library.")) return;
    stopPlayback();
    state.clips = [];
    state.selectedClipId = null;
    syncSelectedControls();
    renderTimeline();
    showToast("All timeline clips cleared.");
    window.orgavoxRecordHistory?.();
  }

  function custom(id, label, title, handler) {
    let btn = document.getElementById(id);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = id;
      btn.type = "button";
      btn.className = "tool-button";
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeMenus();
        handler();
      });
    }
    btn.textContent = label;
    tip(btn, title);
    return btn;
  }

  function ensureEdit() {
    const wrap = menu(EDIT_ID, "orgavox-edit-dropdown", "✎ Edit ▾", "Edit selected clips");
    const panel = wrap.querySelector(".orgavox-edit-menu");
    [
      [ui.scissorsBtn, "✂️ Cut", "Cut the selected clip at the playhead"],
      [ui.deleteBtn, "🗑 DEL", "Delete the selected clip"],
      [custom("orgavoxCopyClipBtn", "⧉ Copy", "Copy the selected clip", copyClip)],
      [custom("orgavoxPasteClipBtn", "⧉ Paste", "Paste copied clip at the playhead", pasteClip)],
      [custom("orgavoxClearTimelineBtn", "🧹 Clear All", "Clear all clips from the timeline", clearAll)],
      [ui.downloadClipBtn, "⬇ Download Clip", "Download the selected clip as WAV or MP3"],
      [ui.bounceBtn, "🧱 Bounce", "Bounce/render the selected clip"]
    ].forEach(([button, label, title]) => {
      if (!button) return;
      if (label) button.textContent = label;
      if (title) tip(button, title);
      if (button.parentElement !== panel) panel.appendChild(button);
    });
    return wrap;
  }

  function openMarkersPanel() {
    const modal = document.getElementById("markersModal");
    if (!modal) return showToast("Markers panel is still loading.");
    modal.hidden = false;
    const input = modal.querySelector("[data-marker-name]");
    if (input && !input.value.trim()) input.value = `Marker ${(state.markers?.length || 0) + 1}`;
    window.orgavoxRenderMarkers?.();
    showToast("Markers panel opened.");
  }

  function addMarker() {
    if (!Array.isArray(state.markers)) state.markers = [];
    const clip = selectedClip();
    const time = Math.max(0, Number(state.playhead) || 0);
    const name = clip?.name ? clip.name.replace(/\.[^.]+$/, "").slice(0, 58) : `Marker ${state.markers.length + 1}`;
    state.markers.push({ id: makeId("marker"), time, label: clip ? `${name} cue` : name, color: "purple" });
    renderTimeline();
    window.orgavoxRenderMarkers?.();
    showToast(`Marker added at ${formatTime(time)}.`);
    window.orgavoxRecordHistory?.();
  }

  function patchMarkerButton() {
    if (!ui.markersBtn || ui.markersBtn.dataset.orgavoxV051AddMode === "true") return;
    ui.markersBtn.dataset.orgavoxV051AddMode = "true";
    ui.markersBtn.textContent = "🏷 Add Marker";
    tip(ui.markersBtn, "Add a marker at the playhead for the selected clip");
    ui.markersBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      addMarker();
    }, true);
  }

  function ensureAnalysisPicker() {
    const modalNode = document.getElementById("analysisModal");
    const dialog = modalNode?.querySelector(".orgavox-analysis-dialog");
    if (!dialog) return null;
    let wrap = dialog.querySelector(".orgavox-analysis-picker-wrap");
    if (!wrap) {
      wrap = document.createElement("label");
      wrap.className = "orgavox-analysis-picker-wrap";
      wrap.innerHTML = `<span>Clip / track to analyze</span><select class="orgavox-analysis-picker"></select>`;
      const note = dialog.querySelector(".export-note");
      if (note) note.insertAdjacentElement("afterend", wrap);
      else dialog.prepend(wrap);
    }
    const select = wrap.querySelector("select");
    const current = state.selectedClipId;
    select.innerHTML = "";
    if (!state.clips.length) {
      select.innerHTML = `<option value="">No clips in timeline</option>`;
    } else {
      state.clips.slice().sort((a, b) => a.track - b.track || a.start - b.start).forEach((clip) => {
        const option = document.createElement("option");
        option.value = clip.id;
        option.textContent = `Track ${clip.track + 1} · ${formatTime(clip.start)} · ${clip.name}`;
        select.appendChild(option);
      });
      select.value = current && state.clips.some((clip) => clip.id === current) ? current : state.clips[0].id;
    }
    if (select.dataset.orgavoxReady !== "true") {
      select.dataset.orgavoxReady = "true";
      select.addEventListener("change", () => {
        const clip = state.clips.find((item) => item.id === select.value);
        if (!clip) return;
        selectClip(clip.id);
        selectTrack(clip.track);
        syncSelectedControls();
        showToast(`Selected ${clip.name} for analysis.`);
      });
    }
    return select;
  }

  function autoAnalyze() {
    const clip = selectedClip() || state.clips[0];
    if (!clip) return showToast("Select a clip to analyze.");
    selectClip(clip.id);
    selectTrack(clip.track);
    const modalNode = document.getElementById("analysisModal");
    if (!modalNode) return showToast("Analyze panel is still loading.");
    modalNode.hidden = false;
    const picker = ensureAnalysisPicker();
    if (picker) picker.value = clip.id;
    const summary = modalNode.querySelector("[data-analysis-summary]");
    if (summary) summary.textContent = `${clip.name} · scanning selected clip…`;
    showToast(`Analyzing ${clip.name}.`);
    setTimeout(() => modalNode.querySelector("[data-analysis-scan]")?.click(), 0);
  }

  function ensureView() {
    const wrap = menu(VIEW_ID, "orgavox-view-dropdown", "👁 View ▾", "Open marker, alignment and analysis tools");
    const panel = wrap.querySelector(".orgavox-view-menu");
    const markerPanel = custom("orgavoxMarkerPanelBtn", "🏷 Markers Panel", "Open marker names, colors and cue list", openMarkersPanel);
    if (markerPanel.parentElement !== panel) panel.appendChild(markerPanel);
    if (ui.alignPlayheadBtn) {
      ui.alignPlayheadBtn.textContent = "⤓ Align to Playhead";
      tip(ui.alignPlayheadBtn, "Align selected clip start to the playhead");
      if (ui.alignPlayheadBtn.parentElement !== panel) panel.appendChild(ui.alignPlayheadBtn);
    }
    if (ui.analysisBtn) {
      ui.analysisBtn.textContent = "📈 Analyze";
      tip(ui.analysisBtn, "Analyze the selected clip immediately");
      if (ui.analysisBtn.parentElement !== panel) panel.appendChild(ui.analysisBtn);
      if (ui.analysisBtn.dataset.orgavoxV051Auto !== "true") {
        ui.analysisBtn.dataset.orgavoxV051Auto = "true";
        ui.analysisBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          closeMenus();
          autoAnalyze();
        }, true);
      }
    }
    ensureAnalysisPicker();
    return wrap;
  }

  function restoreEchoSettings() {
    const button = document.getElementById("echoSettingsBtn") || ui.echoSettingsBtn;
    const control = ui.echoSlider?.closest(".range-control");
    if (!button || !control || !ui.echoOut) return;
    button.classList.add("orgavox-echo-restored");
    tip(button, "Open detailed echo settings for the selected clip");
    if (button.parentElement !== control || button.previousElementSibling !== ui.echoOut) {
      ui.echoOut.insertAdjacentElement("afterend", button);
    }
    ui.echoSettingsBtn = button;
  }

  function orderMenus() {
    const editGroup = document.querySelector(".orgavox-edit-group");
    if (!editGroup) return;
    const redo = ui.redoBtn || document.getElementById("redoBtn");
    const edit = document.getElementById(EDIT_ID);
    const view = document.getElementById(VIEW_ID);
    const effects = editGroup.querySelector(".orgavox-effects-dropdown");
    const start = redo && redo.parentElement === editGroup ? redo.nextSibling : editGroup.firstChild;
    let cursor = start;
    [edit, view, effects].filter(Boolean).forEach((node) => {
      if (node.parentElement !== editGroup) editGroup.insertBefore(node, cursor);
      else editGroup.insertBefore(node, cursor);
      cursor = node.nextSibling;
    });
  }

  function tooltips() {
    [
      [ui.importBtn, "Open/import audio or video files"],
      [ui.exportBtn, "Save/export the full mix"],
      [ui.projectBtn, "Save or load an ORGAVOX project"],
      [ui.undoBtn, "Undo the last edit"],
      [ui.redoBtn, "Redo the last undone edit"],
      [ui.playBtn, "Play or pause"],
      [ui.stopBtn, "Stop playback"],
      [ui.jumpStartBtn, "Jump back to the start"],
      [ui.scissorsBtn, "Cut the selected clip at the playhead"],
      [ui.deleteBtn, "Delete the selected clip"],
      [ui.downloadClipBtn, "Download the selected clip"],
      [ui.bounceBtn, "Bounce/render the selected clip"],
      [ui.markersBtn, "Add a marker at the playhead"],
      [ui.snapBtn, "Toggle snap-to-grid"],
      [ui.snapGridSelect, "Choose snap grid size"],
      [ui.nudgeLeftBtn, "Nudge selected clip left"],
      [ui.nudgeRightBtn, "Nudge selected clip right"],
      [ui.alignPlayheadBtn, "Align selected clip to the playhead"],
      [ui.analysisBtn, "Analyze the selected clip"],
      [document.querySelector(".orgavox-effects-dropdown-button"), "Open audio effects"],
      [document.querySelector(".orgavox-edit-button"), "Open editing commands"],
      [document.querySelector(".orgavox-view-button"), "Open marker, alignment and analysis tools"]
    ].forEach(([button, title]) => tip(button, title));
  }

  function patchRender() {
    if (window.__orgavoxV051MenuRenderPatched) return;
    window.__orgavoxV051MenuRenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxV051RenderTimeline() {
      const result = previousRenderTimeline.apply(this, arguments);
      apply();
      return result;
    };
    const previousSyncSelectedControls = syncSelectedControls;
    syncSelectedControls = function orgavoxV051SyncSelectedControls() {
      const result = previousSyncSelectedControls.apply(this, arguments);
      ensureAnalysisPicker();
      return result;
    };
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      restoreEchoSettings();
      ensureEdit();
      ensureView();
      patchMarkerButton();
      orderMenus();
      ensureAnalysisPicker();
      tooltips();
    } finally {
      applying = false;
    }
  }

  installStyles();
  patchRender();
  apply();
  setTimeout(apply, 0);
  setTimeout(apply, 200);
  setTimeout(apply, 600);
  window.orgavoxApplyMenuCleanup = apply;
})();
