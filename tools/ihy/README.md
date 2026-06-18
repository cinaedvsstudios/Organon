# Ihy — Organon Music, Keyboard & Sound Workshop

**Status:** Planning only  
**Version:** 0.01  
**Path:** `tools/ihy/`  
**App role:** Create, organise, audition and reuse game sound effects; play and record simple music from a physical or on-screen keyboard; paste and play ABC notation.

---

## 1. Product definition

Ihy is Organon’s browser-based **sound-design and simple music-creation tool**. It is deliberately not a full DAW, music library player, or replacement for Onda.

Its primary job is to make practical reusable audio for Organon projects:

- Create game-style sound effects with an sfxr-like synthesiser.
- Save, tag, favourite, search, preview and export sounds.
- Import existing local audio files into the same sound library.
- Play a musical keyboard with the mouse, touch, or physical computer keyboard.
- Record short note sequences and quantise them to a beat grid.
- Paste ABC notation and audition it immediately.
- Let other Organon tools select a saved Ihy sound by its stable library ID.

The app should feel like a focused **sound workshop**, not a huge production suite full of features that are irrelevant to game and story work.

---

## 2. Relationship to the other Organon tools

### Ihy owns the shared sound library

Ihy is the one place where a sound is created, imported, named, tagged, stored and exported. Other tools should select a sound from Ihy instead of each building their own audio-creation interface.

Expected consumers include:

- **Object Creator:** assign a pickup, use, equip, break or ambient sound to an object.
- **Quest Builder:** assign quest-start, success, failure, alert, dialogue or location sounds.
- **Effect Editor:** assign magic, impact, particle, transition, weather or environmental sounds.
- **Future games/apps:** assign sounds by library ID without duplicating files or recreating metadata.

### Ihy is not Onda

- **Onda** is for listening to and organising full music tracks.
- **Ihy** is for synthesised sound effects, short musical ideas, notation playback and reusable project audio assets.
- Ihy does not need playlists, crossfade, listening history or a commercial music-player layout.

---

## 3. Core sections of the app

The initial navigation should have four clear workspaces:

1. **Library** — browse, search, tag, favourite, import, preview and export all saved sounds.
2. **Create Sound** — sfxr-style synth editor for creating and saving game sounds.
3. **Keyboard & Recorder** — playable keyboard plus short sequence recording and quantisation.
4. **ABC Player** — paste ABC notation, validate it, render readable notation where possible, and play it.

A compact, persistent transport bar should remain available where playback is relevant:

- Play / Stop.
- Master volume.
- Current sound or sequence name.
- Playback progress where applicable.
- BPM when working in Keyboard & Recorder or ABC Player.

---

## 4. Sound Library

### 4.1 Library record

Each library sound needs a stable ID and enough metadata for future tools to find it reliably.

Required fields:

```text
id                 Stable generated ID, never reused.
name               User-facing sound name.
sourceType         synth | imported-audio | keyboard-sequence | abc-sequence.
category           Main sound category.
tags               User-editable tag list.
favourite          True/false.
createdAt          Timestamp.
updatedAt          Timestamp.
durationMs         Rendered or imported duration.
previewWaveform    Lightweight stored waveform/peaks data where practical.
synthPreset        Saved synth parameters when sourceType is synth.
audioBlob          Rendered/imported audio data when required.
sequenceData       Recorded note events when sourceType is keyboard-sequence.
abcSource          Original ABC text when sourceType is abc-sequence.
```

An Object Creator, Quest Builder or Effect Editor should save only the `id` in its project data. The visible name, category and audio can then be resolved from the shared Ihy library.

### 4.2 Categories

The initial default categories should be practical for games and effects:

- UI / click / confirm / error.
- Pickup / inventory / coin.
- Footstep / movement / jump.
- Hit / impact / break.
- Weapon / projectile / explosion.
- Magic / spell / curse / heal / portal.
- Creature / voice-like / alert.
- Environment / weather / water / fire / forest / room tone.
- Music cue / melody / stinger.
- Miscellaneous.

A sound may have one primary category and multiple tags. Search must match name, category and tags.

### 4.3 Library interactions

The Library must support:

- Search field with instant filtering.
- Category filter.
- Favourites-only filter.
- Sort by newest, oldest, name, category and recently played.
- Quick preview without leaving the Library.
- Rename, retag, duplicate and delete actions.
- Star/unstar favourites.
- Export a selected sound as WAV.
- Export/import an editable synth preset when the sound came from Create Sound.
- Import WAV, MP3, OGG and browser-supported audio formats as local library items.
- A clear warning before deleting a sound that may be referenced by another Organon tool.

### 4.4 Storage rule

Use **IndexedDB** as the persistent browser store for the library because audio blobs and rendered buffers are too large for localStorage. localStorage may hold small UI preferences only, such as the last active tab, selected category, panel widths and volume.

The shared database should be versioned, for example:

```text
Database: organon-ihy
Store: sounds
Schema version: 1
```

No audio should silently upload anywhere. Ihy is client-side and local-first by default.

---

## 5. Create Sound — sfxr-style synthesiser

### 5.1 Design goal

Create Sound should make it fast to produce usable game effects without forcing the user to understand every synthesis concept before hearing a result.

The workflow is:

1. Pick a starting sound family or preset.
2. Preview it immediately.
3. Adjust only the controls that matter.
4. Use controlled variation when wanted.
5. Name, tag and save the result to Library.
6. Export WAV only when the user needs a physical file.

### 5.2 Starting presets

The first preset families should include:

- Blip / UI click.
- Confirm / success.
- Error / deny.
- Coin / pickup.
- Jump.
- Hit.
- Explosion.
- Laser.
- Projectile.
- Sword / swipe.
- Magic sparkle.
- Magic charge.
- Heal.
- Teleport / portal.
- Monster alert.
- Ambient drone.
- Water drop.
- Fire crackle-like burst.

These are starting points, not locked sound outcomes.

### 5.3 Synth controls

Phase 1 needs a practical, grouped panel rather than a wall of sliders.

**Sound source**

- Waveform: square, saw, sine, triangle, noise.
- Base pitch.
- Pitch slide up/down.
- Pitch wobble/vibrato.
- Optional arpeggio/pitch step.

**Shape / envelope**

- Attack.
- Decay.
- Sustain.
- Release.
- Overall duration.

**Tone**

- Low-pass filter.
- High-pass filter.
- Resonance where useful.
- Bit-crush / sample-rate reduction for chiptune texture.
- Noise mix.

**Movement / texture**

- Tremolo.
- Phaser-like sweep.
- Repeat rate.
- Stereo pan.
- Output gain.

Every slider must show a readable value and reset to the current preset default with a clear reset action.

### 5.4 Controlled variation

Ihy must not have a useless "randomise everything" button that produces mostly broken sounds. Instead it needs:

- **Subtle variation:** alters safe parameters only within a small range.
- **Strong variation:** wider but still category-aware changes.
- **Lock controls:** a control can be protected from randomisation.
- **Seed value:** optional repeatable variation seed so a good random result can be recreated.
- **Undo / redo:** at least one clear undo path after a variation.

For example, a Coin preset can vary pitch, duration and sparkle safely without turning into a ten-second distorted explosion.

### 5.5 Saving and exporting

A synthesised sound should support:

- Preview.
- Save new sound to Library.
- Update existing saved sound.
- Duplicate before editing.
- Export WAV.
- Export synth preset as a small JSON file.
- Import a compatible synth preset JSON.

Rendered sound effects should be created through Web Audio / OfflineAudioContext where supported, so saving and WAV export do not depend on recording speaker output in real time.

---

## 6. Keyboard & Recorder

### 6.1 Purpose

This is for short melodies, stingers and sound ideas. It is not a multitrack DAW.

The player must work with:

- Click/tap on an on-screen piano keyboard.
- Physical computer keyboard input.
- Touch input on mobile.
- A selected simple instrument/synth tone.

### 6.2 Keyboard mapping

Initial desktop mapping should use two comfortable rows:

```text
Lower octave: Z S X D C V G B H N J M
Upper octave: Q 2 W 3 E R 5 T 6 Y 7 U
```

The visible keyboard must label the matching computer key on each note. Octave shift controls should be available, and focus handling must prevent accidental notes while the user is typing into a search or notation text field.

