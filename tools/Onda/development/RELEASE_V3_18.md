# Onda v3.18 — Opt-in Redacted Performance Diagnostics

**Date:** 2026-11-23  
**Status:** Source developed and isolated/static tests performed. **Android runtime, desktop browser timing, Netlify deployment and audio tests are not yet verified.**  
**Action:** ONDA-11 (startup/loading diagnostics) with ONDA-04 (large library) measurement groundwork.  
**Previous:** [v3.17 touch/accessibility](./RELEASE_V3_17.md).

## Why

Onda's existing mobile action plan calls for collecting actual, privacy-safe timings before changing its indexing, Library DOM rendering, cached audio writes, startup/restore logic, or visualiser scheduling. The current code has no proven startup or large-library benchmark, so this release records measurements without trying to optimise the performance path prematurely.

## Where to find it

Open **Settings & Extras → Storage Health → Developer performance diagnostics (opt-in)**.

- **Start recording:** Begin collecting timings in this page session. Nothing is collected until selected.
- **Stop recording:** Stop adding new samples; existing samples remain in memory for export or clearing.
- **Reload & record startup:** A deliberate one-time reload enables timing at the beginning of the following app load. This is the only way to capture the very early restore phase. A single-use `sessionStorage` flag is deleted immediately upon that load.
- **Export redacted JSON:** Download locally; no server request or cloud sync.
- **Clear recorded timings:** Empty in-memory samples without touching music, playlists or IndexedDB.

The in-memory buffer is capped at the most recent **200** samples. Reload normally (without using the special button) to return to diagnostics-disabled state.

## Measured source operations

| Event | Timing captured |
|---|---|
| `core-init` | Main app-core JavaScript initialization |
| `restore-local` | Local-storage candidate selection and catalogue recovery |
| `restore-indexeddb` | IndexedDB catalogue restore |
| `restore-total` | Overall catalogue restore phase |
| `cache-inventory` | Read-only IndexedDB audio cache inventory |
| `library-render` | Rendering Library and recent-track results |
| `search-render` | Search input to rendered results |
| `import-prepare` | New file intake, metadata and queue preparation (not byte caching) |
| `cache-write-batch` | Sequential IndexedDB audio writes, with saved/skipped/failed counts |
| `track-resolve` | Successfully resolved track loading |
| `audio-play` | Start request to fulfilled/failed playback response |
| `visualizer-frame` | Approx. 1 of every 60 visible canvas draw frames while recording |

These metrics are timing samples, not an automatic performance rating. Some operations can fail/short-circuit before a success-only span completes; missing samples are **not** proof that a path did not run. Active background/lock-screen playback is not tested by these recordings.

## Privacy and compatibility

The JSON exporter creates a new object from a strict allowlist containing only: event name, elapsed time since module start, duration, count values (trackCount, visibleCount, cachedCount, savedCount, skippedCount, failedCount), rounded viewport width/height, capture state and timestamp.

It **never** reads/export filenames, file paths, playlist or track IDs, tags, artwork, music content, streaming URLs, cloud secrets, saved library JSON or unfiltered error messages. Event names are a fixed allowlist; arbitrary custom event names are dropped. Count fields are numeric and clamped. Timing data lives only in memory, except the deliberately one-use reload flag.

This release does **not** change Onda's audio playback behaviour, saved files, media cache architecture, catalogues, cloud sync, permissions, queue, UI playback symbols, or IndexedDB schema. The new instrumentation is entirely optional and uses the existing Storage Health tab.

## Verification

Source/static and isolated mock-DOM tests cover: module JS syntax, disabled default, intentional enable/disable, no recording before opt-in, one-use reload, strict redaction, disallowed event/metric fields, invalid durations, bounded 200-sample buffer, clearing records, correct script order, and app source syntax. See [QA matrix](./QA_MIGRATION_MATRIX.md) for browser/device gates.

## Android/desktop acceptance checks still required

1. Confirm Onda **v3.18** is actually deployed before testing; don't clear site data or cached music.
2. With diagnostics disabled, verify normal player, Library, file storage and visualisers work without extra status notifications or errors.
3. Enable recording and search a Library with music. Confirm a nonempty sample count; stop and verify samples no longer grow.
4. Use **Reload & record startup**; confirm saved Library, queue, custom icons, cached audio and local storage remain intact. Export JSON and check that startup/restore timings are present.
5. Browse, search, import a disposable audio file and play it, then export again. Verify no names/paths/URLs/secrets were included.
6. On Android, play a track, lock the screen and return. Audio must continue independently; visualiser may stop while hidden.
7. Repeat on desktop Chrome, both desktop and mobile layout, to check no new data-lifecycle regressions.
8. Only after collecting measurements in real devices, compare safe small/medium/large libraries and decide whether any further render/index optimizations are worthwhile.

**No destructive media/cache cleanup is part of this release.**
