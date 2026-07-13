/**
 * Small local wrapper around ffmpeg.wasm's single-thread core.
 * The wrapper and worker are hosted with Organon; only the official core JS/WASM
 * are fetched lazily when conversion is first requested.
 */

export async function fetchBinary(source) {
    if (source instanceof Uint8Array) return source;
    if (source instanceof ArrayBuffer) return new Uint8Array(source);
    if (source instanceof Blob) return new Uint8Array(await source.arrayBuffer());

    const response = await fetch(source);
    if (!response.ok) throw new Error(`Could not fetch ${source} (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
}

export async function toBlobURL(url, mimeType) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not fetch FFmpeg core (${response.status}).`);
    const blob = new Blob([await response.arrayBuffer()], { type: mimeType });
    return URL.createObjectURL(blob);
}

export class BrowserFFmpeg {
    constructor(workerURL) {
        this.workerURL = workerURL;
        this.worker = null;
        this.loaded = false;
        this.nextId = 1;
        this.pending = new Map();
        this.logCallbacks = new Set();
        this.progressCallbacks = new Set();
    }

    on(eventName, callback) {
        if (eventName === 'log') this.logCallbacks.add(callback);
        if (eventName === 'progress') this.progressCallbacks.add(callback);
    }

    off(eventName, callback) {
        if (eventName === 'log') this.logCallbacks.delete(callback);
        if (eventName === 'progress') this.progressCallbacks.delete(callback);
    }

    ensureWorker() {
        if (this.worker) return;
        this.worker = new Worker(this.workerURL);
        this.worker.addEventListener('message', (event) => {
            const message = event.data || {};
            if (message.type === 'log') {
                this.logCallbacks.forEach((callback) => callback(message.data));
                return;
            }
            if (message.type === 'progress') {
                this.progressCallbacks.forEach((callback) => callback(message.data));
                return;
            }

            const pending = this.pending.get(message.id);
            if (!pending) return;
            this.pending.delete(message.id);

            if (message.ok) pending.resolve(message.data);
            else pending.reject(new Error(message.error || 'FFmpeg worker failed.'));
        });
        this.worker.addEventListener('error', (event) => {
            const error = new Error(event.message || 'FFmpeg worker crashed.');
            for (const pending of this.pending.values()) pending.reject(error);
            this.pending.clear();
            this.loaded = false;
        });
    }

    send(type, data, transfer = []) {
        this.ensureWorker();
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.worker.postMessage({ id, type, data }, transfer);
        });
    }

    async load(config) {
        const first = await this.send('load', config);
        this.loaded = true;
        return first;
    }

    exec(args, timeout = -1) {
        return this.send('exec', { args, timeout });
    }

    ffprobe(args, timeout = -1) {
        return this.send('ffprobe', { args, timeout });
    }

    writeFile(path, data) {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        return this.send('writeFile', { path, data: bytes }, [bytes.buffer]);
    }

    readFile(path, encoding = 'binary') {
        return this.send('readFile', { path, encoding });
    }

    deleteFile(path) {
        return this.send('deleteFile', { path });
    }

    terminate() {
        if (this.worker) this.worker.terminate();
        this.worker = null;
        this.loaded = false;
        const error = new Error('FFmpeg worker terminated.');
        for (const pending of this.pending.values()) pending.reject(error);
        this.pending.clear();
    }
}
