# MotoriClip Phase 8G — Card swipe, Camera shake and VHS tracking

**Date:** 19 November 2026 (Berlin)  
**Status:** Pending PR CI verification. This phase follows 8F.

## Library and visual effect specification

The user's complete initial shortlist remains **41 effects** with original names, spelling and IDs. This batch adds three distinct original Canvas implementations: **16 enabled / 25 queued**.

- **Card swipe** — the incoming Video B slides as a solid rectangular card from the right edge toward the left, with a narrow pale edge and dark shadow separating it from outgoing A. The incoming picture remains undistorted. At the end of the overlap, the renderer returns to a clean full-resolution B frame.
- **Camera shake** — during the first half, outgoing A is shown with deterministic whole-frame horizontal and vertical judder; during the second half, incoming B is shaken. A brief white flash accompanies the switch. The jitter envelope returns exactly to zero at both boundaries, so there is no jump after the effect. Source clips remain unmodified.
- **VHS tracking** — the incoming B image appears in 24 horizontal strips with deterministic lateral offsets, a timestamp-seeded rolling cyan tracking bar and faint lavender scanlines. The tracking distortion and line intensity decay toward a clean B at the end. It is deliberately visually distinct from the existing Glitch flicker effect.

These effects reproduce the user-selected **effect categories**, not an exact pixel-by-pixel copy of a third-party GL shader.

## Editing and rendering integration

Use **Select mode → select Video A and Video B → Pair Video A → Video B**; choose an effect and overlap duration, then apply. The existing paired timeline placement, upper-lane compositing, gold transition region marker, inspector effect name, unlink and Undo/Redo behavior are preserved.

All three effects use the same `AdvancedMediaEngine.renderFrame()` compositor for real-time previews and fixed-frame exports. They reuse the existing transition full-frame scratch canvas, without introducing per-effect persistent full-HD buffers. The effect result depends on the original media and deterministic timeline timestamp; re-scrubbing the same time produces the same frame. The regular clean renderer takes over at 100% progress.

This increment does not change clip trims, source files, audio, existing volume settings, the 120-second export limit or Basic mode. It does not implement linked-audio crossfades or alpha-capable output files. Physical Windows/Android checks remain separate; Apple-specific certification is not a blocker.

## Acceptance

1. **Node:** Original 41 names intact, 16 implemented / 25 selected for later. Card moves monotonically from right to left; camera offsets are timestamp-reproducible, bounded and return to exactly zero; VHS band offsets are stable, bounded and diminish. Non-destructive pair-planner and clip history metadata remain correct.
2. **Real Chrome pixels:** Beginning shows A and final shows unmodified B. Mid-card has large visible regions of both. Shaking A appears during early half and shaking B during late half. VHS exhibits independently distorted stripes and mixed analog scanline pixels unlike the existing Glitch flicker. Same timestamp gives same pixels after scrubbing.
3. **End-to-end editor:** Two real generated MP4 clips, all 16 options in the Project inspector, gold marker and effect-specific label, Undo/Redo.
4. **Complete CI:** Existing Node suite, browser compatibility, full fixed-frame MP4/WebM export tests, 60s/120s near-limit checks, 120-second 1080p 16-clip MP4, and repeated-export memory recovery must pass before merge.

**Release status:** Awaiting all green CI.
