import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {PIXELIZE_SOURCE,PIXELIZE_DEFAULTS,normalisePixelizeOptions} from '../js/gl-transitions/Pixelize.mjs';
test('Pixelize original gre/MIT GLSL is byte-for-byte pinned and pixelates both images',()=>{
 const b=Buffer.from(PIXELIZE_SOURCE,'utf8');
 const sha=createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
 assert.equal(sha,'bda886454bbee787599dad903af0e53d40d1dc26');
 assert.match(PIXELIZE_SOURCE,/uniform ivec2 squaresMin;/);
 assert.match(PIXELIZE_SOURCE,/uniform int steps;/);
 assert.match(PIXELIZE_SOURCE,/float d = min\(progress, 1\.0 - progress\)/);
 assert.match(PIXELIZE_SOURCE,/mix\(getFromColor\(p\), getToColor\(p\), progress\)/);
});
test('Original selected #39 exists exactly once and retains legacy saved ID',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[38],'Pixelize');
 assert.equal(TRANSITION_CATALOG[38].id,'pixelize');
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(id=>id==='pixelize').length,1);
 assert.ok(isAvailablePairEffect('pixelize'));
});
test('Native integer grid and stepped/continuous effect controls keep original defaults and range',()=>{
 assert.deepEqual(normalisePixelizeOptions(),PIXELIZE_DEFAULTS);
 assert.deepEqual(normalisePixelizeOptions({squaresX:36,squaresY:12,steps:0}),{squaresX:36,squaresY:12,steps:0});
 assert.deepEqual(normalisePixelizeOptions({squaresX:0,squaresY:999,steps:-3}),{squaresX:1,squaresY:128,steps:0});
 assert.deepEqual(normalisePixelizeOptions({squaresX:NaN,squaresY:'',steps:Infinity}),PIXELIZE_DEFAULTS);
});
test('Pixelize A/B pairing, clip parameters, audio and Undo/Redo snapshots survive',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},start:0,clipDuration:3,order:2,audio:{volume:.57}};
 const opts={squaresX:32,squaresY:12,steps:0};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},start:3,clipDuration:3,order:1,
  audio:{volume:.82},transitionFromId:'A',transitionEffectId:'pixelize',transitionParameters:{pixelize:opts},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'pixelize').effectId,'pixelize');
 const saved=snapshotClip(b),restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,saved);
 assert.equal(restored.transitionEffectId,'pixelize');
 assert.deepEqual(restored.transitionParameters.pixelize,opts);
 assert.equal(restored.audio.volume,.82);
});