function loadScript(sourceUrl) {
  return new Promise((resolve, reject) => {
    if (window.FFmpegWASM && window.FFmpegWASM.FFmpeg) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = sourceUrl;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('The local FFmpeg helper could not be loaded.'));
    document.head.appendChild(script);
  });
}

async function ensureFfmpeg() {
  if (state.ffmpegLoaded && state.ffmpeg) return;
  setEngineState('LOADING ENGINE');
  setProgress('Loading local FFmpeg engine…', 7, 'The engine is stored inside Organon and loads only when needed.');
  const ffmpegScriptUrl = new URL('./vendor/ffmpeg/ffmpeg.js', window.location.href).href;
  const coreUrl = new URL('./vendor/ffmpeg-core/ffmpeg-core.js', window.location.href).href;
  const wasmUrl = new URL('./vendor/ffmpeg-core/ffmpeg-core.wasm', window.location.href).href;
  await loadScript(ffmpegScriptUrl);
  if (!window.FFmpegWASM || !window.FFmpegWASM.FFmpeg) {
    throw new Error('The FFmpeg engine was unavailable after loading.');
  }

  state.ffmpeg = new window.FFmpegWASM.FFmpeg();
  state.ffmpeg.on('progress', ({ progress }) => {
    const fraction = Math.max(0, Math.min(1, Number(progress) || 0));
    if (state.progressStage === 'pass1') {
      setProgress('First pass: analysing video…', 15 + (fraction * 35), 'The first pass measures scene complexity and does not create the final file.');
    } else if (state.progressStage === 'pass2') {
      setProgress('Second pass: creating final video…', 50 + (fraction * 44), 'The second pass spends the available bitrate where it is most useful.');
    } else {
      setProgress('Compressing video…', 15 + (fraction * 79), 'One-pass encoding is faster but the final size can vary more.');
    }
  });

  await state.ffmpeg.load({ coreURL: coreUrl, wasmURL: wasmUrl });
  state.ffmpegLoaded = true;
  setEngineState('ENGINE READY');
  setProgress('Engine ready.', 10);
}

