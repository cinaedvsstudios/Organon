import test from 'node:test';
import assert from 'node:assert/strict';
import { AdvancedMediaEngine } from '../js/advanced-media-engine-v0.24.js';
import {
    sourceMime, checkBrowserMediaSupport, mediaFailureMessage, waitForMediaReady
} from '../js/media-support.mjs';

class FakePlayer {
    constructor(kind='video', { fail=false, support='maybe' }={}) {
        this.kind=kind;this.listeners=new Map();this.paused=true;
        this.readyState=0;this.duration=12;this.currentTime=0;
        this.videoWidth=1280;this.videoHeight=720;
        this._src='';this.fail=fail;this.support=support;this.error=null;
        this.playCalls=0;this.pauseCalls=0;this.volume=1;this.muted=false;
    }
    addEventListener(event,callback) {
        if(!this.listeners.has(event))this.listeners.set(event,new Set());
        this.listeners.get(event).add(callback);
    }
    removeEventListener(event,callback) { this.listeners.get(event)?.delete(callback); }
    emit(event) { for(const cb of [...(this.listeners.get(event)||[])])cb(); }
    canPlayType() { return this.support; }
    set src(value) {
        this._src=value;
        queueMicrotask(()=>{
            if(this.fail) { this.error={code:3};this.emit('error');return; }
            this.readyState=1;this.emit('loadedmetadata');
            queueMicrotask(()=>{this.readyState=2;this.emit('loadeddata')});
        });
    }
    get src(){return this._src}
    play(){this.playCalls++;this.paused=false;return Promise.resolve()}
    pause(){this.pauseCalls++;this.paused=true}
    removeAttribute(name){if(name==='src')this._src=''}
    load(){}
    remove(){this.parentNode=null}
}
const mkTrack=(id,type,start=0,duration=10,order=1,media=null)=>({
    id,type,start,clipDuration:duration,sourceName:id,order,visible:true,
    opacity:1,blendMode:'source-over',sourceOffset:0,sourceDuration:20,
    audio:{volume:1,muted:false,fadeIn:0,fadeOut:0},media
});
function setup({fail=false,support='maybe'}={}) {
    const previousDoc=globalThis.document,previousImage=globalThis.Image;
    const previousCreate=URL.createObjectURL,previousRevoke=URL.revokeObjectURL;
    const constructed=[],connections=[],errors=[],draws=[],revoked=[];
    let objectSerial=0;
    const stack=[];
    const context={
        globalAlpha:1,globalCompositeOperation:'source-over',fillStyle:'black',
        save(){stack.push({alpha:this.globalAlpha,mode:this.globalCompositeOperation})},
        restore(){const saved=stack.pop();this.globalAlpha=saved.alpha;this.globalCompositeOperation=saved.mode},
        clearRect(){},fillRect(){},
        drawImage(media){draws.push({id:media.kind||media.id,alpha:this.globalAlpha,mode:this.globalCompositeOperation})},
        getImageData(){return {data:new Uint8ClampedArray(4)}},putImageData(){}
    };
    const mediaBin={appendChild(el){el.parentNode=this}};
    globalThis.document={
        createElement(kind) {
            if(kind==='canvas')return {width:0,height:0,getContext(){return context}};
            const element=new FakePlayer(kind,{fail,support});
            constructed.push(element);return element;
        }
    };
    globalThis.Image=class {
        constructor(){this.kind='image';this.naturalWidth=1280;this.naturalHeight=720;this.complete=false;this.listeners=new Map()}
        addEventListener(type,cb){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(cb)}
        removeEventListener(type,cb){this.listeners.get(type)?.delete(cb)}
        set src(value){this._src=value;queueMicrotask(()=>{this.complete=true;for(const cb of [...(this.listeners.get('load')||[])])cb()})}
        get src(){return this._src}
    };
    URL.createObjectURL=()=> 'blob:test-'+(++objectSerial);
    URL.revokeObjectURL=u=>revoked.push(u);
    const engine=new AdvancedMediaEngine({
        canvas:{width:1280,height:720,getContext(){return context}},mediaBin,
        onTimeChange(){},onDurationChange(){},onPlaybackChange(){},
        onRenderError(err){errors.push(err.message)}
    });
    engine.ensureAudioGraph=async()=>{
        if(engine.audioContext)return;
        engine.audioContext={
            state:'running',currentTime:0,
            createMediaElementSource(player){
                connections.push(player);
                return {connect(){},disconnect(){}};
            },
            createGain(){return {gain:{value:1},connect(){},disconnect(){}}}
        };
        engine.previewGain={gain:{value:1},connect(){},disconnect(){}};
    };
    return {engine,constructed,connections,errors,draws,revoked,context,
        cleanup(){
            engine.clearAll();
            globalThis.document=previousDoc;globalThis.Image=previousImage;
            URL.createObjectURL=previousCreate;URL.revokeObjectURL=previousRevoke;
        }
    };
}
test('MIME detection respects supplied type and falls back to extension',()=>{
    assert.equal(sourceMime({name:'clip.mp4',type:''}),'video/mp4');
    assert.equal(sourceMime({name:'music.m4a',type:'application/octet-stream'}),'audio/mp4');
    assert.equal(sourceMime({name:'unknown.abc',type:''}),'');
});
test('unsupported codecs/containers produce an actionable message',()=>{
    assert.throws(()=>checkBrowserMediaSupport({canPlayType:()=>''},{name:'bad.mkv',type:''}),/cannot play video\/x-matroska/);
    assert.doesNotThrow(()=>checkBrowserMediaSupport({canPlayType:()=> 'maybe'},{name:'okay.mp4',type:''}));
    assert.match(mediaFailureMessage({error:{code:3}},'Clip X'),/decode/);
    assert.match(mediaFailureMessage({error:{code:4}},'Clip X'),/not supported/);
});
test('load readiness rejects broken media on error instead of hanging',async()=>{
    const player=new FakePlayer('video',{fail:true});
    const pending=waitForMediaReady(player,'loadedmetadata',{label:'Broken video',timeoutMs:150});
    player.src='blob:bad';
    await assert.rejects(pending,/could not decode/);
});
test('load readiness times out cleanly when browser emits no metadata',async()=>{
    const player=new FakePlayer();
    await assert.rejects(
        waitForMediaReady(player,'loadedmetadata',{label:'Stalled clip',timeoutMs:100}),
        /loading timed out/
    );
});
test('an imported video uses one element for picture and sound output',async()=>{
    const app=setup();
    try {
        const track=mkTrack('clip','video');
        app.engine.setTracks([track]);
        await app.engine.loadTrack(track,{name:'clip.mp4',type:'video/mp4'});
        assert.equal(app.constructed.length,1);
        assert.equal(app.constructed[0].kind,'video');
        assert.equal(track.media,app.constructed[0]);
        assert.equal(track.soundMedia,null);
        assert.equal(app.connections[0],track.media);
        assert.equal(track.media.muted,false);
        app.engine.currentTime=1;app.engine.startTrackMedia(track,1);
        assert.equal(track.media.playCalls,1);
        assert.equal(track.media.currentTime,1);
        assert.equal(app.draws.at(-1).id,'video');
    }finally{app.cleanup()}
});
test('silent video remains importable through one media-element audio source',async()=>{
    const app=setup();
    try{
        const track=mkTrack('silent','video');
        app.engine.setTracks([track]);
        await app.engine.loadTrack(track,{name:'silent.mp4',type:'video/mp4'});
        assert.equal(app.connections.length,1);
        assert.equal(track.soundMedia,null);
    }finally{app.cleanup()}
});
test('separate music audio clips still use an audio element and mixer',async()=>{
    const app=setup();
    try{
        const track=mkTrack('song','audio');
        app.engine.setTracks([track]);
        await app.engine.loadTrack(track,{name:'song.mp3',type:'audio/mpeg'});
        assert.equal(app.constructed.length,1);
        assert.equal(app.constructed[0].kind,'audio');
        assert.equal(app.connections[0],track.media);
    }finally{app.cleanup()}
});
test('linked video mute, volume and fades remain controlled via Web Audio gain',async()=>{
    const app=setup();
    try{
        const track=mkTrack('clip','video');
        track.audio={volume:.6,muted:false,fadeIn:2,fadeOut:2};
        app.engine.setTracks([track]);
        await app.engine.loadTrack(track,{name:'clip.mp4',type:'video/mp4'});
        app.engine.syncAudioSettings(1);
        assert.equal(track.gainNode.gain.value,.3);
        track.audio.muted=true;app.engine.syncAudioSettings(1);
        assert.equal(track.gainNode.gain.value,0);
        track.audio.muted=false;app.engine.syncAudioSettings(5);
        assert.equal(track.gainNode.gain.value,.6);
    }finally{app.cleanup()}
});
test('decoder failures during playback show a useful preview error',async()=>{
    const app=setup();
    try{
        const track=mkTrack('clip','video');
        app.engine.setTracks([track]);
        await app.engine.loadTrack(track,{name:'clip.mp4',type:'video/mp4'});
        track.media.error={code:3};track.media.emit('error');
        assert.equal(app.errors.length,1);
        assert.match(app.errors[0],/decode/);
    }finally{app.cleanup()}
});
test('video codec load failures release the object URL and do not leave a clip playing',async()=>{
    const app=setup({fail:true});
    try{
        const track=mkTrack('bad','video');
        app.engine.setTracks([track]);
        await assert.rejects(app.engine.loadTrack(track,{name:'bad.mp4',type:'video/mp4'}),/decode/);
        assert.equal(track.media,null);
        assert.deepEqual(app.revoked,['blob:test-1']);
    }finally{app.cleanup()}
});
test('composite order is background then lower videos then upper video then PNG stickers',()=>{
    const app=setup();
    try{
        const background={kind:'background',naturalWidth:1280,naturalHeight:720};
        const lower={kind:'video-low',videoWidth:1280,videoHeight:720,readyState:2};
        const upper={kind:'video-high',videoWidth:1280,videoHeight:720,readyState:2};
        const png={kind:'png',naturalWidth:400,naturalHeight:400};
        const tracks=[
            mkTrack('top-sticker','sticker',0,10,1,png),
            mkTrack('upper-video','video',0,10,1,upper),
            mkTrack('lower-video','video',0,10,2,lower),
            mkTrack('floor','background',0,10,1,background)
        ];
        tracks[1].opacity=.5; tracks[1].blendMode='screen';
        app.engine.setTracks(tracks);
        assert.deepEqual(app.draws.map(x=>x.id),['background','video-low','video-high','png']);
        assert.equal(app.draws[2].alpha,.5);
        assert.equal(app.draws[2].mode,'screen');
        assert.equal(app.context.globalAlpha,1,'renderer restores alpha');
        assert.equal(app.context.globalCompositeOperation,'source-over','renderer restores blend mode');
    }finally{app.cleanup()}
});
test('hidden video and opacity-zero layers do not obscure lower background',()=>{
    const app=setup();
    try{
        const background=mkTrack('background','background',0,10,1,{kind:'background',naturalWidth:1280,naturalHeight:720});
        const invisible=mkTrack('hidden','video',0,10,1,{kind:'hidden',videoWidth:1280,videoHeight:720,readyState:2});
        const faded=mkTrack('faded','video',0,10,2,{kind:'faded',videoWidth:1280,videoHeight:720,readyState:2});
        invisible.visible=false;faded.opacity=0;
        app.engine.setTracks([invisible,faded,background]);
        assert.deepEqual(app.draws.map(x=>x.id),['background']);
    }finally{app.cleanup()}
});
test('a bad layer does not stop good layers from rendering',()=>{
    const app=setup();
    try{
        const background=mkTrack('background','background',0,10,1,{kind:'background',naturalWidth:1280,naturalHeight:720});
        const broken=mkTrack('broken','video',0,10,1,{kind:'broken',videoWidth:1280,videoHeight:720,readyState:2});
        const png=mkTrack('png','sticker',0,10,1,{kind:'png',naturalWidth:400,naturalHeight:400});
        app.context.drawImage=function(media){
            if(media.kind==='broken')throw Error('corrupt frame');
            app.draws.push({id:media.kind,alpha:this.globalAlpha,mode:this.globalCompositeOperation});
        };
        app.engine.setTracks([background,broken,png]);
        assert.deepEqual(app.draws.map(x=>x.id),['background','png']);
        assert.equal(app.errors.length,1);
        assert.equal(app.context.globalAlpha,1);
        assert.equal(app.context.globalCompositeOperation,'source-over');
    }finally{app.cleanup()}
});
