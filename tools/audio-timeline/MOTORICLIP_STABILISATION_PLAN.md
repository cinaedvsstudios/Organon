# Organon MotoriClip — Stabilisation plan before new features

**Date:** 17 November 2026 (Berlin)  
**Repository:** https://github.com/cinaedvsstudios/Organon  
**Current engine:** Advanced v0.24; Basic editor retained for mobile  
**Scope:** Stabilise the **existing** application before adding transitions, transition designer, JPEG options, or other new effects.

## Implementation status — 17 November 2026

- **Phase 0:** MotoriClip branding and desktop-Advanced/mobile-Basic routing committed; live device QA remains open.
- **Phase 1:** Source audit and reproducible real-media browser QA inventory documented in [MOTORICLIP_PHASE1_BASELINE_QA.md](./MOTORICLIP_PHASE1_BASELINE_QA.md).
- **Phase 2:** Timeline playback scheduling merged in [PR #26](https://github.com/cinaedvsstudios/Organon/pull/26) (commit `68c8724890a54b6eba630012bb3db35e62916ce8`).
- **Phase 3:** Paused frame-seeking, latest-scrub cancellation, project FPS stepping and PNG capture fixes merged in [PR #27](https://github.com/cinaedvsstudios/Organon/pull/27) (commit `d56316ad9e0b42c010330b0d9de3172bdfd75d25`).
- **Phase 4:** Undo/redo metadata isolation, cached File source IDs, efficient live-media restoration, automatic media disposal and abortable pending file loads merged in [PR #28](https://github.com/cinaedvsstudios/Organon/pull/28) (commit `c40fc220c40885a1515d157747ca6180ae325af6`). [Phase 4 QA report](./MOTORICLIP_PHASE4_QA.md).
- **Phase 5:** Single-player linked picture/sound, Web Audio routing, resilient media decoding/error reporting, safe media-edit failure handling and canvas layering fixes merged in [PR #29](https://github.com/cinaedvsstudios/Organon/pull/29) (commit `226511bb80ef0ccb272263d17f12076c314b4d6f`). [Phase 5 QA report](./MOTORICLIP_PHASE5_QA.md).
- **Phase 6A — preview performance:** Cached layer ordering and bounded static keyed-sticker processing merged in [PR #30](https://github.com/cinaedvsstudios/Organon/pull/30) (commit `5f2862de8ac180041629d56b6f9442926aa733d2`). [Phase 6A QA](./MOTORICLIP_PHASE6A_QA.md).
- **Phase 6B — initial Advanced export:** Real-time canvas + Web Audio recording, browser-detected WebM/MP4 formats, progress, cancellation, error handling and cleanup merged in [PR #31](https://github.com/cinaedvsstudios/Organon/pull/31) (commit `15e87d26bef5a8026b02703c8980cdfd92772a90`). [Phase 6B QA](./MOTORICLIP_PHASE6B_QA.md). **This is not deterministic offline export.**
- **Automated testing:** 72/72 JavaScript simulated-media regression cases passed across Phases 2–6B (14 + 12 + 13 + 15 + 5 + 13). These do **not** replace outstanding real-browser/codec tests.
- **Next before Phase 7:** Real browser testing with 2/10/25 clips and actual exported 720p/1080p videos, measured frame/audio parity, and a deterministic WebCodecs/Mediabunny (or equivalent) export pipeline. Phase 6 remains **partially complete**; do not claim its release gate is passed or add transitions prematurely.

## Confirmed baseline and design constraints

- Keep internal ID `audio-timeline` and folder `tools/audio-timeline/` for existing bookmarks and imports.
- MotoriClip is the visible product name.
- Prefer **Advanced** on desktop and **Basic** on phones; `?mode=basic` explicitly opens Basic; Advanced mode has its own direct URL. The hub uses the existing `#audio-timeline` route.
- Preserve the Roman/Organon design language and existing timeline functionality.
- Keep Credits Roll, Artifex FX, Bubble Riser and Frame Extractor separate. Import their exported files as ordinary media.
- Perform each subsequent functional phase as a small, reviewable change, with regression checks before moving to the next. Avoid wholesale rewrites.

## Phase 0 — Branding and launch routing [COMMITTED; browser QA outstanding]

- [x] Change Organon tool label to **MOTORICLIP** in `tools.json`.
- [x] Change the Basic and Advanced HTML page titles and visible editor names.
- [x] Make the existing Basic index behave as the *device-aware launch entry point*: desktop redirects to Advanced; phones stay in Basic.
- [x] Change Advanced > Basic to `index.html?mode=basic` to prevent a desktop redirect loop.
- [x] Retain old paths and the manifest tool ID.
- [ ] Confirm the deployed GitHub Pages version and test desktop, Android phone, direct Basic link and manual mode switching.

**Changed files:** `tools.json`, `tools/audio-timeline/index.html`, `tools/audio-timeline/advanced.html`, `tools/audio-timeline/js/advanced-main-v0.24.js`.

**Gate:** The two editors are independently accessible, the hub opens the expected mode and an explicit manual switch never loops.

## Phase 1 — Freeze and test the v0.24 baseline (no functional feature work)

1. Preserve a known-good rollback point and prepare a repeatable set of test assets: two short video clips with sound, one silent video, one WAV/MP3 audio, one JPEG background and one transparent PNG.
2. Run import, drag-to-timeline, trim, split, duplicate, group, snap, opacity, blend, mute, fades, undo/redo, snapshot, canvas resizing and clearing on desktop.
3. Run the essential Basic workflow on a phone-sized/mobile browser.
4. Make a reproducible bug list with observable inputs, expected output and actual result; prioritise crashes, lost edits and incorrect playback over cosmetic issues.

**Gate:** Test cases and expected results exist before behaviour is changed.

## Phase 2 — Fix timeline playback and clip scheduling (highest priority)

**Code-review finding:** `AdvancedMediaEngine.play()` starts only media active when Play is pressed. `startRenderLoop()` redraws the canvas but does not activate later clips when the playhead crosses their start times. It can also reject playback when the first clip starts after time zero.

Work:
1. Use one reliable composition clock with explicit timeline states: stopped / playing / paused / seeking.
2. Start and stop each media element as it enters and leaves its timeline range; account for `start`, `clipDuration` and `sourceOffset`.
3. Handle initial blank intervals, gaps, background-only periods, overlapping upper/lower tracks and seeking into the middle of a clip.
4. Ensure playing, pausing and resuming do not restart clips at the wrong source time.
5. Ensure audio gain changes follow newly activated/deactivated clips.

**Gate:** A 12-second project with a full-length JPEG background and videos at 3–6 and 7–10 seconds plays both videos automatically from time zero, with the correct gaps and linked sound.

## Phase 3 — Frame-accurate seeking, scrubbing and snapshots

**Code-review finding:** `seek()` changes `HTMLMediaElement.currentTime` and calls `renderFrame()` without waiting for a decoded frame. `stepFrame()` assumes 30 fps.

Work:
1. Introduce an asynchronous frame-ready path using `seeked` and frame callbacks where supported; distinguish playback from still-frame requests.
2. Cancel/supersede stale requests during rapid scrubbing; prevent older decoding completions from overwriting the newest requested frame.
3. Track project output FPS, not a hardcoded 30 fps for every source/operation.
4. Make frame stepping and the existing PNG snapshot use the confirmed current composite.
5. Test near cuts, source trims, first/last frames, large input files and different frame rates.

**Gate:** Pausing and jumping to a specific time consistently shows the correct frame; PNG snapshots match the paused preview. JPEG snapshot is a *later enhancement*, not a prerequisite for this stabilization gate.

## Phase 4 — Undo/redo, editing integrity and media-resource cleanup [IMPLEMENTED; browser QA outstanding]

**Code-review findings:**
- `captureHistorySnapshot()` spreads entire live track objects, including browser media elements, object URLs and audio nodes. Such state is unsafe to restore as if it were durable data.
- Some remove/clear actions filter the track list without explicitly passing removed tracks through `detachTrack()`, risking hidden media elements and unreleased object URLs.
- The existing overlap rule automatically moves colliding videos to another lane. Preserve its present behaviour until transition requirements are implemented deliberately.

Work:
1. Separate serialisable clip metadata from runtime media objects and Web Audio nodes.
2. Rehydrate runtime resources correctly after undo/redo, including split and duplicate.
3. Centralise add/remove/clear/dispose operations so all media elements, URLs, worker objects and gain nodes are released once.
4. Make duration, `sourceOffset`, trim, split, grouping and selections consistent under undo/redo.
5. Add assertions for empty tracks, duplicate IDs, missing source files and invalid time ranges.

**Gate:** A user can split, move, duplicate, delete, undo and redo repeatedly with the correct video and audio still attached. Clear releases the project and importing again works without resource accumulation.

## Phase 5 — Audio, compositing and file handling consistency [IMPLEMENTED; browser QA outstanding]

1. Review linked audio: each video currently creates separate visual `<video>` and sound `<audio>` elements, which may drift if started or sought independently. Measure synchronization and fix the coupling.
2. Test audio fade-in/out, mute, extracted audio, parallel audio tracks and transitions across video clip boundaries (no *visual transition effects* yet).
3. Confirm background/visual/sticker layer ordering, image `fit/cover` rules, opacity and blend modes remain stable during play, scrub and snapshot.
4. Handle unsupported codecs and silent videos with meaningful errors rather than partial imports or stalled loading.
5. Keep hidden preview media muted where appropriate and prevent duplicated playback.

**Gate:** Audio stays synchronized with the visual timeline; output canvas composition remains consistent while editing and seeking.

## Phase 6 — Performance, responsiveness and baseline export [INITIAL IMPLEMENTATION; DETERMINISTIC EXPORT & REAL-MEDIA QA PENDING]

**Code-review finding:** Advanced mode currently offers PNG snapshots but no wired finished-video exporter. Basic mode uses a realtime `MediaRecorder` path, which is not the required deterministic Advanced export.

1. Profile 2-, 10- and 25-clip scenarios, import latency, scrubbing, memory, canvas redraws and large video files.
2. Avoid unnecessary decoding of inactive tracks and expensive per-frame work; cap/clean up caches.
3. Implement a **simple, reliable Advanced export first**, covering sequential clips, backgrounds and audio but *not* transitions.
4. Compare options for deterministic frame composition/encoding (Mediabunny/WebCodecs with supported codecs; FFmpeg.wasm where needed) and keep a browser-compatible fallback.
5. Add progress, cancellation, failure handling and test sample outputs for correct duration, resolution and audio.
6. Keep project saving/reopening as a separate baseline enhancement to design explicitly rather than mixing it into the playback rewrite.

**Gate:** Advanced mode can export a basic multi-clip project without skipped frames, a truncated timeline, lost audio or unexpected black gaps, and performance remains usable on supported target machines.

## Phase 7 — Release gate before new transition features

Regression checklist:
- Desktop opens Advanced; mobile opens Basic; manual switches work.
- Multiple video clips at nonzero timeline starts all activate and end correctly.
- Scrubbing and still capture show the requested frame.
- Clip edits and undo/redo retain the intended sources and timestamps.
- No stale hidden players keep running after deletion/clear.
- Audio mixing and linked video sound are synchronized.
- Simple finished-video export matches preview, at both 720p and 1080p where supported.
- Existing Basic mode remains operational.

**Only after this release gate:** Start the previously agreed transition work: blue Video A, red Video B, **yellow-gold** transition markers, automatic schematic inspector preview, clip-to-clip transitions, and transparent intro/outro transitions on upper layers.

## Main source files

- [Basic entry/launcher](https://github.com/cinaedvsstudios/Organon/blob/main/tools/audio-timeline/index.html)
- [Advanced interface](https://github.com/cinaedvsstudios/Organon/blob/main/tools/audio-timeline/advanced.html)
- [Advanced controller](https://github.com/cinaedvsstudios/Organon/blob/main/tools/audio-timeline/js/advanced-main-v0.24.js)
- [Advanced playback/render engine](https://github.com/cinaedvsstudios/Organon/blob/main/tools/audio-timeline/js/advanced-media-engine-v0.24.js)
- [Advanced timeline UI](https://github.com/cinaedvsstudios/Organon/blob/main/tools/audio-timeline/js/advanced-timeline-v0.24.js)
- [Basic export implementation](https://github.com/cinaedvsstudios/Organon/blob/main/tools/audio-timeline/js/exporter.js)
