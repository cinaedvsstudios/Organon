/**
 * MotoriClip Project Recovery v1.
 *
 * JSON autosave contains timeline *metadata*, clip edits, keyframes, audio
 * effect presets, cue markers, canvas/FPS and edit position only. It never
 * serializes File, Blob, AudioBuffer, ImageBitmap, DOM nodes or disk paths.
 * Media remains in the existing media filename index and (where permitted)
 * IndexedDB FileSystemFileHandle store. Missing files stay offline until
 * the user explicitly relinks them.
 */
import { snapshotClip } from './project-history.mjs';

export const PROJECT_RECOVERY_KEY='motori-advanced-project-recovery-v1';
export const PROJECT_RECOVERY_VERSION=1;
export const MAX_RECOVERY_TRACKS=400;
export const MAX_RECOVERY_FILES=400;
export const MAX_RECOVERY_JSON_BYTES=3*1024*1024;
const KINDS=new Set(['video','audio','sticker','background']);
const limited=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
const id=value=>typeof value==='string' && value.length>0 && value.length<256;

/**
 * Build a source-data-only autosave. Caller passes primitive project settings,
 * never live engine/media node objects.
 */
export function createRecoveryRecord({files=[],tracks=[],selectedTrackId=null,selectedTrackIds=[],selectedFileId=null,currentTime=0,
    canvasWidth=1280,canvasHeight=720,fps=30,markers=[],previewZoom=100}={}) {
    if(!Array.isArray(files)||!Array.isArray(tracks)||files.length>MAX_RECOVERY_FILES||tracks.length>MAX_RECOVERY_TRACKS)
        throw new Error('This project exceeds the local recovery size limits.');
    const safeFiles=files.filter(file=>id(file?.id)&&typeof file.name==='string'&&KINDS.has(file.kind))
        .map(file=>({
            id:file.id,
            name:file.name.slice(0,400),
            kind:file.kind,
            size:limited(file.file?.size??file.size,0,Number.MAX_SAFE_INTEGER,0),
            lastModified:limited(file.file?.lastModified??file.lastModified,0,Number.MAX_SAFE_INTEGER,0)
        }));
    const safeTracks=tracks.map(track=>snapshotClip(track));
    const result={
        version:PROJECT_RECOVERY_VERSION,
        savedAt:Date.now(),
        files:safeFiles,
        tracks:safeTracks,
        selectedTrackId:id(selectedTrackId)?selectedTrackId:null,
        selectedTrackIds:[...selectedTrackIds].filter(id),
        selectedFileId:id(selectedFileId)?selectedFileId:null,
        currentTime:limited(currentTime,0,36000,0),
        settings:{
            canvasWidth:limited(Math.round(canvasWidth),64,7680,1280),
            canvasHeight:limited(Math.round(canvasHeight),64,7680,720),
            fps:[24,25,30,50,60].includes(Number(fps))?Number(fps):30,
            previewZoom:limited(previewZoom,25,300,100)
        },
        markers:Array.isArray(markers)?markers.map(value=>limited(value,0,36000,NaN)).filter(Number.isFinite).slice(0,1000):[]
    };
    validateRecoveryRecord(result);
    return result;
}

export function validateRecoveryRecord(record) {
    if(!record || record.version!==PROJECT_RECOVERY_VERSION)throw Error('Unsupported MotoriClip recovery version.');
    if(!Array.isArray(record.files)||!Array.isArray(record.tracks)
      ||record.files.length>MAX_RECOVERY_FILES||record.tracks.length>MAX_RECOVERY_TRACKS)
        throw Error('Invalid saved MotoriClip project size.');
    const ids=new Set();
    for(const file of record.files) {
        if(!id(file?.id)||ids.has(file.id)||typeof file.name!=='string'||!KINDS.has(file.kind))
            throw Error('Invalid or duplicate media file in saved project.');
        ids.add(file.id);
    }
    const clipIds=new Set();
    for(const track of record.tracks) {
        if(!id(track?.id)||clipIds.has(track.id)||!KINDS.has(track.type))
            throw Error('Invalid or duplicate clip in saved project.');
        clipIds.add(track.id);
        if(track.sourceFileId&&!ids.has(track.sourceFileId)) {
            // A user may delete an item from the bin while a clip remains on
            // the timeline. Keep the timeline; relinking will be required.
            // Never silently drop that clip from the saved project.
        }
        for(const key of ['start','sourceOffset','clipDuration']) {
            const n=Number(track[key]??0);
            if(!Number.isFinite(n)||n<0||n>36000)
                throw Error('Invalid '+key+' in saved clip '+track.id);
        }
    }
    if(!record.settings || !Number.isFinite(record.settings.canvasWidth)
        || !Number.isFinite(record.settings.canvasHeight)
        || ![24,25,30,50,60].includes(Number(record.settings.fps)))
        throw Error('Invalid saved project settings.');
    if(!Array.isArray(record.markers)||record.markers.some(n=>!Number.isFinite(n)||n<0))
        throw Error('Invalid saved timeline markers.');
    return record;
}

export function serializeRecoveryRecord(record) {
    validateRecoveryRecord(record);
    const data=JSON.stringify(record);
    if(data.length>MAX_RECOVERY_JSON_BYTES)
        throw Error('This project is too large for local recovery. Reduce clip count or metadata.');
    return data;
}

export function parseRecoveryRecord(text) {
    if(typeof text!=='string'||!text) return null;
    if(text.length>MAX_RECOVERY_JSON_BYTES)throw Error('Project recovery record exceeds the safety limit.');
    return validateRecoveryRecord(JSON.parse(text));
}
