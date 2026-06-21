"use strict";

const $ = (selector) => document.querySelector(selector);
const state = {
  assets: [],
  activeId: null,
  draft: null,
  drag: null,
  toastTimer: null
};

const ui = {
  headerStatus: $("#headerStatus"),
  fileInput: $("#fileInput"),
  dropzone: $("#dropzone"),
  addImagesBtn: $("#addImagesBtn"),
  clearDeckBtn: $("#clearDeckBtn"),
  assetDeck: $("#assetDeck"),
  deckCount: $("#deckCount"),
  activeImageName: $("#activeImageName"),
  activeImageMeta: $("#activeImageMeta"),
  resetAdjustmentsBtn: $("#resetAdjustmentsBtn"),
  exportCurrentBtn: $("#exportCurrentBtn"),
  outputExportBtn: $("#outputExportBtn"),
  overwriteBtn: $("#overwriteBtn"),
  exportAllBtn: $("#exportAllBtn"),
  previewCanvas: $("#previewCanvas"),
  stageWrap: $("#stageWrap"),
  stageEmpty: $("#stageEmpty"),
  stageNote: $("#stageNote"),
  outputReadout: $("#outputReadout"),
  canvasWidth: $("#canvasWidth"),
  canvasHeight: $("#canvasHeight"),
  maintainRatio: $("#maintainRatio"),
  modeInputs: [...document.querySelectorAll('input[name="resizeMode"]')],
  applyResizeBtn: $("#applyResizeBtn"),
  resetResizeBtn: $("#resetResizeBtn"),
  resizeNote: $("#resizeNote"),
  exposure: $("#exposure"),
  brightness: $("#brightness"),
  saturation: $("#saturation"),
  highlights: $("#highlights"),
  shadows: $("#shadows"),
  tint: $("#tint"),
  exposureOut: $("#exposureOut"),
  brightnessOut: $("#brightnessOut"),
  saturationOut: $("#saturationOut"),
  highlightsOut: $("#highlightsOut"),
  shadowsOut: $("#shadowsOut"),
  tintOut: $("#tintOut"),
  chromaEnabled: $("#chromaEnabled"),
  chromaControls: $("#chromaControls"),
  chromaColor: $("#chromaColor"),
  chromaHex: $("#chromaHex"),
  chromaThreshold: $("#chromaThreshold"),
  chromaFeather: $("#chromaFeather"),
  chromaThresholdOut: $("#chromaThresholdOut"),
  chromaFeatherOut: $("#chromaFeatherOut"),
  toast: $("#toast"),
  toastEmoji: $("#toastEmoji"),
  toastText: $("#toastText")
};

const previewCtx = ui.previewCanvas.getContext("2d", { alpha: true });
const outputCanvas = document.createElement("canvas");
const outputCtx = outputCanvas.getContext("2d", { willReadFrequently: true });
const sourceCanvas = document.createElement("canvas");
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });

const adjustmentControls = [
  ["exposure", ui.exposure, ui.exposureOut, "%"],
  ["brightness", ui.brightness, ui.brightnessOut, "%"],
  ["saturation", ui.saturation, ui.saturationOut, "%"],
  ["highlights", ui.highlights, ui.highlightsOut, "%"],
  ["shadows", ui.shadows, ui.shadowsOut, "%"],
  ["tint", ui.tint, ui.tintOut, ""]
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

function toast(message, emoji = "ℹ️") {
  ui.toastEmoji.textContent = emoji;
  ui.toastText.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 3400);
}

function getActiveAsset() {
  return state.assets.find((asset) => asset.id === state.activeId) || null;
}

function makeDefaultAdjustments() {
  return {
    exposure: 0,
    brightness: 100,
    saturation: 100,
    highlights: 0,
    shadows: 0,
    tint: 0,
    chromaEnabled: false,
    chromaColor: "#00b140",
    chromaThreshold: 40,
    chromaFeather: 15
  };
}

function makeDefaultResize(width, height) {
  return {
    width,
    height,
    ratioLocked: true,
    mode: "stretch",
    manual: {
      x: 0,
      y: 0,
      scale: 1,
      touched: false
    },
    applied: false
  };
}

function makeDraftFromAsset(asset) {
  const resize = asset.resize || makeDefaultResize(asset.img.naturalWidth, asset.img.naturalHeight);
  return clone(resize);
}

