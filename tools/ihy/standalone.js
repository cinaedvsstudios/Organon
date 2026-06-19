(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const STORAGE_KEY = 'ihy-v020';
  const BASE_BEAT = 40;
  const ROW_HEIGHT = 24;
  const LOW_PITCH = 48;
  const HIGH_PITCH = 84;
  const MIN_BEATS = 64;

  const COLORS = ['#b68cff', '#60c6a4', '#dfb658', '#dc7898', '#79b4e3'];
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const KEYBOARD_MAP = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72 };

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
  const createNote = (start, pitch, duration = 1, velocity = 92) => ({ id: uid(), start, pitch, duration, velocity });
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

  function createBlankProject() {
    return {
      title: 'Untitled cue',
      bpm: 92,
      key: 'D minor',
      sections: [],
      tracks: [{
        id: uid(),
        name: 'Piano',
        instrument: 'grand_piano',
        color: COLORS[0],
        muted: false,
        solo: false,
        notes: []
      }]
    };
  }

  function normaliseProject(raw) {
    const fallback = createBlankProject();
    if (!raw || !Array.isArray(raw.tracks) || !raw.tracks.length) return fallback;

    return {
      title: String(raw.title || fallback.title),
      bpm: clamp(Number(raw.bpm) || 92, 30, 260),
      key: SCALE_MAP[raw.key] ? raw.key : 'D minor',
      sections: Array.isArray(raw.sections)
        ? raw.sections.map((section, index) => ({
            id: section.id || uid(),
            name: String(section.name || `Section ${index + 1}`),
            start: Math.max(0, Number(section.start) || 0),
            end: Math.max(1, Number(section.end) || 8),
            color: section.color || COLORS[index % COLORS.length]
          }))
        : [],
      tracks: raw.tracks.map((track, index) => ({
        id: track.id || uid(),
        name: String(track.name || `Track ${index + 1}`),
        instrument: INSTRUMENTS.some(([id]) => id === track.instrument) ? track.instrument : 'grand_piano',
        color: track.color || COLORS[index % COLORS.length],
        muted: Boolean(track.muted),
        solo: Boolean(track.solo),
        notes: Array.isArray(track.notes)
          ? track.notes.map(note => ({
              id: note.id || uid(),
              start: Math.max(0, Number(note.start) || 0),
              pitch: clamp(Number(note.pitch) || 60, LOW_PITCH, HIGH_PITCH),
              duration: Math.max(0.125, Number(note.duration) || 1),
              velocity: clamp(Number(note.velocity) || 92, 1, 127)
            })).sort((a, b) => a.start - b.start || a.pitch - b.pitch)
          : []
      }))
    };
  }

  let project;
  try {
    project = normaliseProject(JSON.parse(
      localStorage.getItem(STORAGE_KEY)
      || localStorage.getItem('ihy-v019')
      || localStorage.getItem('ihy-v018')
      || localStorage.getItem('ihy-v014')
      || 'null'
    ));
  } catch (_) {
    project = createBlankProject();
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
  let audioContext = null;
  let masterGain = null;
  let scheduledCleanups = [];
  const pressedKeys = new Set();

  const getTrack = id => project.tracks.find(track => track.id === id);
  const activeTrack = () => getTrack(activeTrackId);
  const secondsPerBeat = () => 60 / clamp(Number(project.bpm) || 92, 30, 260);
  const snap = value => {
    const unit = Number($('#quant').value || 0.25);
    return Math.round(value / unit) * unit;
  };

  function compositionLength() {
    let end = MIN_BEATS;
    project.sections.forEach(section => { end = Math.max(end, section.end); });
    project.tracks.forEach(track => track.notes.forEach(note => {
      end = Math.max(end, note.start + note.duration);
    }));
    return Math.max(MIN_BEATS, Math.ceil(end / 4) * 4);
  }

  function syncMeta() {
    project.title = $('#title').value.trim() || 'Untitled cue';
    project.bpm = clamp(Number($('#bpm').value) || 92, 30, 260);
    project.key = SCALE_MAP[$('#key').value] ? $('#key').value : 'D minor';
  }

  function showStatus(message = '', timeout = 3200) {
    const target = $('#status');
    target.textContent = message;
    clearTimeout(showStatus.timer);
    if (message && timeout) {
      showStatus.timer = setTimeout(() => {
        if (target.textContent === message) target.textContent = '';
      }, timeout);
    }
  }

  function saveProject(silent = false) {
    syncMeta();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    if (!silent) showStatus(`Saved “${project.title}”.`);
  }

  function setView(name) {
    $$('.view').forEach(view => {
      view.classList.toggle('active', view.id === `${name}View`);
    });
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
      row.innerHTML = `
        <span class="swatch" style="background:${track.color}"></span>
        <button class="btn track-arm" data-arm="${track.id}">${escapeHtml(track.name)}</button>
        <span class="instrument">${escapeHtml(instrumentName(track.instrument))}</span>
        <span class="track-actions">
          <button class="btn" data-mute="${track.id}" aria-pressed="${track.muted}">M</button>
          <button class="btn" data-solo="${track.id}" aria-pressed="${track.solo}">S</button>
        </span>
      `;
      list.append(row);
    });

    const instrument = $('#instrument');
    instrument.replaceChildren(...INSTRUMENTS.map(([id, name]) => new Option(name, id)));
    instrument.value = activeTrack().instrument;
  }

  function renderTimeline() {
    const host = $('#arrangement');
    const total = compositionLength();
    host.replaceChildren();
    host.style.width = `${total * beatWidth}px`;

    const playhead = document.createElement('div');
    playhead.id = 'arrangementPlayhead';
    playhead.className = 'arrangement-playhead';
    playhead.style.left = `${playheadBeat * beatWidth}px`;
    host.append(playhead);

    const sections = project.sections.length
      ? project.sections
      : [{ id: 'main', name: 'Main Track', start: 0, end: total, color: '#dfb658', readonly: true }];

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
    const total = compositionLength();
    labels.replaceChildren();
    roll.replaceChildren();
    roll.style.width = `${total * beatWidth}px`;

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

    project.tracks.forEach(track => track.notes.forEach(note => {
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
    const toClock = seconds => {
      const whole = Math.max(0, Math.round(seconds));
      return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
    };
    $('#transportTime').textContent = `${toClock(playheadBeat * secondsPerBeat())} / ${toClock(compositionLength() * secondsPerBeat())}`;
  }

  function setPlayhead(beat, follow = false) {
    playheadBeat = clamp(beat, 0, compositionLength());
    const left = `${playheadBeat * beatWidth}px`;
    const rollPlayhead = $('#playhead');
    const timelinePlayhead = $('#arrangementPlayhead');
    if (rollPlayhead) rollPlayhead.style.left = left;
    if (timelinePlayhead) timelinePlayhead.style.left = left;
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
    const Api = window.AudioContext || window.webkitAudioContext;
    if (!Api) return null;
    audioContext = new Api();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.68;
    masterGain.connect(audioContext.destination);
    return audioContext;
  }

  function waveformFor(instrument) {
    if (['cello', 'strings', 'horn', 'electric_bass'].includes(instrument)) return 'sawtooth';
    if (['retro_lead', 'drum_kit'].includes(instrument)) return 'square';
    if (['flute', 'choir', 'warm_pad', 'bell'].includes(instrument)) return 'sine';
    return 'triangle';
  }

  function playTone(instrument, pitch, velocity, duration, at) {
    const context = ensureAudio();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = at ?? context.currentTime;
    const intensity = clamp((velocity || 92) / 127, 0.08, 1);
    const realDuration = Math.max(0.08, duration);

    oscillator.type = waveformFor(instrument);
    oscillator.frequency.setValueAtTime(
      instrument === 'drum_kit' ? 120 : 440 * Math.pow(2, (pitch - 69) / 12),
      start
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12 * intensity, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + realDuration);
    oscillator.connect(gain).connect(masterGain);
    oscillator.start(start);
    oscillator.stop(start + realDuration + 0.06);

    scheduledCleanups.push(() => {
      try {
        oscillator.stop();
        oscillator.disconnect();
        gain.disconnect();
      } catch (_) {}
    });
  }

  function glowKey(pitch, delay, duration) {
    const begin = setTimeout(() => {
      const key = $(`.key[data-pitch="${pitch}"]`);
      key?.classList.add('playing');
      const end = setTimeout(() => key?.classList.remove('playing'), Math.max(80, duration));
      scheduledCleanups.push(() => clearTimeout(end));
    }, Math.max(0, delay));
    scheduledCleanups.push(() => clearTimeout(begin));
  }

  function stopPlayback(reset = false) {
    playing = false;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    scheduledCleanups.splice(0).forEach(cleanup => cleanup());
    $$('.key.playing').forEach(key => key.classList.remove('playing'));
    $('#play').textContent = '▶ Play';
    if (reset) setPlayhead(0);
  }

  function animatePlayback() {
    if (!playing) return;
    const beat = playbackStartBeat + ((performance.now() - playbackStartedAt) / 1000) / secondsPerBeat();

    if (beat >= compositionLength()) {
      stopPlayback(true);
      showStatus('Playback reached the end.');
      return;
    }

    setPlayhead(beat, true);
    animationFrame = requestAnimationFrame(animatePlayback);
  }

  function togglePlay() {
    if (playing) {
      stopPlayback(false);
      showStatus('Playback paused.');
      return;
    }

    syncMeta();
    const context = ensureAudio();
    if (!context) return;

    const startBeat = playheadBeat;
    const startAt = context.currentTime + 0.05;
    const soloActive = project.tracks.some(track => track.solo);
    const audibleTracks = project.tracks.filter(track => !track.muted && (!soloActive || track.solo));

    audibleTracks.forEach(track => track.notes.forEach(note => {
      const noteEnd = note.start + note.duration;
      if (noteEnd <= startBeat) return;

      const actualStart = Math.max(startBeat, note.start);
      const delay = (actualStart - startBeat) * secondsPerBeat();
      const duration = (noteEnd - actualStart) * secondsPerBeat();

      playTone(track.instrument, note.pitch + Number($('#transpose').value || 0), note.velocity, duration, startAt + delay);
      glowKey(note.pitch, delay * 1000, duration * 1000);
    }));

    if (metronomeEnabled) {
      for (let beat = Math.ceil(startBeat); beat < compositionLength(); beat += 1) {
        const delay = (beat - startBeat) * secondsPerBeat();
        playTone('bell', beat % 4 === 0 ? 84 : 76, 48, 0.06, startAt + delay);
      }
    }

    playing = true;
    playbackStartedAt = performance.now() + 50;
    playbackStartBeat = startBeat;
    $('#play').textContent = '⏸ Pause';
    animationFrame = requestAnimationFrame(animatePlayback);
  }

  function playPitch(pitch, beats = 0.5) {
    const context = ensureAudio();
    if (!context) return;
    const duration = beats * secondsPerBeat();
    playTone(activeTrack().instrument, pitch + Number($('#transpose').value || 0), 96, duration, context.currentTime + 0.02);
    glowKey(pitch, 15, duration * 1000);
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
    return [root, scaleStep(root, 2, scale), scaleStep(root, 4, scale)]
      .filter(value => value >= LOW_PITCH && value <= HIGH_PITCH);
  }

  function addNoteAt(event) {
    const box = $('#roll').getBoundingClientRect();
    const start = snap(clamp((event.clientX - box.left) / beatWidth, 0, compositionLength() - 0.125));
    const pitch = clamp(HIGH_PITCH - Math.floor((event.clientY - box.top) / ROW_HEIGHT), LOW_PITCH, HIGH_PITCH);
    const pitches = $('#chordToggle').classList.contains('on') ? chordFor(pitch) : [pitch];
    const notes = pitches.map(value => createNote(start, value));
    activeTrack().notes.push(...notes);
    selectedNoteId = notes[0].id;
    renderRoll();
  }

  function findNote(id) {
    for (const track of project.tracks) {
      const note = track.notes.find(item => item.id === id);
      if (note) return { track, note };
    }
    return null;
  }

  function newComposition() {
    if (!confirm('Start a new composition? Unsaved work will be replaced.')) return;
    project = createBlankProject();
    activeTrackId = project.tracks[0].id;
    selectedNoteId = null;
    playheadBeat = 0;
    render();
    showStatus('New composition ready.');
  }

  async function loadExample() {
    showStatus('Loading the piano example…', 0);
    try {
      const response = await fetch('./examples/potion_song_all_piano_v7.mid?v=0.20', { cache: 'no-store' });
      if (!response.ok) throw new Error('Example MIDI could not be read.');

      project = normaliseProject(parseMidi(await response.arrayBuffer(), 'Potion Song — Piano Example.mid'));
      project.title = 'Potion Song — Piano Example';
      project.sections = [];
      activeTrackId = project.tracks[0].id;
      selectedNoteId = null;
      playheadBeat = 0;
      render();
      showStatus('Loaded Potion Song — Piano Example.', 6000);
    } catch (error) {
      console.error(error);
      showStatus('Could not load the piano example.', 6000);
      alert(`Unable to load the piano example: ${error.message}`);
    }
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
    showStatus('Exported project JSON.');
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
    const text = size => {
      const value = String.fromCharCode(...data.slice(index, index + size));
      index += size;
      return value;
    };
    const u8 = () => data[index++];
    const u16 = () => (u8() << 8) | u8();
    const u32 = () => ((u8() * 0x1000000) + (u8() << 16) + (u8() << 8) + u8()) >>> 0;
    const vlq = () => {
      let value = 0;
      let byte;
      do {
        byte = u8();
        value = (value << 7) | (byte & 127);
      } while (byte & 128);
      return value;
    };

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
        let status = data[index];

        if (status < 128) {
          if (runningStatus === null) throw new Error('Invalid MIDI running status.');
          status = runningStatus;
        } else {
          index += 1;
          if (status < 240) runningStatus = status;
        }

        if (status === 255) {
          const type = u8();
          const size = vlq();
          const payload = data.slice(index, index + size);
          index += size;
          if (type === 3) name = String.fromCharCode(...payload);
          if (type === 81 && payload.length === 3) tempos.push((payload[0] << 16) | (payload[1] << 8) | payload[2]);
          continue;
        }

        if (status === 240 || status === 247) {
          index += vlq();
          continue;
        }

        const command = status & 240;
        channel = status & 15;
        const first = u8();
        const second = command === 192 || command === 208 ? null : u8();

        if (command === 192) {
          program = first;
          continue;
        }

        const key = `${channel}:${first}`;
        if (command === 144 && second > 0) {
          const stack = active.get(key) || [];
          stack.push({ tick, velocity: second });
          active.set(key, stack);
          continue;
        }

        if (command === 128 || (command === 144 && second === 0)) {
          const start = active.get(key)?.shift();
          if (start) notes.push(createNote(start.tick / division, first, Math.max(0.125, (tick - start.tick) / division), start.velocity));
        }
      }

      if (notes.length) {
        tracks.push({
          id: uid(),
          name: name || `MIDI track ${tracks.length + 1}`,
          instrument: gmInstrument(program, channel),
          color: COLORS[tracks.length % COLORS.length],
          muted: false,
          solo: false,
          notes: notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch)
        });
      }

      index = end;
    }

    if (!tracks.length) throw new Error('No MIDI note events were found.');
    return {
      title: fileName.replace(/\.(mid|midi)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported MIDI',
      bpm: Math.round(60000000 / (tempos[0] || 500000)),
      key: 'C major',
      sections: [],
      tracks
    };
  }

  async function importProject(file) {
    try {
      project = /\.(mid|midi)$/i.test(file.name)
        ? normaliseProject(parseMidi(await file.arrayBuffer(), file.name))
        : normaliseProject(JSON.parse(await file.text()));

      activeTrackId = project.tracks[0].id;
      selectedNoteId = null;
      playheadBeat = 0;
      render();
      showStatus(`Imported ${file.name}.`);
    } catch (error) {
      alert(`Unable to import this file: ${error.message}`);
      showStatus('Import failed.');
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

  $('#newProject').addEventListener('click', newComposition);
  $('#save').addEventListener('click', () => saveProject(false));
  $('#loadExample').addEventListener('click', loadExample);
  $('#createSound').addEventListener('click', () => setView('create'));
  $('#libraryButton').addEventListener('click', () => setView('library'));
  $('#analyseButton').addEventListener('click', () => setView('analyse'));
  $('#quickBass').addEventListener('click', () => openQuickAdd('Bass'));
  $('#quickMotif').addEventListener('click', () => openQuickAdd('Motif'));
  $('#quickAddClose').addEventListener('click', closeQuickAdd);
  $('#quickAddModal').addEventListener('click', event => {
    if (event.target === $('#quickAddModal')) closeQuickAdd();
  });
  $('#import').addEventListener('click', () => $('#file').click());
  $('#export').addEventListener('click', exportProject);
  $('#file').addEventListener('change', event => {
    if (event.target.files[0]) importProject(event.target.files[0]);
    event.target.value = '';
  });

  $('#title').addEventListener('change', syncMeta);
  $('#bpm').addEventListener('change', () => {
    syncMeta();
    updateTransport();
  });
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

  $('#metro').addEventListener('click', () => {
    metronomeEnabled = !metronomeEnabled;
    render();
    showStatus(metronomeEnabled ? 'Metronome enabled.' : 'Metronome disabled.');
  });

  $('#armed').addEventListener('change', event => {
    activeTrackId = event.target.value;
    selectedNoteId = null;
    renderTracks();
    renderRoll();
  });

  $('#instrument').addEventListener('change', event => {
    activeTrack().instrument = event.target.value;
    renderTracks();
    showStatus(`${activeTrack().name} now uses ${instrumentName(activeTrack().instrument)}.`);
  });

  $('#tracks').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.arm) {
      activeTrackId = button.dataset.arm;
      selectedNoteId = null;
      renderTracks();
      renderRoll();
      return;
    }

    if (button.dataset.mute) {
      const track = getTrack(button.dataset.mute);
      track.muted = !track.muted;
      renderTracks();
      return;
    }

    if (button.dataset.solo) {
      const track = getTrack(button.dataset.solo);
      track.solo = !track.solo;
      renderTracks();
    }
  });

  $('#addTrack').addEventListener('click', () => {
    const track = {
      id: uid(),
      name: `Track ${project.tracks.length + 1}`,
      instrument: 'grand_piano',
      color: COLORS[project.tracks.length % COLORS.length],
      muted: false,
      solo: false,
      notes: []
    };
    project.tracks.push(track);
    activeTrackId = track.id;
    selectedNoteId = null;
    render();
  });

  $('#addSection').addEventListener('click', () => {
    const name = prompt('Section name', `Section ${project.sections.length + 1}`);
    if (!name?.trim()) return;
    const start = project.sections.length ? project.sections[project.sections.length - 1].end : 0;
    project.sections.push({
      id: uid(),
      name: name.trim(),
      start,
      end: Math.min(compositionLength(), start + 8),
      color: COLORS[project.sections.length % COLORS.length]
    });
    renderTimeline();
  });

  $('#arrangement').addEventListener('click', event => {
    const sectionNode = event.target.closest('.arrangement-section');
    if (sectionNode?.disabled) return;

    if (sectionNode) {
      const section = project.sections.find(item => item.id === sectionNode.dataset.section);
      const name = prompt('Section name', section.name);
      if (name?.trim()) {
        section.name = name.trim();
        renderTimeline();
      }
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

  $('#rollScroll').addEventListener('scroll', () => {
    $('#arrangementViewport').scrollLeft = $('#rollScroll').scrollLeft;
  });

  $('#roll').addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const noteNode = event.target.closest('.note');

    if (!noteNode) {
      if (event.target === $('#roll')) addNoteAt(event);
      return;
    }

    event.preventDefault();
    const ref = findNote(noteNode.dataset.note);
    if (!ref) return;

    selectedNoteId = ref.note.id;
    noteDrag = {
      ref,
      mode: event.target.classList.contains('resize-handle') ? 'resize' : 'move',
      x: event.clientX,
      y: event.clientY,
      start: ref.note.start,
      pitch: ref.note.pitch,
      duration: ref.note.duration
    };
    renderRoll();
  });

  $('#roll').addEventListener('pointermove', event => {
    if (!noteDrag) return;

    const dx = (event.clientX - noteDrag.x) / beatWidth;
    const dy = Math.round((event.clientY - noteDrag.y) / ROW_HEIGHT);

    if (noteDrag.mode === 'resize') {
      noteDrag.ref.note.duration = clamp(snap(noteDrag.duration + dx), 0.125, compositionLength() - noteDrag.ref.note.start);
    } else {
      noteDrag.ref.note.start = clamp(snap(noteDrag.start + dx), 0, compositionLength() - noteDrag.ref.note.duration);
      noteDrag.ref.note.pitch = clamp(noteDrag.pitch - dy, LOW_PITCH, HIGH_PITCH);
    }
    renderRoll();
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
    $('#roll').addEventListener(type, () => { noteDrag = null; });
  });

  $('#piano').addEventListener('pointerdown', event => {
    const key = event.target.closest('.key');
    if (key) playPitch(Number(key.dataset.pitch), pressedKeys.has(' ') ? 1.35 : 0.5);
  });

  $('#record').addEventListener('click', () => {
    recording = !recording;
    recordingStartedAt = performance.now();
    render();
    showStatus(recording ? 'Recording keyboard notes.' : 'Recording stopped.');
  });

  $('#play').addEventListener('click', togglePlay);
  $('#stop').addEventListener('click', () => {
    stopPlayback(false);
    showStatus('Playback stopped.');
  });

  document.addEventListener('keydown', event => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    if (event.code === 'Space') {
      event.preventDefault();
      pressedKeys.add(' ');
      return;
    }

    const key = event.key.toLowerCase();
    if (!KEYBOARD_MAP[key] || pressedKeys.has(key)) return;

    pressedKeys.add(key);
    const beats = pressedKeys.has(' ') ? 1.35 : 0.5;
    playPitch(KEYBOARD_MAP[key], beats);

    if (recording) {
      const start = snap(((performance.now() - recordingStartedAt) / 1000) / secondsPerBeat());
      if (start < compositionLength()) {
        const note = createNote(start, KEYBOARD_MAP[key], beats);
        activeTrack().notes.push(note);
        selectedNoteId = note.id;
        renderRoll();
      }
    }
  });

  document.addEventListener('keyup', event => {
    if (event.code === 'Space') pressedKeys.delete(' ');
    else pressedKeys.delete(event.key.toLowerCase());
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeQuickAdd();
  });

  window.addEventListener('pagehide', () => stopPlayback(false));

  render();
})();