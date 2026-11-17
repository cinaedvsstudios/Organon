# MotoriClip Phase 6C — fixed-timestamp export beta

**Date:** 17 November 2026 (Berlin)  
**Scope:** Opt-in experimental export path for the existing Advanced multitrack editor. Previous live MediaRecorder export remains available and unchanged. No transitions or project-save format changes.

## Implementation

- New **Fixed-frame export (beta)** button, separate MP4/WebM selector, shared progress/cancel dialog and reuse of project FPS, canvas size and video bitrate.
- Uses a version-pinned Mediabunny 1.66.0 browser ESM import from jsDelivr **only when this beta button is clicked**. The code is loaded from the CDN; user-selected media File objects are processed in the browser and are not uploaded by the exporter.
- Decodes each visible active video frame from a local File with Mediabunny `Input`, `BlobSource`, and `CanvasSink.getCanvas(timestamp)`. It requests frames at fixed project-grid timestamps, honoring `start`, `clipDuration` and `sourceOffset`.
- Reuses MotoriClip's canvas compositor in a **separate rendering-engine instance**, with copies of clip metadata. This preserves JPEG backgrounds, transparent PNG/sticker compositing, layer ordering, opacity and blend controls without changing the live project playhead or media players.
- Encodes the new canvas at explicit timestamps using `CanvasSource.add(timestamp,duration)`, `Output` and `BufferTarget`. MP4 requests AVC/H.264 video; WebM requests VP9 video. Native WebCodecs encoder support is still browser-dependent.
- When audible tracks exist, uses Mediabunny's `AudioBufferSink` to decode the primary audio track of each File and `OfflineAudioContext` to mix it at its timeline position. Applies per-track mute, volume and fade envelopes. The final single buffer is encoded using Mediabunny `AudioBufferSource` (AAC for MP4; Opus for WebM). Silent videos create no unnecessary audio track.
- Explicit resource cleanup/cancellation: disposes all `Input` decoders; cancels unfinished `Output`; does not download partial media. Beta refuses to start while preview is playing.
- Deliberate **120-second project length limit** while memory, decode performance and real output quality are not yet characterized.

## Automated source-level verification

**13 new mock-Mediabunny/WebAudio cases passed**, covering:
1. Exact FPS frame timestamps and short final-frame duration
2. Clip interval boundaries and trimmed source offsets
3. Overlapping audio-fade envelope math
4. Full MP4 video + audio scheduling, download metadata and cleanup
5. Silent video with no audio track
6. Timeline video gaps and offset sampling
7. Trimmed audio slice placement
8. Encoder-failure cleanup
9. Beta length and unsupported-format guards
10. Cancellation while loading the export library
11. Refusing export during active preview
12. Per-clip audio mute
13. Cancellation during a blocked encoder add

These are **simulated APIs**, not actual encoded media files; no claim of validated MP4/WebM outputs, perfect frame cadence or audio lip-sync is made.

## Real-browser tests required

| ID | Procedure | Acceptance |
|---|---|---|
| O01 | Chrome/Edge: one 6-second MP4 + linked audio, beta MP4 720p/25 | Opens in players; duration 6s; sounds correct |
| O02 | Export same project using WebM VP9/Opus | Plays with correct audio/video; correct extension/container |
| O03 | Two videos at 3–6s and 7–10s above JPEG 0–12 | Exact cuts and background-only gaps; no missing frames |
| O04 | Two overlapping video layers plus transparent PNG | Same layer order and opacity as preview |
| O05 | Chroma-keyed sticker and different blend modes | Composite frames match live preview |
| O06 | Source offset > 0, trimmed right edge | First and last source frames correspond to crop |
| O07 | Separate music and sound effects with volume, mute, fades | No double audio; envelope levels and gaps correct |
| O08 | Silent video and audio-only timelines | Video-only or black-background + audio file is valid |
| O09 | 24/25/30/50/60 fps, 720p and 1080p | Count decoded frames and output timestamps; no skips |
| O10 | Cancel during decoder load / video encoding / audio mix | No partial download, live editor unaffected, retry works |
| O11 | Reject unsupported source codec or missing video/audio tracks | Clear actionable message; live export still available |
| O12 | Compare under high CPU load versus real-time export | Stable frame count and duration without wall-clock dependence |
| O13 | 2, 10 and 25 clips (within 120s limit) | Measure peak memory, elapsed time and decoded outputs |
| O14 | Request with unavailable WebCodecs or external library blocked | Beta disabled or errors cleanly; real-time export remains |
| O15 | Verify downloadable file in an independent player with ffprobe | Container, actual codec, resolution, stream durations and A/V offset match |

## What remains before Phase 6/7 release signoff

This is a **beta implementation**, not final proof of deterministic output. Actual browser encode/decode behaviour, Memory pressure and codec support need confirmation. No tab/browser automation in this session was available to run the real-media test matrix, and the new library must load successfully over the internet.

The fixed frame-grid pipeline is structurally timestamped rather than depending on real-time playback. Its final release quality remains contingent on real encoded-file tests, error profiling and potentially streaming output for projects beyond two minutes.

Existing MediaRecorder export stays as the fallback. Do **not** treat Phase 6's release gate as completed or begin transition effects until real-media acceptance is met.

## API references

- [Mediabunny CanvasSource](https://mediabunny.dev/api/CanvasSource)
- [Mediabunny CanvasSink](https://mediabunny.dev/api/CanvasSink)
- [Mediabunny AudioBufferSink](https://mediabunny.dev/api/AudioBufferSink)
- [Mediabunny AudioBufferSource](https://mediabunny.dev/api/AudioBufferSource)
- [Mediabunny Output creation](https://mediabunny.dev/guide/quick-start)
