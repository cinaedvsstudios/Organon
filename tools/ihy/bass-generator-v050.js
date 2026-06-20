(() => {
  'use strict';

  const PROJECT_KEY = 'ihy-v042-project';
  const HISTORY_KEY = 'ihy-v042-history';
  const TOAST_KEY = 'ihy-v045-toast';
  const NOTE_PCS = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 };
  const SAFE_PROFILE_INTERVALS = [0,0,0,5,7,12];
  const TIES = [1,2,4,8,16];
  const COLORS = ['#60c6a4','#b68cff','#dfb658','#dc7898','#79b4e3'];
  const SOUNDFONTS = {
    contrabass_arco:'cello',
    contrabass_pizz:'acoustic_bass',
    tuba:'tuba',
    contrabassoon:'bassoon',
    cello_bass:'cello'
  };
  const VELOCITIES = { 1:62, 2:88, 3:112 };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const copy = value => JSON.parse(JSON.stringify(value));
  const pick = items => items[Math.floor(Math.random()*items.length)];
  const mod = (value,base) => ((value%base)+base)%base;
  const projectEnd = project => Math.max(0,...project.sections.map(section=>Number(section.end)||0),...project.tracks.flatMap(track=>(track.notes||[]).map(note=>(Number(note.start)||0)+(Number(note.duration)||0))));
  const secondsPerBeat = project => 60/clamp(Number(project.bpm)||92,30,260);

  const RHYTHMS = {
    driving:[2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0],
    pumping:[0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0],
    walking:[2,0,0,2,2,0,2,0,2,0,0,2,2,0,2,0],
    syncopated:[2,0,0,2,0,2,0,0,2,0,2,0,0,2,0,2],
    anchor:[2,0,0,0,0,0,2,0,2,0,0,0,0,2,0,0],
    gallop:[2,0,2,2,2,0,2,2,2,0,2,2,2,0,2,2]
  };
  const INTERVAL_MAPS = {
    disco:[0,0,12,12,10,10,7,7,0,0,12,12,10,10,7,7],
    lift:[0,7,12,7,0,5,7,10,0,7,12,7,10,7,5,0],
    fifth:[0,0,7,7,12,7,5,7,0,0,7,12,10,7,5,0],
    answer:[0,12,7,10,0,7,5,12,0,10,7,5,0,7,12,10],
    roots:[0,0,0,7,0,0,5,0,0,0,7,12,0,5,7,0]
  };
  const profile = (id,name,rhythm,intervals) => ({ id,name,rhythm_grid:[...rhythm],interval_map:[...intervals] });
  const PROFILES = [
    profile(1,'Disco Box',RHYTHMS.driving,INTERVAL_MAPS.disco),profile(2,'Disco Lift',RHYTHMS.driving,INTERVAL_MAPS.lift),profile(3,'Disco Fifth',RHYTHMS.driving,INTERVAL_MAPS.fifth),profile(4,'Disco Answer',RHYTHMS.driving,INTERVAL_MAPS.answer),profile(5,'Disco Anchor',RHYTHMS.driving,INTERVAL_MAPS.roots),
    profile(6,'Pulse Box',RHYTHMS.pumping,INTERVAL_MAPS.disco),profile(7,'Pulse Lift',RHYTHMS.pumping,INTERVAL_MAPS.lift),profile(8,'Pulse Fifth',RHYTHMS.pumping,INTERVAL_MAPS.fifth),profile(9,'Pulse Answer',RHYTHMS.pumping,INTERVAL_MAPS.answer),profile(10,'Pulse Anchor',RHYTHMS.pumping,INTERVAL_MAPS.roots),
    profile(11,'Night Walker',RHYTHMS.walking,INTERVAL_MAPS.disco),profile(12,'Silver Walker',RHYTHMS.walking,INTERVAL_MAPS.lift),profile(13,'Fifth Walker',RHYTHMS.walking,INTERVAL_MAPS.fifth),profile(14,'Answer Walker',RHYTHMS.walking,INTERVAL_MAPS.answer),profile(15,'Root Walker',RHYTHMS.walking,INTERVAL_MAPS.roots),
    profile(16,'Neon Skip',RHYTHMS.syncopated,INTERVAL_MAPS.disco),profile(17,'Neon Rise',RHYTHMS.syncopated,INTERVAL_MAPS.lift),profile(18,'Funk Fifth',RHYTHMS.syncopated,INTERVAL_MAPS.fifth),profile(19,'Funk Reply',RHYTHMS.syncopated,INTERVAL_MAPS.answer),profile(20,'Funk Anchor',RHYTHMS.syncopated,INTERVAL_MAPS.roots),
    profile(21,'Low Roller',RHYTHMS.anchor,INTERVAL_MAPS.disco),profile(22,'Low Lift',RHYTHMS.anchor,INTERVAL_MAPS.lift),profile(23,'Low Fifth',RHYTHMS.anchor,INTERVAL_MAPS.fifth),profile(24,'Low Answer',RHYTHMS.anchor,INTERVAL_MAPS.answer),profile(25,'Low Anchor',RHYTHMS.anchor,INTERVAL_MAPS.roots),
    profile(26,'Gallop Box',RHYTHMS.gallop,INTERVAL_MAPS.disco),profile(27,'Gallop Lift',RHYTHMS.gallop,INTERVAL_MAPS.lift),profile(28,'Gallop Fifth',RHYTHMS.gallop,INTERVAL_MAPS.fifth),profile(29,'Gallop Reply',RHYTHMS.gallop,INTERVAL_MAPS.answer),profile(30,'Gallop Anchor',RHYTHMS.gallop,INTERVAL_MAPS.roots)
  ];

  let state = {
    mode:'profile',
    phraseBeats:8,
    units:1,
    profileId:1,
    mutationRate:25,
    source:'key',
    instrument:'contrabass_arco',
    register:36,
    writePitch:{kind:'interval',value:0},
    writeTie:1,
    sequence:[],
    custom:{ motion:'pedal', pedal:'root', articulation:82, dynamics:'flat', inversions:false }
  };
  let preview = { context:null,gain:null,player:null,instrument:null,nodes:[],timer:0,running:false };

  function readProject(){
    try{const project=JSON.parse(localStorage.getItem(PROJECT_KEY));if(project&&Array.isArray(project.tracks))return project}catch(_){}
    return {title:'untitled',bpm:92,key:'D minor',sections:[],tracks:[{id:uid('track'),name:'Piano',instrument:'grand_piano',color:COLORS[1],muted:false,solo:false,hidden:false,notes:[]}]};
  }
  function saveProject(project){localStorage.setItem(PROJECT_KEY,JSON.stringify(project))}
  function snapshot(project){
    let history={undo:[],redo:[]};
    try{const saved=JSON.parse(localStorage.getItem(HISTORY_KEY));if(saved&&Array.isArray(saved.undo)&&Array.isArray(saved.redo))history=saved}catch(_){}
    history.undo.push(JSON.stringify(project));if(history.undo.length>100)history.undo.shift();history.redo=[];localStorage.setItem(HISTORY_KEY,JSON.stringify(history));
  }
  function toast(message){const status=$('#status');if(status)status.textContent=message}
  function keyRoot(key){const root=String(key||'C').replace(/\s.*$/,'').replace('♭','b').replace('♯','#');return NOTE_PCS[root]??0}
  function scalePcs(project){const root=keyRoot(project.key);const intervals=/minor/i.test(String(project.key))?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];return intervals.map(interval=>mod(root+interval,12))}
  function sourceTrack(project){return project.tracks.find(track=>track.id===state.source)||null}
  function rootAt(project,beat){
    const guide=sourceTrack(project);if(!guide||!(guide.notes||[]).length)return keyRoot(project.key);const epsilon=.0001;
    const active=guide.notes.filter(note=>Number(note.start)<=beat+epsilon&&Number(note.start)+Number(note.duration)>beat+epsilon);
    if(active.length)return Math.min(...active.map(note=>Number(note.pitch)||60))%12;
    const prior=guide.notes.filter(note=>Number(note.start)<=beat+epsilon);if(!prior.length)return keyRoot(project.key);
    const latest=Math.max(...prior.map(note=>Number(note.start)));return Math.min(...guide.notes.filter(note=>Math.abs(Number(note.start)-latest)<epsilon).map(note=>Number(note.pitch)||60))%12;
  }
  function scaleIntervalsFromRoot(project,rootPc){
    const ordered=[...new Set(scalePcs(project).map(pc=>mod(pc-rootPc,12)))].sort((a,b)=>a-b);if(!ordered.includes(0))ordered.unshift(0);return ordered;
  }
  function degreeInterval(project,rootPc,degree){if(degree===8)return 12;const intervals=scaleIntervalsFromRoot(project,rootPc);return intervals[clamp(Number(degree)||1,1,7)-1]??0}
  function baseRootPitch(rootPc){const base=Number(state.register)||36;return base+mod(rootPc-(base%12),12)}
  function cellLabel(cell){if(!cell)return '—';if(cell.kind==='interval'){const labels={0:'R',5:'4',7:'5',10:'♭7',12:'8'};return labels[cell.value]??String(cell.value)}if(cell.kind==='sharp7')return '♯7';const labels={1:'R',2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8'};return labels[cell.value]||'R'}
  function tieLabel(tie){return ({1:'1/8',2:'1/4',4:'1/2',8:'1 bar',16:'2 bars',32:'phrase'})[tie]||`${tie}×`}
  function makeCell(kind,value,velocity=2,tie=1,fixed=false,stepwise=false){return {kind,value,velocity,tie,fixed,stepwise}}
  function phraseColumns(){return state.phraseBeats*2}
  function selectedProfile(){return PROFILES.find(item=>item.id===state.profileId)||PROFILES[0]}

  function loadProfile(id=state.profileId){
    const profile=PROFILES.find(item=>item.id===Number(id))||PROFILES[0];state.profileId=profile.id;
    state.sequence=Array.from({length:phraseColumns()},(_,index)=>{const source=index%16,velocity=profile.rhythm_grid[source]||0;return velocity?makeCell('interval',profile.interval_map[source]??0,velocity,1):null});
    state.writePitch={kind:'interval',value:0};state.writeTie=1;
  }
  function mutateProfile(){
    const rate=state.mutationRate/100;
    state.sequence=state.sequence.map(cell=>{
      let next=cell?{...cell}:null;
      if(Math.random()<rate)next=next?null:makeCell('interval',pick(SAFE_PROFILE_INTERVALS),2,1);
      if(next&&Math.random()<rate)next.value=pick(SAFE_PROFILE_INTERVALS);
      if(next&&Math.random()<rate*.45)next.velocity=pick([1,2,2,3]);
      return next;
    });
    if(!state.sequence.some(Boolean))state.sequence[0]=makeCell('interval',0,2,1);
  }
  function generateCustom(){
    const columns=phraseColumns(),sequence=Array(columns).fill(null),custom=state.custom;
    const degreeCell=(degree,velocity=2,tie=1,fixed=false,stepwise=false)=>makeCell('degree',degree,velocity,tie,fixed,stepwise);
    if(custom.motion==='pedal'){
      sequence[0]=degreeCell(custom.pedal==='fifth'?5:1,2,columns,true,false);
    } else if(custom.motion==='arpeggio'){
      const contour=[1,3,5,8,5,3,1,5];
      for(let index=0;index<columns;index+=2){
        let degree=contour[(index/2)%contour.length];
        if(custom.inversions&&index%8===0)degree=pick([3,5]);
        sequence[index]=degreeCell(degree,2,2,false,false);
      }
    } else {
      const contour=[1,2,3,4,5,4,3,2,1,2,3,5,6,5,4,2];
      for(let index=0;index<columns;index+=2){
        let degree=contour[(index/2)%contour.length];
        if(custom.inversions&&index%8===0)degree=pick([3,5]);
        sequence[index]=degreeCell(degree,2,2,false,true);
      }
    }
    state.sequence=sequence;state.writePitch={kind:'degree',value:1};state.writeTie=1;
  }

  function resolveInterval(project,cell,rootPc){if(cell.kind==='interval')return Number(cell.value)||0;if(cell.kind==='sharp7')return 11;return degreeInterval(project,rootPc,cell.value)}
  function closestOctave(candidate,previous){if(!Number.isFinite(previous))return candidate;let best=candidate,bestDistance=Math.abs(candidate-previous);for(let offset=-24;offset<=24;offset+=12){const test=candidate+offset;if(test<24||test>72)continue;const distance=Math.abs(test-previous);if(distance<bestDistance||(distance===bestDistance&&test<best)){best=test;bestDistance=distance}}return best}
  function resolvePitch(project,cell,rootPc,previous){let pitch=baseRootPitch(rootPc)+resolveInterval(project,cell,rootPc);if(cell.stepwise)pitch=closestOctave(pitch,previous);return clamp(pitch,24,72)}
  function nextTriggeredDistance(index){for(let cursor=index+1;cursor<state.sequence.length;cursor+=1)if(state.sequence[cursor])return cursor-index;return state.sequence.length-index}
  function articulationGate(){return state.mode==='orchestral'?(.26+(Number(state.custom.articulation)||0)/100*.72):.8}
  function envelope(fraction){if(state.mode!=='orchestral')return 1;const dynamic=state.custom.dynamics;if(dynamic==='crescendo')return .58+.52*fraction;if(dynamic==='decrescendo')return 1.1-.52*fraction;if(dynamic==='swell')return .55+.57*Math.sin(Math.PI*fraction);return 1}
  function chordChanges(project,start,end){const guide=sourceTrack(project);if(!guide)return [];return [...new Set((guide.notes||[]).map(note=>Number(note.start)).filter(time=>time>start+.0001&&time<end-.0001))].sort((a,b)=>a-b)}
  function makeSegmentNotes(project,start,end,cell,groupId,previous,originRoot){
    const points=cell.fixed?[start,end]:[start,...chordChanges(project,start,end),end];const notes=[];let prior=previous;
    for(let index=0;index<points.length-1;index+=1){const from=points[index],to=points[index+1];if(to-from<.03125)continue;const root=cell.fixed?originRoot:rootAt(project,from+.0001);const pitch=resolvePitch(project,cell,root,prior);notes.push({id:uid('note'),start:from,pitch,duration:to-from,velocity:VELOCITIES[cell.velocity]||88,groupId});prior=pitch}
    return {notes,previous:prior};
  }
  function buildBlock(project,start,groupId){
    const notes=[];let previous=null;const originRoot=rootAt(project,start+.0001);
    state.sequence.forEach((cell,index)=>{
      if(!cell)return;const maxColumns=cell.fixed?cell.tie:Math.min(cell.tie,nextTriggeredDistance(index));const rawDuration=maxColumns*.5*articulationGate();const result=makeSegmentNotes(project,start+index*.5,start+index*.5+rawDuration,cell,groupId,previous,originRoot);notes.push(...result.notes);previous=result.previous;
    });return notes;
  }
  function buildPlan(project){
    const end=projectEnd(project),insertAt=end?Math.ceil(end/4)*4:0,totalBeats=32*state.units,groupCount=totalBeats/state.phraseBeats;const groups=[];
    for(let index=0;index<groupCount;index+=1){const groupId=uid('bass-group'),start=insertAt+index*state.phraseBeats;groups.push({groupId,start,beats:state.phraseBeats,notes:buildBlock(project,start,groupId)})}
    const notes=groups.flatMap(group=>group.notes);notes.forEach(note=>{const fraction=clamp((note.start-insertAt)/Math.max(1,totalBeats),0,1);note.velocity=clamp(Math.round(note.velocity*envelope(fraction)),20,127)});return {insertAt,totalBeats,groups,notes};
  }
  function describePlan(project){const plan=buildPlan(project),guide=state.source==='key'?`project key (${project.key})`:(sourceTrack(project)?.name||'project key');const title=state.mode==='profile'?selectedProfile().name:`Custom ${state.custom.motion}`;$('#bassSummary').textContent=`${title} • ${plan.groups.length} × ${state.phraseBeats}-beat groups • ${plan.totalBeats} beats total • starts at beat ${plan.insertAt} • harmony: ${guide}.`}

  function renderGuideChoices(project){const select=$('#bassHarmonySource'),previous=state.source;select.replaceChildren(new Option(`Project key root — ${project.key}`,'key'));project.tracks.filter(track=>(track.notes||[]).length&&!/bass/i.test(track.name)).forEach(track=>select.append(new Option(`Guide track: ${track.name}`,track.id)));if([...select.options].some(option=>option.value===previous))select.value=previous;else{state.source='key';select.value='key'}}
  function renderProfiles(){const select=$('#bassProfileSelect');select.replaceChildren(...PROFILES.map(profile=>new Option(`${String(profile.id).padStart(2,'0')} · ${profile.name}`,String(profile.id))));select.value=String(state.profileId)}
  function paletteItems(){return state.mode==='profile'?[{kind:'interval',value:0,label:'R'},{kind:'interval',value:5,label:'4'},{kind:'interval',value:7,label:'5'},{kind:'interval',value:10,label:'♭7'},{kind:'interval',value:12,label:'8'}]:[{kind:'degree',value:1,label:'R'},{kind:'degree',value:2,label:'2'},{kind:'degree',value:3,label:'3'},{kind:'degree',value:4,label:'4'},{kind:'degree',value:5,label:'5'},{kind:'degree',value:6,label:'6'},{kind:'degree',value:7,label:'7'},{kind:'sharp7',value:11,label:'♯7'},{kind:'degree',value:8,label:'8'}]}
  function renderPitchPalette(){const host=$('#bassIntervalPalette');host.replaceChildren(...paletteItems().map(item=>{const button=document.createElement('button');button.type='button';button.className=`dna-interval-button${state.writePitch.kind===item.kind&&state.writePitch.value===item.value?' selected':''}`;button.dataset.kind=item.kind;button.dataset.value=String(item.value);button.textContent=item.label;return button}))}
  function renderTiePalette(){const host=$('#bassTiePalette');host.replaceChildren(...TIES.map(tie=>{const button=document.createElement('button');button.type='button';button.className=`dna-tie-button${state.writeTie===tie?' selected':''}`;button.dataset.tie=String(tie);button.textContent=tieLabel(tie);return button}))}
  function renderEditor(){
    const host=$('#bassStepGrid'),columns=phraseColumns();host.replaceChildren();
    const rows=[{mode:'rhythm',label:'Rhythm',hint:'note/rest'},{mode:'tune',label:'Tune',hint:'interval'},{mode:'tie',label:'Tie',hint:'length'}];
    rows.forEach(rowData=>{const row=document.createElement('div');row.className='dna-row';const label=document.createElement('div');label.className='dna-row-label';label.innerHTML=`${rowData.label}<small>${rowData.hint}</small>`;const grid=document.createElement('div');grid.className='dna-grid';grid.style.setProperty('--dna-step-count',String(columns));for(let index=0;index<columns;index+=1){const cell=state.sequence[index],active=Boolean(cell),button=document.createElement('button');button.type='button';button.dataset.step=String(index);button.dataset.mode=rowData.mode;button.className=`dna-cell dna-${rowData.mode}${active?' is-on':''}${active?` velocity-${cell.velocity}`:''}${index%8===0?' bar-start':''}${index%2===0?' beat-start':''}`;button.textContent=rowData.mode==='rhythm'?(active?(cell.velocity===3?'●':cell.velocity===2?'•':'·'):''):rowData.mode==='tune'?(active?cellLabel(cell):'—'):(active?tieLabel(cell.tie):'—');grid.append(button)}row.append(label,grid);host.append(row)});
    const bars=[];for(let bar=0;bar<state.phraseBeats/4;bar+=1)bars.push(String(bar+1));$('#bassBarLabels').textContent=`Bars: ${bars.join('      ')}`;
  }
  function renderMode(){const custom=state.mode==='orchestral';$('#bassProfileControls').hidden=custom;$('#bassCustomControls').hidden=!custom;$$('.bass-mode-tab').forEach(button=>button.classList.toggle('selected',button.dataset.mode===state.mode));$('#bassEditorTitle').textContent=custom?'Editable orchestral bass line':'Editable bass tune';$('#bassEditorText').textContent=custom?'Rhythm controls notes and rests. Tune uses diatonic degrees relative to each chord root. Tie holds a note across columns; articulation decides whether the tie is staccato or legato.':'Rhythm controls notes and rests. Tune stores safe intervals above the active chord root. Tie controls how long a generated note holds.'}
  function renderModal(){const project=readProject();renderGuideChoices(project);renderProfiles();renderMode();$('#bassLength').value=String(state.units);$('#bassLengthValue').textContent=`${state.units} × 32 beats = ${state.units*32} beats`;$('#bassMutationRate').value=String(state.mutationRate);$('#bassMutationOutput').textContent=`${state.mutationRate}% mutation`;$('#bassInstrument').value=state.instrument;$('#bassRegister').value=String(state.register);$('#bassCustomMotion').value=state.custom.motion;$('#bassPedalTarget').value=state.custom.pedal;$('#bassArticulation').value=String(state.custom.articulation);$('#bassArticulationOutput').textContent=state.custom.articulation<35?'Staccato':state.custom.articulation>75?'Legato':'Balanced';$('#bassDynamics').value=state.custom.dynamics;$('#bassInversions').checked=state.custom.inversions;$$('.bass-phrase').forEach(button=>button.classList.toggle('selected',Number(button.dataset.beats)===state.phraseBeats));renderPitchPalette();renderTiePalette();renderEditor();describePlan(project)}
  function openModal(){stopPreview();if(!state.sequence.length||state.sequence.length!==phraseColumns())loadProfile(state.profileId);renderModal();$('#bassModal').hidden=false}
  function closeModal(){stopPreview();$('#bassModal').hidden=true}

  function ensureAudio(){if(preview.context){if(preview.context.state==='suspended')preview.context.resume().catch(()=>{});return preview.context}const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return null;preview.context=new Context();preview.gain=preview.context.createGain();preview.gain.gain.value=.78;preview.gain.connect(preview.context.destination);return preview.context}
  async function previewPlayer(){const context=ensureAudio();if(!context||!window.Soundfont)return null;if(preview.player&&preview.instrument===state.instrument)return preview.player;preview.player=null;preview.instrument=state.instrument;try{preview.player=await window.Soundfont.instrument(context,SOUNDFONTS[state.instrument],{soundfont:'MusyngKite',format:'mp3',destination:preview.gain,gain:.94});return preview.player}catch(_){return null}}
  function stopPreview(){clearTimeout(preview.timer);preview.timer=0;preview.nodes.splice(0).forEach(node=>{try{node.stop?.()}catch(_){}});preview.running=false;const button=$('#bassPreview');if(button){button.textContent='▶ Preview';button.classList.remove('is-previewing')}}
  async function previewPhrase(){if(preview.running){stopPreview();return}const project=readProject(),player=await previewPlayer();if(!player){toast('Bass sample could not load.');return}const plan=buildPlan(project),start=plan.insertAt,events=plan.notes.filter(note=>note.start<start+32),now=preview.context.currentTime+.06,perBeat=secondsPerBeat(project);preview.running=true;$('#bassPreview').textContent='⏹ Stop Preview';$('#bassPreview').classList.add('is-previewing');events.forEach(note=>{try{const node=player.play(note.pitch,now+(note.start-start)*perBeat,{duration:Math.max(.08,note.duration*perBeat),gain:clamp(note.velocity/127,.15,.95),attack:.008,release:.16});if(node?.stop)preview.nodes.push(node)}catch(_){}});preview.timer=window.setTimeout(stopPreview,Math.max(600,Math.min(32000,32*perBeat*1000+260)))}

  function findBassTrack(project){let track=project.tracks.find(candidate=>/bass/i.test(candidate.name)||candidate.instrument==='acoustic_bass');if(!track){track={id:uid('track'),name:'Bass',instrument:'cello',color:COLORS[0],muted:false,solo:false,hidden:false,notes:[]};project.tracks.push(track)}track.instrument=SOUNDFONTS[state.instrument];return track}
  function addToTimeline(){const project=readProject(),plan=buildPlan(project);if(!plan.notes.length){toast('Add at least one triggered step first.');return}snapshot(copy(project));findBassTrack(project).notes.push(...plan.notes);saveProject(project);sessionStorage.setItem(TOAST_KEY,`Added ${plan.groups.length} bass group${plan.groups.length===1?'':'s'} to the timeline.`);window.location.reload()}
  function editCell(step,mode,rightClick){const cell=state.sequence[step];if(mode==='rhythm'){if(rightClick){if(cell)cell.velocity=cell.velocity%3+1;else state.sequence[step]=makeCell(state.writePitch.kind,state.writePitch.value,1,state.writeTie)}else state.sequence[step]=cell?null:makeCell(state.writePitch.kind,state.writePitch.value,2,state.writeTie)}else if(mode==='tune'){if(rightClick){if(cell)cell.velocity=cell.velocity%3+1;else state.sequence[step]=makeCell(state.writePitch.kind,state.writePitch.value,1,state.writeTie)}else state.sequence[step]=cell?{...cell,kind:state.writePitch.kind,value:state.writePitch.value}:{...makeCell(state.writePitch.kind,state.writePitch.value,2,state.writeTie),stepwise:state.mode==='orchestral'&&state.custom.motion==='stepwise'}}else{if(!cell)state.sequence[step]=makeCell(state.writePitch.kind,state.writePitch.value,2,state.writeTie);else if(rightClick){const position=TIES.indexOf(cell.tie);cell.tie=TIES[(position+1)%TIES.length]}else cell.tie=state.writeTie}renderEditor();describePlan(readProject())}

  function enableFloatingWindow(){const card=$('#bassModalCard'),header=$('#bassModalHeader'),grip=$('#bassResizeGrip');if(!card||!header||!grip)return;header.addEventListener('pointerdown',event=>{if(event.target.closest('button,input,select,label'))return;event.preventDefault();const rect=card.getBoundingClientRect();card.style.position='fixed';card.style.margin='0';card.style.left=`${rect.left}px`;card.style.top=`${rect.top}px`;const offsetX=event.clientX-rect.left,offsetY=event.clientY-rect.top;const move=moveEvent=>{card.style.left=`${clamp(moveEvent.clientX-offsetX,0,window.innerWidth-card.offsetWidth)}px`;card.style.top=`${clamp(moveEvent.clientY-offsetY,0,window.innerHeight-card.offsetHeight)}px`};const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true})});grip.addEventListener('pointerdown',event=>{event.preventDefault();const startX=event.clientX,startY=event.clientY,rect=card.getBoundingClientRect();card.style.position='fixed';card.style.margin='0';card.style.left=`${rect.left}px`;card.style.top=`${rect.top}px`;grip.classList.add('resizing');const move=moveEvent=>{card.style.width=`${clamp(Math.round(rect.width+moveEvent.clientX-startX),660,window.innerWidth-20)}px`;card.style.height=`${clamp(Math.round(rect.height+moveEvent.clientY-startY),500,window.innerHeight-20)}px`};const end=()=>{grip.classList.remove('resizing');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true})})}
  function bind(){
    document.addEventListener('click',event=>{const trigger=event.target.closest('#quickBass');if(!trigger)return;event.preventDefault();event.stopImmediatePropagation();openModal()},true);
    $('#bassClose')?.addEventListener('click',closeModal);$('#bassPreview')?.addEventListener('click',previewPhrase);$('#bassAdd')?.addEventListener('click',addToTimeline);
    $('#bassModeTabs')?.addEventListener('click',event=>{const button=event.target.closest('.bass-mode-tab');if(!button)return;state.mode=button.dataset.mode;if(state.mode==='orchestral')generateCustom();else loadProfile(state.profileId);renderModal()});
    $('#bassLoadProfile')?.addEventListener('click',()=>{state.profileId=Number($('#bassProfileSelect').value);loadProfile(state.profileId);renderModal()});$('#bassRandomProfile')?.addEventListener('click',()=>{state.profileId=pick(PROFILES).id;loadProfile(state.profileId);renderModal()});$('#bassMutate')?.addEventListener('click',()=>{mutateProfile();renderModal()});
    $('#bassGenerateCustom')?.addEventListener('click',()=>{generateCustom();renderModal()});
    $('#bassLength')?.addEventListener('input',event=>{state.units=Number(event.target.value);$('#bassLengthValue').textContent=`${state.units} × 32 beats = ${state.units*32} beats`;describePlan(readProject())});$('#bassMutationRate')?.addEventListener('input',event=>{state.mutationRate=Number(event.target.value);$('#bassMutationOutput').textContent=`${state.mutationRate}% mutation`});
    $('#bassHarmonySource')?.addEventListener('change',event=>{state.source=event.target.value;describePlan(readProject())});$('#bassInstrument')?.addEventListener('change',event=>{state.instrument=event.target.value});$('#bassRegister')?.addEventListener('change',event=>{state.register=Number(event.target.value);describePlan(readProject())});
    $('#bassCustomMotion')?.addEventListener('change',event=>{state.custom.motion=event.target.value});$('#bassPedalTarget')?.addEventListener('change',event=>{state.custom.pedal=event.target.value});$('#bassArticulation')?.addEventListener('input',event=>{state.custom.articulation=Number(event.target.value);$('#bassArticulationOutput').textContent=state.custom.articulation<35?'Staccato':state.custom.articulation>75?'Legato':'Balanced'});$('#bassDynamics')?.addEventListener('change',event=>{state.custom.dynamics=event.target.value});$('#bassInversions')?.addEventListener('change',event=>{state.custom.inversions=event.target.checked});
    $('#bassPhraseChoices')?.addEventListener('click',event=>{const button=event.target.closest('.bass-phrase');if(!button)return;state.phraseBeats=Number(button.dataset.beats);if(state.mode==='profile')loadProfile(state.profileId);else generateCustom();renderModal()});
    $('#bassIntervalPalette')?.addEventListener('click',event=>{const button=event.target.closest('.dna-interval-button');if(!button)return;state.writePitch={kind:button.dataset.kind,value:Number(button.dataset.value)};renderPitchPalette()});$('#bassTiePalette')?.addEventListener('click',event=>{const button=event.target.closest('.dna-tie-button');if(!button)return;state.writeTie=Number(button.dataset.tie);renderTiePalette()});
    $('#bassStepGrid')?.addEventListener('click',event=>{const cell=event.target.closest('.dna-cell');if(cell)editCell(Number(cell.dataset.step),cell.dataset.mode,false)});$('#bassStepGrid')?.addEventListener('contextmenu',event=>{const cell=event.target.closest('.dna-cell');if(!cell)return;event.preventDefault();editCell(Number(cell.dataset.step),cell.dataset.mode,true)});enableFloatingWindow();
  }
  loadProfile(1);bind();
})();