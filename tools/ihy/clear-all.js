(() => {
  'use strict';

  const APP_VERSION = 'v1.13';
  document.title = `Ihy ${APP_VERSION} — Sound & Music Workshop`;
  document.querySelectorAll('.version-pill').forEach((element) => {
    element.textContent = APP_VERSION;
  });

  const PROJECT_KEY = 'ihy-v042-project';
  const HISTORY_KEY = 'ihy-v042-history';
  const TOAST_KEY = 'ihy-v045-toast';
  const ROLL_SIZE_KEY = 'ihy-v045-roll-height';
  const KEYBOARD_SIZE_KEY = 'ihy-v045-keyboard-height';

  const makeBlankProject = () => ({
    version: '0.45',
    title: 'untitled',
    bpm: 92,
    key: 'D minor',
    sections: [],
    tracks: [{
      id: `track-${Date.now().toString(36)}`,
      name: 'Piano',
      instrument: 'grand_piano',
      color: '#b68cff',
      muted: false,
      solo: false,
      hidden: false,
      notes: []
    }]
  });

  const toast = document.getElementById('status');
  let toastTimer = 0;
  const showToast = (text, duration = 3200) => {
    if (!toast || !text) return;
    toast.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      if (toast.textContent === text) toast.textContent = '';
    }, duration);
  };

  const queued = sessionStorage.getItem(TOAST_KEY);
  if (queued) {
    sessionStorage.removeItem(TOAST_KEY);
    requestAnimationFrame(() => showToast(queued));
  }

  if (toast) {
    new MutationObserver(() => {
      const text = toast.textContent.trim();
      if (!text) return;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        if (toast.textContent.trim() === text) toast.textContent = '';
      }, 3200);
    }).observe(toast, { childList: true, characterData: true, subtree: true });
  }

  const clearButton = document.getElementById('clearTrack');
  if (clearButton) {
    const replacement = clearButton.cloneNode(true);
    clearButton.replaceWith(replacement);
    replacement.addEventListener('click', () => {
      localStorage.setItem(PROJECT_KEY, JSON.stringify(makeBlankProject()));
      localStorage.setItem(HISTORY_KEY, JSON.stringify({ undo: [], redo: [] }));
      sessionStorage.setItem(TOAST_KEY, 'Cleared. New blank canvas ready.');
      window.location.reload();
    });
  }

  const exportStatus = document.getElementById('exportStatus');
  if (exportStatus) {
    new MutationObserver(() => {
      const text = exportStatus.textContent.trim();
      if (text) showToast(text);
    }).observe(exportStatus, { childList: true, characterData: true, subtree: true });
  }

  const playButton = document.getElementById('playPause');
  const counter = document.getElementById('transportTime');
  const syncPlaybackGlow = () => {
    const active = Boolean(playButton?.textContent.includes('Pause'));
    playButton?.classList.toggle('is-playing', active);
    counter?.classList.toggle('is-playing', active);
  };
  if (playButton) {
    new MutationObserver(syncPlaybackGlow).observe(playButton, { childList: true, characterData: true, subtree: true });
    playButton.addEventListener('click', () => setTimeout(syncPlaybackGlow, 20));
  }
  document.getElementById('stopPlayback')?.addEventListener('click', () => setTimeout(syncPlaybackGlow, 20));
  syncPlaybackGlow();

  const setupResizer = ({ gripId, targetId, storageKey, min, max, onHeight }) => {
    const grip = document.getElementById(gripId);
    const target = document.getElementById(targetId);
    if (!grip || !target) return;

    const stored = Number(localStorage.getItem(storageKey));
    if (Number.isFinite(stored) && stored >= min && stored <= max) onHeight(stored);

    grip.addEventListener('pointerdown', event => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = target.getBoundingClientRect().height;
      grip.classList.add('resizing');
      document.body.style.userSelect = 'none';
      grip.setPointerCapture?.(event.pointerId);

      const move = moveEvent => {
        const next = Math.max(min, Math.min(max, Math.round(startHeight + moveEvent.clientY - startY)));
        onHeight(next);
      };
      const end = () => {
        grip.classList.remove('resizing');
        document.body.style.userSelect = '';
        localStorage.setItem(storageKey, String(Math.round(target.getBoundingClientRect().height)));
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end, { once: true });
      window.addEventListener('pointercancel', end, { once: true });
    });
  };

  setupResizer({
    gripId: 'rollResizeGrip',
    targetId: 'rollScroll',
    storageKey: ROLL_SIZE_KEY,
    min: 220,
    max: 760,
    onHeight: height => document.documentElement.style.setProperty('--roll-panel-height', `${height}px`)
  });

  setupResizer({
    gripId: 'keyboardResizeGrip',
    targetId: 'keyboardWrap',
    storageKey: KEYBOARD_SIZE_KEY,
    min: 150,
    max: 620,
    onHeight: height => {
      const shell = document.getElementById('keyboardResizeShell');
      if (!shell) return;
      shell.style.setProperty('--keyboard-panel-height', `${height}px`);
      shell.style.setProperty('--keyboard-key-height', `${Math.max(134, height - 16)}px`);
      shell.style.setProperty('--keyboard-black-height', `${Math.max(84, Math.round((height - 16) * .63))}px`);
    }
  });
})();
