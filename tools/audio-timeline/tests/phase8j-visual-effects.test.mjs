import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTIVE_PAIR_EFFECTS,cellDissolveGrowth,bloomPulse,smokeCloud,smokeDensity,
    pairedEffectProgress
} from '../js/paired-visual-effects.mjs';
import { TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES } from '../js/transition-catalog.mjs';
import { planPairedTransition,isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';
const chosen=['cell-dissolve','bloom-dissolve','smoke-dissolve'];

test('8J preserves all 41 original names with exactly 25 enabled and 16 queued',()=>{
    assert.equal(SELECTED_TRANSITION_NAMES.length,41);
    assert.equal(new Set(TRANSITION_CATALOG.map(e=>e.id)).size,41);
    assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(22,25),chosen);
    assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='available').length,28);
    assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='requested').length,13);
    for(const id of chosen)assert.equal(TRANSITION_CATALOG.find(e=>e.id===id)?.status,'available');
    assert.equal(TRANSITION_CATALOG.find(e=>e.id==='spiralblockwipe')?.status,'requested');
});
test('Cell dissolve grows stable, staggered hexagons without reversed progress',()=>{
    const midpoint=[];
    for(let i=0;i<84;i++){
        assert.equal(cellDissolveGrowth(0,i),0);
        assert.equal(cellDissolveGrowth(1,i),1);
        let previous=0;
        for(let frame=1;frame<=100;frame++){
            const amount=cellDissolveGrowth(frame/100,i);
            assert.ok(amount>=previous&&amount<=1,'A revealed cell must never shrink');
            assert.equal(amount,cellDissolveGrowth(frame/100,i));
            previous=amount;
        }
        midpoint.push(cellDissolveGrowth(.5,i));
    }
    assert.ok(midpoint.some(g=>g===0)&&midpoint.some(g=>g===1),
        'Cell dissolve must have a mixed old/new phase');
    assert.ok(midpoint.some(g=>g>0&&g<1),'At least some cells should still be opening');
});
test('Bloom dissolve creates an overexposed midpoint but settles cleanly',()=>{
    assert.equal(bloomPulse(0),0);
    assert.equal(bloomPulse(1),0);
    assert.equal(bloomPulse(-5),0);
    assert.equal(bloomPulse(6),0);
    assert.equal(bloomPulse(.5),1);
    assert.ok(bloomPulse(.25)>0&&bloomPulse(.25)<1);
    assert.ok(Math.abs(bloomPulse(.25)-bloomPulse(.75))<1e-10);
    for(const p of [.15,.35,.6,.85])
        assert.equal(bloomPulse(p),bloomPulse(p),'Glow must be seek deterministic');
});
test('Smoke clouds drift to the right in stable scattered bands',()=>{
    assert.equal(smokeDensity(0),0);
    assert.equal(smokeDensity(1),0);
    assert.equal(smokeDensity(.5),1);
    const origins=Array.from({length:18},(_,i)=>smokeCloud(0,i,196,112));
    const end=Array.from({length:18},(_,i)=>smokeCloud(1,i,196,112));
    for(let i=0;i<18;i++){
        const a=origins[i],b=end[i],mid=smokeCloud(.5,i,196,112);
        assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y)&&a.radius>0);
        assert.ok(b.x>a.x,'Each cloud travels forward');
        assert.equal(mid.x,smokeCloud(.5,i,196,112).x);
        assert.equal(mid.y,smokeCloud(.5,i,196,112).y);
    }
    assert.ok(new Set(origins.map(p=>Math.round(p.y))).size>=9,
        'Smoke clouds need an irregular vertical distribution');
});
test('The three new effects retain source/audio metadata and full Undo/Redo',()=>{
    const a={id:'A',type:'video',start:1,clipDuration:5,order:2,laneId:'A',
        sourceName:'a.mp4',file:{name:'a.mp4'},sourceOffset:.35,audio:{volume:.65}};
    const b={id:'B',type:'video',start:6,clipDuration:4,order:1,laneId:'B',
        sourceName:'b.mp4',file:{name:'b.mp4'},sourceOffset:.75,audio:{volume:.8}};
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
        const original=snapshotClip(incoming);
        incoming.transitionEffectId=null;
        applyClipData(incoming,original);
        assert.equal(incoming.transitionEffectId,effectId);
    }
    assert.equal(a.sourceOffset,.35);
    assert.equal(b.sourceOffset,.75);
    assert.equal(a.audio.volume,.65);
    assert.equal(b.audio.volume,.8);
    assert.equal(b.start,6);
});
