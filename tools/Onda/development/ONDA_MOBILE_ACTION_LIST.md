# Onda — Mobile-First Development / Debug Action List

**Status:** v3.11–v3.14 development committed, including v3.14 read-only cache review; Android/Netlify verification and any cleanup approvals remain pending  
**Created:** 2026-11-23  
**Application:** Onda Media Player, source version **v3.14** (investigation baseline v3.10)  
**Primary usage:** Android phone / mobile web. Desktop compatibility remains required.  
**Implementation policy:** User approved starting changes. Make isolated, non-destructive commits, verify the code, and complete Android device tests before declaring features finished.  
**Companion mock-up:** [Open interactive mobile proposal](./mobile-review.html)  
**Technical investigation:** [Function-by-function blueprint](./TECHNICAL_INVESTIGATION.md)  
**QA & migration:** [Android test matrix and release gates](./QA_MIGRATION_MATRIX.md)  
**Production releases:** [v3.11 playback](./RELEASE_V3_11.md) · [v3.12 storage](./RELEASE_V3_12.md) · [v3.13 file access](./RELEASE_V3_13.md) · [v3.14 read-only cache review](./RELEASE_V3_14.md)

## Agreed product direction

- Keep Onda's existing visual identity and playback symbols (🧿, ⏮, ⏭). Do not redesign these.
- **Keep the existing Library drawer.** Improve its mobile layout and put more useful functionality inside it; do not replace it with a fundamentally different navigation system.
- Prioritise mobile responsiveness, battery consumption, storage, reconnecting music, touch interactions and Android background playback.
- Do not wipe or silently discard current library data, playlists, metadata, artwork, tags, or old audio caches.
- Treat the future **online library** as an optional connected feature, never a requirement for playing locally stored music.
- Video is low priority because it is not currently used.
- Every implementation item should receive an Android test plus a desktop regression test.

## Preliminary action register

| ID | Priority | Item | Decision | Current status |
|---|---|---|---|---|
| ONDA-01 | P3 / later | Video playback | Deferred, low use | Backlog |
| ONDA-02 | P1 | Expand and simplify mobile Library drawer | Preserve existing drawer | Fully mapped; static markup gap to verify on phone |
| ONDA-03 | P3 / optional | Remember playback position | Nice-to-have, if low effort only | Deferred behind main mobile work |
| ONDA-04 | P3 / scale | Large-library search/render optimisation | Not a present user issue | Monitor until needed |
| ONDA-05 | P0 | Idle / hidden visualiser CPU and battery work | Fix | **Implemented v3.11; 21 isolated/static checks passed across batch; Android battery QA pending** |
| ONDA-06 | Closed | Replace existing play symbols | Do not change | Closed — no action |
| ONDA-07 | P0 | Media storage/cache architecture | Reduce unnecessary copies, safeguard existing library | **v3.13: optional remembered file handles added as cache fallback, cache-first retained; device proof pending** |
| ONDA-08 | P2 / optional | Quick Play for *new unsaved files* | Existing Library tracks play immediately without reimport | **Saved-track Play path improved v3.11; optional new-file Quick Play not yet implemented** |
| ONDA-09 | P3 / future | GitHub Pages online library | JSON catalogue and publicly playable audio on GitHub; local stays offline-ready | Host preference decided, CORS/limits pending |
| ONDA-10 | P1 | Mobile storage settings, usage report and safe cleanup | Proposed | **v3.14 adds read-only unlinked/possible-duplicate inventory and preview; no deletion or cleanup commands** |
| ONDA-11 | P2 | Startup/loading diagnostics and responsiveness | Measure before optimising | **v3.12: full autosaves on resize/rotation removed and import saves consolidated; performance timing still unmeasured** |
| ONDA-12 | P1 | Android file/folder selection and relinking | Preserve access where supported, honest permission handling | **v3.13: Remember Files/Folder & read-permission Reconnect implemented; actual Android QA pending** |
| ONDA-13 | P1 | Screen-lock/background playback reliability | Keep existing Media Session; test and fix regressions | Existing API mapped; device QA pending |
| ONDA-14 | P2 | Mobile touch/accessibility checks | Proposal | CSS/API review done; computed style and interaction QA pending |
| ONDA-15 | P1 | Android Chrome home-screen icon / web app manifest | Use approved bronze/charcoal/cyan circle; don't change player controls | Implemented in GitHub; Android device check pending |

**Priority legend:** P0 = first technical fix/safeguard; P1 = near term; P2 = useful follow-up; P3 = future/conditional. Priority is not a claim that current user-visible breakage has been reproduced.

## Findings recorded from current repository source (investigation pass 1)

