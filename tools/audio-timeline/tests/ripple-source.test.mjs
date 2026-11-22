import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {RIPPLE_SOURCE,RIPPLE_DEFAULTS,normaliseRippleOptions} from '../js/gl-transitions/Ripple.mjs';
test('Ripple original gre/MIT GLSL is byte-pinned with full-frame UV wave and smooth crossfade',()=>{
 const data=Buffer.from(RIPPLE_SOURCE,'utf8');
 const sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 assert.equal(sha,'b218a90209ea7a3d5f5fb4ce403cabace3cadab3');
 assert.match(RIPPLE_SOURCE,/uniform float amplitude;/);
 assert.match(RIPPLE_SOURCE,/uniform float speed;/);
 assert.match(RIPPLE_SOURCE,/sin\(progress \* dist \* amplitude - progress \* speed\)/);
 assert.match(RIPPLE_SOURCE,/getFromColor\(uv \+ offset\)/);
 assert.match(RIPPLE_SOURCE,/smoothstep\(0\.2, 1\.0, progress\)/);
});
test('Original final transition #41 is catalogued once under ripple',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[40],'Ripple');
 assert.equal(TRANSITION_CATALOG[40].id,'ripple');
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(id=>id==='ripple').length,1);
 assert.ok(isAvailablePairEffect('ripple'));
});
test('Original Ripple amplitude and speed options preserve defaults, signed velocity, bounded input',()=>{
 assert.deepEqual(normaliseRippleOptions(),RIPPLE_DEFAULTS);
 assert.deepEqual(normaliseRippleOptions({amplitude:175,speed:-120}),{amplitude:175,speed:-120});
 assert.deepEqual(normaliseRippleOptions({amplitude:-1,speed:500}),{amplitude:0,speed:300});
 assert.deepEqual(normaliseRippleOptions({amplitude:NaN,speed:''}),RIPPLE_DEFAULTS);
});
test('Ripple A/B pair, audio, native controls and Undo/Redo clip snapshots survive',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
   start:0,clipDuration:3,order:2,audio:{volume:.58}};
 const native={amplitude:178,speed:-42};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.82},transitionFromId:'A',
  transitionEffectId:'ripple',transitionParameters:{ripple:native},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'ripple').effectId,'ripple');
 const saved=snapshotClip(b),restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,saved);
 assert.equal(restored.transitionEffectId,'ripple');
 assert.deepEqual(restored.transitionParameters.ripple,native);
 assert.equal(restored.audio.volume,.82);
});