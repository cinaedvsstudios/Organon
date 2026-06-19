import { loadDesktopWorkspaceState, saveDesktopWorkspaceState } from './desktop-handles.js';

const DB_NAME = 'organon-capsularius';
const STORE_NAME = 'capsularius-state';
const DB_VERSION = 1;

let dbPromise;
let desktopStateCache = null;
let desktopWriteQueue = Promise.resolve();

function desktopMode() {
  return document.documentElement.dataset.capsulariusMode === 'desktop' && Boolean(window.capsulariusDesktop?.isDesktop);
}

function cloneJson(value, fallback) {
  try { return JSON.parse(JSON.stringify(value)); }
  catch (_) { return fallback; }
}

function normaliseDesktopState(raw = {}) {
  return {
    version: 1,
    savedAt: Number(raw.savedAt) || 0,
    mounts: Array.isArray(raw.mounts) ? raw.mounts : [],
    library: Array.isArray(raw.library) ? raw.library : [],
    recents: Array.isArray(raw.recents) ? raw.recents : [],
    workspace: raw.workspace && typeof raw.workspace === 'object' ? raw.workspace : null,
    mountVerification: raw.mountVerification && typeof raw.mountVerification === 'object' ? raw.mountVerification : {}
  };
}

async function ensureDesktopState() {
  if (desktopStateCache) return desktopStateCache;
  desktopStateCache = normaliseDesktopState(await loadDesktopWorkspaceState());
  return desktopStateCache;
}

function queueDesktopWrite() {
  const snapshot = cloneJson({ ...desktopStateCache, savedAt:Date.now() }, null);
  desktopWriteQueue = desktopWriteQueue
    .catch(() => undefined)
    .then(() => saveDesktopWorkspaceState(snapshot));
  return desktopWriteQueue;
}

async function saveDesktopPart(key, value) {
  const state = await ensureDesktopState();
  state[key] = cloneJson(value, key === 'mountVerification' ? {} : key === 'workspace' ? null : []);
  return queueDesktopWrite();
}

function serialiseDesktopMount(mount) {
  if (!mount?.nativePath) return null;
  return {
    id: mount.id,
    nativePath: mount.nativePath,
    name: mount.name,
    nickname: mount.nickname,
    colour: mount.colour,
    createdAt: mount.createdAt,
    lastOpenedAt: mount.lastOpenedAt,
    health: mount.health || 'unknown',
    healthDetail: mount.healthDetail || ''
  };
}

function serialiseDesktopWindow(record) {
  return {
    id: record.id,
    source: cloneJson(record.source, { kind:'library' }),
    nickname: record.nickname,
    colour: record.colour,
    x: record.x,
    y: record.y,
    width: record.width,
    height: record.height,
    viewMode: record.viewMode,
    settings: cloneJson(record.settings, {}),
    minimized: Boolean(record.minimized),
    treeExpanded: [...(record.treeExpanded || [])]
  };
}

async function saveLiveDesktopWorkspace(state) {
  if (!desktopMode() || !state) return;
  const snapshot = {
    version: 1,
    mounts: [...state.mounts.values()].map(serialiseDesktopMount).filter(Boolean),
    library: cloneJson(state.library, []),
    recents: cloneJson(state.recents, []),
    workspace: {
      nextWindowId: state.nextWindowId,
      activeWindowId: state.activeWindowId,
      panX: state.workspace?.panX || 0,
      panY: state.workspace?.panY || 0,
      currentColourIndex: state.currentColourIndex || 0,
      windows: [...state.windows.values()].map(serialiseDesktopWindow)
    },
    mountVerification: desktopStateCache?.mountVerification || {}
  };
  desktopStateCache = normaliseDesktopState(snapshot);
  return queueDesktopWrite();
}

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open Capsularius storage.'));
  });
  return dbPromise;
}

async function readValue(key, fallback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result === undefined ? fallback : request.result);
    request.onerror = () => reject(request.error || new Error(`Could not read ${key}.`));
  });
}

async function writeValue(key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error(`Could not save ${key}.`));
    tx.onabort = () => reject(tx.error || new Error(`Could not save ${key}.`));
  });
}

function modeName() {
  return document.documentElement.dataset.capsulariusMode === 'desktop' ? 'desktop' : 'browser';
}

function modeKey(key) {
  return `${key}:${modeName()}`;
}

async function readModeValue(key, fallback, { browserLegacyFallback = false } = {}) {
  const current = await readValue(modeKey(key), undefined);
  if (current !== undefined) return current;
  if (browserLegacyFallback && modeName() === 'browser') return readValue(key, fallback);
  return fallback;
}

export const persistence = {
  async load() {
    if (desktopMode()) {
      desktopStateCache = normaliseDesktopState(await loadDesktopWorkspaceState());
      return {
        mounts: desktopStateCache.mounts,
        library: desktopStateCache.library,
        recents: desktopStateCache.recents,
        workspace: desktopStateCache.workspace,
        googleDriveAccounts: await readValue('google-drive-accounts', []),
        mountVerification: desktopStateCache.mountVerification
      };
    }

    const [mounts, library, recents, workspace, googleDriveAccounts, mountVerification] = await Promise.all([
      readModeValue('mounts', [], { browserLegacyFallback:true }),
      readModeValue('library', [], { browserLegacyFallback:true }),
      readModeValue('recents', [], { browserLegacyFallback:true }),
      readModeValue('workspace', null, { browserLegacyFallback:true }),
      readValue('google-drive-accounts', []),
      readModeValue('mount-verification', {}, { browserLegacyFallback:true })
    ]);
    return {
      mounts: Array.isArray(mounts) ? mounts : [],
      library: Array.isArray(library) ? library : [],
      recents: Array.isArray(recents) ? recents : [],
      workspace: workspace && typeof workspace === 'object' ? workspace : null,
      googleDriveAccounts: Array.isArray(googleDriveAccounts) ? googleDriveAccounts : [],
      mountVerification: mountVerification && typeof mountVerification === 'object' ? mountVerification : {}
    };
  },
  saveMounts(mounts) { return desktopMode() ? saveDesktopPart('mounts', mounts) : writeValue(modeKey('mounts'), mounts); },
  saveLibrary(library) { return desktopMode() ? saveDesktopPart('library', library) : writeValue(modeKey('library'), library); },
  saveRecents(recents) { return desktopMode() ? saveDesktopPart('recents', recents) : writeValue(modeKey('recents'), recents); },
  saveWorkspace(workspace) { return desktopMode() ? saveDesktopPart('workspace', workspace) : writeValue(modeKey('workspace'), workspace); },
  saveDesktopWorkspaceFromApp(state) { return saveLiveDesktopWorkspace(state); },
  loadGoogleDriveAccounts() { return readValue('google-drive-accounts', []); },
  saveGoogleDriveAccounts(accounts) { return writeValue('google-drive-accounts', accounts); },
  loadMountVerification() { return desktopMode() ? ensureDesktopState().then((state) => state.mountVerification) : readModeValue('mount-verification', {}, { browserLegacyFallback:true }); },
  saveMountVerification(records) { return desktopMode() ? saveDesktopPart('mountVerification', records) : writeValue(modeKey('mount-verification'), records); }
};
