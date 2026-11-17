# MotoriClip — Phase 5: audio/video consistency, layers and media errors

**Date:** 17 November 2026 (Berlin)  
**Scope:** Stabilize the existing Advanced mode. No new transitions, procedural effects, export pipeline or Basic-mode changes.

## Implemented

1. **Single clock for picture and linked sound.** Importing a video now uses **one HTMLVideoElement** instead of a video element plus a second audio element for the same file. That element feeds both the video compositor and a `MediaElementAudioSourceNode` in the existing Web Audio mixer. Trim offsets, scrubbing, pause/resume and playback boundaries act on one media clock, avoiding drift between independent players and duplicate decoding. A video with no audio track remains importable and plays silently.
2. **Preserved mixing controls.** Video linked-sound mute, volume, preview mute, audio fades, standalone audio tracks and extracted-audio tracks still use the existing gain graph. Extracted audio is independently playable only after the user explicitly extracts it.
3. **Better codec diagnostics.** The editor uses `canPlayType()` to reject *known unsupported* containers at import time. `maybe`/ `probably` are not treated as proof of codec support: imports still have to decode. Decode errors, unsupported formats, aborted media loads and stalled metadata/first-frame loads produce specific messages. Video loading has bounded waits; a corrupt file should not stall forever.
4. **Runtime playback errors.** A media decoder error after successful import is surfaced in the preview and its player is paused; listeners are removed when the track is disposed. Playback promise rejections now surface a preview message instead of only logging.
5. **Compositing safety.** Backgrounds remain behind video tracks, with PNG stickers on top. Existing opacity, visibility and blend modes remain in use. A broken drawing operation on one visual layer reports an error and does not prevent other layers rendering; canvas alpha and blend state is restored after each layer. The final canvas remains black when nothing is behind an upper layer (true-alpha transitions are a separate later feature).
6. **Avoid half-completed edits.** When source decoding fails, a newly created timeline clip is removed. Split, duplicate, and extract-audio operations prepare their new media *before* modifying the original clip or muting its sound. Failed preparation leaves the existing edit in place.
7. **Cache refresh.** The Advanced controller and page use a Phase 5 cache-busting query. Basic mode is unchanged.

## Automated verification

**54/54 simulated-media regression tests passed**: 14 Phase 2, 12 Phase 3, 13 Phase 4, and 15 new Phase 5 tests, exercising the updated engine and its media-support module. The Advanced controller changes were additionally syntax-checked.

New test coverage:
- MIME detection and unsupported formats
- Failed decoders and actionable errors
- Timed-out media loads
- One video element for both picture and sound
- Silent video handling
- Independent audio-only tracks
- Per-clip linked audio fades, volume and mute
- Playback-time decoder failures
- Cleanup after codec load errors
- Background/video/sticker order and compositing alpha/blend
- Hidden/transparent layers
- Rendering failure in one layer not stopping others
- Audio extracted from a video container without premature MIME rejection
- Unsupported audio-only import cleanup

**Limitation:** These pass in a JavaScript simulated browser-media harness, not against a real browser decoding files. The new controller's UI workflow is syntax-checked but real drag/drop and edit interactions remain unverified.

## Real-browser acceptance checklist — outstanding

| ID | Scenario | Expected behavior |
|----|----------|-------------------|
| A01 | Import MP4/H.264 with stereo audio; play and scrub repeatedly | Picture and sound remain synchronized throughout |
| A02 | Put two videos at different timeline times under a long JPEG background | Each starts and stops at correct time; background visible in gaps |
| A03 | Import a completely silent video | Video imports and plays, with no unnecessary audio player |
| A04 | Place a separate WAV/MP3 alongside video with sound | Two independently controllable audio sources |
| A05 | Mute the video but leave the standalone audio audible | Independent gain paths behave correctly |
| A06 | Extract audio from a video then undo and redo | The extracted clip is independent, source video mute state restores |
| A07 | Change video volume and fade values across clips | No doubled sound; consistent fades |
| A08 | Put video above JPEG background; use opacity 50%, blend mode Screen | Background is visible through video according to blend rules |
| A09 | Add transparent PNG sticker above video | Correct native alpha, no solid black rectangle |
| A10 | Hide a video layer during playback | Lower video/background remains visible |
| A11 | Import unsupported MOV/AVI/MKV or unsupported codec on current browser | Clear actionable message and no failed empty timeline clip |
| A12 | Import truncated/corrupt MP4 | Error appears; editor remains responsive without a stuck loader |
| A13 | Split/duplicate/extract a video using corrupt source | Existing clip remains unmodified if new decoder load fails |
| A14 | Edit/undo/redo/clear repeated source files | Media elements/object URLs are released; no audio continues after clear |
| A15 | Test desktop Chrome/Edge and mobile when Advanced is selected | No unexpected autoplay restrictions or playback errors |
| A16 | Retest Phase 2/3 delayed clip starts, seeking, frame stepping and snapshot | No regression |

## Remaining concerns / later phases

- Real-device/browser tests above are required before declaring the editor stable.
- Accurate frame-by-frame export and project persistence are **Phase 6 / future baseline enhancements**.
- Intro/outro and between-clip transitions, alpha-preserving intermediate layers, the yellow-gold transition UI and schematic A/B inspector preview remain deferred until the release gate.
- The current media library still relies on formats supported by each browser. The video export phase will require explicit encoder/decoder compatibility handling.

### Technical references

- [MDN: MediaElementAudioSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/MediaElementAudioSourceNode)
- [MDN: HTMLMediaElement.canPlayType](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canPlayType)
- [MDN: MediaError.code](https://developer.mozilla.org/en-US/docs/Web/API/MediaError/code)
