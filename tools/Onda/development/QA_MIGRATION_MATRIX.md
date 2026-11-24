# Onda — Android QA, Migration Safeguards and Release Checklist

**Version:** QA v2.1 for Onda v3.22 · 2026-11-23  
**Status:** v3.11: 21 checks; v3.12: 22 checks; v3.13: 31 checks; v3.14: 39 checks; v3.15: 32 checks; v3.16: 26 checks; v3.17: 28 checks; v3.18: 62 checks; v3.19: 53 checks; v3.20: 37 checks; v3.21: 66 isolated/static checkpoint regression checks; v3.22: corrected loaded-version reporting and release-agnostic CI assertions. All Android device, real storage benchmarks, live Netlify deployment and permission persistence remain **unverified**. See [v3.22 release notes](./RELEASE_V3_22.md).  
**Scope:** Mobile-first updates to Onda v3.10 in cinaedvsstudios/Organon.  
**Related:** [Action list](./ONDA_MOBILE_ACTION_LIST.md) · [Technical blueprint](./TECHNICAL_INVESTIGATION.md) · [Concepts](./mobile-review.html)

This is a reproducible implementation and test record, not a claim that Onda currently fails every scenario.

## 1. Environments and prerequisites

| Environment | Required reason |
|---|---|
| User's actual Android phone, Chrome tab | Source of truth for current music, permissions, battery and playback habits |
| Same phone, Chrome home-screen shortcut / installed standalone | Installed mode may have different launcher icon, UI, permissions and OS handling |
| Same phone, offline / airplane mode | Confirm local files stay available without any network |
| Same phone, cellular network vs Wi-Fi | Verify online streams and library recovery |
| Same phone, low free space (safely simulated or test profile) | Test quota failures without risking actual music |
| Desktop Chrome (fresh and existing profile) | Preserve mouse, keyboard, large files, settings and desktop playback |
| Small-width/large-text mobile viewport | Drawer, safe areas, keyboard, orientation and touch targets |

**Record before testing:** phone make/model; Android and Chrome version; whether shortcut says “Install app” or “Add to Home screen”; installed display mode; sample track type, length and approximate file size; whether source was local music, Downloads, cloud provider file, SD card or folder import; and offline availability. Do **not** collect private filenames, passwords, full paths, GPS, media library exports or cloud secrets in shared diagnostic reports.

## 2. Baseline preservation and rollback (must precede any player commit)

- [ ] Record currently deployed app version and Git commit. The inspected source app-core.js declares v3.10.
- [ ] User optionally exports **Everything** JSON, and a second Settings/Playlists backup when appropriate.
- [ ] Explain: JSON contains library data, metadata, art refs, history, playlists and presets; **it does not include local audio bytes**.
- [ ] Verify two existing cached local tracks play now and after refreshing browser.
- [ ] Verify at least one MIDI, one direct audio stream and one playlist, if user uses those sources.
- [ ] Record current counts for tracks, playlists, recent items and IndexedDB audio files **using read-only inspection**.
- [ ] Preserve the current legacy IndexedDB database OndaMediaPlayerPersistentDB version 2, object stores state/audioFiles.
- [ ] Before introducing any new version 3 schema, test old profile → new schema → reopen playback → reload again; confirm all original audioFiles keys remain readable.
- [ ] Do not run a data-cleanup migration automatically on deployment.
- [ ] Rollback strategy for functionality: revert app code to last known good commit; do not downgrade the IndexedDB version or clear storage. Keep new stores additive and old readers compatible.
- [ ] If new code cannot restore, show existing recovery UI and an explicit retry/import path; never overwrite a rich saved library with an empty library automatically.
- [ ] Create a fresh/nonproduction Chrome profile or a developer test origin for destructive test scenarios. **Do not run quota/deletion tests against the user's only music cache.**
- [ ] Never persist or log cloud sync shared secret in repo, screenshots or test attachments.

## 3. Test cases per development ID

Legend: PASS, FAIL, NEEDS DEVICE, BLOCKED, NOT RUN. A source finding is not a test result.

