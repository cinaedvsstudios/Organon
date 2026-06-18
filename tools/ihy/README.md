# Ihy — Organon Sound Library, Synth & Keyboard Workshop

**Status:** Planning only  
**Version:** 0.02  
**Path:** `tools/ihy/`  
**App role:** A local-first Organon tool for creating, importing, organising, previewing and exporting audio assets; making game-style synth effects; playing a keyboard; recording short sequences; and auditioning pasted ABC notation.

---

## 1. Product definition

Ihy combines the useful parts of the earlier **8-Bit Synth & Pure Frequency Generator** idea with the later shared Sound Library plan.

It has four connected purposes:

1. **Audio Asset Library** — the shared place for sound assets created in Ihy or imported from local files.
2. **Create Synth Sound** — an sfxr-style sound-effect creator for game audio, with controlled variation rather than meaningless total randomisation.
3. **Signal & Keyboard Studio** — a pure-frequency/reference-tone mode plus an on-screen and physical-keyboard instrument for short musical ideas.
4. **Sequence / Notation Tools** — short keyboard recordings and pasted ABC notation that can be heard, saved and exported.

Ihy is not a full DAW, playlist/music-listening app, cloud service or replacement for Onda. Onda remains the music player. Ihy is the workshop for practical reusable sound assets.

---

## 2. What is retained from the Gemini specification

The original Gemini text contained several useful ideas that belong in Ihy:

- Direct Web Audio oscillator generation for pure sine, square, sawtooth, triangle and noise signals.
- A **continuous signal mode** for sustained tones and a separate **envelope-gated note mode** for keyboard/synth playing.
- Exact frequency entry and a live Hz readout.
- Reference presets such as 440 Hz, 432 Hz, 528 Hz, 100 Hz and 1,000 Hz.
- ADSR sound shaping, including usable presets such as sustained and 8-bit pluck.
- Controlled pitch sweeps for sound design and frequency scanning.
- A simple chiptune arpeggiator.
- A physical/on-screen keyboard with note labels.
- A master-gain control, explicit Stop All action, and reliable cleanup when the tool is closed or navigated away from.
- Organon header/footer styling and parent-Hub status messages.

The plan does **not** keep the claim that browser-generated audio makes laboratory-grade speaker calibration possible or that it “bypasses” every source of distortion. Ihy can request and generate a precise Web Audio oscillator frequency locally, but the actual sound heard still depends on the browser, OS audio path, DAC, speakers/headphones, room and volume. The Signal mode is therefore a practical reference-tone and sound-design utility, not certified measurement equipment.

---

## 3. Core scope and first-build boundary

### Ihy owns audio assets

Generated synth sounds and imported WAV, MP3, OGG or browser-supported audio files are all ordinary audio assets in the shared audio-filtered Asset Library. They use the established asset ID pattern:

```text
asset_<stable-id>
```

Ihy does not create a competing `sound_` or `ihy_` media-ID system.

### First build remains standalone

The first implementation creates the Sound Library and Create Synth Sound inside Ihy only. It must **not** modify Object Creator, Quest Builder, Effect Editor, Puzzle Creator, Scene Editor or any other runtime code in the same pass.

Connections to those tools are a later integration pass. Until then, Ihy can export files and JSON data, and it can document the future asset-selection contract without changing other tools.

---

## 4. Audio asset record

Every sound in Ihy needs enough data to be reusable, searchable and safely referenced later.

```text
id                 asset_<stable-id>
mediaType          audio
name               User-facing asset name.
sourceType         synth | imported-audio | keyboard-sequence | abc-sequence.
category           Primary sound category.
tags               User-editable tag list.
favourite          True/false.
createdAt          Timestamp.
updatedAt          Timestamp.
durationMs         Rendered or imported duration.
fileName           Source/export filename where relevant.
mimeType           Audio MIME type where known.
audioBlob          Imported/rendered binary audio where required.
previewPeaks       Lightweight waveform/peak preview data where practical.
synthPreset        Complete saved synth state when sourceType is synth.
sequenceData       Note event data when sourceType is keyboard-sequence.
abcSource          Original ABC text when sourceType is abc-sequence.
```

The UI should also preserve a local edit/history trail for synthesised sounds. This is especially important because Chris wants the ability to step backward and forward through generated variations and star versions worth returning to.

---

## 5. Audio Asset Library

### 5.1 Purpose

The Library is the centre of Ihy. It is not merely a save dialog after synthesis. It is where generated and imported audio become properly registered assets.

### 5.2 Default categories

- UI / click / confirm / error.
- Pickup / inventory / coin.
- Footstep / movement / jump.
- Hit / impact / break.
- Weapon / projectile / explosion.
- Magic / spell / curse / heal / portal.
- Creature / alert / voice-like.
- Environment / water / fire / weather / forest / room tone.
- Music cue / melody / stinger.
- Reference tone / test signal.
- Miscellaneous.

