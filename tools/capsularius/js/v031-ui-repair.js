import { iconForEntry, extensionOf, queryDirectoryPermission, readDirectory, typeForFile } from './filesystem.js';

const VERSION = 'v0.31.0 — Compact UI & Stable Settings';
const TYPE_KEY = 'organon-capsularius-type-labels-v029';
const BACKUP_KEYS = [
  'organon-capsularius-sidebar-width-v029',
  'organon-capsularius-column-widths-v029',
  'organon-capsularius-type-labels-v029',
  'organon-capsularius-file-metadata-v029',
  'organon-capsularius-mount-location-v1'
];
const EXTENSIONS = ['jpg','jpeg','png','gif','webp','bmp','avif','svg','mp3','wav','ogg','m4a','flac','aac','mid','midi','mp4','webm','mov','mkv','avi','glb','gltf','obj','fbx','stl','dae','zip','txt','md','json','html','htm','css','js','mjs','cjs','ts','tsx','jsx','xml','yaml','yml','csv','py','java','cs','cpp','c','h','php','sql','sh','bat','ps1','pdf','doc','docx','xls','xlsx','ppt','pptx','ttf','otf'];
let currentTab = 'locations';

function e(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function getWorkspace() {
  return window.__capsulariusWorkspace || null;
}

function getJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '');
    return value && typeof value === 'object' ? value : fallback;
  } catch (_) { return fallback; }
}

function setJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* no-op */ }
}

