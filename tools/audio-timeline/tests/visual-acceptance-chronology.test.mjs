/**
 * #46 — enforce original selection order and individual visual acceptance.
 *
 * This audits the SINGLE active master checklist rather than creating a new
 * progress tracker. Every accepted transition must have its own original
 * source, verified entry, unique small PR, individual Actions evidence,
 * reference browser test and actual encoded-video comparison. Source hashes
 * and full source fidelity are independently pinned under #44; full pixel
 * coverage is independently tested under #45.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ORIGINAL_GLSL_PROVENANCE} from '../js/gl-transitions/original-glsl-provenance.mjs';

const base=new URL('../',import.meta.url);
const read=async path=>readFile(fileURLToPath(new URL(path,base)),'utf8');
const evidencePattern=/^-\s+\[(x| )\]\s+\*\*0?(\d+)\.\s+GL TRANSITION\s+—\s+([^*]+)\*\*/;

test('41 selected transitions are individually accepted in order, with independent per-item evidence',async()=>{
 const markdown=await read('MOTORICLIP_VISUAL_REBUILD_REQUIREMENTS.md');
 const workflow=await read('../../.github/workflows/motoriclip-real-media.yml');
 const lines=markdown.split('\n');
 const transitionRows=lines.filter(line=>evidencePattern.test(line));
 assert.equal(transitionRows.length,41,'The one active checklist must retain 41 individual numbered shader rows');
 assert.equal(ORIGINAL_GLSL_PROVENANCE.length,41);
 const seenPR=new Set(),seenRun=new Set(),records=[];
 let previousPR=0,previousRun=0;
 for(let i=0;i<transitionRows.length;i++){
  const line=transitionRows[i],matched=line.match(evidencePattern);
  const [,_checked,rawIndex,display]=matched;
  const original=ORIGINAL_GLSL_PROVENANCE[i];
  const order=Number(rawIndex);
  assert.equal(order,i+1,'Transitions must remain in original user-selected order');
  assert.equal(_checked,'x','Original shader cannot be declared accepted without its own evidence');
  assert.ok(display.toLowerCase().includes(original.module.toLowerCase()),
   'Original source name must match selected transition: '+original.module);
  assert.match(line,/\*\*Verified\s+\d{1,2}\s+Nov\s+2026:/,'Individual transition needs its own dated acceptance');
  assert.ok(line.includes('/transitions/'+original.module+'.glsl'),
   'Original shader upstream source link is missing from '+original.module);
  assert.match(line,/Chrome|browser|WebGL/i,'Each item must have browser GPU visual evidence');
  assert.match(line,/GLSL/i,'Each item must document original GLSL fidelity');
  const prMatches=[...line.matchAll(/https:\/\/github\.com\/cinaedvsstudios\/Organon\/pull\/(\d+)/g)];
  const actionMatches=[...line.matchAll(/https:\/\/github\.com\/cinaedvsstudios\/Organon\/actions\/runs\/(\d+)/g)];
  assert.equal(prMatches.length,1,'Each selected transition requires exactly one individual acceptance PR: '+original.module);
  assert.equal(actionMatches.length,1,'Each selected transition requires an individual Actions run: '+original.module);
  const pr=Number(prMatches[0][1]),run=Number(actionMatches[0][1]);
  assert.ok(pr>previousPR,'Individual transition PRs must follow original sequence: '+original.module);
  assert.ok(run>previousRun,'Individual Actions runs must follow original sequence: '+original.module);
  assert.equal(seenPR.has(pr),false,'Several transitions incorrectly share one acceptance PR');
  assert.equal(seenRun.has(run),false,'Several transitions incorrectly share one acceptance run');
  seenPR.add(pr);seenRun.add(run);previousPR=pr;previousRun=run;
  const basename=original.module.toLowerCase();
  for(const ending of ['.browser.mjs','-export.browser.mjs']){
   const file='tests/'+basename+ending;
   const source=await read(file);
   assert.ok(source.length>500,'Real individual acceptance test required: '+file);
   assert.ok(workflow.includes('node tools/audio-timeline/'+file),
    'Each shader must retain independently scheduled QA: '+file);
  }
  records.push({order,name:original.module,originalSource:original.sourceFile,
   upstreamCommit:original.sourceCommit,pr,run,
   browserTest:'tests/'+basename+'.browser.mjs',
   exportTest:'tests/'+basename+'-export.browser.mjs'});
 }
 // The old implementation tracker counts technical scope, not visual success.
 assert.match(markdown,/102\/102/);
 assert.ok(markdown.includes('**46. ENGINE / one-at-a-time rule**'),
  'One-at-a-time acceptance rule must stay in master checklist');
 assert.equal(seenPR.size,41);assert.equal(seenRun.size,41);
 console.log('[MotoriClip #46 acceptance chronology] PASS 41 distinct ordered PRs/actions plus 41 individually scheduled shader and real-encoded-video tests: '+JSON.stringify(records));
});

test('no false bulk acceptance hides remaining overlay, editor, mobile and performance work',async()=>{
 const markdown=await read('MOTORICLIP_VISUAL_REBUILD_REQUIREMENTS.md');
 const rows=markdown.split('\n').filter(x=>/^-\s+\[[ x]\]\s+\*\*\d+\./.test(x));
 assert.equal(rows.length,87,'All 87 requirements, including four November UI additions, must remain in one tracker');
 for(const row of rows){
  const m=row.match(/^-\s+\[([ x])\]\s+\*\*(\d+)\./);
  const n=Number(m[2]);
  if(n>=47 && m[1]==='x'){
   assert.match(row,/\*\*Verified\b/i,'Future accepted requirement must have individually dated evidence: #'+n);
   assert.match(row,/https:\/\/github\.com\/cinaedvsstudios\/Organon\/pull\/\d+/,
    'Future accepted requirement must cite its implementation PR: #'+n);
   assert.match(row,/https:\/\/github\.com\/cinaedvsstudios\/Organon\/actions\/runs\/\d+/,
    'Future accepted requirement must cite its verification run: #'+n);
  }
 }
 assert.ok(markdown.includes('**Current verified progress'),'Master progress must remain visible');
});