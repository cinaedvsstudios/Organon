# Ihy — Organon Sound Library, Synth & Music Workshop

**Status:** Planning only  
**Version:** 0.03  
**Path:** `tools/ihy/`  
**App role:** A local-first Organon workshop for game sound effects, quality playable instruments, short music composition, MIDI/ABC import and export, and reusable audio assets.

---

## 1. Product definition

Ihy is not a full DAW and it is not a replacement for Onda.

- **Onda** remains the music player and listener-facing library.
- **Ihy** is where Organon audio is created, imported, edited, rendered and registered as reusable assets.

Ihy combines five connected jobs:

1. **Audio Asset Library** — store generated, imported and rendered audio as searchable `asset_` records.
2. **Create Synth Sound** — make game SFX, chiptune sounds, tone effects and controlled sound variations.
3. **Signal & Frequency Mode** — produce exact requested continuous reference tones, sweeps and noise signals for sound design and simple hearing/reference checks.
4. **Instrument & Composition Studio** — play quality sample-based instruments or synth instruments; record short music in editable tracks.
5. **Sequence & Notation Tools** — import/export MIDI, paste/play ABC notation, and render projects to WAV and MP3.

The point is not to imitate a commercial studio. The point is to make good-enough music cues, stingers, game sounds and reusable audio assets quickly, entirely in the browser and without automatically uploading anything.

---

## 2. Non-negotiable decisions

### 2.1 Audio assets use the existing asset model

Generated synth sounds, imported WAV/MP3/OGG files, keyboard projects and rendered music cues are all normal audio assets.

```text
id: asset_<stable-id>
mediaType: audio
```

Ihy must not introduce a competing `sound_` or `ihy_` media-ID system.

### 2.2 Ihy owns source data, not just exports

An editable Ihy project is the authoritative source. MIDI is an interchange/export format. WAV and MP3 are rendered audio outputs.

```text
Editable Ihy project → MIDI export
Editable Ihy project → offline render → WAV export
Editable Ihy project → offline render → MP3 export
```

### 2.3 Two sound engines

Ihy needs two complementary engines:

- **Native Web Audio synth engine** for game SFX, pure tones, chiptune instruments, noise, sweeps, custom envelopes and generated effects.
- **Sample-based instrument engine** for decent piano, strings, guitars, winds, brass, choir and drums.

A quality instrument must never silently fall back to a cheap oscillator sound. Show loading, unavailable or Synth Only status clearly.

### 2.4 Preferred MIDI/instrument candidate

The preferred candidate for the sample-based instrument and MIDI layer is **SpessaSynth / `spessasynth_lib`**, subject to implementation proof and licence review. It is the right direction because Ihy needs real soundfont-style instruments, MIDI import/export and offline audio rendering.

`html-midi-player` is not the composition engine. It is only a possible later component for imported-MIDI preview, piano-roll, waterfall or staff display.

---

## 3. Audio Asset Library

### 3.1 Purpose

The Library is the centre of Ihy. It is where a generated or imported sound becomes a registered Organon audio asset.

### 3.2 Asset record

```text
id                 asset_<stable-id>
mediaType          audio
name               User-facing asset name.
sourceType         synth | imported-audio | ihy-project | keyboard-sequence | abc-sequence.
category           Primary category.
tags               User-editable tags.
favourite          True/false.
createdAt          Timestamp.
updatedAt          Timestamp.
durationMs         Rendered or imported duration.
fileName           Source/export filename where relevant.
mimeType           Audio MIME type where known.
audioBlob          Imported or rendered audio data where required.
previewPeaks       Lightweight waveform preview data where practical.
synthPreset        Saved synth state for sourceType synth.
projectData        Editable project data for sourceType ihy-project.
sequenceData       Note events for keyboard sequence data.
abcSource          Original ABC notation where relevant.
```

### 3.3 Default categories

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

### 3.4 Required library behaviour

- Search matching name, category and tags.
- Category filters, favourites-only filter and sorting.
- Quick preview plus a global Stop All control.
- Rename, retag, duplicate and delete.
- Favourite/star assets.
- Show source settings where an item came from synth, MIDI project or ABC notation.
- Import supported local audio files, including WAV, MP3, OGG and browser-supported formats.
- Export selected rendered audio as WAV.
- Export/import editable synth presets as JSON.
- Warn before deletion when a later project-reference scan finds the asset is used elsewhere.

