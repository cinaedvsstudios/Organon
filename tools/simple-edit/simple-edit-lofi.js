"use strict";

(function installOrgavoxLofiControls() {
  const STYLE_ID = "orgavox-lofi-style";
  const MODAL_ID = "lofiModal";
  let previewSource = null;

  const PRESETS = {
    clean: { label: "Clean / Off", explanation: "Keeps the clip clean. Use Reset to remove the lo-fi effect.", bitDepth: 16, sampleRate: 44100, crushMix: 0, noise: 0, wobble: 0, highCut: 20000, outputGain: 100 },
    subtle: { label: "Subtle grit", explanation: "Adds a small amount of crunchy texture without destroying the clip.", bitDepth: 12, sampleRate: 22050, crushMix: 35, noise: 2, wobble: 2, highCut: 14000, outputGain: 100 },
    sampler: { label: "Old sampler", explanation: "Lower sample rate and gentle filtering for early digital sampler colour.", bitDepth: 10, sampleRate: 12000, crushMix: 70, noise: 4, wobble: 3, highCut: 7200, outputGain: 98 },
    eightbit: { label: "8-bit crush", explanation: "Hard stepped crunchy digital texture for arcade-style sounds.", bitDepth: 8, sampleRate: 8000, crushMix: 88, noise: 3, wobble: 0, highCut: 5600, outputGain: 96 },
    cassette: { label: "Cassette haze", explanation: "Soft darkening, hiss and wobble for a worn tape feel.", bitDepth: 13, sampleRate: 18000, crushMix: 55, noise: 10, wobble: 16, highCut: 5200, outputGain: 96 },
    broken: { label: "Broken robot", explanation: "Very degraded stepped sound for glitchy robot or damaged speaker effects.", bitDepth: 5, sampleRate: 3000, crushMix: 100, noise: 7, wobble: 7, highCut: 2600, outputGain: 92 }
  };

  const CONTROL_META = {
    bitDepth: { label: "Bit depth", unit: " bit", min: 3, max: 16, step: 1, help: "Lower values sound more blocky and digital." },
    sampleRate: { label: "Sample rate", unit: " Hz", min: 800, max: 44100, step: 100, help: "Lower values remove detail and make the clip rougher." },
    crushMix: { label: "Crush mix", unit: "%", min: 0, max: 100, step: 1, help: "How much of the degraded sound is mixed in." },
    noise: { label: "Noise / hiss", unit: "%", min: 0, max: 40, step: 1, help: "Adds rough background grit." },
    wobble: { label: "Wobble", unit: "%", min: 0, max: 40, step: 1, help: "Adds unstable tape-style movement." },
    highCut: { label: "High cut", unit: " Hz", min: 800, max: 20000, step: 100, help: "Darkens the crushed sound by removing high fizz." },
    outputGain: { label: "Output gain", unit: "%", min: 0, max: 150, step: 1, help: "Final loudness after the lo-fi effect." }
  };

  let currentPresetId = "clean";

  function selectedClip() {
    return state.clips.find((clip) => clip.id === state.selectedClipId) || null;
  }

  function clonePreset(id) {
    return { ...PRESETS[id], preset: id, enabled: true };
  }

  function activeSettings(clip) {
    return { ...clonePreset("clean"), ...(clip?.lofiSettings || {}) };
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-lofi-modal{position:fixed;inset:0;z-index:95;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}
      .orgavox-lofi-modal[hidden]{display:none}
      .orgavox-lofi-dialog{width:min(900px,calc(100vw - 42px));max-height:min(780px,calc(100vh - 42px));overflow:auto;padding:20px;border:1px solid rgba(224,163,96,.72);border-radius:22px;background:#1a1c18;box-shadow:0 24px 80px rgba(0,0,0,.78)}
      .orgavox-lofi-grid{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:16px;margin-top:14px}
      .orgavox-lofi-panel{border:1px solid rgba(137,107,73,.62);border-radius:16px;padding:14px;background:rgba(0,0,0,.18)}
      .orgavox-lofi-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .orgavox-lofi-card{display:grid;gap:7px;padding:10px;border:1px solid rgba(137,107,73,.46);border-radius:13px;background:rgba(0,0,0,.24)}
      .orgavox-lofi-card label{display:flex;justify-content:space-between;gap:12px;color:#f8d792;font:800 .7rem var(--font-body)}
      .orgavox-lofi-card output{color:var(--water-spray);font:800 .66rem var(--font-mono)}
      .orgavox-lofi-card input[type="range"]{width:100%;accent-color:var(--water-blue)}
      .orgavox-lofi-card p{margin:0;color:rgba(245,240,219,.58);font-size:.67rem;line-height:1.35}
      .orgavox-lofi-presets{display:grid;gap:8px}.orgavox-lofi-preset{width:100%;justify-content:flex-start}
      .orgavox-lofi-preset.active{border-color:rgba(117,178,222,.9)!important;color:#fff!important;background:linear-gradient(180deg,rgba(57,132,205,.38),rgba(31,77,133,.32))!important}
      .orgavox-lofi-desc{margin-top:12px;padding:12px;border-radius:12px;background:rgba(117,178,222,.09);color:rgba(245,240,219,.76);font-size:.72rem;line-height:1.45}
      .orgavox-lofi-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:16px}
      .audio-clip .orgavox-lofi-badge{background:rgba(132,80,191,.58);color:#f2e4ff}
      @media(max-width:760px){.orgavox-lofi-grid{grid-template-columns:1fr}.orgavox-lofi-controls{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureButton() {
    const button = document.getElementById("lofiBtn");
    if (button) ui.lofiBtn = button;
    return button;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "orgavox-lofi-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="orgavox-lofi-dialog" role="dialog" aria-modal="true" aria-labelledby="lofiTitle">
        <div class="popover-head"><div><span class="eyebrow">Clip-wide effect</span><h3 id="lofiTitle">Lo-fi / Bitcrusher</h3></div><button class="icon-button" data-lofi-close type="button">×</button></div>
        <p class="export-note">These settings degrade the selected clip as a whole and render into playback/export.</p><div class="orgavox-tool-target" data-tool-target></div>
        <div class="orgavox-lofi-grid"><div class="orgavox-lofi-panel"><span class="eyebrow">Manual controls</span><div class="orgavox-lofi-controls" data-lofi-controls></div></div><aside class="orgavox-lofi-panel"><span class="eyebrow">Presets</span><div class="orgavox-lofi-presets" data-lofi-presets></div><div class="orgavox-lofi-desc" data-lofi-desc></div></aside></div>
        <div class="orgavox-lofi-actions"><button class="tool-button" data-lofi-preview type="button">Preview</button><button class="tool-button" data-lofi-reset type="button">Reset</button><button class="tool-button" data-lofi-close type="button">Close</button><button class="tool-button primary" data-lofi-apply type="button">Apply</button></div>
      </section>`;
    document.body.appendChild(modal);
    const controls = modal.querySelector("[data-lofi-controls]");
    Object.entries(CONTROL_META).forEach(([key, meta]) => {
      const card = document.createElement("div");
      card.className = "orgavox-lofi-card";
      card.innerHTML = `<label><span>${meta.label}</span><output data-lofi-output="${key}"></output></label><input type="range" data-lofi-control="${key}" min="${meta.min}" max="${meta.max}" step="${meta.step}"><p>${meta.help}</p>`;
      controls.appendChild(card);
    });
    const presets = modal.querySelector("[data-lofi-presets]");
    Object.entries(PRESETS).forEach(([id, preset]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tool-button orgavox-lofi-preset";
      button.dataset.lofiPreset = id;
      button.textContent = preset.label;
      button.addEventListener("click", () => setPreset(id));
      presets.appendChild(button);
    });
    modal.querySelectorAll("[data-lofi-close]").forEach((button) => button.addEventListener("click", closeModal));
    modal.querySelector("[data-lofi-reset]")?.addEventListener("click", resetSettings);
    modal.querySelector("[data-lofi-preview]")?.addEventListener("click", previewSettings);
    modal.querySelector("[data-lofi-apply]")?.addEventListener("click", applySettings);
    modal.querySelectorAll("[data-lofi-control]").forEach((input) => input.addEventListener("input", () => { currentPresetId = "custom"; updateOutputs(); updateDescription(); }));
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
    return modal;
  }

  function controlValue(key) {
    const input = ensureModal().querySelector(`[data-lofi-control="${key}"]`);
    const value = Number(input?.value);
    return Number.isFinite(value) ? value : PRESETS.clean[key];
  }

  function readSettings() {
    return {
      enabled: true,
      preset: currentPresetId,
      label: currentPresetId === "custom" ? "Lo-fi" : (PRESETS[currentPresetId]?.label || "Lo-fi"),
      bitDepth: controlValue("bitDepth"),
      sampleRate: controlValue("sampleRate"),
      crushMix: controlValue("crushMix"),
      noise: controlValue("noise"),
      wobble: controlValue("wobble"),
      highCut: controlValue("highCut"),
      outputGain: controlValue("outputGain")
    };
  }

  function writeSettings(settings) {
    const modal = ensureModal();
    Object.keys(CONTROL_META).forEach((key) => {
      const input = modal.querySelector(`[data-lofi-control="${key}"]`);
      if (input) input.value = settings[key];
    });
    currentPresetId = settings.preset || "custom";
    updateOutputs();
    updateDescription();
  }

  function formatValue(key, value) {
    if (key === "sampleRate" || key === "highCut") return `${Math.round(Number(value))} Hz`;
    if (key === "bitDepth") return `${Math.round(Number(value))} bit`;
    return `${Math.round(Number(value))}%`;
  }

  function updateOutputs() {
    const modal = ensureModal();
    Object.keys(CONTROL_META).forEach((key) => {
      const output = modal.querySelector(`[data-lofi-output="${key}"]`);
      if (output) output.textContent = formatValue(key, controlValue(key));
    });
    modal.querySelectorAll("[data-lofi-preset]").forEach((button) => button.classList.toggle("active", button.dataset.lofiPreset === currentPresetId));
  }

  function updateDescription() {
    const desc = ensureModal().querySelector("[data-lofi-desc]");
    if (desc) desc.textContent = currentPresetId === "custom" ? "Custom lo-fi degradation for the selected clip." : (PRESETS[currentPresetId]?.explanation || "Custom lo-fi degradation for the selected clip.");
    updateLofiButtonState();
  }

  function setPreset(id) { currentPresetId = id; writeSettings(clonePreset(id)); }
  function resetSettings() { currentPresetId = "clean"; writeSettings(clonePreset("clean")); }

  function openModal() {
    const clip = selectedClip();
    if (!clip) return showToast("Select a clip before opening Lo-fi / Crush.");
    const modal = ensureModal();
    window.orgavoxUpdateToolTarget?.(modal, clip, "Lo-Fi target");
    writeSettings(activeSettings(clip));
    modal.hidden = false;
  }

  function closeModal() { stopPreview(); ensureModal().hidden = true; }
  function stopPreview() { try { previewSource?.stop(); } catch {} previewSource = null; }

  async function previewSettings() {
    const clip = selectedClip();
    if (!clip) return;
    stopPreview();
    const buffer = await processedClipBuffer({ ...clip, lofiSettings: readSettings() });
    if (!buffer) return;
    const context = new AudioContext();
    const source = context.createBufferSource();
    source.buffer = buffer;
    connectClipNodes(context, source, { ...clip, lofiSettings: null }, context.destination, context.currentTime, 0);
    source.start();
    previewSource = source;
    source.onended = () => { previewSource = null; setTimeout(() => context.close(), 120); };
  }

  function applySettings() {
    const clip = selectedClip();
    if (!clip) return;
    const settings = readSettings();
    const normalized = window.orgavoxNormalizeLofiSettings?.(settings);
    clip.lofiSettings = normalized ? settings : null;
    invalidateClip(clip);
    renderTimeline();
    updateLofiButtonState();
    showToast(clip.lofiSettings ? "Lo-fi / Crush applied." : "Lo-fi / Crush reset.");
    closeModal();
  }

  function updateLofiButtonState() {
    const button = ensureButton();
    const clip = selectedClip();
    if (!button) return;
    button.disabled = !clip;
    button.classList.toggle("active", Boolean(clip?.lofiSettings));
  }

  function addClipBadges() {
    state.clips.forEach((clip) => {
      if (!clip.lofiSettings) return;
      const clipNode = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
      const badgeBox = clipNode?.querySelector(".clip-effect-badges");
      if (!badgeBox || badgeBox.querySelector(".orgavox-lofi-badge")) return;
      const badge = document.createElement("span");
      badge.className = "orgavox-lofi-badge";
      badge.textContent = clip.lofiSettings.bitDepth <= 8 ? "CRUSH" : "LOFI";
      badgeBox.appendChild(badge);
    });
  }

  function patchRender() {
    if (window.__orgavoxLofiRenderPatched) return;
    window.__orgavoxLofiRenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxLofiRenderTimeline() { previousRenderTimeline(); updateLofiButtonState(); addClipBadges(); };
    const previousSyncSelectedControls = syncSelectedControls;
    syncSelectedControls = function orgavoxLofiSyncSelectedControls() { previousSyncSelectedControls(); updateLofiButtonState(); };
  }

  window.orgavoxOpenLofi = openModal;
  window.orgavoxUpdateLofiButton = updateLofiButtonState;

  installStyles();
  ensureButton();
  ensureModal();
  patchRender();
  updateLofiButtonState();
  renderTimeline();
  setTimeout(updateLofiButtonState, 150);
})();
