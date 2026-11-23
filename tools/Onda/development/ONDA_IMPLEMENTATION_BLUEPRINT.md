# ONDA — Mobile-first implementation blueprint and complete static source investigation

**Revision:** 1.0 • **Date:** 2026-11-23 • **Branch inspected:** `main`  
**Project:** `cinaedvsstudios/Organon/tools/Onda` • **Player code version:** `v3.10`  
**Status:** Source research and implementation planning only. **No app behaviour has been changed by this blueprint.**  
**Navigation:** [Action register](./ONDA_MOBILE_ACTION_LIST.md) · [Interactive mobile concepts](./mobile-review.html)

> **Evidence legend:** **CONFIRMED (source)** means a condition is visible in the checked-in code; **LIKELY RISK** means the code has a plausible issue but the impact must be measured; **EXTERNAL DOCUMENTATION** refers to browser specifications/references; **DEVICE TEST NEEDED** means functionality cannot be established without using the actual phone and deployed app. No Chrome/Android runtime or Netlify deployment has been tested in this audit.

## 1. Product contract and engineering guardrails

Onda is primarily used on **Android via a Chrome home-screen shortcut**; desktop remains supported. The user prefers the existing charcoal/stone/bronze UI, the upward Library drawer and the original playback glyphs, particularly 🧿. **Do not replace the app's visual identity, the drawer, or the playback icons.** Video is a low priority; an online playable media library is a future feature and must be optional when connected. Small-library search slowness is **not a user-reproduced defect**.

No migration may silently erase:
- actual local phone/computer media files;
- Onda's existing IndexedDB audio blobs;
- playlists, stable track IDs, library metadata, artwork, tags, lyrics, history, current queue, visualiser presets, mobile icons or cloud-sync settings;
- a user's manually marked offline media.

**Non-goals:** no Android native rewrite, no major UI redesign, no music downloading from embed-only streaming platforms, no service worker that caches audio automatically, no blanket deletion of anything older than 48 hours.

## 2. Source and runtime architecture map

| Component | Source (line anchors for v3.10) | Responsibility / notes |
|---|---|---|
| DOM and integration | `index.html` (~676 lines) | Transport, mobile/desktop tabs, Library drawer, Settings, modal and streaming controls |
| Monolithic player | `js/app-core.js` (~6195 lines) | Local/stream audio, library, IDB, playlists, UI, visualiser, storage backups, media intake |
| Background controls | `js/media-session.js` (~241 lines) | Android lock-screen Media Session actions, metadata, 1-second refresh polling |
| MIDI engine | `onda-midi.js` (~566 lines) | Synthesised MIDI playback using an adapter with `currentTime`, `play`, `pause`, `seek`; not an ordinary HTMLAudioElement |
| Cloud sync client | `js/cloud-sync.js` (~411 lines) | Device profile JSON saves/loads through Netlify function; **not media-byte sync** |
| Cloud sync backend | `netlify/functions/onda-sync.js` | Shared-secret protected Netlify Blobs JSON backups, shared JSON keys and device profiles |
| Visual identity | `manifest.webmanifest`, `icons/*` | Approved circular Onda shortcut icon and standalone launch metadata |
| CSS | `css/responsive.css` (~1653 lines), `css/library.css`, `css/player.css`, etc. | 768px mobile breakpoint and multiple forced mobile/desktop overrides |
| Preview | `development/mobile-review.html` | Concept-only standalone review UI; **never accesses actual music** |

Onda uses two hidden HTML `Audio` objects (`app-core.js:3–17`): one local file player routed through a Web Audio analyser, and one stream player kept separate for CORS compatibility. MIDI uses `OndaMidi.audio` as a special adapter. Local media files are saved to IndexedDB database `OndaMediaPlayerPersistentDB` version **2**, with `state` and `audioFiles` stores (`app-core.js:51–56,2452–2569`). Library metadata/autosaves are held redundantly in three localStorage keys and mirrored to IndexedDB, plus JSON/cloud exports that deliberately **exclude audio bytes**.

### Dependency graph

```text
Existing library + metadata backups ────────┐
Existing audioFiles IDB (legacy copies) ────┤
Android file pickers / handle permissions ──┼─> source resolver ──> localAudio / MIDI
Remote direct audio URLs ────────────────────┘                      │
                                                                     ├─> shared playback checkpoints
                                                                     ├─> Media Session state
                                                                     └─> visualiser lifecycle
UI state + queue / search index ───────────────> preserved drawer ───┘
Cloud JSON sync ≠ remote playable media library
```

## 3. Newly confirmed code findings that revise the original backlog

These are actionable source-level findings, not speculative mobile measurements.

