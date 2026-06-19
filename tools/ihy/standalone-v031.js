(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const PROJECT_KEY = 'ihy-v029-project';
  const MODAL_POSITIONS_KEY = 'ihy-v031-window-positions';
  const LAST_WINDOW_KEY = 'ihy-v031-last-open-window';
  const SECTION_COLORS = ['#b68cff', '#60c6a4', '#dfb658', '#dc7898', '#79b4e3'];
  const GM_PROGRAMS = {
    grand_piano: 0, soft_piano: 0, cello: 42, strings: 48, flute: 73, horn: 60,
    choir: 52, warm_pad: 89, bell: 14, acoustic_guitar: 24, electric_bass: 33,
    drum_kit: 0, retro_lead: 80, pluck: 24
  };
  const HIGH_PITCH = 84;
  const ROW_HEIGHT = 24;
  const MIN_BEATS = 64;
  let sectionDrag = null;
  let sectionMenuTarget = null;
  let suppressSectionClick = false;
  let arrangementRebuilding = false;
  let arrangementObserverQueued = false;
  let lameLoadPromise = null;

  const safeJson = (value, fallback) => {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const slug = value => String(value || 'ihy-project').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'ihy-project';
  const noteName = pitch => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
  };
  const instrumentName = id => ({
    grand_piano: 'Grand Piano', soft_piano: 'Soft Piano', cello: 'Cello', strings: 'Strings', flute: 'Flute', horn: 'French Horn', choir: 'Choir', warm_pad: 'Warm Pad', bell: 'Bell', acoustic_guitar: 'Acoustic Guitar', electric_bass: 'Electric Bass', drum_kit: 'Drum Kit', retro_lead: 'Retro Lead', pluck: 'Pluck'
  }[id] || id);

  function readProject() {
    const data = safeJson(localStorage.getItem(PROJECT_KEY), null);
    return data && Array.isArray(data.tracks) ? data : { title: 'Untitled cue', bpm: 92, key: 'D minor', sections: [], tracks: [] };
  }

  function writeProject(project) {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  }

  function saveCurrentEditor() {
    $('#save')?.click();
  }

  function projectLength(project) {
    let end = MIN_BEATS;
    (project.sections || []).forEach(section => { end = Math.max(end, Number(section.end) || 0); });
    (project.tracks || []).forEach(track => (track.notes || []).forEach(note => { end = Math.max(end, (Number(note.start) || 0) + (Number(note.duration) || 0)); }));
    return Math.max(MIN_BEATS, Math.ceil(end / 4) * 4);
  }

  function beatPixels(project) {
    const roll = $('#roll');
    const width = Number.parseFloat(roll?.style.width || '0');
    return width > 0 ? width / projectLength(project) : 40;
  }

  function persistSectionsAfterSave() {
    const sections = structuredClone(readProject().sections || []);
    setTimeout(() => {
      const current = readProject();
      current.sections = sections;
      writeProject(current);
    }, 0);
  }

  function renderSectionsFromStorage() {
    const host = $('#arrangement');
    if (!host) return;
    const project = readProject();
    const total = projectLength(project);
    const pixels = beatPixels(project);
    const playheadLeft = Number.parseFloat($('#arrangementPlayhead')?.style.left || '0');
    const sectionList = (project.sections || []).length
      ? [...project.sections].sort((left, right) => left.start - right.start)
      : [{ id: 'main-track', name: 'Main track', start: 0, end: total, color: '#dfb658', readonly: true }];

    arrangementRebuilding = true;
    host.replaceChildren();
    host.style.width = `${Math.max(total * pixels, 1)}px`;

    const playhead = document.createElement('div');
    playhead.id = 'arrangementPlayhead';
    playhead.className = 'arrangement-playhead';
    playhead.style.left = `${playheadLeft}px`;
    host.append(playhead);

    sectionList.forEach(section => {
      const pill = document.createElement('button');
      pill.className = 'arrangement-section';
      pill.dataset.section = section.id;
      pill.disabled = Boolean(section.readonly);
      pill.style.left = `${section.start * pixels + 4}px`;
      pill.style.width = `${Math.max(44, (section.end - section.start) * pixels - 8)}px`;
      pill.style.background = section.color;
      pill.textContent = section.name;
      host.append(pill);

      for (let beat = Math.ceil(section.start / 4) * 4; beat < section.end; beat += 4) {
        const label = document.createElement('span');
        label.className = 'section-time-label';
        label.style.left = `${beat * pixels + 8}px`;
        label.textContent = String(beat / 4 + 1);
        host.append(label);
      }
    });
    requestAnimationFrame(() => { arrangementRebuilding = false; });
  }

  function addSection() {
    saveCurrentEditor();
    const project = readProject();
    const sections = project.sections || [];
    const name = prompt('Section name', `Section ${sections.length + 1}`);
    if (!name?.trim()) return;
    const start = sections.length ? Math.max(...sections.map(section => Number(section.end) || 0)) : 0;
    project.sections = [...sections, {
      id: `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(), start, end: start + 8, color: SECTION_COLORS[sections.length % SECTION_COLORS.length]
    }];
    writeProject(project);
    renderSectionsFromStorage();
  }

  function startSectionDrag(event, sectionButton) {
    if (event.button !== 0 || sectionButton.disabled) return;
    const project = readProject();
    const section = (project.sections || []).find(item => item.id === sectionButton.dataset.section);
    if (!section) return;
    const pixels = beatPixels(project);
    sectionDrag = { project, id: section.id, originalStart: section.start, duration: section.end - section.start, startX: event.clientX, pixels, moved: false };
    sectionButton.classList.add('section-dragging');
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function updateSectionDrag(event) {
    if (!sectionDrag) return;
    const section = sectionDrag.project.sections.find(item => item.id === sectionDrag.id);
    if (!section) return;
    const delta = Math.round(((event.clientX - sectionDrag.startX) / sectionDrag.pixels) * 4) / 4;
    const ordered = sectionDrag.project.sections.filter(item => item.id !== section.id).sort((left, right) => left.start - right.start);
    const originalIndex = [...sectionDrag.project.sections].sort((left, right) => left.start - right.start).findIndex(item => item.id === section.id);
    const previous = originalIndex > 0 ? [...sectionDrag.project.sections].sort((left, right) => left.start - right.start)[originalIndex - 1] : null;
    const next = originalIndex < sectionDrag.project.sections.length - 1 ? [...sectionDrag.project.sections].sort((left, right) => left.start - right.start)[originalIndex + 1] : null;
    const lower = previous ? previous.end : 0;
    const upper = next ? next.start - sectionDrag.duration : Number.POSITIVE_INFINITY;
    const nextStart = clamp(sectionDrag.originalStart + delta, lower, Math.max(lower, upper));
    section.start = nextStart;
    section.end = nextStart + sectionDrag.duration;
    sectionDrag.moved = sectionDrag.moved || Math.abs(delta) > 0.01;
    writeProject(sectionDrag.project);
    renderSectionsFromStorage();
    event.preventDefault();
  }

  function finishSectionDrag() {
    if (!sectionDrag) return;
    suppressSectionClick = sectionDrag.moved;
    sectionDrag = null;
    $$('.arrangement-section.section-dragging').forEach(node => node.classList.remove('section-dragging'));
  }

  function openSectionMenu(event, sectionButton) {
    if (sectionButton.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    sectionMenuTarget = sectionButton.dataset.section;
    const menu = $('#sectionMenu');
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - 170, event.clientX))}px`;
    menu.style.top = `${Math.max(8, Math.min(window.innerHeight - 150, event.clientY))}px`;
    menu.hidden = false;
  }

  function closeSectionMenu() {
    $('#sectionMenu').hidden = true;
    sectionMenuTarget = null;
  }

  function sectionAction(action) {
    if (!sectionMenuTarget) return;
    const project = readProject();
    const sections = project.sections || [];
    const index = sections.findIndex(section => section.id === sectionMenuTarget);
    if (index < 0) return;
    const section = sections[index];

    if (action === 'rename') {
      const name = prompt('Section name', section.name);
      if (name?.trim()) section.name = name.trim();
    }

    if (action === 'delete') {
      if (!confirm(`Delete section “${section.name}”?`)) return;
      sections.splice(index, 1);
    }

    if (action === 'duplicate') {
      const duration = section.end - section.start;
      const copied = { ...section, id: `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, name: `${section.name} copy` };
      const ordered = [...sections].sort((left, right) => left.start - right.start);
      const following = ordered.find(item => item.start >= section.end && item.id !== section.id);
      copied.start = following && following.start - section.end >= duration ? section.end : Math.max(...sections.map(item => item.end));
      copied.end = copied.start + duration;
      copied.color = SECTION_COLORS[sections.length % SECTION_COLORS.length];
      sections.push(copied);
    }

    project.sections = sections;
    writeProject(project);
    renderSectionsFromStorage();
    closeSectionMenu();
  }

  function windowPositions() {
    return safeJson(localStorage.getItem(MODAL_POSITIONS_KEY), {});
  }

  function setWindowPosition(id, left, top) {
    const all = windowPositions();
    all[id] = { left, top };
    localStorage.setItem(MODAL_POSITIONS_KEY, JSON.stringify(all));
  }

  function applyWindowPosition(id) {
    const dialog = $(`#${id} .floating-dialog`);
    const position = windowPositions()[id];
    if (!dialog || !position) return;
    dialog.classList.add('is-positioned');
    dialog.style.left = `${clamp(position.left, 8, window.innerWidth - 120)}px`;
    dialog.style.top = `${clamp(position.top, 8, window.innerHeight - 80)}px`;
  }

  function showWindow(id) {
    const modal = $(`#${id}`);
    modal.hidden = false;
    applyWindowPosition(id);
    localStorage.setItem(LAST_WINDOW_KEY, id);
  }

  function hideWindow(id) {
    $(`#${id}`).hidden = true;
  }

  function setupDraggableWindow(id) {
    const modal = $(`#${id}`);
    const dialog = modal?.querySelector('.floating-dialog');
    const header = modal?.querySelector('.floating-dialog-header');
    if (!modal || !dialog || !header) return;
    let drag = null;

    header.addEventListener('pointerdown', event => {
      if (event.target.closest('button,input,select,textarea')) return;
      const rect = dialog.getBoundingClientRect();
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      dialog.classList.add('is-positioned');
      header.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    header.addEventListener('pointermove', event => {
      if (!drag) return;
      const left = clamp(event.clientX - drag.x, 8, window.innerWidth - Math.min(dialog.offsetWidth, window.innerWidth - 8));
      const top = clamp(event.clientY - drag.y, 8, window.innerHeight - 56);
      dialog.style.left = `${left}px`;
      dialog.style.top = `${top}px`;
      setWindowPosition(id, left, top);
    });

    const stop = () => { drag = null; };
    header.addEventListener('pointerup', stop);
    header.addEventListener('pointercancel', stop);
  }

  function buildAnalysisText() {
    saveCurrentEditor();
    const project = readProject();
    const secondsPerBeat = 60 / Math.max(30, Number(project.bpm) || 92);
    const totalBeats = projectLength(project);
    const duration = totalBeats * secondsPerBeat;
    const clock = seconds => {
      const whole = Math.max(0, Math.round(seconds));
      return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
    };
    const tracks = project.tracks || [];
    const totalNotes = tracks.reduce((sum, track) => sum + (track.notes || []).length, 0);
    const lines = [
      'IHY — OPEN PROJECT ANALYSIS',
      '═'.repeat(64),
      `Title:      ${project.title || 'Untitled cue'}`,
      `Tempo:      ${project.bpm || 92} BPM`,
      `Key:        ${project.key || 'D minor'}`,
      `Timeline:   ${totalBeats.toFixed(2)} beats  •  ${clock(duration)}`,
      `Tracks:     ${tracks.length}`,
      `Notes:      ${totalNotes}`,
      `Sections:   ${(project.sections || []).length || 'Main track'}`,
      '',
      'TRACK NOTES',
      '─'.repeat(64)
    ];

    tracks.forEach((track, index) => {
      const notes = [...(track.notes || [])].sort((left, right) => left.start - right.start || left.pitch - right.pitch);
      const pitches = notes.map(note => note.pitch);
      const range = pitches.length ? `${noteName(Math.min(...pitches))}–${noteName(Math.max(...pitches))}` : '—';
      lines.push(`${String(index + 1).padStart(2, '0')}. ${track.name}  |  ${instrumentName(track.instrument)}  |  ${notes.length} notes  |  ${range}`);
      if (!notes.length) {
        lines.push('    No notes.');
      } else {
        notes.forEach((note, noteIndex) => {
          const end = note.start + note.duration;
          lines.push(`    ${String(noteIndex + 1).padStart(3, '0')}  beat ${note.start.toFixed(3)}–${end.toFixed(3)}  ${noteName(note.pitch).padEnd(4)}  length ${note.duration.toFixed(3)}  velocity ${note.velocity}${note.groupId ? `  group ${note.groupId}` : ''}`);
        });
      }
      lines.push('');
    });

    lines.push('SECTIONS', '─'.repeat(64));
    const sections = project.sections || [];
    if (!sections.length) lines.push(`Main track  |  beat 0.000–${totalBeats.toFixed(3)}`);
    else sections.sort((left, right) => left.start - right.start).forEach((section, index) => lines.push(`${String(index + 1).padStart(2, '0')}. ${section.name}  |  beat ${Number(section.start).toFixed(3)}–${Number(section.end).toFixed(3)}  |  ${section.color}`));
    return lines.join('\n');
  }

  function openAnalysis() {
    $('#analysisReport').value = buildAnalysisText();
    showWindow('analysisWindow');
  }

  async function copyAnalysis() {
    const text = $('#analysisReport').value;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const box = $('#analysisReport');
      box.select();
      document.execCommand('copy');
    }
    const button = $('#copyAnalysis');
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = 'Copy report'; }, 1200);
  }

  function openQuickPlaceholder(type) {
    const isBass = type === 'bass';
    $('#quickPlaceholderTitle').textContent = isBass ? '＋ Bass' : '＋ Motif';
    $('#quickPlaceholderBody').textContent = isBass
      ? 'Bass quick-add is a placeholder for now. It will generate a bass pattern on the armed bass track using the selected key, tempo and section length.'
      : 'Motif quick-add is a placeholder for now. It will generate a short melodic phrase on the armed track using the selected key, tempo and section length.';
    showWindow('quickWindow');
  }

  function setExportDescription() {
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'json';
    const description = {
      json: 'Ihy project JSON preserves tracks, notes, groups, sections, instruments and settings.',
      midi: 'Standard MIDI exports editable notes, tempo, named tracks and General MIDI instrument programs.',
      wav: 'WAV renders an uncompressed stereo reference mix in the browser using the active composition.',
      mp3: 'MP3 renders the same stereo reference mix, then encodes it locally at the chosen bitrate.'
    }[format];
    $('#exportDescription').textContent = description;
    $('#bitrateOption').hidden = format !== 'mp3';
  }

  function openExport() {
    saveCurrentEditor();
    setExportDescription();
    showWindow('exportWindow');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function textBytes(text) {
    return [...new TextEncoder().encode(text)];
  }

  function u32(value) {
    return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  }

  function vlq(value) {
    let number = Math.max(0, Math.floor(value));
    const bytes = [number & 0x7f];
    while ((number >>= 7) > 0) bytes.unshift((number & 0x7f) | 0x80);
    return bytes;
  }

  function chunk(name, data) {
    return [...textBytes(name), ...u32(data.length), ...data];
  }

  function midiBytes(project, includeMuted) {
    const tpq = 480;
    const microseconds = Math.round(60000000 / Math.max(30, Number(project.bpm) || 92));
    const tempoTrack = [0x00, 0xff, 0x51, 0x03, (microseconds >>> 16) & 255, (microseconds >>> 8) & 255, microseconds & 255, 0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08, 0x00, 0xff, 0x2f, 0x00];
    const tracks = (project.tracks || []).filter(track => includeMuted || !track.muted);
    const trackChunks = tracks.map((track, index) => {
      const channel = track.instrument === 'drum_kit' ? 9 : (index >= 9 ? index + 1 : index) % 16;
      const program = GM_PROGRAMS[track.instrument] ?? 0;
      const events = [];
      const name = textBytes(track.name || `Track ${index + 1}`);
      events.push({ tick: 0, priority: 0, data: [0xff, 0x03, ...vlq(name.length), ...name] });
      events.push({ tick: 0, priority: 1, data: [0xc0 | channel, program] });
      (track.notes || []).forEach(note => {
        const start = Math.max(0, Math.round(note.start * tpq));
        const end = Math.max(start + 1, Math.round((note.start + note.duration) * tpq));
        const pitch = clamp(Math.round(note.pitch), 0, 127);
        const velocity = clamp(Math.round(note.velocity || 92), 1, 127);
        events.push({ tick: start, priority: 2, data: [0x90 | channel, pitch, velocity] });
        events.push({ tick: end, priority: 1, data: [0x80 | channel, pitch, 0] });
      });
      events.sort((left, right) => left.tick - right.tick || left.priority - right.priority);
      const bytes = [];
      let previous = 0;
      events.forEach(event => { bytes.push(...vlq(event.tick - previous), ...event.data); previous = event.tick; });
      bytes.push(0x00, 0xff, 0x2f, 0x00);
      return chunk('MTrk', bytes);
    });
    const header = [...textBytes('MThd'), 0x00, 0x00, 0x00, 0x06, 0x00, 0x01, ...[(tracks.length + 1) >>> 8 & 255, (tracks.length + 1) & 255], ...[tpq >>> 8, tpq & 255]];
    return new Uint8Array([...header, ...chunk('MTrk', tempoTrack), ...trackChunks.flat()]);
  }

  function waveFor(instrument) {
    if (['cello', 'strings', 'horn', 'electric_bass'].includes(instrument)) return 'sawtooth';
    if (['retro_lead', 'drum_kit'].includes(instrument)) return 'square';
    if (['flute', 'choir', 'warm_pad', 'bell'].includes(instrument)) return 'sine';
    return 'triangle';
  }

  async function renderOffline(project, sampleRate, includeMuted) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw new Error('Offline audio rendering is not available in this browser.');
    const secondsPerBeat = 60 / Math.max(30, Number(project.bpm) || 92);
    const seconds = projectLength(project) * secondsPerBeat + 1.2;
    const context = new Offline(2, Math.ceil(seconds * sampleRate), sampleRate);
    const master = context.createGain();
    master.gain.value = 0.6;
    master.connect(context.destination);
    const tracks = (project.tracks || []).filter(track => includeMuted || !track.muted).filter(track => !project.tracks.some(candidate => candidate.solo) || track.solo);

    tracks.forEach(track => (track.notes || []).forEach(note => {
      const start = Math.max(0, note.start * secondsPerBeat);
      const duration = Math.max(.06, note.duration * secondsPerBeat);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = waveFor(track.instrument);
      oscillator.frequency.setValueAtTime(track.instrument === 'drum_kit' ? 90 + (note.pitch % 12) * 9 : 440 * Math.pow(2, (note.pitch - 69) / 12), start);
      const level = clamp((note.velocity || 92) / 127, .08, 1) * 0.13;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(level, start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + .05);
    }));
    return context.startRendering();
  }

  function wavBlob(buffer) {
    const channels = 2;
    const frames = buffer.length;
    const dataSize = frames * channels * 2;
    const view = new DataView(new ArrayBuffer(44 + dataSize));
    const writeText = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    writeText(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeText(36, 'data');
    view.setUint32(40, dataSize, true);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1));
    let offset = 44;
    for (let index = 0; index < frames; index += 1) {
      view.setInt16(offset, clamp(left[index], -1, 1) * 0x7fff, true); offset += 2;
      view.setInt16(offset, clamp(right[index], -1, 1) * 0x7fff, true); offset += 2;
    }
    return new Blob([view.buffer], { type: 'audio/wav' });
  }

  function loadLameJs() {
    if (window.lamejs) return Promise.resolve(window.lamejs);
    if (lameLoadPromise) return lameLoadPromise;
    lameLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
      script.onload = () => window.lamejs ? resolve(window.lamejs) : reject(new Error('MP3 encoder did not load.'));
      script.onerror = () => reject(new Error('MP3 encoder could not be loaded.'));
      document.head.append(script);
    });
    return lameLoadPromise;
  }

  async function mp3Blob(buffer, bitrate) {
    const lamejs = await loadLameJs();
    const encoder = new lamejs.Mp3Encoder(2, buffer.sampleRate, bitrate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1));
    const leftPcm = new Int16Array(left.length);
    const rightPcm = new Int16Array(right.length);
    for (let index = 0; index < left.length; index += 1) {
      leftPcm[index] = clamp(left[index], -1, 1) * 0x7fff;
      rightPcm[index] = clamp(right[index], -1, 1) * 0x7fff;
    }
    const chunks = [];
    for (let index = 0; index < leftPcm.length; index += 1152) {
      const encoded = encoder.encodeBuffer(leftPcm.subarray(index, index + 1152), rightPcm.subarray(index, index + 1152));
      if (encoded.length) chunks.push(new Uint8Array(encoded));
    }
    const flushed = encoder.flush();
    if (flushed.length) chunks.push(new Uint8Array(flushed));
    return new Blob(chunks, { type: 'audio/mpeg' });
  }

  async function exportCurrentProject() {
    const button = $('#performExport');
    button.disabled = true;
    button.textContent = 'Preparing…';
    try {
      saveCurrentEditor();
      const project = readProject();
      const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'json';
      const sampleRate = Number($('#exportSampleRate').value || 44100);
      const bitrate = Number($('#exportBitrate').value || 192);
      const includeMuted = $('#includeMutedTracks').checked;
      const base = slug(project.title);

      if (format === 'json') downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `${base}.ihy.json`);
      if (format === 'midi') downloadBlob(new Blob([midiBytes(project, includeMuted)], { type: 'audio/midi' }), `${base}.mid`);
      if (format === 'wav' || format === 'mp3') {
        $('#exportStatus').textContent = 'Rendering stereo mix…';
        const audio = await renderOffline(project, sampleRate, includeMuted);
        if (format === 'wav') downloadBlob(wavBlob(audio), `${base}.wav`);
        if (format === 'mp3') {
          $('#exportStatus').textContent = 'Encoding MP3…';
          downloadBlob(await mp3Blob(audio, bitrate), `${base}.mp3`);
        }
      }
      $('#exportStatus').textContent = 'Export downloaded.';
    } catch (error) {
      $('#exportStatus').textContent = `Export failed: ${error.message}`;
    } finally {
      button.disabled = false;
      button.textContent = 'Export file';
    }
  }

  function installCaptureHandlers() {
    document.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;

      if (target.matches('#quickBass')) {
        event.preventDefault(); event.stopImmediatePropagation(); openQuickPlaceholder('bass'); return;
      }
      if (target.matches('#quickMotif')) {
        event.preventDefault(); event.stopImmediatePropagation(); openQuickPlaceholder('motif'); return;
      }
      if (target.matches('#analyseButton')) {
        event.preventDefault(); event.stopImmediatePropagation(); openAnalysis(); return;
      }
      if (target.matches('#export')) {
        event.preventDefault(); event.stopImmediatePropagation(); openExport(); return;
      }
      if (target.matches('#addSection')) {
        event.preventDefault(); event.stopImmediatePropagation(); addSection(); return;
      }
      if (target.closest('.arrangement-section')) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (suppressSectionClick) setTimeout(() => { suppressSectionClick = false; });
      }
      if (target.matches('#save')) persistSectionsAfterSave();
    }, true);

    document.addEventListener('pointerdown', event => {
      const section = event.target.closest('.arrangement-section');
      if (section) startSectionDrag(event, section);
    }, true);

    document.addEventListener('pointermove', event => updateSectionDrag(event), true);
    document.addEventListener('pointerup', () => finishSectionDrag(), true);
    document.addEventListener('pointercancel', () => finishSectionDrag(), true);

    document.addEventListener('contextmenu', event => {
      const section = event.target.closest('.arrangement-section');
      if (section) openSectionMenu(event, section);
    }, true);
  }

  function installArrangementObserver() {
    const host = $('#arrangement');
    if (!host) return;
    const observer = new MutationObserver(() => {
      if (arrangementRebuilding || arrangementObserverQueued) return;
      arrangementObserverQueued = true;
      requestAnimationFrame(() => {
        arrangementObserverQueued = false;
        renderSectionsFromStorage();
      });
    });
    observer.observe(host, { childList: true });
  }

  function initialise() {
    setupDraggableWindow('quickWindow');
    setupDraggableWindow('analysisWindow');
    setupDraggableWindow('exportWindow');
    installCaptureHandlers();
    installArrangementObserver();

    $('#quickPlaceholderClose').addEventListener('click', () => hideWindow('quickWindow'));
    $('#analysisClose').addEventListener('click', () => hideWindow('analysisWindow'));
    $('#exportClose').addEventListener('click', () => hideWindow('exportWindow'));
    $('#copyAnalysis').addEventListener('click', copyAnalysis);
    $('#performExport').addEventListener('click', exportCurrentProject);
    $('#sectionMenu').addEventListener('click', event => {
      const action = event.target.closest('[data-section-action]')?.dataset.sectionAction;
      if (action) sectionAction(action);
    });
    document.addEventListener('pointerdown', event => {
      if (!event.target.closest('#sectionMenu') && !event.target.closest('.arrangement-section')) closeSectionMenu();
    }, true);
    document.querySelectorAll('input[name="exportFormat"]').forEach(input => input.addEventListener('change', setExportDescription));
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      closeSectionMenu();
      ['quickWindow', 'analysisWindow', 'exportWindow'].forEach(hideWindow);
    });

    setExportDescription();
    renderSectionsFromStorage();
  }

  initialise();
})();