(() => {
    'use strict';

    const picker = document.getElementById('video-picker');
    const addButton = document.getElementById('btn-convert-movie');
    if (!picker) return;

    picker.multiple = true;
    if (addButton) addButton.textContent = 'ADD VIDEO CLIPS';

    let replayingSingleFile = false;

    function setStatus(text) {
        try { window.parent.postMessage({ type: 'set-status', text }, '*'); } catch (error) {}
    }

    function wait(milliseconds) {
        return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    }

    async function waitUntilImportFinishes(filename) {
        const timeoutAt = Date.now() + (10 * 60 * 1000);
        while (picker.files.length > 0 && Date.now() < timeoutAt) {
            await wait(150);
        }
        if (picker.files.length > 0) {
            picker.value = '';
            throw new Error(`Timed out while importing ${filename}.`);
        }
        await wait(100);
    }

    picker.addEventListener('change', async (event) => {
        if (replayingSingleFile) return;

        const files = [...picker.files];
        if (files.length <= 1) return;

        event.stopImmediatePropagation();
        picker.value = '';
        replayingSingleFile = true;
        setStatus(`Importing ${files.length} video clips in sequence...`);

        try {
            for (const file of files) {
                const transfer = new DataTransfer();
                transfer.items.add(file);
                picker.files = transfer.files;
                picker.dispatchEvent(new Event('change', { bubbles: true }));
                await waitUntilImportFinishes(file.name);
            }
            setStatus(`${files.length} video clips imported. Use REORDER CLIPS to change playback order.`);
            window.setTimeout(() => {
                try { window.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {}
            }, 4500);
        } catch (error) {
            setStatus(error.message);
        } finally {
            picker.value = '';
            replayingSingleFile = false;
        }
    }, true);
})();

(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const editorModal = $('frame-editor-modal');
    const viewport = $('canvas-viewport');
    const canvas = $('frame-editor-canvas');
    const dimension = $('max-dimension');
    const dimensionLabel = $('dimension-value');
    const toolGrid = $('tool-grid');
    const playButton = $('editor-play');
    const zoomTools = document.querySelector('.zoom-tools');
    if (!editorModal || !viewport || !canvas || !dimension || !toolGrid || !playButton || !zoomTools) return;

    const styles = document.createElement('style');
    styles.textContent = `
        .editor-nav { gap: 7px; }
        .editor-nav .top-editor-tools {
            display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin-left: 5px; padding-left: 8px;
            border-left: 1px solid rgba(137,107,73,.55);
        }
        .editor-nav .top-editor-tools button {
            min-height: 32px; padding: 4px 9px; border: 1px solid rgba(137,107,73,.6); border-radius: 7px;
            background: #34352f; color: var(--alabaster-paper); font-size: .66rem;
        }
        .editor-nav .top-editor-tools button.active { border-color: var(--water-spray); background: var(--water-blue); }
        .zoom-tools .history-inline {
            height: 32px; padding: 0 10px; border: 1px solid var(--chiseled-bronze); border-radius: 7px;
            background: #191a19; color: var(--water-spray); font: 700 .65rem var(--font-mono);
        }
        .editor-resolution-note {
            margin-left: 5px; padding: 5px 8px; border: 1px solid rgba(117,178,222,.35); border-radius: 999px;
            color: rgba(117,178,222,.86); font: .57rem var(--font-mono); white-space: nowrap;
        }
        .workspace-pan-layer { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; will-change: transform; }
        .canvas-viewport.middle-pan-active { cursor: grabbing; }
        .brush-samples button { transition: background .12s ease, box-shadow .12s ease, border-color .12s ease; }
        .brush-samples button.selected-sample { border-color: var(--water-spray); box-shadow: 0 0 0 2px var(--water-blue), 0 0 8px rgba(117,178,222,.65); }
        .bucket-preview-box { margin: 10px 0 9px; padding: 8px; border: 1px solid rgba(137,107,73,.42); border-radius: 9px; background: #151616; }
        .bucket-preview-label { display: flex; justify-content: space-between; margin: 0 0 6px; color: var(--water-spray); font: .6rem var(--font-mono); }
        #bucket-setting-preview { display: block; width: 100%; height: auto; border: 1px solid rgba(137,107,73,.5); border-radius: 6px; }
        @media (max-width: 680px) {
            .editor-nav .top-editor-tools { width: 100%; order: 3; margin: 6px 0 0; padding: 7px 0 0; border-left: 0; border-top: 1px solid rgba(137,107,73,.45); }
            .editor-resolution-note { width: 100%; margin: 5px 0 0; }
        }
    `;
    document.head.appendChild(styles);

    const toolContainer = toolGrid.closest('.tool-group');
    toolGrid.classList.remove('tool-grid');
    toolGrid.classList.add('top-editor-tools');
    playButton.insertAdjacentElement('afterend', toolGrid);
    if (toolContainer) toolContainer.remove();

    const undoButton = $('undo-edit');
    const redoButton = $('redo-edit');
    const historyContainer = undoButton ? undoButton.closest('.history-tools') : null;
    if (undoButton && redoButton) {
        undoButton.classList.add('history-inline');
        redoButton.classList.add('history-inline');
        $('zoom-reset').insertAdjacentElement('afterend', redoButton);
        $('zoom-reset').insertAdjacentElement('afterend', undoButton);
        if (historyContainer) historyContainer.remove();
    }

    const resolutionNote = document.createElement('span');
    resolutionNote.className = 'editor-resolution-note';
    resolutionNote.hidden = true;
    const previewBackground = $('preview-background');
    if (previewBackground) zoomTools.insertBefore(resolutionNote, previewBackground);
    else zoomTools.appendChild(resolutionNote);

    const panLayer = document.createElement('div');
    panLayer.className = 'workspace-pan-layer';
    canvas.parentNode.insertBefore(panLayer, canvas);
    panLayer.appendChild(canvas);
    let outerPanX = 0;
    let outerPanY = 0;
    let middlePanning = false;
    let middlePointerId = null;
    let startPointerX = 0;
    let startPointerY = 0;
    let startPanX = 0;
    let startPanY = 0;
    function applyOuterPan() { panLayer.style.transform = `translate(${outerPanX}px, ${outerPanY}px)`; }
    function resetOuterPan() { outerPanX = 0; outerPanY = 0; applyOuterPan(); }
    viewport.addEventListener('pointerdown', (event) => {
        if (event.button !== 1 || editorModal.hidden) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        middlePanning = true;
        middlePointerId = event.pointerId;
        startPointerX = event.clientX;
        startPointerY = event.clientY;
        startPanX = outerPanX;
        startPanY = outerPanY;
        viewport.classList.add('middle-pan-active');
        viewport.setPointerCapture(event.pointerId);
    }, true);
    viewport.addEventListener('pointermove', (event) => {
        if (!middlePanning || event.pointerId !== middlePointerId) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        outerPanX = startPanX + event.clientX - startPointerX;
        outerPanY = startPanY + event.clientY - startPointerY;
        applyOuterPan();
    }, true);
    function stopMiddlePan(event) {
        if (!middlePanning || (event && event.pointerId !== middlePointerId)) return;
        middlePanning = false;
        middlePointerId = null;
        viewport.classList.remove('middle-pan-active');
    }
    viewport.addEventListener('pointerup', stopMiddlePan, true);
    viewport.addEventListener('pointercancel', stopMiddlePan, true);
    viewport.addEventListener('auxclick', (event) => { if (event.button === 1) event.preventDefault(); }, true);
    $('zoom-fit').addEventListener('click', resetOuterPan, true);
    $('zoom-reset').addEventListener('click', resetOuterPan, true);

    let savedExportDimension = null;
    const interactiveLimit = 720;
    function enterOptimisedPreview() {
        if (savedExportDimension !== null) return;
        savedExportDimension = parseInt(dimension.value, 10) || interactiveLimit;
        const previewSize = Math.min(savedExportDimension, interactiveLimit);
        if (previewSize < savedExportDimension) {
            dimension.value = String(previewSize);
            dimensionLabel.textContent = `${previewSize} px`;
            resolutionNote.textContent = `INTERACTIVE PREVIEW ${previewSize}px • EXPORT ${savedExportDimension}px`;
        } else {
            resolutionNote.textContent = `INTERACTIVE PREVIEW = EXPORT ${previewSize}px`;
        }
        resolutionNote.hidden = false;
    }
    function restoreExportDimension() {
        if (savedExportDimension === null) return;
        dimension.value = String(savedExportDimension);
        dimensionLabel.textContent = `${savedExportDimension} px`;
        savedExportDimension = null;
        resolutionNote.hidden = true;
        resetOuterPan();
    }
    document.addEventListener('click', (event) => {
        if (event.target.closest('#open-editor-btn')) enterOptimisedPreview();
        if (event.target.closest('[data-close="frame-editor-modal"]')) restoreExportDimension();
    }, true);

    let lastPermittedDrawMove = 0;
    canvas.addEventListener('pointermove', (event) => {
        if (middlePanning || event.buttons !== 1) return;
        const panSelected = document.querySelector('#tool-grid [data-tool="pan"]')?.classList.contains('active');
        if (panSelected) return;
        const now = performance.now();
        if (now - lastPermittedDrawMove < 42) {
            event.stopImmediatePropagation();
            return;
        }
        lastPermittedDrawMove = now;
    }, true);

    const brushColour = $('brush-color');
    const brushSoftness = $('brush-softness');
    const brushSize = $('brush-size');
    const brushSamples = [...document.querySelectorAll('#brush-samples [data-brush-size]')];
    function updateBrushSamples() {
        if (!brushColour || !brushSoftness || !brushSize) return;
        const colour = brushColour.value;
        const softness = parseInt(brushSoftness.value, 10) || 0;
        const hardEdge = Math.max(2, Math.round(96 - softness * .86));
        brushSamples.forEach((button) => {
            button.style.background = softness === 0
                ? colour
                : `radial-gradient(circle, ${colour} 0%, ${colour} ${hardEdge}%, transparent 100%)`;
            button.classList.toggle('selected-sample', button.dataset.brushSize === brushSize.value);
        });
    }
    if (brushColour && brushSoftness && brushSize) {
        brushColour.addEventListener('input', updateBrushSamples);
        brushSoftness.addEventListener('input', updateBrushSamples);
        brushSize.addEventListener('input', updateBrushSamples);
        brushSamples.forEach((button) => button.addEventListener('click', () => window.setTimeout(updateBrushSamples, 0)));
        updateBrushSamples();
    }

    const clearBuckets = $('clear-buckets');
    const bucketMode = $('bucket-mode');
    const bucketTolerance = $('bucket-tolerance');
    const bucketFeather = $('bucket-feather');
    if (clearBuckets && bucketMode && bucketTolerance && bucketFeather && brushColour) {
        const previewBox = document.createElement('div');
        previewBox.className = 'bucket-preview-box';
        previewBox.innerHTML = '<p class="bucket-preview-label"><span>SETTING PREVIEW</span><span id="bucket-preview-description"></span></p><canvas id="bucket-setting-preview" width="220" height="100"></canvas>';
        clearBuckets.parentNode.insertBefore(previewBox, clearBuckets);
        const previewCanvas = $('bucket-setting-preview');
        const previewDescription = $('bucket-preview-description');
        function checker(ctx, width, height) {
            ctx.fillStyle = '#eee'; ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#cfcfcf';
            for (let y = 0; y < height; y += 10) for (let x = 0; x < width; x += 10) if (((x / 10) + (y / 10)) % 2 === 0) ctx.fillRect(x, y, 10, 10);
        }
        function roundedArch(ctx) {
            ctx.beginPath();
            ctx.moveTo(70, 84); ctx.lineTo(70, 48); ctx.bezierCurveTo(70, 16, 150, 16, 150, 48); ctx.lineTo(150, 84); ctx.closePath();
        }
        function renderBucketPreview() {
            const ctx = previewCanvas.getContext('2d');
            const selectedMode = bucketMode.querySelector('.active')?.dataset.bucketMode || 'transparent';
            const tolerance = parseInt(bucketTolerance.value, 10) || 0;
            const feather = parseInt(bucketFeather.value, 10) || 0;
            const reach = Math.min(12, Math.round(tolerance / 10));
            checker(ctx, previewCanvas.width, previewCanvas.height);
            if (selectedMode === 'colour') {
                ctx.fillStyle = brushColour.value;
                ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                previewDescription.textContent = 'COLOUR FILL';
            } else {
                previewDescription.textContent = 'TRANSPARENT';
            }
            ctx.save();
            if (selectedMode === 'transparent' && feather > 0) {
                ctx.shadowColor = 'rgba(138,104,72,.62)';
                ctx.shadowBlur = feather * .85;
            }
            ctx.fillStyle = '#a77b58'; roundedArch(ctx); ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.fillStyle = '#251d19';
            ctx.beginPath(); ctx.moveTo(80, 84); ctx.lineTo(80, 49); ctx.bezierCurveTo(80, 27, 140, 27, 140, 49); ctx.lineTo(140, 84); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#b18f6e'; ctx.beginPath(); ctx.ellipse(111, 62, 21, 17, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(104, 58, 2, 0, Math.PI * 2); ctx.arc(118, 58, 2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            if (reach > 0) {
                ctx.save();
                ctx.globalAlpha = Math.min(.7, tolerance / 150);
                ctx.strokeStyle = selectedMode === 'colour' ? brushColour.value : '#ffffff';
                ctx.lineWidth = reach;
                roundedArch(ctx); ctx.stroke();
                ctx.restore();
            }
            ctx.fillStyle = selectedMode === 'transparent' ? '#3c4650' : '#101111';
            ctx.font = '10px monospace';
            ctx.fillText(`tol ${tolerance}  feather ${feather}`, 7, 94);
        }
        bucketMode.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => window.setTimeout(renderBucketPreview, 0)));
        bucketTolerance.addEventListener('input', renderBucketPreview);
        bucketFeather.addEventListener('input', renderBucketPreview);
        brushColour.addEventListener('input', renderBucketPreview);
        renderBucketPreview();
    }
})();