| Finding | Evidence | User-facing consequence to verify | Recommended ticket |
|---|---|---|---|
| Last-played ID is barely written | `saveLastPlayedTrack()` defined at `app-core.js:3657`, called in code at **1963 only** (playlist creation). Normal `switchTrack()/loadTrack()` at 3205/3211 do not call it. | “Resume last track” may restore a stale item or none at all. | ONDA-03, **higher confidence/priority** |
| Current resume logic tries to play immediately | `restoreLastPlayedTrack()` calls `addTrackToQueueFromLibrary(id,true)` at 3668–3672; this routes to `switchTrack()/loadTrack()/playAudio()`. | Android browser autoplay restrictions or asynchronous recovery can cause failures. | ONDA-03 |
| Deleted listings leave audio behind | `deleteSelectedFromLibrary()` at 1419–1442 deletes catalogue entries but never calls `idbDeleteAudioFile()`, defined at 2525 and not otherwise used. | Orphaned cached media may retain storage space indefinitely. | ONDA-10 / ONDA-16 |
| Bulk mutations omit explicit save | `deleteSelectedFromLibrary()` at 1419; `applyBulkPlaylistAdd()` at 1346; `createPlaylistForSelected()` at 1368; `applyBulkAttributes()` at 1399 contain no `saveActiveLibraryState()` calls. | Edits may depend on a later UI checkpoint to persist; force-close or kill can lose them. | **ONDA-16** |
| False ‘needs relink’ possible after restore | `sourceStatus()` at 1085 and Storage Health at 3997 use `meta.blobFile`, while restored catalogue drops blobs at 2673 and cache hydration is deferred at 2555. `checkLibraryFiles()` at 2865 also only checks in-memory `blobFile`. | A playable cached track may look missing before first load. | ONDA-07 / ONDA-10 / ONDA-12 |
| 48-hour cleanup would currently be unsafe | IDB audio record has `savedAt` but no explicit temporary/offline classification or reliably updated `lastAccessedAt` (`idbSetAudioFile()` at 2492). | Old data cannot safely be classified as temporary on age alone. | ONDA-10 |
| Mobile drawer views have code but missing matching controls | `setMobileLibraryView()` at 1576 expects `.mobile-db-icon-btn`; `mobileIconHelpList` at 161 targets `#mobile-icon-help-list`. **Current `index.html` has neither selector**; `#db-recent-list` and `#db-playlist-list` are present but hidden and the render path doesn't populate playlists there. | Some intended mobile drawer view/icon customization controls appear not to be exposed in the current markup. Verify on-device. | ONDA-02 |
| Drawer view resets upon opening on mobile | `toggleLibraryDrawer()` at 1856–1875 always chooses `results` in mobile mode, regardless of saved mobile view, and runs `prepareLibrarySearchForDrawerOpen()`, which clears search and schedules extra clears (951–961). | Drawer may not remember user's last view or query. | ONDA-02 |
| Full render on every search input | `dbLibrarySearch` input listener at 4272–4275 calls `renderLibraryManager()`; renderer at 1602 rebuilds every visible row and history. | Potential scale issue with very large catalogues; not yet reported. | ONDA-04 |
| Visualiser RAF never idles | `drawVisualizer()` line 5820 calls itself via `requestAnimationFrame()` unconditionally; started at 5862. | Avoidable work while paused/idle/hidden. Actual battery effect unmeasured. | ONDA-05 |
| Streaming preview lacks normal catalogue context | `previewDirectStreamUrl()` at 4510 creates `currentFile.name='__preview_stream__'`, while `updateMetadataUI()` at 3549 returns if no matching `virtualLibrary` record. | Preview may play but track metadata/UI remains stale. | ONDA-08 / ONDA-17 |
| MIDI uses a distinct adapter, with its own icons | `onda-midi.js:368–374` writes spinner/triangle symbols; `audioAdapter` (~530) has no `addEventListener` and needs special handling for checkpoint/media events. | Avoid breaking MIDI when adding shared resume or visualiser changes; retain user's approved principal symbols. | ONDA-13 / ONDA-17 |
| No true 512 PNG yet | Manifest has a 192 PNG plus SVG **embedding a 192 PNG**; not a genuine vector source or dedicated 512 PNG. | Shortcut may work, but ideal Android install-quality and maskable behavior still need device verification. | ONDA-15 |

**Severity interpretation:** The absence of save calls after bulk mutation is a proven code path, but whether data actually disappears after a given action depends on later incidental saves; it must be reproduced before describing it as a live defect.

## 4. Implementation ticket ONDA-03 — Last track and position checkpoint

**User decision:** Remember playback position. **Priority:** P1, first implementation batch.  
**Relevant code:** `app-core.js:165–168,1052–1080,3050–3089,3205–3312,3657–3714,3806–3814`; `onda-midi.js:341–368,447–511`; `media-session.js:89–118`.