| Test ID | Related action | Steps | Expected | Status |
|---|---|---|---|---|
| VIZ-01 | ONDA-05 | Open player with no media; leave for 30s | Idle canvas settles; no full-speed perpetual frame callback | NOT RUN |
| VIZ-02 | ONDA-05 | Play local MP3 with visualiser presets | Image animates exactly as before | NOT RUN |
| VIZ-03 | ONDA-05 | Pause, resume, drag seek, change preset | Correct redraw; no duplicate loops | NOT RUN |
| VIZ-04 | ONDA-05 | Play direct stream with fallback visualiser, pause | Fallback animates while active/visible; static when paused | NOT RUN |
| VIZ-05 | ONDA-05 | Lock Android during playback | Audio continues; hidden canvas stops | NEEDS DEVICE |
| VIZ-06 | ONDA-05 | Return to foreground after lock / app switching | Visualiser resumes correctly, does not catch up excessively | NEEDS DEVICE |
| VIZ-07 | ONDA-05 | MIDI play/pause while visualiser exists | MIDI playback unaffected | NOT RUN |
| RES-01 | ONDA-03 | Play 40-min track to 18:24; pause/close/reopen | Same track near 18:24; no autoplay until tap | NEEDS DEVICE |
| RES-02 | ONDA-03 | Seek to 25:00, lock app before periodic save | Position checkpoint survives most normal lifecycle paths | NEEDS DEVICE |
| RES-03 | ONDA-03 | Finish track and reopen | No unwanted resume at last second | NOT RUN |
| RES-04 | ONDA-03 | Shuffle/repeat/next/prev after bookmarking | Bookmarks stay matched to track IDs | NOT RUN |
| RES-05 | ONDA-03 | Load MIDI, seek, pause, resume | MIDI adapter restores real time position | NOT RUN |
| RES-06 | ONDA-03 | Play live URL stream | No invalid duration/infinite resume state | NOT RUN |
| RES-07 | ONDA-03 | Track missing or denied local access | Show reconnect, retain bookmark, no crash | NEEDS DEVICE |
| ST-01 | ONDA-07/10 | Open Storage Health with imported music | Distinct catalogue count, cached audio bytes and origin usage | NOT RUN |
| ST-02 | ONDA-07/10 | Fresh app start with previously cached audio | Track recognised as cached, not falsely missing merely because unhydrated | NEEDS DEVICE |
| ST-03 | ONDA-07/10 | Compare audioFiles File sizes to report | Count and byte totals match records; note browser usage is estimate | NOT RUN |
| ST-04 | ONDA-07/10 | Delete a library listing in test profile | Orphan inventory lists old cache, does not delete device original | NOT RUN |
| ST-05 | ONDA-10 | 48-hour temporary TTL eligible | Only explicitly temporary records selected; legacy and offline protected | NOT RUN |
| ST-06 | ONDA-10 | Clear preview then cancel | Nothing deleted | NOT RUN |
| ST-07 | ONDA-10 | Confirm cleanup in test profile | Only selected IndexedDB records removed, all playlists/metadata retained unless user separately chose removal | NOT RUN |
| ST-08 | ONDA-07 | Force IndexedDB quota error in safe test profile | Helpful error, existing library intact, no false success toast | NOT RUN |
| FILE-01 | ONDA-12 | Import audio via Android Chrome Files | Play works immediately, file provenance tracked accurately | NEEDS DEVICE |
| FILE-02 | ONDA-12 | Reopen saved FileSystemFileHandle after Chrome restart | Plays when access allowed; otherwise explicit permission/relink request | NEEDS DEVICE |
| FILE-03 | ONDA-12 | Revoke file permission and reopen | Cache fallback or choose file; no catalogue deletion | NEEDS DEVICE |
| FILE-04 | ONDA-12 | Move/rename an imported file | Reconnect flow preserves stable ID, playlist membership, artwork, tags | NEEDS DEVICE |
| FILE-05 | ONDA-12 | Import directory via existing webkitdirectory fallback | Original folder import continues working | NEEDS DEVICE |
| FILE-06 | ONDA-12 | Choose same media from 2 folders with identical filenames | Disambiguation without attaching wrong track | NEEDS DEVICE |
| FILE-07 | ONDA-12 | Old v2 media cache after new resolver deployed | Still playable, even when source handle denied | NOT RUN |
| PLAY-01 | ONDA-07/08 | Tap Play on saved library track | No reimport/add; starts playback from cache/file/handle | NEEDS DEVICE |
| PLAY-02 | ONDA-07/08 | Reopen Chrome and play a cached saved song | Plays with one tap without new import | NEEDS DEVICE |
| PLAY-03 | ONDA-07/08 | Deliberately revoke file and clear test cache | Single Reconnect, metadata retained | NOT RUN |
| QP-01 | ONDA-08 | Select Play once for a new 100MB unsaved test audio file | Does not grow permanent library or audioFiles records | NOT RUN |
| QP-02 | ONDA-08 | Upgrade temporary item to Library | Stable metadata and source persist after refresh, with clear caching status | NOT RUN |
| QP-03 | ONDA-08 | Add to Queue without Library | Shows that its session playback access may not survive app restart | NOT RUN |
| DRAW-01 | ONDA-02 | Open existing drawer; browse Results, Recents, Playlists, Help | Current user functions still work; existing icon mapping preserved | NEEDS DEVICE |
| DRAW-02 | ONDA-02 | Check whether mobile icon buttons are actually present | Reconcile missing static HTML elements with visible Android UI | NEEDS DEVICE |
| DRAW-03 | ONDA-02 | Try short/long tap on track row and ▶ button | Select vs play behaviour matches approved expectation | NEEDS DEVICE |
| DRAW-04 | ONDA-02 | Search, toggle drawer, reopen, type with Android keyboard | No accidental disappearance/reset of intentionally typed query | NEEDS DEVICE |
| DRAW-05 | ONDA-02 | Landscape, 320/360/390/420px, accessibility large text | Drawer doesn't cover controls, keyboard doesn't trap focus | NEEDS DEVICE |
| CURRENT-01 | ONDA-02 | Open Current main screen without Library drawer | Now Playing and Queue are accessible without opening drawer | NEEDS DEVICE |
| CURRENT-02 | ONDA-02 | Inspect Library drawer views | No Queue drawer tab; browsing/Recents/Playlists/Help preserved | NEEDS DEVICE |
| CURRENT-03 | ONDA-02 | Add a track to queue from Library drawer | Current main-screen queue updates correctly, no duplicate list in drawer | NEEDS DEVICE |
| CURRENT-04 | ONDA-02 | Current screen portrait, small font/large font, with player visible | Upcoming playback order remains accessible and doesn't cover transport | NEEDS DEVICE |
| BG-01 | ONDA-13 | Play MP3, lock screen 5–10min | Audio continues and controls show where supported | NEEDS DEVICE |
| BG-02 | ONDA-13 | Pause/resume/seek via notifications, Bluetooth/headset | Correct track and state | NEEDS DEVICE |
| BG-03 | ONDA-13 | Switch apps, receive interruption, return | Onda can resume with correct state without multiple audio elements playing | NEEDS DEVICE |
| BG-04 | ONDA-13 | MIDI and direct URL stream in background | Document limitations and actual capabilities, no invented universal guarantee | NEEDS DEVICE |
| PERF-01 | ONDA-11 | App open without media vs with existing library | Capture time-to-ready and first play latency by app and browser | NEEDS DEVICE |
| PERF-02 | ONDA-11 | Import 50/200/1000 mock tracks on disposable test profile | Count renders/saves and measure latency; zero data loss | NOT RUN |
| PERF-03 | ONDA-04 | Search with 50/500/5000 seeded metadata tracks | Performance evidence before deciding on virtualization | NOT RUN |
| PERF-04 | ONDA-11 | Rotate device 10 times / resize quickly | UI checkpoint writes batched; no corrupted library | NEEDS DEVICE |
| NET-00 | ONDA-09 | Netlify Onda fetches GitHub Pages library.json | CORS succeeds; valid public JSON, correct file base | NOT RUN |
| NET-01 | ONDA-09 | Remote direct stream online/offline | Error status independent of local library; retry works | NOT RUN |
| NET-04 | ONDA-09 | Tap GitHub Pages-hosted track in Onda on Android | Direct playback with no reimport; seek works | NEEDS DEVICE |
| NET-05 | ONDA-09 | GitHub Pages content/limits audit | Publicly distributable audio, site <=1 GB, no LFS | NOT RUN |
| NET-02 | ONDA-09 | navigator.onLine true but remote host unreachable | Treat as remote failure, not proof of connectivity | NOT RUN |
| NET-03 | ONDA-09 | Spotify/YouTube/Apple reference | Not falsely presented as directly playable file | NOT RUN |
| CLOUD-01 | existing cloud | Export backup JSON and inspect | Contains metadata but no local music files | NOT RUN |
| CLOUD-02 | existing cloud | Save/load a test device cloud profile | Existing catalogue remains intact, no leaked secrets | NOT RUN |
| CLOUD-03 | existing cloud | Load cloud profile in fresh browser | Explicit warning that local audio may need relinking | NOT RUN |
| ICON-01 | ONDA-15 | Open manifest URL and icons after Netlify deploy | HTTP success; Onda name/icons correct | NOT RUN |
| ICON-02 | ONDA-15 | Remove/readd home-screen shortcut | Shows approved circular icon, no gray square | NEEDS DEVICE |
| ICON-03 | ONDA-15 | Install prompt/standalone launch | Correct start URL, layout, notifications and audio | NEEDS DEVICE |
| ICON-04 | ONDA-15 | Android's required 512 PNG/maskable treatment | Check actual install diagnostics before declaring complete | NEEDS DEVICE |
| VIDEO-01 | ONDA-01 | Recheck current video import constraints | Document but defer production video controls | DEFERRED |

## 4. Storage record inventory rules (development specification)

First instrument read-only:
- Store name: OndaMediaPlayerPersistentDB; version currently 2; object stores state/audioFiles.
- Read audio record properties: trackId, file (File or Blob), savedAt, sizeBytes, fileName, localPath, lastModified and type.
- Onda catalogue contains virtualLibrary metadata and IDs; link by trackId, not display title.
- Classify each record as referenced, legacy-orphan (no catalogue ID), explicit-offline, temporary/session, permission-backed, or unknown. On initial migration unknown/legacy should be protected rather than deleted.
- Derive media bytes from media File.size / metadata; avoid an eager read of every media ArrayBuffer.
- navigator.storage.estimate reports the origin's overall approximate usage, not exact Onda media bytes.
- If IndexedDB is blocked or unavailable, show “Storage inspection unavailable” rather than 0 bytes or “All files lost”.
- Support a manual Refresh; avoid scanning all large records on every keystroke or media play.
- Store lastAccess for new temporary records when created/played; 48 hours after *last use* is the proposed condition.
- No legacy records should be backdated into “temporary” merely because savedAt is older than 48 hours.
- Never delete a File from Android storage using a FileSystemFileHandle; only remove a saved browser cache record if user explicitly agrees.
- For files backing multiple playlist entries with same trackId, deleting a playlist must not orphan the media.
- Quota warnings should be based on actual write failure and estimates, not a hard-coded Android quota.

