(() => {
  'use strict';

  const PROJECT_KEY = 'ihy-v042-project';
  const HISTORY_KEY = 'ihy-v042-history';
  const TOAST_KEY = 'ihy-v045-toast';
  const NOTE_PCS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const COLORS = ['#60c6a4', '#b68cff', '#dfb658', '#dc7898', '#79b4e3'];
  const INSTRUMENTS = [
    ['electric_bass', 'Electric Bass'],
    ['acoustic_guitar', 'Acoustic Bass / Guitar'],
    ['cello', 'Cello Bass'],
    ['warm_pad', 'Warm Bass Pad'],
    ['retro_lead', 'Retro Bass'],
    ['grand_piano', 'Piano Bass']
  ];
  const SOUNDFONTS = {
    electric_bass: 'electric_bass_finger',
    acoustic_guitar: 'acoustic_guitar_nylon',
    cello: 'cello',
    warm_pad: 'pad_2_warm',
    retro_lead: 'lead_1_square',
    grand_piano: 'acoustic_grand_piano'
  };
  const VELOCITIES = { 1: 68, 2: 92, 3: 114 };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clone = value => JSON.parse(JSON.stringify(value));
  const projectEnd = project => Math.max(0, ...project.sections.map(section => Number(section.end) || 0), ...project.tracks.flatMap(track => track.notes.map(note => (Number(note.start) || 0) + (Number(note.duration) || 0))));
  const beatsPerSecond = project => 60 / clamp(Number(project.bpm) || 92, 30, 260);

  let state = {
    phraseBeats: 8,
    units: 1,
    pattern: 'driving',
    source: 'key',
    instrument: 'electric_bass',
    register: 36,
    steps: []
  };

  let preview = {
    context: null,
    gain: null,
    player: null,
    instrument: null,
    nodes: [],
    timer: 0,
    running: false
  };

  function readProject() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROJECT_KEY));
      if (parsed && Array.isArray(parsed.tracks)) return parsed;
    } catch (_) {}
    return {
      title: 'untitled', bpm: 92, key: 'D minor', sections: [],
      tracks: [{ id: uid('track'), name: 'Piano', instrument: 'grand_piano', color: COLORS[1], muted: false, solo: false, hidden: false, notes: [] }]
    };
  }

  function writeProject(project) {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  }

  function addHistory(project) {
    let history = { undo: [], redo: [] };
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY));
      if (parsed && Array.isArray(parsed.undo) && Array.isArray(parsed.redo)) history = parsed;
    } catch (_) {}
    history.undo.push(JSON.stringify(project));
    if (history.undo.length > 100) history.undo.shift();
    history.redo = [];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function keyRoot(key) {
    const root = String(key || 'C').replace(/\s.*$/, '').replace('♭', 'b').replace('♯', '#');
    return NOTE_PCS[root] ?? 0;
  }

  function template(pattern, phraseBeats) {
    const steps = Array(phraseBeats * 4).fill(0);
    for (let bar = 0; bar < phraseBeats / 4; bar += 1) {
      const start = bar * 16;
      if (pattern === 'driving') {
        for (let index = 0; index < 16; index += 2) steps[start + index] = 2;
      }
      if (pattern === 'pumping') [2, 6, 10, 14].forEach(index => { steps[start + index] = 2; });
      if (pattern === 'root') steps[start] = 2;
      if (pattern === 'gallop') {
        for (let beat = 0; beat < 4; beat += 1) [0, 2, 3].forEach(index => { steps[start + beat * 4 + index] = 2; });
      }
    }
    return steps;
  }

  function resetSteps() {
    state.steps = template(state.pattern, state.phraseBeats);
  }

  function sourceTrack(project) {
    return project.tracks.find(track => track.id === state.source) || null;
  }

  function rootAt(project, beat) {
    const source = sourceTrack(project);
    if (!source || !Array.isArray(source.notes) || !source.notes.length) return keyRoot(project.key);
    const epsilon = 0.0001;
    const active = source.notes.filter(note => Number(note.start) <= beat + epsilon && (Number(note.start) + Number(note.duration)) > beat + epsilon);
    if (active.length) return Math.min(...active.map(note => Number(note.pitch) || 60)) % 12;
    const previousStarts = source.notes.filter(note => Number(note.start) <= beat + epsilon).map(note => Number(note.start));
    if (!previousStarts.length) return keyRoot(project.key);
    const latest = Math.max(...previousStarts);
    const chord = source.notes.filter(note => Math.abs(Number(note.start) - latest) < epsilon);
    return Math.min(...chord.map(note => Number(note.pitch) || 60)) % 12;
  }

  function bassPitch(rootPc) {
    const base = Number(state.register) || 36;
    return base + ((rootPc - (base % 12) + 12) % 12);
  }

  function noteDuration(pattern, stepInBar) {
    if (pattern === 'root' && stepInBar === 0) return 4;
    if (pattern === 'driving') return 0.47;
    if (pattern === 'pumping') return 0.36;
    if (pattern === 'gallop') return stepInBar % 4 === 0 ? 0.48 : 0.23;
    return 0.23;
  }

  function chordChanges(project, start, end) {
    const source = sourceTrack(project);
    if (!source) return [];
    return [...new Set(source.notes.map(note => Number(note.start)).filter(time => time > start + 0.0001 && time < end - 0.0001))].sort((a, b) => a - b);
  }

  function splitHeldNote(project, start, duration, velocity, groupId) {
    const end = start + duration;
    const points = [start, ...chordChanges(project, start, end), end];
    const events = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const segmentStart = points[index];
      const segmentEnd = points[index + 1];
      if (segmentEnd - segmentStart < 0.03125) continue;
      events.push({
        id: uid('note'),
        start: segmentStart,
        pitch: bassPitch(rootAt(project, segmentStart + 0.0001)),
        duration: segmentEnd - segmentStart,
        velocity,
        groupId
      });
    }
    return events;
  }

  function buildBlock(project, blockStart, groupId) {
    const output = [];
    state.steps.forEach((level, index) => {
      if (!level) return;
      const localStart = index / 4;
      const globalStart = blockStart + localStart;
      const inBar = index % 16;
      const duration = noteDuration(state.pattern, inBar);
      const velocity = VELOCITIES[level] || VELOCITIES[2];
      if (state.pattern === 'root' && duration >= 4) {
        output.push(...splitHeldNote(project, globalStart, duration, velocity, groupId));
      } else {
        output.push({
          id: uid('note'),
          start: globalStart,
          pitch: bassPitch(rootAt(project, globalStart + 0.0001)),
          duration,
          velocity,
          groupId
        });
      }
    });
    return output;
  }

  function buildPlan(project) {
    const rawEnd = projectEnd(project);
    const insertAt = rawEnd ? Math.ceil(rawEnd / 4) * 4 : 0;
    const totalBeats = 32 * state.units;
    const blocks = totalBeats / state.phraseBeats;
    const groups = [];
    for (let block = 0; block < blocks; block += 1) {
      const groupId = uid('bass-group');
      const start = insertAt + block * state.phraseBeats;
      groups.push({ groupId, start, beats: state.phraseBeats, notes: buildBlock(project, start, groupId) });
    }
    return { insertAt, totalBeats, groups, notes: groups.flatMap(group => group.notes) };
  }

  function describePlan(project) {
    const plan = buildPlan(project);
    const source = state.source === 'key' ? `project key (${project.key})` : (sourceTrack(project)?.name || 'project key');
    $('#bassSummary').textContent = `Adds ${plan.groups.length} × ${state.phraseBeats}-beat group${plan.groups.length === 1 ? '' : 's'} • ${plan.totalBeats} beats total • starts at beat ${plan.insertAt} • harmony: ${source}.`;
  }

  function renderSourceTracks(project) {
    const select = $('#bassHarmonySource');
    const previous = state.source;
    select.replaceChildren(new Option(`Project key root — ${project.key}`, 'key'));
    project.tracks.filter(track => track.notes?.length && !/bass/i.test(track.name)).forEach(track => {
      select.append(new Option(`Guide track: ${track.name}`, track.id));
    });
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
    else {
      state.source = 'key';
      select.value = state.source;
    }
  }

  function renderGrid() {
    const host = $('#bassStepGrid');
    const beats = state.phraseBeats;
    const cells = beats * 4;
    host.style.setProperty('--bass-step-count', String(cells));
    host.replaceChildren();
    for (let index = 0; index < cells; index += 1) {
      const level = state.steps[index] || 0;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `bass-step${level ? ` is-on velocity-${level}` : ''}${index % 16 === 0 ? ' bar-start' : ''}${index % 4 === 0 ? ' beat-start' : ''}`;
      cell.dataset.step = String(index);
      cell.title = level ? `Step ${index + 1}: ${['', 'soft', 'normal', 'accent'][level]} — right-click to change velocity` : `Step ${index + 1}: off — click to add`;
      cell.innerHTML = `<span>${level === 3 ? '●' : level === 2 ? '•' : level === 1 ? '·' : ''}</span>`;
      host.append(cell);
    }
    const bars = [];
    for (let bar = 0; bar < beats / 4; bar += 1) bars.push(String(bar + 1));
    $('#bassBarLabels').textContent = `Bars: ${bars.join('   ')}`;
  }

  function setPattern(pattern) {
    state.pattern = pattern;
    resetSteps();
    $$('.bass-pattern').forEach(button => button.classList.toggle('selected', button.dataset.pattern === pattern));
    renderGrid();
    describePlan(readProject());
  }

  function setPhrase(beats) {
    state.phraseBeats = Number(beats);
    resetSteps();
    $$('.bass-phrase').forEach(button => button.classList.toggle('selected', Number(button.dataset.beats) === state.phraseBeats));
    renderGrid();
    describePlan(readProject());
  }

  function renderModal() {
    const project = readProject();
    renderSourceTracks(project);
    $('#bassLength').value = String(state.units);
    $('#bassLengthValue').textContent = `${state.units} × 32 beats = ${state.units * 32} beats`;
    $('#bassInstrument').value = state.instrument;
    $('#bassRegister').value = String(state.register);
    $$('.bass-phrase').forEach(button => button.classList.toggle('selected', Number(button.dataset.beats) === state.phraseBeats));
    $$('.bass-pattern').forEach(button => button.classList.toggle('selected', button.dataset.pattern === state.pattern));
    renderGrid();
    describePlan(project);
  }

  function openModal() {
    stopPreview();
    if (!state.steps.length || state.steps.length !== state.phraseBeats * 4) resetSteps();
    renderModal();
    $('#bassModal').hidden = false;
  }

  function closeModal() {
    stopPreview();
    $('#bassModal').hidden = true;
  }

  function ensurePreviewAudio() {
    if (preview.context) {
      if (preview.context.state === 'suspended') preview.context.resume().catch(() => {});
      return preview.context;
    }
    const AudioContextApi = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextApi) return null;
    preview.context = new AudioContextApi();
    preview.gain = preview.context.createGain();
    preview.gain.gain.value = 0.78;
    preview.gain.connect(preview.context.destination);
    return preview.context;
  }

  async function loadPreviewInstrument() {
    const context = ensurePreviewAudio();
    if (!context || !window.Soundfont) return null;
    if (preview.player && preview.instrument === state.instrument) return preview.player;
    preview.player = null;
    preview.instrument = state.instrument;
    try {
      preview.player = await window.Soundfont.instrument(context, SOUNDFONTS[state.instrument], {
        soundfont: 'MusyngKite',
        format: 'mp3',
        destination: preview.gain,
        gain: 0.94
      });
      return preview.player;
    } catch (_) {
      return null;
    }
  }

  function stopPreview() {
    clearTimeout(preview.timer);
    preview.timer = 0;
    preview.nodes.splice(0).forEach(node => {
      try { node.stop?.(); } catch (_) {}
    });
    preview.running = false;
    const button = $('#bassPreview');
    if (button) {
      button.textContent = '▶ Play Preview';
      button.classList.remove('is-previewing');
    }
  }

  async function playPreview() {
    if (preview.running) {
      stopPreview();
      return;
    }
    const project = readProject();
    const player = await loadPreviewInstrument();
    if (!player) {
      showToast('Bass sample could not load.');
      return;
    }
    const plan = buildPlan(project);
    const firstStart = plan.insertAt;
    const previewEvents = plan.notes.filter(note => note.start < firstStart + 32);
    const now = preview.context.currentTime + 0.06;
    const seconds = beatsPerSecond(project);
    preview.running = true;
    $('#bassPreview').textContent = '⏹ Stop Preview';
    $('#bassPreview').classList.add('is-previewing');
    previewEvents.forEach(note => {
      try {
        const node = player.play(note.pitch, now + (note.start - firstStart) * seconds, {
          duration: Math.max(0.08, note.duration * seconds),
          gain: clamp(note.velocity / 127, 0.15, 0.95),
          attack: 0.008,
          release: 0.12
        });
        if (node?.stop) preview.nodes.push(node);
      } catch (_) {}
    });
    preview.timer = window.setTimeout(stopPreview, Math.max(600, Math.min(32000, 32 * seconds * 1000 + 260)));
  }

  function findOrMakeBassTrack(project) {
    let track = project.tracks.find(candidate => /bass/i.test(candidate.name) || candidate.instrument === 'electric_bass');
    if (!track) {
      track = {
        id: uid('track'),
        name: 'Bass',
        instrument: state.instrument,
        color: COLORS[0],
        muted: false,
        solo: false,
        hidden: false,
        notes: []
      };
      project.tracks.push(track);
    }
    track.instrument = state.instrument;
    return track;
  }

  function addToTimeline() {
    const project = readProject();
    const plan = buildPlan(project);
    if (!plan.notes.length) {
      showToast('Turn on at least one bass step first.');
      return;
    }
    addHistory(clone(project));
    const bass = findOrMakeBassTrack(project);
    bass.notes.push(...plan.notes);
    writeProject(project);
    sessionStorage.setItem(TOAST_KEY, `Added ${plan.groups.length} bass group${plan.groups.length === 1 ? '' : 's'} to the timeline.`);
    window.location.reload();
  }

  function showToast(text) {
    const status = $('#status');
    if (!status) return;
    status.textContent = text;
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const trigger = event.target.closest('#quickBass');
      if (!trigger) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openModal();
    }, true);

    $('#bassClose')?.addEventListener('click', closeModal);
    $('#bassReset')?.addEventListener('click', () => {
      resetSteps();
      renderGrid();
      describePlan(readProject());
    });
    $('#bassPreview')?.addEventListener('click', playPreview);
    $('#bassAdd')?.addEventListener('click', addToTimeline);

    $('#bassLength')?.addEventListener('input', event => {
      state.units = Number(event.target.value);
      $('#bassLengthValue').textContent = `${state.units} × 32 beats = ${state.units * 32} beats`;
      describePlan(readProject());
    });
    $('#bassHarmonySource')?.addEventListener('change', event => {
      state.source = event.target.value;
      describePlan(readProject());
    });
    $('#bassInstrument')?.addEventListener('change', event => { state.instrument = event.target.value; });
    $('#bassRegister')?.addEventListener('change', event => { state.register = Number(event.target.value); });

    $('#bassPhraseChoices')?.addEventListener('click', event => {
      const button = event.target.closest('.bass-phrase');
      if (button) setPhrase(button.dataset.beats);
    });
    $('#bassPatternChoices')?.addEventListener('click', event => {
      const button = event.target.closest('.bass-pattern');
      if (button) setPattern(button.dataset.pattern);
    });
    $('#bassStepGrid')?.addEventListener('click', event => {
      const cell = event.target.closest('.bass-step');
      if (!cell) return;
      const index = Number(cell.dataset.step);
      state.steps[index] = state.steps[index] ? 0 : 2;
      renderGrid();
      describePlan(readProject());
    });
    $('#bassStepGrid')?.addEventListener('contextmenu', event => {
      const cell = event.target.closest('.bass-step');
      if (!cell) return;
      event.preventDefault();
      const index = Number(cell.dataset.step);
      state.steps[index] = state.steps[index] === 0 ? 1 : (state.steps[index] % 3) + 1;
      renderGrid();
      describePlan(readProject());
    });
  }

  bindEvents();
})();