"use strict";

(function installSimpleEditPhaseOne() {
  const TRACK_COUNT = 10;
  const PHASE_STYLE_ID = "simple-edit-phase1-style";
  const PHASE_VERSION = "v0.12";

  const clampTrack = (track) => Math.max(0, Math.min(TRACK_COUNT - 1, Number(track) || 0));

  function installPhaseStyles() {
    const previous = document.getElementById(PHASE_STYLE_ID);
    if (previous) previous.remove();
    const style = document.createElement("style");
    style.id = PHASE_STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 {
        --topbar-h: 82px;
        --controls-h: 0px;
        --lane-h: clamp(88px, calc((100vh - 250px) / 6), 132px);
      }
      body.simple-edit-phase1 .app {
        grid-template-rows: var(--topbar-h) 0px 1fr;
      }
      body.simple-edit-phase1 .topbar {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 18px;
        padding: 12px 16px;
        min-height: var(--topbar-h);
      }
      body.simple-edit-phase1 .brand {
        flex: 0 0 auto;
        min-width: 210px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      body.simple-edit-phase1 .brand .brand-mark {
        flex: 0 0 auto;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        line-height: 1 !important;
      }
      body.simple-edit-phase1 .brand > div:not(.brand-mark) {
        min-width: 0;
        display: block;
      }
      body.simple-edit-phase1 .brand h1 {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin: 0;
        line-height: 1;
        white-space: nowrap;
      }
      body.simple-edit-phase1 .phase1-version {
        color: #63b8ff !important;
        display: inline-flex;
        align-items: baseline;
        font: 700 .68rem var(--font-mono) !important;
        letter-spacing: .08em;
        line-height: 1 !important;
        margin: 0 !important;
        position: static !important;
        text-transform: uppercase;
        transform: none !important;
        vertical-align: baseline;
        white-space: nowrap;
      }
      body.simple-edit-phase1 .brand p { display: none; }
      body.simple-edit-phase1 .phase1-top-effects {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 12px;
        flex-wrap: wrap;
      }
      body.simple-edit-phase1 .phase1-timeline-toolbar {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 12px;
        flex-wrap: wrap;
        padding: 10px 0 11px;
      }
      body.simple-edit-phase1 .phase1-tool-group {
        display: flex;
        align-items: center;
        gap: 9px;
        flex-wrap: wrap;
      }
      body.simple-edit-phase1 .phase1-divider {
        flex: 0 0 1px;
        width: 1px;
        height: 34px;
        background: linear-gradient(180deg, transparent, rgba(224,163,96,.74), transparent);
        margin: 0 4px;
      }
      body.simple-edit-phase1 .transport,
      body.simple-edit-phase1 .toolbar-actions {
        display: contents;
      }
      body.simple-edit-phase1 .clip-controls {
        display: none !important;
      }
      body.simple-edit-phase1 .workspace {
        position: relative;
        background: rgba(10,12,10,.96);
      }
      body.simple-edit-phase1 .workspace::before {
        display: none !important;
      }
      body.simple-edit-phase1 .phase1-workspace-rule {
        position: absolute;
        left: 0;
        right: 0;
        top: var(--phase1-divider-y, 72px);
        height: 2px;
        background: linear-gradient(90deg, rgba(224,163,96,.34), rgba(224,163,96,.96), rgba(224,163,96,.34));
        border-top: 1px solid rgba(248,215,146,.55);
        box-shadow: 0 1px 0 rgba(0,0,0,.85), 0 0 10px rgba(224,163,96,.25);
        pointer-events: none;
        z-index: 90;
      }
      body.simple-edit-phase1 .library-panel,
      body.simple-edit-phase1 .timeline-panel {
        position: relative;
        z-index: 1;
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: none;
      }
      body.simple-edit-phase1 .library-panel {
        border-right: 1px solid rgba(224,163,96,.55);
      }
      body.simple-edit-phase1 .library-panel .panel-heading,
      body.simple-edit-phase1 .timeline-topline {
        min-height: 52px;
        padding-bottom: 16px;
        margin-bottom: 20px;
        background: transparent !important;
      }
      body.simple-edit-phase1 .library-panel .dropzone {
        margin-top: 8px;
      }
      body.simple-edit-phase1 .timeline-panel {
        padding: 14px 16px 18px;
        background: transparent !important;
      }
      body.simple-edit-phase1 .timeline-topline {
        justify-content: flex-start;
        align-items: center;
      }
      body.simple-edit-phase1 .timeline-shell {
        margin-top: 8px;
      }
      body.simple-edit-phase1 .timeline-topline > div:not(.phase1-timeline-toolbar),
      body.simple-edit-phase1 .timeline-topline .eyebrow,
      body.simple-edit-phase1 .timeline-topline h2,
      body.simple-edit-phase1 .timeline-topline .status-pill {
        display: none !important;
      }
      body.simple-edit-phase1 .topbar .range-control {
        min-width: 190px;
        grid-template-columns: auto minmax(94px, 138px) 52px;
        gap: 8px;
      }
      body.simple-edit-phase1 .topbar .range-control span {
        white-space: nowrap;
      }
      body.simple-edit-phase1 .topbar .zoom-control,
      body.simple-edit-phase1 .timeline-topline .zoom-control {
        min-width: 220px;
        margin-left: 0;
      }
      body.simple-edit-phase1 .timeline-topline .range-control {
        min-width: 230px;
        grid-template-columns: auto minmax(96px, 150px) 52px;
        gap: 8px;
      }
      body.simple-edit-phase1 .timeline-topline .range-control span {
        white-space: nowrap;
      }
      body.simple-edit-phase1 .topbar .tool-button,
      body.simple-edit-phase1 .topbar .icon-button,
      body.simple-edit-phase1 .timeline-topline .tool-button,
      body.simple-edit-phase1 .timeline-topline .icon-button {
        min-height: 36px;
      }
      body.simple-edit-phase1 .topbar .tool-button,
      body.simple-edit-phase1 .timeline-topline .tool-button {
        padding: 8px 14px;
      }
      body.simple-edit-phase1 .topbar .icon-button,
      body.simple-edit-phase1 .timeline-topline .icon-button {
        min-width: 36px;
        padding: 7px 10px;
      }
      body.simple-edit-phase1 .timeline-shell {
        grid-template-columns: 122px minmax(0, 1fr);
        height: calc(var(--ruler-h) + var(--lane-h) + var(--lane-h) + var(--lane-h) + var(--lane-h) + var(--lane-h) + var(--lane-h));
        max-height: calc(100vh - var(--topbar-h) - 118px);
        min-height: calc(var(--ruler-h) + 410px);
        flex: 0 0 auto;
      }
      body.simple-edit-phase1 .track-label-column {
        overflow: hidden;
      }
      body.simple-edit-phase1 .phase1-track-label-scroll {
        will-change: transform;
      }
      body.simple-edit-phase1 .timeline-scroll {
        overflow: auto;
        overscroll-behavior: contain;
      }
      body.simple-edit-phase1 .ruler {
        position: sticky;
        top: 0;
        z-index: 9;
      }
      body.simple-edit-phase1 .track-label {
        height: var(--lane-h);
        padding: 0 12px;
      }
      body.simple-edit-phase1 .track-label span {
        width: 26px;
        height: 26px;
        font-size: .62rem;
      }
      body.simple-edit-phase1 .track-label strong {
        font-size: .66rem;
      }
      body.simple-edit-phase1 .track-lane.selected-track {
        box-shadow: inset 0 0 0 2px rgba(117,216,255,.55), inset 4px 0 rgba(117,216,255,.85);
        background-color: rgba(75,155,255,.09);
      }
      body.simple-edit-phase1 .audio-clip {
        top: 10px;
        height: calc(var(--lane-h) - 20px);
      }
      body.simple-edit-phase1 .audio-clip.selected {
        border-color: #75d8ff;
        background: linear-gradient(180deg, rgba(80,174,255,.78), rgba(35,111,184,.66));
        box-shadow: 0 0 0 2px rgba(117,216,255,.48), 0 0 18px rgba(75,178,255,.42), 0 5px 16px rgba(0,0,0,.5);
      }
      body.simple-edit-phase1 .clip-title {
        top: 5px;
        font-size: .58rem;
      }
      body.simple-edit-phase1 .clip-effect-badges {
        bottom: 5px;
      }
      @media (max-width: 1180px) {
        body.simple-edit-phase1 {
          --topbar-h: 118px;
        }
        body.simple-edit-phase1 .brand {
          min-width: 150px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function makeDivider() {
    const divider = document.createElement("span");
    divider.className = "phase1-divider";
    divider.setAttribute("aria-hidden", "true");
    return divider;
  }

  function makeGroup(name, nodes) {
    const group = document.createElement("div");
    group.className = `phase1-tool-group phase1-${name}-group`;
    nodes.filter(Boolean).forEach((node) => group.appendChild(node));
    return group;
  }

  function ensureVersionBadge() {
    const brand = document.querySelector(".brand");
    const title = brand?.querySelector("h1");
    if (!brand || !title) return;
    let badge = brand.querySelector(".phase1-version, .simple-edit-version");
    if (!badge) {
      badge = document.createElement("span");
      title.insertAdjacentElement("afterend", badge);
    }
    badge.className = "phase1-version simple-edit-version";
    badge.textContent = PHASE_VERSION;
  }


  function updateButtonEmojiLabels() {
    if (ui.importBtn) ui.importBtn.textContent = "📥 Import";
    if (ui.jumpStartBtn) {
      ui.jumpStartBtn.textContent = "⏮";
      ui.jumpStartBtn.title = "Return to start";
    }
    if (ui.playBtn) {
      ui.playBtn.textContent = "▶️";
      ui.playBtn.title = "Play or pause";
    }
    if (ui.stopBtn) {
      ui.stopBtn.textContent = "⏹";
      ui.stopBtn.title = "Stop";
    }
    if (ui.exportBtn) ui.exportBtn.textContent = "💾 Export mix";
    if (ui.scissorsBtn) ui.scissorsBtn.textContent = "✂️ Scissors";
    if (ui.deleteBtn) ui.deleteBtn.textContent = "🗑 Delete";
    if (ui.fullscreenBtn) {
      ui.fullscreenBtn.textContent = "🖥";
      ui.fullscreenBtn.title = "Toggle fullscreen";
    }
    if (ui.gateBtn) ui.gateBtn.textContent = "🚪 Noise gate";
    if (ui.stretchBtn) {
      const applyStretchText = () => {
        const active = ui.stretchBtn.getAttribute("aria-pressed") === "true";
        ui.stretchBtn.textContent = active ? "↔️ Stretch on" : "↔️ Stretch off";
      };
      applyStretchText();
      if (ui.stretchBtn.dataset.phase1EmojiBound !== "true") {
        ui.stretchBtn.dataset.phase1EmojiBound = "true";
        ui.stretchBtn.addEventListener("click", () => setTimeout(applyStretchText, 0));
      }
    }
    const volumeLabel = ui.volumeSlider?.closest(".range-control")?.querySelector("span");
    if (volumeLabel) volumeLabel.textContent = "🔊 Volume";
    const echoLabel = ui.echoSlider?.closest(".range-control")?.querySelector("span");
    if (echoLabel) echoLabel.textContent = "🔁 Echo";
    const zoomLabel = ui.zoomSlider?.closest(".range-control")?.querySelector("span");
    if (zoomLabel) zoomLabel.textContent = "🔍 Timeline zoom";
  }

  function rebuildTopEffectsBar() {
    const topbar = document.querySelector(".topbar");
    const brand = document.querySelector(".brand");
    if (!topbar || !brand || topbar.classList.contains("phase1-effects-ready")) return;

    document.body.classList.add("simple-edit-phase1");
    topbar.classList.add("phase1-effects-ready");

    const effectsToolbar = document.createElement("div");
    effectsToolbar.className = "phase1-top-effects";

    const volumeControl = ui.volumeSlider?.closest(".range-control");
    const echoControl = ui.echoSlider?.closest(".range-control");

    const effectsGroup = makeGroup("effects", [
      volumeControl,
      echoControl,
      ui.gateBtn,
      ui.stretchBtn
    ]);

    effectsToolbar.append(makeDivider(), effectsGroup);
    topbar.appendChild(effectsToolbar);
  }

  function rebuildTimelineToolbar() {
    const timelineTopline = document.querySelector(".timeline-topline");
    if (!timelineTopline || timelineTopline.querySelector(".phase1-timeline-toolbar")) return;

    const toolbar = document.createElement("div");
    toolbar.className = "phase1-timeline-toolbar";

    const transportGroup = makeGroup("transport", [
      ui.importBtn,
      ui.jumpStartBtn,
      ui.playBtn,
      ui.stopBtn,
      ui.timeReadout
    ]);

    const zoomControl = ui.zoomSlider?.closest(".range-control");
    const editGroup = makeGroup("edit", [
      ui.exportBtn,
      ui.scissorsBtn,
      ui.deleteBtn,
      ui.fullscreenBtn,
      zoomControl
    ]);

    toolbar.append(transportGroup, makeDivider(), editGroup);
    timelineTopline.appendChild(toolbar);
  }

  function ensureWorkspaceRule() {
    const workspace = document.querySelector('.workspace');
    if (!workspace || workspace.querySelector('.phase1-workspace-rule')) return;
    const rule = document.createElement('div');
    rule.className = 'phase1-workspace-rule';
    rule.setAttribute('aria-hidden', 'true');
    workspace.appendChild(rule);
  }

  function syncWorkspaceDivider() {
    const workspace = document.querySelector('.workspace');
    const panelHeading = document.querySelector('.library-panel .panel-heading');
    const timelineTopline = document.querySelector('.timeline-topline');
    if (!workspace || !panelHeading || !timelineTopline) return;
    ensureWorkspaceRule();
    const workspaceRect = workspace.getBoundingClientRect();
    const topY = Math.max(
      panelHeading.getBoundingClientRect().bottom - workspaceRect.top,
      timelineTopline.getBoundingClientRect().bottom - workspaceRect.top
    );
    workspace.style.setProperty('--phase1-divider-y', `${Math.round(topY)}px`);
  }

  function ensureTenTracks() {
    const labelColumn = document.querySelector(".track-label-column");
    const tracks = document.querySelector("#tracks");
    if (!labelColumn || !tracks) return;

    const newLanes = [];
    const newLabels = [];

    for (let index = 0; index < TRACK_COUNT; index += 1) {
      if (!labelColumn.querySelector(`[data-track-label="${index}"]`)) {
        const label = document.createElement("button");
        label.className = "track-label";
        label.dataset.trackLabel = String(index);
        label.type = "button";
        label.innerHTML = `<span>${index + 1}</span><strong>Track ${index + 1}</strong>`;
        labelColumn.appendChild(label);
        newLabels.push(label);
      }
      if (!tracks.querySelector(`[data-track="${index}"]`)) {
        const lane = document.createElement("div");
        lane.className = "track-lane";
        lane.dataset.track = String(index);
        tracks.appendChild(lane);
        newLanes.push(lane);
      }
    }

    ui.lanes = [...document.querySelectorAll(".track-lane")];
    ui.trackLabels = [...document.querySelectorAll(".track-label")];
    newLanes.forEach(bindLaneEvents);
    newLabels.forEach(bindTrackLabel);
  }

  function ensureTrackLabelScroller() {
    const labelColumn = document.querySelector(".track-label-column");
    if (!labelColumn) return;
    let scroller = labelColumn.querySelector(".phase1-track-label-scroll");
    if (!scroller) {
      scroller = document.createElement("div");
      scroller.className = "phase1-track-label-scroll";
      [...labelColumn.querySelectorAll(".track-label")].forEach((label) => scroller.appendChild(label));
      labelColumn.appendChild(scroller);
    }
    ui.trackLabels = [...scroller.querySelectorAll(".track-label")];
    const sync = () => {
      scroller.style.transform = `translateY(${-ui.timelineScroll.scrollTop}px)`;
    };
    if (ui.timelineScroll && ui.timelineScroll.dataset.phase1ScrollBound !== "true") {
      ui.timelineScroll.dataset.phase1ScrollBound = "true";
      ui.timelineScroll.addEventListener("scroll", sync);
    }
    sync();
  }

  function bindLaneEvents(lane) {
    if (lane.dataset.phase1Bound === "true") return;
    lane.dataset.phase1Bound = "true";
    lane.addEventListener("click", (event) => {
      if (event.target.closest(".audio-clip")) return;
      selectTrack(Number(lane.dataset.track));
      setPlayhead(pointerTime(event));
      state.selectedClipId = null;
      syncSelectedControls();
      renderTimeline();
    });
    lane.addEventListener("dragover", (event) => {
      event.preventDefault();
      lane.classList.add("drag-target");
    });
    lane.addEventListener("dragleave", () => lane.classList.remove("drag-target"));
    lane.addEventListener("drop", (event) => {
      event.preventDefault();
      lane.classList.remove("drag-target");
      const assetId = state.dragAssetId || event.dataTransfer.getData("text/plain");
      addClipFromAsset(assetId, Number(lane.dataset.track), pointerTime(event));
    });
  }

  function bindTrackLabel(label) {
    if (label.dataset.phase1Bound === "true") return;
    label.dataset.phase1Bound = "true";
    label.addEventListener("click", () => selectTrack(label.dataset.trackLabel));
  }

  function patchTrackAwareFunctions() {
    selectTrack = function patchedSelectTrack(track) {
      state.selectedTrack = clampTrack(track);
      ui.lanes.forEach((lane) => lane.classList.toggle("selected-track", Number(lane.dataset.track) === state.selectedTrack));
      ui.trackLabels.forEach((label) => label.classList.toggle("active", Number(label.dataset.trackLabel) === state.selectedTrack));
      renderAssets();
    };

    addClipFromAsset = function patchedAddClipFromAsset(assetId, track, start) {
      const asset = state.assets.find((item) => item.id === assetId);
      if (!asset) return;
      const clip = {
        id: makeId("clip"), assetId, name: asset.name, track: clampTrack(track),
        start: Math.max(0, start), sourceStart: 0, sourceEnd: asset.duration,
        stretchDuration: null, volume: 100, echo: 0, gate: null, bufferOverride: null, cacheVersion: 0
      };
      state.clips.push(clip);
      selectClip(clip.id);
      renderTimeline();
      showToast(`${asset.name} added to Track ${clip.track + 1}.`);
    };

    moveClipPointer = function patchedMoveClipPointer(event) {
      const drag = state.clipDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const clip = state.clips.find((item) => item.id === drag.clipId);
      if (!clip) return;
      const deltaSeconds = (event.clientX - drag.startX) / state.pixelsPerSecond;
      if (drag.type === "move") {
        clip.start = Math.max(0, drag.original.start + deltaSeconds);
        const laneRect = ui.tracks.getBoundingClientRect();
        const laneHeight = laneRect.height / TRACK_COUNT;
        const nextTrack = clampTrack(Math.floor((event.clientY - laneRect.top) / laneHeight));
        if (clip.track !== nextTrack) {
          clip.track = nextTrack;
          selectTrack(clip.track);
          ui.lanes[clip.track].appendChild(drag.element);
        }
      } else if (state.stretchMode) {
        const originalDuration = drag.original.stretchDuration || Math.max(.01, drag.original.sourceEnd - drag.original.sourceStart);
        if (drag.edge === "right") {
          clip.stretchDuration = Math.max(.05, originalDuration + deltaSeconds);
        } else {
          const originalGateExtra = gateExtraDuration(clip, originalDuration);
          const rightEdge = drag.original.start + originalDuration + originalGateExtra;
          const newStart = Math.max(0, drag.original.start + deltaSeconds);
          clip.start = newStart;
          clip.stretchDuration = Math.max(.05, rightEdge - newStart - originalGateExtra);
        }
        invalidateClip(clip);
      } else {
        const buffer = clipBuffer(clip);
        if (!buffer) return;
        if (drag.edge === "right") {
          clip.sourceEnd = Math.max(drag.original.sourceStart + .05, Math.min(buffer.duration, drag.original.sourceEnd + deltaSeconds));
        } else {
          const maxSource = drag.original.sourceEnd - .05;
          const nextSourceStart = Math.max(0, Math.min(maxSource, drag.original.sourceStart + deltaSeconds));
          const sourceDelta = nextSourceStart - drag.original.sourceStart;
          clip.sourceStart = nextSourceStart;
          clip.start = Math.max(0, drag.original.start + sourceDelta);
        }
        clip.stretchDuration = null;
        invalidateClip(clip);
      }
      drag.element.style.left = `${clip.start * state.pixelsPerSecond}px`;
      drag.element.style.width = `${Math.max(12, clipDuration(clip) * state.pixelsPerSecond)}px`;
      const canvas = drag.element.querySelector(".clip-wave");
      if (canvas) drawClipWaveform(canvas, clip);
      syncSelectedControls();
      updatePlayheadVisual();
    };
  }

  function configureZoom() {
    if (!ui.zoomSlider || !ui.zoomOut) return;
    ui.zoomSlider.min = "25";
    ui.zoomSlider.max = "500";
    ui.zoomSlider.step = "1";
    if (Number(ui.zoomSlider.value) < 100) ui.zoomSlider.value = "100";
    state.pixelsPerSecond = Number(ui.zoomSlider.value) || 100;
    ui.zoomOut.textContent = `${state.pixelsPerSecond}%`;
    ui.zoomSlider.addEventListener("input", () => {
      state.pixelsPerSecond = Number(ui.zoomSlider.value) || 100;
      ui.zoomOut.textContent = `${state.pixelsPerSecond}%`;
      renderTimeline();
    });
  }

  function updateExportCopy() {
    if (ui.exportTitle) ui.exportTitle.textContent = "Export mix";
    if (ui.exportConfirmBtn && ui.exportFormat) {
      const originalUpdateExportFormat = updateExportFormat;
      updateExportFormat = function patchedUpdateExportFormat() {
        originalUpdateExportFormat();
        if (ui.exportFormat.value === "mp3") ui.exportConfirmBtn.textContent = "Render MP3";
        else ui.exportConfirmBtn.textContent = "Render WAV";
      };
    }
  }

  installPhaseStyles();
  rebuildTopEffectsBar();
  rebuildTimelineToolbar();
  ensureVersionBadge();
  updateButtonEmojiLabels();
  ensureWorkspaceRule();
  ensureTenTracks();
  ensureTrackLabelScroller();
  patchTrackAwareFunctions();
  configureZoom();
  updateExportCopy();
  selectTrack(state.selectedTrack || 0);
  renderTimeline();
  syncWorkspaceDivider();
  window.addEventListener('resize', syncWorkspaceDivider);
  setTimeout(syncWorkspaceDivider, 0);
  setTimeout(syncWorkspaceDivider, 120);
  setStatus("Ready — 10-track layout active");
})();
