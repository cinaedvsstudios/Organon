import { ArchiveService } from './archive-service.js';
import { installArchiveWorkspace } from './archive-workspace.js';
import { chooseDesktopDirectory, restoreDesktopDirectory } from './desktop-handles.js';
import { makeId, queryDirectoryPermission, requestDirectoryPermission } from './filesystem.js';
import { installFolderDrop } from './folder-drop.js';
import { promptMountLabel } from './mount-dialog.js';
import { createMountService } from './mount-service.js';
import { OperationManager, directoryForSource } from './operations.js';
import { createOperationUi } from './operation-ui.js';
import { persistence } from './persistence.js';
import { chooseFilesystemMode } from './runtime-mode.js';
import { createLibraryEntry, createState, librarySource, makeWindowRecord, physicalSource, sourceKey, sourcePathLabel, sourceTitle, windowSnapshot } from './state.js';
import { installTree } from './tree.js';
import { installWorkspaceUi } from './workspace-ui.js';
import { installSettings } from './settings.js';
import { Workspace } from './workspace.js';

const state = createState();
let workspace;
let operations;
let archives;
let mountService;
let clipboard = null;
let saveTimer = null;
let filesystemMode = 'browser';

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
  const saved = { id:mount.id, name:mount.name, nickname:mount.nickname, colour:mount.colour, createdAt:mount.createdAt, lastOpenedAt:mount.lastOpenedAt, health:mount.health || 'unknown', healthDetail:mount.healthDetail || '' };
  if (mount.nativePath) return { ...saved, nativePath:mount.nativePath };
  return { ...saved, handle:mount.handle };
}

function workspaceSnapshot() {
  return { nextWindowId:state.nextWindowId, activeWindowId:state.activeWindowId, panX:state.workspace.panX, panY:state.workspace.panY, currentColourIndex:state.currentColourIndex, windows:[...state.windows.values()].map(windowSnapshot) };
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
  },300);
}

function openSource(source, options = {}) {
  const record = makeWindowRecord(state,source,options);
  workspace.addWindow(record);
  scheduleSave();
  return record;
}

async function restoreState() {
  const saved = await persistence.load();
  for (const raw of saved.mounts) {
    if (!raw?.id) continue;
    if (raw.nativePath) {
      if (filesystemMode !== 'desktop') continue;
      try {
        const handle = await restoreDesktopDirectory(raw.nativePath);
        state.mounts.set(raw.id,{ ...raw, handle, nativePath:handle.nativePath, permission:'granted', health:'connected', healthDetail:'Desktop folder opens normally.' });
      } catch (_) {
        /* The folder was removed, disconnected, or is no longer available under this Windows account. */
      }
      continue;
    }
    if (!raw.handle) continue;
    let permission = 'denied';
    try { permission = await queryDirectoryPermission(raw.handle); } catch (_) { /* browser no longer recognises the handle */ }
    state.mounts.set(raw.id,{ ...raw, permission, health:permission === 'granted' ? 'connected' : 'permission-required' });
  }
  state.library = saved.library.filter((entry)=>entry?.mountId && Array.isArray(entry.pathSegments));
  state.recents = saved.recents.filter((entry)=>entry?.mountId && Array.isArray(entry.pathSegments)).slice(0,10);
  if (saved.workspace) {
    state.nextWindowId = Math.max(1,Number(saved.workspace.nextWindowId) || 1);
    state.activeWindowId = saved.workspace.activeWindowId || null;
    state.workspace.panX = Number(saved.workspace.panX) || 0;
    state.workspace.panY = Number(saved.workspace.panY) || 0;
    state.currentColourIndex = Math.max(0,Number(saved.workspace.currentColourIndex) || 0);
    workspace.applyWorkspaceTransform();
    for (const snapshot of Array.isArray(saved.workspace.windows) ? saved.workspace.windows : []) {
      if (!snapshot?.source) continue;
      if (snapshot.source.kind === 'physical' && !state.mounts.has(snapshot.source.mountId)) continue;
      const record = makeWindowRecord(state,snapshot.source,snapshot);
      record.id = Number(snapshot.id) || state.nextWindowId++;
      state.nextWindowId = Math.max(state.nextWindowId,record.id + 1);
      workspace.addWindow(record);
    }
  }
  if (!state.windows.size) openSource(librarySource(),{ nickname:'Library', colour:'#e0a360' });
}

async function mountFolder() {
  try {
    if (filesystemMode === 'desktop') {
      const handle = await chooseDesktopDirectory();
      if (handle) await mountService.mountDirectory(handle,{ source:'desktop' });
      return;
    }
    if (!('showDirectoryPicker' in window)) return toast('This browser cannot mount local folders. Open Capsularius in Chrome or Edge.','error');
    await mountService.mountDirectory(await window.showDirectoryPicker({ mode:'readwrite' }),{ source:'picker' });
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error(error);
      toast(filesystemMode === 'desktop' ? 'Capsularius could not mount that Windows folder.' : 'Capsularius could not mount that folder.','error');
    }
  }
}

