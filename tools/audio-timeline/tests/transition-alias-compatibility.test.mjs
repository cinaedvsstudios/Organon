/**
 * #43: historically saved transition IDs must remain portable and reversible.
 * Covers old typo/aliases together, canonical priority, source binding,
 * paired planning and the same restore routine used by project history.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SELECTED_TRANSITION_NAMES, TRANSITION_CATALOG,
  normalizeTransitionEffectId, normalizeTransitionParameters
} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {planPairedTransition} from '../js/clip-pair-transitions.mjs';
import {
  snapshotClip,snapshotProject,applyClipData,prepareHistoryTracks,
  restoreFileEntries
} from '../js/project-history.mjs';

const migrations=[
  {old:'brokey-dissolve',id:'bokeh-dissolve',oldOptions:{radius:.22,blades:7},newOptions:{radius:.67,blades:4}},
  {old:'spin',id:'whipspin',oldOptions:{turns:-1.25,blur:.8},newOptions:{turns:2,blur:.2}},
  {old:'whip-spin',id:'whipspin',oldOptions:{turns:.7,blur:.4},newOptions:{turns:-.8,blur:.3}},
  {old:'color-codes',id:'colorcoords',oldOptions:{redWeight:.4},newOptions:{redWeight:.9}},
  {old:'color-coords',id:'colorcoords',oldOptions:{redWeight:.3},newOptions:{redWeight:.8}}
];
const mediaRecords=['from.mp4','one.mp4','two.mp4','three.mp4','four.mp4','five.mp4']
  .map((name,index)=>({id:'file'+index,name,kind:'video',size:1111+index*113,
    lastModified:1723456789000+index*100}));
const sourceFiles=new Map(mediaRecords.map(m=>[m.id,{
  name:m.name,size:m.size,lastModified:m.lastModified,type:'video/mp4'
}]));
const clip=(id,index)=>({
  id,type:'video',sourceFileId:mediaRecords[index].id,
  sourceName:mediaRecords[index].name,file:sourceFiles.get(mediaRecords[index].id),
  start:index===0?0:3,sourceOffset:0,sourceDuration:20,
  clipDuration:index===0?4:3,order:10-index,laneId:'lane'+index,
  laneLabel:'Video '+index,visible:true,opacity:.73,blendMode:'source-over',
  audio:{volume:.47+index*.05,muted:false,fadeIn:0,fadeOut:0},
  visualTransitions:{enter:{type:'fade',duration:index===0?0:1,curve:'linear'},
    exit:{type:'fade',duration:0,curve:'linear'}}
});
const base=[clip('A',0),...migrations.map((m,i)=>({
  ...clip('B'+i,i+1),
  transitionFromId:'A',transitionEffectId:m.old,
  transitionParameters:{[m.old]:m.oldOptions,otherTransition:{safe:true}}
}))];
const clone=value=>JSON.parse(JSON.stringify(value));

test('All 41 original selected IDs stay unique in their original order and every historical alias remains available',()=>{
  assert.equal(SELECTED_TRANSITION_NAMES.length,41);
  assert.equal(TRANSITION_CATALOG.length,41);
  assert.equal(ACTIVE_PAIR_EFFECTS.length,41);
  assert.equal(new Set(TRANSITION_CATALOG.map(t=>t.id)).size,41);
  assert.deepEqual(new Set(TRANSITION_CATALOG.map(t=>t.id)),new Set(ACTIVE_PAIR_EFFECTS));
  for(const [index,entry] of TRANSITION_CATALOG.entries()){
    assert.equal(entry.selectedOrder,index+1);
    assert.equal(entry.label,SELECTED_TRANSITION_NAMES[index]);
  }
  for(const m of migrations){
    assert.equal(normalizeTransitionEffectId(m.old),m.id);
    assert.equal(isAvailablePairEffect(m.old),true);
    assert.equal(isAvailablePairEffect(m.id),true);
  }
});

test('Legacy parameter aliases are canonicalised without collisions, dropping unrelated effect settings or mutating source objects',()=>{
  for(const m of migrations){
    const old={otherTransition:{safe:true},[m.old]:m.oldOptions};
    const original=clone(old);
    assert.deepEqual(normalizeTransitionParameters(old),{otherTransition:{safe:true},[m.id]:m.oldOptions});
    assert.deepEqual(old,original,'Migration must not mutate stored source values');
    const mixed={...old,[m.id]:m.newOptions};
    assert.deepEqual(normalizeTransitionParameters(mixed),
      {otherTransition:{safe:true},[m.id]:m.newOptions},
      'Previously saved canonical settings must win over legacy alias data');
  }
  const all={
    'brokey-dissolve':{old:true},'bokeh-dissolve':{new:true},
    'spin':{old:true},'whip-spin':{older:true},whipspin:{new:true},
    'color-codes':{old:true},'color-coords':{older:true},colorcoords:{new:true},
    ripple:{amplitude:100}
  };
  assert.deepEqual(normalizeTransitionParameters(all),{
    'bokeh-dissolve':{new:true},whipspin:{new:true},
    colorcoords:{new:true},ripple:{amplitude:100}
  });
});

test('Simultaneous old projects migrate at snapshot/save, pair planning and history Undo/Redo without losing source references',()=>{
  const saved=snapshotProject({files:mediaRecords,tracks:base,
    selectedTrackIds:['B0','B1','B2','B3','B4'],selectedTrackId:'B3',
    selectedFileId:'file4',currentTime:3.5,markers:[],settings:{fps:25}});
  assert.equal(saved.tracks.length,6);
  assert.equal(saved.selectedTrackId,'B3');
  assert.deepEqual(saved.selectedTrackIds,['B0','B1','B2','B3','B4']);
  assert.equal(saved.currentTime,3.5);
  assert.equal(saved.settings.fps,25);
  const restoredJson=clone(saved); // portable file round-trip
  for(const [i,m] of migrations.entries()){
    const copy=restoredJson.tracks[i+1];
    assert.equal(copy.transitionEffectId,m.id);
    assert.deepEqual(copy.transitionParameters[m.id],m.oldOptions);
    assert.equal(copy.sourceFileId,base[i+1].sourceFileId);
    assert.equal(copy.transitionFromId,'A');
    assert.equal(copy.audio.volume,base[i+1].audio.volume);
    assert.deepEqual(copy.transitionParameters.otherTransition,{safe:true});
    const plan=planPairedTransition([base[0],base[i+1]],['A','B'+i],1,m.old);
    assert.equal(plan.effectId,m.id);
    const undo=clone(base[i+1]);
    applyClipData(undo,{...copy,transitionEffectId:m.old,
      transitionParameters:{[m.old]:m.oldOptions}});
    assert.equal(undo.transitionEffectId,m.id);
    assert.deepEqual(undo.transitionParameters[m.id],m.oldOptions);
    assert.equal(undo.sourceFileId,base[i+1].sourceFileId);
  }
  const entries=restoreFileEntries(restoredJson.files,sourceFiles);
  assert.equal(entries.length,6);
  assert.ok(entries.every(row=>row.needsRelink===false&&row.file===sourceFiles.get(row.id)));
});

test('History restoration reuses live media without re-decoding and normalizes all aliases when loading old JSON',async()=>{
  // Simulate an older JSON file where clip IDs and option keys still use the aliases.
  const legacy=snapshotProject({files:mediaRecords,tracks:base,
    selectedTrackIds:[],selectedTrackId:null,selectedFileId:null,currentTime:0});
  for(const [i,m] of migrations.entries()){
    legacy.tracks[i+1].transitionEffectId=m.old;
    legacy.tracks[i+1].transitionParameters={[m.old]:clone(m.oldOptions)};
  }
  const loaded=[];
  const prepared=await prepareHistoryTracks({
    records:clone(legacy.tracks),existingTracks:[],sourceFiles,
    loadTrack:async(track,file)=>{
      loaded.push(track.id);
      track.file=file;track.media={kind:'live-media',clipId:track.id};
    },
    disposeTrack(){throw Error('Unexpected media disposal');}
  });
  assert.equal(prepared.tracks.length,6);
  assert.equal(loaded.length,6);
  prepared.commit();
  for(const [i,m] of migrations.entries()){
    const value=prepared.tracks[i+1];
    assert.equal(value.transitionEffectId,m.id);
    assert.deepEqual(value.transitionParameters[m.id],m.oldOptions);
    assert.equal(value.file,sourceFiles.get('file'+(i+1)));
    assert.equal(value.media.kind,'live-media');
    assert.equal(value.transitionFromId,'A');
  }
  let reloads=0;
  const undoPrepared=await prepareHistoryTracks({
    records:clone(legacy.tracks),existingTracks:prepared.tracks,sourceFiles,
    loadTrack:async()=>{reloads++;},
    disposeTrack(){throw Error('Existing clips must not be disposed on Undo');}
  });
  undoPrepared.commit();
  assert.equal(reloads,0,'Reused media objects must never re-decode during Undo/Redo');
  for(const [i,m] of migrations.entries()){
    assert.equal(undoPrepared.tracks[i+1],prepared.tracks[i+1]);
    assert.equal(undoPrepared.tracks[i+1].transitionEffectId,m.id);
    assert.deepEqual(undoPrepared.tracks[i+1].transitionParameters[m.id],m.oldOptions);
  }
});