**Exact changes:**
1. Introduce versioned, minimal `ondaPlaybackCheckpointV1` stored locally (not a full library autosave every few seconds), e.g. `{version:1,trackId,positionSeconds,durationSeconds,sourceType,updatedAt,completed,playlistName}`. Never store media binary or credentials in this record.
2. Call a consolidated `rememberTrackSelection(trackId)` when a playable source actually becomes active in `loadTrack()`; not only when creating playlists. Before switching sources, checkpoint the **previous** active track, then update track ID with initial position. Guard async loads with the existing `trackLoadRequestId`.
3. Add one position checkpoint every ~10 seconds **while playing and seekable**; also on pause, manual seek, track change, hidden/pagehide. Keep frequent writes small; don't trigger `saveLocalUiStateCheckpoint()` or serialise the full library at each `timeupdate`. Unload handlers are not a reliable sole checkpoint on Android.
4. On page load, restore the **selection** without automatically calling `playAudio()`. Refactor `restoreLastPlayedTrack()` to allow `autoPlay:false`; when the user presses Play, open the selected source, await readiness (`loadedmetadata` for HTML audio, `OndaMidi.load` for MIDI), then clamp and seek once. Don't seek before the browser knows the duration; don't resume if the track changed during load.
5. Mark track completion on normal `ended`; choose a safe restart threshold: if position is within ~3 seconds of known duration or flagged completed, use 0 next time. Leave live/unseekable/infinite-duration streams out of numeric resume; retain source selection only.
6. Respect existing playlist/queue/repeat/shuffle progression. On Next/Previous, reset the *new* track to its expected position; consider storing a small per-track progress map only if the user wants multiple simultaneous long recordings. Don't multiply endless localStorage entries for single music tracks.
7. MIDI has `audioAdapter.currentTime` getter/setter and can seek, but it has no HTML media events. Call checkpoint/restore integration from OndaMidi lifecycle and/or a shared active-source abstraction rather than `addEventListener()` blindly.
8. Existing `saveLastPlayedTrack()` can be retained as compatibility helper; migrate from old `ondaLastPlayedTrackId` if no v1 checkpoint exists.

**Acceptance tests:**
- Play MP3 45 seconds → background/lock → close → re-open → shows correct track → manual Play resumes near 45 seconds.
- Play 45-minute audio → seek to 18:24 → force close app → next launch resumes within last saved checkpoint and never from stale track.
- Reach end of track → reopen → begins at 0, not last second.
- Rapidly select Track A then B while source A IDB hydration is pending → never seek B using A's saved time.
- MIDI position restore uses adapter; direct live streams skip numeric seeking.
- Android browser tab and standalone shortcut, plus desktop, behave consistently.

**Risk/rollback:** This feature must not overwrite catalogue on failure. Feature-gate under setting if browser-specific; removing new checkpoint key restores old selection semantics, leaves playlist data untouched. User decision still open: all audio vs long recordings; **safe initial default proposal is checkpoint last active track regardless of duration**, except live/unseekable streams.

## 5. ONDA-05 — Visualiser scheduler, battery and reduced-motion

**User decision:** Fix continuous animation; keep the visible visualiser and presets unchanged. **Priority:** P0.  
**Relevant code:** `app-core.js:19–24,198–228,5130–5160,5819–5863,6061–6105`; `js/media-session.js:222–235`; `css/visualizer-tools.css`.

**Precise approach:**
1. Replace unconditional `requestAnimationFrame(drawVisualizer)` recursion with a single RAF scheduler retaining `rafId`, `running`, `dirty`, and `lastRenderAt`. Only one outstanding RAF at a time.
2. During foreground playback, run at browser refresh rate initially; add optional 30fps cap or reduced-effects preference only if actual performance measurements warrant it. Do not silently change user's preset design.
3. When paused/stopped, render one final static `PAUSED/READY` state and stop requesting frames. Repaint on canvas resize, preset change, visibility return, stream/source switch, and relevant visualiser settings adjustments.
4. In hidden pages, **stop visual frame production but do not pause localAudio, streamAudio, MIDI, or AudioContext**. Browser itself throttles RAF, but explicit cancellation avoids needlessly waking up. On return, redraw once and resume animation only if playback remains active.
5. Preserve the streaming fallback animation while an audio URL is playing in the foreground. Preserve multiple composition layers, blending, matrices, randomized effects, color controls, symmetry and visualiser presets. Ensure no duplicate loops after repeated resume/pause.
6. `installMobileMarqueeObserver()` has its own event-driven RAF at 6061–6105: **do not confuse this with the continuous visualiser loop**. Instrument it separately if monitoring shows overhead.

**Metrics (proposed, do not claim tested):** count visual frames/second, draw duration (median/p95), hidden/paused frame count, page wakeups where available, time until visualiser resumes; use Android Chrome Performance tools or controlled tracing if available. Do **not** collect media filenames or audio data in analytics.

**Acceptance:** paused and hidden => no perpetual full-speed RAF; active track appearance unchanged; lock screen continues audio; resume is smooth; no secondary loop; respects reduced-motion preference when enabled if the user chooses such behaviour.

## 6. ONDA-07 / ONDA-10 / ONDA-12 — Source abstraction, Android file handles, storage health

**User decision:** Minimise unnecessary copies of phone music while retaining reliable playback. **Priority:** P0–P1, highest data-safety risk.  
**Current code:** `app-core.js:2452–2574,2602–2643,2865–2890,3091–3203,3211–3312,3997–4007`; `index.html:91–96,334–358,375–400`.

