# MotoriClip Phase 8K — Vortex, Heat haze and Refraction

**Date:** 19 November 2026 (Berlin)
**Status: MERGED AND VERIFIED.** [PR #53](https://github.com/cinaedvsstudios/Organon/pull/53) merged 19 November 2026 at `dd074e8fce32efef0c3e73a05ecdad64adade308`.

## Three new effects

Three additional effects from the user's unchanged original 41-name shortlist are implemented as independent, time-deterministic Canvas 2D interpretations. The catalog now has **28 enabled / 13 queued**.

- **Vortex:** Twelve concentric, clipped annular slices rotate incoming Video B by different angles while a central reveal expands across outgoing Video A. The inner rings rotate farther than the outer rings, producing an actual spatial swirl rather than rotating the entire picture like the existing Spin effect. Pale curved traces delineate the vortex on low-detail footage. At the end B returns to a pristine full-resolution image.
- **Heat haze:** Twenty-eight narrow horizontal bands of incoming Video B follow smoothly oscillating sine-based lateral distortions over the existing A→B blend. Gentle amber shimmer accents distinguish the result from discrete Glitch flicker and VHS tracking, and both the distortion and heat shimmer disappear cleanly at the end.
- **Refraction:** Twenty-four triangular lens facets across a 4×3 layout displace incoming Video B in independently seeded directions, along with faint alternating cyan/magenta prism seams. These are bounded geometric sampling operations rather than a flat fade or simple tile reveal. Distortion amplitude returns exactly to zero at both ends.

The outputs are not claimed to be pixel-identical recreations of third-party GLSL gallery effects; no external shader source is imported.

## Existing behavior retained

Advanced **Select two video clips → Pair Video A → Video B** retains its existing effect list, duration, overlap placement, upper video lane, gold timeline markers, active Inspector note, Undo/Redo and Unlink controls. The existing shared `AdvancedMediaEngine.renderFrame()` renders all effects in live preview, stills and fixed-frame export. Clips, trims, original files, linked audio and their volume settings remain untouched.

Each new effect reuses the one existing renderer-wide full-resolution scratch canvas. Vortex draws up to 12 clipped concentric slices; Heat haze up to 28 lateral bands; Refraction up to 24 triangular facets. No CPU getImageData per output frame and no additional persistent full-HD buffers are introduced. All calculations depend only on timeline timestamp and deterministic cell indices, so scrubbing backwards or exporting a frame at the same time produces identical pixels.

No automatic audio crossfade, alpha-bearing output video, transition-specific customization UI or Apple-specific certification is introduced.

## Release acceptance

1. **Node:** 41 original names preserved, 28 enabled/13 queued, independent ring rotation and growing radius, bounded repeatable thermal waves, 24 independently displaced facets with zero endpoint offset, unchanged media and Undo/Redo metadata.
2. **Actual Chrome compositor pixels:** render all 28 effects. With vertically striped incoming B and solid blue A, Vortex reveals a swirled central region while A remains at the edges; Heat haze produces visibly distorted bands distinct from a plain fade; Refraction creates triangular offset video regions and prismatic seams. All three must differ from each other and from Fade, render identically on repeated timestamps, and resolve to clean B at completion.
3. **Actual Advanced editor:** import two real generated MP4 clips, apply all 28 effects in the Project inspector, verify gold transition marker, active effect names and Undo/Redo.
4. **Complete regression gate:** all prior Node suites, Chrome/Firefox media UI checks, existing 60-second 1080p and 120-second 720p benchmarks, 120-second 1080p/30fps H.264/AAC MP4 (3,600 frames), memory recovery and portrait/rotated input checks.

**QA result: PASS.** [GitHub Actions run 44486732187](https://github.com/cinaedvsstudios/Organon/actions/runs/44486732187) completed **all three jobs successfully**: `transition-smoke`, `cross-browser-ui` and `export-browser`.

- **154/154 Node tests passed**, including five new Vortex/Heat haze/Refraction maths, catalog and source-preserving pairing tests.
- **Actual Chrome rendered pixels confirmed distinct effects.** At the midpoint, Vortex sampled 134 red / 740 blue / 498 mixed pixels; Heat haze 0 red / 49 blue / 1,323 mixed; Refraction 0 red / 96 blue / 1,276 mixed. Frame fingerprints were different from ordinary Fade and each other, and matched at repeated timestamps.
- **Chrome Advanced editor:** two real imported MP4s, all 28 effect choices applied, gold marker, effect-specific inspector note and Undo/Redo; Firefox and other browser compatibility passed.
- **Real media exports and memory:** the full 120-second 1920×1080/30fps H.264/AAC MP4 test exported **3,600 frames across 16 moving clips**; output 73.06 MiB, Chrome PSS peak 1,185.6 MiB. Near-limit 60-second 1080p / 120-second 720p, repeated-export memory recovery and portrait/rotated inputs passed.
- Exact third-party shader matching, alpha-bearing video files, automatic audio crossfade and physical Windows/Android certification remain separate work.

**Merge rule:** All three GitHub Actions jobs green before merging. Physical Windows/Android device testing remains separate.
