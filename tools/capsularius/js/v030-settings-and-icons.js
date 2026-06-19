import { Workspace } from './workspace.js';
import { extensionOf, iconForEntry, queryDirectoryPermission, readDirectory, typeForFile } from './filesystem.js';

const TYPE_KEY = 'organon-capsularius-type-labels-v029';
const META_KEYS = ['organon-capsularius-sidebar-width-v029', 'organon-capsularius-column-widths-v029', 'organon-capsularius-type-labels-v029', 'organon-capsularius-file-metadata-v029', 'organon-capsularius-mount-location-v1'];
const VERSION = 'v0.30.0 — Settings & Icon Pass';
const KNOWN_EXTENSIONS = [
  'jpg','jpeg','png','gif','webp','bmp','avif','svg','mp3','wav','ogg','m4a','flac','aac','mid','midi','mp4','webm','mov','mkv','avi','glb','gltf','obj','fbx','stl','dae','zip','txt','md','json','html','htm','css','js','mjs','cjs','ts','tsx','jsx','xml','yaml','yml','csv','py','java','cs','cpp','c','h','php','sql','sh','bat','ps1','pdf','docx','xlsx','pptx','ttf','otf'
];

let activeWorkspace = null;
let settingsState = { tab: 'locations' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '');
    return value && typeof value === 'object' ? value : fallback;
  } catch (_) { return fallback; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* no-op */ }
}

function settingsLayer() {
  return document.getElementById('dialog-layer');
}

