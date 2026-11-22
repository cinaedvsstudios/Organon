import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {CROSS_WARP_SOURCE,CROSS_WARP_DEFAULTS,normaliseCrossWarpOptions} from '../js/gl-transitions/CrossWarp.mjs';
test('CrossWarp gre/MIT right-to-left warp original source SHA is pinned exactly',()=>{
 const data=Buffer.from(CROSS_WARP_SOURCE,'utf8');
 const sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 assert.equal(sha,'d87bf09333e5a4e1484c886210e302198cda528a');
 assert.match(CROSS_WARP_SOURCE,/x\s*=\s*smoothstep/);
 assert.match(CROSS_WARP_SOURCE,/getFromColor/);
 assert.match(CROSS_WARP_SOURCE,/getToColor/);
 assert.equal(/uniform\s+(?:float|vec[234]|int|bool)\s+\w+\s*;/.test(CROSS_WARP_SOURCE),false);
 assert.deepEqual(normaliseCrossWarpOptions({fake:2}),{});
 assert.deepEqual(CROSS_WARP_DEFAULTS,{});
});
test('Correct canonical CrossWarp remains #34 of 41 selections',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[33],'Cross warp');
 assert.equal(TRANSITION_CATALOG[33].id,'cross-warp');
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(x=>x==='cross-warp').length,1);
 assert.ok(isAvailablePairEffect('cross-warp'));
});
test('CrossWarp source properties and transition survives project snapshots/history',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
  start:0,clipDuration:3,order:2,audio:{volume:.45}};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.78},transitionFromId:'A',
  transitionEffectId:'cross-warp',transitionParameters:{'cross-warp':{}},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['A','B'],1,'cross-warp').effectId,'cross-warp');
 const saved=snapshotClip(b);
 const restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,saved);
 assert.equal(restored.transitionEffectId,'cross-warp');
 assert.deepEqual(restored.transitionParameters,{'cross-warp':{}});
 assert.equal(restored.audio.volume,.78);
});
