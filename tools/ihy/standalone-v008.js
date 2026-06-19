(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const VERSION = '0.09';
  const MIN_NOTE = 36;
  const MAX_NOTE = 96;
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
  const PRESETS = [
    ['Coin', 'bright pickup', 'square', 988, .22, 1.7],
    ['Magic Sparkle', 'shimmering charm', 'sine', 740, .72, 2.4],
    ['Laser', 'retro projectile', 'sawtooth', 1180, .3, .24],
    ['Jump', 'arcade rise', 'square', 280, .24, 1.8],
    ['Portal', 'sweeping gate', 'triangle', 220, 1.1, 3.1]
  ];

  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const noteName = pitch => `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
  const makeNote = (start, pitch, duration = 1, velocity = 92) => ({ id: uid(), start, pitch, duration, velocity, instrument: null });

  function freshProject() {
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
    const fallback = freshProject();
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
  try { project = normaliseProject(JSON.parse(localStorage.getItem('ihy-v009') || localStorage.getItem('ihy-v008'))); }
  catch (_) { project = freshProject(); }

  let activeTrackId = project.tracks[0].id;
  let beatWidth = 40;
  let selectedNote = null;
  let noteDrag = null;
  let timelineDragging = false;
  let playheadBeat = 0;
  let isPlaying = false;
  let playbackStartBeat = 0;
  let playbackStartedAt = 0;
  let animationFrame = 0;
  let audioContext = null;
  let masterGain = null;
  let sourceStops = [];
  let playbackTimers = [];
  let pressedKeys = new Set();
  let isRecording = false;
  let recordStartedAt = 0;
  let metronomeEnabled = false;

  const currentTrack = id => project.tracks.find(track => track.id === id);
  const instrumentName = id => (INSTRUMENTS.find(item => item[0] === id) || [id, id])[1];
  const noteFrequency = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const secondsPerBeat = () => 60 / Math.max(30, Number(project.bpm) || 92);
  const quantise = value => {
    const unit = Number($('#quant').value || .25);
    return Math.round(value / unit) * unit;
  };

  function setStatus(message) {
    $('#status').textContent = message;
    clearTimeout(setStatus.timer);
    setStatus.timer = setTimeout(() => { $('#status').textContent = 'v0.09 — timeline, cursor and extended keyboard.'; }, 3200);
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
    masterGain.gain.value = .52;
    masterGain.connect(audioContext.destination);
    return audioContext;
  }

  function voiceConfig(instrument, midi, velocity, durationSeconds) {
    const amount = clamp((velocity || 92) / 127, .08, 1);
    const config = { wave: 'triangle', hz: noteFrequency(midi), gain: .12 * amount, length: Math.max(.08, durationSeconds), slide: 1 };
    if (instrument === 'grand_piano') { config.gain = .16 * amount; config.length = Math.max(.14, durationSeconds * .72); }
    else if (instrument === 'soft_piano') { config.wave = 'sine'; config.gain = .12 * amount; }
    else if (instrument === 'cello' || instrument === 'horn') { config.wave = 'sawtooth'; config.gain = .075 * amount; }
    else if (instrument === 'strings') { config.wave = 'triangle'; config.gain = .10 * amount; }
    else if (instrument === 'flute' || instrument === 'choir' || instrument === 'warm_pad') { config.wave = 'sine'; config.gain = .11 * amount; }
    else if (instrument === 'bell') { config.wave = 'sine'; config.gain = .14 * amount; config.slide = .502; config.length = Math.max(.25, durationSeconds * .72); }
    else if (instrument === 'acoustic_guitar' || instrument === 'pluck') { config.wave = 'triangle'; config.gain = .14 * amount; config.length = Math.max(.1, durationSeconds * .45); }
    else if (instrument === 'electric_bass') { config.wave = 'square'; config.hz = noteFrequency(midi - 12); config.gain = .075 * amount; }
    else if (instrument === 'drum_kit') { config.wave = 'square'; config.hz = 120; config.gain = .075 * amount; config.length = .12; }
    else if (instrument === 'retro_lead') { config.wave = 'square'; config.gain = .11 * amount; }
    return config;
  }

  function scheduleVoice({ instrument, midi, velocity, durationSeconds, when }) {
    const context = ensureAudio();
    if (!context) return;
    const config = voiceConfig(instrument, midi, velocity, durationSeconds);
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

  function setKeyGlow(midi, on) {
    const key = document.querySelector(`.key[data-pitch="${midi}"]`);
    if (!key) return;
    const count = Number(key.dataset.glowCount || 0) + (on ? 1 : -1);
    key.dataset.glowCount = Math.max(0, count);
    key.classList.toggle('playing', count > 0);
  }

  function scheduleKeyGlow(midi, delayMs, durationMs) {
    const startTimer = window.setTimeout(() => {
      setKeyGlow(midi, true);
      const endTimer = window.setTimeout(() => setKeyGlow(midi, false), Math.max(80, durationMs));
      playbackTimers.push(endTimer);
    }, Math.max(0, delayMs));
    playbackTimers.push(startTimer);
  }

  function clearKeyGlows() {
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
      const rightEdge = scroll.scrollLeft + scroll.clientWidth - 90;
      if (target > rightEdge) scroll.scrollLeft = Math.max(0, target - scroll.clientWidth * .35);
    }
  }

  function cancelPlayback(resetToStart = false) {
    playbackTimers.forEach(timer => clearTimeout(timer));
    playbackTimers = [];
    sourceStops.splice(0).forEach(stop => stop());
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    isPlaying = false;
    clearKeyGlows();
    if (resetToStart) setPlayhead(0);
  }

  function animatePlayback() {
    if (!isPlaying) return;
    const currentBeat = playbackStartBeat + ((performance.now() - playbackStartedAt) / 1000) / secondsPerBeat();
    if (currentBeat >= BEATS) {
      cancelPlayback(true);
      setStatus('Playback reached the end.');
      return;
    }
    setPlayhead(currentBeat, true);
    animationFrame = requestAnimationFrame(animatePlayback);
  }

  function playProject() {
    cancelPlayback(false);
    const context = ensureAudio();
    if (!context) return;
    const start = playheadBeat;
    const now = context.currentTime + .06;
    const soloed = project.tracks.some(track => track.solo);
    const beatSeconds = secondsPerBeat();

    for (const track of project.tracks) {
      if (track.muted || (soloed && !track.solo)) continue;
      for (const note of track.notes) {
        const end = note.start + note.duration;
        if (end <= start) continue;
        const actualStart = Math.max(start, note.start);
        const actualDuration = end - actualStart;
        const delaySeconds = (actualStart - start) * beatSeconds;
        const playedPitch = clamp(note.pitch + Number($('#transpose').value || 0), MIN_NOTE, MAX_NOTE);
        scheduleVoice({ instrument: note.instrument || track.instrument, midi: playedPitch, velocity: note.velocity, durationSeconds: actualDuration * beatSeconds, when: now + delaySeconds });
        scheduleKeyGlow(playedPitch, delaySeconds * 1000, actualDuration * beatSeconds * 1000);
      }
    }

    if (metronomeEnabled) {
      for (let beat = Math.ceil(start); beat < BEATS; beat += 1) {
        const delay = (beat - start) * beatSeconds;
        scheduleVoice({ instrument: 'bell', midi: beat % 4 === 0 ? 84 : 76, velocity: beat % 4 === 0 ? 65 : 38, durationSeconds: .06, when: now + delay });
      }
    }

    isPlaying = true;
    playbackStartBeat = start;
    playbackStartedAt = performance.now() + 60;
    animationFrame = requestAnimationFrame(animatePlayback);
    setStatus(`Playing “${project.title}” from beat ${start.toFixed(2)}.`);
  }

  function playImmediate(midi, beats = .5) {
    const track = currentTrack(activeTrackId);
    const selectedInstrument = $('#instrument').value || track.instrument;
    const pitch = clamp(midi + Number($('#transpose').value || 0), MIN_NOTE, MAX_NOTE);
    const durationSeconds = beats * secondsPerBeat();
    const context = ensureAudio();
    if (!context) return;
    scheduleVoice({ instrument: selectedInstrument, midi: pitch, velocity: 96, durationSeconds, when: context.currentTime });
    scheduleKeyGlow(pitch, 0, durationSeconds * 1000);
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
    $('#instrument').value = currentTrack(activeTrackId).instrument;
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
      const gridMarker = document.createElement('span');
      gridMarker.className = 'bar';
      gridMarker.style.left = `${beat * beatWidth + 4}px`;
      gridMarker.textContent = beat / 4 + 1;
      roll.append(gridMarker);
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
    for (let pitch = MIN_NOTE; pitch <= MAX_NOTE; pitch += 1) {
      if (![1, 3, 6, 8, 10].includes(pitch % 12)) whiteNotes.push(pitch);
    }
    for (const pitch of whiteNotes) {
      const key = document.createElement('button');
      key.className = 'key';
      key.dataset.pitch = pitch;
      const mapped = Object.entries(KEYBOARD_MAP).find(([, value]) => value === pitch)?.[0]?.toUpperCase() || '';
      key.textContent = `${noteName(pitch)}${mapped}`;
      piano.append(key);
    }
    for (let pitch = MIN_NOTE; pitch <= MAX_NOTE; pitch += 1) {
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
    $('#presets').innerHTML = PRESETS.map((preset, index) => `<button class="preset" data-preset="${index}"><b>${preset[0]}</b><span>${preset[1]}</span></button>`).join('');
  }

  function render() {
    project.title = $('#title').value || project.title;
    project.bpm = Number($('#bpm').value) || 92;
    project.key = $('#key').value;
    renderTracks();
    renderRoll();
    renderKeyboard();
    renderPresets();
  }

  function findNote(id) {
    for (const track of project.tracks) {
      const note = track.notes.find(item => item.id === id);
      if (note) return { track, note };
    }
    return null;
  }

  function setSelected(ref) {
    selectedNote = ref;
    renderRoll();
  }

  function saveProject() {
    project.title = $('#title').value || 'Untitled cue';
    project.bpm = Number($('#bpm').value) || 92;
    project.key = $('#key').value;
    localStorage.setItem('ihy-v009', JSON.stringify(project));
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
    setStatus('Exported editable Ihy JSON.');
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

  function timelineBeat(event) {
    const rect = $('#timeline').getBoundingClientRect();
    return clamp((event.clientX - rect.left) / beatWidth, 0, BEATS);
  }

  $$('.tab').forEach(button => button.addEventListener('click', () => {
    $$('.tab').forEach(item => item.classList.toggle('active', item === button));
    $$('.view').forEach(view => view.classList.toggle('active', view.id === button.dataset.view));
  }));

  $('#play').addEventListener('click', playProject);
  $('#stop').addEventListener('click', () => { cancelPlayback(false); setStatus('Playback stopped.'); });
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

  $('#armed').addEventListener('change', event => { activeTrackId = event.target.value; selectedNote = null; renderTracks(); renderRoll(); });
  $('#instrument').addEventListener('change', () => { currentTrack(activeTrackId).instrument = $('#instrument').value; renderTracks(); renderRoll(); });

  $('#addTrack').addEventListener('click', () => {
    const track = { id: uid(), name: `Track ${project.tracks.length + 1}`, instrument: 'grand_piano', color: COLORS[project.tracks.length % COLORS.length], muted: false, solo: false, notes: [] };
    project.tracks.push(track);
    activeTrackId = track.id;
    render();
  });

  $('#tracks').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.arm) { activeTrackId = button.dataset.arm; selectedNote = null; renderTracks(); renderRoll(); }
    if (button.dataset.mute) { const track = currentTrack(button.dataset.mute); track.muted = !track.muted; renderTracks(); }
    if (button.dataset.solo) { const track = currentTrack(button.dataset.solo); track.solo = !track.solo; renderTracks(); }
  });

  $('#clear').addEventListener('click', () => {
    const track = currentTrack(activeTrackId);
    if (confirm(`Clear all notes from ${track.name}?`)) { track.notes = []; selectedNote = null; renderRoll(); }
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

  $('#roll').addEventListener('dblclick', event => {
    if (event.target.id !== 'roll' && !event.target.classList.contains('bar')) return;
    const box = $('#roll').getBoundingClientRect();
    const start = quantise(clamp((event.clientX - box.left) / beatWidth, 0, BEATS - .125));
    const pitch = clamp(GRID_MAX - Math.floor((event.clientY - box.top) / ROW_HEIGHT), GRID_MIN, GRID_MAX);
    const note = makeNote(start, pitch);
    currentTrack(activeTrackId).notes.push(note);
    setSelected({ track: currentTrack(activeTrackId), note });
  });

  $('#roll').addEventListener('pointerdown', event => {
    const element = event.target.closest('.note');
    if (!element) return;
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
    if (noteDrag.mode === 'resize') {
      noteDrag.ref.note.duration = clamp(quantise(noteDrag.duration + dx), .125, BEATS - noteDrag.ref.note.start);
    } else {
      noteDrag.ref.note.start = clamp(quantise(noteDrag.start + dx), 0, BEATS - noteDrag.ref.note.duration);
      noteDrag.ref.note.pitch = clamp(noteDrag.pitch - dy, GRID_MIN, GRID_MAX);
    }
    renderRoll();
  });

  ['pointerup', 'pointercancel'].forEach(type => $('#roll').addEventListener(type, () => { noteDrag = null; }));

  $('#roll').addEventListener('contextmenu', event => {
    const element = event.target.closest('.note');
    if (!element) return;
    event.preventDefault();
    const ref = findNote(element.dataset.note);
    const choice = prompt('Instrument override ID, “track” for the track instrument, or “delete”', ref.note.instrument || 'track');
    if (choice === null) return;
    if (choice === 'delete') { ref.track.notes = ref.track.notes.filter(note => note.id !== ref.note.id); selectedNote = null; }
    else if (!choice || choice === 'track') ref.note.instrument = null;
    else if (INSTRUMENTS.some(item => item[0] === choice)) ref.note.instrument = choice;
    else { alert('Unknown instrument ID.'); return; }
    renderRoll();
  });

  $('#timeline').addEventListener('pointerdown', event => {
    timelineDragging = true;
    $('#timeline').setPointerCapture?.(event.pointerId);
    setPlayhead(timelineBeat(event));
  });
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
    scheduleVoice({ instrument: 'retro_lead', midi: 69, velocity: 100, durationSeconds: preset[4], when: context.currentTime });
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
      const start = quantise(((performance.now() - recordStartedAt) / 1000) / secondsPerBeat());
      if (start < BEATS) {
        const note = makeNote(start, KEYBOARD_MAP[key], duration);
        currentTrack(activeTrackId).notes.push(note);
        selectedNote = { track: currentTrack(activeTrackId), note };
        renderRoll();
      }
    }
  });
  document.addEventListener('keyup', event => { if (event.code === 'Space') pressedKeys.delete(' '); else pressedKeys.delete(event.key.toLowerCase()); });
  window.addEventListener('pagehide', () => cancelPlayback(false));

  $('#title').value = project.title;
  $('#bpm').value = project.bpm;
  $('#key').value = project.key;
  render();
})();