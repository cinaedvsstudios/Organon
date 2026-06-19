# Ihy v0.29 — Piano-Roll Editing Baseline

The live standalone page now loads only these complete v0.29 sources:

- `standalone-v029.css`
- `standalone-v029.js`

## Edit modes

- 🎶 Add mode is the default. Clicking the grid adds a note; Chord mode still creates scale-aware chords.
- 👆 Select mode selects a note or a grouped set. Dragging empty grid space draws a selection box. Dragging selected notes moves them; the right edge of one selected note resizes it.
- 🫱🏻‍🫲🏽 groups a selected set of two or more notes. Press it again after selecting the complete group to ungroup it.
- 🗑️ removes the current selection.

Grouped notes have a magenta outline while unselected and a cyan outline while selected. Group membership is saved in the project JSON.

## Context menu

Right-clicking the roll opens Copy, Cut, Paste, Duplicate and Delete. These apply to the selected note, selected group, or marquee selection. Paste uses the right-click grid position. Keyboard shortcuts Ctrl/Cmd+C, X and V are also supported.

## Existing controls retained

- Play/Pause keeps the playhead position.
- Stop clears scheduled audio and returns to 0:00.
- Import supports Ihy JSON and standard MIDI.
- Mute, Solo and Hide operate independently; Hide only removes a track from the piano roll.

## Rollback

Previous baseline: v0.28.