/**
 * ORGANON STUDIO: ADVANCED TIMELINE VIEW
 * v0.07 — timeline DOM only. Media playback/compositing stays in advanced-media-engine.js.
 */

const GROUP_ORDER = ['sticker', 'video', 'embedded-audio', 'external-audio'];
const TYPE_CLASS = {
    sticker: 'sticker',
    video: 'video',
    'embedded-audio': 'embedded-audio',
    'external-audio': 'external-audio'
};

const TYPE_DEFAULTS = {
    sticker: { label: 'Sticker', subLabel: 'overlay', placeholder: 'Import GIF / WebP / PNG', clipClass: 'sticker' },
    video: { label: 'Video', subLabel: 'visual clip', placeholder: 'Import video', clipClass: '' },
    'embedded-audio': { label: 'Video Audio', subLabel: 'linked sound', placeholder: 'Linked video audio', clipClass: 'audio' },
    'external-audio': { label: 'External Audio', subLabel: 'voice / music', placeholder: 'Import audio', clipClass: 'audio' }
};

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
}

export class AdvancedTimeline {
    constructor({ lanesElement, rulerElement, onSelect, onContextMenu }) {
        this.lanesElement = lanesElement;
        this.rulerElement = rulerElement;
        this.onSelect = onSelect;
        this.onContextMenu = onContextMenu;
        this.tracks = [];
        this.selectedTrackId = null;
        this.duration = 6;
        this.currentTime = 0;
    }

    setTracks(tracks) {
        this.tracks = tracks;
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
        this.lanesElement.querySelectorAll('.playhead').forEach((playhead) => {
            playhead.style.left = `${percent}%`;
        });
    }

    getDisplayTracks() {
        return [...this.tracks].sort((a, b) => {
            const groupDifference = GROUP_ORDER.indexOf(a.type) - GROUP_ORDER.indexOf(b.type);
            if (groupDifference !== 0) return groupDifference;
            return a.order - b.order;
        });
    }

    render() {
        if (!this.lanesElement || !this.rulerElement) return;
        const displayTracks = this.getDisplayTracks();
        this.lanesElement.innerHTML = '';

        for (const track of displayTracks) {
            const defaults = TYPE_DEFAULTS[track.type];
            const lane = document.createElement('div');
            lane.className = `timeline-lane layer-${TYPE_CLASS[track.type]}${track.id === this.selectedTrackId ? ' selected' : ''}`;
            lane.dataset.trackId = track.id;
            lane.title = 'Click to select this timeline line. Right-click to add another layer of the same type.';

            const label = track.label || `${defaults.label} ${track.order}`;
            let subLabel = track.subLabel || defaults.subLabel;
            if (track.type === 'sticker') {
                subLabel = track.order === 1 ? 'top visual layer' : `below Sticker ${track.order - 1}`;
            }

            const workspace = document.createElement('div');
            workspace.className = 'lane-workspace';
            const playhead = document.createElement('div');
            playhead.className = 'playhead';
            playhead.style.left = `${Math.min(100, (this.currentTime / this.duration) * 100)}%`;
            workspace.appendChild(playhead);

            const clip = document.createElement('div');
            const hasSource = Boolean(track.sourceName);
            clip.className = `timeline-clip ${defaults.clipClass}${hasSource ? '' : ' placeholder'}`;
            clip.textContent = hasSource ? track.sourceName : defaults.placeholder;

            const start = Math.max(0, Number(track.start) || 0);
            const knownDuration = Number(track.duration) || 0;
            const effectiveDuration = knownDuration || (track.type === 'sticker' ? this.duration - start : Math.max(1.4, this.duration * 0.42));
            clip.style.left = `${Math.min(96, (start / this.duration) * 100)}%`;
            clip.style.width = `${Math.max(8, Math.min(100 - (start / this.duration) * 100, (effectiveDuration / this.duration) * 100))}%`;
            workspace.appendChild(clip);

            lane.innerHTML = `<div class="lane-name"><span>${escapeHtml(label)}</span><small>${escapeHtml(subLabel)}</small></div>`;
            lane.appendChild(workspace);

            lane.addEventListener('click', () => this.onSelect?.(track.id));
            lane.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                this.onContextMenu?.(track.id, event.clientX, event.clientY);
            });

            this.lanesElement.appendChild(lane);
        }

        this.renderRuler();
    }

    renderRuler() {
        const marks = Math.min(12, Math.max(6, this.duration));
        this.rulerElement.style.gridTemplateColumns = `120px repeat(${marks}, 1fr)`;
        this.rulerElement.innerHTML = '<span class="ruler-spacer"></span>';
        for (let second = 0; second < marks; second += 1) {
            const mark = Math.round((this.duration / marks) * second);
            this.rulerElement.insertAdjacentHTML('beforeend', `<span>${mark}s</span>`);
        }
    }
}

export const TimelineTypes = Object.freeze({
    STICKER: 'sticker',
    VIDEO: 'video',
    EMBEDDED_AUDIO: 'embedded-audio',
    EXTERNAL_AUDIO: 'external-audio'
});
