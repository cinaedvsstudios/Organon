# Ihy v0.09 — Playback Timeline and Extended Keyboard

Permanent standalone URL:

`https://cinaedvsstudios.github.io/Organon/tools/ihy/standalone.html`

## Changed in v0.09

- Extended the on-screen keyboard from two octaves to five octaves, C2 through C7.
- Increased keyboard height so it fills the lower editor card rather than leaving a large empty region.
- Increased the piano-roll viewport height.
- Added a dedicated playback-timeline lane immediately above the section pills.
- The timeline lane shares the same beat scale as the piano roll and section pills.
- Click or drag in the timeline lane to choose the playback start beat.
- Added a blue playhead to the timeline lane and piano roll.
- Play animates both cursors horizontally from the selected start beat.
- Added automatic horizontal following while the cursor moves past the visible right edge.
- Piano keys light while their corresponding notes play.
- Playback now starts from the chosen timeline position instead of always beginning at beat zero.
- Existing v0.08 local projects are read as fallback and save forward under v0.09.

## Rollback

Previous direct-standalone baseline: `f2132b84359981e243f07e38a4ddd1e8e19db125` (v0.08).