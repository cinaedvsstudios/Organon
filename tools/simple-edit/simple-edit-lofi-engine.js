"use strict";

(function installOrgavoxLofiEngine() {
  if (window.__orgavoxLofiEngineInstalled) return;
  window.__orgavoxLofiEngineInstalled = true;

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function normalizeLofiSettings(raw) {
    if (!raw || raw.enabled === false) return null;
    const settings = {
      enabled: true,
      preset: raw.preset || "clean",
      label: raw.label || "Lo-fi",
      bitDepth: clampNumber(raw.bitDepth, 3, 16, 12),
      sampleRate: clampNumber(raw.sampleRate, 800, 44100, 16000),
      crushMix: clampNumber(raw.crushMix, 0, 100, 0),
      noise: clampNumber(raw.noise, 0, 40, 0),
      wobble: clampNumber(raw.wobble, 0, 40, 0),
      highCut: clampNumber(raw.highCut, 800, 20000, 20000),
      outputGain: clampNumber(raw.outputGain, 0, 150, 100)
    };
    const active =
      settings.bitDepth < 15.9 ||
      settings.sampleRate < 43000 ||
      settings.crushMix > 0.5 ||
      settings.noise > 0.5 ||
      settings.wobble > 0.5 ||
      settings.highCut < 19800 ||
      Math.abs(settings.outputGain - 100) > 0.05;
    return active ? settings : null;
  }

  function interp(source, index) {
    const left = Math.max(0, Math.min(source.length - 1, Math.floor(index)));
    const right = Math.max(0, Math.min(source.length - 1, left + 1));
    const fraction = index - left;
    return source[left] * (1 - fraction) + source[right] * fraction;
  }

  function quantize(value, bitDepth) {
    const levels = Math.max(3, (2 ** Math.round(bitDepth)) - 1);
    return ((Math.round(((Math.max(-1, Math.min(1, value)) + 1) / 2) * levels) / levels) * 2) - 1;
  }

  function createLofiBuffer(input, settings) {
    if (!input || !settings || !audioContext) return input;
    const normalized = normalizeLofiSettings(settings);
    if (!normalized) return input;

    const output = audioContext.createBuffer(input.numberOfChannels, input.length, input.sampleRate);
    const sampleStep = Math.max(1, Math.round(input.sampleRate / normalized.sampleRate));
    const wet = normalized.crushMix / 100;
    const noiseAmount = normalized.noise / 100;
    const wobbleSamples = Math.round((normalized.wobble / 100) * input.sampleRate * 0.006);
    const outputGain = normalized.outputGain / 100;
    const cutoff = Math.max(800, Math.min(input.sampleRate / 2 - 100, normalized.highCut));
    const rc = 1 / (2 * Math.PI * cutoff);
    const dt = 1 / input.sampleRate;
    const alpha = dt / (rc + dt);

    for (let channel = 0; channel < input.numberOfChannels; channel += 1) {
      const source = input.getChannelData(channel);
      const target = output.getChannelData(channel);
      let held = source[0] || 0;
      let filtered = held;
      for (let index = 0; index < input.length; index += 1) {
        if (index % sampleStep === 0) {
          const wobble = wobbleSamples ? Math.sin((index / input.sampleRate) * Math.PI * 2 * 1.15) * wobbleSamples : 0;
          const sourceIndex = Math.max(0, Math.min(source.length - 1, index + wobble));
          const noisy = interp(source, sourceIndex) + ((Math.random() * 2 - 1) * noiseAmount * 0.22);
          held = quantize(noisy, normalized.bitDepth);
        }
        filtered += alpha * (held - filtered);
        const dry = source[index] || 0;
        const crushed = normalized.highCut < 19800 ? filtered : held;
        target[index] = Math.max(-1, Math.min(1, ((dry * (1 - wet)) + (crushed * wet)) * outputGain));
      }
    }
    return output;
  }

  const previousProcessedClipBuffer = processedClipBuffer;
  processedClipBuffer = async function orgavoxLofiProcessedClipBuffer(clip) {
    const settings = normalizeLofiSettings(clip?.lofiSettings || null);
    if (!settings) return previousProcessedClipBuffer(clip);
    const key = `orgavox-lofi:${clip.id}:${clip.cacheVersion || 0}:${clip.sourceStart?.toFixed?.(4) || 0}:${clip.sourceEnd?.toFixed?.(4) || 0}:${stretchedAudioDuration(clip).toFixed(4)}:${JSON.stringify(clip.gate || null)}:${JSON.stringify(settings)}`;
    if (state.renderCache.has(key)) return state.renderCache.get(key);
    const base = await previousProcessedClipBuffer({ ...clip, lofiSettings: null });
    if (!base) return null;
    const output = createLofiBuffer(base, settings);
    state.renderCache.set(key, output);
    return output;
  };

  window.orgavoxNormalizeLofiSettings = normalizeLofiSettings;
  window.orgavoxCreateLofiBuffer = createLofiBuffer;
})();
