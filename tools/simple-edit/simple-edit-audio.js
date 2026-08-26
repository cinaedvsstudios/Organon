function createBuffer(channels, length, sampleRate) {
  return audioContext.createBuffer(channels, Math.max(1, length), sampleRate);
}

function sliceBuffer(buffer, startSeconds, endSeconds) {
  const start = Math.max(0, Math.floor(startSeconds * buffer.sampleRate));
  const end = Math.min(buffer.length, Math.max(start + 1, Math.ceil(endSeconds * buffer.sampleRate)));
  const output = createBuffer(buffer.numberOfChannels, end - start, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    output.copyToChannel(buffer.getChannelData(channel).subarray(start, end), channel);
  }
  return output;
}

function hann(index, length) {
  return .5 - .5 * Math.cos(2 * Math.PI * index / Math.max(1, length - 1));
}

function granularStretch(input, targetDuration) {
  const ratio = targetDuration / input.duration;
  if (Math.abs(ratio - 1) < .003) return input;
  const sampleRate = input.sampleRate;
  const grainSize = Math.max(512, Math.min(4096, 2 ** Math.round(Math.log2(sampleRate * .055))));
  const synthesisHop = Math.max(64, Math.floor(grainSize / 4));
  const analysisHop = synthesisHop / ratio;
  const targetLength = Math.max(1, Math.round(targetDuration * sampleRate));
  const output = createBuffer(input.numberOfChannels, targetLength, sampleRate);
  const weight = new Float32Array(targetLength);
  const channels = [];
  for (let channel = 0; channel < input.numberOfChannels; channel += 1) channels.push(output.getChannelData(channel));
  const inputChannels = [];
  for (let channel = 0; channel < input.numberOfChannels; channel += 1) inputChannels.push(input.getChannelData(channel));

  let grain = 0;
  for (let outStart = 0; outStart < targetLength; outStart += synthesisHop, grain += 1) {
    const inStart = Math.floor(grain * analysisHop);
    if (inStart >= input.length) break;
    const available = Math.min(grainSize, input.length - inStart, targetLength - outStart);
    for (let index = 0; index < available; index += 1) {
      const windowValue = hann(index, grainSize);
      const outIndex = outStart + index;
      weight[outIndex] += windowValue;
      for (let channel = 0; channel < input.numberOfChannels; channel += 1) {
        channels[channel][outIndex] += inputChannels[channel][inStart + index] * windowValue;
      }
    }
  }
  for (let index = 0; index < targetLength; index += 1) {
    const divisor = weight[index] || 1;
    for (let channel = 0; channel < output.numberOfChannels; channel += 1) channels[channel][index] /= divisor;
  }
  return output;
}

function applyGateToBuffer(buffer, gate) {
  if (!gate?.enabled) return buffer;
  const speed = Math.max(.5, Number(gate.speed) || 4);
  const pauseSeconds = Math.max(0, Number(gate.pause) || 0);
  const chunkSamples = Math.max(1, Math.round(buffer.sampleRate / speed));
  const pauseSamples = Math.max(0, Math.round(buffer.sampleRate * pauseSeconds));
  const chunks = Math.max(1, Math.ceil(buffer.length / chunkSamples));
  const length = buffer.length + Math.max(0, chunks - 1) * pauseSamples;
  const output = createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  const fadeScale = Math.max(0, Math.min(10, Number(gate.fade) || 0)) / 10;
  const fadeSamples = Math.min(Math.round(buffer.sampleRate * .05 * fadeScale), Math.floor(chunkSamples / 3));

  for (let chunk = 0; chunk < chunks; chunk += 1) {
    const sourceStart = chunk * chunkSamples;
    const sourceEnd = Math.min(buffer.length, sourceStart + chunkSamples);
    const destinationStart = sourceStart + chunk * pauseSamples;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const source = buffer.getChannelData(channel);
      const target = output.getChannelData(channel);
      for (let index = sourceStart; index < sourceEnd; index += 1) {
        const local = index - sourceStart;
        const chunkLength = sourceEnd - sourceStart;
        let gain = 1;
        if (fadeSamples > 0) {
          if (local < fadeSamples) gain = Math.min(gain, local / fadeSamples);
          if (chunkLength - local - 1 < fadeSamples) gain = Math.min(gain, (chunkLength - local - 1) / fadeSamples);
        }
        target[destinationStart + local] = source[index] * Math.max(0, gain);
      }
    }
  }
  return output;
}

