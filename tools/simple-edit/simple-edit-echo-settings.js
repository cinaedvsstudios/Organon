"use strict";

(function installSimpleEditEchoSettings() {
  const MODAL_ID = "echoSettingsModal";
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

  function selected() { return selectedClip?.() || null; }
  function preset(id) { return { ...(PRESETS[id] || PRESETS.studio), preset: id || "studio", enabled: true }; }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "echo-settings-backdrop";
    modal.innerHTML = `<section class="echo-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="echoSettingsTitle"><div class="echo-settings-head"><div><span class="eyebrow">Clip-wide effect</span><h3 id="echoSettingsTitle">Echo settings</h3><p>These settings apply to the selected clip as a whole.</p></div><button class="icon-button" data-echo-close type="button">×</button></div><div class="echo-settings-grid"><div class="echo-settings-panel"><h4>Preset</h4><div class="echo-preset-picker" id="echoPresetPicker"></div><p class="echo-settings-explain" id="echoPresetExplain"></p></div><div class="echo-settings-panel"><h4>Manual controls</h4><label class="echo-settings-control"><span>Wet amount <output id="echoWetOut">0%</output></span><input id="echoWet" type="range" min="0" max="100" value="0"></label><label class="echo-settings-control"><span>Delay time <output id="echoDelayOut">220ms</output></span><input id="echoDelay" type="range" min="40" max="1200" step="5" value="220"></label><label class="echo-settings-control"><span>Feedback <output id="echoFeedbackOut">18%</output></span><input id="echoFeedback" type="range" min="0" max="85" value="18"></label></div></div><div class="echo-settings-actions"><button class="tool-button" id="echoResetBtn" type="button">Reset echo</button><button class="tool-button" data-echo-close type="button">Close</button><button class="tool-button primary" id="echoApplyBtn" type="button">Apply echo</button></div></section>`;
    document.body.appendChild(modal);
    renderPresets(modal.querySelector("#echoPresetPicker"));
    modal.querySelectorAll("[data-echo-close]").forEach((button) => button.addEventListener("click", closeModal));
    modal.querySelector("#echoApplyBtn")?.addEventListener("click", applyEchoSettings);
    modal.querySelector("#echoResetBtn")?.addEventListener("click", resetEchoSettings);
    modal.addEventListener("pointerdown", (event) => { if (event.target === modal) closeModal(); });
    ["echoWet", "echoDelay", "echoFeedback"].forEach((id) => modal.querySelector(`#${id}`)?.addEventListener("input", updateOutputs));
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
  }

  function updateOutputs() {
    const modal = ensureModal();
    modal.querySelector("#echoWetOut").textContent = `${Math.round(Number(modal.querySelector("#echoWet")?.value || 0))}%`;
    modal.querySelector("#echoDelayOut").textContent = `${Math.round(Number(modal.querySelector("#echoDelay")?.value || 220))}ms`;
    modal.querySelector("#echoFeedbackOut").textContent = `${Math.round(Number(modal.querySelector("#echoFeedback")?.value || 18))}%`;
  }

  function openModal() {
    const clip = selected();
    if (!clip) return showToast("Select a clip before opening Echo settings.");
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
  }

  function closeModal() { document.getElementById(MODAL_ID)?.classList.remove("open"); }

  function readSettings() {
    const modal = ensureModal();
    const base = preset(currentPreset || "studio");
    base.wet = Math.max(0, Math.min(100, Number(modal.querySelector("#echoWet")?.value) || 0));
    base.delayTime = Math.max(40, Math.min(1200, Number(modal.querySelector("#echoDelay")?.value) || 220));
    base.feedback = Math.max(0, Math.min(85, Number(modal.querySelector("#echoFeedback")?.value) || 18));
    return base;
  }

  function applyEchoSettings() {
    const clip = selected();
    if (!clip) return;
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

  window.orgavoxOpenEchoSettings = openModal;
  window.orgavoxEchoSettingsForClip = (clip) => clip?.echoSettings?.enabled ? clip.echoSettings : null;
})();
