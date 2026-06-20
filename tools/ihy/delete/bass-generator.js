(() => {
  'use strict';

  const PROJECT_KEY = 'ihy-v042-project';
  const HISTORY_KEY = 'ihy-v042-history';
  const TOAST_KEY = 'ihy-v045-toast';
  const NOTE_PCS = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 };
  const COLORS = ['#60c6a4','#b68cff','#dfb658','#dc7898','#79b4e3'];
  const PITCH_LANES = [
    { interval:12, label:'Octave', short:'+8' },
    { interval:7, label:'Fifth', short:'+5' },
    { interval:0, label:'Root', short:'R' },
    { interval:-12, label:'Low root', short:'−8' }
  ];
  const SOUNDFONTS = {
    electric_bass:'electric_bass_finger', acoustic_guitar:'acoustic_guitar_nylon', cello:'cello',
    warm_pad:'pad_2_warm', retro_lead:'lead_1_square', grand_piano:'acoustic_grand_piano'
  };
  const VELOCITIES = { 1:68, 2:92, 3:114 };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const copy = value => JSON.parse(JSON.stringify(value));
  const projectEnd = project => Math.max(0, ...project.sections.map(section => Number(section.end)||0), ...project.tracks.flatMap(track => (track.notes||[]).map(note => (Number(note.start)||0)+(Number(note.duration)||0))));
  const secondsPerBeat = project => 60 / clamp(Number(project.bpm)||92,30,260);

  let state = {
    phraseBeats:8,
    units:1,
    pattern:'driving',
    source:'key',
    instrument:'electric_bass',
    register:36,
    steps:[]
  };

  let preview = { context:null, gain:null, player:null, instrument:null, nodes:[], timer:0, running:false };

  function readProject() {
    try {
      const project = JSON.parse(localStorage.getItem(PROJECT_KEY));
      if (project && Array.isArray(project.tracks)) return project;
    } catch (_) {}
    return { title:'untitled', bpm:92, key:'D minor', sections:[], tracks:[{ id:uid('track'), name:'Piano', instrument:'grand_piano', color:COLORS[1], muted:false, solo:false, hidden:false, notes:[] }] };
  }

  function saveProject(project) {
    localStorage.setItem(PROJECT_KEY,JSON.stringify(project));
  }

  function snapshot(project) {
    let history = { undo:[], redo:[] };
    try {
      const loaded = JSON.parse(localStorage.getItem(HISTORY_KEY));
      if (loaded && Array.isArray(loaded.undo) && Array.isArray(loaded.redo)) history = loaded;
    } catch (_) {}
    history.undo.push(JSON.stringify(project));
    if (history.undo.length > 100) history.undo.shift();
    history.redo = [];
    localStorage.setItem(HISTORY_KEY,JSON.stringify(history));
  }

  function showToast(message) {
    const status = $('#status');
    if (status) status.textContent = message;
  }

  function keyRoot(key) {
    const root = String(key||'C').replace(/\s.*$/,'').replace('♭','b').replace('♯','#');
    return NOTE_PCS[root] ?? 0;
  }

  function makeCell(interval = 0, velocity = 2) {
    return { interval, velocity };
  }

  function makeTemplate(pattern, phraseBeats) {
    const steps = Array.from({ length:phraseBeats*4 }, () => null);
    for (let bar=0; bar<phraseBeats/4; bar+=1) {
      const first = bar*16;
      const add = index => { steps[first+index] = makeCell(); };
      if (pattern === 'driving') for (let index=0; index<16; index+=2) add(index);
      if (pattern === 'pumping') [2,6,10,14].forEach(add);
      if (pattern === 'root') add(0);
      if (pattern === 'gallop') for (let beat=0; beat<4; beat+=1) [0,2,3].forEach(step => add(beat*4+step));
    }
    return steps;
  }

  function resetPhrase() {
    state.steps = makeTemplate(state.pattern,state.phraseBeats);
  }

  function sourceTrack(project) {
    return project.tracks.find(track => track.id === state.source) || null;
  }

  function rootAt(project, beat) {
    const guide = sourceTrack(project);
    if (!guide || !Array.isArray(guide.notes) || !guide.notes.length) return keyRoot(project.key);
    const epsilon = 0.0001;
    const active = guide.notes.filter(note => Number(note.start) <= beat+epsilon && Number(note.start)+Number(note.duration) > beat+epsilon);
    if (active.length) return Math.min(...active.map(note => Number(note.pitch)||60)) % 12;
    const prior = guide.notes.filter(note => Number(note.start) <= beat+epsilon);
    if (!prior.length) return keyRoot(project.key);
    const latest = Math.max(...prior.map(note => Number(note.start)));
    return Math.min(...guide.notes.filter(note => Math.abs(Number(note.start)-latest)<epsilon).map(note => Number(note.pitch)||60)) % 12;
  }

  function pitchFrom(rootPc, interval = 0) {
    const base = Number(state.register)||36;
    const rooted = base + ((rootPc-(base%12)+12)%12);
    return clamp(rooted+interval, 24, 60);
  }

  function noteDuration(pattern, stepInBar) {
    if (pattern === 'root' && stepInBar === 0) return 4;
    if (pattern === 'driving') return .47;
    if (pattern === 'pumping') return .36;
    if (pattern === 'gallop') return stepInBar%4===0 ? .48 : .23;
    return .23;
  }

  function chordChangePoints(project,start,end) {
    const guide = sourceTrack(project);
    if (!guide) return [];
    return [...new Set((guide.notes||[]).map(note => Number(note.start)).filter(time => time>start+.0001 && time<end-.0001))].sort((a,b)=>a-b);
  }

  function splitHeldNote(project,start,duration,cell,groupId) {
    const end = start+duration;
    const points = [start,...chordChangePoints(project,start,end),end];
    const notes = [];
    for (let index=0; index<points.length-1; index+=1) {
      const segmentStart = points[index];
      const segmentEnd = points[index+1];
      if (segmentEnd-segmentStart < .03125) continue;
      notes.push({
        id:uid('note'),
        start:segmentStart,
        pitch:pitchFrom(rootAt(project,segmentStart+.0001),cell.interval),
        duration:segmentEnd-segmentStart,
        velocity:VELOCITIES[cell.velocity]||VELOCITIES[2],
        groupId
      });
    }
    return notes;
  }

  function buildBlock(project,blockStart,groupId) {
    const notes = [];
    state.steps.forEach((cell,index) => {
      if (!cell) return;
      const start = blockStart+index/4;
      const duration = noteDuration(state.pattern,index%16);
      if (state.pattern === 'root' && duration >= 4) {
        notes.push(...splitHeldNote(project,start,duration,cell,groupId));
      } else {
        notes.push({
          id:uid('note'),
          start,
          pitch:pitchFrom(rootAt(project,start+.0001),cell.interval),
          duration,
          velocity:VELOCITIES[cell.velocity]||VELOCITIES[2],
          groupId
        });
      }
    });
    return notes;
  }

  function buildPlan(project) {
    const end = projectEnd(project);
    const insertAt = end ? Math.ceil(end/4)*4 : 0;
    const totalBeats = 32*state.units;
    const groupCount = totalBeats/state.phraseBeats;
    const groups = Array.from({ length:groupCount }, (_,index) => {
      const groupId = uid('bass-group');
      const start = insertAt+index*state.phraseBeats;
      return { groupId,start,beats:state.phraseBeats,notes:buildBlock(project,start,groupId) };
    });
    return { insertAt,totalBeats,groups,notes:groups.flatMap(group => group.notes) };
  }

  function describePlan(project) {
    const plan = buildPlan(project);
    const guide = state.source === 'key' ? `project key (${project.key})` : (sourceTrack(project)?.name || 'project key');
    $('#bassSummary').textContent = `Adds ${plan.groups.length} × ${state.phraseBeats}-beat groups • ${plan.totalBeats} beats total • starts at beat ${plan.insertAt} • harmony: ${guide}.`;
  }

  function renderGuideChoices(project) {
    const select = $('#bassHarmonySource');
    const previous = state.source;
    select.replaceChildren(new Option(`Project key root — ${project.key}`,'key'));
    project.tracks.filter(track => (track.notes||[]).length && !/bass/i.test(track.name)).forEach(track => select.append(new Option(`Guide track: ${track.name}`,track.id)));
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
    else { state.source='key'; select.value='key'; }
  }

  function stepAt(index) {
    return state.steps[index] || null;
  }

  function renderGrid() {
    const host = $('#bassStepGrid');
    const total = state.phraseBeats*4;
    host.replaceChildren();
    PITCH_LANES.forEach(lane => {
      const row = document.createElement('div');
      row.className = 'bass-pitch-row';
      const label = document.createElement('div');
      label.className = 'bass-pitch-label';
      label.innerHTML = `${lane.label}<small>${lane.short}</small>`;
      const grid = document.createElement('div');
      grid.className = 'bass-step-grid';
      grid.style.setProperty('--bass-step-count',String(total));
      for (let index=0; index<total; index+=1) {
        const cell = stepAt(index);
        const active = cell && cell.interval === lane.interval;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `bass-step${active ? ` is-on velocity-${cell.velocity}` : ''}${index%16===0 ? ' bar-start' : ''}${index%4===0 ? ' beat-start' : ''}`;
        button.dataset.step = String(index);
        button.dataset.interval = String(lane.interval);
        button.title = active
          ? `Step ${index+1}: ${lane.label}, ${['','soft','normal','accent'][cell.velocity]}. Right-click to change velocity.`
          : `Step ${index+1}: set ${lane.label}.`;
        button.innerHTML = `<span>${active ? (cell.velocity===3 ? '●' : cell.velocity===2 ? '•' : '·') : ''}</span>`;
        grid.append(button);
      }
      row.append(label,grid);
      host.append(row);
    });
    const bars = [];
    for (let bar=0; bar<state.phraseBeats/4; bar+=1) bars.push(String(bar+1));
    $('#bassBarLabels').textContent = `Bars: ${bars.join('    ')}`;
  }

  function renderModal() {
    const project = readProject();
    renderGuideChoices(project);
    $('#bassLength').value = String(state.units);
    $('#bassLengthValue').textContent = `${state.units} × 32 beats = ${state.units*32} beats`;
    $('#bassInstrument').value = state.instrument;
    $('#bassRegister').value = String(state.register);
    $$('.bass-phrase').forEach(button => button.classList.toggle('selected',Number(button.dataset.beats)===state.phraseBeats));
    $$('.bass-pattern').forEach(button => button.classList.toggle('selected',button.dataset.pattern===state.pattern));
    renderGrid();
    describePlan(project);
  }

  function setPhrase(beats) {
    state.phraseBeats = Number(beats);
    resetPhrase();
    renderModal();
  }

  function setPattern(pattern) {
    state.pattern = pattern;
    resetPhrase();
    renderModal();
  }

  function openModal() {
    stopPreview();
    if (!state.steps.length || state.steps.length !== state.phraseBeats*4) resetPhrase();
    renderModal();
    $('#bassModal').hidden = false;
  }

  function closeModal() {
    stopPreview();
    $('#bassModal').hidden = true;
  }

  function ensureAudio() {
    if (preview.context) {
      if (preview.context.state === 'suspended') preview.context.resume().catch(() => {});
      return preview.context;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    preview.context = new Context();
    preview.gain = preview.context.createGain();
    preview.gain.gain.value = .78;
    preview.gain.connect(preview.context.destination);
    return preview.context;
  }

  async function loadPreviewInstrument() {
    const context = ensureAudio();
    if (!context || !window.Soundfont) return null;
    if (preview.player && preview.instrument === state.instrument) return preview.player;
    preview.player = null;
    preview.instrument = state.instrument;
    try {
      preview.player = await window.Soundfont.instrument(context,SOUNDFONTS[state.instrument],{ soundfont:'MusyngKite',format:'mp3',destination:preview.gain,gain:.94 });
      return preview.player;
    } catch (_) { return null; }
  }

  function stopPreview() {
    clearTimeout(preview.timer);
    preview.timer = 0;
    preview.nodes.splice(0).forEach(node => { try { node.stop?.(); } catch (_) {} });
    preview.running = false;
    const button = $('#bassPreview');
    if (button) { button.textContent = '▶ Preview'; button.classList.remove('is-previewing'); }
  }

  async function previewPhrase() {
    if (preview.running) { stopPreview(); return; }
    const project = readProject();
    const player = await loadPreviewInstrument();
    if (!player) { showToast('Bass sample could not load.'); return; }
    const plan = buildPlan(project);
    const start = plan.insertAt;
    const events = plan.notes.filter(note => note.start < start+32);
    const now = preview.context.currentTime+.06;
    const perBeat = secondsPerBeat(project);
    preview.running = true;
    $('#bassPreview').textContent = '⏹ Stop Preview';
    $('#bassPreview').classList.add('is-previewing');
    events.forEach(note => {
      try {
        const node = player.play(note.pitch,now+(note.start-start)*perBeat,{ duration:Math.max(.08,note.duration*perBeat),gain:clamp(note.velocity/127,.15,.95),attack:.008,release:.12 });
        if (node?.stop) preview.nodes.push(node);
      } catch (_) {}
    });
    preview.timer = window.setTimeout(stopPreview,Math.max(600,Math.min(32000,32*perBeat*1000+260)));
  }

  function findBassTrack(project) {
    let track = project.tracks.find(candidate => /bass/i.test(candidate.name) || candidate.instrument === 'electric_bass');
    if (!track) {
      track = { id:uid('track'),name:'Bass',instrument:state.instrument,color:COLORS[0],muted:false,solo:false,hidden:false,notes:[] };
      project.tracks.push(track);
    }
    track.instrument = state.instrument;
    return track;
  }

  function addToTimeline() {
    const project = readProject();
    const plan = buildPlan(project);
    if (!plan.notes.length) { showToast('Add at least one note in the bass editor first.'); return; }
    snapshot(copy(project));
    const bass = findBassTrack(project);
    bass.notes.push(...plan.notes);
    saveProject(project);
    sessionStorage.setItem(TOAST_KEY,`Added ${plan.groups.length} bass group${plan.groups.length===1?'':'s'} to the timeline.`);
    window.location.reload();
  }

  function updateStep(step,interval,velocityMode) {
    const current = stepAt(step);
    if (velocityMode) {
      if (current && current.interval === interval) current.velocity = current.velocity%3+1;
      else state.steps[step] = makeCell(interval,1);
    } else if (current && current.interval === interval) {
      state.steps[step] = null;
    } else {
      state.steps[step] = makeCell(interval,current?.velocity||2);
    }
    renderGrid();
    describePlan(readProject());
  }

  function setupResize() {
    const modal = $('#bassModalCard');
    const grip = $('#bassResizeGrip');
    if (!modal || !grip) return;
    grip.addEventListener('pointerdown', event => {
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = modal.getBoundingClientRect().width;
      const startHeight = modal.getBoundingClientRect().height;
      grip.classList.add('resizing');
      grip.setPointerCapture?.(event.pointerId);
      const move = moveEvent => {
        const width = clamp(Math.round(startWidth+moveEvent.clientX-startX),660,window.innerWidth-20);
        const height = clamp(Math.round(startHeight+moveEvent.clientY-startY),500,window.innerHeight-20);
        modal.style.width = `${width}px`;
        modal.style.height = `${height}px`;
      };
      const end = () => {
        grip.classList.remove('resizing');
        window.removeEventListener('pointermove',move);
        window.removeEventListener('pointerup',end);
        window.removeEventListener('pointercancel',end);
      };
      window.addEventListener('pointermove',move);
      window.addEventListener('pointerup',end,{ once:true });
      window.addEventListener('pointercancel',end,{ once:true });
    });
  }

  function bind() {
    document.addEventListener('click',event => {
      const trigger = event.target.closest('#quickBass');
      if (!trigger) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openModal();
    },true);

    $('#bassClose')?.addEventListener('click',closeModal);
    $('#bassPreview')?.addEventListener('click',previewPhrase);
    $('#bassAdd')?.addEventListener('click',addToTimeline);
    $('#bassReset')?.addEventListener('click',() => { resetPhrase(); renderModal(); });

    $('#bassLength')?.addEventListener('input',event => { state.units=Number(event.target.value); $('#bassLengthValue').textContent=`${state.units} × 32 beats = ${state.units*32} beats`; describePlan(readProject()); });
    $('#bassHarmonySource')?.addEventListener('change',event => { state.source=event.target.value; describePlan(readProject()); });
    $('#bassInstrument')?.addEventListener('change',event => { state.instrument=event.target.value; });
    $('#bassRegister')?.addEventListener('change',event => { state.register=Number(event.target.value); renderGrid(); describePlan(readProject()); });

    $('#bassPhraseChoices')?.addEventListener('click',event => { const button=event.target.closest('.bass-phrase'); if (button) setPhrase(button.dataset.beats); });
    $('#bassPatternChoices')?.addEventListener('click',event => { const button=event.target.closest('.bass-pattern'); if (button) setPattern(button.dataset.pattern); });
    $('#bassStepGrid')?.addEventListener('click',event => {
      const cell = event.target.closest('.bass-step');
      if (!cell) return;
      updateStep(Number(cell.dataset.step),Number(cell.dataset.interval),false);
    });
    $('#bassStepGrid')?.addEventListener('contextmenu',event => {
      const cell = event.target.closest('.bass-step');
      if (!cell) return;
      event.preventDefault();
      updateStep(Number(cell.dataset.step),Number(cell.dataset.interval),true);
    });
    setupResize();
  }

  bind();
})();