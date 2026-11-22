import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {CUBE_SOURCE,CUBE_DEFAULTS,normaliseCubeOptions} from '../js/gl-transitions/Cube.mjs';
const opts={persp:.2,unzoom:.9,reflection:.8,floating:14,shading:.65};
test('Original gre/MIT raytraced Cube GLSL retains exact upstream git blob',()=>{
 const data=Buffer.from(CUBE_SOURCE,'utf8');
 const sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 assert.equal(sha,'5e456ee806ed761d5a9d670af88daee6d91872d5');
 for(const name of ['persp','unzoom','reflection','floating','shading'])
  assert.match(CUBE_SOURCE,new RegExp('uniform float '+name+';'));
 assert.match(CUBE_SOURCE,/vec4 hitBox\(/);
 assert.match(CUBE_SOURCE,/getFromColor/);
 assert.match(CUBE_SOURCE,/getToColor/);
 assert.match(CUBE_SOURCE,/vec4 ground = vec4\(0\.0\)/);
});
test('Cube remains selected original transition #36 among 41',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[35],'Cube');
 assert.equal(TRANSITION_CATALOG[35].id,'cube');
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(x=>x==='cube').length,1);
 assert.ok(isAvailablePairEffect('cube'));
});
test('All five native GLSL controls retain defaults and clamp documented shader bounds',()=>{
 assert.deepEqual(normaliseCubeOptions(),CUBE_DEFAULTS);
 assert.deepEqual(normaliseCubeOptions(opts),opts);
 assert.deepEqual(normaliseCubeOptions({persp:-2,unzoom:2,reflection:4,floating:99,shading:-3}),
  {persp:0,unzoom:1,reflection:1,floating:20,shading:0});
 assert.deepEqual(normaliseCubeOptions({persp:99,unzoom:-4,reflection:-2,floating:-1,shading:3}),
  {persp:1,unzoom:0,reflection:0,floating:0,shading:1});
});
test('Cube perspective/floor reflection persist with original two-video sources through history',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
  start:0,clipDuration:3,order:2,audio:{volume:.45}};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.78},transitionFromId:'A',
  transitionEffectId:'cube',transitionParameters:{cube:opts},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'cube').effectId,'cube');
 const saved=snapshotClip(b);
 const restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,saved);
 assert.equal(restored.transitionEffectId,'cube');
 assert.deepEqual(restored.transitionParameters.cube,opts);
 assert.equal(restored.audio.volume,.78);
});
