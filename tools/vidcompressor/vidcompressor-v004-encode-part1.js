'use strict';

function loadScript(sourceUrl) {
  return new Promise((resolve, reject) => {
    if (window.FFmpegWASM && window.FFmpegWASM.FFmpeg) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = sourceUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('The local FFmpeg helper could not be loaded.'));
    document.head.appendChild(script);
  });
}

async function ensureFfmpeg() {
  if (state.ffmpegLoaded && state.ffmpeg) return;
  setEngineState('LOADING ENGINE');
  setProgress('Loading local FFmpeg engine…', 7, 'The engine loads only when the first conversion starts.');
  const ffmpegScriptUrl = new URL('./vendor/ffmpeg/ffmpeg.js', window.location.href).href;
  const coreUrl = new URL('./vendor/ffmpeg-core/ffmpeg-core.js', window.location.href).href;
  const wasmUrl = new URL('./vendor/ffmpeg-core/ffmpeg-core.wasm', window.location.href).href;
  await loadScript(ffmpegScriptUrl);
  if (!window.FFmpegWASM || !window.FFmpegWASM.FFmpeg) {
    throw new Error('The FFmpeg engine was unavailable after loading.');
  }
  state.ffmpeg = new window.FFmpegWASM.FFmpeg();
  state.ffmpeg.on('progress', ({ progress }) => {
    const base = state.progressStage === 'pass1' ? 10 : state.progressStage === 'pass2' ? 55 : 10;
    const span = state.progressStage === 'pass1' ? 40 : state.progressStage === 'pass2' ? 40 : 82;
    const progressPercent = Math.round(Math.max(0, Math.min(1, Number(progress) || 0)) * span) + base;
    setProgress(elements.progressTitle.textContent, progressPercent, elements.progressNote.textContent);
  });
  await state.ffmpeg.load({ coreURL: coreUrl, wasmURL: wasmUrl });
  state.ffmpegLoaded = true;
  setEngineState('ENGINE READY');
}

function getFfmpegNames(item, outputPlan) {
  const inputExtension = getExtension(item.file.name) || 'mp4';
  return {
    inputName: `input-${item.id}.${inputExtension}`,
    outputName: `output-${item.id}.${outputPlan.extension}`,
    passLogName: `pass-${item.id}`
  };
}

function getVideoCodecArguments(plan) {
  const args = [];
  if (plan.outputPlan.codecFamily === 'ogv') {
    args.push('-c:v', 'libtheora', '-b:v', `${Math.round(plan.videoBitrateKbps)}k`);
  } else {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-b:v', `${Math.round(plan.videoBitrateKbps)}k`);
  }
  args.push('-pix_fmt', 'yuv420p');
  if (plan.resolution.scaleFilter) args.push('-vf', plan.resolution.scaleFilter);
  return args;
}

function getAudioArguments(plan) {
  if (!plan.audioBitrateKbps) return ['-an'];
  const args = plan.outputPlan.codecFamily === 'ogv'
    ? ['-c:a', 'libvorbis', '-b:a', `${plan.audioBitrateKbps}k`]
    : ['-c:a', 'aac', '-b:a', `${plan.audioBitrateKbps}k`];
  const channels = elements.audioChannelsSelect.value;
  if (channels === '1' || channels === '2') args.push('-ac', channels);
  return args;
}

function getContainerArguments(outputPlan) {
  if (outputPlan.codecFamily === 'ogv') return ['-f', 'ogg'];
  if (['mp4', 'm4v', 'mov'].includes(outputPlan.extension)) return ['-movflags', '+faststart'];
  return [];
}

function buildFirstPassCommand(inputName, passLogName, plan) {
  return [
    '-y',
    '-i', inputName,
    '-map', '0:v:0',
    ...getVideoCodecArguments(plan),
    '-pass', '1',
    '-passlogfile', passLogName,
    '-an',
    '-f', 'null',
    '-'
  ];
}

function buildFinalCommand(inputName, outputName, passLogName, plan) {
  const command = ['-y', '-i', inputName, '-map', '0:v:0'];
  if (plan.audioBitrateKbps) command.push('-map', '0:a?');
  command.push('-map_metadata', '0', ...getVideoCodecArguments(plan));
  if (plan.passes === 2) command.push('-pass', '2', '-passlogfile', passLogName);
  command.push(...getAudioArguments(plan), ...getContainerArguments(plan.outputPlan), outputName);
  return command;
}

