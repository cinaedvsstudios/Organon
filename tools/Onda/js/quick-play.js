/* Onda v3.19 — temporary audio audition. No storage, queue, history or cloud writes.
 * Deliberately separate from Onda's permanent import pipeline. */
(() => {
    'use strict';
    const picker = document.getElementById('onda-quick-play-input');
    const panel = document.getElementById('onda-quick-play-panel');
    const previewAudio = document.getElementById('onda-quick-play-audio');
    const title = document.getElementById('onda-quick-play-title');
    const status = document.getElementById('onda-quick-play-status');
    const chooseButton = document.getElementById('btn-onda-quick-play');
    const mobileChooseButton = document.getElementById('btn-mobile-quick-play-audio');
    const replayButton = document.getElementById('btn-onda-quick-replay');
    const importButton = document.getElementById('btn-onda-quick-import');
    const discardButton = document.getElementById('btn-onda-quick-discard');
    if (!picker || !panel || !previewAudio || !chooseButton) return;

    let selectedFile = null;
    let selectedFiles = [];
    const batchLabel = document.getElementById('onda-quick-batch-label');
    const batchSelect = document.getElementById('onda-quick-batch-select');
    function updateBatchControls() {
        if (batchLabel) batchLabel.hidden = selectedFiles.length < 2;
        if (batchSelect) {
            batchSelect.replaceChildren(...selectedFiles.map((file,index) => {
                const option = document.createElement('option');
                option.value = String(index); option.textContent = (index+1)+'. '+file.name; return option;
            }));
            batchSelect.value = String(Math.max(0,selectedFiles.indexOf(selectedFile)));
        }
        if (importButton) importButton.textContent = selectedFiles.length > 1 ? 'Add All '+selectedFiles.length+' to Library + Queue' : 'Add to Library + Queue';
    }
    let previewUrl = null;
    let previewActive = false;
    let playbackGeneration = 0;
    let importInProgress = false;
    const bridge = window.OndaQuickPlayBridge;

    const showStatus = message => {
        if (status) status.textContent = message;
    };
    const refreshSession = () => {
        try { window.OndaMediaSession?.refresh?.(); } catch (_) {}
    };
    function isPlayableAudioFile(file) {
        if (!file || typeof file.name !== 'string') return false;
        const mime = String(file.type || '').toLowerCase();
        if (/\.(mid|midi)$/i.test(file.name) || /midi/.test(mime)) return false;
        if (mime.startsWith('video/')) return false;
        return mime.startsWith('audio/') || /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus|webm)$/i.test(file.name);
    }
    function dropUrl() {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }
    }
    function stopPreview(message = '', forgetFile = false) {
        playbackGeneration += 1;
        previewActive = false;
        previewAudio.pause();
        previewAudio.removeAttribute('src');
        // A removed src cannot start playing again by accident.
        previewAudio.load();
        dropUrl();
        if (forgetFile) {
            selectedFile = null;
            selectedFiles = [];
            updateBatchControls();
            panel.hidden = true;
            if (title) title.textContent = '';
        }
        if (message && !forgetFile) showStatus(message);
        refreshSession();
    }
    function startPreview(file = selectedFile) {
        if (!isPlayableAudioFile(file)) {
            showStatus('Choose an audio file. MIDI and video remain available through normal Add Files.');
            bridge?.notify?.('Quick Play accepts audio only. Use Add Files for MIDI or video.');
            return false;
        }
        // Stop Onda's existing track only when a new audition actually starts.
        stopPreview();
        selectedFile = file;
        if (!selectedFiles.includes(file)) selectedFiles = [file];
        updateBatchControls();
        panel.hidden = false;
        if (title) title.textContent = file.name;
        try {
            previewUrl = URL.createObjectURL(file);
            previewAudio.src = previewUrl;
        } catch (_) {
            stopPreview('Could not open this file for temporary playback.');
            bridge?.notify?.('Unable to preview that file. Try normal Add Files or another format.');
            return false;
        }
        previewActive = true;
        bridge?.pauseMain?.();
        refreshSession();
        const generation = ++playbackGeneration;
        showStatus('Temporary preview playing. Use Add to Library + Queue only if you want to keep it.');
        try {
            const playPromise = previewAudio.play();
            if (playPromise?.catch) {
                playPromise.catch(() => {
                    if (generation !== playbackGeneration) return;
                    showStatus('Autoplay was blocked or the format is unavailable. Tap Play in the preview controls to retry.');
                });
            }
        } catch (_) {
            showStatus('Playback could not start. Tap Play in the preview controls or select another file.');
        }
        return true;
    }
    function choose() {
        if (importInProgress) return;
        // Picker must open synchronously with the user's click/tap.
        picker.value = '';
        picker.click();
    }
    function returnToAddView() {
        try { window.switchWorkspaceTab?.('tab-files'); } catch (_) {}
    }
    picker.addEventListener('change', () => {
        const picked = Array.from(picker.files || []);
        picker.value = '';
        if (!picked.length) return;
        const valid = picked.filter(isPlayableAudioFile);
        if (!valid.length) {
            showStatus('No supported audio files selected. Use Add Files for MIDI or video.');
            bridge?.notify?.('Quick Play accepts audio only. Use Add Files for MIDI or video.');
            return;
        }
        returnToAddView();
        selectedFiles = valid;
        startPreview(valid[0]);
        if (valid.length !== picked.length) bridge?.notify?.((picked.length-valid.length)+' unsupported file(s) skipped.');
    });
    batchSelect?.addEventListener('change', () => {
        if (!importInProgress && selectedFiles[Number(batchSelect.value)]) startPreview(selectedFiles[Number(batchSelect.value)]);
    });
    chooseButton.addEventListener('click', choose);
    mobileChooseButton?.addEventListener('click', choose);
    replayButton?.addEventListener('click', () => {
        if (selectedFile) startPreview(selectedFile);
    });
    discardButton?.addEventListener('click', () => {
        stopPreview('', true);
    });
    importButton?.addEventListener('click', async () => {
        if (!selectedFile || importInProgress) return;
        const file = selectedFile;
        const files = selectedFiles.slice();
        importInProgress = true;
        importButton.disabled = true;
        // No duplicate import implementation: the existing Add Files path owns
        // metadata, identity, library state, queue and IndexedDB cache.
        stopPreview('Adding through the normal Library importer…');
        try {
            if (files.length > 1) {
                if (typeof bridge?.addFilesToLibrary !== 'function') throw new Error('Batch import unavailable');
                await bridge.addFilesToLibrary(files);
            } else {
                if (typeof bridge?.addToLibrary !== 'function') throw new Error('Import unavailable');
                await bridge.addToLibrary(file);
            }
            selectedFile = null;
            panel.hidden = true;
        } catch (_) {
            selectedFile = file;
            selectedFiles = files;
            updateBatchControls();
            panel.hidden = false;
            showStatus('Could not finish importing. Your selection remains available to retry.');
        } finally {
            importInProgress = false;
            importButton.disabled = false;
        }
    });
    previewAudio.addEventListener('error', () => {
        if (selectedFile && previewActive) showStatus('The browser could not decode this audio file. Try a different format.');
    });
    previewAudio.addEventListener('ended', () => {
        if (selectedFile) showStatus('Preview finished. Replay, add to Library, or discard.');
        refreshSession();
    });
    previewAudio.addEventListener('play', () => {
        if (selectedFile && !previewActive) {
            previewActive = true;
            bridge?.pauseMain?.();
        }
        refreshSession();
    });
    previewAudio.addEventListener('pause', refreshSession);

    // Any normal playback takes precedence; the temporary file stays available
    // for explicit Replay or Add, but its blob URL is released immediately.
    bridge?.onMainPlayback?.(() => {
        if (previewActive) stopPreview('Main player resumed. Replay or add this temporary file.');
    });
    window.addEventListener('pagehide', () => {
        stopPreview('', true);
    });
    window.OndaQuickPlay = Object.freeze({
        getActiveAudio: () => previewActive && selectedFile ? previewAudio : null,
        getMetadata: () => previewActive && selectedFile
            ? {
                id: 'onda-temporary-preview',
                title: selectedFile.name.replace(/\.[^/.]+$/, ''),
                fileName: selectedFile.name,
                artist: '',
                album: 'Quick Play'
            } : null,
        play: () => {
            if (!previewActive || !selectedFile) return;
            const p = previewAudio.play();
            p?.catch?.(() => showStatus('Could not resume preview. Use Replay to try again.'));
        },
        pause: () => {
            if (previewActive) previewAudio.pause();
        },
        stop: () => stopPreview('Preview stopped. Replay or add this temporary file.'),
        stopForMainPlayback: () => {
            if (previewActive) stopPreview('Main player resumed. Replay or add this temporary file.');
        },
        stopForNavigation: () => {
            if (previewActive) stopPreview('Preview stopped when leaving Add. Replay when you return.');
        }
    });
})();
