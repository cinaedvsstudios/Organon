# MotoriClip Phase 3 — Frame seeking, scrubbing and PNG snapshots
Date: 2026-11-17 (Berlin)
Branch: `motoriclip/phase3-frame-seeking`
Scope: Stabilise existing Advanced preview and frame capture; **not** transitions or a new export pipeline.

## Implemented

1. **Decoder-aware paused seeking:** Active, visible video clips now wait for a completed seek and `HAVE_CURRENT_DATA` before the composition canvas is redrawn. Where supported, `requestVideoFrameCallback` provides additional compositor-frame confirmation; a bounded fallback supports paused browsers that do not issue frame callbacks.
2. **Latest scrub request wins:** New seek requests abort earlier waits, detach event handlers and cancel video-frame callbacks, preventing stale asynchronous completions from repainting an old frame.
3. **Avoid unnecessary decoding:** Scrubbing only seeks active visible video clips. Inactive clips are positioned when they later start playing, not every time the playhead moves.
4. **Project frame-rate selector:** 24, 25, 30, 50 or 60 fps in the Advanced Project panel. Previous/Next Frame now aligns movement to the chosen project frame grid, not an unconditional 30fps offset. Manual frame stepping pauses transport.
5. **PNG snapshots:** The existing snapshot waits for the latest paused frame before compositing and saving, using the filename `motoriclip-frame.png`. PNG remains the only snapshot format in this stabilization phase.
6. **UI error handling:** Timeline ruler seeks, slider scrubs and step buttons report decoder errors in the preview rather than leaving unhandled promise rejections.
7. **Browser cache refresh:** Advanced entry and engine imports receive new build query versions. Basic Mode remains unchanged.

## Automated checks (mock/browser-emulation harness)

**26 passing cases:** the 14 Phase 2 playback/scheduler cases plus 12 new Phase 3 cases. They exercised actual Advanced media-engine methods with simulated HTMLMediaElement seeking and frame callback events.

The new Phase 3 cases cover:
- Project FPS normalization and forward/backward frame-grid positioning
- Waiting for `seeked` before accepting a newly decoded frame
- Seeking to the already-current position (which does not emit `seeked`)
- Aborting stale media waits and preserving the latest requested frame
- Suppressing stale canvas draws during paused seek
- Rapid sequential scrub cancellation
- Manual single-frame advance leaving playback paused
- Preserving playback intent across slider input/change
- Saving PNG only after the most recent seek completes
- Still-image-only composition without a video decoder
- Avoiding seeks into inactive video clips
- Browser fallback without a compositor callback

The passing count is for JavaScript simulation only: **not** a claim that real MP4 decoding has been verified.

## Required real-browser QA before declaring frame accuracy fully validated

| ID | Procedure | Expected | Status |
|----|-----------|----------|--------|
| F01 | Open MotoriClip Advanced, set project FPS to 25, step 5 frames | Each step moves 0.04s on project grid | Pending |
| F02 | Import 24-, 30- and 60-fps test MP4s; pause, seek within each | Frame corresponds to requested position within decoder/source limitations | Pending |
| F03 | Rapidly drag playhead between beginning, middle and end | No older decoded frame flashes after the final position has loaded | Pending |
| F04 | Put a JPEG background under two upper-track videos; seek through gaps | Correct composition and background in gaps | Pending |
| F05 | Pause on a distinctive source frame and save PNG | Saved PNG visibly matches displayed composite | Pending |
| F06 | Trigger PNG while the preceding seek is still decoding | PNG matches the most recent seek, not the earlier frame | Pending |
| F07 | Step while playback is running | Transport pauses and displays next project-grid frame | Pending |
| F08 | Scrub during playback and release slider | Playback resumes, subject to browser gesture policy | Pending |
| F09 | Scrub a 15–25-clip project | Inactive video elements are not repeatedly decoded; UI remains responsive | Pending |
| F10 | Test in current desktop Chrome/Edge and mobile Chrome where Advanced is selectable | No errors or hung seeking | Pending |
| F11 | Verify Phase 2 delayed starts, linked sound, and mute/volume remain correct after seeks | No regression | Pending |
| F12 | Try unsupported video codec, corrupt video and near-end seeks | Clear error; editor stays responsive | Pending |

## Precision boundaries

The chosen **project FPS** defines the timeline stepping grid. It does not automatically convert or discover source frame rates. Browser `HTMLMediaElement.currentTime` seeks and `requestVideoFrameCallback` are best-effort: exact arbitrary-frame access and deterministic rendered-video export require the later decoder/encoder pipeline.

Reference:
- [MDN: seeked event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event)
- [MDN: readyState](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState)
- [MDN: requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)

Next phase: **Phase 4 — undo/redo, editing integrity and media cleanup**.