function setUiDisabled(disabled) {
  const controls = [
    ui.canvasWidth, ui.canvasHeight, ui.maintainRatio, ...ui.modeInputs,
    ui.applyResizeBtn, ui.resetResizeBtn,
    ui.exposure, ui.brightness, ui.saturation, ui.highlights, ui.shadows, ui.tint,
    ui.chromaEnabled, ui.chromaColor, ui.chromaThreshold, ui.chromaFeather,
    ui.resetAdjustmentsBtn, ui.exportCurrentBtn, ui.outputExportBtn, ui.overwriteBtn
  ];
  controls.forEach((control) => { control.disabled = disabled; });
  ui.exportAllBtn.disabled = state.assets.length === 0;
  ui.exportAllBtn.classList.toggle("disabled", state.assets.length === 0);
}

function renderDeck() {
  ui.assetDeck.innerHTML = "";
  ui.deckCount.textContent = `${state.assets.length} ${state.assets.length === 1 ? "image" : "images"}`;
  ui.headerStatus.textContent = state.assets.length ? `${state.assets.length} IMAGE${state.assets.length === 1 ? "" : "S"} LOADED` : "NO IMAGES LOADED";

  if (!state.assets.length) {
    ui.assetDeck.innerHTML = `<div class="empty-deck">Add several images, then select one here to edit it.</div>`;
    return;
  }

  state.assets.forEach((asset) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = `asset-tile ${asset.id === state.activeId ? "active" : ""}`;
    tile.title = asset.name;

    const image = document.createElement("img");
    image.src = asset.url;
    image.alt = asset.name;
    tile.appendChild(image);

    const label = document.createElement("span");
    label.className = "asset-name";
    label.textContent = asset.name;
    tile.appendChild(label);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "tile-remove";
    remove.setAttribute("aria-label", `Remove ${asset.name}`);
    remove.textContent = "×";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      removeAsset(asset.id);
    });
    tile.appendChild(remove);

    tile.addEventListener("click", () => selectAsset(asset.id));
    ui.assetDeck.appendChild(tile);
  });
}

async function addFiles(files) {
  const imageFiles = [...files].filter((file) => file.type.startsWith("image/"));
  const skipped = files.length - imageFiles.length;

  if (!imageFiles.length) {
    toast("Only image files can be added to Multi Edit.", "⚠️");
    return;
  }

  for (const file of imageFiles) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.src = url;

    try {
      await img.decode();
    } catch {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      }).catch(() => null);
    }

    if (!img.naturalWidth || !img.naturalHeight) {
      URL.revokeObjectURL(url);
      toast(`Could not open ${file.name}.`, "⚠️");
      continue;
    }

    state.assets.push({
      id: makeId(),
      name: file.name,
      file,
      url,
      img,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      adjustments: makeDefaultAdjustments(),
      resize: makeDefaultResize(img.naturalWidth, img.naturalHeight)
    });
  }

  renderDeck();
  setUiDisabled(!state.assets.length);

  if (!state.activeId && state.assets.length) {
    selectAsset(state.assets[0].id);
  }

  if (skipped) toast(`${skipped} non-image ${skipped === 1 ? "file was" : "files were"} skipped.`, "⚠️");
  else toast(`${imageFiles.length} ${imageFiles.length === 1 ? "image added" : "images added"}.`, "▧");
}

function removeAsset(id) {
  const index = state.assets.findIndex((asset) => asset.id === id);
  if (index === -1) return;

  const [removed] = state.assets.splice(index, 1);
  URL.revokeObjectURL(removed.url);

  if (state.activeId === id) {
    const next = state.assets[index] || state.assets[index - 1] || null;
    state.activeId = next ? next.id : null;
    state.draft = next ? makeDraftFromAsset(next) : null;
  }

  renderDeck();
  syncUiFromActive();
  renderPreview();
  toast("Image removed from the deck.", "×");
}

function clearDeck() {
  state.assets.forEach((asset) => URL.revokeObjectURL(asset.url));
  state.assets = [];
  state.activeId = null;
  state.draft = null;
  renderDeck();
  syncUiFromActive();
  renderPreview();
  toast("Image deck cleared.", "⌫");
}

