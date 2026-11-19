# MotoriClip Phase 8A — first editable visual transitions

**Date:** 19 November 2026 (Berlin)

## Scope and design decision

This is the first small, non-destructive transition feature following Phases 0–6L stabilization. The **Advanced** video inspector gains independent **entrance** and **exit** fade durations (0–30 seconds, bounded to clip duration), with **linear** and **smooth** curves. The inspector shows an automatic schematic with **blue Video A**, a **yellow-gold transition**, and **red Video B**, without using actual footage.

Gold regions mark active fade extents at each video clip edge in the timeline. They are display-only and do not interfere with dragging or trimming.

## Behaviour

- The original media file, clip start, trim, source offset and base opacity are unchanged.
- Fade durations are stored independently on each clip in `visualTransitions.enter` and `visualTransitions.exit`. Zero durations preserve the preexisting appearance.
- An entrance starts invisible and fades to the clip's base opacity. An exit fades from base opacity to invisible. When both fade ranges overlap, use the lower opacity at each timestamp. Linear and smoothstep curves are available.
- The effect is applied in the common canvas renderer, used by **live preview, PNG snapshots, real-time recording, and fixed-frame export**. Rendering a higher video layer with alpha exposes lower visible video/background/sticker layers; without one, the existing opaque black project canvas is revealed. **Transparent video-file export is not claimed or implemented**.
- Existing embedded video audio is **not** altered by visual fades. No automatic audio crossfade or destructive trimming occurs in Phase 8A.
- Undo/redo snapshots deep-copy transition settings. Duplicating a video copies both fades. Splitting retains the entrance only on the left clip and exit only on the right, without creating unintended new fades at the cut.
- The existing timeline policy that relocates overlapping clips onto separate lanes is preserved. A/B fades can blend when the two videos' timeline ranges overlap in different layers; they do not create overlap automatically.

## Tests and follow-up

New Node regression cases cover default behaviour, alpha at entrance/exit boundaries, curve/overlap calculations, deep-copy history, split metadata and render-engine alpha independent of linked sound. A real-Chrome canvas test renders blue and red overlapping sources at six timestamps, compares actual pixel colours and verifies schematic controls are present. Existing Chrome/Firefox, multi-clip exports and long-form performance CI must continue to pass.

**Verified and merged:** [PR #43](https://github.com/cinaedvsstudios/Organon/pull/43) was merged as commit `2f0938ea0884518437b13b6ab96f559693e80b1c` after all three jobs passed in [GitHub Actions 44448320745](https://github.com/cinaedvsstudios/Organon/actions/runs/44448320745).

- **101/101 Node tests passed**, including all six new fade/undo/compositing assertions.
- Actual Chrome canvas test passed pixel checks at six moments: blue before B, blue at B's start, magenta midpoint (RGB 128,0,126), red at full B, magenta at B's exit midpoint, blue after B; inspector schematic controls were verified.
- Real Chrome MP4/WebM export regression, repeated-export memory tests, and synthetic portrait/rotation checks passed. In particular, full 120-second 1080p MP4 decoded 3,600 frames with audio, and the existing 120-second 720p WebM export still passed.
- Existing Firefox and Linux WebKit compatibility/safety tests passed unchanged.

**Important scope:** This verifies the first independently adjustable alpha-fade implementation, **not** automatic transition pairing or transparent-alpha file export. Physical Windows/Android camera-media acceptance remains unverified.

## Later increments (not yet included)

- Clip-pair linkage and automatic overlap/transition length tools.
- Wipes, directional transitions, additional curves, reusable searchable transitions library and marker drag editing.
- Transparent-alpha export where a supported container/codec permits it, designed separately rather than misrepresenting opaque MP4 as an alpha video.
- Physical Windows/Android camera-footage acceptance remains a separate release check. Additional Safari/Apple certification is out of scope by user direction.
