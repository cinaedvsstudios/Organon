/**
 * ORGANON STUDIO: MOTORICLIP ADVANCED CONTROLLER
 * v0.24 — direct basin iframe file-drop route, robust preview resize, preview zoom, delete and duplicate selection.
 * Basic Mode is untouched.
 */

import { AdvancedTimeline } from './advanced-timeline-v0.24.js';
import { AdvancedMediaEngine } from './advanced-media-engine-v0.24.js?build=20261117-phase6b';
import { snapshotProject, restoreFileEntries, prepareHistoryTracks, referencedFileIds } from './project-history.mjs';
import { AdvancedLiveExporter } from './advanced-live-export.mjs';
import { AdvancedOfflineExporter, OFFLINE_EXPORT_LIMIT_SECONDS } from './advanced-offline-export.mjs';
import { normalizeVisualTransitions, splitVisualTransitions, fadeDuration } from './visual-transitions.mjs';
import { TRANSITION_CATALOG } from './transition-catalog.mjs';
import { planPairedTransition, isPairedFadeActive } from './clip-pair-transitions.mjs';

(() => {
    const FILE_PATTERN = /\.(mp4|webm|mov|m4v|avi|mkv|mp3|wav|m4a|aac|ogg|opus|flac|gif|webp|png|jpe?g)$/i;
    const VIDEO_PATTERN = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;
    const AUDIO_PATTERN = /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i;
    const STICKER_PATTERN = /\.(gif|webp|png)$/i;
    const BACKGROUND_PATTERN = /\.(jpe?g)$/i;
    const state = {
        files: [], tracks: [], selectedTrackId: null, selectedTrackIds: new Set(), selectedFileId: null,
        contextTrackId: null, dragDepth: 0, isSeeking: false, serial: 0, liveRenderRequest: null,
        toastTimer: null, selectionMode: false, previewZoom: 100,
        history: { undo: [], redo: [], limit: 60 }, historyRestoring: false, sourceFiles: new Map()
    };

    const elements = {
        editorHeader: document.getElementById('motori-header'), btnToggleHeader: document.getElementById('btn-toggle-header'),
        btnProjectSettings: document.getElementById('btn-project-settings'), btnProjectExport: document.getElementById('btn-project-export'),
        projectSettingsModal: document.getElementById('project-settings-modal'), projectExportModal: document.getElementById('project-export-modal'),
        btnAddTrack: document.getElementById('btn-add-track'), trackTypeMenu: document.getElementById('track-type-menu'),
        btnOpenTransitions: document.getElementById('btn-open-transitions'), transitionModal: document.getElementById('transition-modal'),
        transitionModalFrom: document.getElementById('transition-modal-from'), transitionModalTo: document.getElementById('transition-modal-to'),
        transitionModalEffect: document.getElementById('transition-modal-effect'), transitionModalDuration: document.getElementById('transition-modal-duration'),
        btnApplyTransitionModal: document.getElementById('btn-apply-transition-modal'), transitionModalStatus: document.getElementById('transition-modal-status'),
        btnToggleRuler: document.getElementById('btn-toggle-ruler'), timelineRuler: document.getElementById('timeline-ruler'),
        canvas: document.getElementById('advanced-canvas'), mediaBin: document.getElementById('media-bin'),
        previewStage: document.getElementById('preview-stage'), previewResizeHandle: document.getElementById('preview-resize-handle'), previewZoom: document.getElementById('preview-zoom'), previewZoomValue: document.getElementById('preview-zoom-value'), btnResetPreviewZoom: document.getElementById('btn-reset-preview-zoom'), previewEmpty: document.getElementById('preview-empty'), previewState: document.getElementById('preview-state'),
        previewSeek: document.getElementById('preview-seek'), previewVolume: document.getElementById('preview-volume'), timeReadout: document.getElementById('time-readout'),
        btnPlay: document.getElementById('btn-play'), btnPreviewMute: document.getElementById('btn-preview-mute'), btnStepBack: document.getElementById('btn-step-back'), btnStepForward: document.getElementById('btn-step-forward'), btnSnapshot: document.getElementById('btn-snapshot'),
        fileInput: document.getElementById('file-input'), btnImport: document.getElementById('btn-import'), btnBrowse: document.getElementById('btn-browse'), btnHeaderBrowse: document.getElementById('btn-header-browse'), btnClear: document.getElementById('btn-clear'), btnBasicMode: document.getElementById('btn-basic-mode'),
        fileList: document.getElementById('file-list'), fileCount: document.getElementById('file-count'), projectDropZone: document.getElementById('project-drop-zone'), dropOverlay: document.getElementById('project-drop-overlay'),
        canvasWidth: document.getElementById('canvas-width'), canvasHeight: document.getElementById('canvas-height'), canvasAspectLabel: document.getElementById('canvas-aspect-label'), btnApplyCanvas: document.getElementById('btn-apply-canvas'), projectFps: document.getElementById('project-fps'),
        exportFormat: document.getElementById('export-format'), exportBitrate: document.getElementById('export-bitrate'), btnExportVideo: document.getElementById('btn-export-video'), exportStatus: document.getElementById('export-status'),
        exportOfflineFormat: document.getElementById('export-offline-format'), btnExportOffline: document.getElementById('btn-export-offline'), exportOverlayNote: document.getElementById('export-overlay-note'),
        exportOverlay: document.getElementById('export-overlay'), exportOverlayStatus: document.getElementById('export-overlay-status'), exportProgress: document.getElementById('export-progress'), exportProgressText: document.getElementById('export-progress-text'), btnExportCancel: document.getElementById('btn-export-cancel'),
        toast: document.getElementById('app-toast'), timelineZoom: document.getElementById('timeline-zoom'), timelineZoomValue: document.getElementById('timeline-zoom-value'), btnResetTimelineZoom: document.getElementById('btn-reset-timeline-zoom'), btnUndo: document.getElementById('btn-undo'), btnRedo: document.getElementById('btn-redo'), btnSplitAll: document.getElementById('btn-split-all'), btnSelectionMode: document.getElementById('btn-selection-mode'), btnGroupSelection: document.getElementById('btn-group-selection'), btnDuplicateSelection: document.getElementById('btn-duplicate-selection'), btnDeleteSelection: document.getElementById('btn-delete-selection'),
        inspectorKind: document.getElementById('inspector-kind'), inspectorProject: document.getElementById('inspector-project'), pairTransitionPanel: document.getElementById('pair-transition-panel'), pairTransitionDescription: document.getElementById('pair-transition-description'), pairTransitionEffect: document.getElementById('pair-transition-effect'), pairTransitionDuration: document.getElementById('pair-transition-duration'), btnApplyPairTransition: document.getElementById('btn-apply-pair-transition'), transitionLibraryGrid: document.getElementById('transition-library-grid'), transitionLibraryStatus: document.getElementById('transition-library-status'), inspectorVideo: document.getElementById('inspector-video'), inspectorBackground: document.getElementById('inspector-background'), inspectorAudio: document.getElementById('inspector-audio'), inspectorSticker: document.getElementById('inspector-sticker'),
        selectedVideoName: document.getElementById('selected-video-name'), videoVisibleSwitch: document.getElementById('video-visible-switch'), videoAudioSwitch: document.getElementById('video-audio-switch'), videoAudioVolume: document.getElementById('video-audio-volume'), videoAudioVolumeValue: document.getElementById('video-audio-volume-value'), videoOpacity: document.getElementById('video-opacity'), videoOpacityValue: document.getElementById('video-opacity-value'), videoBlendMode: document.getElementById('video-blend-mode'), videoTransitionEnter: document.getElementById('video-transition-enter'), videoTransitionEnterValue: document.getElementById('video-transition-enter-value'), videoTransitionEnterCurve: document.getElementById('video-transition-enter-curve'), videoTransitionExit: document.getElementById('video-transition-exit'), videoTransitionExitValue: document.getElementById('video-transition-exit-value'), videoTransitionExitCurve: document.getElementById('video-transition-exit-curve'), videoTransitionSummary: document.getElementById('video-transition-summary'), videoTransitionPairNote: document.getElementById('video-transition-pair-note'), btnUnpairTransition: document.getElementById('btn-unpair-transition'), btnExtractAudio: document.getElementById('btn-extract-audio'),
        selectedBackgroundName: document.getElementById('selected-background-name'), backgroundVisibleSwitch: document.getElementById('background-visible-switch'), backgroundOpacity: document.getElementById('background-opacity'), backgroundOpacityValue: document.getElementById('background-opacity-value'), backgroundBlendMode: document.getElementById('background-blend-mode'),
        selectedAudioName: document.getElementById('selected-audio-name'), audioAuditionSwitch: document.getElementById('audio-audition-switch'), audioTrackVolume: document.getElementById('audio-track-volume'), audioTrackVolumeValue: document.getElementById('audio-track-volume-value'), audioFadeIn: document.getElementById('audio-fade-in'), audioFadeInValue: document.getElementById('audio-fade-in-value'), audioFadeOut: document.getElementById('audio-fade-out'), audioFadeOutValue: document.getElementById('audio-fade-out-value'),
        selectedStickerName: document.getElementById('selected-sticker-name'), stickerVisibleSwitch: document.getElementById('sticker-visible-switch'), stickerOpacity: document.getElementById('sticker-opacity'), stickerOpacityValue: document.getElementById('sticker-opacity-value'), stickerBlendMode: document.getElementById('sticker-blend-mode'), stickerTransparencyMode: document.getElementById('sticker-transparency-mode'), stickerKeyColour: document.getElementById('sticker-key-colour'), stickerKeyColourText: document.getElementById('sticker-key-colour-text'), stickerKeyTolerance: document.getElementById('sticker-key-tolerance'), stickerKeyToleranceValue: document.getElementById('sticker-key-tolerance-value'), stickerEdgeFeather: document.getElementById('sticker-edge-feather'), stickerEdgeFeatherValue: document.getElementById('sticker-edge-feather-value'),
        contextMenu: document.getElementById('timeline-context-menu'), contextMenuTitle: document.getElementById('context-menu-title'), contextSplitNow: document.getElementById('context-split-now'), contextAddLayer: document.getElementById('context-add-layer'), contextExtractAudio: document.getElementById('context-extract-audio'), contextRemoveLayer: document.getElementById('context-remove-layer')
    };

    const engine = new AdvancedMediaEngine({
        canvas: elements.canvas,
        mediaBin: elements.mediaBin,
        onTimeChange: updateTimeDisplay,
        onDurationChange: (duration) => { timeline.setDuration(duration); updateTimeDisplay({ currentTime: engine.currentTime, duration }); updateExportAvailability(); },
        onPlaybackChange: setPlayButton,
        onRenderError: (error) => { elements.previewState.textContent = `Preview error: ${error.message}`; }
    });

    const timeline = new AdvancedTimeline({
        lanesElement: document.getElementById('timeline-lanes'),
        rulerElement: document.getElementById('timeline-ruler'),
        emptyElement: document.getElementById('timeline-empty'),
        onSelect: selectTrack,
        onContextMenu: openContextMenu,
        onDropProjectFile: placeProjectFile,
        onTrackChange: onTimelineTrackChanged,
        onTrackInteractionStart: (track, detail) => recordHistory(`${detail.mode === 'resize' ? 'Trim' : 'Move'} ${track.sourceName || track.laneLabel}`),
        onSeek: (time) => { void engine.seek(time).catch((error) => { elements.previewState.textContent = error.message; }); },
        onSplitAtPlayhead: splitTrackAtNow
    });

    const exporter = new AdvancedLiveExporter({
        engine, canvas:elements.canvas,
        onProgress: ({current,duration,percent}) => {
            elements.exportProgress.value = percent;
            elements.exportProgressText.textContent = `${Math.round(percent)}% · ${formatTime(current)} / ${formatTime(duration)}`;
        },
        onState: ({phase,message}) => {
            elements.exportStatus.textContent = message;
            elements.exportOverlayStatus.textContent = message;
            elements.exportOverlay.hidden = !['preparing','recording','finalizing'].includes(phase);
            elements.exportOverlayNote.textContent = 'This is a real-time recording. Keep MotoriClip visible until it finishes.';
            updateExportAvailability();
            if (phase === 'error') {
                elements.previewState.textContent = `Export error: ${message}`;
                showToast('Video export failed');
            }
            if (phase === 'complete') showToast(message);
            if (phase === 'cancelled') showToast('Export cancelled');
        },
        onDownload: ({blob,extension}) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `motoriclip-project.${extension}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
    });

    const offlineExporter = new AdvancedOfflineExporter({
        engine,
        onProgress: ({current,duration,percent}) => {
            elements.exportProgress.value = percent;
            elements.exportProgressText.textContent = `${Math.round(percent)}% · ${formatTime(current)} / ${formatTime(duration)}`;
        },
        onState: ({phase,message}) => {
            elements.exportStatus.textContent = message;
            elements.exportOverlayStatus.textContent = message;
            elements.exportOverlay.hidden = !['preparing','recording','finalizing'].includes(phase);
            elements.exportOverlayNote.textContent = 'Fixed-timestamp offline encoding (beta). Your project stays on this device; cancellation discards incomplete output.';
            updateExportAvailability();
            if (phase === 'error') {
                elements.previewState.textContent = `Export error: ${message}`;
                showToast('Fixed-frame export failed');
            }
            if (phase === 'complete') showToast(message);
            if (phase === 'cancelled') showToast('Fixed-frame export cancelled');
        },
        onDownload: ({blob,extension}) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `motoriclip-fixedframe-beta.${extension}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
    });

    function updateExportAvailability() {
        const supported = exporter.getFormats();
        const duration = engine.getTimelineDuration();
        const busy = exporter.busy || offlineExporter.busy;
        const captureReady = typeof elements.canvas.captureStream === 'function' && typeof window.MediaStream === 'function';
        elements.btnExportVideo.disabled = busy || !captureReady || supported.length === 0 || duration <= 0;
        elements.btnExportOffline.disabled = busy || !offlineExporter.getAvailable()
            || duration <= 0 || duration > OFFLINE_EXPORT_LIMIT_SECONDS;
        elements.btnExportOffline.title = duration > OFFLINE_EXPORT_LIMIT_SECONDS
            ? 'Fixed-frame beta currently supports projects up to 2 minutes'
            : (offlineExporter.getAvailable() ? 'Render with fixed timestamps (experimental)' : 'Requires WebCodecs and OfflineAudioContext');
    }
    function initVideoExportUi() {
        const formats = exporter.getFormats();
        elements.exportFormat.textContent = '';
        for (const format of formats) {
            const option = document.createElement('option');
            option.value = format.format;
            option.textContent = format.format === 'mp4' ? 'MP4 · browser-native' : 'WebM · browser-native';
            elements.exportFormat.appendChild(option);
        }
        const captureReady = typeof elements.canvas.captureStream === 'function' && typeof window.MediaStream === 'function';
        if (!formats.length || !captureReady) {
            const unavailable = document.createElement('option');
            unavailable.value = '';
            unavailable.textContent = 'No recording format';
            elements.exportFormat.appendChild(unavailable);
            elements.exportStatus.textContent = !captureReady
                ? 'This browser cannot capture the canvas and audio as a recording.'
                : 'This browser has no supported video-recording format.';
        } else {
            elements.exportStatus.textContent = 'Ready · full-timeline, real-time export';
        }
        updateExportAvailability();
    }

    elements.btnExportVideo.addEventListener('click', () => {
        elements.exportProgress.value = 0;
        elements.exportProgressText.textContent = '0%';
        void exporter.start({
            format:elements.exportFormat.value,
            fps:engine.projectFps,
            bitrateKbps:Number(elements.exportBitrate.value)
        }).catch((error) => {
            elements.exportStatus.textContent = `Export failed: ${error.message}`;
            elements.previewState.textContent = `Export error: ${error.message}`;
        });
    });
    elements.btnExportOffline.addEventListener('click', () => {
        elements.exportProgress.value = 0;
        elements.exportProgressText.textContent = '0%';
        void offlineExporter.start({
            format:elements.exportOfflineFormat.value,
            fps:engine.projectFps,
            bitrateKbps:Number(elements.exportBitrate.value)
        }).catch((error) => {
            elements.exportStatus.textContent = `Fixed-frame export failed: ${error.message}`;
            elements.previewState.textContent = `Export error: ${error.message}`;
            updateExportAvailability();
        }).finally(() => updateExportAvailability());
    });
    elements.btnExportCancel.addEventListener('click', () => {
        if (offlineExporter.busy) void offlineExporter.cancel();
        else void exporter.cancel();
    });
    document.addEventListener('keydown', (event) => {
        if (!exporter.busy && !offlineExporter.busy) return;
        if (event.key === 'Escape') {
            if (offlineExporter.busy) void offlineExporter.cancel();
            else void exporter.cancel();
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

    function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
    function formatTime(seconds) {
        const safe = Math.max(0, Number(seconds) || 0);
        return `${Math.floor(safe / 60)}:${Math.floor(safe % 60).toString().padStart(2, '0')}`;
    }
    function formatSeconds(seconds) { return `${(Math.round((Number(seconds) || 0) * 10) / 10).toFixed(1)}s`; }
    function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
    function formatFileSize(size) { return !Number.isFinite(size) ? 'unknown size' : (size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`); }
    function getKind(file) {
        const name = file.name || '';
        if (file.type?.startsWith('video/') || VIDEO_PATTERN.test(name)) return 'video';
        if (file.type?.startsWith('audio/') || AUDIO_PATTERN.test(name)) return 'audio';
        if (file.type === 'image/jpeg' || BACKGROUND_PATTERN.test(name)) return 'background';
        if (file.type === 'image/gif' || file.type === 'image/webp' || file.type === 'image/png' || STICKER_PATTERN.test(name)) return 'sticker';
        return null;
    }
    function kindLabel(kind) { return ({ video: '🎬', audio: '🎵', sticker: '✨', background: '🖼️' })[kind] || '📄'; }
    function kindName(kind) { return ({ video: 'video', audio: 'audio', sticker: 'image / sticker', background: 'jpeg background' })[kind] || 'file'; }
    function getTrack(trackId = state.selectedTrackId) { return state.tracks.find((track) => track.id === trackId) || null; }
    function getFile(fileId) { return state.files.find((entry) => entry.id === fileId) || null; }
    function laneName(type, order) { return `${type === 'sticker' ? 'Sticker' : type === 'video' ? 'Video' : type === 'background' ? 'Background' : 'Audio'} ${order}`; }
    function nextLaneOrder(type) { return new Set(state.tracks.filter((track) => track.type === type).map((track) => track.laneId || track.id)).size + 1; }

    function createTrack(type, extras = {}) {
        const order = extras.order ?? nextLaneOrder(type);
        const laneId = extras.laneId || `${type}-lane-${Date.now()}-${++state.serial}`;
        const base = {
            id: `${type}-${Date.now()}-${++state.serial}`,
            type,
            order,
            laneId,
            laneLabel: extras.laneLabel || laneName(type, order),
            label: extras.label || laneName(type, order),
            start: 0,
            sourceOffset: 0,
            sourceDuration: 0,
            clipDuration: 0,
            sourceName: '',
            file: null,
            visible: true,
            opacity: 1,
            blendMode: 'source-over',
            groupId: null,
            transitionFromId: null, transitionEffectId: null,
            audio: { volume: 1, muted: false, fadeIn: 0, fadeOut: 0 },
            visualTransitions: normalizeVisualTransitions(),
            transparency: { mode: 'native', keyColour: '#00ff00', tolerance: 30, feather: 8 }
        };
        return { ...base, ...extras, audio: { ...base.audio, ...(extras.audio || {}) }, transparency: { ...base.transparency, ...(extras.transparency || {}) }, visualTransitions: normalizeVisualTransitions(extras.visualTransitions) };
    }

    function greatestCommonDivisor(a, b) { let x = Math.abs(a), y = Math.abs(b); while (y) [x, y] = [y, x % y]; return x || 1; }
    function updateCanvasAspectLabel(width, height) { const divisor = greatestCommonDivisor(width, height); elements.canvasAspectLabel.textContent = `${Math.round(width / divisor)}:${Math.round(height / divisor)}`; }
    function applyCanvasResolution({ announce = false } = {}) {
        const width = clamp(Math.round(Number(elements.canvasWidth.value) || 1280), 64, 7680);
        const height = clamp(Math.round(Number(elements.canvasHeight.value) || 720), 64, 7680);
        elements.canvasWidth.value = String(width); elements.canvasHeight.value = String(height);
        engine.setCanvasResolution(width, height);
        elements.previewStage.style.aspectRatio = `${width} / ${height}`;
        updateCanvasAspectLabel(width, height);
        if (announce) { elements.previewState.textContent = `Canvas set to ${width} × ${height}`; showToast(`Canvas set to ${width} × ${height}`); }
    }
    function showToast(message, duration = 3200) {
        clearTimeout(state.toastTimer);
        elements.toast.textContent = message;
        elements.toast.classList.add('visible');
        state.toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), duration);
    }


    function captureHistorySnapshot() {
        return snapshotProject({
            files: state.files, tracks: state.tracks, selectedTrackIds: state.selectedTrackIds,
            selectedTrackId: state.selectedTrackId, selectedFileId: state.selectedFileId,
            currentTime: engine.currentTime
        });
    }

    function pruneSourceRegistry() {
        const keep = referencedFileIds(state.files, state.tracks, state.history.undo, state.history.redo);
        for (const id of state.sourceFiles.keys()) if (!keep.has(id)) state.sourceFiles.delete(id);
    }

    function updateHistoryButtons() {
        const undo = !state.historyRestoring && state.history.undo.length > 0;
        const redo = !state.historyRestoring && state.history.redo.length > 0;
        elements.btnUndo.disabled = !undo;
        elements.btnRedo.disabled = !redo;
        elements.btnUndo.title = undo ? `Undo ${state.history.undo.at(-1).label}` : 'Nothing to undo';
        elements.btnRedo.title = redo ? `Redo ${state.history.redo.at(-1).label}` : 'Nothing to redo';
    }

    function recordHistory(label = 'timeline edit') {
        if (state.historyRestoring) return;
        state.history.undo.push({ label, snapshot: captureHistorySnapshot() });
        if (state.history.undo.length > state.history.limit) state.history.undo.shift();
        state.history.redo = [];
        pruneSourceRegistry();
        updateHistoryButtons();
    }

    async function restoreHistorySnapshot(snapshot) {
        if (!snapshot || state.historyRestoring) return;
        state.historyRestoring = true;
        updateHistoryButtons();
        try {
            const files = restoreFileEntries(snapshot.files, state.sourceFiles);
            if (files.length !== snapshot.files.length) throw new Error('Source file needed by undo/redo is missing.');
            engine.pause();
            // Prepare missing players before removing the current ones; reuse
            // unchanged players for a trim, move, group or inspector undo.
            const prepared = await prepareHistoryTracks({
                records: snapshot.tracks, existingTracks: state.tracks, sourceFiles: state.sourceFiles,
                loadTrack: (track, file) => engine.loadTrack(track, file),
                disposeTrack: (track) => engine.detachTrack(track, false)
            });
            prepared.commit();
            state.files = files;
            state.tracks = prepared.tracks;
            state.selectedTrackIds = new Set(snapshot.selectedTrackIds || []);
            state.selectedTrackId = snapshot.selectedTrackId || [...state.selectedTrackIds][0] || null;
            state.selectedFileId = snapshot.selectedFileId || null;
            renderFiles();
            refreshAll(); // setTracks disposes discarded media objects.
            await engine.seek(Number(snapshot.currentTime) || 0, { resume: false });
        } finally {
            state.historyRestoring = false;
            updateHistoryButtons();
        }
    }

    async function runHistoryStep(from, to, pastTense) {
        if (state.historyRestoring || !from.length) return;
        const entry = from[from.length - 1];
        const previous = captureHistorySnapshot();
        try {
            await restoreHistorySnapshot(entry.snapshot);
            from.pop();
            to.push({ label: entry.label, snapshot: previous });
            if (to.length > state.history.limit) to.shift();
            pruneSourceRegistry();
            showToast(`${pastTense} ${entry.label}`);
        } catch (error) {
            console.error('MotoriClip history restore failed:', error);
            elements.previewState.textContent = `History restore failed: ${error.message}`;
            showToast('Undo/redo unavailable for this media');
        } finally {
            updateHistoryButtons();
        }
    }
    async function undoTimelineEdit() { await runHistoryStep(state.history.undo, state.history.redo, 'Undid'); }
    async function redoTimelineEdit() { await runHistoryStep(state.history.redo, state.history.undo, 'Redid'); }

    function registerInspectorHistory(control, label) {
        if (!control) return;
        control.addEventListener('pointerdown', () => recordHistory(label));
        control.addEventListener('keydown', (event) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' '].includes(event.key)) recordHistory(label);
        });
    }

    function makeProjectFileDragGhost(entry) {
        const ghost = document.createElement('div');
        ghost.className = `project-file-drag-ghost kind-${entry.kind}`;
        ghost.innerHTML = `<span>${kindLabel(entry.kind)}</span><strong>${escapeHtml(entry.name)}</strong>`;
        document.body.appendChild(ghost);
        return ghost;
    }

    function renderFiles() {
        elements.fileList.innerHTML = '';
        elements.fileCount.textContent = `${state.files.length} media`;
        if (!state.files.length) {
            elements.fileList.innerHTML = '<div class="empty-file-list">No project files yet.<br>Import or drop media here first.</div>';
            return;
        }
        for (const entry of state.files) {
            const row = document.createElement('div');
            row.className = `file-row kind-${entry.kind}${entry.id === state.selectedFileId ? ' active' : ''}`;
            // Native HTML drag was unreliable after the v0.17 lane update in some Chromium builds.
            // The pointer drag below deliberately owns Project File placement instead.
            row.draggable = false;
            row.tabIndex = 0;
            row.dataset.fileId = entry.id;
            row.title = 'Drag this file to the timeline.';
            row.innerHTML = `<span class="file-kind">${kindLabel(entry.kind)}</span><span><span class="file-name">${escapeHtml(entry.name)}</span><span class="file-meta">${kindName(entry.kind)} · ${formatFileSize(entry.file.size)} · drag to timeline</span></span>`;

            let pointerDrag = null;
            let suppressClick = false;

            const clearPointerDrag = () => {
                if (!pointerDrag) return;
                try { row.releasePointerCapture?.(pointerDrag.pointerId); } catch (_) { /* no-op */ }
                pointerDrag.ghost?.remove();
                row.classList.remove('is-dragging');
                timeline.clearProjectFileDropHighlights?.();
                timeline.endProjectFileDrag();
                pointerDrag = null;
            };

            const movePointerDrag = (event) => {
                if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
                const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
                if (!pointerDrag.started && distance < 6) return;
                if (!pointerDrag.started) {
                    pointerDrag.started = true;
                    suppressClick = true;
                    state.selectedFileId = entry.id;
                    timeline.beginProjectFileDrag(entry.id);
                    pointerDrag.ghost = makeProjectFileDragGhost(entry);
                    row.classList.add('is-dragging');
                }
                event.preventDefault();
                pointerDrag.ghost.style.transform = `translate(${Math.round(event.clientX + 14)}px, ${Math.round(event.clientY + 14)}px)`;
                const validTarget = timeline.updateProjectFilePointerDropHover?.(event.clientX, event.clientY);
                pointerDrag.ghost.classList.toggle('can-drop', Boolean(validTarget));
            };

            const finishPointerDrag = (event) => {
                if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
                const wasDragging = pointerDrag.started;
                if (wasDragging) {
                    event.preventDefault();
                    const placed = timeline.dropProjectFileAtPoint?.(entry.id, event.clientX, event.clientY);
                    if (!placed) showToast('Drop Project Files onto the timeline area');
                }
                clearPointerDrag();
                if (wasDragging) setTimeout(() => { suppressClick = false; }, 0);
            };

            row.addEventListener('pointerdown', (event) => {
                if (event.button !== 0) return;
                pointerDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, started: false, ghost: null };
                row.setPointerCapture?.(event.pointerId);
            });
            row.addEventListener('pointermove', movePointerDrag);
            row.addEventListener('pointerup', finishPointerDrag);
            row.addEventListener('pointercancel', clearPointerDrag);
            row.addEventListener('lostpointercapture', () => {
                if (pointerDrag?.started) clearPointerDrag();
            });
            row.addEventListener('click', () => {
                if (suppressClick) return;
                state.selectedFileId = entry.id;
                renderFiles();
            });
            row.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    state.selectedFileId = entry.id;
                    renderFiles();
                }
            });
            elements.fileList.appendChild(row);
        }
    }

    async function addFiles(files) {
        const usable = [];
        for (const file of Array.from(files || [])) {
            const kind = getKind(file);
            if (!kind || !FILE_PATTERN.test(file.name)) continue;
            const duplicate = state.files.some((entry) => entry.file.name === file.name && entry.file.size === file.size && entry.file.lastModified === file.lastModified);
            if (!duplicate) usable.push({ id: `file-${Date.now()}-${++state.serial}`, file, name: file.name, kind });
        }
        if (!usable.length) { elements.previewState.textContent = 'No supported media files found.'; return; }
        recordHistory(`Import ${usable.length} project file${usable.length === 1 ? '' : 's'}`);
        for (const entry of usable) state.sourceFiles.set(entry.id, entry.file);
        state.files.push(...usable);
        renderFiles();
        elements.previewState.textContent = `Added ${usable.length} file${usable.length === 1 ? '' : 's'} to Project Files`;
    }

    function updateTimeDisplay({ currentTime, duration }) {
        const safeDuration = Math.max(0, Number(duration) || 0);
        const safeCurrent = clamp(Number(currentTime) || 0, 0, safeDuration || Infinity);
        elements.timeReadout.textContent = `${formatTime(safeCurrent)} / ${formatTime(safeDuration)}`;
        if (!state.isSeeking) { elements.previewSeek.max = String(safeDuration); elements.previewSeek.value = String(Math.min(safeCurrent, safeDuration)); }
        elements.previewSeek.disabled = safeDuration <= 0;
        timeline.setCurrentTime(safeCurrent);
        elements.previewEmpty.hidden = state.tracks.some((track) => track.type === 'video' && track.sourceName);
    }
    function setPlayButton(isPlaying) { elements.btnPlay.textContent = isPlaying ? '⏸️' : '▶️'; elements.btnPlay.title = isPlaying ? 'Pause preview' : 'Play preview'; }
    function syncPreviewMuteButton() { const muted = engine.previewMuted || engine.previewVolume <= 0; elements.btnPreviewMute.textContent = muted ? '🔇' : '🔊'; }
    function setSwitch(button, on) { button.classList.toggle('on', Boolean(on)); button.setAttribute('aria-pressed', String(Boolean(on))); }

    function selectTrack(trackId, { toggle = false } = {}) {
        if (!trackId) return;
        if (toggle) {
            if (state.selectedTrackIds.has(trackId)) state.selectedTrackIds.delete(trackId);
            else state.selectedTrackIds.add(trackId);
        } else {
            state.selectedTrackIds = new Set([trackId]);
        }
        state.selectedTrackId = state.selectedTrackIds.has(trackId) ? trackId : [...state.selectedTrackIds][0] || null;
        timeline.setSelectedTrackIds(state.selectedTrackIds);
        syncSelectionTools();
        syncInspector();
    }

    function syncSelectionTools() {
        const count = state.selectedTrackIds.size;
        elements.btnSelectionMode.classList.toggle('active', state.selectionMode);
        elements.btnSelectionMode.setAttribute('aria-pressed', String(state.selectionMode));
        elements.btnGroupSelection.disabled = count < 2;
        elements.btnGroupSelection.title = count < 2 ? 'Select two or more clips first' : `Group ${count} selected clips`;
        elements.btnDuplicateSelection.disabled = count < 1;
        elements.btnDuplicateSelection.title = count < 1 ? 'Select one or more clips first' : `Duplicate ${count} selected clip${count === 1 ? '' : 's'}`;
        elements.btnDeleteSelection.disabled = count < 1;
        elements.btnDeleteSelection.title = count < 1 ? 'Select one or more clips first' : `Delete ${count} selected clip${count === 1 ? '' : 's'}`;
    }

    function getPairSelection() {
        if (state.selectedTrackIds.size !== 2) return [];
        const selected = state.tracks.filter((track) => state.selectedTrackIds.has(track.id));
        return selected.length === 2 && selected.every((track) => track.type === 'video' && track.sourceName && track.file)
            ? selected.sort((a,b) => (Number(a.start)||0)-(Number(b.start)||0) || state.tracks.indexOf(a)-state.tracks.indexOf(b))
            : [];
    }
    function updatePairInspector() {
        const selected = getPairSelection();
        elements.pairTransitionPanel.hidden = selected.length !== 2;
        if(selected.length !== 2)return;
        const [a,b] = selected;
        elements.pairTransitionDescription.textContent = `Video A: ${a.sourceName} → Video B: ${b.sourceName}`;
        const max=Math.min(30,Number(a.clipDuration)||0,Number(b.clipDuration)||0);
        elements.pairTransitionDuration.max=String(Math.max(.1,max));
        const original=Number(elements.pairTransitionDuration.value)||1;
        elements.pairTransitionDuration.value=String(Math.min(Math.max(.1,original),Math.max(.1,max)));
        elements.btnApplyPairTransition.disabled=max<.1;
    }
    function syncInspector() {
        const track = getTrack();
        const multiple = state.selectedTrackIds.size > 1;
        elements.inspectorKind.textContent = multiple ? `${state.selectedTrackIds.size} selected` : (track ? track.laneLabel || track.label : 'Project');
        elements.inspectorProject.hidden = Boolean(track) && !multiple;
        elements.inspectorVideo.hidden = multiple || track?.type !== 'video';
        elements.inspectorBackground.hidden = multiple || track?.type !== 'background';
        elements.inspectorAudio.hidden = multiple || track?.type !== 'audio';
        elements.inspectorSticker.hidden = multiple || track?.type !== 'sticker';
        updatePairInspector();
        if (!track || multiple) return;
        if (track.type === 'video') {
            const opacity = Math.round((track.opacity ?? 1) * 100);
            elements.selectedVideoName.textContent = track.sourceName || track.laneLabel;
            setSwitch(elements.videoVisibleSwitch, track.visible !== false);
            setSwitch(elements.videoAudioSwitch, !track.audio.muted);
            elements.videoAudioVolume.value = String(Math.round(track.audio.volume * 100));
            elements.videoAudioVolumeValue.textContent = `${Math.round(track.audio.volume * 100)}%`;
            elements.videoOpacity.value = String(opacity); elements.videoOpacityValue.textContent = `${opacity}%`;
            elements.videoBlendMode.value = track.blendMode || 'source-over'; elements.btnExtractAudio.disabled = !track.file;
            const transitions=normalizeVisualTransitions(track.visualTransitions);
            const maxFade=Math.min(30,Math.max(0,Number(track.clipDuration)||0));
            for(const [edge,slider,label,curve] of [
                ['enter',elements.videoTransitionEnter,elements.videoTransitionEnterValue,elements.videoTransitionEnterCurve],
                ['exit',elements.videoTransitionExit,elements.videoTransitionExitValue,elements.videoTransitionExitCurve]
            ]){
                slider.max=String(maxFade);
                slider.value=String(Math.min(maxFade,fadeDuration(track,edge)));
                label.textContent=formatSeconds(fadeDuration(track,edge));
                curve.value=transitions[edge].curve;
            }
            elements.videoTransitionSummary.textContent=`Entrance ${formatSeconds(fadeDuration(track,'enter'))} · Exit ${formatSeconds(fadeDuration(track,'exit'))}`;
            const from = state.tracks.find((other)=>other.id===track.transitionFromId);
            const paired=Boolean(from&&isPairedFadeActive(track,state.tracks));
            elements.videoTransitionPairNote.hidden=!paired;
            elements.btnUnpairTransition.hidden=!paired;
            if(paired){
                const effect=TRANSITION_CATALOG.find(item=>item.id===track.transitionEffectId);
                elements.videoTransitionPairNote.textContent=`✦ Paired ${effect?.label||'transition'} from ${from.sourceName} · ${formatSeconds(fadeDuration(track,'enter'))} overlap`;
            }
        }
        if (track.type === 'background') {
            const opacity = Math.round((track.opacity ?? 1) * 100);
            elements.selectedBackgroundName.textContent = track.sourceName || track.laneLabel;
            setSwitch(elements.backgroundVisibleSwitch, track.visible !== false);
            elements.backgroundOpacity.value = String(opacity); elements.backgroundOpacityValue.textContent = `${opacity}%`;
            elements.backgroundBlendMode.value = track.blendMode || 'source-over';
        }
        if (track.type === 'audio') {
            const duration = Math.max(.1, Number(track.clipDuration) || 0);
            const fadeIn = clamp(Number(track.audio.fadeIn) || 0, 0, duration);
            const fadeOut = clamp(Number(track.audio.fadeOut) || 0, 0, duration);
            elements.selectedAudioName.textContent = track.sourceName || track.laneLabel;
            setSwitch(elements.audioAuditionSwitch, !track.audio.muted);
            elements.audioTrackVolume.value = String(Math.round(track.audio.volume * 100)); elements.audioTrackVolumeValue.textContent = `${Math.round(track.audio.volume * 100)}%`;
            elements.audioFadeIn.max = String(duration); elements.audioFadeIn.value = String(fadeIn); elements.audioFadeInValue.textContent = formatSeconds(fadeIn);
            elements.audioFadeOut.max = String(duration); elements.audioFadeOut.value = String(fadeOut); elements.audioFadeOutValue.textContent = formatSeconds(fadeOut);
        }
        if (track.type === 'sticker') {
            const settings = track.transparency;
            const opacity = Math.round((track.opacity ?? 1) * 100);
            elements.selectedStickerName.textContent = track.sourceName || track.laneLabel;
            setSwitch(elements.stickerVisibleSwitch, track.visible !== false);
            elements.stickerOpacity.value = String(opacity); elements.stickerOpacityValue.textContent = `${opacity}%`;
            elements.stickerBlendMode.value = track.blendMode || 'source-over';
            elements.stickerTransparencyMode.value = settings.mode || 'native';
            elements.stickerKeyColour.value = settings.keyColour || '#00ff00'; elements.stickerKeyColourText.value = settings.keyColour || '#00ff00';
            elements.stickerKeyTolerance.value = String(settings.tolerance ?? 30); elements.stickerKeyToleranceValue.textContent = `${settings.tolerance ?? 30}%`;
            elements.stickerEdgeFeather.value = String(settings.feather ?? 8); elements.stickerEdgeFeatherValue.textContent = `${settings.feather ?? 8}%`;
        }
    }

    function refreshAll() {
        // Moving/trimming or deleting a paired clip must never leave an orphan
        // "linked" label. Independent visual fade settings remain intact.
        for(const track of state.tracks){
            if(track.transitionFromId&&!isPairedFadeActive(track,state.tracks)){
                track.transitionFromId=null;
                track.transitionEffectId=null;
            }
        }
        state.selectedTrackIds = new Set([...state.selectedTrackIds].filter((id) => state.tracks.some((track) => track.id === id)));
        if (!state.selectedTrackIds.has(state.selectedTrackId)) state.selectedTrackId = [...state.selectedTrackIds][0] || null;
        engine.setTracks(state.tracks);
        timeline.setTracks(state.tracks);
        timeline.setSelectedTrackIds(state.selectedTrackIds);
        syncSelectionTools();
        syncInspector();
    }

    async function loadTrackFromFile(track, entry, start = 0, { removeOnFailure = false } = {}) {
        track.start = Math.max(0, Number(start) || 0);
        track.sourceFileId = entry.id || track.sourceFileId || state.files.find((item) => item.file === entry.file)?.id;
        if (track.sourceFileId && entry.file) state.sourceFiles.set(track.sourceFileId, entry.file);
        try {
            await engine.loadTrack(track, entry.file);
            if (!state.tracks.includes(track)) {
                engine.detachTrack(track, false);
                return;
            }
            if (!track.clipDuration) track.clipDuration = (track.type === 'sticker' || track.type === 'background') ? 3 : track.sourceDuration || 1;
            refreshAll(); selectTrack(track.id);
            elements.previewState.textContent = `Loaded ${entry.name}`;
            if (track.type === 'audio' || track.type === 'video') {
                engine.analyzeTrackAudio(track, entry.file).then((result) => {
                    if (!result || !state.tracks.includes(track) || track.file !== entry.file) return;
                    timeline.setTracks(state.tracks);
                    elements.previewState.textContent = `Analysed ${entry.name}`;
                });
            }
            return true;
        } catch (error) {
            if (removeOnFailure && state.tracks.includes(track)) {
                state.tracks = state.tracks.filter((item) => item !== track);
                state.selectedTrackIds.delete(track.id);
                refreshAll();
            }
            if (!state.tracks.includes(track) && /cancelled/i.test(error.message)) return false;
            elements.previewState.textContent = `Could not load ${entry.name}: ${error.message}`;
            showToast(`Could not import ${entry.name}`);
            alert(`Could not load ${entry.name}. ${error.message}`);
            return false;
        }
    }

    function clipsOverlap(first, second, epsilon = 0.001) {
        const firstStart = Number(first.start) || 0;
        const firstEnd = firstStart + Math.max(0, Number(first.clipDuration) || 0);
        const secondStart = Number(second.start) || 0;
        const secondEnd = secondStart + Math.max(0, Number(second.clipDuration) || 0);
        return firstStart < secondEnd - epsilon && firstEnd > secondStart + epsilon;
    }

    function getVideoLaneModels() {
        const lanes = new Map();
        for (const track of state.tracks.filter((item) => item.type === 'video')) {
            const laneId = track.laneId || track.id;
            if (!lanes.has(laneId)) lanes.set(laneId, { laneId, laneLabel: track.laneLabel, order: Number(track.order) || 0 });
        }
        return [...lanes.values()].sort((a, b) => a.order - b.order);
    }

    function setTrackToNewVideoLane(track) {
        const order = nextLaneOrder('video');
        track.laneId = `video-lane-${Date.now()}-${++state.serial}`;
        track.laneLabel = laneName('video', order);
        track.label = laneName('video', order);
        track.order = order;
        return track;
    }

    function resolveVideoOverlap(track) {
        if (!track || track.type !== 'video' || !track.sourceName) return false;
        const conflicts = state.tracks.filter((candidate) => candidate.type === 'video' && candidate.id !== track.id && candidate.laneId === track.laneId && candidate.sourceName && clipsOverlap(track, candidate));
        if (!conflicts.length) return false;
        const freeLane = getVideoLaneModels().find((lane) => !state.tracks.some((candidate) => candidate.type === 'video' && candidate.id !== track.id && candidate.laneId === lane.laneId && candidate.sourceName && clipsOverlap(track, candidate)));
        if (freeLane) {
            track.laneId = freeLane.laneId;
            track.laneLabel = freeLane.laneLabel;
            track.label = freeLane.laneLabel;
            track.order = freeLane.order;
        } else {
            setTrackToNewVideoLane(track);
        }
        return true;
    }

    async function placeProjectFile({ fileId, laneId, laneType, start }) {
        const entry = getFile(fileId);
        if (!entry) return;
        recordHistory(`Place ${entry.name}`);
        const laneTracks = laneId ? state.tracks.filter((track) => track.laneId === laneId) : [];
        let track = null;
        let created = false;
        if (entry.kind !== 'video') {
            track = laneTracks.find((candidate) => !candidate.sourceName && candidate.type === entry.kind) || null;
            if (!track && laneTracks.length && laneType === entry.kind) {
                const lane = laneTracks[0];
                track = createTrack(entry.kind, { laneId: lane.laneId, laneLabel: lane.laneLabel, order: lane.order });
                state.tracks.push(track);
                created = true;
            }
        }
        if (!track) { track = createTrack(entry.kind); state.tracks.push(track); created = true; }
        await loadTrackFromFile(track, entry, start, { removeOnFailure: created });
    }

    function onTimelineTrackChanged(track, detail = {}) {
        if (detail.live) {
            if (state.liveRenderRequest !== null) return;
            state.liveRenderRequest = requestAnimationFrame(() => { state.liveRenderRequest = null; engine.renderFrame(); });
            return;
        }
        if (state.liveRenderRequest !== null) { cancelAnimationFrame(state.liveRenderRequest); state.liveRenderRequest = null; }
        const relocated = resolveVideoOverlap(track);
        // Drag/trim edits that break a paired overlap must not leave stale link
        // metadata or keep a spatial effect active at the wrong timestamps.
        for(const clip of state.tracks){
            if(clip.transitionFromId&&!isPairedFadeActive(clip,state.tracks)){
                clip.transitionFromId=null;
                clip.transitionEffectId=null;
            }
        }
        engine.setTracks(state.tracks);
        timeline.setTracks(state.tracks);
        timeline.setDuration(engine.getTimelineDuration());
        syncInspector();
        if (relocated) showToast(`${track.sourceName || 'Video'} moved to ${track.laneLabel} so video clips do not overlap`);
    }

    function applySelectedVideoPair() {
        let plan;
        const effectId=elements.pairTransitionEffect.value;
        const effect=TRANSITION_CATALOG.find(item=>item.id===effectId);
        try{
            if(effect?.status!=='available')throw Error('This effect is selected for later development, not implemented yet.');
            plan=planPairedTransition(state.tracks,[...state.selectedTrackIds],elements.pairTransitionDuration.value,effectId);
        }catch(error){showToast(error.message);return;}
        const a=getTrack(plan.fromId),b=getTrack(plan.toId);
        recordHistory(`Pair ${a.sourceName} → ${b.sourceName} (${plan.duration.toFixed(2)}s ${effect.label})`);
        a.visualTransitions=plan.outgoingTransitions;
        b.visualTransitions=plan.incomingTransitions;
        b.start=plan.start;
        if(plan.needsNewLane){
            b.laneId=`video-transition-${Date.now()}-${++state.serial}`;
            b.laneLabel=`Video ${nextLaneOrder('video')} · Transition`;
            b.label=b.laneLabel;
            b.order=plan.incomingOrder;
        }
        b.transitionFromId=plan.fromId;
        b.transitionEffectId=plan.effectId;
        refreshAll();
        selectTrack(b.id);
        void engine.seek(plan.start+plan.duration/2,{resume:false}).catch((error)=>{
            elements.previewState.textContent=`Transition preview unavailable: ${error.message}`;
        });
        showToast(`Paired ${effect.label} ${plan.duration.toFixed(2)}s: ${a.sourceName} → ${b.sourceName}`);
    }

    function unlinkSelectedVideoPair(){
        const track=getTrack();
        if(!track||!isPairedFadeActive(track,state.tracks))return;
        recordHistory(`Unlink transition to ${track.sourceName}`);
        track.transitionFromId=null;
        track.transitionEffectId=null;
        syncInspector();
        showToast('Transition unlinked; clip timing and visual fade retained');
    }

    function renderTransitionCatalog(){
        elements.pairTransitionEffect.replaceChildren();
        elements.transitionLibraryGrid.replaceChildren();
        for(const effect of TRANSITION_CATALOG){
            const option=document.createElement('option');
            option.value=effect.id;
            option.textContent=effect.status==='available'?effect.label:`${effect.label} (selected, coming later)`;
            option.disabled=effect.status!=='available';
            elements.pairTransitionEffect.appendChild(option);
            const item=document.createElement('div');
            item.className='transition-library-item'+(effect.status==='available'?' ready':'');
            const name=document.createElement('strong');
            name.textContent=effect.label;
            const status=document.createElement('span');
            status.textContent=effect.status==='available'?'Ready':'Selected';
            item.append(name,status);
            elements.transitionLibraryGrid.appendChild(item);
        }
        elements.pairTransitionEffect.value='fade';
        const available=TRANSITION_CATALOG.filter(item=>item.status==='available');
        const queued=TRANSITION_CATALOG.length-available.length;
        elements.transitionLibraryStatus.textContent=
            `Available now (${available.length}): ${available.map(item=>item.label).join(', ')}. ${queued} more selected for later development.`;
    }

    async function extractAudioFromSelectedVideo() {
        const video = getTrack();
        if (!video || video.type !== 'video' || !video.file) return;
        const audio = createTrack('audio', { extractedFrom: video.id, sourceFileId: video.sourceFileId, start: video.start, sourceOffset: video.sourceOffset, clipDuration: video.clipDuration, label: `Extracted Audio ${nextLaneOrder('audio')}` });
        try {
            await engine.loadTrack(audio, video.file);
            if (!state.tracks.includes(video)) { engine.detachTrack(audio, false); return; }
        } catch (error) {
            engine.detachTrack(audio, false);
            elements.previewState.textContent = `Could not extract audio: ${error.message}`;
            return;
        }
        recordHistory(`Extract audio from ${video.sourceName || video.laneLabel}`);
        audio.clipDuration = Math.min(video.clipDuration, Math.max(.15, (audio.sourceDuration || video.clipDuration) - audio.sourceOffset));
        state.tracks.push(audio);
        video.audio.muted = true;
        refreshAll(); selectTrack(audio.id);
    }

    function canSplitTrack(track, time = engine.currentTime) {
        const start = Number(track?.start) || 0;
        const end = start + (Number(track?.clipDuration) || 0);
        return Boolean(track?.file && time > start + .04 && time < end - .04);
    }

    async function splitTrackAtNow(trackId, { record = true } = {}) {
        const track = getTrack(trackId);
        if (!canSplitTrack(track)) { showToast('Move the now line inside a clip before splitting'); return false; }
        const cutTime = engine.currentTime;
        const leftDuration = cutTime - track.start;
        const rightDuration = track.clipDuration - leftDuration;
        const transitionParts=splitVisualTransitions(track.visualTransitions);
        const split = createTrack(track.type, {
            laneId: track.laneId,
            laneLabel: track.laneLabel,
            order: track.order,
            label: track.label,
            start: cutTime,
            sourceOffset: (Number(track.sourceOffset) || 0) + leftDuration,
            clipDuration: rightDuration,
            visible: track.visible,
            opacity: track.opacity,
            blendMode: track.blendMode,
            audio: { ...track.audio },
            visualTransitions: transitionParts.right,
            transparency: { ...track.transparency },
            groupId: track.groupId,
            extractedFrom: track.extractedFrom,
            analysis: track.analysis,
            sourceFileId: track.sourceFileId
        });
        try {
            await engine.loadTrack(split, track.file);
            if (!state.tracks.includes(track)) { engine.detachTrack(split, false); return false; }
        } catch (error) {
            engine.detachTrack(split, false);
            elements.previewState.textContent = `Could not split clip: ${error.message}`;
            showToast('Split failed; original clip has not changed');
            return false;
        }
        if (record) recordHistory(`Split ${track.sourceName || track.laneLabel}`);
        track.clipDuration = leftDuration;
        if(track.type==='video')track.visualTransitions=transitionParts.left;
        split.clipDuration = rightDuration;
        state.tracks.push(split);
        refreshAll(); selectTrack(split.id);
        showToast('Clip split at now line');
        return true;
    }

    async function splitAllAtNow() {
        const targetIds = state.tracks.filter((track) => canSplitTrack(track)).map((track) => track.id);
        if (!targetIds.length) { showToast('No clips cross the now line'); return; }
        recordHistory(`Split all at ${formatTime(engine.currentTime)}`);
        let completed = 0;
        for (const id of targetIds) if (await splitTrackAtNow(id, { record: false })) completed += 1;
        showToast(`Split ${completed} of ${targetIds.length} clip${targetIds.length === 1 ? '' : 's'} at ${formatTime(engine.currentTime)}`);
    }

    async function deleteSelectedTracks() {
        const selected = state.tracks.filter((track) => state.selectedTrackIds.has(track.id));
        if (!selected.length) { showToast('Select one or more clips to delete'); return; }
        recordHistory(`Delete ${selected.length} clip${selected.length === 1 ? '' : 's'}`);
        state.tracks = state.tracks.filter((track) => !state.selectedTrackIds.has(track.id));
        state.selectedTrackIds.clear();
        state.selectedTrackId = null;
        refreshAll();
        showToast(`Deleted ${selected.length} clip${selected.length === 1 ? '' : 's'}`);
    }

    async function duplicateSelectedTracks() {
        const selected = state.tracks.filter((track) => state.selectedTrackIds.has(track.id));
        if (!selected.length) { showToast('Select one or more clips to duplicate'); return; }
        const duplicates = [];
        try {
        for (const original of selected) {
            if (!original.file) continue;
            const isVideo = original.type === 'video';
            const originalDuration = Math.max(.15, Number(original.clipDuration) || 0);
            const clone = createTrack(original.type, {
                // Videos cannot overlap in a lane, so a duplicate gets a fresh video lane.
                laneId: isVideo ? undefined : original.laneId,
                laneLabel: isVideo ? undefined : original.laneLabel,
                order: isVideo ? undefined : original.order,
                start: Math.max(0, (Number(original.start) || 0) + originalDuration),
                sourceOffset: Number(original.sourceOffset) || 0,
                sourceFileId: original.sourceFileId,
                clipDuration: originalDuration,
                visible: original.visible,
                opacity: original.opacity,
                blendMode: original.blendMode,
                audio: { ...original.audio },
                visualTransitions: normalizeVisualTransitions(original.visualTransitions),
                transparency: { ...original.transparency },
                groupId: null,
                extractedFrom: original.extractedFrom || null,
                analysis: original.analysis ? { ...original.analysis, levels: Array.isArray(original.analysis.levels) ? [...original.analysis.levels] : original.analysis.levels } : null
            });
            await engine.loadTrack(clone, original.file);
            clone.sourceName = original.sourceName;
            clone.start = Math.max(0, (Number(original.start) || 0) + originalDuration);
            clone.sourceOffset = Number(original.sourceOffset) || 0;
            clone.clipDuration = originalDuration;
            clone.visible = original.visible;
            clone.opacity = original.opacity;
            clone.blendMode = original.blendMode;
            clone.audio = { ...original.audio };
            clone.visualTransitions = normalizeVisualTransitions(original.visualTransitions);
            clone.transparency = { ...original.transparency };
            clone.analysis = original.analysis ? { ...original.analysis, levels: Array.isArray(original.analysis.levels) ? [...original.analysis.levels] : original.analysis.levels } : null;
            duplicates.push(clone);
        }
        } catch (error) {
            for (const clone of duplicates) engine.detachTrack(clone, false);
            elements.previewState.textContent = `Could not duplicate clips: ${error.message}`;
            showToast('Duplicate failed; no new clips were added');
            return;
        }
        if (!duplicates.length) { showToast('The selected clips do not have source files to duplicate'); return; }
        recordHistory(`Duplicate ${selected.length} clip${selected.length === 1 ? '' : 's'}`);
        state.tracks.push(...duplicates);
        state.selectedTrackIds = new Set(duplicates.map((track) => track.id));
        state.selectedTrackId = duplicates[0].id;
        refreshAll();
        showToast(`Duplicated ${duplicates.length} clip${duplicates.length === 1 ? '' : 's'}`);
    }

    function groupSelectedTracks() {
        const selected = state.tracks.filter((track) => state.selectedTrackIds.has(track.id));
        if (selected.length < 2) { showToast('Select two or more clips before grouping'); return; }
        recordHistory(`Group ${selected.length} clips`);
        const groupId = `group-${Date.now()}-${++state.serial}`;
        selected.forEach((track) => { track.groupId = groupId; });
        timeline.setTracks(state.tracks);
        timeline.setSelectedTrackIds(state.selectedTrackIds);
        showToast(`${selected.length} clips grouped — dragging one moves the group`);
    }

    function openContextMenu(trackId, x, y) {
        selectTrack(trackId);
        state.contextTrackId = trackId;
        const track = getTrack(trackId);
        if (!track) return;
        elements.contextMenuTitle.textContent = track.sourceName || track.laneLabel;
        elements.contextAddLayer.textContent = `➕ Add ${track.type === 'sticker' ? 'Sticker' : track.type === 'video' ? 'Video' : track.type === 'background' ? 'Background' : 'Audio'} layer`;
        elements.contextExtractAudio.hidden = track.type !== 'video' || !track.file;
        elements.contextSplitNow.disabled = !canSplitTrack(track);
        elements.contextMenu.hidden = false;
        const maxX = window.innerWidth - elements.contextMenu.offsetWidth - 8;
        const maxY = window.innerHeight - elements.contextMenu.offsetHeight - 8;
        elements.contextMenu.style.left = `${clamp(x, 8, maxX)}px`; elements.contextMenu.style.top = `${clamp(y, 8, maxY)}px`;
    }
    function hideContextMenu() { elements.contextMenu.hidden = true; state.contextTrackId = null; }
    function addLayerFromContext() {
        const track = getTrack(state.contextTrackId); if (!track) return;
        recordHistory(`Add ${track.type} layer`);
        const newTrack = createTrack(track.type); state.tracks.push(newTrack); refreshAll(); selectTrack(newTrack.id); hideContextMenu();
    }
    function removeLayerFromContext() {
        const track = getTrack(state.contextTrackId); if (!track) return;
        recordHistory(`Remove ${track.sourceName || track.laneLabel}`);
        state.tracks = state.tracks.filter((item) => item.id !== track.id);
        state.selectedTrackIds.delete(track.id); state.selectedTrackId = [...state.selectedTrackIds][0] || null;
        refreshAll(); hideContextMenu();
    }

    function syncPreviewZoom() {
        const percent = clamp(Number(state.previewZoom) || 100, 50, 200);
        state.previewZoom = percent;
        elements.previewZoom.value = String(percent);
        elements.previewZoomValue.textContent = `${percent}%`;
        elements.previewStage.style.setProperty('--preview-zoom', String(percent / 100));
    }

    function installPreviewResize() {
        let active = null;
        const move = (event) => {
            if (!active || active.pointerId !== event.pointerId) return;
            event.preventDefault();
            const parentWidth = elements.previewStage.parentElement?.clientWidth || window.innerWidth;
            const width = clamp(active.width + (event.clientX - active.x), 300, Math.max(300, parentWidth));
            elements.previewStage.style.width = `${Math.round(width)}px`;
        };
        const stop = (event) => {
            if (!active || (event && active.pointerId !== event.pointerId)) return;
            active = null;
            elements.previewStage.classList.remove('is-resizing');
            document.body.style.cursor = '';
            window.removeEventListener('pointermove', move, true);
            window.removeEventListener('pointerup', stop, true);
            window.removeEventListener('pointercancel', stop, true);
        };
        elements.previewResizeHandle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault(); event.stopPropagation();
            active = { pointerId: event.pointerId, x: event.clientX, width: elements.previewStage.getBoundingClientRect().width };
            elements.previewStage.classList.add('is-resizing');
            document.body.style.cursor = 'nwse-resize';
            try { elements.previewResizeHandle.setPointerCapture(event.pointerId); } catch (_) { /* capture optional */ }
            window.addEventListener('pointermove', move, true);
            window.addEventListener('pointerup', stop, true);
            window.addEventListener('pointercancel', stop, true);
        });
    }

    function getDroppedFiles(event) {
        const transfer = event?.dataTransfer;
        if (!transfer) return [];

        const directFiles = Array.from(transfer.files || []);
        if (directFiles.length) return directFiles;

        return Array.from(transfer.items || [])
            .filter((item) => item.kind === 'file')
            .map((item) => item.getAsFile?.())
            .filter(Boolean);
    }

    function hasExternalFiles(event) {
        const transfer = event?.dataTransfer;
        if (!transfer) return false;
        if (Array.from(transfer.files || []).length) return true;
        if (Array.from(transfer.items || []).some((item) => item.kind === 'file')) return true;
        return Array.from(transfer.types || []).some((type) => type === 'Files' || type === 'application/x-moz-file');
    }

    async function browseDirectory() {
        if (!window.showDirectoryPicker) { elements.fileInput.click(); return; }
        try {
            const handle = await window.showDirectoryPicker({ mode: 'read' }); const files = [];
            for await (const entry of handle.values()) if (entry.kind === 'file' && FILE_PATTERN.test(entry.name)) files.push(await entry.getFile());
            await addFiles(files);
        } catch (error) { if (error.name !== 'AbortError') { console.warn(error); elements.previewState.textContent = 'Folder browse was unavailable. Use Import instead.'; } }
    }
    function installGlobalFileDrop() {
        const localOverlay = elements.dropOverlay;
        const localZone = elements.projectDropZone;
        let dragDepth = 0;
        let importing = false;
        let hideTimer = null;

        const importExternalFiles = async (files, source = 'File Explorer') => {
            const safeFiles = Array.from(files || []).filter(Boolean);
            if (!safeFiles.length || importing) return false;
            importing = true;
            try {
                const before = state.files.length;
                await addFiles(safeFiles);
                const added = state.files.length - before;
                if (added > 0) {
                    showToast(`Imported ${added} file${added === 1 ? '' : 's'} from ${source}`);
                    return true;
                }
                showToast('Those files are already in Project Files or are not supported');
                return false;
            } catch (error) {
                console.error('External file import failed:', error);
                elements.previewState.textContent = 'Could not import the dropped files.';
                showToast('File import failed');
                return false;
            } finally {
                window.setTimeout(() => { importing = false; }, 0);
            }
        };

        const showDrop = () => {
            window.clearTimeout(hideTimer);
            localOverlay?.classList.add('visible');
            localZone?.classList.add('drop-target-active');
        };
        const hideDrop = () => {
            dragDepth = 0;
            window.clearTimeout(hideTimer);
            localOverlay?.classList.remove('visible');
            localZone?.classList.remove('drop-target-active');
        };
        const isFileDrag = (event) => hasExternalFiles(event) || getDroppedFiles(event).length > 0;
        const intercept = (event, source) => {
            const files = getDroppedFiles(event);
            if (!files.length && !hasExternalFiles(event)) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            hideDrop();
            if (files.length) void importExternalFiles(files, source);
        };
        const enter = (event) => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            dragDepth += 1;
            showDrop();
        };
        const over = (event) => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
            showDrop();
        };
        const leave = (event) => {
            if (!isFileDrag(event)) return;
            dragDepth = Math.max(0, dragDepth - 1);
            if (!event.relatedTarget || dragDepth === 0) {
                window.clearTimeout(hideTimer);
                hideTimer = window.setTimeout(hideDrop, 90);
            }
        };

        // Direct-open Advanced Mode and ordinary iframe targets.
        window.addEventListener('dragenter', enter, true);
        window.addEventListener('dragover', over, true);
        window.addEventListener('dragleave', leave, true);
        window.addEventListener('drop', (event) => intercept(event, 'File Explorer'), true);
        document.addEventListener('dragenter', enter, true);
        document.addEventListener('dragover', over, true);
        document.addEventListener('dragleave', leave, true);
        document.addEventListener('drop', (event) => intercept(event, 'File Explorer'), true);
        window.addEventListener('dragend', hideDrop, true);
        window.addEventListener('blur', hideDrop);

        // Organon loads tools inside #basin-frame. Browsers dispatch Explorer drops to
        // the iframe element in the parent document, not reliably to the child document.
        // Bind directly to that iframe element rather than relying on parent-window bubbling.
        try {
            const parentDocument = window.parent && window.parent !== window ? window.parent.document : null;
            const basinFrame = parentDocument?.getElementById('basin-frame');
            if (basinFrame) {
                const parentEnter = (event) => { if (!isFileDrag(event)) return; event.preventDefault(); event.stopImmediatePropagation?.(); showDrop(); };
                const parentOver = (event) => { if (!isFileDrag(event)) return; event.preventDefault(); event.stopImmediatePropagation?.(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; showDrop(); };
                const parentDrop = (event) => intercept(event, 'Organon window');
                basinFrame.addEventListener('dragenter', parentEnter, true);
                basinFrame.addEventListener('dragover', parentOver, true);
                basinFrame.addEventListener('drop', parentDrop, true);
                basinFrame.addEventListener('dragleave', leave, true);
                window.addEventListener('beforeunload', () => {
                    basinFrame.removeEventListener('dragenter', parentEnter, true);
                    basinFrame.removeEventListener('dragover', parentOver, true);
                    basinFrame.removeEventListener('drop', parentDrop, true);
                    basinFrame.removeEventListener('dragleave', leave, true);
                }, { once: true });
            }
        } catch (error) {
            console.debug('Parent iframe file-drop hook unavailable:', error);
        }

        // Optional parent-router protocol: File objects are structured-cloneable.
        window.addEventListener('message', (event) => {
            const data = event.data;
            if (data?.type !== 'organon-advanced-files-drop') return;
            const files = Array.from(data.files || []).filter((file) => file instanceof File);
            if (files.length) void importExternalFiles(files, 'Organon window');
        });

        if (localZone) {
            localZone.addEventListener('click', (event) => {
                if (!event.target.closest('.file-row')) elements.fileInput.click();
            });
            localZone.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault(); elements.fileInput.click();
                }
            });
        }
    }

    function syncTimelineZoom() { const percent = timeline.getZoomPercent(); elements.timelineZoom.value = String(percent); elements.timelineZoomValue.textContent = `${percent}%`; }
    function updateAudioFade(setting, input, label) {
        const track = getTrack(); if (!track || track.type !== 'audio') return;
        track.audio[setting] = clamp(Number(input.value) || 0, 0, Number(track.clipDuration) || 0);
        label.textContent = formatSeconds(track.audio[setting]);
        engine.updateAudioFades(engine.currentTime);
    }

    function openEditorModal(dialog) {
        hideContextMenu();
        elements.trackTypeMenu.hidden = true;
        elements.btnAddTrack.setAttribute('aria-expanded', 'false');
        for (const item of [elements.projectSettingsModal, elements.projectExportModal, elements.transitionModal]) item.hidden = item !== dialog;
        dialog.hidden = false;
        dialog.querySelector('[data-close-modal]')?.focus();
    }
    function closeEditorModals() {
        for (const item of [elements.projectSettingsModal, elements.projectExportModal, elements.transitionModal]) item.hidden = true;
    }
    function refreshTransitionModal() {
        const videos = state.tracks.filter((track) => track.type === 'video' && track.file && track.sourceName)
            .sort((a,b) => (Number(a.start)||0)-(Number(b.start)||0));
        const selected = videos.filter((track) => state.selectedTrackIds.has(track.id));
        const choose = (select, previous, fallback) => {
            select.replaceChildren();
            for (const track of videos) {
                const option = document.createElement('option');
                option.value = track.id;
                option.textContent = `${track.sourceName} · ${formatTime(track.start)} (${track.laneLabel})`;
                select.appendChild(option);
            }
            select.value = videos.some((track) => track.id === previous) ? previous : fallback || videos[0]?.id || '';
        };
        choose(elements.transitionModalFrom, elements.transitionModalFrom.value, selected[0]?.id || videos[0]?.id);
        choose(elements.transitionModalTo, elements.transitionModalTo.value, selected[1]?.id || videos[1]?.id);
        elements.transitionModalEffect.replaceChildren();
        for (const effect of TRANSITION_CATALOG.filter((item) => item.status === 'available')) {
            const option = document.createElement('option');
            option.value = effect.id;
            option.textContent = effect.label;
            elements.transitionModalEffect.appendChild(option);
        }
        elements.transitionModalEffect.value = elements.pairTransitionEffect.value || 'fade';
        const canPair = videos.length >= 2;
        elements.btnApplyTransitionModal.disabled = !canPair;
        elements.transitionModalStatus.textContent = canPair
            ? `${videos.length} video clips available · ${elements.transitionModalEffect.options.length} effects`
            : 'Import and place at least two video clips on the timeline to use a transition.';
    }
    function applyTransitionFromModal() {
        const a = elements.transitionModalFrom.value, b = elements.transitionModalTo.value;
        if (!a || !b || a === b) {
            elements.transitionModalStatus.textContent = 'Choose two different video clips.';
            return;
        }
        const first = getTrack(a), second = getTrack(b);
        if (!first || !second || first.type !== 'video' || second.type !== 'video') return;
        state.selectedTrackIds = new Set([a,b]);
        state.selectedTrackId = a;
        timeline.setSelectedTrackIds(state.selectedTrackIds);
        elements.pairTransitionEffect.value = elements.transitionModalEffect.value;
        elements.pairTransitionDuration.value = elements.transitionModalDuration.value;
        syncSelectionTools();
        syncInspector();
        const requested = Number(elements.transitionModalDuration.value);
        const max = Math.min(30, first.clipDuration || 0, second.clipDuration || 0);
        if (!Number.isFinite(requested) || requested < .1 || requested > max) {
            elements.transitionModalStatus.textContent = `Choose an overlap from 0.1 to ${max.toFixed(2)} seconds.`;
            return;
        }
        applySelectedVideoPair();
        closeEditorModals();
    }
    elements.btnToggleHeader.addEventListener('click', () => {
        const collapsed = elements.editorHeader.classList.toggle('is-collapsed');
        elements.btnToggleHeader.setAttribute('aria-expanded', String(!collapsed));
        elements.btnToggleHeader.textContent = collapsed ? '▾' : '▴';
        elements.btnToggleHeader.title = collapsed ? 'Show editor header' : 'Hide editor header';
    });
    elements.btnProjectSettings.addEventListener('click', () => openEditorModal(elements.projectSettingsModal));
    elements.btnProjectExport.addEventListener('click', () => openEditorModal(elements.projectExportModal));
    elements.btnOpenTransitions.addEventListener('click', () => { refreshTransitionModal(); openEditorModal(elements.transitionModal); });
    elements.btnApplyTransitionModal.addEventListener('click', applyTransitionFromModal);
    elements.btnAddTrack.addEventListener('click', () => {
        elements.trackTypeMenu.hidden = !elements.trackTypeMenu.hidden;
        elements.btnAddTrack.setAttribute('aria-expanded', String(!elements.trackTypeMenu.hidden));
    });
    elements.trackTypeMenu.querySelectorAll('[data-add-track-type]').forEach((button) => button.addEventListener('click', () => {
        const type = button.dataset.addTrackType;
        if (!['video','audio','sticker','background'].includes(type)) return;
        recordHistory(`Add ${type} track`);
        const track = createTrack(type);
        state.tracks.push(track);
        refreshAll();
        selectTrack(track.id);
        elements.trackTypeMenu.hidden = true;
        elements.btnAddTrack.setAttribute('aria-expanded','false');
        showToast(`Added ${track.laneLabel} — drag media here`);
    }));
    document.addEventListener('click', (event) => {
        if (!elements.trackTypeMenu.contains(event.target) && event.target !== elements.btnAddTrack) {
            elements.trackTypeMenu.hidden = true;
            elements.btnAddTrack.setAttribute('aria-expanded','false');
        }
    });
    elements.btnToggleRuler.addEventListener('click', () => {
        elements.timelineRuler.hidden = !elements.timelineRuler.hidden;
        elements.btnToggleRuler.setAttribute('aria-pressed', String(!elements.timelineRuler.hidden));
    });
    for (const modal of [elements.projectSettingsModal, elements.projectExportModal, elements.transitionModal]) {
        modal.querySelector('[data-close-modal]').addEventListener('click', closeEditorModals);
        modal.addEventListener('pointerdown', (event) => { if (event.target === modal) closeEditorModals(); });
    }

    elements.projectFps.addEventListener('change', () => { const fps = engine.setProjectFrameRate(elements.projectFps.value); showToast(`Project frame rate: ${fps} fps`); });
    elements.btnApplyCanvas.addEventListener('click', () => applyCanvasResolution({ announce: true }));
    for (const input of [elements.canvasWidth, elements.canvasHeight]) {
        input.addEventListener('change', () => applyCanvasResolution({ announce: true }));
        input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); applyCanvasResolution({ announce: true }); } });
    }
    elements.btnUndo.addEventListener('click', () => { undoTimelineEdit(); });
    elements.btnRedo.addEventListener('click', () => { redoTimelineEdit(); });
    elements.timelineZoom.addEventListener('input', () => { timeline.setZoom(Number(elements.timelineZoom.value) / 100); syncTimelineZoom(); });
    elements.btnResetTimelineZoom.addEventListener('click', () => { timeline.resetZoom(); syncTimelineZoom(); showToast('Timeline zoom reset'); });
    elements.btnSplitAll.addEventListener('click', splitAllAtNow);
    elements.btnSelectionMode.addEventListener('click', () => { state.selectionMode = !state.selectionMode; timeline.setSelectionMode(state.selectionMode); syncSelectionTools(); showToast(state.selectionMode ? 'Select mode on — click clips to select multiple' : 'Select mode off'); });
    elements.btnGroupSelection.addEventListener('click', groupSelectedTracks);
    elements.btnApplyPairTransition.addEventListener('click', applySelectedVideoPair);
    elements.btnUnpairTransition.addEventListener('click', unlinkSelectedVideoPair);
    elements.btnDuplicateSelection.addEventListener('click', () => { void duplicateSelectedTracks(); });
    elements.btnDeleteSelection.addEventListener('click', () => { void deleteSelectedTracks(); });
    elements.previewZoom.addEventListener('input', (event) => { state.previewZoom = Number(event.target.value); syncPreviewZoom(); });
    elements.btnResetPreviewZoom.addEventListener('click', () => { state.previewZoom = 100; syncPreviewZoom(); showToast('Preview zoom reset'); });

    elements.btnImport.addEventListener('click', () => elements.fileInput.click());
    elements.btnBrowse.addEventListener('click', browseDirectory); elements.btnHeaderBrowse.addEventListener('click', browseDirectory);
    elements.btnBasicMode.addEventListener('click', () => { window.location.href = './index.html?mode=basic'; });
    elements.btnClear.addEventListener('click', () => {
        if (!state.files.length && !state.tracks.length) return;
        if (!confirm('Clear all Project Files and all timeline clips?')) return;
        recordHistory('Clear project');
        engine.clearAll(); state.files = []; state.tracks = []; state.selectedTrackIds.clear(); state.selectedTrackId = null; state.selectedFileId = null; renderFiles(); refreshAll(); pruneSourceRegistry();
    });
    elements.fileInput.addEventListener('change', async (event) => { await addFiles(event.target.files); event.target.value = ''; });

    elements.btnPlay.addEventListener('click', async () => { try { await engine.togglePlay(); } catch (error) { elements.previewState.textContent = error.message; } });
    elements.btnStepBack.addEventListener('click', () => { void engine.stepFrame(-1).catch((error) => { elements.previewState.textContent = error.message; }); });
    elements.btnStepForward.addEventListener('click', () => { void engine.stepFrame(1).catch((error) => { elements.previewState.textContent = error.message; }); });
    elements.btnSnapshot.addEventListener('click', async () => { try { await engine.snapshot(); } catch (error) { elements.previewState.textContent = error.message; } });
    elements.btnPreviewMute.addEventListener('click', () => { engine.togglePreviewMute(); syncPreviewMuteButton(); });
    elements.previewVolume.addEventListener('input', (event) => { engine.setPreviewVolume(Number(event.target.value) / 100); syncPreviewMuteButton(); });
    elements.previewSeek.addEventListener('pointerdown', () => { state.isSeeking = true; });
    elements.previewSeek.addEventListener('input', (event) => { void engine.seek(Number(event.target.value), { resume: false }).catch((error) => { elements.previewState.textContent = error.message; }); });
    elements.previewSeek.addEventListener('change', (event) => { state.isSeeking = false; void engine.seek(Number(event.target.value), { resume: true }).catch((error) => { elements.previewState.textContent = error.message; }); });

    elements.videoVisibleSwitch.addEventListener('click', () => { recordHistory('Toggle video visibility'); const track = getTrack(); if (!track || track.type !== 'video') return; track.visible = !track.visible; refreshAll(); });
    elements.videoAudioSwitch.addEventListener('click', () => { recordHistory('Toggle linked video audio'); const track = getTrack(); if (!track || track.type !== 'video') return; track.audio.muted = !track.audio.muted; engine.syncAudioSettings(); syncInspector(); });
    elements.videoAudioVolume.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'video') return; track.audio.volume = Number(elements.videoAudioVolume.value) / 100; elements.videoAudioVolumeValue.textContent = `${elements.videoAudioVolume.value}%`; engine.syncAudioSettings(); });
    elements.videoOpacity.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'video') return; track.opacity = Number(elements.videoOpacity.value) / 100; elements.videoOpacityValue.textContent = `${elements.videoOpacity.value}%`; engine.renderFrame(); });
    elements.videoBlendMode.addEventListener('change', () => { const track = getTrack(); if (!track || track.type !== 'video') return; track.blendMode = elements.videoBlendMode.value; engine.renderFrame(); });
    function updateVideoVisualFade(edge,control) {
        const track=getTrack();
        if(!track||track.type!=='video')return;
        track.visualTransitions=normalizeVisualTransitions(track.visualTransitions);
        track.visualTransitions[edge].duration=clamp(Number(control.value)||0,0,Math.min(30,Number(track.clipDuration)||0));
        timeline.updateVisualTransitionMarkers(track);
        syncInspector();
        engine.renderFrame();
    }
    for(const [edge,slider,curve] of [
        ['enter',elements.videoTransitionEnter,elements.videoTransitionEnterCurve],
        ['exit',elements.videoTransitionExit,elements.videoTransitionExitCurve]
    ]){
        slider.addEventListener('input',()=>updateVideoVisualFade(edge,slider));
        curve.addEventListener('change',()=>{
            const track=getTrack();
            if(!track||track.type!=='video')return;
            track.visualTransitions=normalizeVisualTransitions(track.visualTransitions);
            track.visualTransitions[edge].curve=curve.value==='smooth'?'smooth':'linear';
            syncInspector();engine.renderFrame();
        });
    }
    elements.btnExtractAudio.addEventListener('click', extractAudioFromSelectedVideo);

    elements.backgroundVisibleSwitch.addEventListener('click', () => { recordHistory('Toggle background visibility'); const track = getTrack(); if (!track || track.type !== 'background') return; track.visible = !track.visible; refreshAll(); });
    elements.backgroundOpacity.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'background') return; track.opacity = Number(elements.backgroundOpacity.value) / 100; elements.backgroundOpacityValue.textContent = `${elements.backgroundOpacity.value}%`; engine.renderFrame(); });
    elements.backgroundBlendMode.addEventListener('change', () => { const track = getTrack(); if (!track || track.type !== 'background') return; track.blendMode = elements.backgroundBlendMode.value; engine.renderFrame(); });

    elements.audioAuditionSwitch.addEventListener('click', () => { recordHistory('Toggle audio audition'); const track = getTrack(); if (!track || track.type !== 'audio') return; track.audio.muted = !track.audio.muted; engine.syncAudioSettings(); syncInspector(); });
    elements.audioTrackVolume.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'audio') return; track.audio.volume = Number(elements.audioTrackVolume.value) / 100; elements.audioTrackVolumeValue.textContent = `${elements.audioTrackVolume.value}%`; engine.syncAudioSettings(); });
    elements.audioFadeIn.addEventListener('input', () => updateAudioFade('fadeIn', elements.audioFadeIn, elements.audioFadeInValue));
    elements.audioFadeOut.addEventListener('input', () => updateAudioFade('fadeOut', elements.audioFadeOut, elements.audioFadeOutValue));

    elements.stickerVisibleSwitch.addEventListener('click', () => { recordHistory('Toggle sticker visibility'); const track = getTrack(); if (!track || track.type !== 'sticker') return; track.visible = !track.visible; refreshAll(); });
    elements.stickerOpacity.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; track.opacity = Number(elements.stickerOpacity.value) / 100; elements.stickerOpacityValue.textContent = `${elements.stickerOpacity.value}%`; engine.renderFrame(); });
    elements.stickerBlendMode.addEventListener('change', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; track.blendMode = elements.stickerBlendMode.value; engine.renderFrame(); });
    elements.stickerTransparencyMode.addEventListener('change', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; track.transparency.mode = elements.stickerTransparencyMode.value; engine.renderFrame(); });
    elements.stickerKeyColour.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; track.transparency.keyColour = elements.stickerKeyColour.value; elements.stickerKeyColourText.value = track.transparency.keyColour; engine.renderFrame(); });
    elements.stickerKeyColourText.addEventListener('change', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; const value = elements.stickerKeyColourText.value.trim(); const colour = /^#[0-9a-f]{6}$/i.test(value) ? value : '#00ff00'; track.transparency.keyColour = colour; elements.stickerKeyColour.value = colour; elements.stickerKeyColourText.value = colour; engine.renderFrame(); });
    elements.stickerKeyTolerance.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; track.transparency.tolerance = Number(elements.stickerKeyTolerance.value); elements.stickerKeyToleranceValue.textContent = `${track.transparency.tolerance}%`; engine.renderFrame(); });
    elements.stickerEdgeFeather.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; track.transparency.feather = Number(elements.stickerEdgeFeather.value); elements.stickerEdgeFeatherValue.textContent = `${track.transparency.feather}%`; engine.renderFrame(); });

    registerInspectorHistory(elements.videoAudioVolume, 'Change video audio volume');
    registerInspectorHistory(elements.videoOpacity, 'Change video opacity');
    registerInspectorHistory(elements.videoBlendMode, 'Change video blend mode');
    registerInspectorHistory(elements.videoTransitionEnter, 'Change video entrance fade');
    registerInspectorHistory(elements.videoTransitionExit, 'Change video exit fade');
    registerInspectorHistory(elements.videoTransitionEnterCurve, 'Change video entrance curve');
    registerInspectorHistory(elements.videoTransitionExitCurve, 'Change video exit curve');
    registerInspectorHistory(elements.backgroundOpacity, 'Change background opacity');
    registerInspectorHistory(elements.backgroundBlendMode, 'Change background blend mode');
    registerInspectorHistory(elements.audioTrackVolume, 'Change audio volume');
    registerInspectorHistory(elements.audioFadeIn, 'Change audio fade in');
    registerInspectorHistory(elements.audioFadeOut, 'Change audio fade out');
    registerInspectorHistory(elements.stickerOpacity, 'Change sticker opacity');
    registerInspectorHistory(elements.stickerBlendMode, 'Change sticker blend mode');
    registerInspectorHistory(elements.stickerTransparencyMode, 'Change sticker transparency');
    registerInspectorHistory(elements.stickerKeyColour, 'Change sticker key colour');
    registerInspectorHistory(elements.stickerKeyColourText, 'Change sticker key colour');
    registerInspectorHistory(elements.stickerKeyTolerance, 'Change sticker tolerance');
    registerInspectorHistory(elements.stickerEdgeFeather, 'Change sticker feather');

    elements.contextSplitNow.addEventListener('click', async () => { await splitTrackAtNow(state.contextTrackId); hideContextMenu(); });
    elements.contextAddLayer.addEventListener('click', addLayerFromContext);
    elements.contextExtractAudio.addEventListener('click', async () => { await extractAudioFromSelectedVideo(); hideContextMenu(); });
    elements.contextRemoveLayer.addEventListener('click', removeLayerFromContext);
    document.addEventListener('click', (event) => { if (!elements.contextMenu.contains(event.target)) hideContextMenu(); });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { hideContextMenu(); closeEditorModals(); elements.trackTypeMenu.hidden = true; elements.btnAddTrack.setAttribute('aria-expanded','false'); }
        const modifier = event.ctrlKey || event.metaKey;
        const target = event.target;
        const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
        if (!isTyping && (event.key === 'Delete' || event.key === 'Backspace') && state.selectedTrackIds.size) {
            event.preventDefault();
            void deleteSelectedTracks();
            return;
        }
        if (!modifier || isTyping) return;
        if (event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undoTimelineEdit(); }
        if ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y') { event.preventDefault(); redoTimelineEdit(); }
    });
    window.addEventListener('beforeunload', (event) => {
        if (exporter.busy || offlineExporter.busy) {
            event.preventDefault();
            event.returnValue = '';
        } else {
            engine.destroy();
        }
    });

    document.querySelectorAll('button:not([title])').forEach((button) => { button.title = button.getAttribute('aria-label') || button.textContent.trim().replace(/\\s+/g,' ').slice(0,90); });
    renderTransitionCatalog(); installPreviewResize(); installGlobalFileDrop(); applyCanvasResolution(); renderFiles(); refreshAll(); syncPreviewMuteButton(); syncPreviewZoom(); syncTimelineZoom(); syncSelectionTools(); updateHistoryButtons(); initVideoExportUi();
    requestAnimationFrame(() => showToast('MotoriClip Advanced v0.24 loaded — File Explorer drops, preview resize/zoom, delete and duplicate are active'));
})();
