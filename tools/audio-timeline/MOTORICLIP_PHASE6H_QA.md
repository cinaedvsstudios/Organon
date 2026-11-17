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

## Verified results — 17 November 2026

**GitHub Actions [44155884385](https://github.com/cinaedvsstudios/Organon/actions/runs/44155884385) passed**, including all 91 pre-existing Node regression tests and every established real-media browser stage. A second CI run confirmed the numbers in an earlier run [44155211914](https://github.com/cinaedvsstudios/Organon/actions/runs/44155211914).

The four consecutive output WebM files each had **200 decoded frames, 1280×720 resolution, approximately 8.02 seconds of duration, an Opus audio stream with RMS 0.0874, and valid VP9 video**. No export left pending inputs, output handles or a busy state. The original timeline and playhead remained usable.

| Cycle | Browser export time | Chrome PSS baseline | Peak PSS | PSS after GC and short idle |
|---|---:|---:|---:|---:|
| 1 | 4.90 s | 362.6 MiB | 700.7 MiB | 564.7 MiB |
| 2 | 5.00 s | 564.7 MiB | 895.3 MiB | 759.6 MiB |
| 3 | 4.88 s | 759.6 MiB | 998.1 MiB | 859.8 MiB |
| 4 | 4.87 s | 859.8 MiB | 996.3 MiB | 858.6 MiB |

After an additional idle/GC period the memory was **858.4 MiB**. Removing the project canvas and JavaScript references, invoking GC and allowing another short idle period left **860.1 MiB**. **Closing the entire editor tab/context then reduced Chrome process memory to 306.2 MiB**, below the pre-export baseline of 362.6 MiB, as the renderer processes were released.

**Interpretation:** The results reproduced active-tab memory retention and a plateau between cycles 3 and 4. The sharp recovery on tab closure is evidence against a permanently accumulating *browser-wide* leak in these conditions, but does **not** rule out a renderer-scoped memory leak, codec decoder caching, GPU allocations, or growth over longer sessions. No memory-budget thresholds were invented and no production exporter changes were warranted by these observations alone.

The first test version measured the four exports but not context shutdown; the second added the explicit context-close reading. Both completed their stages successfully. This is **repeatable short-project testing on Ubuntu/Chrome, not actual Android hardware or multi-hour production use**.

## Future release gate

If memory remains elevated between runs, distinguish codec/memory-pool retention from a growing reference leak using controlled page-close/reopen and browser restart comparisons. Further device/browser QA and real-world camera/phone footage remain necessary before Phase 7 completion or lifting the two-minute beta guard.
