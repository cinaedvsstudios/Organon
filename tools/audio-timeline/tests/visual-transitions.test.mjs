import test from 'node:test';
import assert from 'node:assert/strict';
import {
    emptyVisualTransitions,normalizeVisualTransitions,fadeDuration,
    visualFadeOpacity,splitVisualTransitions
} from '../js/visual-transitions.mjs';
import { snapshotClip,applyClipData } from '../js/project-history.mjs';
import { AdvancedMediaEngine } from '../js/advanced-media-engine-v0.24.js';

const movie=(overrides={})=>({
    id:'video-a',type:'video',sourceName:'a.mp4',start:2,clipDuration:4,
    visible:true,opacity:.8,order:1,blendMode:'source-over',
    audio:{volume:.9,muted:false,fadeIn:0,fadeOut:0},
    visualTransitions:emptyVisualTransitions(),
    ...overrides
});
test('image clips use the same non-destructive visual fade envelopes as video',()=>{
    const image={...movie(),type:'sticker',visualTransitions:{
        enter:{type:'fade',duration:1,curve:'linear'},
        exit:{type:'fade',duration:0,curve:'linear'}
    }};
    assert.equal(fadeDuration(image,'enter'),1);
    assert.equal(visualFadeOpacity(image,image.start),0);
    assert.equal(visualFadeOpacity(image,image.start+.5),.5);
    assert.equal(visualFadeOpacity({...image,type:'background'},image.start+.5),.5);
});
test('default video clips retain their original constant opacity',()=>{
    const v=movie();
    for(const time of [2,2.1,3,5.99,6])assert.equal(visualFadeOpacity(v,time),1);
    assert.equal(visualFadeOpacity({...v,type:'background'},2),1);
});
test('independent entrance and exit curves produce expected alpha envelope',()=>{
    const v=movie({visualTransitions:{
        enter:{type:'fade',duration:1,curve:'linear'},
        exit:{type:'fade',duration:2,curve:'smooth'}
    }});
    assert.equal(visualFadeOpacity(v,2),0);
    assert.equal(visualFadeOpacity(v,2.5),.5);
    assert.equal(visualFadeOpacity(v,3),1);
    assert.equal(visualFadeOpacity(v,4),1);
    assert.equal(visualFadeOpacity(v,5),.5);
    assert.equal(visualFadeOpacity(v,6),0);
    assert.equal(fadeDuration(v,'enter'),1);
    assert.equal(fadeDuration(v,'exit'),2);
});
test('overlapping edge fades clamp within clip and cannot exceed full opacity',()=>{
    const v=movie({clipDuration:2,visualTransitions:{
        enter:{duration:9,curve:'linear'},exit:{duration:9,curve:'linear'}
    }});
    assert.equal(fadeDuration(v,'enter'),2);
    assert.equal(visualFadeOpacity(v,3),.5);
    assert.equal(visualFadeOpacity(v,2),0);
    assert.equal(visualFadeOpacity(v,4),0);
    assert.equal(visualFadeOpacity(v,999),0);
    assert.equal(normalizeVisualTransitions({enter:{duration:-4,curve:'unknown'}}).enter.duration,0);
});
test('splitting retains only the exterior fades and does not share nested objects',()=>{
    const original={enter:{duration:1.5,curve:'smooth'},exit:{duration:1,curve:'linear'}};
    const {left,right}=splitVisualTransitions(original);
    assert.equal(left.enter.duration,1.5);
    assert.equal(left.exit.duration,0);
    assert.equal(right.enter.duration,0);
    assert.equal(right.exit.duration,1);
    right.exit.duration=7;
    assert.equal(left.exit.duration,0);
    assert.equal(original.exit.duration,1);
});
test('history snapshot and restore isolate transition values from live objects',()=>{
    const v=movie();
    v.visualTransitions.enter.duration=1.2;
    v.visualTransitions.exit.curve='smooth';
    const snap=snapshotClip(v);
    v.visualTransitions.enter.duration=2.5;
    assert.equal(snap.visualTransitions.enter.duration,1.2);
    const restored=applyClipData(v,snap);
    restored.visualTransitions.enter.duration=0.4;
    assert.equal(snap.visualTransitions.enter.duration,1.2);
    assert.equal(restored.visualTransitions.exit.curve,'smooth');
    assert.equal(snapshotClip({...movie(),visualTransitions:undefined}).visualTransitions.enter.duration,0);
});
test('render engine multiplies clip opacity by visual fade, independently of audio',()=>{
    let alpha=1;
    const stack=[],draws=[];
    const ctx={
        get globalAlpha(){return alpha},set globalAlpha(value){alpha=value},
        globalCompositeOperation:'source-over',
        save(){stack.push(alpha)},restore(){alpha=stack.pop()},
        clearRect(){},fillRect(){},
        drawImage(src){draws.push({id:src.id,alpha})}
    };
    const oldDocument=globalThis.document;
    globalThis.document={createElement(tag){
        if(tag==='canvas')return {getContext:()=>ctx};
        throw Error('Unexpected DOM element '+tag);
    }};
    try{
    const engine=new AdvancedMediaEngine({
        canvas:{width:320,height:180,getContext:()=>ctx},mediaBin:null,
        onTimeChange(){},onDurationChange(){},onPlaybackChange(){},
        onRenderError(error){throw error}
    });
    const v=movie({opacity:.8,visualTransitions:{
        enter:{duration:2,curve:'linear'},exit:{duration:0,curve:'linear'}
    },file:{name:'a.mp4'},media:{id:'visual',width:320,height:180}});
    engine.tracks=[v];
    engine.currentTime=3;
    engine.renderFrame();
    assert.equal(draws.at(-1).alpha,.4);
    assert.equal(engine.getAudioFadeGain(v,3),1,
        'Visual fade must not silently alter linked audio');
    assert.equal(v.opacity,.8,'Base opacity must be left unchanged');
    engine.currentTime=4;
    engine.renderFrame();
    assert.equal(draws.at(-1).alpha,.8);
    } finally { globalThis.document=oldDocument; }
});
