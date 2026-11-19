# MotoriClip Phase 8F — Block cover, Cross hatch, Film strip

**Date:** 19 November 2026 (Berlin)
**Status: MERGED AND VERIFIED.** [PR #48](https://github.com/cinaedvsstudios/Organon/pull/48) merged 19 November 2026 at `18a6e9afeeca92d1867bd73bd8e2f27005332535`.

## Selection and effect behaviour

The original 41 named gallery selections remain in order and retain stable IDs. Phase 8F enables three more A→B paired transitions: **13 working, 28 queued**.

- **Block cover:** Incoming Video B appears in a 10×6 mosaic. Each tile first briefly covers outgoing A with an opaque slate-blue or aged-gold block, then switches to fully opaque Video B. The timing is individually seeded but reproducible, with a visible *cover* stage that distinguishes it from Random squares.
- **Cross hatch:** Diagonal strips from both 45° and 135° directions gradually widen over A, exposing B through a crosshatched pattern. The second diagonal family starts later; the opening geometry stays deterministic during seeks and fixed-frame rendering.
- **Film strip:** Five alternating horizontal film frames slide in from opposite directions, slightly staggered. Dark film borders and pale perforation marks remain visible while the incoming frames arrive, resolving to an unmodified B at 100% progress.

These Canvas 2D implementations are original interpretations of the chosen effect types, not pixel-identical reproductions of third-party gallery shaders.

## Editing, timeline and export

The editor continues to use the same **Select two video clips → Pair Video A → Video B** control and overlap-duration setting. Incoming B is placed in an upper video lane if necessary. Gold timeline markers, inspector effect labels, Undo/Redo, Unlink, and metadata invalidation on changed clip timing continue unchanged.

All thirteen effects reuse the shared `AdvancedMediaEngine.renderFrame()` path for preview and fixed-frame export. Block cover and Film strip reuse the existing full-frame effect scratch canvas. Cross hatch uses only one constructed clipping path and draws the incoming frame once. No extra persistent full-HD textures are allocated.

Existing media files, trims, audio and audio-volume settings remain untouched. Automatic source audio crossfades and transparent-alpha output-file export are not included. Physical Windows/Android device certification is a separate release step; no Safari-specific work is a goal here.

## Acceptance

1. **Node:** 41 unique selections, 13 enabled/28 queued, stable cell stage transition, increasing crosshatch widths, staggered reversible film strip reveal, and non-destructive pairing/history.
2. **Chrome compositor pixel tests:** blue outgoing A remains outside the masks and red B appears inside, with a simultaneous visible cover state, diagonal reveal and film perforation borders. The three effects must differ from Fade and existing wipes. Re-rendering the same timestamp must give the same exact pixels, and a completed transition must resolve to pristine B.
3. **Real Advanced editor:** import two MP4 clips, apply all 13 transition choices, verify gold marker and inspector effect names, undo and redo.
4. **Full CI:** previous 124+ Node suites, Chrome/Firefox browser checks, multi-resolution export, memory recovery and 120-second 1080p 16-clip MP4 stress scenario must all pass before merge.

**QA result: PASS.** [GitHub Actions run 44464562638](https://github.com/cinaedvsstudios/Organon/actions/runs/44464562638) passed **all three jobs**: transition-smoke, cross-browser-ui and export-browser.
- **129/129 Node tests** passed, including the Phase 8F deterministic stage/geometry/history tests.
- **Actual Chrome Canvas pixels** confirmed the distinct Block cover, Cross hatch and Film strip visuals. Block cover midpoint contained 596 incoming red, 431 outgoing blue and 345 transient cover samples. Film strip showed 175 dark frame-border samples.
- **Advanced editor UI** applied all 13 paired effects to two imported MP4s with gold region marker, inspector labels and Undo/Redo; Firefox compatibility checks passed.
- **Real-media export suite passed**, including the full 120-second 1920×1080 MP4 with 3,600 frames / 16 moving clips and repeated-export memory recovery.
- Physical Windows/Android certification and exact gallery GLSL reproduction were not part of this release.
