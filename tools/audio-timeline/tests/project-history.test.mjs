import test from 'node:test';
import assert from 'node:assert/strict';
import {
    snapshotProject, snapshotClip, restoreFileEntries, validateTrackRecords,
    referencedFileIds, applyClipData, prepareHistoryTracks
} from '../js/project-history.mjs';
import { AdvancedMediaEngine } from '../js/advanced-media-engine-v0.24.js';

const rawFile = (name='a.mp4') => ({ name, size:42, lastModified:1 });
const clip = (fileId='file-a', id='clip-a') => ({
    id, type:'video', laneId:'video-1', laneLabel:'Video 1', label:'Video 1',
    order:1, start:2, sourceOffset:1, clipDuration:3, sourceDuration:10,
    sourceFileId:fileId, sourceName:'a.mp4', fileType:'video/mp4',
    visible:true, opacity:.8, blendMode:'source-over', groupId:null,
    audio:{volume:.6, muted:false, fadeIn:.2, fadeOut:.2},
    transparency:{mode:'native', keyColour:'#00ff00', tolerance:30, feather:8},
    analysis:{levels:[.1,.7],sampleCount:2,analysed:true}
});
test('history snapshot excludes media elements, audio nodes, object URLs and File objects', () => {
    const file=rawFile();
    const track={...clip(),file,objectUrl:'blob:large',media:{tag:'video'},soundMedia:{tag:'audio'},audioNode:{tag:'audio-node'},gainNode:{tag:'gain'}};
    track.media.parent=track; // deliberately circular; must not be copied
    const state=snapshotProject({
        files:[{id:'file-a',name:file.name,kind:'video',file}],
        tracks:[track], selectedTrackIds:new Set([track.id]),
        selectedTrackId:track.id,selectedFileId:'file-a',currentTime:2.2
    });
    assert.doesNotThrow(()=>JSON.stringify(state));
    assert.equal(state.tracks[0].media,undefined);
    assert.equal(state.tracks[0].file,undefined);
    assert.equal(state.tracks[0].objectUrl,undefined);
    assert.equal(state.tracks[0].gainNode,undefined);
    assert.equal(state.files[0].file,undefined);
    assert.equal(state.tracks[0].sourceFileId,'file-a');
});
test('snapshots deeply copy editable nested options and peak strips', () => {
    const track=clip();
    const saved=snapshotClip(track);
    track.audio.volume=.1; track.transparency.keyColour='#123456'; track.analysis.levels[0]=.9;
    assert.equal(saved.audio.volume,.6);
    assert.equal(saved.transparency.keyColour,'#00ff00');
    assert.deepEqual(saved.analysis.levels,[.1,.7]);
});
test('file registry rehydrates project-bin entries without snapshotting binary data', () => {
    const file=rawFile(), sources=new Map([['file-a',file]]);
    const restored=restoreFileEntries([{id:'file-a',name:'a.mp4',kind:'video'}],sources);
    assert.equal(restored.length,1);
    assert.equal(restored[0].file,file);
    assert.deepEqual(restoreFileEntries([{id:'missing',name:'gone.mp4',kind:'video'}],sources),[]);
});
test('validation rejects duplicate clips and invalid timeline offsets', () => {
    const sources=new Map([['file-a',rawFile()]]);
    assert.throws(()=>validateTrackRecords([clip(),clip()],sources),/Duplicate/);
    assert.throws(()=>validateTrackRecords([{...clip(),start:-1}],sources),/Invalid start/);
    assert.throws(()=>validateTrackRecords([{...clip(),clipDuration:NaN}],sources),/Invalid clipDuration/);
    assert.throws(()=>validateTrackRecords([clip('missing')],sources),/Missing source/);
    assert.doesNotThrow(()=>validateTrackRecords([clip()],sources));
});
test('history source retention includes files used only by redo or cleared-project undo', () => {
    const saved=snapshotProject({ files:[{id:'file-old',name:'old.mp4',kind:'video'}],
        tracks:[clip('file-old','old-clip')],selectedTrackIds:new Set(),currentTime:0 });
    const keep=referencedFileIds([],[],[{label:'Clear project',snapshot:saved}],[
        {label:'Import media',snapshot:{files:[{id:'file-new',name:'new.mp4'}],tracks:[]}}
    ]);
    assert.equal(keep.has('file-old'),true);
    assert.equal(keep.has('file-new'),true);
    assert.equal(keep.has('unreferenced'),false);
});
test('restoring a trim reuses the existing video/audio players', async () => {
    const existing={...clip(),file:rawFile(),media:{tag:'live'},soundMedia:{tag:'sound'},objectUrl:'blob:live'};
    const sources=new Map([['file-a',existing.file]]);
    const revised={...snapshotClip(existing),start:5,clipDuration:1.5,sourceOffset:3};
    let loads=0,disposed=0;
    const pending=await prepareHistoryTracks({
        records:[revised],existingTracks:[existing],sourceFiles:sources,
        async loadTrack(){loads++},disposeTrack(){disposed++}
    });
    assert.equal(loads,0);
    assert.equal(existing.start,2,'changes must be deferred until commit');
    pending.commit();
    assert.equal(pending.tracks[0],existing);
    assert.equal(existing.start,5);
    assert.equal(existing.clipDuration,1.5);
    assert.equal(existing.sourceOffset,3);
    assert.equal(existing.objectUrl,'blob:live');
    assert.equal(existing.media.tag,'live');
    assert.equal(disposed,0);
});
test('undoing a deletion recreates its media from the cached source File', async () => {
    const sources=new Map([['file-a',rawFile()]]);
    const desired={...clip(),sourceOffset:4,clipDuration:2,start:8};
    let loadedFile;
    const pending=await prepareHistoryTracks({
        records:[desired],existingTracks:[],sourceFiles:sources,
        async loadTrack(track,file){
            loadedFile=file;
            track.media={tag:'new video'};track.file=file;track.sourceName=file.name;
            track.clipDuration=10;track.sourceOffset=0;
        },
        disposeTrack(){throw Error('Unexpected disposal')}
    });
    pending.commit();
    assert.equal(loadedFile,sources.get('file-a'));
    assert.equal(pending.tracks[0].clipDuration,2);
    assert.equal(pending.tracks[0].sourceOffset,4);
    assert.equal(pending.tracks[0].start,8);
    assert.equal(pending.tracks[0].media.tag,'new video');
});
test('failed multi-clip restore cleans newly created tracks and preserves existing state', async () => {
    const original={...clip(),media:{tag:'old'},file:rawFile()};
    const files=new Map([['file-a',original.file],['file-b',rawFile('b.mp4')]]);
    const before=JSON.stringify(snapshotClip(original));
    const released=[];
    await assert.rejects(()=>prepareHistoryTracks({
        records:[clip('file-b','recreated'),clip('file-a','fails')],
        existingTracks:[original],sourceFiles:files,
        async loadTrack(track){
            if(track.id==='fails')throw Error('Decoder refused');
            track.media={tag:'new'};track.file=files.get('file-b');
        },
        disposeTrack(track){released.push(track.id)}
    }),/Decoder refused/);
    assert.deepEqual(released,['recreated']);
    assert.equal(JSON.stringify(snapshotClip(original)),before);
    assert.equal(original.media.tag,'old');
});
test('applying data never overwrites the runtime media source', () => {
    const source={...clip(),media:{tag:'movie'},file:rawFile(),audioNode:{id:5}};
    applyClipData(source,{...snapshotClip(source),groupId:'group-2',audio:{volume:.2,muted:true,fadeIn:0,fadeOut:0}});
    assert.equal(source.groupId,'group-2');
    assert.equal(source.audioNode.id,5);
    assert.equal(source.media.tag,'movie');
});

