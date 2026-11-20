/** Timeline-only colour metadata: never changes pixels or source media. */
export const DEFAULT_TIMELINE_COLOURS=Object.freeze({
    video:'#4b84bf',audio:'#b6506e',image:'#e0a360',
    text:'#a58de4',effect:'#66b9a8'
});
export function validTimelineColour(value) {
    return typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value);
}
export function normaliseTimelineColour(value) {
    return validTimelineColour(value) ? value.toLowerCase() : null;
}
export function clipVisualKind(track={}) {
    if(track.type==='video') return 'video';
    if(track.type==='audio') return 'audio';
    const name=String(track.sourceName||'').toLowerCase();
    if(track.clipAssetKind==='text'||/^text-[a-z]/.test(name))return 'text';
    if(track.clipAssetKind==='effect'||/^effect-[a-z]/.test(name))return 'effect';
    return 'image';
}
export function resolvedClipColour(track={}) {
    return normaliseTimelineColour(track.clipColor)
        || normaliseTimelineColour(track.laneColor)
        || DEFAULT_TIMELINE_COLOURS[clipVisualKind(track)];
}
export function resolvedLaneColour(track={}) {
    return normaliseTimelineColour(track.laneColor)
        || DEFAULT_TIMELINE_COLOURS[clipVisualKind(track)];
}