### 6.1 Existing behaviour (source confirmed)

- `<input type=file multiple>` and `<input type=file webkitdirectory>` provide `File` objects. Import creates stable IDs from `file.webkitRelativePath || file.name`, size, modified timestamp; adds to permanent library and queue; saves blobs into IDB **sequentially**, one transaction per file.
- Once catalogue metadata is restored from JSON, in-memory `blobFile` is deleted. `hydrateLocalAudioBlob` loads it lazily from `audioFiles` upon playback. A missing in-memory blob is not proof that the cache is missing.
- Current `sourceStatus`, Library Check report, and Storage Health can therefore overstate 'needs relink'. `idbDeleteAudioFile` exists but is not wired to catalogue deletion; orphan files can remain.
- `Export Everything` JSON does **not** contain media files, as declared in `buildEverythingExport()` at 2078–2102. Netlify JSON device sync also excludes media bytes; it cannot replace a device file backup.
- Under current IDB v2, `audioFiles` records have `trackId`, `file`, `savedAt`, `fileName`, `localPath`, `sizeBytes`, `lastModified`, `type`. No `lastAccessedAt` or explicit temporary/offline role.

### 6.2 Candidate target schema (additive, versioned)

Prefer an **additive IDB v3 upgrade** with a new `mediaSources` store, and optional `storageJournal`. Keep legacy `audioFiles` untouched until verified. Example shape, **not committed implementation**:

```js
// Per stable existing trackId, in a new IndexedDB object store:
{
  trackId: "trk_...",
  preferredSource: "file-handle",   // "legacy-idb" | "session-file" | "offline-idb" | "stream"
  handle: null,                    // FileSystemFileHandle when structured cloning works
  provider: "local",
  fileName: "example.mp3",
  relativePath: "Music/example.mp3",
  expectedSize: 1234567,
  expectedLastModified: 1730000000000,
  permissionState: "unknown",       // status is *recomputed*; not a durable security grant
  offlinePinned: false,
  temporary: false,
  createdAt: "...",
  lastAccessedAt: "...",
  lastVerifiedAt: "..."
}
```

**Do not** serialise handles into JSON backups or cloud sync. Keep library metadata and source record separate. `getTrackId()`/existing IDs must remain unchanged; never re-key playlists or history just because source technology changes.

### 6.3 Source-resolution state machine (recommended)

```text
Resolve trackId
  ├─ remote stream -> online? attempt URL playback : show offline
  ├─ session File still alive -> play from File / object URL
  ├─ stored FileSystemFileHandle?
  │   ├─ permission granted and getFile succeeds -> play from fresh File
  │   ├─ permission prompt needed -> request only after a user gesture
  │   └─ denied/missing/changed -> fallback
  ├─ legacy cached blob available? -> play existing IDB blob
  ├─ explicitly saved offline blob? -> play protected offline blob
  └─ no source -> show Reconnect file/folder; DO NOT DELETE metadata
```

An Android file picker is only one source of authority: the browser may revoke permission after a reload or reinstall; a remembered handle is not an unconditional permanent pass. Use `queryPermission({mode:'read'})` and where appropriate `requestPermission({mode:'read'})` **on a tap**. File System Access API is supported on Chrome Android (Chrome 132+ according to Chrome Developers), but test `showOpenFilePicker`, `showDirectoryPicker`, enumeration and persistence on the user's device. Keep `webkitdirectory` / ordinary input fallbacks and single-file relink.

**Never copy bytes into a new store simply for metadata.** Keep a live Blob/File reference for a current session and release object URLs when no longer needed. Where Android direct reopening is fragile, offer an explicitly explained offline/cache fallback. When a media file changes in place, re-read from the handle and verify type/size/modified time before claiming it is still the same track.

### 6.4 Accurate and non-destructive storage inventory

- Add read-only `getCachedMediaInventory()`: cursor over `audioFiles`, count records, sum `sizeBytes` with `file.size` fallback, compare keys against **all** catalogue tracks + current queue + recent history + explicit offline pins; flag potential orphans but don't delete.
- Show `navigator.storage.estimate()` separately as **whole-origin estimate** (including things besides Onda media); use `navigator.storage.persisted()` to report whether storage is persistent; `navigator.storage.persist()` only in a clearly user-initiated flow. These APIs do not guarantee no eviction and the estimates can be rounded.
- Define statuses as `Ready in session`, `Saved in browser`, `File permission needed`, `Original moved/missing`, `Available offline`, `Remote / online only`, `Reference only` based on actual resolution, not just `meta.blobFile`.
- Inventory reads can be chunked/off-main-thread if enormous, but do not eagerly hydrate all blobs into JS memory. IDB can expose key and metadata via cursors. Avoid expensive full enumeration at every startup.
- Cache cleanup UI: show proposed deletions **by track ID and source role**, size, and protection flag; require confirmation; perform deletes only for unreferenced **temporary** data created under the new schema, after inventory validation. Legacy library caches always protected by default. Consider a soft-recovery period before irreversible cleanup.

