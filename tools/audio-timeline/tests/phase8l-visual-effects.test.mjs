import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTIVE_PAIR_EFFECTS,liquidSurfaceY,pairedEffectProgress
} from '../js/paired-visual-effects.mjs';
import { TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES } from '../js/transition-catalog.mjs';
import { planPairedTransition,isPairedFadeActive } from '../js/clip-pair-transitions.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';
import {normaliseLightRaysOptions} from '../js/gl-transitions/LightRays.mjs';
import {normaliseDisintegrateOptions} from '../js/gl-transitions/Disintegrate.mjs';
const selected=['liquid-fill','disintegrate','light-rays'];

test('Phase 8L adds three chosen effects without losing any of the 41 originals',()=>{
    assert.equal(SELECTED_TRANSITION_NAMES.length,41);
    assert.equal(new Set(TRANSITION_CATALOG.map(x=>x.id)).size,41);
    assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(28,31),selected);
    assert.equal(TRANSITION_CATALOG.filter(x=>x.status==='available').length,41);
    assert.equal(TRANSITION_CATALOG.filter(x=>x.status==='requested').length,0);
    for(const id of selected)assert.equal(TRANSITION_CATALOG.find(x=>x.id===id)?.status,'available');
    assert.equal(TRANSITION_CATALOG.find(x=>x.id==='spiralblockwipe')?.status,'available');
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
test('Original Disintegrate uses native dust size, wind direction and spread',()=>{
 const native=normaliseDisintegrateOptions({particleSize:.012,directionX:-1,
  directionY:.5,spread:.9});
 assert.deepEqual(native,{particleSize:.012,directionX:-1,directionY:.5,spread:.9});
 assert.deepEqual(normaliseDisintegrateOptions({particleSize:0,directionX:3,
  directionY:-5,spread:4}),{particleSize:.0075,directionX:2,directionY:-2,spread:1});
});
test('Original LightRays normalizes seven optical uniforms without fake wedge geometry',()=>{
 const native=normaliseLightRaysOptions({centerX:.35,centerY:.8,drift:.3,reach:.9,
  threshold:.4,intensity:2.3,tint:'#ffaa44'});
 assert.deepEqual(native,{centerX:.35,centerY:.8,drift:.3,reach:.9,threshold:.4,
  intensity:2.3,tint:'#ffaa44'});
 assert.deepEqual(normaliseLightRaysOptions({centerX:-1,centerY:3,drift:2,
  reach:-1,threshold:2,intensity:9,tint:'invalid'}),{
  centerX:0,centerY:1,drift:.5,reach:0,threshold:.8,intensity:4,tint:'#ffd18c'
 });
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
