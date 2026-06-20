# Ihy — MIDI and Instrument Architecture Decision

**Applies to:** `tools/ihy/`  
**Status:** Approved planning direction  
**Companion document:** `README.md`  
**Purpose:** Decide what Ihy should use for playable MIDI instruments, MIDI import/export, MIDI preview, WAV rendering and later MP3 export.

---

## 1. Decision summary

Ihy must be able to create music that sounds like music, not only like oscillator beeps.

The chosen architecture is:

- **SpessaSynth / `spessasynth_lib`** is the preferred candidate for Ihy’s sample-based MIDI instrument and rendering layer.
- Ihy keeps its own lightweight Web Audio synth engine for chiptune, pure frequencies, sound effects, noise and custom generated sounds.
- **`html-midi-player` is not Ihy’s core engine.** It is an optional reference or later read-only preview component for imported MIDI files and piano-roll/staff/waterfall display.
- Ihy stores its own editable project model. A MIDI file is an import/export format, not the only source of truth.
- WAV and MP3 are rendered exports from the project. MIDI is the editable note-event export.

This avoids tying Ihy’s actual musical creation workflow to a visual MIDI-player component that is designed primarily for playback.

---

## 2. Why SpessaSynth is the preferred core

SpessaSynth is a JavaScript/WebAssembly SF2, SF3, DLS and MIDI library with a browser-oriented wrapper. It supports real-time and offline synthesis, MIDI read/write, multi-channel sequencing, effects, multiple sound banks and soundfont playback.

For Ihy, that solves the requirements that simple oscillator synth libraries do not:

- Play MIDI with sample-based instruments instead of only square/saw/sine tones.
- Load an approved General MIDI sound bank and map tracks to real instruments.
- Import existing `.mid` files for playback, inspection and later editing.
- Export an Ihy composition back into a standard `.mid` file.
- Render the exact same project with the selected sound bank to WAV offline rather than recording speaker output in real time.
- Keep instrument quality separate from the game-SFX synth engine.

The runtime library license and every selected sound bank license must be recorded separately before bundling anything into Organon.

---

## 3. Sound bank policy

### 3.1 What “decent instruments” means

The instrument bank must be sample-based or otherwise high enough quality that simple melodies can be made into usable draft music for Forever Bound, games and Organon projects.

It must not silently fall back to a basic oscillator when a requested instrument is unavailable.

A missing/unloaded instrument must show a visible loading or unavailable state.

### 3.2 Initial usable instrument set

The first bank does not need every General MIDI program exposed in the UI. It needs a curated practical set:

**Keys and mallets**

- Grand Piano
- Soft/Felt Piano
- Electric Piano
- Organ
- Celesta or Music Box
- Vibraphone or Marimba

**Strings and pads**

- Violin
- Cello
- String Ensemble
- Pizzicato Strings
- Warm Pad
- Cinematic Pad

**Guitars and bass**

- Acoustic Guitar
- Nylon Guitar
- Electric Guitar
- Acoustic Bass
- Electric Bass

**Winds and brass**

- Flute
- Clarinet
- Oboe
- Trumpet
- Trombone
- French Horn

**Other useful tones**

- Choir
- Bell
- Retro Lead
- Pluck
- Standard Drum Kit
- Noise/Percussion

The user can later load an external compatible SF2/SF3/DLS sound bank for experimentation. That imported bank remains local to their browser/device and is never uploaded by Ihy.

### 3.3 Bundled bank rule

Do not bundle a sound bank merely because it is used in a demo. Before selecting the default bank, verify:

- redistribution permission;
- modification permission if conversion/optimisation is required;
- attribution and notice requirements;
- final compressed size and first-load behaviour;
- audible quality for the curated instruments above.

The SpessaSynth demo currently uses a 30 MB GeneralUser GS sound bank, which proves the technical route, but it is not automatically the final Organon bundle choice.

### 3.4 Performance rule

- Load only the soundfont data required for the selected track/instrument where the engine permits it.
- Cache locally after a successful first load.
- Display progress for first-time bank/instrument loading.
- Give the user a lightweight “Synth only” fallback mode for slow devices, but never replace quality instruments without saying so.

---

## 4. Ihy project model