function addStyles() {
  if (document.getElementById('caps-v030-style')) return;
  const style = el('style');
  style.id = 'caps-v030-style';
  style.textContent = `
    .app-badge { font-size:0 !important; }
    .app-badge::after { content:'${VERSION}'; font:.68rem var(--mono); letter-spacing:.05em; text-transform:uppercase; }
    .app-header,.window-header,.window-toolbar,.window-footer,.caps-list-header,.window-sidebar { box-shadow:0 4px 12px rgba(0,0,0,.62); }
    .header-button,.action-button,.retry-button,.tree-access-state,.caps-location-actions button,.caps-location-footer button { box-shadow:0 3px 9px rgba(0,0,0,.62); }
    .window-actions .icon-button,.toolbar-button,.view-button { border:0 !important; background:transparent !important; box-shadow:none !important; filter:drop-shadow(0 3px 4px rgba(0,0,0,.86)); font-size:1.05rem; }
    .tree-folder-icon,.file-icon { border:0 !important; background:transparent !important; box-shadow:none !important; filter:drop-shadow(0 3px 4px rgba(0,0,0,.88)); font-size:1.1rem; }
    .file-item.grid .file-icon { border:0 !important; background:transparent !important; box-shadow:none !important; font-size:2.1rem; }
    .item-thumbnail { box-shadow:0 3px 7px rgba(0,0,0,.65); }
    .tree-node.mount-path-unavailable,.tree-node.mount-path-required { opacity:1 !important; filter:none !important; }
    .tree-node.mount-path-unavailable .mount-health,.tree-node.mount-path-required .mount-health { display:none !important; }
    .caps-v030-backdrop { position:fixed; inset:0; z-index:10400; display:grid; place-items:center; padding:20px; background:rgba(0,0,0,.68); backdrop-filter:blur(4px); }
    .caps-v030-settings { width:min(860px,calc(100vw - 32px)); max-height:calc(100vh - 32px); overflow:auto; border:1px solid #ad7b3e; border-radius:14px; color:#f3e7d2; background:#20211d; box-shadow:0 26px 86px rgba(0,0,0,.78); }
    .caps-v030-settings-header { position:sticky; top:0; z-index:2; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:16px 20px 0; border-bottom:1px solid rgba(224,163,96,.26); background:#24251f; box-shadow:0 5px 13px rgba(0,0,0,.56); }
    .caps-v030-title { margin:0 0 14px; color:#f5ecd9; font:700 1.08rem var(--head); }
    .caps-v030-close { margin-bottom:14px; border:0; background:transparent; color:#f5ecd9; cursor:pointer; font-size:1.45rem; filter:drop-shadow(0 2px 3px rgba(0,0,0,.75)); }
    .caps-v030-tabs { display:flex; gap:5px; align-items:end; overflow:auto; }
    .caps-v030-tab { border:1px solid transparent; border-bottom:0; border-radius:8px 8px 0 0; padding:9px 12px; color:#c9baa4; background:transparent; cursor:pointer; font:700 .72rem var(--body); white-space:nowrap; text-transform:uppercase; letter-spacing:.04em; }
    .caps-v030-tab.active { border-color:rgba(224,163,96,.48); color:#fff6e6; background:#141511; box-shadow:0 -2px 8px rgba(0,0,0,.38); }
    .caps-v030-body { padding:18px 20px 22px; }
    .caps-v030-copy { margin:0 0 16px; color:#c7b99f; font-size:.8rem; line-height:1.45; }
    .caps-v030-location-list { display:grid; gap:10px; }
    .caps-v030-location { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:12px; align-items:center; padding:13px; border:1px solid rgba(224,163,96,.25); border-radius:9px; background:rgba(0,0,0,.17); box-shadow:0 3px 10px rgba(0,0,0,.28); }
    .caps-v030-location h3 { margin:0; font-size:.9rem; }.caps-v030-location p { margin:4px 0 0; color:#bfb19b; font:.68rem var(--mono); }.caps-v030-status { color:#6ed18d !important; }.caps-v030-status.reconnect,.caps-v030-status.unavailable { color:#e6a268 !important; }
    .caps-v030-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:7px; }.caps-v030-actions button,.caps-v030-footer button,.caps-v030-backup button { border:1px solid rgba(224,163,96,.45); border-radius:6px; padding:7px 10px; color:#f1e4ce; background:#31261d; cursor:pointer; font:inherit; font-size:.73rem; box-shadow:0 3px 9px rgba(0,0,0,.56); }.caps-v030-actions button.danger { color:#ffb7a7; border-color:rgba(201,88,76,.55); }.caps-v030-actions button.primary,.caps-v030-footer button.primary,.caps-v030-backup button.primary { color:#17110a; background:#d49b50; font-weight:800; }
    .caps-v030-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; }.caps-v030-note { color:#aa9c87; font-size:.72rem; }
    .caps-v030-filetypes { display:grid; gap:8px; }.caps-v030-type-row { display:grid; grid-template-columns:46px 88px minmax(0,1fr); align-items:center; gap:10px; padding:8px 9px; border:1px solid rgba(224,163,96,.18); border-radius:7px; background:rgba(0,0,0,.12); }.caps-v030-type-icon { font-size:1.35rem; filter:drop-shadow(0 2px 3px rgba(0,0,0,.78)); text-align:center; }.caps-v030-type-row code { color:#d9c7a9; font: .75rem var(--mono); }.caps-v030-type-row input { width:100%; box-sizing:border-box; border:1px solid rgba(224,163,96,.35); border-radius:5px; padding:7px 8px; color:#f2e6d5; background:#151612; font:inherit; font-size:.75rem; }.caps-v030-add-type { display:grid; grid-template-columns:130px minmax(0,1fr) auto; gap:8px; margin-top:12px; }.caps-v030-add-type input { width:100%; box-sizing:border-box; border:1px solid rgba(224,163,96,.35); border-radius:5px; padding:8px; color:#f2e6d5; background:#151612; }
    .caps-v030-backup { display:grid; gap:14px; max-width:550px; }.caps-v030-backup article { padding:14px; border:1px solid rgba(224,163,96,.25); border-radius:9px; background:rgba(0,0,0,.13); }.caps-v030-backup h3 { margin:0 0 7px; font-size:.9rem; }.caps-v030-backup p { margin:0 0 12px; color:#c3b59f; font-size:.78rem; line-height:1.45; }
    @media(max-width:620px) { .caps-v030-location { grid-template-columns:1fr; }.caps-v030-actions { justify-content:flex-start; }.caps-v030-add-type { grid-template-columns:1fr; }.caps-v030-type-row { grid-template-columns:40px 70px minmax(0,1fr); } }
  `;
  document.head.append(style);
}

function applyEmojiIcons() {
  const map = { '▣':'📚', '◷':'🕘', 'G':'☁️', '▰':'📁' };
  document.querySelectorAll('.tree-folder-icon').forEach((icon) => {
    const raw = icon.dataset.capsV030Raw || icon.textContent.trim();
    if (!icon.dataset.capsV030Raw) icon.dataset.capsV030Raw = raw;
    if (map[raw]) icon.textContent = map[raw];
  });
  document.querySelectorAll('[data-command="new-folder"]').forEach((button) => { button.textContent = '📂'; button.title = 'New folder'; });
}

