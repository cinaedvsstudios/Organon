import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTIVE_PAIR_EFFECTS,blockCoverState,crossHatchWidth,filmStripProgress,
    pairedEffectProgress
} from '../js/paired-visual-effects.mjs';
import { TRANSITION_CATALOG, SELECTED_TRANSITION_NAMES } from '../js/transition-catalog.mjs';
import { planPairedTransition,isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';

const newEffects=['block-cover','cross-hatch','film-strip'];

test('8F retains all 41 wishlist entries and enables exactly three additional effects',()=>{
    assert.equal(SELECTED_TRANSITION_NAMES.length,41);
    assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(10,13),newEffects);
    assert.equal(TRANSITION_CATALOG.length,41);
    assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='available').length,28);
    assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='requested').length,13);
    for(const id of newEffects)assert.equal(TRANSITION_CATALOG.find(e=>e.id===id)?.status,'available');
    assert.equal(TRANSITION_CATALOG.find(e=>e.id==='spiralblockwipe')?.status,'requested');
});

test('Block cover cells move old → opaque temporary cover → new monotonically',()=>{
    const steps=['old','cover','new'];
    for(let i=0;i<60;i++){
        assert.equal(blockCoverState(0,i),'old');
        assert.equal(blockCoverState(1,i),'new');
        let previous=0;
        for(let p=0;p<=100;p++){
            const state=blockCoverState(p/100,i);
            const order=steps.indexOf(state);
            assert.ok(order>=previous,'Block should never switch back to its older stage');
            assert.equal(state,blockCoverState(p/100,i),'scrub and export must be identical');
            previous=order;
        }
    }
    const atHalf=Array.from({length:60},(_,i)=>blockCoverState(.5,i));
    for(const stage of steps)assert.ok(atHalf.includes(stage),'Midpoint needs distinct '+stage+' tiles');
});

test('Cross hatch opens both diagonal orientations at staggered rates',()=>{
    assert.equal(crossHatchWidth(0,0),0);
    assert.equal(crossHatchWidth(0,1),0);
    assert.equal(crossHatchWidth(1,0),.95);
    assert.equal(crossHatchWidth(1,1),.95);
    assert.ok(crossHatchWidth(.5,0)>crossHatchWidth(.5,1));
    assert.equal(crossHatchWidth(.1,1),0,'second diagonal starts later');
    for(const orientation of [0,1]){
        let last=0;
        for(let n=0;n<=100;n++){
            const val=crossHatchWidth(n/100,orientation);
            assert.ok(val>=last&&val<=1);
            assert.equal(val,crossHatchWidth(n/100,orientation));
            last=val;
        }
    }
});

test('Film-strip frames enter alternately with bounded, staggered durations',()=>{
    assert.equal(filmStripProgress(0,0),0);
    assert.equal(filmStripProgress(0,4),0);
    assert.equal(filmStripProgress(1,0),1);
    assert.equal(filmStripProgress(1,4),1);
    assert.ok(filmStripProgress(.5,0)>filmStripProgress(.5,4));
    for(let row=0;row<5;row++){
        let previous=0;
        for(let step=0;step<=100;step++){
            const p=filmStripProgress(step/100,row);
            assert.ok(p>=previous&&p<=1);
            previous=p;
        }
    }
});

test('Three new effects preserve pairing, timeline source and undo metadata',()=>{
    const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
        start:2,clipDuration:4,laneId:'lower',order:2,audio:{volume:.45}};
    const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
        start:6,clipDuration:3,laneId:'upper',order:1,audio:{volume:.75}};
    for(const effectId of newEffects){
        const plan=planPairedTransition([a,b],['B','A'],1.5,effectId);
        assert.equal(plan.duration,1.5);
        assert.equal(plan.start,4.5);
        assert.equal(plan.effectId,effectId);
        const newB={...b,start:plan.start,order:plan.incomingOrder,
            transitionFromId:'A',transitionEffectId:effectId,
            visualTransitions:plan.incomingTransitions};
        assert.equal(isPairedFadeActive(newB,[a,newB]),true);
        assert.equal(pairedEffectProgress(newB,5.25),.5);
        const saved=snapshotClip(newB);
        newB.transitionEffectId=null;
        applyClipData(newB,saved);
        assert.equal(newB.transitionEffectId,effectId);
    }
    assert.equal(a.audio.volume,.45);
    assert.equal(b.audio.volume,.75);
    assert.equal(b.start,6);
});
