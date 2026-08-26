"use strict";

(function installOrgavoxClipTools() {
  const STYLE_ID = "orgavox-clip-tools-style";
  const MODAL_ID = "bounceToolsModal";
  let busy = false;

  function selectedClipForTools() {
    return state.clips.find((clip) => clip.id === state.selectedClipId) || null;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById("orgavox-render-tools-style")?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-clip-tool-button{border-color:rgba(248,215,146,.72)!important;background:linear-gradient(180deg,rgba(93,67,35,.8),rgba(34,23,13,.94))!important;color:#ffe4a8!important}
      .orgavox-download-clip-button{border-color:rgba(117,178,222,.75)!important;background:linear-gradient(180deg,rgba(39,83,125,.78),rgba(15,35,58,.94))!important;color:#dff5ff!important}
      .orgavox-reverse-button.active{border-color:rgba(248,215,146,.9)!important;background:linear-gradient(180deg,rgba(125,88,38,.88),rgba(52,34,16,.95))!important;color:#fff0bd!important}
      .orgavox-bounce-modal{position:fixed;inset:0;z-index:96;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}
      .orgavox-bounce-modal[hidden]{display:none}
      .orgavox-bounce-dialog{width:min(680px,calc(100vw - 42px));max-height:min(680px,calc(100vh - 42px));overflow:auto;padding:20px;border:1px solid rgba(224,163,96,.72);border-radius:22px;background:#1a1c18;box-shadow:0 24px 80px rgba(0,0,0,.78)}
      .orgavox-bounce-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
      .orgavox-bounce-card{display:grid;gap:9px;padding:14px;border:1px solid rgba(137,107,73,.58);border-radius:16px;background:rgba(0,0,0,.2)}
      .orgavox-bounce-card h4{margin:0;color:#f8d792;font:800 .78rem var(--font-body);text-transform:uppercase;letter-spacing:.045em}
      .orgavox-bounce-card p{margin:0;color:rgba(245,240,219,.62);font-size:.69rem;line-height:1.45}
      .orgavox-bounce-status{margin-top:12px;padding:10px 12px;border-radius:12px;background:rgba(117,178,222,.08);color:rgba(245,240,219,.76);font-size:.72rem;line-height:1.45}
      .orgavox-bounce-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:16px}
      .audio-clip .orgavox-reverse-badge{background:rgba(248,215,146,.38);color:#ffe4a8}
      @media(max-width:760px){.orgavox-bounce-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function makeButton(id, label, className, title, handler) {
    const button = document.createElement("button");
    button.id = id;
    button.type = "button";
    button.className = `tool-button ${className}`;
    button.textContent = label;
    button.title = title;
    button.disabled = true;
    button.addEventListener("click", handler);
    return button;
  }

  function ensureButtons() {
    if (!ui.reverseClipBtn) ui.reverseClipBtn = makeButton("reverseClipBtn", "↩ Reverse", "orgavox-clip-tool-button orgavox-reverse-button", "Reverse selected clip", toggleReverse);
    if (!ui.downloadClipBtn) ui.downloadClipBtn = makeButton("downloadClipBtn", "⬇ Clip", "orgavox-download-clip-button", "Download selected clip as WAV or MP3", () => downloadRenderedClip());
    if (!ui.bounceBtn) ui.bounceBtn = makeButton("bounceBtn", "🧱 Bounce Track", "orgavox-clip-tool-button orgavox-bounce-button", "Bounce selected clip or selected track", openBounceModal);
    placeButtons();
    return [ui.reverseClipBtn, ui.downloadClipBtn, ui.bounceBtn];
  }

  function placeButtons() {
    const editGroup = document.querySelector(".orgavox-edit-group");
    const effectsMenu = document.querySelector(".orgavox-effects-menu");
    const viewMenu = document.querySelector("#orgavoxViewDropdown .orgavox-view-menu");
    if (effectsMenu && ui.reverseClipBtn && ui.reverseClipBtn.parentElement !== effectsMenu) effectsMenu.appendChild(ui.reverseClipBtn);
    if (editGroup && ui.downloadClipBtn && ui.downloadClipBtn.parentElement !== editGroup && !document.querySelector("#orgavoxEditDropdown .orgavox-edit-menu")?.contains(ui.downloadClipBtn)) editGroup.appendChild(ui.downloadClipBtn);
    if (viewMenu && ui.bounceBtn && ui.bounceBtn.parentElement !== viewMenu) viewMenu.appendChild(ui.bounceBtn);
  }

  function ensureBounceModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "orgavox-bounce-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="orgavox-bounce-dialog" role="dialog" aria-modal="true" aria-labelledby="bounceToolsTitle">
        <div class="popover-head"><div><span class="eyebrow">Clip tools</span><h3 id="bounceToolsTitle">Bounce Track</h3></div><button class="icon-button" data-bounce-close type="button">×</button></div>
        <p class="export-note">Bounce means bake the selected clip with its current edits and effects applied.</p>
        <div class="orgavox-bounce-status" data-bounce-status>Select a clip to use bounce tools.</div>
        <div class="orgavox-bounce-grid">
          <div class="orgavox-bounce-card"><h4>Bounce to Library</h4><p>Create a new sound-library item from the selected clip, while keeping the original timeline clip unchanged.</p><button class="tool-button" data-bounce-copy type="button">Bounce to Library</button></div>
          <div class="orgavox-bounce-card"><h4>Bounce in Place</h4><p>Replace the selected timeline clip with a clean rendered version and remove the live effects from that new copy.</p><button class="tool-button primary" data-bounce-replace type="button">Bounce in Place</button></div>
        </div>
        <div class="orgavox-bounce-actions"><button class="tool-button" data-bounce-close type="button">Close</button></div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-bounce-close]").forEach((button) => button.addEventListener("click", closeBounceModal));
    modal.querySelector("[data-bounce-copy]")?.addEventListener("click", () => bounceToLibrary(false));
    modal.querySelector("[data-bounce-replace]")?.addEventListener("click", () => bounceToLibrary(true));
    modal.addEventListener("click", (event) => { if (event.target === modal) closeBounceModal(); });
    return modal;
  }

  function updateStatus() {
    const clip = selectedClipForTools();
    const status = ensureBounceModal().querySelector("[data-bounce-status]");
    if (!status) return;
    status.textContent = clip ? `${clip.name} · ${formatTime(clipDuration(clip))}${clip.reverseAudio ? " · reversed" : ""}` : "Select a clip to use bounce tools.";
  }

  function openBounceModal() {
    const clip = selectedClipForTools();
    if (!clip) return showToast("Select a clip before opening Bounce Track.");
    const modal = ensureBounceModal();
    updateStatus();
    modal.hidden = false;
  }

  function closeBounceModal() { ensureBounceModal().hidden = true; }

  function setBusy(nextBusy) {
    busy = Boolean(nextBusy);
    ensureButtons().forEach((button) => { button.disabled = busy || !selectedClipForTools(); });
    ensureBounceModal().querySelectorAll("button").forEach((button) => { if (!button.matches("[data-bounce-close]")) button.disabled = busy; });
    updateClipToolButtonState();
  }

  function addBufferAsset(buffer, name) {
    const asset = { id: makeId("asset"), file: null, name, kind: "BOUNCED WAV", buffer, duration: buffer.duration, peaks: makePeaks(buffer) };
    state.assets.push(asset);
    state.selectedAssetId = asset.id;
    renderAssets();
    return asset;
  }

  function clearBakedEffects(clip) {
    clip.sourceStart = 0; clip.stretchDuration = null; clip.volume = 100; clip.echo = 0; clip.fadeIn = 0; clip.fadeOut = 0; clip.gate = null; clip.bufferOverride = null; clip.volumeKeyframes = []; clip.reverseAudio = false; clip.transposeSemitones = 0; clip.eqSettings = null; clip.driveSettings = null; clip.dynamicsSettings = null; clip.stereoSettings = null; clip.lofiSettings = null;
  }

  function renderedName(clip, suffix = "clip", extension = "wav") { return `${safeFilename(clip?.name || "orgavox-clip")}-${suffix}.${extension}`; }

  async function renderSelectedClip() {
    const clip = selectedClipForTools();
    if (!clip) throw new Error("No clip selected.");
    if (typeof window.orgavoxRenderClipToBuffer !== "function") throw new Error("Clip tools engine did not load.");
    return window.orgavoxRenderClipToBuffer(clip);
  }

  function toggleReverse() {
    const clip = selectedClipForTools();
    if (!clip || busy) return;
    stopPlayback();
    clip.reverseAudio = !clip.reverseAudio;
    invalidateClip(clip);
    renderTimeline();
    updateStatus();
    showToast(clip.reverseAudio ? "Clip reversed." : "Clip reverse removed.");
    window.orgavoxRecordHistory?.();
  }

  async function bounceToLibrary(replaceClip) {
    const clip = selectedClipForTools();
    if (!clip || busy) return;
    stopPlayback();
    setBusy(true);
    setStatus(replaceClip ? "Bouncing selected clip in place…" : "Bouncing selected clip to library…");
    try {
      const rendered = await renderSelectedClip();
      if (!rendered) throw new Error("The selected clip could not be bounced.");
      const asset = addBufferAsset(rendered, renderedName(clip, replaceClip ? "bounce-in-place" : "bounce", "wav"));
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
      closeBounceModal();
      showToast(replaceClip ? "Clip bounced in place." : "Bounced clip added to the sound library.");
      setStatus("Ready");
      window.orgavoxRecordHistory?.();
    } catch (error) {
      console.error(error);
      showToast(error.message || "The clip could not be bounced.");
      setStatus("Bounce failed");
    } finally { setBusy(false); }
  }

  function resolveDownloadFormat(forcedFormat) {
    if (forcedFormat) return /^mp3$/i.test(forcedFormat) ? "mp3" : "wav";
    const answer = prompt("Download selected clip as wav or mp3", "wav");
    if (answer == null) return null;
    return /^mp3$/i.test(answer.trim()) ? "mp3" : "wav";
  }

  async function downloadRenderedClip(forcedFormat) {
    const clip = selectedClipForTools();
    if (!clip || busy) return;
    const format = resolveDownloadFormat(forcedFormat);
    if (!format) return;
    stopPlayback();
    setBusy(true);
    setStatus(format === "mp3" ? "Rendering selected clip MP3…" : "Rendering selected clip WAV…");
    try {
      const rendered = await renderSelectedClip();
      if (!rendered) throw new Error("The selected clip could not be rendered.");
      const blob = format === "mp3" ? audioBufferToMp3(rendered, 192) : audioBufferToWav(rendered);
      downloadBlob(blob, renderedName(clip, "clip", format));
      showToast(`Selected clip ${format.toUpperCase()} downloaded.`);
      setStatus("Ready");
    } catch (error) {
      console.error(error);
      showToast(error.message || "The clip could not be downloaded.");
      setStatus("Download failed");
    } finally { setBusy(false); }
  }

  function updateClipToolButtonState() {
    const clip = selectedClipForTools();
    const disabled = busy || !clip;
    ensureButtons().forEach((button) => { button.disabled = disabled; });
    if (ui.reverseClipBtn) { ui.reverseClipBtn.classList.toggle("active", Boolean(clip?.reverseAudio)); ui.reverseClipBtn.textContent = clip?.reverseAudio ? "🔁 Unreverse" : "↩ Reverse"; }
    if (ui.downloadClipBtn) ui.downloadClipBtn.textContent = "⬇ Clip";
    if (ui.bounceBtn) ui.bounceBtn.textContent = "🧱 Bounce Track";
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
    renderTimeline = function orgavoxClipToolsRenderTimeline() {
      previousRenderTimeline();
      placeButtons();
      updateClipToolButtonState();
      addReverseBadges();
    };
    const previousSyncSelectedControls = syncSelectedControls;
    syncSelectedControls = function orgavoxClipToolsSyncSelectedControls() {
      previousSyncSelectedControls();
      updateClipToolButtonState();
      updateStatus();
    };
  }

  window.orgavoxToggleReverseSelectedClip = toggleReverse;
  window.orgavoxDownloadSelectedClip = downloadRenderedClip;
  window.orgavoxPlaceClipRenderButtons = placeButtons;
  installStyles();
  ensureButtons();
  ensureBounceModal();
  patchRender();
  placeButtons();
  updateClipToolButtonState();
  renderTimeline();
  [150, 500, 1200, 2200].forEach((delay) => setTimeout(() => { placeButtons(); updateClipToolButtonState(); }, delay));
})();