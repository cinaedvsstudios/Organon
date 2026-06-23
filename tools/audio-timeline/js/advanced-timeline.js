/**
 * ORGANON STUDIO: ADVANCED TIMELINE VIEW
 * v0.12 — reliable Project Files-to-timeline dragging without browser drag-data read restrictions.
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
        // Browsers deliberately hide DataTransfer.getData() during dragover.
        // Keep the current Project File ID here as a safe fallback until drop.
        this.activeProjectFileId = '';
        this.installEmptyDropTarget();
        this.installTimelinePanelDropTarget();
    }

    beginProjectFileDrag(fileId) {
        this.activeProjectFileId = String(fileId || '');
    }

    endProjectFileDrag() {
        this.activeProjectFileId = '';
    }

    getProjectFileId(event) {
        const transfer = event.dataTransfer;
        const types = Array.from(transfer?.types || []);
        const hasProjectType = types.includes('application/x-organon-project-file') || types.includes('text/x-organon-project-file');

        // Reading drag data is reliable only during drop.  During dragover this
        // usually returns an empty string in Chromium, so the active fallback is
        // intentionally used there as well.
        let value = '';
        if (hasProjectType && transfer) {
            value = transfer.getData('application/x-organon-project-file')
                || transfer.getData('text/x-organon-project-file')
                || transfer.getData('text/plain');
        }

        return value || this.activeProjectFileId;
    }

    isProjectFileDrag(event) {
        const types = Array.from(event.dataTransfer?.types || []);
        return Boolean(
            this.activeProjectFileId
            || types.includes('application/x-organon-project-file')
            || types.includes('text/x-organon-project-file')
        );
    }

    getTimelineDropStart(event) {
        const workspace = event.target.closest?.('.lane-workspace');
        const target = workspace || this.lanesElement;
        const rect = target?.getBoundingClientRect();
        if (!rect) return 0;
        return clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * this.duration, 0, this.duration);
    }

    installEmptyDropTarget() {
        if (!this.emptyElement) return;
        this.emptyElement.addEventListener('dragover', (event) => {
            if (!this.isProjectFileDrag(event)) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect='copy';
            this.emptyElement.classList.add('drop-target-active');
        });
        this.emptyElement.addEventListener('dragleave', () => this.emptyElement.classList.remove('drop-target-active'));
        this.emptyElement.addEventListener('drop', (event) => {
            const fileId = this.getProjectFileId(event);
            if (!fileId) return;
            event.preventDefault();
            event.stopPropagation();
            this.emptyElement.classList.remove('drop-target-active');
            this.onDropProjectFile?.({ fileId, trackId: null, start: 0 });
            this.endProjectFileDrag();
        });
    }

    installTimelinePanelDropTarget() {
        if (!this.panelElement) return;
        this.panelElement.addEventListener('dragover', (event) => {
            if (!this.isProjectFileDrag(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect='copy';
            this.panelElement.classList.add('drop-target-active');
        });
        this.panelElement.addEventListener('dragleave', (event) => {
            if (!this.panelElement.contains(event.relatedTarget)) this.panelElement.classList.remove('drop-target-active');
        });
        this.panelElement.addEventListener('drop', (event) => {
            const fileId=this.getProjectFileId(event);
            if (!fileId) return;
            // A workspace owns its own drop event, so the panel only creates a new
            // matching layer when the drop lands on blank timeline space/ruler.
            if (event.target.closest?.('.lane-workspace') || event.target.closest?.('.timeline-empty')) return;
            event.preventDefault();
            this.panelElement.classList.remove('drop-target-active');
            this.onDropProjectFile?.({ fileId, trackId:null, start:this.getTimelineDropStart(event) });
            this.endProjectFileDrag();
        });
    }

    setTracks(tracks) {
        this.tracks = Array.isArray(tracks) ? tracks : [];
        this.render();
    }

    setSelectedTrack(trackId) {
        this.selectedTrackId = trackId;
        this.render();
    }

    setDuration(duration) {
        this.duration = Math.max(6, Math.ceil(Number(duration) || 0));
        this.render();
    }

    setCurrentTime(time) {
        this.currentTime = Math.max(0, Number(time) || 0);
        const percent = Math.min(100, (this.currentTime / this.duration) * 100);
        this.lanesElement?.querySelectorAll('.playhead').forEach((playhead) => { playhead.style.left = `${percent}%`; });
    }

    getDisplayTracks() {
        return [...this.tracks].sort((a, b) => {
            const groupDifference = GROUP_ORDER.indexOf(a.type) - GROUP_ORDER.indexOf(b.type);
            if (groupDifference !== 0) return groupDifference;
            return Number(a.order) - Number(b.order);
        });
    }

    getTrackById(trackId) {
        return this.tracks.find((track) => track.id === trackId) || null;
    }

    getClipDuration(track) {
        const duration = Number(track.clipDuration) || 0;
        if (duration > 0) return duration;
        return (track.type === 'sticker' || track.type === 'background') ? 3 : 1;
    }

    render() {
        if (!this.lanesElement || !this.rulerElement) return;
        const tracks = this.getDisplayTracks();
        this.lanesElement.innerHTML = '';
        if (this.emptyElement) this.emptyElement.hidden = tracks.length > 0;

        for (const track of tracks) {
            const defaults = TYPE_DEFAULTS[track.type] || TYPE_DEFAULTS.video;
            const lane = document.createElement('div');
            lane.className = `timeline-lane${track.id === this.selectedTrackId ? ' selected' : ''}`;
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
            playhead.style.left = `${Math.min(100, (this.currentTime / this.duration) * 100)}%`;
            workspace.appendChild(playhead);

            const clip = document.createElement('div');
            const hasSource = Boolean(track.sourceName);
            clip.className = `timeline-clip ${defaults.className}${hasSource ? '' : ' placeholder'}${track.id === this.selectedTrackId ? ' selected' : ''}`;
            clip.dataset.trackId = track.id;
            clip.style.left = `${Math.min(97, (Math.max(0, Number(track.start) || 0) / this.duration) * 100)}%`;
            clip.style.width = `${Math.max(3, Math.min(100, (this.getClipDuration(track) / this.duration) * 100))}%`;

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
            lane.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                this.onContextMenu?.(track.id, event.clientX, event.clientY);
            });
            this.lanesElement.appendChild(lane);
        }
        this.renderRuler();
    }

    installWorkspaceEvents(workspace, track) {
        workspace.addEventListener('dragover', (event) => {
            if (!this.isProjectFileDrag(event)) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect='copy';
            workspace.classList.add('drop-target-active');
        });
        workspace.addEventListener('dragleave', (event) => {
            if (!workspace.contains(event.relatedTarget)) workspace.classList.remove('drop-target-active');
        });
        workspace.addEventListener('drop', (event) => {
            const fileId = this.getProjectFileId(event);
            if (!fileId) return;
            event.preventDefault();
            event.stopPropagation();
            workspace.classList.remove('drop-target-active');
            const rect = workspace.getBoundingClientRect();
            const start = clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * this.duration, 0, this.duration);
            this.onDropProjectFile?.({ fileId, trackId: track.id, start });
            this.endProjectFileDrag();
        });
        workspace.addEventListener('pointerdown', (event) => {
            if (event.target.closest('.timeline-clip')) return;
            const rect = workspace.getBoundingClientRect();
            const time = clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * this.duration, 0, this.duration);
            this.onSelect?.(track.id);
            this.onSeek?.(time);
        });
    }

    installClipDrag(clip, workspace, track, resizeHandle) {
        clip.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            this.onSelect?.(track.id);
            const mode = event.target === resizeHandle || event.target.closest('.clip-resize-handle') ? 'resize' : 'move';
            this.dragState = {
                mode,
                track,
                workspace,
                pointerId: event.pointerId,
                startX: event.clientX,
                originalStart: Number(track.start) || 0,
                originalDuration: this.getClipDuration(track)
            };
            clip.setPointerCapture?.(event.pointerId);
        });

        const move = (event) => {
            const drag = this.dragState;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const secondsPerPixel = this.duration / Math.max(1, drag.workspace.clientWidth);
            const deltaSeconds = (event.clientX - drag.startX) * secondsPerPixel;
            if (drag.mode === 'move') {
                track.start = clamp(drag.originalStart + deltaSeconds, 0, Math.max(this.duration * 8, 300));
            } else {
                const sourceLimit = (track.type === 'sticker' || track.type === 'background') ? 300 : Math.max(.15, Number(track.sourceDuration) || drag.originalDuration);
                track.clipDuration = clamp(drag.originalDuration + deltaSeconds, .15, sourceLimit);
            }
            const duration = this.getClipDuration(track);
            clip.style.left = `${Math.min(97, (Math.max(0, Number(track.start) || 0) / this.duration) * 100)}%`;
            clip.style.width = `${Math.max(3, Math.min(100, (duration / this.duration) * 100))}%`;
            this.onTrackChange?.(track, { live: true });
        };
        const stop = (event) => {
            const drag = this.dragState;
            if (!drag || drag.pointerId !== event.pointerId) return;
            this.dragState = null;
            this.onTrackChange?.(track, { live: false });
            this.render();
        };
        clip.addEventListener('pointermove', move);
        clip.addEventListener('pointerup', stop);
        clip.addEventListener('pointercancel', stop);
    }

    renderRuler() {
        const marks = Math.min(12, Math.max(6, this.duration));
        this.rulerElement.style.gridTemplateColumns = `150px repeat(${marks}, 1fr)`;
        this.rulerElement.innerHTML = '<span class="ruler-spacer"></span>';
        for (let index = 0; index < marks; index += 1) {
            const second = Math.round((this.duration / marks) * index);
            this.rulerElement.insertAdjacentHTML('beforeend', `<span>${second}s</span>`);
        }
    }
}
