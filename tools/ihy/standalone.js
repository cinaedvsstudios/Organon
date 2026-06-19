(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const STORAGE = 'ihy-v019';
  const BASE_BEAT = 40;
  const ROW = 24;
  const LOW = 48;
  const HIGH = 84;
  const MIN_BEATS = 64;
  const COLORS = ['#b68cff', '#60c6a4', '#dfb658', '#dc7898', '#79b4e3'];
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const KEYS = { a:60,w:61,s:62,e:63,d:64,f:65,t:66,g:67,y:68,h:69,u:70,j:71,k:72 };
  const INSTRUMENTS = [
    ['grand_piano','Grand Piano'],['soft_piano','Soft Piano'],['cello','Cello'],['strings','Strings'],['flute','Flute'],['horn','French Horn'],['choir','Choir'],['warm_pad','Warm Pad'],['bell','Bell'],['acoustic_guitar','Acoustic Guitar'],['electric_bass','Electric Bass'],['drum_kit','Drum Kit'],['retro_lead','Retro Lead'],['pluck','Pluck']
  ];
  const SCALE = {
    'C major':{root:0,notes:[0,2,4,5,7,9,11]},
    'D minor':{root:2,notes:[0,2,3,5,7,8,10]},
    'A minor':{root:9,notes:[0,2,3,5,7,8,10]},
    'F major':{root:5,notes:[0,2,4,5,7,9,11]},
    'G major':{root:7,notes:[0,2,4,5,7,9,11]},
    'A♭ major':{root:8,notes:[0,2,4,5,7,9,11]}
  };

  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const noteName = pitch => `${NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
  const instrumentName = id => (INSTRUMENTS.find(([key]) => key === id) || [id,id])[1];
  const makeNote = (start,pitch,duration=1,velocity=92) => ({id:uid(),start,pitch,duration,velocity});
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));

  function blankProject(){
    return {title:'Untitled cue',bpm:92,key:'D minor',sections:[],tracks:[{id:uid(),name:'Piano',instrument:'grand_piano',color:COLORS[0],muted:false,solo:false,notes:[]}]};
  }

  function normalise(raw){
    const fallback = blankProject();
    if(!raw || !Array.isArray(raw.tracks) || !raw.tracks.length) return fallback;
    return {
      title:String(raw.title || fallback.title),
      bpm:clamp(Number(raw.bpm) || 92,30,260),
      key:SCALE[raw.key] ? raw.key : 'D minor',
      sections:Array.isArray(raw.sections) ? raw.sections.map((section,index)=>({id:section.id || uid(),name:String(section.name || `Section ${index+1}`),start:Math.max(0,Number(section.start)||0),end:Math.max(1,Number(section.end)||8),color:section.color || COLORS[index % COLORS.length]})) : [],
      tracks:raw.tracks.map((track,index)=>({id:track.id || uid(),name:String(track.name || `Track ${index+1}`),instrument:INSTRUMENTS.some(([id])=>id===track.instrument) ? track.instrument : 'grand_piano',color:track.color || COLORS[index % COLORS.length],muted:Boolean(track.muted),solo:Boolean(track.solo),notes:Array.isArray(track.notes) ? track.notes.map(note=>({id:note.id || uid(),start:Math.max(0,Number(note.start)||0),pitch:clamp(Number(note.pitch)||60,LOW,HIGH),duration:Math.max(.125,Number(note.duration)||1),velocity:clamp(Number(note.velocity)||92,1,127)})).sort((a,b)=>a.start-b.start || a.pitch-b.pitch) : []}))
    };
  }

  let project;
  try{ project = normalise(JSON.parse(localStorage.getItem(STORAGE) || localStorage.getItem('ihy-v018') || localStorage.getItem('ihy-v014') || 'null')); }
  catch(_){ project = blankProject(); }

  let activeTrackId = project.tracks[0].id;
  let zoom = clamp(Number(localStorage.getItem('ihy-roll-zoom') || 100),70,150);
  let beatWidth = BASE_BEAT * zoom / 100;
  let selected = null;
  let drag = null;
  let metronome = false;
  let recording = false;
  let recordStarted = 0;
  let playhead = 0;
  let playing = false;
  let playStartedAt = 0;
  let playStartedBeat = 0;
  let frame = 0;
  let audio = null;
  let master = null;
  let scheduled = [];
  const pressed = new Set();

  const getTrack = id => project.tracks.find(track => track.id === id);
  const activeTrack = () => getTrack(activeTrackId);
  const secondsPerBeat = () => 60 / clamp(Number(project.bpm)||92,30,260);
  const snap = value => { const unit = Number($('#quant').value || .25); return Math.round(value / unit) * unit; };

  function length(){
    let end = MIN_BEATS;
    project.sections.forEach(section => { end = Math.max(end,section.end); });
    project.tracks.forEach(track => track.notes.forEach(note => { end = Math.max(end,note.start+note.duration); }));
    return Math.max(MIN_BEATS,Math.ceil(end/4)*4);
  }

  function syncMeta(){
    project.title = $('#title').value.trim() || 'Untitled cue';
    project.bpm = clamp(Number($('#bpm').value)||92,30,260);
    project.key = SCALE[$('#key').value] ? $('#key').value : 'D minor';
  }

  function status(message='',timeout=3200){
    const target = $('#status');
    target.textContent = message;
    clearTimeout(status.timer);
    if(message && timeout) status.timer=setTimeout(()=>{if(target.textContent===message) target.textContent='';},timeout);
  }

  function save(silent=false){
    syncMeta();
    localStorage.setItem(STORAGE,JSON.stringify(project));
    if(!silent) status(`Saved “${project.title}”.`);
  }

  function setView(name){
    $$('.view').forEach(view => view.classList.toggle('active',view.id===`${name}View`));
  }

  function render(){
    syncMeta();
    $('#title').value=project.title;
    $('#bpm').value=project.bpm;
    $('#key').value=project.key;
    $('#zoomSlider').value=String(zoom);
    $('#zoomValue').textContent=`${zoom}%`;
    $('#metro').classList.toggle('on',metronome);
    $('#metro').setAttribute('aria-pressed',String(metronome));
    $('#record').classList.toggle('on',recording);
    $('#record').textContent=recording ? '⏺ Recording' : '⏺ Record';
    renderTracks();
    renderTimeline();
    renderRoll();
    renderKeyboard();
    updateTransport();
  }

  function renderTracks(){
    const tracks=$('#tracks');
    const armed=$('#armed');
    tracks.replaceChildren();
    armed.replaceChildren();
    project.tracks.forEach(track=>{
      armed.append(new Option(track.name,track.id,track.id===activeTrackId,track.id===activeTrackId));
      const row=document.createElement('div');
      row.className=`track${track.id===activeTrackId?' active':''}`;
      row.innerHTML=`<span class="swatch" style="background:${track.color}"></span><button class="btn track-arm" data-arm="${track.id}">${escapeHtml(track.name)}</button><span class="instrument">${escapeHtml(instrumentName(track.instrument))}</span><span class="track-actions"><button class="btn" data-mute="${track.id}" aria-pressed="${track.muted}">M</button><button class="btn" data-solo="${track.id}" aria-pressed="${track.solo}">S</button></span>`;
      tracks.append(row);
    });
    const select=$('#instrument');
    select.replaceChildren(...INSTRUMENTS.map(([id,name])=>new Option(name,id)));
    select.value=activeTrack().instrument;
  }

  function renderTimeline(){
    const host=$('#arrangement');
    const total=length();
    host.replaceChildren();
    host.style.width=`${total*beatWidth}px`;
    const marker=document.createElement('div');
    marker.id='arrangementPlayhead';marker.className='arrangement-playhead';marker.style.left=`${playhead*beatWidth}px`;host.append(marker);
    for(let beat=0;beat<=total;beat+=4){
      const label=document.createElement('span');label.className='section-time-label';label.style.left=`${beat*beatWidth}px`;label.textContent=String(beat/4+1);host.append(label);
    }
    const sections=project.sections.length ? project.sections : [{id:'main',name:'Main track',start:0,end:total,color:'#dfb658',readonly:true}];
    sections.forEach(section=>{
      const button=document.createElement('button');button.className='arrangement-section';button.dataset.section=section.id;button.disabled=Boolean(section.readonly);button.style.left=`${section.start*beatWidth+4}px`;button.style.width=`${Math.max(44,(section.end-section.start)*beatWidth-8)}px`;button.style.background=section.color;button.textContent=section.name;host.append(button);
    });
  }

  function renderRoll(){
    const labels=$('#labels');
    const roll=$('#roll');
    const total=length();
    labels.replaceChildren();roll.replaceChildren();roll.style.width=`${total*beatWidth}px`;
    const marker=document.createElement('div');marker.id='playhead';marker.className='playhead';marker.style.left=`${playhead*beatWidth}px`;roll.append(marker);
    for(let pitch=HIGH;pitch>=LOW;pitch--){
      const label=document.createElement('div');label.className=`pitch-label${pitch%12===0?' c':''}`;label.textContent=noteName(pitch);labels.append(label);
    }
    for(let beat=0;beat<=total;beat+=4){
      const number=document.createElement('span');number.className='bar';number.style.left=`${beat*beatWidth+4}px`;number.textContent=String(beat/4+1);roll.append(number);
    }
    project.tracks.forEach(track=>track.notes.forEach(note=>{
      const node=document.createElement('div');node.className=`note${selected?.id===note.id?' selected':''}`;node.dataset.note=note.id;node.title=`${track.name} · ${noteName(note.pitch)} · ${note.duration} beats`;node.style.left=`${note.start*beatWidth+1}px`;node.style.top=`${(HIGH-note.pitch)*ROW+2}px`;node.style.width=`${Math.max(10,note.duration*beatWidth-2)}px`;node.style.background=track.color;node.innerHTML='<span class="resize-handle"></span>';roll.append(node);
    }));
  }

  function renderKeyboard(){
    const piano=$('#piano');piano.replaceChildren();
    const whites=[];
    for(let pitch=36;pitch<=96;pitch++) if(![1,3,6,8,10].includes(pitch%12)) whites.push(pitch);
    whites.forEach(pitch=>{
      const key=document.createElement('button');key.className='key';key.dataset.pitch=pitch;const mapped=Object.entries(KEYS).find(([,value])=>value===pitch)?.[0]?.toUpperCase()||'';key.textContent=`${noteName(pitch)}${mapped}`;piano.append(key);
    });
    for(let pitch=36;pitch<=96;pitch++) if([1,3,6,8,10].includes(pitch%12)){
      const key=document.createElement('button');key.className='key black';key.dataset.pitch=pitch;key.style.left=`${9+whites.indexOf(pitch-1)*44+30}px`;key.textContent=noteName(pitch);piano.append(key);
    }
  }

  function updateTransport(){
    const value=seconds=>{const whole=Math.max(0,Math.round(seconds));return `${Math.floor(whole/60)}:${String(whole%60).padStart(2,'0')}`;};
    $('#transportTime').textContent=`${value(playhead*secondsPerBeat())} / ${value(length()*secondsPerBeat())}`;
  }

  function setPlayhead(beat,follow=false){
    playhead=clamp(beat,0,length());
    const left=`${playhead*beatWidth}px`;
    const roll=$('#playhead');const timeline=$('#arrangementPlayhead');
    if(roll) roll.style.left=left;if(timeline) timeline.style.left=left;updateTransport();
    if(follow){const scroll=$('#rollScroll');const target=playhead*beatWidth;if(target>scroll.scrollLeft+scroll.clientWidth-130) scroll.scrollLeft=Math.max(0,target-scroll.clientWidth*.35);}
  }

  function audioContext(){
    if(audio){if(audio.state==='suspended') audio.resume().catch(()=>{});return audio;}
    const API=window.AudioContext||window.webkitAudioContext;if(!API)return null;
    audio=new API();master=audio.createGain();master.gain.value=.68;master.connect(audio.destination);return audio;
  }
  function waveform(instrument){
    if(['cello','strings','horn','electric_bass'].includes(instrument))return 'sawtooth';
    if(['retro_lead','drum_kit'].includes(instrument))return 'square';
    if(['flute','choir','warm_pad','bell'].includes(instrument))return 'sine';
    return 'triangle';
  }
  function tone(instrument,pitch,velocity,duration,at){
    const context=audioContext();if(!context)return;
    const osc=context.createOscillator();const gain=context.createGain();const start=at ?? context.currentTime;const amount=clamp((velocity||92)/127,.08,1);const realDuration=Math.max(.08,duration);
    osc.type=waveform(instrument);osc.frequency.setValueAtTime(instrument==='drum_kit'?120:440*Math.pow(2,(pitch-69)/12),start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.12*amount,start+.01);gain.gain.exponentialRampToValueAtTime(.0001,start+realDuration);osc.connect(gain).connect(master);osc.start(start);osc.stop(start+realDuration+.06);scheduled.push(()=>{try{osc.stop();osc.disconnect();gain.disconnect();}catch(_){}});
  }
  function glow(pitch,delay,duration){
    const begin=setTimeout(()=>{const key=$(`.key[data-pitch="${pitch}"]`);key?.classList.add('playing');const end=setTimeout(()=>key?.classList.remove('playing'),Math.max(80,duration));scheduled.push(()=>clearTimeout(end));},Math.max(0,delay));scheduled.push(()=>clearTimeout(begin));
  }
  function stop(reset=false){
    playing=false;cancelAnimationFrame(frame);frame=0;scheduled.splice(0).forEach(cancel=>cancel());$$('.key.playing').forEach(key=>key.classList.remove('playing'));$('#play').textContent='▶ Play';if(reset)setPlayhead(0);
  }
  function animate(){
    if(!playing)return;const beat=playStartedBeat+((performance.now()-playStartedAt)/1000)/secondsPerBeat();if(beat>=length()){stop(true);status('Playback reached the end.');return;}setPlayhead(beat,true);frame=requestAnimationFrame(animate);
  }
  function play(){
    if(playing){stop(false);status('Playback paused.');return;}
    syncMeta();const context=audioContext();if(!context)return;const start=playhead;const startAt=context.currentTime+.05;const solo=project.tracks.some(track=>track.solo);const audible=project.tracks.filter(track=>!track.muted&&(!solo||track.solo));
    audible.forEach(track=>track.notes.forEach(note=>{const end=note.start+note.duration;if(end<=start)return;const realStart=Math.max(start,note.start);const delay=(realStart-start)*secondsPerBeat();const duration=(end-realStart)*secondsPerBeat();tone(track.instrument,note.pitch+Number($('#transpose').value||0),note.velocity,duration,startAt+delay);glow(note.pitch,delay*1000,duration*1000);}));
    if(metronome)for(let beat=Math.ceil(start);beat<length();beat++){const delay=(beat-start)*secondsPerBeat();tone('bell',beat%4===0?84:76,48,.06,startAt+delay);}
    playing=true;playStartedAt=performance.now()+50;playStartedBeat=start;$('#play').textContent='⏸ Pause';frame=requestAnimationFrame(animate);
  }
  function playPitch(pitch,beats=.5){const track=activeTrack();const context=audioContext();if(!context)return;const duration=beats*secondsPerBeat();tone(track.instrument,pitch+Number($('#transpose').value||0),96,duration,context.currentTime+.02);glow(pitch,15,duration*1000);}

  function inScale(pitch,scale){return scale.notes.includes(((pitch-scale.root)%12+12)%12)}
  function scaleStep(pitch,count,scale){let value=pitch;let remaining=count;while(remaining>0){value++;if(inScale(value,scale))remaining--;}return value}
  function chord(pitch){const scale=SCALE[project.key]||SCALE['D minor'];let root=pitch;while(!inScale(root,scale)&&root>LOW)root--;return [root,scaleStep(root,2,scale),scaleStep(root,4,scale)].filter(value=>value>=LOW&&value<=HIGH)}
  function addAt(event){const box=$('#roll').getBoundingClientRect();const start=snap(clamp((event.clientX-box.left)/beatWidth,0,length()-.125));const pitch=clamp(HIGH-Math.floor((event.clientY-box.top)/ROW),LOW,HIGH);const pitches=$('#chordToggle').classList.contains('on')?chord(pitch):[pitch];const notes=pitches.map(value=>makeNote(start,value));activeTrack().notes.push(...notes);selected=notes[0];renderRoll();}
  function findNote(id){for(const track of project.tracks){const note=track.notes.find(item=>item.id===id);if(note)return {track,note};}return null}

  function newProject(){if(!confirm('Start a new composition? Unsaved work will be replaced.'))return;project=blankProject();activeTrackId=project.tracks[0].id;selected=null;playhead=0;render();status('New composition ready.');}
  function example(){project=blankProject();project.title='Potion Song — Piano Example';project.tracks[0].notes=[[0,62],[1,65],[2,69],[3,65],[4,64],[5,67],[6,71],[7,67],[8,62],[9,65],[10,69],[11,74]].map(([start,pitch])=>makeNote(start,pitch,.85));project.sections=[{id:uid(),name:'Verse',start:0,end:12,color:'#dfb658'}];activeTrackId=project.tracks[0].id;selected=null;playhead=0;render();status('Loaded Piano Example.');}
  function exportProject(){save(true);const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`${project.title.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'ihy-project'}.ihy.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Exported project JSON.');}

  function gm(program,channel){if(channel===9)return 'drum_kit';if(program>=24&&program<=31)return 'acoustic_guitar';if(program>=32&&program<=39)return 'electric_bass';if(program===42||program===43)return 'cello';if(program>=40&&program<=51)return 'strings';if(program>=52&&program<=54)return 'choir';if(program>=56&&program<=63)return 'horn';if(program>=72&&program<=79)return 'flute';if(program===14)return 'bell';if(program>=88&&program<=95)return 'warm_pad';return 'grand_piano'}
  function parseMidi(buffer,fileName){
    const data=new Uint8Array(buffer);let index=0;const text=size=>{const out=String.fromCharCode(...data.slice(index,index+size));index+=size;return out;};const u8=()=>data[index++];const u16=()=>u8()<<8|u8();const u32=()=>((u8()*0x1000000)+(u8()<<16)+(u8()<<8)+u8())>>>0;const vlq=()=>{let out=0,byte;do{byte=u8();out=out<<7|byte&127;}while(byte&128);return out;};
    if(text(4)!=='MThd')throw new Error('This is not a Standard MIDI file.');const header=u32();if(header<6)throw new Error('MIDI header is incomplete.');u16();const count=u16();const division=u16();index+=Math.max(0,header-6);if(division&0x8000)throw new Error('SMPTE MIDI timing is not supported.');const tempos=[500000];const tracks=[];
    for(let trackIndex=0;trackIndex<count&&index<data.length;trackIndex++){if(text(4)!=='MTrk')throw new Error('A MIDI track is malformed.');const end=index+u32();let tick=0,running=null,name='',program=0,channel=0;const active=new Map(),notes=[];while(index<end){tick+=vlq();let state=data[index];if(state<128){if(running===null)throw new Error('Invalid MIDI running status.');state=running;}else{index++;if(state<240)running=state;}if(state===255){const type=u8(),size=vlq(),payload=data.slice(index,index+size);index+=size;if(type===3)name=String.fromCharCode(...payload);if(type===81&&payload.length===3)tempos.push(payload[0]<<16|payload[1]<<8|payload[2]);continue;}if(state===240||state===247){index+=vlq();continue;}const command=state&240;channel=state&15;const first=u8();const second=command===192||command===208?null:u8();if(command===192){program=first;continue;}const key=`${channel}:${first}`;if(command===144&&second>0){const stack=active.get(key)||[];stack.push({tick,velocity:second});active.set(key,stack);continue;}if(command===128||(command===144&&second===0)){const start=active.get(key)?.shift();if(start)notes.push(makeNote(start.tick/division,first,Math.max(.125,(tick-start.tick)/division),start.velocity));}}
      if(notes.length)tracks.push({id:uid(),name:name||`MIDI track ${tracks.length+1}`,instrument:gm(program,channel),color:COLORS[tracks.length%COLORS.length],muted:false,solo:false,notes:notes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch)});index=end;}
    if(!tracks.length)throw new Error('No MIDI note events were found.');return {title:fileName.replace(/\.(mid|midi)$/i,'').replace(/[_-]+/g,' ').trim()||'Imported MIDI',bpm:Math.round(60000000/(tempos[0]||500000)),key:'C major',sections:[],tracks};
  }
  async function importProject(file){try{project=/\.(mid|midi)$/i.test(file.name)?normalise(parseMidi(await file.arrayBuffer(),file.name)):normalise(JSON.parse(await file.text()));activeTrackId=project.tracks[0].id;selected=null;playhead=0;render();status(`Imported ${file.name}.`);}catch(error){alert(`Unable to import this file: ${error.message}`);status('Import failed.');}}

  $('#newProject').addEventListener('click',newProject);$('#save').addEventListener('click',()=>save(false));$('#loadExample').addEventListener('click',example);$('#createSound').addEventListener('click',()=>setView('create'));$('#libraryButton').addEventListener('click',()=>setView('library'));$('#analyseButton').addEventListener('click',()=>setView('analyse'));$('#signalButton').addEventListener('click',()=>setView('signal'));$('#quickAdd').addEventListener('click',()=>status('Quick add is the next composition pass.'));$('#import').addEventListener('click',()=>$('#file').click());$('#export').addEventListener('click',exportProject);$('#file').addEventListener('change',event=>{if(event.target.files[0])importProject(event.target.files[0]);event.target.value='';});
  $('#title').addEventListener('change',syncMeta);$('#bpm').addEventListener('change',()=>{syncMeta();updateTransport();});$('#key').addEventListener('change',()=>{project.key=$('#key').value;});
  $('#zoomSlider').addEventListener('input',event=>{zoom=clamp(Number(event.target.value)||100,70,150);beatWidth=BASE_BEAT*zoom/100;localStorage.setItem('ihy-roll-zoom',zoom);renderTimeline();renderRoll();updateTransport();});
  $('#chordToggle').addEventListener('click',()=>{const button=$('#chordToggle');button.classList.toggle('on');button.setAttribute('aria-pressed',button.classList.contains('on'));});
  $('#metro').addEventListener('click',()=>{metronome=!metronome;render();status(metronome?'Metronome enabled.':'Metronome disabled.');});
  $('#armed').addEventListener('change',event=>{activeTrackId=event.target.value;selected=null;renderTracks();renderRoll();});
  $('#instrument').addEventListener('change',event=>{activeTrack().instrument=event.target.value;renderTracks();status(`${activeTrack().name} now uses ${instrumentName(activeTrack().instrument)}.`);});
  $('#tracks').addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.arm){activeTrackId=button.dataset.arm;selected=null;renderTracks();renderRoll();return;}if(button.dataset.mute){const track=getTrack(button.dataset.mute);track.muted=!track.muted;renderTracks();return;}if(button.dataset.solo){const track=getTrack(button.dataset.solo);track.solo=!track.solo;renderTracks();}});
  $('#addTrack').addEventListener('click',()=>{const track={id:uid(),name:`Track ${project.tracks.length+1}`,instrument:'grand_piano',color:COLORS[project.tracks.length%COLORS.length],muted:false,solo:false,notes:[]};project.tracks.push(track);activeTrackId=track.id;selected=null;render();});
  $('#addSection').addEventListener('click',()=>{const name=prompt('Section name',`Section ${project.sections.length+1}`);if(!name?.trim())return;const start=project.sections.length?project.sections[project.sections.length-1].end:0;project.sections.push({id:uid(),name:name.trim(),start,end:Math.min(length(),start+8),color:COLORS[project.sections.length%COLORS.length]});renderTimeline();});
  $('#arrangement').addEventListener('click',event=>{const sectionNode=event.target.closest('.arrangement-section');if(sectionNode?.disabled)return;if(sectionNode){const section=project.sections.find(item=>item.id===sectionNode.dataset.section);const name=prompt('Section name',section.name);if(name?.trim()){section.name=name.trim();renderTimeline();}return;}const rect=$('#arrangement').getBoundingClientRect();setPlayhead((event.clientX-rect.left)/beatWidth);});
  $('#clear').addEventListener('click',()=>{if(!confirm(`Clear all notes from ${activeTrack().name}?`))return;activeTrack().notes=[];selected=null;renderRoll();});
  $('#rollScroll').addEventListener('scroll',()=>{$('#arrangementViewport').scrollLeft=$('#rollScroll').scrollLeft;});
  $('#roll').addEventListener('pointerdown',event=>{if(event.button!==0)return;const node=event.target.closest('.note');if(!node){if(event.target===$('#roll'))addAt(event);return;}event.preventDefault();const ref=findNote(node.dataset.note);if(!ref)return;selected=ref.note;drag={ref,mode:event.target.classList.contains('resize-handle')?'resize':'move',x:event.clientX,y:event.clientY,start:ref.note.start,pitch:ref.note.pitch,duration:ref.note.duration};renderRoll();});
  $('#roll').addEventListener('pointermove',event=>{if(!drag)return;const dx=(event.clientX-drag.x)/beatWidth;const dy=Math.round((event.clientY-drag.y)/ROW);if(drag.mode==='resize')drag.ref.note.duration=clamp(snap(drag.duration+dx),.125,length()-drag.ref.note.start);else{drag.ref.note.start=clamp(snap(drag.start+dx),0,length()-drag.ref.note.duration);drag.ref.note.pitch=clamp(drag.pitch-dy,LOW,HIGH);}renderRoll();});
  ['pointerup','pointercancel','pointerleave'].forEach(type=>$('#roll').addEventListener(type,()=>{drag=null;}));
  $('#piano').addEventListener('pointerdown',event=>{const key=event.target.closest('.key');if(key)playPitch(Number(key.dataset.pitch),pressed.has(' ')?1.35:.5);});
  $('#record').addEventListener('click',()=>{recording=!recording;recordStarted=performance.now();render();status(recording?'Recording keyboard notes.':'Recording stopped.');});
  $('#play').addEventListener('click',play);$('#stop').addEventListener('click',()=>{stop(false);status('Playback stopped.');});
  document.addEventListener('keydown',event=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(event.code==='Space'){event.preventDefault();pressed.add(' ');return;}const key=event.key.toLowerCase();if(!KEYS[key]||pressed.has(key))return;pressed.add(key);const beats=pressed.has(' ')?1.35:.5;playPitch(KEYS[key],beats);if(recording){const start=snap(((performance.now()-recordStarted)/1000)/secondsPerBeat());if(start<length()){const note=makeNote(start,KEYS[key],beats);activeTrack().notes.push(note);selected=note;renderRoll();}}});
  document.addEventListener('keyup',event=>{if(event.code==='Space')pressed.delete(' ');else pressed.delete(event.key.toLowerCase());});window.addEventListener('pagehide',()=>stop(false));
  render();
})();