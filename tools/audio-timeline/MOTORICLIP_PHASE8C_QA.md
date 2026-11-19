# MotoriClip Phase 8C — first three additional A/B transitions

**Date:** 19 November 2026 (Berlin)
**Scope:** Three **functional, non-destructive** effects added to the existing paired-transition workflow. The original 41 selected names and order remain intact; **four available / 37 requested**.

## Newly available effects

- **Pixelize:** Incoming B is downsampled to progressively larger pixels at first, then resolves to its native detail while revealing B over A. The 2D renderer uses one small reusable texture and nearest-neighbour enlargement.
- **Random squares:** A stable 14 × 8 grid switches individual spatial tiles from A to full-opacity B in a deterministic pseudorandom order. No global fade darkens both videos. At 0% only A is visible and at 100% all tiles have revealed B.
- **Glitch flicker:** Incoming B's horizontal strips move independently and briefly flicker. The jitter amplitude and dropout probability decay as B becomes fully visible. Video A stays stable underneath; the random sequence is seeded by each frame timestamp, giving identical output when scrubbing back and exporting.
- **Fade:** Existing Phase 8B effect is unchanged and remains available.

These are original Canvas 2D implementations of selected effect *types*, not direct copies of the third-party gallery's shader source or a guarantee of pixel-identical gallery animation. Exact GLSL reproduction or richer presets can be pursued separately.

## Interaction and render behaviour

The Advanced Project inspector's existing **Pair Video A → Video B** dropdown enables the four effects. Select two loaded video clips, choose an effect and an overlap duration, and apply. The paired planner retains the previous upper-lane strategy and non-destructive timing. The inspector displays the active effect's name, and the existing gold timeline entrance marker shows its duration.

For spatial effects, the renderer temporarily bypasses only B's independent *entrance fade alpha* and instead paints the effect using its own opacity/mask. It still respects clip opacity, video visibility, blend mode and clip *exit fade*. At the transition end, the renderer returns to the ordinary full-resolution B frame. Manually added video fades without a valid pair remain unchanged.

Preview, snapshots, live recording and fixed-frame exports use the shared `AdvancedMediaEngine.renderFrame()`, so no separate rendering interpretation is introduced. The offscreen full-resolution/pixel canvases are reused, resized as needed, and explicitly cleared when the project is cleared or the engine is destroyed. Linked source audio remains unaffected; automatic audio crossfades are not included.

## Verification

- Node: four-effect catalog, exact pair overlap and effect ID, invalid effects, deterministic and monotonic square-mask properties, decreasing pixel block size, reproducible glitch shifts and envelope handling.
- Real Chrome canvas: actual red/green patterned incoming video B and blue video A, compare start/middle/end frame pixels; random squares must reveal fully opaque red *and* blue regions (no accidental dark purple); Pixelize and Glitch flicker must visibly differ from Fade; rendering the same timestamp twice must match exactly. Verify native offscreen scratch release on clear.
- Real Chrome Advanced UI: import two MP4 sources, select a pair, cycle all four effects, verify inspector descriptions/gold markers and Undo/Redo.
- Existing 108-node regression matrix from 8B, full Chrome/Firefox UI and 720p/1080p real-media export/memory CI must remain green.

**Status:** Awaiting PR workflow verification. No claim of device certification or exact third-party shader replication.
