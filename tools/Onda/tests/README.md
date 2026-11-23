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
