import { handlesAreSame, makeId, queryDirectoryPermission, requestDirectoryPermission } from './filesystem.js';
import { persistence } from './persistence.js';
import {
  createLibraryEntry,
  createMount,
  createState,
  librarySource,
  makeWindowRecord,
  physicalSource,
  recentsSource,
  sourceKey,
  sourcePathLabel,
  sourceTitle,
  windowSnapshot
} from './state.js';
import { Workspace } from './workspace.js';

const state = createState();
let workspace;
let saveTimer = null;

function toast(message, type = 'info') {
  const template = document.getElementById('toast-template');
  const node = template.content.firstElementChild.cloneNode(true);
  node.classList.toggle('error', type === 'error');
  node.querySelector('[data-toast-symbol]').textContent = type === 'error' ? '!' : type === 'success' ? '✓' : '•';
  node.querySelector('[data-toast-message]').textContent = message;
  document.getElementById('toast-layer').append(node);
  window.setTimeout(() => node.remove(), type === 'error' ? 5400 : 3000);
}

function serialiseMount(mount) {
  return {
    id: mount.id,
    handle: mount.handle,
    name: mount.name,
    nickname: mount.nickname,
    colour: mount.colour,
    createdAt: mount.createdAt,
    lastOpenedAt: mount.lastOpenedAt
  };
}

function workspaceSnapshot() {
  return {
    nextWindowId: state.nextWindowId,
    activeWindowId: state.activeWindowId,
    panX: state.workspace.panX,
    panY: state.workspace.panY,
    windows: [...state.windows.values()].map(windowSnapshot)
  };
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    try {
      await Promise.all([
        persistence.saveMounts([...state.mounts.values()].map(serialiseMount)),
        persistence.saveLibrary(state.library),
        persistence.saveRecents(state.recents),
        persistence.saveWorkspace(workspaceSnapshot())
      ]);
    } catch (error) {
      console.error(error);
      toast('Capsularius could not save this workspace change.', 'error');
    }
  }, 180);
}

async function restoreState() {
  const saved = await persistence.load();
  for (const rawMount of saved.mounts) {
    if (!rawMount?.id || !rawMount?.handle) continue;
    let permission = 'denied';
    try {
      permission = await queryDirectoryPermission(rawMount.handle);
    } catch (_) {
      permission = 'denied';
    }
    state.mounts.set(rawMount.id, { ...rawMount, permission });
  }
  state.library = saved.library.filter((entry) => entry && entry.mountId && Array.isArray(entry.pathSegments));
  state.recents = saved.recents.filter((entry) => entry && entry.mountId && Array.isArray(entry.pathSegments)).slice(0, 10);

  if (saved.workspace) {
    state.nextWindowId = Math.max(1, Number(saved.workspace.nextWindowId) || 1);
    state.activeWindowId = saved.workspace.activeWindowId || null;
    state.workspace.panX = Number(saved.workspace.panX) || 0;
    state.workspace.panY = Number(saved.workspace.panY) || 0;
    workspace.applyWorkspaceTransform();

    const windows = Array.isArray(saved.workspace.windows) ? saved.workspace.windows : [];
    windows.forEach((snapshot) => {
      if (!snapshot?.source) return;
      const record = makeWindowRecord(state, snapshot.source, snapshot);
      record.id = Number(snapshot.id) || state.nextWindowId++;
      state.nextWindowId = Math.max(state.nextWindowId, record.id + 1);
      workspace.addWindow(record);
    });
  }

  if (state.windows.size === 0) {
    openSource(librarySource(), { nickname: 'Library', colour: '#e0a360' });
  }
}

async function mountFolder() {
  if (!('showDirectoryPicker' in window)) {
    toast('This browser cannot mount local folders. Open Capsularius in Chrome or Edge.', 'error');
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    for (const existing of state.mounts.values()) {
      if (await handlesAreSame(existing.handle, handle)) {
        existing.permission = await queryDirectoryPermission(existing.handle);
        openSource(physicalSource(existing.id, []));
        toast(`${existing.nickname || existing.name} is already mounted.`, 'info');
        return;
      }
    }

    const colours = ['#e0a360', '#4b84bf', '#449e92', '#9a2f4f', '#d27d6c', '#896b49'];
    const mount = createMount(handle, colours[state.mounts.size % colours.length]);
    mount.permission = await queryDirectoryPermission(handle);
    state.mounts.set(mount.id, mount);
    openSource(physicalSource(mount.id, []));
    scheduleSave();
    toast(`Mounted ${mount.name}.`, 'success');
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error(error);
      toast('Capsularius could not mount that folder.', 'error');
    }
  }
}

function openSource(source, options = {}) {
  const record = makeWindowRecord(state, source, options);
  workspace.addWindow(record);
  scheduleSave();
  return record;
}

