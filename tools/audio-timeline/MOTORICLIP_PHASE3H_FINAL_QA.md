# MotoriClip Phase 3H — final regression protection and acceptance audit

This document maps the broad stability requirement (#96) and appearance-edit
requirement (#97) to executable tests. The existing regression tests are run
on every PR by `.github/workflows/motoriclip-real-media.yml`; they are not
replaced by a checklist or cosmetic inspection.

## Protection matrix (#96)

| Concern | Existing executable regression gate |
|---|---|
| Forty-one paired A/B transitions, including still/image sources | `paired-visual-effects.browser.mjs`, `paired-visual-effects.test.mjs`, `paired-transitions.browser.mjs`, `paired-transitions.test.mjs`, `visual-transitions.browser.mjs` |
| Actual video/image source loading, decoding, retained media streams and failure handling | `media-consistency.test.mjs`, `real-export.browser.mjs`, `project-recovery.browser.mjs` |
| Additive audio gain, fades and linked sound mix | `offline-export.test.mjs` (offline gain follows preview overlapping envelopes), `media-consistency.test.mjs` (Web Audio gain), `real-export.browser.mjs` (actual decoded audio RMS) |
| Orgavox EQ, Drive, Dynamics, Stereo and Lo-Fi DSP | `orgavox-audio-chain.test.mjs`, `orgavox-lofi-dsp.test.mjs`, `real-export.browser.mjs` (real exported WAV with Lo-Fi processing) |
| Undo, Redo and serialised clip metadata | `project-history.test.mjs`, `timeline-appearance.test.mjs`, `editor-ui.browser.mjs` |
| Autosave, source-file handles, offline media relink and full recovery | `project-recovery.test.mjs`, `project-recovery.browser.mjs`, `project-portable.browser.mjs`, `media-handle-store.test.mjs` |
| Both live capture and fixed-frame export; cancellation and failure cleanup | `advanced-live-export.test.mjs`, `offline-export.test.mjs`, `real-export.browser.mjs`, `extended-export.browser.mjs`, `repeated-export-memory.browser.mjs` |
| Actual animated-effect MP4 picture pixels and exact seek-back | `animated-overlay-export.browser.mjs` (Phase 3G) |

## Appearance, deletion, history and refresh (#97)

The Chrome `editor-ui.browser.mjs` Stage 1 scenario:
1. Imports an image into a track and verifies the media remains available;
2. Renames its lane using the branded editor modal;
3. Applies a lane colour and verifies it propagates to the clip;
4. Applies a clip override and confirms the clip colour has precedence;
5. **New:** refreshes the entire page, waits for recovery, and checks that
   the renamed lane and specific clip override survive round-trip;
6. Resets only the clip override and checks lane-colour inheritance;
7. Resets the lane to its category default;
8. Cancels deletion of the entire lane (no data loss);
9. Confirms lane deletion removes the associated clips but retains imported
   source media, then Undo restores the lane and its name;
10. Checks entire-timeline Reset cancellation, application and Undo.

`timeline-appearance.test.mjs` independently verifies precedence,
invalid colour safety and Undo snapshot restoration.

## Project close-out process (#102)

The incremental PRs are linked directly from the implementation tracker:
- #97: deterministic procedural light, atmosphere and particles;
- #98: rays, light leaks and scanning;
- #99: source-aware motion/glitch/distortion and category coverage;
- #100: pixel-analysis Glow/Edge/RGB/Halo, three fire effects and Inspector;
- #101: nine independently drawn glitch styles;
- #102: preview Play/Pause/Restart/Loop and phone popup styling;
- #103: decoded MP4 pixel parity with the real preview;
- #104: final appearance refresh regression and stability audit.

**Acceptance rule:** #96/#97/#102 must remain unchecked until the full
Chrome transition/editor/project suite and Firefox/WebKit jobs pass on this
branch and the accepted PR is actually merged to `main`.

## Important limits
Automated browser and GitHub-hosted tests do not claim use of the user's
Windows HDD. The long-form 4K/8K stress envelope and every possible media
codec/platform are not certified by these scoped checks. Repeated export
profiling remains a distinct runtime guardrail and must not be substituted
with a synthetic assertion.
