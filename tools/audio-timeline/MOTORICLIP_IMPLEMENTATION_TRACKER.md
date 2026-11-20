# MotoriClip Advanced — 102-item implementation tracker

> **Single source of truth:** consolidated from the user's Part 4 requirements, November 20 screenshots, UI/track changes, requested effects, editable text and animation additions.

**Project:** `cinaedvsstudios/Organon` · **App:** `tools/audio-timeline/advanced.html` · **Status convention:** `[x]` only for implemented AND verified behaviour, `[ ]` for pending or not yet fully verified. Check off items in the same PR that adds passing regression coverage. Do not relabel an old feature as newly added.

**Reference imagery:** Six user-supplied CapCut Text/Effects gallery screenshots (20 Nov 2026). Inspiration only, not copied third-party proprietary assets.

**Later engine reference:** `F:\GITHUB\Forever-Bound-Game\artifex\apps\effect-editor` — investigate the corresponding Forever-Bound-Game repository's Artifex renderer for phase 3 effects, do not assume the local Windows drive is available.

**Milestones:** (1) UI and track management (items 1–20); (2) editable distinctive text plus animations (46–95); (3) nonduplicative time-based effects (21–45); (4) export/regression validation (96–102). The numbers retain the user's original checklist order.

## Progress log

- 20 Nov 2026: Initial 102-item tracker created. Pre-existing two-row toolbar/full-width timeline (PRs [#87](https://github.com/cinaedvsstudios/Organon/pull/87), [#88](https://github.com/cinaedvsstudios/Organon/pull/88)) verified in prior Chrome/Firefox/WebKit browser suites.


## 1. Project controls and interface

- [ ] **1.** Remove the **Project Controls** heading while keeping controls.
- [ ] **2.** Replace wide Project Settings control with a **cog beside Open Folder**.
- [ ] **3.** Add **Reset beside Export** to reset export configuration only, never timeline.
- [ ] **4.** Standardise comparable action buttons: width, height, padding and alignment.
- [x] **5.** Keep toolbar functions logically grouped across two rows. _(pre-existing; verified in PR #87/#88 and/or prior browser tests)_
- [ ] **6.** Match Media, Effects, Text and Inspector scrollbars (width, thumb, track and hover).
- [ ] **7.** Use Organon-themed dialogs for confirmation, rename, colour, preview and warning (no default browser alerts).
- [ ] **8.** Add meaningful mouseover help throughout the editor.
- [x] **9.** Keep full-width timeline and independently vertically scrolling Inspector. _(pre-existing; verified in PR #87/#88 and/or prior browser tests)_

## 2. Timeline, track and clip management

- [ ] **10.** Distinct default timeline colour for video, still images, audio and generated overlays.
- [ ] **11.** Right-click clip → Change Colour (visual timeline indicator only).
- [ ] **12.** Right-click clip → Reset Colour (inherit lane colour or media default).
- [ ] **13.** Right-click track label → Rename Track, without renaming source files.
- [ ] **14.** Right-click track label → Change Track Colour, inherited unless clip overrides.
- [ ] **15.** Right-click track label → Delete Entire Track and clips, confirmed and undoable.
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

- [ ] **46.** Neon Sign (light-tube design).
- [ ] **47.** Chrome/Metallic (reflective typography).
- [ ] **48.** Handwritten Script.
- [ ] **49.** Cinematic Title (elegant spacious layout).
- [ ] **50.** News Lower Third (headline, subordinate line and banner).
- [ ] **51.** Location Card (place name plus marker).
- [ ] **52.** Quote/Editorial (deliberate serif layout).
- [ ] **53.** Comic/Sticker Text.
- [ ] **54.** Social Media Callout (Subscribe/Like/Follow/Share).
- [ ] **55.** Chapter/Ending Card.
- [ ] **56.** Technology/HUD.
- [ ] **57.** Event Announcement.
- [ ] **58.** Speech Bubble/Caption Box.
- [ ] **59.** Typewriter/Document.
- [ ] **60.** Retro Poster/Stamp.
- [ ] **61.** Stacked Headline (contrasting hierarchy).

## 5. Animated text templates

- [ ] **62.** Typewriter Reveal (letter-by-letter + cursor).
- [ ] **63.** Letter Pop (staggered bouncing letters).
- [ ] **64.** Shaking Letters (independent per-character motion).
- [ ] **65.** Broadcast Box Reveal (rectangle draws/wipes then text dissolves).
- [ ] **66.** News Lower-Third Animation (banner, headline and subtitle sequenced).
- [ ] **67.** Handwriting Reveal (stroke-writing look).
- [ ] **68.** Outline to Solid.
- [ ] **69.** Kinetic Stagger (words/letters from independent directions).
- [ ] **70.** Glitch Text (fragmentation/channel shifts).
- [ ] **71.** Bounce/Rubber Text.
- [ ] **72.** Ticker/Marquee.
- [ ] **73.** Floating/Waving Letters.
- [ ] **74.** Neon Switch-On.
- [ ] **75.** Title Wipe.
- [ ] **76.** Dissolve Out.
- [ ] **77.** Animated Social Prompt.
- [ ] **78.** Animated Location Pin.
- [ ] **79.** Countdown/Numeric Reveal.
- [ ] **80.** Split Title.

## 6. Text and animation Inspector

- [ ] **81.** Editable text after insertion without recreating clip.
- [ ] **82.** Typography: font, weight, size, italics, spacing, alignment and case.
- [ ] **83.** Appearance: fill, stroke, shadow, glow, opacity and backdrop.
- [ ] **84.** Shape: padding, corner radius, borders and banner geometry.
- [ ] **85.** Motion: animation variant, duration, delay, speed, easing, direction, intensity and loop.
- [ ] **86.** Independent In/Out/Loop settings.
- [ ] **87.** Retain keyframed Scale, Position, Rotation and Opacity.
- [ ] **88.** Colour/style variants belong in Inspector, NOT duplicated as library templates.

## 7. Preview and template workflow

- [ ] **89.** Right-click animated text → Play Preview in themed window.
- [ ] **90.** Use **MotoriClip** as demo text when no text supplied, not saved as permanent user content.
- [ ] **91.** Preview offers Play, Pause, Restart, Loop and scrub.
- [ ] **92.** Representative thumbnails: visual look plus motion indicator.
- [ ] **93.** Click or drag template to timeline.
- [ ] **94.** Playback and exported pixels match at identical timestamps (including reverse seeking).
- [ ] **95.** Save editable recipes, values, motion and Inspector changes in recovery and history; do not rely solely on rendered PNGs.

## 8. Testing and implementation gates

- [ ] **96.** Protect 41 transitions, image sources, additive gain, Orgavox, history, autosave, media recovery and both exporters.
- [ ] **97.** Test rename, recolour, colour inheritance/override, lane deletion, Undo and refresh.
- [ ] **98.** Validate visual differences between text templates independently of colour.
- [ ] **99.** Test animated effect/text preview controls and scrubbing.
- [ ] **100.** Verify real exported video with animated overlays.
- [ ] **101.** Check responsiveness, scrollbar consistency, button sizing and themed popups.
- [ ] **102.** Merge tested increments directly into `main`; link their PRs here.

## Rules of completion

- When implementing an item, add a regression test that checks behaviour (including UI interactions where appropriate), then mark `[x]` and add its merged PR link in the progress log.
- Do not equate a coloured duplicate with a distinct text template or motion effect; animations must run at timeline timestamps and render in exported video.
- Do not claim local Windows device access from a drive path. Use GitHub-hosted code for Artifex integration.
- Avoid adding `window.alert`, `window.confirm`, `window.prompt` for new workflows. Create branded accessible editor dialogs.