async function processedClipBuffer(clip) {
  const base = clipBuffer(clip);
  if (!base) return null;
  const key = `${clip.id}:${clip.cacheVersion || 0}:${clip.sourceStart.toFixed(4)}:${clip.sourceEnd.toFixed(4)}:${stretchedAudioDuration(clip).toFixed(4)}:${JSON.stringify(clip.gate || null)}`;
  if (state.renderCache.has(key)) return state.renderCache.get(key);
  await new Promise((resolve) => setTimeout(resolve, 0));
  let output = sliceBuffer(base, clip.sourceStart, clip.sourceEnd);
  if (Math.abs(stretchedAudioDuration(clip) - output.duration) > .003) output = granularStretch(output, stretchedAudioDuration(clip));
  output = applyGateToBuffer(output, clip.gate);
  state.renderCache.set(key, output);
  return output;
}


function masterGainValue() {
  return Math.max(0, Math.min(2, Number(state.globalVolume ?? 100) / 100));
}

function syncPlaybackMasterGain() {
  const gain = state.playbackMasterGain;
  if (!gain || !audioContext) return;
  const value = masterGainValue();
  try { gain.gain.setTargetAtTime(value, audioContext.currentTime, .01); }
  catch { gain.gain.value = value; }
}

window.orgavoxSyncMasterGain = syncPlaybackMasterGain;

function connectClipNodes(context, source, clip, destination) {
  const dryGain = context.createGain();
  dryGain.gain.value = Math.max(0, clip.volume / 100);
  source.connect(dryGain);
  dryGain.connect(destination);
  if (clip.echo > 0) {
    const amount = clip.echo / 100;
    const delay = context.createDelay(2);
    const feedback = context.createGain();
    const wet = context.createGain();
    delay.delayTime.value = .25;
    feedback.gain.value = .12 + amount * .46;
    wet.gain.value = amount * .65;
    source.connect(delay);
    delay.connect(wet);
    wet.connect(destination);
    delay.connect(feedback);
    feedback.connect(delay);
  }
}

async function preparePlaybackBuffers() {
  const token = ++state.processingToken;
  setStatus("Preparing audio…");
  const entries = [];
  for (const clip of state.clips) {
    const buffer = await processedClipBuffer(clip);
    if (token !== state.processingToken) return null;
    if (buffer) entries.push({ clip, buffer });
  }
  return entries;
}

async function startPlayback() {
  if (!audioContext || !state.clips.length) return;
  stopPlayback(false);
  await audioContext.resume();
  const entries = await preparePlaybackBuffers();
  if (!entries) return;
  state.playing = true;
  ui.playBtn.textContent = "❚❚";
  const startTime = audioContext.currentTime + .05;
  state.playOriginContextTime = startTime;
  state.playOriginTimelineTime = state.playhead;
  state.activeSources = [];
  const masterGain = audioContext.createGain();
  masterGain.gain.value = masterGainValue();
  masterGain.connect(audioContext.destination);
  state.playbackMasterGain = masterGain;
  for (const { clip, buffer } of entries) {
    const clipEnd = clip.start + buffer.duration;
    if (clipEnd <= state.playhead) continue;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    connectClipNodes(audioContext, source, clip, masterGain);
    const when = startTime + Math.max(0, clip.start - state.playhead);
    const offset = Math.max(0, state.playhead - clip.start);
    try { source.start(when, offset); } catch (error) { console.error(error); }
    state.activeSources.push(source);
  }
  setStatus("Playing");
  tickPlayback();
}

