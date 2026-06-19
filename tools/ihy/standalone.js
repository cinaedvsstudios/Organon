(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const STORAGE_KEY = 'ihy-v028-project';
  const LEGACY_KEYS = ['ihy-v027', 'ihy-v026', 'ihy-v025', 'ihy-v024', 'ihy-v023', 'ihy-v022', 'ihy-v021'];
  const LOW_PITCH = 48;
  const HIGH_PITCH = 84;
  const ROW_HEIGHT = 24;
  const BASE_BEAT = 40;
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
  const SOUNDFONTS = {
    grand_piano: 'acoustic_grand_piano', soft_piano: 'acoustic_grand_piano', cello: 'cello',
    strings: 'string_ensemble_1', flute: 'flute', horn: 'french_horn', choir: 'choir_aahs',
    warm_pad: 'pad_2_warm', bell: 'tubular_bells', acoustic_guitar: 'acoustic_guitar_nylon',
    electric_bass: 'electric_bass_finger', drum_kit: 'synth_drum', retro_lead: 'lead_1_square', pluck: 'acoustic_guitar_nylon'
  };
  const SCALE_MAP = {
    'C major': { root: 0, notes: [0, 2, 4, 5, 7, 9, 11] },
    'D minor': { root: 2, notes: [0, 2, 3, 5, 7, 8, 10] },
    'A minor': { root: 9, notes: [0, 2, 3, 5, 7, 8, 10] },
    'F major': { root: 5, notes: [0, 2, 4, 5, 7, 9, 11] },
    'G major': { root: 7, notes: [0, 2, 4, 5, 7, 9, 11] },
    'A♭ major': { root: 8, notes: [0, 2, 4, 5, 7, 9, 11] }
  };

  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const noteName = pitch => `${NOTE_NAMES[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
  const instrumentName = id => (INSTRUMENTS.find(([instrumentId]) => instrumentId === id) || [id, id])[1];
  const makeNote = (start, pitch, duration = 1, velocity = 92) => ({ id: uid(), start, pitch, duration, velocity });
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

  function blankProject() {
    return {
      title: 'Untitled cue', bpm: 92, key: 'D minor', sections: [],
      tracks: [{ id: uid(), name: 'Piano', instrument: 'grand_piano', color: COLORS[0], muted: false, solo: false, hidden: false, notes: [] }]
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
        id: section.id || uid(), name: String(section.name || `Section ${index + 1}`),
        start: Math.max(0, Number(section.start) || 0), end: Math.max(0.25, Number(section.end) || 8),
        color: section.color || COLORS[index % COLORS.length]
      })).filter(section => section.end > section.start) : [],
      tracks: raw.tracks.map((track, index) => ({
        id: track.id || uid(), name: String(track.name || `Track ${index + 1}`),
        instrument: INSTRUMENTS.some(([id]) => id === track.instrument) ? track.instrument : 'grand_piano',
        color: track.color || COLORS[index % COLORS.length], muted: Boolean(track.muted), solo: Boolean(track.solo), hidden: Boolean(track.hidden),
        notes: Array.isArray(track.notes) ? track.notes.map(note => ({
          id: note.id || uid(), start: Math.max(0, Number(note.start) || 0),
          pitch: clamp(Number(note.pitch) || 60, LOW_PITCH, HIGH_PITCH), duration: Math.max(0.125, Number(note.duration) || 1), velocity: clamp(Number(note.velocity) || 92, 1, 127)
        })).sort((left, right) => left.start - right.start || left.pitch - right.pitch) : []
      }))
    };
  }

  function loadProject() {
    for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
      try {
        const saved = localStorage.getItem(key);
        if (saved) return normaliseProject(JSON.parse(saved));
      } catch (_) {}
    }
    return blankProject();
  }

  let project = loadProject();
  let activeTrackId = project.tracks[0].id;
  let selectedNoteId = null;
  let beatWidth = BASE_BEAT * clamp(Number(localStorage.getItem('ihy-roll-zoom') || 100), 70, 150) / 100;
  let playheadBeat = 0;
  let playing = false;
  let playStartedAt = 0;
  let playStartedBeat = 0;
  let animationFrame = 0;
  let noteDrag = null;
  let recording = false;
  let recordingStartedAt = 0;
  let metronomeEnabled = false;
  const heldKeys = new Set();
  const cleanupAudio = [];
  let audioContext = null;
  let masterGain = null;
  const soundfontPlayers = new Map();
  const soundfontLoads = new Map();
  let hasCenteredC4 = false;

  const getTrack = id => project.tracks.find(track => track.id === id);
  const activeTrack = () => getTrack(activeTrackId) || project.tracks[0];
  const secondsPerBeat = () => 60 / clamp(Number(project.bpm) || 92, 30, 260);
  const snap = value => Math.round(value / Number($('#quant').value || 0.25)) * Number($('#quant').value || 0.25);

  function projectLength() {
    let result = MIN_BEATS;
    project.sections.forEach(section => { result = Math.max(result, section.end); });
    project.tracks.forEach(track => track.notes.forEach(note => { result = Math.max(result, note.start + note.duration); }));
    return Math.max(MIN_BEATS, Math.ceil(result / 4) * 4);
  }

  function status(message, delay = 3500) {
    const target = $('#status');
    if (!target) return;
    target.textContent = message;
    clearTimeout(status.timer);
    if (message && delay) status.timer = setTimeout(() => { if (target.textContent === message) target.textContent = ''; }, delay);
  }

  function syncMeta() {
    project.title = $('#title').value.trim() || 'Untitled cue';
    project.bpm = clamp(Number($('#bpm').value) || 92, 30, 260);
    project.key = SCALE_MAP[$('#key').value] ? $('#key').value : 'D minor';
  }

  function saveProject(quiet = false) {
    syncMeta();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    if (!quiet) status(`Saved “${project.title}”.`);
  }

  function updateTransport() {
    const clock = seconds => {
      const whole = Math.max(0, Math.round(seconds));
      return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
    };
    $('#transportTime').textContent = `${clock(playheadBeat * secondsPerBeat())} / ${clock(projectLength() * secondsPerBeat())}`;
    $('#play').textContent = playing ? '⏸ Pause' : '▶ Play';
  }

  function renderControls() {
    $('#title').value = project.title;
    $('#bpm').value = project.bpm;
    $('#key').value = project.key;
    const zoom = Math.round(beatWidth / BASE_BEAT * 100);
    $('#zoomSlider').value = String(zoom);
    $('#zoomValue').textContent = `${zoom}%`;
    $('#record').classList.toggle('on', recording);
    $('#record').textContent = recording ? '⏺ Recording' : '⏺ Record';
    $('#metro').classList.toggle('on', metronomeEnabled);
    $('#metro').setAttribute('aria-pressed', String(metronomeEnabled));
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
      row.innerHTML = `<span class="swatch" style="background:${track.color}"></span><button class="btn track-arm" data-action="arm" data-track="${track.id}">${escapeHtml(track.name)}</button><span class="track-actions"><button class="btn track-control${track.muted ? ' on' : ''}" data-action="mute" data-track="${track.id}" aria-pressed="${track.muted}" title="Mute this track">M</button><button class="btn track-control${track.solo ? ' solo-active' : ''}" data-action="solo" data-track="${track.id}" aria-pressed="${track.solo}" title="Solo this track">S</button><button class="btn track-control${track.hidden ? ' hide-active' : ''}" data-action="hide" data-track="${track.id}" aria-pressed="${track.hidden}" title="Hide this track from the piano roll">H</button></span>`;
      list.append(row);
    });
    const instrument = $('#instrument');
    instrument.replaceChildren(...INSTRUMENTS.map(([id, name]) => new Option(name, id)));
    instrument.value = activeTrack().instrument;
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
    const sections = project.sections.length ? project.sections : [{ id: 'main-track', name: 'Main track', start: 0, end: total, color: '#dfb658', readonly: true }];
    sections.forEach(section => {
      const pill = document.createElement('button');
      pill.className = 'arrangement-section';
      pill.dataset.section = section.id;
      pill.disabled = Boolean(section.readonly);
      pill.style.left = `${section.start * beatWidth + 4}px`;
      pill.style.width = `${Math.max(44, (section.end - section.start) * beatWidth - 8)}px`;
      pill.style.background = section.color;
      pill.textContent = section.name;
      host.append(pill);
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
      label.className = `pitch-label${pitch % 12 === 0 ? ' c-row' : ''}${pitch === 60 ? ' c4-row' : ''}`;
      label.textContent = noteName(pitch);
      labels.append(label);
      if (pitch % 12 === 0) {
        const guide = document.createElement('div');
        guide.className = `c-guide${pitch === 60 ? ' c4-guide' : ''}`;
        guide.style.top = `${(HIGH_PITCH - pitch) * ROW_HEIGHT}px`;
        roll.append(guide);
      }
    }
    project.tracks.filter(track => !track.hidden).forEach(track => track.notes.forEach(note => {
      const node = document.createElement('div');
      node.className = `note${selectedNoteId === note.id ? ' selected' : ''}`;
      node.dataset.note = note.id;
      node.title = `${track.name} · ${noteName(note.pitch)} · ${note.duration} beats`;
      node.style.left = `${note.start * beatWidth + 1}px`;
      node.style.top = `${(HIGH_PITCH - note.pitch) * ROW_HEIGHT + 2}px`;
      node.style.width = `${Math.max(10, note.duration * beatWidth - 2)}px`;
      node.style.background = track.color;
      node.innerHTML = '<span class="resize-handle"></span>';
      roll.append(node);
    }));
  }

  function renderKeyboard() {
    const piano = $('#piano');
    piano.replaceChildren();
    const whites = [];
    for (let pitch = 36; pitch <= 96; pitch += 1) if (![1, 3, 6, 8, 10].includes(pitch % 12)) whites.push(pitch);
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

  function renderAll({ centerC4 = false } = {}) {
    renderControls();
    renderTracks();
    renderTimeline();
    renderRoll();
    renderKeyboard();
    updateTransport();
    if (centerC4 || !hasCenteredC4) requestAnimationFrame(() => {
      const scroll = $('#rollScroll');
      const c4Center = (HIGH_PITCH - 60) * ROW_HEIGHT + ROW_HEIGHT / 2;
      scroll.scrollTop = Math.max(0, c4Center - scroll.clientHeight / 2);
      hasCenteredC4 = true;
    });
  }

  function setPlayhead(beat, follow = false) {
    playheadBeat = clamp(beat, 0, projectLength());
    const left = `${playheadBeat * beatWidth}px`;
    $('#playhead').style.left = left;
    $('#arrangementPlayhead').style.left = left;
    updateTransport();
    if (follow) {
      const scroll = $('#rollScroll');
      const target = playheadBeat * beatWidth;
      if (target > scroll.scrollLeft + scroll.clientWidth - 130) scroll.scrollLeft = Math.max(0, target - scroll.clientWidth * 0.35);
    }
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
    masterGain.gain.value = 0.72;
    masterGain.connect(audioContext.destination);
    return audioContext;
  }

  async function loadSoundfont(instrument) {
    if (!window.Soundfont || !SOUNDFONTS[instrument]) return null;
    if (soundfontPlayers.has(instrument)) return soundfontPlayers.get(instrument);
    if (soundfontLoads.has(instrument)) return soundfontLoads.get(instrument);
    const audio = ensureAudio();
    const promise = window.Soundfont.instrument(audio, SOUNDFONTS[instrument], { soundfont: 'MusyngKite', format: 'mp3', destination: masterGain, gain: 0.92 }).then(player => {
      soundfontPlayers.set(instrument, player); soundfontLoads.delete(instrument); return player;
    }).catch(() => { soundfontLoads.delete(instrument); return null; });
    soundfontLoads.set(instrument, promise);
    return promise;
  }

  function fallbackTone(instrument, pitch, velocity, duration, at) {
    const audio = ensureAudio();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = ['cello', 'strings', 'horn', 'electric_bass'].includes(instrument) ? 'sawtooth' : ['retro_lead', 'drum_kit'].includes(instrument) ? 'square' : ['flute', 'choir', 'warm_pad', 'bell'].includes(instrument) ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(instrument === 'drum_kit' ? 110 : 440 * Math.pow(2, (pitch - 69) / 12), at);
    const level = clamp((velocity || 92) / 127, 0.07, 1) * 0.12;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.08, duration));
    oscillator.connect(gain).connect(masterGain);
    oscillator.start(at);
    oscillator.stop(at + Math.max(0.08, duration) + 0.08);
    cleanupAudio.push(() => { try { oscillator.stop(); oscillator.disconnect(); gain.disconnect(); } catch (_) {} });
  }

  function playSound(instrument, pitch, velocity, duration, at) {
    const player = soundfontPlayers.get(instrument);
    if (player) {
      try {
        const node = player.play(pitch, at, { duration: Math.max(0.08, duration), gain: clamp((velocity || 92) / 127, 0.1, 0.96), attack: 0.008, release: Math.min(0.45, Math.max(0.08, duration * 0.25)) });
        if (node?.stop) cleanupAudio.push(() => { try { node.stop(); } catch (_) {} });
        return;
      } catch (_) {}
    }
    fallbackTone(instrument, pitch, velocity, duration, at);
  }

  function glow(pitch, delay, duration) {
    const begin = setTimeout(() => {
      const key = $(`.key[data-pitch="${pitch}"]`);
      key?.classList.add('playing');
      const end = setTimeout(() => key?.classList.remove('playing'), Math.max(70, duration));
      cleanupAudio.push(() => clearTimeout(end));
    }, Math.max(0, delay));
    cleanupAudio.push(() => clearTimeout(begin));
  }

  function clearScheduledAudio() {
    cleanupAudio.splice(0).forEach(cleanup => cleanup());
    $$('.key.playing').forEach(key => key.classList.remove('playing'));
  }

  function stopPlayback({ reset = false, pause = false } = {}) {
    if (playing && pause) playheadBeat = clamp(playStartedBeat + ((performance.now() - playStartedAt) / 1000) / secondsPerBeat(), 0, projectLength());
    playing = false;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    clearScheduledAudio();
    if (reset) playheadBeat = 0;
    setPlayhead(playheadBeat);
  }

  function animatePlayback() {
    if (!playing) return;
    const beat = playStartedBeat + ((performance.now() - playStartedAt) / 1000) / secondsPerBeat();
    if (beat >= projectLength()) { stopPlayback({ reset: true }); status('Playback reached the end.'); return; }
    setPlayhead(beat, true);
    animationFrame = requestAnimationFrame(animatePlayback);
  }

  async function togglePlay() {
    if (playing) { stopPlayback({ pause: true }); status('Playback paused.'); return; }
    syncMeta();
    const audio = ensureAudio();
    if (!audio) { status('Audio is not available in this browser.'); return; }
    const eligibleTracks = project.tracks.filter(track => !track.muted && (!project.tracks.some(candidate => candidate.solo) || track.solo));
    $('#play').disabled = true;
    status('Loading instrument samples…', 0);
    await Promise.all([...new Set(eligibleTracks.map(track => track.instrument))].map(loadSoundfont));
    $('#play').disabled = false;
    if (playing) return;
    const start = playheadBeat;
    const startsAt = audio.currentTime + 0.06;
    eligibleTracks.forEach(track => track.notes.forEach(note => {
      const noteEnd = note.start + note.duration;
      if (noteEnd <= start) return;
      const actualStart = Math.max(start, note.start);
      const delay = (actualStart - start) * secondsPerBeat();
      const duration = (noteEnd - actualStart) * secondsPerBeat();
      const pitch = clamp(note.pitch + Number($('#transpose').value || 0), LOW_PITCH, HIGH_PITCH);
      playSound(track.instrument, pitch, note.velocity, duration, startsAt + delay);
      glow(pitch, delay * 1000, duration * 1000);
    }));
    playing = true;
    playStartedAt = performance.now() + 60;
    playStartedBeat = start;
    updateTransport();
    animationFrame = requestAnimationFrame(animatePlayback);
    status('Playing.', 0);
  }

  async function playImmediate(pitch, beats = 0.5) {
    const track = activeTrack();
    const audio = ensureAudio();
    if (!audio) return;
    await loadSoundfont(track.instrument);
    const duration = beats * secondsPerBeat();
    playSound(track.instrument, clamp(pitch + Number($('#transpose').value || 0), LOW_PITCH, HIGH_PITCH), 96, duration, audio.currentTime + 0.02);
    glow(pitch, 10, duration * 1000);
  }

  function inScale(pitch, scale) { return scale.notes.includes(((pitch - scale.root) % 12 + 12) % 12); }
  function scaleStep(pitch, steps, scale) { let value = pitch; let left = steps; while (left > 0) { value += 1; if (inScale(value, scale)) left -= 1; } return value; }
  function chordFor(pitch) {
    const scale = SCALE_MAP[project.key] || SCALE_MAP['D minor'];
    let root = pitch;
    while (!inScale(root, scale) && root > LOW_PITCH) root -= 1;
    return [root, scaleStep(root, 2, scale), scaleStep(root, 4, scale)].filter(value => value >= LOW_PITCH && value <= HIGH_PITCH);
  }

  function addAt(event) {
    const rect = $('#roll').getBoundingClientRect();
    const start = snap(clamp((event.clientX - rect.left) / beatWidth, 0, projectLength() - 0.125));
    const pitch = clamp(HIGH_PITCH - Math.floor((event.clientY - rect.top) / ROW_HEIGHT), LOW_PITCH, HIGH_PITCH);
    const notes = ($('#chordToggle').classList.contains('on') ? chordFor(pitch) : [pitch]).map(value => makeNote(start, value));
    activeTrack().notes.push(...notes);
    selectedNoteId = notes[0].id;
    renderRoll();
  }

  function findNote(id) {
    for (const track of project.tracks) {
      const note = track.notes.find(candidate => candidate.id === id);
      if (note) return { track, note };
    }
    return null;
  }

  function newProject() {
    if (!confirm('Start a new blank composition? Unsaved work will be replaced.')) return;
    stopPlayback({ reset: true });
    project = blankProject();
    activeTrackId = project.tracks[0].id;
    selectedNoteId = null;
    hasCenteredC4 = false;
    renderAll({ centerC4: true });
    status('New blank composition ready.');
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
    const ensure = count => { if (index + count > data.length) throw new Error('The MIDI file ends unexpectedly.'); };
    const text = count => { ensure(count); let result = ''; for (let offset = 0; offset < count; offset += 1) result += String.fromCharCode(data[index++]); return result; };
    const u8 = () => { ensure(1); return data[index++]; };
    const u16 = () => (u8() << 8) | u8();
    const u32 = () => ((u8() * 0x1000000) + (u8() << 16) + (u8() << 8) + u8()) >>> 0;
    const vlq = end => { let value = 0; for (let i = 0; i < 4; i += 1) { if (index >= end) throw new Error('A MIDI event is incomplete.'); const byte = u8(); value = (value << 7) | (byte & 0x7f); if (!(byte & 0x80)) return value; } throw new Error('A MIDI event is invalid.'); };
    if (text(4) !== 'MThd') throw new Error('This is not a Standard MIDI file.');
    const headerLength = u32();
    if (headerLength < 6) throw new Error('MIDI header is incomplete.');
    u16();
    const trackCount = u16();
    const division = u16();
    if (division & 0x8000) throw new Error('SMPTE MIDI timing is not supported.');
    index += headerLength - 6;
    const tempos = [];
    const tracks = [];
    const channelPrograms = new Array(16).fill(0);
    for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
      if (text(4) !== 'MTrk') throw new Error('A MIDI track is malformed.');
      const trackLength = u32();
      const end = index + trackLength;
      if (end > data.length) throw new Error('A MIDI track is malformed.');
      let tick = 0;
      let runningStatus = null;
      let trackName = '';
      let trackChannel = 0;
      const active = new Map();
      const notes = [];
      while (index < end) {
        tick += vlq(end);
        let statusByte = data[index];
        if (statusByte < 0x80) { if (runningStatus === null) throw new Error('Invalid MIDI running status.'); statusByte = runningStatus; }
        else { index += 1; if (statusByte < 0xf0) runningStatus = statusByte; }
        if (statusByte === 0xff) {
          const type = u8(); const size = vlq(end); ensure(size); const payload = data.slice(index, index + size); index += size;
          if (type === 0x03) trackName = new TextDecoder().decode(payload);
          if (type === 0x51 && payload.length === 3) tempos.push((payload[0] << 16) | (payload[1] << 8) | payload[2]);
          continue;
        }
        if (statusByte === 0xf0 || statusByte === 0xf7) { const size = vlq(end); ensure(size); index += size; continue; }
        if (statusByte >= 0xf8) continue;
        const command = statusByte & 0xf0;
        const channel = statusByte & 0x0f;
        trackChannel = channel;
        const first = u8();
        const second = command === 0xc0 || command === 0xd0 ? null : u8();
        if (command === 0xc0) { channelPrograms[channel] = first; continue; }
        const key = `${channel}:${first}`;
        if (command === 0x90 && second > 0) { const queue = active.get(key) || []; queue.push({ tick, velocity: second }); active.set(key, queue); }
        else if (command === 0x80 || (command === 0x90 && second === 0)) { const queue = active.get(key) || []; const started = queue.shift(); if (queue.length) active.set(key, queue); else active.delete(key); if (started) notes.push(makeNote(started.tick / division, first, (tick - started.tick) / division, started.velocity)); }
      }
      index = end;
      if (notes.length) tracks.push({ id: uid(), name: trackName || `MIDI track ${tracks.length + 1}`, instrument: gmInstrument(channelPrograms[trackChannel], trackChannel), color: COLORS[tracks.length % COLORS.length], muted: false, solo: false, hidden: false, notes: notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch) });
    }
    if (!tracks.length) throw new Error('No MIDI note events were found.');
    return normaliseProject({ title: fileName.replace(/\.(mid|midi)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported MIDI', bpm: Math.round(60000000 / (tempos[0] || 500000)), key: 'C major', sections: [], tracks });
  }

  async function importFile(file) {
    try {
      stopPlayback({ reset: true });
      project = /\.(mid|midi)$/i.test(file.name) ? parseMidi(await file.arrayBuffer(), file.name) : normaliseProject(JSON.parse(await file.text()));
      activeTrackId = project.tracks[0].id;
      selectedNoteId = null;
      hasCenteredC4 = false;
      renderAll({ centerC4: true });
      status(`Imported ${file.name}.`, 5000);
    } catch (error) {
      alert(`Unable to import this file: ${error.message}`);
      status('Import failed.');
    }
  }

  function analyseOpenProject() {
    const duration = projectLength() * secondsPerBeat();
    const notes = project.tracks.flatMap(track => track.notes);
    const pitches = notes.map(note => note.pitch);
    const clock = seconds => { const whole = Math.max(0, Math.round(seconds)); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`; };
    $('#analysisDetails').innerHTML = `<dl class="analysis-grid"><div><dt>Project</dt><dd>${escapeHtml(project.title)}</dd></div><div><dt>Tempo</dt><dd>${project.bpm} BPM</dd></div><div><dt>Key</dt><dd>${escapeHtml(project.key)}</dd></div><div><dt>Duration</dt><dd>${clock(duration)}</dd></div><div><dt>Tracks</dt><dd>${project.tracks.length}</dd></div><div><dt>Notes</dt><dd>${notes.length}</dd></div><div><dt>Range</dt><dd>${pitches.length ? `${noteName(Math.min(...pitches))}–${noteName(Math.max(...pitches))}` : 'No notes'}</dd></div><div><dt>Sections</dt><dd>${project.sections.length || 'Main track'}</dd></div></dl>`;
    $('#analysisModal').hidden = false;
  }

  $('#createSound').addEventListener('click', newProject);
  $('#save').addEventListener('click', () => saveProject(false));
  $('#import').addEventListener('click', () => $('#file').click());
  $('#export').addEventListener('click', exportProject);
  $('#file').addEventListener('change', event => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ''; });
  $('#analyseButton').addEventListener('click', analyseOpenProject);
  $('#analysisClose').addEventListener('click', () => { $('#analysisModal').hidden = true; });
  $('#analysisModal').addEventListener('click', event => { if (event.target === $('#analysisModal')) $('#analysisModal').hidden = true; });
  $('#quickBass').addEventListener('click', () => status('Bass quick add is not built yet.'));
  $('#quickMotif').addEventListener('click', () => status('Motif quick add is not built yet.'));
  $('#title').addEventListener('change', syncMeta);
  $('#bpm').addEventListener('change', () => { syncMeta(); updateTransport(); });
  $('#key').addEventListener('change', syncMeta);
  $('#zoomSlider').addEventListener('input', event => { beatWidth = BASE_BEAT * clamp(Number(event.target.value) || 100, 70, 150) / 100; localStorage.setItem('ihy-roll-zoom', String(Math.round(beatWidth / BASE_BEAT * 100))); renderTimeline(); renderRoll(); updateTransport(); });
  $('#chordToggle').addEventListener('click', () => { const button = $('#chordToggle'); button.classList.toggle('on'); button.setAttribute('aria-pressed', String(button.classList.contains('on'))); });
  $('#metro').addEventListener('click', () => { metronomeEnabled = !metronomeEnabled; renderControls(); status(metronomeEnabled ? 'Metronome enabled.' : 'Metronome disabled.'); });
  $('#armed').addEventListener('change', event => { activeTrackId = event.target.value; selectedNoteId = null; renderTracks(); renderRoll(); });
  $('#instrument').addEventListener('change', event => { activeTrack().instrument = event.target.value; renderTracks(); status(`${activeTrack().name} now uses ${instrumentName(activeTrack().instrument)}.`); });
  $('#tracks').addEventListener('click', event => { const button = event.target.closest('[data-action]'); if (!button) return; const track = getTrack(button.dataset.track); if (!track) return; if (button.dataset.action === 'arm') { activeTrackId = track.id; selectedNoteId = null; renderTracks(); renderRoll(); return; } if (button.dataset.action === 'mute') track.muted = !track.muted; if (button.dataset.action === 'solo') track.solo = !track.solo; if (button.dataset.action === 'hide') track.hidden = !track.hidden; renderTracks(); renderRoll(); });
  $('#addTrack').addEventListener('click', () => { const track = { id: uid(), name: `Track ${project.tracks.length + 1}`, instrument: 'grand_piano', color: COLORS[project.tracks.length % COLORS.length], muted: false, solo: false, hidden: false, notes: [] }; project.tracks.push(track); activeTrackId = track.id; selectedNoteId = null; renderAll(); });
  $('#addSection').addEventListener('click', () => { const name = prompt('Section name', `Section ${project.sections.length + 1}`); if (!name?.trim()) return; const start = project.sections.length ? project.sections[project.sections.length - 1].end : 0; project.sections.push({ id: uid(), name: name.trim(), start, end: Math.min(projectLength(), start + 8), color: COLORS[project.sections.length % COLORS.length] }); renderTimeline(); });
  $('#arrangement').addEventListener('click', event => { const section = event.target.closest('.arrangement-section'); if (section?.disabled) return; if (section) { const entry = project.sections.find(item => item.id === section.dataset.section); const name = prompt('Section name', entry?.name || 'Section'); if (name?.trim() && entry) { entry.name = name.trim(); renderTimeline(); } return; } const rect = $('#arrangement').getBoundingClientRect(); setPlayhead((event.clientX - rect.left) / beatWidth); });
  $('#clear').addEventListener('click', () => { const track = activeTrack(); if (!track.notes.length) { status(`${track.name} is already clear.`); return; } if (!confirm(`Clear all notes from ${track.name}?`)) return; track.notes = []; selectedNoteId = null; renderRoll(); renderTimeline(); status(`${track.name} cleared.`); });
  $('#rollScroll').addEventListener('scroll', () => { $('#arrangementViewport').scrollLeft = $('#rollScroll').scrollLeft; });
  $('#roll').addEventListener('pointerdown', event => { if (event.button !== 0) return; const node = event.target.closest('.note'); if (!node) { if (event.target === $('#roll')) addAt(event); return; } event.preventDefault(); const ref = findNote(node.dataset.note); if (!ref) return; selectedNoteId = ref.note.id; noteDrag = { ref, mode: event.target.classList.contains('resize-handle') ? 'resize' : 'move', x: event.clientX, y: event.clientY, start: ref.note.start, pitch: ref.note.pitch, duration: ref.note.duration }; renderRoll(); });
  $('#roll').addEventListener('pointermove', event => { if (!noteDrag) return; const dx = (event.clientX - noteDrag.x) / beatWidth; const dy = Math.round((event.clientY - noteDrag.y) / ROW_HEIGHT); if (noteDrag.mode === 'resize') noteDrag.ref.note.duration = clamp(snap(noteDrag.duration + dx), 0.125, projectLength() - noteDrag.ref.note.start); else { noteDrag.ref.note.start = clamp(snap(noteDrag.start + dx), 0, projectLength() - noteDrag.ref.note.duration); noteDrag.ref.note.pitch = clamp(noteDrag.pitch - dy, LOW_PITCH, HIGH_PITCH); } renderRoll(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => $('#roll').addEventListener(type, () => { noteDrag = null; }));
  $('#piano').addEventListener('pointerdown', event => { const key = event.target.closest('.key'); if (key) playImmediate(Number(key.dataset.pitch), heldKeys.has(' ') ? 1.35 : 0.5); });
  $('#record').addEventListener('click', () => { recording = !recording; recordingStartedAt = performance.now(); renderControls(); status(recording ? 'Recording keyboard notes.' : 'Recording stopped.'); });
  $('#play').addEventListener('click', togglePlay);
  $('#stop').addEventListener('click', () => { stopPlayback({ reset: true }); status('Playback stopped.'); });
  document.addEventListener('keydown', event => { if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return; if (event.code === 'Space') { event.preventDefault(); heldKeys.add(' '); return; } const key = event.key.toLowerCase(); if (!KEYBOARD_MAP[key] || heldKeys.has(key)) return; heldKeys.add(key); const beats = heldKeys.has(' ') ? 1.35 : 0.5; playImmediate(KEYBOARD_MAP[key], beats); if (recording) { const start = snap(((performance.now() - recordingStartedAt) / 1000) / secondsPerBeat()); if (start < projectLength()) { const note = makeNote(start, KEYBOARD_MAP[key], beats); activeTrack().notes.push(note); selectedNoteId = note.id; renderRoll(); } } });
  document.addEventListener('keyup', event => { if (event.code === 'Space') heldKeys.delete(' '); else heldKeys.delete(event.key.toLowerCase()); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') $('#analysisModal').hidden = true; });
  window.addEventListener('pagehide', () => stopPlayback({ reset: false }));
  renderAll({ centerC4: true });
})();