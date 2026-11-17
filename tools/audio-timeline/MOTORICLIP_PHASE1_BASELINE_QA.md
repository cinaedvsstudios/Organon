# MotoriClip Phase 1 — Baseline test inventory and findings
Date: 2026-11-17
Baseline: Advanced v0.24, before Phase 2 scheduling changes (main branch at the start of this work).
Testing scope: Advanced is the desktop default; Basic is retained for phones. Do not mix planned transition functionality into the baseline tests.

## What was actually verified

- **Source audit — performed:** Existing HTML and JavaScript, from Organon GitHub. Relevant files: `advanced.html`, `js/advanced-main-v0.24.js`, `js/advanced-media-engine-v0.24.js`, `js/advanced-timeline-v0.24.js`, `index.html`, and the Basic exporter.
- **Automated playback tests — performed on the Phase 2 branch:** Pure boundary/scheduling tests and a mock-media integration exercise of the Advanced engine, including delayed clips, overlaps, source offsets, clip endings, seeking and stopping.
- **Interactive browser/video tests — not performed:** This environment cannot load local test media into the deployed editor or control its browser UI. Do **not** treat the cases below as passed until they are exercised with real files.

## High-priority baseline findings from code review

| ID | Finding | Source | Phase |
|----|---------|--------|-------|
| B01 | Playback only starts clips active at Play press; later-starting clips never explicitly begin | `AdvancedMediaEngine.play()` and `startRenderLoop()` | 2 |
| B02 | A starting gap (no video/audio at t=0) blocks Play even if media is later | `AdvancedMediaEngine.play()` | 2 |
| B03 | Paused/scrubbed preview may draw the previous decoded frame because `currentTime` is set without awaiting `seeked` | `AdvancedMediaEngine.seek()` | 3 |
| B04 | Frame stepping assumes 30 fps regardless of project/source | `AdvancedMediaEngine.stepFrame()` | 3 |
| B05 | Undo/redo snapshots copy browser media elements, audio nodes and URLs along with timeline metadata | `captureHistorySnapshot()` / `restoreHistorySnapshot()` | 4 |
| B06 | Some removal paths filter the track array without disposing media objects | `deleteSelectedTracks()` / `removeLayerFromContext()` | 4 |
| B07 | Visual and linked sound each use separate media elements and sequential starts in the original engine | `loadTrack()` / original `play()` | 2 and 5 |
| B08 | Advanced exports composite PNG but has no wired finished-video export | `AdvancedMediaEngine.snapshot()` and `advanced.html` | 6 |
| B09 | The overlap resolver moves video clips to another lane on collision (existing deliberate behaviour; no transition model yet) | `resolveVideoOverlap()` | Post-stabilization |
| B10 | Basic has a live `MediaRecorder` exporter, separate from Advanced | `js/exporter.js` | 6 |

These are code-review findings, not claims that every issue was reproduced interactively.

## Test assets needed for interactive QA

Prepare disposable, short local files:
1. `one.mp4` — 6s, 1280×720, 30 fps, audible speech or clear clicks;
2. `two.mp4` — 5s, visibly different frame colours, audible second sound;
3. `silent.mp4` — 4s, video without audio;
4. `music.wav` or `music.mp3` — 12s audible audio;
5. `background.jpg` — 1280×720 distinctive still;
6. `overlay.png` — transparent PNG with visible central object;
7. optional: a 24-fps MP4 and a 60-fps MP4 for frame stepping.

Use an empty project for each isolated test.

## Interactive QA checklist

| ID | Operation and expected result | Status |
|----|-------------------------------|--------|
| Q01 | Hub opens MotoriClip Advanced on desktop | Pending live browser |
| Q02 | Phone opens MotoriClip Basic; manual Advanced switch works | Pending live browser |
| Q03 | Advanced > Basic does not redirect back to Advanced | Pending live browser |
| Q04 | Import video, audio, JPEG and PNG to Project Files (not automatically timeline) | Pending live browser |
| Q05 | Drag a Project File to the timeline and play it | Pending live browser |
| Q06 | Start video 1 at 3s, video 2 at 7s, with a full-length background | Engine simulation passed; browser pending |
| Q07 | Play from zero through gaps and both clips without another Play press | Engine simulation passed; browser pending |
| Q08 | Seek into the middle of the second clip, then resume with correct source offset | Engine simulation passed; browser pending |
| Q09 | Two videos on different lanes overlap visually according to layering | Scheduling test passed; visual browser pending |
| Q10 | Linked audio follows its video and mute/volume settings | Scheduling tested; audible browser pending |
| Q11 | Split a video at playhead, trim right edge and drag the new clip | Pending live browser |
| Q12 | Video clip snapping to adjacent boundaries is accurate | Pending live browser |
| Q13 | Group, duplicate and delete selections | Pending live browser |
| Q14 | Undo/redo restore edits *and usable sources* | Pending live browser; code concern B05 |
| Q15 | Set audio fade-in/out and verify changes audibly | Pending live browser |
| Q16 | Image background + transparent PNG overlay composite correctly | Pending live browser |
| Q17 | Video opacity and blend mode affect preview as expected | Pending live browser |
| Q18 | Pause/scrub/step around a cut; no stale frames shown | Pending live browser; B03 |
| Q19 | PNG snapshot matches exactly the paused composited frame | Pending live browser; B03 |
| Q20 | Change output resolution and preview zoom; canvas preserves aspect | Pending live browser |
| Q21 | Clear project; media elements stop; new import/play still works | Pending live browser; B06 |
| Q22 | Unsupported codec gives actionable error rather than hanging | Pending live browser |
| Q23 | Basic mode preview and legacy export work unchanged | Pending live browser |
| Q24 | Compare playback on laptop Chrome/Edge and Android Chrome | Pending devices |

## Regression bar for Phase 2

- Playback from t=0 advances correctly even if media begins later or only still images exist.
- Each clip's video and audio start when the playhead enters its interval, and stop at the end.
- Seeking while playing restarts the correct active clips.
- Overlaid tracks schedule independently.
- No later-starting clip requires another Play press.
- Timeline completion automatically stops active players.

Run automated tests with `node --test tools/audio-timeline/tests/*.test.mjs` from the repository root (Node 22+ recommended), and then complete the pending interactive cases before treating the stabilization release as verified.