### 6.5 48-hour rule—precise definition

**Do not apply 48 hours to every cached media file**. The optional timer applies only to explicitly temporary Quick Play artifacts, based on `lastAccessedAt`, not `savedAt`. Eligibility requires `temporary===true && offlinePinned!==true && !isCurrentlyPlaying && !referencedBySavedLibrary`. Never delete a user's source file using a File System Access write/delete operation. Ignore timestamps on legacy rows without a role flag. User can manually review or disable cleanup.

### 6.6 Data migration and rollback sequence

1. Gather a user-owned JSON export and record baseline counts of catalogue, playlists, history, existing `audioFiles` IDs and bytes.
2. Release a read-only storage-health inventory first; run on real Android and desktop, compare results with known media count.
3. Add IDB v3 store in `onupgradeneeded` without deleting or rewriting `audioFiles`. Keep existing backups/key names readable.
4. Introduce `resolvePlayableSource(trackId)` behind feature flag and exercise the legacy fallback while the default remains unchanged.
5. Add handle picker and permission checks; offer feature to selected testers on Android; keep old cached blob **until handle can reopen after a full app restart**.
6. Only after several verified sessions may the user choose to free duplicate copies; preflight with a backup reminder and reversible selection if practical.
7. Explicitly differentiate cache removal from catalogue deletion and original-file deletion in the UI. No automatic orphan deletion until IDB and library state are consistent.
8. On failure, revert source resolver selection to legacy IDB, not the user's data.

**Acceptance:** Two app launches with retained playback; reconnect after permission loss; no false missing labels; live phone files never deleted; cleanup result matches preview; low-quota errors don't destroy metadata or existing media; cloud export/import remains compatible.

## 7. ONDA-02 — Expand the existing Library drawer, not replace it

**Current anchors:** `index.html:278–358`; `app-core.js:1219–1254,1481–1600,1602–1659,1856–1876,4160–4204,4272–4335`; `css/responsive.css:117–211,1384–1520`.

**Source inspection correction:** Existing *JavaScript* defines mobile views `results,recents,playlists,help` and icon definitions, but the current checked-in HTML does **not** declare `.mobile-db-icon-btn` or the `#mobile-icon-help-list` target. The standalone mock-up intentionally illustrates a proposal, not a literal copy of the current UI.

**Recommended minimum viable change:**
1. Keep `#library-manager-drawer`, its upward layout, its current Select and Settings actions and the same icon theme.
2. Provide an actual compact mobile view strip (Results, Recents, Playlists, Queue, Help) wired to `setMobileLibraryView()`. Expose accessible labels despite user-customizable visual glyphs; preserve existing saved glyphs.
3. Wire recents and playlists to meaningful existing data, **not empty hidden sections**. New Queue view should display `playlistTracks` and highlight `currentTrackIndex`, with Play/Remove/Reorder if appropriate, using safe event delegation.
4. Put entry points for Quick Play and Storage Health in the drawer, but **do not duplicate entire Settings popup**.
5. Consider removing the unconditional reset to Results on drawer reopen; restore last view or choose predictable user-defined default. Search should not be cleared while user is typing.
6. On tap: differentiate Play/Info/Select as the user expects. Right now tapping a result-row body toggles selection (`4279–4312`) while only its small Play button plays. Inspect touch targets and user preference before changing semantics.
7. Keep current bottom bar and top playback symbols. Avoid adding a second full-width permanent nav bar.

**Open user decision:** Queue as drawer view vs integrated into Current. Suggested default: separate Queue view *within the same drawer*, not a standalone page.

**Acceptance:** All five drawer destinations truly render; saved icons remain customizable; tap controls are finger-sized and keyboard/screen-reader accessible; no scroll capture when drawer is opening; does not reset active song or change audio when navigating; desktop can still resize drawer.

## 8. ONDA-08 — Quick Play / import modes

**Current anchors:** `app-core.js:3091–3203,3211–3312,4365–4428,4510–4517`.

Current media picker directly calls `handleUploadedFiles(files)`, which always updates permanent catalogue, queue, autosave and IDB cache. It can auto-start playback when the queue was empty. That behaviour is useful for permanent imports but not for one-off listening.

**Recommended source-agnostic interface:**
```js
ingestFiles(fileList, { mode: "play-once" | "queue" | "library" })
```
- `play-once`: use session-only record (not library ID); route directly into existing audio engine; don't call permanent autosave or IDB; clean up object URLs after playback change. Avoid adding it to permanent history unless explicitly requested.
- `queue`: clarify permanence; if chosen to survive app restart, it requires a reopenable handle or explicit stored copy. Otherwise label the queue entry as session-only.
- `library`: preserve current metadata/playlist import with a source-resolver choice and no forced duplicate where direct access is reliable; preserve existing IDs.
- For streaming URL preview, replace brittle `__preview_stream__` metadata assumption with explicit temporary playback context; avoid polluting library and avoid stale metadata in player header.
- Reuse MIDI, URL, and local decoders and track switches; don't duplicate all playback logic. Full-screen/lock-screen metadata should reflect the temporary track.