function fakeEngine() {
    const oldDocument=globalThis.document;
    const originalRevoke=URL.revokeObjectURL;
    const revoked=[];
    const ctx={save(){},restore(){},clearRect(){},fillRect(){},drawImage(){}};
    globalThis.document={createElement(type){if(type==='canvas')return {getContext:()=>ctx};throw Error(type)}};
    URL.revokeObjectURL=url=>revoked.push(url);
    const engine=new AdvancedMediaEngine({
        canvas:{width:1280,height:720,getContext:()=>ctx},mediaBin:{},
        onTimeChange(){},onDurationChange(){},onPlaybackChange(){},onRenderError(error){throw error}
    });
    const track=(id)=> {
        const media={
            readyState:2,videoWidth:100,videoHeight:100,paused:false,
            removeAttributeCalls:0,loadCalls:0,pauseCalls:0,
            pause(){this.paused=true;this.pauseCalls++},
            removeAttribute(name){if(name==='src')this.removeAttributeCalls++},
            load(){this.loadCalls++}
        };
        return {...clip('file-a',id),media,file:rawFile(),objectUrl:'blob:'+id,
            soundMedia:null,
            audioNode:{disconnected:0,disconnect(){this.disconnected++}},
            gainNode:{gain:{value:1},disconnected:0,disconnect(){this.disconnected++}}};
    };
    return {
        engine,revoked,track,
        cleanup(){
            engine.clearAll();
            URL.revokeObjectURL=originalRevoke;
            globalThis.document=oldDocument;
        }
    };
}
test('array-filter removal releases media URL/player and disconnects audio nodes exactly once',()=>{
    const app=fakeEngine();
    try{
        const one=app.track('one'),two=app.track('two');
        app.engine.setTracks([one,two]);
        app.engine.setTracks([two]);
        assert.deepEqual(app.revoked,['blob:one']);
        assert.equal(one.media,null);
        assert.equal(one.audioNode,null);
        assert.equal(one.file,null);
        assert.equal(two.objectUrl,'blob:two');
        app.engine.setTracks([two]);
        assert.deepEqual(app.revoked,['blob:one']);
    }finally{app.cleanup()}
});
test('clearAll stops every media track and permits importing new ones',()=>{
    const app=fakeEngine();
    try{
        const one=app.track('one'),two=app.track('two');
        app.engine.setTracks([one,two]);
        app.engine.clearAll();
        assert.deepEqual(app.revoked,['blob:one','blob:two']);
        assert.equal(app.engine.tracks.length,0);
        assert.equal(one.objectUrl,null);
        assert.equal(two.objectUrl,null);
        const next=app.track('next');
        app.engine.setTracks([next]);
        assert.equal(app.engine.tracks.length,1);
        app.engine.clearAll();
        assert.deepEqual(app.revoked,['blob:one','blob:two','blob:next']);
    }finally{app.cleanup()}
});

