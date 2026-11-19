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

The standard Phase 6G 18-second/30-second test matrix still runs as before. Phase 6K uses the *same* test harness in a second invocation so old coverage is preserved. GitHub Actions' Chrome job includes a dedicated 18-minute step timeout, plus extra APT mirror retries and a longer FFmpeg installation allowance to reduce CI infrastructure flakes.

## Release status and open items

These are **synthetic-media, Linux Chrome** tests. They do not validate actual iPhone/Android camera media, hardware-accelerated Safari/macOS encoding, mobile long-form stability, or Linux WebKit audible export (guarded in Phase 6J). No transitions or transition designer have been introduced. Phase 7 signoff remains open until hardware and manual acceptance tests are completed.

**CI status at authoring:** Pending PR workflow results. Report exact run and measured results in the PR after GitHub Actions finishes.
