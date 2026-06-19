import { makeId, queryDirectoryPermission, requestDirectoryPermission } from './filesystem.js';
import { installFolderDrop } from './folder-drop.js';
import { promptMountLabel } from './mount-dialog.js';
import { createMountService } from './mount-service.js';
import { OperationManager, directoryForSource } from './operations.js';
import { createOperationUi } from './operation-ui.js';
import { persistence } from './persistence.js';
import { cloneSource, createLibraryEntry, createState, librarySource, makeWindowRecord, physicalSource, sourceKey, sourcePathLabel, sourceTitle, windowSnapshot } from './state.js';
import { installTree } from './tree.js';
import { installWorkspaceUi } from './workspace-ui.js';
import { installSettings } from './settings.js';
import { Workspace } from './workspace.js';

const state = createState();
let workspace;
let operations;
let mountService;
let clipboard = null;
let saveTimer = null;

function toast(message, type = 'info') {
  const template = document.getElementById('toast-template');
  const node = template.content.firstElementChild.cloneNode(true);
  node.classList.toggle('error', type === 'error');
  node.querySelector('[data-toast-symbol]').textContent = type === 'error' ? '!' : type === 'success' ? '✓' : '•';
  node.querySelector('[data-toast-message]').textContent = message;
  document.getElementById('toast-layer').append(node);
  window.setTimeout(() => node.remove(), type === 'error' ? 5600 : 3000);
}

function serialiseMount(mount) {
  return {
    id: mount.id,
    handle: mount.handle,
    name: mount.name,
    nickname: mount.nickname,
    colour: mount.colour,
    createdAt: mount.createdAt,
    lastOpenedAt: mount.lastOpenedAt,
    health: mount.health || 'unknown',
    healthDetail: mount.healthDetail || ''
  };
}

function workspaceSnapshot() {
  return {
    nextWindowId: state.nextWindowId,
    activeWindowId: state.activeWindowId,
    panX: state.workspace.panX,
    panY: state.workspace.panY,
    currentColourIndex: state.currentColourIndex,
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
  }, 300);
}

function openSource(source, options = {}) {
  const record = makeWindowRecord(state, source, options);
  workspace.addWindow(record);
  scheduleSave();
  return record;
}

async function restoreState() {
  const saved = await persistence.load();
  for (const raw of saved.mounts) {
    if (!raw?.id || !raw?.handle) continue;
    let permission = 'denied';
    try { permission = await queryDirectoryPermission(raw.handle); } catch (_) { /* browser no longer recognises the handle */ }
    state.mounts.set(raw.id, { ...raw, permission, health: permission === 'granted' ? 'connected' : 'permission-required' });
  }
  state.library = saved.library.filter((entry) => entry?.mountId && Array.isArray(entry.pathSegments));
  state.recents = saved.recents.filter((entry) => entry?.mountId && Array.isArray(entry.pathSegments)).slice(0, 10);
  if (saved.workspace) {
    state.nextWindowId = Math.max(1, Number(saved.workspace.nextWindowId) || 1);
    state.activeWindowId = saved.workspace.activeWindowId || null;
    state.workspace.panX = Number(saved.workspace.panX) || 0;
    state.workspace.panY = Number(saved.workspace.panY) || 0;
    state.currentColourIndex = Math.max(0, Number(saved.workspace.currentColourIndex) || 0);
    workspace.applyWorkspaceTransform();
    const specialWindows = new Set();
    for (const snapshot of Array.isArray(saved.workspace.windows) ? saved.workspace.windows : []) {
      if (!snapshot?.source) continue;
      if ((snapshot.source.kind === 'library' || snapshot.source.kind === 'recents') && specialWindows.has(snapshot.source.kind)) continue;
      if (snapshot.source.kind === 'library' || snapshot.source.kind === 'recents') specialWindows.add(snapshot.source.kind);
      const record = makeWindowRecord(state, snapshot.source, snapshot);
      record.id = Number(snapshot.id) || state.nextWindowId++;
      state.nextWindowId = Math.max(state.nextWindowId, record.id + 1);
      workspace.addWindow(record);
    }
  }
  if (!state.windows.size) openSource(librarySource(), { nickname:'Library', colour:'#e0a360' });
}

