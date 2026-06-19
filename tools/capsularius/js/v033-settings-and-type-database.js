import { extensionOf, iconForEntry, typeForFile } from './filesystem.js';

const VERSION = 'v0.33.0 — Settings & Type Database';
const TYPE_LABEL_KEY = 'organon-capsularius-type-labels-v033';
const BACKUP_KEYS = [
  'organon-capsularius-sidebar-width-v029',
  'organon-capsularius-column-widths-v029',
  'organon-capsularius-type-labels-v029',
  'organon-capsularius-type-labels-v033',
  'organon-capsularius-file-metadata-v029',
  'organon-capsularius-mount-location-v1'
];

const TYPE_DATABASE = {
  // Images
  jpg:['🖼️','JPEG Image · .jpg'], jpeg:['🖼️','JPEG Image · .jpeg'], png:['🖼️','PNG Image · .png'], gif:['🖼️','GIF Image · .gif'], webp:['🖼️','WebP Image · .webp'], bmp:['🖼️','Bitmap Image · .bmp'], avif:['🖼️','AVIF Image · .avif'], svg:['🖼️','SVG Vector · .svg'], tif:['🖼️','TIFF Image · .tif'], tiff:['🖼️','TIFF Image · .tiff'], ico:['🖼️','Icon Image · .ico'], heic:['🖼️','HEIC Image · .heic'],
  // Audio and music
  mp3:['🎵','MP3 Audio · .mp3'], wav:['🎵','WAV Audio · .wav'], ogg:['🎵','Ogg Audio · .ogg'], m4a:['🎵','M4A Audio · .m4a'], flac:['🎵','FLAC Audio · .flac'], aac:['🎵','AAC Audio · .aac'], wma:['🎵','WMA Audio · .wma'], aiff:['🎵','AIFF Audio · .aiff'], mid:['🎼','MIDI File · .mid'], midi:['🎼','MIDI File · .midi'],
  // Video
  mp4:['🎥','MP4 Video · .mp4'], webm:['🎥','WebM Video · .webm'], mov:['🎥','QuickTime Video · .mov'], mkv:['🎥','Matroska Video · .mkv'], avi:['🎥','AVI Video · .avi'], mpeg:['🎥','MPEG Video · .mpeg'], mpg:['🎥','MPEG Video · .mpg'], m4v:['🎥','M4V Video · .m4v'],
  // 3D and games
  glb:['📐','3D Model · .glb'], gltf:['📐','3D Model · .gltf'], obj:['📐','3D Model · .obj'], fbx:['📐','3D Model · .fbx'], stl:['📐','3D Model · .stl'], dae:['📐','3D Model · .dae'], blend:['🎲','Blender File · .blend'], unitypackage:['🎮','Unity Package · .unitypackage'], unity:['🎮','Unity Asset · .unity'], uni:['🎮','Data File · .uni'], uasset:['🎮','Unreal Asset · .uasset'], umap:['🎮','Unreal Map · .umap'], pak:['🎮','Game Package · .pak'],
  // Documents
  pdf:['📕','PDF Document · .pdf'], doc:['📘','Word Document · .doc'], docx:['📘','Word Document · .docx'], odt:['📘','OpenDocument Text · .odt'], rtf:['📘','Rich Text Document · .rtf'], xls:['📊','Excel Workbook · .xls'], xlsx:['📊','Excel Workbook · .xlsx'], ods:['📊','OpenDocument Spreadsheet · .ods'], csv:['📊','CSV Data · .csv'], tsv:['📊','TSV Data · .tsv'], ppt:['📙','PowerPoint Presentation · .ppt'], pptx:['📙','PowerPoint Presentation · .pptx'], odp:['📙','OpenDocument Presentation · .odp'],
  // Fonts
  ttf:['🔤','TrueType Font · .ttf'], otf:['🔤','OpenType Font · .otf'], woff:['🔤','Web Font · .woff'], woff2:['🔤','Web Font · .woff2'],
  // Archives / installers
  zip:['📦','ZIP Archive · .zip'], rar:['📦','RAR Archive · .rar'], '7z':['📦','7-Zip Archive · .7z'], tar:['📦','TAR Archive · .tar'], gz:['📦','GZip Archive · .gz'], bz2:['📦','BZip2 Archive · .bz2'], iso:['💿','Disc Image · .iso'], exe:['⚙️','Windows Application · .exe'], msi:['⚙️','Windows Installer · .msi'], apk:['⚙️','Android Package · .apk'],
  // Text, web and code
  txt:['📄','Text File · .txt'], md:['📝','Markdown Document · .md'], log:['📄','Log File · .log'], json:['⚙️','JSON Data · .json'], xml:['⚙️','XML Data · .xml'], yaml:['⚙️','YAML Data · .yaml'], yml:['⚙️','YAML Data · .yml'], ini:['⚙️','Configuration · .ini'], cfg:['⚙️','Configuration · .cfg'], conf:['⚙️','Configuration · .conf'], html:['🌐','HTML Document · .html'], htm:['🌐','HTML Document · .htm'], css:['🎨','Stylesheet · .css'], js:['⚙️','JavaScript · .js'], mjs:['⚙️','JavaScript Module · .mjs'], cjs:['⚙️','CommonJS Module · .cjs'], ts:['⚙️','TypeScript · .ts'], tsx:['⚙️','TypeScript React · .tsx'], jsx:['⚙️','JavaScript React · .jsx'], py:['🐍','Python Script · .py'], java:['☕','Java Source · .java'], cs:['⚙️','C# Source · .cs'], cpp:['⚙️','C++ Source · .cpp'], c:['⚙️','C Source · .c'], h:['⚙️','Header File · .h'], php:['⚙️','PHP Script · .php'], sql:['🗄️','SQL Script · .sql'], sh:['⚙️','Shell Script · .sh'], bat:['⚙️','Batch Script · .bat'], ps1:['⚙️','PowerShell Script · .ps1'],
  // Design and data
  psd:['🎨','Photoshop File · .psd'], ai:['🎨','Illustrator File · .ai'], aseprite:['🎨','Aseprite File · .aseprite'], kra:['🎨','Krita File · .kra'], xcf:['🎨','GIMP File · .xcf'], db:['🗄️','Database File · .db'], sqlite:['🗄️','SQLite Database · .sqlite'], vdb:['🌊','Volume Data · .vdb'], bin:['📄','Binary Data · .bin'], dat:['📄','Data File · .dat']
};

