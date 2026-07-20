(() => {
  'use strict';

  const scriptUrl = document.currentScript?.src || location.href;
  const baseLoaderUrl = new URL('./frame-export-bridge-loader.js?build=20260720-5', scriptUrl).href;
  const request = new XMLHttpRequest();
  request.open('GET', baseLoaderUrl, false);
  request.send(null);

  if ((request.status < 200 || request.status >= 300) && request.status !== 0) {
    console.error(`Could not load Animation Maker export engine (${request.status}).`);
    return;
  }

  let source = request.responseText;
  source = source.replace(
    "const scriptUrl = document.currentScript?.src || location.href;",
    `const scriptUrl = ${JSON.stringify(baseLoaderUrl)};`
  );

  const shadowSource = `    function applyShadow(source, dim) {
        const scale = dim / getDim();
        const core = window.__organonAdvancedBackgroundCore;
        if (!core || typeof core.applySafeShadow !== 'function') return source;
        return core.applySafeShadow(source, {
            enabled: Boolean($('chk-shadow')?.checked),
            color: $('shadow-color')?.value || '#000000',
            opacity: (parseInt($('shadow-opacity')?.value, 10) || 0) / 100,
            blur: (parseInt($('shadow-blur')?.value, 10) || 0) * scale,
            offsetX: (parseInt($('shadow-x')?.value, 10) || 0) * scale,
            offsetY: (parseInt($('shadow-y')?.value, 10) || 0) * scale
        });
    }`;

  const bridgeSource = `    window.__organonAdvancedBackgroundBridge = {
        getFrameIds: () => state.frames.map((frame) => frame.id),
        getCurrentFrameId: () => state.frames[state.editorIndex]?.id || null,
        getCurrentFrameNumber: () => state.editorIndex + 1,
        getCurrentAction: () => state.advancedBackgroundActions[state.frames[state.editorIndex]?.id] || null,
        setActions: (frameIds, config) => {
            frameIds.forEach((frameId) => { state.advancedBackgroundActions[frameId] = JSON.parse(JSON.stringify(config)); });
            checkpoint(); renderEditor(); refreshPreviews();
        },
        clearActions: (frameIds) => {
            frameIds.forEach((frameId) => { delete state.advancedBackgroundActions[frameId]; });
            checkpoint(); renderEditor(); refreshPreviews();
        },
        getCanvas: () => els.editorCanvas,
        pointFromEvent,
        setStatus: setHubStatus,
        clearStatus: clearHubStatus
    };`;

  const advancedPatchCode = `
  const stateNeedle = "bulkRemovedFrames: new Map(), bulkRestoreOrder: new Map(), bulkRestoreBaseFrameId: null,";
  if (source.includes(stateNeedle)) source = source.replace(stateNeedle, stateNeedle + "\\n        advancedBackgroundActions: {},");
  else console.error('Animation Maker advanced background state patch point missing.');

  const alphaNeedle = "    function requiresAlpha() { return $('chk-transparent').checked || state.cutoutActions.length || state.bucketActions.some((action) => action.mode === 'transparent'); }";
  const alphaReplacement = "    function requiresAlpha() { return $('chk-transparent').checked || state.cutoutActions.length || state.bucketActions.some((action) => action.mode === 'transparent') || Object.keys(state.advancedBackgroundActions || {}).length; }";
  if (source.includes(alphaNeedle)) source = source.replace(alphaNeedle, alphaReplacement);
  else console.error('Animation Maker advanced alpha patch point missing.');

  const renderNeedle = "        state.bucketActions.forEach((action) => applyBucketFill(output, action, dim));\\n        if ($('chk-transparent').checked) applyChroma(output.getContext('2d', { willReadFrequently: true }), dim);";
  const renderReplacement = renderNeedle + "\\n        const advancedConfig = state.advancedBackgroundActions[state.frames[index]?.id];\\n        if (advancedConfig && window.__organonAdvancedBackgroundCore?.apply) window.__organonAdvancedBackgroundCore.apply(output, advancedConfig, dim);";
  if (source.includes(renderNeedle)) source = source.replace(renderNeedle, renderReplacement);
  else console.error('Animation Maker advanced render patch point missing.');

  const targetNeedle = "    function activateTarget(target) { edit.target = target; qsa('#target-mode button').forEach((button) => button.classList.toggle('active', button.dataset.target === target)); $('cutout-panel').hidden = target !== 'cutout'; $('paint-panel').hidden = target !== 'paint'; $('moving-panel').hidden = target !== 'moving'; }";
  const targetReplacement = "    function activateTarget(target) { edit.target = target; qsa('#target-mode button').forEach((button) => button.classList.toggle('active', button.dataset.target === target)); $('cutout-panel').hidden = target !== 'cutout'; $('paint-panel').hidden = target !== 'paint'; $('moving-panel').hidden = target !== 'moving'; $('advanced-background-panel').hidden = target !== 'advanced'; }";
  if (source.includes(targetNeedle)) source = source.replace(targetNeedle, targetReplacement);
  else console.error('Animation Maker advanced target patch point missing.');

  const pointerNeedle = "    els.editorCanvas.addEventListener('pointerdown', (event) => {\\n        if (edit.tool === 'pan')";
  const pointerReplacement = "    els.editorCanvas.addEventListener('pointerdown', (event) => {\\n        if (edit.target === 'advanced') return;\\n        if (edit.tool === 'pan')";
  if (source.includes(pointerNeedle)) source = source.replace(pointerNeedle, pointerReplacement);
  else console.error('Animation Maker advanced canvas-input patch point missing.');

  const snapshotNeedle = "movingActions: state.movingActions, animateAreaEnabled: state.animateAreaEnabled";
  if (source.includes(snapshotNeedle)) source = source.replace(snapshotNeedle, "movingActions: state.movingActions, advancedBackgroundActions: state.advancedBackgroundActions, animateAreaEnabled: state.animateAreaEnabled");
  else console.error('Animation Maker advanced snapshot patch point missing.');

  const restoreNeedle = "state.movingActions = data.movingActions; state.animateAreaEnabled = data.animateAreaEnabled;";
  if (source.includes(restoreNeedle)) source = source.replace(restoreNeedle, "state.movingActions = data.movingActions; state.advancedBackgroundActions = data.advancedBackgroundActions || {}; state.animateAreaEnabled = data.animateAreaEnabled;");
  else console.error('Animation Maker advanced restore patch point missing.');

  const resetNeedle = "state.movingActions = []; state.animateAreaEnabled = false;";
  if (source.includes(resetNeedle)) source = source.replace(resetNeedle, "state.movingActions = []; state.advancedBackgroundActions = {}; state.animateAreaEnabled = false;");
  else console.error('Animation Maker advanced reset patch point missing.');

  const pruneNeedle = "normalizeClipOrder(); state.alignIndex = clamp(state.alignIndex";
  const pruneReplacement = "normalizeClipOrder(); const liveAdvancedFrameIds = new Set(state.frames.map((frame) => frame.id)); Object.keys(state.advancedBackgroundActions || {}).forEach((frameId) => { if (!liveAdvancedFrameIds.has(frameId)) delete state.advancedBackgroundActions[frameId]; }); state.alignIndex = clamp(state.alignIndex";
  if (source.includes(pruneNeedle)) source = source.replace(pruneNeedle, pruneReplacement);
  else console.error('Animation Maker advanced cleanup patch point missing.');

  const shadowStart = source.indexOf("    function applyShadow(source, dim) {");
  const shadowEnd = source.indexOf("\\n\\n    async function openPreview", shadowStart);
  if (shadowStart >= 0 && shadowEnd > shadowStart) source = source.slice(0, shadowStart) + ${JSON.stringify(shadowSource)} + source.slice(shadowEnd);
  else console.error('Animation Maker safe shadow patch point missing.');

  const bridgeNeedle = "    qsa('#target-mode [data-target]').forEach((button) => button.addEventListener('click', () => activateTarget(button.dataset.target)));";
  if (source.includes(bridgeNeedle)) source = source.replace(bridgeNeedle, bridgeNeedle + "\\n" + ${JSON.stringify(bridgeSource)});
  else console.error('Animation Maker advanced bridge patch point missing.');
`;

  const escapedPatch = advancedPatchCode
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  const bridgeCloseNeedle = "\n\n`;\n\n  if (!source.includes(insertionPoint))";
  if (!source.includes(bridgeCloseNeedle)) {
    console.error('Animation Maker advanced background bridge insertion point missing.');
    return;
  }
  source = source.replace(
    bridgeCloseNeedle,
    `\n\n${escapedPatch}\n\`;\n\n  if (!source.includes(insertionPoint))`
  );

  const script = document.createElement('script');
  script.textContent = `${source}\n//# sourceURL=${baseLoaderUrl}`;
  document.head.appendChild(script);
  script.remove();
})();
