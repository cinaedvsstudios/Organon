(() => {
  'use strict';

  const PROJECT_KEY = 'ihy-v042-project';
  const HISTORY_KEY = 'ihy-v042-history';
  const TOAST_KEY = 'ihy-v045-toast';
  const NOTE_PCS = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 };
  const TIES = [1, 2, 4, 8, 16];
  const COLORS = ['#60c6a4', '#b68cff', '#dfb658', '#dc7898', '#79b4e3'];
  const VELOCITIES = { 1:62, 2:88, 3:112 };
  const SOUNDFONTS = { contrabass_arco:'cello', contrabass_pizz:'acoustic_bass', tuba:'tuba', contrabassoon:'bassoon', cello_bass:'cello' };
  const SAVED_INSTRUMENTS = { contrabass_arco:'cello', contrabass_pizz:'acoustic_guitar', tuba:'horn', contrabassoon:'horn', cello_bass:'cello' };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const copy = value => JSON.parse(JSON.stringify(value));
  const pick = values => values[Math.floor(Math.random()*values.length)];
  const mod = (value,base) => ((value % base) + base) % base;
  const chance = probability => Math.random() < probability;

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
  const GENRE_PROFILES = [
    profile(1,'Disco Box',RHYTHMS.driving,INTERVAL_MAPS.disco),profile(2,'Disco Lift',RHYTHMS.driving,INTERVAL_MAPS.lift),profile(3,'Disco Fifth',RHYTHMS.driving,INTERVAL_MAPS.fifth),profile(4,'Disco Answer',RHYTHMS.driving,INTERVAL_MAPS.answer),profile(5,'Disco Anchor',RHYTHMS.driving,INTERVAL_MAPS.roots),
    profile(6,'Pulse Box',RHYTHMS.pumping,INTERVAL_MAPS.disco),profile(7,'Pulse Lift',RHYTHMS.pumping,INTERVAL_MAPS.lift),profile(8,'Pulse Fifth',RHYTHMS.pumping,INTERVAL_MAPS.fifth),profile(9,'Pulse Answer',RHYTHMS.pumping,INTERVAL_MAPS.answer),profile(10,'Pulse Anchor',RHYTHMS.pumping,INTERVAL_MAPS.roots),
    profile(11,'Night Walker',RHYTHMS.walking,INTERVAL_MAPS.disco),profile(12,'Silver Walker',RHYTHMS.walking,INTERVAL_MAPS.lift),profile(13,'Fifth Walker',RHYTHMS.walking,INTERVAL_MAPS.fifth),profile(14,'Answer Walker',RHYTHMS.walking,INTERVAL_MAPS.answer),profile(15,'Root Walker',RHYTHMS.walking,INTERVAL_MAPS.roots),
    profile(16,'Neon Skip',RHYTHMS.syncopated,INTERVAL_MAPS.disco),profile(17,'Neon Rise',RHYTHMS.syncopated,INTERVAL_MAPS.lift),profile(18,'Funk Fifth',RHYTHMS.syncopated,INTERVAL_MAPS.fifth),profile(19,'Funk Reply',RHYTHMS.syncopated,INTERVAL_MAPS.answer),profile(20,'Funk Anchor',RHYTHMS.syncopated,INTERVAL_MAPS.roots),
    profile(21,'Low Roller',RHYTHMS.anchor,INTERVAL_MAPS.disco),profile(22,'Low Lift',RHYTHMS.anchor,INTERVAL_MAPS.lift),profile(23,'Low Fifth',RHYTHMS.anchor,INTERVAL_MAPS.fifth),profile(24,'Low Answer',RHYTHMS.anchor,INTERVAL_MAPS.answer),profile(25,'Low Anchor',RHYTHMS.anchor,INTERVAL_MAPS.roots),
    profile(26,'Gallop Box',RHYTHMS.gallop,INTERVAL_MAPS.disco),profile(27,'Gallop Lift',RHYTHMS.gallop,INTERVAL_MAPS.lift),profile(28,'Gallop Fifth',RHYTHMS.gallop,INTERVAL_MAPS.fifth),profile(29,'Gallop Reply',RHYTHMS.gallop,INTERVAL_MAPS.answer),profile(30,'Gallop Anchor',RHYTHMS.gallop,INTERVAL_MAPS.roots)
  ];
  const EMOTIONS = [
    { id:'aspirational', name:'Aspirational', tempo:'76–116 BPM', allowed:[0,5,7,12], summary:'Sparse opening that rises into a broad, open lift.' },
    { id:'showstopping', name:'Showstopping', tempo:'118–154 BPM', allowed:[0,4,7,9,12], summary:'Relentless bounce with forced structural downbeats.' },
    { id:'romantic', name:'Romantic / Yearning', tempo:'62–100 BPM', allowed:[0,3,7,8,12], summary:'Anticipated notes and live-feeling dynamic waves.' },
    { id:'cabaret', name:'Cabaret / Sassy', tempo:'72–112 BPM', allowed:[0,7,10,11], summary:'Heavy gaps, bold struts and theatrical accents.' },
    { id:'scheming', name:'Scheming', tempo:'70–122 BPM', allowed:[0,3,6,10], summary:'Tight clusters, abrupt silence and villain dissonance.' },
    { id:'effervescent', name:'Effervescent', tempo:'104–142 BPM', allowed:[0,4,12], summary:'Light high offbeats with no muddy sub-bass.' }
  ];

  let state = {
    mode:'profile', library:'genre', genreId:1, emotionId:'aspirational', phraseBeats:8, units:1, mutationRate:25,
    source:'key', instrument:'contrabass_arco', register:36, writePitch:{kind:'interval',value:0}, writeTie:2, sequence:[], manualEdit:false,
    custom:{ motion:'pedal', pedal:'root', articulation:82, dynamics:'flat', inversions:false }
  };
  let preview = { context:null,gain:null,player:null,instrument:null,nodes:[],timer:0,running:false };

  function readProject(){
    try { const project=JSON.parse(localStorage.getItem(PROJECT_KEY)); if(project&&Array.isArray(project.tracks))return project; } catch(_){}
    return {title:'untitled',bpm:92,key:'D minor',sections:[],tracks:[{id:uid('track'),name:'Piano',instrument:'grand_piano',color:COLORS[1],muted:false,solo:false,hidden:false,notes:[]}]};
  }
  function saveProject(project){localStorage.setItem(PROJECT_KEY,JSON.stringify(project));}
  function snapshot(project){
    let history={undo:[],redo:[]};
    try { const saved=JSON.parse(localStorage.getItem(HISTORY_KEY)); if(saved&&Array.isArray(saved.undo)&&Array.isArray(saved.redo))history=saved; } catch(_){}
    history.undo.push(JSON.stringify(project));if(history.undo.length>100)history.undo.shift();history.redo=[];localStorage.setItem(HISTORY_KEY,JSON.stringify(history));
  }
  function toast(message){const status=$('#status');if(status)status.textContent=message;}
  function projectEnd(project){return Math.max(0,...project.sections.map(section=>Number(section.end)||0),...project.tracks.flatMap(track=>(track.notes||[]).map(note=>(Number(note.start)||0)+(Number(note.duration)||0))));}
  function secondsPerBeat(project){return 60/clamp(Number(project.bpm)||92,30,260);}
  function isMinor(project){return /minor/i.test(String(project.key));}
  function keyRoot(key){const root=String(key||'C').replace(/\s.*$/,'').replace('♭','b').replace('♯','#');return NOTE_PCS[root]??0;}
  function scalePcs(project){const root=keyRoot(project.key),intervals=isMinor(project)?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];return intervals.map(interval=>mod(root+interval,12));}
  function sourceTrack(project){return project.tracks.find(track=>track.id===state.source)||null;}
  function rootAt(project,beat){
    const guide=sourceTrack(project);if(!guide||!(guide.notes||[]).length)return keyRoot(project.key);const epsilon=.0001;
    const active=guide.notes.filter(note=>Number(note.start)<=beat+epsilon&&Number(note.start)+Number(note.duration)>beat+epsilon);
    if(active.length)return Math.min(...active.map(note=>Number(note.pitch)||60))%12;
    const prior=guide.notes.filter(note=>Number(note.start)<=beat+epsilon);if(!prior.length)return keyRoot(project.key);
    const latest=Math.max(...prior.map(note=>Number(note.start)));return Math.min(...guide.notes.filter(note=>Math.abs(Number(note.start)-latest)<epsilon).map(note=>Number(note.pitch)||60))%12;
  }
  function scaleIntervalsFromRoot(project,rootPc){const ordered=[...new Set(scalePcs(project).map(pc=>mod(pc-rootPc,12)))].sort((a,b)=>a-b);if(!ordered.includes(0))ordered.unshift(0);return ordered;}
  function degreeInterval(project,rootPc,degree){if(degree===8)return 12;return scaleIntervalsFromRoot(project,rootPc)[clamp(Number(degree)||1,1,7)-1]??0;}
  function baseRootPitch(rootPc,offset=0){const base=(Number(state.register)||36)+offset;return base+mod(rootPc-(base%12),12);}
  function thirdLabel(project){return isMinor(project)?'♭3':'3';}
  function cellLabel(project,cell){
    if(!cell)return '—';
    if(cell.kind==='interval')return ({0:'R',3:'♭3',4:'3',5:'4',6:'♭5',7:'5',8:'♭6',9:'6',10:'♭7',11:'7',12:'8'})[cell.value]??String(cell.value);
    if(cell.kind==='sharp7')return '♯7';
    return ({1:'R',2:'2',3:thirdLabel(project),4:'4',5:'5',6:'6',7:'7',8:'8'})[cell.value]||'R';
  }
  function tieLabel(tie){return ({1:'1/16',2:'1/8',4:'1/4',8:'1/2',16:'1 bar',32:'2 bars'})[tie]||`${tie}×`;}
  function makeCell(kind,value,velocity=2,tie=2,extra={}){return {kind,value,velocity,tie,...extra};}
  function phraseColumns(){return state.phraseBeats*4;}
  function activeGenre(){return GENRE_PROFILES.find(item=>item.id===state.genreId)||GENRE_PROFILES[0];}
  function activeEmotion(){return EMOTIONS.find(item=>item.id===state.emotionId)||EMOTIONS[0];}
  function activeProfileName(){return state.library==='genre'?activeGenre().name:activeEmotion().name;}

  function loadGenre(id=state.genreId){
    const profile=GENRE_PROFILES.find(item=>item.id===Number(id))||GENRE_PROFILES[0];state.genreId=profile.id;
    state.sequence=Array.from({length:phraseColumns()},(_,index)=>{const source=index%16,velocity=profile.rhythm_grid[source]||0;return velocity?makeCell('interval',profile.interval_map[source]??0,velocity,2):null;});
    state.writePitch={kind:'interval',value:0};state.writeTie=2;state.manualEdit=false;
  }
  function emotionSequence(emotion,groupIndex=0,groupCount=1){
    const columns=phraseColumns(),sequence=Array(columns).fill(null),bars=Math.max(1,state.phraseBeats/4);
    const add=(index,interval,velocity=2,tie=2,extra={})=>{if(index>=0&&index<columns)sequence[index]=makeCell('interval',interval,velocity,tie,extra);};
    for(let bar=0;bar<bars;bar++){
      const start=bar*16,globalBar=groupIndex*bars+bar,totalBars=Math.max(1,groupCount*bars),progress=(globalBar+.5)/totalBars;
      if(emotion.id==='aspirational'){
        const count=progress<.5?(bar%2?2:1):4+((bar+groupIndex)%3);[0,4,8,12,2,6,10,14].slice(0,count).forEach(position=>add(start+position,pick(emotion.allowed),progress>.5?2:1,2));
      }
      if(emotion.id==='showstopping'){
        add(start,0,3,2);add(start+4,pick([7,12]),2,2);[2,6,8,10,12,14].filter(()=>chance(.56)).forEach(position=>add(start+position,pick(emotion.allowed),2,2));
      }
      if(emotion.id==='romantic'){
        if(!(bar===0&&groupIndex===0))add(start-1,pick([0,3,7]),2,4);else add(start,0,2,4);[6,10].filter(()=>chance(.56)).forEach(position=>add(start+position,pick(emotion.allowed),pick([1,2,2,3]),4));
      }
      if(emotion.id==='cabaret'){
        add(start,0,3,4);add(start+8,pick([0,7]),3,4);[4,12,14].filter(()=>chance(.52)).forEach(position=>add(start+position,pick(emotion.allowed),1,2));
      }
      if(emotion.id==='scheming'){
        const cluster=pick([0,4,8,12]);[0,1,2].slice(0,pick([2,3])).forEach(offset=>add(start+cluster+offset,pick(emotion.allowed),pick([1,2,3]),pick([1,2,4,8])));if(chance(.5))add(start+pick([3,7,11,15]),pick(emotion.allowed),1,pick([1,8]));
      }
      if(emotion.id==='effervescent'){
        [2,6,10,14].filter(()=>chance(.72)).forEach(position=>add(start+position,pick(emotion.allowed),pick([1,2,2]),1,{octaveOffset:12}));[1,3,5,7,9,11,13,15].filter(()=>chance(.22)).forEach(position=>add(start+position,pick(emotion.allowed),1,1,{octaveOffset:12}));
      }
    }
    if(!sequence.some(Boolean))sequence[0]=makeCell('interval',0,2,2);return sequence;
  }
  function loadEmotion(id=state.emotionId){const emotion=EMOTIONS.find(item=>item.id===id)||EMOTIONS[0];state.emotionId=emotion.id;state.sequence=emotionSequence(emotion,0,Math.max(1,(32*state.units)/state.phraseBeats));state.writePitch={kind:'interval',value:emotion.allowed[0]};state.writeTie=2;state.manualEdit=false;}
  function mutateGenre(){
    const rate=state.mutationRate/100,randomPitch=()=>pick([{kind:'interval',value:0},{kind:'interval',value:5},{kind:'interval',value:7},{kind:'interval',value:12},{kind:'degree',value:3}]);
    state.sequence=state.sequence.map(cell=>{let next=cell?{...cell}:null;if(chance(rate))next=next?null:makeCell(randomPitch().kind,randomPitch().value,2,2);if(next&&chance(rate))Object.assign(next,randomPitch());if(next&&chance(rate*.45))next.velocity=pick([1,2,2,3]);return next;});
    if(!state.sequence.some(Boolean))state.sequence[0]=makeCell('interval',0,2,2);state.manualEdit=true;
  }
  function generateCustom(){
    const columns=phraseColumns(),sequence=Array(columns).fill(null),custom=state.custom,degree=(value,velocity=2,tie=4,extra={})=>makeCell('degree',value,velocity,tie,extra);
    if(custom.motion==='pedal')sequence[0]=degree(custom.pedal==='fifth'?5:1,2,columns,{fixed:true});
    else if(custom.motion==='arpeggio'){const contour=[1,3,5,8,5,3,1,5];for(let index=0;index<columns;index+=4){let value=contour[(index/4)%contour.length];if(custom.inversions&&index%16===0)value=pick([3,5]);sequence[index]=degree(value,2,4);}}
    else {const contour=[1,2,3,4,5,4,3,2,1,2,3,5,6,5,4,2];for(let index=0;index<columns;index+=4){let value=contour[(index/4)%contour.length];if(custom.inversions&&index%16===0)value=pick([3,5]);sequence[index]=degree(value,2,4,{stepwise:true});}}
    state.sequence=sequence;state.writePitch={kind:'degree',value:1};state.writeTie=4;state.manualEdit=false;
  }

  function resolveInterval(project,cell,rootPc){if(cell.kind==='interval')return Number(cell.value)||0;if(cell.kind==='sharp7')return 11;return degreeInterval(project,rootPc,cell.value);}
  function closestOctave(candidate,previous){if(!Number.isFinite(previous))return candidate;let best=candidate,distance=Math.abs(candidate-previous);for(let offset=-36;offset<=36;offset+=12){const test=candidate+offset;if(test<24||test>72)continue;const next=Math.abs(test-previous);if(next<distance||(next===distance&&test<best)){best=test;distance=next;}}return best;}
  function resolvePitch(project,cell,rootPc,previous){let pitch=baseRootPitch(rootPc,cell.octaveOffset||0)+resolveInterval(project,cell,rootPc);if(cell.stepwise)pitch=closestOctave(pitch,previous);return clamp(pitch,24,72);}
  function nextDistance(sequence,index){for(let cursor=index+1;cursor<sequence.length;cursor++)if(sequence[cursor])return cursor-index;return sequence.length-index;}
  function articulationGate(){return state.mode==='orchestral'?.26+(Number(state.custom.articulation)||0)/100*.72:.82;}
  function envelope(fraction){if(state.mode==='orchestral'){if(state.custom.dynamics==='crescendo')return .58+.52*fraction;if(state.custom.dynamics==='decrescendo')return 1.1-.52*fraction;if(state.custom.dynamics==='swell')return .55+.57*Math.sin(Math.PI*fraction);}if(state.mode==='profile'&&state.library==='emotion'&&activeEmotion().id==='aspirational')return 1+.12*fraction;return 1;}
  function chordChanges(project,start,end){const guide=sourceTrack(project);if(!guide)return [];return [...new Set((guide.notes||[]).map(note=>Number(note.start)).filter(time=>time>start+.0001&&time<end-.0001))].sort((a,b)=>a-b);}
  function segmentNotes(project,start,end,cell,groupId,previous,originRoot){const points=cell.fixed?[start,end]:[start,...chordChanges(project,start,end),end],notes=[];let prior=previous;for(let index=0;index<points.length-1;index++){const from=points[index],to=points[index+1];if(to-from<.03125)continue;const root=cell.fixed?originRoot:rootAt(project,from+.0001),pitch=resolvePitch(project,cell,root,prior);notes.push({id:uid('note'),start:from,pitch,duration:to-from,velocity:VELOCITIES[cell.velocity]||88,groupId});prior=pitch;}return {notes,previous:prior};}
  function sequenceForBlock(index,count){return state.mode==='profile'&&state.library==='emotion'&&!state.manualEdit?emotionSequence(activeEmotion(),index,count):state.sequence;}
  function buildBlock(project,start,groupId,index,count){const sequence=sequenceForBlock(index,count),notes=[];let previous=null;const originRoot=rootAt(project,start+.0001);sequence.forEach((cell,step)=>{if(!cell)return;const columns=cell.fixed?Math.min(cell.tie,sequence.length-step):Math.min(cell.tie,nextDistance(sequence,step)),duration=columns*.25*articulationGate(),result=segmentNotes(project,start+step*.25,start+step*.25+duration,cell,groupId,previous,originRoot);notes.push(...result.notes);previous=result.previous;});return notes;}
  function buildPlan(project){const end=projectEnd(project),insertAt=end?Math.ceil(end/4)*4:0,totalBeats=32*state.units,groupCount=totalBeats/state.phraseBeats,groups=[];for(let index=0;index<groupCount;index++){const groupId=uid('bass-group'),start=insertAt+index*state.phraseBeats;groups.push({groupId,start,beats:state.phraseBeats,notes:buildBlock(project,start,groupId,index,groupCount)});}const notes=groups.flatMap(group=>group.notes);notes.forEach(note=>{const fraction=clamp((note.start-insertAt)/Math.max(1,totalBeats),0,1);note.velocity=clamp(Math.round(note.velocity*envelope(fraction)),20,127);});return {insertAt,totalBeats,groups,notes};}
  function describePlan(project){const plan=buildPlan(project),guide=state.source==='key'?`project key (${project.key})`:(sourceTrack(project)?.name||'project key');let detail='';if(state.mode==='profile'&&state.library==='emotion'){const emotion=activeEmotion(),range=emotion.tempo.split('–').map(Number),bpm=Number(project.bpm)||92;detail=` • Tempo guide: ${emotion.tempo}${bpm<range[0]||bpm>range[1]?' (current BPM outside guide)':''}`;}$('#bassSummary').textContent=`${state.mode==='orchestral'?`Custom ${state.custom.motion}`:activeProfileName()} • ${plan.groups.length} × ${state.phraseBeats}-beat groups • ${plan.totalBeats} beats total • starts at beat ${plan.insertAt} • harmony: ${guide}${detail}.`;}

  function renderGuideChoices(project){const select=$('#bassHarmonySource'),previous=state.source;select.replaceChildren(new Option(`Project key root — ${project.key}`,'key'));project.tracks.filter(track=>(track.notes||[]).length&&!/bass/i.test(track.name)).forEach(track=>select.append(new Option(`Guide track: ${track.name}`,track.id)));if([...select.options].some(option=>option.value===previous))select.value=previous;else{state.source='key';select.value='key';}}
  function renderProfiles(){const select=$('#bassProfileSelect');if(state.library==='genre'){select.replaceChildren(...GENRE_PROFILES.map(profile=>new Option(`${String(profile.id).padStart(2,'0')} · ${profile.name}`,String(profile.id))));select.value=String(state.genreId);}else{select.replaceChildren(...EMOTIONS.map(profile=>new Option(profile.name,profile.id)));select.value=state.emotionId;}const toggle=$('#bassLibraryToggle');if(toggle){toggle.textContent=state.library==='genre'?'Genre':'Emotion';toggle.title=state.library==='genre'?'Switch to Emotion profiles':'Switch to Genre profiles';}const detail=$('#bassEmotionDetail');if(detail){detail.hidden=state.library!=='emotion';detail.textContent=state.library==='emotion'?`${activeEmotion().summary} Tempo guide: ${activeEmotion().tempo}.`:'';}}
  function paletteItems(project){if(state.mode==='orchestral')return[{kind:'degree',value:1,label:'R'},{kind:'degree',value:2,label:'2'},{kind:'degree',value:3,label:thirdLabel(project)},{kind:'degree',value:4,label:'4'},{kind:'degree',value:5,label:'5'},{kind:'degree',value:6,label:'6'},{kind:'degree',value:7,label:'7'},{kind:'sharp7',value:11,label:'♯7'},{kind:'degree',value:8,label:'8'}];return[{kind:'interval',value:0,label:'R'},{kind:'degree',value:3,label:thirdLabel(project)},{kind:'interval',value:5,label:'4'},{kind:'interval',value:7,label:'5'},{kind:'interval',value:10,label:'♭7'},{kind:'interval',value:12,label:'8'}];}
  function renderPitchPalette(project){const host=$('#bassIntervalPalette');host.replaceChildren(...paletteItems(project).map(item=>{const button=document.createElement('button');button.type='button';button.className=`dna-interval-button${state.writePitch.kind===item.kind&&state.writePitch.value===item.value?' selected':''}`;button.dataset.kind=item.kind;button.dataset.value=String(item.value);button.textContent=item.label;return button;}));}
  function renderTiePalette(){const host=$('#bassTiePalette');host.replaceChildren(...TIES.map(tie=>{const button=document.createElement('button');button.type='button';button.className=`dna-tie-button${state.writeTie===tie?' selected':''}`;button.dataset.tie=String(tie);button.textContent=tieLabel(tie);return button;}));}
  function renderEditor(project){const host=$('#bassStepGrid'),columns=phraseColumns();host.replaceChildren();[{mode:'rhythm',label:'Rhythm',hint:'note/rest'},{mode:'tune',label:'Tune',hint:'interval'},{mode:'tie',label:'Tie',hint:'length'}].forEach(rowData=>{const row=document.createElement('div');row.className='dna-row';const label=document.createElement('div');label.className='dna-row-label';label.innerHTML=`${rowData.label}<small>${rowData.hint}</small>`;const grid=document.createElement('div');grid.className='dna-grid';grid.style.setProperty('--dna-step-count',String(columns));for(let index=0;index<columns;index++){const cell=state.sequence[index],active=Boolean(cell),button=document.createElement('button');button.type='button';button.dataset.step=String(index);button.dataset.mode=rowData.mode;button.className=`dna-cell dna-${rowData.mode}${active?' is-on':''}${active?` velocity-${cell.velocity}`:''}${index%16===0?' bar-start':''}${index%4===0?' beat-start':''}`;button.textContent=rowData.mode==='rhythm'?(active?(cell.velocity===3?'●':cell.velocity===2?'•':'·'):''):rowData.mode==='tune'?(active?cellLabel(project,cell):'—'):(active?tieLabel(cell.tie):'—');grid.append(button);}row.append(label,grid);host.append(row);});const bars=[];for(let bar=0;bar<state.phraseBeats/4;bar++)bars.push(String(bar+1));$('#bassBarLabels').textContent=`Bars: ${bars.join('          ')}`;}
  function renderMode(){const custom=state.mode==='orchestral';$('#bassProfileControls').hidden=custom;$('#bassCustomControls').hidden=!custom;$$('.bass-mode-tab').forEach(button=>button.classList.toggle('selected',button.dataset.mode===state.mode));$('#bassEditorTitle').textContent=custom?'Editable orchestral bass line':'Editable bass tune';$('#bassEditorText').textContent=custom?'Rhythm controls notes and rests. Tune uses diatonic degrees relative to each chord root. Tie holds a note across sixteenth-note columns; articulation controls whether notes are staccato or legato.':'Rhythm controls notes and rests. Tune stores safe intervals above the active chord root. The dynamic third automatically becomes 3 or ♭3 from the project key.';}
  function renderModal(){const project=readProject();renderGuideChoices(project);renderProfiles();renderMode();$('#bassLength').value=String(state.units);$('#bassLengthValue').textContent=`${state.units} × 32 beats = ${state.units*32} beats`;$('#bassMutationRate').value=String(state.mutationRate);$('#bassMutationOutput').textContent=`${state.mutationRate}% mutation`;$('#bassInstrument').value=state.instrument;$('#bassRegister').value=String(state.register);$('#bassCustomMotion').value=state.custom.motion;$('#bassPedalTarget').value=state.custom.pedal;$('#bassArticulation').value=String(state.custom.articulation);$('#bassArticulationOutput').textContent=state.custom.articulation<35?'Staccato':state.custom.articulation>75?'Legato':'Balanced';$('#bassDynamics').value=state.custom.dynamics;$('#bassInversions').checked=state.custom.inversions;$$('.bass-phrase').forEach(button=>button.classList.toggle('selected',Number(button.dataset.beats)===state.phraseBeats));renderPitchPalette(project);renderTiePalette();renderEditor(project);describePlan(project);}
  function openModal(){stopPreview();if(!state.sequence.length||state.sequence.length!==phraseColumns())state.library==='genre'?loadGenre(state.genreId):loadEmotion(state.emotionId);renderModal();$('#bassModal').hidden=false;}
  function closeModal(){stopPreview();$('#bassModal').hidden=true;}

  function ensureAudio(){if(preview.context){if(preview.context.state==='suspended')preview.context.resume().catch(()=>{});return preview.context;}const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return null;preview.context=new Context();preview.gain=preview.context.createGain();preview.gain.gain.value=.78;preview.gain.connect(preview.context.destination);return preview.context;}
  async function previewPlayer(){const context=ensureAudio();if(!context||!window.Soundfont)return null;if(preview.player&&preview.instrument===state.instrument)return preview.player;preview.player=null;preview.instrument=state.instrument;try{preview.player=await window.Soundfont.instrument(context,SOUNDFONTS[state.instrument],{soundfont:'MusyngKite',format:'mp3',destination:preview.gain,gain:.94});return preview.player;}catch(_){return null;}}
  function stopPreview(){clearTimeout(preview.timer);preview.timer=0;preview.nodes.splice(0).forEach(node=>{try{node.stop?.();}catch(_){}});preview.running=false;const button=$('#bassPreview');if(button){button.textContent='▶ Preview';button.classList.remove('is-previewing');}}
  async function previewPhrase(){if(preview.running){stopPreview();return;}const project=readProject(),player=await previewPlayer();if(!player){toast('Bass sample could not load.');return;}const plan=buildPlan(project),start=plan.insertAt,events=plan.notes.filter(note=>note.start<start+32),now=preview.context.currentTime+.06,perBeat=secondsPerBeat(project);preview.running=true;$('#bassPreview').textContent='⏹ Stop Preview';$('#bassPreview').classList.add('is-previewing');events.forEach(note=>{try{const node=player.play(note.pitch,now+(note.start-start)*perBeat,{duration:Math.max(.08,note.duration*perBeat),gain:clamp(note.velocity/127,.15,.95),attack:.008,release:.16});if(node?.stop)preview.nodes.push(node);}catch(_){}});preview.timer=window.setTimeout(stopPreview,Math.max(600,Math.min(32000,32*perBeat*1000+260)));}

  function findBassTrack(project){let track=project.tracks.find(candidate=>/bass/i.test(candidate.name)||candidate.instrument==='cello');if(!track){track={id:uid('track'),name:'Bass',instrument:SAVED_INSTRUMENTS[state.instrument],color:COLORS[0],muted:false,solo:false,hidden:false,notes:[]};project.tracks.push(track);}track.instrument=SAVED_INSTRUMENTS[state.instrument];return track;}
  function addToTimeline(){const project=readProject(),plan=buildPlan(project);if(!plan.notes.length){toast('Add at least one triggered step first.');return;}snapshot(copy(project));findBassTrack(project).notes.push(...plan.notes);saveProject(project);sessionStorage.setItem(TOAST_KEY,`Added ${plan.groups.length} bass group${plan.groups.length===1?'':'s'} to the timeline.`);window.location.reload();}
  function editCell(step,mode,rightClick){const cell=state.sequence[step];if(mode==='rhythm'){if(rightClick){if(cell)cell.velocity=cell.velocity%3+1;else state.sequence[step]=makeCell(state.writePitch.kind,state.writePitch.value,1,state.writeTie);}else state.sequence[step]=cell?null:makeCell(state.writePitch.kind,state.writePitch.value,2,state.writeTie);}else if(mode==='tune'){if(rightClick){if(cell)cell.velocity=cell.velocity%3+1;else state.sequence[step]=makeCell(state.writePitch.kind,state.writePitch.value,1,state.writeTie);}else state.sequence[step]=cell?{...cell,kind:state.writePitch.kind,value:state.writePitch.value}:{...makeCell(state.writePitch.kind,state.writePitch.value,2,state.writeTie),stepwise:state.mode==='orchestral'&&state.custom.motion==='stepwise'};}else{if(!cell)state.sequence[step]=makeCell(state.writePitch.kind,state.writePitch.value,2,state.writeTie);else if(rightClick)cell.tie=TIES[(TIES.indexOf(cell.tie)+1)%TIES.length];else cell.tie=state.writeTie;}state.manualEdit=true;renderEditor(readProject());describePlan(readProject());}
  function enableFloatingWindow(){const card=$('#bassModalCard'),header=$('#bassModalHeader'),grip=$('#bassResizeGrip');if(!card||!header||!grip)return;header.addEventListener('pointerdown',event=>{if(event.target.closest('button,input,select,label'))return;event.preventDefault();const rect=card.getBoundingClientRect();card.style.position='fixed';card.style.margin='0';card.style.left=`${rect.left}px`;card.style.top=`${rect.top}px`;const dx=event.clientX-rect.left,dy=event.clientY-rect.top;const move=moveEvent=>{card.style.left=`${clamp(moveEvent.clientX-dx,0,window.innerWidth-card.offsetWidth)}px`;card.style.top=`${clamp(moveEvent.clientY-dy,0,window.innerHeight-card.offsetHeight)}px`;};const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true});});grip.addEventListener('pointerdown',event=>{event.preventDefault();const startX=event.clientX,startY=event.clientY,rect=card.getBoundingClientRect();card.style.position='fixed';card.style.margin='0';card.style.left=`${rect.left}px`;card.style.top=`${rect.top}px`;grip.classList.add('resizing');const move=moveEvent=>{card.style.width=`${clamp(Math.round(rect.width+moveEvent.clientX-startX),660,window.innerWidth-20)}px`;card.style.height=`${clamp(Math.round(rect.height+moveEvent.clientY-startY),500,window.innerHeight-20)}px`;};const end=()=>{grip.classList.remove('resizing');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true});});}
  function bind(){
    document.addEventListener('click',event=>{const trigger=event.target.closest('#quickBass');if(!trigger)return;event.preventDefault();event.stopImmediatePropagation();openModal();},true);
    $('#bassClose')?.addEventListener('click',closeModal);$('#bassPreview')?.addEventListener('click',previewPhrase);$('#bassAdd')?.addEventListener('click',addToTimeline);
    $('#bassModeTabs')?.addEventListener('click',event=>{const button=event.target.closest('.bass-mode-tab');if(!button)return;state.mode=button.dataset.mode;if(state.mode==='orchestral')generateCustom();else state.library==='genre'?loadGenre(state.genreId):loadEmotion(state.emotionId);renderModal();});
    $('#bassLibraryToggle')?.addEventListener('click',()=>{state.library=state.library==='genre'?'emotion':'genre';state.library==='genre'?loadGenre(state.genreId):loadEmotion(state.emotionId);renderModal();});
    $('#bassLoadProfile')?.addEventListener('click',()=>{if(state.library==='genre'){state.genreId=Number($('#bassProfileSelect').value);loadGenre(state.genreId);}else{state.emotionId=$('#bassProfileSelect').value;loadEmotion(state.emotionId);}renderModal();});
    $('#bassRandomProfile')?.addEventListener('click',()=>{if(state.library==='genre'){state.genreId=pick(GENRE_PROFILES).id;loadGenre(state.genreId);}else{state.emotionId=pick(EMOTIONS).id;loadEmotion(state.emotionId);}renderModal();});
    $('#bassMutate')?.addEventListener('click',()=>{if(state.library==='genre')mutateGenre();else{state.sequence=emotionSequence(activeEmotion(),0,Math.max(1,(32*state.units)/state.phraseBeats));state.manualEdit=false;}renderModal();});
    $('#bassGenerateCustom')?.addEventListener('click',()=>{generateCustom();renderModal();});
    $('#bassLength')?.addEventListener('input',event=>{state.units=Number(event.target.value);$('#bassLengthValue').textContent=`${state.units} × 32 beats = ${state.units*32} beats`;describePlan(readProject());});
    $('#bassMutationRate')?.addEventListener('input',event=>{state.mutationRate=Number(event.target.value);$('#bassMutationOutput').textContent=`${state.mutationRate}% mutation`;});
    $('#bassHarmonySource')?.addEventListener('change',event=>{state.source=event.target.value;describePlan(readProject());});$('#bassInstrument')?.addEventListener('change',event=>{state.instrument=event.target.value;});$('#bassRegister')?.addEventListener('change',event=>{state.register=Number(event.target.value);describePlan(readProject());});
    $('#bassCustomMotion')?.addEventListener('change',event=>{state.custom.motion=event.target.value;});$('#bassPedalTarget')?.addEventListener('change',event=>{state.custom.pedal=event.target.value;});$('#bassArticulation')?.addEventListener('input',event=>{state.custom.articulation=Number(event.target.value);$('#bassArticulationOutput').textContent=state.custom.articulation<35?'Staccato':state.custom.articulation>75?'Legato':'Balanced';});$('#bassDynamics')?.addEventListener('change',event=>{state.custom.dynamics=event.target.value;});$('#bassInversions')?.addEventListener('change',event=>{state.custom.inversions=event.target.checked;});
    $('#bassPhraseChoices')?.addEventListener('click',event=>{const button=event.target.closest('.bass-phrase');if(!button)return;state.phraseBeats=Number(button.dataset.beats);if(state.mode==='orchestral')generateCustom();else state.library==='genre'?loadGenre(state.genreId):loadEmotion(state.emotionId);renderModal();});
    $('#bassIntervalPalette')?.addEventListener('click',event=>{const button=event.target.closest('.dna-interval-button');if(!button)return;state.writePitch={kind:button.dataset.kind,value:Number(button.dataset.value)};renderPitchPalette(readProject());});$('#bassTiePalette')?.addEventListener('click',event=>{const button=event.target.closest('.dna-tie-button');if(!button)return;state.writeTie=Number(button.dataset.tie);renderTiePalette();});
    $('#bassStepGrid')?.addEventListener('click',event=>{const cell=event.target.closest('.dna-cell');if(cell)editCell(Number(cell.dataset.step),cell.dataset.mode,false);});$('#bassStepGrid')?.addEventListener('contextmenu',event=>{const cell=event.target.closest('.dna-cell');if(!cell)return;event.preventDefault();editCell(Number(cell.dataset.step),cell.dataset.mode,true);});enableFloatingWindow();
  }
  loadGenre(1);bind();
})();