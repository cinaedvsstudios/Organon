# Ihy Changelog

## v0.04 — Standalone editor rebuild

Rebuilt the standalone Ihy page as its own direct application rather than wrapping the compact hub tool in an iframe.

### Changed in this version

- The standalone page now has its own full-width desktop composition layout.
- Replaced the old music-note placeholder with the app image path `icon.png` and simplified the header to **Ihy** plus the version badge.
- Moved the primary composition controls into one left-side control card.
- Moved Import, Export and Save into that same control card.
- Added emoji-labelled controls for Play, Stop, Record, Metronome, Import, Export, Save, Add Track, Add Section, Clear and Zoom.
- Kept the Tracks card directly under the control card in the left column.
- Moved section labels into the bottom edge of the piano roll as long coloured pills aligned to the beat grid.
- The keyboard now sits directly beneath the piano roll and uses the same editor width.
- The standalone project loader rejects an empty saved track list and falls back to the four default tracks, starter notes and default sections instead of showing a blank composition view.
- JSON import/export and local project save remain available in the standalone app.
- Desktop uses the full browser width; screens below 900px switch to the stacked layout.

### Rollback baseline

`v0.03` remains the previous standalone-launcher baseline. `v0.04` is the current standalone editor baseline.

### Direct standalone route

`https://cinaedvsstudios.github.io/Organon/tools/ihy/standalone.html`

---

## v0.03 — Standalone launcher

Ihy can now be opened in its own full-browser page without loading the Organon hub around it.

### Changed in this version

- Added `tools/ihy/standalone.html`.
- The standalone launcher fills the browser viewport with Ihy and does not show the Organon shell.
- The existing hub route remains available for normal Organon workflow.

---

## v0.02 — Full desktop composition workspace

Reworked the app shell so Ihy uses the available Organon workspace on desktop instead of being constrained to a 540px mobile column.

### Changed in this version

- Desktop layout is now full-width inside the Organon workspace.
- The composition screen uses a desktop workspace structure:
  - left column for transport, track selection and track controls;
  - full-width section strip above the editor;
  - wide piano-roll editor beside the tracks;
  - keyboard across the workspace below the editor.
- The piano roll now receives the available vertical workspace height on desktop, up to a sensible maximum.
- Header and fixed bottom action bar use the full workspace width on desktop.
- Mobile devices below 900px keep the stacked 540px-style layout intentionally.
- Visible version, JSON project version and newly saved local project key are now `v0.02`.
- Existing `v0.01` locally saved projects are still loaded as a fallback and normalised into the v0.02 project shape.

---

## v0.01 — Interactive prototype

Initial GitHub prototype for the Organon Sound & Music Workshop.

### Working in this version

- Organon Create-menu registration.
- Icon placeholder ready for a future supplied Ihy icon.
- Editable project name, BPM and key.
- Four colour-coded default tracks plus add-track action.
- Named timeline sections with rename/add controls.
- Scrollable piano-roll grid.
- Double-click to add notes.
- Drag notes to change time and pitch.
- Resize notes from the right edge.
- Right-click note editor for instrument override, velocity, duration and deletion.
- On-screen two-octave keyboard and physical keyboard mapping.
- Local native Web Audio playback for the first curated instrument placeholders.
- Record mode that writes keyboard notes into the armed track.
- Play/stop project transport and optional metronome.
- Basic game-SFX/chiptune preset creator.
- Continuous signal/reference-tone mode.
- Temporary playable local audio imports.
- Local audio metadata report with copy-to-clipboard output.
- Ihy Project JSON save, import and export.
- Local browser project save using localStorage.

### Intentionally not yet implemented

- SoundFont/sample-bank instruments.
- MIDI import/export.
- WAV/MP3 rendering.
- Persistent IndexedDB audio asset storage.
- Automatic BPM/key detection.
- Audio-to-MIDI conversion; use the existing Organon Audio2MIDI tool.
- Lyrics and lyric timing.
