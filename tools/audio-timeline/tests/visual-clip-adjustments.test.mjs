import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TRANSFORM,DEFAULT_ADJUSTMENTS,visualParameterAt,
         upsertVisualKeyframe,applyVisualContext } from '../js/visual-clip-adjustments.mjs';
import { getTrackSourceTime } from '../js/playback-scheduler.mjs';
import { clipSourceTime } from '../js/advanced-offline-export.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';

const clip=()=>({
    id:'v1',type:'video',start:2,clipDuration:5,sourceDuration:20,sourceOffset:1,
    opacity:1,transform:{...DEFAULT_TRANSFORM},adjustments:{...DEFAULT_ADJUSTMENTS},
    keyframes:{},speed:1,audio:{volume:1,muted:false}
});
test('keyframed visual transform interpolates between editable clip-local times',()=>{
    const track=clip();
    upsertVisualKeyframe(track,'transform.scale',2,1);
    upsertVisualKeyframe(track,'transform.scale',6,2);
    assert.equal(visualParameterAt(track,'transform.scale',2),1);
    assert.equal(visualParameterAt(track,'transform.scale',4),1.5);
    assert.equal(visualParameterAt(track,'transform.scale',7),2);
    assert.deepEqual(track.keyframes['transform.scale'].map(k=>k.time),[0,4]);
});
test('all visual adjustments support add/remove diamond frames and undo copies',()=>{
    const track=clip();
    upsertVisualKeyframe(track,'adjustments.saturation',3,70);
    const snap=snapshotClip(track);
    assert.equal(visualParameterAt(track,'adjustments.saturation',4),70);
    upsertVisualKeyframe(track,'adjustments.saturation',5,120);
    assert.equal(snap.keyframes['adjustments.saturation'].length,1,'snapshot must deep-copy keyframes');
    applyClipData(track,snap);
    assert.equal(track.keyframes['adjustments.saturation'].length,1);
    upsertVisualKeyframe(track,'adjustments.saturation',3,0,{remove:true});
    assert.equal(track.keyframes['adjustments.saturation'].length,0);
});
test('canvas rendering applies actual translation, scaling, rotation and filter',()=>{
    const calls=[],ctx={
        globalAlpha:1,filter:'none',translate:(...p)=>calls.push(['translate',...p]),
        rotate:r=>calls.push(['rotate',r]),scale:(...p)=>calls.push(['scale',...p])
    };
    const track=clip();
    track.transform={scale:1.5,x:25,y:-10,rotation:45,opacity:.5};
    track.adjustments.saturation=50;track.adjustments.contrast=20;
    applyVisualContext(ctx,track,3,640,360);
    assert.ok(calls.some(c=>c[0]==='scale'&&c[1]===1.5));
    assert.ok(calls.some(c=>c[0]==='rotate'&&Math.abs(c[1]-Math.PI/4)<1e-6));
    assert.match(ctx.filter,/contrast\(1.200\).*saturate\(1.500\)/);
    assert.equal(ctx.globalAlpha,.5);
});
test('preview and offline source clocks both honor 1.5x playback speed',()=>{
    const track={...clip(),speed:1.5};
    assert.equal(getTrackSourceTime(track,4),4);
    assert.equal(clipSourceTime(track,4),4);
});
