import test from 'node:test';
import assert from 'node:assert/strict';
import { planClipSnap } from '../js/clip-snap.mjs';

const clip=(id,lane,start,duration,groupId=null)=>({
    id,laneId:lane,laneLabel:lane,sourceName:id+'.mp4',start,clipDuration:duration,groupId
});

test('two selected clips snap end-to-start without moving two other tracks',()=>{
    const a=clip('A','video-1',0,5);
    const b=clip('B','video-2',9,2);
    const c=clip('C','video-2',15,2);
    const d=clip('D','video-3',4,7);
    const tracks=[a,b,c,d];
    const plan=planClipSnap(tracks,['A','B'],'pair',1);
    assert.equal(plan.anchorId,'A');
    assert.equal(plan.targetId,'B');
    assert.equal(plan.delta,-4);
    assert.equal(plan.joinTime,5);
    assert.deepEqual(plan.movingIds,['B']);
    assert.deepEqual(tracks.map(t=>t.start),[0,9,15,4],
        'planning must never mutate the other tracks or source positions');
});

test('reverse selection still aligns the earlier clip end with later start',()=>{
    const tracks=[clip('A','a',1,4),clip('B','b',8,2)];
    const result=planClipSnap(tracks,['B','A'],'pair');
    assert.equal(result.targetId,'B');
    assert.equal(result.delta,-3);
});

test('same-lane snapping never overlaps a third clip',()=>{
    const tracks=[clip('A','video-1',0,3),clip('middle','video-1',4,2),
        clip('B','video-1',8,2)];
    assert.throws(()=>planClipSnap(tracks,['A','B'],'pair'),/overlap middle/);
    tracks.splice(1,1);
    assert.equal(planClipSnap(tracks,['A','B'],'pair').delta,-5);
});

test('a snap does not collide with media on the target clip own track',()=>{
    const tracks=[clip('A','video-1',0,5),clip('B','video-2',9,2),
        clip('occupied','video-2',4,3)];
    assert.throws(()=>planClipSnap(tracks,['A','B'],'pair'),/overlap occupied/);
});

test('single clip can snap start or end to the current now-line',()=>{
    const tracks=[clip('A','video-1',2,3),clip('other','video-2',1,15)];
    const start=planClipSnap(tracks,['A'],'start-playhead',8);
    assert.equal(start.delta,6);
    assert.equal(start.joinTime,8);
    const end=planClipSnap(tracks,['A'],'end-playhead',8);
    assert.equal(end.delta,3);
    assert.equal(end.joinTime,5);
    assert.throws(()=>planClipSnap(tracks,['A'],'end-playhead',1),/outside the timeline/);
});

test('grouped clips shift as a unit without disturbing unrelated tracks',()=>{
    const tracks=[clip('anchor','video-1',0,5),
        clip('B','video-2',9,2,'group-1'),clip('music','audio-1',9,4,'group-1'),
        clip('elsewhere','video-3',7,3)];
    const plan=planClipSnap(tracks,['anchor','B'],'pair');
    assert.deepEqual(plan.movingIds,['B','music']);
    assert.equal(plan.delta,-4);
    assert.throws(()=>planClipSnap(tracks,['B','music'],'pair'),/same group/);
});

test('reject more than two clips, empty lanes, and cross-track overlap on moved groups',()=>{
    const empty={id:'empty',laneId:'x',clipDuration:0,sourceName:''};
    const a=clip('A','video-1',0,3);
    const b=clip('B','video-2',9,2,'g');
    const linked=clip('linked','audio-1',9,2,'g');
    assert.throws(()=>planClipSnap([a,b],['A','B','x'],'pair'),/exactly two/);
    assert.throws(()=>planClipSnap([a,empty],['empty'],'start-playhead',3),/loaded timeline clips/);
    assert.throws(()=>planClipSnap([a,b,linked,clip('audio-block','audio-1',3,4)],
      ['A','B'],'pair'),/overlap audio-block/);
});
