# Onda v3.13 — Remember Files / Folder (Android File Access)

**Implementation:** 2026-11-23. **Status:** Committed to main; source-level and isolated tests passed. Real Android Chrome and the public Netlify deployment **still require testing**.

**Public player:** https://ondaplayer.netlify.app/  
**App version:** `v3.13`, `index.html` loads `js/file-access.js?v=3.13` before `js/app-core.js?v=3.13`.

## Changes delivered

### Optional remembered file and folder import

Two new buttons appear in **Library drawer → Settings**, alongside the existing **Add Folder** button: **Remember Files** and **Remember Folder**. The buttons are hidden when the corresponding browser picker is unsupported.

- **Remember Files:** Chrome's `showOpenFilePicker({multiple:true})` obtains explicit read-only file handles for selected files.
- **Remember Folder:** `showDirectoryPicker({mode:'read'})` enumerates audio/MIDI-compatible files and creates stable paths relative to the chosen root folder. To avoid excessive UI blockage, traversal stops with an explanatory error above 3,500 suitable files or more than 12 nested directory levels; the user may select smaller folders.
- Both actions pass File objects into Onda's **existing** import, playlist and IndexedDB audio-cache logic; `handleUploadedFiles(files, options)` additionally receives the associated handles and relative paths.
- Files retain Onda's original deterministic track IDs when the chosen relative path/size/timestamp matches a previous import. If paths differ from a past import, the IDs may differ; **do not claim cross-path deduplication**. Reconnect is the safer way to associate a moved source with the exact original entry.
- A browser that cannot persist handles will still import the selected media via normal audio caching; a warning explains that direct access could not be remembered.
- The existing standard Add/import/drag-and-drop workflows are unchanged and remain the fallback.

### Separate browser-only handle database

The new module `js/file-access.js` uses **OndaMediaPlayerFileHandlesDB v1** (store `files`) to persist `FileSystemFileHandle` references, relative paths and small linking metadata via IndexedDB structured clone.

This is deliberately **independent of** the existing **OndaMediaPlayerPersistentDB v2** (stores `state` and `audioFiles`). There is **no version bump or migration** for the existing music database. The new database does not store additional audio bytes: the pre-existing audioFiles store continues caching media as before.

Handle references are device-/origin-bound. They are not exported in Onda JSON backups or included in Netlify cloud sync. The app never requests write permission to the user's original files.

### Playback and permission handling

- Onda silently tries existing in-session files and its saved audio cache first.
- If no cached bytes can be read, it uses `OndaFileHandles.readFile(trackId)` to retrieve a remembered file **only when Chrome has already granted read permission**. This never creates a surprise prompt while pressing Play.
- If permission has expired and the cache is unavailable, the existing **Reconnect** action first tries an explicit `requestPermission({mode:'read'})` on the saved handle. This is initiated by the user's tap. If Chrome refuses or the original is gone, a subsequent Reconnect tap opens the existing manual picker.
- Manual Reconnect preserves the original Library ID, tags, playlists and metadata. The original Android file is not modified or removed.
- The Library status recognises **file linked / MIDI linked** in addition to cached / ready / needs relink. Storage Health shows the number of remembered file links.

**Important:** Saved handles do not promise permanent read permission. Chrome can revoke access or require the user to grant it again. Onda deliberately keeps existing cached music as the reliable default until this has been verified on the user's Android phone.

## Safety boundaries

- No changes to the Current-screen Queue/Now Playing placement or the Library drawer's normal browsing modes.
- No auto-deletion, orphan cleanup, cache migration, temporary TTL or change to default import caching.
- No file writes or deletion to the user's Android storage.
- No external API, upload, server or cloud backend for music access.
- No autoplay without a user interaction.
- If a handle reference is unsupported or cannot be stored, Onda continues using cached audio/normal import.

## Source changes

- `tools/Onda/js/file-access.js` — new isolated File System Access module and browser-local handle database.
- `tools/Onda/js/app-core.js` — linked-file index, cache-first playback fallback, optional import with links, reauthorization flow, linked statuses and Storage Health.
- `tools/Onda/index.html` — two optional Settings actions, new script and v3.13 cache buster.

## Isolated tests completed

**31 isolated/static checks passed in two groups:**

**13 File System Access module checks** using mock IndexedDB and mock Chrome handles: capability detection; choose file; recursively enumerate folders and ignore non-media files; save handle without duplicating audio; restore linked IDs; read with granted permission; no permission prompts during silent playback; explicit Reconnect permission; denied permission handling; secure-context support; JavaScript parsing.

**18 core integration/source checks:** JavaScript parsing; module loading order/version; original v2 music DB unchanged; existing import retains file caching; buttons and fallback remain; no automatic deletion/write permission to original media; linked-source status; true missing status after both inventories; unchanged streams; cache-first then file-handle fallback; reuse of file during session; linked import uses the same track ID and relative folder path; catalogue still saved once; audio cache still written.

These tests do **not** constitute Android device validation, actual storage persistence after force-closing Chrome, OS Media Session reliability or Netlify deployment verification. Do not mark those QA scenarios passed until physically tested.

## Android acceptance tests (still to do)

1. Open https://ondaplayer.netlify.app/ and verify **v3.13** appears.
2. Go to the **Library drawer → Settings**. Confirm **Remember Files** and **Remember Folder** appear if Chrome supports the relevant picker.
3. Import a **disposable test MP3** with Remember Files. It should appear once and play immediately, with no second Add to Library step.
4. Refresh Chrome, restart it and try playing the linked track again. If Chrome asks for permission, note whether cached playback still works first.
5. In Settings → Storage Health, verify **Remembered file links** count.
6. Using a disposable uncached file in a disposable test browser profile, validate read access via remembered handle and explicit Reconnect without changing the track's Library identity. Do not clear the user's real Onda site data to simulate a missing cache.
7. Test Remember Folder, including nested subfolders, without unexpectedly duplicating previously imported tracks.
8. Verify the original Add Folder picker and normal Add Files workflow still work.
9. Recheck MP3, MIDI, playlists, direct streams, background/lock-screen playback and paused visualiser.
10. Test desktop Chrome and mobile screen widths; report any Chrome picker limitations.

**Rollback:** Revert the v3.13 UI/core changes and remove the optional file-access script include. Keep v2 IndexedDB untouched. The separate handle DB may remain unused without affecting older Onda versions. Never clear site data as a rollback step.

## External API references

- Chrome 132 Android File System Access support: https://developer.chrome.com/blog/new-in-chrome-132/
- Chrome File System Access API: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- MDN permission query: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission
- MDN permission request: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission
- MDN structured clone and handles: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm

## Remaining plan

Next: verify the actual Android experience and fix any regressions before considering source-handle-first caching, new storage migration, or manual review of unused audio caches. The optional, manual storage cleanup is **not yet implemented**. Current/Now Playing refinements remain a separate later UI batch. Resume-position and video playback remain deferred.
