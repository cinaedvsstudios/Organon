(() => {
  'use strict';

  const PROJECT_KEY = 'ihy-v042-project';
  const HISTORY_KEY = 'ihy-v042-history';
  const TOAST_KEY = 'ihy-v045-toast';
  const COLORS = ['#f4c75e', '#e7a449', '#d6b35a'];
  const MOTIF_INSTRUMENTS = {
    grand_piano: 'Grand Piano', strings: 'Strings', violin: 'Violin', clarinet: 'Clarinet', oboe: 'Oboe', flute: 'Flute',
    church_organ: 'Church Organ', harpsichord: 'Harpsichord', celesta: 'Celesta'
  };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const Engine = window.IhyMotifEngine;
  const Roll = window.IhyMotifRoll;
  const Preview = window.IhyMotifPreview;
  if (!Engine || !Roll || !Preview) return;

  const state = {
    mode: 'genre',
    genreId: Engine.GENRES[0].id,
    emotionId: 'aspirational',
    sectionType: 'hook',
    instrument: 'grand_piano',
    register: 60,
    tempo: 92,
    phrase: 8,
    mutation: 25,
    bassLink: true,
    harmonySource: 'key',
    loop: false,
    rollZoom: 1,
    notes: [],
    generatedNotes: [],
    rollDirty: false,
    lastCursor: 0,
    referenceStart: 0,
    pendingPlacement: null
  };

  const playback = new Preview({
    onProgress: progress => roll?.setPlayhead(progress),
    onState: data => renderPreviewControls(data)
  });
  let roll = null;

  function readProject() {
    try {
      const project = JSON.parse(localStorage.getItem(PROJECT_KEY));
      if (project && Array.isArray(project.tracks)) return project;
    } catch (_) {}
    return {
      version: '0.45', bpm: 92, key: 'D minor', sections: [],
      tracks: [{ id: uid('track'), name: 'Piano', instrument: 'grand_piano', color: '#b68cff', muted: false, solo: false, hidden: false, notes: [] }]
    };
  }

  function saveProject(project) { localStorage.setItem(PROJECT_KEY, JSON.stringify(project)); }

  function saveHistory(project) {
    let history = { undo: [], redo: [] };
    try {
      const loaded = JSON.parse(localStorage.getItem(HISTORY_KEY));
      if (loaded && Array.isArray(loaded.undo) && Array.isArray(loaded.redo)) history = loaded;
    } catch (_) {}
    history.undo.push(JSON.stringify(project));
    history.undo = history.undo.slice(-100);
    history.redo = [];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function status(text) {
    const target = $('#status');
    if (target) target.textContent = text;
  }

  function projectEnd(project, includeBass = true) {
    const tracks = includeBass ? project.tracks || [] : (project.tracks || []).filter(track => !/bass/i.test(String(track.name || '')));
    return Math.max(0,
      ...(project.sections || []).map(section => Number(section.end) || 0),
      ...tracks.flatMap(track => (track.notes || []).map(note => (Number(note.start) || 0) + (Number(note.duration) || 0)))
    );
  }

  function readTimelineCursor(project) {
    const candidates = [
      project.cursorBeat, project.timelineCursor, project.playheadBeat, project.currentBeat,
      window.Ihy?.cursorBeat, window.IhyEditor?.cursorBeat, window.ihyCursorBeat,
      Number(localStorage.getItem('ihy-v042-cursor-beat')),
      state.lastCursor
    ];
    const value = candidates.find(candidate => Number.isFinite(Number(candidate)) && Number(candidate) >= 0);
    return Math.max(0, Number(value) || 0);
  }

  function rememberTimelineCursor(event) {
    const timeline = event.currentTarget;
    const project = readProject();
    const rect = timeline.getBoundingClientRect();
    const maxBeat = Math.max(32, Math.ceil(projectEnd(project) / 4) * 4 + 16);
    if (!rect.width) return;
    state.lastCursor = clamp(((event.clientX - rect.left) / rect.width) * maxBeat, 0, maxBeat);
  }

  function findInsertionCollision(project, cursor) {
    return (project.tracks || []).some(track => {
      if (/bass/i.test(String(track.name || ''))) return false;
      return (track.notes || []).some(note => {
        const start = Number(note.start) || 0;
        const end = start + (Number(note.duration) || 0);
        return start + 0.0001 < cursor && end - 0.0001 > cursor;
      });
    });
  }

  function nextEmptyBar(project) {
    return Math.ceil(projectEnd(project, false) / 4) * 4;
  }

  function currentProfile() {
    return state.mode === 'emotion'
      ? Engine.EMOTIONS[state.emotionId] || Engine.EMOTIONS.aspirational
      : Engine.GENRES.find(profile => profile.id === state.genreId) || Engine.GENRES[0];
  }

  function selectedProfileId() { return state.mode === 'emotion' ? state.emotionId : state.genreId; }

  function currentGenerationProject(project = readProject()) {
    return { ...project, bpm: state.tempo, motifHarmonySource: state.harmonySource };
  }

  function generate({ randomProfile = false } = {}) {
    const project = readProject();
    if (randomProfile) {
      if (state.mode === 'emotion') {
        const ids = Object.keys(Engine.EMOTIONS);
        state.emotionId = ids[Math.floor(Math.random() * ids.length)];
      } else {
        state.genreId = Engine.GENRES[Math.floor(Math.random() * Engine.GENRES.length)].id;
      }
    }
    state.referenceStart = readTimelineCursor(project);
    const result = Engine.generate({
      project: currentGenerationProject(project),
      mode: state.mode,
      profileId: selectedProfileId(),
      sectionType: state.sectionType,
      register: state.register,
      phrase: state.phrase,
      mutation: state.mutation,
      bassLink: state.bassLink,
      referenceStart: state.referenceStart
    });
    state.notes = result.notes.map(note => ({ ...note }));
    state.generatedNotes = result.notes.map(note => ({ ...note }));
    state.rollDirty = false;
    roll?.setState({ notes: state.notes, phrase: state.phrase, register: state.register, zoom: state.rollZoom, focus: true });
    render();
  }

  function restoreGenerated() {
    state.notes = state.generatedNotes.map(note => ({ ...note, id: uid('motif-roll') }));
    state.rollDirty = false;
    roll?.setState({ notes: state.notes, phrase: state.phrase, register: state.register, zoom: state.rollZoom, focus: false });
    render();
  }

  function parseDuration(text) {
    const fraction = String(text).trim().match(/^1\s*\/\s*(1|2|4|8|16)$/);
    if (fraction) return 4 / Number(fraction[1]);
    const number = Number(text);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function parsePastedNotes() {
    const raw = $('#motifTextInput').value.trim();
    if (!raw) { status('Paste notes first.'); return; }
    const matcher = /(R|[A-Ga-g](?:[#b♯♭])?-?\d+)\s*\(\s*([^)]*)\s*\)/g;
    const pcs = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
    const notes = [];
    let match; let last = 0; let position = 0;
    while ((match = matcher.exec(raw))) {
      const gap = raw.slice(last, match.index).trim();
      if (gap && !/^[,|\s]+$/.test(gap)) { status('Could not read the pasted text.'); return; }
      last = matcher.lastIndex;
      const duration = parseDuration(match[2]);
      if (!duration) { status('Use durations such as 1/4, 1/8, 1/2 or 1/16.'); return; }
      if (match[1].toUpperCase() !== 'R') {
        const parsed = match[1].replace('♭', 'b').replace('♯', '#').match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
        if (!parsed) { status(`Could not read ${match[1]}.`); return; }
        const pc = pcs[`${parsed[1].toUpperCase()}${parsed[2]}`];
        if (pc === undefined) { status(`Could not read ${match[1]}.`); return; }
        notes.push({ id: uid('motif-roll'), start: position, pitch: clamp((Number(parsed[3]) + 1) * 12 + pc, 36, 96), duration, velocity: 96 });
      }
      position += duration;
    }
    if (!notes.length || raw.slice(last).trim()) { status('Use notes like A3(1/4), separated by spaces.'); return; }
    state.phrase = position <= 8 ? 8 : position <= 16 ? 16 : position <= 32 ? 32 : 0;
    if (!state.phrase) { status('Pasted motif phrases can be up to 32 beats.'); return; }
    state.notes = notes;
    state.generatedNotes = notes.map(note => ({ ...note }));
    state.rollDirty = true;
    roll?.setState({ notes: state.notes, phrase: state.phrase, register: state.register, zoom: state.rollZoom, focus: true });
    render();
    status(`Loaded ${notes.length} note${notes.length === 1 ? '' : 's'} into the Motif roll.`);
  }

  function renderHarmonyOptions(project) {
    const select = $('#motifHarmonySource');
    const old = state.harmonySource;
    select.replaceChildren(new Option(`Project key — ${project.key}`, 'key'));
    (project.tracks || []).filter(track => Array.isArray(track.notes) && track.notes.length && !/motif/i.test(String(track.name || ''))).forEach(track => {
      select.append(new Option(`Guide track: ${track.name}`, track.id));
    });
    state.harmonySource = [...select.options].some(option => option.value === old) ? old : 'key';
    select.value = state.harmonySource;
  }

  function renderProfiles() {
    const select = $('#motifProfileSelect');
    const heading = $('#motifProfileHeading');
    const detail = $('#motifProfileDetail');
    if (state.mode === 'emotion') {
      heading.textContent = 'Emotion profile';
      select.replaceChildren(...Object.entries(Engine.EMOTIONS).map(([id, profile]) => new Option(profile.name, id)));
      select.value = state.emotionId;
      detail.hidden = false;
      detail.textContent = 'Emotion profiles shape the melodic mood while Bass Link supplies harmonic support.';
    } else {
      heading.textContent = 'Genre profile';
      select.replaceChildren(...Engine.GENRES.map(profile => new Option(profile.name, profile.id)));
      select.value = state.genreId;
      detail.hidden = true;
    }
  }

  function renderPreviewControls(data = {}) {
    const running = data.active ?? playback.isRunning();
    $('#motifPreview').classList.toggle('is-previewing', Boolean(running));
    $('#motifStop').disabled = !running;
    $('#motifLoop').classList.toggle('selected', state.loop);
    $('#motifLoop').setAttribute('aria-pressed', String(state.loop));
  }

  function render() {
    const project = readProject();
    renderHarmonyOptions(project);
    renderProfiles();
    $('#motifTempo').value = String(state.tempo);
    $('#motifInstrument').value = state.instrument;
    $('#motifRegister').value = String(state.register);
    $('#motifMutation').value = String(state.mutation);
    $('#motifMutationOutput').textContent = `${state.mutation}% mutation`;
    $('#motifPhrase').value = String(state.phrase);
    $('#motifBassLink').classList.toggle('selected', state.bassLink);
    $('#motifBassLink').setAttribute('aria-pressed', String(state.bassLink));
    $$('.motif-mode-tab').forEach(button => button.classList.toggle('selected', button.dataset.mode === state.mode));
    $$('.motif-section-button').forEach(button => button.classList.toggle('selected', button.dataset.section === state.sectionType));
    $('#motifRollZoomValue').textContent = `${Math.round(state.rollZoom * 100)}%`;
    roll?.setState({ notes: state.notes, phrase: state.phrase, register: state.register, zoom: state.rollZoom, focus: false });
    renderPreviewControls();
  }

  function openModal() {
    playback.stop();
    state.tempo = clamp(Number(readProject().bpm) || 92, 30, 260);
    if (!state.notes.length) generate();
    else render();
    $('#motifModal').hidden = false;
  }

  function closeModal() {
    playback.stop();
    $('#motifPlacementModal').hidden = true;
    $('#motifModal').hidden = true;
  }

  function startPreview() {
    if (!state.notes.length) { status('Generate or add a Motif note first.'); return; }
    playback.play({ notes: state.notes, phrase: state.phrase, tempo: state.tempo, instrument: state.instrument, loop: state.loop });
  }

  function restartPreviewIfRunning() {
    if (!playback.isRunning()) return;
    playback.stop();
    window.setTimeout(startPreview, 0);
  }

  function showPlacementDialog(cursor) {
    state.pendingPlacement = cursor;
    $('#motifPlacementText').textContent = 'You are about to import this sequence in the middle of existing music. Move it to the end of the sequence instead?';
    $('#motifPlacementModal').hidden = false;
  }

  function addToTimeline() {
    if (!state.notes.length) { status('Generate or add a Motif note first.'); return; }
    const project = readProject();
    const cursor = readTimelineCursor(project);
    if (findInsertionCollision(project, cursor)) {
      showPlacementDialog(cursor);
      return;
    }
    importAt(cursor);
  }

  function importAt(start) {
    const project = readProject();
    const section = Engine.SECTION_SETTINGS[state.sectionType] || Engine.SECTION_SETTINGS.hook;
    const groupId = uid(`motif-${state.sectionType}`);
    const safeStart = Math.max(0, Number(start) || 0);
    const tempo = clamp(Number($('#motifTempo').value) || state.tempo, 30, 260);
    saveHistory(project);
    project.bpm = tempo;
    state.tempo = tempo;
    if (!Array.isArray(project.sections)) project.sections = [];
    const sectionId = uid('section');
    project.sections.push({ id: sectionId, name: section.name, type: state.sectionType, start: safeStart, end: safeStart + state.phrase, groupId });
    let track = (project.tracks || []).find(item => /motif/i.test(String(item.name || '')));
    if (!track) {
      track = { id: uid('track'), name: 'Motif', instrument: state.instrument, color: COLORS[0], muted: false, solo: false, hidden: false, notes: [] };
      project.tracks.push(track);
    }
    track.instrument = state.instrument;
    track.notes.push(...state.notes.map(note => ({
      id: uid('note'), start: safeStart + note.start, pitch: note.pitch, duration: note.duration, velocity: note.velocity,
      groupId, sectionId, sectionType: state.sectionType
    })));
    saveProject(project);
    $('#motifPlacementModal').hidden = true;
    sessionStorage.setItem(TOAST_KEY, `Added ${section.name} motif at beat ${safeStart} as one grouped sequence.`);
    window.location.reload();
  }

  function adjustZoom(direction) {
    state.rollZoom = clamp(Math.round((state.rollZoom + direction * 0.1) * 10) / 10, 0.7, 1.75);
    render();
  }

  function makeWindowDraggable() {
    const card = $('#motifModalCard');
    const dragTitle = $('#motifModalDragTitle');
    const grip = $('#motifResizeGrip');
    if (!card || !dragTitle || !grip) return;
    const pin = rect => {
      card.classList.add('positioned');
      card.style.position = 'fixed';
      card.style.inset = 'auto';
      card.style.margin = '0';
      card.style.right = 'auto';
      card.style.bottom = 'auto';
      card.style.transform = 'none';
      card.style.left = `${Math.round(rect.left)}px`;
      card.style.top = `${Math.round(rect.top)}px`;
    };
    dragTitle.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      const rect = card.getBoundingClientRect();
      const startX = event.clientX; const startY = event.clientY;
      const offsetX = startX - rect.left; const offsetY = startY - rect.top;
      let dragging = false;
      dragTitle.setPointerCapture?.(event.pointerId);
      const move = moveEvent => {
        const dx = moveEvent.clientX - startX; const dy = moveEvent.clientY - startY;
        if (!dragging) {
          if (Math.hypot(dx, dy) < 6) return;
          dragging = true;
          pin(rect);
          document.body.style.userSelect = 'none';
        }
        moveEvent.preventDefault();
        card.style.left = `${clamp(moveEvent.clientX - offsetX, 0, window.innerWidth - card.offsetWidth)}px`;
        card.style.top = `${clamp(moveEvent.clientY - offsetY, 0, window.innerHeight - card.offsetHeight)}px`;
      };
      const end = () => {
        if (dragging) document.body.style.userSelect = '';
        dragTitle.releasePointerCapture?.(event.pointerId);
        dragTitle.removeEventListener('pointermove', move);
        dragTitle.removeEventListener('pointerup', end);
        dragTitle.removeEventListener('pointercancel', end);
      };
      dragTitle.addEventListener('pointermove', move);
      dragTitle.addEventListener('pointerup', end, { once: true });
      dragTitle.addEventListener('pointercancel', end, { once: true });
    });
    grip.addEventListener('pointerdown', event => {
      event.preventDefault();
      const rect = card.getBoundingClientRect();
      const startX = event.clientX; const startY = event.clientY;
      pin(rect);
      grip.classList.add('resizing');
      const move = moveEvent => {
        card.style.width = `${clamp(rect.width + moveEvent.clientX - startX, 730, window.innerWidth - 20)}px`;
        card.style.height = `${clamp(rect.height + moveEvent.clientY - startY, 540, window.innerHeight - 20)}px`;
      };
      const end = () => {
        grip.classList.remove('resizing');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end, { once: true });
      window.addEventListener('pointercancel', end, { once: true });
    });
  }

  function bind() {
    const canvas = $('#motifRollCanvas');
    roll = new Roll({
      scroll: $('#motifRollScroll'), canvas, ruler: $('#motifRollRuler'), labels: $('#motifRollLabels'), grid: $('#motifRollGrid'),
      onChange: notes => { state.notes = notes; state.rollDirty = true; }
    });

    document.addEventListener('click', event => {
      const trigger = event.target.closest('#quickMotif');
      if (!trigger) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openModal();
    }, true);
    $('#timelineViewport')?.addEventListener('pointerdown', rememberTimelineCursor);
    $('#timeline')?.addEventListener('pointerdown', rememberTimelineCursor);

    $('#motifClose').addEventListener('click', closeModal);
    $('#motifPreview').addEventListener('click', startPreview);
    $('#motifStop').addEventListener('click', () => playback.stop());
    $('#motifLoop').addEventListener('click', () => { state.loop = !state.loop; renderPreviewControls(); });
    $('#motifAdd').addEventListener('click', addToTimeline);
    $('#motifProcess').addEventListener('click', parsePastedNotes);
    $('#motifResetRoll').addEventListener('click', restoreGenerated);
    $('#motifRollZoomOut').addEventListener('click', () => adjustZoom(-1));
    $('#motifRollZoomIn').addEventListener('click', () => adjustZoom(1));
    $('#motifBassLink').addEventListener('click', () => { state.bassLink = !state.bassLink; render(); });
    $('#motifModeTabs').addEventListener('click', event => {
      const button = event.target.closest('.motif-mode-tab');
      if (!button) return;
      state.mode = button.dataset.mode === 'emotion' ? 'emotion' : 'genre';
      generate();
    });
    $('#motifSectionChoices').addEventListener('click', event => {
      const button = event.target.closest('.motif-section-button');
      if (!button) return;
      state.sectionType = button.dataset.section;
      generate();
    });
    $('#motifLoadProfile').addEventListener('click', () => {
      if (state.mode === 'emotion') state.emotionId = $('#motifProfileSelect').value;
      else state.genreId = $('#motifProfileSelect').value;
      generate();
    });
    $('#motifRandomProfile').addEventListener('click', () => generate({ randomProfile: true }));
    $('#motifVariant').addEventListener('click', () => generate());
    $('#motifHarmonySource').addEventListener('change', event => { state.harmonySource = event.target.value; if (!state.rollDirty) generate(); });
    $('#motifMutation').addEventListener('input', event => { state.mutation = Number(event.target.value); $('#motifMutationOutput').textContent = `${state.mutation}% mutation`; });
    $('#motifPhrase').addEventListener('change', event => { state.phrase = Number(event.target.value); generate(); });
    $('#motifRegister').addEventListener('change', event => { state.register = Number(event.target.value); render(); });
    let tempoTimer = 0;
    $('#motifTempo').addEventListener('input', event => {
      const value = Number(event.target.value);
      if (!Number.isFinite(value) || value < 30 || value > 260) return;
      state.tempo = value;
      if (playback.isRunning()) { clearTimeout(tempoTimer); tempoTimer = window.setTimeout(restartPreviewIfRunning, 180); }
    });
    $('#motifTempo').addEventListener('change', event => { state.tempo = clamp(Number(event.target.value) || state.tempo, 30, 260); event.target.value = String(state.tempo); restartPreviewIfRunning(); });
    $('#motifInstrument').addEventListener('change', event => { state.instrument = event.target.value; restartPreviewIfRunning(); });
    $('#motifPlacementEnd').addEventListener('click', () => importAt(nextEmptyBar(readProject())));
    $('#motifPlacementHere').addEventListener('click', () => importAt(state.pendingPlacement ?? readTimelineCursor(readProject())));
    $('#motifPlacementCancel').addEventListener('click', () => { $('#motifPlacementModal').hidden = true; state.pendingPlacement = null; });
    makeWindowDraggable();
  }

  bind();
})();
