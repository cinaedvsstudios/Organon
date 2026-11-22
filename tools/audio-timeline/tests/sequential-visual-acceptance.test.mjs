/**
 * #46 — one-at-a-time original shader visual acceptance guard.
 * The canonical source of acceptance remains the SINGLE master checklist.
 * These individual PR merge times were independently read from GitHub on
 * 22 Nov 2026; they are an immutable audit fixture, not a second task list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ORIGINAL_GLSL_PROVENANCE} from '../js/gl-transitions/original-glsl-provenance.mjs';
import {TRANSITION_CATALOG} from '../js/transition-catalog.mjs';

const checklist=new URL('../MOTORICLIP_VISUAL_REBUILD_REQUIREMENTS.md',import.meta.url);
const workflow=new URL('../../../.github/workflows/motoriclip-real-media.yml',import.meta.url);
// Each selected effect received its OWN merged PR, in order. Number 143
// is not a selected shader and must not be invented as an acceptance entry.
const acceptedPRs=[...Array.from({length:37},(_,i)=>106+i),144,145,146,147];
// Source is GitHub's actual merged_at metadata, all verified individually.
// The chronology, rather than PR numbers alone, proves acceptance order.
const mergedAt=[
 '2026-11-20T18:23:19Z','2026-11-20T18:40:59Z',
 '2026-11-20T19:20:55Z','2026-11-20T19:37:11Z',
 '2026-11-21T16:51:24Z','2026-11-21T16:57:32Z',
 '2026-11-21T17:03:02Z','2026-11-21T17:09:09Z',
 '2026-11-21T17:15:36Z','2026-11-21T17:22:25Z',
 '2026-11-21T18:05:08Z','2026-11-21T18:10:53Z',
 '2026-11-21T18:17:07Z','2026-11-21T18:26:43Z',
 '2026-11-21T18:48:15Z','2026-11-21T18:53:42Z',
 '2026-11-21T18:59:30Z','2026-11-21T19:06:59Z',
 '2026-11-21T19:35:52Z','2026-11-21T19:43:36Z',
 '2026-11-21T19:50:29Z','2026-11-21T20:20:46Z',
 '2026-11-21T20:29:04Z','2026-11-21T20:36:28Z',
 '2026-11-21T20:51:23Z','2026-11-21T20:56:20Z',
 '2026-11-21T21:20:34Z','2026-11-21T21:49:19Z',
 '2026-11-21T21:56:04Z','2026-11-21T22:01:54Z',
 '2026-11-22T02:51:59Z','2026-11-22T02:58:45Z',
 '2026-11-22T03:09:16Z','2026-11-22T03:16:36Z',
 '2026-11-22T03:27:31Z','2026-11-22T03:34:01Z',
 '2026-11-22T03:39:16Z','2026-11-22T06:31:45Z',
 '2026-11-22T06:39:44Z','2026-11-22T06:46:33Z',
 '2026-11-22T06:53:00Z'
];

test('all 41 original GLSL acceptances occurred in strict GitHub merge chronology',()=>{
 assert.equal(acceptedPRs.length,41);
 assert.equal(mergedAt.length,41);
 assert.equal(ORIGINAL_GLSL_PROVENANCE.length,41);
 assert.equal(TRANSITION_CATALOG.length,41);
 for(let i=0;i<41;i++){
  assert.equal(ORIGINAL_GLSL_PROVENANCE[i].selectedOrder,i+1);
  const date=Date.parse(mergedAt[i]);
  assert.ok(Number.isFinite(date),'Unknown original PR merge time for effect '+(i+1));
  if(i){
   assert.ok(acceptedPRs[i]>acceptedPRs[i-1],
    'Original transition PR numbers must be strictly increasing in gallery order');
   assert.ok(date>Date.parse(mergedAt[i-1]),
    'A later effect was merged before an earlier original GLSL was accepted');
  }
 }
});

test('master checklist is the only acceptance tracker and records each PR with independent visual evidence',async()=>{
 const markdown=await readFile(fileURLToPath(checklist),'utf8');
 const ci=await readFile(fileURLToPath(workflow),'utf8');
 const all=markdown.split(/\r?\n/).filter(line=>/^- \[[ x]\] \*\*\d{1,2}\. /.test(line));
 assert.equal(all.length,83,'Never split/duplicate/lose numbered master requirements');
 const keys=new Set();
 const rows=new Map();
 for(const line of all){
  const match=line.match(/^- \[([ x])\] \*\*(\d{1,2})\. ([^*]+)\*\* —/);
  assert.ok(match,'Unparseable master checklist line: '+line.slice(0,70));
  const n=Number(match[2]);
  assert.ok(!keys.has(n),'Duplicate master item '+n);
  keys.add(n);rows.set(n,{line,done:match[1]==='x',title:match[3]});
 }
 for(let n=1;n<=83;n++)assert.ok(keys.has(n),'Missing master item '+n);
 for(let i=0;i<41;i++){
  const n=i+1,entry=rows.get(n),pr=acceptedPRs[i];
  assert.equal(entry.done,true,'Original shader #'+n+' cannot lose individual visual acceptance');
  assert.match(entry.title,/GL TRANSITION/,
   'Original selected source order was changed at #'+n);
  const prLinks=[...entry.line.matchAll(/https:\/\/github\.com\/cinaedvsstudios\/Organon\/pull\/(\d+)/g)];
  assert.equal(prLinks.length,1,
   'Original shader #'+n+' must cite EXACTLY its own accepted PR, not a bulk completion');
  assert.equal(Number(prLinks[0][1]),pr,
   'Original shader #'+n+' must retain its individually merged PR');
  assert.match(entry.line,/original|upstream|GLSL/i,
   'Original shader #'+n+' must explain source fidelity');
  assert.match(entry.line,/real|Chrome|GLSL|GPU/i,
   'Original shader #'+n+' requires real shader proof, not implementation availability');
  assert.match(entry.line,/MP4|H.?264|export/i,
   'Original shader #'+n+' requires encoded-video acceptance evidence');
  assert.match(entry.line,/test|browser|pixel|GPU/i,
   'Original shader #'+n+' requires actual visual test evidence');
  assert.match(entry.line,/https:\/\/github\.com\/cinaedvsstudios\/Organon\/actions\/runs\/\d+/,
   'Original shader #'+n+' must link its own recorded QA run');
  const mod=ORIGINAL_GLSL_PROVENANCE[i].module.toLowerCase();
  assert.match(ci,new RegExp('node tools/audio-timeline/tests/'+mod+'\\.browser\\.mjs'),
   'Original '+mod+' GPU qualification must remain scheduled');
  assert.match(ci,new RegExp('node tools/audio-timeline/tests/'+mod+'-export\\.browser\\.mjs'),
   'Original '+mod+' H264 export qualification must remain scheduled');
 }
 assert.ok(!/\b102\/102\b/.test(rows.get(46).line),
  'Master process rule should distinguish visual acceptance from historical implementation totals');
 // A future unchecked item must never be interpreted as completed from the
 // aggregate progress heading or the historic green CI implementation suite.
 const pending=[...rows.entries()].filter(([n,row])=>n>=47&&!row.done);
 assert.ok(pending.length>0,'Unverified overlays and export tasks need explicit individual acceptance');
 console.log('[MotoriClip #46] PASS 41 individually merged PRs in original order, dated 20–22 Nov 2026; one master checklist, exact PR/CI per effect, active GPU + H264 tests and open later items');
});