### ONDA-05 — visualiser loop (confirmed in source)
- `js/app-core.js` `drawVisualizer()` calls `requestAnimationFrame(drawVisualizer)` at the start of each frame (around line 5819). `startVisualizer()` is invoked on initialisation and during track loads.
- Proposed fix: one scheduler with stored request ID; draw an idle/static state only when something changes; run full frame rate only during active visual playback; throttle or suspend when paused and/or hidden, subject to background-audio correctness; resume on `play`, `visibilitychange`, resize, or visualiser-settings changes.
- **Guardrail:** Never pause actual audio when stopping the visualiser. Existing visualiser presets must look unchanged while playing.
- **Acceptance:** No perpetual full-frame loop while stopped/paused; music continues with screen locked; visualiser resumes correctly when foregrounded; no duplicate animation loops.

### ONDA-07 / ONDA-12 — local audio storage (confirmed in source)
- `js/app-core.js` `persistLocalAudioFilesToIndexedDb()` (around line 2536) writes every imported local media `File` into IndexedDB through `idbSetAudioFile()`. `hydrateLocalAudioBlob()` reloads it when needed. The cache writes are sequential.
- `handleUploadedFiles()` (around line 3112) currently adds imported media to `virtualLibrary`, the queue, and the persistent media cache; it saves library state multiple times.
- `loadTrack()` (around line 3220) plays local blobs through `URL.createObjectURL`, or asks for file/folder relinking if the blob is unavailable.
- **Proposed architecture:** storage source types `local-handle` (when supported), `legacy-cache`, `explicit-offline-copy`, `session-file`, and `remote-stream`. Save handles/references separately from catalogue metadata; request permissions only from a user interaction when necessary.
- **Android constraint:** Chromium Android picker APIs may be available, but remembered handles do **not** guarantee persistent permission on every device/relaunch. Test real Chrome Android first; provide relink/fallback caching.
- **Migration safety:** Keep existing IndexedDB audio records until the alternate source has been successfully reopened and tested. Never delete original Android files.
- **Acceptance:** Can play freshly picked files and safely restore saved tracks with a permitted source; explanatory 'reconnect folder' path if access is revoked; no silent data loss or compulsory duplicate import.

### ONDA-02 — mobile drawer (confirmed in source)
- Existing `index.html` already has a bottom Library button, drawer search/filter, select/settings actions and separate result/recent/playlist areas. `js/app-core.js` already has mobile drawer views `results`, `recents`, `playlists`, `help`, along with user-editable mobile icons.
- **Keep Queue / Now Playing on the main Current screen, never in the Library drawer** (user decision 2026-11-23). Candidate drawer enhancements: prominent Import/Quick Play entry, visible local/online status, and compact storage/connection shortcut. The Current screen remains the owner of playback/queue controls.
- **Acceptance:** Existing custom icon settings and mobile drawer behaviour survive. Everyday track selection can happen in the drawer without leaving playback.

### ONDA-03 — resume position (confirmed in source)
- `saveLastPlayedTrack()` (around line 3668) saves track identity and playlist; `restoreLastPlayedTrack()` can reopen the last track. No equivalent persisted position was identified in this inspection.
- **Proposed fix:** save `track ID + currentTime + timestamp + source type + playback state`; checkpoint no more often than needed (for example every 10–15 sec while playing), plus on pause/pagehide; seek only after `loadedmetadata`/seekable and clamp to duration.
- **Mobile caution:** A page may be killed without an unload event, so periodic checkpoints matter; browser auto-play restrictions mean restore should normally **wait for user to press Play**.
- **Acceptance:** Reopen a track near the prior position; completed tracks reset appropriately; restores with missing files offer relink rather than errors.

### ONDA-13 — background playback (confirmed existing capability, unverified in runtime)
- `js/media-session.js` already registers Media Session metadata and play/pause/prev/next/seek actions, listens for visibility changes, and explicitly avoids pausing audio when hidden.
- **Task is testing/reliability**, not implementing a replacement Media Session system. Investigate lock screen, Bluetooth/headphones, notifications and interruptions on actual Android.
- **Acceptance:** Screen lock, switching apps, headphone actions, seek and pause/resume behave as expected for supported audio sources.

### ONDA-04 / ONDA-11 — library rendering and loading (code risk, not a reported current failure)
- `renderLibraryManager()` (around line 1602) filters and sorts the full library then rebuilds every result row, also rendering history.
- **Defer virtualization** unless measurements show slow response as online library grows; first add a debounced search only if profiling warrants it. Do not degrade immediate small-library interactions.
- Startup diagnostics should measure initialise, restore catalogue, import persistence, initial render, first playable audio, and error rates, without transmitting private filenames.

### ONDA-09 — online library (future design only)
- Existing `Cloud Sync` functionality is distinct from a remote playable media catalogue. The streaming tab already has direct audio URL support; third-party embeds/references must not be mistaken for native file playback.
- Proposed future model: source-aware track list; stream on demand while connected; show Offline status/disabled remote actions when not connected; support deliberately saved offline copies only.
- **Decided:** start with GitHub Pages hosting a public JSON catalogue and audio files. No other host is needed unless actual size, privacy or bandwidth limits require it. Test remote media loading from Onda's Netlify origin.

