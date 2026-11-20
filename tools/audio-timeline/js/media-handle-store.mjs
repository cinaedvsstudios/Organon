/**
 * Persistent media references for MotoriClip Advanced.
 *
 * Store only FileSystemFileHandle capabilities in IndexedDB, never a File,
 * Blob, array buffer, file contents or absolute OS path. A handle may be
 * offered by showOpenFilePicker(), showDirectoryPicker(), or Chromium's
 * DataTransferItem.getAsFileSystemHandle(). Unsupported browsers continue
 * using the existing filename-only localStorage index + manual reimport.
 *
 * FileSystemHandle storage is structured-clone-based and is not available
 * in every browser. Permission can expire or be revoked at any time.
 */
const DB_NAME='motori-advanced-media-handles-v1';
const STORE_NAME='file-handles';
const DB_VERSION=1;

export function isPersistentFileHandle(handle) {
    return Boolean(handle && handle.kind==='file' && typeof handle.getFile==='function');
}

/**
 * Reconnect only the recorded source, not a file overwritten at the same path.
 * OPFS/copy workflows can change lastModified without changing the bytes, so
 * enforce the saved positive file size, filename and media kind. Legacy entries
 * without a recorded size still use the historical name/kind fallback.
 */
export function matchesSavedMediaReference(entry,file,kind) {
    if(!entry || !file || entry.name!==file.name || entry.kind!==kind) return false;
    const savedSize=Number(entry.size);
    return !(Number.isFinite(savedSize)&&savedSize>0&&file.size!==savedSize);
}

function openHandleDatabase() {
    if(typeof indexedDB==='undefined') return Promise.resolve(null);
    return new Promise((resolve,reject)=>{
        const request=indexedDB.open(DB_NAME,DB_VERSION);
        request.onupgradeneeded=()=>{
            const database=request.result;
            if(!database.objectStoreNames.contains(STORE_NAME))
                database.createObjectStore(STORE_NAME,{keyPath:'id'});
        };
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error||Error('Media handle database unavailable'));
        request.onblocked=()=>reject(Error('Close other editor tabs to update media handles'));
    });
}

async function transaction(mode,operation) {
    const database=await openHandleDatabase();
    if(!database)return null;
    try {
        return await new Promise((resolve,reject)=>{
            let request;
            const tx=database.transaction(STORE_NAME,mode);
            const store=tx.objectStore(STORE_NAME);
            try { request=operation(store); }
            catch(error) { tx.abort();reject(error);return; }
            tx.oncomplete=()=>resolve(request?.result??true);
            tx.onerror=()=>reject(tx.error||request?.error||Error('Media handle transaction failed'));
            tx.onabort=()=>reject(tx.error||Error('Media handle transaction aborted'));
        });
    } finally { database.close(); }
}

/** Returns false when the browser cannot persist file handles. */
export async function saveMediaHandle(id,handle) {
    if(typeof id!=='string'||!id.trim()||!isPersistentFileHandle(handle))return false;
    try {
        const result=await transaction('readwrite',store=>store.put({id,handle}));
        return result!==null;
    } catch(error) {
        // DataCloneError is expected on some browsers despite usable handle
        // objects. Never fall back to serializing a File/Blob or path.
        console.warn('File handle could not be remembered; media filename remains available.',error);
        return false;
    }
}

export async function getMediaHandle(id) {
    if(typeof id!=='string'||!id.trim())return null;
    try {
        const record=await transaction('readonly',store=>store.get(id));
        return isPersistentFileHandle(record?.handle)?record.handle:null;
    } catch(error) {
        console.warn('Remembered media handle unavailable.',error);
        return null;
    }
}

export async function clearMediaHandles() {
    try { await transaction('readwrite',store=>store.clear());return true; }
    catch(error) { console.warn('Could not clear saved media handles.',error);return false; }
}

/**
 * Probe the current permission without causing a browser prompt.
 * User-initiated row clicks may request permission, but initial page load
 * must never request a local disk permission unexpectedly.
 */
export async function getPermittedMediaFile(handle,{requestPermission=false}={}) {
    if(!isPersistentFileHandle(handle))return null;
    try {
        let status=typeof handle.queryPermission==='function'
            ? await handle.queryPermission({mode:'read'}) : 'granted';
        if(status!=='granted' && requestPermission && typeof handle.requestPermission==='function')
            status=await handle.requestPermission({mode:'read'});
        if(status!=='granted')return null;
        const file=await handle.getFile();
        return file instanceof File?file:null;
    } catch(error) {
        if(error?.name!=='NotAllowedError' && error?.name!=='NotFoundError')
            console.warn('Cannot read remembered media file.',error);
        return null;
    }
}
