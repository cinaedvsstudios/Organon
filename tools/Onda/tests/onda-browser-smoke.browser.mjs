// Actual headless Chromium checks against a local, disposable Onda origin.
// This is NOT an Android hardware/lock-screen test, and never touches user music.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json',
    '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.ico': 'image/x-icon', '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};
// Only the dedicated version-upgrade browser scenario switches this local test
// server. All earlier scenarios use normal on-disk Onda files as before.
let simulatedRelease = null; // null | 'v3.49' | 'v3.50-failing' | 'v3.50'
let previousWorkerSource = '';
let previousAssetLinks = new Map();
function servePreviousIndex(html) {
    return html.replace(/(src|href)="([^"]+)"/g, (match, attr, target) => {
        const url = new URL(target, 'http://127.0.0.1/');
        const previous = previousAssetLinks.get(url.pathname);
        return previous ? attr + '="' + previous + '"' : match;
    });
}
function handler(request, response) {
    let url;
    try { url = new URL(request.url, 'http://127.0.0.1'); }
    catch { response.writeHead(400).end(); return; }
    let path;
    try { path = resolve(root, '.' + decodeURIComponent(url.pathname)); }
    catch { response.writeHead(400).end(); return; }
    if (path !== root && !path.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
    }
    (async () => {
        // Simulate the origin being unavailable while the previous app shell
        // recovers from its cache, independent of Chrome's offline flags.
        if (simulatedRelease === 'test-origin-outage') {
            response.writeHead(503, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
                .end('Test-only origin outage');
            return;
        }
        let finalPath = path;
        if ((await stat(finalPath).catch(() => null))?.isDirectory()) {
            finalPath = resolve(finalPath, 'index.html');
        }
        // Explicitly simulate a failed NEW worker installation by serving an
        // unavailable new-version shell file. Never use this on live Netlify.
        if (simulatedRelease === 'v3.50-failing' &&
            url.pathname === '/css/tokens.css' && url.search === '?v=3.50') {
            response.writeHead(503, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
                .end('Test-only transient deployment failure');
            return;
        }
        let bytes = await readFile(finalPath);
        if (simulatedRelease === 'v3.49') {
            if (url.pathname === '/onda-sw.js') {
                bytes = Buffer.from(previousWorkerSource);
            } else if (url.pathname === '/' || url.pathname === '/index.html') {
                bytes = Buffer.from(servePreviousIndex(bytes.toString('utf8')));
            } else if (url.pathname === '/js/app-core.js') {
                bytes = Buffer.from(bytes.toString('utf8')
                    .replace("const ONDA_VERSION = 'v3.50';", "const ONDA_VERSION = 'v3.49';"));
            } else if (url.pathname === '/manifest.webmanifest') {
                bytes = Buffer.from(bytes.toString('utf8').replaceAll('?v=3.50', '?v=3.49'));
            }
        }
        if (simulatedRelease && url.pathname === '/css/tokens.css') {
            const tag = simulatedRelease === 'v3.49' ? 'v3.49' : 'v3.50';
            bytes = Buffer.concat([bytes, Buffer.from('\n/* __onda_test_deployed_asset_' + tag + '__ */')]);
        }
        response.writeHead(200, {
            'Content-Type': mime[extname(finalPath)] || 'application/octet-stream',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
        });
        response.end(bytes);
    })().catch(() => response.writeHead(404).end('Not found'));
}
function wavTone(seconds = 3) {
    const rate = 12000;
    const frames = rate * seconds;
    const wav = Buffer.alloc(44 + frames * 2);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(rate, 24);
    wav.writeUInt32LE(rate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(frames * 2, 40);
    for (let i = 0; i < frames; i++) {
        wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 6000), 44 + i * 2);
    }
    return wav;
}
async function cachedAudioCount(page) {
    return page.evaluate(async () => {
        const stores = await indexedDB.databases();
        const existing = stores.find(x => x.name === 'OndaMediaPlayerPersistentDB');
        if (!existing) return 0;
        const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open(existing.name);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        try {
            if (!db.objectStoreNames.contains('audioFiles')) return 0;
            const tx = db.transaction('audioFiles', 'readonly');
            return await new Promise((resolve, reject) => {
                const req = tx.objectStore('audioFiles').count();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } finally {
            db.close();
        }
    });
}
async function expectLoaded(page, baseUrl) {
    await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
    await page.waitForFunction(() => Boolean(
        document.documentElement.dataset.ondaVersion &&
        window.OndaQuickPlay?.getActiveAudio &&
        window.OndaDeviceQA?.run &&
        window.OndaQuickPlayBridge?.addToLibrary
    ), { timeout: 15000 });
    const version = await page.evaluate(() => document.documentElement.dataset.ondaVersion);
    assert.match(version, /^v\d+\.\d+(?:\.\d+)?$/, 'valid current version');
    assert.equal(await page.locator('#btn-play').textContent(), '🧿');
    assert.equal(await page.locator('#btn-prev').textContent(), '⏮');
    assert.equal(await page.locator('#btn-next').textContent(), '⏭');
    return version;
}
async function chooseFreshLocalSession(page) {
    // A fresh local profile must start without cloud or recovery interruptions.
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('#onda-cloud-setup-modal.open').count(), 0);
    assert.equal(await page.locator('#modal-startup-recovery').isVisible(), false);
    assert.equal(await page.locator('#onda-cloud-modal-overlay.open').count(), 0);
    assert.equal(await page.locator('#modal-overlay.is-open').count(), 0);
}
async function desktopSmoke(browser, baseUrl) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    try {
        const version = await expectLoaded(page, baseUrl);
        console.log('desktop: app started as ' + version);
        await chooseFreshLocalSession(page);
        console.log('desktop: fresh local startup without recovery/cloud prompts');
        await page.locator('#btn-toggle-advanced').click();
        await page.locator('.settings-tab-btn[data-settings-tab="storage"]').click();
        await page.locator('#onda-device-qa-panel summary').click();
        await page.locator('#btn-onda-device-qa-run').click();
        const report = await page.evaluate(() => window.OndaDeviceQA.snapshot());
        assert.equal(report.sourceVersion, version);
        assert.equal(report.capabilities.loadedVersion, version);
        assert.equal(report.capabilities.secureContext, true);
        assert.equal(report.capabilities.installedAppComponents.quickPlay, true);
        assert.ok(Object.values(report.manualChecks).every(x => x === 'not-tested'));
        const pendingDownload = page.waitForEvent('download', { timeout: 12000 });
        await page.locator('#btn-onda-device-qa-export').click();
        const download = await pendingDownload;
        const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
        assert.equal(exported.sourceVersion, version);
        assert.equal(exported.capabilities.loadedVersion, version);
        assert.ok(Object.values(exported.manualChecks).every(x => x === 'not-tested'));
        assert.doesNotMatch(JSON.stringify(exported), /fileName|userAgent|password|localPath|secret/i);
        console.log('desktop: QA panel + redacted browser download confirmed');
        // Close the settings overlay before auditioning a disposable file.
        await page.locator('#btn-close-settings').click();

        // Navigation is moved for desktop too; streaming is deferred.
        assert.equal(await page.locator('.workspace-mode-bar .mode-tab-btn').count(),2);
        assert.equal(await page.locator('#tab-btn-youtube').count(),0);
        await page.locator('#btn-database-engine').click();
        await page.locator('.onda-drawer-workspaces #tab-btn-files').click();
        assert.equal(await page.locator('#tab-files').isVisible(),true);
        assert.equal(await page.locator('#library-manager-drawer #tab-files').count(),1);
        assert.equal(await page.locator('#library-manager-drawer').getAttribute('data-drawer-workspace'),'tab-files');
        const before = await cachedAudioCount(page);
        assert.equal(before, 0, 'new temporary browser must begin with no cached audio');
        await page.locator('#onda-quick-play-input').setInputFiles({
            name: 'onda-synthetic-check.wav',
            mimeType: 'audio/wav',
            buffer: wavTone()
        });
        await page.waitForFunction(() => Boolean(window.OndaQuickPlay?.getActiveAudio()));
        assert.equal(await page.locator('#onda-quick-play-panel').isVisible(), true);
        await page.waitForFunction(() => {
            const audio = document.getElementById('onda-quick-play-audio');
            return Number.isFinite(audio.duration) && audio.duration >= 2;
        }, { timeout: 10000 });
        // Real decoder and currentTime motion, not a fake audio element.
        await page.waitForFunction(() => document.getElementById('onda-quick-play-audio').currentTime > 0.08, { timeout: 10000 });
        assert.equal(await cachedAudioCount(page), before, 'preview cannot populate persistent audio cache');
        console.log('desktop: synthetic WAV decoded and played; no cache write during preview');
        await page.locator('#btn-onda-quick-discard').click();
        assert.equal(await page.evaluate(() => window.OndaQuickPlay.getActiveAudio()), null);
        assert.equal(await page.locator('#onda-quick-play-panel').isVisible(), false);
        assert.equal(await cachedAudioCount(page), before, 'discard does not write cache');

        // Explicit Add is a separate user action; test with the same synthetic WAV.
        await page.locator('#onda-quick-play-input').setInputFiles({
            name: 'onda-synthetic-check.wav',
            mimeType: 'audio/wav',
            buffer: wavTone()
        });
        await page.waitForFunction(() => Boolean(window.OndaQuickPlay?.getActiveAudio()));
        await page.locator('#btn-onda-quick-import').click();
        await page.waitForFunction(async () => {
            const databases = await indexedDB.databases();
            const found = databases.some(x => x.name === 'OndaMediaPlayerPersistentDB');
            if (!found) return false;
            return true;
        });
        // Cache writes run asynchronously after imported metadata enters the Library.
        await page.waitForFunction(async () => {
            const databases = await indexedDB.databases();
            if (!databases.some(x => x.name === 'OndaMediaPlayerPersistentDB')) return false;
            const req = indexedDB.open('OndaMediaPlayerPersistentDB');
            const db = await new Promise((resolve, reject) => {
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            try {
                if (!db.objectStoreNames.contains('audioFiles')) return false;
                return await new Promise((resolve, reject) => {
                    const request = db.transaction('audioFiles', 'readonly').objectStore('audioFiles').count();
                    request.onsuccess = () => resolve(request.result > 0);
                    request.onerror = () => reject(request.error);
                });
            } finally { db.close(); }
        }, { timeout: 15000 });
        const importedCount = await cachedAudioCount(page);
        assert.ok(importedCount >= 1, 'explicit Add creates an audio cache entry');
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(() => Boolean(window.OndaQuickPlay?.getActiveAudio));
        assert.equal(await cachedAudioCount(page), importedCount, 'browser reload preserves explicitly cached audio');
        console.log('desktop: explicit import + browser cache persistence after reload confirmed');

        // A stored blob is not enough: Onda must restore the saved Library
        // metadata and actually decode/play that blob after the browser reload.
        await page.locator('#btn-database-engine').click();
        const savedRow = page.locator('#db-library-results .library-result-row')
            .filter({ hasText: 'onda-synthetic-check.wav' });
        await savedRow.waitFor({ state: 'visible', timeout: 15000 });
        // Exercise the actual bulk editor against the disposable imported track.
        await page.locator('#btn-db-spreadsheet').evaluate(el=>el.click());
        const grid=page.locator('dialog.onda-bulk-grid');
        await grid.waitFor({state:'visible'});
        const artist=grid.locator('input[aria-label="Artist onda-synthetic-check.wav"]');
        await artist.fill('Disposable QA artist');
        await artist.press('Tab');
        assert.match(await grid.locator('[data-status]').textContent(),/1 changed tracks/);
        await grid.locator('[data-undo]').click();
        assert.equal(await artist.inputValue(),'');
        await grid.locator('[data-redo]').click();
        assert.equal(await artist.inputValue(),'Disposable QA artist');
        page.once('dialog',d=>d.accept());
        await grid.locator('[data-save]').click();
        await grid.waitFor({state:'detached'});
        assert.equal(await cachedAudioCount(page),importedCount);
        await page.locator('#btn-db-spreadsheet').evaluate(el=>el.click());
        await grid.waitFor({state:'visible'});
        assert.equal(await artist.inputValue(),'Disposable QA artist');
        await grid.locator('footer [data-close]').click();
        console.log('desktop: bulk editor staged edit, undo, redo, save and unchanged audio count');
        const sourceLine = await savedRow.locator('.library-file-line').textContent();
        assert.match(sourceLine, /local cached|local ready/i,
            'saved file must be identified as available, not requiring relink');
        assert.equal(await savedRow.locator('.btn-db-reconnect-track').count(), 0,
            'a cached track should not require a file picker after reload');

        // Network is disabled only AFTER the page has loaded successfully, to
        // verify actual local cache retrieval without requiring a remote stream.
        await context.setOffline(true);
        await savedRow.locator('.btn-db-play-track').click();
        await page.waitForFunction(() => {
            const audio = document.querySelector('audio.onda-hidden-audio');
            return Boolean(audio && audio.src.startsWith('blob:') &&
                Number.isFinite(audio.duration) && audio.duration >= 2);
        }, { timeout: 15000 });
        await page.waitForFunction(() => {
            const audio = document.querySelector('audio.onda-hidden-audio');
            return audio && !audio.paused && audio.currentTime > 0.12;
        }, { timeout: 15000 });
        assert.equal(await cachedAudioCount(page), importedCount,
            'playing the restored track must not create duplicate cached media');
        console.log('desktop: saved track restored and played OFFLINE from IndexedDB after reload');
        await context.setOffline(false);
    } finally {
        await context.close();
    }
}
async function missingMediaReconnectSmoke(browser, baseUrl) {
    // Import metadata ONLY in its own disposable Chrome context. Unlike the
    // explicit audio import scenario, there must be no associated cached audio.
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        serviceWorkers: 'block'
    });
    const page = await context.newPage();
    const id = 'trk_synthetic_missing_reconnect_01';
    const filename = 'onda-reconnect-demo.wav';
    const playlist = 'QA Recovery Playlist';
    try {
        await expectLoaded(page, baseUrl);
        await chooseFreshLocalSession(page);
        const fixture = {
            app: 'Onda Media Player', type: 'onda-library', version: 1,
            libraryName: 'Test recovery metadata',
            tracks: {
                [id]: {
                    id, fileName: filename, title: 'QA Reconnect Demo',
                    sourceType: 'local', tags: ['Synthetic Recovery'],
                    playlists: [playlist], notes: 'retain this metadata',
                    localPath: filename
                }
            },
            playlists: { [playlist]: { trackIds: [id] } }
        };
        await page.locator('#json-file-input').setInputFiles({
            name: 'onda-synthetic-missing-catalogue.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(fixture))
        });
        await page.waitForFunction((trackId) => {
            const saved = JSON.parse(localStorage.getItem('ondaActiveLibraryV1') || '{}');
            const data = saved.library || saved;
            return Boolean(data.tracks?.[trackId]);
        }, id);
        assert.equal(await cachedAudioCount(page), 0,
            'metadata-only import must not create audio cache entries');
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(() => Boolean(window.OndaQuickPlay?.getActiveAudio));
        await page.locator('#btn-database-engine').click();
        const row = page.locator('#db-library-results .library-result-row')
            .filter({ hasText: filename });
        await row.waitFor({ state: 'visible', timeout: 15000 });
        await page.waitForFunction(trackId => {
            const item = document.querySelector('#db-library-results .library-result-row[data-track-id="' + trackId + '"]');
            return item?.querySelector('.library-file-line')?.textContent.includes('needs relink')
                && item.querySelector('.btn-db-reconnect-track');
        }, id, { timeout: 15000 });
        assert.equal(await row.locator('.btn-db-reconnect-track').count(), 1);
        assert.equal(await cachedAudioCount(page), 0);
        console.log('reconnect: metadata-only track survives reload; missing audio shows Reconnect');

        // Clicking Play with no bytes should not silently import a track,
        // clear saved metadata or bring up a file picker without the user's
        // explicit Reconnect action.
        await row.locator('.btn-db-play-track').click();
        await page.waitForFunction(() => document.getElementById('toast-notice')?.textContent
            .includes('Saved audio unavailable'), { timeout: 10000 });
        assert.equal(await cachedAudioCount(page), 0);
        const savedBefore = await page.evaluate(trackId => {
            const payload = JSON.parse(localStorage.getItem('ondaActiveLibraryV1') || '{}');
            return (payload.library || payload).tracks?.[trackId];
        }, id);
        assert.equal(savedBefore.notes, 'retain this metadata');
        assert.ok(savedBefore.playlists.includes(playlist));
        assert.equal(await page.locator('#db-library-results .library-result-row').count(), 1,
            'missing source must not be silently removed or duplicated');

        // Reconnect is a distinct explicit user gesture. Use the real Chrome
        // filechooser event to provide an in-memory synthetic WAV.
        const chooserEvent = page.waitForEvent('filechooser');
        await row.locator('.btn-db-reconnect-track').click();
        const chooser = await chooserEvent;
        await chooser.setFiles({
            name: filename, mimeType: 'audio/wav', buffer: wavTone()
        });
        await page.waitForFunction(async trackId => {
            const db = await new Promise((resolve, reject) => {
                const req = indexedDB.open('OndaMediaPlayerPersistentDB');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            try {
                const request = db.transaction('audioFiles', 'readonly')
                    .objectStore('audioFiles').get(trackId);
                return await new Promise((resolve, reject) => {
                    request.onsuccess = () => resolve(Boolean(request.result?.file || request.result?.blob));
                    request.onerror = () => reject(request.error);
                });
            } finally { db.close(); }
        }, id, { timeout: 15000 });
        await page.waitForFunction(() => {
            const audio = document.querySelector('audio.onda-hidden-audio');
            return audio?.src.startsWith('blob:') && !audio.paused && audio.currentTime > 0.08;
        }, { timeout: 15000 });
        assert.equal(await cachedAudioCount(page), 1, 'Reconnect restores one existing track cache');
        assert.equal(await page.locator('#db-library-results .library-result-row').count(), 1,
            'Reconnect must preserve one stable Library row');
        const after = await page.evaluate(trackId => {
            const payload = JSON.parse(localStorage.getItem('ondaActiveLibraryV1') || '{}');
            return (payload.library || payload).tracks?.[trackId];
        }, id);
        assert.equal(after.id, id);
        assert.equal(after.notes, 'retain this metadata');
        assert.ok(after.playlists.includes(playlist));
        console.log('reconnect: real file chooser restores saved ID, metadata and playback');

        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(() => Boolean(window.OndaQuickPlay?.getActiveAudio));
        await page.locator('#btn-database-engine').click();
        const restored = page.locator('#db-library-results .library-result-row')
            .filter({ hasText: filename });
        await restored.waitFor({ state: 'visible', timeout: 15000 });
        await page.waitForFunction(trackId => {
            const item = document.querySelector('#db-library-results .library-result-row[data-track-id="' + trackId + '"]');
            return item && !item.querySelector('.btn-db-reconnect-track')
                && /cached|ready/.test(item.querySelector('.library-file-line')?.textContent || '');
        }, id, { timeout: 15000 });
        assert.equal(await cachedAudioCount(page), 1);
        console.log('reconnect: recovered audio still cached, no Reconnect after reload');
    } finally {
        await context.close();
    }
}

async function rememberedHandlePermissionSmoke(browser, baseUrl) {
    // A real browser-serializable Origin Private File System handle stands in
    // for a remembered file handle, without ever reading the user's real disk.
    // Permission denial is explicitly simulated by instrumenting its methods;
    // only hardware Android can establish OS permission prompt behaviour.
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }, serviceWorkers: 'block'
    });
    const page = await context.newPage();
    const id = 'trk_synthetic_linked_handle_01';
    const filename = 'onda-remembered-handle-test.wav';
    const listName = 'QA Linked Handle Playlist';
    try {
        await expectLoaded(page, baseUrl);
        await chooseFreshLocalSession(page);
        const created = await page.evaluate(async ({ trackId, fileName, bytes }) => {
            const root = await navigator.storage.getDirectory();
            const handle = await root.getFileHandle(fileName, { create: true });
            const writer = await handle.createWritable();
            await writer.write(Uint8Array.from(bytes));
            await writer.close();
            const saved = await window.OndaFileHandles.rememberMany([{
                trackId, handle, fileName, relativePath: fileName
            }]);
            return { saved, kind: handle.kind, bytes: (await handle.getFile()).size };
        }, { trackId: id, fileName: filename, bytes: [...wavTone()] });
        assert.equal(created.saved, 1);
        assert.equal(created.kind, 'file');
        assert.ok(created.bytes >= 2 * 12000, 'the synthetic OPFS file must contain actual WAV bytes');

        const fixture = {
            app: 'Onda Media Player', type: 'onda-library', version: 1,
            libraryName: 'Synthetic remembered handle test',
            tracks: {
                [id]: {
                    id, fileName: filename, title: 'Linked Handle Demo',
                    sourceType: 'local', tags: ['Synthetic Handle'],
                    playlists: [listName], notes: 'keep original linked metadata',
                    localPath: filename
                }
            },
            playlists: { [listName]: { trackIds: [id] } }
        };
        await page.locator('#json-file-input').setInputFiles({
            name: 'onda-synthetic-linked-handle-library.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(fixture))
        });
        await page.waitForFunction(trackId => {
            const payload = JSON.parse(localStorage.getItem('ondaActiveLibraryV1') || '{}');
            return Boolean((payload.library || payload).tracks?.[trackId]);
        }, id);
        assert.equal(await cachedAudioCount(page), 0,
            'a remembered handle must not cause an implicit audio cache copy');
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(trackId => {
            const row = document.querySelector('#db-library-results [data-track-id="' + trackId + '"]');
            return row?.querySelector('.library-file-line')?.textContent.includes('file linked');
        }, id, { timeout: 15000 });
        const fromDisk = await page.evaluate(async trackId => {
            const ids = await window.OndaFileHandles.listTrackIds();
            const record = await window.OndaFileHandles.getLinkedRecord(trackId);
            const opened = await window.OndaFileHandles.readFile(trackId);
            return {
                hasId: ids.includes(trackId),
                sameName: record?.handle?.name === opened?.name,
                bytes: opened?.size || 0
            };
        }, id);
        assert.equal(fromDisk.hasId, true,
            'IndexedDB must restore the real structured-cloned file handle');
        assert.equal(fromDisk.sameName, true);
        assert.ok(fromDisk.bytes > 0);
        if (!await page.locator('#library-manager-drawer').evaluate(el => el.classList.contains('drawer-open'))) {
            await page.locator('#btn-database-engine').click();
        }
        const row = page.locator('#db-library-results .library-result-row[data-track-id="' + id + '"]');
        await row.waitFor({ state: 'visible', timeout: 15000 });
        assert.equal(await row.locator('.btn-db-reconnect-track').count(), 0);
        await context.setOffline(true);
        await row.locator('.btn-db-play-track').click();
        await page.waitForFunction(() => {
            const audio = document.querySelector('audio.onda-hidden-audio');
            return audio?.src.startsWith('blob:') && !audio.paused && audio.currentTime > 0.12;
        }, { timeout: 15000 });
        assert.equal(await cachedAudioCount(page), 0,
            'granted remembered-handle playback should not silently duplicate audio in IndexedDB');
        await context.setOffline(false);
        console.log('handles: persisted OPFS file handle restored and played offline without an audio cache');

        // After another reload simulate a browser which has retained the handle
        // but denies access. Normal Play must NOT invoke requestPermission.
        await page.addInitScript(() => {
            const type = window.FileSystemFileHandle;
            if (!type?.prototype) return;
            window.__ondaPermissionProbe = { query: 0, request: 0 };
            Object.defineProperty(type.prototype, 'queryPermission', {
                configurable: true,
                value() {
                    window.__ondaPermissionProbe.query++;
                    return Promise.resolve('denied');
                }
            });
            Object.defineProperty(type.prototype, 'requestPermission', {
                configurable: true,
                value() {
                    window.__ondaPermissionProbe.request++;
                    return Promise.resolve('denied');
                }
            });
        });
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(trackId => {
            const row = document.querySelector('#db-library-results .library-result-row[data-track-id="' + trackId + '"]');
            return row?.querySelector('.library-file-line')?.textContent.includes('file linked');
        }, id, { timeout: 15000 });
        const denied = await page.evaluate(async trackId => {
            const file = await window.OndaFileHandles.readFile(trackId);
            return { fileIsNull: file === null, probe: { ...window.__ondaPermissionProbe } };
        }, id);
        assert.equal(denied.fileIsNull, true, 'silent read must not bypass denied permission');
        assert.ok(denied.probe.query > 0);
        assert.equal(denied.probe.request, 0, 'silent read must never ask for read permission');
        if (!await page.locator('#library-manager-drawer').evaluate(el => el.classList.contains('drawer-open'))) {
            await page.locator('#btn-database-engine').click();
        }
        const deniedRow = page.locator('#db-library-results .library-result-row[data-track-id="' + id + '"]');
        await deniedRow.locator('.btn-db-play-track').click();
        await page.waitForFunction(trackId => {
            const row = document.querySelector('#db-library-results .library-result-row[data-track-id="' + trackId + '"]');
            return row?.querySelector('.btn-db-reconnect-track') &&
                document.getElementById('toast-notice')?.textContent.includes('Saved audio unavailable');
        }, id, { timeout: 15000 });
        assert.equal(await page.evaluate(() => window.__ondaPermissionProbe.request), 0,
            'normal Play must not trigger a permission prompt');
        assert.equal(await cachedAudioCount(page), 0);
        console.log('handles: denied permission caused safe missing-source warning, not a permission prompt');

        // The FIRST explicit Reconnect asks for permission. If denied, Onda
        // offers its fallback manual picker on the NEXT explicit Reconnect.
        await deniedRow.locator('.btn-db-reconnect-track').click();
        await page.waitForFunction(() =>
            window.__ondaPermissionProbe?.request === 1 &&
            document.getElementById('toast-notice')?.textContent.includes('Tap Reconnect again'),
        { timeout: 10000 });
        const chooserEvent = page.waitForEvent('filechooser', { timeout: 12000 });
        await deniedRow.locator('.btn-db-reconnect-track').click();
        const chooser = await chooserEvent;
        await chooser.setFiles({ name: filename, mimeType: 'audio/wav', buffer: wavTone() });
        await page.waitForFunction(() => {
            const audio = document.querySelector('audio.onda-hidden-audio');
            return audio?.src.startsWith('blob:') && !audio.paused && audio.currentTime > 0.1;
        }, { timeout: 15000 });
        assert.equal(await page.evaluate(() => window.__ondaPermissionProbe.request), 1,
            'fallback picker must not trigger a second permission request');
        assert.equal(await cachedAudioCount(page), 1,
            'explicit manual Reconnect may create one audio cache entry');
        const savedMeta = await page.evaluate(trackId => {
            const payload = JSON.parse(localStorage.getItem('ondaActiveLibraryV1') || '{}');
            return (payload.library || payload).tracks?.[trackId];
        }, id);
        assert.equal(savedMeta.id, id);
        assert.equal(savedMeta.notes, 'keep original linked metadata');
        assert.ok(savedMeta.playlists.includes(listName));
        assert.equal(await page.locator('#db-library-results .library-result-row').count(), 1);
        console.log('handles: explicit denied grant fell back to manual picker, retaining ID and playlist');
    } finally {
        await context.close();
    }
}

