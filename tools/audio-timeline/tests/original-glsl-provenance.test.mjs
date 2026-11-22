/**
 * #44: offline, reproducible evidence of all 41 upstream shader sources.
 * Git blob digest is SHA-1("blob " + UTF-8 byteLength + NUL + raw GLSL).
 * A locally changed shader, author, licence, revision or default must fail.
 * Upstream source at each pinned commit was independently fetched and compared.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ORIGINAL_GLSL_PROVENANCE} from '../js/gl-transitions/original-glsl-provenance.mjs';
import {SELECTED_TRANSITION_NAMES,TRANSITION_CATALOG} from '../js/transition-catalog.mjs';
import {ACTIVE_PAIR_EFFECTS} from '../js/paired-visual-effects.mjs';

const base=new URL('../js/gl-transitions/',import.meta.url);
const pairedFile=new URL('../js/paired-visual-effects.mjs',import.meta.url);
const sha1GitBlob=glsl=>{
  const bytes=Buffer.from(glsl,'utf8');
  return createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0','utf8'))
    .update(bytes).digest('hex');
};

test('exactly 41 source-origin records preserve the original selected order and shader dispatch modules',async()=>{
  assert.equal(ORIGINAL_GLSL_PROVENANCE.length,41);
  assert.equal(SELECTED_TRANSITION_NAMES.length,41);
  assert.equal(TRANSITION_CATALOG.length,41);
  assert.equal(ACTIVE_PAIR_EFFECTS.length,41);
  const modules=ORIGINAL_GLSL_PROVENANCE.map(x=>x.module);
  assert.equal(new Set(modules).size,41);
  assert.deepEqual(ORIGINAL_GLSL_PROVENANCE.map(x=>x.selectedOrder),Array.from({length:41},(_,i)=>i+1));
  const paired=await readFile(fileURLToPath(pairedFile),'utf8');
  const imports=[...paired.matchAll(/from '\.\/gl-transitions\/(\w+)\.mjs';/g)]
    .map(m=>m[1]);
  assert.equal(imports.length,41,'Every available paired effect must have one source module');
  assert.deepEqual(new Set(imports),new Set(modules));
  assert.equal(new Set(TRANSITION_CATALOG.map(x=>x.id)).size,41);
  assert.deepEqual(new Set(TRANSITION_CATALOG.map(x=>x.id)),new Set(ACTIVE_PAIR_EFFECTS));
});

test('every original upstream Git blob, author, licence, revision, native defaults and normalization is pinned',async()=>{
  const audit=[];
  for(const item of ORIGINAL_GLSL_PROVENANCE){
    const file=new URL(item.module+'.mjs',base);
    const body=await readFile(fileURLToPath(file),'utf8');
    const matches=[...body.matchAll(/export const (\w+)\s*=\s*String\.raw[\x60]([\s\S]*?)[\x60];/g)];
    assert.equal(matches.length,1,'Expected one byte-exact embedded shader for '+item.module);
    const [,sourceExport,glsl]=matches[0];
    const computed=sha1GitBlob(glsl);
    assert.equal(computed,item.blob,'Source bytes differ from pinned GL Transitions Git blob: '+item.module);
    assert.match(item.blob,/^[0-9a-f]{40}$/);
    assert.match(item.sourceCommit,/^[0-9a-f]{40}$/);
    assert.equal(item.sourceFile,'transitions/'+item.module+'.glsl');
    assert.ok(body.includes(item.blob),'Module must record exact original Git blob '+item.module);
    assert.ok(body.includes('gl-transitions/gl-transitions/blob/'+item.sourceCommit+
      '/'+item.sourceFile),'Upstream pinned source URL must be in module header for '+item.module);
    const originalAuthor=glsl.match(/^\s*\/\/\s*Author:\s*(.+)$/mi)?.[1].trim();
    const originalLicense=glsl.match(/^\s*\/\/\s*License:\s*(.+)$/mi)?.[1].trim();
    assert.equal(originalAuthor,item.author,'Incorrect original author for '+item.module);
    assert.equal(originalLicense,item.license,'Incorrect original licence for '+item.module);
    assert.equal(item.license,'MIT','Unexpected upstream licence for '+item.module);
    const exports=await import(file.href);
    const defaultsExports=Object.entries(exports).filter(([k])=>/_DEFAULTS$/.test(k));
    assert.equal(defaultsExports.length,1,'Expected exactly one published native defaults export in '+item.module);
    assert.deepEqual(defaultsExports[0][1],item.defaults,
      'Editor defaults differ from recorded original source metadata for '+item.module);
    const normalizers=Object.entries(exports).filter(([k,v])=>
      /^normalise\w+Options$/.test(k)&&typeof v==='function');
    assert.equal(normalizers.length,1,'Expected one native options normalizer in '+item.module);
    assert.deepEqual(normalizers[0][1](),item.defaults,
      'Empty project settings must resolve to source editor defaults for '+item.module);
    for(const [key,value] of Object.entries(item.defaults)){
      assert.ok(['number','boolean','string'].includes(typeof value),
        'Unexpected non-serializable native parameter '+item.module+'.'+key);
      if(typeof value==='number')assert.ok(Number.isFinite(value),
        'Non-finite native default in '+item.module+'.'+key);
    }
    const uniforms=[...glsl.matchAll(/^\s*uniform\s+(\w+)\s+(\w+)\s*;/gm)]
      .map(m=>({type:m[1],name:m[2]}));
    audit.push({index:item.selectedOrder,name:item.module,blob:computed,
      author:originalAuthor,licence:originalLicense,sourceExport,
      uniformNames:uniforms.map(x=>x.name),nativeDefaults:item.defaults});
  }
  assert.equal(audit.length,41);
  console.log('[MotoriClip #44] PASS pinned original sources, author/MIT attribution, commits, Git blobs and native defaults: '+JSON.stringify(audit));
});