## 5. Position / visualiser events to bridge

| Source | Load | Play/Pause | Seek/Progress | End | Special concern |
|---|---|---|---|---|---|
| localAudio | HTML loadedmetadata | HTML play/pause events | currentTime, timeupdate, seeked | ended | Web Audio analyser connection; object URLs |
| streamAudio | HTML loadedmetadata if finite | HTML play/pause | may be live/unknown duration | ended where applicable | CORS, buffering, network errors |
| MIDI | OndaMidi.load parses blob | OndaMidi.play/pause (adapter) | OndaMidi.seek and adapter.currentTime | finishPlayback | Not a real HTML audio element; own scheduler |
| Quick Play (future) | local File in memory | Same suitable engine | ephemeral bookmark unless upgraded | session end | Must not silently persist large cache |

A shared PlaybackState bridge should expose: trackId, sourceKind, timeSec, durationSec, isPlaying, isSeekable, loaded, ended. It should **not replace** OndaMidi or route MIDI into a normal HTML audio element. The visualiser reads the bridge's state but must not control actual audio visibility/pausing.

## 6. Android shortcut / icon verification

Current source after approved icon change:
- Onda head includes favicon, SVG wrapper reference, Apple touch icon, manifest and theme color.
- The PNG is 192×192; the SVG is an image wrapper embedding that same raster. A true 512×512 PNG has **not** yet been published.
- To avoid blurred home-screen assets, add approved full-resolution PNG at 512 and verify 192/512, maskable safe zones and anti-aliased outer transparency.
- Test installed appearance and browser shortcut appearance as **separate** cases; names and icons may be cached by Android/Chrome.
- Do not fabricate a square background, alter gold/teal/charcoal artwork, or confuse Organon's lion branding with Onda.

## 7. Rollout gates

**Gate A — documentation reviewed:** action list + blueprint + mock-up agreed, old backups understood. No code changes.

**Gate B — visualiser and immediate playback:** visualiser no runaway idle loop; saved Library items Play without importing again; lock-screen/audio and MIDI unaffected. Resume position P3 does not block this gate.

**Gate C — read-only storage inspection:** measured cache total and statuses correct with old v2 records, no deletion. Mark ONDA-10 diagnostics complete but cleanup still planned.

**Gate D — Android source access:** test file/folder handles on actual phone; prove persistence or retain cache-first fallback. Only then change import defaults.

**Gate E — storage migration:** test v2→v3 additive upgrade and rollback, orphan preview, explicit protection of offline/legacy records, quota error path. No automatic cleanup before this.

**Gate F — user-reviewed drawer:** preserve existing icon configuration, settings, queue and other tabs. Approve layout and tap behaviour before release.

**Gate G — future online library:** cloud hosting/provider/security/permissions agreed; remote catalogue works offline-safe; no mistaken “streamable” status for reference links.

## 8. Open decisions to collect in short conversations

1. **Decided:** saved Library tracks must Play immediately; optional Quick Play only for new files. Keep current new-file import default.
2. **Answered:** Queue / Now Playing must be on the main Current screen; no Queue tab in the drawer.
3. **Deprioritised:** resume position is optional P3; no need to choose scope now.
4. Does Android Chrome currently use an installed standalone app, or just a shortcut that opens a browser tab? The icon/status cannot be confirmed from GitHub.
5. When a music file is deleted from the Library, should its cached browser media be retained until manual cleanup? Safest default: yes.
6. **Decided:** GitHub Pages public JSON catalogue and media; confirm only publicly distributable files are used.

## 9. Engineering sign-off format

For each implemented item, log:
- ID, relevant commit/PR, reviewer decision, source files changed;
- exact behavioural change and compatibility defaults;
- migration/data impact (none / additive / destructive);
- automated/test-profile results and Android hands-on outcomes;
- known browser limitations and how user can recover/relink;
- before/after measured evidence for performance claims;
- rollback commit, storage compatibility note and remaining defects.

## 10. External testing guidance

- Chrome File System Access API (including Android): https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- FileSystemHandle permissions: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission
- Storage quotas and persistence: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Storage usage estimates: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate
- Chrome page lifecycle: https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- Media Session OS transport: https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
- Manifest/app icon guidance: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons

## User placement decision (2026-11-23)

The **Current main workspace** owns Queue and Now Playing; the Library drawer is for library browsing/management. The former mock-up Queue tab has been removed. This is an approved requirement, not an open question. See tests CURRENT-01 through CURRENT-04.

## Decisions confirmed 2026-11-23

Saved Library Play must be a one-tap action. Quick Play applies only to new files. Resume position is P3 optional. GitHub Pages is the chosen public media host (static JSON + audio); no other provider needed unless limits require it. See PLAY-01/02/03 and NET-00/04/05.

## v3.11 implementation and verification checkpoint

The production code implementing ONDA-05 (visualiser gating), part of ONDA-07 (cache awareness/one-tap playback), ONDA-10 (read-only cache stats) and ONDA-12 (direct Reconnect) is committed. **Do not mark visualiser battery savings, Android background playback, cached music persistence, or the new file picker as PASS until physically tested.** The existing IDB schema is still version 2 and no auto-cleanup or data migration has occurred. The 21 isolated checks passed on 2026-11-23, including actual extracted canvas scheduler and source-status functions; this does not execute Chrome, IndexedDB on the user's phone, or Media Session runtime.

For the first Android smoke pass, prioritise PLAY-01/02/03, VIZ-01/02/03/05/06, ST-01/02/03 and BG-01/02, then inspect app version v3.11. Report whether the shortcut has actually installed or is a browser tab. Test Reconnect on an expendable example file only; never delete the user's primary library to simulate an error. [See release notes](./RELEASE_V3_11.md) for implementation and rollback.


## Storage optimisation v3.12 — additional QA coverage

These are new tests for the v3.12 code path; they do not imply prior Android tests have passed.

| Test ID | Action | Steps | Expected | Status |
|---|---|---|---|---|
| CACHE-01 | ONDA-07 | Import a new test MP3 | One File is stored using its stable ID and library metadata is saved | PASS isolated; needs browser |
| CACHE-02 | ONDA-07 | Reimport the identical file/ID | No second IndexedDB Blob put; track remains playable | PASS isolated; needs browser |
| CACHE-03 | ONDA-07 | Reimport changed timestamp, size or path | Cache record is replaced safely | PASS isolated; needs browser |
| CACHE-04 | ONDA-07 | Reimport file with missing/unreliable lastModified | Conservatively rewrites, never assumes match | PASS isolated |
| CACHE-05 | ONDA-07 | Corrupt the cached Blob in a disposable test DB | Reimport replaces malformed cache | PASS isolated; needs browser |
| CACHE-06 | ONDA-07 | Two import batches hit same ID concurrently | Writes are serialised, identical second file skipped | PASS isolated; needs browser |
| CACHE-07 | ONDA-11 | Import 10/100 mock files | Full library catalogue save only once before asynchronous caching | PASS static; browser timing pending |
| CACHE-08 | ONDA-11 | Rotate phone and open/close keyboard | Heavy library/preset save skipped on pure viewport resize, light UI checkpoint remains | PASS isolated; needs device |
| CACHE-09 | ONDA-11 | Hide or close tab after playlist edit | Normal meaningful save remains active | PASS isolated; needs device |
| CACHE-10 | ONDA-07/10 | Reopen old v2 IndexedDB cache with real Android media | All prior cached media, playlist entries and status preserved | NEEDS DEVICE |
| CACHE-11 | ONDA-07 | Trigger browser quota error on disposable test origin | Metadata survives; no false cache-success signal | NOT RUN |
| CACHE-12 | ONDA-07 | Inspect cache bytes after same-file reimport | Bytes stay stable; no claim that old unrelated duplicates were removed | NEEDS DEVICE |
| CACHE-13 | ONDA-07 | Simulate optional saved-record read failure while writes still work | Fallback writes selected file normally | PASS isolated; browser pending |
| CACHE-14 | ONDA-07 | Simulate cache write/quota error in a disposable test profile | Failed write is counted; no false success | PASS isolated; browser pending |