function observeWorkspace() {
  const original = Workspace.prototype.renderSidebar;
  if (Workspace.prototype.__capsulariusV030WorkspaceObserver) return;
  Object.defineProperty(Workspace.prototype, '__capsulariusV030WorkspaceObserver', { value: true });
  Workspace.prototype.renderSidebar = function v030RememberWorkspace(...args) {
    activeWorkspace = this;
    window.__capsulariusWorkspace = this;
    const result = original.apply(this, args);
    requestAnimationFrame(applyEmojiIcons);
    return result;
  };
}

function workspace() {
  return activeWorkspace || window.__capsulariusWorkspace || null;
}

async function scanMount(mount) {
  try {
    mount.permission = await queryDirectoryPermission(mount.handle);
    if (mount.permission !== 'granted') {
      mount.locationHealth = 'permission-required';
      mount.locationDetail = 'Browser permission is needed to reopen this folder.';
      return mount.locationHealth;
    }
    await readDirectory(mount.handle, []);
    mount.locationHealth = 'connected';
    mount.locationDetail = 'Folder handle opens normally.';
    return mount.locationHealth;
  } catch (error) {
    mount.locationHealth = 'unavailable';
    mount.locationDetail = error?.message || 'The mounted folder could not be opened.';
    return mount.locationHealth;
  }
}

async function scanAll(workspaceInstance) {
  for (const mount of workspaceInstance.state.mounts.values()) await scanMount(mount);
  for (const record of workspaceInstance.state.windows.values()) workspaceInstance.renderSidebar(record);
  workspaceInstance.onStateChange();
}

async function relinkMount(workspaceInstance, mount) {
  if (!('showDirectoryPicker' in window)) {
    workspaceInstance.onToast('This browser cannot open a folder picker. Use Chrome or Edge.', 'error');
    return false;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    mount.handle = handle;
    mount.name = handle.name || mount.name;
    mount.permission = await queryDirectoryPermission(handle);
    await scanMount(mount);
    for (const record of workspaceInstance.state.windows.values()) {
      if (record.source.kind === 'physical' && record.source.mountId === mount.id) await workspaceInstance.loadWindow(record);
      else workspaceInstance.renderSidebar(record);
    }
    workspaceInstance.onStateChange();
    workspaceInstance.onToast(`${mount.nickname || mount.name} was relinked.`, 'success');
    return true;
  } catch (error) {
    if (error?.name !== 'AbortError') workspaceInstance.onToast(error?.message || 'Folder relink failed.', 'error');
    return false;
  }
}

function removeMount(workspaceInstance, mount) {
  if (!window.confirm(`Remove “${mount.nickname || mount.name}” from Capsularius?\n\nThis does not delete the actual folder or files.`)) return;
  for (const record of [...workspaceInstance.state.windows.values()]) {
    if (record.source.kind === 'physical' && record.source.mountId === mount.id) workspaceInstance.destroyWindow(record);
  }
  workspaceInstance.state.mounts.delete(mount.id);
  workspaceInstance.state.library = workspaceInstance.state.library.filter((entry) => entry.mountId !== mount.id);
  workspaceInstance.state.recents = workspaceInstance.state.recents.filter((entry) => entry.mountId !== mount.id);
  for (const record of workspaceInstance.state.windows.values()) workspaceInstance.renderSidebar(record);
  workspaceInstance.refreshSpecialWindows?.();
  workspaceInstance.onStateChange();
}

function mountNew() {
  closeSettings();
  document.getElementById('mount-folder-button')?.click();
}

function fileTypeEmoji(extension) {
  const entry = { kind:'file', name:`sample.${extension}`, fileType:typeForFile(`sample.${extension}`) };
  return iconForEntry(entry);
}

function extensionsInWorkspace(workspaceInstance) {
  const extensions = new Set(KNOWN_EXTENSIONS);
  Object.keys(readJson(TYPE_KEY, {})).forEach((extension) => extensions.add(extension));
  for (const record of workspaceInstance.state.windows.values()) {
    for (const entry of record.items || []) {
      const extension = extensionOf(entry.name);
      if (extension) extensions.add(extension);
    }
  }
  return [...extensions].sort((first, second) => first.localeCompare(second));
}

