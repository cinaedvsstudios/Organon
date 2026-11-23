# Onda v3.12 — Safe Storage Optimisation (Batch 2)

**Implementation date:** 2026-11-23  
**Status:** Committed to GitHub \`main\`; **Android Chrome, real audio playback and Netlify deployment not independently tested**.  
**Public player:** https://ondaplayer.netlify.app/  
**Code version:** \`ONDA_VERSION = 'v3.12'\`; entrypoint loads \`js/app-core.js?v=3.12\`.

## Why this batch

The user's requested priority **#2 is storage optimisation**: reduce avoidable cache and catalogue writes, without making already-imported songs harder to play or risking existing music. The earlier v3.11 work already added accurate read-only cache information, one-tap saved-track playback and Reconnect.

This batch deliberately keeps the current **cache-first safety model** until persistent Android file handles have been proved reliable. No automatic deletion, cache purge, migration or import-default change has been introduced.

## Changes shipped

### 1. Identical files no longer rewrite the entire IndexedDB audio record

Previously, \`persistLocalAudioFilesToIndexedDb()\` always called \`idbSetAudioFile()\` for every imported/reimported local item, even if that exact song was already safely saved.

Now \`saveAudioFileOnlyIfChanged(trackId, file, meta)\` checks the current IndexedDB record and skips \`put()\` when all of these are true:

- the existing audio record contains an actual usable File/Blob;
- its precise saved filename matches;
- its saved local relative path matches;
- its byte length matches;
- its media MIME type matches;
- both old and incoming \`lastModified\` are known/nonzero and identical.

If **any** comparison is uncertain or different, Onda uses the **old safe behaviour** and writes the selected File into the existing track's IndexedDB key. Files are never hashed or decoded just to compare them; the stored metadata is examined without reading the audio into JavaScript memory. This saves potentially expensive Blob writes on repeated imports but does **not** promise content-byte identity against files whose metadata was deliberately preserved despite changing contents.

The cache-write function now returns \`{saved, skipped, failed}\`. It serialises in-flight writes *per track ID* to prevent two parallel import batches both deciding the same cache entry is absent.

**Important distinction:** Existing duplicate cache records with *different track IDs* are **not automatically deduplicated** or deleted. This change prevents needless rewrites of existing records; it does not reclaim old storage space by itself.

### 2. New file imports now save the library metadata once, not three times

Before: \`handleUploadedFiles()\` performed immediate, cache-completion, and final full-library autosaves (plus multiple renders). The same large catalogue JSON was serialised and written repeatedly.

Now, after the incoming queue is established and the initial Current track is chosen, the catalogue is saved **once, before asynchronous file caching begins**. A later cache result still refreshes the availability labels and warns of actual cache failures, but it does not rewrite unchanged library JSON.

The saved metadata, stable track IDs, playlists, tags, track selection and user-visible import summary are preserved. Audio caching continues in the background just as before. Failed cache writes **do not erase** the catalogue.

### 3. Android viewport/keyboard resizes no longer rewrite the whole library

\`saveLocalUiStateCheckpoint()\` previously wrote the visualiser stack and full library payload on each resize and orientation event; mobile browser UI/keyboard changes can cause many of these.

For the explicit layout-only reasons \`screen-resize\`, \`screen-orientation-change\` and \`screen-orientation-change-settled\`, v3.12 skips redundant full-library and visualiser-stack writes while retaining its lightweight active-tab/drawer checkpoint. **All other meaningful save paths remain intact**, including ordinary UI interactions, library changes, manual saves and page-close/visibility lifecycle handlers.

## Compatibility and safety

- **IndexedDB database stays at version 2**, with existing \`state\` and \`audioFiles\` stores. No upgrade or migration.
- Existing audio files and saved browser caches are not deleted, shortened, converted or moved.
- No changes to Onda's visual style, icon, visualiser presets, player controls, queue location, media session, or online-library plan.
- Existing already-saved Library music should still play with one tap; no duplicate Add to Library step is introduced.
- **Reimporting an unchanged track** uses saved audio and avoids a new IndexedDB audio \`put()\`. Reimporting a track that changed metadata writes the replacement file as before.
- The original file on the Android device is never altered by this logic.
- The existing Settings → Storage Health page (added in v3.11) still displays cache counts, bytes, missing status and whole-site browser storage.
- Because current source ID generation uses path/filename/size/mtime, truly identical bytes imported under *different* paths/IDs can still occupy separate cache records. Preventing that without false matches requires a future explicit duplicate review/migration design.

## Static and isolated verification

**18 checks passed** against the repository's actual \`app-core.js\` functions under a JavaScript test harness:

- first file import saves once;
- identical reimport skips a \`put()\`;
- changed timestamp, size or relative path results in a replacement write;
- unknown timestamp results in a safe replacement rather than a skip;
- malformed cached media is replaced;
- parallel imports for the same track serialize correctly, with one saved write and one skip;
- pending write queue fully drains;
- import pathway has one metadata save, before cache operations;
- screen resize and both orientation notifications skip heavy saves;
- active-tab checkpoint still persists during resize;
- page-hide checkpoint still writes library and visualiser data;
- JavaScript parsing of Onda core and MIDI succeeds;
- original IndexedDB version 2 retained;
- no automatic audio deletion added.

**Not tested here:** actual browser IndexedDB latency, storage quotas, battery improvements, Android audio focus, Chrome startup and Netlify publishing. Avoid claiming particular MB saved or measured performance gains without real-device data.

## Suggested mobile smoke test

1. Open the **public player**, make sure it reports v3.12 and Settings → Storage Health still shows cached audio.
2. Import a disposable MP3 once, then import the exact same file again. It should remain a **single saved library entry** and continue playing normally.
3. Import a modified copy (new timestamp or size). Onda should update the cache rather than reusing the old bytes.
4. Lock the phone and resume the app. Verify cached music and playlists survived.
5. Rotate the phone and open/close the Android keyboard. Library remains intact and usable.
6. Try regular playlists, MIDI and streaming. The Now Playing/Queue area stays on the main Current screen.
7. Don't clear Chrome's site data or delete existing music as a test; use a disposable file only.

## GitHub commits

- \`098f4683\` — skip identical cached audio writes on reimport
- \`f12e7af6\` — skip full library writes on layout-only events
- \`ca18f769\` — consolidate import metadata saves
- \`070ecfdf\` — mark v3.12 source version
- \`c71e1696\` — change the public app's core script URL to v3.12

## Next work

**Next code priorities after Android smoke testing:** persistent Android file/folder access (only if demonstrated reliable), careful orphan-media inventory, approval-based cache cleanup, and the existing Current-screen queue/mobile drawer refinements. The optional 48-hour rule would apply only to explicitly temporary Quick Play items, never to legacy imported audio. GitHub Pages streaming and resume-position persistence remain lower priority.

**Rollback:** revert the above code commits to the previously validated v3.11 behaviour if a regression appears, then re-test. Do **not** erase localStorage or IndexedDB as a workaround. No database version change was introduced by v3.12.
