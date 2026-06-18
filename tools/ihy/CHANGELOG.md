# Ihy Changelog

## v0.03 — Standalone launcher

Ihy can now be opened in its own full-browser page without loading the Organon hub around it.

### Changed in this version

- Added `tools/ihy/standalone.html`.
- The standalone launcher fills the browser viewport with Ihy and does not show the Organon shell.
- The standalone page identifies itself as `v0.03` and preserves the same Ihy project and local-browser data used by the hub version.
- The existing hub route remains available for normal Organon workflow.

### Direct standalone route

`https://cinaedvsstudios.github.io/Organon/tools/ihy/standalone.html`

### Rollback baseline

`v0.02` remains the last direct-Ihy desktop layout baseline. `v0.03` adds the standalone opening route.

---

## v0.02 — Full desktop composition workspace

Reworked the app shell so Ihy uses the available Organon workspace on desktop instead of being constrained to a 540px mobile column.

### Changed in this version

- Desktop layout is now full-width inside the Organon tool basin.
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

### Rollback baseline

`v0.01` remains the last compact/mobile-shell baseline. `v0.02` is the full-screen desktop baseline.

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

### Rollback baseline

`v0.01` is the first working Ihy prototype baseline.
