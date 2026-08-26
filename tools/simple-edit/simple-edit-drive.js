"use strict";

(function installOrgavoxDrive() {
  const DRIVE_VERSION = window.ORGAVOX_VERSION || "v0.29";
  const STYLE_ID = "orgavox-drive-style";
  const MODAL_ID = "driveModal";
  let previewSource = null;

  const PRESETS = {
    warm: {
      label: "Warm Saturation",
      explanation: "Soft warmth and thickness without making the clip obviously distorted.",
      drive: 24, tone: 58, mix: 42, asymmetry: 10, outputGain: 100
    },
    tube: {
      label: "Tube Drive",
      explanation: "More pushed and rounded, useful for vocals, bass, or anything that needs bite.",
      drive: 42, tone: 62, mix: 55, asymmetry: 18, outputGain: 96
    },
    tape: {
      label: "Tape Crunch",
      explanation: "Darker saturation with a worn tape feeling and softened top end.",
      drive: 38, tone: 42, mix: 58, asymmetry: 26, outputGain: 98
    },
    fuzz: {
      label: "Fuzz",
      explanation: "Heavy fuzzy distortion for aggressive effects and broken sound design.",
      drive: 76, tone: 68, mix: 72, asymmetry: 36, outputGain: 86
    },
    speaker: {
      label: "Broken Speaker",
      explanation: "Crackly, narrow, overdriven speaker character for phone, radio, or damaged audio.",
      drive: 82, tone: 34, mix: 82, asymmetry: 55, outputGain: 88
    },
    softclip: {
      label: "Soft Clip Limiter",
      explanation: "Gentle clipping to tame peaks while keeping the clip mostly clean.",
      drive: 18, tone: 72, mix: 34, asymmetry: 0, outputGain: 104
    }
  };

  const CONTROL_META = {
    drive: { label: "Drive", unit: "%", min: 0, max: 100, step: 1, help: "How hard the sound is pushed into saturation." },
    tone: { label: "Tone", unit: "%", min: 0, max: 100, step: 1, help: "Lower is darker. Higher keeps more bite and brightness." },
    mix: { label: "Wet mix", unit: "%", min: 0, max: 100, step: 1, help: "How much distorted sound is blended with the clean clip." },
    asymmetry: { label: "Asymmetry", unit: "%", min: 0, max: 100, step: 1, help: "Adds uneven tube-style colour and roughness." },
    outputGain: { label: "Output gain", unit: "%", min: 0, max: 150, step: 1, help: "Final loudness after drive/saturation." }
  };

  let currentPresetId = "warm";

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function clonePreset(id) {
    const preset = PRESETS[id] || PRESETS.warm;
    return { ...preset, preset: id, enabled: true };
  }

  function normalizeDrive(raw) {
    const base = clonePreset(raw?.preset || currentPresetId || "warm");
    const source = raw || base;
    Object.keys(CONTROL_META).forEach((key) => {
      const meta = CONTROL_META[key];
      base[key] = clampNumber(source[key], meta.min, meta.max, base[key]);
    });
    base.enabled = source.enabled !== false;
    base.label = source.label || PRESETS[base.preset]?.label || "Custom Drive";
    base.explanation = source.explanation || PRESETS[base.preset]?.explanation || "Custom clip-wide drive settings.";
    return base;
  }

  function settingsForClip(clip) {
    if (!clip?.driveSettings?.enabled) return null;
    return normalizeDrive(clip.driveSettings);
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .drive-btn.drive-active { border-color: rgba(255,190,112,.92); color:#ffe2b1; box-shadow:0 0 0 2px rgba(255,190,112,.14); }
      body.simple-edit-phase1 .clip-effect-badges span.drive-badge { border-color: rgba(255,190,112,.68); color:#ffe2b1; }
      .drive-backdrop { position:fixed; inset:0; z-index:2675; display:none; align-items:center; justify-content:center; padding:20px; background:rgba(5,7,7,.74); backdrop-filter:blur(7px); }
      .drive-backdrop.open { display:flex; }
      .drive-dialog { width:min(860px,94vw); max-height:min(740px,92vh); overflow:auto; border:1px solid rgba(224,163,96,.58); border-radius:22px; background:linear-gradient(180deg,rgba(41,38,30,.98),rgba(17,20,18,.99)); color:#f5f0db; box-shadow:0 26px 80px rgba(0,0,0,.54), inset 0 0 0 1px rgba(255,255,255,.04); padding:18px; }
      .drive-head { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; margin-bottom:14px; }
      .drive-head h3 { margin:4px 0 6px; font-family:var(--font-headers); font-size:1.35rem; letter-spacing:.04em; }
      .drive-head p, .drive-explain { margin:0; color:rgba(245,240,219,.72); line-height:1.45; }
      .drive-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(240px,300px); gap:14px; align-items:start; }
      .drive-panel { border:1px solid rgba(224,163,96,.26); border-radius:16px; background:rgba(7,9,8,.38); padding:14px; }
      .drive-panel h4 { margin:0 0 10px; font-size:.84rem; letter-spacing:.08em; text-transform:uppercase; color:#f8d792; }
      .drive-controls { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .drive-control { display:grid; gap:6px; border:1px solid rgba(224,163,96,.16); border-radius:13px; padding:10px; background:rgba(0,0,0,.2); }
      .drive-control span { display:flex; justify-content:space-between; gap:8px; font-weight:800; color:#fff4d6; font-size:.82rem; }
      .drive-control output { color:#75b2de; font:800 .78rem var(--font-mono); }
      .drive-control input[type="range"] { width:100%; }
      .drive-control small { min-height:2.4em; color:rgba(245,240,219,.62); line-height:1.3; }
      .drive-preset-list { display:grid; gap:7px; margin-bottom:12px; }
      .drive-preset-option { width:100%; border:1px solid rgba(224,163,96,.22); border-radius:11px; background:rgba(0,0,0,.28); color:#f5f0db; padding:9px 10px; text-align:left; font:800 .84rem var(--font-body); }
      .drive-preset-option:hover, .drive-preset-option:focus-visible { border-color:rgba(117,178,222,.7); background:rgba(117,178,222,.16); outline:none; }
      .drive-preset-option.active { border-color:rgba(255,190,112,.82); background:rgba(169,92,38,.36); color:#fff; }
      .drive-explain { border-left:3px solid rgba(255,190,112,.72); padding:10px 12px; background:rgba(255,190,112,.08); border-radius:10px; }
      .drive-actions { display:grid; gap:9px; margin-top:12px; }
      .drive-actions .tool-button { width:100%; justify-content:center; }
      @media (max-width:820px) { .drive-grid { grid-template-columns:1fr; } .drive-controls { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function controlValueLabel(key, value) {
    const meta = CONTROL_META[key];
    const number = Math.round(Number(value) || 0);
    return `${number}${meta.unit ? ` ${meta.unit}` : ""}`;
  }

  function createControl(key) {
    const meta = CONTROL_META[key];
    const label = document.createElement("label");
    label.className = "drive-control";
    const row = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = meta.label;
    const output = document.createElement("output");
    output.id = `drive-${key}-out`;
    row.append(name, output);

    const input = document.createElement("input");
    input.id = `drive-${key}`;
    input.type = "range";
    input.min = String(meta.min);
    input.max = String(meta.max);
    input.step = String(meta.step);

    const help = document.createElement("small");
    help.textContent = meta.help;
    label.append(row, input, help);

    input.addEventListener("input", () => {
      output.textContent = controlValueLabel(key, input.value);
      updateExplanation();
    });

    return label;
  }

  function ensureButton() {
    const button = document.getElementById("driveBtn");
    if (button) ui.driveBtn = button;
    return button;
  }

  function ensureModal() {
    let backdrop = document.getElementById(MODAL_ID);
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.id = MODAL_ID;
    backdrop.className = "drive-backdrop";
    backdrop.innerHTML = `
      <section class="drive-dialog" role="dialog" aria-modal="true" aria-labelledby="driveTitle">
        <div class="drive-head">
          <div>
            <span class="eyebrow">Clip-wide effect</span>
            <h3 id="driveTitle">Drive / saturation</h3>
            <p>These settings apply to the selected clip as a whole. Drive keyframes are not enabled.</p>
            <div class="orgavox-tool-target" data-tool-target></div>
          </div>
          <button class="icon-button" id="driveCloseX" type="button" aria-label="Close drive settings">×</button>
        </div>
        <div class="drive-grid">
          <div class="drive-panel">
            <h4>Manual controls</h4>
            <div class="drive-controls" id="driveControlsGrid"></div>
          </div>
          <aside class="drive-panel">
            <h4>Presets</h4>
            <div class="drive-preset-list" id="drivePresetList"></div>
            <p class="drive-explain" id="driveExplain"></p>
            <div class="drive-actions">
              <button class="tool-button" id="drivePreviewBtn" type="button">▶ Preview selected clip</button>
              <button class="tool-button" id="driveResetBtn" type="button">Reset drive</button>
              <button class="tool-button" id="driveCloseBtn" type="button">Close</button>
              <button class="tool-button primary" id="driveApplyBtn" type="button">Apply drive</button>
            </div>
          </aside>
        </div>
      </section>`;
    document.body.appendChild(backdrop);

    const grid = backdrop.querySelector("#driveControlsGrid");
    Object.keys(CONTROL_META).forEach((key) => grid.appendChild(createControl(key)));

    const presets = backdrop.querySelector("#drivePresetList");
    Object.entries(PRESETS).forEach(([id, preset]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "drive-preset-option";
      button.dataset.preset = id;
      button.textContent = preset.label;
      button.addEventListener("click", () => loadSettingsIntoModal(clonePreset(id)));
      presets.appendChild(button);
    });

    backdrop.querySelector("#driveCloseX").addEventListener("click", closeModal);
    backdrop.querySelector("#driveCloseBtn").addEventListener("click", closeModal);
    backdrop.querySelector("#driveApplyBtn").addEventListener("click", applyDriveSettings);
    backdrop.querySelector("#driveResetBtn").addEventListener("click", resetDriveSettings);
    backdrop.querySelector("#drivePreviewBtn").addEventListener("click", previewDriveSettings);
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) closeModal();
    });
    return backdrop;
  }

  function modalInput(key) { return document.getElementById(`drive-${key}`); }
  function modalOutput(key) { return document.getElementById(`drive-${key}-out`); }

  function readSettingsFromModal() {
    const base = clonePreset(currentPresetId);
    Object.keys(CONTROL_META).forEach((key) => {
      const input = modalInput(key);
      if (input) base[key] = clampNumber(input.value, CONTROL_META[key].min, CONTROL_META[key].max, base[key]);
    });
    return normalizeDrive(base);
  }

  function updateExplanation() {
    const settings = readSettingsFromModal();
    const explain = document.getElementById("driveExplain");
    if (explain) explain.textContent = settings.explanation;
    document.querySelectorAll(".drive-preset-option").forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === settings.preset);
    });
  }

  function loadSettingsIntoModal(settings) {
    const normalized = normalizeDrive(settings);
    currentPresetId = normalized.preset || "warm";
    Object.keys(CONTROL_META).forEach((key) => {
      const input = modalInput(key);
      const output = modalOutput(key);
      if (!input || !output) return;
      input.value = String(normalized[key]);
      output.textContent = controlValueLabel(key, normalized[key]);
    });
    updateExplanation();
  }

  function openModal() {
    const clip = selectedClip();
    if (!clip) {
      showToast("Select a clip before opening Drive.");
      return;
    }
    const backdrop = ensureModal();
    window.orgavoxUpdateToolTarget?.(backdrop, clip, "Drive target");
    loadSettingsIntoModal(settingsForClip(clip) || clonePreset("warm"));
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

  async function previewDriveSettings() {
    const clip = selectedClip();
    if (!clip || !audioContext) return;
    stopPreview();
    await audioContext.resume();
    const buffer = await processedClipBuffer(clip);
    if (!buffer) return;
    const settings = readSettingsFromModal();
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    const previewClip = { ...clip, driveSettings: settings };
    connectClipNodes(audioContext, source, previewClip, audioContext.destination, audioContext.currentTime + 0.03, 0);
    source.onended = () => { if (previewSource === source) previewSource = null; };
    previewSource = source;
    source.start(audioContext.currentTime + 0.03);
  }

  function applyDriveSettings() {
    const clip = selectedClip();
    if (!clip) return;
    stopPlayback();
    stopPreview();
    const settings = readSettingsFromModal();
    clip.driveSettings = settings;
    invalidateClip?.(clip);
    syncSelectedControls();
    renderTimeline();
    closeModal();
    showToast(`${settings.label} applied to selected clip.`);
  }

  function resetDriveSettings() {
    const clip = selectedClip();
    if (!clip) return;
    stopPlayback();
    stopPreview();
    clip.driveSettings = null;
    invalidateClip?.(clip);
    syncSelectedControls();
    renderTimeline();
    closeModal();
    showToast("Drive removed from selected clip.");
  }

  const previousRenderTimeline = renderTimeline;
  renderTimeline = function driveRenderTimeline() {
    previousRenderTimeline();
    state.clips.forEach((clip) => {
      const settings = settingsForClip(clip);
      if (!settings) return;
      const element = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
      const badges = element?.querySelector(".clip-effect-badges");
      if (!badges || badges.querySelector(".drive-badge")) return;
      const badge = document.createElement("span");
      badge.className = "drive-badge";
      badge.textContent = "DRIVE";
      badge.title = settings.label;
      badges.appendChild(badge);
    });
  };

  const previousSyncSelectedControls = syncSelectedControls;
  function updateDriveButtonState() {
    const clip = selectedClip();
    const settings = settingsForClip(clip);
    const button = ensureButton();
    if (!button) return;
    button.disabled = !clip;
    button.classList.toggle("drive-active", Boolean(settings));
    button.title = settings ? `Drive: ${settings.label}` : "Open clip-wide drive/saturation";
  }
  syncSelectedControls = function driveSyncSelectedControls() {
    previousSyncSelectedControls();
    updateDriveButtonState();
  };

  window.orgavoxOpenDrive = openModal;
  window.orgavoxUpdateDriveButton = updateDriveButtonState;

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  installStyles();
  ensureButton();
  ensureModal();
  syncSelectedControls();
  renderTimeline();
  setStatus("Ready — drive/saturation active");
})();
