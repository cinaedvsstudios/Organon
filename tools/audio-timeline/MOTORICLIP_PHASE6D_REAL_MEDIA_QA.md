# MotoriClip Phase 6D — automated real-media export QA

**Date:** 17 November 2026  
**Goal:** Verify Phase 6C output using actual encoded and decoded MP4/WebM, not only mock media APIs.

## Harness

- GitHub Actions workflow: [motoriclip-real-media.yml](../../.github/workflows/motoriclip-real-media.yml)
- Test script: [real-export.browser.mjs](./tests/real-export.browser.mjs)
- Harness page: [browser-harness.html](./tests/browser-harness.html)
- Synthetic video/audio created inside the runner by FFmpeg; no uploaded user footage.

The workflow uses Chrome/Chromium with WebCodecs, Mediabunny in the browser, and FFmpeg/ffprobe to check the actual resulting files. It first runs **88 simulated regression tests** (14 + 12 + 13 + 15 + 5 + 13 + 16), including native AAC, AAC fallback and unsupported-AAC checks.

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

## Status — verified in GitHub Actions

**Initial real-media smoke test passed in Chrome on Linux, 17 November 2026.**

- [PR #33](https://github.com/cinaedvsstudios/Organon/pull/33) established the browser+FFmpeg automation.
- [PR #34](https://github.com/cinaedvsstudios/Organon/pull/34) fixed a Node MediaRecorder mock and discovered that Chrome Linux did not support native AAC encoding. MotoriClip now lazily loads the Mediabunny AAC encoder extension, sharing the exact library instance via an ESM import map.
- **GitHub Actions run [44141292701](https://github.com/cinaedvsstudios/Organon/actions/runs/44141292701) completed successfully**. All 88 Node regression tests and the actual WebM/MP4 browser export smoke checks passed.
- **WebM**: VP9/Opus, 320×180, **100 frames**, **4.02 seconds**.
- **MP4**: H.264/AAC, 320×180, **100 frames**, **4.01 seconds**.
- Both outputs passed frame colour/timing assertions (yellow at 0.2s, red at 1s, yellow at 2s, blue at 3s), and audio RMS was silent during gaps and nonzero in both sound clips.
- The stable real-time MediaRecorder exporter remains present and unchanged.

**This is a narrow real-media acceptance test, not Phase 6/7 release certification.** Higher resolutions, multiple source frame rates, heavier projects, multiple browsers, cancellation during actual encoding and source incompatibility remain to be tested.

### Immediate review sequence

1. Expand real-media E2E tests to 720p and 1080p at 24/25/30/60 fps, including overlays and varied source codecs.
2. Profile 2, 10 and 25 clips for memory, render time and decoder caching; test both WebM and MP4.
3. Test real cancellation mid-export, unsupported file handling, browser compatibility and audiovisual lip-sync (not just interval-level audio presence).
4. Only then consider Phase 7 stabilization signoff and transition development.
