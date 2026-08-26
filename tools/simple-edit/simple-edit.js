"use strict";

(async () => {
  const VERSION = "v0.62 bundled";
  const REMOTE_SOUND_FX = "https://raw.githubusercontent.com/rse/soundfx/master/soundfx.d/";
  const LOCAL_SOUND_FX = "./soundeffects/";
  window.ORGAVOX_VERSION = VERSION;
  document.documentElement.classList.add("orgavox-loading");

  function setFinalVersion() {
    document.title = `Organon — ORGAVOX ${VERSION}`;
    const mark = document.querySelector(".brand-mark");
    if (mark) mark.textContent = "Φ";
    const brand = document.querySelector(".brand");
    const title = brand?.querySelector("h1");
    if (title) {
      let badge = title.querySelector(".phase1-version, .simple-edit-version");
      title.textContent = "ORGAVOX";
      if (!badge) badge = document.createElement("span");
      badge.className = "phase1-version simple-edit-version";
      badge.textContent = VERSION;
      title.appendChild(badge);
    }
    const subtitle = brand?.querySelector("p");
    if (subtitle) { subtitle.textContent = ""; subtitle.hidden = true; }
  }

  function localizeSoundFxUrl(value) {
    const text = String(value || "");
    return text.startsWith(REMOTE_SOUND_FX) ? `${LOCAL_SOUND_FX}${text.slice(REMOTE_SOUND_FX.length)}` : value;
  }

  function installLocalSoundFxRouting() {
    if (!window.__orgavoxLocalSoundFxFetchPatched) {
      window.__orgavoxLocalSoundFxFetchPatched = true;
      const originalFetch = window.fetch?.bind(window);
      if (originalFetch) {
        window.fetch = function orgavoxSoundFxFetch(resource, init) {
          if (typeof resource === "string") return originalFetch(localizeSoundFxUrl(resource), init);
          if (resource && typeof resource.url === "string") {
            const localized = localizeSoundFxUrl(resource.url);
            if (localized !== resource.url) return originalFetch(localized, init);
          }
          return originalFetch(resource, init);
        };
      }
    }
    if (!window.__orgavoxLocalSoundFxAudioPatched && window.Audio) {
      window.__orgavoxLocalSoundFxAudioPatched = true;
      const NativeAudio = window.Audio;
      function OrgavoxAudio(src) { return src === undefined ? new NativeAudio() : new NativeAudio(localizeSoundFxUrl(src)); }
      OrgavoxAudio.prototype = NativeAudio.prototype;
      Object.setPrototypeOf(OrgavoxAudio, NativeAudio);
      window.Audio = OrgavoxAudio;
    }
  }

  function ensureLeadingTransportDivider() {
    const row = document.querySelector(".orgavox-toolbar-row");
    const transport = row?.querySelector(".orgavox-transport-group");
    if (!row || !transport) return;
    let divider = row.querySelector(".orgavox-leading-divider");
    if (!divider) {
      divider = document.createElement("span");
      divider.className = "orgavox-divider orgavox-leading-divider";
      divider.setAttribute("aria-hidden", "true");
    }
    if (transport.previousElementSibling !== divider) row.insertBefore(divider, transport);
  }

  function keepFeatureButtonsInMenu() {
    if (typeof ui === "undefined") return;
    const menu = document.querySelector(".orgavox-effects-menu");
    if (!menu) return;
    [ui.gateBtn, ui.stretchBtn, ui.normalizeBtn, ui.transposeBtn, ui.eqBtn, ui.driveBtn, ui.dynamicsBtn, ui.stereoBtn, ui.lofiBtn, ui.reverseClipBtn]
      .filter(Boolean)
      .forEach((button) => { if (button.parentElement !== menu) menu.appendChild(button); });
  }

  function placeClipToolButtons() {
    if (typeof ui === "undefined") return;
    const editGroup = document.querySelector(".orgavox-edit-group");
    const effectsDrop = editGroup?.querySelector(".orgavox-effects-dropdown");
    if (!editGroup) return;
    [ui.analysisBtn, ui.markersBtn, ui.snapBtn, ui.snapGridSelect, ui.nudgeLeftBtn, ui.nudgeRightBtn, ui.alignPlayheadBtn]
      .filter(Boolean)
      .forEach((button) => {
        if (effectsDrop) editGroup.insertBefore(button, effectsDrop);
        else if (button.parentElement !== editGroup) editGroup.appendChild(button);
      });
  }

  function applyFinalToolbarStyling() {
    try {
      if (typeof ui !== "undefined") {
        if (ui.importBtn) { ui.importBtn.textContent = "📥 Open"; ui.importBtn.classList.remove("primary"); ui.importBtn.classList.add("orgavox-open-button"); }
        if (ui.exportBtn) { ui.exportBtn.textContent = "💾 Save"; ui.exportBtn.classList.add("orgavox-save-button"); }
        if (ui.stopBtn) ui.stopBtn.classList.add("orgavox-stop-danger");
        if (ui.scissorsBtn) { ui.scissorsBtn.textContent = "✂️ Cut"; ui.scissorsBtn.classList.add("orgavox-danger-tool"); }
        if (ui.deleteBtn) { ui.deleteBtn.textContent = "🗑 DEL"; ui.deleteBtn.classList.add("orgavox-danger-tool"); }
        [ui.fadeInBtn, ui.fadeOutBtn, ui.resetFadesBtn].filter(Boolean).forEach((button) => button.classList.add("orgavox-fade-tool"));
      }
      keepFeatureButtonsInMenu();
      placeClipToolButtons();
      window.orgavoxPlaceProjectButton?.();
      window.orgavoxUpdateProjectInfoBar?.();
      window.orgavoxPlaceMarkersButton?.();
      window.orgavoxRenderMarkers?.();
      window.orgavoxPlaceBuild1Controls?.();
      window.orgavoxSyncPlaybackPolish?.();
      window.orgavoxRefreshTrackTools?.();
      window.orgavoxPlaceClipRenderButtons?.();
      window.orgavoxPlaceSnapTools?.();
      window.orgavoxRefreshLibraryTools?.();
      window.orgavoxRefreshBuild6?.();
      window.orgavoxApplyFinalCleanup?.();
      window.orgavoxApplyMenuCleanup?.();
      window.orgavoxRefreshV052Interactions?.();
      window.orgavoxRestoreViewMenu?.();
      ensureLeadingTransportDivider();

      const effectsLibrary = document.querySelector(".effects-library-button") || [...document.querySelectorAll("button")].find((button) => /effects library/i.test(button.textContent || ""));
      if (effectsLibrary) effectsLibrary.classList.add("orgavox-effects-library-button");

      let style = document.getElementById("orgavox-final-toolbar-style");
      if (!style) { style = document.createElement("style"); style.id = "orgavox-final-toolbar-style"; document.head.appendChild(style); }
      style.textContent = `body.simple-edit-phase1{--topbar-h:112px!important}body.simple-edit-phase1 .topbar{height:var(--topbar-h)!important;min-height:var(--topbar-h)!important;padding-top:12px!important;padding-bottom:8px!important}body.simple-edit-phase1 .brand p{display:none!important}body.simple-edit-phase1 .phase1-top-effects{padding-top:10px!important}body.simple-edit-phase1 .workspace{height:calc(100vh - var(--topbar-h))!important}body.simple-edit-phase1 #importBtn.orgavox-open-button{border-color:rgba(117,178,222,.92)!important;background:linear-gradient(180deg,rgba(57,132,205,.96),rgba(31,77,133,.94))!important;color:#eef8ff!important;box-shadow:0 0 0 1px rgba(117,178,222,.24),0 0 14px rgba(75,155,255,.24)!important}body.simple-edit-phase1 #exportBtn.orgavox-save-button{border-color:rgba(74,190,117,.86)!important;background:linear-gradient(180deg,rgba(35,118,66,.92),rgba(14,62,35,.94))!important;color:#e2ffe9!important;box-shadow:0 0 0 1px rgba(74,190,117,.22),0 0 14px rgba(74,190,117,.22)!important}body.simple-edit-phase1 #stopBtn.orgavox-stop-danger,body.simple-edit-phase1 #scissorsBtn.orgavox-danger-tool,body.simple-edit-phase1 #deleteBtn.orgavox-danger-tool{border-color:rgba(220,72,64,.76)!important;background:linear-gradient(180deg,rgba(89,29,26,.84),rgba(35,13,12,.94))!important;color:#ffd8d2!important;box-shadow:0 0 0 1px rgba(220,72,64,.2),0 0 14px rgba(220,72,64,.2)!important}body.simple-edit-phase1 .orgavox-fade-tool{border-color:rgba(74,190,117,.76)!important;background:linear-gradient(180deg,rgba(28,89,52,.74),rgba(12,42,25,.9))!important;color:#d6ffe4!important}body.simple-edit-phase1 .orgavox-effects-library-button{border-color:rgba(178,109,255,.86)!important;background:linear-gradient(180deg,rgba(87,46,148,.88),rgba(37,22,74,.96))!important;color:#f1ddff!important}body.simple-edit-phase1 .time-readout{font-size:.94rem!important;min-height:36px!important;padding:9px 14px!important;letter-spacing:.08em!important}body.simple-edit-phase1 .orgavox-leading-divider{display:inline-flex!important;flex:0 0 1px!important;min-height:36px!important;margin-left:0!important}body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control{display:grid!important;grid-template-columns:1fr auto!important;grid-template-rows:auto auto!important;gap:6px 10px!important;align-items:center!important}body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control span{grid-column:1!important;grid-row:1!important}body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control output{grid-column:2!important;grid-row:1!important;text-align:right!important;color:#f8d792!important}body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control input[type="range"]{grid-column:1 / -1!important;grid-row:2!important;width:100%!important}@media (max-width:1380px){body.simple-edit-phase1{--topbar-h:158px!important}}`;
    } catch (error) { console.warn("ORGAVOX final toolbar styling failed.", error); }
  }

  function refreshFinalLayout() {
    try { if (typeof ui !== "undefined") window.orgavoxRefreshLayout?.(); }
    catch (error) { console.warn("ORGAVOX could not refresh layout.", error); }
    applyFinalToolbarStyling();
    setFinalVersion();
  }

  function installBundledUiPatches() {
    // Bundled from simple-edit-menus-v051.js
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
          .orgavox-edit-button,.orgavox-view-button{border-color:rgba(224,163,96,.82)!important;background:linear-gradient(180deg,rgba(93,67,35,.88),rgba(34,23,13,.95))!important;color:#ffe4a8!important;}
          .orgavox-view-button{border-color:rgba(117,178,222,.82)!important;background:linear-gradient(180deg,rgba(35,80,124,.9),rgba(14,38,72,.96))!important;color:#e1f7ff!important;}
          .orgavox-edit-menu,.orgavox-view-menu{position:absolute;top:calc(100% + 8px);left:0;z-index:4100;min-width:190px;display:grid;gap:6px;padding:8px;border:1px solid rgba(224,163,96,.65);border-radius:14px;background:rgba(10,11,10,.98);box-shadow:0 18px 44px rgba(0,0,0,.72);}
          .orgavox-view-menu{border-color:rgba(117,178,222,.62)}
          .orgavox-edit-menu[hidden],.orgavox-view-menu[hidden]{display:none}
          .orgavox-edit-menu .tool-button,.orgavox-view-menu .tool-button{width:100%;justify-content:flex-start!important;min-height:32px!important}
          .orgavox-analysis-picker-wrap{display:grid;gap:6px;margin:12px 0 0;padding:10px;border:1px solid rgba(117,178,222,.32);border-radius:12px;background:rgba(117,178,222,.08);}
          .orgavox-analysis-picker-wrap span{color:rgba(245,240,219,.64);font:800 .58rem var(--font-mono);text-transform:uppercase;letter-spacing:.06em;}
          .orgavox-analysis-picker{min-height:36px;border:1px solid rgba(117,178,222,.56);border-radius:10px;background:rgba(0,0,0,.34);color:#f5f0db;padding:6px 9px;font:800 .72rem var(--font-body);}
          body.simple-edit-phase1 #echoSettingsBtn.orgavox-echo-restored{margin-left:7px!important;width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;border-color:rgba(117,178,222,.72)!important;background:linear-gradient(180deg,rgba(31,82,128,.86),rgba(11,38,68,.96))!important;color:#dff5ff!important;}
        `;
        document.head.appendChild(style);
      }
      function tip(button, text) { if (!button || !text) return; button.title = text; button.setAttribute("aria-label", text); }
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
        state.__orgavoxClipClipboard = { ...clip, id: clip.id, volumeKeyframes: Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes.map((item) => ({ ...item })) : [] };
        showToast("Clip copied.");
      }
      function pasteClip() {
        const clip = state.__orgavoxClipClipboard;
        if (!clip) return showToast("No copied clip to paste.");
        const next = { ...clip, id: makeId("clip"), start: Math.max(0, Number(state.playhead) || 0), track: Math.max(0, Math.min(9, Number(state.selectedTrack) || 0)), cacheVersion: 0, volumeKeyframes: Array.isArray(clip.volumeKeyframes) ? clip.volumeKeyframes.map((item) => ({ ...item, id: makeId("kf") })) : [] };
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
          btn.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); closeMenus(); handler(); });
        }
        btn.textContent = label;
        tip(btn, title);
        return btn;
      }
      function ensureEdit() {
        const wrap = menu(EDIT_ID, "orgavox-edit-dropdown", "✎ Edit ▾", "Edit selected clips");
        const panel = wrap.querySelector(".orgavox-edit-menu");
        [[ui.scissorsBtn, "✂️ Cut", "Cut the selected clip at the playhead"], [ui.deleteBtn, "🗑 DEL", "Delete the selected clip"], [custom("orgavoxCopyClipBtn", "⧉ Copy", "Copy the selected clip", copyClip)], [custom("orgavoxPasteClipBtn", "⧉ Paste", "Paste copied clip at the playhead", pasteClip)], [custom("orgavoxClearTimelineBtn", "🧹 Clear All", "Clear all clips from the timeline", clearAll)], [ui.downloadClipBtn, "⬇ Download Clip", "Download the selected clip as WAV or MP3"], [ui.bounceBtn, "🧱 Bounce", "Bounce/render the selected clip"]].forEach(([button, label, title]) => {
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
        ui.markersBtn.addEventListener("click", (event) => { event.preventDefault(); event.stopImmediatePropagation(); addMarker(); }, true);
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
          if (note) note.insertAdjacentElement("afterend", wrap); else dialog.prepend(wrap);
        }
        const select = wrap.querySelector("select");
        const current = state.selectedClipId;
        select.innerHTML = "";
        if (!state.clips.length) select.innerHTML = `<option value="">No clips in timeline</option>`;
        else {
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
        if (ui.alignPlayheadBtn) { ui.alignPlayheadBtn.textContent = "⤓ Align to Playhead"; tip(ui.alignPlayheadBtn, "Align selected clip start to the playhead"); if (ui.alignPlayheadBtn.parentElement !== panel) panel.appendChild(ui.alignPlayheadBtn); }
        if (ui.analysisBtn) {
          ui.analysisBtn.textContent = "📈 Analyze";
          tip(ui.analysisBtn, "Analyze the selected clip immediately");
          if (ui.analysisBtn.parentElement !== panel) panel.appendChild(ui.analysisBtn);
          if (ui.analysisBtn.dataset.orgavoxV051Auto !== "true") {
            ui.analysisBtn.dataset.orgavoxV051Auto = "true";
            ui.analysisBtn.addEventListener("click", (event) => { event.preventDefault(); event.stopImmediatePropagation(); closeMenus(); autoAnalyze(); }, true);
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
        if (button.parentElement !== control || button.previousElementSibling !== ui.echoOut) ui.echoOut.insertAdjacentElement("afterend", button);
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
        [edit, view, effects].filter(Boolean).forEach((node) => { editGroup.insertBefore(node, cursor); cursor = node.nextSibling; });
      }
      function tooltips() {
        [[ui.importBtn, "Open/import audio or video files"], [ui.exportBtn, "Save/export the full mix"], [ui.projectBtn, "Save or load an ORGAVOX project"], [ui.undoBtn, "Undo the last edit"], [ui.redoBtn, "Redo the last undone edit"], [ui.playBtn, "Play or pause"], [ui.stopBtn, "Stop playback"], [ui.jumpStartBtn, "Jump back to the start"], [ui.scissorsBtn, "Cut the selected clip at the playhead"], [ui.deleteBtn, "Delete the selected clip"], [ui.downloadClipBtn, "Download the selected clip"], [ui.bounceBtn, "Bounce/render the selected clip"], [ui.markersBtn, "Add a marker at the playhead"], [ui.snapBtn, "Toggle snap-to-grid"], [ui.snapGridSelect, "Choose snap grid size"], [ui.nudgeLeftBtn, "Nudge selected clip left"], [ui.nudgeRightBtn, "Nudge selected clip right"], [ui.alignPlayheadBtn, "Align selected clip to the playhead"], [ui.analysisBtn, "Analyze the selected clip"], [document.querySelector(".orgavox-effects-dropdown-button"), "Open audio effects"], [document.querySelector(".orgavox-edit-button"), "Open editing commands"], [document.querySelector(".orgavox-view-button"), "Open marker, alignment and analysis tools"]].forEach(([button, title]) => tip(button, title));
      }
      function patchRender() {
        if (window.__orgavoxV051MenuRenderPatched) return;
        window.__orgavoxV051MenuRenderPatched = true;
        const previousRenderTimeline = renderTimeline;
        renderTimeline = function orgavoxV051RenderTimeline() { const result = previousRenderTimeline.apply(this, arguments); apply(); return result; };
        const previousSyncSelectedControls = syncSelectedControls;
        syncSelectedControls = function orgavoxV051SyncSelectedControls() { const result = previousSyncSelectedControls.apply(this, arguments); ensureAnalysisPicker(); return result; };
      }
      function apply() { if (applying) return; applying = true; try { restoreEchoSettings(); ensureEdit(); ensureView(); patchMarkerButton(); orderMenus(); ensureAnalysisPicker(); tooltips(); } finally { applying = false; } }
      installStyles(); patchRender(); apply(); setTimeout(apply, 0); setTimeout(apply, 200); setTimeout(apply, 600); window.orgavoxApplyMenuCleanup = apply;
    })();

    // Bundled from simple-edit-v052-interactions.js
    (function installOrgavoxV052Interactions() {
      const STYLE_ID = "orgavox-v052-interactions-style";
      const TRACK_COUNT = 10;
      let multiSelectLock = false;
      let blockShiftClickUntil = 0;
      function installStyles() {
        document.getElementById(STYLE_ID)?.remove();
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
          @keyframes orgavoxMutePulse {0%, 100% { box-shadow:0 0 0 1px rgba(220,72,64,.28),0 0 9px rgba(220,72,64,.2); }50% { box-shadow:0 0 0 1px rgba(255,120,104,.52),0 0 18px rgba(255,90,72,.58); }}
          @keyframes orgavoxSoloPulse {0%, 100% { box-shadow:0 0 0 1px rgba(248,215,146,.28),0 0 9px rgba(248,215,146,.2); }50% { box-shadow:0 0 0 1px rgba(255,236,164,.6),0 0 19px rgba(255,207,72,.62); }}
          body.simple-edit-phase1 .orgavox-track-mix-btn.mute{border-color:rgba(220,72,64,.72)!important;color:#ffc5bc!important;background:rgba(62,16,14,.46)!important;}
          body.simple-edit-phase1 .orgavox-track-mix-btn.solo{border-color:rgba(248,215,146,.72)!important;color:#ffeeb8!important;background:rgba(78,50,8,.46)!important;}
          body.simple-edit-phase1 .orgavox-track-mix-btn.mute.active{border-color:rgba(255,96,76,.96)!important;background:linear-gradient(180deg,rgba(178,42,34,.95),rgba(74,14,12,.98))!important;color:#fff3ef!important;animation:orgavoxMutePulse 1.15s ease-in-out infinite!important;}
          body.simple-edit-phase1 .orgavox-track-mix-btn.solo.active{border-color:rgba(255,224,92,.98)!important;background:linear-gradient(180deg,rgba(217,158,35,.96),rgba(104,66,7,.98))!important;color:#171008!important;animation:orgavoxSoloPulse 1.15s ease-in-out infinite!important;}
          body.simple-edit-phase1 .orgavox-clip-meta-line{left:6px!important;right:auto!important;bottom:4px!important;max-width:calc(100% - 12px)!important;padding:3px 7px!important;border:1px solid rgba(117,178,222,.32)!important;border-radius:8px!important;background:rgba(0,0,0,.78)!important;color:#dff5ff!important;box-shadow:0 2px 8px rgba(0,0,0,.48)!important;}
          body.simple-edit-phase1 .orgavox-track-volume-overlay{background:rgba(0,0,0,.78)!important;border:1px solid rgba(224,163,96,.32)!important;color:#f8d792!important;box-shadow:0 2px 8px rgba(0,0,0,.48)!important;}
          body.simple-edit-phase1 .audio-clip.orgavox-multi-selected{outline:3px solid rgba(248,215,146,.92)!important;box-shadow:0 0 0 1px rgba(248,215,146,.45),0 0 24px rgba(248,215,146,.34),0 5px 16px rgba(0,0,0,.5)!important;}
          body.simple-edit-phase1 .audio-clip.orgavox-multi-selected:not(.selected){border-color:rgba(248,215,146,.92)!important;}
          body.simple-edit-phase1 .track-label-column{overflow:hidden!important;} body.simple-edit-phase1 .track-label-column .track-label{will-change:transform;}
        `;
        document.head.appendChild(style);
      }
      function esc(value) { if (window.CSS && typeof window.CSS.escape === "function") return CSS.escape(String(value)); return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }
      function selectedIds() { if (!Array.isArray(state.selectedClipIds)) state.selectedClipIds = state.selectedClipId ? [state.selectedClipId] : []; state.selectedClipIds = state.selectedClipIds.filter((id) => state.clips.some((clip) => clip.id === id)); if (!state.selectedClipIds.length && state.selectedClipId) state.selectedClipIds = [state.selectedClipId]; return state.selectedClipIds; }
      function trackSettingsList() { if (!Array.isArray(state.trackSettings)) state.trackSettings = []; return state.trackSettings; }
      function trackName(index) { return String(trackSettingsList()[index]?.name || `Track ${index + 1}`); }
      function clipTrackName(clip) { const index = Math.max(0, Math.min(TRACK_COUNT - 1, Number(clip?.track) || 0)); return trackName(index); }
      function updateSelectedSummary() { const ids = selectedIds(); if (ids.length > 1 && ui.selectedClipName) ui.selectedClipName.textContent = `${ids.length} clips selected`; }
      function applyMultiSelectionClasses() { const ids = new Set(selectedIds()); document.querySelectorAll(".audio-clip").forEach((element) => { const active = ids.has(element.dataset.clipId); element.classList.toggle("selected", active || element.dataset.clipId === state.selectedClipId); element.classList.toggle("orgavox-multi-selected", active && ids.size > 1); }); updateSelectedSummary(); }
      function decorateClipMetaLines() { state.clips.forEach((clip) => { const element = document.querySelector(`.audio-clip[data-clip-id="${esc(clip.id)}"]`); if (!element) return; let line = element.querySelector(".orgavox-clip-meta-line"); if (!line) { line = document.createElement("div"); line.className = "orgavox-clip-meta-line"; element.appendChild(line); } const existing = line.textContent || ""; const keyIndex = existing.indexOf("KEY "); const tail = keyIndex >= 0 ? existing.slice(keyIndex) : "KEY -- · BPM -- · FX NONE"; const volume = Math.round(Number(clip.volume) || 100); line.textContent = `VOL ${volume}% · ${clipTrackName(clip)} · ${tail}`; line.title = line.textContent; }); }
      function decorateTrackVolumeOverlays() { document.querySelectorAll(".track-lane").forEach((lane) => { const index = Math.max(0, Math.min(TRACK_COUNT - 1, Number(lane.dataset.track) || 0)); const setting = trackSettingsList()[index] || {}; const volume = Number.isFinite(Number(setting.volume)) ? Math.round(Number(setting.volume)) : 100; const pan = Number(setting.pan) || 0; const bits = [trackName(index), `VOL ${volume}%`]; if (pan) bits.push(`PAN ${pan > 0 ? "+" : ""}${pan}`); if (setting.muted) bits.push("MUTED"); if (setting.solo) bits.push("SOLO"); let overlay = lane.querySelector(".orgavox-track-volume-overlay"); if (!overlay) { overlay = document.createElement("div"); overlay.className = "orgavox-track-volume-overlay"; lane.appendChild(overlay); } overlay.textContent = bits.join(" · "); }); }
      function syncTrackLabelScroll() { const offset = ui.timelineScroll ? Math.max(0, ui.timelineScroll.scrollTop || 0) : 0; document.querySelectorAll(".track-label-column .track-label").forEach((label) => { label.style.transform = `translateY(${-offset}px)`; }); }
      function decorate() { decorateClipMetaLines(); decorateTrackVolumeOverlays(); applyMultiSelectionClasses(); syncTrackLabelScroll(); }
      function toggleShiftSelection(clipId) { const clip = state.clips.find((item) => item.id === clipId); if (!clip) return; let ids = selectedIds().slice(); if (state.selectedClipId && !ids.includes(state.selectedClipId)) ids.push(state.selectedClipId); if (ids.includes(clipId)) { if (ids.length > 1) ids = ids.filter((id) => id !== clipId); } else ids.push(clipId); state.selectedClipIds = ids; state.selectedClipId = clipId; multiSelectLock = true; try { selectClip(clipId, true); } finally { multiSelectLock = false; } state.selectedClipIds = ids; applyMultiSelectionClasses(); syncSelectedControls(); showToast(`${ids.length} clip${ids.length === 1 ? "" : "s"} selected.`); }
      function installShiftMultiSelect() { if (window.__orgavoxV052ShiftMultiSelect) return; window.__orgavoxV052ShiftMultiSelect = true; document.addEventListener("pointerdown", (event) => { const element = event.target.closest?.(".audio-clip"); if (!element || !event.shiftKey || !ui.tracks?.contains(element)) return; event.preventDefault(); event.stopImmediatePropagation(); blockShiftClickUntil = Date.now() + 450; toggleShiftSelection(element.dataset.clipId); }, true); document.addEventListener("click", (event) => { const element = event.target.closest?.(".audio-clip"); if (!element || !event.shiftKey || !ui.tracks?.contains(element)) return; if (Date.now() < blockShiftClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); } }, true); }
      function patchSelectionFunctions() { if (window.__orgavoxV052SelectionPatched) return; window.__orgavoxV052SelectionPatched = true; const previousSelectClip = selectClip; selectClip = function orgavoxV052SelectClip(id, rerender = true) { const result = previousSelectClip.apply(this, arguments); if (!multiSelectLock) state.selectedClipIds = id ? [id] : []; decorate(); return result; }; const previousSyncSelectedControls = syncSelectedControls; syncSelectedControls = function orgavoxV052SyncSelectedControls() { const result = previousSyncSelectedControls.apply(this, arguments); updateSelectedSummary(); return result; }; const previousRenderTimeline = renderTimeline; renderTimeline = function orgavoxV052RenderTimeline() { const result = previousRenderTimeline.apply(this, arguments); decorate(); return result; }; const previousDeleteSelectedClip = deleteSelectedClip; deleteSelectedClip = function orgavoxV052DeleteSelectedClip() { const ids = selectedIds(); if (ids.length <= 1) return previousDeleteSelectedClip.apply(this, arguments); stopPlayback(); state.clips = state.clips.filter((clip) => !ids.includes(clip.id)); state.selectedClipIds = []; state.selectedClipId = null; syncSelectedControls(); renderTimeline(); showToast(`${ids.length} selected clips deleted.`); window.orgavoxRecordHistory?.(); }; }
      function clampPps(value) { return Math.max(25, Math.min(500, Math.round(Number(value) || 80))); }
      function zoomAtPointer(event) { const rect = ui.timelineScroll.getBoundingClientRect(); const localX = Math.max(0, event.clientX - rect.left); const timeAtPointer = (ui.timelineScroll.scrollLeft + localX) / Math.max(1, state.pixelsPerSecond); const delta = event.deltaY || event.deltaX || 0; const factor = delta < 0 ? 1.12 : 1 / 1.12; state.pixelsPerSecond = clampPps(state.pixelsPerSecond * factor); if (ui.zoomSlider) ui.zoomSlider.value = state.pixelsPerSecond; if (ui.zoomOut) ui.zoomOut.textContent = `${Math.round(state.pixelsPerSecond / 80 * 100)}%`; renderTimeline(); ui.timelineScroll.scrollLeft = Math.max(0, timeAtPointer * state.pixelsPerSecond - localX); window.orgavoxRenderMarkers?.(); }
      function installWheelModes() { if (!ui.timelineScroll || ui.timelineScroll.dataset.orgavoxV052WheelModes === "true") return; ui.timelineScroll.dataset.orgavoxV052WheelModes = "true"; ui.timelineScroll.addEventListener("scroll", syncTrackLabelScroll, { passive: true }); ui.timelineScroll.addEventListener("wheel", (event) => { event.preventDefault(); event.stopImmediatePropagation(); if (event.ctrlKey || event.metaKey) { zoomAtPointer(event); return; } if (event.shiftKey) { const amount = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX; ui.timelineScroll.scrollLeft += amount; window.orgavoxRenderMarkers?.(); return; } ui.timelineScroll.scrollTop += event.deltaY; if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.4) ui.timelineScroll.scrollTop += event.deltaX; syncTrackLabelScroll(); }, { passive: false, capture: true }); }
      function refresh() { installStyles(); installWheelModes(); decorate(); }
      window.orgavoxRefreshV052Interactions = refresh; installStyles(); patchSelectionFunctions(); installShiftMultiSelect(); installWheelModes(); decorate(); setTimeout(refresh, 0); setTimeout(refresh, 250);
    })();

    // Bundled from simple-edit-v053-view-restore.js
    (function installOrgavoxV053ViewRestore() {
      const STYLE_ID = "orgavox-v053-view-restore-style";
      const VIEW_ID = "orgavoxViewDropdown";
      function installStyles() { document.getElementById(STYLE_ID)?.remove(); const style = document.createElement("style"); style.id = STYLE_ID; style.textContent = `body.simple-edit-phase1 #${VIEW_ID}.orgavox-view-dropdown{display:inline-flex!important;align-items:center!important;position:relative!important;visibility:visible!important;opacity:1!important;flex:0 0 auto!important;order:30!important;}body.simple-edit-phase1 #${VIEW_ID} .orgavox-view-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:36px!important;border-color:rgba(117,178,222,.86)!important;background:linear-gradient(180deg,rgba(35,80,124,.95),rgba(14,38,72,.98))!important;color:#e1f7ff!important;box-shadow:0 0 0 1px rgba(117,178,222,.2),0 0 14px rgba(75,155,255,.18)!important;}body.simple-edit-phase1 #${VIEW_ID} .orgavox-view-menu{position:absolute!important;top:calc(100% + 8px)!important;left:0!important;z-index:4300!important;min-width:205px!important;display:grid!important;gap:6px!important;padding:8px!important;border:1px solid rgba(117,178,222,.68)!important;border-radius:14px!important;background:rgba(10,11,10,.98)!important;box-shadow:0 18px 44px rgba(0,0,0,.72)!important;}body.simple-edit-phase1 #${VIEW_ID} .orgavox-view-menu[hidden]{display:none!important}body.simple-edit-phase1 #${VIEW_ID} .orgavox-view-menu .tool-button{width:100%!important;justify-content:flex-start!important;min-height:32px!important;}`; document.head.appendChild(style); }
      function tip(button, text) { if (!button || !text) return; button.title = text; button.setAttribute("aria-label", text); }
      function closeOtherMenus(panel) { document.querySelectorAll(".orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu").forEach((other) => { if (other !== panel) other.hidden = true; }); document.querySelectorAll(".orgavox-edit-button,.orgavox-effects-dropdown-button").forEach((button) => button.setAttribute("aria-expanded", "false")); }
      function ensureViewShell() { let wrap = document.getElementById(VIEW_ID); if (!wrap) { wrap = document.createElement("div"); wrap.id = VIEW_ID; wrap.className = "orgavox-view-dropdown"; wrap.innerHTML = `<button class="tool-button orgavox-view-button" type="button" aria-expanded="false">👁 View ▾</button><div class="orgavox-view-menu" hidden></div>`; } wrap.classList.add("orgavox-view-dropdown"); let button = wrap.querySelector(".orgavox-view-button"); let panel = wrap.querySelector(".orgavox-view-menu"); if (!button) { button = document.createElement("button"); button.type = "button"; button.className = "tool-button orgavox-view-button"; wrap.prepend(button); } if (!panel) { panel = document.createElement("div"); panel.className = "orgavox-view-menu"; panel.hidden = true; wrap.appendChild(panel); } button.textContent = "👁 View ▾"; tip(button, "Open marker, alignment and analysis tools"); if (button.dataset.orgavoxV053ViewClick !== "true") { button.dataset.orgavoxV053ViewClick = "true"; button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); const open = panel.hidden; closeOtherMenus(panel); panel.hidden = !open; button.setAttribute("aria-expanded", String(open)); }); } return { wrap, button, panel }; }
      function openMarkersPanel() { const modal = document.getElementById("markersModal"); if (!modal) return showToast("Markers panel is still loading."); modal.hidden = false; const input = modal.querySelector("[data-marker-name]"); if (input && !input.value.trim()) input.value = `Marker ${(state.markers?.length || 0) + 1}`; window.orgavoxRenderMarkers?.(); showToast("Markers panel opened."); }
      function ensurePanelButton(panel, id, label, title, handler) { let button = document.getElementById(id); if (!button) { button = document.createElement("button"); button.id = id; button.type = "button"; button.className = "tool-button"; button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); panel.hidden = true; handler(); }); } button.textContent = label; tip(button, title); if (button.parentElement !== panel) panel.appendChild(button); return button; }
      function refillViewMenu(panel) { ensurePanelButton(panel, "orgavoxMarkerPanelBtn", "🏷 Markers Panel", "Open marker names, colors and cue list", openMarkersPanel); if (ui.alignPlayheadBtn) { ui.alignPlayheadBtn.textContent = "⤓ Align to Playhead"; tip(ui.alignPlayheadBtn, "Align selected clip start to the playhead"); if (ui.alignPlayheadBtn.parentElement !== panel) panel.appendChild(ui.alignPlayheadBtn); } if (ui.analysisBtn) { ui.analysisBtn.textContent = "📈 Analyze"; tip(ui.analysisBtn, "Analyze the selected clip"); if (ui.analysisBtn.parentElement !== panel) panel.appendChild(ui.analysisBtn); } }
      function placeViewMenu() { if (typeof ui === "undefined") return; installStyles(); window.orgavoxApplyMenuCleanup?.(); const editGroup = document.querySelector(".orgavox-edit-group"); if (!editGroup) return; const { wrap, panel } = ensureViewShell(); const edit = document.getElementById("orgavoxEditDropdown"); const effects = editGroup.querySelector(".orgavox-effects-dropdown"); const reference = edit?.nextSibling || effects || editGroup.firstChild; if (wrap.parentElement !== editGroup || wrap.previousElementSibling !== edit) editGroup.insertBefore(wrap, reference); refillViewMenu(panel); }
      function installOutsideClose() { if (window.__orgavoxV053ViewOutsideClose) return; window.__orgavoxV053ViewOutsideClose = true; document.addEventListener("click", (event) => { const wrap = document.getElementById(VIEW_ID); if (!wrap || wrap.contains(event.target)) return; const panel = wrap.querySelector(".orgavox-view-menu"); const button = wrap.querySelector(".orgavox-view-button"); if (panel) panel.hidden = true; if (button) button.setAttribute("aria-expanded", "false"); }); }
      function patchRender() { if (window.__orgavoxV053ViewRenderPatch) return; window.__orgavoxV053ViewRenderPatch = true; const previousRenderTimeline = renderTimeline; renderTimeline = function orgavoxV053RenderTimeline() { const result = previousRenderTimeline.apply(this, arguments); placeViewMenu(); return result; }; }
      window.orgavoxRestoreViewMenu = placeViewMenu; installStyles(); installOutsideClose(); patchRender(); placeViewMenu(); setTimeout(placeViewMenu, 0); setTimeout(placeViewMenu, 200); setTimeout(placeViewMenu, 650);
    })();

    // Bundled from simple-edit-v055-toolbar-input.js
    (function bootOrgavoxV055ToolbarInput() {
      const VERSION = "v0.62 bundled";
      const STYLE_ID = "orgavox-v055-toolbar-input-style";
      let installed = false;
      let scrubPointer = null;
      let suppressClickUntil = 0;
      let recentClipPointerAt = 0;
      let lastAdd = null;
      function css() { document.getElementById(STYLE_ID)?.remove(); const style = document.createElement("style"); style.id = STYLE_ID; style.textContent = `body.simple-edit-phase1 .orgavox-edit-group{align-items:center!important}body.simple-edit-phase1 .orgavox-main-controls-group{display:inline-flex!important;align-items:center!important;flex-wrap:nowrap!important;gap:8px!important;min-width:0!important}body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v055{display:grid!important;grid-template-columns:auto minmax(60px,96px) 42px 34px!important;grid-template-rows:36px!important;align-items:center!important;gap:7px!important;min-width:206px!important;margin:0!important}body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v055 span,body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v055 input,body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v055 output{grid-row:1!important}body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline-v055 #echoSettingsBtn{grid-column:4!important;grid-row:1!important;align-self:center!important;justify-self:center!important;margin:0!important;width:32px!important;min-width:32px!important;height:32px!important;min-height:32px!important;padding:0!important}body.simple-edit-phase1 .orgavox-playhead-step-button{min-width:34px!important;width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;border-color:rgba(117,178,222,.68)!important;background:linear-gradient(180deg,rgba(25,67,106,.88),rgba(8,27,51,.96))!important;color:#dff5ff!important;font:900 .72rem var(--font-mono)!important}body.simple-edit-phase1 #orgavoxSendToStartBtn{border-color:rgba(224,163,96,.72)!important;color:#ffe4a8!important}body.simple-edit-phase1 .timeline-scroll.orgavox-scrubbing,body.simple-edit-phase1 .timeline-scroll.orgavox-scrubbing *{cursor:crosshair!important}body.simple-edit-phase1 .audio-clip{-webkit-user-drag:none!important}`; document.head.appendChild(style); }
      function tip(button, text) { if (!button || !text) return; button.title = text; button.setAttribute("aria-label", text); }
      function setVersion() { window.ORGAVOX_VERSION = VERSION; document.title = `Organon — ORGAVOX ${VERSION}`; document.querySelectorAll(".simple-edit-version,.phase1-version,.orgavox-sidebar-version").forEach((node) => { node.textContent = VERSION; }); }
      function clampTrack(value) { return Math.max(0, Math.min(9, Number(value) || 0)); }
      function clipSelectionIds() { if (Array.isArray(state.selectedClipIds) && state.selectedClipIds.length) return state.selectedClipIds.filter((id) => state.clips.some((clip) => clip.id === id)); return state.selectedClipId ? [state.selectedClipId] : []; }
      function nudgePlayhead(direction, amount) { setPlayhead(Math.max(0, (Number(state.playhead) || 0) + (direction < 0 ? -amount : amount)), true); }
      function ensureStepButtons() { const group = document.querySelector(".orgavox-transport-group") || ui.timeReadout?.parentElement; if (!group || !ui.timeReadout) return; if (!ui.playheadBackStepBtn) { const button = document.createElement("button"); button.id = "playheadBackStepBtn"; button.type = "button"; button.className = "icon-button orgavox-playhead-step-button"; button.textContent = "←"; tip(button, "Move playhead back 0.1 seconds"); button.addEventListener("click", () => nudgePlayhead(-1, 0.1)); ui.playheadBackStepBtn = button; } if (!ui.playheadForwardStepBtn) { const button = document.createElement("button"); button.id = "playheadForwardStepBtn"; button.type = "button"; button.className = "icon-button orgavox-playhead-step-button"; button.textContent = "→"; tip(button, "Move playhead forward 0.1 seconds"); button.addEventListener("click", () => nudgePlayhead(1, 0.1)); ui.playheadForwardStepBtn = button; } if (ui.playheadBackStepBtn.previousElementSibling !== ui.timeReadout) group.insertBefore(ui.playheadBackStepBtn, ui.timeReadout.nextSibling); if (ui.playheadForwardStepBtn.previousElementSibling !== ui.playheadBackStepBtn) group.insertBefore(ui.playheadForwardStepBtn, ui.playheadBackStepBtn.nextSibling); }
      function echoInline() { const control = ui.echoSlider?.closest(".range-control"); const button = document.getElementById("echoSettingsBtn") || ui.echoSettingsBtn; if (!control || !button || !ui.echoOut) return; control.classList.remove("orgavox-echo-inline-v054"); control.classList.add("orgavox-echo-inline-v055"); if (button.parentElement !== control || button.previousElementSibling !== ui.echoOut) ui.echoOut.insertAdjacentElement("afterend", button); ui.echoSettingsBtn = button; }
      function insertAfter(anchor, node) { if (!anchor?.parentElement || !node) return node; if (anchor.nextSibling !== node) anchor.parentElement.insertBefore(node, anchor.nextSibling); return node; }
      function orderToolbar() { const group = document.querySelector(".orgavox-edit-group"); if (!group) return; window.orgavoxRestoreViewMenu?.(); const edit = document.getElementById("orgavoxEditDropdown"); const view = document.getElementById("orgavoxViewDropdown"); const effects = group.querySelector(".orgavox-effects-dropdown") || document.querySelector(".orgavox-effects-dropdown"); const marker = ui.markersBtn || document.getElementById("markersBtn"); const nudgeLeft = ui.nudgeLeftBtn || document.getElementById("nudgeLeftBtn"); const nudgeRight = ui.nudgeRightBtn || document.getElementById("nudgeRightBtn"); const snap = ui.snapBtn || document.getElementById("snapGridBtn"); const snapGrid = ui.snapGridSelect || document.getElementById("snapGridSelect"); const redo = ui.redoBtn || document.getElementById("redoBtn"); if (marker) { marker.textContent = "🏷 Add Marker"; marker.classList.add("orgavox-markers-button"); tip(marker, "Add a marker at the playhead"); } let anchor = redo?.parentElement === group ? redo : null; [edit, view, effects, marker, nudgeLeft, nudgeRight, snap, snapGrid].filter(Boolean).forEach((node) => { if (anchor) insertAfter(anchor, node); else group.insertBefore(node, group.firstChild); anchor = node; }); }
      function sendToStart() { const ids = clipSelectionIds(); const clips = state.clips.filter((clip) => ids.includes(clip.id)); if (!clips.length) return showToast("Select a clip to send to start."); stopPlayback(); if (clips.length === 1) clips[0].start = 0; else { const earliest = Math.min(...clips.map((clip) => Math.max(0, Number(clip.start) || 0))); clips.forEach((clip) => { clip.start = Math.max(0, (Number(clip.start) || 0) - earliest); }); } renderTimeline(); syncSelectedControls(); showToast(clips.length === 1 ? "Clip sent to start." : `${clips.length} clips sent to start.`); window.orgavoxRecordHistory?.(); }
      function addSendToStart() { const panel = document.querySelector("#orgavoxViewDropdown .orgavox-view-menu"); if (!panel) return; let button = document.getElementById("orgavoxSendToStartBtn"); if (!button) { button = document.createElement("button"); button.id = "orgavoxSendToStartBtn"; button.type = "button"; button.className = "tool-button"; button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); panel.hidden = true; sendToStart(); }); } button.textContent = "↤ Send to Start"; tip(button, "Move the selected clip to 0:00"); const markerPanel = document.getElementById("orgavoxMarkerPanelBtn"); if (markerPanel?.parentElement === panel) insertAfter(markerPanel, button); else if (button.parentElement !== panel) panel.prepend(button); }
      function keyboard() { if (window.__orgavoxV055KeyboardPlayhead) return; window.__orgavoxV055KeyboardPlayhead = true; document.addEventListener("keydown", (event) => { const target = event.target; const typing = target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable); if (typing || event.defaultPrevented || event.altKey) return; if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); const amount = event.shiftKey ? 10 : (event.ctrlKey || event.metaKey ? 1 : 0.1); nudgePlayhead(event.key === "ArrowLeft" ? -1 : 1, amount); }, true); }
      function timeFromEvent(event) { const rect = ui.timelineScroll.getBoundingClientRect(); return Math.max(0, ((event.clientX - rect.left) + ui.timelineScroll.scrollLeft) / Math.max(1, Number(state.pixelsPerSecond) || 80)); }
      function scrubHit(event) { const target = event.target; if (!target || !ui.timelineScroll?.contains(target)) return null; if (target.closest?.(".audio-clip,.clip-handle,button,input,select,textarea,label,.track-label-column,.asset-list,.library-panel,.popover,.modal-backdrop")) return null; const lane = target.closest?.(".track-lane"); if (target === ui.rulerCanvas || lane || target.closest?.("#tracks,.tracks,.timeline-content")) return { lane }; return null; }
      function scrub() { if (!ui.timelineScroll || ui.timelineScroll.dataset.orgavoxV055Scrub === "true") return; ui.timelineScroll.dataset.orgavoxV055Scrub = "true"; ui.timelineScroll.addEventListener("pointerdown", (event) => { if (event.button != null && event.button !== 0) return; const hit = scrubHit(event); if (!hit) return; event.preventDefault(); event.stopImmediatePropagation(); if (hit.lane) selectTrack(hit.lane.dataset.track); scrubPointer = event.pointerId; ui.timelineScroll.classList.add("orgavox-scrubbing"); ui.timelineScroll.setPointerCapture?.(event.pointerId); setPlayhead(timeFromEvent(event), false); }, true); ui.timelineScroll.addEventListener("pointermove", (event) => { if (scrubPointer == null || event.pointerId !== scrubPointer) return; event.preventDefault(); event.stopImmediatePropagation(); setPlayhead(timeFromEvent(event), false); }, true); function done(event) { if (scrubPointer == null || event.pointerId !== scrubPointer) return; event.preventDefault(); event.stopImmediatePropagation(); ui.timelineScroll.releasePointerCapture?.(event.pointerId); ui.timelineScroll.classList.remove("orgavox-scrubbing"); scrubPointer = null; suppressClickUntil = Date.now() + 220; } ui.timelineScroll.addEventListener("pointerup", done, true); ui.timelineScroll.addEventListener("pointercancel", done, true); ui.timelineScroll.addEventListener("click", (event) => { if (Date.now() > suppressClickUntil || !scrubHit(event)) return; event.preventDefault(); event.stopImmediatePropagation(); }, true); }
      function dragCopyGuard() { if (window.__orgavoxV055DragCopyGuard) return; window.__orgavoxV055DragCopyGuard = true; document.addEventListener("pointerdown", (event) => { if (!event.target.closest?.(".audio-clip")) return; recentClipPointerAt = Date.now(); state.dragAssetId = null; }, true); document.addEventListener("dragstart", (event) => { if (!event.target.closest?.(".audio-clip")) return; event.preventDefault(); event.stopImmediatePropagation(); recentClipPointerAt = Date.now(); state.dragAssetId = null; }, true); document.addEventListener("drop", (event) => { if (!ui.timelineScroll?.contains(event.target)) return; if (Date.now() - recentClipPointerAt < 1400 && !state.dragAssetId) { event.preventDefault(); event.stopImmediatePropagation(); return; } setTimeout(() => { state.dragAssetId = null; }, 0); }, true); const oldAdd = addClipFromAsset; addClipFromAsset = function orgavoxV055AddClipFromAsset(assetId, track, start) { const now = Date.now(); const t = clampTrack(track); const s = Math.max(0, Number(start) || 0); const repeat = lastAdd && now - lastAdd.time < 900 && String(assetId || "") === lastAdd.assetId && t === lastAdd.track && Math.abs(s - lastAdd.start) < 0.3; const suspicious = now - recentClipPointerAt < 700 && !state.dragAssetId; if (repeat || suspicious) { showToast("Duplicate clip add ignored."); return null; } const before = state.clips.length; const result = oldAdd.apply(this, arguments); if (state.clips.length > before) lastAdd = { time: now, assetId: String(assetId || ""), track: t, start: s }; return result; }; }
      function disableClipDrag() { document.querySelectorAll(".audio-clip").forEach((clip) => { clip.draggable = false; clip.setAttribute("draggable", "false"); }); }
      function refresh() { setVersion(); css(); ensureStepButtons(); echoInline(); orderToolbar(); addSendToStart(); scrub(); disableClipDrag(); }
      function patchRender() { if (window.__orgavoxV055RenderPatch) return; window.__orgavoxV055RenderPatch = true; const oldRender = renderTimeline; renderTimeline = function orgavoxV055RenderTimeline() { const result = oldRender.apply(this, arguments); refresh(); return result; }; }
      function install() { if (installed) return; installed = true; css(); keyboard(); scrub(); dragCopyGuard(); patchRender(); refresh(); setTimeout(refresh, 0); setTimeout(refresh, 180); setTimeout(refresh, 500); setTimeout(refresh, 1200); }
      install();
    })();
  }

  installLocalSoundFxRouting();
  const files = [
    "./simple-edit-core.js?v=0.01", "./simple-edit-timeline.js?v=0.01", "./simple-edit-audio.js?v=0.26", "./simple-edit-export.js?v=0.02", "./simple-edit-phase1.js?v=0.33",
    "./simple-edit-keyframes.js?v=0.10", "./simple-edit-keyframes-fix.js?v=0.11", "./simple-edit-phase3.js?v=0.13", "./simple-edit-effects-library.js?v=0.15", "./simple-edit-echo-settings.js?v=0.51",
    "./simple-edit-stretch-audiotsm.js?v=0.19", "./simple-edit-fade-handles.js?v=0.20", "./simple-edit-normalize.js?v=0.21", "./simple-edit-transpose-engine.js?v=0.26", "./simple-edit-transpose.js?v=0.26",
    "./simple-edit-eq-engine.js?v=0.28", "./simple-edit-eq.js?v=0.28", "./simple-edit-drive-engine.js?v=0.29", "./simple-edit-drive.js?v=0.29", "./simple-edit-dynamics-engine.js?v=0.30", "./simple-edit-dynamics.js?v=0.30",
    "./simple-edit-stereo-engine.js?v=0.35", "./simple-edit-stereo.js?v=0.35", "./simple-edit-lofi-engine.js?v=0.37", "./simple-edit-lofi.js?v=0.37", "./simple-edit-render-tools-engine.js?v=0.38", "./simple-edit-render-tools.js?v=0.46",
    "./simple-edit-analysis.js?v=0.40", "./simple-edit-project.js?v=0.49", "./simple-edit-markers.js?v=0.43", "./simple-edit-build1.js?v=0.44", "./simple-edit-track-tools.js?v=0.45", "./simple-edit-clip-menu.js?v=0.46", "./simple-edit-snap-tools.js?v=0.47", "./simple-edit-library-tools.js?v=0.48", "./simple-edit-build6.js?v=0.49", "./simple-edit-cleanup.js?v=0.50"
  ];

  window.ORGAVOX_ACTIVE_SCRIPTS = files.concat(["inline:simple-edit-menus-v051", "inline:simple-edit-v052-interactions", "inline:simple-edit-v053-view-restore", "inline:simple-edit-v055-toolbar-input"]);

  for (const source of files) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${source}`));
      document.head.appendChild(script);
    });
  }

  installBundledUiPatches();
  refreshFinalLayout();
  document.documentElement.classList.remove("orgavox-loading");
  document.getElementById("orgavox-boot-style")?.remove();
  if (typeof setStatus === "function") setStatus("Ready — ORGAVOX loaded");
  [0, 150, 500, 1200, 2200].forEach((delay) => setTimeout(refreshFinalLayout, delay));
  window.addEventListener("resize", () => setTimeout(refreshFinalLayout, 0));
})().catch((error) => {
  console.error(error);
  document.documentElement.classList.remove("orgavox-loading");
  const status = document.getElementById("statusPill");
  if (status) status.textContent = "ORGAVOX failed to load";
});