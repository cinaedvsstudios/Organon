import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {GLITCH_FLICKER_SOURCE,GLITCH_FLICKER_DEFAULTS,normaliseGlitchFlickerOptions} from '../js/gl-transitions/GlitchFlicker.mjs';

test('GlitchFlicker is exact pinned bread/MIT original GLSL, including non-monotonic frame flashes',()=>{
 const b=Buffer.from(GLITCH_FLICKER_SOURCE,'utf8');
 const hash=createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
 assert.equal(hash,'c0f0e1b5c4ad907c0440a9e28281a6f900353a1e');
 for(const name of ['frameRate','rgbOffset','blockAmount','ghostAmount','redCyan','scanline'])
  assert.match(GLITCH_FLICKER_SOURCE,new RegExp('uniform float '+name+';'));
 assert.match(GLITCH_FLICKER_SOURCE,/frameReveal\(step24\)/);
 assert.match(GLITCH_FLICKER_SOURCE,/frameGlitch\(step24\)/);
 assert.match(GLITCH_FLICKER_SOURCE,/chromaFrom\(fromUv/);
 assert.match(GLITCH_FLICKER_SOURCE,/chromaTo\(toUv/);
 assert.match(GLITCH_FLICKER_SOURCE,/oldReturn/);
});
test('GlitchFlicker retains selection #38 and saved canonical ID',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[37],'Glitch flicker');
 assert.equal(TRANSITION_CATALOG[37].id,'glitch-flicker');
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(x=>x==='glitch-flicker').length,1);
 assert.equal(isAvailablePairEffect('glitch-flicker'),true);
});
test('All six official uniforms have source defaults and bounded editable values',()=>{
 assert.deepEqual(normaliseGlitchFlickerOptions(),GLITCH_FLICKER_DEFAULTS);
 const custom={frameRate:48,rgbOffset:.05,blockAmount:1.4,ghostAmount:.3,redCyan:.9,scanline:.21};
 assert.deepEqual(normaliseGlitchFlickerOptions(custom),custom);
 assert.deepEqual(normaliseGlitchFlickerOptions({frameRate:0,rgbOffset:10,blockAmount:-1,ghostAmount:2,redCyan:-5,scanline:3}),
  {frameRate:1,rgbOffset:.08,blockAmount:0,ghostAmount:1,redCyan:0,scanline:.3});
 assert.deepEqual(normaliseGlitchFlickerOptions({frameRate:'',rgbOffset:NaN}),GLITCH_FLICKER_DEFAULTS);
});
test('GlitchFlicker source A/B pairing, Undo/Redo snapshot, settings and audio are preserved',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
  start:0,clipDuration:3,order:2,audio:{volume:.57}};
 const options={frameRate:30,rgbOffset:.025,blockAmount:.8,ghostAmount:.4,redCyan:.8,scanline:.12};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.82},
  transitionFromId:'A',transitionEffectId:'glitch-flicker',
  transitionParameters:{'glitch-flicker':options},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'glitch-flicker').effectId,'glitch-flicker');
 const saved=snapshotClip(b);
 const restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,saved);
 assert.equal(restored.transitionEffectId,'glitch-flicker');
 assert.deepEqual(restored.transitionParameters['glitch-flicker'],options);
 assert.equal(restored.audio.volume,.82);
});
