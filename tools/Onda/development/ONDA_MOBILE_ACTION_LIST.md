# Onda — Mobile-First Development / Debug Action List

**Status:** Static source research completed and documented; mobile-device verification and user choices remain before code changes  
**Created:** 2026-11-23  
**Application:** Onda Media Player, currently identified as v3.10 in `js/app-core.js`  
**Primary usage:** Android phone / mobile web. Desktop compatibility remains required.  
**Implementation policy:** Research and mock-ups first; do **not** change the live player without review.  
**Companion mock-up:** [Open interactive mobile proposal](./mobile-review.html)  
**Technical investigation:** [Function-by-function blueprint](./TECHNICAL_INVESTIGATION.md)  
**QA & migration:** [Android test matrix and release gates](./QA_MIGRATION_MATRIX.md)

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
| ONDA-03 | P1 | Resume last track **and position** | Approved | Detailed implementation path ready; Android/MIDI test pending |
| ONDA-04 | P3 / scale | Large-library search/render optimisation | Not a present user issue | Monitor until needed |
| ONDA-05 | P0 | Idle / hidden visualiser CPU and battery work | Fix | Source issue confirmed; detailed implementation path ready |
| ONDA-06 | Closed | Replace existing play symbols | Do not change | Closed — no action |
| ONDA-07 | P0 | Media storage/cache architecture | Reduce unnecessary copies, safeguard existing library | Source architecture mapped; Android handle proof pending |
| ONDA-08 | P2 | Quick Play separate from permanent import | Proposed | Import pathway mapped; behaviour approval pending |
| ONDA-09 | P3 / future | Online media library | Connected-only mode; local remains usable offline | Current cloud/stream architecture mapped; hosting decision pending |
| ONDA-10 | P1 | Mobile storage settings, usage report and safe cleanup | Proposed | Read-only inventory & cleanup safeguards specified |
| ONDA-11 | P2 | Startup/loading diagnostics and responsiveness | Measure before optimising | Specific instrumentation points defined |
| ONDA-12 | P1 | Android file/folder selection and relinking | Preserve access where supported, honest permission handling | Source-resolver design ready; actual permission testing pending |
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
- **Do not rebuild what exists.** Candidate enhancement: add accessible Queue, a prominent Import/Quick Play entry, visible local/online status, and a compact storage/connection shortcut within the existing drawer.
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
- **Question:** Where will remote media actually live (cloud drive, personal server, direct URLs, another provider)? Do not implement a backend until this is agreed.

### ONDA-10 — storage settings and 48-hour cleanup proposal
- Show measured site storage usage/quota via `navigator.storage.estimate()` and separately total bytes/count of Onda audio blobs by scanning the app's audio object store.
- Let user manually remove verified orphan temporary files; show a reversible confirmation preview; preserve offline-marked media, catalogues and existing legacy caches by default.
- Proposed default **48 hours applies only to explicitly temporary Quick Play data**, based on last access, not to every imported audio file.
- **Acceptance:** Clearing temporary Onda data never deletes originals or metadata. No silent deletion of legacy media caches on migration.

### ONDA-08 — Quick Play
- Current file import adds to the library and queue, saves state and copies local audio to IndexedDB.
- Proposal: user-selectable **Play once**, **Add to Queue**, **Add to Library** with the least intrusive mobile default decided by user. Temporary items should not pollute permanent history/library without a deliberate choice.
- **Acceptance:** Can audition a local file once without a lasting large cache copy.

### ONDA-01 / ONDA-06
- Video: defer actual video rendering/codec work; media picker currently accepts videos but current core uses audio elements. Do not spend time on this before mobile essentials.
- Playback icons: keep existing symbols and behaviour. Close the redesign request; still permit accessibility labelling improvements.

## Investigation queue / decisions still to make

1. Validate on **the actual Android phone**: Chrome version, browser tab vs installed PWA shortcut, picker/folder permission after app relaunch, lock-screen controls and storage usage.
2. Decide mobile drawer layout after reviewing the [HTML concept](./mobile-review.html): Queue placement, drawer views, Quick Play entry, and whether some Settings should appear inside the drawer.
3. Establish whether 'resume playback' means music, podcasts/long recordings, or all audio; use sensible completed-track reset rules.
4. Design non-destructive cache migration with an inventory, permission/relink test and explicit user action before any bulk cleanup.
5. Profile current visualiser frame count/CPU/energy while playing, paused and hidden; then implement a scheduler without changing its appearance.
6. For future online library, identify where audio files will be hosted and how Onda authenticates; stay local-first while offline.
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
- Proposed mock-up adds a Queue view; this is **new**, not a claim that it exists today. Keep existing Results, Recents, Playlists, Help and icon editing.
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
- the existing Library drawer extended with a Queue view and quick links;
- Storage Health and safe cache choices;
- Play Once / Add to Queue / Add to Library;
- resume-position prompt for longer recordings;
- local/online library while switching simulated connectivity.

The page contains **no production Onda scripts, no network calls, and no actual media or storage mutations**; its actions are demonstrations only. Its layout is conceptual, not an exact pixel-copy of the current site. The primary product design requirement remains **preserve the existing drawer and playback icons**.

### Decisions to ask the user after showing the page

1. Should **Queue** be its own view within the drawer, or be part of **Current**?
2. When a file is selected from Android, what should the default action be: **Play once**, **Add to queue**, or **Add to Library**, while keeping a choice for the others?
3. Should saved playback position apply to **all audio**, or only long recordings?
4. Is Onda normally used through **Chrome tab, home-screen shortcut / installed app, or another browser**? This strongly affects how local file permissions and background playback should be verified.
5. Where should the **future online playable media** actually be hosted?

### Next technical implementation batch (subject to review)

**Batch A — safe low-risk improvement:** visualiser idle scheduler + position checkpoint/restore; protect Media Session behaviours and existing icons.  
**Batch B — storage groundwork:** read-only cache inventory and accurate source/status labels, before changing any caching default.  
**Batch C — media source architecture:** Android capability tests, relink flow, explicit offline cache, temporary Quick Play mode; migrate only after compatibility validation.  
**Batch D — drawer enhancements:** user-approved Queue layout and compact storage/source entry points.  
**Batch E — online library and scaling:** after hosting decisions and measurable library growth.

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

**Committed on main (\`eb7f42e19e6207ef848a50f085ad97cd5416b2d9\`):**
- \`icons/onda-icon-192.png\`: transparent 192×192 downscaled PNG of the approved design.
- \`icons/onda-icon.svg\`: 512×512-format SVG containing the approved 192×192 PNG as a self-contained data URI; enlarges that image without introducing a new design. This is **not** a fully vectorised source image or a true high-resolution 512×512 PNG.
- \`manifest.webmanifest\`: Onda name, short name, standalone display, relative launch/scope, theme colors and 192 PNG + scalable-format SVG icon entries.
- \`index.html\`: manifest, favicon, SVG icon, Apple touch icon, theme color tags. No playback/layout JavaScript changed.
- \`icons/README.md\`: source/size notes and shortcut cache advice.

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

**Implementation order after the review:** Visualiser lifecycle and resume → read-only cache/status diagnostics → test saved Android file handles → safe media resolver/migration → drawer & Quick Play → online library later. No current library data should be erased automatically, including on upgrade.

**Changes performed in this investigation:** Research documentation only. No playback, visualiser, import, IndexedDB schema, cloud endpoint or responsive CSS production code was changed.

## Change journal, continued

- 2026-11-23 — v1.3 extensive static audit finished; added detailed technical implementation blueprint and Android QA/migration matrix, linked to companion HTML review. Live player unchanged.
