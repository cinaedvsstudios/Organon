import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord,writeRecoveryRecordWithQuota,
    MAX_RECOVERY_TRACKS,PROJECT_RECOVERY_VERSION
} from '../js/project-recovery.mjs';

const file=(id='f1')=>({id,name:'source.mp4',kind:'video',size:2789711,lastModified:1700000000000,
    file:{name:'source.mp4',size:2789711,lastModified:1700000000000,neverStoreMe:'raw file'}});
const clip=(values={})=>({id:'clip-1',type:'video',order:2,laneId:'video-2',laneLabel:'Video 2',
    sourceFileId:'f1',sourceName:'source.mp4',start:12.3,sourceOffset:3.4,sourceDuration:25,
    clipDuration:6.25,speed:1.5,visible:false,opacity:.8,blendMode:'multiply',groupId:'linked',
    transitionFromId:'clip-A',transitionEffectId:'sphere',
    audio:{volume:.7,gain:20,muted:false,fadeIn:.35,fadeOut:.1,fx:{eq:'voice',drive:'tape',dynamics:'limiter',stereo:'wide',lofi:'eightbit'}},
    transform:{scale:1.4,x:27,y:-12,rotate:6},
    adjustments:{contrast:25,saturation:20,brightness:-7},
    keyframes:{'transform.scale':[{time:0,value:100},{time:2,value:140}]},
    visualTransitions:{enter:{type:'fade',duration:.3,curve:'linear'},exit:{type:'fade',duration:.7,curve:'ease-in'}},
    file:{name:'source.mp4',fakeLargeBytes:new Uint8Array(8000)},media:{media:'should never persist'},
    ...values
});
test('project recovery preserves timeline arrangement and complex clip effects without copying file bytes',()=>{
    const source=file(),video=clip();
    const record=createRecoveryRecord({files:[source],tracks:[video],selectedTrackId:'clip-1',
        selectedTrackIds:['clip-1'],selectedFileId:'f1',currentTime:14.125,
        canvasWidth:1920,canvasHeight:1080,fps:25,previewZoom:140,markers:[4.5,11.2]});
    const text=serializeRecoveryRecord(record);
    assert.ok(text.length<10000);
    assert.ok(!text.includes('neverStoreMe'));
    assert.ok(!text.includes('fakeLargeBytes'));
    assert.ok(!text.includes('should never persist'));
    const parsed=parseRecoveryRecord(text);
    assert.equal(parsed.version,PROJECT_RECOVERY_VERSION);
    assert.deepEqual(parsed.settings,{canvasWidth:1920,canvasHeight:1080,fps:25,previewZoom:140});
    assert.deepEqual(parsed.markers,[4.5,11.2]);
    assert.equal(parsed.currentTime,14.125);
    assert.equal(parsed.tracks[0].audio.fx.lofi,'eightbit');
    assert.equal(parsed.tracks[0].sourceOffset,3.4);
    assert.equal(parsed.tracks[0].speed,1.5);
    assert.equal(parsed.tracks[0].blendMode,'multiply');
    assert.equal(parsed.tracks[0].keyframes['transform.scale'][1].value,140);
    assert.equal(parsed.tracks[0].visible,false);
    assert.equal(parsed.tracks[0].transitionEffectId,'sphere');
    assert.equal(parsed.tracks[0].transform.rotate,6);
    assert.equal(parsed.tracks[0].adjustments.contrast,25);
    assert.equal(parsed.files[0].size,2789711);
    assert.equal(parsed.tracks[0].file,undefined);
});
test('SpiralBlockWipe original GLSL uniforms survive portable Save/Open without live-object aliasing',()=>{
    const params={columns:11,rows:7,inward:false,clockwise:false,smoothness:.19};
    const video=clip({transitionEffectId:'spiralblockwipe',transitionParameters:{spiralblockwipe:params}});
    const record=createRecoveryRecord({files:[file()],tracks:[video]});
    const parsed=parseRecoveryRecord(serializeRecoveryRecord(record));
    assert.deepEqual(parsed.tracks[0].transitionParameters.spiralblockwipe,params);
    video.transitionParameters.spiralblockwipe.columns=3;
    assert.equal(record.tracks[0].transitionParameters.spiralblockwipe.columns,11,
        'Later Inspector changes must not corrupt saved Undo/project data');
    parsed.tracks[0].transitionParameters.spiralblockwipe.rows=4;
    assert.equal(record.tracks[0].transitionParameters.spiralblockwipe.rows,7,
        'Imported project edits must not mutate previous recovery snapshots');
});
test('Hologram original GLSL uniforms survive portable Save/Open and Undo snapshots',()=>{
    const params={tint:'#ee44b7',background:'#001122',backgroundAlpha:.65,scanlines:92,jitter:.14,flicker:.85};
    const video=clip({transitionEffectId:'hologram',transitionParameters:{hologram:params}});
    const record=createRecoveryRecord({files:[file()],tracks:[video]});
    const parsed=parseRecoveryRecord(serializeRecoveryRecord(record));
    assert.deepEqual(parsed.tracks[0].transitionParameters.hologram,params);
    video.transitionParameters.hologram.scanlines=1;
    assert.equal(record.tracks[0].transitionParameters.hologram.scanlines,92,
        'Inspector mutations must not modify stored Undo and project backups');
    parsed.tracks[0].transitionParameters.hologram.backgroundAlpha=0;
    assert.equal(record.tracks[0].transitionParameters.hologram.backgroundAlpha,.65);
});
test('CellDissolve Voronoi settings persist in Save/Open and snapshots are isolated',()=>{
    const params={cells:13,smoothness:.24,border:.018,borderColor:'#55aaff',
        borderAlpha:.6,seed:31};
    const video=clip({transitionEffectId:'cell-dissolve',
        transitionParameters:{'cell-dissolve':params}});
    const record=createRecoveryRecord({files:[file()],tracks:[video]});
    const parsed=parseRecoveryRecord(serializeRecoveryRecord(record));
    assert.deepEqual(parsed.tracks[0].transitionParameters['cell-dissolve'],params);
    video.transitionParameters['cell-dissolve'].cells=2;
    assert.equal(record.tracks[0].transitionParameters['cell-dissolve'].cells,13);
    parsed.tracks[0].transitionParameters['cell-dissolve'].seed=99;
    assert.equal(record.tracks[0].transitionParameters['cell-dissolve'].seed,31);
});
test('recovery snapshot is independent of live edit objects',()=>{
    const c=clip();const entry=file();
    const saved=createRecoveryRecord({files:[entry],tracks:[c]});
    c.audio.fx.eq='phone';c.keyframes['transform.scale'][0].value=999;
    entry.name='altered';
    assert.equal(saved.tracks[0].audio.fx.eq,'voice');
    assert.equal(saved.tracks[0].keyframes['transform.scale'][0].value,100);
    assert.equal(saved.files[0].name,'source.mp4');
});
test('offline or missing media sources do not cause valid timeline edits to be discarded',()=>{
    const record=createRecoveryRecord({files:[],tracks:[clip({sourceFileId:'missing'})]});
    assert.equal(parseRecoveryRecord(serializeRecoveryRecord(record)).tracks[0].sourceFileId,'missing');
});
test('invalid data is rejected, limiting corrupt and oversized local recovery',()=>{
    assert.equal(parseRecoveryRecord(''),null);
    assert.throws(()=>parseRecoveryRecord('{broken'),SyntaxError);
    assert.throws(()=>parseRecoveryRecord('{"version":9}'),/version/);
    assert.throws(()=>createRecoveryRecord({files:[file(),file()]}),/duplicate/);
    assert.throws(()=>createRecoveryRecord({tracks:[clip(),clip()]}),/duplicate/);
    assert.throws(()=>createRecoveryRecord({tracks:[clip({start:-3})]}),/Invalid start/);
    assert.throws(()=>createRecoveryRecord({tracks:Array.from({length:MAX_RECOVERY_TRACKS+1},(_,i)=>clip({id:'c'+i}))}),/limits/);
});

