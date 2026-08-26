"use strict";

(function installOrgavoxConsolidatedUI() {
  const STYLE_ID = "orgavox-consolidated-ui-style";
  const VERSION_LABEL = "v0.60 consolidated";
  let installed = false;
  let scrubPointer = null;
  let suppressClickUntil = 0;
  let recentClipPointerAt = 0;
  let lastAssetAdd = null;
  let multiSelectLock = false;

  function ready() {
    return typeof ui !== "undefined"
      && typeof state !== "undefined"
      && typeof renderTimeline === "function"
      && typeof syncSelectedControls === "function"
      && typeof setPlayhead === "function"
      && typeof addClipFromAsset === "function";
  }

  function tip(button, text) {
    if (!button || !text) return;
    button.title = text;
    button.setAttribute("aria-label", text);
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes orgavoxMutePulse{from{box-shadow:0 0 0 1px rgba(255,82,72,.32),0 0 10px rgba(255,82,72,.18)}to{box-shadow:0 0 0 2px rgba(255,118,98,.78),0 0 24px rgba(255,82,72,.54)}}
      @keyframes orgavoxSoloPulse{from{box-shadow:0 0 0 1px rgba(248,215,146,.34),0 0 10px rgba(248,215,146,.18)}to{box-shadow:0 0 0 2px rgba(255,229,137,.82),0 0 24px rgba(248,215,146,.56)}}
      @keyframes orgavoxPlayPulse{from{box-shadow:0 0 0 1px rgba(117,178,222,.35),0 0 12px rgba(75,155,255,.28);transform:translateY(0)}to{box-shadow:0 0 0 1px rgba(168,220,255,.74),0 0 25px rgba(75,155,255,.62);transform:translateY(-1px)}}
      body.simple-edit-phase1 .topbar .tool-button,body.simple-edit-phase1 .topbar .icon-button{min-height:36px!important;height:36px!important;align-items:center!important}
      body.simple-edit-phase1 .topbar .tool-button,body.simple-edit-phase1 .topbar .icon-button,body.simple-edit-phase1 .topbar .range-control span,body.simple-edit-phase1 .topbar .range-control output{font-size:.62rem!important;line-height:1!important;font-weight:800!important}
      body.simple-edit-phase1 .orgavox-main-controls-group{display:inline-flex!important;align-items:center!important;flex-wrap:nowrap!important;gap:8px!important;min-width:0!important}
      body.simple-edit-phase1 .orgavox-edit-group{align-items:center!important}
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline{display:grid!important;grid-template-columns:auto minmax(60px,96px) 42px 34px!important;grid-template-rows:36px!important;align-items:center!important;gap:7px!important;min-width:206px!important;margin:0!important}
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline span,body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline input,body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline output{grid-row:1!important}
      body.simple-edit-phase1 .topbar .range-control.orgavox-echo-inline #echoSettingsBtn{grid-column:4!important;grid-row:1!important;align-self:center!important;justify-self:center!important;margin:0!important;width:32px!important;min-width:32px!important;height:32px!important;min-height:32px!important;padding:0!important}
      #playBtn.orgavox-play-blue{border-color:rgba(117,178,222,.96)!important;background:linear-gradient(180deg,rgba(54,143,220,.98),rgba(21,72,139,.96))!important;color:#eef8ff!important;box-shadow:0 0 0 1px rgba(117,178,222,.24),0 0 14px rgba(75,155,255,.2)!important}
      #playBtn.orgavox-playing{animation:orgavoxPlayPulse .78s ease-in-out infinite alternate!important}
      body.simple-edit-phase1 .orgavox-playhead-step-button{min-width:34px!important;width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;border-color:rgba(117,178,222,.68)!important;background:linear-gradient(180deg,rgba(25,67,106,.88),rgba(8,27,51,.96))!important;color:#dff5ff!important;font:900 .72rem var(--font-mono)!important}
      body.simple-edit-phase1 #importBtn.orgavox-open-button{border-color:rgba(117,178,222,.92)!important;background:linear-gradient(180deg,rgba(57,132,205,.96),rgba(31,77,133,.94))!important;color:#eef8ff!important;box-shadow:0 0 0 1px rgba(117,178,222,.24),0 0 14px rgba(75,155,255,.24)!important}
      body.simple-edit-phase1 #exportBtn.orgavox-save-button{border-color:rgba(74,190,117,.86)!important;background:linear-gradient(180deg,rgba(35,118,66,.92),rgba(14,62,35,.94))!important;color:#e2ffe9!important;box-shadow:0 0 0 1px rgba(74,190,117,.22),0 0 14px rgba(74,190,117,.22)!important}
      body.simple-edit-phase1 #stopBtn.orgavox-stop-danger,body.simple-edit-phase1 #scissorsBtn.orgavox-danger-tool,body.simple-edit-phase1 #deleteBtn.orgavox-danger-tool{border-color:rgba(220,72,64,.76)!important;background:linear-gradient(180deg,rgba(89,29,26,.84),rgba(35,13,12,.94))!important;color:#ffd8d2!important;box-shadow:0 0 0 1px rgba(220,72,64,.2),0 0 14px rgba(220,72,64,.2)!important}
      body.simple-edit-phase1 .orgavox-fade-tool{border-color:rgba(74,190,117,.76)!important;background:linear-gradient(180deg,rgba(28,89,52,.74),rgba(12,42,25,.9))!important;color:#d6ffe4!important}
      body.simple-edit-phase1 .orgavox-effects-library-button{border-color:rgba(178,109,255,.86)!important;background:linear-gradient(180deg,rgba(87,46,148,.88),rgba(37,22,74,.96))!important;color:#f1ddff!important}
      .orgavox-track-mix-btn.mute{border-color:rgba(220,72,64,.58)!important;color:#ffd7d2!important}
      .orgavox-track-mix-btn.solo{border-color:rgba(248,215,146,.68)!important;color:#ffe7a8!important}
      .orgavox-track-mix-btn.mute.active{background:linear-gradient(180deg,rgba(180,45,38,.98),rgba(82,18,16,.98))!important;border-color:rgba(255,94,82,.95)!important;color:#fff2ef!important;animation:orgavoxMutePulse .82s ease-in-out infinite alternate!important}
      .orgavox-track-mix-btn.solo.active{background:linear-gradient(180deg,rgba(230,179,54,.98),rgba(116,75,15,.98))!important;border-color:rgba(255,225,116,.98)!important;color:#211407!important;animation:orgavoxSoloPulse .82s ease-in-out infinite alternate!important}
      .orgavox-clip-meta-line,.orgavox-track-volume-overlay{background:rgba(0,0,0,.76)!important;border:1px solid rgba(248,215,146,.22)!important;border-radius:9px!important;padding:3px 7px!important;box-shadow:0 2px 8px rgba(0,0,0,.32)!important;color:#f8d792!important}
      .audio-clip.orgavox-multi-selected{outline:3px solid rgba(248,215,146,.88)!important;box-shadow:0 0 0 2px rgba(0,0,0,.45),0 0 22px rgba(248,215,146,.45)!important}
      body.simple-edit-phase1 .timeline-scroll.orgavox-scrubbing,body.simple-edit-phase1 .timeline-scroll.orgavox-scrubbing *{cursor:crosshair!important}
      body.simple-edit-phase1 .audio-clip{-webkit-user-drag:none!important}
      body.simple-edit-phase1 #orgavoxViewDropdown.orgavox-view-dropdown{display:inline-flex!important;align-items:center!important;position:relative!important;visibility:visible!important;opacity:1!important;flex:0 0 auto!important}
      body.simple-edit-phase1 #orgavoxViewDropdown .orgavox-view-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:36px!important;border-color:rgba(117,178,222,.86)!important;background:linear-gradient(180deg,rgba(35,80,124,.95),rgba(14,38,72,.98))!important;color:#e1f7ff!important;box-shadow:0 0 0 1px rgba(117,178,222,.2),0 0 14px rgba(75,155,255,.18)!important}
      body.simple-edit-phase1 #orgavoxViewDropdown .orgavox-view-menu{position:absolute!important;top:calc(100% + 8px)!important;left:0!important;z-index:4300!important;min-width:205px!important;display:grid!important;gap:6px!important;padding:8px!important;border:1px solid rgba(117,178,222,.68)!important;border-radius:14px!important;background:rgba(10,11,10,.98)!important;box-shadow:0 18px 44px rgba(0,0,0,.72)!important}
      body.simple-edit-phase1 #orgavoxViewDropdown .orgavox-view-menu[hidden]{display:none!important}
      body.simple-edit-phase1 #orgavoxViewDropdown .orgavox-view-menu .tool-button{width:100%!important;justify-content:flex-start!important;min-height:32px!important}
      body.simple-edit-phase1 .time-readout{font-size:.94rem!important;min-height:36px!important;padding:9px 14px!important;letter-spacing:.08em!important}
      body.simple-edit-phase1 .orgavox-leading-divider{display:inline-flex!important;flex:0 0 1px!important;min-height:36px!important;margin-left:0!important}
      body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control{display:grid!important;grid-template-columns:1fr auto!important;grid-template-rows:auto auto!important;gap:6px 10px!important;align-items:center!important}
      body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control span{grid-column:1!important;grid-row:1!important}
      body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control output{grid-column:2!important;grid-row:1!important;text-align:right!important;color:#f8d792!important}
      body.simple-edit-phase1 .orgavox-sidebar-zoom .range-control input[type="range"]{grid-column:1 / -1!important;grid-row:2!important;width:100%!important}
      @media (max-width:1380px){body.simple-edit-phase1{--topbar-h:158px!important}}
    `;
    document.head.appendChild(style);
  }

  function setVersion() {
    window.ORGAVOX_VERSION = VERSION_LABEL;
    document.title = `Organon — ORGAVOX ${VERSION_LABEL}`;
    document.querySelectorAll(".simple-edit-version,.phase1-version,.orgavox-sidebar-version").forEach((node) => { node.textContent = VERSION_LABEL; });
  }

  function clipSelectionIds() {
    if (Array.isArray(state.selectedClipIds) && state.selectedClipIds.length) {
      return state.selectedClipIds.filter((id) => state.clips.some((clip) => clip.id === id));
    }
    return state.selectedClipId ? [state.selectedClipId] : [];
  }

  function selectedClips() {
    return clipSelectionIds().map((id) => state.clips.find((clip) => clip.id === id)).filter(Boolean);
  }

  function ensureStepButtons() {
    const group = document.querySelector(".orgavox-transport-group") || ui.timeReadout?.parentElement;
    if (!group || !ui.timeReadout) return;
    if (!ui.playheadBackStepBtn) {
      const button = document.createElement("button");
      button.id = "playheadBackStepBtn";
      button.type = "button";
      button.className = "icon-button orgavox-playhead-step-button";
      button.textContent = "←";
      tip(button, "Move playhead back 0.1 seconds");
      button.addEventListener("click", () => setPlayhead(Math.max(0, (Number(state.playhead) || 0) - 0.1), true));
      ui.playheadBackStepBtn = button;
    }
    if (!ui.playheadForwardStepBtn) {
      const button = document.createElement("button");
      button.id = "playheadForwardStepBtn";
      button.type = "button";
      button.className = "icon-button orgavox-playhead-step-button";
      button.textContent = "→";
      tip(button, "Move playhead forward 0.1 seconds");
      button.addEventListener("click", () => setPlayhead(Math.max(0, (Number(state.playhead) || 0) + 0.1), true));
      ui.playheadForwardStepBtn = button;
    }
    if (ui.playheadBackStepBtn.previousElementSibling !== ui.timeReadout) group.insertBefore(ui.playheadBackStepBtn, ui.timeReadout.nextSibling);
    if (ui.playheadForwardStepBtn.previousElementSibling !== ui.playheadBackStepBtn) group.insertBefore(ui.playheadForwardStepBtn, ui.playheadBackStepBtn.nextSibling);
  }

  function echoInline() {
    const control = ui.echoSlider?.closest(".range-control");
    const button = document.getElementById("echoSettingsBtn") || ui.echoSettingsBtn;
    if (!control || !button || !ui.echoOut) return;
    control.classList.add("orgavox-echo-inline");
    if (button.parentElement !== control || button.previousElementSibling !== ui.echoOut) ui.echoOut.insertAdjacentElement("afterend", button);
    ui.echoSettingsBtn = button;
  }

  function closeOtherMenus(panel) {
    document.querySelectorAll(".orgavox-edit-menu,.orgavox-view-menu,.orgavox-effects-menu").forEach((other) => { if (other !== panel) other.hidden = true; });
    document.querySelectorAll(".orgavox-edit-button,.orgavox-view-button,.orgavox-effects-dropdown-button").forEach((button) => button.setAttribute("aria-expanded", "false"));
  }

  function ensureViewMenu() {
    const editGroup = document.querySelector(".orgavox-edit-group");
    if (!editGroup) return null;
    let wrap = document.getElementById("orgavoxViewDropdown");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "orgavoxViewDropdown";
      wrap.className = "orgavox-view-dropdown";
      wrap.innerHTML = `<button class="tool-button orgavox-view-button" type="button" aria-expanded="false">👁 View ▾</button><div class="orgavox-view-menu" hidden></div>`;
    }
    wrap.classList.add("orgavox-view-dropdown");
    let button = wrap.querySelector(".orgavox-view-button");
    let panel = wrap.querySelector(".orgavox-view-menu");
    if (!button) { button = document.createElement("button"); button.type = "button"; button.className = "tool-button orgavox-view-button"; wrap.prepend(button); }
    if (!panel) { panel = document.createElement("div"); panel.className = "orgavox-view-menu"; panel.hidden = true; wrap.appendChild(panel); }
    button.textContent = "👁 View ▾";
    tip(button, "Open marker, alignment and analysis tools");
    if (button.dataset.orgavoxViewBound !== "true") {
      button.dataset.orgavoxViewBound = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const open = panel.hidden;
        closeOtherMenus(panel);
        panel.hidden = !open;
        button.setAttribute("aria-expanded", String(open));
      });
    }
    return { wrap, panel };
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

  function ensurePanelButton(panel, id, label, title, handler) {
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
    button.textContent = label;
    tip(button, title);
    if (button.parentElement !== panel) panel.appendChild(button);
    return button;
  }

  function sendToStart() {
    const clips = selectedClips();
    if (!clips.length) return showToast("Select a clip to send to start.");
    stopPlayback();
    if (clips.length === 1) clips[0].start = 0;
    else {
      const earliest = Math.min(...clips.map((clip) => Math.max(0, Number(clip.start) || 0)));
      clips.forEach((clip) => { clip.start = Math.max(0, (Number(clip.start) || 0) - earliest); });
    }
    renderTimeline();
    syncSelectedControls();
    showToast(clips.length === 1 ? "Clip sent to start." : `${clips.length} clips sent to start.`);
    window.orgavoxRecordHistory?.();
  }

  function refillViewMenu(panel) {
    ensurePanelButton(panel, "orgavoxMarkerPanelBtn", "🏷 Markers Panel", "Open marker names, colors and cue list", openMarkersPanel);
    ensurePanelButton(panel, "orgavoxSendToStartBtn", "↤ Send to Start", "Move the selected clip to 0:00", sendToStart);
    if (ui.alignPlayheadBtn) { ui.alignPlayheadBtn.textContent = "⤓ Align to Playhead"; tip(ui.alignPlayheadBtn, "Align selected clip start to the playhead"); if (ui.alignPlayheadBtn.parentElement !== panel) panel.appendChild(ui.alignPlayheadBtn); }
    if (ui.analysisBtn) { ui.analysisBtn.textContent = "📈 Analyze"; tip(ui.analysisBtn, "Analyze the selected clip"); if (ui.analysisBtn.parentElement !== panel) panel.appendChild(ui.analysisBtn); }
  }

  function insertAfter(anchor, node) {
    if (!anchor?.parentElement || !node) return node;
    if (anchor.nextSibling !== node) anchor.parentElement.insertBefore(node, anchor.nextSibling);
    return node;
  }

  function orderToolbar() {
    const group = document.querySelector(".orgavox-edit-group");
    if (!group) return;
    const { wrap: view, panel } = ensureViewMenu() || {};
    if (panel) refillViewMenu(panel);
    const edit = document.getElementById("orgavoxEditDropdown");
    const effects = group.querySelector(".orgavox-effects-dropdown") || document.querySelector(".orgavox-effects-dropdown");
    const marker = ui.markersBtn || document.getElementById("markersBtn");
    const nudgeLeft = ui.nudgeLeftBtn || document.getElementById("nudgeLeftBtn");
    const nudgeRight = ui.nudgeRightBtn || document.getElementById("nudgeRightBtn");
    const snap = ui.snapBtn || document.getElementById("snapGridBtn");
    const snapGrid = ui.snapGridSelect || document.getElementById("snapGridSelect");
    const redo = ui.redoBtn || document.getElementById("redoBtn");
    if (marker) { marker.textContent = "🏷 Add Marker"; marker.classList.add("orgavox-markers-button"); tip(marker, "Add a marker at the playhead"); }
    let anchor = redo?.parentElement === group ? redo : null;
    [edit, view, effects, marker, nudgeLeft, nudgeRight, snap, snapGrid].filter(Boolean).forEach((node) => {
      if (anchor) insertAfter(anchor, node);
      else group.insertBefore(node, group.firstChild);
      anchor = node;
    });
  }

  function keepFeatureButtonsInMenu() {
    const menu = document.querySelector(".orgavox-effects-menu");
    if (!menu) return;
    [ui.gateBtn, ui.stretchBtn, ui.normalizeBtn, ui.transposeBtn, ui.eqBtn, ui.driveBtn, ui.dynamicsBtn, ui.stereoBtn, ui.lofiBtn, ui.reverseClipBtn]
      .filter(Boolean)
      .forEach((button) => { if (button.parentElement !== menu) menu.appendChild(button); });
  }

  function applyButtonStyling() {
    if (ui.importBtn) { ui.importBtn.textContent = "📥 Open"; ui.importBtn.classList.remove("primary"); ui.importBtn.classList.add("orgavox-open-button"); }
    if (ui.exportBtn) { ui.exportBtn.textContent = "💾 Save"; ui.exportBtn.classList.add("orgavox-save-button"); }
    if (ui.stopBtn) ui.stopBtn.classList.add("orgavox-stop-danger");
    if (ui.scissorsBtn) { ui.scissorsBtn.textContent = "✂️ Snip"; ui.scissorsBtn.classList.add("orgavox-danger-tool"); tip(ui.scissorsBtn, "Snip/split selected clip at the playhead"); }
    if (ui.deleteBtn) { ui.deleteBtn.textContent = "🗑 DEL"; ui.deleteBtn.classList.add("orgavox-danger-tool"); }
    [ui.fadeInBtn, ui.fadeOutBtn, ui.resetFadesBtn].filter(Boolean).forEach((button) => button.classList.add("orgavox-fade-tool"));
    const effectsLibrary = document.querySelector(".effects-library-button") || [...document.querySelectorAll("button")].find((button) => /effects library/i.test(button.textContent || ""));
    if (effectsLibrary) effectsLibrary.classList.add("orgavox-effects-library-button");
    if (ui.playBtn) ui.playBtn.classList.add("orgavox-play-blue");
  }

  function trackName(index) {
    return state.trackSettings?.[index]?.name || `Track ${index + 1}`;
  }

  function refreshMetaAndOverlays() {
    document.querySelectorAll(".audio-clip[data-clip-id]").forEach((node) => {
      const clip = state.clips.find((item) => item.id === node.dataset.clipId);
      if (!clip) return;
      const line = node.querySelector(".orgavox-clip-meta-line") || node.querySelector(".clip-meta") || document.createElement("div");
      if (!line.parentElement) node.appendChild(line);
      line.className = "orgavox-clip-meta-line";
      const oldText = line.textContent || "KEY -- · BPM -- · FX NONE";
      const keyIndex = oldText.indexOf("KEY ");
      const tail = keyIndex >= 0 ? oldText.slice(keyIndex) : "KEY -- · BPM -- · FX NONE";
      line.textContent = `VOL ${Math.round(Number(clip.volume ?? 100))}% · ${trackName(clip.track)} · ${tail}`;
    });
    document.querySelectorAll(".track-lane[data-track]").forEach((lane) => {
      const index = Number(lane.dataset.track) || 0;
      let overlay = lane.querySelector(".orgavox-track-volume-overlay");
      if (!overlay) { overlay = document.createElement("div"); overlay.className = "orgavox-track-volume-overlay"; lane.appendChild(overlay); }
      const setting = state.trackSettings?.[index] || {};
      const bits = [`${trackName(index)}`, `VOL ${Math.round(Number(setting.volume ?? 100))}%`];
      if (Number(setting.pan || 0) !== 0) bits.push(`PAN ${Math.round(Number(setting.pan) || 0)}`);
      if (setting.muted) bits.push("MUTED");
      if (setting.solo) bits.push("SOLO");
      overlay.textContent = bits.join(" · ");
    });
  }

  function setMultiSelection(ids) {
    state.selectedClipIds = ids.filter((id) => state.clips.some((clip) => clip.id === id));
    document.querySelectorAll(".audio-clip").forEach((node) => {
      const selected = state.selectedClipIds.includes(node.dataset.clipId);
      node.classList.toggle("orgavox-multi-selected", selected && node.dataset.clipId !== state.selectedClipId);
      node.classList.toggle("selected", selected && node.dataset.clipId === state.selectedClipId);
    });
  }

  function installShiftMultiSelect() {
    if (window.__orgavoxConsolidatedShiftMultiSelect) return;
    window.__orgavoxConsolidatedShiftMultiSelect = true;
    document.addEventListener("pointerdown", (event) => {
      if (!event.shiftKey || event.button !== 0) return;
      const clipNode = event.target.closest?.(".audio-clip[data-clip-id]");
      if (!clipNode) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = clipNode.dataset.clipId;
      const current = clipSelectionIds();
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      multiSelectLock = true;
      state.selectedClipId = id;
      selectClip(id, true);
      multiSelectLock = false;
      setMultiSelection(next.length ? next : [id]);
      syncSelectedControls();
      showToast(`${state.selectedClipIds.length} clip${state.selectedClipIds.length === 1 ? "" : "s"} selected.`);
    }, true);
  }

  function keyboard() {
    if (window.__orgavoxConsolidatedKeyboard) return;
    window.__orgavoxConsolidatedKeyboard = true;
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target && (/input|textarea|select/i.test(target.tagName || "") || target.isContentEditable);
      if (typing || event.defaultPrevented || event.altKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const amount = event.shiftKey ? 10 : (event.ctrlKey || event.metaKey ? 1 : 0.1);
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      setPlayhead(Math.max(0, (Number(state.playhead) || 0) + direction * amount), true);
    }, true);
  }

  function timeFromEvent(event) {
    const rect = ui.timelineScroll.getBoundingClientRect();
    return Math.max(0, ((event.clientX - rect.left) + ui.timelineScroll.scrollLeft) / Math.max(1, Number(state.pixelsPerSecond) || 80));
  }

  function scrubHit(event) {
    const target = event.target;
    if (!target || !ui.timelineScroll?.contains(target)) return null;
    if (target.closest?.(".audio-clip,.clip-handle,button,input,select,textarea,label,.track-label-column,.asset-list,.library-panel,.popover,.modal-backdrop")) return null;
    const lane = target.closest?.(".track-lane");
    if (target === ui.rulerCanvas || lane || target.closest?.("#tracks,.tracks,.timeline-content")) return { lane };
    return null;
  }

  function scrub() {
    if (!ui.timelineScroll || ui.timelineScroll.dataset.orgavoxConsolidatedScrub === "true") return;
    ui.timelineScroll.dataset.orgavoxConsolidatedScrub = "true";
    ui.timelineScroll.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) return;
      const hit = scrubHit(event);
      if (!hit) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (hit.lane) selectTrack(hit.lane.dataset.track);
      scrubPointer = event.pointerId;
      ui.timelineScroll.classList.add("orgavox-scrubbing");
      ui.timelineScroll.setPointerCapture?.(event.pointerId);
      setPlayhead(timeFromEvent(event), false);
    }, true);
    ui.timelineScroll.addEventListener("pointermove", (event) => {
      if (scrubPointer == null || event.pointerId !== scrubPointer) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setPlayhead(timeFromEvent(event), false);
    }, true);
    function done(event) {
      if (scrubPointer == null || event.pointerId !== scrubPointer) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      ui.timelineScroll.releasePointerCapture?.(event.pointerId);
      ui.timelineScroll.classList.remove("orgavox-scrubbing");
      scrubPointer = null;
      suppressClickUntil = Date.now() + 220;
    }
    ui.timelineScroll.addEventListener("pointerup", done, true);
    ui.timelineScroll.addEventListener("pointercancel", done, true);
    ui.timelineScroll.addEventListener("click", (event) => {
      if (Date.now() > suppressClickUntil || !scrubHit(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function dragCopyGuard() {
    if (window.__orgavoxConsolidatedDragCopyGuard) return;
    window.__orgavoxConsolidatedDragCopyGuard = true;
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest?.(".audio-clip")) return;
      recentClipPointerAt = Date.now();
      state.dragAssetId = null;
    }, true);
    document.addEventListener("dragstart", (event) => {
      if (!event.target.closest?.(".audio-clip")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      recentClipPointerAt = Date.now();
      state.dragAssetId = null;
    }, true);
    document.addEventListener("drop", (event) => {
      if (!ui.timelineScroll?.contains(event.target)) return;
      if (Date.now() - recentClipPointerAt < 1400 && !state.dragAssetId) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      setTimeout(() => { state.dragAssetId = null; }, 0);
    }, true);
    const oldAdd = addClipFromAsset;
    addClipFromAsset = function orgavoxConsolidatedAddClipFromAsset(assetId, track, start) {
      const now = Date.now();
      const t = Math.max(0, Math.min(9, Number(track) || 0));
      const s = Math.max(0, Number(start) || 0);
      const repeat = lastAssetAdd && now - lastAssetAdd.time < 900 && String(assetId || "") === lastAssetAdd.assetId && t === lastAssetAdd.track && Math.abs(s - lastAssetAdd.start) < 0.3;
      const suspicious = now - recentClipPointerAt < 700 && !state.dragAssetId;
      if (repeat || suspicious) {
        showToast("Duplicate clip add ignored.");
        return null;
      }
      const before = state.clips.length;
      const result = oldAdd.apply(this, arguments);
      if (state.clips.length > before) lastAssetAdd = { time: now, assetId: String(assetId || ""), track: t, start: s };
      return result;
    };
  }

  function disableClipNativeDrag() {
    document.querySelectorAll(".audio-clip").forEach((clip) => {
      clip.draggable = false;
      clip.setAttribute("draggable", "false");
    });
  }

  function patchFunctions() {
    if (window.__orgavoxConsolidatedFunctionPatches) return;
    window.__orgavoxConsolidatedFunctionPatches = true;
    const oldRender = renderTimeline;
    renderTimeline = function orgavoxConsolidatedRenderTimeline() {
      const result = oldRender.apply(this, arguments);
      refreshConsolidatedUI();
      return result;
    };
    const oldSelectClip = selectClip;
    selectClip = function orgavoxConsolidatedSelectClip(id) {
      const result = oldSelectClip.apply(this, arguments);
      if (!multiSelectLock) state.selectedClipIds = id ? [id] : [];
      setMultiSelection(state.selectedClipIds || []);
      return result;
    };
    const oldSync = syncSelectedControls;
    syncSelectedControls = function orgavoxConsolidatedSyncSelectedControls() {
      const result = oldSync.apply(this, arguments);
      const ids = clipSelectionIds();
      if (ids.length > 1 && ui.selectedClipName) ui.selectedClipName.textContent = `${ids.length} clips selected`;
      return result;
    };
    const oldStart = startPlayback;
    startPlayback = async function orgavoxConsolidatedStartPlayback() {
      const result = await oldStart.apply(this, arguments);
      ui.playBtn?.classList.add("orgavox-playing");
      return result;
    };
    const oldStop = stopPlayback;
    stopPlayback = function orgavoxConsolidatedStopPlayback() {
      const result = oldStop.apply(this, arguments);
      ui.playBtn?.classList.remove("orgavox-playing");
      return result;
    };
  }

  function installOutsideClose() {
    if (window.__orgavoxConsolidatedOutsideClose) return;
    window.__orgavoxConsolidatedOutsideClose = true;
    document.addEventListener("click", (event) => {
      const wrap = document.getElementById("orgavoxViewDropdown");
      if (!wrap || wrap.contains(event.target)) return;
      const panel = wrap.querySelector(".orgavox-view-menu");
      const button = wrap.querySelector(".orgavox-view-button");
      if (panel) panel.hidden = true;
      if (button) button.setAttribute("aria-expanded", "false");
    });
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

  function refreshConsolidatedUI() {
    if (!ready()) return;
    setVersion();
    applyButtonStyling();
    keepFeatureButtonsInMenu();
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
    ensureStepButtons();
    echoInline();
    orderToolbar();
    ensureLeadingTransportDivider();
    refreshMetaAndOverlays();
    scrub();
    disableClipNativeDrag();
  }

  function install() {
    if (installed || !ready()) return;
    installed = true;
    installStyles();
    installOutsideClose();
    installShiftMultiSelect();
    keyboard();
    scrub();
    dragCopyGuard();
    patchFunctions();
    refreshConsolidatedUI();
    [0, 150, 500, 1000].forEach((delay) => setTimeout(refreshConsolidatedUI, delay));
    window.orgavoxRefreshConsolidatedUI = refreshConsolidatedUI;
  }

  let attempts = 0;
  (function wait() {
    if (ready()) install();
    else if (attempts++ < 200) setTimeout(wait, 50);
  })();
})();