test('clearing while a video is loading aborts its metadata wait and revokes its URL', async () => {
    const app=fakeEngine();
    const oldCreate=URL.createObjectURL;
    const oldElementFactory=globalThis.document.createElement;
    const removed=[];
    try {
        URL.createObjectURL=()=> 'blob:pending';
        const mediaBin={appendChild(element){element.parentNode=this}};
        app.engine.mediaBin=mediaBin;
        globalThis.document.createElement=(type)=>{
            if(type==='canvas')return {getContext(){return {}}};
            const listeners=new Map();
            return {
                readyState:0, paused:true, src:'', parentNode:null,
                addEventListener(name,fn){
                    if(!listeners.has(name))listeners.set(name,new Set());
                    listeners.get(name).add(fn);
                },
                removeEventListener(name,fn){listeners.get(name)?.delete(fn)},
                pause(){this.paused=true},
                removeAttribute(name){if(name==='src')this.src=''},
                load(){},
                remove(){removed.push(type);this.parentNode=null}
            };
        };
        const track={...clip(),media:null,file:null};
        const loading=app.engine.loadTrack(track,rawFile());
        assert.equal(app.engine.loadingTracks.has(track),true);
        app.engine.clearAll();
        await assert.rejects(()=>loading,/cancelled/);
        assert.equal(app.engine.loadingTracks.size,0);
        assert.equal(track.media,null);
        assert.equal(track.objectUrl,null);
        assert.deepEqual(app.revoked,['blob:pending']);
        assert.deepEqual(removed,['video']);
    } finally {
        URL.createObjectURL=oldCreate;
        globalThis.document.createElement=oldElementFactory;
        app.cleanup();
    }
});
test('removing a pending clip from setTracks cancels its decoder load', async () => {
    const app=fakeEngine();
    const oldCreate=URL.createObjectURL,oldFactory=globalThis.document.createElement;
    try {
        URL.createObjectURL=()=> 'blob:unloaded';
        app.engine.mediaBin={appendChild(element){element.parentNode=this}};
        globalThis.document.createElement=(type)=>{
            if(type==='canvas')return {getContext(){return {}}};
            const listeners=new Map();
            return {
                readyState:0,src:'',paused:true,
                addEventListener(event,cb){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(cb)},
                removeEventListener(event,cb){listeners.get(event)?.delete(cb)},
                pause(){this.paused=true},removeAttribute(){},load(){},remove(){this.parentNode=null}
            };
        };
        const track={...clip(),media:null,file:null};
        const loading=app.engine.loadTrack(track,rawFile());
        app.engine.setTracks([track]);
        app.engine.setTracks([]);
        await assert.rejects(()=>loading,/cancelled/);
        assert.equal(track.media,null);
        assert.equal(track.objectUrl,null);
        assert.deepEqual(app.revoked,['blob:unloaded']);
    }finally{
        URL.createObjectURL=oldCreate;
        globalThis.document.createElement=oldFactory;
        app.cleanup();
    }
});
