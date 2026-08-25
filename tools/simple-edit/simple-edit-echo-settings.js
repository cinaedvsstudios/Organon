"use strict";

(function installSimpleEditEchoSettings() {
  const ECHO_VERSION = window.ORGAVOX_VERSION || "v0.25";
  const STYLE_ID = "simple-edit-echo-settings-style";
  const MODAL_ID = "echoSettingsModal";

  const PRESETS = {
    studio: {
      label: "Studio Echo",
      mode: "delay",
      explanation: "A clean controlled echo that adds a little depth without taking over the track.",
      tooltip: "Clean subtle echo for adding depth without making the audio messy.",
      delayTime: 220, feedback: 18, wet: 24, dry: 100, lowCut: 80, highCut: 6500, stereoWidth: 20, outputGain: 100, tapCount: 1, tapSpacing: 120,
      roomSize: 40, decay: 1.6, preDelay: 20, damping: 45
    },
    slapback: {
      label: "Slapback Echo",
      mode: "delay",
      explanation: "A single very fast echo. It thickens voices or guitars without sounding like a cave.",
      tooltip: "A quick single echo that thickens the sound without making it feel far away.",
      delayTime: 95, feedback: 6, wet: 22, dry: 100, lowCut: 90, highCut: 7200, stereoWidth: 10, outputGain: 100, tapCount: 1, tapSpacing: 90,
      roomSize: 20, decay: 0.9, preDelay: 5, damping: 35
    },
    digital: {
      label: "Digital Delay",
      mode: "delay",
      explanation: "A clear modern echo. The repeats stay bright and easy to hear.",
      tooltip: "Clean repeating echo with bright digital repeats.",
      delayTime: 320, feedback: 34, wet: 35, dry: 100, lowCut: 60, highCut: 9500, stereoWidth: 25, outputGain: 100, tapCount: 1, tapSpacing: 140,
      roomSize: 40, decay: 1.8, preDelay: 25, damping: 25
    },
    tape: {
      label: "Tape Delay",
      mode: "delay",
      explanation: "A warmer old-style echo. The repeats get softer and darker like worn tape.",
      tooltip: "Old-style echo where each repeat gets darker and warmer.",
      delayTime: 380, feedback: 42, wet: 36, dry: 100, lowCut: 130, highCut: 3600, stereoWidth: 22, outputGain: 100, tapCount: 1, tapSpacing: 160,
      roomSize: 40, decay: 2.0, preDelay: 25, damping: 70
    },
    pingpong: {
      label: "Ping Pong Echo",
      mode: "delay",
      explanation: "The echo bounces left and right between the speakers, making the sound feel wider.",
      tooltip: "Echo that bounces between left and right speakers.",
      delayTime: 260, feedback: 38, wet: 36, dry: 100, lowCut: 80, highCut: 8000, stereoWidth: 100, outputGain: 100, tapCount: 1, tapSpacing: 140,
      roomSize: 45, decay: 1.9, preDelay: 20, damping: 35
    },
    multitap: {
      label: "Multitap Delay",
      mode: "delay",
      explanation: "Several separate echoes happen at different times, which can make rhythmic repeat patterns.",
      tooltip: "Several echoes placed at different times for rhythmic patterns.",
      delayTime: 180, feedback: 18, wet: 38, dry: 100, lowCut: 90, highCut: 7000, stereoWidth: 60, outputGain: 100, tapCount: 4, tapSpacing: 155,
      roomSize: 50, decay: 2.0, preDelay: 20, damping: 45
    },
    hall: {
      label: "Large Hall",
      mode: "reverb",
      explanation: "Makes the sound feel like it is happening in a big performance hall.",
      tooltip: "Adds a big hall sound, like a large performance space.",
      delayTime: 280, feedback: 14, wet: 38, dry: 100, lowCut: 80, highCut: 6200, stereoWidth: 55, outputGain: 100, tapCount: 1, tapSpacing: 140,
      roomSize: 78, decay: 3.8, preDelay: 60, damping: 55
    },
    church: {
      label: "Church Echo",
      mode: "reverb",
      explanation: "Huge long reverb, like sound bouncing around stone walls.",
      tooltip: "Makes the sound feel huge and sacred, like a stone church.",
      delayTime: 340, feedback: 22, wet: 45, dry: 100, lowCut: 70, highCut: 5200, stereoWidth: 70, outputGain: 100, tapCount: 1, tapSpacing: 160,
      roomSize: 92, decay: 5.4, preDelay: 80, damping: 70
    },
    cavern: {
      label: "Cavern Echo",
      mode: "reverb",
      explanation: "Dark booming echo, like sound bouncing inside a cave.",
      tooltip: "Dark cave-like echo with deep spooky reflections.",
      delayTime: 420, feedback: 28, wet: 48, dry: 100, lowCut: 45, highCut: 3200, stereoWidth: 82, outputGain: 100, tapCount: 1, tapSpacing: 180,
      roomSize: 100, decay: 4.8, preDelay: 120, damping: 82
    }
  };

  const CONTROL_META = {
    delayTime: { label: "Delay time", unit: "ms", min: 40, max: 1200, step: 5, help: "How long before the echo repeats." },
    feedback: { label: "Feedback", unit: "%", min: 0, max: 85, step: 1, help: "How much echo feeds back into itself. Higher means more repeats." },
    wet: { label: "Wet amount", unit: "%", min: 0, max: 100, step: 1, help: "How loud the echo/reverb part is." },
    dry: { label: "Dry amount", unit: "%", min: 0, max: 120, step: 1, help: "How loud the original unchanged sound is." },
    lowCut: { label: "Low cut", unit: "Hz", min: 20, max: 1000, step: 5, help: "Removes low rumble from the echo." },
    highCut: { label: "High cut", unit: "Hz", min: 800, max: 12000, step: 50, help: "Makes the echo darker by removing high fizz." },
    stereoWidth: { label: "Stereo width", unit: "%", min: 0, max: 100, step: 1, help: "How wide the echo feels between the speakers." },
    tapCount: { label: "Tap count", unit: "", min: 1, max: 6, step: 1, help: "How many separate echoes are created for multitap delay." },
    tapSpacing: { label: "Tap spacing", unit: "ms", min: 60, max: 400, step: 5, help: "The gap between separate multitap echoes." },
    roomSize: { label: "Room size", unit: "%", min: 0, max: 100, step: 1, help: "How big the fake room feels." },
    decay: { label: "Decay", unit: "s", min: 0.2, max: 8, step: 0.1, help: "How long the reverb tail rings out." },
    preDelay: { label: "Pre-delay", unit: "ms", min: 0, max: 250, step: 5, help: "A short pause before the reverb starts." },
    damping: { label: "Damping", unit: "%", min: 0, max: 100, step: 1, help: "How quickly high sounds fade from the reverb." },
    outputGain: { label: "Output gain", unit: "%", min: 0, max: 150, step: 1, help: "Final loudness after the echo effect." }
  };

  const DELAY_CONTROLS = ["delayTime", "feedback", "wet", "dry", "lowCut", "highCut", "stereoWidth", "tapCount", "tapSpacing", "outputGain"];
  const REVERB_CONTROLS = ["roomSize", "decay", "preDelay", "damping", "wet", "dry", "lowCut", "highCut", "stereoWidth", "outputGain"];
  let currentPresetId = "studio";
  let previewSource = null;
  const impulseCache = new WeakMap();

  function clonePreset(id) {
    const preset = PRESETS[id] || PRESETS.studio;
    return { ...preset, preset: id, enabled: true };
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function normalizeSettings(raw) {
    const base = clonePreset(raw?.preset || currentPresetId || "studio");
    const source = raw || base;
    Object.keys(CONTROL_META).forEach((key) => {
      const meta = CONTROL_META[key];
      base[key] = clampNumber(source[key], meta.min, meta.max, base[key]);
    });
    base.mode = source.mode === "reverb" ? "reverb" : "delay";
    base.label = source.label || PRESETS[base.preset]?.label || base.label;
    base.explanation = source.explanation || PRESETS[base.preset]?.explanation || base.explanation;
    base.tooltip = source.tooltip || PRESETS[base.preset]?.tooltip || base.tooltip;
    base.enabled = source.enabled !== false;
    return base;
  }

  function settingsForClip(clip) {
    if (!clip) return null;
    if (clip.echoSettings?.enabled) return normalizeSettings(clip.echoSettings);
    if (Number(clip.echo) > 0) {
      const settings = clonePreset("studio");
      settings.wet = clampNumber(clip.echo, 0, 100, settings.wet);
      settings.enabled = true;
      return settings;
    }
    return null;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .echo-settings-btn.echo-settings-active { border-color: rgba(117,178,222,.9); color: #dff5ff; box-shadow: 0 0 0 2px rgba(117,178,222,.16); }
      body.simple-edit-phase1 .clip-effect-badges span.echo-settings-badge { border-color: rgba(117,178,222,.62); color: #cbefff; }
      .echo-settings-backdrop { position: fixed; inset: 0; z-index: 2700; display: none; align-items: center; justify-content: center; padding: 20px; background: rgba(5, 7, 7, .74); backdrop-filter: blur(7px); }
      .echo-settings-backdrop.open { display: flex; }
      .echo-settings-dialog { width: min(980px, 96vw); max-height: min(780px, 92vh); overflow: auto; border: 1px solid rgba(224,163,96,.58); border-radius: 22px; background: linear-gradient(180deg, rgba(41,38,30,.98), rgba(17,20,18,.99)); color: #f5f0db; box-shadow: 0 26px 80px rgba(0,0,0,.54), inset 0 0 0 1px rgba(255,255,255,.04); padding: 18px; }
      .echo-settings-head { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 14px; }
      .echo-settings-head h3 { margin: 4px 0 6px; font-family: var(--font-headers); font-size: 1.35rem; letter-spacing: .04em; }
      .echo-settings-head p, .echo-settings-explain { margin: 0; color: rgba(245,240,219,.72); line-height: 1.45; }
      .echo-settings-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(250px, 295px); gap: 14px; align-items: start; }
      .echo-settings-panel { border: 1px solid rgba(224,163,96,.26); border-radius: 16px; background: rgba(7,9,8,.38); padding: 14px; }
      .echo-settings-panel h4 { margin: 0 0 10px; font-size: .84rem; letter-spacing: .08em; text-transform: uppercase; color: #f8d792; }
      .echo-settings-manual-panel { min-width: 0; }
      .echo-settings-side-panel { position: sticky; top: 0; display: grid; gap: 12px; }
      .echo-preset-picker { position: relative; }
      .echo-preset-button { width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid rgba(117,178,222,.62); border-radius: 12px; background: rgba(0,0,0,.56); color: #f5f0db; padding: 10px 12px; font: 800 .9rem var(--font-body); text-align: left; }
      .echo-preset-button::after { content: "▾"; color: #f8d792; font-size: .9rem; }
      .echo-preset-menu { position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 5; display: none; overflow: hidden; border: 1px solid rgba(117,178,222,.55); border-radius: 12px; background: #080a09; box-shadow: 0 18px 34px rgba(0,0,0,.62); }
      .echo-preset-picker.open .echo-preset-menu { display: grid; }
      .echo-preset-option { width: 100%; min-height: 34px; border: 0; border-radius: 0; background: transparent; color: #f5f0db; padding: 8px 12px; text-align: left; font: 700 .84rem var(--font-body); }
      .echo-preset-option:hover, .echo-preset-option:focus-visible { background: rgba(117,178,222,.22); color: #fff; outline: none; }
      .echo-preset-option.active { background: rgba(75,132,191,.78); color: #fff; }
      .echo-settings-explain { border-left: 3px solid rgba(117,178,222,.7); padding: 10px 12px; background: rgba(117,178,222,.08); border-radius: 10px; }
      .echo-settings-mode { display: inline-flex; width: fit-content; border: 1px solid rgba(224,163,96,.28); border-radius: 999px; padding: 5px 9px; color: rgba(245,240,219,.7); font: 800 .7rem var(--font-mono); text-transform: uppercase; letter-spacing: .08em; }
      .echo-settings-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .echo-settings-control { display: grid; gap: 6px; border: 1px solid rgba(224,163,96,.16); border-radius: 13px; padding: 10px; background: rgba(0,0,0,.2); }
      .echo-settings-control.hidden { display: none; }
      .echo-settings-control span { display: flex; justify-content: space-between; gap: 8px; font-weight: 800; color: #fff4d6; font-size: .82rem; }
      .echo-settings-control output { color: #75b2de; font: 800 .78rem var(--font-mono); }
      .echo-settings-control input[type="range"] { width: 100%; }
      .echo-settings-control small { min-height: 2.4em; color: rgba(245,240,219,.62); line-height: 1.3; }
      .echo-settings-actions { display: grid; gap: 9px; margin-top: 2px; }
      .echo-settings-actions .tool-button { width: 100%; justify-content: center; }
      @media (max-width: 820px) { .echo-settings-grid { grid-template-columns: 1fr; } .echo-settings-side-panel { position: static; order: -1; } .echo-settings-controls { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  function controlValueLabel(key, value) {
    const meta = CONTROL_META[key];
    const number = Number(value) || 0;
    if (key === "decay") return `${number.toFixed(1)} ${meta.unit}`;
    return `${Math.round(number)}${meta.unit ? ` ${meta.unit}` : ""}`;
  }

  function createControl(key) {
    const meta = CONTROL_META[key];
    const label = document.createElement("label");
    label.className = "echo-settings-control";
    label.dataset.echoControl = key;
    const row = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = meta.label;
    const output = document.createElement("output");
    output.id = `echo-${key}-out`;
    row.append(name, output);
    const input = document.createElement("input");
    input.id = `echo-${key}`;
    input.type = "range";
    input.min = String(meta.min);
    input.max = String(meta.max);
    input.step = String(meta.step);
    const help = document.createElement("small");
    help.textContent = meta.help;
    label.append(row, input, help);
    input.addEventListener("input", () => {
      output.textContent = controlValueLabel(key, input.value);
      updateExplanationFromControls();
    });
    return label;
  }

  function closePresetMenu() {
    document.getElementById("echoPresetPicker")?.classList.remove("open");
  }

  function choosePreset(id) {
    currentPresetId = id || "studio";
    loadSettingsIntoModal(clonePreset(currentPresetId));
    closePresetMenu();
  }

  function renderPresetPicker(container) {
    container.innerHTML = `
      <button class="echo-preset-button" id="echoPresetButton" type="button" aria-haspopup="listbox" aria-expanded="false">Studio Echo</button>
      <div class="echo-preset-menu" id="echoPresetMenu" role="listbox"></div>`;
    const button = container.querySelector("#echoPresetButton");
    const menu = container.querySelector("#echoPresetMenu");
    Object.entries(PRESETS).forEach(([id, preset]) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "echo-preset-option";
      option.dataset.preset = id;
      option.role = "option";
      option.textContent = preset.label;
      option.addEventListener("click", () => choosePreset(id));
      menu.appendChild(option);
    });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const picker = document.getElementById("echoPresetPicker");
      const open = !picker.classList.contains("open");
      picker.classList.toggle("open", open);
      button.setAttribute("aria-expanded", String(open));
    });
  }

  function ensureModal() {
    let backdrop = document.getElementById(MODAL_ID);
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.id = MODAL_ID;
    backdrop.className = "echo-settings-backdrop";
    backdrop.innerHTML = `
      <section class="echo-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="echoSettingsTitle">
        <div class="echo-settings-head">
          <div>
            <span class="eyebrow">Clip-wide effect</span>
            <h3 id="echoSettingsTitle">Echo settings</h3>
            <p>These settings apply to the selected clip as a whole. Echo keyframes are not enabled.</p>
          </div>
          <button class="icon-button" id="echoSettingsCloseBtn" type="button" aria-label="Close echo settings">×</button>
        </div>
        <div class="echo-settings-grid">
          <div class="echo-settings-panel echo-settings-manual-panel">
            <h4>Manual controls</h4>
            <div class="echo-settings-controls" id="echoControlsGrid"></div>
          </div>
          <aside class="echo-settings-panel echo-settings-side-panel">
            <h4>Preset</h4>
            <div class="echo-preset-picker" id="echoPresetPicker"></div>
            <div class="echo-settings-mode" id="echoModeLabel">Delay</div>
            <p class="echo-settings-explain" id="echoPresetExplain"></p>
            <div class="echo-settings-actions">
              <button class="tool-button" id="echoPreviewBtn" type="button">▶ Preview selected clip</button>
              <button class="tool-button" id="echoResetBtn" type="button">Reset echo</button>
              <button class="tool-button" id="echoCloseBtn" type="button">Close</button>
              <button class="tool-button primary" id="echoApplyBtn" type="button">Apply echo</button>
            </div>
          </aside>
        </div>
      </section>`;
    document.body.appendChild(backdrop);

    renderPresetPicker(backdrop.querySelector("#echoPresetPicker"));
    const grid = backdrop.querySelector("#echoControlsGrid");
    Object.keys(CONTROL_META).forEach((key) => grid.appendChild(createControl(key)));

    backdrop.querySelector("#echoSettingsCloseBtn").addEventListener("click", closeModal);
    backdrop.querySelector("#echoCloseBtn").addEventListener("click", closeModal);
    backdrop.querySelector("#echoApplyBtn").addEventListener("click", applyEchoSettings);
    backdrop.querySelector("#echoResetBtn").addEventListener("click", resetEchoSettings);
    backdrop.querySelector("#echoPreviewBtn").addEventListener("click", previewEchoSettings);
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) closeModal();
    });
    return backdrop;
  }

  function modalInput(key) { return document.getElementById(`echo-${key}`); }
  function modalOutput(key) { return document.getElementById(`echo-${key}-out`); }

  function readSettingsFromModal() {
    const base = clonePreset(currentPresetId || "studio");
    Object.keys(CONTROL_META).forEach((key) => {
      const input = modalInput(key);
      if (input) base[key] = clampNumber(input.value, CONTROL_META[key].min, CONTROL_META[key].max, base[key]);
    });
    return normalizeSettings(base);
  }

  function updatePresetPicker(settings) {
    const button = document.getElementById("echoPresetButton");
    if (button) button.textContent = settings.label;
    document.querySelectorAll(".echo-preset-option").forEach((option) => {
      option.classList.toggle("active", option.dataset.preset === settings.preset);
      option.setAttribute("aria-selected", String(option.dataset.preset === settings.preset));
    });
  }

  function updateVisibleControls(settings) {
    const show = settings.mode === "reverb" ? REVERB_CONTROLS : DELAY_CONTROLS;
    document.querySelectorAll("[data-echo-control]").forEach((control) => {
      control.classList.toggle("hidden", !show.includes(control.dataset.echoControl));
    });
  }

  function updateExplanationFromControls() {
    const settings = readSettingsFromModal();
    const explain = document.getElementById("echoPresetExplain");
    const mode = document.getElementById("echoModeLabel");
    if (explain) explain.textContent = settings.explanation;
    if (mode) mode.textContent = settings.mode === "reverb" ? "Reverb / space" : "Delay / echo";
    updateVisibleControls(settings);
    updatePresetPicker(settings);
  }

  function loadSettingsIntoModal(settings) {
    const normalized = normalizeSettings(settings);
    currentPresetId = normalized.preset || "studio";
    Object.keys(CONTROL_META).forEach((key) => {
      const input = modalInput(key);
      const output = modalOutput(key);
      if (!input || !output) return;
      input.value = String(normalized[key]);
      output.textContent = controlValueLabel(key, normalized[key]);
    });
    updateExplanationFromControls();
  }

  function openModal() {
    const clip = selectedClip();
    if (!clip) {
      showToast("Select a clip before opening Echo settings.");
      return;
    }
    const backdrop = ensureModal();
    loadSettingsIntoModal(clip.echoSettings?.enabled ? clip.echoSettings : settingsForClip(clip) || clonePreset("studio"));
    backdrop.classList.add("open");
  }

  function closeModal() {
    document.getElementById(MODAL_ID)?.classList.remove("open");
    closePresetMenu();
    stopPreview();
  }

  function stopPreview() {
    if (previewSource) {
      try { previewSource.stop(); } catch {}
      previewSource = null;
    }
  }

  async function previewEchoSettings() {
    const clip = selectedClip();
    if (!clip || !audioContext) return;
    stopPreview();
    await audioContext.resume();
    const buffer = await processedClipBuffer(clip);
    if (!buffer) return;
    const settings = readSettingsFromModal();
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    const previewClip = { ...clip, echo: 0, echoSettings: settings };
    connectClipNodes(audioContext, source, previewClip, audioContext.destination, audioContext.currentTime + 0.03, 0);
    source.onended = () => { if (previewSource === source) previewSource = null; };
    previewSource = source;
    source.start(audioContext.currentTime + 0.03);
  }

  function applyEchoSettings() {
    const clip = selectedClip();
    if (!clip) return;
    stopPlayback();
    stopPreview();
    const settings = readSettingsFromModal();
    clip.echoSettings = settings;
    clip.echo = Math.round(settings.wet);
    invalidateClip?.(clip);
    syncSelectedControls();
    renderTimeline();
    closeModal();
    showToast(`${settings.label} applied to selected clip.`);
  }

  function resetEchoSettings() {
    const clip = selectedClip();
    if (!clip) return;
    stopPlayback();
    stopPreview();
    clip.echoSettings = null;
    clip.echo = 0;
    invalidateClip?.(clip);
    syncSelectedControls();
    renderTimeline();
    closeModal();
    showToast("Echo removed from selected clip.");
  }

  function ensureEchoButton() {
    const existing = document.getElementById("echoSettingsBtn");
    let button = existing;
    if (existing) {
      button = existing.cloneNode(true);
      existing.replaceWith(button);
    } else {
      const echoControl = ui.echoSlider?.closest(".range-control");
      if (!echoControl) return null;
      button = document.createElement("button");
      button.id = "echoSettingsBtn";
      button.type = "button";
      button.className = "icon-button echo-settings-btn";
      button.textContent = "⚙️";
      echoControl.insertAdjacentElement("afterend", button);
    }
    button.title = "Open clip-wide echo settings";
    button.addEventListener("click", openModal);
    return button;
  }

  function createFilter(context, type, frequency) {
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = Math.max(20, Math.min(context.sampleRate / 2 - 100, Number(frequency) || 1000));
    return filter;
  }

  function createPanner(context, pan) {
    if (!context.createStereoPanner) return null;
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, Number(pan) || 0));
    return panner;
  }

  function connectSeries(nodes) {
    for (let i = 0; i < nodes.length - 1; i += 1) {
      if (nodes[i] && nodes[i + 1]) nodes[i].connect(nodes[i + 1]);
    }
  }

  function generatedImpulse(context, settings) {
    let byContext = impulseCache.get(context);
    if (!byContext) {
      byContext = new Map();
      impulseCache.set(context, byContext);
    }
    const key = `${context.sampleRate}:${settings.preset}:${settings.roomSize}:${settings.decay}:${settings.preDelay}:${settings.damping}:${settings.highCut}`;
    if (byContext.has(key)) return byContext.get(key);
    const sampleRate = context.sampleRate;
    const decay = clampNumber(settings.decay, 0.2, 8, 2.5);
    const preDelaySamples = Math.round(sampleRate * clampNumber(settings.preDelay, 0, 250, 20) / 1000);
    const length = Math.max(1, preDelaySamples + Math.round(sampleRate * (decay + 0.45)));
    const buffer = context.createBuffer(2, length, sampleRate);
    const room = clampNumber(settings.roomSize, 0, 100, 60) / 100;
    const damping = clampNumber(settings.damping, 0, 100, 50) / 100;
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      let last = 0;
      for (let i = preDelaySamples; i < length; i += 1) {
        const t = (i - preDelaySamples) / sampleRate;
        const envelope = Math.pow(Math.max(0, 1 - t / (decay + 0.001)), 1.35 + damping * 1.5);
        const scatter = (Math.random() * 2 - 1) * (0.65 + room * 0.55);
        last = last * (0.18 + damping * 0.62) + scatter * (0.82 - damping * 0.45);
        data[i] = last * envelope;
      }
    }
    byContext.set(key, buffer);
    return buffer;
  }

  function applyDelayEffect(context, input, settings, destination) {
    const output = context.createGain();
    output.gain.value = clampNumber(settings.outputGain, 0, 150, 100) / 100;
    output.connect(destination);

    const dry = context.createGain();
    dry.gain.value = clampNumber(settings.dry, 0, 120, 100) / 100;
    input.connect(dry);
    dry.connect(output);

    const wetAmount = clampNumber(settings.wet, 0, 100, 30) / 100;
    const feedbackAmount = clampNumber(settings.feedback, 0, 85, 25) / 100;
    const delaySeconds = clampNumber(settings.delayTime, 40, 1200, 250) / 1000;

    if (settings.preset === "multitap" || Number(settings.tapCount) > 1) {
      const taps = Math.max(1, Math.min(6, Math.round(settings.tapCount || 4)));
      const spacing = clampNumber(settings.tapSpacing, 60, 400, 150) / 1000;
      for (let tap = 0; tap < taps; tap += 1) {
        const delay = context.createDelay(5);
        const highpass = createFilter(context, "highpass", settings.lowCut);
        const lowpass = createFilter(context, "lowpass", settings.highCut);
        const gain = context.createGain();
        gain.gain.value = wetAmount * Math.pow(0.74 + feedbackAmount * 0.2, tap);
        const pan = createPanner(context, settings.stereoWidth ? ((tap % 2 === 0 ? -1 : 1) * settings.stereoWidth / 100) : 0);
        delay.delayTime.value = delaySeconds + tap * spacing;
        input.connect(delay);
        connectSeries([delay, highpass, lowpass, gain, pan || output]);
        if (pan) pan.connect(output);
      }
      return;
    }

    if (settings.preset === "pingpong" && context.createStereoPanner) {
      const leftDelay = context.createDelay(3);
      const rightDelay = context.createDelay(3);
      const leftFeedback = context.createGain();
      const rightFeedback = context.createGain();
      const leftWet = context.createGain();
      const rightWet = context.createGain();
      const leftPan = createPanner(context, -Math.max(.25, settings.stereoWidth / 100));
      const rightPan = createPanner(context, Math.max(.25, settings.stereoWidth / 100));
      leftDelay.delayTime.value = delaySeconds;
      rightDelay.delayTime.value = delaySeconds;
      leftFeedback.gain.value = feedbackAmount;
      rightFeedback.gain.value = feedbackAmount;
      leftWet.gain.value = wetAmount * .78;
      rightWet.gain.value = wetAmount * .78;
      input.connect(leftDelay);
      leftDelay.connect(leftWet);
      leftWet.connect(leftPan);
      leftPan.connect(output);
      leftDelay.connect(rightFeedback);
      rightFeedback.connect(rightDelay);
      rightDelay.connect(rightWet);
      rightWet.connect(rightPan);
      rightPan.connect(output);
      rightDelay.connect(leftFeedback);
      leftFeedback.connect(leftDelay);
      return;
    }

    const delay = context.createDelay(3);
    const highpass = createFilter(context, "highpass", settings.lowCut);
    const lowpass = createFilter(context, "lowpass", settings.highCut);
    const feedback = context.createGain();
    const wet = context.createGain();
    const pan = createPanner(context, settings.stereoWidth ? settings.stereoWidth / 140 : 0);
    delay.delayTime.value = delaySeconds;
    feedback.gain.value = feedbackAmount;
    wet.gain.value = wetAmount;
    input.connect(delay);
    connectSeries([delay, highpass, lowpass, wet, pan || output]);
    if (pan) pan.connect(output);
    lowpass.connect(feedback);
    feedback.connect(delay);
  }

  function applyReverbEffect(context, input, settings, destination) {
    const output = context.createGain();
    output.gain.value = clampNumber(settings.outputGain, 0, 150, 100) / 100;
    output.connect(destination);

    const dry = context.createGain();
    dry.gain.value = clampNumber(settings.dry, 0, 120, 100) / 100;
    input.connect(dry);
    dry.connect(output);

    const predelay = context.createDelay(1);
    const convolver = context.createConvolver();
    const highpass = createFilter(context, "highpass", settings.lowCut);
    const lowpass = createFilter(context, "lowpass", settings.highCut);
    const wet = context.createGain();
    const pan = createPanner(context, settings.stereoWidth ? settings.stereoWidth / 180 : 0);
    predelay.delayTime.value = clampNumber(settings.preDelay, 0, 250, 30) / 1000;
    convolver.buffer = generatedImpulse(context, settings);
    wet.gain.value = clampNumber(settings.wet, 0, 100, 35) / 100;
    connectSeries([input, predelay, convolver, highpass, lowpass, wet, pan || output]);
    if (pan) pan.connect(output);
  }

  function advancedEchoTail(clip) {
    const settings = settingsForClip(clip);
    if (!settings) return 0;
    if (settings.mode === "reverb") return clampNumber(settings.preDelay, 0, 250, 20) / 1000 + clampNumber(settings.decay, 0.2, 8, 2.5) + 0.45;
    if (settings.preset === "multitap") return clampNumber(settings.delayTime, 40, 1200, 250) / 1000 + clampNumber(settings.tapSpacing, 60, 400, 150) / 1000 * Math.max(1, Math.round(settings.tapCount || 4)) + 1.2;
    return clampNumber(settings.delayTime, 40, 1200, 250) / 1000 * 2 + 1.2 + clampNumber(settings.feedback, 0, 85, 25) / 100;
  }

  const previousConnectClipNodes = connectClipNodes;
  connectClipNodes = function echoSettingsConnectClipNodes(context, source, clip, destination, when = context.currentTime, offset = 0) {
    const settings = settingsForClip(clip);
    if (!settings) return previousConnectClipNodes(context, source, clip, destination, when, offset);
    const effectInput = context.createGain();
    previousConnectClipNodes(context, source, { ...clip, echo: 0 }, effectInput, when, offset);
    if (settings.mode === "reverb") applyReverbEffect(context, effectInput, settings, destination);
    else applyDelayEffect(context, effectInput, settings, destination);
  };

  const previousProjectDuration = projectDuration;
  projectDuration = function echoSettingsProjectDuration() {
    const base = previousProjectDuration();
    const advanced = Math.max(5, ...state.clips.map((clip) => clip.start + clipDuration(clip) + advancedEchoTail(clip)));
    return Math.max(base, advanced);
  };

  const previousRenderTimeline = renderTimeline;
  renderTimeline = function echoSettingsRenderTimeline() {
    previousRenderTimeline();
    state.clips.forEach((clip) => {
      const settings = settingsForClip(clip);
      if (!settings) return;
      const element = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
      const badges = element?.querySelector(".clip-effect-badges");
      if (!badges || badges.querySelector(".echo-settings-badge")) return;
      const badge = document.createElement("span");
      badge.className = "echo-settings-badge";
      badge.textContent = settings.label.replace(" Echo", "");
      badge.title = settings.tooltip || settings.explanation || "Clip-wide echo settings active.";
      badges.appendChild(badge);
    });
  };

  const previousSyncSelectedControls = syncSelectedControls;
  syncSelectedControls = function echoSettingsSyncSelectedControls() {
    previousSyncSelectedControls();
    const clip = selectedClip();
    const settings = settingsForClip(clip);
    const button = document.getElementById("echoSettingsBtn");
    if (button) {
      button.disabled = !clip;
      button.classList.toggle("echo-settings-active", Boolean(settings));
      button.title = settings ? `Echo settings: ${settings.label}` : "Open clip-wide echo settings";
    }
    if (clip?.echoSettings?.enabled && ui.echoSlider && ui.echoOut) {
      ui.echoSlider.value = String(Math.round(settings.wet));
      ui.echoOut.textContent = `${Math.round(settings.wet)}%`;
    }
  };

  ui.echoSlider?.addEventListener("input", () => {
    const clip = selectedClip();
    if (!clip?.echoSettings?.enabled) return;
    const settings = normalizeSettings(clip.echoSettings);
    settings.wet = clampNumber(ui.echoSlider.value, 0, 100, settings.wet);
    clip.echoSettings = settings;
    clip.echo = Math.round(settings.wet);
    ui.echoOut.textContent = `${Math.round(settings.wet)}%`;
    renderTimeline();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#echoPresetPicker")) closePresetMenu();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePresetMenu();
      closeModal();
    }
  });

  installStyles();
  ensureEchoButton();
  ensureModal();
  syncSelectedControls();
  renderTimeline();
  if (typeof setStatus === "function") setStatus("Ready — echo settings active");
})();
