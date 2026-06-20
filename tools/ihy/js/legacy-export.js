(() => {
  'use strict';
  const PROJECT_KEY = 'ihy-v042-project';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const project = () => {
    try { return JSON.parse(localStorage.getItem(PROJECT_KEY)) || null; } catch (_) { return null; }
  };
  const secondsPerBeat = item => 60 / clamp(Number(item?.bpm) || 92, 30, 260);
  const projectEnd = item => Math.max(0, ...(item.sections || []).map(section => Number(section.end) || 0), ...(item.tracks || []).flatMap(track => (track.notes || []).map(note => (Number(note.start)||0)+(Number(note.duration)||0))));
  const filename = item => String(item.title || 'ihy-project').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase() || 'ihy-project';
  const download = (blob, name) => {
    const url=URL.createObjectURL(blob); const anchor=document.createElement('a');
    anchor.href=url; anchor.download=name; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  async function renderReferenceMix(item, rate, includeMuted) {
    const Offline=window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw new Error('Offline audio rendering is not available in this browser.');
    const beat=secondsPerBeat(item), context=new Offline(2, Math.ceil(Math.max(1.2,projectEnd(item)*beat+1.2)*rate), rate);
    const master=context.createGain(); master.gain.value=.6; master.connect(context.destination);
    const hasSolo=(item.tracks||[]).some(track=>track.solo);
    const waveform=instrument => ['cello','strings','horn','electric_bass'].includes(instrument)?'sawtooth':['retro_lead','drum_kit'].includes(instrument)?'square':['flute','choir','warm_pad','bell'].includes(instrument)?'sine':'triangle';
    (item.tracks||[]).filter(track=>(includeMuted||!track.muted)&&(!hasSolo||track.solo)).forEach(track=>(track.notes||[]).forEach(note=>{
      const start=(Number(note.start)||0)*beat, duration=Math.max(.06,(Number(note.duration)||1)*beat);
      const oscillator=context.createOscillator(), gain=context.createGain();
      oscillator.type=waveform(track.instrument);
      oscillator.frequency.setValueAtTime(track.instrument==='drum_kit'?90+((Number(note.pitch)||60)%12)*9:440*Math.pow(2,((Number(note.pitch)||60)-69)/12),start);
      const level=clamp((Number(note.velocity)||92)/127,.08,1)*.13;
      gain.gain.setValueAtTime(.0001,start); gain.gain.exponentialRampToValueAtTime(level,start+.012); gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      oscillator.connect(gain).connect(master); oscillator.start(start); oscillator.stop(start+duration+.05);
    }));
    return context.startRendering();
  }
  function wavBlob(buffer) {
    const frames=buffer.length, data=new DataView(new ArrayBuffer(44+frames*4)), write=(offset,text)=>[...text].forEach((char,index)=>data.setUint8(offset+index,char.charCodeAt(0)));
    write(0,'RIFF'); data.setUint32(4,36+frames*4,true); write(8,'WAVE'); write(12,'fmt '); data.setUint32(16,16,true); data.setUint16(20,1,true); data.setUint16(22,2,true); data.setUint32(24,buffer.sampleRate,true); data.setUint32(28,buffer.sampleRate*4,true); data.setUint16(32,4,true); data.setUint16(34,16,true); write(36,'data'); data.setUint32(40,frames*4,true);
    const left=buffer.getChannelData(0), right=buffer.getChannelData(Math.min(1,buffer.numberOfChannels-1)); let offset=44;
    for(let index=0;index<frames;index+=1){data.setInt16(offset,clamp(left[index],-1,1)*32767,true);offset+=2;data.setInt16(offset,clamp(right[index],-1,1)*32767,true);offset+=2;}
    return new Blob([data.buffer],{type:'audio/wav'});
  }
  async function mp3Blob(buffer, bitrate) {
    if(!window.lamejs) await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('MP3 encoder could not be loaded.'));document.head.append(script);});
    if(!window.lamejs) throw new Error('MP3 encoder loaded without a usable API.');
    const encoder=new window.lamejs.Mp3Encoder(2,buffer.sampleRate,bitrate), left=buffer.getChannelData(0),right=buffer.getChannelData(Math.min(1,buffer.numberOfChannels-1)),a=new Int16Array(left.length),b=new Int16Array(right.length);
    for(let index=0;index<left.length;index+=1){a[index]=clamp(left[index],-1,1)*32767;b[index]=clamp(right[index],-1,1)*32767;}
    const chunks=[]; for(let index=0;index<a.length;index+=1152){const data=encoder.encodeBuffer(a.subarray(index,index+1152),b.subarray(index,index+1152));if(data.length)chunks.push(new Uint8Array(data));} const tail=encoder.flush(); if(tail.length)chunks.push(new Uint8Array(tail));
    return new Blob(chunks,{type:'audio/mpeg'});
  }
  const updateDescription=()=>{
    const format=document.querySelector('input[name="exportFormat"]:checked')?.value||'json', description=document.querySelector('#exportDescription'), bitrate=document.querySelector('#bitrateOption');
    if(description) description.textContent={json:'Ihy project JSON preserves notes, groups, sections, tracks and settings.',midi:'Standard MIDI exports editable notes, tempo, tracks and program choices.',wav:'WAV renders a local stereo reference mix in this browser.',mp3:'MP3 renders a local reference mix, then encodes it in this browser.'}[format];
    if(bitrate) bitrate.hidden=format!=='mp3';
    document.querySelectorAll('.format-choice').forEach(choice=>choice.classList.toggle('active',choice.querySelector('input')?.checked===true));
  };
  document.querySelectorAll('input[name="exportFormat"]').forEach(input=>input.addEventListener('change',updateDescription));
  updateDescription();
  document.querySelector('#doExport')?.addEventListener('click',async event=>{
    const format=document.querySelector('input[name="exportFormat"]:checked')?.value||'json';
    if(!['wav','mp3'].includes(format)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const status=document.querySelector('#exportStatus'), button=document.querySelector('#doExport'), item=project();
    if(!item){if(status)status.textContent='Export failed: no project is available.';return;}
    const original=button?.textContent||'Export file'; if(button){button.disabled=true;button.textContent='Rendering…';}
    try {
      if(status)status.textContent='Rendering local reference mix…';
      const buffer=await renderReferenceMix(item,Number(document.querySelector('#exportSampleRate')?.value||44100),Boolean(document.querySelector('#includeMuted')?.checked));
      if(format==='wav'){download(wavBlob(buffer),`${filename(item)}.wav`);if(status)status.textContent='WAV reference mix downloaded.';}
      else {if(status)status.textContent='Encoding MP3 locally…';download(await mp3Blob(buffer,Number(document.querySelector('#exportBitrate')?.value||192)),`${filename(item)}.mp3`);if(status)status.textContent='MP3 reference mix downloaded.';}
    } catch(error) {if(status)status.textContent=`Export failed: ${error.message}`;}
    finally {if(button){button.disabled=false;button.textContent=original;}}
  },true);
})();