async function mediaSessionSmoke(browser, baseUrl) {
    // Invoke the actual handlers registered with Chrome's Media Session API.
    // This tests real audio + handler routing, not physical headset/lock-screen input.
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        serviceWorkers: 'block'
    });
    const page = await context.newPage();
    try {
        await page.addInitScript(() => {
            window.__ondaSystemActions = {};
            const session = navigator.mediaSession;
            if (!session || typeof session.setActionHandler !== 'function') return;
            const register = session.setActionHandler.bind(session);
            session.setActionHandler = (action, callback) => {
                window.__ondaSystemActions[action] = callback;
                return register(action, callback);
            };
        });
        await expectLoaded(page, baseUrl);
        await chooseFreshLocalSession(page);
        const actions = await page.evaluate(() => Object.keys(window.__ondaSystemActions || {}));
        const expected = [
            'play', 'pause', 'stop', 'seekto', 'seekbackward',
            'seekforward', 'nexttrack', 'previoustrack'
        ];
        for (const action of expected) {
            assert.ok(actions.includes(action), 'Chrome Media Session must register ' + action);
        }
        assert.equal(await page.evaluate(() => window.OndaMediaSession?.supported), true);
        console.log('media session: Chrome registered all eight system playback actions');

        // Two real generated WAV tracks, to exercise transport switching and
        // Media Session metadata while decoding in Chromium's native audio.
        await page.locator('#file-input').setInputFiles([
            { name: 'onda-background-one.wav', mimeType: 'audio/wav', buffer: wavTone(12) },
            { name: 'onda-background-two.wav', mimeType: 'audio/wav', buffer: wavTone(12) }
        ]);
        await page.waitForFunction(() => {
            const audio = document.querySelector('audio.onda-hidden-audio');
            return audio?.src.startsWith('blob:') && !audio.paused &&
                audio.currentTime > 0.05 && audio.duration > 10;
        }, { timeout: 15000 });
        await page.waitForFunction(() =>
            navigator.mediaSession?.metadata?.title?.includes('onda-background-one'),
        { timeout: 10000 });
        assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), 'playing');

        const invoke = async (action, details = {}) => {
            return page.evaluate(({ action, details }) => {
                const fn = window.__ondaSystemActions[action];
                if (typeof fn !== 'function') throw new Error('Missing registered system action: ' + action);
                return fn(details);
            }, { action, details });
        };
        const audioState = () => page.evaluate(() => {
            const audio = document.querySelector('audio.onda-hidden-audio');
            return {
                paused: audio.paused,
                time: audio.currentTime,
                src: audio.currentSrc || audio.src,
                metadata: navigator.mediaSession?.metadata?.title || '',
                sessionState: navigator.mediaSession?.playbackState
            };
        });

        await invoke('pause');
        await page.waitForFunction(() => document.querySelector('audio.onda-hidden-audio')?.paused);
        assert.equal((await audioState()).sessionState, 'paused');
        await invoke('play');
        await page.waitForFunction(() =>
            !document.querySelector('audio.onda-hidden-audio')?.paused &&
            navigator.mediaSession?.playbackState === 'playing',
        { timeout: 10000 });
        await invoke('seekto', { seekTime: 3.0 });
        await page.waitForFunction(() =>
            document.querySelector('audio.onda-hidden-audio')?.currentTime >= 2.8);
        const atThree = (await audioState()).time;
        await invoke('seekforward', { seekOffset: 2 });
        const forward = (await audioState()).time;
        assert.ok(forward >= atThree + 1.5, 'system seekforward must advance main playback');
        await invoke('seekbackward', { seekOffset: 1 });
        const backward = (await audioState()).time;
        assert.ok(backward <= forward - 0.7, 'system seekbackward must move main playback');
        console.log('media session: saved audio play/pause/seekto/forward/backward operate');

        // Simulate the visibilitychange event used when Chrome backgrounds the
        // tab. This is not an Android screen-lock or actual process suspension.
        const beforeHidden = (await audioState()).time;
        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { configurable: true, value: true });
            Object.defineProperty(document, 'visibilityState', {
                configurable: true, value: 'hidden'
            });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForTimeout(350);
        const hiddenState = await audioState();
        assert.equal(hiddenState.paused, false, 'hidden event must not pause audio');
        assert.ok(hiddenState.time > beforeHidden + 0.08,
            'playback must continue advancing after the hidden-state handler');
        await page.evaluate(() => {
            delete document.hidden;
            delete document.visibilityState;
            document.dispatchEvent(new Event('visibilitychange'));
        });
        console.log('media session: synthetic hidden/visible event does not interrupt saved audio');

        await invoke('nexttrack');
        await page.waitForFunction(() =>
            navigator.mediaSession?.metadata?.title?.includes('onda-background-two') &&
            !document.querySelector('audio.onda-hidden-audio')?.paused,
        { timeout: 15000 });
        await invoke('previoustrack');
        await page.waitForFunction(() =>
            navigator.mediaSession?.metadata?.title?.includes('onda-background-one') &&
            !document.querySelector('audio.onda-hidden-audio')?.paused,
        { timeout: 15000 });
        console.log('media session: next/previous switches real queued WAV files and metadata');

        // Quick Play must temporarily own media keys, seek and metadata, not
        // mutate the saved queue; a Next/Previous command cannot navigate it.
        const beforePreview = await audioState();
        const cachedBefore = await cachedAudioCount(page);
        await page.locator('#onda-quick-play-input').setInputFiles({
            name: 'onda-background-preview.wav',
            mimeType: 'audio/wav', buffer: wavTone(12)
        });
        await page.waitForFunction(() => {
            const preview = window.OndaQuickPlay?.getActiveAudio?.();
            return preview && !preview.paused && preview.currentTime > 0.06;
        }, { timeout: 12000 });
        await page.waitForFunction(() =>
            navigator.mediaSession?.metadata?.title?.includes('onda-background-preview'),
        { timeout: 10000 });
        assert.equal((await audioState()).paused, true,
            'temporary audition must pause but preserve main player track');
        await invoke('pause');
        await page.waitForFunction(() => window.OndaQuickPlay?.getActiveAudio?.()?.paused);
        assert.equal((await audioState()).paused, true);
        await invoke('play');
        await page.waitForFunction(() => {
            const preview = window.OndaQuickPlay?.getActiveAudio?.();
            return preview && !preview.paused;
        });
        await invoke('seekto', { seekTime: 4.0 });
        await page.waitForFunction(() =>
            window.OndaQuickPlay?.getActiveAudio?.()?.currentTime >= 3.8);
        const previewAtFour = await page.evaluate(() =>
            window.OndaQuickPlay.getActiveAudio()?.currentTime);
        await invoke('seekbackward', { seekOffset: 1 });
        const previewBackward = await page.evaluate(() =>
            window.OndaQuickPlay.getActiveAudio()?.currentTime);
        assert.ok(previewBackward <= previewAtFour - 0.7);
        await invoke('seekforward', { seekOffset: 2 });
        const previewForward = await page.evaluate(() =>
            window.OndaQuickPlay.getActiveAudio()?.currentTime);
        assert.ok(previewForward >= previewBackward + 1.5);
        await invoke('nexttrack');
        await invoke('previoustrack');
        assert.equal((await audioState()).src, beforePreview.src,
            'Media Session next/previous must not change permanent queue during preview');
        assert.equal((await audioState()).paused, true);
        assert.equal(await cachedAudioCount(page), cachedBefore,
            'system controls on temporary audio must not add to persistent cache');
        console.log('media session: Quick Play takes media keys/metadata without changing saved queue');

        await invoke('stop');
        await page.waitForFunction(() =>
            !window.OndaQuickPlay?.getActiveAudio?.() &&
            navigator.mediaSession?.metadata?.title?.includes('onda-background-one'),
        { timeout: 10000 });
        await invoke('play');
        await page.waitForFunction(() =>
            !document.querySelector('audio.onda-hidden-audio')?.paused &&
            document.querySelector('audio.onda-hidden-audio')?.currentTime > 0,
        { timeout: 10000 });
        assert.equal(await cachedAudioCount(page), cachedBefore);
        console.log('media session: stop preview restores main metadata and system Play resumes main track');
    } finally {
        await context.close();
    }
}

