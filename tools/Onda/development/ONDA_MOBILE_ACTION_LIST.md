# Onda — Mobile-First Development / Debug Action List

**Status:** v3.11–v3.22 source development committed; v3.22 fixes stale loaded-version reporting in read-only device QA. Android/Netlify deployment and playback verification remain pending.  
**Created:** 2026-11-23  
**Application:** Onda Media Player, source version **v3.22** (investigation baseline v3.10)  
**Primary usage:** Android phone / mobile web. Desktop compatibility remains required.  
**Implementation policy:** User approved starting changes. Make isolated, non-destructive commits, verify the code, and complete Android device tests before declaring features finished.  
**Companion mock-up:** [Open interactive mobile proposal](./mobile-review.html)  
**Technical investigation:** [Function-by-function blueprint](./TECHNICAL_INVESTIGATION.md)  
**QA & migration:** [Android test matrix and release gates](./QA_MIGRATION_MATRIX.md)  
**Production releases:** [v3.11 playback](./RELEASE_V3_11.md) · [v3.12 storage](./RELEASE_V3_12.md) · [v3.13 file access](./RELEASE_V3_13.md) · [v3.14 cache review](./RELEASE_V3_14.md) · [v3.15 Current queue](./RELEASE_V3_15.md) · [v3.16 mobile Library](./RELEASE_V3_16.md) · [v3.17 touch/accessibility](./RELEASE_V3_17.md) · [v3.18 diagnostics](./RELEASE_V3_18.md) · [v3.19 Quick Play](./RELEASE_V3_19.md) · [v3.20 device QA](./RELEASE_V3_20.md) · [v3.21 save efficiency](./RELEASE_V3_21.md) · [v3.22 QA version correction](./RELEASE_V3_22.md)

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
| ONDA-02 | P1 | Current-screen Queue and mobile Library drawer | Queue remains on Current, never drawer | **v3.15 queue + v3.16 mobile drawer improvements committed; Android usability QA pending** |
| ONDA-03 | P3 / optional | Remember playback position | Nice-to-have, if low effort only | Deferred behind main mobile work |
| ONDA-04 | P3 / scale | Large-library search/render optimisation | Not a present user issue | Monitor until needed |
| ONDA-05 | P0 | Idle / hidden visualiser CPU and battery work | Fix | **Implemented v3.11; 21 isolated/static checks passed across batch; Android battery QA pending** |
| ONDA-06 | Closed | Replace existing play symbols | Do not change | Closed — no action |
| ONDA-07 | P0 | Media storage/cache architecture | Reduce unnecessary copies, safeguard existing library | **v3.13: optional remembered file handles added as cache fallback, cache-first retained; device proof pending** |
| ONDA-08 | P2 / optional | Quick Play for *new unsaved files* | Existing Library tracks play immediately without reimport | **v3.19: temporary one-file audio preview implemented, with explicit Add-to-Library and no cache/queue/history writes beforehand; Android/desktop QA pending** |
| ONDA-09 | P3 / future | GitHub Pages online library | JSON catalogue and publicly playable audio on GitHub; local stays offline-ready | Host preference decided, CORS/limits pending |
| ONDA-10 | P1 | Mobile storage settings, usage report and safe cleanup | Proposed | **v3.14 adds read-only unlinked/possible-duplicate inventory and preview; no deletion or cleanup commands** |
| ONDA-11 | P2 | Startup/loading diagnostics and responsiveness | Measure before optimising | **v3.18: optional timings; v3.21: concrete source fix suppresses redundant full library/visualiser checkpoint saves on UI-only navigation; Android performance measurements pending** |
| ONDA-12 | P1 | Android file/folder selection and relinking | Preserve access where supported, honest permission handling | **v3.13: Remember Files/Folder & read-permission Reconnect implemented; actual Android QA pending** |
| ONDA-13 | P1 | Screen-lock/background playback reliability | Keep existing Media Session; test and fix regressions | Existing API mapped; device QA pending |
| ONDA-14 | P2 | Mobile touch/accessibility checks | Improve narrow-phone Library controls without changing player layout | **v3.17 source fixes: two-column search/filter, 44px drawer targets, accessible Select state; physical Android/desktop QA pending** |
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

**Verification:** 18 static/data/readonly-cursor checks, 12 UI/escape/binding checks and 9 additional scan-error/20,000-record-limit checks passed (39 isolated/static checks total). Real Android cache sizes, permission persistence and the Netlify deployment remain unverified. A future manual cleanup requires the user's explicit approval of exact records and a confirmed remaining playable source.

