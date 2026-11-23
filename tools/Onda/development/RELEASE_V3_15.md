# Onda v3.15 — Main-Screen Now Playing / Queue

**Implementation:** 2026-11-23  
**Status:** Source updates committed to GitHub `main`; 32 isolated/static checks passed. **Public Netlify deployment, Android visual layout and real playback remain unverified.**  
**Live URL:** https://ondaplayer.netlify.app/  
**Version:** `ONDA_VERSION = 'v3.15'`, `index.html` loads `js/app-core.js?v=3.15`; changed queue and responsive styles have their own `v=3.15` cache-busting URL parameters.

## User-approved placement and design contract

**Queue / Now Playing stays on the main Current workspace, not inside the Library drawer.** This is an already-approved product decision. This release extends the existing `#tab-library` workspace and `#now-playing-playlist-panel`; no drawer navigation tabs are added. Existing top transport symbols, theme, saved playlists, File/IndexedDB caches and data structure are preserved.

## Main functional improvement

Previously `updateNowPlayingPlaylistPanel()` immediately hid the queue when the active track did not belong to a named saved playlist. This made ad-hoc queues built by importing files or tapping Play on Library tracks invisible on Current.

Now the Current panel displays the **actual active `playlistTracks` queue** regardless of whether it originated from:
- A named saved playlist;
- Files added through ordinary import;
- Existing Library entries played or enqueued directly;
- An import or backup that restores an ad-hoc queue.

If a named playlist is the source, the optional existing playlist artwork/name and edit control are still displayed. The queue rows themselves always represent the **live playing order** (not every ID in that saved playlist), preventing misleading rows after adding or removing ad-hoc queue items.

An empty queue shows a concise action hint instead of simply disappearing. The queue is refreshed when opening Current, after library restore, when a track changes, and when a new item is enqueued without starting playback.

## What the Current queue displays

- Queue title, track count, and current-song index;
- A short **Up next** label; if shuffle is enabled it explicitly notes that the upcoming order may vary;
- Distinct styling for **Now playing**, **Up next**, and other queued rows;
- Direct **▶️ Play** on the specific existing queue row — no second import/add step;
- **ℹ️ Info** expands details inline for that queue row **without replacing `currentFile`**, which previously caused player metadata to disagree with actual audio;
- **➕ Add to playlist** retains the existing playlist-creation/assignment workflow;
- **× Remove from queue** for non-playing rows. This only splices the live `playlistTracks` array and saves the new queue state. It does **not** delete a saved Library track, edit the original saved playlist or remove any cached/original audio. If an earlier queue item is removed, `currentTrackIndex` is shifted so the playing track remains selected. Shuffle state is rebuilt if necessary.
- Existing **🎯 jump to current** and optional **✏️ edit saved playlist** header controls, bound without dynamically interpolated `onclick` code.

The existing Show/Hide song information and Show/Hide queue toggles remain. The prior 'Hide playlist' label has been renamed to 'Hide queue'; visibility preference persists. Without a saved named playlist, the queue toggle is no longer disabled.

## Mobile layout

On ordinary mobile widths or the user-selected force-mobile mode:
- The queue panel is positioned **immediately after the Current screen's Now Playing heading**, before long artwork/metadata/lyrics sections.
- The active queue list is capped at `min(46vh,430px)` and scrolls internally to avoid pushing everything else far below a large list.
- Row actions remain comfortably tappable and wrapped within screen width.
- Queue title, next track and counts wrap rather than overflowing.
- The existing charcoal/gold/blue Onda appearance remains.
- Explicit **force-desktop mode** is not overridden by these narrow-screen mobile queue rules.

No changes to the Library drawer were needed.

## Files changed

- `tools/Onda/js/app-core.js`: real ad-hoc queue rendering, metadata and selected-row controls; update hooks; v3.15 version.
- `tools/Onda/css/playlists-now-playing.css`: Current queue header, row, status, empty state and expanded details.
- `tools/Onda/css/responsive.css`: mobile placement and bounded scroll, while respecting force-desktop mode.
- `tools/Onda/index.html`: queue toggle label, v3.15 JavaScript/CSS URLs.
- `tools/Onda/development/*`: release and Android QA record.

## Isolated/source verification

**32 checks passed**, in two groups:

- **19 queue-interaction checks** against the extracted current queue renderer and mock DOM: anonymous queue visible, queue status and counts, current-row accessibility state, usable toggle without named playlist, remove action only for other tracks, removal before the active track preserving the current index and song, no saved playlist mutation, autosave, direct Play, Info not changing the playing track, opening/closing inline Info, Add to playlist and save.
- **13 additional queue-state checks**: empty queue hint, saved playlist header and edit action, rows use the active queue rather than full saved playlist membership, show/hide preference, shuffle warning, repeat-all wrap label, HTML escaping of track titles/filenames, and JavaScript parsing.

The core source and HTML/CSS configuration were checked directly through GitHub. The tests use mock DOM and audio stubs; they **do not** prove Android layout/touch target dimensions, real media playback or Netlify publication.

## Real Android and desktop smoke test — still pending

1. Open https://ondaplayer.netlify.app/ and check the app actually reports **v3.15**.
2. On Current with **no named playlist**, import two disposable MP3s or play them from Library; the actual queue appears immediately **on Current**, not the Library drawer.
3. Play the second track; Current marks it Now playing and describes the next item correctly.
4. Remove an earlier, non-playing queue item. Current track remains the same; original MP3 and its Library entry remain available.
5. Tap **Info** on an upcoming track. Its details should expand **without changing the currently audible track or metadata**.
6. Add an upcoming item to a saved playlist. The queue remains and the saved playlist membership updates.
7. Load a saved playlist, then append a different track to the active queue. Verify Current lists the real queue, while the named saved playlist itself is unchanged.
8. Enable shuffle and repeat-all. Queue must not falsely claim a fixed upcoming shuffle order; next/previous playback still works.
9. Test Show/Hide queue and Show/Hide song info, including reopening the page.
10. Test 320/360/390/420 px portrait, landscape, large text, force-mobile and force-desktop layout, scrolling, touch targets and keyboard.
11. Check MIDI, direct stream, cached files, Android screen-lock media controls, and Settings → Storage Health all still work.
12. Do not clear Android Chrome's site data as a test. No music cache migrations/deletions occurred in this release.

## Remaining development

The next planned batch is **mobile Library drawer browsing/navigation refinement**, based on the existing drawer and preserving any custom icon mappings. Later: optional new-file Quick Play; public GitHub Pages online media; optional low-priority position resume.

**Rollback:** If real-device testing finds a regression, revert the v3.15 Current UI/logic commits. This batch does not change IndexedDB stores, the persisted library ID schema or original files; do not clear browser data.
