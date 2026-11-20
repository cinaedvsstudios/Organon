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
import { snapshotClip, snapshotProject } from './project-history.mjs';

export const PROJECT_RECOVERY_KEY='motori-advanced-project-recovery-v1';
export const PROJECT_RECOVERY_VERSION=1;
export const MAX_RECOVERY_TRACKS=400;
export const MAX_RECOVERY_FILES=400;
export const MAX_RECOVERY_HISTORY_STEPS=60;
export const MAX_RECOVERY_JSON_BYTES=3*1024*1024;
const KINDS=new Set(['video','audio','sticker','background']);
const limited=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
const id=value=>typeof value==='string' && value.length>0 && value.length<256;

/**
 * Build a source-data-only autosave. Caller passes primitive project settings,
 * never live engine/media node objects.
 */
export function createRecoveryRecord({files=[],tracks=[],selectedTrackId=null,selectedTrackIds=[],selectedFileId=null,currentTime=0,
    canvasWidth=1280,canvasHeight=720,fps=30,markers=[],previewZoom=100,history=null}={}) {
    if(!Array.isArray(files)||!Array.isArray(tracks)||files.length>MAX_RECOVERY_FILES||tracks.length>MAX_RECOVERY_TRACKS)
        throw new Error('This project exceeds the local recovery size limits.');
    const safeFiles=files.filter(file=>id(file?.id)&&typeof file.name==='string'&&KINDS.has(file.kind))
        .map(file=>({
            id:file.id,
            name:file.name.slice(0,400),
            kind:file.kind,
            size:limited(file.file?.size??file.size,0,Number.MAX_SAFE_INTEGER,0),
            lastModified:limited(file.file?.lastModified??file.lastModified,0,Number.MAX_SAFE_INTEGER,0),
            ...(file.generated&&['text','effect'].includes(file.generated.group)
                &&typeof file.generated.presetId==='string'
                ? { generated:{
                    group:file.generated.group,
                    presetId:file.generated.presetId.slice(0,100),
                    value:file.generated.group==='text'
                        ? String(file.generated.value||'').slice(0,100) : ''
                }}:{})
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
    if(history!==null && history!==undefined){
        if(!history || !Array.isArray(history.undo) || !Array.isArray(history.redo)
            ||history.undo.length>MAX_RECOVERY_HISTORY_STEPS
            ||history.redo.length>MAX_RECOVERY_HISTORY_STEPS)
            throw Error('Invalid saved project history size.');
        const compact=(entry)=>{
            const source=entry?.snapshot;
            if(typeof entry?.label!=='string'||!entry.label||entry.label.length>200
                ||!source||!Array.isArray(source.files)||!Array.isArray(source.tracks)
                ||!Array.isArray(source.selectedTrackIds))
                throw Error('Invalid saved Undo/Redo entry.');
            return {label:entry.label,snapshot:snapshotProject({
                files:source.files,tracks:source.tracks,
                selectedTrackIds:source.selectedTrackIds,
                selectedTrackId:source.selectedTrackId,
                selectedFileId:source.selectedFileId,
                currentTime:source.currentTime
            })};
        };
        result.history={undo:history.undo.map(compact),redo:history.redo.map(compact)};
    }
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
        if(file.generated){
            if(!['text','effect'].includes(file.generated.group)
                ||typeof file.generated.presetId!=='string'||!file.generated.presetId
                ||file.generated.presetId.length>100
                ||typeof file.generated.value!=='string'||file.generated.value.length>100)
                throw Error('Invalid generated asset recipe in saved project.');
        }
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
    // History is optional for backward compatibility with Phase 9M backups.
    if(record.history!==undefined){
        const {undo,redo}=record.history||{};
        if(!Array.isArray(undo)||!Array.isArray(redo)
            ||undo.length>MAX_RECOVERY_HISTORY_STEPS||redo.length>MAX_RECOVERY_HISTORY_STEPS)
            throw Error('Invalid saved project history size.');
        for(const entry of [...undo,...redo]){
            const saved=entry?.snapshot;
            if(typeof entry?.label!=='string'||!entry.label||entry.label.length>200
                ||!saved||!Array.isArray(saved.files)||!Array.isArray(saved.tracks)
                ||!Array.isArray(saved.selectedTrackIds)
                ||saved.selectedTrackIds.length>MAX_RECOVERY_TRACKS
                ||saved.selectedTrackIds.some(value=>!id(value))
                ||!Number.isFinite(saved.currentTime)||saved.currentTime<0||saved.currentTime>36000)
                throw Error('Invalid saved Undo/Redo entry.');
            // Use exactly the same clip/file ID and size validation as the
            // live project, without recursively validating its parent history.
            validateRecoveryRecord({...record,files:saved.files,tracks:saved.tracks,
                history:undefined,markers:[]});
        }
    }
    return record;
}

export function serializeRecoveryRecord(record) {
    validateRecoveryRecord(record);
    let data=JSON.stringify(record);
    if(data.length>MAX_RECOVERY_JSON_BYTES && record.history){
        // Keep the newest undo/redo steps first when metadata approaches the
        // 3 MB safety budget. Never sacrifice the active timeline to save history.
        const compact={...record,history:{
            undo:[...record.history.undo],redo:[...record.history.redo]
        }};
        const dropOldest=()=>{
            const side=compact.history.undo.length>=compact.history.redo.length?'undo':'redo';
            const target=compact.history[side].length?side:side==='undo'?'redo':'undo';
            return compact.history[target].shift();
        };
        let excess=data.length-MAX_RECOVERY_JSON_BYTES;
        while(excess>0&&(compact.history.undo.length||compact.history.redo.length)){
            const removed=dropOldest();
            excess-=JSON.stringify(removed).length+1;
        }
        data=JSON.stringify(compact);
        while(data.length>MAX_RECOVERY_JSON_BYTES
            &&(compact.history.undo.length||compact.history.redo.length)){
            dropOldest();
            data=JSON.stringify(compact);
        }
    }
    if(data.length>MAX_RECOVERY_JSON_BYTES)
        throw Error('This project is too large for local recovery. Reduce clip count or metadata.');
    return data;
}

/**
 * Write metadata-only recovery to browser storage, preserving the current
 * timeline even if the storage quota is nearly exhausted.
 *
 * When quota is reached, progressively discard *oldest* history snapshots.
 * The live in-memory Undo/Redo stacks are never modified. Existing storage
 * is replaced only by a successful atomic setItem.
 */
export function writeRecoveryRecordWithQuota(storage, key, record) {
    const originalUndo=record.history?.undo?.length||0;
    const originalRedo=record.history?.redo?.length||0;
    const full=serializeRecoveryRecord(record);
    const candidate=JSON.parse(full);
    let lastError;
    // 60 steps on each side fit within 8 halvings. Leave a few extra
    // attempts for very small storage quotas.
    for(let attempt=0;attempt<12;attempt++) {
        const json=JSON.stringify(candidate);
        try {
            storage.setItem(key,json);
            return {
                json,
                undoCount:candidate.history?.undo?.length||0,
                redoCount:candidate.history?.redo?.length||0,
                truncated:(candidate.history?.undo?.length||0)<originalUndo
                    ||(candidate.history?.redo?.length||0)<originalRedo
            };
        } catch(error) {
            const quota=error?.name==='QuotaExceededError'
                ||error?.name==='NS_ERROR_DOM_QUOTA_REACHED'
                ||error?.code===22 ||error?.code===1014;
            if(!quota)throw error;
            lastError=error;
        }
        const history=candidate.history;
        if(!history || (!history.undo.length&&!history.redo.length))break;
        const count=history.undo.length+history.redo.length;
        for(let i=0;i<Math.ceil(count/2);i++){
            const side=history.undo.length>=history.redo.length?'undo':'redo';
            (history[side].length?history[side]:history[side==='undo'?'redo':'undo']).shift();
        }
    }
    throw lastError||Error('Local project recovery could not be saved.');
}

export function parseRecoveryRecord(text) {
    if(typeof text!=='string'||!text) return null;
    if(text.length>MAX_RECOVERY_JSON_BYTES)throw Error('Project recovery record exceeds the safety limit.');
    return validateRecoveryRecord(JSON.parse(text));
}
