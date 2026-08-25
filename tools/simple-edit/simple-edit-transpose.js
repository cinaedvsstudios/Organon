"use strict";

(function installOrgavoxTranspose() {
  const TRANSPOSE_VERSION = window.ORGAVOX_VERSION || "v0.26";
  const STYLE_ID = "orgavox-transpose-style";
  const MODAL_ID = "transposeModal";
  const KEYS = ["C", "C# / Db", "D", "D# / Eb", "E", "F", "F# / Gb", "G", "G# / Ab", "A", "A# / Bb", "B"];
  let previewSource = null;

  function clampSemitones(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(-24, Math.min(24, Math.round(number)));
  }

  function semitoneLabel(value) {
    const semitones = clampSemitones(value);
    if (semitones === 0) return "0 semitones";
    return `${semitones > 0 ? "+" : ""}${semitones} semitone${Math.abs(semitones) === 1 ? "" : "s"}`;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .transpose-btn.transpose-active { border-color: rgba(117,178,222,.9); color:#dff5ff; box-shadow:0 0 0 2px rgba(117,178,222,.16); }
      body.simple-edit-phase1 .clip-effect-badges span.transpose-badge { border-color: rgba(248,215,146,.66); color:#ffe2b1; }
      .transpose-backdrop { position:fixed; inset:0; z-index:2680; display:none; align-items:center; justify-content:center; padding:20px; background:rgba(5,7,7,.74); backdrop-filter:blur(7px); }
      .transpose-backdrop.open { display:flex; }
      .transpose-dialog { width:min(780px,94vw); max-height:min(720px,92vh); overflow:auto; border:1px solid rgba(224,163,96,.58); border-radius:22px; background:linear-gradient(180deg,rgba(41,38,30,.98),rgba(17,20,18,.99)); color:#f5f0db; box-shadow:0 26px 80px rgba(0,0,0,.54), inset 0 0 0 1px rgba(255,255,255,.04); padding:18px; }
      .transpose-head { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; margin-bottom:14px; }
      .transpose-head h3 { margin:4px 0 6px; font-family:var(--font-headers); font-size:1.35rem; letter-spacing:.04em; }
      .transpose-head p { margin:0; color:rgba(245,240,219,.72); line-height:1.45; }
      .transpose-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(230px,300px); gap:14px; align-items:start; }
      .transpose-panel { border:1px solid rgba(224,163,96,.26); border-radius:16px; background:rgba(7,9,8,.38); padding:14px; }
      .transpose-panel h4 { margin:0 0 10px; font-size:.84rem; letter-spacing:.08em; text-transform:uppercase; color:#f8d792; }
      .transpose-control { display:grid; gap:8px; border:1px solid rgba(224,163,96,.16); border-radius:13px; padding:12px; background:rgba(0,0,0,.2); }
      .transpose-control span { display:flex; justify-content:space-between; gap:8px; font-weight:800; color:#fff4d6; font-size:.84rem; }
      .transpose-control output { color:#75b2de; font:800 .78rem var(--font-mono); }
      .transpose-control input[type="range"] { width:100%; }
      .transpose-help { color:rgba(245,240,219,.64); line-height:1.42; font-size:.82rem; }
      .transpose-key-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .transpose-field { display:grid; gap:6px; color:#f8d792; font:800 .72rem var(--font-mono); text-transform:uppercase; letter-spacing:.08em; }
      .transpose-field select { min-height:38px; border:1px solid rgba(117,178,222,.52); border-radius:10px; background:#080a09; color:#f5f0db; padding:8px 10px; font:700 .84rem var(--font-body); }
      .transpose-actions { display:grid; gap:9px; margin-top:12px; }
      .transpose-actions .tool-button { width:100%; justify-content:center; }
      @media (max-width:760px) { .transpose-grid { grid-template-columns:1fr; } .transpose-key-grid { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function ensureButton() {
    let button = document.getElementById("transposeBtn");
    if (!button) {
      button = document.createElement("button");
      button.id = "transposeBtn";
      button.type = "button";
      button.className = "tool-button transpose-btn";
      button.textContent = "🎼 Transpose";
      button.addEventListener("click", openModal);
    }
    ui.transposeBtn = button;
    const effectsGroup = document.querySelector(".orgavox-effects-group");
    const effectsButton = document.querySelector(".effects-library-button") || [...document.querySelectorAll("button")].find((node) => /effects library/i.test(node.textContent || ""));
    if (effectsGroup && button.parentElement !== effectsGroup) {
      if (effectsButton?.parentElement === effectsGroup) effectsGroup.insertBefore(button, effectsButton);
      else effectsGroup.appendChild(button);
    }
    return button;
  }

  function optionList(selected = 0) {
    return KEYS.map((label, index) => `<option value="${index}"${index === selected ? " selected" : ""}>${label}</option>`).join("");
  }

  function ensureModal() {
    let backdrop = document.getElementById(MODAL_ID);
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.id = MODAL_ID;
    backdrop.className = "transpose-backdrop";
    backdrop.innerHTML = `
      <section class="transpose-dialog" role="dialog" aria-modal="true" aria-labelledby="transposeTitle">
        <div class="transpose-head">
          <div>
            <span class="eyebrow">Clip-wide effect</span>
            <h3 id="transposeTitle">Transpose / key match</h3>
            <p>These settings apply to the selected clip as a whole. Transpose keyframes are not enabled.</p>
          </div>
          <button class="icon-button" id="transposeCloseX" type="button" aria-label="Close transpose settings">×</button>
        </div>
        <div class="transpose-grid">
          <div class="transpose-panel">
            <h4>Manual transpose</h4>
            <label class="transpose-control">
              <span><strong>Semitones</strong><output id="transposeOut">0 semitones</output></span>
              <input id="transposeSlider" type="range" min="-24" max="24" step="1" value="0">
              <small class="transpose-help">Positive values pitch the clip up. Negative values pitch it down. The clip length is preserved by the current WSOLA stretch engine.</small>
            </label>
          </div>
          <aside class="transpose-panel">
            <h4>Key match helper</h4>
            <div class="transpose-key-grid">
              <label class="transpose-field">Clip key<select id="transposeSourceKey">${optionList(0)}</select></label>
              <label class="transpose-field">Target key<select id="transposeTargetKey">${optionList(0)}</select></label>
            </div>
            <div class="transpose-actions">
              <button class="tool-button" id="transposeFromKeysBtn" type="button">Set from keys</button>
              <button class="tool-button" id="transposePreviewBtn" type="button">▶ Preview selected clip</button>
              <button class="tool-button" id="transposeResetBtn" type="button">Reset transpose</button>
              <button class="tool-button" id="transposeCloseBtn" type="button">Close</button>
              <button class="tool-button primary" id="transposeApplyBtn" type="button">Apply transpose</button>
            </div>
          </aside>
        </div>
      </section>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector("#transposeSlider").addEventListener("input", updateModalOutput);
    backdrop.querySelector("#transposeFromKeysBtn").addEventListener("click", setSemitoneFromKeys);
    backdrop.querySelector("#transposePreviewBtn").addEventListener("click", previewTranspose);
    backdrop.querySelector("#transposeResetBtn").addEventListener("click", resetTranspose);
    backdrop.querySelector("#transposeApplyBtn").addEventListener("click", applyTranspose);
    backdrop.querySelector("#transposeCloseBtn").addEventListener("click", closeModal);
    backdrop.querySelector("#transposeCloseX").addEventListener("click", closeModal);
    backdrop.addEventListener("pointerdown", (event) => { if (event.target === backdrop) closeModal(); });
    return backdrop;
  }

  function updateModalOutput() {
    const slider = document.getElementById("transposeSlider");
    const output = document.getElementById("transposeOut");
    if (output && slider) output.textContent = semitoneLabel(slider.value);
  }

  function setSemitoneFromKeys() {
    const source = Number(document.getElementById("transposeSourceKey")?.value) || 0;
    const target = Number(document.getElementById("transposeTargetKey")?.value) || 0;
    let diff = target - source;
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;
    const slider = document.getElementById("transposeSlider");
    if (slider) slider.value = String(diff);
    updateModalOutput();
  }

  function currentModalSemitones() {
    return clampSemitones(document.getElementById("transposeSlider")?.value || 0);
  }

  function openModal() {
    const clip = selectedClip();
    if (!clip) {
      showToast("Select a clip before opening Transpose.");
      return;
    }
    const backdrop = ensureModal();
    const slider = document.getElementById("transposeSlider");
    if (slider) slider.value = String(clampSemitones(clip.transposeSemitones || 0));
    updateModalOutput();
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

  async function previewTranspose() {
    const clip = selectedClip();
    if (!clip || !audioContext) return;
    stopPreview();
    await audioContext.resume();
    const base = clipBuffer(clip);
    if (!base) return;
    const previewClip = {
      ...clip,
      id: `${clip.id}-transpose-preview-${Date.now()}`,
      bufferOverride: base,
      transposeSemitones: currentModalSemitones()
    };
    const buffer = await processedClipBuffer(previewClip);
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    connectClipNodes(audioContext, source, previewClip, audioContext.destination, audioContext.currentTime + .03, 0);
    source.onended = () => { if (previewSource === source) previewSource = null; };
    previewSource = source;
    source.start(audioContext.currentTime + .03);
  }

  function applyTranspose() {
    const clip = selectedClip();
    if (!clip) return;
    stopPlayback();
    stopPreview();
    clip.transposeSemitones = currentModalSemitones();
    invalidateClip(clip);
    syncSelectedControls();
    renderTimeline();
    closeModal();
    showToast(clip.transposeSemitones ? `Transpose applied: ${semitoneLabel(clip.transposeSemitones)}.` : "Transpose reset to original pitch.");
  }

  function resetTranspose() {
    const slider = document.getElementById("transposeSlider");
    if (slider) slider.value = "0";
    updateModalOutput();
    applyTranspose();
  }

  function updateButtonState() {
    const button = ensureButton();
    const clip = selectedClip();
    const amount = clampSemitones(clip?.transposeSemitones || 0);
    button.disabled = !clip;
    button.classList.toggle("transpose-active", Boolean(clip && amount));
    button.title = clip ? `Clip transpose: ${semitoneLabel(amount)}` : "Select a clip before transposing.";
  }

  function addTransposeBadges() {
    state.clips.forEach((clip) => {
      const amount = clampSemitones(clip.transposeSemitones || 0);
      if (!amount) return;
      const element = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
      const badges = element?.querySelector(".clip-effect-badges");
      if (!badges || badges.querySelector(".transpose-badge")) return;
      const badge = document.createElement("span");
      badge.className = "transpose-badge";
      badge.textContent = amount > 0 ? `+${amount} ST` : `${amount} ST`;
      badge.title = `Clip transposed ${semitoneLabel(amount)}.`;
      badges.appendChild(badge);
    });
  }

  const previousRenderTimeline = renderTimeline;
  renderTimeline = function transposeRenderTimeline() {
    previousRenderTimeline();
    ensureButton();
    addTransposeBadges();
  };

  const previousSyncSelectedControls = syncSelectedControls;
  syncSelectedControls = function transposeSyncSelectedControls() {
    previousSyncSelectedControls();
    updateButtonState();
  };

  const previousRefresh = window.orgavoxRefreshLayout;
  window.orgavoxRefreshLayout = function transposeAwareRefreshLayout() {
    previousRefresh?.();
    ensureButton();
    updateButtonState();
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  installStyles();
  ensureButton();
  ensureModal();
  updateButtonState();
  renderTimeline();
  if (typeof setStatus === "function") setStatus("Ready — transpose/key match active");
})();
