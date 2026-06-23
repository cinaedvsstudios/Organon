/**
 * ORGANON STUDIO: ADVANCED AUDIO TIMELINE CONTROLLER
 * v0.17 — separate video lanes, magnetic video snapping, and colour-matched clip end markers.
 * Basic Mode is untouched.
 */

import { AdvancedTimeline } from './advanced-timeline.js';
import { AdvancedMediaEngine } from './advanced-media-engine.js';

(() => {
    const FILE_PATTERN = /\.(mp4|webm|mov|m4v|avi|mkv|mp3|wav|m4a|aac|ogg|opus|flac|gif|webp|png|jpe?g)$/i;
    const VIDEO_PATTERN = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;
    const AUDIO_PATTERN = /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i;
    const STICKER_PATTERN = /\.(gif|webp|png)$/i;
    const BACKGROUND_PATTERN = /\.(jpe?g)$/i;
    const state = {
        files: [], tracks: [], selectedTrackId: null, selectedTrackIds: new Set(), selectedFileId: null,
        contextTrackId: null, dragDepth: 0, isSeeking: false, serial: 0, liveRenderRequest: null,
        toastTimer: null, selectionMode: false,
        history: { undo: [], redo: [], limit: 60 }, historyRestoring: false
    };

    const elements = {
        canvas: document.getElementById('advanced-canvas'), mediaBin: document.getElementById('media-bin'),
        previewStage: document.getElementById('preview-stage'), previewResizeHandle: document.getElementById('preview-resize-handle'), previewEmpty: document.getElementById('preview-empty'), previewState: document.getElementById('preview-state'),
        previewSeek: document.getElementById('preview-seek'), previewVolume: document.getElementById('preview-volume'), timeReadout: document.getElementById('time-readout'),
        btnPlay: document.getElementById('btn-play'), btnPreviewMute: document.getElementById('btn-preview-mute'), btnStepBack: document.getElementById('btn-step-back'), btnStepForward: document.getElementById('btn-step-forward'), btnSnapshot: document.getElementById('btn-snapshot'),
        fileInput: document.getElementById('file-input'), btnImport: document.getElementById('btn-import'), btnBrowse: document.getElementById('btn-browse'), btnHeaderBrowse: document.getElementById('btn-header-browse'), btnClear: document.getElementById('btn-clear'), btnBasicMode: document.getElementById('btn-basic-mode'),
        fileList: document.getElementById('file-list'), fileCount: document.getElementById('file-count'), projectDropZone: document.getElementById('project-drop-zone'), dropOverlay: document.getElementById('project-drop-overlay'),
        canvasWidth: document.getElementById('canvas-width'), canvasHeight: document.getElementById('canvas-height'), canvasAspectLabel: document.getElementById('canvas-aspect-label'), btnApplyCanvas: document.getElementById('btn-apply-canvas'),
        toast: document.getElementById('app-toast'), timelineZoom: document.getElementById('timeline-zoom'), timelineZoomValue: document.getElementById('timeline-zoom-value'), btnResetTimelineZoom: document.getElementById('btn-reset-timeline-zoom'), btnUndo: document.getElementById('btn-undo'), btnRedo: document.getElementById('btn-redo'), btnSplitAll: document.getElementById('btn-split-all'), btnSelectionMode: document.getElementById('btn-selection-mode'), btnGroupSelection: document.getElementById('btn-group-selection'),
        inspectorKind: document.getElementById('inspector-kind'), inspectorProject: document.getElementById('inspector-project'), inspectorVideo: document.getElementById('inspector-video'), inspectorBackground: document.getElementById('inspector-background'), inspectorAudio: document.getElementById('inspector-audio'), inspectorSticker: document.getElementById('inspector-sticker'),
        selectedVideoName: document.getElementById('selected-video-name'), videoVisibleSwitch: document.getElementById('video-visible-switch'), videoAudioSwitch: document.getElementById('video-audio-switch'), videoAudioVolume: document.getElementById('video-audio-volume'), videoAudioVolumeValue: document.getElementById('video-audio-volume-value'), videoOpacity: document.getElementById('video-opacity'), videoOpacityValue: document.getElementById('video-opacity-value'), videoBlendMode: document.getElementById('video-blend-mode'), btnExtractAudio: document.getElementById('btn-extract-audio'),
        selectedBackgroundName: document.getElementById('selected-background-name'), backgroundVisibleSwitch: document.getElementById('background-visible-switch'), backgroundOpacity: document.getElementById('background-opacity'), backgroundOpacityValue: document.getElementById('background-opacity-value'), backgroundBlendMode: document.getElementById('background-blend-mode'),
        selectedAudioName: document.getElementById('selected-audio-name'), audioAuditionSwitch: document.getElementById('audio-audition-switch'), audioTrackVolume: document.getElementById('audio-track-volume'), audioTrackVolumeValue: document.getElementById('audio-track-volume-value'), audioFadeIn: document.getElementById('audio-fade-in'), audioFadeInValue: document.getElementById('audio-fade-in-value'), audioFadeOut: document.getElementById('audio-fade-out'), audioFadeOutValue: document.getElementById('audio-fade-out-value'),
        selectedStickerName: document.getElementById('selected-sticker-name'), stickerVisibleSwitch: document.getElementById('sticker-visible-switch'), stickerOpacity: document.getElementById('sticker-opacity'), stickerOpacityValue: document.getElementById('sticker-opacity-value'), stickerBlendMode: document.getElementById('sticker-blend-mode'), stickerTransparencyMode: document.getElementById('sticker-transparency-mode'), stickerKeyColour: document.getElementById('sticker-key-colour'), stickerKeyColourText: document.getElementById('sticker-key-colour-text'), stickerKeyTolerance: document.getElementById('sticker-key-tolerance'), stickerKeyToleranceValue: document.getElementById('sticker-key-tolerance-value'), stickerEdgeFeather: document.getElementById('sticker-edge-feather'), stickerEdgeFeatherValue: document.getElementById('sticker-edge-feather-value'),
        contextMenu: document.getElementById('timeline-context-menu'), contextMenuTitle: document.getElementById('context-menu-title'), contextSplitNow: document.getElementById('context-split-now'), contextAddLayer: document.getElementById('context-add-layer'), contextExtractAudio: document.getElementById('context-extract-audio'), contextRemoveLayer: document.getElementById('context-remove-layer')
    };

    const engine = new AdvancedMediaEngine({
        canvas: elements.canvas,
        mediaBin: elements.mediaBin,
        onTimeChange: updateTimeDisplay,
        onDurationChange: (duration) => { timeline.setDuration(duration); updateTimeDisplay({ currentTime: engine.currentTime, duration }); },
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
        onSeek: (time) => engine.seek(time),
        onSplitAtPlayhead: splitTrackAtNow
    });

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
            audio: { volume: 1, muted: false, fadeIn: 0, fadeOut: 0 },
            transparency: { mode: 'native', keyColour: '#00ff00', tolerance: 30, feather: 8 }
        };
        return { ...base, ...extras, audio: { ...base.audio, ...(extras.audio || {}) }, transparency: { ...base.transparency, ...(extras.transparency || {}) } };
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

    function cloneTrackForHistory(track) {
        const { audio = {}, transparency = {}, analysis = null, ...rest } = track;
        return {
            ...rest,
            audio: { ...audio },
            transparency: { ...transparency },
            analysis: analysis ? { ...analysis, levels: Array.isArray(analysis.levels) ? [...analysis.levels] : analysis.levels } : null
        };
    }

    function captureHistorySnapshot() {
        return {
            files: state.files.map((entry) => ({ ...entry })),
            tracks: state.tracks.map(cloneTrackForHistory),
            selectedTrackIds: [...state.selectedTrackIds],
            selectedTrackId: state.selectedTrackId,
            selectedFileId: state.selectedFileId,
            currentTime: engine.currentTime
        };
    }

    function updateHistoryButtons() {
        const canUndo = state.history.undo.length > 0;
        const canRedo = state.history.redo.length > 0;
        elements.btnUndo.disabled = !canUndo;
        elements.btnRedo.disabled = !canRedo;
        elements.btnUndo.title = canUndo ? `Undo ${state.history.undo[state.history.undo.length - 1].label}` : 'Nothing to undo';
        elements.btnRedo.title = canRedo ? `Redo ${state.history.redo[state.history.redo.length - 1].label}` : 'Nothing to redo';
    }

    function recordHistory(label = 'timeline edit') {
        if (state.historyRestoring) return;
        state.history.undo.push({ label, snapshot: captureHistorySnapshot() });
        if (state.history.undo.length > state.history.limit) state.history.undo.shift();
        state.history.redo = [];
        updateHistoryButtons();
    }

    async function restoreHistorySnapshot(snapshot) {
        if (!snapshot) return;
        state.historyRestoring = true;
        try {
            engine.pause();
            state.files = snapshot.files.map((entry) => ({ ...entry }));
            state.tracks = snapshot.tracks.map(cloneTrackForHistory);
            state.selectedTrackIds = new Set(snapshot.selectedTrackIds || []);
            state.selectedTrackId = snapshot.selectedTrackId || [...state.selectedTrackIds][0] || null;
            state.selectedFileId = snapshot.selectedFileId || null;
            renderFiles();
            refreshAll();
            await engine.seek(Number(snapshot.currentTime) || 0);
        } finally {
            state.historyRestoring = false;
        }
    }

    async function undoTimelineEdit() {
        const entry = state.history.undo.pop();
        if (!entry) return;
        state.history.redo.push({ label: entry.label, snapshot: captureHistorySnapshot() });
        await restoreHistorySnapshot(entry.snapshot);
        updateHistoryButtons();
        showToast(`Undid ${entry.label}`);
    }

    async function redoTimelineEdit() {
        const entry = state.history.redo.pop();
        if (!entry) return;
        state.history.undo.push({ label: entry.label, snapshot: captureHistorySnapshot() });
        await restoreHistorySnapshot(entry.snapshot);
        updateHistoryButtons();
        showToast(`Redid ${entry.label}`);
    }

    function registerInspectorHistory(control, label) {
        if (!control) return;
        control.addEventListener('pointerdown', () => recordHistory(label));
        control.addEventListener('keydown', (event) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' '].includes(event.key)) recordHistory(label);
        });
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
            row.draggable = true; row.tabIndex = 0; row.dataset.fileId = entry.id; row.title = 'Drag this file to the timeline.';
            row.innerHTML = `<span class="file-kind">${kindLabel(entry.kind)}</span><span><span class="file-name">${escapeHtml(entry.name)}</span><span class="file-meta">${kindName(entry.kind)} · ${formatFileSize(entry.file.size)} · drag to timeline</span></span>`;
            row.addEventListener('dragstart', (event) => {
                state.selectedFileId = entry.id;
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('application/x-organon-project-file', entry.id);
                event.dataTransfer.setData('text/x-organon-project-file', entry.id);
                event.dataTransfer.setData('text/plain', entry.id);
                timeline.beginProjectFileDrag(entry.id);
                row.classList.add('is-dragging');
            });
            row.addEventListener('dragend', () => { timeline.endProjectFileDrag(); row.classList.remove('is-dragging'); });
            row.addEventListener('click', () => { state.selectedFileId = entry.id; renderFiles(); });
            row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.selectedFileId = entry.id; renderFiles(); } });
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
        state.selectedTrackIds = new Set([...state.selectedTrackIds].filter((id) => state.tracks.some((track) => track.id === id)));
        if (!state.selectedTrackIds.has(state.selectedTrackId)) state.selectedTrackId = [...state.selectedTrackIds][0] || null;
        engine.setTracks(state.tracks);
        timeline.setTracks(state.tracks);
        timeline.setSelectedTrackIds(state.selectedTrackIds);
        syncSelectionTools();
        syncInspector();
    }

    async function loadTrackFromFile(track, entry, start = 0) {
        track.start = Math.max(0, Number(start) || 0);
        try {
            await engine.loadTrack(track, entry.file);
            if (!track.clipDuration) track.clipDuration = (track.type === 'sticker' || track.type === 'background') ? 3 : track.sourceDuration || 1;
            refreshAll(); selectTrack(track.id);
            elements.previewState.textContent = `Loaded ${entry.name}`;
            if (track.type === 'audio' || track.type === 'video') {
                engine.analyzeTrackAudio(track, entry.file).then(() => {
                    timeline.setTracks(state.tracks);
                    elements.previewState.textContent = `Analysed ${entry.name}`;
                });
            }
        } catch (error) {
            elements.previewState.textContent = `Could not load ${entry.name}`;
            alert(`Could not load ${entry.name}. ${error.message}`);
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
        if (entry.kind !== 'video') {
            track = laneTracks.find((candidate) => !candidate.sourceName && candidate.type === entry.kind) || null;
            if (!track && laneTracks.length && laneType === entry.kind) {
                const lane = laneTracks[0];
                track = createTrack(entry.kind, { laneId: lane.laneId, laneLabel: lane.laneLabel, order: lane.order });
                state.tracks.push(track);
            }
        }
        if (!track) { track = createTrack(entry.kind); state.tracks.push(track); }
        await loadTrackFromFile(track, entry, start);
    }

    function onTimelineTrackChanged(track, detail = {}) {
        if (detail.live) {
            if (state.liveRenderRequest !== null) return;
            state.liveRenderRequest = requestAnimationFrame(() => { state.liveRenderRequest = null; engine.renderFrame(); });
            return;
        }
        if (state.liveRenderRequest !== null) { cancelAnimationFrame(state.liveRenderRequest); state.liveRenderRequest = null; }
        const relocated = resolveVideoOverlap(track);
        engine.setTracks(state.tracks);
        timeline.setTracks(state.tracks);
        timeline.setDuration(engine.getTimelineDuration());
        syncInspector();
        if (relocated) showToast(`${track.sourceName || 'Video'} moved to ${track.laneLabel} so video clips do not overlap`);
    }

    async function extractAudioFromSelectedVideo() {
        const video = getTrack();
        if (!video || video.type !== 'video' || !video.file) return;
        recordHistory(`Extract audio from ${video.sourceName || video.laneLabel}`);
        const audio = createTrack('audio', { extractedFrom: video.id, start: video.start, sourceOffset: video.sourceOffset, clipDuration: video.clipDuration, label: `Extracted Audio ${nextLaneOrder('audio')}` });
        state.tracks.push(audio); video.audio.muted = true;
        await loadTrackFromFile(audio, { file: video.file, name: video.sourceName }, video.start);
        audio.clipDuration = Math.min(video.clipDuration, Math.max(.15, (audio.sourceDuration || video.clipDuration) - audio.sourceOffset));
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
        if (record) recordHistory(`Split ${track.sourceName || track.laneLabel}`);
        const cutTime = engine.currentTime;
        const leftDuration = cutTime - track.start;
        const rightDuration = track.clipDuration - leftDuration;
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
            transparency: { ...track.transparency },
            groupId: track.groupId,
            extractedFrom: track.extractedFrom,
            analysis: track.analysis
        });
        track.clipDuration = leftDuration;
        state.tracks.push(split);
        await loadTrackFromFile(split, { file: track.file, name: track.sourceName }, cutTime);
        split.clipDuration = rightDuration;
        refreshAll(); selectTrack(split.id);
        showToast('Clip split at now line');
        return true;
    }

    async function splitAllAtNow() {
        const targetIds = state.tracks.filter((track) => canSplitTrack(track)).map((track) => track.id);
        if (!targetIds.length) { showToast('No clips cross the now line'); return; }
        recordHistory(`Split all at ${formatTime(engine.currentTime)}`);
        for (const id of targetIds) await splitTrackAtNow(id, { record: false });
        showToast(`Split ${targetIds.length} clip${targetIds.length === 1 ? '' : 's'} at ${formatTime(engine.currentTime)}`);
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

    function installPreviewResize() {
        let active = null;
        elements.previewResizeHandle.addEventListener('pointerdown', (event) => {
            event.preventDefault(); active = { pointerId: event.pointerId, x: event.clientX, width: elements.previewStage.getBoundingClientRect().width };
            elements.previewStage.classList.add('is-resizing'); elements.previewResizeHandle.setPointerCapture?.(event.pointerId);
        });
        elements.previewResizeHandle.addEventListener('pointermove', (event) => {
            if (!active || active.pointerId !== event.pointerId) return;
            const parentWidth = elements.previewStage.parentElement.clientWidth;
            const width = clamp(active.width + (event.clientX - active.x), 300, Math.max(300, parentWidth));
            elements.previewStage.style.width = `${Math.round(width)}px`;
        });
        const stop = (event) => { if (!active || active.pointerId !== event.pointerId) return; active = null; elements.previewStage.classList.remove('is-resizing'); };
        elements.previewResizeHandle.addEventListener('pointerup', stop); elements.previewResizeHandle.addEventListener('pointercancel', stop);
    }

    function hasExternalFiles(event) { return Array.from(event.dataTransfer?.types || []).includes('Files'); }
    async function browseDirectory() {
        if (!window.showDirectoryPicker) { elements.fileInput.click(); return; }
        try {
            const handle = await window.showDirectoryPicker({ mode: 'read' }); const files = [];
            for await (const entry of handle.values()) if (entry.kind === 'file' && FILE_PATTERN.test(entry.name)) files.push(await entry.getFile());
            await addFiles(files);
        } catch (error) { if (error.name !== 'AbortError') { console.warn(error); elements.previewState.textContent = 'Folder browse was unavailable. Use Import instead.'; } }
    }
    function installGlobalFileDrop() {
        const show = () => elements.dropOverlay.classList.add('visible');
        const hide = () => elements.dropOverlay.classList.remove('visible');
        const addDroppedFiles = async (event) => {
            if (event.__organonExternalFilesHandled || !event.dataTransfer?.files?.length) return;
            event.__organonExternalFilesHandled = true; event.preventDefault(); event.stopPropagation(); state.dragDepth = 0; hide(); await addFiles(event.dataTransfer.files);
        };
        document.addEventListener('dragenter', (event) => { if (!hasExternalFiles(event)) return; event.preventDefault(); state.dragDepth += 1; show(); }, true);
        document.addEventListener('dragover', (event) => { if (!hasExternalFiles(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }, true);
        document.addEventListener('dragleave', (event) => { if (!hasExternalFiles(event)) return; state.dragDepth = Math.max(0, state.dragDepth - 1); if (!state.dragDepth) hide(); }, true);
        document.addEventListener('drop', addDroppedFiles, true);
        const zone = elements.projectDropZone;
        zone.addEventListener('dragenter', (event) => { if (!hasExternalFiles(event)) return; event.preventDefault(); zone.classList.add('drop-target-active'); });
        zone.addEventListener('dragover', (event) => { if (!hasExternalFiles(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; zone.classList.add('drop-target-active'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drop-target-active'));
        zone.addEventListener('drop', async (event) => { zone.classList.remove('drop-target-active'); await addDroppedFiles(event); });
        zone.addEventListener('click', (event) => { if (!event.target.closest('.file-row')) elements.fileInput.click(); });
        zone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); elements.fileInput.click(); } });
    }

    function syncTimelineZoom() { const percent = timeline.getZoomPercent(); elements.timelineZoom.value = String(percent); elements.timelineZoomValue.textContent = `${percent}%`; }
    function updateAudioFade(setting, input, label) {
        const track = getTrack(); if (!track || track.type !== 'audio') return;
        track.audio[setting] = clamp(Number(input.value) || 0, 0, Number(track.clipDuration) || 0);
        label.textContent = formatSeconds(track.audio[setting]);
        engine.updateAudioFades(engine.currentTime);
    }

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

    elements.btnImport.addEventListener('click', () => elements.fileInput.click());
    elements.btnBrowse.addEventListener('click', browseDirectory); elements.btnHeaderBrowse.addEventListener('click', browseDirectory);
    elements.btnBasicMode.addEventListener('click', () => { window.location.href = './index.html'; });
    elements.btnClear.addEventListener('click', () => {
        if (!state.files.length && !state.tracks.length) return;
        if (!confirm('Clear all Project Files and all timeline clips?')) return;
        recordHistory('Clear project');
        engine.pause(); state.files = []; state.tracks = []; state.selectedTrackIds.clear(); state.selectedTrackId = null; state.selectedFileId = null; renderFiles(); refreshAll();
    });
    elements.fileInput.addEventListener('change', async (event) => { await addFiles(event.target.files); event.target.value = ''; });

    elements.btnPlay.addEventListener('click', async () => { try { await engine.togglePlay(); } catch (error) { elements.previewState.textContent = error.message; } });
    elements.btnStepBack.addEventListener('click', () => engine.stepFrame(-1));
    elements.btnStepForward.addEventListener('click', () => engine.stepFrame(1));
    elements.btnSnapshot.addEventListener('click', async () => { try { await engine.snapshot(); } catch (error) { elements.previewState.textContent = error.message; } });
    elements.btnPreviewMute.addEventListener('click', () => { engine.togglePreviewMute(); syncPreviewMuteButton(); });
    elements.previewVolume.addEventListener('input', (event) => { engine.setPreviewVolume(Number(event.target.value) / 100); syncPreviewMuteButton(); });
    elements.previewSeek.addEventListener('pointerdown', () => { state.isSeeking = true; });
    elements.previewSeek.addEventListener('input', (event) => engine.seek(Number(event.target.value)));
    elements.previewSeek.addEventListener('change', (event) => { state.isSeeking = false; engine.seek(Number(event.target.value)); });

    elements.videoVisibleSwitch.addEventListener('click', () => { recordHistory('Toggle video visibility'); const track = getTrack(); if (!track || track.type !== 'video') return; track.visible = !track.visible; refreshAll(); });
    elements.videoAudioSwitch.addEventListener('click', () => { recordHistory('Toggle linked video audio'); const track = getTrack(); if (!track || track.type !== 'video') return; track.audio.muted = !track.audio.muted; engine.syncAudioSettings(); syncInspector(); });
    elements.videoAudioVolume.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'video') return; track.audio.volume = Number(elements.videoAudioVolume.value) / 100; elements.videoAudioVolumeValue.textContent = `${elements.videoAudioVolume.value}%`; engine.syncAudioSettings(); });
    elements.videoOpacity.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'video') return; track.opacity = Number(elements.videoOpacity.value) / 100; elements.videoOpacityValue.textContent = `${elements.videoOpacity.value}%`; engine.renderFrame(); });
    elements.videoBlendMode.addEventListener('change', () => { const track = getTrack(); if (!track || track.type !== 'video') return; track.blendMode = elements.videoBlendMode.value; engine.renderFrame(); });
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
        if (event.key === 'Escape') hideContextMenu();
        const modifier = event.ctrlKey || event.metaKey;
        const target = event.target;
        const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
        if (!modifier || isTyping) return;
        if (event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undoTimelineEdit(); }
        if ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y') { event.preventDefault(); redoTimelineEdit(); }
    });
    window.addEventListener('beforeunload', () => engine.destroy());

    installPreviewResize(); installGlobalFileDrop(); applyCanvasResolution(); renderFiles(); refreshAll(); syncPreviewMuteButton(); syncTimelineZoom(); syncSelectionTools(); updateHistoryButtons();
    requestAnimationFrame(() => showToast('Advanced Audio Timeline v0.17 loaded'));
})();
