# Ihy v0.14 — MIDI Import and Main-Track Baseline

Permanent standalone route:

`https://cinaedvsstudios.github.io/Organon/tools/ihy/standalone.html`

## Changed

- Replaced the overlapping header layout with direct, labelled top-bar controls.
- Added labels beneath Composition, BPM, Key, Chord Mode, Armed Track, Quantise and Transpose.
- Added native `.mid` / `.midi` import alongside Ihy JSON.
- MIDI import reads standard MIDI note events, track names, program changes, BPM, embedded time signature and embedded key signature when present.
- Imported MIDI maps each source track into an editable Ihy track.
- A composition without user-created sections now displays one full-width **Main track** pill in the arrangement strip.
- User-created sections replace the generated Main track pill.
- The arrangement strip remains tied to the roll’s horizontal scroll position.

## Rollback

The prior UI baseline is preserved in Git history. This is the current direct-source baseline.