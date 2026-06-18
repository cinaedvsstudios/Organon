import { makeId } from './filesystem.js';

export const PALETTE = ['#e0a360', '#4b84bf', '#449e92', '#9a2f4f', '#d27d6c', '#896b49'];

export function createState() {
  return {
    mounts: new Map(),
    library: [],
    recents: [],
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

export function librarySource() {
  return { kind: 'library' };
}

export function recentsSource() {
  return { kind: 'recents' };
}

export function sourceKey(source) {
  if (source.kind === 'physical') return `physical:${source.mountId}:${source.pathSegments.join('/')}`;
  return source.kind;
}

export function cloneSource(source) {
  return source.kind === 'physical'
    ? physicalSource(source.mountId, source.pathSegments)
    : { kind: source.kind };
}

export function sourceTitle(state, source) {
  if (source.kind === 'library') return 'Library';
  if (source.kind === 'recents') return 'Recents';
  const mount = state.mounts.get(source.mountId);
  if (!mount) return 'Missing location';
  if (source.pathSegments.length === 0) return mount.nickname || mount.name;
  return source.pathSegments[source.pathSegments.length - 1];
}

export function sourcePathLabel(state, source) {
  if (source.kind === 'library') return 'Library';
  if (source.kind === 'recents') return 'Recents';
  const mount = state.mounts.get(source.mountId);
  if (!mount) return 'Missing location';
  return [mount.nickname || mount.name, ...source.pathSegments].join(' / ');
}

export function createMount(handle, colour) {
  return {
    id: makeId('mount'),
    handle,
    name: handle.name,
    nickname: handle.name,
    colour,
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
    permission: 'prompt'
  };
}

export function createLibraryEntry(source, { name, emoji, colour }) {
  return {
    id: makeId('library'),
    mountId: source.mountId,
    pathSegments: [...source.pathSegments],
    name,
    emoji: emoji || '📁',
    colour,
    addedAt: Date.now()
  };
}

export function makeWindowRecord(state, source, overrides = {}) {
  const id = state.nextWindowId++;
  const stagger = (state.windows.size % 8) * 28;
  const hasSavedColour = typeof overrides.colour === 'string' && overrides.colour.length > 0;
  const colour = hasSavedColour
    ? overrides.colour
    : PALETTE[state.currentColourIndex++ % PALETTE.length];

  return {
    id,
    source: cloneSource(source),
    nickname: overrides.nickname || sourceTitle(state, source),
    colour,
    x: Number.isFinite(overrides.x) ? overrides.x : 60 + stagger,
    y: Number.isFinite(overrides.y) ? overrides.y : 48 + stagger,
    width: Number.isFinite(overrides.width) ? overrides.width : 530,
    height: Number.isFinite(overrides.height) ? overrides.height : 420,
    viewMode: overrides.viewMode === 'list' ? 'list' : 'grid',
    minimized: Boolean(overrides.minimized),
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
  return state.mounts.get(source.mountId)?.colour || '#449e92';
}

export function windowSnapshot(windowRecord) {
  return {
    id: windowRecord.id,
    source: cloneSource(windowRecord.source),
    nickname: windowRecord.nickname,
    colour: windowRecord.colour,
    x: windowRecord.x,
    y: windowRecord.y,
    width: windowRecord.width,
    height: windowRecord.height,
    viewMode: windowRecord.viewMode,
    minimized: Boolean(windowRecord.minimized)
  };
}
