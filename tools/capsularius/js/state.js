import { makeId } from './filesystem.js';

export const PALETTE = ['#e0a360', '#4b84bf', '#449e92', '#9a2f4f', '#d27d6c', '#896b49'];

export function createState() {
  return {
    mounts: new Map(),
    library: [],
    recents: [],
    googleDrive: { accounts: [], ready: false },
    windows: new Map(),
    nextWindowId: 1,
    activeWindowId: null,
    workspace: { panX: 0, panY: 0 },
    currentColourIndex: 0
  };
}

export function physicalSource(mountId, pathSegments = []) {
  return { kind: 'physical', mountId, pathSegments: [...pathSegments] };
}

export function zipSource(mountId, parentPathSegments = [], archiveName = '', zipPath = '', options = {}) {
  return {
    kind: 'zip',
    mountId,
    parentPathSegments: [...parentPathSegments],
    archiveName,
    zipPath: String(zipPath || '').replace(/^\/+/, ''),
    parent: options.parent ? cloneSource(options.parent) : null
  };
}

export function librarySource() { return { kind: 'library' }; }
export function recentsSource() { return { kind: 'recents' }; }

export function googleDriveSource(node = 'root', options = {}) {
  return {
    kind: 'google-drive',
    node,
    accountId: options.accountId || null,
    folderId: options.folderId || null,
    driveId: options.driveId || null,
    name: options.name || null,
    parent: options.parent ? cloneSource(options.parent) : null
  };
}

export function sourceKey(source) {
  if (source.kind === 'physical') return `physical:${source.mountId}:${source.pathSegments.join('/')}`;
  if (source.kind === 'zip') return `zip:${source.mountId}:${source.parentPathSegments.join('/')}:${source.archiveName}:${source.zipPath}`;
  if (source.kind === 'google-drive') return `google-drive:${source.accountId || 'none'}:${source.node}:${source.driveId || ''}:${source.folderId || ''}`;
  return source.kind;
}

export function cloneSource(source) {
  if (source.kind === 'physical') return physicalSource(source.mountId, source.pathSegments);
  if (source.kind === 'zip') return zipSource(source.mountId, source.parentPathSegments, source.archiveName, source.zipPath, { parent:source.parent || null });
  if (source.kind === 'google-drive') {
    return googleDriveSource(source.node, {
      accountId: source.accountId,
      folderId: source.folderId,
      driveId: source.driveId,
      name: source.name,
      parent: source.parent || null
    });
  }
  return { kind: source.kind };
}

function googleAccountLabel(state, accountId) {
  const account = state.googleDrive?.accounts?.find((item) => item.id === accountId);
  return account?.label || account?.displayName || account?.email || 'Google Drive';
}

export function sourceTitle(state, source) {
  if (source.kind === 'library') return 'Library';
  if (source.kind === 'recents') return 'Recents';
  if (source.kind === 'zip') {
    const segments = source.zipPath.replace(/\/$/, '').split('/').filter(Boolean);
    return segments.at(-1) || source.archiveName || 'ZIP archive';
  }
  if (source.kind === 'google-drive') {
    if (source.node === 'root') return 'Google Drives';
    if (source.node === 'account') return googleAccountLabel(state, source.accountId);
    if (source.node === 'connect') return source.accountId ? `Connect ${googleAccountLabel(state, source.accountId)}` : 'Connect Google Drive';
    if (source.node === 'my-drive') return 'My Drive';
    if (source.node === 'shared-with-me') return 'Shared with me';
    if (source.node === 'shared-drives') return 'Shared drives';
    return source.name || 'Google Drive folder';
  }
  const mount = state.mounts.get(source.mountId);
  if (!mount) return 'Missing location';
  if (source.pathSegments.length === 0) return mount.nickname || mount.name;
  return source.pathSegments[source.pathSegments.length - 1];
}

