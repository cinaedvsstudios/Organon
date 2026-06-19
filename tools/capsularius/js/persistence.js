const DB_NAME = 'organon-capsularius';
const STORE_NAME = 'capsularius-state';
const DB_VERSION = 1;

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

export const persistence = {
  async load() {
    const [mounts, library, recents, workspace, googleDriveAccounts, mountVerification] = await Promise.all([
      readValue('mounts', []),
      readValue('library', []),
      readValue('recents', []),
      readValue('workspace', null),
      readValue('google-drive-accounts', []),
      readValue('mount-verification', {})
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
  saveMounts(mounts) { return writeValue('mounts', mounts); },
  saveLibrary(library) { return writeValue('library', library); },
  saveRecents(recents) { return writeValue('recents', recents); },
  saveWorkspace(workspace) { return writeValue('workspace', workspace); },
  loadGoogleDriveAccounts() { return readValue('google-drive-accounts', []); },
  saveGoogleDriveAccounts(accounts) { return writeValue('google-drive-accounts', accounts); },
  loadMountVerification() { return readValue('mount-verification', {}); },
  saveMountVerification(records) { return writeValue('mount-verification', records); }
};
