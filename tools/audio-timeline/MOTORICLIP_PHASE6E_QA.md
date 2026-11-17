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

## Status — verified real-media tests

**All Phase 6E tests passed** in [GitHub Actions run 44143534849](https://github.com/cinaedvsstudios/Organon/actions/runs/44143534849) on 17 November 2026, including the previous smoke test and **88 existing Node regression tests**.

| Case | Actual output | Frames | Browser render time* | Outcome |
|---|---|---:|---:|---|
| 720p / 24 fps MP4 | 2.005 s, H.264/AAC | 48 | 978 ms | PASS |
| 1080p / 30 fps MP4 | 1.813 s, H.264/AAC | 54 | 858 ms | PASS |
| 720p / 60 fps WebM | 1.820 s, VP9/Opus | 108 | 901 ms | PASS |
| 10-clip / 25 fps WebM | 4.420 s, VP9/Opus | 110 | 395 ms | PASS |
| 25-clip / 24 fps MP4 | 6.251 s, H.264/AAC | 150 | 667 ms | PASS |

*Measured on the GitHub CI runner with solid-colour synthetic clips; **not** representative of export speed for high-bitrate real-world footage. Media files were 320×180 constant-frame-rate source clips, scaled/encoded at the stated outputs.

The two sequential-video HD/FHD scenarios met the timing assertions: video and audio starts within 90ms and ends within 110ms of the requested clip boundaries. Real frame sampling verified red/blue source order, including 24fps and 60fps **constant-frame-rate** input videos.

The browser also passed **live cancellation and retry**: the cancelled WebM produced no partial download, cleared its decoder/output state, and the next export succeeded. Corrupt input was rejected as undecodable, with no output or retained inputs.

JavaScript heap deltas were logged (from about -6.9MB to +11.3MB across runs), but they are only snapshots affected by garbage collection; **peak native decoder memory was not measured**. The tests did not exercise long-form exports, other platforms or genuine VFR source media.

This phase introduces **test code only**, with no changes to the live MotoriClip export/preview engines or transitions.

## Remaining release-gate limitations

These checks will not prove behavior across every browser or codec. Further work may include:
- Handling genuine variable-frame-rate source files rather than constant 24/60 fps sources.
- Full 1080p WebM, sustained 25-clip renders at 1080p and multiple minutes of video.
- Memory high-water mark and Chrome/Android device testing.
- Detailed audio frequency / lip-sync verification and actual rendered fades/overlays beyond positional checks.
- UI testing of both Basic/Advanced launch paths and editor controls.

Until those are addressed or accepted explicitly, keep Phase 7 and the transition effects on hold.
