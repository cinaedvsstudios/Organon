(() => {
  'use strict';

  const STEP = 0.25;
  const NOTE_PCS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mod = (value, base) => ((value % base) + base) % base;
  const randomPick = (items, random) => items[Math.floor(random() * items.length)];

  const GENRES = [
    { id: 'spark', name: 'Spark Runner', dna: 'R(1/4) 5(1/4) Oct(1/2) 3(1/4) 5(1/4) R(1/2)', pool: [0, 2, 4, 5, 7, 9, 12] },
    { id: 'glass', name: 'Glass Arpeggio', dna: 'R(1/8) 3(1/8) 5(1/4) Oct(1/2) 5(1/4) 3(1/4) R(1/2)', pool: [0, 3, 4, 7, 12] },
    { id: 'night', name: 'Night Pulse', dna: 'R(1/2) 5(1/4) 3(1/4) R(1/4) 7(1/4) Oct(1/2)', pool: [0, 2, 3, 5, 7, 10, 12] },
    { id: 'theatre', name: 'Theatre Lift', dna: 'R(1/4) 3(1/4) 5(1/4) Oct(1/4) 5(1/4) 3(1/4) 2(1/4) R(1/4)', pool: [0, 2, 4, 5, 7, 9, 12] },
    { id: 'glide', name: 'Silver Glide', dna: 'R(1/2) 2(1/4) 3(1/4) 5(1/2) 3(1/4) R(1/4)', pool: [0, 2, 3, 4, 5, 7, 8, 12] },
    { id: 'signal', name: 'Signal Hook', dna: '5(1/4) R(1/4) 5(1/4) Oct(1/4) 5(1/2) 3(1/4) R(1/4)', pool: [0, 3, 4, 5, 7, 10, 12] },
    { id: 'waltz', name: 'Ribbon Waltz', dna: 'R(1/4) 3(1/4) 5(1/4) 3(1/4) R(1/2) 2(1/4) 3(1/4)', pool: [0, 2, 3, 4, 5, 7, 9, 12] },
    { id: 'flare', name: 'Neon Flare', dna: 'Oct(1/4) 5(1/4) 3(1/4) 5(1/4) Oct(1/2) R(1/2)', pool: [0, 2, 4, 5, 7, 9, 12] }
  ];

  const EMOTIONS = {
    aspirational: { name: 'Aspirational', dna: 'R(1/2) 3(1/4) 5(1/4) Oct(1/2) 5(1/4) 3(1/4)', pool: [0, 2, 4, 5, 7, 9, 12] },
    romantic: { name: 'Romantic / Yearning', dna: 'R(1/4) 2(1/4) 3(1/2) 5(1/4) 3(1/4) 2(1/4) R(1/4)', pool: [0, 2, 3, 4, 5, 7, 8, 12] },
    showstopping: { name: 'Showstopping', dna: 'R(1/4) 5(1/4) Oct(1/4) 5(1/4) 3(1/4) 5(1/4) Oct(1/2)', pool: [0, 4, 5, 7, 9, 12] },
    scheming: { name: 'Scheming', dna: 'R(1/2) b3(1/4) b5(1/4) 5(1/2) b3(1/4) R(1/4)', pool: [0, 1, 3, 5, 6, 7, 10, 12] },
    effervescent: { name: 'Effervescent', dna: '5(1/8) Oct(1/8) 5(1/4) 3(1/4) 5(1/4) Oct(1/2)', pool: [0, 2, 4, 5, 7, 9, 12] }
  };

  const SECTION_SETTINGS = {
    hook: { name: 'Hook', restChance: 0.04, repeat: true, octaveChance: 0.32, transposeChance: 0.08, velocity: 106 },
    verse: { name: 'Verse', restChance: 0.24, repeat: false, octaveChance: 0.08, transposeChance: 0.22, velocity: 86 },
    chorus: { name: 'Chorus', restChance: 0.06, repeat: true, octaveChance: 0.48, transposeChance: 0.18, velocity: 112 },
    bridge: { name: 'Bridge', restChance: 0.30, repeat: false, octaveChance: 0.18, transposeChance: 0.42, velocity: 94 }
  };

  function parseDuration(text) {
    const match = String(text).trim().match(/^1\s*\/\s*(1|2|4|8|16)$/);
    return match ? 4 / Number(match[1]) : null;
  }

  function parseDNA(dna) {
    const tokens = [];
    const matcher = /(R|Oct|b?[1-7])\s*\(\s*([^)]*)\s*\)/gi;
    let match;
    while ((match = matcher.exec(String(dna || '')))) {
      const duration = parseDuration(match[2]);
      if (!duration) continue;
      tokens.push({ token: match[1], duration });
    }
    return tokens.length ? tokens : [{ token: 'R', duration: 1 }];
  }

  function expandToPhrase(tokens, phraseBeats) {
    const output = [];
    let position = 0;
    let index = 0;
    const safePhrase = Math.max(1, Number(phraseBeats) || 8);
    while (position < safePhrase - 0.0001) {
      const source = tokens[index % tokens.length];
      const duration = Math.min(source.duration, safePhrase - position);
      output.push({ token: source.token, start: position, duration });
      position += duration;
      index += 1;
    }
    return output;
  }

  function mutateRhythm(events, amount, random) {
    const output = events.map(event => ({ ...event }));
    const chance = clamp(Number(amount) || 0, 0, 100) / 100;
    for (let index = 0; index < output.length; index += 1) {
      const event = output[index];
      if (random() >= chance || event.duration < STEP * 2) continue;
      if (random() < 0.58) {
        const half = event.duration / 2;
        output.splice(index, 1,
          { ...event, duration: half },
          { ...event, start: event.start + half, duration: half, token: event.token === 'R' ? 'R' : event.token, mutation: 'split' }
        );
        index += 1;
      } else if (index + 1 < output.length && Math.abs((event.start + event.duration) - output[index + 1].start) < 0.0001) {
        const next = output[index + 1];
        event.duration += next.duration;
        output.splice(index + 1, 1);
      }
    }
    let position = 0;
    return output.map(event => {
      const normalized = { ...event, start: position };
      position += normalized.duration;
      return normalized;
    });
  }

  function keyRoot(project) {
    const name = String(project?.key || 'C').replace(/\s.*$/, '').replace('♭', 'b').replace('♯', '#');
    return NOTE_PCS[name] ?? 0;
  }

  function isMinor(project) { return /minor/i.test(String(project?.key || '')); }

  function guideRootAt(project, beat) {
    const guideId = project?.motifHarmonySource;
    if (!guideId || guideId === 'key') return keyRoot(project);
    const track = (project?.tracks || []).find(item => item.id === guideId && Array.isArray(item.notes));
    if (!track) return keyRoot(project);
    const active = track.notes.filter(note => {
      const start = Number(note.start) || 0;
      const duration = Number(note.duration) || 0;
      return start <= beat + 0.0001 && start + duration > beat + 0.0001;
    });
    if (!active.length) return keyRoot(project);
    return mod(Math.min(...active.map(note => Number(note.pitch) || 60)), 12);
  }

  function scalePitchClasses(project, beat = 0) {
    const tonic = guideRootAt(project, beat);
    const intervals = isMinor(project) ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    return intervals.map(interval => mod(tonic + interval, 12));
  }

  function tokenInterval(token, project) {
    const minor = isMinor(project);
    const map = {
      R: 0, '1': 0, '2': 2, '3': minor ? 3 : 4, '4': 5, '5': 7, '6': minor ? 8 : 9, '7': minor ? 10 : 11,
      b3: 3, b5: 6, Oct: 12
    };
    return map[token] ?? 0;
  }

  function bassAt(project, beat) {
    const bassTracks = (project?.tracks || []).filter(track => /bass/i.test(String(track.name || '')) && Array.isArray(track.notes));
    const active = bassTracks.flatMap(track => track.notes || []).filter(note => {
      const start = Number(note.start) || 0;
      const duration = Number(note.duration) || 0;
      return start <= beat + 0.0001 && start + duration > beat + 0.0001;
    });
    if (!active.length) return null;
    active.sort((a, b) => (Number(a.pitch) || 0) - (Number(b.pitch) || 0));
    return active[0];
  }

  function nearestScalePitch(target, project, min, max, beat = 0) {
    const pcs = scalePitchClasses(project, beat);
    let best = clamp(Math.round(target), min, max);
    let bestDistance = Infinity;
    for (let pitch = min; pitch <= max; pitch += 1) {
      if (!pcs.includes(mod(pitch, 12))) continue;
      const distance = Math.abs(pitch - target);
      if (distance < bestDistance) { best = pitch; bestDistance = distance; }
    }
    return best;
  }

  function fitRegister(pitch, register, minimum) {
    const registerBase = Number(register) || 60;
    const min = registerBase - 12;
    const max = registerBase + 35;
    let output = pitch;
    while (output < min) output += 12;
    while (output > max) output -= 12;
    while (output - minimum < 12) output += 12;
    while (output > 96) output -= 12;
    return clamp(output, 36, 96);
  }

  function chooseLinkedPitch({ project, event, absoluteBeat, register, pool, random }) {
    const bass = bassAt(project, absoluteBeat);
    if (!bass) return null;
    const bassPitch = Number(bass.pitch) || 36;
    const third = isMinor(project) ? 3 : 4;
    const preferred = random() < 0.7 ? randomPick([third, 7], random) : randomPick(pool, random);
    const octaveOffset = register >= 72 ? 36 : 24;
    return fitRegister(bassPitch + preferred + octaveOffset, register, bassPitch);
  }

  function chooseUnlinkedPitch({ project, event, register, pool, random, absoluteBeat }) {
    const root = guideRootAt(project, absoluteBeat);
    const source = event.token === 'R' ? randomPick(pool, random) : tokenInterval(event.token, project);
    const base = register + mod(root - mod(register, 12), 12);
    const proposed = base + source + (random() < 0.16 ? 12 : 0);
    return nearestScalePitch(proposed, project, register - 12, register + 35, absoluteBeat);
  }

  function applySectionCharacter(events, sectionType, project, pool, random) {
    const settings = SECTION_SETTINGS[sectionType] || SECTION_SETTINGS.hook;
    const output = [];
    events.forEach((event, index) => {
      const next = { ...event };
      if (next.token !== 'R' && random() < settings.restChance) next.token = 'R';
      if (next.token !== 'R' && random() < settings.transposeChance) next.token = String(randomPick(['2', '3', '4', '5', '6', '7'], random));
      if (next.token !== 'R' && random() < settings.octaveChance) next.forceOctave = true;
      next.velocity = settings.velocity + (index % 4 === 0 ? 8 : 0);
      output.push(next);
    });

    if (settings.repeat && output.length > 3) {
      const half = Math.floor(output.length / 2);
      for (let index = half; index < output.length; index += 1) {
        const origin = output[index - half];
        if (origin && origin.token !== 'R' && random() < 0.58) output[index].token = origin.token;
      }
    }
    return output;
  }

  function generate(options = {}) {
    const project = options.project || { key: 'D minor', tracks: [] };
    const mode = options.mode === 'emotion' ? 'emotion' : 'genre';
    const profile = mode === 'emotion' ? (EMOTIONS[options.profileId] || EMOTIONS.aspirational) : (GENRES.find(item => item.id === options.profileId) || GENRES[0]);
    const random = typeof options.random === 'function' ? options.random : Math.random;
    const phrase = clamp(Number(options.phrase) || 8, 4, 32);
    const sectionType = options.sectionType || 'hook';
    const register = clamp(Number(options.register) || 60, 48, 72);
    const referenceStart = Math.max(0, Number(options.referenceStart) || 0);
    const baseEvents = expandToPhrase(parseDNA(profile.dna), phrase);
    const mutated = mutateRhythm(baseEvents, options.mutation, random);
    const styled = applySectionCharacter(mutated, sectionType, project, profile.pool, random);
    const notes = [];

    styled.forEach((event, index) => {
      if (event.token === 'R') return;
      const absoluteBeat = referenceStart + event.start;
      let pitch = options.bassLink ? chooseLinkedPitch({ project, event, absoluteBeat, register, pool: profile.pool, random }) : null;
      if (pitch === null) pitch = chooseUnlinkedPitch({ project, event, register, pool: profile.pool, random, absoluteBeat });
      if (event.forceOctave) pitch = clamp(pitch + 12, 36, 96);
      notes.push({
        id: `motif-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        start: Math.max(0, event.start),
        pitch: clamp(Math.round(pitch), 36, 96),
        duration: Math.max(STEP, event.duration),
        velocity: clamp(Math.round(event.velocity || 96), 40, 127)
      });
    });

    return { notes, phrase, profile, section: SECTION_SETTINGS[sectionType] || SECTION_SETTINGS.hook };
  }

  window.IhyMotifEngine = Object.freeze({
    STEP,
    GENRES,
    EMOTIONS,
    SECTION_SETTINGS,
    parseDNA,
    generate,
    scalePitchClasses,
    guideRootAt
  });
})();
