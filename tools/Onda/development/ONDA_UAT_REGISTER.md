# Onda — Cologne user acceptance testing register

Updated 2026-11-26. Application baseline **v3.41**. This register is the current manual acceptance/issue tracking record; older action list, implementation blueprint and migration matrix remain historical technical evidence.

## Baseline evidence

- [Onda v3.41 source commit](https://github.com/cinaedvsstudios/Organon/commit/cf7e8d66853debfa0a51444889f1a26e42325f27).
- [Regression run 45749356463](https://github.com/cinaedvsstudios/Organon/actions/runs/45749356463): six Node test groups passed, zero failures; actual Chromium desktop and mobile-emulated smoke job passed.
- [GitHub Pages deployment 45749356419](https://github.com/cinaedvsstudios/Organon/actions/runs/45749356419): build, reporting and deployment jobs succeeded. Independent live HTTP/runtime version was not confirmed by this review; verify on the phone. Later unrelated repo Pages builds may occur.
- Browser tests confirmed fresh local startup without cloud/recovery prompts; staged metadata edit/undo/redo/save; offline saved audio; safe reconnect and permission-denied fallback; Media Session callbacks; failed v3.41 worker update preserves old v3.40 shell/media; successful v3.41 offline browser restart preserves music. Synthetic audio and disposable profiles only.
- No physical Android device acceptance results supplied for v3.41 yet.

## Manual checklist

Use the original user-assigned test numbers throughout. Automated evidence is not user acceptance. All manual verdicts below are pending until the user reports a result.

| No. | Test | Manual verdict | Existing evidence / remaining verification |
|---|---|---|---|
| 1 | Startup without unnecessary popups | Pending | Fresh local Chromium startup passed; existing user profile and phone pending. |
| 2 | Correct version displayed in Settings | Pending | Runtime v3.41 and QA panel checked in Chromium; Settings display on actual device pending. |
| 3 | Interface zoom and middle panel resizing | Pending | Manual desktop/mobile pending. |
| 4 | Settings popup dragging, resizing and closing | Pending | Manual desktop/mobile pending. |
| 5 | General appearance and visual consistency | Pending | Manual desktop/mobile pending. |
| 6 | Drawer navigation on desktop and mobile | Pending | v3.41 source change committed; complete navigation manual acceptance pending. |
| 7 | Drawer opening, closing and scrolling | Pending | Mobile-emulated drawer opening passed; closing/scrolling manual pending. |
| 8 | Library search and mobile keyboard behaviour | Pending | Mobile-emulated touch search passed; physical Android keyboard pending. |
| 9 | Track selection | Pending | Manual selection workflow pending; saved playback tested separately. |
| 10 | Landscape layout | Pending | Physical device and desktop manual pending. |
| 11 | Quick Play | Pending | Chromium temporary playback/media-session routing and saved queue preservation passed; physical device pending. |
| 12 | Bulk Metadata Editor | Pending | Chromium staged edit, undo, redo, save and unchanged audio count passed; manual usability pending. |
| 13 | Playlist duplication and reordering | Pending | v3.35 committed; manual acceptance pending. |
| 14 | Playlist appearance | Pending | v3.36 styling committed; manual acceptance pending. |
| 15 | Travel Check | Pending | v3.34 read-only inventory committed; actual library review pending. |
| 16 | Storage Health | Pending | QA panel and redacted download checked; actual library health pending. |
| 17 | Visualiser | Pending | Manual appearance, CPU/battery and resume checks pending. |
| 18 | Offline cold startup and playback | Pending | Chromium full offline restart and saved WAV playback passed; actual Android pending. |
| 19 | Background and lock-screen playback | Pending | Chromium Media Session callbacks and synthetic visibility passed; actual OS lock/background pending. |
| 20 | Bluetooth headphone controls | Pending | Physical hardware pending. |
| 21 | Persistence after phone restart | Pending | Chromium full browser restart passed; actual phone reboot and file permissions pending. |
| 22 | Performance and responsiveness | Pending | Real-library responsiveness/battery measurements pending. |

## Outstanding issues and retests

No new user-reported defects have been supplied in this continuation. Record each as a numbered issue with checklist number, platform/version, observed vs expected behaviour, severity, status, fix commit, regression result and manual retest verdict. Do not treat pending tests as confirmed bugs. Prioritise playback, offline availability, data preservation and navigation before travel.

## Release rules

- GitHub Pages only; Netlify allowance exhausted. Origins have separate browser storage; do not assume media saved under another origin transfers automatically.
- Drawer is the main navigation on desktop and mobile; Add, History, Playlists inside it. Current playback and queue remain on main screen; Stream hidden.
- No automatic cloud setup; recovery prompt only with evidence of missing previously saved music.
- Preserve bronze, charcoal, blue and existing playback symbols; no destructive migration or deletion of music, playlists, metadata or settings.
- Each runtime fix: direct repository update, increment version, align service-worker and static asset versioning, verify regression and Pages deployment. Documentation-only changes do not change the app version.
- Do not clear site data to update. Close all Onda tabs/installed app windows and reopen online; check version before testing offline.
- Deferred until after Cologne: replacement cloud sync, online music library, playback position restoration, automatic playlists, additional streaming.

## Related historical records

- [Mobile action list](./ONDA_MOBILE_ACTION_LIST.md)
- [Implementation blueprint](./ONDA_IMPLEMENTATION_BLUEPRINT.md)
- [QA migration matrix](./QA_MIGRATION_MATRIX.md)

## Change log

- 2026-11-26: established v3.41 baseline from source commit and actual GitHub Actions results. Manual feedback pending. No application files changed.

- 2026-11-26 — UAT-001 (tests 3, 5, 6): user Android screenshot shows cropped bottom navigation, excessive player height and old globe navigation. Screenshot may be from older cached UI; exact loaded version unknown. v3.42 makes mobile footer an in-flow flex child, reduces player/side padding, restores visible Current label, guards legacy Stream routing and adds geometry checks at 70/100/130% zoom. Status: source fix; CI, deployment and physical Android retest pending. No storage changes.

- 2026-11-26 — UAT-001: user reports improved main screen in v3.42 screenshot; GitHub Actions regression 45750193796 and Pages 45750193780 passed. UAT-002 (5,6,7,8,9): drawer screenshot shows duplicate navigation, excessive gaps and persistent bulk action buttons. v3.43 introduces one labelled navigation row, adjacent search/filter, hidden selection/tools by default, a single content scroll area, and an opaque drawer. Legacy tools/custom icons remain accessible on demand. Physical retest and new CI pending.

- 2026-11-26 — UAT-003 (5,6,7,13,14): user requests separate Now Playing and Queue main tabs and real Add/History/Playlists inside drawer, not shortcuts closing drawer. v3.44 physically relocates existing panes, separates routing and hides legacy visibility pills; adds Chromium assertions. Data/storage unchanged; CI and physical retest pending.

- 2026-11-26 — UAT-003: v3.44 regression 45751155960 and Pages 45751155578 passed. User screenshot confirms separate Queue tab in use. UAT-004 (5,11,22): Quick Play limited to single picker file; queue nested borders/scrolling and overlapping labels. v3.45 enables temporary batch selection, track selector and explicit Add All via existing importer; normal multi-file Add preserved. Queue flattened, repeated filename moved to existing Info, queue marquee disabled and row geometry tested. No existing music or settings deleted. CI/device retest pending.

- 2026-11-26 — UAT-004: v3.45 regression 45751793887 and Pages 45751793499 passed. User screenshot confirms flat queue but requests original outer border retained. v3.46 restores one bronze rounded workspace card with compact 8px padding; inner queue/list remain unframed with a single scrolling surface. Added browser assertion for exactly this framing. No playback or storage behaviour changes; CI/device retest pending.
