import { extensionOf, formatBytes } from './filesystem.js';

const COLUMN_DEFS = [
  ['name', 'Name'],
  ['info', 'Length / Dimensions'],
  ['size', 'Size'],
  ['modified', 'Date modified'],
  ['created', 'Date created'],
  ['type', 'Type']
];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(value));
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function metaFor(entry) {
  return entry.capsulariusMeta || {};
}

function infoLabel(entry) {
  const meta = metaFor(entry);
  if (entry.kind === 'directory' || entry.kind === 'shortcut') return '—';
  const dimensions = Number.isFinite(meta.width) && Number.isFinite(meta.height) ? `${meta.width} × ${meta.height}` : '';
  const duration = Number.isFinite(meta.duration) ? formatDuration(meta.duration) : '';
  if (entry.fileType === 'video') return [duration, dimensions].filter(Boolean).join(' · ') || 'Reading…';
  if (entry.fileType === 'audio') return duration || 'Reading…';
  if (entry.fileType === 'image') return dimensions || 'Reading…';
  return '—';
}

function typeLabel(entry) {
  if (entry.kind === 'directory') return 'Folder';
  if (entry.kind === 'shortcut') return 'Location';
  const extension = extensionOf(entry.name);
  const label = entry.fileType ? entry.fileType[0].toUpperCase() + entry.fileType.slice(1) : 'File';
  return extension ? `${label} · .${extension}` : label;
}

function createdValue(entry) {
  const raw = entry.createdTime || entry.dateCreated || metaFor(entry).createdTime;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'string') return Date.parse(raw);
  return Number(raw);
}

function ensureState(record) {
  if (!record.capsulariusColumns) {
    record.capsulariusColumns = {
      sort: { key: 'name', direction: 'asc' },
      filters: {
        name: '',
        types: [],
        extensions: [],
        info: 'any',
        size: 'any',
        modified: 'any',
        created: 'any'
      }
    };
  }
  return record.capsulariusColumns;
}

function matchesDate(value, filter) {
  if (!filter || filter === 'any') return true;
  if (!Number.isFinite(value)) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (filter === 'today') return value >= today;
  if (filter === 'week') return value >= today - 7 * 86400000;
  if (filter === 'month') return value >= today - 30 * 86400000;
  if (filter === 'older') return value < today - 30 * 86400000;
  return true;
}

function matchesInfo(entry, filter) {
  if (!filter || filter === 'any') return true;
  const meta = metaFor(entry);
  if (filter === 'landscape') return meta.width > meta.height;
  if (filter === 'portrait') return meta.height > meta.width;
  if (filter === 'square') return meta.width === meta.height && Number.isFinite(meta.width);
  if (filter === 'short') return Number.isFinite(meta.duration) && meta.duration < 60;
  if (filter === 'medium') return Number.isFinite(meta.duration) && meta.duration >= 60 && meta.duration < 600;
  if (filter === 'long') return Number.isFinite(meta.duration) && meta.duration >= 600;
  return true;
}

function matchesSize(entry, filter) {
  if (!filter || filter === 'any' || !Number.isFinite(entry.size)) return filter === 'any' || !Number.isFinite(entry.size);
  if (filter === 'under-1') return entry.size < 1024 * 1024;
  if (filter === 'one-to-ten') return entry.size >= 1024 * 1024 && entry.size < 10 * 1024 * 1024;
  if (filter === 'ten-to-hundred') return entry.size >= 10 * 1024 * 1024 && entry.size < 100 * 1024 * 1024;
  if (filter === 'over-hundred') return entry.size >= 100 * 1024 * 1024;
  return true;
}

function filterEntries(entries, record) {
  const { filters } = ensureState(record);
  const nameNeedle = filters.name.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    const extension = extensionOf(entry.name);
    if (nameNeedle && !entry.name.toLocaleLowerCase().includes(nameNeedle)) return false;
    if (filters.types.length && !filters.types.includes(entry.fileType || 'file')) return false;
    if (filters.extensions.length && !filters.extensions.includes(extension)) return false;
    if (!matchesInfo(entry, filters.info)) return false;
    if (!matchesSize(entry, filters.size)) return false;
    if (!matchesDate(entry.lastModified, filters.modified)) return false;
    if (!matchesDate(createdValue(entry), filters.created)) return false;
    return true;
  });
}

