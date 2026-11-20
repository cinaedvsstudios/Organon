# MotoriClip Phase 3F — preview interaction and responsive popup certification

## Specific regression coverage

This phase adds actual Chrome UI acceptance for the existing text/effect
preview controller. Previous title tests already covered Play/Pause and reverse
scrubbing, and every procedural effect preview was checked for distinct pixels
and identical seek-back frames. New checks exercise additional controls on a
glitch effect rather than relying on visual appearance alone:

- Play advances the effect's clip-relative animation progress.
- Pause stops the increment; the cursor stays frozen over a short hold.
- Restart rewinds the time to 0 regardless of where playback stopped.
- Loop enabled at the last frame actually wraps back to the beginning and
  resumes. Loop disabled stops at exactly 3 seconds and updates the button
  label to Play.
- Escape closes the same branded preview dialog.
- Android-sized 393 × 851 viewport, opened from Effects Library, fits the
  popup inside the available width and does not introduce horizontal page
  overflow. Preview canvas stays inside its card and close/play/restart controls
  have minimum sensible touch sizes.
- The modal uses the application's bronze-themed scrollbar thumb/track in
  Chromium and a corresponding Firefox scrollbar-color property.
- Clarified title/effect-neutral labels; the slider operates in .01-second
  increments, not tenths as its old tooltip stated.

No changes were made to the underlying 41 A/B transitions, effect image
rendering algorithms, animation scheduling, project storage or exporters.
The category registry still contains 33 true procedural effects plus 12
existing static overlays.

## CI and checklist

The real Chrome desktop+mobile acceptance step in `editor-ui.browser.mjs`
is the primary gate for this change, alongside the existing transition,
project save/recovery, Firefox/WebKit and media-export regressions.
Only mark checklist #99 (preview controls and scrubbing) and #101
(responsive popup controls) after the amended real-browser assertions pass.
Long-form 4K and decoded-export pixel parity remain separate tasks.