async function mountFolder() {
  if (!('showDirectoryPicker' in window)) {
    toast('This browser cannot mount local folders. Open Capsularius in Chrome or Edge.', 'error');
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode:'readwrite' });
    await mountService.mountDirectory(handle, { source:'picker' });
  } catch (error) {
    if (error?.name !== 'AbortError') toast('Capsularius could not mount that folder.', 'error');
  }
}

async function reopenPermission(mountId, windowRecord) {
  const mount = state.mounts.get(mountId);
  if (!mount) return toast('This mounted folder is no longer available.', 'error');
  try {
    mount.permission = await requestDirectoryPermission(mount.handle);
    if (mount.permission !== 'granted') return toast('Folder access was not granted.', 'error');
    mount.health = 'connected';
    mount.healthDetail = 'Folder opens normally.';
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
    id: makeId('recent'), mountId: source.mountId, pathSegments: [...source.pathSegments],
    name: sourceTitle(state, source), colour: mount.colour, lastOpenedAt: Date.now(), key
  };
  state.recents = [next, ...state.recents.filter((entry) => entry.key !== key)].slice(0, 10);
  workspace.refreshSpecialWindows?.();
  scheduleSave();
}

function showLibraryDialog(windowRecord, source = windowRecord.source) {
  if (source.kind !== 'physical') return;
  const mount = state.mounts.get(source.mountId);
  if (!mount) return;
  const dialog = document.getElementById('library-dialog-template').content.firstElementChild.cloneNode(true);
  const name = dialog.querySelector('[data-library-name]');
  const emoji = dialog.querySelector('[data-library-emoji]');
  const colour = dialog.querySelector('[data-library-colour]');
  dialog.querySelector('[data-library-location]').textContent = sourcePathLabel(state, source);
  name.value = sourceTitle(state, source); emoji.value = '📁'; colour.value = mount.colour;
  const close = () => dialog.remove();
  dialog.querySelectorAll('[data-library-cancel]').forEach((button) => button.addEventListener('click', close));
  dialog.querySelector('[data-library-confirm]').addEventListener('click', () => {
    const key = sourceKey(source);
    const entry = createLibraryEntry(source, { name:name.value.trim() || sourceTitle(state,source), emoji:emoji.value.trim() || '📁', colour:colour.value || mount.colour });
    const existing = state.library.findIndex((item) => sourceKey(physicalSource(item.mountId,item.pathSegments)) === key);
    if (existing === -1) state.library.push(entry);
    else state.library.splice(existing,1,{...entry,id:state.library[existing].id,addedAt:state.library[existing].addedAt});
    workspace.refreshSpecialWindows(); scheduleSave(); close(); toast(existing === -1 ? `Added ${entry.name} to Library.` : `Updated ${entry.name} in Library.`, 'success');
  });
  document.getElementById('dialog-layer').append(dialog);
  setTimeout(() => name.focus(), 0);
}

function hasAccess(record) {
  return record?.source?.kind === 'physical' && state.mounts.get(record.source.mountId)?.permission === 'granted';
}

async function runTransfer(sourceWindow, targetWindow, entries, mode) {
  if (!entries.length) return toast('Select at least one item first.', 'error');
  if (!hasAccess(sourceWindow) || !hasAccess(targetWindow)) return toast('Reconnect both folders before changing files.', 'error');
  await operations.copyOrMove({
    mode, entries,
    sourceDirectory: await directoryForSource(state, sourceWindow.source),
    targetDirectory: await directoryForSource(state, targetWindow.source),
    sourceLabel: sourceTitle(state, sourceWindow.source),
    targetLabel: sourceTitle(state, targetWindow.source),
    sourcePathSegments: sourceWindow.source.pathSegments,
    targetPathSegments: targetWindow.source.pathSegments,
    sameMount: sourceWindow.source.mountId === targetWindow.source.mountId
  });
}

