import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_PAIR_EFFECTS,sphereRadius,snapshotFlash,galleryTileProgress,isAvailablePairEffect} from '../js/paired-visual-effects.mjs';
import {TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES,normalizeTransitionEffectId} from '../js/transition-catalog.mjs';
import {normaliseBokehDissolveOptions} from '../js/gl-transitions/BokehDissolve.mjs';
const last=['sphere','snapshot','gallery','bokeh-dissolve'];
test('all 41 selected transitions are now available with stable unique IDs',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(TRANSITION_CATALOG.length,41);
 assert.equal(new Set(TRANSITION_CATALOG.map(x=>x.id)).size,41);
 assert.equal(TRANSITION_CATALOG.filter(x=>x.status==='available').length,41);
 assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(-4),last);
 for(const id of last)assert.equal(TRANSITION_CATALOG.find(x=>x.id===id)?.status,'available');
});
test('sphere aperture grows from zero to cover frame corners',()=>{
 assert.equal(sphereRadius(0,196,112),0);
 assert.ok(sphereRadius(.5,196,112)>0);
 assert.ok(sphereRadius(1,196,112)>=Math.hypot(196,112)/2);
});
test('snapshot flash is centered and vanishes at either boundary',()=>{
 assert.equal(snapshotFlash(0),0);
 assert.equal(snapshotFlash(1),0);
 assert.equal(snapshotFlash(.5),1);
 assert.ok(snapshotFlash(.48)>snapshotFlash(.25));
});
test('gallery panels stagger deterministically and all complete',()=>{
 const middle=Array.from({length:6},(_,i)=>galleryTileProgress(.5,i));
 assert.ok(new Set(middle.map(x=>x.toFixed(3))).size>3);
 for(let i=0;i<6;i++){
  assert.equal(galleryTileProgress(0,i),0);
  assert.equal(galleryTileProgress(1,i),1);
  assert.equal(galleryTileProgress(.5,i),middle[i]);
 }
});
test('correct BokehDissolve name and native lens controls replace old block thresholds',()=>{
 assert.equal(normalizeTransitionEffectId('brokey-dissolve'),'bokeh-dissolve');
 assert.equal(isAvailablePairEffect('brokey-dissolve'),true);
 assert.equal(TRANSITION_CATALOG.find(x=>x.id==='bokeh-dissolve')?.label,'Bokeh dissolve');
 const native=normaliseBokehDissolveOptions({radius:.12,blades:6,threshold:.3,intensity:2});
 assert.deepEqual(native,{radius:.12,blades:6,threshold:.3,intensity:2});
 assert.deepEqual(normaliseBokehDissolveOptions({radius:0,blades:20,threshold:2,intensity:-1}),
  {radius:.01,blades:9,threshold:1,intensity:0});
});
