import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {GLITCH_FLICKER_SOURCE,GLITCH_FLICKER_DEFAULTS,normaliseGlitchFlickerOptions} from '../js/gl-transitions/GlitchFlicker.mjs';
const native={frameRate:30,rgbOffset:.028,blockAmount:1.2,ghostAmount:.8,redCyan:.7,scanline:.12};
test('GlitchFlicker source bytes match original bread MIT frame-quantized source',()=>{
 const data=Buffer.from(GLITCH_FLICKER_SOURCE,'utf8');
 const sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 assert.equal(sha,'c0f0e1b5c4ad907c0440a9e28281a6f900353a1e');
 for(const name of ['frameRate','rgbOffset','blockAmount','ghostAmount','redCyan','scanline'])
  assert.match(GLITCH_FLICKER_SOURCE,new RegExp('uniform float '+name+';'));
 assert.match(GLITCH_FLICKER_SOURCE,/frameReveal\(step24\)/);
 assert.match(GLITCH_FLICKER_SOURCE,/frameGlitch\(step24\)/);
 assert.match(GLITCH_FLICKER_SOURCE,/floor\(progress \* frameRate\)/);
 assert.match(GLITCH_FLICKER_SOURCE,/getFromColor/);
 assert.match(GLITCH_FLICKER_SOURCE,/getToColor/);
});
test('GlitchFlicker is original selected #38 of 41 effects',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(SELECTED_TRANSITION_NAMES[37],'Glitch flicker');
 assert.equal(TRANSITION_CATALOG[37].id,'glitch-flicker');
 assert.equal(ACTIVE_PAIR_EFFECTS.filter(x=>x==='glitch-flicker').length,1);
 assert.ok(isAvailablePairEffect('glitch-flicker'));
});
test('Six shader controls preserve original defaults, safe finite values and ranges',()=>{
 assert.deepEqual(normaliseGlitchFlickerOptions(),GLITCH_FLICKER_DEFAULTS);
 assert.deepEqual(normaliseGlitchFlickerOptions(native),native);
 assert.deepEqual(normaliseGlitchFlickerOptions({frameRate:-3,rgbOffset:-1,blockAmount:9,ghostAmount:-5,redCyan:6,scanline:2}),
  {frameRate:1,rgbOffset:0,blockAmount:2,ghostAmount:0,redCyan:1,scanline:.3});
 assert.deepEqual(normaliseGlitchFlickerOptions({frameRate:400,rgbOffset:1,blockAmount:-2,ghostAmount:4,redCyan:-1,scanline:-5}),
  {frameRate:120,rgbOffset:.1,blockAmount:0,ghostAmount:1,redCyan:0,scanline:0});
});
test('GlitchFlicker native per-frame ghost settings persist through paired history',()=>{
 const a={id:'A',type:'video',sourceName:'a.mp4',file:{name:'a.mp4'},
  start:0,clipDuration:3,order:2,audio:{volume:.51}};
 const b={id:'B',type:'video',sourceName:'b.mp4',file:{name:'b.mp4'},
  start:3,clipDuration:3,order:1,audio:{volume:.73},transitionFromId:'A',
  transitionEffectId:'glitch-flicker',transitionParameters:{'glitch-flicker':native},
  visualTransitions:{enter:{type:'fade',curve:'linear',duration:1}}};
 assert.equal(planPairedTransition([a,b],['B','A'],1,'glitch-flicker').effectId,'glitch-flicker');
 const saved=snapshotClip(b);
 const restored={...b,transitionEffectId:null,transitionParameters:{}};
 applyClipData(restored,saved);
 assert.equal(restored.transitionEffectId,'glitch-flicker');
 assert.deepEqual(restored.transitionParameters['glitch-flicker'],native);
 assert.equal(restored.audio.volume,.73);
});
