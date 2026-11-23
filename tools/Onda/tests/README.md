# Onda regression tests

This is Onda's first committed, repeatable source/isolated-runtime test suite. It runs on **Node.js 22** without third-party test dependencies.

From `tools/Onda`, run:

```bash
npm test
```

Or, from the repository root:

```bash
node --test tools/Onda/tests/*.test.mjs
```

The scoped [Onda source regression QA workflow](../../../.github/workflows/onda-regression.yml) runs this same command when `tools/Onda/**` or the workflow itself changes in a pull request or on `main`, and can also be run manually.

## Covered behaviours

- All currently shipped Onda JS source files parse; the HTML keeps the expected script loading order, player icons and Onda v3.21 code/asset identity.
- The actual `saveLocalUiStateCheckpoint` function skips full visualiser/library writes for 14 layout/navigation-only scenarios, but still saves lightweight UI keys.
- The same function retains full save calls for 13 meaningful changes and recovery situations, and the source retains the pagehide/visibility and new-file import saves.
- Temporary Quick Play picks one audio file, pauses the main player, creates/revokes browser object URLs, supports Replay and Discard, rejects MIDI from audition and calls the normal importer **only** after explicit Add.
- Media Session temporarily routes Play/Pause/Seek/Stop to the audition rather than changing the saved queue, then returns to saved playback.
- Device QA never runs automatically, keeps its fixed manual tests untested until the user marks them, and only exports a redacted capability/results report after an explicit Run.

These tests use **in-memory fake browser elements**. They never read a real phone's music, browser cache, file handles, Library database, cloud secrets or localStorage. They make no network requests and do not delete audio.

## Limits

A green GitHub Action confirms a repeatable *source and simulated runtime* check. It does **not** prove that Onda is deployed to Netlify, that Chrome on an Android device retains permissions, that Bluetooth/lock-screen playback works, that an actual MP3 can be decoded, or that a large Library loads quickly. Those checks remain in [the Android QA matrix](../development/QA_MIGRATION_MATRIX.md) and must be marked using genuine device observations.

When changing Onda, extend this suite for the affected feature. Prefer actual state transitions in isolated stubs over fragile text-only assertions; do not claim browser integration from mocked data.

## Actual Chromium smoke tests (desktop and mobile viewport)

The separate **`tests/onda-browser-smoke.browser.mjs`** script starts a local Node static HTTP server, launches real headless Chrome through `playwright-core`, and uses temporary fresh browser contexts. It is the second job in the dedicated Onda GitHub Actions workflow; it runs after the five dependency-free source tests pass.

The local equivalent (Node.js 22, a compatible Chrome binary, and network access for test-runner installation) is:

```bash
cd tools/Onda
npm install --no-save --no-package-lock playwright-core@1.56.1
CHROME_BIN=/usr/bin/google-chrome node tests/onda-browser-smoke.browser.mjs
```

It confirms real app startup; the existing player controls; Storage Health/device QA; browser-generated redacted JSON download; synthetic WAV decoding and time progression; no new IndexedDB audio cache record while auditioning or after Discard; a cache record **only** after explicit Add; cache survival after reloading its disposable browser profile; and mobile viewport/touch-emulated Library browsing/search.

**Safety:** The audio is generated in memory, the local server binds to `127.0.0.1`, and browser contexts are new and isolated. It never reads the user's audio files, logged-in Chrome profile, real Onda site storage, cloud account or filesystem. All browser storage it writes belongs to this disposable test profile, which is closed when the test finishes. No existing Onda cache is deleted or migrated.

**Limitations:** Headless desktop Chromium with a mobile viewport/touch emulation is **not a physical Android browser**. It cannot prove Android file-picker permission persistence, lock-screen/headphone audio controls, Bluetooth behaviour, actual mobile battery usage or deployment of Netlify production. Use the real-device QA matrix for those acceptance tests. The browser job requires Chrome and the pinned Playwright package, while `npm test` itself remains dependency-free.

### Saved audio restoration and offline playback (extended browser check)

The actual Chromium suite also verifies that a synthetic file deliberately imported through Quick Play survives a page reload as a **real Library entry**, is marked `local cached` or `local ready` (no Reconnect button), and plays from its IndexedDB cache with the network disabled **after the page has loaded**. Chromium must report a real `blob:` audio source, decoded duration and advancing playback position; playing it must not create a duplicate cached audio record. The test restores online mode afterward.

This proves a local browser-cache recovery/playback path in desktop Chrome. It does **not** test a cold startup while offline, persisted file-handle permissions, Android system suspension, physical phone storage, cloud syncing or Bluetooth/lock-screen behaviour.

### Missing audio and explicit Reconnect (real Chromium)

