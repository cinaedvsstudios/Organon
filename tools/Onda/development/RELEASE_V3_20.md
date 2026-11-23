# Onda v3.20 — Read-only on-device compatibility and playback QA

**Implemented in source:** 2026-11-23  
**Status:** 37 source/static/isolated tests passed. Android Chrome, desktop runtime, Netlify deployment and physical lock-screen/file-permission results still need the user's device.  
**Previous:** [v3.19 Quick Play](./RELEASE_V3_19.md).  
**Scope:** Non-destructive release verification aid, **not** a new playback engine or storage change.

## Why

Onda v3.11–v3.19 source changes were tested in isolation, but actual Android compatibility, offline playback, long-lived file permissions, responsive layouts and live Netlify deployment have not been verified. External access to the public Netlify URL failed in this session, and no GitHub Actions workflow/status checks were attached to v3.19's merge commit.

This release puts a small read-only checker in Onda itself so the actual phone or desktop browser can report which platform APIs are present. **An available API is not proof that a file will play, a permission persists or lock-screen audio will work.** Those outcomes must be marked by the user after an actual test.

## Where to find it

Open **Settings & Extras → Storage Health → Device compatibility and playback QA (read-only)**.

Click **Run device checks** to capture:
- Onda loaded source version (expected `v3.20`; a different version is clearly flagged)
- secure-context availability and installed/standalone vs regular browser tab
- rounded viewport width/height
- availability of Remember Files/Folder picker APIs, Media Session, MediaMetadata, position reporting, storage estimation
- whether the current Onda Quick Play/diagnostics/Library/player modules are present
- browser audio `canPlayType` hints for MP3, WAV, OGG Vorbis, AAC and FLAC

The browser doesn't open a file chooser, ask for storage permissions, sample media, access playlists, read stored files or change playback. **Codec results are browser hints**, not real-file decode tests.

Eight **manual playback checks** start at **Not tested** and can each be marked Pass, Fail or Blocked after trying them:
1. Saved track plays after reload
2. Quick Play plays a disposable file
3. Quick Play leaves the Library/queue/cache unchanged
4. Main Play stops the preview
5. Lock-screen/headphone media controls work
6. Saved-file reconnect and permission handling work
7. Mobile Library search/touch/views work
8. Ordinary Add Files still imports and survives reload

Click **Export redacted QA JSON** after Run. The report is downloaded locally and consists only of fixed test keys/verdicts, fixed browser capability names and booleans, coarse codec hints, rounded viewport, source version and capture time. No filenames, track IDs, file paths, local file contents, passwords, URLs, user-agent string, cloud profile, storage byte totals, cookies or private Library data are collected. **No network, IndexedDB, localStorage or sessionStorage calls** are made by this QA module. The results remain in RAM until refresh; refresh resets the manual verdicts.

## Verified source-level tests

37 isolated/static checks passed: JS syntax; cache-busted source links; module script order; five unique UI control IDs; mobile 44px styling; no file picker/audio/storage/network invocation; safe `textContent` output; controls idle until explicit Run; export disabled until Run; eight manual tests default Not tested; actual execution of the module in a mock browser; feature/codec detection; field allowlists; corrupt manual verdict sanitization; local JSON export; and temporary export URL revocation.

## Android and desktop device procedure (pending)

1. Open the [Onda player](https://ondaplayer.netlify.app/) normally. Do **not clear site data**, cached music or old Library files. If the live app still shows an older version than v3.20, deployment is not yet verified.
2. Open the QA panel, Run device checks, and read whether v3.20, Quick Play, Media Session and file-picker features are reported as present.
3. Play two previously saved local MP3 tracks. Refresh the player; try playing them again. Use Reconnect only if the audio actually needs it.
4. Select a disposable MP3 using temporary Quick Play. Verify audio, then compare Library/queue/cache before pressing Add. Return to normal playback and ensure preview stops. Test a separate explicit Add only on disposable audio.
5. Lock the phone during a saved track and during preview playback; use Android notification/headphone buttons, then return to Onda. Confirm position, artwork/title and that audio didn't stop unexpectedly. Repeat in normal Chrome tab and installed home-screen shortcut where available.
6. Test touch and layout at portrait/landscape sizes, and normal Add/Library/search/playlist actions. Mark Pass/Fail/Blocked/Not tested only from observed results.
7. Export the redacted JSON. Check the report yourself before sharing. A report is a diagnostic aid, not a guarantee that every runtime flow has been validated.
8. On desktop Chrome, run the same capability checks and repeat normal import/playback/Library functionality.

## Release safety

No media engine, file handles, browser audio database, playlist, queue, history, import semantics, playback symbols, cloud sync or saved data changed in v3.20. The new panel does not automatically read files, delete caches, or run intrusive tests. Android/Netlify deployment and genuine playback remain **unverified** until device test evidence is provided.