let tab = 'locations';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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

function getWorkspace() {
  return window.__capsulariusWorkspace || null;
}

function typeOverrideMap() {
  return getJson(TYPE_LABEL_KEY, {});
}

function typeDescriptor(filename) {
  const extension = extensionOf(filename);
  const override = String(typeOverrideMap()[extension] || '').trim();
  if (override) return { extension, icon: TYPE_DATABASE[extension]?.[0] || iconForEntry({ kind:'file', name:filename, fileType:typeForFile(filename) }), label: override };
  if (TYPE_DATABASE[extension]) return { extension, icon: TYPE_DATABASE[extension][0], label: TYPE_DATABASE[extension][1] };
  const fallbackIcon = iconForEntry({ kind:'file', name:filename, fileType:typeForFile(filename) });
  return { extension, icon: fallbackIcon, label: extension ? `File · .${extension}` : 'File' };
}

function addStyles() {
  if (document.getElementById('caps-v033-style')) return;
  const style = el('style');
  style.id = 'caps-v033-style';
  style.textContent = `
    .tree-node { gap:8px !important; }.tree-folder-icon { margin-right:4px !important; }
    .tree-node.mount-path-unavailable,.tree-node.mount-path-required { opacity:1 !important; filter:none !important; }.tree-node.mount-path-unavailable .mount-health,.tree-node.mount-path-required .mount-health { display:none !important; }
    .caps-v033-backdrop{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:22px;background:rgba(0,0,0,.72);backdrop-filter:blur(4px)}
    .caps-v033-settings{width:min(900px,calc(100vw - 34px));max-height:calc(100vh - 34px);overflow:auto;border:1px solid #b58244;border-radius:14px;color:#f4e8d3;background:#20211d;box-shadow:0 28px 92px rgba(0,0,0,.84)}
    .caps-v033-head{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;gap:14px;padding:15px 20px 0;border-bottom:1px solid rgba(224,163,96,.28);background:#24251f;box-shadow:0 5px 13px rgba(0,0,0,.58)}.caps-v033-title{margin:0 0 13px;font:700 1.1rem var(--head)}.caps-v033-close{border:0;background:transparent;color:#f6ebd9;cursor:pointer;font-size:1.45rem;filter:drop-shadow(0 2px 3px rgba(0,0,0,.8))}
    .caps-v033-tabs{display:flex;gap:5px;overflow:auto}.caps-v033-tab{border:1px solid transparent;border-bottom:0;border-radius:8px 8px 0 0;padding:9px 12px;color:#c9b79e;background:transparent;cursor:pointer;font:700 .72rem var(--body);letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}.caps-v033-tab.active{border-color:rgba(224,163,96,.5);color:#fff5e3;background:#141511;box-shadow:0 -2px 8px rgba(0,0,0,.38)}
    .caps-v033-body{padding:18px 20px 22px}.caps-v033-copy{margin:0 0 15px;color:#c7b89f;font-size:.8rem;line-height:1.45}.caps-v033-locations{display:grid;gap:10px}.caps-v033-location{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px;border:1px solid rgba(224,163,96,.25);border-radius:9px;background:rgba(0,0,0,.15);box-shadow:0 3px 10px rgba(0,0,0,.3)}.caps-v033-location h3{margin:0;font-size:.9rem}.caps-v033-status{margin:5px 0 0;color:#72d796;font:.68rem var(--mono)}.caps-v033-status.warn{color:#e5a46b}.caps-v033-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}.caps-v033-actions button,.caps-v033-footer button,.caps-v033-backup button,.caps-v033-add button{border:1px solid rgba(224,163,96,.48);border-radius:6px;padding:7px 10px;color:#f4e5cf;background:#31261d;box-shadow:0 3px 9px rgba(0,0,0,.56);cursor:pointer;font:inherit;font-size:.73rem}.caps-v033-actions .danger{color:#ffb6a7;border-color:rgba(206,88,74,.58)}.caps-v033-actions .primary,.caps-v033-footer .primary,.caps-v033-backup .primary{color:#17110a;background:#d49b50;font-weight:800}.caps-v033-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:17px}.caps-v033-note{color:#ad9d86;font-size:.71rem}
    .caps-v033-types{display:grid;gap:8px}.caps-v033-type{display:grid;grid-template-columns:45px 88px minmax(0,1fr);align-items:center;gap:10px;padding:8px 9px;border:1px solid rgba(224,163,96,.18);border-radius:7px;background:rgba(0,0,0,.12)}.caps-v033-type-icon{text-align:center;font-size:1.35rem;filter:drop-shadow(0 2px 3px rgba(0,0,0,.78))}.caps-v033-type code{color:#dbc8aa;font:.75rem var(--mono)}.caps-v033-type input,.caps-v033-add input{width:100%;box-sizing:border-box;border:1px solid rgba(224,163,96,.36);border-radius:5px;padding:7px 8px;color:#f1e5d4;background:#151612;font:inherit;font-size:.75rem}.caps-v033-add{display:grid;grid-template-columns:135px minmax(0,1fr) auto;gap:8px;margin-top:12px}.caps-v033-backup{display:grid;gap:13px;max-width:560px}.caps-v033-backup article{padding:14px;border:1px solid rgba(224,163,96,.25);border-radius:9px;background:rgba(0,0,0,.13)}.caps-v033-backup h3{margin:0 0 7px;font-size:.9rem}.caps-v033-backup p{margin:0 0 12px;color:#c5b69f;font-size:.78rem;line-height:1.45}
    @media(max-width:620px){.caps-v033-location{grid-template-columns:1fr}.caps-v033-actions{justify-content:flex-start}.caps-v033-add{grid-template-columns:1fr}.caps-v033-type{grid-template-columns:38px 70px minmax(0,1fr)}}
  `;
  document.head.append(style);
}