### ONDA-10 — storage settings and 48-hour cleanup proposal
- Show measured site storage usage/quota via `navigator.storage.estimate()` and separately total bytes/count of Onda audio blobs by scanning the app's audio object store.
- Let user manually remove verified orphan temporary files; show a reversible confirmation preview; preserve offline-marked media, catalogues and existing legacy caches by default.
- Proposed default **48 hours applies only to explicitly temporary Quick Play data**, based on last access, not to every imported audio file.
- **Acceptance:** Clearing temporary Onda data never deletes originals or metadata. No silent deletion of legacy media caches on migration.

### ONDA-08 — Quick Play
- Current file import adds to the library and queue, saves state and copies local audio to IndexedDB.
- **Rule:** When an already saved library track is tapped, Play means immediate playback with no reimport, source picker or add-to-library action. Resolve cached or authorised files automatically. If file bytes truly cannot be accessed, show one clear Reconnect action and preserve metadata. Quick Play options are for **new unsaved files** only; keep today's new-file import default unchanged.
- **Acceptance:** Can audition a local file once without a lasting large cache copy.

### ONDA-01 / ONDA-06
- Video: defer actual video rendering/codec work; media picker currently accepts videos but current core uses audio elements. Do not spend time on this before mobile essentials.
- Playback icons: keep existing symbols and behaviour. Close the redesign request; still permit accessibility labelling improvements.

## Investigation queue / decisions still to make

1. Validate on **the actual Android phone**: Chrome version, browser tab vs installed PWA shortcut, picker/folder permission after app relaunch, lock-screen controls and storage usage.
2. **Decided:** Queue and Now Playing remain visible on the main screen, within Onda's existing Current workspace (not a new Library drawer tab). Review only the remaining drawer views, Quick Play entry and compact storage shortcuts.
3. Establish whether 'resume playback' means music, podcasts/long recordings, or all audio; use sensible completed-track reset rules.
4. Design non-destructive cache migration with an inventory, permission/relink test and explicit user action before any bulk cleanup.
5. Profile current visualiser frame count/CPU/energy while playing, paused and hidden; then implement a scheduler without changing its appearance.
6. **Settled:** use public GitHub Pages media and JSON; no extra provider or private authentication. Preserve offline local playback.
7. Add screen-reader labels, safe-area inset checks and 44px-or-greater comfortable touch targets where they are actually undersized.

## Tests to run before claiming fixes

- Android Chrome: phone portrait/landscape, browser tab and shortcut/PWA if installed, repeat open/close, file permission prompts, screen locked, app backgrounded, device offline/online.
- Media: MP3, M4A, WAV, FLAC where supported, MIDI, direct stream URL, long audio file, missing/relinked track, repeated import.
- Storage: old catalogue preserved; existing cached tracks still playable; low storage/quota failure doesn't corrupt metadata; storage cleanup preview accurate.
- Desktop Chrome: playback, library, history, playlist, drag/drop, settings, keyboard/mouse behaviour and cloud sync unaffected.
- Regression: no duplicate RAF loop; saved position doesn't start autoplay unexpectedly; media-control symbols stay unchanged.

## Research notes

- Chrome's File System Access guidance: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- MDN picker reference: https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
- MDN storage quotas/eviction: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- These web capabilities are **not** a substitute for testing file-handle persistence on the actual Android device.

## Change journal

- 2026-11-23 — v1.0 initial working list based on user decisions and Onda v3.10 source; audit findings added; mobile-first direction established; no production code modified.


## Source investigation pass 2 — precise implementation notes (2026-11-23)

**Reviewed:** `index.html`, `js/app-core.js`, `js/media-session.js`, `js/cloud-sync.js`, and relevant `css/tokens.css`. These are *static source findings*, not measurements from a physical phone.

### Storage / cache: important existing-state distinctions