function selectAsset(id) {
  const asset = state.assets.find((item) => item.id === id);
  if (!asset) return;
  state.activeId = id;
  state.draft = makeDraftFromAsset(asset);
  renderDeck();
  syncUiFromActive();
  renderPreview();
}

function syncUiFromActive() {
  const asset = getActiveAsset();
  const disabled = !asset;
  setUiDisabled(disabled);

  if (!asset) {
    ui.activeImageName.textContent = "No image selected";
    ui.activeImageMeta.textContent = "Add one or more images to begin editing.";
    ui.outputReadout.textContent = "—";
    ui.resizeNote.textContent = "Select an image to set the canvas.";
    ui.resizeNote.classList.remove("pending");
    ui.chromaControls.classList.add("disabled");
    ui.stageEmpty.classList.remove("hidden");
    return;
  }

  ui.activeImageName.textContent = asset.name;
  ui.activeImageMeta.textContent = `${asset.naturalWidth} × ${asset.naturalHeight}px · ${formatBytes(asset.file?.size || 0)}`;
  ui.stageEmpty.classList.add("hidden");

  const draft = state.draft;
  ui.canvasWidth.value = draft.width;
  ui.canvasHeight.value = draft.height;
  ui.maintainRatio.checked = draft.ratioLocked;
  ui.modeInputs.forEach((input) => { input.checked = input.value === draft.mode; });

  adjustmentControls.forEach(([key, input, output, suffix]) => {
    input.value = asset.adjustments[key];
    output.textContent = formatAdjustmentValue(key, asset.adjustments[key], suffix);
  });

  ui.chromaEnabled.checked = asset.adjustments.chromaEnabled;
  ui.chromaColor.value = asset.adjustments.chromaColor;
  ui.chromaHex.textContent = asset.adjustments.chromaColor.toUpperCase();
  ui.chromaThreshold.value = asset.adjustments.chromaThreshold;
  ui.chromaFeather.value = asset.adjustments.chromaFeather;
  ui.chromaThresholdOut.textContent = asset.adjustments.chromaThreshold;
  ui.chromaFeatherOut.textContent = asset.adjustments.chromaFeather;
  ui.chromaControls.classList.toggle("disabled", !asset.adjustments.chromaEnabled);

  updateResizeStatus();
  updateOutputReadout();
}

function formatAdjustmentValue(key, value, suffix) {
  if (key === "exposure" || key === "highlights" || key === "shadows" || key === "tint") {
    return `${Number(value) > 0 ? "+" : ""}${value}${suffix}`;
  }
  return `${value}${suffix}`;
}

function updateResizeStatus() {
  const asset = getActiveAsset();
  if (!asset || !state.draft) return;

  const differs = JSON.stringify(state.draft) !== JSON.stringify(asset.resize);
  const draftMode = state.draft.mode;

  if (draftMode === "manual" && differs) {
    ui.resizeNote.textContent = "Manual draft active: drag the image or its corner handles, then click Apply resize.";
    ui.resizeNote.classList.add("pending");
  } else if (differs) {
    ui.resizeNote.textContent = "Resize settings are a draft. Click Apply resize to commit them.";
    ui.resizeNote.classList.add("pending");
  } else if (asset.resize.applied) {
    ui.resizeNote.textContent = `Applied: ${asset.resize.width} × ${asset.resize.height}px · ${asset.resize.mode} mode.`;
    ui.resizeNote.classList.remove("pending");
  } else {
    ui.resizeNote.textContent = "Original image is unchanged. Configure a draft, then click Apply resize.";
    ui.resizeNote.classList.remove("pending");
  }
}

function updateOutputReadout() {
  const asset = getActiveAsset();
  if (!asset) {
    ui.outputReadout.textContent = "—";
    return;
  }
  const active = asset.resize.applied ? asset.resize : {
    width: asset.naturalWidth,
    height: asset.naturalHeight,
    mode: "original"
  };
  ui.outputReadout.textContent = `${active.width} × ${active.height}px · ${active.mode}`;
}

