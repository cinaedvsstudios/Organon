import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {FADE_SOURCE,FADE_DEFAULTS,normaliseFadeOptions} from '../js/gl-transitions/Fade.mjs';
test('Exact original MIT Fade GLSL uses linear RGBA interpolation of both textures',()=>{
 const data=Buffer.from(FADE_SOURCE,'utf8');
 const sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 assert.equal(sha,'7855085e5cf9b1b1ba7e8607e30a600f633c3fea');
 assert.match(FADE_SOURCE,/return mix\(/);
 assert.match(FADE_SOURCE,/getFromColor\(uv\)/);
 assert.match(FADE_SOURCE,/getToColor\(uv\)/);
 assert.match(FADE_SOURCE,/progress/);
 assert.equal(/uniform\s+(?:float|vec[234]|int|bool)\s+\w+\s*;/.test(FADE_SOURCE),false);
 assert.deepEqual(FADE_DEFAULTS,{});
 assert.deepEqual(normaliseFadeOptions({invented:4}),{});
});
test('Fade is #37 of 41 original selected shaders and is available once',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[36],'Fade');
 assert.equal(TRANSITION_CATALOG[36].id,'fade');
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(x=>x==='fade').length,1);
 assert.ok(isAvailablePairEffect('fade'));
});
test('Fade is a paired shader, preserves original A/B source and volume through Undo/Redo',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
  start:0,clipDuration:3,order:2,audio:{volume:.54}};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.84},transitionFromId:'A',
  transitionEffectId:'fade',transitionParameters:{fade:{}},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'fade').effectId,'fade');
 const saved=snapshotClip(b);
 const restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,saved);
 assert.equal(restored.transitionEffectId,'fade');
 assert.deepEqual(restored.transitionParameters.fade,{});
 assert.equal(restored.audio.volume,.84);
});