**No cleanup operation has been added.** Never clear site data, delete old audio cache records or upgrade IndexedDB merely to execute these tests. Use a disposable sample song for repeated import/modified-file checks.


## v3.13 optional Android file handles — tests and release gate

The module is implemented, but **test on actual Android Chrome** before relying on persistent access to users' original files.

| Test ID | Action | Expected | Status |
|---|---|---|---|
| FH-01 | Use Remember Files on Chrome Android | User selects new audio; normal catalogue/caching preserved and one handle saved | NEEDS DEVICE |
| FH-02 | Use Remember Folder (nested folder) | Relative file paths and track IDs preserved; playable content imported | NEEDS DEVICE |
| FH-03 | Reopen Chrome app after closing all tabs | Browser-stored handle persists; permission status checked without unexpected autoplay/modal | NEEDS DEVICE |
| FH-04 | Play with both handle and cached audio | Cached audio used first, no permission prompt | PASS isolated; device pending |
| FH-05 | Remove cache in **disposable test profile** while handle still authorised | Direct file handle supplies audio | PASS isolated; device pending |
| FH-06 | Revoke handle read permission then tap Play | Cache fallback or clear Reconnect; no unprompted read permission dialog | PASS isolated; device pending |
| FH-07 | Tap Reconnect when permission prompt is required | Explicit read permission requested from user tap; previous library ID remains | PASS isolated; device pending |
| FH-08 | Deny permission then tap Reconnect again | Manual file picker is available; no media erased | NEEDS DEVICE |
| FH-09 | Unsupported/insecure browser | Remember Files/Folder hidden, existing native file input still works | PASS isolated; browser pending |
| FH-10 | Folder with 3,501+ supported media files or excessive nesting | Clear error, no partial hidden import or deletion | NEEDS BROWSER |
| FH-11 | Select previously imported song from same relative path | Existing stable ID reused, no unrequested new library entry | NEEDS DEVICE |
| FH-12 | Select same-named file under different folder | No silent false match; separate IDs unless manually reconnected | NEEDS DEVICE |
| FH-13 | Check JSON/Netlify backup | No device-bound FileSystemFileHandle leaked to cloud or exported | PASS static; integration pending |
| FH-14 | Inspect old v2 music DB after linked import | Schema unchanged, all existing cached audio still playable | PASS static; device pending |
| FH-15 | Reconnect an original MIDI file | Original track ID, playlist and MIDI playback remain intact | NEEDS DEVICE |
| FH-16 | After Netlify release load Onda | Source version v3.13, new handle module loaded before core | PASS static; deployment pending |

**Release gate:** confirm FH-01/02/03/04/06/07/08/09/11/14 with disposable media on the user's actual Android phone. Retain cache-first as default; do not implement automatic cache reduction, deletion or v2 schema migration based on static tests alone. Source references and manual test details are in [RELEASE_V3_13.md](./RELEASE_V3_13.md).


## v3.14 read-only cache review — acceptance and release gate

| Test ID | Action / preparation | Expected | Status |
|---|---|---|---|
| AUDIT-01 | Open Settings → Storage and press Review Cached Audio | On-demand report shows total cached count/bytes without touching any music | PASS isolated; browser pending |
| AUDIT-02 | Scan test IndexedDB with several saved Files | Only `readonly` cursor used; Blob metadata accessed without reading audio bytes | PASS isolated |
| AUDIT-03 | Remove a disposable Library listing and inspect | Cache no longer linked to currently loaded listing **unless backed up or otherwise referenced** | NEEDS DEVICE |
| AUDIT-04 | A track exists only in current queue/history/playlist | Not considered unlinked | PASS isolated |
| AUDIT-05 | Track ID appears in old Library backup or last-good JSON | Protected from being called unlinked | PASS isolated |
| AUDIT-06 | Two test files share name,size,mtime,MIME but have different IDs | Candidate group shown; never labelled verified identical | PASS isolated |
| AUDIT-07 | Same filename with differing timestamp, size or MIME | Does not group as possible duplicate | PASS isolated |
| AUDIT-08 | Some cache entries have no actual File/Blob | Shown under unreadable/metadata-only; unknown bytes not treated as recoverable | PASS isolated |
| AUDIT-09 | Filename/path includes HTML special characters | Safely escaped in report; no script execution or injected controls | PASS isolated |
| AUDIT-10 | Press Review twice or after library change | New snapshot generated; disabled button guards concurrent runs | PASS isolated; browser pending |
| AUDIT-11 | IndexedDB access denied, failed or larger than 20,000 records | Informative error; no misleading partial totals or deletion | PASS isolated; browser pending |
| AUDIT-12 | Compare unlinked bytes with potential-duplicate surplus | Values separately labelled, never combined as guaranteed savings | PASS isolated |
| AUDIT-13 | Open on mobile portrait/landscape and desktop | Expandable details readable; main player and Current Queue unaffected | NEEDS DEVICE |
| AUDIT-14 | Inspect rendered report for controls | No delete, remove, archive, clear or automatic cleanup action | PASS static |
| AUDIT-15 | Reload v3.14 from actual public URL | New JS and CSS load; saved audio continues playing | NEEDS DEVICE / DEPLOY |
| AUDIT-16 | Verify privacy of real file paths | Only presented locally; no network upload of report or music | PASS static; network inspection pending |

**Release gate:** read-only review can be tested without destructive operations, but **cleanup must not be implemented** until the user has reviewed real Android findings, source availability and backup implications. Never clear actual Onda site storage or manually delete entries to force a test on the user's only copy. Refer to [RELEASE_V3_14.md](./RELEASE_V3_14.md).

## v3.15 Current-screen queue — mobile test checklist

