# MotoriClip Phase 8L — Liquid fill, Disintegrate and Light rays

**Date:** 19 November 2026 (Berlin)
**Status:** PR validation pending; this phase must not be treated as released before CI completes.

## Original gallery shortlist

Three additional choices from the user's unchanged, original 41-name GL Transitions selection become available: **31 implemented and 10 queued**. These are distinct, original Canvas 2D interpretations of the effect categories, not copies or exact visual matches of third-party GLSL shaders.

- **Liquid fill:** Incoming Video B replaces A from the bottom upward beneath a steadily rising liquid surface. Two combined sinusoids produce the rippling boundary, animated deterministically by the frame timestamp, with a translucent pale-cyan waterline accent. The wave vanishes at the exact beginning/end boundaries, where A and B are clean.
- **Disintegrate:** Incoming Video B sits behind outgoing Video A as A breaks into a grid of 12×8 independent fragments. Each old-picture shard departs at a deterministic staggered time, moves up and sideways, and fades out, revealing more of B. It is not a static random-square reveal or a mosaic of cover tiles: the departing fragments retain pixels from the outgoing video until they disappear.
- **Light rays:** Video B emerges through 16 angular, independently widening radial wedges centered on the frame, accompanied by subtle gold-white beams of light. The wedge openings expand in a deterministic nonuniform sequence and resolve to the full clean B frame; unlike Rings or Spiral wipe, the reveal geometry is radial beam-shaped.

All three share the existing `AdvancedMediaEngine.renderFrame()` preview/snapshot/fixed-frame export path. Liquid and Light rays use bounded native Canvas clipping paths; Disintegrate reuses the renderer's existing full-frame scratch texture and 96 bounded tile draws. No additional persistent full-HD canvases or CPU pixel manipulation are added.

## Editor and integrity

The established Advanced mode Select two videos → **Pair Video A → Video B** controls are preserved, including overlap duration, lane placement, gold transition region, inspector effect name, Unlink and Undo/Redo. Source video files, trims, source offsets, audio settings and linked audio remain unmodified. The full 41 selected names, IDs and ordering remain stable; only genuinely implemented options are enabled.

No automatic linked-audio crossfades, alpha-bearing exported video, parameter presets or Apple certification are included. Physical Windows/Android device verification is a separate release check.

## Acceptance criteria

1. **Node:** stable 41-name list with 31 active / 10 queued; reproducibly wavy, rising liquid surface; staggered deterministic disintegration motion with old, moving and absent fragments at midpoint; widening staggered light wedges; unchanged source/audio and restorable Undo/Redo metadata.
2. **Chrome pixel tests:** actual pixels for all 31 choices. The moving liquid surface should leave A above while B fills below; Disintegrate must retain mixed old/new video regions with independently moving shards and differ from Random squares and Block cover; Light rays should produce gold-lit radial openings distinct from Spiral and Rings. All three should visibly show both A/B halfway through, return exactly identical images on same-time seek and display clean full-frame B at completion.
3. **Real editor UI:** import two generated MP4s, cycle all 31 available effect IDs, maintain correct inspector labels, visible gold region marker, Undo and Redo.
4. **Full export and compatibility regression:** all prior Node suites, Firefox/cross-browser UI and media checks, 60-second 1080p and 120-second 720p near-limit exports, the 120-second 1080p/30fps H.264/AAC MP4 (3,600 frames, 16 moving clips), portrait media and repeated-export post-GC memory recovery.

**Merge gate:** All three GitHub Actions jobs must finish green.