async function reopenPermission(mountId, windowRecord) {
  const mount = state.mounts.get(mountId);
  if (!mount) {
    toast('This mounted folder is no longer available.', 'error');
    return;
  }
  try {
    mount.permission = await requestDirectoryPermission(mount.handle);
    if (mount.permission !== 'granted') {
      toast('Folder access was not granted.', 'error');
      return;
    }
    await workspace.loadWindow(windowRecord);
    scheduleSave();
  } catch (error) {
    console.error(error);
    toast('Capsularius could not reconnect that folder.', 'error');
  }
}

async function recordRecent(source) {
  if (source.kind !== 'physical') return;
  const mount = state.mounts.get(source.mountId);
  if (!mount) return;
  const key = sourceKey(source);
  const next = {
    id: makeId('recent'),
    mountId: source.mountId,
    pathSegments: [...source.pathSegments],
    name: sourceTitle(state, source),
    colour: mount.colour,
    lastOpenedAt: Date.now(),
    key
  };
  state.recents = [next, ...state.recents.filter((entry) => entry.key !== key && !(entry.mountId === source.mountId && entry.pathSegments.join('/') === source.pathSegments.join('/')))].slice(0, 10);
  workspace.refreshAllSpecialWindows();
  scheduleSave();
}

function showLibraryDialog(windowRecord) {
  if (windowRecord.source.kind !== 'physical') return;
  const mount = state.mounts.get(windowRecord.source.mountId);
  if (!mount) return;
  const template = document.getElementById('library-dialog-template');
  const dialog = template.content.firstElementChild.cloneNode(true);
  const currentSource = windowRecord.source;
  const nameInput = dialog.querySelector('[data-library-name]');
  const emojiInput = dialog.querySelector('[data-library-emoji]');
  const colourInput = dialog.querySelector('[data-library-colour]');
  const layer = document.getElementById('dialog-layer');

  dialog.querySelector('[data-library-location]').textContent = sourcePathLabel(state, currentSource);
  nameInput.value = sourceTitle(state, currentSource);
  emojiInput.value = '📁';
  colourInput.value = mount.colour;
  layer.append(dialog);

  const close = () => dialog.remove();
  dialog.querySelectorAll('[data-library-cancel]').forEach((button) => button.addEventListener('click', close));
  dialog.addEventListener('click', (event) => {
    if (event.target.matches('[data-modal-backdrop]')) close();
  });

  dialog.querySelector('[data-library-confirm]').addEventListener('click', () => {
    const name = nameInput.value.trim() || sourceTitle(state, currentSource);
    const emoji = emojiInput.value.trim() || '📁';
    const colour = colourInput.value || mount.colour;
    const locationKey = sourceKey(currentSource);
    const existingIndex = state.library.findIndex((entry) => sourceKey(physicalSource(entry.mountId, entry.pathSegments)) === locationKey);
    const entry = createLibraryEntry(currentSource, { name, emoji, colour });
    if (existingIndex === -1) state.library.push(entry);
    else state.library.splice(existingIndex, 1, { ...entry, id: state.library[existingIndex].id, addedAt: state.library[existingIndex].addedAt });
    workspace.refreshAllSpecialWindows();
    scheduleSave();
    close();
    toast(existingIndex === -1 ? `Added ${name} to Library.` : `Updated ${name} in Library.`, 'success');
  });

  window.setTimeout(() => nameInput.focus(), 0);
}

function bindGlobalControls() {
  document.getElementById('mount-folder-button').addEventListener('click', mountFolder);
  document.getElementById('new-window-button').addEventListener('click', () => {
    const active = state.windows.get(state.activeWindowId);
    if (active?.source?.kind === 'physical') openSource(active.source);
    else if (state.mounts.size > 0) openSource(physicalSource([...state.mounts.keys()][0], []));
    else openSource(librarySource());
  });
  document.getElementById('open-library-button').addEventListener('click', () => openSource(librarySource(), { nickname: 'Library', colour: '#e0a360' }));
  document.getElementById('open-recents-button').addEventListener('click', () => openSource(recentsSource(), { nickname: 'Recents', colour: '#4b84bf' }));

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      const active = state.windows.get(state.activeWindowId);
      const filter = active?.element?.querySelector('.folder-filter');
      if (filter) {
        event.preventDefault();
        filter.focus();
      }
    }
  });
}

async function boot() {
  workspace = new Workspace({
    state,
    onStateChange: scheduleSave,
    onLocationOpened: recordRecent,
    onRequestPermission: reopenPermission,
    onAddToLibrary: showLibraryDialog,
    onOpenSource: openSource,
    onToast: toast
  });
  bindGlobalControls();

  try {
    await restoreState();
  } catch (error) {
    console.error(error);
    toast('Saved Capsularius locations could not be restored.', 'error');
    openSource(librarySource(), { nickname: 'Library', colour: '#e0a360' });
  }
}

boot();
