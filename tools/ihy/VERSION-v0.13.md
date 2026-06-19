# Ihy v0.13 — Project Workflow and Arrangement Baseline

Permanent standalone URL:

`https://cinaedvsstudios.github.io/Organon/tools/ihy/standalone.html`

## Changed in v0.13

- Added **Potion Song — Piano Example** from the supplied `potion_song_all_piano_v7.mid` file as a built-in example project.
- The example preserves the MIDI’s three piano tracks and 120 BPM timing, with 16 bars arranged as four labelled four-bar sections.
- The MIDI did not contain an embedded key or time signature; the example uses `A♭ major` as an inferred working key for Ihy’s chord function, while the source metadata remains marked as absent.
- Replaced the non-functional Compose button with **New composition**.
- New composition creates a blank project and uses a custom Save & continue / Continue without saving / Cancel confirmation before replacing the current work.
- Added **Load example** beside New composition and Save.
- Moved Armed, Quantise and Transpose from the left card into the top header beside the project BPM/key/chord controls.
- Rebuilt the left Controls card ordering:
  1. Project & sound — New composition, Save, Create sound, Load example.
  2. Files & tools — Import, Export, Library, Analyse, Signal.
  3. Transport — Record, Metro, Play, Stop.
- Moved the previous workspace buttons into that single Controls card.
- Added visible shadows to cards and buttons.
- Rebuilt the time ruler and section pills into one compact arrangement strip.
- Arrangement strip stays visible while vertically scrolling the piano roll and follows the piano roll’s horizontal position.
- The Create panel is now explicitly described as simple game/SFX synth presets, separate from the sampled composition instruments.

## Rollback

Previous baseline: `7faba7ba22c883077f27341fc3b1f30bb61ad4b0` (v0.12 note placement, chords and inline note editor).