async function cleanupTemporaryFiles(names) {
  if (!state.ffmpeg) return;
  const filesToDelete = [names.inputName, names.outputName];
  try {
    const entries = await state.ffmpeg.listDir('.');
    entries.forEach((entry) => {
      if (entry && entry.name && entry.name.startsWith(names.passLogName)) filesToDelete.push(entry.name);
    });
  } catch (_) {
    filesToDelete.push(`${names.passLogName}-0.log`, `${names.passLogName}-0.log.mbtree`);
  }
  for (const name of new Set(filesToDelete)) {
    try {
      await state.ffmpeg.deleteFile(name);
    } catch (_) {
    }
  }
}

function browserCanPreviewOgv() {
  const testVideo = document.createElement('video');
  return Boolean(testVideo.canPlayType('video/ogg; codecs="theora, vorbis"'));
}

function showResultPreview(outputPlan) {
  elements.resultPreview.hidden = false;
  elements.resultPreviewNote.hidden = true;
  elements.resultPreview.onerror = null;
  if (outputPlan.extension === 'ogv' && !browserCanPreviewOgv()) {
    elements.resultPreview.hidden = true;
    elements.resultPreview.removeAttribute('src');
    elements.resultPreviewNote.hidden = false;
    return;
  }
  elements.resultPreview.onerror = () => {
    if (outputPlan.extension === 'ogv') {
      elements.resultPreview.hidden = true;
      elements.resultPreview.removeAttribute('src');
      elements.resultPreviewNote.hidden = false;
    }
  };
  elements.resultPreview.src = state.outputObjectUrl;
}

function describeEstimateAccuracy(actualBytes, estimatedBytes) {
  if (!estimatedBytes) return '—';
  const differencePercent = ((actualBytes - estimatedBytes) / estimatedBytes) * 100;
  const magnitude = Math.abs(differencePercent);
  if (magnitude < 1) return 'Within 1%';
  return `${Math.round(magnitude)}% ${differencePercent > 0 ? 'larger' : 'smaller'}`;
}

function populateResult(plan, outputSizeBytes) {
  const actualDifference = outputSizeBytes - plan.item.file.size;
  const actualPercent = plan.item.file.size ? (actualDifference / plan.item.file.size) * 100 : 0;
  const differencePrefix = actualDifference > 0 ? '+' : actualDifference < 0 ? '-' : '';
  const percentPrefix = actualPercent > 0 ? '+' : '';
  elements.resultTitle.textContent = state.mode === 'bulk' ? 'Latest converted video' : 'Compressed video ready';
  elements.resultFileName.textContent = state.outputFileName;
  elements.resultOriginalSize.textContent = formatBytes(plan.item.file.size);
  elements.resultEstimatedSize.textContent = `${formatBytes(plan.lowerBytes)}–${formatBytes(plan.upperBytes)}`;
  elements.resultOutputSize.textContent = formatBytes(outputSizeBytes);
  elements.resultChange.textContent = `${differencePrefix}${formatBytes(Math.abs(actualDifference))} · ${percentPrefix}${Math.round(actualPercent)}%`;
  elements.resultAccuracy.textContent = describeEstimateAccuracy(outputSizeBytes, plan.estimatedBytes);
  elements.resultFormat.textContent = plan.outputPlan.extension.toUpperCase();
  showResultPreview(plan.outputPlan);
  elements.resultCard.classList.add('visible');
}

async function writeBlobToHandle(handle, blob) {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function getUniqueFileHandle(directoryHandle, fileName) {
  const extension = getExtension(fileName);
  const baseName = getBaseName(fileName);
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = attempt === 0 ? fileName : `${baseName}-${attempt + 1}.${extension}`;
    try {
      await directoryHandle.getFileHandle(candidate, { create: false });
    } catch (_) {
      return directoryHandle.getFileHandle(candidate, { create: true });
    }
  }
  throw new Error('Could not create a unique output filename.');
}
