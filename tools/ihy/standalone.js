(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const VERSION = '0.18';
  const GRID_MIN = 48;
  const GRID_MAX = 84;
  const MIN_PIANO = 36;
  const MAX_PIANO = 96;
  const ROW = 24;
  const MIN_BEATS = 64;
  const COLORS = ['#b68cff', '#60c6a4', '#dfb658', '#dc7898', '#79b4e3'];
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const KEYS = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72 };
  const INSTRUMENTS = [
    ['grand_piano', 'Grand Piano'], ['soft_piano', 'Soft Piano'], ['cello', 'Cello'], ['strings', 'Strings'],
    ['flute', 'Flute'], ['horn', 'French Horn'], ['choir', 'Choir'], ['warm_pad', 'Warm Pad'],
    ['bell', 'Bell'], ['acoustic_guitar', 'Acoustic Guitar'], ['electric_bass', 'Electric Bass'],
    ['drum_kit', 'Drum Kit'], ['retro_lead', 'Retro Lead'], ['pluck', 'Pluck']
  ];
  const SOUNDFONTS = {
    grand_piano: 'acoustic_grand_piano', soft_piano: 'acoustic_grand_piano', cello: 'cello',
    strings: 'string_ensemble_1', flute: 'flute', horn: 'french_horn', choir: 'choir_aahs',
    warm_pad: 'pad_2_warm', bell: 'tubular_bells', acoustic_guitar: 'acoustic_guitar_nylon',
    electric_bass: 'electric_bass_finger', drum_kit: 'synth_drum', retro_lead: 'lead_1_square', pluck: 'pizzicato_strings'
  };
  const SCALES = {
    'C major': { root: 0, notes: [0, 2, 4, 5, 7, 9, 11] },
    'D minor': { root: 2, notes: [0, 2, 3, 5, 7, 8, 10] },
    'A minor': { root: 9, notes: [0, 2, 3, 5, 7, 8, 10] },
    'F major': { root: 5, notes: [0, 2, 4, 5, 7, 9, 11] },
    'G major': { root: 7, notes: [0, 2, 4, 5, 7, 9, 11] },
    'A♭ major': { root: 8, notes: [0, 2, 4, 5, 7, 9, 11] }
  };
  const PRESETS = [['Coin', 88], ['Magic Sparkle', 96], ['Laser', 84], ['Jump', 64], ['Portal', 52]];

  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const noteName = pitch => `${NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
  const makeNote = (start, pitch, duration = 1, velocity = 92) => ({ id: uid(), start, pitch, duration, velocity, instrument: null });
  const getInstrumentName = id => (INSTRUMENTS.find(item => item[0] === id) || [id, id])[1];
  const displayScale = () => Math.max(.7, Number(document.documentElement.dataset.ihyRollScale || 1));

  function blankProject() {
    return { title: 'Untitled cue', bpm: 92, key: 'D minor', sections: [], source: null, tracks: [{ id: uid(), name: 'Piano', instrument: 'grand_piano', color: COLORS[0], muted: false, solo: false, notes: [] }] };
  }

  function normaliseProject(raw) {
    const empty = blankProject();
    if (!raw || !Array.isArray(raw.tracks) || !raw.tracks.length) return empty;
    return {
      ...empty, ...raw,
      tracks: raw.tracks.map((track, index) => ({ ...empty.tracks[0], ...track, id: track.id || uid(), color: track.color || COLORS[index % COLORS.length], muted: Boolean(track.muted), solo: Boolean(track.solo), notes: Array.isArray(track.notes) ? track.notes.map(note => ({ ...makeNote(0, 60), ...note, id: note.id || uid() })) : [] })),
      sections: Array.isArray(raw.sections) ? raw.sections.map((section, index) => ({ id: section.id || uid(), name: section.name || `Section ${index + 1}`, start: Number(section.start) || 0, end: Number(section.end) || 8, color: section.color || COLORS[index % COLORS.length] })) : []
    };
  }

  let project;
  try { project = normaliseProject(JSON.parse(localStorage.getItem('ihy-v018') || localStorage.getItem('ihy-v014') || localStorage.getItem('ihy-v013') || localStorage.getItem('ihy-v012') || 'null')); }
  catch (_) { project = blankProject(); }

  let activeTrackId = project.tracks[0].id;
  let beatWidth = 40;
  let selected = null;
  let noteDrag = null;
  let noteMenuRef = null;
  let timelineDragging = false;
  let chordMode = localStorage.getItem('ihy-chord-mode') === 'true';
  let recording = false;
  let recordStartedAt = 0;
  let metronome = false;
  let playheadBeat = 0;
  let isPlaying = false;
  let playbackStartedAt = 0;
  let playbackStartBeat = 0;
  let animationFrame = 0;
  let playbackToken = 0;
  let savedSnapshot = '';
  let pendingAction = null;
  const pressed = new Set();
  const timers = [];
  const stops = [];
  const players = new Map();
  const loads = new Map();
  let context = null;
  let master = null;

  const getTrack = id => project.tracks.find(track => track.id === id);
  const secondsPerBeat = () => 60 / Math.max(30, Number(project.bpm) || 92);
  const snap = value => { const unit = Number($('#quant').value || .25); return Math.round(value / unit) * unit; };

  function projectLength() {
    let end = MIN_BEATS;
    for (const section of project.sections) end = Math.max(end, Number(section.end) || 0);
    for (const track of project.tracks) for (const note of track.notes) end = Math.max(end, Number(note.start) + Number(note.duration));
    return Math.max(MIN_BEATS, Math.ceil(end / 4) * 4);
  }

  function arrangementSections() {
    const beats = projectLength();
    return project.sections.length ? project.sections : [{ id: 'main-track', name: 'Main track', start: 0, end: beats, color: '#dfb658', generated: true }];
  }

  function updateMeta() { project.title = $('#title').value || project.title; project.bpm = Number($('#bpm').value) || 92; project.key = $('#key').value; }
  function snapshot() { updateMeta(); return JSON.stringify(project); }
  function setStatus(message, timeout = 3400) { $('#status').textContent = message; clearTimeout(setStatus.timer); if (timeout) setStatus.timer = setTimeout(() => { $('#status').textContent = ''; }, timeout); }
  function setView(name) { $$('.view').forEach(view => view.classList.toggle('active', view.id === `${name}View`)); }

  function ensureAudio() {
    if (context) { if (context.state === 'suspended') context.resume().catch(() => {}); return context; }
    const API = window.AudioContext || window.webkitAudioContext;
    if (!API) return null;
    context = new API();
    master = context.createGain();
    master.gain.value = .72;
    master.connect(context.destination);
    return context;
  }

  async function loadInstrument(id) {
    if (!window.Soundfont || !SOUNDFONTS[id]) return null;
    if (players.has(id)) return players.get(id);
    if (loads.has(id)) return loads.get(id);
    const audio = ensureAudio();
    if (!audio) return null;
    const loading = window.Soundfont.instrument(audio, SOUNDFONTS[id], { soundfont: 'MusyngKite', format: 'mp3', destination: master, gain: .9 }).then(player => { players.set(id, player); loads.delete(id); return player; }).catch(() => { loads.delete(id); setStatus(`${getInstrumentName(id)} samples could not load — synth fallback active.`, 6000); return null; });
    loads.set(id, loading);
    return loading;
  }

  function synth(id, midi, velocity, duration, when) {
    const audio = ensureAudio();
    if (!audio) return;
    const amount = clamp((velocity || 92) / 127, .08, 1);
    const output = audio.createGain();
    const oscillator = audio.createOscillator();
    let wave = 'triangle';
    let hz = 440 * Math.pow(2, (midi - 69) / 12);
    if (id === 'retro_lead' || id === 'drum_kit') wave = 'square';
    if (id === 'drum_kit') { hz = 120; duration = .12; }
    if (id === 'cello' || id === 'horn') wave = 'sawtooth';
    if (id === 'bell' || id === 'flute' || id === 'warm_pad' || id === 'choir') wave = 'sine';
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(hz, when);
    output.gain.setValueAtTime(.0001, when);
    output.gain.exponentialRampToValueAtTime(.11 * amount, when + .012);
    output.gain.exponentialRampToValueAtTime(.0001, when + Math.max(.08, duration));
    oscillator.connect(output).connect(master);
    oscillator.start(when);
    oscillator.stop(when + Math.max(.08, duration) + .07);
    stops.push(() => { try { oscillator.stop(); oscillator.disconnect(); output.disconnect(); } catch (_) {} });
  }

  function sample(player, midi, velocity, duration, when) {
    try {
      const node = player.play(midi, when, { duration: Math.max(.08, duration), gain: clamp((velocity || 92) / 127, .12, .96), attack: .005, release: Math.min(.35, Math.max(.08, duration * .35)) });
      if (node?.stop) stops.push(() => { try { node.stop(); } catch (_) {} });
      return true;
    } catch (_) { return false; }
  }

  function setGlow(midi, on) {
    const key = document.querySelector(`.key[data-pitch="${midi}"]`);
    if (!key) return;
    const count = Math.max(0, Number(key.dataset.glow || 0) + (on ? 1 : -1));
    key.dataset.glow = count;
    key.classList.toggle('playing', count > 0);
  }

  function scheduleGlow(midi, delayMs, durationMs) {
    const begin = setTimeout(() => { setGlow(midi, true); const end = setTimeout(() => setGlow(midi, false), Math.max(90, durationMs)); timers.push(end); }, Math.max(0, delayMs));
    timers.push(begin);
  }

  function clearGlows() { $$('.key.playing').forEach(key => { key.classList.remove('playing'); key.dataset.glow = '0'; }); }

  function setPlayhead(beat, follow = false) {
    playheadBeat = clamp(beat, 0, projectLength());
    const left = `${playheadBeat * beatWidth}px`;
    const grid = $('#playhead');
    const arrangement = $('#arrangementPlayhead');
    if (grid) grid.style.left = left;
    if (arrangement) arrangement.style.left = left;
    if (follow) {
      const scroll = $('#rollScroll');
      const target = playheadBeat * beatWidth * displayScale();
      if (target > scroll.scrollLeft + scroll.clientWidth - 120) scroll.scrollLeft = Math.max(0, target - scroll.clientWidth * .35);
    }
  }

  function stopPlayback(reset = false) {
    playbackToken += 1;
    timers.splice(0).forEach(clearTimeout);
    stops.splice(0).forEach(stop => stop());
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    isPlaying = false;
    clearGlows();
    if (reset) setPlayhead(0);
  }

  function animatePlayback() {
    if (!isPlaying) return;
    const beat = playbackStartBeat + ((performance.now() - playbackStartedAt) / 1000) / secondsPerBeat();
    if (beat >= projectLength()) { stopPlayback(true); setStatus('Playback reached the end.'); return; }
    setPlayhead(beat, true);
    animationFrame = requestAnimationFrame(animatePlayback);
  }

  async function playProject() {
    closeNoteMenu();
    stopPlayback(false);
    const token = ++playbackToken;
    const soloed = project.tracks.some(track => track.solo);
    const activeTracks = project.tracks.filter(track => !track.muted && (!soloed || track.solo));
    const ids = [...new Set(activeTracks.flatMap(track => [track.instrument, ...track.notes.map(note => note.instrument).filter(Boolean)]))];
    const missing = ids.filter(id => SOUNDFONTS[id] && !players.has(id));
    if (missing.length) setStatus(`Loading sampled ${missing.map(getInstrumentName).join(', ')}…`, 0);
    await Promise.all(ids.map(loadInstrument));
    if (token !== playbackToken) return;
    const audio = ensureAudio();
    if (!audio) return;
    const now = audio.currentTime + .08;
    const start = playheadBeat;
    const beatSeconds = secondsPerBeat();
    for (const track of activeTracks) {
      for (const note of track.notes) {
        const end = note.start + note.duration;
        if (end <= start) continue;
        const actualStart = Math.max(start, note.start);
        const duration = end - actualStart;
        const delay = (actualStart - start) * beatSeconds;
        const instrument = note.instrument || track.instrument;
        const pitch = clamp(note.pitch + Number($('#transpose').value || 0), MIN_PIANO, MAX_PIANO);
        const player = players.get(instrument);
        if (player) sample(player, pitch, note.velocity, duration * beatSeconds, now + delay);
        else synth(instrument, pitch, note.velocity, duration * beatSeconds, now + delay);
        scheduleGlow(pitch, delay * 1000, duration * beatSeconds * 1000);
      }
    }
    if (metronome) {
      const bell = players.get('bell');
      for (let beat = Math.ceil(start); beat < projectLength(); beat += 1) {
        const delay = (beat - start) * beatSeconds;
        const pitch = beat % 4 === 0 ? 84 : 76;
        if (bell) sample(bell, pitch, 52, .06, now + delay); else synth('bell', pitch, 52, .06, now + delay);
      }
    }
    isPlaying = true;
    playbackStartBeat = start;
    playbackStartedAt = performance.now() + 80;
    animationFrame = requestAnimationFrame(animatePlayback);
    setStatus(`Playing from beat ${start.toFixed(2)}.`);
  }

  async function playImmediate(midi, beats = .5) {
    const track = getTrack(activeTrackId);
    const id = track.instrument;
    const pitch = clamp(midi + Number($('#transpose').value || 0), MIN_PIANO, MAX_PIANO);
    const duration = beats * secondsPerBeat();
    const audio = ensureAudio();
    if (!audio) return;
    if (!players.has(id) && SOUNDFONTS[id]) setStatus(`Loading ${getInstrumentName(id)} samples…`, 0);
    const player = await loadInstrument(id);
    const now = audio.currentTime + .02;
    if (player) sample(player, pitch, 96, duration, now); else synth(id, pitch, 96, duration, now);
    scheduleGlow(pitch, 20, duration * 1000);
  }

  function inScale(pitch, scale) { return scale.notes.includes(((pitch - scale.root) % 12 + 12) % 12); }
  function nearestScalePitch(pitch, scale) { let best = pitch; let distance = Infinity; for (let delta = -6; delta <= 6; delta += 1) { const trial = pitch + delta; if (trial < GRID_MIN || trial > GRID_MAX || !inScale(trial, scale)) continue; if (Math.abs(delta) < distance) { best = trial; distance = Math.abs(delta); } } return best; }
  function diatonicAbove(pitch, steps, scale) { let candidate = pitch; let remaining = steps; while (remaining > 0) { candidate += 1; if (inScale(candidate, scale)) remaining -= 1; } return candidate; }
  function chordFor(pitch) { const scale = SCALES[$('#key').value] || SCALES['D minor']; let root = nearestScalePitch(pitch, scale); let third = diatonicAbove(root, 2, scale); let fifth = diatonicAbove(root, 4, scale); while (fifth > GRID_MAX && root - 12 >= GRID_MIN) { root -= 12; third = diatonicAbove(root, 2, scale); fifth = diatonicAbove(root, 4, scale); } return [root, third, fifth].filter(value => value >= GRID_MIN && value <= GRID_MAX); }

  function renderHeader() { const chord = $('#chordToggle'); chord.classList.toggle('on', chordMode); chord.setAttribute('aria-pressed', String(chordMode)); chord.title = chordMode ? `${$('#key').value}: key-aware triads on` : 'Add one note per click'; }

  function renderTracks() {
    const root = $('#tracks');
    const armed = $('#armed');
    root.innerHTML = '';
    armed.innerHTML = '';
    for (const track of project.tracks) {
      armed.insertAdjacentHTML('beforeend', `<option value="${track.id}" ${track.id === activeTrackId ? 'selected' : ''}>${track.name}</option>`);
      root.insertAdjacentHTML('beforeend', `<div class="track ${track.id === activeTrackId ? 'active' : ''}"><span class="swatch" style="background:${track.color}"></span><button class="btn" data-arm="${track.id}">${track.name}</button><span class="instrument">${getInstrumentName(track.instrument)}</span><span><button class="btn" data-mute="${track.id}">M</button><button class="btn" data-solo="${track.id}">S</button></span></div>`);
    }
    $('#instrument').innerHTML = INSTRUMENTS.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
    $('#instrument').value = getTrack(activeTrackId).instrument;
  }

  function renderArrangement() {
    const root = $('#arrangement');
    const beats = projectLength();
    root.innerHTML = '<div class="arrangement-playhead" id="arrangementPlayhead"></div>';
    root.style.width = `${beats * beatWidth}px`;
    for (let beat = 0; beat <= beats; beat += 4) root.insertAdjacentHTML('beforeend', `<span class="ruler-mark" style="left:${beat * beatWidth + 4}px">${beat / 4 + 1}</span>`);
    for (const section of arrangementSections()) root.insertAdjacentHTML('beforeend', `<button class="arrangement-section" data-section="${section.id}" ${section.generated ? 'disabled title="Add sections to divide Main track"' : ''} style="left:${section.start * beatWidth + 4}px;width:${Math.max(38, (section.end - section.start) * beatWidth - 8)}px;background:${section.color}">${section.name}</button>`);
  }

  function renderRoll() {
    const labels = $('#labels');
    const roll = $('#roll');
    const beats = projectLength();
    labels.innerHTML = '';
    roll.innerHTML = '<div class="playhead" id="playhead"></div>';
    roll.style.width = `${beats * beatWidth}px`;
    for (let pitch = GRID_MAX; pitch >= GRID_MIN; pitch -= 1) labels.insertAdjacentHTML('beforeend', `<div class="pitch-label ${pitch % 12 === 0 ? 'c' : ''}">${noteName(pitch)}</div>`);
    for (let beat = 0; beat <= beats; beat += 4) roll.insertAdjacentHTML('beforeend', `<span class="bar" style="left:${beat * beatWidth + 4}px">${beat / 4 + 1}</span>`);
    for (const track of project.tracks) for (const note of track.notes) roll.insertAdjacentHTML('beforeend', `<div class="note ${selected?.note.id === note.id ? 'selected' : ''}" data-note="${note.id}" title="${track.name} · ${noteName(note.pitch)} · ${note.duration} beats" style="left:${note.start * beatWidth + 1}px;top:${(GRID_MAX - note.pitch) * ROW + 2}px;width:${Math.max(10, note.duration * beatWidth - 2)}px;background:${track.color}"><span class="resize"></span></div>`);
    setPlayhead(playheadBeat);
  }

  function renderKeyboard() {
    const root = $('#piano');
    root.innerHTML = '';
    const whites = [];
    for (let pitch = MIN_PIANO; pitch <= MAX_PIANO; pitch += 1) if (![1, 3, 6, 8, 10].includes(pitch % 12)) whites.push(pitch);
    for (const pitch of whites) { const mapped = Object.entries(KEYS).find(([, value]) => value === pitch)?.[0]?.toUpperCase() || ''; root.insertAdjacentHTML('beforeend', `<button class="key" data-pitch="${pitch}">${noteName(pitch)}${mapped}</button>`); }
    for (let pitch = MIN_PIANO; pitch <= MAX_PIANO; pitch += 1) if ([1, 3, 6, 8, 10].includes(pitch % 12)) root.insertAdjacentHTML('beforeend', `<button class="key black" data-pitch="${pitch}" style="left:${9 + whites.indexOf(pitch - 1) * 44 + 30}px">${noteName(pitch)}</button>`);
  }

  function renderPresets() { const root = $('#presets'); if (root) root.innerHTML = PRESETS.map((preset, index) => `<button class="preset" data-preset="${index}"><b>${preset[0]}</b><span>simple synth effect</span></button>`).join(''); }
  function render() { updateMeta(); renderHeader(); renderTracks(); renderArrangement(); renderRoll(); renderKeyboard(); renderPresets(); }

  function findNote(id) { for (const track of project.tracks) { const note = track.notes.find(item => item.id === id); if (note) return { track, note }; } return null; }

  function createAt(event) {
    const box = $('#roll').getBoundingClientRect();
    const start = snap(clamp((event.clientX - box.left) / (beatWidth * displayScale()), 0, projectLength() - .125));
    const pitch = clamp(GRID_MAX - Math.floor((event.clientY - box.top) / (ROW * displayScale())), GRID_MIN, GRID_MAX);
    const track = getTrack(activeTrackId);
    const notes = (chordMode ? chordFor(pitch) : [pitch]).map(value => makeNote(start, value));
    track.notes.push(...notes);
    selected = { track, note: notes[0] };
    renderRoll();
    setStatus(chordMode ? `Added ${$('#key').value} triad to ${track.name}.` : `Added ${noteName(pitch)} to ${track.name}.`);
  }

  function closeNoteMenu() { $('#notePopover').hidden = true; noteMenuRef = null; }
  function openNoteMenu(ref, event) {
    noteMenuRef = ref;
    const menu = $('#notePopover');
    $('#notePopoverTitle').textContent = `${ref.track.name} · ${noteName(ref.note.pitch)}`;
    $('#noteMenuInstrument').innerHTML = `<option value="">Track instrument — ${getInstrumentName(ref.track.instrument)}</option>` + INSTRUMENTS.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('');
    $('#noteMenuInstrument').value = ref.note.instrument || '';
    $('#noteMenuVelocity').value = ref.note.velocity || 92;
    $('#noteMenuLength').value = ref.note.duration;
    menu.hidden = false;
    menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8))}px`;
  }
  function applyNoteMenu() { if (!noteMenuRef) return; const note = noteMenuRef.note; note.instrument = $('#noteMenuInstrument').value || null; note.velocity = clamp(Number($('#noteMenuVelocity').value) || 92, 1, 127); note.duration = clamp(snap(Number($('#noteMenuLength').value) || 1), .125, projectLength() - note.start); selected = noteMenuRef; closeNoteMenu(); renderRoll(); setStatus('Note updated.'); }
  function deleteMenuNote() { if (!noteMenuRef) return; noteMenuRef.track.notes = noteMenuRef.track.notes.filter(note => note.id !== noteMenuRef.note.id); selected = null; closeNoteMenu(); renderRoll(); setStatus('Note deleted.'); }

  function saveProject(silent = false) { updateMeta(); localStorage.setItem('ihy-v018', JSON.stringify(project)); savedSnapshot = snapshot(); if (!silent) setStatus(`Saved “${project.title}” locally.`); }
  function exportProject() { saveProject(true); const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `${(project.title || 'ihy-project').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ihy.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Exported editable Ihy JSON.'); }

  function gmInstrument(program, channel) {
    if (channel === 9) return 'drum_kit';
    if (program <= 7) return 'grand_piano';
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

  function midiKeyName(sf, minor) {
    const major = ['C major','G major','D major','A major','E major','B major','F# major','C# major','F major','B♭ major','E♭ major','A♭ major','D♭ major','G♭ major','C♭ major'];
    const naturalMinor = ['A minor','E minor','B minor','F# minor','C# minor','G# minor','D# minor','A# minor','D minor','G minor','C minor','F minor','B♭ minor','E♭ minor','A♭ minor'];
    return (minor ? naturalMinor : major)[clamp(sf + 7, 0, 14)] || 'C major';
  }

  function parseMidi(buffer, filename) {
    const data = new Uint8Array(buffer);
    let index = 0;
    const text = length => { const value = String.fromCharCode(...data.slice(index, index + length)); index += length; return value; };
    const u8 = () => data[index++];
    const u16 = () => (u8() << 8) | u8();
    const u32 = () => ((u8() * 0x1000000) + (u8() << 16) + (u8() << 8) + u8()) >>> 0;
    const vlq = () => { let value = 0, byte; do { byte = u8(); value = (value << 7) | (byte & 0x7f); } while (byte & 0x80); return value; };
    if (text(4) !== 'MThd') throw new Error('This is not a Standard MIDI file.');
    const headerLength = u32();
    if (headerLength < 6) throw new Error('MIDI header is incomplete.');
    const format = u16();
    const trackCount = u16();
    const division = u16();
    index += Math.max(0, headerLength - 6);
    if (division & 0x8000) throw new Error('SMPTE-timed MIDI is not supported yet.');
    const tempo = [{ tick: 0, microseconds: 500000 }];
    let timeSignature = null;
    let keySignature = null;
    const tracks = [];
    for (let trackIndex = 0; trackIndex < trackCount && index < data.length; trackIndex += 1) {
      if (text(4) !== 'MTrk') throw new Error('A MIDI track chunk is malformed.');
      const length = u32();
      const end = index + length;
      let tick = 0;
      let runningStatus = null;
      let name = '';
      let program = 0;
      let channel = 0;
      let finalTick = 0;
      const active = new Map();
      const notes = [];
      while (index < end) {
        tick += vlq();
        finalTick = tick;
        let status = data[index];
        if (status < 0x80) { if (runningStatus === null) throw new Error('MIDI running status is invalid.'); status = runningStatus; }
        else { index += 1; if (status < 0xf0) runningStatus = status; }
        if (status === 0xff) {
          const type = u8();
          const metaLength = vlq();
          const payload = data.slice(index, index + metaLength);
          index += metaLength;
          if (type === 0x03) name = String.fromCharCode(...payload);
          if (type === 0x51 && payload.length === 3) tempo.push({ tick, microseconds: (payload[0] << 16) | (payload[1] << 8) | payload[2] });
          if (type === 0x58 && payload.length >= 2) timeSignature = `${payload[0]}/${Math.pow(2, payload[1])}`;
          if (type === 0x59 && payload.length >= 2) keySignature = midiKeyName(payload[0] > 127 ? payload[0] - 256 : payload[0], payload[1] === 1);
          continue;
        }
        if (status === 0xf0 || status === 0xf7) { index += vlq(); continue; }
        const command = status & 0xf0;
        channel = status & 0x0f;
        const d1 = u8();
        const d2 = (command === 0xc0 || command === 0xd0) ? null : u8();
        if (command === 0xc0) { program = d1; continue; }
        if (command === 0x90 && d2 > 0) { const key = `${channel}:${d1}`; const queue = active.get(key) || []; queue.push({ tick, velocity: d2 }); active.set(key, queue); continue; }
        if (command === 0x80 || (command === 0x90 && d2 === 0)) { const key = `${channel}:${d1}`; const queue = active.get(key); const start = queue?.shift(); if (start) notes.push(makeNote(start.tick / division, d1, Math.max(.03125, (tick - start.tick) / division), start.velocity)); }
      }
      for (const [key, queue] of active.entries()) { const pitch = Number(key.split(':')[1]); for (const start of queue) notes.push(makeNote(start.tick / division, pitch, Math.max(.03125, (finalTick - start.tick) / division), start.velocity)); }
      if (notes.length) tracks.push({ id: uid(), name: name || `MIDI track ${tracks.length + 1}`, instrument: gmInstrument(program, channel), color: COLORS[tracks.length % COLORS.length], muted: false, solo: false, notes: notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch) });
      index = end;
    }
    if (!tracks.length) throw new Error('No MIDI note events were found.');
    tempo.sort((a, b) => a.tick - b.tick);
    const bpm = Math.round(60000000 / (tempo[0]?.microseconds || 500000));
    const title = filename.replace(/\.(mid|midi)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported MIDI';
    return { title, bpm, key: keySignature || 'C major', sections: [], tracks, source: { type: 'midi-import', filename, format, ticksPerBeat: division, timeSignature, keySignature } };
  }

  async function importMidiFile(file) {
    setStatus(`Reading ${file.name}…`, 0);
    try {
      project = normaliseProject(parseMidi(await file.arrayBuffer(), file.name));
      activeTrackId = project.tracks[0].id;
      playheadBeat = 0;
      $('#title').value = project.title;
      $('#bpm').value = project.bpm;
      if (SCALES[project.key]) $('#key').value = project.key; else { project.key = 'C major'; $('#key').value = 'C major'; }
      selected = null;
      render();
      savedSnapshot = '';
      setView('compose');
      setStatus(`Imported ${file.name}: ${project.tracks.length} track${project.tracks.length === 1 ? '' : 's'}, ${project.bpm} BPM. Main track is shown until sections are added.`, 6000);
    } catch (error) { alert(`Unable to read MIDI: ${error.message}`); setStatus('MIDI import failed.', 5000); }
  }

  async function importFile(file) {
    if (/\.(mid|midi)$/i.test(file.name)) return importMidiFile(file);
    try {
      project = normaliseProject(JSON.parse(await file.text()));
      activeTrackId = project.tracks[0].id;
      playheadBeat = 0;
      $('#title').value = project.title;
      $('#bpm').value = project.bpm;
      $('#key').value = SCALES[project.key] ? project.key : 'C major';
      render();
      savedSnapshot = '';
      setStatus(`Imported “${project.title}”. Save it locally when ready.`);
    } catch (error) { alert(`Invalid Ihy JSON: ${error.message}`); }
  }

  function openReplaceDialog(title, message, action) { pendingAction = action; $('#projectDialogTitle').textContent = title; $('#projectDialogText').textContent = message; $('#projectDialogBackdrop').hidden = false; }
  function requestReplace(title, message, action) { if (snapshot() !== savedSnapshot) { openReplaceDialog(title, message, action); return; } action(); }
  function executeReplace(saveFirst) { const action = pendingAction; $('#projectDialogBackdrop').hidden = true; pendingAction = null; if (saveFirst) saveProject(true); if (action) action(); }

  function newComposition() {
    requestReplace('Start a new blank composition?', 'Your current composition will be replaced. Would you like to save it first?', () => {
      project = blankProject(); activeTrackId = project.tracks[0].id; playheadBeat = 0;
      $('#title').value = project.title; $('#bpm').value = project.bpm; $('#key').value = project.key;
      selected = null; render(); savedSnapshot = ''; setView('compose'); setStatus('New blank composition ready.');
    });
  }

  async function loadPotionExample() {
    requestReplace('Load Potion Song example?', 'Your current composition will be replaced by the supplied piano MIDI example. Would you like to save it first?', async () => {
      setStatus('Loading Potion Song MIDI example…', 0);
      try {
        const response = await fetch('./examples/potion_song_all_piano_v7.mid?v=0.18', { cache: 'no-store' });
        if (!response.ok) throw new Error('The built-in MIDI file could not be read.');
        project = normaliseProject(parseMidi(await response.arrayBuffer(), 'Potion Song — Piano Example.mid'));
        project.title = 'Potion Song — Piano Example';
        project.sections = [];
        activeTrackId = project.tracks[0].id;
        playheadBeat = 0;
        $('#title').value = project.title; $('#bpm').value = project.bpm; $('#key').value = SCALES[project.key] ? project.key : 'C major';
        selected = null; render(); savedSnapshot = ''; setView('compose');
        setStatus('Loaded Potion Song MIDI example. Main track spans the full imported song.', 6000);
      } catch (error) { alert(`Unable to load the built-in MIDI example: ${error.message}`); }
    });
  }

  const arrangementBeat = event => { const rect = $('#arrangement').getBoundingClientRect(); return clamp((event.clientX - rect.left) / beatWidth, 0, projectLength()); };

  $('#newProject').addEventListener('click', newComposition);
  $('#save').addEventListener('click', () => saveProject(false));
  $('#loadExample').addEventListener('click', loadPotionExample);
  $('#createSound').addEventListener('click', () => setView('create'));
  $('#libraryButton').addEventListener('click', () => setView('library'));
  $('#analyseButton').addEventListener('click', () => setView('analyse'));
  $('#signalButton').addEventListener('click', () => setView('signal'));
  $('#import').addEventListener('click', () => $('#file').click());
  $('#export').addEventListener('click', exportProject);
  $('#file').addEventListener('change', event => { if (event.target.files[0]) importFile(event.target.files[0]); event.target.value = ''; });
  $('#dialogSave').addEventListener('click', () => executeReplace(true));
  $('#dialogDiscard').addEventListener('click', () => executeReplace(false));
  $('#dialogCancel').addEventListener('click', () => { $('#projectDialogBackdrop').hidden = true; pendingAction = null; });

  $('#chordToggle').addEventListener('click', () => { chordMode = !chordMode; localStorage.setItem('ihy-chord-mode', String(chordMode)); renderHeader(); setStatus(chordMode ? `Chord mode on — ${$('#key').value} triads.` : 'Chord mode off — clicks add one note.'); });
  $('#key').addEventListener('change', () => { project.key = $('#key').value; renderHeader(); });
  $('#armed').addEventListener('change', event => { activeTrackId = event.target.value; selected = null; closeNoteMenu(); renderTracks(); renderRoll(); });
  $('#instrument').addEventListener('change', event => {
    const track = getTrack(activeTrackId);
    if (!track) return;
    track.instrument = event.target.value;
    renderTracks();
    setStatus(`${track.name} now uses ${getInstrumentName(track.instrument)}.`);
  });
  $('#quickAdd').addEventListener('click', () => setStatus('Quick add is the next composition pass.'));

  $('#tracks').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.arm) { activeTrackId = button.dataset.arm; selected = null; closeNoteMenu(); renderTracks(); renderRoll(); }
    if (button.dataset.mute) { const track = getTrack(button.dataset.mute); track.muted = !track.muted; renderTracks(); }
    if (button.dataset.solo) { const track = getTrack(button.dataset.solo); track.solo = !track.solo; renderTracks(); }
  });

  $('#addTrack').addEventListener('click', () => { const track = { id: uid(), name: `Track ${project.tracks.length + 1}`, instrument: 'grand_piano', color: COLORS[project.tracks.length % COLORS.length], muted: false, solo: false, notes: [] }; project.tracks.push(track); activeTrackId = track.id; render(); });
  $('#addSection').addEventListener('click', () => { const name = prompt('Section name', 'New section'); if (!name?.trim()) return; const start = project.sections.length ? clamp(project.sections.at(-1).end, 0, projectLength() - 4) : 0; project.sections.push({ id: uid(), name: name.trim(), start, end: Math.min(projectLength(), start + 8), color: COLORS[project.sections.length % COLORS.length] }); renderArrangement(); });
  $('#arrangement').addEventListener('click', event => { const button = event.target.closest('.arrangement-section'); if (!button || button.disabled) return; const section = project.sections.find(item => item.id === button.dataset.section); const name = prompt('Section name', section.name); if (name?.trim()) { section.name = name.trim(); renderArrangement(); } });
  $('#clear').addEventListener('click', () => { const track = getTrack(activeTrackId); if (confirm(`Clear all notes from ${track.name}?`)) { track.notes = []; selected = null; closeNoteMenu(); renderRoll(); } });

  $('#roll').addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const tile = event.target.closest('.note');
    if (!tile) { if (event.target.id === 'roll') { closeNoteMenu(); createAt(event); } return; }
    const ref = findNote(tile.dataset.note); if (!ref) return;
    event.preventDefault(); selected = ref;
    noteDrag = { ref, mode: event.target.classList.contains('resize') ? 'resize' : 'move', x: event.clientX, y: event.clientY, start: ref.note.start, pitch: ref.note.pitch, duration: ref.note.duration };
    renderRoll();
  });
  $('#roll').addEventListener('pointermove', event => {
    if (!noteDrag) return;
    const dx = (event.clientX - noteDrag.x) / (beatWidth * displayScale());
    const dy = Math.round((event.clientY - noteDrag.y) / (ROW * displayScale()));
    if (noteDrag.mode === 'resize') noteDrag.ref.note.duration = clamp(snap(noteDrag.duration + dx), .125, projectLength() - noteDrag.ref.note.start);
    else { noteDrag.ref.note.start = clamp(snap(noteDrag.start + dx), 0, projectLength() - noteDrag.ref.note.duration); noteDrag.ref.note.pitch = clamp(noteDrag.pitch - dy, GRID_MIN, GRID_MAX); }
    renderRoll();
  });
  ['pointerup', 'pointercancel'].forEach(type => $('#roll').addEventListener(type, () => { noteDrag = null; }));
  $('#roll').addEventListener('contextmenu', event => { const tile = event.target.closest('.note'); if (!tile) return; event.preventDefault(); const ref = findNote(tile.dataset.note); if (ref) openNoteMenu(ref, event); });
  $('#noteMenuApply').addEventListener('click', applyNoteMenu);
  $('#noteMenuDelete').addEventListener('click', deleteMenuNote);
  $('#noteMenuClose').addEventListener('click', closeNoteMenu);
  document.addEventListener('pointerdown', event => { const menu = $('#notePopover'); if (!menu.hidden && !menu.contains(event.target) && !event.target.closest('.note')) closeNoteMenu(); });

  $('#rollScroll').addEventListener('scroll', () => { $('#arrangementViewport').scrollLeft = $('#rollScroll').scrollLeft; });
  $('#arrangement').addEventListener('pointerdown', event => { timelineDragging = true; setPlayhead(arrangementBeat(event)); });
  $('#arrangement').addEventListener('pointermove', event => { if (timelineDragging) setPlayhead(arrangementBeat(event)); });
  ['pointerup', 'pointercancel'].forEach(type => $('#arrangement').addEventListener(type, () => { timelineDragging = false; }));

  $('#piano').addEventListener('pointerdown', event => { const key = event.target.closest('.key'); if (key) playImmediate(Number(key.dataset.pitch), pressed.has(' ') ? 1.35 : .5); });
  $('#record').addEventListener('click', () => { recording = !recording; recordStartedAt = performance.now(); $('#record').classList.toggle('on', recording); $('#record').textContent = recording ? '⏺ Recording' : '⏺ Record'; setStatus(recording ? 'Recording keyboard notes.' : 'Recording stopped.'); });
  $('#metro').addEventListener('click', () => { metronome = !metronome; $('#metro').classList.toggle('on', metronome); $('#metro').setAttribute('aria-pressed', String(metronome)); setStatus(metronome ? 'Metronome enabled.' : 'Metronome disabled.'); });
  $('#play').addEventListener('click', playProject);
  $('#stop').addEventListener('click', () => { stopPlayback(false); setStatus('Playback stopped.'); });
  $('#presets').addEventListener('click', event => { const button = event.target.closest('[data-preset]'); if (!button) return; const [name, pitch] = PRESETS[Number(button.dataset.preset)]; const audio = ensureAudio(); if (audio) synth('retro_lead', pitch, 96, .28, audio.currentTime); setStatus(`${name} synth preset previewed.`); });

  document.addEventListener('keydown', event => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); pressed.add(' '); return; }
    const key = event.key.toLowerCase(); if (!KEYS[key] || pressed.has(key)) return;
    pressed.add(key);
    const duration = pressed.has(' ') ? 1.35 : .5;
    playImmediate(KEYS[key], duration);
    if (recording) {
      const start = snap(((performance.now() - recordStartedAt) / 1000) / secondsPerBeat());
      if (start < projectLength()) { const note = makeNote(start, KEYS[key], duration); getTrack(activeTrackId).notes.push(note); selected = { track: getTrack(activeTrackId), note }; renderRoll(); }
    }
  });
  document.addEventListener('keyup', event => { if (event.code === 'Space') pressed.delete(' '); else pressed.delete(event.key.toLowerCase()); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeNoteMenu(); });
  window.addEventListener('pagehide', () => stopPlayback(false));

  $('#title').value = project.title;
  $('#bpm').value = project.bpm;
  $('#key').value = SCALES[project.key] ? project.key : 'C major';
  render();
  savedSnapshot = snapshot();
})();