| Test | Expected | Status |
|---|---|---|
| QUEUE-01 Ad-hoc imported tracks | Actual queue visible on Current without a saved named playlist | PASS isolated; NEEDS DEVICE |
| QUEUE-02 Empty queue | Clear action hint and usable Show/Hide queue toggle | PASS isolated; NEEDS DEVICE |
| QUEUE-03 Named saved playlist with ad-hoc queue additions | Actual queue rows, source playlist preserved | PASS isolated; NEEDS DEVICE |
| QUEUE-04 Play a non-current queued track | One tap plays existing track; no reimport | PASS isolated; NEEDS DEVICE |
| QUEUE-05 Remove earlier non-playing track | Current playing track/index unchanged; no Library or playlist deletion | PASS isolated; NEEDS DEVICE |
| QUEUE-06 Playing track | No Remove button for active track | PASS isolated |
| QUEUE-07 Info and Add to Playlist | Info inline does not change playing song, playlist assignment still works | PASS isolated; NEEDS DEVICE |
| QUEUE-08 Shuffle and repeat-all | No false deterministic upcoming order; wrap label correct | PASS isolated; NEEDS DEVICE |
| QUEUE-09 Mobile portrait/landscape 320/360/390/420px | Queue immediately under Now Playing, usable bounded scroll and controls | NEEDS DEVICE |
| QUEUE-10 Force-desktop mode on narrow window | Desktop presentation not overridden by mobile queue positioning | PASS CSS review; NEEDS BROWSER |
| QUEUE-11 Show/Hide queue after reload | Stored visibility setting respected without requiring a saved playlist | PASS isolated; NEEDS DEVICE |
| QUEUE-12 MIDI, stream, Android lock screen | Real media playback and Media Session unaffected | NEEDS DEVICE |
| QUEUE-13 HTML-special track names | Escaped, no arbitrary markup insertion | PASS isolated |
| QUEUE-14 View Current after restore/add | Updated list appears without opening Library drawer | PASS static; NEEDS DEVICE |

**Release gate:** verify v3.15 actually deployed and real Android queue UI/playback before declaring it mobile validated. There was no music data migration or deletion. [Release details](./RELEASE_V3_15.md).

## v3.16–v3.17 Mobile Library navigation and touch QA

| Test | Expected | Status |
|---|---|---|
| LIB-01 Search across drawer reopen | Search retains user input and no-match text, no delayed autofill reset | PASS static; NEEDS DEVICE |
| LIB-02 Search after switching view | Typing in Recents, Playlists or Icon Guide moves view to Results | PASS static; NEEDS DEVICE |
| LIB-03 Mobile views | Results, Recents, Playlists and Icon Guide visible with preserved custom icons | PASS static; NEEDS DEVICE |
| LIB-04 Playlist navigation | Saved playlist list and edit actions work with stored playlist records | PASS static; NEEDS DEVICE |
| LIB-05 Library Import & Storage | File picker opens from a real tap; Storage Health opens from shortcut without data loss | PASS source wiring; NEEDS DEVICE |
| LIB-06 Explicit Play and selection | Play remains explicit, row-body selection unchanged; Select toggles selection mode | PASS static; NEEDS DEVICE |
| LIB-07 Mobile filter grid | Only search and source filter reserve width; at 320/360/390/420px input is usable | PASS CSS source; NEEDS BROWSER |
| LIB-08 Clear-search control | Clear target 44px, search text not covered; no-match query can be cleared | PASS CSS source; NEEDS DEVICE |
| LIB-09 Header & drawer touch targets | Header Select/Settings/Close, source filter and bulk/settings actions use 44px hitboxes | PASS CSS source; NEEDS DEVICE |
| LIB-10 Select on/off accessibility | Real `aria-pressed`, title and visual enabled state reflect selection state | PASS isolated; NEEDS DEVICE |
| LIB-11 Icon Guide scroll and saved settings | Guide accessible, scrollable, custom icon values survive reload | PASS static; NEEDS DEVICE |
| LIB-12 Desktop regression | Desktop Library layout, original track actions, cloud sync and Current queue unaffected | PASS source scope; NEEDS BROWSER |
| LIB-13 Netlify version gate | Public app reports v3.17 and loads fresh assets without clearing site data | NEEDS DEPLOY / DEVICE |
| LIB-14 Android media regression | MP3, saved cache, Reconnect, Media Session screen lock/background and playback unchanged | NEEDS DEVICE |

**Release gate:** 28 v3.17 source checks are not runtime tests. Do not mark ONDA-14 finished until Android tab/installed shortcut and desktop computed-layout, touch/accessibility and audio playback checks are performed. No destructive cache or music-file tests against the user's primary storage.

## v3.18 Optional performance diagnostics — validation matrix

| Test | Expected | Status |
|---|---|---|
| PERF-01 First normal page load | No timing samples collected; no hidden networking; player unaffected | PASS source/isolated; NEEDS BROWSER |
| PERF-02 Start/Stop recording | Only explicitly enabled session records; stopped session stops growth | PASS isolated; NEEDS BROWSER |
| PERF-03 One-use startup reload | Deliberate reload arms startup timings once and clears sessionStorage flag | PASS isolated; NEEDS BROWSER |
| PERF-04 Snapshot privacy | Only whitelisted event names, durations, counts, viewport and UTC capture timestamp | PASS isolated; NEEDS BROWSER |
| PERF-05 Sensitive source labels | Filename, path, ID, URL, credential, arbitrary metric names rejected | PASS isolated |
| PERF-06 200-sample cap | Oldest samples dropped; memory buffer bounded | PASS isolated |
| PERF-07 Redacted export | Manual local JSON download only; no cloud sync/upload and no music bytes | PASS source; NEEDS BROWSER |
| PERF-08 LocalStorage catalogue restore | Records restore duration without changing saved music/metadata | PASS source; NEEDS DEVICE |
| PERF-09 IndexedDB restore/cache inventory | Records durations and counts, no media extraction/deletion | PASS source; NEEDS DEVICE |
| PERF-10 Search and Library rendering | Records slow/fast timings with counts; input and results unchanged | PASS source; NEEDS DEVICE |
| PERF-11 File import and audio batch | Measures preparation and cache writes separately with saved/skipped/failed counts | PASS source; NEEDS DEVICE |
| PERF-12 Play/track resolution | Measures successful track resolution and play response without private metadata | PASS source; NEEDS DEVICE |
| PERF-13 Visualiser frame sampling | Approx one of 60 frames timed when enabled, no full-frame logging when disabled | PASS source; NEEDS DEVICE |
| PERF-14 Full mobile/desktop regression | No changed transport symbols, lock-screen audio, storage permissions or Library persistence | PASS source scope; NEEDS DEVICE |
| PERF-15 Netlify deployment | Public code is v3.18 and new diagnostics module successfully loaded | NEEDS DEPLOY / BROWSER |

**Release gate:** These are *instrumentation* source checks, not actual performance benchmarks. Any future code optimization should use real, opt-in Android/desktop timings; a static source check cannot establish response time, battery use or lock-screen playback reliability.

## v3.19 Quick Play temporary file audition — acceptance matrix

