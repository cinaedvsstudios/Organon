/**
 * MotoriClip timeline playback decisions.
 * Pure helpers: no DOM/media side effects so boundary handling is testable.
 */
const PLAYABLE_TYPES = new Set(['video', 'audio']);

export function isPlayableTrackActive(track, time) {
    if (!track || !PLAYABLE_TYPES.has(track.type) || !track.sourceName) return false;
    const start = Number(track.start) || 0;
    const duration = Number(track.clipDuration) || 0;
    return duration > 0 && Number.isFinite(time) && time >= start && time < start + duration;
}

export function getActivePlaybackTracks(tracks, time) {
    if (!Array.isArray(tracks)) return [];
    return tracks.filter((track) => isPlayableTrackActive(track, time));
}

export function getTrackSourceTime(track, timelineTime) {
    const start = Number(track?.start) || 0;
    const sourceOffset = Math.max(0, Number(track?.sourceOffset) || 0);
    const sourceDuration = Number(track?.sourceDuration);
    const speed = Math.min(4,Math.max(.25,Number(track?.speed)||1));
    const sourceTime = Math.max(0, sourceOffset + ((Number(timelineTime) || 0) - start)*speed);
    return Number.isFinite(sourceDuration) && sourceDuration > 0
        ? Math.min(sourceTime, sourceDuration)
        : sourceTime;
}

/** Maintains the active media set and emits edge events exactly once per boundary.
 *  Records the actual media elements so replacing/removing a track stops old players.
 */
export class PlaybackBoundaryTracker {
    constructor() {
        this.active = new Map();
    }

    update(tracks, time, onStart, onStop) {
        const next = new Map(getActivePlaybackTracks(tracks, time).map((track) => [track.id, {
            track,
            media: track.media,
            soundMedia: track.soundMedia,
        }]));
        for (const [id, previous] of this.active) {
            const incoming = next.get(id);
            if (!incoming || previous.track !== incoming.track || previous.media !== incoming.media || previous.soundMedia !== incoming.soundMedia) {
                onStop?.(previous.track, previous.media, previous.soundMedia);
            }
        }
        for (const [id, incoming] of next) {
            const previous = this.active.get(id);
            if (!previous || previous.track !== incoming.track || previous.media !== incoming.media || previous.soundMedia !== incoming.soundMedia) {
                onStart?.(incoming.track, time);
            }
        }
        this.active = next;
        return next.size;
    }

    reset(onStop) {
        for (const previous of this.active.values()) {
            onStop?.(previous.track, previous.media, previous.soundMedia);
        }
        this.active.clear();
    }
}
