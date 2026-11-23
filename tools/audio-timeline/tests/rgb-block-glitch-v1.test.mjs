/** MotoriClip #64: source-derived rectangular RGB islands with independent channel separation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRgbBlockGlitchFrame,rgbBlockGlitchFrameState,renderRgbBlockGlitch} from '../js/timeline-rgb-block-glitch.mjs';
import {TIMELINE_EFFECTS,normaliseTimelineEffect,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';

const W=240,H=135,source=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;
 source[i]=Math.round((x%45)*255/45);
 source[i+1]=Math.round((y%23)*230/23);
 source[i+2]=(x*4+y*3)%251;
 source[i+3]=x<22?80+y%100:255;
}
const config=(overrides={})=>normaliseTimelineEffect({
 presetId:'rgb-block-glitch',intensity:97,speed:1.1,density:94,distortion:92,
 rgbBlockWidth:27,rgbBlockHeight:19,rgbSeparation:94,rgbBlockLife:.28,rgbBlockSeed:6464,
 ...overrides
});
const render=(overrides={},time=.65)=>{
 const recipe=config(overrides);
 return buildRgbBlockGlitchFrame(source,W,H,recipe,time*recipe.speed);
};
const digest=bytes=>{let n=2166136261>>>0;for(const b of bytes)n=Math.imul(n^b,16777619)>>>0;return n;};
const changed=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)
 if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>24)n++;
 return n;};

test('dedicated RGB Block Glitch preset normalises five native parameters independently',()=>{
 assert.equal(TIMELINE_EFFECTS.find(e=>e.id==='rgb-block-glitch')?.label,'RGB Block Glitch');
 assert.equal(requiresCompositeSource('rgb-block-glitch'),true);
 const e=normaliseTimelineEffect({presetId:'rgb-block-glitch'});
 assert.deepEqual([e.intensity,e.density,e.distortion,e.rgbBlockWidth,e.rgbBlockHeight,
  e.rgbSeparation,e.rgbBlockLife,e.rgbBlockSeed],[91,63,76,21,15,78,.23,6464]);
 const clamped=config({rgbBlockWidth:99,rgbBlockHeight:-2,rgbSeparation:200,
  rgbBlockLife:2,rgbBlockSeed:999999});
 assert.deepEqual([clamped.rgbBlockWidth,clamped.rgbBlockHeight,clamped.rgbSeparation,
  clamped.rgbBlockLife,clamped.rgbBlockSeed],[45,2,100,.6,99999]);
 for(const id of ['data-burst','signal-tear','signal-interference'])
  assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:id}),'rgbBlockWidth'),false);
});
test('multiple independent rectangular blocks alter source RGB without changing transparency',()=>{
 const {data,state}=render(),count=changed(data,source);
 assert.ok(state.blocks.length>=2,'Several independently placed blocks should be active');
 assert.ok(count>80,'Block-local source resampling must create visible distortion');
 assert.ok(count<W*H*.6,'Video areas outside rectangles should remain intact');
 assert.ok(state.blocks.every(b=>b.x>=0&&b.y>=0&&b.x+b.w<=W&&b.y+b.h<=H));
 assert.ok(state.blocks.some(b=>b.redX!==b.blueX),'Red and blue must shift separately');
 for(let i=3;i<data.length;i+=4)assert.equal(data[i],source[i],'Each alpha byte stays unchanged');
 assert.deepEqual(render({intensity:0}).data,source);
 assert.deepEqual(render({distortion:0,rgbSeparation:0}).data,source);
});
test('channel colours are copied from real source pixels, never manufactured neon packets',()=>{
 const flat=new Uint8ClampedArray(W*H*4);
 for(let i=0;i<flat.length;i+=4){flat[i]=73;flat[i+1]=114;flat[i+2]=169;flat[i+3]=255;}
 assert.deepEqual(buildRgbBlockGlitchFrame(flat,W,H,config(),.65).data,flat);
 const zero=new Uint8ClampedArray(W*H*4);
 assert.deepEqual(buildRgbBlockGlitchFrame(zero,W,H,config(),.65).data,zero);
});
test('time evolution and reverse seeking are exact and independent of frame history',()=>{
 const times=[.2,.4,.65,1.05,1.4,1.76];
 const frames=times.map(t=>render({},t));
 assert.ok(new Set(frames.map(x=>digest(x.data))).size>=4);
 assert.deepEqual(render({},.65).data,frames[2].data);
 const earlier=rgbBlockGlitchFrameState(W,H,config(),.32);
 const later=rgbBlockGlitchFrameState(W,H,config(),1.53);
 assert.notDeepEqual(earlier.blocks,later.blocks);
});
test('size, separation, recovery, displacement, frequency, strength, speed and seed change pixels',()=>{
 const original=digest(render().data);
 for(const change of [
  {rgbBlockWidth:5},{rgbBlockHeight:4},{rgbSeparation:8},
  {rgbBlockLife:.54},{distortion:15},{density:8},
  {intensity:24},{speed:2.6},{rgbBlockSeed:17}
 ])assert.notEqual(digest(render(change).data),original,JSON.stringify(change));
});
test('history and portable recovery preserve independent RGB block settings',()=>{
 const effect=config({rgbBlockWidth:31,rgbBlockHeight:11,rgbSeparation:67,rgbBlockSeed:888});
 const clip={id:'rgb',type:'sticker',start:0,clipDuration:3,sourceFileId:'source-1',
  sourceName:'image.png',effectOverlay:effect};
 const record=snapshotClip(clip),restoredClip={id:'rgb',type:'sticker'};
 applyClipData(restoredClip,record);
 assert.deepEqual(restoredClip.effectOverlay,effect);
 const project=createRecoveryRecord({files:[{id:'source-1',kind:'sticker',name:'image.png',size:99}],
  tracks:[record],selectedTrackId:'rgb',selectedTrackIds:['rgb'],history:{undo:[],redo:[]}});
 assert.deepEqual(parseRecoveryRecord(serializeRecoveryRecord(project)).tracks[0].effectOverlay,effect);
});
test('zero-intensity render is a no-op without Canvas access',()=>{
 let touched=false;
 const ctx=new Proxy({}, {get:()=>()=>{touched=true;}});
 assert.equal(renderRgbBlockGlitch(ctx,null,W,H,config(),.65,0),true);
 assert.equal(touched,false);
});
