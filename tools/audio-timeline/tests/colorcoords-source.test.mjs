import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG,
 normalizeTransitionEffectId,normalizeTransitionParameters} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {COLOR_COORDS_SOURCE,COLOR_COORDS_DEFAULTS,normaliseColorCoordsOptions} from '../js/gl-transitions/ColorCoords.mjs';
test('ColorCoords original haiyoucuv MIT GLSL byte-for-byte matches pinned upstream',()=>{
 const data=Buffer.from(COLOR_COORDS_SOURCE,'utf8');
 const hash=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 assert.equal(hash,'b9e841fa1b8abd353104e0d6e6ef7a1d84e3b71f');
 assert.match(COLOR_COORDS_SOURCE,/getToColor\(uv\)/);
 assert.match(COLOR_COORDS_SOURCE,/getFromColor\(uv\)/);
 assert.match(COLOR_COORDS_SOURCE,/coordTo\.rg/);
 assert.match(COLOR_COORDS_SOURCE,/coordFrom\.rg/);
 assert.equal(/uniform\s+(?:float|vec[234]|int|bool)\s+\w+\s*;/.test(COLOR_COORDS_SOURCE),false);
 assert.deepEqual(normaliseColorCoordsOptions({fakeControl:5}),{});
 assert.deepEqual(COLOR_COORDS_DEFAULTS,{});
});
test('Correct ColorCoords name/id retains selection #33 and legacy aliases',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[32],'ColorCoords');
 assert.equal(TRANSITION_CATALOG[32].id,'colorcoords');
 assert.equal(ACTIVE_PAIR_EFFECTS.length,41);
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(x=>x==='colorcoords').length,1);
 for(const legacy of ['color-codes','color-coords','colorcoords']){
  assert.equal(normalizeTransitionEffectId(legacy),'colorcoords');
  assert.ok(isAvailablePairEffect(legacy));
 }
});
test('Legacy color-codes settings migrate without destroying canonical project parameters',()=>{
 const old={legacySetting:true};
 assert.deepEqual(normalizeTransitionParameters({'color-codes':old}),{colorcoords:old});
 assert.deepEqual(normalizeTransitionParameters({'color-coords':old}),{colorcoords:old});
 const current={other:77};
 assert.deepEqual(normalizeTransitionParameters({'color-codes':old,colorcoords:current}),
  {colorcoords:current});
 assert.deepEqual(normalizeTransitionParameters({'color-codes':old,whipspin:{turns:2}}),
  {colorcoords:old,whipspin:{turns:2}});
});
test('Old Color codes clips survive pair planning and Undo/Redo without changing source data',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
  start:0,clipDuration:3,order:2,audio:{volume:.5}};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.85},transitionFromId:'A',
  transitionEffectId:'color-codes',transitionParameters:{'color-codes':{old:true}},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'color-codes').effectId,'colorcoords');
 const saved=snapshotClip(b);
 assert.equal(saved.transitionEffectId,'colorcoords');
 assert.deepEqual(saved.transitionParameters,{colorcoords:{old:true}});
 const fresh={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(fresh,{...saved,transitionEffectId:'color-codes',transitionParameters:{'color-codes':{old:true}}});
 assert.equal(fresh.transitionEffectId,'colorcoords');
 assert.deepEqual(fresh.transitionParameters,{colorcoords:{old:true}});
 assert.equal(fresh.audio.volume,.85);
});