async function offlineColdStartSmoke(baseUrl) {
    // This is a real Chrome process restart using a dedicated disposable
    // user-data directory. Existing Onda music or browser profiles are never
    // accessed, and the profile is cleaned up when the test completes.
    const profile = await mkdtemp(join(tmpdir(), 'onda-offline-shell-'));
    const options = {
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
        viewport: { width: 1280, height: 800 },
        serviceWorkers: 'allow'
    };
    let context;
    let onlineCacheCount = 0;
    try {
        context = await chromium.launchPersistentContext(profile, options);
        const page = context.pages()[0] || await context.newPage();
        const version = await expectLoaded(page, baseUrl);
        assert.equal(version, 'v3.50', 'offline shell test must use the current app build');
        await chooseFreshLocalSession(page);
        await page.waitForFunction(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            return reg?.active?.state === 'activated' &&
                Boolean(navigator.serviceWorker.controller);
        }, undefined, { timeout: 25000 });
        const shell = await page.evaluate(async () => {
            const names = await caches.keys();
            const cache = await caches.open('onda-static-shell-v3.50');
            const stored = await cache.keys();
            return {
                names, stored: stored.map(request => request.url),
                controller: navigator.serviceWorker.controller?.scriptURL || ''
            };
        });
        assert.equal(shell.names.filter(name => name.startsWith('onda-static-shell-')).length, 1);
        assert.ok(shell.stored.some(url => url.endsWith('/index.html')));
        assert.ok(shell.stored.some(url => /\/js\/app-core\.js\?v=3\.50$/.test(url)));
        assert.ok(shell.stored.some(url => /\/css\/responsive\.css\?v=3\.50$/.test(url)));
        assert.ok(shell.stored.some(url => url.endsWith('/onda-midi.js?v=3.50')));
        assert.ok(shell.stored.length >= 25, 'the entire static app shell must be cached');
        assert.ok(shell.controller.endsWith('/onda-sw.js'));
        assert.ok(shell.stored.every(url => !/audioFiles|\.wav|netlify\/functions|library\.json/i.test(url)),
            'the shell cache must never contain music, profiles or cloud responses');
        console.log('offline cold start: online install cached the exact app shell, no user/media data');

        await page.locator('#onda-quick-play-input').setInputFiles({
            name: 'onda-offline-restart.wav',
            mimeType: 'audio/wav',
            buffer: wavTone(12)
        });
        await page.waitForFunction(() => Boolean(window.OndaQuickPlay?.getActiveAudio()));
        await page.locator('#btn-onda-quick-import').click();
        await page.waitForFunction(async () => {
            if (!(await indexedDB.databases()).some(db => db.name === 'OndaMediaPlayerPersistentDB')) return false;
            const req = indexedDB.open('OndaMediaPlayerPersistentDB');
            const db = await new Promise((resolve, reject) => {
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            try {
                const count = db.transaction('audioFiles', 'readonly').objectStore('audioFiles').count();
                return await new Promise((resolve, reject) => {
                    count.onsuccess = () => resolve(count.result > 0);
                    count.onerror = () => reject(count.error);
                });
            } finally { db.close(); }
        }, undefined, { timeout: 15000 });
        onlineCacheCount = await cachedAudioCount(page);
        assert.ok(onlineCacheCount >= 1);
        // Ensure asynchronous Library metadata mirroring has completed as well.
        await page.waitForFunction(() => {
            const payload = JSON.parse(localStorage.getItem('ondaActiveLibraryV1') || '{}');
            const tracks = (payload.library || payload).tracks || {};
            return Object.values(tracks).some(track => track.fileName === 'onda-offline-restart.wav');
        }, undefined, { timeout: 15000 });

        // Close the entire Chromium process. Reopen this SAME isolated
        // browser profile, disconnect the network BEFORE opening Onda again.
        await context.close();
        context = null;
        context = await chromium.launchPersistentContext(profile, options);
        await context.setOffline(true);
        const offlinePage = context.pages()[0] || await context.newPage();
        await offlinePage.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
        await offlinePage.waitForFunction(() =>
            document.documentElement.dataset.ondaVersion === 'v3.50' &&
            Boolean(window.OndaQuickPlay?.getActiveAudio) &&
            Boolean(window.OndaFileHandles?.readFile),
        undefined, { timeout: 18000 });
        assert.ok((await offlinePage.evaluate(() => navigator.serviceWorker.controller?.scriptURL || ''))
            .endsWith('/onda-sw.js'), 'offline app startup must be service-worker controlled');
        assert.equal(await cachedAudioCount(offlinePage), onlineCacheCount);
        await offlinePage.locator('#btn-database-engine').click();
        const saved = offlinePage.locator('#db-library-results .library-result-row')
            .filter({ hasText: 'onda-offline-restart.wav' });
        await saved.waitFor({ state: 'visible', timeout: 15000 });
        await offlinePage.waitForFunction(() => {
            const rows = [...document.querySelectorAll('#db-library-results .library-result-row')];
            const row = rows.find(el => el.textContent.includes('onda-offline-restart.wav'));
            return row && /cached|ready/.test(row.querySelector('.library-file-line')?.textContent || '');
        }, undefined, { timeout: 15000 });
        assert.equal(await saved.locator('.btn-db-reconnect-track').count(), 0);
        await saved.locator('.btn-db-play-track').click();
        await offlinePage.waitForFunction(() => {
            const audio = document.querySelector('audio.onda-hidden-audio');
            return audio?.src.startsWith('blob:') &&
                !audio.paused && audio.duration >= 10 && audio.currentTime > 0.15;
        }, undefined, { timeout: 15000 });
        assert.equal(await cachedAudioCount(offlinePage), onlineCacheCount,
            'offline restart playback must not write or duplicate music cache');

        // Explicitly make sure unknown/cloud routes never get an HTML fallback.
        const unsupported = await offlinePage.evaluate(async () => {
            try {
                const response = await fetch('./__onda_not_in_app_shell.json');
                return { loaded: true, contentType: response.headers.get('content-type') };
            } catch (_) {
                return { loaded: false };
            }
        });
        assert.equal(unsupported.loaded, false,
            'offline service worker must never fabricate a response for unknown JSON/cloud requests');
        const after = await offlinePage.evaluate(async () => {
            const cache = await caches.open('onda-static-shell-v3.50');
            return (await cache.keys()).map(request => request.url);
        });
        assert.deepEqual(after, shell.stored, 'offline playback must not add media to static shell cache');
        console.log('offline cold start: restarted real Chrome with network OFF BEFORE page open; UI + cached WAV played');
    } finally {
        await context?.close();
        await rm(profile, { recursive: true, force: true });
    }
}

async function serviceWorkerUpgradeSmoke(baseUrl) {
    // Test the previous shipped v3.49 worker, NOT an invented stub.
    // The local server simulates a deploy changing in place on the same origin.
    const oldSource = await readFile(resolve(root, 'tests/fixtures/onda-sw-v3.49.js'), 'utf8');
    assert.match(oldSource, /SHELL_CACHE_PREFIX \+ 'v3\.49'/);
    const oldList = oldSource.match(/const SHELL_FILES = \[([\s\S]*?)\];/);
    assert.ok(oldList, 'previous-version fixture must include real asset list');
    previousWorkerSource = oldSource;
    previousAssetLinks = new Map();
    for (const entry of oldList[1].matchAll(/'([^']+)'/g)) {
        const path = entry[1];
        previousAssetLinks.set(new URL(path, baseUrl).pathname, path.replace(/^\.\//, ''));
    }
    const profile = await mkdtemp(join(tmpdir(), 'onda-version-upgrade-'));
    const options = {
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
        viewport: { width: 1280, height: 800 },
        serviceWorkers: 'allow'
    };
    let context;
    simulatedRelease = 'v3.49';
    try {
        context = await chromium.launchPersistentContext(profile, options);
        let page = context.pages()[0] || await context.newPage();
        assert.equal(await expectLoaded(page, baseUrl), 'v3.49');
        await chooseFreshLocalSession(page);
        await page.waitForFunction(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            return registration?.active?.state === 'activated' &&
                Boolean(navigator.serviceWorker.controller) &&
                (await caches.keys()).includes('onda-static-shell-v3.49');
        }, undefined, { timeout: 25000 });

        await page.evaluate(async () => {
            const cache = await caches.open('onda-unrelated-user-test-cache');
            await cache.put('./personal-protected-example.txt',
                new Response('keep this data intact'));
        });
        await page.locator('#onda-quick-play-input').setInputFiles({
            name: 'onda-upgrade-retained-track.wav',
            mimeType: 'audio/wav',
            buffer: wavTone(12)
        });
        await page.waitForFunction(() => Boolean(window.OndaQuickPlay?.getActiveAudio()));
        await page.locator('#btn-onda-quick-import').click();
        await page.waitForFunction(async () => {
            const db = await new Promise((resolve, reject) => {
                const req = indexedDB.open('OndaMediaPlayerPersistentDB');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            try {
                const req = db.transaction('audioFiles', 'readonly')
                    .objectStore('audioFiles').count();
                return await new Promise((resolve, reject) => {
                    req.onsuccess = () => resolve(req.result >= 1);
                    req.onerror = () => reject(req.error);
                });
            } finally { db.close(); }
        }, undefined, { timeout: 15000 });
        const mediaCount = await cachedAudioCount(page);
        assert.ok(mediaCount > 0);
        const previousEntry = await page.evaluate(async () => {
            const response = await (await caches.open('onda-static-shell-v3.49')).match('./index.html');
            return response ? await response.text() : '';
        });
        assert.match(previousEntry, /js\/app-core\.js\?v=3\.49/,
            'pinned old worker must cache old HTML with matching old asset query strings');

        // Simulate a partial deployment: the UPDATED v3.50 worker is available,
        // but one REQUIRED new asset is a 503. Installation must fail without
        // removing the older offline shell or unrelated Cache Storage.
        simulatedRelease = 'v3.50-failing';
        await page.evaluate(async () => {
            window.__ondaUpgradeState = 'waiting';
            const reg = await navigator.serviceWorker.getRegistration();
            reg.addEventListener('updatefound', () => {
                const candidate = reg.installing;
                if (!candidate) return;
                window.__ondaUpgradeState = candidate.state;
                candidate.addEventListener('statechange', () => {
                    window.__ondaUpgradeState = candidate.state;
                });
            }, { once: true });
            await reg.update();
        });
        await page.waitForFunction(() => window.__ondaUpgradeState === 'redundant',
            undefined, { timeout: 25000 });
        const failedInstallState = await page.evaluate(async () => ({
            caches: await caches.keys(),
            script: navigator.serviceWorker.controller?.scriptURL || ''
        }));
        assert.ok(failedInstallState.caches.includes('onda-static-shell-v3.49'));
        // An incomplete candidate cache may remain, but a failed worker must
        // NOT activate or remove the previous usable offline shell. Retry
        // fills the candidate rather than deleting any concurrent installer.
        assert.ok(failedInstallState.caches.includes('onda-unrelated-user-test-cache'));
        assert.ok(failedInstallState.script.endsWith('/onda-sw.js'));
        console.log('upgrade: new worker installation failed safely; previous v3.49 app shell remained');

        // Recover the OLD version with NO NETWORK after the bad deployment.
        // Restart the whole Chromium process first. Playwright's offline mode
        // on an ALREADY running service worker may not block worker fetches.
        await context.close();
        context = null;
        context = await chromium.launchPersistentContext(profile, options);
        await context.setOffline(true);
        simulatedRelease = 'test-origin-outage';
        const recoveredPage = context.pages()[0] || await context.newPage();
        await recoveredPage.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
        await recoveredPage.waitForFunction(() =>
            document.documentElement.dataset.ondaVersion === 'v3.49' &&
            Boolean(window.OndaQuickPlay?.getActiveAudio),
        undefined, { timeout: 15000 });
        assert.equal(await cachedAudioCount(recoveredPage), mediaCount);
        console.log('upgrade: old v3.49 and saved media survived failed update in a NEW offline Chrome process');

        // The server deployment is now complete. The real new worker must
        // INSTALL but WAIT while the v3.49 page still exists. Keep both shell
        // generations until that playback tab closes; never force takeover.
        // After the browser exits, new v3.50 activates and removes only v3.49.
        await context.setOffline(false);
        simulatedRelease = 'v3.50';
        page = recoveredPage;
        await page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            await reg.update();
        });
        await page.waitForFunction(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            const names = await caches.keys();
            if (reg?.waiting?.state !== 'installed' ||
                !names.includes('onda-staged-shell-v3.50') ||
                !names.includes('onda-static-shell-v3.49')) return false;
            const cache = await caches.open('onda-staged-shell-v3.50');
            const entries = (await cache.keys()).map(request => request.url);
            return entries.length >= 25 &&
                entries.some(url => /\/js\/app-core\.js\?v=3\.50$/.test(url));
        }, undefined, { timeout: 25000 });
        // Cache Storage can transition from staging to active while the
        // browser resolves pending worker lifecycle events. Do not open a
        // deleted staging cache here (that would create an empty cache and
        // produce a false failure). The fully populated stage was verified
        // in the wait above; the final OFFLINE restart verifies promotion.
        const stagedObservation = await page.evaluate(async () => {
            const userCache = await caches.open('onda-unrelated-user-test-cache');
            const protectedEntry = await userCache.match('./personal-protected-example.txt');
            const registration = await navigator.serviceWorker.getRegistration();
            return {
                names: await caches.keys(),
                protectedText: protectedEntry ? await protectedEntry.text() : '',
                waiting: registration?.waiting?.state || 'none'
            };
        });
        assert.equal(stagedObservation.protectedText, 'keep this data intact');
        assert.equal(await cachedAudioCount(page), mediaCount);
        console.log('upgrade: verified complete staged worker and preserved audio/user caches');

        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(() =>
            document.documentElement.dataset.ondaVersion === 'v3.50' &&
            Boolean(window.OndaMediaSession?.refresh),
        undefined, { timeout: 15000 });
        const tokens = await page.evaluate(async () => {
            const response = await fetch('./css/tokens.css?v=3.50');
            return response.text();
        });
        assert.match(tokens, /__onda_test_deployed_asset_v3\.50__/,
            'new release must not render the previous worker cached CSS');
        await page.locator('#btn-database-engine').click();
        const saved = page.locator('#db-library-results .library-result-row')
            .filter({ hasText: 'onda-upgrade-retained-track.wav' });
        await saved.waitFor({ state: 'visible', timeout: 15000 });
        await saved.locator('.btn-db-play-track').click();
        await page.waitForFunction(() => {
            const audio = document.querySelector('audio.onda-hidden-audio');
            return audio?.src.startsWith('blob:') && !audio.paused && audio.currentTime > 0.12;
        }, undefined, { timeout: 15000 });
        assert.equal(await cachedAudioCount(page), mediaCount);
        console.log('upgrade: online v3.50 HTML uses new versioned CSS while old worker is waiting');

        // One final real browser PROCESS restart while offline on v3.50.
        await context.close();
        context = null;
        context = await chromium.launchPersistentContext(profile, options);
        await context.setOffline(true);
        const offlinePage = context.pages()[0] || await context.newPage();
        await offlinePage.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
        await offlinePage.waitForFunction(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            const names = await caches.keys();
            return document.documentElement.dataset.ondaVersion === 'v3.50' &&
                reg?.active?.state === 'activated' &&
                names.includes('onda-static-shell-v3.50') &&
                !names.includes('onda-static-shell-v3.49');
        }, undefined, { timeout: 25000 });
        assert.equal(await cachedAudioCount(offlinePage), mediaCount);
        const offline = await offlinePage.evaluate(async () => {
            const names = await caches.keys();
            const cachedText = await (await caches.open('onda-unrelated-user-test-cache'))
                .match('./personal-protected-example.txt');
            return { names, protectedText: cachedText ? await cachedText.text() : '' };
        });
        assert.deepEqual(offline.names.filter(name => name.startsWith('onda-static-shell-')),
            ['onda-static-shell-v3.50']);
        assert.ok(!offline.names.includes('onda-staged-shell-v3.50'),
            'fully promoted upgrade must discard its staging cache');
        assert.equal(offline.protectedText, 'keep this data intact');
        await offlinePage.locator('#btn-database-engine').click();
        const row = offlinePage.locator('#db-library-results .library-result-row')
            .filter({ hasText: 'onda-upgrade-retained-track.wav' });
        await row.waitFor({ state: 'visible', timeout: 15000 });
        await row.locator('.btn-db-play-track').click();
        await offlinePage.waitForFunction(() => {
            const audio = document.querySelector('audio.onda-hidden-audio');
            return audio?.src.startsWith('blob:') && !audio.paused && audio.currentTime > 0.1;
        }, undefined, { timeout: 15000 });
        assert.equal(await cachedAudioCount(offlinePage), mediaCount);
        console.log('upgrade: new v3.50 shell and music survive full Chrome restart with network OFF');
    } finally {
        await context?.close();
        simulatedRelease = null;
        previousWorkerSource = '';
        previousAssetLinks = new Map();
        await rm(profile, { recursive: true, force: true });
    }
}

