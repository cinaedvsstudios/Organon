# MotoriClip Phase 6E — expanded real-media acceptance testing

Date: 17 November 2026 (Berlin)

The fixed-frame export beta already passed a controlled **320×180, 25 fps, 4-second** MP4/WebM test in [Phase 6D](./MOTORICLIP_PHASE6D_REAL_MEDIA_QA.md). The aim of this phase is to test stronger rendering and recovery cases before Phase 7.

## Added test coverage

New [extended-export.browser.mjs](./tests/extended-export.browser.mjs), exercised by the [GitHub Actions workflow](../../.github/workflows/motoriclip-real-media.yml), uses actual Chrome/WebCodecs/Mediabunny exports and checks FFmpeg-decoded outputs.

| Scenario | Container | Output | Project FPS | Video clips | Duration |
|---|---|---|---|---|---|
| 720p-24-MP4 | MP4 H.264/AAC | 1280×720 | 24 | 2 | 2 seconds |
| 1080p-30-MP4 | MP4 H.264/AAC | 1920×1080 | 30 | 2 | 1.8 seconds |
| 720p-60-WebM | WebM VP9/Opus | 1280×720 | 60 | 2 | 1.8 seconds |
| 10-clip-WebM | WebM VP9/Opus | 640×360 | 25 | 10 | 4.4 seconds |
| 25-clip-MP4 | MP4 H.264/AAC | 640×360 | 24 | 25 | 6.25 seconds |

Video inputs are **24 fps red** and **60 fps blue** H.264/AAC clips to check source-rate conversion to the project FPS. They are local synthetic media, not uploaded user footage. JPEG background and transparent PNG sticker remain part of every case.

For each output, tests inspect actual encoded dimensions, frame count, total duration, central pixel colour at sampled clips, and presence of a real audio stream. For the two HD/FHD sequential cases, sound-onset and sound-end timing are measured around source video boundaries, with under-90ms start and under-110ms end tolerance.

A separate actual-browser test cancels an export while frames are being encoded, verifies no output download and cleaned-up decoder state, then retries on the same exporter. Another checks that corrupt MP4 input fails with an error, no download and no retained decoder.

Elapsed render time, output file size and available JavaScript heap information are recorded. These measurements are exploratory, not yet strict pass/fail performance budgets.

## Status

**New tests added on an isolated branch; test execution not yet confirmed.** Results must come from a completed GitHub Actions job before being marked passing. This phase does not change the existing real-time exporter or introduce transitions.

## Remaining release-gate limitations

These checks will not prove behavior across every browser or codec. Further work may include:
- Handling genuine variable-frame-rate source files rather than constant 24/60 fps sources.
- Full 1080p WebM, sustained 25-clip renders at 1080p and multiple minutes of video.
- Memory high-water mark and Chrome/Android device testing.
- Detailed audio frequency / lip-sync verification and actual rendered fades/overlays beyond positional checks.
- UI testing of both Basic/Advanced launch paths and editor controls.

Until those are addressed or accepted explicitly, keep Phase 7 and the transition effects on hold.
