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

## Verified results — 17 November 2026

**GitHub Actions run [44153464101](https://github.com/cinaedvsstudios/Organon/actions/runs/44153464101) completed successfully** on pinned Ubuntu 24.04. All **91 Node regression tests** and the earlier real-media browser suites passed alongside these new stress checks.

| Metric | 1080p H.264/AAC | 720p VP9/Opus |
|---|---:|---:|
| Length | 18.005 seconds | 30.020 seconds |
| Clips | 8 videos + background + PNG | 25 videos + background + PNG |
| Decoded output frames | 540 | 750 |
| Output size | 10.97 MiB | 7.77 MiB |
| Browser encoding elapsed | 22.792 seconds | 24.926 seconds |
| Total test elapsed | 24.435 seconds | 26.618 seconds |
| Sampled Chrome PSS before | 351.3 MiB | 923.0 MiB |
| Sampled Chrome PSS peak | **1,034.3 MiB** | **1,045.7 MiB** |
| Sampled Chrome PSS at last observation | 911.4 MiB | 1,016.1 MiB |
| Number of PSS samples | 58 | 63 |
| Audio RMS during source clip | 0.0436 | 0.0437 |

The moving footage outputs included the expected stream types, exact frame counts and output dimensions. Sampled start/mid/end frames differed, so the visual result was not a frozen image. Audio was audible at the chosen active-clip sample. The beta returned a single completed download, reached 100% progress and released its `Input` registry after both scenarios.

**Interpretation:** On this runner, the browser's sampled proportional memory reached approximately **1 GiB** during both cases, substantially more than the baseline of an idle browser. After the first export the last sampled PSS was 911.4 MiB, rather than returning to 351.3 MiB, and the second began at 923.0 MiB. This is **not conclusive evidence of a memory leak** because Chromium may retain memory, decoder state and caches; the test did not force garbage collection, wait through an idle stabilization period or measure GPU allocations separately. It does establish a reproducible reason for keeping the two-minute beta limit until repeated-export memory behaviour is tested.

The first CI attempt failed at dependency setup when `ubuntu-latest` did not offer `ffmpeg`; the workflow is now pinned to Ubuntu 24.04 for consistent FFmpeg/ffprobe packages. A later harness failure stemmed from using Puppeteer's `browser.process()` API with Playwright; the memory profiler now discovers Chrome processes as descendants of the Node runner and explicitly excludes Node's own memory. Neither error was an editor encoding failure.



## Remaining stabilization gaps

Actual Android hardware, alternative browser engines, prolonged 1080p multiple-source projects, memory across many successive exports in a tab, hardware GPU accounting, and source footage with camera-generated codec variations remain release-gate concerns.