async function mobileSmoke(browser, baseUrl) {
    // Browser device emulation does not establish actual Android lock-screen results.
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true, hasTouch: true, deviceScaleFactor: 2,
        serviceWorkers: 'block'
    });
    const page = await context.newPage();
    try {
        const version = await expectLoaded(page, baseUrl);
        console.log('mobile-emulated: app started as ' + version);
        await chooseFreshLocalSession(page);
        // Assert geometry, not only clickability: a partly clipped button
        // previously passed mobile smoke because its visible portion was clickable.
        for (const zoom of [70, 100, 130]) {
            await page.evaluate(value => {
                const slider = document.getElementById('onda-interface-zoom');
                slider.value = String(value);
                slider.dispatchEvent(new Event('input', { bubbles: true }));
            }, zoom);
            await page.waitForTimeout(100);
            const geometry = await page.evaluate(() => {
                const ids = ['organon-bottom-panel','btn-database-engine','btn-toggle-layout-mode','btn-toggle-fullscreen'];
                return { width: window.innerWidth, height: window.innerHeight,
                    bounds: ids.map(id => {
                        const r = document.getElementById(id).getBoundingClientRect();
                        return { id, left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height };
                    }) };
            });
            for (const b of geometry.bounds) {
                assert.ok(b.width > 0 && b.height > 0 && b.left >= -1 && b.right <= geometry.width + 1 &&
                    b.top >= -1 && b.bottom <= geometry.height + 1,
                    'mobile '+zoom+'% '+JSON.stringify(b)+' viewport '+geometry.width+'x'+geometry.height);
            }
        }
        await page.evaluate(() => {
            const slider = document.getElementById('onda-interface-zoom');
            slider.value = '100';
            slider.dispatchEvent(new Event('input', { bubbles: true }));
        });
        assert.equal(await page.locator('#tab-btn-library .mode-tab-label').isVisible(), true);
        assert.equal(await page.locator('#tab-btn-youtube').count(), 0);
        await page.locator('#btn-database-engine').click();
        await page.waitForFunction(() => document.getElementById('library-manager-drawer')?.classList.contains('drawer-open'));
        assert.equal(await page.locator('#db-library-search').isVisible(), true);
        await page.locator('#db-library-search').fill('disposable-preview');
        assert.equal(await page.locator('#db-library-search').inputValue(), 'disposable-preview');
        assert.equal(await cachedAudioCount(page), 0);
        assert.equal(await page.locator('.workspace-mode-bar .mode-tab-btn').count(),2);
        for (const id of ['files','history','playlists']) assert.equal(await page.locator('.onda-drawer-workspaces #tab-btn-'+id).isVisible(),true);
        assert.equal(await page.locator('#library-action-panel').isVisible(), false, 'tools hidden by default');
        assert.equal(await page.locator('#btn-db-select-mode').isVisible(), true);
        assert.equal(await page.locator('#btn-db-settings-mode').isVisible(), true);
        await page.locator('#btn-db-select-mode').click();
        assert.equal(await page.locator('#library-action-select').isVisible(), true);
        await page.locator('#btn-db-select-mode').click();
        assert.equal(await page.locator('#library-action-panel').isVisible(), false);
        await page.locator('#btn-db-settings-mode').click();
        assert.equal(await page.locator('#btn-db-spreadsheet').isVisible(), true);
        assert.equal(await page.locator('#btn-db-travel-check').isVisible(), true);
        await page.locator('#btn-db-settings-mode').click();
        assert.equal(await page.locator('#library-action-panel').isVisible(), false);
        const searchGap = await page.evaluate(() => {
            const nav = document.querySelector('.onda-drawer-workspaces').getBoundingClientRect();
            const search = document.getElementById('db-library-search').getBoundingClientRect();
            return search.top - nav.bottom;
        });
        assert.ok(searchGap >= 0 && searchGap < 30, 'search must be directly beneath main navigation');
        for (const id of ['files','history','playlists']) {
            await page.locator('.onda-drawer-workspaces #tab-btn-'+id).click();
            assert.equal(await page.locator('#library-manager-drawer').getAttribute('aria-hidden'),'false');
            assert.equal(await page.locator('#library-manager-drawer #tab-'+id).isVisible(),true);
            assert.equal(await page.locator('#tab-library').evaluate(el=>el.classList.contains('active-content')),true);
        }
        await page.locator('.onda-drawer-workspaces [data-mobile-view="results"]').click();
        assert.equal(await page.locator('#db-library-search').isVisible(),true);
        await page.locator('#btn-close-library-manager').click();
        await page.locator('#tab-btn-queue').click();
        assert.equal(await page.locator('#now-playing-playlist-panel').isVisible(),true);
        assert.equal(await page.locator('.now-playing-layout').isVisible(),false);
        await page.locator('#tab-btn-library').click();
        assert.equal(await page.locator('#now-playing-playlist-panel').isVisible(),false);
        assert.equal(await page.locator('.now-playing-layout').isVisible(),true);
        await page.locator('#btn-database-engine').click();
        await page.locator('#tab-btn-files').click();
        assert.equal(await page.locator('#onda-quick-play-input').evaluate(el=>el.multiple),true);
        const batch = [
            {name:'onda-batch-long-title-one-with-a-really-long-name.wav',mimeType:'audio/wav',buffer:wavTone(12)},
            {name:'onda-batch-second-track.wav',mimeType:'audio/wav',buffer:wavTone(12)},
            ...Array.from({length:4},(_,i)=>({name:'onda-batch-extra-'+i+'.wav',mimeType:'audio/wav',buffer:wavTone(12)}))
        ];
        await page.locator('#onda-quick-play-input').setInputFiles(batch);
        await page.waitForFunction(()=>Boolean(window.OndaQuickPlay?.getActiveAudio()));
        assert.equal(await page.locator('#onda-quick-batch-select option').count(),6);
        await page.locator('#onda-quick-batch-select').selectOption('1');
        assert.match(await page.locator('#onda-quick-play-title').textContent(),/second-track/);
        assert.equal(await cachedAudioCount(page),0);
        await page.locator('#btn-onda-quick-import').click();
        await page.waitForFunction(()=>document.getElementById('onda-quick-play-panel').hidden);
        await page.locator('#btn-close-library-manager').click();
        await page.locator('#tab-btn-queue').click();
        assert.equal(await page.locator('#now-playing-playlist-track-list [data-queue-index]').count(),6);
        const flat = await page.evaluate(()=>{
            const list=document.getElementById('now-playing-playlist-track-list');
            const row=list.querySelector('[data-queue-index]');
            const title=row.querySelector('.library-track-title').getBoundingClientRect();
            const meta=row.querySelector('.library-track-meta').getBoundingClientRect();
            const actions=row.querySelector('.library-row-buttons').getBoundingClientRect();
            return {overflow:getComputedStyle(list).overflowY,titleBottom:title.bottom,metaTop:meta.top,metaBottom:meta.bottom,actionsTop:actions.top};
        });
        assert.equal(flat.overflow,'visible');
        const frames = await page.evaluate(() => {
            const style = id => getComputedStyle(document.getElementById(id));
            return {
                outer:parseFloat(style('workspace-viewport').borderTopWidth),
                outerStyle:style('workspace-viewport').borderTopStyle,
                outerRadius:parseFloat(style('workspace-viewport').borderTopLeftRadius),
                panel:parseFloat(style('now-playing-playlist-panel').borderTopWidth),
                list:parseFloat(style('now-playing-playlist-track-list').borderTopWidth)
            };
        });
        assert.ok(frames.outer > 0 && frames.outerStyle === 'solid' && frames.outerRadius > 0, 'outer workspace frame retained');
        assert.equal(frames.panel,0,'no nested queue panel frame');
        assert.equal(frames.list,0,'no nested track list frame');
        const headerGeometry = await page.evaluate(() => {
            const title = document.querySelector('.onda-current-queue-header .playlist-detail-title-block').getBoundingClientRect();
            const jump = document.querySelector('.onda-current-queue-header .btn-now-jump-current').getBoundingClientRect();
            const header = document.querySelector('.onda-current-queue-header').getBoundingClientRect();
            return {titleTop:title.top,titleRight:title.right,jumpTop:jump.top,jumpLeft:jump.left,jumpRight:jump.right,headerRight:header.right};
        });
        assert.ok(Math.abs(headerGeometry.titleTop-headerGeometry.jumpTop)<8 &&
            headerGeometry.jumpLeft>=headerGeometry.titleRight-1 &&
            headerGeometry.jumpRight<=headerGeometry.headerRight+1,
            'jump control must share heading row: '+JSON.stringify(headerGeometry));
        assert.ok(flat.titleBottom <= flat.metaTop + 1 && flat.metaBottom <= flat.actionsTop + 1,JSON.stringify(flat));
        const actionStyles = await page.evaluate(() => {
            const row = document.querySelector('#now-playing-playlist-track-list [data-queue-index="1"]');
            return [...row.querySelectorAll('button[data-onda-action]')].map(b=>({
                action:b.dataset.ondaAction, symbol:b.querySelector('svg.onda-action-glyph')?.innerHTML, color:getComputedStyle(b).color,
                glyphSize:b.querySelector('svg.onda-action-glyph')?.getBoundingClientRect().width,
                border:getComputedStyle(b).borderTopColor, background:getComputedStyle(b).backgroundColor,
                before:getComputedStyle(b,'::before').content, after:getComputedStyle(b,'::after').content
            }));
        });
        assert.deepEqual(actionStyles.map(x=>x.action),['play','info','add','remove']);
        assert.ok(actionStyles.every(x=>x.symbol && x.glyphSize>0), 'real vector glyphs are rendered');
        assert.equal(new Set(actionStyles.map(x=>x.symbol)).size,4);
        assert.equal(new Set(actionStyles.map(x=>x.color)).size,4);
        assert.equal(new Set(actionStyles.map(x=>x.background)).size,4);
        assert.ok(actionStyles.every(x=>x.before==='none' && x.after==='none' && x.color===x.border));
        await page.waitForFunction(()=>[...document.querySelectorAll('.onda-queue-duration')].every(e=>e.textContent.trim()!=='—'),undefined,{timeout:30000});
        const scrollCheck = await page.evaluate(async ()=>{
            const view=document.getElementById('tab-library'), header=view.querySelector('.onda-current-queue-header');
            const before=header.getBoundingClientRect().top;
            view.scrollTop=view.scrollHeight;
            await new Promise(r=>requestAnimationFrame(r));
            const result={before,after:header.getBoundingClientRect().top,scroll:view.scrollTop,overflow:getComputedStyle(view).overflowX};
            view.scrollTop=0;return result;
        });
        assert.ok(scrollCheck.scroll>0 && Math.abs(scrollCheck.before-scrollCheck.after)<2 && scrollCheck.overflow==='hidden',JSON.stringify(scrollCheck));
        const queueOrder=()=>page.locator('#now-playing-playlist-track-list [data-queue-index]').evaluateAll(rows=>rows.map(row=>row.dataset.trackId));
        const original=await queueOrder();
        await page.evaluate(()=>{window.__ondaTestRandom=Math.random;Math.random=()=>0;});
        await page.locator('.btn-now-reshuffle').click();
        await page.evaluate(()=>{Math.random=window.__ondaTestRandom;delete window.__ondaTestRandom;});
        const shuffled=await queueOrder();
        assert.notDeepEqual(shuffled,original);
        assert.deepEqual([...shuffled].sort(),[...original].sort());
        const expectedNext=await page.locator('.onda-current-queue-next-row').getAttribute('data-track-id');
        await page.locator('#btn-next').click();
        await page.waitForFunction(id=>document.querySelector('.now-playing-current-track')?.dataset.trackId===id,expectedNext);
        await page.locator('#btn-shuffle').click();
        await page.locator('#btn-database-engine').click();
        await page.locator('#db-library-search').fill('');
        await page.locator('#db-library-results [data-onda-action="play"]').first().waitFor({state:'visible'});
        const libraryActions = await page.evaluate(()=>[...document.querySelector('#db-library-results .library-result-row').querySelectorAll('button[data-onda-action]')].map(b=>({
            action:b.dataset.ondaAction, symbol:b.querySelector('svg.onda-action-glyph')?.innerHTML,color:getComputedStyle(b).color,
            glyphSize:b.querySelector('svg.onda-action-glyph')?.getBoundingClientRect().width
        })));
        for(const item of libraryActions) {
            const expected=actionStyles.find(x=>x.action===item.action);
            if(expected) assert.deepEqual(item,{action:expected.action,symbol:expected.symbol,color:expected.color,glyphSize:expected.glyphSize});
        }
        await page.locator('#btn-close-library-manager').click();
        console.log('mobile-emulated: batch import, flat queue, shared action symbols and distinct colors passed');
    } finally {
        await context.close();
    }
}
const server = createServer(handler);
let browser;
try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    browser = await chromium.launch({
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
    });
    const baseUrl = 'http://127.0.0.1:' + port + '/';
    await desktopSmoke(browser, baseUrl);
    await missingMediaReconnectSmoke(browser, baseUrl);
    await rememberedHandlePermissionSmoke(browser, baseUrl);
    await mediaSessionSmoke(browser, baseUrl);
    await offlineColdStartSmoke(baseUrl);
    await serviceWorkerUpgradeSmoke(baseUrl);
    await mobileSmoke(browser, baseUrl);
    console.log('PASS: actual Chrome desktop + mobile-emulated Onda smoke tests');
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
