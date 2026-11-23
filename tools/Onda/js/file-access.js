/* Onda v3.13 — Optional browser-local File System Access handles.
 * Deliberately separate from OndaMediaPlayerPersistentDB v2 (state/audioFiles).
 * No write permission to the user's music, no source-file deletion, no remote sync.
 */
(() => {
    'use strict';

    const DATABASE = 'OndaMediaPlayerFileHandlesDB';
    const DATABASE_VERSION = 1;
    const FILES = 'files';
    const AUDIO_EXTENSION = /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus|aiff|aif|mid|midi|mp4|webm)$/i;
    const MAX_DIRECTORY_FILES = 3500;
    const MAX_DIRECTORY_DEPTH = 12;
    // An in-memory index lets the Reconnect button request permissions in the
    // original user gesture; IndexedDB handles are restored during startup.
    const rememberedHandles = new Map();

    function supportsFilePicker() {
        return !!(window.isSecureContext && typeof window.showOpenFilePicker === 'function');
    }

    function supportsDirectoryPicker() {
        return !!(window.isSecureContext && typeof window.showDirectoryPicker === 'function');
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB is unavailable.'));
                return;
            }
            const request = indexedDB.open(DATABASE, DATABASE_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('File handle database unavailable.'));
            request.onblocked = () => reject(new Error('File handle database is open in another tab.'));
        });
    }

    async function rememberMany(entries) {
        const valid = (entries || []).filter(item =>
            item && typeof item.trackId === 'string' &&
            item.trackId && item.handle?.kind === 'file');
        if (!valid.length) return 0;
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = (error = null) => {
                if (settled) return;
                settled = true;
                db.close();
                if (error) reject(error);
                else {
                    valid.forEach(item => rememberedHandles.set(item.trackId, {
                        handle: item.handle,
                        name: item.fileName || item.handle.name || '',
                        relativePath: item.relativePath || item.fileName || ''
                    }));
                    resolve(valid.length);
                }
            };
            try {
                const tx = db.transaction(FILES, 'readwrite');
                const store = tx.objectStore(FILES);
                valid.forEach(item => {
                    store.put({
                        handle: item.handle,
                        name: item.fileName || item.handle.name || '',
                        relativePath: item.relativePath || item.fileName || '',
                        linkedAt: new Date().toISOString()
                    }, item.trackId);
                });
                tx.oncomplete = () => finish();
                tx.onerror = () => finish(tx.error || new Error('Could not save file access handles.'));
                tx.onabort = () => finish(tx.error || new Error('File access transaction aborted.'));
            } catch (error) {
                finish(error);
            }
        });
    }

    async function getLinkedRecord(trackId) {
        if (!trackId) return null;
        const id = String(trackId);
        if (rememberedHandles.has(id)) return rememberedHandles.get(id);
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = (error, data = null) => {
                if (settled) return;
                settled = true;
                db.close();
                if (error) reject(error);
                else {
                    if (data) rememberedHandles.set(id, data);
                    resolve(data);
                }
            };
            try {
                const tx = db.transaction(FILES, 'readonly');
                const request = tx.objectStore(FILES).get(String(trackId));
                request.onsuccess = () => finish(null, request.result || null);
                request.onerror = () => finish(request.error || new Error('Handle read failed.'));
                tx.onabort = () => finish(tx.error || new Error('Handle read aborted.'));
                tx.oncomplete = () => { if (!settled) finish(null, null); };
            } catch (error) {
                finish(error);
            }
        });
    }

    async function listTrackIds() {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = (error, keys = [], values = []) => {
                if (settled) return;
                settled = true;
                db.close();
                if (error) reject(error);
                else {
                    keys.forEach((key, index) => {
                        if (values[index]?.handle?.kind === 'file') {
                            rememberedHandles.set(String(key), values[index]);
                        }
                    });
                    resolve(keys.map(String));
                }
            };
            try {
                const tx = db.transaction(FILES, 'readonly');
                const store = tx.objectStore(FILES);
                const keysRequest = store.getAllKeys();
                const valuesRequest = store.getAll();
                let keys = [];
                let values = [];
                keysRequest.onsuccess = () => { keys = keysRequest.result || []; };
                valuesRequest.onsuccess = () => { values = valuesRequest.result || []; };
                tx.oncomplete = () => finish(null, keys, values);
                tx.onerror = () => finish(tx.error || new Error('Handle inventory failed.'));
                tx.onabort = () => finish(tx.error || new Error('Handle inventory aborted.'));
            } catch (error) {
                finish(error);
            }
        });
    }

    // Invoke *synchronously from a Reconnect button click*. requestPermission()
    // requires transient user activation, so do not await an IDB lookup first.
    function requestFile(trackId) {
        const saved = rememberedHandles.get(String(trackId));
        const handle = saved?.handle;
        if (!handle || handle.kind !== 'file' || typeof handle.getFile !== 'function') return null;
        const permission = typeof handle.requestPermission === 'function'
            ? handle.requestPermission({ mode: 'read' })
            : Promise.resolve('granted');
        return Promise.resolve(permission).then(status =>
            status === 'granted' ? handle.getFile().then(file => ({ file, handle, relativePath: saved.relativePath || file.name })) : null
        );
    }

    // Silent access only. A saved handle may exist while browser permissions
    // are 'prompt'. Play must not force a permission dialog if cached media exists.
    async function readFile(trackId) {
        const saved = await getLinkedRecord(trackId);
        const handle = saved?.handle;
        if (!handle || handle.kind !== 'file' || typeof handle.getFile !== 'function') return null;
        if (typeof handle.queryPermission === 'function') {
            const permission = await handle.queryPermission({ mode: 'read' });
            if (permission !== 'granted') return null;
        }
        return handle.getFile();
    }

    async function pickFiles() {
        if (!supportsFilePicker()) throw new Error('File handles are unsupported in this browser.');
        // Call this function directly from a user click, before awaiting anything.
        const handles = await window.showOpenFilePicker({ multiple: true });
        const entries = [];
        for (const handle of handles) {
            if (handle?.kind !== 'file') continue;
            const file = await handle.getFile();
            entries.push({ file, handle, relativePath: file.name });
        }
        return entries;
    }

    async function pickFolder() {
        if (!supportsDirectoryPicker()) throw new Error('Folder handles are unsupported in this browser.');
        // User explicitly grants read access to a folder; never request write.
        const root = await window.showDirectoryPicker({ mode: 'read' });
        const entries = [];
        async function visit(directory, prefix, depth) {
            if (depth > MAX_DIRECTORY_DEPTH) throw new Error('Folder nesting is too deep for this import.');
            for await (const [name, handle] of directory.entries()) {
                if (handle.kind === 'directory') {
                    await visit(handle, prefix + name + '/', depth + 1);
                } else if (handle.kind === 'file' && AUDIO_EXTENSION.test(name)) {
                    if (entries.length >= MAX_DIRECTORY_FILES) {
                        throw new Error('This folder exceeds the 3,500-file safety limit. Use smaller folders.');
                    }
                    const file = await handle.getFile();
                    entries.push({ file, handle, relativePath: prefix + name });
                }
            }
        }
        await visit(root, root.name + '/', 0);
        return entries;
    }

    window.OndaFileHandles = Object.freeze({
        supportsFilePicker,
        supportsDirectoryPicker,
        pickFiles,
        pickFolder,
        rememberMany,
        listTrackIds,
        readFile,
        requestFile,
        getLinkedRecord
    });
})();
