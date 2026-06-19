# Ihy v0.11 — Sampled Instrument Playback

Permanent standalone URL:

`https://cinaedvsstudios.github.io/Organon/tools/ihy/standalone.html`

## Changed in v0.11

- Changed the Stop button to a dedicated red control.
- Replaced the normal playable-instrument path with a sample-based SoundFont player.
- Grand Piano, Soft Piano, Cello, Strings, Flute, French Horn, Choir, Warm Pad, Bell, Acoustic Guitar, Electric Bass, Drum Kit, Retro Lead and Pluck now map to matching sample-bank instruments.
- Sample instruments are lazy-loaded on first use and cached for the active browser session.
- First load reports the instrument currently being prepared instead of silently pretending it is ready.
- Playback, piano-key highlights, timeline cursor and the on-screen keyboard use sampled instruments after loading.
- The native oscillator remains only as a clearly reported fallback when the external sample bank cannot be reached, and for the Create synth presets.
- Existing project JSON remains compatible and saves under the `ihy-v011` local key.

## Technical note

The first sample layer uses the browser SoundFont player with the MusyngKite sample bank. A future dedicated sound-bank pass will bundle or locally cache a license-reviewed bank rather than depending on the initial online sample source.

## Rollback

Previous baseline: `8380c07265cd4c19ab18a091b2b04a16ec815da6` (v0.10 startup repair).