async function reopenPermission(mountId, windowRecord) {
  const mount = state.mounts.get(mountId);
  if (!mount) return toast('This mounted folder is no longer available.','error');
  try {
    if (filesystemMode === 'desktop' && mount.nativePath) {
      mount.handle = await restoreDesktopDirectory(mount.nativePath);
      mount.permission = 'granted';
    } else {
      mount.permission = await requestDirectoryPermission(mount.handle);
    }
    if (mount.permission !== 'granted') return toast('Folder access was not granted.','error');
    mount.health='connected';mount.healthDetail=filesystemMode === 'desktop' ? 'Desktop folder opens normally.' : 'Folder opens normally.';
    await workspace.loadWindow(windowRecord);
    scheduleSave();
  } catch (error) { console.error(error); toast('Capsularius could not reconnect that folder.','error'); }
}

async function recordRecent(source) {
  if (source.kind !== 'physical') return;
  const mount = state.mounts.get(source.mountId);
  if (!mount) return;
  const key = sourceKey(source);
  const next = { id:makeId('recent'), mountId:source.mountId, pathSegments:[...source.pathSegments], name:sourceTitle(state,source), colour:mount.colour, lastOpenedAt:Date.now(), key };
  state.recents = [next,...state.recents.filter((entry)=>entry.key !== key)].slice(0,10);
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
  dialog.querySelector('[data-library-location]').textContent = sourcePathLabel(state,source);
  name.value=sourceTitle(state,source);emoji.value='📁';colour.value=mount.colour;
  const close = () => dialog.remove();
  dialog.querySelectorAll('[data-library-cancel]').forEach((button)=>button.addEventListener('click',close));
  dialog.querySelector('[data-library-confirm]').addEventListener('click',()=>{
    const key=sourceKey(source);
    const entry=createLibraryEntry(source,{ name:name.value.trim() || sourceTitle(state,source), emoji:emoji.value.trim() || '📁', colour:colour.value || mount.colour });
    const index=state.library.findIndex((item)=>sourceKey(physicalSource(item.mountId,item.pathSegments)) === key);
    if (index === -1) state.library.push(entry);
    else state.library.splice(index,1,{ ...entry, id:state.library[index].id, addedAt:state.library[index].addedAt });
    workspace.refreshSpecialWindows();scheduleSave();close();toast(index === -1 ? `Added ${entry.name} to Library.` : `Updated ${entry.name} in Library.`,'success');
  });
  document.getElementById('dialog-layer').append(dialog);
  setTimeout(()=>name.focus(),0);
}

function hasAccess(record) {
  return record?.source?.kind === 'physical' && state.mounts.get(record.source.mountId)?.permission === 'granted';
}

async function directoryFor(record) {
  return directoryForSource(state,record.source);
}

async function runTransfer(sourceWindow, targetWindow, entries, mode) {
  if (!entries.length) return toast('Select at least one item first.','error');
  if (!hasAccess(targetWindow)) return toast('Open a real destination folder first.','error');
  if (sourceWindow?.source?.kind === 'zip') {
    return operations.copyOrMove({
      mode:'copy', entries,
      sourceDirectory:null,
      targetDirectory:await directoryFor(targetWindow),
      sourceLabel:sourceTitle(state,sourceWindow.source),
      targetLabel:sourceTitle(state,targetWindow.source),
      sourcePathSegments:[],
      targetPathSegments:targetWindow.source.pathSegments,
      sameMount:false
    });
  }
  if (!hasAccess(sourceWindow)) return toast('Reconnect the source folder before changing files.','error');
  return operations.copyOrMove({
    mode, entries,
    sourceDirectory:await directoryFor(sourceWindow),
    targetDirectory:await directoryFor(targetWindow),
    sourceLabel:sourceTitle(state,sourceWindow.source),
    targetLabel:sourceTitle(state,targetWindow.source),
    sourcePathSegments:sourceWindow.source.pathSegments,
    targetPathSegments:targetWindow.source.pathSegments,
    sameMount:sourceWindow.source.mountId === targetWindow.source.mountId
  });
}

