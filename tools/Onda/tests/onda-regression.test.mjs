// Repeatable, dependency-free Onda source and isolated runtime regression tests.
// Run from the repository root: node --test tools/Onda/tests/*.test.mjs
// This suite never opens users' files, accesses their browser profile or calls Netlify.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';

function source(name) {
    return readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
}
function html() {
    return readFileSync(new URL('../index.html', import.meta.url), 'utf8');
}
function element(name = 'div') {
    const listeners = {};
    return {
        tagName: name, listeners, dataset: {}, children: [], textContent: '',
        value: '', hidden: false, disabled: false, src: '', paused: true,
        addEventListener(key, fn) { listeners[key] = fn; },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        append(...children) { children.forEach(child => this.appendChild(child)); },
        setAttribute(key, value) { this[key] = value; },
        removeAttribute(key) { if (key === 'src') this.src = ''; },
        load() {},
        click() { this.clickCount = (this.clickCount || 0) + 1; },
        remove() {},
        pause() { this.paused = true; },
        play() { this.paused = false; return Promise.resolve(); }
    };
}

test('Onda shipped modules parse and script order preserves compatibility', () => {
    const app = source('app-core.js');
    const markup = html();
    for (const name of [
        'app-core.js', 'quick-play.js', 'device-qa.js',
        'diagnostics.js', 'media-session.js', 'file-access.js'
    ]) {
        assert.doesNotThrow(() => new Script(source(name), { filename: name }), name);
    }
    // Keep this test release-agnostic: v3.23 must not require editing it.
    const appVersion = app.match(/const ONDA_VERSION = '(v[0-9]+\.[0-9]+(?:\.[0-9]+)?)';/);
    assert.ok(appVersion, 'app-core must expose a valid version');
    assert.ok(markup.includes('js/app-core.js?v=' + appVersion[1].slice(1)),
        'HTML cache version must match app-core');
    const modules = ['app-core.js', 'media-session.js', 'quick-play.js', 'device-qa.js'];
    const positions = modules.map(name => markup.indexOf('js/' + name + '?v='));
    assert.ok(positions.every(position => position > 0));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    assert.match(markup, /id="btn-play">🧿/);
    assert.match(markup, /id="btn-prev">⏮/);
    assert.match(markup, /id="btn-next">⏭/);
});

test('Navigation-only checkpoints skip costly saves, retain UI keys', () => {
    const app = source('app-core.js');
    const start = app.indexOf('function saveLocalUiStateCheckpoint(');
    const end = app.indexOf('function restoreLocalUiScreen()', start);
    assert.ok(start >= 0 && end > start);
    const extractedFunction = app.slice(start, end).trim();
    let visualSync = 0;
    let visualSave = 0;
    let librarySave = 0;
    let saved = [];
    const env = {
        document: { querySelector: () => ({ id: 'tab-library' }) },
        localStorage: { setItem: (key, value) => saved.push([key, value]) },
        libraryDrawer: { dataset: { mobileView: 'playlists' } },
        ACTIVE_WORKSPACE_TAB_KEY: 'active',
        LIBRARY_MOBILE_VIEW_KEY: 'mobile',
        LOCAL_UI_SAVE_EVENT_KEY: 'checkpoint',
        syncVisibleVisualizerCardsToState: () => visualSync++,
        saveActiveVisualizerStack: () => visualSave++,
        saveActiveLibraryState: () => librarySave++,
        Date,
        console
    };
    const checkpoint = runInNewContext('(' + extractedFunction + ')', env);
    const navigate = [
        'screen-resize', 'screen-orientation-change', 'screen-orientation-change-settled',
        'screen-change-before:tab-files', 'screen-change-after:tab-files',
        'screen-change-before:tab-library', 'screen-change-after:tab-library',
        'mobile-library-view:results', 'mobile-library-view:help',
        'library-drawer-open', 'library-drawer-close', 'library-drawer-closed',
        'library-drawer-resize', 'library-drawer-corner-resize'
    ];
    for (const reason of navigate) {
        visualSync = visualSave = librarySave = 0;
        saved = [];
        checkpoint(reason);
        assert.deepEqual([visualSync, visualSave, librarySave], [0, 0, 0], reason);
        assert.deepEqual(saved.map(pair => pair[0]), ['active', 'mobile', 'checkpoint']);
        assert.equal(saved[0][1], 'tab-library');
        assert.equal(saved[1][1], 'playlists');
        assert.equal(JSON.parse(saved[2][1]).reason, reason);
    }
    const meaningful = [
        'visualiser-field-change', 'visualiser-field-blur',
        'settings-json-import', 'mobile-icon-settings-save',
        'settings-export', 'settings-playlists-backup-export',
        'settings-popup-close', 'modal-close:tags',
        'pagehide', 'beforeunload', 'visibility-hidden',
        'export-everything', 'checkpoint'
    ];
    for (const reason of meaningful) {
        visualSync = visualSave = librarySave = 0;
        saved = [];
        checkpoint(reason);
        assert.deepEqual([visualSync, visualSave, librarySave], [1, 1, 1], reason);
        assert.equal(saved.length, 3);
    }
    assert.match(app, /flushActiveLibraryState\('pagehide-flush'\)/);
    assert.match(app, /flushActiveLibraryState\('visibility-hidden-flush'\)/);
    assert.match(app, /saveActiveLibraryState\('add-local-files'\)/);
});

