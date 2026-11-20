# MotoriClip Phase 3E — nine independently defined glitch styles

## New effects (#41)

Each of these is a dedicated source-frame procedure with its own geometrical
or pixel filter logic, not nine aliases for the same VHS streaks:

| Preset | Actual rendering |
|---|---|
| Glass Glitch | Irregular polygon fragments, each sampling displaced source pixels behind a distinct shard boundary |
| Glitch Storm | Rapid horizontal slices, seeded tears and discontinuous digital colour blocks |
| Negative Chaos | Changing clipped windows with pixel inversion and boosted contrast |
| Warning Glitch | Hazard-striped moving rail, bold alert-colour frame and a jump cut in the image |
| Misalignment | Two differently tinted, independently displaced source ghosts, using screen blending |
| Noir Glitch | Contrasty grayscale, moving dark shutter bars and vertical film-scratch detail |
| Glitch Flux | Continuous time-driven *vertical* source-column displacements, orthogonal to the horizontal ripple/tape bands |
| Engine Heat | Wavy upward heat deformation, hot low-frame tint and rising tendrils |
| Retro Glitch | Low-resolution nearest-neighbour source resampling, CRT dark scanlines and a rolling displaced dropout |

They are appended to the existing category-driven Effects tab rather than
changing any of the 41 A/B transition IDs. The category should now contain
ten animated presets, including Fault Cassette from Phase 3C.

All nine use deterministic clip-relative frame time. Reverse seeking repeats
the same frame. The `effectOverlay` records persist through Undo/Redo,
project saves, recovery, and clip splitting exactly as other procedural effects.
In a source-independent template preview, the existing geometric sample scene
is first painted to expose genuine movement and pixel differences. That preview
scene is not part of exported media.

## Engineering notes

- The shared compositor captures a bounded reusable source-frame snapshot
  before invoking the glitch renderer, so effects distort actual lower-layer
  pixels and do not rely on a static PNG.
- `timeline-glitch-effects.mjs` isolates the geometry, filter and composition
  recipes from the already working 41 A/B transitions.
- Retro Glitch stores at most one low-resolution sampling canvas per Canvas2D
  context via WeakMap and caps its longest edge to 640 pixels even at 4K/8K.
- Inspector exposes intensity, speed, density, size, direction, colour,
  distortion strength, and independently editable clip duration. Extra
  parameters are normalized via `normaliseTimelineEffect`.

## Verification and deliberately open gates

`timeline-glitch-effects.test.mjs` checks nine unique IDs, independent
rendering structures, repeatable reverse seeking, source image sampling,
parameter changes, project snapshots, and CRT allocation limits.

`editor-ui.browser.mjs` checks all 45 gallery presets (12 still, 33
procedural), the ten-item Glitch category, nine distinct actual Canvas preview
pixel results, slider control, and repeatable reversed scrubbing.

The entire original transition, export, recoverable project, Chrome,
Firefox and WebKit jobs remain required. Pixel-level decoded-export
equivalence, long-form memory, and other checklist regression gates must be
checked separately. Do not mark them complete merely because the nine
glitch renderers compile.
