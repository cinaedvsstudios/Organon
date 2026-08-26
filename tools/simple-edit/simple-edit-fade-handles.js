"use strict";

(function installSimpleEditFadeHandles() {
  const VERSION = "v0.20";
  const STYLE_ID = "simple-edit-fade-handles-style";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const selected = () => selectedClip();

  function setVersion() {
    document.title = `Organon — Simple Edit ${VERSION}`;
    const badge = document.querySelector(".phase1-version, .simple-edit-version");
    if (badge) badge.textContent = VERSION;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .phase2-fade-group { padding-left:2px; padding-right:2px; }
      body.simple-edit-phase1 .audio-clip.has-fades .clip-effect-badges span.fade-badge { border-color: rgba(190,118,255,.72); color: #ead3ff; }
      body.simple-edit-phase1 .clip-fade-zone { position:absolute; top:0; bottom:0; pointer-events:none; z-index:5; opacity:.72; }
      body.simple-edit-phase1 .clip-fade-zone.fade-in { left:0; background: linear-gradient(90deg, rgba(190,118,255,.34), rgba(190,118,255,.06)); border-right:1px solid rgba(226,197,255,.54); }
      body.simple-edit-phase1 .clip-fade-zone.fade-out { right:0; background: linear-gradient(90deg, rgba(190,118,255,.06), rgba(190,118,255,.34)); border-left:1px solid rgba(226,197,255,.54); }
      body.simple-edit-phase1 .clip-fade-line { position:absolute; left:0; right:0; top:0; bottom:0; pointer-events:none; z-index:6; overflow:hidden; }
      body.simple-edit-phase1 .clip-fade-line svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
      body.simple-edit-phase1 .clip-fade-line path { fill:none; stroke:rgba(225,172,255,.86); stroke-width:2.4; stroke-linecap:round; filter:drop-shadow(0 0 4px rgba(190,118,255,.55)); }
      body.simple-edit-phase1 .fade-handle {
        position:absolute; top:5px; width:13px; height:calc(100% - 10px); transform:translateX(-50%);
        border:1px solid rgba(244,222,255,.82); border-radius:999px; background:rgba(95,37,122,.92);
        box-shadow:0 0 0 2px rgba(190,118,255,.2),0 0 10px rgba(190,118,255,.55); cursor:ew-resize; z-index:20;
      }
      body.simple-edit-phase1 .fade-handle::after { content:""; position:absolute; top:50%; left:50%; width:5px; height:5px; transform:translate(-50%,-50%); border-radius:50%; background:#f4deff; }
      body.simple-edit-phase1 .fade-handle.fade-out { transform:translateX(-50%); }
      body.simple-edit-phase1 .audio-clip:not(.selected) .fade-handle { opacity:.42; }
      body.simple-edit-phase1 .audio-clip:not(.selected) .fade-handle.zero-fade { display:none; }
    `;
    document.head.appendChild(style);
  }

  function normalizedFades(clip) {
    const duration = Math.max(0.01, clipDuration(clip));
    clip.fadeIn = clamp(clip.fadeIn, 0, duration);
    clip.fadeOut = clamp(clip.fadeOut, 0, duration);
    return { fadeIn: clip.fadeIn, fadeOut: clip.fadeOut, duration };
  }

  function fadeFactorAt(clip, localTime) {
    const { fadeIn, fadeOut, duration } = normalizedFades(clip);
    const time = clamp(localTime, 0, duration);
    let gain = 1;
    if (fadeIn > 0.001 && time < fadeIn) gain = Math.min(gain, time / fadeIn);
    if (fadeOut > 0.001 && time > duration - fadeOut) gain = Math.min(gain, (duration - time) / fadeOut);
    return clamp(gain, 0, 1);
  }

  function scheduleFade(param, clip, when, offset = 0) {
    const { fadeIn, fadeOut, duration } = normalizedFades(clip);
    const start = Math.max(0, Number(when) || 0);
    const local = clamp(offset, 0, duration);
    param.cancelScheduledValues(start);
    param.setValueAtTime(fadeFactorAt(clip, local), start);
    const points = [fadeIn, Math.max(0, duration - fadeOut), duration]
      .filter((point) => point > local + 0.001 && point <= duration + 0.001)
      .sort((a, b) => a - b)
      .filter((point, index, list) => index === 0 || Math.abs(point - list[index - 1]) > 0.001);
    points.forEach((point) => {
      param.linearRampToValueAtTime(fadeFactorAt(clip, point), start + point - local);
    });
  }

  function ensureButtons() {
    ui.fadeInBtn = document.getElementById("fadeInBtn");
    ui.fadeOutBtn = document.getElementById("fadeOutBtn");
    ui.resetFadesBtn = document.getElementById("resetFadesBtn");
  }

  function updateButtons() {
    ensureButtons();
    const clip = selected();
    const hasClip = Boolean(clip);
    if (ui.fadeInBtn) ui.fadeInBtn.disabled = !hasClip;
    if (ui.fadeOutBtn) ui.fadeOutBtn.disabled = !hasClip;
    if (ui.resetFadesBtn) ui.resetFadesBtn.disabled = !hasClip || !(Number(clip?.fadeIn) > 0 || Number(clip?.fadeOut) > 0);
  }

  function selectedLocalTime(clip) {
    return clamp(state.playhead - clip.start, 0, clipDuration(clip));
  }

  function setFadeInFromPlayhead() {
    const clip = selected();
    if (!clip) return;
    stopPlayback();
    const local = selectedLocalTime(clip);
    clip.fadeIn = local;
    normalizedFades(clip);
    renderTimeline();
    updateButtons();
    showToast(local <= 0.001 ? "Fade in removed." : `Fade in set to ${formatTime(local)}.`);
  }

  function setFadeOutFromPlayhead() {
    const clip = selected();
    if (!clip) return;
    stopPlayback();
    const duration = clipDuration(clip);
    const local = selectedLocalTime(clip);
    const fade = Math.max(0, duration - local);
    clip.fadeOut = fade;
    normalizedFades(clip);
    renderTimeline();
    updateButtons();
    showToast(fade <= 0.001 ? "Fade out removed." : `Fade out set to ${formatTime(fade)}.`);
  }

  function resetFades() {
    const clip = selected();
    if (!clip) return;
    stopPlayback();
    clip.fadeIn = 0;
    clip.fadeOut = 0;
    renderTimeline();
    updateButtons();
    showToast("Fades removed from selected clip.");
  }

  function updateFadeVisual(clip) {
    const element = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
    if (!element) return;
    const { fadeIn, fadeOut, duration } = normalizedFades(clip);
    const width = Math.max(12, duration * state.pixelsPerSecond);
    const fadeInX = clamp(fadeIn * state.pixelsPerSecond, 0, width);
    const fadeOutX = clamp((duration - fadeOut) * state.pixelsPerSecond, 0, width);
    element.classList.toggle("has-fades", fadeIn > 0.001 || fadeOut > 0.001);

    const inZone = element.querySelector(".clip-fade-zone.fade-in");
    const outZone = element.querySelector(".clip-fade-zone.fade-out");
    const inHandle = element.querySelector(".fade-handle.fade-in");
    const outHandle = element.querySelector(".fade-handle.fade-out");
    const line = element.querySelector(".clip-fade-line");
    if (inZone) inZone.style.width = `${fadeInX}px`;
    if (outZone) outZone.style.width = `${Math.max(0, width - fadeOutX)}px`;
    if (inHandle) {
      inHandle.style.left = `${fadeInX}px`;
      inHandle.classList.toggle("zero-fade", fadeIn <= 0.001);
      inHandle.title = `Fade in: ${formatTime(fadeIn)}. Drag to adjust.`;
    }
    if (outHandle) {
      outHandle.style.left = `${fadeOutX}px`;
      outHandle.classList.toggle("zero-fade", fadeOut <= 0.001);
      outHandle.title = `Fade out: ${formatTime(fadeOut)}. Drag to adjust.`;
    }
    if (line) {
      line.innerHTML = `<svg viewBox="0 0 ${Math.max(1, width)} 100" preserveAspectRatio="none" aria-hidden="true">
        ${fadeIn > 0.001 ? `<path d="M 0 88 C ${fadeInX * .35} 88 ${fadeInX * .65} 16 ${fadeInX} 16" />` : ""}
        ${fadeOut > 0.001 ? `<path d="M ${fadeOutX} 16 C ${fadeOutX + (width - fadeOutX) * .35} 16 ${fadeOutX + (width - fadeOutX) * .65} 88 ${width} 88" />` : ""}
      </svg>`;
    }

    const badges = element.querySelector(".clip-effect-badges");
    if (badges && (fadeIn > 0.001 || fadeOut > 0.001) && !badges.querySelector(".fade-badge")) {
      const badge = document.createElement("span");
      badge.className = "fade-badge";
      badge.textContent = "FADE";
      badge.title = `Fade in ${formatTime(fadeIn)}, fade out ${formatTime(fadeOut)}`;
      badges.appendChild(badge);
    }
  }

  function beginFadeDrag(event, clip, type) {
    event.preventDefault();
    event.stopPropagation();
    stopPlayback();
    selectClip(clip.id, false);
    state.fadeDrag = { clipId: clip.id, type };
    document.addEventListener("pointermove", moveFadeDrag);
    document.addEventListener("pointerup", endFadeDrag, { once: true });
    document.addEventListener("pointercancel", endFadeDrag, { once: true });
  }

  function moveFadeDrag(event) {
    const drag = state.fadeDrag;
    if (!drag) return;
    const clip = state.clips.find((item) => item.id === drag.clipId);
    const element = clip ? document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`) : null;
    if (!clip || !element) return;
    const rect = element.getBoundingClientRect();
    const local = clamp((event.clientX - rect.left) / state.pixelsPerSecond, 0, clipDuration(clip));
    if (drag.type === "in") clip.fadeIn = local;
    else clip.fadeOut = Math.max(0, clipDuration(clip) - local);
    normalizedFades(clip);
    updateFadeVisual(clip);
    updateButtons();
  }

  function endFadeDrag() {
    document.removeEventListener("pointermove", moveFadeDrag);
    state.fadeDrag = null;
    renderTimeline();
  }

  function installClipFadeControls(clip) {
    const element = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
    if (!element || element.querySelector(".fade-handle")) return;
    const inZone = document.createElement("div");
    inZone.className = "clip-fade-zone fade-in";
    const outZone = document.createElement("div");
    outZone.className = "clip-fade-zone fade-out";
    const line = document.createElement("div");
    line.className = "clip-fade-line";
    const inHandle = document.createElement("button");
    inHandle.type = "button";
    inHandle.className = "fade-handle fade-in";
    inHandle.addEventListener("pointerdown", (event) => beginFadeDrag(event, clip, "in"));
    const outHandle = document.createElement("button");
    outHandle.type = "button";
    outHandle.className = "fade-handle fade-out";
    outHandle.addEventListener("pointerdown", (event) => beginFadeDrag(event, clip, "out"));
    element.append(inZone, outZone, line, inHandle, outHandle);
    updateFadeVisual(clip);
  }

  const previousRenderTimeline = renderTimeline;
  renderTimeline = function fadeHandlesRenderTimeline() {
    previousRenderTimeline();
    state.clips.forEach(installClipFadeControls);
  };

  const previousSyncSelectedControls = syncSelectedControls;
  syncSelectedControls = function fadeHandlesSyncSelectedControls() {
    previousSyncSelectedControls();
    updateButtons();
  };

  const previousSelectClip = selectClip;
  selectClip = function fadeHandlesSelectClip(id, rerender = true) {
    previousSelectClip(id, rerender);
    updateButtons();
  };

  const previousConnectClipNodes = connectClipNodes;
  connectClipNodes = function fadeHandlesConnectClipNodes(context, source, clip, destination, when = context.currentTime, offset = 0) {
    if (!(Number(clip.fadeIn) > 0 || Number(clip.fadeOut) > 0)) {
      previousConnectClipNodes(context, source, clip, destination, when, offset);
      return;
    }
    const fadeGain = context.createGain();
    previousConnectClipNodes(context, source, clip, fadeGain, when, offset);
    scheduleFade(fadeGain.gain, clip, when, offset);
    fadeGain.connect(destination);
  };

  const previousSplitSelectedClip = splitSelectedClip;
  splitSelectedClip = async function fadeHandlesSplitSelectedClip() {
    const original = selected();
    if (!original || !(Number(original.fadeIn) > 0 || Number(original.fadeOut) > 0)) {
      return previousSplitSelectedClip();
    }
    const originalId = original.id;
    const originalStart = original.start;
    const originalDuration = clipDuration(original);
    const fadeIn = clamp(original.fadeIn, 0, originalDuration);
    const fadeOut = clamp(original.fadeOut, 0, originalDuration);
    await previousSplitSelectedClip();
    const left = state.clips.find((clip) => Math.abs(clip.start - originalStart) < 0.01 && clip.id !== originalId);
    const right = state.clips.find((clip) => Math.abs(clip.start - state.playhead) < 0.01 && clip.id !== originalId);
    if (left) left.fadeIn = Math.min(fadeIn, clipDuration(left));
    if (right) right.fadeOut = Math.min(fadeOut, clipDuration(right));
    renderTimeline();
  };

  window.orgavoxSetFadeIn = setFadeInFromPlayhead;
  window.orgavoxSetFadeOut = setFadeOutFromPlayhead;
  window.orgavoxResetFades = resetFades;
  window.orgavoxUpdateFadeButtons = updateButtons;

  installStyles();
  setVersion();
  ensureButtons();
  syncSelectedControls();
  renderTimeline();
  setStatus("Ready — fade handles active");
})();