1. The **current Storage Health panel** (`updateSettingsHealthPanel()`, `app-core.js` around 3997) counts tracks/playlists/missing metadata and cloud device status, but it **does not currently measure audio-cache bytes**. Build cache inventory from the Onda audio IndexedDB object store and label that figure distinctly from the broader `navigator.storage.estimate()` origin total.
2. `sourceStatus()` (around 1082) and the Storage Health 'Needs relink' count inspect in-memory `meta.blobFile`; they do not check whether the file already exists in IndexedDB. Since `hydrateLocalAudioBlob()` loads media lazily, **a saved cached track may be labelled 'needs relink' until played**. Verify the behaviour on a fresh Android page load, then define statuses `Ready`, `Cached but not hydrated`, `Permission needed`, `Missing`, `Streaming`.
3. Existing tracks use a generated ID from relative path + name + size + modification time (`handleUploadedFiles()`, around 3120). Retain stable IDs during any migration so playlists, artwork, tags, positions and cloud sync references do not break. File renaming/moving can legitimately require a relink.
4. Existing `Add Folder` uses `<input webkitdirectory>` (`index.html`, `app-core.js` around 3103/4109), **not** `showDirectoryPicker()`. A new File System Access handle feature must be capability-detected and must preserve the input fallback on browsers/devices where the newer picker is unavailable or permissions are unreliable.
5. Proposed non-destructive upgrade sequence: (a) inventory current catalogue and cached media, (b) preserve old schema/objects, (c) add source-resolver interface, (d) test direct read and permission regrant, (e) prefer direct handle only where usable, (f) retain legacy cache until verification, (g) offer user-confirmed cleanup. **No blanket 48-hour deletion of legacy library files.**
6. Keep metadata backups distinct from media bytes: existing JSON export deliberately omits `blobFile`. Tell users clearly that an 'Export Everything' JSON backup does **not** include the playable audio.

### Import and Quick Play: implementation outline

- Introduce one shared `resolveMediaInput(file, mode)` pipeline with `mode='session'|'queue'|'library'`; avoid three inconsistent ways to parse MIDI, audio and supported formats.
- Session mode: build object URL or retain a temporary File reference in memory; revoke object URL when genuinely unused; do **not** `virtualLibrary[id] = ...` or call `idbSetAudioFile` unless user upgrades to permanent library.
- Queue mode: decide with user whether queue survives reload; avoid promising queue persistence when the file cannot be reopened without permission/cache.
- Library mode: preserve existing tracking, metadata and playlists; choose source resolver and optional offline cache on Android.
- The existing import renders the library twice and performs multiple catalogue saves immediately plus a save after cache completion (around 3185–3202). Once safe, coalesce redundant renders/saves for imports; do **not** assume this is measurable with a small library before profiling.

### Drawer: use existing functionality before adding UI

- Current drawer's search and result rows already have Play/Info/+Playlist actions and its mobile icons can be changed by the user (`buildTrackRow()`, `setMobileLibraryView()`). The tap on the **row body** currently toggles selection, while the smaller Play button plays. Test whether this causes accidental selections on phone; only propose changing it after user feedback.
- The drawer search field currently clears its value when opened and also has delayed autofill-clearing timers (around 950–960). On Android, test that opening the drawer or switching away doesn't unexpectedly erase user-entered search queries.
- **Superseded:** Do not add a Queue view to the Library drawer. The user explicitly wants Queue / Now Playing on the main screen, using the existing Current workspace. Keep existing Results, Recents, Playlists, Help and icon editing in the drawer.
- Avoid duplicating full settings in the drawer: provide 1–2 shortcuts to the existing Storage Health panel instead.

### Resume and playback: avoid unintended side effects

- `rememberRecentTrack()` is invoked early during `loadTrack()` before a missing-file/cached-file failure is resolved; a failed attempt may therefore appear in History. Consider registering a 'play' as history only after a successful start, but **test current expected behaviour before changing**.
- Existing `timeupdate` handlers (around 3056–3067) update the seekbar but do not persist position. Position persistence should use one checkpoint writer shared across local audio, streams and MIDI **only where their API supports seeking**. The key should be stable track ID, not display name.
- At track end, reset progress sensibly to avoid reopening at the last second. Avoid fighting existing repeat/shuffle/queue logic and update the saved position on manual seek.
- `media-session.js` already uses audio element events and adds a **1-second timer** to rebind/update Media Session state. Leave this running until real Android battery/background tests justify changing it; an eventual event-driven or lower-frequency strategy must not break headphones or lock-screen controls.

### Specific validation cases before implementation

| Scenario | Required result |
|---|---|
| Android first import from Files | Plays immediately, no unexpected permission changes |
| Close and reopen browser after imported music | Playback access restored or a clear reconnect action |
| Prior installed Onda data on same origin | All playlists, tags, history and old cached audio still present |
| New source handle rejected by Android | Falls back to reselect/cached source; does not remove catalogue |
| Pause a 45-minute recording and reopen Onda | Same track and approximately same position restored without autoplay |
| Lock phone while audio plays | Audio continues and media controls are usable where supported |
| Pause and lock screen with visualiser enabled | No unnecessary visualiser animation in inactive page |
| Switch to offline while remote track is displayed | Local music remains available; remote items show unavailable |
| Clean temporary cache | Lists exactly what will be deleted; originals untouched |

## Mock-up review

The standalone, self-contained [mobile-review.html](./mobile-review.html) contains interactive proposals for:
- the existing Library drawer retained for browsing and quick links, with Queue / Now Playing visibly on the main Current screen;
- Storage Health and safe cache choices;
- Play Once / Add to Queue / Add to Library;
- resume-position prompt for longer recordings;
- local/online library while switching simulated connectivity.