function tickPlayback() {
  cancelAnimationFrame(state.raf);
  const tick = () => {
    if (!state.playing) return;
    const now = audioContext.currentTime;
    const time = state.playOriginTimelineTime + Math.max(0, now - state.playOriginContextTime);
    if (time >= projectDuration()) {
      stopPlayback();
      setPlayhead(0);
      return;
    }
    setPlayhead(time, true);
    state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
}

function stopPlayback(updateStatus = true) {
  state.processingToken += 1;
  state.activeSources.forEach((source) => { try { source.stop(); } catch {} });
  state.activeSources = [];
  try { state.playbackMasterGain?.disconnect?.(); } catch {}
  state.playbackMasterGain = null;
  state.playing = false;
  cancelAnimationFrame(state.raf);
  ui.playBtn.textContent = "▶";
  if (updateStatus) setStatus("Ready");
}

async function togglePlayback() {
  if (state.playing) stopPlayback();
  else await startPlayback();
}

async function splitSelectedClip() {
  const clip = selectedClip();
  if (!clip) return;
  const local = state.playhead - clip.start;
  if (local <= .01 || local >= clipDuration(clip) - .01) {
    showToast("Place the playhead inside the selected clip before cutting.");
    return;
  }
  stopPlayback();
  setStatus("Cutting clip…");
  const processed = await processedClipBuffer(clip);
  if (!processed) return;
  const splitSample = Math.max(1, Math.min(processed.length - 1, Math.round(local * processed.sampleRate)));
  const leftBuffer = createBuffer(processed.numberOfChannels, splitSample, processed.sampleRate);
  const rightBuffer = createBuffer(processed.numberOfChannels, processed.length - splitSample, processed.sampleRate);
  for (let channel = 0; channel < processed.numberOfChannels; channel += 1) {
    const data = processed.getChannelData(channel);
    leftBuffer.copyToChannel(data.subarray(0, splitSample), channel);
    rightBuffer.copyToChannel(data.subarray(splitSample), channel);
  }
  const common = {
    assetId: clip.assetId, name: clip.name, track: clip.track, volume: clip.volume, echo: clip.echo,
    sourceStart: 0, stretchDuration: null, gate: null, cacheVersion: 0
  };
  const left = { ...common, id: makeId("clip"), start: clip.start, sourceEnd: leftBuffer.duration, bufferOverride: leftBuffer };
  const right = { ...common, id: makeId("clip"), start: state.playhead, sourceEnd: rightBuffer.duration, bufferOverride: rightBuffer };
  const index = state.clips.indexOf(clip);
  state.clips.splice(index, 1, left, right);
  state.selectedClipId = right.id;
  syncSelectedControls();
  renderTimeline();
  setStatus("Ready");
  showToast("Clip cut at the playhead.");
}

function updateGateReadouts() {
  ui.gateSpeedOut.textContent = `${Number(ui.gateSpeed.value).toFixed(Number(ui.gateSpeed.value) % 1 ? 1 : 0)} cuts/s`;
  ui.gatePauseOut.textContent = `${Number(ui.gatePause.value).toFixed(2)} s`;
  ui.gateFadeOut.textContent = `${ui.gateFade.value} / 10`;
}

function openGate() {
  const clip = selectedClip();
  if (!clip) return;
  if (clip.gate) {
    ui.gateSpeed.value = clip.gate.speed;
    ui.gatePause.value = clip.gate.pause;
    ui.gateFade.value = clip.gate.fade;
  } else {
    ui.gateSpeed.value = 4;
    ui.gatePause.value = .25;
    ui.gateFade.value = 0;
  }
  updateGateReadouts();
  ui.gatePopover.hidden = false;
}

function applyGate() {
  const clip = selectedClip();
  if (!clip) return;
  stopPlayback();
  clip.gate = {
    enabled: true,
    speed: Number(ui.gateSpeed.value),
    pause: Number(ui.gatePause.value),
    fade: Number(ui.gateFade.value)
  };
  invalidateClip(clip);
  ui.gatePopover.hidden = true;
  renderTimeline();
  showToast("Noise gate applied as real cut pieces with inserted gaps.");
}

function resetGate() {
  const clip = selectedClip();
  if (!clip) return;
  stopPlayback();
  clip.gate = null;
  invalidateClip(clip);
  ui.gatePopover.hidden = true;
  renderTimeline();
  showToast("Noise gate removed.");
}
