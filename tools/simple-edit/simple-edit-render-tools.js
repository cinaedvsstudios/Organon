"use strict";

(function installOrgavoxRenderTools() {
  const BOUNCE_MODAL_ID = "bounceToolsModal";
  const DOWNLOAD_MODAL_ID = "downloadClipModal";
  const STYLE_ID = "orgavoxRenderToolsStyles";
  let busy = false;

  function selectedClipForTools() { return selectedClip?.() || null; }
  function renderedName(clip, suffix = "clip", extension = "wav") { return `${safeFilename(clip?.name || "orgavox-clip")}-${suffix}.${extension}`; }
  function masterGainValue() { return Math.max(0, Math.min(2, Number(state.globalVolume ?? 100) / 100)); }
  function copyBufferWithGain(buffer, gain = 1) {
    if (!buffer || Math.abs(gain - 1) < 0.0001) return buffer;
    const context = audioContext || window.__orgavoxAudioContext || null;
    if (!context?.createBuffer) return buffer;
    const output = context.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const input = buffer.getChannelData(channel);
      const data = output.getChannelData(channel);
      for (let index = 0; index < input.length; index += 1) data[index] = Math.max(-1, Math.min(1, input[index] * gain));
    }
    return output;
  }
  function renderedForFile(buffer) { return copyBufferWithGain(buffer, masterGainValue()); }

  function audioBufferToWav(buffer) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const sampleRate = buffer.sampleRate;
    const frames = buffer.length;
    const blockAlign = channels * 2;
    const dataSize = frames * blockAlign;
    const view = new DataView(new ArrayBuffer(44 + dataSize));
    const str = (offset, text) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
    str(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    str(8, "WAVE");
    str(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    str(36, "data");
    view.setUint32(40, dataSize, true);
    const data = [];
    for (let channel = 0; channel < channels; channel += 1) data.push(buffer.getChannelData(channel));
    let offset = 44;
    for (let frame = 0; frame < frames; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = Math.max(-1, Math.min(1, data[channel][frame] || 0));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([view], { type: "audio/wav" });
  }

  function floatToInt16(input, start, count) {
    const output = new Int16Array(count);
    for (let index = 0; index < count; index += 1) {
      const value = Math.max(-1, Math.min(1, input[start + index] || 0));
      output[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
    }
    return output;
  }

  function audioBufferToMp3(buffer, bitrate) {
    if (!window.lamejs?.Mp3Encoder) throw new Error("The MP3 encoder did not load. Use WAV for this clip.");
    const sampleRate = buffer.sampleRate;
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    const encoder = new lamejs.Mp3Encoder(2, sampleRate, bitrate);
    const chunks = [];
    const block = 1152;
    for (let start = 0; start < buffer.length; start += block) {
      const count = Math.min(block, buffer.length - start);
      const encoded = encoder.encodeBuffer(floatToInt16(left, start, count), floatToInt16(right, start, count));
      if (encoded.length) chunks.push(new Int8Array(encoded));
    }
    const end = encoder.flush();
    if (end.length) chunks.push(new Int8Array(end));
    return new Blob(chunks, { type: "audio/mpeg" });
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function savePickerOptions(filename, format) {
    const mp3 = format === "mp3";
    return {
      suggestedName: filename,
      types: [{
        description: mp3 ? "MP3 audio" : "WAV audio",
        accept: { [mp3 ? "audio/mpeg" : "audio/wav"]: [mp3 ? ".mp3" : ".wav"] }
      }]
    };
  }

  async function saveBlobWithPicker(blob, filename, format) {
    if (!("showSaveFilePicker" in window)) { downloadBlob(blob, filename); return false; }
    const handle = await window.showSaveFilePicker(savePickerOptions(filename, format));
    const writable = await handle.createWritable();
    try {
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      try { await writable.abort(); } catch {}
      throw error;
    }
  }

  async function renderSelectedClip() {
    const clip = selectedClipForTools();
    if (!clip) throw new Error("No clip selected.");
    if (typeof window.orgavoxRenderClipToBuffer === "function") return window.orgavoxRenderClipToBuffer(clip);
    const buffer = clipBuffer(clip);
    if (!buffer) throw new Error("The selected clip has no audio buffer.");
    return buffer;
  }

  async function renderSelectedClipForFile() {
    return renderedForFile(await renderSelectedClip());
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .orgavox-bounce-modal,.orgavox-download-modal{position:fixed!important;inset:0!important;z-index:999998!important;display:grid!important;place-items:center!important;padding:24px!important;background:rgba(0,0,0,.6)!important;color:#f5f0db!important}
      .orgavox-bounce-modal[hidden],.orgavox-download-modal[hidden]{display:none!important}
      .orgavox-bounce-dialog,.orgavox-download-dialog{width:min(720px,calc(100vw - 40px))!important;max-height:min(700px,calc(100vh - 40px))!important;overflow:auto!important;display:grid!important;gap:14px!important;padding:16px!important;border:1px solid rgba(224,163,96,.72)!important;border-radius:18px!important;background:linear-gradient(180deg,rgba(24,25,24,.98),rgba(10,11,10,.99))!important;box-shadow:0 22px 64px rgba(0,0,0,.76)!important}
      .orgavox-bounce-status{padding:9px 10px!important;border:1px solid rgba(117,178,222,.32)!important;border-radius:12px!important;background:rgba(117,178,222,.08)!important;color:#dff5ff!important;font:800 .74rem var(--font-mono,monospace)!important}
      .orgavox-bounce-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}
      .orgavox-bounce-card{display:grid!important;gap:8px!important;padding:12px!important;border:1px solid rgba(224,163,96,.28)!important;border-radius:14px!important;background:rgba(0,0,0,.24)!important}
      .orgavox-bounce-card h4{margin:0!important;color:#75b2de!important}.orgavox-bounce-card p{margin:0!important;color:rgba(245,240,219,.64)!important;line-height:1.35!important}
      .orgavox-bounce-actions,.orgavox-download-actions{display:flex!important;justify-content:flex-end!important;gap:8px!important;flex-wrap:wrap!important}
      .orgavox-download-grid{display:grid!important;gap:10px!important}.orgavox-download-grid label{display:grid!important;gap:5px!important;color:rgba(245,240,219,.72)!important;font:800 .64rem var(--font-mono,monospace)!important;text-transform:uppercase!important;letter-spacing:.08em!important}.orgavox-download-grid input,.orgavox-download-grid select{height:36px!important;border:1px solid rgba(117,178,222,.58)!important;border-radius:10px!important;background:#050505!important;color:#f5f0db!important;padding:0 10px!important;font:800 .78rem var(--font-body,system-ui)!important}
      @media(max-width:720px){.orgavox-bounce-grid{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureDownloadModal() {
    let modal = document.getElementById(DOWNLOAD_MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = DOWNLOAD_MODAL_ID;
    modal.className = "orgavox-download-modal";
    modal.hidden = true;
    modal.innerHTML = `<section class="orgavox-download-dialog" role="dialog" aria-modal="true" aria-labelledby="downloadClipTitle"><div class="popover-head"><div><span class="eyebrow">Render selected clip</span><h3 id="downloadClipTitle">Download Clip</h3></div><button class="icon-button" data-download-close type="button">×</button></div><div class="orgavox-download-grid"><label>Filename<input id="downloadClipName" type="text" value="orgavox-clip"></label><label>Format<select id="downloadClipFormat"><option value="wav" selected>WAV — lossless</option><option value="mp3">MP3</option></select></label><label id="downloadClipBitrateField" hidden>MP3 bitrate<select id="downloadClipBitrate"><option value="128">128 kbps</option><option value="192" selected>192 kbps</option><option value="256">256 kbps</option><option value="320">320 kbps</option></select></label><p class="export-note" id="downloadClipNote">WAV keeps the rendered clip uncompressed. Download Clip includes the current master volume. Chrome/Edge can ask where to save using the File System Access API; other browsers will use normal download.</p></div><div class="orgavox-download-actions"><button class="tool-button" data-download-close type="button">Cancel</button><button class="tool-button primary" id="downloadClipConfirmBtn" type="button">Render WAV</button></div></section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-download-close]").forEach((button) => button.addEventListener("click", closeDownloadModal));
    modal.querySelector("#downloadClipFormat")?.addEventListener("change", updateDownloadFormat);
    modal.querySelector("#downloadClipConfirmBtn")?.addEventListener("click", confirmDownloadClip);
    modal.addEventListener("pointerdown", (event) => { if (event.target === modal) closeDownloadModal(); });
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeDownloadModal(); }
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); confirmDownloadClip(); }
    });
    return modal;
  }

  function updateDownloadFormat() {
    const modal = ensureDownloadModal();
    const format = modal.querySelector("#downloadClipFormat")?.value || "wav";
    const mp3 = format === "mp3";
    modal.querySelector("#downloadClipBitrateField").hidden = !mp3;
    modal.querySelector("#downloadClipConfirmBtn").textContent = mp3 ? "Render MP3" : "Render WAV";
    modal.querySelector("#downloadClipNote").textContent = mp3
      ? "MP3 creates a smaller compressed file using the selected bitrate and includes the current master volume. Chrome/Edge can ask where to save; other browsers will use normal download."
      : "WAV keeps the rendered clip uncompressed and includes the current master volume. Chrome/Edge can ask where to save; other browsers will use normal download.";
  }

  function openDownloadDialog() {
    const clip = selectedClipForTools();
    if (!clip || busy) { showToast("Select a clip before downloading."); return; }
    const modal = ensureDownloadModal();
    modal.querySelector("#downloadClipName").value = safeFilename(clip.name || "orgavox-clip");
    modal.hidden = false;
    updateDownloadFormat();
    setTimeout(() => { const input = modal.querySelector("#downloadClipName"); input?.focus(); input?.select(); }, 0);
  }

  function closeDownloadModal() { ensureDownloadModal().hidden = true; }

  async function confirmDownloadClip() {
    const clip = selectedClipForTools();
    const modal = ensureDownloadModal();
    if (!clip || busy) { showToast("Select a clip before downloading."); return; }
    const format = modal.querySelector("#downloadClipFormat")?.value === "mp3" ? "mp3" : "wav";
    const extension = format === "mp3" ? "mp3" : "wav";
    const bitrate = Math.max(128, Math.min(320, Number(modal.querySelector("#downloadClipBitrate")?.value) || 192));
    const baseName = safeFilename(modal.querySelector("#downloadClipName")?.value || clip.name || "orgavox-clip").replace(/\.(wav|mp3)$/i, "");
    const filename = `${baseName}.${extension}`;
    busy = true;
    stopPlayback();
    setStatus("Rendering selected clip…");
    try {
      const rendered = await renderSelectedClipForFile();
      setStatus(format === "mp3" ? "Encoding MP3…" : "Encoding WAV…");
      const blob = format === "mp3" ? audioBufferToMp3(rendered, bitrate) : audioBufferToWav(rendered);
      const picked = await saveBlobWithPicker(blob, filename, format);
      closeDownloadModal();
      showToast(picked ? `${filename} saved.` : `${filename} downloaded.`);
      setStatus("Ready");
    } catch (error) {
      if (error?.name === "AbortError") { setStatus("Ready"); return; }
      console.error(error);
      showToast(error.message || "The selected clip could not be downloaded.");
      setStatus("Clip download failed");
    } finally {
      busy = false;
      wireControls();
    }
  }

  function toggleReverse() {
    const clip = selectedClipForTools();
    if (!clip || busy) return showToast("Select a clip first.");
    stopPlayback();
    clip.reverseAudio = !clip.reverseAudio;
    invalidateClip?.(clip);
    renderTimeline();
    window.orgavoxRecordHistory?.();
    showToast(clip.reverseAudio ? "Clip reversed." : "Clip reverse removed.");
  }

  function ensureBounceModal() {
    let modal = document.getElementById(BOUNCE_MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = BOUNCE_MODAL_ID;
    modal.className = "orgavox-bounce-modal";
    modal.hidden = true;
    modal.innerHTML = `<section class="orgavox-bounce-dialog" role="dialog" aria-modal="true" aria-labelledby="bounceToolsTitle"><div class="popover-head"><div><span class="eyebrow">Clip tools</span><h3 id="bounceToolsTitle">Bounce Track</h3></div><button class="icon-button" data-bounce-close type="button">×</button></div><p class="export-note">Bounce means bake the selected clip with its current edits and effects applied.</p><div class="orgavox-bounce-status" data-bounce-status>Select a clip to use bounce tools.</div><div class="orgavox-bounce-grid"><div class="orgavox-bounce-card"><h4>Bounce to Library</h4><p>Create a new sound-library item from the selected clip.</p><button class="tool-button" data-bounce-copy type="button">Bounce to Library</button></div><div class="orgavox-bounce-card"><h4>Bounce in Place</h4><p>Replace the selected timeline clip with a rendered copy.</p><button class="tool-button primary" data-bounce-replace type="button">Bounce in Place</button></div><div class="orgavox-bounce-card"><h4>Bounce to File</h4><p>Render the selected clip to a WAV/MP3 file and choose where it goes.</p><button class="tool-button" data-bounce-file type="button">Bounce to File…</button></div></div><div class="orgavox-bounce-actions"><button class="tool-button" data-bounce-close type="button">Close</button></div></section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-bounce-close]").forEach((button) => button.addEventListener("click", closeBounceModal));
    modal.querySelector("[data-bounce-copy]")?.addEventListener("click", () => bounceToLibrary(false));
    modal.querySelector("[data-bounce-replace]")?.addEventListener("click", () => bounceToLibrary(true));
    modal.querySelector("[data-bounce-file]")?.addEventListener("click", () => { closeBounceModal(); openDownloadDialog(); });
    modal.addEventListener("pointerdown", (event) => { if (event.target === modal) closeBounceModal(); });
    modal.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); closeBounceModal(); } });
    return modal;
  }

  function updateStatus() {
    const clip = selectedClipForTools();
    const status = ensureBounceModal().querySelector("[data-bounce-status]");
    if (status) status.textContent = clip ? `${clip.name} · ${formatTime(clipDuration(clip))}${clip.reverseAudio ? " · reversed" : ""}` : "Select a clip to use bounce tools.";
  }
  function openBounceModal() {
    const clip = selectedClipForTools();
    if (!clip) { showToast("Select a clip before opening Bounce Track."); return; }
    const modal = ensureBounceModal();
    updateStatus();
    modal.hidden = false;
  }
  function closeBounceModal() { ensureBounceModal().hidden = true; }

  function addBufferAsset(buffer, name) {
    const asset = { id: makeId("asset"), file: null, name, kind: "BOUNCED WAV", buffer, duration: buffer.duration, peaks: makePeaks(buffer) };
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
    clip.echoSettings = null;
  }

  async function bounceToLibrary(replaceClip) {
    const clip = selectedClipForTools();
    if (!clip || busy) return;
    busy = true;
    stopPlayback();
    setStatus(replaceClip ? "Bouncing selected clip in place…" : "Bouncing selected clip to library…");
    try {
      const rendered = await renderSelectedClip();
      const asset = addBufferAsset(rendered, renderedName(clip, replaceClip ? "bounce-in-place" : "bounce", "wav"));
      if (replaceClip) {
        clip.assetId = asset.id;
        clip.name = asset.name;
        clip.sourceEnd = asset.duration;
        clearBakedEffects(clip);
        invalidateClip?.(clip);
        selectClip(clip.id);
      }
      renderTimeline();
      updateStatus();
      closeBounceModal();
      window.orgavoxRecordHistory?.();
      showToast(replaceClip ? "Clip bounced in place." : "Bounced clip added to the sound library.");
      setStatus("Ready");
    } catch (error) {
      console.error(error);
      showToast(error.message || "The clip could not be bounced.");
      setStatus("Bounce failed");
    } finally {
      busy = false;
      wireControls();
    }
  }

  function wireControls() {
    const download = document.getElementById("downloadClipBtn");
    const reverse = document.getElementById("reverseClipBtn");
    const bounce = document.getElementById("bounceBtn");
    const hasClip = Boolean(selectedClipForTools());
    [download, reverse, bounce].filter(Boolean).forEach((button) => { button.disabled = !hasClip || busy; });
    if (reverse) reverse.classList.toggle("active", Boolean(selectedClipForTools()?.reverseAudio));
  }

  installStyles();
  window.orgavoxDownloadClip = openDownloadDialog;
  window.orgavoxDownloadSelectedClip = openDownloadDialog;
  window.orgavoxToggleReverseClip = toggleReverse;
  window.orgavoxOpenBounceTrack = openBounceModal;
  window.orgavoxWireRenderToolControls = wireControls;
  setTimeout(wireControls, 0);
})();