export function sourcePathLabel(state, source) {
  if (source.kind === 'library') return 'Library';
  if (source.kind === 'recents') return 'Recents';
  if (source.kind === 'zip') {
    const mount = state.mounts.get(source.mountId);
    const root = [mount?.nickname || mount?.name || 'Missing location', ...source.parentPathSegments, source.archiveName];
    const inner = source.zipPath.replace(/\/$/, '').split('/').filter(Boolean);
    return [...root, ...inner].join(' / ');
  }
  if (source.kind === 'google-drive') {
    const labels = [];
    let current = source;
    while (current) {
      labels.unshift(sourceTitle(state, current));
      current = current.parent || null;
    }
    return labels.join(' / ');
  }
  const mount = state.mounts.get(source.mountId);
  if (!mount) return 'Missing location';
  return [mount.nickname || mount.name, ...source.pathSegments].join(' / ');
}

export function createMount(handle, colour) {
  return {
    id: makeId('mount'),
    handle,
    nativePath: handle?.nativePath || null,
    name: handle.name,
    nickname: handle.name,
    colour,
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
    permission: 'prompt'
  };
}

export function createLibraryEntry(source, { name, emoji, colour }) {
  return { id: makeId('library'), mountId: source.mountId, pathSegments: [...source.pathSegments], name, emoji: emoji || '📁', colour, addedAt: Date.now() };
}

function normaliseSettings(raw = {}) {
  const windowSettings = raw.window || {};
  const folders = raw.folders && typeof raw.folders === 'object' ? raw.folders : {};
  return {
    scope: raw.scope === 'folder' ? 'folder' : 'window',
    window: {
      viewMode: windowSettings.viewMode === 'list' ? 'list' : 'grid',
      sortBy: ['name', 'type', 'size', 'modified'].includes(windowSettings.sortBy) ? windowSettings.sortBy : 'name',
      sortDirection: windowSettings.sortDirection === 'desc' ? 'desc' : 'asc'
    },
    folders
  };
}

export function makeWindowRecord(state, source, overrides = {}) {
  const id = state.nextWindowId++;
  const stagger = (state.windows.size % 8) * 28;
  const isRestoredWindow = Number.isFinite(overrides.id);
  const hasSavedColour = typeof overrides.colour === 'string' && overrides.colour.length > 0;
  const colour = isRestoredWindow && hasSavedColour ? overrides.colour : PALETTE[state.currentColourIndex++ % PALETTE.length];
  const settings = normaliseSettings(overrides.settings || { scope: 'window', window: { viewMode: overrides.viewMode, sortBy: overrides.sortBy, sortDirection: overrides.sortDirection } });
  return {
    id,
    source: cloneSource(source),
    nickname: overrides.nickname || sourceTitle(state, source),
    colour,
    x: Number.isFinite(overrides.x) ? overrides.x : 60 + stagger,
    y: Number.isFinite(overrides.y) ? overrides.y : 48 + stagger,
    width: Number.isFinite(overrides.width) ? overrides.width : 530,
    height: Number.isFinite(overrides.height) ? overrides.height : 420,
    viewMode: settings.window.viewMode,
    settings,
    minimized: Boolean(overrides.minimized),
    treeExpanded: new Set(Array.isArray(overrides.treeExpanded) ? overrides.treeExpanded : []),
    treeChildren: new Map(),
    treeLoading: new Set(),
    filter: '',
    items: [],
    selectedIds: new Set(),
    lastSelectedIndex: -1,
    loading: false,
    error: null,
    permissionRequired: false,
    objectUrls: new Set(),
    history: [cloneSource(source)],
    historyIndex: 0,
    element: null
  };
}

export function defaultColourForSource(state, source) {
  if (source.kind === 'library') return '#e0a360';
  if (source.kind === 'recents') return '#4b84bf';
  if (source.kind === 'google-drive') return '#4285f4';
  if (source.kind === 'zip') return state.mounts.get(source.mountId)?.colour || '#896b49';
  return state.mounts.get(source.mountId)?.colour || '#449e92';
}

export function windowSnapshot(windowRecord) {
  return { id: windowRecord.id, source: cloneSource(windowRecord.source), nickname: windowRecord.nickname, colour: windowRecord.colour, x: windowRecord.x, y: windowRecord.y, width: windowRecord.width, height: windowRecord.height, viewMode: windowRecord.viewMode, settings: windowRecord.settings, minimized: Boolean(windowRecord.minimized), treeExpanded: [...windowRecord.treeExpanded] };
}
