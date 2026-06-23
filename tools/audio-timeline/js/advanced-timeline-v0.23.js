/**
 * ORGANON STUDIO: ADVANCED TIMELINE VIEW
 * v0.23 — source-pixel peak strips. Trimming is a real crop: peak positions never scale.
 * Resizing a clip changes only sourceOut / clipDuration; playback remains 1× speed.
 */

const GROUP_ORDER = ['sticker', 'video', 'audio', 'background'];
const TYPE_DEFAULTS = {
    sticker: { label: 'Sticker', subLabel: 'top visual overlay', placeholder: 'Drop a GIF / WebP / PNG here', className: 'sticker' },
    video: { label: 'Video', subLabel: 'visual clip + linked sound', placeholder: 'Drop a video here', className: 'video' },
    audio: { label: 'Audio', subLabel: 'voice / music', placeholder: 'Drop an audio file here', className: 'audio' },
    background: { label: 'Background', subLabel: 'JPEG image — bottom layer', placeholder: 'Drop a JPEG background here', className: 'background' }
};

const TYPE_RGB = {
    video: [75, 132, 191],
    audio: [154, 47, 79],
    sticker: [224, 163, 96],
    background: [224, 163, 96]
};

const TYPE_CSS_COLOUR = {
    video: 'rgb(75 132 191)',
    audio: 'rgb(154 47 79)',
    sticker: 'rgb(224 163 96)',
    background: 'rgb(224 163 96)'
};

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function cssEscape(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

export class AdvancedTimeline {
    constructor({ lanesElement, rulerElement, emptyElement, onSelect, onContextMenu, onDropProjectFile, onTrackChange, onTrackInteractionStart, onSeek, onSplitAtPlayhead }) {
        this.lanesElement = lanesElement;
        this.rulerElement = rulerElement;
        this.emptyElement = emptyElement;
        this.innerElement = this.lanesElement?.closest('.timeline-inner') || null;
        this.scrollElement = this.lanesElement?.closest('.timeline-scroll') || null;
        this.panelElement = this.lanesElement?.closest('.timeline-panel') || null;
        this.onSelect = onSelect;
        this.onContextMenu = onContextMenu;
        this.onDropProjectFile = onDropProjectFile;
        this.onTrackChange = onTrackChange;
        this.onTrackInteractionStart = onTrackInteractionStart;
        this.onSeek = onSeek;
        this.onSplitAtPlayhead = onSplitAtPlayhead;
        this.tracks = [];
        this.selectedTrackIds = new Set();
        this.activeProjectFileId = '';
        this.dragState = null;
        this.selectionMode = false;
        this.duration = 6;
        this.currentTime = 0;
        this.zoom = 1;
        this.basePixelsPerSecond = 10;
        this.pixelsPerSecond = this.basePixelsPerSecond;
        this.viewDuration = 6;
        this.labelWidth = 150;
        this.minimumWorkspaceWidth = 630;
        this.installEmptyDropTarget();
        this.installTimelinePanelDropTarget();
        this.ensureMarkerLayer();
    }

    beginProjectFileDrag(fileId) { this.activeProjectFileId = String(fileId || ''); }
    endProjectFileDrag() { this.activeProjectFileId = ''; }
    setSelectionMode(enabled) { this.selectionMode = Boolean(enabled); }

    getProjectFileId(event) {
        const transfer = event.dataTransfer;
        const types = Array.from(transfer?.types || []);
        const hasProjectType = types.includes('application/x-organon-project-file') || types.includes('text/x-organon-project-file');
        let value = '';
        if (hasProjectType && transfer) {
            value = transfer.getData('application/x-organon-project-file') || transfer.getData('text/x-organon-project-file') || transfer.getData('text/plain');
        }
        return value || this.activeProjectFileId;
    }

    isProjectFileDrag(event) {
        const types = Array.from(event.dataTransfer?.types || []);
        return Boolean(this.activeProjectFileId || types.includes('application/x-organon-project-file') || types.includes('text/x-organon-project-file'));
    }

    setZoom(value) {
        this.zoom = clamp(Number(value) || 1, .25, 4);
        this.pixelsPerSecond = this.basePixelsPerSecond * this.zoom;
        this.render();
        return this.zoom;
    }

    resetZoom() {
        this.zoom = 1;
        this.pixelsPerSecond = this.basePixelsPerSecond;
        this.render();
        if (this.scrollElement) this.scrollElement.scrollLeft = 0;
        return this.zoom;
    }

    getZoomPercent() { return Math.round(this.zoom * 100); }

    setTracks(tracks) {
        this.tracks = Array.isArray(tracks) ? tracks : [];
        this.ensureViewportForTime(this.getTrackEndTime(), true);
        this.render();
    }

    setSelectedTrack(trackId) {
        this.setSelectedTrackIds(trackId ? [trackId] : []);
    }

    setSelectedTrackIds(trackIds) {
        this.selectedTrackIds = new Set(Array.from(trackIds || []).filter(Boolean));
        this.applySelectionState();
    }

    setDuration(duration) {
        this.duration = Math.max(0, Number(duration) || 0);
        this.ensureViewportForTime(this.duration, true);
        this.render();
    }

    setCurrentTime(time) {
        this.currentTime = Math.max(0, Number(time) || 0);
        this.updateMarkers();
    }

    getTrackById(trackId) { return this.tracks.find((track) => track.id === trackId) || null; }

    getClipDuration(track) {
        const duration = Number(track.clipDuration) || 0;
        if (duration > 0) return duration;
        return (track.type === 'sticker' || track.type === 'background') ? 3 : 1;
    }

    getTrackEndTime() {
        return this.tracks.reduce((latest, track) => Math.max(latest, (Number(track.start) || 0) + this.getClipDuration(track)), 0);
    }

    getCompositionEndTime() { return Math.max(0, this.getTrackEndTime()); }

    getLatestEndingTrack() {
        let latest = null;
        let latestEnd = -Infinity;
        for (const track of this.tracks) {
            if (!track?.sourceName) continue;
            const end = (Number(track.start) || 0) + this.getClipDuration(track);
            if (end > latestEnd) {
                latest = track;
                latestEnd = end;
            }
        }
        return latest;
    }

    getViewDuration() {
        return Math.max(6, this.viewDuration, this.duration + 2, this.getTrackEndTime() + 2);
    }

    ensureViewportForTime(time, allowShrink = false) {
        const desired = Math.max(6, Math.ceil((Number(time) || 0) + 2));
        if (allowShrink) this.viewDuration = desired;
        else this.viewDuration = Math.max(this.viewDuration, desired);
        return this.viewDuration;
    }

    getWorkspaceWidth() {
        return Math.max(this.minimumWorkspaceWidth, Math.ceil(this.getViewDuration() * this.pixelsPerSecond));
    }

    updateLayoutMetrics() {
        if (!this.innerElement) return;
        const workspaceWidth = this.getWorkspaceWidth();
        const totalWidth = this.labelWidth + workspaceWidth;
        this.innerElement.style.setProperty('--lane-label-width', `${this.labelWidth}px`);
        this.innerElement.style.setProperty('--timeline-workspace-width', `${workspaceWidth}px`);
        this.innerElement.style.setProperty('--timeline-total-width', `${totalWidth}px`);
        this.innerElement.style.setProperty('--timeline-grid-step', `${Math.max(1, this.pixelsPerSecond)}px`);
    }

    getDisplayLanes() {
        const lanes = new Map();
        for (const track of this.tracks) {
            const laneId = track.laneId || track.id;
            if (!lanes.has(laneId)) {
                lanes.set(laneId, {
                    id: laneId,
                    type: track.type,
                    order: Number(track.order) || 0,
                    label: track.laneLabel || track.label,
                    tracks: []
                });
            }
            lanes.get(laneId).tracks.push(track);
        }
        return [...lanes.values()]
            .sort((a, b) => {
                const groupDifference = GROUP_ORDER.indexOf(a.type) - GROUP_ORDER.indexOf(b.type);
                return groupDifference || a.order - b.order;
            })
            .map((lane) => ({ ...lane, tracks: lane.tracks.sort((a, b) => (Number(a.start) || 0) - (Number(b.start) || 0)) }));
    }

    getWorkspaceTime(event, workspace) {
        const rect = workspace.getBoundingClientRect();
        return clamp((event.clientX - rect.left) / this.pixelsPerSecond, 0, this.getViewDuration());
    }

    getTimelineDropStart(event) {
        const workspace = event.target.closest?.('.lane-workspace');
        if (workspace) return this.getWorkspaceTime(event, workspace);
        const rect = this.innerElement?.getBoundingClientRect();
        if (!rect) return 0;
        return clamp((event.clientX - rect.left - this.labelWidth) / this.pixelsPerSecond, 0, this.getViewDuration());
    }

    clearProjectFileDropHighlights() {
        this.panelElement?.classList.remove('drop-target-active');
        this.emptyElement?.classList.remove('drop-target-active');
        this.lanesElement?.querySelectorAll('.lane-workspace.drop-target-active').forEach((workspace) => workspace.classList.remove('drop-target-active'));
    }

    getProjectFileDropTargetAtPoint(clientX, clientY) {
        const target = document.elementFromPoint(clientX, clientY);
        if (!target) return null;
        const workspace = target.closest?.('.lane-workspace');
        if (workspace) {
            return {
                laneId: workspace.dataset.laneId || null,
                laneType: workspace.dataset.laneType || null,
                start: this.getWorkspaceTime({ clientX }, workspace),
                highlight: workspace
            };
        }
        if (target.closest?.('.timeline-empty')) {
            return { laneId: null, laneType: null, start: 0, highlight: this.emptyElement };
        }
        const panel = target.closest?.('.timeline-panel');
        if (panel) {
            const rect = this.innerElement?.getBoundingClientRect();
            const start = rect
                ? clamp((clientX - rect.left - this.labelWidth) / this.pixelsPerSecond, 0, this.getViewDuration())
                : 0;
            return { laneId: null, laneType: null, start, highlight: this.panelElement };
        }
        return null;
    }

    updateProjectFilePointerDropHover(clientX, clientY) {
        this.clearProjectFileDropHighlights();
        const target = this.getProjectFileDropTargetAtPoint(clientX, clientY);
        target?.highlight?.classList.add('drop-target-active');
        return Boolean(target);
    }

    dropProjectFileAtPoint(fileId, clientX, clientY) {
        const target = this.getProjectFileDropTargetAtPoint(clientX, clientY);
        this.clearProjectFileDropHighlights();
        if (!fileId || !target) return false;
        this.onDropProjectFile?.({
            fileId,
            laneId: target.laneId,
            laneType: target.laneType,
            start: target.start
        });
        this.endProjectFileDrag();
        return true;
    }

    installEmptyDropTarget() {
        if (!this.emptyElement) return;
        this.emptyElement.addEventListener('dragover', (event) => {
            if (!this.isProjectFileDrag(event)) return;
            event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy';
            this.emptyElement.classList.add('drop-target-active');
        });
        this.emptyElement.addEventListener('dragleave', () => this.emptyElement.classList.remove('drop-target-active'));
        this.emptyElement.addEventListener('drop', (event) => {
            const fileId = this.getProjectFileId(event);
            if (!fileId) return;
            event.preventDefault(); event.stopPropagation(); this.emptyElement.classList.remove('drop-target-active');
            this.onDropProjectFile?.({ fileId, laneId: null, laneType: null, start: 0 });
            this.endProjectFileDrag();
        });
    }

    installTimelinePanelDropTarget() {
        if (!this.panelElement) return;
        this.panelElement.addEventListener('dragover', (event) => {
            if (!this.isProjectFileDrag(event)) return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; this.panelElement.classList.add('drop-target-active');
        });
        this.panelElement.addEventListener('dragleave', (event) => {
            if (!this.panelElement.contains(event.relatedTarget)) this.panelElement.classList.remove('drop-target-active');
        });
        this.panelElement.addEventListener('drop', (event) => {
            const fileId = this.getProjectFileId(event);
            if (!fileId) return;
            if (event.target.closest?.('.lane-workspace') || event.target.closest?.('.timeline-empty')) return;
            event.preventDefault(); this.panelElement.classList.remove('drop-target-active');
            this.onDropProjectFile?.({ fileId, laneId: null, laneType: null, start: this.getTimelineDropStart(event) });
            this.endProjectFileDrag();
        });
    }

    ensureMarkerLayer() {
        if (!this.innerElement || this.markerLayer) return;
        this.markerLayer = document.createElement('div');
        this.markerLayer.className = 'timeline-marker-layer';
        this.endMarker = document.createElement('div');
        this.endMarker.className = 'timeline-end-marker';
        this.endMarker.innerHTML = '<span></span>';
        this.playheadMarker = document.createElement('div');
        this.playheadMarker.className = 'timeline-playhead-marker';
        this.markerLayer.append(this.endMarker, this.playheadMarker);
        this.innerElement.appendChild(this.markerLayer);
    }

    updateMarkers() {
        this.ensureMarkerLayer();
        if (!this.markerLayer) return;
        const currentLeft = this.labelWidth + Math.max(0, this.currentTime * this.pixelsPerSecond);
        const end = this.getCompositionEndTime();
        const endLeft = this.labelWidth + Math.max(0, end * this.pixelsPerSecond);
        const endingTrack = this.getLatestEndingTrack();
        this.playheadMarker.style.left = `${currentLeft}px`;
        this.endMarker.style.left = `${endLeft}px`;
        this.endMarker.style.setProperty('--end-marker-colour', TYPE_CSS_COLOUR[endingTrack?.type] || TYPE_CSS_COLOUR.sticker);
        this.endMarker.hidden = end <= 0;
        const label = this.endMarker.querySelector('span');
        if (label) label.textContent = `END ${this.formatTime(end)}`;
    }

    formatTime(seconds) {
        const safe = Math.max(0, Number(seconds) || 0);
        const mins = Math.floor(safe / 60);
        return `${mins}:${Math.floor(safe % 60).toString().padStart(2, '0')}`;
    }

    getAnalysisStyleSignature(track) {
        const levels = Array.isArray(track.analysis?.levels) ? track.analysis.levels : [];
        return [
            track.type,
            levels.length,
            Number(track.sourceDuration) || 0,
            this.pixelsPerSecond
        ].join('|');
    }

    updateClipAnalysisStrip(clip, track) {
        const levels = Array.isArray(track.analysis?.levels) ? track.analysis.levels : [];
        let viewport = clip.querySelector('.clip-analysis-viewport');
        if (!viewport) {
            viewport = document.createElement('span');
            viewport.className = 'clip-analysis-viewport';
            const strip = document.createElement('span');
            strip.className = 'clip-analysis-strip';
            viewport.appendChild(strip);
            clip.prepend(viewport);
        }
        const strip = viewport.firstElementChild;
        if (!strip) return;

        if (!levels.length || (track.type !== 'audio' && track.type !== 'video')) {
            viewport.hidden = true;
            return;
        }
        viewport.hidden = false;

        const sourceDuration = Math.max(.001, Number(track.sourceDuration) || this.getClipDuration(track));
        const sourceOffset = clamp(Number(track.sourceOffset) || 0, 0, sourceDuration);
        const signature = this.getAnalysisStyleSignature(track);
        const fullSourceWidth = Math.max(1, sourceDuration * this.pixelsPerSecond);

        // Rebuild only if the source analysis or timeline zoom changed. Right-edge
        // trimming changes the viewport width automatically; it does not scale or
        // recompute the strip, which is the essential crop behaviour.
        if (strip.dataset.signature !== signature) {
            strip.dataset.signature = signature;
            strip.replaceChildren();
            const rgb = TYPE_RGB[track.type] || TYPE_RGB.video;
            const segmentDuration = sourceDuration / levels.length;
            for (let index = 0; index < levels.length; index += 1) {
                const level = clamp(Number(levels[index]) || 0, 0, 1);
                const segment = document.createElement('span');
                segment.className = 'clip-analysis-segment';
                segment.style.left = `${index * segmentDuration * this.pixelsPerSecond}px`;
                segment.style.width = `${Math.max(1, segmentDuration * this.pixelsPerSecond + .6)}px`;
                // Quiet material stays subtle. Loud peaks brighten in their exact
                // original source position, rather than being percentage-mapped into
                // whatever width the user has trimmed the clip to.
                const alpha = (.06 + level * .72).toFixed(3);
                segment.style.setProperty('--analysis-colour', `rgba(${rgb.join(',')},${alpha})`);
                strip.appendChild(segment);
            }
        }
        strip.style.width = `${fullSourceWidth}px`;
        strip.style.transform = `translateX(${-sourceOffset * this.pixelsPerSecond}px)`;
    }

    updateClipStyle(clip, track) {
        clip.style.left = `${Math.max(0, (Number(track.start) || 0) * this.pixelsPerSecond)}px`;
        clip.style.width = `${Math.max(26, this.getClipDuration(track) * this.pixelsPerSecond)}px`;
        clip.style.setProperty('--clip-colour', TYPE_CSS_COLOUR[track.type] || TYPE_CSS_COLOUR.sticker);
        // Never set a percentage-based analysis gradient on the clip itself. That
        // would stretch every peak when the right edge is trimmed.
        clip.style.removeProperty('background-image');
        this.updateClipAnalysisStrip(clip, track);
    }

    applySelectionState() {
        this.lanesElement?.querySelectorAll('.timeline-lane').forEach((lane) => {
            const hasSelected = [...lane.querySelectorAll('.timeline-clip')].some((clip) => this.selectedTrackIds.has(clip.dataset.trackId));
            lane.classList.toggle('selected', hasSelected);
        });
        this.lanesElement?.querySelectorAll('.timeline-clip').forEach((clip) => {
            clip.classList.toggle('selected', this.selectedTrackIds.has(clip.dataset.trackId));
        });
    }

    render() {
        if (!this.lanesElement || !this.rulerElement) return;
        this.updateLayoutMetrics();
        const lanes = this.getDisplayLanes();
        this.lanesElement.innerHTML = '';
        if (this.emptyElement) this.emptyElement.hidden = lanes.length > 0;

        for (const laneModel of lanes) {
            const defaults = TYPE_DEFAULTS[laneModel.type] || TYPE_DEFAULTS.video;
            const lane = document.createElement('div');
            lane.className = `timeline-lane ${defaults.className}`;
            lane.dataset.laneId = laneModel.id;

            const label = document.createElement('div');
            label.className = 'lane-name';
            const subLabel = laneModel.type === 'sticker'
                ? (laneModel.order === 1 ? 'top visual layer' : `below Sticker ${laneModel.order - 1}`)
                : (laneModel.type === 'video' ? 'visual clip + linked sound' : (laneModel.type === 'background' ? 'JPEG image — beneath audio' : defaults.subLabel));
            label.innerHTML = `<span>${escapeHtml(laneModel.label || `${defaults.label} ${laneModel.order}`)}</span><small>${escapeHtml(subLabel)}</small>`;

            const workspace = document.createElement('div');
            workspace.className = 'lane-workspace';
            workspace.dataset.laneId = laneModel.id;
            workspace.dataset.laneType = laneModel.type;
            this.installWorkspaceEvents(workspace, laneModel);

            for (const track of laneModel.tracks) {
                const clip = document.createElement('div');
                const hasSource = Boolean(track.sourceName);
                clip.className = `timeline-clip ${defaults.className}${hasSource ? '' : ' placeholder'}${this.selectedTrackIds.has(track.id) ? ' selected' : ''}${track.groupId ? ' grouped' : ''}`;
                clip.dataset.trackId = track.id;
                this.updateClipStyle(clip, track);

                const clipLabel = document.createElement('span');
                clipLabel.className = 'clip-label';
                clipLabel.textContent = hasSource ? track.sourceName : defaults.placeholder;
                clip.appendChild(clipLabel);
                if (hasSource) {
                    const clipEndMarker = document.createElement('span');
                    clipEndMarker.className = 'clip-end-marker';
                    clipEndMarker.title = 'Clip end';
                    clip.appendChild(clipEndMarker);
                    const resizeHandle = document.createElement('span');
                    resizeHandle.className = 'clip-resize-handle';
                    resizeHandle.title = 'Drag to trim or extend this clip';
                    clip.appendChild(resizeHandle);
                    this.installClipDrag(clip, workspace, track, resizeHandle);
                    clip.addEventListener('contextmenu', (event) => {
                        event.preventDefault(); event.stopPropagation();
                        if (event.shiftKey) this.onContextMenu?.(track.id, event.clientX, event.clientY);
                        else this.onSplitAtPlayhead?.(track.id);
                    });
                }
                workspace.appendChild(clip);
            }

            lane.append(label, workspace);
            this.lanesElement.appendChild(lane);
        }
        this.renderRuler();
        this.updateMarkers();
        this.applySelectionState();
    }

    installWorkspaceEvents(workspace, laneModel) {
        workspace.addEventListener('dragover', (event) => {
            if (!this.isProjectFileDrag(event)) return;
            event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; workspace.classList.add('drop-target-active');
        });
        workspace.addEventListener('dragleave', (event) => { if (!workspace.contains(event.relatedTarget)) workspace.classList.remove('drop-target-active'); });
        workspace.addEventListener('drop', (event) => {
            const fileId = this.getProjectFileId(event);
            if (!fileId) return;
            event.preventDefault(); event.stopPropagation(); workspace.classList.remove('drop-target-active');
            this.onDropProjectFile?.({ fileId, laneId: laneModel.id, laneType: laneModel.type, start: this.getWorkspaceTime(event, workspace) });
            this.endProjectFileDrag();
        });
        workspace.addEventListener('pointerdown', (event) => {
            if (event.target.closest('.timeline-clip')) return;
            this.onSeek?.(this.getWorkspaceTime(event, workspace));
        });
        workspace.addEventListener('contextmenu', (event) => {
            if (event.target.closest('.timeline-clip')) return;
            event.preventDefault();
            const fallback = laneModel.tracks[0];
            if (fallback) this.onContextMenu?.(fallback.id, event.clientX, event.clientY);
        });
    }

    getGroupedDragTracks(track) {
        if (!track.groupId) return [track];
        return this.tracks.filter((candidate) => candidate.groupId === track.groupId);
    }

    updateLiveClipPositions(tracks) {
        for (const track of tracks) {
            const clip = this.lanesElement?.querySelector(`.timeline-clip[data-track-id="${cssEscape(track.id)}"]`);
            if (clip) this.updateClipStyle(clip, track);
        }
    }

    getVideoSnapResult(track, desiredStart, movingTracks = []) {
        if (track.type !== 'video') return { start: desiredStart, snapped: false };
        const movingIds = new Set(movingTracks.map((item) => item.id));
        const duration = this.getClipDuration(track);
        const threshold = Math.max(0.06, 10 / this.pixelsPerSecond);
        let best = { start: desiredStart, snapped: false, distance: Infinity };
        const candidatePoints = [0];
        for (const candidate of this.tracks) {
            if (candidate.type !== 'video' || !candidate.sourceName || movingIds.has(candidate.id)) continue;
            candidatePoints.push(Number(candidate.start) || 0, (Number(candidate.start) || 0) + this.getClipDuration(candidate));
        }
        for (const boundary of candidatePoints) {
            for (const movingBoundary of [desiredStart, desiredStart + duration]) {
                const delta = boundary - movingBoundary;
                const distance = Math.abs(delta);
                if (distance <= threshold && distance < best.distance) {
                    best = { start: Math.max(0, desiredStart + delta), snapped: true, distance };
                }
            }
        }
        return best;
    }

    installClipDrag(clip, workspace, track, resizeHandle) {
        const stop = (event) => {
            const drag = this.dragState;
            if (!drag || drag.pointerId !== event.pointerId || drag.track.id !== track.id) return;
            try { clip.releasePointerCapture?.(event.pointerId); } catch (_) { /* no-op */ }
            this.dragState = null;
            clip.classList.remove('is-dragging', 'is-snapping', 'is-trimming');
            this.onTrackChange?.(track, { live: false });
            this.render();
        };

        clip.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            const toggleSelection = this.selectionMode || event.ctrlKey || event.metaKey;
            if (toggleSelection) {
                event.preventDefault(); event.stopPropagation();
                this.onSelect?.(track.id, { toggle: true });
                return;
            }
            event.preventDefault(); event.stopPropagation();
            const mode = event.target === resizeHandle || event.target.closest('.clip-resize-handle') ? 'resize' : 'move';
            this.onSelect?.(track.id, { toggle: false });
            this.onTrackInteractionStart?.(track, { mode });
            const movingTracks = mode === 'move' ? this.getGroupedDragTracks(track) : [track];
            this.dragState = {
                mode,
                track,
                movingTracks,
                pointerId: event.pointerId,
                startX: event.clientX,
                originalDuration: this.getClipDuration(track),
                originalStarts: new Map(movingTracks.map((item) => [item.id, Number(item.start) || 0]))
            };
            clip.classList.add('is-dragging');
            clip.classList.toggle('is-trimming', mode === 'resize');
            clip.setPointerCapture?.(event.pointerId);
        });

        clip.addEventListener('pointermove', (event) => {
            const drag = this.dragState;
            if (!drag || drag.pointerId !== event.pointerId || drag.track.id !== track.id) return;
            const deltaSeconds = (event.clientX - drag.startX) / this.pixelsPerSecond;
            if (drag.mode === 'move') {
                const desiredStart = clamp((drag.originalStarts.get(track.id) || 0) + deltaSeconds, 0, 36000);
                const snap = this.getVideoSnapResult(track, desiredStart, drag.movingTracks);
                const effectiveDelta = snap.start - (drag.originalStarts.get(track.id) || 0);
                clip.classList.toggle('is-snapping', snap.snapped);
                for (const movingTrack of drag.movingTracks) {
                    movingTrack.start = clamp((drag.originalStarts.get(movingTrack.id) || 0) + effectiveDelta, 0, 36000);
                }
                this.ensureViewportForTime(Math.max(...drag.movingTracks.map((item) => (Number(item.start) || 0) + this.getClipDuration(item))));
                this.updateLayoutMetrics();
                this.updateLiveClipPositions(drag.movingTracks);
            } else {
                const sourceLimit = (track.type === 'sticker' || track.type === 'background') ? 300 : Math.max(.15, (Number(track.sourceDuration) || drag.originalDuration) - (Number(track.sourceOffset) || 0));
                // Right-edge resize is a trim/crop: sourceOffset stays fixed and only the source end moves.
                track.clipDuration = clamp(drag.originalDuration + deltaSeconds, .15, sourceLimit);
                this.ensureViewportForTime((Number(track.start) || 0) + this.getClipDuration(track));
                this.updateLayoutMetrics();
                this.updateClipStyle(clip, track);
            }
            this.updateMarkers();
            this.onTrackChange?.(track, { live: true });
        });
        clip.addEventListener('pointerup', stop);
        clip.addEventListener('pointercancel', stop);
        clip.addEventListener('lostpointercapture', stop);
    }

    getRulerStep() {
        if (this.pixelsPerSecond >= 20) return 1;
        if (this.pixelsPerSecond >= 8) return 2;
        if (this.pixelsPerSecond >= 4) return 5;
        return 10;
    }

    renderRuler() {
        const step = this.getRulerStep();
        const viewDuration = this.getViewDuration();
        const marks = Math.ceil(viewDuration / step);
        const cellWidth = Math.max(1, step * this.pixelsPerSecond);
        this.rulerElement.style.gridTemplateColumns = `${this.labelWidth}px repeat(${marks}, ${cellWidth}px)`;
        this.rulerElement.innerHTML = '<span class="ruler-spacer"></span>';
        for (let index = 0; index < marks; index += 1) {
            const second = Math.round(index * step);
            const mark = document.createElement('span');
            mark.textContent = `${second}s`;
            mark.dataset.time = String(second);
            this.rulerElement.appendChild(mark);
        }
        this.rulerElement.onpointerdown = (event) => {
            if (event.target.closest('.ruler-spacer')) return;
            const rect = this.rulerElement.getBoundingClientRect();
            const time = clamp((event.clientX - rect.left - this.labelWidth) / this.pixelsPerSecond, 0, this.getViewDuration());
            this.onSeek?.(time);
        };
    }
}
