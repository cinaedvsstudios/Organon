# Onda v3.16 — Mobile Library Browsing and Search

**Implemented:** 2026-11-23  
**Status:** Source implemented on GitHub, 26 isolated/source checks passed. **Real Android, desktop, and public Netlify deployment are not yet verified.**  
**Live app:** https://ondaplayer.netlify.app/  
**Version:** `ONDA_VERSION = 'v3.16'`; `js/app-core.js`, `css/library.css`, and `css/responsive.css` have versioned `v=3.16` references.

## Purpose and preserved behaviour

This is a focused improvement of the **existing** Library drawer, not a replacement for it. The playing queue and Now Playing stay on the main **Current** screen. Onda's player symbols (🧿, ⏮, ⏭), colour theme, playback engine, custom icon settings, file/playlist IDs, media caches, history, cloud sync and original audio files are unchanged.

The mobile drawer now has visible navigation buttons for the already-existing `results`, `recents`, `playlists`, and `help` views. The Icon Guide exposes the existing per-icon editing and reset controls; the same local custom icon storage is used, so previously chosen icons are not erased.

The Recents view now shows the existing recent-track rows, and the Playlists view shows saved playlists including their track counts and existing Edit action. Opening a playlist follows Onda's existing playlist workspace behaviour. This does **not** add a new Queue tab.

## Mobile browsing actions

- **Play stays explicit:** The existing ▶️ button plays an already saved track through Onda's existing source resolver; its mobile touch target is now 44px. Missing sources still use Reconnect. The row body still selects a track, as before, until actual phone feedback supports changing that behaviour.
- **Select mode:** The existing mobile Select button now toggles multi-selection mode. Existing row selection and desktop behaviour are otherwise preserved.
- **Search is preserved:** Opening/reopening the Library no longer empties the search box or runs delayed forced clearing. A search with no matches remains visible until cleared by the user. Typing in another mobile Library view switches to Results.
- **Restore view:** Reopening the drawer respects the last selected view instead of forcing Results.
- **Quick file import:** The Add Files action opens Onda's existing import picker; it does not create a new Quick Play or alter the existing cache behaviour.
- **Storage shortcut:** Opens the existing Storage Health tab without duplicating settings.
- **Library count:** A compact status reports displayed tracks, total tracks and streaming entries.

## Scope and safeguarding

- Only `tools/Onda/js/app-core.js`, `index.html`, `css/library.css`, `css/responsive.css` and development documentation were changed.
- No IndexedDB schema or cache writes/deletions introduced by this update.
- The existing Recents and Playlist containers were made available to their mobile views; CSS keeps them hidden on desktop as before.
- All new drawer navigation and help controls are mobile-only. Desktop Library layout is otherwise preserved.
- The fallback for an unknown saved mobile view remains Results.

## Code/source verification performed

26 assertions passed in the isolated source pass, including parseable JS, correct script/CSS cache versions, navigation and shortcut existence, existing binding/selector connections, absence of search auto-clear logic, scoped mobile-vs-desktop styles and execution of the extracted real `setMobileLibraryView()` function with a mock DOM. The isolated view-switch test confirmed a single active tab, correct `aria-pressed` values and invalid-view fallback.

These checks do not test actual Android DOM layout, Chrome file permissions, lock-screen playback, battery impact or browser deployment.

## Android and desktop acceptance test (pending)

1. Confirm the public app reports **v3.16** after Netlify deployment. Do **not** clear browser storage or cached audio as part of version testing.
2. Open the Library on Android in portrait. Confirm Results, Recents, Playlists, Icon Guide, Add Files and Storage are visible and tappable; scroll the horizontal shortcut bar if needed.
3. Search for a saved track, close and reopen Library, and confirm the search is still present. Enter a string with no match and confirm it is **not** auto-cleared.
4. Tap the explicit ▶️ Play button: the saved track should play without reimport. Tap the row body and confirm existing selection behaviour is preserved; use Select mode to inspect bulk-selection actions. Check the enlarged Play touch target.
5. Tap Recents and play an entry. Open Playlists, inspect named playlists, open one and edit one, then return to Results. Confirm custom navigation icons survive reopening and app relaunch.
6. Tap Add Files and pick a disposable MP3. Check normal import and current queue, metadata and cache preservation.
7. Tap Storage; confirm the Settings popup opens directly to Storage Health and cached-audio review remains read-only.
8. Test 320/360/390/420px portrait, landscape, keyboard open, safe-area insets, larger text, swipe/scroll, force-mobile and force-desktop modes. The drawer must remain above the bottom controls without trapping scroll.
9. Verify original player buttons, Current queue, next/previous, streaming, cached tracks, lock-screen media controls and missing-source Reconnect behave as before.
10. On desktop confirm Library controls, search, row selection, playlists, cloud sync and Settings remain functional; new mobile-only nav is not shown.

**If any Android layout or click-routing behaviour regresses, correct it with a targeted commit before declaring v3.16 device-verified.**
