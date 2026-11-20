import test from 'node:test';
import assert from 'node:assert/strict';
import {
 TEXT_DESIGNS,TEXT_ANIMATIONS,getTextDesign,normaliseTextOverlay,textAnimationState
} from '../js/text-template-renderer.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';

test('eighteen structurally different text designs, not color-swapped duplicate catalog entries',()=>{
 assert.equal(TEXT_DESIGNS.length,18);
 assert.equal(new Set(TEXT_DESIGNS.map(item=>item.id)).size,16);
 assert.equal(new Set(TEXT_DESIGNS.map(item=>item.layout)).size,18);
 assert.ok(TEXT_DESIGNS.every(item=>item.group==='text'&&item.label&&item.animation));
 assert.equal(getTextDesign('news-lower-third').layout,'news');
 assert.equal(getTextDesign('neon-purple'),null);
});
test('title Inspector settings are small, validated and preserved',()=>{
 const record=normaliseTextOverlay({presetId:'news-lower-third',value:'The news tonight',
   fill:'#AABBCC',outline:'#223344',shadow:'#334455',
   fontSize:125,outlineWidth:7,shadowBlur:16,animation:'box-reveal',animationDuration:1.6});
 assert.deepEqual({...record},{presetId:'news-lower-third',value:'The news tonight',
   fill:'#aabbcc',outline:'#223344',shadow:'#334455',
   fontSize:125,outlineWidth:7,shadowBlur:16,animation:'box-reveal',animationDuration:1.6,
   animationDelay:0,animationSpeed:1,animationDirection:'left',animationEasing:'ease-out',
   animationIntensity:100,animationLoop:false,subtitle:'LIVE UPDATE'});
 const broken=normaliseTextOverlay({presetId:'missing',value:'A'.repeat(180),fill:'url(javascript:alert(1))',
   animation:'bad',fontSize:1e10,animationDuration:-20});
 assert.equal(broken.value.length,100);
 assert.equal(broken.presetId,'neon-cyan');
 assert.equal(broken.fill,'#64eeff');
 assert.equal(broken.fontSize,250);
 assert.equal(broken.animationDuration,.1);
 assert.ok(TEXT_ANIMATIONS.length>=8);
});
test('animations derive visible state only from relative timestamp (paused scrubbing and offline exports)',()=>{
 const conf={presetId:'typewriter-document',value:'MOTORICLIP',animation:'typewriter',animationDuration:2};
 const start=textAnimationState(conf,0,3),middle=textAnimationState(conf,1,3),
   end=textAnimationState(conf,2,3),back=textAnimationState(conf,0,3);
 assert.equal(start.visibleCharacters,0);
 assert.ok(middle.visibleCharacters>0&&middle.visibleCharacters<conf.value.length);
 assert.equal(end.visibleCharacters,conf.value.length);
 assert.deepEqual(back,start,'Seeking backwards must recreate the same frame');
 const box={presetId:'news-lower-third',value:'NEWS',animation:'box-reveal',animationDuration:1};
 assert.equal(textAnimationState(box,0,3).boxWidth,0);
 assert.equal(textAnimationState(box,1,3).boxWidth,640);
 const slide={presetId:'location-card',animation:'slide'};
 assert.ok(textAnimationState(slide,0,3).slideX<0);
 assert.equal(textAnimationState(slide,2,3).slideX,0);
 const jump={presetId:'handwritten-script',animation:'letter-pop'};
 assert.equal(textAnimationState(jump,2,3).progress,1);
});
test('Undo/Redo snapshots carry editable text, design and motion and clear previous values',()=>{
 const clip={id:'title1',type:'sticker',sourceName:'text-title-1.png',
   sourceFileId:'t1',start:0,sourceOffset:0,clipDuration:3,laneId:'t',
   textOverlay:normaliseTextOverlay({presetId:'news-lower-third',value:'HELLO',
      animation:'box-reveal',fill:'#caffee'})};
 const snapshot=snapshotClip(clip);
 assert.equal(snapshot.textOverlay.animation,'box-reveal');
 assert.equal(snapshot.textOverlay.value,'HELLO');
 clip.textOverlay.value='CHANGED';
 applyClipData(clip,snapshot);
 assert.equal(clip.textOverlay.value,'HELLO');
 applyClipData(clip,{...snapshot,textOverlay:null});
 assert.equal(clip.textOverlay,null);
});

