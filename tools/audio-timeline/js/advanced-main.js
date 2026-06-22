/**
 * ORGANON STUDIO: ADVANCED AUDIO TIMELINE CONTROLLER
 * v0.08 — robust file-drop import for the independent Advanced Mode UI. Basic Mode files are not imported or changed.
 */

import { AdvancedTimeline } from './advanced-timeline.js';
import { AdvancedMediaEngine } from './advanced-media-engine.js';

(() => {
    const PROJECT_FILE_EXTENSIONS = /\.(mp4|webm|mov|m4v|avi|mkv|mp3|wav|m4a|aac|ogg|opus|flac|gif|webp|png)$/i;
    const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;
    const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i;
    const STICKER_EXTENSIONS = /\.(gif|webp|png)$/i;

    const state = {
        files: [],
        selectedFileIndex: -1,
        tracks: createDefaultTracks(),
        selectedTrackId: null,
        contextTrackId: null,
        isSeeking: false,
        dragDepth: 0
    };

    const elements = {
        canvas: document.getElementById('advanced-canvas'),
        mediaBin: document.getElementById('media-bin'),
        previewStage: document.getElementById('preview-stage'),
        previewResizeHandle: document.getElementById('preview-resize-handle'),
        previewEmpty: document.getElementById('preview-empty'),
        previewState: document.getElementById('preview-state'),
        previewSeek: document.getElementById('preview-seek'),
        previewVolume: document.getElementById('preview-volume'),
        timeReadout: document.getElementById('time-readout'),
        btnPlay: document.getElementById('btn-play'),
        btnPreviewMute: document.getElementById('btn-preview-mute'),
        btnStepBack: document.getElementById('btn-step-back'),
        btnStepForward: document.getElementById('btn-step-forward'),
        btnSnapshot: document.getElementById('btn-snapshot'),
        fileInput: document.getElementById('file-input'),
        fileList: document.getElementById('file-list'),
        fileCount: document.getElementById('file-count'),
        projectSummary: document.getElementById('project-summary'),
        inspectorKind: document.getElementById('inspector-kind'),
        inspectorEmpty: document.getElementById('inspector-empty'),
        inspectorVisual: document.getElementById('inspector-visual'),
        inspectorVideo: document.getElementById('inspector-video'),
        inspectorAudio: document.getElementById('inspector-audio'),
        inspectorSticker: document.getElementById('inspector-sticker'),
        selectedLayerName: document.getElementById('selected-layer-name'),
        blendHelp: document.getElementById('blend-help'),
        visualVisibleSwitch: document.getElementById('visual-visible-switch'),
        layerBlendMode: document.getElementById('layer-blend-mode'),
        videoControlCopy: document.getElementById('video-control-copy'),
        btnSelectLinkedAudio: document.getElementById('btn-select-linked-audio'),
        selectedAudioName: document.getElementById('selected-audio-name'),
        audioAuditionSwitch: document.getElementById('audio-audition-switch'),
        audioTrackVolume: document.getElementById('audio-track-volume'),
        audioTrackVolumeValue: document.getElementById('audio-track-volume-value'),
        stickerControlCopy: document.getElementById('sticker-control-copy'),
        stickerTransparencyMode: document.getElementById('sticker-transparency-mode'),
        stickerKeyColour: document.getElementById('sticker-key-colour'),
        stickerKeyColourText: document.getElementById('sticker-key-colour-text'),
        stickerKeyTolerance: document.getElementById('sticker-key-tolerance'),
        stickerKeyToleranceValue: document.getElementById('sticker-key-tolerance-value'),
        stickerEdgeFeather: document.getElementById('sticker-edge-feather'),
        stickerEdgeFeatherValue: document.getElementById('sticker-edge-feather-value'),
        dropOverlay: document.getElementById('project-drop-overlay'),
        projectDropZone: document.getElementById('project-drop-zone'),
        contextMenu: document.getElementById('timeline-context-menu'),
        contextMenuTitle: document.getElementById('context-menu-title'),
        contextAddLayer: document.getElementById('context-add-layer'),
        contextRemoveLayer: document.getElementById('context-remove-layer')
    };

    const engine = new AdvancedMediaEngine({
        canvas: elements.canvas,
        mediaBin: elements.mediaBin,
        onTimeChange: updateTimeDisplay,
        onDurationChange: (duration) => {
            timeline.setDuration(duration);
            updateTimeDisplay({ currentTime: engine.currentTime, duration });
        },
        onPlaybackChange: setPlayButton,
        onRenderError: (error) => { elements.previewState.textContent = `Preview error: ${error.message}`; }
    });

    const timeline = new AdvancedTimeline({
        lanesElement: document.getElementById('timeline-lanes'),
        rulerElement: document.getElementById('timeline-ruler'),
        onSelect: selectTrack,
        onContextMenu: openContextMenu
    });

    engine.setTracks(state.tracks);
    timeline.setTracks(state.tracks);
    timeline.setSelectedTrack(state.selectedTrackId);
    syncInspector();
    renderFiles();
    installPreviewResize();
    installGlobalFileDrop();

    function createDefaultTracks() {
        return [
            createTrack('sticker', 1),
            createTrack('sticker', 2),
            createTrack('video', 1, { audioControlId: 'embedded-audio-1' }),
            createTrack('video', 2, { audioControlId: 'embedded-audio-2' }),
            createTrack('embedded-audio', 1, { linkedVideoId: 'video-1' }),
            createTrack('embedded-audio', 2, { linkedVideoId: 'video-2' }),
            createTrack('external-audio', 1),
            createTrack('external-audio', 2)
        ];
    }

    function createTrack(type, order, extras = {}) {
        const names = { sticker: 'Sticker', video: 'Video', 'embedded-audio': 'Video Audio', 'external-audio': 'External Audio' };
        return {
            id: `${type}-${order}`,
            type,
            order,
            label: `${names[type]} ${order}`,
            subLabel: type === 'sticker' ? (order === 1 ? 'top visual layer' : `below Sticker ${order - 1}`) : undefined,
            start: 0,
            duration: 0,
            sourceName: '',
            visible: true,
            blendMode: 'source-over',
            audio: { volume: 1, muted: false },
            transparency: { mode: 'native', keyColour: '#00ff00', tolerance: 30, feather: 8 },
            ...extras
        };
    }

    function formatTime(seconds) {
        const safe = Math.max(0, Number(seconds) || 0);
        const minutes = Math.floor(safe / 60);
        const remainder = Math.floor(safe % 60).toString().padStart(2, '0');
        return `${minutes}:${remainder}`;
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    }

    function getEntryKind(name, type = '') {
        if (type.startsWith('video/') || VIDEO_EXTENSIONS.test(name)) return 'video';
        if (type.startsWith('audio/') || AUDIO_EXTENSIONS.test(name)) return 'audio';
        if (type === 'image/gif' || type === 'image/webp' || type === 'image/png' || STICKER_EXTENSIONS.test(name)) return 'sticker';
        return null;
    }

    function getTrack(trackId = state.selectedTrackId) {
        return state.tracks.find((track) => track.id === trackId) || null;
    }

    function getAudioControlForSelection() {
        const selected = getTrack();
        if (!selected) return null;
        if (selected.type === 'embedded-audio' || selected.type === 'external-audio') return selected;
        if (selected.type === 'video' && selected.audioControlId) return getTrack(selected.audioControlId);
        return null;
    }

    function updateTimeDisplay({ currentTime, duration }) {
        const safeDuration = Math.max(0, duration || 0);
        const safeCurrent = Math.min(Math.max(0, currentTime || 0), safeDuration || Infinity);
        elements.timeReadout.textContent = `${formatTime(safeCurrent)} / ${formatTime(safeDuration)}`;
        if (!state.isSeeking) {
            elements.previewSeek.max = String(safeDuration);
            elements.previewSeek.value = String(Math.min(safeCurrent, safeDuration));
        }
        elements.previewSeek.disabled = safeDuration <= 0;
        timeline.setCurrentTime(safeCurrent);
    }

    function setPlayButton(isPlaying) {
        elements.btnPlay.textContent = isPlaying ? '⏸️' : '▶️';
        elements.btnPlay.title = isPlaying ? 'Pause preview' : 'Play preview';
        elements.btnPlay.setAttribute('aria-label', elements.btnPlay.title);
    }

    function setPreviewMuteButton() {
        const muted = engine.previewMuted || engine.previewVolume <= 0;
        elements.btnPreviewMute.textContent = muted ? '🔇' : '🔊';
        elements.btnPreviewMute.title = muted ? 'Unmute preview' : 'Mute preview';
        elements.btnPreviewMute.setAttribute('aria-label', elements.btnPreviewMute.title);
    }

    function showInspectorSection(element, show) {
        element.hidden = !show;
    }

    function syncInspector() {
        const track = getTrack();
        const isVisual = track?.type === 'video' || track?.type === 'sticker';
        const isVideo = track?.type === 'video';
        const isAudio = track?.type === 'embedded-audio' || track?.type === 'external-audio';
        const isSticker = track?.type === 'sticker';

        elements.inspectorKind.textContent = track ? track.label : 'No selection';
        showInspectorSection(elements.inspectorEmpty, !track);
        showInspectorSection(elements.inspectorVisual, Boolean(isVisual));
        showInspectorSection(elements.inspectorVideo, Boolean(isVideo));
        showInspectorSection(elements.inspectorAudio, Boolean(isAudio));
        showInspectorSection(elements.inspectorSticker, Boolean(isSticker));
        if (!track) return;

        if (isVisual) {
            const layerOrder = isSticker ? (track.order === 1 ? 'topmost overlay' : `below Sticker ${track.order - 1}`) : 'below all sticker layers';
            elements.selectedLayerName.textContent = `${track.label} — ${layerOrder}`;
            elements.blendHelp.textContent = 'Blend mode applies to this selected visual layer in the live preview and PNG composite.';
            elements.visualVisibleSwitch.classList.toggle('on', track.visible !== false);
            elements.layerBlendMode.value = track.blendMode || 'source-over';
        }

        if (isVideo) {
            const audioTrack = getTrack(track.audioControlId);
            elements.videoControlCopy.textContent = `${track.sourceName || 'No source loaded'} sits below every sticker. Its matching ${audioTrack?.label || 'Video Audio layer'} controls the embedded soundtrack.`;
            elements.btnSelectLinkedAudio.disabled = !audioTrack;
        }

        if (isAudio) {
            elements.selectedAudioName.textContent = `${track.label} — ${track.sourceName || 'waiting for a source'}`;
            elements.audioAuditionSwitch.classList.toggle('on', !track.audio.muted);
            elements.audioTrackVolume.value = String(Math.round((track.audio.volume ?? 1) * 100));
            elements.audioTrackVolumeValue.textContent = `${elements.audioTrackVolume.value}%`;
        }

        if (isSticker) {
            const settings = track.transparency;
            elements.stickerControlCopy.textContent = `${track.label} is ${track.order === 1 ? 'the topmost overlay' : `below Sticker ${track.order - 1}`}. Cutout changes affect the live preview and PNG snapshot.`;
            elements.stickerTransparencyMode.value = settings.mode;
            elements.stickerKeyColour.value = settings.keyColour;
            elements.stickerKeyColourText.value = settings.keyColour;
            elements.stickerKeyTolerance.value = String(settings.tolerance);
            elements.stickerKeyToleranceValue.textContent = `${settings.tolerance}%`;
            elements.stickerEdgeFeather.value = String(settings.feather);
            elements.stickerEdgeFeatherValue.textContent = `${settings.feather}%`;
        }
    }

    function refreshTimelineAndInspector() {
        engine.setTracks(state.tracks);
        timeline.setTracks(state.tracks);
        timeline.setSelectedTrack(state.selectedTrackId);
        syncInspector();
    }

    function selectTrack(trackId) {
        if (!getTrack(trackId)) return;
        state.selectedTrackId = trackId;
        timeline.setSelectedTrack(trackId);
        syncInspector();
        hideContextMenu();
    }

    function renderFiles() {
        elements.fileCount.textContent = `${state.files.length} media`;
        if (!state.files.length) {
            elements.fileList.innerHTML = '<div class="empty-file-list">Drop files anywhere in the window, use Import, or browse a project folder. Files stay here until you place them onto a timeline lane.</div>';
            return;
        }
        elements.fileList.innerHTML = '';
        state.files.forEach((entry, index) => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = `file-row${index === state.selectedFileIndex ? ' active' : ''}`;
            const label = entry.kind === 'video' ? 'VID' : entry.kind === 'audio' ? 'AUD' : 'STK';
            row.innerHTML = `<span class="file-kind">${label}</span><span><span class="file-name">${escapeHtml(entry.name)}</span><span class="file-meta">${escapeHtml(entry.path || entry.file?.type || entry.kind)}</span></span>`;
            row.addEventListener('click', () => activateEntry(index));
            elements.fileList.appendChild(row);
        });
    }

    async function getFileForEntry(entry) {
        if (entry.file) return entry.file;
        if (entry.handle) return entry.handle.getFile();
        throw new Error('That project item is no longer available. Browse the folder again.');
    }

    function chooseTargetTrack(kind) {
        const requestedType = kind === 'video' ? 'video' : kind === 'audio' ? 'external-audio' : 'sticker';
        const selected = getTrack();
        if (selected?.type === requestedType) return selected;
        return state.tracks.find((track) => track.type === requestedType && !track.sourceName) || addLayer(requestedType, false);
    }

    async function activateEntry(index) {
        const entry = state.files[index];
        if (!entry) return;
        state.selectedFileIndex = index;
        renderFiles();
        const target = chooseTargetTrack(entry.kind);
        selectTrack(target.id);
        try {
            const file = await getFileForEntry(entry);
            elements.previewState.textContent = `Loading ${entry.name}…`;
            await engine.attachFile(target, file);
            if (target.type === 'video') {
                const audioControl = getTrack(target.audioControlId);
                if (audioControl) {
                    audioControl.sourceName = `${entry.name} audio`;
                    audioControl.duration = target.duration;
                    audioControl.audio = audioControl.audio || { volume: 1, muted: false };
                }
            }
            refreshTimelineAndInspector();
            elements.previewEmpty.classList.toggle('hidden', state.tracks.some((track) => track.type === 'video' && track.sourceName));
            elements.previewState.textContent = entry.kind === 'sticker' ? `${target.label}: overlay ready` : entry.kind === 'audio' ? `${target.label}: audition ready` : `${target.label}: preview ready`;
            elements.projectSummary.innerHTML = `<strong>${escapeHtml(entry.name)}</strong> is now on ${escapeHtml(target.label)}. ${entry.kind === 'sticker' ? 'Sticker 1 is always on top; lower sticker rows sit beneath it.' : 'Click another timeline line before choosing a different project file to place it there.'}`;
        } catch (error) {
            elements.previewState.textContent = 'Could not load media';
            elements.projectSummary.textContent = `Could not open ${entry.name}: ${error.message}`;
        }
    }

    async function scanDirectory(directoryHandle, parentPath = '') {
        const results = [];
        for await (const [name, handle] of directoryHandle.entries()) {
            const path = parentPath ? `${parentPath}/${name}` : name;
            if (handle.kind === 'directory') results.push(...await scanDirectory(handle, path));
            else if (PROJECT_FILE_EXTENSIONS.test(name)) results.push({ name, path, handle, kind: getEntryKind(name) });
        }
        return results;
    }

    async function browseFolder() {
        if (!('showDirectoryPicker' in window)) {
            elements.projectSummary.textContent = 'Browse requires Chrome or Edge on a secure page. Import or drop files as the fallback.';
            return;
        }
        try {
            const directoryHandle = await window.showDirectoryPicker({ mode: 'read' });
            state.files = (await scanDirectory(directoryHandle)).filter((entry) => entry.kind);
            state.selectedFileIndex = -1;
            renderFiles();
            elements.projectSummary.innerHTML = `<strong>${escapeHtml(directoryHandle.name)}</strong> connected read-only. Found ${state.files.length} recognised media file${state.files.length === 1 ? '' : 's'}.`;
        } catch (error) {
            if (error.name !== 'AbortError') elements.projectSummary.textContent = `Folder browse could not start: ${error.message}`;
        }
    }

    function importFiles(fileList, message = '') {
        const imports = Array.from(fileList || [])
            .map((file) => ({ file, name: file.name, path: file.type || 'imported file', kind: getEntryKind(file.name, file.type) }))
            .filter((entry) => entry.kind);
        if (!imports.length) {
            if (fileList?.length) elements.projectSummary.textContent = 'No supported video, audio, GIF, WebP or PNG files were found.';
            return;
        }
        const existingKeys = new Set(state.files.map((entry) => `${entry.name}|${entry.file?.size || entry.path}`));
        const unique = imports.filter((entry) => {
            const key = `${entry.name}|${entry.file?.size || entry.path}`;
            if (existingKeys.has(key)) return false;
            existingKeys.add(key);
            return true;
        });
        if (!unique.length) {
            elements.projectSummary.textContent = 'Those files are already in Project Files.';
            return;
        }
        state.files.push(...unique);
        state.selectedFileIndex = -1;
        renderFiles();
        elements.projectSummary.textContent = message || `${unique.length} media file${unique.length === 1 ? '' : 's'} added to Project Files. Select a timeline line, then click a file to place it there.`;
    }

    function clearProject() {
        engine.clearAll();
        state.files = [];
        state.selectedFileIndex = -1;
        state.tracks = createDefaultTracks();
        state.selectedTrackId = null;
        refreshTimelineAndInspector();
        elements.previewEmpty.classList.remove('hidden');
        elements.previewState.textContent = 'No media loaded';
        elements.projectSummary.textContent = 'Project cleared. Basic Mode remains untouched.';
        renderFiles();
    }

    function nextOrder(type) {
        return Math.max(0, ...state.tracks.filter((track) => track.type === type).map((track) => track.order)) + 1;
    }

    function addLayer(type, selectNew = true) {
        const order = nextOrder(type);
        const track = createTrack(type, order);
        state.tracks.push(track);
        if (selectNew) state.selectedTrackId = track.id;
        refreshTimelineAndInspector();
        return track;
    }

    function addVideoLayerWithLinkedAudio() {
        const videoOrder = nextOrder('video');
        const audioOrder = nextOrder('embedded-audio');
        const audioTrack = createTrack('embedded-audio', audioOrder, { linkedVideoId: `video-${videoOrder}` });
        const videoTrack = createTrack('video', videoOrder, { audioControlId: audioTrack.id });
        state.tracks.push(videoTrack, audioTrack);
        state.selectedTrackId = videoTrack.id;
        refreshTimelineAndInspector();
        elements.projectSummary.textContent = `${videoTrack.label} and its linked ${audioTrack.label} were added.`;
    }

    function openContextMenu(trackId, clientX, clientY) {
        const track = getTrack(trackId);
        if (!track) return;
        selectTrack(trackId);
        state.contextTrackId = trackId;
        const typeName = track.type === 'embedded-audio' ? 'Video Audio' : track.type === 'external-audio' ? 'External Audio' : track.type === 'sticker' ? 'Sticker' : 'Video + linked audio';
        elements.contextMenuTitle.textContent = `${track.label} options`;
        elements.contextAddLayer.textContent = `Add another ${typeName} layer`;
        elements.contextRemoveLayer.disabled = Boolean(track.sourceName) || state.tracks.filter((item) => item.type === track.type).length <= 1;
        elements.contextMenu.hidden = false;
        elements.contextMenu.setAttribute('aria-hidden', 'false');
        const rect = elements.contextMenu.getBoundingClientRect();
        elements.contextMenu.style.left = `${Math.max(8, Math.min(clientX, window.innerWidth - rect.width - 8))}px`;
        elements.contextMenu.style.top = `${Math.max(8, Math.min(clientY, window.innerHeight - rect.height - 8))}px`;
    }

    function hideContextMenu() {
        elements.contextMenu.hidden = true;
        elements.contextMenu.setAttribute('aria-hidden', 'true');
        state.contextTrackId = null;
    }

    function handleAddLayerFromContext() {
        const track = getTrack(state.contextTrackId);
        if (!track) return;
        if (track.type === 'video') addVideoLayerWithLinkedAudio(); else addLayer(track.type);
        hideContextMenu();
    }

    function handleRemoveLayerFromContext() {
        const track = getTrack(state.contextTrackId);
        if (!track || track.sourceName || state.tracks.filter((item) => item.type === track.type).length <= 1) return;
        state.tracks = state.tracks.filter((item) => item.id !== track.id);
        state.selectedTrackId = null;
        refreshTimelineAndInspector();
        elements.projectSummary.textContent = `${track.label} removed.`;
        hideContextMenu();
    }

    async function togglePlay() {
        try {
            const isPlaying = await engine.togglePlay();
            elements.previewState.textContent = isPlaying ? 'Playing Advanced Mode preview' : 'Preview paused';
        } catch (error) {
            elements.projectSummary.textContent = error.message;
        }
    }

    async function snapshot() {
        try {
            await engine.snapshot();
            elements.previewState.textContent = 'Composite PNG downloaded';
        } catch (error) {
            elements.projectSummary.textContent = error.message;
        }
    }

    function installPreviewResize() {
        let resizeState = null;
        const constrain = (width, height) => ({
            width: Math.min(Math.max(300, width), Math.max(300, elements.previewStage.parentElement.clientWidth)),
            height: Math.min(Math.max(169, height), Math.max(220, Math.min(840, window.innerHeight * .82)))
        });
        const applySize = (width, height) => {
            const constrained = constrain(width, height);
            elements.previewStage.style.width = `${Math.round(constrained.width)}px`;
            elements.previewStage.style.height = `${Math.round(constrained.height)}px`;
            elements.previewStage.style.aspectRatio = 'auto';
        };
        elements.previewResizeHandle.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            const rect = elements.previewStage.getBoundingClientRect();
            resizeState = { pointerId:event.pointerId, startX:event.clientX, startY:event.clientY, width:rect.width, height:rect.height };
            elements.previewResizeHandle.setPointerCapture(event.pointerId);
        });
        elements.previewResizeHandle.addEventListener('pointermove', (event) => {
            if (!resizeState || resizeState.pointerId !== event.pointerId) return;
            applySize(resizeState.width + event.clientX - resizeState.startX, resizeState.height + event.clientY - resizeState.startY);
        });
        const finish = (event) => {
            if (!resizeState || resizeState.pointerId !== event.pointerId) return;
            if (elements.previewResizeHandle.hasPointerCapture(event.pointerId)) elements.previewResizeHandle.releasePointerCapture(event.pointerId);
            resizeState = null;
        };
        elements.previewResizeHandle.addEventListener('pointerup', finish);
        elements.previewResizeHandle.addEventListener('pointercancel', finish);
    }

    function hasFiles(event) {
        const transfer = event?.dataTransfer;
        if (!transfer) return false;
        const types = Array.from(transfer.types || []);
        return types.includes('Files') || Array.from(transfer.items || []).some((item) => item.kind === 'file');
    }

    function getDroppedFiles(transfer) {
        if (!transfer) return [];
        const files = Array.from(transfer.files || []).filter(Boolean);
        if (files.length) return files;
        return Array.from(transfer.items || [])
            .filter((item) => item.kind === 'file')
            .map((item) => item.getAsFile())
            .filter(Boolean);
    }

    function setDropState(active) {
        document.body.classList.toggle('file-drag-active', active);
        elements.dropOverlay.setAttribute('aria-hidden', String(!active));
        elements.projectDropZone?.classList.toggle('drop-target-active', active);
    }

    function importDroppedMedia(event) {
        if (!hasFiles(event)) return false;
        event.preventDefault();
        event.stopPropagation();
        const files = getDroppedFiles(event.dataTransfer);
        state.dragDepth = 0;
        setDropState(false);
        if (!files.length) {
            elements.projectSummary.textContent = 'The browser did not provide any readable files. Use ➕ Import as a fallback.';
            return true;
        }
        importFiles(files, `${files.length} dropped file${files.length === 1 ? '' : 's'} added to Project Files.`);
        return true;
    }

    function installGlobalFileDrop() {
        // Capture-phase document listeners stop the browser navigating to a dropped local file.
        // They also work whether the pointer is over the project bin, canvas, timeline or Inspector.
        document.addEventListener('dragenter', (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            state.dragDepth += 1;
            setDropState(true);
        }, true);

        document.addEventListener('dragover', (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setDropState(true);
        }, true);

        document.addEventListener('dragleave', (event) => {
            if (!hasFiles(event)) return;
            state.dragDepth = Math.max(0, state.dragDepth - 1);
            if (state.dragDepth === 0) setDropState(false);
        }, true);

        document.addEventListener('drop', importDroppedMedia, true);
        window.addEventListener('dragend', () => {
            state.dragDepth = 0;
            setDropState(false);
        });

        // The visible project-bin pad is also a click/keyboard fallback for browsers that do not
        // pass OS drag events into a nested iframe consistently.
        elements.projectDropZone?.addEventListener('click', () => elements.fileInput.click());
        elements.projectDropZone?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                elements.fileInput.click();
            }
        });
    }

    document.getElementById('btn-basic-mode').addEventListener('click', () => { window.location.href = './index.html'; });
    document.getElementById('btn-browse-folder').addEventListener('click', browseFolder);
    document.getElementById('btn-import-files').addEventListener('click', () => elements.fileInput.click());
    document.getElementById('btn-clear-files').addEventListener('click', clearProject);
    elements.fileInput.addEventListener('change', (event) => { importFiles(event.target.files); event.target.value = ''; });

    elements.btnPlay.addEventListener('click', togglePlay);
    elements.btnStepBack.addEventListener('click', () => engine.stepFrame(-1));
    elements.btnStepForward.addEventListener('click', () => engine.stepFrame(1));
    elements.btnSnapshot.addEventListener('click', snapshot);
    elements.btnPreviewMute.addEventListener('click', () => { engine.togglePreviewMute(); setPreviewMuteButton(); });
    elements.previewVolume.addEventListener('input', (event) => { engine.setPreviewVolume(Number(event.target.value) / 100); setPreviewMuteButton(); });
    elements.previewSeek.addEventListener('pointerdown', () => { state.isSeeking = true; });
    elements.previewSeek.addEventListener('input', (event) => engine.seek(Number(event.target.value)));
    elements.previewSeek.addEventListener('change', (event) => { state.isSeeking = false; engine.seek(Number(event.target.value)); });

    elements.visualVisibleSwitch.addEventListener('click', () => {
        const track = getTrack();
        if (!track || !['video', 'sticker'].includes(track.type)) return;
        track.visible = !track.visible;
        refreshTimelineAndInspector();
    });
    elements.layerBlendMode.addEventListener('change', () => {
        const track = getTrack();
        if (!track || !['video', 'sticker'].includes(track.type)) return;
        track.blendMode = elements.layerBlendMode.value;
        refreshTimelineAndInspector();
    });
    elements.btnSelectLinkedAudio.addEventListener('click', () => {
        const video = getTrack();
        if (video?.type === 'video' && getTrack(video.audioControlId)) selectTrack(video.audioControlId);
    });
    elements.audioAuditionSwitch.addEventListener('click', () => {
        const track = getTrack();
        if (!track || !['embedded-audio', 'external-audio'].includes(track.type)) return;
        track.audio.muted = !track.audio.muted;
        refreshTimelineAndInspector();
    });
    elements.audioTrackVolume.addEventListener('input', () => {
        const track = getTrack();
        if (!track || !['embedded-audio', 'external-audio'].includes(track.type)) return;
        track.audio.volume = Number(elements.audioTrackVolume.value) / 100;
        elements.audioTrackVolumeValue.textContent = `${elements.audioTrackVolume.value}%`;
        engine.setTracks(state.tracks);
    });
    elements.stickerTransparencyMode.addEventListener('change', () => {
        const track = getTrack();
        if (track?.type !== 'sticker') return;
        track.transparency.mode = elements.stickerTransparencyMode.value;
        engine.renderFrame();
    });
    elements.stickerKeyColour.addEventListener('input', () => {
        const track = getTrack();
        if (track?.type !== 'sticker') return;
        track.transparency.keyColour = elements.stickerKeyColour.value;
        elements.stickerKeyColourText.value = track.transparency.keyColour;
        engine.renderFrame();
    });
    elements.stickerKeyColourText.addEventListener('change', () => {
        const track = getTrack();
        if (track?.type !== 'sticker') return;
        const value = elements.stickerKeyColourText.value.trim();
        const colour = /^#[0-9a-f]{6}$/i.test(value) ? value : '#00ff00';
        track.transparency.keyColour = colour;
        elements.stickerKeyColour.value = colour;
        elements.stickerKeyColourText.value = colour;
        engine.renderFrame();
    });
    elements.stickerKeyTolerance.addEventListener('input', () => {
        const track = getTrack();
        if (track?.type !== 'sticker') return;
        track.transparency.tolerance = Number(elements.stickerKeyTolerance.value);
        elements.stickerKeyToleranceValue.textContent = `${track.transparency.tolerance}%`;
        engine.renderFrame();
    });
    elements.stickerEdgeFeather.addEventListener('input', () => {
        const track = getTrack();
        if (track?.type !== 'sticker') return;
        track.transparency.feather = Number(elements.stickerEdgeFeather.value);
        elements.stickerEdgeFeatherValue.textContent = `${track.transparency.feather}%`;
        engine.renderFrame();
    });

    elements.contextAddLayer.addEventListener('click', handleAddLayerFromContext);
    elements.contextRemoveLayer.addEventListener('click', handleRemoveLayerFromContext);
    document.addEventListener('click', (event) => { if (!elements.contextMenu.contains(event.target)) hideContextMenu(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideContextMenu(); });
    window.addEventListener('beforeunload', () => engine.destroy());
    setPreviewMuteButton();
})();
