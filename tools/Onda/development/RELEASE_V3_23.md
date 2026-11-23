# Onda v3.23 — Offline app-shell startup and recovery

**Source date:** 2026-11-23  
**Change:** New same-scope service worker for a narrow, versioned **static Onda app shell**. **Previous release:** [v3.22](./RELEASE_V3_22.md).

## Why this update was necessary

Onda v3.22 could successfully reopen and play locally cached audio **after the app page had loaded**. However, the app had a Web App Manifest but **no registered service worker**. A saved IndexedDB audio file cannot load the HTML, JavaScript and CSS of a site when Chrome starts with networking disabled. The distinction matters for offline travel and an installed Onda shortcut.

## New behaviour

- `index.html` registers `./onda-sw.js` only in a secure browser context and scopes it to the deployed Onda directory. No broad root-origin capture of unrelated Organon tools.
- Once the app has been visited online and the service worker has finished installing, its **v3.23** app shell can open from the same browser profile while offline.
- The worker precaches **only explicitly allowlisted, exact-version static assets**: the app entry HTML, existing linked CSS and JS modules, MIDI engine, web app manifest and app icons.
- App navigation is **network-first** so an available online homepage is served normally; it falls back to the previously installed app shell when offline.
- Precached static scripts/styles use exact requested URLs, including query versions. Unknown/new versions and other URLs are **not** silently replaced with stale scripts.
- Unlisted requests — user files, audio, remote streams, local Library JSON files, Netlify cloud endpoints and data URLs — are **not cached or intercepted**.
- A successfully installed newer shell cleans up only caches with the `onda-static-shell-` prefix. It does **not** clear IndexedDB music, playlists, OPFS, remembered file handles, user audio or other Cache Storage keys.
- The app core reports **v3.23**, with the matching `js/app-core.js?v=3.23` query.

An **initial online visit is necessary** to install the app shell. A first-ever offline visit cannot work, and a browser may remove site storage under storage pressure or user action. Remote streams and cloud sync still require a network. No claim is made that installation persistently survives Android browser eviction or that background playback is guaranteed.

## Actual Chromium regression evidence

[GitHub Actions #45280311658](https://github.com/cinaedvsstudios/Organon/actions/runs/45280311658) passed both the updated dependency-free Node source test suite and real Chrome browser integration job.

The browser test used a disposable **persistent Chrome profile** (not the user's normal Chrome). It installed and activated the service worker during an initial online visit, verified the shell cache contains HTML, CSS, all linked scripts and icons but no audio/cloud data, then explicitly imported one synthetic 12-second WAV into the real Library/IndexedDB audio cache. The test **closed the entire Chrome process**, reopened the same disposable profile, **disabled network access before reopening the Onda URL**, verified Onda v3.23 loaded from the service worker, and played the restored WAV from IndexedDB with real decoded duration and advancing audio position. Replaying did not duplicate cache entries, and an unrelated JSON URL was not returned as fake HTML by the worker.

All previous tests (temporary preview, reconnect, persisted handles, simulated permission denial, Media Session callbacks, synthetic visibility and mobile viewport) passed unchanged.

## Safety and device acceptance

Tests run entirely on localhost and synthetic data in runner-created Chrome profiles; they never access the user's music, real site profile, cloud secret or Android filesystem. No audio engine, Library schema, source-file permissions, remote stream service or media cleanup was changed.

**Not yet proven:** live Netlify production deployment, physical Android Chrome/PWA cold start with airplane mode enabled, after actual device reboot or storage eviction, audio notification/lock-screen, and Bluetooth/media key behaviour. Validate those separately before marking Android release gates passed.

**User check after v3.23 is deployed:** visit Onda once while online; confirm the displayed loaded version is v3.23 in the Device QA panel; allow the initial page to load; close Onda, switch on airplane mode, and reopen the **same Onda site/shortcut**. If that fails, do not clear site data (it may contain saved audio). Record the error and whether Onda was previously opened online.
