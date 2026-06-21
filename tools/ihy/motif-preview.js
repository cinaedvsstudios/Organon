(() => {
  'use strict';

  const SOUNDFONTS = {
    grand_piano: 'acoustic_grand_piano', strings: 'string_ensemble_1', violin: 'violin', clarinet: 'clarinet', oboe: 'oboe',
    flute: 'flute', church_organ: 'church_organ', harpsichord: 'harpsichord', celesta: 'celesta'
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  class MotifPreview {
    constructor({ onProgress, onState }) {
      this.onProgress = typeof onProgress === 'function' ? onProgress : () => {};
      this.onState = typeof onState === 'function' ? onState : () => {};
      this.context = null;
      this.gain = null;
      this.player = null;
      this.instrument = null;
      this.nodes = [];
      this.timer = 0;
      this.frame = 0;
      this.active = false;
      this.pending = false;
      this.loop = false;
      this.request = 0;
    }

    ensureAudio() {
      if (this.context) {
        if (this.context.state === 'suspended') this.context.resume().catch(() => {});
        return this.context;
      }
      const AudioContextApi = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextApi) return null;
      this.context = new AudioContextApi();
      this.gain = this.context.createGain();
      this.gain.gain.value = 0.8;
      this.gain.connect(this.context.destination);
      return this.context;
    }

    async loadPlayer(instrument) {
      const context = this.ensureAudio();
      if (!context || !window.Soundfont) return null;
      if (this.player && this.instrument === instrument) return this.player;
      this.instrument = instrument;
      try {
        this.player = await window.Soundfont.instrument(context, SOUNDFONTS[instrument] || 'acoustic_grand_piano', {
          soundfont: 'MusyngKite', format: 'mp3', destination: this.gain, gain: 0.94
        });
        return this.player;
      } catch (_) {
        return null;
      }
    }

    isRunning() { return this.active || this.pending; }

    stop() {
      this.request += 1;
      clearTimeout(this.timer);
      cancelAnimationFrame(this.frame);
      this.nodes.splice(0).forEach(node => { try { node.stop(); } catch (_) {} });
      this.nodes = [];
      this.active = false;
      this.pending = false;
      this.onProgress(null);
      this.onState({ active: false, pending: false, loop: this.loop });
    }

    animate(startTime, cycleSeconds) {
      const draw = () => {
        if (!this.active || !this.context) return;
        const elapsed = Math.max(0, this.context.currentTime - startTime);
        this.onProgress(Math.min(1, elapsed / cycleSeconds));
        this.frame = requestAnimationFrame(draw);
      };
      cancelAnimationFrame(this.frame);
      draw();
    }

    playCycle(notes, phrase, secondsPerBeat) {
      if (!this.active || !this.player || !this.context) return;
      const now = this.context.currentTime + 0.05;
      const totalSeconds = Math.max(0.2, phrase * secondsPerBeat);
      this.animate(now, totalSeconds);
      notes.forEach(note => {
        try {
          const node = this.player.play(note.pitch, now + Math.max(0, note.start) * secondsPerBeat, {
            duration: Math.max(0.08, note.duration * secondsPerBeat),
            gain: clamp((Number(note.velocity) || 96) / 127, 0.14, 0.95),
            attack: 0.008,
            release: 0.16
          });
          if (node && node.stop) this.nodes.push(node);
        } catch (_) {}
      });
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        if (!this.active) return;
        if (this.loop) this.playCycle(notes, phrase, secondsPerBeat);
        else this.stop();
      }, Math.round(totalSeconds * 1000 + 200));
    }

    async play({ notes, phrase, tempo, instrument, loop }) {
      this.stop();
      const request = ++this.request;
      this.loop = Boolean(loop);
      this.pending = true;
      this.onState({ active: false, pending: true, loop: this.loop });
      const player = await this.loadPlayer(instrument);
      if (request !== this.request) return;
      this.pending = false;
      if (!player || !Array.isArray(notes) || !notes.length) {
        this.onState({ active: false, pending: false, loop: this.loop, error: true });
        return;
      }
      this.active = true;
      this.onState({ active: true, pending: false, loop: this.loop });
      this.playCycle(notes, phrase, 60 / clamp(Number(tempo) || 92, 30, 260));
    }
  }

  window.IhyMotifPreview = MotifPreview;
})();
