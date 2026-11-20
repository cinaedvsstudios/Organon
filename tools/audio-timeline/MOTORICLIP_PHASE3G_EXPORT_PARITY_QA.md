# MotoriClip Phase 3G — real export-pixel equivalence gate

## Purpose
The existing exporter smoke tests checked container validity, audio/video
streams, duration and coarse colour samples. Those are valuable, but cannot
prove that procedural **animated effect pixels** in the timeline match the
actual encoded MP4 video. This new test checks that directly.

## Test operation
`tests/animated-overlay-export.browser.mjs` generates an actual two-second
320×180 H.264/AAC patterned video with FFmpeg. Chromium imports it into an
`AdvancedMediaEngine` together with a small transparent generated sticker
clip carrying an editable `effectOverlay` recipe.

Two deliberately different kinds of effects are tested:

- **Light Sweep**: independently animated directional light overlay
- **Glitch Flux**: source-aware column deformation of the actual video image

For each effect, the same real Chromium preview engine seeks to 0.4s and 1.4s
and back to 0.4s, captures raw RGB pixels, and asserts *exact byte equality*
on the backward seek and substantive differences between the two times.

Then the unchanged `AdvancedOfflineExporter` encodes a real MP4 at 25 fps.
The downloaded MP4 is probed with ffprobe and decoded with FFmpeg. Decoded
video frames **#10 and #35** are compared against the preview RGB arrays at
0.4s and 1.4s (25 fps). Difference is measured as the mean absolute error
across all red, green and blue values, allowing an explicit, bounded tolerance
for H.264/YUV420 compression while rejecting visibly incorrect effects.

This is not a mock export, a static PNG comparison, or an inspection of a
pre-encoder Canvas surface. It checks *actual decoded exported pixels*.
The exact reverse-scrub assertion does not use a lossy tolerance.

## Architecture impact
Test-only changes: no modifications to effect renderers, the 41 A/B
transitions, project recovery, preview UI or exporter implementation.
The GitHub Actions `export-browser` job now runs this test immediately
after normal real MP4 media verification.

## Checklist rules
A passing new Chrome job supports requirement #100 and the browser
timestamp/reverse-seek pixel portion of #94. It does **not** alone certify
all WebKit encoding, long-duration 4K memory, every colour/opacity blend
mode, or arbitrary third-party media codecs. Keep those limits explicit.