A sound has one main category and any number of tags. Search matches name, category and tags.

### 5.3 Required Library actions

- Instant search.
- Category filter.
- Favourites-only filter.
- Sort by newest, oldest, name, category and recently previewed.
- Quick preview and Stop All.
- Rename, re-tag, duplicate and delete.
- Star/unstar favourite sounds.
- Show synth source settings where available.
- Export selected audio as WAV.
- Export/import an editable synth-preset JSON for synthesised sounds.
- Import local WAV, MP3, OGG and browser-supported files.
- Warn before deletion when a future project-reference scan finds that an asset is used elsewhere.

### 5.4 Storage

Use **IndexedDB** for persistent asset metadata and audio blobs. localStorage is only for small UI preferences such as volume, last active tab, selected filters, keyboard octave and collapsed panels.

Suggested database shape:

```text
Database: organon-asset-library
Store: assets
Schema version: 1
```

No audio uploads silently. Ihy is local-first.

---

## 6. Create Synth Sound

### 6.1 Design goal

Create Synth Sound should provide an sfxr-like game-SFX workflow: pick a recognisable sound type, preview immediately, make intentional adjustments, explore safe variations, then register the chosen version as an `asset_` audio asset.

It should never open as a wall of incomprehensible synthesis controls.

### 6.2 Starting sound families

The initial set should cover:

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
- Pure reference tone.

### 6.3 Waveforms

The base engine must support:

- Sine — clean pure-tone/reference signal and soft sound design.
- Square — classic 8-bit lead.
- Sawtooth — brighter retro/chiptune tone.
- Triangle — softer bass and Game Boy-like tone.
- White noise — explosions, impacts, wind-like effects and texture.

Waveform choice must be visible and immediately previewable.

### 6.4 Controls

Controls should be grouped into collapsible cards.

**Source and pitch**

- Waveform.
- Base pitch in Hz and note form where applicable.
- Pitch slide up/down.
- Vibrato/pitch wobble.
- Optional pitch-step or arpeggio amount.

**Envelope**

- Attack.
- Decay.
- Sustain.
- Release.
- Overall length.
- Envelope quick presets: Continuous, 8-Bit Pluck, Short Hit, Soft Fade, Charge.

**Tone and texture**

- Low-pass filter.
- High-pass filter.
- Resonance where useful.
- Noise mix.
- Bit-crush/sample-rate reduction.
- Tremolo.
- Phaser/sweep texture.
- Stereo pan.
- Master/output gain.

Every slider needs a readable number and a reset-to-current-preset-default action.

### 6.5 Controlled variation and history

Randomisation must preserve the identity of the selected sound family.

- **Subtle variation:** safe small changes.
- **Strong variation:** bigger changes while retaining the selected category’s character.
- **Lock parameter:** protected controls are not varied.
- **Previous / Next variation history:** step through earlier generated results without losing them.
- **Star version:** mark a version before moving on.
- **Optional seed:** recreate a variation later when it was good.
- **Undo / redo:** always provide a clear recovery path after a variation or manual adjustment.

A Coin sound can vary pitch, sparkle, tone and duration. It should not unpredictably become a five-second distorted drone.

### 6.6 Save/export behaviour

- Preview current version.
- Save as new audio asset.
- Update a saved synth asset deliberately.
- Duplicate before changing an existing asset.
- Render/export WAV.
- Export/import synth preset JSON.

Use Web Audio with OfflineAudioContext for deterministic rendering where browser support allows it. Do not record speaker output in real time merely to make a WAV.

---

## 7. Signal & Frequency Mode

### 7.1 Purpose

Signal mode is the retained “Pure Frequency Generator” part of the old plan. It provides direct, sustained browser-synthesised signals for simple reference-tone checks, hearing tests, sound-design starting points and frequency sweeps.

It is not a certified hardware calibration tool.

### 7.2 Required controls

- Waveform: sine, square, sawtooth, triangle, white noise.
- Numeric frequency field with decimal support.
- Frequency slider covering 20 Hz to 20,000 Hz.
- Logarithmic slider mapping by default, because that makes lower frequencies controllable; a linear option may be added later.
- Clear live readout, for example `440.00 Hz`.
- Master gain.
- Start Signal / Stop Signal action.
- Frequency sweep: start Hz, end Hz, duration and direction.
- Hold/sustain state distinct from envelope-gated synth notes.

### 7.3 Reference presets

The quick presets from the earlier specification should be retained as user-selectable starting values:

```text
A4 reference: 440 Hz
Alternative reference: 432 Hz
Alternative reference: 528 Hz
Low test tone: 100 Hz
Reference sine tone: 1,000 Hz
```

