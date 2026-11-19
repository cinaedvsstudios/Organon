# MotoriClip Phase 8H — Spin, Cube and Cross warp

**Date:** 19 November 2026 (Berlin)
**Status:** Pending PR and all three CI job results.

## User selection and implementation

The initial gallery shortlist remains **41 names**, exactly in the user's original order and spelling. The new batch enables **Spin**, **Cube** and **Cross warp** in the existing **Pair Video A → Video B** dropdown: **19 working / 22 queued**.

- **Spin:** Incoming B rotates through one complete revolution while growing from 12% to full frame size. The previous A remains visible outside the moving card. The final frame is normal, full-resolution B, with no rotation or residual scaling.
- **Cube:** A two-face, cube-style horizontal turn. Outgoing A contracts toward the left while incoming B opens on the right, with bounded row-dependent perspective offsets. Both source pictures are sampled through the shared scratch canvas and composed as projected surfaces. It is **not** a pixel-identical WebGL cube shader.
- **Cross warp:** Incoming B is revealed through the union of expanding vertical and horizontal arms, with horizontal image strips temporarily distorted sideways. The distortion decays at the transition boundaries; corners continue showing A until the cross expands enough to cover them. Distinct from the existing diagonal Cross hatch effect.

All are deterministic Canvas 2D implementations of the selected *effect types*, not copied third-party GL shaders or claims of exact matching gallery previews.

## Integration and performance

The established **Select two videos → Pair Video A → Video B → effect + duration → Apply** workflow remains. The pair planner positions B above A as needed; gold timeline markers, inspector names, Unlink, Undo/Redo, source trims and existing audio are preserved. Both preview and fixed-frame export use `AdvancedMediaEngine.renderFrame()`.

Spin uses one incoming draw with transform. Cross warp uses one existing full-size scratch texture and a bounded 24-row clipped draw. Cube uses that same scratch texture twice (once for A and once for B) with 24 rows per face, rather than creating more persistent full-size buffers. Project clearing continues to release scratch canvases. No source media modification, audio crossfade, transparent-alpha output, or Safari certification is included.

## Acceptance criteria

1. **Node:** stable 41-name catalog with 19 available/22 queued; rotating angle and scale monotonic to a pristine final frame; complementary cube face widths and bounded perspective offsets; expanding cross-arm geometry and deterministic time-derived distortion; unchanged pair placement, audio and Undo/Redo metadata.
2. **Actual Chrome compositor pixels:** all 19 effects reveal B cleanly after the transition and show A before it. Mid-transition of Spin, Cube and Cross warp must each retain both A and B and differ visibly from Fade and comparable older effects. Spin and Cross warp show incoming B at the center; Cross warp leaves A at the corners. Identical timeline timestamps must render identical pixels.
3. **Actual Chrome editor UI:** import two MP4 clips, cycle all 19 available effect selections, verify inspector labels, gold fade marker and Undo/Redo.
4. **Full regression gate:** all Node suites, Chrome/Firefox compatibility, near-limit media exports, 120-second 1080p H.264/AAC MP4 (3,600 frames), repeated-export memory and portrait-media checks remain passing.

**Merge only after all three CI jobs succeed.** Physical Windows and Android device certification is separate.