test('Quick Play is transient, cleans object URLs and only imports on explicit Add', async () => {
    const names = [
        'onda-quick-play-input', 'onda-quick-play-panel', 'onda-quick-play-audio',
        'onda-quick-play-title', 'onda-quick-play-status', 'btn-onda-quick-play',
        'btn-mobile-quick-play-audio', 'btn-onda-quick-replay',
        'btn-onda-quick-import', 'btn-onda-quick-discard'
    ];
    const elements = Object.fromEntries(names.map(name => [name, element()]));
    elements['onda-quick-play-panel'].hidden = true;
    const audio = elements['onda-quick-play-audio'];
    const files = [];
    const revoked = [];
    const imported = [];
    let pausedMain = 0;
    let onMainPlayback = null;
    let onPagehide = null;
    let view = '';
    const window = {
        OndaQuickPlayBridge: {
            pauseMain: () => pausedMain++,
            addToLibrary: async file => { imported.push(file); },
            onMainPlayback: fn => { onMainPlayback = fn; },
            notify: () => {}
        },
        OndaMediaSession: { refresh() {} },
        switchWorkspaceTab: name => { view = name; },
        addEventListener(name, fn) { if (name === 'pagehide') onPagehide = fn; }
    };
    const sandbox = {
        document: { getElementById: name => elements[name] || null },
        window,
        URL: {
            createObjectURL: file => {
                const uri = 'blob:temporary-' + (files.length + 1);
                files.push([file, uri]);
                return uri;
            },
            revokeObjectURL: uri => revoked.push(uri)
        }
    };
    const script = source('quick-play.js');
    assert.doesNotMatch(script, /\b(localStorage|sessionStorage|indexedDB)\b|\bfetch\s*\(/);
    runInNewContext(script, sandbox);
    const preview = window.OndaQuickPlay;
    assert.ok(preview);
    assert.equal(preview.getActiveAudio(), null);
    assert.equal(imported.length, 0);
    elements['btn-mobile-quick-play-audio'].listeners.click();
    assert.equal(elements['onda-quick-play-input'].clickCount, 1);

    const file = { name: 'safe <file>.mp3', type: 'audio/mpeg', size: 128 };
    const picker = elements['onda-quick-play-input'];
    picker.files = [file];
    picker.listeners.change();
    assert.equal(view, 'tab-files');
    assert.equal(preview.getActiveAudio(), audio);
    assert.equal(pausedMain, 1);
    assert.equal(elements['onda-quick-play-title'].textContent, file.name);
    assert.equal(imported.length, 0);
    assert.equal(files.length, 1);
    preview.stopForMainPlayback();
    assert.equal(preview.getActiveAudio(), null);
    assert.equal(revoked.length, 1);
    elements['btn-onda-quick-replay'].listeners.click();
    assert.equal(files.length, 2);
    onMainPlayback();
    assert.equal(revoked.length, 2);
    elements['btn-onda-quick-replay'].listeners.click();
    elements['btn-onda-quick-discard'].listeners.click();
    assert.equal(elements['onda-quick-play-panel'].hidden, true);
    assert.equal(revoked.length, 3);
    picker.files = [{ name: 'unsupported.mid', type: 'audio/midi' }];
    picker.listeners.change();
    assert.equal(imported.length, 0);
    picker.files = [file];
    picker.listeners.change();
    await elements['btn-onda-quick-import'].listeners.click();
    assert.equal(imported.length, 1);
    assert.equal(imported[0], file);
    assert.equal(elements['onda-quick-play-panel'].hidden, true);
    assert.equal(revoked.length, 4);
    picker.files = [file];
    picker.listeners.change();
    onPagehide();
    assert.equal(revoked.length, 5);
    assert.equal(preview.getActiveAudio(), null);
});

test('Media Session directs system controls to temporary playback, not saved queue', () => {
    const handlers = {};
    const session = {
        metadata: null,
        playbackState: '',
        setActionHandler(name, fn) { handlers[name] = fn; },
        setPositionState(state) { this.position = state; }
    };
    const temporaryAudio = element('audio');
    temporaryAudio.paused = false;
    temporaryAudio.duration = 100;
    temporaryAudio.currentTime = 15;
    temporaryAudio.playbackRate = 1;
    const savedAudio = element('audio');
    savedAudio.paused = true;
    savedAudio.duration = 120;
    let active = true;
    let regularCalls = 0;
    let previewPlays = 0;
    let previewPauses = 0;
    class MediaMetadata {
        constructor(data) { Object.assign(this, data); }
    }
    const window = {
        MediaMetadata,
        OndaQuickPlay: {
            getActiveAudio: () => active ? temporaryAudio : null,
            getMetadata: () => active ? { id: 'preview', title: 'Preview' } : null,
            play: () => previewPlays++,
            pause: () => previewPauses++,
            stop: () => { active = false; }
        },
        setInterval: () => 1
    };
    const context = {
        navigator: { mediaSession: session },
        window,
        document: {
            getElementById: () => null,
            addEventListener() {},
            baseURI: 'https://ondaplayer.netlify.app/'
        },
        MediaMetadata,
        URL,
        localAudio: savedAudio,
        streamAudio: savedAudio,
        activeAudio: savedAudio,
        currentFile: { name: 'saved' },
        virtualLibrary: { saved: { id: 'saved', title: 'Saved Audio' } },
        getCurrentPlaybackPlaylistName: () => '',
        getTrackArtwork: () => '',
        getDisplayTitle: meta => meta.title,
        playAudio: () => { regularCalls++; },
        pauseAudio: () => { regularCalls++; },
        skipToPreviousTrack: () => { regularCalls++; }
    };
    runInNewContext(source('media-session.js'), context);
    assert.equal(session.metadata.title, 'Preview');
    assert.equal(session.position.position, 15);
    handlers.play();
    handlers.pause();
    assert.equal(previewPlays, 1);
    assert.equal(previewPauses, 1);
    assert.equal(regularCalls, 0);
    handlers.previoustrack();
    handlers.nexttrack();
    assert.equal(regularCalls, 0);
    handlers.seekforward({ seekOffset: 5 });
    assert.equal(temporaryAudio.currentTime, 20);
    handlers.stop();
    window.OndaMediaSession.refresh();
    assert.equal(session.metadata.title, 'Saved Audio');
});

test('Device QA does nothing until Run and exports only fixed redacted fields', () => {
    const names = [
        'onda-device-qa-panel', 'btn-onda-device-qa-run',
        'btn-onda-device-qa-export', 'onda-device-qa-results',
        'onda-device-qa-manual'
    ];
    const elements = Object.fromEntries(names.map(name => [name, element()]));
    const labels = new Map();
    const version = source('app-core.js').match(/const ONDA_VERSION = '(v[0-9]+\.[0-9]+(?:\.[0-9]+)?)';/)[1];
    const document = {
        documentElement: { dataset: { ondaVersion: version } },
        getElementById: name => elements[name] || labels.get(name) || null,
        createElement: tag => {
            const el = element(tag);
            if (tag === 'audio') el.canPlayType = mime => mime === 'audio/mpeg' ? 'probably' : 'maybe';
            if (tag === 'select') {
                const baseAppend = el.appendChild.bind(el);
                el.appendChild = child => {
                    const item = baseAppend(child);
                    if (el.children.length === 1) el.value = child.value;
                    return item;
                };
            }
            Object.defineProperty(el, 'id', {
                get() { return this._id || ''; },
                set(value) { this._id = value; labels.set(value, this); }
            });
            return el;
        },
        body: { appendChild() {} }
    };
    const exports = [];
    const revocations = [];
    class Blob {
        constructor(parts) { exports.push(parts.join('')); }
    }
    const window = {
        isSecureContext: true,
        innerWidth: 390.2,
        innerHeight: 810.9,
        matchMedia: () => ({ matches: false }),
        showOpenFilePicker: () => {},
        MediaMetadata: class {},
        OndaQuickPlay: { getActiveAudio: () => null },
        OndaDiagnostics: { snapshot: () => {} }
    };
    const script = source('device-qa.js');
    assert.doesNotMatch(script, /\b(localStorage|sessionStorage|indexedDB)\b|\bfetch\s*\(/);
    const navigator = { mediaSession: { setPositionState() {} }, storage: { estimate() {} } };
    runInNewContext(script, {
        document, window, navigator, Blob,
        URL: { createObjectURL: () => 'blob:qa-export', revokeObjectURL: uri => revocations.push(uri) },
        setTimeout: fn => fn()
    });
    assert.equal(elements['onda-device-qa-results'].children.length, 0);
    assert.equal(elements['onda-device-qa-manual'].children.length, 8);
    assert.equal(window.OndaDeviceQA.snapshot().capabilities, null);
    elements['btn-onda-device-qa-run'].listeners.click();
    const report = window.OndaDeviceQA.snapshot();
    assert.equal(report.capabilities.loadedVersion, version);
    assert.equal(report.sourceVersion, version);
    assert.equal(report.capabilities.viewport.width, 390);
    assert.equal(report.capabilities.browserFeatures.filePicker, true);

    // The checker may be cached from an earlier Onda release; it must report
    // future app versions, but reject anything that isn't a safe version token.
    document.documentElement.dataset.ondaVersion = 'v18.47';
    elements['btn-onda-device-qa-run'].listeners.click();
    assert.equal(window.OndaDeviceQA.snapshot().capabilities.loadedVersion, 'v18.47');
    assert.equal(window.OndaDeviceQA.snapshot().sourceVersion, 'v18.47');
    document.documentElement.dataset.ondaVersion = 'v18.47<script>';
    elements['btn-onda-device-qa-run'].listeners.click();
    assert.equal(window.OndaDeviceQA.snapshot().capabilities.loadedVersion, 'unavailable');
    assert.equal(window.OndaDeviceQA.snapshot().sourceVersion, 'unavailable');
    document.documentElement.dataset.ondaVersion = version;
    elements['btn-onda-device-qa-run'].listeners.click();

    labels.get('onda-qa-saved-audio').value = 'pass';
    labels.get('onda-qa-media-session').value = 'incorrect-status';
    elements['btn-onda-device-qa-export'].listeners.click();
    const output = JSON.parse(exports[0]);
    assert.equal(output.manualChecks['saved-audio'], 'pass');
    assert.equal(output.manualChecks['media-session'], 'not-tested');
    assert.equal(revocations[0], 'blob:qa-export');
    assert.equal(output.capabilities.loadedVersion, version);
    assert.equal(output.sourceVersion, version);
    assert.doesNotMatch(JSON.stringify(output), /fileName|userAgent|secret|password|localPath/i);
});
