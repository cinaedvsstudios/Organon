(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const VERSION = '0.12';
  const MIN_PIANO = 36;
  const MAX_PIANO = 96;
  const GRID_MIN = 48;
  const GRID_MAX = 84;
  const BEATS = 64;
  const ROW_HEIGHT = 24;
  const COLORS = ['#b68cff', '#60c6a4', '#dfb658', '#dc7898', '#79b4e3'];
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const KEYBOARD_MAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72 };
  const INSTRUMENTS = [
    ['grand_piano', 'Grand Piano'], ['soft_piano', 'Soft Piano'], ['cello', 'Cello'], ['strings', 'Strings'],
    ['flute', 'Flute'], ['horn', 'French Horn'], ['choir', 'Choir'], ['warm_pad', 'Warm Pad'],
    ['bell', 'Bell'], ['acoustic_guitar', 'Acoustic Guitar'], ['electric_bass', 'Electric Bass'],
    ['drum_kit', 'Drum Kit'], ['retro_lead', 'Retro Lead'], ['pluck', 'Pluck']
  ];
  const SOUND_FONT_NAMES = {
    grand_piano: 'acoustic_grand_piano', soft_piano: 'acoustic_grand_piano', cello: 'cello',
    strings: 'string_ensemble_1', flute: 'flute', horn: 'french_horn', choir: 'choir_aahs',
    warm_pad: 'pad_2_warm', bell: 'tubular_bells', acoustic_guitar: 'acoustic_guitar_nylon',
    electric_bass: 'electric_bass_finger', drum_kit: 'synth_drum', retro_lead: 'lead_1_square', pluck: 'pizzicato_strings'
  };
  const KEY_SCALES = {
    'C major': { root: 0, intervals: [0, 2, 4, 5, 7, 9, 11] },
    'D minor': { root: 2, intervals: [0, 2, 3, 5, 7, 8, 10] },
    'A minor': { root: 9, intervals: [0, 2, 3, 5, 7, 8, 10] },
    'F major': { root: 5, intervals: [0, 2, 4, 5, 7, 9, 11] },
    'G major': { root: 7, intervals: [0, 2, 4, 5, 7, 9, 11] }
  };
  const PRESETS = [
    ['Coin', 'bright pickup', 988, .22], ['Magic Sparkle', 'shimmering charm', 740, .72],
    ['Laser', 'retro projectile', 1180, .3], ['Jump', 'arcade rise', 280, .24], ['Portal', 'sweeping gate', 220, 1.1]
  ];

  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const noteName = pitch => `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
  const makeNote = (start, pitch, duration = 1, velocity = 92) => ({ id: uid(), start, pitch, duration, velocity, instrument: null });

  function defaultProject() {
    return {
      title: 'Untitled cue', bpm: 92, key: 'D minor',
      sections: [
        { id: uid(), name: 'Intro', start: 0, end: 16, color: COLORS[2] },
        { id: uid(), name: 'Theme', start: 16, end: 40, color: COLORS[0] },
        { id: uid(), name: 'Ending', start: 40, end: 64, color: COLORS[1] }
      ],
      tracks: [
        { id: uid(), name: 'Melody', instrument: 'grand_piano', color: COLORS[0], muted: false, solo: false, notes: [makeNote(0, 69), makeNote(2, 72), makeNote(4, 74, 2)] },
        { id: uid(), name: 'Cello', instrument: 'cello', color: COLORS[1], muted: false, solo: false, notes: [makeNote(0, 50, 4), makeNote(4, 53, 4)] },
        { id: uid(), name: 'Pad', instrument: 'warm_pad', color: COLORS[2], muted: false, solo: false, notes: [makeNote(0, 57, 8)] },
        { id: uid(), name: 'Drums', instrument: 'drum_kit', color: COLORS[3], muted: false, solo: false, notes: [makeNote(0, 60, .25), makeNote(1, 60, .25), makeNote(2, 60, .25), makeNote(3, 60, .25)] }
      ]
    };
  }

  function normaliseProject(data) {
    const fallback = defaultProject();
    if (!data || !Array.isArray(data.tracks) || !data.tracks.length) return fallback;
    return {
      ...fallback,
      ...data,
      tracks: data.tracks.map((track, index) => ({
        ...fallback.tracks[0], ...track,
        id: track.id || uid(), color: track.color || COLORS[index % COLORS.length],
        muted: Boolean(track.muted), solo: Boolean(track.solo),
        notes: Array.isArray(track.notes) ? track.notes.map(note => ({ ...makeNote(0, 60), ...note, id: note.id || uid() })) : []
      })),
      sections: Array.isArray(data.sections) && data.sections.length ? data.sections.map((section, index) => ({
        id: section.id || uid(), name: section.name || `Section ${index + 1}`,
        start: Number(section.start) || 0, end: Number(section.end) || 8,
        color: section.color || COLORS[index % COLORS.length]
      })) : fallback.sections
    };
  }

  let project;
  try { project = normaliseProject(JSON.parse(localStorage.getItem('ihy-v012') || localStorage.getItem('ihy-v011') || localStorage.getItem('ihy-v009') || localStorage.getItem('ihy-v008'))); }
  catch (_) { project = defaultProject(); }

  let activeTrackId = project.tracks[0].id;
  let beatWidth = 40;
  let selectedNote = null;
  let noteDrag = null;
  let noteMenuRef = null;
  let timelineDragging = false;
  let playheadBeat = 0;
  let isPlaying = false;
  let playbackStartedAt = 0;
  let playbackStartBeat = 0;
  let animationFrame = 0;
  let playbackTimers = [];
  let pressedKeys = new Set();
  let isRecording = false;
  let recordStartedAt = 0;
  let metronomeEnabled = false;
  let chordMode = localStorage.getItem('ihy-chord-mode') === 'true';
  let playbackRequest = 0;
  let audioContext = null;
  let masterGain = null;
  let sourceStops = [];
  const samplePlayers = new Map();
  const sampleLoads = new Map();

  const getTrack = id => project.tracks.find(track => track.id === id);
  const instrumentName = id => (INSTRUMENTS.find(item => item[0] === id) || [id, id])[1];
  const secondsPerBeat = () => 60 / Math.max(30, Number(project.bpm) || 92);
  const noteFrequency = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const snap = value => {
    const unit = Number($('#quant').value || .25);
    return Math.round(value / unit) * unit;
  };

  function setStatus(message, timeout = 3400) {
    $('#status').textContent = message;
    clearTimeout(setStatus.timer);
    if (timeout) setStatus.timer = setTimeout(() => { $('#status').textContent = 'v0.12 — click notes, chord mode and inline note editor.'; }, timeout);
  }

  function ensureAudio() {
    if (audioContext) {
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      return audioContext;
    }
    const AudioApi = window.AudioContext || window.webkitAudioContext;
    if (!AudioApi) return null;
    audioContext = new AudioApi();
    masterGain = audioContext.createGain();
    masterGain.gain.value = .72;
    masterGain.connect(audioContext.destination);
    return audioContext;
  }

  async function loadSampleInstrument(instrumentId) {
    if (!window.Soundfont || !SOUND_FONT_NAMES[instrumentId]) return null;
    if (samplePlayers.has(instrumentId)) return samplePlayers.get(instrumentId);
    if (sampleLoads.has(instrumentId)) return sampleLoads.get(instrumentId);
    const context = ensureAudio();
    if (!context) return null;
    const load = window.Soundfont.instrument(context, SOUND_FONT_NAMES[instrumentId], {
      soundfont: 'MusyngKite', format: 'mp3', destination: masterGain, gain: .9
    }).then(player => {
      samplePlayers.set(instrumentId, player);
      sampleLoads.delete(instrumentId);
      return player;
    }).catch(error => {
      console.error('Ihy sample instrument failed to load:', instrumentId, error);
      sampleLoads.delete(instrumentId);
      setStatus(`${instrumentName(instrumentId)} samples could not load — temporary synth fallback is active.`, 6000);
      return null;
    });
    sampleLoads.set(instrumentId, load);
    return load;
  }

  function synthVoice(instrument, midi, velocity, durationSeconds, when) {
    const context = ensureAudio();
    if (!context) return;
    const volume = clamp((velocity || 92) / 127, .08, 1);
    const config = { wave: 'triangle', hz: noteFrequency(midi), gain: .10 * volume, length: Math.max(.08, durationSeconds), slide: 1 };
    if (instrument === 'retro_lead') { config.wave = 'square'; config.gain = .11 * volume; }
    else if (instrument === 'drum_kit') { config.wave = 'square'; config.hz = 120; config.length = .12; }
    else if (instrument === 'cello' || instrument === 'horn') { config.wave = 'sawtooth'; config.gain = .07 * volume; }
    else if (instrument === 'bell') { config.wave = 'sine'; config.slide = .502; }
    else if (instrument === 'flute' || instrument === 'warm_pad' || instrument === 'choir') { config.wave = 'sine'; }
    const output = context.createGain();
    output.gain.setValueAtTime(.0001, when);
    output.gain.exponentialRampToValueAtTime(Math.max(.0001, config.gain), when + .012);
    output.gain.exponentialRampToValueAtTime(.0001, when + config.length);
    output.connect(masterGain);
    const oscillator = context.createOscillator();
    oscillator.type = config.wave;
    oscillator.frequency.setValueAtTime(config.hz, when);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, config.hz * config.slide), when + config.length);
    oscillator.connect(output);
    oscillator.start(when);
    oscillator.stop(when + config.length + .07);
    const stop = () => { try { oscillator.stop(); oscillator.disconnect(); output.disconnect(); } catch (_) {} };
    sourceStops.push(stop);
    oscillator.onended = () => { sourceStops = sourceStops.filter(item => item !== stop); };
  }

  function playLoadedSample(player, midi, velocity, durationSeconds, when) {
    try {
      const node = player.play(midi, when, {
        duration: Math.max(.08, durationSeconds), gain: clamp((velocity || 92) / 127, .12, .96),
        attack: .005, release: Math.min(.35, Math.max(.08, durationSeconds * .35))
      });
      if (node?.stop) sourceStops.push(() => { try { node.stop(); } catch (_) {} });
      return true;
    } catch (error) {
      console.error('Ihy sample playback failed:', error);
      return false;
    }
  }

  function setKeyGlow(midi, on) {
    const key = document.querySelector(`.key[data-pitch="${midi}"]`);
    if (!key) return;
    const next = Math.max(0, Number(key.dataset.glowCount || 0) + (on ? 1 : -1));
    key.dataset.glowCount = next;
    key.classList.toggle('playing', next > 0);
  }

  function scheduleGlow(midi, delayMs, durationMs) {
    const startTimer = window.setTimeout(() => {
      setKeyGlow(midi, true);
      const endTimer = window.setTimeout(() => setKeyGlow(midi, false), Math.max(90, durationMs));
      playbackTimers.push(endTimer);
    }, Math.max(0, delayMs));
    playbackTimers.push(startTimer);
  }

  function clearGlows() {
    $$('.key.playing').forEach(key => { key.classList.remove('playing'); key.dataset.glowCount = '0'; });
  }

  function setPlayhead(beat, follow = false) {
    playheadBeat = clamp(beat, 0, BEATS);
    const left = `${playheadBeat * beatWidth}px`;
    const rollHead = $('#playhead');
    const timelineHead = $('#timelinePlayhead');
    if (rollHead) rollHead.style.left = left;
    if (timelineHead) timelineHead.style.left = left;
    if (follow) {
      const scroll = $('.scroll');
      const target = playheadBeat * beatWidth;
      if (target > scroll.scrollLeft + scroll.clientWidth - 120) scroll.scrollLeft = Math.max(0, target - scroll.clientWidth * .35);
    }
  }

  function stopPlayback(reset = false) {
    playbackRequest += 1;
    playbackTimers.forEach(timer => clearTimeout(timer));
    playbackTimers = [];
    sourceStops.splice(0).forEach(stop => stop());
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    isPlaying = false;
    clearGlows();
    if (reset) setPlayhead(0);
  }

  function animatePlayback() {
    if (!isPlaying) return;
    const beat = playbackStartBeat + ((performance.now() - playbackStartedAt) / 1000) / secondsPerBeat();
    if (beat >= BEATS) {
      stopPlayback(true);
      setStatus('Playback reached the end.');
      return;
    }
    setPlayhead(beat, true);
    animationFrame = requestAnimationFrame(animatePlayback);
  }

  async function playProject() {
    closeNoteMenu();
    stopPlayback(false);
    const requestId = ++playbackRequest;
    const soloed = project.tracks.some(track => track.solo);
    const activeTracks = project.tracks.filter(track => !track.muted && (!soloed || track.solo));
    const needed = [...new Set(activeTracks.flatMap(track => [track.instrument, ...track.notes.map(note => note.instrument).filter(Boolean)]))];
    const missing = needed.filter(id => SOUND_FONT_NAMES[id] && !samplePlayers.has(id));
    if (missing.length) setStatus(`Loading sampled ${missing.map(instrumentName).join(', ')}…`, 0);
    await Promise.all(needed.map(loadSampleInstrument));
    if (requestId !== playbackRequest) return;
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime + .08;
    const startBeat = playheadBeat;
    const beatSeconds = secondsPerBeat();
    for (const track of activeTracks) {
      for (const note of track.notes) {
        const end = note.start + note.duration;
        if (end <= startBeat) continue;
        const actualStart = Math.max(startBeat, note.start);
        const duration = end - actualStart;
        const delay = (actualStart - startBeat) * beatSeconds;
        const instrument = note.instrument || track.instrument;
        const pitch = clamp(note.pitch + Number($('#transpose').value || 0), MIN_PIANO, MAX_PIANO);
        const player = samplePlayers.get(instrument);
        if (player) playLoadedSample(player, pitch, note.velocity, duration * beatSeconds, now + delay);
        else synthVoice(instrument, pitch, note.velocity, duration * beatSeconds, now + delay);
        scheduleGlow(pitch, delay * 1000, duration * beatSeconds * 1000);
      }
    }
    if (metronomeEnabled) {
      const bell = samplePlayers.get('bell');
      for (let beat = Math.ceil(startBeat); beat < BEATS; beat += 1) {
        const delay = (beat - startBeat) * beatSeconds;
        if (bell) playLoadedSample(bell, beat % 4 === 0 ? 84 : 76, 52, .06, now + delay);
        else synthVoice('bell', beat % 4 === 0 ? 84 : 76, 52, .06, now + delay);
      }
    }
    isPlaying = true;
    playbackStartBeat = startBeat;
    playbackStartedAt = performance.now() + 80;
    animationFrame = requestAnimationFrame(animatePlayback);
    setStatus(`Playing sampled instruments from beat ${startBeat.toFixed(2)}.`);
  }

  async function playImmediate(midi, beats = .5) {
    const track = getTrack(activeTrackId);
    const instrument = $('#instrument').value || track.instrument;
    const pitch = clamp(midi + Number($('#transpose').value || 0), MIN_PIANO, MAX_PIANO);
    const duration = beats * secondsPerBeat();
    const context = ensureAudio();
    if (!context) return;
    if (!samplePlayers.has(instrument) && SOUND_FONT_NAMES[instrument]) setStatus(`Loading ${instrumentName(instrument)} samples…`, 0);
    const player = await loadSampleInstrument(instrument);
    const now = context.currentTime + .02;
    if (player) playLoadedSample(player, pitch, 96, duration, now);
    else synthVoice(instrument, pitch, 96, duration, now);
    scheduleGlow(pitch, 20, duration * 1000);
  }

  function getScale() {
    return KEY_SCALES[$('#key').value] || KEY_SCALES['D minor'];
  }

  function scaleContains(pitch, scale) {
    const relative = ((pitch - scale.root) % 12 + 12) % 12;
    return scale.intervals.includes(relative);
  }

  function nearestScalePitch(pitch, scale) {
    let candidate = clamp(pitch, GRID_MIN, GRID_MAX);
    let best = candidate;
    let bestDistance = Infinity;
    for (let delta = -6; delta <= 6; delta += 1) {
      const test = candidate + delta;
      if (test < GRID_MIN || test > GRID_MAX || !scaleContains(test, scale)) continue;
      const distance = Math.abs(delta);
      if (distance < bestDistance || (distance === bestDistance && delta < 0)) {
        best = test;
        bestDistance = distance;
      }
    }
    return best;
  }

  function diatonicAbove(pitch, steps, scale) {
    let candidate = pitch;
    let remaining = steps;
    while (remaining > 0) {
      candidate += 1;
      if (scaleContains(candidate, scale)) remaining -= 1;
    }
    return candidate;
  }

  function chordPitches(clickedPitch) {
    const scale = getScale();
    let root = nearestScalePitch(clickedPitch, scale);
    let third = diatonicAbove(root, 2, scale);
    let fifth = diatonicAbove(root, 4, scale);
    while (fifth > GRID_MAX && root - 12 >= GRID_MIN) {
      root -= 12;
      third = diatonicAbove(root, 2, scale);
      fifth = diatonicAbove(root, 4, scale);
    }
    return [root, third, fifth].filter(pitch => pitch >= GRID_MIN && pitch <= GRID_MAX);
  }

  function renderChordToggle() {
    const button = $('#chordToggle');
    button.classList.toggle('on', chordMode);
    button.setAttribute('aria-pressed', String(chordMode));
    button.title = chordMode ? `${$('#key').value}: key-aware triads on` : 'Add one note per grid click';
  }

  function renderTracks() {
    const root = $('#tracks');
    const armed = $('#armed');
    root.innerHTML = '';
    armed.innerHTML = '';
    for (const track of project.tracks) {
      const option = document.createElement('option');
      option.value = track.id;
      option.textContent = track.name;
      option.selected = track.id === activeTrackId;
      armed.append(option);
      const row = document.createElement('div');
      row.className = `track${track.id === activeTrackId ? ' active' : ''}`;
      row.innerHTML = `<span class="swatch" style="background:${track.color}"></span><button class="btn" data-arm="${track.id}">${track.name}</button><span class="instrument">${instrumentName(track.instrument)}</span><span><button class="btn" data-mute="${track.id}">M</button><button class="btn" data-solo="${track.id}">S</button></span>`;
      root.append(row);
    }
    $('#instrument').innerHTML = INSTRUMENTS.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
    $('#instrument').value = getTrack(activeTrackId).instrument;
  }

  function renderRoll() {
    const labels = $('#labels');
    const roll = $('#roll');
    const timeline = $('#timeline');
    const sections = $('#sections');
    labels.innerHTML = '';
    roll.innerHTML = '<div class="playhead" id="playhead"></div>';
    timeline.innerHTML = '<div class="timeline-playhead" id="timelinePlayhead"></div>';
    sections.innerHTML = '';
    const width = `${BEATS * beatWidth}px`;
    roll.style.width = width;
    timeline.style.width = width;
    sections.style.width = width;
    for (let pitch = GRID_MAX; pitch >= GRID_MIN; pitch -= 1) {
      const label = document.createElement('div');
      label.className = `label${pitch % 12 === 0 ? ' c' : ''}`;
      label.textContent = noteName(pitch);
      labels.append(label);
    }
    for (let beat = 0; beat <= BEATS; beat += 4) {
      const marker = document.createElement('span');
      marker.className = 'bar';
      marker.style.left = `${beat * beatWidth + 4}px`;
      marker.textContent = beat / 4 + 1;
      roll.append(marker);
      const timelineMarker = document.createElement('span');
      timelineMarker.className = 'timeline-bar';
      timelineMarker.style.left = `${beat * beatWidth + 4}px`;
      timelineMarker.textContent = beat / 4 + 1;
      timeline.append(timelineMarker);
    }
    for (const section of project.sections) {
      const pill = document.createElement('button');
      pill.className = 'section';
      pill.dataset.section = section.id;
      pill.style.left = `${section.start * beatWidth + 4}px`;
      pill.style.width = `${Math.max(38, (section.end - section.start) * beatWidth - 8)}px`;
      pill.style.background = section.color;
      pill.textContent = section.name;
      sections.append(pill);
    }
    for (const track of project.tracks) {
      for (const note of track.notes) {
        const tile = document.createElement('div');
        tile.className = `note${selectedNote?.note.id === note.id ? ' selected' : ''}`;
        tile.dataset.note = note.id;
        tile.style.left = `${note.start * beatWidth + 1}px`;
        tile.style.top = `${(GRID_MAX - note.pitch) * ROW_HEIGHT + 2}px`;
        tile.style.width = `${Math.max(10, note.duration * beatWidth - 2)}px`;
        tile.style.background = track.color;
        tile.title = `${track.name} · ${noteName(note.pitch)} · ${note.duration} beats`;
        tile.innerHTML = '<span class="resize"></span>';
        roll.append(tile);
      }
    }
    setPlayhead(playheadBeat);
  }

  function renderKeyboard() {
    const piano = $('#piano');
    piano.innerHTML = '';
    const whiteNotes = [];
    for (let pitch = MIN_PIANO; pitch <= MAX_PIANO; pitch += 1) if (![1, 3, 6, 8, 10].includes(pitch % 12)) whiteNotes.push(pitch);
    for (const pitch of whiteNotes) {
      const key = document.createElement('button');
      key.className = 'key';
      key.dataset.pitch = pitch;
      const mapped = Object.entries(KEYBOARD_MAP).find(([, value]) => value === pitch)?.[0]?.toUpperCase() || '';
      key.textContent = `${noteName(pitch)}${mapped}`;
      piano.append(key);
    }
    for (let pitch = MIN_PIANO; pitch <= MAX_PIANO; pitch += 1) {
      if (![1, 3, 6, 8, 10].includes(pitch % 12)) continue;
      const black = document.createElement('button');
      black.className = 'key black';
      black.dataset.pitch = pitch;
      black.style.left = `${9 + whiteNotes.indexOf(pitch - 1) * 44 + 30}px`;
      black.textContent = noteName(pitch);
      piano.append(black);
    }
  }

  function renderPresets() {
    const presets = $('#presets');
    if (presets) presets.innerHTML = PRESETS.map((preset, index) => `<button class="preset" data-preset="${index}"><b>${preset[0]}</b><span>${preset[1]}</span></button>`).join('');
  }

  function render() {
    project.title = $('#title').value || project.title;
    project.bpm = Number($('#bpm').value) || 92;
    project.key = $('#key').value;
    renderTracks();
    renderRoll();
    renderKeyboard();
    renderPresets();
    renderChordToggle();
  }

  function findNote(id) {
    for (const track of project.tracks) {
      const note = track.notes.find(item => item.id === id);
      if (note) return { track, note };
    }
    return null;
  }

  function closeNoteMenu() {
    $('#notePopover').hidden = true;
    noteMenuRef = null;
  }

  function openNoteMenu(ref, event) {
    noteMenuRef = ref;
    const menu = $('#notePopover');
    const instrument = $('#noteMenuInstrument');
    instrument.innerHTML = `<option value="">Track instrument — ${instrumentName(ref.track.instrument)}</option>` + INSTRUMENTS.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
    instrument.value = ref.note.instrument || '';
    $('#noteMenuVelocity').value = ref.note.velocity || 92;
    $('#noteMenuLength').value = ref.note.duration;
    $('#notePopoverTitle').textContent = `${ref.track.name} · ${noteName(ref.note.pitch)}`;
    menu.hidden = false;
    const padding = 8;
    const left = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - padding);
    const top = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - padding);
    menu.style.left = `${Math.max(padding, left)}px`;
    menu.style.top = `${Math.max(padding, top)}px`;
  }

  function applyNoteMenu() {
    if (!noteMenuRef) return;
    const note = noteMenuRef.note;
    note.instrument = $('#noteMenuInstrument').value || null;
    note.velocity = clamp(Number($('#noteMenuVelocity').value) || 92, 1, 127);
    note.duration = clamp(snap(Number($('#noteMenuLength').value) || 1), .125, BEATS - note.start);
    selectedNote = noteMenuRef;
    closeNoteMenu();
    renderRoll();
    setStatus('Note updated.');
  }

  function deleteMenuNote() {
    if (!noteMenuRef) return;
    noteMenuRef.track.notes = noteMenuRef.track.notes.filter(note => note.id !== noteMenuRef.note.id);
    selectedNote = null;
    closeNoteMenu();
    renderRoll();
    setStatus('Note deleted.');
  }

  function createNotesAt(event) {
    const roll = $('#roll');
    const rect = roll.getBoundingClientRect();
    const start = snap(clamp((event.clientX - rect.left) / beatWidth, 0, BEATS - .125));
    const clickedPitch = clamp(GRID_MAX - Math.floor((event.clientY - rect.top) / ROW_HEIGHT), GRID_MIN, GRID_MAX);
    const pitches = chordMode ? chordPitches(clickedPitch) : [clickedPitch];
    const track = getTrack(activeTrackId);
    const notes = pitches.map(pitch => makeNote(start, pitch, 1));
    track.notes.push(...notes);
    selectedNote = { track, note: notes[0] };
    renderRoll();
    setStatus(chordMode ? `Added ${$('#key').value} triad to ${track.name}.` : `Added ${noteName(clickedPitch)} to ${track.name}.`);
  }

  function saveProject() {
    project.title = $('#title').value || 'Untitled cue';
    project.bpm = Number($('#bpm').value) || 92;
    project.key = $('#key').value;
    localStorage.setItem('ihy-v012', JSON.stringify(project));
    setStatus(`Saved “${project.title}” locally.`);
  }

  function exportProject() {
    saveProject();
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(project.title || 'ihy-project').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ihy.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importProject(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        project = normaliseProject(JSON.parse(String(reader.result)));
        activeTrackId = project.tracks[0].id;
        playheadBeat = 0;
        $('#title').value = project.title;
        $('#bpm').value = project.bpm;
        $('#key').value = project.key;
        render();
        setStatus(`Imported “${project.title}”.`);
      } catch (error) { alert(`Invalid Ihy JSON: ${error.message}`); }
    };
    reader.readAsText(file);
  }

  const timelineBeat = event => {
    const rect = $('#timeline').getBoundingClientRect();
    return clamp((event.clientX - rect.left) / beatWidth, 0, BEATS);
  };

  $$('.tab').forEach(button => button.addEventListener('click', () => {
    closeNoteMenu();
    $$('.tab').forEach(item => item.classList.toggle('active', item === button));
    $$('.view').forEach(view => view.classList.toggle('active', view.id === button.dataset.view));
  }));

  $('#chordToggle').addEventListener('click', () => {
    chordMode = !chordMode;
    localStorage.setItem('ihy-chord-mode', String(chordMode));
    renderChordToggle();
    setStatus(chordMode ? `Chord mode on — ${$('#key').value} key-aware triads.` : 'Chord mode off — clicks add one note.');
  });
  $('#key').addEventListener('change', () => { project.key = $('#key').value; renderChordToggle(); });
  $('#play').addEventListener('click', playProject);
  $('#stop').addEventListener('click', () => { stopPlayback(false); setStatus('Playback stopped.'); });
  $('#record').addEventListener('click', () => {
    isRecording = !isRecording;
    recordStartedAt = performance.now();
    $('#record').classList.toggle('on', isRecording);
    $('#record').textContent = isRecording ? '⏺️ Recording' : '⏺️ Record';
    setStatus(isRecording ? 'Recording keyboard notes.' : 'Recording stopped.');
  });
  $('#metro').addEventListener('click', () => {
    metronomeEnabled = !metronomeEnabled;
    $('#metro').classList.toggle('on', metronomeEnabled);
    setStatus(metronomeEnabled ? 'Metronome enabled for playback.' : 'Metronome disabled.');
  });

  $('#armed').addEventListener('change', event => { activeTrackId = event.target.value; selectedNote = null; closeNoteMenu(); renderTracks(); renderRoll(); });
  $('#instrument').addEventListener('change', () => { getTrack(activeTrackId).instrument = $('#instrument').value; renderTracks(); renderRoll(); });
  $('#addTrack').addEventListener('click', () => {
    const track = { id: uid(), name: `Track ${project.tracks.length + 1}`, instrument: 'grand_piano', color: COLORS[project.tracks.length % COLORS.length], muted: false, solo: false, notes: [] };
    project.tracks.push(track);
    activeTrackId = track.id;
    render();
  });
  $('#tracks').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.arm) { activeTrackId = button.dataset.arm; selectedNote = null; closeNoteMenu(); renderTracks(); renderRoll(); }
    if (button.dataset.mute) { const track = getTrack(button.dataset.mute); track.muted = !track.muted; renderTracks(); }
    if (button.dataset.solo) { const track = getTrack(button.dataset.solo); track.solo = !track.solo; renderTracks(); }
  });
  $('#clear').addEventListener('click', () => {
    const track = getTrack(activeTrackId);
    if (confirm(`Clear all notes from ${track.name}?`)) { track.notes = []; selectedNote = null; closeNoteMenu(); renderRoll(); }
  });
  $('#addSection').addEventListener('click', () => {
    const name = prompt('Section name', 'Bridge');
    if (!name?.trim()) return;
    const last = project.sections.at(-1);
    const start = last ? clamp(last.end, 0, BEATS - 4) : 0;
    project.sections.push({ id: uid(), name: name.trim(), start, end: Math.min(BEATS, start + 8), color: COLORS[project.sections.length % COLORS.length] });
    renderRoll();
  });
  $('#sections').addEventListener('click', event => {
    const button = event.target.closest('.section');
    if (!button) return;
    const section = project.sections.find(item => item.id === button.dataset.section);
    const name = prompt('Section name', section.name);
    if (name?.trim()) { section.name = name.trim(); renderRoll(); }
  });

  $('#roll').addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const element = event.target.closest('.note');
    if (!element) {
      if (event.target.id === 'roll' || event.target.classList.contains('bar')) {
        closeNoteMenu();
        createNotesAt(event);
      }
      return;
    }
    const ref = findNote(element.dataset.note);
    if (!ref) return;
    event.preventDefault();
    selectedNote = ref;
    noteDrag = { ref, mode: event.target.classList.contains('resize') ? 'resize' : 'move', x: event.clientX, y: event.clientY, start: ref.note.start, pitch: ref.note.pitch, duration: ref.note.duration };
    $('#roll').setPointerCapture?.(event.pointerId);
    renderRoll();
  });
  $('#roll').addEventListener('pointermove', event => {
    if (!noteDrag) return;
    const dx = (event.clientX - noteDrag.x) / beatWidth;
    const dy = Math.round((event.clientY - noteDrag.y) / ROW_HEIGHT);
    if (noteDrag.mode === 'resize') noteDrag.ref.note.duration = clamp(snap(noteDrag.duration + dx), .125, BEATS - noteDrag.ref.note.start);
    else {
      noteDrag.ref.note.start = clamp(snap(noteDrag.start + dx), 0, BEATS - noteDrag.ref.note.duration);
      noteDrag.ref.note.pitch = clamp(noteDrag.pitch - dy, GRID_MIN, GRID_MAX);
    }
    renderRoll();
  });
  ['pointerup', 'pointercancel'].forEach(type => $('#roll').addEventListener(type, event => {
    noteDrag = null;
    try { $('#roll').releasePointerCapture?.(event.pointerId); } catch (_) {}
  }));
  $('#roll').addEventListener('contextmenu', event => {
    const element = event.target.closest('.note');
    if (!element) return;
    event.preventDefault();
    const ref = findNote(element.dataset.note);
    if (ref) openNoteMenu(ref, event);
  });

  $('#noteMenuApply').addEventListener('click', applyNoteMenu);
  $('#noteMenuDelete').addEventListener('click', deleteMenuNote);
  $('#noteMenuClose').addEventListener('click', closeNoteMenu);
  document.addEventListener('pointerdown', event => {
    const menu = $('#notePopover');
    if (!menu.hidden && !menu.contains(event.target) && !event.target.closest('.note')) closeNoteMenu();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeNoteMenu(); });

  $('#timeline').addEventListener('pointerdown', event => { timelineDragging = true; closeNoteMenu(); setPlayhead(timelineBeat(event)); });
  $('#timeline').addEventListener('pointermove', event => { if (timelineDragging) setPlayhead(timelineBeat(event)); });
  ['pointerup', 'pointercancel'].forEach(type => $('#timeline').addEventListener(type, () => { timelineDragging = false; }));
  $('#piano').addEventListener('pointerdown', event => {
    const key = event.target.closest('.key');
    if (key) playImmediate(Number(key.dataset.pitch), pressedKeys.has(' ') ? 1.35 : .5);
  });
  $('#presets').addEventListener('click', event => {
    const button = event.target.closest('[data-preset]');
    if (!button) return;
    const preset = PRESETS[Number(button.dataset.preset)];
    const context = ensureAudio();
    if (!context) return;
    synthVoice('retro_lead', 69, 100, preset[3], context.currentTime);
    setStatus(`${preset[0]} preset previewed.`);
  });

  $('#save').addEventListener('click', saveProject);
  $('#export').addEventListener('click', exportProject);
  $('#import').addEventListener('click', () => $('#file').click());
  $('#file').addEventListener('change', event => { if (event.target.files[0]) importProject(event.target.files[0]); event.target.value = ''; });

  document.addEventListener('keydown', event => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); pressedKeys.add(' '); return; }
    const key = event.key.toLowerCase();
    if (!KEYBOARD_MAP[key] || pressedKeys.has(key)) return;
    pressedKeys.add(key);
    const duration = pressedKeys.has(' ') ? 1.35 : .5;
    playImmediate(KEYBOARD_MAP[key], duration);
    if (isRecording) {
      const start = snap(((performance.now() - recordStartedAt) / 1000) / secondsPerBeat());
      if (start < BEATS) {
        const note = makeNote(start, KEYBOARD_MAP[key], duration);
        getTrack(activeTrackId).notes.push(note);
        selectedNote = { track: getTrack(activeTrackId), note };
        renderRoll();
      }
    }
  });
  document.addEventListener('keyup', event => { if (event.code === 'Space') pressedKeys.delete(' '); else pressedKeys.delete(event.key.toLowerCase()); });
  window.addEventListener('pagehide', () => stopPlayback(false));

  $('#title').value = project.title;
  $('#bpm').value = project.bpm;
  $('#key').value = project.key;
  render();
})();