# Onda v3.24 — Safe staged service-worker upgrades

**Source date:** 2026-11-24  
**Previous release:** [v3.23 offline startup](./RELEASE_V3_23.md)

## Confirmed update risk in v3.23

Onda v3.23 successfully installed an offline shell, but several HTML-linked CSS/JS files used unversioned or older-version URLs. An old service worker could serve a stale static file alongside newer online HTML while the next release was rolling out.

The v3.23 worker also removed older caches whose names began with `onda-static-shell-` on activation. If a new release staged its pending assets under that same prefix, an older worker could erase that new cache while the new worker was still installing. Real Chromium upgrade runs reproduced a missing/empty candidate cache and prompted a safer installation design.

## v3.24 behaviour

- **One version for every linked static asset:** All Onda HTML-linked CSS, JS, MIDI engine, manifest and icon URLs use `?v=3.24`. The new app core announces `v3.24`. An old v3.23 worker cannot accidentally serve an older exact-URL cache entry for these newer requests.
- **Protected staging:** The v3.24 service worker downloads an exact allowlist into `onda-staged-shell-v3.24`, deliberately outside the v3.23 worker's `onda-static-shell-` cleanup prefix. It never stages user audio, remote streams, personal Library JSON or Netlify cloud data.
- **Failure safety:** If a required static asset fails (including HTTP 503), the candidate worker does not activate and the previous working offline shell remains. An incomplete temporary staging cache may remain until retry; it is not served as the active shell. Retries repopulate the required allowlist.
- **Do not interrupt an open player:** A first-time installation may use `skipWaiting()`; **an update with an existing active worker stays waiting** until controlled Onda clients close. The app does not forcibly reload or pause music on upgrade.
- **Promotion on activation:** Once an update can activate, it verifies all staged responses, copies them into the current `onda-static-shell-v3.24` cache, and **only after successful promotion** removes previous Onda active-shell caches and the temporary stage. No other named caches, IndexedDB audio files, file handles, playlists or cloud profiles are deleted.
- **Offline and online:** The worker still uses network-first navigation for the app entry and exact-version cache matches for static files. New releases need an online visit to install; a first-ever offline visit cannot work.

## Real browser regression evidence

[GitHub Actions #45336933380](https://github.com/cinaedvsstudios/Organon/actions/runs/45336933380) passed the source and actual Chromium jobs, including this extended test in a new **disposable** Chrome profile:

1. Serve the pinned *actual v3.23 service worker* and its matching asset URLs, open Onda, save synthetic WAV audio in its real IndexedDB, and add an unrelated browser cache record.
2. Simulate a broken deployment of the newer v3.24 worker where one required CSS file returns HTTP 503. Verify the candidate installation fails but the old v3.23 shell, unrelated cache and audio survive.
3. Completely close Chrome; restart the **same** disposable profile offline with the test origin unavailable. Verify the old v3.23 app can still open and its cached audio remains.
4. Restore a complete online v3.24 deployment and stage the new shell. Confirm the original audio/other data persist and the app can load the new `?v=3.24` CSS rather than old worker content.
5. Close Chrome and reopen the same profile offline again. Verify the active app is now **v3.24**, only its new active Onda shell cache remains, the staging cache is gone, unrelated Cache Storage persists, and the saved WAV actually plays with advancing browser audio time.

Earlier actual-Chrome tests for preview/import separation, cache restoration, missing-media Reconnect, remembered handles, simulated permissions, Media Session and emulated mobile UI also passed.

## Scope and remaining device checks

This release changes **only the static app-shell upgrade mechanism, URLs, version number and tests/docs**. It does not alter existing music, Library schema, streaming, audio playback engine, browser file permissions, cloud secrets or delete/cleanup media.

Chromium on a disposable local test origin is **not** physical Android verification. On the phone, verify first online visit, install/update, airplane-mode restart, browser/PWA shortcut after closing, battery/lock-screen/Bluetooth and actual Netlify production version separately. Do **not** clear the site's storage when troubleshooting: that can delete the browser music cache.
