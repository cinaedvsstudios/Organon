# Onda v3.21 — Avoid full saves on navigation-only actions

**Implemented in source:** 2026-11-23  
**Status:** 66 source/static and isolated tests passed. Real Android Chrome/desktop responsiveness, public Netlify deployment and lock-screen audio remain unverified.  
**Action:** ONDA-11 responsiveness and ONDA-08 Quick Play hardening.  
**Previous:** [v3.20 read-only device QA](./RELEASE_V3_20.md).

## Why this change was necessary

A source audit of v3.20 found that `saveLocalUiStateCheckpoint(reason)` was already avoiding full Library saves on resize/orientation, but still called `syncVisibleVisualizerCardsToState()`, `saveActiveVisualizerStack()` and `saveActiveLibraryState()` for UI-only operations:

- Opening, resizing or closing the existing Library drawer
- Changing the Library's Results/Recents/Playlists/Help view
- Switching between Onda's Add/History/Playlists/Current/Stream workspaces

The original `switchWorkspaceTab` takes two checkpoints, and closing a Library drawer also took two checkpoints. On large catalogues, these calls unnecessarily serialise and mirror the entire catalogue for navigation alone. Quick Play launched from the mobile drawer goes through this navigation path even though its selected audio is explicitly temporary. The existing code therefore had unnecessary *metadata save churn* during ordinary navigation, although it did **not** intentionally import Quick Play audio.

## Source correction

In `js/app-core.js`, the checkpoint function now classifies layout-only, drawer-only and workspace/library browsing actions separately from meaningful data changes. These UI-only actions still persist the three lightweight existing values for:
- Active workspace tab
- Current mobile Library view
- Last UI checkpoint reason/timestamp

They **do not** trigger visualiser-card synchronisation, full visualiser-stack save or full Library catalogue save/IndexedDB mirror. The redundant pre-close Library drawer checkpoint has also been removed; a single post-toggle checkpoint remains. The existing visual UI behavior, Library tabs and drawer layout have not been redesigned.

**Meaningful operations remain unchanged:** edits to the visualiser (input/blur), settings or metadata import, saved mobile icon changes, settings/export operations, settings and metadata modal closes, pagehide, beforeunload and visibility-hidden events still retain the original full checkpoint path. `flushActiveLibraryState` remains in pagehide, beforeunload and visibility-hidden listeners. Actual track, playlist, music import, cache and source-reconnect mutations keep their own direct save paths.

The new code is a **selective suppression of redundant saves**. It does not change media source files, the audio engine, metadata schema, file handles, playlist memberships, history, storage-health tools, Media Session, cloud syncing, existing saved audio, or Onda's player symbols 🧿 ⏮ ⏭.

## Verification

Executed the actual updated source function in an isolated DOM/localStorage test harness, with observable stubs for the three expensive save operations and for lightweight preferences. **66 assertions passed**, covering:

- 14 layout/drawer/navigation reasons, each verified to avoid full catalogue/visualiser save while still writing all existing small UI keys
- 13 meaningful data/recovery reasons, each verified to retain exactly one call for the synchronise-visualiser, save-visualiser and save-Library operations plus the UI keys
- JS parse, matching versioned app asset, original post-toggle checkpoint intact, one pre-close duplicate removed, screen-change checkpoints intact, pagehide/visibility flush maintained and Quick Play bridge preserved

Tests are source/isolated only. There are **no measured milliseconds, browser storage write counts or power-saving claims for physical Android yet**. Browser/phone performance should be recorded using v3.18's opt-in performance diagnostics; use v3.20's read-only compatibility QA for actual playback verification.

## Android and desktop acceptance

1. Confirm the live version is v3.21. If it still shows an older version, do not clear site data or cache just to force an update; check deployment first.
2. Export optional metadata backups and note existing Library/playlist/cache counts. JSON export does **not** include audio bytes.
3. On Android, repeatedly open/close Library, switch its browsing views and switch Add/Current/History. Verify counts, playlist membership and current track remain stable.
4. Start an unsaved Quick Play from the Library shortcut; verify it auditions without becoming a Library or cached-audio entry, and its UI can return to saved playback.
5. Change a visualiser control and a track tag intentionally. Refresh; verify both changes are saved. Close and reopen the settings popup or tabs as part of testing.
6. Test normal import, existing cached audio play after reload, Reconnect and remember-file access on a disposable file (no storage cleanup).
7. Test Chrome background and lock-screen playback separately; this change does not attempt to fix Chrome/Android background policies.
8. Desktop Chrome: confirm switching workspaces and Library drawer behaves normally and no loss of edits occurs. Only compare timing or battery use after measuring in a real browser.

**Release gate:** GitHub source completion is not evidence of a deployed Netlify build or device-tested playback. Device QA remains pending.
