# MotoriClip Phase 8M — ASCII, Color codes and Prisms

**Date:** 19 November 2026 (Berlin)
**Status: MERGED AND VERIFIED.** [PR #55](https://github.com/cinaedvsstudios/Organon/pull/55), merge commit `880d3dd59ed5697336d4d7b655a553dfba21f512`.

## Effect scope

Three additional transitions from the user's exact original 41-effect GL Transitions selection are implemented in Advanced mode: **34 available / 7 queued**. These are original Canvas 2D implementations of the named effects and do not claim pixel-identical reproductions of third-party gallery shaders.

- **ASCII:** Incoming Video B materializes through a 32×18 fixed-width text grid. Each glyph is chosen from a brightness ramp using the **actual sampled source image**, not arbitrary characters. A cyan-green monospace image overlays the A→B blend, peaking halfway through the overlap, then dissolves into a clean, full-resolution B.
- **Color codes:** Incoming B is sampled into 7×4 picture cells. Each cell briefly displays a dark interface panel, a swatch of its **sampled source pixel color**, and the correctly formatted RGB hex triplet (e.g. `#FF0000`). Panels appear at slightly staggered deterministic intervals and fade away into unmodified B. Distinct from both ASCII and the existing Color panel wipe.
- **Prisms:** Nine broad angular glass facets across the incoming video shift in different radial directions during the overlap. Three repeating spectral tint channels (rose/cyan/gold) and colored facet borders create a chromatic splitting effect that differs from Refraction's 24 triangular lens tiles. The facets settle back to normal B by the end.

For ASCII/Color codes, only bounded tiny offscreen frames (32×18 and 7×4) are inspected with `getImageData`; there is **no full-resolution CPU pixel scan**, and the shared full-frame and tiny scratch canvases are reused and released by `AdvancedMediaEngine.clearAll()`. Prisms uses nine Canvas clipped video draws and bounded line overlays.

## Non-destructive editor compatibility

The unchanged Advanced **Select two video clips → Pair Video A → Video B** workflow still owns transition duration, incoming upper-lane placement, gold timeline marker, effect label, Unlink and Undo/Redo. Original video files, trims, source offset, attached audio and volume settings remain unmodified.

All effects go through the same `AdvancedMediaEngine.renderFrame()` preview, still/snapshot and fixed-frame export compositor. Their output depends on a deterministic source frame and timeline timestamp; rewinding to a given frame reproduces its pixels. All three return clean B at completion.

This phase does not include linked-audio crossfades, alpha-bearing output videos, effect parameter presets, physical Windows/Android device certification, or third-party GLSL shader copies.

## Validation required before merge

1. **Node:** 41 original names in original order; 34 enabled/7 queued; input luminance determines ASCII characters; display RGB values are correct hex strings; independently staggered Color code timing; nine bounded, deterministic prism displacements with zero endpoint offsets; exact clip overlap/history/linked-audio preservation.
2. **Actual Chrome Canvas pixels:** all 34 effects render at start/mid/end, same-time rerenders match; the ASCII glyph treatment differs from Pixelize; source RGB code panels differ from Color panel wipe and ASCII; Prisms differs from Refraction and Vortex; each returns to pristine B at the end. Scratch canvases are released by clearAll.
3. **Real Chrome editor:** two generated MP4 inputs, all 34 enabled effect IDs selected and applied, gold marker, correct active effect labels, Undo/Redo.
4. **Full regression:** previous Node tests, Firefox/browser UI and media checks, near-limit 60-second 1080p / 120-second 720p exports, the full 120-second 1080p H.264/AAC MP4 (3,600 frames, 16 moving clips), repeated-export memory and portrait/rotated-media checks.

**QA result: PASS.** [GitHub Actions run 44521729465](https://github.com/cinaedvsstudios/Organon/actions/runs/44521729465) passed all three jobs (`transition-smoke`, `cross-browser-ui`, `export-browser`).

- **164/164 Node tests passed**, including the five new ASCII, Color codes, Prisms and non-destructive history tests.
- **Real Chrome Canvas pixels passed for all 34 effects.** At the midpoint, the new effects had distinct frame fingerprints: ASCII `2441731077`, Color codes `646516772`, Prisms `982742201`. Same-timestamp rerenders were identical, and scratch textures were released on project clear.
- **Actual Chrome editor** imported two MP4 clips, applied all 34 effect choices, verified gold markers, active labels and Undo/Redo. Firefox and cross-browser checks passed.
- **Export and memory regression passed:** the full 120-second 1920×1080/30fps H.264/AAC MP4 test encoded **3,600 frames across 16 moving clips**, producing 73.08 MiB with peak Chrome PSS 1,175.6 MiB. Near-limit 60-second 1080p/120-second 720p, memory recovery and rotated/portrait-media checks were successful.
- This does not certify exact third-party shader reproduction, physical Windows/Android devices, automatic audio crossfades or alpha-capable output videos.

**Merge only after all three CI jobs pass.**
