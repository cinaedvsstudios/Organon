import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {APERTURE_WIPE_SOURCE,APERTURE_WIPE_DEFAULTS,normaliseApertureWipeOptions} from '../js/gl-transitions/ApertureWipe.mjs';
const opts={blades:10,rotation:-125,shadow:.8};
test('ApertureWipe shader is exact gre/MIT upstream source',()=>{
 const data=Buffer.from(APERTURE_WIPE_SOURCE,'utf8');
 const sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 assert.equal(sha,'298292038e4b03c8be4344e5f84109e3bbfeb04f');
 assert.match(APERTURE_WIPE_SOURCE,/uniform int blades;/);
 assert.match(APERTURE_WIPE_SOURCE,/uniform float rotation;/);
 assert.match(APERTURE_WIPE_SOURCE,/uniform float shadow;/);
 assert.match(APERTURE_WIPE_SOURCE,/for \(int i = 0; i < 12; i\+\+\)/);
});
test('ApertureWipe is original #29 in the 41 selected effects, no duplicate',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[28],'Aperture wipe');
 assert.equal(TRANSITION_CATALOG[28].id,'aperture-wipe');
 assert.equal(isAvailablePairEffect('aperture-wipe'),true);
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(id=>id==='aperture-wipe').length,1);
});
test('three native GLSL controls retain original defaults and clamp documented limits',()=>{
 assert.deepEqual(normaliseApertureWipeOptions(),APERTURE_WIPE_DEFAULTS);
 assert.deepEqual(normaliseApertureWipeOptions(opts),opts);
 assert.deepEqual(normaliseApertureWipeOptions({blades:99,rotation:-999,shadow:12}),
  {blades:12,rotation:-180,shadow:1});
 assert.deepEqual(normaliseApertureWipeOptions({blades:3.4,rotation:200,shadow:-4}),
  {blades:3,rotation:180,shadow:0});
});
test('ApertureWipe camera iris options survive paired clips and Undo/Redo history',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
  start:0,clipDuration:3,order:2,audio:{volume:.42}};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.8},transitionFromId:'A',
  transitionEffectId:'aperture-wipe',transitionParameters:{'aperture-wipe':opts},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'aperture-wipe').effectId,'aperture-wipe');
 const saved=snapshotClip(b);
 const clone={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(clone,saved);
 assert.equal(clone.transitionEffectId,'aperture-wipe');
 assert.deepEqual(clone.transitionParameters['aperture-wipe'],opts);
 assert.equal(clone.audio.volume,.8);
});
