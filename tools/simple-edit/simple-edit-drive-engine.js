"use strict";

(function installOrgavoxDriveEngine() {
  if (window.__orgavoxDriveEngineInstalled) return;
  window.__orgavoxDriveEngineInstalled = true;

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function normalizeDriveSettings(raw) {
    if (!raw || raw.enabled === false) return null;
    const settings = {
      enabled: true,
      preset: raw.preset || "warm",
      label: raw.label || "Drive",
      drive: clampNumber(raw.drive, 0, 100, 25),
      tone: clampNumber(raw.tone, 0, 100, 55),
      mix: clampNumber(raw.mix, 0, 100, 45),
      asymmetry: clampNumber(raw.asymmetry, 0, 100, 12),
      outputGain: clampNumber(raw.outputGain, 0, 150, 100)
    };
    const active =
      settings.drive > 0.5 ||
      settings.mix > 0.5 ||
      Math.abs(settings.outputGain - 100) > 0.05 ||
      settings.asymmetry > 0.5;
    return active ? settings : null;
  }

  function settingsForClip(clip) {
    return normalizeDriveSettings(clip?.driveSettings || null);
  }

  function makeCurve(drive, asymmetry) {
    const samples = 2048;
    const curve = new Float32Array(samples);
    const amount = 1 + (drive / 100) * 34;
    const skew = (asymmetry / 100) * 0.55;
    const gainComp = 1 / (1 + drive / 115);
    for (let index = 0; index < samples; index += 1) {
      const x = (index * 2) / (samples - 1) - 1;
      const biased = x + skew * (1 - Math.abs(x));
      let y = Math.tanh(biased * amount) / Math.tanh(amount);
      y = Math.max(-1, Math.min(1, y));
      curve[index] = y * gainComp;
    }
    return curve;
  }

  function createToneChain(context, input, settings, destination) {
    const drive = clampNumber(settings.drive, 0, 100, 25);
    const tone = clampNumber(settings.tone, 0, 100, 55);
    const asymmetry = clampNumber(settings.asymmetry, 0, 100, 10);

    const preGain = context.createGain();
    preGain.gain.value = 1 + drive / 55;

    const shaper = context.createWaveShaper();
    shaper.curve = makeCurve(drive, asymmetry);
    shaper.oversample = drive > 65 ? "4x" : "2x";

    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 25 + (100 - tone) * 0.85;
    highpass.Q.value = 0.65;

    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 1600 + tone * 145;
    lowpass.Q.value = 0.72;

    input.connect(preGain);
    preGain.connect(shaper);
    shaper.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(destination);
  }

  function applyDriveChain(context, input, settings, destination) {
    const output = context.createGain();
    output.gain.value = clampNumber(settings.outputGain, 0, 150, 100) / 100;
    output.connect(destination);

    const mix = clampNumber(settings.mix, 0, 100, 45) / 100;
    const dry = context.createGain();
    const wet = context.createGain();

    dry.gain.value = 1 - mix;
    wet.gain.value = mix;

    input.connect(dry);
    dry.connect(output);

    createToneChain(context, input, settings, wet);
    wet.connect(output);
  }

  const previousConnectClipNodes = connectClipNodes;
  connectClipNodes = function orgavoxDriveConnectClipNodes(context, source, clip, destination, when = context.currentTime, offset = 0) {
    const settings = settingsForClip(clip);
    if (!settings) return previousConnectClipNodes(context, source, clip, destination, when, offset);
    const driveInput = context.createGain();
    previousConnectClipNodes(context, source, clip, driveInput, when, offset);
    applyDriveChain(context, driveInput, settings, destination);
  };
})();