**Next development (after phone smoke test):** Current-screen Queue / Now Playing refinements (never a Queue tab in the Library drawer), then mobile Library browsing. Optional Quick Play for new unsaved files and public GitHub Pages streaming remain later work.

- 2026-11-23 — v1.9 v3.14 read-only audit committed; no deletion capability implemented.

## Implementation progress — v3.15 Main Current queue (2026-11-23)

[Full v3.15 release notes and QA plan](./RELEASE_V3_15.md).

The existing `#now-playing-playlist-panel` now displays the **actual active `playlistTracks` playback queue** on the main **Current** screen, even for ad-hoc imports or tracks started from Library without a named saved playlist. If a saved playlist is active, its artwork/title/edit action remain contextual, while actual queued rows (not the saved list alone) are displayed. Current/up-next labels and count are shown; shuffle does not promise a fixed next song.

Actions: direct queue-row Play, inline Info without changing the current audio's `currentFile`, existing Add to Playlist, and Remove from Queue for non-playing items only. Removal adjusts the active index and saves the queue but **does not delete anything from Library, a saved playlist, browser cache or original files**. A queue add without playing updates Current. On mobile the list appears below Now Playing and before long metadata, with bounded scrolling; forced desktop mode stays distinct. Queue is **not** in the drawer.

**Source tests:** 19 queue-interaction + 13 named/empty/shuffle/accessibility/escaping checks passed (32 isolated/static checks). Netlify deployment, Android real touch/audio and layout remain unverified. Next: improve existing mobile Library browsing without adding a queue tab.

- 2026-11-23 — v2.0: v3.15 Current Queue committed, phone QA pending.

## Implementation progress — v3.16 Mobile Library UX (2026-11-23)

[Release details, scope, and phone verification checklist](./RELEASE_V3_16.md).

**Committed source changes:** Added a visible mobile Library navigation row for Results, Recents, Playlists and the existing custom icon editor. The stored mobile icon values and existing Results/Recents/Playlists/Help view names remain unchanged. The previously hidden Recents and Playlist containers can now be shown in their mobile views; the Playlist view renders saved playlist rows with a View/open action and existing Edit action. The drawer has an Add Files shortcut using the existing file input and a Storage shortcut opening the existing Storage Health settings page. The status line gives displayed/total track and stream counts.

**Usability correction:** Opening/reopening the drawer no longer clears a deliberately typed search or schedules follow-up clears; searches with no matches stay visible. Mobile search switches to Results. Existing Library row-body selection remains unchanged until the user tests it on Android. The explicit ▶️ Play button remains the way to play an existing track directly; its mobile touch target is increased to 44px. The mobile Select action now toggles the actual multi-select mode. Desktop row-selection behaviour is unchanged. The most recent mobile drawer subview is restored when reopening.

**Safety and scope:** No change to the playback symbols, Current-screen queue, audio persistence, file IDs, caches, IndexedDB, original files, stored playlists, visualiser or cloud sync. No online library, cleanup or automatic deletion introduced. The mobile navigation and view panels are mobile-only.

**Verification:** 26 source/static and isolated mobile-tab checks passed, including JavaScript syntax, version/cache references, view bindings, preserved search logic, a real extracted tab-switcher run, accessible pressed states and desktop/mobile CSS scoping. Physical Android touch/viewport/font/rotation checks, audio playback, permission tests, Netlify deployment and desktop regressions remain pending. Confirm on the real phone before calling the UX fully verified.

**Next:** Android and desktop smoke test v3.16, correct any layout/playback issues, then reconsider the lower-priority Quick Play for *new unsaved* files, online GitHub Pages library and optional playback position only after the mobile basics are verified.

- 2026-11-23 — v2.1: v3.16 mobile Library UX source implemented and recorded; device QA pending.

## Implementation progress — v3.17 Mobile Library touch QA (2026-11-23)

[Full v3.17 release notes and phone/desktop verification steps](./RELEASE_V3_17.md).

**Source-level correction:** v3.16's narrow-screen Library toolbar still reserved four grid columns although the mobile Select/Settings actions were hidden from that bar; search and source-filter were the only visible children. v3.17 makes it two columns to free space for typing. Library header buttons, search/clear/filter and bulk/settings actions have 44px touch targets. The search field reserves room for the larger clear button. The mobile Select button now communicates its actual `isLibrarySelectMode` state through `aria-pressed`, title and active styling; row-body selection and the explicit ▶️ Play button are unchanged. Other Library control labels are more accessible. The earlier suspected Icon Guide placement issue was ruled out after direct DOM inspection; no relocation needed.

