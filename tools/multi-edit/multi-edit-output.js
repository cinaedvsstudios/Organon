"use strict";

(() => {
  const formatConfig = {
    png: { mime: "image/png", extension: "png", label: "PNG", plural: "PNGs", supportsQuality: false },
    jpeg: { mime: "image/jpeg", extension: "jpg", label: "JPEG", plural: "JPEGs", supportsQuality: true },
    webp: { mime: "image/webp", extension: "webp", label: "WebP", plural: "WebPs", supportsQuality: true }
  };

  state.output = {
    format: "png",
    quality: 92,
    jpegBackground: "#000000"
  };

  Object.assign(ui, {
    contrast: $("#contrast"),
    opacity: $("#opacity"),
    contrastOut: $("#contrastOut"),
    opacityOut: $("#opacityOut"),
    outputFormat: $("#outputFormat"),
    outputQuality: $("#outputQuality"),
    outputQualityOut: $("#outputQualityOut"),
    outputQualityItem: $("#outputQualityItem"),
    outputFormatNote: $("#outputFormatNote"),
    jpegBackgroundRow: $("#jpegBackgroundRow"),
    jpegBackground: $("#jpegBackground"),
    jpegBackgroundHex: $("#jpegBackgroundHex")
  });

  const originalMakeDefaultAdjustments = makeDefaultAdjustments;
  makeDefaultAdjustments = function makeDefaultAdjustmentsWithContrastAndOpacity() {
    return {
      ...originalMakeDefaultAdjustments(),
      contrast: 100,
      opacity: 100
    };
  };

  adjustmentControls.push(
    ["contrast", ui.contrast, ui.contrastOut, "%"],
    ["opacity", ui.opacity, ui.opacityOut, "%"]
  );

  const originalSetUiDisabled = setUiDisabled;
  setUiDisabled = function setUiDisabledWithNewControls(disabled) {
    originalSetUiDisabled(disabled);
    ui.contrast.disabled = disabled;
    ui.opacity.disabled = disabled;
  };

  const originalBuildProcessedSource = buildProcessedSource;
  buildProcessedSource = function buildProcessedSourceWithContrastAndOpacity(asset) {
    const canvas = originalBuildProcessedSource(asset);
    const adjustments = getEffectiveSettings(asset)?.adjustments || {};
    const contrast = Number(adjustments.contrast ?? 100) / 100;
    const opacity = Number(adjustments.opacity ?? 100) / 100;

    if (contrast === 1 && opacity === 1) return canvas;

    const imageData = sourceCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (contrast !== 1) {
        data[i] = clampByte(128 + (data[i] - 128) * contrast);
        data[i + 1] = clampByte(128 + (data[i + 1] - 128) * contrast);
        data[i + 2] = clampByte(128 + (data[i + 2] - 128) * contrast);
      }
      if (opacity !== 1) data[i + 3] = clampByte(data[i + 3] * opacity);
    }

    sourceCtx.putImageData(imageData, 0, 0);
    return canvas;
  };

  function currentFormat() {
    return formatConfig[state.output.format] || formatConfig.png;
  }

  function outputQuality() {
    return Math.max(.1, Math.min(1, Number(state.output.quality) / 100));
  }

  function outputBaseName(asset) {
    return safeBaseName(asset?.exportName || asset?.originalName || "image");
  }

  getExportName = function getExportNameForSelectedFormat(asset) {
    return `${outputBaseName(asset)}.${currentFormat().extension}`;
  };

  const jpegCanvas = document.createElement("canvas");
  const jpegContext = jpegCanvas.getContext("2d", { alpha: false });

  function canvasForExport(canvas) {
    if (state.output.format !== "jpeg") return canvas;
    jpegCanvas.width = canvas.width;
    jpegCanvas.height = canvas.height;
    jpegContext.save();
    jpegContext.fillStyle = state.output.jpegBackground;
    jpegContext.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
    jpegContext.drawImage(canvas, 0, 0);
    jpegContext.restore();
    return jpegCanvas;
  }

  async function makeExportBlob(canvas) {
    const format = currentFormat();
    const prepared = canvasForExport(canvas);
    const blob = await blobFromCanvas(
      prepared,
      format.mime,
      format.supportsQuality ? outputQuality() : undefined
    );

    if (!blob) return null;
    if (format.mime !== "image/png" && blob.type && blob.type !== format.mime) {
      throw new Error(`${format.label} encoding is unavailable in this browser.`);
    }
    return blob;
  }

  function updateOutputButtons() {
    const format = currentFormat();
    ui.exportCurrentBtn.textContent = `Export ${format.label}`;
    ui.outputExportBtn.textContent = `Export ${format.label}`;
    ui.exportAllBtn.textContent = `Export all ${format.plural} (.zip)`;
  }

  function updateFormatControls() {
    const format = currentFormat();
    const qualityEnabled = format.supportsQuality;

    ui.outputQuality.disabled = !qualityEnabled;
    ui.outputQualityItem.classList.toggle("disabled", !qualityEnabled);
    ui.outputQualityOut.textContent = qualityEnabled ? `${state.output.quality}%` : "Lossless";
    ui.jpegBackgroundRow.hidden = state.output.format !== "jpeg";

    if (state.output.format === "png") {
      ui.outputFormatNote.textContent = "PNG is lossless, so the quality control is not used.";
    } else if (state.output.format === "jpeg") {
      ui.outputFormatNote.textContent = "Lower quality makes smaller JPEG files. Transparent pixels are filled with the selected background colour.";
    } else {
      ui.outputFormatNote.textContent = "Lower quality makes smaller WebP files. WebP keeps transparency.";
    }

    updateOutputButtons();
    renderDeck();
    syncUiFromActive();
  }

  const originalUpdateOutputReadout = updateOutputReadout;
  updateOutputReadout = function updateOutputReadoutWithFormat() {
    originalUpdateOutputReadout();
    if (!getActiveAsset()) return;
    const format = currentFormat();
    const suffix = format.supportsQuality ? `${format.label} ${state.output.quality}%` : `${format.label} lossless`;
    ui.outputReadout.textContent += ` · ${suffix}`;
  };

  const oldExportCurrent = exportCurrent;
  const oldOverwriteCurrent = overwriteCurrent;
  const oldExportAll = exportAll;
  const oldApplyRenameSequence = applyRenameSequence;
  const oldSaveRenameSequence = saveRenameSequence;

  ui.exportCurrentBtn.removeEventListener("click", oldExportCurrent);
  ui.outputExportBtn.removeEventListener("click", oldExportCurrent);
  ui.overwriteBtn.removeEventListener("click", oldOverwriteCurrent);
  ui.exportAllBtn.removeEventListener("click", oldExportAll);
  ui.applySequenceNameBtn.removeEventListener("click", oldApplyRenameSequence);
  ui.renameSaveBtn.removeEventListener("click", oldSaveRenameSequence);

  exportCurrent = async function exportCurrentInSelectedFormat() {
    const asset = getActiveAsset();
    if (!asset) return;

    try {
      const blob = await makeExportBlob(renderOutput(asset));
      if (!blob) throw new Error("No export blob was produced.");
      downloadBlob(blob, getExportName(asset));
      toast(`${getExportName(asset)} exported.`, "↓");
    } catch (error) {
      console.error(error);
      toast(error.message || "The image could not be exported.", "⚠️");
    }
  };

  overwriteCurrent = async function overwriteCurrentInSelectedFormat() {
    const asset = getActiveAsset();
    if (!asset) return;

    try {
      const blob = await makeExportBlob(renderOutput(asset));
      if (!blob) throw new Error("No export blob was produced.");

      const nextUrl = URL.createObjectURL(blob);
      const nextImg = new Image();
      nextImg.decoding = "async";
      nextImg.src = nextUrl;
      await nextImg.decode().catch(() => null);
      if (!nextImg.naturalWidth) {
        URL.revokeObjectURL(nextUrl);
        throw new Error("The overwritten image could not be reloaded.");
      }

      URL.revokeObjectURL(asset.url);
      asset.url = nextUrl;
      asset.img = nextImg;
      asset.exportName = getExportName(asset);
      asset.file = new File([blob], asset.exportName, { type: currentFormat().mime });
      asset.naturalWidth = nextImg.naturalWidth;
      asset.naturalHeight = nextImg.naturalHeight;

      asset.override = true;
      asset.overrideSettings = makeSettings(asset.naturalWidth, asset.naturalHeight);
      asset.overrideDraft = clone(asset.overrideSettings.resize);
      state.draft = asset.overrideDraft;

      renderDeck();
      syncUiFromActive();
      renderPreview();
      toast(`Selected image overwritten as ${currentFormat().label} and protected with an override.`, "✓");
    } catch (error) {
      console.error(error);
      toast(error.message || "The selected image could not be overwritten.", "⚠️");
    }
  };

  function uniqueOutputName(asset, usedNames) {
    const format = currentFormat();
    const base = outputBaseName(asset);
    let candidate = `${base}.${format.extension}`;
    let index = 2;

    while (usedNames.has(candidate.toLowerCase())) {
      candidate = `${base}_${String(index).padStart(2, "0")}.${format.extension}`;
      index += 1;
    }

    usedNames.add(candidate.toLowerCase());
    return candidate;
  }

  exportAll = async function exportAllInSelectedFormat() {
    if (!state.assets.length) return;
    if (typeof JSZip === "undefined") {
      toast("ZIP support is unavailable in this browser.", "⚠️");
      return;
    }

    const originalActive = state.activeId;
    const zip = new JSZip();
    const usedNames = new Set();
    const originalLabel = ui.exportAllBtn.textContent;
    ui.exportAllBtn.disabled = true;
    ui.exportAllBtn.textContent = "Building ZIP…";

    try {
      for (const asset of state.assets) {
        const blob = await makeExportBlob(renderOutput(asset));
        if (blob) zip.file(uniqueOutputName(asset, usedNames), blob);
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });
      downloadBlob(zipBlob, `multi-edit-${currentFormat().extension}-images.zip`);
      toast(`All images exported as ${currentFormat().label} with their saved filenames.`, "↓");
    } catch (error) {
      console.error(error);
      toast(error.message || "The ZIP export could not be completed.", "⚠️");
    } finally {
      ui.exportAllBtn.disabled = false;
      ui.exportAllBtn.textContent = originalLabel;
      state.activeId = originalActive;
      renderPreview();
    }
  };

  applyRenameSequence = function applyRenameSequenceForSelectedFormat() {
    if (!state.renameDraft) return;
    const rawBase = ui.sequenceBaseName.value.trim();
    if (!rawBase) {
      ui.renameStatus.textContent = "Enter a sequence name before pressing Apply.";
      ui.sequenceBaseName.focus();
      return;
    }

    const base = safeBaseName(rawBase);
    const digits = Math.max(2, String(state.renameDraft.length).length);
    const extension = currentFormat().extension;
    state.renameDraft.forEach((entry, index) => {
      entry.proposedName = `${base}_${String(index + 1).padStart(digits, "0")}.${extension}`;
    });
    ui.renameStatus.textContent = `Applied “${base}” to ${state.renameDraft.length} files as ${currentFormat().label}. Reorder and press Apply again to recalculate the numbers.`;
    renderRenameList();
  };

  saveRenameSequence = function saveRenameSequenceForSelectedFormat() {
    if (!state.renameDraft) return;
    const assetMap = new Map(state.assets.map((asset) => [asset.id, asset]));
    const reordered = [];

    for (const entry of state.renameDraft) {
      const asset = assetMap.get(entry.id);
      if (!asset) continue;
      asset.exportName = getExportName({ exportName: entry.proposedName, originalName: asset.originalName });
      reordered.push(asset);
    }

    state.assets = reordered;
    closeRenameSequence();
    renderDeck();
    syncUiFromActive();
    toast("Image order and export filenames saved.", "✓");
  };

  ui.exportCurrentBtn.addEventListener("click", exportCurrent);
  ui.outputExportBtn.addEventListener("click", exportCurrent);
  ui.overwriteBtn.addEventListener("click", overwriteCurrent);
  ui.exportAllBtn.addEventListener("click", exportAll);
  ui.applySequenceNameBtn.addEventListener("click", applyRenameSequence);
  ui.renameSaveBtn.addEventListener("click", saveRenameSequence);

  ui.contrast.addEventListener("input", () => {
    updateAdjustment("contrast", Number(ui.contrast.value));
    ui.contrastOut.textContent = `${ui.contrast.value}%`;
  });

  ui.opacity.addEventListener("input", () => {
    updateAdjustment("opacity", Number(ui.opacity.value));
    ui.opacityOut.textContent = `${ui.opacity.value}%`;
  });

  ui.outputFormat.addEventListener("change", () => {
    state.output.format = ui.outputFormat.value;
    updateFormatControls();
    renderPreview();
  });

  ui.outputQuality.addEventListener("input", () => {
    state.output.quality = Number(ui.outputQuality.value);
    ui.outputQualityOut.textContent = `${state.output.quality}%`;
    updateOutputReadout();
  });

  ui.jpegBackground.addEventListener("input", () => {
    state.output.jpegBackground = ui.jpegBackground.value;
    ui.jpegBackgroundHex.textContent = ui.jpegBackground.value.toUpperCase();
    renderPreview();
  });

  ui.outputFormat.value = state.output.format;
  ui.outputQuality.value = state.output.quality;
  ui.jpegBackground.value = state.output.jpegBackground;
  ui.jpegBackgroundHex.textContent = state.output.jpegBackground.toUpperCase();

  updateFormatControls();
  syncUiFromActive();
  renderPreview();
})();
