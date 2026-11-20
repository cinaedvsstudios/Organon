import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord,
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