function valueForSort(entry, key) {
  if (key === 'name') return entry.name.toLocaleLowerCase();
  if (key === 'info') return (metaFor(entry).duration || 0) * 10000000 + (metaFor(entry).width || 0) * 10000 + (metaFor(entry).height || 0);
  if (key === 'size') return Number.isFinite(entry.size) ? entry.size : -1;
  if (key === 'modified') return Number.isFinite(entry.lastModified) ? entry.lastModified : -1;
  if (key === 'created') return Number.isFinite(createdValue(entry)) ? createdValue(entry) : -1;
  if (key === 'type') return typeLabel(entry).toLocaleLowerCase();
  return '';
}

function sortEntries(entries, record) {
  const { sort } = ensureState(record);
  const modifier = sort.direction === 'desc' ? -1 : 1;
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    const first = valueForSort(a, sort.key);
    const second = valueForSort(b, sort.key);
    if (typeof first === 'string' || typeof second === 'string') return String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: 'base' }) * modifier;
    return (first - second) * modifier;
  });
}

function closeFilterMenu() {
  document.querySelector('.caps-column-filter-menu')?.remove();
}

function checkbox(label, value, checked) {
  const wrapper = element('label', 'caps-filter-check');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = value;
  input.checked = checked;
  wrapper.append(input, element('span', '', label));
  return wrapper;
}

function selectControl(options, value) {
  const select = document.createElement('select');
  options.forEach(([optionValue, label]) => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = label;
    option.selected = value === optionValue;
    select.append(option);
  });
  return select;
}

function buildFilterEditor(key, record, entries) {
  const state = ensureState(record);
  const filters = state.filters;
  const body = element('div', 'caps-filter-body');
  if (key === 'name') {
    const input = document.createElement('input');
    input.type = 'search'; input.placeholder = 'Name contains…'; input.value = filters.name;
    input.dataset.filterName = 'name';
    body.append(input);
  } else if (key === 'type') {
    const types = [...new Set(entries.map((entry) => entry.fileType || 'file'))].sort();
    const extensions = [...new Set(entries.map((entry) => extensionOf(entry.name)).filter(Boolean))].sort();
    body.append(element('strong', 'caps-filter-group-title', 'File categories'));
    types.forEach((type) => body.append(checkbox(type[0].toUpperCase() + type.slice(1), type, filters.types.includes(type))));
    if (extensions.length) {
      body.append(element('strong', 'caps-filter-group-title', 'Extensions present here'));
      extensions.forEach((extension) => body.append(checkbox(`.${extension}`, extension, filters.extensions.includes(extension))));
    }
  } else if (key === 'info') {
    body.append(selectControl([
      ['any', 'Any length or dimensions'], ['landscape', 'Landscape image/video'], ['portrait', 'Portrait image/video'], ['square', 'Square image/video'], ['short', 'Audio/video under 1 minute'], ['medium', 'Audio/video 1–10 minutes'], ['long', 'Audio/video 10+ minutes']
    ], filters.info));
  } else if (key === 'size') {
    body.append(selectControl([
      ['any', 'Any size'], ['under-1', 'Under 1 MB'], ['one-to-ten', '1–10 MB'], ['ten-to-hundred', '10–100 MB'], ['over-hundred', '100 MB+']
    ], filters.size));
  } else if (key === 'modified' || key === 'created') {
    body.append(selectControl([
      ['any', 'Any date'], ['today', 'Today'], ['week', 'Last 7 days'], ['month', 'Last 30 days'], ['older', 'Older than 30 days']
    ], filters[key]));
    if (key === 'created') body.append(element('p', 'caps-filter-help', 'Windows creation time is not exposed by browser folder handles, so local files show — unless a source supplies a created date.'));
  }
  return body;
}

function readEditor(key, body, record) {
  const filters = ensureState(record).filters;
  if (key === 'name') filters.name = body.querySelector('[data-filter-name]')?.value || '';
  else if (key === 'type') {
    const checked = [...body.querySelectorAll('input:checked')].map((input) => input.value);
    const presentExtensions = [...body.querySelectorAll('input')].map((input) => input.value).filter((value) => value.length && value !== 'file' && value !== 'image' && value !== 'audio' && value !== 'video' && value !== 'archive' && value !== 'code' && value !== 'model' && value !== 'directory');
    filters.types = checked.filter((value) => !presentExtensions.includes(value));
    filters.extensions = checked.filter((value) => presentExtensions.includes(value));
  } else {
    filters[key] = body.querySelector('select')?.value || 'any';
  }
}