test('generated text and effect presets round-trip with no PNG data',()=>{
    const records=createRecoveryRecord({files:[
        {id:'text1',name:'text-neon-cyan-title.png',kind:'sticker',size:900,
            generated:{group:'text',presetId:'neon-cyan',value:'WE ARE BACK'}},
        {id:'fx1',name:'effect-vignette.png',kind:'sticker',size:700,
            generated:{group:'effect',presetId:'vignette',value:''}}
    ],tracks:[]});
    const encoded=serializeRecoveryRecord(records);
    assert.ok(encoded.length<3000);
    const decoded=parseRecoveryRecord(encoded);
    assert.deepEqual(decoded.files.map(item=>item.generated),[
        {group:'text',presetId:'neon-cyan',value:'WE ARE BACK'},
        {group:'effect',presetId:'vignette',value:''}
    ]);
    assert.equal(decoded.files[0].file,undefined);
});
test('reject corrupt generated overlay recipes',()=>{
    const safe=createRecoveryRecord({files:[{
        id:'text1',name:'title.png',kind:'sticker',generated:{
            group:'text',presetId:'neon-cyan',value:'Valid Title'
        }
    }]});
    safe.files[0].generated.group='unknown';
    assert.throws(()=>serializeRecoveryRecord(safe),/generated asset recipe/);
    safe.files[0].generated.group='text';
    safe.files[0].generated.value='x'.repeat(101);
    assert.throws(()=>serializeRecoveryRecord(safe),/generated asset recipe/);
});

