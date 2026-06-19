(() => {
  'use strict';

  const EXAMPLE_MIDI_BASE64 = [
    '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',
    '/y8A'
  ].join('');

  const SAMPLE_BY_WAVEFORM = { triangle:'acoustic_grand_piano', sawtooth:'cello', sine:'flute', square:'lead_1_square' };
  const SAMPLE_IDS = [...new Set(Object.values(SAMPLE_BY_WAVEFORM))];
  const $ = selector => document.querySelector(selector);
  const state = { ready:false, loading:null, bypass:false, players:new Map(), patched:false, context:null };

  const setStatus = message => { const target = $('#status'); if (target) target.textContent = message; };

  function arrayBufferFromBase64(value) {
    const raw = atob(value);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
    return bytes.buffer;
  }

  async function loadSamples() {
    if (state.ready) return true;
    if (state.loading) return state.loading;
    if (!window.Soundfont) {
      setStatus('Sampled instruments could not load. Check the connection and refresh.');
      return false;
    }

    state.loading = (async () => {
      const AudioApi = window.AudioContext || window.webkitAudioContext;
      if (!AudioApi) return false;
      const context = new AudioApi();
      const master = context.createGain();
      master.gain.value = 0.78;
      master.connect(context.destination);
      try {
        await Promise.all(SAMPLE_IDS.map(async id => {
          const player = await window.Soundfont.instrument(context, id, { soundfont:'MusyngKite', format:'mp3', destination:master, gain:0.9 });
          state.players.set(id, player);
        }));
        state.context = context;
        state.ready = true;
        setStatus('Sampled instruments ready.');
        return true;
      } catch (error) {
        console.error('Ihy sample loading failed', error);
        setStatus('Sampled instruments could not load. Check the connection and refresh.');
        return false;
      } finally {
        state.loading = null;
      }
    })();

    return state.loading;
  }

  function midiFromFrequency(hertz) {
    return Math.max(0, Math.min(127, Math.round(69 + 12 * Math.log2(Math.max(1, hertz) / 440))));
  }

  function patchOscillators() {
    if (state.patched) return;
    const AudioApi = window.AudioContext || window.webkitAudioContext;
    if (!AudioApi?.prototype) return;
    const originalCreateOscillator = AudioApi.prototype.createOscillator;

    AudioApi.prototype.createOscillator = function patchedCreateOscillator(...args) {
      const oscillator = originalCreateOscillator.apply(this, args);
      let scheduledStart = this.currentTime;
      let hasStart = false;

      oscillator.start = function interceptedStart(when = this.context?.currentTime || scheduledStart) {
        scheduledStart = Number.isFinite(when) ? when : scheduledStart;
        hasStart = true;
      };

      oscillator.stop = function interceptedStop(when = this.context?.currentTime || scheduledStart + 0.2) {
        if (!hasStart || !state.ready) return;
        const waveform = oscillator.type || 'triangle';
        const sampleId = SAMPLE_BY_WAVEFORM[waveform] || 'acoustic_grand_piano';
        const player = state.players.get(sampleId);
        if (!player) return;
        const sourceNow = this.context?.currentTime || 0;
        const playerNow = player.context?.currentTime || 0;
        const delay = Math.max(0, scheduledStart - sourceNow);
        const startAt = playerNow + delay + 0.015;
        const duration = Math.max(0.06, Number(when) - scheduledStart);
        const pitch = midiFromFrequency(oscillator.frequency.value || 440);
        try {
          player.play(pitch, startAt, { duration, gain:waveform === 'triangle' ? 0.92 : 0.78, attack:0.008, release:Math.min(0.5, Math.max(0.08, duration * 0.25)) });
        } catch (error) {
          console.error('Ihy sample playback failed', error);
        }
      };

      return oscillator;
    };

    state.patched = true;
  }

  function replayPointer(target, event) {
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, composed:true, pointerId:event.pointerId, pointerType:event.pointerType, isPrimary:event.isPrimary, button:event.button, buttons:event.buttons, clientX:event.clientX, clientY:event.clientY, ctrlKey:event.ctrlKey, shiftKey:event.shiftKey, altKey:event.altKey, metaKey:event.metaKey }));
  }

  function loadOriginalExample(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const source = $('#file');
    if (!source) return;
    const file = new File([arrayBufferFromBase64(EXAMPLE_MIDI_BASE64)], 'potion_song_all_piano_v7.mid', { type:'audio/midi' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    source.files = transfer.files;
    source.dispatchEvent(new Event('change', { bubbles:true }));
    setStatus('Loaded original Potion Song MIDI: 3 piano tracks · 120 BPM · 31.5 seconds.');
  }

  async function preflightPlay(event) {
    if (state.bypass || state.ready) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus('Loading sampled instrument set…');
    if (!await loadSamples()) return;
    state.bypass = true;
    try { event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window })); }
    finally { state.bypass = false; }
  }

  async function preflightPiano(event) {
    if (state.bypass || state.ready) return;
    const key = event.target.closest('.key');
    if (!key) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus('Loading sampled instrument set…');
    if (!await loadSamples()) return;
    state.bypass = true;
    try { replayPointer(key, event); }
    finally { state.bypass = false; }
  }

  async function preflightKeyboard(event) {
    if (state.bypass || state.ready || ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (!'awsedftgyhujk'.includes(event.key.toLowerCase())) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus('Loading sampled instrument set…');
    if (!await loadSamples()) return;
    state.bypass = true;
    try { document.dispatchEvent(new KeyboardEvent('keydown', { key:event.key, code:event.code, bubbles:true, cancelable:true, shiftKey:event.shiftKey, ctrlKey:event.ctrlKey, altKey:event.altKey, metaKey:event.metaKey })); }
    finally { state.bypass = false; }
  }

  function boot() {
    patchOscillators();
    $('#loadExample')?.addEventListener('click', loadOriginalExample, true);
    $('#play')?.addEventListener('click', preflightPlay, true);
    $('#piano')?.addEventListener('pointerdown', preflightPiano, true);
    document.addEventListener('keydown', preflightKeyboard, true);
    document.addEventListener('pointerdown', () => { loadSamples().catch(() => {}); }, { once:true, capture:true });
  }

  boot();
})();