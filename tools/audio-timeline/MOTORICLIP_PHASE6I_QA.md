# MotoriClip Phase 6I — cross-browser and phone-style media QA

**Date:** 18 November 2026 (Berlin)

## Purpose

After Chrome-only Phase 6H, separate **editor UI compatibility** from **fixed-frame export codec compatibility** in Firefox and WebKit, and inspect how the existing Chrome exporter handles portrait and rotation-tagged camera-like media.

## Browser-engine tests

[Cross-browser browser test](./tests/cross-browser.browser.mjs) uses **Playwright Firefox and Linux WebKit** on a pinned Ubuntu 24.04 runner. It checks:

- Desktop `index.html` selects Advanced; application controller initializes without unhandled JavaScript exceptions; FPS and canvas-size controls actually change values.
- Both Basic→Advanced and Advanced→Basic navigation work.
- Phone-sized viewport with an iPhone user agent selects Basic by default, with manual mode switches tested both ways.
- Both export buttons remain visible, and the native `MediaRecorder` fallback remains present.
- Detect and record the actual per-engine `VideoEncoder`, `VideoDecoder`, `AudioEncoder`, `OfflineAudioContext`, `MediaRecorder`, `canvas.captureStream` and VP9 encoder configuration support. Compare the offline exporter's API-support verdict with detected APIs.
- If WebCodecs/OfflineAudioContext prerequisites are missing, verify the beta exporter produces a clear unsupported-browser error rather than pretending to support an export.

**Important:** Linux Playwright WebKit is not Safari on iOS; an emulated iPhone user agent is not a physical iPhone; and browser API presence alone does not establish codec/export functionality. Phase 6I does not claim production video export in Firefox/WebKit without an actual encoding test in those engines.

## Synthetic phone-style media tests

[Portrait camera-like media export test](./tests/portrait-phone-like.browser.mjs) generates two synthetic four-second H.264/AAC files:

1. A **360×640 portrait QuickTime MOV**, with moving test-pattern footage and red/blue colour-reference corners.
2. A **640×360 MP4** with a real **90° display rotation metadata** flag; its visual orientation should become portrait when decoded and composited.

Both are imported as video sources into a 720×1280 portrait output canvas, trimmed by a quarter second, and rendered to H.264/AAC MP4 at 25 fps. FFprobe and FFmpeg independently check the output dimensions, **75 frames**, approximately three seconds, orientation using correctly located coloured corner markers, moving content and nonzero audio.

These fixtures approximate encoding, aspect ratio and metadata seen in phone videos. They are **not** footage taken by an actual Pixel or iPhone and do not establish compatibility with every camera bitrate, pixel format, colour profile, variable frame-rate or HEVC variant.

## Status

**Pending actual GitHub Actions results.** Cross-browser tests and both phone-like outputs must report real successes before this phase is marked passing. If an engine lacks a codec, record that limitation separately from genuine startup/UI regressions.

## Remaining release-gate checks

Physical Android/iPhone hardware, Mac Safari, hardware-accelerated encoding behaviour, user-supplied real-world media, many simultaneous 1080p clips and long-term active-tab memory behaviour remain unverified. The original live recorder and two-minute fixed-frame beta limit remain unchanged; Phase 7 signoff and transition development are still pending.
