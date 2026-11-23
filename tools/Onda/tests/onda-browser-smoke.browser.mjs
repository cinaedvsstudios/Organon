// Actual headless Chromium checks against a local, disposable Onda origin.
// This is NOT an Android hardware/lock-screen test, and never touches user music.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
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
        let finalPath = path;
        if ((await stat(finalPath).catch(() => null))?.isDirectory()) {
            finalPath = resolve(finalPath, 'index.html');
        }
        const bytes = await readFile(finalPath);
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
    // These legitimate dialogs appear asynchronously in a completely fresh
    // browser profile. Choose the LOCAL EMPTY option for this disposable test
    // context rather than circumventing recovery/cloud protections.
    await page.waitForTimeout(1800);
    if (await page.locator('#onda-cloud-setup-modal.open').count()) {
        await page.locator('#onda-cloud-continue-local-btn').click({ timeout: 5000 });
    }
    if (await page.locator('#modal-startup-recovery').isVisible()) {
        await page.locator('#btn-startup-continue-empty').click({ timeout: 5000 });
    }
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
        console.log('desktop: first-run recovery/cloud prompts dismissed via local-only choices');
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
        await page.locator('#btn-database-engine').click();
        await page.waitForFunction(() => document.getElementById('library-manager-drawer')?.classList.contains('drawer-open'));
        assert.equal(await page.locator('#db-library-search').isVisible(), true);
        await page.locator('#db-library-search').fill('disposable-preview');
        assert.equal(await page.locator('#db-library-search').inputValue(), 'disposable-preview');
        assert.equal(await cachedAudioCount(page), 0);
        console.log('mobile-emulated: Library drawer and touch search operate');
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
    await mobileSmoke(browser, baseUrl);
    console.log('PASS: actual Chrome desktop + mobile-emulated Onda smoke tests');
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
