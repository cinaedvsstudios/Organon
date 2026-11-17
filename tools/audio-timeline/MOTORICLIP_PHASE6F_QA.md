# MotoriClip Phase 6F — real editor UI, VFR and layer compositing QA

Date: 17 November 2026 (Berlin). Work remains limited to stabilization, not transition features.

## Browser tests introduced

1. **Actual editor interface** (headless Chrome): the desktop `index.html` entry should open Advanced by default; `?mode=basic` should stay in Basic; the Basic/Advanced buttons should switch in both directions without loops. A Pixel-style phone browser should default to Basic and still permit switching to Advanced.
2. **Visible Advanced controls:** changing project FPS from 30 to 24, applying 640×360 canvas dimensions, adjusting and resetting preview zoom, importing a JPEG to Project Files, clearing, undoing and redoing through real buttons.
3. **Genuine variable-frame-rate input:** use FFmpeg to produce H.264 video with nonuniform frame presentation timestamps, verify variable frame spacing with ffprobe, trim its source in-point, export with the offline encoder at fixed 30 fps, and compare decoded source/video sample colours.
4. **Layer compositing:** a full yellow background, red video on a lower video layer, 50%-opacity blue video overlapping it, and a transparent PNG with a green square above them. Decode actual WebM output and verify red-only, purple overlap, yellow background gap, and an opaque green sticker corner.

Files:
- [editor-ui.browser.mjs](./tests/editor-ui.browser.mjs)
- [vfr-overlap.browser.mjs](./tests/vfr-overlap.browser.mjs)
- [motoriclip-real-media.yml](../../.github/workflows/motoriclip-real-media.yml)

## Execution status — confirmed passing

**GitHub Actions run [44147408452](https://github.com/cinaedvsstudios/Organon/actions/runs/44147408452) completed successfully on 17 November 2026.**

- **91/91 Node regression tests passed** (88 previous tests plus three new static DOM wiring checks).
- Desktop Chrome UI: advanced-default navigation, 24 fps selector, 640×360 canvas sizing, zoom and reset, JPEG import, Clear Project, Undo, Redo and Basic/Advanced navigation **passed**.
- Android-style Chrome mobile emulation: Basic default, manual Advanced entry and return to Basic **passed**. This is an emulated phone, **not** physical-device certification.
- Genuine variable-frame-rate H.264 source has verified frame intervals **0.033 s and 0.067 s**. The trimmed video exported into a 30 fps MP4; output frame samples matched their requested source timestamps **within test tolerance**.
- Overlapping video layer export **passed**: central sample red [253,23,0], 50%-alpha blue-over-red purple [124,18,126], background-gap yellow [253,253,0], transparent sticker green [0,254,0].
- Earlier MP4/WebM smoke tests and Phase 6E HD/FHD and 25-clip scenarios also **passed** in the same workflow.

### Real defect discovered and repaired

The actual Advanced HTML was missing four required audio-inspector elements: `audio-fade-in`, `audio-fade-in-value`, `audio-fade-out`, and `audio-fade-out-value`. Its existing controller referenced them and failed at `addEventListener` during initialization. Phase 6F restores the two range sliders and their labels in `advanced.html`. The permanent `dom-wiring.test.mjs` now checks that all required controller IDs exist in the HTML; the optional parent-document `basin-frame` ID is excluded explicitly.

Initial failures were addressed before recording a green result: a case-sensitive file count assertion and incorrect escaping in the synthetic FFmpeg VFR expression.

## Release gate still open

Even if these browser checks pass, user-device performance, longer 1080p multi-clip projects, more source codecs, and peak native decoder memory remain outstanding. Keep the two-minute offline beta guard and do not start new transitions until the final stabilization gate is accepted.
