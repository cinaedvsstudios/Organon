# Onda v3.22 — Device QA version-report correctness

**Source date:** 2026-11-23  
**Scope:** Fix a confirmed version-report mismatch in the read-only device QA panel. No audio engine, library, cloud sync, storage format, music import, playlist or cache changes.  
**Previous:** [v3.21 save efficiency](./RELEASE_V3_21.md).

## Confirmed defect in v3.20 / v3.21 source

The new v3.20 `device-qa.js` module contained `const VERSION = 'v3.20'`, then returned `loadedVersion = version === VERSION ? VERSION : 'different-or-unavailable'`. When Onda was later updated to **v3.21**, its core correctly set `document.documentElement.dataset.ondaVersion = 'v3.21'`, but the QA panel incorrectly reported **different-or-unavailable**. The exported JSON's `sourceVersion` also falsely remained `v3.20`. The permanent Node regression suite even asserted that the incorrect mismatch should appear; that made this error self-reinforcing.

## Correction

The QA panel now reads the **actually loaded app version** from the core-set document dataset, rather than comparing it to the release number frozen in the older QA module. The loaded and exported version fields agree. Only strictly formatted version tokens such as `v3.22`, `v18.47` or `v1.2.3` are accepted; arbitrary page text, excessively long version identifiers or markup return `unavailable`. A genuinely missing version also returns `unavailable`. These values make no claim about whether a production deployment is up to date: compare the displayed version against the expected release.

The core announces **v3.22**; `index.html` cache-busts both the updated app core and device QA script. No schema, cloud, cache, persisted browser data, playback controls, Media Session, Quick Play, reconnect, visualiser or app layout changes are made.

## Durable regression testing

The committed `tools/Onda/tests/onda-regression.test.mjs` has been corrected to:
- Derive the expected version **from actual app-core source** instead of hard-coding `v3.21`.
- Verify the HTML app-core query version matches source.
- Assert that the QA panel reports and exports the loaded app version (not a stale module version).
- Simulate a future app version with an older QA module and verify it reports that future version.
- Simulate an invalid version containing markup and verify both visible/report fields return `unavailable`.
- Retain the previous no-storage-writes, preview, Media Session, saved Library and privacy tests.

A GitHub Actions green result demonstrates Node.js regression/source correctness only. **Android file access, actual audio playback, lock-screen controls, Netlify production deployment and real performance measurements remain unverified** until tested on a device and the live app.

## Device acceptance

Open Onda → Settings & Extras → Storage Health → Device compatibility and playback QA → Run device checks. It should display **Loaded Onda version: v3.22** when v3.22 is actually served. Exported `sourceVersion` and `capabilities.loadedVersion` should also read `v3.22`. If you see an older number, do not clear site data/audio cache; inspect the actual Netlify deployment and browser reload behaviour before assuming the code is wrong.

Keep the eight manual playback tests as Not tested until you've actually tried each on Android or desktop.