**Open user decision:** preferred default after picking a file on mobile. Proposed conservative default: keep current `Add to Library` until explicit choice is made; show mode selector for new Quick Play actions.

**Acceptance:** One-off listening does not increase permanent library or media-cache count; library importing still behaves exactly as before when chosen; Quick Play works after switching tabs; no dangling object URLs.

## 9. ONDA-13 / ONDA-17 — Background audio, Media Session and MIDI integration

**Current anchors:** `media-session.js:1–241`, `app-core.js:1–25,2893–2925,3021–3088,3211–3312,3676–3798`, `onda-midi.js:341–566`.

- Current Media Session correctly attempts `play,pause,previoustrack,nexttrack,stop,seekbackward,seekforward,seekto` and metadata, with a 1-second `setInterval(bindCurrentAudio,1000)`. Visibility handling intentionally does not pause audio.
- It adds listeners to real audio elements only; MIDI's adapter lacks `addEventListener`, but the periodic poll can still read paused/currentTime. **Test MIDI separately**; don't assume HTML audio listeners also cover MIDI.
- `onda-midi.js:368` replaces play glyph with spinner/triangle; **this is existing MIDI-specific UI behaviour**, not an instruction to redesign the user-approved normal player symbols. If changing it, preserve visual identity and get user agreement.
- Stream audio is separate from WebAudio analyser for CORS compatibility; playback of cross-origin streams may be subject to origin/format restrictions, so do not aggressively reunify engines.
- Android may suspend/kick a browser process independent of what Media Session requests. A web app cannot guarantee indefinite background audio the way a native foreground service can.

**Suggested safe changes after Android tests:** consistent Media Session refresh events on source change, use stable metadata titles and local artwork when available, ensure lock-screen Next/Previous honours queue/shuffle and saves old position, correct seek after screen-lock interruptions, protect against pending async loads. Keep existing 1-second polling until there is evidence of unacceptable cost.

**Minimum Android matrix:** Chrome normal tab vs standalone home-screen shortcut; screen on/off; notifications; Bluetooth headphones; incoming call/interruption; media notification dismiss/restart; switch between local MP3, direct stream, MIDI; reconnect after connectivity loss; verify audio and controls independently.

**Acceptance:** no unintended pause when hidden; correct title/artwork/position shown; headset commands work on supported tracks; no race between visualiser pause and actual audio pause.

## 10. ONDA-04 / ONDA-11 — Search scaling, startup and render diagnostics

**Current anchors:** `app-core.js:943–965,964–969,1048–1050,1602–1659,2602–2642,2820–2842,3185–3202,3549–3623,4272–4275,5957–6105`.

**Observed code pattern:** `renderLibraryManager()` invokes playlist metadata reconciliation, filters/sorts all tracks, computes a large multi-field search string, rebuilds result DOM rows and renders recent/history. Reconciliation itself invokes `getTrackPlaylistNames()`, which scans playlist arrays. `updateMetadataUI()` and playlist renderers trigger additional full renders. `handleUploadedFiles()` performs multiple save/render passes, plus asynchronous per-file IDB writes. Search currently renders on every keystroke. These are **code-path costs**, not a confirmed slowdown for the user's present library.

**Investigation/implementation steps:**
1. Read-only performance marks (`performance.mark/measure` or simple `performance.now` spans) around initial DOM load, localStorage restore, IDB restore, import scanning, cache persistence, first source ready, full library render, search update and visualiser frames.
2. Diagnostic panel hidden under Storage Health or developer menu; expose count/median/p95 of recent operations; no media names or URLs logged to external analytics. Use a bounded in-memory ring buffer and a Copy Diagnostics button that excludes credentials, filenames and track URLs.
3. Only if measurable (e.g. large library, input jank, launch delay) add 100–200ms search debounce, cache a normalized search index per track, avoid scanning all playlists per row, use document fragments and incremental rendering/virtualization for thousands of rows. Avoid virtualizing the now-playing small queue unnecessarily.
4. On import, coalesce duplicate rendering and catalogue serialisation after ensuring restore/data consistency; use bounded IDB transactions rather than N database opens for a large import. Handle quota failures with progress + retry rather than blocking UI.
5. Avoid forced background maintenance; on mobile prefer idle periods/explicit user-triggered maintenance. Assess `MutationObserver` + marquee work before calling it a CPU problem.
6. Strongly consider breaking up the 6,195-line app-core in later batches **only when editing an affected subsystem**; wholesale file splitting now creates regression risk.

**Acceptance:** measurable faster response at large size, no regression at 10/100 tracks; the user does not see busy indicators for ordinary actions; no new crash/blank library after startup; abort/cancel/import data stays valid.

## 11. ONDA-16 — Explicit persistence on library mutation and safe delete

**Priority:** P0 for data integrity. **Code anchors:** `app-core.js:1346–1442,2470–2535,2602–2643,4231–4233`.

