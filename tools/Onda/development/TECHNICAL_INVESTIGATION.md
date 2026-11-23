# Onda v3.10 — Mobile-First Technical Investigation and Implementation Blueprint

**Review date:** 2026-11-23  
**Status:** Source audit complete; user authorised implementation and first v3.11 fixes committed. Android device validation remains open. See [release notes](./RELEASE_V3_11.md).  
**Primary target:** Android Chrome, including Chrome home-screen shortcut / standalone installed mode. Secondary: desktop Chrome.  
**Companion:** [Action list](./ONDA_MOBILE_ACTION_LIST.md) · [Interactive concept page](./mobile-review.html) · [QA and migration matrix](./QA_MIGRATION_MATRIX.md)

> IMPORTANT: The architecture/baseline findings below describe the original **v3.10 source**. A first implementation batch has since shipped in **v3.11** and is documented in [RELEASE_V3_11.md](./RELEASE_V3_11.md). No device-level benchmark or Android compatibility success is claimed; source behaviour and actual phone behaviour remain different evidence levels.

## A. Baseline, scope and architectural map

Reviewed actual GitHub source files:

| Component | Repo path | Baseline detail |
|---|---|---|
| Entrypoint / visible interface | tools/Onda/index.html | 676 lines, ~38 KB, 220 unique static HTML IDs |
| Main player + library + rendering | tools/Onda/js/app-core.js | 6,195 lines, ~321 KB; declares ONDA_VERSION v3.10 |
| Android OS / headset integration | tools/Onda/js/media-session.js | ~241 lines; Media Session metadata and action handlers |
| MIDI playback adapter | tools/Onda/onda-midi.js | ~566 lines; Web Audio synthesis, own scheduler/timeline |
| Device cloud data sync | tools/Onda/js/cloud-sync.js | ~411 lines; remote JSON backup through Netlify |
| Cloud function | tools/Onda/netlify/functions/onda-sync.js | ~206 lines; shared-secret Netlify Blobs endpoint |
| Mobile responsiveness | tools/Onda/css/responsive.css | ~1,640+ lines; several overlapping mobile media-query sections |
| Drawer styling | tools/Onda/css/library.css | ~13.5 KB |
| Other styles | css/base.css, layout.css, controls.css, player.css, playlists-now-playing.css, modals-settings.css, streaming.css, visualizer-tools.css, cloud-sync.css, tokens.css | Retain current palette/identity |
| Deployment | tools/Onda/netlify.toml | Netlify publishes from this directory, functions at netlify/functions |
| Web app identity | tools/Onda/manifest.webmanifest and icons/* | Approved circular bronze-ring icon added; needs real Android test |

Important existing contract: local audio and stream audio use separate HTML Audio elements; local Audio is routed through AudioContext + gain + analyser, stream Audio generally bypasses the analyser to avoid CORS restrictions. MIDI has a separate Web Audio output and an audio-like adapter. Any visualiser, Media Session, resume, or background fix must accommodate all three rather than assuming one HTML audio engine.

The existing five workspace tabs (Add, History, Playlists, Current, Stream), upward-opening Library drawer and settings panel must remain recognisable. Keep user-approved icons, colours, visualiser presets and user-customised mobile icon labels. Video playback is deliberately low priority.

## B. Source-derived risk register

| Code area | Evidence / code pointer | Assessment | Required change/test |
|---|---|---|---|
| Infinite visualiser frames | app-core.js drawVisualizer ~5819–5863 immediately schedules requestAnimationFrame again; startVisualizer ~5130 called during startup | CONFIRMED SOURCE BEHAVIOUR; mobile battery implications unmeasured | Gate frames by visibility/playback/dirty state; preserve streaming fallback and playing appearance |
| Repeated catalogue writes | saveLocalUiStateCheckpoint ~277 calls saveActiveLibraryState; resize/orientation/visibility/pagehide handlers ~6170–6195 invoke checkpoint | CONFIRMED SOURCE BEHAVIOUR; possible write amplification | Separate UI-only checkpoints from catalogue changes; throttle resize writes |
| Imported File duplication | persistLocalAudioFilesToIndexedDb ~2536 loops File objects and puts into IndexedDB audioFiles | CONFIRMED SOURCE BEHAVIOUR | Introduce source resolver; retain legacy audio store during migration |
| Cache mistaken for missing | sourceStatus ~1085, updateSettingsHealthPanel ~3997 and checkLibraryFiles ~2865 inspect meta.blobFile rather than querying saved audio record | CONFIRMED SOURCE BEHAVIOUR; visible symptom needs reproduction | Accurate asynchronous storage availability index and clear status labels |
| Orphaned cache entries | deleteSelectedFromLibrary ~1419 removes catalogue rows but does not call idbDeleteAudioFile; deletion function exists ~2525 | CONFIRMED SOURCE BEHAVIOUR | Add safe orphan inventory and cleanup review, not automatic blanket deletion |
| Import redraw/saves | handleUploadedFiles ~3112–3202 renders twice, saves immediate/final/cache completion | CONFIRMED SOURCE BEHAVIOUR; performance impact unmeasured | Coalesce after preserving crash-safety and progress feedback |
| Full-list search | renderLibraryManager ~1602 regenerates/sorts entire list; input handler ~4272 calls immediately; syncAllTrackPlaylistMetadata ~1048 recalculates membership | CONFIRMED SOURCE BEHAVIOUR; user has not reported a problem | Defer major virtualisation; instrument scale thresholds |
| App position not persisted | saveLastPlayedTrack ~3657 stores ID and playlist; there is no dedicated persisted position checkpoint in the reviewed code | CONFIRMED SOURCE BEHAVIOUR | Add per-track resume-state versioned schema and checkpoint |
| Early History entry | loadTrack ~3211 calls rememberRecentTrack before restoration / actual play success | CONFIRMED SOURCE BEHAVIOUR; potential UX mismatch | Test and decide whether unsuccessful open counts as played |
| MIDI transport differs | onda-midi.js updatePlayingButton ~368 uses 𖦹/▷; core uses 🧿 | CONFIRMED SOURCE BEHAVIOUR | Do NOT redesign icons; verify whether MIDI's distinct behavior was intentional |
| MIDI uses adapter | onda-midi.js audioAdapter ~533 exposes currentTime, duration, play/pause but not native audio events | CONFIRMED SOURCE BEHAVIOUR | Resume and Media Session must explicitly bridge MIDI timeline events |
| Media Session timer | media-session.js ~233 calls bindCurrentAudio every second | CONFIRMED SOURCE BEHAVIOUR | Profile overhead; event-driven optimisation only if safe for Android lock screen |
| Mobile view controls missing | app-core.js references .mobile-db-icon-btn and #mobile-icon-help-list ~1481–1588; no matching buttons/help panel in current static index.html | STATIC RISK; some controls could be injected elsewhere at runtime | Reproduce mobile drawer first; inspect actual DOM, then restore/extend carefully |
| Search resets on drawer open | prepareLibrarySearchForDrawerOpen ~944–960 clears input and delayed timers | CONFIRMED SOURCE BEHAVIOUR | Test Android typing/autofill; preserve user's typed query by default if wanted |
| Small touch controls | responsive.css includes 34–42px controls, also 48px transport, overlapping mobile styles | STATIC RISK | Computed-style audit at 360/390/420 px, not wholesale CSS overwrite |
| Page close savings | app-core.js ~6181–6195 calls async flush on pagehide/beforeunload/visibility hidden | CONFIRMED SOURCE BEHAVIOUR; Android process kill may miss callbacks | Periodic checkpoints + idle incremental updates; don't rely on async unload |
| Cloud sync only metadata | cloud-sync.js backupPayload ~210 uses buildEverythingExport ~2078; backup note explicitly says no actual music | CONFIRMED SOURCE BEHAVIOUR | Keep content separate; no promises cloud will restore playable local media |
| Stream references vs playable URLs | addReferenceToLibrary ~4500 records provider references without playable stream; loadTrack ~3211 chooses local branch unless stream | STATIC RISK | Distinguish reference-only entries from playable remote URLs; open external provider when appropriate |
| 192-only PNG web icon | manifest.webmanifest declares 192 PNG + SVG wrapper with embedded 192 raster; no true 512 PNG | CONFIRMED SOURCE BEHAVIOUR | Obtain actual 512 PNG from approved full-resolution artwork; validate installability |
| No production automated suite identified | tools/Onda/package.json and repository layout need full CI decision | STATIC RISK | Minimal test fixtures for resolver/progress/storage operations before refactor |

## C. Recommended data model; preserve legacy IDs

Existing:
- LocalStorage keys such as ondaActiveLibraryV1, ondaActiveLibraryBackupV1, ondaLastGoodLibraryV1, ondaTrackHistoryV1, ondaLastPlayedTrackId and ondaLastPlayedPlaylistName.
- IndexedDB name **OndaMediaPlayerPersistentDB**, version **2**, stores **state** and **audioFiles**; state key **activeLibrary**. Audio records include trackId, File, savedAt, fileName, localPath, sizeBytes, lastModified and type.
- Library records in virtualLibrary use stable track IDs; relative path + file name + size + lastModified influence creation. Playlists/history/queue/cloud refer to these IDs.
- JSON exports omit actual File/Blob data; never represent Export Everything as full media backup.

Proposed additive model after explicit approval (not implemented):

- Track metadata retains existing ID and every existing field. New sourceKind is one of legacy-cached-file, file-handle, directory-handle-member, explicit-offline-copy, session-file, remote-direct-stream, remote-reference. Do not overwrite sourceType until existing import/export compatibility is mapped.
- Separate IndexedDB store **fileHandles** keyed by track ID or directory binding ID, containing serialisable handles and non-secret metadata. Suggested version 3 upgrade only after migration/rollback tests. Upgrade handler must **not delete** state or audioFiles.
- Separate store **mediaIndex** keyed by trackId to record source presence, offline-pinned status, bytes, lastAccess, lastVerified and migration state. Treat source status as a cache of verification results, not an absolute guarantee of permission.
- Separate small versioned **resumePositions** store (IndexedDB or bounded LocalStorage) with trackId, seconds, duration, updatedAt, completed; do not couple it to the high-frequency library autosave.
- Temporary session queue items are not permanent library records. Session File references are ephemeral unless upgraded to persistent Library / offline copy.
- Remote streaming metadata is not a local path, and reference-only providers are not presented as playable audio.

Source-resolver algorithm for a persistent track:
1. If current session holds a usable File/Blob, use it immediately.
2. If a trusted saved FileSystemFileHandle exists, check current permission and getFile() without duplicating bytes.
3. If permission is not granted, **only** call requestPermission from explicit user gesture; otherwise present Reconnect. Handle permission denied or moved/deleted file.
4. If a separately pinned offline copy or existing legacy audioFiles record exists, use the cache.
5. If remote direct stream, verify/load online; show transient network errors and allow retry.
6. If only metadata exists, offer file/folder relink; never erase the metadata.
7. When moving to another source, keep the same ID and verify the replacement plays before releasing any legacy cache.

Android browser specifics (external evidence): Chrome's File System Access API is available on Android from Chrome 132 (Google Chrome Developers, linked below), and serialisable file/directory handles may be stored in IndexedDB. **Capability and permission state must still be checked on the target device and after restarting Chrome.** Use existing input[type=file] + webkitdirectory path as fallback. Permission prompts require interaction. Never request write permission to read music. A web app cannot arbitrarily open any file just because it knows an Android filesystem path.

Priority correction: Because Onda is predominantly used on Android and the current cache makes music reliably replayable across sessions, don't flip local-import default to 'no cache' before verified handle persistence tests. If a selected Android file cannot be reliably reopened, automatic caching may remain the safer default (with clear space disclosure). This is a **conditional recommendation**, not an unapproved settings change.

## D. Task-level implementation plans

### ONDA-05 — Visualiser lifecycle (P0, ready after QA baseline)

Current owner: app-core.js startVisualizer (~5130), drawIdleOrStreamVisualizer (~5136), resizeCanvas (~5098), drawVisualizer (~5819), track loading (~3211), audio event wiring (~3050), app visibility hooks (~6189), reducedMotionQuery (~75).

1. Introduce visualizerFrameId, visualizerDirty, visualizerLastFrameAt and a single scheduler/stop function. Keep a one-shot static paused visual after change/resize, rather than running continuously.
2. While actively playing local audio and visualiser visible, use requestAnimationFrame; while paused or audio stopped, stop scheduling after one final render. When page hidden, stop canvas animation regardless of whether audio continues.
3. When activeAudio is streamAudio, current fallback visualiser is animated synthetic pulses; maintain that **while visible and playing**. When stream paused, render a static fallback.
4. On AudioContext analyser not ready, render one READY idle frame, not an infinite fallback loop. Resume animation on play/seek/track switch and returning to visible state.
5. Update selected visualiser stack/composer controls to invalidate/redraw even when idle. Reuse the single scheduler on profile settings changes. Honor prefers-reduced-motion where already used for mobile marquee without changing existing user preset choices by default.
6. Ensure overlapping calls to startVisualizer do not create extra loops. Never suspend audioCtx or pause activeAudio as a way of saving canvas CPU. The MIDI adapter must still play with visualiser idle.
7. Measure RAF callback counts during 30 seconds paused, playing, hidden, and visible; frame count while paused should fall to zero after a settled final frame. Compare actual battery/CPU only through real-device observations, not guessed percentages.

### ONDA-03 — Track / position restore (P3 optional)

Current owner: app-core.js saveLastPlayedTrack (~3657), restoreLastPlayedTrack (~3668), attachAudioEvents (~3050), loadTrack (~3211), handleTrackEnded (~3020), seek input events (~3750+), page lifecycle (~6181); midi adapter ~447–545.

1. **New user priority:** resume position P3 optional, only if low effort. Avoid delaying essential battery or storage work.
2. Store one bounded record per track keyed by stable ID, plus last active track ID. Suggested checkpoint interval 10–15 seconds while audio is playing, on pause, manual seek, track switch and document hidden. Avoid saving a huge catalogue JSON at each timeupdate (~4 times/sec).
3. Restore in strict order: catalogue finishes restoring; selected track is resolved/loaded; media loadedmetadata or MIDI parse completes; validate finite seconds/duration; seek to clamped position. Use per-load request token to avoid a late seek on the wrong track.
4. Start playback only on an explicit user gesture when reopening the app; restoring position must not attempt unsolicited autoplay.
5. At genuine end-of-track, set completed and clear/suppress old position; account for Repeat One / Repeat All and explicit restart. If a track is near the end, offer restart rule (e.g., within last 5s) but do not assume until tested.
6. For MIDI: adapter supports currentTime setter and song duration, but lacks HTML audio events. Add explicit callbacks at MIDI load/play/pause/seek/completion or use a shared playback-service hook so its position is persisted correctly.
7. For streams: seek only when media reports a finite duration and seekable range. Live streams should not receive resume position. Avoid writing NaN/Infinity.
8. QA: app killed after 30 seconds without pagehide; seek immediately then switch app; queue shuffle; pause/next/previous; file missing; repeated track IDs; MIDI and direct MP3 stream.

### ONDA-07 + ONDA-10 + ONDA-12 — Accurate storage, cleanup, and Android local files (P0/P1)

Files: app-core.js IndexedDB stores ~2450–2568, autosave ~2600–2640, import ~3112–3205, loadTrack ~3211–3305, sourceStatus ~1085, checkLibraryFiles ~2865, updateSettingsHealthPanel ~3997; index.html Storage Health and Library drawer; cloud-sync.js.

**Stage 1: read-only inventory first**
- For every media record in audioFiles, list trackId, actual File/Blob size, savedAt, catalogue connection, offline/temporary status if known, validity.
- Compute total **app audio bytes** by summing media sizes; separately show navigator.storage.estimate() origin-wide approximate usage/quota. Avoid equating the two; origin includes other browsers' features/caches/IndexedDB overhead.
- Statuses must distinguish verified in-session file, saved cache available, stored file-handle requiring permission, truly missing, stream URL, reference-only link and unverified. IndexedDB cursor/getAllKeys is asynchronous; avoid scanning every huge File into memory just to display stats. Use cursor or indexed metadata depending on performance.
- Show storage refresh, low space/quota warning, count/bytes by type; do not delete anything.

**Stage 2: source resolver and relink**
- Add a minimal module if practical: storage-resolver.js behind core, with stable APIs resolve(trackId), cache(track), relink(trackId, file/dirHandle), inspect(trackId).
- Feature detection: window.showOpenFilePicker/showDirectoryPicker; legacy input fallback remains. Directory selection must be explicit and match tracks by stable filename/path/size with conflicts displayed rather than falsely associating similarly named files.
- If permission is prompt/denied, explain access and offer choose again; never silently unselect or lose playlists. Multiple folders and repeated imports should not duplicate queue unexpectedly.
- Keep existing legacy IndexedDB cache accessible; verify both old and new paths can play after restart and while offline.
- Never use input path, phonePath or desktopPath alone as permission to reopen a real local file.

**Stage 3: opt-in cleanup**
- Default **no automatic deletion of legacy imported audio**. 48-hour rule applies only to new explicitly temporary Quick Play records, based on lastAccess, and is suppressed while track in use.
- Detect orphans after catalogue deletion; list exactly which IndexedDB media record would be removed, size, and whether it has fallback/direct access. Require manual review. Don't delete original Files or directories.
- Mark 'Save for offline' explicitly; protect it from all TTL and orphan cleanup unless user confirms unpin and delete.
- For migration, copy/source upgrade is considered successful only after a playback probe, and keep old file until a later user-confirmed cleanup. Backups: JSON saves metadata but *not* audio; say so before a destructive operation.
- Low-space writes: catch QuotaExceededError, preserve catalogue, show useful warning, offer smaller batch or fallback without falsely reporting cached success.

**Stage 4: performance**
- Collapse redundant import catalogue saves and renders only after measuring and verifying restart safety. Save state on meaningful library mutations; UI-only resizes shouldn't rewrite large playlists.
- Do not persist file handles in JSON/Netlify cloud; they are browser/device-bound structured clone values. Document on export screen.

### ONDA-02 — Extend, don't replace, mobile Library drawer (P1)

Current: index.html library-manager-drawer, bottom Library button, search, filter, selection + settings panels; app-core.js setMobileLibraryView (~1576), renderLibraryManager (~1602), toggleLibraryDrawer (~1856), mobile icon customisation (~1481), responsive.css mobile view selectors (~181–209; ~1383+).

Investigate and test before changing:
1. Inspect on Android whether Results/Recents/Playlists/Help mobile icon actions render at all. The current HTML file has no static .mobile-db-icon-btn or #mobile-icon-help-list despite JS selectors and CSS. There could be an inaccessible/dead feature; verify the live DOM rather than assuming.
2. Preserve the existing drawer view modes and user's icon mappings; **do not add Queue as a drawer view**.
3. **User decision:** Queue / Now Playing belongs on the main **Current** workspace (`#tab-library`), not the drawer. Reuse `#now-playing-playlist-panel`, `#now-playing-mode-pills`, `updateNowPlayingPlaylistPanel()` and related logic. Check how the presently hidden panel is made visible; make queue accessible on-screen without inventing duplicate navigation.
4. Add only compact shortcuts: import/Quick Play and Storage Health; keep full settings popup as owner of advanced storage controls.
5. Test tap semantics: the row body currently toggles selection; small ▶ plays. Consider 'tap row to play / long-press to select' **only with approval** because it changes expected behaviour.
6. Preserve drawer height, scroll position, keyboard/search focus, safe-area insets and input behaviour. Existing delayed search clearing (~950–960) may erase typed searches; verify.
7. Validate viewport widths 320, 360, 390, 420, 768px; landscape; large font; keyboard open; and custom desktop-mode override. Later CSS overrides in responsive.css can undo earlier tweaks, so test computed styles.

### ONDA-08 — Quick Play modes (P2)

Current local input is always handleUploadedFiles: populates virtualLibrary, playlist queue, autosaves and caches. Direct-stream preview (~4510) already demonstrates the idea of play without saving *for URLs*, but local files don't have an equivalent mode.

**Library track Play must be immediate:** do not open an add/import chooser for a saved entry. Resolve its File/cache/handle and play. If permission truly unavailable, offer one Reconnect and preserve the record. Present **Play once / Add to Queue / Add to Library** only optionally for newly selected **unsaved** files; ordinary import default unchanged. Session mode must not invoke permanent import, history registration, cloud save or IndexedDB media cache unless explicitly chosen. Queue mode's survival after restart depends on access; communicate that. Revoke object URLs when truly unused, but not during pause/resume. The MIME extension filter and MIDI detection should be shared, not copied.

### ONDA-13 — Android background playback and Media Session (P1)

Existing media-session.js already registers MediaMetadata; actions play/pause/previous/next/stop/seekBackward/seekForward/seekTo; updates status and position; and intentionally leaves music playing on visibility hidden. It polls at 1-second intervals.

1. Test phone Chrome tab and newly installed standalone home-screen mode; notifications and headphones; lock screen; screen off 5–10 minutes; returning to Onda. Do not claim success without an actual phone test.
2. Preserve active audio pipeline when visualiser is suspended. No changes to AudioContext routing unless required by tests. Check Chrome OS audio-focus handling with local vs remote streams.
3. Validate metadata title, artwork and seek position from all three audio engines; MIDI's adapter has no event emitter, so polling currently keeps parts of the state refreshed.
4. If polling is a measurable battery cost, replace with event-driven updates and a reduced-frequency fallback; avoid weakening lock screen support in pursuit of a minor theoretical saving.
5. Do not claim that a web page can stay alive indefinitely after Android force-stops its browser, loses process memory or revokes battery/background privileges.

### ONDA-11 / ONDA-04 — Startup + scale diagnostics (P2/P3)

Add performance.mark/measure around: DOM initialisation, localStorage candidate selection, IndexedDB restore, first Library render, first playable track, first audio play response, import parsing, sequential IndexedDB audio writes, search/filter response and visualiser frames. Provide a developer-only diagnostics toggle / export redacted JSON with durations, counts, error categories, device viewport, source type; do not log filenames, local paths, remote URLs, cloud secrets or private metadata.

Watch for:
- saveLocalUiStateCheckpoint on every resize/orientation, triggering full library save;
- IndexedDB reopen/close for each audio file write, sequential file caching;
- renderLibraryManager: filter/sort and append a DOM node per track, as well as calling renderHistoryTab;
- syncAllTrackPlaylistMetadata calling getTrackPlaylistNames for each entry and scanning playlists;
- MutationObserver in installMobileMarqueeObserver reacting to redraws.
  
Don't add virtualization or a worker until a real mobile library demonstrates noticeable lag. Suggested staged goals: under ~150 ms feedback for small search (goal, not measurement); measure 100/1,000/5,000 track synthetic catalogues on Android/desktop in dev/test context, then choose debounce/windowing/indexing only when needed.

### ONDA-09 — Future GitHub Pages online playable library (P3)

Current cloud-sync.js and Netlify Blobs endpoint synchronize **device-profile JSON backups**, not a shared accessible playable media catalogue. The backend supports a limited shared-key system (including stream-library and metadata-overlay), but it is guarded with one ONDA_SYNC_SECRET. Don't assume this is a suitable public media hosting/authentication solution.

Use the user's selected GitHub Pages public static media host: one JSON catalogue and direct audio file URLs, with optional future search/pagination and lazy artwork. No second host or backend is required. When online, fetch and show source status; on offline/error, local audio continues independently. navigator.onLine can be a hint, not a guarantee remote host reachable; handle actual HTTP/media failures. If offline cache is later requested, it requires explicit byte count and source permission/rights.

Differentiate a true direct audio file/stream that Onda can play in streamAudio from a YouTube/Spotify/Apple Music external/embed reference. Do not attempt unsupported downloads or claim those providers are built-in music files. Hosting/storage/provider choice remains open.

### ONDA-14 — Mobile interaction/accessibility (P2)

Audit button accessible labels and their pressed states, especially emoji-only buttons; 44×44 CSS pixels as comfortable default target (design goal), focus rings, screen reader live regions for alerts, input zoom, landscape, reduced motion, safe-area insets and form keyboard covering settings/drawer. Existing CSS uses some 34–42px elements but computed sizes may be larger; measure before changing. Avoid making controls bigger by adding new fixed bottom bars that cover Library.

### ONDA-15 — App icon/manifest (implemented, awaiting phone verification)

The approved circular bronze/charcoal/cyan logo was added at icons/onda-icon-192.png plus an SVG wrapper embedding the same image; manifest.webmanifest, head metadata and current app name exist in repo. No square backdrop has been added to artwork. **Remaining:** verify Netlify deployment, actual Chrome shortcut and installed standalone launch. A genuinely high-quality 512×512 PNG is recommended for best Android icon/install compatibility; the current SVG wrapper is technically scalable in canvas dimensions but only embeds a 192px raster, which does not improve its optical resolution. Reuse original approved full-res generation. Do not substitute another icon or add a square maskable background without user approval. Browser may require removing and readding the shortcut to refresh.

### ONDA-01 / ONDA-06 — deferred / closed

Video is low-use and deferred. Current intake accepts video MIME/extensions but core primarily plays with HTML Audio, not a video renderer; defer video UI/rendering work. Existing playback symbols are user-approved and must not be redesigned; only functional accessibility labels may be refined. Note separately that MIDI currently overrides its button display: verify rather than change arbitrarily.

## E. Sequencing and code touch map

**Phase 0: baseline and backup** — record app version/source hashes, export Everything JSON, explain JSON does not contain music; verify representative old cached files. No destructive cleanup. Prepare test seed catalogue without real private music.

**Phase 1: low-risk playback foundation** — fix visualiser idle scheduler and guarantee one-tap Library playback with automatic cache/source resolution; preserve Media Session/MIDI and icons. Resume position is optional P3.

**Phase 2: read-only storage instrumentation** — add accurate IndexedDB/StorageManager measurements and track availability statuses into existing Storage Health. Preserve schema v2; no file deletion.

**Phase 3: Android source-resolver proof** — prototype handle save/reopen on user's Android Chrome; if viable, versioned IndexedDB expansion plus safe relink. Keep legacy audioFiles intact and fallback. Add explicit offline mode.

**Phase 4: reviewed UI** — keep Now Playing / Queue on the main Current screen, and enhance the separate Library drawer with approved browsing/Quick Play/Storage shortcuts. Reuse existing Current playlist panel and controls; update index.html + responsive.css/library.css only as needed after device tests.

**Phase 5: later work** — offline TTL cleanup after migration and user approval; background playback refinements, performance/large library optimisation, remote media catalogue, eventually video.

### Change boundaries

- Do NOT make a giant simultaneous refactor of all 6,195 core lines.
- No renaming/deleting storage keys/stores without read compatibility.
- No replacement of current approved icon, playback symbols or visualiser presets.
- No new service worker that intercepts media or Onda JSON without specific assessment of caching, update invalidation and storage pressure.
- No network transfer of local filenames, tracks or file bytes beyond current user-invoked cloud JSON sync.
- Never upload the ONDA_SYNC_SECRET to the repo or put it in diagnostics.
- Do not modify the working player until user approves implementation batch.

## F. Source inspection facts vs unresolved validation

CONFIRMED: static code paths above, exact names of current data keys and major functions; current 192 PNG/manifest configuration; browser APIs per linked documentation.

NOT VERIFIED: how Onda renders on user's phone, installed-mode icon update, actual permission persistence, actual battery impact of RAF, background playback after Android process termination, whether missing mobile icons visibly impede navigation, real IndexedDB store sizes, number and type of imported user tracks, and Netlify function runtime status.

### External technical references (verified 2026-11-23)

- Chrome for Developers: File System Access API — https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- Chrome Q1 2025: File System Access now on Android 132+ — https://developer.chrome.com/blog/new-in-chrome-video-q1-2025
- MDN FileSystemHandle requestPermission — https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission
- MDN StorageManager estimate — https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate
- MDN storage quota and eviction — https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Chrome Page Lifecycle advice — https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- MDN Media Session API — https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
- web.dev Media Session controls — https://web.dev/articles/media-session
- MDN Navigator onLine limitations — https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
- web.dev icon/install guidance — https://web.dev/articles/add-manifest
- MDN App icon definitions — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons

## G. Investigation conclusion

The immediate implementation is specified for visualiser lifecycle and reliable library playback; resume position is P3 and does not block the critical path. Storage architecture is also well-defined conceptually, but its choice of *default local-file cache versus remembered direct file handle* needs one real Android handle-persistence experiment and a measured cache inventory. Drawer enhancements and online library hosting remain product decisions; they should not be coded speculatively.

This technical file is the source-of-truth implementation blueprint. [QA_MIGRATION_MATRIX.md](./QA_MIGRATION_MATRIX.md) is the test/rollback companion; [ONDA_MOBILE_ACTION_LIST.md](./ONDA_MOBILE_ACTION_LIST.md) is the short decision register.

## H. Confirmed product decision: Current screen owns Queue / Now Playing (2026-11-23)

The user rejected the proposed Queue drawer tab. The correct architecture is: **Current (`#tab-library`) = Now Playing, queue visibility and playback order; Library drawer = browse/search/recents/playlists/import/add-to-queue actions only.** Do not put Queue in the drawer as another mobile view, and do not require reopening the drawer just to see what's playing next.

The existing `index.html` already provides `#tab-btn-library` labelled Current, `#metadata-display-card`, `#now-playing-playlist-panel` (initially `hidden`) and `#now-playing-mode-pills` (initially `u-hidden`). The code has `updateNowPlayingPlaylistPanel()`, `setNowPlayingVisibilityToggle()`, and `setNowPlayingMode()`. Before coding, trace exactly what toggles their visibility and which queue type is shown: active playlist, playback queue, or both. Avoid conflating persistent playlists with the ephemeral playback queue.

Implementation acceptance: Current screen presents now-playing context and upcoming playback order with manageable tap targets; transport remains visible; no Queue tab within drawer; existing mobile drawer icon customisation remains intact; adding a track from the Library drawer updates Current without navigating away unless the user chooses to switch. The companion HTML now demonstrates this division.

## I. 2026-11-23 user decisions / exact implementation rules

**Saved Library:** Clicking Play on an existing stored entry should resolve from in-session File, legacy IndexedDB cache or authorised stored file handle and start playback. Do not show Import/Add/Quick Play again, do not create duplicate entries, do not cache duplicate bytes. If the original and cache genuinely are inaccessible, provide one Reconnect action without deleting metadata or playlist membership. Quick Play is optional only for files the user has *not* yet added.

**Resume:** P3 optional low effort only. Avoid introducing new modal prompts; code only if safe and inexpensive after primary performance fixes.

**Online source:** GitHub Pages public media + static JSON catalogue. Example JSON: `{"version":1,"tracks":[{"id":"example-1","title":"Example","path":"audio/example.mp3"}]}`. Resolve media paths relative to verified Pages base, keep IDs distinct from device-local tracks, don't use GitHub blob-view URLs as streams. Onda on Netlify fetches Pages catalogue online only; local library still works offline. Test cross-origin JSON fetch/CORS and streaming playback and seek from mobile, with existing streamAudio Web Audio analyser limitations. Pages content public even for private-source repos where Pages supported; only distribute permitted audio. GitHub Pages published site maximum 1 GB, bandwidth soft 100 GB/month, regular Git file maximum 100 MiB; Git LFS unsupported for Pages. No alternative hosting service recommended absent actual limitations.

References: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits ; https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github ; https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage

## J. Post-investigation implementation record — v3.11

**Production files changed:** `js/app-core.js`, `onda-midi.js`, `index.html`. Commits and rollback details are tracked in [RELEASE_V3_11.md](./RELEASE_V3_11.md). User approved starting with playback/visualiser/storage changes on 2026-11-23.

**Implemented:** `startVisualizer()` now coalesces RAF work and only continues during visible playback; `drawVisualizer()` no longer unconditionally self-schedules. MIDI `updatePlayingButton()` asks for refresh; `visibilitychange` cancels frames without pausing music. Last-track restore avoids duplicate early play(); `playAudio()` starts browser media playback while the original tap activation may still be valid. `refreshAudioCacheIndex()` reads IndexedDB media records in read-only mode and identifies actual File/Blob audio, allowing `sourceStatus()`, Missing filter, Check Files and Storage Health to distinguish cached vs genuinely absent. Storage Health also shows saved media bytes and whole-site quota usage estimate without deleting anything. Missing cached media may be reconnected via a separate file picker to the same stable ID, avoiding reimport and preserving metadata.

**What remains:** Real Android Chrome and standalone shortcut playback/lock-screen testing; persistent file handle proof before any v3 storage/schema migration; Current queue mobile layout; optional new-file Quick Play; optional position resume; GitHub Pages hosted online media. The original static findings for v3.10 are kept as evidence of why these fixes were made, not as descriptions of current v3.11 defects.

**Test evidence:** 21 V8 static/isolated checks passed (syntax, original icon/version, cache status cases, visualiser RAF scheduling states). These are not a browser integration test and are not a battery benchmark. See [Android QA matrix](./QA_MIGRATION_MATRIX.md).
