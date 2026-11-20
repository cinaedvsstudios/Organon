import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_PAIR_EFFECTS,crumpleFold} from '../js/paired-visual-effects.mjs';
import {HOLOGRAM_SOURCE,HOLOGRAM_DEFAULTS,normaliseHologramOptions} from '../js/gl-transitions/Hologram.mjs';
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
 const gitBlob=createHash('sha1').update('blob '+bytes.length+String.fromCharCode(0)).update(bytes).digest('hex');
 assert.equal(gitBlob,'e98d9e749d398d84ec927da9286af13843da722e',
     'Original shader body must not be silently rewritten or approximated');
 assert.deepEqual(SPIRAL_BLOCK_DEFAULTS,{columns:8,rows:6,inward:true,clockwise:true,smoothness:.05});
 assert.deepEqual(normaliseSpiralBlockOptions(),SPIRAL_BLOCK_DEFAULTS);
 assert.deepEqual(normaliseSpiralBlockOptions({columns:120,rows:-5,inward:false,clockwise:false,smoothness:7}),
     {columns:64,rows:1,inward:false,clockwise:false,smoothness:.5});
});
test('Hologram uses byte-for-byte original GLSL source and correct five uniforms',()=>{
 const bytes=Buffer.from(HOLOGRAM_SOURCE,'utf8');
 const gitBlob=createHash('sha1').update('blob '+bytes.length+String.fromCharCode(0)).update(bytes).digest('hex');
 assert.equal(gitBlob,'284e495b81dabf03070eb1c24ad41583a7ed5ee4',
    'Do not silently replace original shader with faux Canvas stripes');
 assert.deepEqual(HOLOGRAM_DEFAULTS,{
    tint:'#33bfff',background:'#00050d',backgroundAlpha:1,
    scanlines:150,jitter:.04,flicker:.6
 });
 assert.deepEqual(normaliseHologramOptions(),HOLOGRAM_DEFAULTS);
 assert.deepEqual(normaliseHologramOptions({
    tint:'#cc2299',background:'#241126',backgroundAlpha:.3,scanlines:280,jitter:.18,flicker:.9
 }),{tint:'#cc2299',background:'#241126',backgroundAlpha:.3,scanlines:280,jitter:.18,flicker:.9});
 assert.deepEqual(normaliseHologramOptions({
    tint:'invalid',background:'#nope',scanlines:500,jitter:-10,flicker:2
 }),{...HOLOGRAM_DEFAULTS,scanlines:300,jitter:0,flicker:1});
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