| Test | Expected | Status |
|---|---|---|
| QP-01 Choose from Add | System file chooser opens only from tap/click; one audio file selected | PASS isolated; NEEDS DEVICE |
| QP-02 Mobile Library shortcut | Same chooser, returns to Add with temporary player visible | PASS isolated; NEEDS DEVICE |
| QP-03 No persisted track during audition | No new Library, queue, history, IndexedDB audio, cloud or JSON record; existing UI navigation preferences may still save normally | PASS source; NEEDS DEVICE |
| QP-04 Temporary audio | Blob URL created and native audio control plays, pauses and seeks | PASS isolated; NEEDS DEVICE |
| QP-05 Safe filename display | Filename inserted using textContent, never HTML/JS | PASS isolated |
| QP-06 Main audio coexistence | Preview pauses main; main playback stops preview (no overlapping sound) | PASS isolated; NEEDS DEVICE |
| QP-07 Replay/Discard | Replay uses selected File, Discard drops File, revokes object URL | PASS isolated; NEEDS DEVICE |
| QP-08 Navigate away or pagehide | Temporary playback stops and object URL is revoked | PASS isolated; NEEDS DEVICE |
| QP-09 Explicit Add | Only Add to Library + Queue calls normal importer, once | PASS isolated; NEEDS DEVICE |
| QP-10 Existing import compatibility | Normal Add Files, folder import, drop zone and saved-track Play unchanged | PASS source; NEEDS BROWSER |
| QP-11 MIDI/video and bad formats | No unintended import; user given feedback and existing Add option | PASS source; NEEDS DEVICE |
| QP-12 Media Session metadata | Temporary track is presented instead of last saved track while auditioning | PASS isolated; NEEDS DEVICE |
| QP-13 Media Session actions | Play/pause/seek/stop act on temporary audio, previous/next don't mutate saved queue | PASS isolated; NEEDS DEVICE |
| QP-14 Media Session recovery | Saved-track state returns when temporary preview stops | PASS isolated; NEEDS DEVICE |
| QP-15 Phone responsive controls | Quick controls fit portrait 320/360/390/420px and desktop layout | PASS CSS source; NEEDS DEVICE |
| QP-16 Source cache/deletion safety | No new cleanup, cache schema migration, source-file changes or device permissions | PASS source; NEEDS DEVICE |
| QP-17 Deployment/version | Live Onda serves v3.19 app-core, new Quick Play JS and Media Session CSS | NEEDS DEPLOY / BROWSER |
| QP-18 Android lock-screen and headphone | Background audio focus, seek/play/pause/stop verified on actual phone | NEEDS DEVICE |

**Release gate:** Quick Play intentionally bypasses permanent import *only* for auditioning. Do not claim Android media/codec compatibility, guaranteed background playback or cache persistence until device tests. No automatic cleanup of older media; preview has no persistent audio bytes.

## v3.20 Read-only on-device compatibility and release verification

| Test | Expected | Status |
|---|---|---|
| QA20-01 Initial load | No automatic permission prompts, audio play, storage mutation or file scanning | PASS isolated/source; NEEDS DEVICE |
| QA20-02 Explicit Run | Capability report appears only after pressing Run | PASS isolated; NEEDS DEVICE |
| QA20-03 Loaded source version | Actual deployed version shown; version mismatch flagged | PASS isolated; NEEDS DEPLOY |
| QA20-04 Picker APIs | Show only supported feature booleans, not permission grants | PASS isolated; NEEDS DEVICE |
| QA20-05 Media Session and codecs | Identify API presence and browser `canPlayType` hints; do not claim playback success | PASS isolated; NEEDS DEVICE |
| QA20-06 Source modules | Report Quick Play, performance diagnostics, Library, and player element availability | PASS isolated; NEEDS BROWSER |
| QA20-07 Manual tests default | All eight cases initially Not tested; no fabricated PASS values | PASS isolated |
| QA20-08 Manual test verdicts | Only Pass/Fail/Blocked/Not tested accepted; malformed values rejected | PASS isolated; NEEDS DEVICE |
| QA20-09 Report privacy | No filenames, track IDs, paths, credentials, userAgent or storage byte totals | PASS isolated |
| QA20-10 Export | Explicit local redacted JSON; export disabled until Run; object URL revoked | PASS isolated; NEEDS BROWSER |
| QA20-11 Storage guard | No localStorage, IndexedDB, sessionStorage, file picker, network or media playback operations in QA module | PASS source |
| QA20-12 Android saved playback | Previously cached files play after restart without unnecessary reimport | NEEDS DEVICE |
| QA20-13 Android screen lock | Regular and Quick Play Media Session controls operate when locked | NEEDS DEVICE |
| QA20-14 Quick Play source protection | Audition leaves Library, queue, history and cache unchanged until Add | NEEDS DEVICE |
| QA20-15 Library touch/responsive | Portrait/landscape controls usable with actual taps, keyboard and text size | NEEDS DEVICE |
| QA20-16 Normal Add and reconnect | Existing folder/file picker, import/cache, reconnect, desktop mode keep working | NEEDS DEVICE |
| QA20-17 Public deployment | Netlify actually serves v3.20 and the new device-qa.js module | NEEDS DEPLOY / BROWSER |

**Release gate:** 37 source-only tests cannot establish that an Android phone plays sound, retains file access across restart, or exposes reliable lock-screen controls. Use explicit manual verdicts from the user's real phone/desktop before marking those runtime scenarios passed.

## v3.21 UI-only checkpoint efficiency and persistence safety

| Test | Expected | Status |
|---|---|---|
| SAVE21-01 Library drawer open/close | No full Library/visualiser save; small UI preferences and after-toggle state kept | PASS isolated; NEEDS BROWSER |
| SAVE21-02 Drawer resize | Saves user UI dimensions through existing handler; no complete catalogue serialisation triggered | PASS source; NEEDS BROWSER |
| SAVE21-03 Mobile Library browse views | Changing Results/Recents/Playlists/Help persists current view without full catalogue/visualiser save | PASS isolated; NEEDS DEVICE |
| SAVE21-04 Workspace tab switch | Pre/post checkpoints keep active-tab UI key but do not serialise full Library | PASS isolated; NEEDS DEVICE |
| SAVE21-05 Quick Play from mobile Library | Opening temporary preview from drawer does not invoke full catalogue save through navigation | PASS source/isolated; NEEDS DEVICE |
| SAVE21-06 Visualiser input/blur | Still synchronises visualiser cards and saves full visualiser state and catalogue as before | PASS isolated; NEEDS DEVICE |
| SAVE21-07 Import/settings/export recovery | Original full-save/recovery semantics retained | PASS isolated; NEEDS DEVICE |
| SAVE21-08 Pagehide/beforeunload/visibility | Full Library checkpoint and existing IndexedDB flush paths still present | PASS isolated/source; NEEDS DEVICE |
| SAVE21-09 Lightweight state persists | Workspace, drawer browsing view and UI save metadata are still written for all 14 UI-only reasons | PASS isolated; NEEDS DEVICE |
| SAVE21-10 Duplicate checkpoint | Extra pre-close drawer UI checkpoint removed; one post-toggle checkpoint remains | PASS source; NEEDS DEVICE |
| SAVE21-11 Source integrity | v3.21 core compiles, cache-busted asset loaded, Quick Play bridge and transport preserved | PASS source; NEEDS BROWSER |
| SAVE21-12 Non-destructive preservation | No media files, IndexedDB schema, cache cleanup or playlist-metadata change | PASS source scope; NEEDS DEVICE |
| SAVE21-13 Measured performance gain | Record speed/storage metrics on actual Android/desktop via optional v3.18 diagnostics | NOT MEASURED |
| SAVE21-14 Public deployment | Netlify serves v3.21 and all new previous modules | NEEDS DEPLOY / BROWSER |

**Release gate:** 66 isolated assertions are evidence that the checkpoint function calls expensive save methods fewer times for navigation. They do not prove end-to-end device playback, persisted metadata survival, Android background audio, Netlify version or measured milliseconds of improvement.

## Repeatable Onda source regression suite — added 2026-11-23

**Test source:** [tests/onda-regression.test.mjs](../tests/onda-regression.test.mjs)  
**Local command:** `cd tools/Onda && npm test` (Node.js 22, no additional dependencies).  
**Continuous integration:** [.github/workflows/onda-regression.yml](../../../.github/workflows/onda-regression.yml); scoped to Onda changes on PRs, main pushes and manual runs.