The page contains **no production Onda scripts, no network calls, and no actual media or storage mutations**; its actions are demonstrations only. Its layout is conceptual, not an exact pixel-copy of the current site. The primary product design requirement remains **preserve the existing drawer and playback icons**.

### Decisions to ask the user after showing the page

1. **Answered:** Queue / Now Playing belongs on the **main Current screen**; do not add a drawer tab for it.
2. **Settled for saved tracks:** tap Play to play, with no reimport. Optional Quick Play applies solely to new unsaved files; keep current new-file import default.
3. **Deprioritised:** resume position is optional P3; implement only if safe and easy.
4. Is Onda normally used through **Chrome tab, home-screen shortcut / installed app, or another browser**? This strongly affects how local file permissions and background playback should be verified.
5. Where should the **future online playable media** actually be hosted?

### Next technical implementation batch (subject to review)

**Batch A — safe low-risk improvement:** visualiser idle scheduler and reliable one-tap playback; preserve Media Session/icons. Position resume is low-priority optional P3.  
**Batch B — storage groundwork:** read-only cache inventory and accurate source/status labels, before changing any caching default.  
**Batch C — media source architecture:** Android capability tests, relink flow, explicit offline cache, temporary Quick Play mode; migrate only after compatibility validation.  
**Batch D — main Current screen + drawer enhancements:** retain Queue / Now Playing on-screen; add only approved browsing and compact storage/source entry points to the Library drawer.  
**Batch E — online library:** use GitHub Pages and public JSON/media URLs, with real cross-origin and size/bandwidth tests.

## Change journal, continued

- 2026-11-23 — v1.1 second source investigation: identified existing mobile drawer features, cached-but-not-hydrated status discrepancy to test, media-source ID stability, actual `webkitdirectory` fallback, metadata-only JSON exports, and Android-specific test plan. Standalone HTML mock-up committed. Production player untouched.


## ONDA-15 — Android shortcut icon and web app identity investigation (2026-11-23)

**User report:** Onda was previously added to the Android home screen; the shortcut disappeared or was replaced, and after adding it back Chrome used the wrong icon. User primarily opens Onda on Android using a home-screen shortcut. This should be treated as an important mobile UX issue, not as a cosmetic redesign.

**Confirmed from GitHub source:** 
- `tools/Onda/index.html` currently has `<title>Onda Media Player - Engine</title>` but contains no `rel="icon"`, `rel="apple-touch-icon"`, or `rel="manifest"` declarations and no `theme-color`.
- The tracked `tools/Onda/` directory contains no `manifest.webmanifest`, `favicon.ico`, app icon PNGs or SVGs, and the full repository tree contains no clearly Onda-specific image/icon asset.
- The current Onda Netlify deployment has not been independently verified from a live browser. A missing declared icon is a strong cause of a generic or incorrect Chrome shortcut icon, but the exact shortcut on the user's phone hasn't been inspected.
- **Do not use the Organon root lion logo or invent a replacement Onda icon without the user's approval.** The existing playback eye emoji is not evidence that it should be the application logo.

**Proposed implementation once the official icon artwork is identified:**
1. Add the approved Onda icon files beneath `tools/Onda/icons/`: **192x192** and **512x512** PNG, optionally a padded maskable version for Android's adaptive icon treatment; add 32x32 favicon and 180x180 touch icon if appropriate. Preserve the original logo artwork with proper aspect ratio, no stretching.
2. Add `tools/Onda/manifest.webmanifest` with `name`, `short_name`, stable `id`, root-relative-to-deploy `start_url` and `scope`, `display` per agreed shortcut/full-screen preference, Onda theme/background colors, and correctly typed icon declarations. Prefer local same-origin asset URLs for install reliability. Mind that Netlify publishes from `tools/Onda` as site root and that GitHub Pages would have a different base path.
3. Add `<link rel="icon">`, `<link rel="manifest">`, `<meta name="theme-color">` and optional touch-icon metadata to the `index.html` head.
4. Verify manifest and icon URLs serve successfully, correct image dimensions, no clipping in maskable safe region, phone home-screen icon, Android launcher label and launched URL.
5. Test whether Android Chrome presents **Install app** vs **Create shortcut**, and whether `display: standalone` changes the existing background-audio behaviour or access to files. **Do not add a service worker that caches media or catalogue files without a separate review.**
6. After deployment, user may need to remove and re-add the shortcut because home-screen icons can remain cached. Verify this as a follow-up, not a guaranteed automatic correction.

**Dependencies and open question:** Obtain the **existing intended Onda icon image** or its exact image URL. GitHub currently does not contain an Onda-specific app icon to point Chrome at. Do not claim a complete icon fix until an approved icon is actually deployed and checked on the user's device.

