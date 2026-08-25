"use strict";

(function installOrgavoxRenderToolsEngine() {
  if (window.__orgavoxRenderToolsEngineInstalled) return;
  window.__orgavoxRenderToolsEngineInstalled = true;

  function reverseBuffer(input) {
    if (!input || !audioContext) return input;
    const output = audioContext.createBuffer(input.numberOfChannels, input.length, input.sampleRate);
    for (let channel = 0; channel < input.numberOfChannels; channel += 1) {
      const source = input.getChannelData(channel);
      const target = output.getChannelData(channel);
      for (let index = 0; index < input.length; index += 1) target[index] = source[input.length - 1 - index] || 0;
    }
    return output;
  }

  function reverseCacheKey(clip) {
    return [
      clip.id,
      "reverse",
      clip.cacheVersion || 0,
      Number(clip.sourceStart || 0).toFixed(4),
      Number(clip.sourceEnd || 0).toFixed(4),
      stretchedAudioDuration(clip).toFixed(4),
      JSON.stringify(clip.gate || null),
      clip.transposeSemitones || 0,
      JSON.stringify(clip.lofiSettings || null)
    ].join(":");
  }

  const previousProcessedClipBuffer = processedClipBuffer;
  processedClipBuffer = async function orgavoxRenderToolsProcessedClipBuffer(clip) {
    if (!clip?.reverseAudio) return previousProcessedClipBuffer(clip);
    const key = reverseCacheKey(clip);
    if (state.renderCache.has(key)) return state.renderCache.get(key);
    const base = await previousProcessedClipBuffer({ ...clip, reverseAudio: false });
    if (!base) return null;
    const reversed = reverseBuffer(base);
    state.renderCache.set(key, reversed);
    return reversed;
  };

  async function renderClipToBuffer(clip) {
    if (!clip) return null;
    const prepared = await processedClipBuffer(clip);
    if (!prepared) return null;
    const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineAudioContextClass) throw new Error("Offline audio rendering is unavailable in this browser.");
    const sampleRate = prepared.sampleRate || 44100;
    const echoTail = Number(clip.echo || 0) > 0 ? 2 : 0;
    const duration = Math.max(.1, prepared.duration + echoTail);
    const offline = new OfflineAudioContextClass(2, Math.ceil(duration * sampleRate), sampleRate);
    const source = offline.createBufferSource();
    source.buffer = prepared;
    connectClipNodes(offline, source, { ...clip, start: 0 }, offline.destination, 0, 0);
    source.start(0);
    return offline.startRendering();
  }

  window.orgavoxReverseBuffer = reverseBuffer;
  window.orgavoxRenderClipToBuffer = renderClipToBuffer;
})();
