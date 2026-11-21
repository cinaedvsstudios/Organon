import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {SPIRAL_WIPE_SOURCE,SPIRAL_WIPE_DEFAULTS,normaliseSpiralWipeOptions} from '../js/gl-transitions/SpiralWipe.mjs';
const opts={turns:5.5,smoothness:.2,clockwise:false};
test('Original MIT SpiralWipe bytes match pinned upstream git blob',()=>{
 const data=Buffer.from(SPIRAL_WIPE_SOURCE,'utf8');
 const sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 assert.equal(sha,'2d71f5c76ef90865a04f1e3d2c94251c1bce2733');
 for(const param of ['turns','smoothness'])assert.match(SPIRAL_WIPE_SOURCE,new RegExp('uniform float '+param+';'));
 assert.match(SPIRAL_WIPE_SOURCE,/uniform bool clockwise;/);
 assert.match(SPIRAL_WIPE_SOURCE,/float arm \(/);
});
test('SpiralWipe remains unique original #30 in 41-effect catalog',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[29],'Spiral wipe');
 assert.equal(TRANSITION_CATALOG[29].id,'spiral-wipe');
 assert.equal(isAvailablePairEffect('spiral-wipe'),true);
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(x=>x==='spiral-wipe').length,1);
});
test('native turns/edge softness/clockwise parameters retain source defaults and bounds',()=>{
 assert.deepEqual(normaliseSpiralWipeOptions(),SPIRAL_WIPE_DEFAULTS);
 assert.deepEqual(normaliseSpiralWipeOptions(opts),opts);
 assert.deepEqual(normaliseSpiralWipeOptions({turns:50,smoothness:-2,clockwise:'false'}),
  {turns:8,smoothness:0,clockwise:false});
 assert.deepEqual(normaliseSpiralWipeOptions({turns:-9,smoothness:8,clockwise:'true'}),
  {turns:2,smoothness:.5,clockwise:true});
 assert.equal(normaliseSpiralWipeOptions({clockwise:0}).clockwise,false);
});
test('SpiralWipe bool direction survives paired clip plan, snapshot and Undo/Redo',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
  start:0,clipDuration:3,order:2,audio:{volume:.42}};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.8},transitionFromId:'A',
  transitionEffectId:'spiral-wipe',transitionParameters:{'spiral-wipe':opts},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'spiral-wipe').effectId,'spiral-wipe');
 const snapshot=snapshotClip(b);
 const restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,snapshot);
 assert.equal(restored.transitionEffectId,'spiral-wipe');
 assert.deepEqual(restored.transitionParameters['spiral-wipe'],opts);
 assert.equal(restored.audio.volume,.8);
});
