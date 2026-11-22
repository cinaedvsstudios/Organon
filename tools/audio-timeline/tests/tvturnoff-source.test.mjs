import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {TV_TURN_OFF_SOURCE,TV_TURN_OFF_DEFAULTS,normaliseTvTurnOffOptions} from '../js/gl-transitions/TvTurnOff.mjs';
const opts={color:'#2939ad',colorAlpha:.65,glow:1.7};
test('Original two-phase TvTurnOff shader matches exact upstream MIT bytes',()=>{
 const data=Buffer.from(TV_TURN_OFF_SOURCE,'utf8');
 const sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 assert.equal(sha,'4a4aeed6f039ac528aa48e9dd818c1592e2d8b07');
 assert.match(TV_TURN_OFF_SOURCE,/uniform vec4 color;/);
 assert.match(TV_TURN_OFF_SOURCE,/uniform float glow;/);
 assert.match(TV_TURN_OFF_SOURCE,/return screen\(uv, 2\.0 \* progress, true\);/);
 assert.match(TV_TURN_OFF_SOURCE,/return screen\(uv, 2\.0 - 2\.0 \* progress, false\);/);
});
test('TvTurnOff is the original #32 of 41 selected effects',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[31],'TV turn off');
 assert.equal(TRANSITION_CATALOG[31].id,'tv-turn-off');
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(x=>x==='tv-turn-off').length,1);
 assert.ok(isAvailablePairEffect('tv-turn-off'));
});
test('TvTurnOff native screen RGBA and line/dot glow preserve defaults and clamp bounds',()=>{
 assert.deepEqual(normaliseTvTurnOffOptions(),TV_TURN_OFF_DEFAULTS);
 assert.deepEqual(normaliseTvTurnOffOptions(opts),opts);
 assert.deepEqual(normaliseTvTurnOffOptions({color:'not a color',colorAlpha:12,glow:-3}),
  {color:'#000000',colorAlpha:1,glow:0});
 assert.deepEqual(normaliseTvTurnOffOptions({color:'#ABCDEF',colorAlpha:-4,glow:9}),
  {color:'#abcdef',colorAlpha:0,glow:2});
});
test('TvTurnOff RGBA and CRT halo options survive history snapshots and Undo/Redo',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
  start:0,clipDuration:3,order:2,audio:{volume:.42}};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.8},transitionFromId:'A',
  transitionEffectId:'tv-turn-off',transitionParameters:{'tv-turn-off':opts},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'tv-turn-off').effectId,'tv-turn-off');
 const snapshot=snapshotClip(b);
 const restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,snapshot);
 assert.equal(restored.transitionEffectId,'tv-turn-off');
 assert.deepEqual(restored.transitionParameters['tv-turn-off'],opts);
 assert.equal(restored.audio.volume,.8);
});