**References:** https://web.dev/articles/add-manifest and https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest/

## Change journal, continued

- 2026-11-23 — v1.2 added ONDA-15 (home-screen icon/PWA identity) after user confirmed Android home-screen shortcut usage. Verified missing favicon/manifest/icon in repo. Awaiting official icon asset; player unchanged.

## ONDA-15 implementation update — 2026-11-23

**Approved:** User selected the weathered circular bronze ring with north/south/east/west tabs, dark charcoal inner circle, and cyan/blue/green signal arcs, with everything beyond the ring transparent.

**Committed on main (`eb7f42e19e6207ef848a50f085ad97cd5416b2d9`):**
- `icons/onda-icon-192.png`: transparent 192×192 downscaled PNG of the approved design.
- `icons/onda-icon.svg`: 512×512-format SVG containing the approved 192×192 PNG as a self-contained data URI; enlarges that image without introducing a new design. This is **not** a fully vectorised source image or a true high-resolution 512×512 PNG.
- `manifest.webmanifest`: Onda name, short name, standalone display, relative launch/scope, theme colors and 192 PNG + scalable-format SVG icon entries.
- `index.html`: manifest, favicon, SVG icon, Apple touch icon, theme color tags. No playback/layout JavaScript changed.
- `icons/README.md`: source/size notes and shortcut cache advice.

**Follow-up:** Verify Netlify deployment and inspect Android Chrome's home-screen appearance, label and launch behaviour. The browser may retain an old icon until the user removes and recreates the shortcut. If Chrome requires an actual 512×512 PNG rather than the SVG entry for a fully installable experience, add a true 512 PNG from the original approved source. A separate maskable/padded icon could be considered only if needed because the user's preferred design has transparent outer space. Do not add a background square.

No service worker or media cache changes were included.


## Completed planning investigation — research status (2026-11-23)

The source audit now covers all 6,195 lines of the main app-core.js module, the page markup, audio/MIDI/Media Session interfaces, JSON cloud sync, Netlify endpoint, mobile CSS, storage keys and current PWA files. This means the code-dependent investigation is now consolidated; it does **not** mean every bug is reproduced or that an Android hardware test has happened.

**Files to work from:**

- [TECHNICAL_INVESTIGATION.md](./TECHNICAL_INVESTIGATION.md) — complete implementation blueprint with present behaviour, verified function pointers, suggested data models, rollout dependencies, test limitations and external API verification.
- [QA_MIGRATION_MATRIX.md](./QA_MIGRATION_MATRIX.md) — Android test cases, data protection, rollback procedures, source migration, icon tests and release gates. All hardware tests correctly marked NOT RUN / NEEDS DEVICE.
- [mobile-review.html](./mobile-review.html) — interactive visual proposal; existing production UI has not been replaced.

**Important additional findings:**
1. The mobile CSS and JS reference special icon-view buttons, but the matching .mobile-db-icon-btn elements and mobile icon help panel are not present in the static index.html. Treat this as a UI verification target before adding more tabs, not a confirmed phone complaint.
2. The MIDI module maintains its own playback scheduler and audio-like adapter (not an HTML audio element). Resume and Media Session changes need an explicit MIDI bridge. It also writes different symbols to the play button; preserve the user's preferred original controls unless they approve a correction.
3. The library's “Needs relink” status and Check Files use in-memory blobs; they may be wrong for tracks saved in IndexedDB and only hydrated when played.
4. Deleting a library listing does not delete its IndexedDB media cache record. This can leave orphaned cached bytes. Investigate and offer **manual cleanup**, not implicit deletion.
5. UI resize/orientation callbacks can trigger full library catalogue autosaves through saveLocalUiStateCheckpoint. Mark batching as a measurable optimisation candidate.
6. Cloud sync is JSON catalogue/profile sync, not backup of actual music. The future online media library is an entirely separate feature.
7. Android file handles are supported by recent Chrome, but persistence and reauthorisation must be validated on the user's phone before removing automatic caching as the default.
8. Icon setup is committed, but a true 512×512 PNG and installed-home-screen verification remain open; current SVG wrapper contains a 192px raster.

**Implementation order after review:** Visualiser lifecycle → cache diagnostics → Android source resolver and one-tap saved-library playback → drawer and optional new-file Quick Play → GitHub Pages online library. Resume is low priority. No current library data should be erased automatically, including on upgrade.

**Changes performed in this investigation:** Research documentation only. No playback, visualiser, import, IndexedDB schema, cloud endpoint or responsive CSS production code was changed.

## Change journal, continued

- 2026-11-23 — v1.3 extensive static audit finished; added detailed technical implementation blueprint and Android QA/migration matrix, linked to companion HTML review. Live player unchanged.

## Decision record — 2026-11-23: Queue / Now Playing placement

