# MotoriClip — Phase 4: editing history and resource lifecycle

Date: 17 November 2026 (Berlin)  
Scope: Advanced editor only. No transitions, new export pipeline or changes to Basic Mode.

## Implemented

**Undo/redo model**
- History snapshots now explicitly copy only clip metadata (IDs, timings, group/layer properties, visibility, audio/transparency settings and waveform levels). They do **not** copy `HTMLVideoElement`, `HTMLAudioElement`, Web Audio nodes, object URLs, or raw `File` objects.
- The project's File objects live in a separate **in-memory source registry**, keyed by file ID. History records source IDs, not binary data.
- Undo/redo rebuilds deleted clips from the registry, but **reuses a live clip's existing player** when the source and clip ID have not changed (moves, trims, grouping and inspector changes).
- Replacement media is loaded before dropping the existing player. If preparing a restore fails, the previous live state is retained and the failed restore is reported.
- Selection, group IDs, source offsets, duration, opacity, audio settings and effects settings are preserved in metadata.
- Old source File references are retained only while present in the live project or a bounded undo/redo history state (60 undo steps).

**Resource lifecycle**
- `AdvancedMediaEngine.setTracks()` automatically disposes media for removed/replaced tracks even when controllers filter the track array.
- `clearAll()` releases the active players, Web Audio connections and object URLs; users can still undo a clear while its media files remain in history.
- Partially loaded video/audio/image imports now have abortable metadata waits and tracked pending loads. Removing a clip or clearing a project aborts those loads.
- Detaching a clip stops media playback, disconnects Web Audio nodes, removes attached media elements, clears their `src` and revokes the object's URL.
- Stale waveform analysis is ignored if the original track has already been removed/replaced. Delayed Project File imports do not resurrect clips after deletion.

**Source ID propagation**
- Imported clips, split right-hand clips, duplicates and extracted audio now carry their original project file IDs, so undo can reload them reliably.
- Validations reject duplicate clip IDs, negative/non-finite clip timings and missing source file IDs during history reconstruction.

## Automated verification

**39 passing JavaScript tests in the harness:** 14 original playback tests, 12 frame-seek tests and **13 Phase 4 tests**.

Phase 4 cases covered:
1. Snapshots excluding media handles and even tolerating cyclic live runtime references
2. Independent deep copies of audio, chroma and waveform settings
3. File reference rehydration from the registry
4. Invalid metadata and duplicate-ID rejection
5. Retention of source references through Clear Project undo and redo
6. Reusing media for move/trim undo without re-decoding
7. Rebuilding deleted clips with exact source offsets and durations
8. Failure recovery during multi-clip restoration
9. Preserving runtime media/audio nodes while restoring metadata
10. URL/audio/media disposal after array filtering
11. Clear Project cleanup and successful subsequent new-track use
12. Cancellation of pending video metadata loading during Clear Project
13. Cancellation of pending video loading after timeline removal

All counts refer to simulated HTMLMediaElement/Web Audio behaviour and source-code testing; no device-browser pass is claimed.

## Real-browser acceptance checklist (still pending)

| ID | Scenario | Expected |
|---|---|---|
| H01 | Import MP4, JPEG, PNG and WAV; create several tracks | All files and media previews work |
| H02 | Move/trim a clip, undo/redo repeatedly | Correct clip position and source offset without audio interruption or reload regression |
| H03 | Split a clip, undo split, redo split | Same source file and exact left/right durations |
| H04 | Duplicate a clip, undo, redo | Duplicate maintains original trim and audio settings |
| H05 | Extract audio, undo, redo | Correct linked/extracted audio and mute states |
| H06 | Delete a playing video, then undo | Removed audio stops; undo recreates media that can play |
| H07 | Delete a full layer from context menu, undo | Track comes back with correct file and settings |
| H08 | Clear Project, undo, redo | Clear removes all players; undo restores; redo clears again |
| H09 | Import again after clearing | New file plays; no stale hidden media continues |
| H10 | Rapidly clear while large video is loading | Pending load cancels and does not return |
| H11 | Modify opacity, blends, fades and chroma settings; undo/redo | Parameters correctly restored |
| H12 | Group/ungroup via history and drag grouped clips | Group identifiers and per-clip positions restored |
| H13 | Stress repeated delete/undo for 20+ clips | No accumulating object URLs or unexpected playback |
| H14 | Test MP4 containing no audio and files with unsupported codecs | Errors remain actionable; no orphaned media |
| H15 | Repeat phases 2 and 3 (delayed starts, scrub, snapshots) | No regressions |

## Known limitations and following phases

- History is **session-only**. Saving/reopening a project across browser sessions remains future work; File objects are deliberately not serialized into JSON.
- Native browser media decoders may still reject unsupported codecs.
- Audio/video drift and linked sound synchronization remain **Phase 5**.
- Advanced video rendering/export and performance profiling remain **Phase 6**.
- The new yellow-gold transitions, A/B colour preview and transparent entrance/exit transitions remain **after the stabilization release gate**.
