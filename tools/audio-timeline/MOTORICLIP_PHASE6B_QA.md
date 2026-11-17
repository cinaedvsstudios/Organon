# MotoriClip Phase 6B — Advanced real-time video export (first working export path)

**Date:** 17 November 2026 (Berlin)
**Scope:** Existing Advanced multitrack editor only. Basic mode unchanged; no transitions, no project-save format.

## What was implemented

- An **Advanced Video Export** panel in Project Controls with a format selector that lists **only formats supported by that browser's `MediaRecorder.isTypeSupported()`**. WebM is offered where native WebM recording exists. MP4 is offered only if the browser supports native MP4 recording. No false renaming or container conversion.
- Selectable video bitrate: 3, 6 (default), 10, or 16 Mbps. The **project FPS** selector (24/25/30/50/60) and **canvas width/height** determine recorder settings.
- **Full-timeline recording from 0**: first frame is decoded, then canvas is captured via `HTMLCanvasElement.captureStream(fps)`; the existing timeline playback engine supplies layered composition with backgrounds, videos and PNG stickers.
- **Mixed audio**: connect each existing clip's Web Audio gain node to a temporary `MediaStreamAudioDestinationNode`, so fades/mute/volume affect the file. The preview speaker route is temporarily muted **without** changing the actual recorded mix.
- A modal progress overlay with timeline % / current vs total duration, visible **Cancel & Discard**, and a keyboard Escape shortcut. Underlying timeline editing is blocked by the overlay while the recording is active.
- Recording finishes at normal timeline end; the browser download is named `motoriclip-project.webm` or `motoriclip-project.mp4` according to **actual output MIME**. Partial recordings are discarded on cancel/error.
- Clean teardown: stop capture tracks, disconnect the temporary audio destination (leaving existing preview nodes intact), restore preview mute/volume, seek back to the user's prior timeline position, and restore original playback and rendering callbacks.
- A hidden browser tab or preview decoder/render error **aborts** export rather than saving a known-incomplete movie. Start failures and MediaRecorder errors produce specific messages. Format and capture support are checked before enabling Render & Save.

## Critical limitations (do not misrepresent these)

**This is a browser-native real-time recorder, NOT deterministic offline rendering.** Output takes roughly the duration of the video. Resource contention can cause the browser to drop capture frames or slip audio/video timing. Therefore Phase 6's final "no skipped frames / fully matching preview" release gate is **not yet proven**.

**MP4 support is browser-dependent.** WebM support is also browser-dependent. A browser may advertise recording support and still fail at runtime, so user-visible errors and cancellation are essential.

The current output uses `MediaRecorder`, not WebCodecs or Mediabunny, and has no frame-by-frame timestamp control, encoder introspection, or sample-accurate audio-mixing guarantees. Deterministic export remains a separate follow-up within Phase 6 before the Phase 7 release gate.

## Automated verification completed

**13/13** new export-specific mock-API tests passed against the export controller source, covering:
1. Available format negotiation
2. Accepted bitrate presets
3. Full-timeline recording, canvas + audio tracks, progress and cleanup
4. Video-only projects with no unnecessary audio track
5. Actual native MP4 labeling
6. Cancellation discarding partial output
7. Preventing concurrent exports
8. Cancelling export when the tab becomes hidden
9. Native recorder failure and full stream teardown
10. Unsupported formats, empty timeline, unavailable recording APIs
11. Failed first-frame preparation
12. Restoration of an initially absent playback callback
13. Aborting when preview decoding/rendering fails

These are JavaScript fake-recorder tests; no actual MP4/WebM was rendered in Chrome/Edge from this environment. The Phase 6A preview cache has five separate passing tests, while the previous Phases 2–5 had 54 simulated tests.

## Real-browser validation required

| ID | Test | Acceptance |
|---|---|---|
| E01 | Record 10-second single video with sound at 720p/30fps | Output plays, proper length, no silent audio |
| E02 | Record videos at 3–6s and 7–10s above a 12s JPEG background | Both clips appear at the correct times; gaps show only the background |
| E03 | Record with PNG overlay and 50% opacity upper video | Composite order and blending match preview |
| E04 | Record independently muted/volume-adjusted video and audio tracks | Mix matches audio controls; preview volume knob does not change exported mix |
| E05 | Import video with no sound | Valid video-only/silent result |
| E06 | Change canvas to 1920×1080, set 25 or 60fps, choose multiple bitrates | Recorder uses selected output settings where browser supports them |
| E07 | Select WebM, then MP4 when available | Download extension and actual file container match |
| E08 | Cancel mid-render | No partial download; UI, audio and timeline restore |
| E09 | Hide/switch browser tab | Clear error; discard output, restore UI |
| E10 | Trigger a decoder failure during recording | Abort without saving broken output |
| E11 | Repeat after completing and cancelling | New export starts and saves; no leaked audio graph / stream tracks |
| E12 | Try 2, 10 and 25 mixed clips at 720p and 1080p | Record FPS, CPU, memory, duration mismatch and audio/video drift; compare to Phase 6A profile |
| E13 | Test Chrome/Edge/Firefox and Android Advanced mode | Unsupported formats disabled with useful messages; permitted formats actually save |
| E14 | Compare produced file against timeline duration and cut boundaries | Quantify any dropped frames/black frames before declaring release-ready |

## Next engineering tasks within Phase 6

1. Run browser/real media QA above, ideally with short synthetic test cards and distinct audio tones.
2. Build **deterministic** MP4/WebM export using supported WebCodecs + a muxing layer such as Mediabunny. Ensure encoder availability checks, real composited-frame timestamps, offline audio mixing and robust cancellation.
3. Add media-file output verification (duration, dimensions, frames near each boundary, audio start/end) and larger-project performance measurements.
4. Phase 7 regression gate can only be signed off after those results; do **not** start yellow-gold transitions on the assumption that the current live recorder is frame-accurate.

## References
- [MDN: HTMLCanvasElement.captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream)
- [MDN: MediaStreamAudioDestinationNode](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioDestinationNode)
- [MDN: MediaRecorder.isTypeSupported](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)
- [Mediabunny documentation](https://mediabunny.dev/guide/introduction)