These are simply convenient stored values. The app must not attach unsupported medical, mystical or calibration claims to them.

### 7.4 Frequency relationship for keyboard notes

When Ihy calculates notes from an A4 tuning reference, it uses equal temperament:

```text
f(n) = A4 × 2^(n / 12)
```

`n` is the number of semitones away from A4. The A4 reference defaults to 440 Hz and can be changed in the keyboard settings.

---

## 8. Keyboard & Recorder

### 8.1 Purpose

Keyboard & Recorder is for short melodies, stingers and playable sound ideas. It is not a multitrack DAW.

It works through on-screen keys, touch and physical computer keyboard input.

### 8.2 Keyboard mapping

The initial desktop mapping should be:

```text
Lower octave: Z S X D C V G B H N J M
Upper octave: Q 2 W 3 E R 5 T 6 Y 7 U
```

Visible piano keys must show their matching computer-key label and musical note name. Input focus rules must stop accidental notes while a text field, search field or ABC textarea is active.

### 8.3 Instrument presets

Phase 2 starts with a small dependable set:

- Piano-like.
- Soft pad.
- Square/chiptune lead.
- Pluck.
- Bass.
- Bell.
- Noise/percussion.

### 8.4 Arpeggiator

The original BeepBox-inspired arpeggiator is useful and belongs here, not as a separate complex sequencer.

- Toggle on/off.
- Rate linked to BPM.
- Simple patterns, starting with Up, Down, Up/Down and Octave.
- Held-note pattern playback.
- Clear visual state showing that a played note is being arpeggiated.

The arpeggiator is an instrument behaviour, not a replacement for the recorder timeline.

### 8.5 Recorder

The first recorder is single-track and event-based:

- Record note-on and note-off timestamps.
- Play/stop and loop.
- Set BPM.
- Quantise note starts and lengths.
- Grid values: 1/1, 1/2, 1/4 and 1/8.
- Save as an audio asset with source type `keyboard-sequence`.
- Export rendered WAV.

Piano roll editing, multitrack timelines, mixing and automation are later-only features.

---

## 9. ABC Player

### 9.1 Purpose

ABC Player is a quick notation sandbox. Paste ABC notation, validate it, listen to it and optionally register it in the audio library.

### 9.2 Required behaviour

- Plain-text ABC input.
- Play, Stop and Restart.
- BPM control where the notation supports it.
- Practical parse errors with line references where possible.
- Optional readable notation preview when the selected renderer supports it.
- Keep original ABC source intact until directly edited.
- Save as an asset with source type `abc-sequence`.
- Render/export WAV where practical.

ABC support starts as input/playback, not a full score editor.

---

## 10. Audio safety and lifecycle rules

Audio behaviour needs explicit safeguards because the app can generate sustained tones and noise.

- Audio begins only after a user gesture that enables the AudioContext.
- Master gain opens at a low safe default, never a surprise full-volume signal.
- Any continuous signal must have an obvious Stop Signal control.
- A global Stop All control stops Library preview, synth preview, frequency signal, keyboard notes and sequence playback.
- Switching selected assets must stop the outgoing sound cleanly.
- Navigating away, receiving `pagehide`, destroying the iframe or closing the app must stop active oscillators/nodes and suspend or close the AudioContext where safe.
- Object URLs created for imported/exported files must be revoked when no longer needed.
- Warn before importing unusually large audio files.

---

## 11. Organon layout and responsive rules

The first build should follow the Organon sub-app pattern rather than inventing a separate desktop product shell.

### Standard layout

- **Panel 1 — sticky sandstone header:** tool title, active workspace selector, compact quick preset selector, collapse/lock behaviour.
- **Panel 2 — black scrollable workspace:** cards for Library, Synth, Signal, Keyboard or ABC work.
- **Panel 3 — fixed sandstone footer:** context-aware primary action such as Save Asset, Start Signal, Stop Signal, Record or Export WAV.

The first app must remain compatible with the standard mobile-first Organon width model, including the 540px layout constraint. On desktop, controls may use denser two-column card rows *inside* that layout, but Phase 1 does not create a separate wide workstation UI.

### Mobile

- Use compact workspace tabs: Library, Create, Keyboard, ABC.
- Keep the transport/stop controls reachable at the bottom.
- Use grouped collapsible synth cards.
- Make the on-screen keyboard playable; do not shrink keys until they are unusable.
- Make Library search the first control rather than forcing long scrolling.

### Parent Hub integration

Use the existing Organon handshake:

```text
setHubStatus(text)
clearHubStatus()
```

Examples:

- `Preview selected audio asset`
- `Generate a controlled variation of this Coin sound`
- `Start a continuous 1,000 Hz sine reference tone`
- `Quantise recorded notes to the selected beat grid`
- `Save the current synth version as an audio asset`