function addStyles() {
  if (document.getElementById('caps-v031-style')) return;
  const style = e('style');
  style.id = 'caps-v031-style';
  style.textContent = `
    .tree-node { display:flex; align-items:center; gap:7px !important; }
    .tree-folder-icon { display:inline-flex !important; align-items:center; justify-content:center; width:20px; margin-right:3px !important; font-size:1.12rem !important; line-height:1; filter:drop-shadow(0 3px 3px rgba(0,0,0,.82)); }
    .tree-label { margin-left:1px !important; }
    .file-item.list.caps-list-row { display:grid !important; min-height:38px !important; height:38px !important; max-height:38px !important; padding:0 10px !important; align-items:center !important; overflow:hidden !important; }
    .file-item.list.caps-list-row .file-item-main { display:flex !important; align-items:center !important; min-height:0 !important; height:38px !important; gap:9px !important; }
    .file-item.list.caps-list-row .file-name-wrap { display:block !important; min-width:0 !important; }
    .file-item.list.caps-list-row .file-name { display:block !important; overflow:hidden !important; white-space:nowrap !important; text-overflow:ellipsis !important; }
    .file-item.list.caps-list-row .file-subtitle { display:none !important; }
    .file-item.list.caps-list-row .file-icon { flex:none !important; font-size:1.15rem !important; line-height:1 !important; }
    .file-item.list.caps-list-row .file-meta,.file-item.list.caps-list-row .caps-list-cell { align-self:center !important; line-height:1.1 !important; }
    .file-item.list.caps-list-row .caps-list-cell { padding:0 !important; }
    .window-actions .icon-button,.toolbar-button,.view-button,.tree-access-state { border:0 !important; background:transparent !important; box-shadow:none !important; filter:drop-shadow(0 3px 4px rgba(0,0,0,.88)); }
    .window-actions .icon-button,.toolbar-button,.view-button { font-size:1.05rem !important; }
    .tree-access-state { padding:0 !important; min-width:20px; color:inherit !important; font-size:1rem !important; }
    .caps-v031-backdrop { position:fixed; inset:0; z-index:11000; display:grid; place-items:center; padding:22px; background:rgba(0,0,0,.7); backdrop-filter:blur(4px); }
    .caps-v031-settings { width:min(880px,calc(100vw - 34px)); max-height:calc(100vh - 34px); overflow:auto; border:1px solid #b58244; border-radius:14px; color:#f4e8d3; background:#20211d; box-shadow:0 28px 90px rgba(0,0,0,.82); }
    .caps-v031-head { position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; gap:14px; padding:15px 20px 0; border-bottom:1px solid rgba(224,163,96,.28); background:#24251f; box-shadow:0 5px 13px rgba(0,0,0,.58); }
    .caps-v031-title { margin:0 0 13px; font:700 1.1rem var(--head); }.caps-v031-close { border:0; background:transparent; color:#f5ead8; cursor:pointer; font-size:1.5rem; filter:drop-shadow(0 2px 3px rgba(0,0,0,.8)); }
    .caps-v031-tabs { display:flex; gap:5px; overflow:auto; }.caps-v031-tab { border:1px solid transparent; border-bottom:0; border-radius:8px 8px 0 0; padding:9px 12px; color:#c9b79e; background:transparent; cursor:pointer; font:700 .72rem var(--body); letter-spacing:.04em; text-transform:uppercase; white-space:nowrap; }.caps-v031-tab.active { border-color:rgba(224,163,96,.5); color:#fff5e3; background:#141511; box-shadow:0 -2px 8px rgba(0,0,0,.38); }
    .caps-v031-body { padding:18px 20px 22px; }.caps-v031-copy { margin:0 0 15px; color:#c7b89f; font-size:.8rem; line-height:1.45; }
    .caps-v031-locations { display:grid; gap:10px; }.caps-v031-location { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; padding:13px; border:1px solid rgba(224,163,96,.25); border-radius:9px; background:rgba(0,0,0,.15); box-shadow:0 3px 10px rgba(0,0,0,.3); }.caps-v031-location h3 { margin:0; font-size:.9rem; }.caps-v031-status { margin:5px 0 0; color:#72d796; font:.68rem var(--mono); }.caps-v031-status.warn { color:#e5a46b; }.caps-v031-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:7px; }.caps-v031-actions button,.caps-v031-footer button,.caps-v031-backup button { border:1px solid rgba(224,163,96,.48); border-radius:6px; padding:7px 10px; color:#f4e5cf; background:#31261d; box-shadow:0 3px 9px rgba(0,0,0,.56); cursor:pointer; font:inherit; font-size:.73rem; }.caps-v031-actions .danger { color:#ffb6a7; border-color:rgba(206,88,74,.58); }.caps-v031-actions .primary,.caps-v031-footer .primary,.caps-v031-backup .primary { color:#17110a; background:#d49b50; font-weight:800; }.caps-v031-footer { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:17px; }.caps-v031-note { color:#ad9d86; font-size:.71rem; }
    .caps-v031-types { display:grid; gap:8px; }.caps-v031-type { display:grid; grid-template-columns:45px 88px minmax(0,1fr); align-items:center; gap:10px; padding:8px 9px; border:1px solid rgba(224,163,96,.18); border-radius:7px; background:rgba(0,0,0,.12); }.caps-v031-type-icon { text-align:center; font-size:1.35rem; filter:drop-shadow(0 2px 3px rgba(0,0,0,.78)); }.caps-v031-type code { color:#dbc8aa; font:.75rem var(--mono); }.caps-v031-type input,.caps-v031-add input { width:100%; box-sizing:border-box; border:1px solid rgba(224,163,96,.36); border-radius:5px; padding:7px 8px; color:#f1e5d4; background:#151612; font:inherit; font-size:.75rem; }.caps-v031-add { display:grid; grid-template-columns:135px minmax(0,1fr) auto; gap:8px; margin-top:12px; }.caps-v031-add button { border:1px solid rgba(224,163,96,.48); border-radius:6px; color:#f4e5cf; background:#31261d; box-shadow:0 3px 9px rgba(0,0,0,.56); cursor:pointer; }
    .caps-v031-backup { display:grid; gap:13px; max-width:560px; }.caps-v031-backup article { padding:14px; border:1px solid rgba(224,163,96,.25); border-radius:9px; background:rgba(0,0,0,.13); }.caps-v031-backup h3 { margin:0 0 7px; font-size:.9rem; }.caps-v031-backup p { margin:0 0 12px; color:#c5b69f; font-size:.78rem; line-height:1.45; }
    @media(max-width:620px){.caps-v031-location{grid-template-columns:1fr}.caps-v031-actions{justify-content:flex-start}.caps-v031-add{grid-template-columns:1fr}.caps-v031-type{grid-template-columns:38px 70px minmax(0,1fr)}}
  `;
  document.head.append(style);
}

