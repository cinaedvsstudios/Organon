# MotoriClip Phase 6K — near-limit real export and sustained memory QA

**Date:** 19 November 2026 (Berlin)  
**Scope:** Test-only extension of existing Chrome/FFmpeg acceptance; no editor UI, export-engine, codec, URL, or default-mode changes.

## Scenarios

Use the existing moving-source real-media browser harness with two additional opt-in CI scenarios (`MOTORICLIP_LONGFORM=1`):

1. **1080p MP4/H.264/AAC, 60 seconds at 30 fps:** 8 staggered moving clips, static JPEG background, transparent PNG overlay, audio and a deliberate final background-only gap; expect **1,800 decoded frames**.
2. **720p WebM/VP9/Opus, 120 seconds at 25 fps:** 25 staggered moving clips, background, overlay and clip audio; expect **3,000 decoded frames**. Exactly the existing fixed-frame beta export cap; do not increase the cap.

Each must validate actual downloaded media with FFprobe/FFmpeg, covering output resolution, decoded frame count, duration, motion across the timeline, audio at an early and a late timestamp, and silence in the final background-only interval. Also assert export completion, one download, 100% progress, released input handles, and unchanged playback playhead.

## Memory measurement

Collect Chrome-process **proportional set size (PSS)** at 400 ms intervals, report baseline, peak, last sample and a post-idle/explicit-GC observation. These figures are Linux CI observations; not a universal mobile-memory benchmark, proof of zero leaks, or a release-blocking arbitrary upper threshold. Phase 6H provides the separate repeated-export/context-close memory recovery characterization.

The standard Phase 6G 18-second/30-second test matrix still runs as before. Phase 6K uses the *same* test harness in a second invocation so old coverage is preserved. GitHub Actions' Chrome job includes a dedicated 18-minute step timeout, and a prebuilt FFmpeg/FFprobe setup action to avoid intermittent slow Ubuntu package mirrors that blocked earlier Chrome CI runs.

## Release status and open items

These are **synthetic-media, Linux Chrome** tests. They do not validate actual iPhone/Android camera media, hardware-accelerated Safari/macOS encoding, mobile long-form stability, or Linux WebKit audible export (guarded in Phase 6J). No transitions or transition designer have been introduced. Phase 7 signoff remains open until hardware and manual acceptance tests are completed.

## Verified results

**GitHub Actions:** [Run 44439211155](https://github.com/cinaedvsstudios/Organon/actions/runs/44439211155) passed both `export-browser` and `cross-browser-ui`, and [PR #41](https://github.com/cinaedvsstudios/Organon/pull/41) was merged. The near-limit Chrome test decoded **1,800 frames** from a **60.0107-second** 1080p MP4 (35.41 MB), with **1,090.8 MiB peak PSS** and **907.1 MiB post-GC PSS**. The 120-second 720p WebM decoded **3,000 frames** over **120.02 seconds** (32.63 MB), with **1,099.7 MiB peak PSS** and **906.8 MiB post-GC PSS**. Early/late audible RMS was approximately 0.044 and the final background-only gap was silent (RMS 0) in both scenarios. Playback was not mutated; export progress and input cleanup assertions passed.

These measurements establish real Linux Chrome export success at the existing 120-second beta limit, not a guarantee of leak-free or hardware-accelerated behaviour on all devices.