function getFfmpegNames(file, outputPlan) {
  const inputExtension = getExtension(file.name) || 'mp4';
  return {
    inputName: `input.${inputExtension}`,
    outputName: `output.${outputPlan.extension}`,
    passLogName: 'vidcompressor-pass'
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
  const command = [
    '-y',
    '-i', inputName,
    '-map', '0:v:0'
  ];
  if (plan.audioBitrateKbps) command.push('-map', '0:a?');
  command.push('-map_metadata', '0', ...getVideoCodecArguments(plan));
  if (plan.passes === 2) command.push('-pass', '2', '-passlogfile', passLogName);
  command.push(...getAudioArguments(plan), ...getContainerArguments(plan), outputName);
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
      // Temporary files may not exist for every codec and pass mode.
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

async function compressVideo() {
  if (!state.sourceFile || state.isBusy) return;
  const plan = getCompressionPlan();
  if (!plan) {
    setStatus('The video duration is required before size-targeted compression can begin.', 'error');
    return;
  }

  setBusy(true);
  resetResult();
  setEngineState(state.ffmpegLoaded ? 'ENGINE READY' : 'LOADING ENGINE');
  setStatus('Preparing the video compressor…');
  const names = getFfmpegNames(state.sourceFile, plan.outputPlan);

  try {
    await ensureFfmpeg();
    setProgress('Loading video into browser memory…', 12, 'The source remains on this device.');
    const sourceData = new Uint8Array(await state.sourceFile.arrayBuffer());
    await state.ffmpeg.writeFile(names.inputName, sourceData);

    if (plan.passes === 2) {
      state.progressStage = 'pass1';
      setStatus(`Analysing the video for a ${formatBytes(plan.estimatedBytes)} target…`);
      await state.ffmpeg.exec(buildFirstPassCommand(names.inputName, names.passLogName, plan));
      state.progressStage = 'pass2';
      setStatus(`Creating the final ${plan.outputPlan.extension.toUpperCase()} using the calculated video and audio bitrates…`);
    } else {
      state.progressStage = 'encode';
      setStatus(`Creating the ${plan.outputPlan.extension.toUpperCase()} in one pass…`);
    }

    await state.ffmpeg.exec(buildFinalCommand(names.inputName, names.outputName, names.passLogName, plan));
    setProgress('Reading compressed video…', 96, 'Preparing the result and save options.');
    const outputData = await state.ffmpeg.readFile(names.outputName);
    state.outputBlob = new Blob([outputData], { type: plan.outputPlan.mime });
    state.outputFileName = plan.outputPlan.name;
    state.outputCanOverwriteSource = Boolean(state.sourceHandle && plan.outputPlan.canOverwrite);
    state.outputObjectUrl = URL.createObjectURL(state.outputBlob);

    const actualDifference = state.outputBlob.size - state.sourceFile.size;
    const actualPercent = state.sourceFile.size ? (actualDifference / state.sourceFile.size) * 100 : 0;
    const differencePrefix = actualDifference > 0 ? '+' : actualDifference < 0 ? '-' : '';
    const percentPrefix = actualPercent > 0 ? '+' : '';

    elements.resultFileName.textContent = state.outputFileName;
    elements.resultOriginalSize.textContent = formatBytes(state.sourceFile.size);
    elements.resultEstimatedSize.textContent = `${formatBytes(plan.lowerBytes)}–${formatBytes(plan.upperBytes)}`;
    elements.resultOutputSize.textContent = formatBytes(state.outputBlob.size);
    elements.resultChange.textContent = `${differencePrefix}${formatBytes(Math.abs(actualDifference))} · ${percentPrefix}${Math.round(actualPercent)}%`;
    elements.resultAccuracy.textContent = describeEstimateAccuracy(state.outputBlob.size, plan.estimatedBytes);
    elements.resultFormat.textContent = plan.outputPlan.extension.toUpperCase();
    showResultPreview(plan.outputPlan);
    elements.resultCard.classList.add('visible');
    elements.saveActions.classList.add('visible');
    setProgress('Compression complete.', 100);
    hideProgress();
    setEngineState('ENGINE READY');

    const saveInstruction = state.outputCanOverwriteSource ? 'Choose Save Over Original or Save New Copy.' : 'Choose Save New Copy.';
    if (state.outputBlob.size > state.sourceFile.size) {
      setStatus(`The conversion completed, but the result is larger than the original. Reduce the target or bitrate before saving. ${saveInstruction}`, 'warning');
    } else {
      setStatus(`Compressed ${plan.outputPlan.extension.toUpperCase()} video is ready. ${saveInstruction}`, 'success');
    }
  } catch (error) {
    console.error(error);
    hideProgress();
    setEngineState(state.ffmpegLoaded ? 'ENGINE READY' : 'ENGINE ERROR');
    const message = error && error.message ? error.message : 'Compression failed.';
    const codecHint = plan.outputPlan.codecFamily === 'ogv' ? ' The bundled engine must include libtheora and libvorbis.' : '';
    setStatus(`${message}${codecHint} Try a shorter video or a lower target resolution if browser memory is tight.`, 'error');
  } finally {
    await cleanupTemporaryFiles(names);
    state.progressStage = 'encode';
    setBusy(false);
  }
}

async function writeBlobToHandle(handle) {
  const writable = await handle.createWritable();
  await writable.write(state.outputBlob);
  await writable.close();
}

function triggerDownload() {
  const link = document.createElement('a');
  link.href = state.outputObjectUrl;
  link.download = state.outputFileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function saveOverOriginal() {
  if (!state.outputBlob || !state.sourceHandle || !state.outputCanOverwriteSource || state.isBusy) return;
  const proceed = window.confirm(`Replace “${state.sourceFile.name}” with the compressed version?\n\nThe original file will be overwritten.`);
  if (!proceed) return;
  try {
    setBusy(true);
    setStatus('Requesting permission to overwrite the original…');
    const permission = await state.sourceHandle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') throw new Error('Permission to overwrite the original file was not granted.');
    await writeBlobToHandle(state.sourceHandle);
    setStatus(`Saved compressed video over “${state.sourceFile.name}”.`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(`${error.message || 'Could not overwrite the original file.'} Use Save New Copy instead.`, 'error');
  } finally {
    setBusy(false);
  }
}

async function saveNewCopy() {
  if (!state.outputBlob || state.isBusy) return;
  try {
    setBusy(true);
    setStatus('Saving a new compressed copy…');
    if (window.showSaveFilePicker) {
      const extension = `.${getExtension(state.outputFileName) || 'mp4'}`;
      const handle = await window.showSaveFilePicker({
        suggestedName: state.outputFileName,
        types: [{
          description: 'Compressed video',
          accept: { [state.outputBlob.type || 'video/mp4']: [extension] }
        }]
      });
      await writeBlobToHandle(handle);
      setStatus(`Saved “${state.outputFileName}”.`, 'success');
    } else {
      triggerDownload();
      setStatus(`Your browser downloaded “${state.outputFileName}”.`, 'success');
    }
  } catch (error) {
    if (error && error.name === 'AbortError') {
      setStatus('Save cancelled.');
    } else {
      console.error(error);
      setStatus(error.message || 'Could not save the compressed copy.', 'error');
    }
  } finally {
    setBusy(false);
  }
}

async function chooseVideoWithHandle() {
  if (state.isBusy) return;
  try {
    if (!window.showOpenFilePicker) {
      elements.fileInput.click();
      return;
    }
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{
        description: 'Video files',
        accept: { 'video/*': ['.mp4', '.m4v', '.mov', '.mkv', '.avi', '.webm', '.ogv', '.ogg'] }
      }]
    });
    loadSourceFile(await handle.getFile(), handle);
  } catch (error) {
    if (error && error.name !== 'AbortError') {
      console.error(error);
      elements.fileInput.click();
      setStatus('The browser file picker could not provide overwrite access. A new copy can still be saved after compression.');
    }
  }
}
