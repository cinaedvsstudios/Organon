import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_PAIR_EFFECTS,spiralBlockProgress,hologramStrength,crumpleFold} from '../js/paired-visual-effects.mjs';
import {TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES} from '../js/transition-catalog.mjs';
const selected=['spiralblockwipe','hologram','crumple'];
test('8N catalog retains 41 stable choices, 37 enabled',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(new Set(TRANSITION_CATALOG.map(e=>e.id)).size,41);
 assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(-3),selected);
 assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='available').length,37);
 assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='requested').length,4);
});
test('spiral blocks progress deterministically and resolve at endpoints',()=>{
 const a=Array.from({length:96},(_,i)=>spiralBlockProgress(.55,i));
 assert.deepEqual(a,Array.from({length:96},(_,i)=>spiralBlockProgress(.55,i)));
 assert.ok(new Set(a.map(x=>x.toFixed(2))).size>10);
 for(let i=0;i<96;i++){assert.equal(spiralBlockProgress(0,i),0);assert.equal(spiralBlockProgress(1,i),1);}
});
test('hologram lines fade out at both endpoints',()=>{
 for(let i=0;i<48;i++){
  assert.ok(Math.abs(hologramStrength(0,i))<1e-12);
  assert.ok(Math.abs(hologramStrength(1,i))<1e-12);
  assert.ok(hologramStrength(.5,i)>.5);
 }
});
test('crumple folds remain bounded, stable, and settle at endpoints',()=>{
 for(let i=0;i<48;i++){
  const middle=crumpleFold(.5,i,1920,1080);
  assert.deepEqual(middle,crumpleFold(.5,i,1920,1080));
  assert.deepEqual(crumpleFold(0,i,1920,1080),{x:0,y:0});
  assert.ok(Math.abs(crumpleFold(1,i,1920,1080).x)<1e-10);
  assert.ok(Math.abs(middle.x)<=230.4&&Math.abs(middle.y)<=129.6);
 }
});
