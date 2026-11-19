# MotoriClip Phase 6L — full-duration 1080p export and memory release QA

**Date:** 19 November 2026 (Berlin)

## Purpose

Verify the **existing** fixed-frame beta's **120-second maximum** at 1920×1080/30fps using real encoded/decoded H.264/AAC MP4 in Linux Chrome. This extends the passing [Phase 6K](./MOTORICLIP_PHASE6K_QA.md) matrix (60s at 1080p, 120s at 720p). It **does not** remove the 120-second limit, change production code, or introduce transitions.

## Test project and checks

- 120-second, 1080p, 30fps, 5,000 kbps project; **3,600 decoded frames** expected.
- Sixteen staggered moving video clips alternating two FFmpeg-generated ten-second H.264/AAC files, with varied start positions, deliberate overlaps and linked audio. Each clip remains within its source duration.
- Full-project JPEG background and a transparent PNG overlay; final clip ends at 118.65 seconds, leaving a background-only/silent tail.
- Export via MotoriClip's real browser-based fixed-frame exporter. Verify one download, finished state, progress 100%, no residual input handles, unchanged preview playhead and no uncaught browser errors.
- Independent FFprobe/FFmpeg inspection of **actual output**: 1920×1080, H.264 video and audio stream, exact 3,600 decoded frames, approximately 120-second container duration, different frame content across early/middle/late timeline, audible audio at beginning and 108s, silence near end.
- Report actual output size and elapsed browser encoding time. Sample entire Chrome process-tree proportional set size (PSS) before/during/after export and after explicit GC; close the browser context and sample PSS again to characterize native-memory release. Memory observations are **not** a guarantee of leak-free operation or transferable thresholds for other hardware.

## Platform scope

This phase targets **Chrome**, with existing **Firefox** and mobile-layout/Android-style Chrome regression coverage retained. It does not undertake additional Safari or Apple-device certification. Physical Windows and Android real-camera tests remain useful for release confidence, but lack of Apple-specific testing will not block the user-requested transition work.

## CI and release gate

[GitHub Actions real-media workflow](../../.github/workflows/motoriclip-real-media.yml) runs the 6L scenario as a separate opt-in invocation using `MOTORICLIP_FULLHD120=1`, keeping 6G/6K and the other browser tests intact.

## Verified results — 19 November 2026

[GitHub Actions 44444292206](https://github.com/cinaedvsstudios/Organon/actions/runs/44444292206) passed both Chrome and cross-browser CI jobs; [PR #42](https://github.com/cinaedvsstudios/Organon/pull/42) is merged.

- Real downloaded **MP4 H.264/AAC**, **1920×1080 / 30 fps**, **120.000 seconds** duration and **3,600 decoded video frames**.
- Exported file size: **73.08 MiB**. Browser render time: **229.9 seconds**.
- Validated 16 moving clips, background, transparent sticker, changing early/middle/late frames, audio RMS **0.0436** early and **0.0439** at 108 seconds, with **0.0000** in the trailing background-only interval.
- Chrome process-tree PSS: **340.5 MiB baseline**, **1,194.1 MiB peak**, **949.3 MiB after idle/explicit GC**, and **307.4 MiB after closing the browser context** (949.4 MiB immediately before closing).
- Existing UI, media integrity, near-limit 720p, repeat-export and Firefox tests passed in the same run.

These results demonstrate real Linux Chrome full-duration 1080p export success at the existing beta cap. Memory measurements are observational, not a guarantee of leak-free operation on Windows/Android. Physical Windows and Android real-camera exports remain unverified. Apple-device certification is out of the user-requested priority scope and does not gate transition development.