function onDimensionChange(changedKey) {
  const asset = getActiveAsset();
  if (!asset || !state.draft) return;

  const min = 1;
  const max = 16384;
  let width = Math.min(max, Math.max(min, Math.round(Number(ui.canvasWidth.value) || 0)));
  let height = Math.min(max, Math.max(min, Math.round(Number(ui.canvasHeight.value) || 0)));

  if (state.draft.ratioLocked) {
    const ratio = asset.naturalWidth / asset.naturalHeight;
    if (changedKey === "width") height = Math.max(min, Math.round(width / ratio));
    else width = Math.max(min, Math.round(height * ratio));
  }

  state.draft.width = width;
  state.draft.height = height;

  if (state.draft.mode === "manual" && !state.draft.manual.touched) {
    state.draft.manual = makeContainTransform(asset, width, height);
  }

  ui.canvasWidth.value = width;
  ui.canvasHeight.value = height;
  updateResizeStatus();
  renderPreview();
}

function makeContainTransform(asset, targetWidth, targetHeight) {
  const scale = Math.min(targetWidth / asset.naturalWidth, targetHeight / asset.naturalHeight);
  return {
    x: (targetWidth - asset.naturalWidth * scale) / 2,
    y: (targetHeight - asset.naturalHeight * scale) / 2,
    scale,
    touched: false
  };
}

function setDraftMode(mode) {
  const asset = getActiveAsset();
  if (!asset || !state.draft) return;
  state.draft.mode = mode;
  if (mode === "manual" && (!state.draft.manual || !state.draft.manual.scale || !state.draft.manual.touched)) {
    state.draft.manual = makeContainTransform(asset, state.draft.width, state.draft.height);
  }
  updateResizeStatus();
  renderPreview();
}

function applyResize() {
  const asset = getActiveAsset();
  if (!asset || !state.draft) return;
  asset.resize = clone(state.draft);
  asset.resize.applied = true;
  state.draft.applied = true;
  updateResizeStatus();
  updateOutputReadout();
  renderPreview();
  toast(`Resize applied at ${asset.resize.width} × ${asset.resize.height}px.`, "✓");
}

function resetResize() {
  const asset = getActiveAsset();
  if (!asset) return;
  const original = makeDefaultResize(asset.naturalWidth, asset.naturalHeight);
  asset.resize = clone(original);
  state.draft = clone(original);
  syncUiFromActive();
  renderPreview();
  toast("Resize reset to the original image dimensions.", "↺");
}

function resetAdjustments() {
  const asset = getActiveAsset();
  if (!asset) return;
  asset.adjustments = makeDefaultAdjustments();
  syncUiFromActive();
  renderPreview();
  toast("Colour and chromakey adjustments reset.", "↺");
}

function buildProcessedSource(asset) {
  const image = asset.img;
  sourceCanvas.width = image.naturalWidth;
  sourceCanvas.height = image.naturalHeight;
  sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceCtx.drawImage(image, 0, 0);

  const a = asset.adjustments;
  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const data = imageData.data;
  const exposureFactor = Math.pow(2, Number(a.exposure) / 100);
  const brightnessFactor = Number(a.brightness) / 100;
  const saturationFactor = Number(a.saturation) / 100;
  const highlights = Number(a.highlights);
  const shadows = Number(a.shadows);
  const tint = Number(a.tint);
  const chroma = hexToRgb(a.chromaColor);
  const threshold = Number(a.chromaThreshold);
  const feather = Number(a.chromaFeather);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * exposureFactor * brightnessFactor;
    let g = data[i + 1] * exposureFactor * brightnessFactor;
    let b = data[i + 2] * exposureFactor * brightnessFactor;
    let alpha = data[i + 3];

    const lumaPreSat = .299 * r + .587 * g + .114 * b;
    r = lumaPreSat + (r - lumaPreSat) * saturationFactor;
    g = lumaPreSat + (g - lumaPreSat) * saturationFactor;
    b = lumaPreSat + (b - lumaPreSat) * saturationFactor;

    const luma = .299 * r + .587 * g + .114 * b;
    if (highlights && luma > 128) {
      const weight = (luma - 128) / 127;
      r += weight * highlights * .5;
      g += weight * highlights * .5;
      b += weight * highlights * .5;
    }
    if (shadows && luma <= 128) {
      const weight = (128 - luma) / 128;
      r += weight * shadows * .5;
      g += weight * shadows * .5;
      b += weight * shadows * .5;
    }

    r += tint * .34;
    b -= tint * .20;

    if (a.chromaEnabled && chroma) {
      const distance = Math.hypot(r - chroma.r, g - chroma.g, b - chroma.b);
      if (distance < threshold) alpha = 0;
      else if (feather > 0 && distance < threshold + feather) alpha *= (distance - threshold) / feather;
    }

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
    data[i + 3] = clampByte(alpha);
  }

  sourceCtx.putImageData(imageData, 0, 0);
  return sourceCanvas;
}