async function handleCommand(command, payload) {
  const { windowRecord, entries = [], entry, sourceWindow, targetWindow, mode } = payload;
  if (command === 'refresh') return workspace.loadWindow(windowRecord);
  if (command === 'transfer') return runTransfer(sourceWindow,targetWindow,entries,mode);
  if (command === 'copy' || command === 'cut') {
    const isZip = windowRecord?.source?.kind === 'zip';
    if ((!hasAccess(windowRecord) && !isZip) || !entries.length) return toast('Select real folder items or ZIP contents first.','error');
    if (command === 'cut' && isZip) return toast('ZIP contents can be copied out, but cannot be cut from a read-only archive.','error');
    clipboard = { mode:command === 'cut' ? 'move' : 'copy', entries:[...entries], sourceWindow:windowRecord };
    return toast(`${command === 'cut' ? 'Cut' : 'Copied'} ${entries.length} item${entries.length === 1 ? '' : 's'}. Choose a real destination folder and paste.`);
  }
  if (command === 'paste') {
    if (!clipboard) return toast('Nothing is waiting to be pasted.','error');
    if (!hasAccess(windowRecord)) return toast('Open a real destination folder first.','error');
    const result=await runTransfer(clipboard.sourceWindow,windowRecord,clipboard.entries,clipboard.mode);
    if (clipboard.mode === 'move' && result) clipboard=null;
    return result;
  }
  if (command === 'create-zip') {
    if (!hasAccess(windowRecord) || !entries.length) return toast('Select real folder items to create a ZIP.','error');
    return archives.createZip({ entries, directoryHandle:await directoryFor(windowRecord), label:sourceTitle(state,windowRecord.source) });
  }
  if (command === 'new-folder') {
    if (!hasAccess(windowRecord)) return toast('Open a real folder first.','error');
    return operations.createFolder({ directoryHandle:await directoryFor(windowRecord), label:sourceTitle(state,windowRecord.source) });
  }
  if (command === 'rename') {
    if (!hasAccess(windowRecord) || entries.length !== 1) return toast('Select one real item to rename.','error');
    return operations.rename({ entry:entries[0], parentDirectory:await directoryFor(windowRecord), parentLabel:sourceTitle(state,windowRecord.source) });
  }
  if (command === 'duplicate-file') {
    if (!hasAccess(windowRecord) || entry?.kind !== 'file') return toast('Select one real file to duplicate.','error');
    return operations.duplicate({ entry, parentDirectory:await directoryFor(windowRecord), parentLabel:sourceTitle(state,windowRecord.source) });
  }
  if (command === 'delete-file') {
    if (!hasAccess(windowRecord) || entry?.kind !== 'file') return toast('Select one real file to delete.','error');
    return operations.delete({ entries:[entry], parentDirectory:await directoryFor(windowRecord), parentLabel:sourceTitle(state,windowRecord.source) });
  }
  if (command === 'delete') {
    if (!hasAccess(windowRecord) || !entries.length) return toast('Select real folder items to delete.','error');
    return operations.delete({ entries, parentDirectory:await directoryFor(windowRecord), parentLabel:sourceTitle(state,windowRecord.source) });
  }
  if (command === 'add-to-library' && entry?.kind === 'directory') showLibraryDialog(windowRecord,physicalSource(windowRecord.source.mountId,[...windowRecord.source.pathSegments,entry.name]));
  return false;
}

function bindControls() {
  document.getElementById('mount-folder-button').addEventListener('click',mountFolder);
  document.getElementById('tile-windows-button').addEventListener('click',()=>workspace.tileVisibleWindows());
  document.getElementById('new-window-button').addEventListener('click',()=>{
    const active=state.windows.get(state.activeWindowId);
    if(active?.source?.kind==='physical')openSource(active.source);
    else if(state.mounts.size)openSource(physicalSource([...state.mounts.keys()][0],[]));
    else openSource(librarySource(),{ nickname:'Library', colour:'#e0a360' });
  });
  document.addEventListener('keydown',(event)=>{
    const active=state.windows.get(state.activeWindowId);if(!active)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'){const filter=active.element?.querySelector('.folder-filter');if(filter){event.preventDefault();filter.focus();}return;}
    if(document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))return;
    const entries=workspace.getSelectedEntries(active);
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();workspace.selectAll(active);}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='c'){event.preventDefault();handleCommand('copy',{ windowRecord:active, entries });}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='x'){event.preventDefault();handleCommand('cut',{ windowRecord:active, entries });}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='v'){event.preventDefault();handleCommand('paste',{ windowRecord:active });}
    if(event.key==='Delete'){event.preventDefault();handleCommand('delete',{ windowRecord:active, entries });}
    if(event.key==='F2'){event.preventDefault();handleCommand('rename',{ windowRecord:active, entries });}
  });
}

async function boot() {
  filesystemMode = await chooseFilesystemMode();
  installFolderDrop(Workspace,async(handle,targetWindow)=>{
    if (filesystemMode === 'desktop') return toast('Use Mount to choose a Windows folder in Desktop mode.');
    return mountService.mountDirectory(handle,{ targetWindow, source:'drop' });
  });
  installTree(Workspace);
  installWorkspaceUi(Workspace);
  installArchiveWorkspace(Workspace);
  workspace = new Workspace({ state,onStateChange:scheduleSave,onLocationOpened:recordRecent,onRequestPermission:reopenPermission,onAddToLibrary:showLibraryDialog,onOpenSource:openSource,onToast:toast,onCommand:handleCommand });
  window.__capsulariusWorkspace = workspace;
  mountService = createMountService({ state,workspace,toast,scheduleSave,openSource,askForLabel:promptMountLabel });
  operations = new OperationManager({ ui:createOperationUi(),onRefresh:()=>workspace.refreshWindows(),onToast:toast });
  archives = new ArchiveService({ state,ui:createOperationUi(),onToast:toast,onRefresh:()=>workspace.refreshWindows() });
  workspace.archiveService = archives;
  installSettings({ state,workspace,toast,save:scheduleSave });
  bindControls();
  try { await restoreState(); }
  catch (error) { console.error(error);toast('Saved Capsularius locations could not be restored.','error');openSource(librarySource(),{ nickname:'Library', colour:'#e0a360' }); }
}

boot();
