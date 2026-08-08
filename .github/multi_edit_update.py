from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


# Live base UI used by index-v3.html.
path = Path("tools/multi-edit/index.html")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '<script defer src="./multi-edit-output.js?v=0.01"></script>',
    '<script defer src="./multi-edit-output.js?v=0.02"></script>',
    "output script version",
)

stage_needle = '      <div class="stage-wrap" id="stageWrap">\n'
stage_controls = '''      <div class="button-row" id="previewBackgroundControls" role="group" aria-label="Transparency preview background">
        <button type="button" class="button primary preview-bg-btn" data-preview-bg="checker">CHECKER</button>
        <button type="button" class="button preview-bg-btn" data-preview-bg="black">BLACK</button>
        <button type="button" class="button preview-bg-btn" data-preview-bg="white">WHITE</button>
        <button type="button" class="button preview-bg-btn" data-preview-bg="green">GREEN</button>
      </div>

'''
text = replace_once(text, stage_needle, stage_controls + stage_needle, "preview background controls")

tint_block = '''            <div class="slider-item">
              <div class="slider-head"><span>Tint</span><output id="tintOut">0</output></div>
              <input type="range" id="tint" min="-100" max="100" value="0" disabled>
            </div>
'''
rgb_block = tint_block + '''            <div class="slider-item">
              <div class="slider-head"><span>Red</span><output id="redOut">0%</output></div>
              <input type="range" id="red" min="-100" max="100" value="0" disabled>
            </div>
            <div class="slider-item">
              <div class="slider-head"><span>Green</span><output id="greenOut">0%</output></div>
              <input type="range" id="green" min="-100" max="100" value="0" disabled>
            </div>
            <div class="slider-item">
              <div class="slider-head"><span>Blue</span><output id="blueOut">0%</output></div>
              <input type="range" id="blue" min="-100" max="100" value="0" disabled>
            </div>
'''
text = replace_once(text, tint_block, rgb_block, "RGB controls")

text = replace_once(
    text,
    '          <p class="section-help">Choose one format for the current image and the batch ZIP. PNG and WebP preserve transparency. JPEG uses the selected solid background.</p>',
    '          <p class="section-help">Choose one format for Export and the batch ZIP. PNG and WebP preserve transparency. Overwrite batch in folder keeps each original filename and original PNG/JPEG/WebP format; JPEG/WebP use the quality setting.</p>',
    "output help",
)
text = replace_once(
    text,
    '<button class="button primary" id="overwriteBtn" disabled>Overwrite current</button>',
    '<button class="button primary" id="overwriteBtn" disabled>Overwrite batch in folder</button>',
    "overwrite button label",
)
path.write_text(text, encoding="utf-8")


# Extend existing output/grading source directly.
path = Path("tools/multi-edit/multi-edit-output.js")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '    opacityOut: $("#opacityOut"),\n',
    '    opacityOut: $("#opacityOut"),\n    red: $("#red"),\n    green: $("#green"),\n    blue: $("#blue"),\n    redOut: $("#redOut"),\n    greenOut: $("#greenOut"),\n    blueOut: $("#blueOut"),\n',
    "RGB ui mappings",
)
text = replace_once(
    text,
    '      contrast: 100,\n      opacity: 100\n',
    '      contrast: 100,\n      opacity: 100,\n      red: 0,\n      green: 0,\n      blue: 0\n',
    "RGB defaults",
)
text = replace_once(
    text,
    '    ["contrast", ui.contrast, ui.contrastOut, "%"],\n    ["opacity", ui.opacity, ui.opacityOut, "%"]\n',
    '    ["contrast", ui.contrast, ui.contrastOut, "%"],\n    ["opacity", ui.opacity, ui.opacityOut, "%"],\n    ["red", ui.red, ui.redOut, "%"],\n    ["green", ui.green, ui.greenOut, "%"],\n    ["blue", ui.blue, ui.blueOut, "%"]\n',
    "RGB adjustment controls",
)
text = replace_once(
    text,
    '    ui.contrast.disabled = disabled;\n    ui.opacity.disabled = disabled;\n',
    '    ui.contrast.disabled = disabled;\n    ui.opacity.disabled = disabled;\n    ui.red.disabled = disabled;\n    ui.green.disabled = disabled;\n    ui.blue.disabled = disabled;\n',
    "RGB disabled state",
)

build_pattern = re.compile(
    r'  const originalBuildProcessedSource = buildProcessedSource;\n'
    r'  buildProcessedSource = function buildProcessedSourceWithContrastAndOpacity\(asset\) \{.*?\n'
    r'  \};\n\n  function currentFormat',
    re.S,
)
build_replacement = '''  const originalBuildProcessedSource = buildProcessedSource;
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

  function currentFormat'''
text, count = build_pattern.subn(build_replacement, text, count=1)
if count != 1:
    raise SystemExit("grading pipeline replacement failed")

canvas_pattern = re.compile(r'  function canvasForExport\(canvas\) \{.*?\n  \}\n\n  async function makeExportBlob', re.S)
canvas_replacement = '''  function canvasForMime(canvas, mime) {
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

  async function makeExportBlob'''
text, count = canvas_pattern.subn(canvas_replacement, text, count=1)
if count != 1:
    raise SystemExit("export canvas helper replacement failed")

output_button_marker = '  function updateOutputButtons() {\n'
output_helpers = '''  function originalFormatForAsset(asset) {
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
'''
text = replace_once(text, output_button_marker, output_helpers, "folder save helpers")

overwrite_pattern = re.compile(
    r'  overwriteCurrent = async function overwriteCurrentInSelectedFormat\(\) \{.*?\n'
    r'  \};\n\n  function uniqueOutputName',
    re.S,
)
overwrite_replacement = '''  overwriteCurrent = async function overwriteBatchInSelectedFolder() {
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

  function uniqueOutputName'''
text, count = overwrite_pattern.subn(overwrite_replacement, text, count=1)
if count != 1:
    raise SystemExit("overwrite action replacement failed")

listener_marker = '  ui.outputFormat.addEventListener("change", () => {\n'
rgb_listeners = '''  [
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
'''
text = replace_once(text, listener_marker, rgb_listeners, "RGB listeners")

init_marker = '  ui.outputFormat.value = state.output.format;\n'
preview_setup = '''  const previewBackgroundButtons = [...document.querySelectorAll("[data-preview-bg]")];
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
'''
text = replace_once(text, init_marker, preview_setup, "preview background behaviour")
path.write_text(text, encoding="utf-8")


# Live v3 wrapper: fresh base and fresh output module while retaining erase module.
path = Path("tools/multi-edit/index-v3.html")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "./index.html?build=20260720-multi-edit-base-1",
    "./index.html?build=20260808-batch-save-rgb-preview-1",
    "v3 base cache key",
)
if text.count("./multi-edit-output.js?v=0.01") != 2:
    raise SystemExit("v3 output module patch points changed")
text = text.replace("./multi-edit-output.js?v=0.01", "./multi-edit-output.js?v=0.02")
path.write_text(text, encoding="utf-8")


# Organon launcher cache key.
path = Path("tools.json")
text = path.read_text(encoding="utf-8")
text = replace_once(text, '"version": "v1.50-alpha"', '"version": "v1.51-alpha"', "tools version")
text = replace_once(
    text,
    '"path": "tools/multi-edit/index-v3.html?v=0.03"',
    '"path": "tools/multi-edit/index-v3.html?v=0.04"',
    "Multi Edit launcher path",
)
path.write_text(text, encoding="utf-8")
