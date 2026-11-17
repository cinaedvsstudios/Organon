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

## Execution status

GitHub Actions testing is required before this phase can be marked as passed. Initial UI run reached import but failed a *case-sensitive assertion* because the UI displays `1 MEDIA`, not `1 media`; that test assertion has been corrected. The VFR/layer test has been added and has not yet been verified at this point.

Tests are based on locally generated synthetic sources, not uploaded personal footage. Phase 6F does not modify the editor's production features or existing live MediaRecorder exporter.

## Release gate still open

Even if these browser checks pass, user-device performance, longer 1080p multi-clip projects, more source codecs, and peak native decoder memory remain outstanding. Keep the two-minute offline beta guard and do not start new transitions until the final stabilization gate is accepted.