function renderOutput(asset) {
  const processed = buildProcessedSource(asset);
  const resize = asset.resize?.applied ? asset.resize : {
    width: asset.naturalWidth,
    height: asset.naturalHeight,
    mode: "original",
    manual: makeContainTransform(asset, asset.naturalWidth, asset.naturalHeight)
  };

  const width = Math.max(1, Math.round(resize.width));
  const height = Math.max(1, Math.round(resize.height));
  outputCanvas.width = width;
  outputCanvas.height = height;
  outputCtx.clearRect(0, 0, width, height);

  if (resize.mode === "stretch") {
    outputCtx.drawImage(processed, 0, 0, width, height);
  } else if (resize.mode === "crop") {
    const scale = Math.max(width / processed.width, height / processed.height);
    const drawW = processed.width * scale;
    const drawH = processed.height * scale;
    outputCtx.drawImage(processed, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
  } else if (resize.mode === "manual") {
    const manual = resize.manual || makeContainTransform(asset, width, height);
    outputCtx.drawImage(
      processed,
      manual.x,
      manual.y,
      processed.width * manual.scale,
      processed.height * manual.scale
    );
  } else {
    outputCtx.drawImage(processed, 0, 0);
  }

  return outputCanvas;
}

function getStageMetrics() {
  const rect = ui.previewCanvas.getBoundingClientRect();
  const cssWidth = Math.max(1, rect.width);
  const cssHeight = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetW = Math.max(1, Math.round(cssWidth * dpr));
  const targetH = Math.max(1, Math.round(cssHeight * dpr));

  if (ui.previewCanvas.width !== targetW || ui.previewCanvas.height !== targetH) {
    ui.previewCanvas.width = targetW;
    ui.previewCanvas.height = targetH;
  }

  previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: cssWidth, height: cssHeight };
}

function renderPreview() {
  const asset = getActiveAsset();
  const stage = getStageMetrics();
  previewCtx.clearRect(0, 0, stage.width, stage.height);

  if (!asset) return;

  const draft = state.draft;
  const showManualDraft = draft && draft.mode === "manual";
  const processed = buildProcessedSource(asset);

  if (showManualDraft) {
    drawManualStage(asset, processed, stage);
    ui.stageNote.textContent = "Manual mode: drag the image. Drag a corner handle to resize it. Green frame = exported canvas.";
    ui.stageNote.classList.add("visible");
    return;
  }

  const output = renderOutput(asset);
  const pad = 28;
  const scale = Math.min((stage.width - pad * 2) / output.width, (stage.height - pad * 2) / output.height);
  const drawW = output.width * scale;
  const drawH = output.height * scale;
  const x = (stage.width - drawW) / 2;
  const y = (stage.height - drawH) / 2;
  previewCtx.imageSmoothingEnabled = true;
  previewCtx.imageSmoothingQuality = "high";
  previewCtx.drawImage(output, x, y, drawW, drawH);
  ui.stageNote.classList.remove("visible");
}

