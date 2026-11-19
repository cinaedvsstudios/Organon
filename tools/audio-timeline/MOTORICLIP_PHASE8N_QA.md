# MotoriClip Phase 8N QA

Three Canvas-native deterministic transitions: SpiralBlockWipe, Hologram, Crumple. The original 41 labels/IDs are retained, with 37 available and four queued (Sphere, Snapshot, Gallery, Brokey dissolve).

## Tests added/updated

- `node --test tools/audio-timeline/tests/phase8n-visual-effects.test.mjs`
- `node --test tools/audio-timeline/tests/paired-visual-effects.test.mjs`
- `node tools/audio-timeline/tests/paired-visual-effects.browser.mjs` — real Chrome compositor pixels, deterministic scrub and cleanup for 37 effects
- `node tools/audio-timeline/tests/paired-transitions.browser.mjs` — two MP4 imports, all 37 selectable transitions, markers and undo/redo
- Existing Firefox and 120-second 1080p H.264/AAC export/memory workflow remain required.

## Merge gate

**Draft / NOT VERIFIED.** No local browser or export suite has been executed in this session, and no successful CI runs have been observed. Keep PR open until the full Node, Chrome, Firefox, long-export and memory checks pass. Effects are original Canvas interpretations, not shader-identical third-party copies.
