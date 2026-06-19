(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const BASE_BEAT_WIDTH = 40;
  const slider = $('#zoomSlider');
  const value = $('#zoomValue');
  const play = $('#play');
  const stop = $('#stop');
  const mount = $('#playMount');
  const timer = $('#transportTime');
  const roll = $('#roll');
  const arrangement = $('#arrangement');
  if (!slider || !value || !play || !stop || !mount || !timer || !roll || !arrangement) return;

  let zoom = Number(localStorage.getItem('ihy-roll-zoom') || 100) / 100;
  let playing = false;
  let replayingSyntheticPointer = false;
  let applying = false;

  mount.append(play);
  play.classList.add('is-paused');
  play.textContent = '▶ Play';

  const number = value => Number.parseFloat(value || '0') || 0;
  const format = seconds => {
    const total = Math.max(0, Math.round(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };
  const getTotalBeats = () => {
    const base = number(arrangement.dataset.ihyBaseWidth || arrangement.style.width) || number(roll.dataset.ihyBaseWidth || roll.style.width);
    return Math.max(1, base / BASE_BEAT_WIDTH);
  };
  const getCurrentBeat = () => {
    const head = $('#playhead');
    if (!head) return 0;
    const displayed = number(head.style.left);
    return displayed / (BASE_BEAT_WIDTH * zoom);
  };
  const setPlayButton = state => {
    playing = state;
    play.classList.toggle('is-paused', !state);
    play.textContent = state ? '⏸ Pause' : '▶ Play';
  };

  function rememberAndScale(node, prop, field) {
    const current = number(node.style[prop]);
    const appliedField = `${field}Applied`;
    const existingApplied = number(node.dataset[appliedField]);
    if (!node.dataset[field] || Math.abs(current - existingApplied) > 0.5) node.dataset[field] = String(current);
    const base = number(node.dataset[field]);
    const scaled = base * zoom;
    node.style[prop] = `${scaled}px`;
    node.dataset[appliedField] = String(scaled);
  }

  function scaleWidth(node, field) {
    const current = number(node.style.width);
    const appliedField = `${field}Applied`;
    const existingApplied = number(node.dataset[appliedField]);
    if (!node.dataset[field] || Math.abs(current - existingApplied) > 0.5) node.dataset[field] = String(current);
    const base = number(node.dataset[field]);
    const scaled = base * zoom;
    node.style.width = `${scaled}px`;
    node.dataset[appliedField] = String(scaled);
  }

  function rebuildSectionClockLabels() {
    const existing = arrangement.querySelectorAll('.section-time-label');
    existing.forEach(node => node.remove());
    const baseWidth = number(arrangement.dataset.ihyBaseWidth || arrangement.style.width);
    const beats = Math.max(1, baseWidth / BASE_BEAT_WIDTH);
    for (let beat = 0; beat <= beats; beat += 4) {
      const label = document.createElement('span');
      label.className = 'section-time-label';
      label.textContent = String(beat / 4 + 1);
      label.dataset.ihyBaseLeft = String(beat * BASE_BEAT_WIDTH);
      arrangement.append(label);
    }
  }

  function applyZoom() {
    if (applying) return;
    applying = true;
    try {
      scaleWidth(roll, 'ihyBaseWidth');
      scaleWidth(arrangement, 'ihyBaseWidth');
      const nodes = document.querySelectorAll('#roll .note,#roll .bar,#roll .playhead,#arrangement .arrangement-section,#arrangement .arrangement-playhead,#arrangement .section-time-label');
      nodes.forEach(node => {
        rememberAndScale(node, 'left', 'ihyBaseLeft');
        if (node.matches('.note,.arrangement-section')) scaleWidth(node, 'ihyBaseWidth');
      });
    } finally {
      applying = false;
    }
  }

  function updateTimer() {
    applyZoom();
    const bpm = Math.max(1, number($('#bpm')?.value) || 92);
    const current = getCurrentBeat();
    const total = getTotalBeats();
    timer.textContent = `${format(current * 60 / bpm)} / ${format(total * 60 / bpm)}`;
    if (playing && current >= total - 0.02) setPlayButton(false);
    requestAnimationFrame(updateTimer);
  }

  function setZoom(percent) {
    const next = Math.max(50, Math.min(200, Number(percent) || 100));
    zoom = next / 100;
    slider.value = String(next);
    value.textContent = `${next}%`;
    localStorage.setItem('ihy-roll-zoom', String(next));
    rebuildSectionClockLabels();
    applyZoom();
  }

  function rescalePointer(event) {
    if (replayingSyntheticPointer || Math.abs(zoom - 1) < 0.001) return;
    const host = event.currentTarget;
    const rect = host.getBoundingClientRect();
    const adjustedX = rect.left + (event.clientX - rect.left) / zoom;
    event.preventDefault();
    event.stopImmediatePropagation();
    replayingSyntheticPointer = true;
    try {
      event.target.dispatchEvent(new PointerEvent(event.type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        isPrimary: event.isPrimary,
        button: event.button,
        buttons: event.buttons,
        clientX: adjustedX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey
      }));
    } finally {
      replayingSyntheticPointer = false;
    }
  }

  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(type => {
    roll.addEventListener(type, rescalePointer, true);
    arrangement.addEventListener(type, rescalePointer, true);
  });

  play.addEventListener('click', event => {
    if (!playing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    stop.click();
    setPlayButton(false);
  }, true);

  play.addEventListener('click', () => {
    if (!playing) setPlayButton(true);
  });

  stop.addEventListener('click', () => setPlayButton(false));

  slider.addEventListener('input', event => setZoom(event.target.value));

  const observer = new MutationObserver(() => {
    if (applying) return;
    requestAnimationFrame(() => {
      rebuildSectionClockLabels();
      applyZoom();
    });
  });
  observer.observe(roll, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  observer.observe(arrangement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });

  setZoom(Math.round(zoom * 100));
  rebuildSectionClockLabels();
  applyZoom();
  updateTimer();
})();