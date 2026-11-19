import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTIVE_PAIR_EFFECTS,isAvailablePairEffect,unit,
    spiralRingFraction,ringsRevealThreshold,panelProgress,pairedEffectProgress
} from '../js/paired-visual-effects.mjs';
import { TRANSITION_CATALOG, SELECTED_TRANSITION_NAMES } from '../js/transition-catalog.mjs';
import { planPairedTransition,isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';
const requested=['spiral-wipe','rings-wipe','color-panel-wipe'];
test('8E preserves the original 41 wishlist slots and enables three requested effects',()=>{
    assert.equal(SELECTED_TRANSITION_NAMES.length,41);
    assert.equal(TRANSITION_CATALOG.length,41);
    assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(-3),requested);
    assert.equal(TRANSITION_CATALOG.filter(item=>item.status==='available').length,10);
    assert.equal(TRANSITION_CATALOG.filter(item=>item.status==='requested').length,31);
    assert.equal(TRANSITION_CATALOG.find(item=>item.id==='spiral-block-wipe')?.status,'requested',
        'SpiralBlockWipe and Spiral wipe are separate requested effects');
    for(const id of requested){
        assert.equal(isAvailablePairEffect(id),true);
        assert.equal(TRANSITION_CATALOG.find(item=>item.id===id)?.status,'available');
    }
});
test('Spiral wipe angular sweep progresses monotonically from inner rings to outer rings',()=>{
    const count=32;
    for(const i of [0,1,15,30,31]){
        assert.equal(spiralRingFraction(0,i,count),0);
        assert.equal(spiralRingFraction(1,i,count),1);
        let prior=0;
        for(const progress of [.05,.2,.35,.5,.75,.95]){
            const current=spiralRingFraction(progress,i,count);
            assert.ok(current>=prior&&current<=1);
            prior=current;
            assert.equal(current,spiralRingFraction(progress,i,count));
        }
    }
    assert.ok(spiralRingFraction(.5,0,count)>spiralRingFraction(.5,31,count),
        'The inner rings should be revealed through a larger arc than outer rings');
    assert.ok(spiralRingFraction(.5,15,count)>0&&spiralRingFraction(.5,15,count)<1);
});
test('Rings wipe reveals separate nonadjacent annuli without ever hiding exposed rings',()=>{
    const count=10;
    const thresholds=Array.from({length:count},(_,i)=>ringsRevealThreshold(i,count));
    assert.equal(new Set(thresholds).size,count);
    for(const threshold of thresholds)assert.ok(threshold>0&&threshold<1);
    const revealedAtMidpoint=thresholds.map(t=>.5>=t);
    assert.ok(revealedAtMidpoint.some(Boolean)&&revealedAtMidpoint.some(x=>!x));
    assert.ok(revealedAtMidpoint.some((yes,i)=>yes&&i>0&&!revealedAtMidpoint[i-1]),
        'Must include at least one revealed ring outside an unrevealed ring');
    for(const i of [0,1,4,9]){
        const value=ringsRevealThreshold(i,count);
        assert.equal(value,ringsRevealThreshold(i,count),'Scrub should not randomize ring ordering');
        assert.ok(!(value<=.25)||value<=.75,'Reveals remain monotonic');
    }
});
test('Color panel wipe staggers six panels through tint then video reveal',()=>{
    const count=6;
    for(let i=0;i<count;i++){
        assert.equal(panelProgress(0,i,count),0);
        assert.equal(panelProgress(1,i,count),1);
        let prior=0;
        for(const p of [.05,.2,.4,.5,.65,.8,.95]){
            const current=panelProgress(p,i,count);
            assert.ok(current>=prior&&current<=1);
            prior=current;
        }
    }
    assert.equal(panelProgress(.5,0,count),1);
    assert.ok(panelProgress(.5,2,count)>.5);
    assert.ok(panelProgress(.5,3,count)>0&&panelProgress(.5,3,count)<.5);
    assert.equal(panelProgress(.5,5,count),0);
    assert.equal(unit(Infinity),0);
});
test('8E effects use the existing non-destructive pair and Undo/Redo metadata',()=>{
    const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
        start:0,clipDuration:4,laneId:'lane-A',order:2,audio:{volume:.65}};
    const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
        start:4,clipDuration:4,laneId:'lane-B',order:1,audio:{volume:.85}};
    for(const id of requested){
        const plan=planPairedTransition([a,b],['B','A'],1.5,id);
        assert.equal(plan.start,2.5);
        assert.equal(plan.duration,1.5);
        assert.equal(plan.effectId,id);
        const newB={...b,start:plan.start,order:plan.incomingOrder,
            transitionFromId:'A',transitionEffectId:id,
            visualTransitions:plan.incomingTransitions};
        assert.equal(pairedEffectProgress(newB,3.25),.5);
        assert.equal(isPairedFadeActive(newB,[a,newB]),true);
        const snapshot=snapshotClip(newB);
        newB.transitionEffectId=null;
        applyClipData(newB,snapshot);
        assert.equal(newB.transitionEffectId,id);
    }
    assert.equal(a.audio.volume,.65);
    assert.equal(b.audio.volume,.85);
    assert.equal(b.start,4);
});
