import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProjectFps, stepFrameTime, waitForVideoSeek } from '../js/frame-seek.mjs';
import { AdvancedMediaEngine } from '../js/advanced-media-engine-v0.24.js';

class FakeVideo {
    constructor({ frameCallbacks = true } = {}) {
        this.videoWidth = 640; this.videoHeight = 360; this.readyState = 2;
        this._currentTime = 0; this.decodedTime = 0; this.seeking = false;
        this.paused = true; this._serial = 0; this._callbacks = new Map();
        this._listeners = new Map(); this._frameCallbacks = frameCallbacks;
        if (!frameCallbacks) this.requestVideoFrameCallback = undefined;
    }
    get currentTime() { return this._currentTime; }
    set currentTime(t) {
        this._currentTime = t;
        this.seeking = true; this.readyState = 1;
        const serial = ++this._serial;
        queueMicrotask(() => {
            if (this._serial !== serial) return;
            this.seeking = false; this.readyState = 2; this.decodedTime = t;
            this.fire('seeked'); this.fire('loadeddata');
        });
    }
    addEventListener(type, fn) {
        if (!this._listeners.has(type)) this._listeners.set(type, new Set());
        this._listeners.get(type).add(fn);
    }
    removeEventListener(type, fn) { this._listeners.get(type)?.delete(fn); }
    fire(type) { for (const fn of [...(this._listeners.get(type) || [])]) fn(); }
    requestVideoFrameCallback(fn) {
        const id = ++this._serial;
        this._callbacks.set(id, fn);
        queueMicrotask(() => {
            const current = this._callbacks.get(id);
            if (!current) return;
            this._callbacks.delete(id);
            current(0, { mediaTime: this.decodedTime });
        });
        return id;
    }
    cancelVideoFrameCallback(id) { this._callbacks.delete(id); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
}
const clip = (media, { id = 'video', start = 0, duration = 10, offset = 0 } = {}) => ({
    id, type: 'video', start, clipDuration: duration,
    sourceOffset: offset, sourceDuration: 20, sourceName: id + '.mp4',
    visible: true, opacity: 1, blendMode: 'source-over',
    media, soundMedia: { currentTime: 0, play() { return Promise.resolve(); }, pause() {} },
    audio: { volume: 1, muted: false, fadeIn: 0, fadeOut: 0 },
});
function fixture() {
    const originalDocument = globalThis.document;
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCaf = globalThis.cancelAnimationFrame;
    const originalObjectUrl = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const draws = [];
    let snapshotTime = null;
    let now = 0;
    let serial = 0;
    const callbacks = new Map();
    const ctx = {
        save() {}, restore() {}, clearRect() {}, fillRect() {},
        drawImage(media) { if (media instanceof FakeVideo) draws.push(media.decodedTime); },
        getImageData() { return { data: new Uint8ClampedArray(4) }; }, putImageData() {},
    };
    const canvas = {
        width: 1280, height: 720,
        getContext() { return ctx; },
        toBlob(callback, type) { snapshotTime = draws.at(-1); callback(new Blob(['PNG'], { type })); },
    };
    globalThis.document = {
        createElement(type) {
            if (type === 'canvas') return { getContext: () => ctx };
            if (type === 'a') return { href: '', download: '', click() {}, remove() {} };
            throw Error('Unexpected element ' + type);
        },
        body: { appendChild() {} },
    };
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => {};
    globalThis.requestAnimationFrame = fn => { const id = ++serial; callbacks.set(id, fn); return id; };
    globalThis.cancelAnimationFrame = id => callbacks.delete(id);
    const engine = new AdvancedMediaEngine({
        canvas, mediaBin: {}, onTimeChange() {}, onDurationChange() {},
        onPlaybackChange() {}, onRenderError(error) { throw error; },
    });
    engine.ensureAudioGraph = async () => {
        engine.audioContext = { state: 'running', get currentTime() { return now; } };
    };
    engine.syncAudioSettings = () => {};
    return {
        engine, draws, get snapshotTime() { return snapshotTime; },
        setClock(time) { now = time; },
        tick(time) { now = time; const due = [...callbacks.values()]; callbacks.clear(); due.forEach(fn => fn()); },
        cleanup() {
            engine.pause();
            globalThis.document = originalDocument;
            globalThis.requestAnimationFrame = originalRaf;
            globalThis.cancelAnimationFrame = originalCaf;
            URL.createObjectURL = originalObjectUrl; URL.revokeObjectURL = originalRevoke;
        },
    };
}

test('project FPS normalisation and stepping obey the selected output grid', () => {
    assert.equal(normalizeProjectFps(25), 25);
    assert.equal(normalizeProjectFps('60'), 60);
    assert.equal(normalizeProjectFps('invalid'), 30);
    assert.equal(stepFrameTime(0.05, +1, 25, 10), 0.08);
    assert.equal(stepFrameTime(0.05, -1, 25, 10), 0.04);
    assert.equal(stepFrameTime(0, -1, 30, 10), 0);
    assert.equal(stepFrameTime(10, +1, 30, 10), 10);
});
test('waitForVideoSeek resolves after the newly decoded frame', async () => {
    const video = new FakeVideo();
    const ready = waitForVideoSeek(video, 3.4);
    assert.equal(video.decodedTime, 0);
    assert.equal(await ready, true);
    assert.equal(video.decodedTime, 3.4);
});
test('waitForVideoSeek handles existing positions without seeked event', async () => {
    const video = new FakeVideo({ frameCallbacks: false });
    assert.equal(await waitForVideoSeek(video, 0), true);
});
test('abort superseded media waits without changing the newer frame', async () => {
    const video = new FakeVideo();
    const controller = new AbortController();
    const first = waitForVideoSeek(video, 2, { signal: controller.signal });
    controller.abort();
    const second = waitForVideoSeek(video, 7);
    assert.equal(await first, false);
    assert.equal(await second, true);
    assert.equal(video.decodedTime, 7);
});
test('Advanced seek waits to render until frame decoding finishes', async () => {
    const app = fixture();
    try {
        const video = new FakeVideo();
        app.engine.setTracks([clip(video)]);
        app.draws.length = 0;
        const seekPromise = app.engine.seek(4, { resume: false });
        assert.equal(app.draws.length, 0, 'do not paint stale video immediately');
        assert.equal(await seekPromise, true);
        assert.equal(app.draws.at(-1), 4);
    } finally { app.cleanup(); }
});
test('Advanced seek cancels obsolete scrubs; last request wins', async () => {
    const app = fixture();
    try {
        const video = new FakeVideo();
        app.engine.setTracks([clip(video)]);
        app.draws.length = 0;
        const old = app.engine.seek(2, { resume: false });
        const latest = app.engine.seek(6, { resume: false });
        assert.equal(await old, false);
        assert.equal(await latest, true);
        assert.equal(app.draws.at(-1), 6);
    } finally { app.cleanup(); }
});
test('stepFrame uses project FPS and leaves transport paused', async () => {
    const app = fixture();
    try {
        const video = new FakeVideo();
        app.engine.setTracks([clip(video)]);
        assert.equal(app.engine.setProjectFrameRate(25), 25);
        await app.engine.play();
        assert.equal(app.engine.isPlaying, true);
        await app.engine.stepFrame(1);
        assert.equal(app.engine.isPlaying, false);
        assert.equal(app.engine.currentTime, 0.04);
        assert.equal(app.draws.at(-1), 0.04);
    } finally { app.cleanup(); }
});
test('slider input stays paused, final change resumes previously playing transport', async () => {
    const app = fixture();
    try {
        const video = new FakeVideo();
        app.engine.setTracks([clip(video)]);
        await app.engine.play();
        await app.engine.seek(3, { resume: false });
        assert.equal(app.engine.isPlaying, false);
        await app.engine.seek(5, { resume: true });
        assert.equal(app.engine.isPlaying, true);
        assert.equal(video.decodedTime, 5);
    } finally { app.cleanup(); }
});
test('snapshot waits for most recently selected paused frame', async () => {
    const app = fixture();
    try {
        const video = new FakeVideo();
        app.engine.setTracks([clip(video)]);
        const pending = app.engine.seek(6, { resume: false });
        const saved = app.engine.snapshot();
        await pending;
        await saved;
        assert.equal(app.snapshotTime, 6);
    } finally { app.cleanup(); }
});
test('still-image-only seek does not block on video decoder', async () => {
    const app = fixture();
    try {
        const backdrop = {
            id: 'background', type: 'background', start: 0, clipDuration: 10,
            sourceName: 'background.jpg', visible: true, media: { naturalWidth: 100, naturalHeight: 100 },
        };
        app.engine.setTracks([backdrop]);
        assert.equal(await app.engine.seek(5), true);
        assert.equal(app.engine.currentTime, 5);
    } finally { app.cleanup(); }
});
