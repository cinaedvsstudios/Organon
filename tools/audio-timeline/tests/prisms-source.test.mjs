import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {PRISMS_SOURCE,PRISMS_DEFAULTS,normalisePrismsOptions} from '../js/gl-transitions/Prisms.mjs';
const options={slats:12,stagger:.65,perspective:2.1,shading:.9,
 horizontal:true,backColor:'#672ecb',backAlpha:.55};
test('Prisms original MIT shader is embedded byte-for-byte',()=>{
 const data=Buffer.from(PRISMS_SOURCE,'utf8');
 const gitSha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 assert.equal(gitSha,'ccb2ac8c854b172566170adb74bbb12bd0eafe64');
 assert.match(PRISMS_SOURCE,/uniform int slats;/);
 for(const name of ['stagger','perspective','shading'])
  assert.match(PRISMS_SOURCE,new RegExp('uniform float '+name+';'));
 assert.match(PRISMS_SOURCE,/uniform bool horizontal;/);
 assert.match(PRISMS_SOURCE,/uniform vec4 backColor;/);
 assert.match(PRISMS_SOURCE,/getFromColor/);
 assert.match(PRISMS_SOURCE,/getToColor/);
});
test('Prisms remains the original #31 among 41 paired effects',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[30],'Prisms');
 assert.equal(TRANSITION_CATALOG[30].id,'prisms');
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(x=>x==='prisms').length,1);
 assert.ok(isAvailablePairEffect('prisms'));
});
test('six native uniforms and backdrop RGB/alpha preserve source defaults and bounds',()=>{
 assert.deepEqual(normalisePrismsOptions(),PRISMS_DEFAULTS);
 assert.deepEqual(normalisePrismsOptions(options),options);
 assert.deepEqual(normalisePrismsOptions({
  slats:99,stagger:100,perspective:-2,shading:6,horizontal:'false',
  backColor:'oops',backAlpha:-1
 }),{slats:40,stagger:.9,perspective:0,shading:1,horizontal:false,
    backColor:'#000000',backAlpha:0});
 assert.deepEqual(normalisePrismsOptions({
  slats:1,stagger:-1,perspective:99,shading:-1,horizontal:'true',
  backColor:'#ABCDEF',backAlpha:99
 }),{slats:2,stagger:0,perspective:4,shading:0,horizontal:true,
    backColor:'#abcdef',backAlpha:1});
});
test('Prisms two video faces, RGBA backdrop and horizontal flag persist through history',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
  start:0,clipDuration:3,order:2,audio:{volume:.42}};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.8},transitionFromId:'A',
  transitionEffectId:'prisms',transitionParameters:{prisms:options},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'prisms').effectId,'prisms');
 const snapshot=snapshotClip(b);
 const restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,snapshot);
 assert.equal(restored.transitionEffectId,'prisms');
 assert.deepEqual(restored.transitionParameters.prisms,options);
 assert.equal(restored.audio.volume,.8);
});