function applyTypeLabels() {
  const labels = readJson(TYPE_KEY, {});
  document.querySelectorAll('.caps-list-cell.type').forEach((cell) => {
    if (!cell.dataset.capsV029Default) cell.dataset.capsV029Default = cell.textContent.trim();
    const extension = cell.dataset.capsV029Default.match(/\.([A-Za-z0-9]+)\s*$/)?.[1]?.toLowerCase() || '';
    cell.textContent = labels[extension] || cell.dataset.capsV029Default;
  });
}

function backupData() {
  const data = { version: 1, exportedAt: new Date().toISOString(), settings: {} };
  for (const key of META_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) data.settings[key] = value;
  }
  return data;
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify(backupData(), null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `capsularius-settings-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed?.settings || typeof parsed.settings !== 'object') throw new Error('This is not a Capsularius settings backup.');
      for (const [key, value] of Object.entries(parsed.settings)) {
        if (META_KEYS.includes(key) && typeof value === 'string') localStorage.setItem(key, value);
      }
      window.location.reload();
    } catch (error) {
      window.alert(error?.message || 'The settings backup could not be imported.');
    }
  });
  reader.readAsText(file);
}

function renderLocations(content, workspaceInstance) {
  content.append(el('p', 'caps-v030-copy', 'Mounted Locations checks whether Capsularius can open each saved browser folder. A location that opens normally is connected; Windows path visibility is not used as a failure state.'));
  const list = el('div', 'caps-v030-location-list');
  for (const mount of workspaceInstance.state.mounts.values()) {
    const card = el('article', 'caps-v030-location');
    const info = el('div');
    info.append(el('h3', '', mount.nickname || mount.name));
    const status = mount.locationHealth === 'unavailable' ? 'Unavailable' : mount.locationHealth === 'permission-required' ? 'Reconnect needed' : 'Connected';
    const detail = mount.locationDetail || (mount.permission === 'granted' ? 'Folder handle is currently available.' : 'Run Scan Mounted Locations to check this folder.');
    const statusLine = el('p', `caps-v030-status ${status === 'Connected' ? '' : 'reconnect'}`, `${status} — ${detail}`);
    info.append(statusLine);
    const actions = el('div', 'caps-v030-actions');
    const choose = el('button', '', 'Choose / relink folder');
    choose.addEventListener('click', async () => { if (await relinkMount(workspaceInstance, mount)) renderSettings(); });
    const remove = el('button', 'danger', 'Remove');
    remove.addEventListener('click', () => { removeMount(workspaceInstance, mount); renderSettings(); });
    actions.append(choose, remove);
    card.append(info, actions);
    list.append(card);
  }
  if (workspaceInstance.state.mounts.size === 0) list.append(el('p', 'caps-v030-copy', 'No local folders are mounted yet.'));
  content.append(list);
  const footer = el('div', 'caps-v030-footer');
  const add = el('button', 'primary', '＋ Mount folder');
  add.addEventListener('click', mountNew);
  const scan = el('button', '', 'Scan Mounted Locations');
  scan.addEventListener('click', async () => { scan.disabled = true; scan.textContent = 'Scanning…'; await scanAll(workspaceInstance); renderSettings(); });
  const actions = el('div'); actions.append(add, scan);
  footer.append(actions, el('span', 'caps-v030-note', 'Removing a location removes only its Capsularius reference, never the actual folder.'));
  content.append(footer);
}

function renderFileTypes(content, workspaceInstance) {
  content.append(el('p', 'caps-v030-copy', 'Every known and currently visible extension is listed here. Set the exact text you want in the Type column and see the default emoji used when no thumbnail is available.'));
  const labels = readJson(TYPE_KEY, {});
  const list = el('div', 'caps-v030-filetypes');
  for (const extension of extensionsInWorkspace(workspaceInstance)) {
    const row = el('label', 'caps-v030-type-row');
    row.append(el('span', 'caps-v030-type-icon', fileTypeEmoji(extension)), el('code', '', `.${extension}`));
    const input = document.createElement('input');
    input.value = labels[extension] || '';
    input.placeholder = `Default for .${extension}`;
    input.dataset.extension = extension;
    row.append(input);
    list.append(row);
  }
  content.append(list);
  const add = el('div', 'caps-v030-add-type');
  const extension = document.createElement('input'); extension.placeholder = 'Extension, e.g. abc';
  const label = document.createElement('input'); label.placeholder = 'Type text, e.g. Asset · .abc';
  const addButton = el('button', '', 'Add');
  addButton.addEventListener('click', () => {
    const key = extension.value.trim().replace(/^\./, '').toLowerCase();
    if (!key) return;
    labels[key] = label.value.trim();
    writeJson(TYPE_KEY, labels);
    renderSettings();
  });
  add.append(extension, label, addButton);
  content.append(add);
  const footer = el('div', 'caps-v030-footer');
  const save = el('button', 'primary', 'Save File Type Labels');
  save.addEventListener('click', () => {
    content.querySelectorAll('[data-extension]').forEach((input) => {
      const value = input.value.trim();
      if (value) labels[input.dataset.extension] = value;
      else delete labels[input.dataset.extension];
    });
    writeJson(TYPE_KEY, labels);
    applyTypeLabels();
    workspaceInstance.onToast('File type labels saved.', 'success');
  });
  footer.append(save, el('span', 'caps-v030-note', 'Leave a field empty to keep Capsularius’s default type text.'));
  content.append(footer);
}

function renderBackup(content) {
  content.append(el('p', 'caps-v030-copy', 'Export a portable JSON copy of Capsularius’s local layout, file-type labels, metadata, and mount-health settings. Browser permission handles are deliberately not included, so imported mounts will still need to be selected or reconnected.'));
  const area = el('div', 'caps-v030-backup');
  const exportCard = el('article'); exportCard.append(el('h3', '', 'Export Settings'), el('p', '', 'Download the current Capsularius settings as a JSON file.'));
  const download = el('button', 'primary', 'Download settings JSON'); download.addEventListener('click', downloadBackup); exportCard.append(download);
  const importCard = el('article'); importCard.append(el('h3', '', 'Import Settings'), el('p', '', 'Import a previously downloaded Capsularius settings JSON. The page reloads after a valid import.'));
  const picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'application/json,.json'; picker.hidden = true;
  const choose = el('button', '', 'Import settings JSON'); choose.addEventListener('click', () => picker.click()); picker.addEventListener('change', () => { if (picker.files?.[0]) importBackup(picker.files[0]); }); importCard.append(choose, picker);
  area.append(exportCard, importCard); content.append(area);
}

function renderSettings() {
  const workspaceInstance = workspace();
  if (!workspaceInstance) return;
  document.querySelector('.caps-v030-backdrop')?.remove();
  const backdrop = el('div', 'caps-v030-backdrop');
  const panel = el('section', 'caps-v030-settings');
  const header = el('header', 'caps-v030-settings-header');
  const left = el('div');
  left.append(el('h2', 'caps-v030-title', 'Capsularius Settings'));
  const tabs = el('nav', 'caps-v030-tabs');
  const tabLabels = [['locations','Mounted Locations'],['types','File Types'],['backup','Backup']];
  for (const [key, label] of tabLabels) {
    const tab = el('button', `caps-v030-tab${settingsState.tab === key ? ' active' : ''}`, label);
    tab.type = 'button';
    tab.addEventListener('click', () => { settingsState.tab = key; renderSettings(); });
    tabs.append(tab);
  }
  left.append(tabs);
  const close = el('button', 'caps-v030-close', '×'); close.addEventListener('click', closeSettings);
  header.append(left, close);
  const content = el('main', 'caps-v030-body');
  if (settingsState.tab === 'locations') renderLocations(content, workspaceInstance);
  if (settingsState.tab === 'types') renderFileTypes(content, workspaceInstance);
  if (settingsState.tab === 'backup') renderBackup(content);
  panel.append(header, content); backdrop.append(panel); settingsLayer().append(backdrop);
}

function closeSettings() {
  document.querySelector('.caps-v030-backdrop')?.remove();
}

function installSettingsInterception() {
  document.addEventListener('click', (event) => {
    const settingsButton = event.target.closest('#capsularius-settings-button');
    if (!settingsButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    renderSettings();
  }, true);
}

addStyles();
observeWorkspace();
installSettingsInterception();
new MutationObserver(() => requestAnimationFrame(applyEmojiIcons)).observe(document.documentElement, { childList:true, subtree:true });
setTimeout(applyEmojiIcons, 100);