function normalizeButtons() {
  const selectors = {
    '[data-action="library"]':'📚',
    '[data-action="colour"]':'🎨',
    '[data-action="minimise"]':'➖',
    '[data-action="close"]':'❌',
    '[data-action="back"]':'⬅️',
    '[data-action="forward"]':'➡️',
    '[data-action="up"]':'⬆️',
    '[data-action="refresh"]':'🔄',
    '[data-command="new-folder"]':'📂',
    '[data-view-mode="grid"]':'🔲',
    '[data-view-mode="list"]':'📄'
  };
  Object.entries(selectors).forEach(([selector, emoji]) => {
    document.querySelectorAll(selector).forEach((button) => {
      if (button.dataset.v031Emoji !== emoji) {
        button.textContent = emoji;
        button.dataset.v031Emoji = emoji;
      }
    });
  });
  document.querySelectorAll('.tree-access-state').forEach((button) => {
    const raw = button.dataset.v031Raw || button.textContent.trim();
    if (!button.dataset.v031Raw) button.dataset.v031Raw = raw;
    if (/reconnect/i.test(raw)) {
      button.textContent = '🔗';
      button.title = 'Reconnect';
      button.setAttribute('aria-label', 'Reconnect');
    }
  });
}

function emojiTree() {
  const map = { '▣':'📚', '◷':'🕘', 'G':'☁️', '▰':'📁' };
  document.querySelectorAll('.tree-folder-icon').forEach((icon) => {
    const raw = icon.dataset.v031Raw || icon.textContent.trim();
    if (!icon.dataset.v031Raw) icon.dataset.v031Raw = raw;
    if (map[raw]) icon.textContent = map[raw];
  });
}

async function checkMount(mount) {
  try {
    mount.permission = await queryDirectoryPermission(mount.handle);
    if (mount.permission !== 'granted') {
      mount.locationHealth = 'permission-required';
      mount.locationDetail = 'Browser permission is needed to reopen this folder.';
      return mount.locationHealth;
    }
    await readDirectory(mount.handle, []);
    mount.locationHealth = 'connected';
    mount.locationDetail = 'Folder opens normally.';
    return mount.locationHealth;
  } catch (error) {
    mount.locationHealth = 'unavailable';
    mount.locationDetail = error?.message || 'The mounted folder could not be opened.';
    return mount.locationHealth;
  }
}

async function relinkMount(ws, mount) {
  try {
    const handle = await window.showDirectoryPicker({ mode:'readwrite' });
    mount.handle = handle;
    mount.name = handle.name || mount.name;
    mount.permission = await queryDirectoryPermission(handle);
    await checkMount(mount);
    for (const record of ws.state.windows.values()) {
      if (record.source.kind === 'physical' && record.source.mountId === mount.id) await ws.loadWindow(record);
      else ws.renderSidebar(record);
    }
    ws.onStateChange();
    return true;
  } catch (error) {
    if (error?.name !== 'AbortError') ws.onToast(error?.message || 'Folder relink failed.', 'error');
    return false;
  }
}

function removeMount(ws, mount) {
  if (!window.confirm(`Remove “${mount.nickname || mount.name}” from Capsularius?\n\nThe actual folder and files will not be deleted.`)) return;
  for (const record of [...ws.state.windows.values()]) {
    if (record.source.kind === 'physical' && record.source.mountId === mount.id) ws.destroyWindow(record);
  }
  ws.state.mounts.delete(mount.id);
  ws.state.library = ws.state.library.filter((item) => item.mountId !== mount.id);
  ws.state.recents = ws.state.recents.filter((item) => item.mountId !== mount.id);
  for (const record of ws.state.windows.values()) ws.renderSidebar(record);
  ws.refreshSpecialWindows?.();
  ws.onStateChange();
}

function extensionEmoji(extension) {
  return iconForEntry({ kind:'file', name:`file.${extension}`, fileType:typeForFile(`file.${extension}`) });
}

