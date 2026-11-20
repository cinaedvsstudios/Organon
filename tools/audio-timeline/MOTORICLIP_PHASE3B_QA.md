# MotoriClip Phase 3B — directional light and scanning effects

## Effects added
- **God Rays (#26):** nine independently swaying radial light wedges from an editable X/Y origin; distinct from an A/B transition light reveal.
- **Light Leaks (#28):** multi-hued organic edge illumination with animated gradient drift, distinct from old still leak overlays.
- **Pixel Scan (#35):** travelling pixelated scan band with density-controlled block details.
- **Sci-Fi Scan (#36):** moving technical beam with marks, reticle and crosshair geometry.

All four are transparent, source-independent, timestamp-rendered effect clips.
They appear in the existing categorized Effects Library and use the exact
`paintTimelineEffect()` renderer for preview and fixed-frame export.

## Inspector and compatibility
Existing intensity, speed, density, scale, direction and colour apply where
appropriate. God Rays exposes two additional conditional sliders (ray origin
X and Y). The new `originX` and `originY` keys are normalized safely
and persist with `effectOverlay` in the same snapshot/history/project JSON
system. Saved Phase 3A effects receive inert defaults; no destructive
migration or changes to the forty-one transitions.

## Verification
`timeline-effects.test.mjs` extends deterministic seek and renderer-signature
checks to all ten procedural effects, validates origin clamping, checks distinct
scan and ray structures and snapshots. `editor-ui.browser.mjs` validates
the 12 legacy overlays plus ten animated effects, populated Light and
Scanning categories, and editable ray-origin control in real Chrome.

The separate extended real-export and memory checks remain mandatory
before marking global export certification items #94, #96 or #100 done.
