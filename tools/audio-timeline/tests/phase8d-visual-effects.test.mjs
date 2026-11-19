import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTIVE_PAIR_EFFECTS,isAvailablePairEffect,radialMaskRadius,tvScanHeight,
    pairedEffectProgress
} from '../js/paired-visual-effects.mjs';
import { planPairedTransition,isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import { TRANSITION_CATALOG } from '../js/transition-catalog.mjs';

test('Phase 8D enables three new selected effects without renumbering the original 41',()=>{
    const expected=['ripple','tv-turn-off','aperture-wipe'];
    assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(4,7),expected);
    assert.equal(TRANSITION_CATALOG.length,41);
    assert.equal(TRANSITION_CATALOG.filter(effect=>effect.status==='available').length,16);
    assert.equal(TRANSITION_CATALOG.filter(effect=>effect.status==='requested').length,25);
    for(const id of expected){
        assert.ok(isAvailablePairEffect(id),id+' should be implemented');
        assert.equal(TRANSITION_CATALOG.find(effect=>effect.id===id)?.status,'available');
    }
    assert.equal(TRANSITION_CATALOG.find(effect=>effect.id==='hologram')?.status,'requested');
});

test('Aperture expands smoothly from center and reaches the farthest corner',()=>{
    const corner=Math.hypot(98,56);
    assert.equal(radialMaskRadius('aperture-wipe',0,196,112),0);
    assert.equal(radialMaskRadius('aperture-wipe',1,196,112),corner);
    assert.equal(radialMaskRadius('aperture-wipe',.5,196,112),corner/2);
    for(const p of [0,.1,.25,.5,.75,1]){
        assert.equal(radialMaskRadius('aperture-wipe',p,196,112,2),
                     radialMaskRadius('aperture-wipe',p,196,112,0),
                     'Aperture radius must not depend on angle');
    }
});

test('Ripple wavefront is deterministic, radial, and resolves to a clean full frame',()=>{
    const diagonal=Math.hypot(98,56);
    for(const angle of [0,Math.PI/4,Math.PI,5*Math.PI/4]){
        assert.equal(radialMaskRadius('ripple',0,196,112,angle),0);
        assert.ok(Math.abs(radialMaskRadius('ripple',1,196,112,angle)-diagonal)<1e-9);
        for(const p of [.15,.35,.5,.8]){
            const r=radialMaskRadius('ripple',p,196,112,angle);
            assert.ok(r>=0&&r<=diagonal+6,'Ripple edge remains within a bounded wavefront');
            assert.equal(r,radialMaskRadius('ripple',p,196,112,angle),
                         'Same timestamp must yield identical wave shape');
        }
    }
    assert.notEqual(radialMaskRadius('ripple',.5,196,112,0),
                    radialMaskRadius('aperture-wipe',.5,196,112,0),
                    'Ripple must not collapse to a plain circular aperture');
});

test('TV transition collapses A to a scanline then expands B to full-screen',()=>{
    assert.equal(tvScanHeight(0),1);
    assert.equal(tvScanHeight(.5),0);
    assert.equal(tvScanHeight(1),1);
    assert.equal(tvScanHeight(-10),1);
    assert.equal(tvScanHeight(15),1);
    for(const p of [.1,.25,.4,.6,.75,.9]){
        assert.ok(tvScanHeight(p)>0&&tvScanHeight(p)<1);
        assert.ok(Math.abs(tvScanHeight(p)-tvScanHeight(1-p))<1e-9,
                 'The shutdown and restart heights should mirror each other');
    }
});

test('New effects retain pair timeline and video-audio metadata without mutation',()=>{
    const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
        start:0,clipDuration:4,laneId:'1',order:2,audio:{volume:.6}};
    const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
        start:4,clipDuration:3,laneId:'2',order:1,audio:{volume:.8}};
    for(const effectId of ['ripple','tv-turn-off','aperture-wipe']){
        const plan=planPairedTransition([a,b],['B','A'],1.25,effectId);
        assert.equal(plan.start,2.75);
        assert.equal(plan.duration,1.25);
        assert.equal(plan.effectId,effectId);
        const activeB={...b,start:plan.start,order:plan.incomingOrder,
            transitionFromId:'A',transitionEffectId:effectId,
            visualTransitions:plan.incomingTransitions};
        assert.equal(isPairedFadeActive(activeB,[a,activeB]),true);
        assert.equal(pairedEffectProgress(activeB,plan.start+.625),.5);
    }
    assert.equal(a.audio.volume,.6);
    assert.equal(b.audio.volume,.8);
    assert.equal(b.start,4);
});
