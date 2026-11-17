import test from 'node:test';
import assert from 'node:assert/strict';
import { AdvancedLiveExporter, supportedExportFormats, selectExportFormat, exportBitrate } from '../js/advanced-live-export.mjs';

class FakeRecorder {
    static supported = ['video/webm;codecs=vp8,opus','video/webm','video/mp4'];
    static latest = null;
    static isTypeSupported(type) { return this.supported.includes(type); }
    constructor(stream, options) {
        this.stream=stream; this.options=options; this.state='inactive';this.mimeType=options.mimeType;
        this.ondataavailable=null;this.onstop=null;this.onerror=null;
        this.started=false;this.stopped=false;FakeRecorder.latest=this;
    }
    start() { this.state='recording';this.started=true; }
    stop() {
        if(this.state==='inactive')throw Error('already stopped');
        this.state='inactive';this.stopped=true;
        queueMicrotask(()=>{
            this.ondataavailable?.({data:{size:120,tag:'video-chunk'}});
            this.onstop?.();
        });
    }
}
class FakeStream {
    constructor(tracks) {this.tracks=tracks}
    getTracks(){return this.tracks}
    getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}
    getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}
}
const fakeTrack=kind=>({kind,stopped:0,stop(){this.stopped++}});
function fixture({duration=10,audio=true,hasRecorder=true,visibilityHidden=false,failedSeek=false,callbackDefined=true}={}) {
    const video=fakeTrack('video'),audioTrack=fakeTrack('audio');
    const visibilityListeners=new Set();
    const visibility={hidden:visibilityHidden,
        addEventListener(name,fn){if(name==='visibilitychange')visibilityListeners.add(fn)},
        removeEventListener(name,fn){if(name==='visibilitychange')visibilityListeners.delete(fn)},
        hide(){this.hidden=true;for(const fn of [...visibilityListeners])fn()},
        visible(){this.hidden=false;for(const fn of [...visibilityListeners])fn()},
        get count(){return visibilityListeners.size}
    };
    const canvas={width:1280,height:720,captureStream(fps){this.requestedFps=fps;return new FakeStream([video])}};
    let connected=0,disconnected=0,downloaded=[],states=[],progress=[];
    const gain={gain:{value:1},connect(target){connected++;this.destination=target},
        disconnect(target){if(target!==this.destination)throw Error('Wrong export destination');disconnected++}};
    const engine={
        currentTime:4,isPlaying:false,tracks:audio?[{gainNode:gain}]:[],
        previewGain:{gain:{value:.4}},
        onPlaybackChange:callbackDefined?()=>{}:undefined,
        getTimelineDuration(){return duration},
        getCurrentTime(){return this.currentTime},
        async ensureAudioGraph(){
            this.audioContext={state:'running',
                createMediaStreamDestination(){return {stream:new FakeStream([audioTrack])}}};
        },
        async seek(time){
            if(failedSeek)return false;
            this.currentTime=time;
            return true;
        },
        async play(){this.isPlaying=true;this.onPlaybackChange?.(true)},
        pause(){this.isPlaying=false;this.onPlaybackChange?.(false)},
        applyPreviewGain(){this.previewGain.gain.value=.4},
        end(){this.currentTime=duration;this.isPlaying=false;this.onPlaybackChange?.(false)}
    };
    let lastRequested, nextFrame=0;
    const callbacks=new Map();
    const exporter=new AdvancedLiveExporter({
        engine,canvas,
        Recorder:hasRecorder?FakeRecorder:null,
        Stream:FakeStream,visibilityTarget:visibility,
        requestFrame(fn){const id=++nextFrame;callbacks.set(id,fn);lastRequested=id;return id},
        cancelFrame(id){callbacks.delete(id)},
        onState(evt){states.push(evt)},
        onProgress(evt){progress.push(evt)},
        onDownload(outcome){downloaded.push(outcome)}
    });
    return {exporter,engine,canvas,video,audioTrack,visibility,downloaded,states,progress,
        get connected(){return connected},get disconnected(){return disconnected},
        get callbacks(){return callbacks.size},
        async settlePrepare(){for(let i=0;i<12;i++)await Promise.resolve()},
        nextFrame(){const f=callbacks.get(lastRequested);callbacks.delete(lastRequested);f?.()}
    };
}
test('format selector only lists containers truly supported by the recorder',()=>{
    assert.deepEqual(supportedExportFormats(FakeRecorder).map(x=>x.format),['webm','mp4']);
    assert.match(selectExportFormat('webm',FakeRecorder).mimeType,/webm/);
    assert.match(selectExportFormat('mp4',FakeRecorder).mimeType,/mp4/);
    assert.equal(supportedExportFormats(null).length,0);
    assert.throws(()=>selectExportFormat('avi',FakeRecorder),/not available/);
});
test('bitrate and FPS use the supported preset options',()=>{
    assert.equal(exportBitrate(3000),3000000);
    assert.equal(exportBitrate(10000),10000000);
    assert.equal(exportBitrate(-1),6000000);
});
test('full-timeline export combines the composition canvas and linked audio mix',async()=>{
    const app=fixture();
    const old=app.engine.onPlaybackChange;
    const output=app.exporter.start({format:'webm',fps:25,bitrateKbps:10000});
    await app.settlePrepare();
    assert.equal(app.exporter.phase,'recording');
    assert.equal(app.canvas.requestedFps,25);
    assert.equal(app.engine.currentTime,0);
    assert.equal(app.engine.previewGain.gain.value,0,'speakers muted while mix records');
    assert.equal(FakeRecorder.latest.stream.getVideoTracks().length,1);
    assert.equal(FakeRecorder.latest.stream.getAudioTracks().length,1);
    assert.equal(app.connected,1);
    assert.equal(FakeRecorder.latest.options.videoBitsPerSecond,10000000);
    app.engine.currentTime=4;app.nextFrame();
    assert.ok(app.progress.some(x=>x.percent===40));
    app.engine.end();
    const finished=await output;
    assert.equal(finished.extension,'webm');
    assert.equal(finished.width,1280);
    assert.equal(finished.height,720);
    assert.equal(finished.blob.size,120);
    assert.equal(app.downloaded.length,1);
    assert.equal(app.engine.currentTime,4,'original playhead position restored');
    assert.equal(app.engine.previewGain.gain.value,.4);
    assert.equal(app.engine.onPlaybackChange,old);
    assert.equal(app.connected,1);
    assert.equal(app.disconnected,1);
    assert.equal(app.video.stopped,1);
    assert.equal(app.audioTrack.stopped,1);
    assert.equal(app.visibility.count,0);
    assert.equal(app.exporter.busy,false);
    assert.equal(app.callbacks,0);
});
test('video-only projects produce no redundant audio stream track',async()=>{
    const app=fixture({audio:false});
    const output=app.exporter.start({format:'webm'});
    await app.settlePrepare();
    assert.equal(FakeRecorder.latest.stream.getAudioTracks().length,0);
    app.engine.end();
    const result=await output;
    assert.equal(result.extension,'webm');
    assert.equal(app.connected,0);
});
test('MP4 is recorded and labeled MP4 only when the browser supports it',async()=>{
    const app=fixture();
    const output=app.exporter.start({format:'mp4'});
    await app.settlePrepare();
    assert.equal(FakeRecorder.latest.options.mimeType,'video/mp4');
    app.engine.end();
    const result=await output;
    assert.equal(result.extension,'mp4');
    assert.equal(result.blob.type,'video/mp4');
});
test('cancel discards partial recording and restores preview audio',async()=>{
    const app=fixture();
    const output=app.exporter.start({format:'webm'});
    await app.settlePrepare();
    const cancel=app.exporter.cancel();
    assert.equal(await output,null);
    await cancel;
    assert.equal(app.downloaded.length,0);
    assert.equal(app.engine.previewGain.gain.value,.4);
    assert.equal(app.video.stopped,1);
    assert.equal(app.audioTrack.stopped,1);
    assert.ok(app.states.some(x=>x.phase==='cancelled'));
});
test('recording cannot start twice while another export is active',async()=>{
    const app=fixture();
    const output=app.exporter.start({format:'webm'});
    await app.settlePrepare();
    await assert.rejects(app.exporter.start({format:'webm'}),/already in progress/);
    await app.exporter.cancel();
    await output;
});
test('a hidden tab aborts rather than silently saving a corrupt real-time export',async()=>{
    const app=fixture();
    const output=app.exporter.start({format:'webm'});
    await app.settlePrepare();
    app.visibility.visible();
    assert.equal(app.exporter.phase,'recording');
    app.visibility.hide();
    await assert.rejects(output,/tab became hidden/);
    assert.equal(app.downloaded.length,0);
    assert.equal(app.visibility.count,0);
    assert.equal(app.exporter.busy,false);
});
test('recorder encoding errors fail and dispose every capture track',async()=>{
    const app=fixture();
    const output=app.exporter.start({format:'webm'});
    await app.settlePrepare();
    FakeRecorder.latest.onerror?.({error:new Error('encoder failed')});
    await assert.rejects(output,/encoder failed/);
    assert.equal(app.video.stopped,1);
    assert.equal(app.audioTrack.stopped,1);
    assert.equal(app.downloaded.length,0);
});
test('unsupported format, empty timeline and absent capture APIs fail before recording',async()=>{
    const none=fixture({duration:0});
    await assert.rejects(none.exporter.start({format:'webm'}),/Add media/);
    const bad=fixture();
    await assert.rejects(bad.exporter.start({format:'avi'}),/not available/);
    const noApi=fixture({hasRecorder:false});
    await assert.rejects(noApi.exporter.start({format:'webm'}),/not available/);
    assert.equal(none.exporter.busy,false);
    assert.equal(bad.exporter.busy,false);
});
test('failed first-frame seek aborts early and restores original playhead',async()=>{
    const app=fixture({failedSeek:true});
    const output=app.exporter.start({format:'webm'});
    await assert.rejects(output,/first composition frame/);
    assert.equal(app.downloaded.length,0);
    assert.equal(app.exporter.busy,false);
    assert.equal(app.engine.previewGain.gain.value,.4);
});
test('undefined original playback callback is restored after export',async()=>{
    const app=fixture({callbackDefined:false});
    const output=app.exporter.start({format:'webm'});
    await app.settlePrepare();
    app.engine.end();
    await output;
    assert.equal(app.engine.onPlaybackChange,undefined);
});
