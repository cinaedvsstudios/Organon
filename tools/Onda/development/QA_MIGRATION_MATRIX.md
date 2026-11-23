# Onda — Android QA, Migration Safeguards and Release Checklist

**Version:** QA v1.1 for Onda v3.11 · 2026-11-23  
**Status:** 21 static/isolated code checks passed; all physical Android, live deployment and true audio tests **remain unverified**. See [v3.11 release note](./RELEASE_V3_11.md).  
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