### 3.5 Storage

Use IndexedDB for audio blobs, instrument caches, asset metadata and project data. Use localStorage only for small interface preferences.

```text
Database: organon-asset-library
Store: assets
Schema version: 1
```

No audio is uploaded automatically.

---

## 4. Create Synth Sound — game effects and chiptune

### 4.1 Design goal

Create Synth Sound follows an sfxr-style workflow:

1. Choose a recognisable sound family.
2. Hear it immediately.
3. Adjust a small grouped set of meaningful controls.
4. Create controlled variations without losing good results.
5. Save the chosen version as an `asset_` audio item.

It must not open as a giant wall of synthesis controls.

### 4.2 Starting sound families

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

### 4.3 Core waveforms

- Sine.
- Square.
- Sawtooth.
- Triangle.
- White noise.

### 4.4 Grouped controls

**Source and pitch**

- Waveform.
- Base pitch in Hz and note form.
- Pitch slide up/down.
- Vibrato/pitch wobble.
- Pitch-step/arpeggio amount.

**Envelope**

- Attack.
- Decay.
- Sustain.
- Release.
- Overall length.
- Quick envelopes: Continuous, 8-Bit Pluck, Short Hit, Soft Fade, Charge.

**Tone and texture**

- Low-pass/high-pass filters.
- Resonance where useful.
- Noise mix.
- Bit-crush/sample-rate reduction.
- Tremolo.
- Phaser/sweep texture.
- Stereo pan.
- Output gain.

Every slider needs a readable value and a reset-to-current-preset-default action.

### 4.5 Controlled variation and history

- Subtle variation.
- Strong variation.
- Lock protected parameters.
- Previous/Next variation history.
- Star a good version.
- Optional repeatable seed.
- Undo/redo after variation or manual changes.

A Coin preset may vary pitch, duration and sparkle. It must not unpredictably become a long distorted drone.

### 4.6 Rendering

Synth effects are rendered through Web Audio and OfflineAudioContext where practical. Do not record speaker/tab output in real time to produce a WAV.

---

## 5. Signal & Frequency Mode

### 5.1 Purpose

Signal mode is the retained Pure Frequency Generator concept. It produces requested continuous signals for sound design, reference tones, frequency sweeps and simple hearing/reference checks.

It is not laboratory-calibration equipment. Real-world playback still depends on browser, operating system, audio hardware, speakers/headphones, room and volume.

### 5.2 Required controls

- Sine, square, sawtooth, triangle and white-noise signals.
- Numeric frequency entry with decimal support.
- 20 Hz–20,000 Hz slider, logarithmic by default.
- Live Hz readout, for example `440.00 Hz`.
- Master gain.
- Start Signal / Stop Signal.
- Sweep start, sweep end, direction and duration.
- Continuous sustain distinct from normal envelope-gated notes.

### 5.3 Quick reference presets

```text
A4 reference: 440 Hz
Alternative reference: 432 Hz
Alternative reference: 528 Hz
Low test tone: 100 Hz
Reference sine tone: 1,000 Hz
```

These are convenient stored settings only. Do not attach unsupported medical, mystical or certified-calibration claims to them.

### 5.4 Equal-temperament note calculation

For keyboard notes, Ihy uses:

```text
f(n) = A4 × 2^(n / 12)
```

`n` is the number of semitones away from A4. The default A4 reference is 440 Hz and can be changed in keyboard settings.

---

## 6. Quality instruments and sound banks

### 6.1 Requirement

Ihy must produce musical instruments that are usable for draft scores, game cues and Forever Bound material—not only retro oscillators.

The sample-based engine should use a properly licensed SoundFont/DLS-style instrument bank. SpessaSynth is the preferred technical route, subject to an implementation proof and review of both library and sound-bank licence terms.

### 6.2 Curated first instrument bank

Do not expose a meaningless list of hundreds of near-duplicate General MIDI names. Start with a practical curated set.

**Keys and mallets**

- Grand Piano.
- Soft/Felt Piano.
- Electric Piano.
- Organ.
- Celesta or Music Box.
- Vibraphone or Marimba.

**Strings and pads**