**Source checks:** 28 assertions passed, including parsing, DOM IDs/labels, CSS specificity/structure, versioned assets and running the real selection-state renderer in isolated mode with Select ON/OFF. No device or computed-layout test has yet passed; Android, desktop and public Netlify verification still need to be performed.

**Safety:** Zero media storage/schema/cache migration changes. No background playback, core transport, queue, or desktop drawer redesign. Track/library state and source files remain untouched.

**Next:** Run the Android and desktop acceptance tests for v3.11–v3.17 before considering P2 Quick Play for new unsaved files or future GitHub Pages streaming.

- 2026-11-23 — v2.2: v3.17 touch/accessibility source updated; actual phone and desktop UI QA still outstanding.

## Implementation progress — v3.18 opt-in performance diagnostics (2026-11-23)

[Release notes, privacy specification and device test procedure](./RELEASE_V3_18.md).

**Measured stages (when explicitly enabled):** app-core initialization; localStorage candidate recovery; IndexedDB restore; overall catalogue recovery; read-only audio cache inventory; Library render/search-to-results; new file import setup; IndexedDB audio write batch; track source resolution; audio-play response; and one in every 60 visible visualiser frames. Count metrics include tracks, visible results, cached records, saved/skipped/failed writes. No filename, file ID, path, URL, tag, playlist title, app JSON, cloud credential or music content is collected.

**How to use:** Settings → Storage Health → collapsed Developer performance diagnostics panel → Start recording. To measure the beginning of Onda startup, deliberately click Reload & record startup; its single-use sessionStorage flag is consumed on reload. Export generates a local redacted JSON (up to 200 samples); Clear discards data in memory. Completely off unless requested; no network, cloud or IndexedDB analytics writes.

**Source tests:** 62 static/isolated checks passed, including full timing-event bindings, opt-in collection, redacted output, one-time startup capture, sample buffer limits and no extra cloud/IndexedDB writes. Real-device performance values remain unmeasured.

**Scope/safety:** Existing audio engine, playback symbols, Current queue, playlists, Library saved data, cached audio, file handles and original files are unchanged. No speculative worker/virtualisation/deletion optimisations. ONDA-11 now has source instrumentation but is **not yet verified** with actual Android/desktop timing data, Netlify deployment, lock-screen playback or storage profiles.

**Next:** Confirm v3.18 deploy on Android/desktop, export at least one startup and a Library search measurement, then use evidence to determine whether large-library rendering or caching needs further work. Optional ONDA-08 Quick Play for new unsaved files is a separate later change, not a prerequisite for these measurements.

- 2026-11-23 — v2.3: v3.18 developer diagnostics instrumentation committed; runtime performance measurement pending.

## Implementation progress — v3.19 temporary Quick Play (2026-11-23)

[Full release description, privacy constraints and Android/desktop tests](./RELEASE_V3_19.md).

**Source behaviour:** Onda's existing Add workspace now offers **▶ Quick Play (temporary)** with a one-file system picker and its own native audio controls. Mobile Library includes a shortcut to the same picker. A chosen audio file is held in memory and played from a temporary `blob:` URL; it is **not** added to `virtualLibrary`, current playback queue, recents/history, IndexedDB, cloud sync or Library JSON. This means it also needs no automatic cache deletion or TTL. A separate mini panel offers Replay, **Add to Library + Queue**, and Discard. Add explicitly invokes the existing `handleUploadedFiles` importer with no parallel identity/cache implementation. Ordinary Add Files, drag/drop, Remember Folder/Files and already-saved Library Play behaviour remain unchanged. MIDI and video continue through normal Add Files.

**Playback coexistence:** Quick Play pauses the normal saved track; starting normal main playback or navigating away from Add stops the preview and revokes its URL. Its selected File remains available during the same session for Replay or explicit Add. Discard and pagehide release it. Media Session system controls temporarily route to the preview and return to saved playback when it ends/stops; Previous/Next do not mutate the saved queue while previewing.

**Source checks:** 53 consolidated static and isolated tests passed, including blob URL failures, cancellation, repeated replay, explicit importer handoff and Media Session play/pause/seek/stop routing. These are not Android/desktop runtime tests.

