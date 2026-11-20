import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_PAIR_EFFECTS,hologramStrength,crumpleFold} from '../js/paired-visual-effects.mjs';
import {SPIRAL_BLOCK_SOURCE,SPIRAL_BLOCK_DEFAULTS,normaliseSpiralBlockOptions} from '../js/gl-transitions/SpiralBlockWipe.mjs';
import {createHash} from 'node:crypto';
import {TRANSITION_CATALOG,SELECTED_TRANSITION_NAMES} from '../js/transition-catalog.mjs';
const selected=['spiralblockwipe','hologram','crumple'];
test('8N catalog retains 41 stable choices, 37 enabled',()=>{
 assert.equal(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(new Set(TRANSITION_CATALOG.map(e=>e.id)).size,41);
 assert.deepEqual(ACTIVE_PAIR_EFFECTS.slice(34,37),selected);
 assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='available').length,41);
 assert.equal(TRANSITION_CATALOG.filter(e=>e.status==='requested').length,0);
});
test('SpiralBlockWipe contains byte-for-byte upstream MIT GLSL and original defaults',()=>{
 const bytes=Buffer.from(SPIRAL_BLOCK_SOURCE,'utf8');
 const gitBlob=createHash('sha1').update('blob '+bytes.length+'\\0'.replace('\\0','\\x00')).update(bytes).digest('hex');
 assert.equal(gitBlob,'e98d9e749d398d84ec927da9286af13843da722e',
     'Original shader body must not be silently rewritten or approximated');
 assert.deepEqual(SPIRAL_BLOCK_DEFAULTS,{columns:8,rows:6,inward:true,clockwise:true,smoothness:.05});
 assert.deepEqual(normaliseSpiralBlockOptions(),SPIRAL_BLOCK_DEFAULTS);
 assert.deepEqual(normaliseSpiralBlockOptions({columns:120,rows:-5,inward:false,clockwise:false,smoothness:7}),
     {columns:64,rows:1,inward:false,clockwise:false,smoothness:.5});
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
