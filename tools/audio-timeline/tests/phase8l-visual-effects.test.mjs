import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTIVE_PAIR_EFFECTS,liquidSurfaceY,disintegrateFragmentProgress,
    disintegrateFragmentOffset,lightRayFraction,pairedEffectProgress
} from '../js/paired-visual-effects.mjs';
import { TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES } from '../js/transition-catalog.mjs';
import { planPairedTransition,isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';
const selected=['liquid-fill','disintegrate','light-rays'];

test('Phase 8L adds three chosen effects without losing any of the 41 originals',()=>{
    assert.equal(SELECTED_TRANSITION_NAMES.length,41);
    assert.equal(new Set(TRANSITION_CATALOG.map(x=>x.id)).size,41);
    assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(28,31),selected);
    assert.equal(TRANSITION_CATALOG.filter(x=>x.status==='available').length,41);
    assert.equal(TRANSITION_CATALOG.filter(x=>x.status==='requested').length,0);
    for(const id of selected)assert.equal(TRANSITION_CATALOG.find(x=>x.id===id)?.status,'available');
    assert.equal(TRANSITION_CATALOG.find(x=>x.id==='spiralblockwipe')?.status,'requested');
});
test('Liquid surface rises through a reproducible, genuinely wavy crest',()=>{
    const width=196,height=112;
    for(const x of [0,28,64,100,140,196]){
        assert.equal(liquidSurfaceY(0,x,width,height,1.5),height);
        assert.equal(liquidSurfaceY(1,x,width,height,1.5),0);
        const a=liquidSurfaceY(.5,x,width,height,1.5);
        assert.ok(a>=0&&a<=height);
        assert.equal(a,liquidSurfaceY(.5,x,width,height,1.5));
    }
    const mid=Array.from({length:40},(_,i)=>liquidSurfaceY(.5,i*width/40,width,height,1.5));
    assert.ok(Math.max(...mid)-Math.min(...mid)>4,'Crest must be wavy, not a flat rectangle');
    const average=p=>Array.from({length:40},(_,i)=>
        liquidSurfaceY(p,i*width/40,width,height,1.5)).reduce((a,b)=>a+b,0)/40;
    assert.ok(average(.25)>average(.5)&&average(.5)>average(.75),
        'Overall fill surface must rise as progress increases');
});
test('Disintegrate has varied, deterministic shard departure and motion',()=>{
    const stages=Array.from({length:96},(_,i)=>disintegrateFragmentProgress(.5,i));
    assert.ok(stages.filter(s=>s===0).length>5,'Some outgoing shards must still be intact');
    assert.ok(stages.filter(s=>s===1).length>5,'Some outgoing shards must be gone');
    assert.ok(stages.some(s=>s>0&&s<1),'Other shards should be leaving');
    let moving=0;
    for(let i=0;i<96;i++){
        assert.equal(disintegrateFragmentProgress(0,i),0);
        assert.equal(disintegrateFragmentProgress(1,i),1);
        assert.deepEqual(disintegrateFragmentOffset(0,i,196,112),{x:0,y:0});
        assert.deepEqual(disintegrateFragmentOffset(1,i,196,112),{x:0,y:0});
        let last=0;
        for(let k=0;k<=100;k++){
            const stage=disintegrateFragmentProgress(k/100,i);
            assert.ok(stage>=last&&stage<=1,'A shard must not reappear after departure');
            last=stage;
        }
        const move=disintegrateFragmentOffset(.5,i,196,112);
        assert.deepEqual(move,disintegrateFragmentOffset(.5,i,196,112));
        if(move.x||move.y)moving++;
    }
    assert.ok(moving>15,'Disintegration must physically move shards, not just flip tiles');
});
test('Light rays widen independently across 16 angular sectors',()=>{
    const fractions=Array.from({length:16},(_,i)=>lightRayFraction(.5,i,16));
    assert.ok(new Set(fractions.map(x=>Math.round(x*100))).size>8);
    for(let i=0;i<16;i++){
        assert.equal(lightRayFraction(0,i,16),0);
        assert.equal(lightRayFraction(1,i,16),1);
        let last=0;
        for(let k=0;k<=100;k++){
            const f=lightRayFraction(k/100,i,16);
            assert.ok(f>=last&&f<=1,'Each ray must widen monotonically');
            assert.equal(f,lightRayFraction(k/100,i,16));
            last=f;
        }
    }
    assert.ok(fractions.some(f=>f>.7)&&fractions.some(f=>f<.4),
        'The ray gaps must be uneven at the midpoint');
});
test('Liquid, Disintegrate and Light rays preserve clips/audio and Undo/Redo',()=>{
    const a={id:'A',type:'video',start:1,clipDuration:5,order:2,laneId:'A',
        sourceName:'a.mp4',file:{name:'a.mp4'},sourceOffset:.35,audio:{volume:.61}};
    const b={id:'B',type:'video',start:6,clipDuration:4,order:1,laneId:'B',
        sourceName:'b.mp4',file:{name:'b.mp4'},sourceOffset:.8,audio:{volume:.83}};
    for(const effectId of selected){
        const plan=planPairedTransition([a,b],['A','B'],1.5,effectId);
        assert.equal(plan.start,4.5);
        assert.equal(plan.duration,1.5);
        assert.equal(plan.effectId,effectId);
        const incoming={...b,start:plan.start,order:plan.incomingOrder,
            transitionFromId:'A',transitionEffectId:effectId,
            visualTransitions:plan.incomingTransitions};
        assert.equal(isPairedFadeActive(incoming,[a,incoming]),true);
        assert.equal(pairedEffectProgress(incoming,5.25),.5);
        const stored=snapshotClip(incoming);
        incoming.transitionEffectId=null;
        applyClipData(incoming,stored);
        assert.equal(incoming.transitionEffectId,effectId);
    }
    assert.equal(a.audio.volume,.61);
    assert.equal(b.audio.volume,.83);
    assert.equal(a.sourceOffset,.35);
    assert.equal(b.sourceOffset,.8);
    assert.equal(b.start,6);
});
