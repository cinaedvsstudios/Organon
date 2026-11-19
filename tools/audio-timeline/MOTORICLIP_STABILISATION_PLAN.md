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
- **Phase 6C — fixed-timestamp export beta:** Merged in [PR #32](https://github.com/cinaedvsstudios/Organon/pull/32) (commit `b82bd2ba738cdb1b59ccff34bf323be561915367`). A separate, opt-in Mediabunny/WebCodecs exporter creates a fixed frame-grid sequence with offline audio mix, cancellation and guarded browser support. The original live recorder remains available. [Phase 6C QA](./MOTORICLIP_PHASE6C_QA.md). **Not release-certified; real media and browser testing still pending.**
- **Phase 6D — first real-media acceptance:** Merged in [PR #34](https://github.com/cinaedvsstudios/Organon/pull/34) (commit `ad644c74d967e75242783cb69051d7146161ab18`). Automated Chrome + FFmpeg E2E exports of a 4-second multitrack project **passed for WebM (VP9/Opus) and MP4 (H.264/AAC)** with 100 real frames, background/video timing and audio-gap tests. An AAC WASM fallback is dynamically loaded where browsers lack native encoding. [Phase 6D QA](./MOTORICLIP_PHASE6D_REAL_MEDIA_QA.md).
- **Phase 6E — HD/FHD and stress export QA:** [PR #35](https://github.com/cinaedvsstudios/Organon/pull/35) adds an expanded real-Chrome/FFmpeg matrix covering 720p at 24/60fps, 1080p at 30fps, and 10/25-clip projects. All five actual encoded outputs passed frame counts, durations and sampled video-order checks; timed audio boundaries, real cancellation/retry and corrupt-media recovery also passed in [GitHub Actions run 44143534849](https://github.com/cinaedvsstudios/Organon/actions/runs/44143534849). [Phase 6E QA](./MOTORICLIP_PHASE6E_QA.md).
- **Phase 6F — UI launch, genuine VFR and transparent layering QA:** Merged in [PR #36](https://github.com/cinaedvsstudios/Organon/pull/36) (commit `28ceb8c3b44d695e15797be702a6f483015ce223`). Real Chrome tests verified default desktop Advanced/mobile Basic routing, mode switching, file import, Clear/Undo/Redo, canvas/FPS/zoom controls, genuine VFR source resampling and blue-over-red opacity with a transparent PNG. Fixed a startup `addEventListener` exception by restoring missing Audio Fade In/Out HTML controls. [Phase 6F QA](./MOTORICLIP_PHASE6F_QA.md).
- **Phase 6G — longer moving-footage and memory profiling:** [PR #37](https://github.com/cinaedvsstudios/Organon/pull/37) adds 18-second 1080p MP4 with 8 moving clips and 30-second 720p WebM with 25 moving clips. Both real encodes passed frame/audio/output checks in [GitHub Actions 44153464101](https://github.com/cinaedvsstudios/Organon/actions/runs/44153464101). Sampled peak Chrome proportional memory (PSS) was approximately **1,034 MiB** and **1,046 MiB** respectively, with considerable browser memory retained afterward; this is not yet a proven leak. [Phase 6G QA](./MOTORICLIP_PHASE6G_QA.md).
- **Phase 6H — repeat-export memory recovery:** [PR #38](https://github.com/cinaedvsstudios/Organon/pull/38) verifies four consecutive real 720p/25fps WebM exports in the same Chrome tab, each containing 200 decoded frames and working audio. Chrome PSS after each export and GC rose from 564.7 to 759.6 to 859.8 MiB before plateauing at 858.6 MiB. After project teardown PSS remained ~860 MiB, but **closing the tab/context reduced it to 306.2 MiB**, below the 362.6 MiB baseline. No persistent browser-wide leak was established; renderer retention and longer-session behavior still need characterization. All stages passed in [GitHub Actions 44155884385](https://github.com/cinaedvsstudios/Organon/actions/runs/44155884385). [Phase 6H QA](./MOTORICLIP_PHASE6H_QA.md).
- **Phase 6I — multi-engine UI and phone-like media formats:** [PR #39](https://github.com/cinaedvsstudios/Organon/pull/39) adds a separate Playwright Firefox/Linux WebKit UI job plus Chrome tests with synthetic QuickTime portrait MOV and 90° rotation-tagged MP4. Firefox and WebKit Advanced/Basic desktop/phone-user-agent UI tests passed. Firefox reported VP9 encoder configuration support; **WebKit export remains unverified** and had no `MediaRecorder` in the Linux runner, although basic WebCodecs APIs existed. Both phone-style outputs passed 720×1280, 75-frame H.264/AAC rotation/audio/movement assertions in [Chrome CI 44225296879](https://github.com/cinaedvsstudios/Organon/actions/runs/44225296879); cross-browser UI passed in [CI 44225657213](https://github.com/cinaedvsstudios/Organon/actions/runs/44225657213). [Phase 6I QA](./MOTORICLIP_PHASE6I_QA.md).
- **Phase 6J — real Firefox export, WebKit audio compatibility:** [PR #40](https://github.com/cinaedvsstudios/Organon/pull/40) extended the real fixed-frame E2E test to Firefox; a 100-frame/4.02-second VP9/Opus WebM passed its actual video-colour and audio-gap checks. Linux WebKit encoded short video-only WebM correctly but its actual H.264/AAC and VP9/Opus outputs were **silent despite a nonzero browser audio mix**, according to FFmpeg. A targeted guard now prevents **audible** exports on Linux-platform WebKit, even though the Playwright engine advertises a macOS Safari user-agent; the original live recorder remains untouched. Added best-effort decoded-output audio checking with the explicit limitation that WebKit's in-browser decoders did **not** detect its own silent files. [Phase 6J QA](./MOTORICLIP_PHASE6J_QA.md).
- **Phase 6K — near-limit Chrome export + memory QA:** [PR #41](https://github.com/cinaedvsstudios/Organon/pull/41) adds test-only real 60-second 1080p MP4 (1,800 frames) and 120-second 720p WebM (3,000 frames) compositions with late audio and trailing-silence checks. It records process-tree PSS before/during/after export and post-GC without treating a single memory number as a leak verdict. Linux Chrome CI **passed** in [GitHub Actions 44439211155](https://github.com/cinaedvsstudios/Organon/actions/runs/44439211155), with 1,800 decoded 1080p frames and 3,000 decoded 720p frames; early/late sound and trailing silence also passed. Peak Chrome PSS was roughly 1,091/1,100 MiB, with roughly 907 MiB after idle GC in both cases (observational, not proof of no leaks). The **120-second beta cap remains unchanged**. [Phase 6K QA](./MOTORICLIP_PHASE6K_QA.md).
- **Phase 6L — full beta-cap 1080p export and native-memory recovery:** Merged in [PR #42](https://github.com/cinaedvsstudios/Organon/pull/42) (commit `c6dcd247b46bb99ea95ccc1fe0f056a694fe6ef9`). [GitHub Actions 44444292206](https://github.com/cinaedvsstudios/Organon/actions/runs/44444292206) passed a real **120-second 1080p H.264/AAC MP4, 3,600 decoded frames** with 16 moving clips, linked audio, transparent sticker and background. The file was 73.08 MiB with valid early/late audio and a silent trailing gap. Chrome process PSS peaked at 1,194 MiB, stayed about 949 MiB after GC while the context remained open, and declined to **307 MiB** after closing the context. The 120-second beta cap and production exporter remained unchanged. [Phase 6L QA](./MOTORICLIP_PHASE6L_QA.md).
- **Automated testing:** The previous **91/91** Node regression cases plus four added audio-integrity/platform-guard tests, real Chrome/Firefox exports, mobile-layout routing, 720p and 1080p full-duration exports, repeated-export recovery and portrait-media handling. The final Phase 6L PR CI passed in both jobs. Physical Windows/Android camera-media testing remains unverified; no new Apple/Safari certification is planned.
- **Next — Phase 7 and transitions:** Automated Chrome/Firefox and emulated mobile UI validation has passed through the full 120-second 1080p beta cap. Physical **Windows and Android** real-camera smoke tests remain advisable before calling the release broadly hardware-certified; they have not been performed in CI. **Safari/macOS/iOS certification is explicitly out of scope**, not a prerequisite for transition work. Confirm the remaining manual Chrome/Android baseline behaviours, then begin clip-to-clip and transparent upper-layer transitions in small tested increments. The two-minute export beta cap remains.

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

## Phase 8A — first editable visual fade transitions [MERGED]

[PR #43](https://github.com/cinaedvsstudios/Organon/pull/43) merged on 19 November 2026 after all three jobs passed in [GitHub Actions 44448320745](https://github.com/cinaedvsstudios/Organon/actions/runs/44448320745). **101/101 Node tests** passed, including six new transition cases; Chrome real-canvas pixel comparisons confirmed the blue Video A / red Video B alpha blend across entrance and exit. All preexisting Firefox, Chrome, and 120-second export tests passed, including 1080p MP4.

- Advanced Inspector: per-video **visual fade in/out** duration and linear/smooth curves, with blue **Video A**, gold transition, and red **Video B** schematic.
- Timeline: gold markers for the selected clip's active fade extents, without blocking existing drag/trim handling.
- Rendering: shared video alpha envelope for paused preview, live rendering, PNG snapshots, and fixed-timestamp export. Defaults are zero-length, so old clips keep their existing appearance.
- History: transitions persist through undo/redo and duplication; splitting retains the original entrance on the left and exit on the right without adding accidental interior fades.
- **Not yet implemented:** automatic pairing/overlap, additional wipe effects and directions, draggable transition markers, transition library, or transparent-alpha **output-file** export. Only transparency **inside the composited image** is implemented at this stage.
- Safari/Apple certification remains out of user-requested scope. Physical Windows/Android device acceptance remains separate.

[Phase 8A QA](./MOTORICLIP_PHASE8A_QA.md).

## Phase 8B — paired A→B Fade and selected-effects catalog [MERGED]

[PR #44](https://github.com/cinaedvsstudios/Organon/pull/44) merged 19 November 2026 (commit `4a6e55050f083f29ff4c38e3ec49298ad713ea6c`). [GitHub Actions run 44454652162](https://github.com/cinaedvsstudios/Organon/actions/runs/44454652162) passed **all three CI jobs**, including **108 Node tests**, the real Chrome two-video import/pair/Undo/Redo/gold-marker test, Firefox browser checks, and the complete full-duration 1080p export/memory matrix.

- **Selected transition catalog, first batch:** The user's **41 GL Transitions gallery selections** from pages 1–10 are kept in original order and spelling in `js/transition-catalog.mjs`. Only Fade is marked available. The other 40 are visibly queued, not falsely represented as working. The list is designed to grow when the user chooses more effects later.
- **First automatic clip-to-clip transition:** Select two loaded video clips using Select mode. Choose Fade and an overlap duration in the Project Inspector. The planner aligns the beginning of Video B with the final portion of Video A; it gives B an upper lane when required for compositing/collision safety. B fades in over A to avoid an unintended dark midpoint. Gold markers show the fade.
- **Persistence and editing:** Pair metadata survives Undo/Redo. The Unlink control removes the relationship without destroying the chosen overlap or fade. Outdated pair metadata is invalidated when clips change. Sources and existing embedded audio remain unmodified; there is **no automatic audio crossfade** in 8B.
- **Export:** Preview, PNG and export use the same established compositing path. Full two-minute 1080p H.264/AAC export regression passed after the change.
- **Still to implement:** The remaining 40 selected effects (wipes, dissolves, distortions, glitches, etc.), an effect engine and optional reusable presets, stronger transition-clip editing UX and draggable markers, automatic audio crossfades where requested, and separately validated alpha-capable output if needed. No Apple/Safari certification requirement.

[Phase 8B QA](./MOTORICLIP_PHASE8B_QA.md).

## Phase 8C — first three additional visual transitions [MERGED]

[PR #45](https://github.com/cinaedvsstudios/Organon/pull/45) merged 19 November 2026 at `de0cb83838f2469bea7a8cffa89845fe6e358cb4`, after all three [GitHub Actions jobs 44457748582](https://github.com/cinaedvsstudios/Organon/actions/runs/44457748582) passed (**114/114 Node tests**, real Chrome effect pixels/paired UI, Firefox, 1080p full-duration MP4, memory and portrait-media regressions).

- **Four available paired effects:** Fade (8B), plus **Pixelize**, **Random squares** and **Glitch flicker** (8C).
- **Pixelize:** B is revealed with shrinking pixel blocks; returns to a clean source frame at completion.
- **Random squares:** A deterministic 14×8 tile mask reveals fully opaque areas of B over A, with no global-alpha darkening. Browser samples at midpoint: **708 red / 664 blue / 0 blended**.
- **Glitch flicker:** Deterministic horizontal strip offsets and intermittent dropouts, reducing to an undistorted incoming B; reverse scrubbing and export generate identical frames at the same time.
- **No regression to previous fades:** Visual effects use the shared compositing renderer with independent clip opacity and exit fades; the separate clip files and linked audio are not rewritten. Two scratch canvases are reused and explicitly released during project clear.
- **Remaining user selections:** The wishlist stays at **41 total / 4 available / 37 queued**, so the user can add more names after browsing the rest of the GL Transitions gallery.
- **Upcoming increments:** More selected effects and optional per-effect parameter controls, stronger transition clip timing UX and presets. No claim of exact shader copying or transparent-alpha export, and no Apple-specific certification work required.

[Phase 8C QA](./MOTORICLIP_PHASE8C_QA.md).

## Main source files

- [Basic entry/launcher](https://github.com/cinaedvsstudios/Organon/blob/main/tools/audio-timeline/index.html)
- [Advanced interface](https://github.com/cinaedvsstudios/Organon/blob/main/tools/audio-timeline/advanced.html)
- [Advanced controller](https://github.com/cinaedvsstudios/Organon/blob/main/tools/audio-timeline/js/advanced-main-v0.24.js)
- [Advanced playback/render engine](https://github.com/cinaedvsstudios/Organon/blob/main/tools/audio-timeline/js/advanced-media-engine-v0.24.js)
- [Advanced timeline UI](https://github.com/cinaedvsstudios/Organon/blob/main/tools/audio-timeline/js/advanced-timeline-v0.24.js)
- [Basic export implementation](https://github.com/cinaedvsstudios/Organon/blob/main/tools/audio-timeline/js/exporter.js)
