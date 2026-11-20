# MotoriClip Phase 3A — procedural effect clips

## Scope
The first non-static Effects Library increment creates independent timeline effect
clips for Light Sweep (#25), Hazy Atmosphere (#27), Rhythmic Flicker (#30)
and three genuinely different particle variants: Floating Dust, Electric
Sparks and Flying Debris (part of #39).

The existing twelve static overlay presets and forty-one A/B transitions
are deliberately untouched. The effect category filter anticipates later
Motion, Distortion, Glitch and Scanning recipes; empty categories are not
claimed as implemented.

## Technical architecture
- A small generated PNG permits the existing media-bin/track placement and
  relink workflow to remain unchanged; it is **not** used as the animated
  effect output. Each inserted dynamic clip carries an editable `effectOverlay`
  recipe. `AdvancedMediaEngine.renderFrame()` draws that procedural recipe
  using clip-relative timeline seconds instead of painting the PNG.
- Effects share the same render function for normal playback and fixed-frame
  exports. Reverse seeking and changing frame rates do not consume mutable
  simulation state; time and particle identities directly determine the frame.
- Inspector adjustments include intensity, speed, particle density, scale,
  direction and colour. Undo/Redo, portable project JSON and local recovery
  persist the recipe through `snapshotClip` and `applyClipData`.
- Right-click an animated effect for the existing branded Play/Pause/Restart,
  Loop and scrub preview. The dynamic renderer also paints library thumbnails.

## Artifex FX investigation
Reviewed `Forever-Bound-Game/artifex/apps/effect-editor/src/fx-runtime.js`
and its `src/presets.js` registry. Artifex uses procedural shockwave/ribbon
layers, particle shapes, texture caches and a state-oriented runtime exposed as
`window.ArtifexFxRuntime`. The motifs and drawing strategies are reusable,
but its DOM/global runtime and evolving particle state are not compatible as
a direct drop-in for reverse-seekable fixed-frame video export. Phase 3A
therefore uses a small independent stateless Canvas2D implementation.
Later shockwave/particle work may adapt more of the reference explicitly.

## Regression gates
- `node --test tools/audio-timeline/tests/timeline-effects.test.mjs`:
  catalogue uniqueness, validation, timestamp/reverse-seek determinism,
  Inspector parameter influence, snapshot/Undo and non-wall-clock rendering.
- `node tools/audio-timeline/tests/editor-ui.browser.mjs`:
  gallery count, category visibility, right-click animated preview, pixel
  differences and reverse-scrub reproducibility, effect insertion and Inspector.
- Full existing transition, title, project recovery and export pipelines
  remain part of the GitHub Actions suite.

## Pending verification
Real exported pixels for animated effect clips, long-form HD export memory
and hardware-specific Windows/Android rendering are **not yet certified**
by these scoped tests. Do not check off the remaining checklist export
verification gates based solely on procedural unit tests.
