(() => {
  'use strict';

  const PROJECT_KEY = 'ihy-v042-project';
  const HISTORY_KEY = 'ihy-v042-history';
  const TOAST_KEY = 'ihy-v045-toast';
  const NOTE_PCS = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 };
  const SAFE_INTERVALS = [0,0,0,5,7,12];
  const INTERVALS = [{ value:0, label:'R' },{ value:5, label:'4' },{ value:7, label:'5' },{ value:10, label:'♭7' },{ value:12, label:'8' }];
  const COLORS = ['#60c6a4','#b68cff','#dfb658','#dc7898','#79b4e3'];
  const SOUNDFONTS = { electric_bass:'electric_bass_finger', acoustic_guitar:'acoustic_guitar_nylon', cello:'cello', warm_pad:'pad_2_warm', retro_lead:'lead_1_square', grand_piano:'acoustic_grand_piano' };
  const VELOCITIES = { 1:68, 2:92, 3:114 };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const copy = value => JSON.parse(JSON.stringify(value));
  const pick = items => items[Math.floor(Math.random()*items.length)];
  const projectEnd = project => Math.max(0,...project.sections.map(section => Number(section.end)||0),...project.tracks.flatMap(track => (track.notes||[]).map(note => (Number(note.start)||0)+(Number(note.duration)||0))));
  const secondsPerBeat = project => 60/clamp(Number(project.bpm)||92,30,260);
  const intervalLabel = interval => INTERVALS.find(item => item.value===interval)?.label || String(interval);

  const R = {
    driving:[2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0],
    pumping:[0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0],
    walking:[2,0,0,2,2,0,2,0,2,0,0,2,2,0,2,0],
    syncopated:[2,0,0,2,0,2,0,0,2,0,2,0,0,2,0,2],
    anchor:[2,0,0,0,0,0,2,0,2,0,0,0,0,2,0,0],
    gallop:[2,0,2,2,2,0,2,2,2,0,2,2,2,0,2,2]
  };
  const I = {
    disco:[0,0,12,12,10,10,7,7,0,0,12,12,10,10,7,7],
    lift:[0,7,12,7,0,5,7,10,0,7,12,7,10,7,5,0],
    fifth:[0,0,7,7,12,7,5,7,0,0,7,12,10,7,5,0],
    answer:[0,12,7,10,0,7,5,12,0,10,7,5,0,7,12,10],
    roots:[0,0,0,7,0,0,5,0,0,0,7,12,0,5,7,0]
  };
  const profile = (id,name,rhythm,intervals) => ({ id,name,rhythm_grid:[...rhythm],interval_map:[...intervals] });
  const PROFILES = [
    profile(1,'Disco Box',R.driving,I.disco),profile(2,'Disco Lift',R.driving,I.lift),profile(3,'Disco Fifth',R.driving,I.fifth),profile(4,'Disco Answer',R.driving,I.answer),profile(5,'Disco Anchor',R.driving,I.roots),
    profile(6,'Pulse Box',R.pumping,I.disco),profile(7,'Pulse Lift',R.pumping,I.lift),profile(8,'Pulse Fifth',R.pumping,I.fifth),profile(9,'Pulse Answer',R.pumping,I.answer),profile(10,'Pulse Anchor',R.pumping,I.roots),
    profile(11,'Night Walker',R.walking,I.disco),profile(12,'Silver Walker',R.walking,I.lift),profile(13,'Fifth Walker',R.walking,I.fifth),profile(14,'Answer Walker',R.walking,I.answer),profile(15,'Root Walker',R.walking,I.roots),
    profile(16,'Neon Skip',R.syncopated,I.disco),profile(17,'Neon Rise',R.syncopated,I.lift),profile(18,'Funk Fifth',R.syncopated,I.fifth),profile(19,'Funk Reply',R.syncopated,I.answer),profile(20,'Funk Anchor',R.syncopated,I.roots),
    profile(21,'Low Roller',R.anchor,I.disco),profile(22,'Low Lift',R.anchor,I.lift),profile(23,'Low Fifth',R.anchor,I.fifth),profile(24,'Low Answer',R.anchor,I.answer),profile(25,'Low Anchor',R.anchor,I.roots),
    profile(26,'Gallop Box',R.gallop,I.disco),profile(27,'Gallop Lift',R.gallop,I.lift),profile(28,'Gallop Fifth',R.gallop,I.fifth),profile(29,'Gallop Reply',R.gallop,I.answer),profile(30,'Gallop Anchor',R.gallop,I.roots)
  ];

  let state = { phraseBeats:8, units:1, profileId:1, mutationRate:25, source:'key', instrument:'electric_bass', register:36, writeInterval:0, sequence:[] };
  let preview = { context:null, gain:null, player:null, instrument:null, nodes:[], timer:0, running:false };

  function readProject() {
    try { const project = JSON.parse(localStorage.getItem(PROJECT_KEY)); if (project && Array.isArray(project.tracks)) return project; } catch (_) {}
    return { title:'untitled', bpm:92, key:'D minor', sections:[], tracks:[{ id:uid('track'), name:'Piano', instrument:'grand_piano', color:COLORS[1], muted:false, solo:false, hidden:false, notes:[] }] };
  }
  function saveProject(project) { localStorage.setItem(PROJECT_KEY,JSON.stringify(project)); }
  function snapshot(project) {
    let history={ undo:[],redo:[] };
    try { const saved=JSON.parse(localStorage.getItem(HISTORY_KEY)); if (saved&&Array.isArray(saved.undo)&&Array.isArray(saved.redo)) history=saved; } catch (_) {}
    history.undo.push(JSON.stringify(project));
    if (history.undo.length>100) history.undo.shift();
    history.redo=[];
    localStorage.setItem(HISTORY_KEY,JSON.stringify(history));
  }
  function toast(message) { const target=$('#status'); if(target) target.textContent=message; }
  function keyRoot(key) { const root=String(key||'C').replace(/\s.*$/,'').replace('♭','b').replace('♯','#'); return NOTE_PCS[root]??0; }
  function sourceTrack(project) { return project.tracks.find(track=>track.id===state.source)||null; }
  function rootAt(project,beat) {
    const guide=sourceTrack(project);
    if(!guide||!(guide.notes||[]).length) return keyRoot(project.key);
    const epsilon=.0001;
    const active=guide.notes.filter(note=>Number(note.start)<=beat+epsilon&&Number(note.start)+Number(note.duration)>beat+epsilon);
    if(active.length) return Math.min(...active.map(note=>Number(note.pitch)||60))%12;
    const prior=guide.notes.filter(note=>Number(note.start)<=beat+epsilon);
    if(!prior.length) return keyRoot(project.key);
    const latest=Math.max(...prior.map(note=>Number(note.start)));
    return Math.min(...guide.notes.filter(note=>Math.abs(Number(note.start)-latest)<epsilon).map(note=>Number(note.pitch)||60))%12;
  }
  function pitchFrom(rootPc,interval) {
    const base=Number(state.register)||36;
    const rooted=base+((rootPc-(base%12)+12)%12);
    return clamp(rooted+interval,24,72);
  }
  function selectedProfile(){ return PROFILES.find(profile=>profile.id===state.profileId)||PROFILES[0]; }
  function phraseSteps(){ return state.phraseBeats*2; }
  function loadProfile(id=state.profileId) {
    const profile=PROFILES.find(item=>item.id===Number(id))||PROFILES[0];
    state.profileId=profile.id;
    state.sequence=Array.from({length:phraseSteps()},(_,index)=>{
      const base=index%16;
      const velocity=profile.rhythm_grid[base]||0;
      return velocity?{velocity,interval:profile.interval_map[base]??0}:null;
    });
  }
  function mutateCurrent() {
    const rate=state.mutationRate/100;
    state.sequence=state.sequence.map(cell=>{
      let next=cell?{...cell}:null;
      if(Math.random()<rate){ next=next?null:{velocity:2,interval:pick(SAFE_INTERVALS)}; }
      if(next&&Math.random()<rate){ next.interval=pick(SAFE_INTERVALS); }
      if(next&&Math.random()<rate*.4){ next.velocity=pick([1,2,2,3]); }
      return next;
    });
    if(!state.sequence.some(Boolean)) state.sequence[0]={velocity:2,interval:0};
  }
  function durationFor(index) {
    const withinBar=index%8;
    let gap=8-withinBar;
    for(let cursor=index+1;cursor<state.sequence.length;cursor+=1){
      if(state.sequence[cursor]){ gap=Math.min(gap,cursor-index); break; }
      if(cursor%8===0) break;
    }
    return clamp(gap*.5*.86,.18,3.6);
  }
  function chordChanges(project,start,end) {
    const guide=sourceTrack(project);
    if(!guide) return [];
    return [...new Set((guide.notes||[]).map(note=>Number(note.start)).filter(time=>time>start+.0001&&time<end-.0001))].sort((a,b)=>a-b);
  }
  function splitForHarmony(project,start,duration,cell,groupId){
    const end=start+duration,points=[start,...chordChanges(project,start,end),end],notes=[];
    for(let index=0;index<points.length-1;index+=1){
      const from=points[index],to=points[index+1];
      if(to-from<.03125) continue;
      notes.push({id:uid('note'),start:from,pitch:pitchFrom(rootAt(project,from+.0001),cell.interval),duration:to-from,velocity:VELOCITIES[cell.velocity]||92,groupId});
    }
    return notes;
  }
  function buildBlock(project,start,groupId){
    const notes=[];
    state.sequence.forEach((cell,index)=>{
      if(!cell)return;
      const noteStart=start+index*.5, duration=durationFor(index);
      if(duration>.55) notes.push(...splitForHarmony(project,noteStart,duration,cell,groupId));
      else notes.push({id:uid('note'),start:noteStart,pitch:pitchFrom(rootAt(project,noteStart+.0001),cell.interval),duration,velocity:VELOCITIES[cell.velocity]||92,groupId});
    });
    return notes;
  }
  function buildPlan(project){
    const end=projectEnd(project),insertAt=end?Math.ceil(end/4)*4:0,totalBeats=32*state.units,groupCount=totalBeats/state.phraseBeats;
    const groups=Array.from({length:groupCount},(_,index)=>{const groupId=uid('bass-group'),start=insertAt+index*state.phraseBeats;return{groupId,start,beats:state.phraseBeats,notes:buildBlock(project,start,groupId)}});
    return{insertAt,totalBeats,groups,notes:groups.flatMap(group=>group.notes)};
  }
  function describePlan(project){
    const plan=buildPlan(project),guide=state.source==='key'?`project key (${project.key})`:(sourceTrack(project)?.name||'project key');
    $('#bassSummary').textContent=`${selectedProfile().name} • ${plan.groups.length} × ${state.phraseBeats}-beat groups • ${plan.totalBeats} beats total • starts at beat ${plan.insertAt} • harmony: ${guide}.`;
  }
  function renderGuideChoices(project){
    const select=$('#bassHarmonySource'),previous=state.source;
    select.replaceChildren(new Option(`Project key root — ${project.key}`,'key'));
    project.tracks.filter(track=>(track.notes||[]).length&&!/bass/i.test(track.name)).forEach(track=>select.append(new Option(`Guide track: ${track.name}`,track.id)));
    if([...select.options].some(option=>option.value===previous))select.value=previous;else{state.source='key';select.value='key'}
  }
  function renderProfileChoices(){
    const select=$('#bassProfileSelect');
    select.replaceChildren(...PROFILES.map(profile=>new Option(`${String(profile.id).padStart(2,'0')} · ${profile.name}`,String(profile.id))));
    select.value=String(state.profileId);
  }
  function renderEditor(){
    const host=$('#bassStepGrid'),count=phraseSteps();
    host.replaceChildren();
    const rows=[{mode:'rhythm',label:'Rhythm',hint:'on / rest'},{mode:'tune',label:'Tune',hint:'interval'}];
    rows.forEach(rowInfo=>{
      const row=document.createElement('div');row.className='dna-row';
      const label=document.createElement('div');label.className='dna-row-label';label.innerHTML=`${rowInfo.label}<small>${rowInfo.hint}</small>`;
      const grid=document.createElement('div');grid.className='dna-grid';grid.style.setProperty('--dna-step-count',String(count));
      for(let index=0;index<count;index+=1){
        const cell=state.sequence[index],active=Boolean(cell),button=document.createElement('button');
        button.type='button';button.dataset.step=String(index);button.dataset.mode=rowInfo.mode;
        button.className=`dna-cell dna-${rowInfo.mode}${active?' is-on':''}${active?` velocity-${cell.velocity}`:''}${index%8===0?' bar-start':''}${index%2===0?' beat-start':''}`;
        button.title=rowInfo.mode==='rhythm'?(active?`Step ${index+1}: active. Right-click to change velocity.`:`Step ${index+1}: rest. Click to trigger.`):(active?`Step ${index+1}: ${intervalLabel(cell.interval)}. Click to set selected interval.`:`Step ${index+1}: set selected interval and trigger.`);
        button.textContent=rowInfo.mode==='rhythm'?(active?(cell.velocity===3?'●':cell.velocity===2?'•':'·'):''):(active?intervalLabel(cell.interval):'—');
        grid.append(button);
      }
      row.append(label,grid);host.append(row);
    });
    const bars=[];for(let bar=0;bar<state.phraseBeats/4;bar+=1)bars.push(String(bar+1));$('#bassBarLabels').textContent=`Bars: ${bars.join('      ')}`;
  }
  function renderPalette(){
    const palette=$('#bassIntervalPalette');
    palette.replaceChildren(...INTERVALS.map(item=>{const button=document.createElement('button');button.type='button';button.className=`dna-interval-button${state.writeInterval===item.value?' selected':''}`;button.dataset.interval=String(item.value);button.textContent=item.label;button.title=`Write ${item.label}`;return button}));
  }
  function renderModal(){
    const project=readProject();renderGuideChoices(project);renderProfileChoices();
    $('#bassLength').value=String(state.units);$('#bassLengthValue').textContent=`${state.units} × 32 beats = ${state.units*32} beats`;
    $('#bassMutationRate').value=String(state.mutationRate);$('#bassMutationOutput').textContent=`${state.mutationRate}% similar change`;
    $('#bassInstrument').value=state.instrument;$('#bassRegister').value=String(state.register);
    $$('.bass-phrase').forEach(button=>button.classList.toggle('selected',Number(button.dataset.beats)===state.phraseBeats));
    renderPalette();renderEditor();describePlan(project);
  }
  function openModal(){stopPreview();if(!state.sequence.length||state.sequence.length!==phraseSteps())loadProfile(state.profileId);renderModal();$('#bassModal').hidden=false}
  function closeModal(){stopPreview();$('#bassModal').hidden=true}
  function ensureAudio(){if(preview.context){if(preview.context.state==='suspended')preview.context.resume().catch(()=>{});return preview.context}const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return null;preview.context=new Context();preview.gain=preview.context.createGain();preview.gain.gain.value=.78;preview.gain.connect(preview.context.destination);return preview.context}
  async function previewPlayer(){const context=ensureAudio();if(!context||!window.Soundfont)return null;if(preview.player&&preview.instrument===state.instrument)return preview.player;preview.player=null;preview.instrument=state.instrument;try{preview.player=await window.Soundfont.instrument(context,SOUNDFONTS[state.instrument],{soundfont:'MusyngKite',format:'mp3',destination:preview.gain,gain:.94});return preview.player}catch(_){return null}}
  function stopPreview(){clearTimeout(preview.timer);preview.timer=0;preview.nodes.splice(0).forEach(node=>{try{node.stop?.()}catch(_){}});preview.running=false;const button=$('#bassPreview');if(button){button.textContent='▶ Preview';button.classList.remove('is-previewing')}}
  async function previewPhrase(){if(preview.running){stopPreview();return}const project=readProject(),player=await previewPlayer();if(!player){toast('Bass sample could not load.');return}const plan=buildPlan(project),start=plan.insertAt,events=plan.notes.filter(note=>note.start<start+32),now=preview.context.currentTime+.06,perBeat=secondsPerBeat(project);preview.running=true;$('#bassPreview').textContent='⏹ Stop Preview';$('#bassPreview').classList.add('is-previewing');events.forEach(note=>{try{const node=player.play(note.pitch,now+(note.start-start)*perBeat,{duration:Math.max(.08,note.duration*perBeat),gain:clamp(note.velocity/127,.15,.95),attack:.008,release:.12});if(node?.stop)preview.nodes.push(node)}catch(_){}});preview.timer=window.setTimeout(stopPreview,Math.max(600,Math.min(32000,32*perBeat*1000+260)))}
  function findBassTrack(project){let track=project.tracks.find(candidate=>/bass/i.test(candidate.name)||candidate.instrument==='electric_bass');if(!track){track={id:uid('track'),name:'Bass',instrument:state.instrument,color:COLORS[0],muted:false,solo:false,hidden:false,notes:[]};project.tracks.push(track)}track.instrument=state.instrument;return track}
  function addToTimeline(){const project=readProject(),plan=buildPlan(project);if(!plan.notes.length){toast('Add at least one triggered step first.');return}snapshot(copy(project));findBassTrack(project).notes.push(...plan.notes);saveProject(project);sessionStorage.setItem(TOAST_KEY,`Added ${plan.groups.length} bass group${plan.groups.length===1?'':'s'} to the timeline.`);window.location.reload()}
  function changeCell(step,mode,rightClick){const cell=state.sequence[step];if(mode==='rhythm'){if(rightClick){if(cell)cell.velocity=cell.velocity%3+1;else state.sequence[step]={velocity:1,interval:state.writeInterval}}else state.sequence[step]=cell?null:{velocity:2,interval:state.writeInterval}}else if(rightClick){if(cell)cell.velocity=cell.velocity%3+1;else state.sequence[step]={velocity:1,interval:state.writeInterval}}else state.sequence[step]=cell?{...cell,interval:state.writeInterval}:{velocity:2,interval:state.writeInterval};renderEditor();describePlan(readProject())}
  function enableFloatingWindow(){const card=$('#bassModalCard'),header=$('#bassModalHeader'),grip=$('#bassResizeGrip');if(!card||!header||!grip)return;header.addEventListener('pointerdown',event=>{if(event.target.closest('button,input,select,label'))return;event.preventDefault();const rect=card.getBoundingClientRect();card.style.position='fixed';card.style.margin='0';card.style.left=`${rect.left}px`;card.style.top=`${rect.top}px`;const offsetX=event.clientX-rect.left,offsetY=event.clientY-rect.top;const move=moveEvent=>{card.style.left=`${clamp(moveEvent.clientX-offsetX,0,window.innerWidth-card.offsetWidth)}px`;card.style.top=`${clamp(moveEvent.clientY-offsetY,0,window.innerHeight-card.offsetHeight)}px`};const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true})});grip.addEventListener('pointerdown',event=>{event.preventDefault();const startX=event.clientX,startY=event.clientY,rect=card.getBoundingClientRect();card.style.position='fixed';card.style.margin='0';card.style.left=`${rect.left}px`;card.style.top=`${rect.top}px`;grip.classList.add('resizing');const move=moveEvent=>{card.style.width=`${clamp(Math.round(rect.width+moveEvent.clientX-startX),660,window.innerWidth-20)}px`;card.style.height=`${clamp(Math.round(rect.height+moveEvent.clientY-startY),500,window.innerHeight-20)}px`};const end=()=>{grip.classList.remove('resizing');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true})})}
  function bind(){document.addEventListener('click',event=>{const trigger=event.target.closest('#quickBass');if(!trigger)return;event.preventDefault();event.stopImmediatePropagation();openModal()},true);$('#bassClose')?.addEventListener('click',closeModal);$('#bassPreview')?.addEventListener('click',previewPhrase);$('#bassAdd')?.addEventListener('click',addToTimeline);$('#bassLoadProfile')?.addEventListener('click',()=>{state.profileId=Number($('#bassProfileSelect').value);loadProfile(state.profileId);renderModal()});$('#bassRandomProfile')?.addEventListener('click',()=>{state.profileId=pick(PROFILES).id;loadProfile(state.profileId);renderModal()});$('#bassMutate')?.addEventListener('click',()=>{mutateCurrent();renderModal()});$('#bassLength')?.addEventListener('input',event=>{state.units=Number(event.target.value);$('#bassLengthValue').textContent=`${state.units} × 32 beats = ${state.units*32} beats`;describePlan(readProject())});$('#bassMutationRate')?.addEventListener('input',event=>{state.mutationRate=Number(event.target.value);$('#bassMutationOutput').textContent=`${state.mutationRate}% similar change`});$('#bassHarmonySource')?.addEventListener('change',event=>{state.source=event.target.value;describePlan(readProject())});$('#bassInstrument')?.addEventListener('change',event=>{state.instrument=event.target.value});$('#bassRegister')?.addEventListener('change',event=>{state.register=Number(event.target.value);describePlan(readProject())});$('#bassPhraseChoices')?.addEventListener('click',event=>{const button=event.target.closest('.bass-phrase');if(!button)return;state.phraseBeats=Number(button.dataset.beats);loadProfile(state.profileId);renderModal()});$('#bassIntervalPalette')?.addEventListener('click',event=>{const button=event.target.closest('.dna-interval-button');if(!button)return;state.writeInterval=Number(button.dataset.interval);renderPalette()});$('#bassStepGrid')?.addEventListener('click',event=>{const cell=event.target.closest('.dna-cell');if(cell)changeCell(Number(cell.dataset.step),cell.dataset.mode,false)});$('#bassStepGrid')?.addEventListener('contextmenu',event=>{const cell=event.target.closest('.dna-cell');if(!cell)return;event.preventDefault();changeCell(Number(cell.dataset.step),cell.dataset.mode,true)});enableFloatingWindow()}
  loadProfile(1);bind();
})();