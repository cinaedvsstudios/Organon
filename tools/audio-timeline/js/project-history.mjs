/**
 * MotoriClip Phase 4: undo/redo snapshots contain editor data, never DOM
 * media elements, Web Audio nodes or object URLs.
 * File objects stay only in the session's source registry.
 */
export const CLIP_DATA_KEYS = Object.freeze([
    'id', 'type', 'laneId', 'laneLabel', 'label', 'order',
    'start', 'sourceOffset', 'sourceDuration', 'clipDuration',
    'sourceFileId', 'sourceName', 'fileType',
    'visible', 'opacity', 'blendMode', 'groupId', 'extractedFrom'
]);

export function snapshotClip(track) {
    const data = {};
    for (const key of CLIP_DATA_KEYS) {
        if (track[key] !== undefined) data[key] = track[key];
    }
    data.audio = { volume:1, muted:false, fadeIn:0, fadeOut:0, ...(track.audio || {}) };
    data.transparency = {
        mode:'native', keyColour:'#00ff00', tolerance:30, feather:8,
        ...(track.transparency || {})
    };
    data.analysis = track.analysis ? {
        levels: Array.isArray(track.analysis.levels) ? [...track.analysis.levels] : [],
        sampleCount: track.analysis.sampleCount ?? 0,
        analysed: Boolean(track.analysis.analysed)
    } : null;
    return data;
}

export function snapshotProject({ files, tracks, selectedTrackIds, selectedTrackId, selectedFileId, currentTime }) {
    return {
        files: files.map(({ id, name, kind }) => ({ id, name, kind })),
        tracks: tracks.map(snapshotClip),
        selectedTrackIds: [...selectedTrackIds],
        selectedTrackId: selectedTrackId || null,
        selectedFileId: selectedFileId || null,
        currentTime: Math.max(0, Number(currentTime) || 0)
    };
}

export function restoreFileEntries(fileRecords, sourceFiles) {
    return fileRecords.map((entry) => ({
        ...entry,
        file: sourceFiles.get(entry.id) || null
    })).filter((entry) => entry.file);
}

export function validateTrackRecords(records, sourceFiles) {
    const ids = new Set();
    for (const track of records) {
        if (!track || typeof track.id !== 'string' || !track.id) throw new Error('A timeline clip has no valid ID.');
        if (ids.has(track.id)) throw new Error('Duplicate timeline clip ID: ' + track.id);
        ids.add(track.id);
        for (const key of ['start','sourceOffset','clipDuration']) {
            const number = Number(track[key] ?? 0);
            if (!Number.isFinite(number) || number < 0) throw new Error('Invalid ' + key + ' for ' + track.id);
        }
        if (track.sourceName && (!track.sourceFileId || !sourceFiles.has(track.sourceFileId))) {
            throw new Error('Missing source media for ' + track.id);
        }
    }
}

export function referencedFileIds(files, tracks, undo = [], redo = []) {
    const retained = new Set();
    const add = (f, t) => {
        for (const file of f || []) if (file.id) retained.add(file.id);
        for (const track of t || []) if (track.sourceFileId) retained.add(track.sourceFileId);
    };
    add(files, tracks);
    for (const entry of [...undo, ...redo]) {
        if (entry?.snapshot) add(entry.snapshot.files, entry.snapshot.tracks);
    }
    return retained;
}
