"use strict";

(function installOrgavoxEqEngine() {
  if (window.__orgavoxEqEngineInstalled) return;
  window.__orgavoxEqEngineInstalled = true;

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function normalizeEqSettings(raw) {
    if (!raw || raw.enabled === false) return null;
    const settings = {
      enabled: true,
      preset: raw.preset || "flat",
      label: raw.label || "Custom EQ",
      lowCut: clampNumber(raw.lowCut, 20, 1000, 20),
      lowGain: clampNumber(raw.lowGain, -18, 18, 0),
      midFreq: clampNumber(raw.midFreq, 200, 6000, 1000),
      midGain: clampNumber(raw.midGain, -18, 18, 0),
      highGain: clampNumber(raw.highGain, -18, 18, 0),
      highCut: clampNumber(raw.highCut, 1200, 20000, 20000),
      outputGain: clampNumber(raw.outputGain, 0, 150, 100)
    };
    const active =
      settings.lowCut > 25 ||
      Math.abs(settings.lowGain) > 0.05 ||
      Math.abs(settings.midGain) > 0.05 ||
      Math.abs(settings.highGain) > 0.05 ||
      settings.highCut < 19900 ||
      Math.abs(settings.outputGain - 100) > 0.05;
    return active ? settings : null;
  }

  function settingsForClip(clip) {
    return normalizeEqSettings(clip?.eqSettings || null);
  }

  function createBiquad(context, type, frequency, q = 0.707, gain = 0) {
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = Math.max(20, Math.min(context.sampleRate / 2 - 100, Number(frequency) || 1000));
    filter.Q.value = Math.max(0.0001, Number(q) || 0.707);
    filter.gain.value = Number(gain) || 0;
    return filter;
  }

  function connectChain(nodes) {
    for (let index = 0; index < nodes.length - 1; index += 1) {
      if (nodes[index] && nodes[index + 1]) nodes[index].connect(nodes[index + 1]);
    }
  }

  function applyEqChain(context, input, settings, destination) {
    const nodes = [input];

    if (settings.lowCut > 25) nodes.push(createBiquad(context, "highpass", settings.lowCut, 0.707, 0));
    if (Math.abs(settings.lowGain) > 0.05) nodes.push(createBiquad(context, "lowshelf", 120, 0.707, settings.lowGain));
    if (Math.abs(settings.midGain) > 0.05) nodes.push(createBiquad(context, "peaking", settings.midFreq, 1.1, settings.midGain));
    if (Math.abs(settings.highGain) > 0.05) nodes.push(createBiquad(context, "highshelf", 6200, 0.707, settings.highGain));
    if (settings.highCut < 19900) nodes.push(createBiquad(context, "lowpass", settings.highCut, 0.707, 0));

    const output = context.createGain();
    output.gain.value = settings.outputGain / 100;
    nodes.push(output, destination);
    connectChain(nodes);
  }

  const previousConnectClipNodes = connectClipNodes;
  connectClipNodes = function orgavoxEqConnectClipNodes(context, source, clip, destination, when = context.currentTime, offset = 0) {
    const settings = settingsForClip(clip);
    if (!settings) return previousConnectClipNodes(context, source, clip, destination, when, offset);
    const eqInput = context.createGain();
    previousConnectClipNodes(context, source, clip, eqInput, when, offset);
    applyEqChain(context, eqInput, settings, destination);
  };
})();
