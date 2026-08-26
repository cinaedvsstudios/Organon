"use strict";

(function installOrgavoxEqFilter() {
  const EQ_VERSION = window.ORGAVOX_VERSION || "v0.28";
  const STYLE_ID = "orgavox-eq-style";
  const MODAL_ID = "eqModal";
  let previewSource = null;

  const PRESETS = {
    flat: {
      label: "Clean / Flat",
      explanation: "Neutral EQ. Useful when you only want to adjust output gain or start from zero.",
      lowCut: 20, lowGain: 0, midFreq: 1000, midGain: 0, highGain: 0, highCut: 20000, outputGain: 100
    },
    voice: {
      label: "Voice Clear",
      explanation: "Cuts rumble, adds a little presence, and keeps speech easier to hear.",
      lowCut: 90, lowGain: -2, midFreq: 2200, midGain: 3, highGain: 2, highCut: 12000, outputGain: 100
    },
    warm: {
      label: "Warm Bass",
      explanation: "Adds weight and warmth while slightly softening the very top end.",
      lowCut: 35, lowGain: 4, midFreq: 650, midGain: -1, highGain: -2, highCut: 9000, outputGain: 96
    },
    bright: {
      label: "Brighten",
      explanation: "Adds clarity and sparkle without changing the timing of the clip.",
      lowCut: 60, lowGain: -1, midFreq: 1800, midGain: 2, highGain: 5, highCut: 16000, outputGain: 98
    },
    phone: {
      label: "Phone / Radio",
      explanation: "Narrows the sound into a thin telephone or radio-style band.",
      lowCut: 320, lowGain: -8, midFreq: 1400, midGain: 4, highGain: -6, highCut: 3600, outputGain: 105
    },
    muffled: {
      label: "Muffled",
      explanation: "Darkens the sound by removing highs and adding a little low-mid body.",
      lowCut: 35, lowGain: 2, midFreq: 500, midGain: 2, highGain: -8, highCut: 2600, outputGain: 105
    }
  };

  const CONTROL_META = {
    lowCut: { label: "Low cut", unit: "Hz", min: 20, max: 1000, step: 5, help: "Removes low rumble before the useful sound." },
    lowGain: { label: "Low gain", unit: "dB", min: -18, max: 18, step: 1, help: "Boosts or cuts bass around the low end." },
    midFreq: { label: "Mid frequency", unit: "Hz", min: 200, max: 6000, step: 25, help: "Chooses the middle frequency that the mid gain affects." },
    midGain: { label: "Mid gain", unit: "dB", min: -18, max: 18, step: 1, help: "Boosts or cuts the main body or presence of the sound." },
    highGain: { label: "High gain", unit: "dB", min: -18, max: 18, step: 1, help: "Boosts or cuts brightness and air." },
    highCut: { label: "High cut", unit: "Hz", min: 1200, max: 20000, step: 100, help: "Removes harsh or unwanted high frequencies." },
    outputGain: { label: "Output gain", unit: "%", min: 0, max: 150, step: 1, help: "Final loudness after the EQ/filter." }
  };

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function clonePreset(id) {
    const preset = PRESETS[id] || PRESETS.flat;
    return { ...preset, preset: id, enabled: true };
  }

  function normalizeEq(raw) {
    const base = clonePreset(raw?.preset || "flat");
    const source = raw || base;
    Object.keys(CONTROL_META).forEach((key) => {
      const meta = CONTROL_META[key];
      base[key] = clampNumber(source[key], meta.min, meta.max, base[key]);
    });
    base.enabled = source.enabled !== false;
    base.label = source.label || PRESETS[base.preset]?.label || "Custom EQ";
    base.explanation = source.explanation || PRESETS[base.preset]?.explanation || "Custom clip-wide EQ settings.";
    return base;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .eq-btn.eq-active { border-color: rgba(117,178,222,.9); color:#dff5ff; box-shadow:0 0 0 2px rgba(117,178,222,.16); }
      body.simple-edit-phase1 .clip-effect-badges span.eq-badge { border-color: rgba(117,178,222,.62); color:#cbefff; }
      .eq-backdrop { position:fixed; inset:0; z-index:2670; display:none; align-items:center; justify-content:center; padding:20px; background:rgba(5,7,7,.74); backdrop-filter:blur(7px); }
      .eq-backdrop.open { display:flex; }
      .eq-dialog { width:min(900px,94vw); max-height:min(760px,92vh); overflow:auto; border:1px solid rgba(224,163,96,.58); border-radius:22px; background:linear-gradient(180deg,rgba(41,38,30,.98),rgba(17,20,18,.99)); color:#f5f0db; box-shadow:0 26px 80px rgba(0,0,0,.54), inset 0 0 0 1px rgba(255,255,255,.04); padding:18px; }
      .eq-head { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; margin-bottom:14px; }
      .eq-head h3 { margin:4px 0 6px; font-family:var(--font-headers); font-size:1.35rem; letter-spacing:.04em; }
      .eq-head p { margin:0; color:rgba(245,240,219,.72); line-height:1.45; }
      .eq-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(240px,300px); gap:14px; align-items:start; }
      .eq-panel { border:1px solid rgba(224,163,96,.26); border-radius:16px; background:rgba(7,9,8,.38); padding:14px; }
      .eq-panel h4 { margin:0 0 10px; font-size:.84rem; letter-spacing:.08em; text-transform:uppercase; color:#f8d792; }
      .eq-controls { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .eq-control { display:grid; gap:7px; border:1px solid rgba(224,163,96,.16); border-radius:13px; padding:10px; background:rgba(0,0,0,.2); }
      .eq-control span { display:flex; justify-content:space-between; gap:8px; font-weight:800; color:#fff4d6; font-size:.82rem; }
      .eq-control output { color:#75b2de; font:800 .78rem var(--font-mono); }
      .eq-control input[type="range"] { width:100%; }
      .eq-control small { min-height:2.4em; color:rgba(245,240,219,.62); line-height:1.3; }
      .eq-preset-list { display:grid; gap:8px; }
      .eq-preset-option { width:100%; min-height:34px; border:1px solid rgba(224,163,96,.22); border-radius:10px; background:rgba(0,0,0,.28); color:#f5f0db; padding:8px 10px; text-align:left; font:800 .82rem var(--font-body); }
      .eq-preset-option:hover, .eq-preset-option:focus-visible { background:rgba(117,178,222,.18); color:#fff; outline:none; }
      .eq-preset-option.active { border-color:rgba(117,178,222,.74); background:rgba(75,132,191,.42); color:#fff; }
      .eq-explain { margin:12px 0 0; border-left:3px solid rgba(117,178,222,.7); padding:10px 12px; background:rgba(117,178,222,.08); border-radius:10px; color:rgba(245,240,219,.72); line-height:1.45; }
      .eq-actions { display:grid; gap:9px; margin-top:12px; }
      .eq-actions .tool-button { width:100%; justify-content:center; }
      @media (max-width:820px) { .eq-grid { grid-template-columns:1fr; } .eq-controls { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function valueLabel(key, value) {
    const meta = CONTROL_META[key];
    const number = Number(value) || 0;
    if (meta.unit === "dB") return `${number > 0 ? "+" : ""}${Math.round(number)} dB`;
    if (meta.unit === "%") return `${Math.round(number)}%`;
    return `${Math.round(number)} Hz`;
  }

  function createControl(key) {
    const meta = CONTROL_META[key];
    const label = document.createElement("label");
    label.className = "eq-control";
    const row = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = meta.label;
    const output = document.createElement("output");
    output.id = `eq-${key}-out`;
    row.append(name, output);
    const input = document.createElement("input");
    input.id = `eq-${key}`;
    input.type = "range";
    input.min = String(meta.min);
    input.max = String(meta.max);
    input.step = String(meta.step);
    input.addEventListener("input", () => {
      output.textContent = valueLabel(key, input.value);
      markPresetAsCustom();
    });
    const help = document.createElement("small");
    help.textContent = meta.help;
    label.append(row, input, help);
    return label;
  }

  function ensureButton() {
    const button = document.getElementById("eqBtn");
    if (button) ui.eqBtn = button;
    return button;
  }

  function ensureModal() {
    let backdrop = document.getElementById(MODAL_ID);
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.id = MODAL_ID;
    backdrop.className = "eq-backdrop";
    backdrop.innerHTML = `
      <section class="eq-dialog" role="dialog" aria-modal="true" aria-labelledby="eqTitle">
        <div class="eq-head">
          <div>
            <span class="eyebrow">Clip-wide effect</span>
            <h3 id="eqTitle">EQ / filter</h3>
            <p>These settings apply to the selected clip as a whole. EQ keyframes are not enabled.</p>
          </div>
          <button class="icon-button" id="eqCloseX" type="button" aria-label="Close EQ settings">×</button>
        </div>
        <div class="eq-grid">
          <div class="eq-panel">
            <h4>Manual controls</h4>
            <div class="eq-controls" id="eqControls"></div>
          </div>
          <aside class="eq-panel">
            <h4>Presets</h4>
            <div class="eq-preset-list" id="eqPresetList"></div>
            <p class="eq-explain" id="eqExplain"></p>
            <div class="eq-actions">
              <button class="tool-button" id="eqPreviewBtn" type="button">▶ Preview selected clip</button>
              <button class="tool-button" id="eqResetBtn" type="button">Reset EQ</button>
              <button class="tool-button" id="eqCloseBtn" type="button">Close</button>
              <button class="tool-button primary" id="eqApplyBtn" type="button">Apply EQ</button>
            </div>
          </aside>
        </div>
      </section>`;
    document.body.appendChild(backdrop);

    const controls = backdrop.querySelector("#eqControls");
    Object.keys(CONTROL_META).forEach((key) => controls.appendChild(createControl(key)));
    const presetList = backdrop.querySelector("#eqPresetList");
    Object.entries(PRESETS).forEach(([id, preset]) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "eq-preset-option";
      option.dataset.preset = id;
      option.textContent = preset.label;
      option.addEventListener("click", () => loadSettings(clonePreset(id)));
      presetList.appendChild(option);
    });

    backdrop.querySelector("#eqCloseX").addEventListener("click", closeModal);
    backdrop.querySelector("#eqCloseBtn").addEventListener("click", closeModal);
    backdrop.querySelector("#eqApplyBtn").addEventListener("click", applyEq);
    backdrop.querySelector("#eqResetBtn").addEventListener("click", resetEq);
    backdrop.querySelector("#eqPreviewBtn").addEventListener("click", previewEq);
    backdrop.addEventListener("pointerdown", (event) => { if (event.target === backdrop) closeModal(); });
    return backdrop;
  }

  function inputFor(key) { return document.getElementById(`eq-${key}`); }
  function outputFor(key) { return document.getElementById(`eq-${key}-out`); }

  function readSettings() {
    const active = document.querySelector(".eq-preset-option.active")?.dataset.preset || "flat";
    const base = clonePreset(active);
    Object.keys(CONTROL_META).forEach((key) => {
      const meta = CONTROL_META[key];
      const input = inputFor(key);
      if (input) base[key] = clampNumber(input.value, meta.min, meta.max, base[key]);
    });
    return normalizeEq(base);
  }

  function markPresetAsCustom() {
    document.querySelectorAll(".eq-preset-option").forEach((option) => option.classList.remove("active"));
    const explain = document.getElementById("eqExplain");
    if (explain) explain.textContent = "Custom clip-wide EQ settings.";
  }

  function loadSettings(settings) {
    const normalized = normalizeEq(settings);
    Object.keys(CONTROL_META).forEach((key) => {
      const input = inputFor(key);
      const output = outputFor(key);
      if (!input || !output) return;
      input.value = String(normalized[key]);
      output.textContent = valueLabel(key, normalized[key]);
    });
    document.querySelectorAll(".eq-preset-option").forEach((option) => {
      option.classList.toggle("active", option.dataset.preset === normalized.preset);
    });
    const explain = document.getElementById("eqExplain");
    if (explain) explain.textContent = normalized.explanation;
  }

  function openModal() {
    const clip = selectedClip();
    if (!clip) {
      showToast("Select a clip before opening EQ / Filter.");
      return;
    }
    const backdrop = ensureModal();
    loadSettings(clip.eqSettings?.enabled ? clip.eqSettings : clonePreset("flat"));
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

  async function previewEq() {
    const clip = selectedClip();
    if (!clip || !audioContext) return;
    stopPreview();
    await audioContext.resume();
    const buffer = await processedClipBuffer(clip);
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    const previewClip = { ...clip, eqSettings: readSettings() };
    connectClipNodes(audioContext, source, previewClip, audioContext.destination, audioContext.currentTime + 0.03, 0);
    source.onended = () => { if (previewSource === source) previewSource = null; };
    previewSource = source;
    source.start(audioContext.currentTime + 0.03);
  }

  function applyEq() {
    const clip = selectedClip();
    if (!clip) return;
    stopPlayback();
    stopPreview();
    const settings = readSettings();
    clip.eqSettings = settings;
    invalidateClip?.(clip);
    syncSelectedControls();
    renderTimeline();
    closeModal();
    showToast(`${settings.label} applied to selected clip.`);
  }

  function resetEq() {
    const clip = selectedClip();
    if (!clip) return;
    stopPlayback();
    stopPreview();
    clip.eqSettings = null;
    invalidateClip?.(clip);
    syncSelectedControls();
    renderTimeline();
    closeModal();
    showToast("EQ removed from selected clip.");
  }

  const previousRenderTimeline = renderTimeline;
  renderTimeline = function orgavoxEqRenderTimeline() {
    previousRenderTimeline();
    state.clips.forEach((clip) => {
      if (!clip.eqSettings?.enabled) return;
      const element = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
      const badges = element?.querySelector(".clip-effect-badges");
      if (!badges || badges.querySelector(".eq-badge")) return;
      const badge = document.createElement("span");
      badge.className = "eq-badge";
      badge.textContent = "EQ";
      badge.title = clip.eqSettings.label || "Clip-wide EQ / filter active.";
      badges.appendChild(badge);
    });
  };

  const previousSyncSelectedControls = syncSelectedControls;
  function updateEqButtonState() {
    const clip = selectedClip();
    const button = ensureButton();
    if (!button) return;
    button.disabled = !clip;
    button.classList.toggle("eq-active", Boolean(clip?.eqSettings?.enabled));
    button.title = clip?.eqSettings?.enabled ? `EQ / Filter: ${clip.eqSettings.label || "Custom EQ"}` : "Open clip-wide EQ / Filter";
  }
  syncSelectedControls = function orgavoxEqSyncSelectedControls() {
    previousSyncSelectedControls();
    updateEqButtonState();
  };

  window.orgavoxOpenEq = openModal;
  window.orgavoxUpdateEqButton = updateEqButtonState;

  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });

  installStyles();
  ensureButton();
  ensureModal();
  syncSelectedControls();
  renderTimeline();
  setStatus("Ready — EQ / Filter active");
})();