**Scope/safety:** No permanent storage, browser-cache migration, automatic deletion, playlist changes or saved-source ID changes before user-directed Add. The temporary module has no localStorage/sessionStorage/IndexedDB/network calls. Original source files are never modified. User-visible filenames use safe textContent. New source is loaded after existing Media Session. Real phone permissions, codecs, lock-screen routing, desktop UI and public Netlify deployment remain unverified.

**Next:** Test v3.19 on the user's actual Android and desktop browser, especially preview playback, native controls, Media Session, saved queue/history unchanged, import after explicit Add and cache persistence on reload. After a successful phone acceptance pass, prioritise observed issues, not speculative feature churn.

- 2026-11-23 — v2.4: v3.19 temporary Quick Play source implemented; real-device QA outstanding.

## Implementation progress — v3.20 on-device release QA (2026-11-23)

[Release notes and Android/desktop test procedure](./RELEASE_V3_20.md).

**Source update:** Added a collapsed, opt-in **Device compatibility and playback QA (read-only)** section under existing Storage Health. **Run device checks** reports the loaded source version, browser secure/standalone status, coarse viewport dimensions, capability presence for File System Access picker APIs and Media Session, Storage Estimate availability, Onda's Quick Play/Library/diagnostics module presence and browser `canPlayType` codec hints. Nothing is opened or played by the checker, and an API being exposed is not treated as a successful end-to-end test.

**Manual QA:** Eight playback, file reconnect, Quick Play, queue/cache protection, Library UX, lock-screen and normal import cases can be marked Not tested / Pass / Fail / Blocked. A redacted JSON export saves only fixed capability fields and status values locally. The QA module neither reads nor writes localStorage, IndexedDB, file handles, music or cloud data and performs no fetch/upload. Actual device testing still requires the user to play music on their own phone/desktop.

**Verification:** 37 source/static and mock-DOM checks passed, including complete export field allowlists and no file access, playback, storage or networking. No GitHub CI/status results were reported for the v3.19 merge, and the public Netlify domain could not be directly accessed with the verification browser. Thus **deployed v3.20 and Android/desktop runtime remain unverified**.

**Next:** Run QA on actual Android Chrome, installed shortcut (if used) and desktop. Export redacted device QA JSON so failed cases can be fixed with targeted source changes. Do not start speculative new media/storage features before reviewing the resulting evidence.

- 2026-11-23 — v2.5: v3.20 read-only compatibility self-check source implemented; physical device QA pending.

## Implementation progress — v3.21 UI-only checkpoint efficiency (2026-11-23)

[Complete source findings, rollback/safety notes and Android/desktop acceptance checks](./RELEASE_V3_21.md).

**Confirmed issue in v3.20 source:** Opening/closing/resizing the Library drawer, changing its Results/Recents/Playlists/Help view and switching workspaces triggered full visualiser sync and catalogue autosave even though the user had not modified music, metadata or presets. The pre-close drawer checkpoint also duplicated a post-close checkpoint. Mobile Library → Quick Play went through these UI-only save paths despite the selected audio being temporary.

**Correction:** v3.21 classifies the existing layout, drawer and tab browsing checkpoint reasons as UI-only: save the active workspace tab, drawer browse view and UI timestamp, **but do not synchronise visualiser cards, rewrite the full active visualiser stack, serialise the entire Library or schedule an IndexedDB catalogue mirror**. Removed the redundant pre-close drawer checkpoint; post-toggle persistence remains.

**Protection:** Actual imports, edits to visualiser fields, track/playlist mutations, settings/metadata imports, export and recovery actions, pagehide/beforeunload/visibility-hidden continue down existing save/flush paths. Legacy audio cache, file handles, cloud sync, sources, history, media engine, normal Add Files and Quick Play preview logic untouched. This is a source-proven reduction in redundant full-save invocations, **not yet a measured Android speed or battery improvement**.

**Verification:** 66 isolated/static assertions passed: 14 UI-only reasons do not trigger full saves yet persist UI keys, 13 meaningful editing/recovery reasons continue full saves, source syntax/version/assets/critical flush/Quick Play bridge retained. The public Netlify URL still could not be verified with available public-web retrieval; live deployment and Android/desktop runtime performance remain unverified.

**Next:** Confirm deployment/version and use v3.20 QA + v3.18 opt-in timing reports on Android and desktop, then address any observed playback/permission regressions rather than adding further speculative storage or media features.

- 2026-11-23 — v2.6: v3.21 UI-only save corrections; device runtime verification pending.