test('Undo and Redo metadata survives a portable project round trip without source bytes',()=>{
    const before={files:[file()],tracks:[clip({start:2})],selectedTrackId:'clip-1',
        selectedTrackIds:['clip-1'],selectedFileId:'f1',currentTime:3};
    const after={...before,tracks:[clip({start:7})],currentTime:8};
    const record=createRecoveryRecord({files:[file()],tracks:[clip({start:12})],
        history:{undo:[{label:'Move clip',snapshot:before}],
            redo:[{label:'Trim clip',snapshot:after}]}});
    const json=serializeRecoveryRecord(record);
    const loaded=parseRecoveryRecord(json);
    assert.equal(loaded.history.undo[0].snapshot.tracks[0].start,2);
    assert.equal(loaded.history.redo[0].snapshot.tracks[0].start,7);
    assert.equal(loaded.history.undo[0].snapshot.files[0].size,2789711);
    assert.ok(!json.includes('neverStoreMe'));
    assert.ok(!json.includes('fakeLargeBytes'));
    assert.equal(loaded.history.undo[0].snapshot.tracks[0].file,undefined);
});
test('old Phase 9M project backups without history still open unchanged',()=>{
    const record=createRecoveryRecord({files:[file()],tracks:[clip()]});
    const loaded=parseRecoveryRecord(serializeRecoveryRecord(record));
    assert.equal(loaded.history,undefined);
    assert.equal(loaded.tracks.length,1);
});
test('corrupt historical clip IDs and invalid snapshots reject the entire backup',()=>{
    const snap={files:[file()],tracks:[clip()],selectedTrackIds:['clip-1'],currentTime:1};
    const record=createRecoveryRecord({files:[file()],tracks:[clip()],
        history:{undo:[{label:'Edit',snapshot:snap}],redo:[]}});
    record.history.undo[0].snapshot.tracks[0].start=-1;
    assert.throws(()=>parseRecoveryRecord(JSON.stringify(record)),/Invalid start/);
    record.history.undo[0].snapshot.tracks[0].start=1;
    record.history.undo[0].snapshot.tracks.push({...clip(),start:3});
    assert.throws(()=>parseRecoveryRecord(JSON.stringify(record)),/duplicate clip/);
    record.history.undo[0].snapshot.tracks.pop();
    record.history.undo[0].snapshot.selectedTrackIds='incorrect';
    assert.throws(()=>parseRecoveryRecord(JSON.stringify(record)),/Undo\/Redo/);
});
test('oversized editing history trims oldest snapshots instead of losing the active timeline',()=>{
    const huge=clip({sourceName:'media'.repeat(22000)});
    const snapshot={files:[file()],tracks:[huge],selectedTrackIds:[],currentTime:0};
    const edits=Array.from({length:60},(_,n)=>({label:'edit '+n,snapshot}));
    const record=createRecoveryRecord({files:[file()],tracks:[clip()],
        history:{undo:edits,redo:[]}});
    const result=parseRecoveryRecord(serializeRecoveryRecord(record));
    assert.equal(result.tracks.length,1);
    assert.ok(result.history.undo.length>0 && result.history.undo.length<60);
    assert.equal(result.history.undo.at(-1).label,'edit 59');
});