function showFilterMenu(workspace, record, key, entries, event) {
  event.preventDefault();
  closeFilterMenu();
  const menu = element('div', 'caps-column-filter-menu');
  const heading = element('div', 'caps-filter-heading', `Filter ${COLUMN_DEFS.find(([column]) => column === key)?.[1] || key}`);
  const body = buildFilterEditor(key, record, entries);
  const footer = element('div', 'caps-filter-actions');
  const clear = element('button', '', 'Clear');
  const apply = element('button', 'primary', 'Apply');
  clear.type = apply.type = 'button';
  clear.addEventListener('click', () => {
    const filters = ensureState(record).filters;
    if (key === 'name') filters.name = '';
    else if (key === 'type') { filters.types = []; filters.extensions = []; }
    else filters[key] = 'any';
    closeFilterMenu(); workspace.renderWindow(record);
  });
  apply.addEventListener('click', () => { readEditor(key, body, record); closeFilterMenu(); workspace.renderWindow(record); });
  footer.append(clear, apply);
  menu.append(heading, body, footer);
  menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - 288))}px`;
  menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - 420))}px`;
  document.body.append(menu);
  window.setTimeout(() => document.addEventListener('pointerdown', (pointerEvent) => { if (!menu.contains(pointerEvent.target)) closeFilterMenu(); }, { once: true }), 0);
}

function activeFilterCount(record) {
  const filters = ensureState(record).filters;
  return [filters.name, filters.types.length, filters.extensions.length, filters.info !== 'any', filters.size !== 'any', filters.modified !== 'any', filters.created !== 'any'].filter(Boolean).length;
}

async function inspectEntry(entry, onReady) {
  if (!entry?.handle || entry.kind !== 'file' || !['image', 'audio', 'video'].includes(entry.fileType)) return;
  if (entry.capsulariusMetaState === 'loading' || entry.capsulariusMetaState === 'ready') return;
  entry.capsulariusMetaState = 'loading';
  try {
    const file = await entry.handle.getFile();
    const meta = {};
    if (entry.fileType === 'image') {
      const bitmap = await createImageBitmap(file);
      meta.width = bitmap.width; meta.height = bitmap.height; bitmap.close?.();
    } else {
      const tag = document.createElement(entry.fileType === 'video' ? 'video' : 'audio');
      tag.preload = 'metadata';
      const url = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        const clean = () => { URL.revokeObjectURL(url); tag.remove(); };
        tag.addEventListener('loadedmetadata', () => { meta.duration = tag.duration; if (entry.fileType === 'video') { meta.width = tag.videoWidth; meta.height = tag.videoHeight; } clean(); resolve(); }, { once: true });
        tag.addEventListener('error', () => { clean(); reject(new Error('Media metadata could not be read.')); }, { once: true });
        tag.src = url;
      });
    }
    entry.capsulariusMeta = meta;
    entry.capsulariusMetaState = 'ready';
  } catch (_) {
    entry.capsulariusMeta = {};
    entry.capsulariusMetaState = 'ready';
  }
  onReady();
}

function injectStyles() {
  if (document.getElementById('capsularius-file-columns-styles')) return;
  const style = document.createElement('style');
  style.id = 'capsularius-file-columns-styles';
  style.textContent = `
    .caps-list-header, .file-item.list.caps-list-row { display:grid; grid-template-columns:minmax(210px,1.45fr) minmax(132px,.9fr) minmax(82px,.45fr) minmax(110px,.7fr) minmax(110px,.7fr) minmax(120px,.75fr); align-items:center; column-gap:10px; min-width:780px; }
    .caps-list-header { position:sticky; top:0; z-index:4; margin:0 0 5px; padding:0 10px; min-height:30px; background:#1b1b19; border:1px solid #4d493d; border-radius:6px; }
    .caps-list-header button { min-width:0; color:#ece1ce; background:transparent; border:0; padding:7px 2px; font:inherit; font-size:11px; text-align:left; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .caps-list-header button:hover { color:#e0a360; }
    .caps-list-header button.sorted::after { content:' ' attr(data-direction); color:#e0a360; font-size:9px; }
    .item-list:has(.caps-list-header) { overflow-x:auto; }
    .file-item.list.caps-list-row { padding-right:10px; }
    .file-item.list.caps-list-row > .file-item-main { min-width:0; }
    .file-item.list.caps-list-row > .file-meta { grid-column:3; justify-self:start; }
    .caps-list-cell { min-width:0; color:#bfb4a4; font-size:11px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .caps-list-cell.info { grid-column:2; }.caps-list-cell.modified { grid-column:4; }.caps-list-cell.created { grid-column:5; }.caps-list-cell.type { grid-column:6; }
    .caps-list-filter-summary { display:flex; flex-wrap:wrap; gap:5px; margin:0 0 7px; }
    .caps-filter-chip { border:1px solid #896b49; border-radius:999px; background:rgba(224,163,96,.12); color:#e8d8bd; padding:3px 7px; font-size:10px; }
    .caps-column-filter-menu { position:fixed; z-index:10095; width:270px; max-height:min(520px, calc(100vh - 16px)); overflow:auto; padding:10px; border:1px solid #9e7847; border-radius:8px; background:#211717; color:#f2e4cd; box-shadow:0 14px 44px rgba(0,0,0,.65); }
    .caps-filter-heading { font-weight:800; font-size:12px; margin:2px 2px 9px; }.caps-filter-body { display:grid; gap:7px; max-height:340px; overflow:auto; padding:2px; }.caps-filter-body input[type="search"], .caps-filter-body select { width:100%; box-sizing:border-box; background:#161312; border:1px solid #735b3e; border-radius:5px; color:#f2e4cd; padding:7px; font:inherit; font-size:12px; }
    .caps-filter-check { display:flex; gap:8px; align-items:center; font-size:12px; }.caps-filter-group-title { margin:5px 0 0; color:#d6a560; font-size:10px; letter-spacing:.08em; text-transform:uppercase; }.caps-filter-help { margin:3px 0; color:#b9ab9a; font-size:11px; line-height:1.35; }.caps-filter-actions { display:flex; justify-content:flex-end; gap:7px; margin-top:11px; }.caps-filter-actions button { border:1px solid #896b49; border-radius:5px; background:#34231d; color:#f1dfc1; padding:6px 9px; cursor:pointer; font:inherit; font-size:12px; }.caps-filter-actions button.primary { background:#a86f2c; color:#201408; font-weight:800; }
    @media (max-width: 820px) { .caps-list-header, .file-item.list.caps-list-row { min-width:690px; grid-template-columns:minmax(190px,1.35fr) minmax(115px,.8fr) 75px 100px 100px 100px; } }
  `;
  document.head.append(style);
}

