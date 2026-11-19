import test from 'node:test';
import assert from 'node:assert/strict';
import {AdvancedTimeline} from '../js/advanced-timeline-v0.24.js';

const clip = (id, laneId, start, duration, type = 'video') =>
    ({id, laneId, start, clipDuration:duration, sourceName:id+'.mp4', type});
const getBounds = (tracks, moving) =>
    AdvancedTimeline.prototype.getLaneMoveBounds.call(
        {tracks, getClipDuration:item=>item.clipDuration},
        moving,
        new Map(moving.map(item=>[item.id,item.start]))
    );

test('same-lane move stops at the neighboring clip edges in either direction', () => {
    const first=clip('first','video-1',0,5);
    const moving=clip('moving','video-1',5,5);
    const next=clip('next','video-1',15,5);
    const above=clip('overlay','video-2',8,12);
    const bounds=getBounds([first,moving,next,above],[moving]);
    assert.equal(bounds.min,0);
    assert.equal(bounds.max,5);
    assert.equal(Math.min(bounds.max,12),5);
    assert.equal(Math.max(bounds.min,-3),0);
});
test('independent video layers can overlap for deliberately paired transitions', () => {
    const a=clip('a','video-1',0,10);
    const b=clip('b','video-2',7,5);
    const bounds=getBounds([a,b],[b]);
    assert.equal(bounds.min,-7);
    assert.ok(bounds.max>0);
});
test('same-lane audio and sticker clips use the same collision constraints', () => {
    for(const type of ['audio','sticker']){
        const a=clip('a',type+'-1',3,4,type);
        const b=clip('b',type+'-1',7,3,type);
        const bounds=getBounds([a,b],[b]);
        assert.equal(bounds.min,0);
    }
});
