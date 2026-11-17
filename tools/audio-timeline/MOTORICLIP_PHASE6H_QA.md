# MotoriClip Phase 6H — repeated-export memory recovery

**Date:** 17 November 2026 (Berlin)  
**Scope:** Verify that successive offline exports recover resources in one Chrome tab, following the elevated Chrome process-memory readings in [Phase 6G](./MOTORICLIP_PHASE6G_QA.md). This phase does not change production export behavior or raise the fixed-frame beta's 120-second limit.

## Browser acceptance scenario

The new [repeated-export-memory.browser.mjs](./tests/repeated-export-memory.browser.mjs) creates a genuine H.264/AAC moving-image source and a JPEG background. A single Advanced Media Engine and a single `AdvancedOfflineExporter` remain alive across **four consecutive 8-second 720p VP9/Opus exports at 25 fps** in one headless Chrome tab. The same two source clips have separate source offsets and timeline positions.

For every exported WebM, FFprobe verifies two encoded streams, 1280×720 resolution, 200 decoded video frames and an approximately eight-second duration. FFmpeg confirms non-silent source audio. The exporter must reach 100%, download exactly once, report no busy state, preserve the original playhead and clear its active media Input registry and output reference after every operation.

## Memory methodology

The Node test runner samples **Linux proportional set size (PSS)** of Chrome process descendants every approximately 300 milliseconds during rendering. It records:

- Chrome process PSS just before each export
- Sampled maximum PSS during each export
- PSS following revocation of the temporary download object URL, a Chrome DevTools heap garbage-collection request and a 2.5-second idle period
- Memory at the end of the four-export session
- Memory after removing the project's canvas and references, requesting another garbage collection and allowing three seconds of idle time

A PSS reading is an approximation of physical memory attributed proportionally to the browser, GPU and renderer processes. It does not prove all browser-owned resources are released; retained pools and decoder caches may be intentional. The test therefore does **not** invent a pass/fail peak memory budget or label rising PSS as a proven leak.

## Status

**Pending actual GitHub Actions run.** Test setup and source-level checks alone are not evidence of recovered browser memory or successful encoded files.

## Future release gate

If memory remains elevated between runs, distinguish codec/memory-pool retention from a growing reference leak using controlled page-close/reopen and browser restart comparisons. Further device/browser QA and real-world camera/phone footage remain necessary before Phase 7 completion or lifting the two-minute beta guard.
