/**
 * #45: fail CI if any of 41 accepted shaders loses an independent reference
 * with the required 0%, 25%, 50%, 75%, 100% progress comparisons.
 * The first two historical tests also have a newer separately compiled GLSL
 * reference suite; the other 39 compile original sources in their own tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ORIGINAL_GLSL_PROVENANCE} from '../js/gl-transitions/original-glsl-provenance.mjs';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';

const base=new URL('./',import.meta.url);
const read=async filename=>readFile(fileURLToPath(new URL(filename,base)),'utf8');
const requiredPoints=[0,.25,.5,.75,1];

test('visual qualification covers 41 selected original GLSL effects, two-input fixtures and 5 progress marks',async()=>{
 const workflow=await read('../../../.github/workflows/motoriclip-real-media.yml');
 const names=ORIGINAL_GLSL_PROVENANCE.map(x=>x.module.toLowerCase());
 assert.equal(names.length,41);
 assert.equal(new Set(names).size,41);
 assert.deepEqual(SELECTED_TRANSITION_NAMES.length,41);
 assert.equal(TRANSITION_CATALOG.length,41);
 const legacy=await read('legacy-original-shader-oracles.browser.mjs');
 assert.match(legacy,/SPIRAL_BLOCK_SOURCE/);
 assert.match(legacy,/HOLOGRAM_SOURCE/);
 assert.match(legacy,/createShader/);
 assert.match(legacy,/gl\.readPixels/);
 assert.match(legacy,/sample\.mean<=2\.2&&sample\.max<=14/);
 assert.match(legacy,/outgoing|alphaDifference/);
 assert.match(legacy,/screenshot/);
 assert.match(legacy,/\[0,\.25,\.5,\.75,1\]/);
 assert.match(workflow,/node tools\/audio-timeline\/tests\/legacy-original-shader-oracles\.browser\.mjs/);
 const evidence=[];
 for(let i=0;i<names.length;i++){
  const name=names[i],path=name+'.browser.mjs';
  const code=await read(path);
  assert.match(workflow,new RegExp('node tools/audio-timeline/tests/'+name+'\\.browser\\.mjs'),
   'Original '+name+' GPU browser check is missing from CI');
  assert.ok(/\[0,\s*\.25,\s*\.5,\s*\.75,\s*1\]/.test(code)
   || (i===1&&/\[0,\.25,\.45,\.5,\.55,\.75,1\]/.test(code)),
   'No 0/25/50/75/100% original frame samples for #'+(i+1)+' '+name);
  assert.match(code,/AdvancedMediaEngine/,
   'Must use actual MotoriClip engine rather than mocked shader output');
  assert.match(code,/getContext\('2d'\)/,
   'Must read real rendered pixels from MotoriClip source frames');
  assert.match(code,/media:|media=/,
   'Actual source A/B image fixtures required for '+name);
  assert.match(code,/assert\./,'Original GPU pixel evidence must include assertions for '+name);
  if(i>=2){
   assert.match(code,/_SOURCE/,'Must use original pinned GLSL, not reimplemented approximations');
   assert.match(code,/createShader/,'Must compile original source in independent WebGL context');
   assert.match(code,/readPixels/,'Must read independent reference pixels');
   assert.match(code,/sample\.mean<=2\.2&&sample\.max<=14/,
    'Must numerically compare every shader frame against independent original reference');
   assert.match(code,/toDataURL|visual PNG/,
    'Must capture representative actual frame for visual review');
   assert.match(code,/stable|rewind|reverse/i,
    'Must verify deterministic backward seeking');
   assert.match(code,/alpha|visible/i,
    'Must test transparency or source visibility');
  }else{
   assert.match(code,/source|original/i,'First two legacy tests must retain original shader behavior coverage');
  }
  evidence.push({order:i+1,module:ORIGINAL_GLSL_PROVENANCE[i].module,test:path,
   independentGLSL:i<2?'legacy-original-shader-oracles.browser.mjs':path,
   progress:requiredPoints});
 }
 console.log('[MotoriClip #45 coverage] PASS 41 original shaders: '+JSON.stringify(evidence));
});