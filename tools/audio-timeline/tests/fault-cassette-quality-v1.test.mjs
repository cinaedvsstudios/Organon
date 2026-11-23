/** MotoriClip #66 quality audit — authentic, source-derived analogue Fault Cassette. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {faultCassetteFrameState,buildFaultCassetteFrame,renderFaultCassette} from '../js/timeline-fault-cassette.mjs';
import {normaliseTimelineEffect,TIMELINE_EFFECTS,requiresCompositeSource} from '../js/timeline-effects.mjs';
import {snapshotClip,applyClipData} from '../js/project-history.mjs';
import {createRecoveryRecord,serializeRecoveryRecord,parseRecoveryRecord} from '../js/project-recovery.mjs';
const W=240,H=135,source=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;
 source[i]=(x*5+y*2)%249;source[i+1]=(y*9+x)%251;
 source[i+2]=(x*3+y*7)%253;source[i+3]=x<23?60+(y%130):255;
}
const recipe=(overrides={})=>normaliseTimelineEffect({presetId:'fault-cassette',
 intensity:96,speed:1.15,density:94,distortion:92,scale:115,direction:13,
 color:'#e3b593',cassetteTracking:92,cassetteDropouts:89,
 cassetteChroma:95,cassetteRoll:70,cassetteSeed:6969,...overrides
});
const frame=(override={},time=.65)=>{const e=recipe(override);return buildFaultCassetteFrame(source,W,H,e,time*e.speed);};
const hash=arr=>{let x=2166136261>>>0;for(const b of arr)x=Math.imul(x^b,16777619)>>>0;return x;};
const altered=(a,b,threshold=30)=>{let n=0;for(let i=0;i<a.length;i+=4){
 if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>threshold)n++;
 }return n;};
test('retains one Fault Cassette preset and normalises five independent analogue controls',()=>{
 assert.equal(TIMELINE_EFFECTS.filter(p=>p.id==='fault-cassette').length,1);
 assert.equal(requiresCompositeSource('fault-cassette'),true);
 const def=normaliseTimelineEffect({presetId:'fault-cassette'});
 assert.deepEqual([def.density,def.distortion,def.color,def.cassetteTracking,def.cassetteDropouts,
  def.cassetteChroma,def.cassetteRoll,def.cassetteSeed],
  [62,72,'#ffe0aa',79,62,64,48,6969]);
 const bounded=recipe({cassetteTracking:-7,cassetteDropouts:204,cassetteChroma:-1,cassetteRoll:220,cassetteSeed:999999});
 assert.deepEqual([bounded.cassetteTracking,bounded.cassetteDropouts,bounded.cassetteChroma,
  bounded.cassetteRoll,bounded.cassetteSeed],[0,100,0,100,99999]);
 for(const id of ['signal-tear','line-corruption','rgb-block-glitch'])
  assert.equal(Object.hasOwn(normaliseTimelineEffect({presetId:id}),'cassetteTracking'),false);
});
test('separate uneven analogue tracking faults and rolling head sync alter real image locally',()=>{
 const {data,state}=frame();
 assert.ok(state.bands.length>1,'More than one independent tape break is active');
 assert.ok(new Set(state.bands.map(b=>b.y)).size>1,'Fault heights must differ');
 assert.ok(state.bands.some(b=>b.shift!==0),'Source rows displaced, not just tinted');
 assert.ok(state.bands.some(b=>b.height>1),'Variable-height tracking instability');
 assert.ok(state.trackingY>=0&&state.trackingY<H,'Head tracking has a moving vertical position');
 const count=altered(data,source);
 assert.ok(count>50,'Analogue damage must be visible on real source');
 assert.ok(count<W*H*.65,'Uncorrupted image must remain recognizable');
 for(let i=3;i<data.length;i+=4)assert.equal(data[i],source[i],'Source alpha is unchanged');
});
test('real source is sampled, no fabricated identical video signal',()=>{
 const swapped=new Uint8ClampedArray(source.length);
 for(let i=0;i<swapped.length;i+=4){swapped[i]=60;swapped[i+1]=130;swapped[i+2]=205;swapped[i+3]=source[i+3];}
 const effect=recipe();
 const a=frame().data,b=buildFaultCassetteFrame(swapped,W,H,effect,.65*effect.speed).data;
 assert.notDeepEqual(a,b);
 const empty=new Uint8ClampedArray(source.length);
 assert.deepEqual(buildFaultCassetteFrame(empty,W,H,effect,.65).data,empty,'No manufactured colours on fully transparent pixels');
});
test('time, independent tape events and reverse seeking reproduce exact frames',()=>{
 const times=[.15,.34,.65,.88,1.27,1.73];
 const signatures=times.map(t=>hash(frame({},t).data));
 assert.ok(new Set(signatures).size>=5,'Recorded tape flaws actually change with time');
 assert.equal(signatures[2],hash(frame({},.65).data),'Exact rewind regardless of preceding render history');
 assert.notDeepEqual(faultCassetteFrameState(W,H,recipe(),.25),
  faultCassetteFrameState(W,H,recipe(),1.20));
});
test('tracking, dropout, chroma, head-roll and legacy controls change rendered image',()=>{
 const base=hash(frame().data);
 for(const change of [{density:7},{distortion:8},{scale:32},{direction:-87},
  {cassetteTracking:0},{cassetteDropouts:0},{cassetteChroma:0},
  {cassetteRoll:0},{cassetteSeed:173},{color:'#75c5ff'},{speed:3}]){
  assert.notEqual(hash(frame(change).data),base,'Dormant Inspector value: '+JSON.stringify(change));
 }
});
test('history and portable project Save/Open retain tape settings',()=>{
 const effect=recipe({cassetteTracking:26,cassetteDropouts:83,cassetteSeed:21});
 const clip={id:'tape',type:'sticker',start:0,clipDuration:3,sourceFileId:'source-1',
  sourceName:'source.png',effectOverlay:effect};
 const snap=snapshotClip(clip),restored={id:'tape',type:'sticker'};
 applyClipData(restored,snap);assert.deepEqual(restored.effectOverlay,effect);
 const project=createRecoveryRecord({files:[{id:'source-1',kind:'sticker',name:'source.png',size:99}],
  tracks:[snap],selectedTrackId:'tape',selectedTrackIds:['tape'],history:{undo:[],redo:[]}});
 assert.deepEqual(parseRecoveryRecord(serializeRecoveryRecord(project)).tracks[0].effectOverlay,effect);
});
test('zero-strength Canvas operation is a true no-op',()=>{
 let touched=false;
 const ctx=new Proxy({}, {get:()=>()=>{touched=true;}});
 assert.equal(renderFaultCassette(ctx,null,W,H,recipe(),.65,0),true);
 assert.equal(touched,false);
});
