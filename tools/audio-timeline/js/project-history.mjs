/**
 * MotoriClip Phase 4: undo/redo snapshots contain editor data, never DOM
 * media elements, Web Audio nodes or object URLs.
 * File objects stay only in the session's source registry.
 */
import { normalizeVisualTransitions } from './visual-transitions.mjs';
import { normalizeOrgavoxFx } from './orgavox-audio-chain.mjs';
import { normaliseTextOverlay } from './text-template-renderer.mjs';
import { normaliseTimelineEffect } from './timeline-effects.mjs';

export const CLIP_DATA_KEYS = Object.freeze([
    'id', 'type', 'laneId', 'laneLabel', 'label', 'order',
    'start', 'sourceOffset', 'sourceDuration', 'clipDuration',
    'sourceFileId', 'sourceName', 'fileType',
    'visible', 'opacity', 'blendMode', 'groupId', 'extractedFrom', 'transitionFromId', 'transitionEffectId', 'speed',
    'laneColor', 'clipColor'
]);

export function snapshotClip(track) {
    const data = {};
    for (const key of CLIP_DATA_KEYS) {
        if (track[key] !== undefined) data[key] = track[key];
    }
    data.transitionFromId = track.transitionFromId || null;
    data.transitionEffectId = track.transitionEffectId || null;
    data.transitionParameters = track.transitionParameters
        ? JSON.parse(JSON.stringify(track.transitionParameters)) : {};
    data.audio = { volume:1, muted:false, fadeIn:0, fadeOut:0, ...(track.audio || {}) };
    if (data.audio.fx) data.audio.fx=normalizeOrgavoxFx(data.audio.fx);
    data.transform = { ...(track.transform||{}) };
    data.adjustments = { ...(track.adjustments||{}) };
    data.keyframes = Object.fromEntries(Object.entries(track.keyframes||{}).map(([key,frames])=>[
        key,Array.isArray(frames)?frames.map(frame=>({...frame})):[]
    ]));
    data.visualTransitions = normalizeVisualTransitions(track.visualTransitions);
    if(track.textOverlay)data.textOverlay=normaliseTextOverlay(track.textOverlay);
    if(track.effectOverlay)data.effectOverlay=normaliseTimelineEffect(track.effectOverlay);
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

export function snapshotProject({ files, tracks, selectedTrackIds, selectedTrackId, selectedFileId,
    currentTime, markers, settings }) {
    return {
        files: files.map(({ id, name, kind, file, size, lastModified, generated }) => ({
            id, name, kind, size: file?.size ?? size ?? 0,
            lastModified: file?.lastModified ?? lastModified ?? 0,
            ...(generated && ['text','effect'].includes(generated.group)
                ? {generated:{group:generated.group,presetId:generated.presetId,value:generated.value || ''}} : {})
        })),
        tracks: tracks.map(snapshotClip),
        selectedTrackIds: [...selectedTrackIds],
        selectedTrackId: selectedTrackId || null,
        selectedFileId: selectedFileId || null,
        currentTime: Math.max(0, Number(currentTime) || 0),
        ...(Array.isArray(markers)?{markers:[...markers]}:{}),
        ...(settings?{settings:{...settings}}:{})
    };
}

/**
 * Strictly reconnect source media held only in Undo/Redo history.
 * A historical file needs a recorded nonzero size; an old filename-only
 * snapshot is too ambiguous to safely bind to an unrelated local file.
 */
export function matchesHistoricalSource(record, file, kind) {
    if(!record || record.generated || !file || record.name!==file.name || record.kind!==kind)
        return false;
    const size=Number(record.size);
    if(!Number.isSafeInteger(size) || size<=0 || size!==file.size)
        return false;
    const modified=Number(record.lastModified);
    return !(Number.isFinite(modified) && modified>0 && modified!==file.lastModified);
}

export function historicalMediaIdsForFile(file, kind, history={}, currentFiles=[], sourceFiles=new Map()) {
    const activeIds=new Set(currentFiles.map(item=>item.id));
    const matches=new Set();
    for(const entry of [...(history?.undo||[]),...(history?.redo||[])]) {
        for(const record of (entry?.snapshot?.files||[])) {
            if(!record?.id || activeIds.has(record.id) || sourceFiles.has(record.id))
                continue;
            if(matchesHistoricalSource(record,file,kind))matches.add(record.id);
        }
    }
    return [...matches];
}

export function restoreFileEntries(fileRecords, sourceFiles, {includeMissing=false}={}) {
    const entries=fileRecords.map((entry) => {
        const file=sourceFiles.get(entry.id)||null;
        return {...entry,file,needsRelink:!file};
    });
    return includeMissing ? entries : entries.filter((entry)=>entry.file);
}

export function validateTrackRecords(records, sourceFiles, {allowMissingSources=false}={}) {
    const ids = new Set();
    for (const track of records) {
        if (!track || typeof track.id !== 'string' || !track.id) throw new Error('A timeline clip has no valid ID.');
        if (ids.has(track.id)) throw new Error('Duplicate timeline clip ID: ' + track.id);
        ids.add(track.id);
        for (const key of ['start','sourceOffset','clipDuration']) {
            const number = Number(track[key] ?? 0);
            if (!Number.isFinite(number) || number < 0) throw new Error('Invalid ' + key + ' for ' + track.id);
        }
        if (!allowMissingSources && track.sourceName && (!track.sourceFileId || !sourceFiles.has(track.sourceFileId))) {
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

/** Apply snapshot data without replacing a live clip's HTMLMediaElement/AudioNodes. */
export function applyClipData(target, record) {
    for (const key of CLIP_DATA_KEYS) {
        if (Object.hasOwn(record, key)) target[key] = record[key];
    }
    target.transitionFromId = record.transitionFromId || null;
    target.transitionEffectId = record.transitionEffectId || null;
    target.transitionParameters = record.transitionParameters
        ? JSON.parse(JSON.stringify(record.transitionParameters)) : {};
    // Undoing a colour change must clear overrides absent in old snapshots.
    target.laneColor=record.laneColor || null;
    target.clipColor=record.clipColor || null;
    target.audio = { ...record.audio };
    if (target.audio.fx) target.audio.fx=normalizeOrgavoxFx(target.audio.fx);
    target.transform = { ...(record.transform||{}) };
    target.adjustments = { ...(record.adjustments||{}) };
    target.keyframes = Object.fromEntries(Object.entries(record.keyframes||{}).map(([key,frames])=>[
        key,Array.isArray(frames)?frames.map(frame=>({...frame})):[]
    ]));
    target.visualTransitions = normalizeVisualTransitions(record.visualTransitions);
    target.textOverlay=record.textOverlay?normaliseTextOverlay(record.textOverlay):null;
    target.effectOverlay=record.effectOverlay?normaliseTimelineEffect(record.effectOverlay):null;
    target.transparency = { ...record.transparency };
    target.analysis = record.analysis ? {
        ...record.analysis, levels: [...(record.analysis.levels || [])]
    } : null;
    return target;
}

/**
 * Prepare all missing media before committing history. Unchanged clip IDs keep
 * their existing decoder/player instead of re-importing the source on every
 * move, trim, opacity or selection undo.
 *
 * The caller is responsible for engine.setTracks(prepared), which releases
 * old tracks only once the preparation has succeeded.
 */
export async function prepareHistoryTracks({
    records, existingTracks, sourceFiles, loadTrack, disposeTrack, allowMissingSources=false
}) {
    validateTrackRecords(records, sourceFiles, {allowMissingSources});
    const existingById = new Map((existingTracks || []).map(track => [track.id, track]));
    const created = [];
    const prepared = [];
    try {
        for (const record of records) {
            const current = existingById.get(record.id);
            if (current && current.sourceFileId === record.sourceFileId
                && (!record.sourceFileId || (current.file === sourceFiles.get(record.sourceFileId) && current.media))) {
                prepared.push({ track: current, record, reused: true });
                continue;
            }
            const track = snapshotClip(record);
            if (record.sourceFileId && sourceFiles.has(record.sourceFileId)) {
                const file = sourceFiles.get(record.sourceFileId);
                await loadTrack(track, file);
            }
            applyClipData(track, record);
            created.push(track);
            prepared.push({ track, record, reused: false });
        }
    } catch (error) {
        for (const track of created) disposeTrack(track);
        throw error;
    }
    return {
        tracks: prepared.map(item => item.track),
        commit() {
            for (const { track, record, reused } of prepared) {
                if (reused) applyClipData(track, record);
            }
        },
        rollback() {
            for (const track of created) disposeTrack(track);
        }
    };
}
