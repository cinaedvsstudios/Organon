import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PlaybackBoundaryTracker, getActivePlaybackTracks, getTrackSourceTime, isPlayableTrackActive
} from '../js/playback-scheduler.mjs';
import { AdvancedMediaEngine } from '../js/advanced-media-engine-v0.24.js';

const video = (id, start, clipDuration, sourceOffset=0) => ({
    id, type:'video', start, clipDuration, sourceOffset, sourceDuration:20, sourceName:`${id}.mp4`
});
const ids=(tracks,time)=>getActivePlaybackTracks(tracks,time).map(track=>track.id);

test('future clips activate at their own starts and stop at their ends',()=>{
    const tracks=[video('first',3,3),video('second',7,3)];
    assert.deepEqual(ids(tracks,0),[]);
    assert.deepEqual(ids(tracks,2.999),[]);
    assert.deepEqual(ids(tracks,3),['first']);
    assert.deepEqual(ids(tracks,5.999),['first']);
    assert.deepEqual(ids(tracks,6),[]);
    assert.deepEqual(ids(tracks,7),['second']);
    assert.deepEqual(ids(tracks,10),[]);
});
test('overlapping video layers are scheduled independently',()=>{
    assert.deepEqual(ids([video('base',0,12),video('upper',4,3)],5),['base','upper']);
});
test('audio clips are playable but still images need no player',()=>{
    const tracks=[video('film',0,5),
        {id:'music',type:'audio',start:0,clipDuration:5,sourceName:'music.wav'},
        {id:'background',type:'background',start:0,clipDuration:20,sourceName:'backdrop.jpg'},
        {id:'sticker',type:'sticker',start:0,clipDuration:20,sourceName:'logo.png'}];
    assert.deepEqual(ids(tracks,1),['film','music']);
});
test('muted videos must continue decoding their visual stream',()=>{
    assert.equal(isPlayableTrackActive({...video('muted',1,2),audio:{muted:true}},2),true);
});
test('invalid and zero-length clips never start',()=>{
    assert.deepEqual(ids([video('empty',0,0),{...video('missing',0,3),sourceName:''}],1),[]);
    assert.deepEqual(getActivePlaybackTracks(null,1),[]);
    for(const t of [NaN,Infinity,-Infinity]) assert.equal(isPlayableTrackActive(video('x',0,5),t),false);
});
test('trimmed source offset is applied and clamped at end of file',()=>{
    const track=video('cut',5,4,7);
    assert.equal(getTrackSourceTime(track,5),7);
    assert.equal(getTrackSourceTime(track,6.5),8.5);
    assert.equal(getTrackSourceTime(track,9),11);
    assert.equal(getTrackSourceTime(video('short',0,10,18),5),20);
    assert.equal(getTrackSourceTime(track,-25),0);
});
test('boundary tracker emits exactly one start/stop for each clip',()=>{
    const tracker=new PlaybackBoundaryTracker(), events=[];
    const tracks=[video('a',3,3),video('b',7,3)];
    for(const t of [0,2.5,3,4,5.9,6,6.5,7,9,10]) {
        tracker.update(tracks,t,x=>events.push('start:'+x.id),x=>events.push('stop:'+x.id));
    }
    assert.deepEqual(events,['start:a','stop:a','start:b','stop:b']);
});
test('overlapping clips stop independently',()=>{
    const tracker=new PlaybackBoundaryTracker(), events=[];
    const tracks=[video('base',0,12),video('upper',4,3)];
    for(const t of [0,4,7,12]) tracker.update(tracks,t,x=>events.push('+'+x.id),x=>events.push('-'+x.id));
    assert.deepEqual(events,['+base','+upper','-upper','-base']);
});
test('removed and replaced media players are stopped',()=>{
    const tracker=new PlaybackBoundaryTracker(),events=[];
    const track={...video('a',0,6),media:{tag:'old'}};
    tracker.update([track],0,()=>events.push('start'),(_,media)=>events.push('stop:'+media.tag));
    track.media={tag:'new'};
    tracker.update([track],1,()=>events.push('restart'),(_,media)=>events.push('stop:'+media.tag));
    tracker.update([],2,()=>{},(_,media)=>events.push('stop:'+media.tag));
    assert.deepEqual(events,['start','stop:old','restart','stop:new']);
});
test('reset stops every active clip and allows another playback',()=>{
    const tracker=new PlaybackBoundaryTracker(),events=[];
    const tracks=[video('one',0,4),video('two',0,4)];
    tracker.update(tracks,1,x=>events.push('start:'+x.id));
    tracker.reset(x=>events.push('stop:'+x.id));
    tracker.update(tracks,1,x=>events.push('start:'+x.id));
    assert.deepEqual(events,['start:one','start:two','stop:one','stop:two','start:one','start:two']);
});