Ihy must retain editable source data independent of any exported file.

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
tracks                 Ordered list of track records.
createdAt              Timestamp.
updatedAt              Timestamp.
```

Each track contains:

```text
trackId                ihy_track_<stable-id>
name                   User-facing name.
instrumentId           Curated bank instrument or synth preset reference.
engineType             soundfont | synth | drum-kit.
channel                MIDI channel when exported.
muted                  True/false.
solo                   True/false.
volume                 Number.
pan                    Number.
transposeSemitones     Integer.
notes                  Note-on/off, pitch, velocity and timing events.
controllers            Sustain, modulation and other supported control data.
```

Ihy’s project file is the authoritative editable source. A MIDI export is a faithful note-based interchange version of that project. A WAV or MP3 export is a flattened audio mix.

---

## 5. Keyboard and composition behaviour

### 5.1 Track count

The composition UI starts with **four visible tracks** because it keeps the first usable version understandable:

1. Melody / lead.
2. Harmony / piano or guitar.
3. Bass / strings or pad.
4. Drums / percussion.

The underlying project model must not hard-code a four-track limit. The engine can support additional tracks later without changing saved project data.

### 5.2 Keyboard requirements

- On-screen piano with labelled note names and computer-key mappings.
- Physical computer keyboard input.
- Touch support.
- Octave shift.
- Global transpose.
- Sustain button and Space-key sustain while keyboard focus is active.
- Metronome, BPM and count-in.
- Velocity control for computer-key input.
- Optional Web MIDI input when the browser supports it.
- Instrument selector per armed track.
- Record arm, mute, solo, volume and pan per track.

### 5.3 Chiptune behaviour

Synth/chiptune sounds remain first-class instruments. The player can assign a retro lead, pluck, bass or custom saved synth asset to any track alongside sampled piano, cello or strings.

The arpeggiator applies to the currently played synth/chiptune track and is stored as editable musical timing/settings, not baked destructively into the project until rendering/export.

---

## 6. Import and export contract

### 6.1 MIDI import

The MIDI importer must:

- Read standard MIDI files that the selected engine supports.
- Create a new Ihy project or import into the current project only after an explicit choice.
- Preserve tempo, time signature, track names, note timing, pitch, duration, velocity, program/instrument information and supported controller data.
- Map imported tracks to the closest available curated instrument while showing the mapping to the user.
- Keep unsupported controller data where possible rather than silently discarding it.

### 6.2 MIDI export

MIDI export is required for note-based projects and ABC-derived sequences.

The exported `.mid` must include:

- tempo;
- time signature;
- track names;
- note on/off events;
- velocity;
- program changes/instrument mapping where applicable;
- channel assignment;
- pan, volume and sustain/controller events where supported;
- loop metadata only if it can be expressed safely in standard MIDI or a documented compatible form.

MIDI export does not apply to an arbitrary imported MP3/WAV or a rendered explosion sound. It applies to projects with note-event source data.

### 6.3 WAV export

WAV is the guaranteed high-quality output format.

- Render the complete project offline at 44.1 kHz stereo by default.
- Offer 48 kHz as an export option later.
- Render the same instrument bank, effects, automation and mix used during preview.
- Do not record tab/speaker audio in real time.
- Offer whole-project WAV export in the first composition release.
- Add per-track/stem WAV export only after the whole-project export is proved reliable.

### 6.4 MP3 export

MP3 export is required for quick listening/sharing copies, but must be added only after WAV export matches live playback.

The flow is:

```text
Ihy project → offline stereo PCM render → WAV encoder and MP3 encoder → downloaded file
```

The MP3 encoder must be bundled or locally loaded and licensed for redistribution. It must not upload the audio to an outside conversion service.

Default options:

```text
128 kbps  small preview
192 kbps  default listening export
320 kbps  high-quality listening export
```

---

## 7. Role of `html-midi-player`

`html-midi-player` is useful but not the Ihy core.

### Good later use

- A read-only “Imported MIDI Preview” panel.
- Optional piano-roll, waterfall or staff visualiser.
- Quick preview of a MIDI file before importing it into an editable Ihy project.
- A compact playback widget in a Library item detail view.

### Do not use it for

- The live multi-track composition engine.
- Ihy’s authoritative project model.
- Quality-instrument sound generation.
- MIDI writing/export.
- Offline WAV/MP3 rendering.

It is a playback/display component built around Magenta/Tone. Its own documented limitation that only one player can run at once makes it a poor foundation for a multi-track composer.

---

## 8. Technology direction by feature

| Ihy need | Chosen direction |
|---|---|
| Game SFX, tone generator, chiptune | Native Web Audio synth engine |
| Quality musical instruments | SpessaSynth browser wrapper + approved SoundFont/DLS bank |
| Project note model | Ihy-owned JSON track/note data |
| MIDI import/export | SpessaSynth MIDI read/write layer |
| Live composition playback | SpessaSynth for soundfont tracks; native Web Audio for synth tracks |
| Offline WAV render | SpessaSynth/offline audio render to PCM, then WAV writer |
| MP3 render | Local MP3 encoder applied to the same PCM render after licensing review |
| MIDI piano-roll/staff preview | Optional `html-midi-player` or Ihy-native visualiser later |
| Physical MIDI keyboard | Web MIDI where supported; computer keyboard remains the standard input route |

---

## 9. Revised roadmap impact

### Phase 1 — stays focused

- Audio Asset Library.
- Game-SFX synth.
- Variation history and favourites.
- WAV export for generated effects.
- Basic signal/frequency mode.

### Phase 2 — becomes Instrument & Composition Studio

- SpessaSynth proof of integration using one approved sound bank.
- Curated instrument picker.
- Four-track composition interface.
- On-screen and computer keyboard input.
- Sustain, transpose, metronome, count-in and quantisation.
- MIDI import/export.
- Offline whole-project WAV export.
- Chiptune/synth instruments selectable per track.

### Phase 3 — listening export, ABC and visual MIDI preview

- Local MP3 encoder and 128/192/320 kbps export.
- ABC import/playback converted into the Ihy project model where applicable.
- Optional MIDI piano-roll/staff/waterfall preview layer.
- Optional Web MIDI input.

### Phase 4 — cross-tool asset picker

- Audio assets created from rendered cues or exported stems become available to later Organon tools through the shared `asset_` model.

---

## 10. Acceptance test for the Instrument & Composition Studio

A successful Phase 2 composition build can:

1. Select Grand Piano, Cello, Warm Pad and Drum Kit on four tracks.
2. Play each one from the on-screen or computer keyboard with clearly different instrument sounds.
3. Record a short loop with count-in and a metronome.
4. Mute/solo tracks and alter track volume/pan.
5. Save and reload the editable Ihy project locally.
6. Export a standard MIDI file and re-import it with the same notes/tracks intact.
7. Render a WAV that audibly matches live playback.
8. Stop all live and rendered playback cleanly when leaving Ihy.

The Phase 3 build adds: export the same composition as a locally generated MP3, without sending project audio to an external service.