test('motion controls are editable, bounded and purely timeline-time dependent',()=>{
 const conf=normaliseTextOverlay({presetId:'news-lower-third',value:'BREAKING',
   subtitle:'Edited secondary line',animation:'box-reveal',animationDuration:1,
   animationDelay:.5,animationSpeed:2,animationDirection:'right',
   animationEasing:'linear',animationIntensity:150,animationLoop:false});
 assert.equal(conf.subtitle,'Edited secondary line');
 assert.equal(conf.animationDelay,.5);
 assert.equal(conf.animationSpeed,2);
 assert.equal(conf.animationDirection,'right');
 assert.equal(conf.animationEasing,'linear');
 assert.equal(conf.animationIntensity,150);
 assert.equal(conf.animationLoop,false);
 assert.equal(textAnimationState(conf,.2,3).alpha,0,
   'Animation delay hides title until the requested start');
 assert.equal(textAnimationState(conf,.5,3).boxWidth,0);
 assert.equal(textAnimationState(conf,.75,3).boxWidth,320);
 assert.equal(textAnimationState(conf,1,3).boxWidth,640);
 assert.equal(textAnimationState(conf,.6,3).headlineAlpha,0,
   'Broadcast banner must arrive before the headline');
 assert.equal(textAnimationState(conf,.6,3).subtitleAlpha,0);
 assert.ok(textAnimationState(conf,.95,3).headlineAlpha>0);
 assert.ok(textAnimationState(conf,1,3).subtitleAlpha>0);
 assert.deepEqual(textAnimationState(conf,.75,3),textAnimationState(conf,.75,3));
 const right=normaliseTextOverlay({animation:'slide',animationDirection:'right'});
 const down=normaliseTextOverlay({animation:'slide',animationDirection:'down'});
 assert.ok(textAnimationState(right,0,3).slideX>0);
 assert.ok(textAnimationState(down,0,3).slideY>0);
 assert.equal(textAnimationState(down,3,3).slideY,0);
 const repeat=normaliseTextOverlay({animation:'fade',animationDuration:.5,
   animationLoop:true,animationEasing:'linear'});
 assert.equal(textAnimationState(repeat,0,3).alpha,0);
 assert.equal(textAnimationState(repeat,.5,3).alpha,0);
 assert.ok(textAnimationState(repeat,.75,3).alpha>.45);
 const broken=normaliseTextOverlay({animationSpeed:99,animationDelay:-2,
   animationIntensity:700,animationDirection:'backwards',
   animationEasing:'implausible',subtitle:'x'.repeat(200)});
 assert.equal(broken.animationSpeed,4);
 assert.equal(broken.animationDelay,0);
 assert.equal(broken.animationIntensity,200);
 assert.equal(broken.animationDirection,'left');
 assert.equal(broken.animationEasing,'ease-out');
 assert.equal(broken.subtitle.length,100);
});
test('stage-two motions are separate catalog choices, not colour duplicates',()=>{
 const newOptions=['shake','wave','kinetic-stagger','glitch-text','bounce',
    'outline-fill','title-wipe','dissolve-out'];
 for(const name of newOptions){
   assert.ok(TEXT_ANIMATIONS.some(([id])=>id===name),name+' is a real animation choice');
 }
});

test('storytelling title motion has five distinct default animations, not palette variations',()=>{
 const variants=[
  ['handwritten-script','handwriting-reveal'],
  ['social-callout','social-pulse'],
  ['location-card','location-drop'],
  ['countdown-title','countdown-roll'],
  ['split-title','split-enter']
 ];
 for(const [presetId,animation] of variants){
  const design=getTextDesign(presetId);
  assert.equal(design?.animation,animation);
  const config=normaliseTextOverlay({presetId,value:'MotoriClip'});
  assert.equal(config.animation,animation);
  const atStart=textAnimationState(config,0,3);
  const atEnd=textAnimationState(config,1.2,3);
  assert.equal(atStart.progress,0);
  assert.equal(atEnd.progress,1);
  assert.deepEqual(textAnimationState(config,.7,3),textAnimationState(config,.7,3),
    animation+' must be reproducible after backward seeking');
  assert.ok(TEXT_ANIMATIONS.some(([id])=>id===animation));
 }
});
test('countdown numerals roll from an editable starting number to zero',()=>{
 const numeric=normaliseTextOverlay({presetId:'countdown-title',value:'5',
   animation:'countdown-roll',animationEasing:'linear',animationDuration:3});
 assert.equal(textAnimationState(numeric,0,3).countdownDigit,5);
 assert.equal(textAnimationState(numeric,1,3).countdownDigit,4);
 assert.equal(textAnimationState(numeric,2.5,3).countdownDigit,1);
 assert.equal(textAnimationState(numeric,3,3).countdownDigit,0);
 const sample=normaliseTextOverlay({presetId:'countdown-title',value:'MotoriClip',
   animation:'countdown-roll',animationEasing:'linear',animationDuration:3});
 assert.equal(textAnimationState(sample,0,3).countdownDigit,3,
   'Preview uses the app name as a label and defaults to a three-count');
 const bounded=normaliseTextOverlay({presetId:'countdown-title',value:'999999'});
 assert.equal(textAnimationState(bounded,0,3).countdownDigit,99);
});
test('location pin, social pulse and split title have distinct motion phases',()=>{
 const loc=normaliseTextOverlay({presetId:'location-card',animationEasing:'linear'});
 assert.equal(textAnimationState(loc,0,3).pinProgress,0);
 assert.equal(textAnimationState(loc,0,3).locationLabelProgress,0);
 assert.equal(textAnimationState(loc,1.2,3).pinProgress,1);
 assert.equal(textAnimationState(loc,1.2,3).locationLabelProgress,1);
 assert.ok(textAnimationState(loc,.4,3).pinProgress>
   textAnimationState(loc,.4,3).locationLabelProgress,
   'Pin should fall into position before the location label opens');
 const social=normaliseTextOverlay({presetId:'social-callout'});
 assert.ok(textAnimationState(social,0,3).socialScale<.7);
 assert.ok(textAnimationState(social,1,3).socialScale>.85);
 const split=normaliseTextOverlay({presetId:'split-title'});
 assert.equal(textAnimationState(split,0,3).splitProgress,0);
 assert.equal(textAnimationState(split,1.2,3).splitProgress,1);
 const writing=normaliseTextOverlay({presetId:'handwritten-script'});
 assert.equal(writing.animation,'handwriting-reveal');
});