The suite retains five top-level Node tests: (1) script parse/version/order/transport symbols; (2) navigation-only vs real-data save paths, including all 14/13 isolated checkpoint scenarios; (3) temporary Quick Play lifetime, no implicit import, explicit import and object URL cleanup; (4) Media Session route isolation and return to saved playback; (5) device QA opt-in, manual statuses and redacted export. The five tests also **passed on GitHub Actions using Node.js 22** in [workflow run #45216940426](https://github.com/cinaedvsstudios/Organon/actions/runs/45216940426) for PR #185 (5 passed, 0 failed). The external runtime checks remain separate.

These tests are **source and mocked-browser** checks. They do not establish that a real Android phone plays audio after reloading, that permission grants persist, that screen-lock/headset controls work, that a Netlify deployment succeeded or that real performance meets targets.

Do not treat Actions green as physical-device acceptance. Continue using v3.20's read-only device QA panel and v3.18 opt-in timing tools on actual Android and desktop.

## v3.22 correct loaded-version reporting

| Test | Expected | Status |
|---|---|---|
| V22-01 Loaded version | QA shows app-core's actual `v3.22` rather than a `v3.20` hardcoded QA version | SOURCE FIX; NEEDS DEPLOY |
| V22-02 Redacted export | `sourceVersion` and `capabilities.loadedVersion` equal the loaded version | SOURCE FIX; NEEDS DEVICE |
| V22-03 Future-version resilience | Cached older QA module reports a different valid app version, not a false mismatch | SIMULATED; NEEDS BROWSER |
| V22-04 Malformed version | HTML, long or invalid version values return `unavailable`; never enter export | SIMULATED; NEEDS BROWSER |
| V22-05 Repeatable test longevity | CI reads the current source version and matching HTML asset query without hard-coded v3.21 | PASS GitHub Actions Node 22 (run #45229083186) |
| V22-06 Playback/cache safety | Onda music, IndexedDB, File System Access, Quick Play and Media Session unchanged | CODE SCOPE; NEEDS DEVICE |
| V22-07 Netlify production | A live browser actually serves v3.22 and both revised JS assets | NEEDS DEPLOY / BROWSER |

A successful source or GitHub Actions run is not evidence of Android playback, browser storage persistence, or live production deployment.

## Actual Chromium browser smoke — source v3.22 (2026-11-23)

**Automated run:** [GitHub Actions Onda source regression QA #45235601393](https://github.com/cinaedvsstudios/Organon/actions/runs/45235601393): Node isolated source suite **PASS**, actual Chromium smoke **PASS**. An earlier browser run initially missed a download while Onda's normal startup prompts appeared, then confirmed the download worked but was blocked when those same overlays covered Settings. The test now explicitly selects **Continue Local Only** and **Continue Empty** in its disposable first-run browser profile; it does not bypass or alter Onda's normal recovery protections.

| Test | Actual Chrome observation | Status |
|---|---|---|
| BROWSER-01 | New browser origin starts Onda v3.22, existing 🧿 ⏮ ⏭ controls intact | PASS actual Chromium |
| BROWSER-02 | Settings → Storage Health → Device QA Run shows loaded version and absent manual verdicts | PASS actual Chromium |
| BROWSER-03 | Browser generates/downloads redacted QA JSON with correct source version and no secrets | PASS actual Chromium |
| BROWSER-04 | Generated three-second WAV decodes and currentTime advances during native temporary Quick Play | PASS actual Chromium |
| BROWSER-05 | Quick Play and Discard leave IndexedDB audioFiles count unchanged | PASS actual Chromium |
| BROWSER-06 | Explicit Add populates the isolated audio cache and persists after page reload | PASS actual Chromium |
| BROWSER-07 | Mobile-emulated viewport/touch opens Library drawer and accepts search input | PASS actual Chromium, mobile emulation only |
| BROWSER-08 | Android hardware, file-picker persistence, screen lock/Bluetooth, battery and live production Netlify | NEEDS DEVICE / DEPLOY |

The new `tests/onda-browser-smoke.browser.mjs` is invoked after `npm test` from [.github/workflows/onda-regression.yml](../../../.github/workflows/onda-regression.yml). The runner uses a 127.0.0.1 test server, pinned Playwright core, a fresh Chrome profile and synthetic media. **No Onda application behaviour or version was changed by this infrastructure-only PR.** A successful local Chromium test does not establish production Netlify deployment or Android OS-specific behaviour.

## Real browser restore-and-play regression extension (2026-11-23)

**Run:** [GitHub Actions #45245006631](https://github.com/cinaedvsstudios/Organon/actions/runs/45245006631). Both original source regression and real Chromium browser jobs completed successfully.

| Test | Actual Chrome observation | Status |
|---|---|---|
| BROWSER-09 Library metadata restore | Synthetic WAV remains visible in Library after reload, marked cached/ready | PASS actual Chromium |
| BROWSER-10 No unnecessary reconnect | Previously imported audio shows no Reconnect button after a reload | PASS actual Chromium |
| BROWSER-11 Offline cached playback | With network disabled after page load, saved track decodes from `blob:` and playback time advances | PASS actual Chromium |
| BROWSER-12 No duplicate cache write | Playing restored track leaves IndexedDB `audioFiles` count unchanged | PASS actual Chromium |
| BROWSER-13 Android hardware-specific recovery | Actual Android cold start offline, File System Access grant persistence, screen lock, battery | NEEDS DEVICE |

This is a **test-only change** on the user's disposable localhost Chrome profile; no live user file/Library/profile is read or modified, and no code changes are made to Onda's playback/storage engine. The app remains **v3.22**.

## Real Chromium missing-audio / manual Reconnect regression (2026-11-23)

[GitHub Actions #45256546568](https://github.com/cinaedvsstudios/Organon/actions/runs/45256546568) passed all existing source tests and the expanded Chromium suite. A **separate disposable browser profile** imported one metadata-only synthetic local track, with no cached audio or linked filesystem handle.

| ID | Observation | Result |
|---|---|---|
| BROWSER-14 | Metadata-only Library import persists after reload without an audio cache write | PASS actual Chromium |
| BROWSER-15 | Missing audio is labelled **needs relink** and offers Reconnect | PASS actual Chromium |
| BROWSER-16 | Play on missing media shows a warning and preserves track, tags, notes and playlist; no duplicate imported | PASS actual Chromium |
| BROWSER-17 | Explicit Reconnect launches Chrome's genuine filechooser for user-selected synthetic audio | PASS actual Chromium |
| BROWSER-18 | Reconnected file decodes/plays with original track ID, one cache entry, and preserved notes/playlist | PASS actual Chromium |
| BROWSER-19 | After reload, reconnected audio is recognised as cached/ready and no Reconnect is needed | PASS actual Chromium |
| ANDROID-RECONNECT | Actual Android picker permission grant/denial, remembered handles, filename mismatch, relink after phone restart | STILL NEEDS DEVICE |

These tests make no changes to Onda's real runtime, browser storage scheme or playback engine. The synthetic Library and file exist only in an isolated Chrome test profile, with no user data, no Netlify account access and no user-cache deletion. **Onda remains v3.22**.

## Browser-persisted handle, permission denial and Reconnect fallback (2026-11-23)

[GitHub Actions run #45270809740](https://github.com/cinaedvsstudios/Organon/actions/runs/45270809740) passed both Onda jobs: five source regression groups and actual Chromium desktop/mobile-emulated smoke checks with the new independent remembered-handle scenario.

| ID | Actual Chrome test condition | Status |
|---|---|---|
| BROWSER-20 | Synthetic WAV written to test-only OPFS and its true FileSystemFileHandle stored in Onda file-handle IndexedDB | PASS actual Chromium |
| BROWSER-21 | Browser reload restores structured-cloned handle; linked track plays offline directly without writing an audio cache copy | PASS actual Chromium |
| BROWSER-22 | **Simulated** read-permission denial makes silent read return null; normal Play does not request permission | PASS Chromium + simulated denial |
| BROWSER-23 | With denial, Onda displays saved-audio-unavailable/needs-relink warning and retains Library metadata | PASS Chromium + simulated denial |
| BROWSER-24 | First explicit Reconnect requests read permission; if denied Onda prompts for another explicit reconnect | PASS Chromium + simulated denial |
| BROWSER-25 | Second explicit Reconnect opens real Chrome filechooser; synthetic WAV reattaches without duplicate ID, preserving notes/playlist | PASS Chromium + simulated denial |
| ANDROID-HANDLES | Android OS picked-file/folder permission after restart, permission denial, Bluetooth/lock-screen and phone battery | NEEDS PHYSICAL DEVICE |

**Scope:** No app code changes, no version bump (Onda stays **v3.22**). Test media and handle reside only in a disposable localhost browser profile, not the user's Android files or production site. OPFS handles have different permission behaviour from externally picked Android file handles, and denial was instrumented specifically for the regression test. Do not mark hardware Android criteria as passed.

## Real Chromium Media Session and background-visibility routing (2026-11-23)

[GitHub Actions #45277569315](https://github.com/cinaedvsstudios/Organon/actions/runs/45277569315): existing source tests and new actual-Chromium Media Session audio tests passed. Real Chrome registered all eight Onda system action handlers. Tests invoke these registered callbacks against native browser audio playing synthetic WAVs, **not physical system media keys**.

| ID | Test evidence | Status |
|---|---|---|
| BROWSER-26 | Chrome registers play, pause, stop, seekto, seekbackward, seekforward, nexttrack, previoustrack | PASS real Chromium |
| BROWSER-27 | Saved WAV system play/pause, metadata, direct seek and ± offset seek | PASS real Chromium |
| BROWSER-28 | Two imported WAV tracks switch by next/previous; Media Session metadata follows the track | PASS real Chromium |
| BROWSER-29 | Synthetic hidden/visible `visibilitychange` event does not pause or stop advancing audio | PASS simulated visibility in real Chromium |
| BROWSER-30 | Quick Play captures system controls and metadata; pause/play/seek use preview, not saved main audio | PASS real Chromium |
| BROWSER-31 | Next/previous during preview leave saved queue unchanged; no media imported to persistent cache | PASS real Chromium |
| BROWSER-32 | Stop preview releases temporary source, restores main metadata and system Play resumes main track | PASS real Chromium |
| ANDROID-BG | Real Android screen lock, app switching/background throttling, Bluetooth/headphones, notification controls and battery | NEEDS PHYSICAL DEVICE |

**Scope:** Onda source remains **v3.22**. This PR changes only automated tests and QA documentation. Generated audio, private localhost context, no access to user's media/cache or production Netlify app. Background state was simulated by dispatching a visibility event; genuine Android OS process/background behaviour cannot be established from this.

## v3.23 real Chromium offline COLD START (after online install) — 2026-11-23

**Evidence:** [GitHub Actions run #45280311658](https://github.com/cinaedvsstudios/Organon/actions/runs/45280311658) completed **both** Node source and real Chromium tests successfully. All previously passing Chrome saved-audio, missing/reconnect, file handles, permission-denied and Media Session paths remain passing. Source bump: **v3.23**, release details in [RELEASE_V3_23.md](./RELEASE_V3_23.md).

| ID | Actual Chrome observation | Result |
|---|---|---|
| BROWSER-33 | First online session registers `onda-sw.js`, installs worker and precaches complete static Onda shell | PASS real Chromium |
| BROWSER-34 | Shell cache includes exact-version `index.html`, linked JS/CSS, MIDI, icons and manifest, with no media, personal Library JSON or cloud responses | PASS real Chromium + Node allowlist |
| BROWSER-35 | Synthetic WAV explicitly saved to real IndexedDB audioFiles; Chrome process then fully closed | PASS real Chromium |
| BROWSER-36 | Reopened same disposable Chrome profile, set network OFF **before** first Onda page navigation; app shell and runtime v3.23 loaded | PASS real Chromium cold start |
| BROWSER-37 | Recovered Library entry still cached and WAV plays with a real blob URL and advancing playback position, without duplicate writes | PASS real Chromium cold start |
| BROWSER-38 | Unknown offline JSON route does not get a misleading HTML/JSON shell fallback; worker's cache contents unchanged | PASS real Chromium |
| ANDROID-OFFLINE | First online PWA install on user's actual phone, then airplane mode / phone restart / app shortcut; storage eviction and remote streaming exclusions | NEEDS PHYSICAL DEVICE |

**Safe scope:** User audio is stored only via Onda's existing IndexedDB import, **not the new Cache Storage app shell**. Service worker only claims its Onda directory and deletes caches with its own `onda-static-shell-` prefix during updates. No changes to Library/IndexedDB schema, source files, file handles, cloud sync or player engine. Test Chrome profile is generated in a temporary folder and destroyed afterward. This does **not** prove cold first-ever offline installation, Android OS background process or live Netlify deployment.

## v3.24 safe offline shell upgrade across browser restarts (2026-11-24)

[Successful GitHub Actions run #45336933380](https://github.com/cinaedvsstudios/Organon/actions/runs/45336933380): source regression and real Chromium tests green. The test profile is isolated; the source worker under test is a pinned copy of the **actual shipped v3.23** worker, not an invented stub. A synthetic WAV and unrelated cache entry are the only test data.

| ID | Actual Chromium condition | Status |
|---|---|---|
| BROWSER-39 | v3.23 worker/source installed; WAV imported into IndexedDB; unrelated cache stored | PASS Chromium |
| BROWSER-40 | New v3.24 worker available but one required asset returns HTTP 503; update fails without activating or deleting old active shell | PASS Chromium |
| BROWSER-41 | Chrome process fully closed/reopened with origin unavailable and network offline; v3.23 app and saved audio survive failed update | PASS Chromium |
| BROWSER-42 | All linked static JS/CSS/icons/manifest/MIDI are release-versioned as `?v=3.24`; older worker cannot match them to v3.23 shell cache | PASS source + Chromium |
| BROWSER-43 | New static files are installed under protected `onda-staged-shell-v3.24` and don't require forcibly interrupting existing Onda clients | PASS source + Chromium |
| BROWSER-44 | Upgraded app uses v3.24 CSS with previous audio/Library still intact | PASS Chromium |
| BROWSER-45 | After entire browser closes and reopens offline, v3.24 is active, saved WAV plays, old active shell and temporary stage are gone, unrelated cache survives | PASS Chromium |
| ANDROID-UPGRADE | Netlify production live release, Android Chrome/PWA worker lifecycle, real phone offline/reboot, system media keys and device storage | NEEDS DEVICE / DEPLOY |

**Safety:** Failed installs may retain unactivated temporary staged assets for retry, but never publish them as a working app. On activation, the worker verifies and promotes all required staged assets before deleting **only** old `onda-static-shell-` caches. No user's audio/IndexedDB, file handles, playlists, original media or cloud data are removed. The actual music player/library engine is unchanged; Onda source version **v3.24**. See [RELEASE_V3_24.md](./RELEASE_V3_24.md).
