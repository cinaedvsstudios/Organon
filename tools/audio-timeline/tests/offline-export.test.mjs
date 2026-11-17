import test from 'node:test';
import assert from 'node:assert/strict';
import {
    offlineFrameSchedule, clipAtTime, clipSourceTime, clipAudioEnvelope,
    fadeBreakpoints, AdvancedOfflineExporter, OFFLINE_EXPORT_LIMIT_SECONDS
} from '../js/advanced-offline-export.mjs';

function source(id, type, opts={}) {
    return {
        id, type, sourceName: id + (type==='audio'?'.wav':'.mp4'),
        file: {name:id+'.mp4'}, start:0, sourceOffset:0,
        sourceDuration:10, clipDuration:1, visible:true, opacity:1,
        audio:{volume:1,muted:false,fadeIn:0,fadeOut:0},...opts
    };
}
function makeEnvironment({ audio=true, failOutput=false }={}) {
    const installed = {
        encoder:globalThis.VideoEncoder, decoder:globalThis.VideoDecoder,
        offline:globalThis.OfflineAudioContext, document:globalThis.document,
    };
    const metrics={frames:[],framesPainted:[],audioAdds:[],schedule:[],inputs:[],finalized:0,cancelled:0,download:[],states:[],audioTracks:0};
    globalThis.VideoEncoder = function VideoEncoder(){};
    globalThis.VideoDecoder = function VideoDecoder(){};
    globalThis.document = {createElement(type){if(type!=='canvas')throw Error('unexpected '+type);return {width:640,height:360}}};
    globalThis.OfflineAudioContext = class OfflineAudioContext {
        constructor(channels, length, rate){metrics.offline={channels,length,rate}; this.destination={}}
        createGain(){return {connect(){},gain:{
            setValueAtTime(value,time){metrics.schedule.push({kind:'value',value,time})},
            linearRampToValueAtTime(value,time){metrics.schedule.push({kind:'ramp',value,time})}
        }}}
        createBufferSource(){return {
            buffer:null,connect(){},
            start(at, offset, duration){metrics.schedule.push({kind:'clip',at,offset,duration})}
        }}
        async startRendering(){return { duration:1,numberOfChannels:2 }}
    };
    class FakeInput {
        constructor({source}){this.source=source;metrics.inputs.push(this)}
        async canRead(){return true}
        async getPrimaryVideoTrack(){return {canDecode:async()=>true}}
        async getPrimaryAudioTrack(){return audio?{canDecode:async()=>true}:null}
        dispose(){this.disposed=true}
    }
    class FakeCanvasSink{
        async getCanvas(time){return {canvas:{width:320,height:180,time},timestamp:time,duration:1/30}}
    }
    class FakeAudioBufferSink{
        async *buffers(){yield {timestamp:0,duration:1,buffer:{duration:1}}}
    }
    class FakeCanvasSource{
        constructor(canvas,{codec,quality}){metrics.videoCodec=codec}
        async add(time,duration,options){metrics.frames.push({time,duration,keyFrame:options?.keyFrame})}
    }
    class FakeAudioBufferSource{
        constructor({codec}){metrics.audioCodec=codec}
        async add(buffer){metrics.audioAdds.push(buffer)}
    }
    class FakeOutput{
        constructor({format,target}){this.state='pending';this.target=target;metrics.output=this}
        addVideoTrack(source){metrics.videoTracks=(metrics.videoTracks||0)+1}
        addAudioTrack(source){metrics.audioTracks++}
        async start(){if(failOutput)throw Error('Encoder unavailable');this.state='started'}
        async finalize(){this.state='finalized';metrics.finalized++;this.target.buffer=new Uint8Array(96)}
        async cancel(){this.state='canceled';metrics.cancelled++}
    }
    const MB={
        Input:FakeInput, BlobSource:class{constructor(file){this.file=file}},
        ALL_FORMATS:[],
        CanvasSink:FakeCanvasSink, AudioBufferSink:FakeAudioBufferSink,
        CanvasSource:FakeCanvasSource, AudioBufferSource:FakeAudioBufferSource,
        Mp4OutputFormat:class {},WebMOutputFormat:class {},
        BufferTarget:class {},Output:FakeOutput, Quality:class{constructor(x){this.options=x}}
    };
    const engine={
        outputWidth:640,outputHeight:360,
        tracks:[source('film','video')],
        getTimelineDuration(){return Math.max(0,...this.tracks.map(t=>t.start+t.clipDuration))}
    };
    const exporter=new AdvancedOfflineExporter({
        engine, libraryLoader:async()=>MB,
        renderEngineFactory:canvas=>({
            tracks:[],currentTime:0,
            renderFrame(){
                metrics.framesPainted.push({
                    time:this.currentTime,
                    clips:this.tracks.map(t=>({id:t.id,time:t.media?.time??null,live:t.media===engine.tracks[0].media}))
                })
            }
        }),
        onProgress:x=>metrics.progress=x,
        onState:x=>metrics.states.push(x),
        onDownload:x=>metrics.download.push(x)
    });
    return {MB,engine,exporter,metrics,restore(){
        globalThis.VideoEncoder=installed.encoder;
        globalThis.VideoDecoder=installed.decoder;
        globalThis.OfflineAudioContext=installed.offline;
        globalThis.document=installed.document;
    }};
}
test('frame schedule uses exact output-grid timestamps and a short final duration',()=>{
    const frames=offlineFrameSchedule(1.05,25);
    assert.equal(frames.length,27);
    assert.equal(frames[0].time,0);
    assert.equal(frames[1].time,.04);
    assert.ok(Math.abs(frames.at(-1).duration-.01)<1e-8);
    assert.throws(()=>offlineFrameSchedule(0,30),/positive/);
});
test('clip time boundaries and trimmed source offset are independent of wall clock',()=>{
    const track=source('a','video',{start:3,clipDuration:2,sourceOffset:5});
    assert.equal(clipAtTime(track,2.99),false);
    assert.equal(clipAtTime(track,3),true);
    assert.equal(clipAtTime(track,5),false);
    assert.equal(clipSourceTime(track,4.25),6.25);
});
test('offline gain follows preview envelopes with overlapping fades',()=>{
    const track=source('a','audio',{clipDuration:2,audio:{volume:.5,fadeIn:1.5,fadeOut:1.5}});
    assert.deepEqual(fadeBreakpoints(track),[0,.5,1,1.5,2]);
    assert.equal(clipAudioEnvelope(track,0),0);
    assert.ok(Math.abs(clipAudioEnvelope(track,1)-2/3)<1e-8);
    assert.equal(clipAudioEnvelope(track,2),0);
});
test('fixed-frame export produces exact-timed video frames and a separate audio mix',async()=>{
    const app=makeEnvironment();
    try{
        const project=app.engine.tracks[0];
        project.media={live:true}; // must never be mutated by offline rendering
        const done=await app.exporter.start({format:'mp4',fps:25,bitrateKbps:6000});
        assert.equal(done,true);
        assert.equal(app.metrics.frames.length,25);
        assert.equal(app.metrics.frames[0].time,0);
        assert.equal(app.metrics.frames[1].time,.04);
        assert.equal(app.metrics.frames.at(-1).time,.96);
        assert.equal(app.metrics.framesPainted.length,25);
        assert.equal(app.metrics.videoCodec,'avc');
        assert.equal(app.metrics.audioCodec,'aac');
        assert.equal(app.metrics.audioTracks,1);
        assert.equal(app.metrics.audioAdds.length,1);
        assert.equal(app.metrics.finalized,1);
        assert.equal(app.metrics.download.length,1);
        assert.equal(app.metrics.download[0].extension,'mp4');
        assert.equal(app.metrics.progress.percent,100);
        assert.equal(project.media.live,true);
        assert.equal(app.metrics.inputs.every(x=>x.disposed),true);
        assert.equal(app.exporter.busy,false);
    }finally{app.restore()}
});
test('silent video exports without synthesizing an unnecessary audio track',async()=>{
    const app=makeEnvironment({audio:false});
    try{
        assert.equal(await app.exporter.start({format:'webm',fps:24}),true);
        assert.equal(app.metrics.audioTracks,0);
        assert.equal(app.metrics.frames.length,24);
        assert.equal(app.metrics.videoCodec,'vp9');
        assert.equal(app.metrics.download[0].extension,'webm');
    }finally{app.restore()}
});
test('video gaps and layered time offsets use local clip positions',async()=>{
    const app=makeEnvironment({audio:false});
    try{
        app.engine.tracks=[source('late','video',{start:.5,sourceOffset:3,clipDuration:.5})];
        assert.equal(await app.exporter.start({format:'webm',fps:24}),true);
        const frames=app.metrics.framesPainted;
        assert.equal(frames.length,24);
        assert.equal(frames[0].clips[0].time,null);
        assert.equal(frames[11].clips[0].time,null);
        assert.equal(frames[12].clips[0].time,3);
        assert.equal(frames[18].clips[0].time,3.25);
    }finally{app.restore()}
});
test('audio clipping schedules trimmed source sections at timeline offsets',async()=>{
    const app=makeEnvironment();
    try{
        app.engine.tracks=[source('music','audio',{start:.4,sourceOffset:.5,clipDuration:.5})];
        assert.equal(await app.exporter.start({format:'mp4',fps:25}),true);
        const played=app.metrics.schedule.filter(x=>x.kind==='clip');
        assert.equal(played.length,1);
        assert.ok(Math.abs(played[0].at-.4)<1e-8);
        assert.ok(Math.abs(played[0].offset-.5)<1e-8);
        assert.ok(Math.abs(played[0].duration-.5)<1e-8);
    }finally{app.restore()}
});
test('encoder failure cancels output, disposes input decoders and does not download',async()=>{
    const app=makeEnvironment({failOutput:true,audio:false});
    try{
        await assert.rejects(()=>app.exporter.start({format:'mp4',fps:25}),/Encoder unavailable/);
        assert.equal(app.metrics.cancelled,1);
        assert.equal(app.metrics.download.length,0);
        assert.equal(app.exporter.busy,false);
        assert.equal(app.metrics.inputs.every(x=>x.disposed),true);
        assert.equal(app.metrics.states.at(-1).phase,'error');
    }finally{app.restore()}
});
test('limits and format validation do not alter exporter or start download',async()=>{
    const app=makeEnvironment({audio:false});
    try{
        app.engine.tracks=[source('long','video',{clipDuration:OFFLINE_EXPORT_LIMIT_SECONDS+1})];
        await assert.rejects(()=>app.exporter.start({format:'mp4'}),/2 minutes/);
        await assert.rejects(()=>app.exporter.start({format:'avi'}),/MP4 or WebM/);
        assert.equal(app.exporter.busy,false);
        assert.equal(app.metrics.download.length,0);
    }finally{app.restore()}
});
test('a cancelled library load completes without download',async()=>{
    const app=makeEnvironment({audio:false});
    try{
        let release;
        app.exporter.libraryLoader=()=>new Promise(resolve=>release=resolve);
        const start=app.exporter.start({format:'webm',fps:24});
        await app.exporter.cancel();
        release(app.MB);
        assert.equal(await start,false);
        assert.equal(app.metrics.download.length,0);
        assert.equal(app.exporter.busy,false);
    }finally{app.restore()}
});

