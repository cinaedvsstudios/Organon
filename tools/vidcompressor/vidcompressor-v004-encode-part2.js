async function requestOutputFolder() {
  if (!window.showDirectoryPicker) {
    throw new Error('This browser cannot authorise an output folder for bulk convert. Use a current Chromium browser.');
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  state.outputFolderHandle = handle;
  syncModeUi();
  updateAccessNote();
  updateEstimate();
  setStatus(`Output folder authorised: ${handle.name}. Press Convert Queue to process every file.`, 'success');
}

async function saveOverOriginal() {
  const item = getPrimaryItem();
  if (!state.outputBlob || !item || !item.handle || !state.outputCanOverwriteSource || state.isBusy || state.mode !== 'single') return;
  const proceed = window.confirm(`Replace “${item.file.name}” with the compressed version?\n\nThe original file will be overwritten.`);
  if (!proceed) return;
  try {
    setBusy(true);
    setStatus('Requesting permission to overwrite the original…');
    const permission = await item.handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') throw new Error('Permission to overwrite the original file was not granted.');
    await writeBlobToHandle(item.handle, state.outputBlob);
    setStatus(`Saved compressed video over “${item.file.name}”.`, 'success');
  } catch (error) {
    const message = error && error.message ? error.message : 'Could not overwrite the original file.';
    setStatus(`${message} Use Save New Copy instead.`, 'error');
  } finally {
    setBusy(false);
  }
}

async function saveNewCopy() {
  if (!state.outputBlob || state.isBusy || state.mode !== 'single') return;
  try {
    setBusy(true);
    setStatus('Saving a new compressed copy…');
    if (window.showSaveFilePicker) {
      const extension = `.${getExtension(state.outputFileName) || 'mp4'}`;
      const handle = await window.showSaveFilePicker({
        suggestedName: state.outputFileName,
        types: [{ description: 'Compressed video', accept: { [state.outputBlob.type || 'video/mp4']: [extension] } }]
      });
      await writeBlobToHandle(handle, state.outputBlob);
      setStatus(`Saved “${state.outputFileName}”.`, 'success');
    } else {
      triggerDownload(state.outputBlob, state.outputFileName);
      setStatus(`Your browser downloaded “${state.outputFileName}”.`, 'success');
    }
  } catch (error) {
    if (error && error.name === 'AbortError') {
      setStatus('Save cancelled.');
    } else {
      const message = error && error.message ? error.message : 'Could not save the compressed copy.';
      setStatus(message, 'error');
    }
  } finally {
    setBusy(false);
  }
}

async function encodeOneItem(item, batchIndex = 0, batchTotal = 1) {
  const plan = getCompressionPlan(item);
  if (!plan) throw new Error(`The duration for “${item.file.name}” is unavailable.`);
  const names = getFfmpegNames(item, plan.outputPlan);
  try {
    const sourceData = new Uint8Array(await item.file.arrayBuffer());
    await state.ffmpeg.writeFile(names.inputName, sourceData);
    if (plan.passes === 2) {
      state.progressStage = 'pass1';
      setProgress(batchTotal > 1 ? `Batch ${batchIndex} of ${batchTotal} — pass 1` : 'Analysing video…', 10, item.file.name);
      await state.ffmpeg.exec(buildFirstPassCommand(names.inputName, names.passLogName, plan));
      state.progressStage = 'pass2';
      setProgress(batchTotal > 1 ? `Batch ${batchIndex} of ${batchTotal} — pass 2` : 'Creating final video…', 55, item.file.name);
    } else {
      state.progressStage = 'encode';
      setProgress(batchTotal > 1 ? `Batch ${batchIndex} of ${batchTotal}` : 'Creating final video…', 10, item.file.name);
    }
    await state.ffmpeg.exec(buildFinalCommand(names.inputName, names.outputName, names.passLogName, plan));
    const outputData = await state.ffmpeg.readFile(names.outputName);
    const blob = new Blob([outputData], { type: plan.outputPlan.mime });
    return { plan, names, blob, fileName: plan.outputPlan.name };
  } finally {
    await cleanupTemporaryFiles(names);
  }
}

async function compressSingle() {
  const item = getPrimaryItem();
  const plan = getCompressionPlan(item);
  if (!item || !plan) {
    setStatus('The selected video needs readable metadata before compression can begin.', 'error');
    return;
  }
  setBusy(true);
  resetResult();
  setEngineState(state.ffmpegLoaded ? 'ENGINE READY' : 'LOADING ENGINE');
  setStatus('Preparing the video compressor…');
  try {
    await ensureFfmpeg();
    const result = await encodeOneItem(item, 1, 1);
    state.outputBlob = result.blob;
    state.outputFileName = result.fileName;
    state.outputCanOverwriteSource = Boolean(item.handle && result.plan.outputPlan.canOverwrite);
    state.outputObjectUrl = URL.createObjectURL(state.outputBlob);
    populateResult(result.plan, state.outputBlob.size);
    elements.saveActions.classList.add('visible');
    hideProgress();
    setEngineState('ENGINE READY');
    const saveInstruction = state.outputCanOverwriteSource ? 'Choose Save Over Original or Save New Copy.' : 'Choose Save New Copy.';
    setStatus(`Compressed ${result.plan.outputPlan.extension.toUpperCase()} video is ready. ${saveInstruction}`, state.outputBlob.size > item.file.size ? 'warning' : 'success');
  } catch (error) {
    hideProgress();
    setEngineState(state.ffmpegLoaded ? 'ENGINE READY' : 'ENGINE ERROR');
    const message = error && error.message ? error.message : 'Compression failed.';
    setStatus(`${message} Try a shorter video or a lower target resolution if browser memory is tight.`, 'error');
  } finally {
    setBusy(false);
  }
}

async function compressBatch() {
  if (!state.queue.length) {
    setStatus('Add videos to the queue first.', 'error');
    return;
  }
  if (!state.outputFolderHandle) {
    setStatus('Bulk mode requires Save Options first so you can authorise the output folder.', 'error');
    return;
  }
  setBusy(true);
  resetResult();
  setEngineState(state.ffmpegLoaded ? 'ENGINE READY' : 'LOADING ENGINE');
  setStatus('Preparing the batch conversion…');
  try {
    await ensureFfmpeg();
    let savedCount = 0;
    for (let index = 0; index < state.queue.length; index += 1) {
      const item = state.queue[index];
      item.status = 'converting';
      item.statusLabel = 'Converting';
      state.selectedQueueId = item.id;
      loadSelectedItemIntoPreview();
      updateQueueUi();
      updateEstimate();
      try {
        const result = await encodeOneItem(item, index + 1, state.queue.length);
        const outputHandle = await getUniqueFileHandle(state.outputFolderHandle, result.fileName);
        await writeBlobToHandle(outputHandle, result.blob);
        item.status = 'saved';
        item.statusLabel = 'Saved';
        item.lastResult = { size: result.blob.size, fileName: result.fileName, extension: result.plan.outputPlan.extension };
        state.lastCompletedItemId = item.id;
        revokeOutputObjectUrl();
        state.outputBlob = result.blob;
        state.outputFileName = result.fileName;
        state.outputCanOverwriteSource = false;
        state.outputObjectUrl = URL.createObjectURL(result.blob);
        populateResult(result.plan, result.blob.size);
        savedCount += 1;
        setStatus(`Saved ${result.fileName} to ${state.outputFolderHandle.name}. (${index + 1}/${state.queue.length})`, 'success');
      } catch (error) {
        item.status = 'failed';
        item.statusLabel = 'Failed';
        item.lastResult = null;
        setStatus(`Failed on ${item.file.name}: ${error && error.message ? error.message : 'unknown error'}`, 'error');
      }
      updateQueueUi();
    }
    hideProgress();
    setEngineState('ENGINE READY');
    setStatus(`Batch complete. ${savedCount} of ${state.queue.length} files were written to ${state.outputFolderHandle.name}.`, savedCount === state.queue.length ? 'success' : 'warning');
  } catch (error) {
    hideProgress();
    setEngineState(state.ffmpegLoaded ? 'ENGINE READY' : 'ENGINE ERROR');
    const message = error && error.message ? error.message : 'Batch conversion failed.';
    setStatus(message, 'error');
  } finally {
    setBusy(false);
  }
}

async function compressVideo() {
  if (state.mode === 'bulk') {
    await compressBatch();
  } else {
    await compressSingle();
  }
}
