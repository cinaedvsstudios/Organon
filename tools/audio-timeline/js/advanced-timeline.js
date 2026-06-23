/**
 * ORGANON STUDIO: ADVANCED TIMELINE VIEW
 * v0.14 — pixel-based timeline scale, stable clip resizing, zoom/reset controls and type-coloured lane labels.
 */

const GROUP_ORDER = ['sticker', 'video', 'audio', 'background'];
const TYPE_DEFAULTS = {
    sticker: { label: 'Sticker', subLabel: 'top visual overlay', placeholder: 'Drop a GIF / WebP / PNG here', className: 'sticker' },
    video: { label: 'Video', subLabel: 'visual clip + linked sound', placeholder: 'Drop a video here', className: 'video' },
    audio: { label: 'Audio', subLabel: 'voice / music', placeholder: 'Drop an audio file here', className: 'audio' },
    background: { label: 'Background', subLabel: 'JPEG image — bottom layer', placeholder: 'Drop a JPEG background here', className: 'background' }
};

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export class AdvancedTimeline {
    constructor({ lanesElement, rulerElement, emptyElement, onSelect, onContextMenu, onDropProjectFile, onTrackChange, onSeek }) {
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
        this.onSeek = onSeek;
        this.tracks = [];
        this.selectedTrackId = null;
        this.duration = 6;
        this.currentTime = 0;
        this.dragState = null;
        this.activeProjectFileId = '';
        this.zoom = 1;
        this.basePixelsPerSecond = 10;
        this.pixelsPerSecond = this.basePixelsPerSecond;
        this.viewDuration = 6;
        this.labelWidth = 150;
        this.minimumWorkspaceWidth = 630;
        this.installEmptyDropTarget();
        this.installTimelinePanelDropTarget();
    }

    beginProjectFileDrag(fileId) { this.activeProjectFileId = String(fileId || ''); }
    endProjectFileDrag() { this.activeProjectFileId = ''; }

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

    getTimelineDropStart(event) {
        const workspace = event.target.closest?.('.lane-workspace');
        const target = workspace || this.lanesElement;
        const rect = target?.getBoundingClientRect();
        if (!rect) return 0;
        const workspaceLeft = workspace ? rect.left : rect.left + this.labelWidth;
        return clamp((event.clientX - workspaceLeft) / this.pixelsPerSecond, 0, this.getViewDuration());
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
            this.onDropProjectFile?.({ fileId, trackId: null, start: 0 });
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
            this.onDropProjectFile?.({ fileId, trackId: null, start: this.getTimelineDropStart(event) });
            this.endProjectFileDrag();
        });
    }

    setTracks(tracks) {
        this.tracks = Array.isArray(tracks) ? tracks : [];
        this.ensureViewportForTime(this.getTrackEndTime(), true);
        this.render();
    }

    setSelectedTrack(trackId) {
        this.selectedTrackId = trackId;
        this.applySelectionState();
    }

    setDuration(duration) {
        this.duration = Math.max(6, Number(duration) || 0);
        this.ensureViewportForTime(this.duration, true);
        this.render();
    }

    setCurrentTime(time) {
        this.currentTime = Math.max(0, Number(time) || 0);
        const left = `${Math.max(0, this.currentTime * this.pixelsPerSecond)}px`;
        this.lanesElement?.querySelectorAll('.playhead').forEach((playhead) => { playhead.style.left = left; });
    }

    getDisplayTracks() {
        return [...this.tracks].sort((a, b) => {
            const groupDifference = GROUP_ORDER.indexOf(a.type) - GROUP_ORDER.indexOf(b.type);
            if (groupDifference !== 0) return groupDifference;
            return Number(a.order) - Number(b.order);
        });
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

    updateClipStyle(clip, track) {
        clip.style.left = `${Math.max(0, (Number(track.start) || 0) * this.pixelsPerSecond)}px`;
        clip.style.width = `${Math.max(26, this.getClipDuration(track) * this.pixelsPerSecond)}px`;
    }

    applySelectionState() {
        this.lanesElement?.querySelectorAll('.timeline-lane').forEach((lane) => lane.classList.toggle('selected', lane.dataset.trackId === this.selectedTrackId));
        this.lanesElement?.querySelectorAll('.timeline-clip').forEach((clip) => clip.classList.toggle('selected', clip.dataset.trackId === this.selectedTrackId));
    }

    render() {
        if (!this.lanesElement || !this.rulerElement) return;
        this.updateLayoutMetrics();
        const tracks = this.getDisplayTracks();
        this.lanesElement.innerHTML = '';
        if (this.emptyElement) this.emptyElement.hidden = tracks.length > 0;

        for (const track of tracks) {
            const defaults = TYPE_DEFAULTS[track.type] || TYPE_DEFAULTS.video;
            const lane = document.createElement('div');
            lane.className = `timeline-lane ${defaults.className}${track.id === this.selectedTrackId ? ' selected' : ''}`;
            lane.dataset.trackId = track.id;

            const label = document.createElement('div');
            label.className = 'lane-name';
            const subLabel = track.type === 'sticker'
                ? (track.order === 1 ? 'top visual layer' : `below Sticker ${track.order - 1}`)
                : (track.type === 'video'
                    ? 'visual clip + linked sound'
                    : (track.type === 'background'
                        ? 'JPEG image — beneath audio'
                        : (track.extractedFrom ? 'extracted video audio' : defaults.subLabel)));
            label.innerHTML = `<span>${escapeHtml(track.label || `${defaults.label} ${track.order}`)}</span><small>${escapeHtml(subLabel)}</small>`;

            const workspace = document.createElement('div');
            workspace.className = 'lane-workspace';
            workspace.dataset.trackId = track.id;
            this.installWorkspaceEvents(workspace, track);

            const playhead = document.createElement('div');
            playhead.className = 'playhead';
            playhead.style.left = `${Math.max(0, this.currentTime * this.pixelsPerSecond)}px`;
            workspace.appendChild(playhead);

            const clip = document.createElement('div');
            const hasSource = Boolean(track.sourceName);
            clip.className = `timeline-clip ${defaults.className}${hasSource ? '' : ' placeholder'}${track.id === this.selectedTrackId ? ' selected' : ''}`;
            clip.dataset.trackId = track.id;
            this.updateClipStyle(clip, track);

            const clipLabel = document.createElement('span');
            clipLabel.className = 'clip-label';
            clipLabel.textContent = hasSource ? track.sourceName : defaults.placeholder;
            clip.appendChild(clipLabel);
            if (hasSource) {
                const resizeHandle = document.createElement('span');
                resizeHandle.className = 'clip-resize-handle';
                resizeHandle.title = 'Drag to trim or extend this clip';
                clip.appendChild(resizeHandle);
                this.installClipDrag(clip, workspace, track, resizeHandle);
            }
            workspace.appendChild(clip);
            lane.append(label, workspace);
            lane.addEventListener('click', () => this.onSelect?.(track.id));
            lane.addEventListener('contextmenu', (event) => { event.preventDefault(); this.onContextMenu?.(track.id, event.clientX, event.clientY); });
            this.lanesElement.appendChild(lane);
        }
        this.renderRuler();
    }

    installWorkspaceEvents(workspace, track) {
        workspace.addEventListener('dragover', (event) => {
            if (!this.isProjectFileDrag(event)) return;
            event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; workspace.classList.add('drop-target-active');
        });
        workspace.addEventListener('dragleave', (event) => { if (!workspace.contains(event.relatedTarget)) workspace.classList.remove('drop-target-active'); });
        workspace.addEventListener('drop', (event) => {
            const fileId = this.getProjectFileId(event);
            if (!fileId) return;
            event.preventDefault(); event.stopPropagation(); workspace.classList.remove('drop-target-active');
            const rect = workspace.getBoundingClientRect();
            const start = clamp((event.clientX - rect.left) / this.pixelsPerSecond, 0, this.getViewDuration());
            this.onDropProjectFile?.({ fileId, trackId: track.id, start });
            this.endProjectFileDrag();
        });
        workspace.addEventListener('pointerdown', (event) => {
            if (event.target.closest('.timeline-clip')) return;
            const rect = workspace.getBoundingClientRect();
            const time = clamp((event.clientX - rect.left) / this.pixelsPerSecond, 0, this.getViewDuration());
            this.onSelect?.(track.id); this.onSeek?.(time);
        });
    }

    installClipDrag(clip, workspace, track, resizeHandle) {
        const stop = (event) => {
            const drag = this.dragState;
            if (!drag || drag.pointerId !== event.pointerId || drag.track.id !== track.id) return;
            try { clip.releasePointerCapture?.(event.pointerId); } catch (_) { /* no-op */ }
            this.dragState = null;
            clip.classList.remove('is-dragging');
            this.onTrackChange?.(track, { live: false });
            this.render();
        };

        clip.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault(); event.stopPropagation();
            const mode = event.target === resizeHandle || event.target.closest('.clip-resize-handle') ? 'resize' : 'move';
            this.onSelect?.(track.id);
            this.dragState = {
                mode,
                track,
                workspace,
                pointerId: event.pointerId,
                startX: event.clientX,
                originalStart: Number(track.start) || 0,
                originalDuration: this.getClipDuration(track)
            };
            clip.classList.add('is-dragging');
            clip.setPointerCapture?.(event.pointerId);
        });

        clip.addEventListener('pointermove', (event) => {
            const drag = this.dragState;
            if (!drag || drag.pointerId !== event.pointerId || drag.track.id !== track.id) return;
            const deltaSeconds = (event.clientX - drag.startX) / this.pixelsPerSecond;
            if (drag.mode === 'move') {
                track.start = clamp(drag.originalStart + deltaSeconds, 0, 36000);
            } else {
                const sourceLimit = (track.type === 'sticker' || track.type === 'background') ? 300 : Math.max(.15, Number(track.sourceDuration) || drag.originalDuration);
                track.clipDuration = clamp(drag.originalDuration + deltaSeconds, .15, sourceLimit);
            }
            this.ensureViewportForTime((Number(track.start) || 0) + this.getClipDuration(track));
            this.updateLayoutMetrics();
            this.updateClipStyle(clip, track);
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
            this.rulerElement.insertAdjacentHTML('beforeend', `<span>${second}s</span>`);
        }
    }
}
