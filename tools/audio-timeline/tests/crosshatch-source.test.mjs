import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {CROSSHATCH_SOURCE,CROSSHATCH_DEFAULTS,normaliseCrosshatchOptions} from '../js/gl-transitions/Crosshatch.mjs';
const custom={centerX:.24,centerY:.78,threshold:1.65,fadeEdge:.22};
test('Crosshatch original MIT upstream source is byte-for-byte intact',()=>{
 const data=Buffer.from(CROSSHATCH_SOURCE,'utf8');
 const sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 assert.equal(sha,'debf06bd2d8f0d80ab164058a68687c4a9976570');
 assert.match(CROSSHATCH_SOURCE,/uniform vec2 center;/);
 assert.match(CROSSHATCH_SOURCE,/uniform float threshold;/);
 assert.match(CROSSHATCH_SOURCE,/uniform float fadeEdge;/);
 assert.match(CROSSHATCH_SOURCE,/min\(rand\(vec2\(p.y/);
 assert.match(CROSSHATCH_SOURCE,/distance\(center, p\) \/ threshold/);
});
test('Crosshatch is the original selected #35 and remains one of 41 unique effects',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[34],'Cross hatch');
 assert.equal(TRANSITION_CATALOG[34].id,'cross-hatch');
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(x=>x==='cross-hatch').length,1);
 assert.equal(isAvailablePairEffect('cross-hatch'),true);
});
test('Native centre x/y, threshold and feather keep original defaults with valid ranges',()=>{
 assert.deepEqual(normaliseCrosshatchOptions(),CROSSHATCH_DEFAULTS);
 assert.deepEqual(normaliseCrosshatchOptions(custom),custom);
 assert.deepEqual(normaliseCrosshatchOptions({centerX:2,centerY:-8,threshold:900,fadeEdge:0}),
  {centerX:1,centerY:0,threshold:8,fadeEdge:.01});
 assert.deepEqual(normaliseCrosshatchOptions({centerX:-1,centerY:17,threshold:-5,fadeEdge:8}),
  {centerX:0,centerY:1,threshold:.1,fadeEdge:.5});
});
test('Crosshatch centre/threshold/edge settings persist with two videos through Undo/Redo',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
  start:0,clipDuration:3,order:2,audio:{volume:.45}};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.78},transitionFromId:'A',
  transitionEffectId:'cross-hatch',transitionParameters:{'cross-hatch':custom},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'cross-hatch').effectId,'cross-hatch');
 const saved=snapshotClip(b);
 const restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,saved);
 assert.equal(restored.transitionEffectId,'cross-hatch');
 assert.deepEqual(restored.transitionParameters['cross-hatch'],custom);
 assert.equal(restored.audio.volume,.78);
});
