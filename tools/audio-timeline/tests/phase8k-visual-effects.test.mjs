import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTIVE_PAIR_EFFECTS,vortexRadius,vortexTurn,heatHazeShift,
    refractionFacetOffset,pairedEffectProgress
} from '../js/paired-visual-effects.mjs';
import { TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES } from '../js/transition-catalog.mjs';
import { planPairedTransition,isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';
const chosen=['vortex','heat-haze','refraction'];
test('8K retains 41 original names while enabling the next three effects',()=>{
    assert.equal(SELECTED_TRANSITION_NAMES.length,41);
    assert.equal(new Set(TRANSITION_CATALOG.map(x=>x.id)).size,41);
    assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(25,28),chosen);
    assert.equal(TRANSITION_CATALOG.filter(x=>x.status==='available').length,41);
    assert.equal(TRANSITION_CATALOG.filter(x=>x.status==='requested').length,0);
    for(const id of chosen)assert.equal(TRANSITION_CATALOG.find(x=>x.id===id)?.status,'available');
    assert.equal(TRANSITION_CATALOG.find(x=>x.id==='hologram')?.status,'requested');
});
test('Vortex radius expands and its separate rings rotate reproducibly',()=>{
    const farthest=Math.hypot(98,56);
    assert.equal(vortexRadius(0,196,112),0);
    assert.equal(vortexRadius(.5,196,112),farthest/2);
    assert.equal(vortexRadius(1,196,112),farthest);
    for(const p of [.1,.25,.5,.75,.9]){
        const angles=Array.from({length:12},(_,i)=>vortexTurn(p,i,12));
        assert.ok(angles.every(a=>a>=0&&a<Math.PI*2));
        assert.ok(angles[0]>angles[11],'Inner part must spin farther than outer rings');
        assert.deepEqual(angles,Array.from({length:12},(_,i)=>vortexTurn(p,i,12)));
    }
    for(let i=0;i<12;i++){
        assert.equal(vortexTurn(0,i,12),0);
        assert.equal(vortexTurn(1,i,12),0);
        assert.ok(vortexTurn(.25,i,12)>vortexTurn(.75,i,12));
    }
});
test('Heat haze waves vary across bands and frames but vanish at both ends',()=>{
    for(const frame of [0,10,23,101]){
        const shifts=Array.from({length:28},(_,i)=>heatHazeShift(.5,i,frame,196));
        assert.ok(new Set(shifts).size>5,'Haze must warp neighboring rows differently');
        for(let row=0;row<28;row++){
            assert.equal(heatHazeShift(0,row,frame,196),0);
            assert.equal(heatHazeShift(1,row,frame,196),0);
            assert.equal(heatHazeShift(.5,row,frame,196),shifts[row]);
            assert.ok(Math.abs(shifts[row])<=Math.min(196*.065,34)+1);
        }
    }
    assert.notDeepEqual(
        Array.from({length:28},(_,i)=>heatHazeShift(.5,i,5,196)),
        Array.from({length:28},(_,i)=>heatHazeShift(.5,i,6,196)),
        'Heat must visibly shimmer as time advances');
});
test('Refraction has staggered triangular facet offsets and clean endpoints',()=>{
    const atMid=Array.from({length:24},(_,i)=>refractionFacetOffset(.5,i,196,112));
    assert.ok(new Set(atMid.map(v=>v.x+','+v.y)).size>10,
        'Individual facets must bend the source in different directions');
    for(let i=0;i<24;i++){
        assert.deepEqual(refractionFacetOffset(0,i,196,112),{x:0,y:0});
        assert.deepEqual(refractionFacetOffset(1,i,196,112),{x:0,y:0});
        assert.deepEqual(refractionFacetOffset(.5,i,196,112),atMid[i]);
        assert.ok(Math.abs(atMid[i].x)<=Math.min(196*.085,28)+1);
        assert.ok(Math.abs(atMid[i].y)<=Math.min(112*.09,20)+1);
    }
});
test('8K preserves non-destructive pair placement and Undo/Redo source data',()=>{
    const a={id:'A',type:'video',start:1,clipDuration:5,order:2,laneId:'A',sourceName:'a.mp4',
        file:{name:'a.mp4'},sourceOffset:.3,audio:{volume:.43}};
    const b={id:'B',type:'video',start:6,clipDuration:4,order:1,laneId:'B',sourceName:'b.mp4',
        file:{name:'b.mp4'},sourceOffset:.7,audio:{volume:.88}};
    for(const effectId of chosen){
        const plan=planPairedTransition([a,b],['B','A'],1.5,effectId);
        assert.equal(plan.start,4.5);
        assert.equal(plan.duration,1.5);
        assert.equal(plan.effectId,effectId);
        const incoming={...b,start:plan.start,order:plan.incomingOrder,
            transitionFromId:'A',transitionEffectId:effectId,
            visualTransitions:plan.incomingTransitions};
        assert.equal(isPairedFadeActive(incoming,[a,incoming]),true);
        assert.equal(pairedEffectProgress(incoming,5.25),.5);
        const snapshot=snapshotClip(incoming);
        incoming.transitionEffectId=null;
        applyClipData(incoming,snapshot);
        assert.equal(incoming.transitionEffectId,effectId);
    }
    assert.equal(a.sourceOffset,.3);
    assert.equal(b.sourceOffset,.7);
    assert.equal(a.audio.volume,.43);
    assert.equal(b.audio.volume,.88);
    assert.equal(b.start,6);
});
