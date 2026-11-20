# MotoriClip Advanced — 102-item implementation tracker

> **Single source of truth:** consolidated from the user's Part 4 requirements, November 20 screenshots, UI/track changes, requested effects, editable text and animation additions.

**Project:** `cinaedvsstudios/Organon` · **App:** `tools/audio-timeline/advanced.html` · **Status convention:** `[x]` only for implemented AND verified behaviour, `[ ]` for pending or not yet fully verified. Check off items in the same PR that adds passing regression coverage. Do not relabel an old feature as newly added.

**Reference imagery:** Six user-supplied CapCut Text/Effects gallery screenshots (20 Nov 2026). Inspiration only, not copied third-party proprietary assets.

**Later engine reference:** `F:\GITHUB\Forever-Bound-Game\artifex\apps\effect-editor` — investigate the corresponding Forever-Bound-Game repository's Artifex renderer for phase 3 effects, do not assume the local Windows drive is available.

**Milestones:** (1) UI and track management (items 1–20); (2) editable distinctive text plus animations (46–95); (3) nonduplicative time-based effects (21–45); (4) export/regression validation (96–102). The numbers retain the user's original checklist order.

## Progress log

- 20 Nov 2026: Initial 102-item tracker created. Pre-existing two-row toolbar/full-width timeline (PRs [#87](https://github.com/cinaedvsstudios/Organon/pull/87), [#88](https://github.com/cinaedvsstudios/Organon/pull/88)) verified in prior Chrome/Firefox/WebKit browser suites.
- 20 Nov 2026: Stage 1 items **1–20** reviewed/completed in [PR #91](https://github.com/cinaedvsstudios/Organon/pull/91): project controls, consistent scrollbars and dialogs, lane rename/colour/delete, clip-colour inheritance and Undo/Redo persistence. Previously completed toolbar/ruler/marker items retained; Chrome UI, recovery and portable-project regressions passed. Full-duration export stress tests continue separately.
- 20 Nov 2026: Stage 2 first batch in [PR #92](https://github.com/cinaedvsstudios/Organon/pull/92): **16 structurally distinct text templates** (46–61), typewriter/letter-pop/ticker (62, 63, 72), editable text (81), existing transform keyframes (87), no colour duplicates (88), right-click titled animation preview and controls (89–93), portable editable metadata (95), grayscale-distinct browser rendering tests (98). See the PR's Node, Chrome, portable/recovery and cross-browser checks. Remaining motion variants, exhaustive typography/appearance controls and actual exported-pixel verification remain unchecked.

- 20 Nov 2026: Stage 2 next batch in [PR #93](https://github.com/cinaedvsstudios/Organon/pull/93): **Reset corrected** to clear every track/clip/marker (not export settings), while retaining the Media bin, Undo and applied project settings. Added real per-letter shake, kinetic stagger, RGB glitch, waving and neon switch-on, distinct bounce/outline-fill/title-wipe/dissolve-out, and broadcast banner → headline → editable subtitle. New Inspector motion controls for delay, speed, direction, easing, intensity and loop. Checked items 64–66, 68–71, 73–76 and 85 after passing Node, Chrome multi-lane Reset and deterministic pixel checks, project recovery and Firefox/WebKit. Longer actual video-export stress job remains a separate verification.

## 1. Project controls and interface

- [x] **1.** Remove the **Project Controls** heading while keeping controls.
- [x] **2.** Replace wide Project Settings control with a **cog beside Open Folder**.
- [x] **3.** Add **Reset beside Export** to **completely empty all timeline tracks, clips and cue markers** (not export settings). Retain imported media and project settings; use an app-themed confirmation and support Undo. _Corrected per user in PR [#93](https://github.com/cinaedvsstudios/Organon/pull/93)._
- [x] **4.** Standardise comparable action buttons: width, height, padding and alignment.
- [x] **5.** Keep toolbar functions logically grouped across two rows. _(pre-existing; verified in PR #87/#88 and/or prior browser tests)_
- [x] **6.** Match Media, Effects, Text and Inspector scrollbars (width, thumb, track and hover).
- [x] **7.** Use Organon-themed dialogs for confirmation, rename, colour, preview and warning (no default browser alerts).
- [x] **8.** Add meaningful mouseover help throughout the editor.
- [x] **9.** Keep full-width timeline and independently vertically scrolling Inspector. _(pre-existing; verified in PR #87/#88 and/or prior browser tests)_

## 2. Timeline, track and clip management

- [x] **10.** Distinct default timeline colour for video, still images, audio and generated overlays.
- [x] **11.** Right-click clip → Change Colour (visual timeline indicator only).
- [x] **12.** Right-click clip → Reset Colour (inherit lane colour or media default).
- [x] **13.** Right-click track label → Rename Track, without renaming source files.
- [x] **14.** Right-click track label → Change Track Colour, inherited unless clip overrides.
- [x] **15.** Right-click track label → Delete Entire Track and clips, confirmed and undoable.
- [x] **16.** Keep clip context actions: Cut, Copy, Paste, Duplicate, Delete, Slice, Split, Hide/Show, source/trim/audio download. _(pre-existing; verified in PR #87/#88 and/or prior browser tests)_
- [x] **17.** Ruler fixed above tracks; nonselectable numbers; click moves only playhead. _(pre-existing; verified in PR #87/#88 and/or prior browser tests)_
- [x] **18.** Main Snap action separate from its snapping-mode dropdown. _(pre-existing; verified in PR #87/#88 and/or prior browser tests)_
- [x] **19.** Retain marker navigation, nudge, grouping, zoom and Undo/Redo. _(pre-existing; verified in PR #87/#88 and/or prior browser tests)_
- [x] **20.** Persist lane labels/colours and clip overrides through Undo/Redo, autosave and portable backups. _(pre-existing; verified in PR #87/#88 and/or prior browser tests)_

## 3. Effects library — distinct time-based effects

- [ ] **21.** Pendulum Swing — oscillate around editable pivot.
- [ ] **22.** Rebound Swing — spring overshoot and decay.
- [ ] **23.** Glow — bloom bright image regions.
- [ ] **24.** Edge Glow — illuminate detected edges only.
- [ ] **25.** Light Sweep — moving directional highlight.
- [ ] **26.** God Rays — directional beams with adjustable origin.
- [ ] **27.** Hazy Atmosphere — drifting diffuse fog.
- [ ] **28.** Light Leaks — animated organic edge illumination.
- [ ] **29.** Fault Cassette — analogue tape distortions.
- [ ] **30.** Flicker — editable rhythmic brightness variance.
- [ ] **31.** Ripple Distortion — animated refractive waves.
- [ ] **32.** Electric Ripple — waves with electrical pulses.
- [ ] **33.** Shockwave — expanding refractive ring.
- [ ] **34.** Vibration Flash — shake with brief flashes.
- [ ] **35.** Pixel Scan — moving scan band with pixel detail.
- [ ] **36.** Sci-Fi Scan — scan beam and technical HUD marks.
- [ ] **37.** Chromatic Quirk — independently displaced RGB channels.
- [ ] **38.** Halo Blur — radial soft focus.
- [ ] **39.** Particle Effects — independent sparks/dust/debris.
- [ ] **40.** Fire Effects — distinct flames/embers/explosions.
- [ ] **41.** Additional *distinct* glitch styles: Glass Glitch, Glitch Storm, Negative Chaos, Warning Glitch, Misalignment, Noir Glitch, Glitch Flux, Engine Heat and Retro Glitch.
- [ ] **42.** Categorise effects as Motion, Light, Distortion, Glitch, Atmospheric, Scanning, Particles/Fire.
- [ ] **43.** Right-click effect → themed animated Preview popup with Play/Pause/Loop/scrub.
- [ ] **44.** Insert effect as a genuinely time-based editable timeline clip, not a static PNG impostor.
- [ ] **45.** Effect Inspector for suitable parameters (intensity, speed, duration, direction, scale, glow, blur, distortion, particles and colour).

## 4. Text templates — distinct designs

- [x] **46.** Neon Sign (light-tube design).
- [x] **47.** Chrome/Metallic (reflective typography).
- [x] **48.** Handwritten Script.
- [x] **49.** Cinematic Title (elegant spacious layout).
- [x] **50.** News Lower Third (headline, subordinate line and banner).
- [x] **51.** Location Card (place name plus marker).
- [x] **52.** Quote/Editorial (deliberate serif layout).
- [x] **53.** Comic/Sticker Text.
- [x] **54.** Social Media Callout (Subscribe/Like/Follow/Share).
- [x] **55.** Chapter/Ending Card.
- [x] **56.** Technology/HUD.
- [x] **57.** Event Announcement.
- [x] **58.** Speech Bubble/Caption Box.
- [x] **59.** Typewriter/Document.
- [x] **60.** Retro Poster/Stamp.
- [x] **61.** Stacked Headline (contrasting hierarchy).

## 5. Animated text templates

- [x] **62.** Typewriter Reveal (letter-by-letter + cursor).
- [x] **63.** Letter Pop (staggered bouncing letters).
- [x] **64.** Shaking Letters (independent per-character motion).
- [x] **65.** Broadcast Box Reveal (rectangle draws/wipes then text dissolves).
- [x] **66.** News Lower-Third Animation (banner, headline and subtitle sequenced).
- [ ] **67.** Handwriting Reveal (stroke-writing look).
- [x] **68.** Outline to Solid.
- [x] **69.** Kinetic Stagger (words/letters from independent directions).
- [x] **70.** Glitch Text (fragmentation/channel shifts).
- [x] **71.** Bounce/Rubber Text.
- [x] **72.** Ticker/Marquee.
- [x] **73.** Floating/Waving Letters.
- [x] **74.** Neon Switch-On.
- [x] **75.** Title Wipe.
- [x] **76.** Dissolve Out.
- [ ] **77.** Animated Social Prompt.
- [ ] **78.** Animated Location Pin.
- [ ] **79.** Countdown/Numeric Reveal.
- [ ] **80.** Split Title.

## 6. Text and animation Inspector

- [x] **81.** Editable text after insertion without recreating clip.
- [ ] **82.** Typography: font, weight, size, italics, spacing, alignment and case.
- [ ] **83.** Appearance: fill, stroke, shadow, glow, opacity and backdrop.
- [ ] **84.** Shape: padding, corner radius, borders and banner geometry.
- [x] **85.** Motion: animation variant, duration, delay, speed, easing, direction, intensity and loop.
- [ ] **86.** Independent In/Out/Loop settings.
- [x] **87.** Retain keyframed Scale, Position, Rotation and Opacity.
- [x] **88.** Colour/style variants belong in Inspector, NOT duplicated as library templates.

## 7. Preview and template workflow

- [x] **89.** Right-click animated text → Play Preview in themed window.
- [x] **90.** Use **MotoriClip** as demo text when no text supplied, not saved as permanent user content.
- [x] **91.** Preview offers Play, Pause, Restart, Loop and scrub.
- [x] **92.** Representative thumbnails: visual look plus motion indicator.
- [x] **93.** Click or drag template to timeline.
- [ ] **94.** Playback and exported pixels match at identical timestamps (including reverse seeking).
- [x] **95.** Save editable recipes, values, motion and Inspector changes in recovery and history; do not rely solely on rendered PNGs.

## 8. Testing and implementation gates

- [ ] **96.** Protect 41 transitions, image sources, additive gain, Orgavox, history, autosave, media recovery and both exporters.
- [ ] **97.** Test rename, recolour, colour inheritance/override, lane deletion, Undo and refresh.
- [x] **98.** Validate visual differences between text templates independently of colour.
- [ ] **99.** Test animated effect/text preview controls and scrubbing.
- [ ] **100.** Verify real exported video with animated overlays.
- [ ] **101.** Check responsiveness, scrollbar consistency, button sizing and themed popups.
- [ ] **102.** Merge tested increments directly into `main`; link their PRs here.

## Rules of completion

- When implementing an item, add a regression test that checks behaviour (including UI interactions where appropriate), then mark `[x]` and add its merged PR link in the progress log.
- Do not equate a coloured duplicate with a distinct text template or motion effect; animations must run at timeline timestamps and render in exported video.
- Do not claim local Windows device access from a drive path. Use GitHub-hosted code for Artifex integration.
- Avoid adding `window.alert`, `window.confirm`, `window.prompt` for new workflows. Create branded accessible editor dialogs.
