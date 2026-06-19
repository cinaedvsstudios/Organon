# Ihy v0.10 — Startup Repair Baseline

Permanent standalone URL:

`https://cinaedvsstudios.github.io/Organon/tools/ihy/standalone.html`

## Fixed in v0.10

- Restored the `#presets` element required by the startup renderer.
- Prevented the startup script from halting before it populated the piano-roll labels, notes, track controls and keyboard.
- Updated the visible app version to v0.10.
- Added cache-busting query versions to the current stylesheet and script links so the standalone page loads the matching v0.10 assets.
- Preserved the v0.09 playback timeline, animated playheads, extended keyboard and playback key highlights.

## Rollback

Previous baseline: `f2be00e4b89eb3cea917fb25bff42415a5e380ad` (v0.09 permanent standalone page).