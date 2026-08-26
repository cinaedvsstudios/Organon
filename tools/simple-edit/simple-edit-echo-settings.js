"use strict";

(function installSimpleEditEchoSettings() {
  const MODAL_ID = "echoSettingsModal";
  const STYLE_ID = "orgavoxEchoSettingsStyles";
  const PRESETS = {
    studio: { label: "Studio Echo", wet: 24, delayTime: 220, feedback: 18, explanation: "A clean controlled echo that adds depth without taking over." },
    slapback: { label: "Slapback Echo", wet: 22, delayTime: 95, feedback: 6, explanation: "A single fast echo that thickens the clip." },
    digital: { label: "Digital Delay", wet: 35, delayTime: 320, feedback: 34, explanation: "A clear modern echo with bright repeats." },
    tape: { label: "Tape Delay", wet: 36, delayTime: 380, feedback: 42, explanation: "A warmer old-style echo with darker repeats." },
    pingpong: { label: "Ping Pong Echo", wet: 36, delayTime: 260, feedback: 38, explanation: "A wide echo that feels like it bounces left and right." },
    hall: { label: "Large Hall", wet: 38, delayTime: 280, feedback: 14, explanation: "A broad roomy echo for hall space." },
    church: { label: "Church Echo", wet: 45, delayTime: 340, feedback: 22, explanation: "Huge long stone-wall style echo." },
    cavern: { label: "Cavern Echo", wet: 48, delayTime: 420, feedback: 28, explanation: "Dark cave-like echo with deep reflections." }
  };
  let currentPreset = "studio";
  let preview = null;
  let previewTimer = 0;

  function selected() { return selectedClip?.() || null; }
  function preset(id) { return { ...(PRESETS[id] || PRESETS.studio), preset: id || "studio", enabled: true }; }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .echo-settings-backdrop{position:fixed!important;inset:0!important;z-index:999998!important;display:none!important;place-items:center!important;padding:24px!important;background:rgba(0,0,0,.62)!important;color:#f5f0db!important}
      .echo-settings-backdrop.open{display:grid!important}
      .echo-settings-dialog{width:min(760px,calc(100vw - 40px))!important;max-height:min(720px,calc(100vh - 40px))!important;overflow:auto!important;display:grid!important;gap:14px!important;padding:16px!important;border:1px solid rgba(117,178,222,.76)!important;border-radius:18px!important;background:linear-gradient(180deg,rgba(24,25,24,.98),rgba(10,11,10,.99))!important;box-shadow:0 22px 64px rgba(0,0,0,.78)!important}
      .echo-settings-head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:18px!important}
      .echo-settings-head h3{margin:.1rem 0 .2rem!important;color:#e0a360!important;font-family:var(--font-head,var(--font-headers),Georgia,serif)!important}
      .echo-settings-head p,.echo-settings-explain{margin:0!important;color:rgba(245,240,219,.66)!important;font-size:.82rem!important;line-height:1.35!important}
      .echo-settings-grid{display:grid!important;grid-template-columns:minmax(210px,.88fr) minmax(260px,1.12fr)!important;gap:14px!important}
      .echo-settings-panel{display:grid!important;align-content:start!important;gap:10px!important;padding:12px!important;border:1px solid rgba(224,163,96,.28)!important;border-radius:14px!important;background:rgba(0,0,0,.24)!important}
      .echo-settings-panel h4{margin:0!important;color:#75b2de!important;font-size:.8rem!important;letter-spacing:.08em!important;text-transform:uppercase!important}
      .echo-preset-picker{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
      .echo-preset-option{min-height:32px!important;padding:7px 8px!important;border:1px solid rgba(117,178,222,.36)!important;border-radius:10px!important;background:rgba(0,0,0,.28)!important;color:#f5f0db!important;font:800 .68rem var(--font-body,system-ui)!important;cursor:pointer!important;text-align:left!important}
      .echo-preset-option:hover,.echo-preset-option.active{border-color:rgba(224,163,96,.86)!important;background:rgba(224,163,96,.16)!important;color:#ffe4a8!important}
      .echo-settings-control{display:grid!important;gap:6px!important;margin:0!important;color:#f5f0db!important;font:800 .72rem var(--font-body,system-ui)!important}
      .echo-settings-control span{display:flex!important;justify-content:space-between!important;gap:12px!important;color:rgba(245,240,219,.78)!important}
      .echo-settings-control output{color:#e0a360!important;font-family:var(--font-mono,monospace)!important}
      .echo-settings-control input[type=range]{width:100%!important}
      .echo-settings-actions{display:flex!important;justify-content:flex-end!important;gap:8px!important;flex-wrap:wrap!important}
      #echoPreviewBtn.active{border-color:rgba(74,190,117,.9)!important;background:linear-gradient(180deg,rgba(37,122,69,.96),rgba(16,63,36,.98))!important;color:#e2ffe9!important}
      @media(max-width:720px){.echo-settings-grid{grid-template-columns:1fr!important}.echo-preset-picker{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "echo-settings-backdrop";
    modal.innerHTML = `<section class="echo-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="echoSettingsTitle"><div class="echo-settings-head"><div><span class="eyebrow">Clip-wide effect</span><h3 id="echoSettingsTitle">Echo settings</h3><p>These settings apply to the selected clip as a whole.</p></div><button class="icon-button" data-echo-close type="button">×</button></div><div class="echo-settings-grid"><div class="echo-settings-panel"><h4>Preset</h4><div class="echo-preset-picker" id="echoPresetPicker"></div><p class="echo-settings-explain" id="echoPresetExplain"></p></div><div class="echo-settings-panel"><h4>Manual controls</h4><label class="echo-settings-control"><span>Wet amount <output id="echoWetOut">0%</output></span><input id="echoWet" type="range" min="0" max="100" value="0"></label><label class="echo-settings-control"><span>Delay time <output id="echoDelayOut">220ms</output></span><input id="echoDelay" type="range" min="40" max="1200" step="5" value="220"></label><label class="echo-settings-control"><span>Feedback <output id="echoFeedbackOut">18%</output></span><input id="echoFeedback" type="range" min="0" max="85" value="18"></label></div></div><div class="echo-settings-actions"><button class="tool-button" id="echoResetBtn" type="button">Reset echo</button><button class="tool-button" id="echoPreviewBtn" type="button">Preview</button><button class="tool-button" data-echo-close type="button">Close</button><button class="tool-button primary" id="echoApplyBtn" type="button">Apply echo</button></div></section>`;
    document.body.appendChild(modal);
    renderPresets(modal.querySelector("#echoPresetPicker"));
    modal.querySelectorAll("[data-echo-close]").forEach((button) => button.addEventListener("click", closeModal));
    modal.querySelector("#echoApplyBtn")?.addEventListener("click", applyEchoSettings);
    modal.querySelector("#echoResetBtn")?.addEventListener("click", resetEchoSettings);
    modal.querySelector("#echoPreviewBtn")?.addEventListener("click", previewEchoSettings);
    modal.addEventListener("pointerdown", (event) => { if (event.target === modal) closeModal(); });
    ["echoWet", "echoDelay", "echoFeedback"].forEach((id) => modal.querySelector(`#${id}`)?.addEventListener("input", () => { updateOutputs(); stopPreview(); }));
    return modal;
  }

  function renderPresets(container) {
    if (!container) return;
    container.innerHTML = "";
    Object.entries(PRESETS).forEach(([id, data]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "echo-preset-option";
      button.dataset.preset = id;
      button.textContent = data.label;
      button.addEventListener("click", () => choosePreset(id));
      container.appendChild(button);
    });
  }

  function choosePreset(id) {
    currentPreset = id || "studio";
    const data = preset(currentPreset);
    const modal = ensureModal();
    modal.querySelector("#echoWet").value = String(data.wet);
    modal.querySelector("#echoDelay").value = String(data.delayTime);
    modal.querySelector("#echoFeedback").value = String(data.feedback);
    modal.querySelector("#echoPresetExplain").textContent = data.explanation;
    modal.querySelectorAll(".echo-preset-option").forEach((button) => button.classList.toggle("active", button.dataset.preset === currentPreset));
    updateOutputs();
    stopPreview();
  }

  function updateOutputs() {
    const modal = ensureModal();
    modal.querySelector("#echoWetOut").textContent = `${Math.round(Number(modal.querySelector("#echoWet")?.value || 0))}%`;
    modal.querySelector("#echoDelayOut").textContent = `${Math.round(Number(modal.querySelector("#echoDelay")?.value || 220))}ms`;
    modal.querySelector("#echoFeedbackOut").textContent = `${Math.round(Number(modal.querySelector("#echoFeedback")?.value || 18))}%`;
  }

  function openModal() {
    const clip = selected();
    if (!clip) { showToast("Select a clip before opening Echo settings."); return; }
    const modal = ensureModal();
    currentPreset = clip.echoSettings?.preset || currentPreset || "studio";
    choosePreset(currentPreset);
    if (clip.echoSettings?.enabled) {
      modal.querySelector("#echoWet").value = String(Math.max(0, Math.min(100, Number(clip.echoSettings.wet) || Number(clip.echo) || 0)));
      modal.querySelector("#echoDelay").value = String(Math.max(40, Math.min(1200, Number(clip.echoSettings.delayTime) || 220)));
      modal.querySelector("#echoFeedback").value = String(Math.max(0, Math.min(85, Number(clip.echoSettings.feedback) || 18)));
      updateOutputs();
    } else if (Number(clip.echo) > 0) {
      modal.querySelector("#echoWet").value = String(clip.echo);
      updateOutputs();
    }
    modal.classList.add("open");
    setTimeout(() => modal.querySelector("#echoWet")?.focus(), 0);
  }

  function closeModal() {
    stopPreview();
    document.getElementById(MODAL_ID)?.classList.remove("open");
  }

  function readSettings() {
    const modal = ensureModal();
    const base = preset(currentPreset || "studio");
    base.wet = Math.max(0, Math.min(100, Number(modal.querySelector("#echoWet")?.value) || 0));
    base.delayTime = Math.max(40, Math.min(1200, Number(modal.querySelector("#echoDelay")?.value) || 220));
    base.feedback = Math.max(0, Math.min(85, Number(modal.querySelector("#echoFeedback")?.value) || 18));
    return base;
  }

  function setPreviewButton(active) {
    const button = document.getElementById("echoPreviewBtn");
    if (!button) return;
    button.classList.toggle("active", Boolean(active));
    button.textContent = active ? "Stop preview" : "Preview";
  }

  function stopPreview() {
    clearTimeout(previewTimer);
    previewTimer = 0;
    if (preview?.source) {
      try { preview.source.onended = null; preview.source.stop(); } catch {}
    }
    preview = null;
    setPreviewButton(false);
  }

  async function previewEchoSettings() {
    const clip = selected();
    if (!clip) { showToast("Select a clip before previewing echo."); return; }
    if (preview) { stopPreview(); return; }
    if (!audioContext) { showToast("Audio engine is not ready yet."); return; }
    const settings = readSettings();
    try {
      stopPlayback(false);
      await audioContext.resume();
      const buffer = typeof processedClipBuffer === "function" ? await processedClipBuffer(clip) : clipBuffer?.(clip);
      if (!buffer) { showToast("The selected clip has no audio to preview."); return; }
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      const dry = audioContext.createGain();
      const wet = audioContext.createGain();
      const delay = audioContext.createDelay(2);
      const feedback = audioContext.createGain();
      dry.gain.value = Math.max(0, Math.min(2, Number(clip.volume || 100) / 100));
      wet.gain.value = Math.max(0, Math.min(1, settings.wet / 100)) * .75;
      delay.delayTime.value = Math.max(.04, Math.min(1.2, settings.delayTime / 1000));
      feedback.gain.value = Math.max(0, Math.min(.85, settings.feedback / 100));
      source.connect(dry);
      dry.connect(audioContext.destination);
      source.connect(delay);
      delay.connect(wet);
      wet.connect(audioContext.destination);
      delay.connect(feedback);
      feedback.connect(delay);
      const offset = state.playhead > clip.start && state.playhead < clip.start + buffer.duration ? Math.max(0, state.playhead - clip.start) : 0;
      const previewSeconds = Math.max(.25, Math.min(12, buffer.duration - offset));
      source.onended = stopPreview;
      preview = { source };
      setPreviewButton(true);
      source.start(0, offset, previewSeconds);
      previewTimer = setTimeout(stopPreview, (previewSeconds + 1.5) * 1000);
      showToast(`Previewing ${settings.label}.`);
    } catch (error) {
      console.error(error);
      stopPreview();
      showToast("Echo preview failed.");
    }
  }

  function applyEchoSettings() {
    const clip = selected();
    if (!clip) return;
    stopPreview();
    stopPlayback();
    const settings = readSettings();
    clip.echoSettings = settings;
    clip.echo = Math.round(settings.wet);
    invalidateClip?.(clip);
    syncSelectedControls();
    renderTimeline();
    window.orgavoxRecordHistory?.();
    closeModal();
    showToast(`${settings.label} applied to selected clip.`);
  }

  function resetEchoSettings() {
    const clip = selected();
    if (!clip) return;
    stopPreview();
    stopPlayback();
    clip.echoSettings = null;
    clip.echo = 0;
    invalidateClip?.(clip);
    syncSelectedControls();
    renderTimeline();
    window.orgavoxRecordHistory?.();
    closeModal();
    showToast("Echo removed from selected clip.");
  }

  installStyles();
  window.orgavoxOpenEchoSettings = openModal;
  window.orgavoxEchoSettingsForClip = (clip) => clip?.echoSettings?.enabled ? clip.echoSettings : null;
})();
