import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTIVE_PAIR_EFFECTS,spinAngle,spinScale,cubeFaceWidth,cubeRowSkew,
    crossWarpArms,crossWarpShift,pairedEffectProgress
} from '../js/paired-visual-effects.mjs';
import { TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES } from '../js/transition-catalog.mjs';
import { planPairedTransition,isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';
const chosen=['spin','cube','cross-warp'];
test('8H preserves the complete 41-effect shortlist, 19 enabled and 22 remaining',()=>{
    assert.equal(SELECTED_TRANSITION_NAMES.length,41);
    assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(16,19),chosen);
    assert.equal(TRANSITION_CATALOG.length,41);
    assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='available').length,37);
    assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='requested').length,4);
    for(const id of chosen)assert.equal(TRANSITION_CATALOG.find(e=>e.id===id)?.status,'available');
    assert.equal(TRANSITION_CATALOG.find(e=>e.id==='spiralblockwipe')?.status,'available');
});
test('Spin reduces angle and enlarges the incoming card smoothly without jumps',()=>{
    assert.equal(spinAngle(0),2*Math.PI);
    assert.equal(spinAngle(.5),Math.PI);
    assert.equal(spinAngle(1),0);
    assert.equal(spinScale(0),.12);
    assert.equal(spinScale(1),1);
    let previousAngle=spinAngle(0),previousScale=spinScale(0);
    for(let step=1;step<=100;step++){
        const p=step/100;
        const angle=spinAngle(p),scale=spinScale(p);
        assert.ok(angle<=previousAngle&&angle>=0);
        assert.ok(scale>=previousScale&&scale<=1);
        previousAngle=angle;
        previousScale=scale;
    }
});
test('Cube balances opposing faces and deterministic vertical perspective',()=>{
    for(const p of [0,.1,.25,.5,.75,.9,1]){
        const outgoing=cubeFaceWidth(p,196,'outgoing');
        const incoming=cubeFaceWidth(p,196,'incoming');
        assert.ok(Math.abs(outgoing+incoming-196)<1e-8,'Faces should fill same nominal width');
        assert.ok(outgoing>=0&&incoming>=0);
    }
    assert.equal(cubeFaceWidth(0,196,'incoming'),0);
    assert.equal(cubeFaceWidth(1,196,'outgoing'),0);
    for(const row of [0,6,12,18,23]){
        assert.equal(cubeRowSkew(0,row,24,196),0);
        assert.equal(cubeRowSkew(1,row,24,196),0);
        const middle=cubeRowSkew(.5,row,24,196);
        assert.equal(middle,cubeRowSkew(.5,row,24,196));
        assert.ok(Math.abs(middle)<=11);
    }
    assert.notEqual(cubeRowSkew(.5,0,24,196),cubeRowSkew(.5,23,24,196),
        'Opposite edges must project differently to suggest perspective');
});
test('Cross warp cross-shaped reveal expands and band displacement relaxes to zero',()=>{
    assert.deepEqual(crossWarpArms(0,196,112),{verticalWidth:0,horizontalHeight:0});
    assert.deepEqual(crossWarpArms(.5,196,112),{verticalWidth:98,horizontalHeight:56});
    assert.deepEqual(crossWarpArms(1,196,112),{verticalWidth:196,horizontalHeight:112});
    const shifts=Array.from({length:24},(_,i)=>crossWarpShift(.5,i,24,196));
    assert.ok(new Set(shifts).size>7,'Cross warp slices must have independent offsets');
    assert.ok(shifts.some(x=>x!==0));
    for(const row of [0,2,9,16,23]){
        assert.equal(crossWarpShift(0,row,24,196),0);
        assert.equal(crossWarpShift(1,row,24,196),0);
        const x=crossWarpShift(.4,row,24,196);
        assert.equal(x,crossWarpShift(.4,row,24,196));
        assert.ok(Math.abs(x)<=Math.min(196*.06,52)+1);
    }
});
test('Spin, Cube and Cross warp reuse source clips and restore through Undo/Redo',()=>{
    const a={id:'A',type:'video',start:1,clipDuration:5,order:2,laneId:'A',sourceName:'a.mp4',
        file:{name:'a.mp4'},audio:{volume:.35},sourceOffset:.25};
    const b={id:'B',type:'video',start:6,clipDuration:4,order:1,laneId:'B',sourceName:'b.mp4',
        file:{name:'b.mp4'},audio:{volume:.85},sourceOffset:.5};
    for(const id of chosen){
        const plan=planPairedTransition([a,b],['B','A'],1.25,id);
        assert.equal(plan.start,4.75);
        assert.equal(plan.duration,1.25);
        assert.equal(plan.effectId,id);
        const incoming={...b,start:plan.start,order:plan.incomingOrder,
            transitionFromId:'A',transitionEffectId:id,visualTransitions:plan.incomingTransitions};
        assert.equal(isPairedFadeActive(incoming,[a,incoming]),true);
        assert.equal(pairedEffectProgress(incoming,5.375),.5);
        const stored=snapshotClip(incoming);
        incoming.transitionEffectId=null;
        applyClipData(incoming,stored);
        assert.equal(incoming.transitionEffectId,id);
    }
    assert.equal(a.audio.volume,.35);
    assert.equal(b.audio.volume,.85);
    assert.equal(a.sourceOffset,.25);
    assert.equal(b.sourceOffset,.5);
    assert.equal(b.start,6);
});
