"use strict";

(function installOrgavoxRenderTools() {
  const STYLE_ID = "orgavox-render-tools-style";
  const MODAL_ID = "renderToolsModal";
  let busy = false;

  function selectedClipForTools() {
    return state.clips.find((clip) => clip.id === state.selectedClipId) || null;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-render-tools-button{border-color:rgba(248,215,146,.72)!important;background:linear-gradient(180deg,rgba(93,67,35,.8),rgba(34,23,13,.94))!important;color:#ffe4a8!important}
      .orgavox-render-modal{position:fixed;inset:0;z-index:96;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}
      .orgavox-render-modal[hidden]{display:none}
      .orgavox-render-dialog{width:min(760px,calc(100vw - 42px));max-height:min(720px,calc(100vh - 42px));overflow:auto;padding:20px;border:1px solid rgba(224,163,96,.72);border-radius:22px;background:#1a1c18;box-shadow:0 24px 80px rgba(0,0,0,.78)}
      .orgavox-render-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
      .orgavox-render-card{display:grid;gap:9px;padding:14px;border:1px solid rgba(137,107,73,.58);border-radius:16px;background:rgba(0,0,0,.2)}
      .orgavox-render-card h4{margin:0;color:#f8d792;font:800 .78rem var(--font-body);text-transform:uppercase;letter-spacing:.045em}
      .orgavox-render-card p{margin:0;color:rgba(245,240,219,.62);font-size:.69rem;line-height:1.45}
      .orgavox-render-status{margin-top:12px;padding:10px 12px;border-radius:12px;background:rgba(117,178,222,.08);color:rgba(245,240,219,.76);font-size:.72rem;line-height:1.45}
      .orgavox-render-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:16px}
      .audio-clip .orgavox-reverse-badge{background:rgba(248,215,146,.38);color:#ffe4a8}
      @media(max-width:760px){.orgavox-render-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureButton() {
    if (ui.renderToolsBtn) return ui.renderToolsBtn;
    const button = document.createElement("button");
    button.id = "renderToolsBtn";
    button.type = "button";
    button.className = "tool-button orgavox-render-tools-button";
    button.textContent = "🧱 Render";
    button.disabled = true;
    button.addEventListener("click", openModal);
    ui.renderToolsBtn = button;
    placeButton();
    return button;
  }

  function placeButton() {
    const button = ui.renderToolsBtn;
    if (!button) return;
    button.textContent = "🧱 Render";
    button.classList.add("orgavox-render-tools-button");
    const editGroup = document.querySelector(".orgavox-edit-group");
    const effectsDrop = editGroup?.querySelector(".orgavox-effects-dropdown");
    if (editGroup && effectsDrop && button.parentElement !== editGroup) editGroup.insertBefore(button, effectsDrop);
    else if (editGroup && !button.parentElement) editGroup.appendChild(button);
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "orgavox-render-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="orgavox-render-dialog" role="dialog" aria-modal="true" aria-labelledby="renderToolsTitle">
        <div class="popover-head"><div><span class="eyebrow">Clip tools</span><h3 id="renderToolsTitle">Render / Reverse</h3></div><button class="icon-button" data-render-close type="button">×</button></div>
        <p class="export-note">These tools work on the selected clip. Reverse stays editable. Render creates a baked copy of the clip with the current processing applied.</p>
        <div class="orgavox-render-status" data-render-status>Select a clip to use render tools.</div>
        <div class="orgavox-render-grid">
          <div class="orgavox-render-card"><h4>Reverse</h4><p>Flip the selected clip backwards without changing its position on the timeline.</p><button class="tool-button" data-render-reverse type="button">Toggle reverse</button></div>
          <div class="orgavox-render-card"><h4>Render copy</h4><p>Create a new sound-library asset from the selected clip with current effects included.</p><button class="tool-button" data-render-copy type="button">Render to library</button></div>
          <div class="orgavox-render-card"><h4>Replace clip</h4><p>Bake the selected clip into a clean new asset and replace the timeline clip with that rendered version.</p><button class="tool-button" data-render-replace type="button">Replace with rendered</button></div>
          <div class="orgavox-render-card"><h4>Download WAV</h4><p>Render the selected clip only and download it as a standalone WAV file.</p><button class="tool-button" data-render-download type="button">Download clip WAV</button></div>
        </div>
        <div class="orgavox-render-actions"><button class="tool-button" data-render-close type="button">Close</button></div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-render-close]").forEach((button) => button.addEventListener("click", closeModal));
    modal.querySelector("[data-render-reverse]")?.addEventListener("click", toggleReverse);
    modal.querySelector("[data-render-copy]")?.addEventListener("click", () => renderToLibrary(false));
    modal.querySelector("[data-render-replace]")?.addEventListener("click", () => renderToLibrary(true));
    modal.querySelector("[data-render-download]")?.addEventListener("click", downloadRenderedClip);
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
    return modal;
  }

  function updateStatus() {
    const clip = selectedClipForTools();
    const status = ensureModal().querySelector("[data-render-status]");
    if (!status) return;
    if (!clip) {
      status.textContent = "Select a clip to use render tools.";
      return;
    }
    status.textContent = `${clip.name} · ${formatTime(clipDuration(clip))}${clip.reverseAudio ? " · reversed" : ""}`;
  }

  function openModal() {
    const clip = selectedClipForTools();
    if (!clip) return showToast("Select a clip before opening Render tools.");
    const modal = ensureModal();
    updateStatus();
    modal.hidden = false;
  }

  function closeModal() {
    ensureModal().hidden = true;
  }

  function setBusy(nextBusy) {
    busy = Boolean(nextBusy);
    ensureModal().querySelectorAll("button").forEach((button) => { if (!button.matches("[data-render-close]")) button.disabled = busy; });
    updateRenderButtonState();
  }

  function addBufferAsset(buffer, name) {
    const asset = {
      id: makeId("asset"),
      file: null,
      name,
      kind: "RENDERED WAV",
      buffer,
      duration: buffer.duration,
      peaks: makePeaks(buffer)
    };
    state.assets.push(asset);
    state.selectedAssetId = asset.id;
    renderAssets();
    return asset;
  }

  function clearBakedEffects(clip) {
    clip.sourceStart = 0;
    clip.stretchDuration = null;
    clip.volume = 100;
    clip.echo = 0;
    clip.fadeIn = 0;
    clip.fadeOut = 0;
    clip.gate = null;
    clip.bufferOverride = null;
    clip.volumeKeyframes = [];
    clip.reverseAudio = false;
    clip.transposeSemitones = 0;
    clip.eqSettings = null;
    clip.driveSettings = null;
    clip.dynamicsSettings = null;
    clip.stereoSettings = null;
    clip.lofiSettings = null;
  }

  function renderedName(clip, suffix = "rendered") {
    const base = safeFilename(clip?.name || "orgavox-clip");
    return `${base}-${suffix}.wav`;
  }

  async function renderSelectedClip() {
    const clip = selectedClipForTools();
    if (!clip) throw new Error("No clip selected.");
    if (typeof window.orgavoxRenderClipToBuffer !== "function") throw new Error("Render tools engine did not load.");
    return window.orgavoxRenderClipToBuffer(clip);
  }

  function toggleReverse() {
    const clip = selectedClipForTools();
    if (!clip) return;
    stopPlayback();
    clip.reverseAudio = !clip.reverseAudio;
    invalidateClip(clip);
    renderTimeline();
    updateStatus();
    showToast(clip.reverseAudio ? "Clip reversed." : "Clip reverse removed.");
  }

  async function renderToLibrary(replaceClip) {
    const clip = selectedClipForTools();
    if (!clip || busy) return;
    stopPlayback();
    setBusy(true);
    setStatus(replaceClip ? "Rendering selected clip for replacement…" : "Rendering selected clip to library…");
    try {
      const rendered = await renderSelectedClip();
      if (!rendered) throw new Error("The selected clip could not be rendered.");
      const asset = addBufferAsset(rendered, renderedName(clip, replaceClip ? "bounced" : "rendered"));
      if (replaceClip) {
        clip.assetId = asset.id;
        clip.name = asset.name;
        clip.sourceEnd = asset.duration;
        clearBakedEffects(clip);
        invalidateClip(clip);
        selectClip(clip.id);
      }
      renderTimeline();
      updateStatus();
      showToast(replaceClip ? "Clip replaced with rendered copy." : "Rendered clip added to the sound library.");
      setStatus("Ready");
    } catch (error) {
      console.error(error);
      showToast(error.message || "The clip could not be rendered.");
      setStatus("Render failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadRenderedClip() {
    const clip = selectedClipForTools();
    if (!clip || busy) return;
    stopPlayback();
    setBusy(true);
    setStatus("Rendering selected clip WAV…");
    try {
      const rendered = await renderSelectedClip();
      if (!rendered) throw new Error("The selected clip could not be rendered.");
      downloadBlob(audioBufferToWav(rendered), renderedName(clip, "clip"));
      showToast("Rendered clip WAV downloaded.");
      setStatus("Ready");
    } catch (error) {
      console.error(error);
      showToast(error.message || "The clip could not be downloaded.");
      setStatus("Render failed");
    } finally {
      setBusy(false);
    }
  }

  function updateRenderButtonState() {
    const button = ensureButton();
    const clip = selectedClipForTools();
    button.disabled = busy || !clip;
    button.classList.toggle("active", Boolean(clip?.reverseAudio));
    button.textContent = clip?.reverseAudio ? "🔁 Render" : "🧱 Render";
  }

  function addReverseBadges() {
    state.clips.forEach((clip) => {
      if (!clip.reverseAudio) return;
      const clipNode = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
      const badgeBox = clipNode?.querySelector(".clip-effect-badges");
      if (!badgeBox || badgeBox.querySelector(".orgavox-reverse-badge")) return;
      const badge = document.createElement("span");
      badge.className = "orgavox-reverse-badge";
      badge.textContent = "REV";
      badgeBox.appendChild(badge);
    });
  }

  function patchRender() {
    if (window.__orgavoxRenderToolsRenderPatched) return;
    window.__orgavoxRenderToolsRenderPatched = true;
    const previousRenderTimeline = renderTimeline;
    renderTimeline = function orgavoxRenderToolsRenderTimeline() {
      previousRenderTimeline();
      placeButton();
      updateRenderButtonState();
      addReverseBadges();
    };
    const previousSyncSelectedControls = syncSelectedControls;
    syncSelectedControls = function orgavoxRenderToolsSyncSelectedControls() {
      previousSyncSelectedControls();
      updateRenderButtonState();
      updateStatus();
    };
  }

  installStyles();
  ensureButton();
  ensureModal();
  patchRender();
  placeButton();
  updateRenderButtonState();
  renderTimeline();
  setTimeout(() => { placeButton(); updateRenderButtonState(); }, 150);
})();