function renderHeader(workspace, record, content, visibleEntries) {
  const header = element('div', 'caps-list-header');
  const state = ensureState(record);
  for (const [key, label] of COLUMN_DEFS) {
    const button = element('button', state.sort.key === key ? 'sorted' : '', label);
    button.type = 'button';
    if (state.sort.key === key) button.dataset.direction = state.sort.direction === 'asc' ? '▲' : '▼';
    button.addEventListener('click', () => {
      if (state.sort.key === key) state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
      else { state.sort.key = key; state.sort.direction = 'asc'; }
      workspace.renderWindow(record);
    });
    button.addEventListener('contextmenu', (event) => showFilterMenu(workspace, record, key, record.items, event));
    header.append(button);
  }
  content.prepend(header);
  const count = activeFilterCount(record);
  if (count) {
    const summary = element('div', 'caps-list-filter-summary');
    summary.append(element('span', 'caps-filter-chip', `${count} column filter${count === 1 ? '' : 's'} active — right-click a header to change`));
    content.insertBefore(summary, header);
  }
}

export function installFileColumns(Workspace) {
  if (Workspace.prototype.__capsulariusFileColumnsInstalled) return;
  Object.defineProperty(Workspace.prototype, '__capsulariusFileColumnsInstalled', { value: true });
  injectStyles();
  const originalRenderContent = Workspace.prototype.renderContent;
  const originalRenderItem = Workspace.prototype.renderItem;

  Workspace.prototype.renderContent = function renderColumnContent(record) {
    const originalItems = record.items;
    if (record.viewMode === 'list' && !record.loading && !record.error && !record.permissionRequired) {
      record.items = sortEntries(filterEntries(originalItems, record), record);
    }
    originalRenderContent.call(this, record);
    record.items = originalItems;
    if (record.viewMode !== 'list') return;
    const content = record.element?.querySelector('.window-content');
    if (!content?.querySelector('.item-list')) return;
    renderHeader(this, record, content, originalItems);
    const renderAgain = () => { if (record.element?.isConnected && record.viewMode === 'list') this.renderWindow(record); };
    originalItems.forEach((entry) => inspectEntry(entry, renderAgain));
  };

  Workspace.prototype.renderItem = function renderColumnItem(record, entry, index, visibleEntries) {
    const node = originalRenderItem.call(this, record, entry, index, visibleEntries);
    if (record.viewMode !== 'list') return node;
    node.classList.add('caps-list-row');
    const size = node.querySelector('.file-meta');
    if (size) size.textContent = formatBytes(entry.size);
    node.append(
      element('span', 'caps-list-cell info', infoLabel(entry)),
      element('span', 'caps-list-cell modified', formatDate(entry.lastModified)),
      element('span', 'caps-list-cell created', formatDate(createdValue(entry))),
      element('span', 'caps-list-cell type', typeLabel(entry))
    );
    return node;
  };
}
