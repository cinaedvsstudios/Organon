(() => {
  'use strict';

  const PROJECT_KEY = 'ihy-v042-project';
  const HISTORY_KEY = 'ihy-v042-history';
  const TOAST_KEY = 'ihy-v044-toast';

  const makeBlankProject = () => ({
    version: '0.44',
    title: 'Untitled cue',
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

  const showToast = (text, duration = 3600) => {
    const target = document.getElementById('status');
    if (!target) return;
    target.textContent = text;
    clearTimeout(target._ihyToastTimer);
    target._ihyToastTimer = setTimeout(() => {
      if (target.textContent === text) target.textContent = '';
    }, duration);
  };

  const queued = sessionStorage.getItem(TOAST_KEY);
  if (queued) {
    sessionStorage.removeItem(TOAST_KEY);
    requestAnimationFrame(() => showToast(queued));
  }

  const oldClear = document.getElementById('clearTrack');
  if (oldClear) {
    const clear = oldClear.cloneNode(true);
    oldClear.replaceWith(clear);
    clear.addEventListener('click', () => {
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
})();
