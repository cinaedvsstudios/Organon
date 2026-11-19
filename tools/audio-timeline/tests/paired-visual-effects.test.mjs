import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSITION_CATALOG } from '../js/transition-catalog.mjs';
import { planPairedTransition, isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import {
    ACTIVE_PAIR_EFFECTS,isAvailablePairEffect,unit,seededCell,revealCell,
    pixelScale,glitchShift,pairedEffectProgress
} from '../js/paired-visual-effects.mjs';
import { visualFadeOpacity } from '../js/visual-transitions.mjs';
const clip=(id,start,order)=>({
    id,type:'video',start,clipDuration:4,sourceName:id+'.mp4',file:{name:id+'.mp4'},
    laneId:id,order,sourceDuration:4,sourceOffset:0,
    visualTransitions:{enter:{duration:0,curve:'linear'},exit:{duration:0,curve:'linear'}},
    audio:{volume:1,muted:false,fadeIn:0,fadeOut:0}
});
test('new batch enables only selected, genuinely available effects',()=>{
    assert.deepEqual(ACTIVE_PAIR_EFFECTS,['fade','pixelize','random-squares','glitch-flicker','ripple','tv-turn-off','aperture-wipe','spiral-wipe','rings-wipe','color-panel-wipe','block-cover','cross-hatch','film-strip','card-swipe','camera-shake','vhs-tracking','spin','cube','cross-warp','paper-tear','ink-bleed','splatter-wipe','cell-dissolve','bloom-dissolve','smoke-dissolve','vortex','heat-haze','refraction','liquid-fill','disintegrate','light-rays','ascii','color-codes','prisms','spiralblockwipe','hologram','crumple']);
    assert.deepEqual(TRANSITION_CATALOG.filter(x=>x.status==='available').map(x=>x.id),
        ['cell-dissolve','vortex','liquid-fill','heat-haze','rings-wipe','color-panel-wipe','vhs-tracking','card-swipe','camera-shake','smoke-dissolve','splatter-wipe','bloom-dissolve','light-rays','block-cover','disintegrate','ascii','film-strip','ink-bleed','refraction','spin','paper-tear','aperture-wipe','spiral-wipe','prisms','tv-turn-off','color-codes','cross-warp','cross-hatch','cube','fade','glitch-flicker','pixelize','random-squares','ripple','spiralblockwipe','hologram','crumple']);
    assert.equal(TRANSITION_CATALOG.length,41);
    assert.equal(TRANSITION_CATALOG.filter(x=>x.status==='requested').length,4);
    assert.equal(isAvailablePairEffect('gallery'),false);
});
test('all thirty-seven paired effects compute the same overlap but preserve effect ID',()=>{
    const a=clip('a',0,2),b=clip('b',4,1);
    for(const effectId of ACTIVE_PAIR_EFFECTS){
        const plan=planPairedTransition([a,b],['b','a'],1.5,effectId);
        assert.equal(plan.start,2.5,effectId);
        assert.equal(plan.duration,1.5,effectId);
        assert.equal(plan.effectId,effectId);
        assert.equal(plan.incomingTransitions.enter.duration,1.5);
        const next={...b,start:plan.start,order:plan.incomingOrder,
            transitionFromId:a.id,transitionEffectId:effectId,
            visualTransitions:plan.incomingTransitions};
        assert.equal(isPairedFadeActive(next,[a,next]),true,effectId);
    }
    assert.throws(()=>planPairedTransition([a,b],['a','b'],1,'gallery'),/not implemented/);
    assert.equal(a.audio.volume,1,'Pair planning may not alter linked audio');
});
test('reveal mask is deterministic, monotonic and ends fully revealed',()=>{
    for(const p of [0,.01,.25,.5,.75,.99,1]){
        const reveals=Array.from({length:112},(_,i)=>revealCell(p,i));
        assert.equal(revealCell(p,7),revealCell(p,7));
        if(p===0)assert.equal(reveals.filter(Boolean).length,0);
        if(p===1)assert.equal(reveals.filter(Boolean).length,112);
    }
    for(let i=0;i<112;i++){
        assert.ok(seededCell(i)>=0&&seededCell(i)<1);
        assert.ok(!revealCell(.2,i)||revealCell(.8,i));
    }
});
test('Pixelize block scale decreases toward a clean incoming frame',()=>{
    assert.equal(pixelScale(0),40);
    assert.equal(pixelScale(1),1);
    assert.ok(pixelScale(.25)>pixelScale(.75));
    assert.equal(pixelScale(50),1);
});
test('glitch displacements decay and same frame always yields same offset',()=>{
    for(let band=0;band<18;band++){
        const shift=glitchShift(.35,band,24,400);
        assert.equal(shift,glitchShift(.35,band,24,400));
        assert.ok(Math.abs(shift)<=26);
        assert.equal(glitchShift(1,band,24,400),0);
    }
});
test('non-Fade paired effects remove only the entrance alpha, not exit fade',()=>{
    const v=clip('b',2,.5);
    v.visualTransitions.enter.duration=1;
    v.visualTransitions.exit.duration=2;
    assert.equal(visualFadeOpacity(v,2.5),.5);
    assert.equal(visualFadeOpacity(v,2.5,{ignoreEnter:true}),1);
    assert.equal(visualFadeOpacity(v,5,{ignoreEnter:true}),.5);
    assert.equal(pairedEffectProgress(v,2),0);
    assert.equal(pairedEffectProgress(v,2.5),.5);
    assert.equal(pairedEffectProgress(v,3),1);
    assert.equal(unit(NaN),0);
});
