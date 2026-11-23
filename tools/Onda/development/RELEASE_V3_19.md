# Onda v3.19 — Temporary Quick Play for Unsaved Audio

**Implemented:** 2026-11-23  
**Status:** Source implementation, **53 final consolidated static/isolated tests passed**, including mock DOM/audio and Media Session; **real Android Chrome, desktop browser, installed shortcut and Netlify deployment remain unverified.**  
**Action:** ONDA-08.  
**Previous:** [v3.18 performance diagnostics](./RELEASE_V3_18.md).

## Purpose

Sometimes the user wants to audition a new local file without permanently importing a music file into Onda's catalogue, playback queue or IndexedDB audio cache. The ordinary Add Files picker was designed to *import* and *save*, so Quick Play is a **separate temporary audition** that never passes through the permanent import pipeline until an explicit Add command.

Normal Add Files (and the original drop-zone, folder import and Remember Files/Folder options) is **unchanged**.

## Where to find it

- **Add** workspace → **▶ Quick Play (temporary)** button beside the original drag/drop Add area.
- On a phone: **Library drawer** → horizontal shortcuts → **▶ Quick Play**. The picker returns to Add where the temporary player is shown.
- Pick **one audio file** with the system file picker. Supported file types depend on the browser's actual audio decoder. Audio formats such as MP3, OGG, WAV, FLAC and AAC are considered; unsupported codecs may not play. MIDI and video remain in the normal importer, not Quick Play.
- The temporary panel shows the chosen filename, a native browser audio player and **Replay preview**, **Add to Library + Queue**, **Discard preview**.
- **Add to Library + Queue** deliberately calls the **existing** `handleUploadedFiles([file])`, retaining its stable library IDs, playlist metadata, cache writes, and duplicate handling rules. No new importer was created.
- **Discard**, switching away from Add, normal Onda playback, or leaving the page stops the preview and revokes its temporary `blob:` URL. Replay is possible while the selected file is still held in memory; reload forgets it.
- Quick Play's separate small audio control is deliberately distinct from the main deck; the main Onda panel can still show the previously selected saved track. Use the temporary player for auditioning.

## Data separation and protection

The temporary module `js/quick-play.js` stores only an in-memory `File` reference and one browser `blob:` object URL. It does not call localStorage, sessionStorage, IndexedDB, cloud/network fetch, queue or history writers, or add anything to `virtualLibrary`, `playlists` or `playlistTracks`. Selected filenames are displayed through `textContent`, not HTML interpolation.

The only persistence handoff is the **user pressing Add to Library + Queue**, which reuses `handleUploadedFiles` so that usual saved-library behaviour applies. A cached-audio failure after import is still reported by the existing importer; the preview does not bypass quota or permission checks.

The optional bridge in app-core can pause main audio and use the existing importer. Normal playback and workspace navigation stop the temporary preview; they do not silently import it. The main track is left available to resume.

**No automatic 48-hour deletion policy** is implemented: because Quick Play makes no cache copy, there is nothing to clean up later. Existing offline/legacy audio is not touched or deleted.

## Media Session and playback

During a temporary audition, Onda's Media Session uses the preview audio element and temporary title for system Play/Pause/Seek/Stop. Previous/Next do not advance the normal saved queue while previewing because the audition is not a queue. When the preview stops, Media Session rebinds to the main saved track. The native audio control gives the most predictable temporary-player UI.

Real Android notification/lock-screen/audio focus behaviour must still be tested; a source-level test cannot guarantee background playback or device codec compatibility.

## Source QA

Isolated/source checks cover JavaScript syntax, new script/CSS version references, unique markup IDs, default-hidden preview panel, no persistence calls from the temporary module, no network requests, safe text rendering, synchronous file picker from user click, genuine local `blob:` URL playback, normal player pause, replay, discard, cleanup/revocation, MIDI rejection, explicit Add importing **once**, pagehide cleanup, Media Session preview metadata and play/pause/seek/stop action isolation.

## Android and desktop verification checklist

1. Confirm live Onda version is **v3.19** without clearing site data or browser music cache.
2. On Android Chrome (tab and shortcut), open Add → Quick Play. Select a disposable MP3; it should appear in the temporary panel and audibly play, or ask for a tap on the native preview Play control if the browser blocks autoplay.
3. Before importing, confirm the new file is **not** in Library, Current queue, History, Storage Health cached-audio inventory, or exported JSON. Verify counts are unchanged.
4. Try Replay, Pause, Seek, Discard; confirm the temporary track disappears and that the previously saved track stays in Onda.
5. Repeat via mobile Library → Quick Play, verify picker and panel navigation at 320/360/390/420px widths, keyboard, portrait/landscape and desktop layout.
6. While preview is playing, tap main 🧿 Play or switch to Current. Preview must stop, and main controls must operate the saved audio rather than playing two tracks simultaneously.
7. While previewing, lock the Android phone; test notification/Media Session Play, Pause, Seek and Stop, and verify previous/next do not unexpectedly mutate saved queue. Repeat with Bluetooth/headphone controls if available.
8. Add a disposable MP3 via the explicit **Add to Library + Queue** button. It should follow ordinary import and cache rules and survive reload if cache write succeeded; the preview disappears.
9. Test an unsupported codec or MIDI, picker Cancel, repeated selection of the same file, and an artificial storage failure in a disposable test profile. Don't use or clear your only real music cache.
10. On desktop, test normal drag/drop, Add Files, folder import, saved Library Play, history, playlist, cloud sync and media controls to detect regressions.

**Release gate:** v3.19 can be merged as source work, but cannot be considered production device-verified until Android and desktop playback, file picker, cache preservation and Media Session behaviour have been observed.