A separate disposable Chrome context imports an **Onda Library JSON containing metadata only**: one intentionally missing local WAV, a stable track ID, playlist membership, tag and note. No audio bytes are imported or cached. After reloading, the test confirms that Onda retains the Library row, labels its source **needs relink**, and offers **Reconnect**. Clicking Play without audio shows the missing-file warning but does not remove metadata or silently open a picker.

The test then clicks the actual **Reconnect** control, handles Chrome's genuine filechooser event, supplies an in-memory WAV, and verifies that audio plays under the original track ID, metadata and playlist membership survive, only one cache record is created and the track no longer requires Reconnect after another reload.

**Evidence:** [GitHub Actions run #45256546568](https://github.com/cinaedvsstudios/Organon/actions/runs/45256546568) passed both source and actual-Chromium jobs. This tests a user-selected file on a desktop Chromium browser and never touches the user's real Library. It does **not** establish Android persistent File System Access handles, filesystem permissions after phone restart, or a renamed-file mismatch confirmation.

### Remembered file handles and permission-denied fallback (real Chromium)

An additional **disposable** Chromium browser context creates its own synthetic WAV in **Origin Private File System (OPFS)** and stores its *real structured-clonable FileSystemFileHandle* using Onda's `OndaFileHandles.rememberMany()` IndexedDB pipeline. It imports only metadata, reloads, checks that the remembered handle survives, and confirms that the linked WAV plays **offline with no audio cache duplicate**.

Next it reloads with a deliberately **simulated** denial from `queryPermission()` and `requestPermission()` for the synthetic handle. The test verifies that silent/normal Play calls only the non-prompting query path, produces the missing-source warning instead of making an unexpected permission request, and preserves metadata. The first explicit Reconnect tries read permission and is denied; the second explicit Reconnect opens Chrome's real file chooser for a synthetic WAV under the **same track ID**, retaining playlist membership and notes.

**Evidence:** [GitHub Actions #45270809740](https://github.com/cinaedvsstudios/Organon/actions/runs/45270809740) — all original Node and actual-Chromium jobs passed.

**Limitations:** OPFS is a browser-private substitute used only for safe automated testing. Its storage/permission characteristics are not identical to a user-picked external file or folder on Android. Denial is simulated by instrumenting browser handle methods, not an observed Android OS dialog. Permission persistence and re-prompt behaviour must be checked on the user's physical phone. No files, permissions, library data or cache belonging to the user were accessed.

### Actual Chrome Media Session playback/visibility routing

An isolated Chromium smoke context captures the **actual eight Media Session handlers** Onda registers in Chrome, then invokes those callbacks while Chrome's real audio element decodes two synthetic 12-second WAV tracks. It verifies playbackState and metadata; system pause/play; seekto, seekforward and seekbackward; next/previous queue navigation and the corresponding metadata changes. The browser's `visibilitychange` handler is exercised with **simulated** `hidden` and `visible` document states, and the audio must keep advancing.

The test then starts temporary Quick Play from a third synthetic WAV, verifies that the registered system actions control **the temporary audio element** and update preview metadata, and confirms that next/previous do not modify the saved queue or silently import media. Stopping the preview restores permanent-track metadata; the next system Play resumes the saved track.

**Evidence:** [GitHub Actions run #45277569315](https://github.com/cinaedvsstudios/Organon/actions/runs/45277569315) — original Node and actual Chromium integration jobs passed. This is a localhost Chrome callback test, **not physical media buttons, actual browser background scheduling/OS suspension, Android lock screen, headset/Bluetooth controls or production deployment**. All test tracks are generated in memory; only disposable browser contexts are used.

### v3.23 — real Chrome OFFLINE cold startup, after one online shell install

The browser suite now includes a separate **persistent Chrome profile** isolated in the GitHub Actions runner's temporary directory. It opens Onda online first, verifies its new same-scope `onda-sw.js` service worker installs the complete exact-version app shell, and deliberately imports a generated WAV into its saved Library and IndexedDB media cache. It then shuts down **the whole Chrome process**, reopens the same disposable profile, enables offline network conditions **before** navigating back to Onda, and verifies that the HTML/scripts/UI load, the Library returns, and the saved WAV actually plays from IndexedDB. The test checks that the app shell Cache Storage does not gain audio files, Library JSON, Netlify cloud or unknown-route responses.

[Passing GitHub Actions run #45280311658](https://github.com/cinaedvsstudios/Organon/actions/runs/45280311658). The offline restart is a true second Chrome process, not merely disconnecting an already-loaded page. **The first visit must be online** for service worker installation. This checks Chromium localhost persistence, not Android/Netlify production, phone airplane-mode behaviour after reboot, or guarantees about browser storage eviction. The temporary synthetic Chrome profile is deleted after the test; user media and profiles are never accessed.

The static worker has an explicit, source-checked asset allowlist and only intercepts its own same-origin Onda directory. It never caches user songs, cloud requests or playlist JSON. See [v3.23 release notes](../development/RELEASE_V3_23.md).
