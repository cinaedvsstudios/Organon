# MotoriClip Phase 8B — paired Fade and transition catalog

**Date:** 19 November 2026 (Berlin)  
**PR:** (link after PR creation)

## User-selected catalog, batch 1

The 41 transition names from the user's first 10 pages of the GL Transitions gallery are stored verbatim and in the original order in `js/transition-catalog.mjs`. This is an **extendable wishlist, not a claim that all 41 are implemented**. Spellings such as **Brokey dissolve** are deliberately unaltered pending review. New effects can be appended without changing existing IDs.

**Available paired effect:** Fade. **Saved for later:** the other 40 user-selected effects. An inspector disclosure lists all selections; the effect dropdown displays pending names as disabled rather than offering nonfunctional controls.

## User workflow

1. Import at least two video files and place them on the Advanced timeline.
2. Enable **Select** mode and select exactly two populated video clips.
3. In the Project inspector's **Pair Video A → Video B** panel, choose **Fade** and the overlap duration.
4. Select **Apply paired transition**. The earlier timeline clip is A, the later clip is B. B is shifted so its beginning overlaps the final requested seconds of A. If necessary, B gets a dedicated higher video lane so the transition composites correctly without colliding with other clips.
5. The first clip remains full strength; B fades in over it. This avoids an unintended darkening caused by independently fading both alpha layers at the same time. The gold entrance marker on B shows the actual fade interval. The inspector reports the pairing.
6. **Undo/redo** restores clip placement and transition metadata. **Unlink paired transition** removes the relationship only; it leaves the current overlap and visual fade in place, allowing subsequent manual adjustment. Dragging/trimming either source until the planned overlap no longer matches also breaks the pairing label, without deleting the visual fade.

## Scope and safety

- Source files, source offsets, trimmed durations, original audio and existing volume settings are not rewritten.
- Existing separate video-lane collision protection remains in force for normal drag interactions; a pair intentionally creates overlap in **different** lanes.
- The pairing logic is pure, independently validated, and the relationship stores only primitive track IDs in history snapshots. Invalid links are cleaned up when clips change.
- Preview, snapshots, real-time and offline exports use the same Phase 8A canvas fade compositor. **Linked audio is not crossfaded in this increment**, and transparent-alpha video-file export is not implemented.
- Does not alter Basic mode, default routing, the 120-second offline export cap or Apple/Safari certification scope.

## Verification

- Node test: catalog has exactly 41 unique names, preserves user spelling and order, exposes only Fade as implemented; plan computes exact duration/overlap, detects lane collisions, rejects unsupported inputs, retains media/audio and preserves link metadata through history.
- Real Chrome UI test: two generated MP4s imported, added to timeline, selected, paired, gold marker shown, and Undo/Redo returns the inspector link. All prior Chrome/Firefox and real export CI jobs must remain green.

**Status:** Awaiting PR CI verification.
