# MotoriClip Phase 3D — image-analysis effects and procedural fire

## New effects and real distinctions
- **#23 Glow**: extracts high-luminance pixels from the actual composited lower
  footage/image and blooms only those bright regions; time-varying brightness.
- **#24 Edge Glow**: detects local luminance gradients, then draws the
  resulting edge mask with configurable colour and softening. Not a
  fullscreen tint or renamed Glow.
- **#37 Chromatic Quirk**: independently extracts red, green and blue source
  channels; reconstructs their images with different timestamp-controlled
  horizontal displacements.
- **#38 Halo Blur**: blurs the *source image*, applying a radial falloff mask
  that leaves the center relatively sharp while the periphery softens.
- **#40 Fire Effects**: three physically distinct procedural motifs, each
  time deterministic: rising Bézier flame tongues, individually moving
  embers and a radial flame/explosion burst with fading streaks.

These introduce **seven** new effect presets on top of the seventeen from
Phase 3C. They run in the same clip-relative Canvas2D compositor used by
normal preview and the existing fixed-frame exporter. They are not animated
GIFs or static overlay PNG impostors.

## Shared pixel architecture
`timeline-pixel-effects.mjs` caps source-sampling to **640 pixels longest edge**,
keeping one work canvas, one stage canvas and three channel canvases per
compositor 2D context, cached in a WeakMap and resized only when needed.
`deriveLightMask` and `separateRgb` are pure deterministic RGBA operations
that can be checked independently of the browser. Frame-local clocks drive
all animation. Halo blur uses Canvas filter with a radial destination mask.
The original source frame stays available under the filter/overlay and is
not permanently modified.

## Inspector and project state
The existing editable `effectOverlay` recipe now contains bounded `glow`
(0–100) and `blur` (0–60 pixels) fields. The Inspector reveals these
controls on Glow, Edge Glow and Halo Blur, includes Chromatic Quirk in
Distortion, and adds editable clip duration (0.1–120 seconds). Halo Blur and
Fire Explosion expose editable X/Y origins where useful. Other existing
controls and settings stay intact. Saved projects and undo snapshots
normalize recipes through the existing serialization path.

## Verification
- Node tests: distinct preset registry and per-frame differences; pure RGB
  extraction, independent edge detection versus brightness threshold;
  Fire Flames/Embers/Explosion shapes, seed/time determinism and safe
  persistence through undo/apply.
- Real Chrome tests: effects gallery and all updated category counts,
  time-varying and reversible Glow/Chromatic/Fire preview pixels, conditional
  blur/glow sliders, editable effect clip duration.
- Existing full project smoke tests (Chrome, Firefox, WebKit, A/B effects,
  portable project files, real-media export, HD stress) remain mandatory.

**Known separate gate:** comparing pixels from a completed encoded export to
the timeline preview at matching frame timestamps has not been added in this
batch. Do not interpret unit tests and normal export smoke as a substitute
for that end-to-end quality check. Other unimplemented issue #41 glitch styles
are explicitly out of scope for Phase 3D.
