import test from 'node:test';
import assert from 'node:assert/strict';
import {
 TEXT_DESIGNS,TEXT_ANIMATIONS,TEXT_OUT_ANIMATIONS,getTextDesign,normaliseTextOverlay,textAnimationState
} from '../js/text-template-renderer.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';

test('eighteen structurally different text designs, not color-swapped duplicate catalog entries',()=>{
 assert.equal(TEXT_DESIGNS.length,18);
 assert.equal(new Set(TEXT_DESIGNS.map(item=>item.id)).size,18);
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
   animationIntensity:100,animationLoop:false,subtitle:'LIVE UPDATE',
   phasedAnimation:false,inAnimation:'box-reveal',inDuration:1.6,
   outAnimation:'none',outDuration:.6,loopAnimation:'none',loopDuration:1.5,
  fontFamily:'template',fontWeight:0,fontStyle:'template',textAlign:'template',
  textCase:'template',letterSpacing:0,lineSpacing:100,textOpacity:100,
  shadowOffsetX:0,shadowOffsetY:0,glowColor:'#ffffff',glowStrength:0,
  backdropEnabled:false,backdropColor:'#17283e',backdropOpacity:70,
  shapePadding:10,shapeRadius:12,shapeBorderWidth:0,shapeBorderColor:'#d0b07a',
  bannerWidth:92,bannerHeight:100});
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

test('typography is user-editable with validated font, weight, case, alignment and spacing',()=>{
 const c=normaliseTextOverlay({presetId:'cinematic-title',value:'Mixed Case\\nSecond Line',
   fontFamily:'mono',fontWeight:600,fontStyle:'italic',textAlign:'right',
   textCase:'lowercase',letterSpacing:9,lineSpacing:145});
 assert.equal(c.fontFamily,'mono');assert.equal(c.fontWeight,600);
 assert.equal(c.fontStyle,'italic');assert.equal(c.textAlign,'right');
 assert.equal(c.textCase,'lowercase');assert.equal(c.letterSpacing,9);
 assert.equal(c.lineSpacing,145);
 const bad=normaliseTextOverlay({fontFamily:'javascript:alert(1)',fontWeight:99999,
    fontStyle:'oblique',textAlign:'justify',textCase:'random',
    letterSpacing:-1000,lineSpacing:0});
 assert.equal(bad.fontFamily,'template');assert.equal(bad.fontWeight,900);
 assert.equal(bad.fontStyle,'template');assert.equal(bad.textAlign,'template');
 assert.equal(bad.textCase,'template');assert.equal(bad.letterSpacing,-6);
 assert.equal(bad.lineSpacing,70);
});
test('appearance and shape settings normalize safely, persist in Undo and can be cleared',()=>{
 const fields={textOpacity:65,outlineWidth:6,shadowOffsetX:7,shadowOffsetY:-4,
   glowColor:'#FFAA33',glowStrength:16,backdropEnabled:true,
   backdropColor:'#123456',backdropOpacity:82,
   shapePadding:22,shapeRadius:32,shapeBorderColor:'#CCDDEE',
   shapeBorderWidth:5,bannerWidth:75,bannerHeight:130};
 const c=normaliseTextOverlay({presetId:'news-lower-third',value:'BREAKING',...fields});
 assert.equal(c.textOpacity,65);assert.equal(c.shadowOffsetX,7);
 assert.equal(c.shadowOffsetY,-4);assert.equal(c.glowColor,'#ffaa33');
 assert.equal(c.backdropColor,'#123456');assert.equal(c.shapeBorderColor,'#ccddee');
 assert.equal(c.bannerWidth,75);assert.equal(c.bannerHeight,130);
 const clip={id:'t',type:'sticker',sourceName:'text-title.png',sourceFileId:'st',
  start:0,sourceOffset:0,clipDuration:3,laneId:'titles',textOverlay:c};
 const history=snapshotClip(clip);clip.textOverlay=null;
 applyClipData(clip,history);assert.deepEqual(clip.textOverlay,c);
 const bad=normaliseTextOverlay({textOpacity:-50,glowStrength:900,
   glowColor:'not-a-colour',backdropColor:'url(fake)',
   backdropOpacity:150,shapeRadius:999,shapeBorderWidth:-20,
   bannerWidth:5,bannerHeight:900});
 assert.equal(bad.textOpacity,0);assert.equal(bad.glowStrength,40);
 assert.equal(bad.glowColor,'#ffffff');assert.equal(bad.backdropColor,'#17283e');
 assert.equal(bad.backdropOpacity,100);assert.equal(bad.shapeRadius,60);
 assert.equal(bad.shapeBorderWidth,0);assert.equal(bad.bannerWidth,40);
 assert.equal(bad.bannerHeight,180);
});