function createFakeEngine() {
    const actions=[];
    let now=0, serial=0;
    const callbacks=new Map();
    const frame=()=>({save(){},restore(){},clearRect(){},fillRect(){},drawImage(){}});
    globalThis.document={createElement(kind){if(kind==='canvas')return {getContext:frame};throw Error('unexpected element '+kind)}};
    globalThis.requestAnimationFrame=callback=>{const id=++serial;callbacks.set(id,callback);return id};
    globalThis.cancelAnimationFrame=id=>callbacks.delete(id);
    const engine=new AdvancedMediaEngine({
        canvas:{width:1280,height:720,getContext:frame},mediaBin:{},
        onTimeChange(){},onDurationChange(){},onPlaybackChange(){},
        onRenderError(error){throw error}
    });
    engine.ensureAudioGraph=async()=>{engine.audioContext={state:'running',get currentTime(){return now}}};
    engine.renderFrame=()=>{};
    engine.syncAudioSettings=()=>{};
    const player=name=>({
        paused:true,currentTime:0,
        play(){this.paused=false;actions.push('start:'+name);return Promise.resolve()},
        pause(){if(!this.paused)actions.push('stop:'+name);this.paused=true}
    });
    const makeClip=(id,start,duration,sourceOffset=0)=>({
        ...video(id,start,duration,sourceOffset),media:player(id+'-video'),soundMedia:player(id+'-sound'),
        audio:{volume:1,muted:false,fadeIn:0,fadeOut:0}
    });
    return {engine,actions,makeClip,
        tick(time){now=time;const running=[...callbacks.values()];callbacks.clear();for(const callback of running)callback()},
        setClock(time){now=time}
    };
}
test('Advanced engine starts later clips, linked audio, and stops at boundaries',async()=>{
    const app=createFakeEngine(),first=app.makeClip('first',3,3),second=app.makeClip('second',7,3,5);
    app.engine.setTracks([first,second]);
    await app.engine.play();
    assert.equal(app.engine.isPlaying,true);
    assert.deepEqual(app.actions,[]);
    app.tick(3.05);
    assert.deepEqual(app.actions.slice(0,2),['start:first-video','start:first-sound']);
    assert.ok(Math.abs(first.media.currentTime-.05)<.001);
    app.tick(6.05);
    assert.ok(app.actions.includes('stop:first-video'));
    assert.ok(app.actions.includes('stop:first-sound'));
    app.tick(7.25);
    assert.ok(app.actions.includes('start:second-video'));
    assert.ok(Math.abs(second.media.currentTime-5.25)<.001);
    app.tick(10.1);
    assert.equal(app.engine.isPlaying,false);
    assert.ok(app.actions.includes('stop:second-video'));
    assert.equal(app.engine.playbackBoundaries.active.size,0);
});
test('Advanced engine can seek directly into a later clip and pause',async()=>{
    const app=createFakeEngine(),clip=app.makeClip('late',7,3,5);
    app.engine.setTracks([clip]);
    await app.engine.seek(8);
    await app.engine.play();
    assert.equal(clip.media.currentTime,6);
    assert.equal(clip.soundMedia.currentTime,6);
    app.engine.pause();
    assert.equal(clip.media.paused,true);
    assert.equal(clip.soundMedia.paused,true);
});
test('Advanced engine permits background-only compositions and empty starting gaps',async()=>{
    const app=createFakeEngine();
    app.engine.setTracks([{id:'bg',type:'background',start:0,clipDuration:4,sourceName:'background.jpg'}]);
    await app.engine.play();
    assert.equal(app.engine.isPlaying,true);
    app.tick(4.1);
    assert.equal(app.engine.isPlaying,false);
});
test('Removing all clips during playback stops players and the timeline clock',async()=>{
    const app=createFakeEngine(),clip=app.makeClip('one',0,5);
    app.engine.setTracks([clip]);
    await app.engine.play();
    assert.equal(clip.media.paused,false);
    app.engine.setTracks([]);
    assert.equal(clip.media.paused,true);
    assert.equal(clip.soundMedia.paused,true);
    assert.equal(app.engine.isPlaying,false);
});
