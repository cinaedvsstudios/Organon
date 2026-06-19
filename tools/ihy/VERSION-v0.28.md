# Ihy v0.28 — Single-Controller Repair Baseline

## Changed

- Removed the Example button and moved Clear into its former Controls slot.
- Removed all legacy companion controller scripts from the live page. Ihy now loads one application controller only.
- Rebuilt Play/Pause and Stop so Pause preserves the current position and Stop returns the playhead to 0:00.
- Rebuilt Clear so it clears the currently armed track after confirmation.
- Rebuilt MIDI/JSON import through one parser and one file-change path.
- Restored real Mute and Solo playback filtering, and added Hide as a piano-roll-only track control.
- Centers C4 on initial load and adds cyan guide rows for every C, with a stronger C4 guide.
- Removed the repeated instrument name from track rows.

## Rollback

Previous baseline: v0.27.