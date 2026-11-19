import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTIVE_PAIR_EFFECTS,cardSwipeOffset,cameraShakeOffset,vhsTrackingShift,
    pairedEffectProgress
} from '../js/paired-visual-effects.mjs';
import { TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES } from '../js/transition-catalog.mjs';
import { planPairedTransition,isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';
const selected=['card-swipe','camera-shake','vhs-tracking'];
test('8G preserves every selected gallery effect and enables exactly three new effects',()=>{
    assert.equal(SELECTED_TRANSITION_NAMES.length,41);
    assert.equal(TRANSITION_CATALOG.length,41);
    assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='available').length,31);
    assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='requested').length,10);
    assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(13,16),selected);
    for(const id of selected)assert.equal(TRANSITION_CATALOG.find(e=>e.id===id)?.status,'available');
    assert.equal(TRANSITION_CATALOG.find(e=>e.id==='hologram')?.status,'requested');
});
test('Card swipe moves an intact frame right-to-left at a stable speed',()=>{
    assert.equal(cardSwipeOffset(0,192),192);
    assert.equal(cardSwipeOffset(.25,192),144);
    assert.equal(cardSwipeOffset(.5,192),96);
    assert.equal(cardSwipeOffset(.75,192),48);
    assert.equal(cardSwipeOffset(1,192),0);
    let previous=192;
    for(let i=0;i<=100;i++){
        const value=cardSwipeOffset(i/100,192);
        assert.ok(value<=previous&&value>=0);
        previous=value;
    }
});
test('Camera shake offsets are deterministic and return exactly to zero',()=>{
    for(const frame of [0,1,3,27,41,100]){
        assert.deepEqual(cameraShakeOffset(0,frame,192,112),{x:0,y:0});
        assert.deepEqual(cameraShakeOffset(1,frame,192,112),{x:0,y:0});
        const val=cameraShakeOffset(.5,frame,192,112);
        assert.deepEqual(val,cameraShakeOffset(.5,frame,192,112));
        assert.ok(Math.abs(val.x)<=Math.min(30,192*.09)+1);
        assert.ok(Math.abs(val.y)<=Math.min(22,112*.12)+1);
    }
    const offsets=Array.from({length:30},(_,i)=>cameraShakeOffset(.5,i,192,112));
    assert.ok(offsets.some(v=>v.x!==0||v.y!==0),'Shake must actually move the picture');
    assert.ok(new Set(offsets.map(v=>v.x+','+v.y)).size>10,'Shake should vary across frames');
});
test('VHS tracking row displacement is reproducible, bounded and fades out',()=>{
    const seen=[];
    for(let row=0;row<24;row++){
        const shift=vhsTrackingShift(.4,row,22,200);
        assert.equal(shift,vhsTrackingShift(.4,row,22,200));
        assert.ok(Math.abs(shift)<=Math.min(34,200*.085)+1);
        assert.equal(vhsTrackingShift(1,row,22,200),0);
        seen.push(shift);
    }
    assert.ok(new Set(seen).size>=6,'Different scanline bands must distort differently');
    assert.ok(seen.some(v=>v!==0));
    assert.ok(Math.abs(vhsTrackingShift(.9,7,22,200))<=Math.abs(vhsTrackingShift(.2,7,22,200)));
});
test('All new effects maintain non-destructive paired placement and history',()=>{
    const a={id:'A',type:'video',start:1,clipDuration:4,order:2,laneId:'A',sourceName:'a.mp4',
        file:{name:'a.mp4'},audio:{volume:.5}};
    const b={id:'B',type:'video',start:5,clipDuration:3,order:1,laneId:'B',sourceName:'b.mp4',
        file:{name:'b.mp4'},audio:{volume:.8}};
    for(const effectId of selected){
        const plan=planPairedTransition([a,b],['A','B'],1,effectId);
        assert.equal(plan.start,4);
        assert.equal(plan.duration,1);
        assert.equal(plan.effectId,effectId);
        const active={...b,start:plan.start,order:plan.incomingOrder,
            visualTransitions:plan.incomingTransitions,
            transitionFromId:'A',transitionEffectId:effectId};
        assert.equal(isPairedFadeActive(active,[a,active]),true);
        assert.equal(pairedEffectProgress(active,4.5),.5);
        const saved=snapshotClip(active);
        active.transitionEffectId=null;
        applyClipData(active,saved);
        assert.equal(active.transitionEffectId,effectId);
    }
    assert.equal(a.audio.volume,.5);
    assert.equal(b.audio.volume,.8);
    assert.equal(b.start,5);
});
