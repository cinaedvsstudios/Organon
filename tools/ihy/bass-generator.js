(() => {
  'use strict';

  const PROJECT_KEY = 'ihy-v042-project';
  const HISTORY_KEY = 'ihy-v042-history';
  const TOAST_KEY = 'ihy-v045-toast';
  const NOTE_PCS = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 };
  const TIES = [1, 2, 4, 8, 16];
  const VELOCITIES = [62, 88, 112];
  const COLORS = ['#60c6a4', '#b68cff', '#dfb658'];
  const SOUNDFONTS = {
    contrabass_arco: 'cello', contrabass_pizz: 'acoustic_bass', tuba: 'tuba', contrabassoon: 'bassoon', cello_bass: 'cello',
    grand_piano: 'acoustic_grand_piano', strings: 'string_ensemble_1', violin: 'violin', church_organ: 'church_organ', clarinet: 'clarinet', oboe: 'oboe'
  };
  const SAVED_INSTRUMENTS = {
    contrabass_arco: 'cello', contrabass_pizz: 'acoustic_guitar', tuba: 'horn', contrabassoon: 'horn', cello_bass: 'cello',
    grand_piano: 'grand_piano', strings: 'strings', violin: 'strings', church_organ: 'horn', clarinet: 'flute', oboe: 'flute'
  };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mod = (value, base) => ((value % base) + base) % base;
  const pick = values => values[Math.floor(Math.random() * values.length)];
  const chance = probability => Math.random() < probability;

  const rhythms = [
    [2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0],
    [0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0],
    [2,0,0,2,2,0,2,0,2,0,0,2,2,0,2,0],
    [2,0,0,2,0,2,0,0,2,0,2,0,0,2,0,2],
    [2,0,0,0,0,0,2,0,2,0,0,0,0,2,0,0],
    [2,0,2,2,2,0,2,2,2,0,2,2,2,0,2,2]
  ];
  const maps = [
    [0,0,12,12,10,10,7,7,0,0,12,12,10,10,7,7],
    [0,7,12,7,0,5,7,10,0,7,12,7,10,7,5,0],
    [0,0,7,7,12,7,5,7,0,0,7,12,10,7,5,0],
    [0,12,7,10,0,7,5,12,0,10,7,5,0,7,12,10],
    [0,0,0,7,0,0,5,0,0,0,7,12,0,5,7,0]
  ];
  const genreNames = ['Disco Box', 'Disco Lift', 'Pulse Fifth', 'Night Walker', 'Silver Walker', 'Funk Reply', 'Low Roller', 'Gallop Box', 'Neon Rise', 'Stage Drive'];
  const genres = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    name: `${genreNames[index % genreNames.length]} ${Math.floor(index / genreNames.length) + 1}`,
    rhythm: rhythms[index % rhythms.length],
    intervals: maps[index % maps.length]
  }));
  const emotions = {
    aspirational: { name: 'Aspirational', tempo: '76–116 BPM', pool: [0,5,7,12], text: 'Sparse opening that grows into a broad, open lift.' },
    showstopping: { name: 'Showstopping', tempo: '118–154 BPM', pool: [0,4,7,9,12], text: 'Bouncy anchored energy with crisp theatrical attacks.' },
    romantic: { name: 'Romantic / Yearning', tempo: '62–100 BPM', pool: [0,3,7,8,12], text: 'Anticipated notes and live-feeling dynamic waves.' },
    cabaret: { name: 'Cabaret / Sassy', tempo: '72–112 BPM', pool: [0,7,10,11], text: 'Heavy struts, dramatic gaps and hard accents.' },
    scheming: { name: 'Scheming', tempo: '70–122 BPM', pool: [0,3,6,10], text: 'Unstable clusters and abrupt ominous silence.' },
    effervescent: { name: 'Effervescent', tempo: '104–142 BPM', pool: [0,4,12], text: 'High bright offbeats without sub-bass mud.' }
  };

  const ROLL_STEP = 0.25;
  const ROLL_STEP_WIDTH = 28;
  const ROLL_ROW_HEIGHT = 24;
  const ROLL_LABEL_WIDTH = 54;

  const state = {
    mode: 'genre', genreId: 1, emotionId: 'aspirational', phrase: 8, units: 1, mutation: 25,
    source: 'key', instrument: 'grand_piano', register: 36, tempo: 92, sequence: [], manual: false,
    rollNotes: [], rollReady: false, rollDirty: false, rollZoom: 1, rollViewportPending: true, loopPreview: false,
    write: { kind: 'interval', value: 0 }, tie: 2,
    effects: { sustain: true, echo: false, chords: false },
    custom: { motion: 'pedal', pedal: 'root', articulation: 82, dynamics: 'flat', inversions: false }
  };
  const playback = { context: null, gain: null, player: null, instrument: null, nodes: [], timer: 0, active: false, pending: false, request: 0, instrumentRequest: 0, playheadFrame: 0, playheadProgress: 0 };

  function readProject() {
    try {
      const project = JSON.parse(localStorage.getItem(PROJECT_KEY));
      if (project && Array.isArray(project.tracks)) return project;
    } catch (_) {}
    return { bpm: 92, key: 'D minor', sections: [], tracks: [{ id: uid('track'), name: 'Piano', instrument: 'grand_piano', color: COLORS[1], notes: [] }] };
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
  function status(text) { const target = $('#status'); if (target) target.textContent = text; }
  function projectEnd(project) {
    return Math.max(0, ...(project.sections || []).map(section => Number(section.end) || 0), ...(project.tracks || []).flatMap(track => (track.notes || []).map(note => (Number(note.start) || 0) + (Number(note.duration) || 0))));
  }
  function secondsPerBeat(project) { return 60 / clamp(Number(project.bpm) || 92, 30, 260); }
  function isMinor(project) { return /minor/i.test(String(project.key || '')); }
  function keyRoot(project) { const name = String(project.key || 'C').replace(/\s.*$/, '').replace('♭', 'b').replace('♯', '#'); return NOTE_PCS[name] ?? 0; }
  function noteName(pitch) { const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; return `${names[mod(pitch, 12)]}${Math.floor(pitch / 12) - 1}`; }
  function cell(kind, value, velocity = 2, tie = 2, extra = {}) { return { kind, value, velocity, tie, ...extra }; }
  function stepCount() { return state.phrase * 4; }

  function guideTrack(project) { return project.tracks.find(track => track.id === state.source); }
  function chordPcs(project, beat) {
    const track = guideTrack(project);
    if (!track || !track.notes || !track.notes.length) return [];
    const epsilon = 0.0001;
    const active = track.notes.filter(note => Number(note.start) <= beat + epsilon && Number(note.start) + Number(note.duration) > beat + epsilon);
    if (active.length) return active.map(note => mod(Number(note.pitch) || 60, 12));
    const previous = track.notes.filter(note => Number(note.start) <= beat + epsilon);
    if (!previous.length) return [];
    const latest = Math.max(...previous.map(note => Number(note.start)));
    return track.notes.filter(note => Math.abs(Number(note.start) - latest) < epsilon).map(note => mod(Number(note.pitch) || 60, 12));
  }
  function rootAt(project, beat) { const pcs = chordPcs(project, beat); return pcs.length ? Math.min(...pcs) : keyRoot(project); }
  function thirdAt(project, root, beat) {
    const intervals = chordPcs(project, beat).map(pitch => mod(pitch - root, 12));
    if (intervals.includes(3)) return 3;
    if (intervals.includes(4)) return 4;
    return isMinor(project) ? 3 : 4;
  }
  function fifthAt(project, root, beat) {
    const intervals = chordPcs(project, beat).map(pitch => mod(pitch - root, 12));
    if (intervals.includes(6)) return 6;
    if (intervals.includes(8)) return 8;
    return 7;
  }
  function scaleIntervals(project, root) {
    const tonic = keyRoot(project);
    const scale = isMinor(project) ? [0,2,3,5,7,8,10] : [0,2,4,5,7,9,11];
    const result = [...new Set(scale.map(interval => mod(tonic + interval - root, 12)))].sort((a, b) => a - b);
    if (!result.includes(0)) result.unshift(0);
    return result;
  }
  function degreeInterval(project, root, degree) { if (degree === 8) return 12; return scaleIntervals(project, root)[clamp(Number(degree) || 1, 1, 7) - 1] ?? 0; }
  function basePitch(root, offset = 0) { const base = Number(state.register) + offset; return base + mod(root - mod(base, 12), 12); }
  function thirdText(project) { return isMinor(project) ? '♭3' : '3'; }
  function tieText(tie) { return ({ 1: '1/16', 2: '1/8', 4: '1/4', 8: '1/2', 16: '1 bar' })[tie] || `${tie}×`; }
  function cellText(project, current) {
    if (!current) return '—';
    if (current.kind === 'absolute') return noteName(current.value);
    if (current.kind === 'third') return thirdText(project);
    if (current.kind === 'degree') return ({ 1:'R', 2:'2', 3:thirdText(project), 4:'4', 5:'5', 6:'6', 7:'7', 8:'8' })[current.value] || 'R';
    return ({ 0:'R', 3:'♭3', 4:'3', 5:'4', 6:'♭5', 7:'5', 8:'♭6', 9:'6', 10:'♭7', 11:'7', 12:'8' })[current.value] || String(current.value);
  }

  function activeGenre() { return genres.find(item => item.id === state.genreId) || genres[0]; }
  function activeEmotion() { return emotions[state.emotionId] || emotions.aspirational; }
  function loadGenre() {
    const profile = activeGenre();
    state.sequence = Array.from({ length: stepCount() }, (_, index) => profile.rhythm[index % 16] ? cell('interval', profile.intervals[index % 16], profile.rhythm[index % 16], 2) : null);
    state.write = { kind: 'interval', value: 0 };
    state.tie = 2;
    state.manual = false;
  }
  function buildEmotion(id, groupIndex = 0, groupCount = 1) {
    const output = Array(stepCount()).fill(null);
    const emotion = emotions[id];
    const bars = Math.max(1, state.phrase / 4);
    const add = (index, value, velocity = 2, tie = 2, extra = {}) => { if (index >= 0 && index < output.length) output[index] = cell('interval', value, velocity, tie, extra); };
    for (let bar = 0; bar < bars; bar += 1) {
      const start = bar * 16;
      const overallBar = groupIndex * bars + bar;
      const progress = (overallBar + 0.5) / Math.max(1, groupCount * bars);
      if (id === 'aspirational') {
        const density = progress < 0.5 ? (overallBar % 2 ? 2 : 1) : 4 + overallBar % 3;
        [0,4,8,12,2,6,10,14].slice(0, density).forEach(step => add(start + step, pick(emotion.pool), progress > 0.5 ? 2 : 1));
      } else if (id === 'showstopping') {
        add(start, 0, 3, 2);
        add(start + 4, pick([7, 12]), 2, 2);
        [2,6,8,10,12,14].filter(() => chance(0.58)).forEach(step => add(start + step, pick(emotion.pool), 2, pick([1,2])));
      } else if (id === 'romantic') {
        if (start > 0) add(start - 1, pick([0,3,7]), 2, 4); else add(start, 0, 2, 4);
        [6,10].filter(() => chance(0.62)).forEach(step => add(start + step, pick(emotion.pool), pick([1,2,2,3]), 4));
      } else if (id === 'cabaret') {
        add(start, 0, 3, 4);
        add(start + 8, pick([0,7]), 3, 4);
        [4,12,14].filter(() => chance(0.55)).forEach(step => add(start + step, pick(emotion.pool), 1, 2));
      } else if (id === 'scheming') {
        const cluster = pick([0,4,8,12]);
        [0,1,2].slice(0, pick([2,3])).forEach(offset => add(start + cluster + offset, pick(emotion.pool), pick([1,2,3]), pick([1,2,4,8])));
        if (chance(0.48)) add(start + pick([3,7,11,15]), pick(emotion.pool), 1, pick([1,8]));
      } else if (id === 'effervescent') {
        [2,6,10,14].filter(() => chance(0.74)).forEach(step => add(start + step, pick(emotion.pool), pick([1,2,2]), 1, { octaveOffset: 12 }));
        [1,3,5,7,9,11,13,15].filter(() => chance(0.2)).forEach(step => add(start + step, pick(emotion.pool), 1, 1, { octaveOffset: 12 }));
      }
    }
    if (!output.some(Boolean)) output[0] = cell('interval', 0, 2, 2);
    return output;
  }
  function loadEmotion() { state.sequence = buildEmotion(state.emotionId, 0, Math.max(1, 32 / state.phrase)); state.write = { kind: 'interval', value: activeEmotion().pool[0] }; state.tie = 2; state.manual = false; }
  function mutateGenre() {
    const rate = state.mutation / 100;
    const choices = [{ kind:'interval', value:0 }, { kind:'third', value:3 }, { kind:'interval', value:5 }, { kind:'interval', value:7 }, { kind:'interval', value:12 }];
    state.sequence = state.sequence.map(current => {
      let next = current ? { ...current } : null;
      if (chance(rate)) { const selected = pick(choices); next = next ? null : cell(selected.kind, selected.value); }
      if (next && chance(rate)) { const selected = pick(choices); next.kind = selected.kind; next.value = selected.value; }
      if (next && chance(rate * 0.45)) next.velocity = pick([1,2,2,3]);
      return next;
    });
    if (!state.sequence.some(Boolean)) state.sequence[0] = cell('interval', 0);
    state.manual = true;
  }
  function generateCustom() {
    const output = Array(stepCount()).fill(null);
    const put = (index, degree, velocity = 2, tie = 4, extra = {}) => { if (index < output.length) output[index] = cell('degree', degree, velocity, tie, extra); };
    if (state.custom.motion === 'pedal') {
      put(0, state.custom.pedal === 'fifth' ? 5 : 1, 2, stepCount(), { fixed: true });
    } else {
      const contour = state.custom.motion === 'arpeggio' ? [1,3,5,8,5,3,1,5] : [1,2,3,4,5,4,3,2,1,2,3,5,6,5,4,2];
      for (let index = 0; index < output.length; index += 4) {
        let degree = contour[(index / 4) % contour.length];
        if (state.custom.inversions && index % 16 === 0) degree = pick([3,5]);
        put(index, degree, 2, 4, state.custom.motion === 'stepwise' ? { walk: true } : {});
      }
    }
    state.sequence = output;
    state.write = { kind: 'degree', value: 1 };
    state.tie = 4;
    state.manual = false;
  }

  function resolveInterval(project, current, root, beat) {
    if (current.kind === 'absolute') return null;
    if (current.kind === 'third') return thirdAt(project, root, beat);
    if (current.kind === 'degree') return degreeInterval(project, root, current.value);
    return Number(current.value) || 0;
  }
  function closestPitch(candidate, previous) {
    if (!Number.isFinite(previous)) return candidate;
    let best = candidate;
    let bestDistance = Math.abs(candidate - previous);
    for (let offset = -36; offset <= 36; offset += 12) {
      const test = candidate + offset;
      if (test < 24 || test > 96) continue;
      const distance = Math.abs(test - previous);
      if (distance < bestDistance) { best = test; bestDistance = distance; }
    }
    return best;
  }
  function resolvePitch(project, current, root, beat, previous) {
    if (current.kind === 'absolute') return clamp(current.value, 24, 96);
    let value = basePitch(root, current.octaveOffset || 0) + (resolveInterval(project, current, root, beat) || 0);
    if (current.walk) value = closestPitch(value, previous);
    return clamp(value, 24, 96);
  }
  function nextDistance(sequence, index) { for (let cursor = index + 1; cursor < sequence.length; cursor += 1) if (sequence[cursor]) return cursor - index; return sequence.length - index; }
  function articulationGate() { return state.mode === 'custom' ? 0.26 + state.custom.articulation / 100 * 0.72 : 0.84; }
  function velocityScale(fraction, beatOffset) {
    if (state.mode === 'custom') {
      if (state.custom.dynamics === 'crescendo') return 0.58 + 0.52 * fraction;
      if (state.custom.dynamics === 'decrescendo') return 1.1 - 0.52 * fraction;
      if (state.custom.dynamics === 'swell') return 0.55 + 0.57 * Math.sin(Math.PI * fraction);
    }
    if (state.mode === 'emotion' && state.emotionId === 'aspirational') return 1 + Math.floor(beatOffset / 4) * 0.015;
    return 1;
  }
  function chordChanges(project, start, end) {
    const track = guideTrack(project);
    if (!track) return [];
    return [...new Set(track.notes.map(note => Number(note.start)).filter(time => time > start + 0.0001 && time < end - 0.0001))].sort((a,b) => a - b);
  }
  function segmentNotes(project, start, end, current, groupId, previous, fixedRoot) {
    const points = current.fixed ? [start, end] : [start, ...chordChanges(project, start, end), end];
    const notes = [];
    let prior = previous;
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index], to = points[index + 1];
      if (to - from < 0.03) continue;
      const root = current.fixed ? fixedRoot : rootAt(project, from + 0.001);
      const pitch = resolvePitch(project, current, root, from, prior);
      notes.push({ id: uid('note'), start: from, pitch, duration: to - from, velocity: VELOCITIES[current.velocity - 1] || 88, groupId });
      prior = pitch;
    }
    return { notes, previous: prior };
  }
  function sequenceFor(blockIndex, blockCount) { return state.mode === 'emotion' && !state.manual ? buildEmotion(state.emotionId, blockIndex, blockCount) : state.sequence; }
  function baseNotes(project, blockStart, groupId, blockIndex, blockCount, sequenceOverride = null, useSustain = state.effects.sustain) {
    const sequence = sequenceOverride || sequenceFor(blockIndex, blockCount);
    const notes = [];
    let previous = null;
    const fixedRoot = rootAt(project, blockStart + 0.001);
    sequence.forEach((current, index) => {
      if (!current) return;
      const available = nextDistance(sequence, index);
      const noteColumns = current.fixed ? Math.min(current.tie, sequence.length - index) : (useSustain ? available : Math.min(current.tie, available));
      const duration = noteColumns * ROLL_STEP * (useSustain ? 0.96 : articulationGate());
      const result = segmentNotes(project, blockStart + index * ROLL_STEP, blockStart + index * ROLL_STEP + duration, current, groupId, previous, fixedRoot);
      notes.push(...result.notes);
      previous = result.previous;
    });
    return notes;
  }
  function rollMetrics() {
    return {
      stepWidth: Math.round(ROLL_STEP_WIDTH * state.rollZoom),
      rowHeight: Math.round(ROLL_ROW_HEIGHT * state.rollZoom)
    };
  }
  function rollRange() {
    const visibleMinPitch = Number(state.register);
    return { minPitch: visibleMinPitch - 12, maxPitch: visibleMinPitch + 35 };
  }
  function syncRollFromSequence(project = readProject()) {
    const notes = baseNotes(project, 0, 'bass-roll', 0, 1, state.sequence, false);
    state.rollNotes = notes.map(note => ({
      id: uid('bass-roll'),
      start: Math.max(0, Number(note.start) || 0),
      pitch: clamp(Number(note.pitch) || Number(state.register), 24, 96),
      duration: Math.max(ROLL_STEP, Number(note.duration) || ROLL_STEP),
      velocity: clamp(Number(note.velocity) || 88, 20, 127)
    }));
    state.rollReady = true;
    state.rollDirty = false;
  }
  function shiftRollRegister(fromRegister, toRegister) {
    const delta = Number(toRegister) - Number(fromRegister);
    if (!delta || !state.rollReady) return;
    state.rollNotes = state.rollNotes.map(note => ({ ...note, pitch: clamp(note.pitch + delta, 24, 96) }));
  }
  function copyRollBlock(start, groupId) {
    return state.rollNotes.map(note => ({
      id: uid('note'),
      start: start + note.start,
      pitch: note.pitch,
      duration: note.duration,
      velocity: note.velocity,
      groupId
    }));
  }
  function addChords(project, notes) {
    if (!state.effects.chords) return notes;
    const output = [];
    notes.forEach(note => {
      output.push(note);
      const root = rootAt(project, note.start + 0.001);
      const third = thirdAt(project, root, note.start + 0.001);
      const fifth = fifthAt(project, root, note.start + 0.001);
      let topRoot = basePitch(root);
      while (topRoot <= note.pitch + 1) topRoot += 12;
      const seen = new Set([note.pitch]);
      [topRoot, topRoot + third, topRoot + fifth].forEach(pitch => {
        const safe = clamp(pitch, 24, 96);
        if (!seen.has(safe)) { seen.add(safe); output.push({ ...note, id: uid('note'), pitch: safe, velocity: Math.max(25, Math.round(note.velocity * 0.82)) }); }
      });
    });
    return output;
  }
  function addEcho(notes, blockEnd) {
    if (!state.effects.echo) return notes;
    const output = [...notes];
    notes.forEach(note => {
      const start = note.start + 0.5;
      if (start < blockEnd - 0.03) output.push({ ...note, id: uid('note'), start, duration: Math.max(0.08, Math.min(0.25, note.duration * 0.48)), velocity: Math.max(20, Math.round(note.velocity * 0.45)) });
    });
    return output;
  }
  function createBlock(project, start, groupId, blockIndex, blockCount) {
    const sourceNotes = state.rollReady ? copyRollBlock(start, groupId) : baseNotes(project, start, groupId, blockIndex, blockCount);
    return addEcho(addChords(project, sourceNotes), start + state.phrase);
  }
  function buildPlan(project) {
    const insertAt = projectEnd(project) ? Math.ceil(projectEnd(project) / 4) * 4 : 0;
    const total = 32 * state.units;
    const count = total / state.phrase;
    const groups = [];
    for (let index = 0; index < count; index += 1) {
      const groupId = uid('bass-group');
      const start = insertAt + index * state.phrase;
      groups.push({ groupId, start, notes: createBlock(project, start, groupId, index, count) });
    }
    const notes = groups.flatMap(group => group.notes);
    notes.forEach(note => { const fraction = clamp((note.start - insertAt) / Math.max(1, total), 0, 1); note.velocity = clamp(Math.round(note.velocity * velocityScale(fraction, note.start - insertAt)), 20, 127); });
    return { insertAt, total, groups, notes };
  }

  function renderGuideOptions(project) {
    const select = $('#bassHarmonySource');
    const old = state.source;
    select.replaceChildren(new Option(`Project key root — ${project.key}`, 'key'));
    project.tracks.filter(track => track.notes && track.notes.length && !/bass/i.test(track.name)).forEach(track => select.append(new Option(`Guide track: ${track.name}`, track.id)));
    state.source = [...select.options].some(option => option.value === old) ? old : 'key';
    select.value = state.source;
  }
  function renderProfiles() {
    const select = $('#bassProfileSelect');
    const detail = $('#bassEmotionDetail');
    const heading = $('#bassProfileHeading');
    if (state.mode === 'genre') {
      heading.textContent = 'Genre profile';
      select.replaceChildren(...genres.map(profile => new Option(`${String(profile.id).padStart(2, '0')} · ${profile.name}`, profile.id)));
      select.value = String(state.genreId);
      detail.hidden = true;
    } else {
      heading.textContent = 'Emotion profile';
      select.replaceChildren(...Object.entries(emotions).map(([id, emotion]) => new Option(emotion.name, id)));
      select.value = state.emotionId;
      detail.hidden = false;
      detail.textContent = `${activeEmotion().text} Tempo guide: ${activeEmotion().tempo}.`;
    }
  }
  function renderPreviewControls() {
    const previewButton = $('#bassPreview');
    const stopButton = $('#bassStop');
    const loopButton = $('#bassLoop');
    const running = playback.active || playback.pending;
    previewButton?.classList.toggle('is-previewing', running);
    stopButton?.toggleAttribute('disabled', !running);
    loopButton?.classList.toggle('selected', state.loopPreview);
    loopButton?.setAttribute('aria-pressed', String(state.loopPreview));
  }
  function renderEffects() {
    [['bassSustain','sustain'], ['bassEcho','echo'], ['bassChords','chords']].forEach(([id, key]) => $(`#${id}`).classList.toggle('selected', state.effects[key]));
    renderPreviewControls();
  }
  function sortRollNotes() { state.rollNotes.sort((a, b) => a.start - b.start || a.pitch - b.pitch || a.id.localeCompare(b.id)); }
  function rollPointFromEvent(event) {
    const grid = $('#bassRollGrid');
    const rect = grid.getBoundingClientRect();
    const { minPitch, maxPitch } = rollRange();
    const { stepWidth, rowHeight } = rollMetrics();
    const steps = Math.round(state.phrase / ROLL_STEP);
    const step = clamp(Math.floor((event.clientX - rect.left) / stepWidth), 0, steps - 1);
    const row = clamp(Math.floor((event.clientY - rect.top) / rowHeight), 0, maxPitch - minPitch);
    return { start: step * ROLL_STEP, pitch: maxPitch - row };
  }
  function renderRoll() {
    const scroll = $('#bassRollScroll');
    const canvas = $('#bassRollCanvas');
    const ruler = $('#bassRollRuler');
    const labels = $('#bassRollLabels');
    const grid = $('#bassRollGrid');
    const { minPitch, maxPitch } = rollRange();
    const { stepWidth, rowHeight } = rollMetrics();
    const pitchCount = maxPitch - minPitch + 1;
    const stepCount = Math.round(state.phrase / ROLL_STEP);
    const gridWidth = stepCount * stepWidth;
    const gridHeight = pitchCount * rowHeight;
    const visibleHeight = 28 + 24 * rowHeight + 22;

    scroll.style.setProperty('--bass-roll-visible-height', `${visibleHeight}px`);
    canvas.style.gridTemplateColumns = `${ROLL_LABEL_WIDTH}px ${gridWidth}px`;
    canvas.style.gridTemplateRows = `28px ${gridHeight}px`;
    canvas.style.width = `${ROLL_LABEL_WIDTH + gridWidth}px`;
    ruler.style.width = `${gridWidth}px`;
    labels.style.height = `${gridHeight}px`;
    labels.style.gridTemplateRows = `repeat(${pitchCount}, ${rowHeight}px)`;
    grid.style.width = `${gridWidth}px`;
    grid.style.height = `${gridHeight}px`;
    grid.style.setProperty('--bass-roll-step-width', `${stepWidth}px`);
    grid.style.setProperty('--bass-roll-row-height', `${rowHeight}px`);
    grid.style.setProperty('--bass-roll-bar-width', `${stepWidth * 16}px`);

    ruler.replaceChildren();
    for (let beat = 0; beat < state.phrase; beat += 1) {
      const marker = document.createElement('span');
      marker.className = beat % 4 === 0 ? 'bass-roll-bar-marker' : 'bass-roll-beat-marker';
      marker.style.left = `${beat * 4 * stepWidth}px`;
      marker.textContent = beat % 4 === 0 ? `Bar ${Math.floor(beat / 4) + 1}` : String(beat + 1);
      ruler.append(marker);
    }

    labels.replaceChildren();
    for (let pitch = maxPitch; pitch >= minPitch; pitch -= 1) {
      const label = document.createElement('div');
      label.className = `bass-roll-label${mod(pitch, 12) === 1 || mod(pitch, 12) === 3 || mod(pitch, 12) === 6 || mod(pitch, 12) === 8 || mod(pitch, 12) === 10 ? ' black-key' : ''}`;
      label.textContent = noteName(pitch);
      labels.append(label);
    }

    grid.replaceChildren();
    const playhead = document.createElement('div');
    playhead.id = 'bassRollPlayhead';
    playhead.className = 'bass-roll-playhead';
    playhead.hidden = !playback.active;
    grid.append(playhead);

    sortRollNotes();
    state.rollNotes.forEach(note => {
      if (note.pitch < minPitch || note.pitch > maxPitch || note.start >= state.phrase) return;
      const block = document.createElement('button');
      block.type = 'button';
      block.className = 'bass-roll-note';
      block.dataset.noteId = note.id;
      block.style.left = `${Math.round(note.start / ROLL_STEP) * stepWidth + 1}px`;
      block.style.top = `${(maxPitch - note.pitch) * rowHeight + 1}px`;
      block.style.width = `${Math.max(stepWidth - 2, Math.round(note.duration / ROLL_STEP) * stepWidth - 2)}px`;
      block.style.height = `${rowHeight - 2}px`;
      block.title = `${noteName(note.pitch)} · starts on beat ${note.start + 1} · ${note.duration} beats`;
      const name = document.createElement('span');
      name.className = 'bass-roll-note-name';
      name.textContent = noteName(note.pitch);
      const resize = document.createElement('span');
      resize.className = 'bass-roll-resize';
      resize.title = 'Drag to change note length';
      block.append(name, resize);
      grid.append(block);
    });

    updateRollPlayhead(playback.playheadProgress, false);
    if (state.rollViewportPending) {
      requestAnimationFrame(() => {
        scroll.scrollTop = 12 * rowHeight;
        state.rollViewportPending = false;
      });
    }
  }
  function renderMode() {
    $$('.bass-mode-tab').forEach(button => button.classList.toggle('selected', button.dataset.mode === state.mode));
  }
  function render() {
    const project = readProject();
    renderMode(); renderGuideOptions(project); renderProfiles();
    $('#bassLength').value = String(state.units); $('#bassLengthValue').textContent = `${state.units} × 32 beats = ${state.units * 32} beats`;
    $('#bassMutationRate').value = String(state.mutation); $('#bassMutationOutput').textContent = `${state.mutation}% mutation`;
    $('#bassTempo').value = String(state.tempo);
    $('#bassInstrument').value = state.instrument; $('#bassRegister').value = String(state.register);
    $$('.bass-phrase').forEach(button => button.classList.toggle('selected', Number(button.dataset.b) === state.phrase));
    if (!state.rollReady) syncRollFromSequence(project);
    $('#bassRollZoomValue').textContent = `${Math.round(state.rollZoom * 100)}%`;
    renderEffects(); renderRoll();
  }
  function openModal() {
    stopPreview();
    state.tempo = clamp(Number(readProject().bpm) || 92, 30, 260);
    if (!state.sequence.length || state.sequence.length !== stepCount()) { if (state.mode === 'emotion') loadEmotion(); else loadGenre(); }
    if (!state.rollReady) syncRollFromSequence(readProject());
    state.rollViewportPending = true;
    render(); $('#bassModal').hidden = false;
  }
  function closeModal() { stopPreview(); $('#bassModal').hidden = true; }
  function beginRollEdit(event, block) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const note = state.rollNotes.find(item => item.id === block.dataset.noteId);
    if (!note) return;
    const { minPitch, maxPitch } = rollRange();
    const { stepWidth, rowHeight } = rollMetrics();
    const resizing = Boolean(event.target.closest('.bass-roll-resize'));
    const startX = event.clientX;
    const startY = event.clientY;
    const original = { start: note.start, pitch: note.pitch, duration: note.duration };
    let next = { ...original };
    block.setPointerCapture?.(event.pointerId);
    document.body.style.userSelect = 'none';
    block.classList.add('is-editing');

    const draw = () => {
      block.style.left = `${Math.round(next.start / ROLL_STEP) * stepWidth + 1}px`;
      block.style.top = `${(maxPitch - next.pitch) * rowHeight + 1}px`;
      block.style.width = `${Math.max(stepWidth - 2, Math.round(next.duration / ROLL_STEP) * stepWidth - 2)}px`;
    };
    const move = moveEvent => {
      const stepDelta = Math.round((moveEvent.clientX - startX) / stepWidth);
      if (resizing) {
        next.duration = clamp(original.duration + stepDelta * ROLL_STEP, ROLL_STEP, state.phrase - original.start);
      } else {
        const pitchDelta = Math.round((moveEvent.clientY - startY) / rowHeight);
        next.start = clamp(original.start + stepDelta * ROLL_STEP, 0, state.phrase - original.duration);
        next.pitch = clamp(original.pitch - pitchDelta, minPitch, maxPitch);
      }
      draw();
    };
    const end = () => {
      note.start = next.start;
      note.pitch = next.pitch;
      note.duration = next.duration;
      state.rollDirty = true;
      document.body.style.userSelect = '';
      block.classList.remove('is-editing');
      block.releasePointerCapture?.(event.pointerId);
      block.removeEventListener('pointermove', move);
      block.removeEventListener('pointerup', end);
      block.removeEventListener('pointercancel', end);
      render();
    };
    block.addEventListener('pointermove', move);
    block.addEventListener('pointerup', end, { once: true });
    block.addEventListener('pointercancel', end, { once: true });
  }
  function addRollNote(event) {
    if (event.button !== 0 || event.target.closest('.bass-roll-note')) return;
    const point = rollPointFromEvent(event);
    state.rollNotes.push({ id: uid('bass-roll'), start: point.start, pitch: point.pitch, duration: ROLL_STEP, velocity: 88 });
    state.rollReady = true;
    state.rollDirty = true;
    render();
  }
  function deleteRollNote(event) {
    const block = event.target.closest('.bass-roll-note');
    if (!block) return;
    event.preventDefault();
    state.rollNotes = state.rollNotes.filter(note => note.id !== block.dataset.noteId);
    state.rollDirty = true;
    render();
  }
  function resetRoll() {
    syncRollFromSequence(readProject());
    status('Restored the generated bass phrase.');
    render();
  }
  function parseDuration(text) { const fraction = String(text).trim().match(/^1\s*\/\s*(1|2|4|8|16)$/); if (fraction) return 4 / Number(fraction[1]); const numeric = Number(text); return Number.isFinite(numeric) && numeric > 0 ? numeric : null; }
  function processPastedNotes() {
    const raw = $('#bassTextInput').value.trim();
    if (!raw) { status('Paste notes first.'); return; }
    const matcher = /(R|[A-Ga-g](?:[#b♯♭])?-?\d+)\s*\(\s*([^)]*)\s*\)/g;
    let match, last = 0, total = 0;
    const tokens = [];
    while ((match = matcher.exec(raw))) {
      const gap = raw.slice(last, match.index).trim();
      if (gap && !/^[,|\s]+$/.test(gap)) { status('Could not read the pasted text.'); return; }
      last = matcher.lastIndex;
      const duration = parseDuration(match[2]);
      if (!duration) { status('Use durations like 1/4, 1/8, 1/2 or 1/16.'); return; }
      tokens.push([match[1], duration]); total += duration;
    }
    if (!tokens.length || raw.slice(last).trim()) { status('Use notes like Ab1(1/4), separated by spaces.'); return; }
    const phrase = total <= 8 ? 8 : total <= 16 ? 16 : total <= 32 ? 32 : 0;
    if (!phrase) { status('Pasted phrases can be up to 32 beats.'); return; }
    state.phrase = phrase; state.sequence = Array(stepCount()).fill(null);
    let beat = 0;
    for (const [token, duration] of tokens) {
      const index = Math.round(beat / 0.25); const tie = Math.max(1, Math.round(duration / 0.25));
      if (token !== 'R') {
        const parsed = token.replace('♭','b').replace('♯','#').match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
        if (!parsed) { status(`Could not read ${token}.`); return; }
        const pitchClass = NOTE_PCS[`${parsed[1].toUpperCase()}${parsed[2]}`];
        if (pitchClass === undefined) { status(`Could not read ${token}.`); return; }
        state.sequence[index] = cell('absolute', (Number(parsed[3]) + 1) * 12 + pitchClass, 2, tie);
      }
      beat += duration;
    }
    state.manual = true; syncRollFromSequence(readProject()); status(`Processed ${tokens.length} token${tokens.length === 1 ? '' : 's'}.`); render();
  }

  function adjustRollZoom(direction) {
    state.rollZoom = clamp(Math.round((state.rollZoom + direction * 0.25) * 100) / 100, 0.75, 1.75);
    render();
  }
  function updateRollPlayhead(progress, follow) {
    const playhead = $('#bassRollPlayhead');
    const scroll = $('#bassRollScroll');
    if (!playhead || !scroll) return;
    const { stepWidth } = rollMetrics();
    const width = Math.round(state.phrase / ROLL_STEP) * stepWidth;
    const x = clamp(progress, 0, 1) * width;
    playhead.hidden = !playback.active;
    playhead.style.left = `${Math.round(x)}px`;
    if (!follow) return;
    const target = ROLL_LABEL_WIDTH + x;
    const leftEdge = scroll.scrollLeft + 56;
    const rightEdge = scroll.scrollLeft + scroll.clientWidth - 72;
    if (target < leftEdge || target > rightEdge) {
      scroll.scrollLeft = clamp(target - scroll.clientWidth * 0.5, 0, Math.max(0, scroll.scrollWidth - scroll.clientWidth));
    }
  }
  function startRollPlayhead(totalSeconds, phraseSeconds) {
    cancelAnimationFrame(playback.playheadFrame);
    const startedAt = performance.now() + 60;
    const frame = now => {
      if (!playback.active) return;
      const elapsed = Math.max(0, (now - startedAt) / 1000);
      playback.playheadProgress = phraseSeconds > 0 ? (elapsed % phraseSeconds) / phraseSeconds : 0;
      updateRollPlayhead(playback.playheadProgress, true);
      if (elapsed < totalSeconds) playback.playheadFrame = requestAnimationFrame(frame);
    };
    playback.playheadFrame = requestAnimationFrame(frame);
  }

  function ensureAudio() {
    if (playback.context) { if (playback.context.state === 'suspended') playback.context.resume().catch(() => {}); return playback.context; }
    const AudioContextApi = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextApi) return null;
    playback.context = new AudioContextApi(); playback.gain = playback.context.createGain(); playback.gain.gain.value = 0.78; playback.gain.connect(playback.context.destination);
    return playback.context;
  }
  async function loadPlayer() {
    const context = ensureAudio();
    if (!context || !window.Soundfont) return null;

    const instrument = state.instrument;
    if (playback.player && playback.instrument === instrument) return playback.player;

    const request = ++playback.instrumentRequest;
    try {
      const player = await window.Soundfont.instrument(context, SOUNDFONTS[instrument], {
        soundfont: 'MusyngKite', format: 'mp3', destination: playback.gain, gain: 0.94
      });
      if (request !== playback.instrumentRequest || instrument !== state.instrument) return null;
      playback.player = player;
      playback.instrument = instrument;
      return player;
    } catch (_) {
      return null;
    }
  }
  function stopPreview() {
    playback.request += 1;
    playback.pending = false;
    clearTimeout(playback.timer);
    cancelAnimationFrame(playback.playheadFrame);
    playback.playheadFrame = 0;
    playback.playheadProgress = 0;
    playback.nodes.splice(0).forEach(node => { try { node.stop(); } catch (_) {} });
    playback.nodes = [];
    playback.active = false;
    updateRollPlayhead(0, false);
    renderPreviewControls();
  }
  function startPreviewCycle(result, seconds) {
    if (!playback.active) return;
    clearTimeout(playback.timer);
    playback.nodes = [];
    const now = playback.context.currentTime + 0.06;
    const cycleSeconds = 32 * seconds;
    startRollPlayhead(cycleSeconds, state.phrase * seconds);
    result.notes.filter(note => note.start < result.insertAt + 32).forEach(note => {
      try {
        const node = playback.player.play(note.pitch, now + (note.start - result.insertAt) * seconds, {
          duration: Math.max(0.08, note.duration * seconds),
          gain: clamp(note.velocity / 127, 0.15, 0.95),
          attack: 0.008,
          release: 0.16
        });
        if (node && node.stop) playback.nodes.push(node);
      } catch (_) {}
    });
    playback.timer = window.setTimeout(() => {
      if (!playback.active) return;
      if (state.loopPreview) startPreviewCycle(result, seconds);
      else stopPreview();
    }, Math.round(cycleSeconds * 1000 + 260));
  }
  function restartPreviewIfRunning() {
    if (!playback.active && !playback.pending) return;
    stopPreview();
    window.setTimeout(() => preview(), 0);
  }
  async function preview() {
    if (playback.active || playback.pending) stopPreview();

    const request = ++playback.request;
    const tempo = clamp(Number($('#bassTempo').value) || state.tempo, 30, 260);
    state.tempo = tempo;
    playback.pending = true;
    renderPreviewControls();
    const project = { ...readProject(), bpm: tempo };
    const player = await loadPlayer();
    if (request !== playback.request) return;
    playback.pending = false;
    if (!player) { status('Preview sound could not load.'); renderPreviewControls(); return; }

    const result = buildPlan(project);
    const seconds = secondsPerBeat(project);
    playback.active = true;
    renderPreviewControls();
    startPreviewCycle(result, seconds);
  }
  function addToTimeline() {
    const project = readProject();
    const tempo = clamp(Number($('#bassTempo').value) || state.tempo, 30, 260);
    const result = buildPlan({ ...project, bpm: tempo });
    if (!result.notes.length) { status('Add at least one triggered step first.'); return; }
    saveHistory(project);
    project.bpm = tempo;
    state.tempo = tempo;
    let track = project.tracks.find(item => /bass/i.test(item.name));
    if (!track) { track = { id: uid('track'), name: 'Bass', instrument: SAVED_INSTRUMENTS[state.instrument], color: COLORS[0], muted: false, solo: false, hidden: false, notes: [] }; project.tracks.push(track); }
    track.instrument = SAVED_INSTRUMENTS[state.instrument]; track.notes.push(...result.notes); saveProject(project);
    sessionStorage.setItem(TOAST_KEY, `Added ${result.groups.length} bass group${result.groups.length === 1 ? '' : 's'} to the timeline at ${tempo} BPM.`); window.location.reload();
  }

  function makeWindowDraggable() {
    const card = $('#bassModalCard'), dragTitle = $('#bassModalDragTitle'), grip = $('#bassResizeGrip');
    if (!card || !dragTitle || !grip) return;

    const pinCurrentPosition = rect => {
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
      const startX = event.clientX, startY = event.clientY;
      const offsetX = startX - rect.left, offsetY = startY - rect.top;
      let dragging = false;
      dragTitle.setPointerCapture?.(event.pointerId);

      const move = moveEvent => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        if (!dragging) {
          if (Math.hypot(deltaX, deltaY) < 6) return;
          dragging = true;
          pinCurrentPosition(rect);
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
      const rect = card.getBoundingClientRect(); const startX = event.clientX, startY = event.clientY;
      pinCurrentPosition(rect);
      grip.classList.add('resizing');
      const move = moveEvent => {
        card.style.width = `${clamp(rect.width + moveEvent.clientX - startX, 690, window.innerWidth - 20)}px`;
        card.style.height = `${clamp(rect.height + moveEvent.clientY - startY, 520, window.innerHeight - 20)}px`;
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
  function setMode(mode) {
    state.mode = mode === 'emotion' ? 'emotion' : 'genre';
    if (state.mode === 'emotion') loadEmotion(); else loadGenre();
    syncRollFromSequence(readProject());
    render();
  }
  function bind() {
    document.addEventListener('click', event => { const trigger = event.target.closest('#quickBass'); if (!trigger) return; event.preventDefault(); event.stopImmediatePropagation(); openModal(); }, true);
    $('#bassClose').addEventListener('click', closeModal);
    $('#bassPreview').addEventListener('click', preview);
    $('#bassStop').addEventListener('click', stopPreview);
    $('#bassLoop').addEventListener('click', () => { state.loopPreview = !state.loopPreview; renderPreviewControls(); });
    $('#bassAdd').addEventListener('click', addToTimeline);
    $('#bassProcess').addEventListener('click', processPastedNotes);
    $('#bassModeTabs').addEventListener('click', event => { const button = event.target.closest('.bass-mode-tab'); if (button) setMode(button.dataset.mode); });
    $('#bassLoadProfile').addEventListener('click', () => { if (state.mode === 'genre') { state.genreId = Number($('#bassProfileSelect').value); loadGenre(); } else { state.emotionId = $('#bassProfileSelect').value; loadEmotion(); } syncRollFromSequence(readProject()); render(); });
    $('#bassRandomProfile').addEventListener('click', () => { if (state.mode === 'genre') { state.genreId = pick(genres).id; loadGenre(); } else { state.emotionId = pick(Object.keys(emotions)); loadEmotion(); } syncRollFromSequence(readProject()); render(); });
    $('#bassMutate').addEventListener('click', () => { if (state.mode === 'genre') mutateGenre(); else loadEmotion(); syncRollFromSequence(readProject()); render(); });
    $('#bassLength').addEventListener('input', event => { state.units = Number(event.target.value); render(); });
    let tempoRestartTimer = 0;
    const updateBassTempo = value => {
      const tempo = Number(value);
      if (!Number.isFinite(tempo) || tempo < 30 || tempo > 260) return false;
      state.tempo = tempo;
      return true;
    };
    const scheduleTempoPreviewRestart = () => {
      if (!playback.active && !playback.pending) return;
      clearTimeout(tempoRestartTimer);
      tempoRestartTimer = window.setTimeout(restartPreviewIfRunning, 180);
    };
    $('#bassTempo').addEventListener('input', event => {
      if (updateBassTempo(event.target.value)) scheduleTempoPreviewRestart();
    });
    $('#bassTempo').addEventListener('change', event => {
      const requested = Number(event.target.value);
      state.tempo = clamp(Number.isFinite(requested) ? requested : state.tempo, 30, 260);
      event.target.value = String(state.tempo);
      clearTimeout(tempoRestartTimer);
      restartPreviewIfRunning();
    });
    $('#bassMutationRate').addEventListener('input', event => { state.mutation = Number(event.target.value); $('#bassMutationOutput').textContent = `${state.mutation}% mutation`; });
    $('#bassHarmonySource').addEventListener('change', event => { state.source = event.target.value; if (!state.rollDirty) syncRollFromSequence(readProject()); render(); });
    $('#bassInstrument').addEventListener('change', event => {
      state.instrument = event.target.value;
      restartPreviewIfRunning();
    });
    $('#bassRegister').addEventListener('change', event => { const previous = state.register; state.register = Number(event.target.value); shiftRollRegister(previous, state.register); state.rollViewportPending = true; render(); });
    $('#bassPhraseChoices').addEventListener('click', event => { const button = event.target.closest('.bass-phrase'); if (!button) return; state.phrase = Number(button.dataset.b); if (state.mode === 'emotion') loadEmotion(); else loadGenre(); syncRollFromSequence(readProject()); render(); });
    [['bassSustain','sustain'],['bassEcho','echo'],['bassChords','chords']].forEach(([id, key]) => $(`#${id}`).addEventListener('click', () => { state.effects[key] = !state.effects[key]; stopPreview(); render(); }));
    $('#bassResetRoll').addEventListener('click', resetRoll);
    $('#bassRollZoomOut').addEventListener('click', () => adjustRollZoom(-1));
    $('#bassRollZoomIn').addEventListener('click', () => adjustRollZoom(1));
    $('#bassRollGrid').addEventListener('pointerdown', addRollNote);
    $('#bassRollGrid').addEventListener('pointerdown', event => { const block = event.target.closest('.bass-roll-note'); if (block) beginRollEdit(event, block); });
    $('#bassRollGrid').addEventListener('contextmenu', deleteRollNote);
    makeWindowDraggable();
  }
  loadGenre(); bind();
})();