- Violin.
- Cello.
- String Ensemble.
- Pizzicato Strings.
- Warm Pad.
- Cinematic Pad.

**Guitars and bass**

- Acoustic Guitar.
- Nylon Guitar.
- Electric Guitar.
- Acoustic Bass.
- Electric Bass.

**Winds and brass**

- Flute.
- Clarinet.
- Oboe.
- Trumpet.
- Trombone.
- French Horn.

**Other useful instruments**

- Choir.
- Bell.
- Retro Lead.
- Pluck.
- Standard Drum Kit.
- Noise/Percussion.

### 6.3 Sound bank rules

Before bundling any default sound bank, verify:

- redistribution and modification permission;
- attribution/notice requirements;
- compression and first-load size;
- audible quality of the curated instrument set;
- reliable local caching behaviour.

The user can later load their own compatible SF2/SF3/DLS bank locally. That imported bank remains on their device and is never uploaded.

### 6.4 Performance rules

- Load only what the selected instrument/track needs where the engine permits it.
- Cache successful sound-bank loads locally.
- Show a real loading state for first-time instrument use.
- Keep a clearly labelled Synth Only fallback for slow devices.
- Never silently replace a missing sample-based instrument with a square wave.

---

## 7. Instrument & Composition Studio

### 7.1 Purpose

This is a compact composition tool for short cues, loops, themes, stingers and game music. It is not a full DAW.

### 7.2 Initial track layout

The first visible UI starts with four tracks:

1. Melody / lead.
2. Harmony / piano or guitar.
3. Bass / strings or pad.
4. Drums / percussion.

The underlying project data must not hard-code four as a permanent maximum.

### 7.3 Project model

```text
projectId              ihy_project_<stable-id>
name                   User project title.
tempoBpm               Number.
timeSignature          Numerator/denominator.
loopStartBeat          Optional beat position.
loopEndBeat            Optional beat position.
masterVolume           Number.
masterReverb           Number.
masterChorus           Number.
tracks                 Ordered track list.
createdAt              Timestamp.
updatedAt              Timestamp.
```

Each track stores:

```text
trackId                ihy_track_<stable-id>
name                   User-facing name.
instrumentId           Sample-based instrument or saved synth preset reference.
engineType             soundfont | synth | drum-kit.
channel                MIDI channel when exported.
muted                  True/false.
solo                   True/false.
volume                 Number.
pan                    Number.
transposeSemitones     Integer.
notes                  Note-on/off, pitch, velocity and timing events.
controllers            Sustain, modulation and supported controller data.
```

### 7.4 Keyboard requirements

- On-screen piano with note names and computer-key labels.
- Physical computer keyboard input.
- Touch support.
- Octave shift.
- Global transpose.
- Sustain button and Space-key sustain while keyboard focus is active.
- Metronome, BPM and count-in.
- Computer-key velocity control.
- Instrument selector per armed track.
- Record arm, mute, solo, volume and pan per track.
- Optional physical MIDI-controller input where the browser supports it; computer keyboard remains the standard input route.

### 7.5 Chiptune behaviour

Synth/chiptune instruments remain first-class. A project may combine a sample-based piano, cello or strings with retro lead, pluck, bass and custom Ihy synth sounds.

The arpeggiator applies to the active synth/chiptune instrument and stores editable timing/settings rather than destructively baking notes until render/export.

### 7.6 Recorder

- Record note-on/note-off events with timing and velocity.
- Play/stop and loop.
- BPM, metronome and count-in.
- Quantise note starts and lengths.
- Initial grids: 1/1, 1/2, 1/4 and 1/8.
- Keep projects editable after recording.

Piano-roll editing, automation, advanced mixing and unlimited tracks are later enhancements.

---

## 8. MIDI, WAV and MP3

### 8.1 MIDI import

The importer must:

- Read supported standard MIDI files.
- Let the user choose new project or import into current project.
- Preserve tempo, time signature, track names, note timing, pitch, duration, velocity, program/instrument information and supported controller data.
- Show the user how imported tracks map to the closest available Ihy instruments.
- Retain unsupported data where practical instead of silently discarding it.

### 8.2 MIDI export

MIDI export is required for note-based Ihy projects and ABC-derived sequences.

Exported `.mid` files include:

- tempo;
- time signature;
- track names;
- note on/off events;
- velocity;
- program changes/instrument mapping where applicable;
- channel assignment;
- pan, volume and sustain/controller events where supported.

An arbitrary imported MP3/WAV or rendered game explosion cannot be converted into meaningful editable MIDI. MIDI export applies to note-event projects.

### 8.3 WAV export

WAV is the required high-quality audio export.

- Render the whole project offline to stereo PCM at 44.1 kHz by default.
- Add 48 kHz later if needed.
- Use the same selected instruments, effects and mix as live playback.
- Do not record speaker/tab audio in real time.
- Whole-project WAV export is required before per-track/stem export.

### 8.4 MP3 export

MP3 is required for quick listening and sharing copies, after WAV rendering matches live playback.

```text
Ihy project → offline stereo PCM render → WAV encoder and MP3 encoder → downloaded file
```

The MP3 encoder must run locally in the browser and must be suitable for redistribution. Do not use an external conversion service.

Initial bitrate choices:

```text
128 kbps  small preview
192 kbps  default listening export
320 kbps  high-quality listening export
```

---

## 9. ABC notation

ABC is a lightweight notation input/playback feature, not a full score editor.

Required behaviour:

- Paste editable ABC text.
- Play, Stop and Restart.
- BPM control where notation supports it.
- Practical parse errors with line references where possible.
- Optional notation preview when a renderer supports it.
- Save original ABC source in the asset/project data.
- Convert note-based ABC material into the Ihy project model where practical.
- Export compatible ABC-derived projects as MIDI, WAV and MP3.

---

## 10. Optional role of html-midi-player

`html-midi-player` may be used later for:

- Read-only imported-MIDI preview.
- Piano-roll, waterfall or staff display.
- A compact playback preview before importing MIDI into an editable Ihy project.
- Library-item MIDI visualisation.

Do not use it as:

- Ihy’s multi-track composer.
- The authoritative project model.
- The sample-based instrument engine.
- MIDI writing/export logic.
- Offline WAV/MP3 rendering.

---

## 11. Audio safety and lifecycle

- Audio starts only after a user gesture enables AudioContext.
- Default master gain is deliberately low.
- Continuous tones have an obvious Stop Signal action.
- Global Stop All stops library preview, synth preview, signal mode, keyboard notes and project playback.
- Changing selected assets stops outgoing playback cleanly.
- `pagehide`, app close, iframe destruction and navigation stop active nodes and suspend/close audio contexts where safe.
- Revoke Object URLs when no longer needed.
- Warn before importing unusually large audio files.

---

## 12. Organon layout and responsive rules

Ihy uses the standard Organon mobile-first application shell.

### Standard layout

- **Sticky sandstone header:** tool title, workspace selector, compact quick presets, collapse/lock behaviour.
- **Black scrollable centre:** workspace cards for Library, Create, Signal, Compose or ABC.
- **Fixed sandstone footer:** context-aware primary actions such as Save Asset, Start/Stop Signal, Record, Render WAV or Export MIDI.

The initial app remains compatible with Organon’s 540px mobile-first layout. Desktop may use denser two-column rows within that shell, but Phase 1 does not create a separate desktop-only product layout.

### Mobile

- Workspace tabs: Library, Create, Signal, Compose, ABC.
- Keep Stop All and current transport reachable at the bottom.
- Use collapsible control groups.
- Keep the on-screen keyboard playable; do not shrink keys into unusable targets.
- Make Library search the first interaction rather than forcing long lists.

### Parent Hub handshake

Use:

```text
setHubStatus(text)
clearHubStatus()
```

Examples:

- `Preview selected audio asset`
- `Create a controlled variation of this Coin sound`
- `Start a continuous 1,000 Hz sine tone`
- `Record notes to the armed Cello track`
- `Render the current composition as a WAV file`
- `Export the project as standard MIDI`

---

## 13. First-build boundaries

The first implementation is standalone Ihy only. It must not alter Object Creator, Quest Builder, Effect Editor, Puzzle Creator, Scene Editor or other tool runtime code in the same pass.

Future cross-tool work will use a common Audio Asset Picker which:

- reads shared `asset_` audio items;
- supports search, categories, favourites and quick preview;
- saves only the selected `asset_` ID into another tool’s data;
- never copies audio blobs into every tool;
- displays `Audio asset unavailable — choose replacement` where an old reference cannot resolve.