function drawManualStage(asset, processed, stage) {
  const draft = state.draft;
  const targetW = Math.max(1, draft.width);
  const targetH = Math.max(1, draft.height);
  const padding = 36;
  const frameScale = Math.min((stage.width - padding * 2) / targetW, (stage.height - padding * 2) / targetH);
  const frameW = targetW * frameScale;
  const frameH = targetH * frameScale;
  const frameX = (stage.width - frameW) / 2;
  const frameY = (stage.height - frameH) / 2;

  const manual = draft.manual;
  const drawW = processed.width * manual.scale * frameScale;
  const drawH = processed.height * manual.scale * frameScale;
  const drawX = frameX + manual.x * frameScale;
  const drawY = frameY + manual.y * frameScale;

  previewCtx.save();
  previewCtx.drawImage(processed, drawX, drawY, drawW, drawH);

  previewCtx.fillStyle = "rgba(5, 7, 5, .54)";
  previewCtx.fillRect(0, 0, stage.width, frameY);
  previewCtx.fillRect(0, frameY + frameH, stage.width, stage.height - (frameY + frameH));
  previewCtx.fillRect(0, frameY, frameX, frameH);
  previewCtx.fillRect(frameX + frameW, frameY, stage.width - (frameX + frameW), frameH);

  previewCtx.strokeStyle = "#58c96c";
  previewCtx.lineWidth = 2;
  previewCtx.shadowColor = "rgba(88, 201, 108, .7)";
  previewCtx.shadowBlur = 10;
  previewCtx.strokeRect(frameX, frameY, frameW, frameH);
  previewCtx.shadowBlur = 0;

  const handles = getManualHandles(drawX, drawY, drawW, drawH);
  previewCtx.fillStyle = "#58c96c";
  previewCtx.strokeStyle = "#0c2111";
  previewCtx.lineWidth = 1.5;
  Object.values(handles).forEach((point) => {
    previewCtx.beginPath();
    previewCtx.rect(point.x - 6, point.y - 6, 12, 12);
    previewCtx.fill();
    previewCtx.stroke();
  });

  previewCtx.fillStyle = "rgba(88, 201, 108, .93)";
  previewCtx.font = `600 11px ${getComputedStyle(document.documentElement).getPropertyValue("--font-mono")}`;
  previewCtx.fillText(`${targetW} × ${targetH}`, frameX + 7, Math.max(15, frameY - 8));
  previewCtx.restore();

  state.manualStage = { frameX, frameY, frameW, frameH, frameScale, drawX, drawY, drawW, drawH, handles };
}

function getManualHandles(x, y, width, height) {
  return {
    nw: { x, y },
    ne: { x: x + width, y },
    sw: { x, y: y + height },
    se: { x: x + width, y: y + height }
  };
}

function getPointerPosition(event) {
  const rect = ui.previewCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function hitManualHandle(pointer) {
  const handles = state.manualStage?.handles;
  if (!handles) return null;
  for (const [key, point] of Object.entries(handles)) {
    if (Math.hypot(pointer.x - point.x, pointer.y - point.y) <= 13) return key;
  }
  return null;
}

function pointInsideManualImage(pointer) {
  const stage = state.manualStage;
  if (!stage) return false;
  return pointer.x >= stage.drawX && pointer.x <= stage.drawX + stage.drawW &&
    pointer.y >= stage.drawY && pointer.y <= stage.drawY + stage.drawH;
}

function updateManualCursor(pointer) {
  const asset = getActiveAsset();
  if (!asset || state.draft?.mode !== "manual") {
    ui.previewCanvas.style.cursor = "default";
    return;
  }
  const handle = hitManualHandle(pointer);
  if (handle === "nw" || handle === "se") ui.previewCanvas.style.cursor = "nwse-resize";
  else if (handle === "ne" || handle === "sw") ui.previewCanvas.style.cursor = "nesw-resize";
  else if (pointInsideManualImage(pointer)) ui.previewCanvas.style.cursor = "grab";
  else ui.previewCanvas.style.cursor = "default";
}

function beginManualInteraction(event) {
  const asset = getActiveAsset();
  if (!asset || state.draft?.mode !== "manual") return;
  const pointer = getPointerPosition(event);
  const handle = hitManualHandle(pointer);
  const inImage = pointInsideManualImage(pointer);
  if (!handle && !inImage) return;

  event.preventDefault();
  ui.previewCanvas.setPointerCapture(event.pointerId);

  state.drag = {
    type: handle ? "resize" : "move",
    handle,
    startPointer: pointer,
    startManual: clone(state.draft.manual)
  };
  ui.previewCanvas.style.cursor = handle ? ui.previewCanvas.style.cursor : "grabbing";
}

function moveManualInteraction(event) {
  const asset = getActiveAsset();
  if (!asset || state.draft?.mode !== "manual") return;

  const pointer = getPointerPosition(event);
  if (!state.drag) {
    updateManualCursor(pointer);
    return;
  }

  const stage = state.manualStage;
  if (!stage) return;
  const targetScale = stage.frameScale;
  const manual = state.draft.manual;
  const start = state.drag.startManual;
  const srcW = asset.naturalWidth;
  const srcH = asset.naturalHeight;

  if (state.drag.type === "move") {
    manual.x = start.x + (pointer.x - state.drag.startPointer.x) / targetScale;
    manual.y = start.y + (pointer.y - state.drag.startPointer.y) / targetScale;
  } else {
    const localX = (pointer.x - stage.frameX) / targetScale;
    const localY = (pointer.y - stage.frameY) / targetScale;
    const right = start.x + srcW * start.scale;
    const bottom = start.y + srcH * start.scale;
    let scale;

    if (state.drag.handle === "nw") {
      scale = Math.max(.01, Math.max((right - localX) / srcW, (bottom - localY) / srcH));
      manual.x = right - srcW * scale;
      manual.y = bottom - srcH * scale;
    }
    if (state.drag.handle === "ne") {
      scale = Math.max(.01, Math.max((localX - start.x) / srcW, (bottom - localY) / srcH));
      manual.x = start.x;
      manual.y = bottom - srcH * scale;
    }
    if (state.drag.handle === "sw") {
      scale = Math.max(.01, Math.max((right - localX) / srcW, (localY - start.y) / srcH));
      manual.x = right - srcW * scale;
      manual.y = start.y;
    }
    if (state.drag.handle === "se") {
      scale = Math.max(.01, Math.max((localX - start.x) / srcW, (localY - start.y) / srcH));
      manual.x = start.x;
      manual.y = start.y;
    }
    manual.scale = scale;
  }

  manual.touched = true;
  updateResizeStatus();
  renderPreview();
}

function endManualInteraction(event) {
  if (!state.drag) return;
  if (ui.previewCanvas.hasPointerCapture(event.pointerId)) ui.previewCanvas.releasePointerCapture(event.pointerId);
  state.drag = null;
  updateManualCursor(getPointerPosition(event));
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex) {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  return match ? {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16)
  } : null;
}

