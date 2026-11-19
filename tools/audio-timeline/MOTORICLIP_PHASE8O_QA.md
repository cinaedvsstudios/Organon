# MotoriClip Phase 8O — final four transitions

Adds original Canvas 2D interpretations of Sphere, Snapshot, Gallery and Brokey dissolve. The 41 selected labels and IDs remain unchanged; all 41 are marked available in this development branch.

This branch depends on **Phase 8N PR #56** and must not be merged independently into `main` before Phase 8N passes its validation gates.

## Required checks before merging

1. `node --test tools/audio-timeline/tests/phase8o-visual-effects.test.mjs`
2. Full existing Node transition tests, including phase8d through phase8n.
3. `node tools/audio-timeline/tests/paired-visual-effects.browser.mjs` — real Chrome compositor checks for 41 effects and repeat scrubbing.
4. `node tools/audio-timeline/tests/paired-transitions.browser.mjs` — import two actual MP4s, select all 41, verify overlap markers and undo/redo.
5. Firefox, 1080p 120-second export, audio continuity and memory regression workflow.

**Not yet verified:** this session could commit source and test updates but did not execute Node, browser or export suites. Do not treat test source changes as passing test results.
