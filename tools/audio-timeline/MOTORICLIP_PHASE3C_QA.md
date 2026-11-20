# MotoriClip Phase 3C — motion, analogue glitch and source distortion

## What changes
Seven *additional* genuinely time-based effects now apply to actual previously
composited image/video pixels, rather than inserting a still overlay:

- **#21 Pendulum Swing**: continuous sinusoidal scene rotation, with editable
  pivot X/Y, direction and strength.
- **#22 Rebound Swing**: a different damped spring response (overshoot followed
  by decay), using the same editable pivot.
- **#29 Fault Cassette**: horizontal analogue-tape image slices displaced by
  deterministic seeded tracking noise, plus moving scan interference.
- **#31 Ripple Distortion**: 36 horizontally refracted bands, animated as
  continuous waves through source imagery.
- **#32 Electric Ripple**: its own faster refraction pattern plus animated
  independent jagged electric arcs, not just another colour for Ripple.
- **#33 Shockwave**: expanding annular wavefront; only the masked ring samples
  dilated source pixels; the surrounding frame remains unchanged.
- **#34 Vibration Flash**: quantized seeded scene jitter with occasional brief
  flashes, rather than a regular sinusoidal swing.

All seven are editable overlay clips rendered by the shared
`AdvancedMediaEngine.renderFrame()`, so the same timestamp-dependent drawing
path is used in live preview and existing exporters.

## Engineering and memory
- `timeline-effects.mjs` owns the category registry, safe recipe
  normalisation and deterministic Canvas2D drawing.
- A `WeakMap` caches **one** source-snapshot scratch canvas per output 2D
  context. It is resized only when the output dimensions change; it does not
  allocate a new full-frame buffer for each frame or particle.
- Pixel geometry is calculated solely from the clip-relative timestamp
  `(currentTime - track.start)`, effect settings and stable seeded functions.
  There is no mutable simulation state, so seeking backwards repeats the same
  pixels. Underlying video/image pixels are captured before distortion.
- The existing engine compositing loop and 41 paired A/B transitions are
  unchanged. Source-dependent effects are drawn with their clip's blend/opacity
  settings restored afterwards.
- The neutral geometric preview illustration exists only to show source
  deformation in thumbnails and preview; it is never saved as the effect or
  substituted for actual video at export time.
- `effectOverlay` preserves recipe values through clip split, Undo/Redo,
  autosave, project recovery and portable Save/Open.
- Inspector adds an explicit distortion slider for these effects and uses
  origin X/Y as editable pivots for the two swings and Shockwave.

## Verification gates
- Node: source-snapshot copying, scratch reuse, actual source-band reprojection,
  shockwave annular clip, pivot/distortion clipping and project-history recipes.
- Node: all registry IDs distinct and all seven named library categories
  represented by at least one actual procedural recipe.
- Chrome: 12 classic overlays + 17 procedural effect clips; gallery category
  counts; real source-scene pixel differences and exact reversal when scrubbing
  Swing/Ripple, themed preview and Inspector values.
- Existing GitHub Actions CI: 41 A/B transitions, recovery, portable save/open,
  Chromium/Firefox/WebKit and real-media video/export stress tests.

**Explicitly not yet certified:** pixel-by-pixel comparison of actual encoded
videos with effect preview at matched timestamps, all high-memory 4K cases,
and every unrelated outstanding effect family in the 102-item tracker.
The run must pass relevant CI steps before marking checklist items complete.
