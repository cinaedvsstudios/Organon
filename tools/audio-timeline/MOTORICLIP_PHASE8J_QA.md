# MotoriClip Phase 8J — Cell dissolve, Bloom dissolve, Smoke dissolve

**Date:** 19 November 2026 (Berlin)
**Status: MERGED AND VERIFIED.** [PR #52](https://github.com/cinaedvsstudios/Organon/pull/52) merged on 19 November 2026 at `783c19a2a78e3fffb36460768832d01af48e7fa1`.

## Selected effects and behavior

Three more effects from the user's original 41-item GL Transitions selection become available through **Pair Video A → Video B**. This brings the library to **25 available and 16 queued**. The selection names, spelling and order remain unchanged.

- **Cell dissolve:** Video B appears through 84 growing, slightly scattered, hexagon-shaped cells. Cells activate at stable pseudo-random offsets. Near the end, a short completing reveal joins their small gaps to leave B pristine. The cell shapes and smooth growth intentionally distinguish it from the existing Random squares mosaic and Ink bleed.
- **Bloom dissolve:** B fades into A alongside an overexposed highlight bloom. A blurred, brightened image of B is composited using screen blending and a warm radial light wash at the transition midpoint. The glow rises and falls smoothly to zero at each endpoint, leaving normal full-resolution B at completion. This is distinct from ordinary Fade.
- **Smoke dissolve:** Video B comes into view through 18 soft, translucent, pale-blue/grey drifting cloud puffs and their overlapping radial gradients. The clouds move forward as the transition progresses, rise and fade in the middle, and disappear at both ends. The clouds are deterministic functions of the timeline, unlike particle systems with random state.

These are original, non-shader Canvas 2D interpretations of the *effect names*, not exact copies or pixel-identical implementations of any third-party gallery preview.

## Editor, timeline, and export integration

The established Advanced mode workflow (Select two video clips → Pair Video A → Video B → choose effect and overlap duration → Apply) remains. It retains the existing upper-lane placement, gold timeline marker, inspector label, Unlink and Undo/Redo.

All new effects render directly through the shared `AdvancedMediaEngine.renderFrame()` path for preview and fixed-frame export. Cell dissolve uses one combined clipping path and draw; Bloom uses bounded screen-glow and blur drawing; Smoke uses at most 18 radial gradients. **No extra persistent full-resolution effect textures** or CPU image-data loops are introduced. Original media files, timeline trims, embedded audio and audio volume remain unmodified.

The 120-second export limit, Basic mode, unrelated visual fades and earlier transitions are unchanged. Linked-audio crossfades, alpha-bearing output videos, adjustable transition presets and physical Windows/Android device certification remain separate work.

## Acceptance criteria

1. **Node**: all 41 original wishlist entries, 25 available / 16 queued; stable and monotonic cell activation; bloom intensity rising to a peak at the midpoint and vanishing at the boundaries; deterministic forward-drifting smoke coordinates and intensity; non-destructive timeline pairing and Undo/Redo metadata.
2. **Actual Chrome Canvas**: two solid-color media inputs; previous A before transition and clean B afterwards; visible red/blue cell regions at midpoint with antialiased hex edges; Bloom must add a bright warm component and differ from Fade; Smoke must produce pale translucent clouds, remain different from Bloom, and produce identical pixels when seeking the same timestamp. Render all 25 effects without errors.
3. **Real Chrome Advanced editor**: import two generated MP4 files and apply all 25 paired choices, gold region marker, active effect names and Undo/Redo.
4. **Regression**: existing Node tests, Firefox and browser UI/export checks, 60-second 1080p and 120-second 720p near-limit exports, full 120-second 1080p H.264/AAC MP4 3,600-frame case, repeated-export memory recovery, portrait/rotated media files.

**Release QA: PASS.** [GitHub Actions run 44482881817](https://github.com/cinaedvsstudios/Organon/actions/runs/44482881817) completed **all three jobs successfully** (`transition-smoke`, `cross-browser-ui`, `export-browser`).

- **149/149 Node tests passed**, including the five new Phase 8J mathematical, deterministic and history invariants.
- **Actual Chrome pixel checks passed for all 25 effects.** At the midpoint, Cell dissolve sampled 746 incoming red, 496 outgoing blue, 130 antialiased mixed pixels; Bloom sampled a luminous center [230,101,177]; Smoke sampled a cloudy center [149,80,161]. All differed from previous effects and reproduced identical pixels at repeated timeline timestamps.
- **Chrome editor workflow passed:** imported two real MP4s, applied all 25 effects, verified the gold transition marker and effect label, and tested Undo/Redo.
- **Firefox and browser-compatibility tests passed.** The existing full 120-second 1920×1080/30fps H.264/AAC MP4 test successfully exported **3,600 frames from 16 moving clips**, at 73.06 MiB; Chrome PSS peak 1,233 MiB. Near-limit exports, repeated-export memory recovery and portrait/rotated-media checks also passed.
- Physical Windows/Android device certification, exact GLSL gallery reproduction, linked-audio crossfades and transparent-alpha output remain outside this phase.

**Merge rule:** All three GitHub Actions jobs must pass; no unsupported claim of physical device verification.