function visibleExtensions(ws) {
  const set = new Set(EXTENSIONS);
  Object.keys(getJson(TYPE_KEY, {})).forEach((extension) => set.add(extension));
  for (const record of ws.state.windows.values()) {
    for (const item of record.items || []) {
      const extension = extensionOf(item.name);
      if (extension) set.add(extension);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function downloadSettings() {
  const settings = {};
  BACKUP_KEYS.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) settings[key] = value;
  });
  const blob = new Blob([JSON.stringify({ version:1, exportedAt:new Date().toISOString(), settings }, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `capsularius-settings-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importSettings(file) {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data?.settings || typeof data.settings !== 'object') throw new Error('This is not a Capsularius settings backup.');
      Object.entries(data.settings).forEach(([key, value]) => {
        if (BACKUP_KEYS.includes(key) && typeof value === 'string') localStorage.setItem(key, value);
      });
      window.location.reload();
    } catch (error) {
      window.alert(error?.message || 'The settings backup could not be imported.');
    }
  });
  reader.readAsText(file);
}

function renderLocations(body, ws) {
  body.append(e('p', 'caps-v031-copy', 'Mounted Locations checks whether Capsularius can open the saved browser folder. A folder that opens normally is connected, even though the browser does not reveal its Windows drive path.'));
  const list = e('div', 'caps-v031-locations');
  for (const mount of ws.state.mounts.values()) {
    const card = e('article', 'caps-v031-location');
    const left = e('div');
    left.append(e('h3', '', `📁 ${mount.nickname || mount.name}`));
    const state = mount.locationHealth === 'unavailable' ? 'Unavailable' : mount.locationHealth === 'permission-required' ? 'Reconnect needed' : 'Connected';
    const status = e('p', `caps-v031-status${state === 'Connected' ? '' : ' warn'}`, `${state} — ${mount.locationDetail || (state === 'Connected' ? 'Folder handle is currently available.' : 'Run scan to check this folder.')}`);
    left.append(status);
    const actions = e('div', 'caps-v031-actions');
    const choose = e('button', '', '📂 Relink');
    choose.addEventListener('click', async () => { if (await relinkMount(ws, mount)) renderSettings(); });
    const remove = e('button', 'danger', '🗑️ Remove');
    remove.addEventListener('click', () => { removeMount(ws, mount); renderSettings(); });
    actions.append(choose, remove);
    card.append(left, actions);
    list.append(card);
  }
  if (!ws.state.mounts.size) list.append(e('p', 'caps-v031-copy', 'No local folders are mounted yet.'));
  body.append(list);
  const footer = e('div', 'caps-v031-footer');
  const controls = e('div');
  const add = e('button', 'primary', '📂 Mount Folder');
  add.addEventListener('click', () => { closeSettings(); document.getElementById('mount-folder-button')?.click(); });
  const scan = e('button', '', '🔄 Scan Mounted Locations');
  scan.addEventListener('click', async () => {
    scan.disabled = true; scan.textContent = '⏳ Scanning…';
    for (const mount of ws.state.mounts.values()) await checkMount(mount);
    for (const record of ws.state.windows.values()) ws.renderSidebar(record);
    ws.onStateChange();
    renderSettings();
  });
  controls.append(add, scan);
  footer.append(controls, e('span', 'caps-v031-note', 'Remove only deletes the Capsularius reference.'));
  body.append(footer);
}

function renderTypes(body, ws) {
  body.append(e('p', 'caps-v031-copy', 'Set the exact text shown in the Type column. Each extension also shows the default emoji used when there is no thumbnail.'));
  const labels = getJson(TYPE_KEY, {});
  const list = e('div', 'caps-v031-types');
  visibleExtensions(ws).forEach((extension) => {
    const row = e('label', 'caps-v031-type');
    row.append(e('span', 'caps-v031-type-icon', extensionEmoji(extension)), e('code', '', `.${extension}`));
    const input = document.createElement('input');
    input.value = labels[extension] || '';
    input.placeholder = `Default for .${extension}`;
    input.dataset.extension = extension;
    row.append(input);
    list.append(row);
  });
  body.append(list);
  const add = e('div', 'caps-v031-add');
  const extension = document.createElement('input'); extension.placeholder = 'Extension, e.g. abc';
  const label = document.createElement('input'); label.placeholder = 'Type text';
  const addButton = e('button', '', '＋ Add');
  addButton.addEventListener('click', () => {
    const key = extension.value.trim().replace(/^\./, '').toLowerCase();
    if (!key) return;
    labels[key] = label.value.trim();
    setJson(TYPE_KEY, labels);
    renderSettings();
  });
  add.append(extension, label, addButton);
  body.append(add);
  const footer = e('div', 'caps-v031-footer');
  const save = e('button', 'primary', '💾 Save File Type Labels');
  save.addEventListener('click', () => {
    body.querySelectorAll('[data-extension]').forEach((input) => {
      const value = input.value.trim();
      if (value) labels[input.dataset.extension] = value;
      else delete labels[input.dataset.extension];
    });
    setJson(TYPE_KEY, labels);
    document.querySelectorAll('.caps-list-cell.type').forEach((cell) => {
      if (!cell.dataset.capsV029Default) cell.dataset.capsV029Default = cell.textContent.trim();
      const extension = cell.dataset.capsV029Default.match(/\.([A-Za-z0-9]+)\s*$/)?.[1]?.toLowerCase() || '';
      cell.textContent = labels[extension] || cell.dataset.capsV029Default;
    });
    ws.onToast('File type labels saved.', 'success');
  });
  footer.append(save, e('span', 'caps-v031-note', 'Leave blank to retain the default text.'));
  body.append(footer);
}

function renderBackup(body) {
  body.append(e('p', 'caps-v031-copy', 'Export or import Capsularius’s visual settings, file-type labels, and local metadata. Browser folder permissions are not exported, so imported mounts still need reconnecting.'));
  const backup = e('div', 'caps-v031-backup');
  const exportCard = e('article');
  exportCard.append(e('h3', '', 'Export Settings'), e('p', '', 'Download the current Capsularius settings as a portable JSON file.'));
  const download = e('button', 'primary', '⬇️ Download settings JSON'); download.addEventListener('click', downloadSettings); exportCard.append(download);
  const importCard = e('article');
  importCard.append(e('h3', '', 'Import Settings'), e('p', '', 'Import a previous Capsularius settings JSON. The page reloads after import.'));
  const picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'application/json,.json'; picker.hidden = true;
  const upload = e('button', '', '⬆️ Import settings JSON'); upload.addEventListener('click', () => picker.click()); picker.addEventListener('change', () => { if (picker.files?.[0]) importSettings(picker.files[0]); });
  importCard.append(upload, picker); backup.append(exportCard, importCard); body.append(backup);
}

function renderSettings() {
  const ws = getWorkspace();
  if (!ws) return;
  document.querySelector('.caps-v030-backdrop')?.remove();
  document.querySelector('.caps-v031-backdrop')?.remove();
  const backdrop = e('div', 'caps-v031-backdrop');
  const panel = e('section', 'caps-v031-settings');
  const header = e('header', 'caps-v031-head');
  const left = e('div');
  left.append(e('h2', 'caps-v031-title', 'Capsularius Settings'));
  const tabs = e('nav', 'caps-v031-tabs');
  [['locations','Mounted Locations'],['types','File Types'],['backup','Backup']].forEach(([id, label]) => {
    const tab = e('button', `caps-v031-tab${currentTab === id ? ' active' : ''}`, label);
    tab.type = 'button';
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      currentTab = id;
      renderSettings();
    });
    tabs.append(tab);
  });
  left.append(tabs);
  const close = e('button', 'caps-v031-close', '❌'); close.addEventListener('click', closeSettings);
  header.append(left, close);
  const body = e('main', 'caps-v031-body');
  if (currentTab === 'locations') renderLocations(body, ws);
  if (currentTab === 'types') renderTypes(body, ws);
  if (currentTab === 'backup') renderBackup(body);
  panel.append(header, body); backdrop.append(panel); document.getElementById('dialog-layer').append(backdrop);
}

function closeSettings() {
  document.querySelector('.caps-v030-backdrop')?.remove();
  document.querySelector('.caps-v031-backdrop')?.remove();
}

function setVersion() {
  const badge = document.querySelector('.app-badge');
  if (badge) badge.textContent = VERSION;
}

function refreshUi() {
  normalizeButtons();
  emojiTree();
  setVersion();
}

addStyles();
document.addEventListener('click', (event) => {
  const button = event.target.closest('#capsularius-settings-button');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  renderSettings();
}, true);
new MutationObserver(() => requestAnimationFrame(refreshUi)).observe(document.documentElement, { childList:true, subtree:true });
setTimeout(refreshUi, 80);