### 6.3 Instrument presets

Phase 1 only needs a small reliable group:

- Piano-like.
- Soft synth pad.
- Square/chiptune lead.
- Pluck.
- Bass.
- Bell.
- Noise/percussion.

Instrument settings should be simple enough to support the recorder without becoming another full synthesiser screen.

### 6.4 Recorder

The first recorder version should be **single-track** and event-based:

- Record note-on and note-off events with timestamps.
- Play back a recorded sequence.
- Set BPM.
- Quantise note starts and note lengths.
- Choose beat-grid values: 1/1, 1/2, 1/4 and 1/8.
- Loop playback.
- Clear recording with confirmation.
- Save the result into Library as a keyboard sequence.
- Export rendered audio as WAV.

A piano-roll editor, multiple tracks, automation and mixing belong in later phases only if this core workflow is actually useful.

---

## 7. ABC Player

### 7.1 Purpose

The ABC Player is a quick notation sandbox: paste ABC notation, validate it, hear it, and optionally save the result as a Library item.

### 7.2 Required behaviour

- Large plain-text ABC input area.
- Play / Stop / Restart controls.
- BPM control where the notation allows it.
- Clear parse error messages with useful line references where possible.
- Keep the original pasted ABC source unchanged unless the user directly edits it.
- Render a readable notation preview if the chosen local/browser-compatible renderer supports it.
- Save to Library as `abc-sequence` with the original source retained.
- Export a rendered WAV version where practical.

ABC support should start as playback/import support, not as a full notation editor.

---

## 8. Shared Organon integration contract

### 8.1 Sound selection in other tools

Other Organon tools should use a shared **Sound Picker** rather than hard-coding their own mini audio libraries.

The picker needs:

- Search.
- Category filters.
- Favourites.
- One-click preview.
- Select / clear current sound.
- Display of the selected sound name and category.

The consuming tool saves a stable `soundId`, not a copied audio blob.

### 8.2 Missing sound handling

If a project references a deleted or unavailable sound ID, the consuming tool must show a visible missing-sound state:

```text
Sound unavailable — choose replacement
```

It must not silently substitute a random other sound.

### 8.3 Parent Hub communication

Ihy should use the Organon status handshake for clear hover/action messages:

```text
setHubStatus(text)
clearHubStatus()
```

Examples:

- "Preview selected sound"
- "Save current synth sound to the Ihy library"
- "Quantise recorded notes to the selected beat grid"
- "Export the selected sound as WAV"

---

## 9. Layout and responsive behaviour

Ihy is more complex than a narrow one-action Organon sub-tool. It should use a wider workspace layout rather than being constrained to the small 540px app wrapper.

### Desktop

Use a three-zone workbench:

- **Left:** Library browser / filters / collections.
- **Centre:** active workspace: Create Sound, Keyboard & Recorder, or ABC Player.
- **Right:** selected sound details and context-sensitive inspector.
- **Bottom:** persistent transport bar.

The Library and inspector should be collapsible so Create Sound and keyboard work can use the available width.

### Mobile

Do not attempt to force the desktop three-column screen onto a phone.

- Main areas become switchable tabs or sheets: Library, Workspace, Inspector.
- The transport bar stays reachable at the bottom.
- The on-screen keyboard must remain playable without tiny keys.
- Synth controls should use grouped collapsible sections.
- Long lists need search-first behaviour rather than huge scrolling cards.

### Accessibility and interaction

- All controls need text labels or accessible names.
- Keyboard navigation must not break physical note input.
- Volume controls must never autoplay audio without a user gesture.
- Touch controls need large enough hit areas.
- Visual waveform data is supplemental; never make it the only way to understand a sound.

---

## 10. Technical boundaries

### Required browser technologies

- Web Audio API for live playback and synthesis.
- OfflineAudioContext for deterministic sound rendering where supported.
- IndexedDB for audio assets and library metadata.
- Canvas or SVG for simple waveform/previews.
- File input for importing local audio.
- Blob/Object URL download for WAV and preset export.

### Optional browser technology

- File System Access API may be used when available for a more direct export/save flow, but it must never be the only export method.

### Practical constraints

