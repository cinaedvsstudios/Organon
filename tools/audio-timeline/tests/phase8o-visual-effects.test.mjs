import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_PAIR_EFFECTS,sphereRadius,snapshotFlash,galleryTileProgress,brokeyFragment} from '../js/paired-visual-effects.mjs';
import {TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES} from '../js/transition-catalog.mjs';
const last=['sphere','snapshot','gallery','brokey-dissolve'];
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
test('Brokey dissolve uses stable per-fragment thresholds and completes',()=>{
 const middle=Array.from({length:126},(_,i)=>brokeyFragment(.5,i));
 assert.ok(new Set(middle.map(x=>x.toFixed(2))).size>10);
 for(let i=0;i<126;i++){
  assert.equal(brokeyFragment(0,i),0);
  assert.equal(brokeyFragment(1,i),1);
  assert.equal(brokeyFragment(.5,i),middle[i]);
 }
});
