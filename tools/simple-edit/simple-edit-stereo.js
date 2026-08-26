"use strict";

(function installOrgavoxStereoControls() {
  const STYLE_ID = "orgavox-stereo-style";
  const MODAL_ID = "stereoModal";
  let previewSource = null;

  const PRESETS = {
    center: { label: "Centered", explanation: "Keeps the clip centered with its normal stereo image.", pan: 0, width: 100, mono: false, autoPanDepth: 0, autoPanRate: 1.2, outputGain: 100 },
    left: { label: "Left side", explanation: "Moves the clip mostly to the left side.", pan: -55, width: 100, mono: false, autoPanDepth: 0, autoPanRate: 1.2, outputGain: 100 },
    right: { label: "Right side", explanation: "Moves the clip mostly to the right side.", pan: 55, width: 100, mono: false, autoPanDepth: 0, autoPanRate: 1.2, outputGain: 100 },
    wide: { label: "Wide stereo", explanation: "Makes the stereo image feel wider and more open.", pan: 0, width: 160, mono: false, autoPanDepth: 0, autoPanRate: 1.2, outputGain: 96 },
    narrow: { label: "Narrow focus", explanation: "Pulls the clip toward the middle without making it fully mono.", pan: 0, width: 45, mono: false, autoPanDepth: 0, autoPanRate: 1.2, outputGain: 100 },
    mono: { label: "Mono center", explanation: "Collapses the clip to the center for cleaner focused playback.", pan: 0, width: 0, mono: true, autoPanDepth: 0, autoPanRate: 1.2, outputGain: 100 },
    autopan: { label: "Slow auto-pan", explanation: "Moves the clip gently left and right while it plays.", pan: 0, width: 115, mono: false, autoPanDepth: 55, autoPanRate: 0.35, outputGain: 96 }
  };

  const CONTROL_META = {
    pan: { label: "Pan", unit: "%", min: -100, max: 100, step: 1, help: "Moves the clip left or right." },
    width: { label: "Stereo width", unit: "%", min: 0, max: 220, step: 1, help: "0 is mono, 100 is normal, higher is wider." },
    autoPanDepth: { label: "Auto-pan depth", unit: "%", min: 0, max: 100, step: 1, help: "How far the sound moves left and right automatically." },
    autoPanRate: { label: "Auto-pan speed", unit: " Hz", min: 0.05, max: 12, step: 0.05, help: "How quickly auto-pan moves." },
    outputGain: { label: "Output gain", unit: "%", min: 0, max: 150, step: 1, help: "Final loudness after stereo processing." }
  };

  let currentPresetId = "center";

  function selectedClip() {
    return state.clips.find((clip) => clip.id === state.selectedClipId) || null;
  }

  function clonePreset(id) {
    return { ...PRESETS[id], preset: id, enabled: true };
  }

  function activeSettings(clip) {
    return { ...clonePreset("center"), ...(clip?.stereoSettings || {}) };
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-stereo-modal{position:fixed;inset:0;z-index:95;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}
      .orgavox-stereo-modal[hidden]{display:none}
      .orgavox-stereo-dialog{width:min(860px,calc(100vw - 42px));max-height:min(780px,calc(100vh - 42px));overflow:auto;padding:20px;border:1px solid rgba(224,163,96,.72);border-radius:22px;background:#1a1c18;box-shadow:0 24px 80px rgba(0,0,0,.78)}
      .orgavox-stereo-grid{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:16px;margin-top:14px}
      .orgavox-stereo-panel{border:1px solid rgba(137,107,73,.62);border-radius:16px;padding:14px;background:rgba(0,0,0,.18)}
      .orgavox-stereo-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .orgavox-stereo-card{display:grid;gap:7px;padding:10px;border:1px solid rgba(137,107,73,.46);border-radius:13px;background:rgba(0,0,0,.24)}
      .orgavox-stereo-card label{display:flex;justify-content:space-between;gap:12px;color:#f8d792;font:800 .7rem var(--font-body)}
      .orgavox-stereo-card output{color:var(--water-spray);font:800 .66rem var(--font-mono)}
      .orgavox-stereo-card input[type="range"]{width:100%;accent-color:var(--water-blue)}
      .orgavox-stereo-card p{margin:0;color:rgba(245,240,219,.58);font-size:.67rem;line-height:1.35}
      .orgavox-stereo-presets{display:grid;gap:8px}.orgavox-stereo-preset{width:100%;justify-content:flex-start}
      .orgavox-stereo-preset.active{border-color:rgba(117,178,222,.9)!important;color:#fff!important;background:linear-gradient(180deg,rgba(57,132,205,.38),rgba(31,77,133,.32))!important}
      .orgavox-stereo-desc{margin-top:12px;padding:12px;border-radius:12px;background:rgba(117,178,222,.09);color:rgba(245,240,219,.76);font-size:.72rem;line-height:1.45}
      .orgavox-stereo-mono{display:flex;align-items:center;gap:9px;margin-top:11px;color:#f8d792;font-size:.72rem;font-weight:800}
      .orgavox-stereo-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:16px}
      .audio-clip .orgavox-stereo-badge{background:rgba(75,132,191,.54);color:#dff5ff}
      @media(max-width:760px){.orgavox-stereo-grid{grid-template-columns:1fr}.orgavox-stereo-controls{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureButton() {
    const button = document.getElementById("stereoBtn");
    if (button) ui.stereoBtn = button;
    return button;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "orgavox-stereo-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="orgavox-stereo-dialog" role="dialog" aria-modal="true" aria-labelledby="stereoTitle">
        <div class="popover-head"><div><span class="eyebrow">Clip-wide effect</span><h3 id="stereoTitle">Stereo / Pan</h3></div><button class="icon-button" data-stereo-close type="button">×</button></div>
        <p class="export-note">These settings apply to the selected clip as a whole.</p><div class="orgavox-tool-target" data-tool-target></div>
        <div class="orgavox-stereo-grid"><div class="orgavox-stereo-panel"><span class="eyebrow">Manual controls</span><div class="orgavox-stereo-controls" data-stereo-controls></div></div><aside class="orgavox-stereo-panel"><span class="eyebrow">Presets</span><div class="orgavox-stereo-presets" data-stereo-presets></div><label class="orgavox-stereo-mono"><input type="checkbox" data-stereo-mono> Force mono center</label><div class="orgavox-stereo-desc" data-stereo-desc></div></aside></div>
        <div class="orgavox-stereo-actions"><button class="tool-button" data-stereo-preview type="button">Preview</button><button class="tool-button" data-stereo-reset type="button">Reset</button><button class="tool-button" data-stereo-close type="button">Close</button><button class="tool-button primary" data-stereo-apply type="button">Apply</button></div>
      </section>`;
    document.body.appendChild(modal);
    const controls = modal.querySelector("[data-stereo-controls]");
    Object.entries(CONTROL_META).forEach(([key, meta]) => {
      const card = document.createElement("div");
      card.className = "orgavox-stereo-card";
      card.innerHTML = `<label><span>${meta.label}</span><output data-stereo-output="${key}"></output></label><input type="range" data-stereo-control="${key}" min="${meta.min}" max="${meta.max}" step="${meta.step}"><p>${meta.help}</p>`;
      controls.appendChild(card);
    });
    const presets = modal.querySelector("[data-stereo-presets]");
    Object.entries(PRESETS).forEach(([id, preset]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tool-button orgavox-stereo-preset";
      button.dataset.stereoPreset = id;
      button.textContent = preset.label;
      button.addEventListener("click", () => setPreset(id));
      presets.appendChild(button);
    });
    modal.querySelectorAll("[data-stereo-close]").forEach((button) => button.addEventListener("click", closeModal));
    modal.querySelector("[data-stereo-reset]")?.addEventListener("click", resetSettings);
    modal.querySelector("[data-stereo-preview]")?.addEventListener("click", previewSettings);
    modal.querySelector("[data-stereo-apply]")?.addEventListener("click", applySettings);
    modal.querySelector("[data-stereo-mono]")?.addEventListener("change", updateDescription);
    modal.querySelectorAll("[data-stereo-control]").forEach((input) => input.addEventListener("input", () => { currentPresetId = "custom"; updateOutputs(); updateDescription(); }));
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
    return modal;
  }

  function controlValue(key) {
    const input = ensureModal().querySelector(`[data-stereo-control="${key}"]`);
    const value = Number(input?.value);
    return Number.isFinite(value) ? value : PRESETS.center[key];
  }

  function readSettings() {
    const modal = ensureModal();
    return { enabled: true, preset: currentPresetId, label: currentPresetId === "custom" ? "Stereo" : (PRESETS[currentPresetId]?.label || "Stereo"), pan: controlValue("pan"), width: controlValue("width"), mono: Boolean(modal.querySelector("[data-stereo-mono]")?.checked), autoPanDepth: controlValue("autoPanDepth"), autoPanRate: controlValue("autoPanRate"), outputGain: controlValue("outputGain") };
  }

  function writeSettings(settings) {
    const modal = ensureModal();
    Object.keys(CONTROL_META).forEach((key) => { const input = modal.querySelector(`[data-stereo-control="${key}"]`); if (input) input.value = settings[key]; });
    const mono = modal.querySelector("[data-stereo-mono]");
    if (mono) mono.checked = Boolean(settings.mono);
    currentPresetId = settings.preset || "custom";
    updateOutputs();
    updateDescription();
  }

  function formatValue(key, value) {
    if (key === "autoPanRate") return `${Number(value).toFixed(2)} Hz`;
    if (key === "pan") return Number(value) === 0 ? "Center" : `${Math.abs(Number(value))}% ${Number(value) < 0 ? "L" : "R"}`;
    return `${Math.round(Number(value))}%`;
  }

  function updateOutputs() {
    const modal = ensureModal();
    Object.keys(CONTROL_META).forEach((key) => { const output = modal.querySelector(`[data-stereo-output="${key}"]`); if (output) output.textContent = formatValue(key, controlValue(key)); });
    modal.querySelectorAll("[data-stereo-preset]").forEach((button) => button.classList.toggle("active", button.dataset.stereoPreset === currentPresetId));
  }

  function updateDescription() {
    const desc = ensureModal().querySelector("[data-stereo-desc]");
    const settings = readSettings();
    if (desc) desc.textContent = settings.preset === "custom" ? "Custom stereo placement for the selected clip." : (PRESETS[settings.preset]?.explanation || "Custom stereo placement for the selected clip.");
    updateStereoButtonState();
  }

  function setPreset(id) { currentPresetId = id; writeSettings(clonePreset(id)); }
  function resetSettings() { currentPresetId = "center"; writeSettings(clonePreset("center")); }

  function openModal() {
    const clip = selectedClip();
    if (!clip) return showToast("Select a clip before opening Stereo / Pan.");
    const modal = ensureModal();
    window.orgavoxUpdateToolTarget?.(modal, clip, "Stereo target");
    writeSettings(activeSettings(clip));
    modal.hidden = false;
  }
  function closeModal() { stopPreview(); ensureModal().hidden = true; }
  function stopPreview() { try { previewSource?.stop(); } catch {} previewSource = null; }

  async function previewSettings() {
    const clip = selectedClip();
    if (!clip) return;
    stopPreview();
    const buffer = await processedClipBuffer(clip);
    if (!buffer) return;
    const context = new AudioContext();
    const source = context.createBufferSource();
    source.buffer = buffer;
    connectClipNodes(context, source, { ...clip, stereoSettings: readSettings() }, context.destination, context.currentTime, 0);
    source.start();
    previewSource = source;
    source.onended = () => { previewSource = null; setTimeout(() => context.close(), 120); };
  }

  function applySettings() {
    const clip = selectedClip();
    if (!clip) return;
    const settings = readSettings();
    const normalized = window.orgavoxNormalizeStereoSettings?.(settings);
    clip.stereoSettings = normalized ? settings : null;
    invalidateClip(clip);
    renderTimeline();
    updateStereoButtonState();
    showToast(clip.stereoSettings ? "Stereo / Pan applied." : "Stereo / Pan reset.");
    closeModal();
  }

  function updateStereoButtonState() {
    const button = ensureButton();
    const clip = selectedClip();
    if (!button) return;
    button.disabled = !clip;
    button.classList.toggle("active", Boolean(clip?.stereoSettings));
  }

  function addClipBadges() {
    state.clips.forEach((clip) => {
      if (!clip.stereoSettings) return;
      const clipNode = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
      const badgeBox = clipNode?.querySelector(".clip-effect-badges");
      if (!badgeBox || badgeBox.querySelector(".orgavox-stereo-badge")) return;
      const badge = document.createElement("span");
      badge.className = "orgavox-stereo-badge";
      if (clip.stereoSettings.mono) badge.textContent = "MONO";
      else if (Math.abs(clip.stereoSettings.pan || 0) > 0.5) badge.textContent = (clip.stereoSettings.pan < 0 ? "L" : "R") + Math.abs(Math.round(clip.stereoSettings.pan));
      else badge.textContent = "STEREO";
      badgeBox.appendChild(badge);
    });
  }

  function patchRender() {
    if (window.__orgavoxStereoRenderPatched) return;
    window.__orgavoxStereoRenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxStereoRenderTimeline() { previousRenderTimeline(); updateStereoButtonState(); addClipBadges(); };
    const previousSyncSelectedControls = syncSelectedControls;
    syncSelectedControls = function orgavoxStereoSyncSelectedControls() { previousSyncSelectedControls(); updateStereoButtonState(); };
  }

  window.orgavoxOpenStereo = openModal;
  window.orgavoxUpdateStereoButton = updateStereoButtonState;

  installStyles();
  ensureButton();
  ensureModal();
  patchRender();
  updateStereoButtonState();
  renderTimeline();
  setTimeout(updateStereoButtonState, 150);
})();