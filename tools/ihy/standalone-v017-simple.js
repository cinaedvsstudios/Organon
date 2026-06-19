(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const slider = $('#zoomSlider');
  const value = $('#zoomValue');
  const play = $('#play');
  const stop = $('#stop');
  const mount = $('#playMount');
  const timer = $('#transportTime');
  const roll = $('#roll');
  const arrangement = $('#arrangement');
  const rollScroll = $('#rollScroll');
  const arrangementViewport = $('#arrangementViewport');
  if (!slider || !value || !play || !stop || !mount || !timer || !roll || !arrangement || !rollScroll || !arrangementViewport) return;

  const BEAT_WIDTH = 40;
  let playing = false;
  let zoom = Number(localStorage.getItem('ihy-display-zoom') || 100);
  let observerQueued = false;

  mount.append(play);
  play.classList.add('is-paused');
  play.textContent = '▶ Play';

  const number = value => Number.parseFloat(value || '0') || 0;
  const format = seconds => {
    const amount = Math.max(0, Math.round(seconds));
    return `${Math.floor(amount / 60)}:${String(amount % 60).padStart(2, '0')}`;
  };
  const totalBeats = () => Math.max(1, number(arrangement.style.width || roll.style.width) / BEAT_WIDTH);
  const currentBeats = () => number($('#playhead')?.style.left) / BEAT_WIDTH;
  const setButton = active => {
    playing = active;
    play.classList.toggle('is-paused', !active);
    play.textContent = active ? '⏸ Pause' : '▶ Play';
  };

  function ensureTimeLabels() {
    const total = totalBeats();
    const targetCount = Math.floor(total / 4) + 1;
    const existing = [...arrangement.querySelectorAll('.section-time-label')];
    const correct = existing.length === targetCount && existing.every((node, index) => Number(node.dataset.beat) === index * 4);
    if (correct) return;
    existing.forEach(node => node.remove());
    for (let beat = 0; beat <= total; beat += 4) {
      const label = document.createElement('span');
      label.className = 'section-time-label';
      label.dataset.beat = String(beat);
      label.style.left = `${beat * BEAT_WIDTH}px`;
      label.textContent = String(beat / 4 + 1);
      arrangement.append(label);
    }
  }

  function setZoom(percent) {
    zoom = Math.max(70, Math.min(150, Number(percent) || 100));
    slider.value = String(zoom);
    value.textContent = `${zoom}%`;
    localStorage.setItem('ihy-display-zoom', String(zoom));

    const scale = zoom / 100;
    document.documentElement.dataset.ihyRollScale = String(scale);
    roll.style.zoom = String(scale);
    arrangement.style.zoom = '';
    arrangementViewport.scrollLeft = rollScroll.scrollLeft / scale;
    ensureTimeLabels();
  }

  function updateTimer() {
    const bpm = Math.max(1, number($('#bpm')?.value) || 92);
    const current = currentBeats();
    const total = totalBeats();
    timer.textContent = `${format(current * 60 / bpm)} / ${format(total * 60 / bpm)}`;
    if (playing && current >= total - .02) setButton(false);
    requestAnimationFrame(updateTimer);
  }

  play.addEventListener('click', event => {
    if (!playing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    stop.click();
    setButton(false);
  }, true);
  play.addEventListener('click', () => { if (!playing) setButton(true); });
  stop.addEventListener('click', () => setButton(false));
  slider.addEventListener('input', event => setZoom(event.target.value));
  rollScroll.addEventListener('scroll', () => { arrangementViewport.scrollLeft = rollScroll.scrollLeft / (zoom / 100); });

  const observer = new MutationObserver(records => {
    if (observerQueued) return;
    const changed = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => !(node.nodeType === 1 && node.classList?.contains('section-time-label'))));
    if (!changed) return;
    observerQueued = true;
    requestAnimationFrame(() => { observerQueued = false; ensureTimeLabels(); });
  });
  observer.observe(arrangement, { childList: true, subtree: true });

  setZoom(zoom);
  ensureTimeLabels();
  updateTimer();
})();