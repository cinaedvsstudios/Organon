"use strict";

(function installOrgavoxDynamicsEngine() {
  if (window.__orgavoxDynamicsEngineInstalled) return;
  window.__orgavoxDynamicsEngineInstalled = true;

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function normalizeDynamicsSettings(raw) {
    if (!raw || raw.enabled === false) return null;
    const settings = {
      enabled: true,
      preset: raw.preset || "leveler",
      label: raw.label || "Dynamics",
      threshold: clampNumber(raw.threshold, -60, 0, -24),
      ratio: clampNumber(raw.ratio, 1, 24, 4),
      knee: clampNumber(raw.knee, 0, 40, 12),
      attack: clampNumber(raw.attack, 1, 250, 12),
      release: clampNumber(raw.release, 20, 1600, 240),
      mix: clampNumber(raw.mix, 0, 100, 100),
      makeupGain: clampNumber(raw.makeupGain, 0, 200, 100),
      outputGain: clampNumber(raw.outputGain, 0, 150, 100)
    };
    const active =
      settings.threshold > -59.5 ||
      settings.ratio > 1.05 ||
      settings.mix < 99.5 ||
      Math.abs(settings.makeupGain - 100) > 0.05 ||
      Math.abs(settings.outputGain - 100) > 0.05;
    return active ? settings : null;
  }

  function settingsForClip(clip) {
    return normalizeDynamicsSettings(clip?.dynamicsSettings || null);
  }

  function applyDynamicsChain(context, input, settings, destination) {
    const output = context.createGain();
    output.gain.value = settings.outputGain / 100;
    output.connect(destination);

    const mix = clampNumber(settings.mix, 0, 100, 100) / 100;
    const dry = context.createGain();
    dry.gain.value = 1 - mix;
    input.connect(dry);
    dry.connect(output);

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = settings.threshold;
    compressor.ratio.value = settings.ratio;
    compressor.knee.value = settings.knee;
    compressor.attack.value = settings.attack / 1000;
    compressor.release.value = settings.release / 1000;

    const makeup = context.createGain();
    makeup.gain.value = settings.makeupGain / 100;

    const wet = context.createGain();
    wet.gain.value = mix;

    input.connect(compressor);
    compressor.connect(makeup);
    makeup.connect(wet);
    wet.connect(output);
  }

  const previousConnectClipNodes = connectClipNodes;
  connectClipNodes = function orgavoxDynamicsConnectClipNodes(context, source, clip, destination, when = context.currentTime, offset = 0) {
    const settings = settingsForClip(clip);
    if (!settings) return previousConnectClipNodes(context, source, clip, destination, when, offset);
    const dynamicsInput = context.createGain();
    previousConnectClipNodes(context, source, clip, dynamicsInput, when, offset);
    applyDynamicsChain(context, dynamicsInput, settings, destination);
  };
})();
