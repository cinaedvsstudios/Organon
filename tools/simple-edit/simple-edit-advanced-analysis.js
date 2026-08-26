"use strict";

(function installOrgavoxAdvancedAnalysis() {
  const scriptPromises = new Map();
  const NOTE_NAMES = ["C", "C♯/D♭", "D", "D♯/E♭", "E", "F", "F♯/G♭", "G", "G♯/A♭", "A", "A♯/B♭", "B"];
  const KEY_NAMES = ["C", "C♯/D♭", "D", "D♯/E♭", "E", "F", "F♯/G♭", "G", "G♯/A♭", "A", "A♯/B♭", "B"];
  const MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

  function loadScriptOnce(src) {
    if (scriptPromises.has(src)) return scriptPromises.get(src);
    const existing = [...document.scripts].find((script) => script.src && script.src.endsWith(src.replace(/^\.\//, "")));
    if (existing) return Promise.resolve();
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.appendChild(script);
    });
    scriptPromises.set(src, promise);
    return promise;
  }

  async function ensureMeyda() {
    if (window.Meyda) return window.Meyda;
    try { await loadScriptOnce("./vendor/advanced-audio/meyda.min.js"); } catch {}
    return window.Meyda || null;
  }

  async function ensureBeatDetector() {
    if (window.webAudioBeatDetector?.analyze || window.webAudioBeatDetector?.guess) return window.webAudioBeatDetector;
    try { await loadScriptOnce("./vendor/advanced-audio/bundle.js"); } catch {}
    return window.webAudioBeatDetector || null;
  }

  function requireClip(clip) {
    const target = clip || selectedClip?.();
    if (!target) throw new Error("Select a clip first.");
    return target;
  }

  function baseBufferForClip(clip) {
    const buffer = clipBuffer?.(clip);
    if (!buffer) throw new Error("The selected clip has no decoded audio buffer.");
    return buffer;
  }

  function sliceToMono(buffer, startSeconds = 0, endSeconds = buffer.duration) {
    const start = Math.max(0, Math.floor(startSeconds * buffer.sampleRate));
    const end = Math.min(buffer.length, Math.max(start + 1, Math.ceil(endSeconds * buffer.sampleRate)));
    const length = Math.max(1, end - start);
    const mono = new Float32Array(length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const source = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) mono[index] += source[start + index] / buffer.numberOfChannels;
    }
    return { data: mono, sampleRate: buffer.sampleRate, duration: length / buffer.sampleRate };
  }

  function clipMono(clip) {
    const target = requireClip(clip);
    const buffer = baseBufferForClip(target);
    return sliceToMono(buffer, target.sourceStart || 0, target.sourceEnd || buffer.duration);
  }

  function rmsEnvelope(mono, frameSize = 2048, hopSize = 512) {
    const frames = [];
    for (let start = 0; start < mono.data.length; start += hopSize) {
      const end = Math.min(mono.data.length, start + frameSize);
      let sum = 0;
      let peak = 0;
      for (let index = start; index < end; index += 1) {
        const value = mono.data[index] || 0;
        sum += value * value;
        peak = Math.max(peak, Math.abs(value));
      }
      const count = Math.max(1, end - start);
      frames.push({ time: start / mono.sampleRate, rms: Math.sqrt(sum / count), peak });
    }
    return frames;
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function detectOnsets(mono) {
    const frames = rmsEnvelope(mono, 2048, 512);
    if (frames.length < 4) return [];
    const levels = frames.map((frame) => frame.rms);
    const floor = median(levels);
    const max = Math.max(...levels, 0.00001);
    const threshold = Math.max(floor * 2.6, max * 0.12, 0.01);
    const onsets = [];
    let lastTime = -1;
    for (let index = 2; index < frames.length - 1; index += 1) {
      const prev = frames[index - 1].rms;
      const now = frames[index].rms;
      const next = frames[index + 1].rms;
      const rise = now - prev;
      if (now >= threshold && rise > Math.max(0.006, prev * 0.45) && now >= next && frames[index].time - lastTime > 0.18) {
        onsets.push({ time: frames[index].time, strength: now, peak: frames[index].peak });
        lastTime = frames[index].time;
      }
    }
    return onsets;
  }

  function bpmFromOnsets(onsets) {
    if (!onsets || onsets.length < 2) return { bpm: null, confidence: 0 };
    const intervals = [];
    for (let index = 1; index < onsets.length; index += 1) {
      const delta = onsets[index].time - onsets[index - 1].time;
      if (delta >= 0.24 && delta <= 2.2) intervals.push(delta);
    }
    if (!intervals.length) return { bpm: null, confidence: 0 };
    let interval = median(intervals);
    let bpm = 60 / interval;
    while (bpm < 70) bpm *= 2;
    while (bpm > 190) bpm /= 2;
    const spread = median(intervals.map((value) => Math.abs(value - interval)));
    const confidence = Math.max(0.05, Math.min(1, 1 - spread / Math.max(interval, 0.001)));
    return { bpm: Math.round(bpm * 10) / 10, confidence };
  }

  async function analyzeBeats(clip) {
    const target = requireClip(clip);
    const mono = clipMono(target);
    const fallbackOnsets = detectOnsets(mono);
    const fallback = bpmFromOnsets(fallbackOnsets);
    let detectorResult = null;
    try {
      const detector = await ensureBeatDetector();
      const buffer = baseBufferForClip(target);
      if (detector?.analyze) detectorResult = await detector.analyze(buffer);
      else if (detector?.guess) detectorResult = await detector.guess(buffer);
    } catch (error) {
      console.warn("Advanced beat detector fallback used", error);
    }
    const detectorBpm = Number(detectorResult?.tempo ?? detectorResult?.bpm ?? detectorResult?.guess ?? detectorResult?.value);
    const offset = Number(detectorResult?.offset ?? detectorResult?.firstBeat ?? detectorResult?.beat ?? fallbackOnsets[0]?.time ?? 0);
    return {
      clip: target,
      bpm: Number.isFinite(detectorBpm) && detectorBpm > 0 ? Math.round(detectorBpm * 10) / 10 : fallback.bpm,
      firstBeat: Math.max(0, Number.isFinite(offset) ? offset : (fallbackOnsets[0]?.time || 0)),
      confidence: detectorResult ? 0.75 : fallback.confidence,
      source: detectorResult ? "web-audio-beat-detector" : "ORGAVOX RMS/onset fallback",
      onsets: fallbackOnsets
    };
  }

  function findSilenceTrim(clip, thresholdDb = -45, minSilenceSeconds = 0.05) {
    const target = requireClip(clip);
    const mono = clipMono(target);
    const threshold = Math.pow(10, thresholdDb / 20);
    const minSamples = Math.max(1, Math.round(minSilenceSeconds * mono.sampleRate));
    let start = 0;
    while (start < mono.data.length && Math.abs(mono.data[start]) < threshold) start += 1;
    let end = mono.data.length - 1;
    while (end > start && Math.abs(mono.data[end]) < threshold) end -= 1;
    const startSeconds = start >= minSamples ? start / mono.sampleRate : 0;
    const endSilenceSamples = mono.data.length - 1 - end;
    const endSeconds = endSilenceSamples >= minSamples ? endSilenceSamples / mono.sampleRate : 0;
    return { clip: target, thresholdDb, start: startSeconds, end: endSeconds, remaining: Math.max(0.01, mono.duration - startSeconds - endSeconds) };
  }

  function autoCorrelate(samples, sampleRate) {
    let rms = 0;
    for (let i = 0; i < samples.length; i += 1) rms += samples[i] * samples[i];
    rms = Math.sqrt(rms / samples.length);
    if (rms < 0.01) return null;
    let bestOffset = -1;
    let bestCorrelation = 0;
    const minOffset = Math.floor(sampleRate / 1200);
    const maxOffset = Math.floor(sampleRate / 55);
    for (let offset = minOffset; offset <= Math.min(maxOffset, samples.length / 2); offset += 1) {
      let correlation = 0;
      for (let i = 0; i < samples.length - offset; i += 1) correlation += 1 - Math.abs(samples[i] - samples[i + offset]);
      correlation /= (samples.length - offset);
      if (correlation > bestCorrelation) { bestCorrelation = correlation; bestOffset = offset; }
    }
    if (bestCorrelation < 0.86 || bestOffset <= 0) return null;
    return sampleRate / bestOffset;
  }

  function frequencyToNote(frequency) {
    if (!frequency || !Number.isFinite(frequency)) return null;
    const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
    const cents = Math.round(1200 * Math.log2(frequency / (440 * Math.pow(2, (midi - 69) / 12))));
    const name = NOTE_NAMES[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    return { frequency: Math.round(frequency * 10) / 10, midi, note: `${name}${octave}`, cents };
  }

  function measurePitchAtTime(clip, localTime) {
    const target = requireClip(clip);
    const mono = clipMono(target);
    const center = Math.max(0, Math.min(mono.data.length - 1, Math.round((Number(localTime) || 0) * mono.sampleRate)));
    const size = 4096;
    const start = Math.max(0, Math.min(mono.data.length - size, center - Math.floor(size / 2)));
    const windowed = mono.data.slice(start, start + Math.min(size, mono.data.length - start));
    const frequency = autoCorrelate(windowed, mono.sampleRate);
    const note = frequencyToNote(frequency);
    return { clip: target, time: center / mono.sampleRate, frequency, note, source: "ORGAVOX autocorrelation" };
  }

  async function estimateKey(clip) {
    const target = requireClip(clip);
    const mono = clipMono(target);
    const meyda = await ensureMeyda();
    let chroma = new Array(12).fill(0);
    if (meyda?.extract) {
      const frameSize = 4096;
      const hop = 2048;
      for (let start = 0; start + frameSize <= mono.data.length; start += hop) {
        const features = meyda.extract(["chroma"], mono.data.slice(start, start + frameSize), { sampleRate: mono.sampleRate, bufferSize: frameSize });
        const vector = features?.chroma || [];
        for (let i = 0; i < 12; i += 1) chroma[i] += Number(vector[i] || 0);
      }
    } else {
      // Very rough fallback: pitch samples across the clip and add detected notes to chroma.
      const step = Math.max(0.2, mono.duration / 40);
      for (let t = 0; t < mono.duration; t += step) {
        const res = measurePitchAtTime(target, t);
        if (res.note?.midi != null) chroma[((res.note.midi % 12) + 12) % 12] += 1;
      }
    }
    const total = chroma.reduce((sum, value) => sum + value, 0) || 1;
    chroma = chroma.map((value) => value / total);
    const scoreProfile = (profile, shift) => profile.reduce((sum, value, i) => sum + value * chroma[(i + shift) % 12], 0);
    let best = { keyIndex: 0, mode: "major", score: -Infinity };
    for (let shift = 0; shift < 12; shift += 1) {
      const major = scoreProfile(MAJOR_PROFILE, shift);
      const minor = scoreProfile(MINOR_PROFILE, shift);
      if (major > best.score) best = { keyIndex: (12 - shift) % 12, mode: "major", score: major };
      if (minor > best.score) best = { keyIndex: (12 - shift) % 12, mode: "minor", score: minor };
    }
    return { clip: target, keyIndex: best.keyIndex, key: `${KEY_NAMES[best.keyIndex]} ${best.mode}`, mode: best.mode, confidence: Math.max(0.05, Math.min(1, best.score / 8)), source: meyda ? "Meyda chroma" : "ORGAVOX pitch fallback", chroma };
  }

  function nearestLowEnergyBefore(mono, targetTime, searchSeconds = 0.35) {
    const frames = rmsEnvelope(mono, 1024, 256);
    const start = Math.max(0, targetTime - searchSeconds);
    let best = frames.find((frame) => frame.time >= start && frame.time <= targetTime) || null;
    for (const frame of frames) {
      if (frame.time < start || frame.time > targetTime) continue;
      if (!best || frame.rms < best.rms) best = frame;
    }
    return best?.time ?? Math.max(0, targetTime - 0.02);
  }

  async function analyzeBpmDrift(clip) {
    const target = requireClip(clip);
    const mono = clipMono(target);
    const beats = await analyzeBeats(target);
    const onsets = beats.onsets || [];
    const windows = [];
    const windowSize = 8;
    for (let start = 0; start + windowSize < onsets.length; start += Math.max(2, Math.floor(windowSize / 2))) {
      const group = onsets.slice(start, start + windowSize);
      const tempo = bpmFromOnsets(group);
      if (tempo.bpm) windows.push({ start: group[0].time, end: group[group.length - 1].time, bpm: tempo.bpm, confidence: tempo.confidence });
    }
    const base = beats.bpm || windows[0]?.bpm || null;
    const driftPoints = [];
    for (let i = 1; i < windows.length; i += 1) {
      if (!base || Math.abs(windows[i].bpm - base) < Math.max(3, base * 0.035)) continue;
      const split = nearestLowEnergyBefore(mono, windows[i].start, 0.45);
      driftPoints.push({ time: split, reason: `${windows[i - 1]?.bpm || base} → ${windows[i].bpm} BPM` });
    }
    return { clip: target, bpm: base, source: beats.source, windows, driftPoints };
  }

  function keySemitoneDelta(sourceKeyIndex, targetKeyIndex) {
    let delta = ((Number(targetKeyIndex) || 0) - (Number(sourceKeyIndex) || 0) + 12) % 12;
    if (delta > 6) delta -= 12;
    return delta;
  }

  window.orgavoxAdvancedAnalysis = {
    ensureMeyda,
    ensureBeatDetector,
    clipMono,
    rmsEnvelope,
    detectOnsets,
    analyzeBeats,
    findSilenceTrim,
    measurePitchAtTime,
    estimateKey,
    analyzeBpmDrift,
    keySemitoneDelta,
    frequencyToNote
  };
})();
