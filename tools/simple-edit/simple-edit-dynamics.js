"use strict";

(function installOrgavoxDynamics() {
  const DYNAMICS_VERSION = window.ORGAVOX_VERSION || "v0.30";
  const STYLE_ID = "orgavox-dynamics-style";
  const MODAL_ID = "dynamicsModal";
  let previewSource = null;

  const PRESETS = {
    leveler: {
      label: "Voice Leveler",
      explanation: "Smooths uneven speech or narration without sounding heavily compressed.",
      threshold: -26, ratio: 3, knee: 18, attack: 10, release: 260, mix: 100, makeupGain: 112, outputGain: 100
    },
    glue: {
      label: "Gentle Glue",
      explanation: "Light compression to make a clip feel more controlled and held together.",
      threshold: -20, ratio: 2, knee: 22, attack: 28, release: 320, mix: 82, makeupGain: 104, outputGain: 100
    },
    limiter: {
      label: "Peak Limiter",
      explanation: "Catches loud peaks and helps stop sharp sounds jumping out too much.",
      threshold: -8, ratio: 18, knee: 4, attack: 2, release: 150, mix: 100, makeupGain: 100, outputGain: 96
    },
    broadcast: {
      label: "Broadcast Tight",
      explanation: "A firmer radio-style compressor that keeps the clip dense and upfront.",
      threshold: -30, ratio: 5, knee: 10, attack: 5, release: 210, mix: 100, makeupGain: 118, outputGain: 96
    },
    pump: {
      label: "Pumping Effect",
      explanation: "A more obvious squeeze and release for exaggerated rhythmic movement.",
      threshold: -34, ratio: 9, knee: 2, attack: 3, release: 620, mix: 92, makeupGain: 118, outputGain: 92
    },
    soft: {
      label: "Soft Control",
      explanation: "Very gentle control for clips that only need a small amount of levelling.",
      threshold: -18, ratio: 1.7, knee: 30, attack: 45, release: 420, mix: 70, makeupGain: 102, outputGain: 100
    }
  };

  const CONTROL_META = {
    threshold: { label: "Threshold", unit: "dB", min: -60, max: 0, step: 1, help: "The level where compression starts working." },
    ratio: { label: "Ratio", unit: ":1", min: 1, max: 24, step: 0.1, help: "How strongly loud parts are pushed down." },
    knee: { label: "Knee", unit: "dB", min: 0, max: 40, step: 1, help: "Higher is smoother. Lower is harder and more obvious." },
    attack: { label: "Attack", unit: "ms", min: 1, max: 250, step: 1, help: "How quickly the compressor grabs loud peaks." },
    release: { label: "Release", unit: "ms", min: 20, max: 1600, step: 10, help: "How quickly compression lets go again." },
    mix: { label: "Wet mix", unit: "%", min: 0, max: 100, step: 1, help: "Blends compressed audio with the unchanged clip." },
    makeupGain: { label: "Makeup gain", unit: "%", min: 0, max: 200, step: 1, help: "Adds back loudness after compression." },
    outputGain: { label: "Output gain", unit: "%", min: 0, max: 150, step: 1, help: "Final loudness after dynamics." }
  };

  let currentPresetId = "leveler";

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function clonePreset(id) {
    const preset = PRESETS[id] || PRESETS.leveler;
    return { ...preset, preset: id, enabled: true };
  }

  function normalizeDynamics(raw) {
    const base = clonePreset(raw?.preset || currentPresetId || "leveler");
    const source = raw || base;
    Object.keys(CONTROL_META).forEach((key) => {
      const meta = CONTROL_META[key];
      base[key] = clampNumber(source[key], meta.min, meta.max, base[key]);
    });
    base.enabled = source.enabled !== false;
    base.label = source.label || PRESETS[base.preset]?.label || "Custom Dynamics";
    base.explanation = source.explanation || PRESETS[base.preset]?.explanation || "Custom clip-wide dynamics settings.";
    return base;
  }

  function settingsForClip(clip) {
    if (!clip?.dynamicsSettings?.enabled) return null;
    return normalizeDynamics(clip.dynamicsSettings);
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .dynamics-btn.dynamics-active { border-color: rgba(117,216,255,.92); color:#dff5ff; box-shadow:0 0 0 2px rgba(117,216,255,.14); }
      body.simple-edit-phase1 .clip-effect-badges span.dynamics-badge { border-color: rgba(117,216,255,.68); color:#cbefff; }
      .dynamics-backdrop { position:fixed; inset:0; z-index:2672; display:none; align-items:center; justify-content:center; padding:20px; background:rgba(5,7,7,.74); backdrop-filter:blur(7px); }
      .dynamics-backdrop.open { display:flex; }
      .dynamics-dialog { width:min(880px,94vw); max-height:min(740px,92vh); overflow:auto; border:1px solid rgba(224,163,96,.58); border-radius:22px; background:linear-gradient(180deg,rgba(41,38,30,.98),rgba(17,20,18,.99)); color:#f5f0db; box-shadow:0 26px 80px rgba(0,0,0,.54), inset 0 0 0 1px rgba(255,255,255,.04); padding:18px; }
      .dynamics-head { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; margin-bottom:14px; }
      .dynamics-head h3 { margin:4px 0 6px; font-family:var(--font-headers); font-size:1.35rem; letter-spacing:.04em; }
      .dynamics-head p, .dynamics-explain { margin:0; color:rgba(245,240,219,.72); line-height:1.45; }
      .dynamics-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(240px,300px); gap:14px; align-items:start; }
      .dynamics-panel { border:1px solid rgba(224,163,96,.26); border-radius:16px; background:rgba(7,9,8,.38); padding:14px; }
      .dynamics-panel h4 { margin:0 0 10px; font-size:.84rem; letter-spacing:.08em; text-transform:uppercase; color:#f8d792; }
      .dynamics-controls { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .dynamics-control { display:grid; gap:6px; border:1px solid rgba(224,163,96,.16); border-radius:13px; padding:10px; background:rgba(0,0,0,.2); }
      .dynamics-control span { display:flex; justify-content:space-between; gap:8px; font-weight:800; color:#fff4d6; font-size:.82rem; }
      .dynamics-control output { color:#75b2de; font:800 .78rem var(--font-mono); }
      .dynamics-control input[type="range"] { width:100%; }
      .dynamics-control small { min-height:2.4em; color:rgba(245,240,219,.62); line-height:1.3; }
      .dynamics-preset-list { display:grid; gap:7px; margin-bottom:12px; }
      .dynamics-preset-option { width:100%; border:1px solid rgba(224,163,96,.22); border-radius:11px; background:rgba(0,0,0,.28); color:#f5f0db; padding:9px 10px; text-align:left; font:800 .84rem var(--font-body); }
      .dynamics-preset-option:hover, .dynamics-preset-option:focus-visible { border-color:rgba(117,178,222,.7); background:rgba(117,178,222,.16); outline:none; }
      .dynamics-preset-option.active { border-color:rgba(117,216,255,.82); background:rgba(48,105,155,.36); color:#fff; }
      .dynamics-explain { border-left:3px solid rgba(117,216,255,.72); padding:10px 12px; background:rgba(117,216,255,.08); border-radius:10px; }
      .dynamics-actions { display:grid; gap:9px; margin-top:12px; }
      .dynamics-actions .tool-button { width:100%; justify-content:center; }
      @media (max-width:820px) { .dynamics-grid { grid-template-columns:1fr; } .dynamics-controls { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function controlValueLabel(key, value) {
    const meta = CONTROL_META[key];
    const number = Number(value) || 0;
    if (key === "ratio") return `${number.toFixed(number % 1 ? 1 : 0)}${meta.unit}`;
    return `${Math.round(number)}${meta.unit ? ` ${meta.unit}` : ""}`;
  }

  function createControl(key) {
    const meta = CONTROL_META[key];
    const label = document.createElement("label");
    label.className = "dynamics-control";
    const row = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = meta.label;
    const output = document.createElement("output");
    output.id = `dynamics-${key}-out`;
    row.append(name, output);
    const input = document.createElement("input");
    input.id = `dynamics-${key}`;
    input.type = "range";
    input.min = String(meta.min);
    input.max = String(meta.max);
    input.step = String(meta.step);
    const help = document.createElement("small");
    help.textContent = meta.help;
    label.append(row, input, help);
    input.addEventListener("input", () => { output.textContent = controlValueLabel(key, input.value); });
    return label;
  }

  function ensureButton() {
    const button = document.getElementById("dynamicsBtn");
    if (button) ui.dynamicsBtn = button;
    return button;
  }

  function ensureModal() {
    let backdrop = document.getElementById(MODAL_ID);
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.id = MODAL_ID;
    backdrop.className = "dynamics-backdrop";
    backdrop.innerHTML = `
      <section class="dynamics-dialog" role="dialog" aria-modal="true" aria-labelledby="dynamicsTitle">
        <div class="dynamics-head">
          <div>
            <span class="eyebrow">Clip-wide effect</span>
            <h3 id="dynamicsTitle">Dynamics / compressor</h3>
            <p>These settings apply to the selected clip as a whole. Dynamics keyframes are not enabled.</p>
            <div class="orgavox-tool-target" data-tool-target></div>
          </div>
          <button class="icon-button" id="dynamicsCloseX" type="button" aria-label="Close dynamics settings">×</button>
        </div>
        <div class="dynamics-grid">
          <div class="dynamics-panel">
            <h4>Manual controls</h4>
            <div class="dynamics-controls" id="dynamicsControlsGrid"></div>
          </div>
          <aside class="dynamics-panel">
            <h4>Preset</h4>
            <div class="dynamics-preset-list" id="dynamicsPresetList"></div>
            <p class="dynamics-explain" id="dynamicsExplain"></p>
            <div class="dynamics-actions">
              <button class="tool-button" id="dynamicsPreviewBtn" type="button">▶ Preview selected clip</button>
              <button class="tool-button" id="dynamicsResetBtn" type="button">Reset dynamics</button>
              <button class="tool-button" id="dynamicsCloseBtn" type="button">Close</button>
              <button class="tool-button primary" id="dynamicsApplyBtn" type="button">Apply dynamics</button>
            </div>
          </aside>
        </div>
      </section>`;
    document.body.appendChild(backdrop);
    const grid = backdrop.querySelector("#dynamicsControlsGrid");
    Object.keys(CONTROL_META).forEach((key) => grid.appendChild(createControl(key)));
    const list = backdrop.querySelector("#dynamicsPresetList");
    Object.entries(PRESETS).forEach(([id, preset]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dynamics-preset-option";
      button.dataset.preset = id;
      button.textContent = preset.label;
      button.addEventListener("click", () => loadSettingsIntoModal(clonePreset(id)));
      list.appendChild(button);
    });
    backdrop.querySelector("#dynamicsCloseX").addEventListener("click", closeModal);
    backdrop.querySelector("#dynamicsCloseBtn").addEventListener("click", closeModal);
    backdrop.querySelector("#dynamicsApplyBtn").addEventListener("click", applyDynamics);
    backdrop.querySelector("#dynamicsResetBtn").addEventListener("click", resetDynamics);
    backdrop.querySelector("#dynamicsPreviewBtn").addEventListener("click", previewDynamics);
    backdrop.addEventListener("pointerdown", (event) => { if (event.target === backdrop) closeModal(); });
    return backdrop;
  }

  function modalInput(key) { return document.getElementById(`dynamics-${key}`); }
  function modalOutput(key) { return document.getElementById(`dynamics-${key}-out`); }

  function loadSettingsIntoModal(settings) {
    const normalized = normalizeDynamics(settings);
    currentPresetId = normalized.preset || "leveler";
    Object.keys(CONTROL_META).forEach((key) => {
      const input = modalInput(key);
      const output = modalOutput(key);
      if (!input || !output) return;
      input.value = String(normalized[key]);
      output.textContent = controlValueLabel(key, normalized[key]);
    });
    const explain = document.getElementById("dynamicsExplain");
    if (explain) explain.textContent = normalized.explanation;
    document.querySelectorAll(".dynamics-preset-option").forEach((node) => node.classList.toggle("active", node.dataset.preset === currentPresetId));
  }

  function readSettingsFromModal() {
    const base = clonePreset(currentPresetId || "leveler");
    Object.keys(CONTROL_META).forEach((key) => {
      const input = modalInput(key);
      if (input) base[key] = clampNumber(input.value, CONTROL_META[key].min, CONTROL_META[key].max, base[key]);
    });
    return normalizeDynamics(base);
  }

  function openModal() {
    const clip = selectedClip();
    if (!clip) { showToast("Select a clip before opening Dynamics."); return; }
    const backdrop = ensureModal();
    window.orgavoxUpdateToolTarget?.(backdrop, clip, "Dynamics target");
    loadSettingsIntoModal(clip.dynamicsSettings?.enabled ? clip.dynamicsSettings : clonePreset("leveler"));
    backdrop.classList.add("open");
  }

  function closeModal() {
    document.getElementById(MODAL_ID)?.classList.remove("open");
    stopPreview();
  }

  function stopPreview() {
    if (previewSource) {
      try { previewSource.stop(); } catch {}
      previewSource = null;
    }
  }

  async function previewDynamics() {
    const clip = selectedClip();
    if (!clip || !audioContext) return;
    stopPreview();
    await audioContext.resume();
    const buffer = await processedClipBuffer(clip);
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    const previewClip = { ...clip, dynamicsSettings: readSettingsFromModal() };
    connectClipNodes(audioContext, source, previewClip, audioContext.destination, audioContext.currentTime + 0.03, 0);
    source.onended = () => { if (previewSource === source) previewSource = null; };
    previewSource = source;
    source.start(audioContext.currentTime + 0.03);
  }

  function applyDynamics() {
    const clip = selectedClip();
    if (!clip) return;
    stopPlayback();
    stopPreview();
    const settings = readSettingsFromModal();
    clip.dynamicsSettings = settings;
    invalidateClip?.(clip);
    syncSelectedControls();
    renderTimeline();
    closeModal();
    showToast(`${settings.label} applied to selected clip.`);
  }

  function resetDynamics() {
    const clip = selectedClip();
    if (!clip) return;
    stopPlayback();
    stopPreview();
    clip.dynamicsSettings = null;
    invalidateClip?.(clip);
    syncSelectedControls();
    renderTimeline();
    closeModal();
    showToast("Dynamics removed from selected clip.");
  }

  const previousRenderTimeline = renderTimeline;
  renderTimeline = function dynamicsRenderTimeline() {
    previousRenderTimeline();
    state.clips.forEach((clip) => {
      const settings = settingsForClip(clip);
      if (!settings) return;
      const element = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
      const badges = element?.querySelector(".clip-effect-badges");
      if (!badges || badges.querySelector(".dynamics-badge")) return;
      const badge = document.createElement("span");
      badge.className = "dynamics-badge";
      badge.textContent = "DYN";
      badge.title = settings.label;
      badges.appendChild(badge);
    });
  };

  const previousSyncSelectedControls = syncSelectedControls;
  function updateDynamicsButtonState() {
    const clip = selectedClip();
    const settings = settingsForClip(clip);
    const button = ensureButton();
    if (!button) return;
    button.disabled = !clip;
    button.classList.toggle("dynamics-active", Boolean(settings));
    button.title = settings ? `Dynamics: ${settings.label}` : "Open clip-wide dynamics / compressor";
  }
  syncSelectedControls = function dynamicsSyncSelectedControls() {
    previousSyncSelectedControls();
    updateDynamicsButtonState();
  };

  window.orgavoxOpenDynamics = openModal;
  window.orgavoxUpdateDynamicsButton = updateDynamicsButtonState;

  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
  installStyles();
  ensureButton();
  ensureModal();
  syncSelectedControls();
  renderTimeline();
  setStatus("Ready — dynamics active");
})();
