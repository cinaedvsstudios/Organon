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
    red: $("#red"),
    green: $("#green"),
    blue: $("#blue"),
    redOut: $("#redOut"),
    greenOut: $("#greenOut"),
    blueOut: $("#blueOut"),
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
      opacity: 100,
      red: 0,
      green: 0,
      blue: 0
    };
  };

  adjustmentControls.push(
    ["contrast", ui.contrast, ui.contrastOut, "%"],
    ["opacity", ui.opacity, ui.opacityOut, "%"],
    ["red", ui.red, ui.redOut, "%"],
    ["green", ui.green, ui.greenOut, "%"],
    ["blue", ui.blue, ui.blueOut, "%"]
  );

  const originalSetUiDisabled = setUiDisabled;
  setUiDisabled = function setUiDisabledWithNewControls(disabled) {
    originalSetUiDisabled(disabled);
    ui.contrast.disabled = disabled;
    ui.opacity.disabled = disabled;
    ui.red.disabled = disabled;
    ui.green.disabled = disabled;
    ui.blue.disabled = disabled;
  };

  const originalBuildProcessedSource = buildProcessedSource;
  buildProcessedSource = function buildProcessedSourceWithContrastOpacityAndRgb(asset) {
    const canvas = originalBuildProcessedSource(asset);
    const adjustments = getEffectiveSettings(asset)?.adjustments || {};
    const contrast = Number(adjustments.contrast ?? 100) / 100;
    const opacity = Number(adjustments.opacity ?? 100) / 100;
    const redShift = Number(adjustments.red ?? 0) * 2.55;
    const greenShift = Number(adjustments.green ?? 0) * 2.55;
    const blueShift = Number(adjustments.blue ?? 0) * 2.55;

    if (contrast === 1 && opacity === 1 && redShift === 0 && greenShift === 0 && blueShift === 0) return canvas;

    const imageData = sourceCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (contrast !== 1) {
        data[i] = clampByte(128 + (data[i] - 128) * contrast);
        data[i + 1] = clampByte(128 + (data[i + 1] - 128) * contrast);
        data[i + 2] = clampByte(128 + (data[i + 2] - 128) * contrast);
      }
      if (data[i + 3] > 0) {
        if (redShift) data[i] = clampByte(data[i] + redShift);
        if (greenShift) data[i + 1] = clampByte(data[i + 1] + greenShift);
        if (blueShift) data[i + 2] = clampByte(data[i + 2] + blueShift);
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

  function canvasForMime(canvas, mime) {
    if (mime !== "image/jpeg") return canvas;
    jpegCanvas.width = canvas.width;
    jpegCanvas.height = canvas.height;
    jpegContext.save();
    jpegContext.fillStyle = state.output.jpegBackground;
    jpegContext.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
    jpegContext.drawImage(canvas, 0, 0);
    jpegContext.restore();
    return jpegCanvas;
  }

  function canvasForExport(canvas) {
    return canvasForMime(canvas, currentFormat().mime);
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

  function originalFormatForAsset(asset) {
    const name = String(asset?.originalName || "");
    const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    if (extension === "png") return { mime: "image/png", supportsQuality: false };
    if (extension === "jpg" || extension === "jpeg") return { mime: "image/jpeg", supportsQuality: true };
    if (extension === "webp") return { mime: "image/webp", supportsQuality: true };
    return null;
  }

  async function makeOriginalFormatBlob(asset) {
    const format = originalFormatForAsset(asset);
    if (!format) throw new Error(`Direct overwrite does not support ${asset.originalName}. Use PNG, JPEG or WebP source files.`);
    const prepared = canvasForMime(renderOutput(asset), format.mime);
    const blob = await blobFromCanvas(prepared, format.mime, format.supportsQuality ? outputQuality() : undefined);
    if (!blob) throw new Error(`Could not encode ${asset.originalName}.`);
    if (blob.type && blob.type !== format.mime) throw new Error(`${format.mime} encoding is unavailable in this browser.`);
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

  overwriteCurrent = async function overwriteBatchInSelectedFolder() {
    if (!state.assets.length) return;
    if (typeof window.showDirectoryPicker !== "function") {
      toast("This browser cannot write directly to a folder. Use Export all instead.", "⚠️");
      return;
    }

    const unsupported = state.assets.filter((asset) => !originalFormatForAsset(asset));
    if (unsupported.length) {
      toast(`Direct overwrite supports PNG, JPEG and WebP. Unsupported: ${unsupported[0].originalName}${unsupported.length > 1 ? ` (+${unsupported.length - 1} more)` : ""}.`, "⚠️");
      return;
    }

    const seenNames = new Set();
    const duplicate = state.assets.find((asset) => {
      const key = String(asset.originalName || "").toLowerCase();
      if (seenNames.has(key)) return true;
      seenNames.add(key);
      return false;
    });
    if (duplicate) {
      toast(`Two loaded files share the name ${duplicate.originalName}. Remove or rename one before overwriting a single folder.`, "⚠️");
      return;
    }

    let directoryHandle;
    try {
      directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
        toast("The destination folder could not be opened.", "⚠️");
      }
      return;
    }

    const originalLabel = ui.overwriteBtn.textContent;
    ui.overwriteBtn.disabled = true;

    try {
      for (let index = 0; index < state.assets.length; index += 1) {
        const asset = state.assets[index];
        ui.overwriteBtn.textContent = `Saving ${index + 1}/${state.assets.length}…`;
        const blob = await makeOriginalFormatBlob(asset);
        const fileHandle = await directoryHandle.getFileHandle(asset.originalName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      }
      toast(`${state.assets.length} edited ${state.assets.length === 1 ? "image" : "images"} saved with original filenames. PNG/WebP transparency was preserved.`, "✓");
    } catch (error) {
      console.error(error);
      toast(error.message || "The edited batch could not be written to the selected folder.", "⚠️");
    } finally {
      ui.overwriteBtn.disabled = !state.assets.length;
      ui.overwriteBtn.textContent = originalLabel;
      renderPreview();
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

  [
    ["red", ui.red, ui.redOut],
    ["green", ui.green, ui.greenOut],
    ["blue", ui.blue, ui.blueOut]
  ].forEach(([key, input, output]) => {
    input.addEventListener("input", () => {
      updateAdjustment(key, Number(input.value));
      output.textContent = `${Number(input.value) > 0 ? "+" : ""}${input.value}%`;
    });
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

  const previewBackgroundButtons = [...document.querySelectorAll("[data-preview-bg]")];
  const previewBackgroundColors = {
    black: "#000000",
    white: "#ffffff",
    green: "#00b140"
  };

  function setPreviewBackground(mode) {
    const nextMode = mode === "black" || mode === "white" || mode === "green" ? mode : "checker";
    state.previewBackground = nextMode;
    if (nextMode === "checker") ui.stageWrap.style.removeProperty("background");
    else ui.stageWrap.style.background = previewBackgroundColors[nextMode];
    previewBackgroundButtons.forEach((button) => button.classList.toggle("primary", button.dataset.previewBg === nextMode));
  }

  previewBackgroundButtons.forEach((button) => {
    button.addEventListener("click", () => setPreviewBackground(button.dataset.previewBg));
  });
  setPreviewBackground("checker");

  ui.outputFormat.value = state.output.format;
  ui.outputQuality.value = state.output.quality;
  ui.jpegBackground.value = state.output.jpegBackground;
  ui.jpegBackgroundHex.textContent = state.output.jpegBackground.toUpperCase();

  updateFormatControls();
  syncUiFromActive();
  renderPreview();
})();
