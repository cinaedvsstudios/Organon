# Onda — Mobile-First Development / Debug Action List

**Status:** Preliminary working backlog + source investigation in progress  
**Created:** 2026-11-23  
**Application:** Onda Media Player, currently identified as v3.10 in `js/app-core.js`  
**Primary usage:** Android phone / mobile web. Desktop compatibility remains required.  
**Implementation policy:** Research and mock-ups first; do **not** change the live player without review.  
**Companion mock-up:** [Open interactive mobile proposal](./mobile-review.html)

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
| ONDA-02 | P1 | Expand and simplify mobile Library drawer | Preserve existing drawer | Investigation |
| ONDA-03 | P1 | Resume last track **and position** | Approved | Investigation |
| ONDA-04 | P3 / scale | Large-library search/render optimisation | Not a present user issue | Monitor until needed |
| ONDA-05 | P0 | Idle / hidden visualiser CPU and battery work | Fix | Confirmed code issue |
| ONDA-06 | Closed | Replace existing play symbols | Do not change | Closed — no action |
| ONDA-07 | P0 | Media storage/cache architecture | Reduce unnecessary copies, safeguard existing library | Confirmed code issue; design investigation |
| ONDA-08 | P2 | Quick Play separate from permanent import | Proposed | Investigate |
| ONDA-09 | P3 / future | Online media library | Connected-only mode; local remains usable offline | Architecture planning |
| ONDA-10 | P1 | Mobile storage settings, usage report and safe cleanup | Proposed | Investigation |
| ONDA-11 | P2 | Startup/loading diagnostics and responsiveness | Measure before optimising | Investigation |
| ONDA-12 | P1 | Android file/folder selection and relinking | Preserve access where supported, honest permission handling | Investigation |
| ONDA-13 | P1 | Screen-lock/background playback reliability | Keep existing Media Session; test and fix regressions | Investigation |
| ONDA-14 | P2 | Mobile touch/accessibility checks | Proposal | Investigation |

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
