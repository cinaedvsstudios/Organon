(() => {
  'use strict';

  const PROJECT_KEY = 'ihy-v029-project';
  const HISTORY_KEY = 'ihy-v034-history';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const rawSetItem = Storage.prototype.setItem;
  let applyingHistory = false;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const uid = () => `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const readHistory = () => {
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{"undo":[],"redo":[]}');
      return { undo: Array.isArray(value.undo) ? value.undo : [], redo: Array.isArray(value.redo) ? value.redo : [] };
    } catch (_) {
      return { undo: [], redo: [] };
    }
  };
  const writeHistory = history => rawSetItem.call(localStorage, HISTORY_KEY, JSON.stringify(history));
  const readProject = () => {
    try { return JSON.parse(localStorage.getItem(PROJECT_KEY) || '{"tracks":[],"key":"D minor"}'); }
    catch (_) { return { tracks: [], key: 'D minor' }; }
  };
  const writeProject = project => localStorage.setItem(PROJECT_KEY, JSON.stringify(project));

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    if (this === localStorage && key === PROJECT_KEY && !applyingHistory) {
      const before = localStorage.getItem(PROJECT_KEY);
      if (before && before !== value) {
        const history = readHistory();
        history.undo.push(before);
        if (history.undo.length > 80) history.undo.shift();
        history.redo = [];
        writeHistory(history);
        requestAnimationFrame(updateHistoryButtons);
      }
    }
    return rawSetItem.apply(this, arguments);
  };

  function updateHistoryButtons() {
    const history = readHistory();
    const undo = $('#toolUndo');
    const redo = $('#toolRedo');
    if (undo) undo.disabled = !history.undo.length;
    if (redo) redo.disabled = !history.redo.length;
  }

  function applyHistory(direction) {
    const history = readHistory();
    const current = localStorage.getItem(PROJECT_KEY);
    const source = direction === 'undo' ? history.undo : history.redo;
    const target = source.pop();
    if (!target || !current) return;
    if (direction === 'undo') history.redo.push(current);
    else history.undo.push(current);
    writeHistory(history);
    applyingHistory = true;
    rawSetItem.call(localStorage, PROJECT_KEY, target);
    applyingHistory = false;
    location.reload();
  }

  function saveNow() {
    $('#save')?.click();
  }

  function selectedNodes() {
    return $$('#roll .note.selected');
  }

  function showExistingMenu(event) {
    const menu = $('#noteMenu');
    if (!menu) return;
    const makeChord = $('#menuMakeChord');
    if (makeChord) makeChord.disabled = !selectedNodes().length;
    const paste = $('#menuPaste');
    if (paste) paste.disabled = false;
    menu.hidden = false;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - 185, event.clientX))}px`;
    menu.style.top = `${Math.max(8, Math.min(window.innerHeight - 230, event.clientY))}px`;
  }

  function preserveMultiSelectionOnRightClick(event) {
    const pointerMode = $('#toolPointer')?.classList.contains('tool-active');
    const note = event.target.closest('.note');
    if (!pointerMode || !note || !note.classList.contains('selected') || selectedNodes().length < 2) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    saveNow();
    showExistingMenu(event);
  }

  function selectedReferences(project) {
    const selected = new Set(selectedNodes().map(node => `${node.dataset.track}:${node.dataset.note}`));
    const refs = [];
    (project.tracks || []).forEach(track => (track.notes || []).forEach(note => {
      if (selected.has(`${track.id}:${note.id}`)) refs.push({ track, note });
    }));
    return refs;
  }

  function inScale(pitch, scale) {
    return scale.notes.includes(((pitch - scale.root) % 12 + 12) % 12);
  }

  function scaleStep(pitch, steps, scale) {
    let value = pitch;
    let remaining = steps;
    while (remaining > 0) {
      value += 1;
      if (inScale(value, scale)) remaining -= 1;
    }
    return value;
  }

  function chordPitches(pitch, key) {
    const scales = {
      'C major': { root: 0, notes: [0, 2, 4, 5, 7, 9, 11] },
      'D minor': { root: 2, notes: [0, 2, 3, 5, 7, 8, 10] },
      'A minor': { root: 9, notes: [0, 2, 3, 5, 7, 8, 10] },
      'F major': { root: 5, notes: [0, 2, 4, 5, 7, 9, 11] },
      'G major': { root: 7, notes: [0, 2, 4, 5, 7, 9, 11] },
      'A♭ major': { root: 8, notes: [0, 2, 4, 5, 7, 9, 11] }
    };
    const scale = scales[key] || scales['D minor'];
    let root = pitch;
    while (!inScale(root, scale) && root > 48) root -= 1;
    return [root, scaleStep(root, 2, scale), scaleStep(root, 4, scale)].filter(value => value >= 48 && value <= 84);
  }

  function makeChordFromSelection() {
    saveNow();
    const project = readProject();
    const refs = selectedReferences(project);
    if (!refs.length) return;

    const groupRoots = new Map();
    const roots = [];
    refs.forEach(ref => {
      if (!ref.note.groupId) {
        roots.push(ref);
        return;
      }
      const existing = groupRoots.get(ref.note.groupId);
      if (!existing || ref.note.pitch < existing.note.pitch) groupRoots.set(ref.note.groupId, ref);
    });
    roots.push(...groupRoots.values());

    roots.forEach(ref => {
      const groupId = ref.note.groupId || uid();
      ref.note.groupId = groupId;
      const pitches = chordPitches(ref.note.pitch, project.key);
      pitches.forEach(pitch => {
        const exists = ref.track.notes.some(note => note.start === ref.note.start && note.duration === ref.note.duration && note.pitch === pitch && note.groupId === groupId);
        if (!exists) {
          ref.track.notes.push({
            id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            start: ref.note.start,
            pitch,
            duration: ref.note.duration,
            velocity: ref.note.velocity,
            groupId
          });
        }
      });
    });

    writeProject(project);
    $('#noteMenu').hidden = true;
    location.reload();
  }

  function installAutoSave() {
    document.addEventListener('pointerup', event => {
      if (event.target.closest('#roll')) setTimeout(saveNow, 0);
    }, true);

    document.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.matches('#toolJoin,#toolTrash,#clear,#addTrack,#addSection') || target.closest('#noteMenu')) setTimeout(saveNow, 0);
    }, true);

    document.addEventListener('keyup', event => {
      if ('awsedftgyhujk'.includes(event.key.toLowerCase())) setTimeout(saveNow, 0);
    }, true);
  }

  function initialise() {
    $('#toolUndo')?.addEventListener('click', () => applyHistory('undo'));
    $('#toolRedo')?.addEventListener('click', () => applyHistory('redo'));
    $('#roll')?.addEventListener('contextmenu', preserveMultiSelectionOnRightClick, true);
    $('#noteMenu')?.addEventListener('click', event => {
      const action = event.target.closest('[data-note-action]')?.dataset.noteAction;
      if (action === 'make-chord') {
        event.preventDefault();
        event.stopImmediatePropagation();
        makeChordFromSelection();
        return;
      }
      if (action) setTimeout(saveNow, 0);
    }, true);
    installAutoSave();
    updateHistoryButtons();
  }

  initialise();
})();