---

## 14. Delivery roadmap

### Phase 0 — foundation

- Ihy shell, iframe guard and Hub status bridge.
- IndexedDB audio-asset and project schema.
- Local UI preferences.
- AudioContext enable flow and Stop All lifecycle logic.

### Phase 1 — Audio Asset Library + Create Synth Sound

- Asset Library with `asset_` IDs.
- Import local WAV/MP3/OGG/supportable formats.
- Search, categories, tags, favourites, preview, duplicate and delete.
- sfxr-style synth families and grouped controls.
- Controlled variation history, starred versions and undo/redo.
- Save synth versions as assets.
- WAV and synth-preset JSON export/import.
- Basic Signal mode: exact frequency, waveform, gain and Start/Stop.

### Phase 2 — Instrument & Composition Studio

- SpessaSynth proof-of-integration using one approved sound bank.
- Curated instrument picker.
- Four visible tracks with future-safe project model.
- On-screen/computer keyboard input, sustain, transpose, metronome, count-in and quantisation.
- Chiptune/synth instruments selectable alongside sample-based instruments.
- MIDI import/export.
- Offline whole-project WAV rendering.

### Phase 3 — Listening export, ABC and MIDI visualisation

- Local MP3 encoder with 128/192/320 kbps choices.
- ABC input, playback and project conversion where practical.
- Optional MIDI piano-roll/staff/waterfall preview.
- Optional physical MIDI-controller input.

### Phase 4 — Cross-tool audio picker

- Shared Audio Asset Picker for future relevant Organon tools.
- Missing-asset replacement flow.
- Project asset-use audit later.

### Later only when genuinely needed

- Piano-roll editor.
- More tracks.
- Automation and advanced mixing.
- Per-track/stem WAV exports.
- Project sound packs/backups.
- Batch export.
- Additional advanced synthesis modules.

---

## 15. Build rules

- Begin coding at **v0.01** and increase by **0.01** after each accepted implementation iteration.
- Keep code modular; do not place storage, audio engine, synth logic, MIDI logic and all UI in one giant file.
- Use lowercase filenames/folders unless an existing external path prevents it.
- Do not refactor working code unless the request requires it.
- Check accepted work on desktop and mobile.
- Do not open user-facing preview windows unless explicitly requested.
- Before bundling external code or sound banks, verify licence and attribution requirements.
- This README is the controlling plan. Do not generate implementation code until Chris says **MAKE IT SO**.

---

## 16. Proposed implementation structure

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
    project-model.js
    composition-engine.js
    instrument-bank.js
    keyboard.js
    arpeggiator.js
    recorder.js
    midi-io.js
    abc-player.js
    offline-render.js
    wav-export.js
    mp3-export.js
  data/
    synth-presets.json
    instrument-catalog.json
```

Add a module only when a real feature needs it. This structure is not an instruction to create empty files.

---

## 17. Acceptance tests

### Phase 1 success

1. Open Ihy through Organon.
2. Enable audio through an explicit action.
3. Choose Coin or Magic Sparkle.
4. Preview, adjust controls and create controlled variations.
5. Step through history and star a version.
6. Save it as a named/tagged `asset_` audio asset.
7. Find, favourite and preview it from Library after a refresh.
8. Export its WAV and synth-preset JSON.
9. Start/stop a low-gain 1,000 Hz sine signal.
10. Confirm Stop All and navigation leave no audio playing.

### Phase 2 success

1. Select Grand Piano, Cello, Warm Pad and Drum Kit on four tracks.
2. Play clearly different instruments from on-screen/computer keyboard input.
3. Record a short loop with count-in and metronome.
4. Mute/solo tracks and adjust volume/pan.
5. Save and reload the editable Ihy project locally.
6. Export standard MIDI and re-import the notes/tracks intact.
7. Render WAV that audibly matches live playback.
8. Confirm audio stops cleanly when leaving Ihy.

### Phase 3 success

1. Export the same composition as a locally generated MP3 at selected bitrate.
2. Paste valid ABC notation, hear it, save it and convert it into a compatible MIDI/WAV/MP3 project flow.
3. Use an optional visual MIDI preview without making it the composition engine.
