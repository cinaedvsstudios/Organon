# Ihy v0.12 — Note Placement, Chords and Inline Editing

Permanent standalone URL:

`https://cinaedvsstudios.github.io/Organon/tools/ihy/standalone.html`

## Changed in v0.12

- A single left click on blank piano-roll space now adds notes to the currently selected track.
- Added notes inherit the selected track’s instrument by default, rather than storing a separate note-level instrument override.
- Existing notes can still be dragged horizontally and vertically to change timing and pitch.
- Drag the right edge of an existing note to resize its duration.
- Replaced the right-click browser prompt with an inline dropdown-style note editor.
- The note editor offers track-instrument/default selection, individual instrument override, velocity, duration, Apply, Delete and Close controls.
- Added the Chord button immediately after the project-key selector in the header.
- Chord button state is saved locally and visibly highlighted when active.
- With Chord on, a click adds a key-aware diatonic triad at the selected position.
- The currently supported project keys use their matching major or natural-minor scale: D minor, A minor, C major, F major and G major.
- The clicked pitch is snapped to the closest valid note in the selected key before the root, third and fifth are created.
- Chord notes remain on the selected track and therefore use that track’s instrument during playback.
- Existing sampled-instrument playback, timeline playhead and extended keyboard remain unchanged.

## Rollback

Previous baseline: `5897791367f546aa903c8656f3ea853451a5347c` (v0.11 sampled instruments and red Stop control).