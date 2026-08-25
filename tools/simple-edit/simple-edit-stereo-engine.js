"use strict";

(function installOrgavoxStereoEngine() {
  if (window.__orgavoxStereoEngineInstalled) return;
  window.__orgavoxStereoEngineInstalled = true;

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function normalizeStereoSettings(raw) {
    if (!raw || raw.enabled === false) return null;
    const settings = {
      enabled: true,
      preset: raw.preset || "center",
      label: raw.label || "Stereo",
      pan: clampNumber(raw.pan, -100, 100, 0),
      width: clampNumber(raw.width, 0, 220, 100),
      mono: Boolean(raw.mono),
      autoPanDepth: clampNumber(raw.autoPanDepth, 0, 100, 0),
      autoPanRate: clampNumber(raw.autoPanRate, 0.05, 12, 1.2),
      outputGain: clampNumber(raw.outputGain, 0, 150, 100)
    };
    const active =
      Math.abs(settings.pan) > 0.5 ||
      Math.abs(settings.width - 100) > 0.5 ||
      settings.mono ||
      settings.autoPanDepth > 0.5 ||
      Math.abs(settings.outputGain - 100) > 0.05;
    return active ? settings : null;
  }

  function applyWidthMatrix(context, input, widthValue) {
    const width = Math.max(0, Math.min(2.2, widthValue / 100));
    const splitter = context.createChannelSplitter(2);
    const merger = context.createChannelMerger(2);
    const lToL = context.createGain();
    const rToL = context.createGain();
    const lToR = context.createGain();
    const rToR = context.createGain();
    lToL.gain.value = (1 + width) / 2;
    rToL.gain.value = (1 - width) / 2;
    lToR.gain.value = (1 - width) / 2;
    rToR.gain.value = (1 + width) / 2;
    input.connect(splitter);
    splitter.connect(lToL, 0);
    splitter.connect(lToR, 0);
    splitter.connect(rToL, 1);
    splitter.connect(rToR, 1);
    lToL.connect(merger, 0, 0);
    rToL.connect(merger, 0, 0);
    lToR.connect(merger, 0, 1);
    rToR.connect(merger, 0, 1);
    return merger;
  }

  function applyStereoChain(context, input, settings, destination, when = context.currentTime) {
    const widthInput = context.createGain();
    const widthOutput = applyWidthMatrix(context, widthInput, settings.mono ? 0 : settings.width);
    const panner = context.createStereoPanner ? context.createStereoPanner() : null;
    const output = context.createGain();
    output.gain.value = settings.outputGain / 100;
    output.connect(destination);
    input.connect(widthInput);
    if (panner) {
      widthOutput.connect(panner);
      if (settings.autoPanDepth > 0.5) {
        const depth = settings.autoPanDepth / 100;
        const basePan = settings.pan / 100;
        const oscillator = context.createOscillator();
        const autoGain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = settings.autoPanRate;
        autoGain.gain.value = depth;
        panner.pan.setValueAtTime(basePan, when);
        oscillator.connect(autoGain);
        autoGain.connect(panner.pan);
        oscillator.start(when);
        const stopAfter = typeof projectDuration === "function" ? projectDuration() + 2 : 62;
        oscillator.stop(when + Math.max(0.05, stopAfter));
      } else {
        panner.pan.value = settings.pan / 100;
      }
      panner.connect(output);
    } else {
      widthOutput.connect(output);
    }
  }

  const previousConnectClipNodes = connectClipNodes;
  connectClipNodes = function orgavoxStereoConnectClipNodes(context, source, clip, destination, when = context.currentTime, offset = 0) {
    const settings = normalizeStereoSettings(clip?.stereoSettings || null);
    if (!settings) return previousConnectClipNodes(context, source, clip, destination, when, offset);
    const stereoInput = context.createGain();
    previousConnectClipNodes(context, source, clip, stereoInput, when, offset);
    applyStereoChain(context, stereoInput, settings, destination, when);
  };

  window.orgavoxNormalizeStereoSettings = normalizeStereoSettings;
})();