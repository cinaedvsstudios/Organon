# MotoriClip Phase 8O — final four transitions

Adds original Canvas 2D interpretations of Sphere, Snapshot, Gallery and Brokey dissolve. The 41 selected labels and IDs remain unchanged; all 41 are marked available in this development branch.

This branch contains the Phase 8N changes from **PR #56** and must not be merged before PR #56 passes validation and lands on `main`. PR #57 is targeted at `main` for independent GitHub Actions validation; after PR #56 merges, review the final PR #57 diff again.

## Required checks before merging

1. `node --test tools/audio-timeline/tests/phase8o-visual-effects.test.mjs`
2. Full existing Node transition tests, including phase8d through phase8n.
3. `node tools/audio-timeline/tests/paired-visual-effects.browser.mjs` — real Chrome compositor checks for 41 effects and repeat scrubbing.
4. `node tools/audio-timeline/tests/paired-transitions.browser.mjs` — import two actual MP4s, select all 41, verify overlap markers and undo/redo.
5. Firefox, 1080p 120-second export, audio continuity and memory regression workflow.

**Validation status (19 November 2026):** Phase 8N transition smoke and Firefox/WebKit jobs passed. The extended export job was still running when this note was updated. Phase 8O's own 41-effect CI has not yet been confirmed passing. Do not merge either PR solely on the basis of test source changes.
