import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {RANDOM_SQUARES_SOURCE,RANDOM_SQUARES_DEFAULTS,normaliseRandomSquaresOptions} from '../js/gl-transitions/RandomSquares.mjs';
test('RandomSquares original gre/MIT GLSL is byte-exact and uses seeded cells and soft reveal',()=>{
 const data=Buffer.from(RANDOM_SQUARES_SOURCE,'utf8');
 const sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 assert.equal(sha,'ac73fb29d26016792756a3a8d1f5daf03af90856');
 assert.match(RANDOM_SQUARES_SOURCE,/uniform ivec2 size;/);
 assert.match(RANDOM_SQUARES_SOURCE,/uniform float smoothness;/);
 assert.match(RANDOM_SQUARES_SOURCE,/rand\(floor\(vec2\(size\) \* p\)\)/);
 assert.match(RANDOM_SQUARES_SOURCE,/smoothstep\(0\.0, -smoothness/);
 assert.match(RANDOM_SQUARES_SOURCE,/mix\(getFromColor\(p\), getToColor\(p\), m\)/);
});
test('Original selected effect #40 is present once with its original ID',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[39],'Random squares');
 assert.equal(TRANSITION_CATALOG[39].id,'random-squares');
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(id=>id==='random-squares').length,1);
 assert.ok(isAvailablePairEffect('random-squares'));
});
test('Original cell grid and softness defaults and bounds survive normalisation',()=>{
 assert.deepEqual(normaliseRandomSquaresOptions(),RANDOM_SQUARES_DEFAULTS);
 assert.deepEqual(normaliseRandomSquaresOptions({sizeX:15,sizeY:8,smoothness:.17}),
  {sizeX:15,sizeY:8,smoothness:.17});
 assert.deepEqual(normaliseRandomSquaresOptions({sizeX:0,sizeY:999,smoothness:-1}),
  {sizeX:1,sizeY:128,smoothness:.01});
 assert.deepEqual(normaliseRandomSquaresOptions({sizeX:NaN,sizeY:'',smoothness:Infinity}),RANDOM_SQUARES_DEFAULTS);
});
test('RandomSquares A/B pairing, native uniforms, audio and Undo snapshots survive',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
  start:0,clipDuration:3,order:2,audio:{volume:.58}};
 const native={sizeX:16,sizeY:9,smoothness:.25};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.76},
  transitionFromId:'A',transitionEffectId:'random-squares',
  transitionParameters:{'random-squares':native},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'random-squares').effectId,'random-squares');
 const saved=snapshotClip(b),restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,saved);
 assert.equal(restored.transitionEffectId,'random-squares');
 assert.deepEqual(restored.transitionParameters['random-squares'],native);
 assert.equal(restored.audio.volume,.76);
});