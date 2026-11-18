# MotoriClip — Phase 6J Firefox real export and WebKit fallback QA

**Date:** 18 November 2026 (Berlin)

## Scope

This phase advances Phase 6I from Firefox API-presence detection to a **real encoded-and-decoded Firefox output**, and verifies that Linux WebKit's missing `MediaRecorder` support disables the Advanced real-time export button with an understandable status message.

## Firefox media acceptance

The existing controlled [real-media E2E test](./tests/real-export.browser.mjs) now supports a `MOTORICLIP_BROWSER=firefox` mode. The Chrome mode remains unchanged (tests both MP4 and WebM). On Linux Firefox, the test uses a real H.264/AAC two-clip source, a JPEG background and transparent PNG sticker, and exports a four-second 320×180/25fps WebM (VP9/Opus) via Mediabunny's fixed-frame beta exporter.

The test examines the **actual downloaded WebM** using FFprobe/FFmpeg: present video/audio streams, ~100 decoded video frames, four-second duration, correct red and blue clip positions, yellow empty gaps, and audio silence/presence at expected sample times. Running against a real browser is important: earlier Firefox tests only checked whether `VideoEncoder.isConfigSupported` returned true.

Because Playwright's Linux Firefox and WebKit use a matching container image, the CI script prepares FFmpeg fixtures and runs Firefox as the non-root `pwuser`; this avoids root/home browser sandbox issues. FFmpeg outputs are locally generated temporary fixtures, not private footage.

## WebKit real-time fallback acceptance

The [cross-browser UI test](./tests/cross-browser.browser.mjs) checks that when `MediaRecorder` is absent, MotoriClip disables `Render & Save` (real-time exporter), and displays an explanatory unavailable-format status instead of presenting a clickable but nonworking control.

The fixed-frame beta's WebKit codec path remains **unverified**. The earlier Linux WebKit process exited during a combined codec probe; this phase does not represent the presence of WebCodecs API constructors as proof of a working output encoder. Actual Mac Safari/iOS and WebKit rendering must be tested separately if resources become available.

## Status

**Pending GitHub Actions real-media results.** Do not mark Firefox encoding as successful until FFprobe/FFmpeg has inspected an actual produced file and the relevant CI job is green.

## Release gate

Only the browser test harness, workflow and QA documents are changed in this phase unless a reproducible editor defect is found. Keep the current 120-second fixed-frame beta duration guard and the MediaRecorder fallback; do not sign off Phase 7 or implement transitions until actual-device and codec issues are resolved.
