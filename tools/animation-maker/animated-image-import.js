(() => {
    'use strict';

    const picker = document.getElementById('image-picker');
    const label = document.getElementById('upload-label');
    const frameGrid = document.getElementById('frame-grid');
    const delaySlider = document.getElementById('frame-delay');
    const sequenceName = document.getElementById('seq-name');
    if (!picker) return;

    picker.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp';
    if (label) label.textContent = '🏛️ UPLOAD IMAGES / ANIMATED GIF / WEBP';

    let replayingFrames = false;
    const importedAnimationLabels = [];

    function setStatus(text) {
        try { window.parent.postMessage({ type: 'set-status', text }, '*'); } catch (error) {}
    }
    function clearStatusLater() {
        window.setTimeout(() => {
            try { window.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {}
        }, 4500);
    }
    function isAnimationFile(file) {
        return /image\/(gif|webp)/i.test(file.type || '') || /\.(gif|webp)$/i.test(file.name || '');
    }
    function mimeFor(file) {
        return /\.gif$/i.test(file.name) || /image\/gif/i.test(file.type || '') ? 'image/gif' : 'image/webp';
    }
    function baseName(name) {
        return String(name || 'imported-animation').replace(/\.(gif|webp)$/i, '');
    }
    function frameCountNow() {
        return frameGrid ? frameGrid.querySelectorAll('.frame-thumb-wrapper').length : 0;
    }
    function wait(milliseconds) {
        return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    }
    async function waitForFrameImport(previousCount, addedCount) {
        const timeoutAt = Date.now() + 120000;
        while (Date.now() < timeoutAt) {
            if (frameCountNow() >= previousCount + addedCount) return;
            await wait(40);
        }
        throw new Error('The extracted animation frames could not be added to the Sequence Grid.');
    }
    function canvasBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to convert an extracted frame to PNG.')), 'image/png');
        });
    }
    async function canDecode(type) {
        if (typeof window.ImageDecoder !== 'function') return false;
        if (typeof window.ImageDecoder.isTypeSupported !== 'function') return true;
        return window.ImageDecoder.isTypeSupported(type);
    }
    async function decodeAnimation(file) {
        const type = mimeFor(file);
        if (!(await canDecode(type))) {
            throw new Error('This browser cannot extract animated GIF/WebP frames. Open the Animation Maker in a current Chrome or Edge browser.');
        }
        const decoder = new ImageDecoder({ data: new Uint8Array(await file.arrayBuffer()), type, preferAnimation: true });
        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        const count = Math.max(1, Number(track && track.frameCount) || 1);
        const files = [];
        const delays = [];
        const stem = baseName(file.name);
        for (let index = 0; index < count; index += 1) {
            setStatus(`Extracting ${file.name}: frame ${index + 1} of ${count}...`);
            const result = await decoder.decode({ frameIndex: index, completeFramesOnly: true });
            const frame = result.image;
            const width = frame.displayWidth || frame.codedWidth;
            const height = frame.displayHeight || frame.codedHeight;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(frame, 0, 0, width, height);
            delays.push(frame.duration ? Math.max(40, Math.round(frame.duration / 1000)) : 100);
            files.push(new File([await canvasBlob(canvas)], `${stem}-frame-${String(index + 1).padStart(4, '0')}.png`, { type: 'image/png' }));
            frame.close();
        }
        if (typeof decoder.close === 'function') decoder.close();
        return { files, delays, frameCount: count, type };
    }
    function median(values) {
        const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
        if (!ordered.length) return 100;
        return ordered[Math.floor(ordered.length / 2)];
    }
    function setInitialFrameDuration(delays) {
        if (!delaySlider || !delays.length) return;
        const duration = Math.max(Number(delaySlider.min) || 40, Math.min(Number(delaySlider.max) || 1000, median(delays)));
        delaySlider.value = String(duration);
        delaySlider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function refreshAnimationHeadings() {
        if (!frameGrid || !importedAnimationLabels.length) return;
        const headings = [...frameGrid.querySelectorAll('.clip-divider')];
        const used = new Set();
        importedAnimationLabels.forEach((source, sourceIndex) => {
            const candidate = headings.find((heading, headingIndex) => {
                if (used.has(headingIndex)) return false;
                const title = heading.querySelector('.clip-title-name');
                return title && title.textContent.includes(`Imported Images (${source.frames})`);
            });
            if (!candidate) return;
            const headingIndex = headings.indexOf(candidate);
            used.add(headingIndex);
            const type = candidate.querySelector('.clip-title span:first-child');
            const name = candidate.querySelector('.clip-title-name');
            if (type) type.textContent = `ANIMATION ${sourceIndex + 1}`;
            if (name) { name.textContent = `— ${source.name}`; name.title = source.name; }
        });
    }
    async function submitDecodedFrames(file, decoded) {
        const before = frameCountNow();
        const transfer = new DataTransfer();
        decoded.files.forEach((frameFile) => transfer.items.add(frameFile));
        picker.files = transfer.files;
        replayingFrames = true;
        picker.dispatchEvent(new Event('change', { bubbles: true }));
        replayingFrames = false;
        await waitForFrameImport(before, decoded.files.length);
        importedAnimationLabels.push({ name: file.name, frames: decoded.files.length });
        refreshAnimationHeadings();
    }
    if (frameGrid) {
        new MutationObserver(() => refreshAnimationHeadings()).observe(frameGrid, { childList: true, subtree: true });
    }

    document.addEventListener('change', async (event) => {
        if (event.target !== picker || replayingFrames) return;
        const selectedFiles = [...picker.files];
        const animatedFiles = selectedFiles.filter(isAnimationFile);
        if (!animatedFiles.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        picker.value = '';
        const wasEmpty = frameCountNow() === 0;
        try {
            const ordinaryFiles = selectedFiles.filter((file) => !isAnimationFile(file));
            if (ordinaryFiles.length) {
                const transfer = new DataTransfer();
                ordinaryFiles.forEach((file) => transfer.items.add(file));
                picker.files = transfer.files;
                replayingFrames = true;
                picker.dispatchEvent(new Event('change', { bubbles: true }));
                replayingFrames = false;
                await waitForFrameImport(frameCountNow() - ordinaryFiles.length, ordinaryFiles.length);
            }
            for (const file of animatedFiles) {
                const decoded = await decodeAnimation(file);
                await submitDecodedFrames(file, decoded);
                if (wasEmpty && importedAnimationLabels.length === 1) {
                    if (sequenceName) sequenceName.value = baseName(file.name);
                    setInitialFrameDuration(decoded.delays);
                }
                setStatus(`${file.name} imported as ${decoded.frameCount} editable frames.`);
            }
            clearStatusLater();
        } catch (error) {
            setStatus(`Animation import failed: ${error.message}`);
        } finally {
            picker.value = '';
        }
    }, true);
})();
