(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const APP_VERSION = '0.42';
  const STORAGE_KEY = 'ihy-v042-project';
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
        groupId: inputNote.groupId || null
      })) : [];
      return {
        id: String(input.id || uid('track')),
        name: String(input.name || `Track ${index + 1}`),
        instrument: validInstrument ? input.instrument : 'grand_piano',
        color: input.color || COLORS[index % COLORS.length],
        muted: Boolean(input.muted),
        solo: Boolean(input.solo),
        hidden: Boolean(input.hidden),
        notes
      };
    });

    const sections = Array.isArray(raw.sections) ? raw.sections.map((input, index) => ({
      id: String(input.id || uid('section')),
      name: String(input.name || `Section ${index + 1}`),
      start: Math.max(0, Number(input.start) || index * 16),
      end: Math.max(1, Number(input.end) || (index + 1) * 16),
      color: input.color || COLORS[index % COLORS.length]
    })).filter(section => section.end > section.start) : [];

    return {
      version: APP_VERSION,
      title: String(raw.title || fallback.title),
      bpm: clamp(Number(raw.bpm) || fallback.bpm, 30, 260),
      key: SCALE_MAP[raw.key] ? raw.key : fallback.key,
      sections,
      tracks
    };
  }

  function restoreProject() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) { raw = null; }
    if (raw) return normaliseProject(raw);
    for (const key of LEGACY_KEYS) {
      try {
        raw = JSON.parse(localStorage.getItem(key));
        if (raw) {
          const project = normaliseProject(raw);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
          return project;
        }
      } catch (_) {}
    }
    return freshProject();
  }

  let project = restoreProject();
  let activeTrackId = project.tracks[0].id;
  let zoom = 1;
  let currentTool = 'add';
  let chordMode = false;
  let dragMuted = false;
  let selectedNotes = new Set();
  let clipboardNotes = [];
  let dragState = null;
  let resizeState = null;
  let keyboardHeld = new Set();
  let history = { undo: [], redo: [] };
  let saveTimer = 0;
  let contextMenuTarget = null;
  let activeModal = null;
  let audioContext = null;
  let masterGain = null;
  let soundfontPlayers = new Map();
  let playbackTimer = 0;
  let playbackNodes = [];
  let playStartedAt = 0;
  let isPlaying = false;
  let timelineScrollSync = false;
  let dragStartPositions = null;
  let pendingPaste = null;
  let selectedSectionId = null;
  let sectionDrag = null;

  const els = {
    projectTitle: $('#projectTitle'),
    bpm: $('#bpm'),
    key: $('#projectKey'),
    instrument: $('#instrument'),
    armedTrack: $('#armedTrack'),
    quantise: $('#quantise'),
    transpose: $('#transpose'),
    chordMode: $('#chordMode'),
    dragMute: $('#dragMute'),
    status: $('#status'),
    tracks: $('#tracks'),
    roll: $('#roll'),
    pitchLabels: $('#pitchLabels'),
    timeline: $('#timeline'),
    timelineViewport: $('#timelineViewport'),
    rollScroll: $('#rollScroll'),
    piano: $('#piano'),
    toolAdd: $('#toolAdd'),
    toolSelect: $('#toolSelect'),
    undo: $('#undo'),
    redo: $('#redo'),
    groupSelection: $('#groupSelection'),
    deleteSelection: $('#deleteSelection'),
    addTrack: $('#addTrack'),
    addSection: $('#addSection'),
    createNew: $('#createNew'),
    saveProject: $('#saveProject'),
    clearTrack: $('#clearTrack'),
    importProject: $('#importProject'),
    exportProject: $('#exportProject'),
    analyseProject: $('#analyseProject'),
    quickBass: $('#quickBass'),
    quickMotif: $('#quickMotif'),
    playPause: $('#playPause'),
    stopPlayback: $('#stopPlayback'),
    transportTime: $('#transportTime'),
    zoomRange: $('#zoomRange'),
    zoomValue: $('#zoomValue'),
    fileInput: $('#fileInput'),
    noteMenu: $('#noteMenu'),
    trackMenu: $('#trackMenu'),
    sectionMenu: $('#sectionMenu'),
    renameModal: $('#renameModal'),
    renameInput: $('#renameInput'),
    renameConfirm: $('#renameConfirm'),
    analysisModal: $('#analysisModal'),
    analysisText: $('#analysisText'),
    copyAnalysis: $('#copyAnalysis'),
    exportModal: $('#exportModal'),
    exportFormats: $('#exportFormats'),
    exportDescription: $('#exportDescription'),
    exportStatus: $('#exportStatus'),
    includeMuted: $('#includeMuted'),
    doExport: $('#doExport')
  };

  function saveProject() {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      project.version = APP_VERSION;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    }, 120);
  }

  function toast(message) {
    if (!els.status) return;
    els.status.textContent = message;
    clearTimeout(els.status._timer);
    els.status._timer = window.setTimeout(() => {
      if (els.status.textContent === message) els.status.textContent = '';
    }, 3000);
  }

  function snapshot() {
    history.undo.push(clone(project));
    if (history.undo.length > 100) history.undo.shift();
    history.redo = [];
    persistHistory();
    renderUndoButtons();
  }

  function restoreSnapshot(next) {
    project = normaliseProject(next);
    activeTrackId = project.tracks.some(track => track.id === activeTrackId) ? activeTrackId : project.tracks[0].id;
    selectedNotes.clear();
    selectedSectionId = null;
    saveProject();
    render();
  }

  function undo() {
    const previous = history.undo.pop();
    if (!previous) return;
    history.redo.push(clone(project));
    restoreSnapshot(previous);
    persistHistory();
    renderUndoButtons();
  }

  function redo() {
    const next = history.redo.pop();
    if (!next) return;
    history.undo.push(clone(project));
    restoreSnapshot(next);
    persistHistory();
    renderUndoButtons();
  }

  function persistHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function restoreHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY));
      if (raw && Array.isArray(raw.undo) && Array.isArray(raw.redo)) {
        history = {
          undo: raw.undo.slice(-100),
          redo: raw.redo.slice(-100)
        };
      }
    } catch (_) {}
  }

  function getActiveTrack() {
    return project.tracks.find(track => track.id === activeTrackId) || project.tracks[0];
  }

  function allTrackNotes() {
    return project.tracks.flatMap(track => track.notes.map(item => ({ track, note: item })));
  }

  function totalBeats() {
    const noteEnd = allTrackNotes().reduce((max, item) => Math.max(max, item.note.start + item.note.duration), 0);
    const sectionEnd = project.sections.reduce((max, section) => Math.max(max, section.end), 0);
    return Math.max(MIN_BEATS, Math.ceil(Math.max(BASE_BEAT, noteEnd, sectionEnd) / 4) * 4 + 8);
  }

  function beatWidth() {
    return 40 * zoom;
  }

  function quantiseValue() {
    return Number(els.quantise.value) || 0.25;
  }

  function snap(value) {
    const grid = quantiseValue();
    return Math.max(0, Math.round(value / grid) * grid);
  }

  function pitchFromPointer(event) {
    const rect = els.roll.getBoundingClientRect();
    const y = event.clientY - rect.top + els.rollScroll.scrollTop;
    return clamp(HIGH - Math.floor(y / ROW), LOW, HIGH);
  }

  function beatFromPointer(event) {
    const rect = els.roll.getBoundingClientRect();
    const x = event.clientX - rect.left + els.rollScroll.scrollLeft;
    return snap(x / beatWidth());
  }

  function trackById(trackId) {
    return project.tracks.find(track => track.id === trackId);
  }

  function findNote(trackId, noteId) {
    const track = trackById(trackId);
    if (!track) return null;
    const item = track.notes.find(noteItem => noteItem.id === noteId);
    return item ? { track, note: item } : null;
  }

  function selectedItems() {
    return [...selectedNotes].map(key => {
      const [trackId, noteId] = key.split(':');
      return findNote(trackId, noteId);
    }).filter(Boolean);
  }

  function selectSingle(track, item) {
    selectedNotes.clear();
    selectedNotes.add(noteKey(track, item));
    renderRoll();
  }

  function setTool(tool) {
    currentTool = tool;
    els.toolAdd.classList.toggle('active', tool === 'add');
    els.toolSelect.classList.toggle('active', tool === 'select');
    els.roll.classList.toggle('selecting', tool === 'select');
  }

  function renderUndoButtons() {
    els.undo.disabled = !history.undo.length;
    els.redo.disabled = !history.redo.length;
  }

  function buildInstrumentOptions(select) {
    select.replaceChildren(...INSTRUMENTS.map(([id, name]) => new Option(name, id)));
  }

  function renderControls() {
    els.projectTitle.value = project.title;
    els.bpm.value = project.bpm;
    els.key.value = project.key;
    els.instrument.value = getActiveTrack().instrument;
    els.armedTrack.replaceChildren(...project.tracks.map(track => new Option(track.name, track.id)));
    els.armedTrack.value = activeTrackId;
    els.chordMode.classList.toggle('active', chordMode);
    els.chordMode.setAttribute('aria-pressed', String(chordMode));
    els.dragMute.classList.toggle('active', dragMuted);
    els.dragMute.textContent = dragMuted ? '🔇' : '🔊';
    els.zoomRange.value = String(Math.round(zoom * 100));
    els.zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    renderUndoButtons();
  }

  function renderTracks() {
    els.tracks.replaceChildren();
    project.tracks.forEach(track => {
      const card = document.createElement('article');
      card.className = `track-card${track.id === activeTrackId ? ' active' : ''}`;
      card.dataset.trackId = track.id;
      card.innerHTML = `
        <button class="track-main" type="button">
          <span class="track-color" style="background:${track.color}"></span>
          <span class="track-name">${escapeHtml(track.name)}</span>
          <span class="track-instrument">${escapeHtml(instrumentName(track.instrument))}</span>
        </button>
        <span class="track-actions">
          <button class="track-icon ${track.muted ? 'active' : ''}" data-track-action="mute" type="button" title="Mute">M</button>
          <button class="track-icon ${track.solo ? 'active' : ''}" data-track-action="solo" type="button" title="Solo">S</button>
          <button class="track-icon ${track.hidden ? 'active' : ''}" data-track-action="hide" type="button" title="Hide">◉</button>
          <button class="track-icon" data-track-action="menu" type="button" title="Track options">⋯</button>
        </span>
      `;
      els.tracks.append(card);
    });
  }

  function renderTimeline() {
    const beats = totalBeats();
    els.timeline.style.width = `${beats * beatWidth()}px`;
    els.timeline.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (let beat = 0; beat < beats; beat += 1) {
      const marker = document.createElement('div');
      marker.className = `timeline-marker${beat % 4 === 0 ? ' bar' : ''}`;
      marker.style.left = `${beat * beatWidth()}px`;
      marker.textContent = beat % 4 === 0 ? String(beat / 4 + 1) : '';
      fragment.append(marker);
    }
    project.sections.forEach(section => {
      const item = document.createElement('button');
      item.className = `section-block${section.id === selectedSectionId ? ' selected' : ''}`;
      item.type = 'button';
      item.dataset.sectionId = section.id;
      item.style.left = `${section.start * beatWidth()}px`;
      item.style.width = `${Math.max(1, (section.end - section.start) * beatWidth())}px`;
      item.style.setProperty('--section-color', section.color);
      item.textContent = section.name;
      fragment.append(item);
    });
    els.timeline.append(fragment);
  }

  function renderPitchLabels() {
    els.pitchLabels.replaceChildren();
    for (let pitch = HIGH; pitch >= LOW; pitch -= 1) {
      const label = document.createElement('div');
      label.className = `pitch-label${pitch % 12 === 0 ? ' tonic' : ''}`;
      label.style.height = `${ROW}px`;
      label.textContent = noteName(pitch);
      els.pitchLabels.append(label);
    }
  }

  function renderRoll() {
    const beats = totalBeats();
    const width = beats * beatWidth();
    const height = (HIGH - LOW + 1) * ROW;
    els.roll.style.width = `${width}px`;
    els.roll.style.height = `${height}px`;
    els.roll.style.setProperty('--beat-width', `${beatWidth()}px`);
    els.roll.replaceChildren();
    const grid = document.createDocumentFragment();
    for (let pitch = HIGH; pitch >= LOW; pitch -= 1) {
      const row = document.createElement('div');
      row.className = `pitch-row${pitch % 12 === 0 ? ' tonic' : ''}`;
      row.style.top = `${(HIGH - pitch) * ROW}px`;
      row.style.height = `${ROW}px`;
      grid.append(row);
    }
    for (let beat = 0; beat <= beats; beat += 1) {
      const line = document.createElement('div');
      line.className = `beat-line${beat % 4 === 0 ? ' bar' : ''}`;
      line.style.left = `${beat * beatWidth()}px`;
      grid.append(line);
    }
    project.tracks.filter(track => !track.hidden).forEach(track => {
      track.notes.forEach(item => {
        const button = document.createElement('button');
        button.className = `note-block${selectedNotes.has(noteKey(track, item)) ? ' selected' : ''}`;
        button.type = 'button';
        button.dataset.trackId = track.id;
        button.dataset.noteId = item.id;
        button.style.left = `${item.start * beatWidth()}px`;
        button.style.top = `${(HIGH - item.pitch) * ROW + 2}px`;
        button.style.width = `${Math.max(12, item.duration * beatWidth() - 2)}px`;
        button.style.height = `${ROW - 4}px`;
        button.style.setProperty('--track-color', track.color);
        button.setAttribute('aria-label', `${track.name} ${noteName(item.pitch)}`);
        button.innerHTML = `<span>${noteName(item.pitch)}</span><i class="note-handle" data-resize="end"></i>`;
        grid.append(button);
      });
    });
    if (pendingPaste) {
      pendingPaste.forEach(item => {
        const ghost = document.createElement('div');
        ghost.className = 'note-block ghost';
        ghost.style.left = `${item.start * beatWidth()}px`;
        ghost.style.top = `${(HIGH - item.pitch) * ROW + 2}px`;
        ghost.style.width = `${Math.max(12, item.duration * beatWidth() - 2)}px`;
        ghost.style.height = `${ROW - 4}px`;
        ghost.style.setProperty('--track-color', item.color || '#ffffff');
        grid.append(ghost);
      });
    }
    els.roll.append(grid);
  }

  function renderKeyboard() {
    els.piano.replaceChildren();
    const keys = [];
    for (let pitch = 48; pitch <= 72; pitch += 1) keys.push(pitch);
    keys.forEach(pitch => {
      const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
      const key = document.createElement('button');
      key.type = 'button';
      key.className = `piano-key${isBlack ? ' black' : ' white'}`;
      key.dataset.pitch = String(pitch);
      key.textContent = noteName(pitch);
      els.piano.append(key);
    });
  }

  function render() {
    renderControls();
    renderTracks();
    renderTimeline();
    renderPitchLabels();
    renderRoll();
    renderKeyboard();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
  }

  function updateTitle(value) {
    project.title = value.trim() || 'Untitled cue';
    saveProject();
  }

  function updateBpm(value) {
    project.bpm = clamp(Number(value) || 92, 30, 260);
    saveProject();
    renderControls();
  }

  function updateKey(value) {
    if (!SCALE_MAP[value]) return;
    project.key = value;
    saveProject();
  }

  function updateInstrument(value) {
    const track = getActiveTrack();
    if (!INSTRUMENTS.some(([id]) => id === value)) return;
    track.instrument = value;
    saveProject();
    renderTracks();
  }

  function addTrack() {
    snapshot();
    const index = project.tracks.length;
    const track = {
      id: uid('track'),
      name: `Track ${index + 1}`,
      instrument: 'grand_piano',
      color: COLORS[index % COLORS.length],
      muted: false,
      solo: false,
      hidden: false,
      notes: []
    };
    project.tracks.push(track);
    activeTrackId = track.id;
    saveProject();
    render();
  }

  function addSection() {
    snapshot();
    const start = Math.max(0, Math.ceil((project.sections.reduce((max, section) => Math.max(max, section.end), 0) || 0) / 4) * 4);
    const section = {
      id: uid('section'),
      name: `Section ${project.sections.length + 1}`,
      start,
      end: start + 16,
      color: COLORS[project.sections.length % COLORS.length]
    };
    project.sections.push(section);
    selectedSectionId = section.id;
    saveProject();
    renderTimeline();
  }

  function clearProject() {
    snapshot();
    project = freshProject();
    activeTrackId = project.tracks[0].id;
    selectedNotes.clear();
    selectedSectionId = null;
    saveProject();
    render();
    toast('New blank composition created.');
  }

  function deleteSelected() {
    const items = selectedItems();
    if (!items.length) return;
    snapshot();
    const keys = new Set(items.map(item => noteKey(item.track, item.note)));
    project.tracks.forEach(track => {
      track.notes = track.notes.filter(item => !keys.has(noteKey(track, item)));
    });
    selectedNotes.clear();
    saveProject();
    renderRoll();
  }

  function groupSelection() {
    const items = selectedItems();
    if (!items.length) return;
    snapshot();
    const groupIds = new Set(items.map(item => item.note.groupId).filter(Boolean));
    const shouldUngroup = groupIds.size === 1 && items.every(item => item.note.groupId === [...groupIds][0]);
    if (shouldUngroup) items.forEach(item => { item.note.groupId = null; });
    else {
      const groupId = uid('group');
      items.forEach(item => { item.note.groupId = groupId; });
    }
    saveProject();
    renderRoll();
  }

  function duplicateTrack(track) {
    snapshot();
    const copy = clone(track);
    copy.id = uid('track');
    copy.name = `${track.name} copy`;
    copy.notes = copy.notes.map(item => ({ ...item, id: uid('note') }));
    const index = project.tracks.findIndex(item => item.id === track.id);
    project.tracks.splice(index + 1, 0, copy);
    activeTrackId = copy.id;
    saveProject();
    render();
  }

  function deleteTrack(track) {
    if (project.tracks.length <= 1) {
      toast('A project must keep at least one track.');
      return;
    }
    snapshot();
    project.tracks = project.tracks.filter(item => item.id !== track.id);
    activeTrackId = project.tracks[0].id;
    selectedNotes.clear();
    saveProject();
    render();
  }

  function showContextMenu(menu, x, y) {
    [els.noteMenu, els.trackMenu, els.sectionMenu].forEach(item => { if (item && item !== menu) item.hidden = true; });
    menu.hidden = false;
    const margin = 8;
    const width = menu.offsetWidth || 180;
    const height = menu.offsetHeight || 180;
    menu.style.left = `${clamp(x, margin, window.innerWidth - width - margin)}px`;
    menu.style.top = `${clamp(y, margin, window.innerHeight - height - margin)}px`;
  }

  function hideContextMenus() {
    [els.noteMenu, els.trackMenu, els.sectionMenu].forEach(menu => { if (menu) menu.hidden = true; });
  }

  function copySelected(cut = false) {
    const items = selectedItems();
    if (!items.length) return;
    const first = Math.min(...items.map(item => item.note.start));
    clipboardNotes = items.map(item => ({
      offset: item.note.start - first,
      pitch: item.note.pitch,
      duration: item.note.duration,
      velocity: item.note.velocity,
      groupId: item.note.groupId,
      sourceTrackId: item.track.id
    }));
    if (cut) deleteSelected();
    toast(`${cut ? 'Cut' : 'Copied'} ${clipboardNotes.length} note${clipboardNotes.length === 1 ? '' : 's'}.`);
  }

  function pasteAt(start = null, pitchShift = 0) {
    if (!clipboardNotes.length) return;
    snapshot();
    const track = getActiveTrack();
    const targetStart = start === null ? Math.ceil(totalBeats() / 4) * 4 : start;
    const groupMap = new Map();
    clipboardNotes.forEach(source => {
      const groupId = source.groupId ? (groupMap.get(source.groupId) || uid('group')) : null;
      if (source.groupId) groupMap.set(source.groupId, groupId);
      track.notes.push(note(targetStart + source.offset, clamp(source.pitch + pitchShift, LOW, HIGH), source.duration, source.velocity, groupId));
    });
    saveProject();
    renderRoll();
  }

  function createBackup() {
    const key = `${BACKUP_PREFIX}${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(project));
    return key;
  }

  function listBackups() {
    return Object.keys(localStorage).filter(key => key.startsWith(BACKUP_PREFIX)).sort().reverse();
  }

  function clearOldBackups() {
    const backups = listBackups();
    backups.slice(8).forEach(key => localStorage.removeItem(key));
  }

  function newProject() {
    createBackup();
    clearOldBackups();
    clearProject();
  }

  function serialiseProject() {
    return JSON.stringify(project, null, 2);
  }

  function triggerDownload(filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function safeFilename() {
    return project.title.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'ihy-project';
  }

  function exportJson() {
    triggerDownload(`${safeFilename()}.json`, serialiseProject());
    toast('JSON project exported.');
  }

  function writeUint16(view, offset, value) { view.setUint16(offset, value, false); }
  function writeUint32(view, offset, value) { view.setUint32(offset, value, false); }

  function variableLength(value) {
    let buffer = value & 0x7F;
    const output = [];
    while ((value >>= 7)) {
      buffer <<= 8;
      buffer |= ((value & 0x7F) | 0x80);
    }
    while (true) {
      output.push(buffer & 0xFF);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
    return output;
  }

  function midiBytes() {
    const tempo = Math.round(60000000 / project.bpm);
    const events = [
      { tick: 0, bytes: [0xFF, 0x51, 0x03, (tempo >> 16) & 0xFF, (tempo >> 8) & 0xFF, tempo & 0xFF] }
    ];
    project.tracks.forEach((track, trackIndex) => {
      const channel = trackIndex % 16;
      track.notes.forEach(item => {
        const tick = Math.round(item.start * 480);
        const end = Math.round((item.start + item.duration) * 480);
        events.push({ tick, bytes: [0x90 | channel, item.pitch, item.velocity] });
        events.push({ tick: end, bytes: [0x80 | channel, item.pitch, 0] });
      });
    });
    events.sort((a, b) => a.tick - b.tick || a.bytes[0] - b.bytes[0]);
    const trackData = [];
    let lastTick = 0;
    events.forEach(event => {
      trackData.push(...variableLength(event.tick - lastTick), ...event.bytes);
      lastTick = event.tick;
    });
    trackData.push(0x00, 0xFF, 0x2F, 0x00);
    const buffer = new ArrayBuffer(14 + 8 + trackData.length);
    const view = new DataView(buffer);
    writeUint32(view, 0, 0x4D546864);
    writeUint32(view, 4, 6);
    writeUint16(view, 8, 0);
    writeUint16(view, 10, 1);
    writeUint16(view, 12, 480);
    writeUint32(view, 14, 0x4D54726B);
    writeUint32(view, 18, trackData.length);
    new Uint8Array(buffer, 22).set(trackData);
    return buffer;
  }

  function exportMidi() {
    const bytes = midiBytes();
    triggerDownload(`${safeFilename()}.mid`, bytes, 'audio/midi');
    toast('MIDI file exported.');
  }

  function openExportModal() {
    activeModal = 'exportModal';
    els.exportStatus.textContent = '';
    setExportFormat('json');
    els.exportModal.hidden = false;
  }

  function setExportFormat(format) {
    const descriptions = {
      json: 'Editable Ihy project. Use this to continue working later.',
      midi: 'Standard MIDI file for DAWs and notation software.',
      wav: 'Audio export is not included yet.',
      mp3: 'Audio export is not included yet.'
    };
    els.exportFormats.querySelectorAll('input').forEach(input => {
      const selected = input.value === format;
      input.checked = selected;
      input.closest('.format-choice').classList.toggle('active', selected);
    });
    els.exportDescription.textContent = descriptions[format] || '';
  }

  function doExport() {
    const selected = els.exportFormats.querySelector('input:checked')?.value || 'json';
    if (selected === 'json') exportJson();
    else if (selected === 'midi') exportMidi();
    else {
      els.exportStatus.textContent = `${selected.toUpperCase()} export is not available yet.`;
      return;
    }
    closeModal('exportModal');
  }

  function openAnalysis() {
    const notes = allTrackNotes();
    const noteCount = notes.length;
    const duration = notes.reduce((max, item) => Math.max(max, item.note.start + item.note.duration), 0);
    const tracks = project.tracks.map(track => `${track.name}: ${track.notes.length} notes (${instrumentName(track.instrument)})`);
    const report = [
      `Project: ${project.title}`,
      `Tempo: ${project.bpm} BPM`,
      `Key: ${project.key}`,
      `Tracks: ${project.tracks.length}`,
      `Notes: ${noteCount}`,
      `Length: ${duration.toFixed(2)} beats`,
      '',
      ...tracks
    ].join('\n');
    els.analysisText.value = report;
    activeModal = 'analysisModal';
    els.analysisModal.hidden = false;
  }

  function showRenameModal(mode, target) {
    activeModal = 'renameModal';
    activeModal = { id: 'renameModal', mode, target };
    els.renameInput.value = target.name;
    els.renameModal.hidden = false;
    window.setTimeout(() => els.renameInput.select(), 0);
  }

  function confirmRename() {
    if (!activeModal || activeModal.id !== 'renameModal') return;
    const name = els.renameInput.value.trim();
    if (!name) return;
    snapshot();
    activeModal.target.name = name;
    saveProject();
    closeModal('renameModal');
    render();
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.hidden = true;
    activeModal = null;
  }

  function showQuickModal(title, text) {
    const modal = document.getElementById('quickModal');
    $('#quickTitle').textContent = title;
    $('#quickText').textContent = text;
    activeModal = 'quickModal';
    modal.hidden = false;
  }

  function hideAllModals() {
    document.querySelectorAll('.modal-layer').forEach(layer => { layer.hidden = true; });
    activeModal = null;
  }

  function attachDragStart(button, handler) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      handler(event);
    });
  }

  function audition(pitch, duration = 0.35, instrumentId = null, velocity = 96) {
    if (dragMuted) return;
    const track = instrumentId ? { instrument: instrumentId } : getActiveTrack();
    playNote(track, pitch, duration, velocity);
  }

  async function ensureAudio() {
    if (audioContext) {
      if (audioContext.state === 'suspended') await audioContext.resume();
      return audioContext;
    }
    const Api = window.AudioContext || window.webkitAudioContext;
    if (!Api) return null;
    audioContext = new Api();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(audioContext.destination);
    return audioContext;
  }

  async function getSoundfont(instrumentId) {
    const context = await ensureAudio();
    if (!context || !window.Soundfont) return null;
    if (soundfontPlayers.has(instrumentId)) return soundfontPlayers.get(instrumentId);
    try {
      const player = await window.Soundfont.instrument(context, SOUNDFONTS[instrumentId] || SOUNDFONTS.grand_piano, {
        soundfont: 'MusyngKite',
        format: 'mp3',
        destination: masterGain,
        gain: 0.92
      });
      soundfontPlayers.set(instrumentId, player);
      return player;
    } catch (_) {
      return null;
    }
  }

  async function playNote(track, pitch, duration = 0.5, velocity = 96, at = null) {
    const player = await getSoundfont(track.instrument);
    if (!player || !audioContext) return null;
    const when = at === null ? audioContext.currentTime + 0.01 : at;
    try {
      return player.play(pitch, when, {
        duration: Math.max(0.06, duration),
        gain: clamp(velocity / 127, 0.12, 1),
        attack: 0.005,
        release: 0.12
      });
    } catch (_) {
      return null;
    }
  }

  async function playProject() {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    const context = await ensureAudio();
    if (!context) {
      toast('Audio is not available in this browser.');
      return;
    }
    const tracks = project.tracks.filter(track => !track.muted && (!project.tracks.some(item => item.solo) || item.solo));
    const notes = tracks.flatMap(track => track.notes.map(item => ({ track, note: item }))).sort((a, b) => a.note.start - b.note.start);
    if (!notes.length) {
      toast('Add a note before playing.');
      return;
    }
    const secondsPerBeat = 60 / project.bpm;
    const startAt = context.currentTime + 0.08;
    isPlaying = true;
    playStartedAt = performance.now();
    els.playPause.textContent = '⏸ Pause';
    els.playPause.classList.add('active');
    const endBeat = Math.max(...notes.map(item => item.note.start + item.note.duration));
    notes.forEach(({ track, note: item }) => {
      playNote(track, item.pitch, item.duration * secondsPerBeat, item.velocity, startAt + item.start * secondsPerBeat).then(node => {
        if (node) playbackNodes.push(node);
      });
    });
    updateTransport(endBeat, secondsPerBeat);
    playbackTimer = window.setTimeout(stopPlayback, endBeat * secondsPerBeat * 1000 + 150);
  }

  function updateTransport(endBeat, secondsPerBeat) {
    const loop = () => {
      if (!isPlaying) return;
      const elapsed = (performance.now() - playStartedAt) / 1000;
      const total = endBeat * secondsPerBeat;
      els.transportTime.textContent = `${formatTime(elapsed)} / ${formatTime(total)}`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function stopPlayback() {
    clearTimeout(playbackTimer);
    playbackNodes.splice(0).forEach(node => {
      try { node.stop(); } catch (_) {}
    });
    isPlaying = false;
    els.playPause.textContent = '▶ Play';
    els.playPause.classList.remove('active');
    const end = Math.max(0, ...allTrackNotes().map(item => item.note.start + item.note.duration));
    els.transportTime.textContent = `0:00 / ${formatTime(end * 60 / project.bpm)}`;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.round(seconds));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
  }

  function importProject(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        snapshot();
        project = normaliseProject(raw);
        activeTrackId = project.tracks[0].id;
        selectedNotes.clear();
        saveProject();
        render();
        toast('Project imported.');
      } catch (_) {
        toast('Could not read that project file.');
      }
    };
    reader.readAsText(file);
  }

  function addMotif() {
    snapshot();
    const track = getActiveTrack();
    const scale = SCALE_MAP[project.key].notes;
    const root = SCALE_MAP[project.key].root;
    const start = Math.ceil(totalBeats() / 4) * 4;
    const pattern = [0, 2, 4, 2, 5, 4, 2, 0];
    pattern.forEach((degree, index) => {
      const pitch = 60 + root + scale[degree % scale.length];
      track.notes.push(note(start + index * 0.5, pitch, 0.45, 92));
    });
    saveProject();
    renderRoll();
    toast('Motif added.');
  }

  function onRollPointerDown(event) {
    const target = event.target.closest('.note-block');
    if (target) {
      const found = findNote(target.dataset.trackId, target.dataset.noteId);
      if (!found) return;
      if (currentTool === 'add') {
        snapshot();
        found.track.notes = found.track.notes.filter(item => item.id !== found.note.id);
        selectedNotes.delete(noteKey(found.track, found.note));
        saveProject();
        renderRoll();
        return;
      }
      if (!event.shiftKey && !selectedNotes.has(noteKey(found.track, found.note))) selectSingle(found.track, found.note);
      else if (event.shiftKey) {
        const key = noteKey(found.track, found.note);
        if (selectedNotes.has(key)) selectedNotes.delete(key);
        else selectedNotes.add(key);
        renderRoll();
      }
      const isResize = event.target.closest('.note-handle');
      snapshot();
      const initial = selectedItems().map(item => ({
        key: noteKey(item.track, item.note),
        start: item.note.start,
        pitch: item.note.pitch,
        duration: item.note.duration
      }));
      if (isResize) {
        resizeState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          item: found,
          initialDuration: found.note.duration
        };
      } else {
        dragState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          initial
        };
      }
      els.roll.setPointerCapture?.(event.pointerId);
      return;
    }

    if (currentTool !== 'add') return;
    const track = getActiveTrack();
    snapshot();
    const start = beatFromPointer(event);
    const pitch = pitchFromPointer(event);
    if (chordMode) {
      const root = pitch;
      [0, 4, 7].forEach(interval => track.notes.push(note(start, clamp(root + interval, LOW, HIGH), 1, 92, uid('group'))));
    } else track.notes.push(note(start, pitch, 1, 92));
    saveProject();
    renderRoll();
    audition(pitch, 0.28);
  }

  function onRollPointerMove(event) {
    if (resizeState) {
      const delta = (event.clientX - resizeState.startX) / beatWidth();
      resizeState.item.note.duration = Math.max(quantiseValue(), snap(resizeState.initialDuration + delta));
      saveProject();
      renderRoll();
      return;
    }
    if (!dragState) return;
    const deltaBeat = snap((event.clientX - dragState.startX) / beatWidth());
    const deltaPitch = Math.round(-(event.clientY - dragState.startY) / ROW);
    dragState.initial.forEach(initial => {
      const [trackId, noteId] = initial.key.split(':');
      const found = findNote(trackId, noteId);
      if (!found) return;
      found.note.start = Math.max(0, initial.start + deltaBeat);
      found.note.pitch = clamp(initial.pitch + deltaPitch, LOW, HIGH);
    });
    saveProject();
    renderRoll();
  }

  function onRollPointerUp(event) {
    if (!dragState && !resizeState) return;
    els.roll.releasePointerCapture?.(event.pointerId);
    dragState = null;
    resizeState = null;
  }

  function openTrackMenu(track, x, y) {
    contextMenuTarget = { type: 'track', track };
    showContextMenu(els.trackMenu, x, y);
  }

  function openNoteMenu(track, item, x, y) {
    contextMenuTarget = { type: 'note', track, note: item };
    if (!selectedNotes.has(noteKey(track, item))) selectSingle(track, item);
    showContextMenu(els.noteMenu, x, y);
  }

  function openSectionMenu(section, x, y) {
    contextMenuTarget = { type: 'section', section };
    showContextMenu(els.sectionMenu, x, y);
  }

  function removeSection(section) {
    snapshot();
    project.sections = project.sections.filter(item => item.id !== section.id);
    if (selectedSectionId === section.id) selectedSectionId = null;
    saveProject();
    renderTimeline();
  }

  function duplicateSection(section) {
    snapshot();
    const length = section.end - section.start;
    const copy = { ...section, id: uid('section'), name: `${section.name} copy`, start: section.end, end: section.end + length };
    project.sections.push(copy);
    selectedSectionId = copy.id;
    saveProject();
    renderTimeline();
  }

  function setupEventListeners() {
    els.projectTitle.addEventListener('input', event => updateTitle(event.target.value));
    els.bpm.addEventListener('change', event => updateBpm(event.target.value));
    els.key.addEventListener('change', event => updateKey(event.target.value));
    els.instrument.addEventListener('change', event => updateInstrument(event.target.value));
    els.armedTrack.addEventListener('change', event => {
      activeTrackId = event.target.value;
      render();
    });
    els.quantise.addEventListener('change', () => renderRoll());
    els.transpose.addEventListener('change', event => {
      const amount = clamp(Number(event.target.value) || 0, -24, 24);
      if (!amount) return;
      snapshot();
      selectedItems().forEach(item => { item.note.pitch = clamp(item.note.pitch + amount, LOW, HIGH); });
      event.target.value = '0';
      saveProject();
      renderRoll();
    });
    els.chordMode.addEventListener('click', () => {
      chordMode = !chordMode;
      renderControls();
    });
    els.dragMute.addEventListener('click', () => {
      dragMuted = !dragMuted;
      renderControls();
    });
    els.toolAdd.addEventListener('click', () => setTool('add'));
    els.toolSelect.addEventListener('click', () => setTool('select'));
    els.undo.addEventListener('click', undo);
    els.redo.addEventListener('click', redo);
    els.groupSelection.addEventListener('click', groupSelection);
    els.deleteSelection.addEventListener('click', deleteSelected);
    els.addTrack.addEventListener('click', addTrack);
    els.addSection.addEventListener('click', addSection);
    els.createNew.addEventListener('click', newProject);
    els.saveProject.addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      toast('Project saved.');
    });
    els.clearTrack.addEventListener('click', clearProject);
    els.importProject.addEventListener('click', () => els.fileInput.click());
    els.exportProject.addEventListener('click', openExportModal);
    els.analyseProject.addEventListener('click', openAnalysis);
    els.quickMotif.addEventListener('click', addMotif);
    els.playPause.addEventListener('click', playProject);
    els.stopPlayback.addEventListener('click', stopPlayback);
    els.zoomRange.addEventListener('input', event => {
      zoom = clamp(Number(event.target.value) / 100, 0.7, 1.5);
      renderTimeline();
      renderRoll();
    });
    els.fileInput.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (file) importProject(file);
      event.target.value = '';
    });
    els.roll.addEventListener('pointerdown', onRollPointerDown);
    els.roll.addEventListener('pointermove', onRollPointerMove);
    els.roll.addEventListener('pointerup', onRollPointerUp);
    els.roll.addEventListener('pointercancel', onRollPointerUp);
    els.roll.addEventListener('contextmenu', event => {
      const target = event.target.closest('.note-block');
      if (!target) return;
      const found = findNote(target.dataset.trackId, target.dataset.noteId);
      if (!found) return;
      event.preventDefault();
      openNoteMenu(found.track, found.note, event.clientX, event.clientY);
    });
    els.tracks.addEventListener('click', event => {
      const card = event.target.closest('.track-card');
      if (!card) return;
      const track = trackById(card.dataset.trackId);
      if (!track) return;
      const action = event.target.closest('[data-track-action]')?.dataset.trackAction;
      if (!action) {
        activeTrackId = track.id;
        render();
        return;
      }
      if (action === 'mute') track.muted = !track.muted;
      if (action === 'solo') track.solo = !track.solo;
      if (action === 'hide') track.hidden = !track.hidden;
      if (action === 'menu') openTrackMenu(track, event.clientX, event.clientY);
      saveProject();
      render();
    });
    els.timeline.addEventListener('click', event => {
      const item = event.target.closest('.section-block');
      if (!item) return;
      selectedSectionId = item.dataset.sectionId;
      renderTimeline();
    });
    els.timeline.addEventListener('contextmenu', event => {
      const item = event.target.closest('.section-block');
      if (!item) return;
      const section = project.sections.find(candidate => candidate.id === item.dataset.sectionId);
      if (!section) return;
      event.preventDefault();
      openSectionMenu(section, event.clientX, event.clientY);
    });
    els.noteMenu.addEventListener('click', event => {
      const action = event.target.dataset.noteAction;
      if (!action) return;
      if (action === 'copy') copySelected(false);
      if (action === 'cut') copySelected(true);
      if (action === 'paste') pasteAt();
      if (action === 'duplicate') {
        const items = selectedItems();
        if (items.length) {
          clipboardNotes = items.map(item => ({ offset: item.note.start, pitch: item.note.pitch, duration: item.note.duration, velocity: item.note.velocity, groupId: item.note.groupId }));
          const min = Math.min(...clipboardNotes.map(item => item.offset));
          clipboardNotes.forEach(item => { item.offset -= min; });
          pasteAt(min + 1);
        }
      }
      if (action === 'make-chord') {
        const items = selectedItems();
        if (items.length) {
          snapshot();
          const track = items[0].track;
          const source = items[0].note;
          [4, 7].forEach(interval => track.notes.push(note(source.start, clamp(source.pitch + interval, LOW, HIGH), source.duration, source.velocity, uid('group'))));
          saveProject();
          renderRoll();
        }
      }
      if (action === 'delete') deleteSelected();
      hideContextMenus();
    });
    els.trackMenu.addEventListener('click', event => {
      const action = event.target.dataset.trackAction;
      const target = contextMenuTarget;
      if (!action || !target || target.type !== 'track') return;
      if (action === 'rename') showRenameModal('track', target.track);
      if (action === 'duplicate') duplicateTrack(target.track);
      if (action === 'delete') deleteTrack(target.track);
      hideContextMenus();
    });
    els.sectionMenu.addEventListener('click', event => {
      const action = event.target.dataset.sectionAction;
      const target = contextMenuTarget;
      if (!action || !target || target.type !== 'section') return;
      if (action === 'rename') showRenameModal('section', target.section);
      if (action === 'duplicate') duplicateSection(target.section);
      if (action === 'delete') removeSection(target.section);
      hideContextMenus();
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.context-menu')) hideContextMenus();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        hideContextMenus();
        hideAllModals();
      }
      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
        if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
        if (event.key.toLowerCase() === 'c') { event.preventDefault(); copySelected(false); }
        if (event.key.toLowerCase() === 'x') { event.preventDefault(); copySelected(true); }
        if (event.key.toLowerCase() === 'v') { event.preventDefault(); pasteAt(); }
        return;
      }
      if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); }
      if (event.key === ' ') { event.preventDefault(); playProject(); }
      const mapped = KEYMAP[event.key.toLowerCase()];
      if (mapped && !keyboardHeld.has(event.key.toLowerCase())) {
        keyboardHeld.add(event.key.toLowerCase());
        audition(mapped, event.shiftKey ? 0.9 : 0.35);
      }
    });
    document.addEventListener('keyup', event => {
      keyboardHeld.delete(event.key.toLowerCase());
    });
    document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));
    els.renameConfirm.addEventListener('click', confirmRename);
    els.copyAnalysis.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(els.analysisText.value);
        toast('Analysis copied.');
      } catch (_) {
        toast('Could not copy the report.');
      }
    });
    els.exportFormats.addEventListener('change', event => setExportFormat(event.target.value));
    els.doExport.addEventListener('click', doExport);
  }

  function initialise() {
    buildInstrumentOptions(els.instrument);
    restoreHistory();
    render();
    setupEventListeners();
    setTool('add');
    stopPlayback();
    window.addEventListener('beforeunload', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      persistHistory();
    });
  }

  initialise();
})();

/* Ihy v1.2: formerly clear-all.js — consolidated here. */
(() => {
  'use strict';

  const RELEASE_VERSION = 'v1.2';
  document.title = `Ihy ${RELEASE_VERSION} — Sound & Music Workshop`;
  document.querySelectorAll('.version-pill').forEach((element) => {
    element.textContent = RELEASE_VERSION;
  });

  const PROJECT_KEY = 'ihy-v042-project';
  const HISTORY_KEY = 'ihy-v042-history';
  const TOAST_KEY = 'ihy-v045-toast';
  const ROLL_SIZE_KEY = 'ihy-v045-roll-height';
  const KEYBOARD_SIZE_KEY = 'ihy-v045-keyboard-height';

  const makeBlankProject = () => ({
    version: '0.45',
    title: 'untitled',
    bpm: 92,
    key: 'D minor',
    sections: [],
    tracks: [{
      id: `track-${Date.now().toString(36)}`,
      name: 'Piano',
      instrument: 'grand_piano',
      color: '#b68cff',
      muted: false,
      solo: false,
      hidden: false,
      notes: []
    }]
  });

  const toast = document.getElementById('status');
  let toastTimer = 0;
  const showToast = (text, duration = 3200) => {
    if (!toast || !text) return;
    toast.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      if (toast.textContent === text) toast.textContent = '';
    }, duration);
  };

  const queued = sessionStorage.getItem(TOAST_KEY);
  if (queued) {
    sessionStorage.removeItem(TOAST_KEY);
    requestAnimationFrame(() => showToast(queued));
  }

  if (toast) {
    new MutationObserver(() => {
      const text = toast.textContent.trim();
      if (!text) return;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        if (toast.textContent.trim() === text) toast.textContent = '';
      }, 3200);
    }).observe(toast, { childList: true, characterData: true, subtree: true });
  }

  const clearButton = document.getElementById('clearTrack');
  if (clearButton) {
    const replacement = clearButton.cloneNode(true);
    clearButton.replaceWith(replacement);
    replacement.addEventListener('click', () => {
      localStorage.setItem(PROJECT_KEY, JSON.stringify(makeBlankProject()));
      localStorage.setItem(HISTORY_KEY, JSON.stringify({ undo: [], redo: [] }));
      sessionStorage.setItem(TOAST_KEY, 'Cleared. New blank canvas ready.');
      window.location.reload();
    });
  }

  const exportStatus = document.getElementById('exportStatus');
  if (exportStatus) {
    new MutationObserver(() => {
      const text = exportStatus.textContent.trim();
      if (text) showToast(text);
    }).observe(exportStatus, { childList: true, characterData: true, subtree: true });
  }

  const playButton = document.getElementById('playPause');
  const counter = document.getElementById('transportTime');
  const syncPlaybackGlow = () => {
    const active = Boolean(playButton?.textContent.includes('Pause'));
    playButton?.classList.toggle('is-playing', active);
    counter?.classList.toggle('is-playing', active);
  };
  if (playButton) {
    new MutationObserver(syncPlaybackGlow).observe(playButton, { childList: true, characterData: true, subtree: true });
    playButton.addEventListener('click', () => setTimeout(syncPlaybackGlow, 20));
  }
  document.getElementById('stopPlayback')?.addEventListener('click', () => setTimeout(syncPlaybackGlow, 20));
  syncPlaybackGlow();

  const setupResizer = ({ gripId, targetId, storageKey, min, max, onHeight }) => {
    const grip = document.getElementById(gripId);
    const target = document.getElementById(targetId);
    if (!grip || !target) return;

    const stored = Number(localStorage.getItem(storageKey));
    if (Number.isFinite(stored) && stored >= min && stored <= max) onHeight(stored);

    grip.addEventListener('pointerdown', event => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = target.getBoundingClientRect().height;
      grip.classList.add('resizing');
      document.body.style.userSelect = 'none';
      grip.setPointerCapture?.(event.pointerId);

      const move = moveEvent => {
        const next = Math.max(min, Math.min(max, Math.round(startHeight + moveEvent.clientY - startY)));
        onHeight(next);
      };
      const end = () => {
        grip.classList.remove('resizing');
        document.body.style.userSelect = '';
        localStorage.setItem(storageKey, String(Math.round(target.getBoundingClientRect().height)));
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end, { once: true });
      window.addEventListener('pointercancel', end, { once: true });
    });
  };

  setupResizer({
    gripId: 'rollResizeGrip',
    targetId: 'rollScroll',
    storageKey: ROLL_SIZE_KEY,
    min: 220,
    max: 760,
    onHeight: height => document.documentElement.style.setProperty('--roll-panel-height', `${height}px`)
  });

  setupResizer({
    gripId: 'keyboardResizeGrip',
    targetId: 'keyboardWrap',
    storageKey: KEYBOARD_SIZE_KEY,
    min: 150,
    max: 620,
    onHeight: height => {
      const shell = document.getElementById('keyboardResizeShell');
      if (!shell) return;
      shell.style.setProperty('--keyboard-panel-height', `${height}px`);
      shell.style.setProperty('--keyboard-key-height', `${Math.max(134, height - 16)}px`);
      shell.style.setProperty('--keyboard-black-height', `${Math.max(84, Math.round((height - 16) * .63))}px`);
    }
  });
})();
