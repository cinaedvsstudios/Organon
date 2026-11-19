import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTIVE_PAIR_EFFECTS,paperTearEdge,inkBleedRadius,splatterDropRadius,
    pairedEffectProgress
} from '../js/paired-visual-effects.mjs';
import { TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES } from '../js/transition-catalog.mjs';
import { planPairedTransition,isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';
const chosen=['paper-tear','ink-bleed','splatter-wipe'];
test('8I preserves the complete 41-name wishlist and enables only three more',()=>{
    assert.equal(SELECTED_TRANSITION_NAMES.length,41);
    assert.equal(TRANSITION_CATALOG.length,41);
    assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(19,22),chosen);
    assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='available').length,28);
    assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='requested').length,13);
    for(const id of chosen)assert.equal(TRANSITION_CATALOG.find(e=>e.id===id)?.status,'available');
    assert.equal(TRANSITION_CATALOG.find(e=>e.id==='spiralblockwipe')?.status,'requested');
});
test('Paper tear advances a stable jagged edge with no endpoint jitter',()=>{
    for(const i of [0,5,11,25,36]){
        assert.equal(paperTearEdge(0,i,196),0);
        assert.equal(paperTearEdge(1,i,196),196);
        let previous=0;
        for(let s=1;s<=100;s++){
            const x=paperTearEdge(s/100,i,196);
            assert.ok(x>=previous-.00001&&x<=196,'Tear must advance without opening backwards');
            previous=x;
            assert.equal(x,paperTearEdge(s/100,i,196));
        }
    }
    const edges=Array.from({length:37},(_,i)=>paperTearEdge(.5,i,196));
    assert.ok(Math.max(...edges)-Math.min(...edges)>8,
        'Irregular paper edge must be visibly jagged, not a straight wipe');
});
test('Ink bleed pools spread monotonically, unevenly and join before the endpoint',()=>{
    const mid=Array.from({length:24},(_,i)=>inkBleedRadius(.5,i,196,112));
    assert.ok(Math.max(...mid)-Math.min(...mid)>4,'Ink blobs need varied sizes');
    for(let i=0;i<24;i++){
        assert.equal(inkBleedRadius(0,i,196,112),0);
        let last=0;
        for(let step=0;step<=100;step++){
            const r=inkBleedRadius(step/100,i,196,112);
            assert.ok(r>=last-.00001,'Ink pools should not shrink during a dissolve');
            assert.equal(r,inkBleedRadius(step/100,i,196,112));
            last=r;
        }
        assert.ok(inkBleedRadius(.99,i,196,112)>100,
            'At the end, merged pools should cover any remaining image gaps');
    }
});
test('Splatter droplets have staggered arrival and bounded deterministic growth',()=>{
    const half=Array.from({length:72},(_,i)=>splatterDropRadius(.5,i,196,112));
    assert.ok(half.filter(x=>x>0).length>12);
    assert.ok(half.filter(x=>x===0).length>12);
    for(let i=0;i<72;i++){
        assert.equal(splatterDropRadius(0,i,196,112),0);
        let previous=0;
        for(let step=0;step<=100;step++){
            const current=splatterDropRadius(step/100,i,196,112);
            assert.ok(current>=previous-.00001&&current<=15);
            previous=current;
            assert.equal(current,splatterDropRadius(step/100,i,196,112));
        }
    }
});
test('New masks preserve native pair timing, unchanged sources and Undo/Redo metadata',()=>{
    const a={id:'A',type:'video',start:1,clipDuration:5,order:2,laneId:'A',sourceName:'a.mp4',
        file:{name:'a.mp4'},audio:{volume:.55},sourceOffset:.25};
    const b={id:'B',type:'video',start:6,clipDuration:4,order:1,laneId:'B',sourceName:'b.mp4',
        file:{name:'b.mp4'},audio:{volume:.9},sourceOffset:.5};
    for(const effectId of chosen){
        const plan=planPairedTransition([a,b],['B','A'],1.25,effectId);
        assert.equal(plan.start,4.75);
        assert.equal(plan.duration,1.25);
        assert.equal(plan.effectId,effectId);
        const newB={...b,start:plan.start,order:plan.incomingOrder,
            transitionFromId:'A',transitionEffectId:effectId,
            visualTransitions:plan.incomingTransitions};
        assert.equal(isPairedFadeActive(newB,[a,newB]),true);
        assert.equal(pairedEffectProgress(newB,5.375),.5);
        const saved=snapshotClip(newB);
        newB.transitionEffectId=null;
        applyClipData(newB,saved);
        assert.equal(newB.transitionEffectId,effectId);
    }
    assert.equal(a.audio.volume,.55);
    assert.equal(b.audio.volume,.9);
    assert.equal(a.sourceOffset,.25);
    assert.equal(b.sourceOffset,.5);
    assert.equal(b.start,6);
});
