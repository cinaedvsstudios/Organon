"use strict";

(function installSimpleEditPhaseThree() {
  const VERSION = "v0.13";
  const STYLE_ID = "simple-edit-phase3-style";
  const TOLERANCE = 0.08;

  function setVisibleVersion() {
    document.title = `Organon — Simple Edit ${VERSION}`;
    const brand = document.querySelector(".brand");
    const title = brand?.querySelector("h1");
    if (!title) return;
    let badge = brand.querySelector(".phase1-version, .simple-edit-version");
    if (!badge) {
      badge = document.createElement("span");
      title.appendChild(badge);
    }
    badge.className = "phase1-version simple-edit-version";
    badge.textContent = VERSION;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .clip-effect-badges span.hidden-keyframe-badge {
        border-color: rgba(255,120,216,.55);
        color: #ffb9ed;
        opacity: .86;
      }
      body.simple-edit-phase1 .volume-keyframe-marker.outside-trim {
        display: none !important;
      }
      body.simple-edit-phase1 .phase3-ready-flash {
        animation: phase3ReadyFlash .7s ease-out 1;
      }
      @keyframes phase3ReadyFlash {
        0% { box-shadow: 0 0 0 rgba(117,216,255,0); }
        40% { box-shadow: 0 0 16px rgba(117,216,255,.38); }
        100% { box-shadow: 0 0 0 rgba(117,216,255,0); }
      }
    `;
    document.head.appendChild(style);
  }

  function keyframesFor(clip) {
    if (!clip) return [];
    if (!Array.isArray(clip.volumeKeyframes)) clip.volumeKeyframes = [];
    clip.volumeKeyframes.forEach((keyframe) => {
      if (!keyframe.id) keyframe.id = makeId("kf");
      keyframe.time = Math.max(0, Number(keyframe.time) || 0);
      keyframe.volume = Math.max(0, Math.min(200, Number(keyframe.volume ?? clip.volume) || 0));
    });
    clip.volumeKeyframes.sort((left, right) => left.time - right.time);
    return clip.volumeKeyframes;
  }

  function visibleKeyframesFor(clip) {
    const duration = clipDuration(clip);
    return keyframesFor(clip).filter((keyframe) => keyframe.time >= 0 && keyframe.time <= duration + 0.001);
  }

  function hiddenKeyframesFor(clip) {
    const duration = clipDuration(clip);
    return keyframesFor(clip).filter((keyframe) => keyframe.time > duration + 0.001);
  }

  function addHiddenKeyframeBadges() {
    state.clips.forEach((clip) => {
      const hidden = hiddenKeyframesFor(clip).length;
      if (!hidden) return;
      const element = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
      const badges = element?.querySelector(".clip-effect-badges");
      if (!badges || badges.querySelector(".hidden-keyframe-badge")) return;
      const badge = document.createElement("span");
      badge.className = "hidden-keyframe-badge";
      badge.textContent = `${hidden} KF hidden`;
      badge.title = "Volume keyframes outside the current trimmed length are kept, hidden, and ignored until the clip is extended again.";
      badges.appendChild(badge);
    });
  }

  function patchRenderTimeline() {
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function phaseThreeRenderTimeline() {
      previousRenderTimeline();
      addHiddenKeyframeBadges();
    };
  }

  function patchSetStatusCopy() {
    const previousSetStatus = setStatus;
    setStatus = function phaseThreeSetStatus(message) {
      previousSetStatus(String(message || "").replace(/five-track/gi, "ten-track"));
    };
  }

  function patchExportButtonCopy() {
    if (ui.exportTitle) ui.exportTitle.textContent = "Export ten-track mix";
    if (ui.exportBtn && !/ten-track/i.test(ui.exportBtn.title || "")) {
      ui.exportBtn.title = "Export the full ten-track mix with volume keyframes rendered.";
    }
  }

  function patchExportModal() {
    const previousOpenExport = openExport;
    openExport = function phaseThreeOpenExport() {
      previousOpenExport();
      patchExportButtonCopy();
      if (ui.exportNote && ui.exportFormat?.value !== "mp3") {
        ui.exportNote.textContent = "WAV keeps the rendered ten-track mix uncompressed, including volume keyframes.";
      }
    };

    const previousUpdateExportFormat = updateExportFormat;
    updateExportFormat = function phaseThreeUpdateExportFormat() {
      previousUpdateExportFormat();
      if (ui.exportNote) {
        ui.exportNote.textContent = ui.exportFormat.value === "mp3"
          ? "MP3 creates a smaller compressed file and includes the rendered volume keyframes."
          : "WAV keeps the rendered ten-track mix uncompressed, including volume keyframes.";
      }
    };
  }

  function patchTrimFinish() {
    const previousEndClipPointer = endClipPointer;
    endClipPointer = function phaseThreeEndClipPointer(event) {
      const clipId = state.clipDrag?.clipId;
      previousEndClipPointer(event);
      const clip = state.clips.find((item) => item.id === clipId) || selectedClip();
      if (!clip) return;
      const hidden = hiddenKeyframesFor(clip).length;
      if (hidden) {
        showToast(`${hidden} volume keyframe${hidden === 1 ? "" : "s"} kept outside the trimmed clip.`);
      }
      syncSelectedControls();
      renderTimeline();
    };
  }

  function patchPlayheadAndSelectionSync() {
    const previousSetPlayhead = setPlayhead;
    setPlayhead = function phaseThreeSetPlayhead(seconds, scrollIntoView = false) {
      previousSetPlayhead(seconds, scrollIntoView);
      const clip = selectedClip();
      if (!clip || !Array.isArray(clip.volumeKeyframes) || !clip.volumeKeyframes.length) return;
      const local = state.playhead - clip.start;
      const keyframe = visibleKeyframesFor(clip).find((item) => Math.abs(item.time - local) <= TOLERANCE);
      if (!keyframe) return;
      ui.volumeSlider.value = String(Math.round(keyframe.volume));
      ui.volumeOut.textContent = `${Math.round(keyframe.volume)}%`;
    };
  }

  function phaseThreePreflight() {
    const problems = [];
    if (typeof renderMix !== "function") problems.push("export renderer");
    if (typeof connectClipNodes !== "function") problems.push("audio connection");
    if (!ui.addKeyframeBtn) problems.push("keyframe toolbar");
    if (problems.length) {
      console.warn(`Simple Edit ${VERSION}: missing ${problems.join(", ")}`);
      setStatus(`Ready — ${VERSION} loaded with warnings`);
      return;
    }
    setStatus("Ready — trim/export keyframe cleanup active");
  }

  installStyles();
  setVisibleVersion();
  patchRenderTimeline();
  patchSetStatusCopy();
  patchExportButtonCopy();
  patchExportModal();
  patchTrimFinish();
  patchPlayheadAndSelectionSync();

  state.clips.forEach(keyframesFor);
  renderTimeline();
  phaseThreePreflight();
})();
