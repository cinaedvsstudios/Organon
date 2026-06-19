const DB_NAME = 'organon-capsularius';
const STORE_NAME = 'capsularius-state';
const DB_VERSION = 1;
const FAST_STATE_PREFIX = 'capsularius.fast-state';

let dbPromise;

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

function fastStateKey() {
  return `${FAST_STATE_PREFIX}:${modeName()}:v1`;
}

function cloneJson(value, fallback = null) {
  try { return JSON.parse(JSON.stringify(value)); }
  catch (_) { return fallback; }
}

function readFastState() {
  try {
    const raw = localStorage.getItem(fastStateKey());
    if (!raw) return null;
    const state = JSON.parse(raw);
    return state && typeof state === 'object' ? state : null;
  } catch (_) {
    return null;
  }
}

function writeFastState(state) {
  try { localStorage.setItem(fastStateKey(), JSON.stringify(state)); }
  catch (_) { /* IndexedDB remains the primary persisted store. */ }
}

function snapshotWindow(record) {
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

function cacheLiveWorkspace() {
  const state = window.__capsulariusWorkspace?.state;
  if (!state?.windows || !state?.mounts) return;

  const snapshot = {
    version: 1,
    savedAt: Date.now(),
    library: cloneJson(state.library, []),
    recents: cloneJson(state.recents, []),
    workspace: {
      nextWindowId: state.nextWindowId,
      activeWindowId: state.activeWindowId,
      panX: state.workspace?.panX || 0,
      panY: state.workspace?.panY || 0,
      currentColourIndex: state.currentColourIndex || 0,
      windows: [...state.windows.values()].map(snapshotWindow)
    }
  };

  if (modeName() === 'desktop') {
    snapshot.mounts = [...state.mounts.values()]
      .filter((mount) => mount?.nativePath)
      .map((mount) => ({
        id: mount.id,
        nativePath: mount.nativePath,
        name: mount.name,
        nickname: mount.nickname,
        colour: mount.colour,
        createdAt: mount.createdAt,
        lastOpenedAt: mount.lastOpenedAt,
        health: mount.health || 'unknown',
        healthDetail: mount.healthDetail || ''
      }));
  }

  writeFastState(snapshot);
}

async function readModeValue(key, fallback, { browserLegacyFallback = false } = {}) {
  const current = await readValue(modeKey(key), undefined);
  if (current !== undefined) return current;
  if (browserLegacyFallback && modeName() === 'browser') return readValue(key, fallback);
  return fallback;
}

window.addEventListener('pagehide', cacheLiveWorkspace);
window.addEventListener('beforeunload', cacheLiveWorkspace);
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') cacheLiveWorkspace();
});

export const persistence = {
  async load() {
    const fastState = readFastState();
    const [storedMounts, storedLibrary, storedRecents, storedWorkspace, googleDriveAccounts, mountVerification] = await Promise.all([
      readModeValue('mounts', [], { browserLegacyFallback:true }),
      readModeValue('library', [], { browserLegacyFallback:true }),
      readModeValue('recents', [], { browserLegacyFallback:true }),
      readModeValue('workspace', null, { browserLegacyFallback:true }),
      readValue('google-drive-accounts', []),
      readModeValue('mount-verification', {}, { browserLegacyFallback:true })
    ]);

    const mounts = fastState?.mounts ?? storedMounts;
    const library = fastState?.library ?? storedLibrary;
    const recents = fastState?.recents ?? storedRecents;
    const workspace = fastState?.workspace ?? storedWorkspace;

    return {
      mounts: Array.isArray(mounts) ? mounts : [],
      library: Array.isArray(library) ? library : [],
      recents: Array.isArray(recents) ? recents : [],
      workspace: workspace && typeof workspace === 'object' ? workspace : null,
      googleDriveAccounts: Array.isArray(googleDriveAccounts) ? googleDriveAccounts : [],
      mountVerification: mountVerification && typeof mountVerification === 'object' ? mountVerification : {}
    };
  },
  saveMounts(mounts) { return writeValue(modeKey('mounts'), mounts); },
  saveLibrary(library) { return writeValue(modeKey('library'), library); },
  saveRecents(recents) { return writeValue(modeKey('recents'), recents); },
  saveWorkspace(workspace) { return writeValue(modeKey('workspace'), workspace); },
  loadGoogleDriveAccounts() { return readValue('google-drive-accounts', []); },
  saveGoogleDriveAccounts(accounts) { return writeValue('google-drive-accounts', accounts); },
  loadMountVerification() { return readModeValue('mount-verification', {}, { browserLegacyFallback:true }); },
  saveMountVerification(records) { return writeValue(modeKey('mount-verification'), records); }
};