test('independent In, Loop and Out are separate deterministic clip phases',()=>{
 const opts={presetId:'neon-cyan',value:'OPENAI',phasedAnimation:true,
   inAnimation:'fade',inDuration:.8,loopAnimation:'wave',loopDuration:.5,
   outAnimation:'slide',outDuration:.5,animationSpeed:1,animationDelay:0,
   animationEasing:'linear'};
 const at=time=>textAnimationState(opts,time,3);
 assert.equal(at(0).phase,'in');assert.equal(at(0).activeAnimation,'fade');
 assert.equal(at(0).alpha,0);assert.equal(at(.4).alpha,.5);
 assert.equal(at(.8).phase,'loop');assert.equal(at(.8).activeAnimation,'wave');
 assert.equal(at(1.3).phase,'loop');assert.equal(at(1.3).activeAnimation,'wave');
 assert.equal(at(2.49).phase,'loop');assert.equal(at(2.5).phase,'out');
 assert.equal(at(2.5).activeAnimation,'slide');assert.equal(at(2.5).alpha,1);
 assert.ok(at(2.75).alpha<1&&at(2.75).alpha>0);
 assert.equal(at(3).alpha,0,'Every Out must fully vanish by clip end');
 assert.deepEqual(at(.4),at(.4),'Reverse seeking reproduces entrance frame');
 assert.deepEqual(at(2.75),at(2.75),'Reverse seeking reproduces exit frame');
});
test('In and Out compress to avoid overlap on short clips and never appear after a long delay',()=>{
 const cfg={presetId:'neon-cyan',value:'Short',phasedAnimation:true,
   inAnimation:'fade',inDuration:2,outAnimation:'fade',outDuration:2,
   loopAnimation:'shake',loopDuration:.5,animationEasing:'linear'};
 const at=t=>textAnimationState(cfg,t,.8);
 assert.equal(at(.2).phase,'in');assert.equal(at(.4).phase,'out');
 assert.equal(at(.6).phase,'out');assert.equal(at(0).alpha,0);
 assert.equal(at(.8).alpha,0);
 assert.ok(at(.2).inEnd<=at(.2).outStart+.000001);
 const delayed={...cfg,animationDelay:4};
 assert.equal(textAnimationState(delayed,.8,.8).phase,'waiting');
 assert.equal(textAnimationState(delayed,.8,.8).alpha,0);
});
test('legacy saved titles retain their original animation and repeated timing',()=>{
 const old={presetId:'neon-cyan',value:'Legacy',animation:'fade',
   animationDuration:1,animationEasing:'linear',animationLoop:true};
 const opts=normaliseTextOverlay(old);
 assert.equal(opts.phasedAnimation,false);
 assert.equal(opts.inAnimation,'fade');assert.equal(opts.outAnimation,'none');
 assert.equal(opts.loopAnimation,'none');
 const before=textAnimationState(old,.5,3),after=textAnimationState(opts,.5,3);
 assert.equal(before.phase,'legacy');assert.equal(before.activeAnimation,'fade');
 assert.equal(before.alpha,.5);
 assert.deepEqual(before,after);
});
test('phased title settings persist in Undo and reject incompatible animation choices',()=>{
 const opts=normaliseTextOverlay({presetId:'news-lower-third',value:'Title',
   phasedAnimation:true,inAnimation:'typewriter',inDuration:1.6,
   outAnimation:'title-wipe',outDuration:.8,loopAnimation:'glitch-text',
   loopDuration:1.1});
 assert.equal(opts.phasedAnimation,true);
 assert.equal(opts.inAnimation,'typewriter');
 assert.equal(opts.outAnimation,'title-wipe');assert.equal(opts.loopAnimation,'glitch-text');
 const clip={id:'title-2',type:'sticker',sourceFileId:'source',clipDuration:4,
   start:0,sourceOffset:0,sourceName:'title.png',textOverlay:opts};
 const saved=snapshotClip(clip);clip.textOverlay.inAnimation='slide';
 applyClipData(clip,saved);
 assert.equal(clip.textOverlay.inAnimation,'typewriter');
 assert.deepEqual(clip.textOverlay,saved.textOverlay);
 const invalid=normaliseTextOverlay({phasedAnimation:'yes',inAnimation:'hacked',
   outAnimation:'not-a-real-animation',outDuration:900,loopAnimation:'title-wipe',loopDuration:-20});
 assert.equal(invalid.phasedAnimation,false);
 assert.equal(invalid.outAnimation,'none');
 assert.equal(invalid.loopAnimation,'none');
 assert.equal(invalid.outDuration,10);assert.equal(invalid.loopDuration,.1);
});

