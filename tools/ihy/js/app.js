(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const APP_VERSION = '1.0.1';
  const STORAGE_KEY = 'ihy-v042-project'; // preserve existing v0.42–v0.56 projects
  const BACKUP_PREFIX = 'ihy-v042-backup-';
  const HISTORY_KEY = 'ihy-v042-history';
  const WINDOW_KEY = 'ihy-v042-window-positions';
  const LEGACY_KEYS = [
    'ihy-v041-project', 'ihy-v040-project', 'ihy-v039-project', 'ihy-v038-project',
    'ihy-v035-project', 'ihy-v029-project', 'ihy-v028-project',
    'ihy-v027', 'ihy-v026', 'ihy-v025', 'ihy-v024', 'ihy-v023', 'ihy-v022', 'ihy-v021'
  ];

  const LOW = 24;
  const HIGH = 96;
  const ROW = 24;
  const BASE_BEAT = 40;
  const MIN_BEATS = 64;
  const COLORS = ['#b68cff', '#60c6a4', '#dfb658', '#dc7898', '#79b4e3'];
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const KEYMAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72 };

  const INSTRUMENTS = [
    ['grand_piano', 'Grand Piano'],
    ['soft_piano', 'Soft Piano'],
    ['cello', 'Cello'],
    ['strings', 'Strings'],
    ['flute', 'Flute'],
    ['horn', 'French Horn'],
    ['choir', 'Choir'],
    ['warm_pad', 'Warm Pad'],
    ['bell', 'Bell'],
    ['acoustic_guitar', 'Acoustic Guitar'],
    ['electric_bass', 'Electric Bass'],
    ['drum_kit', 'Drum Kit'],
    ['retro_lead', 'Retro Lead'],
    ['pluck', 'Pluck']
  ];

  const SOUNDFONTS = {
    grand_piano: 'acoustic_grand_piano',
    soft_piano: 'acoustic_grand_piano',
    cello: 'cello',
    strings: 'string_ensemble_1',
    flute: 'flute',
    horn: 'french_horn',
    choir: 'choir_aahs',
    warm_pad: 'pad_2_warm',
    bell: 'tubular_bells',
    acoustic_guitar: 'acoustic_guitar_nylon',
    electric_bass: 'electric_bass_finger',
    drum_kit: 'synth_drum',
    retro_lead: 'lead_1_square',
    pluck: 'acoustic_guitar_nylon'
  };

  const SCALE_MAP = {
    'C major': { root: 0, notes: [0, 2, 4, 5, 7, 9, 11] },
    'D minor': { root: 2, notes: [0, 2, 3, 5, 7, 8, 10] },
    'A minor': { root: 9, notes: [0, 2, 3, 5, 7, 8, 10] },
    'F major': { root: 5, notes: [0, 2, 4, 5, 7, 9, 11] },
    'G major': { root: 7, notes: [0, 2, 4, 5, 7, 9, 11] },
    'A♭ major': { root: 8, notes: [0, 2, 4, 5, 7, 9, 11] }
  };

  const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clone = value => JSON.parse(JSON.stringify(value));
  const noteName = pitch => `${NOTE_NAMES[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
  const instrumentName = id => (INSTRUMENTS.find(([instrumentId]) => instrumentId === id) || [id, id])[1];
  const noteKey = (track, note) => `${track.id}:${note.id}`;

  function note(start, pitch, duration = 1, velocity = 92, groupId = null) {
    return { id: uid('note'), start, pitch, duration, velocity, groupId };
  }

  function freshProject() {
    return {
      version: APP_VERSION,
      title: 'Untitled cue',
      bpm: 92,
      key: 'D minor',
      sections: [],
      tracks: [{
        id: uid('track'),
        name: 'Piano',
        instrument: 'grand_piano',
        color: COLORS[0],
        muted: false,
        solo: false,
        hidden: false,
        notes: []
      }]
    };
  }

  function normaliseProject(raw) {
    const fallback = freshProject();
    if (!raw || !Array.isArray(raw.tracks) || !raw.tracks.length) return fallback;

    const tracks = raw.tracks.map((input, index) => {
      const validInstrument = INSTRUMENTS.some(([id]) => id === input.instrument);
      const notes = Array.isArray(input.notes) ? input.notes.map(inputNote => ({
        id: String(inputNote.id || uid('note')),
        start: Math.max(0, Number(inputNote.start) || 0),
        pitch: clamp(Number(inputNote.pitch) || 60, LOW, HIGH),
        duration: Math.max(0.125, Number(inputNote.duration) || 1),
        velocity: clamp(Number(inputNote.velocity) || 92, 1, 127),
        groupId: inputNote.groupId ? String(inputNote.groupId) : null
      })).sort((a, b) => a.start - b.start || a.pitch - b.pitch) : [];

      return {
        id: String(input.id || uid('track')),
        name: String(input.name || `Track ${index + 1}`),
        instrument: validInstrument ? input.instrument : 'grand_piano',
        color: String(input.color || COLORS[index % COLORS.length]),
        muted: Boolean(input.muted),
        solo: Boolean(input.solo),
        hidden: Boolean(input.hidden),
        notes
      };
    });

    const sections = Array.isArray(raw.sections) ? raw.sections.map((input, index) => ({
      id: String(input.id || uid('section')),
      name: String(input.name || `Section ${index + 1}`),
      start: Math.max(0, Number(input.start) || 0),
      end: Math.max(0.125, Number(input.end) || 8),
      color: String(input.color || COLORS[index % COLORS.length])
    })).filter(section => section.end > section.start).sort((a, b) => a.start - b.start) : [];

    return {
      version: APP_VERSION,
      title: String(raw.title || fallback.title),
      bpm: clamp(Number(raw.bpm) || 92, 30, 260),
      key: SCALE_MAP[raw.key] ? raw.key : 'D minor',
      sections,
      tracks
    };
  }

  function readJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function loadProject() {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normaliseProject(readJSON(STORAGE_KEY, null));

    for (const key of LEGACY_KEYS) {
      const saved = localStorage.getItem(key);
      if (!saved) continue;
      const parsed = readJSON(key, null);
      if (!parsed) continue;
      const backupKey = `${BACKUP_PREFIX}${key}`;
      if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, saved);
      const migrated = normaliseProject(parsed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return freshProject();
  }

  let project = loadProject();
  let activeTrackId = project.tracks[0].id;
  let selected = new Set();
  let editMode = 'add';
  let beatWidth = BASE_BEAT * clamp(Number(localStorage.getItem('ihy-v042-zoom') || 100), 70, 150) / 100;
  let playheadBeat = 0;
  let playing = false;
  let playStartedAt = 0;
  let playStartedBeat = 0;
  let animationFrame = 0;
  let pointerDrag = null;
  let selectionBox = null;
  let sectionDrag = null;
  let contextPoint = { start: 0, pitch: 60 };
  let clipboard = null;
  let dragMute = readJSON('ihy-v042-drag-mute', false) === true;
  let trackMenuTrackId = null;
  let sectionMenuSectionId = null;
  let renameTrackId = null;
  let windowDrag = null;
  let history = readJSON(HISTORY_KEY, { undo: [], redo: [] });
  history = {
    undo: Array.isArray(history.undo) ? history.undo : [],
    redo: Array.isArray(history.redo) ? history.redo : []
  };

  let audioContext = null;
  let masterGain = null;
  const soundfontPlayers = new Map();
  const soundfontLoads = new Map();
  const scheduledAudio = [];
  const heldKeys = new Set();

  const getTrack = id => project.tracks.find(track => track.id === id);
  const activeTrack = () => getTrack(activeTrackId) || project.tracks[0];
  const allRefs = () => project.tracks.flatMap(track => track.notes.map(noteValue => ({ track, note: noteValue, key: noteKey(track, noteValue) })));
  const selectedRefs = () => allRefs().filter(ref => selected.has(ref.key));
  const secondsPerBeat = () => 60 / clamp(Number(project.bpm) || 92, 30, 260);
  const snap = value => Math.round(value / Number($('#quantise').value || 0.25)) * Number($('#quantise').value || 0.25);

  function status(text, duration = 3500) {
    const target = $('#status');
    target.textContent = text;
    clearTimeout(status.timer);
    if (text && duration) {
      status.timer = setTimeout(() => {
        if (target.textContent === text) target.textContent = '';
      }, duration);
    }
  }

  function saveProject(quiet = true) {
    syncMeta();
    project.version = APP_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    if (!quiet) status(`Saved “${project.title}”.`);
  }

  function snapshot() {
    history.undo.push(JSON.stringify(project));
    if (history.undo.length > 100) history.undo.shift();
    history.redo = [];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    $('#undo').disabled = !history.undo.length;
    $('#redo').disabled = !history.redo.length;
  }

  function undo() {
    if (!history.undo.length) return;
    history.redo.push(JSON.stringify(project));
    project = normaliseProject(JSON.parse(history.undo.pop()));
    activeTrackId = project.tracks[0].id;
    selected.clear();
    saveProject();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    render();
  }

  function redo() {
    if (!history.redo.length) return;
    history.undo.push(JSON.stringify(project));
    project = normaliseProject(JSON.parse(history.redo.pop()));
    activeTrackId = project.tracks[0].id;
    selected.clear();
    saveProject();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    render();
  }

  function syncMeta() {
    project.title = $('#projectTitle').value.trim() || 'Untitled cue';
    project.bpm = clamp(Number($('#bpm').value) || 92, 30, 260);
    project.key = SCALE_MAP[$('#projectKey').value] ? $('#projectKey').value : 'D minor';
  }

  function projectLength() {
    let length = MIN_BEATS;
    project.sections.forEach(section => { length = Math.max(length, section.end); });
    project.tracks.forEach(track => track.notes.forEach(noteValue => {
      length = Math.max(length, noteValue.start + noteValue.duration);
    }));
    return Math.max(MIN_BEATS, Math.ceil(length / 4) * 4);
  }

  function clock(seconds) {
    const whole = Math.max(0, Math.round(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function renderTop() {
    $('#projectTitle').value = project.title;
    $('#bpm').value = project.bpm;
    $('#projectKey').value = project.key;
    const zoom = Math.round(beatWidth / BASE_BEAT * 100);
    $('#zoomRange').value = String(zoom);
    $('#zoomValue').textContent = `${zoom}%`;
    $('#toolAdd').classList.toggle('active', editMode === 'add');
    $('#toolSelect').classList.toggle('active', editMode === 'select');
    $('#dragMute').classList.toggle('on', dragMute);
    $('#chordMode').classList.toggle('on', $('#chordMode').getAttribute('aria-pressed') === 'true');
    updateHistoryButtons();
  }

  function renderTracks() {
    const host = $('#tracks');
    const armed = $('#armedTrack');
    host.replaceChildren();
    armed.replaceChildren();

    project.tracks.forEach(track => {
      armed.append(new Option(track.name, track.id, track.id === activeTrackId, track.id === activeTrackId));
      const row = document.createElement('div');
      row.className = `track${track.id === activeTrackId ? ' active' : ''}`;
      row.dataset.track = track.id;
      row.innerHTML = `
        <span class="swatch" style="background:${track.color}"></span>
        <button class="button track-name" data-action="arm" data-track="${track.id}" type="button">${escapeHTML(track.name)}</button>
        <span class="track-actions">
          <button class="button${track.muted ? ' on' : ''}" data-action="mute" data-track="${track.id}" type="button" title="Mute">M</button>
          <button class="button${track.solo ? ' solo-active' : ''}" data-action="solo" data-track="${track.id}" type="button" title="Solo">S</button>
          <button class="button${track.hidden ? ' hide-active' : ''}" data-action="hide" data-track="${track.id}" type="button" title="Hide from piano roll">H</button>
        </span>`;
      host.append(row);
    });

    const instrument = $('#instrument');
    instrument.replaceChildren(...INSTRUMENTS.map(([id, name]) => new Option(name, id)));
    instrument.value = activeTrack().instrument;
  }

  function renderTimeline() {
    const host = $('#timeline');
    const total = projectLength();
    host.replaceChildren();
    host.style.width = `${total * beatWidth}px`;
    host.style.backgroundSize = `${beatWidth / 4}px 100%,${beatWidth}px 100%`;

    const playhead = document.createElement('div');
    playhead.id = 'timelinePlayhead';
    playhead.className = 'arrangement-playhead';
    playhead.style.left = `${playheadBeat * beatWidth}px`;
    host.append(playhead);

    const sections = project.sections.length
      ? project.sections
      : [{ id: 'main-track', name: 'Main track', start: 0, end: total, color: '#dfb658', readonly: true }];

    sections.forEach(section => {
      const pill = document.createElement('div');
      pill.className = 'section-pill';
      pill.dataset.section = section.id;
      pill.dataset.readonly = String(Boolean(section.readonly));
      pill.style.left = `${section.start * beatWidth + 4}px`;
      pill.style.width = `${Math.max(44, (section.end - section.start) * beatWidth - 8)}px`;
      pill.style.background = section.color;
      pill.textContent = section.name;
      host.append(pill);

      for (let beat = Math.ceil(section.start / 4) * 4; beat < section.end; beat += 4) {
        const number = document.createElement('span');
        number.className = 'section-number';
        number.style.left = `${beat * beatWidth + 8}px`;
        number.textContent = String(beat / 4 + 1);
        host.append(number);
      }
    });
  }

  function renderRoll() {
    const labels = $('#pitchLabels');
    const roll = $('#roll');
    labels.replaceChildren();
    roll.replaceChildren();
    roll.style.width = `${projectLength() * beatWidth}px`;
    roll.style.backgroundSize = `100% 48px,100% 24px,${beatWidth / 4}px 100%,${beatWidth}px 100%`;

    const playhead = document.createElement('div');
    playhead.id = 'rollPlayhead';
    playhead.className = 'playhead';
    playhead.style.left = `${playheadBeat * beatWidth}px`;
    roll.append(playhead);

    for (let pitch = HIGH; pitch >= LOW; pitch -= 1) {
      const label = document.createElement('div');
      label.className = `pitch-label${pitch % 12 === 0 ? ' c-row' : ''}${pitch === 60 ? ' c4-row' : ''}`;
      label.textContent = noteName(pitch);
      labels.append(label);

      if (pitch % 12 === 0) {
        const guide = document.createElement('div');
        guide.className = `c-guide${pitch === 60 ? ' c4-guide' : ''}`;
        guide.style.top = `${(HIGH - pitch) * ROW}px`;
        roll.append(guide);
      }
    }

    project.tracks.filter(track => !track.hidden).forEach(track => {
      track.notes.forEach(noteValue => {
        const key = noteKey(track, noteValue);
        const node = document.createElement('div');
        node.className = `note${selected.has(key) ? ' selected' : ''}${noteValue.groupId ? ' grouped' : ''}`;
        node.dataset.track = track.id;
        node.dataset.note = noteValue.id;
        node.style.left = `${noteValue.start * beatWidth + 1}px`;
        node.style.top = `${(HIGH - noteValue.pitch) * ROW + 2}px`;
        node.style.width = `${Math.max(10, noteValue.duration * beatWidth - 2)}px`;
        node.style.background = track.color;
        node.title = `${track.name} · ${noteName(noteValue.pitch)} · ${noteValue.duration} beats`;
        node.innerHTML = '<span class="resize-handle"></span>';
        roll.append(node);
      });
    });

    if (selectionBox) drawSelectionBox();
  }

  function renderKeyboard() {
    const piano = $('#piano');
    const selectedPitches = new Set(selectedRefs().map(ref => ref.note.pitch));
    piano.replaceChildren();

    const whites = [];
    for (let pitch = LOW; pitch <= HIGH; pitch += 1) {
      if (![1, 3, 6, 8, 10].includes(pitch % 12)) whites.push(pitch);
    }

    whites.forEach(pitch => {
      const key = document.createElement('button');
      key.className = `key${selectedPitches.has(pitch) ? ' note-selected' : ''}`;
      key.dataset.pitch = pitch;
      const computer = Object.entries(KEYMAP).find(([, value]) => value === pitch)?.[0]?.toUpperCase() || '';
      key.textContent = `${noteName(pitch)}${computer}`;
      piano.append(key);
    });

    for (let pitch = LOW; pitch <= HIGH; pitch += 1) {
      if (![1, 3, 6, 8, 10].includes(pitch % 12)) continue;
      const key = document.createElement('button');
      key.className = `key black${selectedPitches.has(pitch) ? ' note-selected' : ''}`;
      key.dataset.pitch = pitch;
      key.style.left = `${9 + whites.indexOf(pitch - 1) * 44 + 30}px`;
      key.textContent = noteName(pitch);
      piano.append(key);
    }
  }

  function render(options = {}) {
    renderTop();
    renderTracks();
    renderTimeline();
    renderRoll();
    renderKeyboard();
    updateTransport();

    if (options.centerC4) {
      requestAnimationFrame(() => {
        const scroll = $('#rollScroll');
        const c4Centre = (HIGH - 60) * ROW + ROW / 2;
        scroll.scrollTop = Math.max(0, c4Centre - scroll.clientHeight / 2);
      });
    }
  }

  function updateTransport() {
    $('#transportTime').textContent = `${clock(playheadBeat * secondsPerBeat())} / ${clock(projectLength() * secondsPerBeat())}`;
    $('#playPause').textContent = playing ? '⏸ Pause' : '▶ Play';
  }

  function setPlayhead(beat, follow = false) {
    playheadBeat = clamp(beat, 0, projectLength());
    const left = `${playheadBeat * beatWidth}px`;
    const rollHead = $('#rollPlayhead');
    const timelineHead = $('#timelinePlayhead');
    if (rollHead) rollHead.style.left = left;
    if (timelineHead) timelineHead.style.left = left;
    updateTransport();

    if (follow) {
      const scroll = $('#rollScroll');
      const target = playheadBeat * beatWidth;
      if (target > scroll.scrollLeft + scroll.clientWidth - 130) {
        scroll.scrollLeft = Math.max(0, target - scroll.clientWidth * 0.35);
      }
    }
  }

  function ensureAudio() {
    if (audioContext) {
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      return audioContext;
    }
    const AudioAPI = window.AudioContext || window.webkitAudioContext;
    if (!AudioAPI) return null;
    audioContext = new AudioAPI();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.72;
    masterGain.connect(audioContext.destination);
    return audioContext;
  }

  async function loadSoundfont(instrument) {
    if (!window.Soundfont || !SOUNDFONTS[instrument]) return null;
    if (soundfontPlayers.has(instrument)) return soundfontPlayers.get(instrument);
    if (soundfontLoads.has(instrument)) return soundfontLoads.get(instrument);

    const context = ensureAudio();
    if (!context) return null;
    const promise = window.Soundfont.instrument(context, SOUNDFONTS[instrument], {
      soundfont: 'MusyngKite',
      format: 'mp3',
      destination: masterGain,
      gain: 0.92
    }).then(player => {
      soundfontPlayers.set(instrument, player);
      soundfontLoads.delete(instrument);
      return player;
    }).catch(() => {
      soundfontLoads.delete(instrument);
      return null;
    });
    soundfontLoads.set(instrument, promise);
    return promise;
  }

  function clearScheduledAudio() {
    scheduledAudio.splice(0).forEach(cleanup => cleanup());
    $$('.key.playing').forEach(key => key.classList.remove('playing'));
  }

  function playSoundfont(instrument, pitch, velocity, duration, at) {
    const player = soundfontPlayers.get(instrument);
    if (!player) return false;

    try {
      const node = player.play(pitch, at, {
        duration: Math.max(0.08, duration),
        gain: clamp((velocity || 92) / 127, 0.1, 0.96),
        attack: 0.008,
        release: Math.min(0.45, Math.max(0.08, duration * 0.25))
      });
      if (node?.stop) scheduledAudio.push(() => {
        try { node.stop(); } catch (_) {}
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function glowKey(pitch, delay, duration) {
    const start = setTimeout(() => {
      const key = $(`.key[data-pitch="${pitch}"]`);
      key?.classList.add('playing');
      const end = setTimeout(() => key?.classList.remove('playing'), Math.max(70, duration));
      scheduledAudio.push(() => clearTimeout(end));
    }, Math.max(0, delay));
    scheduledAudio.push(() => clearTimeout(start));
  }

  function stopPlayback({ reset = false, pause = false } = {}) {
    if (playing && pause) {
      playheadBeat = clamp(playStartedBeat + ((performance.now() - playStartedAt) / 1000) / secondsPerBeat(), 0, projectLength());
    }
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
    if (beat >= projectLength()) {
      stopPlayback({ reset: true });
      status('Playback reached the end.');
      return;
    }
    setPlayhead(beat, true);
    animationFrame = requestAnimationFrame(animatePlayback);
  }

  async function togglePlay() {
    if (playing) {
      stopPlayback({ pause: true });
      status('Playback paused.');
      return;
    }

    syncMeta();
    const context = ensureAudio();
    if (!context) {
      status('Audio is not available in this browser.');
      return;
    }

    const eligible = project.tracks.filter(track => !track.muted && (!project.tracks.some(candidate => candidate.solo) || track.solo));
    if (!eligible.length) {
      status('No unmuted track is available to play.');
      return;
    }

    $('#playPause').disabled = true;
    status('Loading instrument samples…', 0);
    const loaded = await Promise.all([...new Set(eligible.map(track => track.instrument))].map(loadSoundfont));
    $('#playPause').disabled = false;

    if (loaded.some(player => !player)) {
      status('An instrument sample could not load. Playback was not started.', 5000);
      return;
    }

    const start = playheadBeat;
    const startsAt = context.currentTime + 0.06;

    eligible.forEach(track => track.notes.forEach(noteValue => {
      const end = noteValue.start + noteValue.duration;
      if (end <= start) return;
      const actualStart = Math.max(start, noteValue.start);
      const delay = (actualStart - start) * secondsPerBeat();
      const duration = (end - actualStart) * secondsPerBeat();
      const pitch = clamp(noteValue.pitch + Number($('#transpose').value || 0), LOW, HIGH);
      playSoundfont(track.instrument, pitch, noteValue.velocity, duration, startsAt + delay);
      glowKey(pitch, delay * 1000, duration * 1000);
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
    const context = ensureAudio();
    if (!context) return;
    const player = await loadSoundfont(track.instrument);
    if (!player) {
      status(`${instrumentName(track.instrument)} sample is unavailable.`, 4000);
      return;
    }
    const duration = beats * secondsPerBeat();
    playSoundfont(track.instrument, clamp(pitch + Number($('#transpose').value || 0), LOW, HIGH), 96, duration, context.currentTime + 0.02);
    glowKey(pitch, 10, duration * 1000);
  }

  function inScale(pitch, scale) {
    return scale.notes.includes(((pitch - scale.root) % 12 + 12) % 12);
  }

  function scaleStep(pitch, steps, scale) {
    let value = pitch;
    let remaining = steps;
    while (remaining > 0) {
      value += 1;
      if (inScale(value, scale)) remaining -= 1;
    }
    return value;
  }

  function chordFor(pitch) {
    const scale = SCALE_MAP[project.key] || SCALE_MAP['D minor'];
    let root = pitch;
    while (!inScale(root, scale) && root > LOW) root -= 1;
    return [root, scaleStep(root, 2, scale), scaleStep(root, 4, scale)].filter(value => value >= LOW && value <= HIGH);
  }

  function groupMembers(groupId) {
    return groupId ? allRefs().filter(ref => ref.note.groupId === groupId) : [];
  }

  function relationFor(track, noteValue) {
    return noteValue.groupId
      ? groupMembers(noteValue.groupId)
      : [{ track, note: noteValue, key: noteKey(track, noteValue) }];
  }

  function gridPosition(event) {
    const rect = $('#roll').getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, projectLength() * beatWidth);
    const y = clamp(event.clientY - rect.top, 0, (HIGH - LOW + 1) * ROW);
    return {
      x,
      y,
      start: snap(clamp(x / beatWidth, 0, projectLength() - 0.125)),
      pitch: clamp(HIGH - Math.floor(y / ROW), LOW, HIGH)
    };
  }

  function addNotes(event) {
    const position = gridPosition(event);
    const pitches = $('#chordMode').getAttribute('aria-pressed') === 'true'
      ? chordFor(position.pitch)
      : [position.pitch];

    snapshot();
    const groupId = pitches.length > 1 ? uid('group') : null;
    const created = pitches.map(pitch => note(position.start, pitch, 1, 92, groupId));
    activeTrack().notes.push(...created);
    selected = new Set(created.map(noteValue => noteKey(activeTrack(), noteValue)));
    saveProject();
    render();
  }

  function beginNoteDrag(event, refs, resize = false) {
    pointerDrag = {
      kind: 'notes',
      resize,
      startX: event.clientX,
      startY: event.clientY,
      original: refs.map(ref => ({
        ref,
        start: ref.note.start,
        pitch: ref.note.pitch,
        duration: ref.note.duration
      })),
      changed: false,
      lastAudition: ''
    };
    if (!dragMute) auditionRefs(refs);
  }

  function auditionRefs(refs) {
    if (dragMute || !refs.length) return;
    const unique = new Map();
    refs.forEach(ref => unique.set(`${ref.track.id}:${ref.note.pitch}`, ref));
    const context = ensureAudio();
    if (!context) return;
    const startsAt = context.currentTime + 0.012;

    unique.forEach(ref => {
      loadSoundfont(ref.track.instrument).then(player => {
        if (!player) return;
        playSoundfont(ref.track.instrument, ref.note.pitch, 96, 0.16, startsAt);
      });
      glowKey(ref.note.pitch, 10, 160);
    });
  }

  function moveNoteDrag(event) {
    if (!pointerDrag || pointerDrag.kind !== 'notes') return;
    const dx = snap((event.clientX - pointerDrag.startX) / beatWidth);
    const dy = -Math.round((event.clientY - pointerDrag.startY) / ROW);

    if (pointerDrag.resize) {
      const first = pointerDrag.original[0];
      const next = clamp(snap(first.duration + dx), 0.125, projectLength() - first.start);
      first.ref.note.duration = next;
      pointerDrag.changed = pointerDrag.changed || next !== first.duration;
      renderRoll();
      return;
    }

    const earliest = Math.min(...pointerDrag.original.map(item => item.start));
    const latest = Math.max(...pointerDrag.original.map(item => item.start + item.duration));
    const lowPitch = Math.min(...pointerDrag.original.map(item => item.pitch));
    const highPitch = Math.max(...pointerDrag.original.map(item => item.pitch));
    const startShift = clamp(dx, -earliest, projectLength() - latest);
    const pitchShift = clamp(dy, LOW - lowPitch, HIGH - highPitch);

    pointerDrag.original.forEach(item => {
      item.ref.note.start = clamp(snap(item.start + startShift), 0, projectLength() - item.duration);
      item.ref.note.pitch = clamp(item.pitch + pitchShift, LOW, HIGH);
    });

    pointerDrag.changed = pointerDrag.changed || Boolean(startShift || pitchShift);
    const signature = pointerDrag.original.map(item => item.ref.note.pitch).join(',');
    if (signature !== pointerDrag.lastAudition) {
      pointerDrag.lastAudition = signature;
      auditionRefs(pointerDrag.original.map(item => item.ref));
    }

    renderRoll();
    renderKeyboard();
  }

  function beginSelectionBox(event) {
    const position = gridPosition(event);
    selected.clear();
    selectionBox = { x1: position.x, y1: position.y, x2: position.x, y2: position.y };
    drawSelectionBox();
  }

  function drawSelectionBox() {
    let box = $('#selectionBox');
    if (!selectionBox) {
      box?.remove();
      return;
    }

    if (!box) {
      box = document.createElement('div');
      box.id = 'selectionBox';
      box.className = 'selection-box';
      $('#roll').append(box);
    }

    const left = Math.min(selectionBox.x1, selectionBox.x2);
    const top = Math.min(selectionBox.y1, selectionBox.y2);
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${Math.abs(selectionBox.x2 - selectionBox.x1)}px`;
    box.style.height = `${Math.abs(selectionBox.y2 - selectionBox.y1)}px`;
  }

  function finishSelectionBox(event) {
    if (!selectionBox) return;
    const position = gridPosition(event);
    selectionBox.x2 = position.x;
    selectionBox.y2 = position.y;

    const left = Math.min(selectionBox.x1, selectionBox.x2);
    const right = Math.max(selectionBox.x1, selectionBox.x2);
    const top = Math.min(selectionBox.y1, selectionBox.y2);
    const bottom = Math.max(selectionBox.y1, selectionBox.y2);

    selected.clear();
    allRefs().filter(ref => {
      if (ref.track.hidden) return false;
      const x = ref.note.start * beatWidth + 1;
      const y = (HIGH - ref.note.pitch) * ROW + 2;
      const width = Math.max(10, ref.note.duration * beatWidth - 2);
      return x < right && x + width > left && y < bottom && y + 20 > top;
    }).forEach(ref => relationFor(ref.track, ref.note).forEach(member => selected.add(member.key)));

    selectionBox = null;
    renderRoll();
    renderKeyboard();
  }

  function deleteSelection() {
    const refs = selectedRefs();
    if (!refs.length) {
      status('Select notes to delete.');
      return;
    }

    snapshot();
    const idsByTrack = new Map();
    refs.forEach(ref => {
      if (!idsByTrack.has(ref.track.id)) idsByTrack.set(ref.track.id, new Set());
      idsByTrack.get(ref.track.id).add(ref.note.id);
    });

    project.tracks.forEach(track => {
      const ids = idsByTrack.get(track.id);
      if (ids) track.notes = track.notes.filter(noteValue => !ids.has(noteValue.id));
    });

    selected.clear();
    saveProject();
    render();
  }

  function groupSelection() {
    const refs = selectedRefs();
    if (refs.length < 2) {
      status('Select at least two notes first.');
      return;
    }

    const existing = new Set(refs.map(ref => ref.note.groupId).filter(Boolean));
    if (existing.size === 1) {
      const groupId = [...existing][0];
      const group = groupMembers(groupId);
      if (group.length === refs.length && group.every(ref => selected.has(ref.key))) {
        snapshot();
        group.forEach(ref => { ref.note.groupId = null; });
        saveProject();
        render();
        return;
      }
    }

    snapshot();
    const groupId = uid('group');
    refs.forEach(ref => { ref.note.groupId = groupId; });
    saveProject();
    render();
  }

  function copySelection() {
    const refs = selectedRefs();
    if (!refs.length) {
      status('Select notes to copy.');
      return false;
    }

    const start = Math.min(...refs.map(ref => ref.note.start));
    const pitch = Math.min(...refs.map(ref => ref.note.pitch));
    clipboard = {
      notes: refs.map(ref => ({
        trackId: ref.track.id,
        start: ref.note.start - start,
        pitch: ref.note.pitch - pitch,
        duration: ref.note.duration,
        velocity: ref.note.velocity,
        groupId: ref.note.groupId
      }))
    };
    status(`${refs.length} note${refs.length === 1 ? '' : 's'} copied.`);
    return true;
  }

  function pasteSelection() {
    if (!clipboard?.notes?.length) {
      status('Nothing copied yet.');
      return;
    }

    snapshot();
    const groupMap = new Map();
    const created = [];

    clipboard.notes.forEach(item => {
      const track = getTrack(item.trackId) || activeTrack();
      let groupId = null;
      if (item.groupId) {
        if (!groupMap.has(item.groupId)) groupMap.set(item.groupId, uid('group'));
        groupId = groupMap.get(item.groupId);
      }

      const value = note(
        clamp(snap(contextPoint.start + item.start), 0, projectLength() - item.duration),
        clamp(contextPoint.pitch + item.pitch, LOW, HIGH),
        item.duration,
        item.velocity,
        groupId
      );
      track.notes.push(value);
      created.push({ track, note: value, key: noteKey(track, value) });
    });

    selected = new Set(created.map(ref => ref.key));
    saveProject();
    render();
  }

  function duplicateSelection() {
    const refs = selectedRefs();
    if (!refs.length || !copySelection()) return;
    const start = Math.min(...refs.map(ref => ref.note.start));
    const end = Math.max(...refs.map(ref => ref.note.start + ref.note.duration));
    const pitch = Math.min(...refs.map(ref => ref.note.pitch));
    contextPoint = { start: start + Math.max(0.25, end - start), pitch };
    pasteSelection();
  }

  function makeChord() {
    const refs = selectedRefs();
    if (!refs.length) {
      status('Select a note or group first.');
      return;
    }

    snapshot();
    const roots = [];
    const groups = new Map();

    refs.forEach(ref => {
      if (!ref.note.groupId) {
        roots.push(ref);
      } else if (!groups.has(ref.note.groupId) || ref.note.pitch < groups.get(ref.note.groupId).note.pitch) {
        groups.set(ref.note.groupId, ref);
      }
    });
    roots.push(...groups.values());

    selected.clear();
    roots.forEach(root => {
      const groupId = root.note.groupId || uid('group');
      root.note.groupId = groupId;

      chordFor(root.note.pitch).forEach(pitch => {
        let member = root.track.notes.find(noteValue =>
          noteValue.groupId === groupId &&
          noteValue.start === root.note.start &&
          noteValue.duration === root.note.duration &&
          noteValue.pitch === pitch
        );
        if (!member) {
          member = note(root.note.start, pitch, root.note.duration, root.note.velocity, groupId);
          root.track.notes.push(member);
        }
        selected.add(noteKey(root.track, member));
      });

      groupMembers(groupId).forEach(member => selected.add(member.key));
    });

    saveProject();
    render();
  }

  function showMenu(menu, event) {
    menu.hidden = false;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - 200, event.clientX))}px`;
    menu.style.top = `${Math.max(8, Math.min(window.innerHeight - 280, event.clientY))}px`;
  }

  function hideMenus() {
    $('#noteMenu').hidden = true;
    $('#trackMenu').hidden = true;
    $('#sectionMenu').hidden = true;
  }

  function showNoteMenu(event) {
    event.preventDefault();
    const node = event.target.closest('.note');
    if (node && !node.classList.contains('selected')) {
      const track = getTrack(node.dataset.track);
      const noteValue = track?.notes.find(note => note.id === node.dataset.note);
      if (track && noteValue) {
        selected = new Set(relationFor(track, noteValue).map(ref => ref.key));
      }
    }
    const point = gridPosition(event);
    contextPoint = { start: point.start, pitch: point.pitch };
    renderRoll();
    renderKeyboard();
    showMenu($('#noteMenu'), event);
  }

  function addTrack() {
    snapshot();
    const track = {
      id: uid('track'),
      name: `Track ${project.tracks.length + 1}`,
      instrument: 'grand_piano',
      color: COLORS[project.tracks.length % COLORS.length],
      muted: false,
      solo: false,
      hidden: false,
      notes: []
    };
    project.tracks.push(track);
    activeTrackId = track.id;
    selected.clear();
    saveProject();
    render();
  }

  function showTrackMenu(event, track) {
    event.preventDefault();
    trackMenuTrackId = track.id;
    $('#trackInstrumentToggle').textContent = `${instrumentName(track.instrument)} ›`;
    const choices = $('#trackInstrumentChoices');
    choices.replaceChildren(...INSTRUMENTS.map(([id, name]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.instrument = id;
      button.textContent = `${id === track.instrument ? '✓ ' : ''}${name}`;
      return button;
    }));
    choices.hidden = true;
    showMenu($('#trackMenu'), event);
  }

  function openRenameModal(track) {
    renameTrackId = track.id;
    $('#renameInput').value = track.name;
    openModal('renameModal');
    setTimeout(() => $('#renameInput').focus(), 0);
  }

  function applyRename() {
    const track = getTrack(renameTrackId);
    const name = $('#renameInput').value.trim();
    if (track && name) {
      snapshot();
      track.name = name;
      saveProject();
      render();
    }
    closeModal('renameModal');
  }

  function duplicateTrack(track) {
    snapshot();
    const duplicate = clone(track);
    duplicate.id = uid('track');
    duplicate.name = `${track.name} copy`;
    duplicate.color = COLORS[project.tracks.length % COLORS.length];
    duplicate.notes.forEach(noteValue => { noteValue.id = uid('note'); });
    project.tracks.push(duplicate);
    activeTrackId = duplicate.id;
    selected.clear();
    saveProject();
    render();
  }

  function deleteTrack(track) {
    if (project.tracks.length === 1) {
      status('A composition needs at least one track.');
      return;
    }
    if (!confirm(`Delete track “${track.name}” and all its notes?`)) return;
    snapshot();
    project.tracks = project.tracks.filter(candidate => candidate.id !== track.id);
    activeTrackId = project.tracks[0].id;
    selected.clear();
    saveProject();
    render();
  }

  function addSection() {
    const name = prompt('Section name', `Section ${project.sections.length + 1}`);
    if (!name?.trim()) return;
    snapshot();
    const start = project.sections.length ? Math.max(...project.sections.map(section => section.end)) : 0;
    project.sections.push({
      id: uid('section'),
      name: name.trim(),
      start,
      end: start + 8,
      color: COLORS[project.sections.length % COLORS.length]
    });
    saveProject();
    renderTimeline();
  }

  function showSectionMenu(event, section) {
    event.preventDefault();
    sectionMenuSectionId = section.id;
    showMenu($('#sectionMenu'), event);
  }

  function sectionAction(action) {
    const section = project.sections.find(candidate => candidate.id === sectionMenuSectionId);
    if (!section) return;

    if (action === 'rename') {
      const name = prompt('Section name', section.name);
      if (name?.trim()) {
        snapshot();
        section.name = name.trim();
        saveProject();
        renderTimeline();
      }
    }

    if (action === 'delete' && confirm(`Delete section “${section.name}”?`)) {
      snapshot();
      project.sections = project.sections.filter(candidate => candidate.id !== section.id);
      saveProject();
      renderTimeline();
    }

    if (action === 'duplicate') {
      snapshot();
      const duration = section.end - section.start;
      const start = Math.max(...project.sections.map(candidate => candidate.end));
      project.sections.push({
        ...clone(section),
        id: uid('section'),
        name: `${section.name} copy`,
        start,
        end: start + duration,
        color: COLORS[project.sections.length % COLORS.length]
      });
      saveProject();
      renderTimeline();
    }

    hideMenus();
  }

  function beginSectionDrag(event, node) {
    if (event.button !== 0 || node.dataset.readonly === 'true') return;
    const section = project.sections.find(candidate => candidate.id === node.dataset.section);
    if (!section) return;
    snapshot();
    sectionDrag = {
      sectionId: section.id,
      start: section.start,
      duration: section.end - section.start,
      x: event.clientX,
      moved: false,
      node
    };
    node.classList.add('dragging');
    event.preventDefault();
  }

  function moveSectionDrag(event) {
    if (!sectionDrag) return;
    const section = project.sections.find(candidate => candidate.id === sectionDrag.sectionId);
    if (!section) return;

    let lower = 0;
    let upper = Infinity;
    project.sections.filter(candidate => candidate.id !== section.id).forEach(other => {
      if (other.end <= sectionDrag.start) lower = Math.max(lower, other.end);
      if (other.start >= sectionDrag.start + sectionDrag.duration) upper = Math.min(upper, other.start - sectionDrag.duration);
    });

    const requested = Math.round((sectionDrag.start + (event.clientX - sectionDrag.x) / beatWidth) * 4) / 4;
    const next = clamp(requested, lower, Math.max(lower, upper));
    section.moved = section.start !== next;
    section.start = next;
    section.end = next + sectionDrag.duration;
    sectionDrag.moved ||= section.moved;
    renderTimeline();
  }

  function endSectionDrag() {
    if (!sectionDrag) return;
    sectionDrag.node?.classList.remove('dragging');
    if (sectionDrag.moved) saveProject();
    sectionDrag = null;
  }

  function newProject() {
    if (!confirm('Start a new blank composition? Unsaved work will be replaced.')) return;
    snapshot();
    stopPlayback({ reset: true });
    project = freshProject();
    activeTrackId = project.tracks[0].id;
    selected.clear();
    saveProject();
    render({ centerC4: true });
    status('New blank composition ready.');
  }

  function clearActiveTrack() {
    const track = activeTrack();
    const count = track.notes.length;
    if (!count) {
      status(`${track.name} is already empty.`);
      return;
    }
    snapshot();
    track.notes = [];
    selected.clear();
    saveProject();
    render();
    status(`Cleared ${count} note${count === 1 ? '' : 's'} from ${track.name}.`);
  }

  function buildAnalysis() {
    const notes = project.tracks.flatMap(track => track.notes);
    const lines = [
      'IHY — OPEN PROJECT ANALYSIS',
      '═'.repeat(65),
      `Title:      ${project.title}`,
      `Tempo:      ${project.bpm} BPM`,
      `Key:        ${project.key}`,
      `Timeline:   ${projectLength()} beats  •  ${clock(projectLength() * secondsPerBeat())}`,
      `Tracks:     ${project.tracks.length}`,
      `Notes:      ${notes.length}`,
      '',
      'TRACK NOTES',
      '─'.repeat(65)
    ];

    project.tracks.forEach((track, index) => {
      const notes = [...track.notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
      const range = notes.length
        ? `${noteName(Math.min(...notes.map(noteValue => noteValue.pitch)))}–${noteName(Math.max(...notes.map(noteValue => noteValue.pitch)))}`
        : '—';
      lines.push(`${String(index + 1).padStart(2, '0')}. ${track.name} | ${instrumentName(track.instrument)} | ${notes.length} notes | ${range}`);
      if (!notes.length) lines.push('    No notes.');
      notes.forEach((noteValue, noteIndex) => {
        lines.push(`    ${String(noteIndex + 1).padStart(3, '0')}  beat ${noteValue.start.toFixed(3)}–${(noteValue.start + noteValue.duration).toFixed(3)}  ${noteName(noteValue.pitch).padEnd(4)}  length ${noteValue.duration.toFixed(3)}  velocity ${noteValue.velocity}${noteValue.groupId ? `  group ${noteValue.groupId}` : ''}`);
      });
      lines.push('');
    });
    return lines.join('\n');
  }

  function openQuick(type) {
    $('#quickTitle').textContent = type === 'bass' ? '＋ Bass' : '＋ Motif';
    $('#quickText').textContent = type === 'bass'
      ? 'Bass quick-add is a placeholder. It will generate a bass pattern on the armed bass track using the current key, tempo and section length.'
      : 'Motif quick-add is a placeholder. It will generate a short melodic phrase on the armed track using the current key, tempo and section length.';
    openModal('quickModal');
  }

  function openModal(id) {
    const layer = $(`#${id}`);
    if (!layer) return;
    layer.hidden = false;
    const modal = layer.querySelector('.modal');
    if (!modal) return;
    const positions = readJSON(WINDOW_KEY, {});
    const saved = positions[id];
    if (saved) {
      modal.classList.add('positioned');
      modal.style.left = `${saved.left}px`;
      modal.style.top = `${saved.top}px`;
    }
  }

  function closeModal(id) {
    const layer = $(`#${id}`);
    if (layer) layer.hidden = true;
  }

  function beginModalDrag(event, layer) {
    if (event.target.closest('button,input,select,textarea')) return;
    const modal = layer.querySelector('.modal');
    const rect = modal.getBoundingClientRect();
    windowDrag = { id: layer.id, modal, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    modal.classList.add('positioned');
    event.preventDefault();
  }

  function updateModalDrag(event) {
    if (!windowDrag) return;
    const left = clamp(event.clientX - windowDrag.dx, 8, window.innerWidth - windowDrag.modal.offsetWidth - 8);
    const top = clamp(event.clientY - windowDrag.dy, 8, window.innerHeight - 60);
    windowDrag.modal.style.left = `${left}px`;
    windowDrag.modal.style.top = `${top}px`;

    const positions = readJSON(WINDOW_KEY, {});
    positions[windowDrag.id] = { left, top };
    localStorage.setItem(WINDOW_KEY, JSON.stringify(positions));
  }

  function exportDescription() {
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'json';
    $('#exportDescription').textContent = {
      json: 'Ihy project JSON preserves notes, groups, sections, tracks and settings.',
      midi: 'Standard MIDI exports editable notes, tempo, tracks and program choices.',
      wav: 'WAV mixdown is reserved for the separate audio-render pass.',
      mp3: 'MP3 mixdown is reserved for the separate audio-render pass.'
    }[format];

    $$('.format-choice').forEach(choice => {
      choice.classList.toggle('active', choice.querySelector('input').checked);
    });
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function fileBase() {
    return project.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'ihy-project';
  }

  function vlq(value) {
    let number = Math.max(0, Math.floor(value));
    const bytes = [number & 127];
    while ((number >>= 7) > 0) bytes.unshift((number & 127) | 128);
    return bytes;
  }

  function ascii(value) {
    return [...new TextEncoder().encode(value)];
  }

  function u16(value) {
    return [(value >> 8) & 255, value & 255];
  }

  function u32(value) {
    return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  }

  function midiChunk(name, data) {
    return [...ascii(name), ...u32(data.length), ...data];
  }

  function midiProgram(instrument) {
    return {
      grand_piano: 0,
      soft_piano: 0,
      bell: 14,
      acoustic_guitar: 24,
      electric_bass: 33,
      cello: 42,
      strings: 48,
      choir: 52,
      horn: 60,
      flute: 73,
      retro_lead: 80,
      warm_pad: 89,
      pluck: 24,
      drum_kit: 0
    }[instrument] ?? 0;
  }

  function exportMidi() {
    const ticksPerBeat = 480;
    const microseconds = Math.round(60000000 / project.bpm);
    const tracks = project.tracks.filter(track => $('#includeMuted').checked || !track.muted);

    const tempo = [
      0, 255, 81, 3, (microseconds >>> 16) & 255, (microseconds >>> 8) & 255, microseconds & 255,
      0, 255, 88, 4, 4, 2, 24, 8,
      0, 255, 47, 0
    ];

    const noteTracks = tracks.map((track, index) => {
      const channel = track.instrument === 'drum_kit' ? 9 : (index >= 9 ? index + 1 : index) % 16;
      const events = [];
      const nameBytes = ascii(track.name);
      events.push({ tick: 0, priority: 0, data: [255, 3, ...vlq(nameBytes.length), ...nameBytes] });
      events.push({ tick: 0, priority: 1, data: [192 | channel, midiProgram(track.instrument)] });

      track.notes.forEach(noteValue => {
        const start = Math.round(noteValue.start * ticksPerBeat);
        const end = Math.max(start + 1, Math.round((noteValue.start + noteValue.duration) * ticksPerBeat));
        const pitch = clamp(Math.round(noteValue.pitch), 0, 127);
        const velocity = clamp(Math.round(noteValue.velocity), 1, 127);
        events.push({ tick: start, priority: 2, data: [144 | channel, pitch, velocity] });
        events.push({ tick: end, priority: 1, data: [128 | channel, pitch, 0] });
      });

      events.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
      let previous = 0;
      const data = [];
      events.forEach(event => {
        data.push(...vlq(event.tick - previous), ...event.data);
        previous = event.tick;
      });
      data.push(0, 255, 47, 0);
      return midiChunk('MTrk', data);
    });

    const header = [...ascii('MThd'), 0, 0, 0, 6, 0, 1, ...u16(noteTracks.length + 1), ...u16(ticksPerBeat)];
    download(new Blob([new Uint8Array([...header, ...midiChunk('MTrk', tempo), ...noteTracks.flat()])], { type: 'audio/midi' }), `${fileBase()}.mid`);
  }

  function doExport() {
    syncMeta();
    saveProject();
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'json';

    try {
      if (format === 'json') {
        download(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `${fileBase()}.ihy.json`);
        $('#exportStatus').textContent = 'JSON downloaded.';
      } else if (format === 'midi') {
        exportMidi();
        $('#exportStatus').textContent = 'MIDI downloaded.';
      } else {
        $('#exportStatus').textContent = `${format.toUpperCase()} mixdown is intentionally unavailable until the audio-render pass.`;
      }
    } catch (error) {
      $('#exportStatus').textContent = `Export failed: ${error.message}`;
    }
  }

  function instrumentFromProgram(program, channel) {
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
    let position = 0;
    const ensure = count => {
      if (position + count > data.length) throw new Error('The MIDI file ends unexpectedly.');
    };
    const readByte = () => {
      ensure(1);
      return data[position++];
    };
    const readText = count => {
      ensure(count);
      let value = '';
      for (let index = 0; index < count; index += 1) value += String.fromCharCode(data[position++]);
      return value;
    };
    const readU16 = () => ((readByte() << 8) | readByte()) >>> 0;
    const readU32 = () => ((readByte() * 0x1000000) + (readByte() << 16) + (readByte() << 8) + readByte()) >>> 0;
    const readVLQ = end => {
      let value = 0;
      for (let index = 0; index < 4; index += 1) {
        if (position >= end) throw new Error('A MIDI event is incomplete.');
        const byte = readByte();
        value = (value << 7) | (byte & 127);
        if (!(byte & 128)) return value;
      }
      throw new Error('A MIDI variable-length value is invalid.');
    };

    if (readText(4) !== 'MThd') throw new Error('This is not a Standard MIDI file.');
    const headerLength = readU32();
    if (headerLength < 6) throw new Error('MIDI header is incomplete.');

    readU16();
    const trackCount = readU16();
    const division = readU16();
    if (division & 0x8000) throw new Error('SMPTE-timed MIDI files are not supported.');
    const ticksPerBeat = division || 480;
    position += headerLength - 6;

    let tempo = 500000;
    const appTracks = [];

    for (let sourceTrack = 0; sourceTrack < trackCount; sourceTrack += 1) {
      if (readText(4) !== 'MTrk') throw new Error('A MIDI track is malformed.');
      const trackLength = readU32();
      const end = position + trackLength;
      if (end > data.length) throw new Error('A MIDI track is malformed.');

      let tick = 0;
      let runningStatus = null;
      let sourceName = '';
      const programs = new Array(16).fill(0);
      const activeNotes = new Map();
      const channels = new Map();

      const channelData = channel => {
        if (!channels.has(channel)) channels.set(channel, { channel, program: programs[channel], notes: [] });
        return channels.get(channel);
      };

      const closeNote = (channel, pitch, endingTick) => {
        const key = `${channel}:${pitch}`;
        const queue = activeNotes.get(key);
        if (!queue?.length) return;
        const start = queue.shift();
        if (queue.length) activeNotes.set(key, queue);
        else activeNotes.delete(key);

        channelData(channel).notes.push(note(
          start.tick / ticksPerBeat,
          clamp(pitch, LOW, HIGH),
          Math.max(0.125, (endingTick - start.tick) / ticksPerBeat),
          clamp(start.velocity, 1, 127)
        ));
      };

      while (position < end) {
        tick += readVLQ(end);
        let status = data[position];
        let first;

        if (status < 128) {
          if (runningStatus === null) throw new Error('MIDI running status is invalid.');
          status = runningStatus;
          first = readByte();
        } else {
          status = readByte();
          if (status < 240) runningStatus = status;
        }

        if (status === 255) {
          const type = readByte();
          const size = readVLQ(end);
          ensure(size);
          const payload = data.slice(position, position + size);
          position += size;
          if (type === 3) sourceName = new TextDecoder().decode(payload);
          if (type === 81 && payload.length === 3 && tempo === 500000) {
            tempo = (payload[0] << 16) | (payload[1] << 8) | payload[2];
          }
          continue;
        }

        if (status === 240 || status === 247) {
          const size = readVLQ(end);
          ensure(size);
          position += size;
          continue;
        }

        if (status >= 240) {
          const count = { 241: 1, 242: 2, 243: 1, 246: 0 }[status] ?? 0;
          ensure(count);
          position += count;
          continue;
        }

        const command = status & 240;
        const channel = status & 15;
        if (first === undefined) first = readByte();
        const second = (command === 192 || command === 208) ? 0 : readByte();

        if (command === 192) {
          programs[channel] = first;
          channelData(channel).program = first;
          continue;
        }

        if (command === 144 && second > 0) {
          const key = `${channel}:${first}`;
          const queue = activeNotes.get(key) || [];
          queue.push({ tick, velocity: second });
          activeNotes.set(key, queue);
          channelData(channel);
          continue;
        }

        if (command === 128 || (command === 144 && second === 0)) {
          closeNote(channel, first, tick);
        }
      }

      activeNotes.forEach((queue, key) => {
        const [channel, pitch] = key.split(':').map(Number);
        queue.forEach(start => {
          channelData(channel).notes.push(note(
            start.tick / ticksPerBeat,
            clamp(pitch, LOW, HIGH),
            Math.max(0.125, (tick - start.tick) / ticksPerBeat),
            clamp(start.velocity, 1, 127)
          ));
        });
      });

      channels.forEach((dataValue, channel) => {
        if (!dataValue.notes.length) return;
        const multiChannel = channels.size > 1;
        appTracks.push({
          id: uid('track'),
          name: (sourceName || `MIDI track ${sourceTrack + 1}`) + (multiChannel ? ` — ch ${channel + 1}` : ''),
          instrument: instrumentFromProgram(dataValue.program, channel),
          color: COLORS[appTracks.length % COLORS.length],
          muted: false,
          solo: false,
          hidden: false,
          notes: dataValue.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch)
        });
      });

      position = end;
    }

    if (!appTracks.length) throw new Error('No MIDI note events were found in this file.');
    return normaliseProject({
      title: String(fileName || 'Imported MIDI').replace(/\.(mid|midi)$/i, ''),
      bpm: Math.round(60000000 / tempo),
      key: 'C major',
      sections: [],
      tracks: appTracks
    });
  }

  async function importFile(file) {
    try {
      const buffer = await file.arrayBuffer();
      const header = buffer.byteLength >= 4 ? String.fromCharCode(...new Uint8Array(buffer, 0, 4)) : '';
      const raw = header === 'MThd' || /\.(mid|midi)$/i.test(file.name)
        ? parseMidi(buffer, file.name)
        : JSON.parse(new TextDecoder().decode(buffer));

      snapshot();
      stopPlayback({ reset: true });
      project = normaliseProject(raw);
      activeTrackId = project.tracks[0].id;
      selected.clear();
      saveProject();
      render({ centerC4: true });
      status(`Imported ${file.name}.`, 5000);
    } catch (error) {
      alert(`Unable to import this file: ${error.message}`);
      status('Import failed.');
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[character]));
  }

  function wireEvents() {
    $('#createNew').addEventListener('click', newProject);
    $('#saveProject').addEventListener('click', () => saveProject(false));
    $('#clearTrack').addEventListener('click', clearActiveTrack);
    $('#importProject').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (file) importFile(file);
      event.target.value = '';
    });

    $('#exportProject').addEventListener('click', () => {
      syncMeta();
      saveProject();
      exportDescription();
      openModal('exportModal');
    });
    $('#doExport').addEventListener('click', doExport);

    $('#analyseProject').addEventListener('click', () => {
      syncMeta();
      saveProject();
      $('#analysisText').value = buildAnalysis();
      openModal('analysisModal');
    });

    $('#copyAnalysis').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText($('#analysisText').value);
        status('Analysis report copied.');
      } catch (_) {
        $('#analysisText').select();
        document.execCommand('copy');
        status('Analysis report copied.');
      }
    });

    $('#quickBass').addEventListener('click', () => openQuick('bass'));
    $('#quickMotif').addEventListener('click', () => openQuick('motif'));

    $('#projectTitle').addEventListener('change', () => {
      snapshot();
      syncMeta();
      saveProject();
    });
    $('#bpm').addEventListener('change', () => {
      snapshot();
      syncMeta();
      saveProject();
      updateTransport();
    });
    $('#projectKey').addEventListener('change', () => {
      snapshot();
      syncMeta();
      saveProject();
    });

    $('#chordMode').addEventListener('click', () => {
      const enabled = $('#chordMode').getAttribute('aria-pressed') !== 'true';
      $('#chordMode').setAttribute('aria-pressed', String(enabled));
      $('#chordMode').classList.toggle('on', enabled);
    });

    $('#armedTrack').addEventListener('change', event => {
      activeTrackId = event.target.value;
      selected.clear();
      render();
    });

    $('#quantise').addEventListener('change', () => saveProject());
    $('#transpose').addEventListener('change', () => saveProject());

    $('#zoomRange').addEventListener('input', event => {
      beatWidth = BASE_BEAT * clamp(Number(event.target.value) || 100, 70, 150) / 100;
      localStorage.setItem('ihy-v042-zoom', String(Math.round(beatWidth / BASE_BEAT * 100)));
      renderTimeline();
      renderRoll();
      updateTransport();
    });

    $('#dragMute').addEventListener('click', () => {
      dragMute = !dragMute;
      localStorage.setItem('ihy-v042-drag-mute', JSON.stringify(dragMute));
      renderTop();
    });

    $('#toolAdd').addEventListener('click', () => {
      editMode = 'add';
      renderTop();
    });
    $('#toolSelect').addEventListener('click', () => {
      editMode = 'select';
      renderTop();
    });
    $('#undo').addEventListener('click', undo);
    $('#redo').addEventListener('click', redo);
    $('#groupSelection').addEventListener('click', groupSelection);
    $('#deleteSelection').addEventListener('click', deleteSelection);

    $('#instrument').addEventListener('change', event => {
      snapshot();
      activeTrack().instrument = event.target.value;
      saveProject();
      renderTracks();
      status(`${activeTrack().name} now uses ${instrumentName(activeTrack().instrument)}.`);
    });

    $('#tracks').addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const track = getTrack(button.dataset.track);
      if (!track) return;

      if (button.dataset.action === 'arm') {
        activeTrackId = track.id;
        selected.clear();
        render();
        return;
      }

      snapshot();
      if (button.dataset.action === 'mute') track.muted = !track.muted;
      if (button.dataset.action === 'solo') track.solo = !track.solo;
      if (button.dataset.action === 'hide') track.hidden = !track.hidden;
      saveProject();
      render();
    });

    $('#tracks').addEventListener('contextmenu', event => {
      const row = event.target.closest('.track');
      if (!row) return;
      const track = getTrack(row.dataset.track);
      if (track) showTrackMenu(event, track);
    });

    $('#addTrack').addEventListener('click', addTrack);

    $('#trackMenu').addEventListener('click', event => {
      const instrument = event.target.closest('[data-instrument]')?.dataset.instrument;
      if (instrument) {
        const track = getTrack(trackMenuTrackId);
        if (track) {
          snapshot();
          track.instrument = instrument;
          saveProject();
          render();
        }
        hideMenus();
        return;
      }

      const action = event.target.closest('[data-track-action]')?.dataset.trackAction;
      if (!action) return;
      const track = getTrack(trackMenuTrackId);
      if (!track) return;
      if (action === 'rename') openRenameModal(track);
      if (action === 'duplicate') duplicateTrack(track);
      if (action === 'delete') deleteTrack(track);
      hideMenus();
    });

    $('#trackInstrumentToggle').addEventListener('click', event => {
      event.stopPropagation();
      const choices = $('#trackInstrumentChoices');
      choices.hidden = !choices.hidden;
      const track = getTrack(trackMenuTrackId);
      $('#trackInstrumentToggle').textContent = `${instrumentName(track?.instrument || 'grand_piano')} ${choices.hidden ? '›' : '⌃'}`;
    });

    $('#renameConfirm').addEventListener('click', applyRename);
    $('#addSection').addEventListener('click', addSection);

    $('#timeline').addEventListener('pointerdown', event => {
      const pill = event.target.closest('.section-pill');
      if (pill) {
        beginSectionDrag(event, pill);
        return;
      }
      const rect = $('#timeline').getBoundingClientRect();
      setPlayhead((event.clientX - rect.left) / beatWidth);
    });

    $('#timeline').addEventListener('contextmenu', event => {
      const pill = event.target.closest('.section-pill');
      if (!pill || pill.dataset.readonly === 'true') return;
      const section = project.sections.find(candidate => candidate.id === pill.dataset.section);
      if (section) showSectionMenu(event, section);
    });

    $('#sectionMenu').addEventListener('click', event => {
      const action = event.target.closest('[data-section-action]')?.dataset.sectionAction;
      if (action) sectionAction(action);
    });

    $('#rollScroll').addEventListener('scroll', () => {
      $('#timelineViewport').scrollLeft = $('#rollScroll').scrollLeft;
    });

    $('#roll').addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      hideMenus();
      const node = event.target.closest('.note');

      if (editMode === 'add') {
        if (!node && event.target === $('#roll')) addNotes(event);
        return;
      }

      if (node) {
        const track = getTrack(node.dataset.track);
        const noteValue = track?.notes.find(note => note.id === node.dataset.note);
        if (!track || !noteValue) return;
        const related = relationFor(track, noteValue);
        if (!related.every(ref => selected.has(ref.key))) selected = new Set(related.map(ref => ref.key));
        renderRoll();
        renderKeyboard();
        snapshot();
        beginNoteDrag(event, selectedRefs(), event.target.classList.contains('resize-handle') && related.length === 1);
        return;
      }

      beginSelectionBox(event);
    });

    $('#roll').addEventListener('pointermove', event => {
      if (pointerDrag) {
        moveNoteDrag(event);
      } else if (selectionBox) {
        const point = gridPosition(event);
        selectionBox.x2 = point.x;
        selectionBox.y2 = point.y;
        drawSelectionBox();
      }
    });

    $('#roll').addEventListener('pointerup', event => {
      if (pointerDrag) {
        if (pointerDrag.changed) saveProject();
        pointerDrag = null;
      }
      if (selectionBox) finishSelectionBox(event);
    });

    $('#roll').addEventListener('pointercancel', () => {
      pointerDrag = null;
      selectionBox = null;
      renderRoll();
    });

    $('#roll').addEventListener('contextmenu', showNoteMenu);

    $('#noteMenu').addEventListener('click', event => {
      const action = event.target.closest('[data-note-action]')?.dataset.noteAction;
      if (!action) return;
      if (action === 'copy') copySelection();
      if (action === 'cut' && copySelection()) deleteSelection();
      if (action === 'paste') pasteSelection();
      if (action === 'duplicate') duplicateSelection();
      if (action === 'make-chord') makeChord();
      if (action === 'delete') deleteSelection();
      hideMenus();
    });

    $('#piano').addEventListener('pointerdown', event => {
      const key = event.target.closest('.key');
      if (key) playImmediate(Number(key.dataset.pitch), heldKeys.has(' ') ? 1.35 : 0.5);
    });

    $('#playPause').addEventListener('click', togglePlay);
    $('#stopPlayback').addEventListener('click', () => {
      stopPlayback({ reset: true });
      status('Playback stopped.');
    });

    $$('input[name="exportFormat"]').forEach(input => input.addEventListener('change', exportDescription));
    $$('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));

    $$('.modal-layer').forEach(layer => {
      if (layer.id === 'bassModal' || layer.dataset.modalOwner === 'bass-generator') return;
      const handle = layer.querySelector('.modal-header');
      if (handle) handle.addEventListener('pointerdown', event => beginModalDrag(event, layer));
    });

    document.addEventListener('pointermove', event => {
      moveSectionDrag(event);
      updateModalDrag(event);
    });

    document.addEventListener('pointerup', () => {
      endSectionDrag();
      windowDrag = null;
    });

    document.addEventListener('pointerdown', event => {
      if (!event.target.closest('.context-menu') &&
          !event.target.closest('.note') &&
          !event.target.closest('.track') &&
          !event.target.closest('.section-pill')) {
        hideMenus();
      }
    });

    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copySelection();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        if (copySelection()) deleteSelection();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteSelection();
        return;
      }

      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        heldKeys.add(' ');
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (editMode === 'select') {
          event.preventDefault();
          deleteSelection();
        }
        return;
      }
      if (event.key === 'Escape') {
        hideMenus();
        $$('.modal-layer').forEach(layer => { layer.hidden = true; });
        return;
      }

      const key = event.key.toLowerCase();
      if (!KEYMAP[key] || heldKeys.has(key)) return;
      heldKeys.add(key);
      playImmediate(KEYMAP[key], heldKeys.has(' ') ? 1.35 : 0.5);
    });

    document.addEventListener('keyup', event => {
      if (event.code === 'Space') heldKeys.delete(' ');
      else heldKeys.delete(event.key.toLowerCase());
    });

    window.addEventListener('pagehide', () => stopPlayback({ reset: false }));
  }

  function initialise() {
    wireEvents();
    exportDescription();
    render({ centerC4: true });
  }

  initialise();
})();