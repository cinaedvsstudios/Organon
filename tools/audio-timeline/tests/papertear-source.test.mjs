import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {PAPER_TEAR_SOURCE,PAPER_TEAR_DEFAULTS,normalisePaperTearOptions} from '../js/gl-transitions/PaperTear.mjs';

test('original PaperTear source bytes match pinned MIT upstream blob',()=>{
 const bytes=Buffer.from(PAPER_TEAR_SOURCE,'utf8');
 const gitBlob=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 assert.equal(gitBlob,'6794a18eed1e282982af9bbb86e7f869a38f2b7b');
 for(const param of ['roughness','tilt','rim'])assert.match(PAPER_TEAR_SOURCE,new RegExp('uniform float '+param+';'));
 for(const param of ['paper','shadow'])assert.match(PAPER_TEAR_SOURCE,new RegExp('uniform vec4 '+param+';'));
 assert.match(PAPER_TEAR_SOURCE,/getFromColor/);
 assert.match(PAPER_TEAR_SOURCE,/getToColor/);
});
test('PaperTear is #28 of forty-one original selected effects',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[27],'Paper tear');
 assert.equal(TRANSITION_CATALOG[27].id,'paper-tear');
 assert.equal(TRANSITION_CATALOG[27].status,'available');
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(x=>x==='paper-tear').length,1);
});
test('seven native shader controls preserve defaults and clamp to documented bounds',()=>{
 assert.deepEqual(normalisePaperTearOptions(),PAPER_TEAR_DEFAULTS);
 assert.deepEqual(normalisePaperTearOptions({
  roughness:5,tilt:10,rim:1,paperColor:'#79FEEE',paperAlpha:-4,
  shadowColor:'oops',shadowAlpha:2
 }),{roughness:.3,tilt:.5,rim:.05,paperColor:'#79feee',paperAlpha:0,
    shadowColor:'#000000',shadowAlpha:1});
});
test('PaperTear settings survive paired clip snapshot and Undo/Redo reapplication',()=>{
 const options={roughness:.23,tilt:.3,rim:.022,paperColor:'#b8efcc',paperAlpha:.65,
  shadowColor:'#254c77',shadowAlpha:.8};
 const a={id:'A',type:'video',sourceName:'a.mp4',start:0,clipDuration:3,order:2,audio:{volume:.4}};
 const b={id:'B',type:'video',sourceName:'b.mp4',start:3,clipDuration:3,order:1,audio:{volume:.9},
  transitionFromId:'A',transitionEffectId:'paper-tear',transitionParameters:{'paper-tear':options},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 const plan=planPairedTransition([a,b],['B','A'],1,'paper-tear');
 assert.equal(plan.effectId,'paper-tear');
 const saved=snapshotClip(b);
 const restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,saved);
 assert.equal(restored.transitionEffectId,'paper-tear');
 assert.deepEqual(restored.transitionParameters['paper-tear'],options);
 assert.equal(restored.audio.volume,.9);
});
