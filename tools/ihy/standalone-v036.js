(() => {
  'use strict';

  const PROJECT_KEY = 'ihy-v035-project';
  const HISTORY_KEY = 'ihy-v035-history';
  const $ = selector => document.querySelector(selector);
  const same = (left, right) => left === right;
  let dragSnapshot = null;

  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{"undo":[],"redo":[]}');
      return { undo: Array.isArray(value.undo) ? value.undo : [], redo: Array.isArray(value.redo) ? value.redo : [] };
    } catch (_) {
      return { undo: [], redo: [] };
    }
  }

  function pushSnapshot() {
    const project = localStorage.getItem(PROJECT_KEY);
    if (!project) return;
    dragSnapshot = project;
    const history = readHistory();
    if (history.undo.at(-1) !== project) {
      history.undo.push(project);
      if (history.undo.length > 100) history.undo.shift();
      history.redo = [];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
  }

  function tidyDragHistory() {
    if (!dragSnapshot) return;
    const current = localStorage.getItem(PROJECT_KEY);
    const history = readHistory();
    if (same(current, dragSnapshot) && history.undo.at(-1) === dragSnapshot) history.undo.pop();
    if (history.undo.length > 1 && history.undo.at(-1) === current) history.undo.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    dragSnapshot = null;
  }

  $('#roll')?.addEventListener('pointerdown', event => {
    if (event.target.closest('.note')) pushSnapshot();
  }, true);

  $('#arrangement')?.addEventListener('pointerdown', event => {
    if (event.target.closest('.arrangement-section[data-readonly="false"]')) pushSnapshot();
  }, true);

  document.addEventListener('pointerup', () => setTimeout(tidyDragHistory, 0), true);

  $('#trackInstrumentLabel')?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const submenu = $('#trackInstrumentSubmenu');
    submenu.hidden = !submenu.hidden;
    $('#trackInstrumentLabel').textContent = submenu.hidden ? `${$('#trackInstrumentLabel').textContent.replace(/[⌄⌃].*$/, '').replace(/›.*$/, '').trim()} ›` : `${$('#trackInstrumentLabel').textContent.replace(/[⌄⌃].*$/, '').replace(/›.*$/, '').trim()} ⌃`;
  }, true);
})();