- Browsers require a user interaction before starting an AudioContext. The UI must handle this cleanly with an explicit first Play/Enable Audio action.
- Do not promise MP3 export as a core feature. WAV export is reliable and sufficient for the first version.
- Large imported files must have a practical size warning before storing them in IndexedDB.
- Object URLs must be revoked after use so repeated preview/import work does not leak browser memory.
- Sound playback must stop cleanly when switching items, leaving the app, or deleting the active sound.

---

## 11. Explicit non-goals for the first build

The first Ihy build should not try to become:

- A replacement for Ableton, FL Studio or GarageBand.
- A multitrack mixing suite.
- A full score/notation editor.
- A stem splitter or vocal isolation tool.
- A streaming/music discovery app.
- A cloud synchronisation service.
- A YouTube downloader or ripper.
- An app that uploads the user’s audio by default.

Keeping these out protects the actual purpose: fast creation and reuse of practical Organon sound assets.

---

## 12. Delivery phases

### Phase 0 — App shell and storage foundation

- Create the Ihy folder/app shell using Organon conventions.
- Add iframe guard and Hub status handshake.
- Build IndexedDB schema and version handling.
- Build empty Library layout and persistent UI preferences.
- Add basic transport state and AudioContext enable flow.

### Phase 1 — Sound Library and Create Sound

- Library search, filters, favourites, tags and sound metadata.
- Import local audio files.
- sfxr-style synth with the initial preset families.
- Preview, controlled variation, save, duplicate, delete and WAV export.
- Synth preset JSON import/export.

**This is the first useful release.** It lets Organon projects make and reuse sound effects even before music features arrive.

### Phase 2 — Keyboard & Recorder

- On-screen keyboard.
- Physical keyboard mapping.
- Small instrument preset set.
- Single-track note event recorder.
- BPM, quantisation, looping and library save.
- WAV export of recorded sequences.

### Phase 3 — ABC Player

- ABC text input.
- Parse/validation feedback.
- Playback and notation preview where supported.
- Save ABC sequences into Library.
- Render/export workflow where practical.

### Phase 4 — Cross-tool Sound Picker

- Shared sound picker implementation for Object Creator, Quest Builder and Effect Editor.
- Missing-sound state and replacement workflow.
- Clear project references using stable `soundId` values.

### Phase 5 — Only after real use confirms the need

Possible later additions:

- Piano-roll editing.
- Multiple tracks.
- More instrument controls.
- Library collections/folders.
- Batch export.
- Project-specific sound packs.
- Library backup/restore bundle.
- Per-project reference audit showing where each sound is used.

None of these should delay Phases 1–3.

---

## 13. Build rules

- Start implementation at **v0.01** and increase by **0.01** for each accepted iteration.
- Keep code modular. Avoid one huge HTML file containing audio engine, UI, library storage and rendering logic together.
- Use lowercase filenames and folders unless an existing external path forces another case.
- Do not refactor working features unless the requested task requires it.
- Every change must be checked on desktop and mobile before it is treated as accepted.
- Do not open user-facing preview windows unless explicitly requested.
- No implementation code should be generated from this plan until Chris says **MAKE IT SO**.

---

## 14. Initial file structure when implementation begins

```text
tools/ihy/
  index.html
  readme.md
  css/
    base.css
    layout.css
    components.css
  js/
    main.js
    state.js
    audio-engine.js
    synth-engine.js
    library-db.js
    library-ui.js
    keyboard.js
    recorder.js
    abc-player.js
    wav-export.js
    organon-bridge.js
  data/
    presets.json
```

This is a starting separation only. Files should be added when a real feature needs them, not created as empty ceremony.

---

## 15. Acceptance test for the first useful version

Phase 1 is successful when the following can all happen locally in a normal desktop browser:

1. Open Ihy from Organon.
2. Choose the **Coin** or **Magic Sparkle** sound family.
3. Hear it after an explicit user gesture.
4. Adjust a few grouped controls and use a controlled variation.
5. Save it as a named, tagged sound in Library.
6. Search for it and favourite it.
7. Preview it from Library.
8. Export it as a WAV file.
9. Refresh the page and find the saved sound still present.
10. Select that sound from a shared Organon Sound Picker prototype by its stable ID.

When that works, Ihy has achieved its core purpose.