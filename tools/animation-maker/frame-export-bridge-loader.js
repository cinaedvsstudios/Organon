(() => {
  'use strict';

  const scriptUrl = document.currentScript?.src || location.href;
  const loaderUrl = new URL('./frame-skip-actions-loader.js?build=20260720-frame-export-1', scriptUrl).href;
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
  const exportBridgeNeedle = "    els.zipBtn.addEventListener('click', async () => {";
  const exportBridgeReplacement = \`    window.__organonAnimationMakerExport = {
      getFrameCount: () => state.frames.length,
      renderFrameCanvas: (index) => renderFrame(index, getDim()),
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