**Decision (approved):** Queue and Now Playing must remain on Onda's **main screen**. Specifically, use the existing **Current** workspace, and keep the queue visible/accessible there. **Do not create a Queue tab inside the Library drawer** and do not require opening the drawer to inspect the current playback order.

**UX ownership:** The main screen handles now-playing metadata, the current/next track, playback order, and queue actions. The drawer handles discovering tracks, searches, recents, saved playlists, importing, selecting and adding items to the queue; a button in the drawer may enqueue an item, but the queue itself is not displayed/managed there. Preserve the fixed transport icons and current layout unless a specific change is approved.

**Existing code to retain/reuse:** `index.html#tab-library` ('Current'), `#now-playing-playlist-panel`, `#now-playing-mode-pills`, and `app-core.js` `updateNowPlayingPlaylistPanel()`, `setNowPlayingVisibilityToggle()`, `setNowPlayingMode()`. Source currently marks the panel/visibility pills hidden in HTML; investigate when the application enables them before deciding how to surface the queue. Treat this as extending the on-screen Current view, not a navigation redesign.

**Acceptance:** While using the main screen, the user can always reach Now Playing and Queue without opening the Library drawer; the drawer contains no Queue tab. Library row actions may still include Add to Queue. Confirm compact mobile visibility without obscuring the player or changing the approved transport symbols.

**Updated preview:** [mobile-review.html](./mobile-review.html) now places an illustrative current/next track list on the main screen and removes Queue from the drawer tabs.

- 2026-11-23 — v1.4 user-approved placement recorded; proposal and mock-up corrected; no production code changed.

## Decision record — 2026-11-23: saved tracks, resume, GitHub

**One-tap Library Play is mandatory:** A track already in Onda's Library must simply play when tapped; never request Add to Library or repeat importing. Load it from session File, saved IndexedDB cache or valid file handle automatically. If access genuinely cannot be restored, offer one simple Reconnect and leave the library record intact. **Quick Play is only an optional mode for a file not already in the Library.** Keep existing new-file import defaults for now.

**Resume position is P3 optional:** Not particularly important to user; do it only if trivial and safe. Avoid a new resume prompt. Don't schedule it ahead of battery, storage or playback reliability work.

**Online library host selected:** public static GitHub Pages with a `library.json` catalogue and playable `audio/*.mp3` files. No additional hosting service is necessary for a small public library. Onda is served from Netlify, so verify cross-origin JSON fetch, actual streaming/audio seeking and existing analyser limitations. Local music must work offline. GitHub Pages content is public and must be lawful to distribute, even if Pages publishes from a private repo. Published site max 1 GB, source recommended 1 GB, soft bandwidth 100 GB/month; regular Git files max 100 MiB, and Git LFS is not available for Pages. A separate **GitHub** media repository is optional for cleanliness, not mandatory.

GitHub Docs: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits ; https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github ; https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage ; https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

- 2026-11-23 — v1.5 decisions entered; older Quick Play, resume and online hosting questions superseded. Production Onda unchanged.

## Implementation progress — Onda v3.11, 2026-11-23

[Read the v3.11 release changes and Android smoke plan](./RELEASE_V3_11.md).

The first user-authorised production batch is committed to `main`: the unbounded idle/hidden visualiser loop is replaced with a single active-only scheduler; MIDI can trigger redraws; the last-track restore no longer sends an extra early play request; `playAudio()` starts playback within the originating mobile tap where possible; existing IndexedDB audio files load automatically without a reimport prompt; a genuinely unavailable saved file gets a direct **Reconnect** picker using the existing stable ID. Storage Health now shows read-only cached audio count/bytes, unlinked cache entries, and a distinct whole-site storage estimate; the Library filter uses verified cache status instead of incorrectly assuming unloaded means missing.

**Verification:** 21 static/isolated checks passed, including actual extracted scheduler/status logic and JavaScript syntax parsing. The actual Android device, installed shortcut, real audio autoplay/locking and Netlify deployment are **not yet verified**. No schema upgrade or automatic deletion was performed; the existing `OndaMediaPlayerPersistentDB` v2 data is retained.

**Next dependency:** test the public v3.11 deployment on Android and desktop; fix real-device regressions before the larger file-handle migration. Keep Queue / Now Playing on the main Current screen (future UI work), not drawer. New-file Quick Play optional P2, GitHub Pages online media future P3, position resume optional P3.

- 2026-11-23 — v1.6 backlog updated following first implementation. Details and rollback in RELEASE_V3_11.md.


## Implementation progress — Onda v3.12 storage optimisation, 2026-11-23

[Read the v3.12 release notes, safety contract and Android tests](./RELEASE_V3_12.md).

