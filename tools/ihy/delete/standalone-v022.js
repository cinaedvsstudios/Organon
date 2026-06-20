(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const createButton = $('#createSound');
  const newProjectButton = $('#newProject');
  const analyseButton = $('#analyseButton');
  const analysisModal = $('#analysisModal');
  const analysisDetails = $('#analysisDetails');
  const analysisClose = $('#analysisClose');

  if (!createButton || !newProjectButton || !analyseButton || !analysisModal || !analysisDetails || !analysisClose) return;

  const number = value => Number.parseFloat(value || '0') || 0;
  const clock = seconds => {
    const whole = Math.max(0, Math.round(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  };
  const noteName = pitch => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
  };
  const escape = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));

  createButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    newProjectButton.click();
  }, true);

  analyseButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const bpm = Math.max(1, number($('#bpm')?.value) || 92);
    const key = $('#key')?.value || '—';
    const title = $('#title')?.value?.trim() || 'Untitled cue';
    const zoom = Math.max(.7, number($('#zoomValue')?.textContent) / 100 || 1);
    const beatWidth = 40 * zoom;
    const roll = $('#roll');
    const notes = [...document.querySelectorAll('#roll .note')];
    const tracks = [...document.querySelectorAll('#tracks .track')];
    const sections = [...document.querySelectorAll('#arrangement .arrangement-section:not([disabled])')];
    const totalBeats = Math.max(0, number(roll?.style.width) / beatWidth);
    const duration = totalBeats * 60 / bpm;
    const pitches = notes.map(node => 84 - Math.round((number(node.style.top) - 2) / 24)).filter(Number.isFinite);
    const range = pitches.length ? `${noteName(Math.min(...pitches))}–${noteName(Math.max(...pitches))}` : 'No notes yet';
    const trackNames = tracks.map(track => track.querySelector('.track-arm')?.textContent.trim()).filter(Boolean);

    analysisDetails.innerHTML = `
      <dl class="analysis-grid">
        <div><dt>Open project</dt><dd>${escape(title)}</dd></div>
        <div><dt>Tempo</dt><dd>${bpm} BPM</dd></div>
        <div><dt>Key</dt><dd>${escape(key)}</dd></div>
        <div><dt>Duration</dt><dd>${clock(duration)} (${totalBeats.toFixed(1)} beats)</dd></div>
        <div><dt>Tracks</dt><dd>${tracks.length}</dd></div>
        <div><dt>Notes</dt><dd>${notes.length}</dd></div>
        <div><dt>Pitch range</dt><dd>${range}</dd></div>
        <div><dt>Sections</dt><dd>${sections.length || 'Main track'}</dd></div>
      </dl>
      <p class="analysis-track-list"><strong>Track list:</strong> ${trackNames.length ? escape(trackNames.join(' · ')) : 'No tracks loaded'}</p>
    `;
    analysisModal.hidden = false;
  }, true);

  analysisClose.addEventListener('click', () => { analysisModal.hidden = true; });
  analysisModal.addEventListener('click', event => { if (event.target === analysisModal) analysisModal.hidden = true; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') analysisModal.hidden = true; });
})();