"use strict";

(() => {
  const overlay = document.getElementById("eraseOverlayCanvas");
  const eraseCard = document.getElementById("eraseCard");
  const toolButtons = [...document.querySelectorAll("[data-erase-tool]")];
  const penSizeInput = document.getElementById("erasePenSize");
  const penSizeOutput = document.getElementById("erasePenSizeOut");
  const undoButton = document.getElementById("undoEraseBtn");
  const clearButton = document.getElementById("clearEraseBtn");
  const status = document.getElementById("eraseStatus");
  const help = document.getElementById("eraseHelp");
  const outputFormat = document.getElementById("outputFormat");
  const resizeCard = document.getElementById("resizeCard");

  if (!overlay || !eraseCard || !toolButtons.length || !penSizeInput || !undoButton || !clearButton) {
    console.error("Multi Edit batch erase controls could not initialise.");
    return;
  }

  const overlayContext = overlay.getContext("2d");
  const baseRenderOutput = renderOutput;
  const baseRenderPreview = renderPreview;
  const baseSetUiDisabled = setUiDisabled;

  const erase = {
    activeTool: null,
    penSize: Number(penSizeInput.value) || 40,
    actions: [],
    draft: null,
    drawing: false,
    pointer: null,
    mapping: null,
    pointerId: null,
    formatGuard: false
  };
  state.erase = erase;

  function outputDimensions(asset) {
    if (!asset) return { width: 1, height: 1 };
    const settings = getEffectiveSettings(asset);
    const resize = settings?.resize?.applied ? settings.resize : null;
    return {
      width: Math.max(1, Math.round(resize?.width || asset.naturalWidth || 1)),
      height: Math.max(1, Math.round(resize?.height || asset.naturalHeight || 1))
    };
  }

  function applyEraseActions(canvas) {
    if (!canvas || !erase.actions.length) return canvas;
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    context.save();
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = "#000";
    context.strokeStyle = "#000";
    context.lineCap = "round";
    context.lineJoin = "round";

    erase.actions.forEach((action) => {
      if (action.type === "box") {
        const x = Math.min(action.start.x, action.end.x) * width;
        const y = Math.min(action.start.y, action.end.y) * height;
        const w = Math.abs(action.end.x - action.start.x) * width;
        const h = Math.abs(action.end.y - action.start.y) * height;
        context.fillRect(x, y, w, h);
        return;
      }

      if (action.type === "lasso" && action.points.length >= 3) {
        context.beginPath();
        context.moveTo(action.points[0].x * width, action.points[0].y * height);
        action.points.slice(1).forEach((point) => context.lineTo(point.x * width, point.y * height));
        context.closePath();
        context.fill();
        return;
      }

      if (action.type === "pen" && action.points.length) {
        const lineWidth = Math.max(1, action.sizeRatio * Math.min(width, height));
        context.lineWidth = lineWidth;
        if (action.points.length === 1) {
          context.beginPath();
          context.arc(action.points[0].x * width, action.points[0].y * height, lineWidth / 2, 0, Math.PI * 2);
          context.fill();
          return;
        }
        context.beginPath();
        context.moveTo(action.points[0].x * width, action.points[0].y * height);
        action.points.slice(1).forEach((point) => context.lineTo(point.x * width, point.y * height));
        context.stroke();
      }
    });

    context.restore();
    return canvas;
  }

  renderOutput = function renderOutputWithBatchErase(asset) {
    return applyEraseActions(baseRenderOutput(asset));
  };

  function fitMapping(asset) {
    const rect = ui.previewCanvas.getBoundingClientRect();
    const stageWidth = Math.max(1, rect.width);
    const stageHeight = Math.max(1, rect.height);
    const dimensions = outputDimensions(asset);
    const pad = 28;
    const scale = Math.max(0.0001, Math.min(
      (stageWidth - pad * 2) / dimensions.width,
      (stageHeight - pad * 2) / dimensions.height
    ));
    const drawWidth = dimensions.width * scale;
    const drawHeight = dimensions.height * scale;
    return {
      x: (stageWidth - drawWidth) / 2,
      y: (stageHeight - drawHeight) / 2,
      drawWidth,
      drawHeight,
      scale,
      outputWidth: dimensions.width,
      outputHeight: dimensions.height,
      stageWidth,
      stageHeight
    };
  }

  function renderErasePreview() {
    const asset = getActiveAsset();
    const stage = getStageMetrics();
    previewCtx.clearRect(0, 0, stage.width, stage.height);
    state.manualStage = null;
    erase.mapping = asset ? fitMapping(asset) : null;

    if (!asset || !erase.mapping) {
      drawOverlay();
      return;
    }

    const output = renderOutput(asset);
    previewCtx.imageSmoothingEnabled = true;
    previewCtx.imageSmoothingQuality = "high";
    previewCtx.drawImage(
      output,
      erase.mapping.x,
      erase.mapping.y,
      erase.mapping.drawWidth,
      erase.mapping.drawHeight
    );
    ui.stageNote.textContent = `Batch Erase: ${erase.activeTool.toUpperCase()} tool. The same relative mask applies to every image. Click the active tool again or press Esc to stop.`;
    ui.stageNote.classList.add("visible");
    drawOverlay();
  }

  renderPreview = function renderPreviewWithBatchErase() {
    if (erase.activeTool) renderErasePreview();
    else {
      erase.mapping = null;
      baseRenderPreview();
      drawOverlay();
    }
  };

  function resizeOverlay() {
    const rect = overlay.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width;
      overlay.height = height;
    }
    overlayContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: rect.width, height: rect.height };
  }

  function screenPoint(point) {
    if (!erase.mapping) return { x: 0, y: 0 };
    return {
      x: erase.mapping.x + point.x * erase.mapping.drawWidth,
      y: erase.mapping.y + point.y * erase.mapping.drawHeight
    };
  }

  function drawDraft() {
    const draft = erase.draft;
    if (!draft || !erase.mapping) return;

    overlayContext.save();
    overlayContext.strokeStyle = "rgba(117,178,222,.98)";
    overlayContext.fillStyle = "rgba(117,178,222,.22)";
    overlayContext.lineWidth = 2;
    overlayContext.setLineDash([7, 5]);
    overlayContext.lineCap = "round";
    overlayContext.lineJoin = "round";

    if (draft.type === "box") {
      const start = screenPoint(draft.start);
      const end = screenPoint(draft.end);
      overlayContext.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
      overlayContext.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if ((draft.type === "lasso" || draft.type === "pen") && draft.points.length) {
      const first = screenPoint(draft.points[0]);
      overlayContext.beginPath();
      overlayContext.moveTo(first.x, first.y);
      draft.points.slice(1).forEach((point) => {
        const screen = screenPoint(point);
        overlayContext.lineTo(screen.x, screen.y);
      });
      if (draft.type === "lasso") {
        overlayContext.closePath();
        overlayContext.fill();
        overlayContext.stroke();
      } else {
        overlayContext.setLineDash([]);
        overlayContext.lineWidth = Math.max(1, erase.penSize * erase.mapping.scale);
        overlayContext.globalAlpha = .68;
        overlayContext.stroke();
      }
    }
    overlayContext.restore();
  }

  function drawPenCursor() {
    if (erase.activeTool !== "pen" || !erase.pointer?.inside || !erase.mapping) return;
    const radius = Math.max(2, erase.penSize * erase.mapping.scale / 2);
    overlayContext.save();
    overlayContext.beginPath();
    overlayContext.arc(erase.pointer.x, erase.pointer.y, radius, 0, Math.PI * 2);
    overlayContext.fillStyle = "rgba(154,47,79,.14)";
    overlayContext.strokeStyle = "rgba(255,255,255,.95)";
    overlayContext.lineWidth = 1.5;
    overlayContext.fill();
    overlayContext.stroke();
    overlayContext.restore();
  }

  function drawOverlay() {
    const size = resizeOverlay();
    overlayContext.clearRect(0, 0, size.width, size.height);
    if (!erase.activeTool || !erase.mapping) return;
    drawDraft();
    drawPenCursor();
  }

  function pointerData(event) {
    if (!erase.mapping) return null;
    const rect = overlay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const inside = x >= erase.mapping.x && x <= erase.mapping.x + erase.mapping.drawWidth &&
      y >= erase.mapping.y && y <= erase.mapping.y + erase.mapping.drawHeight;
    return {
      x,
      y,
      inside,
      normalised: {
        x: Math.max(0, Math.min(1, (x - erase.mapping.x) / erase.mapping.drawWidth)),
        y: Math.max(0, Math.min(1, (y - erase.mapping.y) / erase.mapping.drawHeight))
      }
    };
  }

  function pointDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function beginErase(event) {
    if (!erase.activeTool || !getActiveAsset()) return;
    const pointer = pointerData(event);
    erase.pointer = pointer;
    if (!pointer?.inside) {
      drawOverlay();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    erase.drawing = true;
    erase.pointerId = event.pointerId;
    overlay.setPointerCapture(event.pointerId);

    if (erase.activeTool === "box") {
      erase.draft = { type: "box", start: pointer.normalised, end: pointer.normalised };
    } else if (erase.activeTool === "lasso") {
      erase.draft = { type: "lasso", points: [pointer.normalised] };
    } else {
      erase.draft = {
        type: "pen",
        points: [pointer.normalised],
        sizeRatio: erase.penSize / Math.max(1, Math.min(erase.mapping.outputWidth, erase.mapping.outputHeight))
      };
    }
    drawOverlay();
  }

  function moveErase(event) {
    if (!erase.activeTool) return;
    const pointer = pointerData(event);
    erase.pointer = pointer;
    if (!erase.drawing || !erase.draft || !pointer) {
      drawOverlay();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (erase.draft.type === "box") {
      erase.draft.end = pointer.normalised;
    } else {
      const points = erase.draft.points;
      const previous = points[points.length - 1];
      const minimum = 2 / Math.max(1, Math.min(erase.mapping.drawWidth, erase.mapping.drawHeight));
      if (!previous || pointDistance(previous, pointer.normalised) >= minimum) points.push(pointer.normalised);
    }
    drawOverlay();
  }

  function commitDraft() {
    const draft = erase.draft;
    if (!draft) return false;
    if (draft.type === "box") {
      const width = Math.abs(draft.end.x - draft.start.x);
      const height = Math.abs(draft.end.y - draft.start.y);
      if (width < .002 || height < .002) return false;
    }
    if (draft.type === "lasso" && draft.points.length < 3) return false;
    erase.actions.push(draft);
    return true;
  }

  function endErase(event, cancelled = false) {
    if (!erase.drawing) return;
    event.preventDefault();
    event.stopPropagation();
    if (overlay.hasPointerCapture(erase.pointerId)) overlay.releasePointerCapture(erase.pointerId);
    const committed = !cancelled && commitDraft();
    erase.drawing = false;
    erase.pointerId = null;
    erase.draft = null;
    if (committed) {
      ensureTransparentOutput();
      updateEraseUi();
      renderPreview();
    } else drawOverlay();
  }

  function setActiveTool(tool) {
    const nextTool = erase.activeTool === tool ? null : tool;
    erase.activeTool = nextTool;
    erase.drawing = false;
    erase.draft = null;
    erase.pointer = null;
    erase.pointerId = null;
    ui.stageWrap.classList.toggle("erase-active", Boolean(nextTool));
    overlay.classList.toggle("pen-active", nextTool === "pen");
    updateEraseUi();
    renderPreview();
  }

  function stopEraseMode() {
    if (!erase.activeTool) return;
    erase.activeTool = null;
    erase.drawing = false;
    erase.draft = null;
    erase.pointer = null;
    erase.pointerId = null;
    ui.stageWrap.classList.remove("erase-active");
    overlay.classList.remove("pen-active");
    updateEraseUi();
    renderPreview();
  }

  function ensureTransparentOutput() {
    if (!erase.actions.length || !outputFormat || outputFormat.value !== "jpeg" || erase.formatGuard) return;
    erase.formatGuard = true;
    outputFormat.value = "png";
    outputFormat.dispatchEvent(new Event("change", { bubbles: true }));
    erase.formatGuard = false;
    toast("JPEG cannot retain transparency. Output switched to PNG.", "◫");
  }

  function updateEraseUi() {
    const disabled = state.assets.length === 0;
    toolButtons.forEach((button) => {
      const active = button.dataset.eraseTool === erase.activeTool;
      button.disabled = disabled;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    penSizeInput.disabled = disabled || erase.activeTool !== "pen";
    undoButton.disabled = disabled || erase.actions.length === 0;
    clearButton.disabled = disabled || erase.actions.length === 0;
    penSizeOutput.textContent = `${erase.penSize} px`;
    status.textContent = erase.activeTool ? erase.activeTool.toUpperCase() : "OFF";
    status.classList.toggle("active", Boolean(erase.activeTool));
    help.textContent = erase.activeTool
      ? `${erase.activeTool === "box" ? "Drag a box" : erase.activeTool === "lasso" ? "Draw around an area" : "Paint over an area"} on the image. The mask is applied to every image.`
      : erase.actions.length
        ? `${erase.actions.length} erase action${erase.actions.length === 1 ? "" : "s"} applied to the full batch. Choose a tool to add more.`
        : "Choose Box, Lasso or Pen, then draw on the preview. Click the selected tool again to stop.";
  }

  setUiDisabled = function setUiDisabledWithErase(disabled) {
    baseSetUiDisabled(disabled);
    updateEraseUi();
  };

  toolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.assets.length) return;
      setActiveTool(button.dataset.eraseTool);
    });
  });

  penSizeInput.addEventListener("input", () => {
    erase.penSize = Math.max(1, Number(penSizeInput.value) || 1);
    penSizeOutput.textContent = `${erase.penSize} px`;
    drawOverlay();
  });

  undoButton.addEventListener("click", () => {
    if (!erase.actions.length) return;
    erase.actions.pop();
    updateEraseUi();
    renderPreview();
    toast("Last batch erase action undone.", "↶");
  });

  clearButton.addEventListener("click", () => {
    if (!erase.actions.length) return;
    erase.actions = [];
    updateEraseUi();
    renderPreview();
    toast("Batch erase mask cleared.", "↺");
  });

  overlay.addEventListener("pointerdown", beginErase);
  overlay.addEventListener("pointermove", moveErase);
  overlay.addEventListener("pointerup", (event) => endErase(event, false));
  overlay.addEventListener("pointercancel", (event) => endErase(event, true));
  overlay.addEventListener("pointerleave", () => {
    if (!erase.drawing) {
      erase.pointer = null;
      drawOverlay();
    }
  });

  resizeCard?.addEventListener("pointerdown", stopEraseMode, true);
  outputFormat?.addEventListener("change", ensureTransparentOutput);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && erase.activeTool) stopEraseMode();
  });

  new MutationObserver(() => {
    if (!state.assets.length) {
      erase.actions = [];
      stopEraseMode();
    }
    updateEraseUi();
  }).observe(ui.assetDeck, { childList: true });

  new ResizeObserver(() => {
    if (erase.activeTool) renderErasePreview();
    else drawOverlay();
  }).observe(ui.stageWrap);

  updateEraseUi();
  drawOverlay();
})();