Confirmed: bulk add playlist, create playlist from selected, bulk attribute edit, and bulk delete mutate in-memory data without explicit `saveActiveLibraryState` on those action paths. The delete handler also leaves IDB audio blobs untouched.

**Implementation plan:**
1. Call one shared, debounced `commitLibraryMutation(reason)` after each **successful** mutation, then render UI and expose a definite success/failure status. Ensure repeated bulk changes do not produce multiple competing stale async snapshots.
2. On delete, first remove from catalogue, playlist arrays, history, queue and track checkpoint in a controlled order; stop playback when necessary and update `currentTrackIndex`. Save the new catalogue so entries do not reappear after reload.
3. **Do not immediately delete IDB audio bytes.** Add a read-only orphan inventory and choose a user-confirmed `Remove unreferenced cached copies` operation later. If users delete a listing accidentally, keeping bytes temporarily can help recovery; do not promise recoverability after a manual purge.
4. Distinguish `Remove from Library`, `Remove browser copy`, and any operation that acts on the underlying phone file. Onda should never expose device file deletion implicitly as part of removing a listing.
5. Check imported backup merging: `importOndaLibrary()` merges tracks by ID and can replace metadata; assure mutation is committed before/after import and preserve prior library on exceptions.
6. Regression-test after Android process kill; rapid multiple bulk actions; visual playlist changes; re-add removed track and verify it can reuse existing cache by ID if safe.

**Acceptance:** every successful bulk mutation survives hard reload without requiring user to open Settings; deleted entries don't reappear; physical phone media untouched; orphan bytes are visible and removable only by deliberate action.

## 12. ONDA-09 — Future optional online playable library

**Current code anchors:** `app-core.js:1971–2200,2759–2802,4365–4529`, `js/cloud-sync.js:184–365`, `netlify/functions/onda-sync.js`.

**Three distinct existing concepts (must not conflate):**
1. **Cloud Sync:** saves **JSON metadata per device** to Netlify Blobs, with snapshots, via a shared secret. It does **not** upload audio.
2. **Online JSON import:** loads an Onda library JSON from a URL (including raw GitHub) and merges metadata into local catalogue; this is **not a remote dynamic media index**.
3. **Streaming tab:** direct audio URLs can be played; SoundCloud/YouTube/Spotify are embed/reference paths; Apple Music is link/reference-first. They are not normal Onda audio files.

**Future proposed model:** remote catalogue describes stable ID, URL, metadata, source/provider, optional art, availability and offline pin. User can search across local + remote, with source filter; when offline, local remains fully usable, remotely referenced items are visibly unavailable unless expressly pinned. Remote fetches must be on-demand/cached responsibly, with ETag/Last-Modified and failure handling. Track URLs may expire; show actual error/retry. Do not preload the entire remote media set.

**Hosting/auth question that cannot be decided from code:** personal cloud drive, direct URLs, a self-hosted server, or another service. Never reuse a Netlify JSON device secret as if it were a general-purpose per-user audio authorization scheme. Any private online provider needs scope-aware authentication and privacy review. Test CORS, MIME types, seek/range support, mobile bandwidth controls and offline behavior. Plan backend only after user names provider.

**Possible first milestone:** opt-in online **metadata** catalogue via existing public JSON (read-only, no binary sync) with direct stream URLs. This is substantially simpler than cross-device online music hosting but should not be mislabelled as full offline sync.

## 13. ONDA-14 — Touch, accessibility, and Android layout

**Relevant code:** `css/responsive.css` 768px rules and forced mobile-mode overrides (including ~1384–1520), `css/library.css`, `app-core.js:1856–1876,3748–3759,3863–3913,5895–5955,6118–6142`.

- Keep the existing long-press Play-to-1.5x behaviour unless tested/approved otherwise; it uses `touchstart/touchend` and `preventDefault`, so confirm simple tap triggers exactly once. Avoid duplicate `pointerup` + `click` handlers when extending controls.
- Check Android safe-area insets, keyboard-opening and `visualViewport` changes, sticky top/bottom panels and drawer. Current mobile drawer uses `env(safe-area-inset-top)`; other edges need visual testing rather than assuming broken layout.
- Check cramped controls (e.g. some mobile utility glyphs have ~34px min width; search clear button is 22px). Prefer **44–48 CSS px touch target boxes** without changing the visible symbols, padding or visual styling drastically. Distinguish hit area size from symbol size.
- Add meaningful `aria-label`s where icons are the only content, prevent focus going behind open drawer/modals, and ensure keyboard escape/back navigation behaves well. Don't trigger playback when editing tags/typing.
- Honor `prefers-reduced-motion` for marquees/optional animation and readability. Existing marquee uses `MutationObserver` + event-driven RAF, so instrument if battery issues persist after visualiser fix.
- Test phone portrait/landscape, keyboard up, enlarged text, Android gesture bar, dark theme, desktop-forced mode.

## 14. ONDA-15 — PWA icon and installation (already committed)

