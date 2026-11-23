# Onda v3.14 — Read-Only Audio Storage Review

**Implementation date:** 2026-11-23  
**Status:** Committed to `main` with static/isolated tests. **Live Netlify and real Android storage scans remain unverified.**  
**Public player:** https://ondaplayer.netlify.app/  
**Version:** `ONDA_VERSION = 'v3.14'`; entrypoint loads `js/storage-audit.js?v=3.14` before `js/app-core.js?v=3.14`.

## Purpose and safety

This batch implements the previously approved **storage analysis and cleanup preview**. It does **not** delete, move, overwrite, deduplicate, compress, hash, upload or automatically clean up **any** audio. The new module uses an IndexedDB **readonly** cursor against the pre-existing `audioFiles` store in `OndaMediaPlayerPersistentDB v2`. It extracts only small File/Blob **metadata** (size, filename, path, last-modified, MIME type, saved date and track ID); it never reads media bytes into a JavaScript ArrayBuffer.

The existing `OndaMediaPlayerPersistentDB` version 2 and v3.13's independent remembered-handle database remain unchanged. Onda still uses cached audio for one-tap playback. Original music on the user's Android device is never accessed or deleted by this review.

## How to use

Open Onda's **Settings → Storage** panel and press **🔎 Review Cached Audio**. The report appears directly below Storage Health. It is an explicit, on-demand snapshot; Onda does not scan every track on each UI action. Run it again after importing, removing or restoring library entries to refresh the figures.

The report contains:
- **Saved audio records:** total IndexedDB entries in `audioFiles`.
- **Playable cache bytes:** sum of File/Blob sizes for records with valid media objects. This is not the same as `navigator.storage.estimate()` (whole-site approximate usage).
- **Unlinked cache records:** records not referenced by any currently loaded `virtualLibrary`, playlist, current playback queue/track, history, or recognized locally saved autosave/backup/last-good track IDs.
- **Unlinked cache bytes:** total playable media bytes in those entries. These are **candidates for human review**, not guaranteed safe-to-delete bytes. Older backups or untracked associations may still matter.
- **Potential duplicate groups:** different track IDs with an exact metadata match for filename (case-folded), File/Blob size, nonzero lastModified, and MIME type. The report also shows source paths, retained IDs, and whether an entry is referenced.
- **Unverified duplicate surplus bytes:** theoretical additional bytes in each candidate group (`(group length − 1) × per-file size`). This is **not** a verified content match, does **not** mean those audio bytes are removable, and can **overlap** with unlinked bytes. The two estimates **must not be added**.
- **Unreadable/metadata-only records:** tracks with no usable audio File/Blob in the indexed record. True size is not available from verified media metadata.
- **No cleanup controls:** No delete button, selection-to-delete, automatic TTL, or permission to modify the underlying recordings is provided in v3.14.

The UI shows up to the first 80 unlinked entries and 60 potential duplicate groups (up to 12 group members) with their totals still computed over the complete scan. A safety limit stops the scan after 20,000 records and shows an error, rather than producing a misleading partial total. Filenames and paths are escaped when displayed. No report is sent to an online service.

## What is and isn't a duplicate

The matching fingerprint is `normalized filename + byte size + last-modified timestamp + media MIME type`. It is useful for finding *possible* redundant copies but cannot prove that two recordings contain identical bytes: files can retain identical metadata even after changing contents, and identical audio with different filenames or timestamps may not be matched. No full-file hashes or byte comparisons are attempted because those operations could be expensive for a phone's large music collection.

**Unlinked** means "not referenced in the currently loaded library, queue, history, playlists or known local backup IDs." It does not mean "unneeded" or "safe to delete." Even an unlinked record may be the only playable cached copy, especially when the original Android file is gone.

## Files changed

| Path | Change |
|---|---|
| `tools/Onda/js/storage-audit.js` | New read-only IndexedDB cursor and pure grouping/summary functions |
| `tools/Onda/js/app-core.js` | Collect conservative protected track IDs, render escaped report, handle explicit Review action, v3.14 |
| `tools/Onda/index.html` | Add Review button and report panel to existing Storage Health card; load audit module, core, and updated CSS |
| `tools/Onda/css/modals-settings.css` | Compact mobile-friendly report styles using Onda's current colours |
| `tools/Onda/development/*` | Release documentation and QA updates |

## Verification completed

Two isolated/static groups passed against repository source:

- **18 audit/data checks:** JavaScript syntax; summary export; valid/invalid counts; byte totals; strict duplicate grouping; protected IDs; a simulated read-only IndexedDB cursor; metadata-only reads; no deletion API; preservation of queue, playlist, history, current and backup references.
- **12 report/UI checks:** HTML escaping of potentially malicious filenames and paths; summary, unlinked, duplicate, damaged and snapshot displays; no delete controls; successful report execution with protected IDs; disabled/enabled Review button state and read-only flow.

These tests are **simulations and source inspection**, not real Android IndexedDB operations, real performance measurements, or proof that Netlify is serving the new version. The core JavaScript and module were also parsed. **30 isolated/static tests passed** in these groups.

## Android / desktop acceptance still required

1. Open https://ondaplayer.netlify.app/ and verify **v3.14** is deployed.
2. Go to **Settings → Storage → Review Cached Audio**. Confirm the button and report appear and do not disrupt the current player.
3. After inspecting Storage Health, compare the reported cached-record count and bytes to the new report. Some metadata-only or damaged records may be counted differently.
4. Import a disposable audio file, then refresh the review. It should be listed as a referenced cached file and not appear as an unlinked candidate.
5. Delete **only its Library listing** (never its original music file) in a disposable test library/profile. Review should identify the cache record as unlinked **unless an older local backup retains its ID**.
6. If the test profile contains two files with the same name, size, timestamp, type and different IDs, they should appear only as **possible** duplicates. Similar names alone should not count.
7. Ensure the report never shows a Delete/Remove/Clear command; browser cache and the original music must be unchanged.
8. Lock and reopen Chrome after reviewing; normal saved Library playback, Current screen queue, MIDI and stream playback should remain unaffected.
9. Check small Android screen and desktop widths, the report's expandable lists, keyboard access and screen-reader labels.
10. A huge cache may take time to scan. If the browser denies storage access, the report should show a useful error rather than claiming zero files.

**Do not clear site data or intentionally damage the user's only music cache during QA.** Use disposable test files and a separate test origin/profile for any destructive scenario.

## Next development gate

Before implementing optional user-approved cleanup, test the audit on Android, inspect reported unlinked/duplicate entries with the user, design a confirmation screen that explicitly distinguishes browser cached copies from original files, confirm how backup-only references should be treated, and verify that the remaining source can still play. No automatic removal of legacy imported audio or files with a remembered handle is approved.

Future batches: Current / Now Playing main-screen queue improvements (never in Library drawer); mobile Library drawer usability; optional new-file-only Quick Play; GitHub Pages-hosted online audio; optional P3 resume position.

## External technical references

- IndexedDB read-only cursor: https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/openCursor
- Browser storage estimates: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate
