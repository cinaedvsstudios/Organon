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

## Verified findings and implementation — 18 November 2026

**Real Firefox export verified** in [GitHub Actions 44384995283](https://github.com/cinaedvsstudios/Organon/actions/runs/44384995283): a four-second, 320×180, 25-fps VP9/Opus WebM contains **100 decoded video frames**, 4.02 seconds duration, correctly placed red/blue clips and yellow gaps, and real audio during the two clips (approximately RMS 0.125) with silence outside. The same full E2E browser test continues to cover MP4 and WebM in Chrome.

**Linux WebKit findings:**

- Both desktop/phone-style UI routing and the absence-of-`MediaRecorder` disabled-button/status check passed.
- A 0.4-second **video-only** WebKit WebM encoded successfully: **10 VP9 frames**, verified by FFprobe in [run 44385636647](https://github.com/cinaedvsstudios/Organon/actions/runs/44385636647).
- A four-second WebKit multitrack video + audio project produced a valid video stream but **silent audio in both VP9/Opus WebM and H.264/AAC MP4**, when independently decoded with FFmpeg. The browser's source `OfflineAudioContext` mix was **not** silent (RMS ~0.062).
- The browser's **own** Mediabunny AudioBufferSink and Web Audio `decodeAudioData` reported nonzero audio from this MP4, so an entirely in-browser encoded-audio integrity check was **insufficient** to detect this particular output defect. Do not claim that decoder check guarantees platform-independent audio validity.
- The Playwright WebKit runtime on Linux reports a **macOS Safari user-agent** but its `navigator.platform` is **`Linux x86_64`**. Thus platform and engine must be considered together; matching `Linux` against the user-agent alone would miss this case.
- A narrowly targeted audible-export guard now stops **Linux-platform WebKit** with an explanatory compatibility error and **no downloaded file**; video-only Linux WebKit export remains allowed. Actual Mac Safari (`navigator.platform` normally macOS) and Chromium/Firefox are not blocked by this rule. Guard and WebKit browser integration tests passed in [run 44389691906](https://github.com/cinaedvsstudios/Organon/actions/runs/44389691906).

**Additional stabilization:** The beta now attempts a post-finalization encoded-audio integrity check by decoding the output through Mediabunny before initiating a download. This detects some entirely silent outputs in browsers where the decoder reflects the delivered data, and is skipped for genuinely silent mixes. It does **not** detect every WebKit/audio interoperability bug, as the independent FFmpeg comparison demonstrated. The test suite also checks basic PCM signal detection, silent output rejection, audible output acceptance, and Linux-only browser identification.

The Linux-specific guard is a **conservative workaround for the reproducible Playwright Linux WebKit failure**, not evidence that Mac Safari 26 has identical behaviour. The fixed-frame export's broader Safari/Apple hardware support remains unverified; this branch must not be promoted as fully cross-browser-certified.

## Release gate

A reproducible silent-output defect was found and the offline exporter gained a Linux-WebKit-specific audible-project guard plus a best-effort encoded-audio verification step. No change was made to the original MediaRecorder exporter or the fixed-frame 120-second duration guard. Physical Safari on macOS/iOS and Android hardware, long Safari exports and genuine phone camera footage are still required before Phase 7 signoff or new transition features.