## Repeatable regression testing — source CI added (2026-11-23)

The one-off v3.11–v3.21 source checks now have a committed follow-up: a dependency-free [Node regression suite](../tests/onda-regression.test.mjs), invoked by `cd tools/Onda && npm test`, and an [Onda-only GitHub Actions workflow](../../../.github/workflows/onda-regression.yml). It will run on Onda-related PRs, main pushes, and manual dispatch without installing Netlify packages or accessing music storage.

Coverage: script syntax/asset ordering; navigation vs meaningful save checkpoints; temporary Quick Play's explicit import and blob lifecycle; Media Session preview/system action routing; and read-only device QA's redacted reporting. All **five top-level tests passed in the isolated harness and in actual GitHub Actions Node.js 22** in [run #45216940426](https://github.com/cinaedvsstudios/Organon/actions/runs/45216940426) for PR #185. This source CI does not replace Android testing.

These are source/mock tests, **not** Android playback validation. Continue with physical Android Chrome + desktop acceptance; never clear or automatically migrate the user's existing music cache just to force a test.

- 2026-11-23 — v2.7: committed source test suite/CI infrastructure; no Onda runtime version bump or media behaviour changes.

## Implementation progress — v3.22 QA version correctness (2026-11-23)

[Release notes, exact defect and Android acceptance](./RELEASE_V3_22.md).

**Confirmed source error:** The v3.20 read-only device QA component compared the running core version against a frozen `v3.20` module constant and exported that constant as `sourceVersion`. This falsely flagged the correctly loaded v3.21 app as `different-or-unavailable`. The first committed regression tests unintentionally asserted the wrong outcome.

**Fix:** The panel now reports the currently loaded app's validated `document.documentElement.dataset.ondaVersion` value in both UI and redacted export. Valid version tokens stay supported across future releases without changing QA JS; malformed/untrusted strings become `unavailable`. The permanent suite now derives the expected app version from source, verifies the HTML asset query and exercises current/future/malformed version scenarios. Onda core and QA asset links are bumped to v3.22.

**Scope:** No playback, music file access, cloud, cache, IndexedDB, playlist/history, import or media-control changes. Real device behaviour and production Netlify deployment remain unverified until observed.

- 2026-11-23 — v2.8: fix device QA false version mismatch, future-proof CI assertions.

## Automated real Chromium test milestone — source remains v3.22 (2026-11-23)

A second [Onda GitHub Actions job](../../../.github/workflows/onda-regression.yml) now runs an [actual Chrome smoke test](../tests/onda-browser-smoke.browser.mjs) in a disposable local browser profile (desktop plus mobile touch/viewport emulation), **after** the five original Node source tests. The original source check and the actual browser job both passed in [run #45235601393](https://github.com/cinaedvsstudios/Organon/actions/runs/45235601393).

Confirmed in actual Chrome: full Onda page starts and announces v3.22; Storage Health's QA panel runs and downloads redacted JSON; a generated WAV decodes/plays in Quick Play; its audio cache is unchanged during audition/Discard; only explicit import creates a persistent IndexedDB audio entry; reload preserves the deliberately cached test file; mobile-emulated Library drawer and search operate. Normal first-run Cloud/Recovery dialogs are explicitly dismissed via their existing **local-only/continue-empty** controls in the disposable test context.

**Still unverified:** Actual Android Chrome on user's phone, installed shortcut, long-lived permissions/file reconnection, lock-screen/headphone controls, offline behavior, measured battery/large-library performance, and live production Netlify deployment. No real user files, profiles, cache or media data were accessed. The change is tests/CI/docs only; **Onda application version remains v3.22**.

- 2026-11-23 — v2.9: durable actual Chrome smoke test added; real Android acceptance still required.

## v3.22 real browser offline restore/playback proof (2026-11-23)

Extended the actual Chromium smoke suite beyond merely counting saved blobs: [GitHub Actions run #45245006631](https://github.com/cinaedvsstudios/Organon/actions/runs/45245006631) passed the original source suite and the browser test proving that the deliberately imported synthetic WAV reappears as a saved Library entry after reload, has a cached/ready source rather than a Reconnect prompt, and actually decodes and advances playback from IndexedDB while network is disabled after load. Audio cache count remains unchanged during restored playback.

This is a significant **browser source-of-truth check** for the v3.13+ cached media fallback and Library restore path, not proof of Android offline cold-start, permissions, phone screen-lock or device battery behaviour. No production runtime version bump and no media storage changes.

- 2026-11-23 — v2.10: commit real Chrome offline after-reload playback regression coverage.

## Missing-media Reconnect browser QA — v3.22 (2026-11-23)

The existing actual-Chromium suite now tests a **missing saved file**, not just the successful cached-file path. [GitHub Actions #45256546568](https://github.com/cinaedvsstudios/Organon/actions/runs/45256546568) passed: a synthetic metadata-only local track survived reload; Library showed **needs relink** and an explicit Reconnect control; trying Play without bytes preserved its entry/notes/playlist and did not import; Chrome's actual filechooser then provided a synthetic WAV under the same track ID; its cache and playback worked; another reload showed the file available without Reconnect.

**Remaining actual Android verification:** file-handle permission persistence and rejection, device reboot, Android picker and storage differences, Bluetooth/headset and screen-lock actions, cold offline startup and measured large-library performance. This change adds only tests and documentation, no Onda runtime change or version increment.

- 2026-11-23 — v2.11: actual Chrome missing audio + explicit Reconnect/reload regression test passed.

## Remembered file-handle and denial fallback QA — Onda v3.22 (2026-11-23)

[GitHub Actions #45270809740](https://github.com/cinaedvsstudios/Organon/actions/runs/45270809740) passed a new actual-Chromium case: a synthetic WAV kept in test-only OPFS is linked by a genuine FileSystemFileHandle, serialized into Onda's file-handle IndexedDB, restored after page reload and played offline **without copying its audio into the persistent audio cache**. With explicitly simulated permission denial, silent normal Play never calls `requestPermission()`, while user-triggered Reconnect requests permission once and falls back to the real manual picker after denial. The original Library ID, metadata and playlist remain intact.

The source/player/storage schema are unchanged. This is safe automated browser coverage only: **OPFS is not an externally picked Android file handle**, and permission denial was simulated. Physical Android permission persistence after phone/browser restart, actual OS denial dialogs, Bluetooth and background audio still require on-device testing.

- 2026-11-23 — v2.12: added real-browser remembered-handle, simulated denial and explicit reconnect regression.

## Real Chrome Media Session callback and simulated visibility proof — v3.22 (2026-11-23)

Added actual Chromium integration coverage for Onda's **registered system playback handlers**. [GitHub Actions #45277569315](https://github.com/cinaedvsstudios/Organon/actions/runs/45277569315) passed: synthetic native WAV play/pause/seekto/offset seek, next/previous track metadata handoff, explicit simulated hidden/visible `visibilitychange` without interrupting playback; Quick Play temporarily controls media keys/metadata, leaves main queue/cache unchanged, and system Stop/Play returns cleanly to the saved track.

**Not yet validated on Android hardware:** actual lock-screen controls and notifications, Bluetooth/headphone media buttons, Chrome suspension when app is backgrounded, device power management and long-run battery, notification artwork, MP3-specific or real media collection behaviour. The callback test is not an OS-level test; the synthetic visibility event does not duplicate real background scheduling. No runtime source or Onda version changes.

- 2026-11-23 — v2.13: added real Chromium Media Session routing + simulated visibility playback regression.

## v3.23 offline installed shell — source + real browser gate (2026-11-23)

Onda v3.22 had no registered service worker: its stored audio would play offline **only once the app itself was loaded**. v3.23 adds a narrowly scoped static app-shell cache (HTML, exact linked JS/CSS, icons/manifest/MIDI; never user audio or cloud requests), enabling previously installed/visited Onda to reopen offline after Chrome restarts. No browser music cache deletion, no new audio storage format and no permissions change. The first app visit **must** be online.

[GitHub Actions run #45280311658](https://github.com/cinaedvsstudios/Organon/actions/runs/45280311658) passed with a **complete Chrome process shutdown/restart**, networking disabled before opening Onda on the second launch, and a real cached WAV restoring and playing after offline startup. Previously added source, Reconnect, permission and Media Session tests remained green.

**Release acceptance still needs real-device check:** after Netlify v3.23 is verified live, open Onda once while online, close it, enable airplane mode, reopen same installed shortcut in Android Chrome, and play previously cached music. Repeat after phone restart and verify browser storage is still retained; do not clear site data because that may delete saved audio. Test Android media keys, lock screen and background playback separately. See [RELEASE_V3_23.md](./RELEASE_V3_23.md).

- 2026-11-23 — v2.14: safe v3.23 offline app-shell startup implementation and actual cold Chrome restart regression.
