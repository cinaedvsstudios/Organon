(() => {
  'use strict';

  const scriptUrl = document.currentScript?.src || location.href;
  const loaderUrl = new URL('./frame-skip-actions-loader.js?build=20260720-frame-export-2', scriptUrl).href;
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

  const insertionPoint = "  const script = document.createElement('script');";
  const bridgePatch = `
  const videoSetupNeedle = "            const fps = 12, total = Math.max(1, Math.floor(video.duration * fps)), canvas = makeCanvas(video.videoWidth, video.videoHeight), ctx = canvas.getContext('2d');";
  const videoSetupReplacement = "            const fps = Math.max(1, parseInt($('video-capture-fps')?.value, 10) || 30), sourceDurationMs = Math.max(0, video.duration * 1000), total = Math.max(1, Math.ceil(video.duration * fps)), frameDurationMs = sourceDurationMs > 0 ? sourceDurationMs / total : 1000 / fps, canvas = makeCanvas(video.videoWidth, video.videoHeight), ctx = canvas.getContext('2d'); clip.durationMs = sourceDurationMs; clip.captureFps = fps;";
  if (source.includes(videoSetupNeedle)) source = source.replace(videoSetupNeedle, videoSetupReplacement);
  else console.error('Animation Maker video timing setup patch point missing.');

  const videoSeekNeedle = "                await new Promise((resolve) => { video.onseeked = resolve; video.currentTime = Math.min(index / fps, video.duration || index / fps); });";
  const videoSeekReplacement = "                const sourceTime = Math.min(index / fps, Math.max(0, (video.duration || 0) - 0.001)); await new Promise((resolve) => { if (Math.abs(video.currentTime - sourceTime) < 0.0005) { resolve(); return; } const timeout = setTimeout(() => { video.onseeked = null; resolve(); }, 2500); video.onseeked = () => { clearTimeout(timeout); video.onseeked = null; resolve(); }; video.currentTime = sourceTime; });";
  if (source.includes(videoSeekNeedle)) source = source.replace(videoSeekNeedle, videoSeekReplacement);
  else console.error('Animation Maker video seek patch point missing.');

  const videoFrameNeedle = "                state.frames.push({ id: makeId('frame'), clipId: clip.id, base64: canvas.toDataURL('image/jpeg', .85), w: canvas.width, h: canvas.height, offsetX: 0, offsetY: 0 });";
  const videoFrameReplacement = "                state.frames.push({ id: makeId('frame'), clipId: clip.id, base64: canvas.toDataURL('image/jpeg', .9), w: canvas.width, h: canvas.height, offsetX: 0, offsetY: 0, sourceTimeMs: Math.round(sourceTime * 1000), durationMs: frameDurationMs });";
  if (source.includes(videoFrameNeedle)) source = source.replace(videoFrameNeedle, videoFrameReplacement);
  else console.error('Animation Maker video frame metadata patch point missing.');

  const videoCompletePattern = /            setHubStatus\\(\`[^\\n]*added with[^\\n]*frames\\.\`\\); setTimeout\\(clearHubStatus, 4000\\);/;
  const videoCompleteReplacement = "            if (empty && sourceDurationMs > 0) { const recommendedDelay = Math.max(1, Math.round(sourceDurationMs / total)); $('frame-delay').value = String(recommendedDelay); $('frame-delay').dispatchEvent(new Event('input', { bubbles: true })); } setHubStatus(file.name + ' added with ' + total + ' frames at ' + fps + ' FPS.'); setTimeout(clearHubStatus, 4000);";
  if (videoCompletePattern.test(source)) source = source.replace(videoCompletePattern, videoCompleteReplacement);
  else console.error('Animation Maker video completion patch point missing.');

  const exportBridgeNeedle = "    els.zipBtn.addEventListener('click', async () => {";
  const exportBridgeReplacement = \`    window.__organonAnimationMakerExport = {
      getFrameCount: () => state.frames.length,
      getOutputFrameCount: () => outputIndices().length,
      getOutputIndices: () => outputIndices(),
      getOutputTiming: () => outputIndices().map((sourceIndex, outputIndex) => ({ outputIndex, sourceIndex, sourceTimeMs: state.frames[sourceIndex]?.sourceTimeMs ?? null, sourceDurationMs: state.frames[sourceIndex]?.durationMs ?? null })),
      renderFrameCanvas: (index) => renderFrame(index, getDim()),
      renderOutputFrameCanvas: (position) => { const indices = outputIndices(); return renderFrame(indices[position], getDim()); },
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
