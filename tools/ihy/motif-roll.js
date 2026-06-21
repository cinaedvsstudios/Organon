(() => {
  'use strict';

  const STEP = 0.25;
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mod = (value, base) => ((value % base) + base) % base;
  const noteName = pitch => `${NOTE_NAMES[mod(pitch, 12)]}${Math.floor(pitch / 12) - 1}`;

  class MotifRoll {
    constructor({ scroll, canvas, ruler, labels, grid, onChange }) {
      this.scroll = scroll;
      this.canvas = canvas;
      this.ruler = ruler;
      this.labels = labels;
      this.grid = grid;
      this.onChange = typeof onChange === 'function' ? onChange : () => {};
      this.notes = [];
      this.phrase = 8;
      this.register = 60;
      this.zoom = 1;
      this.playhead = null;
      this.playheadProgress = null;
      this.visibleTargetPending = true;
      this.bind();
    }

    setState({ notes, phrase, register, zoom, focus = false }) {
      this.notes = Array.isArray(notes) ? notes.map(note => ({ ...note })) : [];
      this.phrase = clamp(Number(phrase) || 8, 4, 32);
      this.register = clamp(Number(register) || 60, 48, 72);
      this.zoom = clamp(Number(zoom) || 1, 0.7, 1.75);
      this.visibleTargetPending = focus || this.visibleTargetPending;
      this.render();
    }

    getRange() {
      return { minPitch: this.register - 12, maxPitch: this.register + 35 };
    }

    metrics() {
      return { stepWidth: Math.round(30 * this.zoom), rowHeight: Math.round(24 * this.zoom), labelWidth: 58 };
    }

    cloneNotes() { return this.notes.map(note => ({ ...note })); }

    bind() {
      this.grid.addEventListener('pointerdown', event => {
        const block = event.target.closest('.motif-roll-note');
        if (block) this.beginEdit(event, block);
        else this.addNote(event);
      });
      this.grid.addEventListener('contextmenu', event => {
        const block = event.target.closest('.motif-roll-note');
        if (!block) return;
        event.preventDefault();
        this.notes = this.notes.filter(note => note.id !== block.dataset.noteId);
        this.onChange(this.cloneNotes());
        this.render();
      });
    }

    pointFromEvent(event) {
      const rect = this.grid.getBoundingClientRect();
      const { minPitch, maxPitch } = this.getRange();
      const { stepWidth, rowHeight } = this.metrics();
      const stepCount = Math.round(this.phrase / STEP);
      const step = clamp(Math.floor((event.clientX - rect.left) / stepWidth), 0, stepCount - 1);
      const row = clamp(Math.floor((event.clientY - rect.top) / rowHeight), 0, maxPitch - minPitch);
      return { start: step * STEP, pitch: maxPitch - row };
    }

    addNote(event) {
      if (event.button !== 0) return;
      const { start, pitch } = this.pointFromEvent(event);
      const duration = Math.min(1, this.phrase - start);
      this.notes.push({ id: `motif-roll-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, start, pitch, duration: Math.max(STEP, duration), velocity: 96 });
      this.onChange(this.cloneNotes());
      this.render();
    }

    beginEdit(event, block) {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const note = this.notes.find(item => item.id === block.dataset.noteId);
      if (!note) return;
      const { stepWidth } = this.metrics();
      const rect = block.getBoundingClientRect();
      const resize = event.clientX >= rect.right - Math.min(12, rect.width * 0.35);
      const startX = event.clientX;
      const startY = event.clientY;
      const original = { ...note };
      this.grid.setPointerCapture?.(event.pointerId);
      document.body.style.userSelect = 'none';
      block.classList.add('is-editing');

      const move = moveEvent => {
        const xSteps = Math.round((moveEvent.clientX - startX) / stepWidth);
        if (resize) {
          note.duration = clamp(original.duration + xSteps * STEP, STEP, this.phrase - original.start);
        } else {
          const point = this.pointFromEvent(moveEvent);
          note.start = clamp(original.start + xSteps * STEP, 0, this.phrase - STEP);
          note.pitch = point.pitch;
          note.duration = Math.min(original.duration, this.phrase - note.start);
        }
        this.sort();
        this.render();
      };
      const end = () => {
        document.body.style.userSelect = '';
        block.classList.remove('is-editing');
        this.grid.releasePointerCapture?.(event.pointerId);
        this.grid.removeEventListener('pointermove', move);
        this.grid.removeEventListener('pointerup', end);
        this.grid.removeEventListener('pointercancel', end);
        this.onChange(this.cloneNotes());
      };
      this.grid.addEventListener('pointermove', move);
      this.grid.addEventListener('pointerup', end, { once: true });
      this.grid.addEventListener('pointercancel', end, { once: true });
    }

    sort() { this.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch || String(a.id).localeCompare(String(b.id))); }

    setPlayhead(progress) {
      this.playheadProgress = Number.isFinite(progress) ? clamp(progress, 0, 1) : null;
      if (!this.playhead) return;
      this.playhead.hidden = this.playheadProgress === null;
      if (this.playheadProgress === null) return;
      const { stepWidth } = this.metrics();
      this.playhead.style.left = `${Math.round(this.playheadProgress * this.phrase / STEP) * stepWidth}px`;
    }

    render() {
      const { minPitch, maxPitch } = this.getRange();
      const { stepWidth, rowHeight, labelWidth } = this.metrics();
      const pitchCount = maxPitch - minPitch + 1;
      const stepCount = Math.round(this.phrase / STEP);
      const gridWidth = stepCount * stepWidth;
      const gridHeight = pitchCount * rowHeight;
      const visibleHeight = 28 + 24 * rowHeight + 20;

      this.scroll.style.setProperty('--motif-roll-visible-height', `${visibleHeight}px`);
      this.canvas.style.gridTemplateColumns = `${labelWidth}px ${gridWidth}px`;
      this.canvas.style.gridTemplateRows = `28px ${gridHeight}px`;
      this.canvas.style.width = `${labelWidth + gridWidth}px`;
      this.ruler.style.width = `${gridWidth}px`;
      this.labels.style.height = `${gridHeight}px`;
      this.labels.style.gridTemplateRows = `repeat(${pitchCount}, ${rowHeight}px)`;
      this.grid.style.width = `${gridWidth}px`;
      this.grid.style.height = `${gridHeight}px`;
      this.grid.style.setProperty('--motif-roll-step-width', `${stepWidth}px`);
      this.grid.style.setProperty('--motif-roll-row-height', `${rowHeight}px`);
      this.grid.style.setProperty('--motif-roll-bar-width', `${stepWidth * 16}px`);

      this.ruler.replaceChildren();
      for (let beat = 0; beat < this.phrase; beat += 1) {
        const marker = document.createElement('span');
        marker.className = beat % 4 === 0 ? 'motif-roll-bar-marker' : 'motif-roll-beat-marker';
        marker.style.left = `${beat * 4 * stepWidth}px`;
        marker.textContent = beat % 4 === 0 ? `Bar ${Math.floor(beat / 4) + 1}` : String(beat + 1);
        this.ruler.append(marker);
      }

      this.labels.replaceChildren();
      for (let pitch = maxPitch; pitch >= minPitch; pitch -= 1) {
        const label = document.createElement('div');
        label.className = `motif-roll-label${[1, 3, 6, 8, 10].includes(mod(pitch, 12)) ? ' black-key' : ''}`;
        label.textContent = noteName(pitch);
        this.labels.append(label);
      }

      this.grid.replaceChildren();
      this.playhead = document.createElement('div');
      this.playhead.className = 'motif-roll-playhead';
      this.grid.append(this.playhead);
      this.sort();
      this.notes.forEach(note => {
        if (note.pitch < minPitch || note.pitch > maxPitch || note.start >= this.phrase) return;
        const block = document.createElement('button');
        block.type = 'button';
        block.className = 'motif-roll-note';
        block.dataset.noteId = note.id;
        block.style.left = `${Math.round(note.start / STEP) * stepWidth + 1}px`;
        block.style.top = `${(maxPitch - note.pitch) * rowHeight + 1}px`;
        block.style.width = `${Math.max(8, Math.round(note.duration / STEP) * stepWidth - 2)}px`;
        block.style.height = `${Math.max(16, rowHeight - 2)}px`;
        block.title = `${noteName(note.pitch)} · ${note.duration.toFixed(2)} beats`;
        const label = document.createElement('span');
        label.textContent = noteName(note.pitch);
        const handle = document.createElement('i');
        handle.className = 'motif-roll-resize-handle';
        block.append(label, handle);
        this.grid.append(block);
      });
      this.setPlayhead(this.playheadProgress);
      if (this.visibleTargetPending) {
        const targetRow = clamp(maxPitch - this.register - 11, 0, Math.max(0, pitchCount - 24));
        requestAnimationFrame(() => { this.scroll.scrollTop = 28 + targetRow * rowHeight; });
        this.visibleTargetPending = false;
      }
    }
  }

  window.IhyMotifRoll = MotifRoll;
})();
