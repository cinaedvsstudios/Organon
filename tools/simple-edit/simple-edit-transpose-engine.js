"use strict";

(function installOrgavoxTransposeEngine() {
  const ENGINE_ID = "orgavox-transpose-engine";
  if (window.__orgavoxTransposeEngineInstalled) return;
  window.__orgavoxTransposeEngineInstalled = true;

  function clampSemitones(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(-24, Math.min(24, Math.round(number)));
  }

  function createTransposeBuffer(input, semitones) {
    const amount = clampSemitones(semitones);
    if (!input || !amount || !audioContext) return input;
    const pitchRatio = 2 ** (amount / 12);
    const outputLength = Math.max(1, Math.round(input.length / pitchRatio));
    const shifted = audioContext.createBuffer(input.numberOfChannels, outputLength, input.sampleRate);
    for (let channel = 0; channel < input.numberOfChannels; channel += 1) {
      const source = input.getChannelData(channel);
      const target = shifted.getChannelData(channel);
      for (let index = 0; index < outputLength; index += 1) {
        const sourceIndex = index * pitchRatio;
        const left = Math.max(0, Math.min(source.length - 1, Math.floor(sourceIndex)));
        const right = Math.max(0, Math.min(source.length - 1, left + 1));
        const fraction = sourceIndex - left;
        target[index] = source[left] * (1 - fraction) + source[right] * fraction;
      }
    }
    if (Math.abs(shifted.duration - input.duration) > .003 && typeof granularStretch === "function") {
      return granularStretch(shifted, input.duration);
    }
    return shifted;
  }

  const previousProcessedClipBuffer = processedClipBuffer;
  processedClipBuffer = async function orgavoxTransposeProcessedClipBuffer(clip) {
    const amount = clampSemitones(clip?.transposeSemitones || 0);
    if (!amount) return previousProcessedClipBuffer(clip);
    const key = `${ENGINE_ID}:${clip.id}:${clip.cacheVersion || 0}:${clip.sourceStart?.toFixed?.(4) || 0}:${clip.sourceEnd?.toFixed?.(4) || 0}:${stretchedAudioDuration(clip).toFixed(4)}:${amount}:${JSON.stringify(clip.gate || null)}`;
    if (state.renderCache.has(key)) return state.renderCache.get(key);
    const base = await previousProcessedClipBuffer({ ...clip, transposeSemitones: 0 });
    if (!base) return null;
    const output = createTransposeBuffer(base, amount);
    state.renderCache.set(key, output);
    return output;
  };
})();
