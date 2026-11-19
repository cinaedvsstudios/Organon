# MotoriClip Phase 8D — Ripple, TV turn off and Aperture wipe

**Date:** 19 November 2026 (Berlin)
**Status: MERGED AND VERIFIED.** [PR #46](https://github.com/cinaedvsstudios/Organon/pull/46) merged 19 November 2026 at `66baa957a036a655d10180c3bc90264d17482e80`. [GitHub Actions run 44460226642](https://github.com/cinaedvsstudios/Organon/actions/runs/44460226642) passed all three jobs (`transition-smoke`, `cross-browser-ui`, `export-browser`).

## Catalog and scope

The user's initial **41 GL Transitions selections** remain in their original order, spelling and IDs. Three more are enabled for the existing Advanced **Pair Video A → Video B** control:

- **Ripple:** Incoming Video B emerges through a growing center-out radial wavefront, with a gently oscillating edge and two faint concentric ripple traces. Outside the wavefront, Video A stays visible. This is a clean Canvas 2D effect rather than a copy of any GLSL shader.
- **TV turn off:** Video A vertically contracts into a central scanline over a black screen. The midpoint flashes a brief white line, after which Video B expands from the centerline to fill the screen. Both media sources retain their normal trim and playback positions; only the rendered composition is affected.
- **Aperture wipe:** A clean circular iris expands from the center to the farthest corner, revealing Video B over A without a global crossfade or darkened midpoint.

Together with Fade, Pixelize, Random squares and Glitch flicker, the library now has **7 available effects and 34 queued**. The library's availability paragraph is generated from the same effect catalog as the dropdown, so later batches do not need hand-edited counts.

These are independently authored Canvas 2D implementations of the selected *effect types*. They are not pixel-identical reproductions of gallery previews or copies of third-party shader code.

## Render, editing and export behavior

- All seven effects use the same validated pair-planner, source-preserving timeline overlap, higher-lane placement where needed, gold transition markers, Undo/Redo and Unlink behavior.
- New effects are rendered inside `paintPairedEffect` in the existing shared preview/export compositor, with non-destructive media and unchanged linked audio.
- Ripple and Aperture use bounded circular paths and do not allocate extra full-HD scratch canvases.
- TV turn off reuses the existing bounded, full-size per-renderer transition scratch canvas; project clear releases the texture.
- Frame appearance depends only on requested timestamp, clip media and effect metadata. Reverse scrubbing and fixed-timestamp exports use the same deterministic calculations.
- The existing individual visual fade and exit controls remain independent. A valid spatial pair bypasses only Video B's *entrance fade alpha* while the spatial effect is active, then returns to ordinary clean video at 100% progress.
- The existing 120-second 1080p export limit remains unchanged. No automatic audio crossfade, true-alpha video-file export or special Safari testing is included.

## Acceptance checks

1. Node tests: seven available effect IDs, 34 queued entries, pair planning/history preservation, aperture radius monotonicity, deterministic and angle-dependent ripple wavefront, and symmetric CRT collapse/expansion.
2. Real Chrome pixel tests: blue A underneath red B; start is only A; Aperture/Ripple reveal B at the center while A remains outside; Ripple and Aperture produce visibly different middle frames; TV first collapses A over black, displays a white scanline at midpoint, then expands B over black. Repeating the same timestamp returns identical pixels; final output resolves to clean B.
3. Real Chrome end-to-end editor: two imported MP4 files, selecting and applying all seven effect choices, gold timeline marker, pair inspector label and Undo/Redo.
4. Existing Node, Firefox and real-media export regressions must remain green, including the 120-second 1080p MP4 memory stress check.

**Verification result:** PASS, all three jobs green.
- **119/119 Node tests passed**, including all prior suites and five Phase 8D mathematical/metadata tests.
- **Actual Chrome canvas tests passed** for all seven effects: Ripple and Aperture displayed B within the radial reveal while preserving A outside; their midframe pixels differed; TV turn off collapsed A to a mostly black frame with a white scanline and expanded B back to full frame; same-time rerendering matched exactly.
- **Chrome Advanced end-to-end UI test passed:** two real imported MP4s, all seven paired effects, gold timeline marker, dynamic 7 available / 34 queued status, Undo/Redo.
- **Firefox and existing real-media tests passed.** The unchanged full 120-second **1920×1080/30fps H.264/AAC MP4** scenario encoded 3,600 frames with 16 moving clips, and the runner also passed the existing audio, memory-recovery and portrait-video checks.
- No physical Windows/Android device validation or exact gallery shader reproduction is claimed.

**Merge rule:** All CI jobs green before merging. Physical Windows/Android device testing remains a separate release check.
