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
