import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES,normalizeTransitionEffectId,
    normalizeTransitionParameters} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {WHIP_SPIN_SOURCE,WHIP_SPIN_DEFAULTS,normaliseWhipSpinOptions} from '../js/gl-transitions/WhipSpin.mjs';

const OPTIONS={turns:-1.5,blur:.8,chroma:.75,zoom:.4};
test('WhipSpin is #27, retains 41 selected names, and accepts historical spin aliases',()=>{
    assert.equal(SELECTED_TRANSITION_NAMES.length,41);
    assert.equal(SELECTED_TRANSITION_NAMES[26],'WhipSpin');
    assert.equal(TRANSITION_CATALOG[26].label,'WhipSpin');
    assert.equal(TRANSITION_CATALOG[26].id,'whipspin');
    assert.equal(ACTIVE_PAIR_EFFECTS[16],'whipspin');
    assert.equal(ACTIVE_PAIR_EFFECTS.length,41);
    assert.equal(normalizeTransitionEffectId('spin'),'whipspin');
    assert.equal(normalizeTransitionEffectId('whip-spin'),'whipspin');
    assert.equal(normalizeTransitionEffectId('whipspin'),'whipspin');
    assert.equal(isAvailablePairEffect('spin'),true);
    assert.equal(isAvailablePairEffect('whipspin'),true);
});
test('original upstream gre/MIT WhipSpin GLSL is pinned byte-for-byte',()=>{
    const bytes=Buffer.from(WHIP_SPIN_SOURCE,'utf8');
    const gitBlob=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
    assert.equal(gitBlob,'ca5e1cf7c21090fd2b034c661d298d5f028bd8b1');
    assert.match(WHIP_SPIN_SOURCE,/const int SAMPLES = 24/);
    for(const key of ['turns','blur','chroma','zoom'])
        assert.match(WHIP_SPIN_SOURCE,new RegExp('uniform float '+key+';'));
});
test('four original shader settings have correct defaults and native limits',()=>{
    assert.deepEqual(normaliseWhipSpinOptions(),WHIP_SPIN_DEFAULTS);
    assert.deepEqual(normaliseWhipSpinOptions(OPTIONS),OPTIONS);
    assert.deepEqual(normaliseWhipSpinOptions({turns:12,blur:-1,chroma:2,zoom:9}),
        {turns:3,blur:0,chroma:1,zoom:1});
});
test('old spin settings key is migrated without overwriting existing canonical data',()=>{
    assert.deepEqual(normalizeTransitionParameters({spin:OPTIONS}),{whipspin:OPTIONS});
    const preferred={...OPTIONS,turns:2};
    assert.deepEqual(normalizeTransitionParameters({spin:OPTIONS,whipspin:preferred}),{whipspin:preferred});
    assert.deepEqual(normalizeTransitionParameters({'whip-spin':OPTIONS}),{whipspin:OPTIONS});
});
test('old spin projects survive paired planning and Undo/Redo snapshots',()=>{
    const a={id:'A',type:'video',start:0,clipDuration:4,order:2,
        sourceName:'a.mp4',file:{name:'a.mp4'},audio:{volume:.5}};
    const b={id:'B',type:'video',start:3,clipDuration:4,order:1,
        sourceName:'b.mp4',file:{name:'b.mp4'},audio:{volume:.8},
        transitionFromId:'A',transitionEffectId:'spin',transitionParameters:{spin:OPTIONS},
        visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
    const plan=planPairedTransition([a,b],['B','A'],1,'spin');
    assert.equal(plan.effectId,'whipspin');
    const snap=snapshotClip(b);
    assert.equal(snap.transitionEffectId,'whipspin');
    assert.deepEqual(snap.transitionParameters,{whipspin:OPTIONS});
    const copy={...b,transitionEffectId:'spin',transitionParameters:{spin:{...OPTIONS}}};
    applyClipData(copy,{...snap,transitionEffectId:'spin',transitionParameters:{spin:OPTIONS}});
    assert.equal(copy.transitionEffectId,'whipspin');
    assert.deepEqual(copy.transitionParameters,{whipspin:OPTIONS});
    assert.equal(copy.audio.volume,.8);
});
