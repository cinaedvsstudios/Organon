# Onda v3.11 — Mobile Playback and Storage Reliability, First Implementation Batch

**Implemented:** 2026-11-23  
**Status:** Changes committed directly to main. JavaScript parse and isolated logic checks passed; live Netlify deployment and Android phone tests are **not yet verified**.  
**Live app:** https://ondaplayer.netlify.app/  
**Version:** `ONDA_VERSION = 'v3.11'` in `js/app-core.js`; `index.html` uses `js/app-core.js?v=3.11` for cache busting.

## What changed

### ONDA-05 — Visualiser idle/hidden lifecycle

The old `drawVisualizer()` continuously called `requestAnimationFrame(drawVisualizer)` regardless of playback. A guarded `startVisualizer()` now owns a **single** pending RAF. It draws one frame when paused/idle or after a settings change, continues animating only during active visible playback, cancels frames on document hidden, and resumes on document visible. Existing visualiser presets, live-stream fallback, graphics, transport symbols and AudioContext playback routing are not redesigned. MIDI sends a refresh signal from `onda-midi.js` because it lacks native HTML audio events.

**Changed:** `js/app-core.js` and `onda-midi.js`. Battery saving is expected but must be **measured** on the actual Android device; no percentage claimed.

### Saved Library — one-tap playback and graceful reconnect (ONDA-07/08/12)

- The Play button no longer issues a second premature `play()` while `restoreLastPlayedTrack()` is already loading a cached track.
- `playAudio()` starts `AudioContext.resume()` and `media.play()` during the same user gesture where possible, before awaiting promises, which is particularly relevant to Chrome Android.
- When the user taps an existing Library track's Play button, the existing source ID is used; no additional import/Quick Play selection or duplicate record is created.
- The app silently hydrates an existing saved File/MIDI Blob from IndexedDB. The old 'Restoring cached local audio...' toast was removed.
- When audio is genuinely inaccessible, a **Reconnect** control is shown on the Library row and on the Current screen's source-detail field. It uses a separate single-file picker, preserves the existing ID, metadata, playlist membership, art and tags, and saves the new Blob under the same IndexedDB key. It asks for confirmation only when the selected filename differs; it checks audio versus MIDI source type. It never deletes an original Android file.
- If browser caching the reconnected file fails, the track remains playable for the current session and the user receives a warning.

**Changed:** `js/app-core.js`. This does not enable persistent FileSystemFileHandle storage; that remains a separately planned Android compatibility test.

### Read-only audio cache inventory and Storage Health (ONDA-07/10)

- Onda now scans IndexedDB `audioFiles` using a read-only cursor to build a set of tracks with actual saved File/Blob contents. It does not read the audio bytes into an ArrayBuffer.
- Library source labels now differentiate ready, cached, unverified, genuinely needs relink, streaming and external references. The Missing filter and Check Files use the same source-status logic.
- Storage Health now shows a cache count/approximate saved audio Blob bytes, unlinked cache record count, whole-origin browser storage estimate and accurate needs-relink count. **Site storage is labelled as whole-site usage**, not exact audio-only usage.
- Importing more files refreshes the inventory after caching. Existing v2 IndexedDB stores and all records are untouched.

**Changed:** `js/app-core.js`. No automated cache cleanup, no 48-hour deletion, no cache migration, no change to default import behaviour.

### Version/deploy cache

Updated `index.html` to load `app-core.js?v=3.11`, and changed `ONDA_VERSION` to `v3.11`. Other CSS, icon and web-app manifest files remain unchanged by this batch.

## Verification completed

The repository content was fetched again and tested with the V8 JavaScript parser (`new Function(source)`) on main core, MIDI and media-session source files. An isolated test harness using the **actual extracted `sourceStatus()` and visualiser scheduler** covered:

- one pending idle visualiser frame (not duplicates);
- paused state draws once, then stops;
- playing state continues scheduling;
- hidden state cancels queued work;
- returning in paused state redraws once;
- cached local/MIDI, stream, external reference, in-memory File, missing and unknown/unavailable cache states;
- v3.11 script link and source version; non-destructive IndexedDB v2 schema; existing source-resolution and reconnect entry points.

**21 static/isolated checks passed.** They do not simulate browser audio autoplay rules, real IndexedDB transactions on Android or full UI behaviour. No automated Android browser test or successful Netlify deploy was claimed. GitHub combined status reported no CI status contexts on the checked commit; this is **not** evidence of a deployment pass.

## Android smoke test — to perform on real device

1. Open https://ondaplayer.netlify.app/ from the Android shortcut and verify it reports **v3.11**. If old app persists, reload it; the `v3.11` URL version should invalidate the old core JS.
2. Tap Play on an existing saved Library MP3. It should **play without choosing the original file again**.
3. Tap Play on a cached MIDI and one previously saved playlist entry. Confirm no duplicate entries or reimport dialogs.
4. Open Settings → Storage Health. Confirm **Cached audio** and **Site storage used** appear, and known cached music is not falsely marked as Needs relink.
5. Pause music; leave Onda open for 30 seconds. Visualiser should become static and the phone should not continuously redraw it. Play and pause again; check it resumes. Lock the phone while playing; the audio and notifications should continue.
6. On a **disposable test song**, simulate a truly missing source and press Play; confirm Reconnect appears, choose the same file, confirm existing ID/playlist info is retained and it plays. Do not clear site storage or delete your only music cache to simulate a failure.
7. Desktop Chrome smoke: import, playlist, library search, track switching, streaming, volume, visualiser presets, and the Current main-screen layout.

Use [QA_MIGRATION_MATRIX.md](./QA_MIGRATION_MATRIX.md) to record PASS/FAIL per case.

## Remaining work and boundaries

- **Android device verification**: audio after screen lock, background play, File picker and saved cache after Chrome restart, standalone shortcut behaviour, measured battery effect.
- **Storage architecture**: persistent file handles / directory relinking, non-destructive migration and optional 48-hour temporary Quick Play cleanup remain future tasks; none were silently introduced.
- **Current screen queue UX**: Queue / Now Playing belongs on main screen, not drawer. The existing Current playlist panel needs separate mobile display testing and any necessary refinement; this batch does not redesign it.
- **Quick Play**: a new-file-only optional audition mode is not implemented here.
- **Online library**: GitHub Pages-hosted JSON and audio remains a future feature (public access and file/site limits documented).
- **Resume position**: P3 optional, not implemented.
- **Video**: deferred.
- **App logo**: previously configured; true 512 PNG and Android launcher test still pending.

## Commits in first batch

| Commit | Change |
|---|---|
| `617e6f96` | Visualiser scheduler and last-track double-play guard |
| `af775e8e` | MIDI visualiser refresh notification |
| `0a49e03b` | Cache-busted core JS URL to v3.11 |
| `380d94b6` | IndexedDB cache ID inventory; source relink statuses |
| `8c8bfb47` | Storage Health cache size and missing status |
| `3d9ab2d3` | Explicit Reconnect picker preserving track identity |
| `b309ae47` | Initiate play in Android tap before awaiting context |
| `591442a5` | Only mark valid File/Blob records as cached |

**Rollback if real-device tests reveal a blocker:** revert app-core/MIDI/index changes to the previous known-good app revision through Git. Do **not** clear or downgrade IndexedDB; v3.11 deliberately made no database schema migration. Keep metadata and cached audio intact. The fact that a commit can be reverted is not a guarantee that an in-progress media write is recoverable; stop, back up metadata and report failures before further changes.