test('the beta refuses to start while preview playback is running',async()=>{
    const app=makeEnvironment({audio:false});
    try{
        app.engine.isPlaying=true;
        await assert.rejects(()=>app.exporter.start({format:'mp4'}),/Pause the preview/);
        assert.equal(app.metrics.download.length,0);
        assert.equal(app.exporter.busy,false);
    }finally{app.restore()}
});
test('muted video sound is not mixed into the fixed-frame output',async()=>{
    const app=makeEnvironment({audio:true});
    try{
        app.engine.tracks[0].audio.muted=true;
        assert.equal(await app.exporter.start({format:'mp4',fps:24}),true);
        assert.equal(app.metrics.audioTracks,0);
    }finally{app.restore()}
});
test('cancelling during a slow encoder frame discards the unfinished file',async()=>{
    const app=makeEnvironment({audio:false});
    try{
        let release,seen;
        app.MB.CanvasSource=class {
            async add() {
                seen?.();
                await new Promise(resolve=>{release=resolve});
            }
        };
        const encountered=new Promise(resolve=>{seen=resolve});
        const started=app.exporter.start({format:'webm',fps:24});
        await encountered;
        await app.exporter.cancel();
        release();
        assert.equal(await started,false);
        assert.equal(app.metrics.download.length,0);
        assert.ok(app.metrics.cancelled>=1);
        assert.equal(app.exporter.busy,false);
    }finally{app.restore()}
});