async function handleCommand(command, payload) {
  const { windowRecord, entries = [], entry, sourceWindow, targetWindow, mode } = payload;
  if (command === 'refresh') return workspace.loadWindow(windowRecord);
  if (command === 'transfer') return runTransfer(sourceWindow,targetWindow,entries,mode);
  if (command === 'copy' || command === 'cut') {
    if (!hasAccess(windowRecord) || !entries.length) return toast('Select real folder items first.', 'error');
    clipboard = { mode: command === 'cut' ? 'move' : 'copy', entries:[...entries], sourceWindow };
    return toast(`${command === 'cut' ? 'Cut' : 'Copied'} ${entries.length} item${entries.length === 1 ? '' : 's'}. Choose a destination and paste.`);
  }
  if (command === 'paste') {
    if (!clipboard) return toast('Nothing is waiting to be pasted.', 'error');
    if (!hasAccess(windowRecord)) return toast('Open a real destination folder first.', 'error');
    await runTransfer(clipboard.sourceWindow,windowRecord,clipboard.entries,clipboard.mode);
    if (clipboard.mode === 'move') clipboard = null;
    return;
  }
  if (command === 'new-folder') {
    if (!hasAccess(windowRecord)) return toast('Open a real folder first.', 'error');
    return operations.createFolder({ directoryHandle:await directoryForSource(state,windowRecord.source), label:sourceTitle(state,windowRecord.source) });
  }
  if (command === 'rename') {
    if (!hasAccess(windowRecord) || entries.length !== 1) return toast('Select one real item to rename.', 'error');
    return operations.rename({ entry:entries[0], parentDirectory:await directoryForSource(state,windowRecord.source), parentLabel:sourceTitle(state,windowRecord.source) });
  }
  if (command === 'delete') {
    if (!hasAccess(windowRecord) || !entries.length) return toast('Select real folder items to delete.', 'error');
    return operations.delete({ entries, parentDirectory:await directoryForSource(state,windowRecord.source), parentLabel:sourceTitle(state,windowRecord.source) });
  }
  if (command === 'add-to-library' && entry?.kind === 'directory') showLibraryDialog(windowRecord,physicalSource(windowRecord.source.mountId,[...windowRecord.source.pathSegments,entry.name]));
}

function bindControls() {
  document.getElementById('mount-folder-button').addEventListener('click',mountFolder);
  document.getElementById('tile-windows-button').addEventListener('click',()=>workspace.tileVisibleWindows());
  document.getElementById('new-window-button').addEventListener('click',()=>{
    const active=state.windows.get(state.activeWindowId);
    if(active?.source?.kind==='physical')openSource(active.source);
    else if(state.mounts.size)openSource(physicalSource([...state.mounts.keys()][0],[]));
    else openSource(librarySource(),{nickname:'Library',colour:'#e0a360'});
  });
  document.addEventListener('keydown',(event)=>{
    const active=state.windows.get(state.activeWindowId);if(!active)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'){const filter=active.element?.querySelector('.folder-filter');if(filter){event.preventDefault();filter.focus();}return;}
    if(document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))return;
    const entries=workspace.getSelectedEntries(active);
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();workspace.selectAll(active);}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='c'){event.preventDefault();handleCommand('copy',{windowRecord:active,entries});}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='x'){event.preventDefault();handleCommand('cut',{windowRecord:active,entries});}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='v'){event.preventDefault();handleCommand('paste',{windowRecord:active});}
    if(event.key==='Delete'){event.preventDefault();handleCommand('delete',{windowRecord:active,entries});}
    if(event.key==='F2'){event.preventDefault();handleCommand('rename',{windowRecord:active,entries});}
  });
}

async function boot() {
  installFolderDrop(Workspace, async (handle,targetWindow) => mountService.mountDirectory(handle,{targetWindow,source:'drop'}));
  installTree(Workspace);
  installWorkspaceUi(Workspace);
  workspace = new Workspace({ state,onStateChange:scheduleSave,onLocationOpened:recordRecent,onRequestPermission:reopenPermission,onAddToLibrary:showLibraryDialog,onOpenSource:openSource,onToast:toast,onCommand:handleCommand });
  window.__capsulariusWorkspace = workspace;
  mountService = createMountService({ state,workspace,toast,scheduleSave,openSource,askForLabel:promptMountLabel });
  operations = new OperationManager({ ui:createOperationUi(),onRefresh:()=>workspace.refreshWindows(),onToast:toast });
  installSettings({ state,workspace,toast,save:scheduleSave });
  bindControls();
  try { await restoreState(); }
  catch (error) { console.error(error); toast('Saved Capsularius locations could not be restored.','error'); openSource(librarySource(),{nickname:'Library',colour:'#e0a360'}); }
}

boot();
