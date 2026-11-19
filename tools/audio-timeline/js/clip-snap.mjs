/**
 * Pure, non-destructive timeline snapping. The planner never mutates clips:
 * callers record undo history and apply the returned delta as one edit.
 *
 * - pair: earlier A end -> later B start, with explicit selection only;
 * - start-playhead: selected clip start -> now line;
 * - end-playhead: selected clip end -> now line.
 *
 * Existing track/lane assignment and grouped offsets are preserved.
 */
const EPSILON = 0.001;
const durationOf = clip => Math.max(0, Number(clip?.clipDuration) || 0);
const startOf = clip => Number(clip?.start) || 0;
const endOf = clip => startOf(clip) + durationOf(clip);

export function planClipSnap(tracks, selectedIds, mode, playhead = 0) {
    const selected = [...new Set(selectedIds || [])];
    if (!['pair', 'start-playhead', 'end-playhead'].includes(mode)) {
        throw Error('Choose a supported snap action');
    }
    if (selected.length !== (mode === 'pair' ? 2 : 1)) {
        throw Error(mode === 'pair'
            ? 'Select exactly two clips to snap their end and start together'
            : 'Select exactly one clip to snap it to the playhead');
    }
    const byId = new Map((tracks || []).map(track => [track.id, track]));
    const chosen = selected.map(id => byId.get(id));
    if (chosen.some(track => !track || !track.sourceName || durationOf(track) <= 0)) {
        throw Error('Snap requires loaded timeline clips, not empty tracks');
    }

    let anchor = null;
    let target = chosen[0];
    let newStart;
    if (mode === 'pair') {
        // Timeline order wins; selection order is the tie-breaker for
        // two clips that start at precisely the same time.
        const [first, second] = chosen
            .map((track, order) => ({track, order}))
            .sort((a,b) => startOf(a.track)-startOf(b.track) || a.order-b.order)
            .map(item => item.track);
        anchor = first;
        target = second;
        newStart = endOf(first);
    } else {
        const now = Number(playhead);
        if (!Number.isFinite(now) || now < 0) throw Error('Playhead position is invalid');
        newStart = mode === 'start-playhead' ? now : now - durationOf(target);
    }

    const moving = target.groupId
        ? tracks.filter(clip => clip.groupId === target.groupId)
        : [target];
    const movingIds = new Set(moving.map(clip => clip.id));
    if (anchor && movingIds.has(anchor.id)) {
        throw Error('These clips belong to the same group; select independent clips to snap');
    }

    const delta = newStart - startOf(target);
    const MAX_TIMELINE_SECONDS = 36000;
    for (const moved of moving) {
        const proposedStart = startOf(moved) + delta;
        const proposedEnd = proposedStart + durationOf(moved);
        if (proposedStart < -EPSILON || proposedEnd > MAX_TIMELINE_SECONDS + EPSILON) {
            throw Error('The snap would move a clip outside the timeline');
        }
        for (const other of tracks) {
            if (movingIds.has(other.id) || other.laneId !== moved.laneId
                || !other.sourceName || durationOf(other) <= 0) continue;
            const collision = proposedStart < endOf(other)-EPSILON
                && proposedEnd > startOf(other)+EPSILON;
            if (collision) {
                throw Error(`Cannot snap: ${moved.sourceName} would overlap ${other.sourceName} on ${moved.laneLabel || 'its track'}`);
            }
        }
    }
    return {
        mode,
        anchorId: anchor?.id || null,
        targetId: target.id,
        movingIds: [...movingIds],
        delta,
        joinTime: newStart,
    };
}