test('looping ticker restarts each cycle instead of disappearing off-screen',()=>{
 const cfg={presetId:'tech-hud',phasedAnimation:true,inAnimation:'none',
   loopAnimation:'ticker',loopDuration:1,outAnimation:'none',animationEasing:'linear'};
 const one=textAnimationState(cfg,.3,5),two=textAnimationState(cfg,1.3,5);
 assert.equal(one.phase,'loop');assert.equal(two.phase,'loop');
 assert.ok(Math.abs(one.tickerX-two.tickerX)<.00001,
   'Each one-second ticker cycle must return to the same position');
});

test('one shared animation catalog for custom Out and default Reverse In for new phased titles',()=>{
 assert.deepEqual(TEXT_OUT_ANIMATIONS.slice(1),TEXT_ANIMATIONS);
 assert.deepEqual(TEXT_OUT_ANIMATIONS[0],['reverse-in','Reverse In']);
 assert.equal(normaliseTextOverlay({phasedAnimation:true}).outAnimation,'reverse-in');
 assert.equal(normaliseTextOverlay({phasedAnimation:true,outAnimation:'none'}).outAnimation,'none');
 assert.equal(normaliseTextOverlay({phasedAnimation:true,outAnimation:'wave'}).outAnimation,'wave');
 assert.equal(normaliseTextOverlay({animation:'fade'}).outAnimation,'none');
 assert.equal(textAnimationState({phasedAnimation:true,inAnimation:'none'},2.9,3).phase,'hold');
});
test('Reverse In samples all entrance motion and easing in reverse, with independently adjustable Out duration',()=>{
 for(const [animation] of TEXT_ANIMATIONS.filter(([id])=>id!=='none')){
  for(const easing of ['linear','ease-in','ease-out','ease-in-out']){
   const cfg={presetId:'tech-hud',value:'TEST',phasedAnimation:true,inAnimation:animation,
    inDuration:1,outDuration:2,animationEasing:easing,animationSpeed:1.5};
   const renderFields=({phase,phaseTime,inEnd,outStart,...rest})=>rest;
   for(const t of [0,.125,.25,.5,.75,.875]){
    const entrance=textAnimationState(cfg,t,4);
    const exit=textAnimationState(cfg,4-2*t,4);
    assert.equal(exit.phase,'out',animation);
    assert.deepEqual(renderFields(exit),renderFields(entrance),animation+' / '+easing+' / '+t);
   }
  }
 }
});
test('Reverse In survives normalization and history without altering old explicit Out choices',()=>{
 const cfg=normaliseTextOverlay({presetId:'news-lower-third',phasedAnimation:true,inAnimation:'box-reveal',outDuration:.8});
 const clip={id:'reverse-title',type:'sticker',sourceFileId:'source',clipDuration:4,start:0,sourceOffset:0,sourceName:'title.png',textOverlay:cfg};
 const saved=snapshotClip(clip);clip.textOverlay.outAnimation='none';applyClipData(clip,saved);
 assert.equal(clip.textOverlay.outAnimation,'reverse-in');
 assert.deepEqual(normaliseTextOverlay(JSON.parse(JSON.stringify(cfg))),cfg);
 assert.equal(normaliseTextOverlay({...cfg,outAnimation:'slide'}).outAnimation,'slide');
});