function fillTypeCells() {
  document.querySelectorAll('.file-item.list.caps-list-row').forEach((row) => {
    const name = row.querySelector('.file-name')?.textContent?.trim() || '';
    if (!name) return;
    let cell = row.querySelector('.caps-list-cell.type');
    if (!cell) {
      cell = el('span', 'caps-list-cell type');
      row.append(cell);
    }
    const descriptor = typeDescriptor(name);
    if (cell.textContent.trim() !== descriptor.label) cell.textContent = descriptor.label;
    const icon = row.querySelector('.file-icon');
    if (icon && !icon.querySelector('img') && icon.textContent.trim() !== descriptor.icon) icon.textContent = descriptor.icon;
  });
}

function closeSettings() {
  document.querySelector('.caps-v030-backdrop')?.remove();
  document.querySelector('.caps-v031-backdrop')?.remove();
  document.querySelector('.caps-v033-backdrop')?.remove();
}

function currentExtensions(workspace) {
  const values = new Set(Object.keys(TYPE_DATABASE));
  Object.keys(typeOverrideMap()).forEach((extension) => values.add(extension));
  for (const record of workspace.state.windows.values()) {
    for (const item of record.items || []) {
      const extension = extensionOf(item.name);
      if (extension) values.add(extension);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function renderLocations(body, workspace) {
  body.append(el('p', 'caps-v033-copy', 'Mounted Locations checks whether Capsularius can open each saved browser folder. A folder that opens normally is connected; missing Windows path visibility is not treated as a problem.'));
  const list = el('div', 'caps-v033-locations');
  for (const mount of workspace.state.mounts.values()) {
    const card = el('article', 'caps-v033-location');
    const left = el('div');
    left.append(el('h3', '', `📁 ${mount.nickname || mount.name}`));
    const state = mount.locationHealth === 'unavailable' ? 'Unavailable' : mount.locationHealth === 'permission-required' ? 'Reconnect needed' : 'Connected';
    left.append(el('p', `caps-v033-status${state === 'Connected' ? '' : ' warn'}`, `${state} — ${mount.locationDetail || (state === 'Connected' ? 'Folder handle is currently available.' : 'Run scan to check this folder.')}`));
    const actions = el('div', 'caps-v033-actions');
    const relink = el('button', '', '📂 Relink');
    relink.addEventListener('click', async () => {
      try {
        const handle = await window.showDirectoryPicker({ mode:'readwrite' });
        mount.handle = handle;
        mount.name = handle.name || mount.name;
        mount.permission = await mount.handle.queryPermission({ mode:'readwrite' });
        mount.locationHealth = mount.permission === 'granted' ? 'connected' : 'permission-required';
        mount.locationDetail = mount.permission === 'granted' ? 'Folder opens normally.' : 'Browser permission is needed to reopen this folder.';
        for (const record of workspace.state.windows.values()) workspace.renderSidebar(record);
        workspace.onStateChange();
        renderSettings();
      } catch (error) {
        if (error?.name !== 'AbortError') workspace.onToast(error?.message || 'Folder relink failed.', 'error');
      }
    });
    const remove = el('button', 'danger', '🗑️ Remove');
    remove.addEventListener('click', () => {
      if (!window.confirm(`Remove “${mount.nickname || mount.name}” from Capsularius?\n\nThe real folder and files will not be deleted.`)) return;
      workspace.state.mounts.delete(mount.id);
      workspace.state.library = workspace.state.library.filter((item) => item.mountId !== mount.id);
      workspace.state.recents = workspace.state.recents.filter((item) => item.mountId !== mount.id);
      for (const record of workspace.state.windows.values()) workspace.renderSidebar(record);
      workspace.refreshSpecialWindows?.();
      workspace.onStateChange();
      renderSettings();
    });
    actions.append(relink, remove);
    card.append(left, actions);
    list.append(card);
  }
  body.append(list);
  const footer = el('div', 'caps-v033-footer');
  const controls = el('div');
  const mount = el('button', 'primary', '📂 Mount Folder');
  mount.addEventListener('click', () => { closeSettings(); document.getElementById('mount-folder-button')?.click(); });
  const scan = el('button', '', '🔄 Scan Mounted Locations');
  scan.addEventListener('click', async () => {
    scan.disabled = true; scan.textContent = '⏳ Scanning…';
    for (const item of workspace.state.mounts.values()) {
      try {
        item.permission = await item.handle.queryPermission({ mode:'readwrite' });
        if (item.permission === 'granted') { await item.handle.values().next(); item.locationHealth = 'connected'; item.locationDetail = 'Folder opens normally.'; }
        else { item.locationHealth = 'permission-required'; item.locationDetail = 'Browser permission is needed to reopen this folder.'; }
      } catch (error) { item.locationHealth = 'unavailable'; item.locationDetail = error?.message || 'The mounted folder could not be opened.'; }
    }
    for (const record of workspace.state.windows.values()) workspace.renderSidebar(record);
    workspace.onStateChange();
    renderSettings();
  });
  controls.append(mount, scan);
  footer.append(controls, el('span', 'caps-v033-note', 'Remove deletes only the Capsularius reference.'));
  body.append(footer);
}

function renderTypes(body, workspace) {
  body.append(el('p', 'caps-v033-copy', 'Capsularius now includes a populated default type database. Edit any label below to override the default Type-column text.'));
  const overrides = typeOverrideMap();
  const list = el('div', 'caps-v033-types');
  currentExtensions(workspace).forEach((extension) => {
    const descriptor = typeDescriptor(`sample.${extension}`);
    const row = el('label', 'caps-v033-type');
    row.append(el('span', 'caps-v033-type-icon', descriptor.icon), el('code', '', `.${extension}`));
    const input = document.createElement('input');
    input.value = overrides[extension] || '';
    input.placeholder = descriptor.label;
    input.dataset.extension = extension;
    row.append(input);
    list.append(row);
  });
  body.append(list);
  const add = el('div', 'caps-v033-add');
  const extension = document.createElement('input'); extension.placeholder = 'Extension, e.g. abc';
  const label = document.createElement('input'); label.placeholder = 'Type label';
  const addButton = el('button', '', '＋ Add');
  addButton.addEventListener('click', () => {
    const key = extension.value.trim().replace(/^\./, '').toLowerCase();
    if (!key) return;
    overrides[key] = label.value.trim() || `File · .${key}`;
    setJson(TYPE_LABEL_KEY, overrides);
    renderSettings();
  });
  add.append(extension, label, addButton);
  body.append(add);
  const footer = el('div', 'caps-v033-footer');
  const save = el('button', 'primary', '💾 Save File Type Labels');
  save.addEventListener('click', () => {
    body.querySelectorAll('[data-extension]').forEach((input) => {
      const value = input.value.trim();
      if (value) overrides[input.dataset.extension] = value;
      else delete overrides[input.dataset.extension];
    });
    setJson(TYPE_LABEL_KEY, overrides);
    fillTypeCells();
    workspace.onToast('File type labels saved.', 'success');
  });
  footer.append(save, el('span', 'caps-v033-note', 'Leave empty to use the built-in default database label.'));
  body.append(footer);
}

function downloadBackup() {
  const settings = {};
  BACKUP_KEYS.forEach((key) => { const value = localStorage.getItem(key); if (value !== null) settings[key] = value; });
  const blob = new Blob([JSON.stringify({ version:1, exportedAt:new Date().toISOString(), settings }, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `capsularius-settings-${new Date().toISOString().slice(0,10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderBackup(body) {
  body.append(el('p', 'caps-v033-copy', 'Export or import Capsularius visual settings, type labels, and local metadata. Browser permission handles are not exported, so imported mounted locations still need reconnecting.'));
  const backup = el('div', 'caps-v033-backup');
  const exportCard = el('article'); exportCard.append(el('h3', '', 'Export Settings'), el('p', '', 'Download the current local Capsularius settings as JSON.'));
  const download = el('button', 'primary', '⬇️ Download Settings JSON'); download.addEventListener('click', downloadBackup); exportCard.append(download);
  const importCard = el('article'); importCard.append(el('h3', '', 'Import Settings'), el('p', '', 'Import a prior Capsularius settings JSON. The app reloads after a valid import.'));
  const picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'application/json,.json'; picker.hidden = true;
  const upload = el('button', '', '⬆️ Import Settings JSON'); upload.addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => {
    const file = picker.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data?.settings || typeof data.settings !== 'object') throw new Error('This is not a Capsularius settings backup.');
        Object.entries(data.settings).forEach(([key, value]) => { if (BACKUP_KEYS.includes(key) && typeof value === 'string') localStorage.setItem(key, value); });
        window.location.reload();
      } catch (error) { window.alert(error?.message || 'The backup could not be imported.'); }
    });
    reader.readAsText(file);
  });
  importCard.append(upload, picker); backup.append(exportCard, importCard); body.append(backup);
}

function renderSettings() {
  const workspace = getWorkspace();
  if (!workspace) return;
  closeSettings();
  const backdrop = el('div', 'caps-v033-backdrop');
  const panel = el('section', 'caps-v033-settings');
  const header = el('header', 'caps-v033-head');
  const left = el('div'); left.append(el('h2', 'caps-v033-title', 'Capsularius Settings'));
  const tabs = el('nav', 'caps-v033-tabs');
  [['locations','Mounted Locations'],['types','File Types'],['backup','Backup']].forEach(([id, label]) => {
    const button = el('button', `caps-v033-tab${tab === id ? ' active' : ''}`, label);
    button.type = 'button';
    button.addEventListener('click', () => { tab = id; renderSettings(); });
    tabs.append(button);
  });
  left.append(tabs);
  const close = el('button', 'caps-v033-close', '❌'); close.type = 'button'; close.addEventListener('click', closeSettings);
  header.append(left, close);
  const body = el('main', 'caps-v033-body');
  if (tab === 'locations') renderLocations(body, workspace);
  else if (tab === 'types') renderTypes(body, workspace);
  else renderBackup(body);
  panel.append(header, body); backdrop.append(panel); document.getElementById('dialog-layer').append(backdrop);
}

function refresh() {
  const badge = document.querySelector('.app-badge');
  if (badge && badge.textContent !== VERSION) badge.textContent = VERSION;
  fillTypeCells();
}

addStyles();
document.addEventListener('click', (event) => {
  const button = event.target.closest('#capsularius-settings-button');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  renderSettings();
}, true);
new MutationObserver(() => requestAnimationFrame(refresh)).observe(document.body, { childList:true, subtree:true });
setTimeout(refresh, 80);
