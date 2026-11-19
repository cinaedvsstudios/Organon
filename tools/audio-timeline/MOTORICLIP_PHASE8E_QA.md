# MotoriClip Phase 8E — Spiral wipe, Rings wipe, Color panel wipe

**Date:** 19 November 2026 (Berlin)

## Scope

Three additional effects from the user's **original 41-name GL Transitions shortlist** are implemented as independent, deterministic Canvas 2D transitions in Advanced mode. The catalog retains the user's original names/order and now has **10 available / 31 queued**. Spiral wipe is distinct from the separately requested and still-queued **SpiralBlockWipe**.

- **Spiral wipe:** Thirty-two concentric annular sectors share an angular starting point, with inner rings exposing progressively more of incoming Video B than outer rings. Their curved angular frontier produces a visible spiral reveal of B over A. One combined Canvas clipping path and one media draw are used per frame.
- **Rings wipe:** Ten alternating concentric annuli reveal Video B at staggered, deterministic thresholds. Multiple bands of opaque A and B coexist in the mid-transition frame; this is distinct from the previous smooth circular **Aperture wipe**. One bounded clipping path and one media draw per frame.
- **Color panel wipe:** Six staggered vertical panels in aged-gold, royal-blue, plum and bronze colours cover portions of outgoing Video A, then uncover the corresponding portion of incoming Video B. All six panels use an existing shared scratch canvas and a bounded number of draws. No custom colours/timing sliders are included in this increment.

These implementations reproduce the requested *categories* of visual transition; they do not claim to copy the gallery's proprietary appearance or GLSL code exactly.

## Existing editor compatibility

Select two loaded video clips in Advanced's Select mode, choose one of ten effects in **Pair Video A → Video B**, choose the overlap duration and apply. The existing pair planner, gold timeline transition markers, Inspector label, Unlink, undo/redo and clip source/audio handling are unchanged. B still overlaps the end of A on a compositing upper lane where required.

All effects use `AdvancedMediaEngine.renderFrame()`, shared by playback preview, stills, real-time capture and fixed-frame export. Spatial effects bypass only incoming B's entrance-fade opacity while their mask is active; they preserve B's base opacity and independent exit fade. At 100%, B returns to a pristine full-resolution frame. No destructive media changes, linked-audio crossfade, alpha-channel output file, or new Safari certification are included.

## Acceptance

1. **Node:** 41 unique wishlist entries, 10 enabled and 31 queued; SpiralBlockWipe still queued; mathematical monotonic spiral rotation; independent staggered annuli and tinted-panel stages; shared non-destructive pairing and history.
2. **Real Chrome pixels:** deterministic start/mid/end output; red B and blue A visible as distinct areas at midpoint; Spiral, Rings and circular Aperture must differ in their sampled frames. Color panels must show visibly tinted areas, alongside unreplaced A and revealed B. Same-timestamp rendering must remain identical. No additional persistent offscreen canvases.
3. **Real editor UI:** import two MP4 videos, apply all ten effects, retain gold marker, Inspector text and Undo/Redo.
4. **Full CI:** existing Node suites, cross-browser UI/Firefox, 720p/1080p MP4/WebM export, memory recovery and 120-second 1080p benchmark remain green.

**Status: MERGED AND VERIFIED.** [PR #47](https://github.com/cinaedvsstudios/Organon/pull/47) merged 19 November 2026 at `6cbb159e79bef92c96087df107dff1f074db86fb`. [GitHub Actions run 44462261691](https://github.com/cinaedvsstudios/Organon/actions/runs/44462261691) passed **all three jobs**: transition-smoke, cross-browser-ui and export-browser.

- **124/124 Node tests passed**, including five additional Phase 8E mathematical, catalog and history cases.
- **Actual Chrome Canvas pixel checks passed** for all ten effects, with Spiral, Rings and Color panel wipes producing distinct middle frames; red B, blue A and tinted panel regions were verified, as were same-time deterministic rerenders.
- **Chrome Advanced UI passed:** Two imported MP4s, all ten paired effects, gold marker, inspector labels and Undo/Redo; 41 catalog names remain in place, with 31 queued.
- **Previous real-media regression checks passed**, including Firefox, 720p/1080p projects, repeated-export memory testing and the full **120-second 1920×1080/30fps H.264/AAC MP4** test: 3,600 frames over 16 moving clips, size 73.07 MiB, Chrome PSS peak 1,182.5 MiB.
- No claim of physical Windows/Android device certification, linked-audio crossfade, transparent file export or exact third-party shader copying.
