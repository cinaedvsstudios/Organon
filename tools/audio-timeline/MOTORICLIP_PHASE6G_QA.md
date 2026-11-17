# MotoriClip — Phase 6G longer exports and browser-process memory profiling

**Date:** 17 November 2026 (Berlin)  
**Scope:** Test infrastructure only. The fixed-frame beta still has its 120-second project limit, and the original real-time MediaRecorder exporter is unchanged.

## Why this test exists

Phases 6D–6F established real successful MP4/WebM encoding for short synthetic clips, at 720p and 1080p, with 25-clip layouts, VFR sources and transparent overlapping layers. They did **not** measure native Chrome decoder/process memory or sustained 1080p export of moving footage.

## Actual-media scenarios

1. **1080p / H.264+AAC / 30 fps / 18 seconds**: 8 overlapping video clips alternating between two independently encoded 640×360 moving sources. Original audio is present, with per-clip volume and fades. The project also has a full-length JPEG background and transparent PNG overlay.
2. **720p / VP9+Opus / 25 fps / 30 seconds**: 25 overlapping video clips using the same pair of moving sources, plus background and transparent overlay. Many MediaBunny video sinks operate on clips sharing the same two original files.

Each output is independently inspected with FFprobe/FFmpeg for format, exact decoded frame count, resolution, duration, audio stream presence, nonzero audio during a clip and differences among frames sampled at the start/middle/end. The browser exporter must report 100% progress, release `Input` decoders, leave the preview playhead unchanged and download exactly once.

## Memory measurement method

While Chrome exports, the Node runner samples its Linux process tree approximately every 400 ms. For each Chrome process, it reads the kernel's `/proc/PID/smaps_rollup` **Pss** (proportional set size), summing PSS across the browser's renderer, GPU and other descendants. The log includes baseline, sampled peak, last measurement, number of samples, wall-clock and in-browser export time, process count and output file size.

PSS is a *sampled estimate* of total Chrome process memory, not an exact GPU allocation count or a device memory peak. Shared pages are proportionally allocated; sub-400ms spikes may be missed. Multiple test projects execute in one browser session, so the second test's baseline includes any retained browser state. Results must be interpreted as baseline and peak together, not as a hardware-independent memory benchmark.

**No arbitrary pass/fail memory ceiling is assigned** without an established device requirement. The test fails if memory metrics cannot be obtained or the encoded output is invalid.

## Status

Awaiting actual GitHub Actions execution. A successful test-script commit is not sufficient evidence of passing results. The longer tests do not justify automatically removing the two-minute beta limit.

## Remaining stabilization gaps

Actual Android hardware, alternative browser engines, prolonged 1080p multiple-source projects, memory across many successive exports in a tab, hardware GPU accounting, and source footage with camera-generated codec variations remain release-gate concerns.
