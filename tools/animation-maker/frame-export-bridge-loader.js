(() => {
  'use strict';

  const scriptUrl = document.currentScript?.src || location.href;
  const loaderUrl = new URL('./frame-skip-actions-loader.js?build=20260720-frame-export-3', scriptUrl).href;
  const request = new XMLHttpRequest();
  request.open('GET', loaderUrl, false);
  request.send(null);

  if ((request.status < 200 || request.status >= 300) && request.status !== 0) {
    console.error(`Could not load Animation Maker frame action engine (${request.status}).`);
    return;
  }

  let source = request.responseText;
  source = source.replace(
    "const scriptUrl = document.currentScript?.src || location.href;",
    `const scriptUrl = ${JSON.stringify(loaderUrl)};`
  );

  function videoFrameSignature(video, scratchCanvas) {
    const context = scratchCanvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(video, 0, 0, scratchCanvas.width, scratchCanvas.height);
    const pixels = context.getImageData(0, 0, scratchCanvas.width, scratchCanvas.height).data;
    let hash = 2166136261;
    for (let index = 0; index < pixels.length; index += 4) {
      hash ^= pixels[index] >> 1;
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 1] >> 1;
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 2] >> 1;
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  async function captureUniqueVideoFrames(video, file) {
    if (typeof video.requestVideoFrameCallback !== 'function') {
      throw new Error('Accurate source-frame capture requires a current Chrome or Edge browser.');
    }

    if (video.readyState < 2) {
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = reject;
      });
    }

    video.muted = true;
    video.playsInline = true;
    video.playbackRate = 0.25;
    video.currentTime = 0;

    const canvas = makeCanvas(video.videoWidth, video.videoHeight);
    const context = canvas.getContext('2d');
    const signatureCanvas = makeCanvas(48, 48);
    const frames = [];
    let repeatedFrames = 0;
    let lastMediaTime = -1;
    let lastSignature = null;
    let callbackId = 0;
    let watchdog = 0;
    let settled = false;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(watchdog);
        if (callbackId && typeof video.cancelVideoFrameCallback === 'function') {
          video.cancelVideoFrameCallback(callbackId);
        }
        video.pause();
        video.removeEventListener('ended', finish);
        video.removeEventListener('error', fail);
      };

      const fail = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`The browser could not decode ${file.name}.`));
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (!frames.length) {
          reject(new Error(`No presented video frames were decoded from ${file.name}.`));
          return;
        }
        frames[0].sourceTimeMs = 0;
        resolve({ frames, repeatedFrames });
      };

      const resetWatchdog = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error(`Accurate frame capture stalled while decoding ${file.name}.`));
        }, 15000);
      };

      const requestNext = () => {
        if (settled) return;
        callbackId = video.requestVideoFrameCallback(onFrame);
      };

      const onFrame = (_now, metadata) => {
        if (settled) return;
        resetWatchdog();

        const mediaTime = Math.max(0, Number(metadata && metadata.mediaTime) || Number(video.currentTime) || 0);
        if (mediaTime <= lastMediaTime + 0.000001) {
          requestNext();
          return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const signature = videoFrameSignature(video, signatureCanvas);

        if (frames.length && signature === lastSignature) {
          repeatedFrames += 1;
        } else {
          frames.push({
            base64: canvas.toDataURL('image/jpeg', 0.92),
            sourceTimeMs: Math.round(mediaTime * 1000),
            w: canvas.width,
            h: canvas.height
          });
          lastSignature = signature;
        }

        lastMediaTime = mediaTime;
        const percent = video.duration > 0 ? Math.min(100, Math.round((mediaTime / video.duration) * 100)) : 0;
        setHubStatus(`Capturing ${file.name}: ${percent}% — ${frames.length} unique frames`);
        requestNext();
      };

      video.addEventListener('ended', finish, { once: true });
      video.addEventListener('error', fail, { once: true });
      resetWatchdog();
      requestNext();
      video.play().catch((error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`The browser could not start accurate capture: ${error.message}`));
      });
    });
  }

  function buildImportedVideoFrames(uniqueFrames, durationMs, captureMode) {
    const sourceFrames = uniqueFrames
      .map((frame, index) => ({
        ...frame,
        sourceIndex: index,
        sourceTimeMs: Math.max(0, Math.min(durationMs, Number(frame.sourceTimeMs) || 0))
      }))
      .sort((a, b) => a.sourceTimeMs - b.sourceTimeMs);

    if (!sourceFrames.length) return [];
    sourceFrames[0].sourceTimeMs = 0;

    let selected;
    if (captureMode === 'auto') {
      selected = sourceFrames.map((frame) => ({ frame, timelineStartMs: frame.sourceTimeMs }));
    } else {
      const targetFps = Math.max(1, Number(captureMode) || 30);
      const stepMs = 1000 / targetFps;
      selected = [];
      let sourceIndex = 0;

      for (let timeMs = 0; timeMs < durationMs; timeMs += stepMs) {
        while (
          sourceIndex + 1 < sourceFrames.length &&
          sourceFrames[sourceIndex + 1].sourceTimeMs <= timeMs + 0.5
        ) {
          sourceIndex += 1;
        }

        const sourceFrame = sourceFrames[sourceIndex];
        if (!selected.length || selected[selected.length - 1].frame.sourceIndex !== sourceFrame.sourceIndex) {
          selected.push({ frame: sourceFrame, timelineStartMs: timeMs });
        }
      }
    }

    if (!selected.length) selected = [{ frame: sourceFrames[0], timelineStartMs: 0 }];

    return selected.map((entry, index) => {
      const nextStart = index + 1 < selected.length ? selected[index + 1].timelineStartMs : durationMs;
      return {
        ...entry.frame,
        durationMs: Math.max(1, nextStart - entry.timelineStartMs)
      };
    });
  }

  async function accurateVideoChangeHandler(event) {
    const file = event.target.files[0];
    if (!file) return;

    const empty = state.frames.length === 0;
    if (empty) $('seq-name').value = file.name.replace(/\.[^/.]+$/, '') || 'animation-export';

    const clip = createClip(file.name, 'video');
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    els.viewport.innerHTML = `<div class="loader"></div><p class="help-text">Capturing unique source frames from ${file.name}...</p>`;
    els.outputCard.hidden = false;
    setHubStatus(`Preparing accurate source-frame capture for ${file.name}...`);

    try {
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
        video.load();
      });

      const sourceDurationMs = Math.max(1, video.duration * 1000);
      const captureMode = $('video-capture-fps')?.value || 'auto';
      const captured = await captureUniqueVideoFrames(video, file);
      const importedFrames = buildImportedVideoFrames(captured.frames, sourceDurationMs, captureMode);

      if (!importedFrames.length) throw new Error('No unique frames remained after source-frame capture.');

      clip.durationMs = sourceDurationMs;
      clip.captureFps = captureMode;
      importedFrames.forEach((frame) => {
        state.frames.push({
          id: makeId('frame'),
          clipId: clip.id,
          base64: frame.base64,
          w: frame.w,
          h: frame.h,
          offsetX: 0,
          offsetY: 0,
          sourceTimeMs: frame.sourceTimeMs,
          durationMs: frame.durationMs
        });
      });

      if (empty) {
        const averageDuration = sourceDurationMs / importedFrames.length;
        $('frame-delay').value = String(Math.max(1, Math.round(averageDuration)));
        $('frame-delay').dispatchEvent(new Event('input', { bubbles: true }));
      }

      const effectiveFps = importedFrames.length / (sourceDurationMs / 1000);
      const modeLabel = captureMode === 'auto' ? 'source timing' : `${captureMode} FPS cap`;
      setHubStatus(
        `${file.name} imported as ${importedFrames.length} unique frames at ${effectiveFps.toFixed(2)} effective FPS (${modeLabel}); ${captured.repeatedFrames} repeated frames collapsed.`
      );
      setTimeout(clearHubStatus, 6500);
    } catch (error) {
      state.clips = state.clips.filter((entry) => entry.id !== clip.id);
      setHubStatus(`Video extraction failed: ${error.message}`);
    }

    URL.revokeObjectURL(url);
    els.videoPicker.value = '';
    els.outputCard.hidden = true;
    els.viewport.innerHTML = '';
    onFramesChanged();
  }

  function frameStoredDuration(frame, fallback) {
    const value = Number(frame && frame.durationMs);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function buildOutputTimeline() {
    const fallback = Math.max(1, parseInt($('frame-delay').value, 10) || 200);
    if (!state.frames.length) return [];

    const storedDurations = state.frames.map((frame) => frameStoredDuration(frame, fallback));
    const storedAverage = storedDurations.reduce((sum, value) => sum + value, 0) / storedDurations.length || fallback;
    const timingScale = fallback / storedAverage;
    const skip = Math.max(1, parseInt($('adj-skip').value, 10) || 1);
    let timeline = [];

    for (let sourceIndex = 0; sourceIndex < state.frames.length; sourceIndex += skip) {
      let durationMs = 0;
      for (let index = sourceIndex; index < Math.min(state.frames.length, sourceIndex + skip); index += 1) {
        durationMs += storedDurations[index];
      }
      timeline.push({
        sourceIndex,
        sourceTimeMs: Number.isFinite(Number(state.frames[sourceIndex].sourceTimeMs))
          ? Number(state.frames[sourceIndex].sourceTimeMs)
          : null,
        durationMs: Math.max(1, durationMs * timingScale)
      });
    }

    if ($('chk-reverse').checked) timeline.reverse();
    if ($('chk-forverse').checked) {
      timeline = timeline.concat([...timeline].reverse().map((entry) => ({ ...entry })));
    }

    return timeline.map((entry, outputIndex) => ({ ...entry, outputIndex }));
  }

  const insertionPoint = "  const script = document.createElement('script');";
  const bridgePatch = `
  const videoHandlerStart = "    els.videoPicker.addEventListener('change', async (event) => {";
  const videoHandlerEnd = "    function removeClip(id) {";
  const videoStartIndex = source.indexOf(videoHandlerStart);
  const videoEndIndex = source.indexOf(videoHandlerEnd, videoStartIndex);
  if (videoStartIndex >= 0 && videoEndIndex > videoStartIndex) {
    const videoReplacement = \`    ${videoFrameSignature.toString()}

    ${captureUniqueVideoFrames.toString()}

    ${buildImportedVideoFrames.toString()}

    els.videoPicker.addEventListener('change', ${accurateVideoChangeHandler.toString()});

\`;
    source = source.slice(0, videoStartIndex) + videoReplacement + source.slice(videoEndIndex);
  } else {
    console.error('Animation Maker video import handler patch point missing.');
  }

  const exportBridgeNeedle = "    els.zipBtn.addEventListener('click', async () => {";
  const exportBridgeReplacement = \`    ${frameStoredDuration.toString()}

    ${buildOutputTimeline.toString()}

    window.__organonAnimationMakerExport = {
      getFrameCount: () => state.frames.length,
      getOutputFrameCount: () => buildOutputTimeline().length,
      getOutputIndices: () => buildOutputTimeline().map((entry) => entry.sourceIndex),
      getOutputTimeline: () => buildOutputTimeline(),
      getOutputTiming: () => buildOutputTimeline(),
      getOutputDurationMs: () => buildOutputTimeline().reduce((sum, entry) => sum + entry.durationMs, 0),
      renderFrameCanvas: (index) => renderFrame(index, getDim()),
      renderOutputFrameCanvas: (position) => { const timeline = buildOutputTimeline(); return renderFrame(timeline[position].sourceIndex, getDim()); },
      getFrameDelay: () => parseInt($('frame-delay').value, 10) || 200,
      setFrameDelay: (value) => { const input = $('frame-delay'); const minimum = parseInt(input.min, 10) || 1; const maximum = parseInt(input.max, 10) || 10000; const next = clamp(Math.round(Number(value) || minimum), minimum, maximum); input.value = String(next); input.dispatchEvent(new Event('input', { bubbles: true })); return next; },
      getOutputFormat: () => $('opt-format').value,
      getSequenceName: () => safeName(),
      setStatus: setHubStatus,
      clearStatus: clearHubStatus,
      downloadBlob
    };

    els.zipBtn.addEventListener('click', async () => {\`;
  if (source.includes(exportBridgeNeedle)) {
    source = source.replace(exportBridgeNeedle, exportBridgeReplacement);
  } else {
    console.error('Animation Maker export bridge patch point missing.');
  }

`;

  if (!source.includes(insertionPoint)) {
    console.error('Animation Maker frame action loader insertion point missing.');
    return;
  }
  source = source.replace(insertionPoint, `${bridgePatch}${insertionPoint}`);

  const script = document.createElement('script');
  script.textContent = `${source}\n//# sourceURL=${loaderUrl}`;
  document.head.appendChild(script);
  script.remove();
})();
