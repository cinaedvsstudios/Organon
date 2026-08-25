"use strict";

(function installSimpleEditAudioTsmStretch() {
  const VERSION = "v0.19";
  const STYLE_ID = "simple-edit-audiotsm-stretch-style";

  function setVersion() {
    document.title = `Organon — Simple Edit ${VERSION}`;
    const badge = document.querySelector(".phase1-version, .simple-edit-version");
    if (badge) badge.textContent = VERSION;
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.simple-edit-phase1 .audio-clip.stretched::after {
        content: 'WSOLA STRETCH' !important;
        color: rgba(255, 226, 177, .86) !important;
      }
      body.simple-edit-phase1 .stretch-quality-badge {
        border-color: rgba(117,216,255,.62) !important;
        color: #bdefff !important;
      }
    `;
    document.head.appendChild(style);
  }

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function choosePowerOfTwo(value, min, max) {
    const power = 2 ** Math.round(Math.log2(Math.max(1, value)));
    return clamp(power, min, max);
  }

  function makeWindow(length) {
    const output = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
      output[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / Math.max(1, length - 1));
    }
    return output;
  }

  function createOutputBuffer(input, targetLength) {
    const context = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    return context.createBuffer(input.numberOfChannels, Math.max(1, targetLength), input.sampleRate);
  }

  function channelData(buffer) {
    const channels = [];
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      channels.push(buffer.getChannelData(channel));
    }
    return channels;
  }

  function copyFirstFrame(inputChannels, outputChannels, frameLength, outputWeight, window) {
    const available = Math.min(frameLength, inputChannels[0].length, outputChannels[0].length);
    for (let index = 0; index < available; index += 1) {
      const weight = window[index] || 1;
      outputWeight[index] += weight;
      for (let channel = 0; channel < outputChannels.length; channel += 1) {
        outputChannels[channel][index] += (inputChannels[channel][index] || 0) * weight;
      }
    }
  }

  function normalizedCorrelation(reference, candidate, referenceStart, candidateStart, length, step) {
    let dot = 0;
    let refEnergy = 0;
    let candEnergy = 0;
    for (let index = 0; index < length; index += step) {
      const ref = reference[referenceStart + index] || 0;
      const cand = candidate[candidateStart + index] || 0;
      dot += ref * cand;
      refEnergy += ref * ref;
      candEnergy += cand * cand;
    }
    if (refEnergy <= 1e-9 || candEnergy <= 1e-9) return -Infinity;
    return dot / Math.sqrt(refEnergy * candEnergy);
  }

  function findBestAnalysisStart(inputChannel, outputChannel, expectedStart, outputStart, overlapLength, searchRadius, step) {
    const inputLimit = inputChannel.length - overlapLength - 1;
    const minStart = clamp(Math.round(expectedStart - searchRadius), 0, Math.max(0, inputLimit));
    const maxStart = clamp(Math.round(expectedStart + searchRadius), minStart, Math.max(minStart, inputLimit));
    let bestStart = clamp(Math.round(expectedStart), minStart, maxStart);
    let bestScore = -Infinity;

    for (let start = minStart; start <= maxStart; start += step) {
      const score = normalizedCorrelation(outputChannel, inputChannel, outputStart, start, overlapLength, Math.max(1, Math.floor(step / 2)));
      if (score > bestScore) {
        bestScore = score;
        bestStart = start;
      }
    }

    const refineMin = Math.max(minStart, bestStart - step);
    const refineMax = Math.min(maxStart, bestStart + step);
    for (let start = refineMin; start <= refineMax; start += 1) {
      const score = normalizedCorrelation(outputChannel, inputChannel, outputStart, start, overlapLength, 4);
      if (score > bestScore) {
        bestScore = score;
        bestStart = start;
      }
    }

    return bestStart;
  }

  function overlapAddFrame(inputChannels, outputChannels, inputStart, outputStart, frameLength, overlapLength, outputWeight, window) {
    const targetLength = outputChannels[0].length;
    const sourceLength = inputChannels[0].length;
    const available = Math.min(frameLength, sourceLength - inputStart, targetLength - outputStart);
    if (available <= 0) return;

    for (let index = 0; index < available; index += 1) {
      const outIndex = outputStart + index;
      let weight = window[index] || 1;

      if (outputWeight[outIndex] > 0 && index < overlapLength) {
        const fadeIn = index / Math.max(1, overlapLength - 1);
        weight = Math.max(weight, fadeIn);
      }

      outputWeight[outIndex] += weight;
      for (let channel = 0; channel < outputChannels.length; channel += 1) {
        outputChannels[channel][outIndex] += (inputChannels[channel][inputStart + index] || 0) * weight;
      }
    }
  }

  function normalizeOutput(outputChannels, outputWeight) {
    let peak = 0;
    for (let index = 0; index < outputWeight.length; index += 1) {
      const divisor = outputWeight[index] || 1;
      for (let channel = 0; channel < outputChannels.length; channel += 1) {
        const value = outputChannels[channel][index] / divisor;
        outputChannels[channel][index] = value;
        peak = Math.max(peak, Math.abs(value));
      }
    }

    if (peak > 1) {
      const gain = 0.98 / peak;
      for (let channel = 0; channel < outputChannels.length; channel += 1) {
        const data = outputChannels[channel];
        for (let index = 0; index < data.length; index += 1) data[index] *= gain;
      }
    }
  }

  function audioTsmWsolaStretch(input, targetDuration) {
    const targetLength = Math.max(1, Math.round(targetDuration * input.sampleRate));
    const ratio = targetDuration / Math.max(0.0001, input.duration);
    if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.003) return input;

    const sampleRate = input.sampleRate;
    const frameLength = choosePowerOfTwo(sampleRate * 0.095, 2048, 8192);
    const overlapLength = Math.max(256, Math.min(Math.floor(frameLength * 0.5), choosePowerOfTwo(sampleRate * 0.024, 512, 4096)));
    const synthesisHop = Math.max(128, frameLength - overlapLength);
    const analysisHop = synthesisHop / ratio;
    const searchRadius = Math.max(128, Math.min(Math.floor(sampleRate * 0.035), Math.floor(frameLength * 0.7)));
    const searchStep = Math.max(16, Math.floor(searchRadius / 18));
    const window = makeWindow(frameLength);

    const output = createOutputBuffer(input, targetLength);
    const inputChannels = channelData(input);
    const outputChannels = channelData(output);
    const outputWeight = new Float32Array(targetLength);

    copyFirstFrame(inputChannels, outputChannels, frameLength, outputWeight, window);

    let outputStart = synthesisHop;
    let expectedInputStart = analysisHop;
    while (outputStart < targetLength) {
      const bestInputStart = findBestAnalysisStart(
        inputChannels[0],
        outputChannels[0],
        expectedInputStart,
        outputStart,
        Math.min(overlapLength, targetLength - outputStart),
        searchRadius,
        searchStep
      );

      overlapAddFrame(inputChannels, outputChannels, bestInputStart, outputStart, frameLength, overlapLength, outputWeight, window);
      outputStart += synthesisHop;
      expectedInputStart += analysisHop;

      if (expectedInputStart >= input.length - overlapLength) break;
    }

    const tailStart = Math.max(0, Math.floor(expectedInputStart));
    if (outputStart < targetLength && tailStart < input.length) {
      const remaining = Math.min(input.length - tailStart, targetLength - outputStart);
      for (let index = 0; index < remaining; index += 1) {
        const outIndex = outputStart + index;
        outputWeight[outIndex] += 1;
        for (let channel = 0; channel < outputChannels.length; channel += 1) {
          outputChannels[channel][outIndex] += inputChannels[channel][tailStart + index] || 0;
        }
      }
    }

    normalizeOutput(outputChannels, outputWeight);
    output.__stretchEngine = "audio-tsm-wsola";
    return output;
  }

  const previousGranularStretch = typeof granularStretch === "function" ? granularStretch : null;

  granularStretch = function audioTsmStyleStretch(input, targetDuration) {
    try {
      return audioTsmWsolaStretch(input, targetDuration);
    } catch (error) {
      console.warn("AudioTSM-style stretch failed; falling back to previous stretch.", error);
      if (previousGranularStretch) return previousGranularStretch(input, targetDuration);
      return input;
    }
  };

  function decorateStretchButton() {
    if (!ui.stretchBtn) return;
    ui.stretchBtn.title = "Stretch mode now uses an AudioTSM-style WSOLA pitch-preserving engine.";
    if (ui.stretchBtn.dataset.audioTsmToastBound === "true") return;
    ui.stretchBtn.dataset.audioTsmToastBound = "true";
    ui.stretchBtn.addEventListener("click", () => {
      setTimeout(() => {
        const active = ui.stretchBtn.getAttribute("aria-pressed") === "true";
        if (active) showToast("Stretch mode uses the new AudioTSM-style WSOLA engine.");
      }, 0);
    });
  }

  const previousRenderTimeline = renderTimeline;
  renderTimeline = function audioTsmStretchRenderTimeline() {
    previousRenderTimeline();
    state.clips.forEach((clip) => {
      const stretched = Math.abs(stretchedAudioDuration(clip) - bufferDuration(clip)) > 0.005;
      if (!stretched) return;
      const element = document.querySelector(`.audio-clip[data-clip-id="${CSS.escape(clip.id)}"]`);
      const badges = element?.querySelector(".clip-effect-badges");
      if (!badges || badges.querySelector(".stretch-quality-badge")) return;
      const badge = document.createElement("span");
      badge.className = "stretch-quality-badge";
      badge.textContent = "WSOLA";
      badge.title = "Pitch-preserving stretch using an AudioTSM-style overlap-add engine.";
      badges.appendChild(badge);
    });
  };

  if (state.renderCache?.clear) state.renderCache.clear();
  installStyles();
  setVersion();
  decorateStretchButton();
  renderTimeline();
  setStatus("Ready — AudioTSM-style stretch active");
})();
