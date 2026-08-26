"use strict";

(function installSimpleEditVolumeKeyframes() {
  const VERSION = "v0.10";
  const TOLERANCE = 0.08;
  const STYLE_ID = "simple-edit-keyframes-style";

  function setVersion() {
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
      body.simple-edit-phase1 .phase2-keyframes-group { padding-left:2px; padding-right:2px; }
      body.simple-edit-phase1 .volume-keyframe-marker {
        position:absolute; top:0; bottom:0; width:3px; transform:translateX(-1.5px);
        border-radius:999px; background:#ff4fd8; box-shadow:0 0 8px rgba(255,79,216,.82),0 0 2px rgba(255,255,255,.9);
        z-index:9; cursor:pointer;
      }
      body.simple-edit-phase1 .volume-keyframe-marker::after {
        content:""; position:absolute; top:5px; left:50%; width:9px; height:9px; transform:translateX(-50%);
        border-radius:50%; background:#ff9aeb; border:1px solid rgba(20,16,12,.88); box-shadow:0 0 6px rgba(255,79,216,.9);
      }
      body.simple-edit-phase1 .volume-keyframe-marker.selected { width:5px; transform:translateX(-2.5px); background:#ffb6f2; box-shadow:0 0 12px rgba(255,79,216,1),0 0 4px rgba(255,255,255,.95); }
      body.simple-edit-phase1 .audio-clip:not(.selected) .volume-keyframe-marker { opacity:.55; }
      body.simple-edit-phase1 .audio-clip.has-volume-keyframes .clip-effect-badges span.keyframe-badge { border-color:rgba(255,79,216,.7); color:#ffd2f6; }
    `;
    document.head.appendChild(style);
  }

  function kfs(clip) {
    if (!clip) return [];
    if (!Array.isArray(clip.volumeKeyframes)) clip.volumeKeyframes = [];
    clip.volumeKeyframes.forEach((kf) => {
      if (!kf.id) kf.id = makeId("kf");
      kf.time = Math.max(0, Number(kf.time) || 0);
      kf.volume = Math.max(0, Math.min(200, Number(kf.volume ?? clip.volume) || 0));
    });
    clip.volumeKeyframes.sort((a, b) => a.time - b.time);
    return clip.volumeKeyframes;
  }
  function visibleKfs(clip) { return kfs(clip).filter((kf) => kf.time >= 0 && kf.time <= clipDuration(clip) + 0.001); }
  function localTime(clip) { return state.playhead - clip.start; }
  function nearKf(clip, time, tol = TOLERANCE) { return kfs(clip).find((kf) => Math.abs(kf.time - time) <= tol) || null; }
  function nearestKf(clip, time) {
    return kfs(clip).reduce((best, kf) => !best || Math.abs(kf.time - time) < Math.abs(best.time - time) ? kf : best, null);
  }
  function clampTime(clip, time) { return Math.max(0, Math.min(clipDuration(clip), Number(time) || 0)); }

  function volumeAtClipTime(clip, time) {
    const list = visibleKfs(clip);
    const base = Math.max(0, Number(clip?.volume ?? 100) || 0) / 100;
    const t = Math.max(0, Number(time) || 0);
    if (!list.length) return base;
    if (t <= list[0].time) {
      if (list[0].time <= TOLERANCE) return list[0].volume / 100;
      const p = Math.max(0, Math.min(1, t / list[0].time));
      return base + (list[0].volume / 100 - base) * p;
    }
    const last = list[list.length - 1];
    if (t >= last.time) return last.volume / 100;
    for (let i = 0; i < list.length - 1; i += 1) {
      const a = list[i], b = list[i + 1];
      if (t >= a.time && t <= b.time) {
        const p = (t - a.time) / Math.max(0.0001, b.time - a.time);
        return a.volume / 100 + (b.volume / 100 - a.volume / 100) * p;
      }
    }
    return base;
  }

  function scheduleVolume(param, clip, when, offset = 0) {
    const list = visibleKfs(clip);
    const start = Math.max(0, Number(when) || 0);
    const local = Math.max(0, Number(offset) || 0);
    param.cancelScheduledValues(start);
    param.setValueAtTime(volumeAtClipTime(clip, local), start);
    list.filter((kf) => kf.time >= local + 0.001).forEach((kf) => {
      param.linearRampToValueAtTime(kf.volume / 100, start + kf.time - local);
    });
  }

  function loadKf(kf) {
    if (!kf) return;
    ui.volumeSlider.value = String(Math.round(kf.volume));
    ui.volumeOut.textContent = `${Math.round(kf.volume)}%`;
  }
  function syncButtons() {
    const clip = selectedClip();
    const has = Boolean(clip);
    const hasKf = has && kfs(clip).length > 0;
    if (ui.addKeyframeBtn) ui.addKeyframeBtn.disabled = !has;
    if (ui.prevKeyframeBtn) ui.prevKeyframeBtn.disabled = !hasKf;
    if (ui.nextKeyframeBtn) ui.nextKeyframeBtn.disabled = !hasKf;
    if (ui.deleteKeyframeBtn) ui.deleteKeyframeBtn.disabled = !hasKf;
  }
  function goToKf(clip, kf) {
    if (!clip || !kf) return;
    state.selectedClipId = clip.id;
    setPlayhead(clip.start + kf.time, true);
    selectClip(clip.id);
    loadKf(kf);
    renderTimeline();
    syncButtons();
  }

  function addOrUpdateVolumeKeyframe() {
    const clip = selectedClip();
    if (!clip) return;
    const local = localTime(clip);
    if (local < -TOLERANCE || local > clipDuration(clip) + TOLERANCE) {
      showToast("Place the playhead inside the selected clip.");
      return;
    }
    stopPlayback();
    const time = clampTime(clip, local);
    const volume = Math.max(0, Math.min(200, Number(ui.volumeSlider.value) || 0));
    let kf = nearKf(clip, time);
    if (kf) {
      kf.time = time;
      kf.volume = volume;
      showToast(`Volume keyframe updated at ${formatTime(time)}.`);
    } else {
      kf = { id: makeId("kf"), time, volume };
      kfs(clip).push(kf);
      showToast(`Volume keyframe added at ${formatTime(time)}.`);
    }
    kfs(clip);
    loadKf(kf);
    renderTimeline();
    syncButtons();
  }
  function deleteVolumeKeyframe() {
    const clip = selectedClip();
    if (!clip || !kfs(clip).length) return;
    stopPlayback();
    const time = clampTime(clip, localTime(clip));
    const kf = nearKf(clip, time) || nearestKf(clip, time);
    if (!kf) return;
    clip.volumeKeyframes = kfs(clip).filter((item) => item.id !== kf.id);
    renderTimeline();
    syncButtons();
    showToast("Volume keyframe deleted.");
  }
  function previousVolumeKeyframe() {
    const clip = selectedClip();
    if (!clip) return;
    const list = visibleKfs(clip);
    if (!list.length) return;
    const local = localTime(clip);
    goToKf(clip, [...list].reverse().find((kf) => kf.time < local - TOLERANCE) || list[list.length - 1]);
  }
  function nextVolumeKeyframe() {
    const clip = selectedClip();
    if (!clip) return;
    const list = visibleKfs(clip);
    if (!list.length) return;
    const local = localTime(clip);
    goToKf(clip, list.find((kf) => kf.time > local + TOLERANCE) || list[0]);
  }

  function drawKeyframes(clip) {
    const element = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
    if (!element) return;
    const list = visibleKfs(clip);
    element.classList.toggle("has-volume-keyframes", list.length > 0);
    if (!list.length) return;
    const local = localTime(clip);
    list.forEach((kf) => {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "volume-keyframe-marker";
      marker.style.left = `${kf.time * state.pixelsPerSecond}px`;
      marker.title = `Volume ${Math.round(kf.volume)}% at ${formatTime(kf.time)}`;
      if (clip.id === state.selectedClipId && Math.abs(kf.time - local) <= TOLERANCE) marker.classList.add("selected");
      marker.addEventListener("pointerdown", (e) => e.stopPropagation());
      marker.addEventListener("click", (e) => { e.stopPropagation(); stopPlayback(); goToKf(clip, kf); });
      element.appendChild(marker);
    });
    const badges = element.querySelector(".clip-effect-badges");
    if (badges && !badges.querySelector(".keyframe-badge")) {
      const badge = document.createElement("span");
      badge.className = "keyframe-badge";
      badge.textContent = `${list.length} KF`;
      badges.appendChild(badge);
    }
  }

  function splitKeyframes(clip, splitAt) {
    const list = visibleKfs(clip);
    if (!list.length) return { left: [], right: [] };
    const boundary = Math.round(volumeAtClipTime(clip, splitAt) * 100);
    const clone = (kf, time = kf.time) => ({ id: makeId("kf"), time: Math.max(0, time), volume: Math.max(0, Math.min(200, Number(kf.volume) || 0)) });
    return {
      left: [...list.filter((kf) => kf.time < splitAt - TOLERANCE).map((kf) => clone(kf)), { id: makeId("kf"), time: splitAt, volume: boundary }],
      right: [{ id: makeId("kf"), time: 0, volume: boundary }, ...list.filter((kf) => kf.time > splitAt + TOLERANCE).map((kf) => clone(kf, kf.time - splitAt))]
    };
  }

  const originalRenderTimeline = renderTimeline;
  renderTimeline = function patchedRenderTimeline() {
    originalRenderTimeline();
    state.clips.forEach(drawKeyframes);
  };

  const originalSyncSelectedControls = syncSelectedControls;
  syncSelectedControls = function patchedSyncSelectedControls() {
    originalSyncSelectedControls();
    const clip = selectedClip();
    if (clip) {
      const kf = nearKf(clip, localTime(clip));
      if (kf) loadKf(kf);
    }
    syncButtons();
  };

  const originalSelectClip = selectClip;
  selectClip = function patchedSelectClip(id, rerender = true) {
    originalSelectClip(id, rerender);
    const clip = selectedClip();
    if (clip) {
      kfs(clip);
      const kf = nearKf(clip, localTime(clip));
      if (kf) loadKf(kf);
    }
    syncButtons();
  };

  const originalAddClipFromAsset = addClipFromAsset;
  addClipFromAsset = function patchedAddClipFromAsset(assetId, track, start) {
    originalAddClipFromAsset(assetId, track, start);
    const clip = selectedClip();
    if (clip) kfs(clip);
    syncButtons();
  };

  ui.volumeSlider?.addEventListener("input", () => {
    const clip = selectedClip();
    if (!clip) return;
    const kf = nearKf(clip, localTime(clip));
    if (!kf) return syncButtons();
    kf.volume = Math.max(0, Math.min(200, Number(ui.volumeSlider.value) || 0));
    ui.volumeOut.textContent = `${Math.round(kf.volume)}%`;
    renderTimeline();
    syncButtons();
  });

  connectClipNodes = function patchedConnectClipNodes(context, source, clip, destination, when = context.currentTime, offset = 0) {
    const dry = context.createGain();
    source.connect(dry);
    dry.connect(destination);
    if (visibleKfs(clip).length) scheduleVolume(dry.gain, clip, when, offset);
    else dry.gain.value = Math.max(0, (Number(clip.volume) || 0) / 100);
    if (clip.echo > 0) {
      const amount = clip.echo / 100;
      const delay = context.createDelay(2);
      const feedback = context.createGain();
      const wet = context.createGain();
      delay.delayTime.value = .25;
      feedback.gain.value = .12 + amount * .46;
      wet.gain.value = amount * .65;
      source.connect(delay);
      delay.connect(wet);
      wet.connect(destination);
      delay.connect(feedback);
      feedback.connect(delay);
    }
  };

  startPlayback = async function patchedStartPlayback() {
    if (!audioContext || !state.clips.length) return;
    stopPlayback(false);
    await audioContext.resume();
    const entries = await preparePlaybackBuffers();
    if (!entries) return;
    state.playing = true;
    ui.playBtn.textContent = "⏸";
    const startTime = audioContext.currentTime + .05;
    state.playOriginContextTime = startTime;
    state.playOriginTimelineTime = state.playhead;
    state.activeSources = [];
    for (const { clip, buffer } of entries) {
      const clipEnd = clip.start + buffer.duration;
      if (clipEnd <= state.playhead) continue;
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      const when = startTime + Math.max(0, clip.start - state.playhead);
      const offset = Math.max(0, state.playhead - clip.start);
      connectClipNodes(audioContext, source, clip, audioContext.destination, when, offset);
      try { source.start(when, offset); } catch (error) { console.error(error); }
      state.activeSources.push(source);
    }
    setStatus("Playing");
    tickPlayback();
  };
  const originalStopPlayback = stopPlayback;
  stopPlayback = function patchedStopPlayback(updateStatus = true) {
    originalStopPlayback(updateStatus);
    if (ui.playBtn) ui.playBtn.textContent = "▶️";
  };

  splitSelectedClip = async function patchedSplitSelectedClip() {
    const clip = selectedClip();
    if (!clip) return;
    const local = state.playhead - clip.start;
    if (local <= .01 || local >= clipDuration(clip) - .01) {
      showToast("Place the playhead inside the selected clip before cutting.");
      return;
    }
    stopPlayback();
    setStatus("Cutting clip…");
    const processed = await processedClipBuffer(clip);
    if (!processed) return;
    const splitSample = Math.max(1, Math.min(processed.length - 1, Math.round(local * processed.sampleRate)));
    const leftBuffer = createBuffer(processed.numberOfChannels, splitSample, processed.sampleRate);
    const rightBuffer = createBuffer(processed.numberOfChannels, processed.length - splitSample, processed.sampleRate);
    for (let channel = 0; channel < processed.numberOfChannels; channel += 1) {
      const data = processed.getChannelData(channel);
      leftBuffer.copyToChannel(data.subarray(0, splitSample), channel);
      rightBuffer.copyToChannel(data.subarray(splitSample), channel);
    }
    const split = splitKeyframes(clip, local);
    const common = { assetId: clip.assetId, name: clip.name, track: clip.track, volume: clip.volume, echo: clip.echo, sourceStart: 0, stretchDuration: null, gate: null, cacheVersion: 0 };
    const left = { ...common, id: makeId("clip"), start: clip.start, sourceEnd: leftBuffer.duration, bufferOverride: leftBuffer, volumeKeyframes: split.left };
    const right = { ...common, id: makeId("clip"), start: state.playhead, sourceEnd: rightBuffer.duration, bufferOverride: rightBuffer, volumeKeyframes: split.right };
    const index = state.clips.indexOf(clip);
    state.clips.splice(index, 1, left, right);
    state.selectedClipId = right.id;
    syncSelectedControls();
    renderTimeline();
    setStatus("Ready");
    showToast("Clip cut at the playhead.");
  };

  renderMix = async function patchedRenderMix() {
    const prepared = [];
    for (const clip of state.clips) {
      const buffer = await processedClipBuffer(clip);
      if (buffer) prepared.push({ clip, buffer });
    }
    const sampleRate = 44100;
    const duration = Math.max(.1, projectDuration());
    const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineAudioContextClass) throw new Error("Offline audio rendering is unavailable in this browser.");
    const offline = new OfflineAudioContextClass(2, Math.ceil(duration * sampleRate), sampleRate);
    const compressor = offline.createDynamicsCompressor();
    compressor.threshold.value = -2;
    compressor.knee.value = 8;
    compressor.ratio.value = 4;
    compressor.attack.value = .003;
    compressor.release.value = .2;
    compressor.connect(offline.destination);
    for (const { clip, buffer } of prepared) {
      const source = offline.createBufferSource();
      source.buffer = buffer;
      connectClipNodes(offline, source, clip, compressor, clip.start, 0);
      source.start(clip.start);
    }
    return offline.startRendering();
  };

  document.addEventListener("keydown", (event) => {
    const typing = event.target.matches("input,select,textarea");
    if (typing) return;
    if (event.key.toLowerCase() === "k") { event.preventDefault(); addOrUpdateVolumeKeyframe(); }
    if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); previousVolumeKeyframe(); }
    if (event.altKey && event.key === "ArrowRight") { event.preventDefault(); nextVolumeKeyframe(); }
  });

  window.orgavoxAddVolumeKeyframe = addOrUpdateVolumeKeyframe;
  window.orgavoxPreviousVolumeKeyframe = previousVolumeKeyframe;
  window.orgavoxNextVolumeKeyframe = nextVolumeKeyframe;
  window.orgavoxDeleteVolumeKeyframe = deleteVolumeKeyframe;

  installStyles();
  setVersion();
  state.clips.forEach(kfs);
  syncSelectedControls();
  renderTimeline();
  setStatus("Ready — volume keyframes active");
})();
