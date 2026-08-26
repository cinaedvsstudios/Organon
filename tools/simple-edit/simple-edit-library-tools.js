"use strict";

(function installOrgavoxLibraryTools() {
  const STYLE_ID = "orgavox-library-tools-style";
  const EXTENDED_ACCEPT = [
    "audio/*", "video/*", ".mp3", ".wav", ".wave", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".flac", ".aif", ".aiff", ".caf", ".weba",
    ".mp4", ".m4v", ".mov", ".webm", ".mkv", ".3gp", ".3g2", ".mpeg", ".mpg", ".avi"
  ].join(",");
  let previewSource = null;
  let previewAssetId = null;

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .library-panel{
        position:relative!important;
        display:flex!important;
        flex-direction:column!important;
      }
      body.simple-edit-phase1 .library-panel.orgavox-library-dragover{
        outline:2px solid rgba(117,178,222,.76)!important;
        outline-offset:-5px!important;
        box-shadow:inset 0 0 28px rgba(117,178,222,.18)!important;
      }
      body.simple-edit-phase1 .library-help{display:none!important}
      body.simple-edit-phase1 #dropzone.dropzone{
        width:100%!important;
        min-height:172px!important;
        margin:0 0 12px 0!important;
        display:grid!important;
        place-items:center!important;
        gap:6px!important;
        padding:18px!important;
        border-style:dashed!important;
        border-color:rgba(117,178,222,.62)!important;
        background:linear-gradient(180deg,rgba(117,178,222,.12),rgba(0,0,0,.16))!important;
      }
      body.simple-edit-phase1 #dropzone.dropzone strong{
        color:#f8d792!important;
        font:900 .86rem var(--font-body)!important;
        letter-spacing:.05em!important;
        text-transform:uppercase!important;
      }
      body.simple-edit-phase1 #dropzone.dropzone span{display:none!important}
      body.simple-edit-phase1 #dropzone.orgavox-dropzone-hidden{
        display:none!important;
      }
      body.simple-edit-phase1 .asset-list{
        flex:1 1 auto!important;
        min-height:0!important;
      }
      body.simple-edit-phase1 .asset-item{
        grid-template-columns:42px minmax(0,1fr) 26px 30px!important;
        gap:7px!important;
        align-items:center!important;
      }
      body.simple-edit-phase1 .asset-add{
        width:24px!important;
        min-width:24px!important;
        height:24px!important;
        min-height:24px!important;
        padding:0!important;
        border-radius:8px!important;
        font-size:.75rem!important;
        line-height:1!important;
      }
      body.simple-edit-phase1 .asset-preview{
        width:30px!important;
        min-width:30px!important;
        height:24px!important;
        min-height:24px!important;
        padding:0!important;
        border:1px solid rgba(117,178,222,.62)!important;
        border-radius:8px!important;
        background:linear-gradient(180deg,rgba(37,91,138,.85),rgba(13,36,62,.96))!important;
        color:#e1f7ff!important;
        font:900 .65rem var(--font-mono)!important;
        cursor:pointer!important;
      }
      body.simple-edit-phase1 .asset-preview.active{
        border-color:rgba(248,215,146,.88)!important;
        background:linear-gradient(180deg,rgba(130,87,32,.92),rgba(55,35,14,.96))!important;
        color:#fff0bd!important;
        box-shadow:0 0 14px rgba(248,215,146,.24)!important;
      }
      body.simple-edit-phase1 .asset-meta .orgavox-asset-codec-note{
        color:#75b2de!important;
      }
    `;
    document.head.appendChild(style);
  }

  function setAccept() {
    if (ui.fileInput) ui.fileInput.accept = EXTENDED_ACCEPT;
    window.orgavoxAcceptedMediaTypes = EXTENDED_ACCEPT;
  }

  function hasFiles(event) {
    return [...(event.dataTransfer?.types || [])].includes("Files");
  }

  function installLibraryDropTarget() {
    const panel = document.querySelector(".library-panel");
    if (!panel || panel.dataset.orgavoxLibraryDrop === "true") return;
    panel.dataset.orgavoxLibraryDrop = "true";

    panel.addEventListener("dragover", (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      panel.classList.add("orgavox-library-dragover");
    }, true);

    panel.addEventListener("dragleave", (event) => {
      if (!panel.contains(event.relatedTarget)) panel.classList.remove("orgavox-library-dragover");
    }, true);

    panel.addEventListener("drop", (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      panel.classList.remove("orgavox-library-dragover");
      importFiles(event.dataTransfer.files);
    }, true);
  }

  function cleanCopy() {
    const dropzone = ui.dropzone || document.getElementById("dropzone");
    if (dropzone) {
      const strong = dropzone.querySelector("strong");
      if (strong) strong.textContent = "Drop audio or video here";
      const span = dropzone.querySelector("span");
      if (span) span.textContent = "";
      dropzone.title = "Drop or choose audio/video files. Browser-supported video imports audio only.";
    }
    document.querySelectorAll(".library-help").forEach((node) => node.remove());
  }

  function updateDropzoneState() {
    const dropzone = ui.dropzone || document.getElementById("dropzone");
    const hasAssets = Boolean(state.assets?.length);
    if (!dropzone) return;
    dropzone.classList.toggle("orgavox-dropzone-hidden", hasAssets);
    dropzone.classList.toggle("orgavox-dropzone-expanded", !hasAssets);
  }

  function stopPreview() {
    if (previewSource) {
      try { previewSource.stop(); } catch {}
      try { previewSource.disconnect(); } catch {}
    }
    previewSource = null;
    previewAssetId = null;
    updatePreviewButtons();
  }

  async function previewAsset(assetId) {
    const asset = state.assets.find((item) => item.id === assetId);
    if (!asset?.buffer || !audioContext) return;
    if (previewAssetId === assetId) {
      stopPreview();
      return;
    }
    stopPlayback(false);
    stopPreview();
    await audioContext.resume();
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = asset.buffer;
    gain.gain.value = Math.max(0, Math.min(1.6, Number(state.globalVolume ?? 100) / 100)) * 0.85;
    source.connect(gain);
    gain.connect(audioContext.destination);
    source.addEventListener("ended", () => {
      if (previewSource === source) {
        previewSource = null;
        previewAssetId = null;
        updatePreviewButtons();
      }
    }, { once: true });
    previewSource = source;
    previewAssetId = assetId;
    source.start();
    updatePreviewButtons();
    setStatus(`Previewing ${asset.name}`);
  }

  function updatePreviewButtons() {
    document.querySelectorAll(".asset-preview").forEach((button) => {
      const active = button.dataset.assetId === previewAssetId;
      button.classList.toggle("active", active);
      button.textContent = active ? "■" : "▶";
      button.title = active ? "Stop preview" : "Preview source audio";
    });
  }

  function addPreviewButtons() {
    document.querySelectorAll(".asset-item[data-asset-id]").forEach((item) => {
      const assetId = item.dataset.assetId;
      const add = item.querySelector(".asset-add");
      if (add) {
        add.textContent = "+";
        add.title = add.title || "Add this source to the selected track";
      }
      if (item.querySelector(".asset-preview")) return;
      const preview = document.createElement("button");
      preview.type = "button";
      preview.className = "asset-preview";
      preview.dataset.assetId = assetId;
      preview.textContent = "▶";
      preview.title = "Preview source audio";
      preview.addEventListener("click", (event) => {
        event.stopPropagation();
        previewAsset(assetId);
      });
      if (add) item.insertBefore(preview, add.nextSibling);
      else item.appendChild(preview);
    });
    updatePreviewButtons();
  }

  function patchRenderAssets() {
    if (window.__orgavoxLibraryRenderPatched) return;
    window.__orgavoxLibraryRenderPatched = true;
    const previousRenderAssets = renderAssets;
    renderAssets = function orgavoxLibraryRenderAssets() {
      const result = previousRenderAssets.apply(this, arguments);
      cleanCopy();
      updateDropzoneState();
      addPreviewButtons();
      return result;
    };
  }

  function patchImport() {
    if (window.__orgavoxLibraryImportPatched) return;
    window.__orgavoxLibraryImportPatched = true;
    const previousImportFiles = importFiles;
    importFiles = async function orgavoxLibraryImportFiles(fileList) {
      setAccept();
      const result = await previousImportFiles.apply(this, arguments);
      cleanCopy();
      updateDropzoneState();
      addPreviewButtons();
      return result;
    };
  }

  function refresh() {
    setAccept();
    installLibraryDropTarget();
    cleanCopy();
    updateDropzoneState();
    addPreviewButtons();
  }

  window.orgavoxRefreshLibraryTools = refresh;
  window.orgavoxStopAssetPreview = stopPreview;

  installStyles();
  setAccept();
  installLibraryDropTarget();
  patchRenderAssets();
  patchImport();
  refresh();
  setTimeout(refresh, 150);
})();