function blobFromCanvas(canvas, type = "image/png", quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function safeBaseName(name) {
  return (name || "image").replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_");
}

async function exportCurrent() {
  const asset = getActiveAsset();
  if (!asset) return;
  const output = renderOutput(asset);
  const blob = await blobFromCanvas(output);
  if (!blob) {
    toast("Could not produce the PNG export.", "⚠️");
    return;
  }
  downloadBlob(blob, `${safeBaseName(asset.name)}_edited.png`);
  toast("PNG exported.", "↓");
}

async function overwriteCurrent() {
  const asset = getActiveAsset();
  if (!asset) return;
  const output = renderOutput(asset);
  const blob = await blobFromCanvas(output);
  if (!blob) {
    toast("Could not overwrite the selected image.", "⚠️");
    return;
  }

  const nextUrl = URL.createObjectURL(blob);
  const nextImg = new Image();
  nextImg.decoding = "async";
  nextImg.src = nextUrl;
  await nextImg.decode().catch(() => null);
  if (!nextImg.naturalWidth) {
    URL.revokeObjectURL(nextUrl);
    toast("Could not reload the overwritten image.", "⚠️");
    return;
  }

  URL.revokeObjectURL(asset.url);
  asset.url = nextUrl;
  asset.img = nextImg;
  asset.file = new File([blob], `${safeBaseName(asset.name)}_edited.png`, { type: "image/png" });
  asset.name = asset.file.name;
  asset.naturalWidth = nextImg.naturalWidth;
  asset.naturalHeight = nextImg.naturalHeight;
  asset.resize = makeDefaultResize(asset.naturalWidth, asset.naturalHeight);
  state.draft = makeDraftFromAsset(asset);

  renderDeck();
  syncUiFromActive();
  renderPreview();
  toast("Selected image overwritten inside the deck.", "✓");
}

async function exportAll() {
  if (!state.assets.length) return;
  if (typeof JSZip === "undefined") {
    toast("ZIP support is unavailable in this browser.", "⚠️");
    return;
  }

  const originalActive = state.activeId;
  const zip = new JSZip();
  ui.exportAllBtn.disabled = true;
  ui.exportAllBtn.textContent = "Building ZIP…";

  try {
    for (const asset of state.assets) {
      const output = renderOutput(asset);
      const blob = await blobFromCanvas(output);
      if (blob) zip.file(`${safeBaseName(asset.name)}_edited.png`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    downloadBlob(zipBlob, "multi-edit-images.zip");
    toast("All images exported as a ZIP.", "↓");
  } catch (error) {
    console.error(error);
    toast("The ZIP export could not be completed.", "⚠️");
  } finally {
    ui.exportAllBtn.disabled = false;
    ui.exportAllBtn.textContent = "Export all PNGs (.zip)";
    state.activeId = originalActive;
    renderPreview();
  }
}

function wireControls() {
  ui.dropzone.addEventListener("click", () => ui.fileInput.click());
  ui.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      ui.fileInput.click();
    }
  });
  ui.addImagesBtn.addEventListener("click", () => ui.fileInput.click());
  ui.fileInput.addEventListener("change", (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    ui.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      ui.dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    ui.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      ui.dropzone.classList.remove("dragover");
    });
  });
  ui.dropzone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));

  ui.clearDeckBtn.addEventListener("click", clearDeck);
  ui.resetAdjustmentsBtn.addEventListener("click", resetAdjustments);
  ui.applyResizeBtn.addEventListener("click", applyResize);
  ui.resetResizeBtn.addEventListener("click", resetResize);
  ui.exportCurrentBtn.addEventListener("click", exportCurrent);
  ui.outputExportBtn.addEventListener("click", exportCurrent);
  ui.overwriteBtn.addEventListener("click", overwriteCurrent);
  ui.exportAllBtn.addEventListener("click", exportAll);

  ui.canvasWidth.addEventListener("input", () => onDimensionChange("width"));
  ui.canvasHeight.addEventListener("input", () => onDimensionChange("height"));
  ui.maintainRatio.addEventListener("change", () => {
    if (!state.draft) return;
    state.draft.ratioLocked = ui.maintainRatio.checked;
    if (state.draft.ratioLocked) onDimensionChange("width");
    updateResizeStatus();
    renderPreview();
  });
  ui.modeInputs.forEach((input) => input.addEventListener("change", () => {
    if (input.checked) setDraftMode(input.value);
  }));

  adjustmentControls.forEach(([key, input, output, suffix]) => {
    input.addEventListener("input", () => {
      const asset = getActiveAsset();
      if (!asset) return;
      asset.adjustments[key] = Number(input.value);
      output.textContent = formatAdjustmentValue(key, input.value, suffix);
      renderPreview();
    });
  });

  ui.chromaEnabled.addEventListener("change", () => {
    const asset = getActiveAsset();
    if (!asset) return;
    asset.adjustments.chromaEnabled = ui.chromaEnabled.checked;
    ui.chromaControls.classList.toggle("disabled", !ui.chromaEnabled.checked);
    renderPreview();
  });
  ui.chromaColor.addEventListener("input", () => {
    const asset = getActiveAsset();
    if (!asset) return;
    asset.adjustments.chromaColor = ui.chromaColor.value;
    ui.chromaHex.textContent = ui.chromaColor.value.toUpperCase();
    renderPreview();
  });
  ui.chromaThreshold.addEventListener("input", () => {
    const asset = getActiveAsset();
    if (!asset) return;
    asset.adjustments.chromaThreshold = Number(ui.chromaThreshold.value);
    ui.chromaThresholdOut.textContent = ui.chromaThreshold.value;
    renderPreview();
  });
  ui.chromaFeather.addEventListener("input", () => {
    const asset = getActiveAsset();
    if (!asset) return;
    asset.adjustments.chromaFeather = Number(ui.chromaFeather.value);
    ui.chromaFeatherOut.textContent = ui.chromaFeather.value;
    renderPreview();
  });

  ui.previewCanvas.addEventListener("pointerdown", beginManualInteraction);
  ui.previewCanvas.addEventListener("pointermove", moveManualInteraction);
  ui.previewCanvas.addEventListener("pointerup", endManualInteraction);
  ui.previewCanvas.addEventListener("pointercancel", endManualInteraction);
  ui.previewCanvas.addEventListener("pointerleave", () => {
    if (!state.drag) ui.previewCanvas.style.cursor = "default";
  });

  new ResizeObserver(() => renderPreview()).observe(ui.stageWrap);
  window.addEventListener("beforeunload", () => state.assets.forEach((asset) => URL.revokeObjectURL(asset.url)));
}

wireControls();
setUiDisabled(true);
renderDeck();
renderPreview();