**Approved art:** circular bronze weathered ring with N/S/E/W tabs, charcoal center, cyan/blue/green arcs, transparent beyond circle.  
**Files:** `icons/onda-icon-192.png`, `icons/onda-icon.svg`, `manifest.webmanifest`, and new `index.html` icon/manifest tags.

**Source status:** Committed and syntactically linked. **Not yet Android-verified.** SVG is an image wrapper embedding the 192 PNG (not a true scalable vector source); no dedicated 512 PNG or maskable-safe-zone variant currently exists. Chrome documentation recommends actual PNG 192 and 512, although SVGs can be supported. No need to redesign or add a charcoal square around the round logo.

**Acceptance:** Netlify deploy includes icon endpoints with correct MIME responses; Android Chrome shortcut shows approved artwork and the Onda label; standalone opens expected URL; old shortcut removed/re-added if icon cached; lock-screen behavior remains reliable. Avoid creating multiple installed app IDs when adjusting `start_url`/manifest `id`.

## 15. ONDA-01 — Video (deferred), ONDA-06 — Symbols (closed)

- **ONDA-01:** `index.html` accepts video types; `app-core.js` uses HTML `Audio` elements and contains no built-in video viewport. Proper video display would need a separate `<video>` pipeline, layout and codec tests. **Defer**.
- **ONDA-06:** User explicitly wants existing symbol design retained. **Closed**. Accessibility labels, broken state indicators or a MIDI module that inadvertently overwrites the requested symbol are different functional concerns, not permission to redesign.

## 16. Proposed sequence of development batches (after review)

| Batch | Tickets | Why first / dependencies | Data safety checkpoint |
|---|---|---|---|
| **0 — Baseline** | ONDA-11 diagnostics + ONDA-16 bulk mutation saves + read-only cache inventory for ONDA-10 | Data-integrity guardrails and reproducible baseline before other edits | JSON backup export, track/playlist/cache counts; no deletion |
| **1 — Mobile playback** | ONDA-05 visualiser lifecycle; ONDA-03 last-track/time resume | Isolated improvement, no new storage architecture | No audio pause while hidden, no library regression |
| **2 — Android source handling** | ONDA-07, ONDA-12, ONDA-10 | Requires baseline, read-only inventory and real phone file-permission test | Migrate additively; legacy audio IDB retained |
| **3 — Drawer and Quick Play** | ONDA-02, ONDA-08, ONDA-14, ONDA-17 | Depends on source resolver and clarified drawer navigation | Existing icons, playlists and import preserved |
| **4 — Future media catalogues** | ONDA-09, conditional ONDA-04, ONDA-01 | Only after hosting/user decisions and measurable scale | Offline local fallback, independent web data |

P0 indicates first-order technical priority, **not** authorisation to deploy a fix without user review. Icon ONDA-15 is already committed; its Android verification can run in parallel.

## 17. Preimplementation regression rules

1. Take a baseline that includes an **actual Android device**. Static code reading can establish code paths, not FPS, energy savings, permission survival, or Chrome notification behavior.
2. Keep new storage features **opt-in** until data-preservation and relinking are proven. Test with a copy of library data or safe test device profile, never experiment destructively on the only user library.
3. Use safe migrations and versioned schemas. Preserve existing `ondaActiveLibraryV1`, backup and last-good localStorage keys, the `OndaMediaPlayerPersistentDB` v2 audio store and Netlify JSON backup shape until backwards compatibility is explicit.
4. Re-test **both** localAudio and streamAudio, and test MIDI separately. A function that works for HTMLAudioElement may not work for MIDI's object adapter.
5. A completed task requires code review, manual Android acceptance tests, desktop regression, verified repo commit and **explicit backlog status update**. Don't mark anything implemented based on a mock-up alone.
6. Tests that need access to user's phone, actual Netlify deployment/configuration, cloud storage credentials or personal music files stay **unverified** until that evidence is available.

## 18. Documentation/standards consulted (external, not proof about Onda's runtime)

- Chrome for Developers — File System Access API, handles can be stored in IDB and permissions require rechecking: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- Chrome 132 Android File System Access availability: https://developer.chrome.com/blog/new-in-chrome-video-q1-2025
- MDN — Storage quotas and eviction: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- MDN — `StorageManager.estimate()`: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate
- MDN — `FileSystemFileHandle` and permissions: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle
- web.dev — Media Session Android integration: https://web.dev/articles/media-session
- web.dev — App manifests/installation icons: https://web.dev/articles/add-manifest

## 19. Questions intentionally left to user review

1. Queue in the existing Library drawer: separate tab or within Current?
2. Android file selection default: current Add to Library, Play Once, or Queue?
3. Resume progress for all tracks vs long recordings only? Proposed default: last active seekable track.
4. Should saved offline media be offered per track or per playlist? Proposed: both eventually, but per-track initially.
5. Where will the **future** online music actually be stored/hosted?
6. Is the app running as a **standalone installed shortcut** now after manifest changes, and does the approved icon appear?

**Everything else has a conservative technical recommendation above; no need to delay safe instrumentation/diagnostics waiting for these aesthetic and workflow choices.**