test('quota-aware recovery keeps active timeline and newest history without altering memory',()=>{
    const source={files:[file()],tracks:[clip({sourceName:'source.mp4'})],
        selectedTrackIds:['clip-1'],selectedTrackId:'clip-1',currentTime:0};
    const edits=Array.from({length:60},(_,i)=>({
        label:'Drag clip '+i,
        snapshot:{...source,tracks:[clip({start:i,sourceName:'long-name-'.repeat(90)+'.mp4'})]}
    }));
    const record=createRecoveryRecord({files:[file()],tracks:[clip({start:14})],
        history:{undo:edits,redo:[]}});
    const original=record.history.undo.length;
    const stored=new Map();
    const storage={
        setItem(key,json){
            if(json.length>12000)throw Object.assign(new Error('Storage full'),{name:'QuotaExceededError'});
            stored.set(key,json);
        }
    };
    const result=writeRecoveryRecordWithQuota(storage,'recovery',record);
    const restored=parseRecoveryRecord(stored.get('recovery'));
    assert.equal(result.truncated,true);
    assert.ok(result.undoCount>0 && result.undoCount<original);
    assert.equal(result.redoCount,0);
    assert.equal(restored.tracks[0].start,14,'Active timeline must never be trimmed');
    assert.equal(restored.history.undo.at(-1).label,'Drag clip 59','Newest history must survive');
    assert.equal(record.history.undo.length,original,'Live history must remain complete');
});
test('quota-aware recovery fails atomically if even active project metadata will not fit',()=>{
    let previous='good-existing-recovery';
    const storage={setItem(){
        throw Object.assign(new Error('Storage full'),{name:'QuotaExceededError'});
    },getItem(){return previous;}};
    const record=createRecoveryRecord({files:[file()],tracks:[clip()],
        history:{undo:[],redo:[]}});
    assert.throws(()=>writeRecoveryRecordWithQuota(storage,'recovery',record),/Storage full/);
    assert.equal(storage.getItem('recovery'),previous);
});
test('non-quota storage failures are not masked by trimming history',()=>{
    let calls=0;
    const storage={setItem(){calls++;throw Object.assign(new Error('Blocked'),{name:'SecurityError'});}};
    const record=createRecoveryRecord({files:[file()],tracks:[clip()],
        history:{undo:[{label:'A',snapshot:{
            files:[file()],tracks:[clip()],selectedTrackIds:[],currentTime:0
        }}],redo:[]}});
    assert.throws(()=>writeRecoveryRecordWithQuota(storage,'recovery',record),/Blocked/);
    assert.equal(calls,1);
});

test('saved Undo/Redo keeps the historical cue markers, canvas size and FPS',()=>{
    const snapshot={files:[file()],tracks:[clip()],selectedTrackIds:['clip-1'],currentTime:0,
        markers:[0.25,4.5],settings:{canvasWidth:640,canvasHeight:360,fps:25,previewZoom:115}};
    const record=createRecoveryRecord({files:[file()],tracks:[clip()],
        canvasWidth:1920,canvasHeight:1080,fps:30,markers:[2],
        history:{undo:[{label:'Change canvas resolution',snapshot}],
            redo:[{label:'Add cue marker',snapshot:{...snapshot,markers:[0.25,4.5,7]}}]}});
    const loaded=parseRecoveryRecord(serializeRecoveryRecord(record));
    assert.deepEqual(loaded.history.undo[0].snapshot.markers,[0.25,4.5]);
    assert.deepEqual(loaded.history.undo[0].snapshot.settings,
        {canvasWidth:640,canvasHeight:360,fps:25,previewZoom:115});
    assert.deepEqual(loaded.history.redo[0].snapshot.markers,[0.25,4.5,7]);
    assert.equal(loaded.settings.canvasWidth,1920);
    assert.deepEqual(loaded.markers,[2]);
});
test('reject invalid project settings inside Undo even when current project is valid',()=>{
    const snapshot={files:[file()],tracks:[clip()],selectedTrackIds:[],currentTime:0,
        settings:{canvasWidth:100,canvasHeight:100,fps:30,previewZoom:100},markers:[]};
    const record=createRecoveryRecord({files:[file()],tracks:[clip()],
        history:{undo:[{label:'Settings edit',snapshot}],redo:[]}});
    record.history.undo[0].snapshot.settings.fps=123;
    assert.throws(()=>parseRecoveryRecord(JSON.stringify(record)),/settings/);
});
