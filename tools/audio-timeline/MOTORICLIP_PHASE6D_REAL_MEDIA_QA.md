# MotoriClip Phase 6D — automated real-media export QA

**Date:** 17 November 2026  
**Goal:** Verify Phase 6C output using actual encoded and decoded MP4/WebM, not only mock media APIs.

## Harness

- GitHub Actions workflow: [motoriclip-real-media.yml](../../.github/workflows/motoriclip-real-media.yml)
- Test script: [real-export.browser.mjs](./tests/real-export.browser.mjs)
- Harness page: [browser-harness.html](./tests/browser-harness.html)
- Synthetic video/audio created inside the runner by FFmpeg; no uploaded user footage.

The workflow uses Chrome/Chromium with WebCodecs, Mediabunny in the browser, and FFmpeg/ffprobe to check the actual resulting files. It first runs the 85 existing simulated regression tests (14 + 12 + 13 + 15 + 5 + 13 + 13).

### Full test scenario

Four-second timeline at 320×180, 25 fps:
- Yellow JPEG background for the full 0–4 seconds.
- Red H.264/AAC clip at 0.5–1.5 seconds, trimmed from 0.5 seconds into the source; 440 Hz sound.
- Blue H.264/AAC clip at 2.5–3.5 seconds, trimmed from 0.5 seconds into the source; 660 Hz sound.
- PNG sticker present throughout.

Repeat once for MP4 and once for WebM.

### Assertions against real output

- Container opens in ffprobe, and has both video and audio streams.
- Actual width 320 and height 180; duration approximately four seconds; 99–101 decoded frames.
- Centre pixel sampled from frame at 0.2s is yellow, 1s red, 2s yellow, 3s blue.
- Decoded audio is silent during gaps (0.1s, 2s and 3.8s) and nonzero during both sound clips (0.9s and 2.9s).
- Browser reports no JavaScript errors and exposes the WebCodecs and OfflineAudioContext APIs.
- No user project files are uploaded. The source video files are temporary synthetic local fixtures.

## Status

**Test harness committed (PR #33); actual GitHub Actions job execution and result not yet verified.** Do not mark this as a pass until workflow logs report success. The beta exporter is not release-certified based solely on this setup.

### Immediate review sequence

1. Trigger the workflow via this pull request now that its YAML exists on main.
2. Read job logs and fix real encoding/decoding failures without changing the stable real-time exporter.
3. Add 720p/1080p, 2/10/25 clip stress scenarios and inspect lip-sync and cancellation after the initial smoke test passes.
4. Only then consider Phase 7 stabilization signoff and transition development.
