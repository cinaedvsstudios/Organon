(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const STORAGE_KEY = 'ihy-v021';
  const BASE_BEAT = 40;
  const ROW_HEIGHT = 24;
  const LOW_PITCH = 48;
  const HIGH_PITCH = 84;
  const MIN_BEATS = 64;
  const COLORS = ['#b68cff', '#60c6a4', '#dfb658', '#dc7898', '#79b4e3'];
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const KEYBOARD_MAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72 };
  const INSTRUMENTS = [
    ['grand_piano', 'Grand Piano'], ['soft_piano', 'Soft Piano'], ['cello', 'Cello'], ['strings', 'Strings'],
    ['flute', 'Flute'], ['horn', 'French Horn'], ['choir', 'Choir'], ['warm_pad', 'Warm Pad'],
    ['bell', 'Bell'], ['acoustic_guitar', 'Acoustic Guitar'], ['electric_bass', 'Electric Bass'],
    ['drum_kit', 'Drum Kit'], ['retro_lead', 'Retro Lead'], ['pluck', 'Pluck']
  ];
  const SCALE_MAP = {
    'C major': { root: 0, notes: [0, 2, 4, 5, 7, 9, 11] },
    'D minor': { root: 2, notes: [0, 2, 3, 5, 7, 8, 10] },
    'A minor': { root: 9, notes: [0, 2, 3, 5, 7, 8, 10] },
    'F major': { root: 5, notes: [0, 2, 4, 5, 7, 9, 11] },
    'G major': { root: 7, notes: [0, 2, 4, 5, 7, 9, 11] },
    'A♭ major': { root: 8, notes: [0, 2, 4, 5, 7, 9, 11] }
  };

  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const noteName = pitch => `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
  const instrumentName = id => (INSTRUMENTS.find(([key]) => key === id) || [id, id])[1];
  const note = (start, pitch, duration = 1, velocity = 92) => ({ id: uid(), start, pitch, duration, velocity });
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

  function blankProject() {
    return {
      title: 'Untitled cue',
      bpm: 92,
      key: 'D minor',
      sections: [],
      tracks: [{ id: uid(), name: 'Piano', instrument: 'grand_piano', color: COLORS[0], muted: false, solo: false, notes: [] }]
    };
  }

  function potionSongExample() {
    const phrase = [
      [0, 69, 1], [1, 72, 1], [2, 74, 1], [3, 72, 1], [4, 69, 1], [5, 67, 1], [6, 65, 1], [7, 64, 1],
      [8, 65, 1], [9, 69, 1], [10, 72, 1], [11, 74, 1], [12, 76, 1], [13, 74, 1], [14, 72, 1], [15, 69, 1],
      [16, 69, .5], [16.5, 72, .5], [17, 74, 1], [18, 77, 1], [19, 76, 1], [20, 74, 1], [21, 72, 1], [22, 69, 1], [23, 65, 1],
      [24, 67, 1], [25, 69, 1], [26, 72, 1], [27, 74, 1], [28, 72, 1], [29, 69, 1], [30, 67, 1], [31, 65, 1],
      [32, 64, 1], [33, 67, 1], [34, 69, 1], [35, 72, 1], [36, 74, 2], [38, 72, 1], [39, 69, 1],
      [40, 65, 1], [41, 69, 1], [42, 72, 1], [43, 76, 1], [44, 74, 1], [45, 72, 1], [46, 69, 1], [47, 67, 1],
      [48, 69, 1], [49, 72, 1], [50, 74, 1], [51, 77, 1], [52, 76, 1], [53, 74, 1], [54, 72, 1], [55, 69, 1],
      [56, 67, 1], [57, 65, 1], [58, 64, 1], [59, 65, 1], [60, 62, 4]
    ];

    const chords = [
      [0, [50, 53, 57], 4], [4, [48, 52, 55], 4], [8, [46, 50, 53], 4], [12, [45, 48, 52], 4],
      [16, [50, 53, 57], 4], [20, [48, 52, 55], 4], [24, [46, 50, 53], 4], [28, [45, 48, 52], 4],
      [32, [50, 53, 57], 4], [36, [48, 52, 55], 4], [40, [46, 50, 53], 4], [44, [45, 48, 52], 4],
      [48, [50, 53, 57], 4], [52, [48, 52, 55], 4], [56, [46, 50, 53], 4], [60, [38, 45, 50], 4]
    ];

    const pulse = [];
    for (let beat = 0; beat < 64; beat += 1) {
      pulse.push(note(beat, beat % 4 === 0 ? 50 : beat % 2 === 0 ? 53 : 57, .42, 62));
    }

    return {
      title: 'Potion Song — Piano Example',
      bpm: 92,
      key: 'D minor',
      sections: [
        { id: uid(), name: 'Intro', start: 0, end: 16, color: '#dfb658' },
        { id: uid(), name: 'Theme', start: 16, end: 48, color: '#b68cff' },
        { id: uid(), name: 'Finale', start: 48, end: 64, color: '#60c6a4' }
      ],
      tracks: [
        { id: uid(), name: 'Piano melody', instrument: 'grand_piano', color: '#b68cff', muted: false, solo: false, notes: phrase.map(([start, pitch, duration]) => note(start, pitch, duration, 104)) },
        { id: uid(), name: 'Piano harmony', instrument: 'soft_piano', color: '#dfb658', muted: false, solo: false, notes: chords.flatMap(([start, pitches, duration]) => pitches.map(pitch => note(start, pitch, duration, 68))) },
        { id: uid(), name: 'Cello', instrument: 'cello', color: '#60c6a4', muted: false, solo: false, notes: chords.map(([start, pitches, duration]) => note(start, pitches[0] - 12, duration, 74)) },
        { id: uid(), name: 'Bell pulse', instrument: 'bell', color: '#79b4e3', muted: false, solo: false, notes: pulse }
      ]
    };
  }

  function normaliseProject(raw) {
    const fallback = blankProject();
    if (!raw || !Array.isArray(raw.tracks) || !raw.tracks.length) return fallback;

    return {
      title: String(raw.title || fallback.title),
      bpm: clamp(Number(raw.bpm) || 92, 30, 260),
      key: SCALE_MAP[raw.key] ? raw.key : 'D minor',
      sections: Array.isArray(raw.sections) ? raw.sections.map((section, index) => ({
        id: section.id || uid(), name: String(section.name || `Section ${index + 1}`), start: Math.max(0, Number(section.start) || 0), end: Math.max(1, Number(section.end) || 8), color: section.color || COLORS[index % COLORS.length]
      })) : [],
      tracks: raw.tracks.map((track, index) => ({
        id: track.id || uid(), name: String(track.name || `Track ${index + 1}`), instrument: INSTRUMENTS.some(([id]) => id === track.instrument) ? track.instrument : 'grand_piano', color: track.color || COLORS[index % COLORS.length], muted: Boolean(track.muted), solo: Boolean(track.solo),
        notes: Array.isArray(track.notes) ? track.notes.map(item => ({ id: item.id || uid(), start: Math.max(0, Number(item.start) || 0), pitch: clamp(Number(item.pitch) || 60, LOW_PITCH, HIGH_PITCH), duration: Math.max(.125, Number(item.duration) || 1), velocity: clamp(Number(item.velocity) || 92, 1, 127) })).sort((a, b) => a.start - b.start || a.pitch - b.pitch) : []
      }))
    };
  }

  let project;
  try {
    project = normaliseProject(JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem('ihy-v020') || localStorage.getItem('ihy-v019') || localStorage.getItem('ihy-v018') || 'null'));
  } catch (_) {
    project = blankProject();
  }

  let activeTrackId = project.tracks[0].id;
  let zoom = clamp(Number(localStorage.getItem('ihy-roll-zoom') || 100), 70, 150);
  let beatWidth = BASE_BEAT * zoom / 100;
  let selectedNoteId = null;
  let noteDrag = null;
  let metronomeEnabled = false;
  let recording = false;
  let recordingStartedAt = 0;
  let playheadBeat = 0;
  let playing = false;
  let playbackStartedAt = 0;
  let playbackStartBeat = 0;
  let animationFrame = 0;
  let context = null;
  let master = null;
  let activeSounds = [];
  const heldKeys = new Set();

  const getTrack = id => project.tracks.find(track => track.id === id);
  const activeTrack = () => getTrack(activeTrackId);
  const secondsPerBeat = () => 60 / clamp(Number(project.bpm) || 92, 30, 260);
  const snap = value => {
    const unit = Number($('#quant').value || .25);
    return Math.round(value / unit) * unit;
  };

  function projectLength() {
    let end = MIN_BEATS;
    project.sections.forEach(section => { end = Math.max(end, section.end); });
    project.tracks.forEach(track => track.notes.forEach(item => { end = Math.max(end, item.start + item.duration); }));
    return Math.max(MIN_BEATS, Math.ceil(end / 4) * 4);
  }

  function syncMeta() {
    project.title = $('#title').value.trim() || 'Untitled cue';
    project.bpm = clamp(Number($('#bpm').value) || 92, 30, 260);
    project.key = SCALE_MAP[$('#key').value] ? $('#key').value : 'D minor';
  }

  function status(message = '', timeout = 3200) {
    const target = $('#status');
    target.textContent = message;
    clearTimeout(status.timer);
    if (message && timeout) status.timer = setTimeout(() => {
      if (target.textContent === message) target.textContent = '';
    }, timeout);
  }

  function saveProject(silent = false) {
    syncMeta();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    if (!silent) status(`Saved “${project.title}”.`);
  }

  function setView(name) {
    $$('.view').forEach(view => view.classList.toggle('active', view.id === `${name}View`));
  }

  function render() {
    syncMeta();
    $('#title').value = project.title;
    $('#bpm').value = project.bpm;
    $('#key').value = project.key;
    $('#zoomSlider').value = String(zoom);
    $('#zoomValue').textContent = `${zoom}%`;
    $('#metro').classList.toggle('on', metronomeEnabled);
    $('#metro').setAttribute('aria-pressed', String(metronomeEnabled));
    $('#record').classList.toggle('on', recording);
    $('#record').textContent = recording ? '⏺ Recording' : '⏺ Record';
    renderTracks();
    renderTimeline();
    renderRoll();
    renderKeyboard();
    updateTransport();
  }

  function renderTracks() {
    const list = $('#tracks');
    const armed = $('#armed');
    list.replaceChildren();
    armed.replaceChildren();

    project.tracks.forEach(track => {
      armed.append(new Option(track.name, track.id, track.id === activeTrackId, track.id === activeTrackId));
      const row = document.createElement('div');
      row.className = `track${track.id === activeTrackId ? ' active' : ''}`;
      row.innerHTML = `<span class="swatch" style="background:${track.color}"></span><button class="btn track-arm" data-arm="${track.id}">${escapeHtml(track.name)}</button><span class="instrument">${escapeHtml(instrumentName(track.instrument))}</span><span class="track-actions"><button class="btn" data-mute="${track.id}" aria-pressed="${track.muted}">M</button><button class="btn" data-solo="${track.id}" aria-pressed="${track.solo}">S</button></span>`;
      list.append(row);
    });

    const select = $('#instrument');
    select.replaceChildren(...INSTRUMENTS.map(([id, name]) => new Option(name, id)));
    select.value = activeTrack().instrument;
  }

  function renderTimeline() {
    const host = $('#arrangement');
    const total = projectLength();
    host.replaceChildren();
    host.style.width = `${total * beatWidth}px`;

    const playhead = document.createElement('div');
    playhead.id = 'arrangementPlayhead';
    playhead.className = 'arrangement-playhead';
    playhead.style.left = `${playheadBeat * beatWidth}px`;
    host.append(playhead);

    const sections = project.sections.length ? project.sections : [{ id: 'main', name: 'Main Track', start: 0, end: total, color: '#dfb658', readonly: true }];
    sections.forEach(section => {
      const marker = document.createElement('button');
      marker.className = 'arrangement-section';
      marker.dataset.section = section.id;
      marker.disabled = Boolean(section.readonly);
      marker.style.left = `${section.start * beatWidth + 4}px`;
      marker.style.width = `${Math.max(44, (section.end - section.start) * beatWidth - 8)}px`;
      marker.style.background = section.color;
      marker.textContent = section.name;
      host.append(marker);

      for (let beat = Math.ceil(section.start / 4) * 4; beat < section.end; beat += 4) {
        const label = document.createElement('span');
        label.className = 'section-time-label';
        label.style.left = `${beat * beatWidth + 8}px`;
        label.textContent = String(beat / 4 + 1);
        host.append(label);
      }
    });
  }

  function renderRoll() {
    const labels = $('#labels');
    const roll = $('#roll');
    labels.replaceChildren();
    roll.replaceChildren();
    roll.style.width = `${projectLength() * beatWidth}px`;

    const playhead = document.createElement('div');
    playhead.id = 'playhead';
    playhead.className = 'playhead';
    playhead.style.left = `${playheadBeat * beatWidth}px`;
    roll.append(playhead);

    for (let pitch = HIGH_PITCH; pitch >= LOW_PITCH; pitch -= 1) {
      const label = document.createElement('div');
      label.className = `pitch-label${pitch % 12 === 0 ? ' c' : ''}`;
      label.textContent = noteName(pitch);
      labels.append(label);
    }

    project.tracks.forEach(track => track.notes.forEach(item => {
      const node = document.createElement('div');
      node.className = `note${selectedNoteId === item.id ? ' selected' : ''}`;
      node.dataset.note = item.id;
      node.title = `${track.name} · ${noteName(item.pitch)} · ${item.duration} beats`;
      node.style.left = `${item.start * beatWidth + 1}px`;
      node.style.top = `${(HIGH_PITCH - item.pitch) * ROW_HEIGHT + 2}px`;
      node.style.width = `${Math.max(10, item.duration * beatWidth - 2)}px`;
      node.style.background = track.color;
      node.innerHTML = '<span class="resize-handle"></span>';
      roll.append(node);
    }));
  }

  function renderKeyboard() {
    const piano = $('#piano');
    piano.replaceChildren();
    const whites = [];

    for (let pitch = 36; pitch <= 96; pitch += 1) {
      if (![1, 3, 6, 8, 10].includes(pitch % 12)) whites.push(pitch);
    }

    whites.forEach(pitch => {
      const key = document.createElement('button');
      key.className = 'key';
      key.dataset.pitch = pitch;
      const mapped = Object.entries(KEYBOARD_MAP).find(([, value]) => value === pitch)?.[0]?.toUpperCase() || '';
      key.textContent = `${noteName(pitch)}${mapped}`;
      piano.append(key);
    });

    for (let pitch = 36; pitch <= 96; pitch += 1) {
      if (![1, 3, 6, 8, 10].includes(pitch % 12)) continue;
      const key = document.createElement('button');
      key.className = 'key black';
      key.dataset.pitch = pitch;
      key.style.left = `${9 + whites.indexOf(pitch - 1) * 44 + 30}px`;
      key.textContent = noteName(pitch);
      piano.append(key);
    }
  }

  function updateTransport() {
    const clock = seconds => {
      const whole = Math.max(0, Math.round(seconds));
      return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
    };
    $('#transportTime').textContent = `${clock(playheadBeat * secondsPerBeat())} / ${clock(projectLength() * secondsPerBeat())}`;
  }

  function setPlayhead(beat, follow = false) {
    playheadBeat = clamp(beat, 0, projectLength());
    const left = `${playheadBeat * beatWidth}px`;
    $('#playhead')?.style && ($('#playhead').style.left = left);
    $('#arrangementPlayhead')?.style && ($('#arrangementPlayhead').style.left = left);
    updateTransport();

    if (follow) {
      const scroll = $('#rollScroll');
      const target = playheadBeat * beatWidth;
      if (target > scroll.scrollLeft + scroll.clientWidth - 130) scroll.scrollLeft = Math.max(0, target - scroll.clientWidth * .35);
    }
  }

  function ensureAudio() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    }
    const AudioApi = window.AudioContext || window.webkitAudioContext;
    if (!AudioApi) return null;
    context = new AudioApi();
    master = context.createGain();
    master.gain.value = 0.68;
    master.connect(context.destination);
    return context;
  }

  function waveform(instrument) {
    if (['cello', 'strings', 'horn', 'electric_bass'].includes(instrument)) return 'sawtooth';
    if (['retro_lead', 'drum_kit'].includes(instrument)) return 'square';
    if (['flute', 'choir', 'warm_pad', 'bell'].includes(instrument)) return 'sine';
    return 'triangle';
  }

  function playTone(instrument, pitch, velocity, duration, at) {
    const audio = ensureAudio();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = at ?? audio.currentTime;
    const loudness = clamp((velocity || 92) / 127, 0.08, 1);
    const length = Math.max(.08, duration);

    oscillator.type = waveform(instrument);
    oscillator.frequency.setValueAtTime(instrument === 'drum_kit' ? 120 : 440 * Math.pow(2, (pitch - 69) / 12), start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(.12 * loudness, start + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, start + length);
    oscillator.connect(gain).connect(master);
    oscillator.start(start);
    oscillator.stop(start + length + .06);

    activeSounds.push(() => {
      try { oscillator.stop(); oscillator.disconnect(); gain.disconnect(); } catch (_) {}
    });
  }

  function glow(pitch, delay, duration) {
    const begin = setTimeout(() => {
      const key = $(`.key[data-pitch="${pitch}"]`);
      key?.classList.add('playing');
      const end = setTimeout(() => key?.classList.remove('playing'), Math.max(80, duration));
      activeSounds.push(() => clearTimeout(end));
    }, Math.max(0, delay));
    activeSounds.push(() => clearTimeout(begin));
  }

  function stopPlayback(reset = false) {
    playing = false;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    activeSounds.splice(0).forEach(cleanup => cleanup());
    $$('.key.playing').forEach(key => key.classList.remove('playing'));
    $('#play').textContent = '▶ Play';
    if (reset) setPlayhead(0);
  }

  function animatePlayback() {
    if (!playing) return;
    const beat = playbackStartBeat + ((performance.now() - playbackStartedAt) / 1000) / secondsPerBeat();
    if (beat >= projectLength()) {
      stopPlayback(true);
      status('Playback reached the end.');
      return;
    }
    setPlayhead(beat, true);
    animationFrame = requestAnimationFrame(animatePlayback);
  }

  function togglePlay() {
    if (playing) {
      stopPlayback(false);
      status('Playback paused.');
      return;
    }

    syncMeta();
    const audio = ensureAudio();
    if (!audio) return;
    const start = playheadBeat;
    const startAt = audio.currentTime + .05;
    const soloed = project.tracks.some(track => track.solo);

    project.tracks.filter(track => !track.muted && (!soloed || track.solo)).forEach(track => {
      track.notes.forEach(item => {
        const end = item.start + item.duration;
        if (end <= start) return;
        const actualStart = Math.max(start, item.start);
        const delay = (actualStart - start) * secondsPerBeat();
        const duration = (end - actualStart) * secondsPerBeat();
        playTone(track.instrument, item.pitch + Number($('#transpose').value || 0), item.velocity, duration, startAt + delay);
        glow(item.pitch, delay * 1000, duration * 1000);
      });
    });

    if (metronomeEnabled) {
      for (let beat = Math.ceil(start); beat < projectLength(); beat += 1) {
        const delay = (beat - start) * secondsPerBeat();
        playTone('bell', beat % 4 === 0 ? 84 : 76, 48, .06, startAt + delay);
      }
    }

    playing = true;
    playbackStartedAt = performance.now() + 50;
    playbackStartBeat = start;
    $('#play').textContent = '⏸ Pause';
    animationFrame = requestAnimationFrame(animatePlayback);
  }

  function playImmediate(pitch, beats = .5) {
    const audio = ensureAudio();
    if (!audio) return;
    const duration = beats * secondsPerBeat();
    playTone(activeTrack().instrument, pitch + Number($('#transpose').value || 0), 96, duration, audio.currentTime + .02);
    glow(pitch, 15, duration * 1000);
  }

  function inScale(pitch, scale) {
    return scale.notes.includes(((pitch - scale.root) % 12 + 12) % 12);
  }

  function scaleStep(pitch, amount, scale) {
    let value = pitch;
    let remaining = amount;
    while (remaining > 0) {
      value += 1;
      if (inScale(value, scale)) remaining -= 1;
    }
    return value;
  }

  function chordFor(pitch) {
    const scale = SCALE_MAP[project.key] || SCALE_MAP['D minor'];
    let root = pitch;
    while (!inScale(root, scale) && root > LOW_PITCH) root -= 1;
    return [root, scaleStep(root, 2, scale), scaleStep(root, 4, scale)].filter(value => value >= LOW_PITCH && value <= HIGH_PITCH);
  }

  function addAt(event) {
    const rect = $('#roll').getBoundingClientRect();
    const start = snap(clamp((event.clientX - rect.left) / beatWidth, 0, projectLength() - .125));
    const pitch = clamp(HIGH_PITCH - Math.floor((event.clientY - rect.top) / ROW_HEIGHT), LOW_PITCH, HIGH_PITCH);
    const pitches = $('#chordToggle').classList.contains('on') ? chordFor(pitch) : [pitch];
    const notes = pitches.map(value => note(start, value));
    activeTrack().notes.push(...notes);
    selectedNoteId = notes[0].id;
    renderRoll();
  }

  function findNote(id) {
    for (const track of project.tracks) {
      const item = track.notes.find(candidate => candidate.id === id);
      if (item) return { track, note: item };
    }
    return null;
  }

  function newProject() {
    if (!confirm('Start a new composition? Unsaved work will be replaced.')) return;
    project = blankProject();
    activeTrackId = project.tracks[0].id;
    selectedNoteId = null;
    playheadBeat = 0;
    render();
    status('New composition ready.');
  }

  function loadExample() {
    project = potionSongExample();
    activeTrackId = project.tracks[0].id;
    selectedNoteId = null;
    playheadBeat = 0;
    render();
    status('Loaded Potion Song — Piano Example.', 6000);
  }

  function exportProject() {
    saveProject(true);
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'ihy-project'}.ihy.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('Exported project JSON.');
  }

  function gmInstrument(program, channel) {
    if (channel === 9) return 'drum_kit';
    if (program >= 24 && program <= 31) return 'acoustic_guitar';
    if (program >= 32 && program <= 39) return 'electric_bass';
    if (program === 42 || program === 43) return 'cello';
    if (program >= 40 && program <= 51) return 'strings';
    if (program >= 52 && program <= 54) return 'choir';
    if (program >= 56 && program <= 63) return 'horn';
    if (program >= 72 && program <= 79) return 'flute';
    if (program === 14) return 'bell';
    if (program >= 88 && program <= 95) return 'warm_pad';
    return 'grand_piano';
  }

  function parseMidi(buffer, fileName) {
    const data = new Uint8Array(buffer);
    let index = 0;
    const text = size => { const value = String.fromCharCode(...data.slice(index, index + size)); index += size; return value; };
    const u8 = () => data[index++];
    const u16 = () => (u8() << 8) | u8();
    const u32 = () => ((u8() * 0x1000000) + (u8() << 16) + (u8() << 8) + u8()) >>> 0;
    const vlq = () => { let value = 0; let byte; do { byte = u8(); value = (value << 7) | (byte & 127); } while (byte & 128); return value; };

    if (text(4) !== 'MThd') throw new Error('This is not a Standard MIDI file.');
    const headerLength = u32();
    if (headerLength < 6) throw new Error('MIDI header is incomplete.');
    u16();
    const trackCount = u16();
    const division = u16();
    index += Math.max(0, headerLength - 6);
    if (division & 0x8000) throw new Error('SMPTE MIDI timing is not supported.');

    const tempos = [500000];
    const tracks = [];

    for (let trackIndex = 0; trackIndex < trackCount && index < data.length; trackIndex += 1) {
      if (text(4) !== 'MTrk') throw new Error('A MIDI track is malformed.');
      const end = index + u32();
      let tick = 0;
      let runningStatus = null;
      let name = '';
      let program = 0;
      let channel = 0;
      const active = new Map();
      const notes = [];

      while (index < end) {
        tick += vlq();
        let statusByte = data[index];
        if (statusByte < 128) {
          if (runningStatus === null) throw new Error('Invalid MIDI running status.');
          statusByte = runningStatus;
        } else {
          index += 1;
          if (statusByte < 240) runningStatus = statusByte;
        }

        if (statusByte === 255) {
          const type = u8();
          const size = vlq();
          const payload = data.slice(index, index + size);
          index += size;
          if (type === 3) name = String.fromCharCode(...payload);
          if (type === 81 && payload.length === 3) tempos.push((payload[0] << 16) | (payload[1] << 8) | payload[2]);
          continue;
        }

        if (statusByte === 240 || statusByte === 247) { index += vlq(); continue; }

        const command = statusByte & 240;
        channel = statusByte & 15;
        const first = u8();
        const second = command === 192 || command === 208 ? null : u8();
        if (command === 192) { program = first; continue; }

        const key = `${channel}:${first}`;
        if (command === 144 && second > 0) {
          const queue = active.get(key) || [];
          queue.push({ tick, velocity: second });
          active.set(key, queue);
        } else if (command === 128 || (command === 144 && second === 0)) {
          const start = active.get(key)?.shift();
          if (start) notes.push(note(start.tick / division, first, Math.max(.125, (tick - start.tick) / division), start.velocity));
        }
      }

      if (notes.length) {
        tracks.push({ id: uid(), name: name || `MIDI track ${tracks.length + 1}`, instrument: gmInstrument(program, channel), color: COLORS[tracks.length % COLORS.length], muted: false, solo: false, notes: notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch) });
      }
      index = end;
    }

    if (!tracks.length) throw new Error('No MIDI note events were found.');
    return { title: fileName.replace(/\.(mid|midi)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported MIDI', bpm: Math.round(60000000 / (tempos[0] || 500000)), key: 'C major', sections: [], tracks };
  }

  async function importFile(file) {
    try {
      project = /\.(mid|midi)$/i.test(file.name) ? normaliseProject(parseMidi(await file.arrayBuffer(), file.name)) : normaliseProject(JSON.parse(await file.text()));
      activeTrackId = project.tracks[0].id;
      selectedNoteId = null;
      playheadBeat = 0;
      render();
      status(`Imported ${file.name}.`);
    } catch (error) {
      alert(`Unable to import this file: ${error.message}`);
      status('Import failed.');
    }
  }

  function openQuickAdd(kind) {
    $('#quickAddTitle').textContent = `${kind} quick add`;
    $('#quickAddText').textContent = `The ${kind.toLowerCase()} builder will be added here in the next pass.`;
    $('#quickAddModal').hidden = false;
  }

  function closeQuickAdd() {
    $('#quickAddModal').hidden = true;
  }

  $('#newProject').addEventListener('click', newProject);
  $('#save').addEventListener('click', () => saveProject(false));
  $('#loadExample').addEventListener('click', loadExample);
  $('#createSound').addEventListener('click', () => setView('create'));
  $('#libraryButton').addEventListener('click', () => setView('library'));
  $('#analyseButton').addEventListener('click', () => setView('analyse'));
  $('#quickBass').addEventListener('click', () => openQuickAdd('Bass'));
  $('#quickMotif').addEventListener('click', () => openQuickAdd('Motif'));
  $('#quickAddClose').addEventListener('click', closeQuickAdd);
  $('#quickAddModal').addEventListener('click', event => { if (event.target === $('#quickAddModal')) closeQuickAdd(); });
  $('#import').addEventListener('click', () => $('#file').click());
  $('#export').addEventListener('click', exportProject);
  $('#file').addEventListener('change', event => { if (event.target.files[0]) importFile(event.target.files[0]); event.target.value = ''; });
  $('#title').addEventListener('change', syncMeta);
  $('#bpm').addEventListener('change', () => { syncMeta(); updateTransport(); });
  $('#key').addEventListener('change', () => { project.key = $('#key').value; });
  $('#zoomSlider').addEventListener('input', event => {
    zoom = clamp(Number(event.target.value) || 100, 70, 150);
    beatWidth = BASE_BEAT * zoom / 100;
    localStorage.setItem('ihy-roll-zoom', String(zoom));
    renderTimeline();
    renderRoll();
    updateTransport();
  });
  $('#chordToggle').addEventListener('click', () => {
    const button = $('#chordToggle');
    button.classList.toggle('on');
    button.setAttribute('aria-pressed', String(button.classList.contains('on')));
  });
  $('#metro').addEventListener('click', () => { metronomeEnabled = !metronomeEnabled; render(); status(metronomeEnabled ? 'Metronome enabled.' : 'Metronome disabled.'); });
  $('#armed').addEventListener('change', event => { activeTrackId = event.target.value; selectedNoteId = null; renderTracks(); renderRoll(); });
  $('#instrument').addEventListener('change', event => { activeTrack().instrument = event.target.value; renderTracks(); status(`${activeTrack().name} now uses ${instrumentName(activeTrack().instrument)}.`); });

  $('#tracks').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.arm) { activeTrackId = button.dataset.arm; selectedNoteId = null; renderTracks(); renderRoll(); return; }
    if (button.dataset.mute) { const track = getTrack(button.dataset.mute); track.muted = !track.muted; renderTracks(); return; }
    if (button.dataset.solo) { const track = getTrack(button.dataset.solo); track.solo = !track.solo; renderTracks(); }
  });

  $('#addTrack').addEventListener('click', () => {
    const track = { id: uid(), name: `Track ${project.tracks.length + 1}`, instrument: 'grand_piano', color: COLORS[project.tracks.length % COLORS.length], muted: false, solo: false, notes: [] };
    project.tracks.push(track);
    activeTrackId = track.id;
    selectedNoteId = null;
    render();
  });

  $('#addSection').addEventListener('click', () => {
    const name = prompt('Section name', `Section ${project.sections.length + 1}`);
    if (!name?.trim()) return;
    const start = project.sections.length ? project.sections[project.sections.length - 1].end : 0;
    project.sections.push({ id: uid(), name: name.trim(), start, end: Math.min(projectLength(), start + 8), color: COLORS[project.sections.length % COLORS.length] });
    renderTimeline();
  });

  $('#arrangement').addEventListener('click', event => {
    const section = event.target.closest('.arrangement-section');
    if (section?.disabled) return;
    if (section) {
      const entry = project.sections.find(item => item.id === section.dataset.section);
      const name = prompt('Section name', entry.name);
      if (name?.trim()) { entry.name = name.trim(); renderTimeline(); }
      return;
    }
    const rect = $('#arrangement').getBoundingClientRect();
    setPlayhead((event.clientX - rect.left) / beatWidth);
  });

  $('#clear').addEventListener('click', () => {
    if (!confirm(`Clear all notes from ${activeTrack().name}?`)) return;
    activeTrack().notes = [];
    selectedNoteId = null;
    renderRoll();
  });

  $('#rollScroll').addEventListener('scroll', () => { $('#arrangementViewport').scrollLeft = $('#rollScroll').scrollLeft; });
  $('#roll').addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const node = event.target.closest('.note');
    if (!node) { if (event.target === $('#roll')) addAt(event); return; }
    event.preventDefault();
    const ref = findNote(node.dataset.note);
    if (!ref) return;
    selectedNoteId = ref.note.id;
    noteDrag = { ref, mode: event.target.classList.contains('resize-handle') ? 'resize' : 'move', x: event.clientX, y: event.clientY, start: ref.note.start, pitch: ref.note.pitch, duration: ref.note.duration };
    renderRoll();
  });
  $('#roll').addEventListener('pointermove', event => {
    if (!noteDrag) return;
    const dx = (event.clientX - noteDrag.x) / beatWidth;
    const dy = Math.round((event.clientY - noteDrag.y) / ROW_HEIGHT);
    if (noteDrag.mode === 'resize') {
      noteDrag.ref.note.duration = clamp(snap(noteDrag.duration + dx), .125, projectLength() - noteDrag.ref.note.start);
    } else {
      noteDrag.ref.note.start = clamp(snap(noteDrag.start + dx), 0, projectLength() - noteDrag.ref.note.duration);
      noteDrag.ref.note.pitch = clamp(noteDrag.pitch - dy, LOW_PITCH, HIGH_PITCH);
    }
    renderRoll();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => $('#roll').addEventListener(type, () => { noteDrag = null; }));
  $('#piano').addEventListener('pointerdown', event => { const key = event.target.closest('.key'); if (key) playImmediate(Number(key.dataset.pitch), heldKeys.has(' ') ? 1.35 : .5); });
  $('#record').addEventListener('click', () => { recording = !recording; recordingStartedAt = performance.now(); render(); status(recording ? 'Recording keyboard notes.' : 'Recording stopped.'); });
  $('#play').addEventListener('click', togglePlay);
  $('#stop').addEventListener('click', () => { stopPlayback(false); status('Playback stopped.'); });

  document.addEventListener('keydown', event => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); heldKeys.add(' '); return; }
    const key = event.key.toLowerCase();
    if (!KEYBOARD_MAP[key] || heldKeys.has(key)) return;
    heldKeys.add(key);
    const beats = heldKeys.has(' ') ? 1.35 : .5;
    playImmediate(KEYBOARD_MAP[key], beats);
    if (recording) {
      const start = snap(((performance.now() - recordingStartedAt) / 1000) / secondsPerBeat());
      if (start < projectLength()) {
        const item = note(start, KEYBOARD_MAP[key], beats);
        activeTrack().notes.push(item);
        selectedNoteId = item.id;
        renderRoll();
      }
    }
  });
  document.addEventListener('keyup', event => { if (event.code === 'Space') heldKeys.delete(' '); else heldKeys.delete(event.key.toLowerCase()); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeQuickAdd(); });
  window.addEventListener('pagehide', () => stopPlayback(false));

  render();
})();