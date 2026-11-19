import test from 'node:test';
import assert from 'node:assert/strict';
import { planClipSegmentExport } from '../js/clip-segment-export.mjs';
const file={name:'unedited-source.mp4',size:1234};
const clip=(values={})=>({id:'clip-1',file,sourceName:file.name,
    type:'video',start:12,clipDuration:2.5,sourceOffset:5.3,
    speed:1.5,visible:true,opacity:.8,
    audio:{volume:.7,gain:30,fx:{eq:'voice',drive:'tape',dynamics:'off',stereo:'wide'}},
    transform:{scale:1.4,x:50,rotate:12},
    adjustments:{brightness:20,contrast:11},
    keyframes:{'transform.x':[{time:0,value:0},{time:2,value:100}]},...values});
test('trim export isolates a clip, resets only its timeline position, preserves source offset and speed',()=>{
    const other=clip({id:'other',start:0,sourceOffset:0,clipDuration:6});
    const original=clip();
    const p=planClipSegmentExport([other,original],'clip-1');
    assert.equal(p.duration,2.5);
    assert.equal(p.tracks.length,1);
    assert.equal(p.tracks[0].start,0);
    assert.equal(p.tracks[0].sourceOffset,5.3);
    assert.equal(p.tracks[0].speed,1.5);
    assert.equal(p.tracks[0].clipDuration,2.5);
    assert.equal(p.tracks[0].audio.fx.drive,'tape');
    assert.equal(p.tracks[0].keyframes['transform.x'][1].value,100);
    assert.equal(original.start,12);
    assert.equal(other.start,0);
});
test('preserves independent clip fade but drops an orphaned paired transition',()=>{
    const independent=clip({visualTransitions:{enter:{type:'fade',duration:.3,curve:'linear'}}});
    assert.equal(planClipSegmentExport([independent],'clip-1').tracks[0].visualTransitions.enter.duration,.3);
    const paired=clip({transitionFromId:'other',transitionEffectId:'sphere',
        visualTransitions:{enter:{type:'fade',duration:1,curve:'linear'}}});
    const result=planClipSegmentExport([paired],'clip-1').tracks[0];
    assert.equal(result.transitionFromId,null);
    assert.equal(result.transitionEffectId,null);
    assert.equal(result.visualTransitions.enter.duration,0);
});
test('new export values are deep copied to prevent mutations in the main project',()=>{
    const original=clip();
    const result=planClipSegmentExport([original],'clip-1').tracks[0];
    result.audio.fx.eq='phone';
    result.transform.x=999;
    result.keyframes['transform.x'][0].value=777;
    assert.equal(original.audio.fx.eq,'voice');
    assert.equal(original.transform.x,50);
    assert.equal(original.keyframes['transform.x'][0].value,0);
});
test('audio sections are allowed and identified as audio-only',()=>{
    const result=planClipSegmentExport([clip({type:'audio'})],'clip-1');
    assert.equal(result.isAudioOnly,true);
    assert.equal(result.duration,2.5);
});
test('unlinked clips, empty spans and exports above 120s are refused',()=>{
    assert.throws(()=>planClipSegmentExport([],'clip-1'),/relink/i);
    assert.throws(()=>planClipSegmentExport([clip({file:null})],'clip-1'),/Relink/i);
    assert.throws(()=>planClipSegmentExport([clip({clipDuration:0})],'clip-1'),/playable section/i);
    assert.throws(()=>planClipSegmentExport([clip({clipDuration:120.01})],'clip-1'),/120 seconds/i);
    assert.equal(planClipSegmentExport([clip({clipDuration:120})],'clip-1').duration,120);
});
