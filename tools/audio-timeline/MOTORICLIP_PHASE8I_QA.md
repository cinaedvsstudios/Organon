# MotoriClip Phase 8I — Paper tear, Ink bleed, Splatter wipe

**Date:** 19 November 2026 (Berlin)
**Status:** Pending PR and real-media CI.

## Scope and design

Three more effects from the original, unchanged 41-name GL Transitions shortlist are newly enabled in Advanced mode's Video A → Video B pairing control. The catalog now has **22 available / 19 queued**; these are original Canvas interpretations of the effect types, not pixel-identical copies of gallery shaders.

- **Paper tear:** A ragged, reproducibly jagged boundary advances from left to right. Incoming Video B is visible behind the irregular tear, with a thin paper-coloured fiber accent along the edge. At the start only A appears; at the end the full clean B takes over.
- **Ink bleed:** Video B emerges through 24 irregular expanding ink pools. Their independent arrival times, organic polygon boundaries and subtle violet-black rims distinguish the result from flat circles, random squares or an ordinary fade. The pools merge near completion, rather than leaving a large gap that would suddenly disappear on the last frame.
- **Splatter wipe:** Video B arrives in 72 deterministic scattered paint droplets, including elongated splashes. A left-to-right advancing paint front fills gaps near completion, while droplets appear ahead of it. The spatial distribution and pacing differ from Ink bleed and existing Random squares.

All effects use one Canvas path and an incoming media draw, with optional bounded edge accents. They do **not** allocate persistent new full-resolution textures, mutate video sources, or change linked audio.

## Editor and export integration

The same Select two videos → Pair Video A → Video B → Effect + duration control applies. The pair planner retains its validated overlapping clip placement, upper video lane choice, gold timeline marker, effect note, Unlink and Undo/Redo. All effects use `AdvancedMediaEngine.renderFrame()` for preview, still rendering, real-time capture and fixed-frame export, with deterministic frame results when seeking backward and forward.

Audio and source clips remain unchanged. Automatic audio crossfades, alpha-bearing output file exports and exact third-party GLSL shader reproduction remain separate future work. Physical Windows/Android device verification is a separate QA step; no Apple-only testing is a requirement.

## Validation requirements

1. **Node:** Preserve all 41 names and 22/19 status; Paper tear advances monotonically and retains a jagged edge; Ink bleed pools spread and merge; Splatter droplets have varied deterministic delays and sizes; all three retain original audio/trim/placement and Undo/Redo metadata.
2. **Real Chrome Canvas pixels:** A visible before and B after the transition, with both A and B visible halfway through; three distinct effects compared with Fade, Random squares and each other; paper fibers and ink-edge pixel mixtures; increasing B coverage as time advances; rendering the same time twice must match exactly.
3. **Real Chrome editor:** Import two MP4 clips and cycle all 22 available effects with gold marker, active label and Undo/Redo.
4. **Regression suite:** All previous Node tests, browser compatibility, FFmpeg-based Firefox checks, 60-second 1080p/120-second 720p near-limit exports, full 120-second 1080p H.264/AAC MP4, repeated-export memory checks and rotated/portrait files.

**Merge only after all three CI jobs pass.**