---

## 12. Future cross-tool integration contract

This section documents a later integration, not work for the first build.

Future consumers such as Object Creator, Quest Builder and Effect Editor will use a common Audio Asset Picker that:

- Reads the shared `asset_` audio records.
- Supports search, category filter, favourites and quick preview.
- Saves only the selected `asset_` ID into the consumer’s own data.
- Does not copy blobs or duplicate media metadata into every tool.
- Shows `Audio asset unavailable — choose replacement` if an old reference cannot be resolved.

The first Ihy implementation must not add this picker to other tools or change their save contracts.

---

## 13. Technical foundations

### Required browser APIs

- Web Audio API for playback, oscillators, gain and synthesis.
- OfflineAudioContext for rendering when supported.
- IndexedDB for asset data and audio blobs.
- File input for imports.
- Blob/Object URL export for WAV and JSON downloads.
- Canvas or SVG for optional waveform/peak previews.

### Known boundaries

- A browser requires user interaction before AudioContext playback can start.
- WAV is the core export format. MP3 export is not a required first-build feature.
- Browser audio can be mathematically configured, but real-world playback is still dependent on the device and environment.
- The app should work without a backend or automatic external upload.

---

## 14. Delivery phases

### Phase 0 — foundation

- Ihy shell using Organon conventions.
- Iframe guard and Hub status bridge.
- IndexedDB/audio-asset schema.
- Local UI preferences.
- AudioContext enable and Stop All lifecycle logic.

### Phase 1 — first useful release: Audio Asset Library + Create Synth Sound

- Audio Asset Library with `asset_` IDs.
- Import WAV/MP3/OGG and supported formats.
- Library search, category, tags, favourites, preview, duplicate and delete.
- sfxr-style synthesis with starting families.
- Waveforms, envelope presets, controlled variation, Previous/Next history and starred versions.
- Save/register synth sounds as audio assets.
- WAV and synth-preset JSON export/import.
- Basic Signal mode: exact frequency, waveform, master gain, start/stop.

**Do not modify other Organon tools in this phase.**

### Phase 2 — Keyboard, sweep and arpeggiator

- On-screen and physical keyboard.
- Instrument presets.
- A4 reference setting and note calculation.
- Simple arpeggiator.
- Frequency sweep controls.
- Single-track recorder with BPM, quantisation and loop.

### Phase 3 — ABC Player

- Pasted ABC input/playback.
- Parse errors and notation preview where practical.
- Save/register ABC sequences as audio assets.
- WAV rendering/export when practical.

### Phase 4 — shared picker integration

- Implement the Audio Asset Picker in the appropriate later cross-tool pass.
- Add safe missing-asset/replacement states.
- Preserve the `asset_` reference model.

### Later only after real use shows the need

- Piano-roll editing.
- Multiple tracks.
- Project sound packs and asset bundles.
- Batch export.
- Asset-use audit across projects.
- More advanced synthesis modules.

---

## 15. Build rules

- Begin coding at **v0.01** and increase by **0.01** for each accepted implementation iteration.
- Keep source files modular; do not put library storage, audio engine, synth logic and all UI into one giant file.
- Use lowercase file and folder names unless an existing external path prevents that.
- Do not refactor working code unless the requested task requires it.
- Check all accepted changes on desktop and mobile.
- Do not open a user-facing preview window unless explicitly requested.
- This README is a plan only. Do not generate implementation code until Chris says **MAKE IT SO**.

---

## 16. Initial implementation structure

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
    organon-bridge.js
    audio-engine.js
    synth-engine.js
    signal-mode.js
    asset-library-db.js
    asset-library-ui.js
    keyboard.js
    arpeggiator.js
    recorder.js
    abc-player.js
    wav-export.js
  data/
    synth-presets.json
```

These files are a starting separation, not empty-file ceremony. Add a module only when a real implementation feature needs it.

---

## 17. Acceptance test for the Phase 1 release

Phase 1 is successful when all of the following work locally in a normal desktop browser:

1. Open Ihy through Organon.
2. Enable audio through an explicit user action.
3. Choose a Coin or Magic Sparkle starting family.
4. Hear a preview, adjust grouped controls and create a controlled variation.
5. Move backward/forward through variation history and star a version.
6. Save the chosen version as a named, tagged `asset_` audio asset.
7. Search, favourite and preview it in Library.
8. Export it as WAV and export its synth preset JSON.
9. Start and stop a continuous 1,000 Hz sine tone at a low default gain.
10. Refresh and find the saved assets retained locally.
11. Confirm no active audio continues after Stop All or app navigation.

When that works, Ihy has achieved the core purpose: reliable local creation and management of reusable Organon audio assets.