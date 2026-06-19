(() => {
  'use strict';

  const EXAMPLE_MIDI_BASE64 = 'TVRoZAAAAAYAAQADAeBNVHJrAAABhAD/UQMHoSAA/wMWTWVsIG1lbG9keSBwaWFubyBndWlkZQDAAACwB1aSYJBVSIFwgFUAAJBVSIVQgFUAAJBUSINggFQAAJBUSIVQgFUAAJBUSIFwgFQAlkCQVEiDYIBUAACQUkiDYIBSAACQUEiDYIBQAACQUkiDYIBSAACQVEiHQIBUAACQS0iHQIBLAACQTUiDYIBNAACQS0iDYIBLAACQVEiDYIBUAACQUkiDYIBSAACQUEiPAIBQAACQUkiDYIBSAACQVEiDYIBUAACQS0iDYIBLAACQTUiDYIBNAACQS0iHQIBLAACQVEiHQIBUAACQUkiDYIBSAACQUEiDYIBQAACQQUiDYIBBAACQUEiDYIBQAACQUkiPAIBSAACQVEiDYIBUAACQUkiDYIBSAACQUEiDYIBQAACQUkiDYIBSAACQVEiHQIBUAACQS0iHQIBLAACQTUiDYIBNAACQS0iDYIBLAACQVEiDYIBUAACQUkiDYIBSAACQUEiLIIBQAAD/LwBNVHJrAAADOwD/AwtQaWFubyByaWdodADBAACxB1wAkUFCAJFIQgCRUEKHQIFBAACBSAAAgVAAAJFQQoFwgVAAAJFSQoFwgVIAAJFUQoFwgVQAAJFVQoFwgVUAAJE9QgCRREIAkUlCAJFNQodAgT0AAIFEAACBSQAAgU0AAJE9QgCRREIAkU1CAJFVQodAgT0AAIFEAACBTQAAgVUAAJE9QgCRREIAkU1CAJFVQodAgT0AAIFEAACBTQAAgVUAAJE9QgCRREIAkVRCg2CBPQAAgUQAAIFUAACRP0IAkURCAJFLQoNggT8AAIFEAACBSwAAkUFCAJFIQgCRUEKHQIFBAACBSAAAgVAAAJFBQgCRUEIAkVRCh0CBQQAAgVAAAIFUAACRQUIAkURCAJFUQodAgUEAAIFEAACBVAAAkT9CAJFEQgCRUkKHQIE/AACBRAAAgVIAAJE9QgCRREIAkUlCAJFNQodAgT0AAIFEAACBSQAAgU0AAJFBQgCRREIAkVRCh0CBQQAAgUQAAIFUAACRP0IAkURCAJFLQodAgT8AAIFEAACBSwAAkT1CAJFEQgCRVEKHQIE9AACBRAAAgVQAAJFBQgCRREIAkVRCjwCBQQAAgUQAAIFUAACRQUIAkUZCAJFSQodAgUEAAIFGAACBUgAAkUhCAJFLQgCRTUKHQIFIAACBSwAAgU0AAJE/QgCRS0IAkVJCh0CBPwAAgUsAAIFSAACRQUIAkURCAJFUQodAgUEAAIFEAACBVAAAkT1CAJFBQgCRREKHQIE9AACBQQAAgUQAAJFBQgCRREIAkVRCh0CBQQAAgUQAAIFUAACRP0IAkUNCAJFSQo8AgT8AAIFDAACBUgAAkUFCAJFEQgCRVEKHQIFBAACBRAAAgVQAAJE/QgCRREIAkVJCh0CBPwAAgUQAAIFSAACRPUIAkURCAJFJQgCRTUKHQIE9AACBRAAAgUkAAIFNAACRQUIAkURCAJFUQodAgUEAAIFEAACBVAAAkT9CAJFEQgCRS0KHQIE/AACBRAAAgUsAAJE9QgCRREIAkVRCh0CBPQAAgUQAAIFUAACRQUIAkURCAJFUQosggUEAAIFEAACBVAAA/y8ATVRyawAAAR4A/wMKUGlhbm8gbGVmdADCAACyB1wAkik8h0CCKQAAkjA8h0CCMAAAkiU8h0CCJQAAkiw8h0CCLAAAkiU8h0CCJQAAkiw8h0CCLAAAkik8h0CCKQAAkjA8h0CCMAAAkik8h0CCKQAAkjA8h0CCMAAAkiU8h0CCJQAAkiw8h0CCLAAAkic8h0CCJwAAki48h0CCLgAAkik8jwCCKQAAki48h0CCLgAAkjU8h0CCNQAAkic8h0CCJwAAki48h0CCLgAAkiU8h0CCJQAAkik8h0CCKQAAkic8jwCCJwAAkik8h0CCKQAAkjA8h0CCMAAAkiU8h0CCJQAAkiw8h0CCLAAAkic8h0CCJwAAki48h0CCLgAAkik8iyCCKQAA/y8A';
  const COLORS = ['#b68cff', '#60c6a4', '#dfb658', '#dc7898', '#79b4e3'];
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  const makeNote = (start, pitch, duration, velocity) => ({ id: uid(), start, pitch, duration: Math.max(.125, duration), velocity });
  const $ = selector => document.querySelector(selector);

  function base64Buffer(base64) {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
    return bytes.buffer;
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

  function parseMidi(buffer, filename) {
    const data = new Uint8Array(buffer);
    let offset = 0;
    const ensure = count => { if (offset + count > data.length) throw new Error('The MIDI file ends unexpectedly.'); };
    const readText = count => { ensure(count); let result = ''; for (let i = 0; i < count; i += 1) result += String.fromCharCode(data[offset++]); return result; };
    const readU8 = () => { ensure(1); return data[offset++]; };
    const readU16 = () => (readU8() << 8) | readU8();
    const readU32 = () => ((readU8() * 0x1000000) + (readU8() << 16) + (readU8() << 8) + readU8()) >>> 0;
    const readVlq = end => {
      let value = 0;
      for (let i = 0; i < 4; i += 1) {
        if (offset >= end) throw new Error('A MIDI variable-length value is incomplete.');
        const byte = readU8();
        value = (value << 7) | (byte & 0x7f);
        if (!(byte & 0x80)) return value;
      }
      throw new Error('A MIDI variable-length value is invalid.');
    };

    if (readText(4) !== 'MThd') throw new Error('This is not a Standard MIDI file.');
    const headerLength = readU32();
    if (headerLength < 6) throw new Error('The MIDI header is incomplete.');
    readU16();
    const trackCount = readU16();
    const division = readU16();
    if (division & 0x8000) throw new Error('SMPTE MIDI timing is not supported.');
    offset += headerLength - 6;

    const tempos = [];
    const tracks = [];
    const programs = new Array(16).fill(0);

    for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
      if (readText(4) !== 'MTrk') throw new Error('A MIDI track is malformed.');
      const length = readU32();
      const end = offset + length;
      if (end > data.length) throw new Error('A MIDI track is malformed.');
      let tick = 0;
      let runningStatus = null;
      let trackName = '';
      let trackChannel = 0;
      const active = new Map();
      const notes = [];

      while (offset < end) {
        tick += readVlq(end);
        let status = data[offset];
        if (status < 0x80) {
          if (runningStatus === null) throw new Error('Invalid MIDI running status.');
          status = runningStatus;
        } else {
          offset += 1;
          if (status < 0xf0) runningStatus = status;
        }

        if (status === 0xff) {
          const type = readU8();
          const size = readVlq(end);
          ensure(size);
          const payload = data.slice(offset, offset + size);
          offset += size;
          if (type === 0x03) trackName = new TextDecoder().decode(payload);
          if (type === 0x51 && payload.length === 3) tempos.push({ tick, microseconds: (payload[0] << 16) | (payload[1] << 8) | payload[2] });
          continue;
        }
        if (status === 0xf0 || status === 0xf7) {
          const size = readVlq(end);
          ensure(size);
          offset += size;
          continue;
        }
        if (status >= 0xf8) continue;

        const command = status & 0xf0;
        const channel = status & 0x0f;
        trackChannel = channel;
        const first = readU8();
        const second = command === 0xc0 || command === 0xd0 ? null : readU8();
        if (command === 0xc0) {
          programs[channel] = first;
          continue;
        }
        if (command === 0x90 && second > 0) {
          const key = `${channel}:${first}`;
          const queue = active.get(key) || [];
          queue.push({ tick, velocity: second });
          active.set(key, queue);
        } else if (command === 0x80 || (command === 0x90 && second === 0)) {
          const key = `${channel}:${first}`;
          const queue = active.get(key) || [];
          const started = queue.shift();
          if (queue.length) active.set(key, queue); else active.delete(key);
          if (started) notes.push(makeNote(started.tick / division, first, (tick - started.tick) / division, started.velocity));
        }
      }

      offset = end;
      if (notes.length) {
        tracks.push({
          id: uid(), name: trackName || `MIDI track ${tracks.length + 1}`,
          instrument: gmInstrument(programs[trackChannel], trackChannel),
          color: COLORS[tracks.length % COLORS.length], muted: false, solo: false, hidden: false,
          notes: notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch)
        });
      }
    }

    if (!tracks.length) throw new Error('No MIDI note events were found.');
    const tempo = tempos.sort((left, right) => left.tick - right.tick)[0]?.microseconds || 500000;
    return { title: filename.replace(/\.(mid|midi)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported MIDI', bpm: Math.round(60000000 / tempo), key: 'C major', sections: [], tracks };
  }

  function handProjectToIhy(project, filename) {
    const source = $('#file');
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify(project)], filename.replace(/\.(mid|midi)$/i, '.ihy.json'), { type: 'application/json' }));
    source.files = transfer.files;
    source.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function importMidiFile(file) {
    file.arrayBuffer().then(buffer => handProjectToIhy(parseMidi(buffer, file.name), file.name)).catch(error => alert(`Unable to import this file: ${error.message}`));
  }

  window.addEventListener('click', event => {
    if (!event.target.closest('#loadExample')) return;
    event.preventDefault();
    event.stopPropagation();
    try { handProjectToIhy(parseMidi(base64Buffer(EXAMPLE_MIDI_BASE64), 'potion_song_all_piano_v7.mid'), 'potion_song_all_piano_v7.mid'); }
    catch (error) { alert(`Unable to load the example: ${error.message}`); }
  }, true);

  window.addEventListener('change', event => {
    const input = event.target;
    const file = input?.id === 'file' ? input.files?.[0] : null;
    if (!file || !/\.(mid|midi)$/i.test(file.name)) return;
    event.stopPropagation();
    importMidiFile(file);
  }, true);
})();