**Implemented and committed:** `persistLocalAudioFilesToIndexedDb()` now compares a previously cached File's verified metadata (filename, relative path, size, MIME type, known lastModified) to an incoming File before writing. An unchanged reimport *skips the redundant IndexedDB blob put*, and in-flight writes are serialised per track ID. Unknown/changed metadata **or an optional cache-comparison read error** uses the safe full-write path. This prevents redundant IO on repeated imports but **does not reclaim old duplicate caches under different IDs** or provide byte-for-byte cryptographic deduplication.

**Additional write reductions:** local UI resize and orientation checkpoints no longer serialise and rewrite the entire music catalogue and visualiser stack. The normal import pathway now saves catalogue metadata only **once**, after the queue is established and **before** asynchronous caching starts, rather than three times. Other user/lifecycle saves remain in place.

**Safety:** IndexedDB version 2 unchanged; no existing cached bytes deleted or altered by cleanup; automatic audio caching remains enabled to keep Android music playable. **No cache deletion, orphan removal, new permissions or file-handle migration introduced.** Version bumped to v3.12 and script URL cache-busted.

**Verification:** 22 isolated/static checks passed, including the actual metadata-comparison and per-track serial queue functions, unknown metadata fallback, concurrent imports, import save count, lightweight resize checkpoint and preserved pagehide save. Android Chrome and Netlify release still need real verification.

**Next steps:** Confirm v3.12 deployment and playback/Storage Health on Android, then move on to persistent file/folder access proofs and safe manual orphan review (with explicit consent); afterwards refine the Current/Now Playing main-screen queue and mobile Library drawer. Resume position and GitHub Pages hosting remain low priority.

- 2026-11-23 — v1.7: v3.12 implementation recorded; no user data migration.


## Implementation progress — v3.13 persistent file access (2026-11-23)

**Committed:** [v3.13 release specification and Android verification plan](./RELEASE_V3_13.md).

Chrome's File System Access API is available on recent Android Chrome, but retained handles can lose permission between sessions. To keep Onda convenient, v3.13 introduces **optional Remember Files and Remember Folder** actions in the existing Library drawer Settings. On supported Chrome, they allow user-selected read-only file references to be saved. Onda still stores normal cached music; it first plays the existing cached audio, then a linked file when already permitted. A missing file can use the existing **Reconnect** button to request read permission explicitly. The user can always fall back to existing Add/Folder input flows.

**Storage safety:** The new `OndaMediaPlayerFileHandlesDB` v1 is **separate** from the existing `OndaMediaPlayerPersistentDB` v2. No migration, deletion, automatic cache cleanup or original-file writes. The handle store contains browser-local references/paths, not extra audio copies, and is not included in cloud JSON backups. Library IDs, playlists and caches stay intact.

**Source-level verification:** 13 isolated file-handle tests + 18 integration/source tests passed. Chrome and Android permission persistence, device lock-screen playback, actual Netlify deployment, and large music libraries still require real-device verification. File/folder paths that differ from old imports may generate different IDs; use Reconnect to preserve an existing track identity rather than silently merging ambiguous files.

**Next recommended work:** Test v3.13 on the user's Android Chrome with an expendable MP3, then build a **read-only, user-reviewed orphan/duplicate cache report** before any opt-in cleanup. Current/Now Playing layout remains on the main screen; resume position stays optional P3.

- 2026-11-23 — v1.8 v3.13 implemented and documented; device tests remain pending.


## Implementation progress — Onda v3.14 read-only cache review (2026-11-23)

**Committed:** [v3.14 release report, tests and safety decisions](./RELEASE_V3_14.md).

In **Settings → Storage → 🔎 Review Cached Audio**, Onda can now explicitly scan the existing IndexedDB `audioFiles` store in **readonly mode**. The report shows saved audio records and File/Blob size totals, entries unlinked from the currently restored Library/queue/playlists/history or known local backup IDs, and candidate duplicate groups.

**Duplicate caution:** Candidates require matching normalised filename, bytes, nonzero modification timestamp and media type. They are *not verified identical content*. Potential duplicate surplus bytes can overlap unlinked bytes; the report never adds these estimates into a guaranteed storage saving.

**Safety:** This release contains **NO delete button, no `delete` transaction, no cleanup, no automatic TTL, no media byte inspection, no original file writes and no database migration.** Filenames and local paths stay on the device and are escaped before display; no report is uploaded. The existing cache remains the default for playback.

**Verification:** 18 static/data/readonly-cursor tests plus 12 UI/escape/binding tests passed. Real Android cache sizes, permission persistence and the Netlify deployment remain unverified. A future manual cleanup requires the user's explicit approval of exact records and a confirmed remaining playable source.

**Next development (after phone smoke test):** Current-screen Queue / Now Playing refinements (never a Queue tab in the Library drawer), then mobile Library browsing. Optional Quick Play for new unsaved files and public GitHub Pages streaming remain later work.

- 2026-11-23 — v1.9 v3.14 read-only audit committed; no deletion capability implemented.
