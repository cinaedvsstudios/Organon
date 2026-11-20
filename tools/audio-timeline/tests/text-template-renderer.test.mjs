import test from 'node:test';
import assert from 'node:assert/strict';
import {
 TEXT_DESIGNS,TEXT_ANIMATIONS,getTextDesign,normaliseTextOverlay,textAnimationState
} from '../js/text-template-renderer.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';

test('sixteen structurally different text designs, not color-swapped duplicate catalog entries',()=>{
 assert.equal(TEXT_DESIGNS.length,16);
 assert.equal(new Set(TEXT_DESIGNS.map(item=>item.id)).size,16);
 assert.equal(new Set(TEXT_DESIGNS.map(item=>item.layout)).size,16);
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
   fontSize:125,outlineWidth:7,shadowBlur:16,animation:'box-reveal',animationDuration:1.6});
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
