"use strict";

(function installSimpleEditPhaseOne() {
  const TRACK_COUNT = 10;
  const VISIBLE_TRACK_COUNT = 5;
  const PHASE_STYLE_ID = "simple-edit-phase1-style";

  const clampTrack = (track) => Math.max(0, Math.min(TRACK_COUNT - 1, Number(track) || 0));

  function installPhaseStyles() {
    const previous = document.getElementById(PHASE_STYLE_ID);
    if (previous) previous.remove();
    const style = document.createElement("style");
    style.id = PHASE_STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 {
        --topbar-h: 96px;
        --controls-h: 0px;
        --lane-h: 84px;
      }
      body.simple-edit-phase1 .app {
        grid-template-rows: var(--topbar-h) 0px 1fr;
      }
      body.simple-edit-phase1 .topbar {
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        gap: 12px;
        padding: 10px 12px 8px;
        min-height: var(--topbar-h);
      }
      body.simple-edit-phase1 .brand {
        flex: 0 0 auto;
        min-width: 178px;
        padding-top: 2px;
      }
      body.simple-edit-phase1 .brand p { display: none; }
      body.simple-edit-phase1 .phase1-toolbar {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        flex-wrap: wrap;
      }
      body.simple-edit-phase1 .phase1-tool-group {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
      }
      body.simple-edit-phase1 .phase1-divider {
        flex: 0 0 1px;
        width: 1px;
        height: 32px;
        background: linear-gradient(180deg, transparent, rgba(224,163,96,.72), transparent);
        margin: 0 2px;
      }
      body.simple-edit-phase1 .transport,
      body.simple-edit-phase1 .toolbar-actions {
        display: contents;
      }
      body.simple-edit-phase1 .clip-controls {
        display: none !important;
      }
      body.simple-edit-phase1 .topbar .range-control {
        min-width: 176px;
        grid-template-columns: auto minmax(82px, 126px) 48px;
        gap: 6px;
      }
      body.simple-edit-phase1 .topbar .range-control span {
        white-space: nowrap;
      }
      body.simple-edit-phase1 .topbar .zoom-control { margin-left: 0; }
      body.simple-edit-phase1 .topbar .tool-button,
      body.simple-edit-phase1 .topbar .icon-button {
        min-height: 32px;
      }
      body.simple-edit-phase1 .topbar .tool-button {
        padding: 7px 11px;
      }
      body.simple-edit-phase1 .topbar .icon-button {
        min-width: 32px;
        padding: 6px 8px;
      }
      body.simple-edit-phase1 .timeline-shell {
        grid-template-columns: 112px minmax(0, 1fr);
        height: calc(var(--ruler-h) + 420px);
        max-height: calc(100vh - var(--topbar-h) - 94px);
        min-height: calc(var(--ruler-h) + 260px);
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
        padding: 0 10px;
      }
      body.simple-edit-phase1 .track-label span {
        width: 24px;
        height: 24px;
        font-size: .6rem;
      }
      body.simple-edit-phase1 .track-label strong {
        font-size: .62rem;
      }
      body.simple-edit-phase1 .track-lane.selected-track {
        box-shadow: inset 0 0 0 2px rgba(117,216,255,.55), inset 4px 0 rgba(117,216,255,.85);
        background-color: rgba(75,155,255,.09);
      }
      body.simple-edit-phase1 .audio-clip {
        top: 8px;
        height: calc(var(--lane-h) - 16px);
      }
      body.simple-edit-phase1 .audio-clip.selected {
        border-color: #75d8ff;
        background: linear-gradient(180deg, rgba(80,174,255,.78), rgba(35,111,184,.66));
        box-shadow: 0 0 0 2px rgba(117,216,255,.48), 0 0 18px rgba(75,178,255,.42), 0 5px 16px rgba(0,0,0,.5);
      }
      body.simple-edit-phase1 .clip-title {
        top: 4px;
        font-size: .55rem;
      }
      body.simple-edit-phase1 .clip-effect-badges {
        bottom: 4px;
      }
      @media (max-width: 1180px) {
        body.simple-edit-phase1 {
          --topbar-h: 128px;
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

  function makeKeyframeButton(id, label, title) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "tool-button";
      button.textContent = label;
      button.title = title;
      button.disabled = true;
    }
    return button;
  }

  function rebuildTopBar() {
    const topbar = document.querySelector(".topbar");
    const brand = document.querySelector(".brand");
    if (!topbar || !brand || topbar.classList.contains("phase1-ready")) return;

    document.body.classList.add("simple-edit-phase1");
    topbar.classList.add("phase1-ready");

    const toolbar = document.createElement("div");
    toolbar.className = "phase1-toolbar";

    const transportGroup = makeGroup("transport", [
      ui.importBtn,
      ui.jumpStartBtn,
      ui.playBtn,
      ui.stopBtn,
      ui.timeReadout
    ]);

    const editGroup = makeGroup("edit", [
      ui.exportBtn,
      ui.stretchBtn,
      ui.scissorsBtn,
      ui.deleteBtn,
      ui.fullscreenBtn
    ]);

    const keyframeGroup = makeGroup("keyframes", [
      makeKeyframeButton("addKeyframeBtn", "+ Keyframe", "Volume keyframes are coming in Phase 2."),
      makeKeyframeButton("prevKeyframeBtn", "◀ Keyframe", "Volume keyframes are coming in Phase 2."),
      makeKeyframeButton("nextKeyframeBtn", "Keyframe ▶", "Volume keyframes are coming in Phase 2."),
      makeKeyframeButton("deleteKeyframeBtn", "Delete Keyframe", "Volume keyframes are coming in Phase 2.")
    ]);

    ui.addKeyframeBtn = keyframeGroup.querySelector("#addKeyframeBtn");
    ui.prevKeyframeBtn = keyframeGroup.querySelector("#prevKeyframeBtn");
    ui.nextKeyframeBtn = keyframeGroup.querySelector("#nextKeyframeBtn");
    ui.deleteKeyframeBtn = keyframeGroup.querySelector("#deleteKeyframeBtn");

    const volumeControl = ui.volumeSlider?.closest(".range-control");
    const echoControl = ui.echoSlider?.closest(".range-control");
    const zoomControl = ui.zoomSlider?.closest(".range-control");
    const effectsGroup = makeGroup("effects", [
      volumeControl,
      echoControl,
      ui.gateBtn,
      zoomControl
    ]);

    toolbar.append(
      makeDivider(),
      transportGroup,
      makeDivider(),
      editGroup,
      makeDivider(),
      keyframeGroup,
      makeDivider(),
      effectsGroup
    );

    topbar.appendChild(toolbar);
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

  function wrapTrackLabels() {
    const labelColumn = document.querySelector(".track-label-column");
    if (!labelColumn) return;
    let wrapper = labelColumn.querySelector(".phase1-track-label-scroll");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "phase1-track-label-scroll";
      const directLabels = [...labelColumn.children].filter((child) => child.classList?.contains("track-label"));
      directLabels.forEach((label) => wrapper.appendChild(label));
      labelColumn.appendChild(wrapper);
    } else {
      const directLabels = [...labelColumn.children].filter((child) => child.classList?.contains("track-label"));
      directLabels.forEach((label) => wrapper.appendChild(label));
    }
    ui.trackLabels = [...wrapper.querySelectorAll(".track-label")];
  }

  function syncTrackLabelScroll() {
    const wrapper = document.querySelector(".phase1-track-label-scroll");
    if (!wrapper || !ui.timelineScroll) return;
    wrapper.style.transform = `translateY(${-ui.timelineScroll.scrollTop}px)`;
  }

  function ensureTenTracks() {
    const labelColumn = document.querySelector(".track-label-column");
    const tracks = document.querySelector("#tracks");
    if (!labelColumn || !tracks) return;

    let labelParent = labelColumn.querySelector(".phase1-track-label-scroll") || labelColumn;
    const newLanes = [];
    const newLabels = [];

    for (let index = 0; index < TRACK_COUNT; index += 1) {
      if (!labelColumn.querySelector(`[data-track-label="${index}"]`)) {
        const label = document.createElement("button");
        label.className = "track-label";
        label.dataset.trackLabel = String(index);
        label.type = "button";
        label.innerHTML = `<span>${index + 1}</span><strong>Track ${index + 1}</strong>`;
        labelParent.appendChild(label);
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

    wrapTrackLabels();
    labelParent = labelColumn.querySelector(".phase1-track-label-scroll") || labelColumn;
    ui.lanes = [...document.querySelectorAll(".track-lane")];
    ui.trackLabels = [...labelParent.querySelectorAll(".track-label")];
    newLanes.forEach(bindLaneEvents);
    newLabels.forEach(bindTrackLabel);
    syncTrackLabelScroll();
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

  function installScrollSync() {
    if (!ui.timelineScroll || ui.timelineScroll.dataset.phase1ScrollSync === "true") return;
    ui.timelineScroll.dataset.phase1ScrollSync = "true";
    ui.timelineScroll.addEventListener("scroll", syncTrackLabelScroll, { passive: true });
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
  rebuildTopBar();
  ensureTenTracks();
  patchTrackAwareFunctions();
  configureZoom();
  installScrollSync();
  updateExportCopy();
  selectTrack(state.selectedTrack || 0);
  renderTimeline();
  syncTrackLabelScroll();
  setStatus("Ready — 10-track layout active");
})();
